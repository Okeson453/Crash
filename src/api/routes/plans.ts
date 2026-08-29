/**
 * Plans routes
 * GET /api/v1/plans - List available subscription plans
 */

import type { FastifyInstance } from 'fastify';
import { getTenantManager } from '@/app/composition';

export async function plansRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get('/', async (_request, reply) => {
    const tenantManager = getTenantManager();
    
    // Fetch plans from database
    const plans = await tenantManager.getPlans();
    
    reply.status(200).send({
      data: plans.map((p) => ({
        id: p.id,
        name: p.name,
        priceMonthly: p.price_monthly,
        priceYearly: p.price_yearly,
        maxDailyEntries: p.max_daily_entries,
        fixedStake: p.fixed_stake,
        fixedTarget: p.fixed_target,
        allowedModes: p.allowed_modes,
        features: p.features,
        isPopular: p.name === 'Pro',
      })),
    });
  });
}