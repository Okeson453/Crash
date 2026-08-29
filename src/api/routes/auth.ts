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

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'development-secret-change-in-production');
const REFRESH_SECRET = new TextEncoder().encode(process.env.REFRESH_SECRET || 'development-refresh-secret-change-in-production');
const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_TTL = '7d';
const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function hashToken(token: string): string { return createHash('sha256').update(token).digest('hex'); }

async function createTokens(user: { id: string; telegramId: string; role: string; tenantId: string | null; planId: string | null }) {
  const accessToken = await new SignJWT({ telegramId: user.telegramId, role: user.role, tenantId: user.tenantId, planId: user.planId })
    .setProtectedHeader({ alg: 'HS256' }).setSubject(user.id).setIssuedAt().setExpirationTime(ACCESS_TOKEN_TTL).sign(JWT_SECRET);
  const refreshToken = await new SignJWT({ type: 'refresh', userId: user.id, jti: randomUUID() })
    .setProtectedHeader({ alg: 'HS256' }).setSubject(user.id).setIssuedAt().setExpirationTime(REFRESH_TOKEN_TTL).sign(REFRESH_SECRET);
  await getPool().query('INSERT INTO mini_app_refresh_tokens (user_id, token_hash, expires_at) VALUES ($1,$2,$3)', [user.id, hashToken(refreshToken), new Date(Date.now() + REFRESH_TTL_MS)]);
  return { accessToken, refreshToken, expiresAt: Date.now() + 15 * 60 * 1000 };
}

function publicUser(user: Tenant | null) {
  if (!user) return null;
  return { id: user.id, telegramId: user.telegramId.toString(), telegramUsername: user.telegramUsername, firstName: user.firstName, lastName: user.lastName, photoUrl: user.photoUrl, email: user.email, status: user.status, role: user.role, planId: user.planId, planName: null, timezone: user.timezone, createdAt: user.createdAt.toISOString(), updatedAt: user.updatedAt.toISOString() };
}

function bearerToken(request: FastifyRequest): string | null {
  const value = request.headers.authorization;
  return value?.startsWith('Bearer ') ? value.slice(7) : null;
}

export async function authRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post('/telegram', async (request, reply) => {
    const body = telegramAuthSchema.parse(request.body);
    const initData = verifyTelegramInitData(body.initData);
    if (!initData.valid || !initData.user) { reply.status(401).send({ error: { code: 'AUTH_INVALID_INIT_DATA', message: 'Invalid Telegram initData' } }); return; }
    const tenantManager = getTenantManager();
    let user = await tenantManager.findUserByTelegramId(String(initData.user.id));
    const isNewUser = !user;
    if (!user) {
      user = await tenantManager.createUser({ telegramId: initData.user.id, telegramUsername: initData.user.username, firstName: initData.user.first_name, lastName: initData.user.last_name, photoUrl: initData.user.photo_url, role: 'player' });
    }
    await tenantManager.updateUserLastSeen(user.id);
    const tokens = await createTokens({ id: user.id, telegramId: user.telegramId.toString(), role: user.role, tenantId: user.id, planId: user.planId });
    reply.status(200).send({ data: { user: publicUser(user), tokens, isNewUser } });
  });

  fastify.post('/refresh', async (request, reply) => {
    const body = refreshTokenSchema.parse(request.body);
    try {
      const { payload } = await jwtVerify(body.refreshToken, REFRESH_SECRET, { algorithms: ['HS256'] });
      if (payload.type !== 'refresh' || typeof payload.userId !== 'string') { reply.status(401).send({ error: { code: 'INVALID_REFRESH_TOKEN', message: 'Invalid refresh token' } }); return; }
      const tokenHash = hashToken(body.refreshToken);
      const result = await getPool().query('SELECT id FROM mini_app_refresh_tokens WHERE token_hash=$1 AND user_id=$2 AND revoked_at IS NULL AND expires_at > NOW()', [tokenHash, payload.userId]);
      if (result.rows.length === 0) { reply.status(401).send({ error: { code: 'INVALID_REFRESH_TOKEN', message: 'Invalid or expired refresh token' } }); return; }
      await getPool().query('UPDATE mini_app_refresh_tokens SET revoked_at=NOW() WHERE token_hash=$1', [tokenHash]);
      const user = await getTenantManager().findUserById(payload.userId);
      if (!user) { reply.status(401).send({ error: { code: 'USER_NOT_FOUND', message: 'User not found' } }); return; }
      reply.status(200).send({ data: await createTokens({ id: user.id, telegramId: user.telegramId.toString(), role: user.role, tenantId: user.id, planId: user.planId }) });
    } catch { reply.status(401).send({ error: { code: 'INVALID_REFRESH_TOKEN', message: 'Invalid or expired refresh token' } }); }
  });

  fastify.post('/logout', { preHandler: authenticateRequest }, async (request, reply) => {
    const token = bearerToken(request);
    if (token) {
      try { await getRedisClient().set(`miniapp:revoked:${hashToken(token)}`, '1', 'EX', 15 * 60); } catch { /* Redis is optional for development. */ }
    }
    await getPool().query('UPDATE mini_app_refresh_tokens SET revoked_at=NOW() WHERE user_id=$1 AND revoked_at IS NULL', [request.auth.userId]);
    reply.status(204).send();
  });

  fastify.get('/me', { preHandler: authenticateRequest }, async (request, reply) => {
    const user = await getTenantManager().findUserById(request.auth.userId);
    if (!user) { reply.status(404).send({ error: { code: 'USER_NOT_FOUND', message: 'User not found' } }); return; }
    reply.status(200).send({ data: publicUser(user) });
  });
}
