import {
  Color3,
  Color4,
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
  leftX: -1.7,
  rightX: 1.7,
  topY: 1.25,
  bottomY: 0.25,
  z: 2.4,
}

const ROAD = {
  width: 8.8,
  length: 90,
  segments: 50,
  speed: 14,
  curveAmount: 1.4,
}

const MOVE_SPEED = 14

type RoadState = {
  mesh: Mesh
  update: (dt: number) => void
  getFarCenterX: () => number
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
  roadMaterial.diffuseColor = new Color3(0.08, 0.09, 0.12)
  roadMaterial.emissiveColor = new Color3(0.02, 0.03, 0.05)
  roadMaterial.specularColor = new Color3(0.08, 0.09, 0.12)
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

  let travel = 0
  let curveTime = 0
  let farCenterX = 0

  const update = (dt: number) => {
    travel = (travel + ROAD.speed * dt) % ROAD.length
    curveTime += dt * 0.35
    const spacing = ROAD.length / (ROAD.segments - 1)

    for (let i = 0; i < ROAD.segments; i += 1) {
      const raw = (i * spacing + travel) % ROAD.length
      const z = ROAD.length - raw
      const blend = Math.pow(z / ROAD.length, 1.35)
      const curve =
        Math.sin(curveTime + z * 0.08) * ROAD.curveAmount * blend

      const left = pathArray[0][i]
      const right = pathArray[1][i]

      left.x = curve - ROAD.width / 2
      left.y = 0
      left.z = z

      right.x = curve + ROAD.width / 2
      right.y = 0
      right.z = z

      const center = centerPoints[i]
      center.x = curve
      center.y = 0.03
      center.z = z

      const leftEdgePoint = leftPoints[i]
      leftEdgePoint.x = left.x
      leftEdgePoint.y = 0.04
      leftEdgePoint.z = z

      const rightEdgePoint = rightPoints[i]
      rightEdgePoint.x = right.x
      rightEdgePoint.y = 0.04
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
  }
}

const createHoverboard = (scene: Scene) => {
  const root = new TransformNode("hover-root", scene)
  const pivot = new TransformNode("hover-pivot", scene)
  pivot.parent = root

  const board = MeshBuilder.CreateBox(
    "hover-board",
    { width: 1.4, height: 0.08, depth: 0.6 },
    scene
  )
  board.parent = pivot
  board.position.y = 0.08

  const boardMaterial = new StandardMaterial("board-mat", scene)
  boardMaterial.diffuseColor = new Color3(0.08, 0.16, 0.3)
  boardMaterial.emissiveColor = new Color3(0.2, 0.35, 0.6)
  board.material = boardMaterial

  const rider = MeshBuilder.CreateSphere(
    "hover-rider",
    { diameter: 0.4 },
    scene
  )
  rider.parent = pivot
  rider.position.y = 0.55

  const riderMaterial = new StandardMaterial("rider-mat", scene)
  riderMaterial.diffuseColor = new Color3(0.9, 0.95, 1)
  riderMaterial.emissiveColor = new Color3(0.6, 0.75, 1)
  rider.material = riderMaterial

  return { root, board, pivot }
}

type InputState = {
  row: number
  col: number
  tiltEnabled: boolean
  tiltActive: boolean
  tiltX: number
  tiltY: number
}

const initInput = (canvas: HTMLCanvasElement, tiltButton: HTMLButtonElement) => {
  const state: InputState = {
    row: 1,
    col: 0,
    tiltEnabled: false,
    tiltActive: false,
    tiltX: 0,
    tiltY: 0,
  }

  const onKey = (event: KeyboardEvent) => {
    if (event.key === "ArrowUp" || event.key === "w") {
      state.row = 0
    }
    if (event.key === "ArrowDown" || event.key === "s") {
      state.row = 1
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
    state.row = y < rect.height / 2 ? 0 : 1
  }

  const orientationHandler = (event: DeviceOrientationEvent) => {
    if (event.gamma == null || event.beta == null) {
      return
    }
    state.tiltActive = true
    state.tiltX = clamp(event.gamma / 20, -1, 1)
    state.tiltY = clamp(-event.beta / 25, -1, 1)
  }

  const enableTilt = () => {
    if (state.tiltEnabled) {
      return
    }
    state.tiltEnabled = true
    window.addEventListener("deviceorientation", orientationHandler)
    tiltButton.remove()
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

  const canvas = document.createElement("canvas")
  root.appendChild(canvas)

  const hud = document.createElement("div")
  hud.className = "hover-hud"
  hud.innerHTML = `
    <div class="hud-left">
      <div class="hud-title">Hover Runner</div>
      <div class="hud-subtitle">
        Tap a quadrant or use arrows. Tilt to steer on mobile.
      </div>
    </div>
    <div class="hud-right">
      <div class="hud-title">Prototype</div>
      <div class="hud-speed">Speed ${ROAD.speed.toFixed(0)}</div>
    </div>
  `
  root.appendChild(hud)

  const tiltButton = document.createElement("button")
  tiltButton.className = "tilt-button"
  tiltButton.type = "button"
  tiltButton.textContent = "Enable Tilt"
  root.appendChild(tiltButton)

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
    new Vector3(0, 1.6, -6.2),
    scene
  )
  camera.setTarget(new Vector3(0, 0.9, 10))
  camera.fov = 0.9
  camera.minZ = 0.1
  camera.maxZ = 200
  camera.inputs.clear()

  const hemi = new HemisphericLight("hemi", new Vector3(0, 1, 0.4), scene)
  hemi.intensity = 0.5
  hemi.diffuse = new Color3(0.6, 0.75, 1)
  hemi.groundColor = new Color3(0.06, 0.08, 0.12)

  const road = createRoad(scene)
  const hoverboard = createHoverboard(scene)
  hoverboard.root.position = new Vector3(GRID.leftX, GRID.bottomY, GRID.z)

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
      target.y = input.state.row === 0 ? GRID.topY : GRID.bottomY
    }
    target.z = GRID.z

    const smoothing = 1 - Math.exp(-MOVE_SPEED * dt)
    Vector3.LerpToRef(hoverboard.root.position, target, smoothing, hoverboard.root.position)

    velocity.copyFrom(hoverboard.root.position).subtractInPlace(lastPos)
    lastPos.copyFrom(hoverboard.root.position)

    hoverTime += dt
    hoverboard.pivot.position.y = 0.08 + Math.sin(hoverTime * 5) * 0.03

    hoverboard.board.rotation.z = clamp(-velocity.x * 4, -0.45, 0.45)
    hoverboard.board.rotation.x = clamp(velocity.y * 6, -0.35, 0.35)
  }

  engine.runRenderLoop(() => {
    const dt = Math.min(engine.getDeltaTime() / 1000, 0.05)
    road.update(dt)
    updatePlayer(dt)
    const farX = road.getFarCenterX()
    camera.setTarget(new Vector3(farX * 0.2, 0.9, 10))
    scene.render()
  })

  const onResize = () => {
    engine.setHardwareScalingLevel(1 / Math.min(window.devicePixelRatio || 1, 2))
    engine.resize()
  }
  window.addEventListener("resize", onResize)

  const dispose = () => {
    input.dispose()
    window.removeEventListener("resize", onResize)
    engine.stopRenderLoop()
    scene.dispose()
    engine.dispose()
    root.remove()
  }

  return { dispose }
}
