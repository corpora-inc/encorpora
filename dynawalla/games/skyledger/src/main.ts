// Standalone dev harness. `npm run dev` → a playable observatory wired to the
// local stub Host, with no runtime underneath it.
//
// `?reduced=1` forces the reduced-motion branch on, `?reduced=0` forces it off,
// and `?seed=` replays a watch exactly.

import { mount } from "./contract.ts"
import { createStubHost } from "./stubHost.ts"

const el = document.getElementById("app")
if (!el) throw new Error("skyledger: #app missing")

const params = new URLSearchParams(location.search)
const seed = Number(params.get("seed") ?? "") || 0x5c91ed
const reduced = params.has("reduced") ? params.get("reduced") !== "0" : undefined

let answered = 0
let correct = 0
const readout = document.getElementById("readout")

const host = createStubHost({
  seed,
  ...(reduced === undefined ? {} : { reducedMotion: reduced }),
  onReport(r) {
    answered++
    if (r.correct) correct++
    if (readout) {
      readout.textContent = `host.report → ${correct}/${answered} · last ${Math.round(r.ms)}ms · "${r.answered || "—"}"`
    }
    console.info("[skyledger/host] report", r)
  },
  onTransition(kind, label) {
    console.info("[skyledger/host] transition", kind, label)
  },
})

const handle = mount(el, host)

// The harness stands in for the host's sheet: `p` raises one, `r` takes it away,
// so the pause path can be exercised without a runtime.
globalThis.addEventListener("keydown", (e) => {
  if (e.key === "p") handle.pause()
  if (e.key === "r") handle.resume()
})

// Vite HMR: tear the old instance down so audio contexts and rAF loops do not
// accumulate across edits.
type HotModule = { hot?: { dispose(cb: () => void): void } }
;(import.meta as unknown as HotModule).hot?.dispose(() => handle.unmount())
