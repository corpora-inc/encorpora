import {
  skills as catalogSkills,
  standards as catalogStandards,
} from "../curriculum/catalog.js";
import { buildProductionQueue } from "../curriculum/audit.js";
import type { Skill, Standard } from "../curriculum/types.js";
import { templates as catalogTemplates } from "../math/engine.js";
import { lessons as catalogLessons } from "./lessons.js";

export interface CoverageTemplate {
  id: string;
  skillId: string;
  version: number;
}
export interface CoverageLesson {
  id: string;
  templateIds: string[];
}
export interface PublicationRecord {
  lessonId: string;
  kind: "lesson" | "workbook" | "solutions";
  format: string;
  filename: string;
  sha256: string;
  bytes: number;
}
export type EvidenceStage =
  "generated" | "tested" | "independently-reviewed" | "published";
export interface ArtifactEvidence {
  id: string;
  artifactId: string;
  sha256: string;
  stage: EvidenceStage;
  authorId: string;
  actorId: string;
  /** Review/run/release record accessible to the production team. */
  reference: string;
  /** Test names or acceptance checks; empty lists cannot establish tested or reviewed status. */
  checks: string[];
  facetIds?: string[];
}
export interface FacetMapping {
  templateId: string;
  facetId: string;
  extent: "partial" | "complete";
  rationale: string;
}
export interface CoverageInput {
  skills?: readonly Skill[];
  standards?: readonly Standard[];
  templates?: readonly CoverageTemplate[];
  lessons?: readonly CoverageLesson[];
  publications?: readonly PublicationRecord[];
  evidence?: readonly ArtifactEvidence[];
  /** Independently computed digests of actual source/build artifacts, not evidence-supplied values. */
  artifactDigests?: Readonly<Record<string, string>>;
  facetMappings?: readonly FacetMapping[];
}
const digestPattern = /^[a-f0-9]{64}$/;
const stages: EvidenceStage[] = [
  "generated",
  "tested",
  "independently-reviewed",
  "published",
];
export const publicationArtifactId = (publication: PublicationRecord) =>
  `publication.${publication.filename}`;

/** Evidence describes recorded production work; catalog presence alone proves no review or publication. */
export function buildCoverageManifest(input: CoverageInput = {}) {
  const skills = input.skills ?? catalogSkills;
  const standards = input.standards ?? catalogStandards;
  const templates = input.templates ?? catalogTemplates;
  const lessons = input.lessons ?? catalogLessons;
  const publications = input.publications ?? [];
  const evidence = input.evidence ?? [];
  const mappings = input.facetMappings ?? [];
  const errors: string[] = [];
  function unique<T extends { id: string }>(rows: readonly T[], kind: string) {
    const map = new Map<string, T>();
    for (const row of rows) {
      if (map.has(row.id)) errors.push(`Duplicate ${kind}: ${row.id}`);
      map.set(row.id, row);
    }
    return map;
  }
  const skillById = unique(skills, "skill");
  const standardById = unique(standards, "standard");
  const templateById = unique(templates, "template");
  const lessonById = unique(lessons, "lesson");
  const facetOwner = new Map<string, string>();
  for (const skill of skills) {
    for (const facet of skill.facets) {
      if (facetOwner.has(facet.id)) errors.push(`Duplicate facet: ${facet.id}`);
      facetOwner.set(facet.id, skill.id);
    }
    for (const alignment of skill.alignments)
      if (!standardById.has(alignment.standardId))
        errors.push(`Unknown standard ${alignment.standardId} in ${skill.id}`);
  }
  const orphanTemplateIds = templates
    .filter((t) => !skillById.has(t.skillId))
    .map((t) => t.id)
    .sort();
  const orphanLessonIds = lessons
    .filter(
      (l) =>
        l.templateIds.length === 0 ||
        l.templateIds.some((id) => !templateById.has(id)),
    )
    .map((l) => l.id)
    .sort();
  for (const id of orphanTemplateIds) errors.push(`Orphan template: ${id}`);
  for (const id of orphanLessonIds) errors.push(`Orphan lesson: ${id}`);
  const artifacts = [
    ...templates.map((t) => ({
      id: `template.${t.id}`,
      kind: "template" as const,
      sourceId: t.id,
    })),
    ...lessons.map((l) => ({
      id: `lesson.${l.id}`,
      kind: "lesson" as const,
      sourceId: l.id,
    })),
    ...publications.map((p) => ({
      id: publicationArtifactId(p),
      kind: "publication" as const,
      sourceId: p.filename,
    })),
  ].sort((a, b) => a.id.localeCompare(b.id));
  const artifactById = unique(artifacts, "artifact");
  for (const publication of publications) {
    if (!lessonById.has(publication.lessonId))
      errors.push(`Orphan publication: ${publication.filename}`);
    if (
      !digestPattern.test(publication.sha256) ||
      !Number.isSafeInteger(publication.bytes) ||
      publication.bytes <= 0
    )
      errors.push(`Invalid publication: ${publication.filename}`);
    if (
      input.artifactDigests?.[publicationArtifactId(publication)] !==
      publication.sha256
    )
      errors.push(`Unverified publication bytes: ${publication.filename}`);
  }
  const validMappings: FacetMapping[] = [];
  const mappingKeys = new Set<string>();
  for (const mapping of mappings) {
    const key = `${mapping.templateId}:${mapping.facetId}`;
    if (mappingKeys.has(key)) {
      errors.push(`Duplicate facet mapping: ${key}`);
      continue;
    }
    mappingKeys.add(key);
    const template = templateById.get(mapping.templateId);
    if (
      !template ||
      facetOwner.get(mapping.facetId) !== template.skillId ||
      !mapping.rationale.trim() ||
      !["partial", "complete"].includes(mapping.extent)
    ) {
      errors.push(`Invalid facet mapping: ${key}`);
      continue;
    }
    validMappings.push(mapping);
  }
  const evidenceByArtifact = new Map<string, ArtifactEvidence[]>();
  const evidenceIds = new Set<string>();
  for (const record of evidence) {
    if (evidenceIds.has(record.id)) {
      errors.push(`Duplicate evidence: ${record.id}`);
      continue;
    }
    evidenceIds.add(record.id);
    if (
      !record.id ||
      !artifactById.has(record.artifactId) ||
      !digestPattern.test(record.sha256) ||
      input.artifactDigests?.[record.artifactId] !== record.sha256
    ) {
      errors.push(`Unknown or stale evidence: ${record.id}`);
      continue;
    }
    if (
      !stages.includes(record.stage) ||
      !record.authorId.trim() ||
      !record.actorId.trim() ||
      !record.reference.trim() ||
      (["tested", "independently-reviewed"].includes(record.stage) &&
        (record.checks.length === 0 || record.checks.some((c) => !c.trim()))) ||
      (record.stage === "independently-reviewed" &&
        record.authorId === record.actorId)
    ) {
      errors.push(`Invalid evidence attribution or checks: ${record.id}`);
      continue;
    }
    if (record.facetIds?.some((id) => !facetOwner.has(id))) {
      errors.push(`Unknown evidence facet: ${record.id}`);
      continue;
    }
    const list = evidenceByArtifact.get(record.artifactId) ?? [];
    list.push(record);
    evidenceByArtifact.set(record.artifactId, list);
  }
  const artifactStates = artifacts.map((artifact) => {
    const records = evidenceByArtifact.get(artifact.id) ?? [];
    const authors = new Set(records.map((r) => r.authorId));
    if (authors.size > 1)
      errors.push(`Conflicting artifact authors: ${artifact.id}`);
    const consistent = authors.size <= 1;
    const generated =
      consistent && records.some((r) => r.stage === "generated");
    const tested = generated && records.some((r) => r.stage === "tested");
    const independentlyReviewed =
      tested && records.some((r) => r.stage === "independently-reviewed");
    const published =
      independentlyReviewed && records.some((r) => r.stage === "published");
    for (const record of records) {
      if (
        (record.stage === "tested" && !generated) ||
        (record.stage === "independently-reviewed" && !tested) ||
        (record.stage === "published" && !independentlyReviewed)
      )
        errors.push(`Missing prior evidence stage: ${record.id}`);
    }
    return {
      ...artifact,
      present: true,
      sha256: input.artifactDigests?.[artifact.id] ?? null,
      generated,
      tested,
      independentlyReviewed,
      published,
      evidenceIds: records.map((r) => r.id).sort(),
    };
  });
  const stateById = new Map(artifactStates.map((a) => [a.id, a]));
  const skillCoverage = skills
    .map((skill) => {
      const linkedTemplates = templates
        .filter((t) => t.skillId === skill.id)
        .map((t) => t.id)
        .sort();
      const linkedLessons = lessons
        .filter((l) => l.templateIds.some((id) => linkedTemplates.includes(id)))
        .map((l) => l.id)
        .sort();
      const linkedPublications = publications
        .filter((p) => linkedLessons.includes(p.lessonId))
        .map(publicationArtifactId)
        .sort();
      const facets = skill.facets
        .map((facet) => {
          const links = validMappings.filter((m) => m.facetId === facet.id);
          const reviewed = links.some(
            (mapping) =>
              mapping.extent === "complete" &&
              stateById.get(`template.${mapping.templateId}`)
                ?.independentlyReviewed &&
              evidenceByArtifact
                .get(`template.${mapping.templateId}`)
                ?.some(
                  (r) =>
                    r.stage === "independently-reviewed" &&
                    r.facetIds?.includes(facet.id),
                ),
          );
          return {
            id: facet.id,
            planned: true,
            templateIds: links.map((m) => m.templateId).sort(),
            independentlyReviewed: reviewed,
          };
        })
        .sort((a, b) => a.id.localeCompare(b.id));
      return {
        id: skill.id,
        standardIds: skill.alignments.map((a) => a.standardId).sort(),
        facets,
        templateIds: linkedTemplates,
        lessonIds: linkedLessons,
        publicationIds: linkedPublications,
        allDeclaredFacetsReviewed:
          facets.length > 0 && facets.every((f) => f.independentlyReviewed),
        /** Full instructional skill coverage needs a separately approved assessment blueprint. */
        fullyCovered: false as const,
      };
    })
    .sort((a, b) => a.id.localeCompare(b.id));
  const standardCoverage = standards
    .map((standard) => ({
      id: standard.id,
      scope: standard.scope,
      skillIds: skillCoverage
        .filter((s) => s.standardIds.includes(standard.id))
        .map((s) => s.id),
      fullyCovered: false as const,
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
  return {
    schemaVersion: 1,
    relationshipBasis: "identifier-links-not-source-revision-attestation",
    valid: errors.length === 0,
    errors: [...new Set(errors)].sort(),
    summary: {
      standards: standards.length,
      skills: skills.length,
      facets: facetOwner.size,
      templatesPresent: templates.length,
      lessonsPresent: lessons.length,
      publicationRecords: publications.length,
      generatedArtifacts: artifactStates.filter((a) => a.generated).length,
      testedArtifacts: artifactStates.filter((a) => a.tested).length,
      independentlyReviewedArtifacts: artifactStates.filter(
        (a) => a.independentlyReviewed,
      ).length,
      publishedArtifacts: artifactStates.filter((a) => a.published).length,
      fullyCoveredSkills: 0,
      fullyCoveredStandards: 0,
    },
    orphanTemplateIds,
    orphanLessonIds,
    standards: standardCoverage,
    skills: skillCoverage,
    artifacts: artifactStates,
  };
}

/** Queue only: this function does not invoke agents, mutate files, or purchase inference. */
export function buildAgentProductionQueue(
  skills: readonly Skill[] = catalogSkills,
) {
  return buildProductionQueue(skills).map((task) => {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(task.skillId))
      throw new Error(`Unsafe ownership ID: ${task.skillId}`);
    const review = task.artifact === "instructional-review";
    const directory = `amp/content/skills/${task.skillId}`;
    const files = {
      template: [`${directory}/templates.json`],
      explanation: [`${directory}/explanations.json`],
      lesson: [`${directory}/lesson.md`],
      workbook: [`${directory}/workbook.json`],
      "answer-key": [`${directory}/answers.json`],
      "render-validation": [`${directory}/render-evidence.json`],
      "instructional-review": [`${directory}/review.json`],
    };
    return {
      ...task,
      role: review ? ("independent-reviewer" as const) : ("author" as const),
      authorMustDifferFromReviewer: true,
      assignedActorId: null,
      ownedFiles: files[task.artifact],
      forbiddenFiles: [
        "amp/src/curriculum/**",
        "amp/src/math/**",
        "amp/src/content/coverage.ts",
        "package.json",
      ],
      checks: review
        ? [
            "Check source-standard requirements and all claimed facets.",
            "Verify mathematical and instructional correctness independently.",
            "Review accessibility, equivalent answers, ambiguity and transfer.",
            "Record reviewer identity and content digests.",
          ]
        : [
            "Validate artifact against its schema.",
            "Check exact mathematics and boundary values.",
            "Check source links and stable skill/facet identifiers.",
            "Record source digest and reproducible verification evidence.",
          ],
      execution: {
        enabled: false,
        maxConcurrentOwnersPerFile: 1,
        requiresSeparateReviewer: true,
      },
    };
  });
}
