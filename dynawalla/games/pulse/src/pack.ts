// PULSE, as a Dynawalla pack.
//
// The seam and nothing else. `mount` is handed the real host in place of the
// stub, because the adapter presents the same synchronous surface the `Host`
// type in `contract.ts` already describes — so the chart generator, the
// judge, the stage governor and the audio scheduler are untouched.
//
// What crosses the boundary is a bar. A question's answer is a fraction, and
// in PULSE a fraction IS a position inside one bar, so the gate places the
// canonical value and the mal-rule distractors along the bar and the child
// answers by striking at the right *time*. The game never decides whether a
// strike was right in the curriculum's sense: it reports the value it was
// aimed at, and `items.answer` is the judge.
//
// `gate.ts` already handles a host whose answer is not a fraction in (0, 1] —
// it falls back to labelled targets rather than positions — so a host serving
// whole-number arithmetic degrades to a playable game rather than a broken one.

import { createGameHost, renderNoHost } from "../../../packs/shared/game-host/index.ts"
import { mount } from "./mount.ts"
import type { Host } from "./contract.ts"

const root = document.getElementById("app")
if (!root) throw new Error("pulse: #app missing")

async function start(el: HTMLElement): Promise<void> {
  const mounted = await createGameHost({ domain: "fractions" })
  // Stocked before the first frame: the first bar is charted the moment the
  // run starts, and a bar with no numbers on it is the kind of thing that
  // happens exactly once, on launch, in front of the child.
  await mounted.warm()

  const handle = mount(el, mounted.host as unknown as Host)

  // The host tells a pack before its port dies, so the rAF loop and the audio
  // context are torn down before the frame is, rather than a frame or two
  // after it.
  mounted.client.on("dispose", () => {
    handle.unmount()
  })
}

void start(root).catch((error: unknown) => {
  console.error("[pulse] could not start", error)
  renderNoHost(root, "PULSE")
})
