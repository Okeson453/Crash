/** Feature declaration contract (design §6) */
export interface FeatureMeta {
  featureName: string;
  featureVersion: string;
  source: string;
  updateCost: 'O(1)' | 'O(w)' | 'O(n)';
  dependencies: string[];
  validityWindow: number;
  missingValuePolicy: 'zero' | 'carry' | 'skip';
}

export const FEATURE_VERSION_V2 = 'fv-2.0.0';
