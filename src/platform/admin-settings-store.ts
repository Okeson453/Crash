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


export async function saveConfigVersion(
  key: string,
  value: unknown,
  actorId?: string
): Promise<number> {
  const pool = getPool();
  try {
    const ver = await pool.query(
      `SELECT COALESCE(MAX(version), 0) + 1 AS next FROM config_versions WHERE key = $1`,
      [key]
    );
    const version = Number(ver.rows[0]?.next ?? 1);
    await pool.query(
      `INSERT INTO config_versions (key, payload, version, actor_id)
       VALUES ($1, $2::jsonb, $3, $4)`,
      [key, JSON.stringify(value), version, actorId ?? null]
    );
    return version;
  } catch {
    return 0;
  }
}

export async function listConfigVersions(
  key: string,
  limit = 20
): Promise<Array<{ version: number; payload: unknown; createdAt: string; actorId: string | null }>> {
  const pool = getPool();
  try {
    const r = await pool.query(
      `SELECT version, payload, created_at, actor_id FROM config_versions
       WHERE key = $1 ORDER BY version DESC LIMIT $2`,
      [key, limit]
    );
    return r.rows.map((row) => ({
      version: Number(row.version),
      payload: row.payload,
      createdAt: new Date(row.created_at).toISOString(),
      actorId: row.actor_id ? String(row.actor_id) : null,
    }));
  } catch {
    return [];
  }
}
