/**
 * Entry Optimization Worker — scores opportunities into the ranker window.
 * Design ref: Section 3.3.7
 */

import { BaseWorker } from '../framework/base-worker';
import type { WorkerContext } from '../framework/types';
import type { OpportunityRanker } from '../../opportunity/ranker';
import { scoreOpportunity, type OpportunityDimensions, type ScoredOpportunity } from '../../opportunity/types';
import { randomUUID } from 'crypto';
import { getEventBus } from '../../core/event-bus/bus';

export interface EntryOptimizationDeps {
  ranker: OpportunityRanker;
}

export class EntryOptimizationWorker extends BaseWorker {
  private readonly deps: EntryOptimizationDeps;

  constructor(deps: EntryOptimizationDeps, name = 'entry-optimization-1') {
    super({
      type: 'entry-optimization',
      name,
      priority: 'critical',
      concurrency: 1,
      heartbeatIntervalMs: 5_000,
    });
    this.deps = deps;
  }

  protected async handle(payload: unknown, _ctx: WorkerContext): Promise<void> {
    const p = (payload ?? {}) as Record<string, unknown>;
    const roundId = String(p.roundId ?? '');
    if (!roundId) return;
    const decision = (p.decision ?? {}) as Record<string, unknown>;
    const signal = (decision.signal ?? p.signal ?? {}) as Record<string, unknown>;

    const dims: OpportunityDimensions = {
      edge: num(p.edge, num(signal.probability, num(p.probability, 0.5))),
      confidence: num(p.confidence, num(signal.confidence, 0.5)),
      dataQuality: num(p.dataQuality, 0.7),
      regimeFit: num(p.regimeFit, 0.7),
      executionFeasibility: num(p.executionFeasibility, 0.8),
      temporalConsistency: num(p.temporalConsistency, 0.7),
    };

    const qualityScore = scoreOpportunity(dims);
    const opp: ScoredOpportunity = {
      id: String(p.opportunityId ?? randomUUID()),
      roundId,
      tenantId: (p.tenantId as string) ?? null,
      dimensions: dims,
      qualityScore,
      probability: dims.edge,
      confidence: dims.confidence,
      regime: (p.regime as string) ?? (signal.regimeId as string) ?? null,
      modelVersion: (p.modelVersion as string) ?? (signal.modelVersion as string) ?? null,
      scoredAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 45_000).toISOString(),
    };

    const ranked = this.deps.ranker.upsert(opp);
    if (!ranked) return;
    await getEventBus().emitTyped('OpportunityScored', { ...ranked }, _ctx.correlationId, this.name);
  }
}

function num(v: unknown, fallback: number): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : fallback;
}
