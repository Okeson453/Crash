import http from 'http';
import { register } from 'prom-client';
import { getConfig } from './config/schema.js';
import { composeApplication, setGlobalComposition } from './app/composition.js';
import { createApiServer } from './api/server.js';
import { createWebSocketServer } from './api/websocket/server.js';
import { getLogger } from './observability/logger.js';

const config = getConfig();
const { ctx, start, stop } = composeApplication(config);

// Set global composition for API access
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

  // Start metrics server
  metricsServer.listen(config.httpPort, () => {
    getLogger().info({ port: config.httpPort }, 'Metrics server listening');
  });

  // Start API server
  const apiServer = await createApiServer();
  const apiPort = config.system.apiPort;

  await apiServer.listen({ port: apiPort, host: '0.0.0.0' });
  getLogger().info({ port: apiPort }, 'API server listening');

  // Start WebSocket server on same port as API
  createWebSocketServer(apiServer.server!);
  getLogger().info({}, 'WebSocket server started');

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
