import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { connectWebSocket, disconnectWebSocket, wsClient } from '@/api/websocket';
import { getStoredTokens } from '@/api/auth';
import type { ConnectionState } from '@/lib/websocket-client';

interface WebSocketContextValue {
  isConnected: boolean;
  connectionState: ConnectionState;
}

const WebSocketContext = createContext<WebSocketContextValue>({
  isConnected: false,
  connectionState: 'disconnected',
});

export function useWebSocketContext() {
  return useContext(WebSocketContext);
}

interface WebSocketProviderProps {
  children: ReactNode;
}

export function WebSocketProvider({ children }: WebSocketProviderProps) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');

  useEffect(() => {
    const unsubscribe = wsClient.onStateChange((state) => {
      setConnectionState(state);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (isAuthenticated && user) {
      const tokens = getStoredTokens();
      if (tokens?.accessToken) {
        connectWebSocket(tokens.accessToken);

        // Subscribe to relevant channels
        if (user.id) {
          wsClient.subscribe(`user:${user.id}`);
        }
      }
    } else {
      disconnectWebSocket();
    }

    return () => {
      disconnectWebSocket();
    };
  }, [isAuthenticated, user]);

  return (
    <WebSocketContext.Provider
      value={{
        isConnected: connectionState === 'connected',
        connectionState,
      }}
    >
      {children}
    </WebSocketContext.Provider>
  );
}
