import { applyProcessRoleEnv, resolveProcessRole } from '@/config/loader';
import type { AppConfig } from '@/config/schema';

describe('Process role split', () => {
  const prev = { ...process.env };
  afterEach(() => {
    process.env = { ...prev };
  });

  it('resolves PROCESS_ROLE env', () => {
    process.env.PROCESS_ROLE = 'control-plane';
    expect(resolveProcessRole()).toBe('control-plane');
    process.env.PROCESS_ROLE = 'automation-worker';
    expect(resolveProcessRole()).toBe('automation-worker');
    process.env.PROCESS_ROLE = 'mini-app-game';
    expect(resolveProcessRole()).toBe('mini-app-game');
  });

  it('maps PLATFORM_MODE=control-plane', () => {
    delete process.env.PROCESS_ROLE;
    process.env.PLATFORM_MODE = 'control-plane';
    expect(resolveProcessRole()).toBe('control-plane');
  });

  it('applyProcessRoleEnv updates config', () => {
    process.env.PROCESS_ROLE = 'mini-app-game';
    const base = {
      system: { mode: 'dry-run', processRole: 'all', logLevel: 'info', serviceName: 'x', apiPort: 8081 },
    } as AppConfig;
    const next = applyProcessRoleEnv(base);
    expect(next.system.processRole).toBe('mini-app-game');
  });
});
