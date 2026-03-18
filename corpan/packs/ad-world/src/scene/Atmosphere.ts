import { Color4 } from "@babylonjs/core/Maths/math.color"
import { Vector3 } from "@babylonjs/core/Maths/math.vector"
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder"
import { ParticleSystem } from "@babylonjs/core/Particles/particleSystem"
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture"
import type { Scene } from "@babylonjs/core/scene"

/** Create a small white circle texture for particles via canvas. */
const createParticleTexture = (scene: Scene, name: string, size = 32): DynamicTexture => {
  const tex = new DynamicTexture(name, size, scene, false)
  const ctx = tex.getContext()
  const half = size / 2
  ctx.clearRect(0, 0, size, size)
  const gradient = ctx.createRadialGradient(half, half, 0, half, half, half)
  gradient.addColorStop(0, "rgba(255,255,255,1)")
  gradient.addColorStop(0.5, "rgba(255,255,255,0.4)")
  gradient.addColorStop(1, "rgba(255,255,255,0)")
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, size, size)
  tex.update()
  return tex
}

/**
 * Atmospheric particle effects — rain-like streaks, floating dust/embers.
 */
export const createAtmosphere = (scene: Scene) => {
  const particleTex = createParticleTexture(scene, "particleTex", 32)

  // Rain-like particle streaks
  const rainEmitter = MeshBuilder.CreateBox("rainEmitter", { size: 0.1 }, scene)
  rainEmitter.position = new Vector3(0, 20, 0)
  rainEmitter.isVisible = false

  const rain = new ParticleSystem("rain", 600, scene)
  rain.emitter = rainEmitter
  rain.createBoxEmitter(
    new Vector3(0, -1, 0),
    new Vector3(0, -1, 0),
    new Vector3(-30, 0, -30),
    new Vector3(30, 0, 30),
  )

  rain.particleTexture = particleTex

  rain.color1 = new Color4(0.3, 0.4, 0.8, 0.15)
  rain.color2 = new Color4(0.2, 0.3, 0.6, 0.08)
  rain.colorDead = new Color4(0, 0, 0, 0)

  rain.minSize = 0.02
  rain.maxSize = 0.04
  rain.minScaleY = 8
  rain.maxScaleY = 15
  rain.minLifeTime = 0.8
  rain.maxLifeTime = 1.5
  rain.emitRate = 300
  rain.gravity = new Vector3(0, -20, 0)
  rain.blendMode = ParticleSystem.BLENDMODE_ADD

  rain.start()

  // Floating dust/ember particles
  const dustEmitter = MeshBuilder.CreateBox("dustEmitter", { size: 0.1 }, scene)
  dustEmitter.position = new Vector3(0, 2, 0)
  dustEmitter.isVisible = false

  const dust = new ParticleSystem("dust", 100, scene)
  dust.emitter = dustEmitter
  dust.createBoxEmitter(
    new Vector3(0, 0.2, 0),
    new Vector3(0, 0.5, 0),
    new Vector3(-25, 0, -25),
    new Vector3(25, 4, 25),
  )

  dust.particleTexture = particleTex

  dust.color1 = new Color4(1, 0.6, 0.2, 0.3)
  dust.color2 = new Color4(0.8, 0.3, 0.8, 0.15)
  dust.colorDead = new Color4(0, 0, 0, 0)

  dust.minSize = 0.03
  dust.maxSize = 0.08
  dust.minLifeTime = 3
  dust.maxLifeTime = 8
  dust.emitRate = 15
  dust.gravity = new Vector3(0, 0.1, 0)
  dust.blendMode = ParticleSystem.BLENDMODE_ADD

  dust.start()

  return { rain, dust }
}
