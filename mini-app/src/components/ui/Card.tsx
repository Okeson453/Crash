import { forwardRef, type HTMLAttributes } from 'react';
export const Card = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(function Card({ className = '', ...props }, ref) { return <div ref={ref} className={`card ${className}`} {...props} />; });
