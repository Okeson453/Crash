/**
 * V1.1 Ensemble Orchestrator — weighted model combination.
 * Design ref: Section 2.7
 *
 * Wraps existing ACIE as primary; additional models can be registered for
 * shadow scoring and eventual canary promotion.
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
}

export class EnsembleOrchestrator {
  private readonly logger = getLogger();
  private readonly weights = new Map<string, number>();

  constructor() {
    this.weights.set('acie-v3', 1.0);
  }

  setWeight(modelName: string, weight: number): void {
    this.weights.set(modelName, Math.max(0, weight));
  }

  combine(scores: ModelScore[]): EnsembleResult {
    if (scores.length === 0) {
      return { probability: 0.5, confidence: 0, scores: [], agreement: 0 };
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

    // Agreement: 1 - normalized stddev of probabilities
    const mean = scores.reduce((a, s) => a + s.probability, 0) / scores.length;
    const variance =
      scores.reduce((a, s) => a + (s.probability - mean) ** 2, 0) / scores.length;
    const agreement = Math.max(0, 1 - Math.sqrt(variance) * 2);

    this.logger.debug(
      {
        component: 'EnsembleOrchestrator',
        probability,
        confidence,
        agreement,
        models: scores.map((s) => s.modelName),
      },
      'Ensemble combined'
    );

    return { probability, confidence, scores, agreement };
  }
}
