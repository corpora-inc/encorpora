// journey/engine/leech.ts — leech detect / presentation-swap /
// suspend+substitute (adaptivity §6.4, engine.md §5.7).

import { LEECH_LAPSES, LEECH_REPS_RATIO, LEECH_SUSPEND_EXTRA_LAPSES } from "./constants.ts"
import type { GraphIndex } from "./graph.ts"
import { CardFlags, type CourseState, type ItemCard } from "./types.ts"

export interface LeechOutcome {
  flagged: boolean
  suspended: boolean
  substituteId?: string
}

/** Called from apply.ts after every graded review of a card. */
export function checkLeech(
  card: ItemCard,
  gidx: GraphIndex,
  course: CourseState,
  cards: Map<string, ItemCard>,
): LeechOutcome {
  const out: LeechOutcome = { flagged: false, suspended: false }
  const f = card.fsrs

  const isLeechy = f.lapses >= LEECH_LAPSES && f.lapses > 0 && f.reps / f.lapses < LEECH_REPS_RATIO
  if (!isLeechy) return out

  if ((card.flags & CardFlags.Leech) === 0) {
    card.flags |= CardFlags.Leech
    out.flagged = true
  }

  // 2 further failures post-flag ⇒ suspend + substitute (flag fires at
  // exactly LEECH_LAPSES, so suspension = LEECH_LAPSES + 2 lapses).
  if (
    (card.flags & CardFlags.Suspended) === 0 &&
    f.lapses >= LEECH_LAPSES + LEECH_SUSPEND_EXTRA_LAPSES
  ) {
    card.flags |= CardFlags.Suspended
    out.suspended = true
    delete course.leechTypes[card.itemId]
    const subs = gidx.graph.items[card.itemId]?.substituteIds ?? []
    for (const sub of subs) {
      if (!cards.has(sub) && !course.leechSubstitutes.includes(sub)) {
        out.substituteId = sub
        course.leechSubstitutes.push(sub) // enters NEW (same skill, fresh start)
        break
      }
    }
  }
  return out
}

/** Presentation swap: a flagged card's next servings must use a DIFFERENT
 *  activityType than its last two. Mixer consults this per candidate type. */
export function leechTypeAllowed(course: CourseState, itemId: string, activityType: string): boolean {
  const recent = course.leechTypes[itemId]
  if (!recent) return true
  return !recent.includes(activityType)
}

/** Record a served type for a flagged card (keep last two). */
export function recordLeechServing(course: CourseState, itemId: string, activityType: string): void {
  const recent = course.leechTypes[itemId] ?? []
  recent.push(activityType)
  while (recent.length > 2) recent.shift()
  course.leechTypes[itemId] = recent
}
