import { BalanceScale } from "./BalanceScale.tsx"
import { NumberLine } from "./NumberLine.tsx"
import { representationDefect } from "../representations.ts"
import { REP_BALANCE_SCALE, REP_NUMBER_LINE } from "../curriculum.ts"
import type { RepSpec } from "../curriculum.ts"

/**
 * The one place a `RepSpec` becomes a picture: a switch and nothing else.
 *
 * The list of ids it serves lives in `representations.ts`, which a Node test can
 * import where this file cannot be (JSX does not survive
 * `--experimental-strip-types`), and `representation.test.ts` reads this source
 * to check the two have not drifted — a `RepId` in the list with no case here is
 * a blank space on a child's screen and a green gate.
 */
export function Representation({ spec }: { spec: RepSpec | undefined }) {
  if (spec === undefined) return null
  // A spec this bundle cannot draw honestly draws nothing. The card's answer
  // still works; a mis-drawn number line is worse than an absent one, because a
  // child would read it.
  if (representationDefect(spec) !== null) return null

  switch (spec.rep) {
    case REP_NUMBER_LINE:
      return <NumberLine spec={spec} />
    case REP_BALANCE_SCALE:
      return <BalanceScale spec={spec} />
    default:
      return null
  }
}
