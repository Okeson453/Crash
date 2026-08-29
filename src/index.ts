import http from 'http';
import { register } from 'prom-client';
import { loadAndValidateConfig } from './config/loader.js';
import { composeApplication, setGlobalComposition } from './app/composition.js';
import { createApiServer } from './api/server.js';
import { createWebSocketServer } from './api/websocket/server.js';
import { getLogger } from './observability/logger.js';
import { createPool } from './persistence/client.js';
import { createRedisClient } from './persistence/redis-client.js';
import { miniGameService } from './mini-app/game-service.js';

const config = loadAndValidateConfig();
const databaseUrl = process.env.DATABASE_URL ?? process.env.APP_PERSISTENCE__CONNECTION_STRING;
if (!databaseUrl) {
  throw new Error('DATABASE_URL is required to start the control plane');
}
createPool({ connectionString: databaseUrl, poolSize: 10 });
const redisUrl = process.env.REDIS_URL;
if (redisUrl) {
  createRedisClient({ url: redisUrl });
}

const { ctx, start, stop } = composeApplication(config);
setGlobalComposition({ ctx, start, stop });

const metricsServer = http.createServer(async (req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', version: '1.1.0' }));
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

async function main() {
  await start();

  const metricsPort = Number(process.env.METRICS_PORT ?? 9090);
  metricsServer.listen(metricsPort, () => {
    getLogger().info({ port: metricsPort }, 'Metrics server listening');
  });

  const apiServer = await createApiServer();
  const apiPort = config.system.apiPort;

  await apiServer.listen({ port: apiPort, host: '0.0.0.0' });
  getLogger().info({ port: apiPort }, 'API server listening');

  createWebSocketServer(apiServer.server!);
  getLogger().info({}, 'WebSocket server started');

  // Auto-start Mini App crash engine so betting is available without a manual admin call.
  // Operators can still pause/stop via admin routes.
  if (process.env.MINI_APP_AUTO_START !== 'false') {
    miniGameService.start();
    getLogger().info({ component: 'MiniGameService' }, 'Mini App game engine started');
  }

  const shutdown = async () => {
    getLogger().info({}, 'Shutting down');
    await stop();
    metricsServer.close();
    await apiServer.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  getLogger().error({ error: err instanceof Error ? err.message : String(err) }, 'Fatal error during startup');
  process.exit(1);
});
