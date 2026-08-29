import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getReferralAdminOverview,
  getReferralCampaigns,
  createReferralCampaign,
  setReferralCampaignActive,
  updateReferralCampaignRules,
  getReferralFraudSignals,
  type ReferralCampaign,
} from '@/api/admin';
import { LoadingSpinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Badge } from '@/components/ui/Badge';
import { Users, Gift, AlertTriangle, Flag, Settings2 } from 'lucide-react';
import { useUIStore } from '@/stores/uiStore';

type SubTab = 'overview' | 'campaigns' | 'rules' | 'fraud';

export function AdminReferralsScreen() {
  const [tab, setTab] = useState<SubTab>('overview');
  const tabs: { id: SubTab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'campaigns', label: 'Campaigns' },
    { id: 'rules', label: 'Rules' },
    { id: 'fraud', label: 'Fraud' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex gap-1 overflow-x-auto no-scrollbar bg-tg-section rounded-xl p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`shrink-0 rounded-lg px-3 py-2 text-xs font-medium ${
              tab === t.id ? 'bg-tg-link text-white' : 'text-tg-hint'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'overview' && <OverviewPanel />}
      {tab === 'campaigns' && <CampaignsPanel />}
      {tab === 'rules' && <RulesPanel />}
      {tab === 'fraud' && <FraudPanel />}
    </div>
  );
}

function OverviewPanel() {
  const overview = useQuery({
    queryKey: ['admin-referrals-overview'],
    queryFn: getReferralAdminOverview,
  });
  if (overview.isLoading) return <LoadingSpinner size="lg" />;
  if (!overview.data) {
    return (
      <EmptyState
        icon={Gift}
        title="Referrals overview unavailable"
        description="Referral admin endpoints will surface once the backend referral domain is fully wired."
      />
    );
  }
  const d = overview.data;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <p className="text-xs text-tg-hint">Total referrals</p>
          <p className="text-lg font-bold text-tg-text">{d.totalReferrals.toLocaleString()}</p>
        </Card>
        <Card>
          <p className="text-xs text-tg-hint">Qualified</p>
          <p className="text-lg font-bold text-tg-text">{d.qualifiedReferrals.toLocaleString()}</p>
        </Card>
        <Card>
          <p className="text-xs text-tg-hint">Pending</p>
          <p className="text-lg font-bold text-tg-text">{d.pendingReferrals.toLocaleString()}</p>
        </Card>
        <Card>
          <p className="text-xs text-tg-hint">Conversion</p>
          <p className="text-lg font-bold text-tg-text">{(d.conversionRate * 100).toFixed(1)}%</p>
        </Card>
      </div>
      <Card className="space-y-2">
        <div className="flex items-center gap-2">
          <Gift className="h-4 w-4 text-tg-link" />
          <p className="text-sm font-semibold text-tg-text">Rewards</p>
        </div>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <p className="text-xs text-tg-hint">Issued</p>
            <p className="font-medium text-tg-text">{d.rewardsIssued}</p>
          </div>
          <div>
            <p className="text-xs text-tg-hint">Pending</p>
            <p className="font-medium text-tg-text">{d.rewardsPending}</p>
          </div>
          <div>
            <p className="text-xs text-tg-hint">Expired</p>
            <p className="font-medium text-tg-text">{d.rewardsExpired}</p>
          </div>
          <div>
            <p className="text-xs text-tg-hint">Revoked</p>
            <p className="font-medium text-tg-text">{d.rewardsRevoked}</p>
          </div>
        </div>
      </Card>
      {d.topReferrers && d.topReferrers.length > 0 && (
        <Card className="space-y-2">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-tg-link" />
            <p className="text-sm font-semibold text-tg-text">Top referrers</p>
          </div>
          {d.topReferrers.map((r) => (
            <div
              key={r.userId}
              className="flex justify-between py-1 border-b border-tg-hint/10 last:border-0 text-sm"
            >
              <span className="text-tg-text">@{r.username || r.userId.slice(0, 8)}</span>
              <span className="text-tg-hint">{r.qualifiedCount} qualified</span>
            </div>
          ))}
        </Card>
      )}
      <Card className="flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 text-cw-warning shrink-0 mt-0.5" />
        <p className="text-xs text-tg-hint">
          Only PAYG-or-higher confirmed subscriptions qualify. Self-referrals, duplicates,
          refunds and chargebacks are rejected. Rewards are promotional (entries / betting time),
          never withdrawable cash.
        </p>
      </Card>
    </div>
  );
}

function CampaignsPanel() {
  const qc = useQueryClient();
  const addToast = useUIStore((s) => s.addToast);
  const [name, setName] = useState('');
  const query = useQuery({ queryKey: ['admin-referral-campaigns'], queryFn: getReferralCampaigns });
  const create = useMutation({
    mutationFn: () => createReferralCampaign({ name }),
    onSuccess: () => {
      setName('');
      void qc.invalidateQueries({ queryKey: ['admin-referral-campaigns'] });
      addToast({ type: 'success', message: 'Campaign created.' });
    },
  });
  const toggle = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      setReferralCampaignActive(id, isActive),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin-referral-campaigns'] });
      addToast({ type: 'success', message: 'Campaign updated.' });
    },
  });

  if (query.isLoading) return <LoadingSpinner size="lg" />;

  return (
    <div className="space-y-4">
      <Card className="space-y-3">
        <p className="text-sm font-semibold text-tg-text">New campaign</p>
        <div>
          <Label htmlFor="camp-name">Name</Label>
          <Input id="camp-name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <Button
          className="w-full"
          disabled={!name.trim() || create.isPending}
          loading={create.isPending}
          onClick={() => create.mutate()}
        >
          Create campaign
        </Button>
      </Card>
      {!(query.data?.length) ? (
        <EmptyState icon={Flag} title="No campaigns" description="Create an active referral campaign." />
      ) : (
        <div className="space-y-2">
          {query.data!.map((c: ReferralCampaign) => (
            <Card key={c.id} className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-tg-text">{c.name}</p>
                <Badge variant={c.isActive ? 'success' : 'neutral'}>
                  {c.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </div>
              <p className="text-xs text-tg-hint">
                Window {c.qualificationWindowDays}d · Max milestone {c.maxMilestone} · Min plan{' '}
                {c.minPlan}
              </p>
              <p className="text-xs text-tg-hint">
                Milestones: {c.milestones.join(', ')}
              </p>
              <Button
                variant="secondary"
                className="w-full"
                loading={toggle.isPending}
                onClick={() => toggle.mutate({ id: c.id, isActive: !c.isActive })}
              >
                {c.isActive ? 'Deactivate' : 'Activate'}
              </Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function RulesPanel() {
  const qc = useQueryClient();
  const addToast = useUIStore((s) => s.addToast);
  const query = useQuery({ queryKey: ['admin-referral-campaigns'], queryFn: getReferralCampaigns });
  const active = query.data?.find((c) => c.isActive) ?? query.data?.[0];
  const [windowDays, setWindowDays] = useState<number | ''>('');
  const [maxMilestone, setMaxMilestone] = useState<number | ''>('');
  const [minPlan, setMinPlan] = useState('');

  const save = useMutation({
    mutationFn: () => {
      if (!active) throw new Error('No campaign');
      return updateReferralCampaignRules(active.id, {
        qualificationWindowDays: windowDays === '' ? undefined : Number(windowDays),
        maxMilestone: maxMilestone === '' ? undefined : Number(maxMilestone),
        minPlan: minPlan || undefined,
      });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin-referral-campaigns'] });
      addToast({ type: 'success', message: 'Rules saved.' });
    },
  });

  if (query.isLoading) return <LoadingSpinner size="lg" />;
  if (!active) {
    return (
      <EmptyState
        icon={Settings2}
        title="No campaign to configure"
        description="Create or activate a campaign first."
      />
    );
  }

  return (
    <Card className="space-y-3">
      <p className="text-sm font-semibold text-tg-text">Rules — {active.name}</p>
      <p className="text-xs text-tg-hint">
        Current: {active.qualificationWindowDays}d window, milestones {active.milestones.join('/')},
        min plan {active.minPlan}
      </p>
      <div>
        <Label htmlFor="rule-window">Qualification window (days)</Label>
        <Input
          id="rule-window"
          type="number"
          placeholder={String(active.qualificationWindowDays)}
          value={windowDays}
          onChange={(e) => setWindowDays(e.target.value === '' ? '' : Number(e.target.value))}
        />
      </div>
      <div>
        <Label htmlFor="rule-max">Max milestone</Label>
        <Input
          id="rule-max"
          type="number"
          placeholder={String(active.maxMilestone)}
          value={maxMilestone}
          onChange={(e) => setMaxMilestone(e.target.value === '' ? '' : Number(e.target.value))}
        />
      </div>
      <div>
        <Label htmlFor="rule-plan">Minimum plan (e.g. payg)</Label>
        <Input
          id="rule-plan"
          placeholder={active.minPlan}
          value={minPlan}
          onChange={(e) => setMinPlan(e.target.value)}
        />
      </div>
      <Button className="w-full" loading={save.isPending} disabled={save.isPending} onClick={() => save.mutate()}>
        Save rules
      </Button>
      <p className="text-xs text-tg-hint">
        Plan-based reward amounts are defined in the milestone engine (Observer/PAYG hours+entries;
        Starter/Pro/Whale entry packs). Changing rules is audited via campaign updates.
      </p>
    </Card>
  );
}

function FraudPanel() {
  const query = useQuery({
    queryKey: ['admin-referral-fraud'],
    queryFn: getReferralFraudSignals,
  });
  if (query.isLoading) return <LoadingSpinner size="lg" />;
  if (!query.data?.length) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="No fraud signals"
        description="Rejected self-referrals, duplicates, refunds, and high-velocity patterns will appear here."
      />
    );
  }
  return (
    <div className="space-y-2">
      {query.data.map((s) => (
        <Card key={s.id} className="space-y-1">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-tg-text">{s.message}</p>
            <Badge variant={s.severity === 'high' ? 'danger' : s.severity === 'medium' ? 'warning' : 'neutral'}>
              {s.severity}
            </Badge>
          </div>
          <p className="text-xs text-tg-hint">{s.type}</p>
          <p className="text-[10px] text-tg-hint">{new Date(s.createdAt).toLocaleString()}</p>
        </Card>
      ))}
    </div>
  );
}
