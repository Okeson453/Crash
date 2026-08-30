/**
 * Control-plane runtime: API + WebSocket + metrics.
 * No Playwright, no worker fleet, no MiniGameService timer.
 */

import http from 'http';
import { register } from 'prom-client';
import { bootConfig, bootPersistence, roleLabel } from './shared-boot.js';
import { composeApplication, setGlobalComposition } from '../app/composition.js';
import { createApiServer } from '../api/server.js';
import { createWebSocketServer, closeWebSocketServer } from '../api/websocket/server.js';
import { getLogger } from '../observability/logger.js';
import { startMiniGameEventRelay } from '../mini-app/game-event-relay.js';

export async function main(): Promise<void> {
  const config = bootConfig();
  process.env.PROCESS_ROLE = 'control-plane';
  bootPersistence(config, { requireRedis: process.env.NODE_ENV === 'production' });

  const { ctx, start, stop } = composeApplication(config);
  setGlobalComposition({ ctx, start, stop });

  const logger = getLogger();
  const role = roleLabel(config);

  const metricsServer = http.createServer(async (req, res) => {
    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          status: 'ok',
          role: 'control-plane',
          version: '1.1.0',
          miniGame: 'external',
        })
      );
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

  await start(); // composition gates skip automation when PROCESS_ROLE=control-plane

  const metricsPort = Number(process.env.METRICS_PORT ?? 9090);
  metricsServer.listen(metricsPort, () => {
    logger.info({ port: metricsPort, role }, 'Metrics server listening');
  });

  const apiServer = await createApiServer();
  await apiServer.listen({ port: config.system.apiPort, host: '0.0.0.0' });
  logger.info({ port: config.system.apiPort, role }, 'API server listening');

  createWebSocketServer(apiServer.server!);
  logger.info({ role }, 'WebSocket server started');

  // Relay mini-app game events from Redis → WS clients
  try {
    await startMiniGameEventRelay();
  } catch (err) {
    logger.warn({ error: String(err) }, 'Mini-game Redis relay not started');
  }

  const shutdown = async () => {
    try {
      await closeWebSocketServer(10_000);
    } catch { /* */ }

    logger.info({ role }, 'Shutting down control-plane');
    try {
      await stop();
    } catch { /* */ }
    try {
      await apiServer.close();
    } catch { /* */ }
    metricsServer.close();
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown());
  process.on('SIGINT', () => void shutdown());
}
