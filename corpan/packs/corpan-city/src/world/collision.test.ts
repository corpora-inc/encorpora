import { describe, it, expect } from "vitest"
import { RoomTopology } from "@corpan-city/contracts"
import topologyJson from "../../content/topologies/plaza-grand.json"
import {
  createObstacleField,
  topologyObstacles,
  propFootprints,
  buildPlazaObstacleField,
  pushDir,
  pushOutCircle,
  DEFAULT_PUSH_DX,
  DEFAULT_PUSH_DZ,
  FOUNTAIN_RADIUS,
  findSafeSpawn,
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

describe("collision: degenerate-centre push (the fountain-bug root cause)", () => {
  it("pushDir returns the deterministic default at the EXACT centre", () => {
    // p == centre → radial vector is (0,0); must NOT be NaN, must be the default.
    const d = pushDir(0, 0, 0, 0)
    expect(Number.isFinite(d.dx)).toBe(true)
    expect(Number.isFinite(d.dz)).toBe(true)
    expect(d.dx).toBe(DEFAULT_PUSH_DX)
    expect(d.dz).toBe(DEFAULT_PUSH_DZ)
    expect(Math.hypot(d.dx, d.dz)).toBeCloseTo(1, 9) // unit
  })

  it("pushDir uses a caller-preferred direction at the centre, normalized", () => {
    const d = pushDir(0, 0, 0, 0, { dx: 0, dz: 5 })
    expect(d.dx).toBeCloseTo(0, 9)
    expect(d.dz).toBeCloseTo(1, 9) // normalized toward +z
  })

  it("pushDir returns the true outward radial OFF the centre (normal case)", () => {
    const d = pushDir(3, 0, 0, 0)
    expect(d.dx).toBeCloseTo(1, 9)
    expect(d.dz).toBeCloseTo(0, 9)
  })

  it("pushOutCircle ejects a point at the EXACT centre to just outside the ring", () => {
    // the generalized fountain case: a body radius 0.5 dead-centre of a r=2.55
    // circle. Old code (0/0) left it embedded; now it ejects ≥ r + cr away.
    const r = 0.5
    const cr = 2.55
    const out = pushOutCircle(0, 0, r, 0, 0, cr)
    expect(Math.hypot(out.x, out.z)).toBeGreaterThanOrEqual(r + cr)
    expect(out.x).toBeGreaterThan(0) // along the +X default
    expect(out.z).toBeCloseTo(0, 9)
  })

  it("pushOutCircle is a no-op when already clear", () => {
    const out = pushOutCircle(10, 10, 0.5, 0, 0, 2.55)
    expect(out).toEqual({ x: 10, z: 10 })
  })

  it("field.pushOut ejects a body STATIONED at a circle's exact centre", () => {
    // degenerate centre INSIDE the obstacle field (not just the bare helper).
    const r = 0.5
    const field = createObstacleField([{ kind: "circle", x: 0, z: 0, r: 2.55 }])
    expect(field.blocked(0, 0, r)).toBe(true)
    const out = field.pushOut(0, 0, r)
    expect(Number.isFinite(out.x)).toBe(true)
    expect(Number.isFinite(out.z)).toBe(true)
    expect(field.blocked(out.x, out.z, r)).toBe(false) // genuinely out
    expect(Math.hypot(out.x, out.z)).toBeGreaterThanOrEqual(2.55 + r)
  })

  it("field.pushOut at the FOUNTAIN centre lands ≥ collider + agent radius away", () => {
    // the literal screenshot bug: a special stationed at the plaza fountain (0,0).
    const r = 0.5 // AGENT_RADIUS
    const field = buildPlazaObstacleField(topology, { caps: FULL_CAPS, seed: DRESSING_DEFAULT_SEED })
    const out = field.pushOut(0, 0, r)
    expect(field.blocked(out.x, out.z, r)).toBe(false)
    expect(Math.hypot(out.x, out.z)).toBeGreaterThanOrEqual(FOUNTAIN_RADIUS + r)
  })
})


describe("findSafeSpawn — never drop the player inside a collider (#104 taxi-to-fountain)", () => {
  const R = 0.55 // PLAYER_RADIUS

  it("teleport ONTO the fountain centre -> lands on clear, walkable ground", () => {
    const field = buildPlazaObstacleField(topology, { caps: FULL_CAPS, seed: DRESSING_DEFAULT_SEED })
    expect(field.blocked(0, 0, R)).toBe(true)
    const safe = findSafeSpawn(field, 0, 0, R)
    expect(field.blocked(safe.x, safe.z, R)).toBe(false)
  })

  it("an already-clear point is returned unchanged", () => {
    const field = createObstacleField([{ kind: "circle", x: 0, z: 0, r: 2.9 }])
    expect(findSafeSpawn(field, 20, 20, R)).toEqual({ x: 20, z: 20 })
  })

  it("escapes a big box even when pushOut lands on another collider (spiral fallback)", () => {
    const field = createObstacleField([
      { kind: "box", x: 0, z: 0, hw: 8, hd: 2 },
      { kind: "circle", x: 0, z: 3.0, r: 2.5 },
    ])
    expect(field.blocked(0, 0, R)).toBe(true)
    const safe = findSafeSpawn(field, 0, 0, R)
    expect(field.blocked(safe.x, safe.z, R)).toBe(false)
  })

  it("is deterministic — same inputs yield the same safe point", () => {
    const field = buildPlazaObstacleField(topology, { caps: FULL_CAPS, seed: DRESSING_DEFAULT_SEED })
    expect(findSafeSpawn(field, 0, 0, R)).toEqual(findSafeSpawn(field, 0, 0, R))
  })

  it("works against a bare {blocked} stub without pushOut", () => {
    const stub = { blocked: (x: number, z: number, _r: number) => x * x + z * z < 5 * 5 }
    const safe = findSafeSpawn(stub, 0, 0, R)
    expect(stub.blocked(safe.x, safe.z, R)).toBe(false)
  })
})
