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
WORKDIR /app/apps/api
# API listens on $PORT (default 4000). Behind the ALB this is the target port.
ENV PORT=4000
EXPOSE 4000
# Apply pending migrations on start, then boot. (Or run migrate as a separate task.)
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
