import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getFeatureFlags, setFeatureFlagEnabled, type FeatureFlag } from '@/api/admin';
import { LoadingSpinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ToggleLeft } from 'lucide-react';
import { useUIStore } from '@/stores/uiStore';

export function AdminFeatureFlagsScreen() {
  const qc = useQueryClient();
  const addToast = useUIStore((s) => s.addToast);
  const query = useQuery({ queryKey: ['admin-feature-flags'], queryFn: getFeatureFlags });
  const toggle = useMutation({
    mutationFn: ({ key, enabled }: { key: string; enabled: boolean }) =>
      setFeatureFlagEnabled(key, enabled),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin-feature-flags'] });
      addToast({ type: 'success', message: 'Feature flag updated.' });
    },
  });

  if (query.isLoading) return <LoadingSpinner size="lg" />;
  const rows = query.data ?? [];
  if (!rows.length) {
    return <EmptyState icon={ToggleLeft} title="No feature flags" />;
  }

  return (
    <div className="space-y-2">
      {rows.map((f: FeatureFlag) => (
        <Card key={f.key} className="space-y-2">
          <div className="flex justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-tg-text truncate">{f.key}</p>
              <p className="text-xs text-tg-hint">{f.description}</p>
            </div>
            <Badge variant={f.enabled ? 'success' : 'neutral'}>{f.enabled ? 'On' : 'Off'}</Badge>
          </div>
          <p className="text-xs text-tg-hint">
            Scope: {f.scope}
            {f.updatedAt ? ` · Updated ${new Date(f.updatedAt).toLocaleString()}` : ''}
          </p>
          <Button
            variant="secondary"
            className="w-full"
            loading={toggle.isPending}
            onClick={() => toggle.mutate({ key: f.key, enabled: !f.enabled })}
          >
            {f.enabled ? 'Disable' : 'Enable'}
          </Button>
        </Card>
      ))}
    </div>
  );
}
