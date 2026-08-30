# CrashWave Production Sign-off Checklist (Phase 5.10)

## Engineering gates (code-complete)
- [x] JWT secrets fail closed in production
- [x] CORS allow-list required in production
- [x] Redis required for mutex/rate-limit unless explicit override
- [x] Financial circuit breaker on risk path
- [x] RG limits enforced server-side (`/api/v1/rg/*` + placeBet)
- [x] Security headers (baseline + optional helmet)
- [x] OpenAPI at `/api/docs` when swagger packages installed
- [x] Standardized `{ error: { code, message, details?, requestId } }`
- [x] Postgres `statement_timeout` on pool connect
- [x] Prometheus `/metrics` + latency histograms
- [x] Browser product policy (`BROWSER_PRODUCT_MODE`)
- [x] Composition PR gate in CI

## Ops gates (must pass in target environment)
- [ ] `npm ci` succeeds for root and `admin-dashboard/`
- [ ] `integration_live_db` against ephemeral Postgres
- [ ] `docker_build` for control-plane and browser-worker images
- [ ] Live E2E placement in staging with `BROWSER_PRODUCT_MODE=remote`
- [ ] Load / Lighthouse / security scan results archived
- [ ] Legal review of browser automation deployment model
- [ ] Grafana dashboards pointed at real metric names (`crash_*`)

## Sign-off
Signed-off by: _____________  Date: _____________
