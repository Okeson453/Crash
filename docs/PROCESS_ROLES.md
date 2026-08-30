# Process roles (control-plane / automation / mini-game)

## Roles

| `PROCESS_ROLE` | Listens | Starts |
|----------------|---------|--------|
| `control-plane` | `apiPort`, metrics | API, WS, outbox consumer, Redis game relay — **no** Playwright, workers, mini-game timer |
| `automation-worker` | metrics only | Composition recovery, worker fleet, supervisor, betting — **no** public API, **no** mini-game |
| `mini-app-game` | health `:8092` | `MiniGameService` only (leader lock) |
| `all` | everything | Local monolith (default) |

## Scripts

```bash
npm run start:control-plane
npm run start:automation
npm run start:mini-game
npm run start:monolith
```

## Compose

```bash
docker compose -f docker-compose.roles.yml up
```

## Verification

1. Only control-plane binds `apiPort`
2. Only one Redis key `miniapp:game-leader`
3. Only one live automation `InstanceLock`
4. Kill automation → API + mini-game stay up
