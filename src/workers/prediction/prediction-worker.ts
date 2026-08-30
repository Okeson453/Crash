/**
 * Prediction Worker — runs the real prediction engine (no placeholders).
 * Phase 1: Incremental state → FeatureEngineV2 → ACIE/PSI → Calibration → PredictionGenerated.
 */

import { BaseWorker } from '../framework/base-worker';
import type { WorkerContext } from '../framework/types';
import type { EntryDecisionService } from '../../prediction/entry-decision-service';
import type { FeatureStore } from '../../prediction/feature-store';
import { getEventBus } from '../../core/event-bus/bus';
import { globalIncrementalFeatures } from '../../prediction/features/incremental-features';
import { globalFeatureEngineV2 } from '../../prediction/features/feature-engine-v2';
import { globalCalibrationState } from '../../prediction/calibration/calibration-state';
import { globalEnsemble } from '../../prediction/ensemble/ensemble-orchestrator';
import { scoreCandidates } from '../../prediction/models/candidate-models';
import { globalIncrementalState } from '../../prediction/state/incremental-state-engine';
import { getLogger } from '../../observability/logger';
import { randomUUID } from 'crypto';

export interface PredictionWorkerDeps {
  entryDecisionService?: EntryDecisionService;
  featureStore?: FeatureStore;
  buildRiskInput?: () =>
    | import('../../betting/types').RiskEvaluationInput
    | Promise<import('../../betting/types').RiskEvaluationInput>;
}

export class PredictionWorker extends BaseWorker {
  private readonly deps: PredictionWorkerDeps;
  private readonly log = getLogger();

  constructor(deps: PredictionWorkerDeps = {}, name = 'prediction-1') {
    super({
      type: 'prediction',
      name,
      priority: 'critical',
      concurrency: 1,
      heartbeatIntervalMs: 5_000,
    });
    this.deps = deps;
  }

  protected async handle(payload: unknown, _ctx: WorkerContext): Promise<void> {
    const t0 = performance.now();
    const p = (payload ?? {}) as Record<string, unknown>;
    const roundId = String(p.roundId ?? `r-${Date.now()}`);
    const crashPoint = Number(p.crashPoint);
    const phase = String(p.phase ?? 'round_detected');

    if ((phase === 'crash' || phase === 'observe') && Number.isFinite(crashPoint) && crashPoint > 0) {
      globalIncrementalFeatures.onCrash(crashPoint);
      const prevP = Number(p.previousProbability);
      if (Number.isFinite(prevP) && prevP > 0) {
        globalCalibrationState.observe(prevP, crashPoint >= 1.3 ? 1 : 0, String(p.regime ?? 'global'));
      }
      if (this.deps.entryDecisionService) {
        try {
          this.deps.entryDecisionService.observeCrash(roundId, crashPoint);
        } catch (err) {
          this.log.warn(
            { component: 'PredictionWorker', err: err instanceof Error ? err.message : String(err) },
            'observeCrash failed'
          );
        }
      }
    }

    const features = globalFeatureEngineV2.snapshotFromState(roundId, new Date().toISOString());
    const featureHash = globalFeatureEngineV2.featureHash(features.values);
    const snap = globalIncrementalState.snapshot();

    let rawProbability = snap.ewmaHit13;
    let confidence = Math.min(1, snap.count / 100);
    let regime = 'normal';
    let modelVersion = 'incremental-ewma';
    let strategyAction: 'ENTRY' | 'REDUCED_ENTRY' | 'SKIP' = 'SKIP';
    let stake = 0;
    let reason = 'baseline-incremental';

    const eds = this.deps.entryDecisionService;
    if (eds) {
      try {
        const acie = eds.getACIE();
        const evaluation = acie.evaluateNext({
          balance: Number(p.balance ?? 0),
          consecutiveLosses: Number(p.consecutiveLosses ?? 0),
          dailyEntriesUsed: Number(p.dailyEntriesUsed ?? 0),
          dailyEntriesLimit: Number(p.dailyEntriesLimit ?? 500),
          currentExposure: 0,
        });
        rawProbability = evaluation.psi.estimatedProbability;
        confidence = Math.max(0, Math.min(1, 1 - evaluation.psi.modelUncertainty));
        regime = String(evaluation.regime);
        modelVersion = 'acie-v3';
        if (evaluation.strategy.isOpportunity) {
          strategyAction = evaluation.strategy.action === 'REDUCED_ENTRY' ? 'REDUCED_ENTRY' : 'ENTRY';
          stake = evaluation.strategy.stake;
          reason = evaluation.strategy.reason;
        } else {
          strategyAction = 'SKIP';
          reason = evaluation.strategy.reason;
        }
      } catch (err) {
        this.log.warn(
          { component: 'PredictionWorker', err: err instanceof Error ? err.message : String(err) },
          'ACIE evaluateNext failed; using incremental baseline'
        );
      }
    }

    const candidates = scoreCandidates(globalIncrementalState);
    const ensembleScores = [
      {
        modelName: 'FrequencyModel',
        modelVersion: '1',
        probability: snap.ewmaHit13,
        confidence,
        weight: 1,
      },
      {
        modelName: 'MarkovChainModel',
        modelVersion: '1',
        probability: globalIncrementalState.markovPNextAbove13(),
        confidence,
        weight: 1,
      },
      ...candidates.map((c) => ({
        modelName: c.modelName,
        modelVersion: '1',
        probability: c.probability,
        confidence,
        weight: 1,
      })),
    ];
    const ensemble = globalEnsemble.combine(ensembleScores);
    rawProbability = 0.55 * rawProbability + 0.45 * ensemble.probability;

    const calibratedProbability = globalCalibrationState.calibrateWithShrinkage(
      rawProbability,
      regime,
      snap.ewmaHit13,
      snap.count
    );

    const latencyMs = performance.now() - t0;
    const predictionId = randomUUID();

    const eventPayload = {
      predictionId,
      roundId,
      tenantId: p.tenantId ?? null,
      modelVersion,
      featureVersion: features.featureVersion,
      regimeVersion: regime,
      calibrationVersion: globalCalibrationState.version,
      target: 1.3,
      rawProbability,
      calibratedProbability,
      confidence,
      expectedValue: calibratedProbability * 1.3 - 1,
      featureHash,
      timestamp: new Date().toISOString(),
      latencyMs,
      action: strategyAction,
      stake,
      reason,
      agreement: ensemble.agreement,
      calibrationMetrics: globalCalibrationState.metrics(),
      workerName: this.name,
    };

    try {
      await getEventBus().emit({
        type: 'PredictionGenerated' as never,
        timestamp: new Date().toISOString(),
        correlationId: predictionId,
        payload: eventPayload,
      } as never);
    } catch {
      /* event bus may not know PredictionGenerated in typed union — still log */
      this.log.debug({ component: 'PredictionWorker', predictionId }, 'Prediction event emit skipped/failed');
    }

    this.log.debug(
      { component: 'PredictionWorker', predictionId, latencyMs, calibratedProbability },
      'PredictionGenerated'
    );
  }
}
