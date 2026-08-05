/**
 * The two things a phone does to this game that a browser window never does.
 *
 * 1. It puts a cutout and a home indicator over the glass, and `pack.html` opts
 *    in to that with `viewport-fit=cover`. In landscape the cutout is about 47
 *    CSS pixels of an 844-wide viewport, and the read band's page margin was a
 *    flat 0.94 NDC — three per cent. The outer candidate, which in this game IS
 *    an answer, therefore reached about twenty pixels underneath it.
 * 2. The host paints an exit control top-left and a how-to-play control
 *    top-right, over the pack. VOLTA's score was in the first corner and its
 *    surge meter in the second.
 *
 * Neither is visible in `npm run dev`, both are certain on a device, and both
 * are pure arithmetic — so they belong in a test rather than in a bug report.
 *
 * Removing either fix fails this file: point `ndcFrame` back at `BAND.edge` and
 * the landscape cases below blow up, and set `READOUT_CLEAR` back to a ten-pixel
 * margin and every `hitsHostChrome` assertion trips.
 */

import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  chromeRects,
  HOST_CONTROL,
  hitsHostChrome,
  safeRect,
  type Insets,
  type Rect,
} from "../../../../packs/shared/game-chrome/index.ts";
import {
  GESTURE_STRIP,
  hudBoxes,
  hudEdge,
  hudVars,
  makeStage,
  ndcFrame,
  readoutRect,
  READOUT_CLEAR,
  STAGE_BG,
  systemBottom,
  type StageEl,
} from "./chrome.ts";
import { HUD_CSS } from "./hud.ts";
import { envReadDirectly } from "../../../../packs/shared/game-chrome/cssSafeArea.ts";
import { inkVars } from "./contrast.ts";
import { BAND, fullFrame, payoffEdge, popupEdge, readBand, type GateGeom } from "./readband.ts";
import { INK, TRACK } from "./glyphs.ts";

const NONE: Insets = { top: 0, right: 0, bottom: 0, left: 0 };
/** A tall phone: cutout at the top, home indicator at the bottom. */
const PORTRAIT: Insets = { top: 47, right: 0, bottom: 34, left: 0 };
/** The same phone on its side: the cutout becomes a side inset, on both sides. */
const LANDSCAPE: Insets = { top: 0, right: 47, bottom: 21, left: 47 };

/**
 * The viewports the fleet actually has, smallest first.
 *
 * 320x568 is here because it is where reserving a band instead of overlaying one
 * broke a sibling game outright, and because it is the shape everything else is
 * tuned away from.
 */
const VIEWPORTS: Array<[string, number, number]> = [
  ["phone portrait, small", 320, 568],
  ["phone portrait", 390, 844],
  ["tablet portrait", 768, 1024],
  ["tablet landscape", 1024, 768],
  ["phone landscape", 844, 390],
];

/**
 * The insets a given viewport can actually have.
 *
 * Paired with the orientation rather than crossed with it: a 320-wide portrait
 * phone never has 47 pixels of cutout down each side, and asserting against
 * shapes no device produces only tempts the fix into clamping the safe area
 * away to make an imaginary case pass.
 */
function insetsFor(w: number, h: number): Array<[string, Insets]> {
  return [
    ["no insets", NONE],
    w > h ? ["cutout at the side", LANDSCAPE] : ["cutout at the top", PORTRAIT],
  ];
}



/* -------------------------------------------------------------------------- */
/* The host's two corners.                                                    */
/* -------------------------------------------------------------------------- */

test("the score and the surge meter are clear of the host's controls", () => {
  for (const [name, w, h] of VIEWPORTS) {
    for (const [label, insets] of insetsFor(w, h)) {
      for (const side of ["left", "right"] as const) {
        const r = readoutRect(side, w, insets);
        assert.equal(
          hitsHostChrome(r, w, insets),
          false,
          `${name} (${w}x${h}), ${label}: the ${side} readout is under the host's chrome`,
        );
        assert.ok(r.y + r.h <= h, `${name}: the ${side} readout runs off the bottom`);
      }
    }
  }
});

test("the readouts stay inside the safe area they were given", () => {
  for (const [name, w, h] of VIEWPORTS) {
    for (const [label, insets] of insetsFor(w, h)) {
      const safe = safeRect(w, h, insets);
      const left = readoutRect("left", w, insets);
      const right = readoutRect("right", w, insets);
      assert.ok(left.x >= safe.x, `${name}, ${label}: the score is inside the left inset`);
      assert.ok(
        right.x + right.w <= safe.x + safe.w + 1e-9,
        `${name}, ${label}: the surge meter is inside the right inset`,
      );
      assert.ok(left.y >= safe.y, `${name}, ${label}: the score is under the top inset`);
    }
  }
});

test("dropping the readouts clears the control and no more", () => {
  // A promise about two 44px squares, not a reserved band. If this number ever
  // grows into a real strip, that is the trade the sibling game's lattice
  // already showed to be wrong, and it should fail here first.
  assert.ok(READOUT_CLEAR >= HOST_CONTROL, "the readouts do not clear the control at all");
  assert.ok(READOUT_CLEAR <= HOST_CONTROL + 24, `READOUT_CLEAR is ${READOUT_CLEAR}px — that is a band`);
});

test("the HUD margin matches the clamp the stylesheet resolves to", () => {
  assert.equal(hudEdge(320), 10);
  assert.equal(hudEdge(2000), 26);
  assert.ok(Math.abs(hudEdge(800) - 800 * 0.022) < 1e-9);
});

/* -------------------------------------------------------------------------- */
/* Every HUD box, at every viewport, against every piece of chrome.            */
/* -------------------------------------------------------------------------- */

/**
 * The insets a phone can actually report, including the one that broke.
 *
 * A **zero bottom inset with a real top inset** is not a hypothetical: it is what
 * Android reports on a device with gesture navigation and a punch-hole camera,
 * and it is the founder's phone. The reported inset describes the display cutout;
 * the gesture handle eats the bottom of the glass and is not in it. Every case
 * with `bottom: 0` below is that case, and the voltage bar was underneath the
 * navigation bar in all of them.
 */
const DEVICE_INSETS: Array<[string, Insets]> = [
  ["no insets at all (a browser window)", NONE],
  ["android, gesture nav, zero bottom inset", { top: 24, right: 0, bottom: 0, left: 0 }],
  ["android, punch-hole status bar, zero bottom inset", { top: 40, right: 0, bottom: 0, left: 0 }],
  ["ios portrait, notch and home indicator", { top: 47, right: 0, bottom: 34, left: 0 }],
  ["ios landscape, cutout on both sides", { top: 0, right: 47, bottom: 21, left: 47 }],
];

/** The founder's phone first: 1080x2340 physical, DPR 3, and DPR 2.75 beside it. */
const DEVICE_VIEWPORTS: Array<[string, number, number]> = [
  ["founder's phone at dpr 3", 360, 780],
  ["founder's phone at dpr 2.75", 393, 851],
  ["phone portrait, small", 320, 568],
  ["phone portrait", 390, 844],
  ["phone landscape", 844, 390],
  ["tablet portrait", 768, 1024],
  ["tablet landscape", 1024, 768],
];

/**
 * Every (viewport, insets) pair a device can actually be in.
 *
 * Crossed by orientation rather than exhaustively, for the reason `insetsFor`
 * already gives above: a 360-wide portrait phone never has 47 pixels of cutout
 * down each side, and asserting against shapes no device produces only tempts the
 * fix into clamping the safe area away to make an imaginary case pass.
 */
function deviceCases(): Array<[string, number, number, Insets]> {
  const out: Array<[string, number, number, Insets]> = [];
  for (const [vname, w, h] of DEVICE_VIEWPORTS) {
    for (const [iname, insets] of DEVICE_INSETS) {
      const sideways = insets.left > 0 || insets.right > 0;
      if (sideways !== w > h && (sideways || insets.top > 0)) continue;
      out.push([`${vname} (${w}x${h}), ${iname}`, w, h, insets]);
    }
  }
  return out;
}

const overlap = (a: Rect, b: Rect): { w: number; h: number } => ({
  w: Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)),
  h: Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)),
});

test("no HUD box a child reads or touches is under the host's chrome", () => {
  for (const [ctx, w, h, insets] of deviceCases()) {
    const boxes = hudBoxes(w, h, insets);
    for (const [key, rect] of Object.entries(boxes)) {
      assert.equal(
        hitsHostChrome(rect, w, insets),
        false,
        `${ctx}: the ${key} box ${JSON.stringify(rect)} is under the host's chrome ` +
          `(exit ${JSON.stringify(chromeRects(w, insets)[0])}, help ${JSON.stringify(chromeRects(w, insets)[1])})`,
      );
    }
    assert.ok(h > 0);
  }
});

test("no HUD box a child reads or touches is outside the safe rect", () => {
  for (const [name, w, h, insets] of deviceCases()) {
    const safe = safeRect(w, h, insets);
    for (const [key, r] of Object.entries(hudBoxes(w, h, insets))) {
      const ctx = `${name}: the ${key} box`;
      assert.ok(r.x >= safe.x - 1e-9, `${ctx} starts at x=${r.x.toFixed(1)}, inside the left inset`);
      assert.ok(r.y >= safe.y - 1e-9, `${ctx} starts at y=${r.y.toFixed(1)}, under the top inset`);
      assert.ok(
        r.x + r.w <= safe.x + safe.w + 1e-9,
        `${ctx} reaches x=${(r.x + r.w).toFixed(1)} of a safe area ending at ${(safe.x + safe.w).toFixed(1)}`,
      );
      assert.ok(
        r.y + r.h <= safe.y + safe.h + 1e-9,
        `${ctx} reaches y=${(r.y + r.h).toFixed(1)} of a safe area ending at ${(safe.y + safe.h).toFixed(1)}`,
      );
    }
  }
});

/**
 * Height of Android's gesture-navigation handle, in CSS pixels.
 *
 * Written here as its own number rather than read from `GESTURE_STRIP`, because a
 * test whose floor is the constant it is checking passes when somebody sets that
 * constant to zero. This is a fact about the platform; `GESTURE_STRIP` is the
 * game's response to it, and the two are asserted against each other below.
 */
const ANDROID_HANDLE_PX = 24;

test("nothing at the bottom is inside the strip the system swipes in", () => {
  // The safe rect is not enough here and that is the entire point: on the
  // founder's phone the reported bottom inset is ZERO and the gesture handle
  // still owns the bottom 24 CSS pixels. Before this allowance the voltage bar
  // sat 12px off the bottom edge, so all 13px of it were inside the strip.
  assert.ok(
    GESTURE_STRIP >= ANDROID_HANDLE_PX,
    `GESTURE_STRIP is ${String(GESTURE_STRIP)}px against a ${String(ANDROID_HANDLE_PX)}px handle`,
  );
  for (const [ctx, w, h, insets] of deviceCases()) {
    const boxes = hudBoxes(w, h, insets);
    const floor = h - ANDROID_HANDLE_PX;
    for (const key of ["voltage", "tools", "perf"] as const) {
      const r = boxes[key];
      assert.ok(
        r.y + r.h <= floor + 1e-9,
        `${ctx}: the ${key} box ends at y=${(r.y + r.h).toFixed(1)} of ${String(h)} — ` +
          `${(r.y + r.h - floor).toFixed(1)}px inside the ${String(ANDROID_HANDLE_PX)}px the system swipes in`,
      );
    }
    assert.ok(systemBottom(insets) >= ANDROID_HANDLE_PX, `${ctx}: the bottom allowance collapsed`);
  }
});

test("the bottom readouts and the two buttons do not sit on each other", () => {
  // Only the three bottom boxes, and deliberately not the corner readouts
  // against the prompt. `READOUT_W`/`READOUT_H` and `PROMPT_W` are *allowances* —
  // each is far larger than the ink it stands for, on purpose, so that every
  // clearance assertion above is conservative. Two allowances overlapping tells
  // you about the allowances. These three are tight boxes around real furniture
  // and are stacked in the same corner, so their overlap is real.
  for (const [ctx, w, h, insets] of deviceCases()) {
    const b = hudBoxes(w, h, insets);
    for (const [a, c] of [
      ["voltage", "tools"],
      ["voltage", "perf"],
      ["tools", "perf"],
    ] as const) {
      const o = overlap(b[a], b[c]);
      assert.ok(o.w === 0 || o.h === 0, `${ctx}: ${a} and ${c} overlap by ${o.w.toFixed(1)}x${o.h.toFixed(1)}px`);
    }
    assert.ok(w > 0 && h > 0);
  }
});

/* -------------------------------------------------------------------------- */
/* ...and the stylesheet cannot disagree with any of it.                       */
/* -------------------------------------------------------------------------- */

test("no rule takes its ANSWER from env(safe-area-inset-*)", () => {
  // The whole defect, in one assertion. `env()` belongs to the top-level
  // browsing context; a pack frame is sandboxed `allow-scripts` with no
  // `allow-same-origin`, so all four resolve to ZERO inside it, on every device,
  // for ever. The tests above were passing with insets the CSS never saw.
  //
  // This used to forbid the four characters `env(` outright. That was the right
  // instinct and the wrong rule: the fleet now has ONE way to write a safe-area
  // length — `var(--dw-safe-<side>, env(safe-area-inset-<side>, 0px))` — where
  // the published property is the answer inside the app and the `env()` behind
  // it only ever answers in a dev browser tab, which IS the top-level context
  // and where it is right. Forbidding the string forbade the shared form too,
  // and a pack that cannot use the shared form goes back to inventing its own.
  //
  // `envReadDirectly` is the shared check and it is not a substring search: it
  // fails any occurrence that is not exactly the fallback of the published
  // property. `packs/sdk/src/safearea.test.ts` runs the same rule over every
  // pack in the fleet, on every pull request.
  assert.deepEqual(
    envReadDirectly(HUD_CSS),
    [],
    "hud.ts reads env(safe-area-inset-*) as an ANSWER, which is 0 inside a pack",
  );
});

test("every in-run HUD box takes its position from chrome.ts and nowhere else", () => {
  // A structural guard, not a string match on the values: if a positional
  // declaration on one of these five selectors is anything other than a `var()`,
  // the stylesheet has geometry of its own again and the two can drift — which
  // is how this shipped twice.
  const rules = new Map<string, string>();
  for (const m of HUD_CSS.matchAll(/(^|\n)(\.vt-[a-z-]+)\s*\{([^}]*)\}/g)) {
    rules.set(m[2] ?? "", (rules.get(m[2] ?? "") ?? "") + ";" + (m[3] ?? ""));
  }
  const POSITIONAL = ["left", "right", "top", "bottom"];
  for (const sel of [".vt-prompt", ".vt-tl", ".vt-tr", ".vt-volt", ".vt-tools", ".vt-perf"]) {
    const body = rules.get(sel);
    assert.ok(body !== undefined, `${sel} is not in the stylesheet any more; this test is measuring nothing`);
    for (const decl of body.split(";")) {
      const colon = decl.indexOf(":");
      if (colon < 0) continue;
      const prop = decl.slice(0, colon).trim();
      const value = decl.slice(colon + 1).trim();
      if (!POSITIONAL.includes(prop)) continue;
      // `left: 50%` on the prompt is the centring transform's own anchor, not an
      // inset, and it is paired with `translate(-50%, 0)`.
      if (sel === ".vt-prompt" && prop === "left") continue;
      assert.ok(
        value.startsWith("var(--vt-"),
        `${sel} { ${prop}: ${value} } — that is arithmetic the stylesheet owns, and chrome.ts owns the same number`,
      );
    }
  }
});

test("hudVars fills in every custom property the stylesheet asks for", () => {
  // The other half of the guard above: a `var()` with no author-supplied value
  // silently falls back to its default, which is how a HUD laid out for a phone
  // with no insets would keep painting on one that has them.
  const vars = hudVars(360, 780, { top: 24, right: 0, bottom: 0, left: 0 });
  // The colours are the other half of the same contract and are owned by
  // `contrast.ts` — geometry here, ink there, and between them every `var()` in
  // the sheet has an author-supplied value. `--vt-accent` is the live biome
  // colour, written on the root by `mount.ts` on every biome change.
  const inks = inkVars(0x02030c, 0x071230, 0x070a18, 0x37ecff);
  const setElsewhere = new Set(["--vt-accent", ...Object.keys(inks)]);
  for (const m of HUD_CSS.matchAll(/var\((--vt-[a-z-]+)/g)) {
    const name = m[1] ?? "";
    if (setElsewhere.has(name)) continue;
    assert.ok(name in vars, `the stylesheet reads ${name} and hudVars never sets it`);
  }
  // ...and neither module may quietly claim the other's property.
  for (const name of Object.keys(vars)) {
    assert.ok(!(name in inks), `${name} is set by BOTH hudVars and inkVars; one of them loses`);
  }
  for (const [name, value] of Object.entries(vars)) {
    assert.ok(/^-?\d+(\.\d+)?px$/.test(value), `${name} is "${value}", which is not a length`);
  }
});

test("the measured insets reach the boxes at all — the drift that shipped", () => {
  // Stated as an assertion because the previous two tests would both pass on a
  // HUD that ignored its argument. The founder's phone: a 24px top inset and the
  // host's chevron 37..81px down the glass.
  const flat = hudBoxes(360, 780, NONE);
  const android = hudBoxes(360, 780, { top: 24, right: 0, bottom: 0, left: 0 });
  assert.equal(android.score.y - flat.score.y, 24, "the top inset does not move the score");
  assert.equal(flat.score.y, READOUT_CLEAR, "with no insets the score sits exactly under the control");
  // And the geometry it used to paint at — 63px, inside a 37..81px chevron.
  const exit = chromeRects(360, { top: 24, right: 0, bottom: 0, left: 0 })[0];
  assert.ok(exit !== undefined);
  assert.ok(
    flat.score.y < exit.y + exit.h,
    `a score at y=${String(flat.score.y)} would be clear of a chevron ending at ${String(exit.y + exit.h)} — ` +
      "the regression this pins is gone and so is its evidence",
  );
});

/* -------------------------------------------------------------------------- */
/* The safe area, in NDC, where the answers are drawn.                        */
/* -------------------------------------------------------------------------- */

/** NDC x -> CSS pixels from the left edge. */
const ndcToPx = (x: number, w: number): number => ((x + 1) / 2) * w;
/** NDC y (up) -> CSS pixels from the top edge. */
const ndcYToPx = (y: number, h: number): number => ((1 - y) / 2) * h;

test("with no insets the frame is exactly the margins the game always had", () => {
  const f = ndcFrame(390, 844, NONE);
  assert.equal(f.edge, BAND.edge);
  assert.equal(f.top, BAND.top);
  assert.equal(f.minH, fullFrame(844).minH);
  // The floor is the HUD's own bottom furniture, which exists on every device,
  // so it is never the bare bottom of the glass.
  assert.ok(f.bottom > -1, "the row may sink under the voltage bar");
  assert.ok(f.bottom < -0.7, `the floor is ${f.bottom.toFixed(2)} NDC — that is a reserved band`);
});

test("a side cutout pulls the page margin in, so the outer answer stays visible", () => {
  const f = ndcFrame(844, 390, LANDSCAPE);
  assert.ok(f.edge < BAND.edge, "the frame ignored a 47px side cutout");
  // The margin lands exactly on the safe edge, not somewhere near it.
  assert.ok(Math.abs(ndcToPx(f.edge, 844) - (844 - 47)) < 1e-9);
});

/* The camera, mirrored from `mount.ts` so the numbers are the real ones. */
const CAM_Z = 11.4;
const ARCH = 4.9;
const LANE_W = 3.35;
function scales(w: number, h: number, fovDeg: number, dist: number): { kx: number; ky: number } {
  const ky = 1 / Math.tan((fovDeg * Math.PI) / 360) / (dist + CAM_Z);
  return { kx: ky / (w / h), ky };
}
function geomFor(kx: number, ky: number, archTop: number, centre = 0): GateGeom {
  const archH = Math.abs(ky) * ARCH;
  return { centre, lanePitch: Math.abs(kx) * LANE_W, archTop, archH, deck: archTop - archH };
}
/** World width of a numeral at ink height 1, for `digits` digits. */
const unit = (digits: number, advance: number): number => digits * advance * (1 / INK) * TRACK;

test("no answer is ever drawn under the cutout, at any viewport or rotation", () => {
  // This is the assertion the whole file exists for. The three candidates are
  // the answer UI — there is no keypad and no button — so a numeral the cutout
  // eats is not a cosmetic problem, it is a question with a missing option.
  for (const [name, w, h] of VIEWPORTS) {
    for (const [label, insets] of insetsFor(w, h)) {
      const frame = ndcFrame(w, h, insets);
      const safe = safeRect(w, h, insets);
      for (const fov of [58, 74, 104]) {
        for (const dist of [4, 30, 90, 240]) {
          const { kx, ky } = scales(w, h, fov, dist);
          for (const adv of [0.36, 0.43, 0.5]) {
            for (const n of [1, 2, 3, 4]) {
              const u = unit(n, adv);
              for (const centre of [-0.8, -0.25, 0, 0.4]) {
                for (const archTop of [-0.4, 0.2, 1.4]) {
                  const band = readBand([u, u, u], kx, ky, geomFor(kx, ky, archTop, centre), frame);
                  const ctx = `${name} ${label} fov${fov} d${dist} adv${adv} n${n} cx${centre}`;

                  const leftPx = ndcToPx(band.x[0] - band.wNdc / 2, w);
                  const rightPx = ndcToPx(band.x[2] + band.wNdc / 2, w);
                  assert.ok(leftPx >= safe.x - 1e-6, `${ctx}: left answer is ${leftPx.toFixed(1)}px, inside the left inset`);
                  assert.ok(
                    rightPx <= safe.x + safe.w + 1e-6,
                    `${ctx}: right answer reaches ${rightPx.toFixed(1)}px of a safe area ending at ${(safe.x + safe.w).toFixed(1)}px`,
                  );

                  const topPx = ndcYToPx(band.y + band.hNdc / 2, h);
                  const botPx = ndcYToPx(band.y - band.hNdc / 2, h);
                  assert.ok(topPx >= safe.y - 1e-6, `${ctx}: the row rises into the top inset`);
                  assert.ok(botPx <= safe.y + safe.h + 1e-6, `${ctx}: the row sinks into the bottom inset`);

                  // And the row is never under a host control either.
                  assert.equal(
                    hitsHostChrome(
                      { x: leftPx, y: topPx, w: rightPx - leftPx, h: botPx - topPx },
                      w,
                      insets,
                    ),
                    false,
                    `${ctx}: the answer row is under the host's chrome`,
                  );
                }
              }
            }
          }
        }
      }
    }
  }
});

test("the answers are still large enough to read once the cutout is respected", () => {
  // Pulling the margin in costs width, and width is what a three-digit answer on
  // a small screen is made of. If honouring the safe area ever shrinks a numeral
  // below what a child can read at speed, the fix has broken the game it was
  // protecting, and that is worse than the bug.
  for (const [name, w, h] of VIEWPORTS) {
    for (const [label, insets] of insetsFor(w, h)) {
      const frame = ndcFrame(w, h, insets);
      const { kx, ky } = scales(w, h, 74, 90);
      const u = unit(3, 0.5);
      const band = readBand([u, u, u], kx, ky, geomFor(kx, ky, 0.1), frame);
      const capPx = (band.hNdc / 2) * h;
      const gutterPx = ((band.pitch - band.wNdc) / 2) * w;
      assert.ok(capPx >= 24, `${name}, ${label}: three digits render at ${capPx.toFixed(1)}px cap height`);
      assert.ok(gutterPx >= 12, `${name}, ${label}: only ${gutterPx.toFixed(1)}px of clear air between answers`);
    }
  }
});

test("the payoff and the score popups honour the same frame", () => {
  for (const [, w, h] of VIEWPORTS) {
    for (const [, insets] of insetsFor(w, h)) {
      const f = ndcFrame(w, h, insets);
      assert.ok(payoffEdge(f.edge) < f.edge, "the payoff margin is not inside the frame");
      assert.ok(popupEdge(f.edge) < f.edge, "the popup margin is not inside the frame");
      assert.ok(ndcToPx(payoffEdge(f.edge), w) <= w - insets.right, "the payoff can reach the cutout");
      assert.ok(ndcToPx(popupEdge(f.edge), w) <= w - insets.right, "a popup can reach the cutout");
      assert.ok(h > 0);
    }
  }
});

/* ------------------------------- the stage -------------------------------- */

/**
 * What `pack.html` declares about the element the pack mounts into.
 *
 * Read out of the real file rather than restated here, because the defect this
 * section pins is exactly a disagreement between that file and this game's code:
 * the only box `#app` has comes from the stylesheet, and any inline `position`
 * the game writes wins over it.
 */
function packStageRule(): Map<string, string> {
  const html = readFileSync(new URL("../../pack.html", import.meta.url), "utf8");
  const rule = /#app\s*\{([^}]*)\}/.exec(html);
  assert.ok(rule, "pack.html has no #app rule; this test is measuring the wrong element");
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
 * A deliberately tiny slice of CSS, and only the slice VOLTA's layout depends
 * on: every child of the stage is `position:absolute; inset:0`, so the stage has
 * no in-flow content and `height: auto` resolves to zero. It gets a height from
 * exactly two places — an explicit `height`, or being out of flow with both
 * `top` and `bottom` pinned. Inline declarations beat the stylesheet, which is
 * the whole mechanism of the bug.
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
  // pack.html ever gives #app a height of its own, an inline `position` stops
  // being able to collapse it and these tests are measuring a bug that is gone.
  const sheet = packStageRule();
  assert.equal(sheet.get("height"), undefined, "#app now has a height; re-derive this section");
  assert.equal(stageHeight(sheet, new Map(), 1180), 1180, "#app has no box even untouched");
});

test("an inline position on the stage collapses the whole game to nothing", () => {
  // The failure, stated. `el.style.position = el.style.position || "relative"`
  // read the INLINE position, which is empty for an element positioned from a
  // stylesheet, so it always fired — and took `inset: 0` with it. Measured in a
  // framed pack before the fix: #app 820x0, canvas style height 1px, black glass
  // and nothing else, on iOS and Android alike.
  const sheet = packStageRule();
  assert.equal(stageHeight(sheet, new Map([["position", "relative"]]), 1180), 0);
  assert.equal(stageHeight(sheet, new Map([["position", "static"]]), 1180), 0);
});

test("makeStage leaves a stage the document has already positioned alone", () => {
  const sheet = packStageRule();
  // What a browser computes for #app at the moment `mountRunner` runs.
  const computed = sheet.get("position") ?? "static";
  const el: StageEl = { style: { position: "", overflow: "", touchAction: "", background: "" } };
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
  // A host that hands over a plain in-flow div — the dev harness before its own
  // stylesheet existed, and any future host — still needs the canvas and the HUD
  // to have something to be absolute against.
  const el: StageEl = { style: { position: "", overflow: "", touchAction: "", background: "" } };
  makeStage(el, "static");
  assert.equal(el.style.position, "relative");
});

test("makeStage takes the rest of the stage either way", () => {
  for (const computed of ["static", "relative", "absolute", "fixed", "sticky"]) {
    const el: StageEl = { style: { position: "", overflow: "", touchAction: "", background: "" } };
    makeStage(el, computed);
    assert.equal(el.style.overflow, "hidden", computed);
    assert.equal(el.style.touchAction, "none", computed);
    assert.equal(el.style.background, STAGE_BG, computed);
  }
});
