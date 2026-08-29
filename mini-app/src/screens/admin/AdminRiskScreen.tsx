import { useQuery } from '@tanstack/react-query';
import { getAdminRiskSummary } from '@/api/admin';
import { LoadingSpinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Card } from '@/components/ui/Card';
import { ShieldAlert } from 'lucide-react';

export function AdminRiskScreen() {
  const query = useQuery({
    queryKey: ['admin-risk'],
    queryFn: getAdminRiskSummary,
    refetchInterval: 10000,
  });

  if (query.isLoading) return <LoadingSpinner size="lg" />;
  if (!query.data) {
    return <EmptyState icon={ShieldAlert} title="Risk summary unavailable" />;
  }
  const d = query.data;

  const items = [
    { label: 'Active bets', value: d.activeBetCount },
    { label: 'Active exposure', value: d.activeExposure.toLocaleString() },
    { label: 'Pending bets', value: d.pendingBetCount },
    { label: '24h player loss', value: d.dailyLossEstimate.toLocaleString() },
    { label: 'Open sessions', value: d.openSessions },
    { label: 'High-stake bets', value: d.highStakeBets },
    { label: 'Fraud signals (7d)', value: d.recentRejectedFraud },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {items.map((item) => (
          <Card key={item.label}>
            <p className="text-xs text-tg-hint">{item.label}</p>
            <p className="text-lg font-bold text-tg-text">{item.value}</p>
          </Card>
        ))}
      </div>
      <Card className="space-y-1">
        <p className="text-sm font-semibold text-tg-text">Responsible gaming limits</p>
        <p className="text-xs text-tg-hint">Max daily loss: {d.limits.maxDailyLoss ?? '—'}</p>
        <p className="text-xs text-tg-hint">Max session hours: {d.limits.maxSessionHours ?? '—'}</p>
        <p className="text-xs text-tg-hint">Bet cooldown (min): {d.limits.betCooldownMinutes ?? '—'}</p>
      </Card>
    </div>
  );
}
