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

import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { strings } from "../app/strings.ts"
import { expiryFor, FALLBACK_PRODUCTS, grantingBilling, productFor } from "./billing.ts"
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

// ── Every game is free, and the gate is a place, not a clock ─────────────────

test("on a cold device with nothing bought, every game opens", () => {
  // The single most important property of the model. Discovery is unlimited:
  // a child can try all of them, which is how they find the one they love.
  for (const packId of ["dynawalla.fuse", "dynawalla.siege", "dynawalla.forge"]) {
    assert.equal(
      canOpen({ packId, pass: null, ledger: EMPTY_LEDGER, now: NOON }),
      true,
      `${packId} was refused on a cold device`,
    )
  }
})

test("the first stopping point rests that game and only that game", () => {
  let ledger: RestLedger = EMPTY_LEDGER

  const first = verdictFor({ packId: "dynawalla.fuse", pass: null, ledger, now: NOON })
  assert.equal(first, "rest")
  ledger = markResting(ledger, "dynawalla.fuse", dayKey(NOON))

  // FUSE is finished for today…
  assert.equal(canOpen({ packId: "dynawalla.fuse", pass: null, ledger, now: NOON }), false)
  // …and SIEGE has not been touched. This is the whole point of one gate per
  // game per day: a child who runs out of one goes and finds another.
  assert.equal(canOpen({ packId: "dynawalla.siege", pass: null, ledger, now: NOON }), true)
})

test("a second stopping point in a rested game shows nothing", () => {
  // Reachable only if a pack is mounted anyway. The answer to being asked
  // twice is silence, never a second sheet.
  const ledger = markResting(EMPTY_LEDGER, "dynawalla.fuse", dayKey(NOON))
  assert.equal(verdictFor({ packId: "dynawalla.fuse", pass: null, ledger, now: NOON }), "play-on")
})

test("midnight gives the day back", () => {
  const ledger = markResting(EMPTY_LEDGER, "dynawalla.fuse", dayKey(NOON))
  const tomorrow = new Date(2026, 6, 27, 8, 0, 0).getTime()

  assert.notEqual(dayKey(NOON), dayKey(tomorrow))
  assert.equal(canOpen({ packId: "dynawalla.fuse", pass: null, ledger, now: tomorrow }), true)
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
      canOpen({ packId: "dynawalla.fuse", pass, ledger, now: NOON }),
      true,
      `${pass.kind} did not reopen a rested game`,
    )
    // And nothing is ever shown to them again.
    assert.equal(verdictFor({ packId: "dynawalla.siege", pass, ledger, now: NOON }), "play-on")
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
    const verdict = verdictFor({ packId, pass, ledger, now })
    if (verdict === "rest") ledger = markResting(ledger, packId, dayKey(now))
    return verdict
  }

  // 09:00 — FUSE. Two levels cleared; the first one is the stopping point and
  // the second one is silence.
  const nine = new Date(2026, 6, 26, 9, 0, 0).getTime()
  assert.equal(canOpen({ packId: "dynawalla.fuse", pass, ledger, now: nine }), true)
  assert.equal(play("dynawalla.fuse", nine), "rest")
  assert.equal(play("dynawalla.fuse", nine + 60_000), "play-on")

  // 09:05 — dismissed the sheet, went to SIEGE. Still open, still free.
  const nineFive = nine + 5 * 60_000
  assert.equal(canOpen({ packId: "dynawalla.fuse", pass, ledger, now: nineFive }), false)
  assert.equal(canOpen({ packId: "dynawalla.siege", pass, ledger, now: nineFive }), true)
  assert.equal(play("dynawalla.siege", nineFive), "rest")

  // 09:30 — a parent passes the gate and buys the lifetime pass. Everything
  // opens, including the two games that were resting a moment ago.
  const outcome = await grantingBilling(() => nine + 30 * 60_000).buy(
    productFor("lifetime").productId,
  )
  assert.equal(outcome.status, "granted")
  if (outcome.status !== "granted") return
  pass = outcome.pass
  for (const packId of ["dynawalla.fuse", "dynawalla.siege", "dynawalla.forge"]) {
    assert.equal(canOpen({ packId, pass, ledger, now: nine + 31 * 60_000 }), true)
    assert.equal(verdictFor({ packId, pass, ledger, now: nine + 31 * 60_000 }), "play-on")
  }

  // …and had they not bought anything, tomorrow morning gives both back.
  const tomorrow = new Date(2026, 6, 27, 9, 0, 0).getTime()
  assert.equal(canOpen({ packId: "dynawalla.fuse", pass: null, ledger, now: tomorrow }), true)
  assert.equal(canOpen({ packId: "dynawalla.siege", pass: null, ledger, now: tomorrow }), true)
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
  assert.equal(verdictFor({ packId: "dynawalla.siege", pass: lifetime, ledger, now: NOON }), "play-on")
  assert.equal(isResting(ledger, "dynawalla.siege", dayKey(NOON)), false)
})
