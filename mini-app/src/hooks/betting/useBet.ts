import { useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useGameStore } from '@/stores/gameStore';
import { useUIStore } from '@/stores/uiStore';
import { placeBet, cashoutBet } from '@/api/bets';
import { useTelegram } from '@/hooks/useTelegram';
import type { PlaceBetRequest } from '@/types/api';

function createIdempotencyKey(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `idem-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function useBet(index: 0 | 1 = 0) {
  const activeBet = useGameStore((s) => s.activeBets[index]);
  const isPlacingBet = useGameStore((s) => s.isPlacingBet);
  const isCashingOut = useGameStore((s) => s.isCashingOut);
  const betError = useGameStore((s) => s.betError);
  const cashoutError = useGameStore((s) => s.cashoutError);
  const addToast = useUIStore((s) => s.addToast);
  const queryClient = useQueryClient();
  const { haptic } = useTelegram();

  const placeBetMutation = useMutation({
    mutationFn: (request: PlaceBetRequest) => placeBet(request, createIdempotencyKey()),
    onMutate: () => {
      const s = useGameStore.getState();
      s.setIsPlacingBet(true);
      s.clearErrors();
    },
    onSuccess: (bet) => {
      const s = useGameStore.getState();
      s.setActiveBet(bet);
      s.setIsPlacingBet(false);
      haptic('notification', 'success');
      addToast({
        type: 'success',
        message: `Bet placed: $${bet.amount.toFixed(2)}`,
      });
      void queryClient.invalidateQueries({ queryKey: ['balance'] });
      void queryClient.invalidateQueries({ queryKey: ['bets'] });
    },
    onError: (error: Error) => {
      const s = useGameStore.getState();
      s.setIsPlacingBet(false);
      s.setBetError(error.message);
      haptic('notification', 'error');
      addToast({
        type: 'error',
        message: error.message,
      });
    },
  });

  const cashoutMutation = useMutation({
    mutationFn: cashoutBet,
    onMutate: () => {
      const s = useGameStore.getState();
      s.setIsCashingOut(true);
      s.clearErrors();
    },
    onSuccess: (result) => {
      useGameStore.getState().setIsCashingOut(false);
      haptic('notification', 'success');
      addToast({
        type: 'success',
        message: `Cashed out at ${result.multiplier.toFixed(2)}x!`,
      });
      void queryClient.invalidateQueries({ queryKey: ['balance'] });
      void queryClient.invalidateQueries({ queryKey: ['bets'] });
    },
    onError: (error: Error) => {
      const s = useGameStore.getState();
      s.setIsCashingOut(false);
      s.setCashoutError(error.message);
      haptic('notification', 'error');
      addToast({
        type: 'error',
        message: error.message,
      });
    },
  });

  const place = useCallback(
    (request: PlaceBetRequest) => {
      if (useGameStore.getState().isPlacingBet) return;
      placeBetMutation.mutate(request);
    },
    [placeBetMutation]
  );

  const cashout = useCallback(
    (betId: string) => {
      if (useGameStore.getState().isCashingOut) return;
      cashoutMutation.mutate(betId);
    },
    [cashoutMutation]
  );

  return {
    activeBet,
    isPlacingBet,
    isCashingOut,
    betError,
    cashoutError,
    place,
    cashout,
  };
}
