/**
 * The shape of the vent, checked against something that is not itself.
 *
 * The arena stopped being a circle: it is the ellipse inscribed in the safe
 * rectangle, so the board is the screen. That is a one-line change to a constant
 * and a real change to the *physics*, because on a circle "how far is the wall",
 * "which way does it face" and "where is the nearest legal spot inside it" are
 * `Math.hypot` and on an ellipse they are the root of a quartic. Those three
 * answers decide where a child dies, where they are paid for grazing, and where
 * an orb is allowed to appear, so every one of them is checked here against a
 * **brute-force sweep of the rim** rather than against a rearrangement of the
 * same algebra.
 *
 * The other half is the promise the change was made for and the promise it must
 * not break at the same time: the rim reaches the ends of the screen, and no part
 * of it — through the worst shake and the peak of the camera's punch — leaves the
 * safe box. Both are asserted at the five viewports the rest of the pack is held
 * at, with and without a cutout.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";

import { NO_INSETS, safeRect, type Insets } from "../../../../packs/shared/game-chrome/index.ts";
import {
  ARENA_FILL,
  MAX_ARENA_ASPECT,
  arenaAspect,
  arenaScale,
  closestOnRim,
  insideRim,
  pullInside,
  rimEdge,
} from "./arena.ts";
import { addTrauma, createCamera, punch, updateCamera } from "./fx/camera.ts";
import { TAU } from "./num.ts";
import { TUNE } from "./tuning.ts";

/* -------------------------------------------------------------------------- */
/* The geometry, against a sweep.                                             */
/* -------------------------------------------------------------------------- */

/**
 * The nearest point on the rim, found by looking at 60,000 of them.
 *
 * Dumb on purpose. It can only ever be *worse* than the true minimum, so
 * "`closestOnRim` is no further than this" is a real bound and not a tolerance —
 * an implementation that lands on the wrong side of the ellipse, or stops
 * iterating, is further away and this catches it.
 */
function sweepNearest(a: number, b: number, px: number, py: number): number {
  let best = Infinity;
  const N = 60000;
  for (let i = 0; i < N; i++) {
    const t = (i / N) * TAU;
    const d = Math.hypot(a * Math.cos(t) - px, b * Math.sin(t) - py);
    if (d < best) best = d;
  }
  return best;
}

/** Every shape the game can be in, from a square to the cap, at both vent sizes. */
const SHAPES: Array<[number, number]> = [];
for (const r of [TUNE.arenaStart, 0.8, TUNE.arenaFloor]) {
  for (const k of [1, 1.2, 1.777, 2.165, MAX_ARENA_ASPECT]) {
    SHAPES.push([r, r * k]);
    if (k !== 1) SHAPES.push([r * k, r]);
  }
}

/** Points worth asking about: the middle, the axes, off-axis, and well outside. */
function probes(a: number, b: number): Array<[number, number]> {
  const out: Array<[number, number]> = [[0, 0]];
  for (const f of [0.01, 0.35, 0.9, 0.99, 1, 1.05, 1.6]) {
    for (let i = 0; i < 12; i++) {
      const t = (i / 12) * TAU + 0.11;
      out.push([Math.cos(t) * a * f, Math.sin(t) * b * f]);
    }
  }
  return out;
}

test("the nearest point on the rim is on the rim, and nothing on the rim is nearer", () => {
  for (const [a, b] of SHAPES) {
    for (const [px, py] of probes(a, b)) {
      const c = closestOnRim(a, b, px, py);
      const on = (c.x / a) ** 2 + (c.y / b) ** 2;
      assert.ok(
        Math.abs(on - 1) < 1e-9,
        `a=${a} b=${b} from (${px.toFixed(3)},${py.toFixed(3)}): the "nearest point on the rim" ` +
          `is not on the rim — x²/a²+y²/b² = ${on}`,
      );
      const mine = Math.hypot(px - c.x, py - c.y);
      const swept = sweepNearest(a, b, px, py);
      assert.ok(
        mine <= swept + 1e-9,
        `a=${a} b=${b} from (${px.toFixed(3)},${py.toFixed(3)}): a sweep of the rim found a point ` +
          `${swept.toFixed(9)} away and closestOnRim settled for ${mine.toFixed(9)}`,
      );
    }
  }
});

test("the rim's normal is the unit outward normal, and the query sits on it", () => {
  for (const [a, b] of SHAPES) {
    for (const [px, py] of probes(a, b)) {
      const e = rimEdge(a, b, px, py);
      const len = Math.hypot(e.nx, e.ny);
      assert.ok(Math.abs(len - 1) < 1e-9, `a=${a} b=${b}: the normal is ${len} long, not 1`);
      // Outward: stepping along it leaves the ellipse, stepping back stays in.
      assert.ok(
        !insideRim(a, b, e.x + e.nx * 1e-6, e.y + e.ny * 1e-6),
        `a=${a} b=${b}: the normal points INTO the vent`,
      );
      assert.ok(insideRim(a, b, e.x - e.nx * 1e-6, e.y - e.ny * 1e-6));
      // The foot of a perpendicular: the query lies on the normal line.
      const cross = e.nx * (py - e.y) - e.ny * (px - e.x);
      assert.ok(
        Math.abs(cross) < 1e-7,
        `a=${a} b=${b} from (${px.toFixed(3)},${py.toFixed(3)}): the query is ${cross} off the ` +
          `normal line, so the "nearest" point is not a foot of a perpendicular`,
      );
      // The sign of the gap is the side of the wall you are on. Asked only of
      // points that are on a side: a probe placed exactly ON the rim has a gap of
      // zero and rounds either way, which is not a fact about the shape.
      if (Math.abs(e.gap) > 1e-9) {
        assert.equal(e.gap > 0, insideRim(a, b, px, py), `a=${a} b=${b}: the gap's sign is inside-out`);
      }
      assert.ok(
        Math.abs(Math.abs(e.gap) - Math.hypot(px - e.x, py - e.y)) < 1e-12,
        "the gap is not the distance to the point it names",
      );
    }
  }
});

/** Every clearance the game asks the shape for, largest last. */
const MARGINS: Array<[string, number]> = [
  ["the graze band", TUNE.grazeBand],
  ["a head thrown off the wall", TUNE.headRadius * 1.6],
  ["an orb held off the wall", TUNE.orbRadius * 1.1],
  ["an orb's spawn clearance", TUNE.orbRadius * 2.2],
];

test("pullInside puts a body exactly its margin inside, whatever the shape", () => {
  for (const [a, b] of SHAPES) {
    for (const [what, m] of MARGINS) {
      for (const [px, py] of probes(a, b)) {
        const p = pullInside(a, b, px, py, m);
        const gap = rimEdge(a, b, p.x, p.y).gap;
        assert.ok(
          gap >= m - 1e-9,
          `a=${a} b=${b}, ${what} (${m}): (${px.toFixed(3)},${py.toFixed(3)}) was put at ` +
            `(${p.x.toFixed(3)},${p.y.toFixed(3)}), which is ${gap.toFixed(6)} from the wall`,
        );
      }
    }
  }
});

test("the aspect cap is what keeps pullInside exact", () => {
  // Walking `m` back along the normal lands exactly `m` inside only while `m` is
  // under the smallest radius of curvature the ellipse has. That is the real
  // reason MAX_ARENA_ASPECT exists, and it is worth the smallest vent and the
  // largest margin the game can put together.
  const short = TUNE.arenaFloor;
  const long = TUNE.arenaFloor * MAX_ARENA_ASPECT;
  const tightest = (short * short) / long;
  const worst = Math.max(...MARGINS.map(([, m]) => m));
  assert.ok(
    tightest > worst * 1.3,
    `at the vent floor and the aspect cap the rim's tightest radius of curvature is ` +
      `${tightest.toFixed(4)} and the game asks for ${worst.toFixed(4)} of clearance — ` +
      `the offset stops being exact`,
  );
});

/* -------------------------------------------------------------------------- */
/* The board is the screen — and stays inside it.                             */
/* -------------------------------------------------------------------------- */

const PORTRAIT: Insets = { top: 47, right: 0, bottom: 34, left: 0 };
const LANDSCAPE: Insets = { top: 0, right: 47, bottom: 21, left: 47 };

/** The five the HUD and the prompt are held at. */
const VIEWPORTS: Array<[string, number, number]> = [
  ["phone portrait, small", 320, 568],
  ["phone portrait", 390, 844],
  ["tablet portrait", 768, 1024],
  ["tablet landscape", 1024, 768],
  ["phone landscape", 844, 390],
];

function insetsFor(w: number, h: number): Array<[string, Insets]> {
  return [
    ["no insets", NO_INSETS],
    w > h ? ["cutout at the side", LANDSCAPE] : ["cutout at the top", PORTRAIT],
  ];
}

/**
 * What the camera can actually do to the picture, measured by running it.
 *
 * Hand-derived numbers are how a margin goes stale. `prompt.ts` records that this
 * spring undershoots to 0.990 for exactly the same reason; this takes the other
 * end of it, and the shake, off the shipping code.
 */
function cameraExtremes(): { zoom: number; shake: number } {
  const cam = createCamera(false);
  const biggest = Math.max(TUNE.punchEat, TUNE.punchWrong, TUNE.punchDepth, TUNE.punchDeath);
  punch(cam, biggest);
  addTrauma(cam, 1);
  let zoom = 1;
  let shake = 0;
  for (let i = 0; i < 1200; i++) {
    updateCamera(cam, 1 / 240);
    zoom = Math.max(zoom, cam.zoom);
    shake = Math.max(shake, Math.abs(cam.shakeX), Math.abs(cam.shakeY));
  }
  return { zoom, shake };
}

/**
 * The furthest ink `scene.ts: drawRim` puts from the centre, on one axis.
 *
 * Mirrors the draw calls: the rim stroke straddles the semi-axis by half its
 * width, and the polyps ride at `1.012` of it with half a sprite beyond that.
 * The soft halo is deliberately not here — it is a radial gradient that has faded
 * out before it reaches its own edge, it is not a wall, and the 0.44 circle this
 * replaces let it past the safe box too.
 */
function rimReach(semiAxisPx: number, S: number): number {
  const stroke = semiAxisPx + Math.max(2.5, S * (0.014 + 0.016)) / 2;
  const polyps = semiAxisPx * 1.012 + (S * 0.016 * 1.4) / 2;
  return Math.max(stroke, polyps);
}

test("no part of the rim ever leaves the safe box", () => {
  const cam = cameraExtremes();
  for (const [name, vw, vh] of VIEWPORTS) {
    for (const [label, insets] of insetsFor(vw, vh)) {
      const safe = safeRect(vw, vh, insets);
      const scale = arenaScale(safe.w, safe.h);
      const aspect = arenaAspect(safe.w, safe.h);
      const cx = safe.x + safe.w / 2;
      const cy = safe.y + safe.h / 2;
      for (const arenaR of [TUNE.arenaStart, 0.8, TUNE.arenaFloor]) {
        const S = scale * cam.zoom;
        const jitter = cam.shake * scale;
        const rx = rimReach(arenaR * aspect.x * S, S) + jitter;
        const ry = rimReach(arenaR * aspect.y * S, S) + jitter;
        const where = `${name} (${vw}x${vh}), ${label}, vent ${arenaR}`;
        assert.ok(cx - rx >= safe.x - 1e-9, `${where}: the rim crosses the left inset by ${(safe.x - (cx - rx)).toFixed(2)}px`);
        assert.ok(cx + rx <= safe.x + safe.w + 1e-9, `${where}: the rim crosses the right inset by ${(cx + rx - safe.x - safe.w).toFixed(2)}px`);
        assert.ok(cy - ry >= safe.y - 1e-9, `${where}: the rim crosses the top inset by ${(safe.y - (cy - ry)).toFixed(2)}px`);
        assert.ok(cy + ry <= safe.y + safe.h + 1e-9, `${where}: the rim crosses the bottom inset by ${(cy + ry - safe.y - safe.h).toFixed(2)}px`);
      }
    }
  }
});

test("the board really is the screen, on every shape of screen", () => {
  // The assertion the founder asked for, and the one a revert cannot pass: the
  // vent spans ARENA_FILL of the safe box on BOTH axes, not on the short one with
  // dead black bands on the other. A disc sized off the short side spans that
  // fraction of the short side and a much smaller fraction of the long one.
  for (const [name, vw, vh] of VIEWPORTS) {
    for (const [label, insets] of insetsFor(vw, vh)) {
      const safe = safeRect(vw, vh, insets);
      const scale = arenaScale(safe.w, safe.h);
      const aspect = arenaAspect(safe.w, safe.h);
      const where = `${name} (${vw}x${vh}), ${label}`;
      const spanX = TUNE.arenaStart * aspect.x * scale * 2;
      const spanY = TUNE.arenaStart * aspect.y * scale * 2;
      assert.ok(
        Math.abs(spanX / safe.w - ARENA_FILL) < 1e-9,
        `${where}: the vent is ${((spanX / safe.w) * 100).toFixed(1)}% of the safe width, not ${ARENA_FILL * 100}%`,
      );
      assert.ok(
        Math.abs(spanY / safe.h - ARENA_FILL) < 1e-9,
        `${where}: the vent is ${((spanY / safe.h) * 100).toFixed(1)}% of the safe height, not ${ARENA_FILL * 100}%`,
      );
      // And the fit the condition is measured against is still the disc inside
      // the ellipse, so `arenaR × scale` has to stay the SHORT semi-axis.
      assert.equal(Math.min(aspect.x, aspect.y), 1, `${where}: the short semi-axis is no longer arenaR`);
    }
  }
});

test("the shape reaches the renderer and the run, and by no other route", () => {
  // Source-level for the same reason `prompt.test.ts` is: `createRenderer` needs a
  // canvas and there is none in Node. Two half-done states this guards, and both
  // compile clean and look almost right:
  //
  //   · `mount.ts` never tells the world its shape, so the simulation stays a
  //     circle, the renderer draws that circle, and the whole change ships as a
  //     4% larger disc that nobody asked for;
  //   · the simulation is an ellipse and the renderer still strokes a circle, so
  //     the drawn wall and the wall a child dies against are different curves.
  const here = dirname(new URL(import.meta.url).pathname);
  const mount = readFileSync(join(here, "mount.ts"), "utf8");
  assert.ok(
    /setArenaAspect\(\s*world,\s*renderer\.view\.safe\.w,\s*renderer\.view\.safe\.h\s*\)/.test(mount),
    "mount.ts no longer fits the vent to the measured safe box — the arena is a circle again",
  );

  const scene = readFileSync(join(here, "render", "scene.ts"), "utf8");
  assert.ok(
    scene.includes("arenaScale(safe.w, safe.h)"),
    "scene.ts sizes the arena itself again — that expression is `arenaScale` now, and a second " +
      "copy of it is how the renderer and the shape part company",
  );
  assert.ok(
    scene.includes("w.arenaR * w.aspectX * S") && scene.includes("w.arenaR * w.aspectY * S"),
    "scene.ts draws the arena off one radius again, so it is a circle inside an elliptical vent",
  );
  assert.ok(
    scene.includes("g.ellipse(X(0), Y(0), aX, aY, 0, 0, TAU)"),
    "the arena's clip is not the arena's shape",
  );
  assert.ok(
    scene.includes("g.ellipse(cx, cy, aX, aY, 0, a0, a1)"),
    "the rim a child steers against is still stroked as a circle",
  );
});

test("an absurd surface produces a shape, not a NaN", () => {
  // A pack frame can be resized to anything, and a safe box can go to nothing.
  for (const [w, h] of [
    [0, 0],
    [1, 1],
    [320, 4000],
    [4000, 320],
    [200, 60],
  ] as const) {
    const s = arenaScale(w, h);
    const k = arenaAspect(w, h);
    assert.ok(Number.isFinite(s) && s > 0, `${w}x${h}: the scale is ${s}`);
    assert.ok(Number.isFinite(k.x) && Number.isFinite(k.y), `${w}x${h}: the aspect is NaN`);
    assert.equal(Math.min(k.x, k.y), 1, `${w}x${h}: neither axis is the short one`);
    assert.ok(Math.max(k.x, k.y) <= MAX_ARENA_ASPECT + 1e-12, `${w}x${h}: the aspect cap was passed`);
    const e = rimEdge(TUNE.arenaFloor * k.x, TUNE.arenaFloor * k.y, 0, 0);
    assert.ok(Number.isFinite(e.gap) && Number.isFinite(e.nx), `${w}x${h}: the rim went NaN at the centre`);
  }
});
