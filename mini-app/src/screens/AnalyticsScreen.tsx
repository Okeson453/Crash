import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getAnalyticsOverview, getAnalyticsRevenue, getPlayerAnalytics } from '@/api/analytics';
import { formatCurrency, formatCompactNumber, formatPercentage } from '@/utils/formatting';
import { LoadingSpinner } from '@/components/ui/Spinner';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { TrendingUp, Users, DollarSign, Target } from 'lucide-react';

const COLORS = ['#22c55e', '#3b82f6', '#a855f7', '#f97316', '#ef4444'];

export function AnalyticsScreen() {
  const [period, setPeriod] = useState<'day' | 'week' | 'month'>('day');

  const { data: overview, isLoading: overviewLoading } = useQuery({
    queryKey: ['analytics-overview', period],
    queryFn: () => getAnalyticsOverview(period),
    staleTime: 30000,
  });

  const { data: revenue } = useQuery({
    queryKey: ['analytics-revenue', period],
    queryFn: () => getAnalyticsRevenue(period),
    staleTime: 30000,
  });

  const { data: players } = useQuery({
    queryKey: ['analytics-players', period],
    queryFn: () => getPlayerAnalytics(period),
    staleTime: 30000,
  });

  if (overviewLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="page-container px-4 py-4 space-y-4">
      {/* Period Selector */}
      <div className="flex gap-2">
        {(['day', 'week', 'month'] as const).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${
              period === p
                ? 'bg-tg-button text-tg-button-text'
                : 'bg-tg-section text-tg-text'
            }`}
          >
            {p.charAt(0).toUpperCase() + p.slice(1)}
          </button>
        ))}
      </div>

      {/* KPI Cards */}
      {overview && (
        <div className="grid grid-cols-2 gap-3">
          <KPICard
            icon={Users}
            label="Active Players"
            value={overview.activePlayers}
            change={+12}
          />
          <KPICard
            icon={DollarSign}
            label="Total Wagered"
            value={formatCurrency(overview.totalWagered)}
            change={+8}
          />
          <KPICard
            icon={Target}
            label="Total Bets"
            value={formatCompactNumber(overview.totalBets)}
            change={-3}
          />
          <KPICard
            icon={TrendingUp}
            label="House Profit"
            value={formatCurrency(overview.houseProfit)}
            change={+15}
            color={overview.houseProfit >= 0 ? 'text-crash-green' : 'text-crash-red'}
          />
        </div>
      )}

      {/* Revenue Chart */}
      {revenue && revenue.labels.length > 0 && (
        <div className="card">
          <h3 className="section-header">Revenue Trend</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={revenue.labels.map((label, i) => ({
                  name: label,
                  revenue: revenue.revenue[i],
                  bets: revenue.bets[i],
                }))}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--tg-theme-hint-color)" opacity={0.2} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--tg-theme-hint-color)' }} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--tg-theme-hint-color)' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--tg-theme-bg-color)',
                    border: '1px solid var(--tg-theme-hint-color)',
                    borderRadius: '8px',
                  }}
                />
                <Bar dataKey="revenue" fill="#22c55e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Crash Distribution */}
      {overview?.crashDistribution && overview.crashDistribution.length > 0 && (
        <div className="card">
          <h3 className="section-header">Crash Distribution</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={overview.crashDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={70}
                  paddingAngle={4}
                  dataKey="count"
                  nameKey="range"
                >
                  {overview.crashDistribution.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--tg-theme-bg-color)',
                    border: '1px solid var(--tg-theme-hint-color)',
                    borderRadius: '8px',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap gap-2 mt-2 justify-center">
            {overview.crashDistribution.map((item, index) => (
              <div key={index} className="flex items-center gap-1 text-xs">
                <span
                  className="w-2 h-2 rounded-full"
                  
                />
                <span className="text-tg-hint">{item.range}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Players Table */}
      {players && players.length > 0 && (
        <div className="card">
          <h3 className="section-header">Top Players</h3>
          <div className="space-y-2">
            {players.slice(0, 10).map((player, index) => (
              <div
                key={player.id}
                className="flex items-center gap-3 py-2 px-3 rounded-lg bg-tg-bg/50"
              >
                <span className="w-6 text-center text-xs font-bold text-tg-hint">
                  {index + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-tg-text truncate">
                    {player.username || 'Anonymous'}
                  </p>
                  <p className="text-xs text-tg-hint">
                    {player.totalBets} bets · {formatPercentage(player.winRate)} win rate
                  </p>
                </div>
                <div className="text-right">
                  <p
                    className={`text-sm font-bold ${
                      player.totalPnl >= 0 ? 'text-crash-green' : 'text-crash-red'
                    }`}
                  >
                    {formatCurrency(player.totalPnl)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function KPICard({
  icon: Icon,
  label,
  value,
  change,
  color = 'text-tg-text',
}: {
  icon: typeof Users;
  label: string;
  value: string | number;
  change: number;
  color?: string;
}) {
  return (
    <div className="card">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4 text-tg-hint" />
        <span className="text-xs text-tg-hint">{label}</span>
      </div>
      <p className={`text-xl font-bold ${color}`}>{value}</p>
      <div className="flex items-center gap-1 mt-1">
        <TrendingUp
          className={`w-3 h-3 ${change >= 0 ? 'text-crash-green' : 'text-crash-red'}`}
        />
        <span className={`text-xs ${change >= 0 ? 'text-crash-green' : 'text-crash-red'}`}>
          {change >= 0 ? '+' : ''}
          {change}%
        </span>
      </div>
    </div>
  );
}
