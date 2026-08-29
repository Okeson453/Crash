import { forwardRef, type InputHTMLAttributes } from 'react';
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className = '', ...props }, ref) { return <input ref={ref} className={`min-h-11 w-full rounded-xl bg-tg-section px-3 text-tg-text outline-none ring-tg-link focus:ring-2 ${className}`} {...props} />; });
