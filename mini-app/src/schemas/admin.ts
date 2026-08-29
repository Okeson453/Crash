import { z } from 'zod';

export const adminConfigSchema = z.object({
  stakePerEntry: z.number().positive().default(700),
  cashOutTarget: z.number().positive().default(1.3),
  maxDailyEntries: z.number().int().positive().max(1000).default(100),
  mode: z.enum(['observe-only', 'dry-run', 'live', 'maintenance']).default('dry-run'),
});

export type AdminConfigInput = z.infer<typeof adminConfigSchema>;

export const tenantIdentitySchema = z.object({
  displayName: z.string().min(1).max(100),
  slug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/),
  description: z.string().max(500).optional(),
});

export const tenantBrandingSchema = z.object({
  logoUrl: z.string().url().max(500).or(z.literal('')),
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  accentColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
});

export const tenantLimitsSchema = z.object({
  currency: z.string().min(3).max(3),
  minBet: z.number().min(0).max(1000000),
  maxBet: z.number().min(0).max(10000000),
  maxDailyWager: z.number().min(0).max(100000000),
});

export const rgSettingsSchema = z.object({
  betCooldownMinutes: z.number().min(0).max(1440),
  maxLossPerDay: z.number().min(0).max(10000000),
  maxSessionHours: z.number().min(0).max(24),
});

export const webhookEndpointsSchema = z.object({
  betEvents: z.string().url().max(500).or(z.literal('')),
  roundEvents: z.string().url().max(500).or(z.literal('')),
  userEvents: z.string().url().max(500).or(z.literal('')),
});
