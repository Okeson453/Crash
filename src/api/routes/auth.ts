/** Telegram Mini App authentication and session lifecycle. */
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { createHash, randomUUID } from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';
import { telegramAuthSchema, refreshTokenSchema } from '@/api/validators/auth';
import { authenticateRequest } from '@/api/middleware/auth';
import { getTenantManager } from '@/app/composition';
import { getPool } from '@/persistence/client';
import { getRedisClient } from '@/persistence/redis-client';
import { verifyTelegramInitData } from '@/telegram/mini-app';
import type { Tenant } from '@/platform/types';
import { resolveJwtSecretBytes, resolveRefreshSecretBytes } from '@/config/jwt-secret';

const JWT_SECRET = resolveJwtSecretBytes();
const REFRESH_SECRET = resolveRefreshSecretBytes();
const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_TTL = '7d';
const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Comma-separated Telegram user IDs allowed as platform admin/operator (Railway env). */
function parseIdSet(envKey: string): Set<string> {
  const raw = process.env[envKey] ?? '';
  return new Set(
    raw
      .split(/[,\s]+/)
      .map((s) => s.trim())
      .filter(Boolean)
  );
}

function resolveBootstrapRole(telegramId: string | number): 'admin' | 'operator' | null {
  const id = String(telegramId);
  // Accept several common env names so Railway/bot envs still promote mini-app role
  const adminIds = new Set([
    ...parseIdSet('ADMIN_TELEGRAM_IDS'),
    ...parseIdSet('ADMIN_TELEGRAM_ID'),
    ...parseIdSet('TELEGRAM_ADMIN_IDS'),
    ...parseIdSet('TELEGRAM_OPERATOR_CHAT_ID'),
  ]);
  const operatorIds = new Set([
    ...parseIdSet('OPERATOR_TELEGRAM_IDS'),
    ...parseIdSet('OPERATOR_TELEGRAM_ID'),
  ]);
  if (adminIds.has(id)) return 'admin';
  if (operatorIds.has(id)) return 'operator';
  return null;
}

const ROLE_RANK: Record<string, number> = { player: 0, operator: 1, admin: 2 };

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

async function createTokens(user: {
  id: string;
  telegramId: string;
  role: string;
  tenantId: string | null;
  planId: string | null;
}) {
  const accessToken = await new SignJWT({
    telegramId: user.telegramId,
    role: user.role,
    tenantId: user.tenantId,
    planId: user.planId,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(ACCESS_TOKEN_TTL)
    .sign(JWT_SECRET);
  const refreshToken = await new SignJWT({ type: 'refresh', userId: user.id, jti: randomUUID() })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(REFRESH_TOKEN_TTL)
    .sign(REFRESH_SECRET);
  await getPool().query(
    'INSERT INTO mini_app_refresh_tokens (user_id, token_hash, expires_at) VALUES ($1,$2,$3)',
    [user.id, hashToken(refreshToken), new Date(Date.now() + REFRESH_TTL_MS)]
  );
  return { accessToken, refreshToken, expiresAt: Date.now() + 15 * 60 * 1000 };
}

function publicUser(user: Tenant | null) {
  if (!user) return null;
  return {
    id: user.id,
    telegramId: user.telegramId.toString(),
    telegramUsername: user.telegramUsername,
    firstName: user.firstName,
    lastName: user.lastName,
    photoUrl: user.photoUrl,
    email: user.email,
    status: user.status,
    role: user.role,
    planId: user.planId,
    planName: null,
    timezone: user.timezone,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

function bearerToken(request: FastifyRequest): string | null {
  const value = request.headers.authorization;
  return value?.startsWith('Bearer ') ? value.slice(7) : null;
}

export async function authRoutes(fastify: FastifyInstance): Promise<void> {
  // Prefix is applied by server.ts: register(authRoutes, { prefix: '/api/v1/auth' })
  // Do NOT add another prefix here or routes become /api/v1/auth/api/v1/auth/*

  const rateLimit = (await import('@fastify/rate-limit')).default;
  await fastify.register(rateLimit, {
    max: Number(process.env.AUTH_RATE_LIMIT_MAX ?? 20),
    timeWindow: process.env.AUTH_RATE_LIMIT_WINDOW ?? '1 minute',
    keyGenerator: (req) => {
      const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
      return `auth:${Array.isArray(ip) ? ip[0] : ip}`;
    },
  });

  fastify.post('/telegram', async (request, reply) => {
    const body = telegramAuthSchema.parse(request.body);
    const initData = verifyTelegramInitData(body.initData);
    if (!initData.valid || !initData.user) {
      reply.status(401).send({
        error: { code: 'AUTH_INVALID_INIT_DATA', message: 'Invalid Telegram initData' },
      });
      return;
    }
    const tenantManager = getTenantManager();
    const telegramId = String(initData.user.id);
    const bootstrapRole = resolveBootstrapRole(telegramId);
    let user = await tenantManager.findUserByTelegramId(telegramId);
    const isNewUser = !user;
    if (!user) {
      user = await tenantManager.createUser({
        telegramId: initData.user.id,
        telegramUsername: initData.user.username,
        firstName: initData.user.first_name,
        lastName: initData.user.last_name,
        photoUrl: initData.user.photo_url,
        role: bootstrapRole ?? 'player',
      });
    } else if (
      bootstrapRole &&
      (ROLE_RANK[bootstrapRole] ?? 0) > (ROLE_RANK[user.role] ?? 0)
    ) {
      await tenantManager.updateUserRole(user.id, bootstrapRole);
      user = { ...user, role: bootstrapRole };
    }
    await tenantManager.updateUserLastSeen(user.id);
    try {
      const tid = await tenantManager.ensureOrgTenant(user.id);
      user = { ...user, tenantId: tid };
    } catch (err) {
      const { getLogger } = await import('../../observability/logger.js');
      getLogger().warn(
        { component: 'Auth', userId: user.id, error: String(err) },
        'ensureOrgTenant failed'
      );
    }
    const tokens = await createTokens({
      id: user.id,
      telegramId: user.telegramId.toString(),
      role: user.role,
      tenantId: user.tenantId ?? null,
      planId: user.planId,
    });
    reply.status(200).send({ data: { user: publicUser(user), tokens, isNewUser } });
  });

  fastify.post('/refresh', async (request, reply) => {
    const body = refreshTokenSchema.parse(request.body);
    try {
      const { payload } = await jwtVerify(body.refreshToken, REFRESH_SECRET, {
        algorithms: ['HS256'],
      });
      if (payload.type !== 'refresh' || typeof payload.userId !== 'string') {
        reply.status(401).send({
          error: { code: 'INVALID_REFRESH_TOKEN', message: 'Invalid refresh token' },
        });
        return;
      }
      const tokenHash = hashToken(body.refreshToken);
      const result = await getPool().query(
        `UPDATE mini_app_refresh_tokens
         SET revoked_at = NOW()
         WHERE token_hash = $1
           AND user_id = $2
           AND revoked_at IS NULL
           AND expires_at > NOW()
         RETURNING user_id`,
        [tokenHash, payload.userId]
      );
      if (result.rows.length === 0) {
        reply.status(401).send({
          error: { code: 'INVALID_REFRESH_TOKEN', message: 'Invalid or expired refresh token' },
        });
        return;
      }
      const user = await getTenantManager().findUserById(payload.userId);
      if (!user) {
        reply.status(401).send({ error: { code: 'USER_NOT_FOUND', message: 'User not found' } });
        return;
      }
      reply.status(200).send({
        data: await createTokens({
          id: user.id,
          telegramId: user.telegramId.toString(),
          role: user.role,
          tenantId: user.tenantId ?? null,
          planId: user.planId,
        }),
      });
    } catch {
      reply.status(401).send({
        error: { code: 'INVALID_REFRESH_TOKEN', message: 'Invalid or expired refresh token' },
      });
    }
  });

  fastify.post('/logout', { preHandler: authenticateRequest }, async (request, reply) => {
    const token = bearerToken(request);
    if (token) {
      try {
        await getRedisClient().set(`miniapp:revoked:${hashToken(token)}`, '1', 'EX', 15 * 60);
      } catch {
        if (process.env.NODE_ENV === 'production') {
          reply.status(503).send({
            error: {
              code: 'AUTH_STORE_UNAVAILABLE',
              message: 'Could not revoke session; try again',
            },
          });
          return;
        }
      }
    }
    await getPool().query(
      'UPDATE mini_app_refresh_tokens SET revoked_at=NOW() WHERE user_id=$1 AND revoked_at IS NULL',
      [request.auth.userId]
    );
    reply.status(204).send();
  });

  fastify.get('/me', { preHandler: authenticateRequest }, async (request, reply) => {
    const user = await getTenantManager().findUserById(request.auth.userId);
    if (!user) {
      reply.status(404).send({ error: { code: 'USER_NOT_FOUND', message: 'User not found' } });
      return;
    }
    reply.status(200).send({ data: publicUser(user) });
  });
}
