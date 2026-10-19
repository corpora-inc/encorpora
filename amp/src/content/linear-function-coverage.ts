import type { FacetMapping } from "./coverage";
export const linearFunctionFacetMappings: readonly FacetMapping[] = [
  [
    "graph-domain-range",
    "function-domain-range.graph-domain-range",
    "Read the domain or range of a line segment, parabola arc or absolute-value arc drawn on an integer grid, with filled or open endpoints and turning points inside the interval, as inequalities. Does not assess interval notation, unbounded graphs or asymptotes.",
  ],
  [
    "context-domain-range",
    "function-domain-range.contextual-domain",
    "Choose the domain or range of a context function: whole-number counts up to a stated maximum (fares, loaves, tolls) or a continuous time until a tank or candle runs out. Does not assess writing the restriction freely.",
  ],
  [
    "function-relation-test",
    "function-domain-range.function-definition",
    "Choose the relation that is (or is not) a function among sets of four ordered pairs, or among equations where squares, absolute values or a circle give one x two y-values. Does not assess the vertical-line test on drawn graphs.",
  ],
  [
    "average-rate-formula",
    "average-rate-change.from-formula",
    "Compute the exact average rate of change of a quadratic, a·2ˣ or a·3ˣ, a projectile height in feet, or a function given by two values, over an integer interval. Does not assess estimating rates from data.",
  ],
  [
    "average-rate-display",
    "average-rate-change.from-graph-table",
    "Compute the average rate of change between two marked points of a parabola with its secant drawn, between two shaded columns of a value table, or between two times in a temperature or population table, with units. Does not assess comparing rates across intervals.",
  ],
  [
    "linear-model-value",
    "linear-equation-modeling.solve-model",
    "Write and solve a linear model for a fee plus a rate, two plans with equal cost, a rectangle's perimeter with a related length, or the greatest whole number under a budget. Does not assess models with fractional rates or explaining solutions in writing.",
  ],
  [
    "linear-model-equation",
    "linear-equation-modeling.choose-model",
    "Choose y = mx + b (or b − mx) for a taxi, plant or candle given in words, on a first-quadrant graph or in a table that omits the starting value, against swapped, sign and combined-rate distractors. Does not assess writing the equation freely.",
  ],
  [
    "formula-isolate",
    "formula-rearrangement.isolate-variable",
    "Choose the formula solved for a named variable from eleven geometry, science, finance and line formulas, against inverse-operation, order and division-direction errors. Does not assess formulas with squares or roots.",
  ],
  [
    "formula-value",
    "formula-rearrangement.rearrange-and-substitute",
    "Find one variable of a perimeter, temperature, trapezoid, speed or simple-interest formula from the others, with whole-number results. Does not assess unit conversion.",
  ],
  [
    "solution-point-choice",
    "graph-solution-sets.point-on-graph",
    "Choose the point on the graph of a standard-form line, a slope-intercept line with fractional slope, a parabola or an absolute-value graph, against swapped, sign and shifted points. Does not assess graphing by the learner.",
  ],
  [
    "solution-coordinate",
    "graph-solution-sets.missing-coordinate",
    "Find the exact missing coordinate (integer or fraction) of a point on a standard-form line, or the y-coordinate on a parabola, with the line drawn and the known coordinate dashed. Does not assess estimating intersections.",
  ],
].map(([templateId, facetId, rationale]) => ({
  templateId: templateId!,
  facetId: facetId!,
  extent: "partial",
  rationale: rationale!,
}));
