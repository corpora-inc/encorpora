/**
 * Property tests over **every bound level of every node, draft included**.
 *
 * This file exists because of an asymmetry that would otherwise be dangerous.
 * `dw-curriculum check` builds its sample from `activeNodes` only — deliberately,
 * so that draft rows cannot inflate any coverage number — and most of this graph is
 * draft, waiting on the prompt renderer that `render/prompts.ts` declares. Left
 * there, thirty rows and seven generator families would ship with **no gate having
 * ever run them**, and the promotion PR that flips `status` would be the first
 * thing to find out whether they work.
 *
 * So the measurements CG-9, CG-10, CG-11, CG-12, CG-16 and CG-17 make on the active
 * graph are made here on the whole of it, at the same thresholds, and the case
 * count is printed rather than claimed.
 *
 * Every invariant below is a statement about output, checked on every item:
 *
 *   1. seeded purity — the same seed twice is byte-identical
 *   2. distinct seeds are not all the same item
 *   3. the answer schema can be drawn (`schemaDefect`)
 *   4. the representation spec can be drawn (`repSpecDefect`)
 *   5. the prompt template has a registered renderer
 *   6. every emitted locale key is well formed
 *   7. the family's checker accepts its own answer and every `alsoAccept`
 *   8. the checker rejects every distractor, and no distractor is the answer
 *   9. a distractor's misconception is one the node declares
 *  10. no answer is negative, and no fraction answer has a zero denominator
 *  11. the level's variant space clears the node's own `minVariants`
 *  12. every mal-rule diverges from the correct answer on **every** item it applies
 *      to, and never returns `null` where it says it applies
 *  13. the generator invariants two mal-rules depend on, on every bound level
 *  14. every worked solution's rungs connect, and the last one states the answer
 *  15. `generate()` stays inside CG-17's p95 and p99 budgets
 */

import assert from "node:assert/strict";
import test from "node:test";

import { allNodes } from "../graph/graph.ts";
import { CG10_BLOCKED_LEVELS } from "../graph/promotionBlockers.ts";
import { familyById } from "./registry.ts";
import { malRules } from "../malrules/registry.ts";
import { fingerprintItem, serializeExercise } from "../serialize.ts";
import { answerAccepted, fractionRational, schemaDefect } from "../types/answer.ts";
import type { AnswerValue } from "../types/answer.ts";
import type { Exercise, PromptSlot } from "../types/exercise.ts";
import { LOC_KEY_PATTERN } from "../types/ids.ts";
import { cmp, eq as rationalEq, rational } from "../math/rational.ts";
import type { Rational } from "../math/rational.ts";
import { findPromptTemplate, promptRegistry } from "../render/prompts.ts";
import { repSpecDefect } from "../render/representations.ts";
import { operandValue, readComparePair } from "./compareOrder/read.ts";
import { PROMPT_KEY_TO_IMPROPER, SLOT_FRACTION } from "./fracEquivalence/constants.ts";
import {
  FRAC_ARITH_FAMILY,
  SLOT_ANSWER as FRAC_SLOT_ANSWER,
  SLOT_COMBINED as FRAC_SLOT_COMBINED,
  SOLUTION_KEY_RESULT as FRAC_SOLUTION_KEY_RESULT,
  SOLUTION_KEY_SIMPLIFY as FRAC_SOLUTION_KEY_SIMPLIFY,
} from "./fracArith/constants.ts";

/**
 * Seeds per level. Chosen so the variant-space measurement means something — the
 * duplicate-rate estimator needs a sample well above the floor it is testing — and
 * so the whole sweep still runs inside a PR job.
 */
const SEEDS_PER_LEVEL = 500;

/** CG-10's floor, restated so the sweep can name the levels that do not clear it. */
const VARIANT_SPACE_FLOOR = 975;

/** CG-17's budgets, restated here so the draft rows are held to them too. */
const P95_BUDGET_NS = 5_000_000n;
const P99_BUDGET_NS = 20_000_000n;

type Level = {
  readonly label: string;
  readonly nodeId: string;
  readonly level: number;
  readonly status: string;
  readonly minVariants: number;
  /** The level's whole problem space, where it is closed. See `GeneratorBinding`. */
  readonly closedFactSet: number | undefined;
  readonly declared: ReadonlySet<string>;
  readonly exercises: readonly Exercise[];
  readonly timingsNs: readonly bigint[];
};

/** Generate the whole graph once. Every test below reads the same draw. */
function sweep(): Level[] {
  const levels: Level[] = [];

  for (const node of allNodes) {
    if (node.status === "deprecated") continue;
    const family = familyById(node.generator.family);
    assert.ok(family !== undefined, `${node.id} binds unregistered family ${node.generator.family}`);

    node.generator.params.forEach((params, level) => {
      const validated = family.paramSchema.validate(params);
      assert.ok(
        validated.ok,
        `${node.id} L${String(level)} params rejected: ${
          validated.ok ? "" : validated.issues.map((i) => `${i.path}: ${i.message}`).join("; ")
        }`,
      );
      if (!validated.ok) return;

      const exercises: Exercise[] = [];
      const timingsNs: bigint[] = [];
      for (let seed = 1; seed <= SEEDS_PER_LEVEL; seed++) {
        const started = process.hrtime.bigint();
        const exercise = family.generate({
          skillId: node.id,
          level,
          seed,
          params: validated.value,
          forms: node.generator.forms,
        });
        timingsNs.push(process.hrtime.bigint() - started);
        exercises.push(exercise);
      }

      levels.push({
        label: `${node.id} L${String(level)}`,
        nodeId: node.id,
        level,
        status: node.status,
        minVariants: node.generator.minVariants,
        closedFactSet: node.generator.closedFactSet?.[level],
        declared: new Set(node.misconceptions.map(String)),
        exercises,
        timingsNs,
      });
    });
  }

  return levels;
}

const LEVELS = sweep();
const ALL_ITEMS: readonly Exercise[] = LEVELS.flatMap((level) => [...level.exercises]);

/**
 * The exact value a prompt slot writes, or `null` for a slot that writes no number.
 *
 * Values and not kinds: a worked solution states its result as whatever slot the
 * renderer needs, and the last rung of a `columnAlgorithm` item writes a plain
 * number. Asking "is this the same number" is the question; asking "is this the
 * same kind of answer value" would fail on that item for no reason.
 */
function slotValue(slot: PromptSlot | undefined): Rational | null {
  if (slot === undefined) return null;
  switch (slot.kind) {
    case "number":
      return slot.value;
    case "count":
      return rational(BigInt(slot.value));
    case "fraction":
      return fractionRational({ kind: "fraction", num: slot.num, den: slot.den, ...(slot.whole === undefined ? {} : { whole: slot.whole }) });
    case "term":
      return null;
  }
}

/** The exact value of an answer, or `null` for a choice index, which is not one. */
function answerValue(value: AnswerValue): Rational | null {
  switch (value.kind) {
    case "integer":
    case "columnAlgorithm":
      return value.value;
    case "fraction":
      return fractionRational(value);
    case "choice":
      return null;
  }
}

test("sweep: the case count is measured, not asserted from memory", () => {
  const activeLevels = LEVELS.filter((level) => level.status === "active").length;
  const draftLevels = LEVELS.filter((level) => level.status === "draft").length;
  process.stdout.write(
    `# sweep: ${String(ALL_ITEMS.length)} generated cases over ${String(LEVELS.length)} levels ` +
      `(${String(activeLevels)} active, ${String(draftLevels)} draft) at ${String(SEEDS_PER_LEVEL)} seeds each\n`,
  );
  // A sweep that silently generated nothing would pass every test below.
  assert.equal(ALL_ITEMS.length, LEVELS.length * SEEDS_PER_LEVEL);
  assert.ok(LEVELS.length > 100, `expected the whole graph, got ${String(LEVELS.length)} levels`);
});

test("sweep: the same seed produces the identical exercise, every time", () => {
  let checked = 0;
  for (const level of LEVELS) {
    const node = allNodes.find((candidate) => candidate.id === level.nodeId);
    assert.ok(node !== undefined);
    const family = familyById(node.generator.family);
    assert.ok(family !== undefined);
    const validated = family.paramSchema.validate(node.generator.params[level.level]);
    if (!validated.ok) continue;

    // Ten seeds per level rather than five hundred: purity is a property of the
    // generator, not of the seed, and re-running the whole sweep twice would
    // double a job that has to fit in ninety seconds.
    for (const exercise of level.exercises.slice(0, 10)) {
      const again: Exercise = family.generate({
        skillId: node.id,
        level: exercise.level,
        seed: exercise.seed,
        params: validated.value,
        forms: node.generator.forms,
      });
      assert.equal(serializeExercise(again), serializeExercise(exercise), `${level.label} seed ${String(exercise.seed)}`);
      checked += 1;
    }
  }
  assert.ok(checked > 0);
});

test("sweep: every item is drawable — schema, representation, prompt and locale keys", () => {
  for (const level of LEVELS) {
    for (const exercise of level.exercises) {
      const defect = schemaDefect(exercise.schema);
      assert.equal(defect, null, `${exercise.exerciseId}: ${defect ?? ""}`);

      if (exercise.representation !== undefined) {
        const repDefect = repSpecDefect(exercise.representation.rep, exercise.representation.params);
        assert.equal(repDefect, null, `${exercise.exerciseId}: ${repDefect ?? ""}`);
      }

      assert.ok(
        findPromptTemplate(exercise.prompt.key) !== undefined,
        `${exercise.exerciseId}: prompt template ${exercise.prompt.key} is not in the prompt registry`,
      );

      assert.match(exercise.prompt.key, LOC_KEY_PATTERN, exercise.exerciseId);
      for (const slot of Object.values(exercise.prompt.slots)) {
        if (slot.kind === "term") assert.match(slot.key, LOC_KEY_PATTERN, exercise.exerciseId);
      }
      for (const step of exercise.solution) {
        assert.match(step.key, LOC_KEY_PATTERN, exercise.exerciseId);
      }
      // A worked solution that ends before the answer is a hint ladder with no
      // bottom rung: the last step of every family states the result.
      assert.ok(exercise.solution.length >= 2, `${exercise.exerciseId}: solution has no ladder`);
    }
  }
});

test("sweep: the prompt registry is closed in both directions", () => {
  // One direction is asserted on every item above: a template the graph emits is
  // registered, or a card draws its answer entry with no question above it. This
  // is the other one, and it is the shape the consuming side's half of CG-8 takes
  // too: a declaration nobody satisfies is a lie, and a `PR-2.13` line item for a
  // template no level produces is work nobody needs.
  const emitted = new Set(ALL_ITEMS.map((exercise) => String(exercise.prompt.key)));
  const declared = promptRegistry.map((entry) => String(entry.id));
  assert.deepEqual(
    declared.filter((id) => !emitted.has(id)),
    [],
    "prompt templates are declared that no bound level emits",
  );
  assert.equal(new Set(declared).size, declared.length, "a prompt template is declared twice");
  process.stdout.write(`# prompt registry: ${String(declared.length)} template(s), all emitted\n`);
});

test("sweep: the checker agrees with its own output, and rejects every distractor", () => {
  for (const level of LEVELS) {
    const node = allNodes.find((candidate) => candidate.id === level.nodeId);
    assert.ok(node !== undefined);
    const family = familyById(node.generator.family);
    assert.ok(family !== undefined);

    for (const exercise of level.exercises) {
      assert.ok(family.check(exercise, exercise.answer.canonical).correct, `${exercise.exerciseId}: canonical rejected`);
      for (const accepted of exercise.answer.alsoAccept) {
        assert.ok(family.check(exercise, accepted).correct, `${exercise.exerciseId}: alsoAccept rejected`);
      }
      for (const distractor of exercise.distractors) {
        assert.ok(
          !answerAccepted(exercise.schema, exercise.answer.canonical, distractor.value),
          `${exercise.exerciseId}: a distractor counts as the answer`,
        );
        assert.ok(!family.check(exercise, distractor.value).correct, `${exercise.exerciseId}: checker accepts a distractor`);
        if (distractor.misconception !== undefined) {
          assert.ok(
            level.declared.has(String(distractor.misconception)),
            `${level.label} emits ${String(distractor.misconception)}, which the node does not declare`,
          );
        }
      }
    }
  }
});

/**
 * Negativity, and the one place in this sweep where an absolute claim became a
 * conditional one.
 *
 * This test asserted that **no** answer in the graph is below zero, and that was
 * true of every item the program had until integers arrived. The claim worth
 * making now is the one a renderer depends on: an answer is below zero only where
 * the item's own schema says it may be, because `AnswerSchema.integer.signed` is
 * what tells an entry surface to offer a minus key. An item that answers `−3`
 * behind an unsigned schema is a card a child cannot answer correctly, and it
 * would reach them looking perfectly ordinary.
 *
 * The converse is **not** asserted, and the reason is worth writing down because
 * the obvious symmetric test is wrong. `(−7) × (−4)` and `7 − (−4)` are signed
 * items whose answers are all positive, and two levels of the graph are entirely
 * made of them. If those levels dropped the flag, the keypad would lose its minus
 * key on exactly the levels where the answer is never negative — which tells a
 * child the sign of the answer before they have worked it out, the same leak
 * `answerDigits` exists to avoid. So the flag is a property of the **node**, and
 * that is what is checked instead: all of a node's levels or none of them.
 */
test("sweep: an answer is negative only where its schema says it may be", () => {
  const signedByNode = new Map<string, Set<boolean>>();
  let negativeItems = 0;

  for (const level of LEVELS) {
    for (const exercise of level.exercises) {
      const signed = exercise.schema.kind === "integer" && exercise.schema.signed === true;
      const seen = signedByNode.get(level.nodeId) ?? new Set<boolean>();
      seen.add(signed);
      signedByNode.set(level.nodeId, seen);

      const answer = exercise.answer.canonical;
      if (answer.kind !== "integer" && answer.kind !== "columnAlgorithm") continue;
      if (answer.value.n >= 0n) continue;
      negativeItems += 1;
      assert.ok(
        signed,
        `${exercise.exerciseId}: answers ${String(answer.value.n)} behind a schema that does not declare it signed — ` +
          `a keypad with no minus key would draw this card and mark a correct child wrong`,
      );
    }
  }

  for (const [nodeId, seen] of signedByNode) {
    assert.equal(
      seen.size,
      1,
      `${nodeId} declares a signed answer schema on some of its levels and not others: the keypad would gain and ` +
        `lose its minus key as a child climbs, which says what sign the answer has before they have found it`,
    );
  }

  const signedNodes = [...signedByNode].filter(([, seen]) => seen.has(true)).map(([id]) => id);
  // A vacuity guard. Every assertion above passes on a graph with no signed item
  // in it, which is what this file measured before integers existed.
  assert.ok(negativeItems > 0, "no item in the whole graph answers below zero");
  process.stdout.write(
    `# signed answers: ${String(signedNodes.length)} node(s) declare a signed schema, ` +
      `${String(negativeItems)} item(s) answer below zero\n`,
  );
});

test("sweep: no fraction answer has a zero denominator", () => {
  for (const exercise of ALL_ITEMS) {
    const answer = exercise.answer.canonical;
    if (answer.kind === "fraction") {
      assert.ok(answer.den > 0n, `${exercise.exerciseId}: non-positive denominator`);
      assert.ok(answer.num >= 0n, `${exercise.exerciseId}: negative numerator`);
      assert.ok((answer.whole ?? 0n) >= 0n, `${exercise.exerciseId}: negative whole part`);
      assert.ok(
        answer.num < answer.den || answer.whole === undefined,
        `${exercise.exerciseId}: a mixed number with an improper fraction part`,
      );
    }
  }
});

test("sweep: every level clears its own minVariants, and the sub-floor levels are named", () => {
  const report: string[] = [];
  const belowFloor: string[] = [];

  for (const level of LEVELS) {
    const distinct = new Set(level.exercises.map(fingerprintItem)).size;
    const collisions = level.exercises.length - distinct;
    const estimate =
      collisions === 0
        ? Math.floor((level.exercises.length * level.exercises.length) / 2)
        : Math.floor((level.exercises.length * level.exercises.length) / (2 * collisions));
    report.push(`#   ${level.label}: ${String(distinct)} distinct, ~${String(estimate)} variants`);
    assert.ok(
      distinct >= level.minVariants,
      `${level.label}: ${String(distinct)} distinct items over ${String(level.exercises.length)} seeds, below minVariants ${String(level.minVariants)}`,
    );
    // A level whose problem space is closed is measured against its own
    // declaration rather than against the floor, for the reason set out on
    // `GeneratorBinding.closedFactSet`: on thirty-six additions within ten a
    // repeat is retrieval practice, not a shallow draw. The substituted check is
    // the sharper one — it fails on a generator that reaches a thirty-seventh.
    if (level.closedFactSet !== undefined) {
      assert.ok(
        distinct <= level.closedFactSet,
        `${level.label}: ${String(distinct)} distinct items, above the declared closed fact set of ${String(level.closedFactSet)}`,
      );
      continue;
    }
    if (estimate < VARIANT_SPACE_FLOOR) {
      // The measured count leads and the estimate follows, because only one of the
      // two is a measurement. `N²/2C` is optimistic at high collision rates and the
      // gap is not small: `dw.alg.equality.missing-addend` L0 draws both operands
      // from 1..9 and its true space is exactly 81 items — pinned in
      // `families.test.ts` — where the estimator reads ~298. A reader sizing the
      // work on these rows has to see the number that was counted.
      belowFloor.push(
        `${level.label} (${String(distinct)} distinct in ${String(level.exercises.length)} draws, estimated ~${String(estimate)})`,
      );
    }
  }

  process.stdout.write(`# variant space, per level:\n${report.join("\n")}\n`);

  // Named, not failed. CG-10's floor of 975 is derived from a 40-item practice run
  // repeating no more than one item in fifty, and some content genuinely has fewer
  // problems than that in the world: single-digit missing addends are 81 items,
  // proper fractions with a denominator under 25 are 276. The floor and the
  // content are in real conflict and it is not a generator's job to resolve it by
  // padding the estimator, so the sweep prints the list and the promotion PR for
  // any of these rows has to reconcile it with whoever owns CG-10.
  process.stdout.write(
    belowFloor.length === 0
      ? `# every level clears CG-10's floor of ${String(VARIANT_SPACE_FLOOR)}\n`
      : `# ${String(belowFloor.length)} level(s) below CG-10's floor of ${String(VARIANT_SPACE_FLOOR)} — none is active, and none may be promoted without reconciling it:\n#   ${belowFloor.join("\n#   ")}\n`,
  );

  // Both directions, against the authored list. A printed list is a thing a reader
  // has to go and find in a test log; `promotionBlockers.ts` is a thing a promotion
  // PR reads first, and this is what keeps the two from drifting. A level that
  // slips under the floor has to be added there, and a generator widened past it
  // has to be struck off.
  assert.deepEqual(
    belowFloor.map((line) => line.slice(0, line.indexOf(" ("))).sort(),
    [...CG10_BLOCKED_LEVELS].sort(),
    "the levels under CG-10's floor and promotionBlockers.ts disagree",
  );

  // The one thing that must never silently become true: an *active* level under
  // the floor. CG-10 would fail on it, and this says so first and by name.
  const activeBelow = LEVELS.filter((level) => level.status === "active").filter((level) => {
    if (level.closedFactSet !== undefined) return false;
    const distinct = new Set(level.exercises.map(fingerprintItem)).size;
    const collisions = level.exercises.length - distinct;
    if (collisions === 0) return false;
    return Math.floor((level.exercises.length * level.exercises.length) / (2 * collisions)) < VARIANT_SPACE_FLOOR;
  });
  assert.deepEqual(
    activeBelow.map((level) => level.label),
    [],
    "an active level is below CG-10's variant-space floor",
  );
});

/**
 * Divergence, at the bar the rules actually claim: **every** item, not 95% of them.
 *
 * CG-12 ships a 95% floor and that is the right floor for a graph that may one day
 * carry an approximate rule. Every rule in this registry claims more than that —
 * each docstring argues the buggy procedure cannot land on the correct answer on an
 * item it is defined on — and a band two points wide would let a regression
 * classify a correct answer as a diagnosed misconception on one item in twenty and
 * still ship green. It is not hypothetical: removing the denominator-ten exclusion
 * from `fracEquivalence`'s `to-improper` draw takes
 * `mis.frac.mixed-number-concatenation` to 1426/1500 — 74 correct answers
 * misclassified — which clears 95% comfortably. So the sweep asserts what the rules
 * claim, and the two guards below hold up the two rules whose guarantee comes from
 * the generator's content rather than from the arithmetic of `applies()`.
 *
 * Divergence is measured with `answerAccepted` and not `answerEquals`, because
 * `answerAccepted` is what the child is judged with: on a schema that takes any
 * equivalent fraction, a mal-rule output of `2/4` against a canonical `1/2` is
 * *not* a wrong answer, however differently it is written. `distractorsFor` has
 * always used this comparison; the gate and this sweep now match it.
 */
test("sweep: every mal-rule diverges from the correct answer on every item it applies to", () => {
  const lines: string[] = [];
  for (const rule of malRules) {
    let applicable = 0;
    let divergent = 0;

    for (const exercise of ALL_ITEMS) {
      if (exercise.family !== rule.family) continue;
      if (!rule.applies(exercise)) continue;
      applicable += 1;
      const produced = rule.apply(exercise);
      assert.ok(produced !== null, `${rule.id}: applies() is true and apply() returned null on ${exercise.exerciseId}`);
      if (!answerAccepted(exercise.schema, exercise.answer.canonical, produced)) divergent += 1;
    }

    assert.ok(applicable > 0, `${rule.id}: no item in the whole graph triggers this rule`);
    assert.equal(
      divergent,
      applicable,
      `${rule.id}: reproduces the correct answer on ${String(applicable - divergent)} of ${String(applicable)} applicable items`,
    );
    lines.push(`#   ${rule.id}: ${String(divergent)}/${String(applicable)} divergent`);
  }
  process.stdout.write(`# mal-rule fidelity:\n${lines.join("\n")}\n`);
});

/**
 * The two generator invariants a mal-rule's correctness rests on, asserted on every
 * bound level rather than on one hand-picked param table.
 *
 * `mis.frac.mixed-number-concatenation` and `mis.dec.longer-is-bigger` both have an
 * `applies()` that is true on items where the rule would be *right*, and are held
 * up by a decision inside the generator instead: the denominator ten is never drawn
 * for a `to-improper` item (`w n/10` written as `wn/10` **is** the correct improper
 * fraction, since `w × 10 + n` is exactly the concatenation), and a decimal
 * comparison always writes the longer number as the smaller one. Neither predicate
 * can be tightened without asking about the answer, which the mal-rule contract
 * forbids — so the coupling is tested here and named from both docstrings.
 */
test("sweep: the generator invariants that hold up two mal-rules", () => {
  let improperItems = 0;
  let decimalItems = 0;

  for (const exercise of ALL_ITEMS) {
    if (exercise.prompt.key === PROMPT_KEY_TO_IMPROPER) {
      const shown: PromptSlot | undefined = exercise.prompt.slots[SLOT_FRACTION];
      assert.ok(shown !== undefined && shown.kind === "fraction", exercise.exerciseId);
      assert.notEqual(
        shown.den,
        10n,
        `${exercise.exerciseId}: a to-improper item on tenths — writing the whole part in front of the numerator is the correct answer, and mis.frac.mixed-number-concatenation would be right`,
      );
      improperItems += 1;
    }

    const pair = readComparePair(exercise);
    if (pair === null || pair.left.kind !== "number" || pair.right.kind !== "number") continue;
    if (pair.left.decimalPlaces === pair.right.decimalPlaces) continue;
    const longer = pair.left.decimalPlaces > pair.right.decimalPlaces ? pair.left : pair.right;
    const shorter = longer === pair.left ? pair.right : pair.left;
    assert.ok(
      cmp(operandValue(longer), operandValue(shorter)) < 0,
      `${exercise.exerciseId}: the longer-written decimal is not the smaller number, and mis.dec.longer-is-bigger would be right`,
    );
    decimalItems += 1;
  }

  assert.ok(improperItems > 0, "no to-improper item in the whole graph");
  assert.ok(decimalItems > 0, "no unequal-length decimal comparison in the whole graph");
  process.stdout.write(
    `# generator invariants: ${String(improperItems)} to-improper item(s) off tenths, ` +
      `${String(decimalItems)} decimal comparison(s) with the longer number smaller\n`,
  );
});

/**
 * The hint ladder has no gaps: every rung follows from the one above it.
 *
 * Two claims, and the second is the one that was broken. Every family's last rung
 * states the canonical answer — a walkthrough that stops short is a ladder with no
 * bottom rung. And in `gen.frac.arith`, where the combining rung writes a result
 * over the common denominator and the answer is always reduced, the simplifying
 * rung is present exactly when those two written forms differ. It used to be gated
 * on `params.lowestTerms`, so the levels that do *not* teach simplifying — ten of
 * the fifteen in the graph — jumped from `4/6` straight to `2/3` with nothing in
 * between, on a fifth to a third of their items.
 */
test("sweep: every worked solution's last rung is the answer, and no rung is unexplained", () => {
  let fracItems = 0;
  let withSimplify = 0;

  for (const exercise of ALL_ITEMS) {
    const last = exercise.solution[exercise.solution.length - 1];
    assert.ok(last !== undefined, `${exercise.exerciseId}: no solution`);
    const stated = slotValue(last.slots["answer"]);
    const canonical = answerValue(exercise.answer.canonical);
    if (stated !== null && canonical !== null) {
      assert.ok(
        rationalEq(stated, canonical),
        `${exercise.exerciseId}: the last solution rung states a different number from the answer`,
      );
    }

    if (exercise.family !== FRAC_ARITH_FAMILY) continue;
    fracItems += 1;
    assert.equal(last.key, FRAC_SOLUTION_KEY_RESULT, exercise.exerciseId);

    const combinedStep = exercise.solution.find((step) => step.slots[FRAC_SLOT_COMBINED] !== undefined);
    assert.ok(combinedStep !== undefined, `${exercise.exerciseId}: no combining rung`);
    const combined = combinedStep.slots[FRAC_SLOT_COMBINED];
    assert.ok(combined !== undefined && combined.kind === "fraction", exercise.exerciseId);
    const answer: PromptSlot | undefined = last.slots[FRAC_SLOT_ANSWER];
    assert.ok(answer !== undefined && answer.kind === "fraction", exercise.exerciseId);

    const rewritten = combined.num !== answer.num || combined.den !== answer.den;
    const simplifies = exercise.solution.some((step) => step.key === FRAC_SOLUTION_KEY_SIMPLIFY);
    assert.equal(
      simplifies,
      rewritten,
      rewritten
        ? `${exercise.exerciseId}: the ladder writes ${String(combined.num)}/${String(combined.den)} and then states ${String(answer.num)}/${String(answer.den)} with no rung between them`
        : `${exercise.exerciseId}: a simplifying rung on an item that needs no simplifying`,
    );
    if (simplifies) withSimplify += 1;
  }

  process.stdout.write(
    `# hint ladders: ${String(fracItems)} gen.frac.arith item(s), ${String(withSimplify)} with a simplifying rung\n`,
  );
});

test("sweep: generate() stays inside CG-17's budget on the draft rows too", () => {
  const timings = LEVELS.flatMap((level) => [...level.timingsNs]).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const at = (percentile: number): bigint => {
    const rank = Math.floor((percentile * timings.length + 99) / 100);
    return timings[Math.min(timings.length - 1, Math.max(0, rank - 1))] ?? 0n;
  };
  const p95 = at(95);
  const p99 = at(99);
  process.stdout.write(
    `# generate(): ${String(timings.length)} calls, p95 ${String(p95 / 1000n)} µs, p99 ${String(p99 / 1000n)} µs\n`,
  );
  assert.ok(p95 < P95_BUDGET_NS, `p95 ${String(p95)} ns exceeds the budget`);
  assert.ok(p99 < P99_BUDGET_NS, `p99 ${String(p99)} ns exceeds the budget`);
});
