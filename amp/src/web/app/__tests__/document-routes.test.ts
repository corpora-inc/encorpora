/**
 * Every screen the router has is a document the server serves. The static
 * server (docker/nginx.conf) answers an address with the app only when it
 * matches app/document-routes.ts; anything else is the 404 page. A route
 * added to the router and not to that list works when clicked to and breaks
 * on refresh, on a shared link and on the return from Stripe (the pay
 * overlays did, 2026-11-17). This reads the real router's route table, so a
 * new route is covered without anyone editing this test. `npm run build`
 * runs it (`check:document-routes`), so CI fails on a route not served.
 */
import { expect, test } from "vitest";
import { knownDocumentPath } from "../document-routes";
import { router } from "../router";
import { loadVersusPage, versusCatalog } from "../../../versus/pages";

type Entry = { fullPath: string; isRoot?: boolean };

/** Routes that are not documents of their own, each with its reason. */
const NOT_DOCUMENTS: Record<string, string> = {
  // The development-only persona screen (router.tsx: import.meta.env.DEV)
  // is never in a production build.
  "/dev/personas": "development only",
};

/** An address for a route: each `$param` filled with a plausible id. A
 * `$step` takes a value every step-taking route accepts (sign-in's steps
 * are a closed list). A splat (`/$`) is a missing-screen catch-all, which
 * the server must not serve for every suffix, so it has no example. */
const example = (path: string) =>
  path
    .replace(/\$step\b/g, "forgot")
    .replace(/\$[A-Za-z][A-Za-z0-9]*/g, "a1b2c3");

const routes = [
  ...new Set(
    (Object.values(router.routesById) as unknown as Entry[])
      .filter((route) => !route.isRoot)
      .map((route) => route.fullPath),
  ),
].sort();

test("the route table is read whole", () => {
  // Guards the reading itself: an empty table would pass everything.
  expect(routes.length).toBeGreaterThan(100);
  expect(routes).toContain("/family/$family/kids/$learner/pay");
});

test("every router route has a document-route pattern (no 404 on refresh)", () => {
  const unserved = routes
    .filter((path) => !path.endsWith("/$") && !(path in NOT_DOCUMENTS))
    .filter((path) => !knownDocumentPath(example(path)));
  expect(
    unserved,
    "Add a pattern for each to src/web/app/document-routes.ts",
  ).toEqual([]);
});

test("the pay overlays are served at every host, with and without a trailing slash", () => {
  for (const base of [
    "/family/f1/kids/k1/pay",
    "/family/f1/pay/k1",
    "/family/f1/settings/pay/k1",
    "/account/pay/k1",
  ])
    for (const path of [base, `${base}/done`, `${base}/invoice/i1`])
      for (const address of [path, `${path}/`])
        expect(knownDocumentPath(address), address).toBe(true);
  // Still closed: an unknown shape under a pay overlay is a 404.
  for (const path of [
    "/family/f1/kids/k1/pay/elsewhere",
    "/family/f1/pay/k1/done/more",
    "/family/f1/pay",
  ])
    expect(knownDocumentPath(path), path).toBe(false);
});

test("the comparisons are served: the hub and one page each, nothing deeper", () => {
  for (const path of [
    "/versus",
    "/versus/",
    "/versus/i-ready",
    "/versus/i-ready/",
  ])
    expect(knownDocumentPath(path), path).toBe(true);
  // One route serves both: the hub, and a comparison by its slug.
  expect(routes).toContain("/versus/{-$slug}");
  for (const path of ["/versus/i-ready/more", "/versusx", "/versus//"])
    expect(knownDocumentPath(path), path).toBe(false);
});

test("every comparison the hub lists opens in the app, and nothing else does", async () => {
  // The app loads a comparison's file by its slug (src/versus/pages.ts); the
  // build writes a document for each one in the catalog.
  expect(versusCatalog.length).toBeGreaterThan(0);
  for (const entry of versusCatalog) {
    const page = await loadVersusPage(entry.slug);
    expect(page?.slug, entry.slug).toBe(entry.slug);
    expect(page?.name, entry.slug).toBe(entry.name);
  }
  for (const slug of ["no-such-program", "../catalog", ""])
    expect(await loadVersusPage(slug), slug).toBeUndefined();
});

test("a listed exception is still a route, so the list can't go stale", () => {
  for (const path of Object.keys(NOT_DOCUMENTS))
    expect(routes, path).toContain(path);
});
