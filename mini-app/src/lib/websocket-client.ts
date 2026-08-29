import { io, Socket } from 'socket.io-client';
import { WS_URL } from '@/config/env';
import { logger } from '@/utils/logger';
import type {
  WebSocketEvent,
  GameStateEvent,
  GameMultiplierEvent,
  GameRoundStartEvent,
  GameRoundEndEvent,
  GameCountdownEvent,
  BetPlacedEvent,
  BetCashedOutEvent,
  UserBalanceEvent,
  SystemErrorEvent,
} from '@/types/api';

type EventCallback<T> = (event: T) => void;

export type ConnectionState = 'connected' | 'connecting' | 'reconnecting' | 'disconnected' | 'failed';

export class WebSocketClient {
  private socket: Socket | null = null;
  private token: string | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private maxReconnectDelay = 30000;
  private listeners: Map<string, Set<EventCallback<unknown>>> = new Map();
  private stateChangeListeners: Set<(state: ConnectionState) => void> = new Set();
  private _state: ConnectionState = 'disconnected';
  private messageSequence = 0;
  private pendingSubscriptions: string[] = [];

  get state(): ConnectionState {
    return this._state;
  }

  private setState(state: ConnectionState): void {
    if (this._state === state) return;
    this._state = state;
    this.stateChangeListeners.forEach((cb) => cb(state));
  }

  connect(token: string): void {
    if (this.socket?.connected) {
      if (this.token === token) return;
      this.disconnect();
    }

    this.token = token;
    this.reconnectAttempts = 0;
    this.setState('connecting');

    this.socket = io(WS_URL, {
      transports: ['websocket'],
      auth: { token },
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: this.reconnectDelay,
      reconnectionDelayMax: this.maxReconnectDelay,
      randomizationFactor: 0.5,
      timeout: 10000,
    });

    this.socket.on('connect', () => {
      this.reconnectAttempts = 0;
      this.setState('connected');
      // Resubscribe to pending channels
      this.pendingSubscriptions.forEach((channel) => this.subscribe(channel));
    });

    this.socket.on('disconnect', (reason) => {
      if (reason === 'io server disconnect') {
        // Server forced disconnect, don't reconnect automatically
        this.setState('disconnected');
      } else {
        this.setState('reconnecting');
      }
    });

    this.socket.on('connect_error', () => {
      this.reconnectAttempts++;
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        this.setState('failed');
        this.disconnect();
      } else {
        this.setState('reconnecting');
      }
    });

    this.socket.on('event', (event: WebSocketEvent<unknown>) => {
      this.handleEvent(event);
    });

    // Heartbeat/ping handling
    this.socket.on('ping', () => {
      this.socket?.emit('pong');
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
    this.token = null;
    this.setState('disconnected');
  }

  subscribe(channel: string): void {
    if (!this.socket?.connected) {
      this.pendingSubscriptions.push(channel);
      return;
    }
    this.socket.emit('subscribe', { channel });
  }

  unsubscribe(channel: string): void {
    this.pendingSubscriptions = this.pendingSubscriptions.filter((c) => c !== channel);
    this.socket?.emit('unsubscribe', { channel });
  }

  on<T>(eventType: string, callback: EventCallback<T>): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    const callbacks = this.listeners.get(eventType)!;
    const wrappedCallback = callback as EventCallback<unknown>;
    callbacks.add(wrappedCallback);

    return () => {
      callbacks.delete(wrappedCallback);
    };
  }

  onStateChange(callback: (state: ConnectionState) => void): () => void {
    this.stateChangeListeners.add(callback);
    // Immediately call with current state
    callback(this._state);
    return () => {
      this.stateChangeListeners.delete(callback);
    };
  }

  private handleEvent(event: WebSocketEvent<unknown>): void {
    this.messageSequence = Math.max(this.messageSequence, event.sequence);
    const callbacks = this.listeners.get(event.type);
    if (callbacks) {
      callbacks.forEach((cb) => {
        try {
          cb(event.payload);
        } catch (err) {
          logger.error('WebSocket event handler error', err);
        }
      });
    }
  }

  // Typed event helpers
  onGameState(callback: EventCallback<GameStateEvent>): () => void {
    return this.on('game:state', callback);
  }

  onMultiplier(callback: EventCallback<GameMultiplierEvent>): () => void {
    return this.on('game:multiplier', callback);
  }

  onRoundStart(callback: EventCallback<GameRoundStartEvent>): () => void {
    return this.on('game:round-start', callback);
  }

  onRoundEnd(callback: EventCallback<GameRoundEndEvent>): () => void {
    return this.on('game:round-end', callback);
  }

  onCountdown(callback: EventCallback<GameCountdownEvent>): () => void {
    return this.on('game:countdown', callback);
  }

  onBetPlaced(callback: EventCallback<BetPlacedEvent>): () => void {
    return this.on('bet:placed', callback);
  }

  onBetCashedOut(callback: EventCallback<BetCashedOutEvent>): () => void {
    return this.on('bet:cashed-out', callback);
  }

  onBalanceUpdate(callback: EventCallback<UserBalanceEvent>): () => void {
    return this.on('user:balance', callback);
  }

  onSystemError(callback: EventCallback<SystemErrorEvent>): () => void {
    return this.on('system:error', callback);
  }
}

// Singleton instance
export const wsClient = new WebSocketClient();
