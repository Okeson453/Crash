import { api } from './client';
import type {
  AdminSessionState,
  AdminConfig,
  AdminOverview,
  AuditLogEntry,
  PaginatedResponse,
  User,
  TenantSettings,
  Subscription,
  UsageMetrics,
  Invoice,
  RgSettings,
  SelfExclusion,
  KycOverview,
  TelegramBotStatus,
  WebhookEndpoints,
  ConnectedService,
  ReferralAdminOverview,
  TenantLimits,
  TenantBranding,
  TenantIdentity,
  AdminActivity,
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

interface UserListParams {
  cursor?: string;
  search?: string;
  status?: string;
  limit?: number;
}

export async function getAdminUsers(
  params?: string | UserListParams
): Promise<PaginatedResponse<User>> {
  if (typeof params === 'string' || params === undefined) {
    const q = params ? `?cursor=${params}` : '';
    return api.get<PaginatedResponse<User>>(`/api/v1/admin/users${q}`);
  }
  const qs = new URLSearchParams();
  if (params.cursor) qs.set('cursor', params.cursor);
  if (params.search) qs.set('search', params.search);
  if (params.status) qs.set('status', params.status);
  if (params.limit) qs.set('limit', String(params.limit));
  const query = qs.toString();
  return api.get<PaginatedResponse<User>>(`/api/v1/admin/users${query ? `?${query}` : ''}`);
}

export async function getAuditLogs(
  cursor?: string
): Promise<PaginatedResponse<AuditLogEntry>> {
  const params = cursor ? `?cursor=${cursor}` : '';
  return api.get<PaginatedResponse<AuditLogEntry>>(`/api/v1/admin/audit${params}`);
}

export async function getAdminOverview(): Promise<AdminOverview> {
  return api.get<AdminOverview>('/api/v1/admin/overview');
}

export async function suspendUser(userId: string): Promise<void> {
  return api.post<void>(`/api/v1/admin/users/${userId}/suspend`);
}

export async function unsuspendUser(userId: string): Promise<void> {
  return api.post<void>(`/api/v1/admin/users/${userId}/unsuspend`);
}

export async function updateUserRole(
  userId: string,
  role: 'player' | 'operator' | 'admin'
): Promise<void> {
  return api.put<void>(`/api/v1/admin/users/${userId}/role`, { role });
}

export async function getTenantSettings(): Promise<TenantSettings> {
  return api.get<TenantSettings>('/api/v1/admin/tenant');
}

export async function getBillingStatus(): Promise<Subscription | null> {
  return api.get<Subscription | null>('/api/v1/admin/billing/subscription');
}

export async function getBillingUsage(): Promise<UsageMetrics> {
  return api.get<UsageMetrics>('/api/v1/admin/billing/usage');
}

export async function getBillingInvoices(): Promise<Invoice[]> {
  return api.get<Invoice[]>('/api/v1/admin/billing/invoices');
}

export async function getComplianceSettings(): Promise<RgSettings> {
  return api.get<RgSettings>('/api/v1/admin/compliance/rg');
}

export async function getSelfExclusionList(): Promise<SelfExclusion[]> {
  return api.get<SelfExclusion[]>('/api/v1/admin/compliance/self-exclusion');
}

export async function getKycOverview(): Promise<KycOverview> {
  return api.get<KycOverview>('/api/v1/admin/compliance/kyc');
}

export async function getTelegramBotStatus(): Promise<TelegramBotStatus> {
  return api.get<TelegramBotStatus>('/api/v1/admin/integrations/telegram');
}

export async function getWebhookEndpoints(): Promise<WebhookEndpoints> {
  return api.get<WebhookEndpoints>('/api/v1/admin/integrations/webhooks');
}

export async function getConnectedServices(): Promise<ConnectedService[]> {
  return api.get<ConnectedService[]>('/api/v1/admin/integrations/services');
}

export async function getReferralAdminOverview(): Promise<ReferralAdminOverview> {
  return api.get<ReferralAdminOverview>('/api/v1/admin/referrals/overview');
}

export async function getAdminActivity(): Promise<AdminActivity[]> {
  return api.get<AdminActivity[]>('/api/v1/admin/activity');
}

export async function getAdminRounds(
  cursor?: string
): Promise<PaginatedResponse<{ id: string; crashPoint?: number; betCount?: number; createdAt?: string }>> {
  const params = cursor ? `?cursor=${cursor}` : '';
  return api.get(`/api/v1/admin/rounds${params}`);
}

export async function updateTenantIdentity(data: TenantIdentity): Promise<TenantIdentity> {
  return api.put<TenantIdentity>('/api/v1/admin/tenant/identity', data);
}

export async function updateTenantBranding(data: TenantBranding): Promise<TenantBranding> {
  return api.put<TenantBranding>('/api/v1/admin/tenant/branding', data);
}

export async function updateTenantLimits(data: TenantLimits): Promise<TenantLimits> {
  return api.put<TenantLimits>('/api/v1/admin/tenant/limits', data);
}

export async function updateComplianceSettings(data: RgSettings): Promise<RgSettings> {
  return api.put<RgSettings>('/api/v1/admin/compliance/rg', data);
}

export async function updateWebhookEndpoints(data: WebhookEndpoints): Promise<WebhookEndpoints> {
  return api.put<WebhookEndpoints>('/api/v1/admin/integrations/webhooks', data);
}

export async function updateBotWebhook(url: string): Promise<void> {
  return api.put<void>('/api/v1/admin/integrations/telegram/webhook', { url });
}

export async function testWebhook(url: string): Promise<{ ok: boolean; message?: string }> {
  return api.post<{ ok: boolean; message?: string }>(
    '/api/v1/admin/integrations/telegram/webhook/test',
    { url }
  );
}
