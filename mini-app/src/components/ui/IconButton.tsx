import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> { label: string; children: ReactNode; }
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton({ label, children, className = '', ...props }, ref) { return <button ref={ref} aria-label={label} className={`min-h-11 min-w-11 inline-flex items-center justify-center rounded-xl text-tg-text hover:bg-tg-section disabled:opacity-50 ${className}`} {...props}>{children}</button>; });
