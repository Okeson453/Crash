import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import type { HealthCheck } from '@/types/api';

export function HealthAlertTimeline({ checks }: { checks: HealthCheck[] }) {
  const alerts = checks.filter((c) => c.status !== 'ok');
  if (!alerts.length) {
    return (
      <Card>
        <p className="text-sm text-tg-text">No recent health alerts</p>
        <p className="text-xs text-tg-hint mt-1">All monitored services are healthy.</p>
      </Card>
    );
  }
  return (
    <Card className="space-y-2">
      <p className="text-sm font-semibold text-tg-text">Alert timeline</p>
      {alerts.map((a) => (
        <div key={a.name} className="flex items-start justify-between gap-2 border-b border-tg-hint/10 pb-2 last:border-0">
          <div className="min-w-0">
            <p className="text-sm font-medium text-tg-text truncate">{a.name}</p>
            <p className="text-xs text-tg-hint truncate">{a.message ?? a.status}</p>
          </div>
          <Badge variant={a.status === 'degraded' ? 'warning' : 'danger'}>{a.status}</Badge>
        </div>
      ))}
    </Card>
  );
}
