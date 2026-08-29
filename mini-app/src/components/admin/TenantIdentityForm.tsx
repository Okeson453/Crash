import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { updateTenantIdentity } from '@/api/admin';
import { tenantIdentitySchema } from '@/schemas/admin';
import { useUIStore } from '@/stores/uiStore';
import type { TenantIdentity } from '@/types/api';
import { z } from 'zod';

type FormValues = z.infer<typeof tenantIdentitySchema>;

export function TenantIdentityForm({ identity }: { identity: TenantIdentity }) {
  const qc = useQueryClient();
  const addToast = useUIStore((s) => s.addToast);
  const form = useForm<FormValues>({
    defaultValues: identity,
    resolver: zodResolver(tenantIdentitySchema),
  });
  const mutation = useMutation({
    mutationFn: updateTenantIdentity,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin-tenant'] });
      addToast({ type: 'success', message: 'Identity saved.' });
    },
  });

  return (
    <Card className="space-y-3">
      <p className="text-sm font-semibold text-tg-text">Identity</p>
      <form onSubmit={form.handleSubmit((d) => mutation.mutate({ ...d, description: d.description ?? "" }))} className="space-y-3">
        <div>
          <Label htmlFor="displayName">Display name</Label>
          <Input id="displayName" {...form.register('displayName')} />
        </div>
        <div>
          <Label htmlFor="slug">Slug</Label>
          <Input id="slug" {...form.register('slug')} />
        </div>
        <div>
          <Label htmlFor="description">Description</Label>
          <Input id="description" {...form.register('description')} />
        </div>
        <Button type="submit" loading={mutation.isPending} className="w-full">
          Save identity
        </Button>
      </form>
    </Card>
  );
}
