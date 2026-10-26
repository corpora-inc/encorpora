import assert from "node:assert/strict";
import test from "node:test";
import { skills } from "../src/curriculum/catalog";
import { templates } from "../src/math/engine";
import {
  texasGrade5Inventory,
  texasGrade5ExpectedIds,
} from "../src/curriculum/texas-grade5";
import { floridaBands, floridaInventories } from "../src/curriculum/florida";
import {
  reconcileSources,
  type SourceInventory,
} from "../src/curriculum/source-reconciliation";
import { buildGapLedger, renderGapLedger } from "../src/curriculum/gap-ledger";
const audit = (inventory: SourceInventory) =>
  reconcileSources([inventory], skills, templates, ["US.TX"]);

test("Texas identifier inventory preserves unreviewed components and reuses existing practice", () => {
  const report = buildGapLedger();
  assert.equal(report.valid, true, report.errors.join("\n"));
  const slice = report.sourceReconciliation.slices[0]!;
  assert.deepEqual(
    slice.requirements.map((r) => r.id),
    texasGrade5ExpectedIds,
  );
  assert.equal(slice.requirements.length, 46);
  assert.equal(slice.identifierInventoryComplete, true);
  assert.equal(slice.componentReconciliationComplete, false);
  assert.equal(slice.statewideComplete, false);
  assert.equal(slice.frequencyEstimate, false);
  assert.equal(slice.summary.partiallyReconciled, 8);
  assert.equal(slice.summary.unreviewed, 38);
  assert.equal(slice.summary.missingFamilies, 0);
  assert.equal(
    slice.requirements.find((r) => r.id === "TX.5.10.C")!.reconciliation,
    "unreviewed",
  );
  assert.match(
    slice.requirements.find((r) => r.id === "TX.5.3.J")!.scope,
    /both|Both/,
  );
  assert.match(
    slice.requirements.find((r) => r.id === "TX.5.4.G")!.scope,
    /V = Bh/,
  );
  assert.equal(
    report.targets.find((t) => t.id === "US.TX")!.sourceInventory,
    "partial",
  );
  assert.equal(report.summary.pendingTargetInventories, 53);
  assert.equal(report.summary.partialTargetInventories, 2);
  assert.equal(report.summary.incompleteTargetInventories, 55);
  assert.equal(report.targetComplete, false);
  assert.match(renderGapLedger(report), /stem-and-leaf-interpretation/);
  assert.match(renderGapLedger(report), /TX.5.10.D/);
});

test("Florida B.E.S.T. inventory counts benchmarks honestly and never claims coverage", () => {
  const report = buildGapLedger();
  assert.equal(report.valid, true, report.errors.join("\n"));
  const slices = report.sourceReconciliation.slices.filter(
    (s) => s.targetId === "US.FL",
  );
  assert.equal(slices.length, 5);
  // Independent counts from the July 2025 PDF: K-2 75, 3-5 109, 6-8 114,
  // Algebra 1 / Geometry / Algebra 2 / Precalculus 181, MTR 7.
  const expected = [
    [75, 64, 11, 0, 0],
    [109, 97, 12, 0, 0],
    [114, 94, 20, 0, 0],
    [181, 158, 23, 0, 0],
    [7, 0, 0, 0, 7],
  ];
  slices.forEach((slice, i) => {
    const [n, partial, missing, unreviewed, cross] = expected[i]!;
    assert.equal(slice.requirements.length, n);
    assert.equal(slice.summary.partiallyReconciled, partial);
    assert.equal(slice.summary.missing, missing);
    assert.equal(slice.summary.unreviewed, unreviewed);
    assert.equal(slice.summary.crossCutting, cross);
    assert.equal(slice.identifierInventoryComplete, true);
    assert.equal(slice.statewideComplete, false);
    assert.equal(slice.componentReconciliationComplete, false);
    assert.ok(slice.requirements.every((r) => !r.coverageComplete));
  });
  const all = slices.flatMap((s) => s.requirements);
  assert.equal(all.length, 486);
  assert.equal(new Set(all.map((r) => r.id)).size, 486);
  assert.equal(all.filter((r) => r.reconciliation === "partial").length, 413);
  assert.equal(all.filter((r) => r.reconciliation === "missing").length, 66);
  // Every missing benchmark is a concrete, template-free demand with an owner skill.
  const missing = slices.flatMap((s) =>
    s.tasks.filter((t) => t.disposition === "missing-family"),
  );
  assert.equal(missing.length, 66);
  assert.ok(
    missing.every((t) => !t.templateIds.length && t.skillIds.length === 1),
  );
  assert.ok(
    all
      .filter((r) => r.id.startsWith("MA.K12.MTR"))
      .every((r) => r.reconciliation === "cross-cutting" && !r.taskIds.length),
  );
  // Clarification-limited demands keep their stated limits in scope text.
  const byId = new Map(all.map((r) => [r.id, r]));
  assert.match(byId.get("MA.5.NSO.1.1")!.scope, /./);
  assert.match(byId.get("MA.912.AR.1.3")!.scope, /3 or fewer terms|three/i);
  assert.ok(floridaBands.every((b) => b.rows.every((r) => r[2].length <= 400)));
  assert.match(renderGapLedger(report), /MA\.912\.AR\.6\.6/);
  assert.equal(floridaInventories.length, 5);
  assert.equal(
    reconcileSources(floridaInventories, skills, templates, ["US.FL"]).valid,
    true,
  );
  // A fabricated template link or hash invalidates a whole slice.
  for (const mutate of [
    (i: SourceInventory) => {
      i.tasks.find((t) => t.disposition === "related-practice")!.templateIds = [
        "unknown",
      ];
    },
    (i: SourceInventory) => {
      i.sources[0]!.sha256 = "bad";
    },
    (i: SourceInventory) => {
      i.requirements = i.requirements.slice(1);
    },
  ]) {
    const inventory = structuredClone(floridaInventories[1]!);
    mutate(inventory);
    const result = reconcileSources([inventory], skills, templates, ["US.FL"]);
    assert.equal(result.valid, false);
    assert.equal(result.slices[0]!.tasks.length, 0);
  }
});

test("invalid source, catalog or inventory links cannot establish reconciliation", () => {
  const mutate = (f: (i: SourceInventory) => void) => {
    const inventory = structuredClone(texasGrade5Inventory);
    f(inventory);
    const result = audit(inventory);
    assert.equal(result.valid, false);
    assert.ok(result.errors.length);
    assert.equal(result.slices[0]!.tasks.length, 0);
    assert.ok(
      result.slices[0]!.requirements.every(
        (r) => r.reconciliation === "unreviewed",
      ),
    );
  };
  mutate((i) => {
    i.requirements = i.requirements.slice(1);
  });
  mutate((i) => {
    i.requirements = [...i.requirements, i.requirements[0]!];
  });
  mutate((i) => {
    i.sources[0]!.sha256 = "bad";
  });
  mutate((i) => {
    i.requirements[0]!.sourceId = "unknown";
  });
  mutate((i) => {
    i.targetId = "US.unknown";
  });
  mutate((i) => {
    i.tasks[0]!.requirementIds = ["TX.5.unknown"];
  });
  mutate((i) => {
    i.tasks[0]!.skillIds = ["unknown"];
  });
  mutate((i) => {
    i.tasks[0]!.templateIds = ["unknown"];
  });
  mutate((i) => {
    i.tasks[0]!.skillIds = ["slope"];
  });
  mutate((i) => {
    i.tasks[0]!.templateIds = [];
  });
  mutate((i) => {
    i.tasks[5]!.evidence = [
      { sourceId: "unknown", locator: "14", observation: "test" },
    ];
  });
});

test("fixture catalogs neither inherit state mappings nor silently validate stale references", () => {
  const input = { skills: [skills[0]!], templates: [] };
  assert.deepEqual(buildGapLedger(input).sourceReconciliation.slices, []);
  const explicit = buildGapLedger({
    ...input,
    sourceInventories: [texasGrade5Inventory],
  });
  assert.equal(explicit.valid, false);
  assert.equal(
    explicit.targets.find((t) => t.id === "US.TX")!.sourceInventory,
    "pending",
  );
  assert.deepEqual(audit(texasGrade5Inventory), audit(texasGrade5Inventory));
});

test("duplicate slices cannot establish target reconciliation", () => {
  const result = reconcileSources(
    [texasGrade5Inventory, texasGrade5Inventory],
    skills,
    templates,
    ["US.TX"],
  );
  assert.equal(result.valid, false);
  assert.ok(
    result.slices.every((slice) => !slice.valid && !slice.tasks.length),
  );
});
