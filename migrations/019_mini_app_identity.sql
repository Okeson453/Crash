-- CrashWave Mini App identity/session compatibility layer.
-- Keeps the existing tenant/control-plane architecture while adding the
-- Telegram profile and RBAC fields required by the Mini App API contract.
ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS photo_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'player';
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('player','operator','admin'));

CREATE TABLE IF NOT EXISTS mini_app_refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_mini_refresh_user ON mini_app_refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_mini_refresh_expiry ON mini_app_refresh_tokens(expires_at);

CREATE TABLE IF NOT EXISTS mini_app_preferences (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mini_app_balances (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  balance NUMERIC(18,8) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS mini_app_rounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  round_number BIGSERIAL UNIQUE,
  server_seed_hash TEXT NOT NULL,
  server_seed TEXT,
  client_seed TEXT NOT NULL,
  nonce BIGINT NOT NULL,
  phase TEXT NOT NULL CHECK (phase IN ('idle','waiting','countdown','running','crashed')),
  crash_point NUMERIC(18,8),
  started_at TIMESTAMPTZ,
  crashed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS mini_app_bets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  round_id UUID REFERENCES mini_app_rounds(id) ON DELETE SET NULL,
  amount NUMERIC(18,8) NOT NULL,
  auto_cashout NUMERIC(18,8),
  state TEXT NOT NULL CHECK (state IN ('pending','placed','active','cashed_out','lost','cancelled','failed')),
  cashout_multiplier NUMERIC(18,8),
  pnl NUMERIC(18,8),
  idempotency_key TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  settled_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_mini_bets_user_created ON mini_app_bets(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mini_bets_round ON mini_app_bets(round_id);
