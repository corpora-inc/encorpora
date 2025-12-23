import {
  Color3,
  Color4,
  DirectionalLight,
  Engine,
  HemisphericLight,
  Mesh,
  MeshBuilder,
  Scene,
  StandardMaterial,
  TransformNode,
  UniversalCamera,
  Vector3,
} from "@babylonjs/core"

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max)

const lerp = (start: number, end: number, t: number) =>
  start + (end - start) * t

const GRID = {
  leftX: -1.6,
  rightX: 1.6,
  topY: 1.8,
  midY: -0.6,
  bottomY: -3,
  z: 0.18,
}

const ROAD = {
  width: 8.8,
  length: 90,
  segments: 50,
  speed: 14,
  curveAmount: 1.4,
  y: -3.0,
  zOffset: -4.0,
}

const MOVE_SPEED = 14

const computeCurve = (curveTime: number, z: number) => {
  const blend = Math.pow(z / ROAD.length, 1.35)
  return Math.sin(curveTime + z * 0.08) * ROAD.curveAmount * blend
}

const rowToY = (row: number) => {
  if (row <= 0) {
    return GRID.topY
  }
  if (row === 1) {
    return GRID.midY
  }
  return GRID.bottomY
}

type RoadPalette = {
  road: Color3
  emissive: Color3
  center: Color3
  edge: Color3
}

type RoadState = {
  mesh: Mesh
  update: (dt: number) => void
  getFarCenterX: () => number
  getTravel: () => number
  getCurveAt: (z: number) => number
  setPalette: (palette: RoadPalette) => void
}

const createRoad = (scene: Scene): RoadState => {
  const pathArray: Vector3[][] = [[], []]
  const centerPoints: Vector3[] = []
  const leftPoints: Vector3[] = []
  const rightPoints: Vector3[] = []

  for (let i = 0; i < ROAD.segments; i += 1) {
    pathArray[0].push(new Vector3())
    pathArray[1].push(new Vector3())
    centerPoints.push(new Vector3())
    leftPoints.push(new Vector3())
    rightPoints.push(new Vector3())
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

  const roadMaterial = new StandardMaterial("road-mat", scene)
  road.material = roadMaterial

  const centerLine = MeshBuilder.CreateLines(
    "center-line",
    { points: centerPoints, updatable: true },
    scene
  )
  centerLine.color = new Color3(0.25, 0.7, 1)

  const leftEdge = MeshBuilder.CreateLines(
    "edge-left",
    { points: leftPoints, updatable: true },
    scene
  )
  leftEdge.color = new Color3(0.1, 0.5, 0.9)

  const rightEdge = MeshBuilder.CreateLines(
    "edge-right",
    { points: rightPoints, updatable: true },
    scene
  )
  rightEdge.color = new Color3(0.1, 0.5, 0.9)

  const applyPalette = (palette: RoadPalette) => {
    roadMaterial.diffuseColor = palette.road
    roadMaterial.emissiveColor = palette.emissive
    roadMaterial.specularColor = palette.road.scale(0.6)
    centerLine.color = palette.center
    leftEdge.color = palette.edge
    rightEdge.color = palette.edge
  }

  let travel = 0
  let curveTime = 0
  let farCenterX = 0

  const update = (dt: number) => {
    travel = (travel + ROAD.speed * dt) % ROAD.length
    curveTime += dt * 0.35
    const spacing = ROAD.length / (ROAD.segments - 1)

    for (let i = 0; i < ROAD.segments; i += 1) {
      const raw = (i * spacing + travel) % ROAD.length
      const baseZ = ROAD.length - raw
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

      const center = centerPoints[i]
      center.x = curve
      center.y = ROAD.y + 0.04
      center.z = z

      const leftEdgePoint = leftPoints[i]
      leftEdgePoint.x = left.x
      leftEdgePoint.y = ROAD.y + 0.06
      leftEdgePoint.z = z

      const rightEdgePoint = rightPoints[i]
      rightEdgePoint.x = right.x
      rightEdgePoint.y = ROAD.y + 0.06
      rightEdgePoint.z = z

      if (i === ROAD.segments - 1) {
        farCenterX = curve
      }
    }

    MeshBuilder.CreateRibbon("road", { pathArray, instance: road })
    MeshBuilder.CreateLines("center-line", {
      points: centerPoints,
      instance: centerLine,
    })
    MeshBuilder.CreateLines("edge-left", {
      points: leftPoints,
      instance: leftEdge,
    })
    MeshBuilder.CreateLines("edge-right", {
      points: rightPoints,
      instance: rightEdge,
    })
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

type HoverVariant = {
  id: string
  name: string
  pivot: TransformNode
  board: Mesh
}

const createHoverboard = (scene: Scene) => {
  const root = new TransformNode("hover-root", scene)

  const createVariant = (
    id: string,
    name: string,
    build: (pivot: TransformNode) => Mesh
  ): HoverVariant => {
    const pivot = new TransformNode(`${id}-pivot`, scene)
    pivot.parent = root
    const board = build(pivot)
    return { id, name, pivot, board }
  }

  const neon = createVariant("neon", "Neon Drift", (pivot) => {
    const board = MeshBuilder.CreateBox(
      "neon-board",
      { width: 1.4, height: 0.08, depth: 0.6 },
      scene
    )
    board.parent = pivot
    board.position.y = 0.08

    const boardMaterial = new StandardMaterial("neon-board-mat", scene)
    boardMaterial.diffuseColor = new Color3(0.08, 0.16, 0.3)
    boardMaterial.emissiveColor = new Color3(0.2, 0.4, 0.8)
    board.material = boardMaterial

    const rider = MeshBuilder.CreateSphere(
      "neon-rider",
      { diameter: 0.42 },
      scene
    )
    rider.parent = pivot
    rider.position.y = 0.55

    const riderMaterial = new StandardMaterial("neon-rider-mat", scene)
    riderMaterial.diffuseColor = new Color3(0.9, 0.97, 1)
    riderMaterial.emissiveColor = new Color3(0.5, 0.8, 1)
    rider.material = riderMaterial

    const halo = MeshBuilder.CreateTorus(
      "neon-halo",
      { diameter: 0.55, thickness: 0.04 },
      scene
    )
    halo.parent = pivot
    halo.position.y = 0.78
    halo.rotation.x = Math.PI / 2
    const haloMat = new StandardMaterial("neon-halo-mat", scene)
    haloMat.emissiveColor = new Color3(0.25, 0.9, 1)
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

    const boardMaterial = new StandardMaterial("desert-board-mat", scene)
    boardMaterial.diffuseColor = new Color3(0.35, 0.16, 0.08)
    boardMaterial.emissiveColor = new Color3(0.45, 0.2, 0.12)
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

    const riderMaterial = new StandardMaterial("desert-rider-mat", scene)
    riderMaterial.diffuseColor = new Color3(0.92, 0.86, 0.74)
    riderMaterial.emissiveColor = new Color3(0.7, 0.5, 0.32)
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

    const boardMaterial = new StandardMaterial("glacier-board-mat", scene)
    boardMaterial.diffuseColor = new Color3(0.12, 0.2, 0.35)
    boardMaterial.emissiveColor = new Color3(0.25, 0.5, 0.85)
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

    const riderMaterial = new StandardMaterial("glacier-rider-mat", scene)
    riderMaterial.diffuseColor = new Color3(0.86, 0.94, 1)
    riderMaterial.emissiveColor = new Color3(0.5, 0.75, 1)
    rider.material = riderMaterial

    return board
  })

  const variants = [neon, desert, glacier]
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

  return {
    root,
    variants,
    setVariant,
    getActivePivot: () => activeVariant.pivot,
    getActiveBoard: () => activeVariant.board,
  }
}

type SceneProp = {
  mesh: Mesh
  baseZ: number
  offsetX: number
  baseY: number
  side: -1 | 1
}

const createPropField = (
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

const updatePropField = (props: SceneProp[], road: RoadState) => {
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

type Skin = {
  id: string
  name: string
  variantId: string
  palette: RoadPalette
  sky: Color4
  hemi: {
    intensity: number
    diffuse: Color3
    ground: Color3
  }
  accent: {
    intensity: number
    color: Color3
  }
  envRoot: TransformNode
  props: SceneProp[]
}

type InputState = {
  row: number
  col: number
  tiltEnabled: boolean
  tiltActive: boolean
  tiltX: number
  tiltY: number
}

const initInput = (
  canvas: HTMLCanvasElement,
  tiltButton: HTMLButtonElement
) => {
  const state: InputState = {
    row: 2,
    col: 0,
    tiltEnabled: false,
    tiltActive: false,
    tiltX: 0,
    tiltY: 0,
  }

  const onKey = (event: KeyboardEvent) => {
    if (event.key === "ArrowUp" || event.key === "w") {
      state.row = clamp(state.row - 1, 0, 2)
    }
    if (event.key === "ArrowDown" || event.key === "s") {
      state.row = clamp(state.row + 1, 0, 2)
    }
    if (event.key === "ArrowLeft" || event.key === "a") {
      state.col = 0
    }
    if (event.key === "ArrowRight" || event.key === "d") {
      state.col = 1
    }
  }

  const onPointer = (event: PointerEvent) => {
    const rect = canvas.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top
    state.col = x < rect.width / 2 ? 0 : 1
    if (y < rect.height / 3) {
      state.row = 0
    } else if (y < (rect.height * 2) / 3) {
      state.row = 1
    } else {
      state.row = 2
    }
  }

  const orientationHandler = (event: DeviceOrientationEvent) => {
    if (event.gamma == null || event.beta == null) {
      return
    }
    state.tiltActive = true
    state.tiltX = clamp(event.gamma / 16, -1, 1)
    const minPitch = 52
    const maxPitch = 62
    const pitch = clamp(event.beta, minPitch, maxPitch)
    const normalized = (pitch - minPitch) / (maxPitch - minPitch)
    state.tiltY = normalized * 2 - 1
  }

  const enableTilt = () => {
    if (state.tiltEnabled) {
      return
    }
    state.tiltEnabled = true
    tiltButton.textContent = "Motion Active"
    window.addEventListener("deviceorientation", orientationHandler)
  }

  const requestTilt = async () => {
    const requestPermission = (
      DeviceOrientationEvent as unknown as {
        requestPermission?: () => Promise<"granted" | "denied">
      }
    ).requestPermission

    if (typeof requestPermission === "function") {
      try {
        const result = await requestPermission()
        if (result === "granted") {
          enableTilt()
        }
      } catch {
        // Ignore permission failures.
      }
    } else {
      enableTilt()
    }
  }

  window.addEventListener("keydown", onKey)
  canvas.addEventListener("pointerdown", onPointer)
  tiltButton.addEventListener("click", requestTilt)

  const dispose = () => {
    window.removeEventListener("keydown", onKey)
    canvas.removeEventListener("pointerdown", onPointer)
    window.removeEventListener("deviceorientation", orientationHandler)
    tiltButton.removeEventListener("click", requestTilt)
  }

  return { state, dispose }
}

export const createHoverRunner = (container: HTMLElement) => {
  const root = document.createElement("div")
  root.className = "hover-runner"
  container.appendChild(root)

  let wakeLock: { release: () => Promise<void> } | null = null
  const requestWakeLock = async () => {
    const wakeLockApi = (navigator as typeof navigator & {
      wakeLock?: { request?: (type: "screen") => Promise<{ release: () => Promise<void> }> }
    }).wakeLock
    if (!wakeLockApi?.request) {
      return
    }
    try {
      wakeLock = await wakeLockApi.request("screen")
    } catch {
      // Ignore wake lock failures.
    }
  }
  const onVisibilityChange = () => {
    if (document.visibilityState === "visible" && !wakeLock) {
      void requestWakeLock()
    }
  }

  const canvas = document.createElement("canvas")
  root.appendChild(canvas)

  const hudBackdrop = document.createElement("div")
  hudBackdrop.className = "hud-backdrop"
  root.appendChild(hudBackdrop)

  const hudPanel = document.createElement("div")
  hudPanel.className = "hud-panel"
  root.appendChild(hudPanel)

  const hudRow = document.createElement("div")
  hudRow.className = "hud-row"

  const hudLeft = document.createElement("div")
  hudLeft.className = "hud-left"
  const hudSubtitle = document.createElement("div")
  hudSubtitle.className = "hud-subtitle"
  hudSubtitle.textContent =
    "Tap to move between six lanes. Motion controls optional."
  hudLeft.append(hudSubtitle)

  const hudRight = document.createElement("div")
  hudRight.className = "hud-right"
  const hudMode = document.createElement("div")
  hudMode.className = "hud-title"
  hudMode.textContent = "Prototype"
  const hudSpeed = document.createElement("div")
  hudSpeed.className = "hud-speed"
  hudSpeed.textContent = `Speed ${ROAD.speed.toFixed(0)}`
  const hudSkin = document.createElement("div")
  hudSkin.className = "hud-skin"
  hudSkin.textContent = "Skin: Neon Drift"
  hudRight.append(hudMode, hudSpeed, hudSkin)

  hudRow.append(hudLeft, hudRight)

  const hudControls = document.createElement("div")
  hudControls.className = "hud-controls"

  hudPanel.append(hudRow, hudControls)

  const tiltButton = document.createElement("button")
  tiltButton.className = "tilt-button"
  tiltButton.type = "button"
  tiltButton.textContent = "Enable Motion"
  hudControls.appendChild(tiltButton)

  const hudExit = document.createElement("button")
  hudExit.className = "hud-exit"
  hudExit.type = "button"
  hudExit.textContent = "Exit"
  hudControls.appendChild(hudExit)

  const fabButton = document.createElement("button")
  fabButton.className = "hud-fab"
  fabButton.type = "button"
  fabButton.setAttribute("aria-label", "Open menu")
  fabButton.innerHTML = `
    <span class="hud-fab-icon" aria-hidden="true">⚙︎</span>
  `
  root.appendChild(fabButton)

  let panelOpen = false
  const setPanelOpen = (next: boolean) => {
    panelOpen = next
    hudPanel.classList.toggle("open", panelOpen)
    hudBackdrop.classList.toggle("open", panelOpen)
    fabButton.classList.toggle("open", panelOpen)
    fabButton.setAttribute("aria-label", panelOpen ? "Close menu" : "Open menu")
  }

  const requestExit = () => {
    try {
      window.dispatchEvent(new CustomEvent("corpan:exit"))
    } catch {
      // Ignore exit dispatch failures.
    }
    try {
      window.close()
    } catch {
      // Ignore window close failures.
    }
  }

  const onFabClick = () => {
    setPanelOpen(!panelOpen)
  }
  const onBackdropClick = () => {
    setPanelOpen(false)
  }

  const onWakeLockGesture = () => {
    void requestWakeLock()
    window.removeEventListener("pointerdown", onWakeLockGesture)
  }

  document.addEventListener("visibilitychange", onVisibilityChange)
  window.addEventListener("pointerdown", onWakeLockGesture)

  fabButton.addEventListener("click", onFabClick)
  hudBackdrop.addEventListener("click", onBackdropClick)
  hudExit.addEventListener("click", requestExit)

  const engine = new Engine(canvas, true, {
    preserveDrawingBuffer: true,
    stencil: true,
    antialias: true,
  })
  engine.setHardwareScalingLevel(1 / Math.min(window.devicePixelRatio || 1, 2))

  const scene = new Scene(engine)
  scene.clearColor = new Color4(0.02, 0.04, 0.08, 1)

  const camera = new UniversalCamera(
    "camera",
    new Vector3(0, -0.05, -4.1),
    scene
  )
  camera.setTarget(new Vector3(0, -1.05, 10))
  camera.fov = 1.46
  camera.minZ = 0.1
  camera.maxZ = 200
  camera.inputs.clear()

  const hemi = new HemisphericLight("hemi", new Vector3(0, 1, 0.4), scene)
  hemi.intensity = 0.5
  hemi.diffuse = new Color3(0.6, 0.75, 1)
  hemi.groundColor = new Color3(0.06, 0.08, 0.12)

  const accent = new DirectionalLight(
    "accent",
    new Vector3(-0.2, -1, 0.6),
    scene
  )
  accent.position = new Vector3(6, 8, -6)
  accent.intensity = 0.2
  accent.diffuse = new Color3(0.6, 0.7, 0.9)

  const road = createRoad(scene)
  const hoverboard = createHoverboard(scene)
  hoverboard.root.position = new Vector3(GRID.leftX, GRID.bottomY, GRID.z)

  const neonRoot = new TransformNode("env-neon", scene)
  const desertRoot = new TransformNode("env-desert", scene)
  const glacierRoot = new TransformNode("env-glacier", scene)

  const neonMat = new StandardMaterial("neon-prop-mat", scene)
  neonMat.diffuseColor = new Color3(0.04, 0.08, 0.14)
  neonMat.emissiveColor = new Color3(0.2, 0.75, 1)

  const neonProps = createPropField(neonRoot, {
    count: 26,
    spacing: 3.2,
    offsetX: 1.1,
    offsetXJitter: 0.6,
    baseY: 0.45,
    baseYJitter: 0.2,
    buildMesh: (index) => {
      const height = 0.7 + (index % 4) * 0.35
      const mesh = MeshBuilder.CreateCylinder(
        `neon-pylon-${index}`,
        { height, diameter: 0.12 },
        scene
      )
      mesh.material = neonMat
      mesh.rotation.y = Math.random() * Math.PI
      return mesh
    },
  })

  const desertMat = new StandardMaterial("desert-prop-mat", scene)
  desertMat.diffuseColor = new Color3(0.4, 0.22, 0.12)
  desertMat.emissiveColor = new Color3(0.2, 0.12, 0.08)

  const desertProps = createPropField(desertRoot, {
    count: 22,
    spacing: 4.2,
    offsetX: 1.4,
    offsetXJitter: 0.8,
    baseY: 0.9,
    baseYJitter: 0.3,
    buildMesh: (index) => {
      const height = 1.6 + (index % 3) * 0.6
      const mesh = MeshBuilder.CreateCylinder(
        `desert-spire-${index}`,
        { height, diameterTop: 0.18, diameterBottom: 0.6 },
        scene
      )
      mesh.material = desertMat
      mesh.rotation.y = Math.random() * Math.PI
      return mesh
    },
  })

  const glacierMat = new StandardMaterial("glacier-prop-mat", scene)
  glacierMat.diffuseColor = new Color3(0.15, 0.25, 0.42)
  glacierMat.emissiveColor = new Color3(0.2, 0.55, 0.95)

  const glacierProps = createPropField(glacierRoot, {
    count: 24,
    spacing: 3.8,
    offsetX: 1.25,
    offsetXJitter: 0.7,
    baseY: 0.6,
    baseYJitter: 0.25,
    buildMesh: (index) => {
      const height = 1.2 + (index % 4) * 0.5
      const mesh = MeshBuilder.CreateCylinder(
        `glacier-shard-${index}`,
        { height, diameterTop: 0.08, diameterBottom: 0.5 },
        scene
      )
      mesh.material = glacierMat
      mesh.rotation.y = Math.random() * Math.PI
      mesh.rotation.z = (Math.random() - 0.5) * 0.2
      return mesh
    },
  })

  const skins: Skin[] = [
    {
      id: "neon",
      name: "Neon Drift",
      variantId: "neon",
      envRoot: neonRoot,
      props: neonProps,
      palette: {
        road: new Color3(0.06, 0.08, 0.12),
        emissive: new Color3(0.02, 0.04, 0.08),
        center: new Color3(0.25, 0.7, 1),
        edge: new Color3(0.12, 0.55, 0.95),
      },
      sky: new Color4(0.02, 0.04, 0.08, 1),
      hemi: {
        intensity: 0.6,
        diffuse: new Color3(0.6, 0.75, 1),
        ground: new Color3(0.06, 0.08, 0.12),
      },
      accent: {
        intensity: 0.25,
        color: new Color3(0.6, 0.8, 1),
      },
    },
    {
      id: "desert",
      name: "Sunset Skimmer",
      variantId: "desert",
      envRoot: desertRoot,
      props: desertProps,
      palette: {
        road: new Color3(0.12, 0.08, 0.06),
        emissive: new Color3(0.08, 0.04, 0.02),
        center: new Color3(1, 0.64, 0.3),
        edge: new Color3(0.85, 0.35, 0.2),
      },
      sky: new Color4(0.08, 0.04, 0.02, 1),
      hemi: {
        intensity: 0.5,
        diffuse: new Color3(1, 0.75, 0.5),
        ground: new Color3(0.18, 0.1, 0.08),
      },
      accent: {
        intensity: 0.3,
        color: new Color3(1, 0.6, 0.35),
      },
    },
    {
      id: "glacier",
      name: "Glacier Pulse",
      variantId: "glacier",
      envRoot: glacierRoot,
      props: glacierProps,
      palette: {
        road: new Color3(0.04, 0.1, 0.16),
        emissive: new Color3(0.02, 0.05, 0.12),
        center: new Color3(0.45, 0.9, 1),
        edge: new Color3(0.28, 0.7, 0.95),
      },
      sky: new Color4(0.02, 0.06, 0.12, 1),
      hemi: {
        intensity: 0.55,
        diffuse: new Color3(0.7, 0.88, 1),
        ground: new Color3(0.04, 0.08, 0.16),
      },
      accent: {
        intensity: 0.28,
        color: new Color3(0.5, 0.8, 1),
      },
    },
  ]

  let activeSkin = skins[0]
  const applySkin = (id: string) => {
    const next = skins.find((skin) => skin.id === id) ?? skins[0]
    skins.forEach((skin) => {
      const enabled = skin.id === next.id
      skin.props.forEach((prop) => prop.mesh.setEnabled(enabled))
    })
    hoverboard.setVariant(next.variantId)
    road.setPalette(next.palette)
    scene.clearColor = next.sky
    hemi.intensity = next.hemi.intensity
    hemi.diffuse = next.hemi.diffuse
    hemi.groundColor = next.hemi.ground
    accent.intensity = next.accent.intensity
    accent.diffuse = next.accent.color
    activeSkin = next
    hudSkin.textContent = `Skin: ${next.name}`
  }
  applySkin(activeSkin.id)

  const skinPanel = document.createElement("div")
  skinPanel.className = "skin-panel"
  const skinLabel = document.createElement("label")
  skinLabel.textContent = "Skin"
  const skinSelect = document.createElement("select")
  skinSelect.className = "skin-select"
  skins.forEach((skin) => {
    const option = document.createElement("option")
    option.value = skin.id
    option.textContent = skin.name
    skinSelect.appendChild(option)
  })
  skinSelect.value = activeSkin.id
  const skinCycle = document.createElement("button")
  skinCycle.className = "skin-cycle"
  skinCycle.type = "button"
  skinCycle.textContent = "Cycle"
  skinPanel.append(skinLabel, skinSelect, skinCycle)
  hudControls.insertBefore(skinPanel, tiltButton)

  const onSkinChange = () => {
    applySkin(skinSelect.value)
  }
  const onSkinCycle = () => {
    const currentIndex = skins.findIndex((skin) => skin.id === activeSkin.id)
    const nextIndex = (currentIndex + 1) % skins.length
    const next = skins[nextIndex]
    skinSelect.value = next.id
    applySkin(next.id)
  }
  skinSelect.addEventListener("change", onSkinChange)
  skinCycle.addEventListener("click", onSkinCycle)

  const input = initInput(canvas, tiltButton)
  const target = new Vector3()
  const velocity = new Vector3()
  const lastPos = hoverboard.root.position.clone()
  let hoverTime = 0

  const updatePlayer = (dt: number) => {
    if (input.state.tiltEnabled && input.state.tiltActive) {
      const tX = (input.state.tiltX + 1) / 2
      const tY = (input.state.tiltY + 1) / 2
      target.x = lerp(GRID.leftX, GRID.rightX, tX)
      target.y = lerp(GRID.bottomY, GRID.topY, tY)
    } else {
      target.x = input.state.col === 0 ? GRID.leftX : GRID.rightX
      target.y = rowToY(input.state.row)
    }
    target.z = GRID.z

    const smoothing = 1 - Math.exp(-MOVE_SPEED * dt)
    Vector3.LerpToRef(hoverboard.root.position, target, smoothing, hoverboard.root.position)

    velocity.copyFrom(hoverboard.root.position).subtractInPlace(lastPos)
    lastPos.copyFrom(hoverboard.root.position)

    hoverTime += dt
    const activePivot = hoverboard.getActivePivot()
    const activeBoard = hoverboard.getActiveBoard()
    activePivot.position.y = 0.08 + Math.sin(hoverTime * 5) * 0.03

    activeBoard.rotation.z = clamp(-velocity.x * 4, -0.45, 0.45)
    activeBoard.rotation.x = clamp(velocity.y * 6, -0.35, 0.35)
  }

  let cameraTargetY = -1.05
  const updateCameraForViewport = () => {
    const width = engine.getRenderWidth()
    const height = engine.getRenderHeight()
    const minWidth = 320
    const widthFactor = clamp((width - minWidth) / 520, 0, 1)
    const heightFactor = clamp((height - 520) / 360, 0, 1)
    const narrowFactor = 1 - widthFactor
    const shortFactor = 1 - heightFactor

    camera.fov = lerp(1.68, 1.38, widthFactor)
    camera.position.y = lerp(-0.35, 0.2, widthFactor)
    camera.position.z = lerp(-3.85, -4.7, widthFactor)
    cameraTargetY = lerp(-1.35, -0.75, widthFactor) - shortFactor * 0.28
    camera.position.y -= shortFactor * 0.4
    camera.position.z += narrowFactor * 0.2
  }

  updateCameraForViewport()

  engine.runRenderLoop(() => {
    const dt = Math.min(engine.getDeltaTime() / 1000, 0.05)
    road.update(dt)
    updatePlayer(dt)
    updatePropField(activeSkin.props, road)
    const farX = road.getFarCenterX()
    camera.setTarget(new Vector3(farX * 0.2, cameraTargetY, 10))
    scene.render()
  })

  const onResize = () => {
    engine.setHardwareScalingLevel(1 / Math.min(window.devicePixelRatio || 1, 2))
    engine.resize()
    updateCameraForViewport()
  }
  window.addEventListener("resize", onResize)

  const dispose = () => {
    input.dispose()
    window.removeEventListener("resize", onResize)
    hudBackdrop.removeEventListener("click", onBackdropClick)
    fabButton.removeEventListener("click", onFabClick)
    hudExit.removeEventListener("click", requestExit)
    skinSelect.removeEventListener("change", onSkinChange)
    skinCycle.removeEventListener("click", onSkinCycle)
    engine.stopRenderLoop()
    scene.dispose()
    engine.dispose()
    root.remove()
  }

  return { dispose }
}
