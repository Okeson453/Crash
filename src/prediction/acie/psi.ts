/**
 * PSI — Predictive Sequence Intelligence
 * Estimates P(next crash ≥ 1.30× | sequence + state).
 * Supports online ensemble weights updated every crash.
 */

import { ACIE_TARGET, PSIOutput, SequenceState, RegimeLabel, SOLRecord } from './types.js';
import { TemporalPatternLearner } from './tpl.js';
import { MODEL_NAMES } from './online-state.js';

export interface ModelEstimate {
  modelName: string;
  probability: number;
}

function clamp01(x: number): number {
  return Math.max(0.01, Math.min(0.99, x));
}

function variance(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = xs.reduce((a, b) => a + b, 0) / xs.length;
  return xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1);
}

export class PredictiveSequenceIntelligence {
  private readonly tpl: TemporalPatternLearner;

  constructor(tpl?: TemporalPatternLearner) {
    this.tpl = tpl ?? new TemporalPatternLearner();
  }

  /** Raw per-model estimates (used for online weight updates). */
  estimateModels(params: {
    crashPoints: number[];
    sequenceState: SequenceState;
    regime: RegimeLabel;
    history: SOLRecord[];
    ewmaHitRate?: number;
  }): ModelEstimate[] {
    return this.runModels(
      params.crashPoints,
      params.sequenceState,
      params.regime,
      params.history,
      params.ewmaHitRate
    );
  }

  estimate(params: {
    crashPoints: number[];
    sequenceState: SequenceState;
    regime: RegimeLabel;
    history: SOLRecord[];
    /** Online adaptive ensemble weights; falls back to static scheme */
    ensembleWeights?: Record<string, number>;
    ewmaHitRate?: number;
  }): PSIOutput {
    const { crashPoints, sequenceState, regime, history } = params;
    const models = this.runModels(
      crashPoints,
      sequenceState,
      regime,
      history,
      params.ewmaHitRate
    );
    const probs = models.map((m) => m.probability);
    const weights = this.resolveWeights(models, history.length, params.ensembleWeights);
    const estimatedProbability = clamp01(
      models.reduce((s, m, i) => s + m.probability * weights[i], 0)
    );
    const modelUncertainty = Math.sqrt(variance(probs));
    const dataUncertainty = 1 / Math.sqrt(Math.max(history.length, crashPoints.length, 1));
    const primaryIdx = weights.indexOf(Math.max(...weights));
    const ci = this.bootstrapInterval(probs, estimatedProbability, modelUncertainty);

    return {
      target: ACIE_TARGET,
      estimatedProbability,
      confidenceInterval: ci,
      sequenceState,
      regime,
      primaryModel: models[primaryIdx]?.modelName ?? 'FrequencyModel',
      ensembleWeight: weights[primaryIdx] ?? 1,
      modelUncertainty,
      dataUncertainty,
    };
  }

  private runModels(
    crashPoints: number[],
    sequenceState: SequenceState,
    regime: RegimeLabel,
    history: SOLRecord[],
    ewmaHitRate?: number
  ): ModelEstimate[] {
    const n = crashPoints.length;
    const hits = n === 0 ? 0 : crashPoints.filter((c) => c >= ACIE_TARGET).length;
    const baseline =
      ewmaHitRate != null && ewmaHitRate > 0
        ? ewmaHitRate
        : n === 0
          ? 0.65
          : hits / n;

    const freq = baseline;
    const cond = this.tpl.computeConditionalProbability(sequenceState, history);
    const conditional = cond.conditional;

    let regimeAdj = baseline;
    if (regime === 'low-cluster' || regime === 'deep-low') {
      // After low clusters, ≥1.30 is more likely on mean-reversion
      regimeAdj = clamp01(baseline + Math.max(0.02, cond.improvement * 0.55));
    } else if (regime === 'volatile') {
      regimeAdj = clamp01(baseline * 0.97);
    } else if (regime === 'high-activity') {
      regimeAdj = clamp01(baseline + 0.025);
    }

    let streakAware = baseline;
    if (history.length >= 40) {
      const streak = sequenceState.currentStreakBelow130;
      const bucket = history.filter(
        (r) => Math.abs(r.sequenceState.currentStreakBelow130 - streak) <= 1
      );
      if (bucket.length >= 20) {
        streakAware = bucket.filter((r) => r.reached130).length / bucket.length;
      }
    }

    // Momentum / mean-reversion: longer below-1.30 streaks raise next-hit odds
    const streakBelow = sequenceState.currentStreakBelow130 ?? 0;
    let momentum = baseline;
    if (streakBelow >= 1) {
      // Empirical bump: ~1.5pp per consecutive miss, capped
      momentum = clamp01(baseline + Math.min(0.12, streakBelow * 0.015));
    } else if ((sequenceState.currentStreakAbove130 ?? 0) >= 4) {
      // Mild fade after long above streaks
      momentum = clamp01(baseline - 0.03);
    }

    // Short-window Bayesian (Beta prior) over last 30 rounds
    const window = crashPoints.slice(-30);
    const wHits = window.filter((c) => c >= ACIE_TARGET).length;
    const priorA = 8; // weakly informative around ~0.65
    const priorB = 4;
    const shortBayesian = clamp01((priorA + wHits) / (priorA + priorB + window.length));

    // Volatility-adjusted: high short-term variance → slightly lower confidence in edge
    let volAdj = baseline;
    if (window.length >= 10) {
      const mean =
        window.reduce((a, b) => a + b, 0) / window.length;
      const variance =
        window.reduce((s, x) => s + (x - mean) ** 2, 0) / (window.length - 1);
      const vol = Math.sqrt(variance);
      if (vol > 8) volAdj = clamp01(baseline - 0.04);
      else if (vol < 2.5 && baseline >= 0.6) volAdj = clamp01(baseline + 0.02);
    }

    return [
      { modelName: 'FrequencyModel', probability: clamp01(freq) },
      { modelName: 'ConditionalFrequencyModel', probability: clamp01(conditional) },
      { modelName: 'RegimeAdjustedModel', probability: clamp01(regimeAdj) },
      { modelName: 'StreakAwareModel', probability: clamp01(streakAware) },
      { modelName: 'MomentumReversionModel', probability: clamp01(momentum) },
      { modelName: 'ShortWindowBayesianModel', probability: clamp01(shortBayesian) },
      { modelName: 'VolatilityAdjustedModel', probability: clamp01(volAdj) },
    ];
  }

  private resolveWeights(
    models: ModelEstimate[],
    sampleSize: number,
    online?: Record<string, number>
  ): number[] {
    if (online && Object.keys(online).length > 0) {
      const raw = models.map((m) => online[m.modelName] ?? 1 / models.length);
      const sum = raw.reduce((a, b) => a + b, 0) || 1;
      return raw.map((w) => w / sum);
    }
    const mature = sampleSize >= 200;
    const raw = models.map((m) => {
      if (m.modelName === 'FrequencyModel') return mature ? 0.12 : 0.28;
      if (m.modelName === 'ConditionalFrequencyModel') return mature ? 0.22 : 0.18;
      if (m.modelName === 'RegimeAdjustedModel') return mature ? 0.14 : 0.12;
      if (m.modelName === 'StreakAwareModel') return mature ? 0.16 : 0.14;
      if (m.modelName === 'MomentumReversionModel') return mature ? 0.14 : 0.12;
      if (m.modelName === 'ShortWindowBayesianModel') return mature ? 0.12 : 0.1;
      if (m.modelName === 'VolatilityAdjustedModel') return mature ? 0.1 : 0.06;
      return 0.1;
    });
    const sum = raw.reduce((a, b) => a + b, 0);
    return raw.map((w) => w / sum);
  }

  private bootstrapInterval(
    probs: number[],
    mean: number,
    modelUnc: number
  ): [number, number] {
    const spread = Math.max(modelUnc, variance(probs) ** 0.5, 0.03);
    return [clamp01(mean - 1.64 * spread), clamp01(mean + 1.64 * spread)];
  }
}

export { MODEL_NAMES };
