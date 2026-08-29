import { Card } from '@/components/ui/Card';
import type { HealthStatus } from '@/types/api';

export function HealthMetrics({ health }: { health: HealthStatus }) {
  const checks = health.checks ?? [];
  const ok = checks.filter((c) => c.status === 'ok').length;
  const degraded = checks.filter((c) => c.status === 'degraded').length;
  const failing = checks.filter((c) => c.status === 'failing').length;

  return (
    <Card className="space-y-2">
      <p className="text-sm font-semibold text-tg-text">Service metrics</p>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-lg font-bold text-cw-success">{ok}</p>
          <p className="text-xs text-tg-hint">Healthy</p>
        </div>
        <div>
          <p className="text-lg font-bold text-cw-warning">{degraded}</p>
          <p className="text-xs text-tg-hint">Degraded</p>
        </div>
        <div>
          <p className="text-lg font-bold text-cw-danger">{failing}</p>
          <p className="text-xs text-tg-hint">Failing</p>
        </div>
      </div>
      {health.uptimeSeconds != null && (
        <p className="text-xs text-tg-hint">
          Uptime: {Math.floor(health.uptimeSeconds / 3600)}h {Math.floor((health.uptimeSeconds % 3600) / 60)}m
        </p>
      )}
    </Card>
  );
}
