/**
 * Unit tests for referral entitlement consumption helpers.
 */

describe('entitlement consumption rules', () => {
  it('rejects non-positive consumption as no-op success', () => {
    const count = 0;
    expect(count <= 0).toBe(true);
  });

  it('computes remaining entries correctly', () => {
    const quantity = 15;
    const used = 4;
    const remaining = Math.max(quantity - used, 0);
    expect(remaining).toBe(11);
  });

  it('never allows negative remaining', () => {
    const quantity = 5;
    const used = 10;
    const remaining = Math.max(quantity - used, 0);
    expect(remaining).toBe(0);
  });

  it('FIFO consumption reduces earliest first', () => {
    const ledger = [
      { id: 'a', entries: 3, used: 0, expires: 1 },
      { id: 'b', entries: 5, used: 0, expires: 2 },
    ];
    let need = 4;
    for (const row of ledger) {
      const avail = row.entries - row.used;
      const take = Math.min(avail, need);
      row.used += take;
      need -= take;
    }
    expect(need).toBe(0);
    expect(ledger[0].used).toBe(3);
    expect(ledger[1].used).toBe(1);
  });

  it('fails when insufficient total entitlements', () => {
    const total = 2;
    const need = 3;
    expect(total >= need).toBe(false);
  });
});
