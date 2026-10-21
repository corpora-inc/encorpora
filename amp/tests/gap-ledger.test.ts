import assert from "node:assert/strict";
import test from "node:test";
import { skills, standards } from "../src/curriculum/catalog";
import { coverageTargets } from "../src/curriculum/coverage-targets";
import {
  buildGapLedger,
  initialGapTasks,
  renderGapLedger,
} from "../src/curriculum/gap-ledger";
import type { ArtifactEvidence, CoverageInput } from "../src/content/coverage";

test("target membership includes every jurisdiction and separately blocks unreviewed inventories", () => {
  assert.equal(coverageTargets.filter((t) => t.kind === "state").length, 51);
  assert.equal(new Set(coverageTargets.map((t) => t.id)).size, 55);
  for (const id of ["US.DC", "US.AK", "US.HI", "SAT", "PSAT-8/9"])
    assert.ok(coverageTargets.some((t) => t.id === id));
  const report = buildGapLedger();
  assert.equal(report.valid, true);
  assert.equal(report.targetComplete, false);
  assert.equal(report.summary.pendingTargetInventories, 55);
  assert.equal(
    report.summary.skillsWithPractice + report.summary.skillsWithoutPractice,
    skills.length,
  );
  assert.ok(report.skills.some((s) => s.instruction.bookPageBindings.length));
  assert.ok(report.skills.some((s) => s.practice === "missing"));
  assert.ok(report.templatesWithoutFacetMapping.length);
  for (const task of initialGapTasks) {
    assert.ok(
      skills.some((s) => s.id === task.skillId),
      task.id,
    );
    for (const id of task.sourceIds)
      assert.ok(
        standards.some((s) => s.id === id),
        id,
      );
  }
  assert.match(renderGapLedger(report), /percentage-point/);
  assert.match(renderGapLedger(report), /source inventory pending/);
});

const skill = skills[0]!;
const facetId = skill.facets[0]!.id;
const digest = "a".repeat(64);
const fixture: CoverageInput = {
  skills: [skill],
  standards,
  templates: [{ id: "fixture", version: 1, skillId: skill.id }],
  lessons: [{ id: "lesson", templateIds: ["fixture"] }],
};
const stage = (stage: ArtifactEvidence["stage"]): ArtifactEvidence => ({
  id: stage,
  stage,
  artifactId: "template.fixture",
  sha256: digest,
  authorId: "author",
  actorId: stage === "independently-reviewed" ? "reviewer" : "author",
  reference: "review:fixture",
  checks: ["independent enumeration"],
  facetIds: [facetId],
});
test("presence, scope and independently reviewed facets have distinct states", () => {
  const status = (input: CoverageInput) =>
    buildGapLedger(input).skills[0]!.facets[0]!.status;
  assert.equal(status(fixture), "missing");
  assert.equal(buildGapLedger(fixture).skills[0]!.practice, "present");
  const partial: CoverageInput = {
    ...fixture,
    facetMappings: [
      {
        templateId: "fixture",
        facetId,
        extent: "partial",
        rationale: "Only one case.",
      },
    ],
  };
  assert.equal(status(partial), "partial");
  const complete: CoverageInput = {
    ...partial,
    facetMappings: [
      {
        templateId: "fixture",
        facetId,
        extent: "complete",
        rationale: "All declared bounded cases.",
      },
    ],
  };
  assert.equal(status(complete), "implemented");
  const reviewed: CoverageInput = {
    ...complete,
    artifactDigests: { "template.fixture": digest },
    evidence: [
      stage("generated"),
      stage("tested"),
      stage("independently-reviewed"),
    ],
  };
  assert.equal(status(reviewed), "verified");
  assert.equal(buildGapLedger(reviewed).targetComplete, false);
  assert.equal(
    status({
      ...reviewed,
      artifactDigests: { "template.fixture": "b".repeat(64) },
    }),
    "implemented",
  );
  assert.equal(
    status({
      ...reviewed,
      evidence: reviewed.evidence!.map((e) => ({ ...e, actorId: "author" })),
    }),
    "implemented",
  );
});

test("reports are deterministic and explicit fixture inventories do not inherit production mappings", () => {
  assert.deepEqual(buildGapLedger(fixture), buildGapLedger(fixture));
  assert.deepEqual(buildGapLedger(fixture).templatesWithoutFacetMapping, [
    "fixture",
  ]);
  assert.equal(buildGapLedger(fixture).summary.skills, 1);
  assert.ok(!renderGapLedger(buildGapLedger(fixture)).includes("| verified |"));
});

test("invalid mappings cannot promote facets or suppress template reconciliation", () => {
  const report = buildGapLedger({
    ...fixture,
    facetMappings: [
      {
        templateId: "nonexistent",
        facetId,
        extent: "complete",
        rationale: "Invalid claim",
      },
    ],
  });
  assert.equal(report.valid, false);
  assert.equal(report.skills[0]!.facets[0]!.status, "missing");
  assert.deepEqual(report.templatesWithoutFacetMapping, ["fixture"]);
});
