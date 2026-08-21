import { NavLink } from "react-router"

import { IndexMark } from "../design/IndexMark.tsx"
import { Strapwork } from "../design/Strapwork.tsx"
import { DESTINATIONS, destinationPath, ROUTE_PATHS } from "./routes.ts"
import { strings } from "./strings.ts"

/**
 * The five destinations, always present, along the bottom edge.
 *
 * It is at the bottom because it is the only navigation in the app and a child
 * holds a tablet by its lower half. Before this, the way back from anywhere was
 * to notice that the wordmark was a link — two navigations to reach a sibling
 * screen, in a WebView with no browser chrome and no back gesture on desktop.
 *
 * Not a hamburger, not a drawer, and nothing that opens: every destination is
 * on screen at all times, so where you can go is never a thing you have to
 * discover. Five is the number the shell has, and it fits: at 320 px each tab
 * is 64 px wide, and the whole bar is one row of inscribed words with a brass
 * index over the one you are on.
 *
 * `aria-current="page"` comes from `NavLink` itself, so the state is in the
 * markup as well as in the mark — the current destination is never carried by
 * the index alone.
 */
export function Nav() {
  return (
    <nav className="bg-ground-raised sticky bottom-0">
      <Strapwork />
      <ul className="flex pb-[var(--safe-bottom)]">
        {DESTINATIONS.map((destination) => (
          <li key={destination} className="min-w-0 flex-1">
            <NavLink
              to={destinationPath(destination)}
              // The front door is `/`, which prefix-matches every other route:
              // without `end` every tab would light at once, on every screen.
              end={ROUTE_PATHS[destination] === "/"}
              className={({ isActive }) =>
                [
                  "flex min-h-14 flex-col items-center justify-center gap-1 px-1 py-2",
                  "transition-colors duration-[var(--dw-motion-quick)]",
                  isActive ? "text-ink" : "text-ink-muted",
                ].join(" ")
              }
            >
              {({ isActive }) => (
                <>
                  <IndexMark
                    className={isActive ? "text-index" : "text-index opacity-0"}
                  />
                  <span className="inscription w-full truncate text-center text-xs tracking-wide">
                    {strings.destinations[destination]}
                  </span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
