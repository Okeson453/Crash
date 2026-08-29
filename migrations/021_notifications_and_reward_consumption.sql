-- Durable in-app notifications + referral reward consumption tracking

CREATE TABLE IF NOT EXISTS user_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category TEXT NOT NULL DEFAULT 'system'
    CHECK (category IN ('bets','cashout','balance','subscription','referral','system')),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_notifications_user_created
  ON user_notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_notifications_unread
  ON user_notifications(user_id, created_at DESC)
  WHERE read_at IS NULL;

ALTER TABLE referral_reward_ledger
  ADD COLUMN IF NOT EXISTS entries_used INT NOT NULL DEFAULT 0;
ALTER TABLE referral_reward_ledger
  ADD COLUMN IF NOT EXISTS hours_used NUMERIC(10,2) NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS user_promotional_entitlements (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  bonus_entries INT NOT NULL DEFAULT 0,
  bonus_hours NUMERIC(10,2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
