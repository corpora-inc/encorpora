import {
  Color3,
  Color4,
  DynamicTexture,
  MeshBuilder,
  Scene,
  StandardMaterial,
} from "@babylonjs/core"
import { colorToCss, scaleColor } from "../core/utils"

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
  material.emissiveColor = new Color3(1, 1, 1)

  const dome = MeshBuilder.CreateSphere(
    "sky-dome",
    { diameter: 220, segments: 24 },  // Reduced segments for perf
    scene
  )
  dome.material = material
  dome.isPickable = false
  dome.infiniteDistance = true

  let animationTime = 0
  let currentBase = new Color3(0.05, 0.08, 0.15)  // Default dark blue

  // Draw function that actually renders to texture
  const drawSky = (base: Color3) => {
    // Clear to black first
    ctx.fillStyle = "#000000"
    ctx.fillRect(0, 0, size, size)

    // Main gradient
    const top = scaleColor(base, 2.0)
    const mid = scaleColor(base, 1.0)
    const bottom = scaleColor(base, 0.3)

    const gradient = ctx.createLinearGradient(0, 0, 0, size)
    gradient.addColorStop(0, colorToCss(top))
    gradient.addColorStop(0.5, colorToCss(mid))
    gradient.addColorStop(1, colorToCss(bottom))
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, size, size)

    // Horizon glow
    const horizonGrad = ctx.createLinearGradient(0, size * 0.75, 0, size)
    const glowColor = scaleColor(base, 2.5)
    horizonGrad.addColorStop(0, "rgba(0,0,0,0)")
    horizonGrad.addColorStop(0.6, colorToCss(glowColor, 0.2))
    horizonGrad.addColorStop(1, colorToCss(glowColor, 0.35))
    ctx.fillStyle = horizonGrad
    ctx.fillRect(0, 0, size, size)

    // Stars - reduced count for performance
    const starCount = 100
    for (let i = 0; i < starCount; i++) {
      const x = (Math.sin(i * 127.1) * 0.5 + 0.5) * size  // Pseudo-random
      const y = (Math.cos(i * 311.7) * 0.5 + 0.5) * size * 0.7
      const starSize = i % 10 === 0 ? 3 : 2
      const alpha = 0.4 + (i % 5) * 0.12

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
    dome.rotation.y = animationTime * 0.008
  }

  return { mesh: dome, setColor, update }
}
