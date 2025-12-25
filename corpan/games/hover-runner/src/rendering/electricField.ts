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
import { clamp, lerp, scaleColor } from "../core/utils"

type Arc = {
  mesh: Mesh
  points: Vector3[]
  material: StandardMaterial
  seed: number
  phase: number
  reachScale: number
  orbitAngle: number
  orbitSpeed: number
  orbitRadius: number
  idleRadius: number
  idleSpeed: number
  idleLift: number
  noiseScale: number
  end: Vector3
  endTarget: Vector3
}

type TargetFrame = {
  centerLocal: Vector3
  right: Vector3
  up: Vector3
  normal: Vector3
  extentRight: number
  extentUp: number
}

type ArcParticleMeta = {
  arcIndex?: number
  arcT?: number
}

const warpEdge = (value: number, power: number) => {
  const abs = Math.abs(value)
  if (abs < 1e-4) return 0
  return Math.sign(value) * Math.pow(abs, power)
}

const resolveTargetFrame = (target: Mesh, rootWorld: Vector3): TargetFrame => {
  target.computeWorldMatrix(true)
  const bounds = target.getBoundingInfo().boundingBox
  let min = new Vector3(
    Number.POSITIVE_INFINITY,
    Number.POSITIVE_INFINITY,
    Number.POSITIVE_INFINITY
  )
  let max = new Vector3(
    Number.NEGATIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
    Number.NEGATIVE_INFINITY
  )
  bounds.vectorsWorld.forEach((corner) => {
    min = Vector3.Minimize(min, corner)
    max = Vector3.Maximize(max, corner)
  })
  const centerWorld = min.add(max).scale(0.5)
  const centerLocal = centerWorld.subtract(rootWorld)

  const right = target.getDirection(Vector3.Right()).normalize()
  const up = target.getDirection(Vector3.Up()).normalize()
  let normal = Vector3.Cross(right, up)
  if (normal.lengthSquared() < 0.001) {
    normal = centerLocal.clone()
  }
  if (normal.lengthSquared() < 0.001) {
    normal = Vector3.Forward()
  } else {
    normal.normalize()
  }

  let extentRight = 0.1
  let extentUp = 0.1
  bounds.vectorsWorld.forEach((corner) => {
    const local = corner.subtract(centerWorld)
    extentRight = Math.max(extentRight, Math.abs(Vector3.Dot(local, right)))
    extentUp = Math.max(extentUp, Math.abs(Vector3.Dot(local, up)))
  })

  return { centerLocal, right, up, normal, extentRight, extentUp }
}

export const createElectricField = (
  scene: Scene,
  parent: TransformNode,
  baseColor: Color3
): ElectricField => {
  const root = new TransformNode("electric-field", scene)
  root.parent = parent
  root.position.y = 0.2

  const start = new Vector3(0, 0.45, 0)
  const startPos = new Vector3()
  const startJitter = new Vector3()
  const fallbackRight = Vector3.Right()
  const fallbackUp = Vector3.Up()
  const fallbackNormal = Vector3.Forward()

  const core = MeshBuilder.CreateSphere(
    "electric-core",
    { diameter: 0.25, segments: 12 },
    scene
  )
  core.parent = root
  core.position.y = start.y
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
    reachScale: number,
    orbitAngle: number,
    orbitRadius: number
  ) => {
    const points = Array.from({ length: pointCount }, () => start.clone())
    const mesh = MeshBuilder.CreateTube(
      `electric-arc-${label}-${index}`,
      {
        path: points,
        radius,
        tessellation: 7,
        updatable: true,
      },
      scene
    )
    mesh.parent = root
    mesh.isPickable = false
    const material = new StandardMaterial(`electric-arc-mat-${label}-${index}`, scene)
    material.emissiveColor = baseColor.clone()
    material.disableLighting = true
    material.alpha = 0.8
    mesh.material = material
    return {
      mesh,
      points,
      material,
      seed: Math.random() * Math.PI * 2,
      phase: Math.random() * Math.PI * 2,
      reachScale,
      orbitAngle: orbitAngle + Math.random() * 0.25,
      orbitSpeed: 0.25 + Math.random() * 0.45,
      orbitRadius: orbitRadius * (0.9 + Math.random() * 0.18),
      idleRadius: 0.5 + Math.random() * 0.35,
      idleSpeed: 0.45 + Math.random() * 0.6,
      idleLift: 0.3 + Math.random() * 0.25,
      noiseScale: 0.1 + Math.random() * 0.06,
      end: start.clone(),
      endTarget: start.clone(),
    }
  }

  const mainCount = 12
  const branchCount = 8
  const arcs: Arc[] = [
    ...Array.from({ length: mainCount }, (_, index) => {
      const angle = (index / mainCount) * Math.PI * 2
      return buildArc(index, "main", 0.012, 22, 1, angle, 0.95)
    }),
    ...Array.from({ length: branchCount }, (_, index) => {
      const angle = (index / branchCount) * Math.PI * 2 + 0.2
      return buildArc(index, "branch", 0.007, 18, 0.7, angle, 0.65)
    }),
  ]

  const streamParticles = new ParticleSystem("electric-stream", 900, scene)
  streamParticles.particleTexture = new Texture(
    "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMTYiIGN5PSIxNiIgcj0iMTAiIGZpbGw9IndoaXRlIi8+PC9zdmc+",
    scene
  )
  streamParticles.emitter = core
  streamParticles.minEmitBox = Vector3.Zero()
  streamParticles.maxEmitBox = Vector3.Zero()
  streamParticles.color1 = new Color4(0.4, 0.9, 1, 1)
  streamParticles.color2 = new Color4(0.6, 0.98, 1, 1)
  streamParticles.colorDead = new Color4(0.3, 0.6, 1, 0)
  streamParticles.minSize = 0.02
  streamParticles.maxSize = 0.06
  streamParticles.minLifeTime = 0.12
  streamParticles.maxLifeTime = 0.45
  streamParticles.emitRate = 0
  streamParticles.blendMode = ParticleSystem.BLENDMODE_ADD
  streamParticles.minEmitPower = 1.5
  streamParticles.maxEmitPower = 3
  streamParticles.updateSpeed = 0.015
  streamParticles.gravity = Vector3.Zero()

  const streamDirection = new Vector3(0, 0, 1)
  const streamScratch = new Vector3()

  streamParticles.startPositionFunction = (worldMatrix, positionToUpdate, particle) => {
    const meta = particle as typeof particle & ArcParticleMeta
    const arcIndex = Math.floor(Math.random() * arcs.length)
    const t = Math.random() * 0.9
    meta.arcIndex = arcIndex
    meta.arcT = t
    const arc = arcs[arcIndex]
    const pointIndex = Math.min(
      Math.floor(t * (arc.points.length - 1)),
      arc.points.length - 1
    )
    const point = arc.points[pointIndex]
    if (worldMatrix && worldMatrix.m && worldMatrix.m.length >= 16) {
      const localPoint = point.subtract(core.position)
      Vector3.TransformCoordinatesToRef(localPoint, worldMatrix, positionToUpdate)
    } else {
      positionToUpdate.copyFrom(point)
    }
  }

  streamParticles.startDirectionFunction = (
    worldMatrix,
    directionToUpdate,
    particle
  ) => {
    const meta = particle as typeof particle & ArcParticleMeta
    const arcIndex = meta.arcIndex ?? Math.floor(Math.random() * arcs.length)
    const t = meta.arcT ?? Math.random()
    const arc = arcs[arcIndex]
    const pointIndex = Math.min(
      Math.floor(t * (arc.points.length - 2)),
      arc.points.length - 2
    )
    const pointA = arc.points[pointIndex]
    const pointB = arc.points[pointIndex + 1] ?? pointA
    streamScratch.copyFrom(pointB).subtractInPlace(pointA)
    if (streamScratch.lengthSquared() < 0.0001) {
      streamScratch.copyFrom(streamDirection)
    }
    // Generate emit power based on the particle system's settings
    const emitPower = streamParticles.minEmitPower +
      Math.random() * (streamParticles.maxEmitPower - streamParticles.minEmitPower)
    streamScratch.normalize().scaleInPlace(emitPower)
    if (worldMatrix && worldMatrix.m && worldMatrix.m.length >= 16) {
      Vector3.TransformNormalToRef(streamScratch, worldMatrix, directionToUpdate)
    } else {
      directionToUpdate.copyFrom(streamScratch)
    }
  }

  const coreSparkSystem = new ParticleSystem("core-sparks", 220, scene)
  coreSparkSystem.particleTexture = new Texture(
    "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMTYiIGN5PSIxNiIgcj0iOCIgZmlsbD0id2hpdGUiLz48L3N2Zz4=",
    scene
  )
  coreSparkSystem.emitter = core
  coreSparkSystem.minEmitBox = new Vector3(-0.08, -0.08, -0.08)
  coreSparkSystem.maxEmitBox = new Vector3(0.08, 0.08, 0.08)
  coreSparkSystem.color1 = new Color4(0.8, 0.95, 1, 1)
  coreSparkSystem.color2 = new Color4(0.5, 0.85, 1, 1)
  coreSparkSystem.colorDead = new Color4(0.3, 0.6, 1, 0)
  coreSparkSystem.minSize = 0.02
  coreSparkSystem.maxSize = 0.05
  coreSparkSystem.minLifeTime = 0.2
  coreSparkSystem.maxLifeTime = 0.5
  coreSparkSystem.emitRate = 20
  coreSparkSystem.blendMode = ParticleSystem.BLENDMODE_ADD
  coreSparkSystem.minEmitPower = 0.3
  coreSparkSystem.maxEmitPower = 0.9
  coreSparkSystem.updateSpeed = 0.01
  coreSparkSystem.gravity = new Vector3(0, -1, 0)

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
  let focus = 0

  const setColor = (color: Color3) => {
    currentColor = color.clone()
    coreMat.emissiveColor = scaleColor(currentColor, 1.35)
    arcs.forEach((arc) => {
      arc.material.emissiveColor = scaleColor(currentColor, 1.25)
    })

    const particleColor1 = new Color4(color.r * 0.7, color.g * 0.9, color.b, 1)
    const particleColor2 = new Color4(color.r * 0.9, color.g, color.b, 1)
    const particleColorDead = new Color4(color.r * 0.5, color.g * 0.7, color.b, 0)

    streamParticles.color1 = particleColor1
    streamParticles.color2 = particleColor2
    streamParticles.colorDead = particleColorDead

    coreSparkSystem.color1 = new Color4(color.r * 0.9, color.g * 0.95, color.b, 1)
    coreSparkSystem.color2 = new Color4(color.r * 0.7, color.g * 0.85, color.b, 1)
    coreSparkSystem.colorDead = particleColorDead

    pointLights.forEach((light) => {
      light.diffuse = color.clone()
      light.specular = scaleColor(color, 1.2)
    })
  }

  const update = (dt: number, target: Mesh | null, intensity: number) => {
    time += dt
    const rootWorld = root.getAbsolutePosition()
    const desiredFocus = target ? clamp(intensity / 1.2, 0, 1) : 0
    const focusEase = 1 - Math.exp(-dt * 6)
    focus = lerp(focus, desiredFocus, focusEase)
    const reach = clamp(intensity, 0, 1.35)

    startJitter.x = Math.sin(time * 2.8) * 0.015
    startJitter.y = Math.cos(time * 2.2) * 0.02
    startJitter.z = Math.sin(time * 2.4) * 0.015
    startPos.copyFrom(start).addInPlace(startJitter)

    const frame = target && focus > 0.02 ? resolveTargetFrame(target, rootWorld) : null
    if (frame) {
      streamDirection.copyFrom(frame.centerLocal)
      if (streamDirection.lengthSquared() > 0.0001) {
        streamDirection.normalize()
      } else {
        streamDirection.copyFrom(fallbackNormal)
      }
    } else {
      streamDirection.copyFrom(fallbackNormal)
    }

    coreMat.emissiveColor = scaleColor(currentColor, 1.2 + focus * 1)

    const targetRight = frame?.right ?? fallbackRight
    const targetUp = frame?.up ?? fallbackUp
    const targetNormal = frame?.normal ?? fallbackNormal
    const extentRight = frame?.extentRight ?? 0.6
    const extentUp = frame?.extentUp ?? 0.4
    const hasFocus = !!frame && focus > 0.05

    arcs.forEach((arc) => {
      // Calculate orbital position for spreading at the endpoint
      let orbit = 0
      let u = 0
      let v = 0

      if (hasFocus) {
        orbit = arc.orbitAngle + time * arc.orbitSpeed
        const drift = Math.sin(time * 1.6 + arc.seed) * 0.12
        const radius = arc.orbitRadius + drift * 0.2
        const rawU = Math.cos(orbit) * radius
        const rawV = Math.sin(orbit) * radius
        u = warpEdge(rawU, 0.65)
        v = warpEdge(rawV, 0.65)
        const edgeScale = 0.92 + Math.sin(time * 2.4 + arc.phase) * 0.06

        // Target is the orbital position on the phrase surface
        arc.endTarget.copyFrom(frame.centerLocal)
        arc.endTarget.addInPlace(targetRight.scale(u * extentRight * edgeScale))
        arc.endTarget.addInPlace(targetUp.scale(v * extentUp * edgeScale))
        arc.endTarget.addInPlace(
          targetNormal.scale((0.06 + arc.reachScale * 0.14) * (0.6 + focus * 0.5))
        )
      } else {
        const idleAngle = arc.orbitAngle + time * arc.idleSpeed
        const idleRadius = arc.idleRadius + Math.sin(time * 1.5 + arc.seed) * 0.08
        arc.endTarget.copyFrom(startPos)
        arc.endTarget.addInPlace(
          new Vector3(
            Math.cos(idleAngle) * idleRadius,
            Math.sin(time * 1.8 + arc.phase) * 0.12 + arc.idleLift,
            Math.sin(idleAngle) * idleRadius
          )
        )
      }

      const endEase = 1 - Math.exp(-dt * (hasFocus ? 8 : 3))
      Vector3.LerpToRef(arc.end, arc.endTarget, endEase, arc.end)

      // Calculate beam center (all arcs converge to this when focused)
      const beamCenter = hasFocus ? frame.centerLocal : arc.end

      const dirNorm = arc.end.subtract(startPos)
      if (dirNorm.lengthSquared() < 0.0001) {
        dirNorm.copyFrom(streamDirection)
      }
      dirNorm.normalize()

      const axis = Math.abs(dirNorm.y) > 0.85 ? fallbackRight : fallbackUp
      const orthoA = Vector3.Cross(dirNorm, axis).normalize()
      const orthoB = Vector3.Cross(dirNorm, orthoA).normalize()

      const pointCount = arc.points.length - 1
      for (let i = 0; i < arc.points.length; i += 1) {
        const t = i / pointCount

        if (hasFocus) {
          // PLASMA GLOBE EFFECT: converge into unified beam, then spread at end
          // Convergence: strong (1.0) at start/middle, weak (0.0) at very end
          const spreadStart = 0.75 // Where arcs start spreading out
          const convergence = t < spreadStart ? 1.0 : 1.0 - ((t - spreadStart) / (1.0 - spreadStart))

          // Main beam path: converge all arcs to the beam center
          const beamPoint = Vector3.Lerp(startPos, beamCenter, t)

          // Individual arc endpoint: spread to orbital position
          const arcEndPoint = Vector3.Lerp(startPos, arc.end, t)

          // Blend between unified beam and spread arc based on convergence
          Vector3.LerpToRef(arcEndPoint, beamPoint, convergence, arc.points[i])

          // Very subtle noise only in the beam trunk
          const beamNoiseAmp = arc.noiseScale * 0.15 * convergence
          const flutter = Math.sin(t * 12 + time * 11 + arc.seed) * 0.8
          const twist = Math.cos(t * 14 + time * 9 + arc.phase) * 0.8
          const falloff = Math.sin(Math.PI * t)
          const beamNoise = orthoA
            .scale(flutter * beamNoiseAmp * falloff)
            .add(orthoB.scale(twist * beamNoiseAmp * falloff))
          arc.points[i].addInPlace(beamNoise)

          // At the spread zone, add surface dance
          if (t > spreadStart) {
            const spreadAmount = (t - spreadStart) / (1.0 - spreadStart)
            const surfaceWiggle = Math.sin(time * 8 + arc.phase + t * 10) * 0.08 * spreadAmount
            arc.points[i].addInPlace(targetNormal.scale(surfaceWiggle))
          }
        } else {
          // Idle state: spread out freely
          const falloff = Math.sin(Math.PI * t)
          const noiseAmp = arc.noiseScale * 0.6 * arc.reachScale
          const flutter =
            Math.sin(t * 12 + time * 11 + arc.seed) * 0.8 +
            Math.cos(t * 18 + time * 7 + arc.phase) * 0.6
          const twist =
            Math.cos(t * 14 + time * 9 + arc.phase) * 0.8 +
            Math.sin(t * 22 + time * 8 + arc.seed) * 0.6
          const offset = orthoA
            .scale(flutter * noiseAmp * falloff)
            .add(orthoB.scale(twist * noiseAmp * falloff))

          Vector3.LerpToRef(startPos, arc.end, t, arc.points[i])
          arc.points[i].addInPlace(offset)
        }
      }

      MeshBuilder.CreateTube(arc.mesh.name, { path: arc.points, instance: arc.mesh })
      arc.material.emissiveColor = scaleColor(currentColor, 0.9 + reach * 0.9)
      arc.material.alpha = 0.35 + focus * 0.5
    })

    if (hasFocus) {
      if (!streamParticles.isStarted()) {
        streamParticles.start()
      }
      streamParticles.emitRate = 120 + focus * 260
      streamParticles.minEmitPower = 1.6 + focus * 1.4
      streamParticles.maxEmitPower = 3 + focus * 2.1
      streamParticles.minLifeTime = 0.12 + focus * 0.08
      streamParticles.maxLifeTime = 0.35 + focus * 0.18
    } else if (streamParticles.isStarted()) {
      streamParticles.stop()
    }

    if (hasFocus) {
      if (!coreSparkSystem.isStarted()) {
        coreSparkSystem.start()
      }
      coreSparkSystem.emitRate = 30 + reach * 90
      coreSparkSystem.maxEmitPower = 0.9 + reach * 1.3
    } else if (coreSparkSystem.isStarted()) {
      coreSparkSystem.stop()
    }

    pointLights.forEach((light, index) => {
      if (hasFocus) {
        const arcIndex = (index * 3) % arcs.length
        const arc = arcs[arcIndex]
        const t = (Math.sin(time * 3 + index * 2) * 0.5 + 0.5) * 0.75 + 0.15
        const pointIndex = Math.floor(t * (arc.points.length - 1))
        const arcPoint = arc.points[pointIndex]
        if (arcPoint) {
          light.position = rootWorld.add(arcPoint)
        }
        light.intensity = 0.35 + focus * 0.85
        light.range = 2.4 + focus * 1.6
      } else {
        light.intensity = 0
      }
    })
  }

  setColor(baseColor)

  return { root, update, setColor }
}
