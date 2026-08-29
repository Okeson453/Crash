/**
 * Durable platform admin settings (tenant / RG / webhooks).
 */
import { getPool } from '@/persistence/client';

export async function loadAdminSetting<T>(key: string, fallback: T): Promise<T> {
  const pool = getPool();
  try {
    const result = await pool.query(
      `SELECT value FROM platform_admin_settings WHERE key = $1`,
      [key]
    );
    if (!result.rows[0]?.value) return fallback;
    return { ...fallback, ...(result.rows[0].value as object) } as T;
  } catch {
    return fallback;
  }
}

export async function saveAdminSetting(
  key: string,
  value: unknown,
  updatedBy?: string
): Promise<void> {
  const pool = getPool();
  try {
    await pool.query(
      `INSERT INTO platform_admin_settings (key, value, updated_at, updated_by)
       VALUES ($1, $2::jsonb, NOW(), $3)
       ON CONFLICT (key) DO UPDATE SET
         value = EXCLUDED.value,
         updated_at = NOW(),
         updated_by = EXCLUDED.updated_by`,
      [key, JSON.stringify(value), updatedBy ?? null]
    );
  } catch {
    /* migration may not be applied yet — swallow so API still works in-memory */
  }
}
