import assert from "node:assert/strict";
import test from "node:test";
import { skills } from "../src/curriculum/catalog";
import { templates } from "../src/math/engine";
import {
  texasGrade5Inventory,
  texasGrade5ExpectedIds,
} from "../src/curriculum/texas-grade5";
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
  assert.equal(slice.summary.missingFamilies, 3);
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
  assert.equal(report.summary.pendingTargetInventories, 54);
  assert.equal(report.summary.partialTargetInventories, 1);
  assert.equal(report.summary.incompleteTargetInventories, 55);
  assert.equal(report.targetComplete, false);
  assert.match(renderGapLedger(report), /stem-and-leaf-interpretation/);
  assert.match(renderGapLedger(report), /TX.5.10.D/);
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
