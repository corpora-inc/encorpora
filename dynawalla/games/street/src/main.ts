// Standalone dev harness. `npm run dev` → a playable game wired to the local
// stub Host, with no runtime underneath it.
//
// `?pause=1` puts a sheet over the frame for two seconds every time the game
// reports a stopping point, which is exactly what a real host does after a
// `transition`. It is here because that is the state the pause guards exist
// for, and a guard nobody can see working is a guard nobody trusts.

import { mount } from "./contract.ts"
import { createStubHost } from "./stubHost.ts"

const el = document.getElementById("app")
if (!el) throw new Error("street: #app missing")

const params = new URLSearchParams(location.search)
const seed = Number(params.get("seed") ?? "") || 0x57ee7
const reduced = params.has("reduced") ? params.get("reduced") !== "0" : undefined
const sheet = params.get("pause") === "1"

let answered = 0
let correct = 0
const readout = document.getElementById("readout")

let handle: { unmount(): void; pause(): void; resume(): void } | null = null

const host = createStubHost({
  seed,
  ...(reduced === undefined ? {} : { reducedMotion: reduced }),
  onReport(r) {
    answered++
    if (r.correct) correct++
    if (readout) {
      readout.textContent = `host.report → ${correct}/${answered} · last ${r.ms}ms · "${r.answered || "—"}"`
    }
    console.info("[street/host] report", r)
  },
  onTransition(kind, l) {
    console.info("[street/host] transition", kind, l ?? "")
    if (!sheet || !handle) return
    handle.pause()
    globalThis.setTimeout(() => handle?.resume(), 2000)
  },
})

handle = mount(el, host)

// Vite HMR: tear the old instance down so audio contexts and rAF loops do not
// accumulate across edits.
type HotModule = { hot?: { dispose(cb: () => void): void } }
;(import.meta as unknown as HotModule).hot?.dispose(() => handle?.unmount())
