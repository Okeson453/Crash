import { useCallback, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useGameStore } from '@/stores/gameStore';
import { getBalance } from '@/api/users';

export function useBalance() {
  const balance = useGameStore((s) => s.balance);
  const currency = useGameStore((s) => s.currency);
  const currencySymbol = useGameStore((s) => s.currencySymbol);
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['balance'],
    queryFn: getBalance,
    staleTime: 5000,
    refetchInterval: 15000,
  });

  // Sync API balance to store — never depend on the whole store object
  useEffect(() => {
    if (data) {
      useGameStore.getState().setBalance(data);
    }
  }, [data]);

  const refreshBalance = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['balance'] });
  }, [queryClient]);

  return {
    balance: balance ?? data?.balance ?? 0,
    currency,
    currencySymbol,
    isLoading,
    error,
    refreshBalance,
  };
}
