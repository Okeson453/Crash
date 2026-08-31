/**
 * Shared ioredis connection options.
 * Layerbase / managed Redis that route by TLS SNI require tls.servername
 * to match the database hostname (not an IP or proxy name).
 */
import type { RedisOptions } from 'ioredis';

export function redisOptionsFromUrl(
  redisUrl: string,
  overrides: RedisOptions = {}
): RedisOptions {
  const url = new URL(redisUrl);
  const isTls = url.protocol === 'rediss:' || url.protocol === 'https:';
  const password =
    decodeURIComponent(url.password || '') ||
    undefined;
  const username =
    url.username && url.username !== 'default'
      ? decodeURIComponent(url.username)
      : undefined;

  const base: RedisOptions = {
    host: url.hostname,
    port: parseInt(url.port || (isTls ? '6380' : '6379'), 10),
    username,
    password,
    db: parseInt((url.pathname || '/0').replace(/^\//, '') || '0', 10),
    maxRetriesPerRequest: 3,
    enableOfflineQueue: false,
    ...(isTls
      ? {
          tls: {
            servername: url.hostname,
            rejectUnauthorized: process.env.REDIS_TLS_INSECURE === 'true' ? false : true,
          },
        }
      : {}),
    ...overrides,
  };

  // Prefer structured options over a raw URL so SNI is always set for rediss://
  return base;
}

export function attachRedisErrorHandler(
  client: { on: (event: string, fn: (err: Error) => void) => void },
  label: string
): void {
  client.on('error', (err) => {
    // Avoid process crash from unhandled 'error' events
    try {
      // lazy import to avoid circular deps at module load
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { getLogger } = require('../observability/logger') as {
        getLogger: () => { error: (o: object, m: string) => void };
      };
      getLogger().error({ component: label, error: err.message }, 'Redis client error');
    } catch {
      console.error(`[${label}] Redis error:`, err.message);
    }
  });
}
