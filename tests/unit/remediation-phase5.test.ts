import {
  resolveBrowserProductMode,
  assertBrowserPolicyForLive,
  browserPolicySnapshot,
} from '@/browser/product-policy';
import {
  assertBettingAllowed,
  setSelfExclusion,
  setCoolingOff,
  setLimits,
} from '@/platform/responsible-gambling';
import { metricsRegistry, entriesTotal } from '@/observability/metrics/registry';

describe('Phase 5 remediation', () => {
  const env = { ...process.env };
  afterEach(() => {
    process.env = { ...env };
  });

  it('browser product mode resolves remote/local/disabled', () => {
    process.env.BROWSER_PRODUCT_MODE = 'disabled';
    delete process.env.BROWSER_WORKER_URL;
    expect(resolveBrowserProductMode()).toBe('disabled');
    process.env.BROWSER_PRODUCT_MODE = 'remote';
    process.env.BROWSER_WORKER_URL = 'http://worker:8090';
    expect(resolveBrowserProductMode()).toBe('remote');
    expect(browserPolicySnapshot().liveAutomationAllowed).toBe(true);
  });

  it('assertBrowserPolicyForLive throws when disabled', () => {
    process.env.BROWSER_PRODUCT_MODE = 'disabled';
    expect(() => assertBrowserPolicyForLive()).toThrow(/disabled/i);
  });

  it('RG self-exclusion and cooling-off block betting', () => {
    const uid = 'user-rg-1';
    setSelfExclusion(uid, new Date(Date.now() + 86400000).toISOString());
    expect(assertBettingAllowed(uid).allowed).toBe(false);
    expect(assertBettingAllowed(uid).reason).toBe('self_excluded');

    const uid2 = 'user-rg-2';
    setCoolingOff(uid2, new Date(Date.now() + 3600000).toISOString());
    expect(assertBettingAllowed(uid2).reason).toBe('cooling_off');

    const uid3 = 'user-rg-3';
    setLimits(uid3, { dailyLossLimit: 10 });
    const lim = assertBettingAllowed(uid3);
    expect(lim.allowed).toBe(true);
  });

  it('prometheus registry exposes metrics text', async () => {
    entriesTotal.inc({ status: 'test' });
    const text = await metricsRegistry.metrics();
    expect(text).toContain('crash_entries_total');
  });
});
