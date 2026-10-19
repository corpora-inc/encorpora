import { test } from "node:test";
import assert from "node:assert/strict";
import { templates } from "../src/math/engine";
import { methods } from "../src/content/problem-methods";
import {
  fixedHintPending,
  sharedHintPending,
  thinMethodPending,
  watchPending,
} from "./fixtures/hint-pending";
import {
  figureEncodesAnswer,
  fixedHint,
  revealsAnswer,
  sample,
  thin,
  unnamedGivens,
} from "./fixtures/hint-rules";

test("every hint is derived from its own problem's givens", () => {
  const offenders = templates
    .map((t) => t.id)
    .filter((id) => !fixedHintPending.has(id))
    .filter((id) => fixedHint(id) || unnamedGivens(id));
  assert.deepEqual(
    offenders,
    [],
    "These hints repeat on every seed or name none of the prompt's numbers. Write each hint from the problem's own givens (see GeneratedProblem.hint in src/math/contracts.ts)",
  );
});

test("no hint states the answer", () => {
  const offenders: string[] = [];
  for (const t of templates) {
    const problems = sample(t.id),
      figureIsAnswer = figureEncodesAnswer(problems);
    for (const p of problems)
      if (revealsAnswer(p, figureIsAnswer))
        offenders.push(`${t.id} (${p.answer}): ${p.hint}`);
  }
  assert.deepEqual(offenders, [], "These hints state the answer");
});

/** Hints carried by problems of two or more types that ask different questions. */
function sharedHints() {
  const owner = new Map<string, Map<string, Set<string>>>();
  for (const t of templates)
    for (const p of sample(t.id)) {
      const ids = owner.get(p.hint) ?? new Map<string, Set<string>>();
      ids.set(t.id, (ids.get(t.id) ?? new Set()).add(p.public.prompt));
      owner.set(p.hint, ids);
    }
  return [...owner].filter(([, ids]) => {
    if (ids.size < 2) return false;
    const prompts = [...ids.values()].map((set) => [...set].sort().join("\n"));
    return new Set(prompts).size > 1;
  });
}

test("no two problem types share a hint unless they ask the same question", () => {
  const shared = sharedHints()
    .filter(([, ids]) =>
      [...ids.keys()].some((id) => !sharedHintPending.has(id)),
    )
    .map(([hint, ids]) => `${[...ids.keys()].join(", ")}: ${hint}`);
  assert.deepEqual(
    shared,
    [],
    "Each question needs its own hint: say what this question asks",
  );
});

test("every method names the common error and is a complete short path", () => {
  const ids = templates.map((t) => t.id);
  assert.deepEqual(
    ids.filter((id) => !watchPending.has(id) && !methods[id]?.watch),
    [],
    "Methods without a watch line",
  );
  assert.deepEqual(
    ids.filter((id) => !thinMethodPending.has(id) && thin(id)),
    [],
    "Methods of one step or under 80 characters",
  );
});

test("pending hint and method lists only shrink", () => {
  const ids = new Set(templates.map((t) => t.id));
  for (const list of [
    fixedHintPending,
    sharedHintPending,
    thinMethodPending,
    watchPending,
  ])
    assert.deepEqual(
      [...list].filter((id) => !ids.has(id)),
      [],
      "Pending entries name removed templates",
    );
  assert.deepEqual(
    [...fixedHintPending].filter((id) => !fixedHint(id) && !unnamedGivens(id)),
    [],
    "Remove these from fixedHintPending: their hints are instance hints",
  );
  const sharing = new Set(sharedHints().flatMap(([, ids]) => [...ids.keys()]));
  assert.deepEqual(
    [...sharedHintPending].filter((id) => !sharing.has(id)),
    [],
    "Remove these from sharedHintPending: their hints are their own",
  );
  assert.deepEqual(
    [...watchPending].filter((id) => methods[id]?.watch),
    [],
    "Remove these from watchPending",
  );
  assert.deepEqual(
    [...thinMethodPending].filter((id) => !thin(id)),
    [],
    "Remove these from thinMethodPending",
  );
});
