import { resolveJwtSecretString } from '@/config/jwt-secret';
import { CURRENT_FEATURE_VERSION } from '@/prediction/features/feature-meta';

describe('Issues P0–P3 smoke', () => {
  it('13 jwt production rejects placeholders', () => {
    const env = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'development-secret-change-in-production';
    expect(() => resolveJwtSecretString()).toThrow();
    process.env.JWT_SECRET = 'z'.repeat(32);
    expect(resolveJwtSecretString()).toHaveLength(32);
    process.env.NODE_ENV = env;
  });

  it('5 feature version constant stable', () => {
    expect(CURRENT_FEATURE_VERSION).toBe('fv-2.0.0');
  });
});
