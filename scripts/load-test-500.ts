/**
 * Load / soak harness toward 500 qualified entries/day.
 *
 * Modes:
 *   --simulate   Pure in-process simulation (no browser/DB) — default
 *   --burst      1000 rounds in ~1 hour equivalent pacing (compressed)
 *   --day        2000 opportunity rounds → funnel to ~500 entries
 *
 * Usage:
 *   npx tsx scripts/load-test-500.ts
 *   npx tsx scripts/load-test-500.ts --burst
 *   npx tsx scripts/load-test-500.ts --day --rounds 2000
 */

import { DecisionEngine } from '../src/decision/decision-engine';
import { OpportunityRanker } from '../src/opportunity/ranker';
import { SheathMode } from '../src/core/sheath-mode';
import { IncrementalFeatureTracker } from '../src/prediction/features/incremental-features';
import {
  LatencyTimer,
  RollingLatencyWindow,
} from '../src/observability/performance/latency';
import { PriorityJobQueue } from '../src/core/job-queue/priority-queue';
import { WorkerOffload } from '../src/core/job-queue/worker-offload';

interface Args {
  burst: boolean;
  day: boolean;
  rounds: number;
}

function parseArgs(argv: string[]): Args {
  const burst = argv.includes('--burst');
  const day = argv.includes('--day') || !burst;
  const idx = argv.indexOf('--rounds');
  const rounds = idx >= 0 ? parseInt(argv[idx + 1], 10) : burst ? 1000 : 2000;
  return { burst, day, rounds: Number.isFinite(rounds) ? rounds : 2000 };
}

function randCrash(): number {
  // Rough crash-point distribution (skewed low)
  const u = Math.random();
  if (u < 0.55) return 1 + Math.random() * 0.8;
  if (u < 0.85) return 1.8 + Math.random() * 2;
  return 4 + Math.random() * 20;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const sheath = new SheathMode();
  const ranker = new OpportunityRanker({ windowSize: 80, minQualityScore: 0.35, topFraction: 0.7 });
  const engine = new DecisionEngine({
    ranker,
    sheathMode: sheath,
    baseEnterThreshold: 0.42,
  });
  const features = new IncrementalFeatureTracker();
  const entryWindow = new RollingLatencyWindow(1000);
  const offload = new WorkerOffload({ maxQueueDepth: 2000 });
  const bgQueue = new PriorityJobQueue<{ kind: string; n: number }>();
  let bgProcessed = 0;
  bgQueue.onProcess(async () => {
    bgProcessed += 1;
    // simulate light analytics work
    await new Promise((r) => setImmediate(r));
  });

  offload.register('analytics', async () => {
    bgQueue.enqueue({ kind: 'analytics', n: 1 }, 'background');
  });

  let opportunities = 0;
  let enter = 0;
  let reject = 0;
  let wait = 0;
  let sheathCount = 0;

  const t0 = performance.now();
  console.log(
    JSON.stringify({
      event: 'load_test_start',
      mode: args.burst ? 'burst' : 'day',
      rounds: args.rounds,
      targetEntries: 500,
    })
  );

  for (let i = 0; i < args.rounds; i++) {
    const crash = randCrash();
    features.onCrash(crash);

    // Background offload must not block decision path
    offload.enqueue('analytics', { round: i }, 'background');

    const f = features.toFeatures();
    const probability = Math.min(0.95, 0.35 + f.hit_rate_13 * 0.4 + Math.random() * 0.15);
    const confidence = Math.min(0.95, 0.4 + f.quality_score * 0.4);

    const timer = new LatencyTimer();
    const decision = engine.decide({
      roundId: `load-${i}`,
      probability,
      confidence,
      dimensions: {
        edge: probability,
        confidence,
        dataQuality: f.quality_score,
        regimeFit: crash < 5 ? 0.75 : 0.55,
        executionFeasibility: 0.9,
        temporalConsistency: Math.min(1, 0.5 + f.hit_rate_13 * 0.5),
      },
    });
    const ms = timer.elapsed();
    entryWindow.push(ms);
    opportunities += 1;

    if (decision.decision === 'ENTER') enter += 1;
    else if (decision.decision === 'WAIT') wait += 1;
    else if (decision.decision === 'SHEATH') sheathCount += 1;
    else reject += 1;

    // Compressed pacing: yield every 50 rounds so event loop breathes
    if (i % 50 === 0) {
      await new Promise((r) => setImmediate(r));
    }
  }

  const elapsedMs = performance.now() - t0;
  // Wait briefly for background drain
  await new Promise((r) => setTimeout(r, 100));

  const report = {
    event: 'load_test_complete',
    rounds: args.rounds,
    opportunities,
    decisions: { enter, reject, wait, sheath: sheathCount },
    funnel: {
      detectToEnterRate: enter / Math.max(1, opportunities),
      projectedDailyEntriesIf2000Rounds: Math.round((enter / opportunities) * 2000),
    },
    latencyMs: {
      p50: Math.round(entryWindow.p50() * 100) / 100,
      p95: Math.round(entryWindow.p95() * 100) / 100,
      p99: Math.round(entryWindow.p99() * 100) / 100,
      samples: entryWindow.count(),
    },
    offload: {
      queueDepth: offload.depth(),
      bgProcessed,
    },
    elapsedMs: Math.round(elapsedMs),
    roundsPerSec: Math.round((args.rounds / (elapsedMs / 1000)) * 10) / 10,
    targets: {
      entryP99Ms: 300,
      entryP99Met: entryWindow.p99() < 300,
      qualifiedEntriesGoal: 500,
      projectedMet: (enter / Math.max(1, opportunities)) * 2000 >= 400,
    },
  };

  console.log(JSON.stringify(report, null, 2));
  if (!report.targets.entryP99Met) {
    process.exitCode = 2;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
