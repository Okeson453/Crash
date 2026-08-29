/**
 * Unit tests — telegram-menu 3-column role grids & entitlements.
 */
import {
  entitlementsFrom,
  operatorEntitlements,
  mainControlKeyboard,
  operatorControlKeyboard,
  adminControlKeyboard,
  roleControlKeyboard,
  onboardingKeyboard,
  settingsKeyboard,
  modeKeyboard,
  connectedHomeKeyboard,
  buildBotCommands,
  menuHeaderText,
  helpText,
} from '../../../src/platform/telegram-menu';
import type { Tenant, Plan, TenantInstance } from '../../../src/platform/types';

const tenant: Tenant = {
  id: 'abcdefghij',
  telegramId: 1n,
  telegramUsername: null,
  email: null,
  status: 'active',
  planId: 'p1',
  timezone: 'UTC',
  createdAt: new Date(),
};

const plan: Plan = {
  id: 'p1',
  name: 'Pro',
  priceMonthly: 10,
  maxDailyEntries: 100,
  fixedStake: 700,
  fixedTarget: 1.3,
  allowedModes: ['observe-only', 'dry-run', 'live'],
  features: { engine: true, analytics: true },
  minStake: 1,
  maxStake: 1000,
  stakeConfigurable: true,
  billingCycle: 'monthly',
};

const runningInstance: TenantInstance = {
  id: 'i1',
  userId: tenant.id,
  containerId: 'c1',
  containerHost: 'host',
  status: 'running',
  mode: 'live',
  dailyEntriesUsed: 3,
  dailyResetAt: null,
  pnlToday: 12,
  pnlTotal: 100,
  lastHeartbeat: new Date(),
};

function assertMaxThree(rows: Array<Array<{ text: string; callback_data: string }>>): void {
  for (const row of rows) {
    expect(row.length).toBeLessThanOrEqual(3);
    expect(row.length).toBeGreaterThan(0);
  }
}

describe('telegram-menu 3-column grid', () => {
  it('uses at most 3 buttons per row for tenant / operator / admin', () => {
    const tenantEnt = entitlementsFrom(tenant, plan, null, false);
    assertMaxThree(mainControlKeyboard(tenantEnt));

    assertMaxThree(operatorControlKeyboard(operatorEntitlements({ engineRunning: true })));

    const adminEnt = entitlementsFrom(tenant, plan, null, true);
    assertMaxThree(adminControlKeyboard(adminEnt));
  });

  it('cells are emoji + short label with ui: callbacks', () => {
    const ent = entitlementsFrom(tenant, plan, null, false);
    const flat = mainControlKeyboard(ent).flat();
    expect(flat.length).toBeGreaterThan(0);
    for (const b of flat) {
      expect(b.text.length).toBeGreaterThan(1);
      expect(b.callback_data.startsWith('ui:')).toBe(true);
    }
  });

  it('admin grid includes platform tiles', () => {
    const flat = adminControlKeyboard(entitlementsFrom(tenant, plan, null, true))
      .flat()
      .map((b) => b.callback_data);
    expect(flat).toContain('ui:admin_users');
    expect(flat).toContain('ui:admin_pause_all');
    expect(flat).toContain('ui:admin_resume_all');
  });

  it('roleControlKeyboard routes admin', () => {
    const ent = entitlementsFrom(tenant, plan, null, true);
    expect(ent.role).toBe('admin');
    const flat = roleControlKeyboard(ent).flat().map((b) => b.callback_data);
    expect(flat).toContain('ui:admin_users');
  });

  it('roleControlKeyboard routes operator', () => {
    const ent = operatorEntitlements({ engineRunning: false });
    expect(ent.role).toBe('operator');
    const flat = roleControlKeyboard(ent).flat().map((b) => b.callback_data);
    expect(flat).toContain('ui:startengine');
    expect(flat).not.toContain('ui:admin_users');
  });

  it('roleControlKeyboard routes tenant', () => {
    const ent = entitlementsFrom(tenant, plan, null, false);
    expect(ent.role).toBe('tenant');
    const flat = roleControlKeyboard(ent).flat().map((b) => b.callback_data);
    expect(flat).toContain('ui:status');
    expect(flat).not.toContain('ui:admin_users');
  });

  it('buildBotCommands includes admin_menu for admin', () => {
    const cmds = buildBotCommands(entitlementsFrom(tenant, plan, null, true)).map((c) => c.command);
    expect(cmds).toContain('admin_menu');
    expect(cmds).toContain('admin_users');
  });

  it('buildBotCommands omits admin cmds for tenant', () => {
    const cmds = buildBotCommands(entitlementsFrom(tenant, plan, null, false)).map((c) => c.command);
    expect(cmds).not.toContain('admin_menu');
    expect(cmds).toContain('menu');
    expect(cmds).toContain('status');
  });

  it('menuHeaderText for operator without tenant', () => {
    expect(menuHeaderText(null, operatorEntitlements())).toContain('OPERATOR');
  });

  it('menuHeaderText for tenant includes truncated id', () => {
    const text = menuHeaderText(tenant, entitlementsFrom(tenant, plan, runningInstance, false));
    expect(text).toContain('TENANT');
    expect(text).toContain('abcdefgh');
    expect(text).toContain('running');
  });

  it('helpText is role-aware', () => {
    expect(helpText(entitlementsFrom(tenant, plan, null, true))).toContain('Admin');
    expect(helpText(operatorEntitlements())).toContain('Operator');
    expect(helpText(entitlementsFrom(tenant, plan, null, false))).toContain('Tenant');
  });

  it('onboardingKeyboard is 3-col and has login', () => {
    const rows = onboardingKeyboard();
    assertMaxThree(rows);
    const flat = rows.flat().map((b) => b.callback_data);
    expect(flat).toContain('ui:login');
  });

  it('settingsKeyboard respects entitlements', () => {
    const ent = entitlementsFrom(tenant, plan, null, false);
    const flat = settingsKeyboard(ent).flat().map((b) => b.callback_data);
    expect(flat).toContain('ui:menu');
    if (ent.canConfigureStake) expect(flat).toContain('ui:stake');
  });

  it('modeKeyboard maps modes to ui:mode_set', () => {
    const rows = modeKeyboard(['observe-only', 'live']);
    assertMaxThree(rows);
    const flat = rows.flat().map((b) => b.callback_data);
    expect(flat).toContain('ui:mode_set:observe-only');
    expect(flat).toContain('ui:mode_set:live');
  });

  it('connectedHomeKeyboard shows pause when running', () => {
    const ent = entitlementsFrom(tenant, plan, runningInstance, false);
    expect(ent.engineRunning).toBe(true);
    const flat = connectedHomeKeyboard(ent).flat().map((b) => b.callback_data);
    expect(flat).toContain('ui:pause');
  });

  it('entitlementsFrom marks admin role and elevated flags', () => {
    const ent = entitlementsFrom(tenant, plan, null, true);
    expect(ent.isAdmin).toBe(true);
    expect(ent.role).toBe('admin');
    expect(ent.canLogin).toBe(true);
    expect(ent.canControlEngine).toBe(true);
  });

  it('operatorEntitlements sets operator role', () => {
    const ent = operatorEntitlements({ bcGameConnected: true, engineRunning: true });
    expect(ent.isOperator).toBe(true);
    expect(ent.bcGameConnected).toBe(true);
    expect(ent.engineRunning).toBe(true);
    expect(ent.role).toBe('operator');
  });
});
