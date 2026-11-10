import test from "node:test";
import assert from "node:assert/strict";
import {
  FOV,
  SKILL_INSETS,
  centralInsets,
  comfortableDepth,
  fit,
  frameSkill,
  glideDuration,
  isFramed,
  readableDepth,
  type Basis,
  type Vec3,
} from "../src/web/features/pathways/camera";

// The plain top view: the camera looks down -z with y up.
const basis: Basis = { right: [1, 0, 0], up: [0, 1, 0], back: [0, 0, 1] };
const view = { width: 760, height: 520 };
const tangent = Math.tan(((FOV / 2) * Math.PI) / 180);

/** Where a point lands on screen for a camera at `target + distance * back`. */
function project(point: Vec3, target: Vec3, distance: number) {
  const depth = target[2] + distance - point[2];
  const unit = view.height / (2 * tangent * depth);
  return {
    x: view.width / 2 + (point[0] - target[0]) * unit,
    y: view.height / 2 - (point[1] - target[1]) * unit,
    depth,
  };
}

test("a skill comfortably in view is framed, so selecting it leaves the camera still", () => {
  const near = readableDepth(view.height) * 0.8;
  assert.equal(isFramed({ x: 380, y: 260, depth: near }, view), true);
  // Just inside the safe area, at either edge.
  assert.equal(
    isFramed({ x: SKILL_INSETS.left, y: SKILL_INSETS.top, depth: near }, view),
    true,
  );
});

test("off screen, under the controls, near an edge, behind or too small is not framed", () => {
  const near = readableDepth(view.height) * 0.8;
  const cases = [
    { x: -40, y: 260, depth: near }, // off screen
    { x: 380, y: 30, depth: near }, // under the toolbar
    { x: view.width - 20, y: 260, depth: near }, // its name would be cut off
    { x: 380, y: view.height - 20, depth: near }, // under the gesture hint
    { x: 380, y: 260, depth: -5 }, // behind the camera
    { x: 380, y: 260, depth: readableDepth(view.height) + 1 }, // too small to read
  ];
  for (const node of cases) assert.equal(isFramed(node, view), false);
});

test("a map smaller than its insets keeps its middle as the safe area", () => {
  const tiny = { width: 120, height: 100 };
  const depth = readableDepth(tiny.height) * 0.5;
  assert.equal(isFramed({ x: 60, y: 48, depth }, tiny), true);
  assert.equal(isFramed({ x: 10, y: 48, depth }, tiny), false);
});

test("a readable zoom is kept: the camera only pans to an off-screen skill, never zooms out", () => {
  const node: Vec3 = [120, -40, 0];
  const distance = 60;
  const plan = frameSkill({
    node,
    neighbors: [
      [130, -30, 0],
      [400, 300, 0], // far away: dropped rather than zooming out for it
    ],
    basis,
    view,
    distance,
  });
  assert.equal(plan.distance, distance);
  const at = project(node, plan.target, plan.distance);
  const inner = centralInsets(view);
  assert(at.x >= inner.left - 0.5 && at.x <= view.width - inner.right + 0.5);
  assert(at.y >= inner.top - 0.5 && at.y <= view.height - inner.bottom + 0.5);
  assert.equal(isFramed(at, view), true);
  // The near neighbour is kept in view.
  const neighbour = project([130, -30, 0], plan.target, plan.distance);
  assert(neighbour.x > 0 && neighbour.x < view.width);
  assert(neighbour.y > 0 && neighbour.y < view.height);
});

test("a skill too small to read is zoomed in on, with its neighbours in view", () => {
  const node: Vec3 = [10, 5, 0];
  const neighbors: Vec3[] = [
    [-2, 0, 0],
    [24, 14, 0],
  ];
  const plan = frameSkill({ node, neighbors, basis, view, distance: 300 });
  assert(plan.distance <= readableDepth(view.height));
  assert(plan.distance >= comfortableDepth(view.height));
  assert.equal(plan.complete, true);
  for (const p of [node, ...neighbors]) {
    const at = project(p, plan.target, plan.distance);
    assert(at.x >= 0 && at.x <= view.width && at.y >= 0 && at.y <= view.height);
  }
  assert.equal(isFramed(project(node, plan.target, plan.distance), view), true);
});

test("a region fits whole at the closest distance that shows all of it", () => {
  const points: Vec3[] = [
    [-30, -10, 0],
    [30, 10, 0],
    [0, 20, 0],
  ];
  const plan = fit({ points, basis, view, near: 20, far: 200 });
  assert.equal(plan.complete, true);
  const tighter = fit({ points, basis, view, near: 20, far: plan.distance * 0.9 });
  assert.equal(tighter.complete, false);
});

test("glides take 400 to 700 ms, longer for longer moves", () => {
  assert.equal(glideDuration(0, 1), 400);
  assert.equal(glideDuration(10, 1), 700);
  assert(glideDuration(0.5, 1) > 400 && glideDuration(0.5, 1) < 700);
  assert(glideDuration(0, 4) > glideDuration(0, 1.2));
});
