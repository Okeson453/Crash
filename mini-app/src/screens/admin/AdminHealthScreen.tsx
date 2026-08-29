import { LoadingSpinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { HealthOverallCard } from '@/components/admin/HealthOverallCard';
import { HealthServiceGrid } from '@/components/admin/HealthServiceGrid';
import { HealthMetrics } from '@/components/admin/HealthMetrics';
import { HealthAlertTimeline } from '@/components/admin/HealthAlertTimeline';
import { useHealthPolling } from '@/hooks/useHealthPolling';
import { HeartPulse } from 'lucide-react';

export function AdminHealthScreen() {
  const query = useHealthPolling(10000);

  if (query.isLoading) return <LoadingSpinner size="lg" />;
  if (!query.data) return <EmptyState icon={HeartPulse} title="Health unavailable" />;

  return (
    <div className="space-y-4">
      <HealthOverallCard status={query.data.status ?? 'unknown'} />
      <HealthMetrics health={query.data} />
      <HealthServiceGrid checks={query.data.checks ?? []} />
      <HealthAlertTimeline checks={query.data.checks ?? []} />
    </div>
  );
}
