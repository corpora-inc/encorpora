/**
 * HOW A TARGET IS CHOSEN — the whole negotiation with the curriculum, in one
 * pure function so that a test can run it ten thousand times and report the
 * distribution.
 *
 * ## The problem
 *
 * The curriculum owns the maths and the judgement, and it must: a game that
 * invents its own sums is a game with no learner model behind it. But the
 * curriculum's answers at the top of its ladder are five-figure numbers, and this
 * game's answer surface is *at most three polyps off a shelf*. Put those together
 * naively and you get exactly what the founder was handed:
 *
 *   "the numbers I have for the vents are pretty huge for whatever reason —
 *    58042+968 .. it's easier just to ignore the vents"
 *
 * ## The negotiation, in order
 *
 * 1. **Say what we can build.** `candidates` reads the shelf and produces up to
 *    32 numbers it can already make, best first, and hands them to `host.focus`.
 *    That extension exists for precisely this (FUSE uses it so a chip can print
 *    an expression worth its own value) and it makes the host's stream *lean
 *    towards* answers this board can reach.
 * 2. **Take what the host gives.** `host.next({ difficulty, maxDifficulty })`.
 *    The number on the vent is the host's item's answer, always — never a number
 *    this file made up.
 * 3. **Choose the form the number can express.** `48` can be a `times`; `17`
 *    cannot. The form is picked among those the child has unlocked AND the number
 *    admits, so an unlocked form is an offer and never a demand.
 * 4. **If the shelf can already answer it, done.** Best case, and the common one
 *    once `focus` is warm.
 * 5. **Otherwise stock the shelf toward it.** `ladderRoute` says which polyps
 *    make it, `stockFor` says which of those the shelf is missing, and the reef
 *    emits their HALVES — so a target the shelf cannot yet reach arrives as a
 *    merge to do. This is the founder's sentence made mechanical: "the game can
 *    know what would be a fun number to put on the vent and you build it with the
 *    polyps."
 * 6. **If the number cannot be built at all, refuse it.** `host.skip` — honest,
 *    records nothing, and is explicitly not a wrong answer. Draw again.
 *
 * ## What still reaches the learner model
 *
 * Everything that used to. The number on the vent is a host item's answer; the
 * child's attempt is reported against that item's id with the value they actually
 * produced; the host judges it. The one thing that changed is the
 * **representation**: the child is shown the answer to make rather than the sum
 * to evaluate, which is the sanctioned use of `items.reveal` this pack already
 * declares — the same trade FUSE makes.
 *
 * The residual case is step 6 exhausting its draws. Then the target comes from the
 * board's own candidate list, `questionId` is null, and **nothing is reported at
 * all** — an absence rather than an attempt filed against an item the child never
 * saw. `ask.test.ts` measures how often that happens.
 */

import {
  difficultyFor,
  formsAt,
  maxDifficultyFor,
  sumSlotsAt,
  wantDigitsAt,
} from './economy.ts'
import { valueOf, type Strain } from './ladder.ts'
import type { Rng } from './rng.ts'
import {
  candidates,
  formsFor,
  ladderRoute,
  pickCandidate,
  routeIn,
  slotsFor,
  stockFor,
  type Bag,
  type Form,
} from './target.ts'

/** Just the slice of the host this negotiation touches. */
export type AskHost = {
  next(opts?: { domain?: string; difficulty?: number; maxDifficulty?: number }): {
    id: string
    prompt: string
    answer: string
  }
  skip?(questionId: string): void
  focus?(spec: { key: number; wanted: number[] }): void
}

/**
 * How many host items one ask may look at before giving up.
 *
 * Six. Each refusal is a `skip`, which the host documents as costless and as
 * explicitly not a wrong answer — but it does consume an item from the pool, and
 * a pack that burned dozens per target would be a pack that starves its own
 * stream. Measured in `ask.test.ts`: the mean is well under two.
 */
export const MAX_DRAWS = 6

/**
 * How likely each form is to be WANTED, once it is unlocked.
 *
 * Weighted towards the rare ones on purpose, because legality is not a matter of
 * taste — it is arithmetic, and it is brutally lopsided. Measured over 2..3000,
 * how many integers each form can express at all:
 *
 *     sum    2999 / 2999    (100%)
 *     minus  1182           ( 39%)
 *     times   220           (  7%)
 *     over     74           (  2%)
 *
 * `over` is that rare for a hard reason: `a ÷ b = v` with both operands on the
 * ladder forces `oddpart(v) * oddpart(b) <= 15`, which in practice means `v` must
 * itself be a ladder value. So an unweighted pick would show a child division
 * roughly never — the first measured run put `over` at **0.0% of 3,580 targets**,
 * and the founder's own headline example is `15 = ▢ ÷ ▢`. Hence: want the rare
 * form first, and lean on `host.focus` to find a number that can carry it.
 */
const FORM_WEIGHT: Readonly<Record<Form, number>> = { sum: 6, minus: 5, times: 5, over: 5 }

export type Ask = {
  value: number
  form: Form
  slots: number
  route: number[]
  questionId: string | null
  hostPrompt: string
  /** Polyps the reef owes the shelf before this target is buildable. */
  stock: number[]
  /** How many host items were looked at. For the QA overlay and the tests. */
  draws: number
  /** True when the number came from the curriculum, which is the normal case. */
  viaHost: boolean
}

function chooseForm(legal: readonly Form[], rng: Rng): Form {
  let total = 0
  for (const f of legal) total += FORM_WEIGHT[f]
  let roll = rng.int(1, Math.max(1, total))
  for (const f of legal) {
    roll -= FORM_WEIGHT[f]
    if (roll <= 0) return f
  }
  return legal[legal.length - 1] ?? 'sum'
}

export function askTarget(o: {
  bag: Bag
  depth: number
  host: AskHost
  rng: Rng
  /** The last few targets, so the same number twice running is unlikely. */
  recent?: readonly number[]
}): Ask {
  const forms = formsAt(o.depth)
  const sumSlots = sumSlotsAt(o.depth)
  const wantDigits = wantDigitsAt(o.depth)
  const recent = o.recent ?? []

  // The form is wanted FIRST, and the wanted list is built for it. Asking the host
  // for any number at all and then seeing which forms it happens to admit is how
  // division came out at 0.0%: the rare forms need the stream steered at them, and
  // `focus` is the steering. The general list still pads the tail, so a miss on the
  // wanted form is a normal ask rather than a failed one.
  const want = chooseForm(forms, o.rng)
  const wantList = want === 'sum' ? [] : candidates(o.bag, [want], sumSlots, wantDigits, 24)
  const general = candidates(o.bag, forms, sumSlots, wantDigits)
  const seen = new Set(wantList.map((c) => c.value))
  const list = [...wantList, ...general.filter((c) => !seen.has(c.value))].slice(0, 32)

  try {
    o.host.focus?.({ key: 1, wanted: list.map((c) => c.value) })
  } catch (e) {
    console.warn('[abyssal-bloom] host.focus threw; the stream is unbiased this ask', e)
  }

  for (let draw = 1; draw <= MAX_DRAWS; draw++) {
    const q = o.host.next({
      difficulty: difficultyFor(o.depth, want),
      maxDifficulty: maxDifficultyFor(o.depth, want),
    })
    const value = Number(q.answer)
    const usable = Number.isSafeInteger(value) && value > 1
    const legal = usable ? formsFor(value, forms, sumSlots) : []
    // A number that has just been asked is refused while there are draws to
    // spare: the same target twice running reads as the game not noticing.
    const stale = recent.includes(value) && draw <= MAX_DRAWS - 2
    if (legal.length === 0 || stale) {
      refuse(o.host, q.id)
      continue
    }

    // The wanted form if this number can carry it; otherwise the most advanced one
    // it can. Never a form the arithmetic forbids.
    const form = legal.includes(want) ? want : (legal[legal.length - 1] as Form)
    const slots = slotsFor(form, sumSlots)
    const onShelf = routeIn(o.bag, value, form, slots)
    const route = onShelf ?? ladderRoute(value, form, slots)
    if (!route) {
      // `formsFor` said this form was expressible, so this is unreachable —
      // said out loud rather than swallowed, because if it ever happens the two
      // functions have drifted apart.
      console.warn(`[abyssal-bloom] ${value} passed formsFor as "${form}" and has no route`)
      refuse(o.host, q.id)
      continue
    }
    return {
      value,
      form,
      slots,
      route,
      questionId: q.id,
      hostPrompt: q.prompt,
      stock: onShelf ? [] : stockFor(o.bag, route),
      draws: draw,
      viaHost: true,
    }
  }

  // Six host items in a row that this shelf cannot build. Fall back to the
  // board's own best candidate so the game never stalls, and report NOTHING.
  const pick = pickCandidate(list, o.rng)
  if (pick) {
    return {
      value: pick.value,
      form: pick.form,
      slots: slotsFor(pick.form, sumSlots),
      route: pick.route,
      questionId: null,
      hostPrompt: '',
      stock: [],
      draws: MAX_DRAWS,
      viaHost: false,
    }
  }

  // An empty shelf, which only happens on the very first frame of a fresh save.
  // Two ladder values in the current band, and the reef stocks both.
  const step = Math.min(9, Math.max(0, Math.floor(o.depth / 6)))
  const a = valueOf((o.rng.int(0, 7) as Strain), step)
  const b = valueOf((o.rng.int(0, 7) as Strain), step)
  const route = [a, b]
  return {
    value: a + b,
    form: 'sum',
    slots: Math.max(2, sumSlots),
    route,
    questionId: null,
    hostPrompt: '',
    stock: stockFor(o.bag, route),
    draws: MAX_DRAWS,
    viaHost: false,
  }
}

function refuse(host: AskHost, id: string): void {
  try {
    host.skip?.(id)
  } catch (e) {
    console.warn('[abyssal-bloom] host.skip threw', e)
  }
}
