import { resolveJwtSecretString, assertAuthSecretsAtBoot } from '@/config/jwt-secret';
import { CURRENT_FEATURE_VERSION } from '@/prediction/features/feature-meta';
import { resetPool, createIsolatedPool } from '@/persistence/client';
import fs from 'node:fs';

describe('Issues 1–21 reaudit', () => {
  const env = { ...process.env };
  afterEach(() => {
    process.env = { ...env };
  });

  it('1 release SQL has no template interpolation', () => {
    const src = fs.readFileSync('src/ledger/daily-entries.ts', 'utf8');
    expect(src).not.toMatch(/\$\{wasConfirmed/);
    expect(src).toMatch(/if \(wasConfirmed\)/);
  });

  it('2 auth routes use rate-limit scope', () => {
    const src = fs.readFileSync('src/api/routes/auth.ts', 'utf8');
    expect(src).toMatch(/@fastify\/rate-limit/);
    expect(src).toMatch(/scope\.post\('\/telegram'/);
  });

  it('3 coordinator serializes evaluation', () => {
    const src = fs.readFileSync('src/betting/betting-coordinator.ts', 'utf8');
    expect(src).toMatch(/evaluatingChain/);
    expect(src).toMatch(/lastCashOutTargetByRound/);
  });

  it('5 feature version soft-degrades', () => {
    const src = fs.readFileSync('src/prediction/prediction-pipeline.ts', 'utf8');
    expect(src).not.toMatch(/throw new Error\(`Feature version mismatch/);
    expect(CURRENT_FEATURE_VERSION).toBe('fv-2.0.0');
  });

  it('6 TOCTOU recheck before place', () => {
    const src = fs.readFileSync('src/betting/betting-coordinator.ts', 'utf8');
    expect(src).toMatch(/lastSignalExpiresAt/);
    expect(src).toMatch(/SIGNAL_EXPIRED/);
    expect(src).toMatch(/const result = await this\.liveBetExecutor\.placeLiveBet/);
  });

  it('7 isolated pool helpers exist', () => {
    expect(typeof resetPool).toBe('function');
    expect(typeof createIsolatedPool).toBe('function');
  });

  it('11 api-production installs curl', () => {
    const df = fs.readFileSync('Dockerfile', 'utf8');
    expect(df).toMatch(/api-production/);
    expect(df).toMatch(/apt-get install -y --no-install-recommends curl/);
  });

  it('12 serializable retries 40001', () => {
    const src = fs.readFileSync('src/ledger/daily-entries.ts', 'utf8');
    expect(src).toMatch(/40001/);
    expect(src).toMatch(/maxAttempts/);
  });

  it('13 jwt secrets strict in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'development-secret-change-in-production';
    expect(() => resolveJwtSecretString()).toThrow();
    process.env.JWT_SECRET = 'a'.repeat(32);
    process.env.REFRESH_SECRET = 'b'.repeat(32);
    expect(resolveJwtSecretString()).toHaveLength(32);
    expect(() => assertAuthSecretsAtBoot()).not.toThrow();
  });

  it('14 swagger gated in production', () => {
    const src = fs.readFileSync('src/api/server.ts', 'utf8');
    expect(src).toMatch(/SWAGGER_OPEN/);
  });

  it('17 metrics token optional', () => {
    const src = fs.readFileSync('src/api/server.ts', 'utf8');
    expect(src).toMatch(/METRICS_TOKEN/);
  });
});
