import { detectRegionRestriction } from '../../../src/browser/region-restriction-detector';

function mockPage(opts: { url?: string; title?: string; body?: string }) {
  return {
    url: () => opts.url ?? 'https://bc.game/',
    title: async () => opts.title ?? 'BC.Game',
    locator: () => ({
      innerText: async () => opts.body ?? '',
    }),
  } as any;
}

describe('detectRegionRestriction', () => {
  it('detects unavailable in your region', async () => {
    const r = await detectRegionRestriction(
      mockPage({ body: 'This service is unavailable in your region.' })
    );
    expect(r.restricted).toBe(true);
    expect(r.kind).toBeDefined();
  });

  it('returns false for normal crash page', async () => {
    const r = await detectRegionRestriction(
      mockPage({ body: 'Crash game loading... Multiplier 1.00x' })
    );
    expect(r.restricted).toBe(false);
  });

  it('detects VPN interstitial', async () => {
    const r = await detectRegionRestriction(mockPage({ body: 'VPN detected. Please disable VPN.' }));
    expect(r.restricted).toBe(true);
  });
});
