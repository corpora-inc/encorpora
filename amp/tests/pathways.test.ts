import test from "node:test";
import assert from "node:assert/strict";
import { skills } from "../src/curriculum/catalog";
import {
  crystal,
  layout,
  frontierRange,
  connections,
  illumination,
  relatedSkills,
} from "../src/web/features/pathways/model";

test("crystal growth survives a miss and a retrieval streak reset", () => {
  const before = {
    skillId: "test",
    attempts: 20,
    independentCorrect: 20,
    independentOccasions: 5,
    status: "review-ready" as const,
    reviewDueAt: null,
  };
  const after = {
    ...before,
    attempts: 21,
    independentOccasions: 0,
    status: "practicing" as const,
  };
  assert.equal(crystal(before).stage, 3);
  assert.equal(crystal(after).stage, 3);
  assert.equal(crystal(after).strong, false);
  assert.equal(crystal(undefined).stage, 0);
});
test("catalog layout is deterministic, finite, collision free, independent of input order", () => {
  const positions = layout(skills);
  assert.equal(
    new Set(positions.map((p) => p.position.join(","))).size,
    skills.length,
  );
  const reversed = new Map(
    layout([...skills].reverse()).map((p) => [p.skill.id, p.position]),
  );
  for (const node of positions) {
    assert(node.position.every(Number.isFinite));
    assert.deepEqual(node.position, reversed.get(node.skill.id));
  }
});
test("frontier ranges use independent area estimates and omit unmeasured areas", () => {
  const overall = { level: 7, sd: 0.5, answered: 10, independent: 8 };
  const frontier = {
    expected: 4,
    overall,
    strands: { algebra: { ...overall, level: 9, sd: 1 } },
  };
  assert.deepEqual(frontierRange(frontier, "algebra"), {
    level: 9,
    lo: 7.36,
    hi: 10.64,
  });
  assert.equal(frontierRange(frontier, "geometry"), null);
  assert.equal(
    frontierRange({ ...frontier, overall: { ...overall, answered: 0 } }),
    null,
  );
});

test("highlighted paths cross neighborhoods and do not invent prerequisite credit", () => {
  const target = skills.find((s) => s.id === "nonlinear-systems")!;
  const paths = connections(skills, target.id);
  for (const id of target.prerequisites) assert(paths.prerequisites.has(id));
  assert(!paths.prerequisites.has(target.id));
  assert(!paths.dependents.has(target.id));
});

test("catalog additions preserve the surrounding map rather than reindexing a neighborhood", () => {
  const before = layout(skills);
  const addition = {
    ...skills.find((s) => s.id === "nonlinear-systems")!,
    id: "new-algebra-skill",
    title: "New algebra skill",
  };
  const after = new Map(
    layout([...skills, addition]).map((p) => [p.skill.id, p.position]),
  );
  const moves = before.map((p) =>
    Math.hypot(...p.position.map((v, i) => v - after.get(p.skill.id)![i]!)),
  );
  assert(Math.max(...moves) < 8, "only local collision spacing should adjust");
  assert(
    moves.filter((d) => d > 0.1).length < skills.length / 4,
    "unrelated neighborhoods stay in place",
  );
});

test("illumination accumulates separately from changing strength and does not invent mastery", () => {
  const evidence = {
    skillId: "example",
    attempts: 10,
    independentCorrect: 10,
    independentOccasions: 2,
    status: "review-ready" as const,
    reviewDueAt: null,
  };
  assert.equal(illumination(), 0);
  assert.equal(illumination(evidence), 5);
  const miss = {
    ...evidence,
    attempts: 11,
    independentOccasions: 0,
    status: "practicing" as const,
  };
  assert.equal(illumination(miss), 5);
  assert(!crystal(miss).strong);
  assert.equal(illumination({ ...miss, independentCorrect: 11 }), 5.5);
  assert.equal(illumination({ ...miss, independentCorrect: 100 }), 10);
});

test("related pathways share foundations without becoming prerequisite edges", () => {
  const base = skills[0]!;
  const graph = [
    { ...base, id: "foundation", prerequisites: [] },
    { ...base, id: "selected", prerequisites: ["foundation"] },
    { ...base, id: "peer", prerequisites: ["foundation"] },
    { ...base, id: "dependent", prerequisites: ["selected", "foundation"] },
    { ...base, id: "unrelated", prerequisites: [] },
  ];
  assert.deepEqual(
    relatedSkills(graph, "selected").map((s) => s.id),
    ["peer"],
  );
  assert(!connections(graph, "selected").prerequisites.has("peer"));
  assert(!connections(graph, "selected").dependents.has("peer"));
});

test("early pathways sit closer and lower than advanced pathways", () => {
  const nodes = layout(skills);
  const early = nodes.filter((p) => p.skill.gradeBand === "K");
  const advanced = nodes.filter((p) => p.skill.gradeBand === "precalculus");
  assert(
    early.length && advanced.length,
    "compare actual curriculum endpoints",
  );
  const mean = (group: typeof nodes, axis: number) =>
    group.reduce((sum, p) => sum + p.position[axis]!, 0) / group.length;
  assert(
    mean(early, 2) > mean(advanced, 2),
    "early skills are closer to the starting camera",
  );
  assert(mean(early, 1) < mean(advanced, 1), "advanced skills tend upward");
});

test("whole-map camera fits every skill below controls on phone and desktop", async () => {
  const { overviewCamera, overviewCallouts } =
    await import("../src/web/features/pathways/overview");
  const { PerspectiveCamera, Vector3 } = await import("three");
  const positions = layout(skills).map((p) => p.position);
  for (const [width, height] of [
    [294, 320],
    [364, 320],
    [700, 560],
    [980, 760],
    [650, 250],
  ] as [number, number][]) {
    const fitted = overviewCamera(positions, width, height);
    const camera = new PerspectiveCamera(40, width / height, 0.1, 1200);
    camera.position.set(...fitted.position);
    camera.lookAt(new Vector3(...fitted.target));
    camera.updateMatrixWorld();
    const projected = positions.map((p) => {
      const v = new Vector3(...p).project(camera);
      return { x: ((v.x + 1) * width) / 2, y: ((1 - v.y) * height) / 2 };
    });
    assert(
      projected.every(
        (p) =>
          p.x >= 24 &&
          p.x <= width - 24 &&
          p.y >= Math.min(76, height * 0.25) &&
          p.y <= height - Math.min(38, height * 0.15),
      ),
      `${width}×${height}: no skill clipped by controls or hint`,
    );
    const labels = overviewCallouts(projected.slice(0, 6), width, height);
    assert(
      labels.every(
        (p) =>
          p.x >= 54 && p.x <= width - 54 && p.y >= 70 && p.y <= height - 38,
      ),
      "callouts fit the viewport",
    );
    for (let i = 0; i < labels.length; i++)
      for (let j = i + 1; j < labels.length; j++)
        assert(
          Math.abs(labels[i]!.x - labels[j]!.x) >= 108 ||
            Math.abs(labels[i]!.y - labels[j]!.y) >= 40,
          "area names do not overlap in the fitted view",
        );
  }
});
