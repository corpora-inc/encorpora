// LATTICE RUNNER, as a Dynawalla pack.
//
// The seam and nothing else. `mount` is handed the real host in place of the
// stub, because the adapter presents the same synchronous surface `Host` in
// `contract.ts` already describes — so the lattice, the field, the pulse and
// the resonance lock are untouched.
//
// What crosses the boundary is the CORE. A core carries a problem the
// curriculum drew and fractures into the candidate values the host revealed;
// the child hands one in by destroying it from a beam that divides it. The game
// never decides whether a submission was right — it labels which candidate
// carries the canonical value the host returned, reports the value that was
// struck, and the host's record is the one that counts.
//
// The stream of ordinary automata is the game's own mathematics: divisibility
// over numbers the game itself made up. Nobody asked those questions, so
// nothing about them is reported.

import { createGameHost, renderNoHost } from "../../../packs/shared/game-host/index.ts"
import { mount } from "./contract.ts"
import type { Host } from "./contract.ts"

const root = document.getElementById("app")
if (!root) throw new Error("beam: #app missing")

async function start(el: HTMLElement): Promise<void> {
  const mounted = await createGameHost({ domain: "add-sub" })
  // Stocked before the first frame: a core comes down inside the first ten
  // seconds, and a core with a blank face is the kind of thing that happens
  // exactly once, on launch, in front of the child.
  await mounted.warm()

  const handle = mount(el, mounted.host as unknown as Host)

  // The host can put a sheet over a still-mounted pack — a purchase surface, a
  // parent gate — and the call most likely to raise one is this game's own
  // `transition()`. The answering window here IS the candidates' fall to the
  // floor, so a wave left running behind a sheet expires against a child who
  // was never shown it. The clock stops dead instead.
  mounted.client.on("pause", () => {
    handle.setPaused(true)
  })
  mounted.client.on("resume", () => {
    handle.setPaused(false)
  })

  // The host tells a pack before its port dies, so the rAF loop and the audio
  // context are torn down before the frame is, rather than a frame or two
  // after it.
  mounted.client.on("dispose", () => {
    handle.unmount()
  })
}

void start(root).catch((error: unknown) => {
  console.error("[beam] could not start", error)
  renderNoHost(root, "LATTICE RUNNER")
})
