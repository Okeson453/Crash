import { useMemo } from 'react';
import { useGameStore } from '@/stores/gameStore';
import { useConnectionState } from '@/hooks/useConnectionState';
import type { GameUIState } from '@/types/game';

export function useGameUIState(): {
  state: GameUIState;
  canPlaceBet: boolean;
  canCashout: boolean;
  isReconnecting: boolean;
} {
  const connection = useConnectionState();
  const phase = useGameStore((s) => s.phase);
  const activeBet = useGameStore((s) => s.activeBet);
  const isPlacingBet = useGameStore((s) => s.isPlacingBet);
  const isCashingOut = useGameStore((s) => s.isCashingOut);
  const betError = useGameStore((s) => s.betError);
  const cashoutError = useGameStore((s) => s.cashoutError);

  return useMemo(() => {
    if (connection.isConnecting)
      return { state: 'CONNECTING', canPlaceBet: false, canCashout: false, isReconnecting: false };
    if (connection.isReconnecting)
      return { state: 'RECONNECTING', canPlaceBet: false, canCashout: false, isReconnecting: true };
    if (connection.isFailed || connection.isDisconnected)
      return { state: 'DISCONNECTED', canPlaceBet: false, canCashout: false, isReconnecting: false };
    if (betError || cashoutError)
      return {
        state: 'BET_FAILED',
        canPlaceBet: phase === 'waiting' || phase === 'countdown',
        canCashout: false,
        isReconnecting: false,
      };
    if (isPlacingBet)
      return { state: 'BET_PLACED', canPlaceBet: false, canCashout: false, isReconnecting: false };
    if (phase === 'countdown')
      return { state: 'BETTING_OPEN', canPlaceBet: !activeBet, canCashout: false, isReconnecting: false };
    if (phase === 'waiting')
      return { state: 'BETTING_OPEN', canPlaceBet: !activeBet, canCashout: false, isReconnecting: false };
    if (phase === 'running' && isCashingOut)
      return { state: 'CASHED_OUT', canPlaceBet: false, canCashout: false, isReconnecting: false };
    if (phase === 'running' && activeBet?.state === 'active')
      return { state: 'CASHOUT_AVAILABLE', canPlaceBet: false, canCashout: true, isReconnecting: false };
    if (phase === 'running')
      return { state: 'ROUND_RUNNING', canPlaceBet: false, canCashout: false, isReconnecting: false };
    if (phase === 'crashed' && activeBet?.state === 'cashed_out')
      return { state: 'CASHED_OUT', canPlaceBet: false, canCashout: false, isReconnecting: false };
    if (phase === 'crashed')
      return { state: 'CRASHED', canPlaceBet: false, canCashout: false, isReconnecting: false };
    return { state: 'WAITING', canPlaceBet: false, canCashout: false, isReconnecting: false };
  }, [
    connection.isConnecting,
    connection.isReconnecting,
    connection.isFailed,
    connection.isDisconnected,
    phase,
    activeBet,
    isPlacingBet,
    isCashingOut,
    betError,
    cashoutError,
  ]);
}
