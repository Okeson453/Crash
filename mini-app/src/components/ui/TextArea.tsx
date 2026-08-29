import { forwardRef, type TextareaHTMLAttributes } from 'react';
export const TextArea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function TextArea({ className = '', ...props }, ref) { return <textarea ref={ref} className={`min-h-24 w-full rounded-xl bg-tg-section p-3 text-tg-text outline-none ring-tg-link focus:ring-2 ${className}`} {...props} />; });
