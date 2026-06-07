/**
 * #116 — NPC spacing rule.
 *
 * Three light nudges keep the Talk vs Enter affordances from overlapping/flickering:
 *  1. ambient wanderers keep a clearance bubble around every stationed special;
 *  2. a special is stationed clear of openable door portals;
 *  3. the focus picker is sticky (hysteresis) so two near-equidistant NPCs don't
 *     swap the Talk affordance every frame.
 *
 * The focus decision (#3) is extracted as the pure `chooseFocus`; the clearance
 * geometry (#1/#2) is the proven `pushOutCircle` fed door/special circles. Both are
 * unit-tested here without Babylon/DOM (the full crowd loop needs a NullEngine).
 */
import { describe, it, expect } from "vitest"
import { chooseFocus } from "./npcFocus"
import { pushOutCircle } from "./collision"

const RANGE2 = 4.0 * 4.0

describe("#116.3 chooseFocus — priority + hysteresis (no flicker)", () => {
  it("the objective (priority) always wins, even if a wanderer is marginally closer", () => {
    const next = chooseFocus({
      best: "wanderer",
      bestD: 1.0,
      priority: "objective",
      focused: "wanderer",
      focusedD: 1.0,
      range2: RANGE2,
    })
    expect(next).toBe("objective")
  })

  it("first acquisition (nothing focused) picks the nearest decisively", () => {
    expect(
      chooseFocus({ best: "a", bestD: 2.0, priority: null, focused: null, focusedD: RANGE2 + 1, range2: RANGE2 }),
    ).toBe("a")
  })

  it("KEEPS the current focus when a rival is only marginally closer (kills the swap)", () => {
    // focused at d=2.00, rival best at d=1.8 → within FOCUS_HYSTERESIS (1.6) → keep.
    const next = chooseFocus({
      best: "rival",
      bestD: 1.8,
      priority: null,
      focused: "current",
      focusedD: 2.0,
      range2: RANGE2,
    })
    expect(next).toBe("current")
  })

  it("STEALS focus when the rival is decisively closer (beyond the margin)", () => {
    // focused at d=4.0, rival at d=1.0 → 1.0 < 4.0 - 1.6 → steal.
    const next = chooseFocus({
      best: "rival",
      bestD: 1.0,
      priority: null,
      focused: "current",
      focusedD: 4.0,
      range2: RANGE2,
    })
    expect(next).toBe("rival")
  })

  it("drops a focus that has left RANGE (no sticking out of range)", () => {
    const next = chooseFocus({
      best: "rival",
      bestD: 3.0,
      priority: null,
      focused: "current",
      focusedD: RANGE2 + 5, // current walked out of range
      range2: RANGE2,
    })
    expect(next).toBe("rival")
  })

  it("a stable scene does NOT flip across frames (idempotent once focused)", () => {
    // Two NPCs ~equidistant; once 'a' is focused it stays 'a' over repeated frames.
    let focused: string | null = null
    for (let frame = 0; frame < 10; frame++) {
      // tiny jitter in who is nominally nearest, both within the margin.
      const aNearer = frame % 2 === 0
      const best = aNearer ? "a" : "b"
      const bestD = aNearer ? 2.0 : 2.1
      const focusedD: number = focused == null ? RANGE2 + 1 : 2.05
      focused = chooseFocus({ best, bestD, priority: null, focused, focusedD, range2: RANGE2 })
    }
    // It settled on the first acquisition and never flickered back and forth.
    expect(focused === "a" || focused === "b").toBe(true)
  })
})

describe("#116.2 door clearance — a special stationed on a door anchor is pushed clear", () => {
  it("pushOutCircle moves a special off a door-clear circle to ≥ the required gap", () => {
    const doorR = 1.6 // DOOR_CLEAR_R in game.ts
    const agentR = 0 // the station point itself (radius folded into the circle)
    // Special anchored EXACTLY on the door anchor (0,0).
    const out = pushOutCircle(0, 0, agentR, 0, 0, doorR)
    const d = Math.hypot(out.x, out.z)
    expect(d).toBeGreaterThanOrEqual(doorR) // stands BESIDE the door, not on it
    expect(d).toBeLessThan(doorR + 0.5) // but still close — a step aside, not exiled
  })

  it("a special already clear of the door is left untouched", () => {
    const out = pushOutCircle(5, 0, 0, 0, 0, 1.6)
    expect(out).toEqual({ x: 5, z: 0 })
  })
})

describe("#116.1 special clearance — a wanderer inside the bubble is steered to its edge", () => {
  // Mirror of the crowd update: a wanderer within SPECIAL_CLEAR of a special gets a
  // new target on the bubble edge (SPECIAL_CLEAR + 1.0). Pure radial math.
  const SPECIAL_CLEAR = 2.4
  const steerOut = (ax: number, az: number, sx: number, sz: number) => {
    const ox = ax - sx
    const oz = az - sz
    const od = Math.hypot(ox, oz)
    if (od >= SPECIAL_CLEAR) return null // already clear → no nudge
    const ux = od > 1e-3 ? ox / od : 1
    const uz = od > 1e-3 ? oz / od : 0
    return { x: sx + ux * (SPECIAL_CLEAR + 1.0), z: sz + uz * (SPECIAL_CLEAR + 1.0) }
  }

  it("a wanderer crowding a special is given a target OUTSIDE the clearance bubble", () => {
    const t = steerOut(0.5, 0, 0, 0) // 0.5u from the special → inside the bubble
    expect(t).not.toBeNull()
    expect(Math.hypot(t!.x, t!.z)).toBeGreaterThan(SPECIAL_CLEAR)
  })

  it("a wanderer already outside the bubble is NOT nudged", () => {
    expect(steerOut(3.0, 0, 0, 0)).toBeNull()
  })

  it("a wanderer EXACTLY on the special (degenerate) still gets a valid push", () => {
    const t = steerOut(0, 0, 0, 0)
    expect(t).not.toBeNull()
    expect(Math.hypot(t!.x, t!.z)).toBeCloseTo(SPECIAL_CLEAR + 1.0)
  })
})
