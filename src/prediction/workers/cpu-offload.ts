/**
 * Optional worker_threads offload for CPU-heavy offline jobs (regime fit / WF).
 * Falls back to inline when worker_threads unavailable.
 */

import { Worker } from 'worker_threads';
import { fileURLToPath } from 'url';
import path from 'path';

export interface OffloadResult<T> {
  result: T;
  mode: 'worker' | 'inline';
}

/** Run a pure JSON-serializable job in a worker when possible */
export async function offloadJsonJob<T>(
  workerRelativePath: string,
  workerData: unknown,
  inlineFallback: () => T | Promise<T>
): Promise<OffloadResult<T>> {
  try {
    const base = path.dirname(fileURLToPath(import.meta.url));
    const workerPath = path.join(base, workerRelativePath);
    const result = await new Promise<T>((resolve, reject) => {
      const w = new Worker(workerPath, { workerData });
      w.on('message', (msg) => resolve(msg as T));
      w.on('error', reject);
      w.on('exit', (code) => {
        if (code !== 0) reject(new Error(`Worker exit ${code}`));
      });
    });
    return { result, mode: 'worker' };
  } catch {
    return { result: await inlineFallback(), mode: 'inline' };
  }
}
