// The day pass, proved rather than described.
//
// Three things are held here and they are the three that would be expensive to
// get wrong on a family's tablet:
//
//   1. **A full day, simulated.** Play a game to its stopping point, see the
//      sheet, dismiss it, play a different game, confirm the first rests and
//      the second does not, buy a pass, confirm everything opens, and roll the
//      clock past midnight and confirm the free day comes back.
//   2. **Nobody who paid is ever blocked.** Including offline, including with a
//      renewal this app could not verify.
//   3. **There is no timer, and the copy contains no pressure.** Mechanically,
//      by reading the source and the strings, so "we would notice" is not the
//      control.
//   4. **A build with no store gates nothing.** The fourth because the first
//      three all quietly assumed a store existed, and the build that shipped to
//      TestFlight did not have one.

import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { strings } from "../app/strings.ts"
import {
  expiryFor,
  FALLBACK_PRODUCTS,
  grantingBilling,
  productFor,
  unwiredBilling,
} from "./billing.ts"
import {
  canOpen,
  dayKey,
  EMPTY_LEDGER,
  isResting,
  ledgerOn,
  markResting,
  passIsOpen,
  RENEWAL_GRACE_MS,
  verdictFor,
  type Pass,
  type RestLedger,
} from "./model.ts"

const here = path.dirname(fileURLToPath(import.meta.url))

/** A fixed instant, mid-afternoon, so a day boundary is never a rounding away. */
const NOON = new Date(2026, 6, 26, 14, 30, 0).getTime()
const HOUR = 60 * 60 * 1000

const lifetime: Pass = { kind: "lifetime", expiresAt: null, confirmedAt: NOON }
const dayPass: Pass = { kind: "day", expiresAt: NOON + 24 * HOUR, confirmedAt: NOON }
const monthPass: Pass = { kind: "month", expiresAt: NOON + 30 * 24 * HOUR, confirmedAt: NOON }

/**
 * The two builds every rule below has to be right in, spread into the input so
 * that which one a case is describing is readable at the call site.
 *
 * `withStore` is a build a parent can actually buy from, and it is the **only**
 * one in which the day pass gates anything at all: every case from here down to
 * the last section runs in it, because a rest that nobody can undo is not a
 * rule worth having. `noStore` is what ships until StoreKit and Play Billing
 * land, and the last section is entirely about it.
 */
const withStore = { billingWired: true } as const
const noStore = { billingWired: false } as const

// ── Every game is free, and the gate is a place, not a clock ─────────────────

test("on a cold device with nothing bought, every game opens", () => {
  // The single most important property of the model. Discovery is unlimited:
  // a child can try all of them, which is how they find the one they love.
  for (const packId of ["dynawalla.fuse", "dynawalla.siege", "dynawalla.forge"]) {
    assert.equal(
      canOpen({ packId, pass: null, ledger: EMPTY_LEDGER, now: NOON, ...withStore }),
      true,
      `${packId} was refused on a cold device`,
    )
  }
})

test("the first stopping point rests that game and only that game", () => {
  let ledger: RestLedger = EMPTY_LEDGER

  const first = verdictFor({ packId: "dynawalla.fuse", pass: null, ledger, now: NOON, ...withStore })
  assert.equal(first, "rest")
  ledger = markResting(ledger, "dynawalla.fuse", dayKey(NOON))

  // FUSE is finished for today…
  assert.equal(canOpen({ packId: "dynawalla.fuse", pass: null, ledger, now: NOON, ...withStore }), false)
  // …and SIEGE has not been touched. This is the whole point of one gate per
  // game per day: a child who runs out of one goes and finds another.
  assert.equal(canOpen({ packId: "dynawalla.siege", pass: null, ledger, now: NOON, ...withStore }), true)
})

test("a second stopping point in a rested game shows nothing", () => {
  // Reachable only if a pack is mounted anyway. The answer to being asked
  // twice is silence, never a second sheet.
  const ledger = markResting(EMPTY_LEDGER, "dynawalla.fuse", dayKey(NOON))
  const input = { packId: "dynawalla.fuse", pass: null, ledger, now: NOON, ...withStore }
  assert.equal(verdictFor(input), "play-on")
})

test("midnight gives the day back", () => {
  const ledger = markResting(EMPTY_LEDGER, "dynawalla.fuse", dayKey(NOON))
  const tomorrow = new Date(2026, 6, 27, 8, 0, 0).getTime()

  assert.notEqual(dayKey(NOON), dayKey(tomorrow))
  assert.equal(canOpen({ packId: "dynawalla.fuse", pass: null, ledger, now: tomorrow, ...withStore }), true)
  // And the record is thrown away rather than accumulated — nothing here grows
  // without bound and no history of a child's play is kept.
  assert.deepEqual(ledgerOn(ledger, dayKey(tomorrow)), { day: dayKey(tomorrow), resting: [] })
})

test("the day boundary is local midnight, not UTC", () => {
  // A UTC boundary puts "tomorrow" at 4pm for a family in California. The key
  // is built from the device's own calendar fields, so 23:59 and 00:01 on the
  // same night are two different days wherever the tablet is.
  const lateTonight = new Date(2026, 6, 26, 23, 59, 0).getTime()
  const justAfter = new Date(2026, 6, 27, 0, 1, 0).getTime()
  assert.equal(dayKey(lateTonight), "2026-07-26")
  assert.equal(dayKey(justAfter), "2026-07-27")
})

test("marking is idempotent and keeps the list sorted and unique", () => {
  const day = dayKey(NOON)
  let ledger = markResting(EMPTY_LEDGER, "dynawalla.siege", day)
  ledger = markResting(ledger, "dynawalla.fuse", day)
  ledger = markResting(ledger, "dynawalla.fuse", day)
  assert.deepEqual(ledger.resting, ["dynawalla.fuse", "dynawalla.siege"])
})

// ── Nobody who paid is blocked ───────────────────────────────────────────────

test("a pass opens every game, including ones that already rested", () => {
  const ledger = markResting(EMPTY_LEDGER, "dynawalla.fuse", dayKey(NOON))
  for (const pass of [dayPass, monthPass, lifetime]) {
    assert.equal(
      canOpen({ packId: "dynawalla.fuse", pass, ledger, now: NOON, ...withStore }),
      true,
      `${pass.kind} did not reopen a rested game`,
    )
    // And nothing is ever shown to them again.
    assert.equal(
      verdictFor({ packId: "dynawalla.siege", pass, ledger, now: NOON, ...withStore }),
      "play-on",
    )
  }
})

test("a lifetime pass never expires, at any distance from the purchase", () => {
  const tenYears = NOON + 10 * 365 * 24 * HOUR
  assert.equal(passIsOpen(lifetime, tenYears), true)
})

test("a month pass survives a renewal this app could not verify", () => {
  // The failure being prevented: a family on a plane, a renewal that happened
  // at the store, and an app that decides on its own that they stopped paying.
  const justPast = (monthPass.expiresAt ?? 0) + HOUR
  assert.equal(passIsOpen(monthPass, justPast), true)
  assert.equal(passIsOpen(monthPass, (monthPass.expiresAt ?? 0) + RENEWAL_GRACE_MS - 1), true)
  // Past the grace it does close — an indefinite grace is a free subscription.
  assert.equal(passIsOpen(monthPass, (monthPass.expiresAt ?? 0) + RENEWAL_GRACE_MS + 1), false)
})

test("a day pass gets no grace, because none is needed", () => {
  // Its expiry needs no round trip. Extending it would make it a three-day pass.
  assert.equal(passIsOpen(dayPass, (dayPass.expiresAt ?? 0) - 1), true)
  assert.equal(passIsOpen(dayPass, (dayPass.expiresAt ?? 0) + 1), false)
})

test("no pass at all is not an error, it is the free tier", () => {
  assert.equal(passIsOpen(null, NOON), false)
  assert.equal(passIsOpen(undefined, NOON), false)
})

// ── A whole day, end to end ──────────────────────────────────────────────────

test("a full day: play, rest, switch games, buy, and wake up tomorrow", async () => {
  // The scenario in the brief, run against the same functions the app runs.
  let ledger: RestLedger = EMPTY_LEDGER
  let pass: Pass | null = null
  const play = (packId: string, now: number) => {
    const verdict = verdictFor({ packId, pass, ledger, now, ...withStore })
    if (verdict === "rest") ledger = markResting(ledger, packId, dayKey(now))
    return verdict
  }

  // 09:00 — FUSE. Two levels cleared; the first one is the stopping point and
  // the second one is silence.
  const nine = new Date(2026, 6, 26, 9, 0, 0).getTime()
  assert.equal(canOpen({ packId: "dynawalla.fuse", pass, ledger, now: nine, ...withStore }), true)
  assert.equal(play("dynawalla.fuse", nine), "rest")
  assert.equal(play("dynawalla.fuse", nine + 60_000), "play-on")

  // 09:05 — dismissed the sheet, went to SIEGE. Still open, still free.
  const nineFive = nine + 5 * 60_000
  assert.equal(canOpen({ packId: "dynawalla.fuse", pass, ledger, now: nineFive, ...withStore }), false)
  assert.equal(canOpen({ packId: "dynawalla.siege", pass, ledger, now: nineFive, ...withStore }), true)
  assert.equal(play("dynawalla.siege", nineFive), "rest")

  // 09:30 — a parent passes the gate and buys the lifetime pass. Everything
  // opens, including the two games that were resting a moment ago.
  const outcome = await grantingBilling(() => nine + 30 * 60_000).buy(
    productFor("lifetime").productId,
  )
  assert.equal(outcome.status, "granted")
  if (outcome.status !== "granted") return
  pass = outcome.pass
  const half = nine + 31 * 60_000
  for (const packId of ["dynawalla.fuse", "dynawalla.siege", "dynawalla.forge"]) {
    assert.equal(canOpen({ packId, pass, ledger, now: half, ...withStore }), true)
    assert.equal(verdictFor({ packId, pass, ledger, now: half, ...withStore }), "play-on")
  }

  // …and had they not bought anything, tomorrow morning gives both back.
  const tomorrow = new Date(2026, 6, 27, 9, 0, 0).getTime()
  assert.equal(canOpen({ packId: "dynawalla.fuse", pass: null, ledger, now: tomorrow, ...withStore }), true)
  assert.equal(canOpen({ packId: "dynawalla.siege", pass: null, ledger, now: tomorrow, ...withStore }), true)
})

// ── The catalogue ────────────────────────────────────────────────────────────

test("three passes, at the founder's prices, and no fourth", () => {
  assert.deepEqual(
    FALLBACK_PRODUCTS.map((product) => [product.kind, product.price]),
    [
      ["day", "$0.99"],
      ["month", "$7.99"],
      ["lifetime", "$79.99"],
    ],
  )
})

test("a lifetime purchase carries no expiry at all", () => {
  assert.equal(expiryFor("lifetime", NOON), null)
  assert.equal(expiryFor("day", NOON), NOON + 24 * HOUR)
})

test("product ids are distinct and namespaced to this app", () => {
  const ids = FALLBACK_PRODUCTS.map((product) => product.productId)
  assert.equal(new Set(ids).size, ids.length)
  for (const id of ids) assert.ok(id.startsWith("inc.corpora.dynawalla."), id)
})

// ── No timer, and no pressure ────────────────────────────────────────────────

const source = (file: string): string => fs.readFileSync(path.join(here, file), "utf8")

test("there is no timer anywhere in the day pass", () => {
  // The mechanism this model replaces. A countdown, an interval, an elapsed
  // reading of the wall clock during play — none of them may reappear here by
  // somebody solving a problem the quick way.
  for (const file of ["PassSheet.tsx", "model.ts", "store.ts", "billing.ts"]) {
    const text = source(file)
    for (const banned of ["setInterval", "requestAnimationFrame", "performance.now"]) {
      assert.ok(!text.includes(banned), `${file} uses ${banned}`)
    }
  }
  // `setTimeout` is a delay and a delay before a control becomes usable is the
  // un-dismissable interstitial, which is banned outright.
  assert.ok(!source("PassSheet.tsx").includes("setTimeout"), "the sheet delays something")
})

test("the copy carries no pressure of any kind", () => {
  const copy = Object.values(strings.pass).join(" ").toLowerCase()
  const banned = [
    "hurry",
    "only today",
    "last chance",
    "limited",
    "expires",
    "running out",
    "left today",
    "friends",
    "everyone",
    "don't miss",
    "unlock",
    "locked",
    "premium",
    "upgrade",
    "free trial",
    "minutes",
    "seconds",
    "timer",
  ]
  for (const phrase of banned) {
    assert.ok(!copy.includes(phrase), `the pass copy says "${phrase}"`)
  }
})

test("the child-facing copy contains no money", () => {
  // A child at a stopping point sees these four strings and nothing else. No
  // price, no offer, no reason to go and find an adult.
  const childFacing = [
    strings.pass.restTitle,
    strings.pass.restBody,
    strings.pass.restLeave,
    strings.pass.forGrownUps,
  ].join(" ")
  assert.ok(!/[$£€]|\d/.test(childFacing), `a price reached the child: ${childFacing}`)
  assert.ok(!/pass|buy|pay/i.test(childFacing), `the child was sold something: ${childFacing}`)
})

test("the way out is always one control", () => {
  // Every stage of the sheet has a plain, labelled, always-visible dismissal.
  assert.ok(strings.pass.restLeave.length > 0)
  assert.ok(strings.pass.notNow.length > 0)
  const sheet = source("PassSheet.tsx")
  // Escape closes it from every stage, so there is no stage a person is stuck in.
  assert.ok(sheet.includes('event.key === "Escape"'), "Escape does not close the sheet")
})

test("no price is rendered until the parental gate has been passed", () => {
  // Structural, not a habit: the sheet only ever reaches its `Offer` stage
  // through `Gate`'s success callback, and `Offer` is the only thing that
  // renders a `price`.
  const sheet = source("PassSheet.tsx")
  assert.ok(sheet.includes('onPassed={() => setStage("offer")}'), "the gate does not lead to the offer")
  assert.ok(
    !/setStage\("offer"\)/.test(sheet.replace('onPassed={() => setStage("offer")}', "")),
    "something other than the parental gate opens the offer",
  )
})

test("the ledger is device-scoped, which closes the profile-switch hole", () => {
  // A per-learner ledger would make "add a learner" into an extra play, and a
  // child would find that in an afternoon. The store's key says so.
  const text = source("store.ts")
  assert.ok(text.includes('deviceKey("pass")'), "the pass is not device-scoped")
  assert.ok(!text.includes("storageKey("), "the pass is namespaced per learner")
})

test("only a definitive not_owned clears a pass", () => {
  const text = source("store.ts")
  assert.ok(text.includes('outcome.status === "not_owned"'), "no definitive-downgrade branch")
  // An unavailable store is logged and changes nothing.
  const unavailable = text.slice(text.indexOf('outcome.status === "unavailable"'))
  assert.ok(!unavailable.includes("forget()"), "an unreachable store downgrades a paying family")
})

test("no ledger entry is written when a pass is open", () => {
  // Otherwise a family who let a month pass lapse would come back to a device
  // where every game was already resting.
  const ledger = markResting(EMPTY_LEDGER, "dynawalla.fuse", dayKey(NOON))
  assert.equal(
    verdictFor({ packId: "dynawalla.siege", pass: lifetime, ledger, now: NOON, ...withStore }),
    "play-on",
  )
  assert.equal(isResting(ledger, "dynawalla.siege", dayKey(NOON)), false)
})

// ── The build with no store ──────────────────────────────────────────────────
//
// What went to TestFlight, and what it did there. `unwiredBilling` answers
// `unavailable` to `buy` and to `restore`, so the first stopping point in each
// installed game rested it, `canOpen` said no for the rest of the day, and the
// sheet's one offer led to a store that did not exist. With two games installed
// that is roughly five minutes, and then the app is a dead end no parent can
// buy their way out of.
//
// Every case above this line assumes a store. These are the ones that hold the
// rule when there is not one: **a game is never refused for want of a purchase
// that cannot be made.**

test("the shipping billing admits it cannot sell, and the developer grant admits it can", () => {
  // The entire fix hangs off this one flag, so it is asserted rather than read.
  assert.equal(unwiredBilling.wired, false)
  assert.equal(grantingBilling().wired, true)
})

test("with no store wired, no game ever rests, however long a child plays", () => {
  let ledger: RestLedger = EMPTY_LEDGER
  const packs = ["dynawalla.fuse", "dynawalla.siege", "dynawalla.forge"]

  // Forty stopping points across an afternoon and three games — many times what
  // the shipped build could reach before it stopped being an app.
  for (let index = 0; index < 40; index += 1) {
    const packId = packs[index % packs.length] ?? ""
    const now = NOON + index * 7 * 60_000

    const verdict = verdictFor({ packId, pass: null, ledger, now, ...noStore })
    // Exactly what the store does with a verdict, and done before the assertion
    // rather than instead of it: a regression fills the ledger, and the check
    // after the loop is what catches the day one slips through.
    if (verdict === "rest") ledger = markResting(ledger, packId, dayKey(now))

    assert.equal(verdict, "play-on", `${packId} rested at transition ${index} with nothing to sell`)
    assert.equal(
      canOpen({ packId, pass: null, ledger, now, ...noStore }),
      true,
      `${packId} was refused at transition ${index} with nothing to sell`,
    )
  }

  assert.deepEqual(ledger, EMPTY_LEDGER, "a build with no store wrote a rest into the ledger")
})

test("a ledger left behind by a gating build does not lock anybody out", () => {
  // Why `canOpen` reads the flag rather than trusting that `verdictFor` never
  // wrote anything: the ledger is durable and it outlives the build that wrote
  // it. A family who hit the dead end yesterday installs the fix today and
  // would otherwise open it to find every game already finished.
  let ledger: RestLedger = EMPTY_LEDGER
  for (const packId of ["dynawalla.fuse", "dynawalla.siege"]) {
    ledger = markResting(ledger, packId, dayKey(NOON))
    assert.equal(canOpen({ packId, pass: null, ledger, now: NOON, ...withStore }), false)
    assert.equal(canOpen({ packId, pass: null, ledger, now: NOON, ...noStore }), true)
  }
})

test("wiring a store back on gives back the day pass exactly as it was", () => {
  // The flag switches the model off. It must not change a thing about what the
  // model does when it is on, so the free-tier day is run again here, in full,
  // against the wired build.
  let ledger: RestLedger = EMPTY_LEDGER

  const fuse = (now: number) => ({ packId: "dynawalla.fuse", pass: null, ledger, now, ...withStore })
  assert.equal(verdictFor(fuse(NOON)), "rest")
  ledger = markResting(ledger, "dynawalla.fuse", dayKey(NOON))

  // Rested once, and once only: a second transition in the same game is silence.
  assert.equal(verdictFor(fuse(NOON + HOUR)), "play-on")
  assert.equal(canOpen(fuse(NOON + HOUR)), false)
  // …and only that game. SIEGE is untouched.
  assert.equal(canOpen({ packId: "dynawalla.siege", pass: null, ledger, now: NOON, ...withStore }), true)
  // Tomorrow gives it back.
  assert.equal(canOpen(fuse(new Date(2026, 6, 27, 8, 0, 0).getTime())), true)
  // And a pass reopens it today, which is the thing being sold.
  assert.equal(
    canOpen({ packId: "dynawalla.fuse", pass: lifetime, ledger, now: NOON + HOUR, ...withStore }),
    true,
  )
})

test("the sheet is only ever opened by the model's two answers", () => {
  // The child-facing consequence, and why changing two decisions is enough: the
  // stage is the only thing in the app that mounts `PassSheet`, and both of its
  // mounts are gated on `model.ts`. With nothing to sell both answers open, so
  // the sheet is never drawn at all — nobody is offered a store that is not
  // there, because nobody arrives at the offer.
  const stage = fs.readFileSync(path.join(here, "..", "packs", "Stage.tsx"), "utf8")
  const mounts = stage.match(/<PassSheet\b/g) ?? []
  assert.equal(mounts.length, 2, "the sheet gained a mount that the model does not gate")
  assert.ok(
    stage.includes('if (reachTransition(packId) === "rest") setOffering(true)'),
    "the transition mount no longer asks the model",
  )
  assert.ok(
    stage.includes("useState(() => !usePass.getState().mayOpen(packId))"),
    "the reopen mount no longer asks the model",
  )
})

test("the library rows go quiet too when there is nothing to sell", () => {
  // The row's word and the stage's decision are one question with one answer,
  // and the flag has to reach both or a row says "resting" about a game that
  // opens when a child presses it.
  const host = fs.readFileSync(path.join(here, "..", "shell", "useHost.ts"), "utf8")
  assert.ok(
    host.includes("!billing().wired"),
    "a row can still call a game resting that the stage will open",
  )
})
