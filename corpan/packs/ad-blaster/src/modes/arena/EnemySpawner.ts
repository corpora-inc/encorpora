import type { Enemy } from "./enemies/EnemyBase"
import type { AdSurfacePool } from "../../rendering/AdSurfacePool"
import type { AdContentManager } from "../../systems/AdContentManager"
import type { NpcAdManager } from "../../ad/npcAd/NpcAdManager"
import type { EnemyDef } from "../../core/types"
import { ENEMY_AD_SIZE_MAP, DEFAULT_AD_MAPPING } from "../../ad/npcAd/adSizeMapping"
import { createLinearEnemy } from "./enemies/LinearEnemy"
import { LINEAR_DEF } from "./enemies/LinearEnemy"
import { createStalkerEnemy, STALKER_DEF } from "./enemies/StalkerEnemy"
import { createBouncerEnemy, BOUNCER_DEF } from "./enemies/BouncerEnemy"
import { createSwarmEnemy, SWARM_DEF } from "./enemies/SwarmEnemy"
import { createTankEnemy, TANK_DEF } from "./enemies/TankEnemy"
import { getWaveScaling, type WaveScaling } from "./DifficultyScaler"
import {
  ARENA_HALF_WIDTH,
  ARENA_HALF_HEIGHT,
  MAX_ENEMIES_ON_SCREEN,
  ENEMY_STALKER_STEER,
} from "../../core/constants"

type EnemyType = "linear" | "stalker" | "bouncer" | "swarm" | "tank"

type SpawnEntry = {
  type: EnemyType
  delay: number // stagger offset
}

export type EnemySpawner = {
  update: (dt: number, playerX: number, playerY: number, currentEnemies: number) => Enemy[]
  getWave: () => number
  reset: () => void
}

const TANK_BASE_STEER = 0.5

const pickEdgeSpawn = (): { x: number; y: number; dirX: number; dirY: number } => {
  const edge = Math.floor(Math.random() * 4)
  const margin = 1.5
  switch (edge) {
    case 0: // top
      return {
        x: (Math.random() - 0.5) * 2 * ARENA_HALF_WIDTH,
        y: ARENA_HALF_HEIGHT + margin,
        dirX: (Math.random() - 0.5) * 2,
        dirY: -1,
      }
    case 1: // bottom
      return {
        x: (Math.random() - 0.5) * 2 * ARENA_HALF_WIDTH,
        y: -ARENA_HALF_HEIGHT - margin,
        dirX: (Math.random() - 0.5) * 2,
        dirY: 1,
      }
    case 2: // left
      return {
        x: -ARENA_HALF_WIDTH - margin,
        y: (Math.random() - 0.5) * 2 * ARENA_HALF_HEIGHT,
        dirX: 1,
        dirY: (Math.random() - 0.5) * 2,
      }
    default: // right
      return {
        x: ARENA_HALF_WIDTH + margin,
        y: (Math.random() - 0.5) * 2 * ARENA_HALF_HEIGHT,
        dirX: -1,
        dirY: (Math.random() - 0.5) * 2,
      }
  }
}

const pickEnemyType = (wave: number): EnemyType => {
  // Waves 1-2: linear only
  if (wave <= 2) return "linear"

  // Waves 3-4: linear + swarm
  const swarmChance = Math.min(0.30, 0.15 + wave * 0.01)
  const stalkerChance = wave >= 5 ? Math.min(0.25, (wave - 4) * 0.03) : 0
  const bouncerChance = wave >= 8 ? Math.min(0.20, (wave - 7) * 0.025) : 0
  const tankChance = wave >= 12 ? Math.min(0.10, (wave - 11) * 0.015) : 0

  const r = Math.random()
  if (r < tankChance) return "tank"
  if (r < tankChance + stalkerChance) return "stalker"
  if (r < tankChance + stalkerChance + bouncerChance) return "bouncer"
  if (r < tankChance + stalkerChance + bouncerChance + swarmChance) return "swarm"
  return "linear"
}

const buildWaveSpawns = (wave: number, scaling: WaveScaling): SpawnEntry[] => {
  const entries: SpawnEntry[] = []
  const total = scaling.enemyCount

  for (let i = 0; i < total; i++) {
    const type = pickEnemyType(wave)
    entries.push({ type, delay: i * scaling.staggerTime })
  }

  return entries
}

const getBaseDef = (type: EnemyType): EnemyDef => {
  switch (type) {
    case "linear": return LINEAR_DEF
    case "swarm": return SWARM_DEF
    case "stalker": return STALKER_DEF
    case "bouncer": return BOUNCER_DEF
    case "tank": return TANK_DEF
  }
}

const buildDefOverrides = (type: EnemyType, scaling: WaveScaling): Partial<EnemyDef> => {
  const baseDef = getBaseDef(type)
  const overrides: Partial<EnemyDef> = {
    speed: baseDef.speed * scaling.speedMultiplier,
    size: baseDef.size * scaling.sizeMultiplier,
  }

  // Apply steer scaling for tracking enemies
  if (type === "stalker") {
    overrides.steer = ENEMY_STALKER_STEER * scaling.steerMultiplier
  } else if (type === "tank") {
    overrides.steer = TANK_BASE_STEER * scaling.steerMultiplier
  }

  return overrides
}

export const createEnemySpawner = (
  adPool: AdSurfacePool,
  adContent: AdContentManager,
  npcAdManager?: NpcAdManager,
): EnemySpawner => {
  let wave = 0
  let calmTimer = 0
  let spawns: SpawnEntry[] = []
  let spawnTimer = 0
  let spawnIndex = 0
  let waveActive = false
  let waitingForClear = false
  let waveScaling: WaveScaling = getWaveScaling(1)

  const reset = () => {
    wave = 0
    calmTimer = 0
    spawns = []
    spawnTimer = 0
    spawnIndex = 0
    waveActive = false
    waitingForClear = false
    waveScaling = getWaveScaling(1)
  }

  const startNextWave = () => {
    wave++
    waveScaling = getWaveScaling(wave)
    spawns = buildWaveSpawns(wave, waveScaling)
    spawnIndex = 0
    spawnTimer = 0
    waveActive = true
    waitingForClear = false
  }

  const update = (
    dt: number,
    playerX: number,
    playerY: number,
    currentEnemies: number,
  ): Enemy[] => {
    const spawned: Enemy[] = []

    // Initial wave start
    if (wave === 0) {
      calmTimer = waveScaling.calmTime * 0.5 // shorter initial calm
      wave = 0
      waitingForClear = false
      waveActive = false
      startNextWave()
      return spawned
    }

    // Waiting for all enemies to die/escape before next wave
    if (waitingForClear) {
      if (currentEnemies <= 0) {
        calmTimer = waveScaling.calmTime
        waitingForClear = false
      }
      return spawned
    }

    // Calm between waves
    if (!waveActive && calmTimer > 0) {
      calmTimer -= dt
      if (calmTimer <= 0) {
        startNextWave()
      }
      return spawned
    }

    // Spawning within a wave
    if (waveActive && spawnIndex < spawns.length) {
      spawnTimer += dt
      while (spawnIndex < spawns.length && spawnTimer >= spawns[spawnIndex].delay) {
        if (currentEnemies + spawned.length < MAX_ENEMIES_ON_SCREEN) {
          const entry = spawns[spawnIndex]
          const enemy = spawnEnemy(entry.type, playerX, playerY)
          if (enemy) spawned.push(enemy)
        }
        spawnIndex++
      }

      // All spawned for this wave?
      if (spawnIndex >= spawns.length) {
        waveActive = false
        waitingForClear = true
      }
    }

    return spawned
  }

  const spawnEnemy = (type: EnemyType, playerX: number, playerY: number): Enemy | null => {
    const hpBonus = waveScaling.hpBonus
    const defOverrides = buildDefOverrides(type, waveScaling)
    const { x, y, dirX, dirY } = pickEdgeSpawn()

    // Look up size category for this enemy type
    const mapping = ENEMY_AD_SIZE_MAP[type] ?? DEFAULT_AD_MAPPING
    const surface = adPool.acquire(mapping.sizeCategory)

    // Try NPC ad manager first for ad creative
    let adCreativeId: string | undefined
    const creative = npcAdManager?.getNext(mapping.sizeCategory) ?? null

    if (creative) {
      adCreativeId = creative.id
      if (creative.imageData) {
        surface.setImage(creative.imageData)
      } else {
        // Use fallback text (from any provider — mock, corpan, etc.)
        surface.setText(creative.fallbackText, creative.fallbackColor)
      }
      npcAdManager?.reportImpression(creative.id)
    } else {
      // No NPC ad available — fall back to AdContentManager directly
      const content = adContent.getNext()
      surface.setText(content.text, content.color)
    }

    let enemy: Enemy | null = null

    switch (type) {
      case "linear":
        enemy = createLinearEnemy(surface, x, y, dirX, dirY, hpBonus, defOverrides)
        break
      case "stalker":
        enemy = createStalkerEnemy(surface, x, y, hpBonus, defOverrides)
        break
      case "bouncer":
        enemy = createBouncerEnemy(surface, x, y, dirX, dirY, hpBonus, defOverrides)
        break
      case "swarm": {
        const offset = (Math.random() - 0.5) * 0.6
        enemy = createSwarmEnemy(surface, x, y, playerX, playerY, hpBonus, offset, defOverrides)
        break
      }
      case "tank":
        enemy = createTankEnemy(surface, x, y, playerX, playerY, hpBonus, defOverrides)
        break
      default:
        enemy = createLinearEnemy(surface, x, y, dirX, dirY, hpBonus, defOverrides)
    }

    if (enemy && adCreativeId) {
      enemy.adCreativeId = adCreativeId
    }

    return enemy
  }

  return { update, getWave: () => wave, reset }
}
