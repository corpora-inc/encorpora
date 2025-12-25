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

  surfaceParticles.emitter = phrase
  surfaceParticles.minEmitBox = new Vector3(-0.3, -0.3, -0.1)
  surfaceParticles.maxEmitBox = new Vector3(0.3, 0.3, 0.1)

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

  surfaceParticles.minSize = 0.04
  surfaceParticles.maxSize = 0.12
  surfaceParticles.minLifeTime = 0.3
  surfaceParticles.maxLifeTime = 0.7

  surfaceParticles.emitRate = 0 // Start at 0, will be controlled
  surfaceParticles.blendMode = ParticleSystem.BLENDMODE_ADD
  surfaceParticles.minEmitPower = 0.2
  surfaceParticles.maxEmitPower = 0.6
  surfaceParticles.updateSpeed = 0.01

  // Particles crawl along the surface
  surfaceParticles.direction1 = new Vector3(-1, -0.3, -0.2)
  surfaceParticles.direction2 = new Vector3(1, 0.3, 0.2)
  surfaceParticles.gravity = new Vector3(0, -0.5, 0)

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

  burstParticles.emitter = phrase
  burstParticles.minEmitBox = new Vector3(-0.2, -0.2, -0.05)
  burstParticles.maxEmitBox = new Vector3(0.2, 0.2, 0.05)

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

    // Control surface particles
    if (isActive) {
      if (!surfaceParticles.isStarted()) {
        surfaceParticles.start()
      }
      // Increase particles as connection strengthens
      surfaceParticles.emitRate = 60 + intensity * 180
      surfaceParticles.maxEmitPower = 0.6 + intensity * 0.8

      // Animate particle directions to create crawling effect
      const angle = time * 2
      surfaceParticles.direction1 = new Vector3(
        Math.cos(angle) * 1.2,
        Math.sin(angle * 0.7) * 0.5,
        Math.sin(angle * 0.5) * 0.3
      )
      surfaceParticles.direction2 = new Vector3(
        Math.cos(angle + Math.PI) * 1.2,
        Math.sin((angle + Math.PI) * 0.7) * 0.5,
        Math.sin((angle + Math.PI) * 0.5) * 0.3
      )
    } else {
      if (surfaceParticles.isStarted()) {
        surfaceParticles.stop()
      }
    }

    // Control burst particles (more intense when very close)
    if (intensity > 0.6) {
      if (!burstParticles.isStarted()) {
        burstParticles.start()
      }
      burstParticles.emitRate = (intensity - 0.6) * 300
      burstParticles.maxEmitPower = 1.6 + (intensity - 0.6) * 2
    } else {
      if (burstParticles.isStarted()) {
        burstParticles.stop()
      }
    }

    // Animate point lights around the phrase
    phraseLights.forEach((light, index) => {
      if (isActive) {
        // Orbit around the phrase
        const orbitAngle = time * 2 + index * Math.PI
        const orbitRadius = 0.4 + Math.sin(time * 3 + index) * 0.2
        light.position.x = Math.cos(orbitAngle) * orbitRadius
        light.position.y = Math.sin(orbitAngle * 0.8) * orbitRadius * 0.6
        light.position.z = Math.sin(orbitAngle) * 0.2

        light.intensity = 0.4 + intensity * 0.8 + Math.sin(time * 5 + index * 2) * 0.2
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
