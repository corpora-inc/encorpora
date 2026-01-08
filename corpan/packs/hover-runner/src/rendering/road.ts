import {
  Color3,
  DynamicTexture,
  Mesh,
  MeshBuilder,
  PBRMaterial,
  Scene,
  Texture,
  Vector3,
} from "@babylonjs/core"
import { ROAD } from "../core/constants"
import type { RoadPalette, RoadState } from "../core/types"
import { colorToCss, computeCurve, scaleColor } from "../core/utils"
import { ROAD_MATERIAL } from "../core/visualConfig"

const createRoadTexture = (scene: Scene, palette: RoadPalette) => {
  const size = 1024
  const texture = new DynamicTexture(
    "road-texture",
    { width: size, height: size },
    scene,
    false
  )
  texture.wrapU = Texture.WRAP_ADDRESSMODE
  texture.wrapV = Texture.WRAP_ADDRESSMODE
  texture.uScale = 1
  texture.vScale = 4
  texture.anisotropicFilteringLevel = 8

  const ctx = texture.getContext()

  const draw = (next: RoadPalette) => {
    ctx.clearRect(0, 0, size, size)
    ctx.fillStyle = colorToCss(next.road)
    ctx.fillRect(0, 0, size, size)

    const bandColor = scaleColor(next.road, 0.85)
    ctx.fillStyle = colorToCss(bandColor, 0.55)
    for (let y = 0; y < size; y += 128) {
      ctx.fillRect(0, y, size, 64)
    }

    const gritColor = scaleColor(next.road, 0.65)
    ctx.fillStyle = colorToCss(gritColor, 0.35)
    for (let i = 0; i < 200; i += 1) {
      ctx.fillRect(
        Math.random() * size,
        Math.random() * size,
        2,
        2
      )
    }

    const edgeWidth = 44
    ctx.fillStyle = colorToCss(next.edge, 0.9)
    ctx.fillRect(0, 0, edgeWidth, size)
    ctx.fillRect(size - edgeWidth, 0, edgeWidth, size)

    const dashWidth = 28
    const dashHeight = 140
    const dashGap = 70
    const centerX = size / 2 - dashWidth / 2
    ctx.fillStyle = colorToCss(next.center, 0.92)
    for (let y = 0; y < size; y += dashHeight + dashGap) {
      ctx.fillRect(centerX, y, dashWidth, dashHeight)
    }

    ctx.globalAlpha = 0.22
    ctx.fillStyle = colorToCss(next.center, 0.8)
    ctx.fillRect(centerX - 24, 0, dashWidth + 48, size)
    ctx.globalAlpha = 1

    texture.update()
  }

  draw(palette)

  return { texture, draw }
}

export const createRoad = (scene: Scene): RoadState => {
  const pathArray: Vector3[][] = [[], []]

  for (let i = 0; i < ROAD.segments; i += 1) {
    pathArray[0].push(new Vector3())
    pathArray[1].push(new Vector3())
  }

  const road = MeshBuilder.CreateRibbon(
    "road",
    {
      pathArray,
      updatable: true,
      sideOrientation: Mesh.DOUBLESIDE,
    },
    scene
  )

  const basePalette: RoadPalette = {
    road: new Color3(0.06, 0.08, 0.12),
    emissive: new Color3(0.02, 0.04, 0.08),
    center: new Color3(0.25, 0.7, 1),
    edge: new Color3(0.12, 0.55, 0.95),
  }
  const { texture: roadTexture, draw: drawRoadTexture } = createRoadTexture(
    scene,
    basePalette
  )

  const roadMaterial = new PBRMaterial("road-mat", scene)
  roadMaterial.albedoTexture = roadTexture
  roadMaterial.emissiveTexture = roadTexture
  roadMaterial.albedoColor = new Color3(ROAD_MATERIAL.albedoColor.r, ROAD_MATERIAL.albedoColor.g, ROAD_MATERIAL.albedoColor.b)
  roadMaterial.emissiveColor = new Color3(ROAD_MATERIAL.emissiveColor.r, ROAD_MATERIAL.emissiveColor.g, ROAD_MATERIAL.emissiveColor.b)
  roadMaterial.metallic = ROAD_MATERIAL.metallic
  roadMaterial.roughness = ROAD_MATERIAL.roughness
  roadMaterial.alpha = ROAD_MATERIAL.alpha
  roadMaterial.transparencyMode = PBRMaterial.PBRMATERIAL_ALPHABLEND
  road.material = roadMaterial
  road.receiveShadows = true
  road.isPickable = false

  const applyPalette = (palette: RoadPalette) => {
    drawRoadTexture(palette)
    roadMaterial.emissiveColor = scaleColor(palette.emissive, 6)
  }

  let travel = 0
  let curveTime = 0
  let farCenterX = 0

  const update = (dt: number, frameCount?: number) => {
    travel = (travel + ROAD.speed * dt) % ROAD.length
    curveTime += dt * 0.35
    const spacing = ROAD.length / (ROAD.segments - 1)
    roadTexture.vOffset =
      ((travel / ROAD.length) * roadTexture.vScale) % 1

    // Performance optimization: only update geometry every 2 frames
    const shouldUpdateGeometry = frameCount === undefined || frameCount % 2 === 0

    if (shouldUpdateGeometry) {
      for (let i = 0; i < ROAD.segments; i += 1) {
        const baseZ = ROAD.length - i * spacing
        const z = baseZ + ROAD.zOffset
        const curve = computeCurve(curveTime, baseZ)

        const left = pathArray[0][i]
        const right = pathArray[1][i]

        left.x = curve - ROAD.width / 2
        left.y = ROAD.y
        left.z = z

        right.x = curve + ROAD.width / 2
        right.y = ROAD.y
        right.z = z

        if (i === 0) {
          farCenterX = curve
        }
      }

      MeshBuilder.CreateRibbon("road", { pathArray, instance: road })
    }
  }

  return {
    mesh: road,
    update,
    getFarCenterX: () => farCenterX,
    getTravel: () => travel,
    getCurveAt: (z: number) => computeCurve(curveTime, z),
    setPalette: applyPalette,
  }
}
