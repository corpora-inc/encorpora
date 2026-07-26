import { Link } from "react-router"

import { Destination } from "./Destination.tsx"
import { IndexMark } from "../design/IndexMark.tsx"
import { destinationPath } from "../app/routes.ts"
import { strings } from "../app/strings.ts"
import { WorldScreen } from "../world/Screen.tsx"
import { worldStore } from "../world/live.ts"

/**
 * Everything the child has cut.
 *
 * No heading, no total, no encouragement to come back and cut more. An empty
 * plate at the start is honest — the stone is there and nothing is out of it
 * yet — and a screen with four courses in it does not need to be described.
 * The count is in the text alternative, where a number belongs.
 *
 * The one piece of copy is the way back. The band's rosette is a door out of
 * the work, and until now it opened onto a room with no door in it: the only
 * route back to practice was the wordmark, then the home list, then Practice —
 * two navigations, in a Tauri WebView with no browser chrome and no back
 * gesture on desktop. That is a trap, not a destination. It costs no new
 * string; `destinations.practice` is already the name of the place.
 */
export function WorldRoute() {
  const placed = worldStore((state) => state.placed)

  return (
    <Destination>
      <div className="flex flex-col gap-6">
        <WorldScreen placed={placed} className="mx-auto block h-auto w-full max-w-sm" />
        <Link
          to={destinationPath("practice")}
          className="group border-line hover:bg-ground-raised -mx-2 flex min-h-16 items-center gap-3 border-t px-2 transition-colors duration-[var(--dw-motion-quick)]"
        >
          <IndexMark className="text-index opacity-0 transition-opacity duration-[var(--dw-motion-quick)] group-hover:opacity-100 group-focus-visible:opacity-100" />
          <span className="inscription text-xl tracking-wide">
            {strings.destinations.practice}
          </span>
        </Link>
      </div>
    </Destination>
  )
}
