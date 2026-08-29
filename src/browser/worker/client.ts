/**
 * HTTP client for the remote Browser Worker (runs in a BC.Game-allowed region).
 */

import { getLogger } from '../../observability/logger';
import type { BrowserWorkerRequest, BrowserWorkerResponse } from './types';

const logger = () => getLogger().child({ component: 'BrowserWorkerClient' });

export interface BrowserWorkerClientOptions {
  baseUrl: string;
  authToken?: string;
  timeoutMs?: number;
}

export class BrowserWorkerClient {
  private readonly baseUrl: string;
  private readonly authToken?: string;
  private readonly timeoutMs: number;

  constructor(options: BrowserWorkerClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.authToken = options.authToken;
    this.timeoutMs = options.timeoutMs ?? 90_000;
  }

  async invoke(req: BrowserWorkerRequest): Promise<BrowserWorkerResponse> {
    const url = `${this.baseUrl}/v1/browser`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      };
      if (this.authToken) {
        headers.Authorization = `Bearer ${this.authToken}`;
      }

      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(req),
        signal: controller.signal,
      });

      const body = (await res.json().catch(() => ({}))) as BrowserWorkerResponse;
      if (!res.ok && !body.code) {
        return {
          ok: false,
          code: res.status === 401 ? 'UNAUTHORIZED' : 'INTERNAL_ERROR',
          message: `Worker HTTP ${res.status}`,
          ts: new Date().toISOString(),
        };
      }
      return {
        ...body,
        ts: body.ts ?? new Date().toISOString(),
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger().error({ error: message, url }, 'Browser worker invoke failed');
      return {
        ok: false,
        code: 'INTERNAL_ERROR',
        message: `Browser worker unreachable: ${message}`,
        ts: new Date().toISOString(),
      };
    } finally {
      clearTimeout(timer);
    }
  }

  async health(): Promise<BrowserWorkerResponse> {
    return this.invoke({ command: 'health' });
  }

  async login(email: string, password: string, tenantId?: string): Promise<BrowserWorkerResponse> {
    return this.invoke({
      command: 'login',
      email,
      password,
      tenantId,
      requestId: `login-${Date.now()}`,
    });
  }

  async classifyLoginPage(tenantId?: string): Promise<BrowserWorkerResponse> {
    return this.invoke({ command: 'classify_login_page', tenantId });
  }

  async startSession(tenantId?: string): Promise<BrowserWorkerResponse> {
    return this.invoke({ command: 'start_session', tenantId });
  }

  async stopSession(tenantId?: string): Promise<BrowserWorkerResponse> {
    return this.invoke({ command: 'stop_session', tenantId });
  }

  async status(tenantId?: string): Promise<BrowserWorkerResponse> {
    return this.invoke({ command: 'status', tenantId });
  }
}

/** True when control plane should delegate Playwright to a remote worker. */
export function isRemoteBrowserWorkerConfigured(): boolean {
  const url = process.env.BROWSER_WORKER_URL?.trim();
  return !!url && url.length > 8;
}

export function createBrowserWorkerClientFromEnv(): BrowserWorkerClient | null {
  if (!isRemoteBrowserWorkerConfigured()) return null;
  return new BrowserWorkerClient({
    baseUrl: process.env.BROWSER_WORKER_URL!,
    authToken: process.env.BROWSER_WORKER_TOKEN,
    timeoutMs: Number(process.env.BROWSER_WORKER_TIMEOUT_MS ?? 90_000),
  });
}
