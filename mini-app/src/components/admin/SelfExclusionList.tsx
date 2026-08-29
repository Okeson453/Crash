import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import type { SelfExclusion } from '@/types/api';
import { Ban, Calendar } from 'lucide-react';

interface SelfExclusionListProps {
  exclusions: SelfExclusion[];
}

export function SelfExclusionList({ exclusions }: SelfExclusionListProps) {
  if (!exclusions.length) return null;
  return (
    <Card className="space-y-2">
      <div className="flex items-center gap-2">
        <Ban className="h-4 w-4 text-tg-link" />
        <p className="text-sm font-semibold text-tg-text">Self-exclusions ({exclusions.length})</p>
      </div>
      {exclusions.map((se) => (
        <div
          key={se.id}
          className="flex items-center justify-between py-2 border-b border-tg-hint/10 last:border-0"
        >
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-tg-hint/20 flex items-center justify-center text-xs font-bold text-tg-hint">
              {se.userName[0]}
            </div>
            <div>
              <p className="text-sm text-tg-text">@{se.userName}</p>
              <p className="text-xs text-tg-hint flex items-center gap-1">
                <Calendar className="h-3 w-3" /> Until {new Date(se.expiresAt).toLocaleDateString()}
              </p>
            </div>
          </div>
          <Badge variant={se.isPermanent ? 'danger' : 'warning'}>
            {se.isPermanent ? 'Permanent' : 'Temporary'}
          </Badge>
        </div>
      ))}
    </Card>
  );
}
