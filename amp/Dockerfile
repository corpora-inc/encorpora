# syntax=docker/dockerfile:1.7
# AMP: one build, two images. `api` runs the Fastify server, its migrations
# and its scheduled jobs; `web` serves the built browser app.
ARG NODE_IMAGE=node:22-bookworm-slim@sha256:3ed98443660ff48413b5af19ecefce3b9d50845a901a43420d47cc63a9fddbe9

FROM ${NODE_IMAGE} AS node-base
# Node's bundled roots are independent of Debian's trust store. Install the
# eMudhra distrust update and use that store for npm, builds, and outbound TLS.
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
    && dpkg --compare-versions "$(dpkg-query -W -f='${Version}' ca-certificates)" ge 20250419~deb12u2 \
    && rm -rf /var/lib/apt/lists/*
ENV NODE_OPTIONS=--use-openssl-ca

FROM node-base AS build
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
# The release this image is: the full source commit and the UTC build time,
# passed by the deploy pipeline (public; see src/server/build-info.ts).
# Declared after the bundle, so a new commit reuses every layer above. The web
# serves them at /version.json; the API reports them in /api/v1/health.
ARG SOURCE_COMMIT=""
ARG BUILT_AT=""
RUN node -e 'const [commit, builtAt] = process.argv.slice(1).map((v) => v || null); \
  require("fs").writeFileSync("dist/version.json", JSON.stringify({ commit, builtAt }) + "\n")' \
  "$SOURCE_COMMIT" "$BUILT_AT"

FROM node-base AS api
ENV NODE_ENV=production AMP_HOST=0.0.0.0 AMP_PORT=8080
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY --from=build /app/src ./src
COPY --from=build /app/scripts ./scripts
# External configuration (scripts/external-config.ts) runs from this image at deploy.
COPY --from=build /app/infra ./infra
COPY --from=build /app/migrations ./migrations
COPY --from=build /app/books ./books
COPY --from=build /app/tsconfig.json ./
ARG SOURCE_COMMIT=""
ARG BUILT_AT=""
ENV AMP_BUILD_COMMIT=${SOURCE_COMMIT} AMP_BUILD_TIME=${BUILT_AT}
USER 65532:65532
EXPOSE 8080
CMD ["node_modules/.bin/tsx", "src/server/main.ts"]

FROM nginxinc/nginx-unprivileged:1.27.5-alpine AS web
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
