/**
 * Admin routes
 * GET /api/v1/admin/session - Get session state
 * POST /api/v1/admin/game/start - Start game session
 * POST /api/v1/admin/game/pause - Pause game session
 * POST /api/v1/admin/game/resume - Resume game session
 * POST /api/v1/admin/game/stop - Stop game session
 * POST /api/v1/admin/game/emergency-stop - Emergency stop
 * GET /api/v1/admin/config - Get config
 * PUT /api/v1/admin/config - Update config
 * GET /api/v1/admin/users - List users
 * GET /api/v1/admin/audit - Get audit logs
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticateRequest } from '@/api/middleware/auth';
import { requireRole } from '@/api/middleware/role-guard';
import { getTenantManager } from '@/app/composition';
import { paginationSchema } from '@/api/validators/common';
import type { Tenant } from '@/platform/types';
import { miniGameService } from '@/mini-app/game-service';
import { getAdminReferralOverview } from '@/platform/referrals/referral-service';
import { revokeReward } from '@/platform/referrals/reward-service';

const configSchema = z.object({
  stakePerEntry: z.number().positive().optional(),
  cashOutTarget: z.number().positive().optional(),
  maxDailyEntries: z.number().int().positive().max(1000).optional(),
  mode: z.enum(['observe-only', 'dry-run', 'live', 'maintenance']).optional(),
});

function publicUser(user: Tenant) { return { id: user.id, telegramId: user.telegramId.toString(), telegramUsername: user.telegramUsername, firstName: user.firstName, lastName: user.lastName, photoUrl: user.photoUrl, email: user.email, status: user.status, role: user.role, planId: user.planId, planName: null, timezone: user.timezone, createdAt: user.createdAt.toISOString(), updatedAt: user.updatedAt.toISOString() }; }

export async function adminRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('preHandler', authenticateRequest);
  fastify.addHook('preHandler', requireRole('operator', 'admin'));

  // GET /api/v1/admin/session
  fastify.get('/session', async (_request, reply) => {
    const state = miniGameService.getState();
    reply.send({ data: { status: state.phase === 'running' || state.phase === 'countdown' ? 'running' : 'idle', mode: 'dry-run', uptimeSeconds: 0, totalRounds: 0, totalBets: 0, totalPnl: 0, lastError: null, healthChecks: [] } });
  });

  fastify.post('/game/start', async (_request, reply) => { miniGameService.start(); reply.send({ data: { status: 'running', mode: 'dry-run', uptimeSeconds: 0, totalRounds: 0, totalBets: 0, totalPnl: 0, lastError: null, healthChecks: [] } }); });
  fastify.post('/game/pause', async (_request, reply) => { miniGameService.pause(); reply.send({ data: { status: 'paused', mode: 'dry-run', uptimeSeconds: 0, totalRounds: 0, totalBets: 0, totalPnl: 0, lastError: null, healthChecks: [] } }); });
  fastify.post('/game/resume', async (_request, reply) => { miniGameService.resume(); reply.send({ data: { status: 'running', mode: 'dry-run', uptimeSeconds: 0, totalRounds: 0, totalBets: 0, totalPnl: 0, lastError: null, healthChecks: [] } }); });
  fastify.post('/game/stop', async (_request, reply) => { miniGameService.stop(); reply.send({ data: { status: 'stopped', mode: 'dry-run', uptimeSeconds: 0, totalRounds: 0, totalBets: 0, totalPnl: 0, lastError: null, healthChecks: [] } }); });
  fastify.post('/game/emergency-stop', async (_request, reply) => { miniGameService.emergencyStop(); reply.send({ data: { status: 'stopped', mode: 'maintenance', uptimeSeconds: 0, totalRounds: 0, totalBets: 0, totalPnl: 0, lastError: 'Emergency stop triggered', healthChecks: [] } }); });

  // GET /api/v1/admin/config
  fastify.get('/config', async (_request, reply) => {
    reply.status(200).send({
      data: {
        stakePerEntry: 700,
        cashOutTarget: 1.3,
        maxDailyEntries: 100,
        mode: 'dry-run',
      },
    });
  });

  // PUT /api/v1/admin/config
  fastify.put('/config', { preHandler: requireRole('admin') }, async (request, reply) => {
    const body = configSchema.parse(request.body);
    reply.status(200).send({ data: body });
  });

  // GET /api/v1/admin/users
  fastify.get('/users', async (request, reply) => {
    const query = paginationSchema.extend({
      search: z.string().optional(),
      status: z.string().optional(),
    }).parse(request.query);
    const tenantManager = getTenantManager();
    let users = await tenantManager.listUsers({ limit: query.limit });
    if (query.search) {
      const s = query.search.toLowerCase();
      users = users.filter(
        (u) =>
          (u.telegramUsername || '').toLowerCase().includes(s) ||
          (u.firstName || '').toLowerCase().includes(s) ||
          (u.lastName || '').toLowerCase().includes(s)
      );
    }
    if (query.status && query.status !== 'all') {
      users = users.filter((u) => u.status === query.status);
    }

    reply.status(200).send({
      data: users.map(publicUser),
      pagination: {
        cursor: users.length === query.limit ? users[users.length - 1]?.id : null,
        hasMore: users.length === query.limit,
      },
    });
  });

  // GET /api/v1/admin/audit
  fastify.get('/audit', async (request, reply) => {
    const query = paginationSchema.parse(request.query);
    const tenantManager = getTenantManager();
    const logs = await tenantManager.getAuditLogs({ limit: query.limit });

    reply.status(200).send({
      data: logs,
      pagination: {
        cursor: logs.length === query.limit ? logs[logs.length - 1]?.id : null,
        hasMore: logs.length === query.limit,
      },
    });
  });

  // === Design-concept admin extensions (stubs with safe defaults) ===

  fastify.get('/overview', async (_request, reply) => {
    reply.send({
      data: {
        totalRounds: 0,
        activePlayers: 0,
        revenue24h: 0,
        profit24h: 0,
        totalBets: 0,
        totalPnl: 0,
        revenueChart: [],
        latestAlerts: [],
      },
    });
  });

  fastify.post('/users/:id/suspend', { preHandler: requireRole('admin') }, async (request, reply) => {
    const { id } = request.params as { id: string };
    reply.send({ data: { id, status: 'suspended' } });
  });

  fastify.post('/users/:id/unsuspend', { preHandler: requireRole('admin') }, async (request, reply) => {
    const { id } = request.params as { id: string };
    reply.send({ data: { id, status: 'active' } });
  });

  fastify.put('/users/:id/role', { preHandler: requireRole('admin') }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = z.object({ role: z.enum(['player', 'operator', 'admin']) }).parse(request.body);
    reply.send({ data: { id, role: body.role } });
  });

  fastify.get('/activity', async (_request, reply) => {
    reply.send({ data: [] });
  });

  fastify.get('/rounds', async (request, reply) => {
    const query = paginationSchema.parse(request.query);
    reply.send({
      data: [],
      pagination: { cursor: null, hasMore: false, limit: query.limit },
    });
  });

  fastify.get('/tenant', async (_request, reply) => {
    reply.send({
      data: {
        identity: { displayName: 'CrashWave', slug: 'crashwave', description: '' },
        branding: { logoUrl: '', primaryColor: '#2481cc', accentColor: '#22c55e' },
        limits: { currency: 'USD', minBet: 1, maxBet: 10000, maxDailyWager: 100000 },
      },
    });
  });

  fastify.get('/billing/subscription', async (_request, reply) => {
    reply.send({ data: null });
  });

  fastify.get('/billing/usage', async (_request, reply) => {
    reply.send({
      data: {
        apiCalls: 0,
        apiCallsLimit: 100000,
        players: 0,
        playersLimit: 1000,
        rounds: 0,
        roundsLimit: 100000,
      },
    });
  });

  fastify.get('/billing/invoices', async (_request, reply) => {
    reply.send({ data: [] });
  });

  fastify.get('/compliance/rg', async (_request, reply) => {
    reply.send({
      data: { betCooldownMinutes: 0, maxLossPerDay: 0, maxSessionHours: 24 },
    });
  });

  fastify.get('/compliance/self-exclusion', async (_request, reply) => {
    reply.send({ data: [] });
  });

  fastify.get('/compliance/kyc', async (_request, reply) => {
    reply.send({ data: { verified: 0, pending: 0, rejected: 0, total: 0 } });
  });

  fastify.get('/integrations/telegram', async (_request, reply) => {
    reply.send({
      data: {
        botName: 'crashwave_bot',
        isConnected: false,
        webhookUrl: null,
        lastPingAt: null,
      },
    });
  });

  fastify.get('/integrations/webhooks', async (_request, reply) => {
    reply.send({
      data: { betEvents: '', roundEvents: '', userEvents: '' },
    });
  });

  fastify.get('/integrations/services', async (_request, reply) => {
    reply.send({
      data: [
        { name: 'postgresql', status: 'connected', lastCheckedAt: new Date().toISOString() },
        { name: 'redis', status: 'connected', lastCheckedAt: new Date().toISOString() },
        { name: 'telegram', status: 'disconnected', lastCheckedAt: new Date().toISOString() },
      ],
    });
  });

  fastify.get('/referrals/overview', async (_request, reply) => {
    const data = await getAdminReferralOverview();
    reply.send({ data });
  });

  fastify.post('/referrals/rewards/:id/revoke', { preHandler: requireRole('admin') }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = z.object({ reason: z.string().min(1).max(500) }).parse(request.body ?? { reason: 'admin_revoke' });
    const ok = await revokeReward({
      rewardId: id,
      actorId: request.auth.userId,
      reason: body.reason,
    });
    if (!ok) {
      reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Reward not found or already revoked' } });
      return;
    }
    reply.send({ data: { revoked: true } });
  });
}
