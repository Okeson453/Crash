import { useQuery } from '@tanstack/react-query';
import { getAdminActiveBets, type AdminActiveBet } from '@/api/admin';
import { LoadingSpinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Zap } from 'lucide-react';

export function AdminActiveBetsScreen() {
  const query = useQuery({
    queryKey: ['admin-active-bets'],
    queryFn: getAdminActiveBets,
    refetchInterval: 5000,
  });

  if (query.isLoading) return <LoadingSpinner size="lg" />;
  const rows = query.data ?? [];
  if (!rows.length) {
    return (
      <EmptyState icon={Zap} title="No active bets" description="Live bets will appear here in real time." />
    );
  }

  const exposure = rows.reduce((sum, b) => sum + b.amount, 0);

  return (
    <div className="space-y-3">
      <Card>
        <p className="text-xs text-tg-hint">Open exposure</p>
        <p className="text-lg font-bold text-tg-text">{exposure.toLocaleString()}</p>
        <p className="text-xs text-tg-hint">{rows.length} active/pending bets</p>
      </Card>
      {rows.map((b: AdminActiveBet) => (
        <Card key={b.id} className="space-y-1">
          <div className="flex justify-between gap-2">
            <p className="text-sm font-medium text-tg-text truncate">
              @{b.username || b.userId.slice(0, 8)} · {b.amount.toLocaleString()}
            </p>
            <Badge variant={b.state === 'active' ? 'success' : 'warning'}>{b.state}</Badge>
          </div>
          <p className="text-xs text-tg-hint">
            Auto CO {b.autoCashout ?? '—'} · Round {b.roundId?.slice(0, 8) ?? '—'} ·{' '}
            {new Date(b.createdAt).toLocaleTimeString()}
          </p>
        </Card>
      ))}
    </div>
  );
}
