import { describe, expect, it } from 'vitest';
import { isValidBetAmount, isValidAutoCashout, sanitizeNumberInput } from '@/utils/validation';

describe('validation', () => {
  it('accepts amounts within range', () => {
    expect(isValidBetAmount(10, 1, 100).valid).toBe(true);
  });
  it('rejects below min', () => {
    expect(isValidBetAmount(0.5, 1, 100).valid).toBe(false);
  });
  it('rejects above max', () => {
    expect(isValidBetAmount(101, 1, 100).valid).toBe(false);
  });
  it('validates auto-cashout', () => {
    expect(isValidAutoCashout(1.5).valid).toBe(true);
    expect(isValidAutoCashout(1).valid).toBe(false);
  });
  it('sanitizes numeric input', () => {
    expect(sanitizeNumberInput('12.3abc')).toMatch(/12/);
  });
});
