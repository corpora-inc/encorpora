// The route table as data.
//
// Five destinations, no sixth, and no route that is not a destination. The
// paths live in a plain module rather than only inside JSX so the navigation,
// the router and the tests all read the same list — there is no second place to
// forget a route — and it stays importable from a Node test with no DOM.
//
// `/practice` and `/world` are gone with the content that used to live behind
// them (ADR-0022). The host ships no exercises, so it has no practice route.
// What the child built is the *progress* surface: host-owned state, written by
// packs through the boundary in `src/packs/`.
//
// **Packs is the front door.** It is `/` rather than a path under it, because
// the app is its packs: a lobby in front of them would be one more navigation
// step and one more screen with nothing on it.

export const ROUTE_PATHS = {
  packs: "/",
  progress: "/progress",
  profiles: "/profiles",
  settings: "/settings",
  parents: "/parents",
} as const

export type RouteKey = keyof typeof ROUTE_PATHS

export type Destination = RouteKey

/**
 * The destinations the navigation offers, in the order they are presented.
 *
 * Derived from the route table rather than written beside it: a destination
 * with no route, or a route no navigation reaches, is how a screen ends up
 * unreachable with every test still green.
 */
export const DESTINATIONS = Object.keys(ROUTE_PATHS) as readonly Destination[]

/**
 * A concrete href for a destination — never a pattern.
 *
 * No route carries a parameter today, and this throws rather than guessing if
 * one ever does: linking to a path with a `:` in it navigates somewhere the
 * router does not match and renders nothing, which looks correct in review.
 */
export function destinationPath(destination: Destination): string {
  const pattern = ROUTE_PATHS[destination]
  if (pattern.includes(":")) throw new RangeError(`${pattern} has a parameter and no bare href`)
  return pattern
}
