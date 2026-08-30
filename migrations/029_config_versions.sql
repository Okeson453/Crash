CREATE TABLE IF NOT EXISTS config_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL,
  payload JSONB NOT NULL,
  version INT NOT NULL,
  actor_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (key, version)
);
CREATE INDEX IF NOT EXISTS idx_config_versions_key ON config_versions(key, version DESC);
