import { useQuery } from '@tanstack/react-query';
import { getAdminSessionState } from '@/api/admin';
import { SessionControlPanel } from '@/components/admin/SessionControlPanel';
import { LoadingSpinner } from '@/components/ui/Spinner';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

export function AdminEnginesScreen() {
  const session = useQuery({
    queryKey: ['admin-session'],
    queryFn: getAdminSessionState,
    refetchInterval: 5000,
  });

  if (session.isLoading) return <LoadingSpinner size="lg" />;

  const status = session.data?.status ?? 'unknown';
  const statusVariant =
    status === 'running' ? 'success' : status === 'paused' ? 'warning' : 'neutral';

  return (
    <div className="space-y-4">
      <Card className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-tg-text">Session Status</p>
          <Badge variant={statusVariant}>{status}</Badge>
        </div>
        <p className="text-xs text-tg-hint">
          Mode: {session.data?.mode ?? '—'} · Rounds: {session.data?.totalRounds ?? 0}
        </p>
        {session.data?.currentRoundId && (
          <p className="text-xs text-tg-hint">Current round: {session.data.currentRoundId}</p>
        )}
      </Card>
      <SessionControlPanel />
    </div>
  );
}
