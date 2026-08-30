/**
 * Role-aware Postgres pool sizing (performance plan §2).
 */

import type { AppConfig } from '../config/schema.js';
import { resolveProcessRole } from '../config/loader.js';

export function resolveDatabasePoolSize(config?: AppConfig): number {
  const env = Number(process.env.DATABASE_POOL_SIZE ?? process.env.DB_POOL_SIZE);
  if (Number.isFinite(env) && env > 0) return Math.min(100, Math.floor(env));

  const fromConfig = config?.persistence?.databasePoolSize;
  if (typeof fromConfig === 'number' && fromConfig > 0) return fromConfig;

  const role = resolveProcessRole(config);
  switch (role) {
    case 'control-plane':
      return 30;
    case 'automation-worker':
      return 12;
    case 'mini-app-game':
      return 12;
    case 'all':
    default:
      return 30;
  }
}
