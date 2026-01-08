import { Color4, ParticleSystem, Scene, Texture, Vector3 } from "@babylonjs/core"

// Track all active particle timeouts for cleanup
const activeParticleTimeouts = new Set<number>()

// Simple working particle texture - solid circle
const createParticleTexture = (scene: Scene) =>
  new Texture(
    "data:image/svg+xml;base64," +
      btoa(
        `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32">` +
          `<circle cx="16" cy="16" r="14" fill="white"/>` +
        `</svg>`
      ),
    scene
  )

export const createSuccessParticles = (scene: Scene, position: Vector3) => {
  const particleSystem = new ParticleSystem("successParticles", 100, scene)

  particleSystem.createSphereEmitter(0.2)
  particleSystem.particleTexture = createParticleTexture(scene)

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

  const timeoutId = window.setTimeout(() => {
    activeParticleTimeouts.delete(timeoutId)
    if (!scene.isDisposed) {
      particleSystem.stop()
      particleSystem.dispose()
    }
  }, 1000)
  activeParticleTimeouts.add(timeoutId)
}

export const clearAllParticleTimeouts = () => {
  activeParticleTimeouts.forEach((id) => window.clearTimeout(id))
  activeParticleTimeouts.clear()
}

export const createFailParticles = (scene: Scene, position: Vector3) => {
  const particleSystem = new ParticleSystem("failParticles", 80, scene)

  particleSystem.createSphereEmitter(0.2)
  particleSystem.particleTexture = createParticleTexture(scene)

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

  const timeoutId = window.setTimeout(() => {
    activeParticleTimeouts.delete(timeoutId)
    if (!scene.isDisposed) {
      particleSystem.stop()
      particleSystem.dispose()
    }
  }, 1000)
  activeParticleTimeouts.add(timeoutId)
}

export const createScreenShake = () => {
  const shakeOffset = new Vector3(0, 0, 0)
  let shakeActive = false

  const trigger = () => {
    if (shakeActive) return
    shakeActive = true

    const startTime = performance.now()
    const duration = 260
    const intensity = 0.08

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

// Continuous avatar aura particles that orbit around the player
export const createAvatarAura = (
  scene: Scene,
  emitterPosition: Vector3,
  particleCount: number,
  intensity: number
): ParticleSystem | null => {
  if (particleCount <= 0) return null

  const particleSystem = new ParticleSystem("avatarAura", particleCount, scene)

  // Emit from a tight sphere around the electricity (electron cloud effect)
  particleSystem.createSphereEmitter(0.3)
  particleSystem.particleTexture = createParticleTexture(scene)

  // Clay/orange/gold color palette matching avatar
  particleSystem.color1 = new Color4(0.835, 0.416, 0.102, 0.8 * intensity)
  particleSystem.color2 = new Color4(1.0, 0.7, 0.3, 0.6 * intensity)
  particleSystem.colorDead = new Color4(1.0, 0.5, 0.1, 0)

  // Small, sparkly particles
  particleSystem.minSize = 0.015 * intensity
  particleSystem.maxSize = 0.04 * intensity

  // Shorter lifetime for performance
  particleSystem.minLifeTime = 0.8
  particleSystem.maxLifeTime = 1.5

  // Reduced emission rate for performance
  particleSystem.emitRate = particleCount * 0.3

  // Gentle, swirling motion around electricity
  particleSystem.minEmitPower = 0.3
  particleSystem.maxEmitPower = 0.8
  particleSystem.updateSpeed = 0.016

  // Very light upward drift
  particleSystem.gravity = new Vector3(0, 0.3, 0)

  // Swirl directions
  particleSystem.direction1 = new Vector3(-1, 0.5, -1)
  particleSystem.direction2 = new Vector3(1, 1, 1)

  particleSystem.emitter = emitterPosition

  particleSystem.start()

  return particleSystem
}

// Update avatar aura intensity and position
export const updateAvatarAura = (
  particleSystem: ParticleSystem | null,
  position: Vector3,
  particleCount: number,
  intensity: number
) => {
  if (!particleSystem) return

  particleSystem.emitter = position.clone()
  particleSystem.emitRate = particleCount * 0.3 // Match creation rate

  // Update colors based on intensity
  particleSystem.color1 = new Color4(0.835, 0.416, 0.102, 0.8 * intensity)
  particleSystem.color2 = new Color4(1.0, 0.7, 0.3, 0.6 * intensity)

  // Update sizes (smaller for performance)
  particleSystem.minSize = 0.015 * intensity
  particleSystem.maxSize = 0.04 * intensity
}

// ============================================================================
// BACKGROUND PARTICLE SYSTEMS
// These create atmospheric effects in the scene
// ============================================================================

// Ambient cosmic dust - spawns around the play area (subtle background effect)
export const createAmbientParticles = (
  scene: Scene,
  _cameraPosition: Vector3
): ParticleSystem => {
  const particleSystem = new ParticleSystem("ambientDust", 60, scene)  // Reduced from 150

  // Spawn in a box around the play area (close to camera)
  particleSystem.createBoxEmitter(
    new Vector3(-0.5, -0.5, -0.5),  // random drift directions
    new Vector3(0.5, 0.5, 0.5),
    new Vector3(-8, -5, -2),        // spawn around the play area
    new Vector3(8, 5, 25)
  )
  particleSystem.particleTexture = createParticleTexture(scene)

  // Subtle, softer particles
  particleSystem.color1 = new Color4(0.8, 0.9, 1.0, 0.4)   // Reduced alpha
  particleSystem.color2 = new Color4(1.0, 1.0, 1.0, 0.3)
  particleSystem.colorDead = new Color4(0.7, 0.85, 1.0, 0)

  // Smaller sizes for subtlety
  particleSystem.minSize = 0.03
  particleSystem.maxSize = 0.08

  particleSystem.minLifeTime = 2.0
  particleSystem.maxLifeTime = 4.0

  particleSystem.emitRate = 8  // Reduced from 20

  // Gentle drift
  particleSystem.minEmitPower = 0.5
  particleSystem.maxEmitPower = 2.0
  particleSystem.updateSpeed = 0.016

  particleSystem.gravity = new Vector3(0, 0.1, 0)

  particleSystem.blendMode = ParticleSystem.BLENDMODE_ADD

  // Emitter near the action
  particleSystem.emitter = new Vector3(0, 0, 10)

  particleSystem.start()

  return particleSystem
}

// Starfield - subtle points streaming toward camera
export const createStarfieldParticles = (
  scene: Scene,
  _cameraPosition: Vector3
): ParticleSystem => {
  const particleSystem = new ParticleSystem("starfield", 40, scene)  // Reduced from 80

  // Spawn ahead, travel toward camera
  particleSystem.createBoxEmitter(
    new Vector3(-0.1, -0.1, -1),  // direction - toward camera
    new Vector3(0.1, 0.1, -1),
    new Vector3(-10, -5, 0),      // spawn box (relative to emitter)
    new Vector3(10, 5, 20)
  )

  particleSystem.particleTexture = createParticleTexture(scene)

  // Subtle white stars
  particleSystem.color1 = new Color4(1.0, 1.0, 1.0, 0.5)   // Reduced alpha
  particleSystem.color2 = new Color4(0.9, 0.95, 1.0, 0.4)
  particleSystem.colorDead = new Color4(1.0, 1.0, 1.0, 0)

  // Smaller sizes
  particleSystem.minSize = 0.02
  particleSystem.maxSize = 0.06

  particleSystem.minLifeTime = 1.0
  particleSystem.maxLifeTime = 2.0

  particleSystem.emitRate = 10  // Reduced from 25

  // Fast toward camera
  particleSystem.minEmitPower = 15
  particleSystem.maxEmitPower = 30
  particleSystem.updateSpeed = 0.016

  particleSystem.gravity = new Vector3(0, 0, 0)

  particleSystem.blendMode = ParticleSystem.BLENDMODE_ADD

  // Emitter closer - at z=30 instead of z=60
  particleSystem.emitter = new Vector3(0, 0, 30)

  particleSystem.start()

  return particleSystem
}

// Energy field particles along road edges - subtle rising energy wisps
export const createEnergyFieldParticles = (
  scene: Scene,
  side: "left" | "right"
): ParticleSystem => {
  const particleSystem = new ParticleSystem(`energyField-${side}`, 30, scene)  // Reduced from 80

  const xOffset = side === "left" ? -4.5 : 4.5

  // Simple box along the road edge
  particleSystem.createBoxEmitter(
    new Vector3(-0.2, 0.8, -0.3),  // direction - mostly up with slight inward
    new Vector3(0.2, 1.2, 0.3),
    new Vector3(-0.5, 0, -5),
    new Vector3(0.5, 0.5, 40)
  )

  particleSystem.particleTexture = createParticleTexture(scene)

  // Subtle cyan/electric blue
  particleSystem.color1 = new Color4(0.3, 0.9, 1.0, 0.4)   // Reduced alpha
  particleSystem.color2 = new Color4(0.5, 0.7, 1.0, 0.3)
  particleSystem.colorDead = new Color4(0.4, 0.8, 1.0, 0)

  // Smaller sizes
  particleSystem.minSize = 0.03
  particleSystem.maxSize = 0.08

  particleSystem.minLifeTime = 1.2
  particleSystem.maxLifeTime = 2.5

  particleSystem.emitRate = 8  // Reduced from 25

  // Rising motion
  particleSystem.minEmitPower = 1.5
  particleSystem.maxEmitPower = 3.5
  particleSystem.updateSpeed = 0.016

  // Slight upward gravity for energy feel
  particleSystem.gravity = new Vector3(0, 0.5, 0)

  particleSystem.blendMode = ParticleSystem.BLENDMODE_ADD

  // Position along road edge at road Y level
  particleSystem.emitter = new Vector3(xOffset, -3.5, 20)

  particleSystem.start()

  return particleSystem
}

// Speed lines - subtle fast streaks for velocity feel
export const createSpeedLines = (
  scene: Scene,
  _cameraPosition: Vector3
): ParticleSystem => {
  const particleSystem = new ParticleSystem("speedLines", 25, scene)  // Reduced from 60

  // Emit from sides of view, streak toward camera
  particleSystem.createBoxEmitter(
    new Vector3(0, 0, -1),     // direction - toward camera
    new Vector3(0, 0, -1),
    new Vector3(-8, -4, 0),    // spawn box closer
    new Vector3(8, 3, 15)
  )

  particleSystem.particleTexture = createParticleTexture(scene)

  // Subtle white
  particleSystem.color1 = new Color4(1.0, 1.0, 1.0, 0.5)   // Reduced alpha
  particleSystem.color2 = new Color4(0.9, 0.95, 1.0, 0.35)
  particleSystem.colorDead = new Color4(1.0, 1.0, 1.0, 0)

  // Smaller size
  particleSystem.minSize = 0.02
  particleSystem.maxSize = 0.05

  // Short lifetime
  particleSystem.minLifeTime = 0.15
  particleSystem.maxLifeTime = 0.4

  particleSystem.emitRate = 12  // Reduced from 30

  // Fast toward camera
  particleSystem.minEmitPower = 40
  particleSystem.maxEmitPower = 70
  particleSystem.updateSpeed = 0.016

  particleSystem.gravity = new Vector3(0, 0, 0)

  particleSystem.blendMode = ParticleSystem.BLENDMODE_ADD

  // Stretch particles along velocity
  particleSystem.billboardMode = ParticleSystem.BILLBOARDMODE_STRETCHED
  particleSystem.minScaleY = 8
  particleSystem.maxScaleY = 18

  // Emitter closer - at z=25
  particleSystem.emitter = new Vector3(0, 0, 25)

  particleSystem.start()

  return particleSystem
}

// Update speed lines intensity based on game speed (kept subtle)
export const updateSpeedLines = (
  particleSystem: ParticleSystem,
  speedMultiplier: number
) => {
  particleSystem.emitRate = 10 + speedMultiplier * 10  // Reduced base and multiplier
  particleSystem.minEmitPower = 40 + speedMultiplier * 20
  particleSystem.maxEmitPower = 70 + speedMultiplier * 30
}
