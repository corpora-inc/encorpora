// Arena dimensions (world units)
export const ARENA_HALF_WIDTH = 6
export const ARENA_HALF_HEIGHT = 5

// Hit-pause on kill (~3 frames at 60fps — more percussive)
export const HIT_PAUSE_DURATION = 0.05

// Player
export const PLAYER_SPEED = 3.2
export const PLAYER_SIZE = 0.4
export const PLAYER_DECEL = 2.4
export const PLAYER_INVULN_TIME = 1.5
export const PLAYER_ROTATE_SPEED = 10

// Projectiles
export const PROJECTILE_SPEED = 10
export const PROJECTILE_WIDTH = 0.1
export const PROJECTILE_HEIGHT = 0.35
export const MAX_PROJECTILES = 16
export const FIRE_INTERVAL = 0.38

// Enemies
export const ENEMY_LINEAR_HP = 1
export const ENEMY_LINEAR_SPEED = 2.8
export const ENEMY_LINEAR_SIZE = 0.8
export const ENEMY_LINEAR_POINTS = 80

export const ENEMY_STALKER_HP = 2
export const ENEMY_STALKER_SPEED = 1.3
export const ENEMY_STALKER_SIZE = 1.0
export const ENEMY_STALKER_POINTS = 150
export const ENEMY_STALKER_STEER = 1.8

export const ENEMY_BOUNCER_HP = 2
export const ENEMY_BOUNCER_SPEED = 2.0
export const ENEMY_BOUNCER_SIZE = 1.0
export const ENEMY_BOUNCER_POINTS = 120

export const ENEMY_SWARM_HP = 1
export const ENEMY_SWARM_SPEED = 3.6
export const ENEMY_SWARM_SIZE = 0.6
export const ENEMY_SWARM_POINTS = 60

export const ENEMY_TANK_HP = 5
export const ENEMY_TANK_SPEED = 0.8
export const ENEMY_TANK_SIZE = 2.0
export const ENEMY_TANK_POINTS = 500

// Spawner
export const WAVE_CALM_TIME = 3.0
export const WAVE_STAGGER_TIME = 0.55
export const BASE_ENEMIES_PER_WAVE = 5
export const ENEMIES_PER_WAVE_GROWTH = 2
export const MAX_ENEMIES_ON_SCREEN = 24
export const HP_BONUS_EVERY_N_WAVES = 5

// Scoring
export const POINTS_PER_KILL = 100
export const COMBO_MULTIPLIER = 0.5
export const COMBO_TIMEOUT = 2.5
export const EXTRA_LIFE_THRESHOLD = 5000

// Game
export const STARTING_LIVES = 3
export const MAX_LIVES = 5
export const LEVEL_CLEAR_BONUS = 500

// Projectile lifespan
export const PROJECTILE_LIFESPAN = 1.8

// Colors for mock ad surfaces
export const AD_COLORS = [
  "#ff4444", "#44ff44", "#4444ff", "#ffff44",
  "#ff44ff", "#44ffff", "#ff8800", "#8800ff",
  "#00ff88", "#ff0088", "#0088ff", "#88ff00",
]
