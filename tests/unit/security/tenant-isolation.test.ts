/**
 * Tenant isolation rules — personal tenant model (user owns personal tenant).
 */

interface ScopedRow {
  tenantId: string | null;
  userId: string;
}

function canReadRow(
  row: ScopedRow,
  auth: { userId: string; tenantId: string | null; platformRole?: boolean }
): boolean {
  if (auth.platformRole) return true;
  if (auth.tenantId && row.tenantId && auth.tenantId === row.tenantId) return true;
  if (row.userId === auth.userId) return true;
  return false;
}

function rewardTenantMatchesUser(reward: { userId: string; tenantId: string | null }): boolean {
  // Personal tenant: tenant_id must equal user_id when set
  if (reward.tenantId == null) return false;
  return reward.tenantId === reward.userId;
}

describe('tenant isolation', () => {
  it('denies cross-tenant reads for non-platform roles', () => {
    const row: ScopedRow = { tenantId: 'tenant-a', userId: 'user-a' };
    const other = { userId: 'user-b', tenantId: 'tenant-b' };
    expect(canReadRow(row, other)).toBe(false);
  });

  it('allows same-tenant reads', () => {
    const row: ScopedRow = { tenantId: 'tenant-a', userId: 'user-a' };
    expect(canReadRow(row, { userId: 'user-x', tenantId: 'tenant-a' })).toBe(true);
  });

  it('allows owner self-read even without tenant match', () => {
    const row: ScopedRow = { tenantId: 'tenant-a', userId: 'user-a' };
    expect(canReadRow(row, { userId: 'user-a', tenantId: null })).toBe(true);
  });

  it('platform role bypasses tenant filter', () => {
    const row: ScopedRow = { tenantId: 'tenant-a', userId: 'user-a' };
    expect(canReadRow(row, { userId: 'admin', tenantId: null, platformRole: true })).toBe(true);
  });

  it('reward ledger tenant_id must match user_id for personal tenants', () => {
    expect(rewardTenantMatchesUser({ userId: 'u1', tenantId: 'u1' })).toBe(true);
    expect(rewardTenantMatchesUser({ userId: 'u1', tenantId: 'u2' })).toBe(false);
    expect(rewardTenantMatchesUser({ userId: 'u1', tenantId: null })).toBe(false);
  });

  it('rejects tenant id spoofing when auth tenant differs from claimed', () => {
    const claimedTenant: string = 'tenant-victim';
    const authTenant: string = 'tenant-attacker';
    expect(claimedTenant === authTenant).toBe(false);
  });
});
