/**
 * Mini-app-game runtime: only MiniGameService loop + health.
 * Single replica; optional Redis leader lock + event publish.
 */

import http from 'http';
import { bootConfig, bootPersistence, roleLabel } from './shared-boot.js';
import { miniGameService } from '../mini-app/game-service.js';
import { getLogger } from '../observability/logger.js';
import { publishMiniGameEvent, acquireMiniGameLeaderLock } from '../mini-app/game-event-relay.js';

export async function main(): Promise<void> {
  const config = bootConfig();
  process.env.PROCESS_ROLE = 'mini-app-game';
  bootPersistence(config, { requireRedis: false });

  const logger = getLogger();
  const role = roleLabel(config);

  const leader = await acquireMiniGameLeaderLock();
  if (!leader) {
    logger.error({ role }, 'Could not acquire miniapp:game-leader lock — exiting');
    process.exit(1);
  }

  miniGameService.subscribe((name, payload) => {
    void publishMiniGameEvent(name, payload);
  });
  miniGameService.start();
  logger.info({ role }, 'Mini App game engine started');

  const port = Number(process.env.MINI_GAME_HEALTH_PORT ?? 8092);
  const server = http.createServer((req, res) => {
    if (req.url === '/health') {
      const state = miniGameService.getState();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          status: 'ok',
          role: 'mini-app-game',
          phase: state.phase,
          roundId: state.roundId,
        })
      );
      return;
    }
    res.writeHead(404);
    res.end('Not found');
  });
  server.listen(port, () => {
    logger.info({ port, role }, 'Mini-game health listening');
  });

  const shutdown = async () => {
    logger.info({ role }, 'Shutting down mini-app-game');
    try {
      miniGameService.stop();
    } catch { /* */ }
    server.close();
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown());
  process.on('SIGINT', () => void shutdown());
}
