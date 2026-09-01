/**
 * Env-based admin/operator bootstrap for Telegram user IDs.
 * Shared by auth routes and JWT middleware so existing sessions
 * still get elevated roles without a DB SQL update.
 */

function parseIdSet(envKey: string): Set<string> {
  const raw = process.env[envKey] ?? '';
  return new Set(
    raw
      .split(/[,\s]+/)
      .map((s) => s.trim())
      .filter(Boolean)
  );
}

export function resolveBootstrapRole(
  telegramId: string | number | null | undefined
): 'admin' | 'operator' | null {
  if (telegramId === null || telegramId === undefined || telegramId === '') return null;
  const id = String(telegramId).trim();
  const adminIds = new Set([
    ...parseIdSet('ADMIN_TELEGRAM_IDS'),
    ...parseIdSet('ADMIN_TELEGRAM_ID'),
    ...parseIdSet('TELEGRAM_ADMIN_IDS'),
    ...parseIdSet('TELEGRAM_OPERATOR_CHAT_ID'),
  ]);
  const operatorIds = new Set([
    ...parseIdSet('OPERATOR_TELEGRAM_IDS'),
    ...parseIdSet('OPERATOR_TELEGRAM_ID'),
  ]);
  if (adminIds.has(id)) return 'admin';
  if (operatorIds.has(id)) return 'operator';
  return null;
}

export const ROLE_RANK: Record<string, number> = { player: 0, operator: 1, admin: 2 };

/** Elevate JWT/DB role when env bootstrap is higher (never demote). */
export function elevateRole(
  current: string | null | undefined,
  telegramId: string | number | null | undefined
): 'player' | 'operator' | 'admin' {
  const base =
    current === 'admin' || current === 'operator' || current === 'player'
      ? current
      : 'player';
  const boot = resolveBootstrapRole(telegramId);
  if (!boot) return base;
  if ((ROLE_RANK[boot] ?? 0) >= (ROLE_RANK[base] ?? 0)) return boot;
  return base;
}
