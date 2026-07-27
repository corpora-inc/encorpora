// FORGE, as a Dynawalla pack.
//
// The whole seam is this file. `mount.ts`, the economy, the renderer and the
// particle budget are untouched: the real host is handed to the same `mount`
// the stub host was, because the adapter presents the same synchronous surface
// the game's `Host` type already describes.
//
// Everything mathematical now comes from the host — the prompt on the billet,
// the canonical answer on one of the four slugs, the mal-rule distractors on
// the other three, the judgement, and the record it lands in. The game does no
// arithmetic that decides anything, which is exactly the property the pack
// contract exists to give.
//
// The one thing FORGE needs that FUSE and SIEGE do not is a save. It is an
// incremental game: the run is the smelting chain you built over days, and a
// chain that resets every launch is a different, much worse game. A pack frame
// is sandboxed without `allow-same-origin` and therefore has no `localStorage`
// at all, so the save goes through the SDK's `storage` capability instead —
// hydrated here, before mount, so `save.ts` stays synchronous for the loop.

import { createGameHost, renderNoHost } from "../../../packs/shared/game-host/index.ts"
import type { Host } from "./contract.ts"
import { mount } from "./mount.ts"
import { SAVE_KEY, useSaveSlot } from "./game/save.ts"

const root = document.getElementById("app")
if (!root) throw new Error("#app missing")

async function start(el: HTMLElement): Promise<void> {
  const mounted = await createGameHost({ domain: "add-sub" })

  // Read the save before the game asks for it. `load()` runs inside `mount`
  // and cannot await, so the value has to be in hand by then; a write is fire
  // and forget, and the in-memory copy is authoritative for the rest of the
  // session so a failed write never rolls the player back mid-run.
  let cached: string | null = null
  if (mounted.client.can("storage.get")) {
    try {
      cached = await mounted.client.storage.get(SAVE_KEY)
    } catch (error) {
      console.error("[forge] the save could not be read", error)
    }
    useSaveSlot({
      read: () => cached,
      write: (value) => {
        cached = value
        void mounted.client.storage.set(SAVE_KEY, value).catch((error: unknown) => {
          console.error("[forge] the save could not be written", error)
        })
      },
    })
  } else {
    // Loud, not silent. A host that did not grant storage gives a playable
    // FORGE that forgets everything, and that is worth saying once rather than
    // leaving a parent to conclude the game is broken.
    console.error("[forge] storage was not granted; the smelting chain will not persist")
    useSaveSlot({ read: () => null, write: () => {} })
  }

  // Stocked before the first frame: a billet that spawns into an empty pool is
  // a billet with a blank face, and it would happen exactly once, on launch, in
  // front of the child.
  await mounted.warm()

  const instance = mount(el, mounted.host as unknown as Host)

  // The host tells a pack before its port dies, so the loop stops before the
  // frame is torn down rather than a frame or two after it.
  mounted.client.on("dispose", () => {
    instance.unmount()
  })
}

void start(root).catch((error: unknown) => {
  console.error("[forge] could not start", error)
  renderNoHost(root, "FORGE")
})
