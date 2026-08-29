import { useGameStore } from '@/stores/gameStore';
import { formatMultiplier } from '@/utils/formatting';

export function HistoryStrip() {
  const { roundHistory } = useGameStore();

  if (roundHistory.length === 0) {
    return (
      <div className="flex items-center justify-center py-3 text-tg-hint text-sm">
        No rounds yet
      </div>
    );
  }

  return (
    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
      {roundHistory.slice(0, 15).map((round, index) => {
        const isHigh = round.crashPoint >= 5;
        const isMid = round.crashPoint >= 2 && round.crashPoint < 5;
        const colorClass = isHigh
          ? 'bg-crash-purple text-white'
          : isMid
          ? 'bg-crash-green text-white'
          : round.crashPoint >= 1.5
          ? 'bg-crash-blue text-white'
          : 'bg-crash-red text-white';

        return (
          <button
            key={`${round.roundId}-${index}`}
            className={`flex-shrink-0 w-14 h-10 rounded-lg flex items-center justify-center text-xs font-bold ${colorClass} active:scale-95 transition-transform`}
            aria-label={`Round ${index + 1}: ${formatMultiplier(round.crashPoint)}`}
          >
            {formatMultiplier(round.crashPoint)}
          </button>
        );
      })}
    </div>
  );
}
