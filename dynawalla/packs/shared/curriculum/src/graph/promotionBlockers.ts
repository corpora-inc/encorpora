/**
 * What stands between a `draft` row and an `active` one, per row.
 *
 * Every draft row in this graph waits on **PR-2.13**, the statement renderer, and
 * since [ADR-0022](../../../../docs/DECISIONS/ADR-0022-host-ships-no-content.md)
 * that renderer is a **pack's** to land rather than the host's: the host ships no
 * content, and stating a question is content. Nothing in this repository draws a
 * curriculum item today, so promoting a row buys an answer entry on a child's
 * screen with no question above it (CG-8, `render/prompts.ts`).
 *
 * Eighteen of them wait on a **second** thing, and it is not a field flip. CG-10
 * requires an estimated variant space of 975 — a 40-item practice run repeating no
 * more than one item in fifty — and the levels named below do not clear it. Some
 * are genuinely short of problems in the world: `dw.alg.equality.missing-addend` L0
 * draws both operands from 1..9, so its true space is exactly 81 items, and no
 * generator work changes that. Others would clear the floor with a wider draw.
 * Either way the row needs a widened generator, a reconciliation with whoever owns
 * CG-10, or both — and a promotion PR planned as "flip `status`" would fail the
 * gate on the first run.
 *
 * The list is here rather than in a comment beside each `minVariants` because a
 * comment cannot be checked. `families.property.test.ts` measures the sub-floor set
 * over the whole graph and asserts it equals this list **in both directions**: a
 * level that slips under the floor is named here or the sweep fails, and a
 * generator widened past it must be struck off or the sweep fails too.
 *
 * Labels are `<skill id> L<level>`, the same form the sweep prints.
 */

export const CG10_BLOCKED_LEVELS: readonly string[] = [
  "dw.ns.place.digit-in-place L0",
  "dw.ns.round.whole-numbers L0",
  "dw.mul.scale.times-power-of-ten L0",
  "dw.div.whole.divide-exact L0",
  "dw.frac.equivalence.build-equivalent L0",
  "dw.frac.equivalence.build-equivalent L1",
  "dw.frac.equivalence.build-equivalent L2",
  "dw.frac.equivalence.lowest-terms L0",
  "dw.frac.equivalence.lowest-terms L1",
  "dw.frac.equivalence.lowest-terms L2",
  "dw.frac.equivalence.improper-to-mixed L0",
  "dw.frac.equivalence.improper-to-mixed L1",
  "dw.frac.equivalence.mixed-to-improper L0",
  "dw.frac.equivalence.mixed-to-improper L1",
  "dw.frac.arith.add-like-denominators L0",
  "dw.frac.arith.add-like-denominators L1",
  "dw.frac.arith.add-unlike-denominators L0",
  "dw.frac.arith.subtract-fractions L0",
  "dw.frac.arith.subtract-fractions L1",
  "dw.frac.arith.multiply-by-a-whole L0",
  "dw.frac.arith.multiply-by-a-whole L1",
  "dw.frac.arith.multiply-fractions L0",
  "dw.alg.equality.missing-addend L0",
  "dw.alg.equality.balance-meaning L0",
  "dw.alg.equality.missing-subtrahend L0",
  "dw.alg.equality.unknown-minuend L0",
  "dw.alg.equality.missing-factor L0",
];

/** The skills above, deduplicated — 18 of the graph's 30 draft rows. */
export const CG10_BLOCKED_SKILLS: readonly string[] = [
  ...new Set(CG10_BLOCKED_LEVELS.map((label) => label.slice(0, label.lastIndexOf(" ")))),
];
