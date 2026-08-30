/**
 * Platt scaling: P = 1 / (1 + exp(A * logit(p) + B))
 * Fit via simple gradient steps on log-loss (no external deps).
 */

function logit(p: number): number {
  const q = Math.min(0.999, Math.max(0.001, p));
  return Math.log(q / (1 - q));
}

function sigmoid(z: number): number {
  if (z > 30) return 1;
  if (z < -30) return 0;
  return 1 / (1 + Math.exp(-z));
}

export class PlattCalibrator {
  A = 0;
  B = 0;
  fitted = false;
  sampleCount = 0;

  fit(pairs: Array<{ p: number; y: 0 | 1 }>, iterations = 80, lr = 0.05): void {
    if (pairs.length < 20) {
      this.fitted = false;
      return;
    }
    let A = 0;
    let B = 0;
    for (let iter = 0; iter < iterations; iter++) {
      let gA = 0;
      let gB = 0;
      for (const { p, y } of pairs) {
        const z = A * logit(p) + B;
        const pred = sigmoid(z);
        const err = pred - y;
        gA += err * logit(p);
        gB += err;
      }
      A -= (lr * gA) / pairs.length;
      B -= (lr * gB) / pairs.length;
    }
    this.A = A;
    this.B = B;
    this.fitted = true;
    this.sampleCount = pairs.length;
  }

  calibrate(p: number): number {
    if (!this.fitted) return p;
    return sigmoid(this.A * logit(p) + this.B);
  }
}
