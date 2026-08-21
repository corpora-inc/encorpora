/**
 * `gen.arith.signed-int`, held to what a generator binding has to prove before a
 * row may be served to a child — and to one thing no other family in this package
 * has ever had to prove, which is that the sign is right.
 *
 * 1. **Every stated answer is correct, checked in the inverse direction.** Never
 *    by re-running the generator's own expression. An addition is checked by
 *    taking the second operand back off the answer, a subtraction by adding it
 *    back on, and a multiplication by *dividing* — three operations the family
 *    never performs.
 * 2. **The eight sign cases are named individually.** A property test over four
 *    hundred pairs passes if the family gets seven of the eight rules right and
 *    one of them backwards on a case the level table happens not to reach. The
 *    cases are written out with their answers, and each is looked up in the
 *    generator's own output rather than computed here.
 * 3. **The set is closed, exactly, and the draw over it is uniform** by χ². The
 *    uniformity is not decoration on this family: the on-ramp level draws from a
 *    *triangle*, and the obvious two-draw implementation of a triangle is
 *    lopsided by a factor of nineteen while passing every closure check.
 * 4. **Every item declares a signed answer schema**, and the set of skills that do
 *    is exactly `SIGNED_BLOCKED_SKILLS`. A signed answer behind an unsigned schema
 *    is a card drawn with a keypad that cannot express its answer.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  add as ratAdd,
  cmp as ratCmp,
  div as ratDiv,
  eq as ratEq,
  rational,
  sub as ratSub,
  toString as ratToString,
} from "../../math/rational.ts";
import type { Rational } from "../../math/rational.ts";
import { skillId } from "../../types/ids.ts";
import { schemaDefect } from "../../types/answer.ts";
import type { Exercise } from "../../types/exercise.ts";
import { serializeExercise } from "../../serialize.ts";
import { allNodes } from "../../graph/graph.ts";
import { SIGNED_BLOCKED_SKILLS } from "../../graph/promotionBlockers.ts";
import { answerRendererIdFor, findRenderer } from "../../render/registry.ts";
import { chiSquareUniform } from "../shared/uniformity.ts";
import { signedIntFamily } from "./family.ts";
import { pairSet } from "./pairs.ts";
import { signedIntParamSchema } from "./params.ts";
import type { SignedIntParams, SignedOp, SignPlacement } from "./params.ts";
import {
  PROMPT_KEY_ADD,
  PROMPT_KEY_MUL,
  PROMPT_KEY_SUB,
  SIGNED_INT_FAMILY,
  SLOT_FIRST,
  SLOT_SECOND,
  SOLUTION_KEY_ADD_THE_OPPOSITE,
  SOLUTION_KEY_DIFFERENT_SIGNS,
  SOLUTION_KEY_PAST_ZERO,
  SOLUTION_KEY_SAME_SIGNS,
  SOLUTION_KEY_SIGN_RULE,
} from "./constants.ts";

const SKILL = skillId("dw.int.arith.add-signed");
const FORMS = ["free-entry"];

/** Enough draws that a set of four hundred is collected several times over. */
const SEEDS = 6000;

function params(op: SignedOp, maxMagnitude: number, negatives: SignPlacement): SignedIntParams {
  return { op, maxMagnitude, negatives };
}

function generate(p: SignedIntParams, seed: number, level = 0): Exercise {
  return signedIntFamily.generate({ skillId: SKILL, level, seed, params: p, forms: FORMS });
}

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

const BOUND_LEVELS = allNodes
  .filter((node) => node.generator.family === SIGNED_INT_FAMILY)
  .flatMap((node) =>
    node.generator.params.map((raw, level) => {
      const validated = signedIntParamSchema.validate(raw);
      assert.ok(validated.ok, `${node.id} L${String(level)} params rejected`);
      return {
        label: `${node.id} L${String(level)}`,
        node,
        level,
        params: validated.ok ? validated.value : params("sub", 10, "none"),
        declared: node.generator.closedFactSet?.[level],
      };
    }),
  );

test("the graph binds this family, and every bound level declares its closed set", () => {
  assert.ok(BOUND_LEVELS.length >= 12, `only ${String(BOUND_LEVELS.length)} bound level(s)`);
  for (const bound of BOUND_LEVELS) {
    assert.ok(bound.declared !== undefined, `${bound.label} declares no closedFactSet`);
  }
  // All three operations, or a row is bound that the family cannot distinguish.
  const ops = new Set(BOUND_LEVELS.map((bound) => bound.params.op));
  assert.deepEqual([...ops].sort(), ["add", "mul", "sub"]);
  process.stdout.write(`# signed-int: ${String(BOUND_LEVELS.length)} bound level(s)\n`);
});

test("every stated answer is correct, re-derived from the prompt by the inverse operation", () => {
  let checked = 0;
  for (const bound of BOUND_LEVELS) {
    for (let seed = 1; seed <= SEEDS; seed++) {
      const exercise = generate(bound.params, seed, bound.level);
      const { first, second } = operands(exercise);
      const answer = answerOf(exercise);

      // Each of these is the operation the generator did *not* do, so a sign
      // dropped in one direction cannot be dropped identically in the other.
      const rebuilt =
        bound.params.op === "add"
          ? ratSub(answer, second)
          : bound.params.op === "sub"
            ? ratAdd(answer, second)
            : ratDiv(answer, second);
      assert.ok(
        ratEq(rebuilt, first),
        `${exercise.exerciseId}: ${ratToString(first)} ${bound.params.op} ${ratToString(second)} gave ` +
          `${ratToString(answer)}, which does not come back to ${ratToString(first)}`,
      );
      checked += 1;
    }
  }
  process.stdout.write(`# signed-int: ${String(checked)} answers re-derived by the inverse\n`);
});

/**
 * The eight rules, named, with the item each one is about.
 *
 * Each row is `[op, first, second, answer]`, and the item is **found in the
 * generator's output** rather than computed here: the level that could pose it is
 * drawn until the pair comes up, and its stated answer is compared with this
 * table. A test that computed the expected answer with the same rule the family
 * uses would agree with a family that had the rule backwards.
 */
const SIGN_CASES: readonly (readonly [SignedOp, SignPlacement, number, number, number])[] = [
  // The on-ramp: no minus on the card, one in the answer.
  ["sub", "none", 3, 9, -6],
  // Addition. Unlike signs take the smaller size from the larger and keep the
  // larger's sign; like signs add the sizes and keep it.
  ["add", "first", -7, 4, -3],
  ["add", "first", -4, 7, 3],
  ["add", "second", 7, -4, 3],
  ["add", "both", -7, -4, -11],
  // Subtraction. The second row is the one the whole domain turns on.
  ["sub", "first", -7, 4, -11],
  ["sub", "second", 7, -4, 11],
  ["sub", "both", -7, -4, -3],
  // Multiplication: count the minus signs.
  ["mul", "first", -6, 8, -48],
  ["mul", "both", -6, -8, 48],
];

test("the eight sign rules are right, each on an item the generator actually drew", () => {
  for (const [op, negatives, first, second, expected] of SIGN_CASES) {
    const magnitude = Math.max(Math.abs(first), Math.abs(second));
    const level = params(op, Math.max(magnitude, 10), negatives);
    let found: Exercise | undefined;
    for (let seed = 1; seed <= SEEDS && found === undefined; seed++) {
      const exercise = generate(level, seed);
      const drawn = operands(exercise);
      if (drawn.first.n === BigInt(first) && drawn.second.n === BigInt(second)) found = exercise;
    }
    assert.ok(
      found !== undefined,
      `no seed under ${String(SEEDS)} draws ${String(first)} ${op} ${String(second)} on a ${negatives} level`,
    );
    assert.equal(
      ratToString(answerOf(found)),
      String(expected),
      `${String(first)} ${op} ${String(second)} is ${String(expected)} and the item says ${ratToString(answerOf(found))}`,
    );
  }
  process.stdout.write(`# signed-int: ${String(SIGN_CASES.length)} named sign case(s) checked\n`);
});

test("every item is inside the band its level declares, and every operand has a sign", () => {
  for (const bound of BOUND_LEVELS) {
    const { maxMagnitude, negatives, op } = bound.params;
    for (let seed = 1; seed <= SEEDS; seed++) {
      const exercise = generate(bound.params, seed, bound.level);
      const { first, second } = operands(exercise);

      // Zero has no sign, so a signed item never has one as an operand: `(−0) + 4`
      // is a card with a lie on it and `0 × (−7)` is right whatever the child
      // believes about signs.
      assert.notEqual(first.n, 0n, `${exercise.exerciseId}: a zero operand`);
      assert.notEqual(second.n, 0n, `${exercise.exerciseId}: a zero operand`);
      const firstSize = first.n < 0n ? -first.n : first.n;
      const secondSize = second.n < 0n ? -second.n : second.n;
      assert.ok(firstSize <= BigInt(maxMagnitude), `${exercise.exerciseId}: first operand above the level`);
      assert.ok(secondSize <= BigInt(maxMagnitude), `${exercise.exerciseId}: second operand above the level`);

      // The placement is the level's declaration and never the draw's accident.
      const wantFirstNegative = negatives === "first" || negatives === "both";
      const wantSecondNegative = negatives === "second" || negatives === "both";
      assert.equal(first.n < 0n, wantFirstNegative, `${exercise.exerciseId}: the first sign is not the level's`);
      assert.equal(second.n < 0n, wantSecondNegative, `${exercise.exerciseId}: the second sign is not the level's`);
      if (negatives === "none") {
        // The whole content of the on-ramp: the answer is strictly below zero.
        assert.ok(op === "sub" && ratCmp(answerOf(exercise), rational(0n)) < 0, exercise.exerciseId);
      }

      assert.equal(schemaDefect(exercise.schema), null, exercise.exerciseId);
      assert.ok(exercise.schema.kind === "integer" && exercise.schema.signed === true, exercise.exerciseId);
      const size = answerOf(exercise).n < 0n ? -answerOf(exercise).n : answerOf(exercise).n;
      assert.ok(
        size.toString().length <= (exercise.schema.kind === "integer" ? exercise.schema.digits : 0),
        `${exercise.exerciseId}: the answer does not fit the field`,
      );
    }
  }
});

/**
 * The closure, against an enumeration written here and not imported.
 *
 * `pairSet` is the generator's own list, so asserting the generator against it
 * would prove only that the family calls the function it calls.
 */
function independentSet(p: SignedIntParams): Set<string> {
  const out = new Set<string>();
  const firstSign = p.negatives === "first" || p.negatives === "both" ? -1 : 1;
  const secondSign = p.negatives === "second" || p.negatives === "both" ? -1 : 1;
  for (let a = 1; a <= p.maxMagnitude; a++) {
    for (let b = 1; b <= p.maxMagnitude; b++) {
      // The on-ramp is the triangle where the answer lands below zero, and nothing
      // else; every other placement is the whole rectangle with signs written on.
      if (p.negatives === "none" && a >= b) continue;
      out.add(`${String(firstSign * a)}|${String(secondSign * b)}`);
    }
  }
  return out;
}

test("the set is closed, the generator reaches exactly it, and the draw is uniform", () => {
  const lines: string[] = [];
  for (const bound of BOUND_LEVELS) {
    const expected = independentSet(bound.params);
    assert.equal(
      pairSet(bound.params).length,
      expected.size,
      `${bound.label}: pairSet has ${String(pairSet(bound.params).length)} pairs, the rules give ${String(expected.size)}`,
    );
    assert.equal(
      bound.declared,
      expected.size,
      `${bound.label}: the row declares ${String(bound.declared)} and the mathematics has ${String(expected.size)}`,
    );

    const counts = new Map<string, number>([...expected].map((pair) => [pair, 0]));
    for (let seed = 1; seed <= SEEDS; seed++) {
      const { first, second } = operands(generate(bound.params, seed, bound.level));
      const key = `${first.n.toString()}|${second.n.toString()}`;
      assert.ok(counts.has(key), `${bound.label}: the generator reached ${key}, which is outside the closed set`);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    const missing = [...counts].filter(([, count]) => count === 0).map(([pair]) => pair);
    assert.deepEqual(missing.sort(), [], `${bound.label}: the generator never reached a pair in the closed set`);

    const uniformity = chiSquareUniform([...counts.values()]);
    assert.ok(
      uniformity.uniform,
      `${bound.label}: the draw is not uniform over its own set — χ² = ${ratToString(uniformity.chiSquare)} ` +
        `on ${String(uniformity.degreesOfFreedom)} degrees of freedom`,
    );
    lines.push(
      `#   ${bound.label}: ${String(expected.size)} pairs, all reached in ${String(SEEDS)} seeds, ` +
        `χ² ≈ ${String(Number(uniformity.chiSquare.n) / Number(uniformity.chiSquare.d))} on ${String(uniformity.degreesOfFreedom)} df`,
    );
  }
  process.stdout.write(`# closed signed sets:\n${lines.join("\n")}\n`);
});

test("the walkthrough names the move, and the move is the one the item needs", () => {
  const seen = new Set<string>();
  for (const bound of BOUND_LEVELS) {
    for (let seed = 1; seed <= 600; seed++) {
      const exercise = generate(bound.params, seed, bound.level);
      const { first, second } = operands(exercise);
      const steps = exercise.solution;
      const last = steps[steps.length - 1];
      assert.ok(last !== undefined);
      const stated = last.slots["answer"];
      assert.ok(stated !== undefined && stated.kind === "number", exercise.exerciseId);
      assert.ok(ratEq(stated.value, answerOf(exercise)), `${exercise.exerciseId}: the ladder ends elsewhere`);

      for (const step of steps) seen.add(String(step.key));

      if (bound.params.op === "sub" && bound.params.negatives === "none") {
        assert.equal(steps.length, 3, exercise.exerciseId);
        const past = steps[1]?.slots["past"];
        assert.equal(steps[1]?.key, SOLUTION_KEY_PAST_ZERO, exercise.exerciseId);
        assert.ok(past !== undefined && past.kind === "count", exercise.exerciseId);
        // Down to zero, then `past` further — and `past` is exactly how far below
        // zero the answer lands.
        assert.equal(BigInt(past.value), -answerOf(exercise).n, exercise.exerciseId);
        continue;
      }

      if (bound.params.op === "sub") {
        // Four rungs, because subtraction is two moves and a ladder that did both
        // in one step would hide the one the row exists to teach.
        assert.equal(steps.length, 4, exercise.exerciseId);
        assert.equal(steps[1]?.key, SOLUTION_KEY_ADD_THE_OPPOSITE, exercise.exerciseId);
        const opposite = steps[1]?.slots["opposite"];
        assert.ok(opposite !== undefined && opposite.kind === "number", exercise.exerciseId);
        assert.equal(opposite.value.n, -second.n, `${exercise.exerciseId}: the opposite is not the opposite`);
        continue;
      }

      if (bound.params.op === "mul") {
        assert.equal(steps[1]?.key, SOLUTION_KEY_SIGN_RULE, exercise.exerciseId);
        const negatives = steps[1]?.slots["negatives"];
        const size = steps[1]?.slots["size"];
        assert.ok(negatives !== undefined && negatives.kind === "count", exercise.exerciseId);
        assert.ok(size !== undefined && size.kind === "number", exercise.exerciseId);
        assert.equal(negatives.value, (first.n < 0n ? 1 : 0) + (second.n < 0n ? 1 : 0), exercise.exerciseId);
        // The size is the answer with the sign taken off, always.
        const answer = answerOf(exercise).n;
        assert.equal(size.value.n, answer < 0n ? -answer : answer, exercise.exerciseId);
        assert.equal(negatives.value % 2 === 1, answer < 0n, `${exercise.exerciseId}: the sign rule is backwards`);
        continue;
      }

      // Addition: the rung is decided by whether the signs agree, and nothing else.
      const alike = first.n < 0n === second.n < 0n;
      assert.equal(
        steps[1]?.key,
        alike ? SOLUTION_KEY_SAME_SIGNS : SOLUTION_KEY_DIFFERENT_SIGNS,
        `${exercise.exerciseId}: the wrong strategy rung for these signs`,
      );
      const larger = steps[1]?.slots["larger"];
      const smaller = steps[1]?.slots["smaller"];
      assert.ok(larger !== undefined && larger.kind === "number", exercise.exerciseId);
      assert.ok(smaller !== undefined && smaller.kind === "number", exercise.exerciseId);
      assert.ok(larger.value.n >= smaller.value.n, `${exercise.exerciseId}: the sizes are named the wrong way round`);
    }
  }
  // Every rung the family can emit is emitted by the level table the graph has.
  // A rung nobody reaches is a translated string nobody needs and an untested path.
  for (const key of [
    SOLUTION_KEY_PAST_ZERO,
    SOLUTION_KEY_ADD_THE_OPPOSITE,
    SOLUTION_KEY_SAME_SIGNS,
    SOLUTION_KEY_DIFFERENT_SIGNS,
    SOLUTION_KEY_SIGN_RULE,
  ]) {
    assert.ok(seen.has(String(key)), `no level in the graph ever emits ${key}`);
  }
});

test("the rows that answer below zero are exactly the ones promotionBlockers.ts names", () => {
  const signedSkills = new Set<string>();
  for (const bound of BOUND_LEVELS) {
    const schema = signedIntFamily.answerSchema(bound.params, "free-entry");
    if (schema.kind === "integer" && schema.signed === true) signedSkills.add(String(bound.node.id));
    // The whole point of the flag: CG-8 asks for a *different* renderer, and that
    // renderer is not built. A gate reading only `schema.kind` would let these rows
    // through behind the unsigned keypad.
    assert.equal(answerRendererIdFor(schema), "answer:integer-signed", bound.label);
  }
  assert.deepEqual([...signedSkills].sort(), [...SIGNED_BLOCKED_SKILLS].sort());

  const declared = findRenderer("answer:integer-signed");
  assert.ok(declared !== undefined, "the signed entry has no renderer declaration at all");
  assert.equal(
    declared.implemented,
    false,
    "answer:integer-signed is implemented — strike these rows off SIGNED_BLOCKED_SKILLS and promote them",
  );
  // And every one of those rows is still draft, which is what the blocker means.
  for (const id of SIGNED_BLOCKED_SKILLS) {
    const node = allNodes.find((candidate) => String(candidate.id) === id);
    assert.ok(node !== undefined, `${id} is named as blocked and is not in the graph`);
    assert.equal(node.status, "draft", `${id} is ${node.status} behind an entry surface that cannot write its answer`);
  }
});

test("the parameter schema rejects a level with no negative in it", () => {
  const reject = (raw: unknown, pattern: RegExp): void => {
    const result = signedIntParamSchema.validate(raw);
    assert.equal(result.ok, false, `expected a rejection of ${JSON.stringify(raw)}`);
    if (!result.ok) {
      assert.match(result.issues.map((issue) => `${issue.path}: ${issue.message}`).join("; "), pattern);
    }
  };

  assert.equal(signedIntParamSchema.validate(params("sub", 10, "none")).ok, true);
  reject(params("add", 10, "none"), /is not signed arithmetic/);
  reject(params("mul", 10, "none"), /is not signed arithmetic/);
  reject({ op: "div", maxMagnitude: 10, negatives: "first" }, /op must be one of/);
  reject({ op: "add", maxMagnitude: 21, negatives: "first" }, /maxMagnitude must be 5/);
  reject({ op: "add", maxMagnitude: 4, negatives: "first" }, /maxMagnitude must be 5/);
  reject({ op: "add", maxMagnitude: 10, negatives: "left" }, /negatives must be one of/);
});

test("the difficulty contribution is exact, ordered, and never a float", () => {
  const offset = (p: SignedIntParams): Rational => signedIntFamily.difficultyOffset(p);

  assert.equal(ratToString(offset(params("add", 10, "first"))), "1/5");
  assert.equal(ratToString(offset(params("sub", 10, "none"))), "3/20");
  assert.equal(ratToString(offset(params("mul", 12, "both"))), "13/20");

  // The ordering the coefficients claim, stated as comparisons rather than as
  // numbers so that a coefficient change has to keep the ordering or fail here.
  const at = (op: SignedOp, negatives: SignPlacement): Rational => offset(params(op, 10, negatives));
  assert.equal(ratCmp(at("add", "second"), at("add", "first")), 1, "a minus in the middle is not above a minus in front");
  assert.equal(ratCmp(at("add", "both"), at("add", "second")), 1);
  // And both placements together are below their sum: the two do not compound.
  assert.ok(ratCmp(at("add", "both"), ratAdd(at("add", "first"), at("add", "second"))) < 0);
  assert.equal(ratCmp(at("sub", "first"), at("add", "first")), 1, "subtraction is not above addition");
  assert.equal(ratCmp(at("sub", "first"), at("mul", "first")), 1, "multiplication is not below subtraction");
});

test("the same seed produces the identical item, and different seeds do not all agree", () => {
  const p = params("sub", 20, "both");
  const first = serializeExercise(generate(p, 11));
  assert.equal(serializeExercise(generate(p, 11)), first);
  assert.equal(serializeExercise(generate(p, 11)), first);

  const distinct = new Set(Array.from({ length: 50 }, (_unused, i) => serializeExercise(generate(p, i + 1))));
  assert.ok(distinct.size > 40, `50 seeds produced only ${String(distinct.size)} distinct items`);
});

test("the prompt is a spec with typed slots, and the sign rides on the value", () => {
  const sum = generate(params("add", 10, "first"), 3);
  assert.equal(sum.prompt.key, PROMPT_KEY_ADD);
  assert.deepEqual(Object.keys(sum.prompt.slots).sort(), [SLOT_FIRST, SLOT_SECOND].sort());
  // The minus is part of the number, not a separate slot and not a character in a
  // template: a renderer writes `(−7)` from the value, and a translator never sees
  // a sign to move.
  assert.ok(operands(sum).first.n < 0n);
  assert.equal(generate(params("sub", 10, "first"), 3).prompt.key, PROMPT_KEY_SUB);
  assert.equal(generate(params("mul", 10, "first"), 3).prompt.key, PROMPT_KEY_MUL);
});
