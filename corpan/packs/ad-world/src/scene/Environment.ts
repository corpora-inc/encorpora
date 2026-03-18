import { Color3, Color4 } from "@babylonjs/core/Maths/math.color"
import { Vector3 } from "@babylonjs/core/Maths/math.vector"
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight"
import { PointLight } from "@babylonjs/core/Lights/pointLight"
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder"
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial"
import { GlowLayer } from "@babylonjs/core/Layers/glowLayer"
import { DefaultRenderingPipeline } from "@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/defaultRenderingPipeline"
import type { Scene } from "@babylonjs/core/scene"
import type { Engine } from "@babylonjs/core/Engines/engine"

export const createEnvironment = (scene: Scene, engine: Engine, canvas: HTMLCanvasElement) => {
  // Dark clear color — transparent alpha for HtmlMesh
  scene.clearColor = new Color4(0.02, 0.01, 0.03, 0)

  // Fog for depth
  scene.fogMode = 2 // exponential
  scene.fogDensity = 0.015
  scene.fogColor = new Color3(0.02, 0.01, 0.04)

  // Ambient fill light — very dim
  const hemi = new HemisphericLight("hemi", new Vector3(0, 1, 0.3), scene)
  hemi.intensity = 0.08
  hemi.diffuse = new Color3(0.3, 0.2, 0.5)
  hemi.groundColor = new Color3(0.02, 0.01, 0.03)

  // Accent point lights near where billboards will be (creates pools of light)
  const accentPositions = [
    new Vector3(0, 4, -8),
    new Vector3(12, 4, 5),
    new Vector3(-10, 4, -3),
    new Vector3(6, 4, 15),
    new Vector3(-8, 4, 12),
  ]

  const accentColors = [
    new Color3(0, 0.6, 1),    // cyan
    new Color3(1, 0, 0.6),    // magenta
    new Color3(0.4, 0, 1),    // purple
    new Color3(0, 1, 0.5),    // green
    new Color3(1, 0.3, 0),    // orange
  ]

  for (let i = 0; i < accentPositions.length; i++) {
    const light = new PointLight(`accent-${i}`, accentPositions[i], scene)
    light.intensity = 2.5
    light.diffuse = accentColors[i]
    light.range = 15
  }

  // Ground plane — dark with subtle grid
  const ground = MeshBuilder.CreateGround("ground", { width: 100, height: 100, subdivisions: 1 }, scene)
  const groundMat = new StandardMaterial("groundMat", scene)
  groundMat.diffuseColor = new Color3(0.03, 0.02, 0.04)
  groundMat.specularColor = new Color3(0.05, 0.03, 0.08)
  groundMat.emissiveColor = new Color3(0.01, 0.005, 0.02)
  ground.material = groundMat

  // Building silhouettes — dark boxes for depth
  const buildingConfigs = [
    { w: 4, h: 12, d: 4, x: -15, z: 20 },
    { w: 6, h: 18, d: 5, x: 20, z: 25 },
    { w: 3, h: 8, d: 3, x: -20, z: -15 },
    { w: 5, h: 15, d: 4, x: 18, z: -10 },
    { w: 7, h: 22, d: 6, x: -12, z: 30 },
    { w: 4, h: 10, d: 4, x: 25, z: 15 },
    { w: 5, h: 14, d: 5, x: -25, z: 5 },
    { w: 3, h: 9, d: 3, x: 15, z: -20 },
    { w: 8, h: 20, d: 7, x: -5, z: 35 },
    { w: 4, h: 11, d: 4, x: 30, z: 0 },
  ]

  const buildingMat = new StandardMaterial("buildingMat", scene)
  buildingMat.diffuseColor = new Color3(0.02, 0.015, 0.03)
  buildingMat.specularColor = Color3.Black()
  buildingMat.emissiveColor = new Color3(0.005, 0.003, 0.008)

  for (let i = 0; i < buildingConfigs.length; i++) {
    const cfg = buildingConfigs[i]
    const building = MeshBuilder.CreateBox(`building-${i}`, {
      width: cfg.w,
      height: cfg.h,
      depth: cfg.d,
    }, scene)
    building.position = new Vector3(cfg.x, cfg.h / 2, cfg.z)
    building.material = buildingMat

    // Neon edge strip on top
    const strip = MeshBuilder.CreateBox(`strip-${i}`, {
      width: cfg.w + 0.1,
      height: 0.1,
      depth: cfg.d + 0.1,
    }, scene)
    strip.position = new Vector3(cfg.x, cfg.h, cfg.z)
    const stripMat = new StandardMaterial(`stripMat-${i}`, scene)
    const color = accentColors[i % accentColors.length]
    stripMat.emissiveColor = color.scale(0.8)
    stripMat.diffuseColor = Color3.Black()
    strip.material = stripMat
  }

  // Glow layer — makes all emissive materials bloom
  const glow = new GlowLayer("glow", scene, { blurKernelSize: 16 })
  glow.intensity = 0.7
  // Exclude ground from glow
  glow.addExcludedMesh(ground)

  // Post-processing pipeline — camera must exist before this
  const cameras = scene.activeCamera ? [scene.activeCamera] : scene.cameras
  const pipeline = new DefaultRenderingPipeline("pipeline", true, scene, cameras)
  pipeline.bloomEnabled = true
  pipeline.bloomThreshold = 0.5
  pipeline.bloomWeight = 0.4
  pipeline.bloomKernel = 32
  pipeline.bloomScale = 0.3

  pipeline.chromaticAberrationEnabled = true
  pipeline.chromaticAberration.aberrationAmount = 10
  pipeline.chromaticAberration.radialIntensity = 0.5

  pipeline.imageProcessing.vignetteEnabled = true
  pipeline.imageProcessing.vignetteWeight = 2.5
  pipeline.imageProcessing.vignetteStretch = 0.5
  pipeline.imageProcessing.vignetteColor = new Color4(0.02, 0, 0.05, 0)
  pipeline.imageProcessing.exposure = 1.1
  pipeline.imageProcessing.contrast = 1.4

  pipeline.grainEnabled = true
  pipeline.grain.intensity = 3
  pipeline.grain.animated = true

  // Update pipeline camera when scene camera changes
  scene.onActiveCameraChanged.add(() => {
    if (scene.activeCamera) {
      pipeline.addCamera(scene.activeCamera)
    }
  })

  // Respond to canvas resize
  void engine
  void canvas

  return { ground, glow, pipeline }
}
