/**
 * Durable prediction provenance (migration 025 tables).
 */

import { Pool } from 'pg';
import { getPool } from '../client.js';

export class PredictionProvenanceRepository {
  private pool: Pool;

  constructor(pool?: Pool) {
    this.pool = pool || getPool();
  }

  async recordModelScores(
    predictionId: string,
    scores: Array<{ modelName: string; modelVersion: string; probability: number; weight?: number }>
  ): Promise<void> {
    if (scores.length === 0) return;
    const client = await this.pool.connect();
    try {
      for (const s of scores) {
        await client.query(
          `INSERT INTO prediction_model_scores (prediction_id, model_name, model_version, probability, weight)
           VALUES ($1,$2,$3,$4,$5)`,
          [predictionId, s.modelName, s.modelVersion, s.probability, s.weight ?? null]
        );
      }
    } finally {
      client.release();
    }
  }

  async recordCalibration(input: {
    predictionId: string;
    rawProbability: number;
    calibratedProbability: number;
    calibrationVersion: string;
    ece?: number;
    regime?: string;
  }): Promise<void> {
    await this.pool.query(
      `INSERT INTO prediction_calibration
        (prediction_id, raw_probability, calibrated_probability, calibration_version, ece, regime)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [
        input.predictionId,
        input.rawProbability,
        input.calibratedProbability,
        input.calibrationVersion,
        input.ece ?? null,
        input.regime ?? null,
      ]
    );
  }

  async recordOpportunity(input: {
    opportunityId: string;
    predictionId: string;
    target: number;
    score: number;
    rank?: number;
    calibratedProbability?: number;
    regime?: string;
  }): Promise<void> {
    await this.pool.query(
      `INSERT INTO opportunity_scores
        (opportunity_id, prediction_id, target, score, rank, calibrated_probability, regime)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [
        input.opportunityId,
        input.predictionId,
        input.target,
        input.score,
        input.rank ?? null,
        input.calibratedProbability ?? null,
        input.regime ?? null,
      ]
    );
  }

  async recordShadow(input: {
    predictionId: string;
    modelName: string;
    modelVersion: string;
    probability: number;
    actualOutcome?: number | null;
  }): Promise<void> {
    await this.pool.query(
      `INSERT INTO shadow_predictions
        (prediction_id, model_name, model_version, probability, actual_outcome)
       VALUES ($1,$2,$3,$4,$5)`,
      [
        input.predictionId,
        input.modelName,
        input.modelVersion,
        input.probability,
        input.actualOutcome ?? null,
      ]
    );
  }

  async recordDrift(input: {
    driftType: string;
    detected: boolean;
    metricValue?: number;
    detail?: Record<string, unknown>;
  }): Promise<void> {
    await this.pool.query(
      `INSERT INTO prediction_drift (drift_type, detected, metric_value, detail)
       VALUES ($1,$2,$3,$4)`,
      [
        input.driftType,
        input.detected,
        input.metricValue ?? null,
        input.detail ? JSON.stringify(input.detail) : null,
      ]
    );
  }

  async upsertModelVersion(input: {
    modelName: string;
    modelVersion: string;
    stage: string;
    trafficShare: number;
    metrics?: Record<string, unknown>;
  }): Promise<void> {
    await this.pool.query(
      `INSERT INTO model_versions (model_name, model_version, stage, traffic_share, metrics, promoted_at)
       VALUES ($1,$2,$3,$4,$5, now())
       ON CONFLICT (model_name, model_version) DO UPDATE SET
         stage = EXCLUDED.stage,
         traffic_share = EXCLUDED.traffic_share,
         metrics = EXCLUDED.metrics,
         promoted_at = now()`,
      [
        input.modelName,
        input.modelVersion,
        input.stage,
        input.trafficShare,
        input.metrics ? JSON.stringify(input.metrics) : null,
      ]
    );
  }

  async enrichPrediction(input: {
    predictionId: string;
    calibratedProbability?: number;
    rawProbability?: number;
    featureHash?: string;
    calibrationVersion?: string;
    opportunityScore?: number;
    metaProbability?: number;
  }): Promise<void> {
    await this.pool.query(
      `UPDATE predictions SET
         calibrated_probability = COALESCE($2, calibrated_probability),
         raw_probability = COALESCE($3, raw_probability),
         feature_hash = COALESCE($4, feature_hash),
         calibration_version = COALESCE($5, calibration_version),
         opportunity_score = COALESCE($6, opportunity_score),
         meta_probability = COALESCE($7, meta_probability)
       WHERE prediction_id = $1`,
      [
        input.predictionId,
        input.calibratedProbability ?? null,
        input.rawProbability ?? null,
        input.featureHash ?? null,
        input.calibrationVersion ?? null,
        input.opportunityScore ?? null,
        input.metaProbability ?? null,
      ]
    );
  }
}

/** In-memory provenance for tests / dry-run */
export class InMemoryPredictionProvenanceRepository {
  readonly modelScores: unknown[] = [];
  readonly calibrations: unknown[] = [];
  readonly opportunities: unknown[] = [];
  readonly shadows: unknown[] = [];
  readonly drifts: unknown[] = [];

  async recordModelScores(...args: unknown[]): Promise<void> {
    this.modelScores.push(args);
  }
  async recordCalibration(input: unknown): Promise<void> {
    this.calibrations.push(input);
  }
  async recordOpportunity(input: unknown): Promise<void> {
    this.opportunities.push(input);
  }
  async recordShadow(input: unknown): Promise<void> {
    this.shadows.push(input);
  }
  async recordDrift(input: unknown): Promise<void> {
    this.drifts.push(input);
  }
  async upsertModelVersion(): Promise<void> {}
  async enrichPrediction(): Promise<void> {}
}
