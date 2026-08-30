# Prediction model scope vs tenancy

**Current product model: global market model** (`modelScope: 'global'`).

- ACIE / ensemble / calibration / divergence are **process-global** and trained on the shared crash stream.
- **Money paths** (bets, ledger, risk limits, entitlements) remain **tenant-scoped** with RLS.
- Every decision audit should include `modelScope: 'global'` and `heuristic: true` so operators never confuse this with per-tenant edge.

If true per-tenant isolation is required later, introduce `TenantPredictionRuntime` maps keyed by `tenantId` and snapshot keys `crash:prediction:stack:v2:{tenantId}`. Do **not** mix global ACIE with tenant-private outcomes without labeling.
