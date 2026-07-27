import test from "node:test";
import assert from "node:assert/strict";
import { createStubHost } from "./stubHost.ts";
import type { Question } from "./contract.ts";

/**
 * The stub host is the thing that decides whether this game teaches anything.
 * These assertions are the promises it makes to the real runtime that replaces
 * it, so they are written against behaviour a child would notice, not against
 * the implementation.
 */

// The host reads `navigator` and `window` for haptics and reduced motion; the
// question generator does not. Stub the two globals the constructor touches.
const g = globalThis as unknown as Record<string, unknown>;
g.navigator ??= {};
g.window ??= { matchMedia: () => ({ matches: false }) };

function sample(seed: number, n: number, difficulty: number): Question[] {
  const host = createStubHost({ seed });
  const out: Question[] = [];
  for (let i = 0; i < n; i++) out.push(host.next({ difficulty }));
  return out;
}

test("every answer is an exact integer, never a float", () => {
  for (let d = 0; d <= 12; d++) {
    for (const q of sample(0xbeef + d, 200, d)) {
      assert.match(q.answer, /^-?\d+$/, `answer "${q.answer}" in ${q.domain} is not an integer literal`);
      const n = Number(q.answer);
      assert.ok(Number.isSafeInteger(n), `answer ${q.answer} is not a safe integer`);
      assert.equal(String(n), q.answer, "answer string is not canonical");
    }
  }
});

test("the prompt's arithmetic actually equals the answer", () => {
  // Re-evaluate the printed expression independently of the generator that
  // produced it. A generator that drifts from its own prompt teaches a lie.
  const ops: Record<string, (a: number, b: number) => number> = {
    "+": (a, b) => a + b,
    "−": (a, b) => a - b,
    "×": (a, b) => a * b,
    // Integer division, explicitly. `divFact` builds `a = q * b` so the
    // quotient is always exact, but writing `a / b` here means the invariant
    // rests on that and nothing says so — one generator change away from
    // silently comparing against a non-representable float.
    "÷": (a, b) => (b !== 0 && a % b === 0 ? a / b : NaN),
  };
  let checked = 0;
  for (let d = 0; d <= 12; d++) {
    for (const q of sample(0x1234 + d, 300, d)) {
      const m = q.prompt.match(/^(-?\d+)[\s ]*([+−×÷])[\s ]*(-?\d+)$/);
      if (!m) continue; // compound forms are covered by their own cases below
      const got = ops[m[2]](Number(m[1]), Number(m[3]));
      assert.equal(String(got), q.answer, `"${q.prompt}" should be ${got}, host said ${q.answer}`);
      checked++;
    }
  }
  assert.ok(checked > 400, `expected plenty of simple binary prompts, checked ${checked}`);
});

test("order-of-operations prompts respect precedence", () => {
  // Both branches. Only the `a + b x c` shape used to be checked here, and that
  // is exactly why the `a*c - b x c` branch was free to emit negative answers in
  // an unsigned domain without anything noticing.
  let addChecked = 0;
  let subChecked = 0;
  for (const q of sample(0x77, 900, 9)) {
    const add = q.prompt.match(/^(\d+)[\s ]*\+[\s ]*(\d+)[\s ]*×[\s ]*(\d+)$/);
    if (add) {
      const [a, b, c] = [Number(add[1]), Number(add[2]), Number(add[3])];
      assert.equal(q.answer, String(a + b * c));
      // The canonical mal-rule - left-to-right - must be on offer.
      assert.ok(q.distractors.includes(String((a + b) * c)), "missing the left-to-right distractor");
      addChecked++;
      continue;
    }
    const sub = q.prompt.match(/^(\d+)[\s ]*−[\s ]*(\d+)[\s ]*×[\s ]*(\d+)$/);
    if (sub) {
      const [p, b, c] = [Number(sub[1]), Number(sub[2]), Number(sub[3])];
      assert.equal(q.answer, String(p - b * c));
      assert.ok(Number(q.answer) >= 0, `"${q.prompt}" answers ${q.answer} in an unsigned domain`);
      // Left-to-right here means subtracting before multiplying.
      assert.ok(q.distractors.includes(String((p - b) * c)), "missing the left-to-right distractor");
      subChecked++;
    }
  }
  assert.ok(addChecked > 0, "difficulty 9 never produced an `a + b x c` item");
  assert.ok(subChecked > 0, "difficulty 9 never produced an `a*c - b x c` item");
});

test("distractors are usable: at least two, distinct, never the answer", () => {
  for (let d = 0; d <= 12; d++) {
    for (const q of sample(0xabc + d, 250, d)) {
      assert.ok(q.distractors.length >= 2, `${q.prompt} offered ${q.distractors.length} distractors`);
      const set = new Set(q.distractors);
      assert.equal(set.size, q.distractors.length, `${q.prompt} repeated a distractor`);
      assert.ok(!set.has(q.answer), `${q.prompt} offered its own answer as a distractor`);
      for (const dd of q.distractors) {
        assert.match(dd, /^-?\d+$/, `distractor "${dd}" is not an integer literal`);
      }
    }
  }
});

test("distractors are mal-rule outputs, not noise around the answer", () => {
  // 7 x 6: a child who adds writes 13; a child who skip-counts one step short
  // writes 35 or 36. At least one such answer must be reachable, or the wrong
  // lanes are free to reject and the question stops being a question.
  let sawAddedInstead = false;
  let sawSkipCount = false;
  for (const q of sample(0x5150, 900, 3)) {
    if (q.domain !== "mul.facts") continue;
    const m = q.prompt.match(/^(\d+)[\s ]*×[\s ]*(\d+)$/);
    if (!m) continue;
    const a = Number(m[1]), b = Number(m[2]);
    if (q.distractors.includes(String(a + b))) sawAddedInstead = true;
    if (q.distractors.includes(String(a * b - a)) || q.distractors.includes(String(a * b - b))) sawSkipCount = true;
  }
  assert.ok(sawAddedInstead, "no multiplication item ever offered the added-instead-of-multiplied answer");
  assert.ok(sawSkipCount, "no multiplication item ever offered a skip-count-short answer");
});

test("addition with a carry actually carries", () => {
  // The sibling of the `sub.borrow` assertion below, which was missing — and in
  // its absence 18% of `add.carry` items arrived with no carry in them (`43 +
  // 20`). In exactly those items the dropped-the-carry mal-rule collapses onto
  // the correct answer and gets deduped away, so the gate quietly loses a lane.
  let seen = 0;
  let malRule = 0;
  // Difficulty 3, because that is a band `addCarry` is actually in — the ladder
  // drops it after `until: 5`, and asking at 5 samples a band without it.
  for (const q of sample(0xca447, 900, 3)) {
    if (q.domain !== "add.carry") continue;
    const m = q.prompt.match(/^(\d+)[\s ]*\+[\s ]*(\d+)$/);
    assert.ok(m, `"${q.prompt}" is not a two-term addition`);
    const a = Number(m![1]), b = Number(m![2]);
    assert.ok((a % 10) + (b % 10) >= 10, `${q.prompt} does not actually require a carry`);
    assert.notEqual(String(a + b - 10), q.answer, `${q.prompt}: the dropped-carry mal-rule collapsed onto the answer`);
    // `build()` shuffles the mal-rules and keeps three of the four, so this one
    // is frequent rather than universal — the same shape the borrow case below
    // asserts. What matters is that it is *available*: before the fix it was
    // identical to the answer on every carry-free item and deduped away.
    if (q.distractors.includes(String(a + b - 10))) malRule++;
    seen++;
  }
  assert.ok(seen > 20, `only ${seen} add.carry items appeared`);
  assert.ok(malRule > seen / 2, `the dropped-carry answer was offered only ${malRule} times in ${seen} items`);
});

test("subtraction with a borrow offers smaller-from-larger", () => {
  let seen = 0;
  for (const q of sample(0x9001, 900, 5)) {
    if (q.domain !== "sub.borrow") continue;
    const m = q.prompt.match(/^(\d+)[\s ]*−[\s ]*(\d+)$/);
    if (!m) continue;
    const a = Number(m[1]), b = Number(m[2]);
    assert.ok(a % 10 < b % 10, `${q.prompt} does not actually require a borrow`);
    const malRule = Math.floor(a / 10) - Math.floor(b / 10);
    const digits = malRule * 10 + Math.abs((a % 10) - (b % 10));
    if (q.distractors.includes(String(digits))) seen++;
  }
  assert.ok(seen > 4, `smaller-from-larger appeared only ${seen} times`);
});

test("whole-number questions never offer a negative option", () => {
  // In signed-integer work a negative option is the whole point — dropping the
  // sign is the mal-rule. Everywhere else it is a free elimination.
  //
  // The **answer** is checked here as well as the distractors, and that is the
  // half that was missing. Guarding only the distractors is worse than guarding
  // neither: `build()` strips negative distractors from an unsigned domain, so a
  // negative answer became the only negative among the four options and a child
  // could take that lane on sight. `12 − 8 × 4 = −20` against `8`, `16` and `0`
  // shipped for exactly that reason.
  let sawSigned = false;
  for (let d = 0; d <= 12; d++) {
    for (const q of sample(0x33 + d, 300, d)) {
      if (q.domain === "int.signed") { sawSigned = true; continue; }
      assert.ok(
        Number(q.answer) >= 0,
        `${q.domain} answered "${q.prompt}" with ${q.answer}; in an unsigned domain the only negative on offer is a free elimination`,
      );
      for (const dd of q.distractors) {
        assert.ok(Number(dd) >= 0, `${q.domain} offered ${dd}, which a child can reject without doing the maths`);
      }
    }
  }
  assert.ok(sawSigned, "signed-integer work never appeared, so its exemption is untested");
});

test("the same seed replays the same question stream", () => {
  const a = sample(12345, 120, 6).map((q) => `${q.prompt}=${q.answer}|${q.distractors.join(",")}`);
  const b = sample(12345, 120, 6).map((q) => `${q.prompt}=${q.answer}|${q.distractors.join(",")}`);
  assert.deepEqual(a, b);
  const c = sample(12346, 120, 6).map((q) => q.prompt);
  assert.notDeepEqual(a.map((s) => s.split("=")[0]), c);
});

test("question ids are unique within a host", () => {
  const host = createStubHost({ seed: 7 });
  const ids = new Set<string>();
  for (let i = 0; i < 500; i++) ids.add(host.next({ difficulty: i % 12 }).id);
  assert.equal(ids.size, 500);
});

test("difficulty moves the domain mix, and out-of-range values are clamped", () => {
  const easy = new Set(sample(4, 200, 0).map((q) => q.domain));
  const hard = new Set(sample(4, 200, 11).map((q) => q.domain));
  assert.ok(easy.has("add.within20"));
  assert.ok(!easy.has("ops.order"), "difficulty 0 should never ask order of operations");
  assert.ok(hard.has("ops.order") || hard.has("frac.of") || hard.has("int.signed"));

  const host = createStubHost({ seed: 1 });
  for (const d of [-40, NaN, 1e9]) {
    const q = host.next({ difficulty: d });
    assert.ok(Number.isFinite(q.difficulty) && q.difficulty >= 0 && q.difficulty <= 12, `difficulty ${d} escaped clamping`);
    assert.match(q.answer, /^-?\d+$/);
  }
  assert.match(host.next().answer, /^-?\d+$/, "next() with no options must still work");
});

test("a prompt never repeats back to back", () => {
  const host = createStubHost({ seed: 99 });
  let prev = "";
  for (let i = 0; i < 400; i++) {
    const q = host.next({ difficulty: 1 });
    assert.notEqual(q.prompt, prev, "the same prompt twice in a row reads as a bug to a player");
    prev = q.prompt;
  }
});
