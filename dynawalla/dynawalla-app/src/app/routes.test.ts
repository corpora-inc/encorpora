import { test } from "node:test"
import assert from "node:assert/strict"
import { matchPath } from "react-router"

import {
  ROUTE_PATHS,
  DESTINATIONS,
  destinationPath,
  practicePath,
  type RouteKey,
} from "./routes.ts"

test("the route table is exactly the one ADR-0005 fixes", () => {
  // Routes are the app's URL contract with itself: deep links, the Android
  // back stack and every later guard are written against these strings.
  assert.deepEqual(Object.values(ROUTE_PATHS).sort(), [
    "/",
    "/practice/:skillId?",
    "/profiles",
    "/progress",
    "/settings",
    "/world",
  ])
})

test("every destination is a route, and every route but home is reachable", () => {
  for (const destination of DESTINATIONS) {
    assert.ok(destination in ROUTE_PATHS, `${destination} has no route`)
  }
  const reachable = new Set<RouteKey>(["home", ...DESTINATIONS])
  for (const key of Object.keys(ROUTE_PATHS) as RouteKey[]) {
    assert.ok(reachable.has(key), `${key} is a route no navigation reaches`)
  }
})

test("hrefs are concrete, never the pattern", () => {
  // Linking to "/practice/:skillId?" navigates to a literal path containing a
  // colon and renders nothing. It is one keystroke away and looks correct.
  for (const destination of DESTINATIONS) {
    const href = destinationPath(destination)
    assert.ok(href.startsWith("/"), `${destination} href is not absolute`)
    assert.ok(!href.includes(":"), `${destination} href leaks the route pattern`)
    assert.ok(!href.includes("?"), `${destination} href leaks an optional segment`)
  }
})

test("every href is derived from its pattern, not written down twice", () => {
  // A literal href that has drifted from its pattern still has no `:` in it,
  // so the test above cannot see it. This one can: rename the pattern and a
  // stale literal stops being its prefix.
  for (const destination of DESTINATIONS) {
    const pattern = ROUTE_PATHS[destination]
    assert.ok(
      pattern.startsWith(destinationPath(destination)),
      `${destination}: href ${destinationPath(destination)} is not a prefix of ${pattern}`,
    )
  }
  assert.ok(practicePath("x").startsWith(destinationPath("practice")))
})

test("the router this app ships actually matches the hrefs it generates", () => {
  // ADR-0005 specifies react-router v7; this app is on v8. The behaviour the
  // route table depends on is the optional segment `:skillId?` — one route
  // serving both "resume" and "drill this skill". Asserting the string exists
  // would pass on a version that had dropped the feature, so this asks the
  // installed matcher, which is the same code the shell routes with.
  for (const destination of DESTINATIONS) {
    const href = destinationPath(destination)
    assert.ok(
      matchPath(ROUTE_PATHS[destination], href),
      `${ROUTE_PATHS[destination]} does not match its own href ${href}`,
    )
  }
  assert.ok(matchPath(ROUTE_PATHS.home, destinationPath("practice")) === null)

  const drill = matchPath(ROUTE_PATHS.practice, practicePath("add.regroup-2d"))
  assert.equal(drill?.params.skillId, "add.regroup-2d")
})

test("skill ids are escaped into the path", () => {
  assert.equal(practicePath("add.regroup-2d"), "/practice/add.regroup-2d")
  assert.equal(practicePath("a/b"), "/practice/a%2Fb")
})
