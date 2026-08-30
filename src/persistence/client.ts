import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { getLogger } from '../observability/logger';
import { withRetry } from '../utils/retry';

export interface DatabaseConfig {
  connectionString: string;
  poolSize?: number;
}

let pool: Pool | null = null;

export function createPool(config: DatabaseConfig): Pool {
  if (pool) {
    return pool;
  }

  // Explicit SSL mode — avoid silent pg SSL downgrade warnings.
  // Prefer verify-full in production when CA is configured.
  const sslMode = (process.env.DATABASE_SSL_MODE ?? process.env.PGSSLMODE ?? '').toLowerCase();
  const ssl =
    sslMode === 'disable' || sslMode === 'false'
      ? false
      : sslMode === 'require' || sslMode === 'no-verify'
        ? { rejectUnauthorized: false }
        : sslMode === 'verify-full' || sslMode === 'verify-ca' || process.env.NODE_ENV === 'production'
          ? { rejectUnauthorized: true }
          : undefined;

  pool = new Pool({
    connectionString: config.connectionString,
    max: config.poolSize ?? 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    ...(ssl !== undefined ? { ssl } : {}),
  });

  pool.on('error', (err) => {
    getLogger().error({ component: 'Database' }, `Unexpected database pool error: ${err.message}`);
  });

  // Do NOT run concurrent client.query() in the connect handler — that races the
  // consumer's first query. Tenant GUCs are applied in withTenantContext / query paths.
  pool.on('connect', (client) => {
    const timeoutMs = Number(process.env.PG_STATEMENT_TIMEOUT_MS ?? 15000);
    void client.query(`SET statement_timeout = ${timeoutMs}`).catch(() => undefined);
    getLogger().debug({ component: 'Database', statementTimeoutMs: timeoutMs }, 'New database connection established');
  });

  return pool;
}

export function getPool(): Pool {
  if (!pool) {
    throw new Error('Database pool not initialized. Call createPool() first.');
  }
  return pool;
}

/** Snapshot for Prometheus / backpressure */
export function getPoolStats(): {
  total: number;
  idle: number;
  waiting: number;
} {
  const p = getPool() as Pool & {
    totalCount?: number;
    idleCount?: number;
    waitingCount?: number;
  };
  return {
    total: p.totalCount ?? 0,
    idle: p.idleCount ?? 0,
    waiting: p.waitingCount ?? 0,
  };
}

export function isPoolSaturated(threshold = 5): boolean {
  try {
    return getPoolStats().waiting >= threshold;
  } catch {
    return false;
  }
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  sql: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  return withRetry(
    async () => {
      const result = await getPool().query<T>(sql, params);
      return result;
    },
    {
      maxRetries: 3,
      baseDelayMs: 500,
      maxDelayMs: 5000,
      retryableErrors: ['Connection terminated unexpectedly'],
    }
  );
}

export async function withClient<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    getLogger().info({ component: 'Database' }, 'Database pool closed');
  }
}

export async function healthCheck(): Promise<boolean> {
  try {
    const result = await query<{ health: number }>('SELECT 1 as health');
    return result.rows[0]?.health === 1;
  } catch {
    return false;
  }
}
