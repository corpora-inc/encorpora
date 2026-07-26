import { Link } from "react-router"

import { IndexMark } from "../design/IndexMark.tsx"
import { DESTINATIONS, destinationPath } from "../app/routes.ts"
import { strings } from "../app/strings.ts"

/**
 * The front door. Five ways in, cut as engraved entries on the ground rather
 * than laid out as cards: hairline rules between them, no boxes, no shadows.
 * The index slides to whichever entry the finger or the keyboard is on.
 */
export function Home() {
  return (
    <nav>
      <ul className="border-line border-t">
        {DESTINATIONS.map((destination) => (
          <li key={destination} className="border-line border-b">
            <Link
              to={destinationPath(destination)}
              className="group hover:bg-ground-sunk flex min-h-16 items-center gap-3 py-4 transition-colors duration-[var(--dw-motion-quick)]"
            >
              <IndexMark className="text-index opacity-0 transition-opacity duration-[var(--dw-motion-quick)] group-hover:opacity-100 group-focus-visible:opacity-100" />
              <span className="inscription text-2xl tracking-wide">
                {strings.destinations[destination]}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
