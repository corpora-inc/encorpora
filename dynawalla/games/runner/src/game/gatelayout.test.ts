import { test } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";

import { Projector } from "./project.ts";
import { readBand, type GateGeom } from "./readband.ts";
import { ndcFrame } from "./chrome.ts";
import { INK, TRACK } from "./glyphs.ts";
import { LANE_W } from "./world.ts";

/**
 * Do the answers sit with the windows?
 *
 * The founder's note, on an Android phone at 0.3.3:
 *
 *   > "the answers would be better if they sat with the windows like they used
 *   > to I think."
 *
 * His screenshot has the prompt on the HUD, the three candidates as enormous
 * free-standing numerals in the sky, and the neon gate arches behind and below
 * them. He was right, and it was not a matter of taste: measured on his viewport,
 * against the shipped `readBand`, at 78° of field of view —
 *
 *     d=80  outer numeral x=305px   its arch x=198px   dx=107px   cap 98px  arch  27px tall
 *     d=60  outer numeral x=305px   its arch x=203px   dx=102px   cap 98px  arch  34px tall
 *     d=30  outer numeral x=305px   its arch x=219px   dx= 86px   cap 98px  arch  59px tall
 *     d=10  outer numeral x=305px   its arch x=256px   dx= 49px   cap 98px  arch 114px tall
 *     d= 4  outer numeral x=305px   its arch x=286px   dx= 19px   cap 98px  arch 158px tall
 *
 * — and, with the child in the left lane so the chase camera has slid the gate
 * cluster right, `d=4` becomes `numeral x=305, arch x=350, dx=-44px`: the outer
 * answer on the *wrong side* of the arch it belongs to.
 *
 * Three numbers, none of them a function of the gate: a fixed screen x, a fixed
 * cap height, and a fixed 27px of air above the lintel. That is a HUD element
 * drawn in the world.
 *
 * This file is separate from `readband.test.ts` because it needs the *real*
 * projection — the chase camera is pitched, positioned off-centre by the player's
 * lane and springs its field of view around, and a hand-rolled pinhole model
 * would be asserting against a camera the game does not have. It builds the real
 * `THREE.PerspectiveCamera`, poses it exactly as `render()` does, runs the real
 * `Projector`, and measures in CSS pixels.
 */

/* Verbatim from `mount.ts`'s render(), which is the only place the camera is posed. */
const CAM = { x: 0.6, y: 4.45, z: 11.4, lift: 0.42, target: { x: 0.3, y: 2.35, z: -26 } };
/** Arch height, from `drawGates`: `H = 4.9 * intro`, at intro 1. */
const ARCH_H = 4.9;

type Shot = {
  /** CSS pixels from the left edge, per candidate. */
  numeralX: [number, number, number];
  /** CSS pixels from the left edge, per lane's arch centre. */
  archX: [number, number, number];
  numeralTop: number;
  numeralBottom: number;
  archTop: number;
  deck: number;
  capPx: number;
  onGate: number;
};

/**
 * Lay one gate out, and report it in pixels.
 *
 * @param playerX the child's world x — the camera follows it at 0.6x, which is
 *                what slid the gate cluster out from under the old row
 */
function shoot(
  w: number,
  h: number,
  fovDeg: number,
  dist: number,
  digitsPerValue: number,
  playerX = 0,
): Shot {
  const camera = new THREE.PerspectiveCamera(fovDeg, w / h, 0.35, 300);
  camera.fov = fovDeg;
  camera.position.set(playerX * CAM.x, CAM.y, CAM.z);
  camera.lookAt(new THREE.Vector3(playerX * CAM.target.x, CAM.target.y, CAM.target.z));
  camera.updateProjectionMatrix();

  const proj = new Projector();
  proj.update(camera, 0, 0);

  const z = -dist;
  // `digits.measure(text, 1)`, without the atlas: an Archivo Black digit advances
  // about 0.444 of the cell it is drawn in. `INK` and `TRACK` are the renderer's
  // own, imported rather than copied.
  const u = digitsPerValue * 0.444 * (1 / INK) * TRACK;

  proj.at(z, ARCH_H);
  const geom: GateGeom = {
    centre: proj.x0,
    lanePitch: Math.abs(proj.kx) * LANE_W,
    archTop: proj.ndcY(ARCH_H),
    archH: Math.abs(proj.ky) * ARCH_H,
    deck: proj.ndcY(0),
  };
  let band = readBand([u, u, u], proj.kx, proj.ky, geom, ndcFrame(w, h, ZERO));
  proj.at(z, proj.worldY(band.y));
  geom.centre = proj.x0;
  geom.lanePitch = Math.abs(proj.kx) * LANE_W;
  geom.archTop = proj.ndcY(ARCH_H);
  geom.archH = Math.abs(proj.ky) * ARCH_H;
  geom.deck = proj.ndcY(0);
  band = readBand([u, u, u], proj.kx, proj.ky, geom, ndcFrame(w, h, ZERO));

  const toX = (ndc: number): number => ((ndc + 1) / 2) * w;
  const toY = (ndc: number): number => ((1 - ndc) / 2) * h;
  const lane = (i: number): number => toX(proj.x0 + proj.kx * (i - 1) * LANE_W);

  return {
    numeralX: [toX(band.x[0]), toX(band.x[1]), toX(band.x[2])],
    archX: [lane(0), lane(1), lane(2)],
    numeralTop: toY(band.y + band.hNdc / 2),
    numeralBottom: toY(band.y - band.hNdc / 2),
    archTop: toY(geom.archTop),
    deck: toY(geom.deck),
    capPx: (band.hNdc / 2) * h,
    onGate: band.onGate,
  };
}

const ZERO = { top: 0, right: 0, bottom: 0, left: 0 };

/** The founder's phone, and the field of view portrait actually settles at. */
const W = 360;
const H = 780;
const FOV = 78;

/**
 * Where in the approach a candidate can physically be *inside* its own window,
 * per answer width, measured on this viewport.
 *
 * There is a hard geometric limit here and pretending otherwise would be the
 * dishonest version of this fix. A window is `LANE_W - 0.42` world units wide,
 * which on this viewport is 34 CSS px at thirty units out and 91 px at four; a
 * two-digit numeral at the legibility floor is 83 px wide and a three-digit one is
 * 88 px. So a wide answer physically cannot stand inside a distant window, and the
 * only way to make it appear to is to shrink it to the eleven pixels this game
 * shipped once and was rewritten to stop shipping.
 *
 * What holds at every width is that the row converges on its gate monotonically
 * and never runs away from it. Measured, on the founder's phone at 78°, the
 * distance from the outer candidate to the centre of its own arch:
 *
 *     digits   d=100   d=60   d=40   d=20   d=10   d=6   d=4
 *     1         52px   44px   35px   16px    3px   0px   0px
 *     2        104px   96px   88px   68px   44px  27px  15px
 *     3        111px  103px   94px   74px   50px  33px  21px
 *
 * Before, at every width and every distance: 107px, 102px, 94px, 73px, 49px, 30px,
 * 19px — identical for one digit and for four, because the row never moved. What
 * closed the gap in those columns was the arch sweeping underneath a stationary
 * numeral, not the numeral going anywhere.
 *
 * The distances below are where a candidate's *centre* is inside its own window,
 * per width, on this viewport. On a tablet the same figures for a two-digit answer
 * are 93px at forty units falling to 10px at four, so the lock arrives earlier
 * wherever the glass is wider.
 */
const INSIDE_FROM: Record<number, number> = { 1: 20, 2: 6, 3: 6 };

/** Where the child is actually deciding: the gate is visible and not yet on them. */
const APPROACH = [100, 80, 60, 40, 30, 20, 12];

test("a candidate closes on its own arch for the whole time it is being read", () => {
  // The number the fix is for. Before: 107px at d=80 falling to 19px at d=4 —
  // and not because the row moved, but because the arch swept underneath it.
  for (const digits of [1, 2, 3, 4]) {
    let prev = Infinity;
    for (const dist of APPROACH) {
      const s = shoot(W, H, FOV, dist, digits);
      const dx = Math.abs(s.numeralX[2] - s.archX[2]);
      assert.ok(
        dx <= prev + 1e-6,
        `n=${String(digits)}: the outer answer moved AWAY from its arch at d=${String(dist)}: ` +
          `${dx.toFixed(0)}px, was ${prev.toFixed(0)}px`,
      );
      prev = dx;
    }
  }
});

test("the row's pitch converges on the lane pitch and never runs away from it", () => {
  // The scale-free version of the same statement, and the one that holds at every
  // answer width: the ratio of the row's pitch to the gate's own only ever falls.
  for (const digits of [1, 2, 3, 4]) {
    let prev = Infinity;
    for (const dist of APPROACH) {
      const s = shoot(W, H, FOV, dist, digits);
      const rowPitch = Math.abs(s.numeralX[2] - s.numeralX[1]);
      const lanePitch = Math.abs(s.archX[2] - s.archX[1]);
      const ratio = rowPitch / lanePitch;
      assert.ok(ratio >= 1 - 1e-6, `n=${String(digits)} d=${String(dist)}: the row is TIGHTER than the lanes`);
      assert.ok(
        ratio <= prev + 1e-6,
        `n=${String(digits)}: the row spread relative to its gate at d=${String(dist)}: ` +
          `${ratio.toFixed(2)}x the lane pitch, was ${prev.toFixed(2)}x`,
      );
      prev = ratio;
    }
    assert.ok(prev < 2, `n=${String(digits)}: the row is still ${prev.toFixed(2)}x the lane pitch at twelve units out`);
  }
});

test("an answer narrow enough to fit its window is inside it while the child steers", () => {
  let checked = 0;
  for (const [digitsKey, from] of Object.entries(INSIDE_FROM)) {
    const digits = Number(digitsKey);
    for (const dist of [from, 16, 12, 10, 8, 6, 4]) {
      if (dist > from) continue;
      for (const playerX of [-LANE_W, 0, LANE_W]) {
        const s = shoot(W, H, FOV, dist, digits, playerX);
        const halfWindow = (Math.abs(s.archX[1] - s.archX[0]) * ((LANE_W - 0.42) / LANE_W)) / 2;
        // Only while the gate cluster is still ON the glass. In the last couple of
        // units the outer arch is genuinely off the edge of the screen — at four
        // units out on this viewport its centre projects past x = 333 of 360 with
        // the child in the far lane — and a numeral that followed it there would
        // be a numeral the child cannot see. By then the answer is given: the gate
        // is 0.06s away at terminal velocity.
        if (s.archX[0] - halfWindow < 0 || s.archX[2] + halfWindow > W) continue;
        // ...and only where the row had room to follow the gate at all. A row is
        // one object with one pitch, so a two-digit row 125px between centres on a
        // 360px screen already spans the glass and the page margin pins it: there
        // is nowhere for it to go. That case is covered by the convergence test
        // above and by the assertion below, not silently by a loose tolerance here.
        if (Math.abs(s.numeralX[1] - s.archX[1]) > 0.5) continue;
        for (const i of [0, 1, 2]) {
          const dx = Math.abs(s.numeralX[i] - s.archX[i]);
          assert.ok(
            dx <= halfWindow + 1e-6,
            `n=${String(digits)} d=${String(dist)} playerX=${playerX.toFixed(1)}: candidate ${String(i)} is ` +
              `${dx.toFixed(0)}px from the centre of a window ${(halfWindow * 2).toFixed(0)}px wide`,
          );
        }
        checked++;
      }
    }
  }
  assert.ok(checked >= 6, `only ${String(checked)} cases survived the on-screen filter; this test is measuring nothing`);
});

test("a row too wide to follow its gate is still pinned toward it, never away", () => {
  // The honest statement of the limit. A wide answer on a narrow phone fills the
  // glass, so the page margin stops the row before it reaches the gate. What must
  // hold is that the clamp never moves the row to the WRONG side — which is what
  // pinning it to the centre of the screen did: at four units out, with the child
  // in the left lane, the outer numeral was 44px past its own arch.
  let clamped = 0;
  for (const digits of [2, 3, 4]) {
    for (const dist of [12, 8, 6, 4]) {
      for (const playerX of [-LANE_W, LANE_W]) {
        const s = shoot(W, H, FOV, dist, digits, playerX);
        const off = s.numeralX[1] - s.archX[1];
        if (Math.abs(off) <= 0.5) continue;
        clamped++;
        const centred = shoot(W, H, FOV, dist, digits, 0);
        // The row moved toward the gate from where a screen-pinned row would be,
        // or it had no room at all — never in the opposite direction.
        const towards = (s.archX[1] - centred.numeralX[1]) * (s.numeralX[1] - centred.numeralX[1]);
        assert.ok(
          towards >= -1e-6,
          `n=${String(digits)} d=${String(dist)} playerX=${playerX.toFixed(1)}: the gate is at ` +
            `${s.archX[1].toFixed(0)}px, a screen-pinned row would be at ${centred.numeralX[1].toFixed(0)}px, ` +
            `and this row is at ${s.numeralX[1].toFixed(0)}px — the wrong way`,
        );
      }
    }
  }
  assert.ok(clamped > 0, "no case was clamped, so this test is asserting nothing; re-derive the widths");
});

test("steering moves the answers with the gate instead of leaving them behind", () => {
  // The worst case measured before the fix: at four units out, with the child in
  // the left lane, the outer numeral was 44px to the WRONG side of its own arch,
  // because the row was pinned to the middle of the glass while the chase camera
  // slid the gate. The row now travels with it.
  for (const dist of [40, 30, 20, 12, 10]) {
    const left = shoot(W, H, FOV, dist, 1, -LANE_W);
    const right = shoot(W, H, FOV, dist, 1, LANE_W);
    // A child in the RIGHT lane moves the camera right, so the gate projects
    // further LEFT. Both numbers are negative, and they have to be the same
    // number: the row moves exactly as far as the gate it belongs to.
    const gateShift = right.archX[1] - left.archX[1];
    const rowShift = right.numeralX[1] - left.numeralX[1];
    assert.ok(gateShift < -5, `d=${String(dist)}: the test's own premise is wrong, the gate barely moved`);
    assert.ok(
      Math.abs(rowShift - gateShift) < 1.5,
      `d=${String(dist)}: the gate moved ${gateShift.toFixed(0)}px and the row moved ${rowShift.toFixed(0)}px`,
    );
  }
});

test("a candidate is framed by its arch, not floating above it", () => {
  // Before: the numeral's bottom edge sat a flat 27px above the lintel at every
  // distance, with the arch "behind and below" — the founder's own words.
  // From thirty units. Forty is the crossover, where the window is exactly as tall
  // as the legibility floor and `onGate` reaches 1 to within a rounding error;
  // asserting it there would be asserting a float comparison.
  for (const dist of [30, 20, 12, 10, 6, 4]) {
    const s = shoot(W, H, FOV, dist, 1);
    assert.ok(
      s.numeralBottom > s.archTop,
      `d=${String(dist)}: the numeral ends at y=${s.numeralBottom.toFixed(0)} and the lintel is at ` +
        `y=${s.archTop.toFixed(0)} — it is entirely above the window`,
    );
    assert.ok(
      s.numeralBottom <= s.deck + 1e-6,
      `d=${String(dist)}: the numeral reaches y=${s.numeralBottom.toFixed(0)}, past a deck at y=${s.deck.toFixed(0)}`,
    );
    assert.ok(s.onGate >= 1 - 1e-9, `d=${String(dist)}: the row is only ${(s.onGate * 100).toFixed(0)}% into its window`);
  }
});

test("further out, where no numeral fits the arch, the row still sits ON the gate", () => {
  // The row cannot be *in* a 13px window, so it is held above the lintel with the
  // leader dots the renderer fades with `onGate`. What must not happen is the old
  // behaviour: a fixed 27px of air at every distance, so the gap never closed.
  let prev = Infinity;
  for (const dist of [160, 120, 100, 80, 60]) {
    const s = shoot(W, H, FOV, dist, 1);
    const gap = s.archTop - s.numeralBottom;
    assert.ok(gap <= prev + 1e-6, `the gap above the lintel grew at d=${String(dist)}: ${gap.toFixed(0)}px was ${prev.toFixed(0)}px`);
    assert.ok(s.onGate > 0, `d=${String(dist)}: onGate is 0, so the leaders never fade`);
    prev = gap;
  }
  assert.ok(prev < 20, `the row is still ${prev.toFixed(0)}px clear of the lintel at sixty units`);
});

test("and it grows with its gate instead of being a constant on the glass", () => {
  const far = shoot(W, H, FOV, 100, 1);
  const near = shoot(W, H, FOV, 4, 1);
  let prev = -Infinity;
  for (const dist of [240, 160, 100, 60, 30, 20, 12, 6, 4]) {
    const s = shoot(W, H, FOV, dist, 1);
    assert.ok(s.capPx >= prev - 1e-9, `the numeral shrank on approach at d=${String(dist)}`);
    prev = s.capPx;
  }
  assert.ok(
    near.capPx > far.capPx * 1.6,
    `a single digit is ${far.capPx.toFixed(0)}px at 100 units and ${near.capPx.toFixed(0)}px at 4 — ` +
      "that is not perspective, it is a HUD",
  );
  assert.ok(far.capPx >= 44, `at 100 units a digit is only ${far.capPx.toFixed(0)}px tall`);
});

test("the answers still clear the cutout and the host's chrome on a real camera", () => {
  // The pure sweep in `chrome.test.ts` covers this against synthesised geometry.
  // This one covers it against the projection the game actually uses, including
  // the pitch and the camera's lane follow, which is where a numeral would
  // realistically be pushed off an edge.
  for (const dist of [100, 60, 30, 12, 4]) {
    for (const digits of [1, 2, 3, 4]) {
      for (const playerX of [-LANE_W, 0, LANE_W]) {
        for (const fov of [58, 78, 104]) {
          const s = shoot(W, H, fov, dist, digits, playerX);
          const ctx = `d=${String(dist)} n=${String(digits)} fov${String(fov)} playerX=${playerX.toFixed(1)}`;
          assert.ok(s.numeralX[0] >= 0, `${ctx}: left answer at ${s.numeralX[0].toFixed(0)}px, off screen`);
          assert.ok(s.numeralX[2] <= W, `${ctx}: right answer at ${s.numeralX[2].toFixed(0)}px of ${String(W)}`);
          assert.ok(s.numeralTop >= 0 && s.numeralBottom <= H, `${ctx}: the row left the glass vertically`);
        }
      }
    }
  }
});
