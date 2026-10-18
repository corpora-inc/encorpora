# syntax=docker/dockerfile:1.7
# AMP: one build, two images. `api` runs the Fastify server, its migrations
# and its scheduled jobs; `web` serves the built browser app.
ARG NODE_IMAGE=node:22.17.1-bookworm-slim

FROM ${NODE_IMAGE} AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY . .
# Public browser OIDC settings (never a client secret), baked per environment.
ARG VITE_AMP_AUTHORITY=""
ARG VITE_AMP_CLIENT_ID=""
ARG VITE_AMP_SCOPES=""
ARG VITE_AMP_RESOURCE=""
# Type checking is CI's job; the image only bundles.
RUN npx vite build

FROM ${NODE_IMAGE} AS api
ENV NODE_ENV=production AMP_HOST=0.0.0.0 AMP_PORT=8080
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY --from=build /app/src ./src
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/migrations ./migrations
COPY --from=build /app/books ./books
COPY --from=build /app/tsconfig.json ./
USER 65532:65532
EXPOSE 8080
CMD ["node_modules/.bin/tsx", "src/server/main.ts"]

FROM nginxinc/nginx-unprivileged:1.27.5-alpine AS web
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
