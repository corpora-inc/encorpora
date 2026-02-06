/**
 * 3D Juice Bottle Module - Adapted for React integration
 */

import {
  Color3,
  Color4,
  Mesh,
  MeshBuilder,
  Scene,
  StandardMaterial,
  Vector3,
  ParticleSystem,
  RawTexture,
  FresnelParameters,
} from "@babylonjs/core"
import { type FruitDef, LEVEL_FRUIT_COLORS, type CEFRLevel } from "../utils/colors"

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

export type Bottle3D = {
  updateFill: (level: number) => void
  setColor: (fruitOrLevel: FruitDef | CEFRLevel) => void
  triggerSqueeze: () => void
  triggerOverflow: () => void
  reset: () => void
  updateLayout: (worldWidth: number, worldHeight: number) => void
  dispose: () => void
}

const hexToColor3 = (hex: string): Color3 => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (result) {
    return new Color3(
      parseInt(result[1], 16) / 255,
      parseInt(result[2], 16) / 255,
      parseInt(result[3], 16) / 255
    )
  }
  return new Color3(1, 0.6, 0)
}

export const createBottle3D = (scene: Scene, initialLevel: CEFRLevel = "A0"): Bottle3D => {
  const levelColors = LEVEL_FRUIT_COLORS[initialLevel]
  let currentColor = hexToColor3(levelColors.primary)
  let currentFillLevel = 0

  const bottleContainer = new Mesh("bottle-container", scene)
  bottleContainer.position = new Vector3(0, 0, 5)

  // Bottle profile
  const bottleProfile = [
    new Vector3(0, 0, 0),
    new Vector3(1.8, 0, 0),
    new Vector3(2.0, 0.3, 0),
    new Vector3(2.1, 1.0, 0),
    new Vector3(2.1, 4.5, 0),
    new Vector3(2.0, 5.0, 0),
    new Vector3(1.5, 5.5, 0),
    new Vector3(1.0, 5.8, 0),
    new Vector3(0.9, 6.0, 0),
    new Vector3(0.9, 7.0, 0),
    new Vector3(1.1, 7.2, 0),
    new Vector3(1.1, 7.4, 0),
    new Vector3(0.9, 7.4, 0),
  ]

  const bottleMesh = MeshBuilder.CreateLathe(
    "bottle",
    { shape: bottleProfile, radius: 1, tessellation: 32, sideOrientation: Mesh.DOUBLESIDE },
    scene
  )

  // Glass material
  const glassMaterial = new StandardMaterial("glass-material", scene)
  glassMaterial.diffuseColor = new Color3(0.85, 0.92, 1.0)
  glassMaterial.specularColor = new Color3(1, 1, 1)
  glassMaterial.specularPower = 256
  glassMaterial.alpha = 0.3
  glassMaterial.backFaceCulling = false

  glassMaterial.emissiveFresnelParameters = new FresnelParameters()
  glassMaterial.emissiveFresnelParameters.bias = 0.2
  glassMaterial.emissiveFresnelParameters.power = 2
  glassMaterial.emissiveFresnelParameters.leftColor = new Color3(0.8, 0.9, 1.0)
  glassMaterial.emissiveFresnelParameters.rightColor = Color3.Black()

  glassMaterial.opacityFresnelParameters = new FresnelParameters()
  glassMaterial.opacityFresnelParameters.bias = 0.1
  glassMaterial.opacityFresnelParameters.power = 1.5
  glassMaterial.opacityFresnelParameters.leftColor = Color3.White()
  glassMaterial.opacityFresnelParameters.rightColor = new Color3(0.3, 0.3, 0.3)

  bottleMesh.material = glassMaterial
  bottleMesh.isPickable = false
  bottleMesh.parent = bottleContainer

  // Liquid material
  const liquidMaterial = new StandardMaterial("liquid-material", scene)
  liquidMaterial.diffuseColor = currentColor
  liquidMaterial.emissiveColor = currentColor.scale(0.4)
  liquidMaterial.specularColor = new Color3(1, 1, 1)
  liquidMaterial.specularPower = 96
  liquidMaterial.alpha = 0.72
  liquidMaterial.backFaceCulling = false
  liquidMaterial.needDepthPrePass = true

  liquidMaterial.emissiveFresnelParameters = new FresnelParameters()
  liquidMaterial.emissiveFresnelParameters.bias = 0.4
  liquidMaterial.emissiveFresnelParameters.power = 2
  liquidMaterial.emissiveFresnelParameters.leftColor = currentColor.scale(0.5)
  liquidMaterial.emissiveFresnelParameters.rightColor = Color3.Black()

  const maxLiquidHeight = 4.4
  const liquidProfile = [
    new Vector3(0, 0, 0),
    new Vector3(1.65, 0, 0),
    new Vector3(1.85, 0.25, 0),
    new Vector3(1.95, 0.9, 0),
    new Vector3(1.95, maxLiquidHeight, 0),
  ]

  const liquidMesh = MeshBuilder.CreateLathe(
    "liquid",
    { shape: liquidProfile, radius: 1, tessellation: 32, sideOrientation: Mesh.DOUBLESIDE },
    scene
  )
  liquidMesh.material = liquidMaterial
  liquidMesh.parent = bottleContainer
  liquidMesh.isPickable = false
  liquidMesh.position.y = 0.15
  liquidMesh.scaling.y = 0.001
  liquidMesh.isVisible = false

  // Liquid cap
  const liquidCapMesh = MeshBuilder.CreateDisc("liquid-cap", { radius: 1.95, tessellation: 48 }, scene)
  liquidCapMesh.rotation.x = Math.PI / 2
  liquidCapMesh.position.y = 0.15
  liquidCapMesh.material = liquidMaterial
  liquidCapMesh.parent = bottleContainer
  liquidCapMesh.isPickable = false
  liquidCapMesh.isVisible = false

  // Sloshing animation
  let sloshPhase = 0
  let sloshIntensity = 0
  let originalLayoutScale = new Vector3(1, 1, 1)
  let originalLayoutY = 0

  // Create particle texture programmatically (radial gradient circle)
  const particleTexture = createParticleTexture(scene)

  // Squeeze particles - juice spray from top
  const squeezeParticles = new ParticleSystem("squeeze-particles", 500, scene)
  squeezeParticles.particleTexture = particleTexture
  squeezeParticles.billboardMode = ParticleSystem.BILLBOARDMODE_ALL
  squeezeParticles.blendMode = ParticleSystem.BLENDMODE_STANDARD
  squeezeParticles.emitter = new Vector3(0, 7.5, 5)
  squeezeParticles.minEmitBox = new Vector3(-0.5, 0, -0.5)
  squeezeParticles.maxEmitBox = new Vector3(0.5, 0.3, 0.5)
  squeezeParticles.color1 = new Color4(currentColor.r, currentColor.g, currentColor.b, 1)
  squeezeParticles.color2 = new Color4(currentColor.r * 1.2, currentColor.g * 1.2, currentColor.b, 1)
  squeezeParticles.colorDead = new Color4(currentColor.r, currentColor.g, currentColor.b, 0)
  squeezeParticles.minSize = 0.3
  squeezeParticles.maxSize = 1.0
  squeezeParticles.minLifeTime = 0.5
  squeezeParticles.maxLifeTime = 1.2
  squeezeParticles.emitRate = 0
  squeezeParticles.gravity = new Vector3(0, -10, 0)
  squeezeParticles.direction1 = new Vector3(-1.5, 3, -1.5)
  squeezeParticles.direction2 = new Vector3(1.5, 6, 1.5)
  squeezeParticles.minEmitPower = 5
  squeezeParticles.maxEmitPower = 12
  squeezeParticles.updateSpeed = 0.01
  squeezeParticles.start()

  // Overflow particles - bigger burst when bottle is full
  const overflowParticles = new ParticleSystem("overflow-particles", 600, scene)
  overflowParticles.particleTexture = particleTexture
  overflowParticles.billboardMode = ParticleSystem.BILLBOARDMODE_ALL
  overflowParticles.blendMode = ParticleSystem.BLENDMODE_STANDARD
  overflowParticles.emitter = new Vector3(0, 7.3, 5)
  overflowParticles.minEmitBox = new Vector3(-1.0, 0, -0.5)
  overflowParticles.maxEmitBox = new Vector3(1.0, 0.5, 0.5)
  overflowParticles.color1 = new Color4(currentColor.r, currentColor.g, currentColor.b, 1)
  overflowParticles.color2 = new Color4(currentColor.r * 1.2, currentColor.g * 1.2, currentColor.b, 1)
  overflowParticles.colorDead = new Color4(currentColor.r, currentColor.g, currentColor.b, 0)
  overflowParticles.minSize = 0.4
  overflowParticles.maxSize = 1.2
  overflowParticles.minLifeTime = 0.8
  overflowParticles.maxLifeTime = 2.0
  overflowParticles.emitRate = 0
  overflowParticles.gravity = new Vector3(0, -6, 0)
  overflowParticles.direction1 = new Vector3(-3, 4, -2)
  overflowParticles.direction2 = new Vector3(3, 8, 2)
  overflowParticles.minEmitPower = 6
  overflowParticles.maxEmitPower = 14
  overflowParticles.updateSpeed = 0.01
  overflowParticles.start()

  // Splash particles - internal splash when juice rises
  const splashParticles = new ParticleSystem("splash-particles", 200, scene)
  splashParticles.particleTexture = particleTexture
  splashParticles.billboardMode = ParticleSystem.BILLBOARDMODE_ALL
  splashParticles.blendMode = ParticleSystem.BLENDMODE_STANDARD
  splashParticles.emitter = new Vector3(0, 2, 5)
  splashParticles.minEmitBox = new Vector3(-1.2, 0, -1.2)
  splashParticles.maxEmitBox = new Vector3(1.2, 0, 1.2)
  splashParticles.color1 = new Color4(currentColor.r, currentColor.g, currentColor.b, 1)
  splashParticles.color2 = new Color4(currentColor.r * 1.1, currentColor.g * 1.1, currentColor.b * 1.05, 1)
  splashParticles.colorDead = new Color4(currentColor.r, currentColor.g, currentColor.b, 0)
  splashParticles.minSize = 0.2
  splashParticles.maxSize = 0.6
  splashParticles.minLifeTime = 0.2
  splashParticles.maxLifeTime = 0.7
  splashParticles.emitRate = 0
  splashParticles.gravity = new Vector3(0, -12, 0)
  splashParticles.direction1 = new Vector3(-0.8, 1.5, -0.8)
  splashParticles.direction2 = new Vector3(0.8, 3, 0.8)
  splashParticles.minEmitPower = 4
  splashParticles.maxEmitPower = 8
  splashParticles.updateSpeed = 0.01
  splashParticles.start()

  // Animation loop
  scene.registerBeforeRender(() => {
    sloshIntensity *= 0.97
    sloshPhase += 0.08

    if (currentFillLevel > 0.01) {
      const liquidHeight = currentFillLevel * maxLiquidHeight
      const baseY = 0.15 + liquidHeight
      const ambientWave = Math.sin(sloshPhase) * 0.02 + Math.sin(sloshPhase * 1.7) * 0.01
      const sloshWave = Math.sin(sloshPhase * 2) * sloshIntensity * 0.15

      liquidCapMesh.position.y = baseY + ambientWave + sloshWave
      liquidCapMesh.rotation.x = Math.PI / 2 + Math.sin(sloshPhase * 0.8) * sloshIntensity * 0.08
      liquidCapMesh.rotation.z = Math.sin(sloshPhase * 0.5) * sloshIntensity * 0.06
    }
  })

  // Smooth fill animation
  let targetFillLevel = 0
  let fillAnimating = false

  const animateFill = () => {
    if (!fillAnimating) return

    const diff = targetFillLevel - currentFillLevel
    if (Math.abs(diff) < 0.001) {
      currentFillLevel = targetFillLevel
      fillAnimating = false
    } else {
      currentFillLevel += diff * 0.06
    }

    const hasLiquid = currentFillLevel > 0.01
    liquidMesh.isVisible = hasLiquid
    liquidCapMesh.isVisible = hasLiquid

    const scaleY = Math.max(0.001, currentFillLevel)
    liquidMesh.scaling.y = scaleY
    liquidMesh.position.y = 0.15

    const liquidHeight = Math.max(0.01, currentFillLevel * maxLiquidHeight)
    liquidCapMesh.position.y = 0.15 + liquidHeight

    const capScale = currentFillLevel < 0.2 ? 0.8 + currentFillLevel * 1.0 : 1.0
    liquidCapMesh.scaling.x = capScale
    liquidCapMesh.scaling.z = capScale

    if (fillAnimating) {
      requestAnimationFrame(animateFill)
    }
  }

  return {
    updateFill: (level: number) => {
      targetFillLevel = Math.max(0, Math.min(1, level))
      if (!fillAnimating) {
        fillAnimating = true
        animateFill()
      }
    },

    setColor: (fruitOrLevel: FruitDef | CEFRLevel) => {
      const fruitColors = typeof fruitOrLevel === "string" ? LEVEL_FRUIT_COLORS[fruitOrLevel] : fruitOrLevel
      currentColor = hexToColor3(fruitColors.primary)

      liquidMaterial.diffuseColor = currentColor
      liquidMaterial.emissiveColor = currentColor.scale(0.35)
      if (liquidMaterial.emissiveFresnelParameters) {
        liquidMaterial.emissiveFresnelParameters.leftColor = currentColor.scale(0.5)
      }

      // Update all particle systems with new color
      const allParticles = [squeezeParticles, overflowParticles, splashParticles]
      allParticles.forEach((ps) => {
        ps.color1 = new Color4(currentColor.r, currentColor.g, currentColor.b, 1)
        ps.color2 = new Color4(currentColor.r * 1.2, currentColor.g * 1.2, currentColor.b, 1)
        ps.colorDead = new Color4(currentColor.r, currentColor.g, currentColor.b, 0)
      })
    },

    triggerSqueeze: () => {
      // Juice spray burst
      squeezeParticles.emitRate = 400
      setTimeout(() => { squeezeParticles.emitRate = 150 }, 200)
      setTimeout(() => { squeezeParticles.emitRate = 0 }, 500)

      sloshIntensity = 1.2

      // Internal splash
      const liquidHeight = currentFillLevel * maxLiquidHeight
      const splashY = 0.15 + liquidHeight + originalLayoutY
      splashParticles.emitter = new Vector3(0, splashY * (originalLayoutScale?.y || 1), 5)

      setTimeout(() => {
        splashParticles.emitRate = 250
        setTimeout(() => { splashParticles.emitRate = 0 }, 350)
      }, 150)
    },

    triggerOverflow: () => {
      // Big juice explosion!
      overflowParticles.emitRate = 500
      setTimeout(() => { overflowParticles.emitRate = 200 }, 400)
      setTimeout(() => { overflowParticles.emitRate = 0 }, 1200)

      sloshIntensity = 1.5
    },

    reset: () => {
      currentFillLevel = 0
      targetFillLevel = 0
      fillAnimating = false

      liquidMesh.scaling.y = 0.001
      liquidMesh.position.y = 0.15
      liquidMesh.isVisible = false
      liquidCapMesh.position.y = 0.15
      liquidCapMesh.scaling.x = 0.8
      liquidCapMesh.scaling.z = 0.8
      liquidCapMesh.rotation.x = Math.PI / 2
      liquidCapMesh.rotation.z = 0
      liquidCapMesh.isVisible = false

      if (glassMaterial) {
        glassMaterial.alpha = 0.25
      }

      sloshIntensity = 0

      bottleContainer.scaling = originalLayoutScale.clone()
      bottleContainer.position.x = 0
      bottleContainer.position.y = originalLayoutY
    },

    updateLayout: (_worldWidth: number, worldHeight: number) => {
      const targetHeight = worldHeight * 1.2
      const bottleNaturalHeight = 7.4
      const scale = targetHeight / bottleNaturalHeight

      originalLayoutScale = new Vector3(scale, scale, scale)
      originalLayoutY = -worldHeight * 0.2

      bottleContainer.scaling = originalLayoutScale.clone()
      bottleContainer.position.y = originalLayoutY
    },

    dispose: () => {
      squeezeParticles.dispose()
      overflowParticles.dispose()
      splashParticles.dispose()
      particleTexture.dispose()
      liquidCapMesh.dispose()
      liquidMesh.dispose()
      bottleMesh.dispose()
      bottleContainer.dispose()
    },
  }
}
