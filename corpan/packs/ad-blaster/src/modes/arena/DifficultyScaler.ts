export type WaveScaling = {
  speedMultiplier: number
  sizeMultiplier: number
  steerMultiplier: number
  enemyCount: number
  staggerTime: number
  calmTime: number
  hpBonus: number
}

export const getWaveScaling = (wave: number): WaveScaling => {
  const w = Math.max(1, wave)
  const t = w - 1 // zero-indexed progress

  // Speed: starts at 0.55, approaches 1.0 by wave ~15, then creeps past
  const speedMultiplier =
    0.55 + 0.45 * (1 - Math.exp(-0.12 * t)) + Math.max(0, (w - 15) * 0.008)

  // Size: starts at 1.6x (fat targets), decays toward 1.0
  const sizeMultiplier = 1.0 + 0.6 * Math.exp(-0.18 * t)

  // Steer: starts at 0.4 (sluggish tracking), approaches 1.0
  const steerMultiplier = 0.4 + 0.6 * (1 - Math.exp(-0.1 * t))

  // Count: starts at 2, grows sub-linearly, caps at 24
  const enemyCount = Math.min(
    24,
    Math.floor(2 + 1.5 * t + 0.15 * Math.pow(t, 1.3)),
  )

  // Stagger: starts at 0.90s, decays toward 0.35s
  const staggerTime = 0.35 + 0.55 * Math.exp(-0.15 * t)

  // Calm between waves: starts at 4.0s, floors at 2.0s
  const calmTime = Math.max(2.0, 4.0 - 0.15 * t)

  // HP bonus: delayed to wave 7, +1 every 7 waves
  const hpBonus = Math.floor(Math.max(0, w - 7) / 7)

  return {
    speedMultiplier,
    sizeMultiplier,
    steerMultiplier,
    enemyCount,
    staggerTime,
    calmTime,
    hpBonus,
  }
}
