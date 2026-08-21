import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { hitsHostChrome, safeRect } from "../../../packs/shared/game-chrome/index.ts";
import { COLS, ROWS } from "./core/rules.ts";
import { cellCenter, colAt, computeLayout, makeStage, type StageEl } from "./layout.ts";

/** every viewport the game is expected to survive */
const SIZES: [string, number, number][] = [
  ["iPhone SE portrait", 320, 568],
  ["iPhone 13 portrait", 390, 844],
  ["iPhone 13 landscape", 844, 390],
  ["Pixel 7 portrait", 412, 915],
  ["iPad mini portrait", 744, 1133],
  ["iPad portrait", 768, 1024],
  ["iPad landscape", 1024, 768],
  ["iPad Pro landscape", 1366, 1024],
  ["small desktop", 1024, 640],
  ["wide desktop", 1920, 1080],
  ["absurdly narrow", 280, 760],
  ["absurdly narrow and tall", 280, 1200],
  ["absurdly short", 900, 320],
  // A wide-and-short window is the case that walks the next-chip strip off the
  // bottom: the reactor has to move down to clear the how-to-play button and
  // the strip hangs off the reactor. 1024x330 was found by sweep, not by taste.
  ["short landscape", 1024, 330],
  ["shorter landscape", 1200, 300],
];

test("the well always fits inside the viewport", () => {
  for (const [name, w, h] of SIZES) {
    const l = computeLayout(w, h, 2, safeRect(w, h));
    assert.ok(l.wellX >= 0, `${name}: well hangs off the left (${l.wellX})`);
    assert.ok(l.wellX + l.wellW <= w, `${name}: well hangs off the right`);
    assert.ok(l.wellY >= 0, `${name}: well hangs off the top (${l.wellY})`);
    assert.ok(l.wellY + l.wellH <= h, `${name}: well hangs off the bottom`);
  }
});

test("there is always headroom above the well for the held chip", () => {
  for (const [name, w, h] of SIZES) {
    const l = computeLayout(w, h, 2, safeRect(w, h));
    assert.ok(l.headY > 0, `${name}: the held chip is off screen`);
    assert.ok(l.headY < l.boardY, `${name}: the held chip is inside the well`);
    assert.ok(
      l.boardY - l.headY > l.cell * 0.4,
      `${name}: the held chip overlaps the well rim`,
    );
  }
});

test("the sound toggle never sits on the well", () => {
  for (const [name, w, h] of SIZES) {
    const l = computeLayout(w, h, 2, safeRect(w, h));
    // `soundBox` is the TOUCH square — `input.ts` hit-tests at `soundR + 10`,
    // so anything smaller measures a button that is not the one on the glass.
    const b = l.soundBox;
    const overlaps =
      b.x < l.wellX + l.wellW && l.wellX < b.x + b.w && b.y < l.wellY + l.wellH && l.wellY < b.y + b.h;
    assert.equal(overlaps, false, `${name}: the sound toggle covers the well`);
    assert.ok(l.soundX > 0 && l.soundX < w, `${name}: sound toggle off screen`);
    assert.ok(l.soundY > 0 && l.soundY < h, `${name}: sound toggle off screen`);
  }
});

test("the reactor orb never sits on the well", () => {
  for (const [name, w, h] of SIZES) {
    const l = computeLayout(w, h, 2, safeRect(w, h));
    const r = l.keyR * 1.35;
    const overlaps =
      l.keyX + r > l.wellX &&
      l.keyX - r < l.wellX + l.wellW &&
      l.keyY + r > l.wellY &&
      l.keyY - r < l.wellY + l.wellH;
    assert.equal(overlaps, false, `${name}: the reactor covers the well`);
  }
});

test("the incoming strip stays on screen", () => {
  for (const [name, w, h] of SIZES) {
    const l = computeLayout(w, h, 2, safeRect(w, h));
    for (let i = 0; i < 3; i++) {
      const x = l.incomingVertical ? l.incomingX : l.incomingX + i * l.incomingStep;
      const y = l.incomingVertical ? l.incomingY + i * l.incomingStep : l.incomingY;
      assert.ok(x - l.chipSize / 2 >= 0 && x + l.chipSize / 2 <= w, `${name}: incoming ${i} off x`);
      assert.ok(y - l.chipSize / 2 >= 0 && y + l.chipSize / 2 <= h, `${name}: incoming ${i} off y`);
    }
  }
});

test("cells tile the board exactly, with no gap and no overlap", () => {
  const l = computeLayout(900, 1200, 2, safeRect(900, 1200));
  const first = cellCenter(l, 0, 0);
  const last = cellCenter(l, ROWS - 1, COLS - 1);
  assert.equal(Math.round(first.x - l.cell / 2), l.boardX);
  assert.equal(Math.round(first.y - l.cell / 2), l.boardY);
  assert.equal(Math.round(last.x + l.cell / 2), l.boardX + l.boardW);
  assert.equal(Math.round(last.y + l.cell / 2), l.boardY + l.boardH);
});

test("colAt inverts cellCenter and clamps outside the board", () => {
  for (const [, w, h] of SIZES) {
    const l = computeLayout(w, h, 2, safeRect(w, h));
    for (let c = 0; c < COLS; c++) {
      assert.equal(colAt(l, cellCenter(l, 0, c).x), c);
    }
    assert.equal(colAt(l, -9999), 0);
    assert.equal(colAt(l, 9999), COLS - 1);
  }
});

test("orientation picks a different design, not a stretched one", () => {
  assert.equal(computeLayout(390, 844, 2, safeRect(390, 844)).landscape, false);
  assert.equal(computeLayout(844, 390, 2, safeRect(844, 390)).landscape, true);
  // portrait puts the score on the left of a top band; landscape centres it in a rail
  assert.equal(computeLayout(390, 844, 2, safeRect(390, 844)).scoreAlign, "left");
  assert.equal(computeLayout(844, 390, 2, safeRect(844, 390)).scoreAlign, "center");
});

test("cells stay aimable on every real phone and tablet", () => {
  // 28px is deliberately under the 44px tap guideline: aiming here is a drag
  // with a live landing ghost, not a discrete tap, so the target is "sweep
  // until the ghost is where you want it" and column width sets precision, not
  // success. A landscape phone (11 rows into 390px) is the tightest case there
  // is; portrait, which is how a well-shaped board is actually held, is roomy.
  for (const [name, w, h] of SIZES) {
    if (Math.min(w, h) < 360) continue;
    const l = computeLayout(w, h, 2, safeRect(w, h));
    assert.ok(l.cell >= 28, `${name}: ${l.cell}px cells are too small to aim`);
  }
  assert.ok(computeLayout(390, 844, 2, safeRect(390, 844)).cell >= 50, "portrait phone should be roomy");
  assert.ok(computeLayout(744, 1133, 2, safeRect(744, 1133)).cell >= 70, "tablet should be generous");
});

test("a squashed window still lays out legally, just smaller", () => {
  const l = computeLayout(900, 320, 2, safeRect(900, 320));
  assert.ok(l.cell >= 18);
  assert.ok(l.wellY >= 0 && l.wellY + l.wellH <= 320);
  assert.ok(l.headY > 0 && l.headY < l.boardY);
});

/** everything a child has to read or touch, as boxes */
function critical(l: ReturnType<typeof computeLayout>): [string, { x: number; y: number; w: number; h: number }][] {
  return [
    ["the score", l.scoreBox],
    ["the level readout", l.levelBox],
    ["the reactor", l.reactorBox],
    ["the incoming strip", l.incomingBox],
    ["the mute toggle", l.soundBox],
    ["the well", { x: l.wellX, y: l.wellY, w: l.wellW, h: l.wellH }],
  ];
}

/** the four inset profiles the game actually meets */
const INSETS: [string, { top: number; right: number; bottom: number; left: number }][] = [
  ["no insets", { top: 0, right: 0, bottom: 0, left: 0 }],
  ["notched portrait", { top: 47, right: 0, bottom: 34, left: 0 }],
  ["notched landscape", { top: 0, right: 47, bottom: 21, left: 47 }],
  ["android gesture bar", { top: 24, right: 0, bottom: 24, left: 0 }],
];

test("nothing a child reads or touches sits under the host's chrome", () => {
  // The host paints an exit chevron over the top-left 44px and the how-to-play
  // button over the top-right 44px, on top of the pack. It overlays rather than
  // reserving a band — a band cost a twelfth of a small phone's height — so the
  // promise this layout keeps is that those two squares are clear of anything
  // that has to be read or tapped: the score, the LV readout, the next-chip
  // strip, the mute toggle, the RESONANCE reactor (which is tapped) and the
  // well itself (every chip in it is a numeral you have to add).
  //
  // The plasma, the well walls and the sparks still bleed under both, which is
  // the whole point of `viewport-fit=cover`.
  // Every viewport against every inset profile, because the corners move with
  // the insets: asserting this only on a device with no notch would be
  // asserting it in the one case the notch cannot break.
  for (const [name, w, h] of SIZES) {
    for (const [where, insets] of INSETS) {
      const l = computeLayout(w, h, 2, safeRect(w, h, insets));
      for (const [what, box] of critical(l)) {
        assert.equal(
          hitsHostChrome(box, w, insets),
          false,
          `${name} (${w}x${h}, ${where}): ${what} is under the host's chrome`,
        );
      }
    }
  }
});

test("a notch pushes the instruments down instead of under it", () => {
  // What a canvas HUD cannot do is read `env(safe-area-inset-*)`, so it is
  // handed the rectangle as numbers. Give it a phone-shaped notch and a home
  // indicator and everything readable has to be inside what is left.
  const insets = { top: 47, right: 0, bottom: 34, left: 0 };
  for (const [name, w, h] of [
    ["iPhone SE portrait", 320, 568],
    ["iPhone 13 portrait", 390, 844],
    ["iPad portrait", 768, 1024],
  ] as const) {
    const area = safeRect(w, h, insets);
    const l = computeLayout(w, h, 2, area);
    const bottom = area.y + area.h;
    assert.ok(l.scoreBox.y >= area.y, `${name}: the score is under the notch`);
    assert.ok(l.wellY >= area.y, `${name}: the well is under the notch`);
    assert.ok(
      l.wellY + l.wellH <= bottom,
      `${name}: the well is under the home indicator`,
    );
    assert.ok(l.soundBox.y + l.soundBox.h <= bottom, `${name}: the mute toggle is off the safe area`);
    assert.ok(l.keyY >= area.y, `${name}: the KEY numeral is under the notch`);
    assert.ok(l.incomingBox.y >= area.y, `${name}: the incoming strip is under the notch`);
    // and it really did move, rather than the insets being ignored
    const flat = computeLayout(w, h, 2, safeRect(w, h));
    assert.ok(l.wellY > flat.wellY, `${name}: the well ignored the notch`);
  }
});

test("a landscape notch is honoured on the sides too", () => {
  const area = safeRect(844, 390, { top: 0, right: 47, bottom: 21, left: 47 });
  const l = computeLayout(844, 390, 2, area);
  assert.equal(l.landscape, true);
  assert.ok(l.wellX >= area.x, "the well is under the left inset");
  assert.ok(l.wellX + l.wellW <= area.x + area.w, "the well is under the right inset");
  assert.ok(l.scoreBox.x >= area.x, "the score is under the left inset");
  assert.ok(
    l.incomingBox.x + l.incomingBox.w <= area.x + area.w,
    "the incoming strip is under the right inset",
  );
});

test("the incoming strip stays inside the safe area once it has moved clear", () => {
  // It moves twice — down off the how-to-play button, and down again to hang
  // under the reactor — so a short, wide window is exactly where it walks off
  // the bottom edge and under a phone's gesture bar.
  for (const [name, w, h] of SIZES) {
    for (const [where, insets] of INSETS) {
      const area = safeRect(w, h, insets);
      const b = computeLayout(w, h, 2, area).incomingBox;
      assert.ok(b.x >= area.x, `${name} ${where}: incoming strip past the left inset`);
      assert.ok(b.x + b.w <= area.x + area.w, `${name} ${where}: incoming strip past the right inset`);
      assert.ok(b.y >= area.y, `${name} ${where}: incoming strip under the notch`);
      assert.ok(
        b.y + b.h <= area.y + area.h,
        `${name} ${where}: incoming strip under the home indicator`,
      );
    }
    const l = computeLayout(w, h, 2, safeRect(w, h));
    const b = l.incomingBox;
    assert.ok(b.x >= 0 && b.x + b.w <= w, `${name}: incoming strip off x`);
    assert.ok(b.y >= 0 && b.y + b.h <= h, `${name}: incoming strip off y`);
    const onWell =
      b.x < l.wellX + l.wellW && l.wellX < b.x + b.w && b.y < l.wellY + l.wellH && l.wellY < b.y + b.h;
    assert.equal(onWell, false, `${name}: the incoming strip covers the well`);
  }
});

/* -------------------------------------------------------------------------- */
/* The stage.                                                                 */
/*                                                                            */
/* `games/runner` shipped to two app stores completely blank because           */
/* `el.style.position = el.style.position || "relative"` read the INLINE       */
/* position — empty for an element positioned from a stylesheet — and so       */
/* always fired, overwriting `#app { position: fixed; inset: 0 }` and taking   */
/* the insets with it. FUSE carried the identical line against the identical   */
/* shape of `pack.html`, and its stage measured 820x0 in a framed pack too. It */
/* played anyway, on two accidents: no `overflow: hidden` on the stage, and an */
/* `el.clientHeight || window.innerHeight` whose `||` caught the zero.         */
/* -------------------------------------------------------------------------- */

/**
 * What `pack.html` declares about the element the pack mounts into.
 *
 * Read out of the real file rather than restated here, because the defect this
 * section pins is exactly a disagreement between that file and this game's code:
 * the only box `#root` has comes from the stylesheet, and any inline `position`
 * the game writes wins over it.
 */
function packStageRule(): Map<string, string> {
  const html = readFileSync(new URL("../pack.html", import.meta.url), "utf8");
  const rule = /#root\s*\{([^}]*)\}/.exec(html);
  assert.ok(rule, "pack.html has no #root rule; this test is measuring the wrong element");
  const decls = new Map<string, string>();
  for (const part of (rule[1] ?? "").split(";")) {
    const colon = part.indexOf(":");
    if (colon < 0) continue;
    decls.set(part.slice(0, colon).trim(), part.slice(colon + 1).trim());
  }
  return decls;
}

/**
 * The used height of the stage in CSS pixels, on a `viewportH`-tall surface.
 *
 * A deliberately tiny slice of CSS, and only the slice FUSE's layout depends on:
 * the canvas is `position: absolute; inset: 0`, so the stage has no in-flow
 * content and `height: auto` resolves to zero. It gets a height from exactly two
 * places — an explicit `height`, or being out of flow with both `top` and
 * `bottom` pinned. Inline declarations beat the stylesheet, which is the whole
 * mechanism of the bug.
 */
function stageHeight(
  sheet: Map<string, string>,
  inline: Map<string, string>,
  viewportH: number,
): number {
  const used = (prop: string): string | undefined => inline.get(prop) ?? sheet.get(prop);
  const height = used("height");
  if (height === "100%") return viewportH;
  if (height !== undefined && height.endsWith("px")) return Number.parseFloat(height);

  const position = used("position") ?? "static";
  const inset = used("inset");
  const top = used("top") ?? inset;
  const bottom = used("bottom") ?? inset;
  const outOfFlow = position === "fixed" || position === "absolute";
  if (outOfFlow && top === "0" && bottom === "0") return viewportH;
  // In flow, height auto, and nothing in flow inside it.
  return 0;
}

test("the pack's stage is sized only by being out of flow", () => {
  // The precondition that makes the rest of this section mean anything. If
  // pack.html ever gives #root a height of its own, an inline `position` stops
  // being able to collapse it and these tests are measuring a bug that is gone.
  const sheet = packStageRule();
  assert.equal(sheet.get("height"), undefined, "#root now has a height; re-derive this section");
  assert.equal(sheet.get("position"), "fixed");
  assert.equal(sheet.get("inset"), "0");
  assert.equal(stageHeight(sheet, new Map(), 1180), 1180, "#root has no box even untouched");
});

test("an inline position on the stage collapses the whole game to nothing", () => {
  // The failure, stated. Measured in a framed pack before the fix: #root 820x0,
  // canvas 820x1180 painting *outside* it, and the only reason a child saw
  // anything at all.
  const sheet = packStageRule();
  assert.equal(stageHeight(sheet, new Map([["position", "relative"]]), 1180), 0);
  assert.equal(stageHeight(sheet, new Map([["position", "static"]]), 1180), 0);
});

test("makeStage leaves a stage the document has already positioned alone", () => {
  const sheet = packStageRule();
  // What a browser computes for #root at the moment `mount` runs.
  const computed = sheet.get("position") ?? "static";
  const el: StageEl = { style: { position: "" } };
  makeStage(el, computed);

  const inline = new Map<string, string>();
  if (el.style.position !== "") inline.set("position", el.style.position);
  assert.equal(
    stageHeight(sheet, inline, 1180),
    1180,
    `makeStage wrote position:${el.style.position} over the document's ${computed}`,
  );
});

test("makeStage still positions a stage nobody else has", () => {
  // A host that hands over a plain in-flow div — and `index.html`'s `#root`
  // before it had a rule of its own — still needs the canvas to have something to
  // be absolute against.
  const el: StageEl = { style: { position: "" } };
  makeStage(el, "static");
  assert.equal(el.style.position, "relative");
});

test("makeStage never overwrites any position the document computed", () => {
  for (const computed of ["relative", "absolute", "fixed", "sticky"]) {
    const el: StageEl = { style: { position: "" } };
    makeStage(el, computed);
    assert.equal(el.style.position, "", `makeStage overwrote a computed ${computed}`);
  }
});

test("a collapsed stage is not a survivable state for this game any more", () => {
  // The second accident, pinned. `resize()` used `el.clientHeight ||
  // window.innerHeight`, which turned a stage with no box into a full-window
  // canvas — so the game kept playing and the collapse was invisible to
  // everybody, including the author of the line that caused it. The layout is now
  // computed from the stage's real box, and a zero box produces a layout that
  // visibly has nothing in it rather than a plausible full-screen one.
  const collapsed = computeLayout(1, 1, 2, safeRect(1, 1));
  const real = computeLayout(820, 1180, 2, safeRect(820, 1180));
  assert.notEqual(
    collapsed.cell,
    real.cell,
    "a 1x1 stage laid out the same as a real one; the collapse is still invisible",
  );
  assert.ok(collapsed.boardW <= 1 + COLS * 18, "a 1x1 stage produced a full-size board");
});
