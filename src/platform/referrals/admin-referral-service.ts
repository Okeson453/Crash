/**
 * Admin referral: campaigns, rules snapshot, fraud signals.
 */
import { getPool } from '@/persistence/client';

export interface ReferralCampaignRow {
  id: string;
  name: string;
  qualificationWindowDays: number;
  maxMilestone: number;
  milestones: number[];
  isActive: boolean;
  startsAt: string;
  endsAt: string | null;
  minPlan: string;
  notes: string | null;
  rewardExpiryDays: number;
  createdAt: string;
}

export interface FraudSignal {
  id: string;
  type: 'self_referral' | 'duplicate_referred' | 'rejected_fraud' | 'high_velocity' | 'rejected_refund';
  severity: 'low' | 'medium' | 'high';
  message: string;
  referrerId?: string;
  referredId?: string;
  count?: number;
  createdAt: string;
}

export async function listCampaigns(): Promise<ReferralCampaignRow[]> {
  const pool = getPool();
  try {
    const result = await pool.query(
      `SELECT id, name, qualification_window_days, max_milestone, milestones, is_active,
              starts_at, ends_at, COALESCE(min_plan, 'payg') AS min_plan, notes,
              COALESCE(reward_expiry_days, 30) AS reward_expiry_days, created_at
       FROM referral_campaigns
       ORDER BY created_at DESC
       LIMIT 50`
    );
    return result.rows.map(mapCampaign);
  } catch {
    return [];
  }
}

export async function createCampaign(input: {
  name: string;
  qualificationWindowDays?: number;
  maxMilestone?: number;
  milestones?: number[];
  minPlan?: string;
  notes?: string;
  endsAt?: string | null;
  startsAt?: string | null;
  rewardExpiryDays?: number;
}): Promise<ReferralCampaignRow | null> {
  const pool = getPool();
  try {
    // Deactivate others if activating new default
    const result = await pool.query(
      `INSERT INTO referral_campaigns (
         name, qualification_window_days, max_milestone, milestones, is_active, min_plan, notes, ends_at, starts_at, reward_expiry_days
       ) VALUES ($1, $2, $3, $4, TRUE, $5, $6, $7, COALESCE($8, NOW()), $9)
       RETURNING id, name, qualification_window_days, max_milestone, milestones, is_active,
                 starts_at, ends_at, COALESCE(min_plan, 'payg') AS min_plan, notes,
                 COALESCE(reward_expiry_days, 30) AS reward_expiry_days, created_at`,
      [
        input.name,
        input.qualificationWindowDays ?? 7,
        input.maxMilestone ?? 20,
        input.milestones ?? [5, 10, 15, 20],
        input.minPlan ?? 'payg',
        input.notes ?? null,
        input.endsAt ?? null,
        input.startsAt ?? null,
        input.rewardExpiryDays ?? 30,
      ]
    );
    // Keep only newest active optional — leave multiple active allowed; admin can deactivate
    return result.rows[0] ? mapCampaign(result.rows[0]) : null;
  } catch {
    return null;
  }
}

export async function setCampaignActive(
  campaignId: string,
  isActive: boolean
): Promise<ReferralCampaignRow | null> {
  const pool = getPool();
  try {
    if (isActive) {
      // Single active campaign policy
      await pool.query(`UPDATE referral_campaigns SET is_active = FALSE WHERE id <> $1`, [campaignId]);
    }
    const result = await pool.query(
      `UPDATE referral_campaigns SET is_active = $2
       WHERE id = $1
       RETURNING id, name, qualification_window_days, max_milestone, milestones, is_active,
                 starts_at, ends_at, COALESCE(min_plan, 'payg') AS min_plan, notes,
                 COALESCE(reward_expiry_days, 30) AS reward_expiry_days, created_at`,
      [campaignId, isActive]
    );
    return result.rows[0] ? mapCampaign(result.rows[0]) : null;
  } catch {
    return null;
  }
}

export async function updateCampaignRules(
  campaignId: string,
  rules: {
    qualificationWindowDays?: number;
    maxMilestone?: number;
    milestones?: number[];
    minPlan?: string;
    notes?: string;
    rewardExpiryDays?: number;
    startsAt?: string | null;
    endsAt?: string | null;
  }
): Promise<ReferralCampaignRow | null> {
  const pool = getPool();
  try {
    const result = await pool.query(
      `UPDATE referral_campaigns SET
         qualification_window_days = COALESCE($2, qualification_window_days),
         max_milestone = COALESCE($3, max_milestone),
         milestones = COALESCE($4, milestones),
         min_plan = COALESCE($5, min_plan),
         notes = COALESCE($6, notes),
         reward_expiry_days = COALESCE($7, reward_expiry_days),
         starts_at = COALESCE($8, starts_at),
         ends_at = COALESCE($9, ends_at)
       WHERE id = $1
       RETURNING id, name, qualification_window_days, max_milestone, milestones, is_active,
                 starts_at, ends_at, COALESCE(min_plan, 'payg') AS min_plan, notes,
                 COALESCE(reward_expiry_days, 30) AS reward_expiry_days, created_at`,
      [
        campaignId,
        rules.qualificationWindowDays ?? null,
        rules.maxMilestone ?? null,
        rules.milestones ?? null,
        rules.minPlan ?? null,
        rules.notes ?? null,
        rules.rewardExpiryDays ?? null,
        rules.startsAt ?? null,
        rules.endsAt ?? null,
      ]
    );
    return result.rows[0] ? mapCampaign(result.rows[0]) : null;
  } catch {
    return null;
  }
}

/**
 * Defensible fraud signals from existing referral rows — no fingerprinting.
 */
export async function getFraudSignals(limit = 50): Promise<FraudSignal[]> {
  const pool = getPool();
  const signals: FraudSignal[] = [];
  try {
    const rejected = await pool.query(
      `SELECT id, referrer_id, referred_id, status, updated_at
       FROM referrals
       WHERE status IN ('REJECTED_SELF_REFERRAL','REJECTED_FRAUD','REJECTED_DUPLICATE','REJECTED_REFUND','REJECTED_CHARGEBACK')
       ORDER BY updated_at DESC
       LIMIT $1`,
      [limit]
    );
    for (const row of rejected.rows) {
      const status = String(row.status);
      const type =
        status === 'REJECTED_SELF_REFERRAL'
          ? 'self_referral'
          : status === 'REJECTED_DUPLICATE'
            ? 'duplicate_referred'
            : status === 'REJECTED_FRAUD'
              ? 'rejected_fraud'
              : 'rejected_refund';
      signals.push({
        id: String(row.id),
        type: type as FraudSignal['type'],
        severity: status.includes('FRAUD') || status.includes('SELF') ? 'high' : 'medium',
        message: `Referral ${status}`,
        referrerId: row.referrer_id ? String(row.referrer_id) : undefined,
        referredId: row.referred_id ? String(row.referred_id) : undefined,
        createdAt: new Date(row.updated_at as string | Date).toISOString(),
      });
    }

    // High velocity: same referrer > 10 attributions in 24h
    const velocity = await pool.query(
      `SELECT referrer_id, COUNT(*)::int AS c, MAX(created_at) AS last_at
       FROM referrals
       WHERE created_at > NOW() - INTERVAL '24 hours'
       GROUP BY referrer_id
       HAVING COUNT(*) > 10
       ORDER BY c DESC
       LIMIT 20`
    );
    for (const row of velocity.rows) {
      signals.push({
        id: `vel-${row.referrer_id}`,
        type: 'high_velocity',
        severity: 'medium',
        message: `${row.c} referrals attributed in 24h`,
        referrerId: String(row.referrer_id),
        count: Number(row.c),
        createdAt: new Date(row.last_at as string | Date).toISOString(),
      });
    }
  } catch {
    /* tables may not exist */
  }
  return signals;
}

function mapCampaign(row: Record<string, unknown>): ReferralCampaignRow {
  const milestones = Array.isArray(row.milestones)
    ? (row.milestones as number[])
    : [5, 10, 15, 20];
  return {
    id: String(row.id),
    name: String(row.name),
    qualificationWindowDays: Number(row.qualification_window_days ?? 7),
    maxMilestone: Number(row.max_milestone ?? 20),
    milestones,
    isActive: Boolean(row.is_active),
    startsAt: new Date(row.starts_at as string | Date).toISOString(),
    endsAt: row.ends_at ? new Date(row.ends_at as string | Date).toISOString() : null,
    minPlan: String(row.min_plan ?? 'payg'),
    notes: row.notes != null ? String(row.notes) : null,
    rewardExpiryDays: Number(row.reward_expiry_days ?? 30),
    createdAt: new Date(row.created_at as string | Date).toISOString(),
  };
}



export interface AdminReferralRow {
  id: string;
  referrerId: string;
  referredId: string;
  status: string;
  createdAt: string;
  qualifiedAt: string | null;
  referrerUsername?: string | null;
  referredUsername?: string | null;
}

export async function listReferralsByStatus(
  status: 'QUALIFIED' | 'PENDING' | 'REWARD_COUNTED' | 'ALL_PENDING',
  limit = 50
): Promise<AdminReferralRow[]> {
  const pool = getPool();
  try {
    let whereSql: string;
    if (status === 'ALL_PENDING') {
      whereSql = `r.status IN ('PENDING','SUBSCRIPTION_REQUIRED','PAYMENT_PENDING')`;
    } else if (status === 'QUALIFIED') {
      whereSql = `r.status IN ('QUALIFIED','REWARD_COUNTED')`;
    } else if (status === 'REWARD_COUNTED') {
      whereSql = `r.status = 'REWARD_COUNTED'`;
    } else {
      whereSql = `r.status = 'PENDING'`;
    }
    const result = await pool.query(
      `SELECT r.id, r.referrer_id, r.referred_id, r.status, r.created_at, r.qualified_at,
              ur.telegram_username AS referrer_username,
              ud.telegram_username AS referred_username
       FROM referrals r
       LEFT JOIN users ur ON ur.id = r.referrer_id
       LEFT JOIN users ud ON ud.id = r.referred_id
       WHERE ${whereSql}
       ORDER BY r.updated_at DESC
       LIMIT $1`,
      [limit]
    );
    return result.rows.map(mapReferralRow);
  } catch {
    return [];
  }
}

function mapReferralRow(row: Record<string, unknown>): AdminReferralRow {
  return {
    id: String(row.id),
    referrerId: String(row.referrer_id),
    referredId: String(row.referred_id),
    status: String(row.status),
    createdAt: new Date(row.created_at as string | Date).toISOString(),
    qualifiedAt: row.qualified_at
      ? new Date(row.qualified_at as string | Date).toISOString()
      : null,
    referrerUsername: row.referrer_username != null ? String(row.referrer_username) : null,
    referredUsername: row.referred_username != null ? String(row.referred_username) : null,
  };
}

export interface AdminRewardRow {
  id: string;
  userId: string;
  tenantId: string | null;
  milestone: number;
  rewardType: string;
  entriesQuantity: number;
  hoursQuantity: number;
  status: string;
  issuedAt: string;
  expiresAt: string | null;
  username?: string | null;
}

export async function listRewardLedger(limit = 50): Promise<AdminRewardRow[]> {
  const pool = getPool();
  try {
    const result = await pool.query(
      `SELECT l.id, l.user_id, l.tenant_id, l.milestone, l.reward_type,
              l.entries_quantity, l.hours_quantity, l.status, l.issued_at, l.expires_at,
              u.telegram_username
       FROM referral_reward_ledger l
       LEFT JOIN users u ON u.id = l.user_id
       ORDER BY l.issued_at DESC
       LIMIT $1`,
      [limit]
    );
    return result.rows.map((row) => ({
      id: String(row.id),
      userId: String(row.user_id),
      tenantId: row.tenant_id ? String(row.tenant_id) : null,
      milestone: Number(row.milestone),
      rewardType: String(row.reward_type),
      entriesQuantity: Number(row.entries_quantity ?? 0),
      hoursQuantity: Number(row.hours_quantity ?? 0),
      status: String(row.status),
      issuedAt: new Date(row.issued_at as string | Date).toISOString(),
      expiresAt: row.expires_at
        ? new Date(row.expires_at as string | Date).toISOString()
        : null,
      username: row.telegram_username != null ? String(row.telegram_username) : null,
    }));
  } catch {
    return [];
  }
}
