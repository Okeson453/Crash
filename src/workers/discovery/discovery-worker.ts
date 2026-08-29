/**
 * Discovery Worker — normalize game events → RoundDetected
 * Design ref: Section 3.3.1
 */

import { BaseWorker } from '../framework/base-worker';
import type { WorkerContext } from '../framework/types';
import { getEventBus } from '../../core/event-bus/bus';

export class DiscoveryWorker extends BaseWorker {
  constructor(name = 'discovery-1') {
    super({
      type: 'discovery',
      name,
      priority: 'critical',
      concurrency: 1,
      heartbeatIntervalMs: 5_000,
    });
  }

  protected async handle(payload: unknown, ctx: WorkerContext): Promise<void> {
    const p = (payload ?? {}) as Record<string, unknown>;
    const roundId = String(p.roundId ?? p.id ?? '');
    if (!roundId) return;

    const quality =
      typeof p.qualityScore === 'number'
        ? p.qualityScore
        : p.source === 'websocket'
          ? 0.95
          : 0.7;

    const bus = getEventBus();
    await bus.emit({
      id: ctx.eventId,
      type: 'RoundDetected' as never,
      payload: {
        roundId,
        qualityScore: quality,
        source: p.source ?? 'unknown',
        detectedAt: ctx.receivedAt,
      },
      timestamp: new Date().toISOString(),
      correlationId: ctx.correlationId,
      source: this.name,
    });
  }
}
