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
  const impactCount = 80
  const microCount = 40
  // IMPACT SPARKS - focused particles at beam contact points
  // Reduced from 300 to 150 for performance
  const impactSparks = new ParticleSystem(
    `phrase-impact-sparks-${phrase.name}`,
    impactCount,
    scene
  )

  impactSparks.particleTexture = new Texture(
    "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMTYiIGN5PSIxNiIgcj0iOSIgZmlsbD0id2hpdGUiLz48L3N2Zz4=",
    scene
  )

  const bounds = phrase.getBoundingInfo()
  const extendSize = bounds.boundingBox.extendSize

  // Emit from center area where beam hits (not entire phrase)
  impactSparks.emitter = phrase
  impactSparks.minEmitBox = new Vector3(
    -extendSize.x * 0.3,
    -extendSize.y * 0.3,
    0.05
  )
  impactSparks.maxEmitBox = new Vector3(
    extendSize.x * 0.3,
    extendSize.y * 0.3,
    0.15
  )

  // Bright white-blue impact sparks
  impactSparks.color1 = new Color4(1, 1, 1, 1)
  impactSparks.color2 = new Color4(
    baseColor.r * 0.95,
    baseColor.g,
    baseColor.b,
    1
  )
  impactSparks.colorDead = new Color4(
    baseColor.r * 0.4,
    baseColor.g * 0.6,
    baseColor.b,
    0
  )

  impactSparks.minSize = 0.02
  impactSparks.maxSize = 0.06
  impactSparks.minLifeTime = 0.15
  impactSparks.maxLifeTime = 0.35

  impactSparks.emitRate = 0
  impactSparks.blendMode = ParticleSystem.BLENDMODE_ADD
  impactSparks.minEmitPower = 0.8
  impactSparks.maxEmitPower = 2.0
  impactSparks.updateSpeed = 0.012

  // Sparks fly outward from impact with gravity
  impactSparks.direction1 = new Vector3(-2, -1, -1.5)
  impactSparks.direction2 = new Vector3(2, 1, 1.5)
  impactSparks.gravity = new Vector3(0, -3, 0)

  // MICRO SPARKS - tiny bright flashes at exact contact points
  // Reduced from 150 to 75 for performance
  const microSparks = new ParticleSystem(
    `phrase-micro-sparks-${phrase.name}`,
    microCount,
    scene
  )

  microSparks.particleTexture = new Texture(
    "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMTYiIGN5PSIxNiIgcj0iMTIiIGZpbGw9IndoaXRlIi8+PC9zdmc+",
    scene
  )

  microSparks.emitter = phrase
  microSparks.minEmitBox = new Vector3(
    -extendSize.x * 0.4,
    -extendSize.y * 0.4,
    0.08
  )
  microSparks.maxEmitBox = new Vector3(
    extendSize.x * 0.4,
    extendSize.y * 0.4,
    0.12
  )

  microSparks.color1 = new Color4(1, 1, 1, 1)
  microSparks.color2 = new Color4(0.9, 0.95, 1, 1)
  microSparks.colorDead = new Color4(
    baseColor.r * 0.5,
    baseColor.g * 0.7,
    baseColor.b,
    0
  )

  microSparks.minSize = 0.015
  microSparks.maxSize = 0.04
  microSparks.minLifeTime = 0.08
  microSparks.maxLifeTime = 0.2
  microSparks.emitRate = 0
  microSparks.blendMode = ParticleSystem.BLENDMODE_ADD
  microSparks.minEmitPower = 0.3
  microSparks.maxEmitPower = 1.0
  microSparks.updateSpeed = 0.015

  // Quick radial burst
  microSparks.direction1 = new Vector3(-1.5, -0.8, -1)
  microSparks.direction2 = new Vector3(1.5, 0.8, 1)
  microSparks.gravity = new Vector3(0, -1.5, 0)

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

    const isActive = intensity > 0.3

    // IMPACT SPARKS - physics-based sparks at beam contact
    if (isActive) {
      if (!impactSparks.isStarted()) {
        impactSparks.start()
      }

      // Scale with intensity - reduced for cleaner look
      const sparkIntensity = Math.pow(intensity, 1.5)
      impactSparks.emitRate = 25 + sparkIntensity * 60
      impactSparks.maxEmitPower = 1.0 + sparkIntensity * 1.2

      // Vary direction slightly for natural look
      const dirAngle = time * 5
      const dirVar = Math.sin(dirAngle) * 0.3
      impactSparks.direction1 = new Vector3(
        -2 + dirVar,
        -1 + Math.cos(dirAngle * 1.3) * 0.4,
        -1.5
      )
      impactSparks.direction2 = new Vector3(
        2 + dirVar,
        1 + Math.cos(dirAngle * 1.3) * 0.4,
        1.5
      )
    } else {
      if (impactSparks.isStarted()) {
        impactSparks.stop()
      }
    }

    // MICRO SPARKS - rapid flickers at high intensity
    if (intensity > 0.7) {
      if (!microSparks.isStarted()) {
        microSparks.start()
      }

      // Quick bursts - reduced for cleaner readability
      const microIntensity = (intensity - 0.7) / 0.3
      microSparks.emitRate = 40 + microIntensity * 80
      microSparks.maxEmitPower = 0.5 + microIntensity * 0.8

      // Radial burst with slight rotation
      const microAngle = time * 8
      const radialVar = Math.cos(microAngle) * 0.5
      microSparks.direction1 = new Vector3(
        -1.5 + radialVar,
        -0.8,
        -1
      )
      microSparks.direction2 = new Vector3(
        1.5 + radialVar,
        0.8,
        1
      )
    } else {
      if (microSparks.isStarted()) {
        microSparks.stop()
      }
    }

    // Subtle lighting enhancement at impact points - reduced for readability
    phraseLights.forEach((light, index) => {
      if (isActive) {
        // Position near phrase center where beam hits
        const lightAngle = time * (2 + index * 0.3) + index * Math.PI
        const lightRadius = 0.25 + Math.sin(time * 3 + index) * 0.1

        light.position.x = Math.cos(lightAngle) * lightRadius * extendSize.x
        light.position.y = Math.sin(lightAngle * 1.2) * lightRadius * extendSize.y
        light.position.z = 0.15 + Math.sin(time * 4) * 0.03

        // Reduced flicker for cleaner appearance
        const flicker = Math.sin(time * 8 + index * 3) * 0.06
        light.intensity = 0.2 + intensity * 0.4 + flicker
        light.range = 1.4 + intensity * 0.6
      } else {
        light.intensity = 0
      }
    })
  }

  const dispose = () => {
    impactSparks.dispose()
    microSparks.dispose()
    phraseLights.forEach((light) => light.dispose())
  }

  return { update, dispose }
}
