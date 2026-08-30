import {
  setPrewarmResult,
  isReadyForLive,
  getReadiness,
} from '@/observability/readiness';
import { ACIEEngine } from '@/prediction/acie/engine';

describe('Readiness + snapshot v2', () => {
  it('isReadyForLive requires warm prewarm', () => {
    setPrewarmResult(null, 'fail');
    expect(isReadyForLive()).toBe(false);
    setPrewarmResult({
      stateWarm: true,
      calibrationWarm: true,
      historyRounds: 100,
      acieHistorySize: 50,
    });
    expect(isReadyForLive()).toBe(true);
    expect(getReadiness().prewarmCompleted).toBe(true);
  });

  it('ACIE export/import restores online observationCount', () => {
    const a = new ACIEEngine();
    a.onCrash({
      roundId: 'x1',
      crashPoint: 1.4,
      timestamp: new Date().toISOString(),
    });
    const snap = a.exportSnapshot();
    const b = new ACIEEngine();
    b.importSnapshot(snap);
    expect(b.getOnlineState().observationCount).toBe(snap.online.observationCount);
  });
});
