/**
 * Socket.io WebSocket server for real-time game events
 * Integrates with the existing event bus
 */

import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { jwtVerify } from 'jose';
import { getEventBusInstance } from '@/app/composition';
import { miniGameService } from '@/mini-app/game-service';
import { getLogger } from '@/observability/logger';

function resolveJwtSecretBytes(): Uint8Array {
  const secret = process.env.JWT_SECRET?.trim();
  const isProd = process.env.NODE_ENV === 'production';
  if (isProd && (!secret || secret === 'development-secret-change-in-production' || secret.length < 32)) {
    throw new Error('JWT_SECRET must be set (≥32 chars) in production');
  }
  const s = secret || (process.env.NODE_ENV === 'test' ? 'test-jwt-secret-for-unit-tests-only-32chars' : 'development-secret-change-in-production');
  return new TextEncoder().encode(s);
}
const JWT_SECRET = resolveJwtSecretBytes();

interface AuthenticatedSocket extends Socket {
  userId?: string;
  tenantId?: string | null;
  role?: string;
}

let io: SocketIOServer | null = null;

export function createWebSocketServer(httpServer: HttpServer): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    path: '/socket.io',
    cors: {
      origin: (() => {
        const isProd = process.env.NODE_ENV === 'production';
        const raw = process.env.CORS_ORIGIN?.trim();
        if (isProd && (!raw || raw === 'true' || raw === '*')) {
          throw new Error('CORS_ORIGIN must be explicit in production (websocket)');
        }
        if (!raw || raw === 'true') return true;
        if (raw === '*') return true;
        return raw.split(',').map((s) => s.trim());
      })(),
      credentials: true,
    },
    transports: ['websocket'],
    pingTimeout: 30000,
    pingInterval: 30000,
  });

  // Authentication middleware
  io.use(async (socket: AuthenticatedSocket, next) => {
    try {
      const token = socket.handshake.auth.token as string;
      if (!token) {
        return next(new Error('Authentication required'));
      }

      const { payload } = await jwtVerify(token, JWT_SECRET, {
        algorithms: ['HS256'],
        clockTolerance: 60,
      });

      socket.userId = payload.sub;
      socket.tenantId = payload.tenantId ? String(payload.tenantId) : null;
      socket.role = payload.role as string;

      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket: AuthenticatedSocket) => {
    getLogger().info({ component: 'MiniAppWebSocket', userId: socket.userId }, 'WS client connected');

    // Subscribe to user-specific channel
    if (socket.userId) {
      socket.join(`user:${socket.userId}`);
    }

    // Subscribe to tenant game channel
    if (socket.tenantId) {
      socket.join(`game:${socket.tenantId}`);
    } else {
      socket.join('game:default');
    }

    // Admin channel
    if (socket.role === 'operator' || socket.role === 'admin') {
      if (socket.tenantId) {
        socket.join(`admin:${socket.tenantId}`);
      }
      socket.join('admin:default');
    }

    // Handle explicit subscription requests
    socket.on('subscribe', (data: { channel: string }) => {
      const { channel } = data;
      if (typeof channel !== 'string') { socket.emit('error', { message: 'Invalid channel' }); return; }
      // Validate channel access
      if (channel.startsWith('user:') && channel !== `user:${socket.userId}`) {
        socket.emit('error', { message: 'Cannot subscribe to other user channels' });
        return;
      }
      if (channel.startsWith('admin:') && socket.role !== 'operator' && socket.role !== 'admin') { socket.emit('error', { message: 'Admin channel requires operator role' }); return; }
      if (channel.startsWith('game:') && socket.tenantId && channel !== `game:${socket.tenantId}`) { socket.emit('error', { message: 'Cannot subscribe to another tenant' }); return; }
      socket.join(channel);
      socket.emit('subscribed', { channel });
    });

    socket.on('unsubscribe', (data: { channel: string }) => {
      socket.leave(data.channel);
      socket.emit('unsubscribed', { channel: data.channel });
    });

    // Heartbeat
    socket.on('pong', () => {
      // Client responded to ping
    });

    socket.on('disconnect', (reason) => {
      getLogger().info({ component: 'MiniAppWebSocket', userId: socket.userId, reason }, 'WS client disconnected');
    });
  });

  // Integrate the Mini App game service without coupling it to the legacy event bus.
  miniGameService.subscribe((name, payload) => {
    if (!io) return;
    const message = { type: name, payload, timestamp: new Date().toISOString(), sequence: Date.now() };
    const tenantId = typeof payload.tenantId === 'string' ? payload.tenantId : undefined;
    const resolvedTenant = tenantId ?? (typeof payload.userId === 'string' ? payload.userId : undefined);
    if (name.startsWith('game:')) io.emit('event', message);
    else io.to(resolvedTenant ? `game:${resolvedTenant}` : 'game:default').emit('event', message);
    if (typeof payload.userId === 'string') io.to(`user:${payload.userId}`).emit('event', message);
  });

  integrateWithEventBus(io);

  return io;
}

function integrateWithEventBus(io: SocketIOServer): void {
  try {
    const eventBus = getEventBusInstance();

    // Forward game events to WebSocket clients
    eventBus.on('round:start', (event) => {
      const payload = event.payload as Record<string, unknown>;
      broadcast('game:round-start', payload);
    });

    eventBus.on('tick', (event) => {
      const payload = event.payload as Record<string, unknown>;
      broadcast('game:multiplier', payload);
    });

    eventBus.on('round:end', (event) => {
      const payload = event.payload as Record<string, unknown>;
      broadcast('game:round-end', payload);
    });

    eventBus.on('countdown', (event) => {
      const payload = event.payload as Record<string, unknown>;
      broadcast('game:countdown', payload);
    });

    eventBus.on('bet:placed', (event) => {
      const payload = event.payload as Record<string, unknown>;
      const userId = payload.userId as string;
      if (userId) {
        io.to(`user:${userId}`).emit('event', {
          type: 'bet:placed',
          payload,
          timestamp: new Date().toISOString(),
        });
      }
    });

    eventBus.on('bet:cashed-out', (event) => {
      const payload = event.payload as Record<string, unknown>;
      const userId = payload.userId as string;
      if (userId) {
        io.to(`user:${userId}`).emit('event', {
          type: 'bet:cashed-out',
          payload,
          timestamp: new Date().toISOString(),
        });
      }
    });

    eventBus.on('balance:updated', (event) => {
      const payload = event.payload as Record<string, unknown>;
      const userId = payload.userId as string;
      if (userId) {
        io.to(`user:${userId}`).emit('event', {
          type: 'user:balance',
          payload,
          timestamp: new Date().toISOString(),
        });
      }
    });
  } catch {
    // Event bus not available yet
  }
}

function broadcast(type: string, payload: Record<string, unknown>): void {
  if (!io) return;

  const message = {
    type,
    payload,
    timestamp: new Date().toISOString(),
    sequence: Date.now(),
  };

  // Broadcast to all game channels
  io.to('game:default').emit('event', message);

  // Also broadcast to specific tenant channels if present
  const tenantId = payload.tenantId as string | undefined;
  if (tenantId) {
    io.to(`game:${tenantId}`).emit('event', message);
  }
}

export function getIO(): SocketIOServer | null {
  return io;
}
