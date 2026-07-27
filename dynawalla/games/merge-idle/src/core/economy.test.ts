import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import {
  assayPayout,
  baseStepFor,
  bloomLevel,
  difficultyForStep,
  emitValueFor,
  eruptionYield,
  flowAfter,
  growCost,
  offlineHaul,
  OFFLINE_CAP_MS,
  OFFLINE_MIN_MS,
  purgeCost,
  reefTrickle,
  targetStepFor,
  tideMultiplier,
  upwellCost,
  ventCost,
  ventPeriodMs,
  ventRate,
} from './economy.ts'
import { onLadder, decompose } from './ladder.ts'

test('vent rate climbs with tier and never stalls at the bottom', () => {
  assert.ok(ventRate(1) >= 1)
  for (let t = 1; t < 14; t++) assert.ok(ventRate(t + 1) > ventRate(t), `tier ${t}`)
})

test('vent period shortens with tier but floors, so a deep vent never machine-guns', () => {
  for (let t = 1; t < 30; t++) assert.ok(ventPeriodMs(t + 1) <= ventPeriodMs(t))
  assert.ok(ventPeriodMs(99) >= 1100, 'there must be a floor')
})

test('eruption yield grows but is capped, so a full shelf is never buried', () => {
  assert.ok(eruptionYield(1) >= 2)
  assert.ok(eruptionYield(40) <= 9)
})

test('flow rewards a run and caps — it can never become the whole score', () => {
  assert.equal(flowAfter(0), 1)
  assert.ok(flowAfter(3) > flowAfter(1))
  assert.equal(flowAfter(1000), 6)
})

test('payout is a positive integer and scales with the polyp you spent', () => {
  const a = assayPayout(48, 3, 1)
  const b = assayPayout(96, 3, 1)
  assert.ok(Number.isInteger(a) && a > 0)
  assert.ok(b > a, 'a bigger polyp must be worth more')
  assert.ok(assayPayout(48, 3, 2) > a, 'flow must matter')
})

test('offline haul is capped at eight hours and ignored below the minimum', () => {
  assert.equal(offlineHaul(10, OFFLINE_MIN_MS - 1), 0)
  const oneHour = offlineHaul(10, 60 * 60 * 1000)
  const capped = offlineHaul(10, OFFLINE_CAP_MS)
  const beyond = offlineHaul(10, OFFLINE_CAP_MS * 20)
  assert.ok(oneHour > 0)
  assert.equal(capped, beyond, 'past the cap the haul must stop growing')
  assert.ok(Number.isInteger(capped))
})

test('offline is worth less than the same time played — a gift, not a strategy', () => {
  const away = offlineHaul(10, 60 * 60 * 1000)
  const played = 10 * 60 * 60
  assert.ok(away < played, `${away} must be under ${played}`)
})

test('the tide gate never drops below a full claim, however many tries it takes', () => {
  assert.equal(tideMultiplier(0), 3)
  assert.equal(tideMultiplier(1), 2)
  assert.equal(tideMultiplier(2), 1)
  assert.equal(tideMultiplier(50), 1)
})

test('costs climb by roughly an order of magnitude each time', () => {
  assert.equal(ventCost(1), 0, 'the first vent is free')
  for (let n = 2; n < 6; n++) assert.ok(ventCost(n + 1) > ventCost(n) * 5)
  for (let n = 1; n < 5; n++) assert.ok(growCost(n + 1) > growCost(n) * 5)
  for (let n = 0; n < 8; n++) assert.ok(upwellCost(n + 1) > upwellCost(n))
})

test('dissolving is free — the escape hatch is never gated on wealth', () => {
  assert.equal(purgeCost(), 0)
})

test('reef trickle rewards holding a shelf but sub-linearly', () => {
  assert.equal(reefTrickle(0), 0)
  assert.ok(reefTrickle(400) > reefTrickle(100))
  assert.ok(reefTrickle(400) < reefTrickle(100) * 4, 'must not run away')
})

test('base rung and bloom climb with magnitude and stay in range', () => {
  let prev = -1
  for (let m = 0; m < 20; m++) {
    const s = baseStepFor(m)
    assert.ok(s >= 0 && s <= 9)
    assert.ok(s >= prev, 'the base rung must never drop')
    prev = s
    const b = bloomLevel(m)
    assert.ok(b >= 0 && b <= 1)
  }
})

test('difficulty stays inside the contract band for every rung', () => {
  for (let step = -3; step < 40; step++) {
    const d = difficultyForStep(step)
    assert.ok(d >= 1 && d <= 10, `step ${step} -> ${d}`)
    assert.ok(Number.isInteger(d))
  }
})

test('what a vent emits is always on the ladder and always below what it asks for', () => {
  for (let strain = 0; strain < 4; strain++) {
    for (let base = 0; base < 8; base++) {
      for (let tier = 1; tier < 12; tier++) {
        const target = targetStepFor(base, tier)
        const v = emitValueFor(strain as 0 | 1 | 2 | 3, target)
        assert.ok(onLadder(v), `${v} must be a polyp value`)
        const id = decompose(v)
        assert.ok(id)
        assert.equal(id.strain, strain, 'the vent must seed its own ladder')
        assert.ok(id.step <= target, 'you must be able to merge up to the answer')
      }
    }
  }
})

test('target rung rises with the base rung and with vent tier', () => {
  assert.ok(targetStepFor(2, 1) > targetStepFor(0, 1))
  assert.ok(targetStepFor(0, 9) > targetStepFor(0, 1))
})
