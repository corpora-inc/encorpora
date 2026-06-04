import type { Scene } from "@babylonjs/core/scene"
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder"
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial"
import { Color3 } from "@babylonjs/core/Maths/math"
import type { Billboard } from "../world/billboard"

/**
 * Juice / game-feel — a first-class, reusable layer (plan locked decision #10).
 * Fires at opportune moments (greet an NPC, win, unlock). Kept tiny + pooled so
 * it never costs frame budget. This is the seed; springs/particles/hit-stop and
 * audio stings grow here, held to an explicit feel bar.
 */

type Tween = (dt: number) => boolean // returns false when finished

const easeOutBack = (x: number): number => {
  const c1 = 1.70158
  const c3 = c1 + 1
  return 1 + c3 * (x - 1) ** 3 + c1 * (x - 1) ** 2
}

export interface Juice {
  /** bouncy scale pop with overshoot — for greetings/selection. */
  pop: (bb: Billboard, strength?: number) => void
  /** expanding, fading ground ring at a world point — for confirms/wins. */
  ring: (x: number, z: number, color?: string) => void
  /** subtle continuous walk bob; call with speed 0..1 each frame. */
  walkBob: (bb: Billboard, speed: number, dt: number) => void
  update: (dt: number) => void
  dispose: () => void
}

export function createJuice(scene: Scene): Juice {
  const tweens = new Set<Tween>()
  let bobPhase = 0

  const pop: Juice["pop"] = (bb, strength = 0.32) => {
    let t = 0
    const dur = 0.42
    const from = 1 + strength
    const tween: Tween = (dt) => {
      t += dt
      const k = Math.min(t / dur, 1)
      const s = from + (1 - from) * easeOutBack(k)
      bb.setScale(s)
      if (k >= 1) {
        bb.setScale(1)
        return false
      }
      return true
    }
    tweens.add(tween)
  }

  const ring: Juice["ring"] = (x, z, color = "#ffffff") => {
    const disc = MeshBuilder.CreateDisc("wp-ring", { radius: 1, tessellation: 28 }, scene)
    disc.rotation.x = Math.PI / 2
    disc.position.set(x, 0.06, z)
    disc.isPickable = false
    const mat = new StandardMaterial("wp-ring-mat", scene)
    const c = Color3.FromHexString(color)
    mat.emissiveColor = c
    mat.diffuseColor = c
    mat.specularColor = new Color3(0, 0, 0)
    mat.alpha = 0.6
    mat.disableLighting = true
    disc.material = mat
    let t = 0
    const dur = 0.55
    const tween: Tween = (dt) => {
      t += dt
      const k = Math.min(t / dur, 1)
      const r = 0.4 + k * 2.4
      disc.scaling.set(r, r, r)
      mat.alpha = 0.6 * (1 - k)
      if (k >= 1) {
        disc.dispose()
        return false
      }
      return true
    }
    tweens.add(tween)
  }

  const walkBob: Juice["walkBob"] = (bb, speed, dt) => {
    // A little hop on the CUTOUT only — never the root (which carries the
    // shadow), so the blob shadow stays planted under the feet. abs(sin) keeps
    // the hop above the ground; multiplying by speed plants it at rest.
    bobPhase += dt * 9 * speed
    bb.setBob(Math.abs(Math.sin(bobPhase)) * 0.14 * speed)
  }

  const update: Juice["update"] = (dt) => {
    for (const tw of tweens) {
      if (!tw(dt)) tweens.delete(tw)
    }
  }

  return {
    pop,
    ring,
    walkBob,
    update,
    dispose: () => tweens.clear(),
  }
}
