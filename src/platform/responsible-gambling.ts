
/**
 * Server-side responsible-gambling controls (Phase 5).
 * Self-exclusion, deposit/loss limits, cooling-off — enforced as state, not stubs only.
 */

export interface RgLimits {
  userId: string;
  selfExcludedUntil: string | null;
  coolingOffUntil: string | null;
  dailyDepositLimit: number | null;
  dailyLossLimit: number | null;
  dailyDeposited: number;
  dailyLost: number;
}

const store = new Map<string, RgLimits>();

export function getRgLimits(userId: string): RgLimits {
  let row = store.get(userId);
  if (!row) {
    row = {
      userId,
      selfExcludedUntil: null,
      coolingOffUntil: null,
      dailyDepositLimit: null,
      dailyLossLimit: null,
      dailyDeposited: 0,
      dailyLost: 0,
    };
    store.set(userId, row);
  }
  return row;
}

export function setSelfExclusion(userId: string, untilIso: string): RgLimits {
  const row = getRgLimits(userId);
  row.selfExcludedUntil = untilIso;
  return row;
}

export function setCoolingOff(userId: string, untilIso: string): RgLimits {
  const row = getRgLimits(userId);
  row.coolingOffUntil = untilIso;
  return row;
}

export function setLimits(
  userId: string,
  limits: { dailyDepositLimit?: number | null; dailyLossLimit?: number | null }
): RgLimits {
  const row = getRgLimits(userId);
  if (limits.dailyDepositLimit !== undefined) row.dailyDepositLimit = limits.dailyDepositLimit;
  if (limits.dailyLossLimit !== undefined) row.dailyLossLimit = limits.dailyLossLimit;
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
