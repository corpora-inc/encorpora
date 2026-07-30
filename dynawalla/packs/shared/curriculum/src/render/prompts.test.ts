/**
 * The prompt registry, the operator a question is written with, and whether the
 * question a card states is the question its answer answers.
 *
 * ## Why this file exists
 *
 * `dynawalla-app/src/packs/items.ts` is the only thing in this repository that
 * turns an `Exercise` into a string a child reads, and `packs/shared/game-host`
 * hands that string to a game unchanged. It used to pick the operator like this:
 *
 * ```ts
 * export function isSubtraction(promptKey: string): boolean {
 *   return promptKey === PROMPT_KEY_SUB || promptKey.endsWith(".sub")
 * }
 * // …
 * prompt: `${top} ${subtract ? MINUS : "+"} ${bottom}`,
 * ```
 *
 * So every template that was not a subtraction was drawn as an **addition**: right
 * for the four templates the graph had active and wrong for eleven others, and the
 * failure it produced is the worst shape this program has —
 * `dw.mul.facts.tables-to-twelve` reached a child as `5 + 7`, read perfectly, was
 * answerable, and marked 12 wrong. It reads `promptOperator(key)` now, and the
 * assertion that it does lives in `items.test.ts`, where the renderer is.
 *
 * ## What this file checks instead
 *
 * The claim underneath the operator, which the operator fix does not make true:
 * **the string a game draws states the question the answer answers**. That is
 * checkable from here without the app, because it is arithmetic.
 *
 * It used to be checked by applying the declared operator to the two operands the host
 * would read and comparing the result with the canonical answer, and that reading is
 * now the `blank: "none"` case of a wider one. `render/prompts.ts` also declares
 * **where the box sits** (`PromptBlank`), so the check writes the statement out,
 * substitutes the canonical answer for the box, and compares the two sides of the
 * equation: `47 + □ = 68` claims `47 + 21 = 68` and `□ × 15 = 165` claims
 * `11 × 15 = 165`. Both are true, and there is no product of two numerals in the
 * second one to have compared with anything.
 *
 * What disagrees is `MISSTATED_QUESTION_TEMPLATES`, asserted in both directions so it
 * cannot go stale as families are added, and it is down to one entry:
 * `dw.prompt.long-div.remainder`, whose answer is not the box in `129 ÷ 2 = □`.
 *
 * The `alg` rows are no longer here. Four of the five are still draft and this file
 * asserts `PACK_STATEMENT_BLOCKED_SKILLS` instead — a question the host can state is
 * not one every pack that declares it can draw, and that is measured against the packs
 * rather than against arithmetic.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { allNodes } from "../graph/graph.ts";
import {
  FRACTION_ANSWER_BLOCKED_SKILLS,
  MISSTATED_QUESTION_TEMPLATES,
  NUMERAL_WIDTH_BLOCKED_LEVELS,
  NUMERAL_WIDTH_BLOCKED_SKILLS,
  PACK_STATEMENT_BLOCKED_SKILLS,
  SHIPPED_NUMERAL_MAX_CHARS,
} from "../graph/promotionBlockers.ts";
import { familyById } from "../generators/registry.ts";
import * as rational from "../math/rational.ts";
import type { Rational } from "../math/rational.ts";
import type { AnswerValue } from "../types/answer.ts";
import type { PromptSlot } from "../types/exercise.ts";
import { findPromptTemplate, promptBlank, promptOperator, promptRegistry } from "./prompts.ts";
import type { PromptBlank, PromptOperator } from "./prompts.ts";

/**
 * The two operands the host reads, in the order it reads them.
 *
 * Transcribed from `operandsOf` in `dynawalla-app/src/packs/items.ts` — named slots
 * when a family declares `top`/`bottom`, declaration order otherwise. Reproduced
 * rather than imported because the curriculum cannot depend on the app, and a
 * transcription that drifts is caught by the next person to read either file, where
 * skipping the question entirely is caught by nobody.
 */
function operandsTheHostWouldRead(slots: Readonly<Record<string, PromptSlot>>): readonly (Rational | null)[] {
  const named = [slots["top"], slots["bottom"]];
  const chosen = named.every((slot) => slot !== undefined) ? named : Object.values(slots);
  return chosen.map((slot) => slotValue(slot));
}

/** A slot as a number, or `null` for a slot that is not one (a `term`). */
function slotValue(slot: PromptSlot | undefined): Rational | null {
  if (slot === undefined) return null;
  if (slot.kind === "number") return slot.value;
  if (slot.kind === "count") return rational.rational(BigInt(slot.value));
  if (slot.kind === "fraction") {
    const written = rational.rational(slot.num, slot.den);
    return slot.whole === undefined || slot.whole === 0n
      ? written
      : rational.add(rational.rational(slot.whole), written);
  }
  return null;
}

/** The canonical answer as one number, or `null` when it is not one. */
function answerValue(answer: AnswerValue): Rational | null {
  if (answer.kind === "integer" || answer.kind === "columnAlgorithm") return answer.value;
  if (answer.kind === "fraction") {
    const written = rational.rational(answer.num, answer.den);
    return answer.whole === undefined || answer.whole === 0n
      ? written
      : rational.add(rational.rational(answer.whole), written);
  }
  return null;
}

function apply(operator: Exclude<PromptOperator, "none">, a: Rational, b: Rational): Rational {
  if (operator === "+") return rational.add(a, b);
  if (operator === "−") return rational.sub(a, b);
  if (operator === "×") return rational.mul(a, b);
  return rational.div(a, b);
}

/**
 * The statement as a child reads it. A transcription of `drawStatement` in
 * `dynawalla-app/src/packs/items.ts`, for failure messages only — the curriculum
 * cannot import the app, and a message that named the operands without saying where
 * the box was would be a message nobody could act on.
 */
function drawn(
  operator: Exclude<PromptOperator, "none">,
  blank: PromptBlank,
  a: Rational,
  b: Rational,
): string {
  const left = rational.toString(a);
  const right = rational.toString(b);
  if (blank === "first") return `□ ${operator} ${left} = ${right}`;
  if (blank === "second") return `${left} ${operator} □ = ${right}`;
  return `${left} ${operator} ${right}`;
}

/**
 * The statement a card makes, written out in exact rationals, with the canonical
 * answer already substituted for the blank.
 *
 * Returns the two sides of the claim the card is making, so the caller compares them
 * rather than comparing an expression with an answer. That is what generalises the
 * check across the blank positions:
 *
 * - `none` — the card says `a OP b` and the claim is `a OP b = answer`.
 * - `second` — the card says `a OP □ = b` and the claim is `a OP answer = b`.
 * - `first` — the card says `□ OP a = b` and the claim is `answer OP a = b`.
 *
 * A `switch` with no default, so a fourth `PromptBlank` fails to compile here rather
 * than being silently measured as one of the three that exist.
 */
function claimOf(
  operator: Exclude<PromptOperator, "none">,
  blank: PromptBlank,
  a: Rational,
  b: Rational,
  answer: Rational,
): { readonly stated: Rational; readonly wanted: Rational } {
  switch (blank) {
    case "none":
      return { stated: apply(operator, a, b), wanted: answer };
    case "second":
      return { stated: apply(operator, a, answer), wanted: b };
    case "first":
      return { stated: apply(operator, answer, a), wanted: b };
  }
}

test("every registered template declares the operator its question is written with", () => {
  const glyphs = new Map<PromptOperator, number>();
  for (const entry of promptRegistry) {
    const operator = promptOperator(String(entry.id));
    assert.ok(operator !== null, `${entry.id} declares no operator`);
    glyphs.set(operator, (glyphs.get(operator) ?? 0) + 1);
    // The declaration and the key have to agree where the key says anything at
    // all, or the table is a second source of truth that can drift from the first.
    if (String(entry.id).endsWith(".add")) assert.equal(operator, "+", entry.id);
    if (String(entry.id).endsWith(".sub")) assert.equal(operator, "−", entry.id);
    if (String(entry.id).endsWith(".mul")) assert.equal(operator, "×", entry.id);
    if (String(entry.id).endsWith(".div")) assert.equal(operator, "÷", entry.id);
  }
  assert.ok((glyphs.get("×") ?? 0) >= 4, "no multiplication template in a program that teaches multiplication");
  assert.ok((glyphs.get("÷") ?? 0) >= 4, "no division template in a program that teaches division");
  process.stdout.write(
    `# prompt operators: ${[...glyphs].map(([glyph, count]) => `${glyph}×${String(count)}`).join(" ")}\n`,
  );
});

test("an unregistered key has no operator, and the answer is null rather than a plus", () => {
  // The default matters more than it looks. A renderer that cannot tell what
  // operator a question uses must draw nothing and say so; a lookup that fell back
  // to `"+"` would reproduce the defect this table exists to retire, one layer
  // further in and harder to see.
  assert.equal(promptOperator("dw.prompt.nothing.at-all"), null);
  assert.equal(findPromptTemplate("dw.prompt.nothing.at-all" as never), undefined);
});

test("the templates the host cannot state are exactly the blocked list", () => {
  // Measured, not asserted. Every bound level of every template with an operator is
  // generated, the statement its two declarations describe is written out, the
  // canonical answer is substituted for the box, and the two sides of the resulting
  // equation are compared in exact rationals. A template where those ever disagree is
  // a card that reads perfectly and marks a correct child wrong, which is the failure
  // this whole file is about.
  //
  // Substituting the answer rather than evaluating the operands is what makes the
  // check cover a blank: on `□ × 15 = 165` there is no product of the two numerals to
  // compare with anything, and the claim the card actually makes is that some number
  // times 15 is 165. Before `PromptBlank` this loop applied the operator to the two
  // operands unconditionally and therefore reported four templates as misstated that
  // are now stated — which is exactly what it should have done, because at the time
  // nothing could state them.
  const misstated = new Map<string, string>();
  const checked = new Set<string>();

  for (const node of allNodes) {
    if (node.status === "deprecated") continue;
    const family = familyById(node.generator.family);
    assert.ok(family !== undefined, `${node.id} binds an unregistered family`);
    node.generator.params.forEach((raw, level) => {
      const validated = family.paramSchema.validate(raw);
      if (!validated.ok) return;
      for (let seed = 1; seed <= 25; seed++) {
        const exercise = family.generate({
          skillId: node.id,
          level,
          seed,
          params: validated.value,
          forms: node.generator.forms,
        });
        const key = String(exercise.prompt.key);
        const operator = promptOperator(key);
        assert.ok(operator !== null, `${node.id} emits ${key}, which nothing declares`);
        if (operator === "none") continue;
        const [left, right] = operandsTheHostWouldRead(exercise.prompt.slots);
        const wanted = answerValue(exercise.answer.canonical);
        if (left == null || right == null || wanted === null) {
          // A `term` slot or an answer that is not one number. Not a *misstated*
          // question — it is a card the host cannot compose at all, and it is
          // refused there rather than drawn. Recorded so this loop cannot silently
          // skip a template and call it checked.
          misstated.set(key, `${node.id} L${String(level)}: the question is not two numbers and one answer`);
          continue;
        }
        checked.add(key);
        const blank = promptBlank(key);
        assert.ok(blank !== null, `${node.id} emits ${key}, which declares no blank position`);
        const claim = claimOf(operator, blank, left, right, wanted);
        if (rational.cmp(claim.stated, claim.wanted) !== 0 && !misstated.has(key)) {
          misstated.set(
            key,
            `${node.id} L${String(level)} seed ${String(seed)}: the card reads ` +
              `"${drawn(operator, blank, left, right)}" and with the answer ` +
              `${rational.toString(wanted)} in it that claims ` +
              `${rational.toString(claim.stated)} = ${rational.toString(claim.wanted)}`,
          );
        }
      }
    });
  }

  assert.deepEqual(
    [...misstated.keys()].sort(),
    [...MISSTATED_QUESTION_TEMPLATES].sort(),
    `promotionBlockers.ts and the generators disagree about which questions a two-operand string states:\n  ` +
      [...misstated].map(([key, why]) => `${key} — ${why}`).join("\n  "),
  );
  assert.ok(checked.size >= 15, `only ${String(checked.size)} templates were arithmetically checked`);
  process.stdout.write(
    `# stated question: ${String(checked.size)} template(s) checked, ${String(misstated.size)} misstated\n`,
  );
});

test("the levels whose answers are too wide to print are exactly the ones promotionBlockers.ts names", () => {
  // Measured against the narrowest budget any shipped pack declares. This was
  // found by CI rather than by reading: promoting the whole `mul` domain turned
  // `games/polarity`'s own sweep red with "produced an item with no drawable
  // answer", because its numeral cell holds eight characters and
  // `48,826 × 82,726` is ten.
  const tooWide = new Set<string>();
  for (const node of allNodes) {
    if (node.status === "deprecated") continue;
    const family = familyById(node.generator.family);
    assert.ok(family !== undefined, `${node.id} binds an unregistered family`);
    node.generator.params.forEach((raw, level) => {
      const validated = family.paramSchema.validate(raw);
      if (!validated.ok) return;
      for (let seed = 1; seed <= 60; seed++) {
        const answer = answerValue(
          family.generate({
            skillId: node.id,
            level,
            seed,
            params: validated.value,
            forms: node.generator.forms,
          }).answer.canonical,
        );
        if (answer === null) continue;
        // As a child would read it: digits and a minus, never a denominator.
        // A fraction answer is a different blocker and has its own list.
        if (answer.d !== 1n) continue;
        const printed = answer.n < 0n ? `−${String(-answer.n)}` : String(answer.n);
        if (printed.length > SHIPPED_NUMERAL_MAX_CHARS) tooWide.add(`${node.id} L${String(level)}`);
      }
    });
  }

  assert.deepEqual([...tooWide].sort(), [...NUMERAL_WIDTH_BLOCKED_LEVELS].sort());

  // And every row that owns one of those levels is still draft. A row is promoted
  // whole, so one unprintable level holds the whole row — which is the cost, and it
  // is why the fix belongs in the pack rather than in the level table.
  for (const id of NUMERAL_WIDTH_BLOCKED_SKILLS) {
    const node = allNodes.find((candidate) => String(candidate.id) === id);
    assert.ok(node !== undefined, `${id} is named as blocked and is not in the graph`);
    assert.equal(node.status, "draft", `${id} is ${node.status} and a shipped pack cannot print its answers`);
  }
});

test("the rows whose answer is a fraction are exactly the ones promotionBlockers.ts names", () => {
  // The blocker that has no operator in it and would otherwise be prose.
  // `dw.div.whole.quotient-and-remainder` passes every other check in this package
  // — right operator, stated question, ample variant space, active prerequisites —
  // and the only thing that would stop it is the app, by serving nothing. So the
  // set is measured here, in both directions, where a promotion PR reads it.
  const fractionAnswered = new Set<string>();
  for (const node of allNodes) {
    if (node.status === "deprecated") continue;
    const family = familyById(node.generator.family);
    assert.ok(family !== undefined, `${node.id} binds an unregistered family`);
    node.generator.params.forEach((raw, level) => {
      const validated = family.paramSchema.validate(raw);
      if (!validated.ok) return;
      for (const form of node.generator.forms) {
        if (family.answerSchema(validated.value, form).kind === "fraction") {
          fractionAnswered.add(String(node.id));
        }
      }
      void level;
    });
  }

  assert.deepEqual([...fractionAnswered].sort(), [...FRACTION_ANSWER_BLOCKED_SKILLS].sort());

  // And every one of them is still draft, which is what the blocker means.
  for (const id of FRACTION_ANSWER_BLOCKED_SKILLS) {
    const node = allNodes.find((candidate) => String(candidate.id) === id);
    assert.ok(node !== undefined, `${id} is named as blocked and is not in the graph`);
    assert.equal(
      node.status,
      "draft",
      `${id} is ${node.status} behind a renderer that cannot write its answer — the host serves nothing for it`,
    );
  }
});

test("no active row emits a template the host cannot state", () => {
  // The claim the blocker list is *for*, checked against the graph rather than
  // against the list. Promoting a row named in `MISSTATED_QUESTION_TEMPLATES` puts
  // a wrong question in front of a child — not a blank card, which a reviewer would
  // see in a minute, but a card that reads fine and marks the right answer wrong.
  const blocked = new Set(MISSTATED_QUESTION_TEMPLATES);
  for (const node of allNodes) {
    if (node.status !== "active") continue;
    const family = familyById(node.generator.family);
    assert.ok(family !== undefined, `${node.id} binds an unregistered family`);
    node.generator.params.forEach((raw, level) => {
      const validated = family.paramSchema.validate(raw);
      if (!validated.ok) return;
      for (let seed = 1; seed <= 40; seed++) {
        const key = String(
          family.generate({
            skillId: node.id,
            level,
            seed,
            params: validated.value,
            forms: node.generator.forms,
          }).prompt.key,
        );
        assert.ok(
          !blocked.has(key),
          `${node.id} L${String(level)} is active and emits ${key}, which a two-operand string does not state — ` +
            `a child would be asked one question and marked wrong for answering it`,
        );
        // And nothing active may emit a template that is not a binary operation at
        // all: `dw.ns.place.digit-value` came out as `295 + dw.term.place.hundreds`
        // before the renderer learned to refuse it, and refusing it means the row
        // serves nothing — which is a rung a game cannot reach.
        assert.notEqual(
          promptOperator(key),
          "none",
          `${node.id} L${String(level)} is active and emits ${key}, which declares no operator — the host refuses ` +
            `to serve it, so the row is an unreachable rung`,
        );
      }
    });
  }
});

test("every registered template declares where its blank sits, and the two lookups agree", () => {
  // The declaration `PromptBlank` adds, held to the same standard as the operator: a
  // table read with no fallback, in both directions. The pairing matters because
  // `items.ts` reads the two with two calls — a key with an operator and no blank
  // position would let a statement be drawn as `a OP b` with the box missing, and the
  // host refuses the item rather than guessing, which this pins from the other side.
  let withBlank = 0;
  for (const entry of promptRegistry) {
    const blank = promptBlank(String(entry.id));
    assert.ok(blank !== null, `${entry.id} declares no blank position`);
    assert.equal(blank, entry.blank, `${entry.id} does not read back what it declares`);
    const operator = promptOperator(String(entry.id));
    assert.ok(operator !== null, `${entry.id} has a blank position and no operator`);
    if (blank === "none") continue;
    withBlank += 1;
    // A blank with no operator to sit beside is not a statement this type can write:
    // `□ = 5` has no expression in it, and nothing in `PromptBlank` says where a
    // second operand went.
    assert.notEqual(operator, "none", `${entry.id} puts a blank in a question with no operator`);
  }
  // The four `missing-operand` shapes a two-operand equation reaches. Stated as a
  // floor rather than an equality so a fifth is not a test edit, and as a floor above
  // zero so deleting the field's only users fails here.
  assert.ok(withBlank >= 4, `only ${String(withBlank)} template(s) declare a blank`);

  // No fallback, in either direction — the same two assertions `promptOperator` gets.
  assert.equal(promptBlank("dw.prompt.nothing.at-all"), null);
  assert.equal(promptBlank(""), null);
});

test("the blank statements are drawn as the equations they are, box and equals included", () => {
  // The shapes, spelled out as strings, so a change to a declared position is visible
  // as the card a child would read rather than as an enum value.
  //
  // `drawn` here is the curriculum's transcription of the host's `drawStatement`; the
  // authoritative version and the assertion that these two agree live in
  // `dynawalla-app/src/packs/items.test.ts`, where the renderer is.
  const fifteen = rational.rational(15n);
  const oneSixtyFive = rational.rational(165n);
  assert.equal(drawn("×", "first", fifteen, oneSixtyFive), "□ × 15 = 165");
  assert.equal(drawn("+", "second", rational.rational(47n), rational.rational(68n)), "47 + □ = 68");
  assert.equal(drawn("−", "first", rational.rational(47n), rational.rational(68n)), "□ − 47 = 68");
  assert.equal(drawn("−", "second", rational.rational(93n), rational.rational(47n)), "93 − □ = 47");
  // And a question with no blank is untouched, bit for bit. This is the regression
  // that would break every active row in the product.
  assert.equal(drawn("+", "none", rational.rational(47n), rational.rational(68n)), "47 + 68");
});

test("the alg rows a pack cannot draw are exactly the ones promotionBlockers.ts names", () => {
  // The blocker that is not arithmetic, asserted in both directions over the domain it
  // is about. The board measurements behind the list are in `promotionBlockers.ts` and
  // cannot be made here — the curriculum imports nothing from `games/` — so what is
  // checkable from this side is that the list and the graph agree about which rows are
  // waiting: promoting one without striking it fails, demoting one without naming it
  // fails, and an id that is not in the graph at all fails.
  for (const id of PACK_STATEMENT_BLOCKED_SKILLS) {
    const node = allNodes.find((candidate) => String(candidate.id) === id);
    assert.ok(node !== undefined, `${id} is named as blocked and is not in the graph`);
    assert.equal(
      node.status,
      "draft",
      `${id} is ${node.status} and no pack that declares it can draw its statement`,
    );
  }

  const draftAlg = allNodes
    .filter((node) => node.domain === "alg" && node.status === "draft")
    .map((node) => String(node.id));
  assert.deepEqual(
    draftAlg.sort(),
    [...PACK_STATEMENT_BLOCKED_SKILLS].sort(),
    "the draft rows of the alg domain and PACK_STATEMENT_BLOCKED_SKILLS disagree",
  );

  // And the row that came off the list is genuinely on the ladder rather than merely
  // absent from a blocker list, which is the direction a deletion would satisfy.
  const active = allNodes.filter((node) => node.domain === "alg" && node.status === "active");
  assert.deepEqual(
    active.map((node) => String(node.id)),
    ["dw.alg.equality.missing-addend"],
    "the equality row this host can draw is not the one that is active",
  );
});

test("every template a bound level can emit is registered, and nothing is registered that none emits", () => {
  // Both directions, over the *whole* graph including drafts, because a draft row
  // is exactly where an unregistered template would sit unnoticed until the day
  // somebody promotes it.
  const emitted = new Set<string>();
  for (const node of allNodes) {
    if (node.status === "deprecated") continue;
    const family = familyById(node.generator.family);
    assert.ok(family !== undefined, `${node.id} binds an unregistered family`);
    node.generator.params.forEach((raw, level) => {
      const validated = family.paramSchema.validate(raw);
      assert.ok(validated.ok, `${node.id} L${String(level)} params rejected`);
      if (!validated.ok) return;
      for (let seed = 1; seed <= 60; seed++) {
        emitted.add(
          String(
            family.generate({
              skillId: node.id,
              level,
              seed,
              params: validated.value,
              forms: node.generator.forms,
            }).prompt.key,
          ),
        );
      }
    });
  }

  const declared = promptRegistry.map((entry) => String(entry.id));
  assert.deepEqual(
    [...emitted].filter((key) => !declared.includes(key)).sort(),
    [],
    "a bound level emits a prompt template nobody registered",
  );
  assert.deepEqual(
    declared.filter((key) => !emitted.has(key)).sort(),
    [],
    "a prompt template is registered that no bound level emits",
  );
  assert.equal(new Set(declared).size, declared.length, "a prompt template is declared twice");
});
