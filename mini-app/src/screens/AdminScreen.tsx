/**
 * AdminScreen — tab shell for authorized administrators.
 * Each tab is a dedicated screen under screens/admin/.
 * Frontend visibility is not the security boundary; RBAC is enforced server-side.
 */
import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Tabs } from '@/components/ui/Tabs';
import { Card } from '@/components/ui/Card';
import { AdminOverviewScreen } from './admin/AdminOverviewScreen';
import { AdminUsersScreen } from './admin/AdminUsersScreen';
import { AdminEnginesScreen } from './admin/AdminEnginesScreen';
import { AdminConfigScreen } from './admin/AdminConfigScreen';
import { AdminHealthScreen } from './admin/AdminHealthScreen';
import { AdminAuditScreen } from './admin/AdminAuditScreen';
import { AdminTenantScreen } from './admin/AdminTenantScreen';
import { AdminBillingScreen } from './admin/AdminBillingScreen';
import { AdminComplianceScreen } from './admin/AdminComplianceScreen';
import { AdminIntegrationsScreen } from './admin/AdminIntegrationsScreen';
import { AdminReferralsScreen } from './admin/AdminReferralsScreen';
import { AdminSessionsScreen } from './admin/AdminSessionsScreen';
import { AdminActiveBetsScreen } from './admin/AdminActiveBetsScreen';
import { AdminRiskScreen } from './admin/AdminRiskScreen';
import { AdminTransactionsScreen } from './admin/AdminTransactionsScreen';
import { AdminLogsScreen } from './admin/AdminLogsScreen';
import { AdminAlertsScreen } from './admin/AdminAlertsScreen';
import { AdminFeatureFlagsScreen } from './admin/AdminFeatureFlagsScreen';

const tabs = [
  { id: 'overview', label: 'Overview' },
  { id: 'users', label: 'Users' },
  { id: 'engines', label: 'Engines' },
  { id: 'sessions', label: 'Sessions' },
  { id: 'bets', label: 'Active Bets' },
  { id: 'risk', label: 'Risk' },
  { id: 'transactions', label: 'Transactions' },
  { id: 'config', label: 'Config' },
  { id: 'health', label: 'Health' },
  { id: 'logs', label: 'Logs' },
  { id: 'alerts', label: 'Alerts' },
  { id: 'flags', label: 'Flags' },
  { id: 'audit', label: 'Audit' },
  { id: 'tenant', label: 'Tenant' },
  { id: 'billing', label: 'Billing' },
  { id: 'referrals', label: 'Referrals' },
  { id: 'compliance', label: 'Compliance' },
  { id: 'integrations', label: 'Integrations' },
];

export function AdminScreen() {
  const { isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');

  if (!isAdmin) {
    return (
      <main className="p-4">
        <Card>
          <p className="text-sm text-tg-text">Administrator access is required.</p>
        </Card>
      </main>
    );
  }

  return (
    <div className="page-container px-4 py-4 space-y-4">
      <Tabs tabs={tabs} value={activeTab} onChange={setActiveTab} />
      {activeTab === 'overview' && <AdminOverviewScreen />}
      {activeTab === 'users' && <AdminUsersScreen />}
      {activeTab === 'engines' && <AdminEnginesScreen />}
      {activeTab === 'sessions' && <AdminSessionsScreen />}
      {activeTab === 'bets' && <AdminActiveBetsScreen />}
      {activeTab === 'risk' && <AdminRiskScreen />}
      {activeTab === 'transactions' && <AdminTransactionsScreen />}
      {activeTab === 'config' && <AdminConfigScreen />}
      {activeTab === 'health' && <AdminHealthScreen />}
      {activeTab === 'logs' && <AdminLogsScreen />}
      {activeTab === 'alerts' && <AdminAlertsScreen />}
      {activeTab === 'flags' && <AdminFeatureFlagsScreen />}
      {activeTab === 'audit' && <AdminAuditScreen />}
      {activeTab === 'tenant' && <AdminTenantScreen />}
      {activeTab === 'billing' && <AdminBillingScreen />}
      {activeTab === 'referrals' && <AdminReferralsScreen />}
      {activeTab === 'compliance' && <AdminComplianceScreen />}
      {activeTab === 'integrations' && <AdminIntegrationsScreen />}
    </div>
  );
}
