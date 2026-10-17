import assert from "node:assert/strict";
import test from "node:test";
import { skills, standards } from "../src/curriculum/catalog.js";
import {
  buildAgentProductionQueue,
  buildCoverageManifest,
  type ArtifactEvidence,
} from "../src/content/coverage.js";
const sha256 = "a".repeat(64);
const skill = skills.find((s) => s.id === "count-to-20")!;
const fixture = {
  skills: [skill],
  standards,
  templates: [{ id: "example", skillId: skill.id, version: 1 }],
  lessons: [{ id: "lesson", templateIds: ["example"] }],
};
const evidence = (stage: ArtifactEvidence["stage"]): ArtifactEvidence => ({
  id: stage,
  artifactId: "template.example",
  sha256,
  stage,
  authorId: "writer",
  actorId: stage === "independently-reviewed" ? "reviewer" : "writer",
  reference: `review-record:${stage}`,
  checks: ["independent answer verification"],
  facetIds: [skill.facets[0]!.id],
});

test("catalog presence never implies tested reviewed published or full coverage", () => {
  const report = buildCoverageManifest();
  assert.deepEqual(report.errors, []);
  assert.equal(report.summary.skills, skills.length);
  assert.ok(report.summary.templatesPresent > 0);
  assert.equal(report.summary.testedArtifacts, 0);
  assert.equal(report.summary.independentlyReviewedArtifacts, 0);
  assert.equal(report.summary.publishedArtifacts, 0);
  assert.ok(
    report.skills.every((s) => !s.fullyCovered && !s.allDeclaredFacetsReviewed),
  );
  assert.ok(report.standards.every((s) => !s.fullyCovered));
});

test("joins standards skills templates lessons and publications without assuming publication", () => {
  const publication = {
    lessonId: "lesson",
    kind: "lesson" as const,
    format: "A4",
    filename: "example.pdf",
    sha256,
    bytes: 100,
  };
  const report = buildCoverageManifest({
    ...fixture,
    publications: [publication],
    artifactDigests: { "publication.example.pdf": sha256 },
  });
  assert.deepEqual(report.errors, []);
  assert.deepEqual(report.skills[0]!.templateIds, ["example"]);
  assert.deepEqual(report.skills[0]!.lessonIds, ["lesson"]);
  assert.deepEqual(report.skills[0]!.publicationIds, [
    "publication.example.pdf",
  ]);
  assert.ok(
    report.standards
      .find((s) => s.id === "K.CC.B.4")!
      .skillIds.includes(skill.id),
  );
  assert.equal(report.summary.publishedArtifacts, 0);
});

test("explicit complete facet mapping and digest-bound separate review establish only declared facet review", () => {
  const report = buildCoverageManifest({
    ...fixture,
    artifactDigests: { "template.example": sha256 },
    facetMappings: [
      {
        templateId: "example",
        facetId: skill.facets[0]!.id,
        extent: "complete",
        rationale: "Reviewed against this bounded facet.",
      },
    ],
    evidence: [
      "generated",
      "tested",
      "independently-reviewed",
      "published",
    ].map((stage) => evidence(stage as ArtifactEvidence["stage"])),
  });
  assert.deepEqual(report.errors, []);
  assert.equal(report.summary.publishedArtifacts, 1);
  assert.equal(report.skills[0]!.allDeclaredFacetsReviewed, true);
  assert.equal(report.skills[0]!.fullyCovered, false);
  assert.equal(report.summary.fullyCoveredStandards, 0);
});

test("self review stale evidence partial mappings and missing stages cannot establish coverage", () => {
  const selfReview = {
    ...evidence("independently-reviewed"),
    actorId: "writer",
  };
  const report = buildCoverageManifest({
    ...fixture,
    artifactDigests: { "template.example": sha256 },
    evidence: [
      evidence("generated"),
      evidence("tested"),
      selfReview,
      { ...evidence("published"), sha256: "b".repeat(64) },
    ],
    facetMappings: [
      {
        templateId: "example",
        facetId: skill.facets[0]!.id,
        extent: "partial",
        rationale: "Only the calculation is checked.",
      },
    ],
  });
  assert.equal(report.valid, false);
  assert.equal(report.summary.independentlyReviewedArtifacts, 0);
  assert.equal(report.summary.publishedArtifacts, 0);
  assert.equal(report.skills[0]!.allDeclaredFacetsReviewed, false);
  const missing = buildCoverageManifest({
    ...fixture,
    artifactDigests: { "template.example": sha256 },
    evidence: [evidence("published")],
  });
  assert.equal(missing.valid, false);
  assert.equal(missing.summary.publishedArtifacts, 0);
});

test("orphan artifacts invalid facet links and conflicting authors fail the audit", () => {
  const report = buildCoverageManifest({
    ...fixture,
    templates: [{ id: "example", skillId: "missing-skill", version: 1 }],
    lessons: [{ id: "lesson", templateIds: ["missing-template"] }],
    facetMappings: [
      {
        templateId: "example",
        facetId: skill.facets[0]!.id,
        extent: "complete",
        rationale: "Bad link",
      },
    ],
    artifactDigests: { "template.example": sha256 },
    evidence: [
      evidence("generated"),
      { ...evidence("tested"), authorId: "someone-else" },
    ],
  });
  assert.equal(report.valid, false);
  assert.deepEqual(report.orphanTemplateIds, ["example"]);
  assert.deepEqual(report.orphanLessonIds, ["lesson"]);
  assert.ok(report.errors.some((e) => e.includes("Invalid facet mapping")));
  assert.ok(
    report.errors.some((e) => e.includes("Conflicting artifact authors")),
  );
  assert.equal(report.summary.testedArtifacts, 0);
});

test("agent queue has bounded nonoverlapping ownership separate review and no execution", () => {
  const queue = buildAgentProductionQueue();
  const owners = new Set<string>();
  for (const task of queue) {
    assert.equal(task.execution.enabled, false);
    assert.equal(task.assignedActorId, null);
    assert.ok(task.authorMustDifferFromReviewer);
    assert.ok(task.checks.length > 0);
    for (const file of task.ownedFiles) {
      assert.ok(!owners.has(file));
      owners.add(file);
    }
    if (task.artifact === "instructional-review")
      assert.equal(task.role, "independent-reviewer");
  }
  assert.deepEqual(buildAgentProductionQueue([...skills].reverse()), queue);
  assert.throws(
    () => buildAgentProductionQueue([{ ...skill, id: "../escape" }]),
    /Unsafe ownership/,
  );
});
