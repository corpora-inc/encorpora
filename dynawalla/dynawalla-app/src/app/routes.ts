// The route table as data.
//
// ADR-0005 fixes the six routes and the hash router. Keeping the paths in a
// plain module rather than only inside JSX means the navigation, the router
// and the tests all read the same list — there is no second place to forget a
// route — and it stays importable from a Node test with no DOM.

export const ROUTE_PATHS = {
  home: "/",
  /** `:skillId?` is optional: /practice resumes, /practice/<id> drills one skill. */
  practice: "/practice/:skillId?",
  world: "/world",
  progress: "/progress",
  settings: "/settings",
  profiles: "/profiles",
} as const

export type RouteKey = keyof typeof ROUTE_PATHS

/** The destinations the shell offers, in the order they are presented. */
export const DESTINATIONS = ["practice", "world", "progress", "profiles", "settings"] as const

export type Destination = (typeof DESTINATIONS)[number]

/** A concrete href for a destination — never the pattern, which has a `:` in it. */
export function destinationPath(destination: Destination): string {
  if (destination === "practice") return "/practice"
  return ROUTE_PATHS[destination]
}

/** The href for one skill's practice session. */
export function practicePath(skillId: string): string {
  return `/practice/${encodeURIComponent(skillId)}`
}
