import { wsClient } from '@/lib/websocket-client';
import type { ConnectionState } from '@/lib/websocket-client';

export { wsClient, type ConnectionState };

export function connectWebSocket(token: string): void {
  wsClient.connect(token);
}

export function disconnectWebSocket(): void {
  wsClient.disconnect();
}

export function subscribeToGameChannel(tenantId: string): void {
  wsClient.subscribe(`game:${tenantId}`);
}

export function subscribeToUserChannel(userId: string): void {
  wsClient.subscribe(`user:${userId}`);
}

export function subscribeToAdminChannel(tenantId: string): void {
  wsClient.subscribe(`admin:${tenantId}`);
}

export function unsubscribeFromChannel(channel: string): void {
  wsClient.unsubscribe(channel);
}
