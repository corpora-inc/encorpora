import {
  Camera,
  Color3,
  Color4,
  Mesh,
  MeshBuilder,
  ParticleSystem,
  PBRMaterial,
  PointLight,
  Quaternion,
  Scene,
  SceneLoader,
  StandardMaterial,
  Texture,
  TransformNode,
  Vector3,
} from "@babylonjs/core"

import corpanLogoUrl from "../assets/models/corpan_logo.glb"
import type { HoverVariant } from "../core/types"
import { createEmissivePbr, tuneLogoMaterial, scaleColor } from "../core/utils"
import { AVATAR } from "../core/visualConfig"

export const createHoverboard = (scene: Scene) => {
  const root = new TransformNode("hover-root", scene)
  const visualRoot = new TransformNode("hover-visual-root", scene)
  visualRoot.parent = root
  visualRoot.position.y = -1.25
  let corpanRig:
    | {
      container: TransformNode
      earPivot: TransformNode
      earFacingOffset: Quaternion
      rings: Mesh[]
      glowMats: StandardMaterial[]
      baseGlow: Color3
      baseAccent: Color3
      light: PointLight
    }
    | null = null

  const createVariant = (
    id: string,
    name: string,
    build: (pivot: TransformNode) => Mesh
  ): HoverVariant => {
    const pivot = new TransformNode(`${id}-pivot`, scene)
    pivot.parent = visualRoot
    const board = build(pivot)
    return { id, name, pivot, board }
  }

  const corpan = createVariant("corpan", "Corpán Signal", (pivot) => {
    const clay = new Color3(AVATAR.baseColor.r, AVATAR.baseColor.g, AVATAR.baseColor.b)

    const boardMaterial = createEmissivePbr(
      "corpan-board-mat",
      scene,
      clay,
      scaleColor(clay, AVATAR.boardEmissiveScale),
      0.6,
      0.35
    )
    tuneLogoMaterial(boardMaterial, 1.1)

    const earMaterial = createEmissivePbr(
      "corpan-ear-mat",
      scene,
      clay,
      scaleColor(clay, AVATAR.earEmissiveScale),
      0.5,
      0.4
    )
    tuneLogoMaterial(earMaterial, 1.1)

    const glowMaterial = new StandardMaterial("corpan-glow-mat", scene)
    glowMaterial.emissiveColor = scaleColor(clay, AVATAR.ringEmissiveScale * 1.05)
    glowMaterial.disableLighting = true
    glowMaterial.alpha = AVATAR.glowAlpha

    const accentMaterial = new StandardMaterial("corpan-accent-mat", scene)
    accentMaterial.emissiveColor = scaleColor(clay, AVATAR.accentEmissiveScale)
    accentMaterial.disableLighting = true
    accentMaterial.alpha = AVATAR.accentAlpha

    const ringMaterial = new StandardMaterial("corpan-ring-mat", scene)
    ringMaterial.emissiveColor = scaleColor(clay, AVATAR.ringEmissiveScale)
    ringMaterial.disableLighting = true
    ringMaterial.alpha = AVATAR.ringAlpha

    const container = new TransformNode("corpan-logo-container", scene)
    container.parent = pivot

    const earPivot = new TransformNode("corpan-ear-pivot", scene)
    earPivot.parent = container
    earPivot.rotationQuaternion = Quaternion.Identity()
    const earFacingOffset = Quaternion.RotationAxis(Vector3.Up(), Math.PI)

    const board = MeshBuilder.CreateBox(
      "corpan-rig",
      { width: 1.4, height: 0.08, depth: 0.9 },
      scene
    )
    board.parent = pivot
    board.position.y = 0.08
    board.visibility = 0

    container.parent = board
    container.position.y = 0.06

    const outlineColor = scaleColor(clay, AVATAR.outlineColorScale)
    const applyLogoMesh = (
      mesh: Mesh,
      material: PBRMaterial,
      glowMat: StandardMaterial,
      parent?: TransformNode | null,
      withGlow = true,
      withOutline = true
    ) => {
      const resolvedParent = parent ?? (mesh.parent as TransformNode | null) ?? container
      mesh.parent = resolvedParent
      mesh.material = material
      mesh.isPickable = false
      mesh.renderOutline = withOutline
      if (withOutline) {
        mesh.outlineColor = outlineColor
        mesh.outlineWidth = AVATAR.outlineWidth
      }

      if (withGlow) {
        const glow = mesh.clone(`${mesh.name}-glow`)
        if (glow) {
          glow.parent = resolvedParent
          glow.material = glowMat
          glow.position.copyFrom(mesh.position)
          glow.rotation.copyFrom(mesh.rotation)
          glow.scaling = mesh.scaling.scale(1.03)
          glow.isPickable = false
        }
      }
    }

    SceneLoader.LoadAssetContainerAsync("", corpanLogoUrl, scene)
      .then((logoAsset) => {
        logoAsset.addAllToScene()
        const logoRoot = logoAsset.transformNodes.find(
          (node) => node.name === "corpan_logo_root"
        )
        if (logoRoot) {
          logoRoot.parent = container
        } else {
          logoAsset.meshes.forEach((mesh) => {
            if (!mesh.parent) {
              mesh.parent = container
            }
          })
        }

        const importedEarPivot = logoAsset.transformNodes.find(
          (node) => node.name === "corpan_ear_pivot"
        )
        if (importedEarPivot && corpanRig) {
          importedEarPivot.rotationQuaternion = Quaternion.Identity()
          corpanRig.earPivot.dispose()
          corpanRig.earPivot = importedEarPivot
        }

        logoAsset.meshes.forEach((mesh) => {
          if (!(mesh instanceof Mesh)) {
            return
          }
          const name = mesh.name.toLowerCase()
          if (name.startsWith("pyramid_step")) {
            applyLogoMesh(mesh, boardMaterial, glowMaterial)
            return
          }
          if (name === "ear_outer") {
            applyLogoMesh(mesh, earMaterial, accentMaterial, undefined, false)
            return
          }
          if (name === "ear_spiral") {
            applyLogoMesh(mesh, earMaterial, accentMaterial, undefined, false, false)
          }
        })

        console.log("✓ Corpán logo meshes loaded:", logoAsset.meshes.length)
      })
      .catch((error) => {
        console.error("Failed to load Corpán logo mesh:", error)
      })

    const outerRing = MeshBuilder.CreateTorus(
      "corpan-ring-outer",
      { diameter: 1.65, thickness: 0.018, tessellation: 96 },
      scene
    )
    outerRing.parent = board
    outerRing.position.y = 0.12
    outerRing.rotation.x = Math.PI / 2
    outerRing.material = ringMaterial

    const innerRing = MeshBuilder.CreateTorus(
      "corpan-ring-inner",
      { diameter: 1.1, thickness: 0.012, tessellation: 84 },
      scene
    )
    innerRing.parent = board
    innerRing.position.y = 0.38
    innerRing.rotation.x = Math.PI / 2
    innerRing.material = ringMaterial

    const crownRing = MeshBuilder.CreateTorus(
      "corpan-ring-crown",
      { diameter: 0.82, thickness: 0.01, tessellation: 72 },
      scene
    )
    crownRing.parent = board
    crownRing.position.y = 0.62
    crownRing.rotation.x = Math.PI / 2
    crownRing.material = accentMaterial

    const logoLight = new PointLight(
      "corpan-logo-light",
      new Vector3(0, 0.6, 0.4),
      scene
    )
    logoLight.parent = board
    logoLight.diffuse = new Color3(AVATAR.light.color.r, AVATAR.light.color.g, AVATAR.light.color.b)
    logoLight.intensity = AVATAR.light.intensity
    logoLight.range = AVATAR.light.range

    corpanRig = {
      container,
      earPivot,
      earFacingOffset,
      rings: [outerRing, innerRing, crownRing],
      glowMats: [glowMaterial, accentMaterial, ringMaterial],
      baseGlow: clay,
      baseAccent: clay,
      light: logoLight,
    }

    return board
  })

  const desert = createVariant("desert", "Sunset Skimmer", (pivot) => {
    const board = MeshBuilder.CreateCylinder(
      "desert-board",
      { height: 0.08, diameter: 1.6 },
      scene
    )
    board.parent = pivot
    board.position.y = 0.08

    const boardMaterial = createEmissivePbr(
      "desert-board-mat",
      scene,
      new Color3(0.35, 0.16, 0.08),
      new Color3(0.45, 0.2, 0.12),
      0.15,
      0.7
    )
    board.material = boardMaterial

    const nose = MeshBuilder.CreateCylinder(
      "desert-nose",
      { height: 0.18, diameterTop: 0.12, diameterBottom: 0.4 },
      scene
    )
    nose.parent = pivot
    nose.position.z = 0.45
    nose.position.y = 0.12
    nose.rotation.x = Math.PI / 2
    nose.material = boardMaterial

    const riderCore = MeshBuilder.CreateBox(
      "desert-rider",
      { width: 0.28, height: 0.5, depth: 0.28 },
      scene
    )
    riderCore.parent = pivot
    riderCore.position.y = 0.55

    const riderMaterial = createEmissivePbr(
      "desert-rider-mat",
      scene,
      new Color3(0.92, 0.86, 0.74),
      new Color3(0.7, 0.5, 0.32),
      0.05,
      0.65
    )
    riderCore.material = riderMaterial

    return board
  })

  const glacier = createVariant("glacier", "Glacier Pulse", (pivot) => {
    const board = MeshBuilder.CreateBox(
      "glacier-board",
      { width: 1.6, height: 0.06, depth: 0.7 },
      scene
    )
    board.parent = pivot
    board.position.y = 0.08

    const boardMaterial = createEmissivePbr(
      "glacier-board-mat",
      scene,
      new Color3(0.12, 0.2, 0.35),
      new Color3(0.25, 0.5, 0.85),
      0.25,
      0.45
    )
    board.material = boardMaterial

    const finLeft = MeshBuilder.CreateBox(
      "glacier-fin-left",
      { width: 0.12, height: 0.06, depth: 0.4 },
      scene
    )
    finLeft.parent = pivot
    finLeft.position.set(-0.7, 0.1, 0)
    finLeft.material = boardMaterial

    const finRight = finLeft.clone("glacier-fin-right")
    if (finRight) {
      finRight.parent = pivot
      finRight.position.x = 0.7
    }

    const rider = MeshBuilder.CreateSphere(
      "glacier-rider",
      { diameter: 0.34 },
      scene
    )
    rider.parent = pivot
    rider.position.y = 0.54

    const riderMaterial = createEmissivePbr(
      "glacier-rider-mat",
      scene,
      new Color3(0.86, 0.94, 1),
      new Color3(0.5, 0.75, 1),
      0.2,
      0.4
    )
    rider.material = riderMaterial

    return board
  })

  const variants = [corpan, desert, glacier]
  let activeVariant = variants[0]
  variants.forEach((variant, index) => {
    variant.pivot.setEnabled(index === 0)
  })

  // Sacred geometry state (only for corpan variant)
  let lastGeometrySpecs:
    | Array<{
        scale: number
        orbitRadius: number
        orbitSpeed: number
        rotationSpeed: number
        emissiveIntensity: number
      }>
    | null = null

  const setVariant = (id: string) => {
    const next = variants.find((variant) => variant.id === id)
    if (!next || next === activeVariant) {
      return
    }
    const leavingCorpan = activeVariant.id === "corpan" && next.id !== "corpan"
    const enteringCorpan = activeVariant.id !== "corpan" && next.id === "corpan"
    if (leavingCorpan) {
      geometryPool.forEach((geom) => {
        geom.inUse = false
        geom.mesh.setEnabled(false)
        geom.particleTrail?.stop()
      })
    }
    activeVariant.pivot.setEnabled(false)
    next.pivot.setEnabled(true)
    activeVariant = next
    if (enteringCorpan && lastGeometrySpecs) {
      configureGeometries(lastGeometrySpecs)
    }
  }

  // Sacred geometry system with object pooling for performance
  type GeometryPool = {
    mesh: Mesh
    orbitRadius: number
    orbitSpeed: number
    rotationSpeed: number
    orbitAngle: number
    orbitPlaneAngle: number // Angle of orbital plane (for 3D chaos)
    orbitTilt: number // Tilt of orbital plane
    inUse: boolean
    particleTrail: ParticleSystem | null
  }

  // Pre-create pool of 6 simple geometries (max we'll ever need)
  const geometryPool: GeometryPool[] = []
  const MAX_GEOMETRIES = 6

  const initGeometryPool = () => {
    if (!corpanRig || activeVariant.id !== "corpan") {
      return
    }


    // Color palette for variety
    const colors = [
      new Color3(0.835, 0.416, 0.102), // Clay orange
      new Color3(1.0, 0.7, 0.2),       // Gold
      new Color3(0.3, 0.8, 1.0),       // Cyan
      new Color3(1.0, 0.3, 0.5),       // Pink
      new Color3(0.5, 1.0, 0.3),       // Green
      new Color3(0.9, 0.3, 1.0),       // Purple
    ]

    // Shape types for VARIETY
    const shapeCreators = [
      () => MeshBuilder.CreatePolyhedron('geom', { type: 0, size: 0.2 }, scene), // Tetrahedron
      () => MeshBuilder.CreatePolyhedron('geom', { type: 1, size: 0.2 }, scene), // Octahedron
      () => MeshBuilder.CreatePolyhedron('geom', { type: 3, size: 0.2 }, scene), // Icosahedron
      () => MeshBuilder.CreateBox('geom', { size: 0.2 }, scene),                 // Cube
      () => MeshBuilder.CreateTorus('geom', { diameter: 0.25, thickness: 0.05, tessellation: 16 }, scene), // Torus
      () => MeshBuilder.CreateCylinder('geom', { height: 0.25, diameter: 0.15, tessellation: 8 }, scene),  // Cylinder
    ]

    for (let i = 0; i < MAX_GEOMETRIES; i++) {
      const mesh = shapeCreators[i % shapeCreators.length]()

      // NO PARENT - position in world space directly!
      mesh.isPickable = false
      mesh.setEnabled(false)
      mesh.isVisible = true
      mesh.alwaysSelectAsActiveMesh = true

      // Variety: alternate wireframe and solid
      const isWireframe = i % 2 === 0

      const material = new StandardMaterial(`sacred-mat-${i}`, scene)
      material.emissiveColor = colors[i % colors.length]
      material.disableLighting = true
      material.backFaceCulling = false
      material.wireframe = isWireframe
      material.alpha = 1.0
      material.freeze() // Freeze material for performance
      mesh.material = material

      // Create physics-based magical particle trail
      const particleTrail = new ParticleSystem(`trail-${i}`, 40, scene)

      // Create a simple procedural texture for particles (required - null texture = invisible!)
      const particleTexture = new Texture('data:image/svg+xml;base64,' + btoa(`
        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32">
          <circle cx="16" cy="16" r="15" fill="white" opacity="0.9"/>
        </svg>
      `), scene)
      particleTrail.particleTexture = particleTexture

      particleTrail.emitter = new Vector3(0, 0, 0)
      particleTrail.minSize = 0.015
      particleTrail.maxSize = 0.04
      particleTrail.minLifeTime = 0.6
      particleTrail.maxLifeTime = 1.2
      particleTrail.emitRate = 30 // Will be adjusted based on performance
      particleTrail.minEmitPower = 0.2
      particleTrail.maxEmitPower = 0.6
      particleTrail.updateSpeed = 0.016
      // Particles trail behind avatar in positive Z direction
      particleTrail.direction1 = new Vector3(-0.2, -0.1, 0.5)
      particleTrail.direction2 = new Vector3(0.2, 0.1, 1.0)
      particleTrail.gravity = new Vector3(0, -0.2, 0) // Slight downward drift
      // Use geometry color with more transparency
      particleTrail.color1 = new Color4(colors[i % colors.length].r, colors[i % colors.length].g, colors[i % colors.length].b, 0.9)
      particleTrail.color2 = new Color4(colors[i % colors.length].r, colors[i % colors.length].g, colors[i % colors.length].b, 0.5)
      particleTrail.colorDead = new Color4(colors[i % colors.length].r * 0.2, colors[i % colors.length].g * 0.2, colors[i % colors.length].b * 0.2, 0)
      particleTrail.blendMode = ParticleSystem.BLENDMODE_ADD

      geometryPool.push({
        mesh,
        orbitRadius: 1.0,
        orbitSpeed: 0.5,
        rotationSpeed: 0.5,
        orbitAngle: Math.random() * Math.PI * 2, // Random start angle
        orbitPlaneAngle: Math.random() * Math.PI * 2, // Random orbital plane
        orbitTilt: Math.random() * Math.PI - Math.PI / 2, // Random tilt (-90 to +90 degrees)
        inUse: false,
        particleTrail
      })
    }
  }

  const configureGeometries = (specs: Array<{
    scale: number
    orbitRadius: number
    orbitSpeed: number
    rotationSpeed: number
    emissiveIntensity: number
  }>) => {
    if (!corpanRig || activeVariant.id !== "corpan") return

    console.log(`[GEOMETRY] Configuring ${specs.length} geometries`)
    lastGeometrySpecs = specs

    // Disable all first
    geometryPool.forEach(g => {
      g.inUse = false
      g.mesh.setEnabled(false)
      g.particleTrail?.stop()
    })

    // Configure and enable needed geometries
    const count = Math.min(specs.length, MAX_GEOMETRIES)
    console.log(`[GEOMETRY] Enabling ${count} geometries from pool of ${geometryPool.length}`)
    for (let i = 0; i < count; i++) {
      const spec = specs[i]
      const geom = geometryPool[i]

      geom.inUse = true
      geom.orbitRadius = spec.orbitRadius
      geom.orbitSpeed = spec.orbitSpeed
      geom.rotationSpeed = spec.rotationSpeed
      geom.mesh.scaling.setAll(spec.scale)

      // Update brightness but keep original colors for variety
      const mat = geom.mesh.material as StandardMaterial
      if (mat && mat.emissiveColor) {
        const baseColor = mat.emissiveColor.clone()
        mat.emissiveColor = scaleColor(baseColor, spec.emissiveIntensity)
      }

      geom.mesh.setEnabled(true)
      geom.particleTrail?.start()
    }
  }

  // Particle intensity tracking for continuous feedback
  let particleIntensity = 1.0 // 0.5 to 2.0 range

  const adjustParticleIntensity = (correct: boolean) => {
    if (correct) {
      particleIntensity = Math.min(2.0, particleIntensity + 0.1)
    } else {
      particleIntensity = Math.max(0.5, particleIntensity - 0.15)
    }

    // Update all active particle systems
    geometryPool.forEach((geom) => {
      if (geom.inUse && geom.particleTrail) {
        geom.particleTrail.emitRate = 30 * particleIntensity
      }
    })
  }

  const updateSacredGeometries = (time: number, dt: number) => {
    if (!corpanRig || activeVariant.id !== "corpan") return

    // Get avatar world position
    const avatarWorldPos = corpanRig.earPivot.getAbsolutePosition()

    geometryPool.forEach((geom) => {
      if (!geom.inUse) return

      // Update orbit angle (can be negative for reverse direction)
      geom.orbitAngle += geom.orbitSpeed * dt

      // Calculate position in tilted orbital plane (electron cloud chaos)
      // Base orbit in local plane
      const orbitX = Math.cos(geom.orbitAngle) * geom.orbitRadius
      const orbitY = Math.sin(geom.orbitAngle) * geom.orbitRadius

      // Apply tilt to create 3D orbital plane
      const cosTilt = Math.cos(geom.orbitTilt)
      const sinTilt = Math.sin(geom.orbitTilt)
      const cosPlane = Math.cos(geom.orbitPlaneAngle)
      const sinPlane = Math.sin(geom.orbitPlaneAngle)

      // Rotate orbit into 3D space
      const localX = orbitX * cosPlane - orbitY * sinPlane * cosTilt
      const localY = orbitY * sinTilt + Math.sin(time * 0.8) * geom.orbitRadius * 0.2 // Add chaotic wobble
      const localZ = orbitX * sinPlane + orbitY * cosPlane * cosTilt

      // Apply avatar's world position
      const worldX = avatarWorldPos.x + localX
      const worldY = avatarWorldPos.y + localY
      const worldZ = avatarWorldPos.z + localZ

      geom.mesh.position.set(worldX, worldY, worldZ)

      // Update particle emitter position to follow mesh
      if (geom.particleTrail && geom.particleTrail.emitter instanceof Vector3) {
        geom.particleTrail.emitter.set(worldX, worldY, worldZ)
      }

      // Rotate the geometry itself (faster and more chaotic)
      geom.mesh.rotation.x += geom.rotationSpeed * dt * 1.2
      geom.mesh.rotation.y += geom.rotationSpeed * dt * 0.9
      geom.mesh.rotation.z += geom.rotationSpeed * dt * 0.7
    })
  }

  const disposeGeometryPool = () => {
    geometryPool.forEach((geom) => {
      geom.particleTrail?.dispose()
      geom.mesh.dispose()
    })
    geometryPool.length = 0
  }

  // Removed particle system for performance - effects now come from geometry glow

  return {
    root,
    visualRoot,
    variants,
    setVariant,
    getActivePivot: () => activeVariant.pivot,
    getActiveBoard: () => activeVariant.board,
    updateRings: (heightOffset: number, alpha: number, ringCount: number, ringScale: number) => {
      if (!corpanRig || activeVariant.id !== "corpan") {
        return
      }
      // corpanRig is guaranteed non-null after the check above
      const rig = corpanRig

      // Base heights CENTERED on electricity (at ~0.8)
      const baseHeights = [0.6, 0.8, 1.0]

      // Update each ring's visibility, position, and scale
      rig.rings.forEach((ring, index) => {
        const shouldShow = index < ringCount
        ring.setEnabled(shouldShow)

        if (shouldShow) {
          // Position rings higher, near the electricity
          ring.position.y = baseHeights[index] + heightOffset

          // Scale rings
          ring.scaling.setAll(ringScale)

          // Update alpha for crown ring
          if (index === 2) {
            rig.glowMats[2].alpha = alpha
            if (ring.material instanceof StandardMaterial) {
              ring.material.alpha = alpha
            }
          }
        }
      })
    },
    initGeometryPool,
    configureGeometries,
    updateSacredGeometries,
    adjustParticleIntensity,
    disposeGeometryPool,
    updateLogo: (time: number, camera?: Camera | null) => {
      if (!corpanRig || activeVariant.id !== "corpan") {
        return
      }
      const pulse = AVATAR.pulseMin + Math.sin(time * 2.2) * AVATAR.pulseMax
      const glow = scaleColor(corpanRig.baseGlow, 0.85 + pulse * 0.45)
      const accent = scaleColor(corpanRig.baseAccent, 0.9 + pulse * 0.6)
      corpanRig.glowMats[0].emissiveColor.copyFrom(glow)
      corpanRig.glowMats[1].emissiveColor.copyFrom(accent)
      corpanRig.glowMats[2].emissiveColor.copyFrom(
        scaleColor(corpanRig.baseAccent, 0.7 + pulse * 0.8)
      )
      corpanRig.rings[0].rotation.z = time * 0.35
      corpanRig.rings[1].rotation.z = -time * 0.55
      corpanRig.rings[2].rotation.z = time * 0.28
      corpanRig.container.rotation.y = Math.sin(time * 0.65) * 0.08
      corpanRig.container.rotation.x = Math.sin(time * 0.8) * 0.05
      corpanRig.light.intensity = AVATAR.light.intensity * (0.75 + pulse * 0.35)
      if (camera) {
        const forward = camera.position.subtract(
          corpanRig.earPivot.getAbsolutePosition()
        )
        forward.y = 0
        if (forward.lengthSquared() > 0.0001) {
          forward.normalize()
          const yaw = Math.atan2(forward.x, forward.z)
          const target = Quaternion.FromEulerAngles(0, yaw, 0)
          const desired = target.multiply(corpanRig.earFacingOffset)
          const current =
            corpanRig.earPivot.rotationQuaternion ?? Quaternion.Identity()
          corpanRig.earPivot.rotationQuaternion = Quaternion.Slerp(
            current,
            desired,
            0.18
          )
        }
      }
    },
  }
}
