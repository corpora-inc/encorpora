import {
  Color3,
  Color4,
  DynamicTexture,
  Mesh,
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

    ctx.fillStyle = "rgba(255, 255, 255, 0.08)"
    for (let i = 0; i < 120; i += 1) {
      ctx.fillRect(Math.random() * size, Math.random() * size * 0.6, 2, 2)
    }

    texture.update()
  }

  return { mesh: dome, setColor }
}
