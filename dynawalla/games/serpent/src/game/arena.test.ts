/**
 * The shape of the board, checked against something that is not itself.
 *
 * The board is a rounded rectangle fitted to the real limit: the safe rectangle,
 * minus the two 44px squares the host paints over every game, minus the rim's own
 * ink measured in pixels. Nothing else is held back — there is no fill fraction
 * any more.
 *
 * Two families of assertion, and both have to hold or the change is not the change:
 *
 *   · **It reaches the edge.** The fraction of the safe rectangle the playfield
 *     covers is asserted with a floor, because that number is the founder's
 *     question and a regression in it is the answer going backwards.
 *   · **It stops at the edge.** The rim is a wall a child dies against, so no part
 *     of it may sit under a rounded display corner or under the host's own
 *     buttons, in ANY frame the game can draw — the camera's peak zoom and its
 *     bounded shake included, both measured by running the real camera rather than
 *     by believing a hand-derived number.
 *
 * The geometry underneath is checked against a 60,000-point brute-force sweep of
 * the rim. A rounded rect's nearest point is closed form where the ellipse it
 * replaces needed an iteration, and "the code is simpler now" is not evidence.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";

import {
  NO_INSETS,
  chromeRects,
  safeRect,
  type Insets,
} from "../../../../packs/shared/game-chrome/index.ts";
import {
  CORNER_FRACTION,
  SHAKE_HEADROOM,
  ZOOM_PEAK,
  arenaBoard,
  arenaFrame,
  insideRim,
  pullInside,
  rimEdge,
  rimPerimeter,
  rimReach,
  sampleRim,
  topChromeBand,
  type Board,
} from "./arena.ts";
import { addTrauma, createCamera, punch, updateCamera } from "./fx/camera.ts";
import { TAU } from "./num.ts";
import { TUNE } from "./tuning.ts";

const label = (k: Board): string => `a=${k.a.toFixed(3)} b=${k.b.toFixed(3)} r=${k.r.toFixed(3)}`;

/* -------------------------------------------------------------------------- */
/* The geometry, against a sweep.                                             */
/* -------------------------------------------------------------------------- */

const SWEEP = 60000;
const sweepX = new Float32Array(SWEEP);
const sweepY = new Float32Array(SWEEP);
const sweepNX = new Float32Array(SWEEP);
const sweepNY = new Float32Array(SWEEP);

/**
 * The nearest point on the rim, found by looking at 60,000 of them.
 *
 * Dumb on purpose. It can only ever be *worse* than the true minimum, so "the
 * closed form is no further than this" is a bound and not a tolerance.
 */
function sweepNearest(px: number, py: number): number {
  let best = Infinity;
  for (let i = 0; i < SWEEP; i++) {
    const d = Math.hypot((sweepX[i] as number) - px, (sweepY[i] as number) - py);
    if (d < best) best = d;
  }
  return best;
}

/** Every shape the game can be in, from a square to a corridor, at both vent sizes. */
const SHAPES: Board[] = [];
for (const r of [TUNE.arenaStart, 0.8, TUNE.arenaFloor]) {
  for (const k of [1, 1.2, 1.85, 2.4, 4]) {
    SHAPES.push(arenaBoard(r, { x: k, y: 1 }));
    if (k !== 1) SHAPES.push(arenaBoard(r, { x: 1, y: k }));
  }
}

/** Points worth asking about: the middle, the sides, the corners, and well outside. */
function probes(k: Board): Array<[number, number]> {
  const out: Array<[number, number]> = [[0, 0]];
  for (const f of [0.01, 0.4, 0.92, 0.999, 1.04, 1.7]) {
    for (let i = 0; i < 16; i++) {
      const t = (i / 16) * TAU + 0.13;
      out.push([Math.cos(t) * k.a * f, Math.sin(t) * k.b * f]);
    }
  }
  // And straight at the corner arcs, where the two branches meet.
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      out.push([sx * (k.a - k.r), sy * (k.b - k.r)]);
      out.push([sx * (k.a - k.r * 0.3), sy * (k.b - k.r * 0.3)]);
      out.push([sx * k.a, sy * k.b]);
    }
  }
  return out;
}

test("the nearest point on the rim is on the rim, and nothing on the rim is nearer", () => {
  for (const k of SHAPES) {
    sampleRim(k, SWEEP, sweepX, sweepY, sweepNX, sweepNY);
    for (const [px, py] of probes(k)) {
      const e = rimEdge(k, px, py);
      // On the rim: the rounded rect's own distance function is zero there.
      const qx = Math.max(0, Math.abs(e.x) - (k.a - k.r));
      const qy = Math.max(0, Math.abs(e.y) - (k.b - k.r));
      const on = Math.hypot(qx, qy) - k.r;
      assert.ok(
        Math.abs(on) < 1e-9,
        `${label(k)} from (${px.toFixed(3)},${py.toFixed(3)}): the "nearest point on the rim" ` +
          `is ${on} off the rim`,
      );
      const mine = Math.hypot(px - e.x, py - e.y);
      const swept = sweepNearest(px, py);
      assert.ok(
        mine <= swept + 1e-6,
        `${label(k)} from (${px.toFixed(3)},${py.toFixed(3)}): a sweep of the rim found a point ` +
          `${swept.toFixed(9)} away and rimEdge settled for ${mine.toFixed(9)}`,
      );
    }
  }
});

test("the rim's normal is the unit outward normal, and the query sits on it", () => {
  for (const k of SHAPES) {
    for (const [px, py] of probes(k)) {
      const e = rimEdge(k, px, py);
      const len = Math.hypot(e.nx, e.ny);
      assert.ok(Math.abs(len - 1) < 1e-9, `${label(k)}: the normal is ${len} long, not 1`);
      assert.ok(
        !insideRim(k, e.x + e.nx * 1e-6, e.y + e.ny * 1e-6),
        `${label(k)}: the normal points INTO the board`,
      );
      assert.ok(insideRim(k, e.x - e.nx * 1e-6, e.y - e.ny * 1e-6));
      const cross = e.nx * (py - e.y) - e.ny * (px - e.x);
      assert.ok(
        Math.abs(cross) < 1e-9,
        `${label(k)} from (${px.toFixed(3)},${py.toFixed(3)}): the query is ${cross} off the ` +
          `normal line, so the "nearest" point is not a foot of a perpendicular`,
      );
      // A probe exactly ON the rim has a gap of zero and rounds either way, which
      // is not a fact about the shape.
      if (Math.abs(e.gap) > 1e-9) {
        assert.equal(e.gap > 0, insideRim(k, px, py), `${label(k)}: the gap's sign is inside-out`);
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
  for (const k of SHAPES) {
    for (const [what, m] of MARGINS) {
      for (const [px, py] of probes(k)) {
        const p = pullInside(k, px, py, m);
        const gap = rimEdge(k, p.x, p.y).gap;
        assert.ok(
          gap >= m - 1e-9,
          `${label(k)}, ${what} (${m}): (${px.toFixed(3)},${py.toFixed(3)}) was put at ` +
            `(${p.x.toFixed(3)},${p.y.toFixed(3)}), which is ${gap.toFixed(6)} from the wall`,
        );
      }
    }
  }
});

test("the corner radius is what keeps pullInside exact", () => {
  // Walking `m` back along the normal lands exactly `m` inside only while `m` is
  // under the corner radius — past it the corner has run out and the offset curve
  // is no longer a rounded rect. Worth the SMALLEST board the game can close to
  // and the largest clearance it asks for. Note this does not depend on the aspect
  // at all, which is why there is no cap on how long a board may be.
  const tightest = TUNE.arenaFloor * CORNER_FRACTION;
  const worst = Math.max(...MARGINS.map(([, m]) => m));
  assert.ok(
    tightest > worst * 1.3,
    `at the vent's floor the corner radius is ${tightest.toFixed(4)} and the game asks for ` +
      `${worst.toFixed(4)} of clearance — the offset stops being exact`,
  );
});

test("the rim walk lands on the rim, evenly, facing outward", () => {
  // `sampleRim` is a second description of the same curve — the renderer strokes
  // it and the polyps ride it — so it has to agree with `rimEdge`, or the wall a
  // child sees and the wall they hit are different objects.
  const n = 400;
  const x = new Float32Array(n);
  const y = new Float32Array(n);
  const nx = new Float32Array(n);
  const ny = new Float32Array(n);
  for (const k of SHAPES) {
    sampleRim(k, n, x, y, nx, ny);
    const step = rimPerimeter(k) / n;
    for (let i = 0; i < n; i++) {
      const e = rimEdge(k, x[i] as number, y[i] as number);
      assert.ok(
        Math.abs(e.gap) < 1e-6,
        `${label(k)}: rim sample ${i} is ${e.gap.toFixed(9)} off the rim rimEdge describes`,
      );
      assert.ok(
        Math.hypot((nx[i] as number) - e.nx, (ny[i] as number) - e.ny) < 1e-6,
        `${label(k)}: rim sample ${i} faces a different way than rimEdge says the wall does`,
      );
      const j = (i + 1) % n;
      const d = Math.hypot((x[j] as number) - (x[i] as number), (y[j] as number) - (y[i] as number));
      // Chord, not arc, so a corner sample is a hair short — never long, and never
      // by more than the sag of one step.
      assert.ok(
        d <= step + 1e-6 && d > step * 0.99,
        `${label(k)}: samples ${i}→${j} are ${d.toFixed(6)} apart and the step is ${step.toFixed(6)} — ` +
          `the walk is not even, so the graze glow will crawl at a corner`,
      );
    }
  }
});

/* -------------------------------------------------------------------------- */
/* The board reaches the edge of the screen, and stops there.                 */
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

type Fitted = {
  where: string;
  vw: number;
  vh: number;
  insets: Insets;
  safe: { x: number; y: number; w: number; h: number };
  band: number;
  frame: ReturnType<typeof arenaFrame>;
};

function fits(): Fitted[] {
  const out: Fitted[] = [];
  for (const [name, vw, vh] of VIEWPORTS) {
    for (const [tag, insets] of insetsFor(vw, vh)) {
      const safe = safeRect(vw, vh, insets);
      const band = topChromeBand(vw, safe.y, safe.h, insets);
      out.push({
        where: `${name} (${vw}x${vh}), ${tag}`,
        vw,
        vh,
        insets,
        safe,
        band,
        frame: arenaFrame(safe.w, safe.h, band),
      });
    }
  }
  return out;
}

/**
 * What the camera can actually do to the picture, measured by running it.
 *
 * Hand-derived numbers are how a margin goes stale. The shake is reported RAW
 * here, before `scene.ts` clamps it, so the assertion below is about the clamp
 * doing work and not about the shake happening to be small.
 */
function cameraExtremes(): { zoom: number; rawShake: number } {
  const cam = createCamera(false);
  punch(cam, Math.max(TUNE.punchEat, TUNE.punchWrong, TUNE.punchDepth, TUNE.punchDeath));
  addTrauma(cam, 1);
  let zoom = 1;
  let rawShake = 0;
  for (let i = 0; i < 1200; i++) {
    updateCamera(cam, 1 / 240);
    zoom = Math.max(zoom, cam.zoom);
    rawShake = Math.max(rawShake, Math.abs(cam.shakeX), Math.abs(cam.shakeY));
  }
  return { zoom, rawShake };
}

test("the reserved zoom and shake are the ones the camera really produces", () => {
  const cam = cameraExtremes();
  assert.ok(
    cam.zoom <= ZOOM_PEAK,
    `the camera punches to ${cam.zoom.toFixed(5)} and the layout reserves ${ZOOM_PEAK}`,
  );
  assert.ok(cam.zoom > 1.001, `the punch measured ${cam.zoom} — the spring is not being driven`);
  // The clamp has to be doing something, or reserving for it is theatre.
  assert.ok(
    cam.rawShake > SHAKE_HEADROOM,
    `the raw shake peaks at ${cam.rawShake.toFixed(4)} and the clamp is ${SHAKE_HEADROOM} — ` +
      `the clamp never bites, so it is not the reason the rim stays inside`,
  );
  // …and every shake a child is still steering through must be under it, or the
  // clamp is trimming play and not just the death slam.
  for (const [what, trauma] of [
    ["a wall hit", TUNE.traumaWall],
    ["a wrong answer", TUNE.traumaWrong],
    ["a self-bump", TUNE.traumaBump],
    ["a depth", TUNE.traumaDepth],
    ["a bite", TUNE.traumaEat],
  ] as const) {
    assert.ok(
      trauma * trauma * TUNE.shakeMax <= SHAKE_HEADROOM,
      `${what} shakes to ${(trauma * trauma * TUNE.shakeMax).toFixed(4)}, past the ${SHAKE_HEADROOM} clamp`,
    );
  }
});

/** The rim line and its outward ink, in pixels from the board's centre. */
function rimInk(semiAxisPx: number, S: number): number {
  const stroke = semiAxisPx + Math.max(2.5, S * (0.014 + 0.016)) / 2;
  const polyps = semiAxisPx + S * (0.012 + 0.016 * 1.4 * 0.5);
  return Math.max(stroke, polyps);
}

test("no part of the rim ever leaves the safe box", () => {
  const cam = cameraExtremes();
  for (const f of fits()) {
    for (const arenaR of [TUNE.arenaStart, 0.8, TUNE.arenaFloor]) {
      const S = f.frame.scale * cam.zoom;
      const jitter = SHAKE_HEADROOM * f.frame.scale;
      const cx = f.safe.x + f.frame.cx;
      const cy = f.safe.y + f.frame.cy;
      // The scene is drawn at S = scale x zoom, so the board's own half-extent is
      // scaled too — measuring the ink off the UNZOOMED extent is how this passes
      // while the punch quietly carries the rim off the screen.
      const rx = rimInk(arenaR * f.frame.aspect.x * S, S) + jitter;
      const ry = rimInk(arenaR * f.frame.aspect.y * S, S) + jitter;
      const where = `${f.where}, vent ${arenaR}`;
      assert.ok(cx - rx >= f.safe.x - 1e-9, `${where}: the rim crosses the left inset by ${(f.safe.x - (cx - rx)).toFixed(2)}px`);
      assert.ok(cx + rx <= f.safe.x + f.safe.w + 1e-9, `${where}: the rim crosses the right inset by ${(cx + rx - f.safe.x - f.safe.w).toFixed(2)}px`);
      assert.ok(cy - ry >= f.safe.y - 1e-9, `${where}: the rim crosses the top inset by ${(f.safe.y - (cy - ry)).toFixed(2)}px`);
      assert.ok(cy + ry <= f.safe.y + f.safe.h + 1e-9, `${where}: the rim crosses the bottom inset by ${(cy + ry - f.safe.y - f.safe.h).toFixed(2)}px`);
    }
  }
});

test("no part of the rim ever passes under the host's own buttons", () => {
  // The host paints `<` and `?` OVER the game. Water under them is water; a WALL
  // under them is a thing that kills a child from behind a button. Sampled off the
  // real rim walk rather than off the bounding box, because it is the corner arcs
  // that come nearest.
  const cam = cameraExtremes();
  const n = 900;
  const x = new Float32Array(n);
  const y = new Float32Array(n);
  const nx = new Float32Array(n);
  const ny = new Float32Array(n);
  for (const f of fits()) {
    const squares = chromeRects(f.vw, f.insets);
    assert.ok(squares.length >= 2, "the host stopped painting chrome — this test is now vacuous");
    for (const arenaR of [TUNE.arenaStart, 0.8, TUNE.arenaFloor]) {
      const board = arenaBoard(arenaR, f.frame.aspect);
      sampleRim(board, n, x, y, nx, ny);
      const S = f.frame.scale * cam.zoom;
      const ink = S * (0.012 + 0.016 * 1.4 * 0.5);
      const jitter = SHAKE_HEADROOM * f.frame.scale;
      const cx = f.safe.x + f.frame.cx;
      const cy = f.safe.y + f.frame.cy;
      for (let i = 0; i < n; i++) {
        // Push each sample as far out as the frame can carry it, in every direction.
        const ox = (x[i] as number) * S + (nx[i] as number) * ink;
        const oy = (y[i] as number) * S + (ny[i] as number) * ink;
        for (const dx of [-jitter, jitter]) {
          for (const dy of [-jitter, jitter]) {
            const px = cx + ox + dx;
            const py = cy + oy + dy;
            for (const c of squares) {
              // Touching the square's edge is clear: the board is fitted right up
              // to the limit, and "up to" is where the limit is.
              assert.ok(
                px <= c.x + 1e-9 ||
                  px >= c.x + c.w - 1e-9 ||
                  py <= c.y + 1e-9 ||
                  py >= c.y + c.h - 1e-9,
                `${f.where}, vent ${arenaR}: the rim runs under a host control at ` +
                  `(${px.toFixed(1)},${py.toFixed(1)}) — the square is ${c.x},${c.y} ${c.w}x${c.h}`,
              );
            }
          }
        }
      }
    }
  }
});

test("the board really is the screen — the number that answers the question", () => {
  // The founder asked three times why the board is not the whole screen. This is
  // the answer as a number, with a floor under it so it cannot quietly go
  // backwards. For reference, the shape this replaces — an ellipse at 0.9 of each
  // axis — covered `0.81 × π/4 = 63.6%`, the same on every screen.
  const rows: string[] = [];
  for (const f of fits()) {
    const board = arenaBoard(TUNE.arenaStart, f.frame.aspect);
    const s = f.frame.scale;
    const covered = (4 * board.a * board.b - (4 - Math.PI) * board.r * board.r) * s * s;
    const share = covered / (f.safe.w * f.safe.h);
    rows.push(`  ${f.where.padEnd(46)} ${(share * 100).toFixed(1)}%`);
    // Measured range at the ten frames below: 77.0% to 84.4%. What is NOT board is
    // the host's own two buttons (7.5 points on a tall phone, 11.7 on the shortest
    // safe box the fleet tests) and the rim's ink, and nothing else.
    assert.ok(
      share > 0.76,
      `${f.where}: the board covers only ${(share * 100).toFixed(1)}% of the safe rectangle`,
    );
    // And it is genuinely flush on the axis the host's band does not eat: the
    // board's half-width plus the rim's ink IS the safe box's half-width.
    const widest = board.a * s * ZOOM_PEAK + f.frame.reach;
    assert.ok(
      Math.abs(widest - f.safe.w / 2) < 1e-4,
      `${f.where}: the board's widest frame is ${(f.safe.w / 2 - widest).toFixed(4)}px short of the safe box`,
    );
  }
  console.log(`\n  playfield share of the safe rectangle (was 63.6% everywhere):\n${rows.join("\n")}\n`);
});

test("the fitted frame is a fixed point, not an approximation of one", () => {
  for (const f of fits()) {
    assert.ok(
      Math.abs(rimReach(f.frame.scale) - f.frame.reach) < 1e-6,
      `${f.where}: the frame reserved ${f.frame.reach} and its own scale needs ${rimReach(f.frame.scale)}`,
    );
    assert.equal(Math.min(f.frame.aspect.x, f.frame.aspect.y), 1, `${f.where}: neither axis is the short one`);
    // The band really is the host's, not a number somebody picked.
    const deepest = Math.max(...chromeRects(f.vw, f.insets).map((c) => c.y + c.h));
    assert.ok(
      Math.abs(f.band - (deepest - f.safe.y)) < 1e-9,
      `${f.where}: the reserved band is ${f.band} and the host's chrome ends at ${deepest - f.safe.y}`,
    );
  }
});

test("the shape reaches the renderer and the run, and by no other route", () => {
  // Source-level for the same reason `prompt.test.ts` is: `createRenderer` needs a
  // canvas and there is none in Node. Four half-done states this guards, and all
  // four compile clean and look almost right — the world never told its shape, the
  // renderer fitting its own frame, the host's band unreserved, or the shake left
  // unclamped so the board slides off a screen it is now flush against.
  const here = dirname(new URL(import.meta.url).pathname);
  const mount = readFileSync(join(here, "mount.ts"), "utf8");
  assert.ok(
    /setArenaAspect\(\s*world,\s*renderer\.view\.aspect\s*\)/.test(mount),
    "mount.ts no longer hands the fitted shape to the world — the board is a square again",
  );

  const scene = readFileSync(join(here, "render", "scene.ts"), "utf8");
  assert.ok(
    scene.includes("arenaFrame(safe.w, safe.h, band)"),
    "scene.ts fits the board itself again — that is `arenaFrame` now, and a second copy of it " +
      "is how the renderer and the shape part company",
  );
  // The whole expression, not just the call: a band that is measured and then
  // scaled, offset or ignored on its way into the frame reserves the wrong number
  // and reads as if it reserves the right one.
  assert.ok(
    scene.includes("const band = topChromeBand(w, safe.y, safe.h, insets);"),
    "scene.ts no longer reserves the host's chrome band as it is measured — the rim runs " +
      "under the buttons",
  );
  assert.ok(
    scene.includes("clamp(cam.shakeX, -SHAKE_HEADROOM, SHAKE_HEADROOM)") &&
      scene.includes("clamp(cam.shakeY, -SHAKE_HEADROOM, SHAKE_HEADROOM)"),
    "scene.ts applies the camera shake unclamped — the board is flush to the safe box now, so " +
      "an unclamped shake carries a lethal rim off it",
  );
  assert.ok(
    scene.includes("sampleRim(board, segs, rimX, rimY, rimNX, rimNY)"),
    "scene.ts no longer strokes the rim off the shared walk, so the drawn wall and the wall a " +
      "child hits are two different curves",
  );
  assert.ok(scene.includes("g.clip()"), "the board's clip is gone — see the header of prompt.ts");
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
    const band = topChromeBand(w, 0, h, NO_INSETS);
    const f = arenaFrame(w, h, band);
    assert.ok(Number.isFinite(f.scale) && f.scale > 0, `${w}x${h}: the scale is ${f.scale}`);
    assert.ok(Number.isFinite(f.aspect.x) && Number.isFinite(f.aspect.y), `${w}x${h}: the aspect is NaN`);
    assert.equal(Math.min(f.aspect.x, f.aspect.y), 1, `${w}x${h}: neither axis is the short one`);
    const board = arenaBoard(TUNE.arenaFloor, f.aspect);
    const e = rimEdge(board, 0, 0);
    assert.ok(Number.isFinite(e.gap) && Number.isFinite(e.nx), `${w}x${h}: the rim went NaN at the centre`);
    const p = pullInside(board, 99, 99, TUNE.orbRadius * 2.2);
    assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y), `${w}x${h}: pullInside went NaN`);
  }
});
