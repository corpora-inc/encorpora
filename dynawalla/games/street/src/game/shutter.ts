// THE SHUTTER — the only surface in this game the host judges.
//
// A steel roller comes down across the street with the problem chalked on it
// and four rivets punched through the plate. The mob is behind it, leaning. You
// hit a rivet; the right one throws the shutter up and lets them out.
//
// **The game never marks it.** The first rivet struck is reported, with the
// text on it, and the host decides — that is the whole contract. A wrong rivet
// caves in and goes dark so the child can still open the shutter and get on
// with the street, and nothing after the first strike is reported: a record only
// ever rises, and the same item answered twice would raise it twice.
//
// The numerals on the rivets are the host's, never this game's: the canonical
// answer plus mal-rule outputs, which are wrong values a child with a specific
// broken procedure actually writes down. Dropping the carry gives you 62 where
// 72 belongs, and 62 is on the plate.

import type { Rng } from "../core/rng.ts"

export type Rivet = {
  readonly text: string
  /** Struck, wrong, and out. Purely a state of the plate — not a verdict. */
  readonly dead: boolean
}

export type Shutter = {
  readonly questionId: string
  /** "47 + 25", operator glyph included. Chalked across the plate. */
  readonly prompt: string
  /** The host's canonical value. Used to decide whether the plate opens. */
  readonly answer: string
  readonly rivets: readonly Rivet[]
  /** True once a rivet has been struck. Gates the single report. */
  readonly reported: boolean
  readonly open: boolean
}

export type ShutterSource = {
  readonly id: string
  readonly prompt: string
  readonly answer: string
  readonly distractors: readonly string[]
}

/** Rivets on a plate. Four when the host has three wrong values, fewer if not. */
export const RIVETS = 4

export function newShutter(source: ShutterSource, rng: Rng): Shutter {
  const seen = new Set<string>([source.answer])
  const texts: string[] = [source.answer]
  for (const d of source.distractors) {
    if (texts.length >= RIVETS) break
    if (d === "" || seen.has(d)) continue
    seen.add(d)
    texts.push(d)
  }
  rng.shuffle(texts)
  return {
    questionId: source.id,
    prompt: source.prompt,
    answer: source.answer,
    rivets: texts.map((text) => ({ text, dead: false })),
    reported: false,
    open: false,
  }
}

export type RivetStrike = {
  readonly shutter: Shutter
  /** Whether the plate went up. */
  readonly opened: boolean
  /**
   * What to send the host, or `null` when this strike is not the first one on
   * this plate. `null` is not "nothing happened" — it is "already reported".
   */
  readonly report: { readonly questionId: string; readonly answered: string } | null
}

/**
 * Hit rivet `index`.
 *
 * A dead rivet is inert: it has already caved in, and hitting a hole is not an
 * answer. That is the one case that produces neither a report nor a change.
 */
export function strikeRivet(shutter: Shutter, index: number): RivetStrike {
  const rivet = shutter.rivets[index]
  if (shutter.open || !rivet || rivet.dead) {
    return { shutter, opened: false, report: null }
  }
  const right = rivet.text === shutter.answer
  const rivets = shutter.rivets.map((r, i) => (i === index && !right ? { ...r, dead: true } : r))
  const next: Shutter = { ...shutter, rivets, reported: true, open: right }
  return {
    shutter: next,
    opened: right,
    report: shutter.reported ? null : { questionId: shutter.questionId, answered: rivet.text },
  }
}

/** The index of the canonical rivet. For tests and for the dev harness only. */
export function rightRivet(shutter: Shutter): number {
  return shutter.rivets.findIndex((r) => r.text === shutter.answer)
}
