# Zahrah admin (Next.js).
# Build from the REPO ROOT:  docker build -f apps/admin/Dockerfile -t zahrah-admin .
FROM node:22-slim AS base
WORKDIR /app

FROM base AS build
COPY package*.json ./
COPY apps/api/package.json apps/api/
COPY apps/storefront/package.json apps/storefront/
COPY apps/admin/package.json apps/admin/
RUN npm ci
COPY . .
# Next.js bakes the /api rewrite destination at BUILD time, so API_URL must be the
# production API address here (Service Connect name), not the dev default.
ARG API_URL="http://zahrah-api:4000"
ENV API_URL=$API_URL
RUN npm run -w @zahrah/admin build

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/admin/.next ./apps/admin/.next
COPY --from=build /app/apps/admin/public ./apps/admin/public
COPY --from=build /app/apps/admin/package.json ./apps/admin/package.json
COPY --from=build /app/apps/admin/next.config.* ./apps/admin/
WORKDIR /app/apps/admin
# API_URL is read at server start for the /api rewrite — point it at the API
# service's internal URL (e.g. http://zahrah-api.internal:4000).
ENV PORT=3000
EXPOSE 3000
CMD ["npx", "next", "start", "-p", "3000"]
