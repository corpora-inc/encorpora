import type { Scene, Engine } from "@babylonjs/core"
import type { HostApi } from "../sdk/types"
import type { InputSnapshot } from "../core/types"
import type { InputManager } from "../systems/InputManager"
import type { AudioManager } from "../systems/AudioManager"
import type { ParticleManager } from "../systems/ParticleManager"
import type { ScoreSystem } from "../systems/ScoreSystem"
import type { AdContentManager } from "../systems/AdContentManager"
import type { AdSurfacePool } from "../rendering/AdSurfacePool"
import type { AdManagerApi } from "../ad/types"
import type { ScreenShake } from "../systems/ScreenShake"
import type { NpcAdManager } from "../ad/npcAd/NpcAdManager"

export type GameContext = {
  scene: Scene
  engine: Engine
  canvas: HTMLCanvasElement
  root: HTMLElement
  hostApi: HostApi
  input: InputManager
  audio: AudioManager
  particles: ParticleManager
  score: ScoreSystem
  adContent: AdContentManager
  adPool: AdSurfacePool
  adManager: AdManagerApi
  screenShake: ScreenShake
  npcAdManager: NpcAdManager
}

export type FrameContext = {
  dt: number
  time: number
  input: InputSnapshot
}

export interface GameMode {
  readonly id: string
  readonly name: string
  init(ctx: GameContext): Promise<void> | void
  update(frame: FrameContext): void
  cleanup(): void
  onPause?(): void
  onResume?(): void
}
