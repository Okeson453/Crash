-- Platform admin settings (JSON key-value) for durable tenant/RG/webhook config

CREATE TABLE IF NOT EXISTS platform_admin_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL
);

-- Ensure referral_campaigns has reward_config for rules admin
ALTER TABLE referral_campaigns
  ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE referral_campaigns
  ADD COLUMN IF NOT EXISTS min_plan TEXT NOT NULL DEFAULT 'payg';
