import { useCallback, useEffect, useRef } from 'react';
import { useGameStore } from '@/stores/gameStore';
import { useBet } from './useBet';

export function useCashout(index: 0 | 1 = 0) {
  const phase = useGameStore((s) => s.phase);
  const multiplier = useGameStore((s) => s.multiplier);
  const activeBet = useGameStore((s) => s.activeBets[index]);
  const isCashingOut = useGameStore((s) => s.isCashingOut);
  const { cashout } = useBet(index);
  const autoCashoutTriggered = useRef(false);

  useEffect(() => {
    if (
      phase === 'running' &&
      activeBet?.state === 'active' &&
      activeBet.autoCashout &&
      multiplier &&
      !autoCashoutTriggered.current
    ) {
      if (multiplier >= activeBet.autoCashout) {
        autoCashoutTriggered.current = true;
        cashout(activeBet.id);
      }
    }

    if (phase === 'countdown' || phase === 'waiting') {
      autoCashoutTriggered.current = false;
    }
  }, [phase, multiplier, activeBet, cashout]);

  const manualCashout = useCallback(() => {
    if (activeBet?.id && activeBet.state === 'active') {
      cashout(activeBet.id);
    }
  }, [activeBet, cashout]);

  const potentialWin =
    activeBet && multiplier ? activeBet.amount * multiplier : 0;
  const potentialPnl =
    activeBet && multiplier ? activeBet.amount * (multiplier - 1) : 0;

  return {
    canCashout: phase === 'running' && activeBet?.state === 'active',
    isCashingOut,
    manualCashout,
    potentialWin,
    potentialPnl,
    autoCashoutTarget: activeBet?.autoCashout ?? null,
    activeBet,
  };
}
