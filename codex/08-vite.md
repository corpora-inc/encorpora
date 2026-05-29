# 08. Vite

## What it is

Vite is the build tool the Corpán app uses. In development, it runs
a local HTTP server that serves the source files as native ES
modules to the browser, with hot module replacement for instant
updates. In production, it bundles the same source tree into a
small set of optimized files for shipping. The two modes share a
configuration file and a plugin system; what differs is the
underlying engine. Dev mode is powered by `esbuild` (a Go-implemented
bundler that operates in milliseconds); production builds are powered
by `Rollup` (a JavaScript bundler that does the deeper tree shaking
and chunking that shipping wants).

In this repo Vite drives `corpan/corpan-app/` (the Tauri-hosted React
frontend) and each pack under `corpan/packs/` (each pack is its own
Vite project). The Next.js marketing site at `web/io/` is **not** a
Vite project; Next.js has its own build pipeline (still Webpack-
based under the hood). The static Corpán pages at `web/pages/` are
not Vite either; they are templates assembled by hand-rolled Node
scripts (`web/pages/build.js`). The pattern is: where there is a
React or React-like frontend that needs hot reload, Vite. Where the
output is server-rendered or template-stitched, something else.

## How it fits

Vite sits between TypeScript source and a running browser. Tauri
(section 04) is configured to point its webview at Vite's dev server
URL during development (`http://127.0.0.1:1421`, declared in
`tauri.conf.json`) and at the static build output (`../dist`,
produced by `vite build`) in production. So `npm run tauri dev`
starts Vite and launches the Tauri binary; the binary opens a webview
on Vite's URL; edits to React or CSS files flow through Vite's HMR
into the running webview, with no app restart.

The pack story is the same shape one level smaller. Each pack's
`vite.config.ts` produces a `dist/` directory that the root build
orchestrator (section 02) copies into `web/io/out/corpan/packs/`,
then zips. During pack development, a pack's `npm run dev` launches
Vite on a different port and the developer uses Tauri's "install
from URL" path (section 02) to load that local URL into the running
app.

## Files and entry points

- `corpan/corpan-app/vite.config.ts`: the Vite config for the app.
  135 lines, dense. Worked example for this section.
- `corpan/corpan-app/index.html`: the single HTML document Vite
  treats as the **entry point**. Contains the
  `<script type="module" src="/src/main.tsx">` tag that pulls the
  whole React tree.
- `corpan/corpan-app/package.json`: declares the `dev`, `build`,
  and `tauri` scripts. `dev` runs `vite`; `build` runs
  `vite build`; `tauri dev` is the orchestrator that calls into
  both.
- `corpan/corpan-app/dist/`: the build output. Created by
  `vite build`; embedded by Tauri in release builds. Not tracked
  in git.
- Each pack's `vite.config.ts`: similar shape, scoped to one pack.
  See `corpan/packs/hover-runner/vite.config.ts` for the
  reference.
- `corpan/corpan-app/tsconfig.node.json`: a separate tsconfig for
  the Vite config file itself (it runs in Node, not the browser).

## How it works

### What "native ESM" buys

Before Vite, the dominant pattern was Webpack-style **bundling**: a
build step that walked the import graph, gathered every file into a
single bundle (or a few code-split bundles), and served that to the
browser. The bundle was rebuilt on every change. As a project grew,
the cold-start time grew with it; large React projects with a few
hundred files routinely waited tens of seconds for the dev server
to come up after a save.

Vite's insight is that the browser already understands ES modules.
A `<script type="module" src="/src/main.tsx">` tag in `index.html`
makes the browser fetch `main.tsx`, then fetch each module it
imports, recursively. Vite's dev server intercepts these fetches and
transforms each file on demand: TypeScript and JSX are compiled to
modern JavaScript by `esbuild`, CSS is processed, and the result is
sent back. Each file is transformed once and cached. There is no
"the bundle." There is a graph of small files served independently.

The consequence is that startup time becomes O(time to compile the
single file the user is editing) instead of O(time to bundle the
whole project). On a project the size of the Corpán app (several
hundred TypeScript files), the dev server is interactive in well
under a second; an edit lands in the running webview before the
finger leaves the save key.

### HMR

Hot module replacement is the live-edit pipeline. When a file
changes, Vite recompiles just that file, sends it to the browser
over a WebSocket, and the browser swaps the new module in **without
reloading the page**. For React, this means component state is
preserved across edits. The button you were hovering does not jump
back to the home screen.

The HMR config in `vite.config.ts` is sensitive to the network
arrangement:

```ts
// corpan/corpan-app/vite.config.ts:116
server: {
    port: 1421,
    strictPort: true,
    host: serverHost,
    hmr: rawHost
        ? { protocol: "ws", host: rawHost, port: 1421 }
        : undefined,
    watch: { ignored: ["**/src-tauri/**"] },
},
```

`port: 1421` matches `tauri.conf.json`'s `devUrl`; the two **must**
agree or the webview cannot find the dev server. `strictPort: true`
fails fast if 1421 is busy, rather than silently picking 1422 and
leaving Tauri pointing at the wrong place. `host: serverHost` is
either `127.0.0.1` for desktop or `0.0.0.0` (set via
`TAURI_DEV_HOST` from outside) so an Android device on the same LAN
can reach the dev server. `watch: { ignored: ["**/src-tauri/**"] }`
keeps the file watcher from waking up on Rust edits that Vite would
have nothing to say about.

### Plugins

Vite plugins are objects with hooks: `config`, `configureServer`,
`transform`, `buildStart`, and so on. Each hook runs at a specific
moment in the dev or build pipeline. The Corpán config uses three
plugins:

```ts
plugins: [react(), tailwind(), servePacks()],
```

- `react()` is `@vitejs/plugin-react`. It enables JSX and the React
  Fast Refresh integration that makes HMR component-aware. Without
  it, an edit to a component would replace the module but lose all
  state.
- `tailwind()` is `@tailwindcss/vite`. Tailwind v4 runs through
  Vite's transform pipeline; it scans the source for class names
  and emits the CSS for exactly the ones in use. See section 09
  for the styling story.
- `servePacks()` is a small custom plugin defined in the same
  file. It is the most interesting one to read.

The custom plugin:

```ts
// corpan/corpan-app/vite.config.ts:47
const servePacks = () => ({
    name: "serve-corpan-packs",
    configureServer(server: any) {
        server.middlewares.use("/packs", serveStaticFromRoot(packsRoot));
        server.middlewares.use("/corpan/packs", serveStaticFromRoot(outPacksRoot));
        server.middlewares.use("/game-proxy", async (req, res) => {
            // proxy to an external pack URL
        });
    },
});
```

`configureServer` hands you Vite's connect-style middleware stack.
The plugin attaches three handlers:

- `/packs` serves files from `../packs` (the sibling `corpan/packs/`
  directory), so during dev the app can fetch a pack as
  `http://127.0.0.1:1421/packs/hover-runner/manifest.json` and
  load it just like the production URL on `encorpora.io`.
- `/corpan/packs` serves files from the production build output at
  `web/io/out/corpan/packs`, so a developer with a built bundle
  can also point the app at a packaged pack locally.
- `/game-proxy` does a small fetch-and-relay for arbitrary URLs,
  used during pack development to test loading from a remote URL
  without CORS issues.

This is the plugin system in microcosm. No transform, no bundle, no
ceremony, just three middleware handlers attached at the right
moment. The whole "make local pack development work" feature is
one plugin and forty-odd lines.

### Path aliases

The same `@/` and `@shared/` aliases that `tsconfig.json` declares
also need to be declared to Vite, because the TypeScript compiler
and Vite resolve imports independently:

```ts
resolve: {
    alias: {
        "@":       fileURLToPath(new URL("./src", import.meta.url)),
        "@shared": fileURLToPath(new URL("../packs/shared", import.meta.url)),
    },
},
```

These two configurations (`tsconfig.json:paths` and
`vite.config.ts:resolve.alias`) must stay in sync. The compiler will
not warn if they diverge; a wrong alias here surfaces as a runtime
"failed to fetch" in the webview. Updating either is small enough
that the discipline is to update both.

### Production build

`vite build` runs Rollup over the same entry (`index.html` and its
transitive imports) and produces an optimized bundle:

```ts
build: {
    target: "es2020",
    minify: "esbuild",
    rollupOptions: {
        output: {
            manualChunks: {
                vendor: ["react", "react-dom", "zustand"],
                i18n:   ["i18next", "react-i18next", "i18next-http-backend"],
                ui:     ["@radix-ui/react-dialog", "@radix-ui/react-select", "@radix-ui/react-slider"],
            },
        },
    },
    chunkSizeWarningLimit: 1000,
    reportCompressedSize: true,
    sourcemap: false,
},
```

The interesting choices:

- `target: "es2020"` is the lowest browser version the output has
  to run on. Modern enough to skip transpiling async/await,
  optional chaining, nullish coalescing. The Tauri webviews on all
  shipping platforms support it.
- `minify: "esbuild"` is the fastest path. Terser would shave a
  few more bytes; esbuild is good enough.
- `manualChunks` splits the bundle into a few logical pieces so
  that an app update does not invalidate the user's cache for the
  React or i18n libraries. Browsers cache per chunk hash; only the
  chunks whose content changed need to be redownloaded.
- `sourcemap: false` in production. The cost of shipping source
  maps is download size; the benefit is browser-side debugging,
  which a shipped Tauri app does not expose. Section 03 notes
  that the Rust side ships line tables to Play Console; the React
  side does not have a comparable channel today.

### `__APP_VERSION__`

One small but useful Vite feature is the `define` option:

```ts
define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
},
```

This is a compile-time string substitution. Anywhere the source
writes `__APP_VERSION__`, Vite replaces it with the literal version
string from `package.json` before the file is served or bundled.
The React tree can render the live version number ("Corpán
0.15.10") without ever importing `package.json` at runtime, which
keeps the build output smaller and the runtime simpler. The
adjacent practice in `tauri.conf.json` is that the same version
string is duplicated there manually; the discipline is that bumping
the version touches both files in the same commit.

## Common operations

1. **Run the dev server.** `npm run dev` from
   `corpan/corpan-app/` starts Vite on port 1421. Not normally run
   alone; `npm run tauri dev` runs both the dev server and the
   Tauri binary.
2. **Build for production.** `npm run build` from
   `corpan-app/` runs `tsc --noEmit` first (type check), then
   `vite build`. Output lands in `corpan-app/dist/`, which Tauri's
   release build embeds.
3. **Run a pack's dev server.** `cd corpan/packs/<pack> &&
   npm run dev`. Each pack has its own Vite project on its own
   port (usually 5173 for the default Vite port).
4. **Expose the dev server to a phone on the same LAN.**
   `TAURI_DEV_HOST=192.168.1.x npm run tauri dev` (matching the
   logic at the top of `vite.config.ts`). The Tauri Android build
   uses this to reach the dev server from the device.
5. **Add a path alias.** Add to both `vite.config.ts`
   (`resolve.alias`) and `tsconfig.json` (`paths`). The two are
   independent; both must learn the new name.
6. **Add a Vite plugin.** Install the npm package, import it in
   `vite.config.ts`, add to the `plugins` array. Order matters
   when plugins transform the same files; the array is the
   pipeline.

## Why we built it this way

Vite is the choice that took the latency out of the React edit
loop. The Tauri rebuild cycle for the Rust side is on the order of
seconds even for a one-line change; the React side has to be much
faster than that to be tolerable, and Vite's per-file transform
model makes it so. A typical "edit a component, see the change in
the running app" round trip is well under 250 milliseconds.

The custom `servePacks` plugin is a small illustration of why Vite
fits a project like this. The need (serve local pack files at the
same URL prefix the production site uses) is unusual enough that
no off-the-shelf plugin covers it. The fix is forty lines of
middleware in the same `vite.config.ts` everyone reads anyway. A
Webpack-equivalent of the same feature would have been a separate
loader and a separate plugin and a paragraph in the README; Vite
absorbs it into the configuration.

The production build separating `vendor`, `i18n`, and `ui` chunks
is a small bet on cache stability. An app this size could ship in
one bundle and still load in under a second on a phone; splitting
matters more after the first install, when an update that touched
only a single component does not invalidate the user's cache of
React.

Vite plus `tsc --noEmit` is the two-tool build the CI uses. One
tool checks the types; the other ships the bytes. The split is
documented; it is also the source of one specific friction (path
aliases declared twice), which is small enough that it has not
warranted a third tool to keep them in sync.

## To go deeper

- The Vite documentation at `vite.dev`. The "Features," "Plugins,"
  and "Server Options" pages are concentrated and worth reading
  end to end.
- Evan You's original announcement essay (`vitejs.dev/blog/`)
  explains the native-ESM bet more clearly than any tutorial.
- For the production side, the Rollup documentation at
  `rollupjs.org`. Vite's `build.rollupOptions` is a passthrough;
  most of what Vite does at build time is Rollup with sensible
  defaults.
- esbuild's documentation at `esbuild.github.io` is short and
  worth reading once; it is the unsung half of the dev pipeline.
