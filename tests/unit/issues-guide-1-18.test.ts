import fs from 'node:fs';
import { resolveJwtSecretString } from '@/config/jwt-secret';
import { getTenantContainer } from '@/app/tenant-container';

describe('Consolidated fix guide 1–18', () => {
  it('1 jwt-secret exists and rejects placeholders in prod', () => {
    expect(fs.existsSync('src/config/jwt-secret.ts')).toBe(true);
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'development-secret-change-in-production';
    expect(() => resolveJwtSecretString()).toThrow();
    process.env.JWT_SECRET = 'c'.repeat(32);
    process.env.REFRESH_SECRET = 'd'.repeat(32);
    expect(resolveJwtSecretString()).toHaveLength(32);
  });

  it('2 WS inject does not put call inside dispatchEvent args', () => {
    const src = fs.readFileSync('src/game/adapter.ts', 'utf8');
    expect(src).not.toMatch(/dispatchEvent\(\s*\(window as any\)\.__crashwaveOnWs/);
    expect(src).toMatch(/__crashwaveOnWs/);
  });

  it('3 primarySource on options interface', () => {
    const src = fs.readFileSync('src/game/adapter.ts', 'utf8');
    expect(src).toMatch(/primarySource\?:/);
  });

  it('5 config history uses listConfigVersions', () => {
    const src = fs.readFileSync('src/api/routes/admin.ts', 'utf8');
    expect(src).toMatch(/listConfigVersions\('betting_config'/);
    expect(src).not.toMatch(/const configHistory: Array/);
  });

  it('6 users filtered in SQL', () => {
    const src = fs.readFileSync('src/api/routes/admin.ts', 'utf8');
    expect(src).toMatch(/LOWER\(COALESCE\(telegram_username/);
  });

  it('8 tenant container isolates ensemble', () => {
    const a = getTenantContainer('t1');
    const b = getTenantContainer('t2');
    expect(a).not.toBe(b);
    expect(a.ensemble).not.toBe(b.ensemble);
  });

  it('10 bot token regex in composition', () => {
    const src = fs.readFileSync('src/app/composition.ts', 'utf8');
    expect(src).toMatch(/isValidBotToken/);
  });

  it('13 msgWindow is Map', () => {
    const src = fs.readFileSync('src/api/websocket/server.ts', 'utf8');
    expect(src).toMatch(/msgWindow = new Map/);
    expect(src).not.toMatch(/msgWindow = new WeakMap/);
  });

  it('17 no passWithNoTests in CI', () => {
    const src = fs.readFileSync('.github/workflows/ci.yml', 'utf8');
    expect(src).not.toMatch(/passWithNoTests/);
  });
});
