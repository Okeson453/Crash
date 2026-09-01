import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useGameStore } from '@/stores/gameStore';
import { getGameState, getGameConfig, getRecentRounds } from '@/api/game';
import { wsClient } from '@/api/websocket';

/**
 * Load game state/config/history and wire WebSocket → store.
 * Use getState() in effects so we never put the whole zustand store in deps
 * (that re-fires on every state tick and can trigger React #185 max update depth).
 */
export function useGameState() {
  const { data: initialState } = useQuery({
    queryKey: ['game-state'],
    queryFn: getGameState,
    staleTime: 5000,
    refetchInterval: 5000,
  });

  const { data: config } = useQuery({
    queryKey: ['game-config'],
    queryFn: getGameConfig,
    staleTime: Infinity,
  });

  const { data: recentRounds } = useQuery({
    queryKey: ['recent-rounds'],
    queryFn: () => getRecentRounds(20),
    staleTime: 10000,
  });

  useEffect(() => {
    if (initialState) {
      useGameStore.getState().setGameState(initialState);
    }
  }, [initialState]);

  useEffect(() => {
    if (config) {
      useGameStore.getState().setGameConfig(config);
    }
  }, [config]);

  useEffect(() => {
    if (recentRounds) {
      const { addRoundHistory } = useGameStore.getState();
      recentRounds.forEach((round) => {
        addRoundHistory({
          roundId: round.id,
          crashPoint: round.crashPoint,
          timestamp: round.crashedAt || round.startedAt,
        });
      });
    }
  }, [recentRounds]);

  useEffect(() => {
    const unsubState = wsClient.onGameState((event) => {
      useGameStore.getState().setGameState(event.state);
    });

    const unsubMultiplier = wsClient.onMultiplier((event) => {
      useGameStore.getState().setMultiplier(event.multiplier);
    });

    const unsubRoundStart = wsClient.onRoundStart((event) => {
      const s = useGameStore.getState();
      s.setPhase('countdown');
      s.setCountdown(event.countdownSeconds);
      s.resetForNewRound();
    });

    const unsubCountdown = wsClient.onCountdown((event) => {
      const s = useGameStore.getState();
      s.setCountdown(event.secondsRemaining);
      if (event.secondsRemaining <= 0) {
        s.setPhase('running');
      }
    });

    const unsubRoundEnd = wsClient.onRoundEnd((event) => {
      const s = useGameStore.getState();
      s.setPhase('crashed');
      s.setMultiplier(event.crashPoint);
      s.addRoundHistory({
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
  }, []);
}
