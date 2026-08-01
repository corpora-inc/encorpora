// CAN THE CHILD READ THE NUMBER?
//
// The founder played COUNTERPOISE and said the numerals on the weights "are a
// bit small and not enough contrast for me." Two defects, and a bigger numeral
// in an invisible colour is still an invisible numeral, so this file gates them
// separately: sizes come off `layoutForViewport`, which is the entry point
// `Game.resize` really calls, and contrasts come off the ink constants and the
// surface catalogue `draw.ts` really paints from.
//
// Everything here is measured. "Improved contrast" is not a claim this file can
// make; every assertion below is a number against a named bar.

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  MIN_LETTERFORM,
  MIN_OBJECT,
  balloonGround,
  balloonSurfaces,
  bestSingleInk,
  contrast,
  crateGround,
  crateSurfaces,
  haloFor,
  inkPole,
  luma,
  over,
  plus,
  rgb,
  weightGround,
  weightSurfaces,
  type CrateState,
  type RGB,
} from "./ink.ts";
import { INK_DARK, INK_LIGHT } from "./ink.ts";
import {
  BALLOON_INK,
  WEIGHT_INK,
  crateInk,
  crateState,
  engrave,
  haloWidth,
} from "./draw.ts";
import {
  NUMERAL_ADVANCE_EM,
  NUMERAL_FACE,
  NUMERAL_MIN_PX,
  charsAtRadius,
  fittedNumeralPx,
  idealNumeralPx,
  layoutForViewport,
  numeralCapacity,
  stackedNumeralPx,
} from "./layout.ts";

/** The viewports `layout.test.ts` gates the frame on. Same six, same order. */
const VIEWPORTS: Array<[string, number, number]> = [
  ["phone portrait, small", 320, 568],
  ["phone portrait, tall", 390, 844],
  ["tablet portrait", 768, 1024],
  ["tablet landscape", 1024, 768],
  ["phone landscape", 844, 390],
  ["laptop", 1440, 900],
];

/**
 * Every numeral this pack draws, as the renderer's own constants and functions
 * report them — not as this file remembers them. `WEIGHT_INK` and `BALLOON_INK`
 * are the values `Renderer.weight` and `Renderer.balloon` pass to `numeral`, and
 * `crateInk` is the function `Renderer.crate` calls. A table of colour literals
 * copied into a test would keep passing after the renderer stopped using them.
 */
const ENGRAVED: Array<{
  name: string;
  ink: string;
  ground: () => RGB[];
  surfaces: () => RGB[];
}> = [
  {
    name: "weight — on the rack, in a dish, hung from a peg, or dragged",
    ink: WEIGHT_INK,
    ground: weightGround,
    surfaces: weightSurfaces,
  },
  {
    name: "balloon",
    ink: BALLOON_INK,
    ground: balloonGround,
    surfaces: balloonSurfaces,
  },
  ...(["unknown", "declared", "rejected", "rejectedEmpty"] as CrateState[]).map((state) => ({
    name: `crate — ${state}`,
    ink: crateInk(state),
    ground: () => crateGround(state),
    surfaces: () => crateSurfaces(state),
  })),
];

// ------------------------------------------------------------------- CONTRAST

test("no single ink can read against these surfaces — the halo is not a preference", () => {
  // The load-bearing fact under the whole design. A brass disc's own gradient
  // runs from `#201604` to `#f7e6b4`; an ink clearing 4.5:1 against the light end
  // needs luminance <= 0.138 and against the dark end needs >= 0.215, so no
  // colour clears both and `fillText` alone cannot be fixed by recolouring it.
  //
  // Asserted as a hard ceiling rather than "the old colour was bad", because the
  // weaker statement is true of one colour and this one is true of all 16 million.
  for (const { name, surfaces } of ENGRAVED) {
    const ceiling = bestSingleInk(surfaces());
    assert.ok(
      ceiling < 2,
      `${name}: some single ink reaches ${ceiling.toFixed(2)}:1 — a lone fillText would do`,
    );
  }
});

test("what shipped did not clear even the non-text bar, anywhere", () => {
  // The defect, stated as a measurement so it cannot come back quietly. These are
  // the three colours COUNTERPOISE shipped with, each against the surfaces it was
  // really drawn on and with no halo behind it, which is how it was drawn.
  const shipped: Array<[string, string, RGB[]]> = [
    ["the brass weight", "#ffeec4", weightSurfaces()],
    ["the balloon", "#3a1a08", balloonSurfaces()],
    ["the crate window", "#5fae95", crateSurfaces("rejected")],
  ];
  for (const [name, ink, surfaces] of shipped) {
    let worst = Infinity;
    for (const s of surfaces) worst = Math.min(worst, contrast(rgb(ink), s));
    assert.ok(
      worst < MIN_OBJECT,
      `${name}: ${ink} alone already measured ${worst.toFixed(2)}:1 — this test is asserting nothing`,
    );
  }
});

test("every numeral clears the letterform bar against the halo that rings it", () => {
  for (const { name, ink } of ENGRAVED) {
    const halo = haloFor(ink);
    const c = contrast(rgb(ink), rgb(halo));
    assert.ok(
      c >= MIN_LETTERFORM,
      `${name}: ${ink} on its own halo ${halo} is ${c.toFixed(2)}:1, under ${String(MIN_LETTERFORM)}:1`,
    );
  }
});

test("every numeral clears the object bar on every surface it can land on", () => {
  // Per surface, the better of the two edges the glyph presents: its own ink, or
  // the opaque ring around it. One of them has to separate from the ground or
  // the digit is a smudge. `MIN_OBJECT` is 3.0 and not 4.5 for a reason stated in
  // full in `ink.ts`: 4.5 against an ARBITRARY ground is impossible for any two
  // colours — the crossover is at ground luminance 0.179 and the best achievable
  // there is 4.58:1 with pure black on pure white. The bar is the one that can
  // actually be kept, and the letterform bar above is the strict one.
  for (const { name, ink, surfaces } of ENGRAVED) {
    const halo = rgb(haloFor(ink));
    const i = rgb(ink);
    for (const s of surfaces()) {
      const best = Math.max(contrast(i, s), contrast(halo, s));
      assert.ok(
        best >= MIN_OBJECT,
        `${name}: ${ink}/${haloFor(ink)} on #${s.map((v) => v.toString(16).padStart(2, "0")).join("")} ` +
          `is ${best.toFixed(2)}:1, under ${String(MIN_OBJECT)}:1`,
      );
    }
  }
});

test("the catalogue contains the overlays, not just the gradients", () => {
  // The bars above are only as honest as the list of surfaces they are minimised
  // over, and the surfaces that actually broke were never gradient stops: they
  // were things painted ON TOP of the body and UNDER the numeral. Two of them
  // were missed on the first pass and each was hiding a **1.00:1** — literally
  // the numeral and its ground being the same colour, which is the exact shape
  // of the bug VOLTA was fixed for.
  //
  // So each one is asserted present by construction, from the same blend the
  // canvas uses. A catalogue that quietly stopped listing an overlay would leave
  // every contrast number in this file true and the screen unreadable.
  const has = (list: RGB[], c: RGB, what: string): void => {
    assert.ok(
      list.some((s) => s[0] === c[0] && s[1] === c[1] && s[2] === c[2]),
      `${what} — #${c.map((v) => v.toString(16).padStart(2, "0")).join("")} is not in the catalogue`,
    );
  };
  const weight = weightSurfaces();
  // draw.ts: the bright collar on a player-placed weight, over the specular streak
  has(weight, over(rgb("#fff0ce"), rgb("#f7e6b4"), 0.5), "the collar");
  // draw.ts: the rim struck around the machined top face, whose lower arc crosses
  // the glyph box of every numeral on the disc
  has(weight, over(rgb("#fff4d6"), rgb("#f7e6b4"), 0.6), "the top-face rim");
  // draw.ts: the knurl marks, whose band the ascenders reach into
  has(weight, over(rgb("#322208"), rgb("#201604"), 0.28), "the knurl");

  for (const state of ["unknown", "declared", "rejected", "rejectedEmpty"] as CrateState[]) {
    const crate = crateSurfaces(state);
    const window = crateGround(state);
    // draw.ts: the specular arc across the glass — additive, so it is the
    // brightest thing inside the window and the numeral runs straight under it
    for (const w of window) has(crate, plus(rgb("#ffffff"), w, 0.25), `the ${state} specular arc`);
    // draw.ts: the brass rivets, the brightest thing a spilling label reaches
    has(crate, rgb("#d8b877"), "a rivet");
  }
});

test("the pole is read off the surface, and it disagrees between the objects", () => {
  // The guarantee this file exists to make is not "these five colours are fine",
  // it is "the colour is derived". So: the derivation must actually look at what
  // it is handed. Brass wants a pale glyph and a copper balloon wants a dark one,
  // and `inkPole` returns those two different answers from the two grounds — a
  // stub that ignored its argument and returned "light" could not.
  assert.equal(inkPole(weightGround()), "light", "brass no longer wants a pale numeral");
  assert.equal(inkPole(balloonGround()), "dark", "a bright copper balloon wants a pale numeral?");
  assert.equal(WEIGHT_INK !== BALLOON_INK, true, "the brass and the balloon got the same ink");
  // Every halo is one of the two poles and nothing in between, and BOTH poles
  // are actually reached across the pack — a `haloFor` that always returned the
  // dark one would satisfy "is a pole" on four of the five inks and still leave
  // the balloon's dark numeral ringed in black.
  const halos = new Set(ENGRAVED.map((e) => haloFor(e.ink)));
  for (const h of halos) {
    assert.ok(
      h === INK_LIGHT || h === INK_DARK,
      `${h} is not one of the two poles — a mid-grey halo passes "opposite" and fails contrast`,
    );
  }
  assert.deepEqual([...halos].sort(), [INK_DARK, INK_LIGHT].sort(), "only one pole is ever used");
  assert.equal(haloFor(BALLOON_INK), INK_LIGHT, "the balloon's dark numeral lost its light halo");
  assert.equal(haloFor(WEIGHT_INK), INK_DARK, "the brass numeral lost its dark halo");
});

test("the compositing the catalogue does is the compositing canvas does", () => {
  // `weightSurfaces` and `crateSurfaces` do not list the collar, the knurl, the
  // mist or the win-glow as colours: they COMPOSITE them, because that is what
  // the canvas does and a numeral lands on the result, not on the ingredient. If
  // these two blend modes were wrong the whole table above would be measuring
  // surfaces that never appear on screen.
  assert.deepEqual(over([255, 255, 255], [0, 0, 0], 0.5), [128, 128, 128]);
  assert.deepEqual(over([10, 20, 30], [50, 100, 150], 0), [50, 100, 150]);
  assert.deepEqual(over([10, 20, 30], [50, 100, 150], 1), [10, 20, 30]);
  // "lighter" adds and clamps — it does not average, which is the whole reason
  // the win-glow makes the crate window brighter than either of its parts.
  assert.deepEqual(plus([100, 100, 100], [40, 40, 40], 0.5), [90, 90, 90]);
  assert.deepEqual(plus([255, 255, 255], [40, 40, 40], 1), [255, 255, 255]);
  // Luminance is the sRGB-linearised, green-weighted one, not a channel average:
  // pure green is far brighter to a reader than pure blue at the same value.
  assert.ok(luma(rgb("#00ff00")) > 0.7, "green is not being weighted as green");
  assert.ok(luma(rgb("#0000ff")) < 0.1, "blue is not being weighted as blue");
  assert.equal(contrast(rgb("#000000"), rgb("#ffffff")).toFixed(0), "21");
});

test("the crate has four states, and they are the renderer's four", () => {
  // `crateState` is the predicate `Renderer.crate` runs, exported so this file
  // drives the same branch order rather than a copy of it.
  //
  // Four, not three, and the fourth is the one that hid a defect. The renderer
  // keys the window's BASE colour on `v.declared` alone but the mist on
  // `!v.declared || v.wrong > 0`, so "rejected" splits: with a value still in the
  // window the ground is mist over `#2c2412`, and with the value already cleared
  // it is mist over `#0f1a20`, which is darker and is the worst ground any crate
  // label sits on. A three-state model measured the first and shipped the second.
  //
  // It is reachable: `wrong` decays over ~0.6s and Backspace is live throughout,
  // so undoing inside the rejection window leaves `wrong > 0, declared === null`.
  assert.equal(crateState({ wrong: 0, declared: null }), "unknown", "an untouched crate");
  assert.equal(
    crateState({ wrong: 0, declared: { n: 7, d: 1 } }),
    "declared",
    "a crate holding an accepted value",
  );
  assert.equal(
    crateState({ wrong: 0.5, declared: { n: 7, d: 1 } }),
    "rejected",
    "a rejected value is being drawn as if it had been accepted",
  );
  assert.equal(
    crateState({ wrong: 0.5, declared: null }),
    "rejectedEmpty",
    "a rejection whose value was undone is not being told apart from an untouched crate",
  );

  // A rejection must never be drawn in celebration gold, and must never be
  // mistaken for the unresolved `x`.
  assert.equal(crateInk("rejected"), crateInk("rejectedEmpty"), "one rejection, two colours");
  assert.notEqual(crateInk("rejected"), crateInk("declared"), "wrong and right look alike");
  assert.notEqual(crateInk("rejected"), crateInk("unknown"), "rejected reads as still-unknown");

  // The two grounds really are different, which is the whole reason the state
  // split. If `crateGround` collapsed them this would be the assertion that says so.
  assert.notDeepEqual(
    crateGround("rejected"),
    crateGround("rejectedEmpty"),
    "the two rejection states were modelled as one window",
  );
});

// ----------------------------------------------------------------------- HALO

/** A canvas that draws nothing and remembers everything. */
type Op = { kind: "stroke" | "fill"; text: string; x: number; y: number; style: string; w: number };

function recorder(): { ctx: CanvasRenderingContext2D; ops: Op[] } {
  const ops: Op[] = [];
  const stack: Array<Record<string, unknown>> = [];
  const ctx = {
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 0,
    lineJoin: "miter",
    miterLimit: 10,
    shadowColor: "",
    shadowBlur: 0,
    font: "",
    strokeText(text: string, x: number, y: number) {
      ops.push({ kind: "stroke", text, x, y, style: String(ctx.strokeStyle), w: ctx.lineWidth });
    },
    fillText(text: string, x: number, y: number) {
      ops.push({ kind: "fill", text, x, y, style: String(ctx.fillStyle), w: ctx.lineWidth });
    },
    save() {
      stack.push({
        fillStyle: ctx.fillStyle,
        strokeStyle: ctx.strokeStyle,
        lineWidth: ctx.lineWidth,
      });
    },
    restore() {
      Object.assign(ctx, stack.pop() ?? {});
    },
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, ops };
}

test("the halo is laid down behind the ink, in every direction", () => {
  // The old `engrave` drew one dark copy at `y + 1.4` and then the ink. That is a
  // drop shadow: it separates the glyph from its ground BELOW the glyph and
  // nowhere else, and the brass specular streak that made `#ffeec4` unreadable
  // runs left-to-right. So the ring — a stroke centred on the outline — is the
  // part of this change that makes the contrast table true, and it has to be
  // stroked BEFORE the fill or it would eat the stems it is supposed to be
  // separating.
  const { ctx, ops } = recorder();
  engrave(ctx, "42", 10, 20, "#ffffff", false, 24, "#000000");

  assert.deepEqual(
    ops.map((o) => o.kind),
    ["stroke", "stroke", "fill"],
    "the halo is not two strokes laid down before the ink",
  );
  assert.equal(ops[0]?.style, "#000000", "the offset pass is not in the halo colour");
  assert.equal(ops[1]?.style, "#000000", "the ring is not in the halo colour");
  assert.equal(ops[2]?.style, "#ffffff", "the ink pass is not in the ink colour");

  // The ring is on the glyph's own centre; the shadow is below it. If both
  // landed on `y` the engraved depth would be gone, and if neither did there
  // would be no ring at all — only a fatter drop shadow.
  assert.equal(ops[1]?.y, 20, "the ring is not centred on the glyph");
  assert.ok((ops[0]?.y ?? 0) > 20, `the shadow pass is at y=${String(ops[0]?.y)}, not below`);
  assert.equal(ops[2]?.y, 20, "the ink moved off the glyph's own baseline");
  for (const o of ops) assert.equal(o.text, "42", "a pass drew something other than the numeral");

  // And it is a real ring, not a hairline.
  assert.ok((ops[1]?.w ?? 0) >= 2, `the ring is ${String(ops[1]?.w)}px wide`);
});

test("the halo is wide enough to see and narrow enough to leave the counters open", () => {
  // A stroke is centred, so half of it is outside the glyph and half is inside,
  // where the fill covers it — except in a counter, the hole in a 0, 6, 8 or 9,
  // which nothing fills back in. That is the constraint from the other side, and
  // it is why this is not simply "wider is better".
  // The list starts at `NUMERAL_MIN_PX * 0.8` and not at `NUMERAL_MIN_PX`,
  // because the smallest type this renderer really passes to `engrave` is a
  // stacked fraction's row, which is floored there — and that is exactly where
  // `haloWidth`'s 2px minimum is the largest fraction of the glyph.
  for (const px of [NUMERAL_MIN_PX * 0.8, NUMERAL_MIN_PX, 20, 24, 28, 34, 42]) {
    const w = haloWidth(px);
    assert.ok(w / 2 >= 1, `at ${String(px)}px the halo shows ${(w / 2).toFixed(2)}px outside`);
    assert.ok(
      w / 2 <= px * 0.085,
      `at ${String(px)}px the halo closes ${(w / 2).toFixed(2)}px into each side of a counter`,
    );
  }
});

// ------------------------------------------------------------------------ SIZE

test("a numeral is legible-sized on the smallest phone, not just on a tablet", () => {
  // The founder's other word was "small". These are the sizes a plain two-digit
  // weight is drawn at, measured through `layoutForViewport` — the same entry
  // point `Game.resize` uses — rather than through hand-picked radii.
  //
  // What shipped: 16.1px at 320×568, 19.6px at 390×844, 26.5px on a tablet. The
  // floors below are under the current numbers with a pixel of slack and over
  // every one of the shipped ones, so a revert cannot pass this test.
  const floors: Record<string, number> = {
    "phone portrait, small": 19.5,
    "phone portrait, tall": 24,
    "tablet portrait": 32,
    "tablet landscape": 32,
    "phone landscape": 22,
    laptop: 32,
  };
  for (const [name, w, h] of VIEWPORTS) {
    const L = layoutForViewport(w, h, 9);
    const two = idealNumeralPx(L.weightR, 2);
    const one = idealNumeralPx(L.weightR, 1);
    const floor = floors[name] ?? 0;
    assert.ok(
      two >= floor,
      `${name}: a two-digit weight is ${two.toFixed(1)}px, under the ${String(floor)}px this viewport must clear`,
    );
    // A second digit must not cost a quarter of the type size. The old ratio was
    // 1.02 against 0.78 — a 31% penalty — which is the specific thing that made
    // "12" harder to read than "9" on the same disc. `one >= two` is the ordering
    // (a solo digit may be taller, having no neighbour); `one <= two * 1.25` is
    // the assertion that fails on a revert, since 1.02/0.78 is 1.31.
    assert.ok(
      one >= two,
      `${name}: one digit (${one.toFixed(1)}px) is smaller than two (${two.toFixed(1)}px)`,
    );
    assert.ok(one <= two * 1.25, `${name}: a solo digit is ${(one / two).toFixed(2)}× a pair`);
  }
});

test("the bigger numeral still fits its disc at the widest the ladder serves", () => {
  // Growing the type is only a fix if nothing overflows. Six characters is the
  // widest numeral the shipping ladder produces (`unstuck.test.ts` establishes
  // that from the ladder end); this asserts it from the pixel end, at the real
  // layout each viewport hands back for a six-character board, using the widest
  // digit advance in the game's serif stack.
  for (const [name, w, h] of VIEWPORTS) {
    for (let chars = 1; chars <= 6; chars++) {
      const L = layoutForViewport(w, h, 9, chars);
      const face = L.weightR * NUMERAL_FACE;
      const ideal = idealNumeralPx(L.weightR, chars);
      const drawn = fittedNumeralPx(ideal, ideal * NUMERAL_ADVANCE_EM * chars, face);
      assert.ok(
        drawn * NUMERAL_ADVANCE_EM * chars <= face + 0.001,
        `${name}: ${String(chars)} characters lay ${(drawn * NUMERAL_ADVANCE_EM * chars).toFixed(1)}px of ink in a ${face.toFixed(1)}px face`,
      );
      // The halo is stroked OUTSIDE the ink, and `fittedNumeralPx` never sees it
      // — it fits the ink to `NUMERAL_FACE`, which is what the character budget
      // is priced in and must stay that way. So the real no-overrun guarantee is
      // this one: ink plus halo stays inside the brass, which is `2r` wide at the
      // numeral's own row and not the `1.7r` nominal face.
      const withHalo = drawn * NUMERAL_ADVANCE_EM * chars + haloWidth(drawn);
      assert.ok(
        withHalo <= L.weightR * 2 * 0.98,
        `${name}: ${String(chars)} characters plus halo are ${withHalo.toFixed(1)}px on a ${(L.weightR * 2).toFixed(1)}px disc`,
      );
      assert.ok(
        charsAtRadius(L.weightR) >= chars,
        `${name}: a ${String(chars)}-character board got a disc that holds ${String(charsAtRadius(L.weightR))}`,
      );
    }
  }
});

test("a stacked fraction is a numeral too, and it was the smallest thing here", () => {
  // The size pass nearly shipped having made this WORSE. `Renderer.numeral` sends
  // a `1/2` weight down a different branch that never touches `idealNumeralPx`,
  // so raising `NUMERAL_EM` widened the gap between an integer weight and a
  // fraction on the identical disc instead of closing it. Fractions are real
  // boards: the adapter serves quarters, thirds and halves.
  for (const [name, w, h] of VIEWPORTS) {
    const L = layoutForViewport(w, h, 9);
    const row = stackedNumeralPx(L.weightR);
    const whole = idealNumeralPx(L.weightR, 2);

    // It shipped at a flat `r * 0.5`. Asserting against that ratio rather than
    // against a pixel count is what makes this fail on a revert at EVERY size.
    assert.ok(
      row > L.weightR * 0.5 + 0.5,
      `${name}: a fraction row is ${row.toFixed(1)}px on an r=${L.weightR.toFixed(1)} disc — still r/2`,
    );
    // And it must not have drifted so far that a fraction outgrows an integer.
    assert.ok(
      row < whole,
      `${name}: a fraction row (${row.toFixed(1)}px) is bigger than a whole numeral (${whole.toFixed(1)}px)`,
    );
    // The floor that keeps `haloWidth`'s 2px minimum from closing the counters.
    assert.ok(
      row >= NUMERAL_MIN_PX * 0.8,
      `${name}: a fraction row is ${row.toFixed(1)}px, under the halo's counter floor`,
    );

    // Two rows, a bar and two halos, inside the brass. `numeral` stacks them at
    // -0.58 and +0.60 of the row size around a centre `r * 0.09` below the
    // numeral's own y; the disc's belly reaches `0.78r` below centre and its flat
    // top is at `-0.51r`. This is the assertion that caught the descender poking
    // through the bottom of the brass when the rows were first made bigger.
    const centre = L.weightR * 1.02 * 0.06 + L.weightR * 0.09;
    const lowest = centre + row * 0.6 + row * 0.35 + haloWidth(row) / 2;
    assert.ok(
      lowest <= L.weightR * 0.78,
      `${name}: the denominator reaches ${lowest.toFixed(1)}px, past the brass at ${(L.weightR * 0.78).toFixed(1)}px`,
    );
    const highest = centre - row * 0.58 - row * 0.35 - haloWidth(row) / 2;
    assert.ok(
      highest >= -L.weightR * 0.51,
      `${name}: the numerator reaches ${highest.toFixed(1)}px, above the brass at ${(-L.weightR * 0.51).toFixed(1)}px`,
    );
  }
});

test("making the numerals bigger did not make any board unshowable", () => {
  // The trap this change walked into and backed out of, nailed down.
  //
  // The obvious way to make a numeral bigger is to raise `NUMERAL_MIN_PX`. But
  // `charsAtRadius` DIVIDES by that floor, `numeralCapacity` reports the result
  // to the adapter, and the adapter refuses any board it cannot draw. Measured at
  // rack 9 — the rack size `game.ts` really passes — over every viewport from
  // 280×280 to 1600×1600: a 16px floor stops 3,080 viewports from being able to
  // show a six-character board, a 17px floor stops 7,073, an 18px floor 12,057.
  //
  // **360×800 is one of them.** Pixel-class Android, one of the most common
  // viewports in the world, drops from six characters to five at a 17px floor —
  // and six is the widest numeral the shipping ladder serves. 390×844 goes at
  // 18px. So the size came from `NUMERAL_EM` instead, which the budget
  // arithmetic does not read and which therefore costs no board anywhere.
  //
  // Pinned as an equality at 360×800 because that viewport's margin is exactly
  // zero, so `>= 6` there would still pass at a floor of 16.9. Anyone raising the
  // floor has to come back through this test.
  assert.equal(
    numeralCapacity(360, 800, 9),
    6,
    "a 360×800 Android can no longer show the widest board the ladder serves",
  );
  assert.equal(numeralCapacity(360, 780, 9), 6, "360×780 lost the ladder's widest board");

  // Every viewport the frame is gated on, plus the real device sizes either side
  // of that narrow-and-tall band where the disc-growth walk is at its tightest.
  const devices: Array<[string, number, number]> = [
    ...VIEWPORTS,
    ["Pixel-class Android", 360, 800],
    ["Galaxy-class Android", 384, 854],
    ["iPhone 12/13 mini", 375, 812],
    ["iPhone 15 Pro", 393, 873],
    ["iPhone 14 Plus", 428, 926],
  ];
  for (const [name, w, h] of devices) {
    const cap = numeralCapacity(w, h, 9);
    assert.ok(
      cap >= 6,
      `${name} (${String(w)}×${String(h)}) reports room for only ${String(cap)} characters, ` +
        `and the ladder serves six`,
    );
  }

  // Last, so the failures above speak first: they say WHICH phone lost WHICH
  // board, which is the thing worth knowing. This one only says that the knob
  // moved.
  assert.equal(NUMERAL_MIN_PX, 15, "the character budget was re-priced without re-measuring it");
});
