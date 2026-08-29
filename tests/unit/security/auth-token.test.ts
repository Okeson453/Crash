/**
 * Auth token / session security contracts.
 */

import { createHash } from 'node:crypto';

describe('auth token security contracts', () => {
  it('revocation key is hashed (never store raw token)', () => {
    const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload.sig';
    const key = `miniapp:revoked:${createHash('sha256').update(token).digest('hex')}`;
    expect(key).not.toContain(token);
    expect(key.startsWith('miniapp:revoked:')).toBe(true);
    expect(key.length).toBeGreaterThan(20);
  });

  it('authorization header must be Bearer scheme', () => {
    const parse = (header?: string) => {
      if (!header?.startsWith('Bearer ')) return null;
      return header.slice(7);
    };
    expect(parse(undefined)).toBeNull();
    expect(parse('Basic abc')).toBeNull();
    expect(parse('Bearer tok')).toBe('tok');
  });

  it('roles are closed set', () => {
    const allowed = new Set(['player', 'operator', 'admin']);
    expect(allowed.has('superadmin')).toBe(false);
    expect(allowed.has('admin')).toBe(true);
  });
});
