/**
 * Proxy & network layer — sticky residential/ISP proxy resolution.
 * Supports single server or Webshare-style pool (host:port:user:pass).
 */

import { ProxyConfig } from '../config/schema';
import { getLogger } from '../observability/logger';
import { metricCollector } from '../observability/metrics/collectors';

export interface ResolvedProxy {
  server: string;
  username?: string;
  password?: string;
  stickySessionId?: string;
  /** Original pool entry index when resolved from pool */
  poolIndex?: number;
}

/** Parse one endpoint: host:port:user:pass | host:port | http(s)://user:pass@host:port | http://host:port */
export function parseProxyEndpoint(raw: string): ResolvedProxy | null {
  const s = raw.trim();
  if (!s) return null;

  // URL form: http://user:pass@host:port or http://host:port
  if (/^https?:\/\//i.test(s)) {
    try {
      const u = new URL(s);
      const server = `${u.protocol}//${u.hostname}${u.port ? `:${u.port}` : ''}`;
      return {
        server,
        username: u.username ? decodeURIComponent(u.username) : undefined,
        password: u.password ? decodeURIComponent(u.password) : undefined,
      };
    } catch {
      return null;
    }
  }

  // Webshare / common: host:port:username:password (password may contain ':')
  const parts = s.split(':');
  if (parts.length >= 4) {
    const host = parts[0];
    const port = parts[1];
    const username = parts[2];
    const password = parts.slice(3).join(':');
    if (host && port && /^\d+$/.test(port)) {
      return {
        server: `http://${host}:${port}`,
        username,
        password,
      };
    }
  }

  // host:port only
  if (parts.length === 2 && /^\d+$/.test(parts[1])) {
    return { server: `http://${parts[0]}:${parts[1]}` };
  }

  return null;
}

/** Normalize pool from array or env string (JSON / newlines / commas). */
export function normalizeProxyPool(pool: unknown): string[] {
  if (Array.isArray(pool)) {
    return pool.map(String).map((x) => x.trim()).filter(Boolean);
  }
  if (typeof pool === 'string') {
    const trimmed = pool.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.map(String).map((x) => x.trim()).filter(Boolean);
      }
    } catch {
      /* not JSON */
    }
    return trimmed
      .split(/[\n,;]+/)
      .map((x) => x.trim())
      .filter(Boolean);
  }
  return [];
}

export class ProxyManager {
  private readonly logger = getLogger();
  private current: ResolvedProxy | null = null;
  private sessionId: string;
  private poolIndex = 0;
  private readonly pool: ResolvedProxy[];

  constructor(private readonly config: ProxyConfig) {
    this.sessionId = `sticky-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    this.pool = this.buildPool();
  }

  private buildPool(): ResolvedProxy[] {
    const entries = normalizeProxyPool(this.config.pool);
    const out: ResolvedProxy[] = [];
    for (const e of entries) {
      const parsed = parseProxyEndpoint(e);
      if (parsed) out.push(parsed);
    }

    // Primary server as first entry when present and not already in pool
    if (this.config.server) {
      const primary =
        parseProxyEndpoint(this.config.server) ??
        ({
          server: this.config.server.startsWith('http')
            ? this.config.server
            : `http://${this.config.server}`,
          username: this.config.username,
          password: this.config.password,
        } satisfies ResolvedProxy);
      // Prefer config username/password on primary
      if (this.config.username) primary.username = this.config.username;
      if (this.config.password) primary.password = this.config.password;
      const key = `${primary.server}|${primary.username ?? ''}`;
      if (!out.some((p) => `${p.server}|${p.username ?? ''}` === key)) {
        out.unshift(primary);
      }
    }

    return out;
  }

  async resolve(): Promise<ResolvedProxy | null> {
    if (!this.config.enabled) {
      return null;
    }

    if (this.config.sticky && this.current) {
      return this.current;
    }

    if (this.pool.length === 0) {
      this.logger.warn({ component: 'ProxyManager' }, 'Proxy enabled but no server/pool entries');
      return null;
    }

    const idx = this.poolIndex % this.pool.length;
    const base = this.pool[idx];
    const resolved: ResolvedProxy = {
      server: base.server,
      username: base.username ?? this.config.username,
      password: base.password ?? this.config.password,
      stickySessionId: this.config.sticky ? this.sessionId : undefined,
      poolIndex: idx,
    };

    // Provider-specific sticky username suffix (Bright Data style); skip for webshare/generic
    if (
      this.config.sticky &&
      this.config.provider !== 'generic' &&
      this.config.provider !== 'webshare' &&
      resolved.username &&
      !resolved.username.includes('-session-')
    ) {
      resolved.username = `${resolved.username}-session-${this.sessionId}`;
    }

    this.current = resolved;
    this.logger.info(
      {
        component: 'ProxyManager',
        provider: this.config.provider,
        sticky: this.config.sticky,
        server: resolved.server,
        poolSize: this.pool.length,
        poolIndex: idx,
        hasAuth: Boolean(resolved.username),
      },
      'Proxy resolved'
    );
    (metricCollector as any).recordProxyResolved?.(this.config.provider);

    return resolved;
  }

  getCurrent(): ResolvedProxy | null {
    return this.current;
  }

  getPoolSize(): number {
    return this.pool.length;
  }

  async rotate(): Promise<ResolvedProxy | null> {
    if (this.config.rotationMode === 'never') {
      this.logger.warn({ component: 'ProxyManager' }, 'Rotation requested but mode=never');
      return this.current;
    }
    this.current = null;
    this.sessionId = `sticky-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    if (this.config.rotationMode === 'round-robin' || this.pool.length > 1) {
      this.poolIndex = (this.poolIndex + 1) % Math.max(this.pool.length, 1);
    }
    return this.resolve();
  }

  /** Playwright-compatible proxy option */
  toPlaywrightProxy(): { server: string; username?: string; password?: string } | undefined {
    if (!this.current) return undefined;
    return {
      server: this.current.server,
      username: this.current.username,
      password: this.current.password,
    };
  }
}
