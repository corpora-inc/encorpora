import { createHashRouter, type RouteObject } from "react-router"

import { Surface } from "../shell/Surface.tsx"
import { Shell } from "./Shell.tsx"
import { DESTINATIONS, destinationPath, ROUTE_PATHS } from "./routes.ts"

// Hash routing, per ADR-0005: `tauri://` and `http://tauri.localhost` are
// custom protocols, history routing behaves inconsistently under them, and the
// hash gives Android's hardware back button something real to pop.
//
// **The route table is generated from the destination list, not written beside
// it.** Every destination gets a route and every route is a destination — a
// screen that renders nothing cannot be added here by forgetting to write one,
// and a destination cannot be added to the navigation with no route behind it.
// What each one draws is `shell/surfaces.ts`, which is where the test that
// forbids an empty screen can reach it.
//
// `key` matters: all five routes render the same component, so React would
// otherwise keep one instance mounted across a navigation and carry its state
// with it — an armed "erase everything" would still be armed after a trip to
// another screen and back.
const surfaces: RouteObject[] = DESTINATIONS.map((destination) => {
  const path = destinationPath(destination)
  const element = <Surface key={destination} destination={destination} />
  // The front door is the parent route's own path, so it is the index child
  // rather than a second route at "/". A route object carrying both `index`
  // and `path` is a runtime error in react-router, not a type error.
  return path === "/"
    ? { index: true, element, handle: destination }
    : { path, element, handle: destination }
})

export const router = createHashRouter([
  {
    path: ROUTE_PATHS.packs,
    element: <Shell />,
    children: surfaces,
  },
])
