import { useGameState } from '@/hooks/useGameState';
import { useRealtimeGame } from '@/hooks/useRealtimeGame';
import { useBalance } from '@/hooks/useBalance';
import { MultiplierDisplay } from '@/components/game/MultiplierDisplay';
import { RoundStatus } from '@/components/game/RoundStatus';
import { RoundCountdown } from '@/components/game/RoundCountdown';
import { HistoryStrip } from '@/components/game/HistoryStrip';
import { TwoBetPanel } from '@/components/betting/TwoBetPanel';
import { ActiveBetPanel } from '@/components/game/ActiveBetPanel';
import { CashoutButton } from '@/components/game/CashoutButton';
import { LiveFeed } from '@/components/game/LiveFeed';
import { CrashOverlay } from '@/components/game/CrashOverlay';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { useTelegram } from '@/hooks/useTelegram';
import { useCashout } from '@/hooks/useCashout';
import { useEffect } from 'react';
import { useGameUIState } from '@/hooks/game/useGameUIState';
import { useGameStore } from '@/stores/gameStore';
import { BetPendingState } from '@/components/betting/BetPendingState';
import { BetErrorDialog } from '@/components/betting/BetErrorDialog';

export function GameScreen() {
  useGameState();
  const ui = useGameUIState();
  const betError = useGameStore((state) => state.betError);
  const cashoutError = useGameStore((state) => state.cashoutError);
  const { isLoading: balanceLoading } = useBalance();
  const { useMainButton: bindMainButton } = useTelegram();
  const { canCashout, manualCashout } = useCashout();
  useRealtimeGame();
  useEffect(() => {
    if (canCashout) return bindMainButton('Cash Out', manualCashout, true);
    return bindMainButton('Place Bet', () => undefined, false);
  }, [canCashout, manualCashout, bindMainButton]);

  const showBetPanel = ui.canPlaceBet;
  const showCashout = ui.canCashout;

  return (
    <div className="page-container px-4 py-4 space-y-4">
      {/* Game Status */}
      <RoundStatus />

      {/* Countdown */}
      <RoundCountdown />

      {/* Multiplier Display */}
      <div className="relative">
        <MultiplierDisplay />
        <CrashOverlay />
      </div>

      {/* History Strip */}
      <HistoryStrip />

      {/* Active Bet / Cashout */}
      {ui.state === 'RECONNECTING' && <div role="status" className="rounded-xl bg-crash-yellow/10 px-3 py-2 text-sm text-crash-yellow">Reconnecting… betting is paused.</div>}
      {ui.state === 'DISCONNECTED' && <div role="alert" className="rounded-xl bg-crash-red/10 px-3 py-2 text-sm text-crash-red">Realtime connection unavailable.</div>}
      {ui.state === 'BET_PLACED' && <BetPendingState />}
      {showCashout && <CashoutButton />}
      <ActiveBetPanel />

      {/* Bet Panel */}
      {ui.state === 'BET_FAILED' && <BetErrorDialog open message={betError ?? cashoutError ?? 'Bet failed'} onClose={() => useGameStore.getState().clearErrors()} />}
      {showBetPanel && (
        balanceLoading ? <SkeletonCard /> : <TwoBetPanel />
      )}

      {/* Live Feed */}
      <LiveFeed />
    </div>
  );
}
