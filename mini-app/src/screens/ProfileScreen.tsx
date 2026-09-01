/**
 * Profile — account + Telegram identity (User/Tenant Mini App spec).
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getCurrentUser, updateUserProfile } from '@/api/users';
import { useAuthStore } from '@/stores/authStore';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { LoadingSpinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { useUIStore } from '@/stores/uiStore';
import { useState } from 'react';
import { User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function ProfileScreen() {
  const navigate = useNavigate();
  const authUser = useAuthStore((s) => s.user);
  const addToast = useUIStore((s) => s.addToast);
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ['current-user'], queryFn: getCurrentUser });
  const user = query.data ?? authUser;

  const [email, setEmail] = useState('');
  const [timezone, setTimezone] = useState('');

  const mutation = useMutation({
    mutationFn: updateUserProfile,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['current-user'] });
      addToast({ type: 'success', message: 'Profile updated.' });
    },
  });

  if (query.isLoading && !user) return <LoadingSpinner size="lg" />;
  if (!user) {
    return <EmptyState icon={User} title="Profile unavailable" />;
  }

  return (
    <div className="page-container px-4 py-4 space-y-4">
      <Card className="flex items-center gap-3">
        {user.photoUrl ? (
          <img src={user.photoUrl} alt="" className="h-14 w-14 rounded-full object-cover" width={56} height={56} loading="lazy" decoding="async" />
        ) : (
          <div className="h-14 w-14 rounded-full bg-tg-hint/20 flex items-center justify-center text-lg font-bold text-tg-hint">
            {user.firstName?.[0] ?? '?'}
          </div>
        )}
        <div>
          <p className="font-semibold text-tg-text">
            {user.firstName} {user.lastName ?? ''}
          </p>
          <p className="text-xs text-tg-hint">@{user.telegramUsername || 'no-username'}</p>
          <Badge variant={user.status === 'active' ? 'success' : 'warning'}>{user.status}</Badge>
        </div>
      </Card>

      <Card className="space-y-2">
        <p className="text-sm font-semibold text-tg-text">Account</p>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <p className="text-xs text-tg-hint">Role</p>
            <p className="text-tg-text capitalize">{user.role}</p>
          </div>
          <div>
            <p className="text-xs text-tg-hint">Plan</p>
            <p className="text-tg-text">{user.planName ?? 'Free'}</p>
          </div>
          <div>
            <p className="text-xs text-tg-hint">Telegram ID</p>
            <p className="text-tg-text font-mono text-xs">{user.telegramId}</p>
          </div>
          <div>
            <p className="text-xs text-tg-hint">Timezone</p>
            <p className="text-tg-text">{user.timezone}</p>
          </div>
        </div>
      </Card>

      <Card className="space-y-3">
        <p className="text-sm font-semibold text-tg-text">Update profile</p>
        <label className="block text-xs text-tg-hint">
          Email
          <Input
            className="mt-1"
            type="email"
            placeholder={user.email ?? 'you@example.com'}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label className="block text-xs text-tg-hint">
          Timezone
          <Input
            className="mt-1"
            placeholder={user.timezone || 'UTC'}
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
          />
        </label>
        <Button
          loading={mutation.isPending}
          onClick={() =>
            mutation.mutate({
              ...(email ? { email } : {}),
              ...(timezone ? { timezone } : {}),
            })
          }
        >
          Save
        </Button>
      </Card>

      <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" onClick={() => navigate('/wallet')}>
          Wallet
        </Button>
        <Button variant="secondary" onClick={() => navigate('/settings')}>
          Settings
        </Button>
      </div>
    </div>
  );
}
