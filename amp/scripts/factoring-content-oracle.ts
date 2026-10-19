/** Export authored public/rendered evidence; Python independently checks the math. */
import { once } from "node:events";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { factoringWorksheet } from "../src/content/factoring-worksheets";
import { FactoringIllustration } from "../src/content/FactoringIllustration";
import { lessons } from "../src/content/lessons";
import { publicationHtml } from "../src/content/publications";
import { buildCoverageManifest } from "../src/content/coverage";
import { generateProblem, templates } from "../src/math/engine";
import { skills } from "../src/curriculum/catalog";
import { calculatorAllowed } from "../src/math/calculator";
import { factoringFacetMappings } from "../src/content/factoring-coverage";

const ids = ["greatest-monomial-factor", "monic-quadratic-factorization", "nonmonic-quadratic-factorization"];
async function emit(value: unknown) {
  if (!process.stdout.write(`${JSON.stringify(value)}\n`)) await once(process.stdout, "drain");
}
async function main() {
  const coverage = buildCoverageManifest();
  const override = buildCoverageManifest({ facetMappings: [] });
  const binding = (manifest: ReturnType<typeof buildCoverageManifest>) => manifest.skills.find(skill => skill.id === "factor-quadratics");
  await emit({ kind: "factoring-manifest", runtimeSeeds: 1024, editions: 16,
    templates: templates.filter(template => ids.includes(template.id)),
    skill: skills.find(skill => skill.id === "factor-quadratics"),
    coverageValid: coverage.valid, defaultCoverage: binding(coverage), overrideCoverage: binding(override),
    mappings: factoringFacetMappings,
    calculator: ids.map(id => ({ id, allowed: calculatorAllowed({ id }, "algebra", 12) })),
  });
  for (const kind of ["gcf", "monic", "nonmonic"] as const) {
    await emit({ kind: "factoring-figure", figureKind: kind,
      html: renderToStaticMarkup(React.createElement(FactoringIllustration, { kind })),
    });
  }
  for (const templateId of ids) {
    const matching = lessons.filter(lesson => lesson.templateIds.includes(templateId));
    if (matching.length !== 1) throw new Error(`Expected one factoring lesson: ${templateId}`);
    const lesson = matching[0]!;
    await emit({ kind: "factoring-lesson", templateId, lesson, html: publicationHtml(lesson, "lesson", "1") });
    for (let index = 0; index < 1024; index++) {
      const seed = `factoring-independent-${index}`;
      await emit({ kind: "factoring-runtime", templateId, index,
        problem: generateProblem(templateId, seed), replayed: generateProblem(templateId, seed),
      });
    }
    for (let index = 1; index <= 16; index++) {
      const edition = String(index);
      const problems = factoringWorksheet(templateId, lesson.id, edition);
      await emit({ kind: "factoring-worksheet", templateId, edition, lessonId: lesson.id, problems,
        replayed: problems.map(problem => generateProblem(templateId, problem.public.seed)),
        workbookHtml: publicationHtml(lesson, "workbook", edition),
        solutionsHtml: publicationHtml(lesson, "solutions", edition),
      });
    }
  }
}
main().catch(error => { process.stderr.write(`${String(error)}\n`); process.exitCode = 1; });
