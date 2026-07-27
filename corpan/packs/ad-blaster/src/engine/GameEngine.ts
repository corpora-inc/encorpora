import {
  Engine,
  Scene,
  Color4,
} from "@babylonjs/core"
import type { HostApi } from "../sdk/types"
import type { GameMode, GameContext, FrameContext } from "./types"
import type { AdManagerApi } from "../ad/types"
import type { NpcAdManager } from "../ad/npcAd/NpcAdManager"
import { GameModeRegistry } from "./GameModeRegistry"
import { createInputManager } from "../systems/InputManager"
import { createAudioManager } from "../systems/AudioManager"
import { createParticleManager } from "../systems/ParticleManager"
import { createScoreSystem } from "../systems/ScoreSystem"
import { createAdContentManager } from "../systems/AdContentManager"
import { createAdSurfacePool } from "../rendering/AdSurfacePool"
import { createScreenShake } from "../systems/ScreenShake"
import { setupScene } from "../rendering/SceneSetup"

export class GameEngine {
  private engine: Engine
  private scene: Scene
  private canvas: HTMLCanvasElement
  private root: HTMLElement
  private registry = new GameModeRegistry()
  private activeMode: GameMode | null = null
  private ctx: GameContext
  private time = 0
  private disposed = false

  constructor(container: HTMLElement, hostApi: HostApi, adManager: AdManagerApi, npcAdManager: NpcAdManager) {
    this.root = document.createElement("div")
    this.root.className = "ad-blaster"
    container.appendChild(this.root)

    this.canvas = document.createElement("canvas")
    this.root.appendChild(this.canvas)

    this.engine = new Engine(this.canvas, true, {
      preserveDrawingBuffer: false,
      stencil: true,
    })
    this.engine.setHardwareScalingLevel(1 / window.devicePixelRatio)

    this.scene = new Scene(this.engine)
    this.scene.clearColor = new Color4(0.02, 0.03, 0.06, 1)

    setupScene(this.scene)

    const input = createInputManager(this.canvas)
    input.setScene(this.scene)
    const audio = createAudioManager()
    const particles = createParticleManager(this.scene)
    const score = createScoreSystem()
    const adContent = createAdContentManager(hostApi)
    const adPool = createAdSurfacePool(this.scene)
    const screenShake = createScreenShake(this.scene)

    this.ctx = {
      scene: this.scene,
      engine: this.engine,
      canvas: this.canvas,
      root: this.root,
      hostApi,
      input,
      audio,
      particles,
      score,
      adContent,
      adPool,
      adManager,
      screenShake,
      npcAdManager,
    }

    this.engine.runRenderLoop(() => {
      if (this.disposed) return
      const dt = this.engine.getDeltaTime() / 1000
      this.time += dt

      if (this.activeMode) {
        const frame: FrameContext = {
          dt: Math.min(dt, 0.05),
          time: this.time,
          input: input.snapshot(),
        }
        this.activeMode.update(frame)
      }

      this.scene.render()
    })

    const onResize = () => {
      this.engine.resize()
    }
    window.addEventListener("resize", onResize)
    this.engine.resize()
  }

  getRegistry(): GameModeRegistry {
    return this.registry
  }

  getRoot(): HTMLElement {
    return this.root
  }

  getContext(): GameContext {
    return this.ctx
  }

  registerMode(mode: GameMode) {
    this.registry.register(mode)
  }

  async switchMode(id: string) {
    if (this.activeMode) {
      this.activeMode.cleanup()
      this.activeMode = null
    }

    const mode = this.registry.get(id)
    if (!mode) {
      throw new Error(`Unknown game mode: ${id}`)
    }

    this.ctx.score.reset()
    this.time = 0
    this.activeMode = mode
    await mode.init(this.ctx)
  }

  stopMode() {
    if (this.activeMode) {
      this.activeMode.cleanup()
      this.activeMode = null
    }
  }

  dispose() {
    this.disposed = true
    if (this.activeMode) {
      this.activeMode.cleanup()
      this.activeMode = null
    }
    this.ctx.input.dispose()
    this.ctx.adPool.dispose()
    this.ctx.screenShake.dispose()
    this.engine.stopRenderLoop()
    this.scene.dispose()
    this.engine.dispose()
    this.root.remove()
  }
}
