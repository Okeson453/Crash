import { useQuery } from '@tanstack/react-query';
import { getHealthStatus } from '@/api/health';
import { LoadingSpinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { HeartPulse } from 'lucide-react';

export function AdminHealthScreen() {
  const query = useQuery({
    queryKey: ['health'],
    queryFn: getHealthStatus,
    refetchInterval: 10000,
  });

  if (query.isLoading) return <LoadingSpinner size="lg" />;
  if (!query.data) return <EmptyState icon={HeartPulse} title="Health unavailable" />;

  const overall = query.data.status ?? 'unknown';

  return (
    <div className="space-y-4">
      <Card className="flex items-center gap-3">
        <HeartPulse className="h-6 w-6 text-tg-link" />
        <div>
          <p className="text-sm font-semibold text-tg-text">Overall status</p>
          <Badge
            variant={
              overall === 'healthy'
                ? 'success'
                : overall === 'degraded'
                  ? 'warning'
                  : 'danger'
            }
          >
            {overall}
          </Badge>
        </div>
      </Card>
      <div className="space-y-2">
        {(query.data.checks ?? []).map((check) => (
          <Card key={check.name} className="flex items-center gap-3">
            <HeartPulse className="h-5 w-5 text-tg-link shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-tg-text">{check.name}</p>
              <p className="text-xs text-tg-hint truncate">{check.message}</p>
            </div>
            <Badge
              variant={
                check.status === 'ok'
                  ? 'success'
                  : check.status === 'degraded'
                    ? 'warning'
                    : 'danger'
              }
            >
              {check.status}
            </Badge>
          </Card>
        ))}
      </div>
    </div>
  );
}
