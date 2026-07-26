import type { ReactNode } from "react"

/**
 * A recess cut into the ground: the mounting surface everything else seats
 * into. Depth is a dark cut line along the top and a lit edge along the
 * bottom — the way a groove in stone reads. Never a drop shadow.
 *
 * An empty one is honest: the plate is cut, the instrument is not mounted yet.
 */
export function Recess({ children }: { children?: ReactNode }) {
  return (
    <div className="rounded-cut-md border-t border-b border-t-line-cut border-b-line bg-ground-sunk min-h-40 p-5">
      {children}
    </div>
  )
}
