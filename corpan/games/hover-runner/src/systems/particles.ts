import { Color4, ParticleSystem, Scene, Vector3 } from "@babylonjs/core"

export const createSuccessParticles = (scene: Scene, position: Vector3) => {
  const particleSystem = new ParticleSystem("successParticles", 100, scene)

  particleSystem.createSphereEmitter(0.2)

  particleSystem.color1 = new Color4(1, 0.7, 0, 1)
  particleSystem.color2 = new Color4(1, 0.5, 0, 1)
  particleSystem.colorDead = new Color4(1, 0.3, 0, 0)

  particleSystem.minSize = 0.05
  particleSystem.maxSize = 0.15

  particleSystem.minLifeTime = 0.5
  particleSystem.maxLifeTime = 1.0

  particleSystem.emitRate = 1000
  particleSystem.manualEmitCount = 100

  particleSystem.minEmitPower = 2
  particleSystem.maxEmitPower = 4
  particleSystem.updateSpeed = 0.01

  particleSystem.gravity = new Vector3(0, -2, 0)

  particleSystem.emitter = position.clone()

  particleSystem.start()

  setTimeout(() => {
    particleSystem.stop()
    particleSystem.dispose()
  }, 1000)
}

export const createFailParticles = (scene: Scene, position: Vector3) => {
  const particleSystem = new ParticleSystem("failParticles", 80, scene)

  particleSystem.createSphereEmitter(0.2)

  particleSystem.color1 = new Color4(0.6, 0, 0, 1)
  particleSystem.color2 = new Color4(0.4, 0, 0, 1)
  particleSystem.colorDead = new Color4(0.2, 0, 0, 0)

  particleSystem.minSize = 0.04
  particleSystem.maxSize = 0.12

  particleSystem.minLifeTime = 0.4
  particleSystem.maxLifeTime = 0.8

  particleSystem.emitRate = 800
  particleSystem.manualEmitCount = 80

  particleSystem.minEmitPower = 1
  particleSystem.maxEmitPower = 2
  particleSystem.updateSpeed = 0.01

  particleSystem.gravity = new Vector3(0, -5, 0)

  particleSystem.direction1 = new Vector3(-1, -2, -1)
  particleSystem.direction2 = new Vector3(1, -1, 1)

  particleSystem.emitter = position.clone()

  particleSystem.start()

  setTimeout(() => {
    particleSystem.stop()
    particleSystem.dispose()
  }, 1000)
}

export const createScreenShake = () => {
  const shakeOffset = new Vector3(0, 0, 0)
  let shakeActive = false

  const trigger = () => {
    if (shakeActive) return
    shakeActive = true

    const startTime = performance.now()
    const duration = 200
    const intensity = 0.03

    const shakeInterval = setInterval(() => {
      const elapsed = performance.now() - startTime
      if (elapsed >= duration) {
        clearInterval(shakeInterval)
        shakeOffset.set(0, 0, 0)
        shakeActive = false
        return
      }

      const decay = 1 - elapsed / duration
      const amount = intensity * decay

      shakeOffset.x = (Math.random() - 0.5) * amount * 2
      shakeOffset.y = (Math.random() - 0.5) * amount * 2
      shakeOffset.z = (Math.random() - 0.5) * amount
    }, 16)
  }

  return { shakeOffset, trigger }
}
