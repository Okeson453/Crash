import { useQuery } from '@tanstack/react-query';
import { getReferralAdminOverview } from '@/api/admin';
import { LoadingSpinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Card } from '@/components/ui/Card';
import { Users, Gift, AlertTriangle } from 'lucide-react';

/**
 * Admin Referrals — overview metrics for the qualified-referral milestone program.
 * Qualification requires PAYG-or-higher confirmed subscription; rewards are promotional entitlements only.
 */
export function AdminReferralsScreen() {
  const overview = useQuery({
    queryKey: ['admin-referrals-overview'],
    queryFn: getReferralAdminOverview,
  });

  if (overview.isLoading) return <LoadingSpinner size="lg" />;

  if (!overview.data) {
    return (
      <EmptyState
        icon={Gift}
        title="Referrals overview unavailable"
        description="Referral admin endpoints will surface once the backend referral domain is fully wired."
      />
    );
  }

  const d = overview.data;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <p className="text-xs text-tg-hint">Total referrals</p>
          <p className="text-lg font-bold text-tg-text">{d.totalReferrals.toLocaleString()}</p>
        </Card>
        <Card>
          <p className="text-xs text-tg-hint">Qualified</p>
          <p className="text-lg font-bold text-tg-text">{d.qualifiedReferrals.toLocaleString()}</p>
        </Card>
        <Card>
          <p className="text-xs text-tg-hint">Pending</p>
          <p className="text-lg font-bold text-tg-text">{d.pendingReferrals.toLocaleString()}</p>
        </Card>
        <Card>
          <p className="text-xs text-tg-hint">Conversion</p>
          <p className="text-lg font-bold text-tg-text">
            {(d.conversionRate * 100).toFixed(1)}%
          </p>
        </Card>
      </div>
      <Card className="space-y-2">
        <div className="flex items-center gap-2">
          <Gift className="h-4 w-4 text-tg-link" />
          <p className="text-sm font-semibold text-tg-text">Rewards</p>
        </div>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <p className="text-xs text-tg-hint">Issued</p>
            <p className="font-medium text-tg-text">{d.rewardsIssued}</p>
          </div>
          <div>
            <p className="text-xs text-tg-hint">Pending</p>
            <p className="font-medium text-tg-text">{d.rewardsPending}</p>
          </div>
          <div>
            <p className="text-xs text-tg-hint">Expired</p>
            <p className="font-medium text-tg-text">{d.rewardsExpired}</p>
          </div>
          <div>
            <p className="text-xs text-tg-hint">Revoked</p>
            <p className="font-medium text-tg-text">{d.rewardsRevoked}</p>
          </div>
        </div>
      </Card>
      {d.topReferrers && d.topReferrers.length > 0 && (
        <Card className="space-y-2">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-tg-link" />
            <p className="text-sm font-semibold text-tg-text">Top referrers</p>
          </div>
          {d.topReferrers.map((r) => (
            <div
              key={r.userId}
              className="flex justify-between py-1 border-b border-tg-hint/10 last:border-0 text-sm"
            >
              <span className="text-tg-text">@{r.username || r.userId.slice(0, 8)}</span>
              <span className="text-tg-hint">{r.qualifiedCount} qualified</span>
            </div>
          ))}
        </Card>
      )}
      <Card className="flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 text-cw-warning shrink-0 mt-0.5" />
        <p className="text-xs text-tg-hint">
          Only PAYG-or-higher confirmed subscriptions qualify. Self-referrals, duplicates,
          refunds and chargebacks are rejected. Rewards are promotional (entries / betting time),
          never withdrawable cash.
        </p>
      </Card>
    </div>
  );
}
