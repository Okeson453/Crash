-- CrashWave V1.1 production hardening: durable webhooks, integer money, RLS, ledger cache.
ALTER TABLE payment_transactions ADD COLUMN IF NOT EXISTS amount_minor BIGINT;
UPDATE payment_transactions SET amount_minor = ROUND(amount * 100)::BIGINT WHERE amount_minor IS NULL;
ALTER TABLE payment_transactions ALTER COLUMN amount_minor SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payment_tx_minor_reference ON payment_transactions(paystack_reference, amount_minor);

CREATE TABLE IF NOT EXISTS webhook_inbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL CHECK (provider IN ('paystack','stripe')),
  event_id TEXT NOT NULL,
  signature TEXT,
  raw_body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','processed','failed','dead_letter')),
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  locked_at TIMESTAMPTZ,
  processed_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(provider, event_id)
);
CREATE INDEX IF NOT EXISTS idx_webhook_inbox_ready ON webhook_inbox(status, next_attempt_at, created_at);

CREATE TABLE IF NOT EXISTS stripe_webhook_events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Normalize legacy duplicate live subscriptions before enforcing uniqueness.
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at DESC, id DESC) AS rn
  FROM subscriptions WHERE status IN ('active','trialing','past_due')
)
UPDATE subscriptions s SET status = 'expired', updated_at = NOW()
FROM ranked r WHERE s.id = r.id AND r.rn > 1;

-- Enforce one live subscription at the database boundary.
CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_one_live
ON subscriptions(user_id) WHERE status IN ('active','trialing','past_due');

-- Keep a materialized running balance cache for settlement accounts.
INSERT INTO ledger_balance_cache(account, balance)
SELECT code, 0 FROM ledger_accounts ON CONFLICT (account) DO NOTHING;

DROP POLICY IF EXISTS ledger_entries_tenant ON ledger_entries;
CREATE POLICY ledger_entries_tenant ON ledger_entries
USING (
  current_setting('app.platform_role', true) = 'control_plane'
  OR EXISTS (SELECT 1 FROM settlement_orders so WHERE so.id = ledger_entries.order_id
    AND so.tenant_id::text = current_setting('app.tenant_id', true))
);
