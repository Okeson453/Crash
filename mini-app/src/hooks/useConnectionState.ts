import { useEffect, useState } from 'react';
import { wsClient, type ConnectionState } from '@/api/websocket';

export function useConnectionState() {
  const [state, setState] = useState<ConnectionState>(wsClient.state);

  useEffect(() => {
    return wsClient.onStateChange((newState) => {
      setState(newState);
    });
  }, []);

  const isConnected = state === 'connected';
  const isConnecting = state === 'connecting';
  const isReconnecting = state === 'reconnecting';
  const isDisconnected = state === 'disconnected';
  const isFailed = state === 'failed';

  return {
    state,
    isConnected,
    isConnecting,
    isReconnecting,
    isDisconnected,
    isFailed,
    isOnline: isConnected,
  };
}
