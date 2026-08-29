import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticateRequest } from '@/api/middleware/auth';
import { getTenantManager } from '@/app/composition';
import { paginationSchema } from '@/api/validators/common';
import { getPool } from '@/persistence/client';
import {
  listUserNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from '@/platform/notifications/user-notification-service';
import type { Tenant } from '@/platform/types';

const updateProfileSchema = z.object({ email: z.string().email().optional(), timezone: z.string().min(1).max(64).optional() });
const preferencesSchema = z.object({
  defaultBetAmount: z.number().min(0).optional(), defaultAutoCashout: z.number().min(1.01).max(10000).nullable().optional(), soundEnabled: z.boolean().optional(), hapticEnabled: z.boolean().optional(), animationsEnabled: z.boolean().optional(), theme: z.enum(['system', 'light', 'dark']).optional(), language: z.string().min(2).max(10).optional(), notificationsEnabled: z.boolean().optional(), maxDailyLoss: z.number().min(0).nullable().optional(), sessionLossLimit: z.number().min(0).nullable().optional(),
  autoBet: z.object({ enabled: z.boolean(), strategy: z.enum(['repeat-last', 'custom-sequence', 'martingale', 'anti-martingale', 'fibonacci']), maxBet: z.number().positive(), stopAfterRounds: z.number().int().positive().nullable().optional() }).optional(),
});
const DEFAULT_PREFERENCES = { defaultBetAmount: 10, defaultAutoCashout: null, soundEnabled: false, hapticEnabled: true, animationsEnabled: true, theme: 'system' as const, language: 'en', notificationsEnabled: true, maxDailyLoss: null, sessionLossLimit: null };

function publicUser(user: Tenant | null) {
  if (!user) return null;
  return { id: user.id, telegramId: user.telegramId.toString(), telegramUsername: user.telegramUsername, firstName: user.firstName, lastName: user.lastName, photoUrl: user.photoUrl, email: user.email, status: user.status, role: user.role, planId: user.planId, planName: null, timezone: user.timezone, createdAt: user.createdAt.toISOString(), updatedAt: user.updatedAt.toISOString() };
}
export async function usersRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get('/me', { preHandler: authenticateRequest }, async (request, reply) => { const user = await getTenantManager().findUserById(request.auth.userId); if (!user) { reply.status(404).send({ error: { code: 'USER_NOT_FOUND', message: 'User not found' } }); return; } reply.send({ data: publicUser(user) }); });
  fastify.put('/me', { preHandler: authenticateRequest }, async (request, reply) => { const body = updateProfileSchema.parse(request.body); const user = await getTenantManager().updateUser(request.auth.userId, body); reply.send({ data: publicUser(user) }); });
  fastify.get('/me/stats', { preHandler: authenticateRequest }, async (request, reply) => { const result = await getPool().query(`SELECT COUNT(*)::int total_bets, COUNT(*) FILTER (WHERE state='cashed_out')::int total_wins, COUNT(*) FILTER (WHERE state='lost')::int total_losses, COALESCE(SUM(pnl),0)::float total_pnl, COALESCE(MAX(cashout_multiplier),0)::float best_multiplier, COALESCE(MIN(cashout_multiplier),0)::float worst_multiplier, COALESCE(AVG(cashout_multiplier) FILTER (WHERE cashout_multiplier IS NOT NULL),0)::float average_cashout FROM mini_app_bets WHERE user_id=$1`, [request.auth.userId]); const row=result.rows[0]??{}; const total=Number(row.total_bets??0), wins=Number(row.total_wins??0); reply.send({data:{totalBets:total,totalWins:wins,totalLosses:Number(row.total_losses??0),winRate:total?wins/total:0,totalPnl:Number(row.total_pnl??0),bestMultiplier:Number(row.best_multiplier??0),worstMultiplier:Number(row.worst_multiplier??0),averageCashout:Number(row.average_cashout??0),currentStreak:0,longestWinStreak:0,longestLossStreak:0}}); });
  fastify.get('/me/activity', { preHandler: authenticateRequest }, async (request, reply) => { const query = paginationSchema.parse(request.query); const result=await getPool().query(`SELECT id,state,amount,cashout_multiplier,pnl,round_id,created_at FROM mini_app_bets WHERE user_id=$1 ORDER BY created_at DESC LIMIT $2`,[request.auth.userId,query.limit]); const activity=result.rows.map((row)=>({id:String(row.id),type:String(row.state)==='cashed_out'?'bet_won':String(row.state)==='lost'?'bet_lost':'bet_placed',amount:Number(row.amount),multiplier:row.cashout_multiplier===null?null:Number(row.cashout_multiplier),roundId:row.round_id?String(row.round_id):null,description:`Bet ${String(row.state)}`,createdAt:new Date(row.created_at as string|number|Date).toISOString()})); reply.send({data:activity,pagination:{cursor:activity.length===query.limit?activity[activity.length-1]?.id??null:null,hasMore:activity.length===query.limit}}); });
  fastify.get('/me/preferences', { preHandler: authenticateRequest }, async (request, reply) => { const result = await getPool().query('SELECT data FROM mini_app_preferences WHERE user_id=$1', [request.auth.userId]); const stored = result.rows[0]?.data; const data = stored && typeof stored === 'object' && !Array.isArray(stored) ? { ...DEFAULT_PREFERENCES, ...stored } : DEFAULT_PREFERENCES; reply.send({ data }); });
  fastify.put('/me/preferences', { preHandler: authenticateRequest }, async (request, reply) => { const body = preferencesSchema.parse(request.body); const existing = await getPool().query('SELECT data FROM mini_app_preferences WHERE user_id=$1', [request.auth.userId]); const prior = existing.rows[0]?.data; const merged = prior && typeof prior === 'object' && !Array.isArray(prior) ? { ...DEFAULT_PREFERENCES, ...prior, ...body } : { ...DEFAULT_PREFERENCES, ...body }; await getPool().query('INSERT INTO mini_app_preferences (user_id,data,updated_at) VALUES ($1,$2,NOW()) ON CONFLICT (user_id) DO UPDATE SET data=EXCLUDED.data,updated_at=NOW()', [request.auth.userId, JSON.stringify(merged)]); reply.send({ data: merged }); });
  fastify.get('/me/balance', { preHandler: authenticateRequest }, async (request, reply) => { const result=await getPool().query('SELECT balance,currency,updated_at FROM mini_app_balances WHERE user_id=$1',[request.auth.userId]); const row=result.rows[0]; reply.send({data:{balance:Number(row?.balance??0),currency:String(row?.currency??'USD'),currencySymbol:'$',updatedAt:row?.updated_at?new Date(row.updated_at as string|number|Date).toISOString():new Date().toISOString()}}); });


  fastify.get('/me/notifications', { preHandler: authenticateRequest }, async (request, reply) => {
    const unreadOnly = (request.query as { unread?: string })?.unread === 'true';
    const data = await listUserNotifications(request.auth.userId, { unreadOnly, limit: 50 });
    reply.send({ data });
  });

  fastify.post('/me/notifications/:id/read', { preHandler: authenticateRequest }, async (request, reply) => {
    const id = (request.params as { id: string }).id;
    const ok = await markNotificationRead(request.auth.userId, id);
    reply.send({ data: { ok } });
  });

  fastify.post('/me/notifications/read-all', { preHandler: authenticateRequest }, async (request, reply) => {
    const count = await markAllNotificationsRead(request.auth.userId);
    reply.send({ data: { count } });
  });

}
