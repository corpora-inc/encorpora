/** Export values under test; independent Python code checks their mathematics. */
import { once } from "node:events";
import { linearSystemWorksheet } from "../src/content/linear-system-worksheets";
import { linearSystemFacetMappings } from "../src/content/linear-system-coverage";
import { actualFacetMappings } from "../src/content/facet-mappings";
import { buildCoverageManifest } from "../src/content/coverage";
import { lessons } from "../src/content/lessons";
import { publicationHtml } from "../src/content/publications";
import { generateProblem, templates } from "../src/math/engine";
import { skills } from "../src/curriculum/catalog";

const ids = ["linear-system-pair", "linear-system-solution-count"];
async function emit(value: unknown) {
  if (!process.stdout.write(`${JSON.stringify(value)}\n`))
    await once(process.stdout, "drain");
}
async function main() {
  const selectedLessons = ids.map((id) => {
    const matches = lessons.filter((lesson) => lesson.templateIds.includes(id));
    if (matches.length !== 1) throw new Error(`Expected one lesson for ${id}`);
    return matches[0]!;
  });
  const manifest = buildCoverageManifest();
  await emit({
    kind: "linear-system-content-manifest",
    editions: 16,
    templates: templates.filter((template) => ids.includes(template.id)),
    skill: skills.find((skill) => skill.id === "linear-systems"),
    declaredMappings: linearSystemFacetMappings,
    registeredMappings: actualFacetMappings.filter((mapping) =>
      ids.includes(mapping.templateId),
    ),
    coverageValid: manifest.valid,
    bindings: manifest.skills.flatMap((skill) =>
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
    ),
    lessons: selectedLessons,
    lessonHtml: selectedLessons.map((lesson) => ({
      id: lesson.id,
      html: publicationHtml(lesson, "lesson", "1"),
    })),
  });
  for (let index = 1; index <= 16; index++) {
    const edition = String(index);
    for (const lesson of selectedLessons) {
      const templateId = lesson.templateIds.find((id) => ids.includes(id))!;
      const problems = linearSystemWorksheet(templateId, lesson.id, edition);
      await emit({
        kind: "linear-system-worksheet",
        edition,
        templateId,
        lessonId: lesson.id,
        problems,
        replayed: problems.map((problem) =>
          generateProblem(templateId, problem.public.seed),
        ),
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
