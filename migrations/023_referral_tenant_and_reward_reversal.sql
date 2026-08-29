-- Phase 1: tenant_id on reward ledger, campaign reward config, attribution window support

-- Explicit tenant scoping on promotional reward ledger (personal tenant = user in single-tenant model)
ALTER TABLE referral_reward_ledger
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES users(id) ON DELETE CASCADE;

-- Backfill tenant_id from user_id for existing rows
UPDATE referral_reward_ledger
SET tenant_id = user_id
WHERE tenant_id IS NULL;

-- Prefer NOT NULL after backfill for new installs; keep nullable for legacy safety
CREATE INDEX IF NOT EXISTS idx_referral_rewards_tenant
  ON referral_reward_ledger(tenant_id);

-- Campaign-level reward economics (configurable amounts / duration / expiry)
ALTER TABLE referral_campaigns
  ADD COLUMN IF NOT EXISTS reward_expiry_days INT NOT NULL DEFAULT 30;

ALTER TABLE referral_campaigns
  ADD COLUMN IF NOT EXISTS reward_config JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Attribution timestamp already covered by referrals.created_at; ensure index for window checks
CREATE INDEX IF NOT EXISTS idx_referrals_referrer_created
  ON referrals(referrer_id, created_at);

COMMENT ON COLUMN referral_reward_ledger.tenant_id IS
  'Personal tenant identity for multi-tenant isolation; equals user_id for personal tenants';

COMMENT ON COLUMN referral_campaigns.reward_expiry_days IS
  'Days after activation before promotional reward expires';

COMMENT ON COLUMN referral_campaigns.reward_config IS
  'Optional overrides: { "rewardAmounts": {...}, "antiAbuse": {...} }';
