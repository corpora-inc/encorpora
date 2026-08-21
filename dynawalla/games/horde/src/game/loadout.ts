/**
 * The build. Every number a card shows is an integer the simulation actually
 * uses — there is no display value and no hidden value, so a child who reads
 * `5 × 14 = 70` and picks it gets exactly seventy.
 *
 * This is the ambient arithmetic layer. It is not a quiz: it is the ordinary
 * business of choosing an upgrade, made honest. Choosing well *is* comparing
 * products, and choosing badly costs you the next thirty seconds.
 */

export type WeaponKey = "splinter" | "halo" | "arc" | "pulse" | "swarm" | "lance" | "spore"

export type Weapon = {
  key: WeaponKey
  name: string
  /** shards / blades / chain links / motes / pods / beams */
  count: number
  dmg: number
  cdMs: number
  radius: number
  pierce: number
  /** runtime */
  t: number
  phase: number
  level: number
}

export type Stats = {
  maxHp: number
  hp: number
  speed: number
  magnet: number
  dmgPct: number
  ratePct: number
  areaPct: number
  critPct: number
  critMul: number
  regenPer10s: number
  xpPct: number
  armor: number
}

const BASE: Record<WeaponKey, Omit<Weapon, "t" | "phase" | "level">> = {
  splinter: { key: "splinter", name: "SPLINTER", count: 1, dmg: 6, cdMs: 620, radius: 0, pierce: 1 },
  halo: { key: "halo", name: "HALO", count: 2, dmg: 5, cdMs: 340, radius: 82, pierce: 99 },
  arc: { key: "arc", name: "ARC", count: 2, dmg: 9, cdMs: 1050, radius: 300, pierce: 1 },
  pulse: { key: "pulse", name: "PULSE", count: 1, dmg: 14, cdMs: 2200, radius: 130, pierce: 99 },
  swarm: { key: "swarm", name: "SWARM", count: 2, dmg: 5, cdMs: 850, radius: 0, pierce: 1 },
  lance: { key: "lance", name: "LANCE", count: 1, dmg: 4, cdMs: 90, radius: 430, pierce: 99 },
  spore: { key: "spore", name: "SPORE", count: 1, dmg: 22, cdMs: 1900, radius: 74, pierce: 99 },
}

export const WEAPON_BLURB: Record<WeaponKey, string> = {
  splinter: "shards at the nearest thing",
  halo: "blades that orbit you",
  arc: "lightning that jumps",
  pulse: "a ring that shoves the swarm off you",
  swarm: "motes that hunt",
  lance: "a beam that sweeps the dark",
  spore: "pods that bloom",
}

export const MAX_WEAPONS = 5

/**
 * Every headline a card can carry.
 *
 * The overlay sizes a card's lettering so that the LONGEST of these still fits
 * on one line inside the card — see `ui/cards.ts`. That is only true if this
 * list is the whole set, so `loadout.test.ts` deals thousands of real cards out
 * of real builds and fails on any headline that is not in here.
 */
export const CARD_TITLES: readonly string[] = [
  // weapons — a new-weapon card and every weapon upgrade card use `w.name`
  "SPLINTER", "HALO", "ARC", "PULSE", "SWARM", "LANCE", "SPORE",
  // passives
  "FEROCITY", "QUICKENING", "WIDENING", "CARAPACE", "CURRENT", "PULL",
  "FRACTURE", "SHATTER", "MEND", "PLATING", "AVARICE",
  // the heal, and the fourth card
  "SURGE", "SEALED CACHE",
]

/** The longest headline in the game, in characters. The card is cut for this. */
export const LONGEST_TITLE = CARD_TITLES.reduce((n, t) => Math.max(n, t.length), 0)

export function makeWeapon(key: WeaponKey): Weapon {
  return { ...BASE[key], t: 0, phase: Math.random() * Math.PI * 2, level: 1 }
}

export function newStats(): Stats {
  return {
    maxHp: 100, hp: 100,
    speed: 205,
    magnet: 78,
    dmgPct: 100,
    ratePct: 100,
    areaPct: 100,
    critPct: 5,
    critMul: 2,
    regenPer10s: 0,
    xpPct: 100,
    armor: 0,
  }
}

/** The headline number on a weapon card: what one full volley is worth. */
export function power(w: Weapon, dmgPct: number): number {
  return w.count * Math.max(1, Math.round((w.dmg * dmgPct) / 100))
}

export function realDamage(w: Weapon, dmgPct: number): number {
  return Math.max(1, Math.round((w.dmg * dmgPct) / 100))
}

export function cooldown(w: Weapon, ratePct: number): number {
  return Math.max(48, Math.round((w.cdMs * 100) / Math.max(20, ratePct)))
}

export function reach(w: Weapon, areaPct: number): number {
  return Math.round((w.radius * areaPct) / 100)
}

/* ------------------------------------------------------------------ cards */

export type Rarity = 0 | 1 | 2

export type Card = {
  id: string
  kind: "weapon-new" | "weapon-up" | "passive" | "heal"
  title: string
  /** The offer, in the player's language of integers. */
  tag: string
  /** Left and right of the arrow, both exact. */
  before: string
  after: string
  /** Big legible resulting number; "" when the card has no single figure. */
  head: string
  sub: string
  rarity: Rarity
  hue: [number, number, number]
  apply: () => void
}

export type Build = {
  weapons: Weapon[]
  stats: Stats
  has(key: WeaponKey): Weapon | undefined
}

export function makeBuild(): Build {
  const weapons: Weapon[] = [makeWeapon("splinter")]
  const stats = newStats()
  return {
    weapons,
    stats,
    has(key) {
      return weapons.find((w) => w.key === key)
    },
  }
}

const WEAPON_HUE: Record<WeaponKey, [number, number, number]> = {
  splinter: [0.55, 0.92, 1.0],
  halo: [1.0, 0.72, 0.32],
  arc: [0.72, 0.62, 1.0],
  pulse: [0.34, 1.0, 0.82],
  swarm: [1.0, 0.45, 0.78],
  lance: [1.0, 0.36, 0.30],
  spore: [0.72, 1.0, 0.36],
}

const PASSIVE_HUE: [number, number, number] = [0.85, 0.90, 1.0]

type Offer = { weight: number; make: () => Card }

/**
 * @param rng deterministic per-run
 * @param sealed when true, only rare and epic offers are eligible — this is
 *        what the arithmetic lock on the fourth card buys you.
 */
export function rollCards(
  build: Build, rng: () => number, n: number, minutes: number, sealed = false,
): Card[] {
  const s = build.stats
  const offers: Offer[] = []

  /* ---- weapon damage / count, one card each so the trade is a real one -- */
  for (const w of build.weapons) {
    const p0 = power(w, s.dmgPct)
    const d0 = realDamage(w, s.dmgPct)

    const addCount = w.key === "pulse" ? 0 : (w.key === "halo" || w.key === "swarm" ? 2 : (w.key === "lance" ? 1 : 2))
    if (addCount > 0 && w.count < 26) {
      offers.push({
        weight: 26,
        make: () => ({
          id: `${w.key}-count`,
          kind: "weapon-up",
          title: w.name,
          tag: `+${addCount} ${countNoun(w.key, addCount)}`,
          before: `${w.count} × ${d0} = ${p0}`,
          after: `${w.count + addCount} × ${d0} = ${(w.count + addCount) * d0}`,
          head: String((w.count + addCount) * d0),
          sub: "VOLLEY",
          rarity: 1,
          hue: WEAPON_HUE[w.key],
          apply: () => {
            w.count += addCount
            w.level++
          },
        }),
      })
    }

    const addDmg = Math.max(2, Math.round(w.dmg * 0.45))
    offers.push({
      weight: 30,
      make: () => {
        const d1 = Math.max(1, Math.round(((w.dmg + addDmg) * s.dmgPct) / 100))
        return {
          id: `${w.key}-dmg`,
          kind: "weapon-up",
          title: w.name,
          tag: `+${addDmg} DAMAGE`,
          before: `${w.count} × ${d0} = ${p0}`,
          after: `${w.count} × ${d1} = ${w.count * d1}`,
          head: String(w.count * d1),
          sub: "VOLLEY",
          rarity: 0,
          hue: WEAPON_HUE[w.key],
          apply: () => {
            w.dmg += addDmg
            w.level++
          },
        }
      },
    })

    if (w.cdMs > 70) {
      offers.push({
        weight: 16,
        make: () => {
          const c0 = cooldown(w, s.ratePct)
          const nd = Math.max(48, Math.round(w.cdMs * 0.78))
          const c1 = Math.max(48, Math.round((nd * 100) / Math.max(20, s.ratePct)))
          return {
            id: `${w.key}-rate`,
            kind: "weapon-up",
            title: w.name,
            tag: "FASTER",
            before: `every ${c0} ms`,
            after: `every ${c1} ms`,
            head: `${Math.round(60000 / c1)}`,
            sub: "PER MINUTE",
            rarity: 1,
            hue: WEAPON_HUE[w.key],
            apply: () => {
              w.cdMs = nd
              w.level++
            },
          }
        },
      })
    }

    if (w.radius > 0) {
      offers.push({
        weight: 14,
        make: () => ({
          id: `${w.key}-radius`,
          kind: "weapon-up",
          title: w.name,
          tag: "+30 REACH",
          before: `reach ${reach(w, s.areaPct)}`,
          after: `reach ${Math.round(((w.radius + 30) * s.areaPct) / 100)}`,
          head: String(Math.round(((w.radius + 30) * s.areaPct) / 100)),
          sub: "REACH",
          rarity: 0,
          hue: WEAPON_HUE[w.key],
          apply: () => {
            w.radius += 30
            w.level++
          },
        }),
      })
    }
  }

  /* ---- a new weapon ------------------------------------------------------ */
  if (build.weapons.length < MAX_WEAPONS) {
    const owned = new Set(build.weapons.map((w) => w.key))
    const unlockAt: Record<WeaponKey, number> = {
      splinter: 0, halo: 0, arc: 0.4, pulse: 0.8, swarm: 1.4, spore: 2.4, lance: 3.4,
    }
    for (const key of Object.keys(BASE) as WeaponKey[]) {
      if (owned.has(key)) continue
      if (minutes < unlockAt[key]) continue
      offers.push({
        weight: 42,
        make: () => {
          const w = makeWeapon(key)
          return {
            id: `new-${key}`,
            kind: "weapon-new",
            title: w.name,
            tag: "NEW WEAPON",
            before: WEAPON_BLURB[key],
            after: `${w.count} × ${realDamage(w, s.dmgPct)} = ${power(w, s.dmgPct)}`,
            head: String(power(w, s.dmgPct)),
            sub: "VOLLEY",
            rarity: 2,
            hue: WEAPON_HUE[key],
            apply: () => {
              build.weapons.push(w)
            },
          }
        },
      })
    }
  }

  /* ---- passives ---------------------------------------------------------- */
  const passives: Offer[] = [
    {
      weight: 24,
      make: () => ({
        id: "p-dmg", kind: "passive", title: "FEROCITY", tag: "+25% ALL DAMAGE",
        before: `${s.dmgPct}%`, after: `${s.dmgPct + 25}%`,
        head: `${s.dmgPct + 25}%`, sub: "DAMAGE", rarity: 1, hue: PASSIVE_HUE,
        apply: () => { s.dmgPct += 25 },
      }),
    },
    {
      weight: 20,
      make: () => ({
        id: "p-rate", kind: "passive", title: "QUICKENING", tag: "+20% FIRE RATE",
        before: `${s.ratePct}%`, after: `${s.ratePct + 20}%`,
        head: `${s.ratePct + 20}%`, sub: "RATE", rarity: 1, hue: PASSIVE_HUE,
        apply: () => { s.ratePct += 20 },
      }),
    },
    {
      weight: 18,
      make: () => ({
        id: "p-area", kind: "passive", title: "WIDENING", tag: "+20% AREA",
        before: `${s.areaPct}%`, after: `${s.areaPct + 20}%`,
        head: `${s.areaPct + 20}%`, sub: "AREA", rarity: 0, hue: PASSIVE_HUE,
        apply: () => { s.areaPct += 20 },
      }),
    },
    {
      weight: 20,
      make: () => ({
        id: "p-hp", kind: "passive", title: "CARAPACE", tag: "+30 MAX LIFE",
        before: `${s.maxHp}`, after: `${s.maxHp + 30}`,
        head: `${s.maxHp + 30}`, sub: "LIFE", rarity: 0, hue: PASSIVE_HUE,
        apply: () => { s.maxHp += 30; s.hp = Math.min(s.maxHp, s.hp + 30) },
      }),
    },
    {
      weight: 16,
      make: () => ({
        id: "p-speed", kind: "passive", title: "CURRENT", tag: "+18 SPEED",
        before: `${s.speed}`, after: `${s.speed + 18}`,
        head: `${s.speed + 18}`, sub: "SPEED", rarity: 0, hue: PASSIVE_HUE,
        apply: () => { s.speed += 18 },
      }),
    },
    {
      weight: 15,
      make: () => ({
        id: "p-magnet", kind: "passive", title: "PULL", tag: "+55 MAGNET",
        before: `${s.magnet}`, after: `${s.magnet + 55}`,
        head: `${s.magnet + 55}`, sub: "MAGNET", rarity: 0, hue: PASSIVE_HUE,
        apply: () => { s.magnet += 55 },
      }),
    },
    {
      weight: 13,
      make: () => ({
        id: "p-crit", kind: "passive", title: "FRACTURE", tag: "+10% CRIT",
        before: `${s.critPct}% × ${s.critMul}`, after: `${s.critPct + 10}% × ${s.critMul}`,
        head: `${s.critPct + 10}%`, sub: "CRIT", rarity: 1, hue: PASSIVE_HUE,
        apply: () => { s.critPct += 10 },
      }),
    },
    {
      weight: 7,
      make: () => ({
        id: "p-critmul", kind: "passive", title: "SHATTER", tag: "CRIT ×1 MORE",
        before: `${s.critPct}% × ${s.critMul}`, after: `${s.critPct}% × ${s.critMul + 1}`,
        head: `×${s.critMul + 1}`, sub: "ON CRIT", rarity: 2, hue: PASSIVE_HUE,
        apply: () => { s.critMul += 1 },
      }),
    },
    {
      weight: 12,
      make: () => ({
        id: "p-regen", kind: "passive", title: "MEND", tag: "+4 LIFE / 10 s",
        before: `${s.regenPer10s} / 10 s`, after: `${s.regenPer10s + 4} / 10 s`,
        head: `${s.regenPer10s + 4}`, sub: "REGEN", rarity: 1, hue: PASSIVE_HUE,
        apply: () => { s.regenPer10s += 4 },
      }),
    },
    {
      weight: 11,
      make: () => ({
        id: "p-armor", kind: "passive", title: "PLATING", tag: "−2 DAMAGE TAKEN",
        before: `${s.armor}`, after: `${s.armor + 2}`,
        head: `${s.armor + 2}`, sub: "ARMOUR", rarity: 1, hue: PASSIVE_HUE,
        apply: () => { s.armor += 2 },
      }),
    },
    {
      weight: 10,
      make: () => ({
        id: "p-xp", kind: "passive", title: "AVARICE", tag: "+25% LIGHT",
        before: `${s.xpPct}%`, after: `${s.xpPct + 25}%`,
        head: `${s.xpPct + 25}%`, sub: "LIGHT", rarity: 1, hue: PASSIVE_HUE,
        apply: () => { s.xpPct += 25 },
      }),
    },
  ]
  offers.push(...passives)

  if (s.hp < s.maxHp * 0.7) {
    offers.push({
      weight: 22,
      make: () => ({
        id: "heal", kind: "heal", title: "SURGE", tag: "RESTORE LIFE",
        before: `${Math.ceil(s.hp)}`, after: `${s.maxHp}`,
        head: `${s.maxHp - Math.ceil(s.hp)}`, sub: "HEALED", rarity: 0, hue: [0.4, 1, 0.7],
        apply: () => { s.hp = s.maxHp },
      }),
    })
  }

  /* ---- draw -------------------------------------------------------------- */
  const out: Card[] = []
  const used = new Set<string>()
  const pool = offers.slice()
  let guard = 0
  while (out.length < n && pool.length > 0 && guard++ < 400) {
    let total = 0
    for (const o of pool) total += o.weight
    let r = rng() * total
    let idx = 0
    for (let i = 0; i < pool.length; i++) {
      r -= pool[i].weight
      if (r <= 0) { idx = i; break }
      idx = i
    }
    const card = pool[idx].make()
    pool.splice(idx, 1)
    if (used.has(card.id)) continue
    if (sealed && card.rarity === 0) continue
    used.add(card.id)
    out.push(card)
  }
  // A pool that ran dry (every offer used) still has to hand back something.
  while (out.length < n) {
    const s2 = build.stats
    out.push({
      id: `fill-${out.length}`, kind: "passive", title: "FEROCITY", tag: "+25% ALL DAMAGE",
      before: `${s2.dmgPct}%`, after: `${s2.dmgPct + 25}%`,
      head: `${s2.dmgPct + 25}%`, sub: "DAMAGE", rarity: 1, hue: PASSIVE_HUE,
      apply: () => { s2.dmgPct += 25 },
    })
  }
  return out
}

function countNoun(k: WeaponKey, n: number): string {
  const one: Record<WeaponKey, string> = {
    splinter: "SHARD", halo: "BLADE", arc: "JUMP", pulse: "RING",
    swarm: "MOTE", lance: "BEAM", spore: "POD",
  }
  return n === 1 ? one[k] : `${one[k]}S`
}

/** XP needed to reach level n+1 from level n. Integers only. */
export function xpForLevel(level: number): number {
  return 5 + level * 4 + Math.floor((level * level) / 5)
}
