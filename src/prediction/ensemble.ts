/**
 * V1.2 Ensemble Orchestrator — multi-model combination for high-frequency play.
 * Blends ACIE primary signal with secondary models; agreement gates stake size.
 */

import { getLogger } from '../observability/logger.js';

export interface ModelScore {
  modelName: string;
  modelVersion: string;
  probability: number;
  confidence: number;
  weight: number;
}

export interface EnsembleResult {
  probability: number;
  confidence: number;
  scores: ModelScore[];
  agreement: number;
  /** Suggested action bias for HF strategy */
  recommendedAction: 'ENTRY' | 'REDUCED_ENTRY' | 'SKIP';
}

export class EnsembleOrchestrator {
  private readonly logger = getLogger();
  private readonly weights = new Map<string, number>();

  constructor() {
    // Primary continuous learner
    this.weights.set('acie-v3', 0.45);
    this.weights.set('psi-ensemble', 0.25);
    this.weights.set('short-bayesian', 0.15);
    this.weights.set('momentum-reversion', 0.15);
  }

  setWeight(modelName: string, weight: number): void {
    this.weights.set(modelName, Math.max(0, weight));
  }

  combine(scores: ModelScore[]): EnsembleResult {
    if (scores.length === 0) {
      return {
        probability: 0.5,
        confidence: 0,
        scores: [],
        agreement: 0,
        recommendedAction: 'SKIP',
      };
    }

    let wSum = 0;
    let pSum = 0;
    let cSum = 0;
    for (const s of scores) {
      const w = this.weights.get(s.modelName) ?? s.weight ?? 1;
      wSum += w;
      pSum += s.probability * w;
      cSum += s.confidence * w;
    }

    const probability = wSum > 0 ? pSum / wSum : 0.5;
    const confidence = wSum > 0 ? cSum / wSum : 0;

    const mean = scores.reduce((a, s) => a + s.probability, 0) / scores.length;
    const variance =
      scores.reduce((a, s) => a + (s.probability - mean) ** 2, 0) / scores.length;
    const agreement = Math.max(0, 1 - Math.sqrt(variance) * 2);

    let recommendedAction: EnsembleResult['recommendedAction'] = 'SKIP';
    if (probability >= 0.62 && agreement >= 0.55) recommendedAction = 'ENTRY';
    else if (probability >= 0.57 && agreement >= 0.4) recommendedAction = 'REDUCED_ENTRY';

    this.logger.debug(
      {
        component: 'EnsembleOrchestrator',
        probability,
        confidence,
        agreement,
        recommendedAction,
        models: scores.map((s) => s.modelName),
      },
      'Ensemble combined'
    );

    return { probability, confidence, scores, agreement, recommendedAction };
  }
}
