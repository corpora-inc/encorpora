// The standalone dev harness. `npm run dev`, and the whole match is playable
// with no runtime underneath it: the stub host in `stubHost.ts` deals the same
// column arithmetic the real one does.
//
// The readout along the bottom is dev-only and is not in `pack.html`. Inside a
// real host, the host draws the progress.

import { mount } from "./contract.ts"
import { createStubHost } from "./stubHost.ts"
import {
  MODE_IDS,
  modeById,
  pickSoundscape,
  setHostSoundscape,
} from "../../../packs/shared/game-soundscape/index.ts"

// ── The soundscape, in the harness only ─────────────────────────────────────
//
// The real app publishes one now (`dynawalla-app/src/app/soundscape.ts`), so
// inside the app the yard plays in whatever key the bazaar is in. This harness
// has no host at all, so it publishes its own before mount — which is where a
// specific soundscape can be pinned and heard on demand: a random mode and root
// each run, or a named one with
// `?mode=maqam.rast&root=146.8`, so a specific report ("hijaz sounds wrong on
// the thousands plate") is reproducible rather than a memory.
//
// `?mode=list` prints the corpus. `?soundscape=off` is the A/B — the same game
// with the fixed four pitches, for hearing what this replaces.
const params = new URLSearchParams(globalThis.location?.search ?? "")
if (params.get("mode") === "list") console.info("[counterweight] modes:", MODE_IDS.join(", "))
if (params.get("soundscape") !== "off") {
  const seed = Number(params.get("seed") ?? ((Date.now() ^ 0x5ca9e) >>> 0))
  const chosen = pickSoundscape(Number.isFinite(seed) ? seed : 1)
  const wanted = params.get("mode")
  const root = Number(params.get("root"))
  const scape = {
    ...chosen,
    ...(wanted && modeById(wanted) ? { modeId: wanted } : {}),
    ...(Number.isFinite(root) && root > 0 ? { rootHz: root } : {}),
  }
  setHostSoundscape(scape)
  console.info(
    `[counterweight] soundscape ${scape.modeId} on ${scape.rootHz.toFixed(2)} Hz, seed ${scape.seed}`,
  )
}

const root = document.getElementById("app")
if (!root) throw new Error("counterweight: #app missing")
const readout = document.getElementById("readout")

let asked = 0
let right = 0
let transitions = 0

const host = createStubHost({
  seed: (Date.now() ^ 0x9a11c7) >>> 0,
  onReport: (r) => {
    asked += 1
    if (r.correct) right += 1
    if (readout) {
      readout.textContent =
        `${right}/${asked} good · last ${r.answered} in ${r.ms} ms · ` +
        `${transitions} stopping point${transitions === 1 ? "" : "s"} · ` +
        `Q/A ±1000 · W/S ±100 · E/D ±10 · R/F ±1 · space = stamp`
    }
  },
  onTransition: () => {
    transitions += 1
  },
})

const handle = mount(root, host)

// The dev harness is the one place a pause can be exercised by hand: press `p`.
// It is the same call the host makes when it raises a sheet.
let sheeted = false
globalThis.addEventListener("keydown", (event) => {
  if (event.key.toLowerCase() !== "p") return
  sheeted = !sheeted
  if (sheeted) handle.pause()
  else handle.resume()
})
