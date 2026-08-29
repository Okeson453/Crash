/**
 * Referral qualification → milestone → reward flow (pure logic acceptance).
 * Documents the critical E2E path required by the specification.
 */

import {
  isQualifyingPlanName,
} from '@/platform/referrals/qualification-service';
import {
  listMilestones,
  rewardForMilestone,
  totalRewardsThrough,
  nextMilestone,
} from '@/platform/referrals/milestone-rewards';

type Status =
  | 'PENDING'
  | 'SUBSCRIPTION_REQUIRED'
  | 'PAYMENT_PENDING'
  | 'QUALIFIED'
  | 'REWARD_COUNTED'
  | 'REJECTED_SELF_REFERRAL'
  | 'REJECTED_DUPLICATE'
  | 'REJECTED_REFUND'
  | 'REJECTED_CHARGEBACK'
  | 'REJECTED_INVALID';

interface Referral {
  referrerId: string;
  referredId: string;
  status: Status;
  createdAt: number;
  qualifiedAt?: number;
}

interface LedgerRow {
  userId: string;
  tenantId: string;
  campaignId: string;
  milestone: number;
  entries: number;
  hours: number;
  status: 'activated' | 'revoked' | 'expired';
}

function attribute(referrerId: string, referredId: string, now = Date.now()): Referral | { error: string } {
  if (referrerId === referredId) return { error: 'self_referral' };
  return { referrerId, referredId, status: 'PENDING', createdAt: now };
}

function qualify(
  ref: Referral,
  planName: string,
  windowDays = 7,
  now = Date.now()
): Referral | { error: string } {
  if (ref.referrerId === ref.referredId) return { error: 'self_referral' };
  if (!isQualifyingPlanName(planName)) {
    return { ...ref, status: 'SUBSCRIPTION_REQUIRED' };
  }
  const windowMs = windowDays * 24 * 60 * 60 * 1000;
  if (now - ref.createdAt > windowMs) {
    return { ...ref, status: 'REJECTED_INVALID' };
  }
  return { ...ref, status: 'QUALIFIED', qualifiedAt: now };
}

function issueMilestones(
  referrerId: string,
  qualifiedCount: number,
  plan: 'Pro' | 'Observer' | 'Starter' | 'Whale' | 'Pay-as-You-Go',
  existing: LedgerRow[],
  campaignId = 'c1'
): LedgerRow[] {
  const issued = [...existing];
  for (const m of listMilestones()) {
    if (qualifiedCount < m) continue;
    if (issued.some((r) => r.userId === referrerId && r.campaignId === campaignId && r.milestone === m)) {
      continue; // idempotent
    }
    const reward = rewardForMilestone(plan, m);
    if (!reward) continue;
    issued.push({
      userId: referrerId,
      tenantId: referrerId,
      campaignId,
      milestone: m,
      entries: reward.entries,
      hours: reward.hours,
      status: 'activated',
    });
  }
  return issued;
}

function invalidateAndReverse(
  refs: Referral[],
  referredId: string,
  reason: 'REJECTED_REFUND' | 'REJECTED_CHARGEBACK',
  ledger: LedgerRow[],
  _plan: 'Pro'
): { refs: Referral[]; ledger: LedgerRow[] } {
  const updatedRefs = refs.map((r) =>
    r.referredId === referredId && (r.status === 'QUALIFIED' || r.status === 'REWARD_COUNTED')
      ? { ...r, status: reason, qualifiedAt: undefined }
      : r
  );
  const stillQualified = updatedRefs.filter((r) => r.status === 'QUALIFIED' || r.status === 'REWARD_COUNTED')
    .length;
  const updatedLedger = ledger.map((row) => {
    if (stillQualified >= row.milestone) return row;
    return { ...row, status: 'revoked' as const };
  });
  return { refs: updatedRefs, ledger: updatedLedger };
}

describe('referral E2E logic path', () => {
  const referrer = 'user-a';
  const campaign = 'campaign-default';

  it('full happy path: attribute → PAYG → qualify → milestone reward', () => {
    const attr = attribute(referrer, 'user-b');
    expect('error' in attr).toBe(false);
    let ref = attr as Referral;
    expect(ref.status).toBe('PENDING');

    // Observer does not qualify
    ref = qualify(ref, 'Observer') as Referral;
    expect(ref.status).toBe('SUBSCRIPTION_REQUIRED');

    // PAYG qualifies
    ref = qualify({ ...ref, status: 'PENDING' }, 'Pay-as-You-Go') as Referral;
    expect(ref.status).toBe('QUALIFIED');

    let ledger: LedgerRow[] = [];
    // Simulate 5 qualified
    ledger = issueMilestones(referrer, 5, 'Pro', ledger, campaign);
    expect(ledger).toHaveLength(1);
    expect(ledger[0].milestone).toBe(5);
    expect(ledger[0].entries).toBe(25);
    expect(ledger[0].tenantId).toBe(referrer);

    // 20 qualified → 4 milestones, 100 entries
    ledger = issueMilestones(referrer, 20, 'Pro', ledger, campaign);
    expect(ledger).toHaveLength(4);
    expect(ledger.reduce((s, r) => s + r.entries, 0)).toBe(100);

    // Idempotent re-issue
    const again = issueMilestones(referrer, 20, 'Pro', ledger, campaign);
    expect(again).toHaveLength(4);
  });

  it('rejects self-referral', () => {
    const r = attribute(referrer, referrer);
    expect(r).toEqual({ error: 'self_referral' });
  });

  it('rejects outside 7-day window', () => {
    const old = attribute(referrer, 'user-c', Date.now() - 8 * 24 * 60 * 60 * 1000) as Referral;
    const result = qualify(old, 'Pro');
    expect((result as Referral).status).toBe('REJECTED_INVALID');
  });

  it('refund invalidation reverses unearned milestones', () => {
    const refs: Referral[] = [];
    for (let i = 0; i < 10; i++) {
      refs.push({
        referrerId: referrer,
        referredId: `u-${i}`,
        status: 'QUALIFIED',
        createdAt: Date.now(),
        qualifiedAt: Date.now(),
      });
    }
    let ledger = issueMilestones(referrer, 10, 'Pro', [], campaign);
    expect(ledger.map((l) => l.milestone)).toEqual([5, 10]);

    // Invalidate 6 referrals → stillQualified = 4 → both milestones revoked
    for (let i = 0; i < 6; i++) {
      const out = invalidateAndReverse(refs, `u-${i}`, 'REJECTED_REFUND', ledger, 'Pro');
      refs.splice(0, refs.length, ...out.refs);
      ledger = out.ledger;
    }
    const stillQ = refs.filter((r) => r.status === 'QUALIFIED').length;
    expect(stillQ).toBe(4);
    expect(ledger.every((l) => l.status === 'revoked')).toBe(true);
  });

  it('progress helpers align with milestones', () => {
    expect(nextMilestone(0)).toBe(5);
    expect(nextMilestone(5)).toBe(10);
    expect(totalRewardsThrough('Whale', 20).totalEntries).toBe(140);
  });
});
