// The capture harness for the pass sheet. Dev only; never bundled into the app.
//
// **Why this exists.** `PassSheet` is mounted by `packs/Stage.tsx`, and the
// stage only mounts it when `usePass.mayOpen()` is false. That decision runs
// through `pass/model.ts`, which opens unconditionally while `billing().wired`
// is false — and nothing in the shipped app ever calls `setBilling`. So in a
// browser, and in fact in today's build on a device, there is no sequence of
// taps that puts the sheet on screen. It is real code, it is reachable the
// moment a store is wired, and it is three screens nobody can currently look
// at.
//
// Rather than fake app state — which would mean guessing at the shape of a
// store and capturing a screen that does not exist — this mounts the real
// component, with the real stylesheet, inside the same full-bleed deep ground
// the stage draws behind it (`Stage.tsx`: `bg-ground-deep fixed inset-0`). What
// is captured is the component, honestly, in its own frame.
//
// The one thing it cannot reproduce is the paused game showing through the
// panel's `backdrop-blur-sm`. Behind the sheet here is flat ground. Every other
// pixel is the shipped one.

import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

// Side-effect imports, in the order `src/main.tsx` has them: the theme class
// and the text-size attribute are applied at module load, before the first
// paint, and a harness that imported them later would capture the default
// theme for one frame and the requested one after.
import "../../src/app/theme.ts"
import "../../src/settings/store.ts"
import "./harness.css"

import { PassSheet } from "../../src/pass/PassSheet.tsx"

const root = document.getElementById("root")
if (!root) throw new Error("missing #root")

createRoot(root).render(
  <StrictMode>
    <div className="bg-ground-deep fixed inset-0">
      <PassSheet packName="LATTICE RUNNER" onLeave={() => undefined} />
    </div>
  </StrictMode>,
)
