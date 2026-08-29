import { useQuery } from '@tanstack/react-query';
import { getHealthStatus } from '@/api/health';
import { formatRelativeTime } from '@/utils/formatting';
import { LoadingSpinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import {
  Heart,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Activity,
  Clock,
  Server,
} from 'lucide-react';

const STATUS_CONFIG = {
  healthy: { color: 'text-crash-green', bg: 'bg-crash-green/10', icon: CheckCircle },
  degraded: { color: 'text-crash-yellow', bg: 'bg-crash-yellow/10', icon: AlertTriangle },
  unhealthy: { color: 'text-crash-red', bg: 'bg-crash-red/10', icon: XCircle },
};

const CHECK_STATUS_CONFIG = {
  ok: { color: 'text-crash-green', icon: CheckCircle },
  degraded: { color: 'text-crash-yellow', icon: AlertTriangle },
  failing: { color: 'text-crash-red', icon: XCircle },
};

export function HealthScreen() {
  const { data: health, isLoading } = useQuery({
    queryKey: ['health'],
    queryFn: getHealthStatus,
    refetchInterval: 10000,
    staleTime: 5000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!health) {
    return (
      <EmptyState
        icon={Heart}
        title="Health data unavailable"
        description="Unable to fetch system health status."
      />
    );
  }

  const statusConfig = STATUS_CONFIG[health.status] || STATUS_CONFIG.unhealthy;
  const StatusIcon = statusConfig.icon;

  return (
    <div className="page-container px-4 py-4 space-y-4">
      {/* Overall Status */}
      <div className={`card ${statusConfig.bg}`}>
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-full ${statusConfig.bg} flex items-center justify-center`}>
            <StatusIcon className={`w-6 h-6 ${statusConfig.color}`} />
          </div>
          <div>
            <h2 className={`text-xl font-bold ${statusConfig.color} capitalize`}>
              {health.status}
            </h2>
            <p className="text-xs text-tg-hint">
              Version {health.version} · Checked {formatRelativeTime(health.timestamp)}
            </p>
          </div>
        </div>
      </div>

      {/* Health Checks Grid */}
      <div className="grid grid-cols-1 gap-3">
        {health.checks.map((check, index) => {
          const checkConfig = CHECK_STATUS_CONFIG[check.status] || CHECK_STATUS_CONFIG.failing;
          const CheckIcon = checkConfig.icon;

          return (
            <div key={index} className="card">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CheckIcon className={`w-5 h-5 ${checkConfig.color}`} />
                  <div>
                    <p className="text-sm font-semibold text-tg-text">{check.name}</p>
                    <p className="text-xs text-tg-hint">{check.message}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-tg-hint">{check.responseTimeMs}ms</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* System Info */}
      <div className="card">
        <h3 className="section-header">System Info</h3>
        <div className="space-y-2">
          <InfoRow icon={Server} label="Status" value={health.status} />
          <InfoRow icon={Activity} label="Checks" value={`${health.checks.length} total`} />
          <InfoRow
            icon={Clock}
            label="Last Checked"
            value={new Date(health.timestamp).toLocaleString()}
          />
          <InfoRow icon={Heart} label="Version" value={health.version} />
        </div>
      </div>
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Server;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 py-2">
      <Icon className="w-4 h-4 text-tg-hint" />
      <span className="text-sm text-tg-hint flex-1">{label}</span>
      <span className="text-sm font-medium text-tg-text">{value}</span>
    </div>
  );
}
