# Corpan City — CI/CD, Web Deploy & Cloud Infra to Production

> **Scope.** This is the P4/P5 deliverable of `docs/PRODUCTION_ROADMAP.md`: the
> GitHub Actions pipelines, the GitHub Pages standalone demo, the Terraform/AWS
> realtime + API + CDN + observability stack for the Colyseus server, the
> secrets model, and the phased rollout. It is **design-only** — no workflow or
> `.tf` is committed by this doc; the sketches below are the implementation spec.
>
> **Reuse-first principle.** Corpan City is a Corpán pack, not a new product. It
> inherits the production AWS account (`us-east-2`, profile `corpan-publisher`),
> the `corpan-prod` S3 bucket, the CloudFront distribution `E1RDNUCVE70SCI`
> (`d38iwc9748jekz.cloudfront.net`), the verify-purchase Lambda, the Terraform
> root at `corpan/infra/terraform/` (S3 remote backend `corpan-tf-state`), and
> the publish toolchain documented in `corpan/infra/PUBLISHING.md`. The only
> genuinely new infra is the **realtime tier** (Colyseus container + Redis); the
> pack zip + catalog flow is the existing narration-pack flow with a new prefix.

Companion docs:
- `docs/PRODUCTION_ROADMAP.md` — the phase map this doc lives inside (P4/P5).
- `docs/RELEASE_ENGINEERING.md` (P3, parallel) — the pack `dist` build, two-zip
  preview/full split, `manifest.json`, and the `corpan-city` catalog entry this
  CI **publishes**. This doc owns the *automation*; that doc owns the *artifact
  shape*. Where they touch (the publish step) this doc defers to it for the
  exact zip/manifest/catalog-field contract.
- `docs/MULTIPLAYER_PROD.md` (P1, parallel) — the server's runtime needs
  (room directory, reconnect/TTL, rate limits, **horizontal scale via Redis**,
  autoscale band by CCU). This doc owns the *deploy shape* of that server.
- `corpan/infra/PUBLISHING.md` — the existing S3/CloudFront/`ttsctl` posture.
- `corpan/infra/terraform/` — the existing root module we extend.

---

## 0. Inventory — what exists vs. what's new

| Concern | Today | Corpan City adds |
| --- | --- | --- |
| Pack build | `vite build` → `dist/app.js` + `dist/app.css` (IIFE lib, ~1.8 MB) | CI runs it on PR + tag |
| Pack publish | `ttsctl publish` (narration ZIPs → `s3://corpan-prod/artifacts/narrations/`, upserts `catalog.json`) | a **pack zip** under `pack-store/` prefix + a `corpan_city` catalog entry (per `RELEASE_ENGINEERING.md`) |
| Catalog/CDN | `catalog.json` on `corpan-prod` behind CloudFront `E1RDNUCVE70SCI`, OAC, CORS policy, signed-URL key group for premium | same distribution; new `pack-store/corpan-city/*` + (optional) `scenes/`/`themes/` asset prefixes |
| Plus gating | verify-purchase Lambda + CloudFront signed URLs (`isTwoZipEntry`) | reuse verbatim if WP ships a Plus tier |
| Realtime | **none in prod** — `server/` runs locally on `:2567`, proven two-window | **NEW: Colyseus on Fargate + ElastiCache Redis** |
| Durable economy | localStorage-only on device (`store/progress.ts`); no server economy yet | **optional** RDS Postgres, deferred until E2-E4 needs server authority |
| Observability | analytics data-lake (`analytics.tf`: CloudFront→Lambda→Firehose→S3/Athena), CloudWatch 7d | CloudWatch + (optional) Sentry for the server; reuse the privacy-safe analytics lake |
| CI/CD | **none committed** in `corpan/` (PUBLISHING.md *references* a `hover-runner-pages.yml` Pages deploy, but no `.github/` exists at repo root yet) | **NEW: a `.github/workflows/` tree** — this doc bootstraps it |
| Terraform state | S3 remote backend `corpan-tf-state` (`backend.tf`), single-operator, no lock table | add a DynamoDB lock once CI runs `apply` |

**Key takeaway:** the static/CDN/Plus-gating story is *already built and in
production*. WP's incremental infra is (1) a CI tree and (2) the realtime tier.
Everything else is "add a prefix / add a catalog entry" against existing AWS.

---

## 1. GitHub Actions — CI/CD

### 1.1 Repo layout

The monorepo has no `.github/` yet. We bootstrap one at the **repo root**
(`corpan/.github/workflows/`) so a single Actions config covers all packs;
Corpan City's jobs are `paths`-scoped to `packs/corpan-city/**` so they only run
when WP changes. (A pack-local `.github/` would be ignored by GitHub — workflows
must live at the repo root.)

```
corpan/.github/
├── actions/
│   └── setup-node-cache/         # composite: actions/setup-node + npm cache, reused by all jobs
│       └── action.yml
└── workflows/
    ├── corpan-city-ci.yml        # PR + push gate (typecheck, test, build, conformance, server)
    ├── corpan-city-pages.yml     # GH Pages demo (push to main + tag)
    └── corpan-city-release.yml   # tag → publish pack zip + catalog + deploy server
```

### 1.2 PR gate — `corpan-city-ci.yml`

Triggers: `pull_request` and `push` to non-`main` branches, both filtered to
`paths: ['packs/corpan-city/**']`. Concurrency-grouped per ref so a force-push
cancels the in-flight run.

Six gates, fanned across a small matrix where it pays (the pack has a `vitest`
suite, a contracts conformance suite, and a co-located server):

```yaml
name: corpan-city-ci
on:
  pull_request:
    paths: ['packs/corpan-city/**']
  push:
    branches-ignore: ['main']
    paths: ['packs/corpan-city/**']
concurrency:
  group: wp-ci-${{ github.ref }}
  cancel-in-progress: true

defaults:
  run:
    working-directory: packs/corpan-city

jobs:
  pack:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: ./.github/actions/setup-node-cache    # node 22, npm cache keyed on package-lock
      - run: npm ci
      - run: npm run typecheck                       # tsc --noEmit (pack)
      - run: npm run test:run                        # vitest run — includes contracts/test/conformance.test.ts
      - run: npm run build                           # vite build → dist/app.js + dist/app.css
      - name: Size budget
        run: node scripts/check-size.mjs             # fail if dist/app.js > budget (see RELEASE_ENGINEERING)
      - uses: actions/upload-artifact@v4             # hand dist/ to the pages + release jobs without rebuilding
        with: { name: wp-dist, path: packs/corpan-city/dist }

  contracts-conformance:
    # Explicit, named gate even though vitest already runs it — the roadmap calls
    # for a *blocking* conformance check, surfaced as its own required status.
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: ./.github/actions/setup-node-cache
      - run: npm ci
      - run: npx vitest run contracts/test/conformance.test.ts --reporter=junit --outputFile=conformance.xml
      - run: node scripts/check-contracts-version.mjs   # assert CONTRACTS_VERSION matches server + client imports
      - uses: actions/upload-artifact@v4
        with: { name: conformance-report, path: packs/corpan-city/conformance.xml }

  server:
    runs-on: ubuntu-latest
    defaults: { run: { working-directory: packs/corpan-city/server } }
    steps:
      - uses: actions/checkout@v4
      - uses: ./.github/actions/setup-node-cache
      - run: npm ci
      - run: npm run typecheck                       # server tsc --noEmit (imports @corpan-city/contracts)
      - run: npm test --if-present                   # room-lifecycle / movement-validation units (added in P1)
      - run: docker build -t wp-server:ci .          # validate the Dockerfile builds (image not pushed on PR)
```

Notes that matter:
- **Required status checks** on the protected branch: `pack`,
  `contracts-conformance`, `server`. A PR can't merge red.
- **Caching.** The composite `setup-node-cache` keys the npm cache on
  `package-lock.json` hashes for both `packs/corpan-city` and
  `packs/corpan-city/server` (two lockfiles). Babylon + Playwright dev-deps make
  cold installs slow; warm installs are seconds.
- **No Playwright browser download on the unit gate.** `qa/mp-presence.mjs`
  (the two-window presence smoke) needs a browser and a running server; it's a
  separate, optional `workflow_dispatch` job, not on the PR critical path.
- **`docker build` on PR** validates the server image without pushing — catches a
  broken Dockerfile before tag time. No registry creds needed for a local build.

### 1.3 Release — `corpan-city-release.yml`

Trigger: `push` of a tag matching `corpan-city-v*` (e.g. `corpan-city-v0.1.0`).
Tag-scoping (not "on every merge to main") keeps publishes deliberate and maps
1:1 to the `CHANGELOG.md` version promotion (`[Unreleased]` → `0.1.0`).

Three sequential stages, each gated on the previous:

```yaml
name: corpan-city-release
on:
  push:
    tags: ['corpan-city-v*']
permissions:
  contents: read
  id-token: write          # OIDC → assume the AWS publisher role; NO long-lived keys in CI
jobs:

  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: ./.github/actions/setup-node-cache
      - run: npm --prefix packs/corpan-city ci
      - run: npm --prefix packs/corpan-city run test:run        # re-gate at tag
      - run: npm --prefix packs/corpan-city run build
      - name: Assemble pack zip (preview + full per two-zip model)
        run: node packs/corpan-city/scripts/pack-zip.mjs --version ${GITHUB_REF_NAME#corpan-city-v}
        # Emits corpan_city-<ver>.zip (+ SHA-256). If WP ships a Plus tier, also a
        # preview zip per CLAUDE.md's two-zip model (full → signed, preview → public).
        # The exact contract is owned by docs/RELEASE_ENGINEERING.md.
      - uses: actions/upload-artifact@v4
        with: { name: wp-pack, path: packs/corpan-city/build/*.zip }

  publish-catalog:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - uses: actions/download-artifact@v4
        with: { name: wp-pack, path: build }
      - name: Configure AWS (OIDC)
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::<acct>:role/corpan-ci-publisher   # least-priv, OIDC trust
          aws-region: us-east-2
      - name: Upload pack zip → S3
        run: aws s3 cp build/corpan_city-*.zip s3://corpan-prod/artifacts/pack-store/corpan-city/ --no-progress
      - name: Upsert corpan_city catalog entry
        run: python infra/scripts/publish_pack_catalog.py --pack corpan-city --version ${GITHUB_REF_NAME#corpan-city-v}
        # Mirrors ttsctl's catalog-upsert: download artifacts/catalog.json, upsert the
        # corpan_city entry (name/blurb/artwork/categories/ranking/localized strings +
        # downloadUrl/sha256/sizeBytes; preview/full/tier if gated), re-upload. Idempotent.
      - name: Invalidate CDN
        run: aws cloudfront create-invalidation --distribution-id E1RDNUCVE70SCI --paths '/catalog.json' '/pack-store/corpan-city/*'

  deploy-server:
    needs: publish-catalog
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Configure AWS (OIDC)
        uses: aws-actions/configure-aws-credentials@v4
        with: { role-to-assume: arn:aws:iam::<acct>:role/corpan-ci-deployer, aws-region: us-east-2 }
      - uses: aws-actions/amazon-ecr-login@v2
      - name: Build & push server image
        run: |
          IMG=$ECR/corpan-city-server:${GITHUB_REF_NAME#corpan-city-v}
          docker build -t "$IMG" packs/corpan-city/server
          docker push "$IMG"
      - name: Roll the ECS service
        run: |
          aws ecs update-service --cluster corpan-realtime --service wp-plaza \
            --force-new-deployment --task-definition wp-plaza:$REV
        # Register a new task-def revision pinned to the pushed image digest, then
        # roll. ECS deployment circuit-breaker auto-rolls-back on failed health checks.
```

Design points:
- **OIDC, not stored keys.** CI assumes scoped IAM roles
  (`corpan-ci-publisher` for S3/CDN, `corpan-ci-deployer` for ECR/ECS) via
  GitHub's OIDC provider. Zero long-lived AWS secrets in the repo or in Actions
  secrets. The existing `corpan-dgx-publisher` IAM *user* (long-lived keys, for
  the DGX box) stays for human/`ttsctl` publishes; CI gets its own role.
- **Catalog upsert reuses the proven pattern** from `ttsctl publish` step 3
  (download → upsert → re-upload `catalog.json`) — just a different entry kind
  and S3 prefix (`pack-store/` vs `narrations/`). Same CloudFront, same OAC.
- **Publish *before* server deploy.** The client (catalog entry) and server are
  versioned independently; the server is backward-compatible across the
  `CONTRACTS_VERSION` it advertises, so publishing the pack first is safe and a
  failed server roll never strands a published-but-unserved client.
- **Server URL is build-time config**, not a publish artifact — see §4.

### 1.4 Secrets hygiene in logs
- All `aws` calls use OIDC short-lived creds; nothing to leak.
- `::add-mask::` any value that must transit a step output (none currently do —
  signing keys live in Secrets Manager and are read by the Lambda at runtime,
  never by CI).
- The OpenAI key for i18n (`generate-catalog-assets.py` / localization) is **not**
  used in CI; localization is a DGX/human batch step (§4). If it ever moves into
  CI, it's a masked GitHub Actions secret consumed only by that job.

---

## 2. GitHub Pages — the standalone demo

### 2.1 What it is
A static, public, playable build of the pack via its `mountStandalone` path
(`index.html` → `src/main.ts`) — the marketing/demo page. Single-player +
local-NPC works fully; **multiplayer presence connects to the prod Colyseus
endpoint** (best-effort, the pack degrades to solo if the server is unreachable,
per `MULTIPLAYER.md` "Best-effort. No server → the world runs solo").

### 2.2 Build — `corpan-city-pages.yml`

Triggers: `push` to `main` filtered to `packs/corpan-city/**`, plus the release
tag (so a release always refreshes the demo). Uses GitHub's first-party Pages
actions (`upload-pages-artifact` + `deploy-pages`), `pages: write` +
`id-token: write` permissions, one `github-pages` environment.

```yaml
name: corpan-city-pages
on:
  push: { branches: [main], paths: ['packs/corpan-city/**'] }
  workflow_run:                     # also after a successful release
    workflows: [corpan-city-release]
    types: [completed]
permissions: { contents: read, pages: write, id-token: write }
concurrency: { group: pages, cancel-in-progress: false }
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: ./.github/actions/setup-node-cache
      - run: npm --prefix packs/corpan-city ci
      - name: Build standalone demo
        run: npm --prefix packs/corpan-city run build
        env:
          VITE_BASE: /corpan-city/                       # project-page base path
          VITE_PLAZA_SERVER_URL: wss://plaza.encorpora.io  # prod realtime endpoint
          VITE_DEMO: '1'                                   # demo flag → friendly "this is a preview" chrome
      - name: Stage site (index.html + dist + bundled demo assets)
        run: node packs/corpan-city/scripts/stage-pages.mjs   # see §2.3
      - uses: actions/upload-pages-artifact@v3
        with: { path: packs/corpan-city/.pages }
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment: { name: github-pages, url: ${{ steps.dep.outputs.page_url }} }
    steps:
      - id: dep
        uses: actions/deploy-pages@v4
```

Two build notes:
- The pack today builds as an **IIFE lib** (`vite.config.ts` `build.lib`) for the
  host. The Pages demo needs a *self-loading* page: `index.html` already exists
  and pulls `src/main.ts`. The `stage-pages.mjs` step assembles a deployable
  tree = the built `dist/app.js`+`app.css` + a thin `index.html` that mounts
  standalone (or, simpler, a second vite config `vite.pages.config.ts` with a
  normal `index.html` entry and `base: VITE_BASE`). Either way it's a static
  bundle — no SSR, no server.
- `VITE_BASE` makes asset URLs work under the project-page sub-path
  `https://corpora-inc.github.io/<repo>/corpan-city/`. A custom domain
  (`plaza-demo.encorpora.io`) is a `CNAME` file drop if desired.

### 2.3 Assets — the Spark-asset boundary
Per `docs/SPARK_ASSETS.md` and the memory note, **the HD-2D look is procedural
3D world + 2D billboard "paper people"; heavy Spark/3D asset kits live *outside*
the pack** and are served from the host's public dir at runtime. The demo can't
reach the host, so:
- **The committed pack is self-contained** for the demo: procedural geometry +
  the lightweight billboard cutouts + the `content/` JSON (topologies, scenes,
  quests) are all in-repo and bundled by vite (`assetsInclude` already lists
  `.glb/.webp/.png/.mp3`). That's the demo's asset source — no external fetch.
- **Optional premium Spark kit** (when `create3DLook()` lands): served from the
  same CloudFront CDN under a `scenes/`/`themes/` prefix, loaded lazily behind
  the `WorldLook` seam. The demo either ships the free look only, or fetches the
  *public* (non-signed) subset from `d38iwc9748jekz.cloudfront.net` with CORS
  (the existing `cors` response-headers policy already allows `GET/HEAD *`).
  Plus-gated assets are never in the demo.
- **Cache/CDN for the demo itself:** GitHub Pages fronts its own CDN with
  immutable hashed-asset caching; vite's `assetFileNames` hashing gives long
  `cache-control`. No extra CloudFront needed for the demo bytes.

---

## 3. Terraform → AWS

All new resources land in the **existing root** `corpan/infra/terraform/`,
refactored into modules so WP's realtime tier is isolated and the existing
verify/CDN/analytics resources are untouched. Region `us-east-2`, account and
remote backend (`corpan-tf-state`) shared. **Add a DynamoDB lock table** now
that CI will `plan`/`apply` (the current `backend.tf` notes locking is deferred
to "if a second operator appears" — CI *is* that second operator).

### 3.1 Module shape

```
infra/terraform/
├── backend.tf  provider.tf  versions.tf       # existing — add dynamodb lock
├── main.tf  analytics.tf  s3_admin.tf  …       # existing verify/CDN/analytics (unchanged)
├── envs/
│   ├── staging/  (terraform.tfvars + backend key corpan-staging/…)
│   └── prod/     (terraform.tfvars + backend key corpan-prod/…)
└── modules/
    ├── realtime/        # (a) Colyseus on Fargate + ElastiCache Redis  ← NEW, the core
    ├── durable-api/     # (b) RDS Postgres for the economy             ← NEW, flag-gated off
    ├── cdn-packstore/   # (c) reuses the EXISTING distribution; adds pack-store/scenes prefixes + bucket policy
    ├── observability/   # (d) CloudWatch dashboards/alarms + log groups + (opt) Sentry DSN secret
    └── dns-tls/         # (e) Route53 records + ACM certs (plaza.encorpora.io, ALB cert)
```

Environments are separate state keys + tfvars, **not** workspaces (clearer blast
radius; staging can run a single tiny task + `cache.t4g.micro` Redis, prod
autoscales). `enable_*` booleans mirror the existing convention (`enable_cdn`,
`enable_premium_content`) so prod-only pieces stay off in staging/cost-sensitive
applies.

### 3.2 (a) `realtime/` — Colyseus + Redis (the only genuinely new tier)

Why containers, not Lambda: Colyseus holds **long-lived stateful WebSocket
rooms** with an authoritative in-memory tick loop — the opposite of Lambda's
stateless request model. Fargate (serverless containers, no EC2 to patch) is the
fit; ElastiCache Redis is the `@colyseus/redis-driver` + presence backplane that
lets *multiple* nodes share the room directory so "join plaza" matchmaking works
across tasks (the P1 "horizontal scale (Redis)" requirement; today the server is
single-process `index.ts`).

Resources:
- **ECS Fargate cluster** `corpan-realtime` + service `wp-plaza`.
  - Task: 0.25 vCPU / 0.5 GB to start (the presence loop is light; ~30 clients
    per room, `maxClients = 30` in `PlazaRoom.ts`). One container exposes the WS
    port; `PORT` env from the task def.
  - **`@colyseus/redis-driver`** for the shared room registry + **Redis
    presence** so matchmaking/`enableRealtimeListing()` spans nodes. The current
    `index.ts` uses the default in-memory driver — P1 swaps in the Redis driver
    behind a `REDIS_URL` env (absent → in-memory, preserving local dev).
- **ElastiCache (Redis OSS / Valkey)** `cache.t4g.micro` single-node in staging,
  small replication group (1 primary + 1 replica, multi-AZ) in prod. Private
  subnets, SG allows 6379 only from the Fargate task SG. This is the "managed
  Redis (ElastiCache) for horizontal scale" requirement.
- **Networking:** an **ALB** (or NLB) in public subnets → Fargate tasks in
  private subnets. ALB does TLS termination (ACM cert from `dns-tls/`) and
  WebSocket upgrade (ALB supports WS natively; idle timeout raised to ~300s so
  long-lived plaza connections aren't reaped). Health check hits a `/healthz`
  HTTP route added to `index.ts`'s `createServer()`.
- **Autoscaling + cheap idle floor** (the cost-aware CCU requirement):
  - **Target-tracking** on a custom CloudWatch metric (CCU or room count, pushed
    by the server) — scale out when avg CCU/task crosses a band, scale in below.
    Fall back to ALB `ActiveConnectionCount` per target if a custom metric isn't
    wired yet.
  - **Idle floor = 1 task** in prod (always-on so the demo + early users never
    hit a cold container), **desired = 0 allowed in staging** (scale-to-zero off
    hours via a scheduled action to save money). Fargate Spot for the
    *overflow* tasks above the floor (presence is best-effort; a Spot reclaim
    just drops players into reconnect, which `allowReconnection(20s)` already
    tolerates) — on-demand for the floor task.
  - Max-task cap as a guardrail so a CCU spike can't run up an unbounded bill.

Cost note: the steady-state floor is ~1 small Fargate task + 1 micro Redis ≈
low-tens of dollars/month; it only grows with real concurrent players, and Spot
overflow keeps the marginal cost of a spike low.

### 3.3 (b) `durable-api/` — economy durability (deferred, flag-gated OFF)

The economy is **localStorage-only today** (`store/progress.ts`,
`ECONOMY_CURRENCY.md`) and the roadmap puts player↔player exchange / order book
in **Wave 4 (post-MVP), "needs the server."** So this module exists but is
`enable_durable_economy = false` until then:
- **RDS Postgres** (`db.t4g.micro`, single-AZ staging / multi-AZ prod, gp3,
  storage-encrypted, private subnets, SG from the Fargate task SG only).
  Holds the durable wallet/ledger + trade order book — the only data that *must*
  survive a device wipe and be authoritative across players. Credentials in
  Secrets Manager (RDS-managed rotation).
- The economy API rides the **same Fargate service** (the Colyseus process can
  expose authenticated HTTP routes) rather than a separate Lambda, so the
  realtime room and the ledger share one transactional process. Keep it off the
  hot movement path.
- **Until enabled:** no server economy, no PII, no login — fully consistent with
  the "no real-money economy; on-device privacy" non-negotiables.

### 3.4 (c) `cdn-packstore/` — static/CDN (reuse, don't rebuild)

This module **does not create a new distribution.** It mirrors the existing
posture in `main.tf`:
- The `corpan-city` pack zip + catalog entry live under existing
  `corpan-prod/artifacts/pack-store/` and `catalog.json` — already covered by
  the OAC bucket policy (`artifacts/*`) and the `CachingOptimized` + CORS
  behaviors on `E1RDNUCVE70SCI`.
- New optional prefixes for scene/theme/asset packs (`scenes/`, `themes/`) sit
  under `artifacts/` too — **no new CloudFront behavior needed** for the public
  subset (default behavior already serves `artifacts/*`).
- **Signed URLs for Plus-gated content:** reuse the existing
  `narrations/premium/*` `trusted_key_groups` pattern. If WP gates a premium
  asset kit or a full-experience zip, add a `pack-store/corpan-city/premium/*`
  ordered cache behavior bound to the **same** `premium` key group + the verify
  Lambda's signing path (`isTwoZipEntry` / `requestSignedDownload`). No new keys,
  no new Lambda — the two-zip preview/full model from `CLAUDE.md` drops straight
  in.

### 3.5 (d) `observability/`
- **CloudWatch** log group per Fargate service (retention 14d for app logs,
  cheap), a dashboard (CCU, task count, ALB 5xx, room-create rate, p95 message
  latency), and **alarms** → SNS: server 5xx spike, task crash-loop (ECS service
  events), Redis evictions/CPU, RDS connections (when enabled).
- **Error tracking:** Sentry (DSN in Secrets Manager, injected as task env) for
  unhandled server exceptions + the mediated-chat moderation path — preferred
  over rolling our own. The pack client keeps Corpán's **on-device-only**
  analytics posture; we do **not** add a client error-reporting SaaS (privacy
  non-negotiable).
- The existing **anonymous analytics lake** (`analytics.tf`,
  CloudFront→Lambda→Firehose→S3/Athena, IP-stripped, country-only) is the channel
  for any WP gameplay pulse (`ANALYTICS_PULSE.md`) — reuse it; do not add a
  second pipeline.

### 3.6 (e) `dns-tls/`
- **Route53**: `plaza.encorpora.io` → ALB (realtime WS endpoint, `wss://`);
  optional `plaza-demo.encorpora.io` → GitHub Pages (CNAME). The existing
  `cdn.encorpora.io`/`verify.encorpora.io` records are untouched.
- **ACM**: regional cert (`us-east-2`) for the ALB. (CloudFront certs stay in
  `us-east-1` per the existing `aws.us_east_1` provider alias — unchanged.)

### 3.7 IAM — least privilege
- **CI roles (OIDC):** `corpan-ci-publisher` (S3 `pack-store/*`+`catalog.json`,
  CloudFront invalidate — a scoped clone of the existing `dgx_publisher` user
  policy), `corpan-ci-deployer` (ECR push, `ecs:UpdateService` +
  `ecs:RegisterTaskDefinition` + `iam:PassRole` for the task exec role, scoped to
  the `corpan-realtime` cluster).
- **Runtime task role:** the Fargate task gets only what the server needs —
  `secretsmanager:GetSecretValue` on its own secret (Redis URL, Sentry DSN, and
  later RDS creds + the OpenAI key if mediated-chat runs server-side),
  ElastiCache connect via SG, RDS connect via SG. No S3, no broad perms.
- **Terraform admin** stays the human `~/.env` admin user (or a dedicated
  `corpan-ci-terraform` OIDC role if CI ever runs `apply`).

---

## 4. Secrets & config

| Secret | Where it lives | Consumed by | Never |
| --- | --- | --- | --- |
| AWS publish/deploy creds | **GitHub OIDC → assume-role** (no stored keys) | CI publish/deploy jobs | committed; in Actions secrets as long-lived keys |
| AWS admin (terraform) | `~/.env` on operator box (existing) | human `terraform apply` | in CI without a scoped OIDC terraform role |
| CloudFront signing private key | **Secrets Manager** `corpan/content-packs/verify` (existing) | verify Lambda (signs Plus URLs at runtime) | in CI, in the pack, in logs |
| OpenAI key (i18n / mediated chat) | DGX `~/.env` for batch localization; **Secrets Manager** for the server if chat runs server-side; Actions secret only if i18n moves into CI | localization batch / Fargate task | in the client bundle |
| Sentry DSN | Secrets Manager → Fargate task env | server | in the client |
| Redis URL / RDS creds | Secrets Manager → Fargate task env (RDS-managed rotation) | server | in the image, in the repo |
| **Realtime endpoint** (`wss://plaza.encorpora.io`) | **build-time `VITE_PLAZA_SERVER_URL`** (public, not a secret) | pack + Pages demo at `vite build` | — it's a public URL; bake it into the catalog/build, don't fetch it at runtime |

Rules (consistent with the repo's posture):
- **No login, no per-user secrets** (Apple/Google = identity); there is no auth
  server holding user credentials. Mediated-chat moderation runs server-side or
  on-device, never trusting the client.
- **Signing keys never leave AWS.** The client asks the verify Lambda for a
  signed URL; the private key stays in Secrets Manager, read only by the Lambda
  (existing `requestSignedDownload` flow).
- **Public config in the build, secrets at runtime.** The server URL and CDN
  domain are public and baked at build time; anything sensitive is fetched by
  the server from Secrets Manager on boot.

---

## 5. Phased rollout

Mapped onto `PRODUCTION_ROADMAP.md` P4 → P5. Each phase is independently
shippable and reversible.

### Phase A — CI gate + pack publish + Pages demo (P4, MVP) ✅ ship first
1. Bootstrap `corpan/.github/` + the composite cache action.
2. `corpan-city-ci.yml`: typecheck + vitest + build + **conformance gate** +
   server typecheck/build. Mark `pack`/`contracts-conformance`/`server` as
   required checks. **No AWS yet** — pure quality gate, zero infra risk.
3. `corpan-city-release.yml` `build` + `publish-catalog` stages only (OIDC
   `corpan-ci-publisher`, pack zip → `pack-store/`, catalog upsert, CDN
   invalidate). Reuses the entire existing S3/CloudFront stack.
4. `corpan-city-pages.yml`: standalone demo on GitHub Pages (`VITE_DEMO=1`,
   solo-only if no server yet).

**Outcome:** PRs gated, tagging publishes the pack + refreshes the demo, all on
*existing* AWS. No new cloud resources. Lowest-risk, highest-leverage slice.

### Phase B — server deploy + Redis (P1 productionizes the realtime tier)
1. Land `modules/realtime/` (Fargate + ALB + ACM + Redis) in **staging** first
   (single task, `t4g.micro` Redis, scale-to-zero off-hours).
2. Add the `@colyseus/redis-driver` + `/healthz` to `server/` (behind
   `REDIS_URL`/`PORT` envs; absent → today's local single-process behavior).
3. Add the `deploy-server` stage to the release workflow (ECR + `ecs:update`).
4. Point the Pages demo + the catalog'd build at `wss://plaza.encorpora.io`.
5. Promote staging → **prod** (idle floor = 1 on-demand task + Spot overflow,
   multi-AZ Redis).

**Outcome:** real two-window-on-different-devices presence in prod, horizontally
scalable, cheap at idle. This unblocks P1's load/anti-cheat/rate-limit work.

### Phase C — full Terraform: realtime + (gated) API + CDN modules (P5)
1. Refactor existing `main.tf`/`analytics.tf` resources into `modules/` cleanly
   (no resource churn — `terraform state mv`, plan must show zero changes).
2. Add `cdn-packstore/` (scene/theme prefixes; Plus-gated signed-URL behavior if
   WP gates content), `dns-tls/`, and the **DynamoDB lock table** for the now
   CI-driven state.
3. `durable-api/` (RDS) **authored but `enable=false`** until economy E2-E4
   needs server authority.

### Phase D — observability + autoscale hardening (P5 cont.)
1. `observability/` module: CloudWatch dashboard + alarms → SNS, server log
   groups, Sentry DSN wired to the task.
2. Server pushes the custom CCU metric; switch ECS autoscaling from
   ALB-connection-count to **target-tracking on CCU** with the idle floor + max
   cap. Validate scale-out/in under a synthetic load (`qa/mp-presence.mjs`
   fanned to N clients).
3. Cost review: confirm the idle floor + Spot overflow + scale-to-zero-staging
   keep steady-state in the low-tens-of-dollars range.

---

## 6. Open items / handoffs
- **`RELEASE_ENGINEERING.md` owns** the exact pack-zip layout, the two-zip
  preview/full split decision (is WP free or Plus-gated?), the `manifest.json`
  fields, and the full set of `corpan_city` catalog fields. This doc's
  `publish-catalog` stage *calls* that contract — keep them in sync.
- **`MULTIPLAYER_PROD.md` owns** the server-side room directory / reconnect-TTL /
  rate-limit / anti-cheat / Redis-driver code. This doc deploys whatever that
  doc produces; the only coupling is the `REDIS_URL`/`PORT`/`/healthz` envs and
  the custom CCU metric the autoscaler reads.
- **Repo-root `.github/` is new** — confirm with the owner before adding the
  first workflow tree (it affects every pack, not just WP). The PUBLISHING.md
  reference to `hover-runner-pages.yml` suggests a Pages workflow was intended
  but isn't committed here; align with whatever exists in the deploy repo before
  duplicating it.
- **State locking:** adding the DynamoDB lock table is a prerequisite before CI
  ever runs `terraform apply` (currently human-only, single-operator).
- Commit/push + iOS builds stay the owner's by default (memory:
  `feedback_git_workflow`); this doc is design-only and stages nothing.
