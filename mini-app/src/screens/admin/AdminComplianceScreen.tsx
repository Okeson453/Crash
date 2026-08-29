import { useQuery } from '@tanstack/react-query';
import { getComplianceSettings, getSelfExclusionList, getKycOverview } from '@/api/admin';
import { KycOverviewCard } from '@/components/admin/KycOverviewCard';
import { SelfExclusionList } from '@/components/admin/SelfExclusionList';
import { LoadingSpinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Card } from '@/components/ui/Card';
import { Shield } from 'lucide-react';

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
      {kyc.data && <KycOverviewCard overview={kyc.data} />}
      {exclusions.data && <SelfExclusionList exclusions={exclusions.data} />}
    </div>
  );
}
