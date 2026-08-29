# CrashWave Telegram Mini App — Production Design Specification v2.0.0-RC1

> **Document Type**: Implementation-Ready Design Specification  
> **Project**: CrashWave — Multi-Tenant Telegram Crash Game Platform  
> **Version**: 2.0.0-RC1  
> **Date**: 2026-08-28  
> **Status**: Production-Ready Specification (Post-Audit)  
> **Classification**: Internal — Engineering & Design Reference

---

## Table of Contents

1. [Executive Summary & Audit Findings](#1-executive-summary--audit-findings)
2. [Current-State Architecture](#2-current-state-architecture)
3. [Identified Problems & Risk Matrix](#3-identified-problems--risk-matrix)
4. [Improved UX Concept & Design Principles](#4-improved-ux-concept--design-principles)
5. [Screen-by-Screen Specification](#5-screen-by-screen-specification)
6. [Component System & Design Tokens](#6-component-system--design-tokens)
7. [User Flows & State Machines](#7-user-flows--state-machines)
8. [Technical Requirements](#8-technical-requirements)
9. [Security & Performance Requirements](#9-security--performance-requirements)
10. [File-Level Implementation Plan](#10-file-level-implementation-plan)
11. [Validation Checklist](#11-validation-checklist)
12. [Testing Strategy](#12-testing-strategy)
13. [Deployment Considerations](#13-deployment-considerations)
14. [Final Acceptance Criteria](#14-final-acceptance-criteria)

---

# 1. Executive Summary & Audit Findings

## 1.1 Project Overview

CrashWave is a multi-tenant Telegram crash game platform where operators deploy their own branded crash games through a Telegram bot. The system consists of:

- **Backend Core** (`src/`): Node.js/TypeScript event-driven architecture with PostgreSQL persistence, Redis caching, an internal EventBus, and a Telegram Bot API gateway.
- **Admin Dashboard** (`admin-dashboard/`): A minimal Next.js 14 web application for operator configuration and monitoring.
- **Telegram Bot**: A text-command-driven bot with inline keyboards, persistent reply keyboards, and a login conversation flow for operator onboarding.
- **Design Documents**: Two conceptual design specifications exist but have **zero implementation** in the codebase.

## 1.2 Audit Scope

This audit inspected:
- All TypeScript source files in `src/`
- All SQL migration files in `migrations/`
- The admin dashboard Next.js application in `admin-dashboard/`
- Configuration files (`config.yaml`, `.env.example`, `Dockerfile`, `docker-compose.yml`)
- Package manifests and build configuration
- Both design documents from project storage

## 1.3 Critical Finding: Zero Mini App Implementation

**The most significant finding**: Despite two detailed design documents specifying a Telegram Mini App frontend, **no Mini App code exists anywhere in the repository**. Specifically:

| Design Requirement | Implementation Status | Gap Severity |
|---|---|---|
| React + Vite + Tailwind SPA | **MISSING** | Critical |
| Telegram WebApp SDK integration | **MISSING** | Critical |
| `initData` validation endpoint | **MISSING** | Critical |
| WebSocket real-time game feed | **MISSING** | Critical |
| JWT session management for operators | **MISSING** | High |
| REST API for game state/queries | **MISSING** | Critical |
| Screen-based navigation (Dashboard, Game, Analytics, etc.) | **MISSING** | Critical |
| Responsive mobile-first UI | **MISSING** | Critical |
| Loading, error, empty states | **MISSING** | High |
| Animation/transition system | **MISSING** | Medium |

## 1.4 What Does Exist (Functional Backend)

The backend is substantially complete and production-viable:

- **Game Engine**: `src/core/session-supervisor.ts` — handles round lifecycle, multiplier curve, auto-cashout, fairness verification
- **Betting System**: `src/betting/betting-coordinator.ts` — multi-tenant bet placement, cashout, ledger updates
- **Event Bus**: `src/core/event-bus/bus.ts` — internal pub/sub with backpressure and circuit breaker
- **Persistence**: PostgreSQL with 18 migration files covering tenants, bets, rounds, sessions, analytics, audit logs, financial ledger
- **Telegram Gateway**: `src/telegram/gateway.ts` — bot command routing, rate limiting, reply formatting
- **Analytics**: `src/analytics/engine.ts` — real-time metrics aggregation with configurable windows
- **Control Plane**: `src/platform/control-plane.ts` — operator onboarding, billing, tenant lifecycle
- **Admin Dashboard**: Next.js 14 with inline-styled raw HTML tables, no component library

## 1.5 Design Documents vs. Reality

| Document | Claims | Reality |
|---|---|---|
| `CrashWave-Telegram-Mini-App-Design.md` | Full Mini App with React, Vite, Tailwind, 8 screens | Zero frontend code |
| `TELEGRAM_MINI_APP_DESIGN_SPEC.md` | Complete API spec, WebSocket events, auth flow | Only health/metrics HTTP endpoints exist |

## 1.6 Audit Verdict

**Backend**: 75% complete — core game logic, persistence, analytics, and Telegram bot are functional. Missing: public REST API, WebSocket server, JWT auth, initData validation.

**Frontend**: 0% complete — no Mini App exists. The admin dashboard is a primitive prototype.

**Integration**: 10% complete — Telegram bot works as text-only interface. No WebApp SDK integration, no `web_app` menu button, no Mini App URL configuration.

---

# 2. Current-State Architecture

## 2.1 Repository Structure

```
crash/
├── src/
│   ├── index.ts                    # Entry point — initializes composition root, starts HTTP server
│   ├── app/
│   │   └── composition.ts          # DI container wiring (all singletons)
│   ├── config/
│   │   ├── defaults.ts             # Default configuration values
│   │   └── schema.ts               # Zod validation schema for env vars
│   ├── core/
│   │   ├── event-bus/
│   │   │   └── bus.ts              # Internal EventBus (Node.js EventEmitter)
│   │   └── session-supervisor.ts   # Game round lifecycle manager
│   ├── telegram/
│   │   ├── gateway.ts              # Telegram Bot API gateway + command router
│   │   ├── router.ts               # Command-to-handler mapping
│   │   ├── auth.ts                 # Telegram identity middleware
│   │   └── types.ts                # Telegram-specific type definitions
│   ├── platform/
│   │   ├── control-plane.ts        # Operator onboarding & tenant lifecycle
│   │   ├── telegram-router.ts      # Telegram routing abstractions
│   │   └── telegram-router-impl.ts # Concrete Telegram router implementation
│   ├── betting/
│   │   └── betting-coordinator.ts  # Multi-tenant bet placement & cashout
│   ├── analytics/
│   │   └── engine.ts               # Real-time metrics aggregation
│   ├── types/
│   │   ├── events.ts               # Domain event type definitions
│   │   └── betting.ts              # Betting domain type definitions
│   └── persistence/
│       └── repositories/
│           └── bet-repo.ts         # Bet data access layer
├── migrations/
│   ├── 001_init_relational.sql     # Core schema (tenants, bets, rounds, sessions)
│   ├── 002_add_tenant_settings.sql
│   ├── 003_add_analytics_snapshots.sql
│   ├── 004_add_audit_log.sql
│   ├── 005_add_financial_ledger.sql
│   ├── 006_add_indexes.sql
│   ├── 007_add_tenant_status.sql
│   ├── 008_add_session_events.sql
│   ├── 009_add_bet_cancellation.sql
│   ├── 010_add_round_fairness.sql
│   ├── 011_add_operator_preferences.sql
│   ├── 012_add_tenant_customization.sql
│   ├── 013_add_performance_indexes.sql
│   ├── 014_add_billing_integration.sql
│   ├── 015_add_telegram_integration.sql
│   ├── 016_add_multi_currency.sql
│   ├── 017_add_compliance_tables.sql
│   └── 018_add_final_indexes.sql
├── admin-dashboard/                # Next.js 14 admin UI (primitive)
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   └── globals.css
│   ├── components/
│   │   └── ui/                     # shadcn/ui components (installed but unused)
│   ├── lib/
│   │   └── utils.ts
│   ├── next.config.js
│   ├── package.json
│   └── tsconfig.json
├── config.yaml                     # Application configuration
├── docker-compose.yml              # Docker orchestration
├── Dockerfile                      # Container build
├── package.json                    # Node.js dependencies
└── .env.example                    # Environment variable template
```

## 2.2 Runtime Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         CrashWave Backend                                │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐   │
│  │   HTTP      │  │  Telegram   │  │   EventBus  │  │   Control   │   │
│  │   Server    │  │    Bot      │  │  (Internal) │  │   Plane     │   │
│  │  (Health/   │  │  (Commands) │  │             │  │  (Admin API)│   │
│  │  Metrics)   │  │             │  │             │  │             │   │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘   │
│         │                │                │                │          │
│         └────────────────┴────────────────┴────────────────┘          │
│                          │                                             │
│                    ┌─────┴─────┐                                       │
│                    │  Composition │                                    │
│                    │   Root      │                                    │
│                    └─────┬─────┘                                       │
│         ┌────────────────┼────────────────┐                          │
│    ┌────┴────┐     ┌────┴────┐     ┌────┴────┐                      │
│    │PostgreSQL│     │  Redis  │     │Analytics│                      │
│    │         │     │         │     │ Engine  │                      │
│    └─────────┘     └─────────┘     └─────────┘                      │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                      MISSING: Telegram Mini App                          │
│  (No React/Vite/Tailwind SPA, no WebSocket client, no WebApp SDK)       │
└─────────────────────────────────────────────────────────────────────────┘
```

## 2.3 Data Flow (Current)

```
User -> Telegram Bot (/start) -> Gateway -> Router -> Command Handler
                                          |
                                          v
                                   Session Supervisor
                                          |
                                    ┌─────┴─────┐
                                    v           v
                               PostgreSQL    EventBus
                                    |           |
                                    v           v
                              Bet Repository  Analytics
```

## 2.4 Authentication Flow (Current)

```
Telegram User -> Bot Command -> Gateway -> Auth Middleware
                                              |
                                              v
                                        Telegram API
                                        (verify identity)
                                              |
                                              v
                                        Tenant Resolution
                                        (by Telegram chat ID)
                                              |
                                              v
                                        Command Execution
                                        (no session token)
```

**Critical Gap**: No JWT or session token is issued. Every command re-verifies identity via Telegram API. There is no stateful session for the Mini App.

## 2.5 Technology Stack

| Layer | Technology | Version | Status |
|---|---|---|---|
| Runtime | Node.js | ^20 | OK |
| Language | TypeScript | ^5.3 | OK |
| Framework | Fastify | ^4.24 | OK (health/metrics only) |
| Bot SDK | node-telegram-bot-api | ^0.64 | OK |
| Database | PostgreSQL | 15+ | OK |
| Cache | Redis | 7+ | OK |
| ORM | None (raw SQL via pg) | — | OK |
| Admin UI | Next.js | 14 | Primitive |
| Mini App | **NONE** | — | **MISSING** |
| WebSocket | **NONE** | — | **MISSING** |
| Auth (Mini App) | **NONE** | — | **MISSING** |

---

# 3. Identified Problems & Risk Matrix

## 3.1 Problem Categories

### P1: Critical — Mini App Completely Missing

| ID | Problem | Impact | Effort |
|---|---|---|---|
| P1.1 | No React/Vite/Tailwind SPA exists | Users cannot access game via Mini App | High |
| P1.2 | No WebSocket server for real-time game feed | Cannot push multiplier updates to clients | High |
| P1.3 | No REST API for game queries | Cannot fetch rounds, bets, history, analytics | High |
| P1.4 | No `initData` validation endpoint | Cannot authenticate Mini App users securely | High |
| P1.5 | No JWT session management | Cannot maintain operator sessions across requests | Medium |
| P1.6 | Telegram bot has no `web_app` menu button | Users have no entry point to Mini App | Low |

### P2: High — Backend API Gaps

| ID | Problem | Impact | Effort |
|---|---|---|---|
| P2.1 | HTTP server only exposes `/health` and `/metrics` | No public API for game operations | Medium |
| P2.2 | Control-plane admin API (`/admin/*`) has no auth middleware | Unauthorized access risk | Medium |
| P2.3 | No rate limiting on public API endpoints | DDoS / abuse vulnerability | Medium |
| P2.4 | No CORS configuration for Mini App origin | Cross-origin request failures | Low |
| P2.5 | EventBus is internal-only (Node.js EventEmitter) | Cannot broadcast to external clients | High |

### P3: High — Admin Dashboard Deficiencies

| ID | Problem | Impact | Effort |
|---|---|---|---|
| P3.1 | Raw inline styles, no design system | Unmaintainable, inconsistent UI | Medium |
| P3.2 | No component library usage (shadcn/ui installed but unused) | Reinventing basic components | Medium |
| P3.3 | No real-time updates (no WebSocket/SSE) | Stale data displayed to operators | Medium |
| P3.4 | No responsive design | Unusable on mobile devices | Medium |
| P3.5 | No error boundaries or loading states | Poor UX on slow connections | Low |

### P4: Medium — Security Concerns

| ID | Problem | Impact | Effort |
|---|---|---|---|
| P4.1 | `TELEGRAM_BOT_TOKEN` logged on startup | Token exposure in logs | Low |
| P4.2 | No input validation on command arguments | Injection / malformed data risk | Medium |
| P4.3 | No audit logging for sensitive operations | Compliance gap | Medium |
| P4.4 | Database connection string may contain credentials in plaintext | Credential exposure | Low |
| P4.5 | No HTTPS enforcement for webhook URLs | MITM vulnerability | Low |

### P5: Medium — Performance Issues

| ID | Problem | Impact | Effort |
|---|---|---|---|
| P5.1 | Analytics engine queries unindexed time ranges | Slow analytics on large datasets | Medium |
| P5.2 | No connection pooling configuration exposed | Database connection exhaustion risk | Low |
| P5.3 | EventBus has no persistent queue | Events lost on process restart | Medium |
| P5.4 | No CDN for static assets | Slow asset delivery | Low |

### P6: Low — Usability Problems

| ID | Problem | Impact | Effort |
|---|---|---|---|
| P6.1 | Telegram bot uses ASCII tables for data display | Poor readability on mobile | Low |
| P6.2 | No command autocomplete or inline query support | Discoverability issues | Low |
| P6.3 | Error messages are technical (stack traces in some cases) | User confusion | Low |
| P6.4 | No localization support | Limited to English-speaking operators | Medium |

## 3.2 Risk Matrix

```
Impact
  High | P1.1  P1.2  P1.3  P1.4  P2.1  P2.5
       | P3.1  P3.2  P3.3
       |
Medium | P1.5  P2.2  P2.3  P3.4  P3.5  P4.2
       | P4.3  P5.1  P5.3
       |
   Low | P1.6  P2.4  P4.1  P4.4  P4.5  P5.2
       | P5.4  P6.1  P6.2  P6.3  P6.4
       |
       +-----------------------------------------
            Low        Medium        High
                      Likelihood
```

## 3.3 Duplicated/Misplaced Functionality

| Finding | Location | Issue |
|---|---|---|
| `TELEGRAM_BOT_TOKEN` logged | `src/index.ts:64` | Security risk — token visible in logs |
| Analytics engine has hardcoded defaults | `src/analytics/engine.ts` | Not configurable per-tenant |
| Admin dashboard has inline styles | `admin-dashboard/app/page.tsx` | Not maintainable |
| Control-plane has no rate limiting | `src/platform/control-plane.ts` | Abuse vulnerability |
| EventBus backpressure uses arbitrary threshold | `src/core/event-bus/bus.ts:45` | Not tunable |

---

# 4. Improved UX Concept & Design Principles

## 4.1 Design Philosophy

The redesigned CrashWave Mini App follows **Telegram-native design patterns** while establishing a distinct premium gaming identity. The experience must feel:

1. **Native to Telegram** — Uses Telegram's color scheme, viewport behavior, haptic feedback, and navigation patterns
2. **Instantly Responsive** — Every interaction provides immediate visual feedback (< 100ms perceived latency)
3. **Glanceable** — Critical game information (multiplier, balance, time) is visible within 200ms of screen entry
4. **Trust-Building** — Fairness verification, transparent odds, and clear transaction history are prominently accessible
5. **Operable with One Thumb** — Primary actions within thumb reach on all screen sizes

## 4.2 Information Architecture

```
CrashWave Mini App
├── Auth Layer
│   └── Telegram initData validation → JWT session
│
├── Main Navigation (Bottom Tab Bar)
│   ├── Game (Default)
│   │   ├── Live Round
│   │   ├── Bet Placement
│   │   ├── Cashout Control
│   │   └── Round History Strip
│   ├── Dashboard
│   │   ├── Balance Card
│   │   ├── Performance Stats
│   │   ├── Recent Activity
│   │   └── Quick Actions
│   ├── History
│   │   ├── Bet History (filterable)
│   │   ├── Round History
│   │   └── Transaction Ledger
│   └── Settings
│       ├── Profile
│       ├── Preferences
│       ├── Fairness Verification
│       └── Support
│
├── Operator-Only Routes (Conditional)
│   ├── Control Panel
│   │   ├── Session Control
│   │   ├── Configuration
│   │   └── Emergency Actions
│   ├── Analytics
│   │   ├── Real-time Metrics
│   │   ├── Historical Reports
│   │   └── Export
│   └── Admin
│       ├── Tenant Settings
│       ├── Billing
│       └── Compliance
│
└── Global Overlays
    ├── Toast Notifications
    ├── Confirmation Modals
    ├── Loading States
    └── Error Boundaries
```

## 4.3 Design Principles

### Principle 1: Telegram-First Visual Design
- Use Telegram's theme variables (`--tg-theme-bg-color`, `--tg-theme-text-color`, etc.)
- Respect safe areas (notch, home indicator, status bar)
- Adapt to Telegram's light/dark mode automatically
- Use Telegram's native button styles and spacing

### Principle 2: Progressive Disclosure
- Show only essential information by default
- Reveal advanced options on user intent (tap, swipe, long-press)
- Collapse secondary data behind expandable sections

### Principle 3: Immediate Feedback
- Every tap provides haptic feedback via `Telegram.WebApp.HapticFeedback`
- Button states: default → pressed → loading → success/error
- Skeleton screens for data-fetching states (never blank screens)

### Principle 4: Resilient to Network Conditions
- Optimistic UI updates for bets and cashouts
- Local state queue for actions during disconnection
- Automatic retry with exponential backoff
- Clear offline state indicators

### Principle 5: Accessible by Default
- Minimum touch target: 44x44dp
- Color contrast ratio >= 4.5:1 for all text
- Screen reader labels for all interactive elements
- Reduced motion support for animations

## 4.4 Color System (Telegram-Aware)

```css
:root {
  /* Telegram Theme Variables (inherited from WebApp) */
  --tg-theme-bg-color: #ffffff;
  --tg-theme-text-color: #000000;
  --tg-theme-hint-color: #999999;
  --tg-theme-link-color: #2481cc;
  --tg-theme-button-color: #2481cc;
  --tg-theme-button-text-color: #ffffff;
  --tg-theme-secondary-bg-color: #f5f5f5;

  /* CrashWave Brand (adaptable to tenant) */
  --cw-primary: var(--tg-theme-button-color, #2481cc);
  --cw-primary-hover: color-mix(in srgb, var(--cw-primary) 85%, black);
  --cw-success: #34c759;
  --cw-danger: #ff3b30;
  --cw-warning: #ff9500;
  --cw-info: #5ac8fa;

  /* Game-Specific */
  --cw-multiplier-low: #34c759;
  --cw-multiplier-mid: #ff9500;
  --cw-multiplier-high: #ff3b30;
  --cw-multiplier-crash: #ff3b30;

  /* Neutral Scale */
  --cw-surface: var(--tg-theme-bg-color, #ffffff);
  --cw-surface-elevated: var(--tg-theme-secondary-bg-color, #f5f5f5);
  --cw-border: rgba(0, 0, 0, 0.1);
  --cw-text-primary: var(--tg-theme-text-color, #000000);
  --cw-text-secondary: var(--tg-theme-hint-color, #999999);
  --cw-text-inverse: var(--tg-theme-button-text-color, #ffffff);
}

[data-theme="dark"] {
  --cw-border: rgba(255, 255, 255, 0.1);
}
```

## 4.5 Typography Scale

| Token | Size | Weight | Line Height | Usage |
|---|---|---|---|---|
| `display` | 32px | 700 | 1.1 | Multiplier display |
| `heading-1` | 24px | 700 | 1.2 | Screen titles |
| `heading-2` | 20px | 600 | 1.3 | Section headers |
| `heading-3` | 16px | 600 | 1.4 | Card titles |
| `body` | 14px | 400 | 1.5 | Primary text |
| `body-small` | 12px | 400 | 1.5 | Secondary text |
| `caption` | 11px | 500 | 1.4 | Labels, timestamps |
| `mono` | 14px | 500 | 1.2 | Numbers, codes, hashes |

Font stack: `system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`
Monospace: `'SF Mono', Monaco, 'Cascadia Code', monospace`

## 4.6 Spacing System

Based on 4px grid:
- `xs`: 4px
- `sm`: 8px
- `md`: 12px
- `lg`: 16px
- `xl`: 20px
- `2xl`: 24px
- `3xl`: 32px
- `4xl`: 48px

## 4.7 Elevation & Shadows

```css
--shadow-sm: 0 1px 2px rgba(0,0,0,0.05);
--shadow-md: 0 4px 6px rgba(0,0,0,0.07), 0 2px 4px rgba(0,0,0,0.05);
--shadow-lg: 0 10px 15px rgba(0,0,0,0.1), 0 4px 6px rgba(0,0,0,0.05);
--shadow-inset: inset 0 2px 4px rgba(0,0,0,0.06);
```

## 4.8 Animation Tokens

```css
--duration-instant: 50ms;
--duration-fast: 150ms;
--duration-normal: 250ms;
--duration-slow: 400ms;
--easing-default: cubic-bezier(0.4, 0, 0.2, 1);
--easing-bounce: cubic-bezier(0.34, 1.56, 0.64, 1);
--easing-decelerate: cubic-bezier(0, 0, 0.2, 1);
```

---

# 5. Screen-by-Screen Specification

## 5.1 Screen Inventory

| Screen ID | Route | Role | Priority |
|---|---|---|---|
| `S01` | `/` | Game (Live Round) | P0 |
| `S02` | `/dashboard` | User Dashboard | P0 |
| `S03` | `/history` | Bet & Round History | P1 |
| `S04` | `/settings` | User Settings | P1 |
| `S05` | `/control` | Operator Control Panel | P0 (operator) |
| `S06` | `/analytics` | Operator Analytics | P1 (operator) |
| `S07` | `/admin` | Tenant Admin | P2 (operator) |
| `S08` | `/health` | System Health | P2 (operator) |
| `S09` | `/verify` | Fairness Verification | P1 |
| `S10` | `/onboarding` | First-Time User Onboarding | P2 |

## 5.2 S01: Game Screen (Default Route `/`)

### Purpose
Primary gameplay screen. Users place bets, watch the multiplier grow, and cash out before the crash.

### Layout Structure
```
┌─────────────────────────────────────┐
│  Status Bar (Safe Area Top)         │  height: env(safe-area-inset-top)
├─────────────────────────────────────┤
│  Header                               │
│  [Tenant Logo]  Balance: $1,234.56   │  height: 56px
├─────────────────────────────────────┤
│                                       │
│  Multiplier Display                   │  height: 200px
│  ┌─────────────────────────────┐     │
│  │         2.34x               │     │  font: display, 64px
│  │     ○ Growing dot          │     │  color: cw-multiplier-mid
│  │     Next round in 5.2s     │     │  (countdown during inter-round)
│  └─────────────────────────────┘     │
│                                       │
├─────────────────────────────────────┤
│  Round History Strip                  │  height: 40px
│  [1.2x] [3.4x] [1.1x] [8.9x] ...   │  horizontal scroll
├─────────────────────────────────────┤
│  Bet Placement Panel                  │
│  ┌─────────────────────────────┐     │
│  │  Bet Amount: [    $10   ]   │     │  input with +/- steppers
│  │  Auto Cashout: [  2.00x ]   │     │  toggle + input
│  │  [      PLACE BET      ]    │     │  primary CTA
│  └─────────────────────────────┘     │
├─────────────────────────────────────┤
│  Active Bet Panel (if placed)         │
│  ┌─────────────────────────────┐     │
│  │  Bet: $10 | Current: $23.40 │     │
│  │  [      CASH OUT      ]     │     │  destructive/emphasis CTA
│  └─────────────────────────────┘     │
├─────────────────────────────────────┤
│  Live Bet Feed (scrollable)           │
│  ┌─────────────────────────────┐     │
│  │  @user1  $5  →  $12.50 ✓   │     │
│  │  @user2  $20 →  CRASH ✗    │     │
│  │  @user3  $10 →  $8.00 ✓    │     │
│  └─────────────────────────────┘     │
├─────────────────────────────────────┤
│  Bottom Navigation                    │  height: 64px + env(safe-area-inset-bottom)
│  [Game] [Dashboard] [History] [Set]  │
└─────────────────────────────────────┘
```

### States

#### State A: Inter-Round (Waiting)
- Multiplier display shows "Next round in X.Xs"
- Countdown timer animates (circular progress)
- Bet panel is active (can place bets for next round)
- Place Bet button is enabled
- History strip shows previous round results

#### State B: Round Active (Growing)
- Multiplier animates from 1.00x upward
- Color transitions: green (1.0-2.0x) → orange (2.0-5.0x) → red (5.0x+)
- Growing dot pulses with multiplier velocity
- If user has placed bet: Active Bet Panel appears with live PnL
- Cash Out button is enabled and prominent
- Live Bet Feed updates in real-time
- Haptic feedback on each 0.5x increment (light impact)

#### State C: Round Crashed
- Multiplier freezes at crash value
- Color: red with shake animation (300ms)
- Heavy haptic feedback (error notification)
- "CRASHED @ X.XXx" overlay for 1.5s
- Active bets show loss
- History strip updates with new result
- 3-second cooldown before next inter-round

#### State D: User Cashed Out
- Multiplier freezes at cashout value
- Color: green with pulse animation
- Success haptic feedback
- "CASHED OUT @ X.XXx" overlay for 1.5s
- Winnings amount displayed prominently
- Balance updates with animation (count-up)

### Interactions

| Element | Trigger | Action | Animation |
|---|---|---|---|
| Bet Amount Input | Tap | Focus, show numpad | 150ms border highlight |
| +/- Steppers | Tap | Increment/decrement by $1 | 100ms scale bounce |
| Place Bet | Tap | Submit bet via API | Button → loading → success/error |
| Cash Out | Tap | Submit cashout via API | Button scales up 110% then loading |
| History Strip Item | Tap | Navigate to round detail | 200ms slide transition |
| Live Feed Item | Tap | Show user profile modal | 250ms modal fade |

### API Dependencies
- `GET /api/v1/game/state` — current round state
- `POST /api/v1/bets` — place bet
- `POST /api/v1/bets/:id/cashout` — cash out
- `WS /ws/v1/game` — real-time multiplier updates
- `GET /api/v1/rounds/recent` — recent round history

### Data Requirements
- Current tenant configuration (min/max bet, currency)
- User balance (real-time)
- Active round state (phase, multiplier, elapsed time)
- User's active bet for current round (if any)
- Recent rounds (last 20)
- Live bet feed (last 50 entries, paginated)

### Validation Rules
- Bet amount: `tenant.minBet <= amount <= tenant.maxBet`
- Bet amount: `amount <= user.balance`
- Auto cashout: `>= 1.01x` (minimum valid multiplier)
- Single bet per round per user
- Bet placement only during inter-round phase
- Cashout only during active round phase

### Responsive Behavior
- **Mobile (< 480px)**: Full layout as specified
- **Tablet (480-768px)**: Bet panel and active bet side-by-side, larger multiplier display
- **Desktop (> 768px)**: Not applicable (Mini App is mobile-only)

### Accessibility
- Multiplier display has `aria-live="polite"` for screen reader announcements
- Cash Out button has `aria-label="Cash out at current multiplier"`
- Color is not the sole indicator of state (icons + text accompany colors)
- Reduced motion: disable multiplier animation, instant state changes

---

## 5.3 S02: Dashboard Screen (`/dashboard`)

### Purpose
User overview showing balance, performance statistics, recent activity, and quick actions.

### Layout Structure
```
┌─────────────────────────────────────┐
│  Header                               │
│  Dashboard                    [⚙️]  │
├─────────────────────────────────────┤
│  Balance Card                         │
│  ┌─────────────────────────────┐     │
│  │  Total Balance              │     │
│  │     $1,234.56               │     │  font: heading-1
│  │  Today: +$123.45 (+10.2%)  │     │  color: cw-success/danger
│  └─────────────────────────────┘     │
├─────────────────────────────────────┤
│  Performance Stats (2x2 Grid)        │
│  ┌────────────┐ ┌────────────┐      │
│  │ Win Rate   │ │ Avg Multi  │      │
│  │   62.5%    │ │   1.84x    │      │
│  └────────────┘ └────────────┘      │
│  ┌────────────┐ ┌────────────┐      │
│  │ Total Bets │ │ Best Win   │      │
│  │   142      │ │  $456.78   │      │
│  └────────────┘ └────────────┘      │
├─────────────────────────────────────┤
│  Recent Activity                      │
│  ┌─────────────────────────────┐     │
│  │ [🟢] Won $23.40 @ 2.34x    │     │
│  │ [🔴] Lost $10.00 @ 1.12x   │     │
│  │ [🟢] Won $15.00 @ 1.50x    │     │
│  └─────────────────────────────┘     │
├─────────────────────────────────────┤
│  Quick Actions                        │
│  [🎮 Play] [📊 History] [⚙️ Settings]│
├─────────────────────────────────────┤
│  Bottom Navigation                    │
└─────────────────────────────────────┘
```

### States
- **Loading**: Skeleton cards for balance and stats
- **Empty (new user)**: Welcome message, "Place your first bet" CTA
- **Error**: Retry button, cached data if available
- **Success**: Full data display

### API Dependencies
- `GET /api/v1/users/me` — user profile and balance
- `GET /api/v1/users/me/stats` — performance statistics
- `GET /api/v1/users/me/activity` — recent activity feed

### Data Requirements
- User balance (available, total, today change)
- Performance metrics (win rate, avg multiplier, total bets, best win)
- Recent activity (last 10 entries)
- Daily/weekly/monthly performance summary

---

## 5.4 S03: History Screen (`/history`)

### Purpose
Comprehensive bet and round history with filtering, search, and detail views.

### Layout Structure
```
┌─────────────────────────────────────┐
│  Header                               │
│  History                      [🔍]  │
├─────────────────────────────────────┤
│  Tab Switcher                         │
│  [ Bets ] [ Rounds ] [ Ledger ]     │
├─────────────────────────────────────┤
│  Filter Bar                           │
│  [All ▼] [Today ▼] [Sort ▼]         │
├─────────────────────────────────────┤
│  Content List (scrollable)            │
│  ┌─────────────────────────────┐     │
│  │ Round #1234                 │     │
│  │ 2.34x | 12 bets | $1,234   │     │
│  │ 2 min ago                   │     │
│  └─────────────────────────────┘     │
│  ┌─────────────────────────────┐     │
│  │ Round #1233                 │     │
│  │ 1.12x | 8 bets  | $890     │     │
│  │ 5 min ago                   │     │
│  └─────────────────────────────┘     │
├─────────────────────────────────────┤
│  Bottom Navigation                    │
└─────────────────────────────────────┘
```

### States
- **Loading**: Skeleton list items
- **Empty**: "No bets yet" with CTA to game screen
- **Filtering**: Active filter chips, loading indicator on list
- **Detail**: Slide-up modal with round/bet details

### API Dependencies
- `GET /api/v1/bets` — paginated bet history
- `GET /api/v1/rounds` — paginated round history
- `GET /api/v1/ledger` — financial ledger entries
- `GET /api/v1/rounds/:id` — round detail
- `GET /api/v1/bets/:id` — bet detail

### Filter Options
- **Bets**: All | Won | Lost | Pending
- **Time**: Today | Week | Month | All Time | Custom
- **Sort**: Newest | Oldest | Highest Amount | Highest Multiplier

---

## 5.5 S04: Settings Screen (`/settings`)

### Purpose
User preferences, profile management, fairness verification, and support.

### Layout Structure
```
┌─────────────────────────────────────┐
│  Header                               │
│  Settings                             │
├─────────────────────────────────────┤
│  Profile Card                         │
│  ┌─────────────────────────────┐     │
│  │  [Avatar] @username         │     │
│  │  ID: 12345678               │     │
│  │  Member since Jan 2024      │     │
│  └─────────────────────────────┘     │
├─────────────────────────────────────┤
│  Preferences                          │
│  ┌─────────────────────────────┐     │
│  │ 🔔 Notifications        [>] │     │
│  │ 🌙 Dark Mode            [>] │     │
│  │ 💱 Currency (USD)       [>] │     │
│  │ 🔢 Number Format        [>] │     │
│  └─────────────────────────────┘     │
├─────────────────────────────────────┤
│  Game Settings                        │
│  ┌─────────────────────────────┐     │
│  │ 🎯 Default Bet Amount     [>] │     │
│  │ 🚀 Default Auto Cashout   [>] │     │
│  │ ⚡ Quick Bet Buttons      [>] │     │
│  └─────────────────────────────┘     │
├─────────────────────────────────────┤
│  Security & Fairness                  │
│  ┌─────────────────────────────┐     │
│  │ 🔐 Verify Fairness        [>] │     │
│  │ 📜 Game Rules             [>] │     │
│  │ 🛡️ Responsible Gaming   [>] │     │
│  └─────────────────────────────┘     │
├─────────────────────────────────────┤
│  Support                              │
│  ┌─────────────────────────────┐     │
│  │ ❓ Help Center            [>] │     │
│  │ 💬 Contact Support        [>] │     │
│  │ 🐛 Report Bug             [>] │     │
│  └─────────────────────────────┘     │
├─────────────────────────────────────┤
│  Bottom Navigation                    │
└─────────────────────────────────────┘
```

### API Dependencies
- `GET /api/v1/users/me` — profile data
- `PUT /api/v1/users/me/preferences` — update preferences
- `GET /api/v1/verify/:roundId` — fairness verification data

---

## 5.6 S05: Control Panel Screen (`/control`) — Operator Only

### Purpose
Real-time session control for operators: start/stop rounds, adjust configuration, view live status, and execute emergency actions.

### Access Control
- Requires `operator` role (enforced at API gateway)
- JWT token with `role: "operator"` claim
- 403 redirect to Dashboard if unauthorized

### Layout Structure
```
┌─────────────────────────────────────┐
│  Header                               │
│  Control Panel              [🚨]    │
├─────────────────────────────────────┤
│  Session Status Card                  │
│  ┌─────────────────────────────┐     │
│  │  Status: ● ACTIVE           │     │
│  │  Round: #1234               │     │
│  │  Phase: GROWING (2.34x)     │     │
│  │  Active Bets: 12 ($1,234)   │     │
│  │  Uptime: 2h 34m             │     │
│  └─────────────────────────────┘     │
├─────────────────────────────────────┤
│  Session Controls                     │
│  ┌─────────────────────────────┐     │
│  │ [▶ Start] [⏸ Pause] [⏹ Stop]│     │
│  └─────────────────────────────┘     │
├─────────────────────────────────────┤
│  Quick Configuration                  │
│  ┌─────────────────────────────┐     │
│  │ Min Bet: [    $1     ]      │     │
│  │ Max Bet: [   $1000   ]      │     │
│  │ Max Mult: [   100x   ]      │     │
│  │ House Edge: [   1%   ]      │     │
│  └─────────────────────────────┘     │
├─────────────────────────────────────┤
│  Live Activity Feed                   │
│  ┌─────────────────────────────┐     │
│  │ ● User1 bet $50            │     │
│  │ ● User2 cashed out @ 2.1x  │     │
│  │ ● Round #1233 crashed @1.2x│     │
│  └─────────────────────────────┘     │
├─────────────────────────────────────┤
│  Emergency Actions                    │
│  ┌─────────────────────────────┐     │
│  │ [🚨 Emergency Stop]         │     │  destructive
│  │ [🔄 Force New Round]        │     │
│  │ [📢 Broadcast Message]      │     │
│  └─────────────────────────────┘     │
├─────────────────────────────────────┤
│  Bottom Navigation                    │
└─────────────────────────────────────┘
```

### States
- **Session Inactive**: Start button enabled, Pause/Stop disabled
- **Session Active (Inter-Round)**: Start disabled, Pause/Stop enabled, bet panel active
- **Session Active (Growing)**: All controls enabled, live multiplier display
- **Session Paused**: Pause button shows "Resume", all betting suspended
- **Emergency Stop**: All controls disabled, emergency overlay

### Interactions
- **Start Session**: Confirmation modal → API call → loading → status update
- **Pause Session**: Immediate API call → optimistic UI update → confirmation
- **Emergency Stop**: Double-tap confirmation → API call → broadcast to all users
- **Config Changes**: Debounced 500ms → API call → success toast

### API Dependencies
- `GET /api/v1/admin/session` — session status
- `POST /api/v1/admin/session/start` — start session
- `POST /api/v1/admin/session/pause` — pause session
- `POST /api/v1/admin/session/stop` — stop session
- `POST /api/v1/admin/session/emergency` — emergency stop
- `PUT /api/v1/admin/config` — update configuration
- `WS /ws/v1/admin` — real-time admin events

---

## 5.7 S06: Analytics Screen (`/analytics`) — Operator Only

### Purpose
Comprehensive analytics dashboard with real-time metrics, historical reports, and data export.

### Layout Structure
```
┌─────────────────────────────────────┐
│  Header                               │
│  Analytics                  [📥]    │
├─────────────────────────────────────┤
│  Time Range Selector                  │
│  [1H] [24H] [7D] [30D] [Custom]    │
├─────────────────────────────────────┤
│  KPI Cards (Horizontal Scroll)        │
│  ┌──────┐┌──────┐┌──────┐┌──────┐  │
│  │Total ││Active││Revenue││Profit│  │
│  │Bets  ││Users ││      ││      │  │
│  │1,234 ││  56  ││$12.3k││$1.2k │  │
│  └──────┘└──────┘└──────┘└──────┘  │
├─────────────────────────────────────┤
│  Revenue Chart                        │
│  ┌─────────────────────────────┐     │
│  │  /\    /\                 │     │
│  │ /  \  /  \    /\        │     │  line chart
│  │/    \/    \  /  \       │     │
│  └─────────────────────────────┘     │
├─────────────────────────────────────┤
│  Multiplier Distribution              │
│  ┌─────────────────────────────┐     │
│  │ ████░░░░░░░░░░░░░░░░ 1.0-2.0│     │  bar chart
│  │ ████████░░░░░░░░░░░░ 2.0-5.0│     │
│  │ ███░░░░░░░░░░░░░░░░░ 5.0-10 │     │
│  │ ██░░░░░░░░░░░░░░░░░░ 10+    │     │
│  └─────────────────────────────┘     │
├─────────────────────────────────────┤
│  Top Players Table                    │
│  ┌─────────────────────────────┐     │
│  │ #  User      Bets  Profit   │     │
│  │ 1  @user1    45    +$234   │     │
│  │ 2  @user2    32    +$189   │     │
│  └─────────────────────────────┘     │
├─────────────────────────────────────┤
│  Bottom Navigation                    │
└─────────────────────────────────────┘
```

### API Dependencies
- `GET /api/v1/analytics/overview` — KPI data
- `GET /api/v1/analytics/revenue` — revenue time series
- `GET /api/v1/analytics/distribution` — multiplier distribution
- `GET /api/v1/analytics/players` — top players
- `GET /api/v1/analytics/export` — CSV/JSON export

---

## 5.8 S07: Admin Screen (`/admin`) — Operator Only

### Purpose
Tenant administration: settings, billing, compliance, and user management.

### Sections
1. **Tenant Settings**: Name, branding, currency, limits
2. **Billing**: Subscription status, usage, invoices
3. **Compliance**: Audit logs, responsible gaming settings
4. **User Management**: Search, view, restrict users
5. **Integrations**: Telegram bot settings, webhook configuration

### API Dependencies
- `GET /api/v1/admin/tenant` — tenant settings
- `PUT /api/v1/admin/tenant` — update settings
- `GET /api/v1/admin/billing` — billing info
- `GET /api/v1/admin/audit` — audit logs
- `GET /api/v1/admin/users` — user list

---

## 5.9 S08: Health Screen (`/health`) — Operator Only

### Purpose
System health monitoring with real-time metrics, alerts, and diagnostic tools.

### Layout Structure
```
┌─────────────────────────────────────┐
│  Header                               │
│  System Health                        │
├─────────────────────────────────────┤
│  Overall Status                       │
│  ┌─────────────────────────────┐     │
│  │  ● All Systems Operational  │     │
│  │  Last checked: 2s ago       │     │
│  └─────────────────────────────┘     │
├─────────────────────────────────────┤
│  Service Grid                         │
│  ┌────────────┐ ┌────────────┐       │
│  │ Database   │ │ Game Engine│       │
│  │ ● Healthy  │ │ ● Healthy  │       │
│  │ 12ms       │ │ Active     │       │
│  └────────────┘ └────────────┘       │
│  ┌────────────┐ ┌────────────┐       │
│  │ Telegram   │ │ Analytics  │       │
│  │ ● Healthy  │ │ ● Healthy  │       │
│  │ Connected  │ │ Real-time  │       │
│  └────────────┘ └────────────┘       │
├─────────────────────────────────────┤
│  Metrics                              │
│  CPU: 23% | Memory: 456MB | DB: 12ms│
├─────────────────────────────────────┤
│  Recent Alerts                        │
│  ┌─────────────────────────────┐     │
│  │ 🟡 High CPU (2 min ago)    │     │
│  │ 🟢 CPU Normalized (1m ago) │     │
│  └─────────────────────────────┘     │
├─────────────────────────────────────┤
│  Bottom Navigation                    │
└─────────────────────────────────────┘
```

### API Dependencies
- `GET /api/v1/health` — health check data
- `WS /ws/v1/health` — real-time health updates

---

## 5.10 S09: Fairness Verification Screen (`/verify`)

### Purpose
Allow users to verify the fairness of any round using the server seed, client seeds, and nonce.

### Layout Structure
```
┌─────────────────────────────────────┐
│  Header                               │
│  Verify Fairness                      │
├─────────────────────────────────────┤
│  Round Selector                       │
│  [Enter Round # or select from list] │
├─────────────────────────────────────┤
│  Verification Details                 │
│  ┌─────────────────────────────┐     │
│  │ Round: #1234                │     │
│  │ Crash: 2.34x                │     │
│  │                            │     │
│  │ Server Seed (hashed):      │     │
│  │ a1b2c3...                  │     │
│  │                            │     │
│  │ Client Seeds:              │     │
│  │ user1: d4e5f6...           │     │
│  │ user2: g7h8i9...           │     │
│  │                            │     │
│  │ Nonce: 1234                │     │
│  │                            │     │
│  │ [Verify Hash]              │     │
│  │                            │     │
│  │ Result: ✅ Verifiable      │     │
│  │ Computed: 2.34x            │     │
│  └─────────────────────────────┘     │
├─────────────────────────────────────┤
│  How It Works                         │
│  [Expandable explanation]             │
├─────────────────────────────────────┤
│  Bottom Navigation                    │
└─────────────────────────────────────┘
```

### API Dependencies
- `GET /api/v1/rounds/:id/fairness` — fairness data
- Client-side hash verification (SHA-256)

---

## 5.11 S10: Onboarding Screen (`/onboarding`)

### Purpose
First-time user experience explaining the game, placing a demo bet, and setting preferences.

### Flow
1. **Welcome**: "Welcome to CrashWave" + game explanation
2. **Demo Bet**: Place a practice bet with play money
3. **Preferences**: Set default bet amount, auto-cashout
4. **Done**: "You're ready!" + CTA to game screen

### Conditions
- Shown only on first visit (tracked via `localStorage` flag)
- Can be skipped via "Skip" button
- Can be revisited from Settings

---

# 6. Component System & Design Tokens

## 6.1 Component Hierarchy

```
App
├── Providers
│   ├── TelegramProvider (WebApp SDK context)
│   ├── AuthProvider (JWT session)
│   ├── WebSocketProvider (real-time connection)
│   ├── QueryProvider (React Query)
│   └── ThemeProvider (Telegram theme variables)
│
├── Layout
│   ├── AppLayout
│   │   ├── SafeArea (top/bottom insets)
│   │   ├── Header (optional, per-screen)
│   │   ├── Main Content
│   │   └── BottomNavigation (conditional)
│   └── ModalLayout
│       ├── SlideUpModal
│       └── FullScreenModal
│
├── Navigation
│   ├── BottomTabBar
│   ├── TabSwitcher
│   └── BackButton
│
├── Screens (see Section 5)
│
├── Shared Components
│   ├── Feedback
│   │   ├── Toast
│   │   ├── Skeleton
│   │   ├── EmptyState
│   │   ├── ErrorBoundary
│   │   └── LoadingOverlay
│   ├── Data Display
│   │   ├── BalanceCard
│   │   ├── StatCard
│   │   ├── MultiplierDisplay
│   │   ├── HistoryStrip
│   │   ├── LiveFeed
│   │   └── DataTable
│   ├── Inputs
│   │   ├── BetAmountInput
│   │   ├── AutoCashoutInput
│   │   ├── Toggle
│   │   └── Select
│   ├── Actions
│   │   ├── PrimaryButton
│   │   ├── SecondaryButton
│   │   ├── DestructiveButton
│   │   ├── IconButton
│   │   └── FloatingActionButton
│   └── Overlays
│       ├── ConfirmationModal
│       ├── BottomSheet
│       └── Tooltip
│
└── Charts
    ├── LineChart
    ├── BarChart
    └── DoughnutChart
```

## 6.2 Component Specifications

### 6.2.1 MultiplierDisplay

**Props Interface:**
```typescript
interface MultiplierDisplayProps {
  value: number;           // Current multiplier value
  phase: 'waiting' | 'growing' | 'crashed' | 'cashed_out';
  countdown?: number;      // Seconds until next round (waiting phase)
  velocity?: number;       // Growth velocity for animation speed
  size?: 'sm' | 'md' | 'lg';
  onCountdownEnd?: () => void;
}
```

**Behavior:**
- **Waiting**: Shows countdown timer with circular progress ring. Color: `--cw-text-secondary`
- **Growing**: Number animates with spring physics. Color transitions based on value thresholds:
  - `< 2.0x`: `--cw-multiplier-low`
  - `2.0x - 5.0x`: `--cw-multiplier-mid`
  - `> 5.0x`: `--cw-multiplier-high`
- **Crashed**: Number freezes, shake animation (300ms), color `--cw-multiplier-crash`
- **CashedOut**: Number freezes, pulse animation, color `--cw-success`

**Animation:**
- Number changes: `transform: scale(1.05)` for 100ms on each 0.1x increment
- Phase transitions: 250ms crossfade
- Crash: `animation: shake 0.3s ease-in-out`

### 6.2.2 BetAmountInput

**Props Interface:**
```typescript
interface BetAmountInputProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  currency: string;
  balance: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  error?: string;
}
```

**Behavior:**
- +/- buttons increment/decrement by `step` (default: 1)
- Quick amount buttons: 1/2 balance, 1/4 balance, min, max
- Validation: red border + error message if outside range
- Format: currency symbol + formatted number
- Input mode: decimal numeric keyboard on mobile

### 6.2.3 PrimaryButton

**Props Interface:**
```typescript
interface PrimaryButtonProps {
  children: React.ReactNode;
  onClick: () => void;
  loading?: boolean;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'success' | 'danger';
  fullWidth?: boolean;
  haptic?: 'light' | 'medium' | 'heavy' | 'none';
}
```

**States:**
- Default: `--cw-primary` background, white text
- Pressed: `transform: scale(0.97)`, darken 10%
- Loading: Spinner replaces text, disabled state
- Success: Green background, checkmark icon (auto-revert after 2s)
- Error: Red background, error icon (auto-revert after 2s)
- Disabled: 50% opacity, no hover effects

**Haptic Feedback:**
- On press: `Telegram.WebApp.HapticFeedback.impactOccurred(haptic)`
- On success: `Telegram.WebApp.HapticFeedback.notificationOccurred('success')`
- On error: `Telegram.WebApp.HapticFeedback.notificationOccurred('error')`

### 6.2.4 LiveFeed

**Props Interface:**
```typescript
interface LiveFeedProps {
  entries: LiveFeedEntry[];
  maxEntries?: number;
  autoScroll?: boolean;
  emptyMessage?: string;
}

interface LiveFeedEntry {
  id: string;
  username: string;
  avatar?: string;
  action: 'bet' | 'cashout' | 'loss';
  amount: number;
  multiplier?: number;
  timestamp: Date;
}
```

**Behavior:**
- New entries animate in from top with `slideDown` + `fadeIn` (200ms)
- Auto-scrolls to newest entry
- Color coding: bet (blue), cashout (green), loss (red)
- Tap entry to show user detail modal
- Max 50 entries, older entries removed with `fadeOut` animation

### 6.2.5 BottomTabBar

**Props Interface:**
```typescript
interface BottomTabBarProps {
  items: TabItem[];
  activeIndex: number;
  onChange: (index: number) => void;
  hidden?: boolean;
}

interface TabItem {
  label: string;
  icon: string; // Lucide icon name
  route: string;
  badge?: number;
  requiresAuth?: boolean;
  requiresRole?: 'user' | 'operator';
}
```

**Behavior:**
- Fixed to bottom with `env(safe-area-inset-bottom)` padding
- Active tab: filled icon + `--cw-primary` color
- Inactive tab: outline icon + `--cw-text-secondary`
- Badge: red dot with number, pulse animation on new
- Hidden on scroll down, shown on scroll up (optional)
- Haptic feedback on tab switch

## 6.3 Design Tokens Reference

### Colors
| Token | Light | Dark | Usage |
|---|---|---|---|
| `--cw-surface` | `#ffffff` | `#1a1a1a` | Background |
| `--cw-surface-elevated` | `#f5f5f5` | `#2a2a2a` | Cards, panels |
| `--cw-border` | `rgba(0,0,0,0.1)` | `rgba(255,255,255,0.1)` | Dividers |
| `--cw-text-primary` | `#000000` | `#ffffff` | Headings, primary text |
| `--cw-text-secondary` | `#666666` | `#999999` | Labels, hints |
| `--cw-primary` | `#2481cc` | `#2481cc` | Buttons, links, accents |
| `--cw-success` | `#34c759` | `#30d158` | Wins, success states |
| `--cw-danger` | `#ff3b30` | `#ff453a` | Losses, errors, crashes |
| `--cw-warning` | `#ff9500` | `#ff9f0a` | Warnings, mid multipliers |

### Spacing
| Token | Value |
|---|---|
| `--space-xs` | 4px |
| `--space-sm` | 8px |
| `--space-md` | 12px |
| `--space-lg` | 16px |
| `--space-xl` | 20px |
| `--space-2xl` | 24px |
| `--space-3xl` | 32px |
| `--space-4xl` | 48px |

### Border Radius
| Token | Value |
|---|---|
| `--radius-sm` | 4px |
| `--radius-md` | 8px |
| `--radius-lg` | 12px |
| `--radius-xl` | 16px |
| `--radius-full` | 9999px |

### Shadows
| Token | Value |
|---|---|
| `--shadow-sm` | `0 1px 2px rgba(0,0,0,0.05)` |
| `--shadow-md` | `0 4px 6px rgba(0,0,0,0.07)` |
| `--shadow-lg` | `0 10px 15px rgba(0,0,0,0.1)` |

### Animation
| Token | Value |
|---|---|
| `--duration-instant` | 50ms |
| `--duration-fast` | 150ms |
| `--duration-normal` | 250ms |
| `--duration-slow` | 400ms |
| `--easing-default` | `cubic-bezier(0.4, 0, 0.2, 1)` |
| `--easing-bounce` | `cubic-bezier(0.34, 1.56, 0.64, 1)` |

---

# 7. User Flows & State Machines

## 7.1 Authentication Flow

### 7.1.1 Telegram Mini App Entry Flow

```
User taps Bot Menu Button (web_app)
        │
        ▼
┌─────────────────────────────┐
│ Telegram opens Mini App URL │
│ with initData in URL hash   │
└─────────────┬───────────────┘
              │
              ▼
┌─────────────────────────────┐
│ Mini App loads              │
│ Extracts initData from hash │
└─────────────┬───────────────┘
              │
              ▼
┌─────────────────────────────┐
│ POST /api/v1/auth/telegram  │
│ Body: { initData: string }  │
└─────────────┬───────────────┘
              │
              ▼
┌─────────────────────────────┐
│ Backend validates initData  │
│ 1. Parse initData string    │
│ 2. Extract hash             │
│ 3. Recompute HMAC-SHA256    │
│    using BOT_TOKEN          │
│ 4. Compare hashes           │
│ 5. Check auth_date expiry   │
│    (max 24 hours old)       │
└─────────────┬───────────────┘
              │
    ┌─────────┴─────────┐
    │                   │
    ▼                   ▼
┌────────┐        ┌────────────┐
│ Valid  │        │ Invalid    │
└───┬────┘        └─────┬──────┘
    │                   │
    ▼                   ▼
┌─────────────────┐  ┌─────────────────┐
│ 1. Resolve tenant│  │ Return 401      │
│    by user ID   │  │ { error:        │
│ 2. Create/update │  │   "Invalid      │
│    user record  │  │    initData" }  │
│ 3. Generate JWT │  └─────────────────┘
│    (expires 7d) │
│ 4. Return:      │
│    { token,     │
│      user,      │
│      tenant }   │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────┐
│ Mini App stores JWT in      │
│ localStorage                │
│ Sets Authorization header   │
│ for all subsequent requests │
└─────────────┬───────────────┘
              │
              ▼
┌─────────────────────────────┐
│ Check onboarding flag       │
│ (localStorage: 'onboarded') │
└─────────────┬───────────────┘
              │
    ┌─────────┴─────────┐
    │                   │
    ▼                   ▼
┌────────┐        ┌────────────┐
│ First  │        │ Returning  │
│ Visit  │        │ User       │
└───┬────┘        └─────┬──────┘
    │                   │
    ▼                   ▼
┌─────────────────┐  ┌─────────────────┐
│ Navigate to     │  │ Navigate to     │
│ /onboarding     │  │ / (Game screen) │
└─────────────────┘  └─────────────────┘
```

### 7.1.2 JWT Refresh Flow

```
API Request with expired JWT
        │
        ▼
┌─────────────────────────────┐
│ Backend returns 401         │
│ { error: "token_expired" }  │
└─────────────┬───────────────┘
              │
              ▼
┌─────────────────────────────┐
│ Mini App detects 401        │
│ Attempts silent re-auth     │
│ with stored initData        │
└─────────────┬───────────────┘
              │
              ▼
┌─────────────────────────────┐
│ POST /api/v1/auth/refresh   │
│ Headers:                    │
│   Authorization: Bearer old │
│ Body: { initData: string }  │
└─────────────┬───────────────┘
              │
              ▼
┌─────────────────────────────┐
│ Backend validates initData  │
│ AND verifies old JWT        │
│ signature (not expiry)      │
└─────────────┬───────────────┘
              │
    ┌─────────┴─────────┐
    │                   │
    ▼                   ▼
┌────────┐        ┌────────────┐
│ Valid  │        │ Invalid    │
└───┬────┘        └─────┬──────┘
    │                   │
    ▼                   ▼
┌─────────────────┐  ┌─────────────────┐
│ Issue new JWT   │  │ Clear stored    │
│ Return 200      │  │ auth data       │
│ { token }       │  │ Redirect to     │
└─────────────────┘  │ Telegram for    │
                     │ re-authentication│
                     └─────────────────┘
```

### 7.1.3 Session Termination Flow

```
User taps "Log Out" in Settings
        │
        ▼
┌─────────────────────────────┐
│ POST /api/v1/auth/logout    │
│ Headers: Bearer <token>     │
└─────────────┬───────────────┘
              │
              ▼
┌─────────────────────────────┐
│ Backend blacklists JWT      │
│ (stores in Redis with TTL   │
│ matching token expiry)      │
└─────────────┬───────────────┘
              │
              ▼
┌─────────────────────────────┐
│ Mini App clears:            │
│ - localStorage JWT          │
│ - localStorage initData     │
│ - localStorage user         │
│ - Query cache               │
│ - WebSocket connection      │
└─────────────┬───────────────┘
              │
              ▼
┌─────────────────────────────┐
│ Redirect to Telegram        │
│ (close Mini App or show     │
│ "Please reopen from bot")   │
└─────────────────────────────┘
```

## 7.2 Game Round State Machine

```
                    ┌─────────────┐
         ┌─────────│   IDLE      │◄────────┐
         │         │ (no session)│         │
         │         └──────┬──────┘         │
         │                │ start_session() │
         │                ▼                 │
         │         ┌─────────────┐         │
         │         │ INTER-ROUND │         │
         │         │  (countdown)│         │
         │         └──────┬──────┘         │
         │                │ countdown=0    │
         │                ▼                │
         │         ┌─────────────┐        │
         │    ┌───►│   GROWING   │        │
         │    │    │ (multiplier │        │
         │    │    │  increasing)│        │
         │    │    └──────┬──────┘        │
         │    │           │                │
         │    │    ┌──────┴──────┐        │
         │    │    │             │        │
         │    │    ▼             ▼        │
         │    │ ┌──────┐   ┌─────────┐   │
         │    │ │CRASH │   │CASHED   │   │
         │    │ │      │   │OUT      │   │
         │    │ └──┬───┘   └────┬────┘   │
         │    │    │            │        │
         │    │    └──────┬─────┘        │
         │    │           │ resolve      │
         │    │           ▼              │
         │    │    ┌─────────────┐       │
         │    └───┬│   COOLDOWN  │       │
         │        │ │  (3s wait)  │       │
         │        │ └──────┬──────┘       │
         │        │        │ cooldown=0   │
         │        └────────┘              │
         │                                │
         │         ┌─────────────┐        │
         └─────────┤   PAUSED    │────────┘
                   │(bets frozen)│
                   └─────────────┘
                          ▲
                          │ pause_session()
                          │ (from any state)
```

### State Definitions

| State | Description | Allowed Actions | UI State |
|---|---|---|---|
| `IDLE` | No active session | Start session | "Start Game" CTA |
| `INTER-ROUND` | Between rounds, countdown running | Place bets for next round | Countdown timer, bet panel active |
| `GROWING` | Multiplier increasing | Cash out | Live multiplier, cashout button active |
| `CRASHED` | Round ended in crash | None (view only) | Crash animation, results display |
| `CASHED_OUT` | User cashed out | None (view only) | Success animation, winnings display |
| `COOLDOWN` | Brief pause before next round | None | "Next round soon" message |
| `PAUSED` | Session paused by operator | Resume, stop | "Game Paused" overlay |

### Transitions

| From | To | Trigger | Guard |
|---|---|---|---|
| IDLE | INTER-ROUND | `start_session()` | Operator auth |
| INTER-ROUND | GROWING | `countdown === 0` | Auto |
| GROWING | CRASHED | `multiplier >= crash_point` | Auto (server) |
| GROWING | CASHED_OUT | `cashout()` | User has active bet |
| CRASHED | COOLDOWN | `resolve_round()` | Auto |
| CASHED_OUT | COOLDOWN | `resolve_round()` | Auto |
| COOLDOWN | INTER-ROUND | `cooldown === 0` | Auto |
| Any | PAUSED | `pause_session()` | Operator auth |
| PAUSED | INTER-ROUND | `resume_session()` | Operator auth |
| Any | IDLE | `stop_session()` | Operator auth |

## 7.3 Bet Lifecycle State Machine

```
┌─────────────┐
│   DRAFT     │◄── User inputs bet amount
│  (local)    │    and auto-cashout
└──────┬──────┘
       │ place_bet()
       ▼
┌─────────────┐
│  PENDING    │◄── API request in flight
│             │
└──────┬──────┘
       │
   ┌───┴───┐
   │       │
   ▼       ▼
┌──────┐ ┌─────────┐
│PLACED│ │ FAILED  │
│      │ │         │
└──┬───┘ └────┬────┘
   │          │
   │    ┌─────┘
   │    │ show error
   │    ▼
   │ ┌─────────┐
   │ │  DRAFT  │ (return to draft with error)
   │ └─────────┘
   │
   │ round starts
   ▼
┌─────────────┐
│   ACTIVE    │◄── Round is growing
│             │    User can cash out
└──────┬──────┘
       │
   ┌───┴───┐
   │       │
   ▼       ▼
┌──────┐ ┌─────────┐
│WON   │ │ LOST    │
│      │ │         │
└──┬───┘ └────┬────┘
   │          │
   ▼          ▼
┌─────────────┐
│  SETTLED    │◄── Final state, immutable
│             │
└─────────────┘
```

### Bet States

| State | Description | User Action | API Endpoint |
|---|---|---|---|
| `DRAFT` | User composing bet | Edit amount, set auto-cashout | None (local) |
| `PENDING` | Bet submission in progress | Wait | `POST /api/v1/bets` |
| `PLACED` | Bet accepted, waiting for round | Cancel (if allowed) | `DELETE /api/v1/bets/:id` |
| `ACTIVE` | Round active, bet in play | Cash out | `POST /api/v1/bets/:id/cashout` |
| `WON` | Cashed out or auto-cashed out | View details | None |
| `LOST` | Round crashed before cashout | View details | None |
| `CANCELLED` | Cancelled before round start | None | `DELETE /api/v1/bets/:id` |
| `FAILED` | Placement failed | Retry | `POST /api/v1/bets` |

## 7.4 WebSocket Connection Lifecycle

```
App Mount
    │
    ▼
┌─────────────────────────────┐
│ Establish WebSocket         │
│ Connection                  │
│ wss://api.crashwave.io/ws   │
│ Headers: Bearer <JWT>       │
└─────────────┬───────────────┘
              │
              ▼
┌─────────────────────────────┐
│ Connection Opened           │
│ Subscribe to channels:      │
│ - game:<tenant_id>          │
│ - user:<user_id>            │
│ - admin:<tenant_id> (op)    │
└─────────────┬───────────────┘
              │
              ▼
┌─────────────────────────────┐
│ Heartbeat every 30s         │
│ Client → Server: "ping"     │
│ Server → Client: "pong"     │
└─────────────┬───────────────┘
              │
              ▼
        ┌─────┴─────┐
        │           │
        ▼           ▼
┌────────────┐ ┌────────────┐
│ Message    │ │ Disconnect │
│ Received   │ │ Detected   │
└─────┬──────┘ └─────┬──────┘
      │              │
      ▼              ▼
┌────────────┐ ┌────────────┐
│ Route to   │ │ Attempt    │
│ handler    │ │ Reconnect  │
│ Update UI  │ │ Exponential│
└────────────┘ │ backoff    │
               │ (max 5     │
               │  attempts) │
               └─────┬──────┘
                     │
                     ▼
               ┌────────────┐
               │ Max retries│
               │ exceeded   │
               └─────┬──────┘
                     │
                     ▼
               ┌────────────┐
               │ Show       │
               │ "Offline"  │
               │ state      │
               └────────────┘
```

## 7.5 Error Recovery Flows

### 7.5.1 Network Error During Bet Placement

```
User taps "Place Bet"
    │
    ▼
┌─────────────────────────────┐
│ Optimistic UI update        │
│ Show bet as "pending"       │
└─────────────┬───────────────┘
              │
              ▼
┌─────────────────────────────┐
│ API request fails           │
│ (network error / timeout)   │
└─────────────┬───────────────┘
              │
              ▼
┌─────────────────────────────┐
│ 1. Revert optimistic update │
│ 2. Show toast:              │
│    "Network error. Retrying"│
│ 3. Auto-retry (max 3)       │
│    with exponential backoff │
└─────────────┬───────────────┘
              │
    ┌─────────┴─────────┐
    │                   │
    ▼                   ▼
┌────────┐        ┌────────────┐
│ Retry  │        │ All retries│
│ Success│        │ failed     │
└───┬────┘        └─────┬──────┘
    │                   │
    ▼                   ▼
┌─────────────────┐  ┌─────────────────┐
│ Show success    │  │ Show error modal│
│ toast           │  │ "Unable to place│
│                 │  │ bet. Please try │
│                 │  │ again."         │
│                 │  │ [Retry] [Cancel]│
└─────────────────┘  └─────────────────┘
```

### 7.5.2 WebSocket Disconnection During Active Round

```
WebSocket disconnects during GROWING
    │
    ▼
┌─────────────────────────────┐
│ 1. Show "Reconnecting..."   │
│    banner at top            │
│ 2. Freeze multiplier display│
│    (show last known value)  │
│ 3. Attempt reconnect        │
│    (exponential backoff)    │
└─────────────┬───────────────┘
              │
    ┌─────────┴─────────┐
    │                   │
    ▼                   ▼
┌────────┐        ┌────────────┐
│Reconnected│     │Reconnect   │
│within 5s  │     │failed      │
└───┬────┘        └─────┬──────┘
    │                   │
    ▼                   ▼
┌─────────────────┐  ┌─────────────────┐
│ 1. Resync state │  │ 1. Show "Offline│
│    via HTTP API │  │    mode" banner │
│ 2. Resume WS    │  │ 2. Disable bet  │
│    updates      │  │    placement    │
│ 3. Hide banner  │  │ 3. Queue user   │
│                 │  │    actions      │
│                 │  │ 4. Auto-retry   │
│                 │  │    every 10s    │
└─────────────────┘  └─────────────────┘
```

### 7.5.3 Cashout Race Condition

```
User taps "Cash Out" at 2.34x
    │
    ▼
┌─────────────────────────────┐
│ Optimistic: show "Cashing   │
│ out..." state on button     │
│ Disable further taps        │
└─────────────┬───────────────┘
              │
              ▼
┌─────────────────────────────┐
│ Server processes at 2.36x   │
│ (slippage occurred)         │
└─────────────┬───────────────┘
              │
              ▼
┌─────────────────────────────┐
│ Response: {                 │
│   cashedOutAt: 2.36,        │
│   requestedAt: 2.34,        │
│   winnings: 23.60           │
│ }                           │
└─────────────┬───────────────┘
              │
              ▼
┌─────────────────────────────┐
│ UI shows:                   │
│ "Cashed out at 2.36x        │
│  (requested at 2.34x)"      │
│ With info tooltip explaining│
│ slippage                    │
└─────────────────────────────┘
```

## 7.6 Navigation Flows

### 7.6.1 Primary Navigation Flow

```
┌─────────┐     ┌──────────┐     ┌─────────┐     ┌──────────┐
│  Game   │◄───►│ Dashboard│◄───►│ History │◄───►│ Settings │
│   /     │     │/dashboard│     │/history │     │/settings │
└────┬────┘     └────┬─────┘     └────┬────┘     └────┬─────┘
     │               │                │               │
     │         ┌─────┘                │               │
     │         │                      │               │
     │         ▼                      │               │
     │    ┌─────────┐                │               │
     │    │ Control │                │               │
     │    │  /control│               │               │
     │    └────┬────┘                │               │
     │         │                     │               │
     │         ▼                     │               │
     │    ┌─────────┐                │               │
     │    │Analytics│                │               │
     │    │/analytics│               │               │
     │    └─────────┘                │               │
     │                               │               │
     └───────────────────────────────┴───────────────┘
                    (all tabs accessible
                     from bottom nav)
```

### 7.6.2 Modal/Overlay Flows

```
Any Screen
    │
    ├──► Confirmation Modal
    │    (destructive actions)
    │
    ├──► Bottom Sheet
    │    (filters, selectors)
    │
    ├──► Full-Screen Modal
    │    (round details, user profile)
    │
    ├──► Toast Notification
    │    (success/error/info)
    │
    └──► Loading Overlay
         (full-screen blocking)
```

## 7.7 Operator-Specific Flows

### 7.7.1 Session Control Flow

```
Operator navigates to /control
    │
    ▼
┌─────────────────────────────┐
│ Check role in JWT           │
│ role === "operator" ?       │
└─────────────┬───────────────┘
              │
    ┌─────────┴─────────┐
    │                   │
    ▼                   ▼
┌────────┐        ┌────────────┐
│ Yes    │        │ No         │
└───┬────┘        └─────┬──────┘
    │                   │
    ▼                   ▼
┌─────────────────┐  ┌─────────────────┐
│ Load control    │  │ Redirect to     │
│ panel           │  │ /dashboard      │
│ Subscribe to    │  │ Show toast:     │
│ admin WS        │  │ "Unauthorized"  │
└─────────────────┘  └─────────────────┘
```

### 7.7.2 Emergency Stop Flow

```
Operator taps "Emergency Stop"
    │
    ▼
┌─────────────────────────────┐
│ Confirmation modal:         │
│ "This will immediately end  │
│ the current round and       │
│ prevent new bets. All active│
│ bets will be lost.          │
│ Are you sure?"              │
│ [Cancel] [Confirm]          │
└─────────────┬───────────────┘
              │
              ▼
┌─────────────────────────────┐
│ Operator taps "Confirm"     │
│ Require double-tap or       │
│ hold for 2 seconds          │
└─────────────┬───────────────┘
              │
              ▼
┌─────────────────────────────┐
│ POST /api/v1/admin/session/ │
│ emergency                   │
└─────────────┬───────────────┘
              │
              ▼
┌─────────────────────────────┐
│ Server:                     │
│ 1. Set crash_point to       │
│    current multiplier       │
│ 2. Broadcast EMERGENCY_STOP │
│    to all clients           │
│ 3. Log to audit_log         │
│ 4. Update session status    │
└─────────────┬───────────────┘
              │
              ▼
┌─────────────────────────────┐
│ All clients:                │
│ 1. Show emergency overlay   │
│ 2. Disable all interactions │
│ 3. Display "Game paused by  │
│    operator" message        │
└─────────────────────────────┘
```

---

# 8. Technical Requirements

## 8.1 Frontend Stack

### 8.1.1 Core Technologies

| Technology | Version | Purpose |
|---|---|---|
| React | ^18.2.0 | UI framework |
| TypeScript | ^5.3.0 | Type safety |
| Vite | ^5.0.0 | Build tool / dev server |
| Tailwind CSS | ^3.4.0 | Utility-first styling |
| shadcn/ui | latest | Component primitives |
| React Router | ^6.20.0 | Client-side routing |
| TanStack Query | ^5.8.0 | Server state management |
| Zustand | ^4.4.0 | Client state management |
| Socket.io Client | ^4.7.0 | WebSocket communication |
| Recharts | ^2.10.0 | Data visualization |
| date-fns | ^2.30.0 | Date formatting |
| zod | ^3.22.0 | Runtime validation |
| react-hook-form | ^7.48.0 | Form management |
| lucide-react | ^0.294.0 | Icon library |

### 8.1.2 Project Structure

```
mini-app/
├── public/
│   ├── manifest.json           # Telegram Mini App manifest
│   └── icons/
│       ├── icon-192.png
│       └── icon-512.png
├── src/
│   ├── main.tsx                # Entry point
│   ├── App.tsx                 # Root component with providers
│   ├── index.css               # Global styles + CSS variables
│   │
│   ├── api/
│   │   ├── client.ts           # Axios instance with interceptors
│   │   ├── auth.ts             # Auth API endpoints
│   │   ├── game.ts             # Game API endpoints
│   │   ├── bets.ts             # Betting API endpoints
│   │   ├── user.ts             # User API endpoints
│   │   ├── admin.ts            # Admin API endpoints
│   │   ├── analytics.ts        # Analytics API endpoints
│   │   └── websocket.ts        # WebSocket connection manager
│   │
│   ├── components/
│   │   ├── ui/                 # shadcn/ui components (auto-generated)
│   │   ├── layout/
│   │   │   ├── AppLayout.tsx
│   │   │   ├── SafeArea.tsx
│   │   │   ├── Header.tsx
│   │   │   └── BottomTabBar.tsx
│   │   ├── game/
│   │   │   ├── MultiplierDisplay.tsx
│   │   │   ├── BetPanel.tsx
│   │   │   ├── CashoutButton.tsx
│   │   │   ├── HistoryStrip.tsx
│   │   │   └── LiveFeed.tsx
│   │   ├── dashboard/
│   │   │   ├── BalanceCard.tsx
│   │   │   ├── StatCard.tsx
│   │   │   └── ActivityList.tsx
│   │   ├── history/
│   │   │   ├── BetList.tsx
│   │   │   ├── RoundList.tsx
│   │   │   └── FilterBar.tsx
│   │   ├── settings/
│   │   │   ├── ProfileCard.tsx
│   │   │   ├── PreferenceGroup.tsx
│   │   │   └── FairnessVerifier.tsx
│   │   ├── control/
│   │   │   ├── SessionStatus.tsx
│   │   │   ├── SessionControls.tsx
│   │   │   ├── ConfigPanel.tsx
│   │   │   └── EmergencyPanel.tsx
│   │   ├── analytics/
│   │   │   ├── KPICards.tsx
│   │   │   ├── RevenueChart.tsx
│   │   │   ├── DistributionChart.tsx
│   │   │   └── PlayersTable.tsx
│   │   └── shared/
│   │       ├── Toast.tsx
│   │       ├── Skeleton.tsx
│   │       ├── EmptyState.tsx
│   │       ├── ErrorBoundary.tsx
│   │       ├── LoadingOverlay.tsx
│   │       ├── ConfirmationModal.tsx
│   │       ├── BottomSheet.tsx
│   │       └── DataTable.tsx
│   │
│   ├── hooks/
│   │   ├── useTelegram.ts      # WebApp SDK integration
│   │   ├── useAuth.ts          # Authentication state
│   │   ├── useGameState.ts     # Game round state
│   │   ├── useWebSocket.ts     # WebSocket connection
│   │   ├── useBet.ts           # Bet placement/cashout
│   │   ├── useBalance.ts       # Balance updates
│   │   ├── useDebounce.ts      # Input debouncing
│   │   ├── useLocalStorage.ts  # localStorage wrapper
│   │   └── useHaptic.ts        # Haptic feedback helper
│   │
│   ├── stores/
│   │   ├── authStore.ts        # Zustand: auth state
│   │   ├── gameStore.ts        # Zustand: game state
│   │   ├── uiStore.ts          # Zustand: UI state (toasts, modals)
│   │   └── settingsStore.ts    # Zustand: user preferences
│   │
│   ├── providers/
│   │   ├── TelegramProvider.tsx
│   │   ├── AuthProvider.tsx
│   │   ├── QueryProvider.tsx
│   │   ├── WebSocketProvider.tsx
│   │   └── ThemeProvider.tsx
│   │
│   ├── screens/
│   │   ├── GameScreen.tsx
│   │   ├── DashboardScreen.tsx
│   │   ├── HistoryScreen.tsx
│   │   ├── SettingsScreen.tsx
│   │   ├── ControlScreen.tsx
│   │   ├── AnalyticsScreen.tsx
│   │   ├── AdminScreen.tsx
│   │   ├── HealthScreen.tsx
│   │   ├── VerifyScreen.tsx
│   │   └── OnboardingScreen.tsx
│   │
│   ├── types/
│   │   ├── api.ts              # API request/response types
│   │   ├── game.ts             # Game domain types
│   │   ├── user.ts             # User domain types
│   │   ├── telegram.ts         # Telegram WebApp types
│   │   └── websocket.ts        # WebSocket event types
│   │
│   ├── utils/
│   │   ├── formatters.ts       # Number, currency, date formatters
│   │   ├── validators.ts       # Input validation helpers
│   │   ├── constants.ts        # App constants
│   │   └── telegram.ts         # initData parsing, validation
│   │
│   └── lib/
│       └── utils.ts            # cn() helper for Tailwind
│
├── index.html
├── vite.config.ts
├── tailwind.config.js
├── tsconfig.json
├── package.json
└── .env.example
```

## 8.2 Backend API Specification

### 8.2.1 REST API Endpoints

#### Authentication

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| `POST` | `/api/v1/auth/telegram` | Validate initData, issue JWT | None |
| `POST` | `/api/v1/auth/refresh` | Refresh JWT with initData | Bearer (expired OK) |
| `POST` | `/api/v1/auth/logout` | Blacklist JWT | Bearer |
| `GET` | `/api/v1/auth/me` | Get current user | Bearer |

#### Game

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| `GET` | `/api/v1/game/state` | Current round state | Bearer |
| `GET` | `/api/v1/game/config` | Tenant game configuration | Bearer |
| `GET` | `/api/v1/rounds` | Round history (paginated) | Bearer |
| `GET` | `/api/v1/rounds/:id` | Round detail | Bearer |
| `GET` | `/api/v1/rounds/:id/fairness` | Fairness verification data | Bearer |
| `GET` | `/api/v1/rounds/recent` | Last 20 rounds | Bearer |

#### Betting

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| `POST` | `/api/v1/bets` | Place a bet | Bearer |
| `POST` | `/api/v1/bets/:id/cashout` | Cash out active bet | Bearer |
| `DELETE` | `/api/v1/bets/:id` | Cancel pending bet | Bearer |
| `GET` | `/api/v1/bets` | User bet history (paginated) | Bearer |
| `GET` | `/api/v1/bets/:id` | Bet detail | Bearer |

#### User

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| `GET` | `/api/v1/users/me` | Current user profile | Bearer |
| `PUT` | `/api/v1/users/me` | Update profile | Bearer |
| `GET` | `/api/v1/users/me/stats` | User statistics | Bearer |
| `GET` | `/api/v1/users/me/activity` | Recent activity | Bearer |
| `PUT` | `/api/v1/users/me/preferences` | Update preferences | Bearer |

#### Admin (Operator Only)

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| `GET` | `/api/v1/admin/session` | Session status | Bearer + Operator |
| `POST` | `/api/v1/admin/session/start` | Start session | Bearer + Operator |
| `POST` | `/api/v1/admin/session/pause` | Pause session | Bearer + Operator |
| `POST` | `/api/v1/admin/session/resume` | Resume session | Bearer + Operator |
| `POST` | `/api/v1/admin/session/stop` | Stop session | Bearer + Operator |
| `POST` | `/api/v1/admin/session/emergency` | Emergency stop | Bearer + Operator |
| `GET` | `/api/v1/admin/config` | Current configuration | Bearer + Operator |
| `PUT` | `/api/v1/admin/config` | Update configuration | Bearer + Operator |
| `GET` | `/api/v1/admin/tenant` | Tenant settings | Bearer + Operator |
| `PUT` | `/api/v1/admin/tenant` | Update tenant | Bearer + Operator |
| `GET` | `/api/v1/admin/users` | User list (paginated) | Bearer + Operator |
| `GET` | `/api/v1/admin/audit` | Audit logs (paginated) | Bearer + Operator |

#### Analytics (Operator Only)

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| `GET` | `/api/v1/analytics/overview` | KPI overview | Bearer + Operator |
| `GET` | `/api/v1/analytics/revenue` | Revenue time series | Bearer + Operator |
| `GET` | `/api/v1/analytics/distribution` | Multiplier distribution | Bearer + Operator |
| `GET` | `/api/v1/analytics/players` | Top players | Bearer + Operator |
| `GET` | `/api/v1/analytics/export` | Export data (CSV/JSON) | Bearer + Operator |

#### Health

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| `GET` | `/api/v1/health` | System health status | Bearer + Operator |

### 8.2.2 Request/Response Types

#### Auth

```typescript
// POST /api/v1/auth/telegram
interface TelegramAuthRequest {
  initData: string;
}

interface TelegramAuthResponse {
  token: string;
  expiresAt: string; // ISO 8601
  user: {
    id: number;
    telegramId: number;
    username: string;
    firstName: string;
    lastName?: string;
    avatarUrl?: string;
    role: 'user' | 'operator';
    createdAt: string;
  };
  tenant: {
    id: string;
    name: string;
    currency: string;
    minBet: number;
    maxBet: number;
    maxMultiplier: number;
    houseEdge: number;
    theme?: {
      primaryColor?: string;
      logoUrl?: string;
    };
  };
}

// POST /api/v1/auth/refresh
interface RefreshRequest {
  initData: string;
}

interface RefreshResponse {
  token: string;
  expiresAt: string;
}
```

#### Game State

```typescript
// GET /api/v1/game/state
interface GameStateResponse {
  sessionId: string;
  roundId: number;
  phase: 'inter_round' | 'growing' | 'crashed' | 'cooldown' | 'paused';
  multiplier: number;
  crashPoint?: number;
  elapsedMs: number;
  countdownMs?: number;
  totalBets: number;
  totalBetAmount: number;
  activePlayers: number;
  nextRoundAt?: string;
}

// GET /api/v1/rounds/:id
interface RoundDetailResponse {
  id: number;
  sessionId: string;
  crashPoint: number;
  totalBets: number;
  totalBetAmount: number;
  totalPayout: number;
  startedAt: string;
  crashedAt: string;
  durationMs: number;
  fairness: {
    serverSeedHash: string;
    serverSeed?: string; // revealed after round
    nonce: number;
  };
  bets: BetDetail[];
}
```

#### Betting

```typescript
// POST /api/v1/bets
interface PlaceBetRequest {
  amount: number;
  autoCashoutAt?: number;
}

interface PlaceBetResponse {
  id: string;
  roundId: number;
  amount: number;
  autoCashoutAt?: number;
  status: 'placed' | 'active' | 'won' | 'lost' | 'cancelled';
  placedAt: string;
}

// POST /api/v1/bets/:id/cashout
interface CashoutResponse {
  id: string;
  cashedOutAt: number;
  winnings: number;
  multiplier: number;
}
```

### 8.2.3 Error Response Format

```typescript
interface ApiError {
  status: number;
  code: string;
  message: string;
  details?: Record<string, string[]>;
  timestamp: string;
  requestId: string;
}

// Example: 400 Bad Request
{
  "status": 400,
  "code": "VALIDATION_ERROR",
  "message": "Invalid bet amount",
  "details": {
    "amount": ["Must be between 1 and 1000"]
  },
  "timestamp": "2024-01-15T10:30:00Z",
  "requestId": "req_abc123"
}

// Example: 401 Unauthorized
{
  "status": 401,
  "code": "TOKEN_EXPIRED",
  "message": "Authentication token has expired",
  "timestamp": "2024-01-15T10:30:00Z",
  "requestId": "req_def456"
}

// Example: 403 Forbidden
{
  "status": 403,
  "code": "INSUFFICIENT_ROLE",
  "message": "Operator role required",
  "timestamp": "2024-01-15T10:30:00Z",
  "requestId": "req_ghi789"
}

// Example: 429 Too Many Requests
{
  "status": 429,
  "code": "RATE_LIMITED",
  "message": "Too many requests. Try again in 30 seconds.",
  "timestamp": "2024-01-15T10:30:00Z",
  "requestId": "req_jkl012"
}
```

## 8.3 WebSocket Protocol

### 8.3.1 Connection

```
URL: wss://api.crashwave.io/ws/v1
Protocol: Socket.io v4

Headers:
  Authorization: Bearer <JWT>
  X-Tenant-ID: <tenant_id>
```

### 8.3.2 Client → Server Events

| Event | Payload | Description |
|---|---|---|
| `subscribe` | `{ channels: string[] }` | Subscribe to channels |
| `unsubscribe` | `{ channels: string[] }` | Unsubscribe from channels |
| `ping` | `{}` | Heartbeat ping |
| `bet` | `{ amount: number, autoCashoutAt?: number }` | Place bet via WS |
| `cashout` | `{ betId: string }` | Cash out via WS |

### 8.3.3 Server → Client Events

| Event | Payload | Description |
|---|---|---|
| `pong` | `{}` | Heartbeat response |
| `game:state` | `GameState` | Current game state update |
| `game:multiplier` | `{ multiplier: number, velocity: number }` | Multiplier tick |
| `game:round_start` | `{ roundId: number, startedAt: string }` | New round started |
| `game:round_end` | `{ roundId: number, crashPoint: number }` | Round ended |
| `game:countdown` | `{ seconds: number }` | Countdown tick |
| `bet:placed` | `BetDetail` | Bet confirmed |
| `bet:cashed_out` | `{ betId: string, multiplier: number, winnings: number }` | Cashout confirmed |
| `bet:cancelled` | `{ betId: string }` | Bet cancelled |
| `feed:entry` | `LiveFeedEntry` | New live feed entry |
| `user:balance` | `{ balance: number, change: number }` | Balance update |
| `admin:session` | `{ action: string, data: any }` | Admin session event |
| `admin:config` | `{ key: string, value: any }` | Config change event |
| `system:notification` | `{ type: string, message: string }` | System notification |
| `error` | `{ code: string, message: string }` | Error event |

### 8.3.4 Channel Subscriptions

| Channel | Pattern | Access |
|---|---|---|
| `game:<tenant_id>` | Game state for tenant | All users |
| `user:<user_id>` | User-specific events | Authenticated user |
| `admin:<tenant_id>` | Admin events | Operators only |
| `system:<tenant_id>` | System notifications | All users |

## 8.4 State Management Architecture

### 8.4.1 Zustand Stores

```typescript
// stores/authStore.ts
interface AuthState {
  token: string | null;
  user: User | null;
  tenant: Tenant | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  login: (initData: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  setUser: (user: User) => void;
}

// stores/gameStore.ts
interface GameState {
  phase: GamePhase;
  multiplier: number;
  roundId: number | null;
  countdown: number | null;
  activeBet: Bet | null;
  recentRounds: Round[];
  liveFeed: LiveFeedEntry[];
  isConnected: boolean;

  setPhase: (phase: GamePhase) => void;
  setMultiplier: (value: number) => void;
  setActiveBet: (bet: Bet | null) => void;
  addFeedEntry: (entry: LiveFeedEntry) => void;
  setConnected: (connected: boolean) => void;
}

// stores/uiStore.ts
interface UIState {
  toasts: Toast[];
  modal: Modal | null;
  isLoading: boolean;
  bottomNavVisible: boolean;

  showToast: (toast: Omit<Toast, 'id'>) => void;
  hideToast: (id: string) => void;
  showModal: (modal: Modal) => void;
  hideModal: () => void;
  setLoading: (loading: boolean) => void;
  setBottomNavVisible: (visible: boolean) => void;
}
```

### 8.4.2 TanStack Query Configuration

```typescript
// Query client configuration
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,        // 30 seconds
      gcTime: 5 * 60 * 1000,       // 5 minutes
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: 1,
      retryDelay: 1000,
    },
  },
});

// Key patterns
const queryKeys = {
  auth: ['auth'] as const,
  user: (id: number) => ['user', id] as const,
  game: {
    state: ['game', 'state'] as const,
    config: ['game', 'config'] as const,
  },
  rounds: {
    all: (filters: RoundFilters) => ['rounds', filters] as const,
    detail: (id: number) => ['rounds', id] as const,
    recent: ['rounds', 'recent'] as const,
  },
  bets: {
    all: (filters: BetFilters) => ['bets', filters] as const,
    detail: (id: string) => ['bets', id] as const,
  },
  analytics: {
    overview: (range: TimeRange) => ['analytics', 'overview', range] as const,
    revenue: (range: TimeRange) => ['analytics', 'revenue', range] as const,
  },
};
```

## 8.5 Telegram WebApp SDK Integration

### 8.5.1 Initialization

```typescript
// hooks/useTelegram.ts
export function useTelegram() {
  const [webApp, setWebApp] = useState<WebApp | null>(null);

  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (tg) {
      tg.ready();
      tg.expand();
      tg.enableClosingConfirmation();

      // Set theme
      document.documentElement.style.setProperty(
        '--tg-theme-bg-color', 
        tg.themeParams.bg_color
      );
      document.documentElement.style.setProperty(
        '--tg-theme-text-color', 
        tg.themeParams.text_color
      );
      // ... other theme variables

      setWebApp(tg);
    }
  }, []);

  return {
    webApp,
    initData: webApp?.initData,
    initDataUnsafe: webApp?.initDataUnsafe,
    user: webApp?.initDataUnsafe?.user,
    themeParams: webApp?.themeParams,
    isReady: !!webApp,

    // Helpers
    hapticImpact: (style: ImpactStyle) => 
      webApp?.HapticFeedback.impactOccurred(style),
    hapticNotification: (type: NotificationType) => 
      webApp?.HapticFeedback.notificationOccurred(type),
    showPopup: (params: PopupParams) => 
      webApp?.showPopup(params),
    showConfirm: (message: string) => 
      webApp?.showConfirm(message),
    close: () => webApp?.close(),
  };
}
```

### 8.5.2 initData Validation (Client-Side)

```typescript
// utils/telegram.ts
export function parseInitData(initData: string): InitData {
  const params = new URLSearchParams(initData);
  const result: Record<string, any> = {};

  for (const [key, value] of params) {
    try {
      result[key] = JSON.parse(value);
    } catch {
      result[key] = value;
    }
  }

  return result as InitData;
}

export function extractInitData(): string | null {
  // From URL hash (Telegram sends initData in URL)
  const hash = window.location.hash.slice(1);
  if (hash) return decodeURIComponent(hash);

  // From Telegram WebApp object
  if (window.Telegram?.WebApp?.initData) {
    return window.Telegram.WebApp.initData;
  }

  return null;
}
```

## 8.6 Responsive Behavior

### 8.6.1 Breakpoints

```css
/* Tailwind breakpoints */
sm: 640px   /* Small tablets */
md: 768px   /* Tablets */
lg: 1024px  /* Small desktops (not applicable) */
```

### 8.6.2 Mobile-First Constraints

The Mini App is designed exclusively for mobile viewport sizes (320px - 480px). The Telegram Mini App container on mobile devices has these characteristics:

| Property | Value |
|---|---|
| Viewport width | 100% of device width |
| Viewport height | 100% of device height minus Telegram chrome |
| Safe area top | `env(safe-area-inset-top)` |
| Safe area bottom | `env(safe-area-inset-bottom)` |
| Overflow | Hidden (no body scroll) |
| Touch action | Pan-y (vertical scroll only within containers) |

### 8.6.3 Layout Adaptations

```typescript
// hooks/useViewport.ts
export function useViewport() {
  const [viewport, setViewport] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
    isMobile: window.innerWidth < 480,
    isTablet: window.innerWidth >= 480 && window.innerWidth < 768,
  });

  useEffect(() => {
    const handleResize = () => {
      setViewport({
        width: window.innerWidth,
        height: window.innerHeight,
        isMobile: window.innerWidth < 480,
        isTablet: window.innerWidth >= 480 && window.innerWidth < 768,
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return viewport;
}
```

---

# 9. Security & Performance Requirements

## 9.1 Security Requirements

### 9.1.1 Authentication & Authorization

| Requirement | Implementation | Priority |
|---|---|---|
| **initData Validation** | Server must validate HMAC-SHA256 signature of Telegram initData using BOT_TOKEN. Reject if auth_date > 24 hours old. | P0 |
| **JWT Signing** | Use RS256 (asymmetric) or HS256 (symmetric with strong secret). Secrets must be >= 256 bits. | P0 |
| **JWT Expiry** | Access tokens expire after 7 days. Refresh tokens expire after 30 days. | P0 |
| **JWT Blacklist** | On logout, store JWT jti in Redis with TTL matching token expiry. Check blacklist on every request. | P1 |
| **Role-Based Access** | Middleware checks `role` claim in JWT. Operators (`role: "operator"`) only for admin endpoints. | P0 |
| **Secure Token Storage** | Store JWT in `localStorage` (Mini App constraint). Clear on logout, app close, or token expiry. | P1 |
| **Token Refresh** | Silent refresh before expiry (when < 1 hour remaining). Fallback to re-auth with initData. | P1 |

### 9.1.2 API Security

| Requirement | Implementation | Priority |
|---|---|---|
| **Rate Limiting** | Implement per-user rate limiting: 60 requests/minute general, 10 bets/minute, 5 cashouts/minute. Use Redis for distributed rate limiting. | P0 |
| **Input Validation** | All inputs validated with Zod schemas. Reject malformed data with 400 and detailed error messages. | P0 |
| **SQL Injection Prevention** | Use parameterized queries exclusively. No string concatenation in SQL. | P0 |
| **CORS Configuration** | Allow only `https://*.telegram-web-app.com` and `https://t.me` origins in production. | P0 |
| **HTTPS Enforcement** | Redirect all HTTP traffic to HTTPS. HSTS header with max-age 31536000. | P0 |
| **Content Security Policy** | `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self' wss:;` | P1 |
| **Request ID Tracking** | Generate UUID request ID per request. Include in logs and response headers for traceability. | P1 |

### 9.1.3 WebSocket Security

| Requirement | Implementation | Priority |
|---|---|---|
| **Auth on Connect** | Reject WebSocket connections without valid JWT in handshake headers. | P0 |
| **Channel Authorization** | Verify user has access to requested channels. Operators only for `admin:*` channels. | P0 |
| **Message Rate Limiting** | Limit messages per connection: 30/minute general, 5/minute for bets. | P1 |
| **Payload Size Limit** | Reject WebSocket messages > 10KB. | P1 |
| **Connection Limits** | Max 1 WebSocket connection per user. Close existing on new connection. | P1 |

### 9.1.4 Data Protection

| Requirement | Implementation | Priority |
|---|---|---|
| **Sensitive Data Logging** | Never log JWT tokens, initData, passwords, or payment info. Mask user IDs in logs. | P0 |
| **Database Encryption** | Encrypt PII at rest (user names, Telegram IDs). Use PostgreSQL pgcrypto. | P1 |
| **Backup Encryption** | Encrypt database backups. Store encryption keys in separate vault. | P1 |
| **Audit Logging** | Log all admin actions, bet placements, cashouts, config changes to `audit_log` table. | P0 |

### 9.1.5 Telegram-Specific Security

| Requirement | Implementation | Priority |
|---|---|---|
| **Bot Token Protection** | Store BOT_TOKEN in environment variable. Never commit to repository. Rotate quarterly. | P0 |
| **Webhook Verification** | Verify Telegram webhook requests using secret token in header. | P0 |
| **Mini App URL Validation** | Ensure Mini App URL uses HTTPS and matches registered domain with BotFather. | P1 |

## 9.2 Performance Requirements

### 9.2.1 Frontend Performance

| Metric | Target | Measurement |
|---|---|---|
| **First Contentful Paint (FCP)** | < 1.5s | Lighthouse |
| **Largest Contentful Paint (LCP)** | < 2.5s | Lighthouse |
| **Time to Interactive (TTI)** | < 3.5s | Lighthouse |
| **Cumulative Layout Shift (CLS)** | < 0.1 | Lighthouse |
| **Bundle Size (initial)** | < 200KB gzipped | webpack-bundle-analyzer |
| **Bundle Size (total)** | < 500KB gzipped | webpack-bundle-analyzer |
| **WebSocket Latency** | < 100ms (p95) | Client timing |
| **API Response Time** | < 200ms (p95) | Server logs |

### 9.2.2 Optimization Strategies

#### Code Splitting
```typescript
// Route-based lazy loading
const GameScreen = lazy(() => import('./screens/GameScreen'));
const DashboardScreen = lazy(() => import('./screens/DashboardScreen'));
const ControlScreen = lazy(() => import('./screens/ControlScreen'));

// Component-based lazy loading
const RevenueChart = lazy(() => import('./components/analytics/RevenueChart'));
```

#### Tree Shaking
- Import only used icons from `lucide-react`: `import { Home, Gamepad2 } from 'lucide-react'`
- Import only used Recharts components: `import { LineChart, Line } from 'recharts'`
- Use `date-fns` modular imports: `import { format } from 'date-fns'`

#### Asset Optimization
- Serve static assets via CDN with far-future cache headers
- Use WebP for images with JPEG fallback
- Inline critical CSS (< 14KB)
- Preload essential fonts and icons

#### Caching Strategy
```typescript
// Service Worker for offline support
// vite-plugin-pwa configuration
const pwaConfig = {
  registerType: 'autoUpdate',
  workbox: {
    globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
    runtimeCaching: [
      {
        urlPattern: /^https:\/\/api\.crashwave\.io\/api\/v1\/game\/config/,
        handler: 'CacheFirst',
        options: { cacheName: 'game-config', expiration: { maxAgeSeconds: 3600 } },
      },
      {
        urlPattern: /^https:\/\/api\.crashwave\.io\/api\/v1\/rounds\/recent/,
        handler: 'StaleWhileRevalidate',
        options: { cacheName: 'recent-rounds', expiration: { maxEntries: 50 } },
      },
    ],
  },
};
```

### 9.2.3 Backend Performance

| Metric | Target | Implementation |
|---|---|---|
| **API Response Time (p50)** | < 50ms | Connection pooling, query optimization |
| **API Response Time (p95)** | < 200ms | Redis caching, DB indexes |
| **API Response Time (p99)** | < 500ms | Circuit breakers, graceful degradation |
| **WebSocket Broadcast Latency** | < 50ms | In-memory pub/sub with Redis adapter |
| **Database Query Time** | < 10ms | Proper indexing, query optimization |
| **Concurrent Connections** | 10,000+ | Horizontal scaling, load balancing |

### 9.2.4 Database Optimization

#### Required Indexes
```sql
-- Existing indexes (from migrations)
CREATE INDEX idx_bets_user_id ON bets(user_id);
CREATE INDEX idx_bets_round_id ON bets(round_id);
CREATE INDEX idx_bets_created_at ON bets(created_at);
CREATE INDEX idx_rounds_tenant_id ON rounds(tenant_id);
CREATE INDEX idx_rounds_created_at ON rounds(created_at);
CREATE INDEX idx_sessions_tenant_id ON sessions(tenant_id);
CREATE INDEX idx_sessions_status ON sessions(status);

-- Additional indexes needed for Mini App
CREATE INDEX idx_bets_user_status ON bets(user_id, status) 
  WHERE status IN ('placed', 'active');
CREATE INDEX idx_rounds_tenant_created ON rounds(tenant_id, created_at DESC);
CREATE INDEX idx_bets_user_created ON bets(user_id, created_at DESC);
CREATE INDEX idx_audit_log_tenant_created ON audit_log(tenant_id, created_at DESC);
CREATE INDEX idx_ledger_user_created ON financial_ledger(user_id, created_at DESC);
CREATE INDEX idx_analytics_snapshots_tenant_time ON analytics_snapshots(tenant_id, snapshot_time DESC);
```

#### Query Optimization
- Use `SELECT` with explicit columns (no `SELECT *`)
- Paginate all list endpoints with cursor-based pagination
- Cache frequent queries in Redis (game config, recent rounds)
- Use materialized views for analytics aggregations

### 9.2.5 Redis Caching Strategy

| Cache Key | TTL | Invalidation |
|---|---|---|
| `tenant:config:<id>` | 5 minutes | On config update |
| `game:state:<tenant_id>` | 1 second | On every state change |
| `user:balance:<id>` | 5 seconds | On bet/cashout |
| `rounds:recent:<tenant_id>` | 10 seconds | On round end |
| `analytics:overview:<tenant_id>:<range>` | 1 minute | On new round |
| `rate_limit:<user_id>` | 1 minute | Auto-expire |
| `jwt:blacklist:<jti>` | Token expiry | On logout |

## 9.3 Accessibility Requirements

### 9.3.1 WCAG 2.1 Level AA Compliance

| Requirement | Implementation |
|---|---|
| **Color Contrast** | All text meets 4.5:1 ratio. Large text (18px+) meets 3:1. |
| **Touch Targets** | Minimum 44x44 CSS pixels for all interactive elements. |
| **Focus Indicators** | Visible focus rings on all focusable elements. |
| **Screen Reader Labels** | `aria-label` on all icon buttons. `aria-live` on dynamic content. |
| **Semantic HTML** | Use `<button>`, `<nav>`, `<main>`, `<header>`, `<footer>` appropriately. |
| **Alt Text** | Descriptive alt text on all images. Decorative images have empty alt. |
| **Reduced Motion** | Respect `prefers-reduced-motion`. Disable animations when set. |

### 9.3.2 Telegram Accessibility

```typescript
// Respect Telegram's accessibility settings
useEffect(() => {
  const tg = window.Telegram?.WebApp;
  if (tg?.colorScheme === 'dark') {
    document.documentElement.classList.add('dark');
  }

  // Reduced motion
  const prefersReducedMotion = window.matchMedia(
    '(prefers-reduced-motion: reduce)'
  ).matches;
  if (prefersReducedMotion) {
    document.documentElement.classList.add('reduce-motion');
  }
}, []);
```

---

# 10. File-Level Implementation Plan

## 10.1 Phase 1: Backend API Foundation (Week 1)

### 10.1.1 New Files to Create

```
src/api/
├── middleware/
│   ├── auth.ts              # JWT validation middleware
│   ├── rate-limit.ts        # Rate limiting middleware
│   ├── error-handler.ts     # Global error handler
│   ├── cors.ts              # CORS configuration
│   └── role-guard.ts        # Role-based access control
├── routes/
│   ├── auth.ts              # Auth endpoints
│   ├── game.ts              # Game state endpoints
│   ├── bets.ts              # Betting endpoints
│   ├── user.ts              # User endpoints
│   ├── admin.ts             # Admin endpoints
│   ├── analytics.ts         # Analytics endpoints
│   └── health.ts            # Health check endpoint
├── validators/
│   ├── auth.ts              # Auth request validation (Zod)
│   ├── bets.ts              # Bet request validation
│   ├── user.ts              # User request validation
│   └── admin.ts             # Admin request validation
├── websocket/
│   ├── server.ts            # Socket.io server setup
│   ├── auth.ts              # WS authentication
│   ├── channels.ts          # Channel subscription logic
│   ├── handlers/
│   │   ├── game.ts          # Game event handlers
│   │   ├── bets.ts          # Bet WS handlers
│   │   └── admin.ts         # Admin WS handlers
│   └── broadcast.ts         # Broadcast utilities
└── types/
    └── api.ts               # Shared API types
```

### 10.1.2 Existing Files to Modify

| File | Changes | Lines |
|---|---|---|
| `src/index.ts` | Add API routes registration, WebSocket server initialization, CORS setup | +80 |
| `src/app/composition.ts` | Register new API services (AuthService, WebSocketService, RateLimitService) | +40 |
| `src/telegram/auth.ts` | Export `validateInitData()` function for reuse in API auth | +20 |
| `src/config/schema.ts` | Add `JWT_SECRET`, `JWT_EXPIRY`, `RATE_LIMIT_*` env vars | +15 |
| `src/config/defaults.ts` | Add default values for new config options | +10 |
| `docker-compose.yml` | Add Mini App static file serving, Caddy/nginx reverse proxy | +30 |

### 10.1.3 Acceptance Criteria

- [ ] `POST /api/v1/auth/telegram` validates initData and returns JWT
- [ ] `GET /api/v1/game/state` returns current round state
- [ ] `POST /api/v1/bets` places bet with validation
- [ ] `POST /api/v1/bets/:id/cashout` processes cashout
- [ ] WebSocket server accepts connections with JWT auth
- [ ] Rate limiting blocks excessive requests
- [ ] CORS allows Telegram Mini App origins
- [ ] All endpoints return proper error responses

## 10.2 Phase 2: Telegram Bot Integration (Week 1-2)

### 10.2.1 New Files to Create

```
src/telegram/
├── mini-app.ts              # Mini App menu button setup
└── webapp-handler.ts        # Handle web_app_data messages
```

### 10.2.2 Existing Files to Modify

| File | Changes | Lines |
|---|---|---|
| `src/telegram/gateway.ts` | Add `setWebAppMenuButton()` call on bot startup, handle `web_app_data` messages | +25 |
| `src/telegram/router.ts` | Add `/miniapp` command to open Mini App | +15 |
| `src/platform/control-plane.ts` | Store Mini App URL in tenant settings | +10 |

### 10.2.3 Acceptance Criteria

- [ ] Bot sets `web_app` menu button pointing to Mini App URL
- [ ] `/miniapp` command opens Mini App
- [ ] `web_app_data` messages are parsed and logged
- [ ] Tenant onboarding includes Mini App URL configuration

## 10.3 Phase 3: Mini App Frontend Core (Week 2-3)

### 10.3.1 New Files to Create

```
mini-app/                      # New project root
├── public/
│   ├── manifest.json
│   └── icons/
│       ├── icon-192.png
│       └── icon-512.png
├── index.html
├── vite.config.ts
├── tailwind.config.js
├── tsconfig.json
├── package.json
└── src/
    ├── main.tsx
    ├── App.tsx
    ├── index.css
    ├── api/
    │   ├── client.ts
    │   ├── auth.ts
    │   ├── game.ts
    │   ├── bets.ts
    │   ├── user.ts
    │   ├── admin.ts
    │   ├── analytics.ts
    │   └── websocket.ts
    ├── components/
    │   ├── layout/
    │   │   ├── AppLayout.tsx
    │   │   ├── SafeArea.tsx
    │   │   ├── Header.tsx
    │   │   └── BottomTabBar.tsx
    │   ├── game/
    │   │   ├── MultiplierDisplay.tsx
    │   │   ├── BetPanel.tsx
    │   │   ├── CashoutButton.tsx
    │   │   ├── HistoryStrip.tsx
    │   │   └── LiveFeed.tsx
    │   ├── dashboard/
    │   │   ├── BalanceCard.tsx
    │   │   ├── StatCard.tsx
    │   │   └── ActivityList.tsx
    │   ├── history/
    │   │   ├── BetList.tsx
    │   │   ├── RoundList.tsx
    │   │   └── FilterBar.tsx
    │   ├── settings/
    │   │   ├── ProfileCard.tsx
    │   │   ├── PreferenceGroup.tsx
    │   │   └── FairnessVerifier.tsx
    │   ├── control/
    │   │   ├── SessionStatus.tsx
    │   │   ├── SessionControls.tsx
    │   │   ├── ConfigPanel.tsx
    │   │   └── EmergencyPanel.tsx
    │   ├── analytics/
    │   │   ├── KPICards.tsx
    │   │   ├── RevenueChart.tsx
    │   │   ├── DistributionChart.tsx
    │   │   └── PlayersTable.tsx
    │   └── shared/
    │       ├── Toast.tsx
    │       ├── Skeleton.tsx
    │       ├── EmptyState.tsx
    │       ├── ErrorBoundary.tsx
    │       ├── LoadingOverlay.tsx
    │       ├── ConfirmationModal.tsx
    │       ├── BottomSheet.tsx
    │       └── DataTable.tsx
    ├── hooks/
    │   ├── useTelegram.ts
    │   ├── useAuth.ts
    │   ├── useGameState.ts
    │   ├── useWebSocket.ts
    │   ├── useBet.ts
    │   ├── useBalance.ts
    │   ├── useDebounce.ts
    │   ├── useLocalStorage.ts
    │   └── useHaptic.ts
    ├── stores/
    │   ├── authStore.ts
    │   ├── gameStore.ts
    │   ├── uiStore.ts
    │   └── settingsStore.ts
    ├── providers/
    │   ├── TelegramProvider.tsx
    │   ├── AuthProvider.tsx
    │   ├── QueryProvider.tsx
    │   ├── WebSocketProvider.tsx
    │   └── ThemeProvider.tsx
    ├── screens/
    │   ├── GameScreen.tsx
    │   ├── DashboardScreen.tsx
    │   ├── HistoryScreen.tsx
    │   ├── SettingsScreen.tsx
    │   ├── ControlScreen.tsx
    │   ├── AnalyticsScreen.tsx
    │   ├── AdminScreen.tsx
    │   ├── HealthScreen.tsx
    │   ├── VerifyScreen.tsx
    │   └── OnboardingScreen.tsx
    ├── types/
    │   ├── api.ts
    │   ├── game.ts
    │   ├── user.ts
    │   ├── telegram.ts
    │   └── websocket.ts
    ├── utils/
    │   ├── formatters.ts
    │   ├── validators.ts
    │   ├── constants.ts
    │   └── telegram.ts
    └── lib/
        └── utils.ts
```

### 10.3.2 Existing Files to Modify

| File | Changes | Lines |
|---|---|---|
| `docker-compose.yml` | Add `mini-app` service for static file serving | +20 |
| `Dockerfile` | Add multi-stage build for Mini App (optional) | +15 |
| `package.json` (root) | Add workspace or build scripts for Mini App | +10 |

### 10.3.3 Acceptance Criteria

- [ ] Mini App builds successfully with Vite
- [ ] All 10 screens render without errors
- [ ] Bottom tab navigation works
- [ ] Telegram WebApp SDK initializes correctly
- [ ] Theme adapts to Telegram light/dark mode
- [ ] Safe areas respected on iPhone/notch devices

## 10.4 Phase 4: Game Screen & Real-Time Integration (Week 3-4)

### 10.4.1 New Files to Create

```
mini-app/src/
├── components/game/
│   ├── MultiplierDisplay.tsx      # Animated multiplier with phase states
│   ├── BetPanel.tsx               # Bet amount input + place button
│   ├── CashoutButton.tsx          # Cashout with live PnL
│   ├── HistoryStrip.tsx           # Horizontal scroll of recent rounds
│   └── LiveFeed.tsx               # Real-time bet feed
└── hooks/
    ├── useGameState.ts            # Game phase + multiplier state
    ├── useBet.ts                  # Bet placement + cashout
    └── useWebSocket.ts            # WebSocket connection management
```

### 10.4.2 Existing Files to Modify

| File | Changes | Lines |
|---|---|---|
| `src/core/session-supervisor.ts` | Emit WebSocket events on state changes | +30 |
| `src/betting/betting-coordinator.ts` | Emit WS events on bet/cashout | +20 |
| `src/api/websocket/handlers/game.ts` | Broadcast game state updates | +40 |
| `src/api/websocket/handlers/bets.ts` | Broadcast bet events | +25 |

### 10.4.3 Acceptance Criteria

- [ ] Multiplier animates smoothly during GROWING phase
- [ ] Bet placement works with optimistic UI
- [ ] Cashout works with slippage handling
- [ ] Live feed updates in real-time
- [ ] History strip shows recent rounds
- [ ] WebSocket reconnects automatically on disconnect
- [ ] Haptic feedback on multiplier milestones

## 10.5 Phase 5: Dashboard, History, Settings (Week 4)

### 10.5.1 New Files to Create

```
mini-app/src/
├── components/dashboard/
│   ├── BalanceCard.tsx
│   ├── StatCard.tsx
│   └── ActivityList.tsx
├── components/history/
│   ├── BetList.tsx
│   ├── RoundList.tsx
│   └── FilterBar.tsx
├── components/settings/
│   ├── ProfileCard.tsx
│   ├── PreferenceGroup.tsx
│   └── FairnessVerifier.tsx
└── screens/
    ├── DashboardScreen.tsx
    ├── HistoryScreen.tsx
    └── SettingsScreen.tsx
```

### 10.5.2 Existing Files to Modify

| File | Changes | Lines |
|---|---|---|
| `src/api/routes/user.ts` | Add `/users/me/stats` and `/users/me/activity` endpoints | +30 |
| `src/api/routes/game.ts` | Add `/rounds` and `/rounds/:id` endpoints | +25 |
| `src/persistence/repositories/bet-repo.ts` | Add methods for user bet history queries | +20 |

### 10.5.3 Acceptance Criteria

- [ ] Dashboard shows balance, stats, and recent activity
- [ ] History screen supports filtering and pagination
- [ ] Settings screen allows preference updates
- [ ] Fairness verification works with client-side hash check
- [ ] All screens have loading and empty states

## 10.6 Phase 6: Operator Screens (Week 5)

### 10.6.1 New Files to Create

```
mini-app/src/
├── components/control/
│   ├── SessionStatus.tsx
│   ├── SessionControls.tsx
│   ├── ConfigPanel.tsx
│   └── EmergencyPanel.tsx
├── components/analytics/
│   ├── KPICards.tsx
│   ├── RevenueChart.tsx
│   ├── DistributionChart.tsx
│   └── PlayersTable.tsx
└── screens/
    ├── ControlScreen.tsx
    ├── AnalyticsScreen.tsx
    ├── AdminScreen.tsx
    └── HealthScreen.tsx
```

### 10.6.2 Existing Files to Modify

| File | Changes | Lines |
|---|---|---|
| `src/api/routes/admin.ts` | Implement all admin endpoints | +80 |
| `src/api/routes/analytics.ts` | Implement analytics endpoints | +50 |
| `src/api/routes/health.ts` | Implement health check endpoint | +20 |
| `src/platform/control-plane.ts` | Expose session control methods | +15 |
| `src/analytics/engine.ts` | Add API-facing query methods | +25 |

### 10.6.3 Acceptance Criteria

- [ ] Control panel shows session status and controls
- [ ] Start/pause/stop/emergency actions work
- [ ] Analytics shows KPIs, charts, and tables
- [ ] Admin screen allows tenant configuration
- [ ] Health screen shows system status
- [ ] All operator screens are role-guarded

## 10.7 Phase 7: Polish & Production Readiness (Week 5-6)

### 10.7.1 New Files to Create

```
mini-app/src/
├── components/shared/
│   ├── Toast.tsx
│   ├── Skeleton.tsx
│   ├── EmptyState.tsx
│   ├── ErrorBoundary.tsx
│   ├── LoadingOverlay.tsx
│   ├── ConfirmationModal.tsx
│   └── BottomSheet.tsx
└── screens/
    └── OnboardingScreen.tsx
```

### 10.7.2 Existing Files to Modify

| File | Changes | Lines |
|---|---|---|
| `src/index.ts` | Add graceful shutdown, health checks | +20 |
| `src/api/middleware/error-handler.ts` | Add structured error logging | +15 |
| `docker-compose.yml` | Add production-ready config | +25 |
| `config.yaml` | Add Mini App and API configuration sections | +20 |

### 10.7.3 Acceptance Criteria

- [ ] Toast notifications work globally
- [ ] Skeleton screens show during loading
- [ ] Empty states guide users on first visit
- [ ] Error boundaries catch React errors
- [ ] Confirmation modals prevent accidental actions
- [ ] Onboarding flow works for new users
- [ ] App passes Lighthouse performance audit (score > 90)

## 10.8 Implementation Order Summary

```
Week 1:  Phase 1 (Backend API) + Phase 2 (Bot Integration)
Week 2:  Phase 3 (Mini App Core) — start
Week 3:  Phase 3 (Mini App Core) — finish + Phase 4 (Game Screen)
Week 4:  Phase 4 (Game Screen) — finish + Phase 5 (User Screens)
Week 5:  Phase 6 (Operator Screens) + Phase 7 (Polish)
Week 6:  Phase 7 (Polish) — finish + Testing + Deployment
```

## 10.9 Dependency Graph

```
Phase 1 (Backend API)
    │
    ├──► Phase 2 (Bot Integration) — depends on auth endpoints
    │
    └──► Phase 3 (Mini App Core) — depends on all API endpoints
            │
            ├──► Phase 4 (Game Screen) — depends on WS + game API
            │
            ├──► Phase 5 (User Screens) — depends on user API
            │
            └──► Phase 6 (Operator Screens) — depends on admin API
                    │
                    └──► Phase 7 (Polish) — depends on all screens
```

---

# 11. Validation Checklist

## 11.1 Pre-Launch Validation

### 11.1.1 Authentication & Security

- [ ] initData validation rejects invalid signatures
- [ ] initData validation rejects expired auth_date (> 24h)
- [ ] JWT tokens expire correctly
- [ ] JWT blacklisting works on logout
- [ ] Rate limiting blocks excessive requests
- [ ] CORS blocks unauthorized origins
- [ ] Role-based access control works (operator vs user)
- [ ] HTTPS is enforced in production
- [ ] Sensitive data is not logged
- [ ] SQL injection is prevented (parameterized queries)

### 11.1.2 Game Logic

- [ ] Multiplier curve is correct (exponential growth)
- [ ] Crash point generation is fair (provably random)
- [ ] Auto-cashout triggers at correct multiplier
- [ ] Bet placement is rejected outside inter-round phase
- [ ] Cashout is rejected outside growing phase
- [ ] Double-betting is prevented per round
- [ ] Balance is atomically updated on bet/cashout
- [ ] Ledger entries are created for all transactions
- [ ] Fairness verification produces correct hash

### 11.1.3 WebSocket

- [ ] Connections require valid JWT
- [ ] Channels are authorized correctly
- [ ] Heartbeat keeps connections alive
- [ ] Reconnection works with exponential backoff
- [ ] Broadcast latency is < 100ms
- [ ] Messages are rate-limited per connection
- [ ] Disconnect during active round shows offline state

### 11.1.4 UI/UX

- [ ] All 10 screens render without errors
- [ ] Bottom navigation works on all screens
- [ ] Theme adapts to Telegram light/dark mode
- [ ] Safe areas respected on notch devices
- [ ] Touch targets are >= 44x44px
- [ ] Loading states show on all data fetches
- [ ] Empty states guide new users
- [ ] Error boundaries catch React errors
- [ ] Toast notifications appear for all actions
- [ ] Haptic feedback works on supported devices
- [ ] Reduced motion is respected

### 11.1.5 Performance

- [ ] First Contentful Paint < 1.5s
- [ ] Largest Contentful Paint < 2.5s
- [ ] Bundle size < 200KB gzipped (initial)
- [ ] API response time p95 < 200ms
- [ ] WebSocket latency p95 < 100ms
- [ ] No memory leaks on long sessions
- [ ] App works offline (cached data)

### 11.1.6 Telegram Integration

- [ ] Mini App opens from bot menu button
- [ ] Mini App opens from `/miniapp` command
- [ ] WebApp SDK initializes correctly
- [ ] Back button works (closes Mini App or navigates back)
- [ ] Closing confirmation shows on unsaved changes
- [ ] Viewport expands to full height
- [ ] Theme params are correctly applied

## 11.2 Post-Launch Monitoring

- [ ] Error tracking (Sentry) is configured
- [ ] Performance monitoring is configured
- [ ] WebSocket connection health is monitored
- [ ] API error rates are < 1%
- [ ] Game fairness is auditable
- [ ] Audit logs are complete and queryable

---

# 12. Testing Strategy

## 12.1 Testing Pyramid

```
        /\
       /  \     E2E Tests (Cypress/Playwright)
      / 5% \    — Full user journeys
     /────────\
    /          \  Integration Tests
   /   15%     \ — API + WebSocket + DB
  /──────────────\
 /                \ Unit Tests
/       80%       \— Components, hooks, utils
─────────────────────
```

## 12.2 Unit Testing

### Frontend (Mini App)

| Scope | Tool | Coverage Target |
|---|---|---|
| Components | Vitest + React Testing Library | 80% |
| Hooks | Vitest + React Testing Library | 80% |
| Stores | Vitest | 80% |
| Utils | Vitest | 90% |
| API Client | Vitest + MSW | 70% |

```typescript
// Example: MultiplierDisplay test
import { render, screen } from '@testing-library/react';
import { MultiplierDisplay } from './MultiplierDisplay';

describe('MultiplierDisplay', () => {
  it('renders countdown during inter-round', () => {
    render(<MultiplierDisplay phase="waiting" countdown={5.2} />);
    expect(screen.getByText('Next round in 5.2s')).toBeInTheDocument();
  });

  it('shows green color for low multiplier', () => {
    render(<MultiplierDisplay phase="growing" value={1.5} />);
    expect(screen.getByText('1.50x')).toHaveClass('text-green-500');
  });

  it('shows red color for high multiplier', () => {
    render(<MultiplierDisplay phase="growing" value={6.0} />);
    expect(screen.getByText('6.00x')).toHaveClass('text-red-500');
  });

  it('triggers crash animation', () => {
    render(<MultiplierDisplay phase="crashed" value={2.34} />);
    expect(screen.getByText('2.34x')).toHaveClass('animate-shake');
  });
});
```

### Backend

| Scope | Tool | Coverage Target |
|---|---|---|
| API Routes | Jest + Supertest | 70% |
| Services | Jest | 80% |
| Repositories | Jest + test DB | 70% |
| Utils | Jest | 90% |

```typescript
// Example: Auth validation test
import { validateInitData } from '../telegram/auth';

describe('validateInitData', () => {
  it('accepts valid initData', () => {
    const initData = generateValidInitData({ userId: 123 });
    expect(validateInitData(initData)).toEqual({
      valid: true,
      user: { id: 123, ... },
    });
  });

  it('rejects invalid signature', () => {
    const initData = generateInvalidInitData();
    expect(validateInitData(initData)).toEqual({
      valid: false,
      error: 'Invalid signature',
    });
  });

  it('rejects expired auth_date', () => {
    const initData = generateExpiredInitData();
    expect(validateInitData(initData)).toEqual({
      valid: false,
      error: 'initData expired',
    });
  });
});
```

## 12.3 Integration Testing

### API Integration

```typescript
// Example: Bet placement flow
import { setupTestApp } from './test-utils';

describe('Bet Placement Flow', () => {
  it('places bet, grows, and cashes out', async () => {
    const { app, ws } = await setupTestApp();
    const token = await authenticateUser(app, { userId: 123 });

    // Start session
    await request(app)
      .post('/api/v1/admin/session/start')
      .set('Authorization', `Bearer ${operatorToken}`)
      .expect(200);

    // Place bet
    const betRes = await request(app)
      .post('/api/v1/bets')
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 10, autoCashoutAt: 2.0 })
      .expect(201);

    expect(betRes.body).toMatchObject({
      amount: 10,
      status: 'placed',
    });

    // Simulate round growth
    await ws.emit('game:round_start', { roundId: 1 });
    await ws.emit('game:multiplier', { multiplier: 1.5 });
    await ws.emit('game:multiplier', { multiplier: 2.0 });

    // Verify auto-cashout
    const cashoutEvent = await ws.waitForEvent('bet:cashed_out');
    expect(cashoutEvent).toMatchObject({
      multiplier: 2.0,
      winnings: 20,
    });
  });
});
```

### WebSocket Integration

```typescript
describe('WebSocket Integration', () => {
  it('broadcasts game state to all subscribers', async () => {
    const { server } = await setupTestServer();
    const client1 = await connectWebSocket(server, { token: token1 });
    const client2 = await connectWebSocket(server, { token: token2 });

    await client1.subscribe(['game:tenant1']);
    await client2.subscribe(['game:tenant1']);

    // Trigger game state update
    await server.triggerGameEvent('tenant1', { multiplier: 2.5 });

    // Both clients receive update
    const msg1 = await client1.waitForMessage('game:multiplier');
    const msg2 = await client2.waitForMessage('game:multiplier');

    expect(msg1).toEqual({ multiplier: 2.5 });
    expect(msg2).toEqual({ multiplier: 2.5 });
  });
});
```

## 12.4 E2E Testing

### Critical User Journeys

| Journey | Steps | Priority |
|---|---|---|
| **First-time user plays game** | Open Mini App → Auth → Onboarding → Place bet → Watch round → Cash out → View history | P0 |
| **Operator controls session** | Login → Navigate to Control → Start session → Pause → Resume → Stop | P0 |
| **User verifies fairness** | Navigate to Settings → Fairness → Enter round # → Verify hash | P1 |
| **Operator views analytics** | Login → Navigate to Analytics → Change time range → Export data | P1 |
| **User handles network issues** | Play game → Disconnect WiFi → Reconnect → Resume gameplay | P1 |
| **Operator emergency stop** | Navigate to Control → Emergency Stop → Confirm → Verify game paused | P0 |

### E2E Test Example

```typescript
// Cypress/Playwright test
import { test, expect } from '@playwright/test';

test('first-time user plays game', async ({ page }) => {
  // Mock Telegram WebApp
  await page.addInitScript(() => {
    window.Telegram = {
      WebApp: {
        initData: 'mock_init_data',
        initDataUnsafe: { user: { id: 123, username: 'testuser' } },
        ready: () => {},
        expand: () => {},
        themeParams: { bg_color: '#ffffff', text_color: '#000000' },
        HapticFeedback: { impactOccurred: () => {}, notificationOccurred: () => {} },
      },
    };
  });

  await page.goto('http://localhost:5173');

  // Onboarding
  await expect(page.getByText('Welcome to CrashWave')).toBeVisible();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Get Started' }).click();

  // Game screen
  await expect(page.getByText('Next round in')).toBeVisible();

  // Place bet
  await page.getByPlaceholder('Bet amount').fill('10');
  await page.getByRole('button', { name: 'Place Bet' }).click();
  await expect(page.getByText('Bet placed')).toBeVisible();

  // Wait for round to start (mock)
  await page.waitForTimeout(6000);

  // Cash out
  await page.getByRole('button', { name: 'Cash Out' }).click();
  await expect(page.getByText(/Cashed out at/)).toBeVisible();
});
```

## 12.5 Performance Testing

| Test | Tool | Target |
|---|---|---|
| Load test (1000 concurrent users) | k6 / Artillery | p95 response < 500ms |
| WebSocket load (5000 connections) | k6 | p95 latency < 100ms |
| Game simulation (100 rounds/min) | Custom script | Zero missed broadcasts |
| Bundle size audit | Lighthouse | Score > 90 |
| Memory leak test | Chrome DevTools | No leaks after 1 hour |

## 12.6 Security Testing

| Test | Tool | Target |
|---|---|---|
| JWT vulnerability scan | jwt.io + custom | No algorithm confusion |
| SQL injection fuzzing | sqlmap | Zero injectable endpoints |
| Rate limit verification | custom script | Limits enforced correctly |
| CORS misconfiguration | curl | Only allowed origins accepted |
| initData forgery | custom script | Forged data rejected |

---

# 13. Deployment Considerations

## 13.1 Infrastructure Requirements

### 13.1.1 Production Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                          CDN (CloudFront/Cloudflare)            │
│                    Static assets, Mini App bundle               │
└─────────────────────────────┬───────────────────────────────────┘
                              │
┌─────────────────────────────┴───────────────────────────────────┐
│                      Load Balancer (ALB/NGINX)                  │
│                    SSL termination, rate limiting               │
└─────────────┬─────────────────────────────┬─────────────────────┘
              │                             │
    ┌─────────┴─────────┐       ┌──────────┴──────────┐
    │  API Servers      │       │  WebSocket Servers  │
    │  (Node.js/Fastify)│       │  (Socket.io)        │
    │  ×3 instances     │       │  ×2 instances       │
    │  Auto-scaling     │       │  Sticky sessions    │
    └─────────┬─────────┘       └──────────┬──────────┘
              │                             │
    ┌─────────┴─────────┐       ┌──────────┴──────────┐
    │  PostgreSQL       │       │  Redis              │
    │  (Primary +       │       │  (Cluster)          │
    │   Replica)        │       │                     │
    │  Automated        │       │  Sessions, cache,   │
    │  backups          │       │  rate limits,       │
    │  Point-in-time    │       │  pub/sub            │
    │  recovery         │       │                     │
    └───────────────────┘       └─────────────────────┘
```

### 13.1.2 Resource Requirements

| Service | CPU | Memory | Storage | Instances |
|---|---|---|---|---|
| API Server | 2 vCPU | 4 GB | 20 GB SSD | 3 |
| WebSocket Server | 2 vCPU | 4 GB | 20 GB SSD | 2 |
| PostgreSQL | 4 vCPU | 16 GB | 500 GB SSD | 2 (1 primary + 1 replica) |
| Redis | 2 vCPU | 8 GB | 50 GB SSD | 3 (cluster) |
| CDN | — | — | — | Edge locations |

## 13.2 Environment Configuration

### 13.2.1 Environment Variables

```bash
# Application
NODE_ENV=production
PORT=3000
LOG_LEVEL=info

# Database
DATABASE_URL=postgresql://user:pass@primary.db:5432/crashwave
DATABASE_REPLICA_URL=postgresql://user:pass@replica.db:5432/crashwave
DATABASE_POOL_SIZE=20

# Redis
REDIS_URL=redis://redis-cluster:6379
REDIS_CLUSTER=true

# Security
JWT_SECRET=rs256_private_key_pem
JWT_PUBLIC_KEY=rs256_public_key_pem
JWT_EXPIRY=7d
JWT_REFRESH_EXPIRY=30d
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=60

# Telegram
TELEGRAM_BOT_TOKEN=secret_token
TELEGRAM_WEBHOOK_URL=https://api.crashwave.io/telegram/webhook
TELEGRAM_WEBHOOK_SECRET=webhook_secret
TELEGRAM_MINI_APP_URL=https://mini-app.crashwave.io

# Analytics
ANALYTICS_ENABLED=true
ANALYTICS_RETENTION_DAYS=90

# Monitoring
SENTRY_DSN=https://...@sentry.io/...
DATADOG_API_KEY=...
```

### 13.2.2 Configuration per Environment

| Config | Development | Staging | Production |
|---|---|---|---|
| `LOG_LEVEL` | debug | info | warn |
| `RATE_LIMIT_MAX` | 1000 | 100 | 60 |
| `JWT_EXPIRY` | 1d | 7d | 7d |
| `ANALYTICS_RETENTION` | 7 days | 30 days | 90 days |
| `DB_POOL_SIZE` | 5 | 10 | 20 |
| `WS_HEARTBEAT_INTERVAL` | 60s | 30s | 30s |

## 13.3 Build Pipeline

### 13.3.1 CI/CD Workflow

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run test:unit
      - run: npm run test:integration
      - run: npm run lint
      - run: npm run typecheck

  build-backend:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: docker build -t crashwave-api:${{ github.sha }} .
      - run: docker push crashwave-api:${{ github.sha }}

  build-mini-app:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: cd mini-app && npm ci && npm run build
      - run: aws s3 sync mini-app/dist s3://crashwave-mini-app/${{ github.sha }}
      - run: aws cloudfront create-invalidation --distribution-id ... --paths "/*"

  deploy:
    needs: [build-backend, build-mini-app]
    runs-on: ubuntu-latest
    steps:
      - run: kubectl set image deployment/api crashwave-api=crashwave-api:${{ github.sha }}
      - run: kubectl set image deployment/ws crashwave-ws=crashwave-api:${{ github.sha }}
      - run: kubectl rollout status deployment/api
      - run: kubectl rollout status deployment/ws
```

### 13.3.2 Docker Configuration

```dockerfile
# Dockerfile (multi-stage)
# Stage 1: Build backend
FROM node:20-alpine AS backend-build
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY src ./src
COPY tsconfig.json ./
RUN npm run build

# Stage 2: Build Mini App
FROM node:20-alpine AS miniapp-build
WORKDIR /app/mini-app
COPY mini-app/package*.json ./
RUN npm ci
COPY mini-app/ ./
RUN npm run build

# Stage 3: Production
FROM node:20-alpine AS production
WORKDIR /app
COPY --from=backend-build /app/dist ./dist
COPY --from=backend-build /app/node_modules ./node_modules
COPY --from=miniapp-build /app/mini-app/dist ./public
COPY package.json ./
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

## 13.4 Database Migrations

### 13.4.1 Migration Strategy

- Use existing migration system (18 migrations already in place)
- Add new migrations for Mini App features:
  - `019_add_user_sessions.sql` — JWT session tracking
  - `020_add_api_rate_limits.sql` — Rate limit tracking
  - `021_add_user_preferences.sql` — User preference storage

### 13.4.2 Zero-Downtime Migration

```bash
# 1. Deploy new code with backward compatibility
# 2. Run migrations (non-breaking)
npm run migrate:up

# 3. Verify migrations
npm run migrate:status

# 4. Monitor for errors
# 5. Rollback if needed
npm run migrate:down
```

## 13.5 Monitoring & Alerting

### 13.5.1 Key Metrics

| Metric | Threshold | Alert |
|---|---|---|
| API error rate | > 1% | PagerDuty |
| API p95 latency | > 500ms | Slack |
| WebSocket disconnect rate | > 5% | Slack |
| Database connection pool | > 80% | Slack |
| Game round duration | > 30s (growing) | PagerDuty |
| Bet placement failures | > 0.1% | PagerDuty |
| JWT validation failures | > 10/min | Security team |

### 13.5.2 Logging Standards

```typescript
// Structured logging format
{
  "timestamp": "2024-01-15T10:30:00.000Z",
  "level": "info",
  "service": "crashwave-api",
  "version": "2.0.0",
  "requestId": "req_abc123",
  "userId": 123,
  "tenantId": "tenant_456",
  "event": "bet.placed",
  "data": {
    "betId": "bet_789",
    "amount": 10,
    "roundId": 100
  },
  "durationMs": 45,
  "statusCode": 201
}
```

## 13.6 Rollback Strategy

| Scenario | Rollback Action | RTO |
|---|---|---|
| Bad deployment | `kubectl rollout undo deployment/api` | 2 minutes |
| Database migration issue | `npm run migrate:down` + redeploy previous version | 10 minutes |
| WebSocket server crash | Auto-restart via Kubernetes | 30 seconds |
| Redis failure | Failover to replica | 1 minute |
| PostgreSQL failure | Promote replica to primary | 5 minutes |

---

# 14. Final Acceptance Criteria

## 14.1 Definition of Done

The CrashWave Telegram Mini App v2.0.0 is considered production-ready when ALL of the following criteria are met:

### 14.1.1 Functional Requirements

- [ ] **FR-01**: Users can open the Mini App from the Telegram bot menu button
- [ ] **FR-02**: Users are authenticated via Telegram initData validation
- [ ] **FR-03**: Users can view their balance and performance statistics
- [ ] **FR-04**: Users can place bets during the inter-round phase
- [ ] **FR-05**: Users can cash out during the growing phase
- [ ] **FR-06**: Users can set auto-cashout multiplier
- [ ] **FR-07**: Users can view bet and round history with filtering
- [ ] **FR-08**: Users can verify round fairness with client-side hash check
- [ ] **FR-09**: Users can update preferences (currency, notifications, defaults)
- [ ] **FR-10**: Operators can start, pause, resume, and stop game sessions
- [ ] **FR-11**: Operators can execute emergency stop with confirmation
- [ ] **FR-12**: Operators can view real-time analytics and export data
- [ ] **FR-13**: Operators can configure game parameters (min/max bet, house edge)
- [ ] **FR-14**: Operators can view system health status
- [ ] **FR-15**: All user actions are reflected in real-time via WebSocket

### 14.1.2 Non-Functional Requirements

- [ ] **NFR-01**: First Contentful Paint < 1.5s on 4G connection
- [ ] **NFR-02**: API response time p95 < 200ms
- [ ] **NFR-03**: WebSocket broadcast latency p95 < 100ms
- [ ] **NFR-04**: Bundle size < 200KB gzipped (initial load)
- [ ] **NFR-05**: Supports 1000+ concurrent users per tenant
- [ ] **NFR-06**: 99.9% uptime (excluding planned maintenance)
- [ ] **NFR-07**: Zero data loss on graceful shutdown
- [ ] **NFR-08**: All database queries use parameterized statements
- [ ] **NFR-09**: JWT tokens are validated on every request
- [ ] **NFR-10**: Rate limiting prevents abuse (60 req/min general)
- [ ] **NFR-11**: CORS blocks unauthorized origins
- [ ] **NFR-12**: Sensitive data is never logged

### 14.1.3 Quality Requirements

- [ ] **QR-01**: Unit test coverage >= 80% for all new code
- [ ] **QR-02**: Integration tests cover all API endpoints
- [ ] **QR-03**: E2E tests cover all critical user journeys
- [ ] **QR-04**: Lighthouse performance score >= 90
- [ ] **QR-05**: Lighthouse accessibility score >= 95
- [ ] **QR-06**: No critical or high security vulnerabilities (Snyk/Dependabot)
- [ ] **QR-07**: All TypeScript strict mode checks pass
- [ ] **QR-08**: ESLint zero warnings policy enforced
- [ ] **QR-09**: Code review approved by 2+ engineers
- [ ] **QR-10**: Documentation is complete and accurate

### 14.1.4 Telegram Requirements

- [ ] **TR-01**: Mini App opens correctly from bot menu button
- [ ] **TR-02**: Mini App respects Telegram theme (light/dark)
- [ ] **TR-03**: Mini App uses Telegram viewport and safe areas
- [ ] **TR-04**: Back button navigates correctly or closes app
- [ ] **TR-05**: Haptic feedback uses Telegram WebApp API
- [ ] **TR-06**: Closing confirmation shows on unsaved changes
- [ ] **TR-07**: Mini App URL is registered with BotFather

### 14.1.5 Compliance Requirements

- [ ] **CR-01**: All financial transactions are logged in ledger
- [ ] **CR-02**: Audit logs are immutable and queryable
- [ ] **CR-03**: Game fairness is cryptographically verifiable
- [ ] **CR-04**: User data can be exported and deleted (GDPR)
- [ ] **CR-05**: Responsible gaming features are accessible

## 14.2 Sign-Off Checklist

| Stakeholder | Sign-Off Date | Status |
|---|---|---|
| Engineering Lead | ___________ | [ ] |
| Product Manager | ___________ | [ ] |
| Security Review | ___________ | [ ] |
| QA Lead | ___________ | [ ] |
| DevOps Lead | ___________ | [ ] |
| Legal/Compliance | ___________ | [ ] |

## 14.3 Post-Launch Roadmap

| Phase | Features | Timeline |
|---|---|---|
| **v2.1.0** | Push notifications, leaderboards, achievements | +2 weeks |
| **v2.2.0** | Multi-currency support, crypto payments | +4 weeks |
| **v2.3.0** | Advanced analytics, custom reports | +6 weeks |
| **v2.4.0** | Social features, chat integration | +8 weeks |
| **v3.0.0** | AI-powered personalization, predictive analytics | +12 weeks |

---

> **Document End**
>
> This specification was generated through comprehensive audit and analysis of the CrashWave codebase and design documents. It represents the complete blueprint for implementing a production-ready Telegram Mini App.
>
> **Version**: 2.0.0-RC1  
> **Generated**: 2026-08-28  
> **Classification**: Internal — Engineering & Design Reference

