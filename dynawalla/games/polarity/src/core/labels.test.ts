import test from "node:test";
import assert from "node:assert/strict";

import {
  LABEL_ASPECT,
  LABEL_CAPACITY,
  LABEL_FAULT,
  LabelBook,
  isPrintable,
  labelText,
} from "./labels.ts";
import { BULLET, HALF_W } from "../game/constants.ts";
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
  // Cells got wider so a four-digit answer keeps its glyph HEIGHT instead of
  // being squeezed flat. That only helps if the wide quad still fits the slot an
  // orb is given: four orbs share `(HALF_W - 12) * 2` of playfield, and the
  // renderer boosts label size by 1.18 on a narrow phone.
  const lane = ((HALF_W - 12) * 2) / 4;
  const widest = BULLET.orbR * 1.35 * LABEL_ASPECT * 1.18;
  assert.ok(
    widest < lane,
    `a numeral is ${widest.toFixed(1)} wide in a ${lane.toFixed(1)} lane — orbs would collide`,
  );
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
