import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { updateComplianceSettings } from '@/api/admin';
import { rgSettingsSchema } from '@/schemas/admin';
import { useUIStore } from '@/stores/uiStore';
import type { RgSettings } from '@/types/api';
import { z } from 'zod';
import { Shield } from 'lucide-react';

type FormValues = z.infer<typeof rgSettingsSchema>;

export function RgSettingsForm({ settings }: { settings: RgSettings }) {
  const qc = useQueryClient();
  const addToast = useUIStore((s) => s.addToast);
  const form = useForm<FormValues>({
    defaultValues: settings,
    resolver: zodResolver(rgSettingsSchema),
  });
  const mutation = useMutation({
    mutationFn: updateComplianceSettings,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin-compliance-rg'] });
      addToast({ type: 'success', message: 'RG settings saved.' });
    },
  });

  return (
    <Card className="space-y-3">
      <div className="flex items-center gap-2">
        <Shield className="h-4 w-4 text-tg-link" />
        <p className="text-sm font-semibold text-tg-text">Responsible gaming</p>
      </div>
      <form
        onSubmit={form.handleSubmit((d) => mutation.mutate(d))}
        className="space-y-3"
      >
        <div>
          <Label htmlFor="betCooldownMinutes">Bet cooldown (minutes)</Label>
          <Input
            id="betCooldownMinutes"
            type="number"
            {...form.register('betCooldownMinutes', { valueAsNumber: true })}
          />
        </div>
        <div>
          <Label htmlFor="maxLossPerDay">Max loss / day</Label>
          <Input
            id="maxLossPerDay"
            type="number"
            {...form.register('maxLossPerDay', { valueAsNumber: true })}
          />
        </div>
        <div>
          <Label htmlFor="maxSessionHours">Max session hours</Label>
          <Input
            id="maxSessionHours"
            type="number"
            {...form.register('maxSessionHours', { valueAsNumber: true })}
          />
        </div>
        <Button type="submit" loading={mutation.isPending} className="w-full">
          Save RG settings
        </Button>
      </form>
    </Card>
  );
}
