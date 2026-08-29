/**
 * Learning Worker — outcome processing, drift hooks, calibration touchpoints.
 * Design ref: Section 3.3.11
 */

import { BaseWorker } from '../framework/base-worker';
import type { WorkerContext } from '../framework/types';
import type { SheathMode } from '../../core/sheath-mode';
import type { SheathTrigger } from '../../core/sheath-mode';

export interface LearningWorkerDeps {
  sheathMode?: SheathMode;
  onOutcome?: (payload: Record<string, unknown>) => Promise<void>;
  /** Rolling accuracy 0–1; if provided and low, may raise sheath trigger */
  getRollingAccuracy?: () => number;
  accuracyBaseline?: number;
  publishState?: () => void | Promise<void>;
}

export class LearningWorker extends BaseWorker {
  private readonly deps: LearningWorkerDeps;
  private outcomes = 0;
  private wins = 0;

  constructor(deps: LearningWorkerDeps = {}, name = 'learning-1') {
    super({
      type: 'learning',
      name,
      priority: 'background',
      concurrency: 1,
      heartbeatIntervalMs: 15_000,
    });
    this.deps = deps;
  }

  protected async handle(payload: unknown, _ctx: WorkerContext): Promise<void> {
    const p = (payload ?? {}) as Record<string, unknown>;
    if (this.deps.onOutcome) await this.deps.onOutcome(p);
    // Learning is isolated from inference; publish a new immutable state version only after completion.
    await this.deps.publishState?.();

    const won = p.won === true || p.outcome === 'win' || p.reachedTarget === true;
    this.outcomes += 1;
    if (won) this.wins += 1;

    const accuracy =
      this.deps.getRollingAccuracy?.() ??
      (this.outcomes > 0 ? this.wins / this.outcomes : 1);
    const baseline = this.deps.accuracyBaseline ?? 0.55;

    if (this.outcomes >= 50 && accuracy < baseline * 0.6 && this.deps.sheathMode) {
      const trigger: SheathTrigger = {
        id: 'poor_prediction_accuracy',
        severity: 'high',
        message: `Rolling accuracy ${(accuracy * 100).toFixed(1)}% below baseline`,
        detectedAt: new Date().toISOString(),
        metadata: { accuracy, baseline, outcomes: this.outcomes },
      };
      this.deps.sheathMode.reportTriggers([trigger]);
    } else if (this.outcomes >= 50 && accuracy >= baseline * 0.7 && this.deps.sheathMode) {
      this.deps.sheathMode.clearTrigger('poor_prediction_accuracy');
    }
  }
}
