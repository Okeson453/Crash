import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { MoreVertical } from 'lucide-react';
import type { User } from '@/types/api';

interface UserListItemProps {
  user: User;
  onClick: () => void;
}

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'neutral'> = {
  active: 'success',
  suspended: 'warning',
  banned: 'danger',
  onboarding: 'info',
  cancelled: 'neutral',
};

export function UserListItem({ user, onClick }: UserListItemProps) {
  return (
    <Card
      className="flex items-center gap-3 cursor-pointer active:scale-[0.99] transition-transform"
      onClick={onClick}
    >
      {user.photoUrl ? (
        <img
          src={user.photoUrl}
          alt=""
          className="h-10 w-10 rounded-full object-cover"
          loading="lazy"
        />
      ) : (
        <div className="h-10 w-10 rounded-full bg-tg-hint/20 flex items-center justify-center text-sm font-bold text-tg-hint">
          {user.firstName[0]}
          {user.lastName?.[0] ?? ''}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-tg-text truncate">
          {user.firstName} {user.lastName ?? ''}
        </p>
        <p className="text-xs text-tg-hint truncate">
          @{user.telegramUsername || 'no-username'} · {user.role}
        </p>
      </div>
      <Badge variant={STATUS_VARIANT[user.status] ?? 'neutral'}>{user.status}</Badge>
      <MoreVertical className="h-4 w-4 text-tg-hint shrink-0" />
    </Card>
  );
}
