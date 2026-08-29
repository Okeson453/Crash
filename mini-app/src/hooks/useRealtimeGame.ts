import { useEffect } from 'react';
import { useGameStore } from '@/stores/gameStore';
import { wsClient } from '@/api/websocket';
import { useUIStore } from '@/stores/uiStore';
import { playSound } from '@/lib/sound';

export function useRealtimeGame() {
  const store = useGameStore();
  const addToast = useUIStore((s) => s.addToast);

  useEffect(() => {
    const unsubBetPlaced = wsClient.onBetPlaced((event) => {
      store.setActiveBet(event.bet);
      playSound('bet-placed');
      store.addLiveFeedItem({
        id: `bet-${event.bet.id}`,
        type: 'bet',
        username: 'You',
        amount: event.bet.amount,
        message: `Bet placed: ${event.bet.amount}`,
        timestamp: event.serverTime,
      });
    });

    const unsubBetCashedOut = wsClient.onBetCashedOut((event) => {
      playSound('cashout');
      if (store.activeBet?.id === event.betId) {
        store.setActiveBet({
          ...store.activeBet,
          state: 'cashed_out',
          cashoutMultiplier: event.multiplier,
          pnl: event.pnl,
        });
      }
      store.addLiveFeedItem({
        id: `cashout-${event.betId}`,
        type: 'cashout',
        username: 'You',
        multiplier: event.multiplier,
        pnl: event.pnl,
        message: `Cashed out at ${event.multiplier.toFixed(2)}x`,
        timestamp: event.serverTime,
      });
      addToast({
        type: 'success',
        message: `Cashed out at ${event.multiplier.toFixed(2)}x! (+$${event.pnl.toFixed(2)})`,
      });
    });

    const unsubRoundEnd = wsClient.onRoundEnd((event) => { playSound('crash'); if (store.activeBet?.state === 'cashed_out') playSound('win-jingle'); void event; });

    const unsubBalance = wsClient.onBalanceUpdate((event) => {
      store.updateBalance(event.balance);
    });

    const unsubError = wsClient.onSystemError((event) => {
      addToast({
        type: 'error',
        message: event.message,
      });
    });

    return () => {
      unsubBetPlaced();
      unsubBetCashedOut();
      unsubBalance();
      unsubRoundEnd();
      unsubError();
    };
  }, [store, addToast]);
}
