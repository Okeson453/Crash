import { z } from 'zod';

export const telegramAuthSchema = z.object({
  initData: z.string().min(1, 'Telegram initData is required'),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export type TelegramAuthInput = z.infer<typeof telegramAuthSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
