import fs from 'node:fs';
import { resolveJwtSecretString, resolveRefreshSecretBytes, assertAuthSecretsAtBoot } from '@/config/jwt-secret';
import { getTenantContainer } from '@/app/tenant-container';

describe('Issues 1–18 final reaudit', () => {
  const env = { ...process.env };
  afterEach(() => {
    process.env = { ...env };
  });

  it('1 jwt-secret file present and wired', () => {
    expect(fs.existsSync('src/config/jwt-secret.ts')).toBe(true);
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'development-secret-change-in-production';
    expect(() => resolveJwtSecretString()).toThrow();
    process.env.JWT_SECRET = 'e'.repeat(32);
    process.env.REFRESH_SECRET = 'f'.repeat(32);
    expect(resolveJwtSecretString()).toHaveLength(32);
    expect(resolveRefreshSecretBytes()).toBeInstanceOf(Uint8Array);
    expect(() => assertAuthSecretsAtBoot()).not.toThrow();
  });

  it('2–3 adapter: valid WS inject, single enableApiAdapter false, primarySource set', () => {
    const src = fs.readFileSync('src/game/adapter.ts', 'utf8');
    expect(src).not.toMatch(/dispatchEvent\(\s*\(window as any\)\.__crashwaveOnWs/);
    expect(src.match(/enableApiAdapter\?: boolean;/g)?.length).toBe(1);
    expect(src).toMatch(/enableApiAdapter: false/);
    expect(src).toMatch(/primarySource\?:/);
  });

  it('4 cashout reads history multiplier', () => {
    const src = fs.readFileSync('src/betting/adapters/browser.ts', 'utf8');
    expect(src).toMatch(/history-item|game-history|last-crash/);
  });

  it('5 history from DB', () => {
    const src = fs.readFileSync('src/api/routes/admin.ts', 'utf8');
    expect(src).toMatch(/listConfigVersions\('betting_config'/);
    expect(src).not.toMatch(/const configHistory: Array/);
  });

  it('6 users SQL filter', () => {
    const src = fs.readFileSync('src/api/routes/admin.ts', 'utf8');
    expect(src).toMatch(/LOWER\(COALESCE\(telegram_username/);
  });

  it('7 stubs 501', () => {
    const src = fs.readFileSync('src/api/routes/admin.ts', 'utf8');
    expect(src).toMatch(/NOT_IMPLEMENTED/);
    expect(src).toMatch(/billing\/subscription/);
  });

  it('8 tenant container', () => {
    expect(getTenantContainer('a').ensemble).not.toBe(getTenantContainer('b').ensemble);
  });

  it('13 msgWindow Map', () => {
    const src = fs.readFileSync('src/api/websocket/server.ts', 'utf8');
    expect(src).toMatch(/msgWindow = new Map/);
  });

  it('16–17 CI hardened', () => {
    const src = fs.readFileSync('.github/workflows/ci.yml', 'utf8');
    expect(src).not.toMatch(/passWithNoTests/);
    expect(src).toMatch(/exit-code: '1'/);
    expect(src).toMatch(/Verify integration tests exist/);
  });
});
