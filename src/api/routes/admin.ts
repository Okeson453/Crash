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
    const query = paginationSchema.parse(request.query);
    const tenantManager = getTenantManager();
    const users = await tenantManager.listUsers({ limit: query.limit });

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
}
