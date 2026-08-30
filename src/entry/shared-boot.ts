/**
 * Shared boot helpers for role-specific entrypoints.
 */

import { loadAndValidateConfig, resolveProcessRole } from '../config/loader.js';
import type { AppConfig } from '../config/schema.js';
import { createPool } from '../persistence/client.js';
import { createRedisClient } from '../persistence/redis-client.js';
import { getLogger } from '../observability/logger.js';

export function bootConfig(): AppConfig {
  return loadAndValidateConfig();
}

export function bootPersistence(config: AppConfig, opts?: { requireRedis?: boolean }): void {
  const databaseUrl =
    process.env.DATABASE_URL ?? process.env.APP_PERSISTENCE__CONNECTION_STRING;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }
  createPool({ connectionString: databaseUrl, poolSize: Number(process.env.DB_POOL_SIZE ?? 10) });

  const redisUrl = process.env.REDIS_URL;
  const role = resolveProcessRole(config);
  const requireRedis =
    opts?.requireRedis ??
    (process.env.NODE_ENV === 'production' && role === 'control-plane');

  if (redisUrl) {
    createRedisClient({ url: redisUrl });
  } else if (requireRedis) {
    throw new Error('REDIS_URL is required for this process role in production');
  } else {
    getLogger().warn({ component: 'Boot', role }, 'Starting without Redis');
  }
}

export function roleLabel(config: AppConfig): string {
  return resolveProcessRole(config);
}
