import { randomUUID } from 'crypto';
import { getPool } from '../persistence/client.js';
import { getLogger } from '../observability/logger.js';

export type WebhookProvider = 'paystack' | 'stripe';

export interface WebhookEnvelope {
  id?: string;
  provider: WebhookProvider;
  eventId: string;
  signature?: string;
  rawBody: string;
}

export class WebhookInbox {
  private readonly logger = getLogger();

  async enqueue(input: WebhookEnvelope): Promise<{ id: string; inserted: boolean }> {
    const id = input.id ?? randomUUID();
    const result = await getPool().query(
      `INSERT INTO webhook_inbox(id, provider, event_id, signature, raw_body)
       VALUES ($1,$2,$3,$4,$5) ON CONFLICT (provider,event_id) DO NOTHING RETURNING id`,
      [id, input.provider, input.eventId, input.signature ?? null, input.rawBody],
    );
    return { id: String(result.rows[0]?.id ?? id), inserted: Boolean(result.rowCount) };
  }

  async claim(limit = 20): Promise<Array<{ id: string; provider: WebhookProvider; eventId: string; rawBody: string }>> {
    const client = await getPool().connect();
    try {
      await client.query('BEGIN');
      const result = await client.query(
        `WITH candidates AS (
           SELECT id FROM webhook_inbox
           WHERE status IN ('pending','failed') AND next_attempt_at <= NOW()
             AND attempts < 10
           ORDER BY created_at ASC FOR UPDATE SKIP LOCKED LIMIT $1
         )
         UPDATE webhook_inbox w SET status='processing', attempts=w.attempts+1, locked_at=NOW(), updated_at=NOW()
         FROM candidates c WHERE w.id=c.id
         RETURNING w.id,w.provider,w.event_id,w.raw_body`,
        [limit],
      );
      await client.query('COMMIT');
      return result.rows.map((r) => ({ id:String(r.id), provider:r.provider as WebhookProvider, eventId:String(r.event_id), rawBody:String(r.raw_body) }));
    } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
  }

  async complete(id: string): Promise<void> {
    const client = await getPool().connect();
    try {
      await client.query('BEGIN');
      const row = await client.query(`SELECT provider,event_id,raw_body FROM webhook_inbox WHERE id=$1 FOR UPDATE`, [id]);
      if (!row.rowCount) throw new Error(`Webhook inbox item not found: ${id}`);
      if (row.rows[0].provider === 'stripe') {
        const event = JSON.parse(String(row.rows[0].raw_body)) as { type?: string };
        await client.query(`INSERT INTO stripe_webhook_events(event_id,event_type) VALUES ($1,$2) ON CONFLICT (event_id) DO NOTHING`, [row.rows[0].event_id, String(event.type ?? 'unknown')]);
      }
      await client.query(`UPDATE webhook_inbox SET status='processed', processed_at=NOW(), updated_at=NOW(), last_error=NULL WHERE id=$1`, [id]);
      await client.query('COMMIT');
    } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
  }

  async fail(id: string, error: unknown): Promise<void> {
    await getPool().query(
      `UPDATE webhook_inbox SET status=CASE WHEN attempts >= 10 THEN 'dead_letter' ELSE 'failed' END,
       next_attempt_at=NOW() + LEAST(power(2, LEAST(attempts, 8)) * INTERVAL '1 second', INTERVAL '15 minutes'),
       last_error=$2, updated_at=NOW() WHERE id=$1`,
      [id, error instanceof Error ? error.message : String(error)],
    );
  }

  async startProcessor(handler: (item: { provider: WebhookProvider; eventId: string; rawBody: string }) => Promise<void>): Promise<() => void> {
    let stopped = false;
    const loop = async () => {
      if (stopped) return;
      try {
        const items = await this.claim(20);
        for (const item of items) {
          try { await handler(item); await this.complete(item.id); }
          catch (error) { this.logger.error({ component:'WebhookInbox', provider:item.provider, eventId:item.eventId, error:String(error) }, 'Webhook processing failed'); await this.fail(item.id,error); }
        }
      } catch (error) { this.logger.error({ component:'WebhookInbox', error:String(error) }, 'Webhook inbox poll failed'); }
      if (!stopped) setTimeout(loop, 250);
    };
    void loop();
    return () => { stopped = true; };
  }
}
