import { useCallback, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useGameStore } from '@/stores/gameStore';
import { getBalance } from '@/api/users';

export function useBalance() {
  const store = useGameStore();
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['balance'],
    queryFn: getBalance,
    staleTime: 5000,
    refetchInterval: 15000,
  });

  // Sync API balance to store
  useEffect(() => {
    if (data) {
      store.setBalance(data);
    }
  }, [data, store]);

  const refreshBalance = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['balance'] });
  }, [queryClient]);

  return {
    balance: store.balance ?? data?.balance ?? 0,
    currency: store.currency,
    currencySymbol: store.currencySymbol,
    isLoading,
    error,
    refreshBalance,
  };
}
