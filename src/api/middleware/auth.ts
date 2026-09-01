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

import { resolveJwtSecretString } from '@/config/jwt-secret';
import { elevateRole } from '@/api/auth-bootstrap';
const JWT_SECRET = resolveJwtSecretString();

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

  // 1. Verify signature/expiry FIRST — never spend a Redis round-trip on
  //    a token we haven't confirmed was issued by us.
  let payload;
  try {
    const secret = new TextEncoder().encode(JWT_SECRET);
    ({ payload } = await jwtVerify(token, secret, {
      algorithms: ['HS256'],
      clockTolerance: 60,
    }));
  } catch (error) {
    request.log.warn({ err: error }, 'JWT verification failed');
    reply.status(401).send({
      error: {
        code:
          error instanceof Error && error.name === 'JWTExpired'
            ? 'AUTH_TOKEN_EXPIRED'
            : 'UNAUTHORIZED',
        message:
          error instanceof Error && error.name === 'JWTExpired'
            ? 'Token expired'
            : 'Invalid or expired token',
      },
    });
    return;
  }

  if (!payload.sub || !payload.telegramId) {
    reply.status(401).send({
      error: { code: 'UNAUTHORIZED', message: 'Invalid token payload' },
    });
    return;
  }

  // 2. Only now check revocation — the token is cryptographically ours.
  try {
    const revoked = await getRedisClient().get(
      `miniapp:revoked:${createHash('sha256').update(token).digest('hex')}`
    );
    if (revoked) {
      reply.status(401).send({
        error: { code: 'AUTH_TOKEN_REVOKED', message: 'Session has been revoked' },
      });
      return;
    }
  } catch {
    if (process.env.NODE_ENV === 'production') {
      reply.status(503).send({
        error: { code: 'AUTH_STORE_UNAVAILABLE', message: 'Session store unavailable' },
      });
      return;
    }
  }

  const telegramId = String(payload.telegramId);
  request.auth = {
    userId: payload.sub as string,
    telegramId,
    // Env ADMIN_TELEGRAM_IDS etc. override JWT role so admins work without SQL
    role: elevateRole(String(payload.role ?? 'player'), telegramId),
    tenantId: payload.tenantId ? String(payload.tenantId) : null,
    planId: payload.planId ? String(payload.planId) : null,
  };
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
      const telegramId = String(payload.telegramId);
      request.auth = {
        userId: payload.sub as string,
        telegramId,
        role: elevateRole(String(payload.role ?? 'player'), telegramId),
        tenantId: payload.tenantId ? String(payload.tenantId) : null,
        planId: payload.planId ? String(payload.planId) : null,
      };
    }
  } catch {
    // Optional auth - ignore errors
  }
}
