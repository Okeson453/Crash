/**
 * Confirmation Worker — secondary confirmation for signals.
 * Design ref: Section 3.3.4
 */

import { BaseWorker } from '../framework/base-worker';
import type { WorkerContext } from '../framework/types';
import { getEventBus } from '../../core/event-bus/bus';

export class ConfirmationWorker extends BaseWorker {
  constructor(name = 'confirmation-1') {
    super({
      type: 'confirmation',
      name,
      priority: 'high',
      concurrency: 1,
      heartbeatIntervalMs: 5_000,
    });
  }

  protected async handle(payload: unknown, ctx: WorkerContext): Promise<void> {
    const p = (payload ?? {}) as Record<string, unknown>;
    const signals = (p.signals as Array<{ type: string; strength: number }>) ?? [];
    const roundId = String(p.roundId ?? '');
    if (!roundId || signals.length === 0) return;

    const avgStrength =
      signals.reduce((a, s) => a + (s.strength ?? 0), 0) / Math.max(1, signals.length);
    const confirmed = avgStrength >= 0.55 && signals.length >= 1;

    const bus = getEventBus();
    await bus.emit({
      id: `conf-${ctx.eventId}`,
      type: (confirmed ? 'SignalConfirmed' : 'SignalRejected') as never,
      payload: {
        roundId,
        confirmed,
        avgStrength,
        signals,
        confirmedAt: new Date().toISOString(),
      },
      timestamp: new Date().toISOString(),
      correlationId: ctx.correlationId,
      source: this.name,
    });
  }
}
