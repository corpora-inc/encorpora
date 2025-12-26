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
  const size = 1024
  const texture = new DynamicTexture(
    "sky-texture",
    { width: size, height: size },
    scene,
    false
  )
  const ctx = texture.getContext()

  const material = new StandardMaterial("sky-mat", scene)
  material.backFaceCulling = false
  material.disableLighting = true
  material.emissiveTexture = texture
  material.emissiveColor = new Color3(1, 1, 1)

  const dome = MeshBuilder.CreateSphere(
    "sky-dome",
    { diameter: 220, segments: 32 },
    scene
  )
  dome.material = material
  dome.isPickable = false
  dome.infiniteDistance = true

  let animationTime = 0

  const setColor = (color: Color4) => {
    const base = new Color3(color.r, color.g, color.b)
    const top = scaleColor(base, 1.25)
    const bottom = scaleColor(base, 0.55)
    const gradient = ctx.createLinearGradient(0, 0, 0, size)
    gradient.addColorStop(0, colorToCss(top))
    gradient.addColorStop(0.55, colorToCss(base))
    gradient.addColorStop(1, colorToCss(bottom))
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, size, size)

    // Add nebula-like clouds
    ctx.globalAlpha = 0.12
    const cloudCount = 8
    for (let i = 0; i < cloudCount; i += 1) {
      const x = (size / cloudCount) * i + Math.sin(i * 2.5) * size * 0.2
      const y = size * 0.4 + Math.cos(i * 1.8) * size * 0.15
      const radius = size * 0.15
      const nebula = ctx.createRadialGradient(x, y, 0, x, y, radius)
      const nebulaColor = scaleColor(base, 1.4)
      nebula.addColorStop(0, colorToCss(nebulaColor, 0.25))
      nebula.addColorStop(1, "rgba(0,0,0,0)")
      ctx.fillStyle = nebula
      ctx.fillRect(0, 0, size, size)
    }
    ctx.globalAlpha = 1

    // More varied stars with different sizes and colors
    const starCount = 150
    for (let i = 0; i < starCount; i += 1) {
      const x = Math.random() * size
      const y = Math.random() * size * 0.7
      const starSize = Math.random() < 0.9 ? 2 : 3

      // Some stars are more colorful
      if (Math.random() < 0.15) {
        const hue = Math.random() * 60 + (i % 3) * 120
        ctx.fillStyle = `hsla(${hue}, 70%, 80%, ${0.3 + Math.random() * 0.5})`
      } else {
        ctx.fillStyle = `rgba(255, 255, 255, ${0.3 + Math.random() * 0.5})`
      }

      ctx.fillRect(x, y, starSize, starSize)
    }

    texture.update()
  }

  const update = (dt: number) => {
    animationTime += dt
    // Very subtle rotation for parallax effect
    dome.rotation.y = animationTime * 0.01
  }

  return { mesh: dome, setColor, update }
}
