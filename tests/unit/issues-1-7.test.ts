import {
  resolveJwtSecretString,
  resolveRefreshSecretString,
  assertAuthSecretsAtBoot,
} from '@/config/jwt-secret';
import { assertNoMockAdapterInProduction } from '@/betting/adapters/browser';
import { MockBetPlacementAdapter } from '@/betting/adapters/mock';

describe('Issues 1–7', () => {
  const env = { ...process.env };
  afterEach(() => {
    process.env = { ...env };
  });

  it('1: production rejects placeholder JWT secrets', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'development-secret-change-in-production';
    expect(() => resolveJwtSecretString()).toThrow();
    process.env.JWT_SECRET = 'a'.repeat(32);
    process.env.REFRESH_SECRET = 'development-refresh-secret-change-in-production';
    expect(() => resolveRefreshSecretString()).toThrow();
    process.env.REFRESH_SECRET = 'b'.repeat(32);
    expect(resolveJwtSecretString().length).toBe(32);
  });

  it('1: boot assert throws in production without secrets', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.JWT_SECRET;
    delete process.env.REFRESH_SECRET;
    expect(() => assertAuthSecretsAtBoot()).toThrow();
  });

  it('2: mock adapter forbidden in production', () => {
    process.env.NODE_ENV = 'production';
    expect(() => assertNoMockAdapterInProduction(new MockBetPlacementAdapter())).toThrow(
      /MockBetPlacementAdapter/
    );
  });
});
