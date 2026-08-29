export type ReferralStatus =
  | 'PENDING'
  | 'SUBSCRIPTION_REQUIRED'
  | 'PAYMENT_PENDING'
  | 'QUALIFIED'
  | 'REWARD_COUNTED'
  | 'REJECTED_DUPLICATE'
  | 'REJECTED_SELF_REFERRAL'
  | 'REJECTED_FRAUD'
  | 'REJECTED_REFUND'
  | 'REJECTED_CHARGEBACK'
  | 'REJECTED_INVALID';

export type ReferrerPlan = 'Observer' | 'Pay-as-You-Go' | 'Starter' | 'Pro' | 'Whale';

export interface MilestoneReward {
  milestone: number;
  entries: number;
  hours: number;
  rewardType: 'bonus_entries' | 'betting_time_hours' | 'combo';
}

export interface ReferralProgressView {
  qualifiedCount: number;
  maxMilestone: number;
  nextMilestone: number | null;
  nextRewardPreview: string | null;
  referralCode: string;
  referralLink: string;
  pendingCount: number;
  campaignEndsAt: string | null;
}

export interface ReferralActivityView {
  id: string;
  status: ReferralStatus;
  referredUsername: string | null;
  createdAt: string;
}

export interface ReferralAdminOverview {
  totalReferrals: number;
  qualifiedReferrals: number;
  pendingReferrals: number;
  conversionRate: number;
  rewardsIssued: number;
  rewardsPending: number;
  rewardsExpired: number;
  rewardsRevoked: number;
  topReferrers: Array<{ userId: string; username?: string; qualifiedCount: number }>;
}
