/**
 * User referral routes (qualified-referral milestone program)
 * GET  /api/v1/referrals/me — progress for current user
 * GET  /api/v1/referrals/me/activity — referral activity list
 * POST /api/v1/referrals/attribute — attribute current user to a code (server-side)
 */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticateRequest } from '@/api/middleware/auth';
import {
  attributeReferral,
  getReferralActivity,
  getReferralProgress,
} from '@/platform/referrals/referral-service';
import { listUserRewards } from '@/platform/referrals/reward-service';
import { getTenantManager } from '@/app/composition';

export async function referralsRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('preHandler', authenticateRequest);

  fastify.get('/me', async (request, reply) => {
    let planName: string | null = null;
    try {
      const tenant = await getTenantManager().getUserById(request.auth.userId);
      planName = tenant?.planId ?? null;
    } catch {
      /* optional */
    }
    const data = await getReferralProgress(request.auth.userId, planName);
    reply.send({ data });
  });

  fastify.get('/me/activity', async (request, reply) => {
    const data = await getReferralActivity(request.auth.userId);
    reply.send({ data });
  });

  fastify.get('/me/rewards', async (request, reply) => {
    const data = await listUserRewards(request.auth.userId);
    reply.send({ data });
  });

  fastify.post('/attribute', async (request, reply) => {
    const body = z.object({ code: z.string().min(2).max(64) }).parse(request.body);
    const result = await attributeReferral({
      referredUserId: request.auth.userId,
      code: body.code,
    });
    if (!result.ok) {
      const status =
        result.reason === 'self_referral' || result.reason === 'already_attributed' ? 409 : 400;
      reply.status(status).send({
        error: {
          code: 'REFERRAL_ATTRIBUTE_FAILED',
          message: result.reason ?? 'attribution_failed',
        },
      });
      return;
    }
    reply.send({ data: { attributed: true } });
  });
}
