import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { Feel } from "../core/feel.ts"
import { Director } from "../sim/director.ts"
import { Rng } from "../core/rng.ts"
import { buildNumberPool } from "../sim/factor.ts"

test("nothing blocks: advance always returns simulation time outside a hitstop", () => {
  const f = new Feel({ reducedMotion: false })
  for (let i = 0; i < 200; i++) {
    f.addTrauma(1)
    f.punch(0.4)
    f.kick(1, 0, 40)
    assert.ok(f.advance(16.7, i * 16.7) > 0, "only an explicit hitstop may stop the sim")
  }
})

test("a hitstop is bounded and always ends", () => {
  const f = new Feel({ reducedMotion: false })
  f.hitstop(90)
  let frozen = 0
  for (let i = 0; i < 60; i++) if (f.advance(16.7, i * 16.7) === 0) frozen++
  assert.ok(frozen > 0 && frozen <= 7, `froze for ${frozen} frames`)
})

test("flashes are hard rate-limited — a children's product", () => {
  const f = new Feel({ reducedMotion: false })
  let now = 0
  let flashes = 0
  let prev = 0
  // Ask for a full-strength flash every single frame for two seconds.
  for (let i = 0; i < 120; i++) {
    f.requestFlash(1, "#ffffff")
    f.advance(16.7, now)
    if (f.flashAlpha > prev + 0.05) flashes++
    prev = f.flashAlpha
    assert.ok(f.flashAlpha <= 0.42 + 1e-6, `flash alpha ${f.flashAlpha} exceeded the cap`)
    now += 16.7
  }
  assert.ok(flashes <= 3 * 2 + 1, `${flashes} flashes in 2s exceeds 3/s`)
})

test("reduced motion collapses every motion channel to zero", () => {
  const f = new Feel({ reducedMotion: true })
  f.addTrauma(1)
  f.kick(1, 1, 50)
  f.punch(0.5)
  f.hitstop(200)
  f.slowmo(0.2, 900)
  f.requestFlash(1, "#fff")
  const sim = f.advance(16.7, 16.7)
  assert.equal(sim, 16.7, "reduced motion must never freeze or slow the sim")
  assert.equal(f.shakeX, 0)
  assert.equal(f.shakeY, 0)
  assert.equal(f.scale, 1)
  assert.equal(f.flashAlpha, 0)
})

test("slow-motion always recovers to real time", () => {
  const f = new Feel({ reducedMotion: false })
  f.advance(16.7, 0)
  f.slowmo(0.3, 500)
  let t = 0
  for (let i = 0; i < 60; i++) {
    t += 16.7
    f.advance(16.7, t)
  }
  assert.equal(f.timeScale(), 1)
})

test("escalation cannot see a streak — no source file may mention one", () => {
  const root = new URL("../", import.meta.url).pathname
  const offenders: string[] = []
  const walk = (dir: string): void => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name)
      if (e.isDirectory()) {
        walk(p)
        continue
      }
      if (!e.name.endsWith(".ts") || e.name.endsWith(".test.ts")) continue
      const src = readFileSync(p, "utf8")
      // Strip comments — block, full-line AND trailing. The *prose* may discuss
      // the rule; the code may not. Missing trailing comments made this fire on
      // the word "streak" inside a particle-kind annotation, which is exactly
      // the false positive that gets a real rule disabled.
      const code = src
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/(^|[^:"'`\\])\/\/.*$/gm, "$1")
      if (/\bstreak\b/i.test(code)) offenders.push(p)
    }
  }
  walk(root)
  assert.deepEqual(offenders, [], "streak-keyed escalation is forbidden")
})

test("the director escalates forever and never completes", () => {
  const d = new Director(new Rng(5), buildNumberPool(2, 144))
  const out = Array.from({ length: 24 }, () => ({
    kind: "numeral" as const,
    value: 0,
    delayMs: 0,
    bandT: 0,
    apex: 0,
  }))
  const heats: number[] = []
  let throws = 0
  // Twenty minutes at 60fps.
  for (let i = 0; i < 60 * 60 * 20; i++) {
    throws += d.step(1 / 60, out)
    if (i % (60 * 120) === 0) heats.push(d.heat)
  }
  assert.ok(throws > 2000, `only ${throws} throws in 20 minutes`)
  for (let i = 1; i < heats.length; i++) {
    assert.ok((heats[i] as number) >= (heats[i - 1] as number), "heat must never fall")
  }
  assert.ok((heats.at(-1) as number) > (heats[0] as number) + 0.5, "twenty minutes must feel different")
  assert.ok(d.heat <= 1)
})

test("difficulty tracks the player and stays inside the host's band", () => {
  const d = new Director(new Rng(5), buildNumberPool(2, 144))
  for (let i = 0; i < 60 * 600; i++) d.step(1 / 60, [])
  for (const acc of [0, 0.25, 0.5, 0.75, 1]) {
    const q = d.questionDifficulty(acc)
    assert.ok(q >= 1 && q <= 10, `difficulty ${q} out of band`)
  }
  assert.ok(d.questionDifficulty(1) > d.questionDifficulty(0), "doing well must ask for more")
})
