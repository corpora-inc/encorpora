// Standalone dev harness. `npm run dev` → a playable game wired to the local
// stub Host, with no runtime underneath it.
//
//   ?seed=123     pin the question stream
//   ?rung=5       pin the stub's rung 0..5 instead of letting it walk up
//   ?reduced=1    force the reduced-motion branch

import { mount } from "./contract.ts"
import { createStubHost } from "./stubHost.ts"

const el = document.getElementById("app")
if (!el) throw new Error("coil: #app missing")

const params = new URLSearchParams(location.search)
const seed = Number(params.get("seed") ?? "") || 0x0c011960
const rungParam = params.get("rung")
const rung = rungParam === null ? undefined : Number(rungParam)
const reduced = params.has("reduced") ? params.get("reduced") !== "0" : undefined

let answered = 0
let correct = 0
const readout = document.getElementById("readout")

const host = createStubHost({
  seed,
  ...(rung === undefined || Number.isNaN(rung) ? {} : { rung }),
  ...(reduced === undefined ? {} : { reducedMotion: reduced }),
  onReport(r) {
    answered++
    if (r.correct) correct++
    if (readout) {
      readout.textContent = `host.report → ${String(correct)}/${String(answered)} · last ${String(r.ms)}ms · "${r.answered}"`
    }
    console.info("[coil/host] report", r)
  },
})

const handle = mount(el, host)

// Vite HMR: tear the old instance down so audio contexts and rAF loops do not
// accumulate across edits.
type HotModule = { hot?: { dispose(cb: () => void): void } }
;(import.meta as unknown as HotModule).hot?.dispose(() => {
  handle.unmount()
})
