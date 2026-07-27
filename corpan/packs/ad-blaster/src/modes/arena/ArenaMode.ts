import type { GameMode, GameContext, FrameContext } from "../../engine/types"
import { createArenaPlayer, type ArenaPlayer } from "./ArenaPlayer"
import { createArenaProjectilePool, type ArenaProjectilePool } from "./ArenaProjectile"
import { createEnemySpawner, type EnemySpawner } from "./EnemySpawner"
import type { Enemy } from "./enemies/EnemyBase"
import { PLAYER_SIZE, HIT_PAUSE_DURATION } from "../../core/constants"

export class ArenaMode implements GameMode {
  readonly id = "arena"
  readonly name = "Arena"

  private ctx!: GameContext
  private player!: ArenaPlayer
  private projectiles!: ArenaProjectilePool
  private spawner!: EnemySpawner
  private enemies: Enemy[] = []
  private paused = false
  private adInProgress = false
  private freezeTimer = 0

  init(ctx: GameContext) {
    this.ctx = ctx
    this.player = createArenaPlayer(ctx.scene)
    this.projectiles = createArenaProjectilePool(ctx.scene)
    this.spawner = createEnemySpawner(ctx.adPool, ctx.adContent, ctx.npcAdManager)
    this.enemies = []
    this.paused = false
    this.adInProgress = false
    this.freezeTimer = 0

    // Give InputManager access to scene for raycasting
    ctx.input.setScene(ctx.scene)

    // Reset camera to origin (fixed camera)
    const cam = ctx.scene.activeCamera
    if (cam) {
      cam.position.x = 0
      cam.position.y = 0
      cam.position.z = -10
    }
  }

  update(frame: FrameContext) {
    if (this.paused || this.adInProgress) return
    if (this.ctx.score.isGameOver()) return

    const { dt, input } = frame

    // Hit-pause: skip all game logic while frozen
    if (this.freezeTimer > 0) {
      this.freezeTimer -= dt
      return
    }

    // Update player
    this.player.update(dt, input)

    // Auto-fire
    if (this.player.shouldFire()) {
      const cos = Math.cos(this.player.angle)
      const sin = Math.sin(this.player.angle)
      const spawnDist = PLAYER_SIZE + 0.2
      this.projectiles.fire(
        this.player.x + cos * spawnDist,
        this.player.y + sin * spawnDist,
        this.player.angle,
      )
      this.ctx.audio.playShoot()
    }

    // Update projectiles
    this.projectiles.update(dt)

    // Update combo timer
    this.ctx.score.updateCombo(dt)

    // Spawn enemies
    const newEnemies = this.spawner.update(dt, this.player.x, this.player.y, this.enemies.length)
    for (const e of newEnemies) {
      this.enemies.push(e)
    }

    // Update enemies
    for (const enemy of this.enemies) {
      enemy.update(dt, this.player.x, this.player.y)
    }

    // Collision: projectiles vs enemies
    this.checkProjectileCollisions()

    // Collision: enemies vs player
    this.checkPlayerCollisions()

    // Clean up dead/offscreen enemies
    this.cleanupEnemies()

    // Update screen shake
    this.ctx.screenShake.update(dt)

    // Update wave display
    const wave = this.spawner.getWave()
    if (wave !== this.ctx.score.getLevel()) {
      // Level tracks wave number
      while (this.ctx.score.getLevel() < wave) {
        this.ctx.score.nextLevel()
        this.ctx.audio.playLevelUp()
      }
    }
  }

  private checkProjectileCollisions() {
    const active = this.projectiles.getActive()
    for (const proj of active) {
      for (const enemy of this.enemies) {
        if (!enemy.alive) continue

        // AABB-ish distance check
        const dx = proj.x - enemy.x
        const dy = proj.y - enemy.y
        const hitDist = enemy.def.size * 0.5 + 0.15
        if (Math.abs(dx) < hitDist && Math.abs(dy) < hitDist) {
          // Hit!
          this.projectiles.deactivate(proj)
          const killed = enemy.takeDamage(1)

          if (killed) {
            // Enemy destroyed — hit-pause for percussive impact
            this.freezeTimer = HIT_PAUSE_DURATION
            const points = this.ctx.score.addKill()
            this.ctx.particles.blastAt(enemy.x, enemy.y, enemy.def.color)
            this.ctx.audio.playExplosion()
            this.ctx.screenShake.shake(enemy.def.type === "tank" ? 0.4 : 0.15)
            this.ctx.adPool.release(enemy.surface)

            // Report ad click (enemy "blasted" = ad interaction)
            if (enemy.adCreativeId) {
              this.ctx.npcAdManager.reportClick(enemy.adCreativeId)
            }

            // Dispatch score event for HUD combo popup
            window.dispatchEvent(new CustomEvent("ad-blaster-score", {
              detail: { points, combo: this.ctx.score.getCombo() },
            }))

            if (this.ctx.score.getCombo() >= 3) {
              this.ctx.audio.playCombo()
            }
          } else {
            // Damaged but alive
            this.ctx.particles.hitSparkAt(proj.x, proj.y)
            this.ctx.audio.playHit()
            this.ctx.screenShake.shake(0.05)
          }
          break
        }
      }
    }
  }

  private checkPlayerCollisions() {
    if (this.player.invulnTimer > 0 || !this.player.alive) return

    for (const enemy of this.enemies) {
      if (!enemy.alive) continue

      const dx = this.player.x - enemy.x
      const dy = this.player.y - enemy.y
      const hitDist = PLAYER_SIZE + enemy.def.size * 0.4
      if (dx * dx + dy * dy < hitDist * hitDist) {
        // Player hit by enemy!
        this.handlePlayerHit()
        break
      }
    }
  }

  private async handlePlayerHit() {
    this.adInProgress = true
    this.ctx.audio.playDeath()
    this.ctx.screenShake.shake(0.5)
    this.ctx.particles.deathSpiral(this.player.x, this.player.y)

    // Show fullscreen ad as punishment
    try {
      await this.ctx.adManager.showInterstitial()
    } catch {
      // Ad failed, continue anyway
    }

    // Lose a life
    const dead = this.ctx.score.loseLife()
    if (dead) {
      this.player.alive = false
      this.player.mesh.setEnabled(false)
    } else {
      this.player.takeDamage()
    }

    this.adInProgress = false
  }

  private cleanupEnemies() {
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i]
      if (!enemy.alive || enemy.isOffScreen()) {
        if (enemy.alive) {
          // Escaped, release surface
          enemy.surface.mesh.setEnabled(false)
          this.ctx.adPool.release(enemy.surface)
        }
        this.enemies.splice(i, 1)
      }
    }
  }

  cleanup() {
    this.player?.dispose()
    this.projectiles?.dispose()
    for (const enemy of this.enemies) {
      if (enemy.alive) {
        enemy.surface.mesh.setEnabled(false)
        this.ctx.adPool.release(enemy.surface)
      }
    }
    this.enemies = []
    this.spawner?.reset()
  }

  onPause() {
    this.paused = true
  }

  onResume() {
    this.paused = false
  }
}
