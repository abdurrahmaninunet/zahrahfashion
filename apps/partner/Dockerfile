# Zahrah partner portal (Next.js).
# Build from the REPO ROOT:  docker build -f apps/partner/Dockerfile -t zahrah-partner .
FROM node:22-slim AS base
WORKDIR /app

FROM base AS build
COPY package*.json ./
COPY apps/api/package.json apps/api/
COPY apps/storefront/package.json apps/storefront/
COPY apps/admin/package.json apps/admin/
COPY apps/partner/package.json apps/partner/
RUN npm ci
COPY . .
# Next.js bakes the /api and /uploads rewrite destinations at BUILD time, so
# API_URL must be the production API address here (Service Connect name), not the
# dev default. The runtime env below is also read at server start.
ARG API_URL="http://zahrah-api:4000"
ENV API_URL=$API_URL
RUN npm run -w @zahrah/partner build

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/partner/.next ./apps/partner/.next
COPY --from=build /app/apps/partner/public ./apps/partner/public
COPY --from=build /app/apps/partner/package.json ./apps/partner/package.json
COPY --from=build /app/apps/partner/next.config.* ./apps/partner/
WORKDIR /app/apps/partner
# API_URL is read at server start for the /api and /uploads rewrites — point it at
# the API service's internal URL (e.g. http://zahrah-api.internal:4000).
ENV PORT=3000
EXPOSE 3000
CMD ["npx", "next", "start", "-p", "3000"]
