/**
 * Minimal Paystack REST client (customers, DVA, webhook verify).
 * Optional in dry-run / non-live / control-plane so Railway can boot without PAYSTACK_SECRET_KEY.
 */

import { createHmac } from 'crypto';
import { getLogger } from '../../observability/logger.js';
import { OperationalError } from '../../utils/errors.js';

const logger = getLogger();
const PAYSTACK_BASE = 'https://api.paystack.co';

export interface PaystackCustomer {
  id: number;
  customer_code: string;
  email: string;
}

export interface PaystackDva {
  id: number;
  account_number: string;
  account_name: string;
  bank?: { id?: number; name?: string; slug?: string };
}

export class PaystackClient {
  private readonly headers: Record<string, string>;
  private readonly secretKey: string;

  constructor(secretKey?: string, opts?: { optional?: boolean }) {
    this.secretKey = secretKey ?? process.env.PAYSTACK_SECRET_KEY ?? '';
    const mode = (process.env.APP_SYSTEM__MODE ?? process.env.EXECUTION_MODE ?? '').toLowerCase();
    const dryRun =
      mode === 'dry-run' ||
      process.env.DRY_RUN === 'true' ||
      process.env.DRY_RUN === '1';
    const optional =
      opts?.optional === true ||
      dryRun ||
      process.env.PAYSTACK_OPTIONAL === '1' ||
      process.env.PAYSTACK_OPTIONAL === 'true' ||
      process.env.PLATFORM_MODE === 'control-plane' ||
      mode !== 'live';
    if (!this.secretKey && !optional) {
      throw new Error('PAYSTACK_SECRET_KEY is required');
    }
    this.headers = {
      Authorization: this.secretKey ? `Bearer ${this.secretKey}` : '',
      'Content-Type': 'application/json',
    };
  }

  isConfigured(): boolean {
    return this.secretKey.length > 0;
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    if (!this.secretKey) {
      logger.warn(
        { component: 'PaystackClient', path },
        'Paystack is not configured (PAYSTACK_SECRET_KEY missing) — payments disabled'
      );
      throw new OperationalError('Paystack not configured', 'PAYSTACK_NOT_CONFIGURED');
    }
    const res = await fetch(`${PAYSTACK_BASE}${path}`, {
      method,
      headers: this.headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const json = (await res.json().catch(() => ({}))) as {
      status?: boolean;
      message?: string;
      data?: T;
    };
    if (!res.ok || json.status === false) {
      throw new OperationalError(
        `Paystack ${path}: ${json?.message ?? 'request failed'}`,
        'PAYSTACK_REJECTED'
      );
    }
    return json.data as T;
  }

  async createCustomer(params: {
    email: string;
    firstName: string;
    lastName: string;
    phone?: string;
  }): Promise<PaystackCustomer> {
    return this.request<PaystackCustomer>('POST', '/customer', {
      email: params.email,
      first_name: params.firstName,
      last_name: params.lastName,
      phone: params.phone,
    });
  }

  async createDedicatedVirtualAccount(params: {
    customerCode: string;
    firstName: string;
    lastName: string;
    phone?: string;
    preferredBank?: string;
  }): Promise<PaystackDva> {
    return this.request<PaystackDva>('POST', '/dedicated_account', {
      customer: params.customerCode,
      first_name: params.firstName,
      last_name: params.lastName,
      phone: params.phone,
      preferred_bank: params.preferredBank ?? process.env.PAYSTACK_PREFERRED_BANK ?? 'wema-bank',
    });
  }

  verifyWebhookSignature(rawBody: string | Buffer, signatureHeader: string): boolean {
    const secret =
      process.env.PAYSTACK_WEBHOOK_SECRET ||
      this.secretKey;
    if (!secret) return false;
    const body = typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8');
    const hash = createHmac('sha512', secret).update(body).digest('hex');
    return hash === signatureHeader;
  }
}

export type PaystackDVA = PaystackDva;
export interface PaystackTransaction {
  id?: number;
  reference?: string;
  amount?: number;
  status?: string;
}
