# 10. Packs Overview

## What it is

A pack is a small self-contained application that runs **inside** the
Corpán app at runtime. The user installs a pack by URL or by zip; the
host downloads it, stores it on the device, and loads it into a
container element when the user opens it. The pack does its own
rendering, makes its own choices, and uses a small set of host
services for the things only the host can provide: the phrase
corpus, the TTS voice, navigation, optionally a per-pack SQLite
database. Beyond those, the pack is on its own.

The contract between host and pack is the **HostApi**, declared in
TypeScript at `corpan/packs/sdk/index.d.ts` (section 07 walks the
types). The runtime side of the contract is two functions exposed
from the SDK: `registerGame({id, mount})`, called by the pack's
entry script when it loads, and the `mount(container, hostApi)` call
back into the pack when the host is ready to render it.

There are eleven packs in `corpan/packs/` on `main` at the time of
writing (section 01 enumerates them). Each is a separate npm
package with its own Vite build and its own `CHANGELOG.md`. The
packs share no runtime; the only thing two packs have in common is
that they speak the same HostApi.

## How it fits

Packs are the unit of velocity. Most new features in Corpán ship as
packs, not as edits to the host app. A new reading experience, a new
listening game, a new pronunciation drill, a new musical
exploration: each begins as a pack, gets shipped as a pack, and
graduates into the host only if the same shape proves useful to many
other packs.

The architectural payoff is that the host stays small. The Corpán
binary on every platform (iOS, Android, desktop) contains a fixed
runtime: corpus access, TTS, STT, IAP, navigation. Adding a new
*game* does not bump the binary. Adding a new *pack* does not require
an App Store or Play Store review.

The boundary between host and pack is the seam where every
architectural choice in Part III takes its shape:

- The pack's view of the host is the `HostApi` interface (section 12).
- The pack ships its own visual identity (section 11 anatomy, plus
  section 09's note that packs do not inherit host styling).
- Packs that compose into a larger catalog (Earthgate Reader,
  Stargate Reader, Quest-Ear) share the `corpan/packs/shared/` tree
  for common surfaces (section 13).
- Shared state across packs uses a small set of stores
  (`bookMetaStore`, etc.) so a phrase the user heard in one place
  shows up correctly in another (section 14).
- Audio playback surfaces into a global transport bar (section 15).

## Files and entry points

- `corpan/packs/sdk/`: the SDK. `index.d.ts` is the type
  declarations; `index.js` is the 141-line runtime
  (`registerGame`, `createMockHostApi`, `mountStandalone`);
  `README.md` is the contract-as-prose explanation;
  `package.json` is the npm package.
- `corpan/packs/shared/`: the cross-pack library. Subtrees for
  `core/`, `sdk/`, `audio/`, `ui/`, `catalog/`, `state/`, `data/`.
  Imported by the packs that need any of it; not depended on by
  the host.
- `corpan/packs/<pack>/`: each pack lives in its own directory
  alongside the others. As of `main`: `earthgate-reader`,
  `hanzipan`, `hover-runner`, `juice-squeeze`,
  `pronunciation-coach`, `pronunciation-coach-0.3.5` (pinned
  snapshot), `quest-ear`, `stargate-reader`, `world-radio`,
  `world-radio-legacy`. The shape is consistent: `package.json`,
  `vite.config.ts`, `tsconfig.json`, `manifest.json`,
  `index.html`, `src/`, `dist/`, `CHANGELOG.md`, often an
  `<avatar>.png`.
- `corpan/packs/README.md`: documents the two-phase rollout (the
  manifest-install flow shipped now, the IAP store-purchase flow
  shipped next). Brief; worth reading once.
- `corpan/corpan-app/src-tauri/src/content_packs.rs`: the Rust
  host's implementation of pack install, download, extract, and
  serve via the `corpan-pack://` URL scheme. The mirror image of
  the SDK on the host side.
- `corpan/corpan-app/src/contentPacks/`: the React host's
  pack-loading bridge. Owns the `<iframe>` or container element
  the pack mounts into and brokers calls from the pack's
  `hostApi` to the underlying Tauri commands.

## How it works

### The contract, in one paragraph

A pack ships a `manifest.json` with an `id`, a `name`, a `version`,
an `entry` script path, optional `styles`, and optionally a
`databases` map. The host loads the entry script. The script's
top-level code calls `registerGame({ id, mount })`, which stores the
pack on `window.CorpanGames[id]`. The host then calls the stored
`mount(container, hostApi, initialState)` to render the pack into a
container element. The pack uses `hostApi` for any host services it
needs and returns an optional `{ unmount }` object that the host
calls when the user navigates away.

That is the entire runtime model. Everything else is a refinement.

### The SDK runtime

The whole pack-side runtime is 141 lines in
`corpan/packs/sdk/index.js`. Three exported functions and one
private helper:

- `registerGame(game)`: validates that `game.id` is a string and
  `game.mount` is a function; writes the game to a global registry
  at `window.CorpanGames`. Returns the same game for chaining.
- `createMockHostApi(options)`: returns a `HostApi` implementation
  that uses the browser's `SpeechSynthesisUtterance` for `speak`,
  returns fixed sample entries for `getRandomEntry` etc., and lets
  the caller override any field. Used during browser-only
  development.
- `mountStandalone(game, options)`: creates a fixed-position div in
  `<body>`, calls `game.mount(container, hostApi, initialState)`,
  and returns an `unmount` closure that the developer can call to
  tear down. Used by `index.html` in each pack so `npm run dev`
  works without the host app.

The minimalism is the point. The pack-side runtime that ships in
the bundle is tiny; the heavy lifting lives on the host side, and
the pack reaches it through the contract.

### The manifest

The manifest is the pack's name tag, version stamp, and load
instructions. Earthgate Reader's `manifest.json` is the canonical
example:

```jsonc
{
  "id": "earthgate_reader",
  "name": "Earthgate Reader",
  "version": "0.6.6",
  "description": "Calm, earth-toned audiobook reader with word-level highlighting synced to narrated audio",
  "entry": "dist/app.js",
  "styles": ["dist/app.css"],
  "entryType": "script",
  "sdkVersion": "0.1.0",
  "devRevision": "2026-05-19T07:21:56.439Z",
  "nameLocalized": { "ar": "...", "bg": "...", /* 50+ locales */ },
  "descriptionLocalized": { /* same locale set */ }
}
```

The fields divide roughly into three groups:

- **Identity**: `id`, `name`, `version`, `description`. The `id` is
  the durable handle the host uses for storage paths and history
  joins; `version` is the SemVer that drives the changelog and
  cache-busting; `name` and `description` are the user-facing
  labels.
- **Load**: `entry`, `styles`, `entryType`, `sdkVersion`,
  `devRevision`. The `entry` is the JS file the host loads first;
  `styles` is loaded into the container as `<link>` tags;
  `entryType: "script"` means it is a classic script (not an ES
  module), which is the lowest-common-denominator that every
  webview understands; `devRevision` is an ISO timestamp the host
  uses to bust the dev cache without bumping the version.
- **Localization**: `nameLocalized` and `descriptionLocalized` are
  per-locale maps the catalog UI uses to display the pack in the
  user's chosen language. Section 13 covers how the resolver picks
  the right entry; section 09 covers the pack-vs-host visual
  split.

### The two install modes

Packs ship two ways, both produced by the same build (section 02):

- **Manifest install**: the host fetches the manifest URL, then the
  `entry` and `styles` URLs, all over HTTPS. The pack runs the
  same way it would in any browser. Updates are always-on; closing
  and re-opening the pack picks up any changes the developer just
  pushed.
- **Zip install**: the host downloads a single `<pack>.zip` that
  contains `manifest.json` and `dist/`, extracts it into the
  device's app data directory under `corpan-packs/<id>/`, and
  serves the files locally through a custom `corpan-pack://` URL
  scheme registered by `tauri-plugin-game-packs`. Updates are
  manual: the user reinstalls.

The two modes coexist on every pack's landing page. The dev-mode
unlock (Settings → tap "Corpán" seven times) reveals the manifest-
URL input field; in production it stays hidden but the same
machinery is alive underneath, ready for the IAP flow (phase 2 in
`packs/README.md`).

### The loop

End to end, the install + run path for a pack looks like:

```
[Pack lands on encorpora.io via build pipeline (section 02)]
                 |
[User opens Corpán app, dev unlock or IAP triggers an install]
                 |
[Rust host (content_packs.rs) downloads manifest, downloads zip
 if applicable, extracts to {app_data_dir}/corpan-packs/<id>/]
                 |
[React host (src/contentPacks/) creates a container element]
                 |
[Host loads dist/app.js (and its CSS) into the container's frame
 either via http(s):// (manifest install) or via
 corpan-pack://localhost/<id>/dist/app.js (zip install)]
                 |
[Pack's top-level code runs: registerGame({id, mount})]
                 |
[Host reads window.CorpanGames[<id>], calls
 game.mount(container, hostApi, initialState)]
                 |
[Pack renders, calls hostApi.getRandomEntry(), hostApi.speak(...),
 etc.; user uses the pack]
                 |
[User navigates away; host calls instance.unmount() if returned]
```

Every step in this loop is small. The longest single file is
`content_packs.rs` at 503 lines, and it covers all of the
zip-extraction, custom-protocol-serving, and integrity-checking
behavior the host does for every pack ever installed.

## Common operations

1. **Create a new pack.** Copy `corpan/packs/sdk/` (or an existing
   pack as a richer starting point), edit `manifest.json` with a
   new `id`, `name`, and `version`. Implement
   `registerGame({ id, mount })` in `src/main.ts` (or equivalent).
   `npm run dev` to test with `mountStandalone`. Add to
   `web/pages/data/packs.json`. Add build/copy steps to
   `package.json` and `.github/workflows/hover-runner-pages.yml`
   (section 02 has the recipe).
2. **Install a pack in development.** Open Corpán dev build,
   Settings, tap "Corpán" seven times to reveal the Packs panel.
   Paste a manifest URL (e.g.
   `http://192.168.1.x:5173/manifest.json` for a local Vite dev
   server) and tap Install. Hot reload works through the host on
   manifest changes.
3. **Test a pack in the browser.** From the pack directory,
   `npm run dev`. The pack's `index.html` calls
   `mountStandalone(game)` and the SDK's mock host returns sample
   data. No Corpán app needed.
4. **Package a pack for offline install.** From the pack
   directory, `npm run pack` (where the pack has a
   `scripts/pack.mjs`; see Earthgate Reader for the reference) or
   from the repo root, `npm run package:<pack>` (which is the
   shape baked into the root `package.json` for the reference
   packs).
5. **Read a pack's history.** Open its `CHANGELOG.md`. Every
   change to a versioned pack lands an entry in `[Unreleased]`;
   every version bump promotes the entry to a dated heading. The
   doctrine is in `corpan/CHANGELOGS.md` (section 02).
6. **Audit what packs are installed.** Inside Settings → Packs in
   the app, or by inspecting
   `{app_data_dir}/corpan-packs/` on the device's filesystem.
   The host exposes a `content_packs_list_installed` Tauri command
   (section 04) that returns the same list.

## Why we built it this way

Packs are the architectural bet the project is most invested in.
The host's job is to make the pack feel like a part of the app; the
pack's job is to be the part of the app that gets to be loud. The
small contract is what makes both possible. If the contract were
fat, every pack would constrain the host's evolution; if the
contract were absent, every pack would invent its own way to ask
for an entry from the corpus. The seven `HostApi` methods (one of
them itself a nested `stt` API, three of them optional) are the
small surface area we have settled on after several years of
trying both ends of the spectrum.

The SDK is small for the same reason. The runtime is 141 lines
because everything heavier lives somewhere worth owning: in the
shared library under `corpan/packs/shared/` for code that some
packs reuse, in the Rust host for behavior that has to be one
implementation per device, in the pack itself for behavior that
should never escape into a generic library.

The manifest is the smallest declaration that makes "what is this
thing?" answerable without running the code. An id, a version, a
script, a style sheet, two maps of localized strings. That is
enough for the host to install, list, route, render, and label
a pack. Adding more fields is a deliberate decision each time, and
the discipline so far has been to add few of them.

The two install modes (manifest and zip) are the smallest
agreement that handles both "I am on Wi-Fi and I want this to
update on its own" and "I am on a plane and I need this to work."
Both modes use the same underlying flow; the difference is only
where the pack files live and how the URL prefix resolves. The
custom `corpan-pack://` protocol is the elegant way to make those
two cases indistinguishable to the pack's own code.

The non-coupling between host visual identity and pack visual
identity is the other piece of the architectural bet. The host is
neutral so a pack can be Stargate Reader and another can be
Hover Runner without either looking out of place inside an app
called Corpán. Section 09 closes that loop.

## To go deeper

- `corpan/packs/sdk/README.md` for the prose summary of the
  contract.
- `corpan/packs/README.md` for the two-phase rollout map.
- `corpan/corpan-app/src-tauri/src/content_packs.rs` for the
  host-side install path. Worth reading once; 503 lines is shorter
  than it sounds.
- `GAME_INSTALL_SUMMARY.md` at the repo root for the
  manifest-vs-zip comparison from the user's perspective.
- Section 11 for the anatomy of a pack as a project on disk;
  section 12 for the HostApi in detail.
