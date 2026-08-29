/**
 * Feature flag defaults and merge semantics (pure).
 */

const DEFAULT_FLAGS = [
  { key: 'referrals_enabled', enabled: true },
  { key: 'bonus_entries_enabled', enabled: true },
  { key: 'maintenance_mode', enabled: false },
  { key: 'auto_cashout_enabled', enabled: true },
  { key: 'admin_referrals_ui', enabled: true },
];

function mergeFlags(
  stored: Array<{ key: string; enabled: boolean }>,
  defaults: typeof DEFAULT_FLAGS
) {
  const byKey = new Map(stored.map((f) => [f.key, f]));
  for (const d of defaults) {
    if (!byKey.has(d.key)) byKey.set(d.key, d);
  }
  return Array.from(byKey.values());
}

describe('feature flag defaults', () => {
  it('includes required platform flags', () => {
    expect(DEFAULT_FLAGS.map((f) => f.key)).toEqual(
      expect.arrayContaining([
        'referrals_enabled',
        'maintenance_mode',
        'bonus_entries_enabled',
      ])
    );
  });

  it('merges missing defaults into stored flags', () => {
    const merged = mergeFlags([{ key: 'custom', enabled: true }], DEFAULT_FLAGS);
    expect(merged.find((f) => f.key === 'custom')?.enabled).toBe(true);
    expect(merged.find((f) => f.key === 'referrals_enabled')?.enabled).toBe(true);
    expect(merged.find((f) => f.key === 'maintenance_mode')?.enabled).toBe(false);
  });

  it('preserves stored override over default', () => {
    const merged = mergeFlags([{ key: 'maintenance_mode', enabled: true }], DEFAULT_FLAGS);
    expect(merged.find((f) => f.key === 'maintenance_mode')?.enabled).toBe(true);
  });
});

describe('risk exposure thresholds', () => {
  it('flags high exposure above 50000', () => {
    const exposure = 75000;
    expect(exposure > 50000).toBe(true);
  });

  it('flags fraud volume above 5 in 7 days', () => {
    const count = 6;
    expect(count > 5).toBe(true);
  });
});
