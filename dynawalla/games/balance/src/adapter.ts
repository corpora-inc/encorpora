// Question -> apparatus.
//
// This file is the whole seam between the host's arithmetic and a brass balance,
// and it is where the founder got locked out of the game:
//
//     "I had a correct answer not accepted and it wouldn't let me put anything
//      on the scale and I was just stuck 88965/9 == 9885 .. but it rejected that
//      and every other possible choice and I couldn't go anywhere."
//
// `88965 ÷ 9 = 9885` is correct. What happened is that the old tokenizer knew
// four tokens — numerals, `x`, `□`, and `+`/`−` — and treated **anything else as
// whitespace**. So `88965 ÷ 9` lexed as two numerals with nothing between them,
// and the board it built was *both operands sitting in the same dish*: 88,974 of
// brass on the left, an empty dish on the right, and a contract that says the
// answer is 9,885. No weight on the rack levels that beam, because the beam was
// never asked the question on the plinth. 9885 spills back out; so does every
// other disc; the board can only be left by solving it; there is nothing to
// solve. That is a permanent dead end and it is the third of its kind in the
// fleet this month (`trebuchet` #698, `foundry` #711, `lattice` #716), always
// from the same root: **a question the game could not represent kept its prompt
// and silently got a different board.**
//
// Two things follow, and they are the shape of this file.
//
// **Nothing is dropped silently.** The lexer is total: a token it does not know
// refuses the whole question, out loud. And every board is *proved* before it is
// handed over — `isBalanced` is run against the contract's own answer, so a board
// whose stated answer does not level it cannot be built at all, whatever new
// notation the curriculum grows next. That check alone would have caught this.
//
// **Every operator gets a physically true apparatus.** The founder's other three
// notes are one design defect between them:
//
//     "'identical' doesn't do much .. you just put the matching weight on the
//      other side"
//     "we need better visual representation of division and multiplication ..
//      I like the balloon for subtraction .. division is trying to do something
//      weird but it doesn't work very well in general"
//
// The balloon works because it is *true*: a balloon pulls up, so subtraction is
// a weight that lifts. Multiplication had no such truth — `6 × 2` was collapsed
// into a single 12-weight, so the answer was engraved on the board and a child
// only had to find the disc that matched. That is the "identical" board, and a
// bot that copies the numeral in the dish scored 100% on it. Division had no
// apparatus at all. Both now have one:
//
//   `3 × 5`         three identical 5-weights in the dish. Physically correct,
//                   countable, and the answer is on no disc on the board.
//   `88965 ÷ 9`     nine identical sealed crates against an 88,965 weight, and
//                   you declare what one crate holds. The only division picture
//                   that survives the curriculum's magnitudes: nine crates is
//                   nine crates whether the quotient is 5 or 9,885, where 9,885
//                   nines is not a picture at all.
//   `□ × 15 = 165`  the rack holds nothing but 15s and the answer is how many
//                   you hang — measurement division, which is what a balance
//                   with one kind of weight on it physically is.
//
// Each of those has a size past which it stops being a picture, and past it the
// question is refused rather than faked. A dish cannot legibly hold seventy
// crates, so `51800 ÷ 70` is above what this pack can show and it says so.

import type { Question } from "./contract.ts";
import type { Frac } from "./frac.ts";
import { frac, parseFrac, toKey, toNumber, isPositive, isZero, eq } from "./frac.ts";
import type { FixedItem, PuzzleSpec, Side } from "./puzzle.ts";
import { APPARATUS, PAN_PEG, isBalanced, rackCanMake, remainingFor } from "./puzzle.ts";
import { makeRng, seedFromString } from "./rng.ts";
import type { Rng } from "./rng.ts";

export type QuestionWithSpec = Question & { spec?: PuzzleSpec };

/**
 * How many identical things one dish may hold and still be read at a glance.
 *
 * Twelve, which is not a round number picked for looks: `seatTarget` stacks a
 * dish in rows of up to five, so twelve is three rows, and twelve is where the
 * multiplication tables the curriculum teaches stop. Thirteen copies of a weight
 * is a heap, and a heap is not a countable picture.
 */
export const MAX_COPIES = 12;

/** Why a question was refused. The game reacts differently to each. */
export type RefusalReason =
  /** A token the grammar does not know. The curriculum grew notation. */
  | "unreadable"
  /** Read fine; a beam that sums cannot show it, or not at this size. */
  | "unrepresentable"
  /** Representable, but a numeral on it would not be legible on this screen. */
  | "tooWide";

export type Refusal = { ok: false; reason: RefusalReason; detail: string };
export type Board = { ok: true; spec: PuzzleSpec } | Refusal;

/** What the screen can currently show. See `numeralBudget` in `layout.ts`. */
export type BoardLimits = {
  /** Widest numeral, in characters, a disc can engrave legibly right now. */
  readonly maxNumeralChars: number;
};

const NO_LIMITS: BoardLimits = { maxNumeralChars: Number.POSITIVE_INFINITY };

// ------------------------------------------------------------------- lexing

const MINUS = /^[−–—-]$/u;

type Tok =
  | { k: "num"; v: Frac }
  | { k: "blank" }
  | { k: "crate"; count: number }
  | { k: "add" }
  | { k: "sub" }
  | { k: "times" }
  | { k: "over" }
  | { k: "eq" };

/**
 * The prompt as tokens, or `null` for a prompt with something in it this game
 * has never been taught to build.
 *
 * Total on purpose. The version this replaced ended its loop with a bare `i++`,
 * which is the line that turned `÷` into a space and a correct answer into a
 * locked room. `null` here is a refusal the caller has to handle, and it is
 * logged: a token arriving that nobody taught this file is a curriculum change,
 * and the only bad way to find out about one is from a child.
 */
export function lex(text: string): Tok[] | null {
  const spaced = text
    .replace(/([+×*÷=−–—-])/gu, " $1 ")
    .replace(/\s+/gu, " ")
    .trim();
  if (spaced === "") return null;
  const out: Tok[] = [];
  for (const part of spaced.split(" ")) {
    if (part === "+") out.push({ k: "add" });
    else if (MINUS.test(part)) out.push({ k: "sub" });
    else if (part === "×" || part === "*") out.push({ k: "times" });
    else if (part === "÷") out.push({ k: "over" });
    else if (part === "=") out.push({ k: "eq" });
    // `□` U+25A1 is the glyph the curriculum writes a blank with, and the glyph
    // this game already engraved on an empty dish. `?` and `_` are kept because
    // older prompts in this repo use them. A triple underscore is deliberately
    // NOT accepted: one blank glyph, pinned by a curriculum test, is the point.
    else if (part === "□" || part === "?" || part === "_") out.push({ k: "blank" });
    else {
      const crate = /^(\d*)x$/iu.exec(part);
      if (crate) {
        out.push({ k: "crate", count: crate[1] === "" ? 1 : Number(crate[1]) });
        continue;
      }
      // `a/b` is a fraction, not a division: `3/4` is one weight. The host writes
      // division with U+00F7, which is lexed above.
      const f = parseFrac(part);
      if (f) {
        out.push({ k: "num", v: f });
        continue;
      }
      return null;
    }
  }
  return out;
}

// ------------------------------------------------------------------ parsing

/** One signed thing on one side of the statement. */
type Item =
  | { k: "num"; sign: 1 | -1; v: Frac }
  | { k: "crate"; sign: 1 | -1; count: number }
  | { k: "blank"; sign: 1 | -1 }
  /** `a × b`, both known. */
  | { k: "product"; sign: 1 | -1; a: Frac; b: Frac }
  /** `a ÷ b`, both known. */
  | { k: "quotient"; sign: 1 | -1; a: Frac; b: Frac }
  /** `□ × b` or `b × □` — the unknown is a count. */
  | { k: "countOf"; sign: 1 | -1; b: Frac };

type Statement = { left: Item[]; right: Item[] };

/** `num | blank | crate`, the operands `×` and `÷` may join. */
type Atom = { k: "num"; v: Frac } | { k: "blank" } | { k: "crate"; count: number };

function parseStatement(toks: readonly Tok[]): Statement | null {
  if (toks.filter((t) => t.k === "eq").length > 1) return null;
  const eqAt = toks.findIndex((t) => t.k === "eq");
  const leftToks = eqAt < 0 ? toks : toks.slice(0, eqAt);
  // A prompt with no equals sign is a question: `15 − 8` means `15 − 8 = □`.
  const rightToks: readonly Tok[] = eqAt < 0 ? [{ k: "blank" }] : toks.slice(eqAt + 1);
  const left = parseSide(leftToks);
  const right = parseSide(rightToks);
  if (!left || !right) return null;
  return { left, right };
}

function parseSide(toks: readonly Tok[]): Item[] | null {
  const out: Item[] = [];
  let sign: 1 | -1 = 1;
  let i = 0;
  // A side is `[sign] atom (op [sign] atom)*`; `×` and `÷` bind two atoms into
  // one item, `+`/`−` start the next one.
  while (i < toks.length) {
    const t = toks[i];
    if (t.k === "add") {
      if (out.length === 0) return null;
      sign = 1;
      i++;
      continue;
    }
    if (t.k === "sub") {
      // The sign belongs to the term that comes next, whether that term is a
      // numeral or a blank. Dropping it on a blank is what made `8 − □ = 4`
      // unbuildable.
      sign = -1;
      i++;
      continue;
    }
    const a = atomOf(t);
    if (!a) return null;
    const next = toks[i + 1];
    if (next && (next.k === "times" || next.k === "over")) {
      const b = atomOf(toks[i + 2]);
      if (!b) return null;
      const joined = join(sign, next.k, a, b);
      if (!joined) return null;
      out.push(joined);
      sign = 1;
      i += 3;
      continue;
    }
    if (a.k === "num") out.push({ k: "num", sign, v: a.v });
    else if (a.k === "crate") out.push({ k: "crate", sign, count: a.count });
    else out.push({ k: "blank", sign });
    sign = 1;
    i++;
  }
  return out.length === 0 ? null : out;
}

function atomOf(t: Tok | undefined): Atom | null {
  if (!t) return null;
  if (t.k === "num") return { k: "num", v: t.v };
  if (t.k === "blank") return { k: "blank" };
  if (t.k === "crate") return { k: "crate", count: t.count };
  return null;
}

function join(sign: 1 | -1, op: "times" | "over", a: Atom, b: Atom): Item | null {
  if (op === "times") {
    if (a.k === "num" && b.k === "num") return { k: "product", sign, a: a.v, b: b.v };
    // `□ × 15` and `15 × □` are the same board: a rack of 15s and a count.
    if (a.k === "blank" && b.k === "num") return { k: "countOf", sign, b: b.v };
    if (a.k === "num" && b.k === "blank") return { k: "countOf", sign, b: a.v };
    return null;
  }
  if (a.k === "num" && b.k === "num") return { k: "quotient", sign, a: a.v, b: b.v };
  return null;
}

// --------------------------------------------------------------------- rack

/** How many weights the rack offers. Nine, as it always did. */
const RACK_SIZE = 9;

/**
 * The rack the child chooses from — and the one defect in this game that made
 * arithmetic optional.
 *
 * The old version did three things, each of which on its own gives the answer
 * away:
 *
 *   1. It threw away any distractor whose magnitude exceeded 30. Every real
 *      mal-rule output for a two-digit sum is a two-digit number, so for
 *      `57 + 40` the host's plausible wrong answers were all discarded.
 *   2. It padded the remainder with 1, 2, 3, … from the bottom.
 *   3. It sorted the result ascending.
 *
 * Together those produced, verbatim, what the founder played:
 *
 *     19 + 70  →  1 2 3 4 5 6 7 8 89
 *     69 + 20  →  1 2 3 4 5 6 7 8 89
 *     57 + 40  →  1 2 3 4 5 6 7 8 97
 *
 * The answer was the only two-digit weight on the rack and it was always the
 * last one. A child does not need to add to win that; they need to notice which
 * brass disc is bigger than the others, and then drag the far right one, every
 * board, forever. Measured against the old code, a bot that drags the rightmost
 * weight and nothing else scored 100%.
 *
 * So: every distractor the host sends is kept (they are mal-rule outputs — that
 * is the whole point of them), the padding is drawn from the answer's own
 * neighbourhood rather than from 1, and the order is shuffled.
 *
 * **And the answer's rank is drawn too.** Shuffling fixes where the disc sits
 * on the rail; it does nothing about where the *number* sits once a child reads
 * the nine of them in order. An earlier pass at this padded symmetrically and
 * then forced at least two weights above and two below, which is a rule that
 * puts the answer in the middle — measured, rank 3, 4 or 5 held it 81.5% of the
 * time and "take the middle one" scored 32.6% against a 11.1% baseline. So the
 * rank is chosen first, uniformly, and the two sides are filled to match it.
 * There is one place that cannot be honoured and it is arithmetic rather than a
 * leak: an answer of 1 has nothing that can go below it.
 *
 * Deterministic given the question id, so a board looks the same if it is
 * rebuilt (a resize does that) and a test can pin it.
 */
function rackFor(answer: Frac, distractors: readonly string[], rng: Rng): Frac[] {
  if (answer.d !== 1) return fractionRack(answer, distractors, rng);

  const negative = !isPositive(answer);
  const mag = Math.abs(answer.n);
  // An answer of zero has no neighbourhood on the positive number line, and a
  // rack of zeroes is not a rack. `0 ÷ 3 = 0` is a real curriculum item, so the
  // zero disc goes on and the padding climbs from one.
  if (mag === 0) {
    const zeros: Frac[] = [frac(0)];
    for (let n = 1; zeros.length < RACK_SIZE; n++) zeros.push(frac(n));
    return rng.shuffle(zeros);
  }

  // The neighbourhood the padding is drawn from. A ±35% band, never narrower
  // than ±4, keeps every weight the same size of number as the answer, so no
  // single disc is conspicuous whatever order they end up in.
  const spread = Math.max(4, Math.min(40, Math.round(mag * 0.35)));

  // The host's own wrong answers, split by which side of the answer they fall.
  // No magnitude filter: a distractor for `57 + 40` is 87 or 107, and dropping
  // those was what left the answer standing alone in the first place.
  const below = new Set<number>();
  const above = new Set<number>();
  for (const d of distractors) {
    if (below.size + above.size >= RACK_SIZE - 1) break;
    const f = parseFrac(d);
    if (!f || f.d !== 1) continue;
    const v = Math.abs(f.n);
    if (v <= 0 || v === mag || v > mag * 4 + 30) continue;
    (v < mag ? below : above).add(v);
  }

  // How many weights read lighter than the answer — which is the answer's rank
  // once a child sorts them in their head. Uniform over the whole rack, then
  // clamped to what the distractors already committed to and to what the number
  // line can supply.
  const roomBelow = Math.max(below.size, Math.min(mag - 1, spread));
  let nBelow = rng.int(0, RACK_SIZE - 1);
  nBelow = Math.min(Math.max(nBelow, below.size), RACK_SIZE - 1 - above.size);
  nBelow = Math.min(nBelow, roomBelow);

  fillSide(below, nBelow, Math.max(1, mag - spread), mag - 1, -1, mag, rng);
  fillSide(above, RACK_SIZE - 1 - nBelow, mag + 1, mag + spread, 1, mag, rng);

  const vals = rng.shuffle([mag, ...below, ...above]);
  return vals.map((n) => frac(negative ? -n : n));
}

/**
 * Fill one side of the answer to exactly `want` distinct values.
 *
 * Random draws inside the band first, then a deterministic walk outward if the
 * band did not have enough distinct integers in it — the walk is what makes
 * this total, and `above` is always satisfiable because there is no ceiling on
 * the number line. `below` is capped by the caller at `mag - 1`, which is the
 * most values that can exist under the answer at all.
 */
function fillSide(
  into: Set<number>,
  want: number,
  lo: number,
  hi: number,
  outward: 1 | -1,
  skip: number,
  rng: Rng,
): void {
  if (hi < lo) return;
  let guard = 0;
  while (into.size < want && guard++ < 400) {
    const v = rng.int(lo, hi);
    if (v >= 1 && v !== skip) into.add(v);
  }
  let v = outward > 0 ? hi + 1 : lo - 1;
  while (into.size < want && v >= 1 && guard++ < 2000) {
    if (v !== skip) into.add(v);
    v += outward;
  }
}

/**
 * The fractional rack. It used to be one frozen list in one frozen order, which
 * did not always contain the answer — `5/6` was unreachable and the board was
 * unsolvable. Now the answer is always on it, the family it belongs to fills
 * the rest, and it is shuffled like every other rack.
 */
function fractionRack(answer: Frac, distractors: readonly string[], rng: Rng): Frac[] {
  const seen = new Set<string>();
  const out: Frac[] = [];
  const push = (f: Frac): void => {
    if (f.n === 0) return;
    const k = toKey(f);
    if (seen.has(k)) return;
    seen.add(k);
    out.push(f);
  };
  const sign = isPositive(answer) ? 1 : -1;
  push(answer);
  for (const d of distractors) {
    if (out.length >= RACK_SIZE) break;
    const f = parseFrac(d);
    if (f && f.d !== 1) push(frac(sign * Math.abs(f.n), f.d));
  }
  // Siblings in the answer's own family, then the standard halves and quarters.
  const den = answer.d;
  for (let n = 1; out.length < RACK_SIZE && n <= den * 2 + 2; n++) {
    push(frac(sign * n, den));
  }
  for (const f of [frac(1, 4), frac(1, 3), frac(1, 2), frac(2, 3), frac(3, 4), frac(1), frac(5, 4), frac(3, 2)]) {
    if (out.length >= RACK_SIZE) break;
    push(frac(sign * f.n, f.d));
  }
  return rng.shuffle(out);
}

// ------------------------------------------------------------------- boards

type Draft = {
  kind: PuzzleSpec["kind"];
  fixed: FixedItem[];
  fillSide: Side | null;
  /** True when the answer is *how many* discs were hung, not what they weigh. */
  countAnswer: boolean;
  rack: Frac[];
  apparatus: number;
};

type Drafted = { ok: true; draft: Draft } | Refusal;

/**
 * The board, or a reason there is none.
 *
 * Total. Every return either carries a spec that has been *proved* to balance at
 * the contract's own answer, or says why no such board exists.
 */
export function boardFor(q: Question, limits: BoardLimits = NO_LIMITS): Board {
  const withSpec = q as QuestionWithSpec;
  if (withSpec.spec) return { ok: true, spec: withSpec.spec };

  const answer = parseFrac(q.answer);
  if (!answer) {
    return refuse(
      "unreadable",
      `answer ${JSON.stringify(q.answer)} for ${JSON.stringify(q.prompt)} is not a rational this game can weigh`,
    );
  }
  const toks = lex(q.prompt);
  if (!toks) {
    return refuse(
      "unreadable",
      `nothing in COUNTERPOISE knows how to build ${JSON.stringify(q.prompt)} — a token in it is not a numeral, a blank, a crate or an operator`,
    );
  }
  const st = parseStatement(toks);
  if (!st) {
    return refuse(
      "unreadable",
      `${JSON.stringify(q.prompt)} is not a statement this game can lay out`,
    );
  }

  // Seeded from the question id, not from a counter: the same question rebuilds
  // to the same board (a resize does that), and two questions never share a
  // rack order just because they arrived in the same position in the run.
  const rng = makeRng(seedFromString(q.id));
  const drafted = draft(st, answer, q, rng);
  if (!drafted.ok) return drafted;
  const d = drafted.draft;

  const spec: PuzzleSpec = {
    id: q.id,
    kind: d.kind,
    mode: "pans",
    fixed: d.fixed,
    answer,
    rack: d.rack,
    fillSide: d.kind === "fill" ? d.fillSide : null,
    hangSlot: null,
    countAnswer: d.countAnswer,
    prompt: q.prompt,
    domain: q.domain,
    difficulty: q.difficulty,
    // The engraving on the plinth names the apparatus in front of the child, not
    // a rung. It used to be `floor(difficulty * 10)` indexed into a list of ten
    // movement names, while the board itself was a plain pair of dishes on every
    // single question the shipped host serves — so the stone announced
    // "IDENTICAL CRATES" over a board that had no crates in it. A name that does
    // not describe what you are looking at is worse than no name.
    movement: d.apparatus,
    movementName: APPARATUS[d.apparatus],
  };

  // The proof. Whatever was built above, the contract's answer must level it —
  // and must be reachable from the rack. This is the check that makes the whole
  // class of bug behind the founder's lockout impossible rather than fixed: a
  // board that cannot be solved by its own answer is never handed over, however
  // the statement was written.
  const unsolvable = whyUnsolvable(spec, answer);
  if (unsolvable) {
    return refuse(
      "unrepresentable",
      `${JSON.stringify(q.prompt)} = ${q.answer} built a board that its own answer does not solve (${unsolvable}) — refused rather than shown`,
    );
  }

  const wide = widestNumeral(spec);
  if (wide > limits.maxNumeralChars) {
    return refuse(
      "tooWide",
      `${JSON.stringify(q.prompt)} = ${q.answer} needs a ${String(wide)}-character numeral on a disc that holds ${String(limits.maxNumeralChars)}`,
    );
  }
  return { ok: true, spec };
}

function refuse(reason: RefusalReason, detail: string): Refusal {
  // Loud, always. A refusal is content a child does not get to play, and the
  // only thing worse than a pack that cannot show a question is a pack that
  // cannot show a question quietly.
  console.error(`[counterpoise] ${reason}: ${detail}`);
  return { ok: false, reason, detail };
}

function draft(st: Statement, answer: Frac, q: Question, rng: Rng): Drafted {
  const all = [...st.left, ...st.right];
  const products = all.filter((i) => i.k === "product").length;
  const quotients = all.filter((i) => i.k === "quotient").length;
  const counts = all.filter((i) => i.k === "countOf").length;
  const blanks = all.filter((i) => i.k === "blank").length;

  if (products + quotients + counts > 1) {
    return refuse(
      "unrepresentable",
      `${JSON.stringify(q.prompt)} has two operations a beam must show as objects; one board cannot hold both`,
    );
  }
  if (counts === 1) return countBoard(st, answer, q);
  if (quotients === 1) return crateBoard(st, answer, q, rng);
  if (products === 1) return productBoard(st, answer, q, rng);
  if (blanks > 1) {
    return refuse(
      "unrepresentable",
      `${JSON.stringify(q.prompt)} has ${String(blanks)} blanks; a dish can only be filled once`,
    );
  }
  return sumBoard(st, answer, q, rng);
}

const SIDES = [
  [0, -1 as Side],
  [1, 1 as Side],
] as const;

function sidesOf(st: Statement): ReadonlyArray<readonly [readonly Item[], Side]> {
  return SIDES.map(([which, side]) => [which === 0 ? st.left : st.right, side] as const);
}

/**
 * `a + b = □`, `47 + □ = 68`, `15 − 8`, `8 − □ = 4`.
 *
 * Everything is a weight in a dish, a negative one is a balloon, and the one
 * blank is the dish being filled. **The blank keeps its sign**, which it did not
 * before: `8 − □ = 4` lexed the minus, then pushed a bare blank and threw the
 * sign away, so the board asked `8 + □ = 4` and no weight on earth solved it. A
 * negatively signed blank is the founder's favourite object — you tie a balloon
 * to the heavy dish until the arm comes level.
 */
function sumBoard(st: Statement, answer: Frac, q: Question, rng: Rng): Drafted {
  const fixed: FixedItem[] = [];
  let fill: Side | null = null;
  let fillSign: 1 | -1 = 1;
  let crates = 0;
  for (const [items, side] of sidesOf(st)) {
    for (const it of items) {
      if (it.k === "num") {
        fixed.push({ kind: "weight", side, peg: PAN_PEG, value: signed(it.sign, it.v) });
      } else if (it.k === "crate") {
        crates += it.count;
        for (let i = 0; i < it.count; i++) fixed.push({ kind: "crate", side, peg: PAN_PEG });
      } else if (it.k === "blank") {
        fill = side;
        fillSign = it.sign;
      } else {
        return refuse("unrepresentable", `${JSON.stringify(q.prompt)} is not a sum of weights`);
      }
    }
  }
  if (crates > MAX_COPIES) {
    return refuse(
      "unrepresentable",
      `${JSON.stringify(q.prompt)} wants ${String(crates)} crates in one dish; ${String(MAX_COPIES)} is the most a dish holds`,
    );
  }
  const kind: PuzzleSpec["kind"] = crates > 0 ? "declare" : "fill";
  if (kind === "fill" && fill === null) {
    return refuse(
      "unrepresentable",
      `${JSON.stringify(q.prompt)} has nothing to fill and no crate to declare`,
    );
  }
  // The object the child must place: the answer as the *dish* sees it. On
  // `8 − □ = 4` the answer is 4 and the thing you hang is a balloon of 4.
  const placed = fillSign < 0 ? neg(answer) : answer;
  const apparatus =
    answer.d !== 1
      ? APPARATUS_FRACTIONS
      : crates > 1
        ? APPARATUS_CRATES
        : crates === 1
          ? APPARATUS_CRATE
          : hasLift(fixed) || fillSign < 0
            ? APPARATUS_LIFT
            : APPARATUS_DISHES;
  return {
    ok: true,
    draft: {
      kind,
      fixed,
      fillSide: fill,
      countAnswer: false,
      rack: rackFor(kind === "declare" ? answer : placed, q.distractors, rng),
      apparatus,
    },
  };
}

/**
 * `3 × 5` — three identical 5-weights in one dish, and you fill the other.
 *
 * The physical truth multiplication has on a balance, and it is exact: three
 * fives really do weigh fifteen. It is countable, it teaches repeated addition
 * without a word of instruction, and — the part that matters against what this
 * replaced — **no disc on the board carries the answer**. The old code collapsed
 * `6 × 2` into one 12-weight, engraved the answer on the apparatus, and asked a
 * child to match it.
 *
 * Which factor becomes the count is decided by what fits in a dish, because
 * `a × b` and `b × a` are the same brass. Neither factor small enough to count
 * means there is no picture here, and the question is refused.
 */
function productBoard(st: Statement, answer: Frac, q: Question, rng: Rng): Drafted {
  const fixed: FixedItem[] = [];
  let fill: Side | null = null;
  let sawProduct = false;
  for (const [items, side] of sidesOf(st)) {
    for (const it of items) {
      if (it.k === "product") {
        sawProduct = true;
        const pick = countAndUnit(it.a, it.b);
        if (!pick) {
          return refuse(
            "unrepresentable",
            `${JSON.stringify(q.prompt)}: neither factor is ${String(MAX_COPIES)} or under, so there is no countable pile of identical weights that shows it`,
          );
        }
        for (let i = 0; i < pick.count; i++) {
          fixed.push({ kind: "weight", side, peg: PAN_PEG, value: signed(it.sign, pick.unit) });
        }
      } else if (it.k === "num") {
        fixed.push({ kind: "weight", side, peg: PAN_PEG, value: signed(it.sign, it.v) });
      } else if (it.k === "blank") {
        fill = side;
      } else {
        return refuse(
          "unrepresentable",
          `${JSON.stringify(q.prompt)} mixes a product with something a dish cannot hold beside it`,
        );
      }
    }
  }
  if (fill === null || !sawProduct) {
    return refuse("unrepresentable", `${JSON.stringify(q.prompt)} has a product but nothing to fill`);
  }
  return {
    ok: true,
    draft: {
      kind: "fill",
      fixed,
      fillSide: fill,
      countAnswer: false,
      rack: rackFor(answer, q.distractors, rng),
      apparatus: APPARATUS_ROWS,
    },
  };
}

/**
 * `a × b` as a count of identical weights: the smaller factor is the count.
 *
 * A factor of zero is zero copies, which is an empty dish — physically exact, and
 * the answer is nothing. `0 × 4` and `4 × 0` are real items on the two easiest
 * multiplication rungs and both draw the same true picture.
 */
export function countAndUnit(a: Frac, b: Frac): { count: number; unit: Frac } | null {
  if (a.d !== 1 || b.d !== 1) return null;
  const av = Math.abs(a.n);
  const bv = Math.abs(b.n);
  if (av === 0 || bv === 0) return { count: 0, unit: frac(0) };
  const count = Math.min(av, bv);
  if (count > MAX_COPIES) return null;
  return { count, unit: frac(count === av ? bv : av) };
}

/**
 * `88965 ÷ 9` — nine identical sealed crates against an 88,965 weight, and the
 * child declares what one crate holds.
 *
 * This is the division board, and it is chosen over the alternatives because it
 * is the only one still a *picture* at the sizes the curriculum serves. The
 * obvious quotative reading — "how many nines balance 88,965" — is exactly true
 * and completely unshowable: 9,885 discs. Splitting a weight into equal parts is
 * not something brass does. Nine identical closed boxes balancing a known total
 * is honest, it is a thing that exists, it is the same nine boxes whatever the
 * quotient turns out to be, and it is the apparatus this game already had and
 * never used.
 *
 * The limit is the divisor, not the answer: a dish holds twelve crates and no
 * more, so `51800 ÷ 70` has no board here and says so out loud.
 */
function crateBoard(st: Statement, answer: Frac, q: Question, rng: Rng): Drafted {
  const fixed: FixedItem[] = [];
  let crates = 0;
  for (const [items, side] of sidesOf(st)) {
    for (const it of items) {
      if (it.k === "quotient") {
        if (it.b.d !== 1 || it.b.n === 0) {
          return refuse(
            "unrepresentable",
            `${JSON.stringify(q.prompt)} divides by something that is not a whole number of crates`,
          );
        }
        crates = Math.abs(it.b.n);
        if (crates > MAX_COPIES) {
          return refuse(
            "unrepresentable",
            `${JSON.stringify(q.prompt)} needs ${String(crates)} identical crates in one dish; a dish holds ${String(MAX_COPIES)}, so this division has no honest picture on a beam`,
          );
        }
        for (let i = 0; i < crates; i++) fixed.push({ kind: "crate", side, peg: PAN_PEG });
        // The dividend hangs opposite the crates it is balancing.
        fixed.push({ kind: "weight", side: flip(side), peg: PAN_PEG, value: signed(it.sign, it.a) });
      } else if (it.k === "num") {
        fixed.push({ kind: "weight", side, peg: PAN_PEG, value: signed(it.sign, it.v) });
      } else if (it.k === "blank") {
        // `88965 ÷ 9` arrives with an implicit `= □`. The crate IS the blank.
      } else {
        return refuse(
          "unrepresentable",
          `${JSON.stringify(q.prompt)} mixes a quotient with something a dish cannot hold beside it`,
        );
      }
    }
  }
  if (crates === 0) {
    return refuse(
      "unrepresentable",
      `${JSON.stringify(q.prompt)} has a quotient with no divisor to make crates from`,
    );
  }
  return {
    ok: true,
    draft: {
      kind: "declare",
      fixed,
      fillSide: null,
      countAnswer: false,
      rack: rackFor(answer, q.distractors, rng),
      apparatus: crates > 1 ? APPARATUS_CRATES : APPARATUS_CRATE,
    },
  };
}

/**
 * `□ × 15 = 165` — one dish holds 165, the rack holds nothing but 15s, and the
 * answer is how many you hang.
 *
 * Measurement division, and the most literally physical board in the game: a
 * balance loaded with one kind of weight is a ruler, and this is measuring 165
 * with it. The count is the answer, so `answeredKey` reports how many discs are
 * in the dish rather than what they weigh — see `puzzle.ts`.
 *
 * A child who knows their fifteens hangs eleven and is done. A child who does
 * not counts by fifteens and watches the arm come up, which is the same
 * arithmetic done out loud. Capped at twelve, for the same reason as every other
 * pile: past that it is a heap and not a count.
 */
function countBoard(st: Statement, answer: Frac, q: Question): Drafted {
  if (answer.d !== 1 || answer.n < 1 || answer.n > MAX_COPIES) {
    return refuse(
      "unrepresentable",
      `${JSON.stringify(q.prompt)} = ${q.answer} would need ${q.answer} identical weights in one dish; ${String(MAX_COPIES)} is the most that reads as a count`,
    );
  }
  const fixed: FixedItem[] = [];
  let fill: Side | null = null;
  let unit: Frac | null = null;
  for (const [items, side] of sidesOf(st)) {
    for (const it of items) {
      if (it.k === "countOf") {
        unit = signed(it.sign, it.b);
        fill = side;
      } else if (it.k === "num") {
        fixed.push({ kind: "weight", side, peg: PAN_PEG, value: signed(it.sign, it.v) });
      } else {
        return refuse(
          "unrepresentable",
          `${JSON.stringify(q.prompt)} mixes a missing factor with something else`,
        );
      }
    }
  }
  if (!unit || fill === null || isZero(unit)) {
    return refuse(
      "unrepresentable",
      `${JSON.stringify(q.prompt)} has a missing factor with no weight to count`,
    );
  }
  return {
    ok: true,
    draft: {
      kind: "fill",
      fixed,
      fillSide: fill,
      countAnswer: true,
      // One kind of weight on the rail, and as many as you like. That IS the
      // board: offering anything else would let a child level the beam with a
      // single 165 and report a count of one.
      rack: [unit],
      apparatus: APPARATUS_HOW_MANY,
    },
  };
}

// -------------------------------------------------------------------- proof

/**
 * Why the contract's answer does not solve this board, or `null` if it does.
 *
 * The proof, and the reason the founder's lockout is a class of bug that is now
 * closed rather than a bug that is fixed. Every board goes through it before it
 * is handed over, so a statement this file misreads — today's `÷`, tomorrow's
 * whatever — produces a refusal and a log line instead of a room with no door.
 */
export function whyUnsolvable(spec: PuzzleSpec, answer: Frac): string | null {
  if (spec.kind === "declare") {
    if (!spec.rack.some((r) => eq(r, answer))) return "the answer is not on the rack";
    return isBalanced(spec, [], answer) ? null : "declaring the answer does not level the beam";
  }
  if (spec.kind === "fill") {
    if (spec.fillSide === null) return "there is no dish to fill";
    if (spec.countAnswer) {
      const unit = spec.rack[0];
      if (!unit || isZero(unit)) return "the rack has nothing to count";
      const placed = Array.from({ length: answer.n }, (_, i) => ({
        id: `p${String(i)}`,
        side: spec.fillSide as Side,
        peg: PAN_PEG,
        value: unit,
      }));
      return isBalanced(spec, placed, null)
        ? null
        : "that many of the rack weight does not level the beam";
    }
    // What the dish is actually short by. This — not the contract's answer as
    // written — is the object the child has to produce, and comparing the two is
    // the check that catches a misread statement: on `88965 ÷ 9` the dish was
    // short by 88,974 while the contract said 9,885, and nothing noticed.
    //
    // Compared up to sign, because a signed blank is a real board: `8 − □ = 4` is
    // answered 4 and solved by hanging a balloon of 4.
    const need = remainingFor(spec, []);
    if (!need) return "there is nothing to compute";
    if (isZero(need)) {
      // The arm is already flat and the answer is nothing. `7 − 7`, `0 × 4`, and
      // every other zero the curriculum's easiest rungs are full of — thirteen of
      // every forty `subtract-within-ten` items. Refusing them meant refusing a
      // third of the content a six-year-old plays, so zero gets an object: a
      // brass disc engraved `0`, which weighs nothing, and dropping it in says
      // "this dish needs nothing" out loud. It is the one board where the arm is
      // level before the child touches it, and that is the idea.
      if (!isZero(answer)) return `the dish needs nothing but the answer is ${toKey(answer)}`;
      return spec.rack.some((r) => isZero(r)) ? null : "there is no zero on the rack";
    }
    if (!eq(need, answer) && !eq(need, neg(answer))) {
      return `the dish is short by ${toKey(need)} but the answer is ${toKey(answer)}`;
    }
    // Reachable from the rail: the exact disc, or a handful of them. The local
    // ladder builds boards that want two weights and that is a legitimate board.
    if (!spec.rack.some((r) => eq(r, need)) && !rackCanMake(spec.rack, need)) {
      return `${toKey(need)} cannot be made from the rack`;
    }
    return null;
  }
  return null;
}

/** The widest numeral that will be engraved on a disc on this board. */
export function widestNumeral(spec: PuzzleSpec): number {
  let n = 0;
  for (const f of spec.fixed) {
    if (f.kind === "weight") n = Math.max(n, engravedLength(f.value));
  }
  for (const r of spec.rack) n = Math.max(n, engravedLength(r));
  return n;
}

/** Characters as `Renderer.numeral` draws them: `−` counts, a fraction stacks. */
function engravedLength(f: Frac): number {
  if (f.d !== 1) return Math.max(String(Math.abs(f.n)).length, String(f.d).length);
  return String(Math.abs(f.n)).length + (f.n < 0 ? 1 : 0);
}

// ------------------------------------------------------------------- helpers

const APPARATUS_DISHES = 0;
const APPARATUS_LIFT = 1;
const APPARATUS_ROWS = 2;
const APPARATUS_HOW_MANY = 3;
const APPARATUS_CRATE = 4;
const APPARATUS_CRATES = 5;
const APPARATUS_FRACTIONS = 6;

function signed(sign: 1 | -1, v: Frac): Frac {
  return sign < 0 ? neg(v) : v;
}
function neg(v: Frac): Frac {
  return frac(-v.n, v.d);
}
function flip(s: Side): Side {
  return s === 1 ? -1 : 1;
}
function hasLift(fixed: readonly FixedItem[]): boolean {
  return fixed.some((f) => f.kind === "weight" && f.value.n < 0);
}

/**
 * The old entry point, kept for the standalone shell and for the tests that pin
 * rack fairness. `null` is a refusal — see `boardFor` for why there is one.
 */
export function specFromQuestion(q: Question, limits?: BoardLimits): PuzzleSpec | null {
  const board = boardFor(q, limits);
  return board.ok ? board.spec : null;
}

/**
 * A board when there is no question — the guarantee that a child is never
 * looking at a screen with nothing on it and nothing to do.
 *
 * Built here rather than by borrowing `generate.puzzleAt`, because that function
 * is the entire standalone ladder and importing it would pull all of it into the
 * shipped pack bundle to cover a case that should never fire. `n` walks the sum
 * so a run of fallbacks is not the same board over and over.
 */
export function lastResortBoard(n: number): PuzzleSpec {
  const total = 4 + (n % 6);
  const have = 1 + (n % 3);
  const answer = frac(total - have);
  const rng = makeRng(seedFromString(`fallback-${String(n)}`));
  return {
    id: `bal-fallback-${String(n)}`,
    kind: "fill",
    mode: "pans",
    fixed: [
      { kind: "weight", side: -1, peg: PAN_PEG, value: frac(total) },
      { kind: "weight", side: 1, peg: PAN_PEG, value: frac(have) },
    ],
    answer,
    rack: rackFor(answer, [], rng),
    fillSide: 1,
    hangSlot: null,
    countAnswer: false,
    prompt: `${String(total)} = ${String(have)} + □`,
    domain: "add-sub",
    difficulty: 0,
    movement: APPARATUS_DISHES,
    movementName: APPARATUS[APPARATUS_DISHES],
  };
}

/** Only used by the standalone shell's debug overlay. */
export function describeSpec(s: PuzzleSpec): string {
  return `${s.kind}/${s.mode} answer=${toNumber(s.answer)}`;
}
