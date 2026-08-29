import type { MilestoneReward, ReferrerPlan } from './types';

const MILESTONES = [5, 10, 15, 20] as const;

/** Incremental reward table from CrashWave Referral & Rewards Specification */
const INCREMENTAL: Record<ReferrerPlan, { entries: number; hours: number }> = {
  Observer: { entries: 5, hours: 1 },
  'Pay-as-You-Go': { entries: 5, hours: 1 },
  Starter: { entries: 15, hours: 0 },
  Pro: { entries: 25, hours: 0 },
  Whale: { entries: 35, hours: 0 },
};

/** Observer/PAYG scale up at higher milestones per spec */
function incrementalFor(plan: ReferrerPlan, milestone: number): { entries: number; hours: number } {
  const base = INCREMENTAL[plan];
  if (plan === 'Observer' || plan === 'Pay-as-You-Go') {
    if (milestone >= 15) return { entries: 10, hours: 2 };
    return { entries: 5, hours: 1 };
  }
  return base;
}

export function listMilestones(): readonly number[] {
  return MILESTONES;
}

export function rewardForMilestone(plan: ReferrerPlan, milestone: number): MilestoneReward | null {
  if (!MILESTONES.includes(milestone as (typeof MILESTONES)[number])) return null;
  const inc = incrementalFor(plan, milestone);
  const rewardType =
    inc.hours > 0 && inc.entries > 0 ? 'combo' : inc.hours > 0 ? 'betting_time_hours' : 'bonus_entries';
  return {
    milestone,
    entries: inc.entries,
    hours: inc.hours,
    rewardType,
  };
}

export function totalRewardsThrough(plan: ReferrerPlan, qualifiedCount: number): {
  totalEntries: number;
  totalHours: number;
  milestonesHit: number[];
} {
  let totalEntries = 0;
  let totalHours = 0;
  const milestonesHit: number[] = [];
  for (const m of MILESTONES) {
    if (qualifiedCount >= m) {
      const r = rewardForMilestone(plan, m);
      if (r) {
        totalEntries += r.entries;
        totalHours += r.hours;
        milestonesHit.push(m);
      }
    }
  }
  return { totalEntries, totalHours, milestonesHit };
}

export function nextMilestone(qualifiedCount: number): number | null {
  for (const m of MILESTONES) {
    if (qualifiedCount < m) return m;
  }
  return null;
}

export function formatRewardPreview(plan: ReferrerPlan, milestone: number): string {
  const r = rewardForMilestone(plan, milestone);
  if (!r) return '';
  const parts: string[] = [];
  if (r.hours > 0) parts.push(`${r.hours}h betting`);
  if (r.entries > 0) parts.push(`${r.entries} entries`);
  return parts.join(' + ') || 'Reward';
}

export function normalizePlanName(planName: string | null | undefined): ReferrerPlan {
  const n = (planName || '').toLowerCase();
  if (n.includes('whale')) return 'Whale';
  if (n.includes('pro')) return 'Pro';
  if (n.includes('starter')) return 'Starter';
  if (n.includes('pay') || n.includes('payg') || n.includes('pay-as')) return 'Pay-as-You-Go';
  return 'Observer';
}
