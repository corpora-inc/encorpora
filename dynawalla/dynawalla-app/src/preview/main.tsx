// The renderer bench's entry point. Development only — see `Preview.tsx`.
//
// `vite build` inputs `index.html` and nothing else, so nothing here is reached
// by the production graph and nothing here is in the shipped bundle. It is under
// `src/` so that `npm run tsc` and `npm run lint` cover it: an unchecked harness
// is a harness that goes stale without saying so.

import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import "../app/theme.ts"
import "../index.css"

import { Preview } from "./Preview.tsx"

const root = document.getElementById("root")
if (!root) throw new Error("missing #root")

createRoot(root).render(
  <StrictMode>
    <Preview />
  </StrictMode>,
)
