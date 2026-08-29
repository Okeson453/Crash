import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getAdminConfig, updateAdminConfig } from '@/api/admin';
import { LoadingSpinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Settings } from 'lucide-react';
import { useUIStore } from '@/stores/uiStore';

export function AdminConfigScreen() {
  const client = useQueryClient();
  const addToast = useUIStore((s) => s.addToast);
  const query = useQuery({ queryKey: ['admin-config'], queryFn: getAdminConfig });
  const mutation = useMutation({
    mutationFn: updateAdminConfig,
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['admin-config'] });
      addToast({ type: 'success', message: 'Configuration saved.' });
    },
  });

  if (query.isLoading) return <LoadingSpinner size="lg" />;
  if (!query.data) return <EmptyState icon={Settings} title="Configuration unavailable" />;

  const config = query.data;

  return (
    <div className="space-y-4">
      <Card className="space-y-3">
        <p className="font-semibold text-tg-text">Execution configuration</p>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs text-tg-hint">Stake per entry</p>
            <p className="font-medium text-tg-text">{config.stakePerEntry}</p>
          </div>
          <div>
            <p className="text-xs text-tg-hint">Cash-out target</p>
            <p className="font-medium text-tg-text">{config.cashOutTarget}x</p>
          </div>
          <div>
            <p className="text-xs text-tg-hint">Max daily entries</p>
            <p className="font-medium text-tg-text">{config.maxDailyEntries}</p>
          </div>
          <div>
            <p className="text-xs text-tg-hint">Mode</p>
            <p className="font-medium text-tg-text capitalize">{config.mode}</p>
          </div>
        </div>
        <Button
          loading={mutation.isPending}
          onClick={() => mutation.mutate({ mode: config.mode })}
        >
          Save current configuration
        </Button>
        {mutation.error && (
          <p role="alert" className="text-sm text-crash-red">
            {mutation.error instanceof Error ? mutation.error.message : 'Save failed'}
          </p>
        )}
      </Card>
    </div>
  );
}
