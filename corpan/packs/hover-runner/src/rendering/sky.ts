import {
  Color3,
  Color4,
  DynamicTexture,
  MeshBuilder,
  Scene,
  StandardMaterial,
} from "@babylonjs/core"
import { colorToCss, scaleColor } from "../core/utils"
import { SKY } from "../core/visualConfig"

export const createSkyDome = (scene: Scene) => {
  const size = 512  // Reduced for performance
  const texture = new DynamicTexture(
    "sky-texture",
    { width: size, height: size },
    scene,
    true  // generateMipMaps
  )
  const ctx = texture.getContext()

  const material = new StandardMaterial("sky-mat", scene)
  material.backFaceCulling = false
  material.disableLighting = true
  material.emissiveTexture = texture
  material.emissiveColor = new Color3(SKY.emissiveMultiplier, SKY.emissiveMultiplier, SKY.emissiveMultiplier)

  const dome = MeshBuilder.CreateSphere(
    "sky-dome",
    { diameter: 220, segments: 24 },  // Reduced segments for perf
    scene
  )
  dome.material = material
  dome.isPickable = false
  dome.infiniteDistance = true

  let animationTime = 0
  let currentBase = new Color3(SKY.baseColor.r, SKY.baseColor.g, SKY.baseColor.b)

  // Draw function that actually renders to texture
  const drawSky = (base: Color3) => {
    // Clear to black first
    ctx.fillStyle = "#000000"
    ctx.fillRect(0, 0, size, size)

    // Main gradient
    const top = scaleColor(base, SKY.gradient.top)
    const mid = scaleColor(base, SKY.gradient.mid)
    const bottom = scaleColor(base, SKY.gradient.bottom)

    const gradient = ctx.createLinearGradient(0, 0, 0, size)
    gradient.addColorStop(0, colorToCss(top))
    gradient.addColorStop(0.5, colorToCss(mid))
    gradient.addColorStop(1, colorToCss(bottom))
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, size, size)

    // Horizon glow
    const horizonGrad = ctx.createLinearGradient(0, size * 0.75, 0, size)
    const glowColor = scaleColor(base, SKY.horizonGlowMultiplier)
    horizonGrad.addColorStop(0, "rgba(0,0,0,0)")
    horizonGrad.addColorStop(0.6, colorToCss(glowColor, SKY.horizonGlowAlphaStart))
    horizonGrad.addColorStop(1, colorToCss(glowColor, SKY.horizonGlowAlphaEnd))
    ctx.fillStyle = horizonGrad
    ctx.fillRect(0, 0, size, size)

    // Stars
    for (let i = 0; i < SKY.starCount; i++) {
      const x = (Math.sin(i * 127.1) * 0.5 + 0.5) * size  // Pseudo-random
      const y = (Math.cos(i * 311.7) * 0.5 + 0.5) * size * 0.7
      const starSize = i % 10 === 0 ? 2 : 1
      const alpha = SKY.starBaseAlpha + (i % 5) * SKY.starAlphaVariation

      ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`
      ctx.fillRect(x, y, starSize, starSize)
    }

    // CRITICAL: Update the texture
    texture.update()
  }

  // Draw initial sky immediately
  drawSky(currentBase)

  const setColor = (color: Color4) => {
    const lift = (v: number, min: number) => Math.max(v, min)
    currentBase = new Color3(
      lift(color.r, 0.04),
      lift(color.g, 0.04),
      lift(color.b, 0.06)
    )
    drawSky(currentBase)
  }

  const update = (dt: number) => {
    animationTime += dt
    dome.rotation.y = animationTime * SKY.rotationSpeed
  }

  return { mesh: dome, setColor, update }
}
