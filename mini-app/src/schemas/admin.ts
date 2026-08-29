import { z } from 'zod';

export const adminConfigSchema = z.object({
  stakePerEntry: z.number().positive().default(700),
  cashOutTarget: z.number().positive().default(1.3),
  maxDailyEntries: z.number().int().positive().max(1000).default(100),
  mode: z.enum(['observe-only', 'dry-run', 'live', 'maintenance']).default('dry-run'),
});

export type AdminConfigInput = z.infer<typeof adminConfigSchema>;
