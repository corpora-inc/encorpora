# 13. Pack Catalog

## What it is

The catalog is the shared chrome that wraps a reading pack. It is
what gives Earthgate Reader and Stargate Reader their library, their
"now playing" panel, their language switcher, their voice picker,
their book-detail view, their browse overlay, and their exit button.
The reader itself is responsible only for rendering one book at a
time; everything around it (and the lifecycle that swaps one book
for another) is the catalog.

The catalog is not its own pack. It is a library under
`corpan/packs/shared/catalog/` that catalog-style packs import. Two
packs ship it today (Earthgate Reader and Stargate Reader); Quest-
Ear uses parts of it; future reading-shaped packs will adopt the
same surface.

## How it fits

The catalog sits between the pack's `mount()` and the reader's
DOM. The pack's `main.ts` (section 11) calls `createAppShell(...)`,
which renders the command drawer and the catalog browser, then
calls the reader factory the pack provided when the user opens a
book. When the user opens a different book, the shell unmounts the
previous reader and mounts a new one in its place, all inside the
container the host gave the pack on `mount`.

The catalog is also where the user's library state lives. Installed
books are tracked in a Zustand-style store
(`libraryStore.ts`); per-narration playback history sits in
`narrationHistoryStore` (section 14); the drawer's open-or-closed
state is in `drawerStore`. The reader subscribes to these where it
needs to; the shell drives most of them.

## Files and entry points

`corpan/packs/shared/catalog/`:

- `index.ts`: the public API surface. Re-exports the types and the
  small set of functions catalog packs consume.
- `src/types.ts`: the catalog data shapes (`CatalogV2`,
  `CatalogNarrationEntry`, `CatalogGamePack`, `BookEntry`,
  `Character`, `VoiceProfile`, `NarrationKey`). 200 lines.
  Mirrors the JSON the catalog API returns.
- `src/catalogFetch.ts`: fetches the catalog v2 manifest from the
  configured base URL with caching. 323 lines.
- `src/catalogIndex.ts`: builds derived indexes over the raw
  catalog (by book id, by character, by series). 358 lines.
- `src/appShell.ts`: the shell itself. 2,662 lines: command
  drawer, browse overlay, book detail, narrator-detail wiring,
  dispose-remount logic for book switching, custom-section
  injection from readers. The center of gravity of this section.
- `src/catalogBrowser.ts`: the browse overlay inside the drawer.
  283 lines.
- `src/bookDetail.ts`: the per-book detail view rendered inside
  the drawer when the user taps a book. 328 lines.
- `src/narratorDetail.ts`: the per-narrator detail view (voice
  preview, install/uninstall, language metadata). 648 lines.
- `src/searchFilter.ts`: pure functions that group, filter, and
  sort catalog entries. 269 lines. Worth reading; no state.
- `src/installManager.ts`: the install/uninstall pipeline against
  the Tauri commands. 286 lines.
- `src/purchaseManager.ts`: the IAP integration. 619 lines.
- `src/libraryStore.ts`: the installed-narration registry. 84
  lines. The simplest store in the catalog.
- `src/voicePreview.ts`: voice preview playback for the narrator
  picker. 138 lines.
- `src/downloadProgress.ts`: progress reporting. 123 lines.
- `src/versionUtil.ts`: 18 lines, a single
  `hasUpdate(installed, latest)` helper.
- `src/catalog.css`: the shell's stylesheet. Themed via
  `--catalog-*` CSS custom properties so each reader pack can
  recolor the chrome without forking it.

## How it works

### The shell as the integration layer

`createAppShell(container, options)` is the single entry point. The
calling pack passes:

- `readerId`: the pack's id (e.g. `"earthgate"`).
- `readerVersion`: the pack's version string (used in the "About"
  surface of the drawer).
- `createReader`: the pack's `ReaderFactory`, which takes
  `(container, hostApi, initialState) => ReaderInstance`. The
  shell calls this every time the user opens a book.
- `hostApi`: the live HostApi (section 12).
- Plus a small handful of optional callbacks for sections of the
  drawer the pack wants to customize.

The shell's responsibilities, top to bottom:

1. Render the **command drawer** (the swipe-from-edge UI that
   houses the now-playing strip, the language switcher, the
   library, the browse button, and the exit). The drawer
   primitive lives in `@shared/ui/commandDrawer`; the shell
   stamps in the catalog-specific sections.
2. Fetch the catalog (`fetchCatalog`) and build the index
   (`buildCatalogIndex`). The result is what the browse overlay
   and the book-detail view render against.
3. Render the **catalog browser** when the user opens "Browse."
   Catalog browser uses `searchFilter` to group by series,
   filter by language, and sort by what the user has installed.
4. Handle the **book selection** flow. Tapping a book in the
   browser opens `bookDetail`; tapping "Open" in the detail
   triggers `installManager.installNarration(...)` if needed and
   then asks the shell to swap in a fresh reader instance.
5. **Dispose and remount** the previous reader on book switches.
   Readers are constructed per book; switching books is a
   `previous.dispose()` followed by
   `createReader(container, hostApi, { bookId, ... })`. The
   container element is reused; the reader's internal state is
   not preserved.
6. Render the **narrator detail** view when the user taps a
   narrator card. `narratorDetail.ts` handles voice preview,
   install/uninstall of the narration pack, language metadata,
   and progress reporting.
7. Surface **toasts**, **offline notices**, and the **drawer
   store** state changes through the existing shared UI
   primitives.

### Data flow

The catalog is JSON, fetched from a URL the pack configures
(typically pointing into S3 / CloudFront; see section 24). The
shape is in `types.ts`:

```ts
type CatalogV2 = {
  version: number
  characters: Character[]      // narrators with voice metadata
  books: BookEntry[]           // books and per-language metadata
  narrations: CatalogNarrationEntry[]  // the per-(book, lang, voice) zips
}
```

`buildCatalogIndex(catalog)` returns a `CatalogIndex` with helpers
to look up narrations by `(bookId, language, voiceId)`, by
character, by series, etc. The index is the read-side view; the
catalog itself is the source.

The library store
(`corpan/packs/shared/catalog/src/libraryStore.ts`) tracks which
narrations the user has installed locally. It is a small Zustand-
shaped store with a few helpers (`addInstalled`, `removeInstalled`,
`isInstalled`, `getInstalled`, `listInstalled`). The store
persists to local storage so the library survives app restarts.

### The pure functions in `searchFilter`

`searchFilter.ts` is the file new contributors should read first
when they want to understand the data side of the catalog. It is
269 lines of pure functions:

- `groupBySeries(narrations)`: groups by parent series.
- `filterByLanguage(narrations, lang)`: keeps only entries for
  that language.
- `searchByTitle(narrations, query)`: substring search over the
  user-facing title in the active locale.
- `getAvailableLanguages(narrations)`: enumerates which languages
  are present in the data.
- `getLanguageName(lang)`: looks up the user-facing language
  name.
- `partitionLanguagesByStack(languages, stackConfig)`: splits
  available languages into "in the user's active stack" vs
  "everything else." This is what drives the "Your languages"
  section at the top of the language picker.
- `sortNarrationsByStack(narrations, stackConfig)`: prioritizes
  narrations whose languages are in the user's stack. The browse
  list reorders itself when the user changes their language
  selection.

No state, no IO, no UI. This is where the catalog's
"hygienic and modular" reputation gets earned.

### The reader-shell handshake

The reader receives a slim contract from the shell on construction:

- The container DOM element to render into.
- The HostApi (passed through from the pack).
- An `initialState` that includes `bookId`, the audio manifest URL,
  the segments URL, an optional `baseUrl`, and an optional
  `contentRevision`.
- A small set of imperative callbacks the reader can invoke to
  ask the shell to do shell-level things (open the drawer,
  surface a toast, etc.).

The reader returns:

- `dispose()`: tear down all the reader's state and DOM. Called
  when the user picks a different book or exits the pack.
- A handful of imperative methods the shell can call back into
  (`setBookmark`, `setLanguage`, etc.) when the user makes a
  choice in the drawer that should affect the reader.

The shell does not reach into the reader's internals; the reader
does not reach into the shell's. The contract is one struct each
way. This is the same shape as the pack-host contract one level
out: small, typed, complete.

### The i18n bridge

`appShell.ts:62` defines `tt(key, defaultValue, params)`, a tiny
wrapper around `window.__corpanI18n.t(key, options)`. The host app
(`corpan-app/src/i18n.ts`) puts its live i18next instance on
`window.__corpanI18n` so packs can reach in for translations
without bundling i18next themselves. The wrapper falls back to the
default value (with manual `{{param}}` substitution) when the
window global is absent, which is exactly the standalone-dev case
the SDK's mock host handles for the rest of the contract. The
result: every user-facing string in the catalog flows through
`tt(...)` and Just Works in production and in dev.

This is the one place the architectural rule "packs talk to the
host only through the HostApi" is bent. The bend is small and
documented in the comment in place: i18next is too heavy to ship
in every pack, and exposing the host's instance through a single
named global is the smallest acceptable workaround. The
alternative (a method on the HostApi that takes a key and returns
a translated string) is on the table for future SDK revisions.

### Theming

`catalog.css` declares CSS custom properties on the
`.catalog-root` selector that the shell stamps into the DOM:

```css
.catalog-root {
    --catalog-bg: #2c1810;
    --catalog-fg: #e8dcc4;
    --catalog-accent: #c2410c;
    /* ... */
}
```

Earthgate Reader and Stargate Reader override these from their own
stylesheets. Earthgate goes warm-earth-tone; Stargate goes
mid-century-science-fiction. The shell does not know the colors;
it only knows the slot names. Adding a third catalog-style reader
with a third palette is a stylesheet, not a fork.

## Common operations

1. **Open the catalog in a running pack.** Tap the drawer trigger,
   tap Browse. The catalog overlay opens; languages along the top,
   series listed below.
2. **Add a new section to the drawer.** Extend the
   `DrawerSectionDef[]` the pack passes to `createAppShell`. The
   shell renders each section in the order it appears.
3. **Theme the chrome for a new reader pack.** Set the
   `--catalog-*` custom properties in the pack's stylesheet under
   a selector that matches the shell's container. Test by
   opening Stargate Reader and Earthgate Reader side by side;
   the same drawer should look correct in both palettes.
4. **Add a new searchFilter operator.** Write a pure function in
   `searchFilter.ts`, add a test (the helpers are
   straightforward to test), export from `catalog/index.ts`.
5. **Add a new field to the catalog JSON.** Extend `types.ts`.
   Update `catalogFetch.ts` if the field requires migration.
   Update `catalogIndex.ts` if the field powers a new lookup.
   Update consumers; the type system tells you where.
6. **Inspect what is installed.** Call `listInstalled()` from a
   pack; the shell's library section is also rendered from this
   list.

## Why we built it this way

The catalog is a library, not a pack, because the readers it serves
need to ship together and stay visually consistent. Two readers
that look like cousins and behave like cousins should share their
chrome and not their experience. A library is what gives them
that: same drawer, same browse, same install flow, different
paragraph rendering, different visual identity, different feel.

The shell-as-orchestrator pattern is what makes the
dispose-remount-on-book-switch story tractable. Readers do not have
to manage their own lifecycle when the user picks a different book;
they just dispose cleanly and trust the shell to create a fresh
one. The reader stays focused on "render this book"; the shell
stays focused on "which book is current."

The pure-function approach in `searchFilter.ts` is the part of
this library that is most quoted internally as "the right shape."
A few hundred lines of well-named, side-effect-free functions
that the rest of the code stitches together; nothing to mock,
nothing to instantiate, nothing to teardown. New filters are
trivially additive. New sort orders are trivially additive. New
display modes that need a slightly different grouping are
trivially additive. The reason the catalog has not collapsed
under its own weight is that the data side has stayed honest.

The CSS-custom-property theming is the smallest mechanism that
gives each reader visual ownership without giving it visual veto.
The shell controls the structure; the readers control the colors.
Forking the chrome to recolor it would be the worst-case outcome;
the property slots are how we avoid that.

The `window.__corpanI18n` bridge is a small dent in the
no-backdoor principle the rest of the pack system holds firm.
The dent is documented, narrowly scoped, and falls back gracefully
in standalone dev mode. It exists because the alternatives (every
pack bundles i18next; every pack works around it) are worse than
the bend, and because tests show the bend is not load-bearing
elsewhere. The principle is still that the next time we are
tempted to add a host-side global, we should add a HostApi method
first.

## To go deeper

- `corpan/packs/shared/catalog/src/searchFilter.ts` end to end.
  Twenty minutes; it is the easiest entrypoint into the library.
- `corpan/packs/shared/catalog/src/appShell.ts` skim. Read the
  comment at the top and the top-level function declarations
  before the bodies; the shape is more digestible than the size
  suggests.
- `corpan/packs/shared/catalog/src/types.ts` for the data
  contract. This is what `catalog v2` looks like on the wire and
  in memory.
- `corpan/packs/earthgate-reader/src/main.ts` and
  `corpan/packs/stargate-reader/src/main.ts` to see two different
  packs adopt the same shell.
- Section 14 for the shared state stores `appShell.ts` reads and
  writes; section 24 for the S3 / CloudFront catalog hosting.
