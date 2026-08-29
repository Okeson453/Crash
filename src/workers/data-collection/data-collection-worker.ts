import { BaseWorker } from '../framework/base-worker';
import type { WorkerContext } from '../framework/types';
import { getLogger } from '../../observability/logger';
export interface DataCollectionDeps { persistTick?: (payload: Record<string, unknown>) => Promise<void>; persistSnapshot?: (payload: Record<string, unknown>) => Promise<void>; }
export class DataCollectionWorker extends BaseWorker {
  private readonly deps: DataCollectionDeps; private buffer: Record<string, unknown>[] = []; private readonly batchSize = 50; private flushing: Promise<void> | null = null;
  constructor(deps: DataCollectionDeps = {}, name = 'data-collection-1') { super({ type: 'data-collection', name, priority: 'high', concurrency: 1, heartbeatIntervalMs: 5_000 }); this.deps = deps; }
  protected async handle(payload: unknown, ctx: WorkerContext): Promise<void> {
    const p = { ...((payload ?? {}) as Record<string, unknown>), collectedAt: ctx.receivedAt, correlationId: ctx.correlationId };
    this.buffer.push(p);
    if (this.buffer.length >= this.batchSize) await this.flush();
  }
  protected async onStop(): Promise<void> { await this.flush(); }
  private async flush(): Promise<void> {
    if (this.flushing || this.buffer.length === 0) return this.flushing ?? Promise.resolve();
    this.flushing = (async () => {
      const batch = this.buffer.slice();
      try {
        for (const item of batch) {
          if (item.kind === 'snapshot') await this.deps.persistSnapshot?.(item);
          else await this.deps.persistTick?.(item);
        }
        this.buffer.splice(0, batch.length);
      } catch (err) {
        getLogger().error({ component: 'DataCollectionWorker', error: String(err), retained: this.buffer.length }, 'Batch persistence failed; retaining buffered records');
        throw err;
      } finally { this.flushing = null; }
    })();
    return this.flushing;
  }
}
