# World Plaza — Release Engineering (0.1.0 → catalog)

**Status:** design / runbook. This is the P3 deliverable from
`docs/PRODUCTION_ROADMAP.md`. It describes how to ship World Plaza **0.1.0** to
the Corpán catalog using the *existing* pack-build, GitHub-Pages publish,
catalog-v3, and streaming-install machinery — no new infra. Where a gap exists
it is called out honestly with the smallest correct fix.

Nothing here is built yet beyond what's already in the tree. Treat the
checklists as the work.

---

## 0. TL;DR (the decisions)

- **Build**: unchanged. `vite build` → an **IIFE** `dist/app.js` + `dist/app.css`.
  The pack ZIP is `manifest.json` + `dist/` only (all `content/*.json` is
  `import`-bundled at build time — verified — so nothing else ships).
- **Manifest**: bump `version` `0.0.1` → **`0.1.0`**; keep `id: world_plaza`,
  `entry: dist/app.js`, `styles: [dist/app.css]`, `entryType: script`. No new
  permissions (HostApi gives TTS + LLM; Colyseus presence is an outbound WS the
  WebView already allows).
- **Catalog**: one **`catalog-v3` `packType: "game"` entry**, `zipUrl` =
  `https://encorpora.io/corpan/packs/world-plaza.zip`, mirroring the `world_radio`
  entry shape exactly. **Free, public ZIP** for 0.1.0 (decision + rationale in §4).
  The pack *is* the premium pitch; we do not gate v1.
- **Artwork**: own cover + thumbnail, **rendered from the in-pack `IconRenderer` /
  cutout art language** (`src/items/itemArt.ts`, `src/world/cutoutArt.ts`) so the
  store art is the same paper-world it ships — never reuse another app's logo.
- **Versioning**: promote `CHANGELOG.md` `[Unreleased]` → `[0.1.0] - <date>` per
  `corpan/CHANGELOGS.md`; the manifest `version` and the changelog heading must
  match.
- **Publish path**: a `world-plaza` block in `.github/workflows/hover-runner-pages.yml`
  (build → zip → copy into `web/io/out`), then a `catalog-v3` entry pushed via the
  existing `infra/patch-catalog.py` / S3+CloudFront flow.

---

## 1. The production pack build

### 1.1 What the build emits

`vite.config.ts` is already correct for a host pack and needs **no change**:

- `build.lib` → **IIFE**, `name: "WorldPlaza"`, single file `dist/app.js`.
- CSS is collapsed to a single `dist/app.css` (`assetFileNames`).
- A `banner` shims `globalThis.process` (Babylon/zod expectation) and
  `define["process.env"] = {}` — both needed because the host WebView has no Node.
- `copyPublicDir: true` — currently there is no `public/` payload; all content is
  `import`-bundled (`src/game.ts` imports `../content/**/*.json`; economy/market
  modules import their tables). **Confirmed**: the only build outputs are
  `app.js` + `app.css`. The ZIP therefore needs only `manifest.json` + `dist/`.

### 1.2 IIFE / host-mount contract (already satisfied)

`src/main.ts` registers `globalThis.CorpanGames["world_plaza"] = { id, mount }`.
The host's `ContentPackHost` injects the IIFE + CSS, then calls `mount(container,
hostApi)`. The module is **idempotent**: it disposes any prior instance and clears
the container before constructing a new game (the StrictMode double-mount fix —
"2 Babylon boots in the console" is the regression tell; verify exactly one).

- **Standalone / web demo (`mountStandalone`)**: `main.ts` also boots into
  `#corpan-game-root` when present (vite dev / `index.html`), with `hostApi`
  undefined → the game's mock host (mock TTS + mock LLM). This is the path the
  GH-Pages playable demo (P4) serves. Keep it: it is the marketing/dev surface and
  it must stay in the production bundle (it's a cheap `getElementById` guard).

### 1.3 Size budget

| Artifact | Now | Budget for 0.1.0 |
| --- | --- | --- |
| `dist/app.js` (raw) | ~1.87 MB | ≤ 2.5 MB |
| `dist/app.js` (gzip) | ~0.47 MB | ≤ 0.6 MB over the wire |
| `dist/app.css` | ~44 KB | ≤ 80 KB |
| ZIP total | ~0.5 MB gz | trivial vs. the 8 GiB installer ceiling |

The bulk is Babylon core/gui/loaders. This is **well within** the
`content_packs.rs` `DOWNLOAD_MAX_BYTES` (8 GiB) and far smaller than any
narration pack (~50–60 MB) — World Plaza is a *code* pack, not a media pack.
Tree-shaking is already on via per-feature Babylon imports (e.g.
`@babylonjs/core/Meshes/meshBuilder`); **keep importing Babylon by deep path**,
never the barrel, or the bundle balloons. Re-measure gzip on each release; if it
crosses 0.6 MB, audit for an accidental barrel import before shipping.

### 1.4 Minify / source-map posture

- **Minify**: default (esbuild) — ON. Good.
- **Source maps**: leave **OFF** for the shipped ZIP (default). They'd ~double
  the payload and the on-device console already forwards logs (`packs/sdk/
  devConsole.ts`). If a release ever needs field debugging, build a one-off with
  `build.sourcemap: true` for local install only — do **not** publish maps.
- **No `console` strip**: keep logs. Repo rule is *noisy, not silent* errors
  (memory: `feedback_noisy_errors`); the on-device pipeline reads them.

### 1.5 Server is NOT in the pack

`server/` (Colyseus presence) is **out of scope for the pack ZIP** — it deploys
separately (roadmap P1/P5, Terraform). 0.1.0 ships the client; multiplayer
presence connects to the deployed endpoint (or degrades to solo if unreachable —
the client must treat the room as optional, never block entry on it). Confirm the
WS endpoint is config/catalog-driven, not hardcoded to localhost, before release.

---

## 2. `manifest.json` for 0.1.0

Current manifest is dev-shaped (`version: 0.0.1`, a `devRevision` stamp). Target:

```json
{
  "id": "world_plaza",
  "name": "World Plaza",
  "version": "0.1.0",
  "entry": "dist/app.js",
  "styles": ["dist/app.css"],
  "entryType": "script",
  "sdkVersion": "0.1.0",
  "nameLocalized": { "en": "World Plaza" },
  "descriptionLocalized": {
    "en": "A living town where you meet AI characters and real players, follow a personal journey, and turn every encounter into a language lesson."
  }
}
```

Notes:

- **What the host reads from the manifest**: `content_packs.rs::read_manifest_info`
  pulls `id` / `name` / `version`; the installer asserts `manifest_id == pack_id`
  (so the catalog `id` and manifest `id` MUST both be `world_plaza`). The runtime
  mount reads `entry` + `styles` + `entryType`. Everything *catalog-facing*
  (blurb, artwork, categories, localized name) comes from the **catalog**, not the
  manifest — per `feedback_catalog_driven_everything`. The manifest stays thin.
- **`devRevision`**: harmless (the vite plugin re-stamps it on each build). It's a
  dev cache-buster; leave it. Don't hand-edit it.
- **Permissions**: none to declare. The pack uses only what HostApi grants (TTS,
  on-device Qwen3 LLM, navigation) plus an outbound WebSocket for presence. There
  is no manifest permission system to populate today.
- **Kill the dev catalog entry**: `corpan-app/src/contentPacks/catalog.ts`
  `DEV_CATALOG` has a `world_plaza` `0.0.1` entry pointing at
  `/packs/world-plaza/manifest.json`. That is a *dev-only* convenience. On release
  it should be **bumped to `0.1.0`** (so dev mirrors prod) but the real source of
  truth is the published `catalog-v3` entry (§3). Do not rely on `DEV_CATALOG` for
  shipping — it's the in-binary fallback only.

---

## 3. Catalog publish (the entry shape)

World Plaza is a **game pack** → it goes in **`catalog-v3`** as a
`packType: "game"` entry (same lane as `world_radio`, `hover_runner`,
`hanzipan`). The app fetches `catalog-v3.json` for hosts ≥ 0.10.0
(`fetchGameCatalog` in `catalog.ts`), filters by `minAppVersion` /
`maxAppVersion` / `channel` / `platforms`, and maps `zipUrl` → the install
`manifestUrl`. `installPack` sees a `.zip` URL → routes to
`installPackFromDownload` → Rust `content_packs_install_from_url` (stream-to-disk,
SHA-256 verify, `safe_extract_zip`, manifest-id check). **This is the exact path
World Plaza rides; nothing new is needed.**

### 3.1 The `catalog-v3` entry (mirrors `world_radio`)

```json
{
  "id": "world_plaza",
  "name": "World Plaza",
  "nameLocalized": { "en": "World Plaza", "es": "...", "...": "(~50 langs)" },
  "version": "0.1.0",
  "manifestUrl": "https://encorpora.io/corpan/packs/world-plaza/manifest.json",
  "zipUrl": "https://encorpora.io/corpan/packs/world-plaza.zip",
  "description": "A living town where you meet AI characters and real players, follow a personal journey, and turn every encounter into a language lesson.",
  "descriptionLocalized": { "en": "...", "...": "(~50 langs)" },
  "imageUrl": "https://encorpora.io/assets/world_plaza-avatar.png",
  "purchase": { "type": "free", "priceLabel": "Free" },
  "minAppVersion": "0.16.1",
  "channel": "stable",
  "packType": "game",
  "categories": ["games", "speak", "wild"],
  "goodForClass": ["learner", "polyglot", "enjoyer", "kid_native"],
  "recommendOrder": 5,
  "kidFriendly": true,
  "tagline": "A living town that turns every encounter into a lesson.",
  "taglineLocalized": { "en": "...", "...": "(~50 langs)" }
}
```

Field reasoning:

- **`minAppVersion`**: the host must have on-device LLM (Qwen3) + HostApi.TTS +
  the current pack-mount + `content_packs_install_from_url`. Pin to the **current
  shipping app version** (0.16.1 at time of writing — confirm against
  `corpan-app/package.json` / `infra/app-version.json` at release). Conservative
  on purpose: a too-old host that can't drive the LLM NPCs would be a broken
  first impression. No `maxAppVersion` (single forward entry).
- **`channel`**: `stable`. (Use a second `channel: "preview"` entry first if you
  want a dev-only soak — preview entries are filtered out unless the app is in dev
  mode. Recommended for the first push, then flip to stable.)
- **`categories`**: `games` (it's a 3D RPG) + `speak` (NPC conversation is the
  core loop) + `wild` (it's the ambitious one). Matched against onboarding
  interests by `resolveExperienceMeta` / `scoreExperience` in
  `experiences/registry.ts`.
- **`goodForClass`**: broad — it serves a learner (guided quests), a polyglot
  (open immersion), an enjoyer (cozy town), and reads `kid_native` because the
  content is wholesome-by-architecture (safe-name roller, no real-money economy).
- **No `languages` field**: World Plaza is language-agnostic (the Quest picks the
  target/native pair at runtime, single-language stacks supported per
  `SINGLE_LANGUAGE_RULE`). Omitting `languages` means it is NOT penalized for any
  learner — correct.
- **`recommendOrder: 5`**: slots among the games without displacing the readers
  (1–3). Tune later from catalog with no app release (that's the whole point of
  catalog-driven ranking).

### 3.2 Localized strings (~50 langs) — REQUIRED, not optional

`feedback_catalog_driven_everything` + the repo's localize-everything rule:
`nameLocalized`, `descriptionLocalized`, and `taglineLocalized` must carry the
full ~50-language set (the live `world_radio`/`tutomaton` entries carry 51).
**Generate them with the existing tool, not by hand**: `infra/patch-catalog.py`
already owns localized-string emission for catalog entries (it's how
`tutomaton`/`world_radio` got 51 langs). Add a `world_plaza` source string set to
that pipeline; do NOT author a 51-key blob in this doc. The English `name`/
`description`/`tagline` are the only strings written by us; the rest are
generated + reviewed.

### 3.3 Thin in-app fallback (already wired, just align)

When the published catalog is unreachable, the app falls back to
`registry.ts::EXPERIENCES` + `catalog.ts::DEV_CATALOG`. For a clean fallback:

- Add a `world_plaza` row to `EXPERIENCES` (`categories`/`goodForClass`/`order`
  mirroring the catalog entry, `nameKey: experiences.world_plaza.name`,
  `blurbKey: experiences.world_plaza.blurb`) — these are i18n keys, so also add
  the `experiences.world_plaza.{name,blurb}` strings to the app's i18n bundle.
- This is the *only* in-binary World Plaza metadata; the catalog overrides it OTA.
  Keep it minimal — it exists so the Home recommender doesn't choke offline.

---

## 4. Free vs. Plus — the 0.1.0 decision

**Decision: World Plaza 0.1.0 ships FREE (public ZIP, `purchase.type: "free"`).**
No two-ZIP preview/full, no CloudFront signing for this release.

Rationale:

- The two-ZIP preview/full model (`installManager.ts::isTwoZipEntry`, signed
  `full` artifact, CloudFront-signed URL via the verify Lambda) exists for
  **media** packs where the paid bytes (audio) are the product and a server-side
  truncation makes sense (reader narrations). World Plaza's value is the *code +
  on-device LLM experience*; there is no clean "first N segments" truncation, and
  the client is open-source so any client-side gate is bypassable (the exact
  reason the Plus model is server-truncation, not client-gating).
- Per the Plus principles (CLAUDE.md): **the free tier is generous + permanent**,
  and à-la-carte per-pack IAP is retired. A premium 3D pack as a *paywall* would
  be a per-pack SKU — exactly the retired pattern.
- The right monetization for World Plaza, when it comes, is **Plus-gated premium
  content/features inside a free shell** (extra Scenes/eras, the Spark 3D asset
  pack streamed via the two-ZIP installer, wardrobe), gated by the existing
  `corpan:request-unlock` → `PaywallSheet` flow — **not** gating the pack
  download. That is a post-0.1.0 content decision (roadmap Wave 4 / P2), and it
  reuses the *same* streaming-install + signed-URL machinery for the asset pack
  (see `docs/SPARK_ASSETS.md` §3 — assets ship as a separate two-ZIP pack), with
  the pack itself staying free.

So 0.1.0: **free public ZIP**, hosted on the same `encorpora.io/corpan/packs/`
GH-Pages origin as the other free game packs. The install still rides the
**SHA-256-verified streaming installer** — `expectedSha256` in the catalog entry
is recommended even for the free ZIP (integrity, not entitlement). Compute it on
the published ZIP and add it to the catalog `purchase`-adjacent flow (the v3 game
path passes it through `installPack`'s `expectedHash`; for a public GH-Pages ZIP
it's optional but good hygiene — if added, wire it as the `expectedSha256` the
download install uses).

---

## 5. Catalog artwork (cover + thumbnail)

**World Plaza gets its OWN art** — never reuse the Corpán or any other pack logo.
The art language is already in the pack and is the cheapest, most honest source:
the **paper-cutout / pop-up-book IconRenderer** (`src/items/itemArt.ts`) and the
**procedural cutout characters + warm-Antigua town** (`src/world/cutoutArt.ts`,
`src/world/atmosphere.ts`). The store art should look like the thing you install.

### 5.1 Two ways to make it (prefer the in-engine capture)

1. **In-engine hero capture (preferred, premium, on-brand).** Boot the standalone
   build (`npm run dev` / the `mountStandalone` path), pose the plaza at golden
   hour (the atmosphere rig already does painted sky + morning light + fog), frame
   a hero shot — a cutout character mid-plaza, fountain + terracotta roofs behind —
   and capture. The dev hook `window.__wpScene` (exposed in `main.ts` for the
   Playwright harness) already lets a headless script orbit the camera to a chosen
   angle; reuse that to script a deterministic, repeatable hero frame. This is the
   `SPARK_ASSETS` / capture-studio aesthetic applied to a still. Output a clean
   1:1 crop for the avatar/thumb and a wider crop for any landing hero.
2. **Composed cutout key-art (fallback).** Render a handful of `IconRenderer` /
   `cutoutArt` elements to canvas (the renderer already paints to a
   `DynamicTexture` / canvas at DPR) and compose a flat cutout scene — same paper
   language, no 3D capture. Lower effort, still on-brand, no external tool.

Do **not** generate a generic AI logo — it would clash with the in-game look and
break the "premium, no AI slop" brand voice (memory: brand voice).

### 5.2 Sizes / formats the catalog needs

- **`imageUrl` (catalog avatar/thumb)**: the existing free packs publish a
  **square PNG** at `https://encorpora.io/assets/<id>-avatar.png` (e.g.
  `world_radio-avatar.png`). Match that: `world_plaza-avatar.png`, **square**,
  **512×512** (the readers' covers render fine down to thumb size; 512 is a safe
  catalog avatar). PNG, no alpha needed (full-bleed cutout scene reads better than
  a floating logo).
- Hosting: drop it in the `web/io` asset pipeline so it deploys to
  `encorpora.io/assets/world_plaza-avatar.png` alongside the other `*-avatar.png`
  files (same place `imageUrl` already points for every pack). One file, one URL.
- Optional larger landing hero (for the GH-Pages demo page, P4): a 16:9 ~1600px
  WEBP from the same capture. Not required for the catalog entry; nice for
  marketing.

`imageUrl` is the only artwork field the catalog/runtime reads. Localized artwork
is not a thing here — one cover serves all locales.

---

## 6. Versioning + changelog

Per `corpan/CHANGELOGS.md` (the per-unit discipline):

1. The pack's `[Unreleased]` block in `packs/world-plaza/CHANGELOG.md` is large
   and current (every wave logged it — good). At release, **promote it**:
   - Rename `## [Unreleased]` → `## [0.1.0] - <YYYY-MM-DD>`.
   - Insert a fresh empty `## [Unreleased]` (`### Added/Changed/Fixed`) above it.
2. **Bump `manifest.json` `version` to `0.1.0`** so the heading and the manifest
   match (CHANGELOGS.md step 3 — they MUST agree; the installer reads the manifest
   version, the catalog declares the same `0.1.0`).
3. The catalog-v3 entry `version` is `0.1.0` too. All three (manifest, changelog
   heading, catalog) say `0.1.0`.
4. **Cross-unit**: this release does not bump the core app (the host already
   supports the install/mount path). If a future World Plaza feature needs a host
   change, that change gets its own line in `corpan-app`'s changelog too — but
   0.1.0 is self-contained.

Don't batch changelog edits; that already happened correctly through the waves.
Just promote.

---

## 7. Release checklist (gate before publishing)

**A. Quality gates (must pass, in this order)**
- [ ] `npm run typecheck` (pack) — clean.
- [ ] `npm run test:run` (pack) — vitest contract/conformance suite green.
- [ ] `npm --prefix server run typecheck` — server compiles (even though it
      doesn't ship in the ZIP, it must not be broken at release).
- [ ] `npm run build` — IIFE `dist/app.js` + `dist/app.css` emitted; no barrel-
      import bloat; gzip ≤ 0.6 MB (measure).

**B. Manifest**
- [ ] `version` = `0.1.0`; `id` = `world_plaza`; `entry`/`styles`/`entryType`
      correct; `nameLocalized.en` / `descriptionLocalized.en` present.

**C. Changelog**
- [ ] `[Unreleased]` promoted to `[0.1.0] - <date>`; fresh `[Unreleased]` added;
      heading matches manifest version.

**D. Artwork**
- [ ] `world_plaza-avatar.png` (512×512, in-engine/cutout, NOT a reused logo)
      produced and placed in the `web/io` asset path → deploys to
      `encorpora.io/assets/world_plaza-avatar.png`.

**E. Pack ZIP + publish wiring**
- [ ] `world-plaza` build+zip+copy block added to
      `.github/workflows/hover-runner-pages.yml` (zip = `manifest.json` + `dist/`;
      copy `manifest.json`, `dist/`, and the `world-plaza.zip` into
      `web/io/out/corpan/packs/...`, mirroring the `world-radio` block). Reuse a
      `scripts/pack.mjs` (copy world-radio's) if you want `npm run pack`.
- [ ] Pushed to `main` (or workflow_dispatch) → GH Pages publishes:
      `https://encorpora.io/corpan/packs/world-plaza.zip` and
      `.../world-plaza/manifest.json` resolve (200).
- [ ] (Optional) record the ZIP SHA-256 for the catalog `expectedSha256`.

**F. Catalog entry**
- [ ] `world_plaza` entry added to `catalog-v3` via `infra/patch-catalog.py`
      (game lane, shape per §3.1), with ~50-lang `nameLocalized` /
      `descriptionLocalized` / `taglineLocalized` generated by the same tool.
- [ ] `minAppVersion` confirmed against the live app version.
- [ ] Catalog uploaded to S3 + **CloudFront invalidated** (`/catalog-v3.json`),
      per `infra/PUBLISHING.md`.
- [ ] In-binary fallback aligned: `registry.ts::EXPERIENCES` + `DEV_CATALOG` row +
      `experiences.world_plaza.{name,blurb}` i18n keys.

**G. Smoke (the standalone-vs-embedded trap — verify the REAL app)**
- [ ] Standalone demo (`mountStandalone`) loads, plays, mock host works.
- [ ] **Embedded in corpan-app**: catalog shows World Plaza with the right
      art/blurb → install (streams, SHA-verifies, extracts) → launch → exactly ONE
      Babylon boot in the console → NPC LLM conversation runs on a real device →
      TTS plays → unmount is clean (no second engine, no ghost input). Run on the
      iPad pipeline, not just the browser (memory: tablet/desktop first-class +
      verify-the-real-app).
- [ ] Presence endpoint reachable OR graceful solo fallback (no entry block).

**H. Ownership**
- [ ] Commit/push + any catalog S3 push is the **owner's** call (memory:
      `feedback_git_workflow`). Leave work staged; do not self-publish unless
      explicitly handed control.

---

## 8. Phased plan to first publish

1. **Freeze + gate** (A–C): typecheck, tests, build, bump manifest, promote
   changelog. Pure pack work, no infra.
2. **Artwork** (D): script the in-engine hero capture via `window.__wpScene`;
   produce `world_plaza-avatar.png`; wire it into the `web/io` asset deploy.
3. **Wire the pack into GH Pages** (E): add the `world-plaza` block to
   `hover-runner-pages.yml`; merge to `main`; confirm the ZIP + manifest URLs are
   live.
4. **Preview-channel soak** (F, channel=`preview`): publish the catalog-v3 entry
   as `preview` first → only dev-mode apps see it → run the §7-G smoke on a real
   device.
5. **Flip to stable** (F): change `channel` to `stable`, re-push catalog,
   invalidate CloudFront. World Plaza now appears for all eligible hosts.
6. **Watch**: anonymous pulse (existing analytics) for install/launch/crash; tune
   `recommendOrder`/`categories` from the catalog with **no app release** if the
   ranking needs adjusting.

---

## 9. Honest gaps / risks

- **Multiplayer server not deployed.** 0.1.0's pack ships before the Colyseus
  server is production-hosted (roadmap P1/P5). The client MUST degrade to solo
  when the presence endpoint is unreachable, and the endpoint MUST be config-
  driven (not localhost). Verify before stable. Otherwise everyone outside dev
  gets a hang. **This is the single biggest release risk** — gate stable on it.
- **`minAppVersion` is a guess until confirmed.** If set too low, old hosts
  without a working LLM path install a broken-feeling pack. Confirm against the
  live app and err high.
- **No `expectedSha256` on a GH-Pages free ZIP today.** Acceptable (public,
  integrity-not-entitlement), but adding it is cheap hardening; do it if the v3
  game-install path is wired to consume it.
- **Localized strings are generated, not hand-authored.** They go through
  `patch-catalog.py`; a human should spot-check the target-language name/tagline
  for the top locales before stable (a mistranslated tagline is a bad first
  impression).
- **Bundle size will grow** as Waves 2–3 land more features. Re-measure gzip every
  release and guard the barrel-import trap; if it ever needs to shrink, lazy-load
  the heaviest subsystems (map, market) behind dynamic `import()` rather than
  shipping a fatter IIFE.
