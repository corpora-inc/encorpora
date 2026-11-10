import type { AdultStart } from "../../../learning/starting-point";
import type { SegmentedOption } from "../../ui/Segmented";

/** Where an adult can begin, in course order. Each opens the same adaptive
 * practice at that point on the grade axis (`startingLevels`). Asked on
 * `/me/start` and in the starter's "I’m learning for myself" step. */
export const adultStartOptions: SegmentedOption<AdultStart>[] = [
  { value: "counting", label: "Counting", detail: "Numbers, counting, shapes" },
  {
    value: "elementary",
    label: "Elementary",
    detail: "Operations, fractions, decimals",
  },
  {
    value: "middle-school",
    label: "Middle school",
    detail: "Ratios, negatives, equations",
  },
  {
    value: "algebra-1",
    label: "Algebra",
    detail: "Linear, quadratic, functions",
  },
  { value: "geometry", label: "Geometry", detail: "Proof, similarity, trig" },
  {
    value: "algebra-2",
    label: "Algebra 2",
    detail: "Polynomials, exponentials, logs",
  },
  {
    value: "precalculus",
    label: "Precalculus",
    detail: "Functions, trigonometry, vectors",
  },
];
