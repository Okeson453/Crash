import { useCallback, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useGameStore } from '@/stores/gameStore';
import { getGameState, getGameConfig, getRecentRounds } from '@/api/game';
import { wsClient } from '@/api/websocket';


export function useGameState() {
  const store = useGameStore();

  // Fetch initial game state
  const { data: initialState } = useQuery({
    queryKey: ['game-state'],
    queryFn: getGameState,
    staleTime: 5000,
    refetchInterval: 5000,
  });

  // Fetch game config
  const { data: config } = useQuery({
    queryKey: ['game-config'],
    queryFn: getGameConfig,
    staleTime: Infinity,
  });

  // Fetch recent rounds
  const { data: recentRounds } = useQuery({
    queryKey: ['recent-rounds'],
    queryFn: () => getRecentRounds(20),
    staleTime: 10000,
  });

  // Update store when initial data loads
  useEffect(() => {
    if (initialState) {
      store.setGameState(initialState);
    }
  }, [initialState, store]);

  useEffect(() => {
    if (config) {
      store.setGameConfig(config);
    }
  }, [config, store]);

  useEffect(() => {
    if (recentRounds) {
      recentRounds.forEach((round) => {
        store.addRoundHistory({
          roundId: round.id,
          crashPoint: round.crashPoint,
          timestamp: round.crashedAt || round.startedAt,
        });
      });
    }
  }, [recentRounds, store]);

  // Subscribe to WebSocket events
  useEffect(() => {
    const unsubState = wsClient.onGameState((event) => {
      store.setGameState(event.state);
    });

    const unsubMultiplier = wsClient.onMultiplier((event) => {
      store.setMultiplier(event.multiplier);
    });

    const unsubRoundStart = wsClient.onRoundStart((event) => {
      store.setPhase('countdown');
      store.setCountdown(event.countdownSeconds);
      store.resetForNewRound();
    });

    const unsubCountdown = wsClient.onCountdown((event) => {
      store.setCountdown(event.secondsRemaining);
      if (event.secondsRemaining <= 0) {
        store.setPhase('running');
      }
    });

    const unsubRoundEnd = wsClient.onRoundEnd((event) => {
      store.setPhase('crashed');
      store.setMultiplier(event.crashPoint);
      store.addRoundHistory({
        roundId: event.roundId,
        crashPoint: event.crashPoint,
        timestamp: new Date().toISOString(),
      });
    });

    return () => {
      unsubState();
      unsubMultiplier();
      unsubRoundStart();
      unsubCountdown();
      unsubRoundEnd();
    };
  }, [store]);

  const canPlaceBet = useCallback(() => {
    return (
      store.phase === 'waiting' ||
      store.phase === 'countdown'
    );
  }, [store.phase]);

  const canCashout = useCallback(() => {
    return (
      store.phase === 'running' &&
      store.activeBet !== null &&
      store.activeBet.state === 'active'
    );
  }, [store.phase, store.activeBet]);

  return {
    phase: store.phase,
    roundId: store.roundId,
    multiplier: store.multiplier,
    countdownSeconds: store.countdownSeconds,
    crashPoint: store.crashPoint,
    config: store.config,
    activeBet: store.activeBet,
    roundHistory: store.roundHistory,
    liveFeed: store.liveFeed,
    isPlacingBet: store.isPlacingBet,
    isCashingOut: store.isCashingOut,
    betError: store.betError,
    cashoutError: store.cashoutError,
    canPlaceBet,
    canCashout,
    setIsPlacingBet: store.setIsPlacingBet,
    setIsCashingOut: store.setIsCashingOut,
    setBetError: store.setBetError,
    setCashoutError: store.setCashoutError,
    clearErrors: store.clearErrors,
  };
}
