import { test } from "node:test";
import assert from "node:assert/strict";
import { computeLayout, laneAtPoint } from "./layout.ts";

const SIZES: [number, number, string][] = [
  [1440, 900, "desktop"],
  [1180, 820, "ipad landscape"],
  [820, 1180, "ipad portrait"],
  [390, 844, "phone portrait"],
  [844, 390, "phone landscape"],
];

test("the visible field is exactly one bar, in every orientation", () => {
  for (const [w, h, name] of SIZES) {
    for (const lanes of [1, 2, 3]) {
      const l = computeLayout(w, h, lanes);
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
    const l = computeLayout(w, h, 3);
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
  assert.equal(computeLayout(390, 844, 3).orient, "v");
  assert.equal(computeLayout(844, 390, 3).orient, "h");
  assert.equal(computeLayout(1440, 900, 3).orient, "h");
  const v = computeLayout(390, 844, 3);
  assert.ok(v.along.y < 0, "notes must approach from the top");
  const hz = computeLayout(1440, 900, 3);
  assert.ok(hz.along.x > 0, "future is to the right");
});

test("a tap lands in the lane it looks like it landed in", () => {
  for (const [w, h] of SIZES) {
    for (const lanes of [1, 2, 3]) {
      const l = computeLayout(w, h, lanes);
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
    const l = computeLayout(w, h, 3);
    assert.ok(l.lanePitch >= 44, `${name}: lane pitch is only ${l.lanePitch.toFixed(0)} px`);
  }
});
