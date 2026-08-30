/**
 * Process dispatcher — routes to control-plane | automation-worker | mini-app-game | monolith.
 *
 * PROCESS_ROLE=control-plane|automation-worker|mini-app-game|all
 * PLATFORM_MODE=control-plane maps to control-plane for backward compatibility.
 */

import { resolveProcessRole } from './config/loader.js';
import { getLogger } from './observability/logger.js';

async function main(): Promise<void> {
  const role = resolveProcessRole();
  process.env.PROCESS_ROLE = role;

  const logger = getLogger();
  logger.info({ role }, 'Starting process by role');

  if (role === 'control-plane') {
    const m = await import('./entry/control-plane.js');
    await m.main();
    return;
  }
  if (role === 'automation-worker') {
    const m = await import('./entry/automation-worker.js');
    await m.main();
    return;
  }
  if (role === 'mini-app-game') {
    const m = await import('./entry/mini-app-game.js');
    await m.main();
    return;
  }

  // Local / default: combined process
  const m = await import('./entry/monolith.js');
  await m.main();
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Fatal startup error', err);
  process.exit(1);
});
