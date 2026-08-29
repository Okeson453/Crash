/**
 * Validation Worker — data quality and prediction sanity checks.
 * Design ref: Section 3.3.12
 */

import { BaseWorker } from '../framework/base-worker';
import type { WorkerContext } from '../framework/types';
import type { SheathMode } from '../../core/sheath-mode';
import type { SheathTrigger } from '../../core/sheath-mode';

export interface ValidationWorkerDeps {
  sheathMode?: SheathMode;
}

export class ValidationWorker extends BaseWorker {
  private readonly deps: ValidationWorkerDeps;
  private lowQualityStreak = 0;

  constructor(deps: ValidationWorkerDeps = {}, name = 'validation-1') {
    super({
      type: 'validation',
      name,
      priority: 'normal',
      concurrency: 1,
      heartbeatIntervalMs: 10_000,
    });
    this.deps = deps;
  }

  protected async handle(payload: unknown, _ctx: WorkerContext): Promise<void> {
    const p = (payload ?? {}) as Record<string, unknown>;
    const quality =
      typeof p.qualityScore === 'number'
        ? p.qualityScore
        : typeof p.dataQuality === 'number'
          ? p.dataQuality
          : 1;

    if (quality < 0.5) {
      this.lowQualityStreak += 1;
    } else {
      this.lowQualityStreak = 0;
      this.deps.sheathMode?.clearTrigger('data_quality_degradation');
    }

    if (this.lowQualityStreak >= 5 && this.deps.sheathMode) {
      const trigger: SheathTrigger = {
        id: 'data_quality_degradation',
        severity: 'high',
        message: `Data quality < 0.5 for ${this.lowQualityStreak} consecutive events`,
        detectedAt: new Date().toISOString(),
        metadata: { quality, streak: this.lowQualityStreak },
      };
      this.deps.sheathMode.reportTriggers([trigger]);
    }
  }
}
