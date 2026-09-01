-- Outbox poll was failing: claim_event_outbox is SECURITY DEFINER but still subject
-- to RLS when the function owner is not a BYPASSRLS role / not the table owner on
-- some managed Postgres setups. Disable row_security inside the definer functions
-- and grant execute so the control-plane publisher can claim reliably.

CREATE OR REPLACE FUNCTION claim_event_outbox(p_limit INTEGER)
RETURNS TABLE(event_id TEXT, event_type TEXT, payload JSONB, correlation_id TEXT, source TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
BEGIN
  RETURN QUERY
  WITH claimed AS (
    SELECT eo.event_id
    FROM event_outbox eo
    WHERE eo.published_at IS NULL
      AND (eo.claimed_at IS NULL OR eo.claimed_at < NOW() - INTERVAL '60 seconds')
    ORDER BY eo.created_at
    FOR UPDATE SKIP LOCKED
    LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 50), 200))
  )
  UPDATE event_outbox eo
  SET claimed_at = NOW()
  FROM claimed c
  WHERE eo.event_id = c.event_id
  RETURNING eo.event_id, eo.event_type, eo.payload, eo.correlation_id, eo.source;
END;
$$;

CREATE OR REPLACE FUNCTION mark_event_outbox_published(p_event_id TEXT)
RETURNS VOID
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  UPDATE event_outbox
  SET published_at = NOW(), claimed_at = NULL, attempts = attempts + 1
  WHERE event_id = p_event_id;
$$;

CREATE OR REPLACE FUNCTION mark_event_outbox_failed(p_event_id TEXT, p_error TEXT)
RETURNS VOID
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  UPDATE event_outbox
  SET claimed_at = NULL, attempts = attempts + 1, last_error = left(p_error, 2000)
  WHERE event_id = p_event_id;
$$;

CREATE OR REPLACE FUNCTION enqueue_outbox_event(
  p_event_id TEXT,
  p_event_type TEXT,
  p_payload JSONB,
  p_correlation_id TEXT,
  p_source TEXT
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
BEGIN
  INSERT INTO event_outbox(event_id, event_type, payload, correlation_id, source)
  VALUES (p_event_id, p_event_type, p_payload, p_correlation_id, p_source)
  ON CONFLICT (event_id) DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION claim_event_outbox(INTEGER) TO PUBLIC;
GRANT EXECUTE ON FUNCTION mark_event_outbox_published(TEXT) TO PUBLIC;
GRANT EXECUTE ON FUNCTION mark_event_outbox_failed(TEXT, TEXT) TO PUBLIC;
GRANT EXECUTE ON FUNCTION enqueue_outbox_event(TEXT, TEXT, JSONB, TEXT, TEXT) TO PUBLIC;
