/** Export public values under test; Python independently checks all arithmetic. */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { completingSquareLessons } from "../src/content/completing-square-lessons";
import { CompletingSquareIllustration } from "../src/content/CompletingSquareIllustration";
import { completingSquareWorksheet } from "../src/content/completing-square-worksheets";
import { templates } from "../src/math/engine";
import { skills } from "../src/curriculum/catalog";
import { actualFacetMappings } from "../src/content/facet-mappings";
import { buildCoverageManifest } from "../src/content/coverage";
import { publicationHtml } from "../src/content/publications";
import { calculatorAllowed } from "../src/math/calculator";
const ids = [
  "complete-square-term",
  "complete-square-monic",
  "complete-square-nonmonic",
];
const kinds = [
  "complete-square-area",
  "complete-square-balance",
  "complete-square-scaled",
] as const;
const manifests = [
  buildCoverageManifest(),
  buildCoverageManifest({ facetMappings: [] }),
];
const result = {
  editions: 16,
  templates: templates.filter((t) => ids.includes(t.id)),
  skill: skills.find((s) => s.id === "complete-square"),
  mappings: actualFacetMappings.filter((m) => ids.includes(m.templateId)),
  bindings: manifests.map((manifest) => ({
    valid: manifest.valid,
    entries: manifest.skills.flatMap((s) =>
      s.facets.flatMap((f) =>
        f.templateIds
          .filter((id) => ids.includes(id))
          .map((templateId) => ({ templateId, skillId: s.id, facetId: f.id })),
      ),
    ),
  })),
  calculators: ids.map((id) => ({
    id,
    allowed: calculatorAllowed({ id }, "algebra", 9),
  })),
  lessons: completingSquareLessons,
  figures: kinds.map((kind) => ({
    kind,
    html: renderToStaticMarkup(
      React.createElement(CompletingSquareIllustration, { kind }),
    ),
  })),
  worksheets: ids.flatMap((templateId) =>
    Array.from({ length: 16 }, (_, edition) => ({
      templateId,
      edition: String(edition + 1),
      problems: completingSquareWorksheet(
        templateId,
        templateId,
        String(edition + 1),
      ),
    })),
  ),
  publications: completingSquareLessons.flatMap((lesson) =>
    (["lesson", "workbook", "solutions"] as const).map((kind) => {
      const html = publicationHtml(lesson, kind, "1");
      return {
        lessonId: lesson.id,
        kind,
        article: html.slice(
          html.indexOf("<article"),
          html.lastIndexOf("</article>") + 10,
        ),
      };
    }),
  ),
};
process.stdout.write(JSON.stringify(result));
