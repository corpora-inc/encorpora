// ABYSSAL BLOOM, as a Dynawalla pack.
//
// The seam and nothing else. `mountGame` is handed the real host in place of
// the stub, because the adapter presents the same synchronous surface the
// game's own `Host` in `contract.ts` already describes — so the board, the
// ladder, the vents, the tide and the economy are untouched.
//
// What crosses the boundary is the vent's request. A vent holds up a problem
// the curriculum drew, and the child answers it by *building the answer*: when
// the canonical answer happens to sit on the polyp ladder the vent takes a
// polyp worth exactly that, and when it does not the vent falls back to four
// chips carrying the answer and three mal-rule distractors. Either way the game
// never decides whether an attempt was right — it reports what was posted and
// `items.answer` is the judge.
//
// The doubling is the game's own mathematics and stays that way: two equal
// polyps merging into their sum is arithmetic the child performs with a
// gesture, not a question anybody asked, so nothing about it is reported.
//
// **The save goes through the host.** A pack frame is sandboxed without
// `allow-same-origin` and therefore has no `localStorage` at all, and an idle
// game that forgets its reef on every launch is a different, much worse game —
// `offlineHaul` exists to pay out exactly the time you were away. So the slot
// in `core/save.ts` is hydrated here, before mount, and stays synchronous for
// the loop.

import { createGameHost, renderNoHost } from "../../../packs/shared/game-host/index.ts"
import type { Host } from "./contract.ts"
import { mountGame } from "./game.ts"
import { SAVE_KEY, useSaveSlot } from "./core/save.ts"

const root = document.getElementById("app")
if (!root) throw new Error("merge-idle: #app missing")

async function start(el: HTMLElement): Promise<void> {
  const mounted = await createGameHost({ domain: "add-sub" })

  // Read the save before the game asks for it. `restore()` runs inside
  // `mountGame` and cannot await, so the value has to be in hand by then; a
  // write is fire and forget, and the in-memory copy is authoritative for the
  // rest of the session so a failed write never rolls the reef back mid-run.
  let cached: string | null = null
  if (mounted.client.can("storage.get")) {
    try {
      cached = await mounted.client.storage.get(SAVE_KEY)
    } catch (error) {
      console.error("[abyssal-bloom] the save could not be read", error)
    }
    useSaveSlot({
      read: () => cached,
      write: (value) => {
        cached = value
        void mounted.client.storage.set(SAVE_KEY, value).catch((error: unknown) => {
          console.error("[abyssal-bloom] the save could not be written", error)
        })
      },
    })
  } else {
    // Loud, not silent. A host that did not grant storage gives a playable
    // ABYSSAL BLOOM that forgets the reef, and that is worth saying once rather
    // than leaving a parent to conclude the game is broken.
    console.error("[abyssal-bloom] storage was not granted; the reef will not persist")
    useSaveSlot({ read: () => null, write: () => {} })
  }

  // Stocked before the first frame: the first vent asks the instant it opens,
  // and a vent with a blank face is the kind of thing that happens exactly
  // once, on launch, in front of the child.
  await mounted.warm()

  const handle = mountGame(el, mounted.host as unknown as Host)

  // The host tells a pack before its port dies, so the rAF loop and the audio
  // context are torn down before the frame is, rather than a frame or two
  // after it.
  mounted.client.on("dispose", () => {
    handle.unmount()
  })
}

void start(root).catch((error: unknown) => {
  console.error("[abyssal-bloom] could not start", error)
  renderNoHost(root, "ABYSSAL BLOOM")
})
