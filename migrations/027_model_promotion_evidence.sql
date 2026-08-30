CREATE TABLE IF NOT EXISTS model_promotion_evidence (
  model_name TEXT PRIMARY KEY,
  walk_forward_id TEXT,
  oos_skill DOUBLE PRECISION,
  ece DOUBLE PRECISION,
  approved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_by TEXT,
  notes TEXT
);
