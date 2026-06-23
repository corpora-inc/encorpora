# Frontend performance & hygiene notes (corpan-app/src)

Findings from the 0.17.3 hardening pass.

## Memory hygiene — pack lifecycle

- The single biggest win was native (see `src-tauri/PERFORMANCE.md`): the host now
  frees the LLM/STT models + audio on pack exit via `hostApi.dispose()`
  (`contentPacks/hostApi.ts`). This is the JS chokepoint — any new heavyweight
  native resource a pack can hold should be released here too.
- `ContentPackHost` already: clears dev-reload/retry timers, removes injected
  `<script>/<link>/<style>` by `data-corp-game-id`, runs the pack's `unmount()` in
  a guarded microtask, and calls `stopSpeech()` + `dispose()`. Packs still own
  their own listeners/timers/AudioContext/WebGL cleanup in `unmount()` — there is
  no host-level tracking by design.

## UI correctness wins (0.17.3)

- **Dialogs can't trap the user.** Shared `DialogContent` caps to
  `--dialog-max-h` (safe-area-aware) + `overflow-y-auto` + pinned close. Any new
  dialog inherits this — never set a fixed dialog height without `overflow-y-auto`
  and a reachable close.
- **Home scroll frozen under a running experience** (`body[data-experience-active]`
  → `[data-home-scroll]`), killing the Android scrollbar bleed-through and a
  hidden second scroller stealing momentum.

## Design tokens (use these; don't reinvent magic numbers)

`index.css :root`: `--safe-{top,right,bottom,left}`, `--dialog-max-h`, and the
`--z-*` ladder (`sticky` 1001 … `toast` 1400). Responsive-density convention in
`AGENTS.md §1.1` (compact by default, roomier at `>= md`; phone/tablet/desktop
are equal targets).

## Deferred / watch-list

- A full migration of every hard-coded `z-[1100]`/`z-[1200]` to the `--z-*` ladder
  (only the dialog/overlay were migrated). Do opportunistically when touching a
  component; not worth a sweeping refactor now.
- Per-pack large caches must use IndexedDB, not localStorage (shared ~5 MB origin
  budget). Existing guidance — keep enforcing in pack reviews.
