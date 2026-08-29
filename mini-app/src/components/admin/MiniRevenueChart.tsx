import { Card } from '@/components/ui/Card';
import { LineChart, Line, ResponsiveContainer, YAxis } from 'recharts';

interface MiniRevenueChartProps {
  data: Array<{ label: string; value: number }>;
}

export function MiniRevenueChart({ data }: MiniRevenueChartProps) {
  if (!data?.length) return null;
  return (
    <Card>
      <p className="text-xs text-tg-hint mb-2">Revenue (24h)</p>
      <div className="h-24">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <YAxis hide domain={['auto', 'auto']} />
            <Line
              type="monotone"
              dataKey="value"
              stroke="var(--tg-theme-link-color, #2481cc)"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
