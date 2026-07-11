# Zahrah storefront (Next.js).
# Build from the REPO ROOT:  docker build -f apps/storefront/Dockerfile -t zahrah-storefront .
FROM node:22-slim AS base
WORKDIR /app

FROM base AS build
COPY package*.json ./
COPY apps/api/package.json apps/api/
COPY apps/storefront/package.json apps/storefront/
COPY apps/admin/package.json apps/admin/
RUN npm ci
COPY . .
# NEXT_PUBLIC_* must be present at build time (baked into the bundle).
ARG NEXT_PUBLIC_GOOGLE_CLIENT_ID=""
ENV NEXT_PUBLIC_GOOGLE_CLIENT_ID=$NEXT_PUBLIC_GOOGLE_CLIENT_ID
RUN npm run -w @zahrah/storefront build

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/storefront/.next ./apps/storefront/.next
COPY --from=build /app/apps/storefront/public ./apps/storefront/public
COPY --from=build /app/apps/storefront/package.json ./apps/storefront/package.json
COPY --from=build /app/apps/storefront/next.config.* ./apps/storefront/
WORKDIR /app/apps/storefront
# API_URL is read at server start for the /api and /uploads rewrites — point it at
# the API service's internal URL (e.g. http://zahrah-api.internal:4000).
ENV PORT=3000
EXPOSE 3000
CMD ["npx", "next", "start", "-p", "3000"]
