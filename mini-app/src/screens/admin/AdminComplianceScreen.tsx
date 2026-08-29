import { useQuery } from '@tanstack/react-query';
import { getComplianceSettings, getSelfExclusionList, getKycOverview } from '@/api/admin';
import { LoadingSpinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Shield, Ban, UserCheck } from 'lucide-react';

export function AdminComplianceScreen() {
  const rg = useQuery({ queryKey: ['admin-compliance-rg'], queryFn: getComplianceSettings });
  const exclusions = useQuery({
    queryKey: ['admin-self-exclusion'],
    queryFn: getSelfExclusionList,
  });
  const kyc = useQuery({ queryKey: ['admin-kyc'], queryFn: getKycOverview });

  if (rg.isLoading) return <LoadingSpinner size="lg" />;

  if (!rg.data && !kyc.data) {
    return (
      <EmptyState
        icon={Shield}
        title="Compliance data unavailable"
        description="Responsible-gaming and KYC endpoints are not yet returning data."
      />
    );
  }

  return (
    <div className="space-y-4">
      {rg.data && (
        <Card className="space-y-2">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-tg-link" />
            <p className="text-sm font-semibold text-tg-text">Responsible gaming</p>
          </div>
          <div className="grid grid-cols-1 gap-2 text-sm">
            <div className="flex justify-between">
              <span className="text-tg-hint">Bet cooldown</span>
              <span className="text-tg-text">{rg.data.betCooldownMinutes} min</span>
            </div>
            <div className="flex justify-between">
              <span className="text-tg-hint">Max loss / day</span>
              <span className="text-tg-text">{rg.data.maxLossPerDay}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-tg-hint">Max session hours</span>
              <span className="text-tg-text">{rg.data.maxSessionHours}</span>
            </div>
          </div>
        </Card>
      )}
      {kyc.data && (
        <Card className="space-y-3">
          <div className="flex items-center gap-2">
            <UserCheck className="h-4 w-4 text-tg-link" />
            <p className="text-sm font-semibold text-tg-text">KYC overview</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-lg font-bold text-tg-text">{kyc.data.verified}</p>
              <p className="text-xs text-tg-hint">Verified</p>
            </div>
            <div>
              <p className="text-lg font-bold text-tg-text">{kyc.data.pending}</p>
              <p className="text-xs text-tg-hint">Pending</p>
            </div>
            <div>
              <p className="text-lg font-bold text-tg-text">{kyc.data.rejected}</p>
              <p className="text-xs text-tg-hint">Rejected</p>
            </div>
            <div>
              <p className="text-lg font-bold text-tg-text">{kyc.data.total}</p>
              <p className="text-xs text-tg-hint">Total</p>
            </div>
          </div>
        </Card>
      )}
      {exclusions.data && exclusions.data.length > 0 && (
        <Card className="space-y-2">
          <div className="flex items-center gap-2">
            <Ban className="h-4 w-4 text-tg-link" />
            <p className="text-sm font-semibold text-tg-text">
              Self-exclusions ({exclusions.data.length})
            </p>
          </div>
          {exclusions.data.map((se) => (
            <div
              key={se.id}
              className="flex items-center justify-between py-2 border-b border-tg-hint/10 last:border-0"
            >
              <div>
                <p className="text-sm text-tg-text">@{se.userName}</p>
                <p className="text-xs text-tg-hint">
                  Until {new Date(se.expiresAt).toLocaleDateString()}
                </p>
              </div>
              <Badge variant={se.isPermanent ? 'danger' : 'warning'}>
                {se.isPermanent ? 'Permanent' : 'Temporary'}
              </Badge>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
