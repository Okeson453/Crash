import { useQuery } from '@tanstack/react-query';
import { getUserStats } from '@/api/users';
import { getRecentRounds } from '@/api/game';
import { useAuthStore } from '@/stores/authStore';
import { useBalance } from '@/hooks/useBalance';
import { formatCurrency, formatPercentage, formatMultiplier } from '@/utils/formatting';
import { SkeletonCard, SkeletonList } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { SystemStatusCard } from '@/components/dashboard/SystemStatusCard';
import { ConnectionStatus } from '@/components/dashboard/ConnectionStatus';
import { LastUpdated } from '@/components/dashboard/LastUpdated';
import { DataFreshnessIndicator } from '@/components/dashboard/DataFreshnessIndicator';
import { useDashboardState } from '@/hooks/dashboard/useDashboardState';
import { useNavigate } from 'react-router-dom';
import {
  TrendingUp,
  TrendingDown,
  Target,
  Zap,
  Trophy,
} from 'lucide-react';

export function DashboardScreen() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { balance, currencySymbol } = useBalance();
  const dashboard = useDashboardState();

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['user-stats'],
    queryFn: getUserStats,
    staleTime: 30000,
  });

  const { data: recentRounds, isLoading: roundsLoading } = useQuery({
    queryKey: ['recent-rounds-dashboard'],
    queryFn: () => getRecentRounds(5),
    staleTime: 10000,
  });

  return (
    <div className="page-container px-4 py-4 space-y-4">
      {dashboard.state === 'STALE' && <div role="status" className="rounded-xl bg-crash-yellow/10 px-3 py-2 text-xs text-crash-yellow">Live data is delayed.</div>}
      <div className="flex items-center justify-between"><DataFreshnessIndicator stale={dashboard.state === 'STALE'} /><LastUpdated value={dashboard.lastUpdated} /></div>
      <div className="grid grid-cols-2 gap-3"><SystemStatusCard /><ConnectionStatus /></div>
      {/* Balance Card */}
      <div className="card bg-tg-button/10 border border-tg-button/20">
        <p className="text-sm text-tg-hint mb-1">Your Balance</p>
        <p className="text-3xl font-black text-tg-text">
          {currencySymbol}{(balance ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
        </p>
        <p className="text-xs text-tg-hint mt-1">{user?.planName || 'Free Plan'}</p>
        <div className="mt-3 flex gap-2">
          <button type="button" className="text-xs font-medium text-tg-link" onClick={() => navigate('/wallet')}>Wallet</button>
          <button type="button" className="text-xs font-medium text-tg-link" onClick={() => navigate('/referrals')}>Referrals</button>
          <button type="button" className="text-xs font-medium text-tg-link" onClick={() => navigate('/notifications')}>Notifications</button>
          <button type="button" className="text-xs font-medium text-tg-link" onClick={() => navigate('/profile')}>Profile</button>
        </div>
      </div>

      {/* Stats Grid */}
      {statsLoading ? (
        <div className="grid grid-cols-2 gap-3">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : stats ? (
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            label="Total Bets"
            value={stats.totalBets}
            icon={Zap}
            color="text-tg-link"
          />
          <StatCard
            label="Win Rate"
            value={formatPercentage(stats.winRate)}
            icon={Target}
            color="text-crash-green"
          />
          <StatCard
            label="Total P&L"
            value={formatCurrency(stats.totalPnl, currencySymbol)}
            icon={stats.totalPnl >= 0 ? TrendingUp : TrendingDown}
            color={stats.totalPnl >= 0 ? 'text-crash-green' : 'text-crash-red'}
          />
          <StatCard
            label="Best Multiplier"
            value={formatMultiplier(stats.bestMultiplier)}
            icon={Trophy}
            color="text-crash-purple"
          />
        </div>
      ) : null}

      {/* Recent Rounds */}
      <div className="card">
        <h3 className="section-header">Recent Rounds</h3>
        {roundsLoading ? (
          <SkeletonList count={3} />
        ) : recentRounds && recentRounds.length > 0 ? (
          <div className="space-y-2">
            {recentRounds.map((round) => (
              <div
                key={round.id}
                className="flex items-center justify-between py-2 px-3 rounded-lg bg-tg-bg/50"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      round.crashPoint >= 5
                        ? 'bg-crash-purple'
                        : round.crashPoint >= 2
                        ? 'bg-crash-green'
                        : 'bg-crash-red'
                    }`}
                  />
                  <span className="text-sm font-medium text-tg-text">
                    {formatMultiplier(round.crashPoint)}
                  </span>
                </div>
                <span className="text-xs text-tg-hint">
                  {round.totalBets} bets
                </span>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title="No rounds yet" description="Play your first round to see history here." />
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: string | number;
  icon: typeof Zap;
  color: string;
}) {
  return (
    <div className="card">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-4 h-4 ${color}`} />
        <span className="text-xs text-tg-hint">{label}</span>
      </div>
      <p className="text-xl font-bold text-tg-text">{value}</p>
    </div>
  );
}
