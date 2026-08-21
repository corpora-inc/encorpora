import test from "node:test";
import assert from "node:assert/strict";

import { ALL_FAMILIES, frac, generate, makeRng, tenths } from "./mathgen.ts";
import { createStubHost } from "./stub.ts";

/** Evaluate a prompt with the blank filled in, using integers only. */
function holds(prompt: string, answer: string): boolean {
  const filled = prompt.replace("?", answer);
  const [lhsRaw, rhsRaw] = filled.split("=");
  assert.ok(lhsRaw && rhsRaw, `no equals in ${filled}`);
  const l = evalSide(lhsRaw.trim());
  const r = evalSide(rhsRaw.trim());
  if (l === null || r === null) return false;
  // Cross-multiply so two rationals compare with integer arithmetic only.
  return l.n * r.d === r.n * l.d;
}

type Rat = { n: number; d: number };

/** A deliberately tiny parser: exactly the shapes this game emits, no more. */
function evalSide(s: string): Rat | null {
  const parts = s.split(/([+−×÷])/).map((p) => p.trim());
  let acc = lit(parts[0]!);
  if (!acc) return null;
  for (let i = 1; i < parts.length; i += 2) {
    const op = parts[i]!;
    const b = lit(parts[i + 1]!);
    if (!b) return null;
    if (op === "+") acc = { n: acc.n * b.d + b.n * acc.d, d: acc.d * b.d };
    else if (op === "−") acc = { n: acc.n * b.d - b.n * acc.d, d: acc.d * b.d };
    else if (op === "×") acc = { n: acc.n * b.n, d: acc.d * b.d };
    else if (op === "÷") acc = { n: acc.n * b.d, d: acc.d * b.n };
    else return null;
  }
  return acc;
}

function lit(s: string): Rat | null {
  if (s === undefined) return null;
  const t = s.trim();
  if (/^-?\d+$/.test(t)) return { n: Number(t), d: 1 };
  const f = /^(-?\d+)\/(\d+)$/.exec(t);
  if (f) return { n: Number(f[1]), d: Number(f[2]) };
  // Decimals are read as exact integer tenths/hundredths — never as a float.
  const dec = /^(-?)(\d+)\.(\d+)$/.exec(t);
  if (dec) {
    const sign = dec[1] === "-" ? -1 : 1;
    const whole = Number(dec[2]);
    const fracDigits = dec[3]!;
    const d = Math.pow(10, fracDigits.length);
    return { n: sign * (whole * d + Number(fracDigits)), d };
  }
  return null;
}

test("the parser this file grades with actually works", () => {
  assert.equal(holds("7 + ? = 10", "3"), true);
  assert.equal(holds("7 + ? = 10", "4"), false);
  assert.equal(holds("3/5 + ? = 1", "2/5"), true);
  assert.equal(holds("3/5 + ? = 1", "2/10"), false);
  assert.equal(holds("0.7 + ? = 1", "0.3"), true);
  assert.equal(holds("0.7 + ? = 1", "3"), false);
  assert.equal(holds("6 × ? = 42", "7"), true);
  assert.equal(holds("13 − ? = 8", "5"), true);
  assert.equal(holds("-6 + ? = 0", "6"), true);
});

test("every family, at every difficulty, states a true thing", () => {
  for (let d = 1; d <= 10; d++) {
    const rng = makeRng(0x1000 + d);
    for (let i = 0; i < 400; i++) {
      const q = generate(rng, d, 4);
      if (q.prompt.includes("/") && q.prompt.includes("=?/")) continue; // equiv form below
      if (/=\s*\?\/\d+$/.test(q.prompt.replace(/\s/g, ""))) continue;
      assert.equal(
        holds(q.prompt, q.answer),
        true,
        `${q.domain}: "${q.prompt}" answer "${q.answer}"`,
      );
    }
  }
});

test("equivalent-fraction prompts state a true thing too", () => {
  const rng = makeRng(77);
  for (let i = 0; i < 500; i++) {
    const q = generate(rng, 7, 4, "frac-equiv");
    const m = /^(\d+)\/(\d+) = \?\/(\d+)$/.exec(q.prompt);
    assert.ok(m, q.prompt);
    const [, n, d, bigD] = m!.map(Number) as unknown as number[];
    assert.equal(Number(q.answer) * d!, n! * bigD!, `${q.prompt} -> ${q.answer}`);
  }
});

test("no distractor is ever secretly correct", () => {
  for (let d = 1; d <= 10; d++) {
    const rng = makeRng(0x2000 + d);
    for (let i = 0; i < 400; i++) {
      const q = generate(rng, d, 4);
      for (const w of q.distractors) {
        assert.notEqual(w, q.answer, `${q.domain} repeated the answer as a decoy`);
        if (/=\s*\?\//.test(q.prompt)) continue;
        assert.equal(holds(q.prompt, w), false, `${q.domain}: decoy "${w}" also solves "${q.prompt}"`);
      }
      assert.equal(new Set(q.distractors).size, q.distractors.length, "duplicate decoys");
    }
  }
});

test("there are always enough decoys for four faces and a revive panel", () => {
  for (let d = 1; d <= 10; d++) {
    const rng = makeRng(0x3000 + d);
    for (let i = 0; i < 200; i++) {
      const q = generate(rng, d, 4);
      assert.ok(q.distractors.length >= 3, `${q.domain} gave ${q.distractors.length}`);
    }
  }
});

test("answers stay short enough to be read on a moving stone", () => {
  for (let d = 1; d <= 10; d++) {
    const rng = makeRng(0x4000 + d);
    for (let i = 0; i < 300; i++) {
      const q = generate(rng, d, 4);
      assert.ok(q.answer.length <= 5, `${q.domain} answer "${q.answer}" is too long to read`);
      for (const w of q.distractors) {
        assert.ok(w.length <= 5, `${q.domain} decoy "${w}" is too long to read`);
      }
      assert.ok(q.prompt.length <= 18, `${q.domain} prompt "${q.prompt}" is too long for 320px`);
    }
  }
});

test("no floating point ever reaches an answer or a decoy", () => {
  // Every emitted string must be an exact integer, an exact fraction, or a
  // decimal with at most two places — never something like 0.30000000000000004.
  const shape = /^-?\d+(\.\d{1,2})?$|^-?\d+\/\d+$/;
  for (let d = 1; d <= 10; d++) {
    const rng = makeRng(0x5000 + d);
    for (let i = 0; i < 400; i++) {
      const q = generate(rng, d, 4);
      assert.match(q.answer, shape, `${q.domain} answer "${q.answer}"`);
      for (const w of q.distractors) assert.match(w, shape, `${q.domain} decoy "${w}"`);
    }
  }
});

test("exact rational formatting", () => {
  assert.equal(frac(2, 4), "1/2");
  assert.equal(frac(4, 4), "1");
  assert.equal(frac(0, 5), "0");
  assert.equal(frac(-2, 6), "-1/3");
  assert.equal(tenths(7), "0.7");
  assert.equal(tenths(10), "1");
  assert.equal(tenths(13), "1.3");
  assert.equal(tenths(-3), "-0.3");
  assert.equal(tenths(0), "0");
});

test("the same seed generates the same questions", () => {
  const run = (): string => {
    const rng = makeRng(4242);
    let out = "";
    for (let i = 0; i < 200; i++) {
      const q = generate(rng, 1 + (i % 10), 3);
      out += `${q.prompt}|${q.answer}|${q.distractors.join(",")};`;
    }
    return out;
  };
  assert.equal(run(), run());
});

test("difficulty actually opens new families and keeps some easier work in the mix", () => {
  const seen = (d: number): Set<string> => {
    const rng = makeRng(0x6000 + d);
    const s = new Set<string>();
    for (let i = 0; i < 600; i++) s.add(generate(rng, d, 3).domain);
    return s;
  };
  const easy = seen(1);
  const hard = seen(10);
  assert.deepEqual([...easy], ["bond-10"]);
  assert.ok(hard.has("two-step"), "the hardest family must appear at difficulty 10");
  assert.ok(hard.size >= 3, "difficulty 10 must not be a wall of one thing");
  assert.ok(!hard.has("bond-10"), "difficulty 10 should have moved on from bonds to ten");
});

test("every family is reachable", () => {
  const all = new Set<string>();
  for (let d = 1; d <= 10; d++) {
    const rng = makeRng(0x7000 + d);
    for (let i = 0; i < 1500; i++) all.add(generate(rng, d, 3).domain);
  }
  for (const f of ALL_FAMILIES) assert.ok(all.has(f.id), `${f.id} is unreachable`);
});

test("the stub host satisfies the contract and never throws", () => {
  const host = createStubHost({ seed: 9 });
  for (let i = 0; i < 500; i++) {
    const q = host.next({ difficulty: 1 + (i % 10) });
    assert.ok(q.id && q.prompt && q.answer);
    assert.ok(Array.isArray(q.distractors));
    host.report({ questionId: q.id, correct: i % 2 === 0, ms: i, answered: q.answer });
    host.haptic("light");
  }
  assert.equal(typeof host.prefersReducedMotion(), "boolean");
});

test("question ids are unique across a long run", () => {
  const host = createStubHost({ seed: 3 });
  const ids = new Set<string>();
  for (let i = 0; i < 3000; i++) ids.add(host.next({ difficulty: 5 }).id);
  assert.equal(ids.size, 3000);
});
