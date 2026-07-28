// Standalone dev harness. `npm run dev` → a playable game wired to the local
// stub Host, with no runtime underneath it.
//
//   ?seed=123        pin the run
//   ?reduced         force the reduced-motion branch (`?reduced=0` forces off)
//   ?difficulty=0.8  pin the ladder instead of sweeping it
//   ?pause           bind `p` to the host's pause/resume, so the sheet the real
//                    host raises can be rehearsed here

import { mount } from "./contract.ts"
import { createStubHost } from "./stubHost.ts"

const el = document.getElementById("app")
if (!el) throw new Error("colossus: #app missing")

const params = new URLSearchParams(location.search)
const seed = Number(params.get("seed") ?? "") || 0x5eed1ce
const reduced = params.has("reduced") ? params.get("reduced") !== "0" : undefined
const pinned = params.has("difficulty") ? Number(params.get("difficulty")) : undefined

let answered = 0
let correct = 0
const readout = document.getElementById("readout")

const host = createStubHost({
  seed,
  ...(reduced === undefined ? {} : { reducedMotion: reduced }),
  ...(pinned === undefined || Number.isNaN(pinned) ? {} : { difficulty: pinned }),
  onReport(r) {
    answered++
    if (r.correct) correct++
    if (readout) {
      readout.textContent = `host.report → ${correct}/${answered} · last ${Math.round(r.ms)}ms · "${r.answered || "—"}"`
    }
    console.info("[colossus/host] report", r)
  },
  onTransition(kind, label) {
    console.info("[colossus/host] transition", kind, label)
  },
})

const handle = mount(el, host)

// The real host raises a sheet and sends `pause` with the pack still mounted.
// Rehearse it here rather than discovering it on a tablet.
let held = false
globalThis.addEventListener("keydown", (event) => {
  if (event.key !== "p" && event.key !== "P") return
  held = !held
  if (held) handle.pause()
  else handle.resume()
  if (readout) readout.textContent = held ? "host → pause" : "host → resume"
})

// Vite HMR: tear the old instance down so audio contexts and rAF loops do not
// accumulate across edits.
type HotModule = { hot?: { dispose(cb: () => void): void } }
;(import.meta as unknown as HotModule).hot?.dispose(() => handle.unmount())
