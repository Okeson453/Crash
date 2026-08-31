/**
 * Cross-process mini-game event fanout via Redis.
 * mini-app-game publishes; control-plane subscribes and can rebroadcast to WS.
 */

import { getLogger } from '../observability/logger.js';
import { getRedisClient } from '../persistence/redis-client.js';

const CHANNEL = process.env.MINI_GAME_REDIS_CHANNEL ?? 'miniapp:game';
const LEADER_KEY = process.env.MINI_GAME_LEADER_KEY ?? 'miniapp:game-leader';
const logger = getLogger();

export async function publishMiniGameEvent(
  name: string,
  payload: Record<string, unknown>
): Promise<void> {
  try {
    const redis = getRedisClient();
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
    const sub = redis.duplicate();
    sub.on('error', (err) => {
      logger.warn({ component: 'GameEventRelay', error: err.message }, 'Redis sub client error');
    });
    await sub.subscribe(CHANNEL);
    sub.on('message', (channel, message) => {
      if (channel !== CHANNEL) return;
      try {
        const parsed = JSON.parse(message) as {
          name: string;
          payload: Record<string, unknown>;
        };
        onEvent?.(parsed.name, parsed.payload);
        // Best-effort WS fanout if helpers exist
        void import('../api/websocket/server.js')
          .then((ws) => {
            ws.broadcastGameEvent?.(parsed.name, parsed.payload);
          })
          .catch(() => undefined);
      } catch { /* */ }
    });
    logger.info({ component: 'GameEventRelay', channel: CHANNEL }, 'Subscribed to mini-game events');
  } catch (err) {
    logger.warn(
      { component: 'GameEventRelay', error: String(err) },
      'Could not subscribe to mini-game channel'
    );
  }
}

/** Single leader for mini-game loop */
export async function acquireMiniGameLeaderLock(ttlSec = 30): Promise<boolean> {
  try {
    const redis = getRedisClient();
    const token = `${process.pid}-${Date.now()}`;
    const result = await redis.set(LEADER_KEY, token, 'EX', ttlSec, 'NX');
    if (result !== 'OK') return false;
    // renew
    const timer = setInterval(() => {
      void redis.set(LEADER_KEY, token, 'EX', ttlSec).catch(() => undefined);
    }, Math.floor(ttlSec * 500));
    if (typeof timer.unref === 'function') timer.unref();
    return true;
  } catch {
    // No Redis — allow single local instance
    logger.warn(
      { component: 'GameEventRelay' },
      'No Redis for leader lock — assuming single mini-game instance'
    );
    return true;
  }
}
