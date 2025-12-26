import { Mesh, TransformNode } from "@babylonjs/core"
import { ROAD } from "../core/constants"
import type { RoadState, SceneProp } from "../core/types"

export const createPropField = (
  root: TransformNode,
  options: {
    count: number
    spacing: number
    offsetX: number
    offsetXJitter: number
    baseY: number
    baseYJitter: number
    buildMesh: (index: number) => Mesh
  }
): SceneProp[] => {
  const props: SceneProp[] = []
  for (let i = 0; i < options.count; i += 1) {
    const mesh = options.buildMesh(i)
    mesh.parent = root
    mesh.isPickable = false
    mesh.receiveShadows = true
    const side = i % 2 === 0 ? -1 : 1
    const offsetX =
      options.offsetX + (Math.random() - 0.5) * options.offsetXJitter
    const baseY =
      options.baseY + (Math.random() - 0.5) * options.baseYJitter
    props.push({
      mesh,
      baseZ: i * options.spacing,
      offsetX,
      baseY,
      side,
    })
  }
  return props
}

export const updatePropField = (props: SceneProp[], road: RoadState, frameCount?: number) => {
  // Performance optimization: Only update props every 2 frames
  // Props move smoothly enough at 30 updates/second
  if (frameCount !== undefined && frameCount % 2 !== 0) {
    return
  }

  const travel = road.getTravel()
  props.forEach((prop) => {
    const baseZ = ROAD.length - ((prop.baseZ + travel) % ROAD.length)
    const z = baseZ + ROAD.zOffset
    const curve = road.getCurveAt(baseZ)
    prop.mesh.position.x =
      curve + prop.side * (ROAD.width / 2 + prop.offsetX)
    prop.mesh.position.y = ROAD.y + prop.baseY
    prop.mesh.position.z = z
  })
}
