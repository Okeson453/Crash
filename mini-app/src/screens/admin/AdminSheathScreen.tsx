import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSheathStatus, recoverSheath } from '@/api/admin';
import { AlertTriangle, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { LoadingSpinner } from '@/components/ui/Spinner';
import { useUIStore } from '@/stores/uiStore';

export function AdminSheathScreen() {
  const qc = useQueryClient();
  const addToast = useUIStore((s) => s.addToast);
  const status = useQuery({
    queryKey: ['admin-sheath-status'],
    queryFn: getSheathStatus,
    refetchInterval: 5000,
  });
  const mutation = useMutation({
    mutationFn: recoverSheath,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin-sheath-status'] });
      addToast({ type: 'success', message: 'Sheath recovery confirmed — betting may resume.' });
    },
    onError: (err: unknown) => {
      addToast({
        type: 'error',
        message: err instanceof Error ? err.message : 'Recovery failed',
      });
    },
  });

  if (status.isLoading) return <LoadingSpinner size="lg" />;

  const level = status.data?.level ?? 0;
  const halted = status.data?.manualRecoveryRequired ?? false;
  const badgeVariant = halted ? 'danger' : level > 0 ? 'warning' : 'success';

  return (
    <div className="space-y-4">
      <Card className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-tg-text">Divergence sheath</p>
          <Badge variant={badgeVariant}>Level {level}</Badge>
        </div>
        {status.data?.lastReason && (
          <p className="text-xs text-tg-hint">Last reason: {status.data.lastReason}</p>
        )}
        {typeof status.data?.windowSize === 'number' && (
          <p className="text-xs text-tg-hint">Window size: {status.data.windowSize}</p>
        )}
      </Card>

      {halted ? (
        <Card className="space-y-3 border border-crash-red/40">
          <div className="flex items-center gap-2 text-crash-red">
            <AlertTriangle className="h-5 w-5" />
            <p className="text-sm font-semibold">Betting halted — manual recovery required</p>
          </div>
          <p className="text-xs text-tg-hint">
            The prediction engine detected a live/predicted calibration divergence and stopped
            all entries. Confirm you have reviewed the cause before resuming.
          </p>
          <Button
            variant="destructive"
            loading={mutation.isPending}
            onClick={() => {
              if (
                window.confirm(
                  'Clear the halt and resume betting? This cannot be undone automatically.'
                )
              ) {
                mutation.mutate();
              }
            }}
          >
            <span className="inline-flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" />
              Confirm recovery
            </span>
          </Button>
        </Card>
      ) : (
        <Card>
          <p className="text-sm text-tg-hint">No active halt. Betting is not sheath-restricted.</p>
        </Card>
      )}
    </div>
  );
}
