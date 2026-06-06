# World Plaza (Corpan City) — Colyseus presence server image.
#
# Runs the server EXACTLY as `npm run server` does in dev: tsx executes
# src/index.ts directly (no tsc emit — the pack has no build step and tsx
# honours the tsconfig `paths` alias for @world-plaza/contracts at runtime).
#
# BUILD CONTEXT IS THE PACK ROOT (corpan/packs/world-plaza), NOT server/, because
# the server imports two sibling trees:
#   • @world-plaza/contracts  → ../contracts/src   (tsconfig path alias)
#   • the room topology JSON   → ../../content/topologies/plaza-grand.json (read at boot)
# Build from the pack root so those are in context:
#   docker build -f server/Dockerfile -t corpan-plaza-server .
#
# Module resolution: deps are installed at /app (the pack root inside the image)
# so `import "zod"` from /app/contracts/src resolves /app/node_modules/zod, and
# tsx/colyseus resolve the same way for the server entry under /app/server/src.

FROM node:20-slim

ENV NODE_ENV=production
# App Runner routes to the port the container EXPOSEs; 8080 is its default.
ENV PORT=8080

WORKDIR /app

# 1) Install ONLY the server's deps (incl. tsx, which we run with) at /app so
#    every sibling tree resolves modules from /app/node_modules. `npm ci` needs
#    package.json + lockfile only → this layer caches across src changes.
#    --include=dev is REQUIRED: tsx (the runtime) is a devDependency, and the
#    NODE_ENV=production set above would otherwise make npm omit it. Without
#    this flag the container starts and dies with "Cannot find module
#    '/app/node_modules/tsx/dist/cli.mjs'" — that crashloop bit the first deploy.
COPY server/package.json server/package-lock.json ./
RUN npm ci --include=dev --no-audit --no-fund

# 2) Copy the three trees the server needs at runtime.
COPY server/tsconfig.json ./server/tsconfig.json
COPY server/src ./server/src
COPY contracts/src ./contracts/src
COPY content/topologies ./content/topologies

EXPOSE 8080

# tsx is resolved from /app/node_modules/.bin; the entry's tsconfig at
# /app/server/tsconfig.json supplies the contracts path alias.
CMD ["node", "node_modules/tsx/dist/cli.mjs", "server/src/index.ts"]
