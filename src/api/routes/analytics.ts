/**
 * Analytics routes
 * GET /api/v1/analytics/overview - Overview stats
 * GET /api/v1/analytics/revenue - Revenue data
 * GET /api/v1/analytics/players - Player analytics
 */

import type { FastifyInstance } from 'fastify';
import { authenticateRequest } from '@/api/middleware/auth';
import { requireRole } from '@/api/middleware/role-guard';
import { periodQuerySchema } from '@/api/validators/common';

export async function analyticsRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('preHandler', authenticateRequest);
  fastify.addHook('preHandler', requireRole('operator', 'admin'));

  // GET /api/v1/analytics/overview
  fastify.get('/overview', async (request, reply) => {
    const query = periodQuerySchema.parse(request.query);

    reply.status(200).send({
      data: {
        period: query.period,
        totalPlayers: 0,
        activePlayers: 0,
        totalBets: 0,
        totalWagered: 0,
        totalPaidOut: 0,
        houseProfit: 0,
        averageBet: 0,
        averageCashout: 0,
        crashDistribution: [],
      },
    });
  });

  // GET /api/v1/analytics/revenue
  fastify.get('/revenue', async (request, reply) => {
    const query = periodQuerySchema.parse(request.query);

    reply.status(200).send({
      data: {
        labels: [],
        revenue: [],
        bets: [],
        players: [],
      },
    });
  });

  // GET /api/v1/analytics/players
  fastify.get('/players', async (request, reply) => {
    const query = periodQuerySchema.parse(request.query);

    reply.status(200).send({
      data: [],
    });
  });
}
