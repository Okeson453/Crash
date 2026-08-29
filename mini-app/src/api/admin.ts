import { api } from './client';
import type {
  ConfigHistoryEntry,
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


export async function getAdminConfigHistory(): Promise<ConfigHistoryEntry[]> {
  try {
    return await api.get<ConfigHistoryEntry[]>('/api/v1/admin/config/history');
  } catch {
    return [];
  }
}


export interface ReferralCampaign {
  id: string;
  name: string;
  qualificationWindowDays: number;
  maxMilestone: number;
  milestones: number[];
  isActive: boolean;
  startsAt: string;
  endsAt: string | null;
  minPlan: string;
  notes: string | null;
  rewardExpiryDays?: number;
  createdAt: string;
}

export interface AdminReferralRow {
  id: string;
  referrerId: string;
  referredId: string;
  status: string;
  createdAt: string;
  qualifiedAt: string | null;
  referrerUsername?: string | null;
  referredUsername?: string | null;
}

export interface AdminRewardRow {
  id: string;
  userId: string;
  tenantId: string | null;
  milestone: number;
  rewardType: string;
  entriesQuantity: number;
  hoursQuantity: number;
  status: string;
  issuedAt: string;
  expiresAt: string | null;
  username?: string | null;
}

export interface FraudSignal {
  id: string;
  type: string;
  severity: 'low' | 'medium' | 'high';
  message: string;
  referrerId?: string;
  referredId?: string;
  count?: number;
  createdAt: string;
}

export async function getReferralCampaigns(): Promise<ReferralCampaign[]> {
  return api.get<ReferralCampaign[]>('/api/v1/admin/referrals/campaigns');
}

export async function createReferralCampaign(body: {
  name: string;
  qualificationWindowDays?: number;
  maxMilestone?: number;
  minPlan?: string;
  notes?: string;
}): Promise<ReferralCampaign> {
  return api.post<ReferralCampaign>('/api/v1/admin/referrals/campaigns', body);
}

export async function setReferralCampaignActive(
  id: string,
  isActive: boolean
): Promise<ReferralCampaign> {
  return api.put<ReferralCampaign>(`/api/v1/admin/referrals/campaigns/${id}/active`, { isActive });
}

export async function updateReferralCampaignRules(
  id: string,
  rules: {
    qualificationWindowDays?: number;
    maxMilestone?: number;
    milestones?: number[];
    minPlan?: string;
    notes?: string;
    rewardExpiryDays?: number;
    startsAt?: string | null;
    endsAt?: string | null;
  }
): Promise<ReferralCampaign> {
  return api.put<ReferralCampaign>(`/api/v1/admin/referrals/campaigns/${id}/rules`, rules);
}

export async function getReferralFraudSignals(): Promise<FraudSignal[]> {
  return api.get<FraudSignal[]>('/api/v1/admin/referrals/fraud');
}

export async function getAdminQualifiedReferrals(): Promise<AdminReferralRow[]> {
  return api.get<AdminReferralRow[]>('/api/v1/admin/referrals/qualified');
}

export async function getAdminPendingReferrals(): Promise<AdminReferralRow[]> {
  return api.get<AdminReferralRow[]>('/api/v1/admin/referrals/pending');
}

export async function getAdminReferralRewards(): Promise<AdminRewardRow[]> {
  return api.get<AdminRewardRow[]>('/api/v1/admin/referrals/rewards');
}

export async function revokeReferralReward(id: string, reason: string): Promise<void> {
  return api.post<void>(`/api/v1/admin/referrals/rewards/${id}/revoke`, { reason });
}

// ── Phase 4 operational surfaces ─────────────────────────────────────────────

export interface AdminBrowserSession {
  id: string;
  status: string;
  mode: string;
  browserProfileId: string | null;
  operatorId: string | null;
  startedAt: string;
  endedAt: string | null;
  notes: string | null;
}

export interface AdminActiveBet {
  id: string;
  userId: string;
  username: string | null;
  amount: number;
  autoCashout: number | null;
  state: string;
  roundId: string | null;
  cashoutMultiplier: number | null;
  pnl: number | null;
  createdAt: string;
}

export interface AdminRiskSummary {
  activeBetCount: number;
  activeExposure: number;
  pendingBetCount: number;
  dailyLossEstimate: number;
  openSessions: number;
  highStakeBets: number;
  recentRejectedFraud: number;
  limits: {
    maxDailyLoss: number | null;
    maxSessionHours: number | null;
    betCooldownMinutes: number | null;
  };
}

export interface AdminTransaction {
  id: string;
  userId: string | null;
  username: string | null;
  type: string;
  amount: number;
  status: string;
  reference: string | null;
  createdAt: string;
}

export interface AdminLogEntry {
  id: string;
  source: string;
  level: string;
  message: string;
  actorId: string | null;
  createdAt: string;
}

export interface AdminAlert {
  id: string;
  severity: 'info' | 'warning' | 'critical';
  component: string;
  message: string;
  acknowledged: boolean;
  createdAt: string;
}

export interface FeatureFlag {
  key: string;
  enabled: boolean;
  scope: string;
  description: string;
  updatedAt: string | null;
}

export async function getAdminBrowserSessions(): Promise<AdminBrowserSession[]> {
  return api.get<AdminBrowserSession[]>('/api/v1/admin/sessions');
}

export async function terminateAdminSession(id: string): Promise<void> {
  return api.post<void>(`/api/v1/admin/sessions/${id}/terminate`);
}

export async function getAdminActiveBets(): Promise<AdminActiveBet[]> {
  return api.get<AdminActiveBet[]>('/api/v1/admin/bets/active');
}

export async function getAdminRiskSummary(): Promise<AdminRiskSummary> {
  return api.get<AdminRiskSummary>('/api/v1/admin/risk');
}

export async function getAdminTransactions(): Promise<AdminTransaction[]> {
  return api.get<AdminTransaction[]>('/api/v1/admin/transactions');
}

export async function getAdminLogs(): Promise<AdminLogEntry[]> {
  return api.get<AdminLogEntry[]>('/api/v1/admin/logs');
}

export async function getAdminAlerts(): Promise<AdminAlert[]> {
  return api.get<AdminAlert[]>('/api/v1/admin/alerts');
}

export async function acknowledgeAdminAlert(id: string): Promise<void> {
  return api.post<void>(`/api/v1/admin/alerts/${id}/acknowledge`);
}

export async function getFeatureFlags(): Promise<FeatureFlag[]> {
  return api.get<FeatureFlag[]>('/api/v1/admin/feature-flags');
}

export async function setFeatureFlagEnabled(key: string, enabled: boolean): Promise<FeatureFlag> {
  return api.put<FeatureFlag>(`/api/v1/admin/feature-flags/${encodeURIComponent(key)}`, { enabled });
}
