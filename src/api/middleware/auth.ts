/**
 * Authentication middleware for Fastify
 * Validates JWT tokens and extracts user/tenant context
 */

import type { FastifyRequest, FastifyReply } from 'fastify';
import { jwtVerify } from 'jose';
import { createHash } from 'node:crypto';
import { getRedisClient } from '@/persistence/redis-client';

export interface AuthContext {
  userId: string;
  telegramId: string;
  role: 'player' | 'operator' | 'admin';
  tenantId: string | null;
  planId: string | null;
}

declare module 'fastify' {
  interface FastifyRequest {
    auth: AuthContext;
  }
}

const JWT_SECRET = process.env.JWT_SECRET || 'development-secret-change-in-production';

export async function authenticateRequest(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const authHeader = request.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    reply.status(401).send({
      error: { code: 'UNAUTHORIZED', message: 'Missing or invalid authorization header' },
    });
    return;
  }

  const token = authHeader.slice(7);

  try {
    try { if (await getRedisClient().get(`miniapp:revoked:${createHash('sha256').update(token).digest('hex')}`)) { reply.status(401).send({ error: { code: 'AUTH_TOKEN_REVOKED', message: 'Session has been revoked' } }); return; } } catch { /* Redis may be unavailable in development. */ }
    // For HS256, we use TextEncoder on the secret
    const secret = new TextEncoder().encode(JWT_SECRET);
    const { payload } = await jwtVerify(token, secret, {
      algorithms: ['HS256'],
      clockTolerance: 60,
    });

    if (!payload.sub || !payload.telegramId) {
      reply.status(401).send({
        error: { code: 'UNAUTHORIZED', message: 'Invalid token payload' },
      });
      return;
    }

    request.auth = {
      userId: payload.sub,
      telegramId: String(payload.telegramId),
      role: (payload.role as 'player' | 'operator' | 'admin') || 'player',
      tenantId: payload.tenantId ? String(payload.tenantId) : null,
      planId: payload.planId ? String(payload.planId) : null,
    };
  } catch (error) {
    request.log.warn({ err: error }, 'JWT verification failed');
    reply.status(401).send({
      error: { code: error instanceof Error && error.name === 'JWTExpired' ? 'AUTH_TOKEN_EXPIRED' : 'UNAUTHORIZED', message: error instanceof Error && error.name === 'JWTExpired' ? 'Token expired' : 'Invalid or expired token' },
    });
  }
}

export async function optionalAuth(
  request: FastifyRequest,
  _reply: FastifyReply
): Promise<void> {
  const authHeader = request.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return;
  }

  const token = authHeader.slice(7);

  try {
    const secret = new TextEncoder().encode(JWT_SECRET);
    const { payload } = await jwtVerify(token, secret, {
      algorithms: ['HS256'],
      clockTolerance: 60,
    });

    if (payload.sub && payload.telegramId) {
      request.auth = {
        userId: payload.sub,
        telegramId: String(payload.telegramId),
        role: (payload.role as 'player' | 'operator' | 'admin') || 'player',
        tenantId: payload.tenantId ? String(payload.tenantId) : null,
        planId: payload.planId ? String(payload.planId) : null,
      };
    }
  } catch {
    // Optional auth - ignore errors
  }
}
