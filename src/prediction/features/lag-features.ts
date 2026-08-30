import type { IncrementalStateEngine } from '../state/incremental-state-engine.js';
import type { FeatureMeta } from './feature-meta.js';

export const LAG_FEATURE_META: FeatureMeta[] = [
  { featureName: 'lag_1', featureVersion: '1', source: 'lag-ring', updateCost: 'O(1)', dependencies: [], validityWindow: 64, missingValuePolicy: 'zero' },
  { featureName: 'lag_2', featureVersion: '1', source: 'lag-ring', updateCost: 'O(1)', dependencies: [], validityWindow: 64, missingValuePolicy: 'zero' },
  { featureName: 'lag_3', featureVersion: '1', source: 'lag-ring', updateCost: 'O(1)', dependencies: [], validityWindow: 64, missingValuePolicy: 'zero' },
  { featureName: 'lag_5', featureVersion: '1', source: 'lag-ring', updateCost: 'O(1)', dependencies: [], validityWindow: 64, missingValuePolicy: 'zero' },
  { featureName: 'lag_diff_1', featureVersion: '1', source: 'lag-ring', updateCost: 'O(1)', dependencies: ['lag_1'], validityWindow: 64, missingValuePolicy: 'zero' },
  { featureName: 'lag_ratio_1', featureVersion: '1', source: 'lag-ring', updateCost: 'O(1)', dependencies: ['lag_1'], validityWindow: 64, missingValuePolicy: 'zero' },
];

export function computeLagFeatures(engine: IncrementalStateEngine): Record<string, number> {
  const lags = engine.getLagArray();
  const n = lags.length;
  const at = (k: number) => (n >= k ? lags[n - k] : 0);
  const last = at(1);
  const prev = at(2);
  return {
    lag_1: last,
    lag_2: at(2),
    lag_3: at(3),
    lag_5: at(5),
    lag_diff_1: last - prev,
    lag_ratio_1: prev > 0 ? last / prev : 1,
  };
}
