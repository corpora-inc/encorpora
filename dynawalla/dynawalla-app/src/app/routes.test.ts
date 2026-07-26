import { test } from "node:test"
import assert from "node:assert/strict"

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

test("skill ids are escaped into the path", () => {
  assert.equal(practicePath("add.regroup-2d"), "/practice/add.regroup-2d")
  assert.equal(practicePath("a/b"), "/practice/a%2Fb")
})
