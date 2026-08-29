import { useUIStore } from '@/stores/uiStore';
export function NotificationBadge() { const unread = useUIStore((s) => s.unreadCount); return unread > 0 ? <span className="rounded-full bg-crash-red px-1.5 text-[10px] font-bold text-white">{unread}</span> : null; }
