// The routes, and the chain that makes "no destination is empty" hold end to
// end.
//
// `shell/surfaces.test.ts` proves every destination has rows. That is only
// worth something if every route actually renders the surface model, so the
// second half of this file reads `router.tsx` as text and asserts it — the
// router is `.tsx`, Node's type stripper does not read JSX, and a source scan
// is the strongest link available in this runner. It is a real link: the way an
// empty screen came back would be somebody adding a route with a hand-written
// element, and that is exactly what this sees.

import { test } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { matchPath } from "react-router"

import { ROUTE_PATHS, DESTINATIONS, destinationPath, type RouteKey } from "./routes.ts"

const here = path.dirname(fileURLToPath(import.meta.url))
const routerSource = fs.readFileSync(path.join(here, "router.tsx"), "utf8")

test("the route table is exactly the five destinations the host ships", () => {
  // Routes are the app's URL contract with itself: deep links, the Android back
  // stack and every later guard are written against these strings. `/practice`
  // and `/world` are gone with the content behind them (ADR-0022) — a host that
  // ships no exercises has no practice route.
  assert.deepEqual(Object.values(ROUTE_PATHS).sort(), [
    "/",
    "/parents",
    "/profiles",
    "/progress",
    "/settings",
  ])
})

test("every destination is a route and every route is a destination", () => {
  for (const destination of DESTINATIONS) {
    assert.ok(destination in ROUTE_PATHS, `${destination} has no route`)
  }
  const offered = new Set<RouteKey>(DESTINATIONS)
  for (const key of Object.keys(ROUTE_PATHS) as RouteKey[]) {
    assert.ok(offered.has(key), `${key} is a route no navigation reaches`)
  }
  assert.equal(DESTINATIONS.length, 5)
})

test("hrefs are concrete, never a pattern", () => {
  // Linking to a path with a `:` in it navigates somewhere the router does not
  // match and renders nothing. It is one keystroke away and looks correct.
  for (const destination of DESTINATIONS) {
    const href = destinationPath(destination)
    assert.ok(href.startsWith("/"), `${destination} href is not absolute`)
    assert.ok(!href.includes(":"), `${destination} href leaks a route pattern`)
  }
})

test("the router this app ships actually matches the hrefs it generates", () => {
  // ADR-0005 specifies react-router v7; this app is on v8. Asserting the
  // strings would pass on a version whose matcher had changed underneath them,
  // so this asks the installed matcher — the same code the shell routes with.
  for (const destination of DESTINATIONS) {
    const href = destinationPath(destination)
    assert.ok(
      matchPath(ROUTE_PATHS[destination], href),
      `${ROUTE_PATHS[destination]} does not match its own href ${href}`,
    )
  }
  // The front door is a real route rather than a prefix of the others: without
  // `end` on its link, every tab in the navigation lights on every screen.
  assert.equal(matchPath(ROUTE_PATHS.packs, destinationPath("settings")), null)
})

test("every route renders the surface model — no route renders anything else", () => {
  // The empty recess came back into this app once already: a `Destination`
  // component that rendered a cut plate with nothing in it, wired to two routes
  // in the primary navigation, with a green suite. One element type for every
  // route is what makes `surfaces.test.ts` cover all five.
  const elements = [...routerSource.matchAll(/<([A-Z][A-Za-z]*)/g)].map((m) => m[1])
  assert.deepEqual(
    [...new Set(elements)].sort(),
    ["Shell", "Surface"],
    "a route renders something other than the shell and the surface model",
  )

  // …and the children are built from the destination list rather than written
  // out, so a destination cannot be added to the navigation with no route.
  assert.match(routerSource, /DESTINATIONS\.map/)
})

test("the empty-recess components are gone and stay gone", () => {
  // `screens/Destination.tsx` rendered a `Recess` — a cut plate with nothing
  // mounted in it — and was the element of two routes. Between them they are
  // the whole of how this app shipped two blank destinations while looking
  // deliberate about it, so both names are banned rather than just unused.
  const walk = (dir: string, out: string[] = []): string[] => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) walk(full, out)
      else out.push(full)
    }
    return out
  }
  const src = path.resolve(here, "..")
  const banned = new Set(["Destination.tsx", "Recess.tsx"])

  assert.deepEqual(
    walk(src)
      .filter((file) => banned.has(path.basename(file)))
      .map((file) => path.relative(src, file)),
    [],
  )
})
