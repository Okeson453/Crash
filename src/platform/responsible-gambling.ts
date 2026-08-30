/**
 * Phase 5.2 — Server-side responsible-gambling controls (enforced, not stubs).
 */

import { getPool } from '@/persistence/client';

export interface RgLimits {
  userId: string;
  selfExcludedUntil: string | null;
  coolingOffUntil: string | null;
  dailyDepositLimit: number | null;
  dailyLossLimit: number | null;
  dailyDeposited: number;
  dailyLost: number;
}

const memory = new Map<string, RgLimits>();

function empty(userId: string): RgLimits {
  return {
    userId,
    selfExcludedUntil: null,
    coolingOffUntil: null,
    dailyDepositLimit: null,
    dailyLossLimit: null,
    dailyDeposited: 0,
    dailyLost: 0,
  };
}

export function getRgLimits(userId: string): RgLimits {
  return memory.get(userId) ?? empty(userId);
}

export async function loadRgLimits(userId: string): Promise<RgLimits> {
  try {
    const pool = getPool();
    const r = await pool.query(
      `SELECT * FROM responsible_gambling_limits WHERE user_id = $1`,
      [userId]
    );
    if (!r.rows[0]) {
      const e = empty(userId);
      memory.set(userId, e);
      return e;
    }
    const row = r.rows[0];
    const limits: RgLimits = {
      userId,
      selfExcludedUntil: row.self_excluded_until
        ? new Date(row.self_excluded_until).toISOString()
        : null,
      coolingOffUntil: row.cooling_off_until
        ? new Date(row.cooling_off_until).toISOString()
        : null,
      dailyDepositLimit: row.daily_deposit_limit != null ? Number(row.daily_deposit_limit) : null,
      dailyLossLimit: row.daily_loss_limit != null ? Number(row.daily_loss_limit) : null,
      dailyDeposited: Number(row.daily_deposited ?? 0),
      dailyLost: Number(row.daily_lost ?? 0),
    };
    memory.set(userId, limits);
    return limits;
  } catch {
    return getRgLimits(userId);
  }
}

async function persist(limits: RgLimits): Promise<void> {
  memory.set(limits.userId, limits);
  try {
    const pool = getPool();
    await pool.query(
      `INSERT INTO responsible_gambling_limits (
         user_id, self_excluded_until, cooling_off_until,
         daily_deposit_limit, daily_loss_limit, daily_deposited, daily_lost, updated_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7, now())
       ON CONFLICT (user_id) DO UPDATE SET
         self_excluded_until = EXCLUDED.self_excluded_until,
         cooling_off_until = EXCLUDED.cooling_off_until,
         daily_deposit_limit = EXCLUDED.daily_deposit_limit,
         daily_loss_limit = EXCLUDED.daily_loss_limit,
         daily_deposited = EXCLUDED.daily_deposited,
         daily_lost = EXCLUDED.daily_lost,
         updated_at = now()`,
      [
        limits.userId,
        limits.selfExcludedUntil,
        limits.coolingOffUntil,
        limits.dailyDepositLimit,
        limits.dailyLossLimit,
        limits.dailyDeposited,
        limits.dailyLost,
      ]
    );
  } catch {
    /* table may not exist yet */
  }
}

export function setSelfExclusion(userId: string, untilIso: string): RgLimits {
  const row = { ...getRgLimits(userId), selfExcludedUntil: untilIso };
  void persist(row);
  return row;
}

export function setCoolingOff(userId: string, untilIso: string): RgLimits {
  const row = { ...getRgLimits(userId), coolingOffUntil: untilIso };
  void persist(row);
  return row;
}

export function setLimits(
  userId: string,
  limits: { dailyDepositLimit?: number | null; dailyLossLimit?: number | null }
): RgLimits {
  const row = getRgLimits(userId);
  if (limits.dailyDepositLimit !== undefined) row.dailyDepositLimit = limits.dailyDepositLimit;
  if (limits.dailyLossLimit !== undefined) row.dailyLossLimit = limits.dailyLossLimit;
  void persist(row);
  return row;
}

export function assertBettingAllowed(userId: string): { allowed: boolean; reason?: string } {
  const row = getRgLimits(userId);
  const now = Date.now();
  if (row.selfExcludedUntil && new Date(row.selfExcludedUntil).getTime() > now) {
    return { allowed: false, reason: 'self_excluded' };
  }
  if (row.coolingOffUntil && new Date(row.coolingOffUntil).getTime() > now) {
    return { allowed: false, reason: 'cooling_off' };
  }
  if (row.dailyDepositLimit != null && row.dailyDeposited >= row.dailyDepositLimit) {
    return { allowed: false, reason: 'deposit_limit' };
  }
  if (row.dailyLossLimit != null && row.dailyLost >= row.dailyLossLimit) {
    return { allowed: false, reason: 'loss_limit' };
  }
  return { allowed: true };
}

export async function assertBettingAllowedAsync(
  userId: string
): Promise<{ allowed: boolean; reason?: string }> {
  await loadRgLimits(userId);
  return assertBettingAllowed(userId);
}
