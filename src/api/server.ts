/**
 * Fastify HTTP API server
 * Registers all routes, middleware, CORS, rate limiting
 */

import Fastify from 'fastify';
import cors from '@fastify/cors';
// helmet registered dynamically below
import rateLimit from '@fastify/rate-limit';
import type { FastifyInstance } from 'fastify';
import { errorHandler } from './middleware/error-handler';
import { authRoutes } from './routes/auth';
import { gameRoutes } from './routes/game';
import { roundsRoutes } from './routes/rounds';
import { betsRoutes } from './routes/bets';
import { usersRoutes } from './routes/users';
import { adminRoutes } from './routes/admin';
import { analyticsRoutes } from './routes/analytics';
import { responsibleGamblingRoutes } from './routes/responsible-gambling';
import { healthRoutes } from './routes/health';
import { plansRoutes } from './routes/plans';
import { referralsRoutes } from './routes/referrals';
import { metricsRegistry } from '../observability/metrics/registry';
import { refreshPoolMetrics } from '../persistence/pool-metrics';

export async function createApiServer(): Promise<FastifyInstance> {
  const fastify = Fastify({
    logger: true,
    genReqId: () => `req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  });

  // Error handler
  fastify.setErrorHandler(errorHandler);

  // Always apply baseline headers even if @fastify/helmet is absent
  fastify.addHook('onSend', async (_req, reply, payload) => {
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('X-Frame-Options', 'SAMEORIGIN');
    reply.header('Referrer-Policy', 'no-referrer');
    if (process.env.NODE_ENV === 'production') {
      reply.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    return payload;
  });

  // Security headers (helmet when available)
  try {
    // optional dependency may be present
    const helmetMod = await import('@fastify/helmet');
    const helmet = helmetMod.default ?? helmetMod;
    await fastify.register(helmet as never, {
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          frameAncestors: ["'self'", "https://web.telegram.org", "https://telegram.org"],
        },
      },
      hsts: process.env.NODE_ENV === 'production',
    });
  } catch (err) {
    if (process.env.NODE_ENV === 'production' && process.env.ALLOW_NO_HELMET !== 'true') {
      throw new Error(
        `@fastify/helmet required in production: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  // CORS — production requires explicit allow-list
  {
    const isProd = process.env.NODE_ENV === 'production';
    const raw = process.env.CORS_ORIGIN?.trim();
    if (isProd && (!raw || raw === 'true' || raw === '*')) {
      throw new Error('CORS_ORIGIN must be an explicit comma-separated allow-list in production');
    }
    const devDefault = ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:3000'];
    let origin: boolean | string[];
    if (!raw || raw === 'true' || raw === '*') {
      origin = isProd ? false : devDefault;
    } else {
      origin = raw.split(',').map((s) => s.trim()).filter(Boolean);
    }
    await fastify.register(cors, {
      origin,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID', 'X-Session-Id', 'X-Idempotency-Key'],
    });
  }

  // Rate limiting — Redis-backed when REDIS_URL is set
  {
    const redisUrl = process.env.REDIS_URL || process.env.RATE_LIMIT_REDIS_URL;
    const rateLimitOpts: Record<string, unknown> = {
      max: Number(process.env.RATE_LIMIT_MAX ?? 100),
      timeWindow: '1 minute',
      keyGenerator: (req: { auth?: { userId?: string }; ip: string }) =>
        req.auth?.userId || req.ip,
      errorResponseBuilder: (_req: unknown, context: { after: string }) => ({
        error: {
          code: 'RATE_LIMIT',
          message: `Rate limit exceeded. Retry after ${context.after}`,
        },
      }),
    };
    const isProd = process.env.NODE_ENV === 'production';
    if (!redisUrl && isProd && process.env.ALLOW_INMEMORY_RATE_LIMIT !== 'true') {
      throw new Error(
        'REDIS_URL (or RATE_LIMIT_REDIS_URL) required for rate limiting in production; set ALLOW_INMEMORY_RATE_LIMIT=true to override (single-instance only)'
      );
    }
    if (redisUrl) {
      try {
        const ioredis = await import('ioredis');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const RedisAny = (ioredis as any).default || ioredis;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const redis: any = new RedisAny(redisUrl, { maxRetriesPerRequest: 1, enableOfflineQueue: false });
        rateLimitOpts.redis = redis;
      } catch (err) {
        if (isProd && process.env.ALLOW_INMEMORY_RATE_LIMIT !== 'true') {
          throw new Error(
            `Rate-limit Redis unavailable: ${err instanceof Error ? err.message : String(err)}`
          );
        }
      }
    }
    await fastify.register(rateLimit, rateLimitOpts as never);
  }


  // OpenAPI (optional — skip if package missing)
  try {
    // optional dependency may be present
    const swaggerMod = await import('@fastify/swagger');
    // optional dependency may be present
    const swaggerUiMod = await import('@fastify/swagger-ui');
    const swagger = swaggerMod.default ?? swaggerMod;
    const swaggerUi = swaggerUiMod.default ?? swaggerUiMod;
    await fastify.register(swagger as never, {
      openapi: {
        info: { title: 'CrashWave API',
          description: 'Control plane API. Prediction signals are heuristic ensembles (not ML). Standard errors: { error: { code, message, details, requestId } }.', version: '1.0.0' },
        components: {
          securitySchemes: {
            bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
          },
        },
      },
    });
    await fastify.register(swaggerUi as never, { routePrefix: '/api/docs' });
  } catch {
    // optional packages not installed
  }

  // Health check (no auth required)
  await fastify.register(healthRoutes, { prefix: '/api/v1/health' });

  // Auth routes (no auth required for telegram login)
  await fastify.register(authRoutes, { prefix: '/api/v1/auth' });

  // Game routes (optional auth)
  await fastify.register(gameRoutes, { prefix: '/api/v1/game' });
  await fastify.register(roundsRoutes, { prefix: '/api/v1/rounds' });

  // Protected routes
  await fastify.register(betsRoutes, { prefix: '/api/v1/bets' });
  await fastify.register(usersRoutes, { prefix: '/api/v1/users' });
  await fastify.register(adminRoutes, { prefix: '/api/v1/admin' });
  await fastify.register(referralsRoutes, { prefix: '/api/v1/referrals' });
  await fastify.register(analyticsRoutes, { prefix: '/api/v1/analytics' });
  await fastify.register(plansRoutes, { prefix: '/api/v1/plans' });
  await fastify.register(responsibleGamblingRoutes, { prefix: '/api/v1/rg' });

  // Prometheus metrics (Phase 5.8)
  fastify.get('/metrics', async (_request, reply) => {
    refreshPoolMetrics();
    reply.header('Content-Type', metricsRegistry.contentType);
    reply.send(await metricsRegistry.metrics());
  });

  return fastify;
}
