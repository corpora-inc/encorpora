import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { RouterProvider } from "react-router"

// Imported first, and for its side effect: the theme is applied at module load
// (ADR-0005), before React renders anything, so there is no flash of the wrong
// materials on a dark tablet.
import "./app/theme.ts"
import "./index.css"

import { router } from "./app/router.tsx"

const root = document.getElementById("root")
if (!root) throw new Error("missing #root")

createRoot(root).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
