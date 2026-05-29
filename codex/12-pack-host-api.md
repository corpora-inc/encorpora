# 12. Pack Host API

## What it is

The Host API is the runtime object the host hands to a pack when it
calls `mount(container, hostApi, initialState)`. It is the entire
surface the pack uses to reach corpus, TTS, STT, navigation, and
any per-pack SQLite database. Anything not on this object is
unreachable from the pack: there is no `import` that crosses from
pack code into the Corpán app's React tree, there is no `window`
backdoor (in production), there is no shared Zustand store the
pack can subscribe to without going through this object.

The contract is declared as a TypeScript type. The pack imports it
from the SDK; the host implements it; the two never share a runtime
module. This separation is the whole point: a pack can be loaded
from a URL the host has never seen before and the only thing both
sides need to agree on is the shape of one object.

## How it fits

The Host API sits between three other systems and acts as the
single seam:

- Below it, in Rust: the Tauri commands the React host exposes
  (section 04). Every `getRandomEntry` call eventually translates
  into an `invoke("get_random_entry_with_translations", ...)`. Every
  `speak` call eventually routes through `tauri-plugin-tts`. Every
  `stt.startSession` call lands in `tauri-plugin-stt`.
- Above it, in the pack: the application code that uses the corpus
  to render a reading experience, a game, a drill, a song
  exploration. The pack never sees a Tauri concept; it sees only
  methods on the HostApi.
- In parallel: the **mock** HostApi the SDK exports for browser-
  only development. The same type, a different implementation
  that uses `SpeechSynthesisUtterance` and returns sample data.
  The pack does not know which one it is talking to.

When the contract changes, three files change in lockstep: the
TypeScript declaration the pack reads, the host implementation that
returns it, and the mock that simulates it.

## Files and entry points

### Pack-side (the contract)

- `corpan/packs/sdk/index.d.ts`: the canonical pack contract. 223
  lines of type declarations. Has the full `HostApi` (with the
  `SttApi` sub-shape) plus the `GameModule`,
  `ContentPackManifest`, `StackConfig`, and `EntryOut` types
  packs share with the host.
- `corpan/packs/sdk/index.js`: the SDK runtime including
  `createMockHostApi()` (the prototype mock).
- `corpan/packs/shared/sdk/types.ts`: a narrower `HostApi` used by
  catalog packs (Earthgate, Stargate, Quest-Ear). Same shape as
  the SDK's but trimmed to what those packs actually use.
- `corpan/packs/shared/sdk/mockHostApi.ts`: the mock for the
  shared SDK. 30 lines; logs every call to the console.
- `corpan/packs/shared/sdk/index.ts`: re-exports.

### Host-side (the implementation)

- `corpan/corpan-app/src/contentPacks/hostApi.ts`: the production
  HostApi the host instantiates per loaded pack. 459 lines. Each
  method either reads from a Zustand store, invokes a Tauri
  command, or both.
- `corpan/corpan-app/src/contentPacks/types.ts`: the host's copy
  of the contract types. Mirrors the SDK's `index.d.ts`.
- `corpan/corpan-app/src/contentPacks/ContentPackHost.tsx`: the
  React component that mounts a pack. It is the one that calls
  `mount(container, hostApi, initialState)` and stashes the
  optional `{ unmount }` return value for later.
- `corpan/corpan-app/src/contentPacks/install.ts`,
  `installProgress.ts`, `purchase.ts`,
  `phrasePackRegister.ts`: surrounding machinery (download,
  install, purchase, register) that fills in the host side of the
  pack lifecycle.

## How it works

### The contract, field by field

Reading the SDK's `HostApi` declaration top to bottom
(`corpan/packs/sdk/index.d.ts:159`):

```ts
export type HostApi = {
  speak: (uiCode: string, text: string) => Promise<void>
  getStackConfig: () => StackConfig
  onStackConfigChange: (listener: (config: StackConfig) => void) => () => void
  getRandomEntry: () => Promise<EntryOut>
  getRandomEntries?: (count: number) => Promise<EntryOut[]>
  getEntryById: (entryId: number, source?: string) => Promise<EntryOut>
  searchEntriesByText?: (options: {
    text: string
    languageCodes?: string[]
    limit?: number
    offset?: number
  }) => Promise<EntryOut[]>
  searchEntriesByTextCount?: (options: {
    text: string
    languageCodes?: string[]
  }) => Promise<number>
  queryPackDb?: (query: PackDbQuery) => Promise<PackDbQueryResult>
  stt?: SttApi
  isMock?: boolean
}
```

Eleven methods, three categories.

**Speech**:

- `speak(uiCode, text)`: ask the host to say `text` in the voice
  appropriate for `uiCode`. `uiCode` is a BCP-47 language tag (`"es"`,
  `"ko-polite"`, etc.) the host resolves to one of the user's
  configured voices for that language. Returns when speech queueing
  succeeds, not when speech finishes (there is no completion event
  in the contract; packs that want one wire it through `stt` or
  through their own timing model).

**Stack and corpus**:

- `getStackConfig()`: synchronous, returns the current user
  preferences (`activeStackId`, `languages`, `levels`, `rate`,
  `textSize`, `showRomanization`, etc.). The pack reads it once on
  mount and stores any derived state it needs.
- `onStackConfigChange(listener)`: subscribe to changes. The
  returned function is the unsubscribe. Standard "subscribe once,
  unsubscribe on unmount" lifetime.
- `getRandomEntry()`: returns one `EntryOut` shaped like the
  one section 04 walked through.
- `getRandomEntries?(count)`: optional batch variant. Packs that
  display a list ask for several at once; packs that step
  one-at-a-time use the singular form.
- `getEntryById(entryId, source?)`: looks up a specific entry. The
  optional `source` is the phrase-pack id (`"base"` for the
  bundled corpus, or a phrase-pack id when the entry came from a
  pack). Packs that store entries in history need to remember the
  `(source, entryId)` pair; `entryId` is unique only within a
  source.
- `searchEntriesByText?(options)`, `searchEntriesByTextCount?`:
  optional full-text search across the corpus translations.

**Per-pack data and platform**:

- `queryPackDb?(query)`: run a read-only SQL query against the
  pack's bundled SQLite database. Hanzipan uses this for the
  Han-character data it ships; reader packs do not.
- `stt?`: the optional STT sub-API. A separate object because
  pronunciation-coach packs use a dozen methods that no other pack
  needs, and putting them on the top-level shape would clutter the
  contract for every other pack.
- `isMock?`: `true` on the mock host, absent on the production
  one. Packs can branch on it for debugging; production code
  should not depend on the difference.

### Why "the smaller shared SDK"

`corpan/packs/shared/sdk/types.ts` declares a narrower `HostApi`:

```ts
// corpan/packs/shared/sdk/types.ts:24
export type HostApi = {
  speak: (lang: string, text: string) => void
  stopSpeech?: () => void
  getStackConfig: () => StackConfig
  onStackConfigChange?: (listener: (next: StackConfig) => void) => () => void
  getRandomEntry?: () => Promise<EntryOut>
  getRandomEntries?: (count: number) => Promise<EntryOut[]>
  getEntryById?: (entryId: number) => Promise<EntryOut>
  isMock?: boolean
}
```

Two patterns to notice:

1. **`speak` returns `void` here**, not `Promise<void>`. Reader
   packs do not wait on speech; they kick it off and move on. The
   narrower contract makes that explicit.
2. **Almost everything is optional.** Catalog packs use `speak`
   and `getStackConfig` heavily; many do not use `getRandomEntry`
   at all because their content comes from the book corpus
   (downloaded segments), not from the phrase corpus. Marking the
   methods optional documents which ones a given pack actually
   needs.

This is the codebase's working position on the contract: the SDK's
type is the maximal one; the shared/sdk type is the minimal
catalog-pack one; both are honest about what their consumers do.

### The host implementation

`corpan/corpan-app/src/contentPacks/hostApi.ts` builds a fresh
`HostApi` object per pack instance, closing over the necessary host
state. The skeleton looks like:

```ts
export function createHostApi(packId: string): HostApi {
  return {
    speak: async (uiCode, text) => {
      return speakWithStackPrefs(uiCode, text)
    },
    getStackConfig: () => getStackSnapshot(),
    onStackConfigChange: (listener) => {
      // subscribe to the settings store; convert store changes to
      // listener calls; return unsubscribe
    },
    getRandomEntry: async () => {
      return invoke<EntryOut>("get_random_entry_with_translations", {
        // pull current filters from the settings store
      })
    },
    getEntryById: async (entryId, source = "base") => {
      return invoke<EntryOut>("get_entry_by_id_with_translations", {
        entryId,
        source,
      })
    },
    queryPackDb: async (query) => {
      return invoke<PackDbQueryResult>("content_packs_query_db", {
        ...query,
        packId,
      })
    },
    stt: makeSttApi(packId),
  }
}
```

(That is a simplified shape; the actual file is 459 lines because
each method has the edge cases the corresponding Tauri command
expects.)

Three patterns repeat:

- **Read from a store, never accept inline params.** The pack does
  not pass filters to `getRandomEntry`; the host reads the current
  filter state from the settings store and includes it in the
  IPC call. This keeps the contract tight (one zero-arg method)
  and the source of truth (the settings store) singular.
- **Translate at the seam, not above.** The pack does not see Tauri
  command names; the host translates `getRandomEntry()` into
  `invoke("get_random_entry_with_translations", ...)`. Renaming
  the Rust command does not require touching every pack.
- **Errors are surfaced as rejected promises.** The
  `sttRejectionToError` helper at the top of `hostApi.ts`
  illustrates: Swift encodes errors as `"CODE: human message"`,
  and the host parses the prefix into an `Error.code` field so
  packs can route on the code without substring-matching.

### The mock implementations

Two mocks exist, mirroring the two contracts:

- `createMockHostApi()` in `corpan/packs/sdk/index.js` returns
  sample entries (`"hola"` / `"hello"`) and uses the browser's
  `SpeechSynthesisUtterance`. The prototype SDK's mock.
- `createMockHostApi(readerName)` in
  `corpan/packs/shared/sdk/mockHostApi.ts` is a thirty-line
  console-logger that returns a default `StackConfig` and stubs
  the rest. Catalog packs' mock.

Both serve the same purpose: a pack's `npm run dev` works without
the Corpán app in the loop, and the developer can see the pack in
a browser tab on `http://localhost:5173/`. The mock is the dev
loop's lifeline.

### The lifecycle

A pack's HostApi is alive only between the host's `mount(...)` call
and the corresponding `unmount` call. The host creates the API in
`ContentPackHost.tsx` just before mounting:

```ts
// simplified
const hostApi = createHostApi(packId)
const instance = pack.mount(containerEl, hostApi, initialState)
return () => instance?.unmount?.()
```

The cleanup discipline is the standard React effect pattern:
mount returns the unmount; the component holds it; unmount runs on
navigation away. The host does not aggressively garbage-collect
subscriptions the pack created against `onStackConfigChange`,
because the pack's unmount is supposed to drop them. A pack that
does not unsubscribe leaks until the page reloads.

### What the pack cannot do

The Host API is the **only** way out of a pack. By construction:

- The pack cannot reach the Corpán React tree. Its container is
  a DOM element, not a React node; the host treats whatever the
  pack renders as opaque.
- The pack cannot reach the Zustand stores. They live in the host
  app's module graph, which the pack's bundle does not import.
- The pack cannot call Tauri commands directly. There is no
  `invoke` exposed on the host side of the API; only the methods
  the host chose to expose.
- The pack cannot navigate to a different host screen. There is no
  navigation method on the API today.

These are all places the contract has held firm. The pressure to
add a backdoor ("just one more method that exposes the underlying
Tauri command") has shown up several times; every time, the right
answer has been to add a typed method to the contract rather than
let packs reach around it.

## Common operations

1. **Add a method to the contract.** Edit
   `corpan/packs/sdk/index.d.ts` (or `shared/sdk/types.ts` for
   catalog packs only). Implement the method in
   `corpan/corpan-app/src/contentPacks/hostApi.ts`. Implement the
   mock in the corresponding mock file. Bump the SDK version if
   the change is breaking; otherwise leave it. Add an entry to
   the SDK's `CHANGELOG.md` (if one exists yet; the prototype
   does not, but the shared SDK should).
2. **Find what host work a pack triggers.** Read the pack's
   imports of `HostApi`; every method called on it is a pack-to-
   host work edge. The host's `hostApi.ts` shows which Tauri
   command each method invokes.
3. **Diagnose a failed `speak` call in a pack.** Three places to
   look: the pack's call site (is the language code correct for
   the user's stack?), the host's `speakWithStackPrefs` helper
   (which voice did it resolve?), and the Tauri TTS plugin (did
   the platform's TTS engine accept the input?).
4. **Add a per-pack SQLite query.** Use `queryPackDb({ sql,
   params, dbName, maxRows })`. The host limits results to 500 by
   default (2,000 max). Only `SELECT` / `WITH` / `PRAGMA` /
   `EXPLAIN` statements are allowed; the Rust side enforces this
   in `lib.rs:90` (`ensure_readonly_sql`).
5. **Subscribe to settings changes from a pack.** Call
   `onStackConfigChange(listener)` once on mount; capture the
   unsubscribe; call it on unmount. Use the initial value from
   `getStackConfig()` to seed local state.
6. **Mock a method that is not in the default mock.** Pass an
   `overrides` argument to `createMockHostApi(...)` in the
   pack's standalone `index.html`. The SDK spreads it over the
   defaults; your `getEntryById` override wins for that dev run.

## Why we built it this way

A small, typed surface is the choice that pays for itself the most
slowly and the most surely. Every method on the HostApi has to be
designed by someone who is paying attention to what packs actually
need and what the host can reasonably commit to. The result is
that the methods that are there are load-bearing; nothing is
decorative.

The split between the maximal SDK and the narrower shared/sdk is
the codebase's way of acknowledging that not every pack needs
every method. The SDK's type is the upper bound; the shared/sdk's
type is what reader packs actually consume. New contributors
reading the shared/sdk see the small contract that runs the
catalog packs and can build against it without absorbing the
STT-flavored complexity that pronunciation coaches need.

The mock as a first-class implementation is the discipline that
keeps the contract honest. If a method is hard to mock, that is a
signal it has the wrong shape on the contract: it is probably
leaking implementation detail (Tauri command names, host store
internals, platform peculiarities) that the contract is supposed
to hide. The dev loop's friction is what enforces the contract's
quality.

The "no backdoor" position is the architectural commitment that
makes the rest of the system safe to evolve. The host can change
how it implements `getRandomEntry` (different filter relaxation,
different Tauri command shape, different store layout) without any
pack noticing, because packs read only what the contract exposes.
The same is true in reverse: a pack can switch from
`getRandomEntry()` to `getRandomEntries(20)` without the host
caring, because the host returned what the contract specified.

## To go deeper

- `corpan/packs/sdk/index.d.ts` end to end. Read every type,
  every comment. Twenty minutes invested here saves a day of
  guessing later.
- `corpan/corpan-app/src/contentPacks/hostApi.ts` end to end for
  the host's side of the same contract. Watch how the methods
  translate from contract shape into store reads plus Tauri
  invocations.
- `corpan/corpan-app/src/contentPacks/ContentPackHost.tsx` to
  see the mount/unmount lifecycle in React form.
- Section 14 for shared state stores; section 15 for the
  transport bar; section 16 (SQLite) for the pack-DB story
  `queryPackDb` rests on.
