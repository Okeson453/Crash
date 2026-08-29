import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { LoadingSpinner } from './Spinner';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive';
type ButtonSize = 'sm' | 'md' | 'lg';
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> { variant?: ButtonVariant; size?: ButtonSize; loading?: boolean; }
const variants: Record<ButtonVariant, string> = { primary: 'btn-primary', secondary: 'btn-secondary', ghost: 'bg-transparent text-tg-text', destructive: 'btn-destructive' };
const sizes: Record<ButtonSize, string> = { sm: 'min-h-11 px-3 text-sm', md: 'min-h-11 px-4 text-sm', lg: 'min-h-12 px-5 text-base' };
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button({ variant = 'primary', size = 'md', loading = false, disabled, children, className = '', ...props }, ref) {
  return <button ref={ref} disabled={disabled || loading} aria-busy={loading || undefined} className={`rounded-xl font-semibold transition-opacity disabled:opacity-50 disabled:pointer-events-none ${variants[variant]} ${sizes[size]} ${className}`} {...props}>{loading ? <span className="inline-flex items-center gap-2"><LoadingSpinner size="sm" />Loading…</span> : children}</button>;
});
