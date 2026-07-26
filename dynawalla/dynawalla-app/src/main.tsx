import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { RouterProvider } from "react-router"

// Imported first, and for their side effects: the theme and the accessibility
// settings are applied at module load (ADR-0005), before React renders
// anything, so there is no flash of the wrong materials on a dark tablet and no
// jump from default type to the size a child actually reads at.
import "./app/theme.ts"
import "./settings/store.ts"
import "./index.css"

import { router } from "./app/router.tsx"
import { useLibrary } from "./packs/libraryStore.ts"
import { startAutoplay } from "./packs/devPlay.ts"

// What is on disk, read once, before the first paint asks for it. The front
// door is the pack list, so an empty first frame is the whole app looking
// broken; this is fired here rather than in an effect so the read is already in
// flight while React is still mounting.
void useLibrary.getState().refresh()

// Developer-only, and compiled out when the variable is unset. See devPlay.ts.
startAutoplay()

const root = document.getElementById("root")
if (!root) throw new Error("missing #root")

createRoot(root).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
