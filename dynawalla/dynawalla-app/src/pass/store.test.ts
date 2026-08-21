// The seam, pinned.
//
// `model.ts` is pure, and `pass.test.ts` proves every rule in it by calling it
// with a literal `billingWired`. That is the right way to test a decision, and
// it is exactly why the *wiring* needs a file of its own: not one case over
// there ever calls `store.ts`, so not one of them can tell what `store.ts`
// actually threads.
//
// Two lines in `store.ts` decide which build a family is in, and they are the
// only two places in the running app where the capability flag reaches the
// model at all:
//
//     verdictFor({ …, billingWired: billing().wired })   // reachTransition
//     canOpen({ …, billingWired: billing().wired })      // mayOpen
//
// Pin the first to `true` and the TestFlight defect comes back whole — two
// installed games, one transition each, about five minutes, and then a sheet
// offering a store that cannot sell — while every case in `pass.test.ts` stays
// green. Replace the second with a hand-rolled resting rule and a ledger left
// behind by that build locks the stage on a device that has just been fixed.
//
// So everything below drives the **real store** against the **real billing
// singleton**. No fixture model, no second copy of the rule, nothing that could
// quietly agree with a mutation. `persist.ts` falls back to an in-memory Map
// when `localStorage` is absent, which is what lets the whole thing run under
// `node --test` with no DOM, no store account and no network.

import test from "node:test"
import assert from "node:assert/strict"

import { ephemeral } from "../app/persist.ts"
import { deviceKey } from "../app/profile.ts"
import { billing, grantingBilling, productFor, setBilling, unwiredBilling } from "./billing.ts"
import { dayKey, EMPTY_LEDGER, type RestLedger } from "./model.ts"
import { buyPass, isPassOpen, usePass } from "./store.ts"

/** Mid-afternoon, so a day boundary is never one rounding away. */
const NOON = new Date(2026, 6, 26, 14, 30, 0).getTime()
const TOMORROW = new Date(2026, 6, 27, 8, 0, 0).getTime()
const HOUR = 60 * 60 * 1000

const FUSE = "dynawalla.fuse"
const SIEGE = "dynawalla.siege"
const FORGE = "dynawalla.forge"

/** A tablet that has never bought anything and has nothing written on it. */
function freshDevice(): void {
  ephemeral.clear()
  usePass.setState({ pass: null, ledger: EMPTY_LEDGER })
}

/**
 * Put a record on the disk the way a *previous build* would have left it, then
 * make the real store read it back through its real `merge`.
 *
 * Constructed rather than written by this process on purpose: the durable
 * ledger outlives the build that wrote it, and the device this has to be right
 * on is one that ran the gating version yesterday and installs the fix today.
 */
async function rehydrateWith(ledger: RestLedger): Promise<void> {
  ephemeral.set(deviceKey("pass"), JSON.stringify({ state: { pass: null, ledger }, version: 1 }))
  await usePass.persist.rehydrate()
}

// ── The default build: nothing to sell, so nothing to gate ───────────────────

test("nothing is wired until something installs a store", () => {
  // The premise the next two cases rest on, asserted before anything in this
  // file has had a chance to call `setBilling`. A default that came up wired
  // would make them pass for the wrong reason.
  assert.equal(billing().wired, false, "the default billing claims it can take money")
  assert.equal(billing(), unwiredBilling)
})

test("the store threads the billing it has, so an unsellable build never rests a game", () => {
  // THE REGRESSION. `reachTransition` is the one line in the running app that
  // carries `billing().wired` into `verdictFor`, and this is the case that
  // fails when it stops carrying it: hard-code `billingWired: true` there and
  // the very first call below answers "rest" instead of "play-on".
  //
  // Driven through `usePass.getState()` — the same call the stage makes — so
  // the assertion is about the app's behaviour and not about a rule this file
  // re-derived.
  freshDevice()
  assert.equal(billing().wired, false)

  const packs = [FUSE, SIEGE, FORGE]

  // Forty stopping points across an afternoon and three games: many times what
  // the shipped build could reach before it stopped being an app.
  for (let index = 0; index < 40; index += 1) {
    const packId = packs[index % packs.length] ?? ""
    const now = NOON + index * 7 * 60_000

    assert.equal(
      usePass.getState().reachTransition(packId, now),
      "play-on",
      `${packId} rested at transition ${index}: store.ts is no longer threading billing().wired`,
    )
    assert.equal(
      usePass.getState().mayOpen(packId, now),
      true,
      `${packId} was refused at transition ${index} in a build that cannot sell a way back in`,
    )
  }

  // The durable consequence, and the one a family would still be carrying
  // tomorrow. `reachTransition` writes the ledger itself, so a single verdict
  // that slipped through is visible here even if the loop above were loosened.
  assert.deepEqual(
    usePass.getState().ledger,
    EMPTY_LEDGER,
    "a build with no store wrote a rest into durable storage",
  )
  // And nobody arrived at the offer, because nobody was ever stopped.
  assert.equal(isPassOpen(NOON), false, "an unwired build invented a pass nobody bought")
})

test("mayOpen delegates, so a ledger from a gating build cannot lock the stage", async () => {
  // THE SECOND REGRESSION. `mayOpen` must ask `canOpen` rather than answer
  // "is it resting?" itself. Swap it for that hand-rolled rule and this case
  // fails: the ledger below says both games are finished for today, the flag
  // says there is nothing to sell, and only `canOpen` knows the second beats
  // the first.
  freshDevice()
  assert.equal(billing().wired, false)

  const stale: RestLedger = { day: dayKey(NOON), resting: [FUSE, SIEGE] }
  await rehydrateWith(stale)

  // The ledger really did come back, so nothing below can pass vacuously.
  assert.deepEqual(usePass.getState().ledger, stale, "the stale ledger never reached the store")

  for (const packId of [FUSE, SIEGE]) {
    assert.equal(
      usePass.getState().mayOpen(packId, NOON),
      true,
      `${packId} stayed locked by yesterday's build: mayOpen is no longer delegating to canOpen`,
    )
    // …and reaching the stopping point again changes nothing.
    assert.equal(usePass.getState().reachTransition(packId, NOON + HOUR), "play-on")
  }
})

// ── The wired build: everything above must leave this untouched ──────────────

test("with a store wired, the real store still rests each game once a day", async (t) => {
  // The flag switches the day pass off. It must not change one thing about what
  // the day pass does when it is on, so the whole free-tier day is run again
  // here — through the store, not the model — against a billing that can sell.
  t.after(() => {
    setBilling(unwiredBilling)
    freshDevice()
  })

  freshDevice()
  setBilling(grantingBilling(() => NOON))
  assert.equal(billing().wired, true)

  // First stopping point in FUSE: it rests, and the sheet opens.
  assert.equal(usePass.getState().reachTransition(FUSE, NOON), "rest")
  assert.deepEqual(usePass.getState().ledger, { day: dayKey(NOON), resting: [FUSE] })

  // Once, and once only. A second transition in the same game is silence.
  assert.equal(usePass.getState().reachTransition(FUSE, NOON + HOUR), "play-on")
  assert.equal(usePass.getState().mayOpen(FUSE, NOON + HOUR), false)

  // …and only that game. The child goes and finds SIEGE, which is the point.
  assert.equal(usePass.getState().mayOpen(SIEGE, NOON), true)
  assert.equal(usePass.getState().reachTransition(SIEGE, NOON), "rest")
  assert.equal(usePass.getState().mayOpen(FORGE, NOON), true)

  // Tomorrow morning gives the day back, with nothing bought.
  assert.equal(usePass.getState().mayOpen(FUSE, TOMORROW), true)
  assert.equal(usePass.getState().mayOpen(SIEGE, TOMORROW), true)

  // And a purchase reopens today, which is the thing being sold. Bought through
  // the real `buyPass`, so the grant lands in the same durable state the stage
  // reads back.
  const outcome = await buyPass(productFor("lifetime").productId)
  assert.equal(outcome.status, "granted")
  assert.equal(isPassOpen(NOON + HOUR), true)
  for (const packId of [FUSE, SIEGE, FORGE]) {
    assert.equal(usePass.getState().mayOpen(packId, NOON + HOUR), true)
    assert.equal(usePass.getState().reachTransition(packId, NOON + HOUR), "play-on")
  }
})
