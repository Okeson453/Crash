/** Telegram Mini App initData validation. */
import { createHmac, timingSafeEqual } from 'node:crypto';
export interface TelegramUser { id: number; first_name: string; last_name?: string; username?: string; language_code?: string; is_premium?: boolean; added_to_attachment_menu?: boolean; allows_write_to_pm?: boolean; photo_url?: string; }
export interface ParsedInitData { valid: boolean; user?: TelegramUser; authDate?: number; hash?: string; startParam?: string; }
const MAX_AUTH_AGE_SEC = 24 * 60 * 60;
export function verifyTelegramInitData(initData: string): ParsedInitData {
  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken || !initData) return { valid: false };
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash || !/^[a-f0-9]{64}$/i.test(hash)) return { valid: false };
    const authDate = Number(params.get('auth_date'));
    const now = Math.floor(Date.now() / 1000);
    if (!Number.isInteger(authDate) || authDate <= 0 || now - authDate > MAX_AUTH_AGE_SEC || authDate - now > 60) return { valid: false };
    params.delete('hash');
    const dataCheckString = [...params.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => `${key}=${value}`).join('\n');
    const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest();
    const calculated = createHmac('sha256', secretKey).update(dataCheckString).digest();
    const provided = Buffer.from(hash, 'hex');
    if (provided.length !== calculated.length || !timingSafeEqual(calculated, provided)) return { valid: false };
    const rawUser = params.get('user');
    if (!rawUser) return { valid: false, authDate, hash };
    const parsed: unknown = JSON.parse(rawUser);
    if (typeof parsed !== 'object' || parsed === null || !('id' in parsed) || !('first_name' in parsed)) return { valid: false };
    const userRecord = parsed as Record<string, unknown>;
    if (typeof userRecord.id !== 'number' || typeof userRecord.first_name !== 'string') return { valid: false };
    const user: TelegramUser = { id: userRecord.id, first_name: userRecord.first_name };
    if (typeof userRecord.last_name === 'string') user.last_name = userRecord.last_name;
    if (typeof userRecord.username === 'string') user.username = userRecord.username;
    if (typeof userRecord.language_code === 'string') user.language_code = userRecord.language_code;
    if (typeof userRecord.photo_url === 'string') user.photo_url = userRecord.photo_url;
    return { valid: true, user, authDate, hash, startParam: params.get('start_param') ?? undefined };
  } catch { return { valid: false }; }
}
export function parseInitData(initData: string): ParsedInitData {
  try { const params = new URLSearchParams(initData); return { valid: true, authDate: Number(params.get('auth_date')) || undefined, hash: params.get('hash') || undefined }; } catch { return { valid: false }; }
}
