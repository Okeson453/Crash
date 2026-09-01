import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Dialog } from '@/components/ui/Dialog';
import { updateUserRole, suspendUser, unsuspendUser } from '@/api/admin';
import { useUIStore } from '@/stores/uiStore';
import type { User } from '@/types/api';
import { Shield, Ban, UserCheck } from 'lucide-react';

interface UserDetailSheetProps {
  user: User | null;
  onClose: () => void;
}

export function UserDetailSheet({ user, onClose }: UserDetailSheetProps) {
  const qc = useQueryClient();
  const addToast = useUIStore((s) => s.addToast);
  const [showSuspendConfirm, setShowSuspendConfirm] = useState(false);
  const [showRoleConfirm, setShowRoleConfirm] = useState(false);
  const [pendingRole, setPendingRole] = useState<'player' | 'operator' | 'admin'>('player');

  const suspend = useMutation({
    mutationFn: () => suspendUser(user!.id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin-users'] });
      addToast({ type: 'warning', message: 'User suspended.' });
      setShowSuspendConfirm(false);
      onClose();
    },
  });

  const unsuspend = useMutation({
    mutationFn: () => unsuspendUser(user!.id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin-users'] });
      addToast({ type: 'success', message: 'User unsuspended.' });
      onClose();
    },
  });

  const roleChange = useMutation({
    mutationFn: () => updateUserRole(user!.id, pendingRole),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin-users'] });
      addToast({ type: 'success', message: `Role updated to ${pendingRole}.` });
      setShowRoleConfirm(false);
      onClose();
    },
  });

  if (!user) return null;

  return (
    <>
      <BottomSheet isOpen={!!user} onClose={onClose} title={`@${user.telegramUsername || user.firstName}`}>
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            {user.photoUrl ? (
              <img src={user.photoUrl} alt="" className="h-14 w-14 rounded-full object-cover" width={56} height={56} loading="lazy" decoding="async" />
            ) : (
              <div className="h-14 w-14 rounded-full bg-tg-hint/20 flex items-center justify-center text-lg font-bold text-tg-hint">
                {user.firstName[0]}
                {user.lastName?.[0] ?? ''}
              </div>
            )}
            <div>
              <p className="font-semibold text-tg-text">
                {user.firstName} {user.lastName ?? ''}
              </p>
              <p className="text-xs text-tg-hint">ID: {user.telegramId}</p>
              <Badge
                variant={
                  user.status === 'active'
                    ? 'success'
                    : user.status === 'suspended'
                      ? 'warning'
                      : 'danger'
                }
              >
                {user.status}
              </Badge>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-tg-section p-3">
              <p className="text-xs text-tg-hint">Role</p>
              <p className="text-sm font-medium text-tg-text capitalize">{user.role}</p>
            </div>
            <div className="rounded-xl bg-tg-section p-3">
              <p className="text-xs text-tg-hint">Plan</p>
              <p className="text-sm font-medium text-tg-text">{user.planName ?? 'Free'}</p>
            </div>
            <div className="rounded-xl bg-tg-section p-3">
              <p className="text-xs text-tg-hint">Joined</p>
              <p className="text-sm font-medium text-tg-text">
                {new Date(user.createdAt).toLocaleDateString()}
              </p>
            </div>
            <div className="rounded-xl bg-tg-section p-3">
              <p className="text-xs text-tg-hint">Timezone</p>
              <p className="text-sm font-medium text-tg-text">{user.timezone}</p>
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-xs font-semibold text-tg-hint uppercase tracking-wider">Actions</p>
            {user.status !== 'suspended' && user.status !== 'banned' && (
              <Button variant="secondary" className="w-full" onClick={() => setShowSuspendConfirm(true)}>
                <Ban className="mr-2 h-4 w-4" /> Suspend User
              </Button>
            )}
            {user.status === 'suspended' && (
              <Button className="w-full" onClick={() => unsuspend.mutate()} loading={unsuspend.isPending}>
                <UserCheck className="mr-2 h-4 w-4" /> Unsuspend User
              </Button>
            )}
            <Button
              variant="secondary"
              className="w-full"
              onClick={() => {
                setPendingRole(user.role === 'player' ? 'operator' : 'player');
                setShowRoleConfirm(true);
              }}
            >
              <Shield className="mr-2 h-4 w-4" /> Change Role
            </Button>
          </div>
        </div>
      </BottomSheet>
      <Dialog
        open={showSuspendConfirm}
        title="Suspend User"
        message={`This will suspend @${user.telegramUsername || user.firstName}. They will be unable to place bets or access operator features.`}
        confirmLabel="Suspend"
        onConfirm={() => suspend.mutate()}
        onCancel={() => setShowSuspendConfirm(false)}
      />
      <Dialog
        open={showRoleConfirm}
        title="Change Role"
        message={`Change role to ${pendingRole}? This affects API access immediately.`}
        confirmLabel="Confirm"
        onConfirm={() => roleChange.mutate()}
        onCancel={() => setShowRoleConfirm(false)}
      />
    </>
  );
}
