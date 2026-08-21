/** Standalone shell: `npm run dev` and play. The real host replaces this. */
import { mount } from "./index.ts"
import { createStubHost } from "./stubHost.ts"

const el = document.getElementById("app")
if (!el) throw new Error("horde: #app is missing")

let correct = 0
let asked = 0
const host = createStubHost({
  seed: 20260726,
  onReport(r) {
    asked++
    if (r.correct) correct++
    console.log(
      `[stub-host] ${r.questionId} ${r.correct ? "✓" : "✗"} answered=${r.answered} ` +
      `${Math.round(r.ms)} ms  —  ${correct}/${asked}`,
    )
  },
})

const handle = mount(el, host)

// Handy while iterating: window.__horde.unmount()
;(window as unknown as { __horde: unknown }).__horde = handle
