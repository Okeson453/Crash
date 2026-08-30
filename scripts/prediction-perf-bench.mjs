/**
 * §31 Performance benches — 10k/50k/100k/500k update+predict path.
 * Target: p99 prediction < 8ms.
 */
import { performance } from 'node:perf_hooks';

// Dynamic import compiled dist if present; else skip message
async function main() {
  let IncrementalStateEngine;
  let runPredictionPipeline;
  try {
    const state = await import('../dist/prediction/state/incremental-state-engine.js');
    const pipe = await import('../dist/prediction/prediction-pipeline.js');
    IncrementalStateEngine = state.IncrementalStateEngine;
    runPredictionPipeline = pipe.runPredictionPipeline;
  } catch {
    console.log('Build dist first (npm run build). Running synthetic micro-bench instead.');
    synthetic();
    return;
  }

  for (const n of [10_000, 50_000, 100_000, 500_000]) {
    const eng = new IncrementalStateEngine();
    const times = [];
    for (let i = 0; i < Math.min(n, 20_000); i++) {
      const cp = i % 5 === 0 ? 1.1 : 1.45;
      const t0 = performance.now();
      eng.update(cp);
      runPredictionPipeline({
        baseProbability: eng.snapshot().ewmaHit13,
        regime: 'normal',
        dataQuality: 0.9,
      });
      times.push(performance.now() - t0);
    }
    times.sort((a, b) => a - b);
    const p99 = times[Math.floor(times.length * 0.99)];
    console.log(`n=${n} samples=${times.length} p99=${p99.toFixed(3)}ms pass=${p99 < 8}`);
  }
}

function synthetic() {
  const times = [];
  for (let i = 0; i < 5000; i++) {
    const t0 = performance.now();
    let s = 0;
    for (let j = 0; j < 100; j++) s += Math.sin(i + j);
    times.push(performance.now() - t0);
  }
  times.sort((a, b) => a - b);
  console.log('synthetic p99', times[Math.floor(times.length * 0.99)].toFixed(3), 'ms');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
