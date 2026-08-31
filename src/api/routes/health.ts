import type { FastifyInstance } from 'fastify';
import { getPool } from '@/persistence/client';
import { getRedisClient } from '@/persistence/redis-client';
import { getReadiness, isReadyForLive } from '@/observability/readiness';
import { resolveProcessRole } from '@/config/loader';

export async function healthRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * Liveness probe for Railway/K8s — always 200 once the HTTP server is up.
   * Do not gate on DB/Redis/browser so cold-start Chromium never causes a kill loop.
   * Use /ready for readiness of dependencies and prediction stack.
   */
  fastify.get('/health', async (_request, reply) => {
    reply.status(200).send({
      status: 'ok',
      version: process.env.APP_VERSION ?? 'dev',
      role: process.env.PROCESS_ROLE ?? 'all',
      ts: new Date().toISOString(),
    });
  });

  /** Liveness — process is up */
  fastify.get('/', async (_request, reply) => {
    const checks: Array<{
      name: string;
      status: 'ok' | 'degraded' | 'failing';
      responseTimeMs: number;
      message: string;
      lastChecked: string;
    }> = [];
    const check = async (name: string, fn: () => Promise<void>) => {
      const started = Date.now();
      try {
        await fn();
        checks.push({
          name,
          status: 'ok',
          responseTimeMs: Date.now() - started,
          message: 'Available',
          lastChecked: new Date().toISOString(),
        });
      } catch (error) {
        checks.push({
          name,
          status: 'failing',
          responseTimeMs: Date.now() - started,
          message: error instanceof Error ? error.message : 'Unavailable',
          lastChecked: new Date().toISOString(),
        });
      }
    };
    await check('api', async () => undefined);
    await check('database', async () => {
      await getPool().query('SELECT 1');
    });
    try {
      await check('redis', async () => {
        await getRedisClient().ping();
      });
    } catch {
      checks.push({
        name: 'redis',
        status: 'degraded',
        responseTimeMs: 0,
        message: 'Redis not initialized',
        lastChecked: new Date().toISOString(),
      });
    }
    const anyFailing = checks.some((item) => item.status === 'failing');
    const status = anyFailing ? 'unhealthy' : 'healthy';
    reply.status(anyFailing ? 503 : 200).send({
      data: {
        status,
        role: resolveProcessRole(),
        checks,
        readiness: getReadiness(),
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.1.0',
      },
    });
  });

  /**
   * Readiness — 503 when this role needs warm prediction and is cold.
   * control-plane: DB/redis only (prediction lives on automation).
   * automation-worker / all: require prediction warm for live.
   */
  fastify.get('/ready', async (_request, reply) => {
    const role = resolveProcessRole();
    const readiness = getReadiness();
    const needsPrediction = role === 'automation-worker' || role === 'all';
    const mode = process.env.SYSTEM_MODE || process.env.MODE || 'dry-run';
    const live = mode === 'live';

    const dbOk = await (async () => {
      try {
        await getPool().query('SELECT 1');
        return true;
      } catch {
        return false;
      }
    })();

    if (!dbOk) {
      reply.status(503).send({
        data: {
          ready: false,
          reason: 'database_unavailable',
          readiness,
          role,
        },
      });
      return;
    }

    if (process.env.NODE_ENV === 'production') {
      try {
        await getRedisClient().ping();
      } catch {
        reply.status(503).send({ status: 'not_ready', reason: 'redis_unavailable' });
        return;
      }
    }
    if (needsPrediction && live && !isReadyForLive()) {
      reply.status(503).send({
        data: {
          ready: false,
          reason: 'prediction_not_ready',
          readiness,
          role,
        },
      });
      return;
    }

    reply.status(200).send({
      data: {
        ready: true,
        readiness,
        role,
      },
    });
  });
}
