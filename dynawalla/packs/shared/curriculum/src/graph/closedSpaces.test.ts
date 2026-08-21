/**
 * Every `closedFactSet` declaration in the graph, **exhausted**.
 *
 * ## The loophole this closes
 *
 * `GeneratorBinding.closedFactSet` exempts a level from CG-10's variant-space floor,
 * and the exemption is right: there are forty-five additions within ten and there is
 * no forty-sixth, so a floor derived from "would a forty-item run repeat itself"
 * would forbid teaching number facts at all.
 *
 * But look at what the substituted check actually is. In
 * `families.property.test.ts` it is
 *
 * ```ts
 * assert.ok(distinct <= level.closedFactSet)
 * ```
 *
 * — an upper bound, and an upper bound alone. `closedFactSet: [999_999]` passes it
 * on every level in this graph, forever. `MIN_RUNG_VARIANTS` closed the half of the gap
 * where a rung is honestly declared too small; this closes the other half, where the
 * declaration is simply not the space. Writing a big enough number beside a rung of nine
 * items satisfied both CG-10 and the new floor, and the whole point of the floor is that
 * the nine-item rung is the defect the founder found by playing.
 *
 * Two families were pinned from the other side and the rest were not.
 * `numberFacts.test.ts` and `timesTable.test.ts` enumerate their sets from the level's
 * stated rules and require the generator to reach every member, which is a stronger
 * claim than anything here; `families.test.ts` counts the eighty-one one-digit missing
 * addends the same way. That leaves the four other families — place value, comparison,
 * rounding, and both fraction families — declaring closed spaces that nothing
 * measured.
 *
 * ## What this test does instead
 *
 * It draws seeds until the level stops producing new items, and requires the count it
 * arrives at to equal the declaration **exactly**. Over-declaring fails, because the
 * space never reaches the number. Under-declaring fails, because the space passes it.
 * Neither direction is available, so a declaration is a measurement of the level's
 * reachable space rather than an assertion about it.
 *
 * The budget is a multiple of the declared size, because that is what coupon collection
 * scales with, floored so that a nine-item set still gets a fair number of draws. It is
 * spent in full on every level and deliberately: an earlier draft stopped as soon as the
 * declared count was reached, which made under-declaring free — a level claiming 100
 * against a space of 180 reaches 100, stops, and reports agreement. That was caught by
 * breaking the declaration and watching this file stay green, which is the only way that
 * class of defect is ever caught.
 *
 * The observed cost, for scale: the widest level here needs about 15,000 draws to reach
 * its 840 and the whole file runs in a couple of seconds.
 *
 * ## What it does not claim
 *
 * That the reachable set is the *mathematically correct* set. A generator that reached
 * exactly 180 wrong items would pass here. That claim is made per family, by the
 * enumerations above and by `families.test.ts`, which re-derives every generated
 * answer from the prompt in exact rationals. What this file adds is the one claim none
 * of those make and CG-10 depends on: the *size* is the declared size.
 *
 * It is also why `promotionBlockers.ts` uses the field only where the space is below
 * CG-10's floor. Exhausting a few hundred items costs a few thousand seeds; exhausting
 * the 2,280 same-numerator comparisons inside twentieths costs six figures, which is
 * not a PR gate. A level above the floor does not need the exemption and does not get
 * the declaration.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { allNodes } from "./graph.ts";
import { MIN_RUNG_VARIANTS, SMALL_RUNG_LEVELS } from "./promotionBlockers.ts";
import { familyById } from "../generators/registry.ts";
import { fingerprintItem } from "../serialize.ts";
// The gate's own number, imported rather than restated: the rule below is "closure is
// only claimed where it buys the exemption", and a second copy of 975 in this file
// would let the rule and the gate drift apart. `validate/` is tooling and a test may
// reach it — see `boundary.test.ts`, which exempts both.
import { VARIANT_SPACE_FLOOR } from "../validate/gates/generatorGates.ts";

/** Seeds per declared item. Coupon collection over `S` items is `S·ln S` in the */
/** uniform case and worse on a skewed draw, so forty is generous at these sizes. */
const SEEDS_PER_DECLARED_ITEM = 40;

/** A floor on the budget, so an eight-item set still gets a real number of draws. */
const MIN_SEED_BUDGET = 4_000;

type ClosedLevel = {
  readonly label: string;
  readonly declared: number;
  readonly reached: number;
  readonly seedsUsed: number;
  readonly budget: number;
};

function exhaust(): ClosedLevel[] {
  const out: ClosedLevel[] = [];

  for (const node of allNodes) {
    if (node.status === "deprecated") continue;
    const declaredSets = node.generator.closedFactSet;
    if (declaredSets === undefined) continue;

    const family = familyById(node.generator.family);
    assert.ok(family !== undefined, `${node.id} binds unregistered family ${node.generator.family}`);

    node.generator.params.forEach((params, level) => {
      const declared = declaredSets[level] ?? null;
      if (declared === null) return;

      const validated = family.paramSchema.validate(params);
      assert.ok(validated.ok, `${node.id} L${String(level)} params rejected`);
      if (!validated.ok) return;

      const budget = Math.max(MIN_SEED_BUDGET, declared * SEEDS_PER_DECLARED_ITEM);
      const seen = new Set<string>();
      let seed = 0;
      // The whole budget, every time, and **not** stopping when the declared count is
      // reached. Stopping there is what the first draft of this file did and it defanged
      // exactly half the check: a level declaring 100 against a space of 180 hits 100,
      // breaks, reports `reached === declared` and passes. Under-declaring was free — and
      // under-declaring is the more dangerous direction, because CG-10's substituted check
      // is `distinct ≤ declared`, so a level that claims fewer problems than it has is a
      // level whose *sample* is being compared against a number that is not its space.
      //
      // The only early exit is on a count that has already exceeded the declaration, which
      // is a failure with nothing further to learn from another 30,000 draws.
      while (seed < budget) {
        seed += 1;
        seen.add(
          fingerprintItem(
            family.generate({
              skillId: node.id,
              level,
              seed,
              params: validated.value,
              forms: node.generator.forms,
            }),
          ),
        );
        if (seen.size > declared) break;
      }

      out.push({
        label: `${node.id} L${String(level)}`,
        declared,
        reached: seen.size,
        seedsUsed: seed,
        budget,
      });
    });
  }

  return out;
}

const CLOSED = exhaust();

test("every closed level is reached exactly, and no further", () => {
  // A vacuity guard first. Every assertion below passes on an empty list, and an empty
  // list is what a refactor that stopped reading `closedFactSet` would produce.
  assert.ok(
    CLOSED.length >= 40,
    `expected the graph's closed levels, found ${String(CLOSED.length)} — has closedFactSet stopped being read?`,
  );

  const lines: string[] = [];
  for (const level of CLOSED) {
    lines.push(
      `#   ${level.label}: declared ${String(level.declared)}, reached ${String(level.reached)} ` +
        `in ${String(level.seedsUsed)}/${String(level.budget)} seeds`,
    );
    assert.equal(
      level.reached,
      level.declared,
      level.reached < level.declared
        ? `${level.label} declares a closed space of ${String(level.declared)} and its generator reaches only ` +
            `${String(level.reached)} in ${String(level.budget)} seeds — the declaration buys this level an ` +
            `exemption from CG-10's floor that it has not earned`
        : `${level.label} declares a closed space of ${String(level.declared)} and its generator reaches ` +
            `${String(level.reached)} — the level has more problems in it than the row says it does, so CG-10 is ` +
            `measuring against a number that is not the space`,
    );
  }
  process.stdout.write(`# closed spaces, exhausted:\n${lines.join("\n")}\n`);
});

test("no closed level is thinner than MIN_RUNG_VARIANTS, beyond the one already exempt", () => {
  // The third reading of the same bound. `ladder.test.ts` measures it over the active
  // graph and `families.property.test.ts` over the whole graph, both from a 500-seed
  // sample; this measures it over a level's **whole declared space**. A sample reports
  // what it happened to draw, and a space reports what exists — and a rung whose entire
  // universe is nineteen items cannot be made wider by sampling it harder.
  //
  // A **subset** of `SMALL_RUNG_LEVELS`, not an equality, and the list is imported rather
  // than restated so the two files cannot drift. The relation is forced: nothing can draw
  // more distinct items than exist, so a closed level under the floor is necessarily
  // under it in a sample too. The reverse does not hold — an *open* level could draw
  // thinly from a wide space — so requiring equality here would assert something this
  // file does not measure.
  const thin = CLOSED.filter((level) => level.declared < MIN_RUNG_VARIANTS);
  const exempt = new Set(SMALL_RUNG_LEVELS);
  const unregistered = thin
    .filter((level) => !exempt.has(level.label))
    .map((level) => `${level.label} (${String(level.declared)} problems in the world)`);

  assert.deepEqual(
    unregistered,
    [] as readonly string[],
    `these levels declare a closed space below MIN_RUNG_VARIANTS=${String(MIN_RUNG_VARIANTS)} and are not ` +
      `exempt in promotionBlockers.ts: ${unregistered.join("; ")}`,
  );
  // A vacuity guard on the filter: if `declared` ever stopped being read, `thin` would be
  // empty and the assertion above would pass on anything. It also catches the other
  // direction — an exempt level that has been widened has to be struck off the list.
  assert.equal(
    thin.length,
    SMALL_RUNG_LEVELS.length,
    `${String(thin.length)} closed level(s) declare a space under the floor and ${String(SMALL_RUNG_LEVELS.length)} ` +
      `are exempt`,
  );
});

test("closure is only claimed where it buys the CG-10 exemption", () => {
  // The rule `promotionBlockers.ts` states, enforced. A declaration above CG-10's floor
  // is not an exemption from anything — the level clears the floor on its own — and it
  // is what makes this file unaffordable: exhausting a 2,280-item space costs six
  // figures of seeds. So the field is reserved for the case it was written for, and the
  // reservation is checked rather than remembered.
  const oversized = CLOSED.filter((level) => level.declared > VARIANT_SPACE_FLOOR).map(
    (level) => `${level.label} declares ${String(level.declared)}`,
  );
  assert.deepEqual(
    oversized,
    [] as readonly string[],
    `closedFactSet is for a space below CG-10's floor of ${String(VARIANT_SPACE_FLOOR)}; ` +
      `these declare more, and each would either clear the floor unaided or cost this test six figures of ` +
      `seeds to verify: ${oversized.join("; ")}`,
  );
});
