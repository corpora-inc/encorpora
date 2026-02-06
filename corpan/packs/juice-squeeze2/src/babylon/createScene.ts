import {
  Engine,
  Scene,
  UniversalCamera,
  Camera,
  Vector3,
  Color4,
  HemisphericLight,
} from "@babylonjs/core"

export function createScene(canvas: HTMLCanvasElement) {
  const maxDevicePixelRatio = 2
  const engine = new Engine(canvas, true, {
    preserveDrawingBuffer: false,
    stencil: true,
    antialias: true,
  })

  engine.setHardwareScalingLevel(
    1 / Math.min(window.devicePixelRatio || 1, maxDevicePixelRatio)
  )

  const scene = new Scene(engine)
  // Dark background instead of transparent to avoid rendering issues
  scene.clearColor = new Color4(0.1, 0.1, 0.1, 1)

  // Orthographic camera
  const camera = new UniversalCamera("camera", new Vector3(0, 0, -15), scene)
  camera.mode = Camera.ORTHOGRAPHIC_CAMERA
  camera.setTarget(Vector3.Zero())
  camera.inputs.clear()

  // Ambient light
  const light = new HemisphericLight("light", new Vector3(0, 1, 0), scene)
  light.intensity = 0.7

  // Update camera for ortho
  const updateCameraOrtho = () => {
    const canvasElement = engine.getRenderingCanvas()
    if (!canvasElement) return

    const aspectRatio = canvasElement.width / canvasElement.height
    const orthoSize = 10

    camera.orthoTop = orthoSize
    camera.orthoBottom = -orthoSize
    camera.orthoLeft = -orthoSize * aspectRatio
    camera.orthoRight = orthoSize * aspectRatio
  }

  updateCameraOrtho()

  // Render loop
  engine.runRenderLoop(() => {
    scene.render()
  })

  // Handle resize
  const handleResize = () => {
    engine.resize()
    updateCameraOrtho()
  }
  window.addEventListener("resize", handleResize)

  return {
    engine,
    scene,
    camera,
    dispose: () => {
      window.removeEventListener("resize", handleResize)
      scene.dispose()
      engine.dispose()
    },
  }
}
