/**
 * `gen.arith.times-table`, held to what a generator binding has to prove before a
 * row may be served to a child.
 *
 * The whole-graph sweep in `../families.property.test.ts` already runs every level
 * of every row for schema defects, determinism, checker agreement and timing. What
 * it cannot do is know what *this* family claims, and the claims are the point:
 *
 * 1. **Every stated answer is correct, checked in the other direction.** Never by
 *    re-running `first * second`, which is what the generator did — that would be
 *    the same expression twice and would agree with any consistent bug in it. A
 *    multiplication is checked by **repeated addition** of exact rationals, which
 *    is what multiplication means and shares no code with it; a division is checked
 *    by multiplying the quotient back.
 * 2. **The table is closed, and the closure is exact in both directions.** The
 *    generator reaches every fact the level admits and never one it does not, and
 *    it is asserted against an enumeration written here rather than against
 *    `factSet` itself. This is what `GeneratorBinding.closedFactSet` and CG-10's
 *    substituted check rest on.
 * 3. **The draw is uniform over that set**, by χ². The closure test cannot see a
 *    generator that reaches all 121 facts and asks for `2 × 2` twenty times as
 *    often as `9 × 8`, and a child would meet that as a level that will not stop
 *    asking the easy ones.
 * 4. **Every item is inside the band the row declares.** No factor above the
 *    level's ceiling, no trivial fact on a level that excludes them, and — the one
 *    that has no equivalent in any other family here — **never a divisor of zero**.
 * 5. **`48,826 × 82,726` is expressible**, which is a claim about `multidigit-mul`
 *    and is asserted at the bottom of this file because this is the change that
 *    made it true.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  add as ratAdd,
  cmp as ratCmp,
  eq as ratEq,
  mul as ratMul,
  rational,
  toString as ratToString,
} from "../../math/rational.ts";
import type { Rational } from "../../math/rational.ts";
import { skillId } from "../../types/ids.ts";
import { schemaDefect } from "../../types/answer.ts";
import type { Exercise } from "../../types/exercise.ts";
import { serializeExercise } from "../../serialize.ts";
import { allNodes } from "../../graph/graph.ts";
import { chiSquareUniform } from "../shared/uniformity.ts";
import { multidigitMulFamily } from "../multidigitMul/family.ts";
import { multidigitMulParamSchema } from "../multidigitMul/params.ts";
import { timesTableFamily } from "./family.ts";
import { factSet } from "./facts.ts";
import { timesTableParamSchema } from "./params.ts";
import type { TimesTableParams } from "./params.ts";
import {
  PROMPT_KEY_DIV,
  PROMPT_KEY_MUL,
  SLOT_DIVIDEND,
  SLOT_DIVISOR,
  SLOT_FIRST,
  SLOT_SECOND,
  SOLUTION_KEY_MISSING_FACTOR,
  SOLUTION_KEY_SKIP_COUNT,
  TIMES_TABLE_FAMILY,
} from "./constants.ts";

const SKILL = skillId("dw.mul.facts.tables-within-five");
const FORMS = ["free-entry"];

/** Enough draws that a set of 121 is collected several times over. */
const SEEDS = 4000;

function params(op: "mul" | "div", maxFactor: number, includeTrivial = false): TimesTableParams {
  return { op, maxFactor, includeTrivial };
}

function generate(p: TimesTableParams, seed: number, level = 0): Exercise {
  return timesTableFamily.generate({ skillId: SKILL, level, seed, params: p, forms: FORMS });
}

/** The written operands, read back out of the public prompt contract. */
function operands(exercise: Exercise): { first: Rational; second: Rational } {
  const mul = exercise.prompt.key === PROMPT_KEY_MUL;
  const first = exercise.prompt.slots[mul ? SLOT_FIRST : SLOT_DIVIDEND];
  const second = exercise.prompt.slots[mul ? SLOT_SECOND : SLOT_DIVISOR];
  assert.ok(first !== undefined && first.kind === "number", exercise.exerciseId);
  assert.ok(second !== undefined && second.kind === "number", exercise.exerciseId);
  return { first: first.value, second: second.value };
}

function answerOf(exercise: Exercise): Rational {
  const answer = exercise.answer.canonical;
  assert.equal(answer.kind, "integer", exercise.exerciseId);
  return answer.kind === "integer" ? answer.value : rational(0n);
}

/** Every level bound by a `gen.arith.times-table` row, with its declared size. */
const BOUND_LEVELS = allNodes
  .filter((node) => node.generator.family === TIMES_TABLE_FAMILY)
  .flatMap((node) =>
    node.generator.params.map((raw, level) => {
      const validated = timesTableParamSchema.validate(raw);
      assert.ok(validated.ok, `${node.id} L${String(level)} params rejected`);
      return {
        label: `${node.id} L${String(level)}`,
        node,
        level,
        params: validated.ok ? validated.value : params("mul", 2, true),
        declared: node.generator.closedFactSet?.[level],
      };
    }),
  );

test("the graph binds this family, and every bound level declares its closed set", () => {
  assert.ok(BOUND_LEVELS.length >= 10, `only ${String(BOUND_LEVELS.length)} bound level(s)`);
  // Both directions of the binding, and the second is the one that matters: a
  // family bound by nothing is dead code, and a level without `closedFactSet`
  // falls back to CG-10's floor of 975, which no table can reach.
  for (const bound of BOUND_LEVELS) {
    assert.ok(bound.declared !== undefined, `${bound.label} declares no closedFactSet`);
  }
  const domains = new Set(BOUND_LEVELS.map((bound) => bound.node.domain));
  assert.deepEqual([...domains].sort(), ["div", "mul"], "one family, both directions, or the sharing is a claim only");
  process.stdout.write(`# times-table: ${String(BOUND_LEVELS.length)} bound level(s)\n`);
});

test("every stated answer is correct, re-derived from the prompt and never by multiplying again", () => {
  let checked = 0;
  for (const bound of BOUND_LEVELS) {
    for (let seed = 1; seed <= SEEDS; seed++) {
      const exercise = generate(bound.params, seed, bound.level);
      const { first, second } = operands(exercise);
      const answer = answerOf(exercise);

      if (bound.params.op === "mul") {
        // Repeated addition: `first` added to itself `second` times. That is what
        // multiplication *is*, and it shares no line of code with the `*` the
        // generator used, so a consistent bug in one cannot hide in the other.
        let summed = rational(0n);
        for (let i = 0; i < Number(second.n); i++) summed = ratAdd(summed, first);
        assert.ok(
          ratEq(summed, answer),
          `${exercise.exerciseId}: ${ratToString(first)} added ${ratToString(second)} times is ` +
            `${ratToString(summed)}, not ${ratToString(answer)}`,
        );
      } else {
        // The quotient multiplied back is the dividend, and the divisor is never
        // zero — the two facts that make a division item well posed.
        assert.notEqual(second.n, 0n, `${exercise.exerciseId}: a divisor of zero`);
        assert.ok(
          ratEq(ratMul(answer, second), first),
          `${exercise.exerciseId}: ${ratToString(answer)} × ${ratToString(second)} is not ${ratToString(first)}`,
        );
      }
      checked += 1;
    }
  }
  process.stdout.write(`# times-table: ${String(checked)} answers re-derived\n`);
});

test("every item is inside the band its level declares, and none is degenerate", () => {
  for (const bound of BOUND_LEVELS) {
    const { maxFactor, includeTrivial, op } = bound.params;
    for (let seed = 1; seed <= SEEDS; seed++) {
      const exercise = generate(bound.params, seed, bound.level);
      const first = Number(operands(exercise).first.n);
      const second = Number(operands(exercise).second.n);
      const answer = Number(answerOf(exercise).n);

      if (op === "mul") {
        assert.ok(first <= maxFactor && second <= maxFactor, `${exercise.exerciseId}: a factor above the level`);
        assert.ok(first >= 0 && second >= 0, `${exercise.exerciseId}: a negative factor`);
        // The one draw this family excludes, named so a widening cannot let it back
        // in unnoticed: nothing times nothing has no side to reason from.
        assert.ok(first + second > 0, `${exercise.exerciseId}: both factors are zero`);
        if (!includeTrivial) {
          assert.ok(first >= 2 && second >= 2, `${exercise.exerciseId}: a trivial factor on a level without them`);
        }
      } else {
        assert.ok(second >= 1, `${exercise.exerciseId}: a divisor of zero`);
        assert.ok(second <= maxFactor && answer <= maxFactor, `${exercise.exerciseId}: outside the level's table`);
        assert.ok(first <= maxFactor * maxFactor, `${exercise.exerciseId}: a dividend outside the table`);
        if (!includeTrivial) {
          assert.ok(second >= 2 && answer >= 2, `${exercise.exerciseId}: a trivial quotient on a level without them`);
        }
      }

      // The answer field is the level's width, never this item's: a field cut to
      // fit would say how many digits the answer has, which on `12 × 9` rules out
      // 108 before the child has thought about it.
      assert.equal(schemaDefect(exercise.schema), null, exercise.exerciseId);
      assert.ok(
        String(answer).length <= (exercise.schema.kind === "integer" ? exercise.schema.digits : 0),
        `${exercise.exerciseId}: the answer does not fit the field`,
      );
      assert.equal(exercise.schema.kind === "integer" ? exercise.schema.signed : true, undefined, exercise.exerciseId);
    }
  }
});

/**
 * The closure, against an enumeration written here and not imported.
 *
 * `factSet` is the generator's own list, so asserting the generator against it
 * would prove only that the family calls the function it calls. This walks every
 * pair of numbers a level could conceivably involve and decides membership from
 * the level's *stated* rules, then compares the two sets whole.
 */
function independentSet(p: TimesTableParams): Set<string> {
  const out = new Set<string>();
  const low = p.includeTrivial ? 0 : 2;
  for (let a = 0; a <= 12; a++) {
    for (let b = 0; b <= 12; b++) {
      if (a < low || b < low || a > p.maxFactor || b > p.maxFactor) continue;
      if (p.op === "mul") {
        if (a === 0 && b === 0) continue;
        out.add(`${String(a)}x${String(b)}`);
        continue;
      }
      // `a` is the quotient and `b` the divisor; the written problem is `ab ÷ b`.
      if (b === 0) continue;
      out.add(`${String(a * b)}/${String(b)}`);
    }
  }
  return out;
}

test("the table is closed, the generator reaches exactly it, and the draw is uniform", () => {
  const lines: string[] = [];
  for (const bound of BOUND_LEVELS) {
    const expected = independentSet(bound.params);
    assert.equal(
      factSet(bound.params).length,
      expected.size,
      `${bound.label}: factSet has ${String(factSet(bound.params).length)} facts, the rules give ${String(expected.size)}`,
    );
    assert.equal(
      bound.declared,
      expected.size,
      `${bound.label}: the row declares a closed set of ${String(bound.declared)} and the mathematics has ${String(expected.size)}`,
    );

    const counts = new Map<string, number>([...expected].map((fact) => [fact, 0]));
    for (let seed = 1; seed <= SEEDS; seed++) {
      const exercise = generate(bound.params, seed, bound.level);
      const { first, second } = operands(exercise);
      const key =
        bound.params.op === "mul"
          ? `${first.n.toString()}x${second.n.toString()}`
          : `${first.n.toString()}/${second.n.toString()}`;
      assert.ok(counts.has(key), `${bound.label}: the generator reached ${key}, which is outside the closed set`);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    const observed = [...counts.values()];
    const missing = [...counts].filter(([, count]) => count === 0).map(([fact]) => fact);
    assert.deepEqual(missing.sort(), [], `${bound.label}: the generator never reached a fact in the closed set`);

    const uniformity = chiSquareUniform(observed);
    assert.ok(
      uniformity.uniform,
      `${bound.label}: the draw is not uniform over its own set — χ² = ${ratToString(uniformity.chiSquare)} ` +
        `on ${String(uniformity.degreesOfFreedom)} degrees of freedom`,
    );
    lines.push(
      `#   ${bound.label}: ${String(expected.size)} facts, all reached in ${String(SEEDS)} seeds, ` +
        `χ² ≈ ${String(Number(uniformity.chiSquare.n) / Number(uniformity.chiSquare.d))} on ${String(uniformity.degreesOfFreedom)} df`,
    );
  }
  process.stdout.write(`# closed tables:\n${lines.join("\n")}\n`);
});

test("the root of the strand is reachable: 0 x 1, 1 x n, 0 ÷ n and n ÷ 1 are all drawn", () => {
  // The graph's own level 0, not a fixture written here. A row edited to start at
  // `2 × 2` — by dropping `includeTrivial`, which is one word — has to fail this,
  // and a test carrying its own parameters would go on passing while the strand's
  // bottom rung quietly moved up.
  const rowLevel = (id: string, level: number): TimesTableParams => {
    const bound = BOUND_LEVELS.find((candidate) => String(candidate.node.id) === id && candidate.level === level);
    assert.ok(bound !== undefined, `the graph has no level ${String(level)} of ${id}`);
    return bound.params;
  };

  const drawn = new Set<string>();
  for (let seed = 1; seed <= 200; seed++) {
    const { first, second } = operands(generate(rowLevel("dw.mul.facts.tables-within-five", 0), seed));
    drawn.add(`${first.n.toString()}x${second.n.toString()}`);
  }
  for (const fact of ["0x1", "1x0", "1x1", "0x2", "2x0", "1x2", "2x1", "2x2"]) {
    assert.ok(drawn.has(fact), `the root level never draws ${fact}`);
  }
  assert.ok(!drawn.has("0x0"), "the root level draws a question with nothing on either side");

  const drawnDiv = new Set<string>();
  for (let seed = 1; seed <= 400; seed++) {
    const { first, second } = operands(generate(rowLevel("dw.div.facts.division-facts", 0), seed, 0));
    drawnDiv.add(`${first.n.toString()}/${second.n.toString()}`);
  }
  for (const fact of ["0/1", "0/5", "3/1", "5/1", "25/5"]) {
    assert.ok(drawnDiv.has(fact), `the entry division level never draws ${fact}`);
  }
  // Every divisor of zero, on every level. The one item whose answer does not
  // exist, and the reason the division enumeration is not a plain rectangle.
  for (const bound of BOUND_LEVELS) {
    if (bound.params.op !== "div") continue;
    for (const fact of factSet(bound.params)) {
      assert.notEqual(fact.second, 0, `${bound.label}: the closed set contains a division by zero`);
    }
  }
});

test("the walkthrough's strategy rung is the strategy, and its last rung is the answer", () => {
  let skipCounts = 0;
  let missingFactors = 0;
  for (const bound of BOUND_LEVELS) {
    for (let seed = 1; seed <= 400; seed++) {
      const exercise = generate(bound.params, seed, bound.level);
      assert.equal(exercise.solution.length, 3, exercise.exerciseId);
      const middle = exercise.solution[1];
      const last = exercise.solution[2];
      assert.ok(middle !== undefined && last !== undefined);

      const stated = last.slots["answer"];
      assert.ok(stated !== undefined && stated.kind === "number", exercise.exerciseId);
      assert.ok(ratEq(stated.value, answerOf(exercise)), `${exercise.exerciseId}: the ladder ends elsewhere`);

      const { first, second } = operands(exercise);
      if (middle.key === SOLUTION_KEY_SKIP_COUNT) {
        // Count in steps of the *larger* factor. Counting in threes eight times is
        // eight chances to lose the thread, and a rung that taught it would be
        // teaching the slower habit in the right place.
        const step = middle.slots["step"];
        const times = middle.slots["times"];
        assert.ok(step !== undefined && step.kind === "number", exercise.exerciseId);
        assert.ok(times !== undefined && times.kind === "count", exercise.exerciseId);
        assert.ok(step.value.n >= BigInt(times.value), `${exercise.exerciseId}: counts in steps of the smaller factor`);
        assert.ok(
          ratEq(ratMul(step.value, rational(BigInt(times.value))), answerOf(exercise)),
          exercise.exerciseId,
        );
        assert.equal(step.value.n * BigInt(times.value), first.n * second.n, exercise.exerciseId);
        skipCounts += 1;
        continue;
      }
      if (middle.key === SOLUTION_KEY_MISSING_FACTOR) {
        const divisor = middle.slots["divisor"];
        const dividend = middle.slots["dividend"];
        assert.ok(divisor !== undefined && divisor.kind === "number", exercise.exerciseId);
        assert.ok(dividend !== undefined && dividend.kind === "number", exercise.exerciseId);
        assert.ok(ratEq(divisor.value, second) && ratEq(dividend.value, first), exercise.exerciseId);
        missingFactors += 1;
      }
    }
  }
  assert.ok(skipCounts > 0 && missingFactors > 0, "one of the two strategies never fires");
  process.stdout.write(
    `# times-table: ${String(skipCounts)} skip-count rung(s), ${String(missingFactors)} missing-factor rung(s)\n`,
  );
});

test("the parameter schema rejects the combinations that would be two skills or a flashcard", () => {
  const reject = (raw: unknown, pattern: RegExp): void => {
    const result = timesTableParamSchema.validate(raw);
    assert.equal(result.ok, false, `expected a rejection of ${JSON.stringify(raw)}`);
    if (!result.ok) {
      assert.match(result.issues.map((issue) => `${issue.path}: ${issue.message}`).join("; "), pattern);
    }
  };

  assert.equal(timesTableParamSchema.validate(params("mul", 2, true)).ok, true);
  assert.equal(timesTableParamSchema.validate(params("div", 12)).ok, true);

  reject(params("mul", 3), /needs factors to at least 4/);
  reject(params("div", 12, true), /belong below the 5 times table/);
  reject({ op: "plus", maxFactor: 5, includeTrivial: true }, /op must be one of/);
  reject({ op: "mul", maxFactor: 13, includeTrivial: false }, /maxFactor must be 2/);
  reject({ op: "mul", maxFactor: 1, includeTrivial: true }, /maxFactor must be 2/);
  reject({ op: "mul", maxFactor: 5 }, /includeTrivial must be a boolean/);
});

test("the difficulty contribution is exact, ordered, and never a float", () => {
  const offset = (p: TimesTableParams): Rational => timesTableFamily.difficultyOffset(p);

  // Hundredths of a logit, exactly. A float `0.15` would make the last bits of
  // every `b` in this family platform-dependent.
  assert.equal(ratToString(offset(params("mul", 2, true))), "-1/10");
  assert.equal(ratToString(offset(params("mul", 2))), "0");
  assert.equal(ratToString(offset(params("mul", 12))), "3/2");
  assert.equal(ratToString(offset(params("div", 12))), "33/20");

  // The ordering the coefficients claim: the inverse direction is harder at the
  // same range, and a whole further table is harder than admitting the trivial
  // facts is easy.
  assert.equal(ratCmp(offset(params("div", 9)), offset(params("mul", 9))), 1);
  assert.equal(ratCmp(offset(params("mul", 6)), offset(params("mul", 5))), 1);
  assert.equal(ratCmp(offset(params("mul", 5, true)), offset(params("mul", 5))), -1);
});

test("the same seed produces the identical item, and different seeds do not all agree", () => {
  const p = params("mul", 12);
  const first = serializeExercise(generate(p, 7));
  assert.equal(serializeExercise(generate(p, 7)), first);
  assert.equal(serializeExercise(generate(p, 7)), first);

  const distinct = new Set(Array.from({ length: 50 }, (_unused, i) => serializeExercise(generate(p, i + 1))));
  assert.ok(distinct.size > 20, `50 seeds produced only ${String(distinct.size)} distinct items`);
});

test("the prompt is a spec with typed slots, never a rendered sentence", () => {
  const product = generate(params("mul", 12), 3);
  assert.equal(product.prompt.key, PROMPT_KEY_MUL);
  assert.deepEqual(Object.keys(product.prompt.slots).sort(), [SLOT_FIRST, SLOT_SECOND].sort());

  const quotient = generate(params("div", 12), 3);
  assert.equal(quotient.prompt.key, PROMPT_KEY_DIV);
  assert.deepEqual(Object.keys(quotient.prompt.slots).sort(), [SLOT_DIVIDEND, SLOT_DIVISOR].sort());
});

/**
 * The program's stated ceiling, asserted as an item rather than as an intention.
 *
 * `48,826 × 82,726` was not merely unauthored before this change: `multidigitMul`
 * capped `multiplierDigits` at three, so no parameter object could describe it and
 * the schema rejected the level table outright. This checks the three things that
 * had to become true — the parameters validate, the level draws items of that
 * shape, and the product is exact at a size where a double would have stopped
 * being one (`48,826 × 82,726` is 4,039,179,676, comfortably inside a double, but
 * the level's widest is `99,999 × 99,999` and a product of that size is exactly
 * where a program that reached for floats would begin to be quietly wrong).
 */
test("48,826 × 82,726 is expressible, and the widest level's products are exact", () => {
  const wide = { shape: "general" as const, digits: 5, multiplierDigits: 5, carries: true };
  const validated = multidigitMulParamSchema.validate(wide);
  assert.ok(validated.ok, "a five-by-five multiplication is not a legal level");

  const top = allNodes.find((node) => String(node.id) === "dw.mul.multidigit.long-multiplication");
  assert.ok(top !== undefined, "the graph has no long-multiplication row");
  assert.deepEqual(top.generator.params[top.generator.params.length - 1], wide, "its top level is not five by five");

  let widest = 0n;
  for (let seed = 1; seed <= 500; seed++) {
    const exercise = multidigitMulFamily.generate({
      skillId: top.id,
      level: 2,
      seed,
      params: validated.ok ? validated.value : wide,
      forms: ["free-entry"],
    });
    const slots = exercise.prompt.slots;
    const a = slots["top"];
    const b = slots["bottom"];
    assert.ok(a !== undefined && a.kind === "number" && b !== undefined && b.kind === "number");
    assert.equal(a.value.n.toString().length, 5, exercise.exerciseId);
    assert.equal(b.value.n.toString().length, 5, exercise.exerciseId);
    const answer = exercise.answer.canonical;
    assert.equal(answer.kind, "integer");
    if (answer.kind === "integer") {
      assert.ok(ratEq(ratMul(a.value, b.value), answer.value), `${exercise.exerciseId}: the product is not exact`);
      if (answer.value.n > widest) widest = answer.value.n;
    }
  }
  // The founder's number, as arithmetic this package can do exactly.
  assert.equal((48826n * 82726n).toString(), "4039179676");
  process.stdout.write(`# long multiplication: widest product drawn in 500 seeds is ${widest.toString()}\n`);
});
