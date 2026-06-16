# Corpan packs (two-phase rollout)

> **Building or running a pack locally?** See **[PACK_DEV.md](./PACK_DEV.md)** —
> the canonical boilerplate & dev standards (manifest contract, build config,
> the shared on-device dev server, asset fetching, the new-pack checklist). It
> exists so packs stop reinventing dev tooling. The shared dev harness lives in
> [`shared/dev/`](./shared/dev/README.md).

This repo uses a two-phase approach for pack delivery so the dev app matches the production app as closely as possible.

## Phase 1 (now): Manifest install flow
- Packs are installed from a manifest URL (works in dev and release builds).
- In dev, the host polls for manifest changes and auto-reloads.
- In release, the same manifest URL flow is available but hidden behind a developer unlock.

### Developer unlock (manifest URL input)
- Open Settings.
- Scroll to the bottom past the company info.
- Tap the "Corpan" label 7 times.
- The manifest URL input appears at the bottom of Packs.

Feature flags:
- `VITE_ENABLE_PACKS=true` shows the Packs panel (prod override).
- Dev unlock persists via `localStorage` key `corpan:dev-packs`.

## Phase 2 (next release): In-app purchase flow
- Store-based purchase flow (Apple/Google) + verify endpoint.
- Hidden in the UI for now until billing setup is released.

## Publishing — how a pack reaches encorpora.io (READ THIS)

**A merge to `main` IS the deploy. Nobody builds or uploads pack zips by hand —
there is no SSH/rsync/manual-upload step, and an agent cannot push to the host.**
Do not ask whether you should "build the zip and put it on encorpora.io"; that
is not a thing.

- **Code / game packs** (beatlounge, corpan-city, hover-runner, hanzipan,
  juice-squeeze, world-radio, the readers, …) ship via GitHub Actions →
  GitHub Pages. On every push to `main` that touches `corpan/packs/**`,
  [`.github/workflows/deploy-pages.yml`](../../.github/workflows/deploy-pages.yml)
  installs deps, `npm run build`s each pack, zips it, and publishes it to
  `https://encorpora.io/corpan/packs/<id>.zip` (the `manifestUrl`/`zipUrl` the
  catalog points at). **To ship a new version: bump the manifest `version`
  (and the matching `catalog.ts` entry), merge to `main`. Done.** The next
  Pages run rebuilds and publishes the zip automatically.
- **Catalog metadata is OTA, no app release.** `catalog-v3.json` (including each
  pack's localized name/description) is *regenerated from the manifests* on every
  Pages build and served from the same Pages host, so metadata/translation
  changes reach clients without an app store release.
- **Hard localization gate.** The Pages build runs
  `assertCompleteCatalogLocalization` (`web/pages/build.js`): any catalog pack
  with `requireCompleteLocalization: true` (currently only **`corpan_city`**)
  MUST carry `nameLocalized` + `descriptionLocalized` for **every** locale under
  `corpan-app/public/locales/`. One missing locale throws and fails the WHOLE
  deploy (so a stale gate can silently block unrelated pack releases). When you
  add a new app language, backfill that pack's manifest in the same change.

> Narration packs (books) and phrase packs are the exception — those do NOT go
> through GitHub Pages. They publish to S3 / CloudFront via
> `corpan/infra/patch-catalog.py` and the phrase-pack `publish.py`. That S3/CDN
> path is the only place "pushing content" is a real step, and it's for book
> audio / phrase data, not code packs.

## Reference pack
- `hover-runner` is the reference implementation.
- `hanzipan` is the Mandarin character pack (pack-owned DB + handwriting surface).
