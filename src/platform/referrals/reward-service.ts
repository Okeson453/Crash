/**
 * Referral reward ledger — promotional entitlements only (not withdrawable cash).
 * Tenant-scoped, idempotent milestones, configurable expiry, deterministic reversal.
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
const DEFAULT_WINDOW_DAYS = 7;

export async function countQualifiedInWindow(
  referrerId: string,
  windowDays = DEFAULT_WINDOW_DAYS
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

async function activeCampaignConfig(): Promise<{
  campaignId: string | null;
  windowDays: number;
  rewardExpiryDays: number;
}> {
  const pool = getPool();
  try {
    const result = await pool.query(
      `SELECT id, qualification_window_days,
              COALESCE(reward_expiry_days, $1) AS reward_expiry_days
       FROM referral_campaigns
       WHERE is_active = TRUE
       ORDER BY created_at DESC
       LIMIT 1`,
      [DEFAULT_REWARD_EXPIRY_DAYS]
    );
    if (!result.rows[0]) {
      return {
        campaignId: null,
        windowDays: DEFAULT_WINDOW_DAYS,
        rewardExpiryDays: DEFAULT_REWARD_EXPIRY_DAYS,
      };
    }
    return {
      campaignId: String(result.rows[0].id),
      windowDays: Number(result.rows[0].qualification_window_days ?? DEFAULT_WINDOW_DAYS),
      rewardExpiryDays: Number(result.rows[0].reward_expiry_days ?? DEFAULT_REWARD_EXPIRY_DAYS),
    };
  } catch {
    return {
      campaignId: null,
      windowDays: DEFAULT_WINDOW_DAYS,
      rewardExpiryDays: DEFAULT_REWARD_EXPIRY_DAYS,
    };
  }
}

/**
 * Issue any newly reached milestones for the referrer into the reward ledger.
 * Incremental: each milestone issued at most once per campaign.
 * tenant_id is set to the personal tenant (user_id) for isolation.
 */
export async function issueMilestoneRewardsForReferrer(referrerId: string): Promise<{
  issued: number[];
}> {
  const pool = getPool();
  const issued: number[] = [];

  try {
    const campaign = await activeCampaignConfig();
    const qualifiedCount = await countQualifiedInWindow(referrerId, campaign.windowDays);
    const plan = await resolveReferrerPlan(referrerId);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + campaign.rewardExpiryDays);

    for (const milestone of listMilestones()) {
      if (qualifiedCount < milestone) continue;

      const reward = rewardForMilestone(plan, milestone);
      if (!reward) continue;

      try {
        const insert = await pool.query(
          `INSERT INTO referral_reward_ledger (
             user_id, tenant_id, campaign_id, milestone, reward_type, quantity,
             entries_quantity, hours_quantity, issued_at, activated_at, expires_at,
             status, source_event
           ) VALUES (
             $1, $1, $2, $3, $4, $5,
             $6, $7, NOW(), NOW(), $8,
             'activated', 'milestone_reached'
           )
           ON CONFLICT (user_id, campaign_id, milestone) DO NOTHING
           RETURNING id, milestone`,
          [
            referrerId,
            campaign.campaignId,
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
                tenantId: referrerId,
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

    // Mark qualified referrals as REWARD_COUNTED when any milestone issued
    if (issued.length > 0) {
      await pool.query(
        `UPDATE referrals SET status = 'REWARD_COUNTED', updated_at = NOW()
         WHERE referrer_id = $1 AND status = 'QUALIFIED'
           AND qualified_at >= NOW() - ($2 || ' days')::interval`,
        [referrerId, String(campaign.windowDays)]
      );
      try {
        await refreshPromotionalEntitlements(referrerId);
      } catch {
        /* best-effort */
      }
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

/**
 * After a referral is invalidated (refund/chargeback), recalculate valid qualified
 * count and revoke any milestone rewards that are no longer earned.
 */
export async function reverseRewardsAfterInvalidation(params: {
  referrerId: string;
  reason: string;
  sourceReferralId: string;
}): Promise<{ reversed: number }> {
  const pool = getPool();
  let reversed = 0;

  try {
    const campaign = await activeCampaignConfig();
    const stillQualified = await countQualifiedInWindow(params.referrerId, campaign.windowDays);

    // Find activated/issued rewards whose milestone is no longer reached
    const ledger = await pool.query(
      `SELECT id, milestone, entries_quantity, hours_quantity, entries_used, hours_used
       FROM referral_reward_ledger
       WHERE user_id = $1
         AND status IN ('issued','activated')
         AND (campaign_id IS NULL OR campaign_id = $2 OR $2 IS NULL)
       ORDER BY milestone DESC`,
      [params.referrerId, campaign.campaignId]
    );

    for (const row of ledger.rows) {
      const milestone = Number(row.milestone);
      if (stillQualified >= milestone) continue;

      // Milestone no longer earned — revoke
      const upd = await pool.query(
        `UPDATE referral_reward_ledger
         SET status = 'revoked',
             audit_reference = COALESCE(audit_reference, '') || $2
         WHERE id = $1 AND status IN ('issued','activated')
         RETURNING id`,
        [
          row.id,
          `|reversed:${params.reason}:referral:${params.sourceReferralId}:at:${new Date().toISOString()}`,
        ]
      );
      if (upd.rows[0]) {
        reversed += 1;
        await pool.query(
          `INSERT INTO referral_events (user_id, event_type, payload)
           VALUES ($1, 'reward_reversed', $2::jsonb)`,
          [
            params.referrerId,
            JSON.stringify({
              rewardId: row.id,
              milestone,
              reason: params.reason,
              sourceReferralId: params.sourceReferralId,
              stillQualified,
            }),
          ]
        );
      }
    }

    // Demote REWARD_COUNTED back to QUALIFIED when count still > 0 but some rewards revoked
    if (stillQualified > 0) {
      await pool.query(
        `UPDATE referrals SET status = 'QUALIFIED', updated_at = NOW()
         WHERE referrer_id = $1 AND status = 'REWARD_COUNTED'
           AND qualified_at IS NOT NULL`,
        [params.referrerId]
      );
    }

    await refreshPromotionalEntitlements(params.referrerId);

    if (reversed > 0) {
      logger.info(
        {
          component: 'ReferralRewards',
          referrerId: params.referrerId,
          reversed,
          stillQualified,
        },
        'Rewards reversed after invalidation'
      );
    }
  } catch (err) {
    logger.warn(
      { err, referrerId: params.referrerId, component: 'ReferralRewards' },
      'reverseRewardsAfterInvalidation failed'
    );
  }

  return { reversed };
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
       RETURNING id, user_id`
    );
    const userIds = new Set(
      (result.rows as Array<{ user_id: string }>).map((r) => String(r.user_id))
    );
    for (const uid of userIds) {
      try {
        await refreshPromotionalEntitlements(uid);
      } catch {
        /* best-effort */
      }
    }
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
    try {
      await refreshPromotionalEntitlements(String(result.rows[0].user_id));
    } catch {
      /* best-effort */
    }
    return true;
  } catch {
    return false;
  }
}

export interface UserRewardView {
  id: string;
  milestone: number;
  rewardType: string;
  entriesQuantity: number;
  hoursQuantity: number;
  entriesUsed: number;
  hoursUsed: number;
  status: string;
  issuedAt: string;
  expiresAt: string | null;
  tenantId?: string | null;
}

export async function listUserRewards(userId: string): Promise<UserRewardView[]> {
  const pool = getPool();
  try {
    const result = await pool.query(
      `SELECT id, milestone, reward_type, entries_quantity, hours_quantity,
              COALESCE(entries_used, 0) AS entries_used, COALESCE(hours_used, 0) AS hours_used,
              status, issued_at, expires_at, tenant_id
       FROM referral_reward_ledger
       WHERE user_id = $1
       ORDER BY issued_at DESC
       LIMIT 50`,
      [userId]
    );
    return result.rows.map((row) => ({
      id: String(row.id),
      milestone: Number(row.milestone),
      rewardType: String(row.reward_type),
      entriesQuantity: Number(row.entries_quantity ?? 0),
      hoursQuantity: Number(row.hours_quantity ?? 0),
      entriesUsed: Number(row.entries_used ?? 0),
      hoursUsed: Number(row.hours_used ?? 0),
      status: String(row.status),
      issuedAt: new Date(row.issued_at as string | Date).toISOString(),
      expiresAt: row.expires_at ? new Date(row.expires_at as string | Date).toISOString() : null,
      tenantId: row.tenant_id ? String(row.tenant_id) : null,
    }));
  } catch {
    return [];
  }
}

/**
 * Remaining promotional entitlements for a user (sum of activated, non-expired rewards).
 */
export async function getAvailableEntitlements(userId: string): Promise<{
  bonusEntries: number;
  bonusHours: number;
}> {
  const pool = getPool();
  try {
    const result = await pool.query(
      `SELECT
         COALESCE(SUM(GREATEST(entries_quantity - COALESCE(entries_used, 0), 0)), 0)::int AS entries,
         COALESCE(SUM(GREATEST(hours_quantity - COALESCE(hours_used, 0), 0)), 0)::float AS hours
       FROM referral_reward_ledger
       WHERE user_id = $1
         AND status = 'activated'
         AND (expires_at IS NULL OR expires_at > NOW())`,
      [userId]
    );
    return {
      bonusEntries: Number(result.rows[0]?.entries ?? 0),
      bonusHours: Number(result.rows[0]?.hours ?? 0),
    };
  } catch {
    return { bonusEntries: 0, bonusHours: 0 };
  }
}

/**
 * Consume bonus entries for a game play. FIFO by expires_at.
 */
export async function consumeBonusEntries(
  userId: string,
  count = 1,
  client?: { query: (sql: string, params?: unknown[]) => Promise<{ rowCount: number | null; rows: unknown[] }> }
): Promise<boolean> {
  if (count <= 0) return true;
  const q = client ?? getPool();
  let remaining = count;

  const rows = await q.query(
    `SELECT id, entries_quantity, COALESCE(entries_used, 0) AS entries_used
     FROM referral_reward_ledger
     WHERE user_id = $1
       AND status = 'activated'
       AND (expires_at IS NULL OR expires_at > NOW())
       AND entries_quantity > COALESCE(entries_used, 0)
     ORDER BY expires_at NULLS LAST, issued_at ASC
     FOR UPDATE`,
    [userId]
  );

  for (const row of rows.rows as Array<{ id: string; entries_quantity: number; entries_used: number }>) {
    if (remaining <= 0) break;
    const available = Number(row.entries_quantity) - Number(row.entries_used);
    if (available <= 0) continue;
    const take = Math.min(available, remaining);
    await q.query(
      `UPDATE referral_reward_ledger
       SET entries_used = COALESCE(entries_used, 0) + $2
       WHERE id = $1`,
      [row.id, take]
    );
    remaining -= take;
  }

  return remaining === 0;
}

export async function refreshPromotionalEntitlements(userId: string): Promise<void> {
  const pool = getPool();
  const avail = await getAvailableEntitlements(userId);
  try {
    await pool.query(
      `INSERT INTO user_promotional_entitlements (user_id, bonus_entries, bonus_hours, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (user_id) DO UPDATE SET
         bonus_entries = EXCLUDED.bonus_entries,
         bonus_hours = EXCLUDED.bonus_hours,
         updated_at = NOW()`,
      [userId, avail.bonusEntries, avail.bonusHours]
    );
  } catch {
    /* table may not exist yet before migration */
  }
}
