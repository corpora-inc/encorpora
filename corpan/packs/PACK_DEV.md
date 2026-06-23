# Pack boilerplate & dev standards

The canonical "how to build a Corpán pack and run it locally" reference. Read
this before scaffolding a new pack or debugging why one won't load. It exists so
every pack does NOT reinvent the dev server, the manifest cache-bust, asset
fetching, and the build config — the parts that have silently drifted across
packs and cost real time.

> A pack is a self-contained web bundle (its own `package.json` + vite build)
> under `corpan/packs/<id>/`. It does not import corpan-app or corpan core. It
> ships independently as a sideloadable zip + manifest.

`hover-runner` is the minimal reference pack; `tutomaton` and `melopan` are
fuller examples (DB, assets, on-device dev).

---

## 1. Anatomy

```
corpan/packs/<id>/
  manifest.json         # the contract the host loads (see §2)
  package.json          # standard scripts (see §4)
  vite.config.ts        # lib build → dist/app.js (+ app.css) (see §5)
  index.html            # standalone dev entry (mounts mock host)
  src/
    main.tsx            # registers on window.CorpanGames[id] (see §3)
    sdk/                # mock host API + types for standalone dev
  public/               # static assets copied into dist/ (audio, images, db)
  scripts/dev-corpan.mjs # on-device dev server — 3 lines over shared harness (§6)
  dist/                 # build output (gitignored); what actually gets served
  CHANGELOG.md          # Keep-a-Changelog; bump on every user-visible change
```

## 2. `manifest.json` — the host contract

```json
{
  "id": "my-pack",
  "name": "My Pack",
  "version": "0.1.0",
  "entry": "dist/app.js",
  "styles": ["dist/app.css"],
  "entryType": "script",
  "sdkVersion": "0.1.0",
  "databases": { "main": "dist/data/pack.sqlite3" }
}
```

- `id` must be globally unique and match the `registerGame({ id })` call and
  `window.CorpanGames[id]`.
- `entry` / `styles` are resolved **relative to the manifest URL** (or `baseUrl`
  if set). Point them at the built `dist/` files.
- `databases` (optional) maps logical names → pack-owned SQLite files, queried
  read-only via `hostApi.queryPackDb`.
- `devRevision` is added/bumped automatically in dev (see §6) — don't hand-edit.

Authoritative field list: `corpan-app/src/contentPacks/README.md`.

## 3. Runtime contract

The host injects your script/style tags and calls a `mount` you registered:

```ts
// src/main.tsx
import { registerGame } from "./sdk"   // or the shared SDK
registerGame({
  id: "my-pack",
  mount(container, hostApi, initialState) {
    // render your UI into `container`; talk to the host via `hostApi`
  },
})
```

Selected `hostApi`: `speak(uiCode, text)`, `getRandomEntry()`,
`getEntryById(id)`, `getStackConfig()` / `onStackConfigChange()`,
`queryPackDb({ sql, params, dbName })`,
`searchEntriesByText({ text, languageCodes, limit, offset })`. Full surface:
`packs/sdk/README.md` and `corpan-app/src/contentPacks/README.md`.

## 4. `package.json` scripts (standard)

```json
"scripts": {
  "dev": "vite",                       // standalone, mock host (fastest UI loop)
  "build": "vite build",               // one-shot prod build → dist/
  "typecheck": "tsc --noEmit",
  "dev:corpan": "node scripts/dev-corpan.mjs",  // on-device server (shared harness)
  "pack": "node scripts/pack.mjs",     // dist/ + manifest → sideload zip
  "pack:all": "npm run build && npm run pack"
}
```

## 5. Build config — use the shared vite helpers

Build in vite **library mode** to a stable `dist/app.js` + `dist/app.css`, and
use the shared dev helpers so you inherit the loop-safe manifest bump:

```ts
import { devManifestPlugin, packWatchOptions } from "../shared/dev/vite-pack-plugin.mjs"

export default defineConfig({
  publicDir: "public",
  plugins: [react(), devManifestPlugin()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    copyPublicDir: true,
    ...packWatchOptions(),
    lib: { entry: "src/main.tsx", name: "MyPack", formats: ["iife"], fileName: () => "app.js" },
  },
})
```

## 6. Running a pack in dev — two paths

**A. Same machine, in a browser → corpan-app's `:1421` `/packs` middleware.**
Run corpan-app's vite dev server; it serves any pack straight from disk at
`http://localhost:1421/packs/<id>/manifest.json` (see `corpan-app/vite.config.ts`
`servePacks`). Simplest path; no extra server. Localhost-bound and **no CORS**,
so it does not work for a device on the LAN.

**B. On a real device (phone/tablet running the native app) → shared dev server.**
Use the shared harness — do NOT hand-roll a server:

```js
// scripts/dev-corpan.mjs
import { startPackDevServer } from "../../shared/dev/serve-pack.mjs"
startPackDevServer({
  packDir: new URL("..", import.meta.url),
  port: Number(process.env.MYPACK_DEV_PORT || 8993), // PORT REGISTRY in shared/dev/README
})
```

`npm run dev:corpan` then prints
`http://<lan-ip>:<port>/packs/<id>/manifest.json` — paste it into corpan-app's
dev pack field (Settings → tap "Corpan" 7× → Packs). It serves with CORS,
runs `vite build --watch`, and the host auto-reloads on each rebuild.

See **`packs/shared/dev/README.md`** for the harness API, the CORS rationale,
the rebuild-loop fix, and the PORT REGISTRY. The short version of the two traps:

- **CORS:** the device WebView is origin `tauri://localhost`; cross-origin
  `fetch()` of assets needs `Access-Control-Allow-Origin`. `python3 -m
  http.server` doesn't send it → assets fail to load. The shared server does.
- **Rebuild loop:** never let an external process rewrite `manifest.json` on
  each build — `vite build --watch` watches the root, so the write retriggers
  the build forever and races `emptyOutDir` into `ENOENT`. Only vite writes the
  manifest (via `devManifestPlugin`).

## 7. Fetching pack assets at runtime (iOS-safe)

In the packaged/installed app, packs are served via the `corpan-pack://` scheme
(Android: `http://corpan-pack.localhost/`). iOS WebKit blocks `fetch`/XHR
against custom schemes, so fetch asset **bytes** through the host's Tauri command
instead of a raw `fetch`. Use the shared helper rather than re-implementing:
`packs/shared/data/packFetch.ts` (`packFetchArrayBuffer`). It routes through
`__TAURI_INTERNALS__` when present and falls back to a direct fetch in
standalone dev.

## 8. Non-negotiable rules (each has a doc)

- **Single-language stacks** — every pack must work with a one-language stack
  (`languages[0]` = native, `[1..]` = targets). `packs/SINGLE_LANGUAGE_RULE.md`.
- **Latest stable deps** — start on the latest stable major of your engine/libs;
  reach for mature solutions before hand-rolling.
- **Noisy errors** — never silently `catch`; every catch logs visibly.
- **Real ads only** (ad packs) — never fake/placeholder ads.
- **Changelog** — add a `[Unreleased]` line on every user-visible change; promote
  to a dated version when the manifest version bumps. See `corpan/CHANGELOGS.md`.
- **Localize** new UI strings across the supported languages.

## 9. Packaging & delivery

`npm run pack:all` builds `dist/` and produces a sideloadable zip (manifest +
dist + assets). Verify with `unzip -l`. Production delivery (catalog, signed
zips, paywall) is described in `corpan-app/src/contentPacks/DELIVERY_PLAN.md`
and the Corpán Plus section of `corpan/CLAUDE.md`.

## 10. New-pack checklist

- [ ] `manifest.json` with unique `id`, `entry: dist/app.js`, `styles`.
- [ ] `src/main.tsx` registers `window.CorpanGames[id]` via `registerGame`.
- [ ] `vite.config` uses `devManifestPlugin()` + `packWatchOptions()`, lib mode.
- [ ] `scripts/dev-corpan.mjs` is the 3-line shared-harness wrapper with a
      **unique port** added to the PORT REGISTRY.
- [ ] Standalone `npm run dev` renders against the mock host.
- [ ] Assets fetched via `packFetch` (not raw `fetch`) so iOS works.
- [ ] Works with a single-language stack.
- [ ] `CHANGELOG.md` started; user-visible changes logged.
- [ ] `npm run pack:all` produces a valid zip.
