/**
 * Provably fair verification utilities
 */

/**
 * Verify that a crash point was generated fairly using the server seed, client seed, and nonce.
 */
export async function verifyCrashPoint(
  serverSeed: string,
  clientSeed: string,
  nonce: number,
  expectedCrashPoint: number
): Promise<{ valid: boolean; calculatedCrashPoint: number }> {
  const message = `${clientSeed}:${nonce}`;
  const hash = await hmacSha256(serverSeed, message);
  const calculatedCrashPoint = calculateCrashPointFromHash(hash);

  // Allow small floating point tolerance
  const tolerance = 0.0001;
  const valid = Math.abs(calculatedCrashPoint - expectedCrashPoint) < tolerance;

  return { valid, calculatedCrashPoint };
}

/**
 * Calculate the crash point from a hex hash using the provably fair algorithm.
 */
export function calculateCrashPointFromHash(hash: string): number {
  // Take first 13 hex chars (52 bits)
  const hashPrefix = hash.slice(0, 13);
  const intValue = parseInt(hashPrefix, 16);

  // If the value is divisible by 33, it's an instant crash (1.00x)
  if (intValue % 33 === 0) {
    return 1.0;
  }

  // Calculate crash point using the formula: 4294967296 / (intValue % 4294967296)
  const maxInt = 4294967296; // 2^32
  const result = maxInt / (intValue % maxInt);

  // Apply house edge (1%)
  const houseEdge = 0.01;
  const crashPoint = Math.max(1.0, Math.floor(result * (1 - houseEdge) * 100) / 100);

  return crashPoint;
}

/**
 * Generate HMAC-SHA256 hash
 */
async function hmacSha256(key: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(message));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Verify the server seed hash matches the revealed server seed
 */
export async function verifyServerSeedHash(
  serverSeed: string,
  expectedHash: string
): Promise<boolean> {
  const hash = await sha256(serverSeed);
  return hash === expectedHash;
}

async function sha256(message: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
