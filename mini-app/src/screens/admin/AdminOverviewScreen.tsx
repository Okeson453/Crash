import { useQuery } from '@tanstack/react-query';
import { getAdminOverview, getAdminSessionState } from '@/api/admin';
import { getHealthStatus } from '@/api/health';
import { KpiGrid } from '@/components/admin/KpiGrid';
import { AlertList } from '@/components/admin/AlertList';
import { QuickActions } from '@/components/admin/QuickActions';
import { MiniRevenueChart } from '@/components/admin/MiniRevenueChart';
import { LoadingSpinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Card } from '@/components/ui/Card';
import { Activity } from 'lucide-react';

export function AdminOverviewScreen() {
  const overview = useQuery({
    queryKey: ['admin-overview'],
    queryFn: getAdminOverview,
    refetchInterval: 15000,
  });
  const session = useQuery({
    queryKey: ['admin-session'],
    queryFn: getAdminSessionState,
    refetchInterval: 5000,
  });
  const health = useQuery({
    queryKey: ['health'],
    queryFn: getHealthStatus,
    refetchInterval: 15000,
  });

  if (overview.isLoading || session.isLoading || health.isLoading) {
    return <LoadingSpinner size="lg" />;
  }

  const data = overview.data;
  if (!data && !session.data) {
    return <EmptyState icon={Activity} title="Overview unavailable" />;
  }

  return (
    <div className="space-y-4">
      <KpiGrid
        totalRounds={data?.totalRounds ?? session.data?.totalRounds ?? 0}
        activePlayers={data?.activePlayers ?? 0}
        revenue24h={data?.revenue24h ?? 0}
        profit24h={data?.profit24h ?? 0}
      />
      {data?.revenueChart && data.revenueChart.length > 0 && (
        <MiniRevenueChart data={data.revenueChart} />
      )}
      <Card className="space-y-2">
        <p className="text-xs text-tg-hint">Engine status</p>
        <p className="text-lg font-bold text-tg-text capitalize">
          {session.data?.status ?? 'unknown'} · {session.data?.mode ?? '—'}
        </p>
      </Card>
      <AlertList
        alerts={
          health.data?.checks?.filter((c) => c.status !== 'ok') ??
          data?.latestAlerts ??
          []
        }
      />
      <QuickActions />
    </div>
  );
}
