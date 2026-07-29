/**
 * Playfield and HUD geometry.
 *
 * The second half of this file is about the frame PULSE does not own. `pack.html`
 * declares `viewport-fit=cover`, so the document is opted into the notch and the
 * home indicator; and the host floats an exit control over the top-left corner and
 * a how-to-play control over the top-right, 44px each. The chrome OVERLAYS rather
 * than reserving a band — reserving 67px of a 568px phone cost SKY LEDGER its own
 * layout — so the promise a game makes is narrow: nothing a child must read or
 * touch lands in those two squares, and everything readable stays inside the safe
 * rect. Backgrounds may bleed anywhere, and do.
 *
 * These assert on the SAME rectangles the renderer draws from, which is the only
 * version of this test worth having.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  NO_INSETS,
  hitsHostChrome,
  safeRect,
  type Insets,
  type Rect,
} from "../../../../packs/shared/game-chrome/index.ts";
import { buttonRect } from "./chrome.ts";
import {
  comboBox,
  computeLayout,
  healthBox,
  laneAtPoint,
  multBox,
  noteBox,
  promptBox,
  scoreBox,
  stageBox,
  type Layout,
} from "./layout.ts";

const SIZES: [number, number, string][] = [
  [1440, 900, "desktop"],
  [1180, 820, "ipad landscape"],
  [820, 1180, "ipad portrait"],
  [390, 844, "phone portrait"],
  [844, 390, "phone landscape"],
];

const full = (w: number, h: number): Rect => safeRect(w, h, NO_INSETS);

test("the visible field is exactly one bar, in every orientation", () => {
  for (const [w, h, name] of SIZES) {
    for (const lanes of [1, 2, 3]) {
      const l = computeLayout(w, h, lanes, full(w, h));
      const a = l.pt(0, 0.5);
      const b = l.pt(1, 0.5);
      const d = Math.hypot(b.x - a.x, b.y - a.y);
      assert.ok(
        Math.abs(d - l.runLen) < 1e-6,
        `${name}/${lanes}: u=0..1 spans ${d.toFixed(1)} px, runLen is ${l.runLen.toFixed(1)}`,
      );
      assert.ok(l.runLen > 120, `${name}: only ${l.runLen.toFixed(0)} px of bar`);
    }
  }
});

test("nothing is laid out off screen", () => {
  for (const [w, h, name] of SIZES) {
    const l = computeLayout(w, h, 3, full(w, h));
    for (const u of [0, 0.25, 0.5, 0.75, 1]) {
      for (const v of [0, 0.5, 1]) {
        const p = l.pt(u, v);
        assert.ok(p.x >= -2 && p.x <= w + 2, `${name}: x=${p.x.toFixed(1)} at u=${u} v=${v}`);
        assert.ok(p.y >= -2 && p.y <= h + 2, `${name}: y=${p.y.toFixed(1)} at u=${u} v=${v}`);
      }
    }
  }
});

test("portrait falls, landscape scrolls", () => {
  assert.equal(computeLayout(390, 844, 3, full(390, 844)).orient, "v");
  assert.equal(computeLayout(844, 390, 3, full(844, 390)).orient, "h");
  assert.equal(computeLayout(1440, 900, 3, full(1440, 900)).orient, "h");
  const v = computeLayout(390, 844, 3, full(390, 844));
  assert.ok(v.along.y < 0, "notes must approach from the top");
  const hz = computeLayout(1440, 900, 3, full(1440, 900));
  assert.ok(hz.along.x > 0, "future is to the right");
});

test("a tap lands in the lane it looks like it landed in", () => {
  for (const [w, h] of SIZES) {
    for (const lanes of [1, 2, 3]) {
      const l = computeLayout(w, h, lanes, full(w, h));
      for (let i = 0; i < lanes; i++) {
        const p = l.pt(0, l.laneV(i));
        assert.equal(laneAtPoint(l, p.x, p.y), i, `${w}x${h}/${lanes}: lane ${i} centre`);
      }
      // Anywhere on the screen still resolves to a real lane.
      for (const [x, y] of [
        [0, 0],
        [w, h],
        [w / 2, 0],
        [0, h / 2],
      ]) {
        const lane = laneAtPoint(l, x!, y!);
        assert.ok(lane >= 0 && lane < lanes);
      }
    }
  }
});

test("touch targets stay fat enough for a thumb", () => {
  for (const [w, h, name] of SIZES) {
    const l = computeLayout(w, h, 3, full(w, h));
    assert.ok(l.lanePitch >= 44, `${name}: lane pitch is only ${l.lanePitch.toFixed(0)} px`);
  }
});

// ------------------------------------------------------- the frame we share

/** Every viewport this game promises to be playable on. */
const VIEWPORTS: [number, number][] = [
  [320, 568],
  [390, 844],
  [768, 1024],
  [1024, 768],
  [844, 390],
];

/** A notched phone held upright, and the same phone turned sideways. */
const NOTCHED_PORTRAIT: Insets = { top: 47, right: 0, bottom: 34, left: 0 };
const NOTCHED_LANDSCAPE: Insets = { top: 0, right: 47, bottom: 21, left: 47 };

const insetsFor = (w: number, h: number): Insets[] => [
  NO_INSETS,
  w >= h ? NOTCHED_LANDSCAPE : NOTCHED_PORTRAIT,
];

const label = (i: Insets): string =>
  i.top === 0 && i.right === 0 && i.bottom === 0 && i.left === 0 ? "no insets" : "notched";

/**
 * Text widths a real run actually reaches. Deliberately at the generous end — a
 * seven-figure score, a three-token sum — because the box has to hold the worst
 * case, not the first frame.
 */
function readables(l: Layout): Array<[string, Rect]> {
  const mono = 0.62;
  const stage = l.hud.stage;
  return [
    ["score", scoreBox(l, l.hud.score.size * mono * 9)],
    ["multiplier", multBox(l, l.hud.mult.size * mono * 4)],
    ["health bar", healthBox(l)],
    ["stage strip", stageBox(l, stage.size * 8 + stage.glyphSize * 6)],
    ["gate prompt", promptBox(l, l.hud.prompt.size * 6)],
    ["combo", comboBox(l, l.hud.combo.size * mono * 3)],
  ];
}

/** Pulse's own two buttons, as squares. */
function ownButtons(l: Layout): Array<[string, Rect]> {
  return [0, 1].map((i) => {
    const r = buttonRect(i, l.area, l.compact);
    const box: Rect = { x: r.x, y: r.y, w: r.s, h: r.s };
    return [i === 0 ? "pause button" : "mute button", box] as [string, Rect];
  });
}

/**
 * Every note a child is asked to read, at every point along its run.
 *
 * This is not cosmetic in a timing game. A note that passes behind the exit
 * button is a note the child cannot see coming and cannot judge, and during a
 * gate it carries the fraction that IS the answer. `uMax` is where a note first
 * appears; `0` is the strike line.
 */
function noteBoxes(l: Layout): Array<[string, Rect]> {
  const out: Array<[string, Rect]> = [];
  for (const u of [0, 0.25, 0.5, 0.75, 1, l.uMax]) {
    for (let lane = 0; lane < l.laneCount; lane++) {
      out.push([`note lane ${lane} at u=${u.toFixed(2)}`, noteBox(l, u, lane, false)]);
      out.push([`gate note lane ${lane} at u=${u.toFixed(2)}`, noteBox(l, u, lane, true)]);
    }
  }
  return out;
}

/**
 * The bright line itself: the thing the whole game asks you to look at, with the
 * per-lane strike markers on it. It spans the field across the lanes and is a
 * note's width along the direction of travel.
 */
function strikeLineBox(l: Layout): Rect {
  const r = l.noteR;
  return l.orient === "h"
    ? { x: l.strikeA.x - r, y: l.strikeA.y, w: r * 2, h: l.fieldThickness }
    : { x: l.strikeA.x, y: l.strikeA.y - r, w: l.fieldThickness, h: r * 2 };
}

const inside = (r: Rect, area: Rect): boolean =>
  r.x >= area.x - 0.5 &&
  r.y >= area.y - 0.5 &&
  r.x + r.w <= area.x + area.w + 0.5 &&
  r.y + r.h <= area.y + area.h + 0.5;

const span = (r: Rect): string =>
  `x ${r.x.toFixed(1)}..${(r.x + r.w).toFixed(1)}, y ${r.y.toFixed(1)}..${(r.y + r.h).toFixed(1)}`;

for (const [w, h] of VIEWPORTS) {
  for (const insets of insetsFor(w, h)) {
    const tag = `${w}×${h} ${label(insets)}`;

    test(`nothing readable is under the host's two corners at ${tag}`, () => {
      // Collected rather than asserted one at a time: when this breaks, the
      // useful answer is everything that collides, not the first thing.
      const offenders: string[] = [];
      for (const lanes of [1, 2, 3]) {
        const l = computeLayout(w, h, lanes, safeRect(w, h, insets));
        const boxes: Array<[string, Rect]> = [
          ...readables(l),
          ...ownButtons(l),
          ...noteBoxes(l),
          ["strike line", strikeLineBox(l)],
        ];
        for (const [name, box] of boxes) {
          if (hitsHostChrome(box, w, insets)) {
            offenders.push(`${lanes} lanes: ${name} — ${span(box)}`);
          }
        }
      }
      assert.deepEqual(offenders, [], `${tag}: under host chrome:\n  ${offenders.join("\n  ")}`);
    });

    test(`nothing readable is under the notch or the home indicator at ${tag}`, () => {
      const area = safeRect(w, h, insets);
      const offenders: string[] = [];
      for (const lanes of [1, 2, 3]) {
        const l = computeLayout(w, h, lanes, area);
        // A note beyond one whole bar is still arriving from off-screen, by
        // design. Everything inside the bar is inside the safe rect.
        const boxes: Array<[string, Rect]> = [
          ...readables(l),
          ...ownButtons(l),
          ...noteBoxes(l).filter(([n]) => !n.includes("1.06")),
          ["strike line", strikeLineBox(l)],
        ];
        for (const [name, box] of boxes) {
          if (!inside(box, area)) {
            offenders.push(`${lanes} lanes: ${name} — ${span(box)}`);
          }
        }
      }
      assert.deepEqual(
        offenders,
        [],
        `${tag}: outside the safe rect ${span(safeRect(w, h, insets))}:\n  ${offenders.join("\n  ")}`,
      );
    });

    test(`there is still a bar to read at ${tag}`, () => {
      const l = computeLayout(w, h, 3, safeRect(w, h, insets));
      assert.ok(l.runLen > 120, `${tag}: only ${l.runLen.toFixed(0)} px of bar`);
      assert.ok(l.lanePitch >= 44, `${tag}: lane pitch is only ${l.lanePitch.toFixed(0)} px`);
    });
  }
}

test("the layout follows the insets rather than reading them once", () => {
  // The same canvas, rotated: the safe rect moves and every readable moves with
  // it. A game that measured the insets once at mount would fail this.
  const upright = computeLayout(390, 844, 3, safeRect(390, 844, NOTCHED_PORTRAIT));
  const flat = computeLayout(390, 844, 3, safeRect(390, 844, NO_INSETS));
  assert.ok(
    upright.hud.score.cy > flat.hud.score.cy,
    "the score must sit lower once there is a notch above it",
  );
  assert.ok(
    buttonRect(0, upright.area, upright.compact).y < buttonRect(0, flat.area, flat.compact).y,
    "the buttons must sit higher once there is a home indicator below them",
  );
});

test("the touch target of pulse's own buttons is the square it draws", () => {
  // `hitButton` reads `buttonRect`, so moving the buttons into the safe rect
  // cannot leave the tappable squares behind at the old place.
  const l = computeLayout(390, 844, 3, safeRect(390, 844, NOTCHED_PORTRAIT));
  for (const i of [0, 1]) {
    const r = buttonRect(i, l.area, l.compact);
    assert.ok(r.y + r.s <= l.area.y + l.area.h, `button ${i} is in the home indicator`);
    assert.ok(r.x + r.s <= l.area.x + l.area.w, `button ${i} is past the safe edge`);
  }
});
