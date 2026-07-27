import {
  Color3,
  Color4,
  HemisphericLight,
  MeshBuilder,
  ParticleSystem,
  Scene,
  Texture,
  UniversalCamera,
  Vector3,
} from "@babylonjs/core"

export const setupScene = (scene: Scene) => {
  const camera = new UniversalCamera("cam", new Vector3(0, 0, -10), scene)
  camera.setTarget(Vector3.Zero())
  camera.fov = 0.8

  const hemi = new HemisphericLight("hemi", new Vector3(0, 1, -0.3), scene)
  hemi.intensity = 1.2
  hemi.diffuse = new Color3(0.9, 0.95, 1)
  hemi.groundColor = new Color3(0.1, 0.05, 0.2)

  // Starfield background
  createStarfield(scene)
}

const createStarfield = (scene: Scene) => {
  // Use a particle system for stars
  const stars = new ParticleSystem("stars", 200, scene)

  // Tiny white pixel texture
  stars.particleTexture = new Texture(
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAAAXNSR0IArs4c6QAAABdJREFUGBljYPj//z8DMsYIFGBEFwADAACjBgMBhWfHHgAAAABJRU5ErkJggg==",
    scene
  )

  // Create a hidden emitter mesh
  const emitter = MeshBuilder.CreateBox("starEmitter", { size: 0.01 }, scene)
  emitter.position.set(0, 0, 5) // Behind everything
  emitter.isVisible = false

  stars.emitter = emitter

  // Spread stars across the background
  stars.createBoxEmitter(
    new Vector3(0, 0, 0),
    new Vector3(0, 0, 0),
    new Vector3(-12, -10, 0),
    new Vector3(12, 10, 0),
  )

  stars.minLifeTime = 8
  stars.maxLifeTime = 15
  stars.minSize = 0.02
  stars.maxSize = 0.06
  stars.emitRate = 20
  stars.minEmitPower = 0
  stars.maxEmitPower = 0.05
  stars.gravity = new Vector3(0, -0.02, 0) // Subtle drift

  stars.color1 = new Color4(1, 1, 1, 0.5)
  stars.color2 = new Color4(0.7, 0.8, 1, 0.3)
  stars.colorDead = new Color4(1, 1, 1, 0)

  stars.blendMode = ParticleSystem.BLENDMODE_ADD

  stars.start()
}
