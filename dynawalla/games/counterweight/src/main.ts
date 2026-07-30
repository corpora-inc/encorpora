// The standalone dev harness. `npm run dev`, and the whole match is playable
// with no runtime underneath it: the stub host in `stubHost.ts` deals the same
// column arithmetic the real one does.
//
// The readout along the bottom is dev-only and is not in `pack.html`. Inside a
// real host, the host draws the progress.

import { mount } from "./contract.ts"
import { createStubHost } from "./stubHost.ts"

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
