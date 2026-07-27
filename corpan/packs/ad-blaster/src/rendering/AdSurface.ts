import {
  Color3,
  DynamicTexture,
  Mesh,
  MeshBuilder,
  Scene,
  StandardMaterial,
} from "@babylonjs/core"

export type AdSurface = {
  mesh: Mesh
  meshWidth: number
  meshHeight: number
  setText: (text: string, bgColor: string) => void
  setImage: (image: ImageBitmap) => void
  setHpBar: (ratio: number) => void
  dispose: () => void
}

const hexToColor3 = (hex: string): Color3 => {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  return new Color3(r, g, b)
}

export type AdSurfaceOptions = {
  meshWidth?: number
  meshHeight?: number
}

export const createAdSurface = (
  scene: Scene,
  id: string,
  options?: AdSurfaceOptions,
): AdSurface => {
  const meshWidth = options?.meshWidth ?? 1.4
  const meshHeight = options?.meshHeight ?? 0.9

  const mesh = MeshBuilder.CreatePlane(
    `ad-${id}`,
    { width: meshWidth, height: meshHeight },
    scene
  )

  // Scale texture resolution with aspect ratio (base ~256x128 area)
  const aspect = meshWidth / meshHeight
  const texWidth = Math.round(Math.max(128, Math.min(512, 256 * Math.sqrt(aspect))))
  const texHeight = Math.round(texWidth / aspect)

  const tex = new DynamicTexture(`adTex-${id}`, { width: texWidth, height: texHeight }, scene, false)
  tex.hasAlpha = false

  const mat = new StandardMaterial(`adMat-${id}`, scene)
  mat.diffuseTexture = tex
  mat.emissiveColor = new Color3(0.3, 0.3, 0.3)
  mat.specularColor = new Color3(0, 0, 0)
  mat.backFaceCulling = false
  mesh.material = mat

  let lastBgColor = "#ff4444"
  let lastText = ""
  let hasImage = false

  const render = (hpRatio = 1) => {
    if (hasImage) {
      // Don't re-render text over an image; only overlay HP bar
      if (hpRatio < 1) {
        const ctx = tex.getContext() as unknown as CanvasRenderingContext2D
        const barHeight = 6
        const barY = texHeight - barHeight - 4
        const barWidth = texWidth - 16

        ctx.fillStyle = "rgba(0,0,0,0.5)"
        ctx.fillRect(8, barY, barWidth, barHeight)

        const fillColor = hpRatio > 0.5 ? "#44ff44" : hpRatio > 0.25 ? "#ffaa00" : "#ff4444"
        ctx.fillStyle = fillColor
        ctx.fillRect(8, barY, barWidth * hpRatio, barHeight)

        tex.update()
      }
      return
    }

    const ctx = tex.getContext() as unknown as CanvasRenderingContext2D
    const c = hexToColor3(lastBgColor)

    // Background
    ctx.fillStyle = lastBgColor
    ctx.fillRect(0, 0, texWidth, texHeight)

    // Border
    ctx.strokeStyle = `rgb(${Math.floor(c.r * 255 * 0.5)},${Math.floor(c.g * 255 * 0.5)},${Math.floor(c.b * 255 * 0.5)})`
    ctx.lineWidth = 4
    ctx.strokeRect(2, 2, texWidth - 4, texHeight - 4)

    // Text
    const text = lastText
    const fontSize = text.length > 15 ? 16 : text.length > 12 ? 18 : text.length > 8 ? 22 : 28
    ctx.font = `bold ${fontSize}px "Trebuchet MS", sans-serif`
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"

    // Text shadow
    ctx.fillStyle = "rgba(0,0,0,0.5)"
    ctx.fillText(text, texWidth / 2 + 1, texHeight / 2 + 1, texWidth - 16)

    // Text
    ctx.fillStyle = "#ffffff"
    ctx.fillText(text, texWidth / 2, texHeight / 2, texWidth - 16)

    // HP bar at bottom (if not full)
    if (hpRatio < 1) {
      const barHeight = 6
      const barY = texHeight - barHeight - 4
      const barWidth = texWidth - 16

      // Background
      ctx.fillStyle = "rgba(0,0,0,0.5)"
      ctx.fillRect(8, barY, barWidth, barHeight)

      // Fill
      const fillColor = hpRatio > 0.5 ? "#44ff44" : hpRatio > 0.25 ? "#ffaa00" : "#ff4444"
      ctx.fillStyle = fillColor
      ctx.fillRect(8, barY, barWidth * hpRatio, barHeight)
    }

    tex.update()
    mat.emissiveColor = new Color3(c.r * 0.4, c.g * 0.4, c.b * 0.4)
  }

  const setText = (text: string, bgColor: string) => {
    hasImage = false
    lastText = text
    lastBgColor = bgColor
    render()
  }

  const setImage = (image: ImageBitmap) => {
    hasImage = true
    const ctx = tex.getContext() as unknown as CanvasRenderingContext2D
    ctx.drawImage(image, 0, 0, texWidth, texHeight)
    tex.update()
    mat.emissiveColor = new Color3(0.3, 0.3, 0.3)
  }

  const setHpBar = (ratio: number) => {
    render(ratio)
  }

  const dispose = () => {
    mesh.dispose()
    tex.dispose()
    mat.dispose()
  }

  return { mesh, meshWidth, meshHeight, setText, setImage, setHpBar, dispose }
}
