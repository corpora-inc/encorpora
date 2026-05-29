# 11. Pack Anatomy

## What it is

A pack on disk is a small npm project with a fixed shape: a
`package.json` and a `vite.config.ts` for the build, a
`tsconfig.json` for the type-check, a `manifest.json` for the host,
an `index.html` for standalone browser development, a `src/` tree
for the source, an optional `scripts/` directory for packaging, and
a `dist/` directory the build produces. Eleven packs on `main` all
follow this shape; reading one teaches you how to read the others.

This section walks Earthgate Reader (`corpan/packs/earthgate-reader/`)
end to end. It is a representative "catalog pack": a reader that
composes the shared catalog shell (sections 13 and 15) with its own
visual identity and its own paragraph view, and ships as **code
only** (no bundled audio; narration is served from CloudFront and
downloaded by the app on demand).

## How it fits

The pack anatomy is the file-system surface of the contract section
10 introduced. The host treats `manifest.json` and `dist/` as the
two things it must see; everything else exists for the developer's
sake. `manifest.json` is what gets uploaded to encorpora.io and
embedded in the zip. `dist/` is the build output the host loads at
runtime. The rest of the directory is the project that produces
those two artifacts.

The anatomy is also the boundary the changelog discipline (section
02) rests on. Each pack has a `CHANGELOG.md` next to its
`manifest.json`. Bumping the version in the manifest promotes
`[Unreleased]` to a dated entry. Section 36 will turn that prose
into a system-wide history.

## Files and entry points

The reference layout, with Earthgate Reader's specifics noted in
parentheses:

```
corpan/packs/<pack>/
├── manifest.json         Identity, version, entry, styles, localized names
├── package.json          Vite, TypeScript, zustand; scripts for build/pack
├── vite.config.ts        Build config; declares __<PACK>_VERSION__ via define()
├── tsconfig.json         Strict TS config; pulls in @shared via path alias
├── index.html            Standalone dev entry; calls mountStandalone(game)
├── CHANGELOG.md          Keep a Changelog, version-locked to manifest.json
├── corpan-logo.png       The Corpán mark, embedded in the dist for offline use
├── <pack>-avatar.png     The pack's avatar, the image the catalog displays
├── src/
│   ├── main.ts           The entry; calls registerGame({id, mount}) at top level
│   ├── game.ts           The pack's actual experience
│   ├── styles.css        The pack's local CSS, imported by main.ts
│   ├── vite-env.d.ts     Ambient typings for Vite's import.meta.env
│   ├── i18n/             Per-locale metadata JSON (Earthgate has metadata.en.json)
│   └── rendering/        Pack-specific subtrees (Earthgate has paragraphView.ts)
├── scripts/
│   ├── dev-corpan.mjs    Dev helper: bump devRevision so the host re-fetches
│   └── pack.mjs          Build the zip from manifest.json + dist/
└── dist/                 The build output; not in git. App.js + app.css.
```

The catalog packs (Earthgate Reader, Stargate Reader, Quest-Ear,
Pronunciation Coach) all import heavily from `corpan/packs/shared/`,
particularly:

- `@shared/sdk`: types (`GameModule`, `HostApi`, `EntryOut`),
  `createMockHostApi`. Catalog packs import these instead of
  `@corpan/sdk` because the shared sdk is a superset.
- `@shared/catalog`: the catalog shell (`createAppShell`,
  `ReaderFactory`). Wraps the reader in a consistent chrome.
- `@shared/audio`: the audio engine, media session integration,
  native keepalive (section 15).
- `@shared/ui`: cross-pack UI primitives (`transportBar`,
  `chapterOverlay`, `commandDrawer`, `narrationSwitcher`).
- `@shared/state`: shared Zustand stores (`bookMetaStore`,
  `bookmarkStore`, `narrationHistoryStore`). See section 14.
- `@shared/data`: data providers (`bookCatalog`, `dataProvider`,
  `packFetch`, `segmentLoader`).
- `@shared/core`: pure types and pure functions (`buildTimeline`,
  `findCurrentWordIndex`, `buildChapterIndex`).
- `@shared/analytics`: a thin wrapper.

Smaller packs (Hover Runner, Hanzipan) skip most of `shared/` and
implement their own UI directly, because their experiences do not
fit the catalog mold.

## How it works

### The build, end to end

`npm run build` runs `vite build` against the pack's `vite.config.ts`
and produces `dist/app.js` (the bundled pack code, classic script
form) and `dist/app.css` (the bundled styles). The build:

- Resolves `@shared/...` imports through the pack's path alias to
  the same `corpan/packs/shared/` source tree the host's TypeScript
  also sees.
- Substitutes `__EARTHGATE_READER_VERSION__` (defined in
  `vite.config.ts`) with the version string from `package.json`.
- Targets `es2020` (the same target the host uses), so the
  output runs on every shipping webview.
- Inlines small assets (the avatar PNG, the logo) so that the
  offline-zip install does not have to ship loose files alongside
  the entry script.

The output is two files. That is the entire build.

### The entry script

Every pack's runtime starts when the host evaluates the entry. The
top of Earthgate Reader's `src/main.ts` shows the pattern:

```ts
import "./styles.css"
import type { GameModule, HostApi } from "@shared/sdk"
import { createEarthgateReader } from "./game"
import { createAppShell, type ReaderFactory } from "@shared/catalog"

declare const __EARTHGATE_READER_VERSION__: string

type GlobalScope = typeof globalThis & {
  CorpanGames?: Record<string, GameModule>
  __earthgateReader?: { dispose: () => void }
}

const GAME_ID = "earthgate_reader"

const readerFactory: ReaderFactory = (container, hostApi, initialState) => {
  return createEarthgateReader(container, hostApi as HostApi, initialState)
}

const registerGame = () => {
  const scope = globalThis as GlobalScope
  const registry = (scope.CorpanGames = scope.CorpanGames || {})

  registry[GAME_ID] = {
    mount: (container, hostApi, initialState) => {
      // ... read baseUrl/contentRevision from host-injected script tag ...
      const shell = createAppShell(container, {
        readerId: "earthgate",
        readerVersion: __EARTHGATE_READER_VERSION__,
        createReader: readerFactory,
        hostApi,
        // ...
      })
      return shell
    },
  }
}

registerGame()
```

Six observations:

1. The pack imports its own CSS (`import "./styles.css"`). Vite
   processes the import and the resulting CSS lands in
   `dist/app.css`, which the host's manifest references in its
   `styles` array.
2. The version string is declared as an ambient global
   (`declare const __EARTHGATE_READER_VERSION__: string`) and the
   Vite `define` option substitutes the literal string at build
   time. The comment in the file explains why the manifest is
   **not** imported directly: the dev-corpan helper script mutates
   `manifest.json` (bumping `devRevision`) to bust the host's cache,
   and importing the manifest would put it in Vite's watch graph
   and trigger an infinite rebuild loop.
3. The `GAME_ID` (`"earthgate_reader"`) is the same string as the
   manifest's `id`. The host uses this string everywhere: in the
   download path, in the `corpan-pack://` URL, in the
   `CorpanGames` registry key. The pack and the host agree by
   convention; no codegen.
4. `registerGame()` is the pack's own function with the same name
   as the SDK's, defined inline. It does the same job
   (write a game module onto `window.CorpanGames`) but does it
   directly. Reader packs that pull from `@shared/catalog` write
   their own because the SDK's helper is too lean for their needs.
5. The `mount` callback reads two data attributes off the host-
   injected `<script>` tag: `data-corp-game-base-url` and
   `data-corp-game-content-revision`. The host sets these so the
   pack can fetch its content from the right URL (manifest install
   uses the encorpora.io origin; zip install uses
   `corpan-pack://localhost/<id>/`) without the pack having to
   guess. This is the small handshake that makes the two install
   modes invisible to the pack code.
6. The actual experience is built in `createAppShell(...)`, which
   is shared (section 13), and `createEarthgateReader(...)`, which
   is pack-specific (`src/game.ts`). The split between "the
   catalog chrome around any reader" and "the reader itself" is
   the structural reason `@shared/catalog` exists.

### The standalone dev entry

`index.html` at the pack root is what `npm run dev` serves. It is
roughly:

```html
<!doctype html>
<html>
  <head>
    <link rel="stylesheet" href="/src/styles.css">
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.ts"></script>
    <script type="module">
      import { mountStandalone } from "@shared/sdk"
      const game = window.CorpanGames["earthgate_reader"]
      mountStandalone(game, { container: document.getElementById("root") })
    </script>
  </body>
</html>
```

(Each pack varies the exact bootstrapping; the essence is the same.)
`main.ts` registers the game on `window.CorpanGames`; the inline
module then reaches into the registry and mounts the game with a
mock host (`mountStandalone` uses `createMockHostApi` by default,
section 10). The result: open `http://localhost:5173/` and you are
running the pack against a fake corpus and the browser's
`SpeechSynthesisUtterance` for TTS, with no Corpán app in the loop.

### Code-only vs. data-bundled packs

The `pack.mjs` script under `scripts/` describes how the zip is
built. Earthgate's is forty lines:

```js
// 1. Verify dist/app.js exists.
// 2. Clean any legacy data/ dir.
// 3. Remove the previous zip.
// 4. zip -r earthgate-reader.zip manifest.json dist/
```

That is the entire packaging story for a **reader pack**: ship
the manifest and the build output, nothing else. Narration audio
lives on CloudFront (S3 + CloudFront; sections 24 and 25) and is
fetched per-segment by the host's content_packs side at runtime.
The zip is small (single-digit MB) and the same zip serves every
book the reader can open.

Data-bundled packs are the exception. Hanzipan's `package:hanzipan`
script in the root `package.json` (section 02) shows the variation:
it concatenates a vendored JS library (`hanziwriter.min.js`) into
the build, ships a `data/` directory of Han character writing
descriptions, and bundles a LICENSE file. The zip is larger and
self-contained.

This is the line packs draw between "we are a renderer over the
host's content" and "we are an experience with its own content."
Both are valid; the manifest's `databases` map (the optional one)
formalizes the "we ship our own SQLite alongside our code" case
that Hanzipan exemplifies.

### The dev-corpan helper

`scripts/dev-corpan.mjs` is the second script reader packs ship. It
bumps `manifest.json`'s `devRevision` field to a fresh ISO timestamp
on every run, so the host's cache (which keyed off
`(id, version)` plus `devRevision`) invalidates and pulls a fresh
copy. This is how a developer hits "save" in their editor and sees
the change in the Corpán app a moment later without having to
reinstall the pack.

The comment in `main.ts` about not importing `manifest.json`
directly exists because of this helper. The two interact: the
manifest is the canonical version source, but the dev-corpan
helper rewrites it on each tick, and importing it into the
JS-side graph would feed the watcher its own output.

### `package.json` and `vite.config.ts`

`package.json` declares the seven scripts a pack typically ships:

```json
{
  "scripts": {
    "dev":         "vite",
    "dev:corpan":  "node scripts/dev-corpan.mjs",
    "dev:watch":   "vite build --watch",
    "build":       "vite build",
    "typecheck":   "tsc --noEmit",
    "preview":     "vite preview",
    "pack":        "node scripts/pack.mjs",
    "pack:all":    "npm run build && node scripts/pack.mjs"
  }
}
```

`dev:watch` is what the root orchestrator (`npm run dev` from the
repo root) uses to keep the composed Pages site up to date as the
pack changes. `pack:all` is the full release-build sequence. The
two `tsc` and `vite build` separation mirrors the app side
(section 08): one tool for types, one tool for bytes.

`vite.config.ts` for a pack is similar shape to the app's but
narrower. It defines:

- The library-build target (the pack ships as a classic script,
  not as ES modules with import statements).
- The `define` substitutions (the version string).
- The `resolve.alias` map (`@/` for the pack's `src/`,
  `@shared/` for `corpan/packs/shared/`).
- Output filenames (`app.js`, `app.css`).
- Possibly inline-asset thresholds (so small PNGs end up in the
  bundle instead of loose).

The pack's bundle is a self-contained script; the host evaluates
it once and the pack is alive.

## Common operations

1. **Walk a pack you have never seen.** Open
   `corpan/packs/<pack>/manifest.json`, then `src/main.ts`, then
   the function `main.ts` calls (`createAppShell` for catalog packs,
   the pack's own `mount` body otherwise), then `src/game.ts` if
   it exists. That is the spine.
2. **Make a code edit and see it in the app.** From the pack
   directory: `npm run dev:watch` to rebuild on change. From the
   app: install the pack by its manifest URL once. Re-open the
   pack; the host's cache is invalidated by `devRevision` and a
   fresh build is loaded.
3. **Add a shared module.** Drop a new file under
   `corpan/packs/shared/<area>/`. Re-export from
   `corpan/packs/shared/<area>/index.ts`. Import as
   `@shared/<area>` from any pack.
4. **Bump a pack's version.** Edit `manifest.json` `version` and
   `package.json` `version` to the same number. Promote
   `[Unreleased]` in `CHANGELOG.md` to `[X.Y.Z] - YYYY-MM-DD` and
   add a fresh `[Unreleased]` above it. Commit, push, PR.
5. **Package for offline install.**
   `npm run pack:all` from the pack directory produces
   `<pack>.zip`. The root `package.json` has a matching
   `package:<pack>` script for the reference packs that the root
   build orchestrator calls.
6. **Type-check only.**
   `npm run typecheck` from the pack directory runs `tsc --noEmit`
   against the pack's tsconfig. Catches breaks before a full Vite
   build runs.

## Why we built it this way

The shape is consistent because the cost of variation would be paid
forever. Once a pack diverges in build, packaging, or entry
conventions, every later pack has to choose between matching the
divergence or starting fresh. Keeping the shape uniform means a new
contributor reads one pack and understands ten others, and the
root `package.json` can drive every pack with the same three
verbs (`build`, `package`, `copy`).

The `__<PACK>_VERSION__` define and the deliberate non-import of
`manifest.json` are a small example of the kind of detail that
earns its place. Either could have been done another way; both
choices avoid a specific dev-loop failure mode (the infinite
rebuild). Once that lesson is learned, codifying it in the
template is cheap.

The split between `@shared/catalog` and the per-pack reader is the
architectural payoff for catalog-style packs. The chrome (transport
bar, narration switcher, command drawer, settings rows) is the
same across Earthgate, Stargate, and Quest-Ear because they are
all reading experiences over the same underlying audio/text model.
The chrome is the shared library; the experience is the per-pack
reader. Adding a new reader is a `createAppShell({ readerId,
createReader })` call plus the renderer implementation.

Code-only reader packs are a deliberate scale choice. A book like
Three Questions is 23 languages, hundreds of segments per language,
LUFS-mastered audio at 16 bits and 24 kHz. Shipping that in every
reader pack zip would push the zips into the hundreds of megabytes;
serving the same audio from CloudFront and bundling only the
renderer keeps the install lean and the cache CDN-warm. Hanzipan
is the controlled exception: its data is small enough and tightly
enough bound to the renderer that bundling makes sense.

The standalone `index.html` plus `mountStandalone(game)` plus
`createMockHostApi()` is the dev-time discipline that keeps packs
honest. A pack that only works inside the Corpán app cannot be
unit-tested in a browser tab; a pack that works in a browser tab
against a mock host has documented exactly which `HostApi` methods
it uses, because the mock will tell you when it does not.

## To go deeper

- `corpan/packs/earthgate-reader/src/main.ts` for the cleanest
  reading of the entry-script shape.
- `corpan/packs/earthgate-reader/src/game.ts` for what an actual
  reader implementation looks like end to end (imports from every
  `@shared/*` subtree; the comment at the top names the design).
- `corpan/packs/hanzipan/manifest.json` for the data-bundled
  manifest shape (the `databases` map populated).
- `corpan/packs/sdk/README.md` for the contract again, this time
  against the typeset of the SDK as it exists in the npm package.
- Section 12 for the HostApi in detail; section 13 for the
  catalog shell `createAppShell` orchestrates here; section 14 for
  the shared state stores `game.ts` imports; section 15 for the
  transport bar `@shared/ui` exposes.
