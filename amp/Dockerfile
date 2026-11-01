# syntax=docker/dockerfile:1.7
# AMP: one build, three images. `api` runs the Fastify server, its migrations
# and its scheduled jobs; `web` serves the built browser app; `render` is the
# internal HTML-to-PDF service for workbooks (src/render-service).
ARG NODE_IMAGE=node:22.23.4-bookworm-slim@sha256:5991875dfb80938dd8a6ba3fe3e96fd04929e70792762b3319d8caadbbe229bc

FROM ${NODE_IMAGE} AS node-base
# Node's bundled roots are independent of Debian's trust store. Install the
# eMudhra distrust update and use that store for npm, builds, and outbound TLS.
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
    && dpkg --compare-versions "$(dpkg-query -W -f='${Version}' ca-certificates)" ge 20250419~deb12u2 \
    && rm -rf /var/lib/apt/lists/*
ENV NODE_OPTIONS=--use-openssl-ca

FROM node-base AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

FROM dependencies AS build
COPY . .
# Public browser OIDC settings (never a client secret), baked per environment.
ARG VITE_AMP_AUTHORITY=""
ARG VITE_AMP_CLIENT_ID=""
ARG VITE_AMP_SCOPES=""
ARG VITE_AMP_RESOURCE=""
# Type checking is CI's job; the image only bundles.
RUN npx vite build && npm run build:public-pathways
# The release this image is: the full source commit and the UTC build time,
# passed by the deploy pipeline (public; see src/server/build-info.ts).
# Declared after the bundle, so a new commit reuses every layer above. The web
# serves them at /version.json; the API reports them in /api/v1/health.
ARG SOURCE_COMMIT=""
ARG BUILT_AT=""
RUN node -e 'const [commit, builtAt] = process.argv.slice(1).map((v) => v || null); \
  require("fs").writeFileSync("dist/version.json", JSON.stringify({ commit, builtAt }) + "\n")' \
  "$SOURCE_COMMIT" "$BUILT_AT"

# PDF tooling is build-only. The browser and Poppler never enter the API image.
FROM dependencies AS pdf-build
ENV PLAYWRIGHT_BROWSERS_PATH=/opt/amp-playwright
RUN apt-get update \
    && apt-get install -y --no-install-recommends poppler-utils \
    && npx playwright install --with-deps --only-shell chromium \
    && rm -rf /var/lib/apt/lists/*
COPY . .
# Cached PDFs are reused only with matching renderer inputs and verified bytes.
# The release directory is outside the cache mount and contains delivery files only.
RUN --mount=type=cache,id=amp-pdf-build-v1,target=/app/artifacts,sharing=locked \
    node_modules/.bin/tsx scripts/build-pdf-release.ts /app/pdf-release

# The render service is one bundled file plus playwright-core (no other
# dependencies), so its image carries Node, Chromium and nothing else.
FROM dependencies AS render-build
COPY src/render-service ./src/render-service
RUN node_modules/.bin/esbuild src/render-service/main.ts --bundle --platform=node \
      --format=esm --target=node22 --external:playwright-core --outfile=/out/main.mjs

FROM node-base AS render
ENV NODE_ENV=production PLAYWRIGHT_BROWSERS_PATH=/opt/amp-playwright \
    AMP_RENDER_HOST=0.0.0.0 AMP_RENDER_PORT=8080 HOME=/tmp
WORKDIR /app
COPY --from=dependencies /app/node_modules/playwright-core ./node_modules/playwright-core
# The browser build matches this playwright-core exactly; system libraries and
# fonts come with it. Pages print the same as the publication PDFs.
RUN node node_modules/playwright-core/cli.js install --with-deps --only-shell chromium \
    && rm -rf /var/lib/apt/lists/* /tmp/*
COPY --from=render-build /out/main.mjs ./main.mjs
RUN printf '{"type":"module"}\n' > package.json
# Non-root; writes only to /tmp (mount a tmpfs with a read-only root).
USER 65532:65532
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=6s --start-period=20s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:'+(process.env.AMP_RENDER_PORT||8080)+'/healthz').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"]
CMD ["node", "main.mjs"]

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
COPY --from=pdf-build /app/pdf-release ./artifacts
COPY --from=build /app/tsconfig.json ./
ARG SOURCE_COMMIT=""
ARG BUILT_AT=""
ENV AMP_BUILD_COMMIT=${SOURCE_COMMIT} AMP_BUILD_TIME=${BUILT_AT}
USER 65532:65532
# Verify default delivery paths and access guards as the actual runtime user.
RUN --network=none node_modules/.bin/tsx scripts/verify-pdf-delivery.ts
EXPOSE 8080
CMD ["node_modules/.bin/tsx", "src/server/main.ts"]

FROM nginxinc/nginx-unprivileged:1.27.5-alpine AS web
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/artifacts/pathways-nginx-map.conf /etc/nginx/conf.d/00-pathways-map.conf
COPY --from=build /app/dist /usr/share/nginx/html
