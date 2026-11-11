import type { defineSchoolRoute } from "./routes.js";
import { readClassStanding, readOrgStanding } from "./standing-reads.js";

/** Where students stand, as curves: a school's or district's, then one class's
 * students. Read by whoever reads the overview. */
export function defineStandingRoutes(define: typeof defineSchoolRoute) {
  define({
    method: "GET",
    url: "/api/v1/school/orgs/:org/standing",
    action: "overview.read",
    target: ({ params }) => ({ kind: "org", orgId: params.org! }) as const,
    handler: ({ target, pool, services }) =>
      readOrgStanding(pool, target.orgId, services.now?.()),
  });
  define({
    method: "GET",
    url: "/api/v1/school/classes/:class/standing",
    action: "overview.read",
    target: ({ params }) =>
      ({ kind: "class", classId: params.class! }) as const,
    handler: ({ target, pool, services }) =>
      readClassStanding(pool, target.classId, services.now?.()),
  });
}
