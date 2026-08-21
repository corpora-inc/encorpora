// The camera rig: shake, kick, punch-zoom, lookahead, roll — composed, never
// accumulated.
//
// ## The bug this file exists to make impossible
//
// The natural way to shake a camera is `camera.position.x += shakeX`. It works
// for one frame. Then the follow logic reads `camera.position` — which now
// contains the shake — and follows *that*, so the shake leaks into the camera's
// real position and the view drifts away from the subject over a few seconds.
// It is subtle, it looks like "the camera feels loose", and it is the single
// most common juice bug in shipped code.
//
// The fix is structural, not disciplinary: the game writes `rig.base`, the rig
// owns `camera`, and nothing ever reads the camera's transform back. Every
// frame the rig recomputes `camera = base + kick + shake + lookahead` from
// scratch. There is no path by which an offset can accumulate.
//
// ## Three.js trap: `lookAt()` overwrites rotation
//
// `camera.lookAt()` rebuilds the rotation from scratch, so roll applied before
// it silently vanishes. Roll is applied *after* `lookAt`, and `applyTo` does
// them in that order so a prototype cannot get it wrong. (Same class of trap as
// the repo's `setTarget()` resetting radius on ArcRotateCamera.)
//
// ## The core has no Three.js dependency
//
// `CameraLike` is structural. A `THREE.PerspectiveCamera` satisfies it, and so
// does a plain object driving a 2D canvas transform, which is how the same rig
// serves both the 3D and 2D prototypes without a branch.

import { Kick, Shake, type ShakeOptions } from "./shake.ts"
import { Spring1D } from "./spring.ts"

export interface Vec3Like {
  x: number
  y: number
  z: number
}

/** The minimum a camera must offer. `THREE.PerspectiveCamera` satisfies it. */
export interface CameraLike {
  position: Vec3Like
  rotation: { z: number }
  fov?: number
  lookAt?: (x: number, y: number, z: number) => void
  updateProjectionMatrix?: () => void
}

export interface CameraRigOptions extends ShakeOptions {
  /** Field of view with nothing happening. Punch is measured against it. */
  baseFov?: number
  /** How fast the lookahead offset chases its target. 3–5 Hz reads as smooth. */
  lookaheadHz?: number
  /** Cap on lookahead travel, world units. Unbounded lookahead is motion sickness. */
  lookaheadMax?: number
}

export class CameraRig {
  /** Where the game wants the camera. Write this; never read the camera back. */
  readonly base: Vec3Like = { x: 0, y: 0, z: 0 }
  /** Where the game wants the camera to point. */
  readonly aim: Vec3Like = { x: 0, y: 0, z: 0 }

  readonly shake: Shake
  readonly kick = new Kick()

  /** Punch-zoom, in degrees of FOV. Negative = pushed in = more intense. */
  private readonly fovSpring: Spring1D
  /** Lookahead, one spring per axis, clamped. */
  private readonly leadX: Spring1D
  private readonly leadY: Spring1D

  readonly baseFov: number
  private readonly lookaheadMax: number

  /** Composed output. Written each `update`, read by `applyTo`. */
  readonly out: Vec3Like = { x: 0, y: 0, z: 0 }
  outRoll = 0
  outFov = 50

  /** Scales shake + kick + fov punch together. The governor turns this down. */
  set intensity(v: number) {
    this.shake.intensity = v
    this.kick.intensity = v
    this.fovIntensity = v
  }
  private fovIntensity = 1

  constructor(opts: CameraRigOptions = {}) {
    this.shake = new Shake(opts)
    this.baseFov = opts.baseFov ?? 50
    this.outFov = this.baseFov
    this.fovSpring = new Spring1D(9, 0.55)
    const hz = opts.lookaheadHz ?? 4
    this.leadX = new Spring1D(hz, 1)
    this.leadY = new Spring1D(hz, 1)
    this.lookaheadMax = opts.lookaheadMax ?? 1.2
  }

  /**
   * The one call a reaction makes. Direction points *from* the impact *toward*
   * the camera, so the camera recoils away from the hit the way a held object
   * does. Pass `0,0,0` for an undirected impact and only the shake fires.
   */
  impact(trauma: number, kick: number, dx = 0, dy = 0, dz = 0): void {
    this.shake.add(trauma)
    if (kick !== 0) this.kick.add(dx * kick, dy * kick, dz * kick)
  }

  /**
   * Punch the field of view by `degrees` **at the peak**. Negative pushes in.
   *
   * Peak-normalised for the same reason the kick is: a raw impulse on a 9 Hz
   * spring converts to roughly 0.006° per unit, so hand-picked multipliers here
   * are wrong by two orders of magnitude and nobody can see it in review.
   */
  punchFov(degrees: number): void {
    this.fovSpring.impulse(this.fovSpring.impulseForPeak(degrees) * this.fovIntensity)
  }

  /** Bias the framing toward a point of interest, clamped and smoothed. */
  lookahead(dx: number, dy: number): void {
    const m = this.lookaheadMax
    this.leadX.rest = dx < -m ? -m : dx > m ? m : dx
    this.leadY.rest = dy < -m ? -m : dy > m ? m : dy
  }

  /**
   * @param dtRealMs wall clock. Shake, kick and fov punch all run on real time
   *   so they keep moving during a freeze frame — the contrast between a
   *   stopped world and a moving camera is what makes hitstop read as impact
   *   rather than as a hang.
   */
  update(dtRealMs: number): void {
    this.shake.update(dtRealMs)
    this.kick.update(dtRealMs)
    this.fovSpring.update(dtRealMs)
    this.leadX.update(dtRealMs)
    this.leadY.update(dtRealMs)

    this.out.x = this.base.x + this.kick.x + this.shake.x + this.leadX.x
    this.out.y = this.base.y + this.kick.y + this.shake.y + this.leadY.x
    this.out.z = this.base.z + this.kick.z
    this.outRoll = this.shake.roll
    this.outFov = this.baseFov + this.fovSpring.x
  }

  /** Write the composed transform onto a camera. Order matters — see header. */
  applyTo(camera: CameraLike): void {
    camera.position.x = this.out.x
    camera.position.y = this.out.y
    camera.position.z = this.out.z
    // lookAt first: it rebuilds rotation and would erase a roll set before it.
    camera.lookAt?.(this.aim.x, this.aim.y, this.aim.z)
    camera.rotation.z += this.outRoll
    if (camera.fov !== undefined && Math.abs(camera.fov - this.outFov) > 0.001) {
      camera.fov = this.outFov
      camera.updateProjectionMatrix?.()
    }
  }

  /** Everything to rest, without a pop. Called by `settleNow()`. */
  settle(): void {
    this.shake.settle()
    this.kick.settle()
    this.fovSpring.settle()
  }

  /** True when the rig is costing nothing and could be skipped. */
  isAtRest(): boolean {
    return this.shake.trauma <= 0 && this.kick.isAtRest() && this.fovSpring.isAtRest()
  }

  /**
   * The same composition as a CSS transform, for 2D prototypes. Offsets are
   * treated as CSS px. Returns a string; call at most once per frame.
   *
   * `translate3d` rather than `translate` on purpose: it promotes the element
   * to its own compositor layer, so the shake is a GPU transform and never
   * triggers layout. A shake implemented with `left`/`top` re-layouts the whole
   * subtree 60 times a second and is the reason "screen shake tanks the frame
   * rate" is a widely held belief about the web.
   */
  cssTransform(scale = 1): string {
    const x = this.out.x * scale
    const y = this.out.y * scale
    const deg = (this.outRoll * 180) / Math.PI
    return `translate3d(${x.toFixed(2)}px,${y.toFixed(2)}px,0) rotate(${deg.toFixed(3)}deg)`
  }
}
