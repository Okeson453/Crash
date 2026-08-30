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
import { healthRoutes } from './routes/health';
import { plansRoutes } from './routes/plans';
import { referralsRoutes } from './routes/referrals';

export async function createApiServer(): Promise<FastifyInstance> {
  const fastify = Fastify({
    logger: true,
    genReqId: () => `req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  });

  // Error handler
  fastify.setErrorHandler(errorHandler);

  // Security headers
  try {
    // @ts-expect-error optional dependency
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
  } catch { /* optional */ }

  // CORS — production requires explicit allow-list
  {
    const isProd = process.env.NODE_ENV === 'production';
    const raw = process.env.CORS_ORIGIN?.trim();
    if (isProd && (!raw || raw === 'true' || raw === '*')) {
      throw new Error('CORS_ORIGIN must be an explicit comma-separated allow-list in production');
    }
    const origin =
      !raw || raw === 'true'
        ? true
        : raw === '*'
          ? true
          : raw.split(',').map((s) => s.trim()).filter(Boolean);
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
    if (redisUrl) {
      // Prefer Redis store when @fastify/rate-limit redis option is available at runtime
      try {
        const ioredis = await import('ioredis');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const RedisAny = (ioredis as any).default || ioredis;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const redis: any = new RedisAny(redisUrl, { maxRetriesPerRequest: 1, enableOfflineQueue: false });
        rateLimitOpts.redis = redis;
      } catch {
        if (process.env.NODE_ENV === 'production' && process.env.REQUIRE_REDIS === 'true') {
          throw new Error('Rate-limit Redis required but unavailable');
        }
      }
    }
    await fastify.register(rateLimit, rateLimitOpts as never);
  }


  // OpenAPI (optional — skip if package missing)
  try {
    // @ts-expect-error optional dependency
    const swaggerMod = await import('@fastify/swagger');
    // @ts-expect-error optional dependency
    const swaggerUiMod = await import('@fastify/swagger-ui');
    const swagger = swaggerMod.default ?? swaggerMod;
    const swaggerUi = swaggerUiMod.default ?? swaggerUiMod;
    await fastify.register(swagger as never, {
      openapi: {
        info: { title: 'CrashWave API', version: '1.0.0' },
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

  return fastify;
}
