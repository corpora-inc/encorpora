import {
  Color3,
  Color4,
  Mesh,
  ParticleSystem,
  PointLight,
  Scene,
  Texture,
  Vector3,
} from "@babylonjs/core"
import { scaleColor } from "../core/utils"

export const createPhraseSurfaceEffects = (scene: Scene, phrase: Mesh, baseColor: Color3) => {
  // Create particle system for surface electricity
  const surfaceParticles = new ParticleSystem(
    `phrase-surface-sparks-${phrase.name}`,
    400,
    scene
  )

  surfaceParticles.particleTexture = new Texture(
    "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMTYiIGN5PSIxNiIgcj0iMTAiIGZpbGw9IndoaXRlIi8+PC9zdmc+",
    scene
  )

  // Emit from entire phrase bounds for full coverage
  const bounds = phrase.getBoundingInfo()
  const extendSize = bounds.boundingBox.extendSize

  surfaceParticles.emitter = phrase
  surfaceParticles.minEmitBox = new Vector3(
    -extendSize.x * 1.1,
    -extendSize.y * 1.1,
    -0.1
  )
  surfaceParticles.maxEmitBox = new Vector3(
    extendSize.x * 1.1,
    extendSize.y * 1.1,
    0.1
  )

  // Electric crawling appearance
  surfaceParticles.color1 = new Color4(
    baseColor.r * 0.8,
    baseColor.g * 0.95,
    baseColor.b,
    1
  )
  surfaceParticles.color2 = new Color4(
    baseColor.r * 0.95,
    baseColor.g,
    baseColor.b,
    1
  )
  surfaceParticles.colorDead = new Color4(
    baseColor.r * 0.4,
    baseColor.g * 0.6,
    baseColor.b * 0.8,
    0
  )

  surfaceParticles.minSize = 0.05
  surfaceParticles.maxSize = 0.15
  surfaceParticles.minLifeTime = 0.4
  surfaceParticles.maxLifeTime = 0.9

  surfaceParticles.emitRate = 0 // Start at 0, will be controlled
  surfaceParticles.blendMode = ParticleSystem.BLENDMODE_ADD
  surfaceParticles.minEmitPower = 0.3
  surfaceParticles.maxEmitPower = 0.9
  surfaceParticles.updateSpeed = 0.01

  // Initial direction - will be animated to wrap around phrase
  surfaceParticles.direction1 = new Vector3(-1, -0.5, -0.2)
  surfaceParticles.direction2 = new Vector3(1, 0.5, 0.2)
  surfaceParticles.gravity = new Vector3(0, -0.3, 0)

  // Create burst particles for impact points
  const burstParticles = new ParticleSystem(
    `phrase-burst-sparks-${phrase.name}`,
    200,
    scene
  )

  burstParticles.particleTexture = new Texture(
    "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJhZGlhbEdyYWRpZW50IGlkPSJnIj48c3RvcCBvZmZzZXQ9IjAlIiBzdG9wLWNvbG9yPSJ3aGl0ZSIvPjxzdG9wIG9mZnNldD0iMTAwJSIgc3RvcC1jb2xvcj0id2hpdGUiIHN0b3Atb3BhY2l0eT0iMCIvPjwvcmFkaWFsR3JhZGllbnQ+PGNpcmNsZSBjeD0iMTYiIGN5PSIxNiIgcj0iMTQiIGZpbGw9InVybCgjZykiLz48L3N2Zz4=",
    scene
  )

  // Burst from edges and corners for plasma globe tendrils
  burstParticles.emitter = phrase
  burstParticles.minEmitBox = new Vector3(
    -extendSize.x * 1.0,
    -extendSize.y * 1.0,
    -0.05
  )
  burstParticles.maxEmitBox = new Vector3(
    extendSize.x * 1.0,
    extendSize.y * 1.0,
    0.05
  )

  burstParticles.color1 = new Color4(
    baseColor.r * 0.9,
    baseColor.g,
    baseColor.b,
    1
  )
  burstParticles.color2 = new Color4(
    baseColor.r * 0.7,
    baseColor.g * 0.9,
    baseColor.b,
    1
  )
  burstParticles.colorDead = new Color4(
    baseColor.r * 0.3,
    baseColor.g * 0.5,
    baseColor.b * 0.7,
    0
  )

  burstParticles.minSize = 0.06
  burstParticles.maxSize = 0.16
  burstParticles.minLifeTime = 0.2
  burstParticles.maxLifeTime = 0.4
  burstParticles.emitRate = 0
  burstParticles.blendMode = ParticleSystem.BLENDMODE_ADD
  burstParticles.minEmitPower = 0.8
  burstParticles.maxEmitPower = 1.6
  burstParticles.updateSpeed = 0.01

  // Explosive burst pattern
  burstParticles.direction1 = new Vector3(-1.5, -1.5, -1)
  burstParticles.direction2 = new Vector3(1.5, 1.5, 1)
  burstParticles.gravity = new Vector3(0, -2, 0)

  // Create point lights for phrase glow
  const phraseLights = Array.from({ length: 2 }, (_, index) => {
    const light = new PointLight(
      `phrase-light-${phrase.name}-${index}`,
      phrase.position.clone(),
      scene
    )
    light.intensity = 0
    light.range = 2
    light.diffuse = baseColor.clone()
    light.specular = scaleColor(baseColor, 1.3)
    light.parent = phrase
    return light
  })

  let time = 0

  const update = (dt: number, intensity: number) => {
    time += dt

    const isActive = intensity > 0.1

    // Control surface particles - create plasma globe wrapping effect
    if (isActive) {
      if (!surfaceParticles.isStarted()) {
        surfaceParticles.start()
      }

      // Massive increase in particles for full coverage
      surfaceParticles.emitRate = 120 + intensity * 280
      surfaceParticles.maxEmitPower = 0.8 + intensity * 1.2

      // Create multiple simultaneous flow patterns wrapping around phrase
      // Pattern 1: Circular wrapping (like plasma tendrils seeking the surface)
      const circleAngle = time * 2.5
      const circle1 = new Vector3(
        Math.cos(circleAngle) * 1.5,
        Math.sin(circleAngle) * 1.2,
        Math.sin(circleAngle * 1.3) * 0.4
      )
      const circle2 = new Vector3(
        Math.cos(circleAngle + Math.PI) * 1.5,
        Math.sin(circleAngle + Math.PI) * 1.2,
        Math.sin((circleAngle + Math.PI) * 1.3) * 0.4
      )

      // Pattern 2: Vertical waves (electricity dancing up/down)
      const wavePhase = time * 3
      const wave1 = new Vector3(
        Math.sin(wavePhase * 0.8) * 0.6,
        1.0 + Math.cos(wavePhase) * 0.4,
        0.2
      )
      const wave2 = new Vector3(
        Math.sin(wavePhase * 0.8 + Math.PI) * 0.6,
        -1.0 + Math.cos(wavePhase + Math.PI) * 0.4,
        0.2
      )

      // Combine patterns for complex wrapping motion
      surfaceParticles.direction1 = circle1.add(wave1).normalize().scale(1.5 + intensity)
      surfaceParticles.direction2 = circle2.add(wave2).normalize().scale(1.5 + intensity)

      // Add pulsing gravity for dynamic motion
      surfaceParticles.gravity = new Vector3(
        Math.sin(time * 4) * 0.3,
        -0.4 + Math.cos(time * 3) * 0.2,
        0
      )
    } else {
      if (surfaceParticles.isStarted()) {
        surfaceParticles.stop()
      }
    }

    // Control burst particles (kick in earlier for more coverage)
    if (intensity > 0.4) {
      if (!burstParticles.isStarted()) {
        burstParticles.start()
      }
      // Explosive bursts from all edges and corners
      burstParticles.emitRate = (intensity - 0.4) * 500
      burstParticles.maxEmitPower = 2.0 + (intensity - 0.4) * 3

      // Animate burst direction to create tendrils
      const burstAngle = time * 4
      burstParticles.direction1 = new Vector3(
        -2 + Math.cos(burstAngle) * 1.5,
        -2 + Math.sin(burstAngle * 1.2) * 1.5,
        -1
      )
      burstParticles.direction2 = new Vector3(
        2 + Math.cos(burstAngle + Math.PI) * 1.5,
        2 + Math.sin((burstAngle + Math.PI) * 1.2) * 1.5,
        1
      )
    } else {
      if (burstParticles.isStarted()) {
        burstParticles.stop()
      }
    }

    // Animate point lights with complex orbits around the phrase
    phraseLights.forEach((light, index) => {
      if (isActive) {
        // Create figure-8 orbit patterns that wrap around phrase
        const orbitAngle = time * (2.5 + index * 0.3) + index * Math.PI
        const figure8 = Math.sin(orbitAngle * 2) // Creates figure-8 shape

        const orbitRadius = (0.5 + Math.sin(time * 3 + index) * 0.3) * (1 + extendSize.length())
        light.position.x = Math.cos(orbitAngle) * orbitRadius * (1 + figure8 * 0.3)
        light.position.y = Math.sin(orbitAngle * 1.3) * orbitRadius * 0.8
        light.position.z = Math.sin(orbitAngle * 0.7) * 0.4 + figure8 * 0.2

        // Intense pulsing matched to electricity flow
        light.intensity = 0.6 + intensity * 1.2 + Math.sin(time * 6 + index * 2.5) * 0.3
        light.range = 2.5 + intensity * 1.5
      } else {
        light.intensity = 0
      }
    })
  }

  const dispose = () => {
    surfaceParticles.dispose()
    burstParticles.dispose()
    phraseLights.forEach((light) => light.dispose())
  }

  return { update, dispose }
}
