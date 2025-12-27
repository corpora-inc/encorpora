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
  TransformNode,
  Vector3,
} from "@babylonjs/core"
import corpanLogoUrl from "../assets/models/corpan_logo.glb"
import type { HoverVariant } from "../core/types"
import { createEmissivePbr, tuneLogoMaterial, scaleColor } from "../core/utils"

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
    const clay = new Color3(0.835, 0.416, 0.102)

    const boardMaterial = createEmissivePbr(
      "corpan-board-mat",
      scene,
      clay,
      scaleColor(clay, 0.35),
      0.6,
      0.35
    )
    tuneLogoMaterial(boardMaterial, 1.1)

    const earMaterial = createEmissivePbr(
      "corpan-ear-mat",
      scene,
      clay,
      scaleColor(clay, 0.4),
      0.5,
      0.4
    )
    tuneLogoMaterial(earMaterial, 1.1)

    const glowMaterial = new StandardMaterial("corpan-glow-mat", scene)
    glowMaterial.emissiveColor = scaleColor(clay, 1.05)
    glowMaterial.disableLighting = true
    glowMaterial.alpha = 0.5

    const accentMaterial = new StandardMaterial("corpan-accent-mat", scene)
    accentMaterial.emissiveColor = scaleColor(clay, 0.9)
    accentMaterial.disableLighting = true
    accentMaterial.alpha = 0.6

    const ringMaterial = new StandardMaterial("corpan-ring-mat", scene)
    ringMaterial.emissiveColor = scaleColor(clay, 0.85)
    ringMaterial.disableLighting = true
    ringMaterial.alpha = 0.65

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

    const outlineColor = scaleColor(clay, 1.1)
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
        mesh.outlineWidth = 0.025
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
    logoLight.diffuse = new Color3(1, 0.72, 0.4)
    logoLight.intensity = 0.85
    logoLight.range = 6

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

  const neon = createVariant("neon", "Neon Drift", (pivot) => {
    const board = MeshBuilder.CreateBox(
      "neon-board",
      { width: 1.4, height: 0.08, depth: 0.6 },
      scene
    )
    board.parent = pivot
    board.position.y = 0.08

    const boardMaterial = createEmissivePbr(
      "neon-board-mat",
      scene,
      new Color3(0.08, 0.16, 0.3),
      new Color3(0.2, 0.4, 0.8),
      0.25,
      0.45
    )
    board.material = boardMaterial

    const rider = MeshBuilder.CreateSphere(
      "neon-rider",
      { diameter: 0.42 },
      scene
    )
    rider.parent = pivot
    rider.position.y = 0.55

    const riderMaterial = createEmissivePbr(
      "neon-rider-mat",
      scene,
      new Color3(0.9, 0.97, 1),
      new Color3(0.5, 0.8, 1),
      0.1,
      0.3
    )
    rider.material = riderMaterial

    const halo = MeshBuilder.CreateTorus(
      "neon-halo",
      { diameter: 0.55, thickness: 0.04 },
      scene
    )
    halo.parent = pivot
    halo.position.y = 0.78
    halo.rotation.x = Math.PI / 2
    const haloMat = createEmissivePbr(
      "neon-halo-mat",
      scene,
      new Color3(0.04, 0.08, 0.15),
      new Color3(0.25, 0.9, 1),
      0,
      0.2
    )
    halo.material = haloMat

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

  const crystalWave = createVariant("crystal-wave", "Crystal Wave", (pivot) => {
    const prism = MeshBuilder.CreateCylinder(
      "crystal-prism",
      { height: 0.6, diameter: 0.5, tessellation: 6 },
      scene
    )
    prism.parent = pivot
    prism.position.y = 0.4
    prism.rotation.y = Math.PI / 6

    const prismMaterial = createEmissivePbr(
      "crystal-prism-mat",
      scene,
      new Color3(0.3, 0.15, 0.5),
      new Color3(0.6, 0.3, 0.9),
      0.8,
      0.1
    )
    prism.material = prismMaterial

    const createShard = (name: string, x: number, y: number, z: number, scale: number) => {
      const shard = MeshBuilder.CreateBox(
        name,
        { width: 0.08 * scale, height: 0.25 * scale, depth: 0.08 * scale },
        scene
      )
      shard.parent = pivot
      shard.position.set(x, y, z)
      shard.rotation.set(
        Math.random() * Math.PI * 0.3,
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 0.3
      )

      const shardMaterial = createEmissivePbr(
        `${name}-mat`,
        scene,
        new Color3(0.5, 0.3, 0.7),
        new Color3(0.8, 0.5, 1),
        0.9,
        0.05
      )
      shard.material = shardMaterial
      return shard
    }

    createShard("crystal-shard-1", -0.4, 0.6, 0.2, 0.8)
    createShard("crystal-shard-2", 0.35, 0.5, -0.15, 0.9)
    createShard("crystal-shard-3", 0.1, 0.75, 0.3, 0.7)
    createShard("crystal-shard-4", -0.2, 0.3, -0.25, 0.6)

    return prism
  })

  const solarFlare = createVariant("solar-flare", "Solar Flare", (pivot) => {
    const board = MeshBuilder.CreateCylinder(
      "solar-board",
      { height: 1.8, diameterTop: 0.25, diameterBottom: 0.3, tessellation: 16 },
      scene
    )
    board.parent = pivot
    board.position.y = 0.12
    board.rotation.x = Math.PI / 2
    board.rotation.z = Math.PI / 2

    const boardMaterial = createEmissivePbr(
      "solar-board-mat",
      scene,
      new Color3(0.4, 0.15, 0.05),
      new Color3(1, 0.4, 0.1),
      0.3,
      0.4
    )
    board.material = boardMaterial

    const createFlameFin = (name: string, x: number) => {
      const fin = MeshBuilder.CreateBox(
        name,
        { width: 0.08, height: 0.35, depth: 0.25 },
        scene
      )
      fin.parent = pivot
      fin.position.set(x, 0.12, 0)

      const finMaterial = createEmissivePbr(
        `${name}-mat`,
        scene,
        new Color3(0.5, 0.1, 0.05),
        new Color3(1, 0.3, 0),
        0.1,
        0.3
      )
      fin.material = finMaterial
      return fin
    }

    createFlameFin("solar-fin-left", -0.7)
    createFlameFin("solar-fin-right", 0.7)

    const orb = MeshBuilder.CreateSphere("solar-orb", { diameter: 0.4 }, scene)
    orb.parent = pivot
    orb.position.y = 0.55

    const orbMaterial = createEmissivePbr(
      "solar-orb-mat",
      scene,
      new Color3(0.9, 0.4, 0.1),
      new Color3(1, 0.6, 0.2),
      0.1,
      0.2
    )
    orb.material = orbMaterial

    return board
  })

  const variants = [corpan, neon, desert, glacier, crystalWave, solarFlare]
  let activeVariant = variants[0]
  variants.forEach((variant, index) => {
    variant.pivot.setEnabled(index === 0)
  })

  const setVariant = (id: string) => {
    const next = variants.find((variant) => variant.id === id)
    if (!next || next === activeVariant) {
      return
    }
    activeVariant.pivot.setEnabled(false)
    next.pivot.setEnabled(true)
    activeVariant = next
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
      console.log('[GEOMETRY] Cannot init pool - no corpanRig or wrong variant')
      return
    }

    console.log('[GEOMETRY] Initializing geometry pool with 6 shapes')

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

      // Create magical particle trail for this geometry
      const particleTrail = new ParticleSystem(`trail-${i}`, 20, scene) // 20 particles per trail
      particleTrail.particleTexture = null // No texture for performance
      particleTrail.emitter = mesh
      particleTrail.minSize = 0.03
      particleTrail.maxSize = 0.08
      particleTrail.minLifeTime = 0.3
      particleTrail.maxLifeTime = 0.6
      particleTrail.emitRate = 40
      particleTrail.minEmitPower = 0.05
      particleTrail.maxEmitPower = 0.15
      particleTrail.updateSpeed = 0.016
      particleTrail.gravity = new Vector3(0, 0.5, 0) // Gentle upward drift
      particleTrail.color1 = new Color4(colors[i % colors.length].r, colors[i % colors.length].g, colors[i % colors.length].b, 1.0)
      particleTrail.color2 = new Color4(colors[i % colors.length].r, colors[i % colors.length].g, colors[i % colors.length].b, 0.6)
      particleTrail.colorDead = new Color4(colors[i % colors.length].r * 0.5, colors[i % colors.length].g * 0.5, colors[i % colors.length].b * 0.5, 0)
      particleTrail.blendMode = ParticleSystem.BLENDMODE_ADD // Additive blending for glow effect

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

    console.log(`[GEOMETRY] Pool initialized with ${geometryPool.length} geometries`)
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
      geom.mesh.position.set(
        avatarWorldPos.x + localX,
        avatarWorldPos.y + localY,
        avatarWorldPos.z + localZ
      )

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
      // Base heights CENTERED on electricity (at ~0.8)
      const baseHeights = [0.6, 0.8, 1.0]

      // Update each ring's visibility, position, and scale
      corpanRig.rings.forEach((ring, index) => {
        const shouldShow = index < ringCount
        ring.setEnabled(shouldShow)

        if (shouldShow) {
          // Position rings higher, near the electricity
          ring.position.y = baseHeights[index] + heightOffset

          // Scale rings
          ring.scaling.setAll(ringScale)

          // Update alpha for crown ring
          if (index === 2) {
            corpanRig.glowMats[2].alpha = alpha
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
    disposeGeometryPool,
    updateLogo: (time: number, camera?: Camera | null) => {
      if (!corpanRig || activeVariant.id !== "corpan") {
        return
      }
      const pulse = 0.65 + Math.sin(time * 2.2) * 0.2
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
      corpanRig.light.intensity = 0.75 + pulse * 0.45
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
