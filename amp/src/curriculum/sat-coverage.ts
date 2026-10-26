import { templates } from "../math/engine";
import { lessons } from "../content/lessons";
import { methods } from "../content/problem-methods";
import { SAT_PROFILE_VERSION, satPracticeEligible } from "./sat";

export const SAT_SOURCE = {
  url: "https://satsuite.collegeboard.org/media/pdf/assessment-framework-for-digital-sat-suite.pdf",
  title:
    "Assessment Framework for the Digital SAT Suite, version 4, September 2026",
  reviewedAt: "2026-10-23",
  location: "Appendix B, SAT column, printed pages 183–194, tables A35–A38",
};
export type SatDomain = "algebra" | "advanced-math" | "data" | "geometry";
// Local task IDs and original summaries. Each row identifies the actual
// mathematical action, not just a broad skill carrying a SAT tag.
const rows: Record<SatDomain, string> = {
  algebra: `
linear.solve|Solve signed, grouped, and fractional linear equations|grouped-linear-equation,rational-coefficient-equation,both-sides-linear-equation
linear.context|Choose a linear equation and solve a contextual model|linear-model-equation,linear-model-value
linear.meaning|Interpret a coefficient or initial value with units|structure-meaning,linear-initial-value-meaning,interpret-linear-parameters
linear.parameters|Find conditions for one, no, or infinitely many solutions|parameter-solution-count,equation-solution-count
linear.structure|Use equality and structure to simplify solving|equation-step-property,literal-equation-solve,sat-fn-related-value
function.rule|Recover a linear rule from observations or rate and point|linear-model-equation,unequal-step-rate,recover-linear-intercept,predict-linear-output,sat-fn-linear-notation
function.representations|Connect linear rules, tables, and graphs|compare-representations,average-rate-display
function.input-output|Evaluate or recover an input in a linear context|linear-model-value,formula-value,sat-fn-linear-notation
function.graph-context|Interpret a graph segment in context|distance-graph-meaning
line.constraint|Represent and solve a two-variable constraint|constraint-feasible,solution-coordinate,sat-fn-constraint-choice
line.equation|Connect a line with slope, a point, or a parallel/perpendicular line|perpendicular-slopes,graphed-line-slope,sat-fn-line-equation-choice
system.solve|Solve simultaneous linear equations with exact coordinates|linear-system-pair,sat-entry-system-solve
system.context|Model simultaneous constraints in context|system-model-value,shared-plan-input
system.classify|Classify linear systems and their intersections|linear-system-solution-count,elimination-equivalent
inequality.solve|Solve and interpret a one-variable inequality|affine-linear-inequality,grouped-linear-inequality,cancelled-linear-inequality,sat-entry-inequality-integer
inequality.context|Apply a constraint or whole-input boundary in context|first-cheaper-whole-input,constraint-feasible
inequality.graph|Connect an inequality and a half-plane or solution point|half-plane-inequality,inequality-solution-point
inequality.absolute|Solve absolute-value and compound inequalities, or choose one from a number-line description|absolute-compound-inequality
system.expression|Find the value of an expression in the variables by combining equations|system-expression-value,sat-entry-system-expression`,
  "advanced-math": `
expression.factor|Factor common factors, quadratic trinomials, and differences of squares|greatest-monomial-factor,nonmonic-quadratic-factorization,structure-rewrite,polynomial-factoring-patterns
expression.polynomial|Add, subtract, and multiply polynomials|polynomial-addition,polynomial-subtraction,polynomial-multiplication
expression.rational|Simplify and combine rational expressions on their original domain|rational-expression-simplify,rational-expression-operation
expression.radical|Connect symbolic roots and fractional exponents|symbolic-rational-exponent,rational-power
nonlinear.quadratic|Solve quadratics by factoring or the formula; rewrite by completing the square|quadratic-expanded-solutions,complete-square-nonmonic,quadratic-irrational-solutions,sat-entry-quadratic-solution,solve-by-completing-square
nonlinear.absolute|Solve absolute-value equations including degenerate cases|absolute-value-affine-equation,absolute-value-transformed-equation,sat-entry-absolute-equation
nonlinear.rational-radical|Solve rational and radical equations and reject excluded candidates|rational-equation-check,radical-equation-check,sat-entry-radical-equation,sat-entry-rational-equation,rational-extraneous-single,square-root-extraneous
nonlinear.polynomial-zeros|Find real zeros from a factored polynomial|zeros-from-factors,zero-multiplicity,sat-entry-polynomial-zeros
nonlinear.system|Solve and interpret line/nonlinear intersections|nonlinear-system-read,nonlinear-system-solve,nonlinear-system-count
nonlinear.root-count|Classify real roots and solve a repeated-root parameter condition|quadratic-real-solution-count,quadratic-parameter-root
nonlinear.root-relations|Use coefficients to find sums, products and missing values for quadratic solutions|quadratic-root-relations,sat-entry-root-relations
nonlinear.quadratic-from-data|Write a quadratic from zeros, a vertex or points|quadratic-from-data
nonlinear.literal|Isolate an unknown in a nonlinear formula with stated domain|nonlinear-formula-isolate
quadratic.context|Choose a quadratic model and interpret maximum, zero, or initial value|quadratic-context-model,sat-entry-quadratic-context
exponential.context|Build and use a growth, decay, or half-life model|exponential-model-rule,exponential-model-value,sat-fn-exponential-choice,sat-fn-exponential-numeric
exponential.form|Recognize equivalent time-scale forms and interpret factors|exponential-time-scale,compound-growth
nonlinear.features|Read vertex, symmetry, intercepts, and equivalent structural forms|parabola-vertex,parabola-axis,structure-meaning,quadratic-form-conversion
nonlinear.transform|Relate transformations to graphs, equations, and points|parabola-shift,transform-equation,transform-point
nonlinear.representations|Connect polynomial, quadratic, and exponential tables, graphs, and formulas|zeros-from-factors,exponential-model-rule,compare-representations
nonlinear.rational-representations|Connect a rational rule with a table or graph|rational-function-representation
nonlinear.input-output|Evaluate nonlinear functions or recover allowed inputs|function-evaluation,same-base-equation,rational-function-representation,radical-equation-isolated`,
  data: `
ratio.units|Convert length, compound rates, area, volume, density, and product units|metric-length-rename,compound-unit-conversion,unit-chain-conversion
ratio.proportion|Scale ratios and proportional quantities in context|ratio-missing,unit-price,proportional-rule-choice,variation-constant
ratio.rates|Combine work, mixture, average-speed and two-phase rates exactly|rate-combination-model,sat-entry-rate-numeric
percent.change|Calculate percentages, original values, and successive growth factors|percent-of,percent-change-original,successive-percent-change
univariate.displays|Read frequency data in dot plots, histograms, and box plots|dot-plot-mean,histogram-read,box-plot-read
univariate.center|Calculate or compare means, medians, and ranges|mean-data,median-data,range-data,mean-missing-value,frequency-table-center
univariate.spread|Compare standard deviations with equal or different means|standard-deviation-compare
univariate.outliers|Interpret the effects of an outlier on mean and median|outlier-center-shift,typical-value-choice
bivariate.scatter|Interpret association and read scatterplots|scatter-association-choice,correlation-choice
bivariate.linear-fit|Fit a linear candidate and use a trend line for prediction|nonlinear-data-model,trend-line-predict,regression-line-predict
bivariate.nonlinear-fit|Fit quadratic and exponential candidates to observed data|nonlinear-data-model,residual-function-fit
bivariate.interpret|Interpret a fitted coefficient or contextual graph|regression-coefficient-meaning,trend-slope-meaning
bivariate.growth|Compare linear and exponential change|linear-or-exponential,exponential-overtakes
probability.direct|Compute probabilities from equally likely outcomes|simple-probability,event-set-count
probability.conditional|Compute probabilities and conditional frequencies from two-way data|conditional-probability-value,relative-frequency-percent,conditional-frequency-choice,independence-test
probability.inverse|Recover a missing event count from a probability|probability-missing-count
inference.estimate|Use sample means and proportions to estimate a population quantity|sample-mean-estimate,sample-proportion-estimate
inference.margin|Interpret an error interval and sample-size effects|margin-of-error-interval,sample-size-margin
study.scope|Distinguish population generalization, causation, sampling bias, and assignment|scope-of-inference-choice,representative-sample-choice,causal-claim-choice`,
  geometry: `
measure.area|Find perimeter, area, missing lengths, and composite areas|rectangle-border-length,rectangle-missing-area-side,triangle-area-base-height,composite-area
measure.volume|Find solid volumes and missing dimensions|prism-missing-edge,cylinder-volume,cone-sphere-volume
measure.surface|Compute surface area from faces or nets|net-surface-area,composite-face-prism-surface-area
measure.scale|Connect similarity scale factors to lengths, areas, and volumes|dilation-measure,similar-triangle-side,similar-solid-volume
triangle.relationships|Use congruence and similarity, including sufficient conditions|triangle-congruence-criteria,similar-triangle-side,geometry-proof-step
angle.relationships|Apply triangle sums and parallel/transversal angle relationships|triangle-angle-sum,geometry-proof-step
triangle.pythagorean|Solve right triangles and recognize the converse|right-triangle,right-triangle-missing-leg,pythagorean-converse,space-diagonal
triangle.special|Apply special triangles and acute trigonometric ratios|special-right-triangle,trig-ratio,trig-context-triangle
triangle.complement|Use sine/cosine relationships of complementary angles|complementary-trig
circle.parts|Use radius, diameter, tangent, central, and inscribed angle relationships, plus chord, secant, and tangent segment lengths|circle-angles,circle-segment-lengths,circle-circumference-coefficient,circle-area-coefficient
circle.arc-sector|Find arc lengths, sector areas, and angles in radians|arc-length-coefficient,sector-area-coefficient,radian-arc-ratio
circle.unit-trig|Use special-angle unit-circle coordinates and signs|unit-circle-coordinate
circle.angle-units|Convert degrees and radians in both directions|degree-radian-conversion,sat-entry-radian-conversion
circle.coordinate|Read or create a circle equation, complete the square, and use distance or midpoint|circle-equation,midpoint-endpoint`,
};
export const satTasks = Object.entries(rows).flatMap(([domain, text]) =>
  text
    .trim()
    .split("\n")
    .map((row) => {
      const [id, task, families] = row.split("|");
      return {
        id: id!,
        domain: domain as SatDomain,
        task: task!,
        templateIds: families!.split(","),
      };
    }),
);
export function buildSatCoverage() {
  const errors: string[] = [];
  const seen = new Set<string>();
  const tasks = satTasks.map((task) => {
    if (seen.has(task.id)) errors.push(`Duplicate SAT task: ${task.id}`);
    seen.add(task.id);
    const families = task.templateIds.map((id) => {
      const template = templates.find((t) => t.id === id);
      if (!template) errors.push(`Unknown SAT family: ${id}`);
      else if (!satPracticeEligible(template))
        errors.push(`SAT task uses excluded family: ${id}`);
      const hasLesson = lessons.some((l) => l.templateIds.includes(id));
      if (!hasLesson || !methods[id])
        errors.push(`Missing SAT instruction: ${id}`);
      return {
        id,
        available: !!template,
        responseCapability: template?.requiredResponseCapability ?? "numeric",
        referenceLesson: hasLesson,
      };
    });
    return { ...task, families };
  });
  return {
    profileVersion: SAT_PROFILE_VERSION,
    source: SAT_SOURCE,
    valid: errors.length === 0,
    errors,
    tasks,
    limitations: [
      "This checklist maps bounded original practice to published SAT demands; it cannot enumerate future questions or certify score readiness.",
      "A mapped family does not establish coverage of every difficulty, context, graph, or combination within that task.",
      "Practice uses AMP answer controls and calculator, not an exact reproduction of the SAT testing application.",
    ],
  };
}
export function renderSatCoverage(report = buildSatCoverage()) {
  return [
    `# SAT Math practice coverage`,
    `Source: [${report.source.title}](${report.source.url}), ${report.source.location}. Reviewed ${report.source.reviewedAt}.`,
    `Structural audit valid: ${report.valid}.`,
    ...report.limitations,
    ``,
    `| Domain | Task | Problem families |`,
    `| --- | --- | --- |`,
    ...report.tasks.map(
      (t) => `| ${t.domain} | ${t.task} | ${t.templateIds.join(", ")} |`,
    ),
    ...report.errors,
  ].join("\n\n");
}
