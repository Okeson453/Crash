/**
 * Paystack webhook handler — signature verify + transfer success/fail routing.
 */

import { getLogger } from '../../observability/logger.js';
import { PaystackClient } from './paystack-client.js';

const logger = getLogger();

export interface PaystackWebhookResult {
  status: number;
  body: Record<string, unknown>;
}

export async function handlePaystackWebhook(opts: {
  rawBody: string | Buffer;
  signatureHeader?: string;
  paystack?: PaystackClient;
  onTransferSuccess?: (data: Record<string, unknown>) => Promise<Record<string, unknown> | void>;
  onTransferFailed?: (data: Record<string, unknown>) => Promise<Record<string, unknown> | void>;
}): Promise<PaystackWebhookResult> {
  const paystack = opts.paystack ?? new PaystackClient(undefined, { optional: true });
  const raw = typeof opts.rawBody === 'string' ? opts.rawBody : opts.rawBody.toString('utf8');
  const sig = opts.signatureHeader ?? '';

  if (sig && !paystack.verifyWebhookSignature(raw, sig)) {
    logger.warn({ component: 'PaystackWebhook' }, 'Invalid signature');
    return { status: 401, body: { error: 'invalid_signature' } };
  }

  let event: { event?: string; data?: Record<string, unknown> };
  try {
    event = JSON.parse(raw) as { event?: string; data?: Record<string, unknown> };
  } catch {
    return { status: 400, body: { error: 'invalid_json' } };
  }

  const name = String(event.event ?? '').toLowerCase();
  const data = (event.data ?? {}) as Record<string, unknown>;

  try {
    if (name.includes('success') || name === 'charge.success' || name.includes('transfer.success')) {
      const customer = (data.customer as Record<string, unknown>) ?? {};
      const result =
        (await opts.onTransferSuccess?.({
          ...data,
          customer,
          metadata: (data.metadata as Record<string, unknown>) ?? {},
        })) ?? {};
      return { status: 200, body: { ...result, ok: true } };
    }

    if (name.includes('failed') || name.includes('reversed')) {
      await opts.onTransferFailed?.(data);
      return { status: 200, body: { ok: true, handled: 'failed' } };
    }

    logger.info({ component: 'PaystackWebhook', event: name }, 'Unhandled event type');
    return { status: 200, body: { ok: true, ignored: true } };
  } catch (err) {
    logger.error({ component: 'PaystackWebhook', error: String(err) }, 'Webhook processing failed');
    return { status: 500, body: { error: 'processing_failed' } };
  }
}

/** Alias used by control-plane */
export async function processPaystackWebhookHttp(
  params: { rawBody: string | Buffer; signatureHeader?: string; enqueueOnly?: boolean }
): Promise<{ status: number; body: Record<string, unknown> }> {
  if (params.enqueueOnly) {
    // Immediate ACK — actual processing happens via WebhookInbox
    return { status: 200, body: { ok: true, enqueued: true } };
  }
  return handlePaystackWebhook({
    rawBody: params.rawBody,
    signatureHeader: params.signatureHeader,
  });
}
