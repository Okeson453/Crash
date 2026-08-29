import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { updateTenantLimits } from '@/api/admin';
import { tenantLimitsSchema } from '@/schemas/admin';
import { useUIStore } from '@/stores/uiStore';
import type { TenantLimits } from '@/types/api';
import { z } from 'zod';

type FormValues = z.infer<typeof tenantLimitsSchema>;

export function TenantLimitsForm({ limits }: { limits: TenantLimits }) {
  const qc = useQueryClient();
  const addToast = useUIStore((s) => s.addToast);
  const form = useForm<FormValues>({
    defaultValues: limits,
    resolver: zodResolver(tenantLimitsSchema),
  });
  const mutation = useMutation({
    mutationFn: updateTenantLimits,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin-tenant'] });
      addToast({ type: 'success', message: 'Limits saved.' });
    },
    onError: (err) => {
      addToast({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to save limits',
      });
    },
  });

  return (
    <Card className="space-y-3">
      <p className="text-sm font-semibold text-tg-text">Limits</p>
      <form
        onSubmit={form.handleSubmit((d) =>
          mutation.mutate({
            currency: d.currency,
            minBet: Number(d.minBet),
            maxBet: Number(d.maxBet),
            maxDailyWager: Number(d.maxDailyWager),
          })
        )}
        className="space-y-3"
      >
        <div>
          <Label htmlFor="currency">Currency</Label>
          <Input id="currency" {...form.register('currency')} />
        </div>
        <div>
          <Label htmlFor="minBet">Min bet</Label>
          <Input id="minBet" type="number" step="any" {...form.register('minBet', { valueAsNumber: true })} />
        </div>
        <div>
          <Label htmlFor="maxBet">Max bet</Label>
          <Input id="maxBet" type="number" step="any" {...form.register('maxBet', { valueAsNumber: true })} />
        </div>
        <div>
          <Label htmlFor="maxDailyWager">Max daily wager</Label>
          <Input id="maxDailyWager" type="number" step="any" {...form.register('maxDailyWager', { valueAsNumber: true })} />
        </div>
        <Button type="submit" loading={mutation.isPending} className="w-full" disabled={mutation.isPending}>
          Save limits
        </Button>
      </form>
    </Card>
  );
}
