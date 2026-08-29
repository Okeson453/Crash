import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { AlertTriangle, CheckCircle, XCircle } from 'lucide-react';

interface AlertListProps {
  alerts: Array<{ name: string; status: string; message?: string }>;
}

const STATUS_ICON: Record<string, typeof CheckCircle> = {
  ok: CheckCircle,
  degraded: AlertTriangle,
  failing: XCircle,
  error: XCircle,
};

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
  ok: 'success',
  degraded: 'warning',
  failing: 'danger',
  error: 'danger',
};

export function AlertList({ alerts }: AlertListProps) {
  if (!alerts.length) {
    return (
      <Card className="flex items-center gap-3 py-4">
        <CheckCircle className="h-5 w-5 text-crash-green" />
        <p className="text-sm text-tg-text">All systems operational</p>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {alerts.map((alert) => {
        const status = alert.status || 'degraded';
        const Icon = STATUS_ICON[status] ?? AlertTriangle;
        const variant = STATUS_VARIANT[status] ?? 'warning';
        return (
          <Card key={alert.name} className="flex items-center gap-3">
            <Icon
              className={`h-5 w-5 ${
                status === 'ok'
                  ? 'text-crash-green'
                  : status === 'degraded'
                    ? 'text-crash-yellow'
                    : 'text-crash-red'
              }`}
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-tg-text truncate">{alert.name}</p>
              {alert.message && (
                <p className="text-xs text-tg-hint truncate">{alert.message}</p>
              )}
            </div>
            <Badge variant={variant}>{alert.status}</Badge>
          </Card>
        );
      })}
    </div>
  );
}
