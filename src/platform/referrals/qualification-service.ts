/**
 * Referral qualification — server-authoritative.
 * A referral becomes QUALIFIED only after PAYG-or-higher confirmed subscription,
 * within the campaign qualification window, and anti-abuse checks.
 * Refunds/chargebacks invalidate qualification and reverse dependent rewards.
 */
import { getPool } from '@/persistence/client';
import { getLogger } from '@/observability/logger';
import type { ReferralStatus } from './types';
import {
  issueMilestoneRewardsForReferrer,
  reverseRewardsAfterInvalidation,
} from './reward-service';

const logger = getLogger();

/**
 * Explicit allow-list of qualifying plans (spec §5).
 * Everything else does NOT qualify unless explicitly listed.
 */
const QUALIFYING_PLAN_NAMES = new Set([
  'pay-as-you-go',
  'pay as you go',
  'payg',
  'pay-g',
  'starter',
  'pro',
  'whale',
]);

const NON_QUALIFYING_PLAN_NAMES = new Set([
  'observer',
  'free',
  'free plan',
  '',
]);

export function isQualifyingPlanName(planName: string | null | undefined): boolean {
  if (!planName) return false;
  const n = planName.trim().toLowerCase();
  if (NON_QUALIFYING_PLAN_NAMES.has(n)) return false;
  // Exact / contains match against controlled allow-list only
  for (const allowed of QUALIFYING_PLAN_NAMES) {
    if (n === allowed || n.includes(allowed)) return true;
  }
  return false;
}

async function getActiveCampaignWindow(): Promise<{
  campaignId: string | null;
  windowDays: number;
}> {
  const pool = getPool();
  try {
    const result = await pool.query(
      `SELECT id, qualification_window_days
       FROM referral_campaigns
       WHERE is_active = TRUE
       ORDER BY created_at DESC
       LIMIT 1`
    );
    if (!result.rows[0]) return { campaignId: null, windowDays: 7 };
    return {
      campaignId: String(result.rows[0].id),
      windowDays: Number(result.rows[0].qualification_window_days ?? 7),
    };
  } catch {
    return { campaignId: null, windowDays: 7 };
  }
}

/**
 * Attempt to qualify a referral for the referred user after successful subscription.
 * Enforces: PAYG-or-higher plan, anti-abuse, and attribution within qualification window.
 */
export async function tryQualifyReferral(params: {
  referredUserId: string;
  planId: string;
  planName?: string | null;
}): Promise<{ qualified: boolean; referralId?: string; reason?: string }> {
  const pool = getPool();
  try {
    const planName =
      params.planName ??
      (
        await pool.query(`SELECT name FROM plans WHERE id = $1`, [params.planId])
      ).rows[0]?.name;

    if (!isQualifyingPlanName(planName ? String(planName) : null)) {
      await pool.query(
        `UPDATE referrals SET status = 'SUBSCRIPTION_REQUIRED', updated_at = NOW()
         WHERE referred_id = $1 AND status IN ('PENDING','SUBSCRIPTION_REQUIRED','PAYMENT_PENDING')`,
        [params.referredUserId]
      );
      return { qualified: false, reason: 'plan_not_qualifying' };
    }

    const ref = await pool.query(
      `SELECT id, referrer_id, status, created_at, campaign_id
       FROM referrals WHERE referred_id = $1 LIMIT 1`,
      [params.referredUserId]
    );
    if (!ref.rows[0]) return { qualified: false, reason: 'no_referral' };

    const status = String(ref.rows[0].status) as ReferralStatus;
    if (status === 'QUALIFIED' || status === 'REWARD_COUNTED') {
      return { qualified: true, referralId: String(ref.rows[0].id), reason: 'already_qualified' };
    }
    if (status.startsWith('REJECTED')) {
      return { qualified: false, reason: status };
    }

    // Self-referral guard (should already be blocked at attribution)
    if (String(ref.rows[0].referrer_id) === params.referredUserId) {
      await pool.query(
        `UPDATE referrals SET status = 'REJECTED_SELF_REFERRAL', updated_at = NOW() WHERE id = $1`,
        [ref.rows[0].id]
      );
      return { qualified: false, reason: 'self_referral' };
    }

    // Enforce qualification window at qualification time (not only at milestone count)
    const { windowDays } = await getActiveCampaignWindow();
    const createdAt = new Date(ref.rows[0].created_at as string | Date);
    const windowMs = windowDays * 24 * 60 * 60 * 1000;
    if (Date.now() - createdAt.getTime() > windowMs) {
      await pool.query(
        `UPDATE referrals SET status = 'REJECTED_INVALID', updated_at = NOW() WHERE id = $1`,
        [ref.rows[0].id]
      );
      await pool.query(
        `INSERT INTO referral_events (referral_id, user_id, event_type, payload)
         VALUES ($1, $2, 'rejected_window', $3::jsonb)`,
        [
          ref.rows[0].id,
          params.referredUserId,
          JSON.stringify({ windowDays, createdAt: createdAt.toISOString() }),
        ]
      );
      return { qualified: false, reason: 'outside_qualification_window' };
    }

    await pool.query(
      `UPDATE referrals
       SET status = 'QUALIFIED', qualified_at = NOW(), updated_at = NOW()
       WHERE id = $1`,
      [ref.rows[0].id]
    );

    await pool.query(
      `INSERT INTO referral_events (referral_id, user_id, event_type, payload)
       VALUES ($1, $2, 'qualified', $3::jsonb)`,
      [
        ref.rows[0].id,
        params.referredUserId,
        JSON.stringify({ planId: params.planId, planName }),
      ]
    );

    const referrerId = String(ref.rows[0].referrer_id);
    try {
      await issueMilestoneRewardsForReferrer(referrerId);
    } catch (err) {
      logger.warn(
        { err, referrerId, component: 'ReferralQualification' },
        'Reward issuance failed after qualification'
      );
    }

    logger.info(
      { component: 'ReferralQualification', referredUserId: params.referredUserId, referrerId },
      'Referral qualified'
    );

    return { qualified: true, referralId: String(ref.rows[0].id) };
  } catch (err) {
    logger.warn({ err, component: 'ReferralQualification' }, 'tryQualifyReferral failed');
    return { qualified: false, reason: err instanceof Error ? err.message : 'error' };
  }
}

/**
 * Invalidate qualification after refund or chargeback and reverse dependent rewards.
 */
export async function invalidateReferralForPaymentFailure(params: {
  referredUserId: string;
  reason: 'REJECTED_REFUND' | 'REJECTED_CHARGEBACK';
}): Promise<{ invalidated: boolean; rewardsReversed: number }> {
  const pool = getPool();
  try {
    const result = await pool.query(
      `UPDATE referrals
       SET status = $2, updated_at = NOW(), qualified_at = NULL
       WHERE referred_id = $1 AND status IN ('QUALIFIED','REWARD_COUNTED','PAYMENT_PENDING')
       RETURNING id, referrer_id`,
      [params.referredUserId, params.reason]
    );
    if (!result.rows[0]) return { invalidated: false, rewardsReversed: 0 };

    await pool.query(
      `INSERT INTO referral_events (referral_id, user_id, event_type, payload)
       VALUES ($1, $2, 'invalidated', $3::jsonb)`,
      [result.rows[0].id, params.referredUserId, JSON.stringify({ reason: params.reason })]
    );

    const referrerId = String(result.rows[0].referrer_id);
    let rewardsReversed = 0;
    try {
      const rev = await reverseRewardsAfterInvalidation({
        referrerId,
        reason: params.reason,
        sourceReferralId: String(result.rows[0].id),
      });
      rewardsReversed = rev.reversed;
    } catch (err) {
      logger.warn(
        { err, referrerId, component: 'ReferralQualification' },
        'Reward reversal after invalidation failed — admin review required'
      );
    }

    logger.info(
      {
        component: 'ReferralQualification',
        referredUserId: params.referredUserId,
        reason: params.reason,
        rewardsReversed,
      },
      'Referral invalidated'
    );
    return { invalidated: true, rewardsReversed };
  } catch (err) {
    logger.warn({ err, component: 'ReferralQualification' }, 'invalidate failed');
    return { invalidated: false, rewardsReversed: 0 };
  }
}

export async function markPaymentPending(referredUserId: string): Promise<void> {
  const pool = getPool();
  try {
    await pool.query(
      `UPDATE referrals SET status = 'PAYMENT_PENDING', updated_at = NOW()
       WHERE referred_id = $1 AND status IN ('PENDING','SUBSCRIPTION_REQUIRED')`,
      [referredUserId]
    );
  } catch {
    /* ignore */
  }
}
