/**
 * `gen.arith.number-facts`, held to the two things a generator binding has to
 * prove before a row may be served to a child.
 *
 * The whole-graph sweep in `../families.property.test.ts` already runs every level
 * of every row for schema defects, determinism, checker agreement and timing. What
 * it cannot do is know what *this* family claims, and the claims are the point:
 *
 * 1. **Every stated answer is correct, re-derived from the prompt.** Never from
 *    `Fact.result`, which is what the generator wrote — that would be re-running
 *    the same expression and calling the agreement a test. The operands are read
 *    back out of `prompt.slots` as `Rational`s and the arithmetic is done again,
 *    in the inverse direction for subtraction.
 * 2. **The fact set is closed, and the closure is exact in both directions.** The
 *    generator reaches every fact the level admits and never one it does not.
 *    This is what `GeneratorBinding.closedFactSet` and CG-10's substituted check
 *    rest on, so it is asserted against an independently written enumeration
 *    rather than against `factSet` itself.
 * 3. **Every item is inside the band the row declares.** No operand above the
 *    level's ceiling, no answer outside the range the skill claims to teach, and
 *    no degenerate item — with `0 + 0` named, because it is the one draw this
 *    family deliberately excludes and the one a future widening would let back in.
 * 4. **The root is reachable.** `0 + 1` is in level 0 of `add-within-ten`, `n − 0`
 *    and `n − n` are in level 0 of `subtract-within-ten`, and none of them is an
 *    accident of a parameter that could be flipped without a test noticing.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { rational, add as ratAdd, eq as ratEq, sub as ratSub, toString as ratToString } from "../../math/rational.ts";
import type { Rational } from "../../math/rational.ts";
import { skillId } from "../../types/ids.ts";
import { schemaDefect } from "../../types/answer.ts";
import type { Exercise } from "../../types/exercise.ts";
import { serializeExercise } from "../../serialize.ts";
import { repSpecDefect } from "../../render/representations.ts";
import { addDomainNodes } from "../../graph/domains/add.ts";
import { numberFactsFamily } from "./family.ts";
import { factSet } from "./facts.ts";
import { numberFactsParamSchema } from "./params.ts";
import type { NumberFactsParams } from "./params.ts";
import { NUMBER_FACTS_FAMILY, PROMPT_KEY_ADD, PROMPT_KEY_SUB, SLOT_FIRST, SLOT_SECOND } from "./constants.ts";

const SKILL = skillId("dw.add.facts.add-within-ten");
const FORMS = ["free-entry"];

/** Enough draws that a set of sixty-five is collected with room to spare. */
const SEEDS = 4000;

function params(
  op: "add" | "sub",
  maxTotal: number,
  options: { crossesTen?: boolean; includeZero?: boolean; picture?: boolean } = {},
): NumberFactsParams {
  return {
    op,
    maxTotal,
    crossesTen: options.crossesTen ?? false,
    includeZero: options.includeZero ?? false,
    picture: options.picture ?? false,
  };
}

function generate(p: NumberFactsParams, seed: number, level = 0): Exercise {
  return numberFactsFamily.generate({ skillId: SKILL, level, seed, params: p, forms: FORMS });
}

/** The written operands, read back out of the public prompt contract. */
function operands(exercise: Exercise): { first: Rational; second: Rational } {
  const first = exercise.prompt.slots[SLOT_FIRST];
  const second = exercise.prompt.slots[SLOT_SECOND];
  assert.ok(first !== undefined && first.kind === "number", exercise.exerciseId);
  assert.ok(second !== undefined && second.kind === "number", exercise.exerciseId);
  return { first: first.value, second: second.value };
}

function answerOf(exercise: Exercise): Rational {
  const answer = exercise.answer.canonical;
  assert.equal(answer.kind, "integer", exercise.exerciseId);
  return answer.kind === "integer" ? answer.value : rational(0n);
}

/** Every level bound by a `gen.arith.number-facts` row, with its declared size. */
const BOUND_LEVELS = addDomainNodes
  .filter((node) => node.generator.family === NUMBER_FACTS_FAMILY)
  .flatMap((node) =>
    node.generator.params.map((raw, level) => {
      const validated = numberFactsParamSchema.validate(raw);
      assert.ok(validated.ok, `${node.id} L${String(level)} params rejected`);
      return {
        label: `${node.id} L${String(level)}`,
        node,
        level,
        params: validated.ok ? validated.value : params("add", 3),
        declared: node.generator.closedFactSet?.[level],
      };
    }),
  );

test("the graph binds this family, and every bound level declares its closed set", () => {
  assert.ok(BOUND_LEVELS.length >= 14, `only ${String(BOUND_LEVELS.length)} bound level(s)`);
  for (const bound of BOUND_LEVELS) {
    assert.ok(bound.declared !== undefined, `${bound.label} declares no closedFactSet`);
  }
  process.stdout.write(`# number-facts: ${String(BOUND_LEVELS.length)} bound level(s)\n`);
});

test("every stated answer is correct, re-derived from the prompt and never from the draw", () => {
  let checked = 0;
  for (const bound of BOUND_LEVELS) {
    for (let seed = 1; seed <= SEEDS; seed++) {
      const exercise = generate(bound.params, seed, bound.level);
      const { first, second } = operands(exercise);
      const answer = answerOf(exercise);

      // Addition forward, subtraction backward: `answer + second` must be the
      // written whole. Re-running `first − second` would be the generator's own
      // expression a second time and would agree with any consistent bug in it.
      const rebuilt = bound.params.op === "add" ? ratAdd(first, second) : ratAdd(answer, second);
      const against = bound.params.op === "add" ? answer : first;
      assert.ok(
        ratEq(rebuilt, against),
        `${exercise.exerciseId}: ${ratToString(first)} ${bound.params.op} ${ratToString(second)} does not give ${ratToString(answer)}`,
      );

      // And the forward reading of a subtraction, as a second independent route.
      if (bound.params.op === "sub") {
        assert.ok(ratEq(ratSub(first, second), answer), exercise.exerciseId);
      }
      checked += 1;
    }
  }
  process.stdout.write(`# number-facts: ${String(checked)} answers re-derived\n`);
});

test("every item is inside the band its level declares, and none is degenerate", () => {
  for (const bound of BOUND_LEVELS) {
    const { maxTotal, crossesTen, includeZero, op } = bound.params;
    for (let seed = 1; seed <= SEEDS; seed++) {
      const exercise = generate(bound.params, seed, bound.level);
      const first = Number(operands(exercise).first.n);
      const second = Number(operands(exercise).second.n);
      const answer = Number(answerOf(exercise).n);
      const whole = op === "add" ? answer : first;

      assert.ok(whole <= maxTotal, `${exercise.exerciseId}: reaches ${String(whole)}, above ${String(maxTotal)}`);
      assert.ok(whole >= 1, `${exercise.exerciseId}: nothing to count`);
      assert.ok(answer >= 0, `${exercise.exerciseId}: negative answer`);
      // The one draw this family excludes, named so a widening cannot let it back
      // in unnoticed: both operands zero is an empty screen, not a question.
      assert.ok(first + second > 0, `${exercise.exerciseId}: both operands are zero`);

      if (!includeZero) {
        assert.ok(first >= 1 && second >= 1, `${exercise.exerciseId}: a zero operand on a level without them`);
        if (op === "sub") assert.ok(answer >= 1, `${exercise.exerciseId}: a zero answer on a level without them`);
      }

      if (crossesTen) {
        assert.ok(whole > 10, `${exercise.exerciseId}: ${String(whole)} does not cross ten`);
        assert.ok(first <= 9 || op === "sub", `${exercise.exerciseId}: an addend of ten or more`);
        assert.ok(second <= 9, `${exercise.exerciseId}: a part of ten or more`);
        // The crossing is what the level is for: both ends of a subtraction sit on
        // opposite sides of ten, and both addends of a sum sit below it.
        if (op === "sub") assert.ok(answer < 10 && first > 10, exercise.exerciseId);
      } else {
        assert.ok(whole <= 10, `${exercise.exerciseId}: ${String(whole)} crosses ten on a level that does not`);
      }

      // The answer field is the level's width, never this item's: an item whose
      // answer needed more room than the field would be unanswerable, and one
      // whose field was cut to fit would say how many digits the answer has.
      assert.equal(schemaDefect(exercise.schema), null, exercise.exerciseId);
      assert.ok(
        String(answer).length <= (exercise.schema.kind === "integer" ? exercise.schema.digits : 0),
        `${exercise.exerciseId}: the answer does not fit the field`,
      );
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
function independentSet(p: NumberFactsParams): Set<string> {
  const out = new Set<string>();
  for (let a = 0; a <= 20; a++) {
    for (let b = 0; b <= 20; b++) {
      if (!p.includeZero && (a === 0 || b === 0)) continue;
      if (a === 0 && b === 0) continue;
      if (p.op === "add") {
        const sum = a + b;
        if (sum < 1 || sum > p.maxTotal) continue;
        if (p.crossesTen) {
          if (sum <= 10 || a > 9 || b > 9 || a === 0 || b === 0) continue;
        } else if (sum > 10) continue;
        out.add(`${String(a)}+${String(b)}`);
        continue;
      }
      const difference = a - b;
      if (difference < 0 || a < 1 || a > p.maxTotal) continue;
      if (p.crossesTen) {
        if (a <= 10 || b > 9 || b < 1 || difference < 1 || difference > 9) continue;
      } else {
        if (a > 10) continue;
        if (!p.includeZero && (b < 1 || difference < 1)) continue;
      }
      out.add(`${String(a)}-${String(b)}`);
    }
  }
  return out;
}

test("the fact set is closed, and the generator reaches exactly it", () => {
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

    const reached = new Set<string>();
    for (let seed = 1; seed <= SEEDS; seed++) {
      const exercise = generate(bound.params, seed, bound.level);
      const { first, second } = operands(exercise);
      reached.add(`${first.n.toString()}${bound.params.op === "add" ? "+" : "-"}${second.n.toString()}`);
    }
    assert.deepEqual(
      [...reached].filter((fact) => !expected.has(fact)).sort(),
      [],
      `${bound.label}: the generator reached a fact outside the closed set`,
    );
    assert.deepEqual(
      [...expected].filter((fact) => !reached.has(fact)).sort(),
      [],
      `${bound.label}: the generator never reached a fact in the closed set`,
    );
    lines.push(`#   ${bound.label}: ${String(expected.size)} facts, all reached in ${String(SEEDS)} seeds`);
  }
  process.stdout.write(`# closed fact sets:\n${lines.join("\n")}\n`);
});

test("the root of the ladder is reachable: 0 + 1, n - 0 and n - n are all drawn", () => {
  // The graph's own level 0, not a fixture written here. A row edited to start at
  // `1 + 1` — by dropping `includeZero`, which is one word — has to fail this, and
  // a test carrying its own parameters would go on passing while the product's
  // bottom rung quietly moved up.
  const rowLevel = (id: string): NumberFactsParams => {
    const bound = BOUND_LEVELS.find((candidate) => String(candidate.node.id) === id && candidate.level === 0);
    assert.ok(bound !== undefined, `the graph has no level 0 of ${id}`);
    return bound.params;
  };
  const root = rowLevel("dw.add.facts.add-within-ten");
  const drawn = new Set<string>();
  for (let seed = 1; seed <= 200; seed++) {
    const { first, second } = operands(generate(root, seed));
    drawn.add(`${first.n.toString()}+${second.n.toString()}`);
  }
  // Named individually. A level table edited to start at `1 + 1` would still pass
  // a set-size assertion, and the trivial facts are the rung a child who has slid
  // all the way down lands on.
  for (const fact of ["0+1", "1+0", "1+1", "0+2", "2+0", "0+3", "3+0", "1+2", "2+1"]) {
    assert.ok(drawn.has(fact), `the root level never draws ${fact}`);
  }
  assert.ok(!drawn.has("0+0"), "the root level draws an empty question");

  const rootSub = rowLevel("dw.add.facts.subtract-within-ten");
  const drawnSub = new Set<string>();
  for (let seed = 1; seed <= 200; seed++) {
    const { first, second } = operands(generate(rootSub, seed));
    drawnSub.add(`${first.n.toString()}-${second.n.toString()}`);
  }
  for (const fact of ["1-0", "1-1", "2-0", "2-2", "3-0", "3-3", "3-1"]) {
    assert.ok(drawnSub.has(fact), `the root level never draws ${fact}`);
  }
  assert.ok(!drawnSub.has("0-0"), "the root level draws an empty question");
});

test("the quantity picture is drawable, and never shows the answer", () => {
  let framed = 0;
  for (const bound of BOUND_LEVELS) {
    for (let seed = 1; seed <= 400; seed++) {
      const exercise = generate(bound.params, seed, bound.level);
      if (!bound.params.picture) {
        assert.equal(exercise.representation, undefined, `${exercise.exerciseId}: an unasked-for picture`);
        continue;
      }
      const spec = exercise.representation;
      assert.ok(spec !== undefined, `${exercise.exerciseId}: the level asks for a picture and got none`);
      assert.equal(repSpecDefect(spec.rep, spec.params), null, exercise.exerciseId);

      const answer = Number(answerOf(exercise).n);
      const standing = (spec.params["first"] ?? 0) + (spec.params["second"] ?? 0);
      if (bound.params.op === "sub") {
        // A subtraction frame holds the **whole** with the part crossed out.
        // Drawing `first − second` counters beside `second` would put the answer
        // on the screen, and the assertion that rules it out is that the counters
        // standing are the minuend. The only item where that number is also the
        // answer is `n − 0`, where drawing it is correct.
        const minuend = Number(operands(exercise).first.n);
        const subtrahend = Number(operands(exercise).second.n);
        assert.equal(spec.params["first"], minuend, `${exercise.exerciseId}: the frame does not hold the whole`);
        assert.equal(spec.params["second"], 0, exercise.exerciseId);
        assert.equal(spec.params["removed"], subtrahend, exercise.exerciseId);
        if (subtrahend > 0) {
          assert.notEqual(spec.params["first"], answer, `${exercise.exerciseId}: the frame draws the answer`);
        }
      } else {
        assert.equal(standing, answer, `${exercise.exerciseId}: the frame does not hold the sum`);
        assert.equal(spec.params["removed"], 0, exercise.exerciseId);
      }
      framed += 1;
    }
  }
  assert.ok(framed > 0, "no level in the graph draws a quantity picture");
  process.stdout.write(`# number-facts: ${String(framed)} framed item(s) checked\n`);
});

test("the walkthrough's strategy rung is the strategy, and its last rung is the answer", () => {
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

      if (!bound.params.crossesTen) {
        // Count on from the *larger* addend. Starting at the smaller one is the
        // slower habit this rung exists to displace, and a rung that taught it
        // would be teaching the wrong strategy in the right place.
        const from = middle.slots["from"];
        const count = middle.slots["count"];
        assert.ok(from !== undefined && from.kind === "number", exercise.exerciseId);
        assert.ok(count !== undefined && count.kind === "count", exercise.exerciseId);
        const { first, second } = operands(exercise);
        if (bound.params.op === "add") {
          assert.ok(from.value.n >= BigInt(count.value), `${exercise.exerciseId}: counts on from the smaller addend`);
          assert.ok(
            ratEq(ratAdd(from.value, rational(BigInt(count.value))), answerOf(exercise)),
            exercise.exerciseId,
          );
        } else {
          assert.ok(ratEq(from.value, first), exercise.exerciseId);
          assert.equal(BigInt(count.value), second.n, exercise.exerciseId);
        }
        continue;
      }

      // The bridge: `toTen` lands exactly on ten and `rest` is what is left.
      const toTen = middle.slots["toTen"];
      const rest = middle.slots["rest"];
      assert.ok(toTen !== undefined && toTen.kind === "count", exercise.exerciseId);
      assert.ok(rest !== undefined && rest.kind === "count", exercise.exerciseId);
      assert.ok(toTen.value >= 1 && rest.value >= 1, `${exercise.exerciseId}: a bridge with a step of nothing`);
      const { first, second } = operands(exercise);
      assert.equal(BigInt(toTen.value + rest.value), second.n, `${exercise.exerciseId}: the bridge is not the part`);
      const landing = bound.params.op === "add" ? first.n + BigInt(toTen.value) : first.n - BigInt(toTen.value);
      assert.equal(landing, 10n, `${exercise.exerciseId}: the bridge does not land on ten`);
    }
  }
});

test("the parameter schema rejects the combinations no fact could satisfy", () => {
  const reject = (raw: unknown, pattern: RegExp): void => {
    const result = numberFactsParamSchema.validate(raw);
    assert.equal(result.ok, false, `expected a rejection of ${JSON.stringify(raw)}`);
    if (!result.ok) {
      assert.match(result.issues.map((issue) => `${issue.path}: ${issue.message}`).join("; "), pattern);
    }
  };

  assert.equal(numberFactsParamSchema.validate(params("add", 3, { includeZero: true, picture: true })).ok, true);

  reject(params("add", 5, { crossesTen: true }), /crossing ten reaches at least 11/);
  reject(params("add", 14), /does not cross ten reaches at most ten/);
  reject(params("add", 14, { crossesTen: true, includeZero: true }), /zero operand cannot cross ten/);
  reject(params("add", 14, { crossesTen: true, picture: true }), /does not fit in it/);
  reject({ op: "times", maxTotal: 5, crossesTen: false, includeZero: false, picture: false }, /op must be one of/);
  reject({ op: "add", maxTotal: 1, crossesTen: false, includeZero: false, picture: false }, /maxTotal must be 2/);
  reject({ op: "add", maxTotal: 19, crossesTen: true, includeZero: false, picture: false }, /maxTotal must be 2/);
});

test("the difficulty contribution is exact, ordered, and never a float", () => {
  const offset = (p: NumberFactsParams): Rational => numberFactsFamily.difficultyOffset(p);

  // Hundredths of a logit, exactly. A float `0.55` would make the last bits of
  // every `b` in this family platform-dependent.
  assert.equal(ratToString(offset(params("add", 3))), "0");
  assert.equal(ratToString(offset(params("add", 3, { includeZero: true, picture: true }))), "-9/20");
  assert.equal(ratToString(offset(params("sub", 3, { includeZero: true, picture: true }))), "-3/10");
  assert.equal(ratToString(offset(params("add", 18, { crossesTen: true }))), "13/10");

  // The one ordering the whole change exists to produce: every fact item sits
  // below the easiest column item in the graph, which is `43 + 25` at -0.90.
  const columnFloor = rational(-90n, 100n);
  const factLevels = addDomainNodes
    .filter((node) => node.generator.family === NUMBER_FACTS_FAMILY)
    .flatMap((node) => node.difficulty.levels);
  assert.ok(factLevels.length > 0);
  for (const level of factLevels) {
    assert.ok(
      ratToString(ratSub(level, columnFloor)).startsWith("-"),
      `a fact level at ${ratToString(level)} is not below the column floor ${ratToString(columnFloor)}`,
    );
  }
  const hardest = factLevels.reduce((a, c) => (ratToString(ratSub(c, a)).startsWith("-") ? a : c));
  process.stdout.write(`# number-facts: hardest fact level b = ${ratToString(hardest)}, column floor -9/10\n`);
});

test("the same seed produces the identical item, and different seeds do not all agree", () => {
  const p = params("sub", 18, { crossesTen: true });
  const first = serializeExercise(generate(p, 7));
  assert.equal(serializeExercise(generate(p, 7)), first);
  assert.equal(serializeExercise(generate(p, 7)), first);

  const distinct = new Set(Array.from({ length: 50 }, (_unused, i) => serializeExercise(generate(p, i + 1))));
  assert.ok(distinct.size > 20, `50 seeds produced only ${String(distinct.size)} distinct items`);
});

test("the prompt is a spec with typed slots, never a rendered sentence", () => {
  const exercise = generate(params("add", 18, { crossesTen: true }), 3);
  assert.equal(exercise.prompt.key, PROMPT_KEY_ADD);
  assert.deepEqual(Object.keys(exercise.prompt.slots).sort(), [SLOT_FIRST, SLOT_SECOND].sort());
  assert.equal(generate(params("sub", 18, { crossesTen: true }), 3).prompt.key, PROMPT_KEY_SUB);
});
