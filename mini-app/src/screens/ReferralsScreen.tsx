/**
 * User/Tenant Referrals page — qualified-referral milestone program.
 * A referral qualifies only after PAYG-or-higher subscription is confirmed.
 * Rewards are promotional entitlements (entries / betting time), not cash.
 */
import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/client';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { LoadingSpinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Progress } from '@/components/ui/Progress';
import { Gift, Copy, Share2, Users } from 'lucide-react';
import { useUIStore } from '@/stores/uiStore';

interface ReferralProgress {
  qualifiedCount: number;
  maxMilestone: number;
  nextMilestone: number | null;
  nextRewardPreview: string | null;
  referralCode: string;
  referralLink: string;
  pendingCount: number;
  campaignEndsAt?: string | null;
}

interface ReferralActivityItem {
  id: string;
  status: string;
  referredUsername?: string | null;
  createdAt: string;
}

async function getMyReferralProgress(): Promise<ReferralProgress> {
  return api.get<ReferralProgress>('/api/v1/referrals/me');
}

async function getMyReferralActivity(): Promise<ReferralActivityItem[]> {
  return api.get<ReferralActivityItem[]>('/api/v1/referrals/me/activity');
}

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Pending',
  SUBSCRIPTION_REQUIRED: 'Subscription required',
  PAYMENT_PENDING: 'Payment pending',
  QUALIFIED: 'Qualified',
  REWARD_COUNTED: 'Reward counted',
  REJECTED_DUPLICATE: 'Rejected — duplicate',
  REJECTED_SELF_REFERRAL: 'Rejected — self referral',
  REJECTED_FRAUD: 'Rejected — fraud',
  REJECTED_REFUND: 'Rejected — refund',
  REJECTED_CHARGEBACK: 'Rejected — chargeback',
  REJECTED_INVALID: 'Rejected — invalid',
};

export function ReferralsScreen() {
  const addToast = useUIStore((s) => s.addToast);
  const progress = useQuery({ queryKey: ['referrals-me'], queryFn: getMyReferralProgress });
  const activity = useQuery({
    queryKey: ['referrals-activity'],
    queryFn: getMyReferralActivity,
  });

  if (progress.isLoading) return <LoadingSpinner size="lg" />;

  if (!progress.data) {
    return (
      <div className="page-container px-4 py-4">
        <EmptyState
          icon={Gift}
          title="Referrals unavailable"
          description="Referral progress will appear once the referral service is connected."
        />
      </div>
    );
  }

  const p = progress.data;
  const pct =
    p.maxMilestone > 0 ? Math.min(100, Math.round((p.qualifiedCount / p.maxMilestone) * 100)) : 0;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(p.referralLink || p.referralCode);
      addToast({ type: 'success', message: 'Referral link copied.' });
    } catch {
      addToast({ type: 'error', message: 'Could not copy link.' });
    }
  };

  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join CrashWave',
          text: 'Play CrashWave with my referral link',
          url: p.referralLink,
        });
      } catch {
        /* user cancelled */
      }
    } else {
      void copyLink();
    }
  };

  return (
    <div className="page-container px-4 py-4 space-y-4">
      <Card className="space-y-3">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-tg-link" />
          <p className="text-sm font-semibold text-tg-text">Qualified referrals</p>
        </div>
        <p className="text-2xl font-bold text-tg-text">
          {p.qualifiedCount} / {p.maxMilestone}
        </p>
        <Progress value={pct} />
        {p.nextMilestone != null && (
          <p className="text-xs text-tg-hint">
            Next milestone: {p.nextMilestone}
            {p.nextRewardPreview ? ` · ${p.nextRewardPreview}` : ''}
          </p>
        )}
        {p.pendingCount > 0 && (
          <p className="text-xs text-tg-hint">{p.pendingCount} pending qualification</p>
        )}
      </Card>

      <Card className="space-y-3">
        <p className="text-sm font-semibold text-tg-text">Your referral link</p>
        <p className="text-xs text-tg-hint break-all font-mono">
          {p.referralLink || p.referralCode || '—'}
        </p>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={() => void copyLink()}>
            <Copy className="mr-2 h-4 w-4" /> Copy link
          </Button>
          <Button onClick={() => void share()}>
            <Share2 className="mr-2 h-4 w-4" /> Invite friends
          </Button>
        </div>
      </Card>

      <Card className="space-y-2">
        <p className="text-sm font-semibold text-tg-text">How it works</p>
        <ul className="text-xs text-tg-hint space-y-1 list-disc pl-4">
          <li>Share your link with new users</li>
          <li>They must subscribe to Pay-as-You-Go or higher</li>
          <li>Payment must confirm without refund/chargeback</li>
          <li>Milestones at 5, 10, 15 and 20 qualified referrals (7-day window)</li>
          <li>Rewards are bonus entries / betting time — not withdrawable cash</li>
        </ul>
      </Card>

      <div className="space-y-2">
        <p className="text-sm font-semibold text-tg-text">Referral activity</p>
        {activity.isLoading && <LoadingSpinner size="sm" />}
        {!activity.isLoading && !(activity.data?.length) && (
          <Card>
            <p className="text-sm text-tg-hint">No referrals yet. Share your link to get started.</p>
          </Card>
        )}
        {(activity.data ?? []).map((item) => (
          <Card key={item.id} className="flex items-center justify-between py-3">
            <div>
              <p className="text-sm text-tg-text">
                @{item.referredUsername || 'user'}
              </p>
              <p className="text-xs text-tg-hint">
                {new Date(item.createdAt).toLocaleDateString()}
              </p>
            </div>
            <Badge
              variant={
                item.status === 'QUALIFIED' || item.status === 'REWARD_COUNTED'
                  ? 'success'
                  : item.status.startsWith('REJECTED')
                    ? 'danger'
                    : 'warning'
              }
            >
              {STATUS_LABEL[item.status] ?? item.status}
            </Badge>
          </Card>
        ))}
      </div>
    </div>
  );
}
