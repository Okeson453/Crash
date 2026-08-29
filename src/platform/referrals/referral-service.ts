import { randomBytes } from 'node:crypto';
import { getPool } from '@/persistence/client';
import {
  formatRewardPreview,
  nextMilestone,
  normalizePlanName,
} from './milestone-rewards';
import type {
  ReferralActivityView,
  ReferralAdminOverview,
  ReferralProgressView,
  ReferralStatus,
} from './types';

function codeFromUserId(userId: string): string {
  const suffix = userId.replace(/-/g, '').slice(0, 8).toUpperCase();
  return `CW-${suffix}`;
}

async function ensureReferralCode(userId: string): Promise<string> {
  const pool = getPool();
  const existing = await pool.query(
    `SELECT code FROM referral_codes WHERE user_id = $1 LIMIT 1`,
    [userId]
  );
  if (existing.rows[0]?.code) return String(existing.rows[0].code);

  const code = codeFromUserId(userId);
  try {
    await pool.query(
      `INSERT INTO referral_codes (user_id, code) VALUES ($1, $2)
       ON CONFLICT (user_id) DO NOTHING`,
      [userId, code]
    );
  } catch {
    // table may not exist yet in some environments
    return code;
  }
  const again = await pool.query(`SELECT code FROM referral_codes WHERE user_id = $1`, [userId]);
  return String(again.rows[0]?.code ?? code);
}

export async function getReferralProgress(
  userId: string,
  planName: string | null,
  baseUrl?: string
): Promise<ReferralProgressView> {
  const pool = getPool();
  const plan = normalizePlanName(planName);
  let qualifiedCount = 0;
  let pendingCount = 0;
  let campaignEndsAt: string | null = null;
  const maxMilestone = 20;

  try {
    const counts = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE status IN ('QUALIFIED','REWARD_COUNTED'))::int AS qualified,
         COUNT(*) FILTER (WHERE status IN ('PENDING','SUBSCRIPTION_REQUIRED','PAYMENT_PENDING'))::int AS pending
       FROM referrals WHERE referrer_id = $1`,
      [userId]
    );
    qualifiedCount = Number(counts.rows[0]?.qualified ?? 0);
    pendingCount = Number(counts.rows[0]?.pending ?? 0);

    const campaign = await pool.query(
      `SELECT ends_at FROM referral_campaigns WHERE is_active = TRUE ORDER BY created_at DESC LIMIT 1`
    );
    if (campaign.rows[0]?.ends_at) {
      campaignEndsAt = new Date(campaign.rows[0].ends_at as string).toISOString();
    }
  } catch {
    // migrations not applied — return empty progress with code
  }

  const code = await ensureReferralCode(userId).catch(() => codeFromUserId(userId));
  const next = nextMilestone(qualifiedCount);
  const preview = next != null ? formatRewardPreview(plan, next) : null;
  const linkBase = baseUrl || process.env.MINI_APP_PUBLIC_URL || process.env.PUBLIC_APP_URL || '';
  const referralLink = linkBase
    ? `${linkBase.replace(/\/$/, '')}/?ref=${encodeURIComponent(code)}`
    : `https://t.me/share?url=${encodeURIComponent(code)}`;

  return {
    qualifiedCount,
    maxMilestone,
    nextMilestone: next,
    nextRewardPreview: preview,
    referralCode: code,
    referralLink,
    pendingCount,
    campaignEndsAt,
  };
}

export async function getReferralActivity(userId: string): Promise<ReferralActivityView[]> {
  const pool = getPool();
  try {
    const result = await pool.query(
      `SELECT r.id, r.status, r.created_at, u.telegram_username
       FROM referrals r
       LEFT JOIN users u ON u.id = r.referred_id
       WHERE r.referrer_id = $1
       ORDER BY r.created_at DESC
       LIMIT 50`,
      [userId]
    );
    return result.rows.map((row) => ({
      id: String(row.id),
      status: String(row.status) as ReferralStatus,
      referredUsername: row.telegram_username ? String(row.telegram_username) : null,
      createdAt: new Date(row.created_at as string | Date).toISOString(),
    }));
  } catch {
    return [];
  }
}

export async function getAdminReferralOverview(): Promise<ReferralAdminOverview> {
  const pool = getPool();
  const empty: ReferralAdminOverview = {
    totalReferrals: 0,
    qualifiedReferrals: 0,
    pendingReferrals: 0,
    conversionRate: 0,
    rewardsIssued: 0,
    rewardsPending: 0,
    rewardsExpired: 0,
    rewardsRevoked: 0,
    topReferrers: [],
  };

  try {
    const stats = await pool.query(
      `SELECT
         COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE status IN ('QUALIFIED','REWARD_COUNTED'))::int AS qualified,
         COUNT(*) FILTER (WHERE status IN ('PENDING','SUBSCRIPTION_REQUIRED','PAYMENT_PENDING'))::int AS pending
       FROM referrals`
    );
    const total = Number(stats.rows[0]?.total ?? 0);
    const qualified = Number(stats.rows[0]?.qualified ?? 0);
    const pending = Number(stats.rows[0]?.pending ?? 0);

    let rewardsIssued = 0;
    let rewardsPending = 0;
    let rewardsExpired = 0;
    let rewardsRevoked = 0;
    try {
      const rewards = await pool.query(
        `SELECT
           COUNT(*) FILTER (WHERE status IN ('issued','activated'))::int AS issued,
           COUNT(*) FILTER (WHERE status = 'issued')::int AS pending,
           COUNT(*) FILTER (WHERE status = 'expired')::int AS expired,
           COUNT(*) FILTER (WHERE status = 'revoked')::int AS revoked
         FROM referral_reward_ledger`
      );
      rewardsIssued = Number(rewards.rows[0]?.issued ?? 0);
      rewardsPending = Number(rewards.rows[0]?.pending ?? 0);
      rewardsExpired = Number(rewards.rows[0]?.expired ?? 0);
      rewardsRevoked = Number(rewards.rows[0]?.revoked ?? 0);
    } catch {
      /* ledger may be empty */
    }

    const top = await pool.query(
      `SELECT r.referrer_id AS user_id, u.telegram_username AS username,
              COUNT(*) FILTER (WHERE r.status IN ('QUALIFIED','REWARD_COUNTED'))::int AS qualified_count
       FROM referrals r
       LEFT JOIN users u ON u.id = r.referrer_id
       GROUP BY r.referrer_id, u.telegram_username
       ORDER BY qualified_count DESC
       LIMIT 10`
    );

    return {
      totalReferrals: total,
      qualifiedReferrals: qualified,
      pendingReferrals: pending,
      conversionRate: total > 0 ? qualified / total : 0,
      rewardsIssued,
      rewardsPending,
      rewardsExpired,
      rewardsRevoked,
      topReferrers: top.rows.map((row) => ({
        userId: String(row.user_id),
        username: row.username ? String(row.username) : undefined,
        qualifiedCount: Number(row.qualified_count ?? 0),
      })),
    };
  } catch {
    return empty;
  }
}

/**
 * Attribute a new user to a referrer by code. Server-authoritative.
 * Does not qualify — only records PENDING / SUBSCRIPTION_REQUIRED.
 */
export async function attributeReferral(params: {
  referredUserId: string;
  code: string;
}): Promise<{ ok: boolean; reason?: string }> {
  const pool = getPool();
  const code = params.code.trim().toUpperCase();
  if (!code) return { ok: false, reason: 'invalid_code' };

  try {
    const codeRow = await pool.query(
      `SELECT id, user_id FROM referral_codes WHERE UPPER(code) = $1 LIMIT 1`,
      [code]
    );
    if (!codeRow.rows[0]) return { ok: false, reason: 'code_not_found' };
    const referrerId = String(codeRow.rows[0].user_id);
    const codeId = String(codeRow.rows[0].id);

    if (referrerId === params.referredUserId) {
      return { ok: false, reason: 'self_referral' };
    }

    const existing = await pool.query(
      `SELECT id FROM referrals WHERE referred_id = $1 LIMIT 1`,
      [params.referredUserId]
    );
    if (existing.rows[0]) return { ok: false, reason: 'already_attributed' };

    const campaign = await pool.query(
      `SELECT id FROM referral_campaigns WHERE is_active = TRUE ORDER BY created_at DESC LIMIT 1`
    );
    const campaignId = campaign.rows[0]?.id ? String(campaign.rows[0].id) : null;

    await pool.query(
      `INSERT INTO referrals (referrer_id, referred_id, referral_code_id, campaign_id, status)
       VALUES ($1, $2, $3, $4, 'SUBSCRIPTION_REQUIRED')`,
      [referrerId, params.referredUserId, codeId, campaignId]
    );

    await pool.query(
      `INSERT INTO referral_events (referral_id, user_id, event_type, payload)
       SELECT id, $2, 'attributed', $3::jsonb FROM referrals WHERE referred_id = $2 LIMIT 1`,
      [params.referredUserId, params.referredUserId, JSON.stringify({ code, referrerId })]
    );

    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : 'error' };
  }
}

/** Generate a one-time random code fragment (unused helper for future campaigns). */
export function generateRandomCode(): string {
  return `CW-${randomBytes(4).toString('hex').toUpperCase()}`;
}
