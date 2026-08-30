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

import { resolveJwtSecretBytes } from '@/config/jwt-secret';
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
        if (!raw || raw === 'true' || raw === '*') {
          return isProd ? false : ['http://localhost:5173', 'http://127.0.0.1:5173'];
        }
        return raw.split(',').map((s) => s.trim()).filter(Boolean);
      })(),
      credentials: true,
    },
    transports: ['websocket'],
    pingTimeout: 30000,
    pingInterval: 30000,
  });

  // Phase 3.2 — Redis adapter for multi-instance (separate pub/sub clients)
  void (async () => {
    try {
      const redisUrl = process.env.REDIS_URL || process.env.SOCKET_REDIS_URL;
      if (!redisUrl || !io) return;
      // Dynamic import so package remains optional at build time
      // optional dependency may be present
      const adapterMod = await import('@socket.io/redis-adapter');
      const ioredis = await import('ioredis');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const RedisAny: any = (ioredis as any).Redis || (ioredis as any).default || ioredis;
      const pubClient = new RedisAny(redisUrl, { maxRetriesPerRequest: null });
      const subClient = pubClient.duplicate();
      const createAdapter = adapterMod.createAdapter || adapterMod.default?.createAdapter;
      if (typeof createAdapter === 'function') {
        io.adapter(createAdapter(pubClient, subClient));
        getLogger().info({ component: 'MiniAppWebSocket' }, 'Socket.IO Redis adapter attached');
      }
    } catch (err) {
      getLogger().warn(
        { component: 'MiniAppWebSocket', error: String(err) },
        'Socket.IO Redis adapter not attached (single-instance mode)'
      );
    }
  })();

  // Connection rate limit per IP + auth + revocation
  const connWindow = new Map<string, { n: number; reset: number }>();
  const msgWindow = new Map<string, { n: number; reset: number }>();
  const userSockets = new Map<string, number>();
  const MAX_CONN_PER_MIN = Number(process.env.WS_MAX_CONN_PER_MIN ?? 30);
  const MAX_MSG_PER_SEC = Number(process.env.WS_MAX_MSG_PER_SEC ?? 20);
  const MAX_SOCKETS_PER_USER = Number(process.env.WS_MAX_SOCKETS_PER_USER ?? 5);

  // Authentication middleware
  io.use(async (socket: AuthenticatedSocket, next) => {
    try {
      const ip = String(socket.handshake.address || 'unknown');
      const now = Date.now();
      let c = connWindow.get(ip);
      if (!c || now > c.reset) {
        c = { n: 0, reset: now + 60_000 };
        connWindow.set(ip, c);
      }
      c.n += 1;
      if (c.n > MAX_CONN_PER_MIN) {
        return next(new Error('Connection rate limit exceeded'));
      }
      try {
        const { getRedisClient } = await import('../../persistence/redis-client.js');
        const redis = getRedisClient();
        const key = `ws:conn:${ip}`;
        const n = await redis.incr(key);
        if (n === 1) await redis.expire(key, 60);
        if (n > MAX_CONN_PER_MIN) return next(new Error('Connection rate limit exceeded'));
      } catch { /* in-memory fallback above */ }

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

      // Token revocation check
      try {
        const { createHash } = await import('node:crypto');
        const { getRedisClient } = await import('../../persistence/redis-client.js');
        const hash = createHash('sha256').update(token).digest('hex');
        if (await getRedisClient().get(`miniapp:revoked:${hash}`)) {
          return next(new Error('Session revoked'));
        }
      } catch (err) {
        if (process.env.NODE_ENV === 'production') {
          return next(new Error('Auth store unavailable'));
        }
      }

      const uid = String(payload.sub);
      const cur = userSockets.get(uid) ?? 0;
      if (cur >= MAX_SOCKETS_PER_USER) {
        return next(new Error('Too many concurrent sockets'));
      }
      userSockets.set(uid, cur + 1);
      socket.on('disconnect', () => {
        const n = (userSockets.get(uid) ?? 1) - 1;
        if (n <= 0) userSockets.delete(uid);
        else userSockets.set(uid, n);
      });

      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket: AuthenticatedSocket) => {
    getLogger().info({ component: 'MiniAppWebSocket', userId: socket.userId }, 'WS client connected');
    socket.use((packet, next) => {
      const now = Date.now();
      const sid = socket.id;
      let w = msgWindow.get(sid);
      if (!w || now > w.reset) {
        w = { n: 0, reset: now + 1000 };
        msgWindow.set(sid, w);
      }
      w.n += 1;
      if (w.n > MAX_MSG_PER_SEC) return next(new Error('Message rate limit exceeded'));
      next();
    });


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
      try { msgWindow.delete(socket.id); } catch { /* */ }

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

/** Fan out mini-game events to connected sockets (control-plane) */
export function broadcastGameEvent(name: string, payload: Record<string, unknown>): void {
  if (!io) return;
  io.to('game:default').emit(name, payload);
  // also emit on tenant rooms if payload has tenantId
  const tenantId = payload.tenantId != null ? String(payload.tenantId) : null;
  if (tenantId) {
    io.to(`game:${tenantId}`).emit(name, payload);
  }
}

/** Graceful WS shutdown — stop accepting, drain, disconnect */
export async function closeWebSocketServer(timeoutMs = 10_000): Promise<void> {
  if (!io) return;
  const server = io;
  io = null;
  await new Promise<void>((resolve) => {
    const t = setTimeout(() => {
      try {
        server.disconnectSockets(true);
      } catch { /* */ }
      resolve();
    }, timeoutMs);
    server.close(() => {
      clearTimeout(t);
      resolve();
    });
  });
}
