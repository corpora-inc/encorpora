// WHAT A CARD CAN SAY, AT MOST.
//
// `ui/cards.ts` cuts the lettering on a card so that the longest thing the card
// can be handed still fits on the lines it budgeted for it. That is only a
// guarantee if the budgets are a measurement of this file rather than a guess
// about it, so this deals thousands of real cards — every weapon, every
// passive, a build deep enough that the numbers have four digits — and reads
// the longest string out of them.
//
// If a new upgrade arrives with a longer name or a wordier offer, this fails
// with the string and the budget, and `CHARS` in `ui/cards.ts` is the thing to
// change. It is not decoration: `SEALED CACHE`, the longest of them, is what
// sets the headline size on a phone.

import assert from "node:assert/strict"
import { test } from "node:test"

import { CHARS } from "../ui/cards.ts"
import {
  CARD_TITLES, LONGEST_TITLE, MAX_WEAPONS, WEAPON_BLURB,
  makeBuild, makeWeapon, rollCards, type WeaponKey,
} from "./loadout.ts"

/** mulberry32, the generator the game itself runs on. */
function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const KEYS: WeaponKey[] = ["splinter", "halo", "arc", "pulse", "swarm", "lance", "spore"]

/**
 * Every card a long run can produce: fresh builds, loaded builds, and builds
 * whose numbers have run away — a two-hour run with every damage card taken.
 */
function everyCard() {
  const out = []
  for (let seed = 0; seed < 400; seed++) {
    for (const minutes of [0, 1, 2, 3, 6, 12, 40]) {
      const build = makeBuild()
      // Load it up: a late run has the maximum weapons at high levels and a
      // stat block that has been multiplied for half an hour.
      for (const key of KEYS.slice(0, MAX_WEAPONS)) {
        if (!build.has(key)) build.weapons.push(makeWeapon(key))
      }
      for (const w of build.weapons) {
        w.count = 24
        w.dmg = 480
        w.radius = 430
        w.cdMs = 90
      }
      build.stats.dmgPct = 900
      build.stats.ratePct = 400
      build.stats.areaPct = 500
      build.stats.maxHp = 940
      build.stats.hp = 3
      build.stats.speed = 941
      build.stats.magnet = 1078
      build.stats.critPct = 95
      build.stats.regenPer10s = 44
      build.stats.armor = 22
      build.stats.xpPct = 975
      out.push(...rollCards(build, rng(seed * 7919 + minutes), 4, minutes))
      // …and a first-level build, where the new-weapon blurbs live.
      out.push(...rollCards(makeBuild(), rng(seed), 3, minutes))
    }
  }
  return out
}

const CARDS = everyCard()

test("thousands of real cards, and every headline is in CARD_TITLES", () => {
  assert.ok(CARDS.length > 5000, `only ${CARDS.length} cards were dealt`)
  const seen = new Set(CARDS.map((c) => c.title))
  for (const title of seen) {
    assert.ok(
      CARD_TITLES.includes(title),
      `"${title}" is dealt by the game and is not in CARD_TITLES, so ui/cards.ts has never ` +
        `sized a card for it`,
    )
  }
  // The other direction: the list is not padded with names that do not exist.
  // SEALED CACHE is the overlay's own and never comes out of `rollCards`.
  for (const title of CARD_TITLES) {
    if (title === "SEALED CACHE") continue
    assert.ok(seen.has(title), `CARD_TITLES lists "${title}", which no card ever carries`)
  }
})

test("no headline is longer than the budget the card is cut for", () => {
  for (const c of CARDS) {
    assert.ok(
      c.title.length <= CHARS.title,
      `"${c.title}" is ${c.title.length} characters and cards.ts budgets ${CHARS.title}`,
    )
  }
  assert.equal(LONGEST_TITLE, CHARS.title)
})

test("no offer line is longer than the budget", () => {
  let worst = ""
  for (const c of CARDS) if (c.tag.length > worst.length) worst = c.tag
  assert.ok(
    worst.length <= CHARS.tag,
    `"${worst}" is ${worst.length} characters and cards.ts budgets ${CHARS.tag} for the offer`,
  )
})

test("no line of arithmetic is longer than the budget", () => {
  // `before → after`, which for a new weapon is a sentence: "a ring that shoves
  // the swarm off you → 1 × 14 = 14".
  let worst = ""
  for (const c of CARDS) {
    const line = `${c.before} → ${c.after}`
    if (line.length > worst.length) worst = line
  }
  assert.ok(
    worst.length <= CHARS.math,
    `"${worst}" is ${worst.length} characters and cards.ts budgets ${CHARS.math} — the card ` +
      `will wrap onto a line nothing reserved height for`,
  )
})

test("the wordiest thing on any card is a weapon's own description", () => {
  // Named here so that adding a longer blurb fails loudly rather than quietly
  // pushing a card past its budget.
  const longest = Object.values(WEAPON_BLURB).reduce((a, b) => (b.length > a.length ? b : a))
  assert.equal(longest, "a ring that shoves the swarm off you")
  assert.ok(longest.length + 3 + 13 <= CHARS.math)
})
