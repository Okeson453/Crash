import { api } from './client';
import type {
  AdminSessionState,
  AdminConfig,
  AuditLogEntry,
  PaginatedResponse,
  User,
} from '@/types/api';

export async function getAdminSessionState(): Promise<AdminSessionState> {
  return api.get<AdminSessionState>('/api/v1/admin/session');
}

export async function startGameSession(): Promise<AdminSessionState> {
  return api.post<AdminSessionState>('/api/v1/admin/game/start');
}

export async function pauseGameSession(): Promise<AdminSessionState> {
  return api.post<AdminSessionState>('/api/v1/admin/game/pause');
}

export async function resumeGameSession(): Promise<AdminSessionState> {
  return api.post<AdminSessionState>('/api/v1/admin/game/resume');
}

export async function stopGameSession(): Promise<AdminSessionState> {
  return api.post<AdminSessionState>('/api/v1/admin/game/stop');
}

export async function emergencyStop(): Promise<AdminSessionState> {
  return api.post<AdminSessionState>('/api/v1/admin/game/emergency-stop');
}

export async function getAdminConfig(): Promise<AdminConfig> {
  return api.get<AdminConfig>('/api/v1/admin/config');
}

export async function updateAdminConfig(config: Partial<AdminConfig>): Promise<AdminConfig> {
  return api.put<AdminConfig>('/api/v1/admin/config', config);
}

export async function getAdminUsers(
  cursor?: string
): Promise<PaginatedResponse<User>> {
  const params = cursor ? `?cursor=${cursor}` : '';
  return api.get<PaginatedResponse<User>>(`/api/v1/admin/users${params}`);
}

export async function getAuditLogs(
  cursor?: string
): Promise<PaginatedResponse<AuditLogEntry>> {
  const params = cursor ? `?cursor=${cursor}` : '';
  return api.get<PaginatedResponse<AuditLogEntry>>(`/api/v1/admin/audit${params}`);
}
