import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BAND, fullFrame, readBand, payoffHeight, keepInside,
  PAYOFF_EDGE, PAYOFF_MAX_H, POPUP_EDGE, type GateGeom,
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
 * two scale factors, so the whole device matrix is a loop. The row's *relationship
 * to its gate* is asserted separately, in `gatelayout.test.ts`, against the real
 * `Projector` and the real camera pose — that one is about whether the answers sit
 * with the windows, and it cannot be checked without a projection.
 */

/* The camera, mirrored from mount.ts so the numbers are the real ones. */
const FOV_MIN = 58;
const FOV_MAX = 104;
const CAM_Z = 11.4;
/** Height of a gate arch in world units, from `drawGates`. */
const ARCH = 4.9;
/** Lane spacing in world units, from `world.ts`. */
const LANE_W = 3.35;

/** NDC-per-world-unit at a gate `dist` metres ahead, for a viewport and FOV. */
function scales(w: number, h: number, fovDeg: number, dist: number): { kx: number; ky: number } {
  const aspect = w / h;
  const ky = 1 / Math.tan((fovDeg * Math.PI) / 360) / (dist + CAM_Z);
  return { kx: ky / aspect, ky };
}

/**
 * A gate at that depth, with its arch top wherever the sweep puts it.
 *
 * `archTop` is swept rather than derived because it depends on the camera's
 * pitch, its height, the causeway bend and the player's own vertical position —
 * all of which move during a run. The values swept below bracket everything the
 * game can produce, including a gate whose arch is above the top of the screen.
 */
function geomFor(kx: number, ky: number, archTop: number, centre = 0): GateGeom {
  const archH = Math.abs(ky) * ARCH;
  return { centre, lanePitch: Math.abs(kx) * LANE_W, archTop, archH, deck: archTop - archH };
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
  [360, 780, "360 phone portrait"],
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
/** How far off screen-centre the chase camera can put the gate. */
const CENTRES = [-0.9, -0.3, 0, 0.45];

function forEachCase(fn: (b: ReturnType<typeof readBand>, ctx: string, w: number, h: number) => void): void {
  for (const [vw, vh, label] of VIEWPORTS) {
    const frame = fullFrame(vh);
    for (const fov of [FOV_MIN, 74, FOV_MAX]) {
      for (const dist of DISTANCES) {
        const { kx, ky } = scales(vw, vh, fov, dist);
        for (const adv of ADVANCES) {
          for (const n of DIGIT_COUNTS) {
            // Worst case for collision is every candidate at the widest size.
            const u = unit(n, adv);
            for (const archTop of [-0.4, 0, 0.2, 0.6, 1.4]) {
              for (const centre of CENTRES) {
                const band = readBand([u, u, u], kx, ky, geomFor(kx, ky, archTop, centre), frame);
                fn(band, `${label} fov${fov} d${dist} adv${adv} n${n} arch${archTop} cx${centre}`, vw, vh);
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
    // Both ends, because the row now follows the gate across the screen and the
    // gate can be off to either side. Checking only x[2] was sound when the row
    // was symmetric about the centre of the glass and is not any more.
    const left = band.x[0] - band.wNdc / 2;
    const right = band.x[2] + band.wNdc / 2;
    assert.ok(left >= -BAND.edge - 1e-9, `${ctx}: left candidate reaches ${left.toFixed(3)} NDC`);
    assert.ok(right <= BAND.edge + 1e-9, `${ctx}: right candidate reaches ${right.toFixed(3)} NDC`);
    assert.ok(band.y - band.hNdc / 2 > -1, `${ctx}: row sinks off the bottom`);
    assert.ok(band.y + band.hNdc / 2 < 1, `${ctx}: row rises off the top`);
  });
});

test("the row keeps its pitch even where the frame has to pull it in", () => {
  // The row is one object. Clamping the outer candidates individually would give
  // three unequal gaps, which is exactly what the gutter rule exists to stop, so
  // the whole row shifts instead.
  forEachCase((band, ctx) => {
    const leftGap = band.x[1] - band.x[0];
    const rightGap = band.x[2] - band.x[1];
    assert.ok(Math.abs(leftGap - rightGap) < 1e-9, `${ctx}: pitch is ${leftGap.toFixed(3)} / ${rightGap.toFixed(3)}`);
  });
});

test("the row never collides with the prompt", () => {
  forEachCase((band, ctx) => {
    assert.ok(band.y + band.hNdc / 2 <= BAND.top + 1e-9, `${ctx}: row overlaps the prompt line`);
  });
});

test("numerals stay big enough to read on the smallest supported screen", () => {
  // The floor is the smallest phone we claim to support, the widest font, and
  // the most digits an answer realistically has, on a gate far enough away that
  // its arch cannot carry a readable numeral — so this is `frame.minH` and the
  // width ceiling doing their jobs, with nothing from the gate.
  const { kx, ky } = scales(320, 568, 74, 90);
  const u = unit(3, 0.5);
  const band = readBand([u, u, u], kx, ky, geomFor(kx, ky, 0.1), fullFrame(568));
  const capPx = (band.hNdc / 2) * 568;
  assert.ok(capPx >= 24, `three digits at 320px render at ${capPx.toFixed(1)}px cap height`);
});

test("two digits on a 390px phone are unmistakable", () => {
  const { kx, ky } = scales(390, 844, 74, 90);
  const u = unit(2, 0.43);
  const band = readBand([u, u, u], kx, ky, geomFor(kx, ky, 0.1), fullFrame(844));
  const capPx = (band.hNdc / 2) * 844;
  const gapPx = ((band.pitch - band.wNdc) / 2) * 390;
  assert.ok(capPx >= 44, `two digits at 390px render at ${capPx.toFixed(1)}px cap height`);
  assert.ok(gapPx >= 24, `only ${gapPx.toFixed(1)}px of clear air between candidates at 390px`);
});

test("apparent size never falls below the legibility floor, however far the gate is", () => {
  // This replaces "apparent size does not depend on how far away the gate is".
  //
  // That property was the defect. A numeral that is exactly the same size at 240
  // units and at 4 units is not an object in the world, it is a HUD element drawn
  // in one — which is what the founder was looking at when he said the answers
  // should sit with the windows. Size now tracks the arch, so it grows on the
  // approach; what has to be true is that it never goes UNDER what a child can
  // read, and that is a floor, not a constant.
  for (const [vw, vh, label] of VIEWPORTS) {
    const frame = fullFrame(vh);
    for (const fov of [FOV_MIN, 74, FOV_MAX]) {
      for (const adv of ADVANCES) {
        for (const n of DIGIT_COUNTS) {
          const u = unit(n, adv);
          // The width ceiling is allowed to bind below the floor — a four-digit
          // answer on a 320px phone cannot be 46px tall and fit — so the floor
          // asserted here is the floor OR the widest the frame allows, whichever
          // is smaller, and the two are named separately so a failure says which.
          const wCeil = (BAND.fill * frame.edge) / (1 + BAND.fill / 2);
          const { kx, ky } = scales(vw, vh, fov, 240);
          const widthBound = (wCeil / (u * Math.abs(kx))) * Math.abs(ky);
          const want = Math.min(frame.minH, widthBound);
          for (const dist of DISTANCES) {
            const s = scales(vw, vh, fov, dist);
            const band = readBand([u, u, u], s.kx, s.ky, geomFor(s.kx, s.ky, 0.1), frame);
            assert.ok(
              band.hNdc >= want - 1e-9,
              `${label} fov${fov} adv${adv} n${n} d${dist}: ${((band.hNdc / 2) * vh).toFixed(1)}px cap height, floor is ${((want / 2) * vh).toFixed(1)}px`,
            );
          }
        }
      }
    }
  }
});

test("a candidate grows as its own gate grows", () => {
  // The thing the constant-size row could not do. Same viewport, same answer,
  // one gate closing: the numeral has to get bigger, because the window it is
  // standing in is getting bigger.
  const u = unit(1, 0.43);
  const frame = fullFrame(780);
  let prev = -Infinity;
  for (const dist of [240, 160, 100, 60, 30, 12, 4]) {
    const { kx, ky } = scales(360, 780, 74, dist);
    const band = readBand([u, u, u], kx, ky, geomFor(kx, ky, 0.1), frame);
    assert.ok(band.hNdc >= prev - 1e-9, `the numeral shrank on approach at d=${dist}`);
    prev = band.hNdc;
  }
  const f = scales(360, 780, 74, 240);
  const n = scales(360, 780, 74, 4);
  const far = readBand([u, u, u], f.kx, f.ky, geomFor(f.kx, f.ky, 0.1), frame);
  const near = readBand([u, u, u], n.kx, n.ky, geomFor(n.kx, n.ky, 0.1), frame);
  assert.ok(
    near.hNdc > far.hNdc * 1.5,
    `a single digit went from ${far.hNdc.toFixed(3)} to ${near.hNdc.toFixed(3)} NDC — that is not perspective`,
  );
});

test("a mixed-width gate sizes every candidate to the widest", () => {
  const { kx, ky } = scales(1280, 800, 74, 60);
  const wide = unit(3, 0.43);
  const narrow = unit(1, 0.43);
  const geom = geomFor(kx, ky, 0.1);
  const mixed = readBand([narrow, wide, narrow], kx, ky, geom, fullFrame(800));
  const allWide = readBand([wide, wide, wide], kx, ky, geom, fullFrame(800));
  assert.equal(mixed.hNdc, allWide.hNdc);
});

test("the row opens outward as the gate arrives, and never closes back up", () => {
  // It used to open on a clock — `lerp(pitchFar, pitchNear, approach)` — which is
  // why it opened identically whatever the gate was doing. It now opens because the
  // lanes it sits on are getting further apart on screen, so the property to hold
  // is monotonicity in distance, at every viewport and every answer width.
  for (const [vw, vh, label] of VIEWPORTS) {
    const frame = fullFrame(vh);
    for (const n of DIGIT_COUNTS) {
      const u = unit(n, 0.43);
      let prev = -Infinity;
      for (const dist of [240, 160, 100, 60, 30, 20, 12, 6, 4]) {
        const s = scales(vw, vh, 74, dist);
        const band = readBand([u, u, u], s.kx, s.ky, geomFor(s.kx, s.ky, 0.1), frame);
        assert.ok(
          band.pitch >= prev - 1e-9,
          `${label} n${n}: the row closed up at d=${String(dist)}: ${band.pitch.toFixed(3)} was ${prev.toFixed(3)}`,
        );
        prev = band.pitch;
      }
    }
  }
  // And on the surface the founder is holding, with the content the pack opens on,
  // it does actually spread rather than merely not-shrink.
  const u = unit(1, 0.43);
  const frame = fullFrame(780);
  const far = scales(360, 780, 78, 200);
  const near = scales(360, 780, 78, 4);
  const a = readBand([u, u, u], far.kx, far.ky, geomFor(far.kx, far.ky, 0.1), frame);
  const b = readBand([u, u, u], near.kx, near.ky, geomFor(near.kx, near.ky, 0.1), frame);
  assert.ok(b.pitch > a.pitch * 1.3, `the row went from ${a.pitch.toFixed(3)} to ${b.pitch.toFixed(3)} NDC`);
});

test("the row settles into the window once the window can hold it", () => {
  // `onGate` is what the renderer fades the leader dots out with, so it has to
  // reach 1 while the gate is still being read, not on the frame it is crossed.
  const u = unit(1, 0.43);
  const frame = fullFrame(780);
  const s = scales(360, 780, 74, 20);
  const geom = geomFor(s.kx, s.ky, 0.08);
  const band = readBand([u, u, u], s.kx, s.ky, geom, frame);
  assert.equal(band.onGate, 1, `at twenty units out the row is only ${(band.onGate * 100).toFixed(0)}% in its window`);
  const top = band.y + band.hNdc / 2;
  const bottom = band.y - band.hNdc / 2;
  assert.ok(bottom > geom.deck, "the row is below the deck");
  assert.ok(top < geom.archTop + 1e-9, "the row is above the lintel, not in the window");
});

test("the row is centred on its gate, not on the glass", () => {
  // The chase camera follows the player at 0.6x, so the gate cluster slides
  // across the screen as the child steers. A row that ignores that is a row
  // whose outer numeral can end up on the wrong side of its own arch — measured
  // at 44px on the wrong side, four units out, on a 360px phone.
  const u = unit(1, 0.43);
  const frame = fullFrame(780);
  const s = scales(360, 780, 74, 30);
  for (const centre of [-0.3, -0.1, 0, 0.1, 0.3]) {
    const band = readBand([u, u, u], s.kx, s.ky, geomFor(s.kx, s.ky, 0.08, centre), frame);
    assert.ok(
      Math.abs(band.x[1] - centre) < 1e-9,
      `the middle candidate is at ${band.x[1].toFixed(3)} for a gate centred at ${centre.toFixed(3)}`,
    );
  }
  // Past the point where following the gate would push the outer numeral off the
  // glass, the row stops following — but it stops on the correct side and it never
  // snaps back to the middle, which is what pinning it to the screen did.
  const far = readBand([u, u, u], s.kx, s.ky, geomFor(s.kx, s.ky, 0.08, -0.95), frame);
  assert.ok(far.x[1] < -0.3, `the row gave up on a gate at -0.95 and sat at ${far.x[1].toFixed(3)}`);
  assert.ok(far.x[0] - far.wNdc / 2 >= -BAND.edge - 1e-9, "and it went off the left edge doing it");
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
