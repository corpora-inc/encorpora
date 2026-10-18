/** Public-render evidence for the independent Python inequality content oracle.
 * Author selectors and rendered documents are values under test, not answer solvers.
 */
import { once } from "node:events";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { inequalityWorksheet } from "../src/content/inequality-worksheets";
import { inequalityFacetMappings } from "../src/content/inequality-coverage";
import {
  buildCoverageManifest,
  type FacetMapping,
} from "../src/content/coverage";
import { lessons } from "../src/content/lessons";
import { publicationHtml } from "../src/content/publications";
import { generateProblem, templates } from "../src/math/engine";

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
  });
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
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
        const rendered: Record<string, unknown> = {};
        for (const kind of ["workbook", "solutions"] as const) {
          await page.setContent(publicationHtml(lesson, kind, edition), {
            waitUntil: "domcontentloaded",
          });
          rendered[kind] = await page
            .locator(".exercise")
            .evaluateAll((nodes) =>
              nodes.map((node) => {
                const copy = node.cloneNode(true) as Element;
                for (const math of copy.querySelectorAll(".print-math"))
                  math.replaceWith(
                    document.createTextNode(
                      math.getAttribute("data-plain") ?? "",
                    ),
                  );
                return {
                  prompt: copy
                    .querySelector("h2")
                    ?.textContent?.trim()
                    .replace(/^\d+\. /, ""),
                  choices: [...copy.querySelectorAll(".print-choices>li")].map(
                    (element) => element.textContent?.trim(),
                  ),
                  answer:
                    copy.querySelector("p>strong")?.textContent?.trim() ?? null,
                  steps: [
                    ...copy.querySelectorAll("ol:not(.print-choices)>li"),
                  ].map((element) => element.textContent?.trim()),
                  hiddenAnswerMarkers: copy.querySelectorAll(
                    "[data-answer],[data-correct],script,input[type=hidden]",
                  ).length,
                };
              }),
            );
        }
        await emit({
          kind: "inequality-worksheet",
          edition,
          templateId,
          lessonId: lesson.id,
          problems,
          replayed: problems.map((problem) =>
            generateProblem(templateId, problem.public.seed),
          ),
          ...rendered,
        });
      }
    }
  } finally {
    await browser.close();
  }
}
main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : error}\n`);
  process.exitCode = 1;
});
