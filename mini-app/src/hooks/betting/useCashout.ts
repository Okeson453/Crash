import { useCallback, useEffect, useRef } from 'react';
import { useGameStore } from '@/stores/gameStore';
import { useBet } from './useBet';

export function useCashout(index: 0 | 1 = 0) {
  const store = useGameStore();
  const activeBet = store.activeBets[index];
  const { cashout } = useBet(index);
  const autoCashoutTriggered = useRef(false);

  // Auto-cashout logic
  useEffect(() => {
    if (
      store.phase === 'running' &&
      activeBet?.state === 'active' &&
      activeBet.autoCashout &&
      store.multiplier &&
      !autoCashoutTriggered.current
    ) {
      if (store.multiplier >= activeBet.autoCashout) {
        autoCashoutTriggered.current = true;
        cashout(activeBet.id);
      }
    }

    // Reset auto-cashout trigger on new round
    if (store.phase === 'countdown' || store.phase === 'waiting') {
      autoCashoutTriggered.current = false;
    }
  }, [store.phase, store.multiplier, activeBet, cashout]);

  const manualCashout = useCallback(() => {
    if (activeBet?.id && activeBet.state === 'active') {
      cashout(activeBet.id);
    }
  }, [activeBet, cashout]);

  const potentialWin = useCallback(() => {
    if (!activeBet || !store.multiplier) return 0;
    return activeBet.amount * store.multiplier;
  }, [activeBet, store.multiplier]);

  const potentialPnl = useCallback(() => {
    if (!activeBet || !store.multiplier) return 0;
    return activeBet.amount * (store.multiplier - 1);
  }, [activeBet, store.multiplier]);

  return {
    canCashout:
      store.phase === 'running' &&
      activeBet?.state === 'active',
    isCashingOut: store.isCashingOut,
    manualCashout,
    potentialWin: potentialWin(),
    potentialPnl: potentialPnl(),
    autoCashoutTarget: activeBet?.autoCashout ?? null,
  };
}
