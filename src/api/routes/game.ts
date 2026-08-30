import type { FastifyInstance } from 'fastify';
import { miniGameService } from '@/mini-app/game-service';
import { getPool } from '@/persistence/client';
import { z } from 'zod';
export async function gameRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get('/state', async (_request, reply) => { reply.send({ data: miniGameService.getState() }); });
  fastify.post('/client-seed', async (request, reply) => {
    const body = z.object({ clientSeed: z.string().min(1).max(128) }).parse(request.body);
    try {
      miniGameService.setClientSeed(body.clientSeed);
      reply.send({ data: miniGameService.getState() });
    } catch (err) {
      reply.status(400).send({ error: { code: 'CLIENT_SEED_REJECTED', message: err instanceof Error ? err.message : String(err) } });
    }
  });
  fastify.get('/config', async (_request, reply) => { reply.send({ data:{ minBet:1,maxBet:10000,betStep:1,countdownSeconds:5,maxMultiplier:10000,houseEdge:0.01,currency:'USD',currencySymbol:'$' } }); });
  fastify.get('/fairness/:id', async (request, reply) => { const params = z.object({ id: z.string().uuid() }).parse(request.params); const result = await getPool().query('SELECT server_seed_hash,server_seed,client_seed,nonce FROM mini_app_rounds WHERE id=$1',[params.id]); if(!result.rows[0]) { reply.status(404).send({error:{code:'ROUND_NOT_FOUND',message:'Round not found'}}); return; } const row=result.rows[0]; reply.send({data:{serverSeedHash:String(row.server_seed_hash),serverSeed:row.server_seed?String(row.server_seed):null,clientSeed:String(row.client_seed),nonce:Number(row.nonce),verified:row.server_seed!==null}}); });
}
