// THE LATTICE, as a Dynawalla pack.
//
// The seam and nothing else. `mount` is handed the real host in place of the
// stub, because the adapter presents the same synchronous surface `Host` in
// `contract.ts` already describes — so the arena, the sheet, the bank and the
// resonance rule are untouched.
//
// What crosses the boundary is the resonator. It carries a problem the
// curriculum drew, the host reveals its canonical value, and that value becomes
// the product the child has to assemble out of primes. The value reported back
// is the product of the primes they were holding when they flew into it — an
// exact integer the host can judge, and usually the child's own mal-rule rather
// than noise, because the field is seeded so one of the host's mal-rule answers
// is assemblable too.
//
// Cracking 72 into 8 and 9 and then into 2·2·2·3·3 is the game's own
// mathematics — a thing the child performs with a trigger rather than a
// question anybody asked — so nothing about the cracking is reported.
//
// `items.reveal` is declared and it is load-bearing: without the canonical
// value the adapter drops every item, and the pack mounts and warms and serves
// no questions at all, with nothing failing anywhere.

import { createGameHost, renderNoHost } from "../../../packs/shared/game-host/index.ts"
import { mount } from "./contract.ts"
import type { Host } from "./contract.ts"

const root = document.getElementById("app")
if (!root) throw new Error("lattice: #app missing")

async function start(el: HTMLElement): Promise<void> {
  const mounted = await createGameHost({ domain: "add" })
  // Stocked before the first frame: the arena arms a resonator the instant it
  // mounts, and a resonator with a blank face is the kind of thing that happens
  // exactly once, on launch, in front of the child.
  await mounted.warm()

  const handle = mount(el, mounted.host as unknown as Host)

  // The host tells a pack before its port dies, so the rAF loop and the audio
  // context come down before the frame does rather than a frame or two after.
  mounted.client.on("dispose", () => {
    handle.unmount()
  })

  // A transition can put a sheet over the frame, and the SDK documents that the
  // pack keeps running underneath it. THE LATTICE calls `transition` every time
  // a resonator opens, so this is routine rather than hypothetical — and
  // unguarded it is the worst bug this game could have: a thumb resting on a
  // virtual stick behind the sheet flies the ship on, sweeps motes nobody
  // chose, and can assert a product at a resonator the child never saw.
  //
  // These two handlers are the whole subscription. `handle.pause()` is inert
  // until something calls it.
  mounted.client.on("pause", () => {
    handle.pause()
  })
  mounted.client.on("resume", () => {
    handle.resume()
  })
}

void start(root).catch((error: unknown) => {
  console.error("[lattice] could not start", error)
  renderNoHost(root, "THE LATTICE")
})
