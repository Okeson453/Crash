-- CrashWave referral program (qualified-referral milestones)
-- Qualification requires PAYG-or-higher confirmed subscription; rewards are promotional entitlements.

CREATE TABLE IF NOT EXISTS referral_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id)
);

CREATE TABLE IF NOT EXISTS referral_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  qualification_window_days INT NOT NULL DEFAULT 7,
  max_milestone INT NOT NULL DEFAULT 20,
  milestones INT[] NOT NULL DEFAULT ARRAY[5,10,15,20],
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referred_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referral_code_id UUID REFERENCES referral_codes(id) ON DELETE SET NULL,
  campaign_id UUID REFERENCES referral_campaigns(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN (
      'PENDING','SUBSCRIPTION_REQUIRED','PAYMENT_PENDING','QUALIFIED','REWARD_COUNTED',
      'REJECTED_DUPLICATE','REJECTED_SELF_REFERRAL','REJECTED_FRAUD','REJECTED_REFUND',
      'REJECTED_CHARGEBACK','REJECTED_INVALID'
    )),
  qualified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (referred_id)
);

CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_status ON referrals(status);
CREATE INDEX IF NOT EXISTS idx_referrals_qualified ON referrals(referrer_id, qualified_at)
  WHERE status IN ('QUALIFIED','REWARD_COUNTED');

CREATE TABLE IF NOT EXISTS referral_reward_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES referral_campaigns(id) ON DELETE SET NULL,
  milestone INT NOT NULL,
  reward_type TEXT NOT NULL CHECK (reward_type IN ('bonus_entries','betting_time_hours','combo')),
  quantity NUMERIC(18,4) NOT NULL,
  entries_quantity INT NOT NULL DEFAULT 0,
  hours_quantity NUMERIC(10,2) NOT NULL DEFAULT 0,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  activated_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'issued'
    CHECK (status IN ('issued','activated','expired','revoked')),
  source_event TEXT,
  audit_reference TEXT,
  UNIQUE (user_id, campaign_id, milestone)
);

CREATE INDEX IF NOT EXISTS idx_referral_rewards_user ON referral_reward_ledger(user_id);

CREATE TABLE IF NOT EXISTS referral_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_id UUID REFERENCES referrals(id) ON DELETE SET NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_referral_events_created ON referral_events(created_at DESC);

-- Default campaign
INSERT INTO referral_campaigns (id, name, qualification_window_days, max_milestone, milestones, is_active)
SELECT gen_random_uuid(), 'Default 7-day milestones', 7, 20, ARRAY[5,10,15,20], TRUE
WHERE NOT EXISTS (SELECT 1 FROM referral_campaigns WHERE is_active = TRUE LIMIT 1);
