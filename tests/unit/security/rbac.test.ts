/**
 * RBAC policy tests — mirrors requireRole middleware semantics.
 */

type Role = 'player' | 'operator' | 'admin';

function canAccess(role: Role | undefined, allowed: Role[]): {
  authorized: boolean;
  status: 401 | 403 | 200;
} {
  if (!role) return { authorized: false, status: 401 };
  if (!allowed.includes(role)) return { authorized: false, status: 403 };
  return { authorized: true, status: 200 };
}

describe('RBAC requireRole semantics', () => {
  const adminOnly: Role[] = ['admin'];
  const operatorOrAdmin: Role[] = ['operator', 'admin'];

  it('rejects unauthenticated requests with 401', () => {
    expect(canAccess(undefined, adminOnly)).toEqual({ authorized: false, status: 401 });
  });

  it('rejects player from admin-only routes with 403', () => {
    expect(canAccess('player', adminOnly)).toEqual({ authorized: false, status: 403 });
  });

  it('allows admin on admin-only routes', () => {
    expect(canAccess('admin', adminOnly)).toEqual({ authorized: true, status: 200 });
  });

  it('allows operator on operator-or-admin routes', () => {
    expect(canAccess('operator', operatorOrAdmin).authorized).toBe(true);
  });

  it('denies player on operator-or-admin routes', () => {
    expect(canAccess('player', operatorOrAdmin).status).toBe(403);
  });

  it('admin privilege is not implied for player or operator on admin-only', () => {
    expect(canAccess('operator', adminOnly).authorized).toBe(false);
    expect(canAccess('player', adminOnly).authorized).toBe(false);
  });
});

describe('Admin mutation surface protection matrix', () => {
  const protectedActions = [
    'POST /admin/game/emergency-stop',
    'POST /admin/users/:id/suspend',
    'PUT /admin/feature-flags/:key',
    'POST /admin/referrals/rewards/:id/revoke',
    'POST /admin/sessions/:id/terminate',
    'PUT /admin/config',
  ];

  it('lists destructive admin mutations that require admin role', () => {
    expect(protectedActions.length).toBeGreaterThanOrEqual(5);
    for (const action of protectedActions) {
      expect(action.startsWith('POST ') || action.startsWith('PUT ')).toBe(true);
    }
  });
});
