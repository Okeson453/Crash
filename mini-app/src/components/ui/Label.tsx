import type { LabelHTMLAttributes } from 'react';

export function Label({ className = '', ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label className={`block text-xs font-medium text-tg-hint mb-1 ${className}`} {...props} />
  );
}
