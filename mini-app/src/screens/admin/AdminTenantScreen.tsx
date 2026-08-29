import { useQuery } from '@tanstack/react-query';
import { getTenantSettings } from '@/api/admin';
import { LoadingSpinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Card } from '@/components/ui/Card';
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
      <Card className="space-y-2">
        <p className="text-sm font-semibold text-tg-text">Identity</p>
        <p className="text-sm text-tg-text">{identity.displayName}</p>
        <p className="text-xs text-tg-hint">Slug: {identity.slug}</p>
        {identity.description && (
          <p className="text-xs text-tg-hint">{identity.description}</p>
        )}
      </Card>
      <Card className="space-y-2">
        <p className="text-sm font-semibold text-tg-text">Branding</p>
        <p className="text-xs text-tg-hint">Primary: {branding.primaryColor}</p>
        <p className="text-xs text-tg-hint">Accent: {branding.accentColor}</p>
      </Card>
      <Card className="space-y-2">
        <p className="text-sm font-semibold text-tg-text">Limits</p>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <p className="text-xs text-tg-hint">Currency</p>
            <p className="font-medium text-tg-text">{limits.currency}</p>
          </div>
          <div>
            <p className="text-xs text-tg-hint">Min bet</p>
            <p className="font-medium text-tg-text">{limits.minBet}</p>
          </div>
          <div>
            <p className="text-xs text-tg-hint">Max bet</p>
            <p className="font-medium text-tg-text">{limits.maxBet}</p>
          </div>
          <div>
            <p className="text-xs text-tg-hint">Max daily wager</p>
            <p className="font-medium text-tg-text">{limits.maxDailyWager}</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
