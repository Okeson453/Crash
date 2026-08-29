import { z } from 'zod';

export const userPreferencesSchema = z.object({
  defaultBetAmount: z.number().min(0).default(10),
  defaultAutoCashout: z.number().min(1.01).max(10000).nullable().default(null),
  soundEnabled: z.boolean().default(false),
  hapticEnabled: z.boolean().default(true),
  animationsEnabled: z.boolean().default(true),
  theme: z.enum(['system', 'light', 'dark']).default('system'),
  language: z.string().default('en'),
  notificationsEnabled: z.boolean().default(true),
});

export type UserPreferencesInput = z.infer<typeof userPreferencesSchema>;
