import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { grade } from "../../../../harvest/practice/src/index.ts";
import { pickNext, rebuild, reportOf, toBank } from "./state.ts";
import type { PracticeAttempt, PracticeItems } from "../engine/types.ts";

const items = JSON.parse(readFileSync(fileURLToPath(new URL("../design/practice.json", import.meta.url)), "utf8")) as PracticeItems;

test("the pack's items make a practice bank: every question on a known skill, every key a valid choice", () => {
  const ix = toBank(items);
  assert.equal(ix.itemById.size, items.questions.length);
  for (const q of items.questions) {
    const key = Number(q.answer);
    assert.ok(Number.isInteger(key) && key >= 0 && key < q.choices.length, q.q_id);
    assert.equal(q.rationales.length, q.choices.length, q.q_id);
    assert.equal(grade(ix.itemById.get(q.q_id)!, key).correct, true);
  }
});

test("state is rebuilt from the recorded attempts: same history, same mastery; misses come back for review", () => {
  const ix = toBank(items);
  const t0 = Date.UTC(2026, 10, 28, 12);
  const attempts: PracticeAttempt[] = items.questions.slice(0, 10).map((q, i) => ({
    attempt_id: `a${i}`,
    pack_id: "pump40v2-proof",
    pack_version: "2026.11.28-4",
    skill_id: q.skill_id,
    q_id: q.q_id,
    chosen: String(i % 3 === 0 ? (Number(q.answer) + 1) % q.choices.length : Number(q.answer)),
    correct: i % 3 !== 0,
    ms: 9000,
    at: new Date(t0 + i * 60_000).toISOString(),
  }));
  const a = rebuild(ix, attempts);
  const b = rebuild(ix, attempts);
  assert.deepEqual(reportOf({ ix, state: a }, t0 + 3_600_000), reportOf({ ix, state: b }, t0 + 3_600_000));
  assert.equal(a.step, attempts.length);
  assert.ok(Object.keys(a.deck.cards).length > 0, "the misses open spaced reviews");
  // Unknown questions in the history (a pack update dropped them) are skipped, not fatal.
  assert.equal(rebuild(ix, [...attempts, { ...attempts[0]!, attempt_id: "gone", q_id: "q:gone" }]).step, attempts.length);
  assert.ok(pickNext(ix, a, t0 + 3_600_000), "there is always a next question while the pack has any");
});
