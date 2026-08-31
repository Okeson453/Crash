-- Repair: if a previous 029 attempt left no admin_config_versions table, create it.
-- Safe to re-run (IF NOT EXISTS).
CREATE TABLE IF NOT EXISTS admin_config_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL,
  payload JSONB NOT NULL,
  version INT NOT NULL,
  actor_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (key, version)
);

CREATE INDEX IF NOT EXISTS idx_admin_config_versions_key
  ON admin_config_versions (key, version DESC);
