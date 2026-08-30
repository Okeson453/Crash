import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticateRequest } from '@/api/middleware/auth';
import {
  assertBettingAllowedAsync,
  getRgLimits,
  loadRgLimits,
  setCoolingOff,
  setLimits,
  setSelfExclusion,
} from '@/platform/responsible-gambling';

export async function responsibleGamblingRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('preHandler', authenticateRequest);

  fastify.get('/limits', async (request, reply) => {
    const userId = request.auth.userId;
    const data = await loadRgLimits(userId);
    reply.send({ data });
  });

  fastify.post('/self-exclusion', async (request, reply) => {
    const body = z
      .object({
        days: z.number().int().min(1).max(3650).default(30),
      })
      .parse(request.body ?? {});
    const until = new Date(Date.now() + body.days * 86400000).toISOString();
    const data = setSelfExclusion(request.auth.userId, until);
    reply.send({ data });
  });

  fastify.post('/cooling-off', async (request, reply) => {
    const body = z
      .object({
        hours: z.number().int().min(1).max(720).default(24),
      })
      .parse(request.body ?? {});
    const until = new Date(Date.now() + body.hours * 3600000).toISOString();
    const data = setCoolingOff(request.auth.userId, until);
    reply.send({ data });
  });

  fastify.put('/limits', async (request, reply) => {
    const body = z
      .object({
        dailyDepositLimit: z.number().nonnegative().nullable().optional(),
        dailyLossLimit: z.number().nonnegative().nullable().optional(),
      })
      .parse(request.body ?? {});
    const data = setLimits(request.auth.userId, body);
    reply.send({ data });
  });

  fastify.get('/status', async (request, reply) => {
    const check = await assertBettingAllowedAsync(request.auth.userId);
    reply.send({ data: { ...check, limits: getRgLimits(request.auth.userId) } });
  });
}
