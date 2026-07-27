import { Color4 } from "@babylonjs/core/Maths/math.color"
import { Vector3 } from "@babylonjs/core/Maths/math.vector"
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder"
import { ParticleSystem } from "@babylonjs/core/Particles/particleSystem"
import { Texture } from "@babylonjs/core/Materials/Textures/texture"
import type { Scene } from "@babylonjs/core/scene"

/**
 * Atmospheric particle effects — rain-like streaks, floating dust/embers.
 */
export const createAtmosphere = (scene: Scene) => {
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

  // Use default particle texture
  rain.particleTexture = new Texture("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAQCAYAAADXnxW3AAAADklEQVQI12P4////MwMACPwC/1EO3EAAAAAASUVORK5CYII=", scene)

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

  dust.particleTexture = new Texture("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAYAAACp8Z5+AAAAFklEQVQI12P4z8DwHwMDAxMDGIAEAQBm9AH9OlDJOAAAAABJRU5ErkJggg==", scene)

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
