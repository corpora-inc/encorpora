/** Public-render evidence for the independent Python inequality content oracle.
 * Author selectors and rendered documents are values under test, not answer solvers.
 */
import { once } from "node:events";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { inequalityWorksheet } from "../src/content/inequality-worksheets";
import { inequalityFacetMappings } from "../src/content/inequality-coverage";
import {
  buildCoverageManifest,
  type FacetMapping,
} from "../src/content/coverage";
import { lessons } from "../src/content/lessons";
import { publicationHtml } from "../src/content/publications";
import { generateProblem, templates } from "../src/math/engine";
import { skills as catalogSkills } from "../src/curriculum/catalog";

const ids = [
  "affine-linear-inequality",
  "grouped-linear-inequality",
  "cancelled-linear-inequality",
];
async function emit(value: unknown) {
  if (!process.stdout.write(`${JSON.stringify(value)}\n`))
    await once(process.stdout, "drain");
}
async function main() {
  const registryUrl = new URL(
    "../src/content/facet-mappings.ts",
    import.meta.url,
  );
  const registry: readonly FacetMapping[] = existsSync(
    fileURLToPath(registryUrl),
  )
    ? (await import(registryUrl.href)).actualFacetMappings
    : [];
  const manifest = buildCoverageManifest();
  const emptyOverride = buildCoverageManifest({ facetMappings: [] });
  const isolated = buildCoverageManifest({ templates: [] });
  const replacement: FacetMapping = {
    ...inequalityFacetMappings[0]!,
    rationale:
      "Caller-supplied partial mapping for the same template and facet.",
  };
  const replacementManifest = buildCoverageManifest({
    facetMappings: [replacement],
  });
  const completeManifest = buildCoverageManifest({
    facetMappings: [{ ...replacement, extent: "complete" }],
    evidence: [],
  });
  const duplicateManifest = buildCoverageManifest({
    facetMappings: [replacement, replacement],
  });
  // An invalid supplied value must be validated instead of silently retaining
  // its valid default. This makes replacement precedence observable.
  const invalidReplacement = buildCoverageManifest({
    facetMappings: [{ ...replacement, rationale: "" }],
  });
  const explicitSkills = buildCoverageManifest({ skills: catalogSkills });
  const bindings = (value: ReturnType<typeof buildCoverageManifest>) =>
    value.skills.flatMap((skill) =>
      skill.facets.flatMap((facet) =>
        facet.templateIds
          .filter((id) => ids.includes(id))
          .map((templateId) => ({
            skillId: skill.id,
            facetId: facet.id,
            templateId,
            independentlyReviewed: facet.independentlyReviewed,
          })),
      ),
    );
  await emit({
    kind: "inequality-content-manifest",
    editions: 16,
    templates: templates.filter((template) => ids.includes(template.id)),
    declaredMappings: inequalityFacetMappings,
    registeredMappings: registry.filter(
      (mapping) =>
        ids.includes(mapping.templateId) ||
        mapping.facetId.startsWith("linear-inequalities."),
    ),
    coverageValid: manifest.valid,
    defaultBindings: bindings(manifest),
    emptyOverrideValid: emptyOverride.valid,
    emptyOverrideBindings: bindings(emptyOverride),
    isolatedBindings: bindings(isolated),
    mappingProbes: {
      replacementKey: `${replacement.templateId}:${replacement.facetId}`,
      replacement: {
        valid: replacementManifest.valid,
        errors: replacementManifest.errors,
        bindings: bindings(replacementManifest),
      },
      completeWithoutEvidence: {
        valid: completeManifest.valid,
        errors: completeManifest.errors,
        bindings: bindings(completeManifest),
      },
      duplicate: {
        valid: duplicateManifest.valid,
        errors: duplicateManifest.errors,
        bindings: bindings(duplicateManifest),
      },
      invalidReplacement: {
        valid: invalidReplacement.valid,
        errors: invalidReplacement.errors,
        bindings: bindings(invalidReplacement),
      },
      explicitCatalogSkills: {
        valid: explicitSkills.valid,
        errors: explicitSkills.errors,
        bindings: bindings(explicitSkills),
      },
    },
  });
  for (let index = 1; index <= 16; index++) {
    const edition = String(index);
    for (const templateId of ids) {
      const matching = lessons.filter((lesson) =>
        lesson.templateIds.includes(templateId),
      );
      if (matching.length !== 1)
        throw new Error(`Expected one standalone lesson for ${templateId}`);
      const lesson = matching[0]!;
      const problems = inequalityWorksheet(templateId, lesson.id, edition);
      await emit({
        kind: "inequality-worksheet",
        edition,
        templateId,
        lessonId: lesson.id,
        problems,
        replayed: problems.map((problem) =>
          generateProblem(templateId, problem.public.seed),
        ),
        // The independent Python parser extracts exercise structure from these
        // actual publication documents. Browser layout is reviewed separately.
        workbookHtml: publicationHtml(lesson, "workbook", edition),
        solutionsHtml: publicationHtml(lesson, "solutions", edition),
      });
    }
  }
}
main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : error}\n`);
  process.exitCode = 1;
});
