// THE BALANCE SCALE — the physical embodiment of the equals sign.
//
// This is the most important object in the kit, so it is the one with the most
// evidence behind it. `bench/probe-scale.mjs` builds the identical scale in four
// engines at five pivot heights; the results are in ../../README.md. Three
// things came out of it and all three are baked in here:
//
// 1. THE ASSEMBLY MUST NOT COLLIDE WITH ITSELF.
//    Rapier joints collide the bodies they connect and expose no
//    `collideConnected`. A scale built the obvious way is a scale whose beam
//    cannot rotate: measured 0.0 deg of travel under a 100% overload. With one
//    collision-group bit it swings -66 deg under a 25% overload. This is not a
//    tuning preference, it is the difference between working and not.
//
// 2. THE PIVOT SITS ABOVE THE BEAM'S CENTRE OF MASS.
//    A beam pivoted through its own centroid is NEUTRALLY stable: there is no
//    restoring torque at any angle, so where it settles is decided by solver
//    noise. `pivotRaise` turns "level" into an attractor, and doubles as the
//    sensitivity dial. Measured on Rapier, tilt under one extra unit in four:
//      raise 0.00 -> -66.5 deg   (dramatic, and slow to settle)
//      raise 0.05 -> -31.6 deg
//      raise 0.15 -> -17.8 deg   <- default: legible across a tablet, settles fast
//      raise 0.30 -> -18.3 deg
//      raise 0.60 ->  -3.2 deg   (too subtle to read)
//    At equality every one of those settles to within 0.02 deg with 0.000 deg
//    of jitter, which is what "the equals sign is reliable" has to mean.
//
// 3. THE PANS HAVE LIPS.
//    Not decoration. A load on a lipless pan slides off the moment the beam
//    tilts, which silently removes the imbalance — the first version of the
//    probe concluded Rapier "settles level under a 25% overload" because the
//    overload had slid onto the floor.
//
// And the rule that is not about physics at all:
//
// 4. `compare()` IS INTEGER ARITHMETIC, NEVER THE BEAM ANGLE.
//    The beam is how the child SEES the comparison. It is never how the app
//    KNOWS it. Reading a mastery signal off a float that a solver produced
//    would make a curriculum claim depend on contact ordering. This mirrors
//    ADR-0009's "true by construction" — the visual can be beautiful and
//    approximate; the answer must be exact.

import { pin, type World, type Vec2, type BodyHandle } from "../world.ts"

export interface BalanceScaleOpts {
  at?: Vec2
  /** Half the distance between the pans. */
  armLength?: number
  /** Pivot height above the beam's centre of mass. See note 2. */
  pivotRaise?: number
  /** Mass of one unit weight, in kilograms of the world's own scale. */
  unitMass?: number
  /**
   * Mechanical stop, in degrees either side of level. A real balance has one;
   * without it an imbalance runs the beam to vertical and puts the low pan
   * through the floor, which is both ugly and unreadable. 22 deg is enough to
   * be unmistakable across a tablet and small enough that the pans stay level
   * enough to hold their load.
   */
  maxTiltDeg?: number
}

export interface BalanceScale {
  readonly beam: BodyHandle
  readonly leftPan: BodyHandle
  readonly rightPan: BodyHandle
  /** The two hanging links, exposed so a view can draw them. */
  readonly stirrups: readonly [BodyHandle, BodyHandle]
  /** Drop `n` unit weights into a pan. They are real bodies and really land. */
  put(side: "left" | "right", n?: number): BodyHandle[]
  /** Take one back off. Returns false if that pan is empty. */
  take(side: "left" | "right"): boolean
  readonly left: number
  readonly right: number
  /**
   * The truth: -1 left is heavier, 0 equal, +1 right is heavier.
   * Exact integer comparison of what was put in. Never the beam angle.
   */
  compare(): -1 | 0 | 1
  /** Beam tilt in radians, for the view only. */
  tilt(): number
  /** Tilt as a fraction of the mechanical stop, -1..+1. View only. */
  tiltFraction(): number
  /** True once the beam has stopped moving — for "wait for it to settle" UX. */
  settled(): boolean
}

const PAN_HALF_W = 1.0
const LIP_H = 0.3

export function balanceScale(w: World, o: BalanceScaleOpts = {}): BalanceScale {
  const [ox, oy] = o.at ?? [0, 0]
  const armLength = o.armLength ?? 3.2
  const pivotRaise = o.pivotRaise ?? 0.15
  const unitMass = o.unitMass ?? 1
  const maxTilt = ((o.maxTiltDeg ?? 22) * Math.PI) / 180
  const hang = 1.3

  // ONE assembly id for every part of the scale. Note 1.
  const asm = w.newAssembly()
  const part = { assembly: asm, friction: 0.6 } as const

  const pivotY = oy + 5.2
  const beamY = pivotY - pivotRaise

  const column = w.add("static", { box: [0.3, 2.6] }, [ox, oy + 2.6], part)
  const beam = w.add("dynamic", { box: [armLength, 0.12] }, [ox, beamY], { ...part, density: 2.5 })

  const makeSide = (sign: -1 | 1) => {
    const x = ox + sign * armLength
    const stirrup = w.add("dynamic", { box: [0.04, hang / 2] }, [x, beamY - hang / 2], {
      ...part,
      density: 0.8,
    })
    // Note 3 — a pan is a compound body: floor plus two lips.
    const pan = w.add(
      "dynamic",
      [
        { box: [PAN_HALF_W, 0.08] },
        { box: [0.08, LIP_H], at: [-(PAN_HALF_W - 0.08), LIP_H] },
        { box: [0.08, LIP_H], at: [PAN_HALF_W - 0.08, LIP_H] },
      ],
      [x, beamY - hang],
      { ...part, density: 1.2, friction: 0.9, tag: sign < 0 ? "pan-left" : "pan-right" },
    )
    return { stirrup, pan, x }
  }

  const L = makeSide(-1)
  const R = makeSide(1)

  pin(w, column, beam, [0, pivotY - (oy + 2.6)], [0, pivotRaise], [-maxTilt, maxTilt])
  pin(w, beam, L.stirrup, [-armLength, 0], [0, hang / 2])
  pin(w, L.stirrup, L.pan, [0, -hang / 2], [0, 0])
  pin(w, beam, R.stirrup, [armLength, 0], [0, hang / 2])
  pin(w, R.stirrup, R.pan, [0, -hang / 2], [0, 0])

  const held: Record<"left" | "right", BodyHandle[]> = { left: [], right: [] }

  const api: BalanceScale = {
    beam,
    leftPan: L.pan,
    rightPan: R.pan,
    stirrups: [L.stirrup, R.stirrup],
    put(side, n = 1) {
      const made: BodyHandle[] = []
      const pan = side === "left" ? L : R
      for (let i = 0; i < n; i++) {
        const k = held[side].length
        // Deterministic drop positions: no Math.random, and a replay of the
        // same command log stacks the cubes the same way every time.
        const lane = k % 4
        const cube = w.add(
          "dynamic",
          { box: [0.18, 0.18] },
          [pan.x + (lane - 1.5) * 0.42, beamY - hang + 0.6 + Math.floor(k / 4) * 0.42 + i * 0.02],
          { density: unitMass / (0.36 * 0.36), friction: 0.7, tag: `unit-${side}` },
        )
        held[side].push(cube)
        made.push(cube)
      }
      return made
    },
    take(side) {
      const b = held[side].pop()
      if (!b) return false
      b.remove()
      return true
    },
    get left() {
      return held.left.length
    },
    get right() {
      return held.right.length
    },
    compare() {
      // Note 4. Integers in, integer out. The solver is not consulted.
      const d = held.left.length - held.right.length
      return d === 0 ? 0 : d > 0 ? -1 : 1
    },
    tilt: () => beam.angle(),
    /** -1..+1, tilt as a fraction of the mechanical stop. Handy for the view. */
    tiltFraction: () => Math.max(-1, Math.min(1, beam.angle() / maxTilt)),
    settled: () => Math.abs(beam.rb.angvel()) < 0.02,
  }
  return api
}
