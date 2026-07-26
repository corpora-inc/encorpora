import type { ReactNode } from "react"

import { Recess } from "../design/Recess.tsx"

/**
 * A destination's frame: the cut plate its surface will seat into.
 *
 * The lintel already names where you are, so the frame adds no heading of its
 * own and no copy about what is or is not built yet. An empty recess says it.
 */
export function Destination({ children }: { children?: ReactNode }) {
  return <Recess>{children}</Recess>
}
