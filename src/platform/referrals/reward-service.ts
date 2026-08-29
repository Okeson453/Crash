/**
 * Referral reward ledger — promotional entitlements only (not withdrawable cash).
 */
import { getPool } from '@/persistence/client';
import { getLogger } from '@/observability/logger';
import {
  listMilestones,
  normalizePlanName,
  rewardForMilestone,
} from './milestone-rewards';
import type { ReferrerPlan } from './types';

const logger = getLogger();

const DEFAULT_REWARD_EXPIRY_DAYS = 30;

export async function countQualifiedInWindow(
  referrerId: string,
  windowDays = 7
): Promise<number> {
  const pool = getPool();
  const result = await pool.query(
    `SELECT COUNT(*)::int AS c
     FROM referrals
     WHERE referrer_id = $1
       AND status IN ('QUALIFIED','REWARD_COUNTED')
       AND qualified_at >= NOW() - ($2 || ' days')::interval`,
    [referrerId, String(windowDays)]
  );
  return Number(result.rows[0]?.c ?? 0);
}

async function resolveReferrerPlan(referrerId: string): Promise<ReferrerPlan> {
  const pool = getPool();
  const result = await pool.query(
    `SELECT p.name AS plan_name
     FROM users u
     LEFT JOIN plans p ON p.id = u.plan_id
     WHERE u.id = $1`,
    [referrerId]
  );
  return normalizePlanName(result.rows[0]?.plan_name ? String(result.rows[0].plan_name) : null);
}

async function activeCampaignId(): Promise<string | null> {
  const pool = getPool();
  const result = await pool.query(
    `SELECT id FROM referral_campaigns WHERE is_active = TRUE ORDER BY created_at DESC LIMIT 1`
  );
  return result.rows[0]?.id ? String(result.rows[0].id) : null;
}

/**
 * Issue any newly reached milestones for the referrer into the reward ledger.
 * Incremental: each milestone issued at most once per campaign.
 */
export async function issueMilestoneRewardsForReferrer(referrerId: string): Promise<{
  issued: number[];
}> {
  const pool = getPool();
  const issued: number[] = [];

  try {
    const campaignId = await activeCampaignId();
    const windowDays = 7;
    const qualifiedCount = await countQualifiedInWindow(referrerId, windowDays);
    const plan = await resolveReferrerPlan(referrerId);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + DEFAULT_REWARD_EXPIRY_DAYS);

    for (const milestone of listMilestones()) {
      if (qualifiedCount < milestone) continue;

      const reward = rewardForMilestone(plan, milestone);
      if (!reward) continue;

      try {
        const insert = await pool.query(
          `INSERT INTO referral_reward_ledger (
             user_id, campaign_id, milestone, reward_type, quantity,
             entries_quantity, hours_quantity, issued_at, activated_at, expires_at,
             status, source_event
           ) VALUES (
             $1, $2, $3, $4, $5,
             $6, $7, NOW(), NOW(), $8,
             'activated', 'milestone_reached'
           )
           ON CONFLICT (user_id, campaign_id, milestone) DO NOTHING
           RETURNING id, milestone`,
          [
            referrerId,
            campaignId,
            milestone,
            reward.rewardType,
            reward.entries + reward.hours,
            reward.entries,
            reward.hours,
            expiresAt.toISOString(),
          ]
        );

        if (insert.rows[0]) {
          issued.push(milestone);
          await pool.query(
            `INSERT INTO referral_events (user_id, event_type, payload)
             VALUES ($1, 'reward_issued', $2::jsonb)`,
            [
              referrerId,
              JSON.stringify({
                milestone,
                entries: reward.entries,
                hours: reward.hours,
                ledgerId: insert.rows[0].id,
              }),
            ]
          );
        }
      } catch (err) {
        logger.warn(
          { err, referrerId, milestone, component: 'ReferralRewards' },
          'Failed to insert reward ledger row'
        );
      }
    }

    // Mark qualified referrals as REWARD_COUNTED when max milestone fully paid
    if (issued.length > 0) {
      await pool.query(
        `UPDATE referrals SET status = 'REWARD_COUNTED', updated_at = NOW()
         WHERE referrer_id = $1 AND status = 'QUALIFIED'
           AND qualified_at >= NOW() - ($2 || ' days')::interval`,
        [referrerId, String(windowDays)]
      );
    }

    if (issued.length) {
      logger.info(
        { component: 'ReferralRewards', referrerId, issued },
        'Milestone rewards issued'
      );
    }
  } catch (err) {
    logger.warn({ err, referrerId, component: 'ReferralRewards' }, 'issueMilestoneRewards failed');
  }

  return { issued };
}

export async function expireDueRewards(): Promise<number> {
  const pool = getPool();
  try {
    const result = await pool.query(
      `UPDATE referral_reward_ledger
       SET status = 'expired'
       WHERE status IN ('issued','activated')
         AND expires_at IS NOT NULL
         AND expires_at < NOW()
       RETURNING id`
    );
    return result.rowCount ?? 0;
  } catch {
    return 0;
  }
}

export async function revokeReward(params: {
  rewardId: string;
  actorId: string;
  reason: string;
}): Promise<boolean> {
  const pool = getPool();
  try {
    const result = await pool.query(
      `UPDATE referral_reward_ledger
       SET status = 'revoked', audit_reference = $2
       WHERE id = $1 AND status IN ('issued','activated')
       RETURNING id, user_id`,
      [params.rewardId, `revoked_by:${params.actorId}:${params.reason}`]
    );
    if (!result.rows[0]) return false;
    await pool.query(
      `INSERT INTO referral_events (user_id, event_type, payload)
       VALUES ($1, 'reward_revoked', $2::jsonb)`,
      [
        result.rows[0].user_id,
        JSON.stringify({ rewardId: params.rewardId, reason: params.reason, actorId: params.actorId }),
      ]
    );
    return true;
  } catch {
    return false;
  }
}
