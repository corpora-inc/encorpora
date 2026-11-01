import type { TemplateMetadata } from "./contracts";
import { k8TemplateGlossary } from "./template-glossary-k8";

/** Which glossary entry each ambiguous word means in a template's
 * generated hints and explanations, and which words are ordinary prose there
 * (src/glossary). Kept beside the generators so the frozen template lists stay
 * untouched; `withTemplateGlossary` applies it to the engine's templates. */
const glossary: Record<
  string,
  { senses?: Record<string, string>; noLink?: string[] }
> = {
  "aa-similarity": {
    senses: {
      similar: "similar-figures",
      vertex: "vertex",
      vertices: "vertex",
    },
    noLink: [
      "image",
      "side",
      "sides",
      "similar triangles",
      "similarity",
      "third",
    ],
  },
  "abs-equals-linear-unique": {
    senses: { opposite: "opposite-number" },
    noLink: ["rules", "side"],
  },
  "absolute-compound-inequality": {
    senses: { "more than": "more-than" },
    noLink: ["part", "parts"],
  },
  "absolute-value-affine-equation": {
    senses: {
      opposite: "opposite-number",
      side: "side-of-equation",
      sides: "side-of-equation",
    },
    noLink: ["whole"],
  },
  "absolute-value-direct-equation": {
    senses: { unit: "unit", units: "unit" },
    noLink: ["impossible", "side"],
  },
  "absolute-value-equation-formulate": {
    senses: {
      difference: "difference-subtract",
      "right side": "side-of-equation",
      side: "side-of-equation",
      units: "unit",
    },
    noLink: ["center"],
  },
  "absolute-value-linear": {
    senses: {
      "left side": "side-of-equation",
      "right side": "side-of-equation",
    },
    noLink: ["opposite"],
  },
  "absolute-value-transformed-equation": {
    senses: {
      "left side": "side-of-equation",
      "right side": "side-of-equation",
      side: "side-of-equation",
      sides: "side-of-equation",
    },
  },
  "addition-rule-probability": {
    senses: {
      difference: "difference-subtract",
      events: "event",
      "more than": "more-than",
    },
    noLink: ["face", "rule"],
  },
  "addition-rule-steps": { senses: { events: "event" }, noLink: ["leaves"] },
  "angle-chase-chain": {
    senses: {
      "corresponding angles": "corresponding-angles",
      degrees: "degree-angle",
      "more than": "more-than",
    },
    noLink: ["opposite", "side", "sides", "third"],
  },
  "angle-claim-reasoning": {
    senses: { degrees: "degree-angle", "more than": "more-than" },
    noLink: [
      "intersection",
      "leaves",
      "opposite",
      "rules",
      "side",
      "third",
      "whole",
    ],
  },
  "angular-velocity-problem": {
    senses: { center: "center", change: "change", units: "unit" },
  },
  "arc-length-coefficient": {
    senses: {
      center: "center",
      degrees: "degree-angle",
      multiple: "multiple",
      "one quarter": "fourth",
      unit: "unit",
    },
    noLink: ["boundary", "scales"],
  },
  "arc-sector-derivation": {
    senses: {
      degrees: "degree-angle",
      factor: "factor-number",
      factors: "factor-number",
      multiple: "multiple",
      square: "square-number",
      unit: "unit",
      units: "unit",
    },
    noLink: ["scale", "scales", "similar", "whole"],
  },
  "area-probability": {
    senses: { center: "center", side: "side" },
    noLink: ["base", "part", "square", "whole"],
  },
  "arithmetic-distant-term": {
    senses: {
      differences: "difference-subtract",
      term: "term-sequence",
      terms: "term-sequence",
    },
    noLink: ["decreasing"],
  },
  "arithmetic-sequence-as-function": {
    senses: {
      changes: "change",
      multiple: "multiple",
      rule: "rule",
      term: "term-sequence",
      terms: "term-sequence",
    },
    noLink: ["part", "third"],
  },
  "arithmetic-term": { senses: { change: "change", term: "term-sequence" } },
  "average-rate-display": {
    senses: {
      change: "change",
      changes: "change",
      degrees: "degree-temperature",
      difference: "difference-subtract",
      unit: "unit",
    },
    noLink: ["average", "interval", "whole"],
  },
  "average-rate-formula": {
    senses: {
      change: "change",
      changes: "change",
      difference: "difference-subtract",
      unit: "unit",
      units: "unit",
    },
    noLink: ["average", "interval", "rule"],
  },
  "average-rate-steps": {
    senses: { change: "change", population: "population" },
    noLink: ["average"],
  },
  "average-rate-table-rounded": {
    senses: {
      change: "change",
      changes: "change",
      difference: "difference-subtract",
      population: "population",
      unit: "unit",
    },
    noLink: ["average", "decreasing", "interval"],
  },
  "bag-totals-chain": {
    senses: { part: "part", parts: "part", whole: "whole" },
  },
  "bearing-trig-problem": {
    senses: { tangent: "tangent-trig" },
    noLink: ["opposite", "parts", "plane"],
  },
  "benchmark-fraction-estimate": { senses: { "more than": "more-than" } },
  "binomial-area-product": {
    senses: {
      factor: "factor-number",
      product: "product-multiply",
      products: "product-multiply",
      side: "side",
      term: "term-expression",
      terms: "term-expression",
    },
    noLink: ["opposite"],
  },
  "binomial-coefficient": {
    senses: {
      factors: "factor-number",
      product: "product-multiply",
      term: "term-expression",
      terms: "term-expression",
    },
    noLink: ["part"],
  },
  "budget-items-steps": {
    senses: { "more than": "more-than" },
    noLink: ["leaves"],
  },
  "budget-whole-items": {
    senses: {
      "more than": "more-than",
      multiple: "multiple",
      sides: "side-of-equation",
    },
    noLink: ["part", "whole"],
  },
  "causal-claim-choice": {
    senses: { change: "change", changes: "change", population: "population" },
    noLink: ["third"],
  },
  "cavalieri-volume-reasoning": {
    senses: {
      changes: "change",
      edge: "edge",
      mean: "mean-average",
      multiple: "multiple",
      plane: "plane",
      planes: "plane",
      side: "side",
      sides: "side",
      solid: "solid-shape",
      solids: "solid-shape",
    },
    noLink: ["base", "bases", "square"],
  },
  "change-of-base": {
    senses: {
      base: "base-exponent",
      bases: "base-exponent",
      change: "change",
      factor: "factor-number",
      product: "product-multiply",
    },
    noLink: ["leaves", "rule"],
  },
  "circle-angles": {
    senses: {
      center: "center",
      degrees: "degree-angle",
      factor: "factor-number",
      tangent: "tangent-line",
      tangents: "tangent-line",
      vertex: "vertex",
    },
    noLink: ["side", "sides", "tangent line", "terms"],
  },
  "circle-dilation-scaling": {
    senses: {
      center: "center",
      centers: "center",
      changes: "change",
      image: "image-transformation",
      square: "square-number",
    },
    noLink: ["factor", "scales", "similar"],
  },
  "circle-equation": {
    senses: {
      center: "center",
      change: "change",
      square: "square-number",
      squared: "square-number",
      squares: "square-number",
      squaring: "square-number",
      terms: "term-expression",
    },
    noLink: ["opposite", "right side", "sides"],
  },
  "circle-estimate-blanks": { noLink: ["center", "edge"] },
  "circle-line-system": {
    senses: { square: "square-number", squared: "square-number" },
    noLink: ["intersections", "leaves", "part", "right side"],
  },
  "circle-radii-triangle": {
    senses: { center: "center", degrees: "degree-angle" },
    noLink: ["opposite", "sides"],
  },
  "circle-segment-lengths": {
    senses: {
      center: "center",
      change: "change",
      product: "product-multiply",
      products: "product-multiply",
      squared: "square-number",
      tangent: "tangent-trig",
      tangents: "tangent-trig",
    },
    noLink: [
      "intersection",
      "opposite",
      "part",
      "parts",
      "point of tangency",
      "sides",
      "similar triangles",
      "tangent line",
      "whole",
    ],
  },
  "clock-minute-match": { senses: { "more than": "more-than" } },
  "combination-count": {
    senses: { factors: "factor-number", product: "product-multiply" },
    noLink: ["combination", "decreasing"],
  },
  "combination-probability": { senses: { event: "event" } },
  "combine-square-roots": {
    senses: {
      factor: "factor-number",
      factors: "factor-number",
      root: "root-radical",
      square: "square-number",
      term: "term-sequence",
      terms: "term-sequence",
    },
    noLink: ["parts"],
  },
  "combine-unlike-radicals": {
    senses: {
      factor: "factor-number",
      product: "product-multiply",
      root: "root-radical",
      roots: "root-radical",
      term: "term-expression",
    },
  },
  "common-base-exponential": {
    senses: {
      base: "base-exponent",
      bases: "base-exponent",
      side: "side-of-equation",
      sides: "side-of-equation",
      terms: "term-expression",
    },
    noLink: ["whole"],
  },
  "compare-decimals-hundredths": { senses: { changes: "change" } },
  "compare-decimals-thousandths": { senses: { changes: "change" } },
  "compare-fractions": { senses: { multiple: "multiple", rename: "rename" } },
  "compare-irrational-values": {
    senses: { root: "root-radical", square: "square-number" },
  },
  "compare-like-denominators": { senses: { "more than": "more-than" } },
  "compare-like-numerators": { senses: { "more than": "more-than" } },
  "compare-representations": {
    senses: {
      change: "change",
      changes: "change",
      unit: "unit",
      vertex: "vertex-parabola",
    },
  },
  "compare-unlike-fractions": { senses: { "more than": "more-than" } },
  "compass-straightedge-reasoning": {
    senses: {
      "corresponding angles": "corresponding-angles",
      "more than": "more-than",
    },
    noLink: ["key", "sides"],
  },
  "compatible-number-estimate": {
    senses: { multiple: "multiple", multiples: "multiple" },
  },
  "complementary-trig": {
    senses: {
      complement: "complement-probability",
      complements: "complement-probability",
      "opposite side": "opposite-side-angle",
    },
    noLink: ["opposite", "side", "sides"],
  },
  "complete-square-equation": {
    senses: {
      changes: "change",
      "left side": "side-of-equation",
      "right side": "side-of-equation",
      side: "side-of-equation",
      sides: "side-of-equation",
      square: "square-number",
      squared: "square-number",
      terms: "term-expression",
    },
  },
  "complete-square-first-steps": {
    senses: {
      change: "change",
      changes: "change",
      factor: "factor-number",
      product: "product-multiply",
      side: "side-of-equation",
      sides: "side-of-equation",
      term: "term-sequence",
      terms: "term-sequence",
    },
  },
  "complete-square-monic": {
    senses: {
      change: "change",
      square: "square-number",
      squared: "square-number",
      terms: "term-expression",
      vertex: "vertex-parabola",
    },
    noLink: ["scales"],
  },
  "complete-square-nonmonic": {
    senses: {
      change: "change",
      factor: "factor-number",
      square: "square-number",
      squared: "square-number",
      term: "term-expression",
      terms: "term-expression",
      vertex: "vertex-parabola",
    },
    noLink: ["scales", "whole"],
  },
  "complete-square-step-property": {
    senses: {
      factor: "factor-number",
      "left side": "side-of-equation",
      opposite: "opposite-number",
      rule: "rule",
      side: "side-of-equation",
      sides: "side-of-equation",
      term: "term-expression",
    },
    noLink: ["balance", "scale"],
  },
  "complete-square-term": {
    senses: {
      factors: "factor-number",
      square: "square-number",
      term: "term-expression",
    },
    noLink: ["side", "sides"],
  },
  "complex-conjugate-division": {
    senses: {
      change: "change",
      changes: "change",
      product: "product-multiply",
      square: "square-number",
      term: "term-sequence",
      terms: "term-sequence",
    },
    noLink: ["leaves", "opposites", "part"],
  },
  "complex-distance-midpoint": {
    senses: {
      average: "mean-average",
      averages: "mean-average",
      center: "center",
      difference: "difference-subtract",
      differences: "difference-subtract",
      square: "square-number",
      squares: "square-number",
      units: "unit",
    },
    noLink: ["left side", "plane"],
  },
  "complex-multiplication": {
    senses: {
      factor: "factor-number",
      multiple: "multiple",
      product: "product-multiply",
      products: "product-multiply",
      rule: "rule",
      term: "term-expression",
      terms: "term-expression",
    },
    noLink: ["part"],
  },
  "complex-parts": {
    senses: { multiple: "multiple", term: "term-expression" },
    noLink: ["leaves", "root"],
  },
  "complex-plane-forms": {
    senses: {
      change: "change",
      side: "side",
      square: "square-number",
      squares: "square-number",
      unit: "unit",
      units: "unit",
    },
    noLink: ["part", "parts", "plane"],
  },
  "complex-plane-operations": {
    senses: {
      changes: "change",
      differences: "difference-subtract",
      factor: "factor-number",
      products: "product-multiply",
      quarter: "fourth",
    },
    noLink: [
      "argument",
      "opposite",
      "plane",
      "rule",
      "scales",
      "side",
      "sides",
    ],
  },
  "complex-quadratic-factors": {
    senses: {
      factor: "factor-number",
      factors: "factor-number",
      opposite: "opposite-number",
      product: "product-multiply",
      square: "square-number",
      squares: "square-number",
      terms: "term-expression",
    },
    noLink: ["part", "parts", "roots", "whole"],
  },
  "complex-quadratic-solve": {
    senses: {
      product: "product-multiply",
      "right side": "side-of-equation",
      side: "side-of-equation",
      sides: "side-of-equation",
      squared: "square-number",
      squares: "square-number",
      squaring: "square-number",
    },
    noLink: ["roots"],
  },
  "composition-expression": {
    senses: {
      square: "square-number",
      squared: "square-number",
      squares: "square-number",
      term: "term-expression",
    },
    noLink: ["whole"],
  },
  "composition-order-choice": {
    senses: { changes: "change" },
    noLink: ["commute", "commutes", "whole"],
  },
  "compound-event-simulation": {
    senses: { event: "event", trial: "trial", trials: "trial" },
  },
  "compound-growth": {
    senses: {
      change: "change",
      "one quarter": "fourth",
      period: "period",
      periods: "period",
      quarters: "fourth",
      roots: "root-equation",
      units: "unit",
    },
    noLink: ["balance", "factor", "factors"],
  },
  "compound-unit-conversion": {
    senses: {
      changes: "change",
      factor: "factor-number",
      squared: "square-number",
      unit: "unit",
      units: "unit",
    },
    noLink: ["cube", "parts", "square"],
  },
  "conditional-everyday-reasoning": {
    senses: {
      change: "change",
      difference: "difference-subtract",
      event: "event",
      events: "event",
    },
    noLink: ["intersection"],
  },
  "conditional-frequency-choice": {
    senses: { differences: "difference-subtract", mean: "mean-average" },
    noLink: ["part", "whole"],
  },
  "conditional-probability-value": {
    senses: { event: "event", multiple: "multiple" },
    noLink: ["leaves", "part", "whole"],
  },
  "conditional-statements": {
    senses: { multiple: "multiple", sides: "side" },
    noLink: ["inverse", "parts", "square"],
  },
  "cone-section-name": {
    senses: { plane: "plane", side: "side", sides: "side", vertex: "vertex" },
    noLink: ["intersection"],
  },
  "congruence-by-rigid-motion": {
    senses: {
      change: "change",
      changes: "change",
      image: "image-transformation",
      sides: "side",
      vertex: "vertex",
      vertices: "vertex",
    },
    noLink: ["opposite", "scale"],
  },
  "congruence-claims-table": {
    senses: {
      change: "change",
      changes: "change",
      factor: "factor-number",
      image: "image-transformation",
      images: "image-transformation",
    },
    noLink: ["rule"],
  },
  "conic-foci": {
    senses: {
      difference: "difference-subtract",
      focus: "focus",
      term: "term-expression",
      vertices: "vertex",
    },
    noLink: ["center"],
  },
  "conic-standard-form": {
    senses: {
      square: "square-number",
      squared: "square-number",
      squares: "square-number",
      "standard form": "standard-form-line",
      term: "term-expression",
      terms: "term-expression",
    },
    noLink: ["center", "opposite", "parts", "right side", "sides"],
  },
  "constraint-feasible": {
    noLink: ["boundary", "combination", "edges", "intersection", "solid"],
  },
  "context-domain-range": {
    senses: {
      "more than": "more-than",
      multiples: "multiple",
      range: "range-function",
      sides: "side-of-equation",
    },
    noLink: ["jumps", "rule", "whole"],
  },
  "coordinate-context-points": { senses: { "more than": "more-than" } },
  "coordinate-polygon": {
    senses: {
      product: "product-multiply",
      units: "unit",
      vertex: "vertex",
      vertices: "vertex",
    },
    noLink: ["opposite", "plane", "side", "sides"],
  },
  "coordinate-quadrilateral-claims": {
    senses: {
      multiple: "multiple",
      square: "square-number",
      squared: "square-number",
      vertex: "vertex",
      vertices: "vertex",
    },
    noLink: ["opposite", "side", "sides"],
  },
  "correlation-causation-choice": {
    senses: { change: "change", factor: "factor-number" },
    noLink: ["opposite", "third"],
  },
  "correlation-choice": {
    senses: { model: "model", rules: "rule" },
    noLink: ["jump"],
  },
  "corresponding-angle-transfer": {
    senses: {
      changes: "change",
      "corresponding angle": "corresponding-angles",
      "corresponding angles": "corresponding-angles",
      degrees: "degree-angle",
      side: "side",
      sides: "side",
      similar: "similar-figures",
      vertex: "vertex",
    },
    noLink: ["similar triangles", "similarity"],
  },
  "count-relation-chain": {
    senses: { difference: "difference-subtract", term: "term-expression" },
    noLink: ["leaves"],
  },
  "counterexample-choice": {
    senses: { product: "product-multiply", side: "side" },
    noLink: ["part", "parts", "square", "squares", "third"],
  },
  "crossing-segment-similarity": {
    senses: {
      side: "side",
      sides: "side",
      similar: "similar-figures",
      vertices: "vertex",
    },
    noLink: ["opposite", "similar triangles"],
  },
  "cube-root-equation": {
    senses: {
      "left side": "side-of-equation",
      "right side": "side-of-equation",
      side: "side-of-equation",
      sides: "side-of-equation",
      squaring: "square-number",
    },
    noLink: ["cube", "cubes", "root"],
  },
  "cubic-graph-statement": {
    senses: { changes: "change", factor: "factor-number" },
    noLink: ["decreasing", "increasing", "increasing intervals", "interval"],
  },
  "cubic-quotient-factored": {
    senses: { factor: "factor-number", product: "product-multiply" },
    noLink: ["leaves"],
  },
  "cubic-quotient-remainder": { senses: { opposite: "opposite-number" } },
  "curved-solid-surface-area": {
    senses: {
      edge: "edge",
      side: "side",
      sides: "side",
      solids: "solid-shape",
      square: "square-number",
    },
    noLink: ["base", "bases", "face", "faces"],
  },
  "customary-unit-reverse": { noLink: ["whole"] },
  "decimal-both-sides-equation": {
    senses: {
      "left side": "side-of-equation",
      "right side": "side-of-equation",
      rules: "rule",
      side: "side-of-equation",
      sides: "side-of-equation",
      term: "term-expression",
      terms: "term-expression",
    },
    noLink: ["balance", "opposite"],
  },
  "decimal-grid-read": { senses: { part: "part", whole: "whole" } },
  "decimal-rename-chain": { senses: { part: "part", parts: "part" } },
  "decompose-flat-shape": { senses: { sides: "side" } },
  "degree-radian-conversion": {
    senses: {
      change: "change",
      degrees: "degree-angle",
      unit: "unit",
      units: "unit",
    },
  },
  "density-context": {
    senses: {
      mean: "mean-average",
      population: "population",
      square: "square-number",
      unit: "unit",
      units: "unit",
    },
  },
  "density-volume-steps": {
    senses: {
      change: "change",
      side: "side",
      solids: "solid-shape",
      unit: "unit",
    },
    noLink: ["base", "one third", "parts", "whole"],
  },
  "depreciation-recursion": {
    senses: {
      change: "change",
      factor: "factor-number",
      period: "period",
      rule: "rule",
      term: "term-sequence",
    },
    noLink: ["leaves", "part"],
  },
  "dilation-measure": {
    senses: {
      change: "change",
      changes: "change",
      degrees: "degree-angle",
      image: "image-transformation",
      sides: "side",
    },
    noLink: ["center", "factor", "leaves", "scale"],
  },
  "eighths-and-parts-beyond-one": {
    senses: { eighths: "eighth", part: "part", parts: "part", whole: "whole" },
  },
  "elevation-depression-steps": {
    senses: { "opposite side": "opposite-side-angle", tangent: "tangent-trig" },
    noLink: ["base", "part", "parts"],
  },
  "elimination-equivalent": {
    senses: {
      multiple: "multiple",
      "right side": "side-of-equation",
      side: "side-of-equation",
      sides: "side-of-equation",
      term: "term-expression",
      terms: "term-expression",
    },
    noLink: ["opposites"],
  },
  "empirical-distribution-expectation": {
    senses: {
      average: "mean-average",
      averages: "mean-average",
      products: "product-multiply",
      sample: "sample",
    },
    noLink: ["scale", "trial", "trials"],
  },
  "equal-area-fraction": {
    senses: { part: "part", parts: "part" },
    noLink: ["squares"],
  },
  "equal-area-part-size": { senses: { parts: "part" } },
  "equation-after-one-step": {
    senses: {
      side: "side-of-equation",
      term: "term-expression",
      whole: "whole",
    },
    noLink: ["balance"],
  },
  "equation-step-property": {
    senses: {
      changes: "change",
      rule: "rule",
      side: "side-of-equation",
      sides: "side-of-equation",
      term: "term-expression",
      terms: "term-expression",
    },
    noLink: ["part"],
  },
  "equivalent-denominator": { senses: { whole: "whole" } },
  "equivalent-fractions-select": {
    senses: { changes: "change", part: "part", parts: "part" },
  },
  "equivalent-numerator": { senses: { whole: "whole" } },
  "equivalent-trinomial-select": {
    senses: {
      changes: "change",
      factor: "factor-number",
      product: "product-multiply",
      term: "term-expression",
      terms: "term-expression",
    },
    noLink: ["products"],
  },
  "event-complement-set": {
    senses: {
      complement: "complement-probability",
      complements: "complement-probability",
      event: "event",
      events: "event",
    },
    noLink: ["intersection"],
  },
  "event-set-count": {
    senses: {
      complement: "complement-probability",
      event: "event",
      events: "event",
    },
    noLink: ["intersection", "sort", "whole"],
  },
  "expected-value": { senses: { average: "mean-average" } },
  "exponential-decay-table": {
    senses: {
      change: "change",
      difference: "difference-subtract",
      differences: "difference-subtract",
      factor: "factor-number",
    },
    noLink: ["decreasing", "third"],
  },
  "exponential-domain-range": {
    senses: {
      base: "base-exponent",
      model: "model",
      range: "range-function",
      term: "term-expression",
    },
    noLink: ["boundary", "side"],
  },
  "exponential-initial-value": {
    senses: { factor: "factor-number", model: "model" },
  },
  "exponential-log-solution": {
    senses: {
      base: "base-exponent",
      side: "side-of-equation",
      sides: "side-of-equation",
    },
    noLink: ["balance", "whole"],
  },
  "exponential-model-rule": {
    senses: { base: "base-exponent", factor: "factor-number" },
    noLink: ["leaves", "rule"],
  },
  "exponential-model-value": {
    senses: { model: "model", unit: "unit" },
    noLink: ["balance", "factor", "key", "whole"],
  },
  "exponential-overtakes": { senses: { changes: "change" }, noLink: ["whole"] },
  "exponential-parameter-log": {
    senses: {
      base: "base-exponent",
      factor: "factor-number",
      side: "side-of-equation",
      sides: "side-of-equation",
    },
    noLink: ["parameters"],
  },
  "exponential-parameters-blanks": {
    senses: {
      base: "base-exponent",
      change: "change",
      model: "model",
      period: "period",
    },
  },
  "exponential-passes-linear": {
    senses: {
      changes: "change",
      difference: "difference-subtract",
      factor: "factor-number",
    },
    noLink: ["increasing", "rules", "whole"],
  },
  "exponential-points-statement": {
    senses: {
      difference: "difference-subtract",
      factor: "factor-number",
      model: "model",
      units: "unit",
    },
  },
  "exponential-target-time": {
    senses: { model: "model", sides: "side-of-equation" },
    noLink: ["leaves", "part", "rule"],
  },
  "exponential-time-scale": {
    senses: {
      base: "base-exponent",
      change: "change",
      changes: "change",
      factor: "factor-number",
      model: "model",
      population: "population",
      root: "root-equation",
      unit: "unit",
    },
    noLink: ["increasing", "index", "interval", "intervals", "rule"],
  },
  "exponential-time-steps": {
    senses: { model: "model", sides: "side-of-equation" },
    noLink: ["part"],
  },
  "expression-after-first-step": { noLink: ["part"] },
  "factor-large-trinomial": {
    senses: {
      factor: "factor-number",
      factors: "factor-number",
      product: "product-multiply",
      term: "term-expression",
    },
  },
  "factor-out-choice": { senses: { part: "part", term: "term-expression" } },
  "fair-selection-procedure": {
    senses: { changes: "change", multiple: "multiple" },
    noLink: ["faces", "leaves"],
  },
  "fee-budget-inequality": {
    senses: {
      "more than": "more-than",
      sides: "side-of-equation",
      units: "unit",
    },
  },
  "fee-plan-chain": {
    senses: {
      change: "change",
      changes: "change",
      difference: "difference-subtract",
      unit: "unit",
      units: "unit",
    },
  },
  "fee-rule-choice": {
    senses: { product: "product-multiply", rule: "rule" },
    noLink: ["terms"],
  },
  "find-equal-shares": { senses: { parts: "part" } },
  "find-equal-thirds": { senses: { parts: "part" } },
  "fl-even-odd-classify": {
    senses: {
      change: "change",
      changes: "change",
      term: "term-expression",
      terms: "term-expression",
    },
  },
  "fl-function-arithmetic": {
    senses: {
      change: "change",
      changes: "change",
      difference: "difference-subtract",
      factor: "factor-number",
      product: "product-multiply",
      term: "term-expression",
    },
    noLink: ["combination"],
  },
  "fl-trapezoid-consequences": {
    senses: { average: "mean-average" },
    noLink: ["base", "bases", "sides"],
  },
  "fl-vector-angle": { senses: { multiple: "multiple" }, noLink: ["plane"] },
  "fl-vector-dot-product": { noLink: ["products"] },
  "formula-isolate": {
    senses: {
      product: "product-multiply",
      term: "term-expression",
      terms: "term-expression",
    },
    noLink: ["side", "sides"],
  },
  "formula-value": {
    senses: { degrees: "degree-temperature", unit: "unit" },
    noLink: ["bases", "leaves", "side", "sides"],
  },
  "fraction-choice-compare": {
    senses: {
      "more than": "more-than",
      multiple: "multiple",
      part: "part",
      parts: "part",
      whole: "whole",
    },
  },
  "fraction-division-expression": {
    senses: { parts: "part", unit: "unit", whole: "whole" },
  },
  "fraction-group-count": { senses: { part: "part" } },
  "fraction-line-names-select": { senses: { part: "part", parts: "part" } },
  "fraction-line-position": { senses: { whole: "whole" } },
  "fraction-share-amount": { senses: { part: "part" } },
  "fraction-total-minus-parts": { senses: { parts: "part" } },
  "fraction-unit-count": { senses: { whole: "whole" } },
  "fraction-whole-as-parts": { senses: { whole: "whole" } },
  "frequency-table-center": {
    senses: {
      average: "mean-average",
      changes: "change",
      mean: "mean-average",
      "more than": "more-than",
      products: "product-multiply",
    },
    noLink: ["leaves", "parts"],
  },
  "function-evaluation": { noLink: ["rule", "square"] },
  "function-graph-features": {
    senses: {
      base: "base-exponent",
      change: "change",
      range: "range-function",
    },
    noLink: ["decreasing", "increasing", "inverse", "opposite", "side"],
  },
  "function-missing-input": { noLink: ["rule"] },
  "function-relation-test": {
    senses: {
      mean: "mean-average",
      opposite: "opposite-number",
      squared: "square-number",
    },
    noLink: ["cube", "rule"],
  },
  "function-shift-sentence": {
    senses: { change: "change", units: "unit" },
    noLink: ["opposite"],
  },
  "gauss-3x3-solve": {
    senses: {
      "left side": "side-of-equation",
      multiple: "multiple",
      multiples: "multiple",
      "right side": "side-of-equation",
      sides: "side-of-equation",
      term: "term-expression",
      terms: "term-expression",
    },
    noLink: ["combination", "degree", "leaves", "third"],
  },
  "gcf-factor-sum": { senses: { factor: "factor-number" } },
  "geo-altitude-hypotenuse": {
    senses: { side: "side", sides: "side", similar: "similar-figures" },
    noLink: ["part", "parts", "similar triangles", "whole"],
  },
  "geo-altitude-ratio": {
    senses: {
      "opposite side": "opposite-side-angle",
      similar: "similar-figures",
      tangent: "tangent-trig",
    },
    noLink: ["opposite", "side", "sides", "whole"],
  },
  "geo-arc-length-rounded": {
    senses: {
      center: "center",
      degrees: "degree-angle",
      sides: "side",
      unit: "unit",
      vertex: "vertex",
    },
    noLink: ["part", "whole"],
  },
  "geo-area-changing-transformation": {
    senses: {
      change: "change",
      changes: "change",
      factor: "factor-number",
      factors: "factor-number",
      image: "image-transformation",
      mean: "mean-average",
      side: "side",
    },
    noLink: ["base", "part", "rule", "rules"],
  },
  "geo-centroid-median": {
    senses: { "opposite side": "opposite-side-angle", vertex: "vertex" },
    noLink: [
      "balance",
      "median of a triangle",
      "one third",
      "part",
      "parts",
      "thirds",
      "whole",
    ],
  },
  "geo-circle-general-form": {
    senses: {
      center: "center",
      square: "square-number",
      squared: "square-number",
      squares: "square-number",
      term: "term-expression",
      terms: "term-expression",
    },
    noLink: ["opposite", "right side", "side", "sides"],
  },
  "geo-complementary-trig-choice": {
    senses: { complement: "complement-probability" },
    noLink: ["opposite", "side", "sides", "third"],
  },
  "geo-density-rank": {
    senses: { population: "population", populations: "population" },
    noLink: ["square"],
  },
  "geo-dilation-center": {
    senses: { image: "image-transformation", vertex: "vertex" },
    noLink: ["center", "factor"],
  },
  "geo-dilation-line-center": {
    senses: {
      change: "change",
      changes: "change",
      image: "image-transformation",
    },
    noLink: ["center", "factor"],
  },
  "geo-dilation-line-image": {
    senses: {
      change: "change",
      changes: "change",
      image: "image-transformation",
    },
    noLink: ["center", "scale"],
  },
  "geo-elevation-depression": {
    senses: {
      degree: "degree-angle",
      "opposite side": "opposite-side-angle",
      tangent: "tangent-trig",
    },
    noLink: ["mode", "opposite", "opposite leg", "part", "parts", "whole"],
  },
  "geo-equal-legs-radical": {
    senses: {
      factor: "factor-number",
      side: "side",
      sides: "side",
      similar: "similar-figures",
      squared: "square-number",
    },
    noLink: ["similar triangles"],
  },
  "geo-isosceles-exterior-angle": {
    senses: { degrees: "degree-angle", vertex: "vertex" },
    noLink: ["base", "opposite", "side", "sides"],
  },
  "geo-isosceles-trig": {
    senses: {
      degree: "degree-angle",
      degrees: "degree-angle",
      "opposite side": "opposite-side-angle",
      side: "side",
      sides: "side",
      tangent: "tangent-trig",
    },
    noLink: ["base", "opposite", "whole"],
  },
  "geo-line-pair-relationship": {
    senses: {
      mean: "mean-average",
      product: "product-multiply",
      "standard form": "standard-form-line",
      term: "term-expression",
    },
    noLink: ["opposite", "plane", "side"],
  },
  "geo-line-point-slope-choice": {
    senses: { change: "change", product: "product-multiply" },
    noLink: ["opposite"],
  },
  "geo-motion-chain": {
    senses: {
      mean: "mean-average",
      side: "side",
      sides: "side",
      vertex: "vertex",
      vertices: "vertex",
    },
    noLink: ["leaves"],
  },
  "geo-parallel-perimeter": {
    senses: {
      "corresponding angles": "corresponding-angles",
      similar: "similar-figures",
    },
    noLink: ["factor", "part", "side", "sides", "whole"],
  },
  "geo-parallel-segment-length": {
    noLink: ["part", "parts", "side", "sides", "whole"],
  },
  "geo-parallel-statement": {
    senses: {
      "corresponding angles": "corresponding-angles",
      mean: "mean-average",
      side: "side",
      sides: "side",
      similar: "similar-figures",
      vertex: "vertex",
    },
    noLink: ["opposite", "similar triangles"],
  },
  "geo-parallelogram-sufficient": {
    senses: { side: "side", sides: "side" },
    noLink: ["opposite"],
  },
  "geo-polygon-rotation": {
    senses: {
      degrees: "degree-angle",
      multiple: "multiple",
      multiples: "multiple",
      sides: "side",
    },
    noLink: ["center", "square", "whole"],
  },
  "geo-reflection-side": {
    senses: {
      image: "image-transformation",
      images: "image-transformation",
      side: "side",
    },
  },
  "geo-rigid-statement": {
    senses: {
      change: "change",
      "corresponding angle": "corresponding-angles",
      image: "image-transformation",
      images: "image-transformation",
      mean: "mean-average",
      side: "side",
      sides: "side",
      similar: "similar-figures",
      vertices: "vertex",
    },
  },
  "geo-ring-area": {
    senses: { center: "center", square: "square-number" },
    noLink: ["edge", "side"],
  },
  "geo-sas-triangle-area": {
    senses: {
      degree: "degree-angle",
      side: "side",
      sides: "side",
      square: "square-number",
    },
    noLink: ["base", "mode"],
  },
  "geo-section-impossible": {
    senses: {
      edge: "edge",
      edges: "edge",
      face: "face-solid",
      faces: "face-solid",
      plane: "plane",
      side: "side",
      sides: "side",
      solid: "solid-shape",
    },
    noLink: ["square"],
  },
  "geo-segment-partition-point": {
    senses: { change: "change" },
    noLink: ["part", "parts"],
  },
  "geo-sphere-diameter": {
    senses: {
      center: "center",
      factor: "factor-number",
      square: "square-number",
    },
    noLink: ["cube"],
  },
  "geo-trig-leg-degrees": {
    senses: { degree: "degree-angle", degrees: "degree-angle", units: "unit" },
    noLink: ["mode", "opposite", "side", "sides"],
  },
  "geo-volume-context": {
    senses: {
      base: "base-shape",
      center: "center",
      side: "side",
      solid: "solid-shape",
      solids: "solid-shape",
      square: "square-number",
      unit: "unit",
      units: "unit",
    },
    noLink: ["one third", "part", "parts", "whole"],
  },
  "geometric-design-constraint": {
    senses: { sides: "side", unit: "unit" },
    noLink: ["rule", "square"],
  },
  "geometric-model-choice": {
    senses: {
      center: "center",
      edge: "edge",
      edges: "edge",
      faces: "face-solid",
      model: "model",
      models: "model",
      side: "side",
      sides: "side",
      solid: "solid-shape",
      square: "square-number",
    },
    noLink: ["base", "boundary", "opposite", "part", "whole"],
  },
  "geometric-rule-forms": {
    senses: { rule: "rule", term: "term-sequence", terms: "term-sequence" },
    noLink: ["jumps"],
  },
  "geometric-sequence": {
    senses: {
      factor: "factor-number",
      factors: "factor-number",
      term: "term-sequence",
    },
  },
  "geometric-sequence-as-function": {
    senses: {
      change: "change",
      multiple: "multiple",
      rule: "rule",
      term: "term-sequence",
      terms: "term-sequence",
    },
    noLink: ["third"],
  },
  "geometric-sequence-rule": {
    senses: {
      rule: "rule",
      squared: "square-number",
      term: "term-sequence",
      terms: "term-sequence",
    },
  },
  "geometric-series-sum": {
    senses: { term: "term-sequence", terms: "term-sequence" },
  },
  "geometric-series-total": {
    senses: { period: "period", term: "term-sequence", terms: "term-sequence" },
  },
  "geometric-signed-term": {
    senses: { term: "term-sequence", terms: "term-sequence" },
  },
  "geometry-proof-step": {
    senses: {
      "corresponding angles": "corresponding-angles",
      degrees: "degree-angle",
      mean: "mean-average",
      side: "side",
    },
    noLink: ["opposite", "plane", "rule"],
  },
  "graph-absolute-value-points": {
    senses: {
      changes: "change",
      side: "side-of-equation",
      sides: "side-of-equation",
      unit: "unit",
      units: "unit",
      vertex: "vertex",
    },
    noLink: ["images", "leaves"],
  },
  "graph-after-shift": {
    senses: { change: "change", unit: "unit", units: "unit", vertex: "vertex" },
    noLink: ["whole"],
  },
  "graph-domain-range": {
    senses: { changes: "change", range: "range-function" },
    noLink: ["leaves", "part", "range of a function", "whole"],
  },
  "graph-estimate-system-solution": {
    senses: { changes: "change" },
    noLink: ["balances"],
  },
  "graph-exponential-points": {
    senses: {
      base: "base-exponent",
      factor: "factor-number",
      factors: "factor-number",
    },
    noLink: ["decreasing", "increasing"],
  },
  "graph-is-function": {
    senses: { "more than": "more-than" },
    noLink: ["plane"],
  },
  "graph-of-quadratic-or-exponential": {
    senses: { change: "change", vertex: "vertex-parabola" },
  },
  "graph-quadratic-points": {
    senses: { units: "unit", vertex: "vertex-parabola" },
    noLink: ["leaves", "opposite", "side", "sides"],
  },
  "graph-sqrt-points": {
    senses: { root: "root-radical" },
    noLink: ["increasing", "whole"],
  },
  "graphical-solution-table": {
    senses: {
      change: "change",
      changes: "change",
      opposite: "opposite-number",
    },
    noLink: ["intersection", "intervals", "side"],
  },
  "greatest-common-factor": {
    senses: { factor: "factor-number", factors: "factor-number" },
  },
  "greatest-monomial-factor": {
    senses: {
      factor: "factor-number",
      factors: "factor-number",
      product: "product-multiply",
      term: "term-expression",
      terms: "term-expression",
    },
    noLink: ["identity", "leaves"],
  },
  "grouped-both-sides-solve": {
    senses: {
      changes: "change",
      factor: "factor-number",
      side: "side-of-equation",
      sides: "side-of-equation",
      term: "term-expression",
      terms: "term-expression",
    },
  },
  "grouped-both-sides-steps": {
    senses: {
      side: "side-of-equation",
      sides: "side-of-equation",
      term: "term-expression",
      terms: "term-expression",
    },
  },
  "growth-model-rewrite": {
    senses: { model: "model", period: "period", root: "root-equation" },
    noLink: ["factor", "factors"],
  },
  "half-plane-inequality": {
    senses: { side: "side-of-equation", sides: "side-of-equation" },
    noLink: ["boundary", "edge", "part", "plane", "solid"],
  },
  "improper-fractional-part": { senses: { whole: "whole", wholes: "whole" } },
  "improper-whole-part": { senses: { whole: "whole", wholes: "whole" } },
  "independence-test": {
    senses: {
      change: "change",
      changes: "change",
      event: "event",
      events: "event",
      mean: "mean-average",
    },
    noLink: ["whole"],
  },
  "independent-events-probability": {
    senses: {
      change: "change",
      complements: "complement-probability",
      event: "event",
      multiple: "multiple",
      tails: "tail",
    },
    noLink: ["cube"],
  },
  "inequality-both-sides-number-line": {
    senses: { rule: "rule", terms: "term-expression" },
    noLink: ["boundary", "side", "sides"],
  },
  "inequality-solution-blanks": {
    senses: { sides: "side-of-equation" },
    noLink: ["rule"],
  },
  "inequality-solution-point": { noLink: ["boundary", "solid"] },
  "infinite-geometric-sum": {
    senses: { term: "term-sequence", terms: "term-sequence" },
  },
  "inscribed-polygon-reasoning": {
    senses: { center: "center", vertex: "vertex", vertices: "vertex" },
    noLink: ["side", "sides", "square"],
  },
  "integer-power": {
    senses: {
      base: "base-exponent",
      factor: "factor-number",
      factors: "factor-number",
    },
  },
  "interest-compare-years": {
    senses: { difference: "difference-subtract" },
    noLink: ["balance", "balances", "whole"],
  },
  "interpret-linear-parameters": {
    senses: {
      change: "change",
      changes: "change",
      model: "model",
      population: "population",
      unit: "unit",
      units: "unit",
    },
    noLink: ["balance", "increasing", "mean", "term"],
  },
  "inverse-exponential-root": {
    senses: { side: "side-of-equation", sides: "side-of-equation" },
    noLink: ["cube", "inverse", "renaming"],
  },
  "inverse-expression": {
    senses: {
      root: "root-radical",
      side: "side-of-equation",
      sides: "side-of-equation",
      square: "square-number",
      vertex: "vertex-parabola",
    },
    noLink: ["image", "inverse"],
  },
  "inverse-trig-value": {
    senses: { tangent: "tangent-trig" },
    noLink: ["interval", "intervals", "inverse", "range"],
  },
  "inverse-value": { noLink: ["inverse"] },
  "isolate-two-term-formula": {
    senses: {
      difference: "difference-subtract",
      term: "term-expression",
      terms: "term-expression",
    },
    noLink: ["left side", "part", "right side", "side", "sides", "whole"],
  },
  "isosceles-perimeter-steps": {
    senses: { side: "side", sides: "side", tangent: "tangent-trig" },
    noLink: ["base", "whole"],
  },
  "larger-share": { senses: { whole: "whole" } },
  "least-common-multiple": {
    senses: { multiple: "multiple", multiples: "multiple" },
  },
  "like-fraction-difference": { senses: { whole: "whole" } },
  "like-fraction-missing-part": { senses: { part: "part" } },
  "line-angle-proof-reasons": { noLink: ["face", "opposite", "side", "sides"] },
  "line-equation-forms": {
    senses: {
      change: "change",
      changes: "change",
      factor: "factor-number",
      "left side": "side-of-equation",
      sides: "side-of-equation",
      "standard form": "standard-form-line",
      term: "term-expression",
      terms: "term-expression",
    },
  },
  "line-relationship-equations": {
    senses: { change: "change", product: "product-multiply" },
  },
  "line-slope": { senses: { change: "change", changes: "change" } },
  "linear-model-equation": {
    senses: {
      change: "change",
      changes: "change",
      model: "model",
      models: "model",
      unit: "unit",
    },
    noLink: ["terms"],
  },
  "linear-model-value": {
    senses: {
      changes: "change",
      "more than": "more-than",
      unit: "unit",
      units: "unit",
    },
    noLink: ["side", "sides", "term", "terms"],
  },
  "linear-or-exponential": {
    senses: {
      change: "change",
      changes: "change",
      difference: "difference-subtract",
      differences: "difference-subtract",
      factor: "factor-number",
      mean: "mean-average",
      model: "model",
    },
    noLink: ["balance", "whole"],
  },
  "linear-system-x": {
    senses: {
      "left side": "side-of-equation",
      multiples: "multiple",
      "right side": "side-of-equation",
      sides: "side-of-equation",
      term: "term-expression",
      terms: "term-expression",
    },
    noLink: ["leaves"],
  },
  "literal-equation-solve": {
    senses: {
      changes: "change",
      mean: "mean-average",
      rule: "rule",
      side: "side-of-equation",
      sides: "side-of-equation",
      term: "term-expression",
      terms: "term-expression",
    },
    noLink: ["parameter", "whole"],
  },
  "log-base-fraction-graph": {
    senses: { base: "base-exponent" },
    noLink: ["rule"],
  },
  "log-equation": {
    senses: {
      base: "base-exponent",
      factor: "factor-number",
      factors: "factor-number",
      product: "product-multiply",
      sides: "side-of-equation",
      terms: "term-expression",
    },
    noLink: ["argument", "rule"],
  },
  "log-expand": {
    senses: {
      base: "base-exponent",
      difference: "difference-subtract",
      differences: "difference-subtract",
      factor: "factor-number",
      multiples: "multiple",
      product: "product-multiply",
      products: "product-multiply",
      root: "root-radical",
    },
    noLink: ["combination", "rules"],
  },
  "log-exponential-form": {
    senses: { base: "base-exponent" },
    noLink: ["part", "side"],
  },
  "log-rules-evaluate": {
    senses: {
      base: "base-exponent",
      difference: "difference-subtract",
      multiple: "multiple",
      product: "product-multiply",
      products: "product-multiply",
    },
    noLink: ["argument", "rule", "rules"],
  },
  "logarithm-integer": {
    senses: { base: "base-exponent", factors: "factor-number" },
  },
  "logarithm-value": {
    senses: {
      base: "base-exponent",
      factors: "factor-number",
      root: "root-radical",
    },
    noLink: ["argument"],
  },
  "margin-of-error-interval": {
    senses: {
      mean: "mean-average",
      population: "population",
      sample: "sample",
      samples: "sample",
      units: "unit",
    },
    noLink: ["center", "interval", "parameter"],
  },
  "matrix-data-reading": { noLink: ["whole"] },
  "matrix-inverse-determinant": {
    senses: {
      change: "change",
      multiple: "multiple",
      product: "product-multiply",
      products: "product-multiply",
    },
    noLink: ["identity", "inverse", "sides"],
  },
  "matrix-laws": {
    senses: {
      changes: "change",
      factor: "factor-number",
      factors: "factor-number",
      product: "product-multiply",
      products: "product-multiply",
    },
    noLink: ["commute", "inverse", "part", "rule", "rules"],
  },
  "matrix-linear-system": {
    senses: {
      multiple: "multiple",
      product: "product-multiply",
      "right side": "side-of-equation",
      sides: "side-of-equation",
      terms: "term-expression",
    },
    noLink: ["identity", "inverse"],
  },
  "matrix-operations": {
    senses: {
      differences: "difference-subtract",
      product: "product-multiply",
      products: "product-multiply",
    },
    noLink: ["scale", "whole"],
  },
  "matrix-transformation": {
    senses: {
      changes: "change",
      image: "image-transformation",
      images: "image-transformation",
      product: "product-multiply",
    },
    noLink: ["factor", "plane", "square"],
  },
  "mcas-circle-equation-select": {
    senses: { center: "center", square: "square-number", units: "unit" },
    noLink: ["left side", "opposite", "right side"],
  },
  "mcas-congruence-statement-select": {
    senses: {
      "corresponding angles": "corresponding-angles",
      side: "side",
      sides: "side",
      vertex: "vertex",
      vertices: "vertex",
    },
  },
  "mcas-cylinder-scaling-select": {
    senses: {
      change: "change",
      changes: "change",
      factor: "factor-number",
      squared: "square-number",
    },
  },
  "mcas-quadratic-zeros-select": {
    senses: {
      factor: "factor-number",
      factors: "factor-number",
      product: "product-multiply",
    },
  },
  "mcas-rotational-symmetry": {
    senses: { quarter: "fourth", sides: "side" },
    noLink: ["center", "leaves", "square"],
  },
  "measurable-attribute-choice": { noLink: ["key"] },
  "measurement-error-bound": {
    senses: { unit: "unit", units: "unit" },
    noLink: ["base", "scale", "side"],
  },
  "measurement-formula-justifications": {
    senses: {
      edge: "edge",
      edges: "edge",
      faces: "face-solid",
      side: "side",
      sides: "side",
      similar: "similar-figures",
      solid: "solid-shape",
      vertex: "vertex",
    },
    noLink: ["argument", "base", "cube", "one third", "part", "terms"],
  },
  "midpoint-endpoint": {
    senses: {
      average: "mean-average",
      change: "change",
      changes: "change",
      square: "square-number",
      squares: "square-number",
    },
    noLink: ["center", "right side", "side", "sides"],
  },
  "mixed-fraction-difference": {
    senses: {
      difference: "difference-subtract",
      parts: "part",
      whole: "whole",
    },
  },
  "mixed-to-improper-numerator": {
    senses: { whole: "whole", wholes: "whole" },
  },
  "model-quantity-roles": {
    senses: {
      change: "change",
      changes: "change",
      model: "model",
      unit: "unit",
      units: "unit",
    },
    noLink: ["leaves", "sort"],
  },
  "model-residual-conclusion": {
    senses: {
      model: "model",
      models: "model",
      range: "range-statistics",
      square: "square-number",
      squares: "square-number",
      squaring: "square-number",
    },
    noLink: ["leaves"],
  },
  "monic-quadratic-factorization": {
    senses: {
      factor: "factor-number",
      factors: "factor-number",
      opposite: "opposite-number",
      product: "product-multiply",
      products: "product-multiply",
      square: "square-number",
      term: "term-expression",
      terms: "term-expression",
    },
  },
  "multidigit-decimal-quotient": { noLink: ["whole"] },
  "multidigit-decimal-sum": { senses: { changes: "change" } },
  "multiplication-rule-probability": {
    senses: { event: "event", events: "event", products: "product-multiply" },
    noLink: ["face", "part", "rule"],
  },
  "multiply-fractions": {
    senses: { part: "part", parts: "part", whole: "whole" },
  },
  "multiply-square-roots": {
    senses: {
      factor: "factor-number",
      factors: "factor-number",
      product: "product-multiply",
      root: "root-radical",
      roots: "root-radical",
      square: "square-number",
      term: "term-expression",
      terms: "term-expression",
    },
  },
  "name-equal-share": {
    senses: {
      "one quarter": "fourth",
      part: "part",
      parts: "part",
      quarters: "fourth",
    },
    noLink: ["square"],
  },
  "name-share": {
    senses: {
      part: "part",
      parts: "part",
      quarters: "fourth",
      thirds: "third",
      whole: "whole",
    },
    noLink: ["square"],
  },
  "negative-monomial-power": {
    senses: {
      factor: "factor-number",
      factors: "factor-number",
      product: "product-multiply",
    },
  },
  "nonlinear-data-model": {
    senses: {
      difference: "difference-subtract",
      model: "model",
      square: "square-number",
      squared: "square-number",
      squaring: "square-number",
    },
  },
  "nonlinear-formula-isolate": {
    senses: {
      factor: "factor-number",
      factors: "factor-number",
      product: "product-multiply",
      root: "root-radical",
      square: "square-number",
      squared: "square-number",
    },
    noLink: ["sides", "whole"],
  },
  "nonlinear-recursion-term": {
    senses: { rule: "rule", term: "term-sequence", terms: "term-sequence" },
    noLink: ["square", "squares", "whole"],
  },
  "nonlinear-system-count": {
    senses: {
      side: "side-of-equation",
      sides: "side-of-equation",
      terms: "term-expression",
    },
    noLink: ["intersections", "part", "root", "roots"],
  },
  "nonlinear-system-read": {
    senses: {
      factor: "factor-number",
      product: "product-multiply",
      sides: "side-of-equation",
    },
    noLink: ["solid"],
  },
  "nonlinear-system-solve": {
    senses: {
      factor: "factor-number",
      product: "product-multiply",
      root: "root-equation",
      side: "side-of-equation",
      sides: "side-of-equation",
      terms: "term-expression",
    },
  },
  "nonmonic-complex-quadratic": {
    senses: {
      change: "change",
      factor: "factor-number",
      side: "side-of-equation",
      sides: "side-of-equation",
      square: "square-number",
      term: "term-sequence",
    },
    noLink: ["part", "root"],
  },
  "nonmonic-quadratic-factorization": {
    senses: {
      factor: "factor-number",
      factors: "factor-number",
      opposite: "opposite-number",
      product: "product-multiply",
      products: "product-multiply",
      term: "term-expression",
      terms: "term-expression",
    },
  },
  "normal-model-rule": {
    senses: {
      average: "mean-average",
      averages: "mean-average",
      mean: "mean-average",
      model: "model",
      tail: "tail",
      tails: "tail",
    },
    noLink: [
      "boundary",
      "center",
      "interval",
      "part",
      "rule",
      "scale",
      "side",
      "sides",
    ],
  },
  "normal-probability": {
    senses: { mean: "mean-average", sample: "sample" },
    noLink: ["boundary", "rule"],
  },
  "number-line-between-hundreds": { senses: { "more than": "more-than" } },
  "number-line-jump-story": { senses: { jump: "jump" } },
  "number-system-closure-classify": {
    senses: {
      difference: "difference-subtract",
      differences: "difference-subtract",
      factor: "factor-number",
      product: "product-multiply",
      products: "product-multiply",
    },
    noLink: ["argument", "impossible", "opposites", "rule", "sides"],
  },
  "oblique-triangle-solve": {
    senses: {
      degree: "degree-angle",
      "opposite side": "opposite-side-angle",
      units: "unit",
    },
    noLink: ["faces", "mode", "opposite", "side", "sides", "third"],
  },
  "odd-sine-parameters": { senses: { multiple: "multiple" } },
  "one-sided-behavior-choice": {
    senses: {
      change: "change",
      factor: "factor-number",
      factors: "factor-number",
      side: "side-of-equation",
      sides: "side-of-equation",
      squared: "square-number",
    },
    noLink: ["hole", "jump", "jumps", "rule"],
  },
  "operation-order": { noLink: ["rule"] },
  "operation-property-identify": {
    senses: { change: "change", opposite: "opposite-number", part: "part" },
    noLink: ["rule"],
  },
  "operation-sentence-choice": { senses: { jump: "jump", jumps: "jump" } },
  "outlier-center-shift": {
    senses: {
      change: "change",
      changes: "change",
      difference: "difference-subtract",
      mean: "mean-average",
    },
    noLink: ["leaves"],
  },
  "parabola-axis": {
    senses: {
      average: "mean-average",
      factor: "factor-number",
      factors: "factor-number",
      product: "product-multiply",
      "standard form": "standard-form-line",
      vertex: "vertex-parabola",
    },
    noLink: ["images"],
  },
  "parabola-axis-rule": {
    senses: {
      change: "change",
      sides: "side-of-equation",
      terms: "term-expression",
      vertex: "vertex-parabola",
    },
    noLink: ["opposite", "rule"],
  },
  "parabola-axis-vertex-graph": {
    senses: { vertex: "vertex-parabola" },
    noLink: ["image", "sides"],
  },
  "parabola-focus-directrix": {
    senses: {
      average: "mean-average",
      focus: "focus",
      squared: "square-number",
      unit: "unit",
      units: "unit",
      vertex: "vertex-parabola",
    },
    noLink: ["side"],
  },
  "parabola-shift": {
    senses: { unit: "unit", units: "unit", vertex: "vertex-parabola" },
    noLink: ["opposite", "solid", "square"],
  },
  "parabola-vertex": {
    senses: {
      changes: "change",
      factor: "factor-number",
      square: "square-number",
      squared: "square-number",
      "standard form": "standard-form-line",
      term: "term-expression",
      vertex: "vertex-parabola",
    },
    noLink: ["base", "image", "opposite"],
  },
  "parabola-vertex-distance": {
    senses: {
      focus: "focus",
      unit: "unit",
      units: "unit",
      vertex: "vertex-parabola",
    },
    noLink: ["side"],
  },
  "parallel-segment-steps": {
    senses: { side: "side", sides: "side", vertex: "vertex" },
    noLink: ["factor", "part", "parts", "third", "whole"],
  },
  "parallelogram-angle-steps": {
    senses: { degrees: "degree-angle", side: "side", vertex: "vertex" },
    noLink: ["third"],
  },
  "parallelogram-property-consequences": {
    senses: { terms: "term-sequence", vertices: "vertex" },
    noLink: ["opposite", "parts", "side", "sides", "whole"],
  },
  "parameter-solution-count": {
    senses: {
      difference: "difference-subtract",
      "left side": "side-of-equation",
      multiples: "multiple",
      "right side": "side-of-equation",
      side: "side-of-equation",
      sides: "side-of-equation",
      term: "term-expression",
      terms: "term-expression",
    },
    noLink: ["leaves", "parameter"],
  },
  "parametric-linear-motion": {
    senses: {
      change: "change",
      changes: "change",
      model: "model",
      terms: "term-expression",
      unit: "unit",
    },
    noLink: ["decreasing", "increasing", "sides"],
  },
  "parametric-rectangular-convert": {
    senses: {
      factor: "factor-number",
      identity: "identity-equation",
      square: "square-number",
      terms: "term-expression",
    },
    noLink: ["leaves", "parameter"],
  },
  "pattern-pair-relationship": {
    senses: {
      difference: "difference-subtract",
      factor: "factor-number",
      term: "term-sequence",
      terms: "term-sequence",
    },
  },
  "percent-applications": { noLink: ["base"] },
  "permutation-count": {
    senses: {
      factor: "factor-number",
      factors: "factor-number",
      product: "product-multiply",
    },
    noLink: ["decreasing", "third"],
  },
  "perpendicular-slopes": {
    senses: { change: "change", product: "product-multiply" },
    noLink: ["opposite", "sides"],
  },
  "piecewise-evaluate": {
    senses: { changes: "change" },
    noLink: ["boundary", "intervals", "rule", "rules"],
  },
  "piecewise-reading": { noLink: ["rule"] },
  "point-slope-two-points": { senses: { change: "change" } },
  "polar-cartesian-conversion": {
    senses: { change: "change", units: "unit" },
    noLink: ["face", "faces", "opposite"],
  },
  "polar-graph-identify": {
    senses: {
      change: "change",
      multiple: "multiple",
      range: "range-function",
      ranges: "range-function",
      term: "term-expression",
    },
    noLink: ["leaves"],
  },
  "polygon-symmetry-counts": {
    senses: {
      multiples: "multiple",
      quarter: "fourth",
      side: "side",
      sides: "side",
      vertex: "vertex",
      vertices: "vertex",
    },
    noLink: ["center", "leaves", "opposite", "square"],
  },
  "polynomial-addition": {
    senses: { term: "term-expression", terms: "term-expression" },
  },
  "polynomial-behavior-description": {
    senses: {
      changes: "change",
      degree: "degree-angle",
      factor: "factor-number",
      factors: "factor-number",
      opposite: "opposite-number",
      product: "product-multiply",
      term: "term-expression",
      terms: "term-expression",
    },
  },
  "polynomial-factoring-patterns": {
    senses: {
      differences: "difference-subtract",
      factor: "factor-number",
      factors: "factor-number",
      opposite: "opposite-number",
      product: "product-multiply",
      products: "product-multiply",
      roots: "root-equation",
      squares: "square-number",
      term: "term-expression",
      terms: "term-expression",
    },
    noLink: ["cube", "cubes"],
  },
  "polynomial-graph-match": {
    senses: {
      degree: "degree-angle",
      factor: "factor-number",
      factors: "factor-number",
    },
  },
  "polynomial-identity-use": {
    senses: {
      changes: "change",
      difference: "difference-subtract",
      factor: "factor-number",
      identity: "identity-equation",
      product: "product-multiply",
      products: "product-multiply",
      square: "square-number",
      squares: "square-number",
      term: "term-expression",
      terms: "term-expression",
    },
    noLink: ["identities", "left side", "sides"],
  },
  "polynomial-inequality-solve": {
    senses: {
      change: "change",
      changes: "change",
      factor: "factor-number",
      squared: "square-number",
    },
    noLink: ["interval", "intervals"],
  },
  "polynomial-multiplication": {
    senses: {
      base: "base-exponent",
      factor: "factor-number",
      factors: "factor-number",
      product: "product-multiply",
      products: "product-multiply",
      square: "square-number",
      term: "term-expression",
      terms: "term-expression",
    },
  },
  "polynomial-product-steps": {
    senses: {
      factor: "factor-number",
      factors: "factor-number",
      product: "product-multiply",
      products: "product-multiply",
      square: "square-number",
      squaring: "square-number",
      "standard form": "standard-form-polynomial",
      term: "term-expression",
      terms: "term-expression",
    },
    noLink: ["parts", "side", "whole"],
  },
  "polynomial-quotient": { noLink: ["degree"] },
  "polynomial-root-count": {
    senses: {
      degree: "degree-angle",
      factor: "factor-number",
      factors: "factor-number",
      root: "root-equation",
      roots: "root-equation",
    },
    noLink: ["leaves"],
  },
  "polynomial-structure": {
    senses: {
      degree: "degree-polynomial",
      term: "term-expression",
      terms: "term-expression",
    },
  },
  "polynomial-subtraction": {
    senses: {
      change: "change",
      difference: "difference-subtract",
      opposite: "opposite-number",
      term: "term-expression",
      terms: "term-expression",
    },
  },
  "power-compare": {
    senses: {
      base: "base-exponent",
      changes: "change",
      factor: "factor-number",
      factors: "factor-number",
      "more than": "more-than",
    },
  },
  "power-doubling-story": { senses: { factor: "factor-number" } },
  "power-missing-exponent": { senses: { factor: "factor-number" } },
  "power-of-power-exponent": {
    senses: {
      base: "base-exponent",
      factor: "factor-number",
      factors: "factor-number",
    },
  },
  "power-order-trap": {
    senses: {
      squared: "square-number",
      squares: "square-number",
      squaring: "square-number",
    },
    noLink: ["whole"],
  },
  "power-repeated-product": {
    senses: {
      base: "base-exponent",
      factor: "factor-number",
      product: "product-multiply",
    },
  },
  "powers-of-i-sum": { senses: { terms: "term-expression" } },
  "precise-geometric-definitions": {
    senses: {
      center: "center",
      "more than": "more-than",
      sides: "side",
      vertex: "vertex",
    },
    noLink: ["leaves", "part", "parts", "plane"],
  },
  "price-count-chain": { noLink: ["whole"] },
  "prime-composite-sort": { senses: { factors: "factor-number" } },
  "prime-factorization-exponents": {
    senses: {
      factor: "factor-number",
      factors: "factor-number",
      product: "product-multiply",
    },
  },
  "prime-factorization-value": {
    senses: {
      base: "base-exponent",
      factor: "factor-number",
      factors: "factor-number",
      product: "product-multiply",
    },
  },
  "probability-missing-count": { senses: { event: "event" } },
  "product-of-powers-exponent": {
    senses: {
      base: "base-exponent",
      factor: "factor-number",
      factors: "factor-number",
    },
  },
  "quadratic-context-model": {
    senses: {
      factor: "factor-number",
      side: "side",
      square: "square-number",
      terms: "term-expression",
      units: "unit",
      vertex: "vertex-parabola",
    },
  },
  "quadratic-expanded-solutions": {
    senses: {
      factor: "factor-number",
      factors: "factor-number",
      "left side": "side-of-equation",
      product: "product-multiply",
      root: "root-equation",
      roots: "root-equation",
      sides: "side-of-equation",
      term: "term-expression",
    },
  },
  "quadratic-factored-solutions": {
    senses: {
      factor: "factor-number",
      factors: "factor-number",
      "left side": "side-of-equation",
      product: "product-multiply",
      root: "root-equation",
      roots: "root-equation",
      sides: "side-of-equation",
    },
  },
  "quadratic-form-conversion": {
    senses: {
      factor: "factor-number",
      factors: "factor-number",
      product: "product-multiply",
      square: "square-number",
      squared: "square-number",
      "standard form": "standard-form-line",
      term: "term-expression",
      terms: "term-expression",
      vertex: "vertex-parabola",
    },
    noLink: ["opposite"],
  },
  "quadratic-formula-positive": {
    senses: {
      factor: "factor-number",
      "left side": "side-of-equation",
      opposite: "opposite-number",
      product: "product-multiply",
      side: "side-of-equation",
      sides: "side-of-equation",
      term: "term-expression",
    },
    noLink: ["part", "root", "whole"],
  },
  "quadratic-from-data": {
    senses: {
      change: "change",
      difference: "difference-subtract",
      differences: "difference-subtract",
      factor: "factor-number",
      "standard form": "standard-form-line",
      vertex: "vertex-parabola",
    },
    noLink: ["opposite"],
  },
  "quadratic-inequality-interval": {
    senses: {
      factor: "factor-number",
      opposite: "opposite-number",
      term: "term-expression",
    },
    noLink: ["side", "sides"],
  },
  "quadratic-irrational-solutions": {
    senses: {
      factor: "factor-number",
      factors: "factor-number",
      product: "product-multiply",
      square: "square-number",
      term: "term-expression",
    },
    noLink: ["part", "root", "roots"],
  },
  "quadratic-model-chain": {
    senses: { model: "model", vertex: "vertex-parabola" },
  },
  "quadratic-negative-output": {
    senses: {
      factor: "factor-number",
      factors: "factor-number",
      product: "product-multiply",
      "right side": "side-of-equation",
      side: "side-of-equation",
      sides: "side-of-equation",
    },
    noLink: ["rule"],
  },
  "quadratic-parameter-root": {
    senses: {
      factor: "factor-number",
      root: "root-equation",
      square: "square-number",
    },
  },
  "quadratic-real-solution-count": {
    senses: { squaring: "square-number", term: "term-expression" },
    noLink: ["part"],
  },
  "quadratic-root-relations": {
    senses: {
      factors: "factor-number",
      product: "product-multiply",
      sides: "side-of-equation",
    },
  },
  "quadratic-vertex": {
    senses: { vertex: "vertex-parabola" },
    noLink: ["square"],
  },
  "quartic-factored-form": {
    senses: {
      differences: "difference-subtract",
      factor: "factor-number",
      factors: "factor-number",
      product: "product-multiply",
      square: "square-number",
      squared: "square-number",
      squares: "square-number",
      terms: "term-expression",
    },
  },
  "quartile-list": {
    senses: {
      average: "mean-average",
      mean: "mean-average",
      "more than": "more-than",
      quarter: "fourth",
      quarters: "fourth",
    },
  },
  "quotient-of-powers-exponent": {
    senses: {
      base: "base-exponent",
      factor: "factor-number",
      factors: "factor-number",
    },
  },
  "radian-arc-ratio": { senses: { units: "unit" } },
  "radical-equation-check": {
    senses: {
      factor: "factor-number",
      "left side": "side-of-equation",
      opposite: "opposite-number",
      product: "product-multiply",
      "right side": "side-of-equation",
      side: "side-of-equation",
      sides: "side-of-equation",
      square: "square-number",
      squares: "square-number",
      squaring: "square-number",
      term: "term-expression",
      terms: "term-expression",
    },
    noLink: ["root"],
  },
  "radical-equation-isolated": {
    senses: {
      "left side": "side-of-equation",
      "right side": "side-of-equation",
      sides: "side-of-equation",
      square: "square-number",
      squaring: "square-number",
    },
    noLink: ["root"],
  },
  "radical-equation-shifted": {
    senses: {
      "right side": "side-of-equation",
      sides: "side-of-equation",
      square: "square-number",
      squaring: "square-number",
    },
    noLink: ["root"],
  },
  "radical-function-value": { noLink: ["root", "rule"] },
  "radical-side-entry": {
    senses: {
      factor: "factor-number",
      root: "root-radical",
      square: "square-number",
      squared: "square-number",
      squares: "square-number",
    },
    noLink: ["side", "sides"],
  },
  "random-variable-distribution": {
    senses: { event: "event" },
    noLink: ["certain", "leaves", "rule"],
  },
  "randomization-test-decision": {
    senses: {
      difference: "difference-subtract",
      differences: "difference-subtract",
      significant: "statistically-significant",
    },
  },
  "rate-combination-model": {
    senses: { average: "mean-average", changes: "change", unit: "unit" },
    noLink: ["net", "part", "whole"],
  },
  "rate-unit-chain": {
    senses: {
      changes: "change",
      factor: "factor-number",
      factors: "factor-number",
      product: "product-multiply",
      unit: "unit",
      units: "unit",
    },
  },
  "rational-abs-solution-count": {
    senses: {
      roots: "root-equation",
      side: "side-of-equation",
      sides: "side-of-equation",
    },
    noLink: ["intersection"],
  },
  "rational-equation-check": {
    senses: {
      identity: "identity-equation",
      "right side": "side-of-equation",
      sides: "side-of-equation",
      terms: "term-expression",
    },
  },
  "rational-equation-formulate": {
    senses: { change: "change", models: "model", unit: "unit" },
    noLink: ["part", "parts", "whole"],
  },
  "rational-equation-one-denominator": {
    senses: { identity: "identity-equation", sides: "side-of-equation" },
    noLink: ["rules"],
  },
  "rational-exponent-equation": {
    senses: {
      "left side": "side-of-equation",
      "right side": "side-of-equation",
      root: "root-equation",
      sides: "side-of-equation",
    },
  },
  "rational-exponent-product": {
    senses: {
      base: "base-exponent",
      factor: "factor-number",
      factors: "factor-number",
      product: "product-multiply",
      root: "root-radical",
      roots: "root-radical",
    },
    noLink: ["rules"],
  },
  "rational-expression-domain": {
    senses: {
      factor: "factor-number",
      factors: "factor-number",
      product: "product-multiply",
    },
    noLink: ["part"],
  },
  "rational-expression-operation": {
    senses: {
      factor: "factor-number",
      factors: "factor-number",
      product: "product-multiply",
      terms: "term-expression",
    },
  },
  "rational-expression-simplify": {
    senses: {
      factor: "factor-number",
      factors: "factor-number",
      product: "product-multiply",
      terms: "term-expression",
    },
    noLink: ["part", "parts"],
  },
  "rational-extraneous-single": {
    senses: {
      factor: "factor-number",
      "left side": "side-of-equation",
      "right side": "side-of-equation",
      sides: "side-of-equation",
    },
  },
  "rational-function-features": {
    senses: { factor: "factor-number", factors: "factor-number" },
    noLink: ["degree", "degrees", "hole", "leaves", "parts"],
  },
  "rational-function-representation": {
    senses: { sample: "sample" },
    noLink: ["impossible", "rule"],
  },
  "rational-inequality-solve": {
    senses: { change: "change" },
    noLink: ["interval", "intervals", "sides"],
  },
  "rational-power": {
    senses: { fourth: "fourth", root: "root-radical" },
    noLink: ["part"],
  },
  "rational-two-denominators": {
    senses: {
      factor: "factor-number",
      factors: "factor-number",
      product: "product-multiply",
      root: "root-equation",
      roots: "root-equation",
      side: "side-of-equation",
      sides: "side-of-equation",
      term: "term-expression",
    },
  },
  "rationalize-radical-denominator": {
    senses: { change: "change", factor: "factor-number" },
    noLink: ["root"],
  },
  "recursion-term-steps": {
    senses: {
      square: "square-number",
      term: "term-sequence",
      terms: "term-sequence",
    },
    noLink: ["rule", "third", "whole"],
  },
  "reference-angle-standard-position": {
    senses: {
      change: "change",
      multiple: "multiple",
      multiples: "multiple",
      vertex: "vertex",
    },
  },
  "regression-coefficient-meaning": {
    senses: {
      change: "change",
      changes: "change",
      degree: "degree-temperature",
      degrees: "degree-temperature",
      unit: "unit",
      units: "unit",
    },
    noLink: ["impossible"],
  },
  "regression-line-predict": {
    senses: {
      change: "change",
      difference: "difference-subtract",
      unit: "unit",
      units: "unit",
    },
  },
  "regression-prediction-select": {
    senses: {
      change: "change",
      changes: "change",
      range: "range-statistics",
      unit: "unit",
      units: "unit",
    },
  },
  "regular-polygon-area": {
    senses: {
      factor: "factor-number",
      side: "side",
      sides: "side",
      squared: "square-number",
      vertices: "vertex",
    },
    noLink: ["base", "center", "part", "square", "whole"],
  },
  "related-division-sentence": { noLink: ["side"] },
  "related-subtraction-sentence": {
    senses: { part: "part", whole: "whole" },
    noLink: ["leaves"],
  },
  "relative-frequency-percent": { noLink: ["part", "whole"] },
  "remainder-steps": {
    senses: { products: "product-multiply", term: "term-expression" },
    noLink: ["part"],
  },
  "remainder-theorem": {
    senses: { factor: "factor-number" },
    noLink: ["leaves"],
  },
  "remainder-zero-graph": {
    senses: { factor: "factor-number" },
    noLink: ["leaves"],
  },
  "repeated-zero-rule": {
    senses: {
      degree: "degree-polynomial",
      factor: "factor-number",
      factors: "factor-number",
      opposite: "opposite-number",
      square: "square-number",
      squared: "square-number",
    },
    noLink: ["rule"],
  },
  "repeating-decimal-to-fraction": {
    senses: { whole: "whole" },
    noLink: ["tail"],
  },
  "report-flaw-critique": {
    senses: {
      difference: "difference-subtract",
      "more than": "more-than",
      population: "population",
      sample: "sample",
      samples: "sample",
    },
    noLink: ["scales", "whole"],
  },
  "residual-function-fit": {
    senses: {
      differences: "difference-subtract",
      mean: "mean-average",
      model: "model",
    },
  },
  "rg-altitude-segment": {
    senses: { similar: "similar-figures" },
    noLink: ["part", "whole"],
  },
  "rg-exponent-monomial-power": {
    senses: { factor: "factor-number", product: "product-multiply" },
    noLink: ["whole"],
  },
  "rg-exponential-base-rate": {
    senses: {
      base: "base-exponent",
      change: "change",
      changes: "change",
      difference: "difference-subtract",
      factor: "factor-number",
      model: "model",
      period: "period",
      population: "population",
      unit: "unit",
      units: "unit",
    },
  },
  "rg-factor-completely": {
    senses: {
      difference: "difference-subtract",
      factor: "factor-number",
      factors: "factor-number",
      product: "product-multiply",
      square: "square-number",
      squared: "square-number",
      squares: "square-number",
      term: "term-sequence",
      terms: "term-sequence",
    },
  },
  "rg-isosceles-right-decimal": { noLink: ["side", "sides", "square"] },
  "rg-parallelogram-perpendicular": {
    senses: {
      degrees: "degree-angle",
      "opposite side": "opposite-side-angle",
      side: "side",
      vertex: "vertex",
    },
  },
  "rg-polynomial-build": {
    senses: {
      degree: "degree-polynomial",
      "standard form": "standard-form-polynomial",
      term: "term-sequence",
      terms: "term-sequence",
    },
  },
  "rg-polynomial-zeros-forms": {
    senses: {
      factor: "factor-number",
      factors: "factor-number",
      product: "product-multiply",
      terms: "term-expression",
    },
  },
  "rg-quadrilateral-choice": { noLink: ["opposite", "side", "sides"] },
  "rg-rational-exponent-forms": {
    senses: {
      base: "base-exponent",
      product: "product-multiply",
      root: "root-radical",
    },
    noLink: ["index", "part"],
  },
  "rg-segment-property-choice": { noLink: ["side", "sides", "third"] },
  "rg-solid-density": {
    senses: {
      change: "change",
      edge: "edge",
      side: "side",
      unit: "unit",
      units: "unit",
    },
    noLink: ["base", "part", "whole"],
  },
  "rg-triangle-area-sas": {
    senses: {
      degree: "degree-angle",
      product: "product-multiply",
      side: "side",
      sides: "side",
    },
    noLink: ["base", "mode"],
  },
  "rg-triangle-third-side-test": {
    senses: { difference: "difference-subtract", side: "side", sides: "side" },
    noLink: ["third"],
  },
  "ring-area-steps": {
    senses: { square: "square-number", squared: "square-number" },
  },
  "root-between-integers": { senses: { factor: "factor-number" } },
  "root-nearest-tenth": { senses: { squaring: "square-number" } },
  "same-base-equation": {
    senses: {
      base: "base-exponent",
      bases: "base-exponent",
      "left side": "side-of-equation",
      mean: "mean-average",
      "right side": "side-of-equation",
      side: "side-of-equation",
      sides: "side-of-equation",
    },
  },
  "same-share-different-shape": {
    senses: { part: "part", parts: "part" },
    noLink: ["squares"],
  },
  "sample-mean-estimate": {
    senses: {
      average: "mean-average",
      mean: "mean-average",
      population: "population",
      sample: "sample",
      units: "unit",
    },
    noLink: ["scale", "whole"],
  },
  "sample-size-margin": {
    senses: { population: "population", sample: "sample" },
    noLink: ["part"],
  },
  "sas-area-steps": {
    senses: {
      degree: "degree-angle",
      product: "product-multiply",
      side: "side",
      sides: "side",
      vertex: "vertex",
    },
    noLink: ["base", "mode", "square"],
  },
  "sat-entry-absolute-equation": {
    senses: {
      mean: "mean-average",
      opposite: "opposite-number",
      "right side": "side-of-equation",
      sides: "side-of-equation",
    },
  },
  "sat-entry-fn-exponential": {
    senses: {
      base: "base-exponent",
      change: "change",
      factor: "factor-number",
      period: "period",
      periods: "period",
      root: "root-radical",
      sides: "side-of-equation",
    },
  },
  "sat-entry-fn-linear-notation": {
    senses: {
      factor: "factor-number",
      multiple: "multiple",
      rule: "rule",
      sides: "side-of-equation",
      term: "term-expression",
    },
    noLink: ["balance", "whole"],
  },
  "sat-entry-fn-related-value": {
    senses: {
      factor: "factor-number",
      "left side": "side-of-equation",
      multiple: "multiple",
      multiples: "multiple",
      "right side": "side-of-equation",
      side: "side-of-equation",
      sides: "side-of-equation",
      term: "term-expression",
      terms: "term-expression",
    },
    noLink: ["scale", "whole"],
  },
  "sat-entry-inequality-integer": {
    senses: { range: "range-statistics", sides: "side-of-equation" },
    noLink: ["boundary", "whole"],
  },
  "sat-entry-polynomial-zeros": {
    senses: {
      change: "change",
      factor: "factor-number",
      factors: "factor-number",
      product: "product-multiply",
      square: "square-number",
      squared: "square-number",
    },
  },
  "sat-entry-quadratic-context": {
    senses: {
      factor: "factor-number",
      model: "model",
      product: "product-multiply",
      vertex: "vertex-parabola",
    },
    noLink: ["terms"],
  },
  "sat-entry-quadratic-solution": {
    senses: {
      factor: "factor-number",
      factors: "factor-number",
      "left side": "side-of-equation",
      product: "product-multiply",
      side: "side-of-equation",
      sides: "side-of-equation",
      square: "square-number",
      term: "term-sequence",
      terms: "term-sequence",
    },
    noLink: ["opposite"],
  },
  "sat-entry-radian-conversion": {
    senses: { degree: "degree-angle", degrees: "degree-angle", units: "unit" },
  },
  "sat-entry-radical-equation": {
    senses: {
      factor: "factor-number",
      "right side": "side-of-equation",
      side: "side-of-equation",
      sides: "side-of-equation",
      square: "square-number",
      squared: "square-number",
      squaring: "square-number",
    },
    noLink: ["root"],
  },
  "sat-entry-rate-numeric": {
    senses: { difference: "difference-subtract", unit: "unit" },
    noLink: ["balance", "net", "part"],
  },
  "sat-entry-rational-equation": {
    senses: {
      factor: "factor-number",
      products: "product-multiply",
      root: "root-equation",
      terms: "term-expression",
    },
  },
  "sat-entry-root-relations": {
    senses: {
      factors: "factor-number",
      product: "product-multiply",
      sides: "side-of-equation",
      term: "term-expression",
      terms: "term-expression",
    },
  },
  "sat-entry-system-expression": {
    senses: {
      difference: "difference-subtract",
      "left side": "side-of-equation",
      multiple: "multiple",
      "right side": "side-of-equation",
      side: "side-of-equation",
      sides: "side-of-equation",
    },
    noLink: ["scale", "whole"],
  },
  "sat-entry-system-solve": {
    senses: {
      opposite: "opposite-number",
      sides: "side-of-equation",
      term: "term-expression",
      terms: "term-expression",
    },
    noLink: ["leaves", "opposites"],
  },
  "sat-fn-constraint-choice": {
    senses: { products: "product-multiply", units: "unit" },
    noLink: ["parts"],
  },
  "sat-fn-exponential-choice": {
    senses: {
      base: "base-exponent",
      change: "change",
      factor: "factor-number",
      model: "model",
      period: "period",
      periods: "period",
      population: "population",
      root: "root-equation",
      unit: "unit",
      units: "unit",
    },
  },
  "sat-fn-line-equation-choice": {
    senses: {
      change: "change",
      changes: "change",
      unit: "unit",
      units: "unit",
    },
  },
  "scale-drawing-work": { senses: { unit: "unit" } },
  "scientific-notation-work": { senses: { average: "mean-average" } },
  "scientific-operations": {
    senses: {
      change: "change",
      factors: "factor-number",
      product: "product-multiply",
    },
    noLink: ["part"],
  },
  "scientific-times-larger": { senses: { factors: "factor-number" } },
  "scientific-to-standard": { noLink: ["standard form"] },
  "scope-of-inference-choice": {
    senses: {
      difference: "difference-subtract",
      differences: "difference-subtract",
      population: "population",
      sample: "sample",
    },
    noLink: ["balance"],
  },
  "section-revolution-solid": {
    senses: {
      center: "center",
      changes: "change",
      "opposite side": "opposite-side-angle",
      plane: "plane",
      side: "side",
      sides: "side",
    },
    noLink: ["base", "edge", "leaves", "solid"],
  },
  "sector-area-coefficient": {
    senses: {
      center: "center",
      degrees: "degree-angle",
      multiple: "multiple",
      "one quarter": "fourth",
      quarter: "fourth",
      square: "square-number",
      unit: "unit",
    },
    noLink: ["scales"],
  },
  "segment-partition": {
    senses: { change: "change", changes: "change" },
    noLink: ["part", "parts"],
  },
  "series-recursion": {
    senses: {
      average: "mean-average",
      change: "change",
      changes: "change",
      "more than": "more-than",
      rule: "rule",
      term: "term-sequence",
      terms: "term-sequence",
    },
    noLink: ["increasing", "jump"],
  },
  "share-remainder-fractions": { senses: { part: "part", parts: "part" } },
  "shift-function-notation": {
    senses: {
      change: "change",
      changes: "change",
      squared: "square-number",
      unit: "unit",
      units: "unit",
      vertex: "vertex",
    },
    noLink: ["opposite", "part", "rule", "whole"],
  },
  "shifted-polynomial-features": {
    senses: {
      factor: "factor-number",
      product: "product-multiply",
      unit: "unit",
      units: "unit",
      vertex: "vertex-parabola",
    },
    noLink: ["opposite"],
  },
  "shifted-trinomial-factor": {
    senses: {
      factor: "factor-number",
      factors: "factor-number",
      product: "product-multiply",
      terms: "term-expression",
    },
    noLink: ["whole"],
  },
  "show-work-rental-plans": { senses: { sides: "side-of-equation" } },
  "sigma-notation-represent": {
    senses: {
      difference: "difference-subtract",
      rule: "rule",
      term: "term-sequence",
      terms: "term-sequence",
    },
    noLink: ["index"],
  },
  "signed-changes-sum": { senses: { changes: "change" } },
  "signed-fraction-product": { senses: { factor: "factor-number" } },
  "signed-fraction-sum": { senses: { factor: "factor-number" } },
  "signed-quantity": { noLink: ["opposite"] },
  "similar-solid-scale-chain": {
    senses: {
      multiple: "multiple",
      square: "square-number",
      squares: "square-number",
    },
    noLink: ["cube", "scale", "scales", "similar", "similar solids"],
  },
  "similar-solid-volume": {
    senses: { edge: "edge", edges: "edge", square: "square-number" },
    noLink: ["cube", "factor", "scale", "scales", "similar solids"],
  },
  "similar-triangle-side": {
    senses: {
      "corresponding angles": "corresponding-angles",
      side: "side",
      sides: "side",
      similar: "similar-figures",
      square: "square-number",
      squared: "square-number",
    },
    noLink: ["factor", "scale", "scales", "similar triangles", "whole"],
  },
  "similar-triangles-work": {
    senses: {
      "corresponding angle": "corresponding-angles",
      "corresponding angles": "corresponding-angles",
      similar: "similar-figures",
    },
    noLink: ["factor", "side", "sides", "similar triangles", "third"],
  },
  "similarity-by-transformation": {
    senses: {
      factor: "factor-number",
      factors: "factor-number",
      image: "image-transformation",
      multiple: "multiple",
      side: "side",
      sides: "side",
      similar: "similar-figures",
      units: "unit",
      vertex: "vertex",
    },
    noLink: ["center", "scale", "similarity"],
  },
  "similarity-proof-aa": {
    senses: {
      "corresponding angles": "corresponding-angles",
      sides: "side",
      similar: "similar-figures",
      vertices: "vertex",
    },
    noLink: ["similar triangles", "similarity", "third"],
  },
  "similarity-theorem-length": {
    senses: {
      product: "product-multiply",
      side: "side",
      sides: "side",
      similar: "similar-figures",
      square: "square-number",
      vertices: "vertex",
    },
    noLink: ["similar triangles", "term", "terms", "whole"],
  },
  "simplify-square-root": {
    senses: {
      factor: "factor-number",
      product: "product-multiply",
      root: "root-radical",
      roots: "root-radical",
      square: "square-number",
    },
  },
  "simulation-consistency-check": {
    senses: { model: "model", sides: "side-of-equation", tail: "tail" },
    noLink: ["center"],
  },
  "sinusoid-compare-rule": {
    senses: {
      period: "period",
      periodic: "period",
      periods: "period",
      unit: "unit",
      units: "unit",
    },
    noLink: ["rule"],
  },
  "sinusoid-model": {
    senses: {
      average: "mean-average",
      center: "center",
      difference: "difference-subtract",
      model: "model",
      models: "model",
      period: "period",
      sides: "side",
      units: "unit",
    },
    noLink: ["part"],
  },
  "sinusoid-parameters": {
    senses: {
      change: "change",
      changes: "change",
      factor: "factor-number",
      period: "period",
      term: "term-expression",
      units: "unit",
    },
    noLink: ["center", "side", "whole"],
  },
  "skewed-box-compare": {
    senses: {
      mean: "mean-average",
      quarter: "fourth",
      range: "range-statistics",
      side: "side-of-equation",
      sides: "side-of-equation",
      tail: "tail",
    },
    noLink: ["center", "part", "parts"],
  },
  "solid-volume-context": {
    senses: {
      base: "base-shape",
      change: "change",
      factor: "factor-number",
      factors: "factor-number",
      solid: "solid-shape",
      solids: "solid-shape",
      square: "square-number",
      squared: "square-number",
      unit: "unit",
      units: "unit",
    },
    noLink: ["combination", "one third", "parts"],
  },
  "solution-coordinate": {
    senses: { sides: "side-of-equation", term: "term-expression" },
    noLink: ["part", "square", "whole"],
  },
  "solution-point-choice": {
    senses: { "right side": "side-of-equation", sides: "side-of-equation" },
  },
  "solve-by-completing-square": {
    senses: {
      factor: "factor-number",
      factors: "factor-number",
      "left side": "side-of-equation",
      "right side": "side-of-equation",
      side: "side-of-equation",
      sides: "side-of-equation",
      square: "square-number",
      term: "term-expression",
    },
    noLink: ["roots"],
  },
  "solve-justify-formula": {
    senses: { product: "product-multiply", rule: "rule" },
    noLink: ["base", "side", "sides", "term", "whole"],
  },
  "solve-justify-inequality": {
    senses: {
      side: "side-of-equation",
      sides: "side-of-equation",
      term: "term-expression",
      terms: "term-expression",
    },
    noLink: ["part", "rule"],
  },
  "solve-justify-linear": {
    senses: {
      "left side": "side-of-equation",
      rule: "rule",
      side: "side-of-equation",
      sides: "side-of-equation",
      term: "term-expression",
      terms: "term-expression",
    },
    noLink: ["balance", "part", "whole"],
  },
  "solve-justify-quadratic": {
    senses: {
      factor: "factor-number",
      factors: "factor-number",
      product: "product-multiply",
      rule: "rule",
      side: "side-of-equation",
      sides: "side-of-equation",
      term: "term-expression",
      terms: "term-expression",
    },
  },
  "solve-square-cube-equation": {
    senses: { factor: "factor-number", squaring: "square-number" },
  },
  "space-diagonal": {
    senses: {
      edge: "edge",
      edges: "edge",
      face: "face-solid",
      root: "root-radical",
      square: "square-number",
      squared: "square-number",
      squares: "square-number",
      vertices: "vertex",
    },
    noLink: ["base", "cube", "opposite", "side"],
  },
  "special-angle-exact-value": {
    senses: {
      degrees: "degree-angle",
      quarter: "fourth",
      tangent: "tangent-trig",
    },
    noLink: ["opposite", "plane", "whole"],
  },
  "special-angle-match": {
    senses: { complement: "complement-probability" },
    noLink: ["opposite"],
  },
  "special-right-triangle": {
    senses: { root: "root-radical", side: "side", sides: "side" },
    noLink: ["opposite"],
  },
  "special-triangle-in-figure": {
    senses: {
      degrees: "degree-angle",
      "opposite side": "opposite-side-angle",
      side: "side",
      sides: "side",
      units: "unit",
      vertex: "vertex",
    },
    noLink: ["center", "opposite", "square", "squares"],
  },
  "spherical-geometry-compare": {
    senses: {
      center: "center",
      change: "change",
      changes: "change",
      quarter: "fourth",
      sides: "side",
      vertex: "vertex",
      vertices: "vertex",
    },
    noLink: ["opposite", "plane"],
  },
  "square-root-extraneous": {
    senses: {
      factor: "factor-number",
      "right side": "side-of-equation",
      side: "side-of-equation",
      sides: "side-of-equation",
      square: "square-number",
      squared: "square-number",
      squaring: "square-number",
    },
  },
  "square-root-solutions-slots": {
    senses: {
      "right side": "side-of-equation",
      sides: "side-of-equation",
      square: "square-number",
      squared: "square-number",
    },
    noLink: ["root", "roots"],
  },
  "standard-deviation-compare": {
    senses: {
      change: "change",
      changes: "change",
      factor: "factor-number",
      mean: "mean-average",
      range: "range-statistics",
      squared: "square-number",
    },
    noLink: ["leaves"],
  },
  "step-reason-table": {
    senses: {
      opposite: "opposite-number",
      product: "product-multiply",
      sides: "side-of-equation",
    },
    noLink: ["whole"],
  },
  "story-graph-match": {
    senses: {
      changes: "change",
      decreasing: "decreasing",
      increasing: "increasing",
    },
    noLink: ["part"],
  },
  "strategy-expected-value": {
    senses: {
      average: "mean-average",
      "more than": "more-than",
      period: "period",
      units: "unit",
    },
  },
  "structure-meaning": {
    senses: {
      base: "base-exponent",
      change: "change",
      population: "population",
      rule: "rule",
      term: "term-expression",
      unit: "unit",
    },
    noLink: ["factor"],
  },
  "structure-rewrite": {
    senses: {
      factor: "factor-number",
      factors: "factor-number",
      product: "product-multiply",
      square: "square-number",
      squared: "square-number",
      squares: "square-number",
      squaring: "square-number",
      term: "term-sequence",
      terms: "term-sequence",
    },
  },
  "study-design-choice": {
    senses: {
      average: "mean-average",
      difference: "difference-subtract",
      differences: "difference-subtract",
    },
    noLink: ["balances"],
  },
  "study-design-classify": {
    senses: { average: "mean-average", difference: "difference-subtract" },
  },
  "substitute-into-equation": {
    senses: {
      changes: "change",
      factor: "factor-number",
      side: "side-of-equation",
      sides: "side-of-equation",
      term: "term-expression",
    },
    noLink: ["whole"],
  },
  "symbolic-rational-exponent": {
    senses: {
      base: "base-exponent",
      root: "root-radical",
      roots: "root-radical",
    },
    noLink: ["index"],
  },
  "system-equation-choice": { senses: { changes: "change", models: "model" } },
  "system-expression-value": {
    senses: {
      "left side": "side-of-equation",
      multiple: "multiple",
      "right side": "side-of-equation",
      sides: "side-of-equation",
      terms: "term-expression",
    },
    noLink: ["scale", "whole"],
  },
  "system-model-value": {
    senses: { quarters: "fourth", sides: "side-of-equation" },
    noLink: ["term", "terms"],
  },
  "table-standard-form": {
    senses: {
      change: "change",
      changes: "change",
      "left side": "side-of-equation",
      rule: "rule",
      "standard form": "standard-form-line",
      term: "term-expression",
      unit: "unit",
    },
  },
  "tally-and-t-chart": { senses: { difference: "difference-subtract" } },
  "tangent-circle-computation": {
    senses: {
      center: "center",
      tangent: "tangent-line",
      tangents: "tangent-line",
    },
    noLink: ["point of tangency", "side", "sides"],
  },
  "tangent-quadrant-cosine": {
    senses: { "opposite side": "opposite-side-angle", tangent: "tangent-trig" },
    noLink: ["opposite"],
  },
  "tenths-as-hundredths": { senses: { parts: "part", rename: "rename" } },
  "theoretical-distribution-expectation": {
    senses: {
      average: "mean-average",
      products: "product-multiply",
      units: "unit",
    },
  },
  "tide-cosine-equation": { senses: { period: "period" } },
  "total-and-cost-equation": {
    senses: { "right side": "side-of-equation" },
    noLink: ["whole"],
  },
  "transform-equation": {
    senses: { changes: "change", unit: "unit", units: "unit" },
    noLink: ["key", "solid", "whole"],
  },
  "transform-point": {
    senses: { changes: "change", opposite: "opposite-number" },
  },
  "transformation-composition-image": {
    senses: { change: "change", image: "image-transformation", units: "unit" },
    noLink: ["center", "scale", "scales"],
  },
  "transformation-invariant-claims": {
    senses: {
      change: "change",
      changes: "change",
      image: "image-transformation",
      similar: "similar-figures",
      square: "square-number",
      squared: "square-number",
      squares: "square-number",
      vertices: "vertex",
    },
    noLink: ["center", "factor", "factors", "plane", "scales", "side", "sides"],
  },
  "transformation-sequence-mapping": {
    senses: {
      changes: "change",
      image: "image-transformation",
      side: "side",
      similar: "similar-figures",
      vertex: "vertex",
      vertices: "vertex",
    },
  },
  "triangle-circle-centers": {
    senses: {
      center: "center",
      centers: "center",
      tangent: "tangent-trig",
      vertices: "vertex",
    },
    noLink: ["intersection", "opposite", "sides"],
  },
  "triangle-congruence-criteria": {
    senses: {
      plane: "plane",
      side: "side",
      sides: "side",
      vertex: "vertex",
      vertices: "vertex",
    },
    noLink: ["intersection", "leaves", "opposite", "part", "third", "whole"],
  },
  "triangle-law-reasoning": {
    senses: {
      "opposite side": "opposite-side-angle",
      term: "term-expression",
      terms: "term-expression",
      vertex: "vertex",
    },
    noLink: ["base", "opposite", "opposite leg", "side", "sides", "sort"],
  },
  "triangle-theorem-consequences": {
    senses: {
      "opposite side": "opposite-side-angle",
      side: "side",
      sides: "side",
      vertex: "vertex",
    },
    noLink: ["opposite", "third", "thirds"],
  },
  "triangle-uniqueness": { senses: { "more than": "more-than" } },
  "trig-context-triangle": {
    senses: {
      degree: "degree-angle",
      degrees: "degree-angle",
      "opposite side": "opposite-side-angle",
      tangent: "tangent-trig",
    },
    noLink: [
      "inverse",
      "mode",
      "opposite",
      "opposite leg",
      "part",
      "side",
      "sides",
    ],
  },
  "trig-equation-solutions": {
    senses: { period: "period", tangent: "tangent-trig" },
    noLink: ["interval", "leaves", "range", "side", "sides"],
  },
  "trig-identity-value": {
    senses: {
      complement: "complement-probability",
      difference: "difference-subtract",
      mean: "mean-average",
      product: "product-multiply",
      tangent: "tangent-trig",
      terms: "term-expression",
      unit: "unit",
    },
    noLink: ["identity", "opposite", "part", "parts", "rule", "side"],
  },
  "trig-leg-steps": {
    senses: { degree: "degree-angle", side: "side" },
    noLink: ["mode", "opposite", "opposite leg"],
  },
  "trig-ratio": {
    senses: {
      changes: "change",
      "opposite side": "opposite-side-angle",
      tangent: "tangent-trig",
    },
    noLink: ["opposite", "side", "sides", "tan", "third"],
  },
  "trig-symmetry-value": {
    senses: {
      change: "change",
      changes: "change",
      identity: "identity-equation",
      multiple: "multiple",
      multiples: "multiple",
      "opposite side": "opposite-side-angle",
      period: "period",
      tangent: "tangent-trig",
    },
    noLink: ["opposite", "rule", "whole"],
  },
  "trig-triangle-area": {
    senses: { degree: "degree-angle", units: "unit" },
    noLink: ["base", "mode", "side", "sides"],
  },
  "trinomial-product": {
    senses: {
      degree: "degree-polynomial",
      factor: "factor-number",
      factors: "factor-number",
      product: "product-multiply",
      products: "product-multiply",
      squaring: "square-number",
      term: "term-expression",
      terms: "term-expression",
    },
    noLink: ["third"],
  },
  "two-column-angle-proof": {
    senses: {
      "corresponding angle": "corresponding-angles",
      "corresponding angles": "corresponding-angles",
      side: "side",
    },
    noLink: ["opposite"],
  },
  "two-column-congruence-proof": {
    senses: { side: "side", sides: "side", vertices: "vertex" },
    noLink: ["opposite", "parts"],
  },
  "two-radical-equation": {
    senses: {
      "right side": "side-of-equation",
      side: "side-of-equation",
      sides: "side-of-equation",
      square: "square-number",
      squared: "square-number",
      squaring: "square-number",
      terms: "term-expression",
    },
    noLink: ["root", "standard form"],
  },
  "two-radical-steps": {
    senses: {
      difference: "difference-subtract",
      "right side": "side-of-equation",
      side: "side-of-equation",
      sides: "side-of-equation",
      square: "square-number",
      squared: "square-number",
      squaring: "square-number",
      term: "term-expression",
      terms: "term-expression",
    },
    noLink: ["part", "whole"],
  },
  "two-way-share": { noLink: ["part", "whole"] },
  "unit-chain-conversion": {
    senses: {
      change: "change",
      changes: "change",
      factor: "factor-number",
      squared: "square-number",
      unit: "unit",
      units: "unit",
    },
    noLink: ["edges", "side", "sides"],
  },
  "unit-circle-coordinate": {
    senses: { degrees: "degree-angle", side: "side" },
  },
  "unit-fraction-share": { senses: { part: "part", parts: "part" } },
  "unit-piece-size": {
    senses: { mean: "mean-average", part: "part", whole: "whole" },
  },
  "unit-size-and-count": { senses: { unit: "unit", units: "unit" } },
  "unlike-fraction-difference": {
    senses: { multiple: "multiple" },
    noLink: ["leaves"],
  },
  "vector-components": {
    senses: {
      change: "change",
      difference: "difference-subtract",
      differences: "difference-subtract",
      root: "root-radical",
      square: "square-number",
      tail: "tail",
    },
    noLink: ["opposite", "scale"],
  },
  "vector-resultant": {
    senses: {
      degree: "degree-angle",
      square: "square-number",
      tail: "tail",
      tangent: "tangent-trig",
    },
    noLink: ["opposite", "sides"],
  },
  "whole-number-equality-choice": { senses: { sides: "side-of-equation" } },
  "whole-sharing-fraction": { senses: { part: "part", parts: "part" } },
  "zero-multiplicity": {
    senses: {
      changes: "change",
      factor: "factor-number",
      sides: "side-of-equation",
      squared: "square-number",
    },
  },
  "zeros-from-factors": {
    senses: {
      factor: "factor-number",
      factors: "factor-number",
      opposite: "opposite-number",
      product: "product-multiply",
    },
  },
  "zeros-of-factored-product": {
    senses: {
      factor: "factor-number",
      factors: "factor-number",
      product: "product-multiply",
      square: "square-number",
    },
  },
};

/** The template with its glossary senses and no-link words merged in; the
 * template's own entries win. */
export function withTemplateGlossary(
  template: TemplateMetadata,
): TemplateMetadata {
  const g = glossary[template.id] ?? k8TemplateGlossary[template.id];
  if (!g) return template;
  return {
    ...template,
    glossarySenses: { ...g.senses, ...template.glossarySenses },
    glossaryNoLink: [
      ...new Set([...(g.noLink ?? []), ...(template.glossaryNoLink ?? [])]),
    ],
  };
}

/** Every template's sense map: 9–12 here, K–8 in `template-glossary-k8.ts`. */
export const templateGlossary: Readonly<typeof glossary> = {
  ...glossary,
  ...k8TemplateGlossary,
};
