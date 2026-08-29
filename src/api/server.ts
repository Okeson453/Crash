/**
 * Fastify HTTP API server
 * Registers all routes, middleware, CORS, rate limiting
 */

import Fastify from 'fastify';
import cors from '@fastify/cors';
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

export async function createApiServer(): Promise<FastifyInstance> {
  const fastify = Fastify({
    logger: true,
    genReqId: () => `req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  });

  // Error handler
  fastify.setErrorHandler(errorHandler);

  // CORS
  await fastify.register(cors, {
    origin: process.env.CORS_ORIGIN || true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID', 'X-Session-Id', 'X-Idempotency-Key'],
  });

  // Rate limiting
  await fastify.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
    keyGenerator: (req) => {
      return req.auth?.userId || req.ip;
    },
    errorResponseBuilder: (_req, context) => ({
      error: {
        code: 'RATE_LIMIT',
        message: `Rate limit exceeded. Retry after ${context.after}`,
      },
    }),
  });

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
  await fastify.register(analyticsRoutes, { prefix: '/api/v1/analytics' });
  await fastify.register(plansRoutes, { prefix: '/api/v1/plans' });

  return fastify;
}
