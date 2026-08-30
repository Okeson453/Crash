# CrashWave

Crash game platform with a Telegram Mini App, control-plane API, risk/betting services, and admin tools.

Prediction signals use a **heuristic / statistical ensemble** (ACIE). They are not machine learning models and **do not guarantee profit**.

---

## What’s in this repo

| Part | Path | Role |
|------|------|------|
| Backend API | `src/` | Auth, bets, admin, prediction, workers |
| Mini App | `mini-app/` | Player Telegram UI |
| Admin UI | `admin/` | Operator dashboard |
| Migrations | `migrations/` | PostgreSQL schema |
| Config | `config.yaml` | Default app settings |

---

## Requirements

- Node.js 20+
- PostgreSQL 15+
- Redis 7+

---

## Quick start

```bash
# 1. Install
npm ci

# 2. Env (copy and fill in)
cp .env.example .env   # or set vars below

# 3. Database
export DATABASE_URL=postgresql://postgres:postgres@localhost:5432/crash
node scripts/run-migrations.mjs

# 4. Run (monolith / all roles)
npm run build
npm start
```

Development without build:

```bash
npm run dev
```

Mini App:

```bash
cd mini-app && npm ci && npm run dev
```

---

## Process roles

Set `PROCESS_ROLE` to split services:

| Role | What it runs |
|------|----------------|
| `all` | Everything (default, local/dev) |
| `control-plane` | API + WebSocket (no browser automation) |
| `automation-worker` | Browser / betting workers |
| `mini-app-game` | House mini-game loop |

```bash
PROCESS_ROLE=control-plane npm start
PROCESS_ROLE=automation-worker npm start
```

Docker compose for roles: `docker-compose.roles.yml`

---

## Environment variables

**Required in production**

| Variable | Purpose |
|----------|---------|
| `JWT_SECRET` | Access token secret (≥32 chars, no placeholders) |
| `REFRESH_SECRET` | Refresh token secret (≥32 chars) |
| `DATABASE_URL` | Postgres connection string |
| `REDIS_URL` | Redis connection string |
| `CORS_ORIGIN` | Comma-separated allowed origins |

**Common optional**

| Variable | Default | Purpose |
|----------|---------|---------|
| `PROCESS_ROLE` | `all` | Process role (see above) |
| `NODE_ENV` | `development` | `production` enables strict secret/CORS checks |
| `API_PORT` / `PORT` | `8081` | HTTP API port |
| `METRICS_PORT` | `9090` | Prometheus metrics |
| `DATABASE_POOL_SIZE` | role-based | Postgres pool size |
| `SYSTEM_MODE` | from config | `dry-run` / `live` / etc. |

---

## API

- Base: `http://localhost:8081/api/v1`
- Health: `GET /api/v1/health`
- Ready: `GET /api/v1/health/ready`
- Docs: `GET /api/docs` (OpenAPI / Swagger)
- WebSocket: `/socket.io`

Auth: `Authorization: Bearer <access_token>`

Errors look like:

```json
{ "error": { "code": "UNAUTHORIZED", "message": "...", "requestId": "..." } }
```

---

## Tests

```bash
npm test
# or
npx jest --testPathPattern=tests/unit --ci --runInBand
```

---

## Docker

```bash
# Full image (includes Playwright for workers)
docker build -t crash-worker .

# API-only (no browser stack)
docker build --target api-production -t crash-api .
```

Healthcheck hits `/api/v1/health/ready` on port `8081`.

---

## Layout (backend)

```
src/
  api/           HTTP + WebSocket
  app/           Composition / wiring
  betting/       Risk + execution
  prediction/    ACIE heuristic engine
  mini-app/      House game service
  platform/      Tenants, admin, referrals
  persistence/   Postgres + Redis
  entry/         Process role entrypoints
migrations/
```

---

## Notes

- **Live money path** needs real browser automation (`PROCESS_ROLE=automation-worker`) and must not use the mock bet adapter in production.
- **Prediction** is global heuristic ensemble scope today; treat signals as advisory.
- **Migrations** are numbered `001`–`029+`; run them before starting the API.

---

## License

Private / unlicensed unless stated otherwise by the repository owner.
