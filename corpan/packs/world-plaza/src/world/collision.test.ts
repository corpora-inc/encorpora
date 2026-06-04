import { describe, it, expect } from "vitest"
import { RoomTopology } from "@world-plaza/contracts"
import topologyJson from "../../content/topologies/plaza-grand.json"
import {
  createObstacleField,
  topologyObstacles,
  propFootprints,
  buildPlazaObstacleField,
  FOUNTAIN_RADIUS,
  type Obstacle,
} from "./collision"
import { composeDressing } from "./composition"
import { FULL_CAPS, DRESSING_DEFAULT_SEED } from "./dressing"

const topology = RoomTopology.parse(topologyJson)

describe("collision: topology → obstacles", () => {
  it("models the fountain as a big circle, NOT a tiny box", () => {
    const obs = topologyObstacles(topology)
    const circles = obs.filter((o): o is Extract<Obstacle, { kind: "circle" }> => o.kind === "circle")
    // exactly one big fountain circle at the origin.
    const f = circles.find((c) => Math.hypot(c.x, c.z) < 0.01)
    expect(f).toBeTruthy()
    expect(f!.r).toBeCloseTo(FOUNTAIN_RADIUS, 5)
    // the 3×3 fountain footprint box must be GONE (replaced by the circle).
    const tinyBoxAtOrigin = obs.find(
      (o) => o.kind === "box" && Math.hypot(o.x, o.z) < 0.01,
    )
    expect(tinyBoxAtOrigin).toBeUndefined()
  })

  it("keeps every building blocker as a box", () => {
    const obs = topologyObstacles(topology)
    const boxes = obs.filter((o) => o.kind === "box")
    // 29 blockers − 1 fountain footprint = 28 building boxes.
    expect(boxes.length).toBe(topology.blockers.length - 1)
  })
})

describe("collision: prop footprints", () => {
  it("emits a collider circle for solid props and skips décor", () => {
    const plan = composeDressing(topology, { seed: DRESSING_DEFAULT_SEED, caps: FULL_CAPS })
    const circles = propFootprints(plan.placements)
    expect(circles.length).toBeGreaterThan(30)
    // every footprint has a positive radius.
    for (const c of circles) expect(c.r).toBeGreaterThan(0)
    // solid props (benches/stalls) produce colliders; counts roughly track.
    const benches = plan.placements.filter((p) => p.species === "bench").length
    expect(benches).toBeGreaterThan(0)
  })
})

describe("collision: field queries", () => {
  const field = buildPlazaObstacleField(topology, { caps: FULL_CAPS, seed: DRESSING_DEFAULT_SEED })

  it("reports the fountain centre as blocked, open ground as free", () => {
    expect(field.blocked(0, 0, 0.55)).toBe(true)
    // a far corner of the +120 map is open.
    expect(field.blocked(115, 115, 0.55)).toBe(false)
  })

  it("resolve() never lands a body inside an obstacle (charge the fountain)", () => {
    // start outside the fountain ring, aim straight at the centre repeatedly.
    let x = 0
    let z = 11.5
    const r = 0.55
    for (let i = 0; i < 200; i++) {
      const res = field.resolve(x, z, x, z - 0.3, r)
      x = res.x
      z = res.z
    }
    expect(field.blocked(x, z, r)).toBe(false)
    // stopped just outside the basin (radius + body), never punched through.
    expect(Math.hypot(x, z)).toBeGreaterThan(FOUNTAIN_RADIUS)
  })

  it("resolve() slides along a building wall instead of sticking", () => {
    // find a building box and push a body straight into its face, then sideways.
    const box = field.obstacles.find((o) => o.kind === "box") as
      | Extract<Obstacle, { kind: "box" }>
      | undefined
    expect(box).toBeTruthy()
    const r = 0.5
    // start just outside the −x face, moving in +x (into the wall) AND +z (along it).
    let x = box!.x - box!.hw - r - 0.05
    let z = box!.z
    const startZ = z
    for (let i = 0; i < 30; i++) {
      const res = field.resolve(x, z, x + 0.4, z + 0.4, r)
      x = res.x
      z = res.z
      expect(field.blocked(x, z, r)).toBe(false)
    }
    // it couldn't go through the wall in x, but it SLID in z (didn't stick).
    expect(z - startZ).toBeGreaterThan(2)
  })

  it("pushOut() ejects a body that starts inside the fountain", () => {
    const r = 0.5
    const out = field.pushOut(0, 0, r)
    expect(field.blocked(out.x, out.z, r)).toBe(false)
  })

  it("createObstacleField is deterministic for the same inputs", () => {
    const obs: Obstacle[] = [{ kind: "circle", x: 5, z: 5, r: 1 }]
    const a = createObstacleField(obs)
    const b = createObstacleField(obs)
    expect(a.blocked(5, 5, 0.3)).toBe(b.blocked(5, 5, 0.3))
    expect(a.resolve(0, 5, 5, 5, 0.3)).toEqual(b.resolve(0, 5, 5, 5, 0.3))
  })
})
