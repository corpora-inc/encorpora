# Corpán — Pack Types & Publishing

How the things Corpán ships actually get to users. There are two delivery
pipelines (GitHub Pages and S3/CloudFront), split by artifact size and gating.

> TL;DR
> - **Content/experience packs** (Teletron, Corpan City, readers, etc.) → built and
>   published to **GitHub Pages** automatically by a GitHub Action **on every push
>   to `main`**. A pack reaches existing users only when its **manifest `version`
>   bumps** (installs are version-gated).
> - **Narration packs, models, and per-language sqlites** (the big, premium, or
>   signed assets) → **S3 (`corpan-prod`) → CloudFront CDN**, published out-of-band
>   (e.g. `ttsctl publish`). See `corpan/infra/PUBLISHING.md`.

---

## 1. Content / experience packs → GitHub Pages

These are the in-app "experiences": web packs (HTML/JS/CSS) built with Vite, each
bundling the `@shared/*` libraries it uses. As of this writing the workflow builds:

`hover-runner`, `hanzipan` (Hanzi Atelier), `juice-squeeze`, `stargate-reader`,
`earthgate-reader`, `world-radio`, `tutomaton` (+ a legacy 0.3.2), `corpan-city`,
`teletron`, `pronunciation-coach` (+ a legacy 0.3.5).

### How they publish
`.github/workflows/deploy-pages.yml`, triggered by `push` to `main` whose paths
touch `corpan/packs/**` (among others). For each pack the job:

1. `npm install` → `npm run build` (Vite → `dist/`).
2. `node scripts/pack.mjs` → zips `manifest.json` + `dist/` + assets into `<id>.zip`.
3. Copies `manifest.json`, `dist/`, and `<id>.zip` into `web/io/out/corpan/packs/<id>/…`.
4. `node web/pages/build.js` reads **every pack's `manifest.json`** (version +
   localized fields like `tagline`/`descriptionLocalized`) and generates the
   content-pack **`catalog.json`** with **version-stamped URLs**.
5. `actions/upload-pages-artifact` → GitHub Pages deploy.

### How the app fetches them
- Served from the custom domain: `https://encorpora.io/corpan/packs/…`.
- The app fetches `https://encorpora.io/corpan/packs/catalog.json`
  (`PRODUCTION_CATALOG_URL` in `corpan-app/src/contentPacks/catalog.ts`), with a
  built-in `@/experiences/registry` fallback for older runtimes.
- **Installs are version-gated** (`corpan-app/src/contentPacks/install.ts` +
  `catalog.ts` compare the catalog version to the installed one). **Bumping a
  pack's `manifest.version` is what triggers a re-download.** No app binary or
  TestFlight build is needed to ship a content/config/copy change.

### The shared-code coupling (read this before changing `shared/*`)
`corpan/packs/shared/*` (`moderation`, `net`, `catalog`, `ui`, `ad`, `core`,
`data`, `state`, `asr`, `audio`, `analytics`, `sdk`) is **bundled into each
consuming pack at build time** — there is no runtime shared module.

Consequences:
- Changing shared code does **not** auto-ship. Each consuming pack must be
  **rebuilt AND version-bumped** to deliver the change to users.
- The deploy workflow rebuilds *all* packs on every `main` push, so their Pages
  bytes update — but version-gating means existing users only re-download packs
  whose `version` actually changed.
- Worked example: the gate/eject rewrite of `shared/moderation` shipped to
  **Teletron** (bumped to 0.1.8) immediately, but stayed **latent for Corpan
  City** until its `version` was bumped (0.1.6) even though its Pages bytes had
  already been rebuilt with the new shared code.

---

## 2. Narration packs, models, language data → S3 / CloudFront

The big and/or premium-gated artifacts go to S3 (`s3://corpan-prod/artifacts/`)
behind a CloudFront CDN — not GitHub Pages (size, signed URLs, preview/full split).

- **Narration packs** — one voice reading one book in one language (~50–60 MB ZIP
  of audio + book data, not reader code). Published with `ttsctl publish` (boto3 +
  a publisher AWS profile, run on the build box), which also writes the S3
  `catalog.json` (CatalogV2). Full runbook: **`corpan/infra/PUBLISHING.md`**.
  Premium books ship a public **preview** ZIP and a CloudFront-**signed full** ZIP
  (free tier is server-truncated, not client-gated — see `corpan/CLAUDE.md`).
- **Models** — e.g. the shared Qwen3-4B base GGUF (~2.5 GB). Served from
  S3/CloudFront, downloaded into the app data dir on demand, referenced in the
  catalog with size + minimum app version.
- **Per-language content sqlites / phrase packs** — stream from the CloudFront
  catalog (the app downloads the language module it needs).

These are published **out-of-band** (a person/script with AWS creds), *not* by the
`main`-push GitHub Action.

---

## 3. Releasing a content pack — checklist

1. Make the change (pack code and/or its bundled `shared/*`).
2. **Bump `manifest.version`** (semver) — this is the only thing that makes
   existing users update. If you changed a `shared/*` lib that other packs bundle,
   bump **each** consuming pack you want the change to reach.
3. Update the pack's `CHANGELOG.md` (`[Unreleased]` → dated version per
   `corpan/CHANGELOGS.md`).
4. Land on `main` (PR → squash). The `deploy-pages` Action builds + publishes.
5. Verify the run succeeded (`gh run list --workflow=deploy-pages.yml`) and that
   `https://encorpora.io/corpan/packs/catalog.json` shows the new version.

---

## 4. Make it more robust (open ideas)

Today's pipeline is simple and free but has sharp edges worth smoothing:

- **Auto-bump on shared change.** A shared-lib change that silently leaves a
  consuming pack on stale bundled code is the main footgun. Track each pack's
  `shared/*` dependencies and fail CI (or auto-bump) when a consumed lib changed
  without a pack version bump.
- **Only rebuild what changed.** The job rebuilds every pack on every push.
  Per-pack path filters + a build cache (node_modules, Vite) would cut deploy time
  and blast radius. Split into per-pack jobs with an **atomic catalog swap** so a
  mid-deploy failure can't leave a partial catalog.
- **Unify the two catalogs.** Content packs (Pages, `build.js`) and
  narrations/models (S3, `ttsctl`) use separate catalog generators and schemas.
  One generator + one schema would reduce drift.
- **Consider CloudFront for content packs too.** Pages is fine now, but signed
  URLs / premium gating / preview-full split (already solved for books on
  CloudFront) and larger content packs argue for moving content packs onto the
  same CDN path eventually.
- **Staging/preview env.** A preview Pages/CDN deploy per PR to eyeball a pack
  before it hits `main` (and therefore prod).
- **Integrity + rollback.** Version-stamped URLs are good; add content hashes and
  a published-artifacts manifest for verification and one-command rollback.
