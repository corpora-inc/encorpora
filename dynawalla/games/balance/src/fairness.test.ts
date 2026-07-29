// The three things a child found before anybody else did.
//
// COUNTERPOISE shipped with a rack that gave the answer away, a hardcoded seed
// that replayed one run forever, and no idea who was playing. Each of those is
// a bot in here: if the bot scores, the game does not need arithmetic.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import type { Question } from "./contract.ts";
import { toKey } from "./frac.ts";
import type { Frac } from "./frac.ts";
import { specFromQuestion } from "./adapter.ts";
import { PAN_PEG, netTorque, verdictFor, counts } from "./puzzle.ts";
import { makeRng, freshSeed } from "./rng.ts";
import { makeStubHost } from "./stubHost.ts";
import { puzzleAt } from "./generate.ts";
import { makePacing, afterBoard, request, onTheWire, FLOOR } from "./pacing.ts";
import { toUnit } from "../../../packs/shared/game-host/index.ts";

const RACK = 9;
/** A bot picking blind out of a nine-weight rack. */
const CHANCE = 1 / RACK;
/** Comfortably above chance, comfortably below "it works". */
const NO_BETTER_THAN_CHANCE = 0.2;

/**
 * Questions shaped like the ones the real host actually sends.
 *
 * Not the local ladder: the shipped pack never runs it. `pack.ts` mounts the
 * shared game-host, which hands over a prompt, a canonical answer and whatever
 * mal-rule wrong answers the curriculum produced, and `specFromQuestion` turns
 * that into a board. That path is where the founder's `1 2 3 4 5 6 7 8 97` came
 * from, so that is the path under test.
 *
 * A third of the questions carry no distractors at all, because `item.choices`
 * is optional and a rack of `1..8 + 89` is what an empty one produced.
 */
function hostQuestions(count: number, seed = 0xc0ffee): Question[] {
  const rng = makeRng(seed);
  const out: Question[] = [];
  for (let i = 0; i < count; i++) {
    const a = rng.int(1, 60);
    const b = rng.int(1, 60);
    const sum = a + b;
    // Real column-addition mal-rules: dropped the carry, carried twice, off by
    // one, wrote the digits down side by side.
    const mals = [sum - 10, sum + 10, sum - 1, a * 10 + b].filter((v) => v > 0 && v !== sum);
    const ds = rng.chance(0.34) ? [] : rng.shuffle(mals).slice(0, rng.int(1, 3)).map(String);
    out.push({
      id: `q-${seed.toString(36)}-${i}`,
      prompt: `${a} + ${b}`,
      answer: String(sum),
      distractors: ds,
      domain: "add-sub",
      difficulty: rng.next(),
    });
  }
  return out;
}

function scoreBot(pick: (rack: readonly Frac[]) => Frac, qs: readonly Question[]): number {
  let hits = 0;
  for (const q of qs) {
    const spec = specFromQuestion(q);
    if (toKey(pick(spec.rack)) === toKey(spec.answer)) hits++;
  }
  return hits / qs.length;
}

const median = (xs: readonly number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};

// -------------------------------------------------------------- the exploit

test("the rightmost-weight bot cannot beat chance", () => {
  // The founder's exact strategy, verbatim: "just drag the far right one".
  // Against the shipped code this scored 1.00 on every board with a two-digit
  // answer, because the rack was built by sorting a set whose only large member
  // was the answer.
  const qs = hostQuestions(600);
  const score = scoreBot((rack) => rack[rack.length - 1], qs);
  assert.ok(
    score < NO_BETTER_THAN_CHANCE,
    `the rightmost weight is the answer ${(score * 100).toFixed(1)}% of the time ` +
      `(chance is ${(CHANCE * 100).toFixed(1)}%) — the game is solvable without arithmetic`,
  );
});

test("nor can the biggest-weight, smallest-weight or odd-one-out bots", () => {
  const qs = hostQuestions(600, 0xbeef);
  const bots: [string, (r: readonly Frac[]) => Frac][] = [
    ["leftmost", (r) => r[0]],
    ["biggest", (r) => r.reduce((a, b) => (b.n > a.n ? b : a))],
    ["smallest", (r) => r.reduce((a, b) => (b.n < a.n ? b : a))],
    [
      // Sort the nine discs by the number stamped on them and take the middle
      // one. This is the bot that catches a rack padded symmetrically around
      // the answer, which is what the first attempt at this fix produced.
      "middle by value",
      (r) => [...r].sort((a, b) => a.n - b.n)[Math.floor(r.length / 2)],
    ],
    [
      // "Which one of these is not like the others" — the strategy a child finds
      // about four seconds after "rightmost" stops working.
      "odd one out",
      (r) => {
        const m = median(r.map((f) => f.n));
        return r.reduce((a, b) => (Math.abs(b.n - m) > Math.abs(a.n - m) ? b : a));
      },
    ],
  ];
  for (const [name, pick] of bots) {
    const score = scoreBot(pick, qs);
    assert.ok(
      score < NO_BETTER_THAN_CHANCE,
      `the "${name}" bot scores ${(score * 100).toFixed(1)}% (chance is ${(CHANCE * 100).toFixed(1)}%)`,
    );
  }
});

test("the answer has no position on the rack", () => {
  const qs = hostQuestions(900, 0xd15ea5e);
  const atSlot = new Array<number>(RACK).fill(0);
  let counted = 0;
  for (const q of qs) {
    const spec = specFromQuestion(q);
    const i = spec.rack.findIndex((r) => toKey(r) === toKey(spec.answer));
    assert.ok(i >= 0, `${q.prompt}: the answer is not on the rack at all`);
    if (spec.rack.length !== RACK) continue;
    atSlot[i]++;
    counted++;
  }
  assert.ok(counted > 500, `expected real coverage, got ${counted}`);
  for (let i = 0; i < RACK; i++) {
    const share = atSlot[i] / counted;
    assert.ok(
      share > 0.04 && share < 0.2,
      `slot ${i} holds the answer ${(share * 100).toFixed(1)}% of the time ` +
        `(even would be ${(CHANCE * 100).toFixed(1)}%): ${atSlot.join(",")}`,
    );
  }
});

test("the weights are mixed, on both question paths", () => {
  // Asked for by name: "we want the weights to be shuffled and variable …
  // mixed, shuffled, randomized".
  //
  // It is worth being clear about what this does and does not buy, because
  // once the answer's *rank* is uniform a sorted rail is no longer a leak on
  // its own — every positional bot above still scores at chance against one.
  // What a sorted rail does is collapse two cues into one: work out that the
  // answer is the third smallest and you have also been told it is the third
  // disc. And nine numerals laid out in order read as a number line, which is
  // a different piece of furniture from a rack of brass.
  const sorted = (xs: readonly number[]): boolean =>
    xs.every((v, i) => i === 0 || v >= xs[i - 1]) ||
    xs.every((v, i) => i === 0 || v <= xs[i - 1]);

  let inOrder = 0;
  const qs = hostQuestions(900, 0x5b1f);
  for (const q of qs) if (sorted(specFromQuestion(q).rack.map((f) => f.n))) inOrder++;
  assert.equal(inOrder, 0, `${inOrder} of ${qs.length} host racks are laid out in order`);

  // And the local ladder, which the standalone shell plays.
  let ladderInOrder = 0;
  for (let i = 0; i < 250; i++) {
    if (sorted(puzzleAt(i, 0xa11ce).rack.map((f) => f.n / f.d))) ladderInOrder++;
  }
  assert.ok(
    ladderInOrder <= 2,
    `${ladderInOrder} of 250 ladder racks are laid out in order`,
  );
});

test("the answer never stands apart from the field it is hiding in", () => {
  // The other half of the leak, and the half shuffling alone does not fix. In
  // `1 2 3 4 5 6 7 8 97` the answer is legible from across the room wherever it
  // sits, because there is a gap of 89 between it and the nearest other weight.
  // A weight is only a real alternative if it is near enough to be mistaken for
  // the answer — and the answer has to be bracketed, or "the outer one" works.
  const qs = hostQuestions(400, 0x5a1ad);
  for (const q of qs) {
    const spec = specFromQuestion(q);
    const answer = Math.abs(Number(q.answer));
    const vals = spec.rack.map((f) => Math.abs(f.n));
    const gap = Math.min(...vals.filter((v) => v !== answer).map((v) => Math.abs(v - answer)));
    assert.ok(
      gap <= Math.max(2, answer * 0.25),
      `${q.prompt} = ${answer}: the nearest other weight is ${gap} away, so nothing on ` +
        `the rack is a real alternative (rack ${spec.rack.map(toKey).join(" ")})`,
    );
  }
});

test("the answer has no rank either, once the weights are read in order", () => {
  // Position on the rail is one leak; position in the *number order* is the
  // other, and shuffling does nothing about it. An earlier pass at this padded
  // symmetrically and then forced two weights above and two below, which reads
  // as fair and is not: it puts the answer in the middle by construction, and
  // "sort them in your head and take the fifth" scored 32.6% against a 11.1%
  // baseline.
  const qs = hostQuestions(1200, 0x4a4a4a);
  const atRank = new Array<number>(RACK).fill(0);
  let counted = 0;
  for (const q of qs) {
    const spec = specFromQuestion(q);
    if (spec.rack.length !== RACK) continue;
    const order = spec.rack.map((f) => Math.abs(f.n)).sort((a, b) => a - b);
    atRank[order.indexOf(Math.abs(Number(q.answer)))]++;
    counted++;
  }
  assert.ok(counted > 900, `expected real coverage, got ${counted}`);
  for (let i = 0; i < RACK; i++) {
    const share = atRank[i] / counted;
    assert.ok(
      share > 0.03 && share < 0.2,
      `rank ${i} holds the answer ${(share * 100).toFixed(1)}% of the time ` +
        `(even would be ${(CHANCE * 100).toFixed(1)}%): ${atRank.join(",")}`,
    );
  }
});

test("the founder's three boards, rebuilt", () => {
  // Regression, spelled out. These are the exact prompts from the report and
  // the exact rack the old code produced for them.
  const played: [string, string][] = [
    ["19 + 70", "89"],
    ["69 + 20", "89"],
    ["57 + 40", "97"],
  ];
  for (const [prompt, answer] of played) {
    const spec = specFromQuestion({
      id: `founder-${prompt}`,
      prompt,
      answer,
      distractors: [],
      domain: "add-sub",
      difficulty: 0.3,
    });
    const rack = spec.rack.map(toKey);
    assert.notDeepEqual(
      rack,
      ["1", "2", "3", "4", "5", "6", "7", "8", answer],
      `${prompt} still builds the rack that was reported`,
    );
    assert.ok(rack.includes(answer), `${prompt}: the answer must still be reachable`);
    // Not "the answer is not last" — with nine weights that is true 8 times in
    // 9 by luck, and three boards cannot tell luck from a fix. The two tests
    // above measure position over hundreds of boards. What this one adds is the
    // thing a single board can show: the answer is no longer conspicuous.
    const near = rack
      .map(Number)
      .filter((v) => v !== Number(answer) && Math.abs(v - Number(answer)) <= Number(answer) * 0.3);
    assert.ok(
      near.length >= 4,
      `${prompt}: only ${near.length} weights are anywhere near ${answer} (rack ${rack.join(" ")})`,
    );
  }
});

test("a rebuilt board looks the same — a resize must not reshuffle the rack", () => {
  const q: Question = {
    id: "stable-1",
    prompt: "24 + 13",
    answer: "37",
    distractors: ["27", "47"],
    domain: "add-sub",
    difficulty: 0.3,
  };
  assert.deepEqual(
    specFromQuestion(q).rack.map(toKey),
    specFromQuestion(q).rack.map(toKey),
  );
  const other = specFromQuestion({ ...q, id: "stable-2" }).rack.map(toKey);
  assert.notDeepEqual(
    specFromQuestion(q).rack.map(toKey),
    other,
    "two different questions share a rack order",
  );
});

// ------------------------------------------------- what a wrong pick costs

test("no wrong pick is free, now that every weight is near the answer", () => {
  // The rack rewrite moved half of all wrong answers onto a path that recorded
  // nothing. With padding drawn from `1, 2, 3, …` a too-light pick left a
  // remainder the rack could still make, so the child went on placing and
  // eventually overshot into `wrong()`. With padding drawn from the answer's
  // own band, a too-light pick leaves a remainder smaller than the smallest
  // disc — which is the `deadEnd` branch, written for a genuinely stuck child
  // and free by design.
  //
  // Free would mean: four guesses, a gem, a ladder climb, and a floor raised
  // under a child who was guessing. So both endings count now.
  const qs = hostQuestions(400, 0x105e);
  let ended = 0;
  let free = 0;
  let picks = 0;
  for (const q of qs) {
    const spec = specFromQuestion(q);
    if (spec.kind !== "fill" || spec.fillSide === null) continue;
    const start = Math.sign(netTorque(spec, [], null).n);
    for (const weight of spec.rack) {
      if (toKey(weight) === toKey(spec.answer)) continue;
      picks++;
      const placed = [{ id: "x", side: spec.fillSide, peg: PAN_PEG, value: weight }];
      const v = verdictFor(spec, placed, null, start);
      if (v === "continue") continue;
      ended++;
      if (!counts(v)) free++;
    }
  }
  assert.ok(picks > 1000, `expected real coverage, got ${picks}`);
  assert.ok(
    ended / picks > 0.9,
    `only ${((ended / picks) * 100).toFixed(1)}% of wrong picks end the attempt — ` +
      `if most of them are 'continue' this test is not measuring anything`,
  );
  assert.equal(
    free,
    0,
    `${free} of ${ended} wrong picks that ended a board were recorded as nothing`,
  );
  // And the right weight is still right.
  for (const q of qs.slice(0, 40)) {
    const spec = specFromQuestion(q);
    if (spec.kind !== "fill" || spec.fillSide === null) continue;
    const start = Math.sign(netTorque(spec, [], null).n);
    const placed = [{ id: "x", side: spec.fillSide, peg: PAN_PEG, value: spec.answer }];
    assert.equal(verdictFor(spec, placed, null, start), "solved", q.prompt);
  }
});

test("the game records the dish tipping, not just the beam swinging past", () => {
  // `spill()` lives in `Game`, which needs a canvas. The classifier either side
  // of it is measured above; this is the one line that joins them.
  const src = readFileSync(new URL("./game.ts", import.meta.url), "utf8");
  const spill = /private spill\(\): void \{[\s\S]*?\n  \}/.exec(src);
  assert.ok(spill, "game.ts no longer has a spill path");
  assert.match(
    spill[0],
    /this\.errors\+\+/,
    "a spill is not recorded against the child, so a guessed board still earns a gem",
  );
  assert.match(spill[0], /this\.report\(false\)/, "a spill is never reported to the host");
});

// ------------------------------------------------------------- the same run

test("two sittings are not the same run", () => {
  const opening = (host: ReturnType<typeof makeStubHost>): string => {
    const out: string[] = [];
    for (let i = 0; i < 10; i++) out.push(host.next().prompt);
    return out.join(" | ");
  };
  const runs = Array.from({ length: 12 }, () => opening(makeStubHost()));
  const distinct = new Set(runs);
  assert.ok(
    distinct.size >= 11,
    `12 fresh sittings produced only ${distinct.size} distinct runs — a child ` +
      `coming back gets the boards they already did:\n  ${[...distinct].join("\n  ")}`,
  );

  // And specifically not *the* run: the shipped default seed.
  const legacy = opening(makeStubHost({ seed: 0x5eed1e }));
  assert.ok(
    runs.filter((r) => r === legacy).length <= 1,
    "fresh sittings still replay the hardcoded 0x5eed1e run",
  );
});

test("a seed still pins a run exactly, because that is what a seed is for", () => {
  const run = (): string[] => {
    const h = makeStubHost({ seed: 4242 });
    return Array.from({ length: 8 }, () => h.next().prompt);
  };
  assert.deepEqual(run(), run());
  assert.notDeepEqual(run(), Array.from({ length: 8 }, () => makeStubHost({ seed: 99 }).next().prompt));
});

test("freshSeed does not repeat", () => {
  const seeds = new Set(Array.from({ length: 2000 }, () => freshSeed()));
  assert.ok(seeds.size > 1900, `freshSeed collided ${2000 - seeds.size} times in 2000`);
});

// ---------------------------------------------------------------- the ramp

test("a brand new child is asked for the very bottom of the ladder", () => {
  const p = makePacing();
  assert.equal(p.level, FLOOR);
  const r = request(p);
  assert.ok(r.difficulty <= 0.02, `opening request is ${r.difficulty}`);
  assert.ok(r.maxDifficulty <= 0.15, `opening ceiling is ${r.maxDifficulty}`);
});

test("the opening board is small numbers, not two-digit column addition", () => {
  // The founder's first three boards were 19+70, 69+20, 57+40.
  for (const seed of [1, 7, 4242, 0x5eed1e, 99991]) {
    const host = makeStubHost({ seed });
    const q = host.next(request(makePacing()));
    const numerals = (q.prompt.match(/\d+/g) ?? []).map(Number);
    assert.ok(numerals.length > 0, `no numbers in "${q.prompt}"`);
    assert.ok(
      Math.max(...numerals) <= 10,
      `seed ${seed}: the opening board is "${q.prompt}" — nothing on it may be above 10`,
    );
  }
});

test("a host that is asked for a rung serves that rung, not the next one along", () => {
  // Without this the two tests below are vacuous: a host that ignores the
  // request entirely and just counts up still starts at the bottom and still
  // gets harder, so they would pass against the bug they exist to catch. A
  // counter cannot go *back down*, and that is what is asserted.
  const host = makeStubHost({ seed: 5 });
  const hard = host.next({ difficulty: 0.9 });
  const easy = host.next({ difficulty: 0.0 });
  assert.ok(
    easy.difficulty < hard.difficulty,
    `asked for 0.0 straight after 0.9 and got something harder ` +
      `(${easy.difficulty} vs ${hard.difficulty}) — the request is being ignored`,
  );
  const again = host.next({ difficulty: 0.9 });
  assert.ok(again.difficulty > easy.difficulty, "and it cannot climb back");
  // Two questions at the same rung are not the same question.
  const a = makeStubHost({ seed: 5 });
  const ids = new Set(Array.from({ length: 6 }, () => a.next({ difficulty: 0.3 }).id));
  assert.equal(ids.size, 6, "the same rung served the same board six times");
});

test("the game asks the host for a rung — the wire is actually connected", () => {
  // `Game` needs a canvas, a ResizeObserver and a rAF loop, none of which exist
  // in Node, so the one line that joins the pacing to the host is checked where
  // it is written. Everything either side of it is unit tested above.
  const src = readFileSync(new URL("./game.ts", import.meta.url), "utf8");
  const call = /this\.host\.next\(([^)]*)\)/.exec(src);
  assert.ok(call, "game.ts no longer calls host.next at all");
  assert.match(
    call[1],
    /request\(/,
    `game.ts calls host.next(${call[1]}) — it must pass a difficulty request`,
  );
  assert.match(src, /this\.host\.raiseFloor\?\./, "the floor is never reported to the host");
});

test("every number this game puts on the wire survives the host's own reader", () => {
  // Not a re-implementation: this is `toUnit` out of `packs/shared/game-host`,
  // the function the shipped host actually reads a difficulty with. It serves
  // two scales at once —
  //
  //     value < 1   →  a fraction of the ladder, used as is
  //     value >= 1  →  a ladder index, (value − 1) / 9
  //
  // — so `toUnit(1)` is 0. This game speaks fractions, where 1 is the top, and
  // `maxDifficulty` is a *standing* ceiling: one request carrying a literal 1
  // pins the ceiling at 0 for the rest of the session and serves the easiest
  // content in the product to the child who was doing best.
  let p = makePacing();
  for (let board = 0; board <= 60; board++) {
    const r = request(p);
    const askedFor = toUnit(r.difficulty);
    const ceiling = toUnit(r.maxDifficulty);
    assert.ok(
      askedFor !== null && Math.abs(askedFor - r.difficulty) < 1e-9,
      `board ${board}: asked for ${r.difficulty}, the host reads ${askedFor}`,
    );
    assert.ok(
      ceiling !== null && ceiling >= askedFor,
      `board ${board}: ceiling ${r.maxDifficulty} reads as ${ceiling}, below the ` +
        `requested ${askedFor} — the stream is now pinned to the bottom`,
    );
    assert.ok(toUnit(onTheWire(p.floor))! >= 0, "the floor is unreadable");
    p = afterBoard(p, 0);
  }
  // And the top of the ladder is still actually reachable.
  assert.ok(toUnit(request(p).difficulty)! > 0.99, "the ladder cannot be finished");
});

test("the ladder climbs on clean solves and steps back down on wrong ones", () => {
  const host = makeStubHost({ seed: 777 });
  let p = makePacing();
  const rungs: number[] = [];
  for (let i = 0; i < 14; i++) {
    host.next(request(p));
    rungs.push(host.index);
    p = afterBoard(p, 0);
  }
  assert.ok(
    rungs[13] > rungs[0] + 6,
    `fourteen clean boards moved the rung ${rungs[0]} → ${rungs[13]}: ${rungs.join(",")}`,
  );
  assert.ok(rungs.every((r, i) => i === 0 || r >= rungs[i - 1]), `it went backwards: ${rungs}`);

  const high = p.level;
  for (let i = 0; i < 4; i++) p = afterBoard(p, 2);
  assert.ok(p.level < high, `four struggled boards did not ease the ladder: ${high} → ${p.level}`);
  assert.ok(p.level >= p.floor, "it fell through its own floor");
});

test("a rung owned four boards running becomes a floor the host is told about", () => {
  const host = makeStubHost({ seed: 31337 });
  let p = makePacing();
  for (let i = 0; i < 8; i++) {
    host.next(request(p));
    p = afterBoard(p, 0);
    if (p.streak >= 4) host.raiseFloor?.(p.floor);
  }
  assert.ok(p.floor > 0, "eight clean boards raised no floor at all");
  assert.ok(host.floor > 0, "the host was never told");
  // Now fall apart completely. The floor holds.
  for (let i = 0; i < 12; i++) p = afterBoard(p, 3);
  assert.ok(p.level >= p.floor, `${p.level} fell below the floor ${p.floor}`);
  assert.equal(p.floor, host.floor);
});

test("the ladder is bounded at both ends whatever it is fed", () => {
  let p = makePacing();
  for (let i = 0; i < 500; i++) p = afterBoard(p, 0);
  assert.equal(p.level, 1);
  assert.ok(request(p).maxDifficulty <= 1);
  let q = makePacing();
  for (let i = 0; i < 500; i++) q = afterBoard(q, 5);
  assert.equal(q.level, FLOOR);
});
