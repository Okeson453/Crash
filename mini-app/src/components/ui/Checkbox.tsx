import { forwardRef, type InputHTMLAttributes } from 'react';
export const Checkbox = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Checkbox({ className = '', ...props }, ref) { return <input ref={ref} type="checkbox" className={`h-5 w-5 accent-tg-button ${className}`} {...props} />; });
