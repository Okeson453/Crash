/**
 * Durable in-app notifications for Mini App users.
 */
import { getPool } from '@/persistence/client';

export type NotificationCategory =
  | 'bets'
  | 'cashout'
  | 'balance'
  | 'subscription'
  | 'referral'
  | 'system';

export interface UserNotification {
  id: string;
  category: NotificationCategory;
  title: string;
  body: string;
  data: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
}

export async function createUserNotification(params: {
  userId: string;
  category: NotificationCategory;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}): Promise<UserNotification | null> {
  const pool = getPool();
  try {
    const result = await pool.query(
      `INSERT INTO user_notifications (user_id, category, title, body, data)
       VALUES ($1, $2, $3, $4, $5::jsonb)
       RETURNING id, category, title, body, data, read_at, created_at`,
      [
        params.userId,
        params.category,
        params.title,
        params.body,
        JSON.stringify(params.data ?? {}),
      ]
    );
    const row = result.rows[0];
    if (!row) return null;
    return mapRow(row);
  } catch {
    return null;
  }
}

export async function listUserNotifications(
  userId: string,
  opts?: { unreadOnly?: boolean; limit?: number }
): Promise<UserNotification[]> {
  const pool = getPool();
  const limit = opts?.limit ?? 50;
  try {
    const result = await pool.query(
      `SELECT id, category, title, body, data, read_at, created_at
       FROM user_notifications
       WHERE user_id = $1
         ${opts?.unreadOnly ? 'AND read_at IS NULL' : ''}
       ORDER BY created_at DESC
       LIMIT $2`,
      [userId, limit]
    );
    return result.rows.map(mapRow);
  } catch {
    return [];
  }
}

export async function markNotificationRead(
  userId: string,
  notificationId: string
): Promise<boolean> {
  const pool = getPool();
  try {
    const result = await pool.query(
      `UPDATE user_notifications
       SET read_at = COALESCE(read_at, NOW())
       WHERE id = $1 AND user_id = $2
       RETURNING id`,
      [notificationId, userId]
    );
    return (result.rowCount ?? 0) > 0;
  } catch {
    return false;
  }
}

export async function markAllNotificationsRead(userId: string): Promise<number> {
  const pool = getPool();
  try {
    const result = await pool.query(
      `UPDATE user_notifications
       SET read_at = NOW()
       WHERE user_id = $1 AND read_at IS NULL
       RETURNING id`,
      [userId]
    );
    return result.rowCount ?? 0;
  } catch {
    return 0;
  }
}

function mapRow(row: Record<string, unknown>): UserNotification {
  return {
    id: String(row.id),
    category: String(row.category) as NotificationCategory,
    title: String(row.title),
    body: String(row.body),
    data: (row.data as Record<string, unknown>) ?? {},
    readAt: row.read_at ? new Date(row.read_at as string | Date).toISOString() : null,
    createdAt: new Date(row.created_at as string | Date).toISOString(),
  };
}
