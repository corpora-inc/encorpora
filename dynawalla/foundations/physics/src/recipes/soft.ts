// Soft bodies and liquid — both approximations, both honest about it.
//
// Rapier has no soft-body or fluid solver in its JS build. (Its Rust crate has
// no FEM either; the ecosystem answer is `salva` for fluids, which is not
// compiled into the WASM package and would double the binary.) So this file is
// the two approximations that are worth shipping, sized by the tier's particle
// budget rather than by hope.

import RAPIER from "@dimforge/rapier2d-compat"
import type { World, Vec2, BodyHandle } from "../world.ts"

export interface SoftBlobOpts {
  at: Vec2
  radius?: number
  /** Ring particles. Clamped to the tier's particle budget. */
  segments?: number
  /** 0 = jelly, 1 = beach ball. */
  firmness?: number
}

export interface SoftBlob {
  readonly ring: BodyHandle[]
  readonly core: BodyHandle
  /** Outline in world space, ready to feed a triangle fan or a spline. */
  outline(into?: Float32Array): Float32Array
  /** 1.0 = undeformed. Below ~0.6 it reads as "squashed". */
  roundness(): number
}

/**
 * Pressurised-ring soft body: a circle of small discs held by springs to their
 * neighbours and to a core, which is the standard 2D game approach and the only
 * one that stays stable at 60 Hz with this few constraints.
 *
 * The core spring is what stops it collapsing. A ring held only by neighbour
 * springs has no resistance to inversion at all — push it hard once and it
 * turns inside out and never comes back, which looks like a bug and is not
 * recoverable. The core costs one extra spring per segment.
 */
export function softBlob(w: World, o: SoftBlobOpts): SoftBlob {
  const radius = o.radius ?? 0.8
  const segments = Math.min(o.segments ?? 16, Math.max(8, Math.floor(w.tier.particles / 8)))
  const firmness = o.firmness ?? 0.5
  const asm = w.newAssembly()
  const [cx, cy] = o.at

  const core = w.add("dynamic", { circle: radius * 0.25 }, [cx, cy], {
    assembly: asm,
    density: 0.4,
  })
  const ring: BodyHandle[] = []
  const pr = radius * 0.22
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2
    ring.push(
      w.add("dynamic", { circle: pr }, [cx + Math.cos(a) * radius, cy + Math.sin(a) * radius], {
        assembly: asm,
        density: 1,
        friction: 0.6,
      }),
    )
  }

  // Spring stiffness is per-unit-mass in Rapier; scale with firmness so the
  // dial reads the same whatever the blob's size.
  const stiff = 60 + firmness * 340
  const damp = 3 + firmness * 9
  const spring = (a: BodyHandle, b: BodyHandle, rest: number) => {
    w.rapier.createImpulseJoint(
      RAPIER.JointData.spring(rest, stiff, damp, { x: 0, y: 0 }, { x: 0, y: 0 }),
      a.rb,
      b.rb,
      true,
    )
  }
  const chord = 2 * radius * Math.sin(Math.PI / segments)
  for (let i = 0; i < segments; i++) {
    spring(ring[i]!, ring[(i + 1) % segments]!, chord)
    spring(ring[i]!, core, radius)
    // A second, longer chord across two neighbours resists shear. Without it
    // the ring shears into an ellipse under its own weight and stays there.
    spring(ring[i]!, ring[(i + 2) % segments]!, 2 * radius * Math.sin((2 * Math.PI) / segments))
  }

  return {
    ring,
    core,
    outline(into) {
      const out = into && into.length >= segments * 2 ? into : new Float32Array(segments * 2)
      for (let i = 0; i < segments; i++) {
        const p = ring[i]!.position()
        out[i * 2] = p[0]
        out[i * 2 + 1] = p[1]
      }
      return out
    },
    roundness() {
      const c = core.position()
      let min = Infinity
      let max = 0
      for (const r of ring) {
        const p = r.position()
        const d = Math.hypot(p[0] - c[0], p[1] - c[1])
        if (d < min) min = d
        if (d > max) max = d
      }
      return max === 0 ? 1 : min / max
    },
  }
}

export interface LiquidOpts {
  at: Vec2
  count?: number
  /** Radius of one droplet. Smaller looks wetter and costs more. */
  drop?: number
  /** Spread of the initial column, in metres. */
  width?: number
}

/**
 * Particle liquid: many small, slippery, non-bouncy discs.
 *
 * This is NOT SPH. There is no pressure term, no surface tension and no
 * incompressibility, so it will not fill a vessel to a flat level on its own —
 * it settles into a granular pile with a shallow angle of repose. For a
 * children's maths game that is usually the right trade: it POURS convincingly,
 * it splits between two vessels convincingly, and it costs a fraction of a real
 * fluid solver. If a game needs a true flat surface, draw the surface from the
 * particle count and use the particles only for the pour.
 *
 * The parameters below are the ones that make it read as liquid rather than as
 * gravel: near-zero friction, zero restitution, and a little linear damping so
 * the pile settles instead of shimmering forever.
 */
export function liquid(w: World, o: LiquidOpts): BodyHandle[] {
  const count = Math.min(o.count ?? 200, w.tier.particles)
  const drop = o.drop ?? 0.09
  const width = o.width ?? 1.2
  const perRow = Math.max(1, Math.floor(width / (drop * 2.1)))
  const out: BodyHandle[] = []
  for (let i = 0; i < count; i++) {
    const col = i % perRow
    const row = Math.floor(i / perRow)
    const b = w.add(
      "dynamic",
      { circle: drop },
      [
        o.at[0] - width / 2 + col * drop * 2.1 + w.rng.spread(drop * 0.15),
        o.at[1] + row * drop * 2.1,
      ],
      { density: 1, friction: 0.02, restitution: 0, tag: "drop" },
    )
    b.rb.setLinearDamping(0.4)
    out.push(b)
  }
  return out
}

/** How much of `drops` is currently inside an axis-aligned vessel. Exact count. */
export function volumeIn(drops: BodyHandle[], min: Vec2, max: Vec2): number {
  let n = 0
  for (const d of drops) {
    const [x, y] = d.position()
    if (x >= min[0] && x <= max[0] && y >= min[1] && y <= max[1]) n++
  }
  return n
}
