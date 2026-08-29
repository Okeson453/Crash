import {
  formatRewardPreview,
  listMilestones,
  nextMilestone,
  normalizePlanName,
  rewardForMilestone,
  totalRewardsThrough,
} from '@/platform/referrals/milestone-rewards';

describe('referral milestone rewards', () => {
  it('exposes milestones 5,10,15,20', () => {
    expect(listMilestones()).toEqual([5, 10, 15, 20]);
  });

  it('returns next milestone correctly', () => {
    expect(nextMilestone(0)).toBe(5);
    expect(nextMilestone(5)).toBe(10);
    expect(nextMilestone(19)).toBe(20);
    expect(nextMilestone(20)).toBeNull();
  });

  it('Pro incremental rewards total 100 entries at 20 qualified', () => {
    const t = totalRewardsThrough('Pro', 20);
    expect(t.totalEntries).toBe(100);
    expect(t.milestonesHit).toEqual([5, 10, 15, 20]);
  });

  it('Starter is 15 entries per milestone', () => {
    const r = rewardForMilestone('Starter', 5);
    expect(r?.entries).toBe(15);
    expect(r?.hours).toBe(0);
  });

  it('Whale is 35 entries per milestone', () => {
    expect(rewardForMilestone('Whale', 10)?.entries).toBe(35);
  });

  it('Observer gets hours + entries and scales at 15+', () => {
    const m5 = rewardForMilestone('Observer', 5);
    expect(m5?.hours).toBe(1);
    expect(m5?.entries).toBe(5);
    const m15 = rewardForMilestone('Observer', 15);
    expect(m15?.hours).toBe(2);
    expect(m15?.entries).toBe(10);
  });

  it('formats reward preview', () => {
    expect(formatRewardPreview('Pro', 5)).toContain('25 entries');
    expect(formatRewardPreview('Observer', 5)).toMatch(/1h/);
  });

  it('normalizes plan names', () => {
    expect(normalizePlanName('Pro Plan')).toBe('Pro');
    expect(normalizePlanName(null)).toBe('Observer');
    expect(normalizePlanName('payg')).toBe('Pay-as-You-Go');
  });
});
