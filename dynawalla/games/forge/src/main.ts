// Standalone playtest entry. Not shipped: the app calls `mount` directly with
// the real host. This file exists so `npm run dev` is a real game, today.

import { makeStubHost } from "./stub/host.ts"
import { mount } from "./mount.ts"

const el = document.getElementById("app")
if (!el) throw new Error("#app missing")

// A screen-reader mirror of the state the canvas draws. Canvas is the right
// tool for this game, but it is opaque to assistive technology, so the numbers
// that matter are announced here — politely, so a ticking counter never
// interrupts anything.
const live = document.createElement("div")
live.setAttribute("role", "status")
live.setAttribute("aria-live", "polite")
live.style.cssText =
  "position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap"
document.body.appendChild(live)

const host = makeStubHost({
  seed: 0x1f0e2d,
  onReport(r) {
    live.textContent = r.correct ? `correct, ${r.answered}` : `not ${r.answered}`
  },
})

const app = mount(el, host)

// Vite HMR: tear the game down cleanly so a save is written and no second
// requestAnimationFrame loop survives the reload.
if (import.meta.hot) {
  import.meta.hot.dispose(() => app.unmount())
}
