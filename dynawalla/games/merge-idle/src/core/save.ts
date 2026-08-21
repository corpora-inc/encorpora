/**
 * Where the reef's save actually lives.
 *
 * Synchronous on purpose: `restore()` runs inside `mount`, before the first
 * frame, and `save()` runs from the game loop. Neither may await.
 *
 * `localStorage` is the default because the standalone workbench has one. A
 * pack frame does NOT — it is sandboxed without `allow-same-origin`, so its
 * origin is opaque and every storage API on it either throws or is absent.
 * That is exactly why the SDK has a `storage` capability, and why this is a
 * seam rather than a direct call: ABYSSAL BLOOM is an idle game whose whole
 * subject is a reef that keeps growing while you are away — `offlineHaul` pays
 * out a tide the moment you come back — and one that silently forgets on every
 * launch is not the same game. `src/pack.ts` installs a host-backed slot here,
 * hydrated before mount so this stays synchronous.
 *
 * Same shape, and the same reasoning, as dynawalla/games/forge/src/game/save.ts.
 */

// The save slot, versioned so a schema change orphans old saves rather than
// mis-reading them. `gitleaks:allow` because the pinned scanner's
// `generic-api-key` rule reads `KEY = "<long dotted string>"` as a credential:
// the value clears its entropy floor purely because of its length, not because
// of what it holds. It is a storage path, it is on the client, and it is in a
// public repo on purpose.
const SAVE_SLOT = 'dynawalla.abyssal-bloom.v1' // gitleaks:allow

export type SaveSlot = {
  read(): string | null
  write(value: string): void
}

const browserSlot: SaveSlot = {
  read: () => localStorage.getItem(SAVE_SLOT),
  write: (value) => {
    localStorage.setItem(SAVE_SLOT, value)
  },
}

let slot: SaveSlot = browserSlot

/** Swap the backing store. Called once, before `mount`, or never. */
export function useSaveSlot(next: SaveSlot): void {
  slot = next
}

/** The key a host-backed slot should file this game's save under. */
export const SAVE_KEY = SAVE_SLOT

/** The stored save, or null. Never throws — a reef that will not load starts fresh. */
export function readSave(): string | null {
  try {
    return slot.read()
  } catch (e) {
    console.warn('[abyssal-bloom] could not read the save; starting fresh', e)
    return null
  }
}

/** Persist the save. Never throws — private mode costs the resume, not the run. */
export function writeSave(value: string): void {
  try {
    slot.write(value)
  } catch (e) {
    console.warn('[abyssal-bloom] could not write the save', e)
  }
}
