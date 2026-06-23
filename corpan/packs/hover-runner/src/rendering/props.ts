import { Mesh, PBRMaterial, TransformNode } from "@babylonjs/core"
import { ROAD } from "../core/constants"
import type { RoadState, SceneProp } from "../core/types"
import { scaleColor } from "../core/utils"

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

    // Store initial rotation offset for smooth animation
    const rotationOffset = mesh.rotation.y

    props.push({
      mesh,
      baseZ: i * options.spacing,
      offsetX,
      baseY,
      side,
      rotationOffset,
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
  const time = travel * 0.1
  props.forEach((prop, index) => {
    const baseZ = ROAD.length - ((prop.baseZ + travel) % ROAD.length)
    const z = baseZ + ROAD.zOffset
    const curve = road.getCurveAt(baseZ)

    // Add subtle floating animation (different phase per prop)
    const floatPhase = time + index * 0.5
    const floatOffset = Math.sin(floatPhase) * 0.08

    prop.mesh.position.x =
      curve + prop.side * (ROAD.width / 2 + prop.offsetX)
    prop.mesh.position.y = ROAD.y + prop.baseY + floatOffset
    prop.mesh.position.z = z

    // Add slow rotation for trippy effect (preserve initial random rotation)
    const rotationSpeed = 0.2 // Slower, smoother rotation
    prop.mesh.rotation.y = (prop.rotationOffset || 0) + time * rotationSpeed + index * 0.1

    // Pulse emissive intensity for trippy glow effect
    const material = prop.mesh.material
    if (material && material instanceof PBRMaterial) {
      if (!prop.baseEmissive) {
        // Store original emissive color on first update
        prop.baseEmissive = material.emissiveColor.clone()
      }
      const pulsePhase = time * 1.2 + index * 0.8
      const pulseAmount = 0.85 + Math.sin(pulsePhase) * 0.15
      material.emissiveColor.copyFrom(scaleColor(prop.baseEmissive, pulseAmount))
    }
  })
}
