import { strict as assert } from "node:assert"
import { test } from "node:test"

import { MICRO } from "../core/bigmath.ts"
import { addHeat, globalMul, heatBonus, newEconomy } from "../core/economy.ts"

// The header prints `x{whole}.{frac}` from (100 + heatBonus)/100. If that ever
// stops being the number `globalMul` multiplies production by, the game is
// lying to a child about arithmetic — which is the one bug this project cannot
// ship. It has already happened once, when heat went from linear to sqrt and
// only the economy was updated.
function printedMultiplier(e: ReturnType<typeof newEconomy>): string {
  const n = 100n + heatBonus(e)
  return `${n / 100n}.${(n % 100n) / 10n}`
}

test("the printed heat multiplier is the applied heat multiplier", () => {
  for (const heat of [0, 1, 25, 100, 400, 2500, 10_000, 250_000]) {
    const e = newEconomy()
    if (heat > 0) addHeat(e, heat, 0)
    assert.equal(e.heat, BigInt(heat) * MICRO)

    // What the economy applies, with marks and carbon neutral.
    const g = globalMul(e)
    const appliedHundredths = (g.num * 100n) / g.den
    const printed = printedMultiplier(e)
    const [w, f] = printed.split(".")
    assert.equal(
      appliedHundredths / 10n,
      BigInt(w as string) * 10n + BigInt(f as string),
      `heat ${heat}: printed ${printed}, applied ${appliedHundredths}/100`,
    )
  }
})

test("heat is worth a square root, and the milestones are the round ones", () => {
  const e = newEconomy()
  addHeat(e, 100, 0)
  assert.equal(heatBonus(e), 100n) // x2.00
  e.heat = 0n
  addHeat(e, 2500, 0)
  assert.equal(heatBonus(e), 500n) // x6.00
  e.heat = 0n
  addHeat(e, 10_000, 0)
  assert.equal(heatBonus(e), 1000n) // x11.00
})
