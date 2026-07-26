// The reaction layer holds four product rules, and this file is where each one
// is either true or not:
//
//   MISSION    escalation never keys on run length or streak
//   MISSION    being wrong is never more interesting than being right
//   `Q-04`     an effect settles within 90 ms and never delays the input
//   `Q-06`     reduced motion is a zero-travel, particle-free cross-fade
//
// Plus `Q-05`: nothing here may import from the work surface or the engine.
//
// The stage is driven with an injected clock and an injected frame scheduler,
// and drawn into a recording context, so every one of these is asserted on
// behaviour rather than on the shape of the code — except the two that are
// genuinely claims about the code, which are asserted by reading it.

import { test } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { EFFECTS, effectsIn, energy, type Effect } from "./effects.ts"
import { FRESH, pick } from "./picker.ts"
import { createStage, REDUCED_MS, SETTLE_MS, type Stage } from "./stage.ts"
import { chooseTier, HARD, TIERS, TIER_ORDER, type Outcome, type TierName } from "./tiers.ts"
import { easeOut, type Anchor, type Ctx, type Frame, type Ink } from "./surface.ts"

const here = path.dirname(fileURLToPath(import.meta.url))

/** Source with comments stripped, so a scan reads code rather than prose. */
const code = (text: string): string =>
  text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1")

const sources = fs
  .readdirSync(here)
  .filter((name) => /\.(ts|tsx)$/.test(name) && !name.endsWith(".test.ts"))
  .map((name) => ({ name, text: fs.readFileSync(path.join(here, name), "utf8") }))

const INK: Ink = {
  index: "index",
  seat: "seat",
  strike: "strike",
  celestial: "celestial",
  line: "line",
}

const FULL: Anchor = {
  seat: { x: 10, y: 100, width: 120, height: 40 },
  cartouche: { x: 0, y: 10, width: 300, height: 60 },
  aperture: { x: 250, y: 20, width: 20, height: 20 },
}

const BARE: Anchor = { seat: FULL.seat, cartouche: null, aperture: null }

/** A context that remembers every call, so a frame can be compared to a frame. */
function recorder(): Ctx & { ops: string[]; arcs: number } {
  const ops: string[] = []
  const round = (n: number): string => String(Math.round(n * 100) / 100)
  const self = {
    ops,
    arcs: 0,
    fillStyle: "" as string | CanvasGradient | CanvasPattern,
    strokeStyle: "" as string | CanvasGradient | CanvasPattern,
    globalAlpha: 1,
    lineWidth: 1,
    lineCap: "butt" as CanvasLineCap,
    save: () => ops.push("save"),
    restore: () => ops.push("restore"),
    beginPath: () => ops.push("beginPath"),
    closePath: () => ops.push("closePath"),
    moveTo: (x: number, y: number) => ops.push(`moveTo ${round(x)} ${round(y)}`),
    lineTo: (x: number, y: number) => ops.push(`lineTo ${round(x)} ${round(y)}`),
    arc: (x: number, y: number, r: number) => {
      self.arcs += 1
      ops.push(`arc ${round(x)} ${round(y)} ${round(r)}`)
    },
    rect: (x: number, y: number, w: number, h: number) =>
      ops.push(`rect ${round(x)} ${round(y)} ${round(w)} ${round(h)}`),
    fill: () => ops.push(`fill ${String(self.fillStyle)} a${round(self.globalAlpha)}`),
    stroke: () => ops.push(`stroke ${String(self.strokeStyle)} a${round(self.globalAlpha)}`),
    clip: () => ops.push("clip"),
    clearRect: () => ops.push("clear"),
  }
  return self as unknown as Ctx & { ops: string[]; arcs: number }
}

/**
 * The `draw` value that makes the picker choose exactly this effect.
 *
 * The harness's default `draw: 0.5` is one number, and `pick` is deterministic,
 * so every "for every effect in the catalogue" loop that fired the stage was
 * really exercising **one effect per tier** — five of ten, silently. `chisel`,
 * `detent`, `tessera` and `rosetteLight` were drawn by no test in the repo, and
 * `detent` is the effect EXPERIENCE_DESIGN names as the one the child sees
 * hundreds of times. Scanning for the draw that selects a given effect, and
 * asserting that it does, is what turns those loops into coverage.
 */
function drawFor(effect: Effect): number {
  for (let step = 0; step < 1000; step++) {
    const value = step / 1000
    if (pick(effect.tier, FULL, FRESH, value)?.effect.id === effect.id) return value
  }
  throw new Error(`no draw value reaches ${effect.id} — it is unreachable in its tier`)
}

/** A frame as the stage would build it, so an effect can be drawn directly. */
function frameFor(
  effect: Effect,
  options: { reduced: boolean; raw: number; anchor?: Anchor },
): Frame {
  return {
    t: options.reduced ? 1 : easeOut(options.raw),
    alpha: 1,
    travel: options.reduced ? 0 : 1,
    motes: options.reduced ? 0 : effect.particles,
    gain: effect.peakGain,
    anchor: options.anchor ?? FULL,
    ink: INK,
  }
}

interface Harness {
  stage: Stage
  ctx: ReturnType<typeof recorder>
  advance: (ms: number) => void
  frames: number
}

function harness(options: { reduced?: boolean; anchor?: Anchor; draw?: number } = {}): Harness {
  const ctx = recorder()
  let clock = 0
  let queued: (() => void) | null = null
  const state: Harness = {
    ctx,
    frames: 0,
    stage: createStage({
      ctx,
      size: () => ({ width: 400, height: 800 }),
      now: () => clock,
      schedule: (run) => {
        queued = run
        return 1
      },
      cancel: () => {
        queued = null
      },
      reducedMotion: () => options.reduced === true,
      ink: () => INK,
      anchor: () => options.anchor ?? FULL,
      draw: () => options.draw ?? 0.5,
    }),
    advance: (ms) => {
      // One frame per 16 ms, the way a real rAF loop would deliver them.
      for (let step = 0; step < Math.max(1, Math.round(ms / 16)); step++) {
        clock += 16
        const run = queued
        queued = null
        if (run !== null) {
          state.frames += 1
          run()
        }
      }
    },
  }
  return state
}

const OUTCOME: Outcome = { correct: true, difficulty: 0, repaired: false, milestone: null }

// ── Escalation ─────────────────────────────────────────────────────────────

test("MISSION: no source in this directory names a run-length concept", () => {
  // A spelling check, and only a spelling check. It is here because the
  // registry this layer replaces escalated on `comboCount` by name, so a
  // reintroduction under the same name should be loud — but a field called
  // `chamberProgress` that counted consecutive correct answers would sail
  // through it, which is why the *rule* is asserted in the next test rather
  // than here. Comments are stripped first: the prose has to be able to say
  // what is banned, and the ban is on the code.
  for (const { name, text } of sources) {
    const hits = [...code(text).matchAll(/\b(streak|combo|runLength|run_length|consecutive)\b/gi)]
      .map((match) => match[0])
    assert.deepEqual(hits, [], `${name} names a run-length concept`)
  }
})

test("MISSION: escalation may key on cumulative construction, never on consecutive-correct", () => {
  // The rule as ADR-0009 sanctions it, stated so it can fail. `milestone` is
  // derived from the *lifetime* count of apertures cut, which does escalate —
  // every twentieth correct answer is a MECHANISM. What makes that not a streak
  // is that a wrong answer in between does not reset it and does not change
  // what the twentieth is worth. A run length is a count that a miss destroys;
  // this one a miss cannot touch.
  const before = chooseTier({ ...OUTCOME, milestone: "rosette" })
  chooseTier({ correct: false, difficulty: 1, repaired: false, milestone: null })
  const after = chooseTier({ ...OUTCOME, milestone: "rosette" })
  assert.equal(after, before, "an interleaved wrong answer changed what a milestone is worth")
  assert.equal(before, "mechanism")

  // …and it could not, because the function is stateless: the tier for an
  // outcome is a function of that outcome and nothing else.
  const history = [true, false, false, true, true].map(() =>
    chooseTier({ ...OUTCOME, milestone: "star" }),
  )
  assert.deepEqual(new Set(history).size, 1)
})

test("MISSION: handing the rule a run length changes nothing", () => {
  const smuggled = { ...OUTCOME, runLength: 99, streak: 40, comboCount: 12 } as Outcome
  assert.equal(chooseTier(smuggled), chooseTier(OUTCOME))
})

test("escalation keys on difficulty and on repair", () => {
  assert.equal(chooseTier({ ...OUTCOME, difficulty: 0.1 }), "seat")
  assert.equal(chooseTier({ ...OUTCOME, difficulty: HARD }), "engage")
  assert.equal(chooseTier({ ...OUTCOME, repaired: true }), "illuminate")
  assert.equal(chooseTier({ ...OUTCOME, milestone: "star" }), "illuminate")
  assert.equal(chooseTier({ ...OUTCOME, milestone: "rosette" }), "mechanism")
})

test("no wrong answer can reach any tier above SLIP, however it is dressed up", () => {
  for (const difficulty of [0, 0.5, 1]) {
    for (const repaired of [false, true]) {
      for (const milestone of [null, "star", "rosette", "course", "screen"] as const) {
        assert.equal(
          chooseTier({ correct: false, difficulty, repaired, milestone }),
          "slip",
          "a wrong answer escalated",
        )
      }
    }
  }
})

// ── Energy ─────────────────────────────────────────────────────────────────

test("MISSION: energy(SLIP) < energy(SEAT), in the strong form", () => {
  const loudest = (tier: TierName): number => Math.max(...effectsIn(tier).map(energy))
  const quietest = (tier: TierName): number => Math.min(...effectsIn(tier).map(energy))
  assert.ok(
    loudest("slip") < quietest("seat"),
    `slip ${String(loudest("slip"))} !< seat ${String(quietest("seat"))}`,
  )
})

test("the whole energy ladder is strictly ordered, quiet to loud", () => {
  const ladder = [...TIER_ORDER].reverse()
  for (let i = 0; i + 1 < ladder.length; i++) {
    const lower = ladder[i]
    const upper = ladder[i + 1]
    if (lower === undefined || upper === undefined) continue
    const loudest = Math.max(...effectsIn(lower).map(energy))
    const quietest = Math.min(...effectsIn(upper).map(energy))
    assert.ok(loudest < quietest, `${lower} ${String(loudest)} !< ${upper} ${String(quietest)}`)
  }
})

test("every tier has an effect and every effect declares its energy factors", () => {
  for (const tier of TIER_ORDER) assert.ok(effectsIn(tier).length >= 1, `${tier} has no effect`)
  for (const effect of EFFECTS) {
    assert.ok(effect.particles >= 0 && effect.peakGain > 0 && effect.elements > 0, effect.id)
    assert.equal(new Set(EFFECTS.map((other) => other.id)).size, EFFECTS.length)
  }
})

test("only MECHANISM is once a session, and it is the loudest thing here", () => {
  const once = TIER_ORDER.filter((tier) => TIERS[tier].oncePerSession)
  assert.deepEqual(once, ["mechanism"])
})

// ── The picker ─────────────────────────────────────────────────────────────

test("the picker never draws the same effect twice running in a tier", () => {
  let state = FRESH
  const seen: string[] = []
  for (let i = 0; i < 12; i++) {
    const chosen = pick("seat", FULL, state, (i * 0.37) % 1)
    assert.ok(chosen !== null)
    state = chosen.state
    seen.push(chosen.effect.id)
  }
  for (let i = 1; i < seen.length; i++) assert.notEqual(seen[i], seen[i - 1])
})

test("weighting is inverse to energy — the quiet effect is the common one", () => {
  const tally = new Map<string, number>()
  for (let i = 0; i < 400; i++) {
    // A fresh picker each draw, so the no-repeat rule does not flatten the
    // distribution the weighting is supposed to produce.
    const chosen = pick("engage", FULL, FRESH, (i * 0.0025 + 0.0001) % 1)
    assert.ok(chosen !== null)
    tally.set(chosen.effect.id, (tally.get(chosen.effect.id) ?? 0) + 1)
  }
  const ranked = [...effectsIn("engage")].sort((a, b) => energy(a) - energy(b))
  const quiet = ranked[0]
  const loud = ranked[ranked.length - 1]
  assert.ok(quiet !== undefined && loud !== undefined && quiet !== loud)
  assert.ok(
    (tally.get(quiet.id) ?? 0) > (tally.get(loud.id) ?? 0),
    `quiet ${String(tally.get(quiet.id))} vs loud ${String(tally.get(loud.id))}`,
  )
})

test("a missing anchor walks the tier DOWN, never up", () => {
  // With only the answer row on screen the MECHANISM has nowhere to play, so it
  // comes down to the loudest tier that has a seat-anchored effect in it. The
  // number that matters is the direction: the walk may never raise the tier,
  // because a missing anchor must not be able to make a response louder than
  // the outcome earned.
  const chosen = pick("mechanism", BARE, FRESH, 0.5)
  assert.ok(chosen !== null)
  assert.ok(
    TIERS[chosen.tier].level < TIERS.mechanism.level,
    "the walk must never raise the tier",
  )
  assert.ok(
    chosen.effect.needs.every((requirement) => BARE[requirement] !== null),
    "the walk landed on an effect whose anchors are not on screen",
  )
  // Every tier below is walked in order, so it lands on the highest one that
  // has somewhere to draw rather than falling all the way to SEAT.
  const louder = TIER_ORDER.slice(0, TIER_ORDER.indexOf(chosen.tier))
  for (const tier of louder) {
    assert.ok(
      effectsIn(tier).every((effect) => effect.needs.some((need) => BARE[need] === null)),
      `${tier} had an eligible effect and the walk passed it`,
    )
  }
})

test("the MECHANISM budget is once a session and spending it downgrades", () => {
  const first = pick("mechanism", FULL, FRESH, 0.5)
  assert.ok(first !== null)
  assert.equal(first.tier, "mechanism")
  const second = pick("mechanism", FULL, first.state, 0.5)
  assert.ok(second !== null)
  assert.notEqual(second.tier, "mechanism")
  assert.ok(TIERS[second.tier].level < TIERS.mechanism.level)
})

// ── The stage: interruptibility ────────────────────────────────────────────

test("Q-04: settleNow returns synchronously and the picture is gone in 90 ms", () => {
  const h = harness()
  h.stage.fire({ ...OUTCOME, milestone: "rosette" })
  assert.equal(h.stage.running(), true)
  h.advance(300)
  assert.equal(h.stage.running(), true, "a tier-2/3 effect is still running at 300 ms")

  const before = Date.now()
  h.stage.settleNow()
  assert.ok(Date.now() - before < 20, "settleNow did work on the caller's thread")

  h.advance(SETTLE_MS + 16)
  assert.equal(h.stage.running(), false, "still running past the settle window")
  assert.ok(SETTLE_MS <= 90, `settle budget ${String(SETTLE_MS)} exceeds Q-04's 90 ms`)
  assert.equal(h.ctx.ops[h.ctx.ops.length - 1], "clear", "the canvas was left dirty")
})

test("Q-04: a settling effect fades rather than snapping to nothing", () => {
  const h = harness()
  h.stage.fire({ ...OUTCOME, milestone: "rosette" })
  h.advance(200)
  h.stage.settleNow()
  const alphas: number[] = []
  for (let step = 0; step < 5; step++) {
    h.ctx.ops.length = 0
    h.advance(16)
    for (const op of h.ctx.ops) {
      const match = /a(\d*\.?\d+)$/.exec(op)
      if (match?.[1] !== undefined) alphas.push(Number(match[1]))
    }
  }
  assert.ok(alphas.length > 0, "nothing was drawn while settling")
  assert.ok(Math.max(...alphas) > Math.min(...alphas), "the settle did not fade")
})

test("firing again while one is running replaces it and never stacks", () => {
  const h = harness()
  h.stage.fire(OUTCOME)
  h.advance(50)
  h.stage.fire({ ...OUTCOME, difficulty: 1 })
  h.advance(50)
  // One clear per frame means one effect per frame. Two stacked effects would
  // put two draws between two clears.
  const between = h.ctx.ops.join("|").split("clear").at(-2) ?? ""
  assert.ok((between.match(/save/g) ?? []).length <= 1, "two effects drew in one frame")
})

test("an effect anchored on the band is clipped to it", () => {
  // The canvas is `fixed inset-0` over the whole app, so nothing stopped a
  // 1.7-radius arc struck around the 44 px rosette in a 72 px band from
  // overrunning the band's top edge and drawing across the header strapwork.
  // Every cartouche- or aperture-anchored effect declares the band as its clip;
  // the seat-anchored ones declare none, because the answer row is where they
  // are supposed to be.
  for (const effect of EFFECTS) {
    const wantsBand = effect.needs.some((need) => need === "cartouche" || need === "aperture")
    assert.equal(effect.clip, wantsBand ? "cartouche" : null, `${effect.id} clips to ${String(effect.clip)}`)
  }

  // And the stage applies it: the clip is set before the effect draws, to the
  // anchor's own rectangle, once per frame.
  const h = harness({ draw: drawFor(EFFECTS.find((e) => e.id === "closure") ?? EFFECTS[0]!) })
  h.stage.fire({ ...OUTCOME, milestone: "rosette" })
  const ops = h.ctx.ops.join("|")
  const band = FULL.cartouche
  assert.ok(band !== null)
  assert.ok(
    ops.includes(`rect ${String(band.x)} ${String(band.y)} ${String(band.width)} ${String(band.height)}|clip`),
    "the stage did not clip to the band before drawing",
  )
  assert.ok(ops.indexOf("clip") < ops.indexOf("stroke"), "the clip was set after the drawing")
})

test("an effect ends on its own inside its tier's budget", () => {
  const h = harness()
  const tier = h.stage.fire(OUTCOME)
  assert.ok(tier !== null)
  h.advance(TIERS[tier].budgetMs + 32)
  assert.equal(h.stage.running(), false)
})

// ── The stage: reduced motion ──────────────────────────────────────────────

test("every effect in the catalogue is reachable, and these loops reach it", () => {
  // The precondition the three gates below stand on. If an effect cannot be
  // selected by any draw value it is dead code in the product; if `drawFor`
  // cannot find the value, the loops are back to testing one effect per tier.
  const reached = EFFECTS.map((effect) => pick(effect.tier, FULL, FRESH, drawFor(effect))?.effect.id)
  assert.deepEqual(reached, EFFECTS.map((effect) => effect.id))
})

test("Q-06: reduced motion draws the same frame throughout — zero travel", () => {
  // The strongest form of "zero travel" available: two frames 96 ms apart, on
  // every effect in the catalogue, must lay down byte-identical geometry.
  // Alpha differs — it is cross-fading — so only coordinates are compared.
  //
  // Driven through the real stage, one effect at a time, with the draw value
  // that selects it — and the selection is asserted, so this cannot quietly
  // become "the same five effects, ten times".
  const geometry = (ops: string[]): string[] =>
    ops.filter((op) => /^(moveTo|lineTo|arc|rect)/.test(op))

  for (const effect of EFFECTS) {
    const draw = drawFor(effect)
    assert.equal(pick(effect.tier, FULL, FRESH, draw)?.effect.id, effect.id)
    const h = harness({ reduced: true, draw })
    assert.equal(h.stage.fire(outcomeFor(effect)), effect.tier, `${effect.id} did not fire its tier`)
    const frame = (): string[] => {
      h.ctx.ops.length = 0
      h.advance(16)
      return geometry(h.ctx.ops)
    }
    const early = frame()
    h.advance(80)
    const late = frame()
    // No `continue` on an empty frame. An effect that drew nothing used to skip
    // both halves of this gate and be counted as a pass.
    assert.ok(early.length > 0, `${effect.id} drew nothing at all under reduced motion`)
    assert.deepEqual(late, early, `${effect.id} moved under reduced motion`)
  }
})

test("…and every effect does move when motion is allowed", () => {
  // The other half, asserted per effect rather than collected into a list. The
  // first cut pushed `effect.id` — the loop variable — into the list and
  // compared the list to the catalogue, so the assertion held as long as
  // *something* moved on each iteration, whichever effect it was.
  const geometry = (ops: string[]): string[] =>
    ops.filter((op) => /^(moveTo|lineTo|arc|rect)/.test(op))
  for (const effect of EFFECTS) {
    const draw = drawFor(effect)
    const h = harness({ draw })
    assert.equal(h.stage.fire(outcomeFor(effect)), effect.tier)
    const frame = (): string[] => {
      h.ctx.ops.length = 0
      h.advance(16)
      return geometry(h.ctx.ops)
    }
    const early = frame()
    h.advance(80)
    const late = frame()
    assert.ok(early.length > 0 && late.length > 0, `${effect.id} drew nothing with motion on`)
    assert.notDeepEqual(late, early, `${effect.id} does not move with motion on`)
  }
})

test("Q-06: reduced motion emits no particles, and normal motion emits exactly its own", () => {
  // Drawn directly rather than through the stage, because this is a claim about
  // each effect's own geometry and the arithmetic has to be exact: one mote is
  // one `arc`, so the difference between the two frames is the mote count and
  // nothing else. Any non-mote arc an effect strikes appears in both and
  // cancels.
  //
  // `t` is 0.5, not 1: `motes` skips a mote whose radius has shrunk to zero, so
  // at the end of the reaction there are none to count in either branch and the
  // gate would pass on every effect for the wrong reason.
  for (const effect of EFFECTS) {
    const on = recorder()
    effect.draw(on, frameFor(effect, { reduced: false, raw: 0.5 }))
    const off = recorder()
    effect.draw(off, frameFor(effect, { reduced: true, raw: 0.5 }))
    assert.equal(
      on.arcs - off.arcs,
      effect.particles,
      `${effect.id} drew ${String(on.arcs - off.arcs)} particles, not ${String(effect.particles)}`,
    )
  }

  // And end to end through the stage, on the loudest tier there is.
  const withMotes = harness()
  withMotes.stage.fire({ ...OUTCOME, milestone: "rosette" })
  withMotes.advance(400)
  assert.ok(withMotes.ctx.arcs > 0, "no particles drawn with motion on")

  const reduced = harness({ reduced: true })
  reduced.stage.fire({ ...OUTCOME, milestone: "rosette" })
  reduced.advance(REDUCED_MS)
  assert.equal(reduced.ctx.arcs, 0, "particles drawn under reduced motion")
})

test("Q-06: the reduced branch is a cross-fade — alpha rises then falls", () => {
  const h = harness({ reduced: true })
  h.stage.fire({ ...OUTCOME, milestone: "rosette" })
  const peaks: number[] = []
  for (let step = 0; step < Math.round(REDUCED_MS / 16); step++) {
    h.ctx.ops.length = 0
    h.advance(16)
    const alphas = h.ctx.ops
      .map((op) => /a(\d*\.?\d+)$/.exec(op)?.[1])
      .filter((value): value is string => value !== undefined)
      .map(Number)
    if (alphas.length > 0) peaks.push(Math.max(...alphas))
  }
  assert.ok(peaks.length >= 3, "too few frames to be a fade")
  const top = Math.max(...peaks)
  assert.ok((peaks[0] ?? 1) < top && (peaks[peaks.length - 1] ?? 1) < top, "not a cross-fade")
})

test("particles come from exactly one place", () => {
  // "No particles under reduced motion" leaks the moment a second place emits
  // them. `surface.ts` owns `motes`, and it is the only file that may read the
  // mote count — so no effect is able to emit a particle of its own.
  const readers = sources
    .filter(({ name }) => name !== "surface.ts")
    .filter(({ text }) => /\.motes\b/.test(code(text)))
    .map(({ name }) => name)
  assert.deepEqual(readers, [], "something outside surface.ts reads the mote count")

  // …and every effect that declares particles actually throws them through it,
  // so the declaration and the drawing cannot drift.
  for (const effect of EFFECTS) {
    const drawn = recorder()
    effect.draw(drawn, frameFor(effect, { reduced: false, raw: 0.5 }))
    if (effect.particles > 0) assert.ok(drawn.arcs > 0, `${effect.id} declares motes and throws none`)
  }
})

test("EXPERIENCE_DESIGN: nothing below ENGAGE throws a particle", () => {
  // The SEAT row of EXPERIENCE_DESIGN's core-loop table: "One detent click, one
  // gear tooth, a `light` haptic, **no particles**". Both SEAT effects shipped
  // with three each. SLIP has none either, because SLIP has to be quieter than
  // SEAT and a chip of stone coming off is more animated than a pawl dropping
  // into a tooth — the "catapult falling short" case the doc names.
  for (const tier of ["slip", "seat"] as const) {
    for (const effect of effectsIn(tier)) {
      assert.equal(effect.particles, 0, `${effect.id} (${tier}) throws ${String(effect.particles)}`)
    }
  }
  for (const tier of ["engage", "illuminate", "mechanism"] as const) {
    for (const effect of effectsIn(tier)) {
      assert.ok(effect.particles > 0, `${effect.id} (${tier}) throws nothing`)
    }
  }
})

test("a particle-free effect still has energy — the formula is not degenerate", () => {
  // The first cut multiplied by `particles`, so `particles: 0` scored zero
  // however loud the thing was, and the SLIP<SEAT ladder could be satisfied by
  // *adding* a particle rather than by being quieter. The term is additive.
  for (const effect of EFFECTS) {
    assert.ok(energy(effect) > 0, `${effect.id} has zero energy`)
  }
  const quietest = EFFECTS.reduce((a, b) => (energy(a) <= energy(b) ? a : b))
  assert.equal(quietest.particles, 0, "the quietest effect in the catalogue is not the particle-free one")
})

// ── Boundary ───────────────────────────────────────────────────────────────

test("Q-05: the reaction layer imports nothing from the work surface or engine", () => {
  const offenders: string[] = []
  for (const { name, text } of sources) {
    for (const [, specifier] of text.matchAll(/from\s+"([^"]+)"/g)) {
      if (/(\.\.\/work\/|\.\.\/screens\/|engine|curriculum)/.test(specifier ?? "")) {
        offenders.push(`${name} -> ${specifier ?? ""}`)
      }
    }
  }
  assert.deepEqual(offenders, [])
})

test("nothing here awaits a reaction", () => {
  for (const { name, text } of sources) {
    assert.equal(/\bawait\b|Promise</.test(text), false, `${name} awaits something`)
  }
})

/** The cheapest outcome that reaches a given effect's tier. */
function outcomeFor(effect: Effect): Outcome {
  switch (effect.tier) {
    case "slip":
      return { ...OUTCOME, correct: false }
    case "seat":
      return OUTCOME
    case "engage":
      return { ...OUTCOME, difficulty: 1 }
    case "illuminate":
      return { ...OUTCOME, milestone: "star" }
    case "mechanism":
      return { ...OUTCOME, milestone: "rosette" }
  }
}
