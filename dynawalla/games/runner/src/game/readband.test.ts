import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BAND, FULL_FRAME, readBand, payoffHeight, keepInside,
  PAYOFF_EDGE, PAYOFF_MAX_H, POPUP_EDGE,
} from "./readband.ts";
import { INK, TRACK } from "./glyphs.ts";

/**
 * The regression suite for the bug that made VOLTA unplayable.
 *
 * A judge played the shipped build and captured 13|42|36 rendering as
 * "134236" and 82|92|72 as "829272", and on a 390px phone the third value was
 * clipped off the right edge entirely. These tests exist so that can never
 * return, on any device, for any answer the curriculum can produce.
 *
 * Nothing here needs a GPU: `readBand` is pure arithmetic over the projection's
 * two scale factors, so the whole device matrix is a loop.
 */

/* The camera, mirrored from mount.ts so the numbers are the real ones. */
const FOV_MIN = 58;
const FOV_MAX = 104;
const CAM_Z = 11.4;

/** NDC-per-world-unit at a gate `dist` metres ahead, for a viewport and FOV. */
function scales(w: number, h: number, fovDeg: number, dist: number): { kx: number; ky: number } {
  const aspect = w / h;
  const ky = 1 / Math.tan((fovDeg * Math.PI) / 360) / (dist + CAM_Z);
  return { kx: ky / aspect, ky };
}

/**
 * World width of a numeral at ink height 1.
 *
 * The atlas is built from whatever font the device actually resolves, so the
 * per-digit advance is not a constant we control. This sweeps the whole
 * plausible range — a condensed grotesque through Arial Black — so the layout
 * has to hold for any of them.
 *
 * `INK` and `TRACK` come from `glyphs.ts` rather than being copied here: a floor
 * asserted against a copy of the renderer's metrics is a floor on a font nobody
 * ships.
 */
function unit(digits: number, advance: number): number {
  return digits * advance * (1 / INK) * TRACK;
}

const VIEWPORTS: Array<[number, number, string]> = [
  [320, 568, "320 phone portrait"],
  [360, 640, "360 phone portrait"],
  [390, 844, "390 phone portrait"],
  [844, 390, "phone landscape"],
  [768, 1024, "tablet portrait"],
  [1024, 768, "tablet landscape"],
  [1280, 800, "laptop"],
  [1920, 1080, "desktop"],
  [2560, 1080, "ultrawide"],
];
const ADVANCES = [0.36, 0.43, 0.5];
const DIGIT_COUNTS = [1, 2, 3, 4];
const DISTANCES = [4, 12, 30, 60, 100, 160, 240];
const APPROACHES = [0, 0.25, 0.5, 0.75, 1];

function forEachCase(fn: (b: ReturnType<typeof readBand>, ctx: string, w: number, h: number) => void): void {
  for (const [vw, vh, label] of VIEWPORTS) {
    for (const fov of [FOV_MIN, 74, FOV_MAX]) {
      for (const dist of DISTANCES) {
        const { kx, ky } = scales(vw, vh, fov, dist);
        for (const adv of ADVANCES) {
          for (const n of DIGIT_COUNTS) {
            // Worst case for collision is every candidate at the widest size.
            const u = unit(n, adv);
            for (const a of APPROACHES) {
              for (const archTop of [-0.4, 0, 0.2, 0.6, 1.4]) {
                const band = readBand([u, u, u], kx, ky, a, archTop, FULL_FRAME);
                fn(band, `${label} fov${fov} d${dist} adv${adv} n${n} a${a} arch${archTop}`, vw, vh);
              }
            }
          }
        }
      }
    }
  }
}

test("adjacent candidates never touch", () => {
  forEachCase((band, ctx) => {
    const gap = band.pitch - band.wNdc;
    assert.ok(
      gap > 0.12,
      `${ctx}: gutter ${gap.toFixed(3)} NDC is too small — numerals would read as one string`,
    );
  });
});

test("no candidate is clipped by the viewport", () => {
  forEachCase((band, ctx) => {
    const outer = Math.abs(band.x[2]) + band.wNdc / 2;
    assert.ok(outer <= BAND.edge + 1e-9, `${ctx}: right candidate reaches ${outer.toFixed(3)} NDC`);
    assert.ok(band.y - band.hNdc / 2 > -1, `${ctx}: row sinks off the bottom`);
    assert.ok(band.y + band.hNdc / 2 < 1, `${ctx}: row rises off the top`);
  });
});

test("the row never collides with the prompt", () => {
  forEachCase((band, ctx) => {
    assert.ok(band.y + band.hNdc / 2 <= BAND.top + 1e-9, `${ctx}: row overlaps the prompt line`);
  });
});

test("numerals stay big enough to read on the smallest supported screen", () => {
  // The floor is the smallest phone we claim to support, the widest font, and
  // the most digits an answer realistically has.
  const { kx, ky } = scales(320, 568, 74, 90);
  const u = unit(3, 0.5);
  const band = readBand([u, u, u], kx, ky, 0, 0.1, FULL_FRAME);
  const capPx = (band.hNdc / 2) * 568;
  assert.ok(capPx >= 24, `three digits at 320px render at ${capPx.toFixed(1)}px cap height`);
});

test("two digits on a 390px phone are unmistakable", () => {
  const { kx, ky } = scales(390, 844, 74, 90);
  const u = unit(2, 0.43);
  const band = readBand([u, u, u], kx, ky, 0, 0.1, FULL_FRAME);
  const capPx = (band.hNdc / 2) * 844;
  const gapPx = ((band.pitch - band.wNdc) / 2) * 390;
  assert.ok(capPx >= 44, `two digits at 390px render at ${capPx.toFixed(1)}px cap height`);
  assert.ok(gapPx >= 24, `only ${gapPx.toFixed(1)}px of clear air between candidates at 390px`);
});

test("apparent size does not depend on how far away the gate is", () => {
  // The old layout scaled with distance, so a numeral was eleven pixels tall
  // when it mattered and a wall of ink when it no longer did.
  const u = unit(2, 0.43);
  const sizes = DISTANCES.map((d) => {
    const { kx, ky } = scales(1280, 800, 74, d);
    return readBand([u, u, u], kx, ky, 0, 0.1, FULL_FRAME).hNdc;
  });
  for (const s of sizes) assert.ok(Math.abs(s - sizes[0]) < 1e-6, `sizes drift with distance: ${sizes.join(", ")}`);
});

test("a mixed-width gate sizes every candidate to the widest", () => {
  const { kx, ky } = scales(1280, 800, 74, 60);
  const wide = unit(3, 0.43);
  const narrow = unit(1, 0.43);
  const mixed = readBand([narrow, wide, narrow], kx, ky, 0.3, 0.1, FULL_FRAME);
  const allWide = readBand([wide, wide, wide], kx, ky, 0.3, 0.1, FULL_FRAME);
  assert.equal(mixed.hNdc, allWide.hNdc);
});

test("the row opens outward as the gate arrives", () => {
  const u = unit(2, 0.43);
  const { kx, ky } = scales(1280, 800, 74, 60);
  const far = readBand([u, u, u], kx, ky, 0, 0.1, FULL_FRAME);
  const near = readBand([u, u, u], kx, ky, 1, 0.1, FULL_FRAME);
  assert.ok(near.pitch > far.pitch, "candidates should spread as the gate closes");
});

/* -------------------------------------------------------------------------- */
/* The payoff, and the score popups.                                          */
/* -------------------------------------------------------------------------- */

/** NDC width per NDC of height, for `n` digits on a viewport. Mirrors the caller. */
function widthPerHeight(n: number, advance: number, w: number, h: number, fovDeg: number): number {
  const { kx, ky } = scales(w, h, fovDeg, 14);
  return unit(n, advance) * (Math.abs(kx) / Math.abs(ky));
}

test("the winning numeral never rushes past the edge of the screen", () => {
  // The best moment in the game used to swell to a flat 1.55 NDC *tall* with
  // nothing looking at how wide that made it. On a 390px phone a two-digit
  // answer came out 2.7 NDC wide against a 2.0 NDC screen: two green slabs.
  for (const [vw, vh, label] of VIEWPORTS) {
    for (const fov of [FOV_MIN, 74, FOV_MAX]) {
      for (const adv of ADVANCES) {
        for (const n of DIGIT_COUNTS) {
          const wPerH = widthPerHeight(n, adv, vw, vh, fov);
          for (const swell of [0, 0.25, 0.5, 0.75, 1]) {
            const h = payoffHeight(wPerH, 0.2, swell, PAYOFF_EDGE);
            const ctx = `${label} fov${fov} adv${adv} n${n} swell${swell}`;
            assert.ok(h * wPerH <= 2 * PAYOFF_EDGE + 1e-9, `${ctx}: payoff is ${(h * wPerH).toFixed(2)} NDC wide`);
            assert.ok(h <= PAYOFF_MAX_H + 1e-9, `${ctx}: payoff is ${h.toFixed(2)} NDC tall`);
          }
        }
      }
    }
  }
});

test("the payoff grows out of the row and never shrinks back", () => {
  const wPerH = widthPerHeight(2, 0.43, 1280, 800, 74);
  let prev = -Infinity;
  for (let s = 0; s <= 1.0001; s += 0.05) {
    const h = payoffHeight(wPerH, 0.2, s, PAYOFF_EDGE);
    assert.ok(h >= prev - 1e-12, `payoff shrank at swell ${s.toFixed(2)}`);
    prev = h;
  }
  assert.equal(payoffHeight(wPerH, 0.2, 0, PAYOFF_EDGE), 0.2, "the payoff must start exactly where the row left off");
});

test("the swell is one-way even for a row the layout cannot currently produce", () => {
  // `readBand` keeps every candidate well inside the payoff ceiling, so this
  // input does not arise today. It is asserted anyway: a numeral that shrank on
  // a win would read as the game reclaiming the prize, and that should be
  // impossible by construction rather than by the row happening to be small.
  const wPerH = widthPerHeight(4, 0.5, 320, 568, FOV_MAX);
  const from = 1.4;
  for (const s of [0, 0.5, 1]) {
    assert.ok(payoffHeight(wPerH, from, s, PAYOFF_EDGE) >= from, `payoff dipped below ${from} at swell ${s}`);
  }
});

test("the read band never hands the payoff a numeral that is already too wide", () => {
  // The invariant the one-way swell above is standing in for. If this ever
  // fails, the payoff ceiling has stopped being the binding constraint and the
  // two functions need to be reconciled rather than both quietly clamping.
  forEachCase((band, ctx) => {
    // `scale` in `drawCandidates` is an easeOutBack, which overshoots ~10%.
    assert.ok(band.wNdc * 1.1 <= 2 * PAYOFF_EDGE, `${ctx}: row is ${band.wNdc.toFixed(2)} NDC wide`);
  });
});

test("a score popup gives up its lane rather than hang off the edge", () => {
  // "+100" over the outer lane used to hang half off a 390px screen as "00".
  for (const halfW of [0, 0.1, 0.4, 0.9, 1.4]) {
    for (const nx of [-3, -0.9, -0.2, 0, 0.2, 0.9, 3]) {
      const x = keepInside(nx, halfW, POPUP_EDGE);
      assert.ok(Math.abs(x) + halfW <= POPUP_EDGE + 1e-9 || halfW >= POPUP_EDGE,
        `half-width ${halfW} at ${nx} landed at ${x.toFixed(2)}`);
      assert.ok(Math.abs(x) <= Math.abs(nx) + 1e-9, "clamping moved the popup outward");
      assert.ok(x === 0 || Math.sign(x) === Math.sign(nx), "clamping flipped the popup to the other side");
    }
  }
  // Something already inside is left exactly alone, so the common case is a
  // no-op and the popup keeps its lane.
  assert.equal(keepInside(0.3, 0.2, POPUP_EDGE), 0.3);
});
