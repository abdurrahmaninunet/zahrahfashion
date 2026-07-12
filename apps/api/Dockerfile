# Zahrah API (NestJS + Prisma + sharp).
# Build from the REPO ROOT:  docker build -f apps/api/Dockerfile -t zahrah-api .
FROM node:22-slim AS base
WORKDIR /app
# openssl is required by Prisma; sharp ships prebuilt binaries for linux.
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*

# ---- deps + build ----
FROM base AS build
# Workspace manifests first for a cached npm ci.
COPY package*.json ./
COPY apps/api/package.json apps/api/
COPY apps/storefront/package.json apps/storefront/
COPY apps/admin/package.json apps/admin/
RUN npm ci
COPY . .
RUN npm run -w @zahrah/api prisma:generate
RUN npm run -w @zahrah/api build

# ---- runtime ----
FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/package.json ./apps/api/package.json
COPY --from=build /app/apps/api/prisma ./apps/api/prisma
# seed.ts (run via tsx on startup) imports from ../src, so ship the TS source too.
COPY --from=build /app/apps/api/src ./apps/api/src
COPY --from=build /app/apps/api/tsconfig*.json ./apps/api/
WORKDIR /app/apps/api
# API listens on $PORT (default 4000). Behind the ALB this is the target port.
ENV PORT=4000
EXPOSE 4000
# On start: best-effort sync the schema (db push — the project has schema drift so
# `migrate deploy` would miss columns like Customer.wishlist) and seed the essentials
# (roles, owner, zones, units — blank store unless SEED_DEMO=true), then boot.
# CRITICAL: db push / seed must NOT gate the API. If db push hits a data-loss guard
# (it refuses destructive changes non-interactively) the DB is still the last good
# in-sync schema, so we log and boot anyway rather than crash-looping the whole API.
CMD ["sh", "-c", "npx prisma db push --skip-generate || echo '[start] db push skipped (schema left as-is)'; npm run seed || echo '[start] seed skipped'; node dist/main.js"]


