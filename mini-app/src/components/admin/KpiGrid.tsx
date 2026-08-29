import { Card } from '@/components/ui/Card';
import { TrendingUp, TrendingDown, Users, DollarSign, BarChart3 } from 'lucide-react';

interface KpiGridProps {
  totalRounds: number;
  activePlayers: number;
  revenue24h: number;
  profit24h: number;
}

export function KpiGrid({ totalRounds, activePlayers, revenue24h, profit24h }: KpiGridProps) {
  const items = [
    {
      label: 'Total Rounds',
      value: totalRounds.toLocaleString(),
      icon: BarChart3,
      color: 'text-tg-link',
    },
    {
      label: 'Active Players',
      value: activePlayers.toLocaleString(),
      icon: Users,
      color: 'text-crash-green',
    },
    {
      label: 'Revenue (24h)',
      value: `$${revenue24h.toLocaleString()}`,
      icon: DollarSign,
      color: 'text-tg-link',
    },
    {
      label: 'Profit (24h)',
      value: `$${profit24h.toLocaleString()}`,
      icon: profit24h >= 0 ? TrendingUp : TrendingDown,
      color: profit24h >= 0 ? 'text-crash-green' : 'text-crash-red',
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3">
      {items.map((item) => (
        <Card key={item.label} className="flex flex-col gap-1">
          <item.icon className={`h-4 w-4 ${item.color}`} />
          <p className="text-xs text-tg-hint">{item.label}</p>
          <p className="text-lg font-bold text-tg-text">{item.value}</p>
        </Card>
      ))}
    </div>
  );
}
