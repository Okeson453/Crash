import { LoadingSpinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { HealthOverallCard } from '@/components/admin/HealthOverallCard';
import { HealthServiceGrid } from '@/components/admin/HealthServiceGrid';
import { useHealthPolling } from '@/hooks/useHealthPolling';
import { HeartPulse } from 'lucide-react';

export function AdminHealthScreen() {
  const query = useHealthPolling(10000);

  if (query.isLoading) return <LoadingSpinner size="lg" />;
  if (!query.data) return <EmptyState icon={HeartPulse} title="Health unavailable" />;

  return (
    <div className="space-y-4">
      <HealthOverallCard status={query.data.status ?? 'unknown'} />
      <HealthServiceGrid checks={query.data.checks ?? []} />
    </div>
  );
}
