// The locked room.
//
// The founder played COUNTERPOISE, worked out `88965 ÷ 9 = 9885`, and could not
// get out of the board:
//
//     "I had a correct answer not accepted and it wouldn't let me put anything
//      on the scale and I was just stuck 88965/9 == 9885 .. but it rejected that
//      and every other possible choice and I couldn't go anywhere."
//
// This file is the gate on that, and on the three design notes that came with it.
// Every test in here runs the **real** shipping ladder — `ladder()`, `answerText`
// and `choicesFor` out of `dynawalla-app/src/packs/items.ts`, over the real
// generators in `@dynawalla/curriculum` — because a stand-in is exactly how the
// bug survived. `fairness.test.ts` builds host-*shaped* questions by hand and it
// only ever built additions, so nothing in this package had ever seen a `÷`.
//
// Measured against the code this replaced, on 66 rungs × 40 seeds:
//
//     +   640 of 640 boards solvable
//     −   800 of 800
//     ×   800 of 800   — but every one of them a copy: the answer was engraved
//                        on the dish and the child only had to match it
//     ÷     0 of 400   — every division board in the game unsolvable, and
//                        unleavable, because a board is only left by solving it
//
// Ten of the sixty-six active rungs, at ordinates 0.34 through 0.86, were a
// locked room. A child who climbs is guaranteed to reach one.

import { test } from "node:test";
import assert from "node:assert/strict";

import type { DifficultyRequest, Question } from "./contract.ts";
import { frac, isZero, toKey, parseFrac } from "./frac.ts";
import type { Frac } from "./frac.ts";
import {
  MAX_COPIES,
  boardFor,
  lastResortBoard,
  specFromQuestion,
  whyUnsolvable,
  widestNumeral,
} from "./adapter.ts";
import type { BoardLimits } from "./adapter.ts";
import {
  PAN_PEG,
  answeredKey,
  minWeightsForSpec,
  isBalanced,
  netTorque,
  rackCanMake,
  remainingFor,
  verdictFor,
} from "./puzzle.ts";
import type { PlacedItem, PuzzleSpec, Side } from "./puzzle.ts";
import {
  NUMERAL_FACE,
  NUMERAL_MIN_PX,
  charsAtRadius,
  fittedNumeralPx,
  idealNumeralPx,
  layoutForViewport,
  numeralCapacity,
  radiusForChars,
} from "./layout.ts";
import { pull, STEP, TRIES, TRIES_PER_RUNG } from "./pull.ts";
import { afterBoard, afterUnshowableBoard, makePacing } from "./pacing.ts";
import { makeStubHost } from "./stubHost.ts";
// The host's own item service. `ladder()` is the sixty-six rungs that ship;
// `answerText` and `choicesFor` are what fill `Question.answer` and
// `Question.distractors`; the prompt is assembled the way `items.ts` assembles
// it, glyph for glyph, including U+00F7 for division.
import {
  answerText,
  binaryOperator,
  choicesFor,
  ladder,
  operandsOf,
} from "../../../dynawalla-app/src/packs/items.ts";
import { seedFrom } from "../../../packs/shared/curriculum/src/index.ts";

const NO_LIMITS: BoardLimits = { maxNumeralChars: Number.POSITIVE_INFINITY };

/** Every question the shipping ladder can put in front of this pack. */
type Served = { question: Question; rung: string; ordinate: number; operator: string };

const SEEDS = 40;

function sweep(seeds = SEEDS): Served[] {
  const rungs = ladder();
  const out: Served[] = [];
  for (let i = 0; i < rungs.length; i++) {
    const rung = rungs[i];
    const ordinate = i / (rungs.length - 1);
    for (let s = 0; s < seeds; s++) {
      const exercise = rung.family.generate({
        skillId: rung.node.id,
        level: rung.level,
        seed: seedFrom("counterpoise-sweep", "dynawalla.balance", String(s)),
        params: rung.params,
        forms: ["free-entry"],
      });
      const operator = binaryOperator(exercise.prompt.key);
      if (!operator) continue;
      const schema = exercise.schema;
      const places =
        schema.kind === "integer" || schema.kind === "columnAlgorithm" ? schema.decimalPlaces : 0;
      const canonical = answerText(exercise.answer.canonical, places);
      if (canonical === null) continue;
      const operands = operandsOf(exercise);
      out.push({
        rung: `${rung.node.id}#${String(rung.level)}`,
        ordinate,
        operator: operator.glyph,
        question: {
          id: `${exercise.exerciseId}#${String(s)}`,
          prompt: `${operands[0]} ${operator.glyph} ${operands[1]}`,
          answer: canonical,
          distractors: choicesFor(exercise, places)
            .map((c) => c.text)
            .filter((t) => t !== canonical),
          domain: "add-sub",
          difficulty: ordinate,
        },
      });
    }
  }
  return out;
}

/**
 * Is there something a child can do here that gets them out?
 *
 * The whole failure was a board with no such thing, so this is the assertion the
 * game turns on — and it is computed **without calling `whyUnsolvable`**, which is
 * the function `boardFor` uses to decide. That independence is not fussiness. The
 * first version of this helper delegated to `whyUnsolvable`, and measured against
 * two mutants — the original `÷`-as-whitespace lexer, plus `whyUnsolvable` stubbed
 * to `null` — the founder's own locked room and all 400 division boards in the
 * sweep **passed**. A proof checked against itself proves nothing.
 *
 * So, from first principles:
 *
 *   1. There is brass on the rail to pick up at all.
 *   2. The board levels when the answer is put where the answer goes — computed
 *      here with `isBalanced`, the same exact-rational function the game itself
 *      uses to decide a child is right.
 *   3. What has to go in the dish is something the rail can supply.
 *
 * `rackCanMake` is deliberately not used for (3): it answers `true` above its
 * search cap, which is right for the game (not knowing must not be charged to a
 * child as a dead end) and useless in a test. This counts copies directly.
 */
function legalMoveExists(spec: PuzzleSpec): string | null {
  if (spec.rack.length === 0) return "the rack is empty";

  if (spec.kind === "declare") {
    if (!spec.rack.some((r) => toKey(r) === toKey(spec.answer))) {
      return "the answer is not on the rack";
    }
    return isBalanced(spec, [], spec.answer)
      ? null
      : "declaring the answer does not level the beam";
  }
  if (spec.kind !== "fill" || spec.fillSide === null) return null;

  const side = spec.fillSide;
  const put = (values: readonly Frac[]): PlacedItem[] =>
    values.map((value, i) => ({ id: `p${String(i)}`, side, peg: PAN_PEG, value }));

  if (spec.countAnswer) {
    const unit = spec.rack[0];
    if (!unit || isZero(unit)) return "the rack has nothing to count";
    if (spec.answer.d !== 1 || spec.answer.n < 1) return "a count that is not a whole number";
    const n = spec.answer.n;
    if (!isBalanced(spec, put(new Array<Frac>(n).fill(unit)), null)) {
      return `${String(n)} of ${toKey(unit)} does not level the beam`;
    }
    return isBalanced(spec, put(new Array<Frac>(n - 1).fill(unit)), null)
      ? "one fewer weight also levels it, so the count is not the answer"
      : null;
  }

  // The exact object the dish is short by. Found by trying every disc on the rail
  // and every pair of them — enough for every board this game builds, and it is a
  // direct search rather than a call into the code under test.
  for (const a of spec.rack) {
    if (isBalanced(spec, put([a]), null)) {
      return valueMatchesAnswer(spec, a) ? null : `${toKey(a)} levels it but the answer is ${toKey(spec.answer)}`;
    }
  }
  for (const a of spec.rack) {
    for (const b of spec.rack) {
      if (isBalanced(spec, put([a, b]), null)) return null;
    }
  }
  if (isZero(spec.answer) && isBalanced(spec, [], null)) {
    return spec.rack.some((r) => isZero(r)) ? null : "the answer is nothing and there is no zero on the rail";
  }
  return `no weight or pair of weights on the rail levels this board (answer ${toKey(spec.answer)})`;
}

/**
 * The disc that levels the board has to be the answer the host asked for — up to
 * sign, because a balloon dish holds negative mass and `8 − □ = 4` is answered 4.
 * This is the check the locked room failed: 88,974 of brass, answer 9,885.
 */
function valueMatchesAnswer(spec: PuzzleSpec, placed: Frac): boolean {
  const a = spec.answer;
  return (placed.n === a.n && placed.d === a.d) || (placed.n === -a.n && placed.d === a.d);
}

// ------------------------------------------------------------ THE LOCKED ROOM

/** The founder's board, exactly as the host writes it. U+00F7, not a slash. */
const FOUNDER: Question = {
  id: "founder-88965-div-9",
  prompt: "88965 ÷ 9",
  answer: "9885",
  distractors: ["9880", "9890", "88974"],
  domain: "add-sub",
  difficulty: 0.615,
};

test("the founder's board: 88965 ÷ 9 = 9885 has a move, and 9885 is it", () => {
  const board = boardFor(FOUNDER, NO_LIMITS);
  assert.ok(
    board.ok,
    `COUNTERPOISE cannot build the board the founder was stuck on: ${board.ok ? "" : board.detail}`,
  );
  const spec = board.spec;

  // Against the old adapter this was a `fill` board holding 88965 AND 9 in the
  // same dish — 88,974 of brass against a contract answer of 9,885. Nothing on
  // the rack levelled it, and a board is only left by solving it.
  assert.equal(legalMoveExists(spec), null);

  // The apparatus: nine identical sealed crates against the dividend.
  assert.equal(spec.kind, "declare");
  const crates = spec.fixed.filter((f) => f.kind === "crate");
  assert.equal(crates.length, 9, "the divisor is the number of crates");
  const dividend = spec.fixed.find((f) => f.kind === "weight");
  assert.ok(dividend && dividend.kind === "weight");
  assert.equal(toKey(dividend.value), "88965");
  assert.notEqual(
    crates[0].side,
    dividend.side,
    "the crates and the dividend are in the same dish, so nothing is being balanced",
  );

  // And the correct answer is accepted. This is the sentence in the report.
  assert.ok(
    isBalanced(spec, [], frac(9885)),
    "declaring 9885 still does not level the beam",
  );
  assert.ok(
    spec.rack.some((r) => toKey(r) === "9885"),
    `9885 is not on the rack: ${spec.rack.map(toKey).join(" ")}`,
  );
  assert.equal(spec.movementName, "Identical Crates");
});

test("every board the shipping ladder can serve has a legal move", () => {
  const served = sweep();
  assert.ok(served.length > 2000, `the sweep only produced ${String(served.length)} questions`);

  const byRung = new Map<string, { shown: number; refused: number; op: string; ord: number }>();
  for (const s of served) {
    const row = byRung.get(s.rung) ?? { shown: 0, refused: 0, op: s.operator, ord: s.ordinate };
    const board = boardFor(s.question, NO_LIMITS);
    if (!board.ok) {
      row.refused++;
      byRung.set(s.rung, row);
      continue;
    }
    row.shown++;
    byRung.set(s.rung, row);
    const stuck = legalMoveExists(board.spec);
    assert.equal(
      stuck,
      null,
      `${s.rung} (${s.question.prompt} = ${s.question.answer}) built a board with no way out: ${String(stuck)}`,
    );
  }

  // What the pack can and cannot show, pinned by rung.
  //
  // A refusal is not a lockout — `pull` asks again, and the test below proves a
  // board always arrives — but it IS content a child does not get, so the list is
  // written down here rather than discovered later. These seven rungs are
  // multiplications where **neither factor is twelve or under**: `988 × 53` has no
  // countable pile of identical weights, and a beam that sums has no other honest
  // picture of a product. They were "playable" before this change only in the
  // sense that the answer was engraved on the dish and a child could copy it.
  const dead = [...byRung.entries()]
    .filter(([, r]) => r.shown === 0)
    .map(([k]) => k)
    .sort();
  assert.deepEqual(dead, [
    "dw.mul.multidigit.long-multiplication#0",
    "dw.mul.multidigit.long-multiplication#1",
    "dw.mul.multidigit.long-multiplication#2",
    "dw.mul.multidigit.times-two-digit#0",
    "dw.mul.multidigit.times-two-digit#1",
    "dw.mul.multidigit.times-two-digit#2",
    "dw.mul.multidigit.times-two-digit#3",
  ]);
  // Every one of them refused for the stated reason, not for some other one.
  for (const rung of dead) {
    const example = served.find((s) => s.rung === rung);
    assert.ok(example);
    const board = boardFor(example.question, NO_LIMITS);
    assert.equal(board.ok, false);
    assert.match(board.ok ? "" : board.detail, /neither factor is 12 or under/u);
  }
  // And two thirds of the ladder is fully served, which it was not before: the
  // ten division rungs were 0 of 400.
  const whole = [...byRung.values()].filter((r) => r.refused === 0).length;
  assert.equal(byRung.size, 66);
  assert.ok(whole >= 53, `only ${String(whole)} of ${String(byRung.size)} rungs are served in full`);
});

test("zero has an object, so the easiest rungs are not a third refused", () => {
  // `7 − 7 = 0`, `4 − 0 = 4`, `0 × 4 = 0`. Thirteen of every forty
  // `subtract-within-ten` items answer zero, and a zero answer on a fill board
  // means the arm is already flat — there is nothing to add. Refusing them cost a
  // third of the content a six-year-old plays, so zero is a disc that weighs
  // nothing and dropping it in says "this dish needs nothing".
  for (const [prompt, answer] of [
    ["7 − 7", "0"],
    ["0 × 4", "0"],
    ["4 × 0", "0"],
    ["9 − 0", "9"],
  ] as const) {
    const spec = specFromQuestion({
      id: `z-${prompt}`,
      prompt,
      answer,
      distractors: [],
      domain: "add-sub",
      difficulty: 0.02,
    });
    assert.ok(spec, `${prompt} = ${answer} is refused`);
    assert.equal(legalMoveExists(spec), null, `${prompt} = ${answer}`);
    if (answer === "0") {
      assert.ok(
        spec.rack.some((r) => toKey(r) === "0"),
        `${prompt}: the answer is zero and there is no zero on the rail`,
      );
      // The board a child sees: already level, and the correct move is nothing.
      assert.ok(isBalanced(spec, [], null), `${prompt}: the arm is not flat to begin with`);
    }
  }
  // And a zero answer with a non-zero board is still refused: that would be a
  // misread statement, which is the whole class of bug this file closed.
  const lying = boardFor({
    id: "z-lie",
    prompt: "7 − 3",
    answer: "0",
    distractors: [],
    domain: "add-sub",
    difficulty: 0,
  });
  assert.equal(lying.ok, false);
});

test("division is no longer the ten rungs a child cannot leave", () => {
  const division = sweep().filter((s) => s.operator === "÷");
  assert.ok(division.length > 300, `only ${String(division.length)} division items in the sweep`);
  let shown = 0;
  const refusedDivisors = new Set<string>();
  for (const s of division) {
    const board = boardFor(s.question, NO_LIMITS);
    if (!board.ok) {
      // The only sanctioned refusal is a divisor that will not fit in a dish.
      const divisor = /÷\s*(\d+)/u.exec(s.question.prompt)?.[1] ?? "?";
      assert.ok(
        Number(divisor) > MAX_COPIES,
        `${s.question.prompt} was refused with a divisor of ${divisor}, which fits in a dish: ${board.detail}`,
      );
      refusedDivisors.add(divisor);
      continue;
    }
    shown++;
    assert.equal(legalMoveExists(board.spec), null, s.question.prompt);
  }
  // Was 0 of 400. Everything still refused is a two-digit divisor: seventy
  // crates in one dish is not a picture, and that is a declared ceiling rather
  // than a locked room, because `pull` asks again.
  assert.ok(
    shown / division.length > 0.5,
    `only ${String(shown)} of ${String(division.length)} division boards can be shown`,
  );
  for (const d of refusedDivisors) assert.ok(Number(d) > MAX_COPIES);
});

// ------------------------------------------------------- THERE IS ALWAYS A BOARD

/**
 * The stub host with its pre-built board taken off.
 *
 * `makeStubHost` attaches a whole `PuzzleSpec` to every question, and `boardFor`
 * returns it untouched — so driving `pull` through the stub as it comes exercises
 * none of the lexer, none of the four board builders and none of the proof.
 * Measured: with the stub as-is, `TRIES = 1` passed the "always ends with a board"
 * test. Stripping the spec is also what the real host does, since it has no idea
 * what a balance is.
 */
function bareStub(seed: number): (r: DifficultyRequest) => Question {
  const host = makeStubHost({ seed });
  return (r) => {
    const { spec: _spec, ...bare } = host.next(r) as Question & { spec?: unknown };
    return bare;
  };
}

test("pull always ends with a board that has a legal move, at every rung", () => {
  for (let rung = 0; rung <= 1.0001; rung += 0.02) {
    const level = Math.min(1, rung);
    const got = pull(bareStub(0x9885), { level, floor: 0, streak: 0 }, NO_LIMITS);
    assert.equal(
      legalMoveExists(got.spec),
      null,
      `at rung ${level.toFixed(2)} the game produced a board with no move`,
    );
    assert.ok(got.question, `at rung ${level.toFixed(2)} nothing the host offered could be shown`);
  }
});

test("pull runs the real board builders — the stub's own spec is not a free pass", () => {
  // `boardFor` returns an attached `PuzzleSpec` untouched, which is how the
  // standalone shell plays the local ladder. That bypass skips the proof, so a
  // board the shell supplies is trusted rather than checked. Asserted here so the
  // bypass is a decision and not an accident, and so the sweep above is known to
  // be running the parser rather than reading a spec off the wire.
  const withSpec = makeStubHost({ seed: 4 }).next({ difficulty: 0.3 });
  assert.ok((withSpec as { spec?: unknown }).spec, "the stub host stopped attaching a spec");
  const bare = bareStub(4)({ difficulty: 0.3 });
  assert.equal((bare as { spec?: unknown }).spec, undefined);
  const built = boardFor(bare, NO_LIMITS);
  assert.ok(built.ok, `the parser could not rebuild a local-ladder board: ${built.ok ? "" : built.detail}`);
  assert.equal(legalMoveExists(built.spec), null);
});

test("a host that refuses everything still leaves the child something to do", () => {
  // The last line of defence. A host serving nothing this game can draw — a
  // curriculum that has moved on, a wire fault, a pack shipped too old — must
  // still put brass on the screen, because there is no way to skip a board.
  let asked = 0;
  const nonsense = (): Question => {
    asked++;
    return {
      id: `junk-${String(asked)}`,
      // Notation nobody taught this file. It is refused, out loud, by name.
      prompt: "log₂ 64",
      answer: "6",
      distractors: [],
      domain: "add-sub",
      difficulty: 0.5,
    };
  };
  const got = pull(nonsense, makePacing(0.5), NO_LIMITS);
  assert.equal(asked, TRIES, `gave up after ${String(asked)} draws instead of ${String(TRIES)}`);
  assert.equal(got.question, null, "a fallback board must not be reported against a question id");
  assert.equal(got.refusals.length, TRIES);
  assert.equal(got.refusals[0].reason, "unreadable");
  assert.equal(legalMoveExists(got.spec), null, "the fallback board itself has no move");
  // And a run of fallbacks is not the same board over and over.
  const ids = new Set(Array.from({ length: 6 }, (_, i) => lastResortBoard(i).id));
  assert.equal(ids.size, 6);
});

test("a refusal costs the child nothing and does not move where they stand", () => {
  // The step-down inside `pull` is per-board. If it leaked into `Pacing` a child
  // who happened to be near a division rung would be walked down the ladder for
  // something the pack could not draw, which is the pack's problem and not
  // theirs.
  const pacing = { level: 0.62, floor: 0.5, streak: 4 };
  const before = { ...pacing };
  const host = makeStubHost({ seed: 3 });
  // A host that refuses the first nine draws, so the step-down actually runs.
  // With a host that never refuses this assertion is vacuous — measured: the
  // mutant that writes the stepped-down rung straight back into `Pacing` passed.
  let served = 0;
  const got = pull(
    (r) => {
      served++;
      if (served <= 9) {
        return {
          id: `r${String(served)}`,
          prompt: "51800 ÷ 70",
          answer: "740",
          distractors: [],
          domain: "add-sub",
          difficulty: 0.7,
        };
      }
      return host.next(r);
    },
    pacing,
    NO_LIMITS,
  );
  assert.equal(got.refusals.length, 9, "the refusals did not happen, so nothing is being tested");
  assert.deepEqual(pacing, before);
});

test("refusals step DOWN the ladder, never permanently cap it", () => {
  // Why not a standing `maxDifficulty` ceiling, which is the right answer in
  // `polarity`: what this pack cannot show is scattered through the ladder, not
  // stacked on top of it. A ceiling learned from the first division refusal at
  // ordinate 0.34 would delete every addition rung above it too.
  const asked: number[] = [];
  let served = 0;
  const host = makeStubHost({ seed: 7 });
  const refuseFirstFive = (r: { difficulty?: number }): Question => {
    asked.push(r.difficulty ?? -1);
    served++;
    if (served <= 5) {
      return { id: `x${String(served)}`, prompt: "1 ÷ 0", answer: "1", distractors: [], domain: "d", difficulty: 0.5 };
    }
    return host.next(r);
  };
  const got = pull(refuseFirstFive, makePacing(0.8), NO_LIMITS);
  assert.ok(got.question, "never recovered");
  assert.equal(asked.length, 6);
  // `TRIES_PER_RUNG` draws at the rung it was standing on, then a step down.
  const atFirstRung = asked.slice(0, TRIES_PER_RUNG);
  assert.equal(new Set(atFirstRung).size, 1, `the first draws asked ${atFirstRung.join(",")}`);
  assert.ok(asked[TRIES_PER_RUNG] < asked[0], "the draw after the first rung did not step down");
  assert.ok(
    asked[0] - asked[TRIES_PER_RUNG] <= STEP + 1e-9,
    `stepped down ${(asked[0] - asked[TRIES_PER_RUNG]).toFixed(3)} of the ladder in one go`,
  );
  // And the loop is not so deep that it drains the host's prefetch pool. The
  // shared host holds 64 and refills asynchronously, so a loop past that depth
  // gets `lastServed` back forever; `game-host`'s own note is that every retry
  // loop in the repo caps at eight.
  assert.ok(TRIES <= 32, `pull asks the host up to ${String(TRIES)} times for one board`);
});

test("a dry question pool is not reported against, and is not retried out of", () => {
  // Past its prefetch depth the shared host hands back `{ ...lastServed, id: "" }`
  // and drops any report carrying an empty id on the floor. So a pack that treats
  // that as a real question lets a child solve a board and records nothing, while
  // believing it reported — and retrying is pointless, because the same item comes
  // back every time.
  let asked = 0;
  const dry = (): Question => {
    asked++;
    return { id: "", prompt: "3 + 4", answer: "7", distractors: [], domain: "add-sub", difficulty: 0.1 };
  };
  const got = pull(dry, makePacing(0.1), NO_LIMITS);
  assert.equal(asked, 1, `asked a dry pool ${String(asked)} times`);
  assert.equal(got.question, null, "an id-less question was accepted as reportable");
  assert.equal(legalMoveExists(got.spec), null, "and the board it fell back to has no move");
});

test("a board the host never served does not climb the ladder", () => {
  // The fallback board is a one-move `8 = 2 + □`, so a clean solve on it is
  // guaranteed. Running it through `afterBoard` would climb and, after four of
  // them, raise a permanent floor into the region this pack has no picture for —
  // pinning the child at the top of the ladder solving `2 + 6` forever, off the
  // strength of a board the host never saw.
  let p = { level: 0.95, floor: 0.9, streak: 3 };
  const climbed = afterBoard(p, 0);
  assert.ok(climbed.level > p.level, "the control is wrong: a clean solve does climb");

  for (let i = 0; i < 4; i++) p = afterUnshowableBoard(p) as typeof p;
  assert.ok(p.level < 0.95, "four unshowable boards did not step the request down");
  assert.equal(p.streak, 0, "an unshowable board counted towards a clean streak");
  assert.equal(p.floor, 0.9, "an unshowable board moved the floor the host is promised");
  // And the walk-down is bounded below.
  for (let i = 0; i < 60; i++) p = afterUnshowableBoard(p) as typeof p;
  assert.ok(p.level >= 0, "the request walked below the bottom of the ladder");
});

test("the reported string is one the host's own judge would accept", () => {
  // The host does not trust the pack's `correct` flag: it re-parses `answered` and
  // re-checks it. So every board kind has to report the string the *contract*
  // asked for, and two of them did not.
  const cases: Array<[string, string, string]> = [
    // A balloon dish holds negative mass. `8 − □ = 4` is answered 4, and this
    // reported `-4`, which the judge rejects — a child who solved the board was
    // recorded wrong and stepped down for it.
    ["8 − □ = 4", "4", "4"],
    ["47 + □ = 68", "21", "21"],
    ["3 × 5", "15", "15"],
  ];
  for (const [prompt, answer, expected] of cases) {
    const spec = specFromQuestion({
      id: `j-${prompt}`,
      prompt,
      answer,
      distractors: [],
      domain: "add-sub",
      difficulty: 0.3,
    });
    assert.ok(spec, prompt);
    const need = remainingFor(spec, []);
    assert.ok(need);
    const dish: PlacedItem[] = [
      { id: "p", side: spec.fillSide as Side, peg: PAN_PEG, value: need },
    ];
    assert.ok(isBalanced(spec, dish, null), `${prompt}: the solving placement does not level it`);
    assert.equal(
      answeredKey(spec, dish, null),
      expected,
      `${prompt}: solved the board and reported something else`,
    );
  }
});

test("a spilled dish is reported as what was in it, not as an empty one", () => {
  // `spill()` tosses every weight out and then reports. Reading the dish *after*
  // that reports the empty sum, `"0"` — and on a zero-answer board `"0"` is the
  // correct answer, which the host re-judges and accepts. Measured over the real
  // ladder: 43 zero-answer boards, 8 wrong discs each, 344 of 344 recorded as
  // correct. So the dish is read first, and this is that value.
  const spec = specFromQuestion({
    id: "z-report",
    prompt: "1 − 1",
    answer: "0",
    distractors: [],
    domain: "add-sub",
    difficulty: 0,
  });
  assert.ok(spec);
  const wrong = spec.rack.find((r) => !isZero(r));
  assert.ok(wrong, "a zero-answer rack with nothing wrong on it cannot test this");
  const dish: PlacedItem[] = [
    { id: "p", side: spec.fillSide as Side, peg: PAN_PEG, value: wrong },
  ];
  assert.notEqual(
    answeredKey(spec, dish, null),
    "0",
    "a wrong disc in the dish reports the correct answer",
  );
  assert.equal(answeredKey(spec, [], null), "0", "an empty dish is what used to be sent");
});

test("a clean-solve gem is not handed out for a board that takes eleven drags", () => {
  const spec = specFromQuestion({
    id: "gem",
    prompt: "□ × 15 = 165",
    answer: "11",
    distractors: [],
    domain: "algebra",
    difficulty: 0.5,
  });
  assert.ok(spec);
  assert.equal(minWeightsForSpec(spec), 11);
});

// ------------------------------------------------------------- REPRESENTATIONS

test("multiplication is copies of a weight, not the answer engraved on the board", () => {
  const q: Question = {
    id: "mul-3x5",
    prompt: "3 × 5",
    answer: "15",
    distractors: ["8", "35"],
    domain: "add-sub",
    difficulty: 0.22,
  };
  const spec = specFromQuestion(q);
  assert.ok(spec);
  const weights = spec.fixed.filter((f) => f.kind === "weight");
  assert.equal(weights.length, 3, "three fives, one per group");
  for (const w of weights) assert.equal(toKey(w.kind === "weight" ? w.value : frac(0)), "5");
  assert.equal(spec.movementName, "Equal Rows");
  // The point of the whole change: nothing on the apparatus says 15.
  for (const w of weights) {
    assert.notEqual(
      toKey(w.kind === "weight" ? w.value : frac(0)),
      "15",
      "the answer is engraved on the board again",
    );
  }
  assert.equal(legalMoveExists(spec), null);
});

test("the copy bot dies on multiplication — this is what 'identical' was", () => {
  // The founder: "'identical' doesn't do much .. you just put the matching
  // weight on the other side." He was describing the multiplication board: the
  // old adapter collapsed `6 × 2` into a single 12-weight in the dish, so the
  // answer was written on the apparatus. A bot that drags the disc matching the
  // biggest numeral already on the board scored 100% against that.
  const mul = sweep(20).filter((s) => s.operator === "×");
  assert.ok(mul.length > 200, `only ${String(mul.length)} multiplication items`);
  let boards = 0;
  let copied = 0;
  for (const s of mul) {
    const board = boardFor(s.question, NO_LIMITS);
    if (!board.ok) continue;
    boards++;
    const onBoard = board.spec.fixed
      .filter((f) => f.kind === "weight")
      .map((f) => toKey(f.kind === "weight" ? f.value : frac(0)));
    if (!onBoard.includes(toKey(board.spec.answer))) continue;
    copied++;
    // The one place the answer legitimately appears on the apparatus is a factor
    // of one, because "one group of five" IS one five-weight and there is nothing
    // dishonest about drawing it. Anything else is the old copy board coming back.
    assert.match(
      example(board.spec.prompt),
      /(^|\s)1(\s|$)/u,
      `${board.spec.prompt} = ${toKey(board.spec.answer)} has the answer engraved on the board`,
    );
  }
  assert.ok(boards > 100, `only ${String(boards)} multiplication boards could be built`);
  assert.ok(
    copied / boards < 0.15,
    `${String(copied)} of ${String(boards)} multiplication boards are still a copy`,
  );
});

/** The prompt, for an assertion message. */
function example(prompt: string): string {
  return prompt;
}

test("division is identical crates, and it is the divisor that is capped", () => {
  const small = specFromQuestion({
    id: "d1",
    prompt: "24 ÷ 6",
    answer: "4",
    distractors: ["30", "18"],
    domain: "add-sub",
    difficulty: 0.5,
  });
  assert.ok(small);
  assert.equal(small.fixed.filter((f) => f.kind === "crate").length, 6);
  assert.equal(legalMoveExists(small), null);

  // Seventy crates in one dish is not a picture. Refused, by name, with the
  // reason in the message — not faked, and not silently turned into something
  // else, which is what the old code did with every division in the game.
  const big = boardFor({
    id: "d2",
    prompt: "51800 ÷ 70",
    answer: "740",
    distractors: [],
    domain: "add-sub",
    difficulty: 0.7,
  });
  assert.equal(big.ok, false);
  assert.equal(big.ok ? "" : big.reason, "unrepresentable");
  assert.match(big.ok ? "" : big.detail, /70 identical crates/u);
});

test("a missing factor is how many fit, and the count is the answer", () => {
  // `□ × 15 = 165`. The curriculum authored this row and recorded it as blocked
  // ON THIS PACK: "balance's pans add; a missing factor multiplies".
  const spec = specFromQuestion({
    id: "mf",
    prompt: "□ × 15 = 165",
    answer: "11",
    distractors: ["10", "12"],
    domain: "algebra",
    difficulty: 0.5,
  });
  assert.ok(spec, "□ × 15 = 165 still cannot be built");
  assert.equal(spec.countAnswer, true);
  assert.deepEqual(spec.rack.map(toKey), ["15"], "the rack must hold nothing but the unit");
  assert.equal(spec.movementName, "How Many Fit");
  assert.equal(legalMoveExists(spec), null);

  // Eleven fifteens level it, and the answer reported is the count.
  const placed = (n: number): PlacedItem[] =>
    Array.from({ length: n }, (_, i) => ({
      id: `p${String(i)}`,
      side: spec.fillSide as Side,
      peg: PAN_PEG,
      value: frac(15),
    }));
  assert.ok(isBalanced(spec, placed(11), null));
  assert.ok(!isBalanced(spec, placed(10), null));

  // `15 × □ = 165` is the same board.
  const flipped = specFromQuestion({
    id: "mf2",
    prompt: "15 × □ = 165",
    answer: "11",
    distractors: [],
    domain: "algebra",
    difficulty: 0.5,
  });
  assert.ok(flipped);
  assert.deepEqual(flipped.rack.map(toKey), ["15"]);

  // A quotient past what a dish can count is refused rather than heaped.
  const heap = boardFor({
    id: "mf3",
    prompt: "□ × 3 = 900",
    answer: "300",
    distractors: [],
    domain: "algebra",
    difficulty: 0.9,
  });
  assert.equal(heap.ok, false);
});

test("a blank keeps its sign, so 8 − □ = 4 is a balloon", () => {
  // Recorded in the curriculum as blocked on this pack: "balance drops the sign
  // before a box". It did: the lexer read the minus, then pushed a bare blank
  // and threw the sign away, so the board asked `8 + □ = 4`.
  const spec = specFromQuestion({
    id: "ms",
    prompt: "8 − □ = 4",
    answer: "4",
    distractors: ["12", "3"],
    domain: "algebra",
    difficulty: 0.2,
  });
  assert.ok(spec, "8 − □ = 4 still cannot be built");
  assert.equal(spec.movementName, "Lift");
  // The thing you hang is a balloon: every weight on the rail lifts.
  for (const r of spec.rack) assert.ok(r.n < 0, `the rack offers ${toKey(r)}, which sinks`);
  assert.ok(
    isBalanced(spec, [{ id: "p", side: spec.fillSide as Side, peg: PAN_PEG, value: frac(-4) }], null),
    "tying a 4 balloon to the heavy dish does not level it",
  );
  assert.equal(legalMoveExists(spec), null);
});

test("the statement forms the curriculum already emits still build", () => {
  // Measured by the agent that authored `blanks-in-equations`: these three
  // balance correctly and must keep doing so.
  const cases: Array<[string, string]> = [
    ["47 + □ = 68", "21"],
    ["□ − 47 = 68", "115"],
    ["8 + 4 = □ + 5", "7"],
    ["15 − 8", "7"],
    ["19 + 70", "89"],
  ];
  for (const [prompt, answer] of cases) {
    const spec = specFromQuestion({
      id: `st-${prompt}`,
      prompt,
      answer,
      distractors: [],
      domain: "add-sub",
      difficulty: 0.3,
    });
    assert.ok(spec, `${prompt} = ${answer} is no longer buildable`);
    assert.equal(legalMoveExists(spec), null, `${prompt} = ${answer}`);
  }
});

test("the proof and the independent oracle agree on every board in the sweep", () => {
  // `legalMoveExists` above is written from first principles precisely so it can
  // disagree with `whyUnsolvable`, which is what `boardFor` decides on. If the two
  // ever part company one of them is wrong, and finding out from a child is the
  // outcome this whole file exists to prevent.
  for (const s of sweep(6)) {
    const board = boardFor(s.question, NO_LIMITS);
    if (!board.ok) continue;
    const proof = whyUnsolvable(board.spec, board.spec.answer);
    const oracle = legalMoveExists(board.spec);
    assert.equal(
      proof === null,
      oracle === null,
      `${s.question.prompt} = ${s.question.answer}: the proof says ${String(proof)} and the oracle says ${String(oracle)}`,
    );
  }
});

test("a board whose own answer does not solve it is never handed over", () => {
  // The general guard, independent of any operator. A host that sends a wrong
  // answer, or notation that means something this file guessed at, gets a
  // refusal instead of a locked room.
  const lying = boardFor({
    id: "lie",
    prompt: "2 + 2",
    answer: "5",
    distractors: [],
    domain: "add-sub",
    difficulty: 0,
  });
  assert.equal(lying.ok, false);
  assert.equal(lying.ok ? "" : lying.reason, "unrepresentable");
  assert.match(lying.ok ? "" : lying.detail, /its own answer does not solve/u);
});

test("notation nobody taught this game is refused, not treated as whitespace", () => {
  // The exact defect. `÷` used to fall through to a bare `i++`, so an operator
  // became a space and two operands became one dish.
  for (const prompt of ["log₂ 64", "5 ± 2", "√ 49", "3 → 9", "2 ^ 8"]) {
    const board = boardFor({
      id: `n-${prompt}`,
      prompt,
      answer: "6",
      distractors: [],
      domain: "add-sub",
      difficulty: 0,
    });
    assert.equal(board.ok, false, `${prompt} was silently turned into a board`);
    assert.equal(board.ok ? "" : board.reason, "unreadable");
  }
});

// ------------------------------------------------------------------ LEGIBILITY

test("a numeral is never wider than the brass it is engraved on", () => {
  // The founder: "long numbers don't fit on the weights so they just run all
  // over each other." The old line chose `r * 0.78` for anything two digits or
  // more and drew centred, with no reference to the face width at all: at the
  // top of the ladder `4232831450` is about four disc-widths of ink.
  //
  // `fittedNumeralPx` is that line, made pure so it can be measured here rather
  // than on a device. The advance below is the game's serif stack at its
  // widest — every real digit in Palatino, Georgia and Times is narrower.
  const advance = 0.58;
  for (const r of [17, 20, 23, 26, 30, 34, 40]) {
    const face = r * NUMERAL_FACE;
    for (const chars of [1, 2, 3, 4, 6, 8, 10]) {
      const label = "9".repeat(chars);
      const ideal = idealNumeralPx(r, chars);
      const ink = ideal * advance * chars;
      const s = fittedNumeralPx(ideal, ink, face);
      const drawn = s * advance * chars;
      const budgeted = chars <= charsAtRadius(r);
      assert.ok(
        drawn <= face + 0.001 || !budgeted,
        `${label} on r=${String(r)} draws ${drawn.toFixed(1)}px of ink in a ${face.toFixed(1)}px face`,
      );
      assert.ok(
        s >= NUMERAL_MIN_PX,
        `${label} is drawn at ${s.toFixed(1)}px, under the ${String(NUMERAL_MIN_PX)}px floor`,
      );
    }
  }
});

test("the character budget and the radius it needs are the same statement", () => {
  for (let chars = 1; chars <= 12; chars++) {
    assert.ok(
      charsAtRadius(radiusForChars(chars)) >= chars,
      `a disc sized for ${String(chars)} characters reports room for ${String(charsAtRadius(radiusForChars(chars)))}`,
    );
  }
});

test("the disc grows for a wide numeral, and the frame still holds", () => {
  const VIEWPORTS: Array<[string, number, number]> = [
    ["small phone", 320, 568],
    ["phone", 390, 844],
    ["tablet", 768, 1024],
    ["laptop", 1440, 900],
  ];
  for (const [name, w, h] of VIEWPORTS) {
    const narrow = layoutForViewport(w, h, 9, 1);
    const wide = layoutForViewport(w, h, 9, 6);
    // The disc must actually grow, and grow *enough*: `>=` passes for a layout
    // that ignores the argument entirely, which is a mutant this file has been
    // measured against.
    assert.ok(
      charsAtRadius(wide.weightR) >= 6,
      `${name}: a six-figure board got a disc that holds ${String(charsAtRadius(wide.weightR))} ` +
        `(r=${wide.weightR.toFixed(1)}, was ${narrow.weightR.toFixed(1)})`,
    );
    // On a tablet the standard disc already holds six characters and there is
    // nothing to grow. On a phone there is.
    if (charsAtRadius(narrow.weightR) < 6) {
      assert.ok(wide.weightR > narrow.weightR, `${name}: the disc did not grow at all`);
    }
    // The invariant `layout.test.ts` gates on, restated for the grown disc.
    assert.ok(
      wide.rack.y > wide.plinth.y + wide.plinth.h - 0.5,
      `${name}: growing the brass pushed the rack into the plinth`,
    );
    // And the capacity is honest: what it claims, the disc can hold.
    const cap = numeralCapacity(w, h, 9);
    assert.ok(cap >= 4, `${name} claims room for only ${String(cap)} characters`);
    assert.ok(
      radiusForChars(cap) <= layoutForViewport(w, h, 9, cap).weightR + 0.5,
      `${name} claims ${String(cap)} characters it cannot lay out`,
    );
  }
});

test("a remainder too big to search is not charged to the child as a dead end", () => {
  // `rackCanMake` is a coin-change search with a cap on it, and `verdictFor` reads
  // a `false` from it as a *proved* dead end: the dish tips, everything comes
  // back, and an error is recorded against the child. So "I could not check"
  // must not answer "no". The shipped ladder reaches `913072 − 884`, and a
  // measurement-division board with a heavy unit crosses the cap on its first
  // correct placement.
  assert.equal(rackCanMake([frac(3)], frac(90000)), true, "a target past the cap is reported impossible");

  const spec = specFromQuestion({
    id: "big-count",
    prompt: "□ × 5000 = 40000",
    answer: "8",
    distractors: [],
    domain: "algebra",
    difficulty: 0.8,
  });
  assert.ok(spec);
  const startNetSign = Math.sign(netTorque(spec, [], null).n);
  const one: PlacedItem[] = [
    { id: "p", side: spec.fillSide as Side, peg: PAN_PEG, value: frac(5000) },
  ];
  assert.equal(
    verdictFor(spec, one, null, startNetSign),
    "continue",
    "the first of eight correct weights was charged as a dead end",
  );
});

test("a numeral wider than the screen can hold is refused, not squeezed", () => {
  // The `polarity` precedent: measure the real constraint and say no out loud,
  // rather than drawing something a child cannot read.
  const tight: BoardLimits = { maxNumeralChars: 4 };
  // A board that is otherwise perfectly buildable — the top subtraction rung the
  // ladder really serves — so the refusal can only be about the width. Reaching
  // for `80225 × 52762` here would be vacuous: that one is refused for having no
  // countable factor before the width is ever looked at, which is a mutant this
  // file has been measured against.
  const real: Question = {
    id: "wide",
    prompt: "913072 − 884",
    answer: "912188",
    distractors: [],
    domain: "add-sub",
    difficulty: 0.94,
  };
  assert.equal(boardFor(real, NO_LIMITS).ok, true, "the control board is not buildable at all");
  const wide = boardFor(real, tight);
  assert.equal(wide.ok, false);
  assert.equal(wide.ok ? "" : wide.reason, "tooWide");
  assert.match(wide.ok ? "" : wide.detail, /6-character numeral on a disc that holds 4/u);

  const ok = boardFor(
    { id: "ok", prompt: "9 + 8", answer: "17", distractors: [], domain: "add-sub", difficulty: 0 },
    tight,
  );
  assert.equal(ok.ok, true);
});

test("an answer this game cannot weigh is refused, not quietly turned into 1", () => {
  // The old adapter read the answer as `parseFrac(q.answer) ?? frac(1)`. A
  // decimal or a fraction-shaped answer the parser does not take therefore became
  // a board asking for **1**, and a child who worked out the real answer lost.
  // No active rung emits one today — measured, 0 of 2640 — so this is the guard
  // for the day one does, and it is asserted directly rather than through a
  // sweep that cannot reach it.
  for (const answer of ["1.5", "x", "", "12,000", "3 1/2"]) {
    const board = boardFor({
      id: `a-${answer}`,
      prompt: "3 + 4",
      answer,
      distractors: [],
      domain: "add-sub",
      difficulty: 0,
    });
    assert.equal(board.ok, false, `answer ${JSON.stringify(answer)} was silently accepted`);
    assert.equal(board.ok ? "" : board.reason, "unreadable");
  }
});

test("no board the pack shows on a small phone carries a numeral it cannot draw", () => {
  // Deliberately tighter than any real device. A 320×568 phone reports room for
  // ${numeralCapacity(320, 568, 9)} characters and the widest numeral on any board
  // this pack can represent is six, so the real budget never binds and asserting
  // against it proves nothing — measured: the mutant that deletes the width check
  // entirely passed against the real number. Four is what a screen half this size
  // would give, and it is the path under test.
  const real = numeralCapacity(320, 568, 9);
  assert.ok(real >= 6, `a small phone reports room for only ${String(real)} characters`);
  const limits: BoardLimits = { maxNumeralChars: 4 };
  let shown = 0;
  for (const s of sweep(8)) {
    const board = boardFor(s.question, limits);
    if (!board.ok) continue;
    shown++;
    assert.ok(
      widestNumeral(board.spec) <= limits.maxNumeralChars,
      `${s.question.prompt}: a ${String(widestNumeral(board.spec))}-character numeral on a disc that holds ${String(limits.maxNumeralChars)}`,
    );
  }
  assert.ok(shown > 100, `only ${String(shown)} boards survive a four-character budget`);
});

// ------------------------------------------------------------------- REPORTING

test("a measurement-division board reports the count, not the mass", () => {
  const spec = specFromQuestion({
    id: "mf-report",
    prompt: "□ × 15 = 165",
    answer: "11",
    distractors: [],
    domain: "algebra",
    difficulty: 0.5,
  });
  assert.ok(spec);
  const placed = Array.from({ length: 11 }, (_, i) => ({
    id: `p${String(i)}`,
    side: spec.fillSide as Side,
    peg: PAN_PEG,
    value: frac(15),
  }));
  // `165` is what the brass weighs and `11` is what the host asked for. Reporting
  // the mass would mark every correct answer wrong.
  assert.equal(answeredKey(spec, placed, null), "11");
  assert.equal(answeredKey(spec, placed.slice(0, 3), null), "3");
});

test("the sanity of the sweep itself", () => {
  // If `ladder()` or the prompt assembly ever stops producing what this file
  // thinks it does, every assertion above goes quiet. So: the sweep must contain
  // all four operators, and it must contain the founder's own shape.
  const served = sweep(6);
  const ops = new Set(served.map((s) => s.operator));
  assert.deepEqual([...ops].sort(), ["+", "×", "÷", "−"].sort());
  assert.ok(
    served.some((s) => /^\d{4,} ÷ \d+$/u.test(s.question.prompt)),
    "the ladder no longer serves a multi-digit division — the locked room cannot recur here",
  );
  for (const s of served) {
    assert.ok(parseFrac(s.question.answer), `${s.question.prompt} answered ${s.question.answer}`);
  }
});
