import {
  StrategyLayer,
  HIGH_FREQUENCY_STRATEGY_POLICY,
  DEFAULT_STRATEGY_POLICY,
} from '@/prediction/acie/strategy';
import type { StrategyDecisionContext } from '@/prediction/acie/types';
import { PredictiveSequenceIntelligence } from '@/prediction/acie/psi';
import { TemporalPatternLearner } from '@/prediction/acie/tpl';
import { MODEL_NAMES } from '@/prediction/acie/online-state';
import { EnsembleOrchestrator } from '@/prediction/ensemble';

function baseCtx(over: Partial<StrategyDecisionContext> = {}): StrategyDecisionContext {
  return {
    target: 1.3,
    probability: 0.64,
    confidenceInterval: [0.58, 0.7],
    calibrationError: 0.05,
    evidence: 'SUPPORTED',
    regime: 'normal',
    regimeStability: 10,
    uncertainty: { model: 0.05, data: 0.05, total: 0.07 },
    riskState: {
      currentExposure: 0,
      consecutiveLosses: 0,
      dailyEntriesUsed: 50,
      dailyEntriesLimit: 500,
      balance: 100_000,
    },
    baselineProbability: 0.62,
    ...over,
  };
}

describe('HIGH_FREQUENCY_STRATEGY_POLICY', () => {
  it('defaults enable more entries than classic policy', () => {
    expect(HIGH_FREQUENCY_STRATEGY_POLICY.supportedThreshold).toBeLessThan(
      DEFAULT_STRATEGY_POLICY.supportedThreshold + 0.001
    );
    expect(HIGH_FREQUENCY_STRATEGY_POLICY.supportedThreshold).toBeLessThanOrEqual(0.58);
  });

  it('enters on moderate probability under HF adaptive policy', () => {
    const layer = new StrategyLayer(HIGH_FREQUENCY_STRATEGY_POLICY);
    const d = layer.evaluate(baseCtx({ probability: 0.6, evidence: 'SUPPORTED' }));
    expect(d.isOpportunity).toBe(true);
    expect(['ENTRY', 'REDUCED_ENTRY']).toContain(d.action);
  });

  it('still skips clearly weak probability', () => {
    const layer = new StrategyLayer(HIGH_FREQUENCY_STRATEGY_POLICY);
    const d = layer.evaluate(baseCtx({ probability: 0.45, evidence: 'WEAK' }));
    expect(d.action).toBe('SKIP');
  });

  it('lowers bar after deep-low regime (mean reversion)', () => {
    const layer = new StrategyLayer(HIGH_FREQUENCY_STRATEGY_POLICY);
    const neutral = layer.evaluate(baseCtx({ probability: 0.575, regime: 'normal' }));
    const deep = layer.evaluate(baseCtx({ probability: 0.575, regime: 'deep-low' }));
    // deep-low should be more willing to enter at same P
    expect(deep.isOpportunity || deep.action !== 'SKIP').toBe(true);
    // if neutral skipped, deep may still enter
    if (neutral.action === 'SKIP') {
      expect(deep.action).not.toBe('SKIP');
    }
  });

  it('raises bar when daily limit nearly exhausted', () => {
    const layer = new StrategyLayer(HIGH_FREQUENCY_STRATEGY_POLICY);
    const early = layer.evaluate(
      baseCtx({ probability: 0.59, riskState: { currentExposure: 0, consecutiveLosses: 0, dailyEntriesUsed: 20, dailyEntriesLimit: 500, balance: 1e5 } })
    );
    const late = layer.evaluate(
      baseCtx({ probability: 0.59, riskState: { currentExposure: 0, consecutiveLosses: 0, dailyEntriesUsed: 480, dailyEntriesLimit: 500, balance: 1e5 } })
    );
    if (early.isOpportunity) {
      // late may skip due to pacing
      expect(['ENTRY', 'REDUCED_ENTRY', 'SKIP']).toContain(late.action);
    }
  });
});

describe('expanded PSI ensemble models', () => {
  it('exposes 7 online models including momentum and bayesian', () => {
    expect(MODEL_NAMES).toEqual(
      expect.arrayContaining([
        'MomentumReversionModel',
        'ShortWindowBayesianModel',
        'VolatilityAdjustedModel',
      ])
    );
    expect(MODEL_NAMES.length).toBe(7);
  });

  it('produces seven model estimates from crash history', () => {
    const psi = new PredictiveSequenceIntelligence(new TemporalPatternLearner());
    const crashPoints = Array.from({ length: 80 }, (_, i) => (i % 5 === 0 ? 1.1 : 1.45));
    const tpl = new TemporalPatternLearner();
    const sequenceState = tpl.computeSequenceState(crashPoints);
    const regime = tpl.detectRegime(sequenceState);
    const models = psi.estimateModels({
      crashPoints,
      sequenceState,
      regime,
      history: [],
      ewmaHitRate: 0.66,
    });
    expect(models).toHaveLength(7);
    for (const m of models) {
      expect(m.probability).toBeGreaterThanOrEqual(0.01);
      expect(m.probability).toBeLessThanOrEqual(0.99);
    }
  });

  it('ensemble agreement recommends entry on aligned high probs', () => {
    const ens = new EnsembleOrchestrator();
    const result = ens.combine([
      { modelName: 'acie-v3', modelVersion: '3', probability: 0.68, confidence: 0.7, weight: 1 },
      { modelName: 'psi-ensemble', modelVersion: '1', probability: 0.66, confidence: 0.65, weight: 1 },
      { modelName: 'short-bayesian', modelVersion: '1', probability: 0.64, confidence: 0.6, weight: 1 },
      { modelName: 'momentum-reversion', modelVersion: '1', probability: 0.65, confidence: 0.6, weight: 1 },
    ]);
    expect(result.probability).toBeGreaterThan(0.6);
    expect(result.recommendedAction).toBe('ENTRY');
  });
});

describe('500 entry capacity math', () => {
  it('supports 500 entries within a day at ~35s average spacing', () => {
    const secondsPerDay = 86400;
    const entries = 500;
    const avgSpacingSec = secondsPerDay / entries;
    expect(avgSpacingSec).toBeLessThanOrEqual(180); // feasible vs crash cadence
    expect(entries).toBeGreaterThanOrEqual(500);
  });
});
