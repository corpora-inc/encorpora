import test from "node:test";
import assert from "node:assert/strict";
import { CHARS, COLS, ROWS, INK, TRACK, glyphIndex, fmt } from "./glyphs.ts";

/**
 * The atlas is the last thing between a correct answer and a child reading a
 * different number than the one that was drawn.
 */

test("the character set exactly fills the atlas grid", () => {
  assert.equal(CHARS.length, COLS * ROWS, `${CHARS.length} characters in a ${COLS}x${ROWS} atlas`);
  assert.equal(new Set(CHARS).size, CHARS.length, "a character appears twice in the atlas");
});

test("every character an answer can contain has a cell", () => {
  // The contract does not promise integers. `3/4`, `1.5` and `−7` are all
  // legal answers, and every one has to survive the trip to the screen.
  for (const ch of "0123456789/.−+×") {
    assert.ok(CHARS.includes(ch), `"${ch}" has no glyph, so it would not be drawn`);
  }
});

test("an unknown character is visibly wrong, never silently dropped", () => {
  // This is the whole reason `glyphIndex` exists. Skipping the unknown glyph
  // renders "3/4" as "34" — not an unreadable answer, a different one.
  //
  // The exotic cases are written as escapes rather than as literals: several are
  // invisible in an editor, and a stray control character in a source file makes
  // git treat the whole file as binary.
  const q = glyphIndex("?");
  assert.ok(q >= 0);
  const strangers = [
    "%",
    "e",
    "€", // euro sign
    "\u0020", // plain space
    "\u2009", // thin space — the stub host sets its prompts with these
    "▢", // the missing-addend box
    "÷", // division sign: it appears in prompts, which are DOM, not the atlas
    "\u0000", // in case a host ever hands over a truncated string
  ];
  for (const ch of strangers) {
    const cp = ch.codePointAt(0)!.toString(16).toUpperCase().padStart(4, "0");
    assert.equal(glyphIndex(ch), q, `U+${cp} did not fall back to the question mark`);
  }
  for (let i = 0; i < CHARS.length; i++) {
    assert.equal(glyphIndex(CHARS[i]), i, `"${CHARS[i]}" resolved to the wrong cell`);
  }
});

test("the ink metrics are the ones the layout is tuned against", () => {
  // `readband.test.ts` sweeps every viewport using these. If they drift, the
  // legibility floors it asserts are floors on a font nobody ships.
  assert.ok(INK > 0 && INK < 1, `INK ${INK} is not a fraction of a cell`);
  assert.ok(TRACK >= 1 && TRACK < 1.5, `TRACK ${TRACK} is not gentle tracking`);
});

test("ASCII hyphen becomes the typographic minus the atlas has", () => {
  assert.equal(fmt("-7"), "−7");
  assert.equal(fmt("-1-2"), "−1−2");
  assert.equal(fmt("42"), "42");
  assert.equal(fmt(""), "");
  // Already-typographic input must not be double-converted into nothing.
  assert.equal(fmt("−7"), "−7");
  for (const ch of fmt("-7")) assert.ok(CHARS.includes(ch), `fmt emitted "${ch}", which has no glyph`);
});
