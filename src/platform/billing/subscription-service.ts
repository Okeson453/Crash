/**
 * SubscriptionService — full subscription lifecycle.
 */

import { getPool } from '../../persistence/client.js';
import { getLogger } from '../../observability/logger.js';
import { TenantManager } from '../tenant-manager.js';
import { createContainerOrchestrator, ContainerOrchestrator } from '../container-orchestrator.js';
import { SubscriptionStatus } from '../types.js';
import { tryQualifyReferral } from '../referrals/qualification-service.js';
import { invalidateReferralForPaymentFailure } from '../referrals/qualification-service.js';

export interface Subscription {
  id: string;
  userId: string;
  planId: string;
  status: SubscriptionStatus;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  paymentProvider: string;
  paymentProviderSubscriptionId: string | null;
}

export class SubscriptionService {
  private readonly logger = getLogger();
  private readonly tenants = new TenantManager();
  private orchestrator: ContainerOrchestrator | null = null;

  private async orch(): Promise<ContainerOrchestrator> {
    if (!this.orchestrator) this.orchestrator = await createContainerOrchestrator();
    return this.orchestrator;
  }

  async activate(params: {
    userId: string;
    planId: string;
    providerSubscriptionId?: string;
    periodDays?: number;
  }): Promise<Subscription> {
    const periodDays = params.periodDays ?? 30;
    const client = await getPool().connect();
    let row: Record<string, unknown>;
    try {
      await client.query('BEGIN');
      const existing = await client.query(
        `SELECT * FROM subscriptions WHERE user_id = $1 AND status IN ('active','trialing','past_due') FOR UPDATE`,
        [params.userId],
      );
      if (existing.rowCount) {
        await client.query('COMMIT');
        return this.rowToSub(existing.rows[0]);
      }
      const result = await client.query(
        `INSERT INTO subscriptions (user_id, plan_id, status, current_period_start, current_period_end, payment_provider, payment_provider_subscription_id)
         VALUES ($1, $2, 'active', NOW(), NOW() + ($3 || ' days')::INTERVAL, 'stripe', $4) RETURNING *`,
        [params.userId, params.planId, String(periodDays), params.providerSubscriptionId ?? null],
      );
      row = result.rows[0];
      await client.query(
        `UPDATE users SET plan_id = $1, status = 'active', updated_at = NOW() WHERE id = $2`,
        [params.planId, params.userId],
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    const plan = await this.tenants.getPlan(params.planId);
    if (plan) {
      void this.orch().then((orch) => orch.provision(params.userId, {
        FIXED_STAKE: String(plan.fixedStake), FIXED_TARGET: String(plan.fixedTarget),
        MAX_DAILY_ENTRIES: String(plan.maxDailyEntries), MODE: 'observe-only',
      })).catch((error) => this.logger.error({ component: 'SubscriptionService', userId: params.userId, error: String(error) }, 'Async tenant provisioning failed'));
    }

    await this.tenants.audit({ actorType: 'billing', action: 'subscription.activated', targetUserId: params.userId, payload: { planId: params.planId } });
    try {
      const plan = await this.tenants.getPlan(params.planId);
      await tryQualifyReferral({
        referredUserId: params.userId,
        planId: params.planId,
        planName: plan?.name ?? null,
      });
    } catch (err) {
      this.logger.warn({ err, userId: params.userId }, 'Referral qualification hook failed');
    }
    return this.rowToSub(row);
  }


  /** Invalidate referral qualification when a qualifying payment is refunded. */
  async handlePaymentRefund(userId: string): Promise<void> {
    await invalidateReferralForPaymentFailure({
      referredUserId: userId,
      reason: 'REJECTED_REFUND',
    });
    await this.tenants.audit({
      actorType: 'billing',
      action: 'subscription.refund_referral_invalidated',
      targetUserId: userId,
    });
  }

  /** Invalidate referral qualification on chargeback. */
  async handleChargeback(userId: string): Promise<void> {
    await invalidateReferralForPaymentFailure({
      referredUserId: userId,
      reason: 'REJECTED_CHARGEBACK',
    });
    await this.tenants.audit({
      actorType: 'billing',
      action: 'subscription.chargeback_referral_invalidated',
      targetUserId: userId,
    });
  }

  async markPastDue(providerSubscriptionId: string): Promise<void> {
    const result = await getPool().query(
      `UPDATE subscriptions SET status = 'past_due', updated_at = NOW()
       WHERE payment_provider_subscription_id = $1
       RETURNING user_id`,
      [providerSubscriptionId]
    );
    for (const row of result.rows) {
      const userId = String(row.user_id);
      const orch = await this.orch();
      await orch.pause(userId);
      await this.tenants.audit({
        actorType: 'billing',
        action: 'subscription.past_due',
        targetUserId: userId,
      });
    }
  }

  async cancel(userId: string, atPeriodEnd = true): Promise<void> {
    if (atPeriodEnd) {
      await getPool().query(
        `UPDATE subscriptions SET cancel_at_period_end = true, updated_at = NOW()
         WHERE user_id = $1 AND status = 'active'`,
        [userId]
      );
    } else {
      await getPool().query(
        `UPDATE subscriptions SET status = 'cancelled', updated_at = NOW()
         WHERE user_id = $1`,
        [userId]
      );
      await this.tenants.updateUserStatus(userId, 'cancelled');
      const orch = await this.orch();
      await orch.destroy(userId);
    }
    await this.tenants.audit({
      actorType: 'billing',
      action: atPeriodEnd ? 'subscription.cancel_scheduled' : 'subscription.cancelled',
      targetUserId: userId,
    });
  }

  async expireDueSubscriptions(): Promise<number> {
    const result = await getPool().query(
      `UPDATE subscriptions SET status = 'expired', updated_at = NOW()
       WHERE status IN ('active', 'past_due', 'cancelled')
         AND cancel_at_period_end = true
         AND current_period_end < NOW()
       RETURNING user_id`
    );
    const orch = await this.orch();
    for (const row of result.rows) {
      const userId = String(row.user_id);
      await this.tenants.updateUserStatus(userId, 'cancelled');
      await orch.destroy(userId);
    }
    return result.rows.length;
  }

  async getActiveForUser(userId: string): Promise<Subscription | null> {
    const result = await getPool().query(
      `SELECT * FROM subscriptions
       WHERE user_id = $1 AND status IN ('active', 'trialing', 'past_due')
       ORDER BY created_at DESC LIMIT 1`,
      [userId]
    );
    if (result.rows.length === 0) return null;
    return this.rowToSub(result.rows[0]);
  }

  private rowToSub(row: Record<string, unknown>): Subscription {
    return {
      id: String(row.id),
      userId: String(row.user_id),
      planId: String(row.plan_id),
      status: row.status as SubscriptionStatus,
      currentPeriodStart: (row.current_period_start as Date) ?? null,
      currentPeriodEnd: (row.current_period_end as Date) ?? null,
      cancelAtPeriodEnd: Boolean(row.cancel_at_period_end),
      paymentProvider: String(row.payment_provider ?? 'stripe'),
      paymentProviderSubscriptionId: (row.payment_provider_subscription_id as string) ?? null,
    };
  }
}
