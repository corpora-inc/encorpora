import test from "node:test";
import assert from "node:assert/strict";

import {
  LABEL_ASPECT,
  LABEL_CAPACITY,
  LABEL_CAP_RATIO,
  LABEL_CELL_H,
  LABEL_COLS,
  LABEL_ROWS,
  LABEL_EM,
  LABEL_FAULT,
  LABEL_INK_W,
  LABEL_MAX_CHARS,
  LABEL_MIN_ADVANCE_CAPS,
  LABEL_MIN_ADVANCE_EM,
  LabelBook,
  isPrintable,
  labelAdvanceEm,
  labelText,
} from "./labels.ts";
import { BULLET, HALF_W, MAX_HALF_H, MIN_HALF_H, ORB_SPREAD } from "../game/constants.ts";
import { orbValues } from "../game/seal.ts";
import type { Question } from "../contract.ts";
// The REAL stream. `ladder()`, `choicesFor()` and `answerText()` are the host's
// own item service — the same functions that build what `items.next` hands this
// pack — over `@dynawalla/curriculum`'s generators. Nothing here is a stand-in
// for the curriculum, because a stand-in is exactly how the bug this file exists
// for survived: the dev stub host clamps itself to ±40, so the harness never
// showed a single blank orb and the shipped pack showed almost nothing else.
import { answerText, choicesFor, ladder } from "../../../../dynawalla-app/src/packs/items.ts";
import { seedFrom } from "../../../../packs/shared/curriculum/src/index.ts";

const SEEDS = 250;

type Sample = { question: Question; level: number; skill: string };

/** Every item the shipping ladder can serve this pack, as the pack sees it. */
function sweep(): Sample[] {
  const out: Sample[] = [];
  for (const rung of ladder()) {
    for (let s = 0; s < SEEDS; s++) {
      const exercise = rung.family.generate({
        skillId: rung.node.id,
        level: rung.level,
        seed: seedFrom("polarity-test", "dynawalla.polarity", String(s)),
        params: rung.params,
        forms: ["free-entry"],
      });
      const schema = exercise.schema;
      const places =
        schema.kind === "integer" || schema.kind === "columnAlgorithm" ? schema.decimalPlaces : 0;
      const canonical = answerText(exercise.answer.canonical, places);
      if (canonical === null) continue;
      const choices = choicesFor(exercise, places);
      out.push({
        level: rung.level,
        skill: rung.node.id,
        question: {
          id: exercise.exerciseId,
          prompt: "",
          answer: canonical,
          distractors: choices.map((c) => c.text).filter((t) => t !== canonical),
          domain: "add-sub",
          difficulty: 0,
        },
      });
    }
  }
  return out;
}

test("not one orb the shipping curriculum can put on the field comes out blank", () => {
  const items = sweep();
  assert.ok(items.length > 4000, `the sweep only saw ${String(items.length)} items`);

  const book = new LabelBook();
  let orbs = 0;
  let blank = 0;
  let blankItems = 0;
  const worst: string[] = [];

  for (const { question, skill, level } of items) {
    const values = orbValues(question, 4);
    // A value the game cannot display must never be offered. Declining is the
    // sanctioned way to fail; this asserts it never even has to.
    assert.ok(values, `${skill} L${String(level)} produced an item with no drawable answer`);
    assert.ok(values.length >= 1);
    book.beginFrame();
    let blankHere = 0;
    for (const v of values) {
      orbs++;
      const tile = book.tileFor(v);
      const printed = tile < 0 ? null : book.textAt(tile);
      if (printed === null || printed === LABEL_FAULT) {
        blank++;
        blankHere++;
        if (worst.length < 8) worst.push(`${skill} L${String(level)}: ${String(v)}`);
      }
    }
    if (blankHere === values.length) blankItems++;
  }

  const pct = (blank / orbs) * 100;
  assert.equal(
    blank,
    0,
    `${String(blank)}/${String(orbs)} orbs (${pct.toFixed(1)}%) were unlabelled glowing discs, ` +
      `and ${String(blankItems)} items had NO readable option at all. First few: ${worst.join(", ")}`,
  );
  assert.equal(book.faults, 0, "the book was asked to print something that is not an integer");
});

test("every value the ladder emits survives a round trip through a printed numeral", () => {
  for (const { question } of sweep()) {
    const values = orbValues(question, 4);
    assert.ok(values);
    for (const v of values) {
      assert.ok(isPrintable(v), `${String(v)} is not printable`);
      const printed = labelText(v);
      assert.notEqual(printed, LABEL_FAULT, `${String(v)} printed as a fault`);
      // U+2212 in, ASCII out: what is drawn is the value, exactly.
      assert.equal(Number(printed.replace(/−/g, "-")), v);
    }
  }
});

test("a numeral is never absent — magnitude is not a reason to be blank", () => {
  const book = new LabelBook();
  book.beginFrame();
  for (const v of [0, 7, -7, 40, 41, -41, 99, 137, 3916, 998232, -998232]) {
    const tile = book.tileFor(v);
    assert.ok(tile >= 0, `no tile for ${String(v)}`);
    assert.equal(book.textAt(tile), labelText(v));
  }
});

test("a value that is not an integer prints a question mark, loudly, never nothing", () => {
  const book = new LabelBook();
  book.beginFrame();
  const tile = book.tileFor(1.5);
  assert.equal(tile, book.faultTile);
  assert.equal(book.textAt(tile), LABEL_FAULT);
  assert.equal(book.faults, 1);
  assert.equal(isPrintable(1.5), false);
  // and it is refused before it can ever reach an orb
  assert.equal(
    orbValues({ id: "x", prompt: "", answer: "1.5", distractors: [], domain: "d", difficulty: 0 }, 4),
    null,
  );
});

test("a tile is never taken from a numeral that is on screen this frame", () => {
  const book = new LabelBook(9); // eight claimable plus the reserved `?`
  // Ten frames of the same eight numerals, then a ninth arrives: the evicted
  // tile must be one nothing drew this frame, and the on-screen eight must keep
  // printing what they printed.
  const live = [2, -2, 3, -3, 7, 137, 3916, 41];
  let tiles: number[] = [];
  for (let frame = 0; frame < 10; frame++) {
    book.beginFrame();
    tiles = live.map((v) => book.tileFor(v));
    for (let i = 0; i < live.length; i++) {
      assert.equal(book.textAt(tiles[i] as number), labelText(live[i] as number));
    }
  }
  book.beginFrame();
  const kept = live.slice(0, 7).map((v) => book.tileFor(v));
  const fresh = book.tileFor(555);
  assert.ok(!kept.includes(fresh), "a numeral drawn this frame had its tile taken");
  for (let i = 0; i < kept.length; i++) {
    assert.equal(book.textAt(kept[i] as number), labelText(live[i] as number));
  }
  assert.equal(book.overflows, 0);
});

test("a frame that wants too many numerals gets a question mark, not a swap", () => {
  // Deliberately undersized. Nine distinct values into four claimable tiles, all
  // of them drawn in the same frame: the four that got tiles must still be
  // printing what they printed, and the rest must be `?` — never a numeral that
  // silently became a different numeral under a child mid-read, and never blank.
  const errors: unknown[][] = [];
  const real = console.error;
  console.error = (...a: unknown[]) => errors.push(a);
  let book: LabelBook;
  try {
    book = new LabelBook(5);
    book.beginFrame();
    const wanted = [11, 22, 33, 44, 55, 66, 77, 88, 99];
    const got = wanted.map((v) => book.tileFor(v));
    for (let i = 0; i < wanted.length; i++) {
      const printed = book.textAt(got[i] as number);
      assert.ok(printed !== null, `${String(wanted[i])} came out blank`);
      assert.ok(
        printed === labelText(wanted[i] as number) || printed === LABEL_FAULT,
        `${String(wanted[i])} is printing ${String(printed)} — somebody else's numeral`,
      );
    }
    assert.ok(got.includes(book.faultTile), "nothing overflowed, so this test proves nothing");
  } finally {
    console.error = real;
  }
  assert.ok(book.overflows > 0, "the atlas ran out of tiles and said nothing");
  assert.match(String(errors[0]?.[0]), /ran out of tiles/);
});

test("a wide numeral still fits its own orb's lane", () => {
  // THE constraint on how long an answer POLARITY can print. Not the atlas and
  // not the texture: four orbs share `ORB_SPREAD` of the hundred-unit playfield,
  // the label drawn over one is `size * LABEL_ASPECT` wide, and the renderer
  // boosts label size by 1.18 on a narrow phone. Two labels that overlap are
  // worse than one that is condensed, so this is what `LABEL_ASPECT` is capped
  // by — and through it, `LABEL_MAX_CHARS`.
  const lane = ORB_SPREAD / 4;
  const widest = BULLET.orbR * 1.35 * LABEL_ASPECT * 1.18;
  assert.ok(
    widest < lane,
    `a numeral is ${widest.toFixed(1)} wide in a ${lane.toFixed(1)} lane — orbs would collide`,
  );
  // And the outermost orb's numeral stays on the field. Its centre sits at
  // three-eighths of the spread, and the ink is `LABEL_INK_W / (LABEL_CELL_H *
  // LABEL_ASPECT)` of the quad.
  const inkHalf = (widest * (LABEL_INK_W / (LABEL_CELL_H * LABEL_ASPECT))) / 2;
  const edge = (ORB_SPREAD * 3) / 8 + inkHalf;
  assert.ok(edge < HALF_W, `the outer numeral reaches ${edge.toFixed(1)} of ${String(HALF_W)}`);
});

test("the atlas is a whole number of texels wide on every tier, and fits a 2048 texture", () => {
  // The shader addresses a tile as a fraction of `uGrid`, so a cell width the
  // canvas has to round is a cell that samples its neighbour — a silent defect
  // that reads as a font bug. And 2048 is the value WebGL guarantees for
  // `MAX_TEXTURE_SIZE`, which is the ceiling on BOTH dimensions: the old atlas
  // was 2048 × 768, already at it sideways, which is why the cell got its extra
  // width from a squarer grid rather than from a bigger texture.
  for (const cellPx of [96, 128]) {
    const cellW = cellPx * LABEL_ASPECT;
    assert.ok(Number.isInteger(cellW), `a ${String(cellPx)}px cell is ${String(cellW)} texels wide`);
    const texW = LABEL_COLS * cellW;
    const texH = LABEL_ROWS * cellPx;
    assert.ok(texW <= 2048 && texH <= 2048, `the atlas is ${String(texW)} × ${String(texH)}`);
  }
});

test("the longest numeral is derived from the lane, and is not a number somebody typed", () => {
  // `LABEL_MAX_CHARS = 8` used to be a constant whose stated reason — that eight
  // characters "still fits the cell without squeezing" — was false: eight at
  // `LABEL_EM` measure about 365 design units against what was then a 232-unit
  // box, so the widest numeral the old constant permitted was already squeezed
  // to about 0.64 and nothing said so. The budget is the ratio now, and the
  // character count falls out of it.
  assert.ok(
    labelAdvanceEm(LABEL_MAX_CHARS) >= LABEL_MIN_ADVANCE_EM,
    `${String(LABEL_MAX_CHARS)} characters get ${labelAdvanceEm(LABEL_MAX_CHARS).toFixed(4)} em`,
  );
  assert.ok(
    labelAdvanceEm(LABEL_MAX_CHARS + 1) < LABEL_MIN_ADVANCE_EM,
    `${String(LABEL_MAX_CHARS + 1)} characters would also have fitted — the cap is not the geometry`,
  );
  // `48,826 × 82,726` is the program's stated ceiling and ten characters wide.
  assert.ok(
    LABEL_MAX_CHARS >= 10,
    `the widest answer the curriculum reaches is ten characters and this game prints ${String(LABEL_MAX_CHARS)}`,
  );
});

test("the longest numeral clears the canon's cap-height gate on every viewport", () => {
  // `docs/catalog/arcade-canon.json`, on numerals carried by moving objects —
  // which is exactly what an orb is: "minimum 22 rpx cap-height at the moment of
  // decision … This is a hard gate, not a style note." One rpx is a thousand-
  // and-eightieth of the short edge in physical pixels, so a length in rpx is
  // `cssPx * 1080 / shortEdgeCss` and the device pixel ratio cancels out of it.
  //
  // Computed from POLARITY's own constants across the fleet rather than argued.
  // Type size does NOT depend on how long the numeral is — that is the whole
  // point of fitting a numeral to a box rather than shrinking it — so this holds
  // at `LABEL_MAX_CHARS` exactly as it does at one digit.
  const viewports = [
    { w: 360, h: 640, what: "the narrowest phone, portrait" },
    { w: 390, h: 844, what: "a tall phone, portrait" },
    { w: 640, h: 360, what: "a phone, landscape" },
    { w: 834, h: 1112, what: "a tablet, portrait" },
    { w: 1112, h: 834, what: "a tablet, landscape" },
  ];
  for (const { w, h, what } of viewports) {
    const halfH = Math.min(MAX_HALF_H, Math.max(MIN_HALF_H, (HALF_W * h) / w));
    const scale = Math.min(w / (2 * HALF_W), h / (2 * halfH));
    const boost = w < 520 ? 1.18 : 1;
    const quadH = BULLET.orbR * 1.35 * boost * scale; // css px
    const typePx = (LABEL_EM / LABEL_CELL_H) * quadH;
    const rpx = (css: number): number => (css * 1080) / Math.min(w, h);
    assert.ok(
      rpx(typePx * LABEL_CAP_RATIO) >= 22,
      `${what}: cap height is ${rpx(typePx * LABEL_CAP_RATIO).toFixed(1)} rpx, under the canon's 22`,
    );
    // And what LENGTH costs is advance, which is the floor `LABEL_MAX_CHARS` is
    // derived from — restated here in the canon's own units so the two numbers
    // can be read against each other.
    const advanceRpx = rpx(labelAdvanceEm(LABEL_MAX_CHARS) * typePx);
    assert.ok(
      advanceRpx >= 22 * LABEL_MIN_ADVANCE_CAPS,
      `${what}: a digit gets ${advanceRpx.toFixed(1)} rpx of width`,
    );
  }
});

test("the shipping grid is never asked for more numerals in a frame than it holds", () => {
  // The playfield's entire vocabulary at once: chaff ±2..9, charge ±2..8, the
  // float texts they leave behind, four orbs of any magnitude and a lock.
  const distinct = new Set<number>();
  for (let m = 2; m <= 9; m++) {
    distinct.add(m);
    distinct.add(-m);
  }
  for (const v of [3916, 998232, 41, 137, 12]) distinct.add(v);
  // Twice the vocabulary, so the grid is not sized to the exact worst case.
  assert.ok(
    distinct.size * 2 < LABEL_CAPACITY,
    `a frame can want ${String(distinct.size)} numerals and the grid holds ${String(LABEL_CAPACITY)}`,
  );

  const book = new LabelBook();
  book.beginFrame();
  for (const v of distinct) book.tileFor(v);
  assert.equal(book.overflows, 0);
});
