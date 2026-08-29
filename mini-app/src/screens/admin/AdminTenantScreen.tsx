import { useQuery } from '@tanstack/react-query';
import { getTenantSettings } from '@/api/admin';
import { TenantIdentityForm } from '@/components/admin/TenantIdentityForm';
import { TenantBrandingForm } from '@/components/admin/TenantBrandingForm';
import { TenantLimitsForm } from '@/components/admin/TenantLimitsForm';
import { LoadingSpinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Building2 } from 'lucide-react';

export function AdminTenantScreen() {
  const query = useQuery({
    queryKey: ['admin-tenant'],
    queryFn: getTenantSettings,
  });

  if (query.isLoading) return <LoadingSpinner size="lg" />;
  if (!query.data) {
    return (
      <EmptyState
        icon={Building2}
        title="Tenant settings unavailable"
        description="Backend tenant settings endpoint may not be configured yet."
      />
    );
  }

  const { identity, branding, limits } = query.data;

  return (
    <div className="space-y-4">
      <TenantIdentityForm identity={identity} />
      <TenantBrandingForm branding={branding} />
      <TenantLimitsForm limits={limits} />
    </div>
  );
}
