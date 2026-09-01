/**
 * Local-dev monolith: API + automation + mini-game in one process (PROCESS_ROLE=all).
 */

import http from 'http';
import { register } from 'prom-client';
import { bootConfig, bootPersistence, roleLabel } from './shared-boot.js';
import { composeApplication, setGlobalComposition } from '../app/composition.js';
import { createApiServer } from '../api/server.js';
import { createWebSocketServer, closeWebSocketServer } from '../api/websocket/server.js';
import { getLogger } from '../observability/logger.js';
import { miniGameService } from '../mini-app/game-service.js';

export async function main(): Promise<void> {
  const config = bootConfig();
  process.env.PROCESS_ROLE = process.env.PROCESS_ROLE || 'all';
  bootPersistence(config, { requireRedis: false });

  const { ctx, start, stop } = composeApplication(config);
  setGlobalComposition({ ctx, start, stop });

  const logger = getLogger();
  const role = roleLabel(config);

  const metricsServer = http.createServer(async (req, res) => {
    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', role: 'all', version: '1.1.0' }));
      return;
    }
    if (req.url === '/metrics') {
      res.writeHead(200, { 'Content-Type': register.contentType });
      res.end(await register.metrics());
      return;
    }
    res.writeHead(404);
    res.end('Not found');
  });

  await start();

  const metricsPort = Number(process.env.METRICS_PORT ?? 9090);
  metricsServer.listen(metricsPort, () => {
    logger.info({ port: metricsPort, role }, 'Metrics server listening');
  });

  const apiServer = await createApiServer();
  const publicPort = Number(process.env.PORT ?? process.env.API_PORT ?? config.system.apiPort);
  await apiServer.listen({ port: publicPort, host: '0.0.0.0' });
  logger.info({ port: publicPort, role, railwayPort: process.env.PORT ?? null }, 'API server listening');
  createWebSocketServer(apiServer.server!);

  if (process.env.MINI_APP_AUTO_START !== 'false') {
    miniGameService.start();
    logger.info({ component: 'MiniGameService' }, 'Mini App game engine started (monolith)');
  }

  const shutdown = async () => {
    try {
      await closeWebSocketServer(10_000);
    } catch {
      /* */
    }

    logger.info({ role }, 'Shutting down monolith');
    try {
      miniGameService.stop();
    } catch {
      /* */
    }
    try {
      await stop();
    } catch {
      /* */
    }
    try {
      await apiServer.close();
    } catch {
      /* */
    }
    metricsServer.close();
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown());
  process.on('SIGINT', () => void shutdown());
}
