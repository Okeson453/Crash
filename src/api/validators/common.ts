import { z } from 'zod';

export const paginationSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
});

export const idParamSchema = z.object({
  id: z.string().uuid(),
});

export const periodQuerySchema = z.object({
  period: z.enum(['day', 'week', 'month']).default('day'),
});
