/**
 * 3D Juice Bottle Module
 * Creates a full-screen Babylon.js 3D bottle with animated liquid
 * that fills as player completes phrases.
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
  Texture,
} from "@babylonjs/core"
import { LEVEL_FRUIT_COLORS, type CEFRLevel } from "./store/gameState"

export type Bottle3D = {
  updateFill: (level: number) => void
  setColor: (level: CEFRLevel) => void
  triggerSqueeze: () => void
  triggerOverflow: () => void
  triggerCompletion: (targetX: number, targetY: number) => Promise<void>
  reset: () => void
  updateLayout: (worldWidth: number, worldHeight: number) => void
  dispose: () => void
}

// Convert hex color to Color3
const hexToColor3 = (hex: string): Color3 => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (result) {
    return new Color3(
      parseInt(result[1], 16) / 255,
      parseInt(result[2], 16) / 255,
      parseInt(result[3], 16) / 255
    )
  }
  return new Color3(1, 0.6, 0) // Default orange
}

export const createBottle3D = (scene: Scene, initialLevel: CEFRLevel = "A0"): Bottle3D => {
  // Get initial color from level
  const levelColors = LEVEL_FRUIT_COLORS[initialLevel]
  let currentColor = hexToColor3(levelColors.primary)
  let currentFillLevel = 0

  // Create bottle container for positioning
  const bottleContainer = new Mesh("bottle-container", scene)
  bottleContainer.position = new Vector3(0, 0, 5) // In front of logo, behind game elements

  // Create bottle shape using lathe (rotational symmetry)
  // Profile from bottom to top: base -> body -> neck -> lip
  const bottleProfile = [
    // Bottom base (flat)
    new Vector3(0, 0, 0),
    new Vector3(1.8, 0, 0),
    // Body curve up
    new Vector3(2.0, 0.3, 0),
    new Vector3(2.1, 1.0, 0),
    new Vector3(2.1, 4.5, 0), // Main body
    // Shoulder curve to neck
    new Vector3(2.0, 5.0, 0),
    new Vector3(1.5, 5.5, 0),
    new Vector3(1.0, 5.8, 0),
    // Neck
    new Vector3(0.9, 6.0, 0),
    new Vector3(0.9, 7.0, 0),
    // Lip
    new Vector3(1.1, 7.2, 0),
    new Vector3(1.1, 7.4, 0),
    new Vector3(0.9, 7.4, 0),
  ]

  // Create bottle mesh
  const bottleMesh = MeshBuilder.CreateLathe(
    "bottle",
    {
      shape: bottleProfile,
      radius: 1,
      tessellation: 32,
      sideOrientation: Mesh.DOUBLESIDE,
    },
    scene
  )

  // Glass material - semi-transparent with refraction effect
  const glassMaterial = new StandardMaterial("glass-material", scene)
  glassMaterial.diffuseColor = new Color3(0.9, 0.95, 1.0)
  glassMaterial.specularColor = new Color3(1, 1, 1)
  glassMaterial.specularPower = 128
  glassMaterial.alpha = 0.25
  glassMaterial.backFaceCulling = false
  bottleMesh.material = glassMaterial

  // Don't intercept pointer events - let word blocks be clickable
  bottleMesh.isPickable = false

  // Parent to container
  bottleMesh.parent = bottleContainer

  // Liquid material - juicy color with glow
  const liquidMaterial = new StandardMaterial("liquid-material", scene)
  liquidMaterial.diffuseColor = currentColor
  liquidMaterial.emissiveColor = currentColor.scale(0.3)
  liquidMaterial.specularColor = new Color3(1, 1, 1)
  liquidMaterial.specularPower = 64
  liquidMaterial.alpha = 0.85
  liquidMaterial.backFaceCulling = false

  // Create liquid as a cylinder that grows from bottom
  // Max height is from bottom (0.1) to just below neck (4.5)
  const maxLiquidHeight = 4.4 // Body height
  const liquidRadius = 1.95 // Slightly smaller than bottle body

  const liquidMesh = MeshBuilder.CreateCylinder(
    "liquid",
    {
      height: 1, // Will be scaled
      diameter: liquidRadius * 2,
      tessellation: 32,
    },
    scene
  )
  liquidMesh.material = liquidMaterial
  liquidMesh.parent = bottleContainer
  liquidMesh.isPickable = false // Don't intercept pointer events
  // Position at bottom of bottle, pivot from bottom
  liquidMesh.position.y = 0.15
  liquidMesh.scaling.y = 0.001 // Start hidden

  // Liquid surface cap (top of liquid) with wave animation
  const liquidCapMesh = MeshBuilder.CreateDisc(
    "liquid-cap",
    {
      radius: liquidRadius,
      tessellation: 32,
    },
    scene
  )
  liquidCapMesh.rotation.x = Math.PI / 2
  liquidCapMesh.position.y = 0.15 // Start at bottom
  liquidCapMesh.material = liquidMaterial
  liquidCapMesh.parent = bottleContainer
  liquidCapMesh.isPickable = false // Don't intercept pointer events

  // Sloshing animation for liquid surface
  let sloshPhase = 0
  let sloshIntensity = 0

  // Track original layout for reset after completion animation
  let originalLayoutScale = new Vector3(1, 1, 1)
  let originalLayoutY = 0

  // Create particle system for squeeze effect
  const squeezeParticles = new ParticleSystem("squeeze-particles", 200, scene)
  squeezeParticles.particleTexture = new Texture("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAADRJREFUeNpi/P//PwMQgzBAAIgBGYQCJiAGYoYEIPkfiBkZGRkZEIQwACl4LAFqAggwAKoSHxmGwJNAAAAAAElFTkSuQmCC", scene)
  squeezeParticles.emitter = new Vector3(0, 7.5, 5)
  squeezeParticles.minEmitBox = new Vector3(-0.5, 0, -0.5)
  squeezeParticles.maxEmitBox = new Vector3(0.5, 0, 0.5)
  squeezeParticles.color1 = new Color4(currentColor.r, currentColor.g, currentColor.b, 1)
  squeezeParticles.color2 = new Color4(currentColor.r * 1.2, currentColor.g * 1.2, currentColor.b, 1)
  squeezeParticles.colorDead = new Color4(currentColor.r, currentColor.g, currentColor.b, 0)
  squeezeParticles.minSize = 0.1
  squeezeParticles.maxSize = 0.3
  squeezeParticles.minLifeTime = 0.3
  squeezeParticles.maxLifeTime = 0.8
  squeezeParticles.emitRate = 0
  squeezeParticles.gravity = new Vector3(0, -15, 0)
  squeezeParticles.direction1 = new Vector3(-0.5, -1, -0.5)
  squeezeParticles.direction2 = new Vector3(0.5, 0, 0.5)
  squeezeParticles.minEmitPower = 2
  squeezeParticles.maxEmitPower = 4
  squeezeParticles.updateSpeed = 0.01
  squeezeParticles.start()

  // Create overflow drip particles
  const overflowParticles = new ParticleSystem("overflow-particles", 100, scene)
  overflowParticles.particleTexture = squeezeParticles.particleTexture
  overflowParticles.emitter = new Vector3(0, 7.3, 5)
  overflowParticles.minEmitBox = new Vector3(-1.0, 0, 0)
  overflowParticles.maxEmitBox = new Vector3(1.0, 0, 0)
  overflowParticles.color1 = new Color4(currentColor.r, currentColor.g, currentColor.b, 1)
  overflowParticles.color2 = new Color4(currentColor.r * 1.2, currentColor.g * 1.2, currentColor.b, 1)
  overflowParticles.colorDead = new Color4(currentColor.r, currentColor.g, currentColor.b, 0)
  overflowParticles.minSize = 0.15
  overflowParticles.maxSize = 0.4
  overflowParticles.minLifeTime = 0.5
  overflowParticles.maxLifeTime = 1.5
  overflowParticles.emitRate = 0
  overflowParticles.gravity = new Vector3(0, -8, 0)
  overflowParticles.direction1 = new Vector3(-0.8, -0.5, 0)
  overflowParticles.direction2 = new Vector3(0.8, 0.2, 0)
  overflowParticles.minEmitPower = 1
  overflowParticles.maxEmitPower = 3
  overflowParticles.updateSpeed = 0.01
  overflowParticles.start()

  // Animation loop for sloshing and natural wave motion
  scene.registerBeforeRender(() => {
    // Decay slosh intensity (triggered by squeeze)
    sloshIntensity *= 0.97

    // Update slosh phase continuously
    sloshPhase += 0.08

    // Apply natural wave motion to liquid cap when there's liquid
    if (currentFillLevel > 0.01) {
      const liquidHeight = currentFillLevel * maxLiquidHeight
      const baseY = 0.15 + liquidHeight

      // Combine gentle ambient waves with triggered slosh
      const ambientWave = Math.sin(sloshPhase) * 0.02 + Math.sin(sloshPhase * 1.7) * 0.01
      const sloshWave = Math.sin(sloshPhase * 2) * sloshIntensity * 0.15

      liquidCapMesh.position.y = baseY + ambientWave + sloshWave

      // Subtle rotation for more realistic water surface
      liquidCapMesh.rotation.z = Math.sin(sloshPhase * 0.5) * sloshIntensity * 0.05
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
      currentFillLevel += diff * 0.06 // Smooth interpolation
    }

    // Calculate liquid height based on fill level
    const liquidHeight = Math.max(0.01, currentFillLevel * maxLiquidHeight)

    // Scale the cylinder to match desired height
    liquidMesh.scaling.y = liquidHeight

    // Position cylinder so it grows from bottom
    // Cylinder pivot is at center, so we need to offset by half height
    liquidMesh.position.y = 0.15 + liquidHeight / 2

    // Update liquid cap position (top of liquid)
    const capY = 0.15 + liquidHeight
    liquidCapMesh.position.y = capY

    // Add subtle wave effect to the cap for natural water look
    const waveOffset = Math.sin(sloshPhase * 2) * sloshIntensity * 0.1
    liquidCapMesh.position.y = capY + waveOffset

    if (fillAnimating) {
      requestAnimationFrame(animateFill)
    }
  }

  return {
    updateFill: (level: number) => {
      const clampedLevel = Math.max(0, Math.min(1, level))
      targetFillLevel = clampedLevel
      if (!fillAnimating) {
        fillAnimating = true
        animateFill()
      }
    },

    setColor: (level: CEFRLevel) => {
      const levelColors = LEVEL_FRUIT_COLORS[level]
      currentColor = hexToColor3(levelColors.primary)

      // Update liquid material
      liquidMaterial.diffuseColor = currentColor
      liquidMaterial.emissiveColor = currentColor.scale(0.3)

      // Update particle colors
      squeezeParticles.color1 = new Color4(currentColor.r, currentColor.g, currentColor.b, 1)
      squeezeParticles.color2 = new Color4(currentColor.r * 1.2, currentColor.g * 1.2, currentColor.b, 1)
      squeezeParticles.colorDead = new Color4(currentColor.r, currentColor.g, currentColor.b, 0)

      overflowParticles.color1 = new Color4(currentColor.r, currentColor.g, currentColor.b, 1)
      overflowParticles.color2 = new Color4(currentColor.r * 1.2, currentColor.g * 1.2, currentColor.b, 1)
      overflowParticles.colorDead = new Color4(currentColor.r, currentColor.g, currentColor.b, 0)
    },

    triggerSqueeze: () => {
      // Emit burst of particles falling into bottle
      squeezeParticles.emitRate = 150
      setTimeout(() => {
        squeezeParticles.emitRate = 0
      }, 400)

      // Trigger sloshing
      sloshIntensity = 1.0
    },

    triggerOverflow: () => {
      // Emit overflow drips
      overflowParticles.emitRate = 80
      setTimeout(() => {
        overflowParticles.emitRate = 0
      }, 1500)
    },

    triggerCompletion: (targetX: number, targetY: number) => {
      return new Promise<void>((resolve) => {
        // Store original position and scale
        const originalPos = bottleContainer.position.clone()
        const originalScale = bottleContainer.scaling.clone()

        // Animation parameters
        const duration = 1200 // ms
        const startTime = performance.now()

        // Target mini size (about 5% of original)
        const miniScale = 0.05

        const animate = () => {
          const elapsed = performance.now() - startTime
          const progress = Math.min(1, elapsed / duration)

          // Ease out cubic for smooth deceleration
          const eased = 1 - Math.pow(1 - progress, 3)

          // Shrink
          const currentScale = originalScale.scale(1 - eased * (1 - miniScale))
          bottleContainer.scaling = currentScale

          // Move to target position
          bottleContainer.position.x = originalPos.x + (targetX - originalPos.x) * eased
          bottleContainer.position.y = originalPos.y + (targetY - originalPos.y) * eased

          // Fade out glass (but keep liquid visible for collection)
          if (glassMaterial) {
            glassMaterial.alpha = 0.25 * (1 - eased * 0.5)
          }

          if (progress < 1) {
            requestAnimationFrame(animate)
          } else {
            // Animation complete
            resolve()
          }
        }

        animate()
      })
    },

    reset: () => {
      // Reset bottle to empty state for new bottle
      currentFillLevel = 0
      targetFillLevel = 0
      fillAnimating = false

      // Reset liquid mesh - cylinder at zero height
      liquidMesh.scaling.y = 0.001
      liquidMesh.position.y = 0.15
      liquidCapMesh.position.y = 0.15

      // Reset glass transparency
      if (glassMaterial) {
        glassMaterial.alpha = 0.25
      }

      // Reset slosh
      sloshIntensity = 0

      // Reset position and scale to original layout
      bottleContainer.scaling = originalLayoutScale.clone()
      bottleContainer.position.x = 0
      bottleContainer.position.y = originalLayoutY
    },

    updateLayout: (_worldWidth: number, worldHeight: number) => {
      // Scale bottle to fill ~90% of screen height for immersive experience
      const targetHeight = worldHeight * 0.9
      const bottleNaturalHeight = 7.4 // From profile
      const scale = targetHeight / bottleNaturalHeight

      // Save original layout for reset
      originalLayoutScale = new Vector3(scale, scale, scale)
      originalLayoutY = -worldHeight * 0.05 // Center slightly lower

      bottleContainer.scaling = originalLayoutScale.clone()

      // Center bottle
      bottleContainer.position.y = originalLayoutY
    },

    dispose: () => {
      squeezeParticles.dispose()
      overflowParticles.dispose()
      liquidCapMesh.dispose()
      liquidMesh.dispose()
      bottleMesh.dispose()
      bottleContainer.dispose()
    },
  }
}
