/**
 * News/Sentiment Worker — external advisory signals (poll-style).
 * Design ref: Section 3.3.13
 */

import { BaseWorker } from '../framework/base-worker';
import type { WorkerContext } from '../framework/types';
import { getEventBus } from '../../core/event-bus/bus';

export class SentimentWorker extends BaseWorker {
  private lastPollAt: string | null = null;

  constructor(name = 'sentiment-1') {
    super({
      type: 'sentiment',
      name,
      priority: 'low',
      concurrency: 1,
      heartbeatIntervalMs: 30_000,
    });
  }

  protected async handle(payload: unknown, ctx: WorkerContext): Promise<void> {
    // Advisory only — no betting impact unless operator policy uses it
    this.lastPollAt = new Date().toISOString();
    const p = (payload ?? {}) as Record<string, unknown>;
    const score =
      typeof p.sentimentScore === 'number' ? p.sentimentScore : 0;

    if (Math.abs(score) < 0.3) return;

    const bus = getEventBus();
    await bus.emit({
      id: `sent-${ctx.eventId}`,
      type: 'SentimentAlert' as never,
      payload: {
        score,
        source: p.source ?? 'manual',
        polledAt: this.lastPollAt,
      },
      timestamp: this.lastPollAt,
      correlationId: ctx.correlationId,
      source: this.name,
    });
  }
}
