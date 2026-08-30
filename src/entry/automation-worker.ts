/**
 * Automation-worker runtime: composition, workers, supervisor, betting.
 * No public player API. Optional private metrics port only.
 */

import http from 'http';
import { register } from 'prom-client';
import { bootConfig, bootPersistence, roleLabel } from './shared-boot.js';
import { composeApplication, setGlobalComposition } from '../app/composition.js';
import { getLogger } from '../observability/logger.js';

export async function main(): Promise<void> {
  const config = bootConfig();
  process.env.PROCESS_ROLE = 'automation-worker';
  bootPersistence(config, { requireRedis: process.env.NODE_ENV === 'production' });

  const { ctx, start, stop } = composeApplication(config);
  setGlobalComposition({ ctx, start, stop });

  const logger = getLogger();
  const role = roleLabel(config);

  const metricsPort = Number(process.env.METRICS_PORT ?? 9091);
  const metricsServer = http.createServer(async (req, res) => {
    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', role: 'automation-worker', version: '1.1.0' }));
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
  metricsServer.listen(metricsPort, () => {
    logger.info({ port: metricsPort, role }, 'Automation metrics listening');
  });

  await start();
  logger.info({ role, mode: config.system.mode }, 'Automation worker started');

  const shutdown = async () => {
    logger.info({ role }, 'Shutting down automation-worker');
    try {
      await stop();
    } catch { /* */ }
    metricsServer.close();
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown());
  process.on('SIGINT', () => void shutdown());
}
