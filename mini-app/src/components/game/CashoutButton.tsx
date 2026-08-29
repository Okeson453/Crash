import { useGameStore } from '@/stores/gameStore';
import { useCashout } from '@/hooks/useCashout';
import { formatCurrency, formatMultiplier } from '@/utils/formatting';
import { useSettingsStore } from '@/stores/settingsStore';

export function CashoutButton() {
  const { canCashout, isCashingOut, manualCashout, potentialWin, potentialPnl } = useCashout();
  const { multiplier } = useGameStore();
  const animationsEnabled = useSettingsStore((s) => s.animationsEnabled);

  if (!canCashout) return null;

  return (
    <button
      onClick={manualCashout}
      disabled={isCashingOut}
      className={`w-full btn-primary py-4 text-lg ${animationsEnabled ? 'animate-bounce-small' : ''}`}
      aria-label={`Cash out at ${formatMultiplier(multiplier ?? 1.0)} for ${formatCurrency(potentialWin)}`}
    >
      <div className="flex flex-col items-center">
        <span className="font-bold">CASH OUT</span>
        <span className="text-sm font-medium opacity-90">
          {formatMultiplier(multiplier ?? 1.0)} · {formatCurrency(potentialWin)}
        </span>
        <span className={`text-xs ${potentialPnl >= 0 ? 'text-white/80' : 'text-white/60'}`}>
          {potentialPnl >= 0 ? '+' : ''}{formatCurrency(potentialPnl)}
        </span>
      </div>
    </button>
  );
}
