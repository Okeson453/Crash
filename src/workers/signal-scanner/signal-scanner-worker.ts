/**
 * Market/Signal Scanner Worker — patterns, anomalies, early warnings.
 * Design ref: Section 3.3.3
 */

import { BaseWorker } from '../framework/base-worker';
import type { WorkerContext } from '../framework/types';
import { getEventBus } from '../../core/event-bus/bus';

export class SignalScannerWorker extends BaseWorker {
  private recentCrashPoints: number[] = [];
  private readonly window = 30;

  constructor(name = 'signal-scanner-1') {
    super({
      type: 'signal-scanner',
      name,
      priority: 'high',
      concurrency: 1,
      heartbeatIntervalMs: 5_000,
    });
  }

  protected async handle(payload: unknown, ctx: WorkerContext): Promise<void> {
    const p = (payload ?? {}) as Record<string, unknown>;
    const crashPoint = Number(p.crashPoint ?? p.multiplier);
    const roundId = String(p.roundId ?? '');
    if (!Number.isFinite(crashPoint) || !roundId) return;

    this.recentCrashPoints.push(crashPoint);
    if (this.recentCrashPoints.length > this.window) this.recentCrashPoints.shift();

    const signals: Array<{ type: string; strength: number; detail: string }> = [];

    // Streak of low crashes
    const last5 = this.recentCrashPoints.slice(-5);
    if (last5.length === 5 && last5.every((c) => c < 1.5)) {
      signals.push({ type: 'low_streak', strength: 0.7, detail: '5 consecutive crashes < 1.5x' });
    }

    // High variance
    if (this.recentCrashPoints.length >= 10) {
      const mean =
        this.recentCrashPoints.reduce((a, b) => a + b, 0) / this.recentCrashPoints.length;
      const variance =
        this.recentCrashPoints.reduce((a, b) => a + (b - mean) ** 2, 0) /
        this.recentCrashPoints.length;
      if (variance > 4) {
        signals.push({
          type: 'high_volatility',
          strength: Math.min(1, variance / 10),
          detail: `variance=${variance.toFixed(2)}`,
        });
      }
    }

    // Gap after long run
    if (crashPoint >= 10) {
      signals.push({ type: 'long_run', strength: 0.6, detail: `crash=${crashPoint}` });
    }

    if (signals.length === 0) return;

    const bus = getEventBus();
    await bus.emit({
      id: `sig-${ctx.eventId}`,
      type: 'SignalDetected' as never,
      payload: { roundId, crashPoint, signals },
      timestamp: new Date().toISOString(),
      correlationId: ctx.correlationId,
      source: this.name,
    });
  }
}
