import { useQuery } from '@tanstack/react-query';
import { getComplianceSettings, getSelfExclusionList, getKycOverview } from '@/api/admin';
import { RgSettingsForm } from '@/components/admin/RgSettingsForm';
import { KycOverviewCard } from '@/components/admin/KycOverviewCard';
import { SelfExclusionList } from '@/components/admin/SelfExclusionList';
import { LoadingSpinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
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
      {rg.data && <RgSettingsForm settings={rg.data} />}
      {kyc.data && <KycOverviewCard overview={kyc.data} />}
      {exclusions.data && <SelfExclusionList exclusions={exclusions.data} />}
    </div>
  );
}
