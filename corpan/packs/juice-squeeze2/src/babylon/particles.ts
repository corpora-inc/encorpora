/**
 * Win celebration particle effects
 */

import {
  Scene,
  ParticleSystem,
  Vector3,
  Color4,
  RawTexture,
} from "@babylonjs/core"

// Create particle texture from raw RGBA pixel data (no base64 decoding needed)
function createParticleTexture(scene: Scene): RawTexture {
  const size = 32
  const data = new Uint8Array(size * size * 4)
  const center = size / 2
  const maxDist = center

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - center + 0.5
      const dy = y - center + 0.5
      const dist = Math.sqrt(dx * dx + dy * dy)
      const alpha = Math.max(0, 1 - dist / maxDist)
      const i = (y * size + x) * 4
      data[i] = 255     // R
      data[i + 1] = 255 // G
      data[i + 2] = 255 // B
      data[i + 3] = Math.floor(alpha * alpha * 255) // A (quadratic falloff)
    }
  }

  return RawTexture.CreateRGBATexture(data, size, size, scene, false, false)
}

export type WinParticles = {
  trigger: () => void
  setColor: (r: number, g: number, b: number) => void
  dispose: () => void
}

export function createWinParticles(scene: Scene): WinParticles {
  const particleTexture = createParticleTexture(scene)

  // Main burst - fountain of juice
  const mainBurst = new ParticleSystem("main-burst", 800, scene)
  mainBurst.particleTexture = particleTexture
  mainBurst.billboardMode = ParticleSystem.BILLBOARDMODE_ALL
  mainBurst.blendMode = ParticleSystem.BLENDMODE_STANDARD
  mainBurst.emitter = new Vector3(0, 4, 5)
  mainBurst.minEmitBox = new Vector3(-0.5, -0.3, -0.5)
  mainBurst.maxEmitBox = new Vector3(0.5, 0.3, 0.5)
  mainBurst.color1 = new Color4(1, 0.7, 0, 1)
  mainBurst.color2 = new Color4(1, 0.5, 0, 1)
  mainBurst.colorDead = new Color4(1, 0.3, 0, 0)
  mainBurst.minSize = 0.5
  mainBurst.maxSize = 1.5
  mainBurst.minLifeTime = 1.0
  mainBurst.maxLifeTime = 2.5
  mainBurst.emitRate = 0
  mainBurst.gravity = new Vector3(0, -5, 0)
  mainBurst.direction1 = new Vector3(-2, 6, -2)
  mainBurst.direction2 = new Vector3(2, 10, 2)
  mainBurst.minEmitPower = 10
  mainBurst.maxEmitPower = 20
  mainBurst.updateSpeed = 0.01
  mainBurst.start()

  // Side sprays
  const leftSpray = new ParticleSystem("left-spray", 400, scene)
  leftSpray.particleTexture = particleTexture
  leftSpray.billboardMode = ParticleSystem.BILLBOARDMODE_ALL
  leftSpray.blendMode = ParticleSystem.BLENDMODE_STANDARD
  leftSpray.emitter = new Vector3(0, 5, 5)
  leftSpray.minEmitBox = new Vector3(-0.3, -0.3, -0.3)
  leftSpray.maxEmitBox = new Vector3(0.3, 0.3, 0.3)
  leftSpray.color1 = new Color4(1, 0.6, 0, 1)
  leftSpray.color2 = new Color4(1, 0.8, 0.2, 1)
  leftSpray.colorDead = new Color4(1, 0.4, 0, 0)
  leftSpray.minSize = 0.4
  leftSpray.maxSize = 1.0
  leftSpray.minLifeTime = 0.8
  leftSpray.maxLifeTime = 2.0
  leftSpray.emitRate = 0
  leftSpray.gravity = new Vector3(0, -6, 0)
  leftSpray.direction1 = new Vector3(-6, 3, -1)
  leftSpray.direction2 = new Vector3(-4, 6, 1)
  leftSpray.minEmitPower = 8
  leftSpray.maxEmitPower = 16
  leftSpray.updateSpeed = 0.01
  leftSpray.start()

  const rightSpray = new ParticleSystem("right-spray", 400, scene)
  rightSpray.particleTexture = particleTexture
  rightSpray.billboardMode = ParticleSystem.BILLBOARDMODE_ALL
  rightSpray.blendMode = ParticleSystem.BLENDMODE_STANDARD
  rightSpray.emitter = new Vector3(0, 5, 5)
  rightSpray.minEmitBox = new Vector3(-0.3, -0.3, -0.3)
  rightSpray.maxEmitBox = new Vector3(0.3, 0.3, 0.3)
  rightSpray.color1 = new Color4(1, 0.6, 0, 1)
  rightSpray.color2 = new Color4(1, 0.8, 0.2, 1)
  rightSpray.colorDead = new Color4(1, 0.4, 0, 0)
  rightSpray.minSize = 0.4
  rightSpray.maxSize = 1.0
  rightSpray.minLifeTime = 0.8
  rightSpray.maxLifeTime = 2.0
  rightSpray.emitRate = 0
  rightSpray.gravity = new Vector3(0, -6, 0)
  rightSpray.direction1 = new Vector3(4, 3, -1)
  rightSpray.direction2 = new Vector3(6, 6, 1)
  rightSpray.minEmitPower = 8
  rightSpray.maxEmitPower = 16
  rightSpray.updateSpeed = 0.01
  rightSpray.start()

  // Dripping juice
  const drips = new ParticleSystem("drips", 300, scene)
  drips.particleTexture = particleTexture
  drips.billboardMode = ParticleSystem.BILLBOARDMODE_ALL
  drips.blendMode = ParticleSystem.BLENDMODE_STANDARD
  drips.emitter = new Vector3(0, 8, 5)
  drips.minEmitBox = new Vector3(-4, 0, -1)
  drips.maxEmitBox = new Vector3(4, 1, 1)
  drips.color1 = new Color4(1, 0.7, 0.1, 0.9)
  drips.color2 = new Color4(1, 0.5, 0, 0.9)
  drips.colorDead = new Color4(1, 0.4, 0, 0)
  drips.minSize = 0.2
  drips.maxSize = 0.5
  drips.minLifeTime = 1.0
  drips.maxLifeTime = 2.5
  drips.emitRate = 0
  drips.gravity = new Vector3(0, -10, 0)
  drips.direction1 = new Vector3(-0.5, -1, -0.3)
  drips.direction2 = new Vector3(0.5, 0, 0.3)
  drips.minEmitPower = 0.3
  drips.maxEmitPower = 1.5
  drips.updateSpeed = 0.01
  drips.start()

  // Helper to set color on all particle systems
  const setColor = (r: number, g: number, b: number) => {
    const systems = [mainBurst, leftSpray, rightSpray, drips]
    systems.forEach((ps) => {
      ps.color1 = new Color4(r, g, b, 1)
      ps.color2 = new Color4(Math.min(1, r * 1.2), Math.min(1, g * 1.1), Math.min(1, b * 0.8), 1)
      ps.colorDead = new Color4(r, g * 0.7, b * 0.5, 0)
    })
  }

  return {
    trigger: () => {
      // Main fountain burst
      mainBurst.emitRate = 600
      setTimeout(() => { mainBurst.emitRate = 300 }, 300)
      setTimeout(() => { mainBurst.emitRate = 0 }, 1000)

      // Side sprays with slight delay
      setTimeout(() => {
        leftSpray.emitRate = 250
        rightSpray.emitRate = 250
      }, 100)
      setTimeout(() => {
        leftSpray.emitRate = 0
        rightSpray.emitRate = 0
      }, 800)

      // Dripping effect
      setTimeout(() => {
        drips.emitRate = 250
      }, 300)
      setTimeout(() => {
        drips.emitRate = 0
      }, 1500)
    },

    setColor,

    dispose: () => {
      mainBurst.dispose()
      leftSpray.dispose()
      rightSpray.dispose()
      drips.dispose()
      particleTexture.dispose()
    },
  }
}
