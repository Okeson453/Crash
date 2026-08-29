import { z } from 'zod';

export const placeBetSchema = z.object({
  amount: z
    .number()
    .positive('Bet amount must be positive')
    .max(1000000, 'Bet amount exceeds maximum'),
  autoCashout: z
    .number()
    .min(1.01, 'Auto-cashout must be at least 1.01x')
    .max(10000, 'Auto-cashout cannot exceed 10000x')
    .nullable()
    .optional(),
});

export const betFiltersSchema = z.object({
  status: z
    .union([
      z.enum(['pending', 'placed', 'active', 'cashed_out', 'lost', 'cancelled', 'failed']),
      z.array(z.enum(['pending', 'placed', 'active', 'cashed_out', 'lost', 'cancelled', 'failed'])),
    ])
    .optional(),
  fromDate: z.string().datetime().optional(),
  toDate: z.string().datetime().optional(),
  minAmount: z.number().optional(),
  maxAmount: z.number().optional(),
});

export type PlaceBetInput = z.infer<typeof placeBetSchema>;
export type BetFiltersInput = z.infer<typeof betFiltersSchema>;
