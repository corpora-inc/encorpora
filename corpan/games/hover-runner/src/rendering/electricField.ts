import {
  Color3,
  Mesh,
  MeshBuilder,
  Scene,
  StandardMaterial,
  TransformNode,
  Vector3,
} from "@babylonjs/core"
import type { ElectricField } from "../core/types"
import { clamp, scaleColor } from "../core/utils"

export const createElectricField = (
  scene: Scene,
  parent: TransformNode,
  baseColor: Color3
): ElectricField => {
  const root = new TransformNode("electric-field", scene)
  root.parent = parent
  root.position.y = 0.2

  const core = MeshBuilder.CreateSphere(
    "electric-core",
    { diameter: 0.25, segments: 12 },
    scene
  )
  core.parent = root
  core.position.y = 0.45
  core.isPickable = false

  const coreMat = new StandardMaterial("electric-core-mat", scene)
  coreMat.emissiveColor = baseColor.clone()
  coreMat.disableLighting = true
  core.material = coreMat

  const buildArc = (
    index: number,
    label: string,
    radius: number,
    pointCount: number,
    reachScale: number
  ) => {
    const points = Array.from({ length: pointCount }, () => new Vector3())
    const mesh = MeshBuilder.CreateTube(
      `electric-arc-${label}-${index}`,
      {
        path: points,
        radius,
        tessellation: 6,
        updatable: true,
      },
      scene
    )
    mesh.parent = root
    mesh.isPickable = false
    const material = new StandardMaterial(`electric-arc-mat-${label}-${index}`, scene)
    material.emissiveColor = baseColor.clone()
    material.disableLighting = true
    material.alpha = 0.85
    mesh.material = material
    return {
      mesh,
      points,
      material,
      seed: Math.random() * Math.PI * 2,
      phase: Math.random() * Math.PI * 2,
      reachScale,
    }
  }

  const arcs = [
    ...Array.from({ length: 12 }, (_, index) =>
      buildArc(index, "main", 0.01, 16, 1)
    ),
    ...Array.from({ length: 8 }, (_, index) =>
      buildArc(index, "branch", 0.006, 12, 0.65)
    ),
  ]

  let time = 0
  let currentColor = baseColor.clone()

  const setColor = (color: Color3) => {
    currentColor = color.clone()
    coreMat.emissiveColor = scaleColor(currentColor, 1.35)
    arcs.forEach((arc) => {
      arc.material.emissiveColor = scaleColor(currentColor, 1.25)
    })
  }

  const update = (dt: number, target: Mesh | null, intensity: number) => {
    time += dt
    const targetWorld = target?.getAbsolutePosition() ?? null
    const rootWorld = root.getAbsolutePosition()
    const targetLocal = targetWorld ? targetWorld.subtract(rootWorld) : null
    const reach = clamp(intensity, 0, 1)

    arcs.forEach((arc, index) => {
      const start = new Vector3(0, 0.45, 0)
      const theta = arc.seed + time * 0.9 + index * 0.4
      const phi = arc.phase + time * 0.7 + index * 0.2
      const sphereRadius = 0.85 + Math.sin(time * 1.4 + arc.seed) * 0.15
      const randomEnd = new Vector3(
        Math.cos(theta) * Math.sin(phi),
        Math.cos(phi),
        Math.sin(theta) * Math.sin(phi)
      ).scale(sphereRadius).addInPlace(start)

      let end = randomEnd
      if (targetLocal && index < 5) {
        end = Vector3.Lerp(randomEnd, targetLocal, reach * arc.reachScale)
      }

      const dir = end.subtract(start)
      const axis = Math.abs(dir.y) > 0.9 ? Vector3.Right() : Vector3.Up()
      const orthoA = Vector3.Cross(dir, axis).normalize()
      const orthoB = Vector3.Cross(dir, orthoA).normalize()

      for (let i = 0; i < arc.points.length; i += 1) {
        const t = i / (arc.points.length - 1)
        const wobble =
          Math.sin(t * 14 + time * 11 + arc.seed) * 0.1 +
          Math.cos(t * 18 + time * 9 + arc.phase) * 0.08
        const twist = Math.sin(t * 20 + time * 12 + arc.phase) * 0.09
        const fade = (1 - t) * 0.9 + 0.1
        const offset = orthoA
          .scale(wobble * fade)
          .add(orthoB.scale(twist * fade))
        const point = start.add(dir.scale(t)).add(offset)
        arc.points[i].copyFrom(point)
      }

      MeshBuilder.CreateTube(
        arc.mesh.name,
        { path: arc.points, instance: arc.mesh }
      )
      arc.material.emissiveColor = scaleColor(
        currentColor,
        1.05 + reach * 0.75
      )
    })
  }

  setColor(baseColor)

  return { root, update, setColor }
}
