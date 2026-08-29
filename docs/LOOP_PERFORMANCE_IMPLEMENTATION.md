# CrashWave V1.1 — Loop Performance Engineering Implementation

Implemented against the V1.1 continuous OODA loop design.

## Real-time path

`Round -> immutable prediction state snapshot -> prediction -> opportunity -> risk -> short-lived execution authorization -> execution`

The real-time path does not perform history DB warm-up. Startup prewarming remains mandatory; if the prediction history is not warm, the decision fails closed instead of introducing an unpredictable database latency spike.

## Async path

`Outcome/Crash events -> learning -> calibration/state publication -> analytics/drift/backtest`

Learning publishes a new immutable prediction-state version after its work completes. Inference records the model/feature/regime/calibration versions used for the decision.

## Ordering

The existing single-concurrency prediction worker preserves process-local event ordering. For distributed Redis Streams deployment, session/tenant partitioning must be used as the ordering key and pending-message recovery is exposed through `RedisStreamsBus.reclaimPending()`.

## Execution safety

Risk authorization now carries a 250ms expiry. Execution refuses missing/expired authorization and refuses placement while Sheath Mode is active.

## Queue reliability

Delayed retries now schedule a retry pump; previously a delayed job could remain stranded until another enqueue occurred.

## Remaining deployment requirement

A production deployment must use Redis Streams/BullMQ (or an equivalent durable queue) for cross-process execution rather than relying on the in-process `PriorityJobQueue` as the distributed transport. The local queue remains an execution primitive only.
