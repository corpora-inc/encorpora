import { fill, strings } from "../../app/strings.ts"
import type { RepSpec } from "../curriculum.ts"
import { repSpecDefect, REP_BALANCE_SCALE } from "../curriculum.ts"

/**
 * The balance scale: the equals sign as a **relation**, not an operator.
 *
 * `{ left, right }`, whole units in each pan. This is the representation
 * CURRICULUM.md puts against `dw.alg.equality.balance-meaning` at grade 1,
 * because on `8 + 4 = ☐ + 5` roughly 5% of grade 1–2 children answer 7 and in
 * one sample *all 145 sixth graders* answered 12 or 17 — they read `=` as "and
 * now write the total". A beam that is level when and only when the two sides
 * hold the same amount is the counter-example, and it is a picture rather than a
 * rule to remember.
 *
 * **The tilt is three states, not a proportion.** Level, left down, right down —
 * and nothing in between. A beam whose angle tracked the difference would invite
 * reading the size of the gap off a picture that is not to scale, and the idea
 * being taught is binary: same, or not the same.
 *
 * **The pans hang level from a tilted beam**, which is what a real balance does
 * and what keeps the numerals readable. The beam rotates and each pan
 * counter-rotates by the same angle, so the pans stay upright and stay attached
 * with no offset computed anywhere — the first cut positioned them by hand, and
 * at 6° over a 358 px beam the hangers missed the beam entirely and the whole
 * thing swung out over the heading above it.
 *
 * The tilt is a class, not an inline transform: `style-src 'self'` forbids
 * inline style, which is dropped silently in the WebView while working perfectly
 * in a dev browser. Under `prefers-reduced-motion` the beam arrives tilted.
 *
 * Numbers are on the pans, not only in the tilt: colour and angle are never the
 * only carriers (CG-18), and the text alternative says which pan is lower.
 */
export function BalanceScale({ spec }: { spec: RepSpec }) {
  const defect = repSpecDefect(REP_BALANCE_SCALE, spec.params)
  if (defect !== null) return null

  const left = spec.params["left"] ?? 0
  const right = spec.params["right"] ?? 0
  const tilt = left === right ? "level" : left > right ? "left" : "right"

  const state =
    tilt === "level"
      ? strings.practice.balanceLevel
      : tilt === "left"
        ? strings.practice.balanceLeft
        : strings.practice.balanceRight

  return (
    <div
      role="img"
      aria-label={fill(strings.practice.balanceAlt, { left, right, state })}
      className="dw-present flex w-full justify-center"
    >
      {/* Fixed height and generous top padding: the beam's ends rise and fall
          by about a sixth of their half-length, and a box sized to the level
          beam would let the raised end climb into whatever sits above. */}
      <div aria-hidden="true" className="relative h-40 w-full max-w-xs">
        <div
          className={[
            "dw-beam absolute top-10 right-6 left-6",
            tilt === "left" ? "dw-beam-left" : tilt === "right" ? "dw-beam-right" : "",
          ].join(" ")}
        >
          <div className="border-line-strong border-t-2" />
          <div className="flex justify-between">
            <Pan amount={left} />
            <Pan amount={right} />
          </div>
        </div>

        {/* The fulcrum, at the pivot: apex on the beam's centre, base below it.
            Outside the rotating box, because a fulcrum that tilts with the beam
            is not a fulcrum. */}
        <div className="absolute top-10 left-1/2 flex -translate-x-1/2 flex-col items-center">
          <span className="dw-fulcrum block" />
          <span className="border-line-strong block w-16 border-t-2" />
        </div>
      </div>
    </div>
  )
}

/**
 * One pan: a hanger, a dish, and the amount written in it.
 *
 * `dw-pan` is the counter-rotation. Its origin is the top centre — the point the
 * hanger meets the beam — so the pan swings back to upright about the place it
 * hangs from rather than about its own middle.
 */
function Pan({ amount }: { amount: number }) {
  return (
    <span className="dw-pan flex w-16 flex-col items-center">
      <span className="bg-line-strong block h-6 w-px" />
      <span className="border-line-strong bg-ground-sunk numeral text-ink rounded-cut-md flex min-h-10 w-full items-center justify-center border text-xl">
        {String(amount)}
      </span>
    </span>
  )
}
