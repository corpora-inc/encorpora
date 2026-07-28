// Standalone dev harness. `npm run dev` → a playable bout wired to the local
// stub Host, with no runtime underneath it.
//
//   ?seed=123     replay the same card
//   ?level=7      pin the ladder at a rung instead of walking it
//   ?reduced=1    force the reduced-motion branch

import { mount } from "./contract.ts"
import { createStubHost } from "./stubHost.ts"

const el = document.getElementById("app")
if (!el) throw new Error("foundry: #app missing")

const params = new URLSearchParams(location.search)
const seed = Number(params.get("seed") ?? "") || 0x6f057d
const level = params.has("level") ? Number(params.get("level")) : undefined
const reduced = params.has("reduced") ? params.get("reduced") !== "0" : undefined

let answered = 0
let correct = 0
const readout = document.getElementById("readout")

const host = createStubHost({
  seed,
  ...(level === undefined || Number.isNaN(level) ? {} : { level }),
  ...(reduced === undefined ? {} : { reducedMotion: reduced }),
  onReport(r) {
    answered++
    if (r.correct) correct++
    if (readout) {
      readout.textContent = `host.report → ${correct}/${answered} · last ${r.ms}ms · "${r.answered || "—"}"`
    }
    console.info("[foundry/host] report", r)
  },
})

const handle = mount(el, host)

// Vite HMR: tear the old instance down so audio contexts and rAF loops do not
// accumulate across edits.
type HotModule = { hot?: { dispose(cb: () => void): void } }
;(import.meta as unknown as HotModule).hot?.dispose(() => handle.unmount())
