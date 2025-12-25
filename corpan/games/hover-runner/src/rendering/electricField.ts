import {
  Color3,
  Color4,
  Mesh,
  MeshBuilder,
  ParticleSystem,
  PointLight,
  Scene,
  StandardMaterial,
  Texture,
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

  // Create particle systems for flowing electricity along arcs
  const arcParticleSystems = arcs.slice(0, 6).map((arc, index) => {
    const particleSystem = new ParticleSystem(
      `electric-particles-${index}`,
      300,
      scene
    )

    // No texture needed - we'll use additive blending for glowing particles
    particleSystem.particleTexture = new Texture(
      "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMTYiIGN5PSIxNiIgcj0iMTIiIGZpbGw9IndoaXRlIi8+PC9zdmc+",
      scene
    )

    particleSystem.emitter = core
    particleSystem.minEmitBox = new Vector3(-0.05, -0.05, -0.05)
    particleSystem.maxEmitBox = new Vector3(0.05, 0.05, 0.05)

    // Particle appearance - bright electric blue/cyan
    particleSystem.color1 = new Color4(0.4, 0.8, 1, 1)
    particleSystem.color2 = new Color4(0.6, 0.95, 1, 1)
    particleSystem.colorDead = new Color4(0.3, 0.7, 1, 0)

    particleSystem.minSize = 0.03
    particleSystem.maxSize = 0.08
    particleSystem.minLifeTime = 0.4
    particleSystem.maxLifeTime = 0.8

    particleSystem.emitRate = 60
    particleSystem.blendMode = ParticleSystem.BLENDMODE_ADD
    particleSystem.minEmitPower = 0.5
    particleSystem.maxEmitPower = 1.5
    particleSystem.updateSpeed = 0.01

    // Add some randomness
    particleSystem.direction1 = new Vector3(-0.2, -0.2, -0.2)
    particleSystem.direction2 = new Vector3(0.2, 0.2, 0.2)

    return { system: particleSystem, arc, active: false }
  })

  // Create spark burst particles at the core
  const coreSparkSystem = new ParticleSystem("core-sparks", 200, scene)
  coreSparkSystem.particleTexture = new Texture(
    "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMTYiIGN5PSIxNiIgcj0iOCIgZmlsbD0id2hpdGUiLz48L3N2Zz4=",
    scene
  )
  coreSparkSystem.emitter = core
  coreSparkSystem.minEmitBox = new Vector3(-0.1, -0.1, -0.1)
  coreSparkSystem.maxEmitBox = new Vector3(0.1, 0.1, 0.1)
  coreSparkSystem.color1 = new Color4(0.8, 0.95, 1, 1)
  coreSparkSystem.color2 = new Color4(0.5, 0.85, 1, 1)
  coreSparkSystem.colorDead = new Color4(0.3, 0.6, 1, 0)
  coreSparkSystem.minSize = 0.02
  coreSparkSystem.maxSize = 0.05
  coreSparkSystem.minLifeTime = 0.2
  coreSparkSystem.maxLifeTime = 0.5
  coreSparkSystem.emitRate = 40
  coreSparkSystem.blendMode = ParticleSystem.BLENDMODE_ADD
  coreSparkSystem.minEmitPower = 0.3
  coreSparkSystem.maxEmitPower = 0.8
  coreSparkSystem.updateSpeed = 0.01
  coreSparkSystem.gravity = new Vector3(0, -1, 0)

  // Create dynamic point lights for electric glow
  const pointLights = Array.from({ length: 3 }, (_, index) => {
    const light = new PointLight(
      `electric-light-${index}`,
      new Vector3(0, 0, 0),
      scene
    )
    light.intensity = 0
    light.range = 3
    light.diffuse = new Color3(0.4, 0.85, 1)
    light.specular = new Color3(0.6, 0.95, 1)
    return light
  })

  let time = 0
  let currentColor = baseColor.clone()
  let lastFocusState = false

  const setColor = (color: Color3) => {
    currentColor = color.clone()
    coreMat.emissiveColor = scaleColor(currentColor, 1.35)
    arcs.forEach((arc) => {
      arc.material.emissiveColor = scaleColor(currentColor, 1.25)
    })

    // Update particle colors to match theme
    const particleColor1 = new Color4(color.r * 0.7, color.g * 0.9, color.b, 1)
    const particleColor2 = new Color4(color.r * 0.9, color.g, color.b, 1)
    const particleColorDead = new Color4(color.r * 0.5, color.g * 0.7, color.b, 0)

    arcParticleSystems.forEach(({ system }) => {
      system.color1 = particleColor1
      system.color2 = particleColor2
      system.colorDead = particleColorDead
    })

    coreSparkSystem.color1 = new Color4(color.r * 0.9, color.g * 0.95, color.b, 1)
    coreSparkSystem.color2 = new Color4(color.r * 0.7, color.g * 0.85, color.b, 1)
    coreSparkSystem.colorDead = particleColorDead

    // Update light colors
    pointLights.forEach((light) => {
      light.diffuse = color.clone()
      light.specular = scaleColor(color, 1.2)
    })
  }

  const update = (dt: number, target: Mesh | null, intensity: number) => {
    time += dt
    const targetWorld = target?.getAbsolutePosition() ?? null
    const rootWorld = root.getAbsolutePosition()
    const targetLocal = targetWorld ? targetWorld.subtract(rootWorld) : null
    const reach = clamp(intensity, 0, 1.2) // Allow stronger connection

    // Boost core brightness when connected
    coreMat.emissiveColor = scaleColor(currentColor, 1.35 + reach * 0.5)

    // Calculate multiple target points around the phrase for plasma globe effect
    const targetPoints: Vector3[] = []
    if (targetLocal && target) {
      const bounds = target.getBoundingInfo()
      const extendSize = bounds.boundingBox.extendSize
      const center = targetLocal

      // Create target points at corners, edges, and surfaces of the phrase mesh
      const offsets = [
        // Corners
        new Vector3(-extendSize.x, -extendSize.y, 0),
        new Vector3(extendSize.x, -extendSize.y, 0),
        new Vector3(-extendSize.x, extendSize.y, 0),
        new Vector3(extendSize.x, extendSize.y, 0),
        // Mid edges
        new Vector3(-extendSize.x * 0.5, 0, 0),
        new Vector3(extendSize.x * 0.5, 0, 0),
        new Vector3(0, -extendSize.y * 0.5, 0),
        new Vector3(0, extendSize.y * 0.5, 0),
        // Surface points (create plasma-like distribution)
        new Vector3(-extendSize.x * 0.7, extendSize.y * 0.7, 0),
        new Vector3(extendSize.x * 0.7, extendSize.y * 0.7, 0),
        new Vector3(-extendSize.x * 0.7, -extendSize.y * 0.7, 0),
        new Vector3(extendSize.x * 0.7, -extendSize.y * 0.7, 0),
        // Center for concentration
        new Vector3(0, 0, 0),
        new Vector3(0, 0, 0),
      ]

      offsets.forEach((offset) => {
        targetPoints.push(center.add(offset))
      })
    }

    const shouldFocus = !!(targetLocal && targetPoints.length > 0 && reach > 0.1)
    if (shouldFocus !== lastFocusState) {
      console.log(`Electric field ${shouldFocus ? 'FOCUSING' : 'FLOATING'}:`, {
        hasTarget: !!target,
        hasTargetLocal: !!targetLocal,
        targetPointsCount: targetPoints.length,
        intensity,
        reach,
        reachThreshold: 0.1,
      })
      lastFocusState = shouldFocus
    }

    arcs.forEach((arc, index) => {
      const start = new Vector3(0, 0.45, 0)

      let end: Vector3

      // When target exists, ALL arcs focus on it like a plasma globe
      if (shouldFocus) {
        // Each arc picks a different target point to create wrapping effect
        const targetIndex = index % targetPoints.length
        const targetPoint = targetPoints[targetIndex]

        // Small dance animation on target point
        const animOffset = new Vector3(
          Math.sin(time * 4 + index) * 0.08,
          Math.cos(time * 3.5 + index) * 0.08,
          Math.sin(time * 5 + index) * 0.03
        )

        const animatedTarget = targetPoint.add(animOffset)

        // STRONGLY prefer the target - 95% target, 5% wobble for realism
        const wobble = new Vector3(
          Math.sin(time * 2 + index) * 0.1,
          Math.cos(time * 2.3 + index) * 0.1,
          0
        )
        end = animatedTarget.add(wobble.scale(0.05))
      } else {
        // No target or weak connection - arcs float randomly
        const theta = arc.seed + time * 0.9 + index * 0.4
        const phi = arc.phase + time * 0.7 + index * 0.2
        const sphereRadius = 0.85 + Math.sin(time * 1.4 + arc.seed) * 0.15
        end = new Vector3(
          Math.cos(theta) * Math.sin(phi),
          Math.cos(phi),
          Math.sin(theta) * Math.sin(phi)
        ).scale(sphereRadius).addInPlace(start)
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
      // Stronger brightness boost when connected (up to 2.2x from 1.8x)
      arc.material.emissiveColor = scaleColor(
        currentColor,
        1.1 + reach * 0.9
      )
    })

    // Animate particles flowing along arcs to wrap around phrase
    const hasTarget = targetLocal !== null && reach > 0.1 && targetPoints.length > 0

    arcParticleSystems.forEach(({ system, active }, index) => {
      if (hasTarget) {
        // Activate particles and direct them toward phrase surface
        if (!active) {
          system.start()
          arcParticleSystems[index].active = true
        }

        // Particles seek different points on phrase surface for plasma globe effect
        const targetPointIndex = (index * 3) % targetPoints.length
        const surfaceTarget = targetPoints[targetPointIndex]
        const direction = surfaceTarget.subtract(new Vector3(0, 0.45, 0)).normalize()

        // Add spiral motion as particles flow toward phrase
        const spiralAngle = time * 3 + index * 0.5
        const spiralRadius = 0.4
        const spiralOffset = new Vector3(
          Math.cos(spiralAngle) * spiralRadius,
          Math.sin(spiralAngle) * spiralRadius,
          0
        )

        const tangent1 = direction.add(spiralOffset).normalize()
        const tangent2 = direction.add(spiralOffset.scale(-1)).normalize()

        // Particles flow in spiraling streams toward surface
        const jitter = 0.2
        system.direction1 = tangent1.scale(2.5 + reach).add(
          new Vector3(
            (Math.random() - 0.5) * jitter,
            (Math.random() - 0.5) * jitter,
            (Math.random() - 0.5) * jitter
          )
        )
        system.direction2 = tangent2.scale(3 + reach).add(
          new Vector3(
            (Math.random() - 0.5) * jitter,
            (Math.random() - 0.5) * jitter,
            (Math.random() - 0.5) * jitter
          )
        )

        // Massive increase in particles for stunning visual
        system.emitRate = 80 + reach * 180
        system.minEmitPower = 1.5 + reach * 2.5
        system.maxEmitPower = 2.5 + reach * 4
      } else if (active) {
        // Deactivate particles
        system.stop()
        arcParticleSystems[index].active = false
      }
    })

    // Control core spark system
    if (hasTarget) {
      if (!coreSparkSystem.isStarted()) {
        coreSparkSystem.start()
      }
      coreSparkSystem.emitRate = 40 + reach * 80
      coreSparkSystem.maxEmitPower = 0.8 + reach * 1.2
    } else {
      if (coreSparkSystem.isStarted()) {
        coreSparkSystem.stop()
      }
    }

    // Animate point lights along arcs
    pointLights.forEach((light, index) => {
      if (hasTarget && index < 3) {
        // Position lights along the arc path
        const arcIndex = index * 2
        const arc = arcs[arcIndex]
        if (arc) {
          // Animate light position along the arc
          const t = (Math.sin(time * 3 + index * 2) * 0.5 + 0.5) * 0.7 + 0.15
          const pointIndex = Math.floor(t * (arc.points.length - 1))
          const arcPoint = arc.points[pointIndex]
          if (arcPoint) {
            const worldPoint = root.getAbsolutePosition().add(arcPoint)
            light.position = worldPoint
          }
        }
        light.intensity = 0.3 + reach * 0.7
      } else {
        light.intensity = 0
      }
    })
  }

  setColor(baseColor)

  return { root, update, setColor }
}
