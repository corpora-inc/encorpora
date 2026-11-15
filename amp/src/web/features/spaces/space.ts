/**
 * The spaces of AMP (docs/architecture/spaces.md). A space is presentation,
 * never permission: it decides the frame, the navigation, the words and the
 * composition of a screen. The server authorizes every request exactly as it
 * would without it.
 */
export const SPACES = [
  "family",
  "classroom",
  "school",
  "me",
  "student",
  "public",
  "account",
] as const;
export type Space = (typeof SPACES)[number];

/**
 * A route's static `space` (its `staticData`). A classroom or school route
 * resolves to `family` when the org it names is a family's; `learner` marks
 * the shared learner screens, whose space is the chosen learner's: the
 * adult's own (or a practice profile) is `me`, a child is `family`.
 */
export type RouteSpace = Space | "learner";

declare module "@tanstack/react-router" {
  interface StaticDataRouteOption {
    /** Which space the route's screens belong to (features/spaces). */
    space?: RouteSpace;
    /** A detail over a list: it carries the list's view (router.tsx). */
    overList?: boolean;
  }
}

const under = (pathname: string, path: string) =>
  pathname === path || pathname.startsWith(`${path}/`);

/** School-level addresses that are not one school: setup and invitations. */
const SCHOOL_STEPS = ["new", "invite", "start", "connect", "adopt"];

/**
 * The space of a path, for the legacy catch-all (`/$`) and any route that
 * declares none. Typed routes declare theirs as `staticData.space`; a test
 * holds the two in agreement.
 */
export function spaceOfPath(pathname: string): RouteSpace {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  const school = /^\/school\/([^/]+)(\/classes\/[^/]+)?/.exec(path);
  if (school)
    return school[1] === "invite"
      ? "public"
      : SCHOOL_STEPS.includes(school[1]!)
        ? "account"
        : school[2]
          ? "classroom"
          : "school";
  if (path === "/school") return "account";
  // Links that carry their own authority (an invitation, a buyer's link, a
  // parent's approval): a dedicated entry, never an ambient workspace.
  if (
    ["/family/approve", "/family/approvals", "/schools/continue"].some((root) =>
      under(path, root),
    )
  )
    return "public";
  if (under(path, "/me")) return "me";
  // A family's own screens, by its id (`/family/<family>/…`).
  if (
    /^\/family\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(\/|$)/i.test(
      path,
    )
  )
    return "family";
  if (["/join", "/c", "/standings"].some((root) => under(path, root)))
    return "student";
  if (
    [
      "/schools",
      "/sign-in",
      "/sign-up",
      "/reset-password",
      "/p",
      "/design",
      "/dev",
      "/try",
    ].some((root) => under(path, root))
  )
    return "public";
  if (
    [
      "/overview",
      "/practice",
      "/progress",
      "/pathways",
      "/inventory",
      "/lessons",
      "/books",
      "/learners",
      "/profile",
      "/continue",
    ].some((root) => under(path, root)) ||
    path === "/"
  )
    return "learner";
  return "account";
}
