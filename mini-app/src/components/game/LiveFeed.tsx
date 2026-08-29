import { useGameStore } from '@/stores/gameStore';
import { formatCurrency, formatMultiplier } from '@/utils/formatting';
import { TrendingUp, TrendingDown, Zap } from 'lucide-react';

export function LiveFeed() {
  const { liveFeed } = useGameStore();

  if (liveFeed.length === 0) {
    return (
      <div className="card">
        <h3 className="section-header">Live Feed</h3>
        <p className="text-sm text-tg-hint text-center py-4">Waiting for activity...</p>
      </div>
    );
  }

  return (
    <div className="card">
      <h3 className="section-header">Live Feed</h3>
      <div className="space-y-2 max-h-48 overflow-y-auto">
        {liveFeed.slice(0, 20).map((item) => (
          <div
            key={item.id}
            className="flex items-center gap-3 py-2 px-3 rounded-lg bg-tg-bg/50"
          >
            {item.type === 'bet' && (
              <Zap className="w-4 h-4 text-tg-link flex-shrink-0" />
            )}
            {item.type === 'cashout' && item.pnl && item.pnl > 0 && (
              <TrendingUp className="w-4 h-4 text-crash-green flex-shrink-0" />
            )}
            {item.type === 'cashout' && item.pnl && item.pnl <= 0 && (
              <TrendingDown className="w-4 h-4 text-crash-red flex-shrink-0" />
            )}
            {item.type === 'system' && (
              <Zap className="w-4 h-4 text-tg-hint flex-shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm text-tg-text truncate">{item.message}</p>
              {item.multiplier && (
                <p className="text-xs text-tg-hint">
                  {formatMultiplier(item.multiplier)}
                  {item.pnl !== undefined && ` · ${formatCurrency(item.pnl)}`}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
