import type { Notification } from '@/stores/uiStore';
export function NotificationItem({ notification }: { notification: Notification }) { return <div className="rounded-xl bg-tg-section p-3"><p className="text-sm font-semibold text-tg-text">{notification.title}</p><p className="text-xs text-tg-hint">{notification.body}</p></div>; }
