# CrashWave V1.1 Production Hardening

Implemented against the supplied audit bundle and settlement deep-dive.

## Security

- Removed Telegram credential collection and admin credential arguments.
- Added `scripts/import-tenant-credentials.ts` for operator-side credential enrollment.
- Credentials are no longer injected as `BCGAME_USERNAME`, `BCGAME_PASSWORD`, or `BCGAME_2FA_SECRET` container environment variables.
- Tenant credentials are materialized only as a mode-0600 read-only secret file and mounted into the tenant container.
- Secret files are deleted on tenant destruction.
- Removed sensitive websocket URL logging.
- Production refuses the unsafe process orchestrator fallback when Docker is unavailable.
- Production Redis distributed mutexes default to fail-closed rather than silently falling back to local locks.
- Tenant Docker containers drop all Linux capabilities and enable `no-new-privileges`.
- Tenant Docker networking defaults to an isolated network with inter-container communication disabled.
- npm lockfile registry URLs are HTTPS-only and no longer reference the previous HTTP package mirror.

## Payments

- Paystack HTTP/network failures are classified and retried with bounded exponential backoff.
- Paystack non-2xx responses are checked before processing JSON payloads.
- Payment amounts have an integer `amount_minor` representation for NGN/kobo comparisons.
- Paystack daily payments are claimed before activation.
- Monthly Paystack payments retain atomic reference claims.
- Stake-increase payment detection no longer uses amount-distance heuristics; it requires explicit payment metadata/narration and exact fee amount.
- Paid `user_not_found` webhook events fail closed instead of being acknowledged as successful.
- Manual payment verification re-checks the plan amount before activation.
- Subscription activation is transactionally serialized per user and container provisioning occurs asynchronously after the billing commit.
- Daily tenant provisioning occurs asynchronously after the billing claim.
- Stripe event IDs are persisted for successful processing and the webhook inbox provides durable uniqueness.

## Webhooks

- Added durable `webhook_inbox` with provider/event uniqueness, retry state, locking, exponential backoff, and dead-letter state.
- Webhook HTTP endpoints verify signatures, persist the raw event, acknowledge immediately, and process through the control-plane inbox worker.
- Stripe processing records successful event IDs after processing rather than before it, preventing failed events from being permanently suppressed.

## Settlement

- Removed age-based automatic VOID during boot reconciliation.
- Missing evidence is now treated as unresolved/reconciling rather than proof of VOID.
- Settlement serialization failures (`40001`) are retried with bounded backoff.
- Settlement ledger writes update `ledger_balance_cache` in the same database transaction.
- Account balance reads use the running balance cache instead of full journal-history SUM scans.
- Ledger RLS is tenant-scoped, with explicit control-plane bypass.
- Settlement transition definitions are aligned to permit reconciliation/finalization from `ORDER_INTENT` where the engine requires it.

## Prediction / execution path

- `PredictionWorker` is no longer a placeholder worker: it feeds completed rounds into `EntryDecisionService`, evaluates the ACIE path, and emits the resulting decision.
- Placeholder feature deltas were removed from the prediction worker.
- Legacy prediction shadow execution via `setImmediate` was removed from the critical prediction path when ACIE is authoritative.
- ACIE remains the live statistical prediction path; it is not represented as an ML model.

## Verification

Static source inspection was performed after the remediation pass. The production source tree is delivered without generated `node_modules`, build artifacts, credentials, or local runtime state.

The remaining verification step for the deployment environment is the normal clean-room `npm ci`, TypeScript build, database migration, unit/integration test suite, and live provider webhook replay tests against the target infrastructure.
