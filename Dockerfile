# Railway / default builder — multi-stage production image with migrations
# Playwright npm package and Docker browser runtime MUST stay in lockstep.
FROM mcr.microsoft.com/playwright:v1.62.1-jammy AS base
# Pin Node 20 LTS to match package.json engines (>=20 <23).
# Do not use setup_22.x — NodeSource's 22 channel can resolve to Node 24.
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl gnupg \
 && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
 && apt-get install -y --no-install-recommends nodejs \
 && node -v | grep -E '^v20\.' \
 && npm install -g npm@10 \
 && npm config set registry https://registry.npmjs.org/ \
 && rm -rf /var/lib/apt/lists/*
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
    BROWSER_HEADLESS=1
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
RUN npm cache clean --force

FROM base AS build
COPY package.json package-lock.json tsconfig.json tsconfig.build.json ./
RUN npm ci --include=dev
RUN test -f node_modules/.bin/tsc || npm install typescript@5.9.3 --no-save
COPY src/ ./src/
COPY config.yaml ./
RUN npm run build && npm prune --omit=dev

FROM base AS production
ENV NODE_ENV=production \
    BROWSER_HEADLESS=1 \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
    API_PORT=8081 \
    PORT=8081 \
    METRICS_PORT=9090
RUN groupadd -r crashapp && useradd -r -g crashapp -m -d /home/crashapp crashapp
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./
COPY --from=build /app/config.yaml ./

COPY migrations/ ./migrations/
COPY scripts/run-migrations.mjs scripts/docker-entrypoint.sh \
     scripts/healthcheck.sh scripts/wait-for-services.sh ./scripts/

RUN chmod +x ./scripts/*.sh ./scripts/run-migrations.mjs \
 && mkdir -p logs \
 && chown -R crashapp:crashapp /app

USER crashapp
EXPOSE 9090 8081
HEALTHCHECK --interval=30s --timeout=10s --start-period=90s --retries=5 \
  CMD curl -sf "http://127.0.0.1:${API_PORT:-${PORT:-8081}}/api/v1/health/ready" || curl -sf "http://127.0.0.1:${API_PORT:-${PORT:-8081}}/api/v1/health" || exit 1

ENTRYPOINT ["./scripts/docker-entrypoint.sh"]
CMD ["node", "dist/index.js"]

# Slim API / control-plane image without Playwright browsers
FROM node:20-bookworm-slim AS api-production
RUN apt-get update && apt-get install -y --no-install-recommends curl \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production \
    PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 \
    PROCESS_ROLE=control-plane \
    PORT=8081 \
    METRICS_PORT=9090
RUN groupadd -r crashapp && useradd -r -g crashapp -m -d /home/crashapp crashapp
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./
COPY --from=build /app/config.yaml ./
COPY migrations/ ./migrations/
COPY scripts/run-migrations.mjs scripts/docker-entrypoint.sh \
     scripts/healthcheck.sh scripts/wait-for-services.sh ./scripts/
RUN chmod +x ./scripts/*.sh ./scripts/run-migrations.mjs \
 && mkdir -p logs \
 && chown -R crashapp:crashapp /app
USER crashapp
EXPOSE 8081 9090
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=5 \
  CMD curl -sf "http://127.0.0.1:${API_PORT:-8081}/api/v1/health/ready" || curl -sf "http://127.0.0.1:${API_PORT:-8081}/api/v1/health" || exit 1
ENTRYPOINT ["./scripts/docker-entrypoint.sh"]
CMD ["node", "dist/index.js"]
