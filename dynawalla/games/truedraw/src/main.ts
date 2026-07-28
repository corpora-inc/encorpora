// Standalone dev harness. `npm run dev` → a playable game wired to the local
// stub Host, with no runtime underneath it.

import { mount } from "./contract.ts"
import { createStubHost } from "./stub/host.ts"

const el = document.getElementById("app")
if (!el) throw new Error("truedraw: #app missing")

const params = new URLSearchParams(location.search)
const seed = Number(params.get("seed") ?? "") || 0x7a1e5
const level = Number(params.get("level") ?? "")
const reduced = params.has("reduced") ? params.get("reduced") !== "0" : undefined

let answered = 0
let correct = 0
const readout = document.getElementById("readout")

const host = createStubHost({
  seed,
  ...(Number.isFinite(level) && params.has("level") ? { level } : {}),
  ...(reduced === undefined ? {} : { reducedMotion: reduced }),
  onReport(r) {
    answered++
    if (r.correct) correct++
    if (readout) {
      readout.textContent = `host.report → ${String(correct)}/${String(answered)} · last ${String(r.ms)}ms · "${r.answered || "—"}"`
    }
  },
})

const handle = mount(el, host)

// Vite HMR: tear the old instance down so audio contexts and rAF loops do not
// accumulate across edits.
type HotModule = { hot?: { dispose(cb: () => void): void } }
;(import.meta as unknown as HotModule).hot?.dispose(() => {
  handle.unmount()
})
