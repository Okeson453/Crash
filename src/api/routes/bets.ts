import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticateRequest } from '@/api/middleware/auth';
import { miniGameService } from '@/mini-app/game-service';
import { getPool } from '@/persistence/client';
import { paginationSchema } from '@/api/validators/common';

const listQuerySchema = paginationSchema.extend({
  status: z
    .enum(['pending', 'placed', 'active', 'cashed_out', 'lost', 'cancelled', 'failed'])
    .optional(),
  fromDate: z.string().datetime().optional(),
  toDate: z.string().datetime().optional(),
});

function rowToBet(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    roundId: row.round_id ? String(row.round_id) : null,
    amount: Number(row.amount),
    autoCashout: row.auto_cashout != null ? Number(row.auto_cashout) : null,
    state: String(row.state),
    cashoutMultiplier: row.cashout_multiplier != null ? Number(row.cashout_multiplier) : null,
    pnl: row.pnl != null ? Number(row.pnl) : null,
    createdAt: new Date(row.created_at as string).toISOString(),
    settledAt: row.settled_at ? new Date(row.settled_at as string).toISOString() : null,
  };
}

export async function betsRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post('/', { preHandler: authenticateRequest }, async (request, reply) => {
    const body = z
      .object({
        amount: z.number().positive(),
        autoCashout: z.number().positive().nullable().optional(),
        idempotencyKey: z.string().min(1).max(128),
      })
      .parse(request.body);
    try {
      const bet = await miniGameService.placeBet(
        request.auth.userId,
        body.amount,
        body.autoCashout ?? null,
        body.idempotencyKey
      );
      reply.send({ data: bet });
    } catch (error) {
      reply.status(409).send({
        error: {
          code: 'BET_PLACE_FAILED',
          message: error instanceof Error ? error.message : 'Place bet failed',
        },
      });
    }
  });

  fastify.post('/:id/cashout', { preHandler: authenticateRequest }, async (request, reply) => {
    const params = z.object({ id: z.string().uuid() }).parse(request.params);
    try {
      reply.send({ data: await miniGameService.cashout(request.auth.userId, params.id) });
    } catch (error) {
      reply.status(409).send({
        error: {
          code: 'BET_CASHOUT_FAILED',
          message: error instanceof Error ? error.message : 'Cashout failed',
        },
      });
    }
  });

  fastify.get('/', { preHandler: authenticateRequest }, async (request, reply) => {
    const query = listQuerySchema.parse(request.query);
    const params: unknown[] = [request.auth.userId];
    const filters = ['user_id=$1'];
    if (query.status) {
      params.push(query.status);
      filters.push(`state=$${params.length}`);
    }
    if (query.fromDate) {
      params.push(query.fromDate);
      filters.push(`created_at >= $${params.length}`);
    }
    if (query.toDate) {
      params.push(query.toDate);
      filters.push(`created_at <= $${params.length}`);
    }
    params.push(query.limit);
    const result = await getPool().query(
      `SELECT * FROM mini_app_bets WHERE ${filters.join(' AND ')} ORDER BY created_at DESC LIMIT $${params.length}`,
      params
    );
    const data = result.rows.map(rowToBet);
    reply.send({
      data,
      pagination: {
        cursor: data.length === query.limit ? data[data.length - 1]?.id ?? null : null,
        hasMore: data.length === query.limit,
      },
    });
  });

  fastify.get('/:id', { preHandler: authenticateRequest }, async (request, reply) => {
    const params = z.object({ id: z.string().uuid() }).parse(request.params);
    const result = await getPool().query(
      'SELECT * FROM mini_app_bets WHERE id=$1 AND user_id=$2',
      [params.id, request.auth.userId]
    );
    if (!result.rows[0]) {
      reply.status(404).send({ error: { code: 'BET_NOT_FOUND', message: 'Bet not found' } });
      return;
    }
    reply.send({ data: rowToBet(result.rows[0]) });
  });
}
