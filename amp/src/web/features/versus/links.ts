/** The comparisons' route, as links name it: with `params={{ slug }}` a
 * comparison (`/versus/<slug>`). */
export const VERSUS = "/versus/{-$slug}" as const;

/** A link to the hub (`/versus`). It names no slug outright: from a
 * comparison, a link to the same route would otherwise keep that page's. */
export const versusHubLink = {
  to: VERSUS,
  params: { slug: undefined },
} as const;
