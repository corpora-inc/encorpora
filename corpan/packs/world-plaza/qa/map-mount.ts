/**
 * QA harness for the full map (#35: water + blockers + zoom). Builds a MapView
 * from a generated city + cityMapGeometry() and mounts createMapSection into the
 * page. `?zoom=N` sets an initial zoom via the exposed hook. Screenshots show the
 * map base layer rendering water (blue) + building footprints, and zoomed views.
 */
import { RoomTopology } from "@world-plaza/contracts"
import type { MapView } from "../src/contracts/runtime"
import { generateCity, cityMapGeometry } from "../src/city"
import { createMapSection } from "../src/map/fullMap"

const layout = generateCity()
const geometry = cityMapGeometry(layout)

const topology = RoomTopology.parse({
  id: "corpan-city",
  bounds: layout.bounds,
  spawns: [layout.spawn],
  blockers: [],
  anchors: layout.anchors.map((a) => ({
    id: a.id,
    role: a.kind === "spawn" ? "spawn" : a.kind === "vendor" ? "vendor" : "decor",
    x: a.x,
    z: a.z,
    ...(a.facing != null ? { facing: a.facing } : {}),
  })),
})

const view: MapView = {
  topology,
  getPlayerPos: () => ({ x: layout.spawn.x, z: layout.spawn.z, facing: 0 }),
  getRemotePositions: () => [],
  getQuestMarkers: () => [],
  getMapGeometry: () => geometry,
}

const body = document.createElement("div")
body.style.cssText = "position:absolute;inset:0;display:flex"
document.body.appendChild(body)
createMapSection({ view, accent: "#c46b4a" })(body)

// expose counts for the screenshotter sanity check.
;(window as unknown as { __wpMap: unknown }).__wpMap = {
  water: geometry.water.length,
  blockers: geometry.blockers.length,
  bounds: layout.bounds,
}
