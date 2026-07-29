/**
 * The prompt registry, and the operator a question is written with.
 *
 * ## Why this file exists
 *
 * `dynawalla-app/src/packs/items.ts` is the only thing in this repository that
 * turns an `Exercise` into a string a child reads, and `packs/shared/game-host`
 * hands that string to a game unchanged. It picks the operator like this:
 *
 * ```ts
 * export function isSubtraction(promptKey: string): boolean {
 *   return promptKey === PROMPT_KEY_SUB || promptKey.endsWith(".sub")
 * }
 * // …
 * prompt: `${top} ${subtract ? MINUS : "+"} ${bottom}`,
 * ```
 *
 * So every template that is not a subtraction is drawn as an **addition**. That is
 * right for the four templates the graph has active and wrong for ten others, and
 * the failure it produces is the worst shape this program has: `7 × 8` reaches the
 * child as `7 + 8`, reads perfectly, is answerable, and marks 15 wrong.
 *
 * The rule is reproduced here — not imported, because this package cannot import
 * the app — and asserted against what the curriculum actually declares. The list
 * it disagrees on is `OPERATOR_BLOCKED_TEMPLATES`, which is what stops the
 * multiplication and division rows being promoted, and this is what keeps that
 * list from going stale in either direction.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { allNodes } from "../graph/graph.ts";
import { OPERATOR_BLOCKED_TEMPLATES } from "../graph/promotionBlockers.ts";
import { familyById } from "../generators/registry.ts";
import { findPromptTemplate, promptOperator, promptRegistry } from "./prompts.ts";
import type { PromptOperator } from "./prompts.ts";

/**
 * The shipped renderer's rule, transcribed from
 * `dynawalla-app/src/packs/items.ts`. Reproduced rather than imported: the
 * curriculum cannot depend on the app, and a transcription that drifts from the
 * original is caught by the next person to read either file — where a test that
 * skipped the question entirely is caught by nobody.
 */
function operatorTheHostWouldDraw(promptKey: string): "+" | "−" {
  return promptKey.endsWith(".sub") ? "−" : "+";
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

test("the templates the shipped renderer would mis-draw are exactly the blocked list", () => {
  const misdrawn = promptRegistry
    .filter((entry) => entry.operator !== "none")
    .filter((entry) => operatorTheHostWouldDraw(String(entry.id)) !== entry.operator)
    .map((entry) => String(entry.id))
    .sort();

  assert.deepEqual(
    misdrawn,
    [...OPERATOR_BLOCKED_TEMPLATES].sort(),
    "promotionBlockers.ts and the registry disagree about which questions are drawn with the wrong sign",
  );

  // And the rule is right on everything else, so the list above is a list of
  // defects rather than a list of everything the renderer draws. `none` is
  // excluded from both halves: a question that is not a binary operation is drawn
  // by a different path entirely, and the host's plus sign is not an answer to it.
  const blocked = new Set(misdrawn);
  for (const entry of promptRegistry) {
    if (entry.operator === "none" || blocked.has(String(entry.id))) continue;
    assert.equal(operatorTheHostWouldDraw(String(entry.id)), entry.operator, entry.id);
  }
  process.stdout.write(
    `# operator blocker: ${String(misdrawn.length)} of ${String(promptRegistry.length)} templates would be drawn ` +
      `with the wrong sign\n`,
  );
});

test("no active row emits a template the shipped renderer would mis-draw", () => {
  // The claim the blocker list is *for*, checked against the graph rather than
  // against the list. Promoting a row named in `OPERATOR_BLOCKED_TEMPLATES` puts a
  // wrong question in front of a child — not a blank card, which a reviewer would
  // see in a minute, but a card that reads fine and marks the right answer wrong.
  const blocked = new Set(OPERATOR_BLOCKED_TEMPLATES);
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
          `${node.id} L${String(level)} is active and emits ${key}, which the shipped renderer draws with a plus ` +
            `sign — a child would be asked the wrong question and marked wrong for answering the right one`,
        );
      }
    });
  }
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
