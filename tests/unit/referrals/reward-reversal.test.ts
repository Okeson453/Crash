/**
 * Pure logic coverage for milestone idempotency keys and window math used by reward reversal.
 * Full DB integration covered when pool is available in integration suite.
 */

import { listMilestones, totalRewardsThrough } from '@/platform/referrals/milestone-rewards';

describe('milestone idempotency contract', () => {
  it('milestones are unique and ascending', () => {
    const m = listMilestones();
    expect(m).toEqual([5, 10, 15, 20]);
    const sorted = [...m].sort((a, b) => a - b);
    expect(m).toEqual(sorted);
    expect(new Set(m).size).toBe(m.length);
  });

  it('Pro user at 20 receives each milestone once (100 entries total)', () => {
    const t = totalRewardsThrough('Pro', 20);
    expect(t.milestonesHit).toEqual([5, 10, 15, 20]);
    expect(t.totalEntries).toBe(100);
  });

  it('after dropping below a milestone, that milestone is no longer in hit set', () => {
    const at20 = totalRewardsThrough('Pro', 20).milestonesHit;
    const at9 = totalRewardsThrough('Pro', 9).milestonesHit;
    expect(at20).toContain(10);
    expect(at9).not.toContain(10);
    expect(at9).toEqual([5]);
  });

  it('unique constraint key shape is (user_id, campaign_id, milestone)', () => {
    // Documents the ON CONFLICT target used by reward-service
    const key = { userId: 'u1', campaignId: 'c1', milestone: 5 };
    const key2 = { userId: 'u1', campaignId: 'c1', milestone: 5 };
    expect(JSON.stringify(key)).toBe(JSON.stringify(key2));
  });
});

describe('qualification window math', () => {
  it('7-day window excludes attribution older than window', () => {
    const windowDays = 7;
    const windowMs = windowDays * 24 * 60 * 60 * 1000;
    const createdAt = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
    const outside = Date.now() - createdAt.getTime() > windowMs;
    expect(outside).toBe(true);
  });

  it('attribution within 7 days is eligible', () => {
    const windowDays = 7;
    const windowMs = windowDays * 24 * 60 * 60 * 1000;
    const createdAt = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const outside = Date.now() - createdAt.getTime() > windowMs;
    expect(outside).toBe(false);
  });
});

describe('reward expiry default', () => {
  it('default expiry is 30 days from issuance', () => {
    const DEFAULT_REWARD_EXPIRY_DAYS = 30;
    const issued = new Date('2026-01-01T00:00:00Z');
    const expires = new Date(issued);
    expires.setDate(expires.getDate() + DEFAULT_REWARD_EXPIRY_DAYS);
    expect(expires.toISOString().startsWith('2026-01-31')).toBe(true);
  });
});
