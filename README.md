CrashWave

Full-stack real-time crash gaming and platform operations system

CrashWave is an end-to-end platform combining a real-time crash-game engine, backend Control Plane, web interfaces, Telegram Mini App, administrative tooling, persistent financial/game state, analytics, observability, and production infrastructure.

The repository contains the core platform services, player-facing Mini App, standalone administration dashboard, database migrations, Redis coordination, WebSocket infrastructure, Telegram integration, browser/game integration, risk and betting services, operational tooling, and deployment configuration.

«Current status: The repository has undergone a production-readiness implementation and re-audit checkpoint. Major architecture, security, authentication, RBAC, game-state, betting, administration, observability, deployment, and testing foundations are present. Engineering remediation Phases 1–5 are implemented in-tree. Final production sign-off is tracked in `docs/PRODUCTION_SIGNOFF_CHECKLIST.md` and remains dependent on ops gates (live integration, E2E, load, Lighthouse, security, compliance) in the target environment.»

> **Prediction honesty:** CrashWave uses calibrated **heuristic / statistical ensemble** signals (ACIE), not trained neural nets. Signals are labeled `heuristic` / `trainable: false` in the API. Historical analytics describe observed behavior; **no predictive profitability is guaranteed**.



---

Table of Contents

- "Overview" (#overview)
- "Platform Architecture" (#platform-architecture)
- "Core Capabilities" (#core-capabilities)
- "Repository Structure" (#repository-structure)
- "Applications" (#applications)
- "Backend Control Plane" (#backend-control-plane)
- "Game Engine" (#game-engine)
- "Authentication and Security" (#authentication-and-security)
- "Telegram Integration" (#telegram-integration)
- "Admin Platform" (#admin-platform)
- "Betting and Wallet Architecture" (#betting-and-wallet-architecture)
- "Data Layer" (#data-layer)
- "Real-Time Communication" (#real-time-communication)
- "Analytics" (#analytics)
- "Observability" (#observability)
- "Configuration" (#configuration)
- "Environment Variables" (#environment-variables)
- "Local Development" (#local-development)
- "Database Setup" (#database-setup)
- "Running the Platform" (#running-the-platform)
- "Mini App Development" (#mini-app-development)
- "Admin Dashboard" (#admin-dashboard)
- "Testing" (#testing)
- "Code Quality" (#code-quality)
- "Docker" (#docker)
- "Deployment" (#deployment)
- "CI/CD" (#cicd)
- "Operational Safety" (#operational-safety)
- "Security Model" (#security-model)
- "Database Migrations" (#database-migrations)
- "Monitoring and Health Checks" (#monitoring-and-health-checks)
- "Backup and Recovery" (#backup-and-recovery)
- "Documentation" (#documentation)
- "Production Readiness" (#production-readiness)
- "Known Verification Blockers" (#known-verification-blockers)
- "Responsible Gaming and Compliance" (#responsible-gaming-and-compliance)
- "Contributing" (#contributing)
- "License" (#license)

---

Overview

CrashWave is structured as a multi-layer platform rather than a standalone frontend application.

At a high level:

                         ┌───────────────────────┐
                         │       Telegram        │
                         │     Bot / Mini App    │
                         └───────────┬───────────┘
                                     │
                                     ▼
┌──────────────────────────────────────────────────────────┐
│                    PLAYER INTERFACES                     │
│                                                          │
│  React Mini App          Web / Player UI                 │
│  Home / Play / Wallet    History / Profile               │
└──────────────────────────────┬───────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────┐
│                     CONTROL PLANE                        │
│                                                          │
│  Fastify API   Authentication   RBAC   Game Services     │
│  Betting       Wallet           Admin  Audit             │
└──────────────┬──────────────────────┬────────────────────┘
               │                      │
               ▼                      ▼
       ┌───────────────┐      ┌────────────────┐
       │  PostgreSQL   │      │     Redis      │
       │  + Timescale  │      │ Coordination   │
       │  Persistence  │      │ Cache / Locks  │
       └───────────────┘      └────────────────┘
               │
               ▼
       ┌─────────────────┐
       │ Real-Time Layer │
       │ WebSocket / WS  │
       └─────────────────┘
               │
               ▼
       ┌─────────────────┐
       │ Game / Browser  │
       │ Integration     │
       └─────────────────┘

The Control Plane is the authority for identity, authorization, game state, betting operations, balances, configuration, and administrative operations.

The frontend—including the Telegram Mini App—is treated as an interface, not as a security boundary.

---

Platform Architecture

CrashWave follows an event-driven, service-oriented architecture with clear separation between:

- presentation
- API/control plane
- authentication
- authorization
- game state
- betting
- risk controls
- persistence
- real-time communication
- analytics
- observability
- infrastructure
- operational tooling

The architecture also retains the existing browser/game integration layer and operational automation services present in the repository.

---

Core Capabilities

Player Platform

- Crash game interface
- Real-time multiplier updates
- Bet placement
- Cash-out
- Bet history
- Balance display
- Player profile
- Player settings
- Notifications
- Connection/reconnection handling
- Offline/recovery states
- Telegram Mini App integration
- Telegram MainButton support
- Reactive Telegram theme integration

Platform Services

- Fastify backend
- PostgreSQL persistence
- TimescaleDB-compatible time-series schema
- Redis
- WebSocket communication
- Authentication
- JWT access/refresh flow
- Refresh-token persistence and revocation
- Telegram Mini App authentication
- RBAC
- Tenant-aware platform architecture
- Audit logging
- Rate limiting
- Idempotency handling
- Risk controls
- Balance reconciliation
- Game-state management
- Operational health monitoring

Administration

Authorized administrators can access platform controls from:

1. the standalone administration dashboard, and
2. the Telegram Mini App.

The Mini App administrator experience uses the same Control Plane APIs rather than introducing a second backend.

Administrative capabilities include areas such as:

- Dashboard
- Users
- Game/engine operations
- Configuration
- System health
- Audit information
- Platform operations

Administrative access is determined server-side.

---

Repository Structure

.
├── src/                         # Core backend/platform
│   ├── analytics/               # Analytics and metrics
│   ├── api/                     # HTTP/API server
│   ├── app/                     # Application composition/wiring
│   ├── background-workers/      # Background processing
│   ├── betting/                 # Betting and cash-out
│   ├── browser/                 # Browser/game integration
│   ├── capital/                 # Capital/watchdog services
│   ├── config/                  # Configuration and validation
│   ├── core/                    # Orchestration/recovery
│   ├── decision/                # Decision services
│   ├── execution/               # Execution layer
│   ├── game/                    # Game adapter/observer
│   ├── ledger/                  # Ledger/reconciliation
│   ├── mini-app/                # Mini App backend services
│   ├── network/                 # Network/proxy management
│   ├── notifications/           # Notifications/Telegram
│   ├── observability/           # Logging/metrics/health
│   ├── opportunity/             # Opportunity/ranking
│   ├── persistence/             # PostgreSQL/Redis
│   ├── platform/                # Control Plane/platform services
│   ├── prediction/              # Prediction/feature services
│   ├── protocol/                # Protocol/WebSocket schemas
│   ├── risk/                    # Risk controls
│   ├── risk-engine/             # Risk calculations
│   └── security/                # Cryptography/security
│
├── mini-app/                    # Telegram/player React Mini App
│   ├── src/
│   ├── public/
│   ├── tests/
│   ├── scripts/
│   ├── Dockerfile
│   ├── nginx.conf
│   └── vite.config.ts
│
├── admin-dashboard/             # Standalone Next.js admin UI
│   ├── app/
│   ├── lib/
│   └── package.json
│
├── migrations/                  # SQL database migrations
├── scripts/                     # Operations/deployment scripts
├── docker/                      # Docker Compose/infrastructure
├── docs/                        # Architecture/runbooks/security/docs
├── .github/workflows/           # CI/CD workflows
│
├── Dockerfile
├── docker-compose.mini-app.yml
├── railway.toml
├── config.yaml
├── .env.example
├── CONTRIBUTING.md
└── README.md

---

Applications

1. Core Platform

The root project contains the primary Node.js/TypeScript backend and platform services.

Technology:

- Node.js 20+
- TypeScript
- Fastify
- PostgreSQL
- TimescaleDB-compatible schema
- Redis
- Socket.IO/WebSockets
- Playwright
- Telegraf
- Zod
- Pino
- Prometheus client

---

2. Telegram Mini App

Located in:

mini-app/

The Mini App provides the player-facing Telegram experience.

Primary areas include:

Home
Play
Wallet
History
Profile
Admin (authorized users only)

The application uses:

- React
- Vite
- React Router
- Zustand
- TanStack React Query
- Socket.IO client
- React Hook Form
- Recharts
- Tailwind CSS
- Zod

The Mini App communicates with the backend Control Plane through authenticated APIs and WebSockets.

---

3. Standalone Admin Dashboard

Located in:

admin-dashboard/

The repository retains a standalone Next.js administration application for desktop and operational workflows.

The Telegram Mini App administrator interface and standalone dashboard are intended to consume the same backend authority rather than duplicating business logic.

---

Backend Control Plane

The Control Plane is the authoritative backend layer.

It owns:

- identity
- authentication
- tenant resolution
- authorization
- user roles
- administrative permissions
- game state
- betting operations
- balance state
- audit events
- configuration
- operational state
- API contracts
- WebSocket state

A client cannot grant itself administrative access.

The intended security chain is:

Telegram initData
       │
       ▼
Telegram signature verification
       │
       ▼
Identity resolution
       │
       ▼
Tenant resolution
       │
       ▼
RBAC
       │
       ▼
Admin API authorization
       │
       ▼
Administrative operation
       │
       ▼
Audit event

---

Game Engine

The platform contains a real-time crash-game state model.

Game lifecycle concerns include:

- connection
- synchronization
- betting window
- pending operations
- active round
- multiplier updates
- cash-out
- crash
- recovery
- failure
- reconnection

The Mini App explicitly models operational UI states rather than assuming the game is always connected.

The backend maintains authoritative game state.

---

Authentication and Security

Telegram Authentication

Telegram Mini App authentication is validated server-side.

The backend verifies Telegram "initData" before establishing an authenticated application identity.

Client-provided role information is not treated as authoritative.

JWT

The authentication layer supports:

- access tokens
- refresh tokens
- refresh-token persistence
- revocation/blacklisting hooks
- expiry handling
- proactive frontend refresh
- authentication bootstrap

RBAC

Authorization is server-side.

Example:

User
 └── Role
      ├── player
      ├── operator
      └── admin

The exact permission model is controlled by the backend.

Frontend role information is only used to control presentation after the server has resolved authorization.

Sensitive Data

The project is designed to avoid exposing:

- Telegram initialization data
- access tokens
- refresh tokens
- passwords
- authorization headers
- secrets

in logs.

The frontend logger contains sensitive-key redaction.

---

Telegram Integration

Telegram is integrated at multiple levels.

Mini App

The Mini App supports Telegram WebApp functionality including:

- Telegram identity
- theme parameters
- viewport behavior
- platform detection
- MainButton
- Mini App authentication

Bot

The backend also contains Telegram bot/router functionality for platform operations and notifications.

Relevant services include:

src/notifications/
src/platform/telegram-menu.ts
src/platform/telegram-router.ts
src/platform/telegram-router-admin.ts

Telegram operations are subject to authentication and authorization controls.

---

Admin Platform

Administrators can access controls through the Mini App when the backend confirms that their identity has the required role.

The expected Mini App structure is:

Mini App
├── Home
├── Play
├── Wallet
├── History
├── Profile
└── Admin
     ├── Dashboard
     ├── Users
     ├── Instances / Engines
     ├── Sessions
     ├── Billing
     ├── System Health
     ├── Configuration
     ├── Audit Logs
     └── Operations

The repository currently provides the implemented administrative foundation and additional operational architecture, while some admin operational screens (subset production-ready) remain subject to the final production-readiness verification described below.

---

Betting and Wallet Architecture

The betting layer is separated from presentation code.

Relevant modules include:

src/betting/
├── betting-coordinator.ts
├── cashout.ts
├── confirmation.ts
├── execution-mode-gate.ts
├── execution-safeguards.ts
├── executor.ts
├── idempotency.ts
├── live-cashout.ts
├── live-executor.ts
├── risk-engine.ts
└── risk-state-provider.ts

The platform includes safeguards around:

- bet state
- idempotency
- risk evaluation
- confirmation
- cash-out
- execution modes
- balance consistency
- reconciliation

The Mini App also validates current balance state before sensitive betting operations and generates idempotency identifiers.

---

Data Layer

PostgreSQL

PostgreSQL provides durable platform state.

The migration history includes schemas for:

- users
- sessions
- rounds
- bets
- balances
- audit logs
- statistics
- predictions
- tenancy
- row-level security
- financial integrity
- outbox processing
- reconciliation
- Mini App identity

TimescaleDB

Time-series workloads such as game ticks are designed for TimescaleDB-compatible storage.

Redis

Redis is used for:

- distributed coordination
- locks/mutexes
- cache/state
- session coordination
- operational infrastructure

---

Real-Time Communication

Real-time functionality uses WebSockets/Socket.IO.

The platform supports real-time delivery of game-related events including concepts such as:

RoundStarted
MultiplierUpdated
RoundCrashed
BetPlaced
BetCashOut
SystemPaused
SystemResumed
CriticalError

The client includes reconnection and connection-state handling.

The final production deployment must validate multi-instance WebSocket behavior and Redis coordination under the target infrastructure.

---

Analytics

Analytics services exist under:

src/analytics/

and player-facing analytics components exist within the Mini App.

Analytics is intended to describe observed historical behavior and operational metrics rather than represent guaranteed returns (not offered).

Relevant metrics include:

- P&L
- win rate
- multiplier distribution
- streak behavior
- drawdown
- historical game statistics
- operational performance

---

Observability

The project includes observability infrastructure for:

- structured logging
- API latency
- health checks
- Prometheus metrics
- session correlation
- error reporting integration points
- operational watchdogs
- audit events

The Mini App includes:

- redacting logger
- global error handlers
- API error classification
- session IDs
- API latency instrumentation
- Web Vitals reporting architecture
- route-level error boundaries

Sensitive values are redacted before logging.

---

Configuration

Configuration is validated rather than blindly consumed.

Relevant modules:

src/config/
├── defaults.ts
├── loader.ts
├── schema.ts
├── secret-files.ts
└── validator.ts

Configuration should be provided through environment variables or approved secret-management mechanisms.

Never commit production credentials.

---

Environment Variables

Start from the supplied templates:

cp .env.example .env

For the Mini App:

cp mini-app/.env.example mini-app/.env

Backend deployments require environment-specific values for items such as:

DATABASE_URL
REDIS_URL
JWT_SECRET
TELEGRAM_BOT_TOKEN

Additional variables may be required by the enabled platform configuration.

Secrets must remain outside source control.

---

Local Development

Requirements

Recommended environment:

- Node.js >= 20
- npm
- Docker
- Docker Compose
- PostgreSQL 15+
- Redis 7+

For browser integration:

- Playwright-compatible Chromium environment

---

Install Backend Dependencies

npm install

For deterministic CI installation:

npm ci

---

Install Mini App Dependencies

cd mini-app
npm install
cd ..

---

Install Admin Dashboard Dependencies

cd admin-dashboard
npm install
cd ..

---

Database Setup

Start PostgreSQL and Redis:

docker compose -f docker/docker-compose.yml up -d db redis

Run migrations:

npm run db:migrate

Or use the TypeScript migration runner:

npm run db:migrate:ts

Seed development data where appropriate:

npm run db:seed

---

Running the Platform

Backend Development

npm run dev

Control Plane Mode

npm run dev:control-plane

Production Build

npm run build

Production Start

npm start

---

Mini App Development

cd mini-app
npm run dev

The Mini App is built with Vite.

Build:

npm run build

Preview:

npm run preview

Type checking:

npm run typecheck

Lint:

npm run lint

---

Admin Dashboard

cd admin-dashboard
npm run dev

Production build:

npm run build

Production start:

npm start

---

Testing

The project contains multiple levels of testing.

Backend Unit Tests

npm run test:unit

Integration Tests

npm run test:integration

Simulation Tests

npm run test:simulation

E2E Tests

npm run test:e2e

Complete Test Suite

npm test

Coverage

npm run test:coverage

---

Mini App Tests

From "mini-app/":

npm test

Coverage:

npm run test:coverage

---

Integration Test Areas

The production-readiness test plan covers:

Authentication
Bet lifecycle
Game state transitions
WebSocket reconnect
Error boundaries

The expected E2E coverage includes:

Authentication
Place bet
Cash-out
History
Admin controls
Offline recovery
Accessibility

---

Code Quality

Backend:

npm run typecheck
npm run lint
npm run format:check

Mini App:

cd mini-app

npm run typecheck
npm run lint
npm run format:check

The production acceptance criteria include:

- zero TypeScript errors
- zero ESLint errors/warnings
- no uncontrolled "any"
- no production "console.*"
- no unsanitized HTML injection
- no secrets in source
- accessibility rules passing
- security rules passing

---

Docker

The repository contains multiple deployment configurations.

Build the primary image:

docker build -t crashwave .

Run the local infrastructure:

npm run docker:up

Stop it:

npm run docker:down

View application logs:

npm run docker:logs

The production architecture uses separate application, PostgreSQL, and Redis services.

---

Deployment

The repository contains deployment configuration for containerized environments.

Important files include:

Dockerfile
docker/
├── Dockerfile
├── docker-compose.yml
├── docker-compose.prod.yml
└── docker-compose.tenant.yml

railway.toml
.github/workflows/
├── ci.yml
├── deploy.yml
└── docker-build.yml

The production image is designed to be built reproducibly and deployed as an immutable artifact.

---

CI/CD
GitHub Actions workflows provide automated validation/build/deployment infrastructure.
Expected pipeline stages include:
Checkout
   ↓
Dependency installation
   ↓
Type checking
   ↓
Linting
   ↓
Tests
   ↓
Build
   ↓
Docker validation
   ↓
Artifact/image publication
   ↓
Deployment
Production deployment must only proceed after the applicable verification gates are green.
Operational Safety
CrashWave is designed around fail-safe operation.
Key principles:
Safety Over Continuity
When system state is uncertain, the platform should stop or enter an observe-only state rather than guess.
Deterministic State
Game and betting operations are represented through explicit state transitions.
Idempotency
Sensitive operations use idempotency mechanisms to reduce duplicate execution risk.
Reconciliation
Financial/game state can be reconciled after interruptions.
Auditability
Important operational events are designed to produce audit records.
Fail-Safe Recovery
Unexpected crashes, connection loss, or uncertain state should not silently resume unsafe operations.
Security Model
The security architecture includes:
server-side Telegram verification
JWT authentication
refresh-token management
RBAC
tenant resolution
API authorization
rate limiting
security headers
CSP
URL validation
secret isolation
sensitive-log redaction
audit logging
database constraints
database row-level security migrations
financial integrity controls
session correlation
idempotency
The frontend is never considered a trusted authorization boundary.
For administrative access:
Client request
      ↓
Authenticated identity
      ↓
Tenant resolution
      ↓
Role / permission check
      ↓
Authorized operation
      ↓
Audit record
Database Migrations
Migrations are stored in:
migrations/
The repository contains migrations covering the evolving platform architecture, including:
001_init_relational.sql
002_timescale_hypertables.sql
003_indexes_and_constraints.sql
004_audit_logs.sql
005_daily_stats.sql
006_balance_snapshots.sql
007_predictions.sql
008_tenancy.sql
009_tenant_rls.sql
010_paystack_virtual_accounts.sql
011_terms_stake_daily.sql
012_rls_deny_default.sql
013_financial_integrity.sql
014_outbox_and_tenant_hardening.sql
015_outbox_rls.sql
016_audit_immutability.sql
017_double_entry_settlement.sql
018_acie_sol_records.sql
018_production_hardening.sql
019_mini_app_identity.sql
Always review migrations before applying them to production.
Back up production data before destructive or irreversible schema changes.
Monitoring and Health Checks
Operational tooling exists under:
scripts/
including:
healthcheck.sh
failure-drill.sh
performance-benchmark.sh
load-test-500.ts
soak-observe.ts
verify-single-instance.ts
The deployment configuration also exposes an HTTP health endpoint.
The production acceptance target includes verifying:
service health
database health
Redis health
WebSocket health
game engine health
application latency
error rates
resource consumption
recovery behavior