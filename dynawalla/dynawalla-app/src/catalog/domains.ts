// What a game is about, derived rather than declared.
//
// A skill id carries its subject in the second segment — `dw.add.column.…`,
// `dw.frac.compare.…` — so the filter above the grid is computed from the
// manifests of whatever is installed, at runtime, every render.
//
// **There is deliberately no per-game table here.** The catalogue went from
// eighteen games to twenty-seven in a few hours; a lookup table mapping a pack
// id to a subject would have been stale before it merged, and a game missing
// from it would have vanished from every filter while looking fine in code
// review. Deriving it means a pack that lands tomorrow is filed correctly the
// moment it is installed, by nobody.
//
// An id whose second segment this build has never heard of is not an error and
// must not be one: the game keeps every other subject it does match, it is
// always in "All", and it simply offers no chip of its own. Vanishing is the
// failure mode being avoided, so the fallback is "shown, unfiled".

import { strings } from "../app/strings.ts"

/**
 * The subjects, in teaching order rather than in frequency order.
 *
 * Frequency today is `add` 126, `frac` 15, `alg` 9, `mul` 8, `div` 5, `ns` 1 —
 * ordering the chips by that would put the chip row in a sequence that changes
 * every time a pack ships.
 */
export const DOMAIN_IDS = ["ns", "add", "mul", "div", "frac", "alg"] as const

export type DomainId = (typeof DOMAIN_IDS)[number]

const isDomainId = (value: string): value is DomainId =>
  (DOMAIN_IDS as readonly string[]).includes(value)

/** The name a child's grown-up reads on the chip. */
export function domainName(domain: DomainId): string {
  return strings.catalog.domains[domain]
}

/**
 * The subject a skill id belongs to, or `null` for one this build cannot file.
 *
 * `dw.add.column.add-no-carry` → `add`. Anything shorter, anything not under
 * the `dw.` root, and anything under a second segment that is not one of the
 * six is unfiled — never a crash, never a guess.
 */
export function domainOfSkill(skill: string): DomainId | null {
  const parts = skill.split(".")
  if (parts.length < 2 || parts[0] !== "dw") return null
  const second = parts[1] ?? ""
  return isDomainId(second) ? second : null
}

/** Every subject a game touches, in the fixed chip order. */
export function domainsOf(skills: readonly string[]): readonly DomainId[] {
  const found = new Set<DomainId>()
  for (const skill of skills) {
    const domain = domainOfSkill(skill)
    if (domain !== null) found.add(domain)
  }
  return DOMAIN_IDS.filter((domain) => found.has(domain))
}

/**
 * The chips to offer, given what is actually installed.
 *
 * Only subjects some installed game covers: a filter that can only ever return
 * nothing is a control that lies about what this device holds.
 */
export function chipsFor(games: readonly { readonly skills: readonly string[] }[]): readonly DomainId[] {
  const found = new Set<DomainId>()
  for (const game of games) {
    for (const domain of domainsOf(game.skills)) found.add(domain)
  }
  return DOMAIN_IDS.filter((domain) => found.has(domain))
}
