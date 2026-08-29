/**
 * Prediction Worker — runs prediction path off the main coordinator when wired.
 * Design ref: Section 3.3.5
 */

import { BaseWorker } from '../framework/base-worker';
import type { WorkerContext } from '../framework/types';
import type { EntryDecisionService } from '../../prediction/entry-decision-service';
import type { FeatureStore } from '../../prediction/feature-store';
import { getEventBus } from '../../core/event-bus/bus';

export interface PredictionWorkerDeps {
  entryDecisionService?: EntryDecisionService;
  featureStore?: FeatureStore;
  buildRiskInput?: () => import('../../betting/types').RiskEvaluationInput | Promise<import('../../betting/types').RiskEvaluationInput>;
}

export class PredictionWorker extends BaseWorker {
  private readonly deps: PredictionWorkerDeps;

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

  protected async handle(payload: unknown, ctx: WorkerContext): Promise<void> {
    const p = (payload ?? {}) as Record<string, unknown>;
    const roundId = String(p.roundId ?? '');
    if (!roundId) return;

    if (!this.deps.entryDecisionService) throw new Error('PredictionWorker requires EntryDecisionService');
    const crashPoint = Number(p.crashPoint ?? p.multiplier ?? 0);
    // A completed crash updates ACIE; entry evaluation itself is for the NEXT opportunity.
    if (p.completedCrash === true && Number.isFinite(crashPoint) && crashPoint > 0) this.deps.entryDecisionService.observeCrash(roundId, crashPoint);
    if (p.evaluate === false) return;
    const decision = await this.deps.entryDecisionService.evaluateEntry({
      roundId,
      externalRoundId: typeof p.externalRoundId === 'string' ? p.externalRoundId : null,
      sessionId: typeof p.sessionId === 'string' ? p.sessionId : null,
      decisionTimestamp: new Date().toISOString(),
      riskInput: (p.riskInput as import('../../betting/types').RiskEvaluationInput | undefined) ?? (await this.deps.buildRiskInput?.()) ?? ({} as never),
    });
    if (this.deps.featureStore) {
      const featureDelta: Record<string, number> = {};
      if (Number.isFinite(crashPoint) && crashPoint > 0) featureDelta.last_crash_point = crashPoint;
      await this.deps.featureStore.updateIncremental(roundId, featureDelta);
    }

    const bus = getEventBus();
    await bus.emit({
      id: `pred-${ctx.eventId}`,
      type: 'PredictionGenerated' as never,
      payload: {
        roundId,
        generatedAt: new Date().toISOString(),
        worker: this.name,
        decision,
      },
      timestamp: new Date().toISOString(),
      correlationId: ctx.correlationId,
      source: this.name,
    });
  }
}
