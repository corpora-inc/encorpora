# 14. Pack Shared State

## What it is

Packs need to remember things across mounts: the user's place in a
book, the user's preferences for that book, recently-used
narrations, whether the catalog drawer was open last. `corpan/packs/
shared/state/` is the small library that gives them a uniform shape
for doing it. Six files, 261 total lines, all of them written so
that the next contributor can read one and read the others in
minutes.

Two patterns coexist in this directory, and the rest of this section
is about the difference between them:

- **Per-pack factory stores**: a function that returns a store
  scoped to a string prefix. The pack calls the factory once at
  module load, passing its own prefix (`"earthgate-reader"`,
  `"stargate"`, etc.), and gets back a store that namespaces its
  keys in `localStorage`. Each pack has its own store; values are
  not shared.
- **Cross-pack singleton stores**: a single Zustand vanilla store
  created at module load with the `persist` middleware. Every pack
  that imports the file talks to the same store and sees the same
  state. Used for state that genuinely spans packs.

`bookMetaStore` is in the first category. `narrationHistoryStore`
and `drawerStore` are in the second.

## How it fits

Shared state is the runtime memory of the catalog. The catalog
shell (section 13) reads from `libraryStore` to render the user's
installed books, from `narrationHistoryStore` to power the
"recently-used" pill row in the narration switcher, and from
`drawerStore` to remember whether the drawer was open. Readers
(Earthgate, Stargate) read from `bookmarkStore` to resume at the
user's last position, from `bookMetaStore` to know whether to
reserve space for a chapter title, and from `prefsStore` to
restore their per-book settings.

The HostApi (section 12) does not expose these stores. The
discipline is: state that the host owns (settings, history of
phrases) sits in the host's Zustand stores and is reachable only
through `getStackConfig` + `onStackConfigChange`; state that the
packs own sits in `@shared/state` and is reachable directly by
import. The two never overlap.

## Files and entry points

`corpan/packs/shared/state/`:

- `bookMetaStore.ts`: 52 lines. Per-pack factory; per-book cache
  of metadata that does not change across language switches
  (currently just `hasChapters`).
- `bookmarkStore.ts`: 46 lines. Per-pack factory; per-book
  bookmark (timeMs, segmentIndex, language, savedAt).
- `prefsStore.ts`: 61 lines. Per-pack factory; generic typed
  preferences store with deep-merge over defaults.
- `narrationHistoryStore.ts`: 48 lines. Cross-pack singleton.
  Tracks the most-recently-used narrations across reader
  sessions; capped at 16; persisted as
  `corpan-narration-history`.
- `drawerStore.ts`: 36 lines. Cross-pack singleton. Tracks the
  drawer's open or closed state so packs that read it from the
  shell stay in sync.
- `index.ts`: 18 lines. Re-exports the public surface.

## How it works

### The per-pack factory pattern

`bookMetaStore.ts` is the canonical example. The whole store fits
on one page:

```ts
// corpan/packs/shared/state/bookMetaStore.ts:19
export type BookMeta = {
  hasChapters?: boolean
}

export function createBookMetaStore(prefix: string): BookMetaStore {
  function key(bookId: string): string {
    return `${prefix}:bookMeta:${bookId}`
  }

  return {
    load(bookId: string): BookMeta | null {
      try {
        const raw = localStorage.getItem(key(bookId))
        if (!raw) return null
        return JSON.parse(raw) as BookMeta
      } catch {
        return null
      }
    },

    save(bookId: string, meta: BookMeta): void {
      try {
        localStorage.setItem(key(bookId), JSON.stringify(meta))
      } catch { /* storage full or unavailable */ }
    },
  }
}
```

Three things to notice:

1. **The factory takes the namespace.** Each pack picks its own
   prefix. Earthgate's bookMeta lives at
   `earthgate-reader:bookMeta:<bookId>`; Stargate's at
   `stargate:bookMeta:<bookId>`. The two packs do not see each
   other's data even though they share the file.
2. **`localStorage` is the persistence layer.** No
   abstraction; no fancy serialization. The store is a thin shim
   around `getItem` / `setItem` with JSON in the middle. This is
   appropriate because a pack's webview-side storage **is**
   `localStorage`, both for manifest installs and for the
   `corpan-pack://` scheme zip installs (the WebView shares
   storage across origins for the install).
3. **All IO is `try`/`catch` to `null`.** A pack must never
   crash because storage was full or because a JSON parse failed
   on a key from an older format. The store either returns the
   value or returns nothing; never throws.

The docstring at the top of the file is the second instructive
part. It tells the future reader **why** the cache exists: the
transport bar needs `hasChapters` synchronously at mount time to
reserve a line of vertical space; the bookmark store cannot carry
this because bookmarks are not written until playback begins; a
returning reader has a cached meta from the first read. On the
first-ever read of a brand-new book there is one small layout
shift; on every subsequent mount the layout is stable from frame
one. The cache is what bridges the two.

That kind of comment is the practice the whole `@shared/state`
library tries to model. The code is short; the rationale is
preserved next to it.

### The cross-pack singleton pattern

`narrationHistoryStore.ts` shows the other shape:

```ts
// corpan/packs/shared/state/narrationHistoryStore.ts:1
import { createStore } from "zustand/vanilla"
import { persist } from "zustand/middleware"

const MAX_RECENT = 16

export const narrationHistoryStore = createStore<NarrationHistoryState>()(
  persist(
    () => ({ recent: [] as string[] }),
    { name: "corpan-narration-history" }
  )
)

export function recordNarrationUse(narrationId: string): void {
  if (!narrationId) return
  narrationHistoryStore.setState((s) => {
    const filtered = s.recent.filter((id) => id !== narrationId)
    filtered.unshift(narrationId)
    return { recent: filtered.slice(0, MAX_RECENT) }
  })
}

export function getRecentNarrations(): string[] {
  return narrationHistoryStore.getState().recent
}
```

This is Zustand without React. `createStore` from `zustand/vanilla`
returns a store that exposes `getState`, `setState`, and
`subscribe`. The `persist` middleware writes the state to
`localStorage` under the configured `name` on every change and
hydrates on first read.

The store is a module-level singleton because the file is a
singleton in the bundle, and the cross-pack contract is that any
pack importing `narrationHistoryStore` sees the same one. For
catalog packs this is exactly the right shape: a user switches
from Earthgate Reader to Stargate Reader, and the recently-used
narrations follow them across.

The two helper functions (`recordNarrationUse`,
`getRecentNarrations`) are the imperative API. The store object
itself is exported too, so consumers that want to subscribe can
call `narrationHistoryStore.subscribe(listener)` directly.

### The generic prefs store

`prefsStore.ts` is the most reusable of the three factory stores.
It takes a `defaults` object and returns a store whose `load`
deep-merges the stored value over the defaults:

```ts
export function createPrefsStore<T extends Record<string, unknown>>(
  prefix: string,
  defaults: T,
): PrefsStore<T> {
  // ...
  function deepMerge(target, source) {
    // recursive shallow-then-deep merge for plain objects
  }
  return {
    load(bookId) { /* deepMerge(defaults, stored) */ },
    save(bookId, prefs) { /* JSON.stringify, localStorage.setItem */ },
  }
}
```

This is what powers per-book reader preferences. Stargate's
oscilloscope toggle, waveform color, pulseRing config; Earthgate's
font size, theme, scroll behavior. The deep merge is the small
piece that earns the file its keep: adding a new pref field to the
defaults means existing stored values automatically pick up the
default for the new field, without a migration step.

The `<T extends Record<string, unknown>>` generic is what makes
the store typed per pack. Earthgate calls
`createPrefsStore<EarthgatePrefs>("earthgate-reader", DEFAULTS)`;
the returned `load` returns `EarthgatePrefs`, not `unknown`.
Section 07 covers this generic pattern in the TypeScript section.

### What persists where

The full picture of state in a running pack, by location:

```
Host (Corpán app's Zustand stores, src/store/):
  settings.ts             user-level prefs (languages, levels, rate, ...)
  history.ts              per-stack phrase history (last 1000)
  rating.ts               app-rating prompt counters
  phrasePacks.ts          installed phrase pack registry
  translations.ts         translation cache

Pack (shared/state, localStorage-backed):
  bookMetaStore           per-(pack, book): hasChapters
  bookmarkStore           per-(pack, book): time, segment, language
  prefsStore              per-(pack, book): typed reader prefs
  narrationHistoryStore   cross-pack: recently-used narrations (16)
  drawerStore             cross-pack: drawer open?

Catalog (shared/catalog, localStorage-backed):
  libraryStore            installed narrations
```

Three independent persistence surfaces. None of them is
authoritative beyond the device. None of them is synced across
devices today. The choice to keep this state local-only is
deliberate: it shrinks the architectural surface, and the only
state that genuinely benefits from cross-device sync (the corpus
itself, the installed packs) is already addressed by the catalog
+ S3 / CloudFront pipeline (section 24).

### Why two patterns and not one

The factory pattern serves "this state belongs to this pack and
should not be visible elsewhere." Bookmarks for Earthgate's books
are nobody else's business; namespacing them by prefix prevents
collisions.

The singleton pattern serves "this state spans packs and they all
need to see the same thing." Recent-narrations-across-readers,
drawer-open-when-shell-was-last-rendered: these are intrinsically
cross-pack, and the cost of a shared module is zero.

What this directory does **not** have is a pattern for state that
needs to round-trip through the host. That state lives in the
host's Zustand stores and is reached through the HostApi
(`getStackConfig`, `onStackConfigChange`). Adding a third pattern
for "host state" would muddy the boundary; routing it through the
contract is the way it works today.

## Common operations

1. **Add a new per-(pack, book) field.** Extend the `BookMeta`
   type (or the pack's prefs type). Existing stored values pick
   up the field as `undefined` automatically; the deep-merge in
   `prefsStore` makes the defaults version slightly easier.
2. **Add a new cross-pack singleton store.** Copy the shape of
   `narrationHistoryStore.ts`: `createStore<State>()(persist(
   initial, { name }))`. Export the store and a small imperative
   API. Re-export from `state/index.ts`.
3. **Inspect what is stored on a device.** From the in-app
   webview (dev mode), open Safari Web Inspector or Chrome
   DevTools, go to Storage → Local Storage, and read the keys.
   Catalog and per-pack keys are all there.
4. **Clear a single book's stored state.** Each factory store
   has a `clear(bookId)` if defined (the bookmark store has one)
   or you write the key directly:
   `localStorage.removeItem("earthgate-reader:bookMeta:foo")`.
5. **Migrate a stored format.** Read with the old shape, write
   with the new. Or: bump the namespace prefix
   (`"earthgate-reader-v2:..."`) so old data is invisible to the
   new code. The codebase has used both; the latter is simpler
   and the cost (the user's per-book prefs reset) has been small
   enough so far.
6. **Subscribe a non-React consumer to a cross-pack store.** Use
   the Zustand store's `subscribe(listener)` directly. The
   listener fires on every `setState`; return value is the
   unsubscribe.

## Why we built it this way

`localStorage` is the smallest persistence story that does the
job. A WebView's local storage survives app restarts, is per-
origin (or per-WebView, depending on the platform), and has
megabytes of room before quota becomes a concern. The pack's
storage is the user's, on the user's device, full stop.

The factory pattern is the smallest discipline that prevents the
cross-pack collisions you would otherwise hit the first time two
packs both want to track "bookmarks" by `bookId`. One file, one
prefix per pack, no shared state. That the same file works for
Earthgate and for Stargate without either knowing about the other
is the architectural payoff.

The Zustand vanilla singleton is the second smallest discipline
that gives cross-pack state without dragging React into the
packs that do not use React (Hover Runner and Hanzipan do not).
`zustand/vanilla` is forty kilobytes; `zustand/middleware`'s
`persist` is another ten. The cost of the dependency is
negligible compared to the value of a single source of truth
for the narration-switcher history.

The docstrings on the small files are deliberate. Each store is
short enough that any contributor can grasp the mechanics in a
minute; the docstring is where the reason the store exists at
all is preserved. The `bookMetaStore` comment ("the transport
bar needs `hasChapters` synchronously at mount time…") is the
canonical example of that.

The decision **not** to add a third pattern (host-state
reachable from packs) is the architectural commitment that keeps
the HostApi load-bearing. If packs could subscribe to the host's
settings store directly, the contract in section 12 would mean
less; `onStackConfigChange` would become a vestigial wrapper. By
keeping host state behind the contract and pack state in
`@shared/state`, the seam stays meaningful.

## To go deeper

- `corpan/packs/shared/state/bookMetaStore.ts` end to end. Two
  minutes; the file is shorter than this paragraph.
- `corpan/packs/shared/state/narrationHistoryStore.ts` for the
  singleton pattern.
- Zustand docs at `github.com/pmndrs/zustand`. The vanilla and
  React stories are documented separately; this codebase uses
  both.
- Section 12 for the HostApi line; section 13 for where the
  catalog shell reads and writes these stores.
