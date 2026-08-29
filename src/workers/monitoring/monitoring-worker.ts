/**
 * Monitoring Worker — health of fleet, queue depths, sheath triggers.
 * Design ref: Section 3.3.10
 */

import { BaseWorker } from '../framework/base-worker';
import type { WorkerContext } from '../framework/types';
import type { WorkerFleet } from '../framework/worker-fleet';
import type { SheathMode } from '../../core/sheath-mode';
import type { SheathTrigger } from '../../core/sheath-mode';

export interface MonitoringWorkerDeps {
  fleet: WorkerFleet;
  sheathMode: SheathMode;
  onAlert?: (alert: { type: string; message: string; severity: string }) => void;
}

export class MonitoringWorker extends BaseWorker {
  private readonly deps: MonitoringWorkerDeps;

  constructor(deps: MonitoringWorkerDeps) {
    super({
      type: 'monitoring',
      name: 'monitoring-primary',
      priority: 'critical',
      concurrency: 1,
      heartbeatIntervalMs: 5_000,
    });
    this.deps = deps;
  }

  protected async handle(payload: unknown, _ctx: WorkerContext): Promise<void> {
    const snapshot = this.deps.fleet.snapshot();

    if (snapshot.failed > 0) {
      const failedNames = snapshot.workers
        .filter((w) => w.health.status === 'failed')
        .map((w) => w.name);
      const trigger: SheathTrigger = {
        id: 'worker_instability',
        severity: snapshot.failed >= 3 ? 'critical' : 'high',
        message: `Failed workers: ${failedNames.join(', ')}`,
        detectedAt: new Date().toISOString(),
        metadata: { failed: snapshot.failed, names: failedNames },
      };
      this.deps.sheathMode.reportTriggers([trigger]);
      this.deps.onAlert?.({
        type: 'worker_failure',
        message: trigger.message,
        severity: trigger.severity,
      });
    }

    if (snapshot.failed === 0 && snapshot.degraded === 0) {
      this.deps.sheathMode.clearTrigger('worker_instability');
    }

    if (payload && typeof payload === 'object' && (payload as { type?: string }).type === 'round') {
      this.deps.sheathMode.onRoundTick();
    }
  }
}
