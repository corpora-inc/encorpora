/**
 * The router's table as browser checks read it (`window.ampRouteTable`,
 * development only, app/router.tsx), and how a route's pattern becomes a
 * real address for one person: the ids already known, else an address their
 * own screens link to. Shared by the navigation crawl
 * (scripts/verify-layer-crawl-ui.ts) and the no-flash guard
 * (scripts/verify-no-flash-ui.ts).
 */

/** A route of the table: its pattern, and whether it draws a screen. */
export type Route = { path: string; page: boolean };

export const trim = (path: string) =>
  path.length > 1 ? path.replace(/\/+$/, "") : path;

/** A pattern (`/school/$org/classes/$class`) as a regular expression. */
export const paramPattern = (path: string) =>
  new RegExp(
    `^${trim(path)
      .replace(/[()*+.?[\\\]^{|}]/g, "\\$&")
      .replace(/\/\$$/, "/(.+)")
      .replace(/\$[A-Za-z]+/g, "([^/]+)")}$`,
  );

/** The route's address with what is known filled in, or null. A catch-all
 * (`splats`) opens at the segment given for it. */
export function fill(
  route: Route,
  known: Record<string, string>,
  seen: Iterable<string>,
  splats: Record<string, string> = {},
) {
  const path = trim(route.path);
  if (splats[route.path] !== undefined) {
    const filled = path
      .replace(/\$org/, known.org ?? "$org")
      .replace(/\$class/, known.class ?? "$class")
      .replace(/\/\$$/, `/${splats[route.path]}`);
    return filled.includes("$") ? null : filled;
  }
  const filled = path.replace(/\$([A-Za-z]+)/g, (whole, name: string) =>
    name in known ? known[name]! : whole,
  );
  if (!filled.includes("$")) return filled;
  // An id only the person's own screens know: an address they link to.
  const pattern = paramPattern(filled);
  for (const href of seen) {
    const at = href.split("?")[0]!;
    if (pattern.test(at)) return at;
  }
  return null;
}
