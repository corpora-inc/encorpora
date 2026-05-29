# 15. Pack Transport

## What it is

The transport bar is the playback control surface at the bottom of
every reading pack. Play and pause, skip thirty seconds backward and
forward, previous and next chapter, a scrub bar, the elapsed and
total time, and a two-line title strip that shows the book and the
current chapter. It is a single shared component at
`corpan/packs/shared/ui/transportBar.ts` (303 lines), styled per
pack via a CSS class prefix, and driven imperatively through a
typed contract that the reader binds to its audio engine.

The transport bar is part of `@shared/ui`, alongside the command
drawer (section 13), the chapter overlay, the narration switcher,
the offline notice, the toast, and the settings rows. None of those
are React. They are plain TypeScript modules that produce DOM and
expose imperative setters and event subscriptions. This is the
shape the pack-side UI library has settled into.

## How it fits

The transport bar is one of three pieces the catalog packs compose
to make an audiobook reader. The other two are the **reader**
(`createParagraphView` in Earthgate's case, a different renderer
in Stargate's) and the **audio engine**
(`@shared/audio/audioEngine.ts`). The transport bar takes user
input and emits events; the audio engine consumes those events and
produces playback; the reader renders the text and highlights the
current word.

Wiring those three together is the reader's job. Earthgate's
`game.ts` constructs all three, subscribes the transport bar's
events to the audio engine's methods, subscribes the audio
engine's tick updates to the transport bar's `setTime` and
`setProgress`, and lets the reader's paragraph view watch the
audio engine for word-level highlighting. The transport bar does
not know about the audio engine; the audio engine does not know
about the transport bar; they cooperate through the reader.

There is a second surface the transport bar engages: the **device
media session** (lock screen play/pause, AirPods controls, Wear OS
notifications). That integration lives in
`@shared/audio/mediaSessionAnchor.ts` and
`@shared/audio/nativeKeepAlive.ts`; together they expose Now
Playing metadata to the OS and route hardware control events back
into the same callbacks the on-screen transport already calls.
Section 18 covers the audio side; the transport bar is the
on-screen end of that loop.

## Files and entry points

- `corpan/packs/shared/ui/transportBar.ts`: 303 lines, the bar
  itself. The worked example for this section.
- `corpan/packs/shared/ui/index.ts`: re-exports
  (`createTransportBar`, `createChapterOverlay`,
  `createCommandDrawer`, `createNarrationSwitcher`,
  `showToast`, etc.).
- `corpan/packs/shared/audio/audioEngine.ts`: 757 lines, the
  audio engine the transport bar usually drives.
- `corpan/packs/shared/audio/mediaSessionAnchor.ts`: 117 lines,
  the lock-screen integration.
- `corpan/packs/shared/audio/nativeKeepAlive.ts`: 204 lines, the
  iOS / Android keepalive that lets playback survive
  backgrounding and routes hardware control events back to the
  pack.
- `corpan/packs/shared/state/bookMetaStore.ts`: 52 lines. The
  cache that lets the transport bar reserve space for the chapter
  title synchronously (section 14).
- `corpan/packs/earthgate-reader/src/game.ts`: the reference
  wiring of transport bar plus audio engine plus paragraph view.
- `corpan/packs/stargate-reader/src/game.ts`: the second
  consumer; same shape, different reader.

## How it works

### The contract

The transport bar's TypeScript type is a small imperative API:

```ts
// corpan/packs/shared/ui/transportBar.ts:1
export type TransportBar = {
  // Setters: the bar's display state
  setPlaying: (playing: boolean) => void
  setBookTitle: (title: string) => void
  setChapter: (title: string) => void
  setHasChapters: (value: boolean) => void
  setTime: (currentMs: number, totalMs: number) => void
  setProgress: (fraction: number) => void
  setChapterMarkers: (fractions: number[]) => void

  // Events: the user's input
  onPlay: (cb: () => void) => void
  onPause: (cb: () => void) => void
  onPrevChapter: (cb: () => void) => void
  onNextChapter: (cb: () => void) => void
  onSkipBack: (cb: () => void) => void
  onSkipForward: (cb: () => void) => void
  onScrubStart: (cb: () => void) => void
  onScrubMove: (cb: (fraction: number) => void) => void
  onScrubEnd: (cb: (fraction: number) => void) => void

  dispose: () => void
}
```

Read this as the reader's view of the bar. Eight setters tell the
bar what to render; nine event subscriptions tell the bar what to
report when the user interacts. The bar holds the DOM; the reader
holds the audio engine. The seam between them is this struct.

There is no internal state the reader can read off the bar.
`setPlaying(true)` does not return a "is playing" getter; the
reader is the source of truth for playback state and the bar is a
view. When the audio engine pauses, the reader calls
`setPlaying(false)`; when the user taps the bar, the bar calls
the `onPause` callback and the reader pauses the engine and then
echoes it back with `setPlaying(false)`.

### The layout, in the comment

The docstring above `createTransportBar` is the small piece of
prose that documents the bar's visual structure better than any
class diagram could:

```
Layout:
   Top row:    book title
               chapter title           [elapsed / total]
   Scrub:    [═══════════●═══════════════════════════════════]
   Bottom:   [⏮]  [−30]  [▶/❚❚]  [+30]  [⏭]

The book prefix and chapter sit in separate spans inside one flex
column so they stack vertically on the left; each truncates its
own text with its own ellipsis. The time label hangs unattached
on the right and can never overrun the chapter. When
setBookTitle("") is called the prefix span collapses
(:empty { display: none }) and the chapter title sits alone,
vertically centered against the time.
```

That paragraph is the design contract. Two stacked spans inside a
flex column means a chapter-only book and a book-with-chapter both
align cleanly; an empty book title disappears entirely thanks to
the `:empty` selector; the right-aligned time never collides with
the chapter title.

These are exactly the kinds of details that a CSS-in-JS approach
would have hidden inside generated class names. Here the layout
choices are visible in twelve lines of prose at the top of the
file that creates them; the actual implementation is dense but
readable, and the comments correspond to specific class names in
the resulting CSS.

### `setHasChapters` and the bookMetaStore

The reason `setHasChapters` exists at all is the rationale
documented in `bookMetaStore.ts` (section 14). The transport bar
needs to know **before** segments load whether the book has
chapters, so it can reserve a line of vertical space for the
chapter title; if it does not reserve the line, the layout jerks
when the title arrives async.

The handshake:

1. Reader calls `createTransportBar(parent, "earthgate")`.
2. Reader immediately calls
   `bar.setHasChapters(bookMeta.load(bookId)?.hasChapters ?? false)`
   from the per-book metadata cache. If the cache is hit, the
   bar reserves the line on frame one.
3. Once segments load, the reader checks the actual chapter index.
   If it differs from the cache, it calls `setHasChapters(actual)`
   and writes the result back to `bookMeta.save(bookId, ...)`.

The cost: on the very first read of a brand-new book, the cache
misses and the layout shifts once. The cost is acceptable because
it happens at most once per book per device.

### The classPrefix hook

`createTransportBar(parent, classPrefix)` takes a CSS class prefix
so each catalog pack can theme the bar:

```ts
// pack-specific stylesheet (earthgate)
.earthgate-transport { background: var(--earthgate-bg); ... }
.earthgate-transport-button { color: var(--earthgate-fg); ... }
```

Stargate uses `"stargate"`; Earthgate uses `"earthgate"`. The
transport bar's source does not name colors; the pack's CSS does.
This is the same pattern the catalog shell uses for its drawer
(section 13).

### The audio engine seam

The reader's wiring code is the most instructive part. Roughly:

```ts
const bar    = createTransportBar(container, "earthgate")
const engine = createAudioEngine({ ... })

bar.onPlay(()  => engine.play())
bar.onPause(() => engine.pause())
bar.onSkipBack(()    => engine.seek(engine.getCurrentMs() - 30_000))
bar.onSkipForward(() => engine.seek(engine.getCurrentMs() + 30_000))
bar.onPrevChapter(() => engine.seek(chapterIndex.prev(engine.getCurrentMs())))
bar.onNextChapter(() => engine.seek(chapterIndex.next(engine.getCurrentMs())))

bar.onScrubMove((fraction) => engine.seek(fraction * engine.getDurationMs()))

engine.on("tick", ({ currentMs, totalMs }) => {
    bar.setTime(currentMs, totalMs)
    bar.setProgress(currentMs / totalMs)
})

engine.on("play",  () => bar.setPlaying(true))
engine.on("pause", () => bar.setPlaying(false))
engine.on("chapterChange", (title) => bar.setChapter(title))
```

(Earthgate's actual wiring is more elaborate; this is the spine.)

Two things are doing the work here:

- **Events flow in both directions across the seam**, but the
  authority is one-way: the engine is the source of truth, and
  the bar reflects it. Tapping play does not flip the bar's
  state; tapping play tells the engine to play, the engine starts
  playing, the engine fires `play`, and the engine's fire is what
  updates the bar.
- **The reader is the wiring**. The bar does not import the audio
  engine; the audio engine does not import the bar. The reader
  imports both and connects them. Replacing the audio engine with
  a different implementation (a streaming engine, a different
  segment loader) does not change the bar at all.

### The media session

`@shared/audio/mediaSessionAnchor.ts` wires the same audio engine
to the W3C Media Session API, which the WebView surfaces to the
OS. The OS then shows the book title, the chapter, the artwork,
and the play/pause buttons on the lock screen and the Bluetooth
device.

`@shared/audio/nativeKeepAlive.ts` calls into the Tauri plugin
`tauri-plugin-audio-keepalive` to register the app with the
platform's audio-session machinery so background playback does
not get killed by the OS. It also exposes a `__readerCmd` global
that the native side can call with `"play"`, `"pause"`,
`"skipForward"`, `"skipBack"`, `"seek"`, `"prevChapter"`, or
`"nextChapter"` when the user taps a hardware control. The reader's
game.ts wires `__readerCmd` back through the same callbacks the
on-screen bar uses.

The result: tapping play on the on-screen bar, tapping play on the
lock screen, double-tapping an AirPods stem, and pressing the play
button on a Bluetooth steering wheel are the same input to the
reader. The bar's surface is on-screen; the rest of the surfaces
land through the keepalive plugin; the reader does not know which
one is firing.

### `dispose`

The bar's `dispose()` tears down the DOM the bar created, removes
its event listeners, and clears its setter closures. Readers call
it as part of their own `dispose()` when the catalog shell signals
a book change. The reader's clean-up order matters: pause the
engine first, then dispose the bar, then dispose the engine, then
dispose the reader's own DOM. Doing it in the wrong order can
leave a callback firing into a disposed bar; this is one of the
cases the code comments call out explicitly in the readers.

## Common operations

1. **Add a control to the transport bar.** Add a setter and (if
   appropriate) an event to the type. Implement the DOM and CSS
   in `transportBar.ts`. Update the readers' wiring to subscribe.
2. **Style the bar for a new pack.** Define
   `.<prefix>-transport`, `.<prefix>-transport-button`, etc. in
   the pack's stylesheet. Pass the prefix when calling
   `createTransportBar(...)`.
3. **Hook the bar into a non-audiobook pack.** The same imperative
   API works for any "thing the user plays." Hover Runner does
   not use it (its loop is too different); a podcast pack
   would.
4. **Surface a new event from a hardware control.** Extend the
   `__readerCmd` signature in `nativeKeepAlive.ts` and the
   matching native plugin code; route the new command through
   the reader's existing on-bar handler.
5. **Time-format something other than `m:ss`.** The
   `formatTime(ms)` helper at the top of `transportBar.ts` is the
   single place; everything that displays time goes through it.
6. **Diagnose a layout shift on first chapter render.** Inspect
   the `bookMetaStore` cache for the book. If empty, the reader
   skipped writing it on a previous read or the prefix changed
   between reader versions.

## Why we built it this way

Imperative DOM components in a TypeScript library are the shape
the pack-side UI has settled into after trying several
alternatives. React is heavy for packs that already have a tight
draw loop; web components are awkward to type and awkward to
restyle; the imperative `createX(...)` factory returns a small
object the reader can call into and dispose. The library stays
small (3,000 lines total under `shared/ui` and `shared/audio`
combined), and the readers stay in charge of their own
lifecycles.

The transport bar's setter-plus-event split is the contract that
keeps the bar reusable. A bar that knew about an audio engine
would be specialized to one engine; a bar that only emitted
events would force every reader to reimplement display logic.
This split lets the same bar drive the reader's audio engine, the
media session's hardware controls, and a future reader that
streams audio over the network instead of from disk.

The `setHasChapters` + bookMetaStore pairing is a small example of
where the team's discipline shows up. The naive design (the bar
expands its layout when a chapter title arrives) is simple but
visually wrong on the first frame of the second read of a book; the
cached design (the bar reserves space synchronously from a
per-book cache) costs five lines of state plus three lines of
wiring per reader, and prevents the layout shift permanently.
The cost is documented; the alternative is documented; the chosen
approach is the one most respectful of the user's eyes.

The CSS-class-prefix theming is the same pattern as the catalog
chrome (section 13). One imperative factory, one stylesheet per
pack. No fork to recolor. No conditional rendering for "is this
Earthgate or Stargate." The pack's own selectors win because they
are the ones in the pack's loaded stylesheet.

The native-keepalive integration is the choice that makes
Corpán's audiobook experience competitive with native audiobook
apps. Without it, every backgrounded session would be killed by
iOS or Android within a minute; with it, the user can lock their
phone and listen for an hour, and the transport bar's same
callbacks are what handle the hardware controls. The complexity is
contained to two files; the surface the rest of the pack sees is
the same it would see in a foreground-only world.

## To go deeper

- `corpan/packs/shared/ui/transportBar.ts` end to end. Twenty
  minutes; the layout comment at the top is worth reading first.
- `corpan/packs/earthgate-reader/src/game.ts` for the canonical
  wiring of transport + audio engine + paragraph view.
- `corpan/packs/shared/audio/audioEngine.ts` for the engine side
  of the contract (section 18 covers the audio pipeline in
  depth).
- `corpan/packs/shared/audio/mediaSessionAnchor.ts` and
  `nativeKeepAlive.ts` for the lock-screen and hardware-controls
  story.
- Section 14 for the `bookMetaStore` that makes
  `setHasChapters` synchronous; section 13 for the command
  drawer the transport bar lives beside.
