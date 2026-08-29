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
  const store = useGameStore();
  const addToast = useUIStore((s) => s.addToast);
  const queryClient = useQueryClient();
  const { haptic } = useTelegram();

  const placeBetMutation = useMutation({
    mutationFn: (request: PlaceBetRequest) => placeBet(request, createIdempotencyKey()),
    onMutate: () => {
      store.setIsPlacingBet(true);
      store.clearErrors();
    },
    onSuccess: (bet) => {
      store.setActiveBet(bet);
      store.setIsPlacingBet(false);
      haptic('notification', 'success');
      addToast({
        type: 'success',
        message: `Bet placed: $${bet.amount.toFixed(2)}`,
      });
      void queryClient.invalidateQueries({ queryKey: ['balance'] });
      void queryClient.invalidateQueries({ queryKey: ['bets'] });
    },
    onError: (error: Error) => {
      store.setIsPlacingBet(false);
      store.setBetError(error.message);
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
      store.setIsCashingOut(true);
      store.clearErrors();
    },
    onSuccess: (result) => {
      store.setIsCashingOut(false);
      haptic('notification', 'success');
      addToast({
        type: 'success',
        message: `Cashed out at ${result.multiplier.toFixed(2)}x!`,
      });
      void queryClient.invalidateQueries({ queryKey: ['balance'] });
      void queryClient.invalidateQueries({ queryKey: ['bets'] });
    },
    onError: (error: Error) => {
      store.setIsCashingOut(false);
      store.setCashoutError(error.message);
      haptic('notification', 'error');
      addToast({
        type: 'error',
        message: error.message,
      });
    },
  });

  const place = useCallback(
    (request: PlaceBetRequest) => {
      if (store.isPlacingBet) return;
      placeBetMutation.mutate(request);
    },
    [placeBetMutation, store.isPlacingBet]
  );

  const cashout = useCallback(
    (betId: string) => {
      if (store.isCashingOut) return;
      cashoutMutation.mutate(betId);
    },
    [cashoutMutation, store.isCashingOut]
  );

  return {
    activeBet: store.activeBets[index],
    isPlacingBet: store.isPlacingBet,
    isCashingOut: store.isCashingOut,
    betError: store.betError,
    cashoutError: store.cashoutError,
    place,
    cashout,
  };
}
