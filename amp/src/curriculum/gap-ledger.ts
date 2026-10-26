import { templates as registeredTemplates } from "../math/engine";
import {
  reconcileSources,
  type SourceInventory,
} from "./source-reconciliation";
import { texasGrade5Inventory } from "./texas-grade5";
import { floridaInventories } from "./florida";
import { buildReleasedItemLedger } from "./released-items";
import type { SourceLedger } from "./released-items/types";
import {
  renderReleasedItemReport,
  summarizeReleasedItems,
} from "./released-items/ledger";
import { skills, standards } from "./catalog";
import { coverageTargets } from "./coverage-targets";
import { buildCoverageManifest, type CoverageInput } from "../content/coverage";

export interface GapTask {
  id: string;
  skillId: string;
  objective: string;
  sourceIds: readonly string[];
  existingSupport: string;
  acceptance: readonly string[];
}
/** Reconciled tasks, not an exhaustive state-standard inventory or completion claims. */
export const initialGapTasks: readonly GapTask[] = [
  {
    id: "proof-reasoning",
    skillId: "geometric-proof",
    sourceIds: ["HSG.CO.C.9", "HSG.CO.C.10"],
    objective:
      "Build from recognizing justified angle steps to completing short geometric proofs.",
    existingSupport:
      "geometry-proof-step recognizes four angle reasons from explicit givens; line/ray/segment naming already exists under lines-symmetry.",
    acceptance: [
      "Assess missing intermediate statements and reasons using definitions and equality properties.",
      "Require explicit givens and check every theorem's conditions.",
      "Distinguish reason recognition from constructing a proof.",
    ],
  },
  {
    id: "rational-equation-extension",
    skillId: "rational-equations",
    sourceIds: ["HSA.REI.A.2"],
    objective:
      "Extend original-domain checking to multiple and quadratic denominators.",
    existingSupport:
      "rational-equation-one-denominator constructs numeric answers; rational-equation-check distinguishes unique solutions, excluded candidates, identities on the original domain and contradictions for linear-over-linear equations.",
    acceptance: [
      "Add shared and distinct denominators without losing original exclusions.",
      "Include equations producing multiple candidate roots and test each in the original equation.",
      "Preserve exact rational arithmetic and independent original-domain checks.",
    ],
  },
  {
    id: "radians-and-unit-circle",
    skillId: "radians-unit-circle",
    sourceIds: ["HSF.TF.A.1", "HSF.TF.A.2"],
    objective:
      "Connect arc length, radian measure, unit-circle coordinates and trigonometric values.",
    existingSupport:
      "Arc/sector measurement, special right triangles and radian-arc-ratio have practice. Degree conversion and signed unit-circle coordinates still require bound families.",
    acceptance: [
      "Start with angle as arc length divided by radius, then degrees/radians conversions.",
      "Connect signed coordinates to sine and cosine, including quadrants and axis angles.",
      "Use diagrams that preserve the angle direction, radius and labeled coordinates.",
    ],
  },
  {
    id: "radical-equation-check",
    skillId: "radical-equations",
    sourceIds: ["HSA.REI.A.2"],
    objective:
      "Extend square-root equation solving to repeated or irrational candidates and multiple radicals.",
    existingSupport:
      "radical-equation-isolated and radical-equation-shifted construct exact rational solutions; radical-equation-check selects all solutions after squaring with two distinct integer candidates, including zero, one or two valid solutions.",
    acceptance: [
      "Add repeated and irrational candidates without losing original domain and sign checks.",
      "Check radicand domains and required signs before and after squaring.",
      "Include no-solution cases and extraneous candidates checked in the original equation.",
    ],
  },
  {
    id: "percent-points",
    skillId: "percent-change",
    sourceIds: ["7.RP.A.3"],
    objective:
      "Distinguish percentage-point differences from relative percent changes.",
    existingSupport:
      "percent-change-rate assesses relative change; lessons explain percentage points.",
    acceptance: [
      "Ask for percentage-point answers directly.",
      "Contrast the two questions for the same givens, including decreases and zero change.",
      "Keep the zero-base restriction on relative change explicit.",
    ],
  },
  {
    id: "successive-percent",
    skillId: "percent-change",
    sourceIds: ["7.RP.A.3"],
    objective: "Apply successive percentage changes with changing bases.",
    existingSupport:
      "successive-percent-change applies two stated changes in all direction orders, including equal opposite rates, discount then tax and final-only half-up cent rounding. Inverse recovery and rounding after each step require additional practice.",
    acceptance: [
      "Include increase/increase, decrease/decrease and both mixed orders.",
      "Assess equal opposite changes and reverse recovery with nonzero multipliers.",
      "State whether money is rounded after each step or only at the end; test halfway cases.",
    ],
  },
  {
    id: "positional-language",
    skillId: "name-shapes",
    sourceIds: ["K.G.A.1"],
    objective: "Describe relative positions of objects with spatial language.",
    existingSupport:
      "Shape recognition already varies orientation and size; positional language is explicitly unassessed.",
    acceptance: [
      "Include above, below, beside, in front of, behind and next to.",
      "Use unambiguous figures and a text-accessible equivalent.",
      "Distinguish recognition from learner-produced descriptions.",
    ],
  },
  {
    id: "story-unknown-matrix",
    skillId: "addition-stories",
    sourceIds: ["1.OA.A.1"],
    objective:
      "Reconcile addition and subtraction story structures with every required unknown position.",
    existingSupport:
      "Missing starts, addends and several story positions already have practice and number-builders instruction.",
    acceptance: [
      "Inventory add-to, take-from, put-together/take-apart and comparison structures against the source table.",
      "Reuse existing families and add only unassessed cells.",
      "Keep selecting an equation distinct from constructing it.",
    ],
  },
  {
    id: "root-composition-domain",
    skillId: "function-composition",
    sourceIds: ["HSF.BF.A.1"],
    objective:
      "Determine domain restrictions for compositions involving square roots.",
    existingSupport:
      "composition-value already assesses excluded inputs for rational outer functions.",
    acceptance: [
      "Check inner domain and the outer radicand restriction together.",
      "Include boundary inclusion, empty and unrestricted domains where applicable.",
      "Verify by independent inequality reasoning and counterexamples.",
    ],
  },
  {
    id: "compare-interval-rates",
    skillId: "average-rate-change",
    sourceIds: ["HSF.IF.B.6"],
    objective: "Compare average rates of change across intervals.",
    existingSupport:
      "Rates from formulas, graphs and tables already exist; exponential-overtakes assesses eventual growth.",
    acceptance: [
      "Compare equal- and unequal-width intervals.",
      "Include positive, negative and zero rates and consistent units.",
      "Cover formulas, tables and graphs without substituting endpoint height for rate.",
    ],
  },
];

export interface GapLedgerInput extends CoverageInput {
  sourceInventories?: readonly SourceInventory[];
  /** Released-item ledgers; custom catalogs default to none. */
  releasedLedgers?: readonly SourceLedger[];
}

export function buildGapLedger(input: GapLedgerInput = {}) {
  const manifest = buildCoverageManifest(input);
  const nodes = input.skills ?? skills;
  const refs = input.standards ?? standards;
  const sourceReconciliation = reconcileSources(
    input.sourceInventories ??
      (input.skills || input.templates || input.standards
        ? []
        : [texasGrade5Inventory, ...floridaInventories]),
    nodes,
    input.templates ?? registeredTemplates,
    coverageTargets.map((target) => target.id),
  );
  const targets = coverageTargets.map((target) => ({
    ...target,
    sourceInventory: sourceReconciliation.slices.some(
      (slice) => slice.valid && slice.targetId === target.id,
    )
      ? ("partial" as const)
      : ("pending" as const),
  }));
  const mappings = manifest.facetMappings;
  const nodeById = new Map(nodes.map((s) => [s.id, s]));
  const rows = manifest.skills.map((row) => {
    const node = nodeById.get(row.id)!;
    return {
      id: row.id,
      gradeBand: node.gradeBand,
      strand: node.strand,
      objective: node.description,
      standardIds: row.standardIds,
      practice: row.templateIds.length
        ? ("present" as const)
        : ("missing" as const),
      templateIds: row.templateIds,
      instruction: {
        lessonIds: row.lessonIds,
        bookPageBindings: row.bookPageBindings,
      },
      facets: row.facets.map((facet) => {
        const links = mappings.filter((m) => m.facetId === facet.id);
        return {
          id: facet.id,
          objective: node.facets.find((f) => f.id === facet.id)!.description,
          status: facet.independentlyReviewed
            ? ("verified" as const)
            : links.some((m) => m.extent === "complete")
              ? ("implemented" as const)
              : links.length
                ? ("partial" as const)
                : ("missing" as const),
          templateIds: facet.templateIds,
          declaredScopes: links.map(({ templateId, extent, rationale }) => ({
            templateId,
            extent,
            rationale,
          })),
        };
      }),
      // A lesson binding is not reviewed instructional evidence; a runtime hint
      // or an editorial grade is not proof of instructional quality/calibration.
      hintReview: "not-recorded" as const,
      lessonReview: "not-recorded" as const,
      empiricalCalibration: "not-recorded" as const,
    };
  });
  const facets = rows.flatMap((row) => row.facets);
  const grades = [...new Set(nodes.map((s) => s.gradeBand))].map(
    (gradeBand) => {
      const group = rows.filter((s) => s.gradeBand === gradeBand);
      return {
        gradeBand,
        skills: group.length,
        withPractice: group.filter((s) => s.practice === "present").length,
      };
    },
  );
  const unmappedTemplates = manifest.artifacts
    .filter(
      (a) =>
        a.kind === "template" &&
        !mappings.some((m) => m.templateId === a.sourceId),
    )
    .map((a) => a.sourceId);
  const customCatalog = !!(input.skills || input.templates || input.standards);
  // Custom catalogs never inherit production items or template links.
  const releasedItems = buildReleasedItemLedger(
    customCatalog
      ? {
          ledgers: input.releasedLedgers ?? [],
          templates: input.templates ?? registeredTemplates,
          templateArchetypes: {},
          skillIds: nodes.map((s) => s.id),
          facetMappings: input.facetMappings ?? [],
        }
      : { ledgers: input.releasedLedgers },
  );
  return {
    schemaVersion: 1,
    valid: manifest.valid && sourceReconciliation.valid && releasedItems.valid,
    errors: [
      ...manifest.errors,
      ...sourceReconciliation.errors,
      ...releasedItems.errors,
    ],
    target: "US-50-states-DC-general-math-assessments-and-SAT-Suite",
    targetComplete: false,
    targets,
    sourceReconciliation,
    blockers: [
      "State and assessment source inventories require versioned component-level reconciliation.",
      "Existing catalog facets are not an exhaustive assessment blueprint.",
      "Review and calibration evidence must be recorded independently of content presence.",
    ],
    summary: {
      ...manifest.summary,
      skillsWithPractice: rows.filter((s) => s.practice === "present").length,
      skillsWithoutPractice: rows.filter((s) => s.practice === "missing")
        .length,
      facetsByStatus: Object.fromEntries(
        ["missing", "partial", "implemented", "verified"].map((status) => [
          status,
          facets.filter((f) => f.status === status).length,
        ]),
      ),
      templatesWithoutFacetMapping: unmappedTemplates.length,
      pendingTargetInventories: targets.filter(
        (t) => t.sourceInventory === "pending",
      ).length,
      partialTargetInventories: targets.filter(
        (t) => t.sourceInventory === "partial",
      ).length,
      incompleteTargetInventories: targets.length,
    },
    grades,
    sources: refs.map(({ id, sourceUrl, sourceReviewedAt, scope }) => ({
      id,
      sourceUrl,
      sourceReviewedAt,
      scope,
    })),
    skills: rows,
    templatesWithoutFacetMapping: unmappedTemplates,
    // Narrow gap tasks are intentionally separate from the broad facet statuses.
    // Never mark them complete merely because a related skill has a template.
    initialTasks: initialGapTasks,
    // Item-level detail: `npm run coverage:items`.
    releasedItems: summarizeReleasedItems(releasedItems),
  };
}

export function renderGapLedger(
  report: ReturnType<typeof buildGapLedger>,
): string {
  const cell = (value: string) =>
    value.replaceAll("|", "\\|").replaceAll("\n", " ");
  return [
    "# AMP mathematics coverage ledger",
    "",
    "Runtime presence and declared facet coverage are reported separately. This is not certification of complete standards coverage.",
    "",
    `Audit valid: ${report.valid}. Skills with practice: ${report.summary.skillsWithPractice}/${report.summary.skills}. Pending target inventories: ${report.summary.pendingTargetInventories}.`,
    "",
    ...report.errors.map((error) => `ERROR: ${error}`),
    "## Source inventory blockers",
    "",
    ...report.blockers.map((b) => `- [ ] ${b}`),
    "",
    "## Targets",
    "",
    ...report.targets.map(
      (t) => `- [ ] ${t.name}: source inventory ${t.sourceInventory}`,
    ),
    "",
    "## Practice by grade",
    "",
    "| Grade/course | Skills with practice | Catalog skills |",
    "| --- | ---: | ---: |",
    ...report.grades.map(
      (g) => `| ${g.gradeBand} | ${g.withPractice} | ${g.skills} |`,
    ),
    "",
    "## State requirement reconciliation",
    "",
    ...report.sourceReconciliation.slices.flatMap((slice) => [
      `### ${slice.targetId} grade ${slice.grade}`,
      "",
      `Identifier inventory complete: ${slice.identifierInventoryComplete}. Partially reconciled: ${slice.summary.partiallyReconciled}/${slice.summary.requirements}; missing ${slice.summary.missing}; cross-cutting ${slice.summary.crossCutting}. Statewide complete: ${slice.statewideComplete}.`,
      "",
      ...slice.sources.map(
        (source) =>
          `- [${source.edition}](${source.url}); retrieved ${source.retrievedAt}; SHA-256 ${source.sha256}`,
      ),
      ...slice.limitations.map((limitation) => `- ${limitation}`),
      "",
      "| Requirement | Source location | Scope | Reconciliation | Task links |",
      "| --- | --- | --- | --- | --- |",
      ...slice.requirements.map(
        (r) =>
          `| ${r.id} | ${cell(r.locator)} | ${cell(r.description + ": " + r.scope)} | ${r.reconciliation} | ${r.taskIds.join(", ") || "—"} |`,
      ),
      "",
      "| Reusable task | Disposition | Related practice | Limits and evidence |",
      "| --- | --- | --- | --- |",
      ...slice.tasks.map(
        (t) =>
          `| ${t.id} | ${t.disposition} | ${t.templateIds.join(", ") || "—"} | ${cell(t.limitations + " " + t.evidence.map((e) => `${e.sourceId}, ${e.locator}: ${e.observation}`).join("; "))} |`,
      ),
      "",
    ]),
    renderReleasedItemReport(report.releasedItems, { gapLimit: 20 }),
    "## Initial gap tasks",
    "",
    ...report.initialTasks.flatMap((t) => [
      `- [ ] **${t.id}**: ${t.objective}`,
      `  Existing support: ${t.existingSupport}`,
      ...t.acceptance.map((a) => `  - ${a}`),
    ]),
    "",
    "## Skills without registered practice",
    "",
    ...report.skills
      .filter((s) => s.practice === "missing")
      .map((s) => `- [ ] ${s.id} (${s.gradeBand}): ${s.objective}`),
    "",
    "## Declared facets",
    "",
    "| Facet | Status | Templates | Declared scope and limitations |",
    "| --- | --- | --- | --- |",
    ...report.skills.flatMap((s) =>
      s.facets.map(
        (f) =>
          `| ${f.id} | ${f.status} | ${f.templateIds.join(", ") || "—"} | ${cell(f.declaredScopes.map((m) => m.rationale).join("; ") || "No template-to-facet mapping; related skill practice is not facet evidence.")} |`,
      ),
    ),
    "",
    "## Templates needing facet reconciliation",
    "",
    ...report.templatesWithoutFacetMapping.map((id) => `- [ ] ${id}`),
    "",
  ].join("\n");
}
