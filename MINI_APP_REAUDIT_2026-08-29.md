# CrashWave Mini App Re-audit — 2026-08-29

## Execution checkpoint

The repository was inspected before implementation. The supplied audit describes a frontend-only repository, but the actual archive also contains a substantial Fastify/Socket.io control-plane backend at repository root. That discrepancy was treated as a repository fact rather than silently accepting the audit assumption.

## Implemented in this checkpoint

- Mounted top-level and route-level React error boundaries.
- Moved browser storage behind `mini-app/src/lib/storage.ts` and added session correlation IDs.
- Added redacting frontend logger and global browser error handlers.
- Added the error-reporting seam (`src/lib/sentry.ts`) without claiming a live Sentry integration because the Sentry package is not installed and dependency installation was unavailable in this environment.
- Added auth bootstrap lifecycle handling, retry state, and proactive access-token refresh scheduling.
- Normalized Telegram snake_case user fields for frontend consumption.
- Added typed API error mapping including 401/403/409/422/429/5xx handling and Retry-After support.
- Added the in-Mini-App admin entry point conditioned on the server-loaded user role, plus Admin Overview/Users/Engines/Configuration/System Health/Audit tabs.
- Added an explicit game UI state model covering connecting/reconnecting/disconnected/betting/pending/running/cashout/crashed/failure states.
- Added large-bet confirmation and latest-balance checks before placing a bet, plus UUID idempotency keys.
- Added history URL filters, date presets, empty/loading states, and CSV export.
- Added reusable UI primitives under `components/ui` and moved shared primitives out of `components/shared`.
- Added settings sub-screen architecture, notification-center architecture, dashboard operational status widgets, Telegram MainButton/viewport/platform helpers, and a basic service worker.
- Added legal placeholder routes/pages and PWA icon assets.
- Added Mini App Docker/nginx deployment configuration and CSP/security headers.
- Added CI workflow and coverage/bundle-size checking scripts.
- Added backend identity/RBAC migration fields, refresh-token persistence, Telegram HMAC hardening, access-token revocation hook, Mini App balance/round/bet tables, and a Mini App game service wired into the existing WebSocket server.
- Reworked backend Mini App auth/users/admin/game/bet/round routes to use the Mini App tables instead of the previous incompatible mock/automation repository shapes.

## Verification performed

Static repository checks completed:

- No `dangerouslySetInnerHTML` found in Mini App source.
- No direct `fetch()` outside `src/api/client.ts`.
- No direct browser storage access outside `src/lib/storage.ts`.
- No React `style=` props remain in Mini App TSX after CSP cleanup.
- No Mini App source file exceeds 500 lines.
- No component TSX file exceeds 250 lines after splitting `ControlScreen`.
- Added regression/unit tests for Telegram normalization, URL validation, game-store error state, and core UI primitives.
- Added CI configuration and deployment configuration.

## Validation blockers / unresolved requirements

1. `npm ci` cannot complete in this execution environment; package registry access timed out. Consequently the repository does not currently have installed TypeScript/Vite/ESLint/Vitest dependencies in the working copy.
2. `npm run typecheck` therefore stops at missing `@types/node` and `vite/client`; this is an environment/dependency-installation blocker, not a green validation.
3. `npm run lint` cannot execute because ESLint is not installed; `npm test` cannot execute because Vitest is not installed.
4. The audit's requested live Sentry dashboard verification cannot be truthfully claimed because the Sentry dependency/token/dashboard are not available here. The local reporting seam is present.
5. The supplied audit calls the backend absent, but the actual repository contains an existing automation/control-plane backend. The new Mini App game service is an added domain alongside that architecture; it still requires deployment-level verification against PostgreSQL/Redis and multi-instance WebSocket behavior.
6. Real-money funding/payment flows are not implemented by the supplied contract. New player balances default to zero. Pricing remains informational. This prevents a claim of real-money production readiness.
7. Backend and frontend end-to-end smoke tests could not be run without installed dependencies and a running PostgreSQL/Redis environment.
8. The supplied design requires complete i18n, full operational analytics workbench, browser-session/risk/transaction/log/alert/feature-flag admin sub-screens, and several additional Telegram/PWA capabilities. The repository now has architecture seams/placeholders for some of these, but they are not all verified as complete production features.

## Resume point

Resume at **Phase 1 verification → Phase 2 integration verification** after dependency/network access is restored:

1. Run `npm ci` in `mini-app/` and root.
2. Run Mini App lint/typecheck/tests/build and fix every compiler/lint/test issue.
3. Run backend typecheck/tests and fix every issue.
4. Start PostgreSQL/Redis and run migrations through `019_mini_app_identity.sql`.
5. Execute Telegram auth, JWT refresh/revocation, RBAC, rate-limit, game-flow, betting, cashout, fairness, and WebSocket acceptance tests.
6. Continue the Phase 3–7 checklist from the supplied fix prompt, then perform a fresh repository-wide re-audit.
