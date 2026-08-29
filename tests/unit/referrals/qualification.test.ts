import { isQualifyingPlanName } from '@/platform/referrals/qualification-service';

describe('isQualifyingPlanName', () => {
  it('rejects Observer and free', () => {
    expect(isQualifyingPlanName('Observer')).toBe(false);
    expect(isQualifyingPlanName('Free')).toBe(false);
    expect(isQualifyingPlanName('Free Plan')).toBe(false);
    expect(isQualifyingPlanName(null)).toBe(false);
    expect(isQualifyingPlanName('')).toBe(false);
    expect(isQualifyingPlanName('  ')).toBe(false);
  });

  it('accepts PAYG and higher (explicit allow-list)', () => {
    expect(isQualifyingPlanName('Pay-as-You-Go')).toBe(true);
    expect(isQualifyingPlanName('PAYG')).toBe(true);
    expect(isQualifyingPlanName('Starter')).toBe(true);
    expect(isQualifyingPlanName('Pro')).toBe(true);
    expect(isQualifyingPlanName('Whale')).toBe(true);
    expect(isQualifyingPlanName('Pro Plan')).toBe(true);
  });

  it('rejects unknown / unlisted plan names (no generic paid fallback)', () => {
    expect(isQualifyingPlanName('Enterprise')).toBe(false);
    expect(isQualifyingPlanName('Custom Gold')).toBe(false);
    expect(isQualifyingPlanName('Premium Plus')).toBe(false);
    expect(isQualifyingPlanName('vip')).toBe(false);
  });
});
