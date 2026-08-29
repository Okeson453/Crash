import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { HeartPulse } from 'lucide-react';

interface Check {
  name: string;
  status: string;
  message?: string;
}

interface HealthServiceGridProps {
  checks: Check[];
}

export function HealthServiceGrid({ checks }: HealthServiceGridProps) {
  return (
    <div className="space-y-2">
      {checks.map((check) => (
        <Card key={check.name} className="flex items-center gap-3">
          <HeartPulse className="h-5 w-5 text-tg-link shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-tg-text">{check.name}</p>
            {check.message && (
              <p className="text-xs text-tg-hint truncate">{check.message}</p>
            )}
          </div>
          <Badge
            variant={
              check.status === 'ok'
                ? 'success'
                : check.status === 'degraded'
                  ? 'warning'
                  : 'danger'
            }
          >
            {check.status}
          </Badge>
        </Card>
      ))}
    </div>
  );
}
