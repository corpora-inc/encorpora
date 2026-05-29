# 06. React

## What it is

React is a JavaScript library for describing user interfaces as
functions of state. Each component is a function that takes props
(its inputs) and returns a description of what the UI should look
like. React calls the function, compares the new description against
the last one, and writes the minimum set of changes into the DOM. The
programmer never writes DOM mutations directly; the programmer writes
"what the UI should look like right now," and React takes care of
"what to change."

This is the model that the React side of Corpán is built on. The
webview Tauri opens (section 04) loads a single HTML page, and that
page mounts a React tree at `<div id="root">`. The tree handles every
piece of UI in the app: the main phrase loop, the language settings
panel, the packs catalog, the onboarding flow, the pronunciation
coach surface. All of it is React components rendered by Vite-built
JavaScript talking to Rust through `invoke()`.

## How it fits

React is the inner layer of the host app. Tauri opens the window;
React fills it. Almost no Corpán-specific logic lives outside React:
state lives in Zustand stores, IPC calls happen from event handlers
and effects, navigation between screens happens by changing what
React renders. The packs that load at runtime (sections 10 through
15) are also typically React or React-adjacent, mounted into their
own container within the host React tree.

The interesting boundaries this section meets:

- The Tauri IPC boundary (section 04), where React calls `invoke()`
  to ask Rust for data.
- The state-management seam, where Zustand (chosen instead of Redux
  or context) keeps shared state in pure stores that components
  subscribe to with selectors.
- The TypeScript boundary (section 07), where every prop, every
  hook return value, and every IPC payload is typed.

## Files and entry points

- `corpan/corpan-app/index.html`: the single HTML page Tauri loads.
  Contains a `<div id="root">` and a `<script type="module"
  src="/src/main.tsx">` tag. The webview never navigates between
  HTML files; everything is one document.
- `corpan/corpan-app/src/main.tsx`: 58 lines, the mount point.
  Calls `ReactDOM.createRoot(...).render(<App />)`. Also wires
  `LanguageSynchronizer` around `<App />` and exposes a
  `__corpanDebug` object on `window` for ad-hoc inspection from
  Safari Web Inspector.
- `corpan/corpan-app/src/App.tsx`: 354 lines, the screen router.
  Picks between onboarding, the main experience, settings, packs,
  pronunciation coach, etc. based on settings store state.
- `corpan/corpan-app/src/components/MainExperience.tsx`: 648 lines,
  the home screen and the worked example for this section.
- `corpan/corpan-app/src/components/`: every other component. The
  `ui/` subdirectory holds primitives (Button, Dialog, etc., the
  shadcn/ui style); the `packs/` subdirectory holds pack-specific
  UI; the directory root holds screen-level components.
- `corpan/corpan-app/src/store/`: Zustand stores. `settings.ts`,
  `history.ts`, `rating.ts`, `phrasePacks.ts` and so on. Each is a
  module that exports a `useXStore()` hook.
- `corpan/corpan-app/src/hooks/`: custom hooks
  (`useScrollNavigation`, etc.) that encapsulate component-shaped
  logic without rendering anything themselves.
- `corpan/corpan-app/src/util/`, `src/utils/`, `src/lib/`: helpers,
  conversion functions, the TTS adapter, browser quirks. The dual
  `util/`/`utils/` exists because the codebase grew into both
  conventions; new code prefers `util/`.
- `corpan/corpan-app/src/contentPacks/`: the pack-loading bridge.
  Holds the host-side helpers that mount a pack into the React tree
  and broker its calls to the host API.
- `corpan/corpan-app/src/i18n.ts`: i18next setup. Translations are
  authored as JSON and loaded at startup.

## How it works

### Components are functions

A component is a JavaScript function whose name starts with a capital
letter and which returns JSX. JSX is sugar for `React.createElement`
calls; the compiler turns `<Button onClick={f}>Click</Button>` into
`React.createElement(Button, { onClick: f }, "Click")`. The argument
to the function is **props**, an object containing whatever the
caller passed in. Components compose: the return value of one
component can include other components.

```tsx
function MetaChips({ entry }: { entry: EntryOut }) {
    const { t, i18n } = useTranslation();
    // ...
    return (
        <div data-meta-chips ...>
            <span ...>{entry.level.toUpperCase()}</span>
            {entry.domains.map((d) => <span key={d}>{t(`categories.${d}`)}</span>)}
        </div>
    );
}
```

This is the `MetaChips` subcomponent inside `MainExperience.tsx`. It
takes one prop, `entry`, typed as `EntryOut`. It calls a hook
(`useTranslation`) to get translation functions. It returns a JSX
tree. That is the entire shape: function in, JSX out.

### Hooks are how a function holds state

A pure function cannot remember anything between calls. React solves
this with **hooks**: a small set of functions that, when called from
inside a component, hook into a per-component slot of memory React
maintains. The component is still a function, but the slots it draws
from are tied to its position in the React tree.

The five hooks `MainExperience` reaches for are the everyday set:

- `useState`: a piece of mutable state and a setter. Setting it
  triggers a re-render of the component.
- `useRef`: a mutable container that does **not** trigger a
  re-render when written. Used for "I need a value to survive
  re-renders but I don't want React to care about it." The
  `fetchSeqRef` in `MainExperience` is the canonical use: an
  always-incrementing integer that tracks which fetch is the most
  recent so a stale response can be discarded.
- `useEffect`: a function that runs after render. Pass a
  dependency array; the function re-runs whenever any dependency
  changes. The optional return value is a cleanup function that
  runs before the next re-run and on unmount.
- `useLayoutEffect`: same shape as `useEffect`, but runs
  synchronously after DOM mutations and before paint. Use it when
  you must measure or write to the DOM before the user sees the
  frame. `MainExperience` uses one to scroll back to the top of the
  current entry when the entry changes.
- `useCallback` and `useMemo`: stabilize the identity of a function
  or value across re-renders. The point is not performance; the
  point is to keep dependency arrays in **other** hooks honest.

A worked example from `MainExperience.tsx:286`:

```tsx
const resolveCurrent = useCallback(
    async (entry_id: number, source: string = "base") => {
        const mySeq = ++fetchSeqRef.current;
        try {
            const entry = await invoke<EntryOut>(
                "get_entry_by_id_with_translations",
                { entryId: entry_id, source },
            );
            if (entry && mySeq === fetchSeqRef.current) setCurrEntry(entry);
        } catch (err) {
            // ... recovery: substitute a same-filter random entry ...
        }
    },
    [levels, phrasePackIds, baseCorpusEnabled, replaceCurrent],
);
```

Six things happening here:

1. `useCallback` returns the same function reference across renders
   as long as the dependency array (`[levels, phrasePackIds,
   baseCorpusEnabled, replaceCurrent]`) does not change.
2. `++fetchSeqRef.current` captures the sequence number for **this**
   call. Two `resolveCurrent` calls in flight at once can be told
   apart by comparing their captured `mySeq` to the current
   `fetchSeqRef.current`.
3. `await invoke<EntryOut>(...)` is the Tauri IPC call. The generic
   parameter (`<EntryOut>`) tells TypeScript the resolved type; Rust
   actually decides it.
4. The `if (entry && mySeq === fetchSeqRef.current)` guard is the
   anti-stale-write check: a slower response that arrives after a
   newer one would have incremented `fetchSeqRef.current` further,
   so its stored `mySeq` no longer matches and it is silently
   dropped instead of overwriting the displayed entry.
5. The `catch` branch handles a specific failure (the entry has
   been removed from the corpus while it sits in history) by
   substituting a random replacement. The comment in place is a
   short essay on why this is necessary; read it for the texture.
6. The dependency array contains every variable the callback
   captures from the surrounding scope. ESLint's
   `react-hooks/exhaustive-deps` rule polices this; missing
   dependencies produce stale closures, the single most common
   React bug class.

### The rendering model

When state changes, React re-runs the component function from the
top. Every line runs again, every variable is recomputed, every JSX
node is freshly constructed. The output is compared to the previous
render, and only differences are applied to the DOM. This sounds
expensive and is not: building plain objects is fast, and the
DOM diff is the part that actually touches the browser.

This is the model that gives React its declarative feel. You do not
write "the user clicked next, so move the focus to the next button."
You write "the current entry is whatever is at `index` in the
history; if `index` changes, the entry changes; React figures out
what to redraw." Effects, refs, and memoization are the escape hatches
for the cases where the model is not enough.

### Zustand and selectors

Component-local state lives in `useState`. State that two components
need to share lives in a Zustand store. Zustand is a 4-kilobyte
state management library whose model is a single observable object
exposed through a hook. The Corpán app has several:

```tsx
import { useSettingsStore } from "@/store/settings";

// inside MainExperience:
const activeStackId = useSettingsStore((s) => s.activeStackId);
const languages    = useSettingsStore((s) => s.languages);
const levels       = useSettingsStore((s) => s.levels);
```

The argument to `useSettingsStore` is a **selector**: a function
that picks the piece of store state this component cares about.
Zustand subscribes the component only to the selected piece. When
the selected value changes (by referential identity), the component
re-renders; when other parts of the store change, it does not.

This is the "subscribe to a slice" pattern that Redux popularized,
without the boilerplate. Stores are plain objects; setters live on
the store itself; persistence to `localStorage` is a one-line
middleware. The Zustand stores under `corpan/corpan-app/src/store/`
are the durable state of the app: settings, history, ratings,
installed phrase packs, etc.

### Effects and the loop

`MainExperience` runs three `useEffect` calls that drive the loop:

```tsx
// On stack switch: clear view, then either load existing selection
// or fetch a new random entry.
useEffect(() => {
    setCurrEntry(null);
    if (ids.length === 0) {
        void fetchRandomEntry();
    } else if (index >= 0 && index < ids.length) {
        void resolveCurrent(ids[index], sources[index] ?? "base");
    }
}, [activeStackId]);

// Re-fetch the same entry when the language list changes.
useEffect(() => {
    if (index >= 0 && index < ids.length) {
        void resolveCurrent(ids[index], sources[index] ?? "base");
    }
}, [languages]);
```

Each `useEffect` has a clear shape: condition on the dependency,
do something side-effectful (fetch from Tauri, log analytics,
adjust layout), optionally clean up. The `void` prefix is there
to tell ESLint that the returned promise is intentionally
unawaited. Inside the effect, Rust is called through `invoke`, and
on resolution the React state is updated through `setCurrEntry`,
which triggers a re-render that uses the new entry. The loop is
closed.

### Strict mode

`main.tsx` wraps `<App />` in `<React.StrictMode>`. In development,
StrictMode renders every component **twice** to surface side effects
in render functions and stale assumptions in effects. In production
it does nothing. The double-render is the reason effects must be
idempotent and the reason `initAnalytics()` lives at the bottom of
`main.tsx` outside the React tree (the comment makes the
HMR-idempotence promise explicit).

### Why a webview UI and not a native one

The Corpán app could in principle be written with SwiftUI on iOS,
Jetpack Compose on Android, and an Electron equivalent on desktop;
each platform has a first-party UI toolkit. The cost would be three
separate UIs and three separate places to ship a bug fix. React
inside a Tauri webview costs a small amount of performance and one
extra abstraction (the webview is not a "real" native control), and
buys one UI surface for every platform Corpán ships to.

For Corpán specifically, the UI is mostly text. Phrases, language
labels, controls. The native-vs-webview gap is widest on
high-interaction surfaces (gestures, scrolling lists, instant
hardware-accelerated transitions) and narrowest on text-rendering
surfaces; the app sits comfortably on the narrow side.

## Common operations

1. **Add a screen.** Create a component file under
   `corpan/corpan-app/src/components/`. Render the new screen from
   `App.tsx` conditional on a settings flag or a route state.
   Subscribe to whichever Zustand stores it needs.
2. **Add a piece of shared state.** Edit the relevant store under
   `src/store/`. Add a field to the store's state type, a setter,
   and any persistence config. Components opt in by adding a
   selector.
3. **Call Rust from a component.** Import `invoke` from
   `@tauri-apps/api/core`. Call it inside an event handler or
   inside `useEffect`. Use the generic parameter to annotate the
   return type (`await invoke<EntryOut>("name", { args })`). Mirror
   the Rust struct as a TypeScript type at the top of the file.
4. **Stop a stale fetch from overwriting fresh state.** Use the
   `fetchSeqRef` pattern: bump a ref at the start, compare to the
   ref before writing back state. See `MainExperience:286` for
   the canonical site.
5. **Memoize a derived value.** `useMemo(() => buildLookup(entry),
   [entry])` reruns `buildLookup` only when `entry` changes. The
   benefit is keeping the **identity** of the returned object stable
   across re-renders, so downstream dependency arrays do not churn.
6. **Avoid re-rendering on unrelated store changes.** Make the
   selector narrow. `useStore((s) => s.activeStackId)` re-renders
   when `activeStackId` changes; `useStore((s) => s)` re-renders
   when **anything** in the store changes.

## Why we built it this way

React inside the webview is the choice that maps the cross-platform
nature of the app onto one UI codebase. Everything in
`corpan-app/src/` runs on iOS, Android, macOS, Windows, and Linux
unchanged, because the React tree is unaware of which webview is
hosting it.

Zustand instead of Redux is a choice in favor of the smallest model
that does the job. Stores are 30 lines apiece. State updates do not
go through reducers; they are method calls on the store. Selectors
keep components subscribed only to what they read, which is what
Redux's `mapStateToProps` was supposed to do but rarely did in
practice.

`useCallback` and `useMemo` are used not for performance but as
the type system inside React's rendering model. They give a stable
identity to functions and objects so that the dependency arrays of
other hooks behave correctly. The cost (boilerplate) is real; the
benefit (no stale closures, no infinite re-render loops) is the
difference between a stable app and an app that crashes when a
user changes their language preference.

Hooks over class components is React's own evolution, but it is
also the right shape for this codebase. A component's data flow
(read this prop, subscribe to this store slice, run this effect on
change) is local to the function body and shows up in order. The
"this" of a class did not.

## To go deeper

- The official React docs at `react.dev` are excellent. Start at
  "Quick Start," then "Thinking in React," then the "Reference"
  section for each hook. The new docs (post-2023) finally explain
  the rendering model honestly; older tutorials often did not.
- Dan Abramov, *Just Javascript* (online, free at
  `justjavascript.com`). Twenty short modules that fix the
  prerequisites the React docs assume. Worth the few hours for
  anyone whose JS feels like cargo-culting.
- The `@tauri-apps/api` JS reference at
  `v2.tauri.app/reference/javascript/`. Most of what React in this
  app does at the IPC seam is in the `invoke` and `event` modules.
- Read `App.tsx` and `MainExperience.tsx` end to end at least once.
  The first is the screen router; the second is the loop. Together
  they are the spine of the Corpán app UI.
