import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import type { PaginatedResponse } from '@/types/api';

interface RoundItem {
  id: string;
  crashPoint?: number;
  betCount?: number;
  createdAt?: string;
}

interface RecentRoundsListProps {
  rounds: RoundItem[];
  hasMore?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
}

export function RecentRoundsList({ rounds, hasMore, loadingMore, onLoadMore }: RecentRoundsListProps) {
  if (!rounds.length) {
    return (
      <Card>
        <p className="text-sm text-tg-hint">No recent rounds</p>
      </Card>
    );
  }
  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold text-tg-text">Recent rounds</p>
      {rounds.map((r) => (
        <Card key={r.id} className="flex justify-between items-center py-3">
          <div>
            <p className="text-sm font-medium text-tg-text">#{r.id.slice(0, 8)}</p>
            <p className="text-xs text-tg-hint">{r.betCount ?? 0} bets</p>
          </div>
          <p className="text-sm font-bold text-tg-link">
            {r.crashPoint != null ? `${r.crashPoint.toFixed(2)}x` : '—'}
          </p>
        </Card>
      ))}
      {hasMore && onLoadMore && (
        <Button className="w-full" loading={loadingMore} onClick={onLoadMore}>
          Load more
        </Button>
      )}
    </div>
  );
}

// silence unused PaginatedResponse if tree-shaken
void (null as unknown as PaginatedResponse<RoundItem>);
