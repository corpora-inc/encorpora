import {
  Color4,
  ParticleSystem,
  Scene,
  Texture,
  Vector3,
} from "@babylonjs/core"
import { STARFIELD_COUNT, STARFIELD_SIZE } from "../core/constants"

export type Starfield = {
  system: ParticleSystem
  dispose: () => void
}

/**
 * Create a background starfield particle system.
 *
 * Stars slowly drift through space to give depth and atmosphere
 * to the reading experience.
 */
export function createStarfield(scene: Scene): Starfield {
  const system = new ParticleSystem("starfield", STARFIELD_COUNT, scene)

  // Tiny white circle texture (inline SVG → data URI)
  system.particleTexture = new Texture(
    "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iOCIgY3k9IjgiIHI9IjQiIGZpbGw9IndoaXRlIi8+PC9zdmc+",
    scene
  )

  // Emit from a large box around the camera
  system.emitter = Vector3.Zero()
  system.minEmitBox = new Vector3(
    -STARFIELD_SIZE / 2,
    -STARFIELD_SIZE / 2,
    -STARFIELD_SIZE / 4
  )
  system.maxEmitBox = new Vector3(
    STARFIELD_SIZE / 2,
    STARFIELD_SIZE / 2,
    STARFIELD_SIZE
  )

  // Star appearance
  system.color1 = new Color4(0.8, 0.9, 1.0, 0.6)
  system.color2 = new Color4(0.6, 0.7, 0.95, 0.4)
  system.colorDead = new Color4(0.3, 0.4, 0.6, 0)
  system.minSize = 0.03
  system.maxSize = 0.12
  system.minLifeTime = 8
  system.maxLifeTime = 20

  // Slow drift — stars barely move
  system.emitRate = STARFIELD_COUNT / 12
  system.minEmitPower = 0.05
  system.maxEmitPower = 0.2
  system.direction1 = new Vector3(-0.02, -0.01, -0.1)
  system.direction2 = new Vector3(0.02, 0.01, -0.05)
  system.gravity = Vector3.Zero()

  // Additive blending for glow
  system.blendMode = ParticleSystem.BLENDMODE_ADD

  system.updateSpeed = 0.01

  system.start()

  return {
    system,
    dispose: () => {
      system.stop()
      system.dispose()
    },
  }
}
