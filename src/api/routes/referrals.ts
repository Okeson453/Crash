/**
 * User referral routes (qualified-referral milestone program)
 * GET /api/v1/referrals/me — progress for current user
 * GET /api/v1/referrals/me/activity — referral activity list
 */
import type { FastifyInstance } from 'fastify';
import { authenticateRequest } from '@/api/middleware/auth';

export async function referralsRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('preHandler', authenticateRequest);

  fastify.get('/me', async (_request, reply) => {
    reply.send({
      data: {
        qualifiedCount: 0,
        maxMilestone: 20,
        nextMilestone: 5,
        nextRewardPreview: null,
        referralCode: 'CW-PENDING',
        referralLink: '',
        pendingCount: 0,
        campaignEndsAt: null,
      },
    });
  });

  fastify.get('/me/activity', async (_request, reply) => {
    reply.send({ data: [] });
  });
}
