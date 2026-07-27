// ARENA, as a Dynawalla pack.
//
// The seam and nothing else. `mount` is handed the real host in place of the
// stub, because the adapter presents the same synchronous surface the `Host`
// in `contract.ts` already describes — so the water, the rivals, the depth
// ratchet and the tier governor are untouched.
//
// What crosses the boundary is the Resonance. Four glass spheres rise carrying
// the answer and three mal-rule distractors the curriculum drew, and the game
// never decides whether a child was right: it reports which sphere was flown
// into, verbatim, and `items.answer` is the judge. That is also why
// `items.reveal` is declared — a sphere has to carry the answer *before* the
// child reaches it, which is the sanctioned use of the grant and changes
// nothing about who judges.
//
// The arena's own mathematics — every second of play is a magnitude comparison
// against your own mass — is not reported, because nobody asked it as a
// question. It is the mechanic, not the assessment.
//
// No seed is passed: a pack run is a fresh ocean. `?seed=` belongs to
// `index.html`, which the pack build does not include.

import { createGameHost, renderNoHost } from "../../../packs/shared/game-host/index.ts"
import { mount } from "./contract.ts"
import type { Host } from "./contract.ts"

const root = document.getElementById("app")
if (!root) throw new Error("arena: #app missing")

async function start(el: HTMLElement): Promise<void> {
  const mounted = await createGameHost({ domain: "compare" })
  // Stocked before the first frame: the first Resonance opens sixteen seconds
  // in, and four spheres with blank faces is the kind of thing that happens
  // exactly once, on launch, in front of the child.
  await mounted.warm()

  const handle = mount(el, mounted.host as unknown as Host)

  // The host tells a pack before its port dies, so the rAF loop, the WebGL
  // context and the audio graph are torn down before the frame is, rather than
  // a frame or two after it.
  mounted.client.on("dispose", () => {
    handle.unmount()
  })
}

void start(root).catch((error: unknown) => {
  console.error("[arena] could not start", error)
  renderNoHost(root, "ARENA")
})
