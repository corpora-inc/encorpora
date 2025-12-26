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
  currentLetterIndex: number
  nextLetterIndex: number
  letterSwitchTime: number
  branchOffset: Vector3
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
  const isIOS =
    typeof navigator !== "undefined" && /iPhone|iPad|iPod|iOS/i.test(navigator.userAgent)
  const mainCount = isIOS ? 8 : 12
  const branchCount = isIOS ? 5 : 8
  const mainPointCount = isIOS ? 18 : 22
  const branchPointCount = isIOS ? 14 : 18
  const lightCount = isIOS ? 2 : 3

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
      currentLetterIndex: 0,
      nextLetterIndex: 0,
      letterSwitchTime: 0,
      branchOffset: Vector3.Zero(),
    }
  }

  const arcs: Arc[] = [
    ...Array.from({ length: mainCount }, (_, index) => {
      const angle = (index / mainCount) * Math.PI * 2
      return buildArc(index, "main", 0.012, mainPointCount, 1, angle, 0.95)
    }),
    ...Array.from({ length: branchCount }, (_, index) => {
      const angle = (index / branchCount) * Math.PI * 2 + 0.2
      return buildArc(index, "branch", 0.007, branchPointCount, 0.7, angle, 0.65)
    }),
  ]

  // Beam sparks - particles that fly off the central beam trunk
  // Reduced from 800 to 400 for performance
  const beamSparks = new ParticleSystem("beam-sparks", isIOS ? 240 : 400, scene)
  beamSparks.particleTexture = new Texture(
    "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMTYiIGN5PSIxNiIgcj0iMTAiIGZpbGw9IndoaXRlIi8+PC9zdmc+",
    scene
  )
  beamSparks.emitter = core
  beamSparks.minEmitBox = Vector3.Zero()
  beamSparks.maxEmitBox = Vector3.Zero()
  beamSparks.color1 = new Color4(1, 1, 1, 1) // Bright white
  beamSparks.color2 = new Color4(0.8, 0.95, 1, 1) // Blue-white
  beamSparks.colorDead = new Color4(0.4, 0.7, 0.95, 0)
  beamSparks.minSize = 0.02
  beamSparks.maxSize = 0.05
  beamSparks.minLifeTime = 0.12
  beamSparks.maxLifeTime = 0.3
  beamSparks.emitRate = 0
  beamSparks.blendMode = ParticleSystem.BLENDMODE_ADD
  beamSparks.minEmitPower = 0.5
  beamSparks.maxEmitPower = 1.5
  beamSparks.updateSpeed = 0.014
  beamSparks.gravity = new Vector3(0, -1.2, 0)

  const beamDirection = new Vector3(0, 0, 1)
  const beamScratch = new Vector3()

  // Sparks emit from random points along the beam trunk (before it spreads)
  beamSparks.startPositionFunction = (worldMatrix, positionToUpdate, particle) => {
    const meta = particle as typeof particle & ArcParticleMeta
    // Pick a random arc and position along the TRUNK (t < 0.7)
    const arcIndex = Math.floor(Math.random() * arcs.length)
    const t = Math.random() * 0.7  // Only emit from unified beam section
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

  // Sparks fly outward perpendicular to beam direction
  beamSparks.startDirectionFunction = (
    worldMatrix,
    directionToUpdate,
    particle
  ) => {
    const meta = particle as typeof particle & ArcParticleMeta
    const arcIndex = meta.arcIndex ?? Math.floor(Math.random() * arcs.length)
    const t = meta.arcT ?? Math.random() * 0.7
    const arc = arcs[arcIndex]
    const pointIndex = Math.min(
      Math.floor(t * (arc.points.length - 2)),
      arc.points.length - 2
    )
    const pointA = arc.points[pointIndex]
    const pointB = arc.points[pointIndex + 1] ?? pointA

    // Calculate beam direction
    beamScratch.copyFrom(pointB).subtractInPlace(pointA)
    if (beamScratch.lengthSquared() < 0.0001) {
      beamScratch.copyFrom(beamDirection)
    }
    beamScratch.normalize()

    // Create perpendicular direction (outward from beam)
    const axis = Math.abs(beamScratch.y) > 0.85 ? Vector3.Right() : Vector3.Up()
    const perpA = Vector3.Cross(beamScratch, axis).normalize()
    const perpB = Vector3.Cross(beamScratch, perpA).normalize()

    // Random direction perpendicular to beam + slight forward momentum
    const angle = Math.random() * Math.PI * 2
    const radialStrength = 0.8 + Math.random() * 0.4
    const forwardStrength = 0.1 + Math.random() * 0.15

    const emitPower = beamSparks.minEmitPower +
      Math.random() * (beamSparks.maxEmitPower - beamSparks.minEmitPower)

    directionToUpdate.copyFrom(perpA.scale(Math.cos(angle) * radialStrength))
      .addInPlace(perpB.scale(Math.sin(angle) * radialStrength))
      .addInPlace(beamScratch.scale(forwardStrength))
      .normalize()
      .scaleInPlace(emitPower)

    if (worldMatrix && worldMatrix.m && worldMatrix.m.length >= 16) {
      Vector3.TransformNormalToRef(directionToUpdate, worldMatrix, beamScratch)
      directionToUpdate.copyFrom(beamScratch)
    }
  }

  // Reduced from 220 to 110 for performance
  const coreSparkSystem = new ParticleSystem("core-sparks", isIOS ? 70 : 110, scene)
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

  const pointLights = Array.from({ length: lightCount }, (_, index) => {
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

    beamSparks.color1 = particleColor1
    beamSparks.color2 = particleColor2
    beamSparks.colorDead = particleColorDead

    coreSparkSystem.color1 = new Color4(color.r * 0.9, color.g * 0.95, color.b, 1)
    coreSparkSystem.color2 = new Color4(color.r * 0.7, color.g * 0.85, color.b, 1)
    coreSparkSystem.colorDead = particleColorDead

    pointLights.forEach((light) => {
      light.diffuse = color.clone()
      light.specular = scaleColor(color, 1.2)
    })
  }

  // Performance optimization: frame counter for reduced geometry updates
  let frameCount = 0
  // iOS performance: update less frequently (every 3 frames vs 2)
  const updateInterval = isIOS ? 3 : 2 // Update geometry every N frames

  const update = (dt: number, target: Mesh | null, intensity: number, letterPositions?: Vector3[]) => {
    time += dt
    frameCount++

    const rootWorld = root.getAbsolutePosition()
    if (target) {
      target.computeWorldMatrix(true)
    }
    const targetWorldMatrix =
      target && letterPositions && letterPositions.length > 0 ? target.getWorldMatrix() : null
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
      beamDirection.copyFrom(frame.centerLocal)
      if (beamDirection.lengthSquared() > 0.0001) {
        beamDirection.normalize()
      } else {
        beamDirection.copyFrom(fallbackNormal)
      }
    } else {
      beamDirection.copyFrom(fallbackNormal)
    }

    coreMat.emissiveColor = scaleColor(currentColor, 1.2 + focus * 1)

    const targetRight = frame?.right ?? fallbackRight
    const targetUp = frame?.up ?? fallbackUp
    const targetNormal = frame?.normal ?? fallbackNormal
    const extentRight = frame?.extentRight ?? 0.6
    const extentUp = frame?.extentUp ?? 0.4
    const hasFocus = !!frame && focus > 0.05

    // Skip expensive geometry updates on most frames for performance
    const shouldUpdateGeometry = frameCount % updateInterval === 0

    arcs.forEach((arc, arcIndex) => {
      // Calculate orbital position for spreading at the endpoint
      let orbit = 0
      let u = 0
      let v = 0

      if (hasFocus) {
        // Use letter positions if available, otherwise fall back to orbital spread
        if (letterPositions && letterPositions.length > 0 && target && targetWorldMatrix) {
          // LIGHTNING-STYLE: Randomly switch between letter targets
          arc.letterSwitchTime -= dt
          if (arc.letterSwitchTime <= 0) {
            // Switch to a new random letter target
            arc.currentLetterIndex = arc.nextLetterIndex
            // Pick a random letter, preferring nearby letters for branching effect
            const randomFactor = Math.random()
            if (randomFactor < 0.6) {
              // 60% chance: jump to a nearby letter (±1-3 positions)
              const jump = Math.floor(Math.random() * 6) - 3
              arc.nextLetterIndex = (arc.currentLetterIndex + jump + letterPositions.length) % letterPositions.length
            } else {
              // 40% chance: jump to any random letter
              arc.nextLetterIndex = Math.floor(Math.random() * letterPositions.length)
            }
            // Faster switching when focused (like rapid lightning strikes)
            arc.letterSwitchTime = 0.08 + Math.random() * 0.12
          }

          // Ensure indices are in bounds
          arc.currentLetterIndex = clamp(arc.currentLetterIndex, 0, letterPositions.length - 1)
          arc.nextLetterIndex = clamp(arc.nextLetterIndex, 0, letterPositions.length - 1)

          // Interpolate between current and next letter for smooth traversal
          const switchProgress = 1.0 - (arc.letterSwitchTime / 0.2)
          const currentLetterPos = letterPositions[arc.currentLetterIndex]
          const nextLetterPos = letterPositions[arc.nextLetterIndex]

          // Safety check: ensure positions exist before transforming
          if (currentLetterPos && nextLetterPos) {
            // Transform letter positions to world space
            const currentWorldPos = Vector3.TransformCoordinates(currentLetterPos, targetWorldMatrix)
            const nextWorldPos = Vector3.TransformCoordinates(nextLetterPos, targetWorldMatrix)

            // Lerp between current and next letter
            const targetLetterWorld = Vector3.Lerp(currentWorldPos, nextWorldPos, switchProgress)
            arc.endTarget.copyFrom(targetLetterWorld.subtract(rootWorld))

            // Add chaotic forward offset with variation
            const forwardNoise = 0.08 + Math.sin(time * 8 + arc.seed) * 0.04
            arc.endTarget.addInPlace(targetNormal.scale(forwardNoise + arc.reachScale * 0.06))

            // Add aggressive random offset for chaotic plasma look
            const chaos = 0.15 + focus * 0.1
            arc.branchOffset.x = Math.sin(time * 12 + arc.seed) * chaos
            arc.branchOffset.y = Math.cos(time * 15 + arc.phase) * chaos
            arc.branchOffset.z = Math.sin(time * 10 + arc.seed * 2) * chaos * 0.5
            arc.endTarget.addInPlace(arc.branchOffset)
          } else {
            // Fallback if positions are invalid: use center
            arc.endTarget.copyFrom(frame.centerLocal)
            arc.endTarget.addInPlace(targetNormal.scale(0.1))
          }
        } else {
          // Fallback: orbital position on the phrase surface (original behavior)
          orbit = arc.orbitAngle + time * arc.orbitSpeed
          const drift = Math.sin(time * 1.6 + arc.seed) * 0.12
          const radius = arc.orbitRadius + drift * 0.2
          const rawU = Math.cos(orbit) * radius
          const rawV = Math.sin(orbit) * radius
          u = warpEdge(rawU, 0.65)
          v = warpEdge(rawV, 0.65)
          const edgeScale = 0.92 + Math.sin(time * 2.4 + arc.phase) * 0.06

          arc.endTarget.copyFrom(frame.centerLocal)
          arc.endTarget.addInPlace(targetRight.scale(u * extentRight * edgeScale))
          arc.endTarget.addInPlace(targetUp.scale(v * extentUp * edgeScale))
          arc.endTarget.addInPlace(
            targetNormal.scale((0.06 + arc.reachScale * 0.14) * (0.6 + focus * 0.5))
          )
        }
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
        dirNorm.copyFrom(beamDirection)
      }
      dirNorm.normalize()

      const axis = Math.abs(dirNorm.y) > 0.85 ? fallbackRight : fallbackUp
      const orthoA = Vector3.Cross(dirNorm, axis).normalize()
      const orthoB = Vector3.Cross(dirNorm, orthoA).normalize()

      // Global beam pulsation - all arcs pulse together for a breathing effect
      const beamPulse = Math.sin(time * 3.5) * 0.12 + Math.cos(time * 2.2) * 0.08

      // Only recalculate geometry on update frames (performance optimization)
      if (shouldUpdateGeometry) {
        const pointCount = arc.points.length - 1
        for (let i = 0; i < arc.points.length; i += 1) {
        const t = i / pointCount

        if (hasFocus) {
          // PLASMA GLOBE EFFECT: converge into unified beam, then spread at end
          const spreadStart = 0.7 // Where arcs start spreading out

          // Base convergence with pulsation - beam breathes and separates rhythmically
          let baseConvergence = 0.88 // Not perfect (1.0) so arcs are visible
          if (t < spreadStart) {
            // Add pulsating separation in the trunk
            const pulseFactor = beamPulse * 0.15
            const arcVariation = Math.sin(arc.seed + time * 1.8) * 0.08 // Per-arc variation
            baseConvergence = baseConvergence - pulseFactor - arcVariation
            baseConvergence = clamp(baseConvergence, 0.65, 0.95)
          } else {
            // Spread zone: converge less
            baseConvergence = 1.0 - ((t - spreadStart) / (1.0 - spreadStart))
          }

          // Main beam path: converge all arcs toward the beam center
          const beamPoint = Vector3.Lerp(startPos, beamCenter, t)

          // Individual arc endpoint: spread to orbital position
          const arcEndPoint = Vector3.Lerp(startPos, arc.end, t)

          // Blend between unified beam and spread arc based on convergence
          Vector3.LerpToRef(arcEndPoint, beamPoint, baseConvergence, arc.points[i])

          // Dynamic noise based on position in arc
          if (t < spreadStart) {
            // Beam trunk: moderate noise
            const beamNoiseAmp = arc.noiseScale * (0.25 + beamPulse * 0.1)
            const flutter = Math.sin(t * 12 + time * 11 + arc.seed) * 0.8
            const twist = Math.cos(t * 14 + time * 9 + arc.phase) * 0.8
            const falloff = Math.sin(Math.PI * t) * (0.6 + Math.abs(beamPulse) * 0.4)
            const beamNoise = orthoA
              .scale(flutter * beamNoiseAmp * falloff)
              .add(orthoB.scale(twist * beamNoiseAmp * falloff))
            arc.points[i].addInPlace(beamNoise)
          } else {
            // LIGHTNING SPREAD ZONE: aggressive jagged branching
            const spreadAmount = (t - spreadStart) / (1.0 - spreadStart)

            // High-frequency jagged noise for lightning effect
            const jaggedFreq = 25 + arc.seed * 5
            const jaggedAmp = arc.noiseScale * (0.8 + spreadAmount * 1.2) * focus

            // Multiple octaves of noise for fractal lightning branches
            const noise1 = Math.sin(t * jaggedFreq + time * 15 + arc.seed) * 1.0
            const noise2 = Math.sin(t * jaggedFreq * 2.3 + time * 12 + arc.phase) * 0.6
            const noise3 = Math.cos(t * jaggedFreq * 3.7 + time * 18 + arc.seed * 2) * 0.4
            const combinedNoise = (noise1 + noise2 + noise3) / 2.1

            // Sharp falloff creates branch-like effect
            const branchFalloff = Math.pow(spreadAmount, 0.7)

            // Apply jagged offset perpendicular to arc
            const jaggedNoise = orthoA
              .scale(combinedNoise * jaggedAmp * branchFalloff)
              .add(orthoB.scale(-combinedNoise * jaggedAmp * branchFalloff * 0.8))
            arc.points[i].addInPlace(jaggedNoise)

            // Random "kinks" - sudden direction changes like real lightning
            if (spreadAmount > 0.3) {
              const kinkPhase = Math.floor(t * 8 + arc.seed)
              const kinkStrength = (Math.sin(kinkPhase * 7.3 + time * 6) * 0.5 + 0.5) * 0.2
              const kinkDir = orthoA.scale(Math.sin(kinkPhase * 3.1)).add(orthoB.scale(Math.cos(kinkPhase * 4.2)))
              arc.points[i].addInPlace(kinkDir.scale(kinkStrength * spreadAmount))
            }

            // Surface interaction chaos
            const surfaceChaos = Math.sin(time * 10 + arc.phase + t * 15) * 0.12 * spreadAmount
            arc.points[i].addInPlace(targetNormal.scale(surfaceChaos))
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
      }

      // Pulsating intensity for juiciness (always update colors)
      const intensityBoost = hasFocus ? (1.0 + beamPulse * 0.3) : 1.0
      arc.material.emissiveColor = scaleColor(currentColor, (0.9 + reach * 0.9) * intensityBoost)
      arc.material.alpha = (0.35 + focus * 0.5) * (0.9 + Math.abs(beamPulse) * 0.2)
    })

    // Beam sparks fly off the central trunk - elite physics-based
    if (hasFocus) {
      if (!beamSparks.isStarted()) {
        beamSparks.start()
      }
      // High emit rate for continuous spark trail
      beamSparks.emitRate = 120 + focus * 280
      beamSparks.minEmitPower = 0.6 + focus * 0.6
      beamSparks.maxEmitPower = 1.2 + focus * 1.2

      // Vary size for depth and realism
      beamSparks.minSize = 0.018 + focus * 0.008
      beamSparks.maxSize = 0.045 + focus * 0.015
    } else if (beamSparks.isStarted()) {
      beamSparks.stop()
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
