-- Phase 5.2 responsible gambling limits (server-enforced)
CREATE TABLE IF NOT EXISTS responsible_gambling_limits (
  user_id UUID PRIMARY KEY,
  self_excluded_until TIMESTAMPTZ,
  cooling_off_until TIMESTAMPTZ,
  daily_deposit_limit NUMERIC(18, 2),
  daily_loss_limit NUMERIC(18, 2),
  daily_deposited NUMERIC(18, 2) NOT NULL DEFAULT 0,
  daily_lost NUMERIC(18, 2) NOT NULL DEFAULT 0,
  day_key DATE NOT NULL DEFAULT (CURRENT_DATE),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rg_self_excluded ON responsible_gambling_limits (self_excluded_until)
  WHERE self_excluded_until IS NOT NULL;
