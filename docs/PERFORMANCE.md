# CrashWave V1.1 — Performance & Latency

## Targets (design §1.4)

| Metric | V1 | V1.1 target |
|--------|----|-------------|
| Detection → entry decision | 800–1200 ms | **p99 < 300 ms** |
| Prediction (ACIE evaluateNext) | 200–400 ms | **p99 < 50 ms** |
| Feature computation | O(N) per round | **O(1) amortized** |
| Risk evaluation | < 200 ms | **< 20 ms p99** |
| Decision engine | n/a | **< 20 ms** |

## What changed

### 1. Critical-path fast path
- When ACIE is preferred (`preferAcie`), **legacy PredictionEngine is not run on the entry path**.
- Legacy model runs via `setImmediate` shadow only (does not block placement).

### 2. Instrumentation
Prometheus histograms (see `/metrics`):
- `crash_entry_path_latency_ms`
- `crash_prediction_latency_ms`
- `crash_feature_latency_ms`
- `crash_risk_latency_ms`
- `crash_decision_latency_ms`
- `crash_stage_latency_ms{stage=...}`
- `crash_cache_hit_total` / `crash_cache_miss_total`
- `crash_entry_path_p99_estimate_ms` (rolling in-process)

### 3. Hot caches
- `predictionHotCache` — last signal per roundId (TTL ~5s)
- `featureHotCache` — latest incremental feature vector (TTL ~15s)
- DecisionEngine reads caches to avoid redundant recompute

### 4. Incremental features
- `IncrementalFeatureTracker.onCrash()` — O(1) mean/variance/streaks
- Fed from `EntryDecisionService.observeCrash()`
- Writes into `featureHotCache`

## How to measure

```bash
# After traffic
curl -s localhost:9090/metrics | grep crash_entry_path
curl -s localhost:9090/metrics | grep crash_prediction_latency
curl -s localhost:9090/metrics | grep crash_cache
```

Unit tests:

```bash
npx jest tests/unit/performance/latency-fastpath.test.ts --forceExit
```

## Strengthening quality under speed

Speed must not dilute edge:
- DecisionEngine still requires quality ≥ threshold and top-rank window
- Sheath Mode suspends betting on drift / worker failure / data quality
- Geometric-mean quality score prevents single-dimension gaming

## Next performance steps

1. Pre-warm ACIE + feature tracker at session start (already partially via seed)
2. BullMQ offload of non-critical workers so event loop stays free
3. Browser fast-path (pre-loaded game, reduced humanize delay on critical clicks)
4. Load test: 500 entries/day sustained + burst 1000/h
EOF

## Implemented performance steps (2026-08-23)

1. **Pre-warm** — `prewarmPredictionStack()` at composition start (history + ACIE seed + incremental features).
2. **Worker offload** — `WorkerOffload` / priority queue: background analytics/learning scheduled via `setImmediate`, does not block entry path.
3. **Browser fast-path** — `Humanizer.clickFast()` used for place-bet and cash-out (shorter path, 70–200ms class delays).
4. **Load harness** — `npm run test:load` / `test:load:burst` → `scripts/load-test-500.ts` (funnel + p50/p95/p99 decision latency).

