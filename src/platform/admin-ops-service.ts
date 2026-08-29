/**
 * Admin operational surfaces — browser sessions, active bets, risk,
 * transactions, logs, alerts, feature flags.
 * All reads are backend-authoritative; mutations are RBAC-protected at route layer.
 */
import { getPool } from '@/persistence/client';
import { loadAdminSetting, saveAdminSetting } from './admin-settings-store';
import { getLogger } from '@/observability/logger';

const logger = getLogger();

// ─── Browser Sessions ────────────────────────────────────────────────────────

export interface AdminBrowserSession {
  id: string;
  status: string;
  mode: string;
  browserProfileId: string | null;
  operatorId: string | null;
  startedAt: string;
  endedAt: string | null;
  notes: string | null;
}

export async function listBrowserSessions(limit = 50): Promise<AdminBrowserSession[]> {
  const pool = getPool();
  try {
    const result = await pool.query(
      `SELECT id, status, mode, browser_profile_id, operator_id, started_at, ended_at, notes
       FROM sessions
       ORDER BY started_at DESC
       LIMIT $1`,
      [limit]
    );
    return result.rows.map((row) => ({
      id: String(row.id),
      status: String(row.status),
      mode: String(row.mode),
      browserProfileId: row.browser_profile_id != null ? String(row.browser_profile_id) : null,
      operatorId: row.operator_id != null ? String(row.operator_id) : null,
      startedAt: new Date(row.started_at as string | Date).toISOString(),
      endedAt: row.ended_at ? new Date(row.ended_at as string | Date).toISOString() : null,
      notes: row.notes != null ? String(row.notes) : null,
    }));
  } catch (err) {
    logger.warn({ err, component: 'AdminOps' }, 'listBrowserSessions failed');
    return [];
  }
}

export async function terminateBrowserSession(sessionId: string): Promise<boolean> {
  const pool = getPool();
  try {
    const result = await pool.query(
      `UPDATE sessions
       SET status = 'stopped', ended_at = COALESCE(ended_at, NOW()), updated_at = NOW()
       WHERE id = $1 AND status NOT IN ('stopped')
       RETURNING id`,
      [sessionId]
    );
    return (result.rowCount ?? 0) > 0;
  } catch {
    return false;
  }
}

// ─── Active Bets ─────────────────────────────────────────────────────────────

export interface AdminActiveBet {
  id: string;
  userId: string;
  username: string | null;
  amount: number;
  autoCashout: number | null;
  state: string;
  roundId: string | null;
  cashoutMultiplier: number | null;
  pnl: number | null;
  createdAt: string;
}

export async function listActiveBets(limit = 100): Promise<AdminActiveBet[]> {
  const pool = getPool();
  try {
    const result = await pool.query(
      `SELECT b.id, b.user_id, b.amount, b.auto_cashout, b.state, b.round_id,
              b.cashout_multiplier, b.pnl, b.created_at,
              u.telegram_username
       FROM mini_app_bets b
       LEFT JOIN users u ON u.id = b.user_id
       WHERE b.state IN ('pending','placed','active')
       ORDER BY b.created_at DESC
       LIMIT $1`,
      [limit]
    );
    return result.rows.map((row) => ({
      id: String(row.id),
      userId: String(row.user_id),
      username: row.telegram_username != null ? String(row.telegram_username) : null,
      amount: Number(row.amount),
      autoCashout: row.auto_cashout != null ? Number(row.auto_cashout) : null,
      state: String(row.state),
      roundId: row.round_id != null ? String(row.round_id) : null,
      cashoutMultiplier: row.cashout_multiplier != null ? Number(row.cashout_multiplier) : null,
      pnl: row.pnl != null ? Number(row.pnl) : null,
      createdAt: new Date(row.created_at as string | Date).toISOString(),
    }));
  } catch (err) {
    logger.warn({ err, component: 'AdminOps' }, 'listActiveBets failed');
    return [];
  }
}

// ─── Risk ────────────────────────────────────────────────────────────────────

export interface AdminRiskSummary {
  activeBetCount: number;
  activeExposure: number;
  pendingBetCount: number;
  dailyLossEstimate: number;
  openSessions: number;
  highStakeBets: number;
  recentRejectedFraud: number;
  limits: {
    maxDailyLoss: number | null;
    maxSessionHours: number | null;
    betCooldownMinutes: number | null;
  };
}

export async function getRiskSummary(): Promise<AdminRiskSummary> {
  const pool = getPool();
  const empty: AdminRiskSummary = {
    activeBetCount: 0,
    activeExposure: 0,
    pendingBetCount: 0,
    dailyLossEstimate: 0,
    openSessions: 0,
    highStakeBets: 0,
    recentRejectedFraud: 0,
    limits: { maxDailyLoss: null, maxSessionHours: null, betCooldownMinutes: null },
  };
  try {
    const bets = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE state = 'active')::int AS active_count,
         COALESCE(SUM(amount) FILTER (WHERE state IN ('active','placed')), 0)::float AS exposure,
         COUNT(*) FILTER (WHERE state = 'pending')::int AS pending_count,
         COUNT(*) FILTER (WHERE amount >= 1000 AND state IN ('active','placed','pending'))::int AS high_stake
       FROM mini_app_bets
       WHERE created_at > NOW() - INTERVAL '24 hours'`
    );
    const sessions = await pool.query(
      `SELECT COUNT(*)::int AS c FROM sessions WHERE status NOT IN ('stopped','error') AND ended_at IS NULL`
    );
    const fraud = await pool.query(
      `SELECT COUNT(*)::int AS c FROM referrals
       WHERE status IN ('REJECTED_FRAUD','REJECTED_CHARGEBACK','REJECTED_REFUND')
         AND updated_at > NOW() - INTERVAL '7 days'`
    );
    const loss = await pool.query(
      `SELECT COALESCE(SUM(CASE WHEN pnl < 0 THEN ABS(pnl) ELSE 0 END), 0)::float AS loss
       FROM mini_app_bets
       WHERE settled_at > NOW() - INTERVAL '24 hours'`
    );
    const rg = await loadAdminSetting<{
      maxLossPerDay?: number;
      maxSessionHours?: number;
      betCooldownMinutes?: number;
    }>('compliance_rg', {});

    return {
      activeBetCount: Number(bets.rows[0]?.active_count ?? 0),
      activeExposure: Number(bets.rows[0]?.exposure ?? 0),
      pendingBetCount: Number(bets.rows[0]?.pending_count ?? 0),
      dailyLossEstimate: Number(loss.rows[0]?.loss ?? 0),
      openSessions: Number(sessions.rows[0]?.c ?? 0),
      highStakeBets: Number(bets.rows[0]?.high_stake ?? 0),
      recentRejectedFraud: Number(fraud.rows[0]?.c ?? 0),
      limits: {
        maxDailyLoss: rg.maxLossPerDay ?? null,
        maxSessionHours: rg.maxSessionHours ?? null,
        betCooldownMinutes: rg.betCooldownMinutes ?? null,
      },
    };
  } catch (err) {
    logger.warn({ err, component: 'AdminOps' }, 'getRiskSummary failed');
    return empty;
  }
}

// ─── Transactions ────────────────────────────────────────────────────────────

export interface AdminTransaction {
  id: string;
  userId: string | null;
  username: string | null;
  type: string;
  amount: number;
  status: string;
  reference: string | null;
  createdAt: string;
}

export async function listTransactions(limit = 100): Promise<AdminTransaction[]> {
  const pool = getPool();
  try {
    // Prefer payment_transactions if present; fall back to financial_ledger_events
    const pay = await pool.query(
      `SELECT pt.id, pt.user_id, pt.amount, pt.status, pt.paystack_reference,
              pt.channel, pt.created_at, u.telegram_username
       FROM payment_transactions pt
       LEFT JOIN users u ON u.id = pt.user_id
       ORDER BY pt.created_at DESC
       LIMIT $1`,
      [limit]
    );
    if ((pay.rowCount ?? 0) > 0) {
      return pay.rows.map((row) => ({
        id: String(row.id),
        userId: row.user_id != null ? String(row.user_id) : null,
        username: row.telegram_username != null ? String(row.telegram_username) : null,
        type: String(row.channel ?? 'payment'),
        amount: Number(row.amount ?? 0),
        status: String(row.status ?? 'unknown'),
        reference: row.paystack_reference != null ? String(row.paystack_reference) : null,
        createdAt: new Date(row.created_at as string | Date).toISOString(),
      }));
    }
  } catch {
    /* table may differ */
  }
  try {
    const ledger = await pool.query(
      `SELECT id, user_id, event_type AS tx_type, amount, status, reference, created_at
       FROM financial_ledger_events
       ORDER BY created_at DESC
       LIMIT $1`,
      [limit]
    );
    return ledger.rows.map((row) => ({
      id: String(row.id),
      userId: row.user_id != null ? String(row.user_id) : null,
      username: null,
      type: String(row.tx_type ?? 'ledger'),
      amount: Number(row.amount ?? 0),
      status: String(row.status ?? 'recorded'),
      reference: row.reference != null ? String(row.reference) : null,
      createdAt: new Date(row.created_at as string | Date).toISOString(),
    }));
  } catch (err) {
    logger.warn({ err, component: 'AdminOps' }, 'listTransactions failed');
    return [];
  }
}

// ─── Logs (application-oriented from audit + referral events) ────────────────

export interface AdminLogEntry {
  id: string;
  source: string;
  level: string;
  message: string;
  actorId: string | null;
  createdAt: string;
  payload?: Record<string, unknown>;
}

export async function listAdminLogs(limit = 100): Promise<AdminLogEntry[]> {
  const pool = getPool();
  const entries: AdminLogEntry[] = [];
  try {
    const audit = await pool.query(
      `SELECT id, actor, action, entity_type, entity_id, timestamp, payload, severity
       FROM audit_logs
       ORDER BY timestamp DESC
       LIMIT $1`,
      [Math.ceil(limit / 2)]
    );
    for (const row of audit.rows) {
      entries.push({
        id: String(row.id),
        source: 'audit',
        level: String(row.severity ?? 'info'),
        message: `${row.action}${row.entity_type ? ` → ${row.entity_type}` : ''}${row.entity_id ? `:${String(row.entity_id).slice(0, 8)}` : ''}`,
        actorId: row.actor != null ? String(row.actor) : null,
        createdAt: new Date(row.timestamp as string | Date).toISOString(),
        payload: (row.payload as Record<string, unknown>) ?? undefined,
      });
    }
  } catch {
    /* audit schema variants */
  }
  try {
    const events = await pool.query(
      `SELECT id, user_id, event_type, payload, created_at
       FROM referral_events
       ORDER BY created_at DESC
       LIMIT $1`,
      [Math.ceil(limit / 2)]
    );
    for (const row of events.rows) {
      entries.push({
        id: String(row.id),
        source: 'referral',
        level: String(row.event_type).includes('reject') || String(row.event_type).includes('invalid')
          ? 'warning'
          : 'info',
        message: `referral.${row.event_type}`,
        actorId: row.user_id != null ? String(row.user_id) : null,
        createdAt: new Date(row.created_at as string | Date).toISOString(),
        payload: (row.payload as Record<string, unknown>) ?? undefined,
      });
    }
  } catch {
    /* optional */
  }
  entries.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  return entries.slice(0, limit);
}

// ─── Alerts (persisted in platform_admin_settings + synthetic health) ─────────

export interface AdminAlert {
  id: string;
  severity: 'info' | 'warning' | 'critical';
  component: string;
  message: string;
  acknowledged: boolean;
  createdAt: string;
}

interface AlertsStore {
  alerts: AdminAlert[];
}

const DEFAULT_ALERTS: AlertsStore = { alerts: [] };

export async function listAlerts(): Promise<AdminAlert[]> {
  const store = await loadAdminSetting<AlertsStore>('admin_alerts', DEFAULT_ALERTS);
  // Also surface synthetic risk-based alerts
  const risk = await getRiskSummary();
  const synthetic: AdminAlert[] = [];
  if (risk.activeExposure > 50000) {
    synthetic.push({
      id: 'synth-exposure',
      severity: 'warning',
      component: 'risk',
      message: `High active exposure: ${risk.activeExposure.toFixed(2)}`,
      acknowledged: false,
      createdAt: new Date().toISOString(),
    });
  }
  if (risk.recentRejectedFraud > 5) {
    synthetic.push({
      id: 'synth-fraud',
      severity: 'critical',
      component: 'referrals',
      message: `${risk.recentRejectedFraud} fraud/refund rejections in 7 days`,
      acknowledged: false,
      createdAt: new Date().toISOString(),
    });
  }
  const existingIds = new Set(store.alerts.map((a) => a.id));
  return [...store.alerts, ...synthetic.filter((s) => !existingIds.has(s.id))];
}

export async function acknowledgeAlert(alertId: string, actorId?: string): Promise<boolean> {
  const store = await loadAdminSetting<AlertsStore>('admin_alerts', DEFAULT_ALERTS);
  const alert = store.alerts.find((a) => a.id === alertId);
  if (alert) {
    alert.acknowledged = true;
    await saveAdminSetting('admin_alerts', store, actorId);
    return true;
  }
  // Synthetic alerts: persist acknowledgement so they stay quiet
  store.alerts.push({
    id: alertId,
    severity: 'info',
    component: 'system',
    message: `Acknowledged ${alertId}`,
    acknowledged: true,
    createdAt: new Date().toISOString(),
  });
  await saveAdminSetting('admin_alerts', store, actorId);
  return true;
}

// ─── Feature Flags ───────────────────────────────────────────────────────────

export interface FeatureFlag {
  key: string;
  enabled: boolean;
  scope: string;
  description: string;
  updatedAt: string | null;
}

interface FeatureFlagsStore {
  flags: FeatureFlag[];
}

const DEFAULT_FLAGS: FeatureFlagsStore = {
  flags: [
    {
      key: 'referrals_enabled',
      enabled: true,
      scope: 'platform',
      description: 'Enable referral program',
      updatedAt: null,
    },
    {
      key: 'bonus_entries_enabled',
      enabled: true,
      scope: 'platform',
      description: 'Allow promotional bonus entries',
      updatedAt: null,
    },
    {
      key: 'maintenance_mode',
      enabled: false,
      scope: 'platform',
      description: 'Global maintenance mode for Mini App',
      updatedAt: null,
    },
    {
      key: 'auto_cashout_enabled',
      enabled: true,
      scope: 'betting',
      description: 'Allow auto-cashout controls',
      updatedAt: null,
    },
    {
      key: 'admin_referrals_ui',
      enabled: true,
      scope: 'admin',
      description: 'Show referral admin surface',
      updatedAt: null,
    },
  ],
};

export async function listFeatureFlags(): Promise<FeatureFlag[]> {
  const store = await loadAdminSetting<FeatureFlagsStore>('feature_flags', DEFAULT_FLAGS);
  // Merge defaults for any missing keys
  const byKey = new Map(store.flags.map((f) => [f.key, f]));
  for (const d of DEFAULT_FLAGS.flags) {
    if (!byKey.has(d.key)) byKey.set(d.key, d);
  }
  return Array.from(byKey.values());
}

export async function setFeatureFlag(
  key: string,
  enabled: boolean,
  actorId?: string
): Promise<FeatureFlag | null> {
  const flags = await listFeatureFlags();
  const idx = flags.findIndex((f) => f.key === key);
  if (idx < 0) {
    flags.push({
      key,
      enabled,
      scope: 'platform',
      description: key,
      updatedAt: new Date().toISOString(),
    });
  } else {
    flags[idx] = {
      ...flags[idx],
      enabled,
      updatedAt: new Date().toISOString(),
    };
  }
  await saveAdminSetting('feature_flags', { flags }, actorId);
  return flags.find((f) => f.key === key) ?? null;
}
