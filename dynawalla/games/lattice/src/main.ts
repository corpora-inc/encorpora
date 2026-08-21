// The dev harness. `npm run dev` serves `index.html`, which loads this: the
// game mounted against the local stub host, with a running readout of what has
// been reported so the seam is visible without a runtime underneath it.
//
// Nothing in here ships. The pack entry is `pack.ts`.

import { mount } from "./contract.ts"
import { createStubHost } from "./stubHost.ts"

const root = document.getElementById("app")
const readout = document.getElementById("readout")
if (!root) throw new Error("lattice: #app missing")

let asked = 0
let right = 0

const host = createStubHost({
  seed: 0x1a771ce,
  onReport: (r) => {
    asked += 1
    if (r.correct) right += 1
    if (readout) readout.textContent = `host.report → ${right}/${asked}  last "${r.answered}" ${r.ms}ms`
  },
  onTransition: (kind, label) => {
    console.info("[lattice] transition", kind, label ?? "")
  },
})

const handle = mount(root, host)

// The harness stands in for the host's sheet, so the pause path is exercised
// during development rather than first seen on a tablet: `P` raises it.
let paused = false
globalThis.addEventListener("keydown", (event) => {
  if (event.key !== "p" && event.key !== "P") return
  paused = !paused
  if (paused) handle.pause()
  else handle.resume()
})
