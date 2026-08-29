import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { HeartPulse } from 'lucide-react';

interface HealthOverallCardProps {
  status: string;
}

export function HealthOverallCard({ status }: HealthOverallCardProps) {
  const variant =
    status === 'healthy' || status === 'ok'
      ? 'success'
      : status === 'degraded'
        ? 'warning'
        : 'danger';
  return (
    <Card className="flex items-center gap-3">
      <HeartPulse className="h-6 w-6 text-tg-link" />
      <div>
        <p className="text-sm font-semibold text-tg-text">Overall status</p>
        <Badge variant={variant}>{status}</Badge>
      </div>
    </Card>
  );
}
