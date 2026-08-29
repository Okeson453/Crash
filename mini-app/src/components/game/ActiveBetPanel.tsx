import { useGameStore } from '@/stores/gameStore';
import { formatCurrency, formatMultiplier } from '@/utils/formatting';
import { Target, Clock } from 'lucide-react';

export function ActiveBetPanel() {
  const { activeBet, multiplier } = useGameStore();

  if (!activeBet || activeBet.state !== 'active') return null;

  const potentialWin = multiplier ? activeBet.amount * multiplier : activeBet.amount;
  const potentialPnl = potentialWin - activeBet.amount;

  return (
    <div className="card bg-tg-button/10 border border-tg-button/20">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-tg-link" />
          <span className="text-sm font-semibold text-tg-text">Active Bet</span>
        </div>
        <span className="text-xs text-tg-hint">#{activeBet.id.slice(-6)}</span>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-tg-hint mb-1">Amount</p>
          <p className="text-lg font-bold text-tg-text">{formatCurrency(activeBet.amount)}</p>
        </div>
        <div>
          <p className="text-xs text-tg-hint mb-1">Current Multiplier</p>
          <p className="text-lg font-bold text-crash-green">
            {formatMultiplier(multiplier ?? 1.0)}
          </p>
        </div>
        <div>
          <p className="text-xs text-tg-hint mb-1">Potential Win</p>
          <p className="text-lg font-bold text-crash-green">
            {formatCurrency(potentialWin)}
          </p>
        </div>
        <div>
          <p className="text-xs text-tg-hint mb-1">Profit</p>
          <p className={`text-lg font-bold ${potentialPnl >= 0 ? 'text-crash-green' : 'text-crash-red'}`}>
            {potentialPnl >= 0 ? '+' : ''}{formatCurrency(potentialPnl)}
          </p>
        </div>
      </div>

      {activeBet.autoCashout && (
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-tg-hint/10">
          <Target className="w-4 h-4 text-tg-hint" />
          <span className="text-xs text-tg-hint">
            Auto cashout at {formatMultiplier(activeBet.autoCashout)}
          </span>
        </div>
      )}
    </div>
  );
}
