/**
 * Validation utilities
 */

export function isValidBetAmount(amount: unknown, min: number, max: number): {
  valid: boolean;
  error?: string;
} {
  if (amount === null || amount === undefined) {
    return { valid: false, error: 'Amount is required' };
  }

  const num = Number(amount);
  if (Number.isNaN(num)) {
    return { valid: false, error: 'Amount must be a number' };
  }

  if (!Number.isFinite(num)) {
    return { valid: false, error: 'Amount must be finite' };
  }

  if (num <= 0) {
    return { valid: false, error: 'Amount must be positive' };
  }

  if (num < min) {
    return { valid: false, error: `Minimum bet is ${min}` };
  }

  if (num > max) {
    return { valid: false, error: `Maximum bet is ${max}` };
  }

  // Check decimal precision (max 2 decimal places)
  const decimals = (num.toString().split('.')[1] || '').length;
  if (decimals > 2) {
    return { valid: false, error: 'Amount can have at most 2 decimal places' };
  }

  return { valid: true };
}

export function isValidAutoCashout(value: unknown): {
  valid: boolean;
  error?: string;
} {
  if (value === null || value === undefined) {
    return { valid: true }; // null is valid (no auto-cashout)
  }

  const num = Number(value);
  if (Number.isNaN(num)) {
    return { valid: false, error: 'Auto-cashout must be a number' };
  }

  if (!Number.isFinite(num)) {
    return { valid: false, error: 'Auto-cashout must be finite' };
  }

  if (num < 1.01) {
    return { valid: false, error: 'Auto-cashout must be at least 1.01x' };
  }

  if (num > 10000) {
    return { valid: false, error: 'Auto-cashout cannot exceed 10000x' };
  }

  const decimals = (num.toString().split('.')[1] || '').length;
  if (decimals > 2) {
    return { valid: false, error: 'Auto-cashout can have at most 2 decimal places' };
  }

  return { valid: true };
}

export function sanitizeNumberInput(value: string): string {
  // Remove non-numeric characters except decimal point
  let sanitized = value.replace(/[^0-9.]/g, '');
  // Ensure only one decimal point
  const parts = sanitized.split('.');
  if (parts.length > 2) {
    sanitized = parts[0] + '.' + parts.slice(1).join('');
  }
  // Limit to 2 decimal places
  if (parts[1] && parts[1].length > 2) {
    sanitized = parts[0] + '.' + parts[1].slice(0, 2);
  }
  return sanitized;
}
