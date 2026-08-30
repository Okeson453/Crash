-- Real org tenants (issue 11) — JWT tenantId must not equal user.id
CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL DEFAULT 'default',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);

INSERT INTO tenants (id, name)
SELECT gen_random_uuid(), 'personal-' || u.id::text
FROM users u
WHERE u.tenant_id IS NULL
  AND NOT EXISTS (SELECT 1 FROM tenants t WHERE t.name = 'personal-' || u.id::text);

UPDATE users u
SET tenant_id = t.id
FROM tenants t
WHERE u.tenant_id IS NULL AND t.name = 'personal-' || u.id::text;

CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON users(tenant_id);
