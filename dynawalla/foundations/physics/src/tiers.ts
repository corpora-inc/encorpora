// Quality tiers.
//
// The rule this program was given is "the mid-range tablet sets the FLOOR, never
// the ceiling". So the tier table is not a set of downgrades from a desktop
// target — `mid` is the tier every budget in the README is measured against,
// and `ultra` is what a capable device is allowed to spend on top.
//
// Only three things actually cost frame time in a 2D rigid-body scene, and they
// are the three knobs here:
//
//   bodies            how much stuff can be awake at once
//   solverIterations  joint and stacking fidelity (see the rope probe: 4 -> 16
//                     cuts chain stretch from 18% to 7% for 3.4x the solve)
//   particles         the liquid/soft-body approximation's resolution
//
// Everything else that looks like a physics cost (shadows, bloom, trail meshes)
// belongs to the renderer's budget, not this one.

export type TierName = "low" | "mid" | "high" | "ultra"

export interface Tier {
  name: TierName
  /** Awake dynamic bodies this tier will simulate before culling kicks in. */
  bodies: number
  /** Rapier `numSolverIterations`. */
  solverIterations: number
  /** Particle count ceiling for `liquid()` and `softBlob()`. */
  particles: number
  /** Steps in a predicted trajectory. 90 = 1.5 s of flight at 60 Hz. */
  predictSteps: number
  /**
   * Max physics steps allowed to catch up in one frame. Above this the world
   * drops time rather than spiralling: a WebView that was backgrounded for
   * 10 s must not try to simulate 600 steps in one frame and hang the app.
   */
  maxCatchUpSteps: number
}

export const TIERS: Record<TierName, Tier> = {
  // A 2019 budget phone or a throttled tablet. Still has to look good.
  low: { name: "low", bodies: 120, solverIterations: 4, particles: 90, predictSteps: 60, maxCatchUpSteps: 3 },
  // THE FLOOR: Galaxy Tab A9 class. Every budget in the README is this row.
  mid: { name: "mid", bodies: 260, solverIterations: 4, particles: 200, predictSteps: 90, maxCatchUpSteps: 4 },
  high: { name: "high", bodies: 500, solverIterations: 8, particles: 400, predictSteps: 120, maxCatchUpSteps: 5 },
  // Take the cap off. An iPad Pro or a desktop should look staggering.
  ultra: { name: "ultra", bodies: 900, solverIterations: 12, particles: 800, predictSteps: 180, maxCatchUpSteps: 6 },
}

export interface DeviceHints {
  deviceMemoryGb?: number | undefined
  hardwareConcurrency?: number | undefined
  /** devicePixelRatio * min(screen dimension), a decent proxy for GPU class. */
  screenPx?: number | undefined
}

/**
 * Pick a tier from what the browser will actually tell us.
 *
 * Deliberately conservative and deliberately NOT a UA sniff. `deviceMemory` is
 * absent on iOS entirely (Safari has never shipped it), so an iPad reports
 * nothing and would land on `low` if memory were required — hence the
 * concurrency fallback. This is a starting guess: `world.setTier()` exists
 * because the honest way to choose a tier is to measure the first two seconds
 * of real frames, which `autoTune` below does.
 */
export function guessTier(hints: DeviceHints = {}): TierName {
  const mem = hints.deviceMemoryGb
  const cores = hints.hardwareConcurrency ?? 4
  if (mem !== undefined) {
    if (mem <= 2) return "low"
    if (mem <= 4) return "mid"
    if (mem <= 8) return cores >= 8 ? "high" : "mid"
    return "ultra"
  }
  // No deviceMemory: iOS, or a locked-down WebView.
  if (cores <= 2) return "low"
  if (cores <= 4) return "mid"
  if (cores <= 6) return "high"
  return "ultra"
}

/**
 * Move one tier at a time based on measured step cost against the frame budget.
 *
 * `budgetMs` is the share of the frame physics is allowed — 4 ms of a 16.67 ms
 * frame by default, which leaves the renderer 12. Hysteresis is asymmetric on
 * purpose: drop fast (a child is already seeing jank) and climb slowly (a
 * momentary lull is not evidence the device can sustain more).
 */
export function autoTune(
  current: TierName,
  p99StepMs: number,
  budgetMs = 4,
): TierName {
  const order: TierName[] = ["low", "mid", "high", "ultra"]
  const i = order.indexOf(current)
  if (p99StepMs > budgetMs && i > 0) return order[i - 1]!
  if (p99StepMs < budgetMs * 0.4 && i < order.length - 1) return order[i + 1]!
  return current
}
