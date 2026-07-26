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

/**
 * The literal prefix of a route pattern: everything up to its first dynamic
 * segment.
 *
 * Derived, never written down a second time. A hardcoded `"/practice"` here
 * would survive a rename of the pattern above and leave the primary link
 * pointing at a route that no longer exists — green tests, dead front door.
 *
 * Only an *optional* segment may be dropped: a pattern with a required
 * parameter has no bare href at all, and silently returning its prefix would
 * hand back a path the router does not match.
 */
function literalPrefix(pattern: string): string {
  const kept: string[] = []
  for (const segment of pattern.split("/")) {
    if (!segment.startsWith(":")) {
      kept.push(segment)
      continue
    }
    if (!segment.endsWith("?")) {
      throw new RangeError(`${pattern} has a required parameter and no bare href`)
    }
    break
  }
  return kept.join("/") || "/"
}

/** A concrete href for a destination — never the pattern, which has a `:` in it. */
export function destinationPath(destination: Destination): string {
  return literalPrefix(ROUTE_PATHS[destination])
}

/** The href for one skill's practice session. */
export function practicePath(skillId: string): string {
  const base = literalPrefix(ROUTE_PATHS.practice)
  return `${base === "/" ? "" : base}/${encodeURIComponent(skillId)}`
}
