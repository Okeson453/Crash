import { Pool } from 'pg';
import { getLogger } from '../../observability/logger';
import { EventBus } from './bus';

export class OutboxPublisher {
  private readonly logger = getLogger();
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;
  private consecutiveFailures = 0;
  private nextAllowedAt = 0;

  constructor(
    private readonly pool: Pool,
    private readonly eventBus: EventBus,
    private readonly intervalMs = 1000,
    private readonly batchSize = 50,
  ) {}

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => void this.publishBatch(), this.intervalMs);
    void this.publishBatch();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private async publishBatch(): Promise<void> {
    if (this.running) return;
    if (Date.now() < this.nextAllowedAt) return;
    this.running = true;
    const client = await this.pool.connect();
    try {
      // Platform GUC so any non-SECURITY-DEFINER paths / policies still allow access.
      await client.query(`SELECT set_config('app.platform_role', 'control_plane', true)`);

      const result = await client.query<{
        event_id: string;
        event_type: string;
        payload: unknown;
        correlation_id: string;
        source: string;
      }>('SELECT * FROM claim_event_outbox($1)', [this.batchSize]);

      this.consecutiveFailures = 0;

      for (const row of result.rows) {
        try {
          await this.eventBus.emit({
            id: row.event_id,
            type: row.event_type as never,
            payload: row.payload,
            timestamp: new Date().toISOString(),
            correlationId: row.correlation_id,
            source: row.source,
          });
          await client.query('SELECT mark_event_outbox_published($1)', [row.event_id]);
        } catch (error) {
          await client
            .query('SELECT mark_event_outbox_failed($1,$2)', [row.event_id, String(error)])
            .catch(() => undefined);
          this.logger.error(
            { component: 'OutboxPublisher', eventId: row.event_id, error: String(error) },
            'Outbox publication failed',
          );
        }
      }
    } catch (error) {
      this.consecutiveFailures += 1;
      // Exponential backoff up to 30s to avoid log floods when DB/RLS is misconfigured.
      const backoffMs = Math.min(30_000, this.intervalMs * 2 ** Math.min(this.consecutiveFailures, 5));
      this.nextAllowedAt = Date.now() + backoffMs;

      const err = error as { message?: string; code?: string; detail?: string; severity?: string };
      this.logger.warn(
        {
          component: 'OutboxPublisher',
          error: String(error),
          code: err.code,
          detail: err.detail,
          consecutiveFailures: this.consecutiveFailures,
          backoffMs,
        },
        'Outbox poll failed',
      );
    } finally {
      client.release();
      this.running = false;
    }
  }
}
