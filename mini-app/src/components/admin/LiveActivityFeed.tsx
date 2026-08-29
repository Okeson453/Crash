import { Card } from '@/components/ui/Card';
import type { AdminActivity } from '@/types/api';
import { formatDateTime } from '@/utils/formatting';

interface LiveActivityFeedProps {
  activities: AdminActivity[];
}

export function LiveActivityFeed({ activities }: LiveActivityFeedProps) {
  if (!activities.length) {
    return (
      <Card>
        <p className="text-sm text-tg-hint">No recent activity</p>
      </Card>
    );
  }
  return (
    <Card className="space-y-2">
      <p className="text-sm font-semibold text-tg-text">Live activity</p>
      <div className="space-y-2 max-h-48 overflow-y-auto">
        {activities.map((a) => (
          <div key={a.id} className="flex items-start gap-2 text-sm border-b border-tg-hint/10 pb-2 last:border-0">
            <span className="h-2 w-2 rounded-full bg-tg-link mt-1.5 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-tg-text truncate">{a.message}</p>
              <p className="text-xs text-tg-hint">{formatDateTime(a.createdAt)}</p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
