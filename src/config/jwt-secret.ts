/**
 * JWT / refresh secrets — uses secret-files resolution, no prod placeholders.
 */
import { resolveSecret } from './secret-files.js';

const MIN_SECRET_LENGTH = 32;

function isPlaceholder(v: string): boolean {
  return /change-in-production|development-secret|development-refresh|dev-only-fallback/i.test(v);
}

function getSecretString(name: string): string {
  if (process.env.NODE_ENV === 'test') {
    const v = resolveSecret(name) || process.env[name]?.trim();
    return (
      v ||
      (name === 'REFRESH_SECRET'
        ? 'test-refresh-secret-for-unit-tests-only-32c'
        : 'test-jwt-secret-for-unit-tests-only-32chars')
    );
  }

  const value = resolveSecret(name) || process.env[name]?.trim();
  if (!value || value.length < MIN_SECRET_LENGTH || isPlaceholder(value)) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        `${name} must be at least ${MIN_SECRET_LENGTH} characters in production. ` +
          `Set ${name} or ${name}_FILE (no development placeholders).`
      );
    }
    // eslint-disable-next-line no-console
    console.warn(`[jwt-secret] Warning: ${name} missing/short — using dev fallback`);
    return 'dev-only-fallback-secret-32chars-long!';
  }
  return value;
}

export function resolveJwtSecretString(): string {
  return getSecretString('JWT_SECRET');
}

export function resolveJwtSecretBytes(): Uint8Array {
  return new TextEncoder().encode(resolveJwtSecretString());
}

export function resolveRefreshSecretString(): string {
  return getSecretString('REFRESH_SECRET');
}

export function resolveRefreshSecretBytes(): Uint8Array {
  return new TextEncoder().encode(resolveRefreshSecretString());
}

export function assertAuthSecretsAtBoot(): void {
  if (process.env.NODE_ENV === 'production') {
    resolveJwtSecretBytes();
    resolveRefreshSecretBytes();
  }
}
