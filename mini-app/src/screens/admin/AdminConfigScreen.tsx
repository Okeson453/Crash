import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getAdminConfig, updateAdminConfig } from '@/api/admin';
import { ConfigForm } from '@/components/admin/ConfigForm';
import { LoadingSpinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Card } from '@/components/ui/Card';
import { Settings } from 'lucide-react';
import { useUIStore } from '@/stores/uiStore';
import type { AdminConfig } from '@/types/api';

export function AdminConfigScreen() {
  const client = useQueryClient();
  const addToast = useUIStore((s) => s.addToast);
  const query = useQuery({ queryKey: ['admin-config'], queryFn: getAdminConfig });
  const mutation = useMutation({
    mutationFn: (data: AdminConfig) => updateAdminConfig(data),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['admin-config'] });
      addToast({ type: 'success', message: 'Configuration saved.' });
    },
  });

  if (query.isLoading) return <LoadingSpinner size="lg" />;
  if (!query.data) return <EmptyState icon={Settings} title="Configuration unavailable" />;

  return (
    <div className="space-y-4">
      <Card className="space-y-3">
        <p className="font-semibold text-tg-text">Execution configuration</p>
        <ConfigForm
          config={query.data}
          isLoading={mutation.isPending}
          onSubmit={(data) => mutation.mutate(data)}
        />
        {mutation.error && (
          <p role="alert" className="text-sm text-crash-red">
            {mutation.error instanceof Error ? mutation.error.message : 'Save failed'}
          </p>
        )}
      </Card>
    </div>
  );
}
