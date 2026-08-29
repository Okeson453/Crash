import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { updateTenantBranding } from '@/api/admin';
import { tenantBrandingSchema } from '@/schemas/admin';
import { useUIStore } from '@/stores/uiStore';
import type { TenantBranding } from '@/types/api';
import { z } from 'zod';

type FormValues = z.infer<typeof tenantBrandingSchema>;

export function TenantBrandingForm({ branding }: { branding: TenantBranding }) {
  const qc = useQueryClient();
  const addToast = useUIStore((s) => s.addToast);
  const form = useForm<FormValues>({
    defaultValues: branding,
    resolver: zodResolver(tenantBrandingSchema),
  });
  const mutation = useMutation({
    mutationFn: updateTenantBranding,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin-tenant'] });
      addToast({ type: 'success', message: 'Branding saved.' });
    },
    onError: (err) => {
      addToast({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to save branding',
      });
    },
  });

  return (
    <Card className="space-y-3">
      <p className="text-sm font-semibold text-tg-text">Branding</p>
      <form onSubmit={form.handleSubmit((d) => mutation.mutate(d))} className="space-y-3">
        <div>
          <Label htmlFor="logoUrl">Logo URL</Label>
          <Input id="logoUrl" {...form.register('logoUrl')} />
        </div>
        <div>
          <Label htmlFor="primaryColor">Primary color</Label>
          <Input id="primaryColor" {...form.register('primaryColor')} placeholder="#2481cc" />
        </div>
        <div>
          <Label htmlFor="accentColor">Accent color</Label>
          <Input id="accentColor" {...form.register('accentColor')} placeholder="#31b545" />
        </div>
        <Button type="submit" loading={mutation.isPending} className="w-full" disabled={mutation.isPending}>
          Save branding
        </Button>
      </form>
    </Card>
  );
}
