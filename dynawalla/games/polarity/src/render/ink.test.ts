import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  AA_WIDTHS,
  FLOAT_HOLD,
  HALO_ALPHA,
  INK_DARK,
  INK_LIGHT,
  LABEL_CLASSES,
  MIN_LETTERFORM,
  MIN_OBJECT,
  add,
  bestAdditiveInk,
  bestSingleInk,
  contrast,
  inkPole,
  inkTable,
  labelInk,
  letterformEdge,
  luma,
  surfacesFor,
  worstEdge,
  type RGB,
} from "./ink.ts";

/**
 * THE LEGIBILITY TABLE, and the arithmetic that says why it had to be a pair.
 *
 * The founder could not see one of three answers. What follows is measured over
 * a port of the fragment shader evaluated on the exact rectangle each numeral's
 * quad covers, at the antialias width of three real devices, over every
 * additive lift that lands on it — not spot-checked on one screen, which is how
 * the illegible orb shipped in the first place.
 *
 * ```
 *  class        shipped   any additive   any opaque      NOW: letterform  object
 *  orbPos         1.00        1.00          1.04              18.40        4.31
 *  orbNeg         1.00        1.00          1.03              18.40        4.30
 *  chargePos      1.00        1.00          1.02              18.40        4.30
 *  chargeNeg      1.00        1.00          1.05              18.40        4.30
 *  floatPos       1.04        1.04          1.22              18.40        4.43
 *  floatNeg       1.15        1.15          1.23              18.40        4.29
 *  wardenLock     1.00        1.00          1.03              18.40        4.29
 *  prompt         1.04        1.04          1.22              18.40        4.43
 * ```
 *
 * Read the middle two columns first, because they are the reason this is not a
 * palette change. **"any additive"** is the best ratio ANY additive ink could
 * reach against these surfaces, and on an orb it is 1.00:1 — the ground is
 * already clipped, so there is nothing left to add. The shipped `polHot` tint
 * was ALREADY at that ceiling: recolouring it could not have gained a
 * hundredth. **"any opaque"** is the best a single non-additive ink could do,
 * 1.02–1.23:1, because these numerals are drawn over both a bright hull and the
 * black field at once and no one colour separates from both.
 *
 * So: an ink plus an opaque counter-ink halo, `NormalBlending`, drawn in an
 * overlay pass after the bloom. 18.40:1 letterform, 4.29:1 worst object.
 */
test("the legibility table: every numeral, every surface, before and after", () => {
  const rows = inkTable();
  const lines = ["", "  class        shipped   any additive   any opaque   letterform   object  pole"];
  for (const r of rows) {
    lines.push(
      "  " +
        r.cls.padEnd(12) +
        r.before.toFixed(2).padStart(6) +
        r.additiveCeiling.toFixed(2).padStart(14) +
        r.singleCeiling.toFixed(2).padStart(13) +
        r.letterform.toFixed(2).padStart(13) +
        r.object.toFixed(2).padStart(9) +
        "  " +
        r.pole,
    );
  }
  console.log(lines.join("\n"));

  assert.equal(rows.length, LABEL_CLASSES.length);
  for (const r of rows) {
    assert.ok(
      r.letterform >= MIN_LETTERFORM,
      `${r.cls}: a numeral reads ${r.letterform.toFixed(2)}:1 against its own halo`,
    );
    assert.ok(
      r.object >= MIN_OBJECT,
      `${r.cls}: the inked numeral reads ${r.object.toFixed(2)}:1 against the worst surface it lands on`,
    );
  }
});

/**
 * The dead end, stated as arithmetic so nobody rediscovers it by hand.
 *
 * This is the assertion that says "choose a better colour" was never going to
 * work. It is about the SHIPPED compositing mode, so it does not move when the
 * ink does — it moves when the surfaces do.
 */
test("no additive ink of any colour could have been read on these objects", () => {
  for (const cls of LABEL_CLASSES) {
    const steady = surfacesFor(cls, "glow");
    const ceiling = bestAdditiveInk(steady);
    assert.ok(
      ceiling < MIN_LETTERFORM,
      `${cls}: an additive glyph could reach ${ceiling.toFixed(2)}:1, which clears the bar — ` +
        `the pack would not have needed a halo`,
    );
  }
  // and on the four objects with a lit hull it is the floor of the scale: there
  // is a surface under the numeral that is already clipped to white.
  for (const cls of ["orbPos", "orbNeg", "wardenLock", "chargePos"] as const) {
    const ceiling = bestAdditiveInk(surfacesFor(cls, "glow"));
    assert.ok(
      ceiling < 1.01,
      `${cls}: additive ceiling is ${ceiling.toFixed(3)}:1 — the saturated surface has gone`,
    );
  }
});

test("no single opaque ink could have been read on them either", () => {
  for (const cls of LABEL_CLASSES) {
    const steady = surfacesFor(cls, "glow");
    const ceiling = bestSingleInk(steady);
    assert.ok(
      ceiling < MIN_LETTERFORM,
      `${cls}: one opaque ink could reach ${ceiling.toFixed(2)}:1 — recolouring alone would do`,
    );
  }
});

/**
 * The bars hold on the smallest screen this program supports, on the founder's
 * phone, and on a tablet — which is what the antialias width IS.
 *
 * `w = max(0.012, uPx / size * 1.6)` and `uPx` is world units per device pixel,
 * so a coarse screen is a wide soft edge and therefore a whole band of
 * intermediate surface that a crisp screen never produces. Measuring only the
 * crisp one is measuring the device the author happens to be sitting at.
 */
test("every bar holds at 320×568, at the founder's 1080×2340, and on a tablet", () => {
  const named = [
    ["320×568 dpr1", AA_WIDTHS[2] as number],
    ["1080×2340 dpr2", AA_WIDTHS[1] as number],
    ["tablet / desktop", AA_WIDTHS[0] as number],
  ] as const;
  for (const [screen, w] of named) {
    for (const cls of LABEL_CLASSES) {
      const s = surfacesFor(cls, "flash", [w]);
      const pair = labelInk(cls);
      const lf = letterformEdge(pair, s);
      const ob = worstEdge(pair, s);
      assert.ok(lf >= MIN_LETTERFORM, `${cls} on ${screen}: letterform ${lf.toFixed(2)}:1`);
      assert.ok(ob >= MIN_OBJECT, `${cls} on ${screen}: object ${ob.toFixed(2)}:1`);
    }
  }
});

/**
 * The halo is what the letterform bar is a claim ABOUT, so the bar has to be
 * sensitive to the halo's alpha — and it is: both colours are composited
 * against the surface at their own alpha, so a translucent halo is a tint of
 * whatever is behind it and the two converge.
 *
 * The value that shipped was 0.92, which under additive blending meant nothing
 * at all. It is 1 now, and if it ever stops being 1 this number falls.
 */
test("a translucent halo would fail the letterform bar, which is why it is opaque", () => {
  const pair = labelInk("orbPos");
  const surfaces = surfacesFor("orbPos", "flash");
  // the shipped alpha, applied to the pair that ships now
  const shaky = (haloAlpha: number): number => {
    let worst = Infinity;
    for (const s of surfaces) {
      const halo: RGB = [0, 1, 2].map(
        (i) => pair.halo[i as 0 | 1 | 2] * haloAlpha + s[i as 0 | 1 | 2] * (1 - haloAlpha),
      ) as unknown as RGB;
      worst = Math.min(worst, contrast(pair.ink, halo));
    }
    return worst;
  };
  assert.equal(HALO_ALPHA, 1, "the atlas strokes the halo at HALO_ALPHA");
  assert.ok(shaky(1) >= MIN_LETTERFORM, `opaque: ${shaky(1).toFixed(2)}:1`);
  assert.ok(
    shaky(0.5) < MIN_LETTERFORM,
    `a half-opaque halo measures ${shaky(0.5).toFixed(2)}:1, so this test would not notice one`,
  );
  assert.ok(letterformEdge(pair, surfaces) >= MIN_LETTERFORM);
});

/**
 * A float text dissolves as it rises, and a dissolving numeral loses contrast
 * by construction — both its colours fade toward the ground. So the question is
 * not whether it stays at 4.5:1 forever (nothing that fades does) but for how
 * much of its life it is above the bar, and the answer has to be most of it.
 *
 * `renderer.ts` holds the instance alpha at 1 for the first stretch of the rise
 * and dissolves after. The alpha at which the letterform bar breaks is ~0.565,
 * which lands at just past half of the 0.95s life.
 */
test("a rising float text is above the letterform bar for most of its life", () => {
  const pair = labelInk("floatPos");
  const surfaces = surfacesFor("floatPos", "flash");
  // `fillLabels`: alpha = clamp01((1 - k) * FLOAT_HOLD) ** 2, k = age / life
  const alphaAt = (k: number): number => Math.min(1, Math.max(0, (1 - k) * FLOAT_HOLD)) ** 2;
  let legibleUntil = 0;
  for (let i = 0; i <= 100; i++) {
    const k = i / 100;
    if (letterformEdge(pair, surfaces, alphaAt(k)) >= MIN_LETTERFORM) legibleUntil = k;
  }
  assert.ok(
    legibleUntil >= 0.5,
    `a float text drops under ${String(MIN_LETTERFORM)}:1 after ${(legibleUntil * 100).toFixed(0)}% of its rise`,
  );
  assert.ok(
    letterformEdge(pair, surfaces, alphaAt(1)) < MIN_LETTERFORM,
    "a fully dissolved numeral is somehow still above the bar — the fade is not a fade",
  );
});

/**
 * The pole is DERIVED. Same function, two grounds, two answers — which is the
 * thing a fixed colour cannot do and the reason `labelInk` takes a class rather
 * than a constant.
 */
test("the ink pole follows the ground rather than being chosen", () => {
  const ground = surfacesFor("orbPos", "none");
  const brighter = ground.map((s) => add([0.6, 0.6, 0.6], s));
  const darker = ground.map((s) => [s[0] * 0.05, s[1] * 0.05, s[2] * 0.05] as RGB);
  assert.equal(inkPole(brighter), "dark", "a washed-out ground is still being given a light ink");
  assert.equal(inkPole(darker), "light", "a black ground is still being given a dark ink");
  assert.notEqual(inkPole(brighter), inkPole(darker), "the pole does not depend on the ground");
  // and the pair really is the two poles, opposite ways round
  const pair = labelInk("orbPos");
  assert.deepEqual([...pair.ink], [...INK_LIGHT]);
  assert.deepEqual([...pair.halo], [...INK_DARK]);
});

/**
 * The poles themselves. `MIN_OBJECT` is a guarantee and not a hope because
 * these two are far enough apart that their CROSSOVER — the ground luminance at
 * which neither is the obviously better choice — still clears 3.0. A softer
 * pair would leave a band of ground where a numeral is invisible whichever way
 * round it is drawn, and the band is exactly where a bright hull meets a dark
 * field, which is where every numeral in this pack is.
 */
test("the poles are far enough apart that no ground can defeat both", () => {
  assert.ok(contrast(INK_LIGHT, INK_DARK) >= 18, "the poles are 18:1 or better apart");
  let worst = Infinity;
  let worstAt = 0;
  for (let i = 0; i <= 1000; i++) {
    const v = i / 1000;
    const s: RGB = [v, v, v];
    const best = Math.max(contrast(INK_LIGHT, s), contrast(INK_DARK, s));
    if (best < worst) {
      worst = best;
      worstAt = luma(s);
    }
  }
  assert.ok(
    worst >= MIN_OBJECT,
    `the worst ground for this pair is luminance ${worstAt.toFixed(3)} at ${worst.toFixed(2)}:1`,
  );
  // and a softer pair genuinely fails it, so the bar above is about THESE poles
  let soft = Infinity;
  for (let i = 0; i <= 1000; i++) {
    const v = i / 1000;
    const s: RGB = [v, v, v];
    soft = Math.min(soft, Math.max(contrast([0.75, 0.75, 0.78], s), contrast([0.2, 0.2, 0.24], s)));
  }
  assert.ok(soft < MIN_OBJECT, `a softened pair reaches ${soft.toFixed(2)}:1, so 3.0 is free`);
});

/**
 * The two facts about the renderer that the model above cannot see, and that
 * the whole table depends on.
 *
 * Everything else here is arithmetic over a port of the shader, and arithmetic
 * cannot tell you which blend mode a `ShaderMaterial` was handed or which scene
 * a mesh was added to. Those two lines ARE the fix — an additive numeral
 * measures 1.00:1 on a clipped ground however carefully its colours were
 * derived, and a numeral inside the bloomed scene is read through the bloom —
 * and both are one word long, easy to change back by accident, and silent when
 * wrong. A WebGL context in node would be a better guard; there isn't one, and
 * a brittle guard on the exact thing that broke beats no guard.
 */
test("the numerals are normal-blended, and they are in the overlay scene", () => {
  const src = readFileSync(new URL("./renderer.ts", import.meta.url), "utf8");
  const start = src.indexOf("this.labels = makeLayer(");
  assert.ok(start > 0, "the label layer is not built by `this.labels = makeLayer(` any more");
  const block = src.slice(start, src.indexOf("\n    );", start));
  assert.match(
    block,
    /NormalBlending/,
    "the label layer is additive again — see the header of ink.ts: its ceiling is 1.00:1",
  );
  assert.match(
    src,
    /this\.overlay\.add\(this\.labels\.mesh/,
    "the numerals are back inside the bloomed scene, under the glow instead of over it",
  );
  // and the overlay pass has to be composited without clearing what came before
  assert.match(src, /over\.clear = false;/, "the overlay pass clears the frame it lands on");
});
