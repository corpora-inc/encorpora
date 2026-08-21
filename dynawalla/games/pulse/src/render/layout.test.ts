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
import { GESTURE_STRIP, MIN_TOUCH, buttonRect, hitButton } from "./chrome.ts";
import {
  GATE_LABEL_MIN,
  comboBox,
  computeLayout,
  gateFitFor,
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
    const r = buttonRect(i, l.area, l.compact, l.h);
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
    buttonRect(0, upright.area, upright.compact, 844).y <
      buttonRect(0, flat.area, flat.compact, 844).y,
    "the buttons must sit higher once there is a home indicator below them",
  );
});

test("the touch target of pulse's own buttons is the square it draws", () => {
  // `hitButton` reads `buttonRect`, so moving the buttons into the safe rect
  // cannot leave the tappable squares behind at the old place.
  const l = computeLayout(390, 844, 3, safeRect(390, 844, NOTCHED_PORTRAIT));
  for (const i of [0, 1]) {
    const r = buttonRect(i, l.area, l.compact, 844);
    assert.ok(r.y + r.s <= l.area.y + l.area.h, `button ${i} is in the home indicator`);
    assert.ok(r.x + r.s <= l.area.x + l.area.w, `button ${i} is past the safe edge`);
  }
});

// ------------------------------------------------------- the answer, readable
//
// "Cant see the answers (when you are tasked with performing arithmetic), too
// blurry ... the answers should be very clear".
//
// Two separate defects wore that one sentence. The number on a gate candidate
// was derived from the orb — `gateR * 0.62 * 0.84` — which is 15.1 px on a
// 390 px phone and 15.1 px on a 320 px one; and `minGapDenom` was hardcoded to
// 12 at its only call site, so two candidates a twelfth of the bar apart were
// 34.0 px apart on that same phone while being 57.8 px across. They physically
// overlapped, by 24 px, and the measured minimum gap over 5000 real gates was
// exactly 1/12 — so the worst case was the ordinary case.

/**
 * Where a child is actually asked to read a moving number, including a device
 * whose bottom inset is ZERO while its gesture strip is not. Kept separate from
 * `VIEWPORTS` above deliberately: that list is about the host's chrome, this
 * one is about hands and eyes.
 */
const READING_VIEWPORTS: Array<[number, number, Insets, string]> = [
  [320, 568, NO_INSETS, "320×568 small phone"],
  [390, 844, NOTCHED_PORTRAIT, "390×844 notched phone"],
  [412, 915, NO_INSETS, "412×915 android, no reported bottom inset"],
  [412, 915, { top: 24, right: 0, bottom: 24, left: 0 }, "412×915 android, gesture insets"],
  [768, 1024, NO_INSETS, "768×1024 tablet"],
  [1024, 768, NO_INSETS, "1024×768 tablet landscape"],
  [844, 390, NOTCHED_LANDSCAPE, "844×390 phone landscape"],
];

for (const [w, h, insets, name] of READING_VIEWPORTS) {
  test(`a gate candidate's number is big enough to read at ${name}`, () => {
    for (const lanes of [1, 2, 3]) {
      const l = computeLayout(w, h, lanes, safeRect(w, h, insets));
      assert.ok(
        l.gateLabelSize >= GATE_LABEL_MIN,
        `${name}/${lanes} lanes: the answer is drawn at ${l.gateLabelSize.toFixed(1)} px, ` +
          `below the ${GATE_LABEL_MIN} px floor`,
      );
      // And the ring it lives in has to hold it, or the fit is a lie that the
      // renderer silently shrinks its way out of.
      assert.ok(
        l.gateR * 2 >= l.gateLabelSize * 2.36,
        `${name}/${lanes} lanes: a stacked fraction of ${l.gateLabelSize.toFixed(1)} px needs ` +
          `${(l.gateLabelSize * 2.36).toFixed(1)} px and the orb is ${(l.gateR * 2).toFixed(1)}`,
      );
    }
  });

  test(`two gate candidates cannot overlap at ${name}`, () => {
    for (const lanes of [1, 2, 3]) {
      const l = computeLayout(w, h, lanes, safeRect(w, h, insets));
      const fit = gateFitFor(l);
      const diameter = l.gateR * 2;

      // The positional path: the closest two candidates the gate will ever
      // admit are exactly `minGapDenom` apart.
      const closest = l.runLen / fit.minGapDenom;
      assert.ok(
        closest >= diameter,
        `${name}/${lanes} lanes: candidates 1/${fit.minGapDenom} of a bar apart are ` +
          `${closest.toFixed(1)} px apart and ${diameter.toFixed(1)} px across — they overlap ` +
          `by ${(diameter - closest).toFixed(1)} px`,
      );

      // The flat fallback, which spaces `n` candidates at 1/(n+1) of the bar
      // and is reached in ordinary play whenever the host serves column
      // arithmetic. It obeys the same geometry or it is a second way to ship
      // the same defect.
      const flat = l.runLen / (fit.maxCandidates + 1);
      assert.ok(
        flat >= diameter,
        `${name}/${lanes} lanes: ${fit.maxCandidates} evenly spaced candidates sit ` +
          `${flat.toFixed(1)} px apart and are ${diameter.toFixed(1)} px across`,
      );

      assert.ok(fit.maxCandidates >= 2, "a gate is never a single unmissable target");
      assert.ok(fit.minGapDenom >= 2);
    }
  });
}

// ------------------------------------------------- the two controls, tappable
//
// "On Android, the pause button and the mute button are at the bottom and
// actually conflict with the safe area and can't be touched."
//
// They were 30 px squares sitting 12 px above the bottom of the safe rect. Two
// things were wrong and only one of them is about the safe rect: 30 px is under
// the 44 px minimum touch target, and the safe rect does not describe Android's
// gesture strip at all — plenty of devices report `safe-area-inset-bottom: 0`
// and still swallow a tap in the bottom 24 px. So the zero-inset Android case
// is in this list on purpose; it is the case that broke.

for (const [w, h, insets, name] of READING_VIEWPORTS) {
  test(`pause and mute can be touched at ${name}`, () => {
    const area = safeRect(w, h, insets);
    const l = computeLayout(w, h, 3, area);
    for (const i of [0, 1]) {
      const which = i === 0 ? "pause" : "mute";
      const r = buttonRect(i, l.area, l.compact, h);

      assert.ok(
        r.s >= MIN_TOUCH,
        `${name}: ${which} is ${r.s} px; ${MIN_TOUCH} px is the minimum touch target`,
      );

      // Inside the safe rect — the notch, the home indicator, the rounded
      // corners.
      assert.ok(
        r.x >= area.x - 0.5 &&
          r.y >= area.y - 0.5 &&
          r.x + r.s <= area.x + area.w + 0.5 &&
          r.y + r.s <= area.y + area.h + 0.5,
        `${name}: ${which} at x ${r.x.toFixed(0)}..${(r.x + r.s).toFixed(0)}, ` +
          `y ${r.y.toFixed(0)}..${(r.y + r.s).toFixed(0)} is outside the safe rect ` +
          `${span(area)}`,
      );

      // …AND clear of the system's gesture strip, measured from the raw canvas,
      // which is the part the safe rect cannot tell us about.
      assert.ok(
        r.y + r.s <= h - GESTURE_STRIP,
        `${name}: ${which} reaches y ${(r.y + r.s).toFixed(0)} of ${h}, inside the ` +
          `${GESTURE_STRIP} px the system swipes in`,
      );

      // The hit test agrees with the square that was drawn, at its centre and
      // at every corner.
      const cx = r.x + r.s / 2;
      const cy = r.y + r.s / 2;
      assert.equal(hitButton(cx, cy, l.area, l.compact, h), which, `${name}: ${which} centre`);
      for (const [dx, dy] of [
        [1, 1],
        [r.s - 1, 1],
        [1, r.s - 1],
        [r.s - 1, r.s - 1],
      ]) {
        assert.equal(
          hitButton(r.x + dx!, r.y + dy!, l.area, l.compact, h),
          which,
          `${name}: ${which} corner ${dx},${dy}`,
        );
      }
    }

    // And they are two controls, not one square drawn twice.
    const a = buttonRect(0, l.area, l.compact, h);
    const b = buttonRect(1, l.area, l.compact, h);
    assert.ok(
      a.x >= b.x + b.s || b.x >= a.x + a.s,
      `${name}: pause and mute overlap each other`,
    );
  });
}
