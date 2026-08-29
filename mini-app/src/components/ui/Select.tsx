import { forwardRef, type SelectHTMLAttributes } from 'react';
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className = '', ...props }, ref) { return <select ref={ref} className={`min-h-11 rounded-xl bg-tg-section px-3 text-tg-text ${className}`} {...props} />; });
