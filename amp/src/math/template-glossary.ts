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
  "composition-value": { noLink: ["whole"] },
  "aa-similarity": {
    senses: { vertex: "vertex", vertices: "vertex" },
    noLink: [
      "image",
      "side",
      "sides",
      "similar",
      "similar triangles",
      "similarity",
      "third",
    ],
  },
  "abs-equals-linear-unique": { noLink: ["opposite", "rules", "side"] },
  "absolute-compound-inequality": {
    senses: { "more than": "more-than" },
    noLink: ["part", "parts"],
  },
  "absolute-value-affine-equation": {
    senses: { side: "side-of-equation", sides: "side-of-equation" },
    noLink: ["opposite", "whole"],
  },
  "absolute-value-direct-equation": {
    senses: { unit: "unit", units: "unit" },
    noLink: ["impossible", "side"],
  },
  "absolute-value-equation-formulate": {
    senses: { difference: "difference-subtract", units: "unit" },
    noLink: ["center", "right side", "side"],
  },
  "absolute-value-linear": { noLink: ["left side", "opposite", "right side"] },
  "absolute-value-transformed-equation": {
    noLink: ["left side", "right side", "side", "sides"],
  },
  "addition-rule-probability": {
    senses: {
      difference: "difference-subtract",
      events: "event",
      "more than": "more-than",
    },
    noLink: ["face", "rule"],
  },
  "addition-rule-steps": { noLink: ["events", "leaves"] },
  "angle-chase-chain": {
    senses: { degrees: "degree-angle", "more than": "more-than" },
    noLink: ["corresponding angles", "opposite", "side", "sides", "third"],
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
    senses: { change: "change", units: "unit" },
    noLink: ["center"],
  },
  "arc-length-coefficient": {
    senses: { multiple: "multiple", "one quarter": "fourth", unit: "unit" },
    noLink: ["boundary", "center", "degrees", "scales"],
  },
  "arc-sector-derivation": {
    senses: { multiple: "multiple", unit: "unit", units: "unit" },
    noLink: [
      "degrees",
      "factor",
      "factors",
      "scale",
      "scales",
      "similar",
      "square",
      "whole",
    ],
  },
  "area-probability": {
    senses: { center: "center", side: "side" },
    noLink: ["base", "part", "square", "whole"],
  },
  "arithmetic-distant-term": {
    senses: { differences: "difference-subtract" },
    noLink: ["decreasing", "term", "terms"],
  },
  "arithmetic-sequence-as-function": {
    senses: { changes: "change" },
    noLink: ["multiple", "part", "rule", "term", "terms", "third"],
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
    senses: { side: "side" },
    noLink: ["factor", "opposite", "product", "products", "term", "terms"],
  },
  "binomial-coefficient": {
    noLink: ["factors", "part", "product", "term", "terms"],
  },
  "budget-items-steps": {
    senses: { "more than": "more-than" },
    noLink: ["leaves"],
  },
  "budget-whole-items": {
    senses: { "more than": "more-than", sides: "side-of-equation" },
    noLink: ["multiple", "part", "whole"],
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
      side: "side",
      sides: "side",
      solid: "solid-shape",
      solids: "solid-shape",
    },
    noLink: ["base", "bases", "plane", "planes", "square"],
  },
  "change-of-base": {
    senses: { change: "change", factor: "factor-number" },
    noLink: ["base", "bases", "leaves", "product", "rule"],
  },
  "circle-angles": {
    senses: { degrees: "degree-angle", vertex: "vertex" },
    noLink: [
      "center",
      "factor",
      "side",
      "sides",
      "tangent",
      "tangent line",
      "tangents",
      "terms",
    ],
  },
  "circle-dilation-scaling": {
    senses: { changes: "change" },
    noLink: [
      "center",
      "centers",
      "factor",
      "image",
      "scales",
      "similar",
      "square",
    ],
  },
  "circle-equation": {
    senses: {
      change: "change",
      square: "square-number",
      squared: "square-number",
      squares: "square-number",
      squaring: "square-number",
      terms: "term-expression",
    },
    noLink: ["center", "opposite", "right side", "sides"],
  },
  "circle-estimate-blanks": { noLink: ["center", "edge"] },
  "circle-line-system": {
    noLink: [
      "intersections",
      "leaves",
      "part",
      "right side",
      "square",
      "squared",
    ],
  },
  "circle-radii-triangle": {
    senses: { degrees: "degree-angle" },
    noLink: ["center", "opposite", "sides"],
  },
  "circle-segment-lengths": {
    senses: { center: "center", change: "change" },
    noLink: [
      "intersection",
      "opposite",
      "part",
      "parts",
      "point of tangency",
      "product",
      "products",
      "sides",
      "similar triangles",
      "squared",
      "tangent",
      "tangent line",
      "tangents",
      "whole",
    ],
  },
  "clock-minute-match": { senses: { "more than": "more-than" } },
  "combination-count": {
    noLink: ["combination", "decreasing", "factors", "product"],
  },
  "combination-probability": { senses: { event: "event" } },
  "combine-square-roots": {
    noLink: ["factor", "factors", "parts", "root", "square", "term", "terms"],
  },
  "combine-unlike-radicals": {
    senses: { factor: "factor-number", product: "product-multiply" },
    noLink: ["root", "roots", "term"],
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
  "compare-fractions": { senses: { multiple: "multiple" }, noLink: ["rename"] },
  "compare-irrational-values": {
    noLink: ["root", "roots", "square", "squaring"],
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
    senses: { "more than": "more-than" },
    noLink: ["corresponding angles", "key", "sides"],
  },
  "compatible-number-estimate": { noLink: ["multiple", "multiples"] },
  "complementary-trig": {
    senses: {
      complement: "complement-probability",
      complements: "complement-probability",
      "opposite side": "opposite-side-angle",
    },
    noLink: ["opposite", "side", "sides"],
  },
  "complete-square-equation": {
    senses: { changes: "change", terms: "term-expression" },
    noLink: ["left side", "right side", "side", "sides", "square", "squared"],
  },
  "complete-square-first-steps": {
    senses: { change: "change", changes: "change" },
    noLink: ["factor", "product", "side", "sides", "term", "terms"],
  },
  "complete-square-monic": {
    senses: { change: "change", vertex: "vertex-parabola" },
    noLink: ["scales", "square", "squared", "terms"],
  },
  "complete-square-nonmonic": {
    senses: { change: "change", vertex: "vertex-parabola" },
    noLink: ["factor", "scales", "square", "squared", "term", "terms", "whole"],
  },
  "complete-square-step-property": {
    senses: { term: "term-expression" },
    noLink: [
      "balance",
      "factor",
      "left side",
      "opposite",
      "rule",
      "scale",
      "side",
      "sides",
    ],
  },
  "complete-square-term": {
    senses: { factors: "factor-number" },
    noLink: ["side", "sides", "square", "term"],
  },
  "complex-conjugate-division": {
    senses: {
      change: "change",
      changes: "change",
      square: "square-number",
      term: "term-sequence",
      terms: "term-sequence",
    },
    noLink: ["leaves", "opposites", "part", "product"],
  },
  "complex-distance-midpoint": {
    senses: {
      difference: "difference-subtract",
      differences: "difference-subtract",
      units: "unit",
    },
    noLink: [
      "average",
      "averages",
      "center",
      "left side",
      "plane",
      "square",
      "squares",
    ],
  },
  "complex-multiplication": {
    senses: { factor: "factor-number" },
    noLink: [
      "multiple",
      "part",
      "product",
      "products",
      "rule",
      "term",
      "terms",
    ],
  },
  "complex-parts": {
    senses: { term: "term-expression" },
    noLink: ["leaves", "multiple", "root"],
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
      quarter: "fourth",
    },
    noLink: [
      "argument",
      "opposite",
      "plane",
      "products",
      "rule",
      "scales",
      "side",
      "sides",
    ],
  },
  "complex-quadratic-factors": {
    senses: { terms: "term-expression" },
    noLink: [
      "factor",
      "factors",
      "opposite",
      "part",
      "parts",
      "product",
      "roots",
      "square",
      "squares",
      "whole",
    ],
  },
  "complex-quadratic-solve": {
    noLink: [
      "product",
      "right side",
      "roots",
      "side",
      "sides",
      "squared",
      "squares",
      "squaring",
    ],
  },
  "composition-expression": {
    noLink: ["square", "squared", "squares", "term", "whole"],
  },
  "composition-order-choice": {
    senses: { changes: "change" },
    noLink: ["commute", "commutes", "whole"],
  },
  "compound-event-simulation": {
    senses: { event: "event" },
    noLink: ["trial", "trials"],
  },
  "compound-growth": {
    senses: {
      change: "change",
      "one quarter": "fourth",
      quarters: "fourth",
      units: "unit",
    },
    noLink: ["balance", "factor", "factors", "period", "periods", "roots"],
  },
  "compound-unit-conversion": {
    senses: {
      changes: "change",
      squared: "square-number",
      unit: "unit",
      units: "unit",
    },
    noLink: ["cube", "factor", "parts", "square"],
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
    senses: { differences: "difference-subtract" },
    noLink: ["mean", "part", "whole"],
  },
  "conditional-probability-value": {
    senses: { multiple: "multiple" },
    noLink: ["event", "leaves", "part", "whole"],
  },
  "conditional-statements": {
    senses: { multiple: "multiple", sides: "side" },
    noLink: ["inverse", "parts", "square"],
  },
  "cone-section-name": {
    senses: { side: "side", sides: "side", vertex: "vertex" },
    noLink: ["intersection", "plane"],
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
    senses: { change: "change", changes: "change" },
    noLink: ["factor", "image", "images", "rule"],
  },
  "conic-foci": {
    senses: {
      difference: "difference-subtract",
      focus: "focus",
      vertices: "vertex",
    },
    noLink: ["center", "term"],
  },
  "conic-standard-form": {
    senses: {
      "standard form": "standard-form-line",
      term: "term-expression",
      terms: "term-expression",
    },
    noLink: [
      "center",
      "opposite",
      "parts",
      "right side",
      "sides",
      "square",
      "squared",
      "squares",
    ],
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
    senses: { multiple: "multiple", vertex: "vertex", vertices: "vertex" },
    noLink: ["opposite", "side", "sides", "square", "squared"],
  },
  "correlation-causation-choice": {
    senses: { change: "change" },
    noLink: ["factor", "opposite", "third"],
  },
  "correlation-choice": {
    senses: { model: "model" },
    noLink: ["jump", "rules"],
  },
  "corresponding-angle-transfer": {
    senses: {
      changes: "change",
      degrees: "degree-angle",
      side: "side",
      sides: "side",
      vertex: "vertex",
    },
    noLink: [
      "corresponding angle",
      "corresponding angles",
      "similar",
      "similar triangles",
      "similarity",
    ],
  },
  "count-relation-chain": {
    senses: { difference: "difference-subtract" },
    noLink: ["leaves", "term"],
  },
  "counterexample-choice": {
    senses: { product: "product-multiply", side: "side" },
    noLink: ["part", "parts", "square", "squares", "third"],
  },
  "crossing-segment-similarity": {
    senses: { side: "side", sides: "side", vertices: "vertex" },
    noLink: ["opposite", "similar", "similar triangles"],
  },
  "cube-root-equation": {
    noLink: [
      "cube",
      "cubes",
      "left side",
      "right side",
      "root",
      "side",
      "sides",
      "squaring",
    ],
  },
  "cubic-graph-statement": {
    senses: { changes: "change", factor: "factor-number" },
    noLink: ["decreasing", "increasing", "increasing intervals", "interval"],
  },
  "cubic-quotient-factored": {
    senses: { factor: "factor-number", product: "product-multiply" },
    noLink: ["leaves"],
  },
  "cubic-quotient-remainder": { noLink: ["opposite"] },
  "curved-solid-surface-area": {
    senses: {
      edge: "edge",
      side: "side",
      sides: "side",
      solids: "solid-shape",
    },
    noLink: ["base", "bases", "face", "faces", "square"],
  },
  "customary-unit-reverse": { noLink: ["whole"] },
  "decimal-both-sides-equation": {
    noLink: [
      "balance",
      "left side",
      "opposite",
      "right side",
      "rules",
      "side",
      "sides",
      "term",
      "terms",
    ],
  },
  "decimal-grid-read": { senses: { part: "part", whole: "whole" } },
  "decimal-rename-chain": { senses: { part: "part", parts: "part" } },
  "decompose-flat-shape": { senses: { side: "side" }, noLink: ["sides"] },
  "degree-radian-conversion": {
    senses: { change: "change", unit: "unit", units: "unit" },
    noLink: ["degrees"],
  },
  "density-context": {
    senses: { unit: "unit", units: "unit" },
    noLink: ["mean", "population", "square"],
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
    senses: { change: "change", factor: "factor-number" },
    noLink: ["leaves", "part", "period", "rule", "term"],
  },
  "dilation-measure": {
    senses: {
      change: "change",
      changes: "change",
      degrees: "degree-angle",
      sides: "side",
    },
    noLink: ["center", "factor", "image", "leaves", "scale"],
  },
  "eighths-and-parts-beyond-one": {
    senses: { part: "part", parts: "part" },
    noLink: ["eighth", "eighths", "whole"],
  },
  "elevation-depression-steps": {
    senses: { "opposite side": "opposite-side-angle" },
    noLink: ["base", "part", "parts", "tangent"],
  },
  "elimination-equivalent": {
    senses: { term: "term-expression", terms: "term-expression" },
    noLink: ["multiple", "opposites", "right side", "side", "sides"],
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
    senses: { whole: "whole" },
    noLink: ["balance", "left side", "side", "sides", "term", "terms"],
  },
  "equation-step-property": {
    senses: {
      changes: "change",
      rule: "rule",
      term: "term-expression",
      terms: "term-expression",
    },
    noLink: ["part", "side", "sides"],
  },
  "equivalent-denominator": { senses: { whole: "whole" } },
  "equivalent-fractions-select": {
    senses: { changes: "change", part: "part", parts: "part" },
  },
  "equivalent-numerator": { senses: { whole: "whole" } },
  "equivalent-trinomial-select": {
    senses: { changes: "change" },
    noLink: ["factor", "product", "products", "term", "terms"],
  },
  "event-complement-set": {
    noLink: ["complement", "complements", "event", "events", "intersection"],
  },
  "event-set-count": {
    senses: { event: "event", events: "event" },
    noLink: ["complement", "intersection", "sort", "whole"],
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
    senses: { range: "range-function", term: "term-expression" },
    noLink: ["base", "boundary", "model", "side"],
  },
  "exponential-initial-value": {
    senses: { model: "model" },
    noLink: ["factor"],
  },
  "exponential-log-solution": {
    senses: { side: "side-of-equation", sides: "side-of-equation" },
    noLink: ["balance", "base", "whole"],
  },
  "exponential-model-rule": {
    senses: { base: "base-exponent", factor: "factor-number" },
    noLink: ["leaves", "rule"],
  },
  "exponential-model-value": {
    senses: { unit: "unit" },
    noLink: ["balance", "factor", "key", "model", "whole"],
  },
  "exponential-overtakes": { senses: { changes: "change" }, noLink: ["whole"] },
  "exponential-parameter-log": {
    noLink: ["base", "factor", "parameters", "side", "sides"],
  },
  "exponential-parameters-blanks": {
    senses: { change: "change", model: "model" },
    noLink: ["base", "period"],
  },
  "exponential-passes-linear": {
    senses: { changes: "change", difference: "difference-subtract" },
    noLink: ["factor", "increasing", "rules", "whole"],
  },
  "exponential-points-statement": {
    senses: {
      difference: "difference-subtract",
      model: "model",
      units: "unit",
    },
    noLink: ["factor"],
  },
  "exponential-target-time": {
    noLink: ["leaves", "model", "part", "rule", "sides"],
  },
  "exponential-time-scale": {
    senses: {
      base: "base-exponent",
      change: "change",
      changes: "change",
      unit: "unit",
    },
    noLink: [
      "factor",
      "increasing",
      "index",
      "interval",
      "intervals",
      "model",
      "population",
      "root",
      "rule",
    ],
  },
  "exponential-time-steps": { noLink: ["model", "part", "sides"] },
  "expression-after-first-step": { noLink: ["part"] },
  "factor-large-trinomial": {
    senses: { product: "product-multiply" },
    noLink: ["factor", "factors", "term"],
  },
  "factor-out-choice": { senses: { part: "part" }, noLink: ["term"] },
  "fair-selection-procedure": {
    senses: { changes: "change", multiple: "multiple" },
    noLink: ["faces", "leaves"],
  },
  "fee-budget-inequality": {
    senses: { "more than": "more-than", units: "unit" },
    noLink: ["sides"],
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
  "fee-rule-choice": { senses: { rule: "rule" }, noLink: ["product", "terms"] },
  "find-equal-shares": { senses: { parts: "part" } },
  "find-equal-thirds": { senses: { parts: "part" } },
  "fl-even-odd-classify": {
    senses: { change: "change", changes: "change" },
    noLink: ["term", "terms"],
  },
  "fl-function-arithmetic": {
    senses: {
      change: "change",
      changes: "change",
      difference: "difference-subtract",
      factor: "factor-number",
      product: "product-multiply",
    },
    noLink: ["combination", "term"],
  },
  "fl-trapezoid-consequences": {
    senses: { average: "mean-average" },
    noLink: ["base", "bases", "sides"],
  },
  "fl-vector-angle": { senses: { multiple: "multiple" }, noLink: ["plane"] },
  "fl-vector-dot-product": { noLink: ["products"] },
  "formula-isolate": {
    senses: { product: "product-multiply" },
    noLink: ["side", "sides", "term", "terms"],
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
    senses: { base: "base-exponent", change: "change" },
    noLink: [
      "decreasing",
      "increasing",
      "inverse",
      "opposite",
      "range",
      "side",
    ],
  },
  "function-missing-input": { noLink: ["rule"] },
  "function-relation-test": {
    senses: { opposite: "opposite-number", squared: "square-number" },
    noLink: ["cube", "mean", "rule"],
  },
  "function-shift-sentence": {
    senses: { change: "change", units: "unit" },
    noLink: ["opposite"],
  },
  "gauss-3x3-solve": {
    senses: { term: "term-expression", terms: "term-expression" },
    noLink: [
      "combination",
      "degree",
      "leaves",
      "left side",
      "multiple",
      "multiples",
      "right side",
      "sides",
      "third",
    ],
  },
  "gcf-factor-sum": { noLink: ["factor"] },
  "geo-altitude-hypotenuse": {
    senses: { side: "side", sides: "side" },
    noLink: ["part", "parts", "similar", "similar triangles", "whole"],
  },
  "geo-altitude-ratio": {
    senses: { similar: "similar-figures" },
    noLink: ["opposite", "opposite side", "side", "sides", "tangent", "whole"],
  },
  "geo-arc-length-rounded": {
    senses: { sides: "side", unit: "unit", vertex: "vertex" },
    noLink: ["center", "degrees", "part", "whole"],
  },
  "geo-area-changing-transformation": {
    senses: { change: "change", changes: "change", side: "side" },
    noLink: [
      "base",
      "factor",
      "factors",
      "image",
      "mean",
      "part",
      "rule",
      "rules",
    ],
  },
  "geo-centroid-median": {
    senses: { vertex: "vertex" },
    noLink: [
      "balance",
      "median of a triangle",
      "one third",
      "opposite side",
      "part",
      "parts",
      "thirds",
      "whole",
    ],
  },
  "geo-circle-general-form": {
    senses: { term: "term-expression", terms: "term-expression" },
    noLink: [
      "center",
      "opposite",
      "right side",
      "side",
      "sides",
      "square",
      "squared",
      "squares",
    ],
  },
  "geo-complementary-trig-choice": {
    senses: { complement: "complement-probability" },
    noLink: ["opposite", "side", "sides", "third"],
  },
  "geo-density-rank": { noLink: ["population", "populations", "square"] },
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
    senses: { change: "change", changes: "change" },
    noLink: ["center", "image", "scale"],
  },
  "geo-elevation-depression": {
    senses: { "opposite side": "opposite-side-angle", tangent: "tangent-trig" },
    noLink: [
      "degree",
      "mode",
      "opposite",
      "opposite leg",
      "part",
      "parts",
      "whole",
    ],
  },
  "geo-equal-legs-radical": {
    senses: { side: "side", sides: "side", squared: "square-number" },
    noLink: ["factor", "similar", "similar triangles"],
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
    },
    noLink: ["base", "opposite", "tangent", "whole"],
  },
  "geo-line-pair-relationship": {
    senses: { term: "term-expression" },
    noLink: ["mean", "opposite", "plane", "product", "side", "standard form"],
  },
  "geo-line-point-slope-choice": {
    senses: { change: "change" },
    noLink: ["opposite", "product"],
  },
  "geo-motion-chain": {
    senses: {
      side: "side",
      sides: "side",
      vertex: "vertex",
      vertices: "vertex",
    },
    noLink: ["leaves", "mean"],
  },
  "geo-parallel-perimeter": {
    senses: { "corresponding angles": "corresponding-angles" },
    noLink: ["factor", "part", "side", "sides", "similar", "whole"],
  },
  "geo-parallel-segment-length": {
    noLink: ["part", "parts", "side", "sides", "whole"],
  },
  "geo-parallel-statement": {
    senses: { side: "side", sides: "side", vertex: "vertex" },
    noLink: [
      "corresponding angles",
      "mean",
      "opposite",
      "similar",
      "similar triangles",
    ],
  },
  "geo-parallelogram-sufficient": {
    senses: { side: "side", sides: "side" },
    noLink: ["opposite"],
  },
  "geo-polygon-rotation": {
    senses: { multiple: "multiple", multiples: "multiple", sides: "side" },
    noLink: ["center", "degrees", "square", "whole"],
  },
  "geo-reflection-side": {
    senses: { side: "side" },
    noLink: ["image", "images"],
  },
  "geo-rigid-statement": {
    senses: {
      change: "change",
      "corresponding angle": "corresponding-angles",
      mean: "mean-average",
      side: "side",
      sides: "side",
      vertices: "vertex",
    },
    noLink: ["image", "images", "similar"],
  },
  "geo-ring-area": {
    senses: { square: "square-number" },
    noLink: ["center", "edge", "side"],
  },
  "geo-sas-triangle-area": {
    senses: { side: "side", sides: "side", square: "square-number" },
    noLink: ["base", "degree", "mode"],
  },
  "geo-section-impossible": {
    senses: {
      edge: "edge",
      edges: "edge",
      face: "face-solid",
      faces: "face-solid",
      side: "side",
      sides: "side",
      solid: "solid-shape",
    },
    noLink: ["plane", "square"],
  },
  "geo-segment-partition-point": {
    senses: { change: "change" },
    noLink: ["part", "parts"],
  },
  "geo-sphere-diameter": {
    senses: { factor: "factor-number" },
    noLink: ["center", "cube", "square"],
  },
  "geo-trig-leg-degrees": {
    senses: { units: "unit" },
    noLink: ["degree", "degrees", "mode", "opposite", "side", "sides"],
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
      side: "side",
      sides: "side",
      solid: "solid-shape",
    },
    noLink: [
      "base",
      "boundary",
      "model",
      "models",
      "opposite",
      "part",
      "square",
      "whole",
    ],
  },
  "geometric-rule-forms": {
    senses: { term: "term-sequence", terms: "term-sequence" },
    noLink: ["jumps", "rule"],
  },
  "geometric-sequence": { noLink: ["factor", "factors", "term"] },
  "geometric-sequence-as-function": {
    senses: { change: "change" },
    noLink: ["multiple", "rule", "term", "terms", "third"],
  },
  "geometric-sequence-rule": {
    senses: { rule: "rule", squared: "square-number" },
    noLink: ["term", "terms"],
  },
  "geometric-series-sum": { noLink: ["term", "terms"] },
  "geometric-series-total": {
    senses: { term: "term-sequence", terms: "term-sequence" },
    noLink: ["period"],
  },
  "geometric-signed-term": { noLink: ["term", "terms"] },
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
    senses: { base: "base-exponent" },
    noLink: ["decreasing", "factor", "factors", "increasing"],
  },
  "graph-is-function": {
    senses: { "more than": "more-than" },
    noLink: ["plane"],
  },
  "graph-of-quadratic-or-exponential": {
    senses: { change: "change" },
    noLink: ["vertex"],
  },
  "graph-quadratic-points": {
    senses: { units: "unit", vertex: "vertex-parabola" },
    noLink: ["leaves", "opposite", "side", "sides"],
  },
  "graph-sqrt-points": { noLink: ["increasing", "root", "whole"] },
  "graphical-solution-table": {
    senses: { change: "change", changes: "change" },
    noLink: ["intersection", "intervals", "opposite", "side"],
  },
  "greatest-common-factor": { noLink: ["factor", "factors"] },
  "greatest-monomial-factor": {
    noLink: [
      "factor",
      "factors",
      "identity",
      "leaves",
      "product",
      "term",
      "terms",
    ],
  },
  "grouped-both-sides-solve": {
    senses: { changes: "change" },
    noLink: ["factor", "side", "sides", "term", "terms"],
  },
  "grouped-both-sides-steps": { noLink: ["side", "sides", "term", "terms"] },
  "growth-model-rewrite": {
    noLink: ["factor", "factors", "model", "period", "root"],
  },
  "half-plane-inequality": {
    noLink: ["boundary", "edge", "part", "plane", "side", "sides", "solid"],
  },
  "improper-fractional-part": { senses: { whole: "whole", wholes: "whole" } },
  "improper-whole-part": { senses: { whole: "whole", wholes: "whole" } },
  "independence-test": {
    senses: {
      change: "change",
      changes: "change",
      event: "event",
      events: "event",
    },
    noLink: ["mean", "whole"],
  },
  "independent-events-probability": {
    senses: {
      change: "change",
      event: "event",
      multiple: "multiple",
      tails: "tail",
    },
    noLink: ["complements", "cube"],
  },
  "inequality-both-sides-number-line": {
    senses: { rule: "rule" },
    noLink: ["boundary", "side", "sides", "terms"],
  },
  "inequality-solution-blanks": { noLink: ["rule", "side", "sides"] },
  "inequality-solution-point": { noLink: ["boundary", "solid"] },
  "infinite-geometric-sum": {
    senses: { term: "term-sequence", terms: "term-sequence" },
  },
  "inscribed-polygon-reasoning": {
    senses: { vertex: "vertex", vertices: "vertex" },
    noLink: ["center", "side", "sides", "square"],
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
    noLink: ["image", "inverse", "root", "side", "sides", "square", "vertex"],
  },
  "inverse-trig-value": {
    noLink: ["interval", "intervals", "inverse", "range", "tangent"],
  },
  "inverse-value": { noLink: ["inverse"] },
  "isolate-two-term-formula": {
    senses: { difference: "difference-subtract" },
    noLink: [
      "left side",
      "part",
      "right side",
      "side",
      "sides",
      "term",
      "terms",
      "whole",
    ],
  },
  "isosceles-perimeter-steps": {
    senses: { side: "side", sides: "side" },
    noLink: ["base", "tangent", "whole"],
  },
  "larger-share": { senses: { wholes: "whole" }, noLink: ["whole"] },
  "least-common-multiple": { noLink: ["multiple", "multiples"] },
  "like-fraction-difference": { senses: { whole: "whole" } },
  "like-fraction-missing-part": { senses: { part: "part" } },
  "line-angle-proof-reasons": { noLink: ["face", "opposite", "side", "sides"] },
  "line-equation-forms": {
    senses: {
      change: "change",
      changes: "change",
      "left side": "side-of-equation",
      sides: "side-of-equation",
    },
    noLink: ["factor", "standard form", "term", "terms"],
  },
  "line-relationship-equations": {
    senses: { change: "change" },
    noLink: ["product"],
  },
  "line-slope": { senses: { change: "change", changes: "change" } },
  "linear-model-equation": {
    senses: { change: "change", changes: "change", unit: "unit" },
    noLink: ["model", "models", "terms"],
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
      model: "model",
    },
    noLink: ["balance", "factor", "mean", "whole"],
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
    },
    noLink: ["parameter", "term", "terms", "whole"],
  },
  "log-base-fraction-graph": { noLink: ["base", "rule"] },
  "log-equation": {
    senses: {
      factor: "factor-number",
      factors: "factor-number",
      sides: "side-of-equation",
      terms: "term-expression",
    },
    noLink: ["argument", "base", "product", "rule"],
  },
  "log-expand": {
    senses: {
      difference: "difference-subtract",
      differences: "difference-subtract",
      root: "root-radical",
    },
    noLink: [
      "base",
      "combination",
      "factor",
      "multiples",
      "product",
      "products",
      "rules",
    ],
  },
  "log-exponential-form": { noLink: ["base", "part", "side"] },
  "log-rules-evaluate": {
    senses: { difference: "difference-subtract", multiple: "multiple" },
    noLink: ["argument", "base", "product", "products", "rule", "rules"],
  },
  "logarithm-integer": {
    senses: { factors: "factor-number" },
    noLink: ["base"],
  },
  "logarithm-value": {
    senses: { factors: "factor-number" },
    noLink: ["argument", "base", "root"],
  },
  "margin-of-error-interval": {
    senses: { mean: "mean-average", population: "population", units: "unit" },
    noLink: ["center", "interval", "parameter", "sample", "samples"],
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
    senses: { changes: "change" },
    noLink: [
      "commute",
      "factor",
      "factors",
      "inverse",
      "part",
      "product",
      "products",
      "rule",
      "rules",
    ],
  },
  "matrix-linear-system": {
    senses: {
      multiple: "multiple",
      product: "product-multiply",
      terms: "term-expression",
    },
    noLink: ["identity", "inverse", "right side", "sides"],
  },
  "matrix-operations": {
    senses: { differences: "difference-subtract" },
    noLink: ["product", "products", "scale", "whole"],
  },
  "matrix-transformation": {
    senses: { changes: "change", product: "product-multiply" },
    noLink: ["factor", "image", "images", "plane", "square"],
  },
  "mcas-circle-equation-select": {
    senses: { square: "square-number", units: "unit" },
    noLink: ["center", "left side", "opposite", "right side"],
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
    senses: { change: "change", changes: "change" },
    noLink: ["factor", "squared"],
  },
  "mcas-quadratic-zeros-select": { noLink: ["factor", "factors", "product"] },
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
    senses: { average: "mean-average", change: "change", changes: "change" },
    noLink: ["center", "right side", "side", "sides", "square", "squares"],
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
      unit: "unit",
      units: "unit",
    },
    noLink: ["leaves", "model", "sort"],
  },
  "model-residual-conclusion": {
    noLink: [
      "leaves",
      "model",
      "models",
      "range",
      "square",
      "squares",
      "squaring",
    ],
  },
  "monic-quadratic-factorization": {
    senses: { product: "product-multiply", products: "product-multiply" },
    noLink: ["factor", "factors", "opposite", "square", "term", "terms"],
  },
  "multidigit-decimal-quotient": { noLink: ["whole"] },
  "multidigit-decimal-sum": { senses: { changes: "change" } },
  "multiplication-rule-probability": {
    noLink: ["event", "events", "face", "part", "products", "rule"],
  },
  "multiply-fractions": {
    senses: { part: "part", parts: "part", whole: "whole" },
  },
  "multiply-square-roots": {
    noLink: [
      "factor",
      "factors",
      "product",
      "root",
      "roots",
      "square",
      "term",
      "terms",
    ],
  },
  "name-equal-share": {
    noLink: ["one quarter", "part", "parts", "quarters", "square"],
  },
  "name-share": {
    senses: { "one quarter": "fourth" },
    noLink: [
      "one third",
      "part",
      "parts",
      "quarters",
      "square",
      "thirds",
      "whole",
    ],
  },
  "negative-monomial-power": {
    senses: { product: "product-multiply" },
    noLink: ["factor", "factors"],
  },
  "nonlinear-data-model": {
    senses: { difference: "difference-subtract" },
    noLink: ["model", "square", "squared", "squaring"],
  },
  "nonlinear-formula-isolate": {
    senses: { product: "product-multiply" },
    noLink: [
      "factor",
      "factors",
      "root",
      "sides",
      "square",
      "squared",
      "whole",
    ],
  },
  "nonlinear-recursion-term": {
    noLink: ["rule", "square", "squares", "term", "terms", "whole"],
  },
  "nonlinear-system-count": {
    senses: { side: "side-of-equation", sides: "side-of-equation" },
    noLink: ["intersections", "part", "root", "roots", "terms"],
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
    senses: { product: "product-multiply" },
    noLink: ["factor", "root", "side", "sides", "terms"],
  },
  "nonmonic-complex-quadratic": {
    senses: {
      change: "change",
      side: "side-of-equation",
      sides: "side-of-equation",
    },
    noLink: ["factor", "part", "root", "square", "term"],
  },
  "nonmonic-quadratic-factorization": {
    senses: { opposite: "opposite-number" },
    noLink: ["factor", "factors", "product", "products", "term", "terms"],
  },
  "normal-model-rule": {
    senses: { model: "model" },
    noLink: [
      "average",
      "averages",
      "boundary",
      "center",
      "interval",
      "mean",
      "part",
      "rule",
      "scale",
      "side",
      "sides",
      "tail",
      "tails",
    ],
  },
  "normal-probability": { noLink: ["boundary", "mean", "rule", "sample"] },
  "number-line-between-hundreds": { senses: { "more than": "more-than" } },
  "number-line-jump-story": { senses: { jumps: "jump" }, noLink: ["jump"] },
  "number-system-closure-classify": {
    senses: {
      difference: "difference-subtract",
      differences: "difference-subtract",
    },
    noLink: [
      "argument",
      "factor",
      "impossible",
      "opposites",
      "product",
      "products",
      "rule",
      "sides",
    ],
  },
  "oblique-triangle-solve": {
    senses: { "opposite side": "opposite-side-angle", units: "unit" },
    noLink: ["degree", "faces", "mode", "opposite", "side", "sides", "third"],
  },
  "odd-sine-parameters": { senses: { multiple: "multiple" } },
  "one-sided-behavior-choice": {
    senses: { change: "change" },
    noLink: [
      "factor",
      "factors",
      "hole",
      "jump",
      "jumps",
      "rule",
      "side",
      "sides",
      "squared",
    ],
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
    },
    noLink: ["leaves", "mean"],
  },
  "parabola-axis": {
    senses: {
      factor: "factor-number",
      factors: "factor-number",
      product: "product-multiply",
    },
    noLink: ["average", "images", "standard form", "vertex"],
  },
  "parabola-axis-rule": {
    senses: { change: "change", sides: "side-of-equation" },
    noLink: ["opposite", "rule", "terms", "vertex"],
  },
  "parabola-axis-vertex-graph": {
    senses: { vertex: "vertex-parabola" },
    noLink: ["image", "sides"],
  },
  "parabola-focus-directrix": {
    senses: {
      average: "mean-average",
      squared: "square-number",
      unit: "unit",
      units: "unit",
      vertex: "vertex-parabola",
    },
    noLink: ["focus", "side"],
  },
  "parabola-shift": {
    senses: { unit: "unit", units: "unit", vertex: "vertex-parabola" },
    noLink: ["opposite", "solid", "square"],
  },
  "parabola-vertex": {
    senses: {
      changes: "change",
      term: "term-expression",
      vertex: "vertex-parabola",
    },
    noLink: [
      "base",
      "factor",
      "image",
      "opposite",
      "square",
      "squared",
      "standard form",
    ],
  },
  "parabola-vertex-distance": {
    senses: { unit: "unit", units: "unit", vertex: "vertex-parabola" },
    noLink: ["focus", "side"],
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
    senses: { difference: "difference-subtract", multiples: "multiple" },
    noLink: [
      "leaves",
      "left side",
      "parameter",
      "right side",
      "side",
      "sides",
      "term",
      "terms",
    ],
  },
  "parametric-linear-motion": {
    senses: { change: "change", changes: "change", unit: "unit" },
    noLink: ["decreasing", "increasing", "model", "sides", "terms"],
  },
  "parametric-rectangular-convert": {
    senses: { factor: "factor-number" },
    noLink: ["identity", "leaves", "parameter", "square", "terms"],
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
    noLink: ["decreasing", "factor", "factors", "product", "third"],
  },
  "perpendicular-slopes": {
    senses: { change: "change" },
    noLink: ["opposite", "product", "sides"],
  },
  "piecewise-evaluate": {
    senses: { changes: "change" },
    noLink: ["range", "boundary", "intervals", "rule", "rules"],
  },
  "piecewise-reading": { noLink: ["rule"] },
  "point-slope-two-points": { senses: { change: "change" } },
  "polar-cartesian-conversion": {
    senses: { change: "change", units: "unit" },
    noLink: ["face", "faces", "opposite"],
  },
  "polar-graph-identify": {
    senses: { change: "change" },
    noLink: ["leaves", "multiple", "range", "ranges", "term"],
  },
  "polygon-symmetry-counts": {
    senses: {
      quarter: "fourth",
      side: "side",
      sides: "side",
      vertex: "vertex",
      vertices: "vertex",
    },
    noLink: ["center", "leaves", "multiples", "opposite", "square"],
  },
  "polynomial-addition": { noLink: ["term", "terms"] },
  "polynomial-behavior-description": {
    senses: { changes: "change", product: "product-multiply" },
    noLink: ["degree", "factor", "factors", "opposite", "term", "terms"],
  },
  "polynomial-factoring-patterns": {
    senses: {
      differences: "difference-subtract",
      roots: "root-equation",
      squares: "square-number",
      term: "term-expression",
      terms: "term-expression",
    },
    noLink: [
      "cube",
      "cubes",
      "factor",
      "factors",
      "opposite",
      "product",
      "products",
    ],
  },
  "polynomial-graph-match": {
    senses: { degree: "degree-angle" },
    noLink: ["factor", "factors"],
  },
  "polynomial-identity-use": {
    senses: {
      changes: "change",
      difference: "difference-subtract",
      identity: "identity-equation",
    },
    noLink: [
      "factor",
      "identities",
      "left side",
      "product",
      "products",
      "sides",
      "square",
      "squares",
      "term",
      "terms",
    ],
  },
  "polynomial-inequality-solve": {
    senses: { change: "change", changes: "change" },
    noLink: ["factor", "interval", "intervals", "squared"],
  },
  "polynomial-multiplication": {
    senses: { base: "base-exponent" },
    noLink: [
      "factor",
      "factors",
      "product",
      "products",
      "square",
      "term",
      "terms",
    ],
  },
  "polynomial-product-steps": {
    noLink: [
      "factor",
      "factors",
      "parts",
      "product",
      "products",
      "side",
      "square",
      "squaring",
      "standard form",
      "term",
      "terms",
      "whole",
    ],
  },
  "polynomial-quotient": { noLink: ["degree"] },
  "polynomial-root-count": {
    noLink: ["degree", "factor", "factors", "leaves", "root", "roots"],
  },
  "polynomial-structure": {
    senses: {
      degree: "degree-polynomial",
      term: "term-expression",
      terms: "term-expression",
    },
  },
  "polynomial-subtraction": {
    senses: { change: "change", difference: "difference-subtract" },
    noLink: ["opposite", "term", "terms"],
  },
  "power-compare": {
    senses: { changes: "change", "more than": "more-than" },
    noLink: ["base", "factor", "factors"],
  },
  "power-doubling-story": { noLink: ["factor", "factors"] },
  "power-missing-exponent": { noLink: ["factor", "factors"] },
  "power-of-power-exponent": { noLink: ["base", "factor", "factors"] },
  "power-order-trap": {
    senses: {
      squared: "square-number",
      squares: "square-number",
      squaring: "square-number",
    },
    noLink: ["whole"],
  },
  "power-repeated-product": {
    senses: { base: "base-exponent", factor: "factor-number" },
    noLink: ["product", "products"],
  },
  "powers-of-i-sum": { noLink: ["terms"] },
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
  "prime-composite-sort": { noLink: ["factor", "factors"] },
  "prime-factorization-exponents": {
    senses: { product: "product-multiply" },
    noLink: ["factor", "factors"],
  },
  "prime-factorization-value": {
    senses: { base: "base-exponent" },
    noLink: ["factor", "factors", "product"],
  },
  "probability-missing-count": { noLink: ["event"] },
  "product-of-powers-exponent": { noLink: ["base", "factor", "factors"] },
  "quadratic-context-model": {
    senses: { factor: "factor-number", side: "side", units: "unit" },
    noLink: ["square", "terms", "vertex"],
  },
  "quadratic-expanded-solutions": {
    senses: { "left side": "side-of-equation", sides: "side-of-equation" },
    noLink: ["factor", "factors", "product", "root", "roots", "term"],
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
    senses: { product: "product-multiply" },
    noLink: [
      "factor",
      "factors",
      "opposite",
      "square",
      "squared",
      "standard form",
      "term",
      "terms",
      "vertex",
    ],
  },
  "quadratic-formula-positive": {
    noLink: [
      "factor",
      "left side",
      "opposite",
      "part",
      "product",
      "root",
      "side",
      "sides",
      "term",
      "whole",
    ],
  },
  "quadratic-from-data": {
    senses: {
      change: "change",
      difference: "difference-subtract",
      differences: "difference-subtract",
    },
    noLink: ["factor", "opposite", "standard form", "vertex"],
  },
  "quadratic-inequality-interval": {
    senses: { factor: "factor-number" },
    noLink: ["opposite", "side", "sides", "term"],
  },
  "quadratic-irrational-solutions": {
    senses: { square: "square-number" },
    noLink: ["factor", "factors", "part", "product", "root", "roots", "term"],
  },
  "quadratic-model-chain": { senses: { model: "model" }, noLink: ["vertex"] },
  "quadratic-negative-output": {
    senses: { product: "product-multiply" },
    noLink: ["factor", "factors", "right side", "rule", "side", "sides"],
  },
  "quadratic-parameter-root": { noLink: ["factor", "root", "square"] },
  "quadratic-real-solution-count": { noLink: ["part", "squaring", "term"] },
  "quadratic-root-relations": {
    senses: { factors: "factor-number", sides: "side-of-equation" },
    noLink: ["product"],
  },
  "quadratic-vertex": {
    senses: { vertex: "vertex-parabola" },
    noLink: ["square"],
  },
  "quartic-factored-form": {
    senses: { differences: "difference-subtract", product: "product-multiply" },
    noLink: ["factor", "factors", "square", "squared", "squares", "terms"],
  },
  "quartile-list": {
    senses: { "more than": "more-than", quarter: "fourth", quarters: "fourth" },
    noLink: ["average", "mean"],
  },
  "quotient-of-powers-exponent": { noLink: ["base", "factor", "factors"] },
  "radian-arc-ratio": { senses: { units: "unit" } },
  "radical-equation-check": {
    senses: { factor: "factor-number", product: "product-multiply" },
    noLink: [
      "left side",
      "opposite",
      "right side",
      "root",
      "side",
      "sides",
      "square",
      "squares",
      "squaring",
      "term",
      "terms",
    ],
  },
  "radical-equation-isolated": {
    noLink: ["left side", "right side", "root", "sides", "square", "squaring"],
  },
  "radical-equation-shifted": {
    noLink: ["right side", "root", "sides", "square", "squaring"],
  },
  "radical-function-value": { noLink: ["root", "rule"] },
  "radical-side-entry": {
    noLink: ["factor", "root", "side", "sides", "square", "squared", "squares"],
  },
  "random-variable-distribution": {
    noLink: ["certain", "event", "leaves", "rule"],
  },
  "randomization-test-decision": {
    senses: {
      difference: "difference-subtract",
      differences: "difference-subtract",
    },
    noLink: ["significant"],
  },
  "rate-combination-model": {
    senses: { changes: "change", unit: "unit" },
    noLink: ["average", "net", "part", "whole"],
  },
  "rate-unit-chain": {
    senses: { changes: "change", unit: "unit", units: "unit" },
    noLink: ["factor", "factors", "product"],
  },
  "rational-abs-solution-count": {
    senses: { roots: "root-equation" },
    noLink: ["intersection", "side", "sides"],
  },
  "rational-equation-check": {
    senses: { terms: "term-expression" },
    noLink: ["identity", "right side", "sides"],
  },
  "rational-equation-formulate": {
    senses: { change: "change", models: "model", unit: "unit" },
    noLink: ["part", "parts", "whole"],
  },
  "rational-equation-one-denominator": {
    noLink: ["identity", "rules", "sides"],
  },
  "rational-exponent-equation": {
    noLink: ["left side", "right side", "root", "sides"],
  },
  "rational-exponent-product": {
    senses: { factor: "factor-number", factors: "factor-number" },
    noLink: ["base", "product", "root", "roots", "rules"],
  },
  "rational-expression-domain": {
    senses: { factor: "factor-number", factors: "factor-number" },
    noLink: ["part", "product"],
  },
  "rational-expression-operation": {
    noLink: ["factor", "factors", "product", "terms"],
  },
  "rational-expression-simplify": {
    senses: { factor: "factor-number", factors: "factor-number" },
    noLink: ["part", "parts", "product", "terms"],
  },
  "rational-extraneous-single": {
    senses: { factor: "factor-number" },
    noLink: ["left side", "right side", "sides"],
  },
  "rational-function-features": {
    noLink: [
      "degree",
      "degrees",
      "factor",
      "factors",
      "hole",
      "leaves",
      "parts",
    ],
  },
  "rational-function-representation": {
    noLink: ["impossible", "rule", "sample"],
  },
  "rational-inequality-solve": {
    senses: { change: "change" },
    noLink: ["interval", "intervals", "sides"],
  },
  "rational-power": { senses: { fourth: "fourth" }, noLink: ["part", "root"] },
  "rational-two-denominators": {
    senses: {
      factor: "factor-number",
      factors: "factor-number",
      product: "product-multiply",
      term: "term-expression",
    },
    noLink: ["root", "roots", "side", "sides"],
  },
  "rationalize-radical-denominator": {
    senses: { change: "change" },
    noLink: ["factor", "root"],
  },
  "recursion-term-steps": {
    noLink: ["rule", "square", "term", "terms", "third", "whole"],
  },
  "reference-angle-standard-position": {
    senses: { change: "change", vertex: "vertex" },
    noLink: ["multiple", "multiples"],
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
      unit: "unit",
      units: "unit",
    },
    noLink: ["range"],
  },
  "regular-polygon-area": {
    senses: {
      side: "side",
      sides: "side",
      squared: "square-number",
      vertices: "vertex",
    },
    noLink: ["base", "center", "factor", "part", "square", "whole"],
  },
  "related-division-sentence": { noLink: ["side"] },
  "related-subtraction-sentence": {
    noLink: ["leaves", "part", "parts", "whole"],
  },
  "relative-frequency-percent": { noLink: ["part", "whole"] },
  "remainder-steps": {
    senses: { term: "term-expression" },
    noLink: ["part", "products"],
  },
  "remainder-theorem": { noLink: ["factor", "leaves"] },
  "remainder-zero-graph": {
    senses: { factor: "factor-number" },
    noLink: ["leaves"],
  },
  "repeated-zero-rule": {
    senses: { degree: "degree-polynomial" },
    noLink: ["factor", "factors", "opposite", "rule", "square", "squared"],
  },
  "repeating-decimal-to-fraction": {
    senses: { whole: "whole" },
    noLink: ["tail"],
  },
  "report-flaw-critique": {
    senses: {
      difference: "difference-subtract",
      "more than": "more-than",
      sample: "sample",
      samples: "sample",
    },
    noLink: ["population", "scales", "whole"],
  },
  "residual-function-fit": {
    senses: { differences: "difference-subtract" },
    noLink: ["mean", "model"],
  },
  "rg-altitude-segment": { noLink: ["part", "similar", "whole"] },
  "rg-exponent-monomial-power": { noLink: ["factor", "product", "whole"] },
  "rg-exponential-base-rate": {
    senses: {
      change: "change",
      changes: "change",
      difference: "difference-subtract",
      population: "population",
      unit: "unit",
      units: "unit",
    },
    noLink: ["base", "factor", "model", "period"],
  },
  "rg-factor-completely": {
    senses: { difference: "difference-subtract" },
    noLink: [
      "factor",
      "factors",
      "product",
      "square",
      "squared",
      "squares",
      "term",
      "terms",
    ],
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
    noLink: ["factor", "factors", "product", "terms"],
  },
  "rg-quadrilateral-choice": { noLink: ["opposite", "side", "sides"] },
  "rg-rational-exponent-forms": {
    senses: { product: "product-multiply" },
    noLink: ["base", "index", "part", "root"],
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
    senses: { product: "product-multiply", side: "side", sides: "side" },
    noLink: ["base", "degree", "mode"],
  },
  "rg-triangle-third-side-test": {
    senses: { difference: "difference-subtract", side: "side", sides: "side" },
    noLink: ["third"],
  },
  "ring-area-steps": { noLink: ["square", "squared"] },
  "root-between-integers": { senses: { factor: "factor-number" } },
  "root-nearest-tenth": { noLink: ["square", "squares", "squaring"] },
  "same-base-equation": {
    noLink: [
      "base",
      "bases",
      "left side",
      "mean",
      "right side",
      "side",
      "sides",
    ],
  },
  "same-share-different-shape": { noLink: ["part", "parts", "squares"] },
  "sample-mean-estimate": {
    senses: { population: "population", sample: "sample", units: "unit" },
    noLink: ["average", "mean", "scale", "whole"],
  },
  "sample-size-margin": {
    senses: { sample: "sample" },
    noLink: ["part", "population"],
  },
  "sas-area-steps": {
    senses: { side: "side", sides: "side", vertex: "vertex" },
    noLink: ["base", "degree", "mode", "product", "square"],
  },
  "sat-entry-absolute-equation": {
    senses: { mean: "mean-average", opposite: "opposite-number" },
    noLink: ["right side", "sides"],
  },
  "sat-entry-fn-exponential": {
    senses: {
      change: "change",
      period: "period",
      periods: "period",
      sides: "side-of-equation",
    },
    noLink: ["base", "factor", "root"],
  },
  "sat-entry-fn-linear-notation": {
    senses: {
      factor: "factor-number",
      multiple: "multiple",
      rule: "rule",
      sides: "side-of-equation",
    },
    noLink: ["balance", "term", "whole"],
  },
  "sat-entry-fn-related-value": {
    senses: {
      "left side": "side-of-equation",
      "right side": "side-of-equation",
      side: "side-of-equation",
      sides: "side-of-equation",
      term: "term-expression",
      terms: "term-expression",
    },
    noLink: ["factor", "multiple", "multiples", "scale", "whole"],
  },
  "sat-entry-inequality-integer": {
    noLink: ["boundary", "range", "sides", "whole"],
  },
  "sat-entry-polynomial-zeros": {
    senses: { change: "change" },
    noLink: ["factor", "factors", "product", "square", "squared"],
  },
  "sat-entry-quadratic-context": {
    senses: { model: "model", product: "product-multiply" },
    noLink: ["factor", "terms", "vertex"],
  },
  "sat-entry-quadratic-solution": {
    senses: { product: "product-multiply", square: "square-number" },
    noLink: [
      "factor",
      "factors",
      "left side",
      "opposite",
      "side",
      "sides",
      "term",
      "terms",
    ],
  },
  "sat-entry-radian-conversion": {
    senses: { units: "unit" },
    noLink: ["degree", "degrees"],
  },
  "sat-entry-radical-equation": {
    senses: { factor: "factor-number" },
    noLink: [
      "right side",
      "root",
      "side",
      "sides",
      "square",
      "squared",
      "squaring",
    ],
  },
  "sat-entry-rate-numeric": {
    senses: { difference: "difference-subtract", unit: "unit" },
    noLink: ["balance", "net", "part"],
  },
  "sat-entry-rational-equation": {
    senses: {
      factor: "factor-number",
      products: "product-multiply",
      terms: "term-expression",
    },
    noLink: ["root"],
  },
  "sat-entry-root-relations": {
    senses: { factors: "factor-number", sides: "side-of-equation" },
    noLink: ["product", "term", "terms"],
  },
  "sat-entry-system-expression": {
    senses: { difference: "difference-subtract", multiple: "multiple" },
    noLink: ["left side", "right side", "scale", "side", "sides", "whole"],
  },
  "sat-entry-system-solve": {
    senses: { term: "term-expression", terms: "term-expression" },
    noLink: ["leaves", "opposite", "opposites", "sides"],
  },
  "sat-fn-constraint-choice": {
    senses: { products: "product-multiply", units: "unit" },
    noLink: ["parts"],
  },
  "sat-fn-exponential-choice": {
    senses: {
      change: "change",
      population: "population",
      unit: "unit",
      units: "unit",
    },
    noLink: ["base", "factor", "model", "period", "periods", "root"],
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
    senses: { change: "change", factors: "factor-number" },
    noLink: ["part", "product"],
  },
  "scientific-times-larger": { senses: { factors: "factor-number" } },
  "scientific-to-standard": { noLink: ["standard form"] },
  "scope-of-inference-choice": {
    senses: {
      difference: "difference-subtract",
      differences: "difference-subtract",
    },
    noLink: ["balance", "population", "sample"],
  },
  "section-revolution-solid": {
    senses: {
      center: "center",
      changes: "change",
      "opposite side": "opposite-side-angle",
      side: "side",
      sides: "side",
    },
    noLink: ["base", "edge", "leaves", "plane", "solid"],
  },
  "sector-area-coefficient": {
    senses: {
      multiple: "multiple",
      "one quarter": "fourth",
      quarter: "fourth",
      unit: "unit",
    },
    noLink: ["center", "degrees", "scales", "square"],
  },
  "segment-partition": {
    senses: { change: "change", changes: "change" },
    noLink: ["part", "parts"],
  },
  "series-recursion": {
    senses: {
      change: "change",
      changes: "change",
      "more than": "more-than",
      term: "term-sequence",
      terms: "term-sequence",
    },
    noLink: ["average", "increasing", "jump", "rule"],
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
    },
    noLink: ["opposite", "vertex"],
  },
  "shifted-trinomial-factor": {
    senses: { terms: "term-expression" },
    noLink: ["factor", "factors", "product", "whole"],
  },
  "show-work-rental-plans": { noLink: ["side", "sides"] },
  "sigma-notation-represent": {
    senses: { difference: "difference-subtract" },
    noLink: ["index", "rule", "term", "terms"],
  },
  "signed-changes-sum": { senses: { changes: "change" } },
  "signed-fraction-product": { noLink: ["factor", "factors"] },
  "signed-fraction-sum": { noLink: ["factor"] },
  "signed-quantity": { noLink: ["opposite"] },
  "similar-solid-scale-chain": {
    senses: { multiple: "multiple" },
    noLink: [
      "cube",
      "scale",
      "scales",
      "similar",
      "similar solids",
      "square",
      "squares",
    ],
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
    },
    noLink: [
      "factor",
      "scale",
      "scales",
      "similar triangles",
      "square",
      "squared",
      "whole",
    ],
  },
  "similar-triangles-work": {
    noLink: [
      "corresponding angle",
      "corresponding angles",
      "factor",
      "side",
      "sides",
      "similar",
      "similar triangles",
      "third",
    ],
  },
  "similarity-by-transformation": {
    senses: {
      multiple: "multiple",
      side: "side",
      sides: "side",
      units: "unit",
      vertex: "vertex",
    },
    noLink: [
      "center",
      "factor",
      "factors",
      "image",
      "scale",
      "similar",
      "similarity",
    ],
  },
  "similarity-proof-aa": {
    senses: { sides: "side", similar: "similar-figures", vertices: "vertex" },
    noLink: [
      "corresponding angles",
      "similar triangles",
      "similarity",
      "third",
    ],
  },
  "similarity-theorem-length": {
    senses: { side: "side", sides: "side", vertices: "vertex" },
    noLink: [
      "product",
      "similar",
      "similar triangles",
      "square",
      "term",
      "terms",
      "whole",
    ],
  },
  "simplify-square-root": {
    noLink: ["factor", "product", "root", "roots", "square"],
  },
  "simulation-consistency-check": {
    senses: { sides: "side-of-equation" },
    noLink: ["center", "model", "tail"],
  },
  "sinusoid-compare-rule": {
    senses: { unit: "unit", units: "unit" },
    noLink: ["period", "periodic", "periods", "rule"],
  },
  "sinusoid-model": {
    senses: {
      average: "mean-average",
      center: "center",
      difference: "difference-subtract",
      sides: "side",
      units: "unit",
    },
    noLink: ["model", "models", "part", "period"],
  },
  "sinusoid-parameters": {
    senses: {
      change: "change",
      changes: "change",
      term: "term-expression",
      units: "unit",
    },
    noLink: ["center", "factor", "period", "side", "whole"],
  },
  "skewed-box-compare": {
    senses: { quarter: "fourth", tail: "tail" },
    noLink: ["center", "mean", "part", "parts", "range", "side", "sides"],
  },
  "solid-volume-context": {
    senses: {
      base: "base-shape",
      change: "change",
      solid: "solid-shape",
      solids: "solid-shape",
      square: "square-number",
      squared: "square-number",
      unit: "unit",
      units: "unit",
    },
    noLink: ["combination", "factor", "factors", "one third", "parts"],
  },
  "solution-coordinate": {
    senses: { sides: "side-of-equation", term: "term-expression" },
    noLink: ["part", "square", "whole"],
  },
  "solution-point-choice": {
    senses: { "right side": "side-of-equation", sides: "side-of-equation" },
  },
  "solve-by-completing-square": {
    noLink: [
      "factor",
      "factors",
      "left side",
      "right side",
      "roots",
      "side",
      "sides",
      "square",
      "term",
    ],
  },
  "solve-justify-formula": {
    senses: { product: "product-multiply", rule: "rule" },
    noLink: ["base", "side", "sides", "term", "whole"],
  },
  "solve-justify-inequality": {
    noLink: ["part", "rule", "side", "sides", "term", "terms"],
  },
  "solve-justify-linear": {
    senses: {
      "left side": "side-of-equation",
      side: "side-of-equation",
      sides: "side-of-equation",
    },
    noLink: ["balance", "part", "rule", "term", "terms", "whole"],
  },
  "solve-justify-quadratic": {
    senses: {
      product: "product-multiply",
      rule: "rule",
      side: "side-of-equation",
      sides: "side-of-equation",
    },
    noLink: ["factor", "factors", "term", "terms"],
  },
  "solve-square-cube-equation": {
    senses: { factor: "factor-number", squaring: "square-number" },
  },
  "space-diagonal": {
    senses: {
      edge: "edge",
      edges: "edge",
      face: "face-solid",
      vertices: "vertex",
    },
    noLink: [
      "base",
      "cube",
      "opposite",
      "root",
      "side",
      "square",
      "squared",
      "squares",
    ],
  },
  "special-angle-exact-value": {
    senses: { degrees: "degree-angle", quarter: "fourth" },
    noLink: ["opposite", "plane", "tangent", "whole"],
  },
  "special-angle-match": { noLink: ["complement", "opposite"] },
  "special-right-triangle": {
    senses: { root: "root-radical", side: "side", sides: "side" },
    noLink: ["opposite"],
  },
  "special-triangle-in-figure": {
    senses: {
      degrees: "degree-angle",
      side: "side",
      sides: "side",
      units: "unit",
      vertex: "vertex",
    },
    noLink: ["center", "opposite", "opposite side", "square", "squares"],
  },
  "spherical-geometry-compare": {
    senses: {
      change: "change",
      changes: "change",
      quarter: "fourth",
      sides: "side",
      vertex: "vertex",
      vertices: "vertex",
    },
    noLink: ["center", "opposite", "plane"],
  },
  "square-root-extraneous": {
    senses: { factor: "factor-number" },
    noLink: ["right side", "side", "sides", "square", "squared", "squaring"],
  },
  "square-root-solutions-slots": {
    noLink: ["right side", "root", "roots", "sides", "square", "squared"],
  },
  "standard-deviation-compare": {
    senses: { change: "change", changes: "change", mean: "mean-average" },
    noLink: ["factor", "leaves", "range", "squared"],
  },
  "step-reason-table": { noLink: ["opposite", "product", "sides", "whole"] },
  "story-graph-match": {
    senses: { changes: "change" },
    noLink: ["decreasing", "increasing", "part"],
  },
  "strategy-expected-value": {
    senses: {
      average: "mean-average",
      "more than": "more-than",
      units: "unit",
    },
    noLink: ["period"],
  },
  "structure-meaning": {
    senses: {
      base: "base-exponent",
      change: "change",
      population: "population",
      rule: "rule",
      unit: "unit",
    },
    noLink: ["factor", "term"],
  },
  "structure-rewrite": {
    noLink: [
      "factor",
      "factors",
      "product",
      "square",
      "squared",
      "squares",
      "squaring",
      "term",
      "terms",
    ],
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
      side: "side-of-equation",
      sides: "side-of-equation",
    },
    noLink: ["factor", "term", "whole"],
  },
  "symbolic-rational-exponent": { noLink: ["base", "index", "root", "roots"] },
  "system-equation-choice": {
    senses: { changes: "change" },
    noLink: ["models"],
  },
  "system-expression-value": {
    senses: { multiple: "multiple", terms: "term-expression" },
    noLink: ["left side", "right side", "scale", "sides", "whole"],
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
      unit: "unit",
    },
    noLink: ["rule", "standard form", "term"],
  },
  "tally-and-t-chart": { noLink: ["difference"] },
  "tangent-circle-computation": {
    noLink: [
      "center",
      "point of tangency",
      "side",
      "sides",
      "tangent",
      "tangents",
    ],
  },
  "tangent-quadrant-cosine": {
    senses: { "opposite side": "opposite-side-angle" },
    noLink: ["opposite", "tangent"],
  },
  "tenths-as-hundredths": { senses: { parts: "part" }, noLink: ["rename"] },
  "theoretical-distribution-expectation": {
    senses: {
      average: "mean-average",
      products: "product-multiply",
      units: "unit",
    },
  },
  "tide-cosine-equation": { noLink: ["period"] },
  "total-and-cost-equation": { noLink: ["right side", "whole"] },
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
      vertices: "vertex",
    },
    noLink: [
      "center",
      "factor",
      "factors",
      "plane",
      "scales",
      "side",
      "sides",
      "square",
      "squared",
      "squares",
    ],
  },
  "transformation-sequence-mapping": {
    senses: {
      changes: "change",
      side: "side",
      vertex: "vertex",
      vertices: "vertex",
    },
    noLink: ["image", "similar"],
  },
  "triangle-circle-centers": {
    senses: { center: "center", centers: "center", vertices: "vertex" },
    noLink: ["intersection", "opposite", "sides", "tangent"],
  },
  "triangle-congruence-criteria": {
    senses: {
      side: "side",
      sides: "side",
      vertex: "vertex",
      vertices: "vertex",
    },
    noLink: [
      "intersection",
      "leaves",
      "opposite",
      "part",
      "plane",
      "third",
      "whole",
    ],
  },
  "triangle-law-reasoning": {
    senses: { vertex: "vertex" },
    noLink: [
      "base",
      "opposite",
      "opposite leg",
      "opposite side",
      "side",
      "sides",
      "sort",
      "term",
      "terms",
    ],
  },
  "triangle-theorem-consequences": {
    senses: { side: "side", sides: "side", vertex: "vertex" },
    noLink: ["opposite", "opposite side", "third", "thirds"],
  },
  "triangle-uniqueness": { senses: { "more than": "more-than" } },
  "trig-context-triangle": {
    senses: { "opposite side": "opposite-side-angle" },
    noLink: [
      "degree",
      "degrees",
      "inverse",
      "mode",
      "opposite",
      "opposite leg",
      "part",
      "side",
      "sides",
      "tangent",
    ],
  },
  "trig-equation-solutions": {
    senses: { period: "period" },
    noLink: ["interval", "leaves", "range", "side", "sides", "tangent"],
  },
  "trig-identity-value": {
    senses: {
      complement: "complement-probability",
      difference: "difference-subtract",
      mean: "mean-average",
      tangent: "tangent-trig",
      terms: "term-expression",
      unit: "unit",
    },
    noLink: [
      "identity",
      "opposite",
      "part",
      "parts",
      "product",
      "rule",
      "side",
    ],
  },
  "trig-leg-steps": {
    senses: { side: "side" },
    noLink: ["degree", "mode", "opposite", "opposite leg"],
  },
  "trig-ratio": {
    senses: { changes: "change", tangent: "tangent-trig" },
    noLink: ["opposite", "opposite side", "side", "sides", "tan", "third"],
  },
  "trig-symmetry-value": {
    senses: {
      change: "change",
      changes: "change",
      identity: "identity-equation",
      tangent: "tangent-trig",
    },
    noLink: [
      "multiple",
      "multiples",
      "opposite",
      "opposite side",
      "period",
      "rule",
      "whole",
    ],
  },
  "trig-triangle-area": {
    senses: { degree: "degree-angle", units: "unit" },
    noLink: ["base", "mode", "side", "sides"],
  },
  "trinomial-product": {
    senses: { squaring: "square-number" },
    noLink: [
      "degree",
      "factor",
      "factors",
      "product",
      "products",
      "term",
      "terms",
      "third",
    ],
  },
  "two-column-angle-proof": {
    senses: { side: "side" },
    noLink: ["corresponding angle", "corresponding angles", "opposite"],
  },
  "two-column-congruence-proof": {
    senses: { side: "side", sides: "side", vertices: "vertex" },
    noLink: ["opposite", "parts"],
  },
  "two-radical-equation": {
    senses: { terms: "term-expression" },
    noLink: [
      "right side",
      "root",
      "side",
      "sides",
      "square",
      "squared",
      "squaring",
      "standard form",
    ],
  },
  "two-radical-steps": {
    senses: { difference: "difference-subtract" },
    noLink: [
      "part",
      "right side",
      "side",
      "sides",
      "square",
      "squared",
      "squaring",
      "term",
      "terms",
      "whole",
    ],
  },
  "two-way-share": { noLink: ["part", "whole"] },
  "unit-chain-conversion": {
    senses: {
      change: "change",
      changes: "change",
      unit: "unit",
      units: "unit",
    },
    noLink: ["edges", "factor", "side", "sides", "squared"],
  },
  "unit-circle-coordinate": {
    senses: { degrees: "degree-angle", side: "side" },
  },
  "unit-fraction-share": { senses: { part: "part", parts: "part" } },
  "unit-piece-size": {
    senses: { mean: "mean-average", part: "part", whole: "whole" },
  },
  "unit-size-and-count": { noLink: ["unit", "units"] },
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
    },
    noLink: ["opposite", "scale", "square", "tail"],
  },
  "vector-resultant": {
    senses: { degree: "degree-angle", square: "square-number", tail: "tail" },
    noLink: ["opposite", "sides", "tangent"],
  },
  "whole-number-equality-choice": { senses: { sides: "side-of-equation" } },
  "whole-sharing-fraction": { senses: { part: "part", parts: "part" } },
  "zero-multiplicity": {
    senses: { changes: "change", sides: "side-of-equation" },
    noLink: ["factor", "squared"],
  },
  "zeros-from-factors": {
    senses: { product: "product-multiply" },
    noLink: ["factor", "factors", "opposite"],
  },
  "zeros-of-factored-product": {
    noLink: ["factor", "factors", "product", "square"],
  },
};

/** The template with its glossary senses and no-link words merged in; the
 * template's own entries win. */
export function withTemplateGlossary(
  template: TemplateMetadata,
): TemplateMetadata {
  const hs = glossary[template.id],
    k8 = k8TemplateGlossary[template.id];
  if (!hs && !k8) return template;
  // The K–8 table decides for K–8 templates: its ordinary words are never linked.
  const senses = { ...hs?.senses, ...k8?.senses };
  for (const form of k8?.noLink ?? []) delete senses[form];
  return {
    ...template,
    glossarySenses: { ...senses, ...template.glossarySenses },
    glossaryNoLink: [
      ...new Set([
        ...(k8?.noLink ?? []),
        ...(hs?.noLink ?? []),
        ...(template.glossaryNoLink ?? []),
      ]),
    ],
  };
}

/** Every template's sense map: 9–12 here, K–8 in `template-glossary-k8.ts`. */
export const templateGlossary: Readonly<typeof glossary> = {
  ...glossary,
  ...k8TemplateGlossary,
};
