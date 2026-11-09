import type { GeneratedProblem, TemplateMetadata } from "./contracts";
import { finish, rng } from "./number-geometry-clause-kit";
import { decimalDivision } from "./clause-real-variants";
import { recognizeAngle, constructTriangle } from "./clause-geometry-variants";
export const clauseTemplates: readonly TemplateMetadata[] = [
  {
    id: "angle-recognize",
    requiredResponseCapability: "single-choice-v1",
    version: 1,
    title: "Recognize angles and vertices",
    skillId: "angle-measure",
    gradeBand: "3–5",
    requiredResponseCapabilities: ["single-choice-v1", "figure-choice-v1"],
    requiredFigureCapability: "scenes-v1",
    description:
      "Recognize two rays with a common endpoint, name the vertex, and count angles formed by pairs of rays.",
  },
  {
    id: "triangle-construct-plot",
    version: 1,
    title: "Construct a triangle on a grid",
    skillId: "triangle-construction",
    gradeBand: "6–8",
    requiredResponseCapability: "point-plot-v1",
    description:
      "Plot the third vertex above a given base from three sides, two sides and the included right angle, or two angles. Practices construction with technology; freehand and ruler-and-protractor drawing are not assessed.",
  },
  {
    id: "fraction-to-decimal-long-division",
    requiredResponseCapability: "structured-work-v1",
    version: 1,
    title: "Fractions as decimals by long division",
    skillId: "signed-multiplication",
    gradeBand: "6–8",
    requiredResponseCapabilities: ["single-choice-v1", "structured-work-v1"],
    description:
      "Convert signed fractions through quotient digits and remainders; explain why a decimal terminates or eventually repeats.",
  },
];
export function generateClauseProblem(
  id: string,
  seed: string,
): GeneratedProblem {
  const meta = clauseTemplates.find((t) => t.id === id);
  if (!meta) throw new Error(`Unknown clause template ${id}`);
  const r = rng(id, seed),
    item =
      id === "angle-recognize"
        ? recognizeAngle(r)
        : id === "triangle-construct-plot"
          ? constructTriangle(r)
          : decimalDivision(r);
  return finish(meta, seed, id, item);
}
