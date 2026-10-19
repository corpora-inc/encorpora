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
  assert.deepEqual(offenders, [], "Fixed or generic hints");
});

test("no hint states the answer", () => {
  const offenders: string[] = [];
  for (const t of templates)
    for (const p of sample(t.id))
      if (revealsAnswer(p)) offenders.push(`${t.id} (${p.answer}): ${p.hint}`);
  assert.deepEqual(offenders, []);
});

test("no two problem types share a hint", () => {
  const owner = new Map<string, Set<string>>();
  for (const t of templates)
    for (const p of sample(t.id))
      owner.set(p.hint, (owner.get(p.hint) ?? new Set()).add(t.id));
  const shared = [...owner]
    .filter(([, ids]) => ids.size > 1)
    .filter(([, ids]) => [...ids].some((id) => !sharedHintPending.has(id)))
    .map(([hint, ids]) => `${[...ids].join(", ")}: ${hint}`);
  assert.deepEqual(shared, []);
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
