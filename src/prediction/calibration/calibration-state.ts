/**
 * Calibration state — global + per-regime, with ECE/Brier tracking.
 * Phase 4: isotonic when enough data, Platt fallback otherwise.
 */

import { IsotonicCalibrator } from './isotonic-calibrator.js';
import { PlattCalibrator } from './platt-calibrator.js';
import {
  emptyBins,
  updateBin,
  expectedCalibrationError,
  brierScore,
  logLoss,
  type ReliabilityBin,
} from './calibration-metrics.js';

export type RegimeKey = string;

interface RegimeCalibrator {
  isotonic: IsotonicCalibrator;
  platt: PlattCalibrator;
  pairs: Array<{ p: number; y: 0 | 1 }>;
  bins: ReliabilityBin[];
  brierSum: number;
  logLossSum: number;
  n: number;
}

const MAX_PAIRS = 5000;

function createRegime(): RegimeCalibrator {
  return {
    isotonic: new IsotonicCalibrator(),
    platt: new PlattCalibrator(),
    pairs: [],
    bins: emptyBins(10),
    brierSum: 0,
    logLossSum: 0,
    n: 0,
  };
}

export class CalibrationState {
  readonly version = 'cal-v1';
  private global = createRegime();
  private byRegime = new Map<RegimeKey, RegimeCalibrator>();
  private refitEvery = 50;
  private sinceRefit = 0;

  observe(rawProbability: number, actual: 0 | 1, regime: RegimeKey = 'global'): void {
    const p = Math.min(0.999, Math.max(0.001, rawProbability));
    this.record(this.global, p, actual);
    let reg = this.byRegime.get(regime);
    if (!reg) {
      reg = createRegime();
      this.byRegime.set(regime, reg);
    }
    this.record(reg, p, actual);
    this.sinceRefit += 1;
    if (this.sinceRefit >= this.refitEvery) {
      this.refit();
      this.sinceRefit = 0;
    }
  }

  private record(c: RegimeCalibrator, p: number, y: 0 | 1): void {
    c.pairs.push({ p, y });
    if (c.pairs.length > MAX_PAIRS) c.pairs.splice(0, c.pairs.length - MAX_PAIRS);
    updateBin(c.bins, p, y);
    c.brierSum += brierScore(p, y);
    c.logLossSum += logLoss(p, y);
    c.n += 1;
  }

  refit(): void {
    this.fitOne(this.global);
    for (const c of this.byRegime.values()) this.fitOne(c);
  }

  private fitOne(c: RegimeCalibrator): void {
    if (c.pairs.length >= 80) {
      c.isotonic.fit(c.pairs);
    }
    if (c.pairs.length >= 20) {
      c.platt.fit(c.pairs);
    }
  }

  /**
   * Calibrate raw probability.
   * Prefer regime isotonic → global isotonic → regime Platt → global Platt → identity.
   */
  calibrate(rawProbability: number, regime: RegimeKey = 'global'): number {
    const p = Math.min(0.999, Math.max(0.001, rawProbability));
    const reg = this.byRegime.get(regime);
    if (reg?.isotonic.fitted) return reg.isotonic.calibrate(p);
    if (this.global.isotonic.fitted) return this.global.isotonic.calibrate(p);
    if (reg?.platt.fitted) return reg.platt.calibrate(p);
    if (this.global.platt.fitted) return this.global.platt.calibrate(p);
    return p;
  }

  /** Shrink toward baseline when sample confidence is low */
  calibrateWithShrinkage(
    rawProbability: number,
    regime: RegimeKey,
    baseline = 0.65,
    sampleCount: number
  ): number {
    const calibrated = this.calibrate(rawProbability, regime);
    const conf = Math.min(1, sampleCount / 200);
    return conf * calibrated + (1 - conf) * baseline;
  }

  metrics(regime: RegimeKey = 'global'): {
    ece: number;
    brier: number;
    logLoss: number;
    n: number;
    version: string;
  } {
    const c = regime === 'global' ? this.global : this.byRegime.get(regime) ?? this.global;
    return {
      ece: expectedCalibrationError(c.bins),
      brier: c.n > 0 ? c.brierSum / c.n : 0,
      logLoss: c.n > 0 ? c.logLossSum / c.n : 0,
      n: c.n,
      version: this.version,
    };
  }

  isWarm(): boolean {
    return this.global.n >= 30;
  }
}

export const globalCalibrationState = new CalibrationState();
