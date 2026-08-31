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
import { globalLiveDivergence } from '@/prediction/validation/live-divergence-monitor';
import { globalProductionController } from '@/prediction/lifecycle/production-controller';
import { getLogger } from '@/observability/logger';
import { z } from 'zod';
import { authenticateRequest } from '@/api/middleware/auth';
import { requireRole } from '@/api/middleware/role-guard';
import { getTenantManager } from '@/app/composition';
import { getPool } from '@/persistence/client';
import { paginationSchema } from '@/api/validators/common';
import type { Tenant } from '@/platform/types';
import { miniGameService } from '@/mini-app/game-service';
import { getAdminReferralOverview } from '@/platform/referrals/referral-service';
import {
  listCampaigns,
  createCampaign,
  setCampaignActive,
  updateCampaignRules,
  getFraudSignals,
  listReferralsByStatus,
  listRewardLedger,
} from '@/platform/referrals/admin-referral-service';
import { loadAdminSetting, saveAdminSetting, saveConfigVersion, listConfigVersions, hydrateAdminSettingsDefaults } from '@/platform/admin-settings-store';
import { revokeReward } from '@/platform/referrals/reward-service';
import {
  listBrowserSessions,
  terminateBrowserSession,
  listActiveBets,
  getRiskSummary,
  listTransactions,
  listAdminLogs,
  listAlerts,
  acknowledgeAlert,
  listFeatureFlags,
  setFeatureFlag,
} from '@/platform/admin-ops-service';

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

  // Process cache defaults; authoritative store is platform_admin_settings (PostgreSQL)
  const runtimeAdminSettings: {
    tenant: {
      identity: { displayName: string; slug: string; description: string };
      branding: { logoUrl: string; primaryColor: string; accentColor: string };
      limits: { currency: string; minBet: number; maxBet: number; maxDailyWager: number };
    };
    rg: { betCooldownMinutes: number; maxLossPerDay: number; maxSessionHours: number };
    webhooks: { betEvents: string; roundEvents: string; userEvents: string };
    telegramWebhook: string | null;
  } = {
    tenant: {
      identity: { displayName: 'CrashWave', slug: 'crashwave', description: '' },
      branding: { logoUrl: '', primaryColor: '#2481cc', accentColor: '#22c55e' },
      limits: { currency: 'USD', minBet: 1, maxBet: 10000, maxDailyWager: 100000 },
    },
    rg: { betCooldownMinutes: 0, maxLossPerDay: 0, maxSessionHours: 24 },
    webhooks: { betEvents: '', roundEvents: '', userEvents: '' },
    telegramWebhook: null,
  };

  // Warm cache from DB (non-blocking)
  void hydrateAdminSettingsDefaults(['tenant', 'rg', 'webhooks', 'betting_config']).then(async () => {
    runtimeAdminSettings.tenant = await loadAdminSetting('tenant', runtimeAdminSettings.tenant);
    runtimeAdminSettings.rg = await loadAdminSetting('rg', runtimeAdminSettings.rg);
    runtimeAdminSettings.webhooks = await loadAdminSetting('webhooks', runtimeAdminSettings.webhooks);
  });


  const defaultBettingConfig = {
    stakePerEntry: 700,
    cashOutTarget: 1.3,
    maxDailyEntries: 100,
    mode: process.env.SYSTEM_MODE || 'dry-run',
  };

  async function sessionPayload(extra: Record<string, unknown> = {}) {
    const state = miniGameService.getState();
    const status =
      state.phase === 'running' || state.phase === 'countdown'
        ? 'running'
        : state.phase === 'crashed'
          ? 'idle'
          : state.phase === 'idle'
            ? 'idle'
            : state.phase;

    let totals = { totalRounds: 0, totalBets: 0, totalPnl: 0 };
    let healthChecks: Array<{ name: string; ok: boolean; detail?: string }> = [];
    try {
      const [roundsRow, betsRow] = await Promise.all([
        getPool().query(
          `SELECT COUNT(*)::int AS total_rounds FROM mini_app_rounds WHERE phase = 'crashed'`
        ),
        getPool().query(
          `SELECT COUNT(*)::int AS total_bets, COALESCE(SUM(pnl), 0)::float AS total_pnl
           FROM mini_app_bets
           WHERE state IN ('cashed_out', 'lost')`
        ),
      ]);
      totals = {
        totalRounds: Number(roundsRow.rows[0]?.total_rounds ?? 0),
        totalBets: Number(betsRow.rows[0]?.total_bets ?? 0),
        totalPnl: Number(betsRow.rows[0]?.total_pnl ?? 0),
      };
      healthChecks = [
        { name: 'database', ok: true },
        { name: 'engine', ok: state.phase !== undefined },
      ];
    } catch (err) {
      getLogger().warn(
        { component: 'AdminAPI', error: err instanceof Error ? err.message : String(err) },
        'sessionPayload: failed to load real totals, returning partial data'
      );
      healthChecks = [{ name: 'database', ok: false, detail: 'query failed' }];
    }

    return {
      status,
      mode: process.env.SYSTEM_MODE || 'dry-run',
      phase: state.phase,
      roundId: state.roundId,
      currentRoundId: state.roundId,
      uptimeSeconds: process.uptime(),
      ...totals,
      lastError: null,
      healthChecks,
      serverTime: state.serverTime,
      ...extra,
    };
  }

  // GET /api/v1/admin/session
  fastify.get('/session', async (_request, reply) => {
    reply.send({ data: await sessionPayload() });
  });

  fastify.post('/game/start', async (_request, reply) => {
    miniGameService.start();
    reply.send({ data: await sessionPayload({ status: 'running' }) });
  });
  fastify.post('/game/pause', async (_request, reply) => {
    miniGameService.pause();
    reply.send({ data: await sessionPayload({ status: 'paused' }) });
  });
  fastify.post('/game/resume', async (_request, reply) => {
    miniGameService.resume();
    reply.send({ data: await sessionPayload({ status: 'running' }) });
  });
  fastify.post('/game/stop', async (_request, reply) => {
    miniGameService.stop();
    reply.send({ data: await sessionPayload({ status: 'stopped' }) });
  });
  fastify.post('/game/emergency-stop', async (_request, reply) => {
    miniGameService.emergencyStop();
    reply.send({ data: await sessionPayload({ status: 'stopped', mode: 'maintenance', lastError: 'Emergency stop triggered' }) });
  });

  // GET /api/v1/admin/config — persisted
  fastify.get('/config', async (_request, reply) => {
    const data = await loadAdminSetting('betting_config', defaultBettingConfig);
    reply.status(200).send({ data });
  });

  // PUT /api/v1/admin/config — persist + return stored
  fastify.put('/config', { preHandler: requireRole('admin') }, async (request, reply) => {
    const body = configSchema.parse(request.body);
    const current = await loadAdminSetting('betting_config', defaultBettingConfig);
    const next = { ...current, ...body };
    await saveAdminSetting('betting_config', next, request.auth?.userId);
    await saveConfigVersion('betting_config', next, request.auth?.userId);
    reply.status(200).send({ data: next });
  });

  // GET /api/v1/admin/users
  fastify.get('/users', async (request, reply) => {
    const query = paginationSchema
      .extend({
        search: z.string().optional(),
        status: z.string().optional(),
      })
      .parse(request.query);

    const pool = getPool();
    const conditions: string[] = ['1=1'];
    const values: unknown[] = [];
    let pidx = 1;

    if (query.search) {
      conditions.push(
        `(LOWER(COALESCE(telegram_username,'')) LIKE $${pidx} OR LOWER(COALESCE(first_name,'')) LIKE $${pidx} OR LOWER(COALESCE(last_name,'')) LIKE $${pidx} OR LOWER(COALESCE(email,'')) LIKE $${pidx})`
      );
      values.push(`%${query.search.toLowerCase()}%`);
      pidx += 1;
    }
    if (query.status && query.status !== 'all') {
      conditions.push(`status = $${pidx}`);
      values.push(query.status);
      pidx += 1;
    }
    values.push(query.limit ?? 50);
    const result = await pool.query(
      `SELECT id, telegram_id, telegram_username, first_name, last_name,
              photo_url, email, status, role, plan_id, timezone, created_at, updated_at
       FROM users
       WHERE ${conditions.join(' AND ')}
       ORDER BY created_at DESC
       LIMIT $${pidx}`,
      values
    );
    const users = result.rows.map((row) => ({
      id: String(row.id),
      telegramId: BigInt(row.telegram_id),
      telegramUsername: (row.telegram_username as string) ?? null,
      firstName: String(row.first_name ?? ''),
      lastName: (row.last_name as string) ?? null,
      photoUrl: (row.photo_url as string) ?? null,
      email: (row.email as string) ?? null,
      status: row.status as string,
      role: (row.role as string) ?? 'player',
      planId: (row.plan_id as string) ?? null,
      timezone: (row.timezone as string) ?? 'UTC',
      createdAt: row.created_at as Date,
      updatedAt: row.updated_at as Date,
    }));

    reply.status(200).send({
      data: users.map(publicUser),
      pagination: {
        cursor: users.length === query.limit ? users[users.length - 1]?.id ?? null : null,
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
    try {
      const pool = getPool();
      const state = miniGameService.getState();
      const users = await pool.query(`SELECT COUNT(*)::int AS n FROM users`);
      const openBets = await pool.query(
        `SELECT COUNT(*)::int AS n FROM mini_app_bets WHERE state IN ('placed','active','pending')`
      );
      const pnl = await pool.query(
        `SELECT COALESCE(SUM(pnl),0)::float8 AS pnl FROM mini_app_bets
         WHERE settled_at > NOW() - INTERVAL '24 hours'`
      );
      const rounds = await pool.query(
        `SELECT COUNT(*)::int AS n FROM mini_app_rounds WHERE created_at > NOW() - INTERVAL '24 hours'`
      ).catch(() => ({ rows: [{ n: 0 }] }));
      const isRunning = state.phase === 'running' || state.phase === 'countdown';
      reply.send({
        data: {
          users: users.rows[0]?.n ?? 0,
          openBets: openBets.rows[0]?.n ?? 0,
          pnl24h: Number(pnl.rows[0]?.pnl ?? 0),
          totalRounds: Number(rounds.rows[0]?.n ?? 0),
          activePlayers: openBets.rows[0]?.n ?? 0,
          revenue24h: 0,
          profit24h: Number(pnl.rows[0]?.pnl ?? 0),
          totalBets: openBets.rows[0]?.n ?? 0,
          totalPnl: Number(pnl.rows[0]?.pnl ?? 0),
          revenueChart: [],
          gamePhase: state.phase,
          roundId: state.roundId,
          serverTime: state.serverTime,
          latestAlerts: isRunning
            ? []
            : [{ name: 'Engine', status: 'degraded' as const, message: `Phase: ${state.phase}` }],
        },
      });
    } catch (err) {
      reply.status(500).send({
        error: { code: 'OVERVIEW_FAILED', message: err instanceof Error ? err.message : String(err) },
      });
    }
  });

  fastify.post('/users/:id/suspend', { preHandler: requireRole('admin') }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const tenantManager = getTenantManager();
    await tenantManager.updateUserStatus(id, 'suspended');
    reply.send({ data: { id, status: 'suspended' } });
  });

  fastify.post('/users/:id/unsuspend', { preHandler: requireRole('admin') }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const tenantManager = getTenantManager();
    await tenantManager.updateUserStatus(id, 'active');
    reply.send({ data: { id, status: 'active' } });
  });

  fastify.put('/users/:id/role', { preHandler: requireRole('admin') }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = z.object({ role: z.enum(['player', 'operator', 'admin']) }).parse(request.body);
    await getPool().query(`UPDATE users SET role = $1, updated_at = NOW() WHERE id = $2`, [body.role, id]);
    reply.send({ data: { id, role: body.role } });
  });

  /* /activity implemented below with audit_logs */

  fastify.get('/rounds', async (request, reply) => {
    const query = paginationSchema.parse(request.query);
    try {
      const r = await getPool().query(
        `SELECT id, crash_point, phase, created_at, settled_at
         FROM mini_app_rounds
         ORDER BY created_at DESC
         LIMIT $1`,
        [query.limit ?? 50]
      );
      reply.send({
        data: r.rows,
        pagination: {
          cursor: r.rows.length === query.limit ? String(r.rows.at(-1)?.id ?? '') : null,
          hasMore: r.rows.length === query.limit,
          limit: query.limit,
        },
      });
    } catch {
      reply.send({ data: [], pagination: { cursor: null, hasMore: false, limit: query.limit } });
    }
  });

  for (const path of [
    '/billing/subscription',
    '/billing/usage',
    '/billing/invoices',
    '/compliance/self-exclusion',
    '/compliance/kyc',
  ] as const) {
    fastify.get(path, async (_req, reply) => {
      reply.status(501).send({
        error: { code: 'NOT_IMPLEMENTED', message: `${path} is not implemented` },
      });
    });
  }

  fastify.get('/integrations/telegram', async (_request, reply) => {
    reply.send({
      data: {
        botName: process.env.TELEGRAM_BOT_USERNAME ?? 'crashwave_bot',
        isConnected: Boolean(process.env.TELEGRAM_BOT_TOKEN),
        webhookUrl: runtimeAdminSettings?.telegramWebhook ?? null,
        lastPingAt: null,
      },
    });
  });

  fastify.get('/integrations/services', async (_request, reply) => {
    reply.status(501).send({
      error: { code: 'NOT_IMPLEMENTED', message: '/integrations/services is not implemented' },
    });
  });

  fastify.get('/referrals/overview', async (_request, reply) => {
    const data = await getAdminReferralOverview();
    reply.send({ data });
  });

  
  fastify.get('/referrals/campaigns', async (_request, reply) => {
    const data = await listCampaigns();
    reply.send({ data });
  });

  fastify.post('/referrals/campaigns', { preHandler: requireRole('admin') }, async (request, reply) => {
    const body = z.object({
      name: z.string().min(1).max(120),
      qualificationWindowDays: z.number().int().min(1).max(90).optional(),
      maxMilestone: z.number().int().min(1).max(100).optional(),
      milestones: z.array(z.number().int()).optional(),
      minPlan: z.string().max(32).optional(),
      notes: z.string().max(500).optional(),
      endsAt: z.string().datetime().nullable().optional(),
      startsAt: z.string().datetime().nullable().optional(),
      rewardExpiryDays: z.number().int().min(1).max(365).optional(),
    }).parse(request.body);
    const data = await createCampaign(body);
    if (!data) {
      reply.status(500).send({ error: { code: 'CREATE_FAILED', message: 'Could not create campaign' } });
      return;
    }
    reply.send({ data });
  });

  fastify.put('/referrals/campaigns/:id/active', { preHandler: requireRole('admin') }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = z.object({ isActive: z.boolean() }).parse(request.body);
    const data = await setCampaignActive(id, body.isActive);
    if (!data) {
      reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Campaign not found' } });
      return;
    }
    reply.send({ data });
  });

  fastify.put('/referrals/campaigns/:id/rules', { preHandler: requireRole('admin') }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = z.object({
      qualificationWindowDays: z.number().int().min(1).max(90).optional(),
      maxMilestone: z.number().int().min(1).max(100).optional(),
      milestones: z.array(z.number().int()).optional(),
      minPlan: z.string().max(32).optional(),
      notes: z.string().max(500).optional(),
      rewardExpiryDays: z.number().int().min(1).max(365).optional(),
      startsAt: z.string().datetime().nullable().optional(),
      endsAt: z.string().datetime().nullable().optional(),
    }).parse(request.body);
    const data = await updateCampaignRules(id, body);
    if (!data) {
      reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Campaign not found' } });
      return;
    }
    reply.send({ data });
  });

  fastify.get('/referrals/qualified', async (_request, reply) => {
    const data = await listReferralsByStatus('QUALIFIED', 100);
    reply.send({ data });
  });

  fastify.get('/referrals/pending', async (_request, reply) => {
    const data = await listReferralsByStatus('ALL_PENDING', 100);
    reply.send({ data });
  });

  fastify.get('/referrals/rewards', async (_request, reply) => {
    const data = await listRewardLedger(100);
    reply.send({ data });
  });

  fastify.get('/referrals/fraud', async (_request, reply) => {
    const data = await getFraudSignals(50);
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

  fastify.get('/tenant', async (_request, reply) => {
    runtimeAdminSettings.tenant = await loadAdminSetting('tenant', runtimeAdminSettings.tenant);
    reply.send({ data: runtimeAdminSettings.tenant });
  });

  fastify.put('/tenant/identity', { preHandler: requireRole('admin') }, async (request, reply) => {
    const body = z.object({
      displayName: z.string().min(1).max(100),
      slug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/),
      description: z.string().max(500).optional(),
    }).parse(request.body);
    runtimeAdminSettings.tenant.identity = {
      displayName: body.displayName,
      slug: body.slug,
      description: body.description ?? '',
    };
    await saveAdminSetting('tenant', runtimeAdminSettings.tenant, request.auth.userId);
    reply.send({ data: runtimeAdminSettings.tenant.identity });
  });

  fastify.put('/tenant/branding', { preHandler: requireRole('admin') }, async (request, reply) => {
    const body = z.object({
      logoUrl: z.string().max(500),
      primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
      accentColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
    }).parse(request.body);
    runtimeAdminSettings.tenant.branding = body;
    await saveAdminSetting('tenant', runtimeAdminSettings.tenant, request.auth.userId);
    reply.send({ data: runtimeAdminSettings.tenant.branding });
  });

  fastify.put('/tenant/limits', { preHandler: requireRole('admin') }, async (request, reply) => {
    const body = z.object({
      currency: z.string().min(3).max(3),
      minBet: z.number().min(0),
      maxBet: z.number().min(0),
      maxDailyWager: z.number().min(0),
    }).parse(request.body);
    runtimeAdminSettings.tenant.limits = body;
    await saveAdminSetting('tenant', runtimeAdminSettings.tenant, request.auth.userId);
    reply.send({ data: runtimeAdminSettings.tenant.limits });
  });

  // config history is persisted via config_versions (listConfigVersions)

  
  fastify.get('/activity', async (request, reply) => {
    const q = paginationSchema.parse(request.query);
    try {
      const r = await getPool().query(
        `SELECT id, action, actor_id, payload, created_at
         FROM audit_logs ORDER BY created_at DESC LIMIT $1`,
        [q.limit ?? 50]
      );
      reply.send({
        data: r.rows.map((row) => ({
          id: String(row.id),
          action: row.action,
          actorId: row.actor_id,
          payload: row.payload,
          createdAt: row.created_at,
        })),
      });
    } catch {
      reply.send({ data: [] });
    }
  });

  
  fastify.get('/config/history', async (_request, reply) => {
    const data = await listConfigVersions('betting_config', 50);
    reply.send({ data });
  });

  fastify.get('/compliance/rg', async (_request, reply) => {
    runtimeAdminSettings.rg = await loadAdminSetting('rg', runtimeAdminSettings.rg);
    reply.send({ data: runtimeAdminSettings.rg });
  });

  fastify.put('/compliance/rg', { preHandler: requireRole('admin') }, async (request, reply) => {
    const body = z.object({
      betCooldownMinutes: z.number().min(0).max(1440),
      maxLossPerDay: z.number().min(0),
      maxSessionHours: z.number().min(0).max(24),
    }).parse(request.body);
    runtimeAdminSettings.rg = body;
    await saveAdminSetting('rg', runtimeAdminSettings.rg, request.auth.userId);
    reply.send({ data: runtimeAdminSettings.rg });
  });

  fastify.get('/integrations/webhooks', async (_request, reply) => {
    runtimeAdminSettings.webhooks = await loadAdminSetting('webhooks', runtimeAdminSettings.webhooks);
    reply.send({ data: runtimeAdminSettings.webhooks });
  });

  fastify.put('/integrations/webhooks', { preHandler: requireRole('admin') }, async (request, reply) => {
    const body = z.object({
      betEvents: z.string().max(500),
      roundEvents: z.string().max(500),
      userEvents: z.string().max(500),
    }).parse(request.body);
    runtimeAdminSettings.webhooks = body;
    await saveAdminSetting('webhooks', runtimeAdminSettings.webhooks, request.auth.userId);
    reply.send({ data: runtimeAdminSettings.webhooks });
  });

  fastify.put('/integrations/telegram/webhook', { preHandler: requireRole('admin') }, async (request, reply) => {
    const body = z.object({ url: z.string().max(500) }).parse(request.body);
    runtimeAdminSettings.telegramWebhook = body.url || null;
    reply.send({ data: { webhookUrl: runtimeAdminSettings.telegramWebhook } });
  });

  fastify.post('/integrations/telegram/webhook/test', { preHandler: requireRole('admin') }, async (request, reply) => {
    const body = z.object({ url: z.string().max(500).optional() }).parse(request.body ?? {});
    const url = body.url || runtimeAdminSettings.telegramWebhook;
    reply.send({ data: { ok: Boolean(url), url: url ?? null, message: url ? 'Webhook URL recorded' : 'No webhook URL' } });
  });

  // ── Phase 4 operational surfaces ──────────────────────────────────────────
  fastify.get('/sessions', async (_request, reply) => {
    const data = await listBrowserSessions(50);
    reply.send({ data });
  });

  fastify.post('/sessions/:id/terminate', { preHandler: requireRole('admin') }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const ok = await terminateBrowserSession(id);
    if (!ok) {
      reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Session not found or already stopped' } });
      return;
    }
    reply.send({ data: { terminated: true } });
  });

  fastify.get('/bets/active', async (_request, reply) => {
    const data = await listActiveBets(100);
    reply.send({ data });
  });

  fastify.get('/risk', async (_request, reply) => {
    const data = await getRiskSummary();
    reply.send({ data });
  });

  fastify.get('/transactions', async (_request, reply) => {
    const data = await listTransactions(100);
    reply.send({ data });
  });

  fastify.get('/logs', async (_request, reply) => {
    const data = await listAdminLogs(100);
    reply.send({ data });
  });

  fastify.get('/alerts', async (_request, reply) => {
    const data = await listAlerts();
    reply.send({ data });
  });

  fastify.post('/alerts/:id/acknowledge', { preHandler: requireRole('admin') }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const ok = await acknowledgeAlert(id, request.auth.userId);
    reply.send({ data: { acknowledged: ok } });
  });

  fastify.get('/feature-flags', async (_request, reply) => {
    const data = await listFeatureFlags();
    reply.send({ data });
  });

  fastify.put('/feature-flags/:key', { preHandler: requireRole('admin') }, async (request, reply) => {
    const { key } = request.params as { key: string };
    const body = z.object({ enabled: z.boolean() }).parse(request.body);
    const data = await setFeatureFlag(key, body.enabled, request.auth.userId);
    if (!data) {
      reply.status(500).send({ error: { code: 'UPDATE_FAILED', message: 'Could not update flag' } });
      return;
    }
    reply.send({ data });
  });

  /**
   * GET /admin/sheath/status — read-only divergence / sheath state for operator UI
   */
  fastify.get('/sheath/status', async (_request, reply) => {
    const snap = globalLiveDivergence.evaluate();
    reply.send({
      data: {
        level: snap.level,
        manualRecoveryRequired: snap.manualRecoveryRequired,
        lastReason: snap.reason ?? null,
        windowSize: snap.windowSize,
        predictedMean: snap.predictedMean,
        realizedRate: snap.realizedRate,
      },
    });
  });

  /**
   * POST /admin/sheath/recover — clear Level-5 divergence halt (requires confirm:true)
   */
  fastify.post('/sheath/recover', { preHandler: requireRole('admin') }, async (request, reply) => {
    z.object({ confirm: z.literal(true) }).parse(request.body ?? {});
    try {
      globalLiveDivergence.manualRecover(true);
      globalProductionController.manualRecoverDivergence();
      getLogger().warn(
        {
          component: 'AdminAPI',
          userId: request.auth?.userId,
          action: 'sheath_recover',
        },
        'Operator cleared prediction sheath / divergence'
      );
      // Best-effort audit
      try {
        const pool = getPool();
        await pool.query(
          `INSERT INTO audit_logs (actor_id, action, resource, detail) VALUES ($1,$2,$3,$4)`,
          [request.auth?.userId ?? null, 'sheath_recover', 'prediction', JSON.stringify({ confirm: true })]
        );
      } catch { /* audit table may vary */ }
      reply.send({ data: { recovered: true, divergence: globalLiveDivergence.evaluate() } });
    } catch (err) {
      reply.status(400).send({
        error: {
          code: 'RECOVER_FAILED',
          message: err instanceof Error ? err.message : String(err),
        },
      });
    }
  });

  // Gate unfinished surfaces with 501 rather than fake data
  for (const path of [
    '/billing/subscription',
    '/billing/usage',
    '/billing/invoices',
    '/compliance/self-exclusion',
    '/compliance/kyc',
    '/compliance/reports',
    '/integrations/services',
  ] as const) {
    fastify.all(path, async (_req, reply) => {
      reply.status(501).send({
        error: { code: 'NOT_IMPLEMENTED', message: `${path} is not implemented` },
      });
    });
  }
}
