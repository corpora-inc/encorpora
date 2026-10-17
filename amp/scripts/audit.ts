import { validateRatioAlignments } from "../books/in-the-same-proportion/alignments.js";
import { validateRatioPracticeBindings } from "../books/in-the-same-proportion/practice.js";
import { validateMeasurementAlignments } from "../books/measure-border-cover/alignments.js";
import { validateMeasurementPracticeBindings } from "../books/measure-border-cover/practice.js";
import { validateNumberAlignments } from "../books/number-builders/alignments.js";
import { validateNumberPracticeBindings } from "../books/number-builders/practice.js";
import { validateAlgebraCoverage } from "../src/content/algebra-coverage.js";
import { validateBalanceAlignments } from "../books/balance-and-change/alignments.js";
import { validateBalancePracticeBindings } from "../books/balance-and-change/practice.js";
import { validateEqualGroupsCoverage } from "../src/content/equal-groups-coverage.js";
import { books } from "../src/books/catalog.js";
import { validateEqualGroupsAlignments } from "../books/equal-groups-workshop/alignments.js";
import { validateEqualGroupsPracticeBindings } from "../books/equal-groups-workshop/practice.js";
import { buildCoverageManifest } from "../src/content/coverage.js";
import { validateFractionPracticeCoverage } from "../src/content/fraction-practice-coverage.js";
import { auditCurriculum } from "../src/curriculum/audit";
import { skills, standards } from "../src/curriculum/catalog";
import { auditFundingRegistry } from "../src/funding/audit";
import { fundingRegistry } from "../src/funding/registry";
import { templates } from "../src/math/engine";
import { lessons } from "../src/content/lessons";
const curriculum = auditCurriculum(),
  funding = auditFundingRegistry(fundingRegistry);
const coverage = buildCoverageManifest();
const errors = [...curriculum.errors, ...funding.errors, ...coverage.errors];
const bookTemplateIds = new Set<string>();
try {
  validateRatioAlignments(skills, templates, standards);
  validateRatioPracticeBindings(templates);
  validateMeasurementAlignments(skills, templates, standards);
  validateMeasurementPracticeBindings(templates);
  validateAlgebraCoverage();
  validateFractionPracticeCoverage();
  validateNumberAlignments(skills, templates, standards);
  validateNumberPracticeBindings(templates);
  validateBalanceAlignments(skills, templates, standards);
  validateBalancePracticeBindings(templates);
  validateEqualGroupsAlignments(skills, templates, standards);
  validateEqualGroupsPracticeBindings(templates);
  validateEqualGroupsCoverage();
  for (const book of books)
    for (const binding of book.bindings)
      bookTemplateIds.add(binding.templateId);
} catch (error) {
  errors.push(
    `Invalid book teaching bindings: ${error instanceof Error ? error.message : String(error)}`,
  );
}
for (const template of templates) {
  if (!skills.some((s) => s.id === template.skillId))
    errors.push(`Template ${template.id} references unknown skill`);
  if (
    !lessons.some((l) => l.templateIds.includes(template.id)) &&
    !bookTemplateIds.has(template.id)
  )
    errors.push(
      `Template ${template.id} has no lesson or validated book-page binding`,
    );
}
console.log(
  JSON.stringify(
    {
      curriculum,
      funding,
      contentCoverage: {
        valid: coverage.valid,
        summary: coverage.summary,
        missingInstructionTemplateIds: coverage.missingInstructionTemplateIds,
      },
      referenceContent: {
        templates: templates.length,
        lessons: lessons.length,
        bookLinkedTemplates: bookTemplateIds.size,
        fullyVerifiedSkills: skills.filter((s) => s.status === "verified")
          .length,
      },
      errors,
    },
    null,
    2,
  ),
);
if (errors.length) process.exitCode = 1;
