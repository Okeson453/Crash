/**
 * Cross-process mini-game event fanout via Redis.
 * mini-app-game publishes; control-plane subscribes and can rebroadcast to WS.
 */

import type Redis from 'ioredis';
import { getLogger } from '../observability/logger.js';
import { getRedisClient } from '../persistence/redis-client.js';

const CHANNEL = process.env.MINI_GAME_REDIS_CHANNEL ?? 'miniapp:game';
const LEADER_KEY = process.env.MINI_GAME_LEADER_KEY ?? 'miniapp:game-leader';
const logger = getLogger();

async function ensureConnected(client: Redis): Promise<void> {
  if (client.status === 'ready') return;
  if (client.status === 'connecting' || client.status === 'connect') {
    await new Promise<void>((resolve, reject) => {
      const onReady = () => {
        cleanup();
        resolve();
      };
      const onError = (err: Error) => {
        cleanup();
        reject(err);
      };
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error('Redis ready timeout'));
      }, 8000);
      const cleanup = () => {
        clearTimeout(timer);
        client.off('ready', onReady);
        client.off('error', onError);
      };
      client.once('ready', onReady);
      client.once('error', onError);
    });
    return;
  }
  await client.connect();
}

export async function publishMiniGameEvent(
  name: string,
  payload: Record<string, unknown>
): Promise<void> {
  try {
    const redis = getRedisClient();
    await ensureConnected(redis);
    await redis.publish(CHANNEL, JSON.stringify({ name, payload, ts: new Date().toISOString() }));
  } catch (err) {
    logger.debug(
      { component: 'GameEventRelay', error: String(err) },
      'publish skipped (no redis)'
    );
  }
}

export async function startMiniGameEventRelay(
  onEvent?: (name: string, payload: Record<string, unknown>) => void
): Promise<void> {
  try {
    const redis = getRedisClient();
    await ensureConnected(redis);

    const sub = redis.duplicate();
    sub.on('error', (err) => {
      logger.warn({ component: 'GameEventRelay', error: err.message }, 'Redis sub client error');
    });
    await ensureConnected(sub);
    await sub.subscribe(CHANNEL);
    sub.on('message', (channel, message) => {
      if (channel !== CHANNEL) return;
      try {
        const parsed = JSON.parse(message) as {
          name: string;
          payload: Record<string, unknown>;
        };
        onEvent?.(parsed.name, parsed.payload);
        void import('../api/websocket/server.js')
          .then((ws) => {
            ws.broadcastGameEvent?.(parsed.name, parsed.payload);
          })
          .catch(() => undefined);
      } catch {
        /* ignore bad payloads */
      }
    });
    logger.info({ component: 'GameEventRelay', channel: CHANNEL }, 'Subscribed to mini-game events');
  } catch (err) {
    logger.warn(
      { component: 'GameEventRelay', error: err instanceof Error ? err.message : String(err) },
      'Could not subscribe to mini-game channel'
    );
  }
}

/** Single leader for mini-game loop */
export async function acquireMiniGameLeaderLock(ttlSec = 30): Promise<boolean> {
  try {
    const redis = getRedisClient();
    await ensureConnected(redis);
    const token = `${process.pid}-${Date.now()}`;
    const result = await redis.set(LEADER_KEY, token, 'EX', ttlSec, 'NX');
    if (result !== 'OK') return false;
    const timer = setInterval(() => {
      void redis.set(LEADER_KEY, token, 'EX', ttlSec).catch(() => undefined);
    }, Math.floor(ttlSec * 500));
    if (typeof timer.unref === 'function') timer.unref();
    return true;
  } catch {
    logger.warn(
      { component: 'GameEventRelay' },
      'No Redis for leader lock — assuming single mini-game instance'
    );
    return true;
  }
}
