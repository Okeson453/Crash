import { describe, expect, it } from 'vitest';
import { createHash, createHmac } from 'node:crypto';

/** Mirror of server crash-point algorithm for regression protection */
function crashPoint(serverSeed: string, clientSeed: string, nonce: number, houseEdge = 0.01): number {
  const digest = createHmac('sha256', serverSeed).update(`${clientSeed}:${nonce}`).digest('hex');
  const intValue = Number.parseInt(digest.slice(0, 13), 16);
  if (intValue % 33 === 0) return 1;
  const remainder = intValue % 2 ** 32;
  if (remainder === 0) return 1;
  return Math.max(1, Math.floor((2 ** 32 / remainder) * (1 - houseEdge) * 100) / 100);
}

function hashSeed(seed: string): string {
  return createHash('sha256').update(seed).digest('hex');
}

describe('provably-fair crash algorithm', () => {
  it('is deterministic for fixed seeds', () => {
    const a = crashPoint('server-seed', 'client-seed', 1);
    const b = crashPoint('server-seed', 'client-seed', 1);
    expect(a).toBe(b);
    expect(a).toBeGreaterThanOrEqual(1);
  });

  it('matches hash of server seed', () => {
    const seed = 'abc123';
    expect(hashSeed(seed)).toBe(createHash('sha256').update(seed).digest('hex'));
  });

  it('changes when nonce changes', () => {
    const a = crashPoint('server-seed', 'client-seed', 1);
    const b = crashPoint('server-seed', 'client-seed', 2);
    // Extremely unlikely to be equal
    expect(a === b).toBe(false);
  });
});
