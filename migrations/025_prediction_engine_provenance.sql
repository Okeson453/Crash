-- Phase 4–8 prediction provenance / lifecycle tables (design §30)

CREATE TABLE IF NOT EXISTS prediction_model_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prediction_id VARCHAR(64) NOT NULL,
    model_name VARCHAR(128) NOT NULL,
    model_version VARCHAR(64) NOT NULL,
    probability NUMERIC(18, 8) NOT NULL,
    weight NUMERIC(18, 8),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pms_prediction ON prediction_model_scores(prediction_id);

CREATE TABLE IF NOT EXISTS prediction_calibration (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prediction_id VARCHAR(64) NOT NULL,
    raw_probability NUMERIC(18, 8) NOT NULL,
    calibrated_probability NUMERIC(18, 8) NOT NULL,
    calibration_version VARCHAR(64) NOT NULL,
    ece NUMERIC(18, 8),
    regime VARCHAR(64),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS model_performance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_name VARCHAR(128) NOT NULL,
    model_version VARCHAR(64) NOT NULL,
    ewma_log_loss NUMERIC(18, 8),
    ewma_brier NUMERIC(18, 8),
    sample_count INT NOT NULL DEFAULT 0,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_model_perf_name ON model_performance(model_name, model_version);

CREATE TABLE IF NOT EXISTS model_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_name VARCHAR(128) NOT NULL,
    model_version VARCHAR(64) NOT NULL,
    stage VARCHAR(32) NOT NULL,
    traffic_share NUMERIC(8, 4) NOT NULL DEFAULT 0,
    metrics JSONB,
    promoted_at TIMESTAMPTZ,
    notes TEXT,
    UNIQUE (model_name, model_version)
);

CREATE TABLE IF NOT EXISTS model_deployments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_name VARCHAR(128) NOT NULL,
    model_version VARCHAR(64) NOT NULL,
    stage VARCHAR(32) NOT NULL,
    traffic_share NUMERIC(8, 4) NOT NULL,
    action VARCHAR(32) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS shadow_predictions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prediction_id VARCHAR(64) NOT NULL,
    model_name VARCHAR(128) NOT NULL,
    model_version VARCHAR(64) NOT NULL,
    probability NUMERIC(18, 8) NOT NULL,
    actual_outcome SMALLINT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS opportunity_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    opportunity_id VARCHAR(64) NOT NULL,
    prediction_id VARCHAR(64) NOT NULL,
    target NUMERIC(18, 8) NOT NULL,
    score NUMERIC(18, 8) NOT NULL,
    rank INT,
    calibrated_probability NUMERIC(18, 8),
    regime VARCHAR(64),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS regime_states (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    regime_label VARCHAR(64) NOT NULL,
    confidence NUMERIC(18, 8),
    duration INT,
    sample_count INT,
    historical_hit_rate NUMERIC(18, 8),
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS feature_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prediction_id VARCHAR(64),
    feature_version VARCHAR(64) NOT NULL,
    feature_hash VARCHAR(64),
    values JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS prediction_drift (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    drift_type VARCHAR(32) NOT NULL,
    detected BOOLEAN NOT NULL,
    metric_value NUMERIC(18, 8),
    detail JSONB,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS model_drift (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_name VARCHAR(128),
    brier_short NUMERIC(18, 8),
    brier_long NUMERIC(18, 8),
    detected BOOLEAN NOT NULL DEFAULT false,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS backtest_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_name VARCHAR(128),
    model_version VARCHAR(64),
    window_from TIMESTAMPTZ,
    window_to TIMESTAMPTZ,
    metrics JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enrich predictions table with calibrated / meta columns when missing
ALTER TABLE predictions ADD COLUMN IF NOT EXISTS calibrated_probability NUMERIC(18, 8);
ALTER TABLE predictions ADD COLUMN IF NOT EXISTS raw_probability NUMERIC(18, 8);
ALTER TABLE predictions ADD COLUMN IF NOT EXISTS feature_hash VARCHAR(64);
ALTER TABLE predictions ADD COLUMN IF NOT EXISTS calibration_version VARCHAR(64);
ALTER TABLE predictions ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE predictions ADD COLUMN IF NOT EXISTS opportunity_score NUMERIC(18, 8);
ALTER TABLE predictions ADD COLUMN IF NOT EXISTS meta_probability NUMERIC(18, 8);
