// The seam, guarded at the source.
//
// `order.ts` and `economy.ts` are pure and their tests play bots against them,
// and neither of those facts is worth anything if `mount.ts` quietly stops
// calling them. The numbers this batch fixed lived inline in a 2,000-line file
// precisely *because* nothing could see them from a test, and the same thing
// will happen again the first time somebody "just tweaks the feel" in the mount.
//
// So this file reads `mount.ts` as text. That is a blunt instrument and it is
// used deliberately: the alternative is a DOM, a canvas, a pointer-event
// harness and a rendering stack, to assert a dozen call sites. Every assertion
// below names the specific regression it exists to catch.

import assert from "node:assert/strict"
import { test } from "node:test"
import { readFileSync, readdirSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { join } from "node:path"

const here = fileURLToPath(new URL("../", import.meta.url))
const MOUNT = readFileSync(join(here, "mount.ts"), "utf8")
const DIRECTOR = readFileSync(join(here, "sim/director.ts"), "utf8")

/** Source with `//` line comments stripped, so prose about a rule is not the rule. */
const strip = (src: string): string =>
  src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((line) => {
      const at = line.indexOf("//")
      return at === -1 ? line : line.slice(0, at)
    })
    .join("\n")

const CODE = strip(MOUNT)
const DIR = strip(DIRECTOR)
const count = (needle: string, hay = CODE): number => hay.split(needle).length - 1

test("THE NAME THE CHILD SEES IS MATH NINJA", () => {
  // The founder, verbatim: "It needs to be 'Math Ninja'". The pack id and the
  // directory stay `slice` so that nothing about packaging or the catalog moves;
  // everything a child can read does not.
  assert.ok(MOUNT.includes('title: "MATH NINJA"'), "the manual is not titled MATH NINJA")
  const pack = JSON.parse(readFileSync(join(here, "../pack.json"), "utf8")) as {
    id: string
    name: string
    description: string
  }
  assert.equal(pack.name, "MATH NINJA", `pack.json still ships as "${pack.name}"`)
  assert.equal(pack.id, "dynawalla.slice", "the pack id moved — packaging and the catalog break")
  assert.ok(!/THE SPLIT/.test(pack.description), "pack.json's description still says THE SPLIT")

  // …and nowhere in the shipped source, either. A stale title in a banner is
  // exactly the kind of thing that survives a rename.
  const offenders: string[] = []
  const walk = (dir: string): void => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name)
      if (e.isDirectory()) {
        walk(p)
        continue
      }
      // Test files are exempt: this one has to be able to say the old name in
      // order to look for it, and so does the README's history section.
      if (!/\.(ts|html|json)$/.test(e.name) || /\.test\.ts$/.test(e.name)) continue
      if (readFileSync(p, "utf8").includes("THE SPLIT")) offenders.push(p)
    }
  }
  walk(join(here, ".."))
  assert.deepEqual(offenders, [], "THE SPLIT is still written somewhere in the pack")
})

test("THERE IS NO CLOCK ON ANY ARITHMETIC", () => {
  // The single most important structural claim in this game, and the one an
  // innocent-looking "the gate should not hang forever" change would undo.
  //
  // `moteSecondsFor`, `usableAnswerSeconds` and `marketHushSeconds` sized an
  // answering window; all three are deleted, and if any of them comes back it
  // will come back through here.
  for (const gone of ["moteSecondsFor", "usableAnswerSeconds", "marketHushSeconds", "moteLeft", "moteWindow"]) {
    assert.ok(!CODE.includes(gone), `${gone} is back in mount.ts — something is counting down again`)
  }
  assert.ok(!/expireQuestion/.test(CODE), "a question can expire again")
  // The gate holds NOTHING against a clock: its only per-frame state is the mark
  // it was asked at, used for latency, and latency is a report, not a deadline.
  const gate = CODE.slice(CODE.indexOf("type Gate ="))
  assert.ok(
    /askedAt: number\s*}/.test(gate.slice(0, 200)),
    "the gate grew a second field — check it is not a timer",
  )
})

test("the order is the one place a value is judged, and economy.ts prices it", () => {
  // The regression: `mount.ts` starts deciding for itself what is helpful, and
  // the no-dead-end proof in `order.ts` stops being about the shipped game.
  assert.ok(CODE.includes("order.classify("), "the mount no longer asks the order what a value is")
  assert.ok(CODE.includes("order.take("), "the mount advances the order without asking")
  assert.ok(!/value\s*<=\s*residual/.test(CODE), "the mount is classifying values itself")
  assert.ok(CODE.includes("orderValue("), "the fill payout is a constant in the mount again")
  assert.ok(CODE.includes("advanceValue("), "an advance is priced in the mount again")
  assert.ok(CODE.includes("tidyBonus("), "the three-cut bonus is a constant in the mount again")
})

test("SCORE COMES FROM ONE SOURCE ONLY: advancing or filling an order", () => {
  // The regression that would undo the whole design: somebody adds `score +=`
  // to a cut path "so slicing feels good". Every `score +=` in the file must be
  // inside `onHelpful` or `fillOrder`, and there are exactly two of them.
  const adds = [...CODE.matchAll(/score \+=/g)].map((m) => m.index ?? 0)
  assert.equal(adds.length, 2, `there are ${adds.length} places that add to the score, not two`)
  const helpful = CODE.indexOf("function onHelpful")
  const fill = CODE.indexOf("function fillOrder")
  const after = CODE.indexOf("function onOvershoot")
  assert.ok(helpful > 0 && fill > helpful && after > fill, "the scoring functions moved — this scan is stale")
  assert.ok((adds[0] as number) > helpful && (adds[0] as number) < fill, "the first score is not in onHelpful")
  assert.ok((adds[1] as number) > fill && (adds[1] as number) < after, "the second score is not in fillOrder")
  assert.ok(!/score \-=/.test(CODE), "something deducts points — nothing in this game may")
})

test("only a bomb can put a lamp out", () => {
  // The regression: `spendLamp()` creeps into the overshoot branch, and being
  // wrong about arithmetic costs a life again.
  // Three occurrences: the declaration, the call from `onBomb`, and the
  // `lampCost(verdict)` loop — which runs zero times, for every verdict there is.
  assert.equal(count("spendLamp()"), 3, "spendLamp is called from somewhere new")
  assert.equal(count("lampCost(verdict); i++) spendLamp()"), 1, "a lamp is spent without asking lampCost")
  const bomb = CODE.slice(CODE.indexOf("function onBomb"))
  assert.ok(bomb.slice(0, bomb.indexOf("\n  }")).includes("spendLamp()"), "a bomb stopped costing a lamp")
})

test("NOTHING IN THIS GAME IS RED", () => {
  // The four channels BEAM deleted, and this game still had two of them: a red
  // screen flash and a damage vignette on being wrong. The `WRONG` palette entry
  // is not imported here at all any more, which is the strongest form of this.
  assert.ok(!CODE.includes("WRONG"), "the WRONG palette entry is back in mount.ts")
  assert.ok(!/vignette/.test(CODE), "the damage vignette is back")
  const over = CODE.slice(CODE.indexOf("function onOvershoot"))
  const body = over.slice(0, over.indexOf("\n  }"))
  assert.ok(body.length > 200, "onOvershoot moved — this scan is stale")
  assert.ok(!body.includes("requestFlash"), "the screen flash on a miss is back")
  assert.ok(!body.includes('haptic("failure")'), "the failure haptic on a miss is back")
  assert.ok(body.includes("showReveal("), "a miss stopped completing the sum")
  // …and no `failure` haptic anywhere. A bomb is loud; loud is not the same as
  // telling a child they failed.
  assert.equal(count('haptic("failure")'), 0, "something in this game fires a failure haptic")
})

test("the completed sum is HELD, and the hold is ended by the three things that may", () => {
  // `games/stack`'s rule: never aim at one thing while reading another. The hold
  // is `Director.quiet`, and the three things that may end it are the clock
  // running out, a stroke, and a new order clearing the screen.
  assert.ok(CODE.includes("revealHoldSeconds(intensity)"), "the hold is a constant in the mount again")
  assert.ok(CODE.includes("director.quiet = holdLeft > 0"), "the hold no longer stops the market")
  assert.ok(CODE.includes("gateHoldSeconds("), "the gate's hold is a constant in the mount again")
  const down = CODE.slice(CODE.indexOf("function onDown"))
  assert.ok(
    down.slice(0, down.indexOf("\n  }")).includes("dismissReveal()"),
    "a stroke no longer takes the completed sum down — a fast player is held again",
  )
  const dismiss = CODE.slice(CODE.indexOf("function dismissReveal"))
  assert.ok(
    dismiss.slice(0, dismiss.indexOf("\n  }")).includes("holdLeft = 0"),
    "dismissing the sum no longer ends the hold",
  )
})

test("the escalation is evidence, and the mount is the only thing that moves it", () => {
  // Pacing-audit root cause 3. `heat` is gone from the director entirely, and
  // the mount drives `intensity` from the shared flow controller.
  assert.ok(!/\bheat\b/.test(DIR), "the director has a stopwatch in it again")
  assert.ok(!/this\.elapsed \*/.test(DIR) && !/exp\(-this\.elapsed/.test(DIR), "an elapsed-time curve is back")
  assert.ok(CODE.includes("observe(SECOND_GRADE_FLOW"), "outcomes stopped reaching the flow controller")
  assert.ok(CODE.includes("settle(SECOND_GRADE_FLOW"), "the world stopped following the controller")
  assert.equal(count("director.intensity = intensity"), 4, "the director's axis is set from somewhere new")
})

test("a fruit that falls uncut is never reported", () => {
  // The regression: `host.report` reappears on the retirement path, and a child
  // who let a numeral go past is marked wrong for it.
  assert.equal(count("host.report("), 2, "a new report call appeared in mount.ts")
  const record = CODE.slice(CODE.indexOf("function record("))
  const body = record.slice(0, record.indexOf("\n  }"))
  assert.ok(body.includes("reportsToCurriculum(verdict)"), "an order report is no longer guarded")
  assert.ok(
    body.includes('order.questionId !== ""'),
    "the mount reports against a question id the host never issued",
  )
})

test("the hard cap is checked before an object exists, not after a wave", () => {
  // §2.3's first failure, and the reason a ceiling of 21 produced a p90 of 25.
  assert.ok(!/floorCount/.test(DIR), "the density floor is back in the director")
  assert.ok(!/ceilingCount/.test(DIR), "the old per-wave ceiling is back")
  assert.ok(DIR.includes("const room = Math.max(0, cap - inFlight)"), "the cap is not computed per object")
  // …and the melon checks it before it is allowed to split.
  const melon = CODE.slice(CODE.indexOf("if (b.kind === B_MELON)"))
  assert.ok(
    melon.slice(0, 900).includes("director.hardCap() - liveCuttable()"),
    "a melon can split past the cap",
  )
})

test("the factor cascade is gone: cutting things is no longer how you get more things to cut", () => {
  assert.ok(!/chooseSplit/.test(CODE), "the automatic factor cascade is back")
  assert.ok(!/isPrime/.test(CODE), "the prime payoff is back, and it prices a cut again")
  assert.equal(count("spawnFrom("), 3, "something other than a melon manufactures objects")
})

test("a melon can never contain an overshoot — bad luck may not cost an order", () => {
  const fn = CODE.slice(CODE.indexOf("function melonContents"))
  const body = fn.slice(0, fn.indexOf("\n  }"))
  assert.ok(body.includes('order.classify(v) !== "overshoot"'), "a melon can now wreck an order by luck")
})

test("the blank is the curriculum's, and the mount does not invent one", () => {
  assert.ok(CODE.includes("BLANK"), "the mount stopped using the shared blank glyph")
  assert.ok(!/"\?"/.test(CODE.replace(/prompt/g, "")), "a bare question mark is being used as a blank")
  assert.ok(!/"___"/.test(CODE), "a triple underscore is being used as a blank")
})
