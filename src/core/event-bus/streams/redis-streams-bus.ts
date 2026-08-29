/**
 * Redis Streams event bus adapter (V1.1).
 * Design ref: Section 2.13 — at-least-once, consumer groups, DLQ path.
 *
 * Coexists with the in-process EventEmitter bus. Workers can subscribe via
 * consumer groups; the legacy EventBus continues for same-process handlers.
 */

import type Redis from 'ioredis';
import { getLogger } from '../../../observability/logger';
import type { BaseEvent } from '../../../types/events';

export interface StreamBusOptions {
  redis: Redis;
  streamKey?: string;
  groupName?: string;
  consumerName?: string;
  maxLen?: number;
  blockMs?: number;
  dlqStreamKey?: string;
}

export class RedisStreamsBus {
  private readonly logger = getLogger();
  private readonly redis: Redis;
  private readonly streamKey: string;
  private readonly groupName: string;
  private readonly consumerName: string;
  private readonly maxLen: number;
  private readonly blockMs: number;
  private readonly dlqStreamKey: string;
  private groupEnsured = false;

  constructor(options: StreamBusOptions) {
    this.redis = options.redis;
    this.streamKey = options.streamKey ?? 'crashwave:events';
    this.groupName = options.groupName ?? 'crashwave-workers';
    this.consumerName = options.consumerName ?? `consumer-${process.pid}`;
    this.maxLen = options.maxLen ?? 100_000;
    this.blockMs = options.blockMs ?? 5_000;
    this.dlqStreamKey = options.dlqStreamKey ?? 'crashwave:events:dlq';
  }

  async ensureGroup(): Promise<void> {
    if (this.groupEnsured) return;
    try {
      await this.redis.xgroup('CREATE', this.streamKey, this.groupName, '0', 'MKSTREAM');
      this.logger.info(
        { component: 'RedisStreamsBus', stream: this.streamKey, group: this.groupName },
        'Consumer group created'
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes('BUSYGROUP')) {
        throw err;
      }
    }
    this.groupEnsured = true;
  }

  /**
   * Publish a domain event to the stream (approximate max length trim).
   */
  async publish(event: BaseEvent): Promise<string> {
    await this.ensureGroup();
    const id = await this.redis.xadd(
      this.streamKey,
      'MAXLEN',
      '~',
      String(this.maxLen),
      '*',
      'type',
      event.type,
      'id',
      event.id,
      'correlationId',
      event.correlationId,
      'source',
      event.source,
      'timestamp',
      event.timestamp,
      'payload',
      JSON.stringify(event.payload ?? {})
    );
    return id as string;
  }

  /**
   * Read one batch via consumer group (XREADGROUP).
   * Caller is responsible for XACK after successful processing.
   */
  async readGroup(
    count: number = 10
  ): Promise<Array<{ streamId: string; event: BaseEvent }>> {
    await this.ensureGroup();
    const result = await this.redis.xreadgroup(
      'GROUP',
      this.groupName,
      this.consumerName,
      'COUNT',
      count,
      'BLOCK',
      this.blockMs,
      'STREAMS',
      this.streamKey,
      '>'
    );

    if (!result) return [];

    const out: Array<{ streamId: string; event: BaseEvent }> = [];
    for (const [, messages] of result as [string, [string, string[]][]][]) {
      for (const [streamId, fields] of messages) {
        const map = fieldArrayToMap(fields);
        out.push({
          streamId,
          event: {
            id: map.id ?? streamId,
            type: map.type as BaseEvent['type'],
            payload: safeJson(map.payload),
            timestamp: map.timestamp ?? new Date().toISOString(),
            correlationId: map.correlationId ?? streamId,
            source: map.source ?? 'streams',
          },
        });
      }
    }
    return out;
  }

  /** Recover messages left pending by crashed consumers. */
  async reclaimPending(minIdleMs: number = 30_000, count: number = 100): Promise<Array<{ streamId: string; event: BaseEvent }>> {
    await this.ensureGroup();
    const result = await this.redis.xautoclaim(this.streamKey, this.groupName, this.consumerName, minIdleMs, '0-0', 'COUNT', count);
    const messages = (result?.[1] ?? []) as [string, string[]][];
    return messages.map(([streamId, fields]) => {
      const map = fieldArrayToMap(fields);
      return { streamId, event: { id: map.id ?? streamId, type: map.type as BaseEvent['type'], payload: safeJson(map.payload), timestamp: map.timestamp ?? new Date().toISOString(), correlationId: map.correlationId ?? streamId, source: map.source ?? 'streams' } };
    });
  }

  async ack(streamId: string): Promise<void> {
    await this.redis.xack(this.streamKey, this.groupName, streamId);
  }

  /** Move poison message to DLQ and ACK original */
  async deadLetter(streamId: string, event: BaseEvent, reason: string): Promise<void> {
    await this.redis.xadd(
      this.dlqStreamKey,
      '*',
      'originalId',
      streamId,
      'type',
      event.type,
      'payload',
      JSON.stringify(event.payload ?? {}),
      'reason',
      reason,
      'timestamp',
      new Date().toISOString()
    );
    await this.ack(streamId);
    this.logger.warn(
      { component: 'RedisStreamsBus', streamId, type: event.type, reason },
      'Event moved to DLQ'
    );
  }
}

function fieldArrayToMap(fields: string[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (let i = 0; i < fields.length; i += 2) {
    map[fields[i]] = fields[i + 1];
  }
  return map;
}

function safeJson(raw: string | undefined): unknown {
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return { raw };
  }
}
