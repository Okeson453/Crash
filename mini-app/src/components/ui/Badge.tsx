import type { ReactNode } from 'react';
type BadgeVariant = 'success' | 'warning' | 'danger' | 'neutral' | 'info';
const styles: Record<BadgeVariant, string> = { success: 'bg-crash-green/10 text-crash-green', warning: 'bg-crash-yellow/10 text-crash-yellow', danger: 'bg-crash-red/10 text-crash-red', neutral: 'bg-tg-hint/10 text-tg-hint', info: 'bg-tg-link/10 text-tg-link' };
export function Badge({ children, variant = 'neutral' }: { children: ReactNode; variant?: BadgeVariant }) { return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${styles[variant]}`}>{children}</span>; }
