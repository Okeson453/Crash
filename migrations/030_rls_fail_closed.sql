-- P0-02: Tenant isolation fail-closed — missing tenant context DENIES access
CREATE OR REPLACE FUNCTION app_is_platform() RETURNS BOOLEAN AS $$
BEGIN
  RETURN COALESCE(current_setting('app.platform_role', true), '') IN ('control_plane', 'migration', 'superuser');
EXCEPTION WHEN OTHERS THEN
  RETURN false;
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION app_current_tenant() RETURNS UUID AS $$
BEGIN
  RETURN NULLIF(current_setting('app.tenant_id', true), '')::UUID;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;

-- Engine tables: require platform OR (tenant set AND match)
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'sessions', 'bets', 'rounds', 'daily_stats', 'balance_snapshots',
    'analytics_snapshots', 'health_checks', 'config_versions', 'predictions',
    'mini_app_bets', 'mini_app_rounds', 'mini_app_balances'
  ]
  LOOP
    BEGIN
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
      EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
      EXECUTE format(
        'CREATE POLICY tenant_isolation ON %I
           USING (
             app_is_platform()
             OR (app_current_tenant() IS NOT NULL AND tenant_id = app_current_tenant())
           )
           WITH CHECK (
             app_is_platform()
             OR (app_current_tenant() IS NOT NULL AND tenant_id = app_current_tenant())
           )',
        t
      );
    EXCEPTION WHEN undefined_table THEN
      RAISE NOTICE 'skip %', t;
    WHEN undefined_column THEN
      RAISE NOTICE 'skip % (no tenant_id)', t;
    END;
  END LOOP;
END $$;
