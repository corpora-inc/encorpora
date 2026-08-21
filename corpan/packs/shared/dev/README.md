# Shared pack dev harness

The blessed way to run a pack against a corpan-app on a **real device**. Use
this instead of hand-rolling a `python3 -m http.server` or a per-pack
`http.createServer` — every pack that did so drifted (CORS vs no CORS,
`fs.watch` vs mtime-poll, port collisions, rebuild loops). One harness, fixed
once.

Two pieces, used together:

| File | What it gives you |
|------|-------------------|
| `serve-pack.mjs` | A CORS static server + `vite build --watch` + LAN banner. Your `dev:corpan` becomes ~3 lines. |
| `vite-pack-plugin.mjs` | `devManifestPlugin()` (bumps `manifest.devRevision`) + `packWatchOptions()` (the loop-safe `--watch` excludes) for your `vite.config`. |

## Wire it up (two files per pack)

**`scripts/dev-corpan.mjs`**

```js
import { startPackDevServer } from "../../shared/dev/serve-pack.mjs"

startPackDevServer({
  packDir: new URL("..", import.meta.url),
  port: Number(process.env.MYPACK_DEV_PORT || 8993), // pick from PORT REGISTRY
})
```

**`vite.config.ts`**

```ts
import { devManifestPlugin, packWatchOptions } from "../../shared/dev/vite-pack-plugin.mjs"

export default defineConfig({
  plugins: [react(), devManifestPlugin()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    ...packWatchOptions(),   // injects `watch: {...}` ONLY under --watch
    lib: { /* … */ },
  },
})
```

**`package.json`**

```json
"scripts": {
  "dev": "vite",
  "build": "vite build",
  "dev:corpan": "node scripts/dev-corpan.mjs"
}
```

Then: `npm run dev:corpan`, copy the printed manifest URL
(`http://<lan-ip>:<port>/packs/<id>/manifest.json`), and paste it into
corpan-app's dev pack field (Settings → tap "Corpan" 7× → Packs). The host
polls `manifest.devRevision` and auto-reloads on each rebuild.

## Why a separate server at all (vs corpan-app's `:1421` `/packs` middleware)

corpan-app's own vite dev server already serves packs from disk at
`http://localhost:1421/packs/<id>/…` (see `corpan-app/vite.config.ts`
`servePacks`). That's the simplest path when the app and pack are on the
**same machine** in a browser. But it is localhost-bound and sends **no CORS
headers**, so it doesn't work for a phone/tablet on the LAN running the native
app, whose WebView (origin `tauri://localhost`) fetches pack assets
cross-origin. `serve-pack.mjs` exists for that on-device case: it binds
`0.0.0.0` and always sends `Access-Control-Allow-Origin: *`. The URL path
shape is identical (`/packs/<id>/manifest.json`), so only the host:port differs.

## The two gotchas this harness fixes for you

1. **CORS.** `tauri://localhost` → `http://<ip>:<port>/…/foo.wav` is
   cross-origin. A bare `python3 -m http.server` sends no
   `Access-Control-Allow-Origin`, so the WebView's `fetch()` is blocked and the
   pack appears to "crash" loading assets. This server always sends it.

2. **The infinite rebuild loop.** `vite build --watch` watches the whole
   project root. If anything rewrites `manifest.json` on each build (a dist
   watcher, an mtime poller), that write retriggers the build — forever — and
   the overlapping rebuilds race `emptyOutDir`, throwing
   `ENOENT … copyfile` mid-copy of `public/`. The fix is structural: only
   **vite** writes the manifest (in `devManifestPlugin`'s `closeBundle`), and
   `packWatchOptions()` tells the watcher to ignore `manifest.json` + `dist/`.
   No external process touches that file. Never re-add a dist-watcher that
   bumps the manifest.

## PORT REGISTRY

Pick a unique default so two packs can run `dev:corpan` at once. Override per
run with the pack's env var.

| Port | Pack | Env override |
|------|------|--------------|
| 8989 | stargate-reader | — |
| 8990 | earthgate-reader | — |
| 8991 | tutomaton | `TUTOMATON_DEV_PORT` |
| 8992 | melopan | `MELOPAN_DEV_PORT` |
| 8993 | beatlounge | `BEATLOUNGE_DEV_PORT` |
| 8994 | kronopan | `KRONOPAN_DEV_PORT` |
| 8995+ | _next pack_ | `<PACK>_DEV_PORT` |

`serve-pack.mjs` exits with a clear message on `EADDRINUSE` — if you see it,
either a stale `dev:corpan` is still running on that port (an orphaned server
keeps the port; `lsof -ti tcp:<port> | xargs kill`) or pick another via the env
var.
