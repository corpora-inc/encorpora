/** Task archetypes: the reusable join key between released assessment items,
 * standards and AMP problem families. One archetype is one distinct
 * mathematical task in one representation, never one per test. The list is
 * meant to grow into the union of task types across every audited source;
 * add an archetype only when no existing one names the task. Summaries are
 * original. */
export const archetypeDomains = [
  "number",
  "algebra",
  "advanced-math",
  "data",
  "geometry",
] as const;
export type ArchetypeDomain = (typeof archetypeDomains)[number];
export interface Archetype {
  id: string;
  domain: ArchetypeDomain;
  summary: string;
}
const rows: Record<ArchetypeDomain, string> = {
  number: `
number.multidigit-multiply-context|Multiply multidigit whole numbers in a one-step context
number.round-decimal|Round a decimal to a given place
number.inverse-rounding|Choose or find a number that rounds to a given decimal value
number.fraction-as-division|Recognize or use a fraction as the quotient of a whole-number division
number.decimal-expanded-compare|Write decimals in expanded form and compare decimals to thousandths
number.measurement-error-bound|Use an absolute or relative measurement-error bound`,
  algebra: `
expression.verbal|Translate a verbal description into an algebraic expression or equation
linear.solve|Solve a one-variable linear equation, including grouped and fractional coefficients
linear.structure|Find the value of a related linear expression from an equation by scaling or rearranging without isolating the variable
linear.step-justification|Name the property that justifies a step in solving an equation
linear.literal|Rearrange a linear formula or equation to isolate a named variable
linear.context|Write or solve a one-variable linear equation that models a context
linear.meaning|Interpret a coefficient, constant or point of a linear model in context
linear.parameters|Classify a linear equation's number of solutions or find a parameter giving none, one or infinitely many
function.rule|Write a linear function from a table, two points, or a rate and a point
function.input-output|Evaluate a linear function or find the input that gives an output
function.intercepts|Find an x- or y-intercept of a linear function from its rule
function.representations|Match a linear rule with its table or graph
function.graph-context|Interpret a point, segment or rate on a context graph
function.identify|Decide whether a relation given by points, a table or a graph is a function
function.point-removal|Decide which points to remove from a relation so it is a function
line.slope-equation|Find slope or intercept from a line's equation or graph, or write a line from slope and a point
line.parallel-perpendicular|Use slopes of parallel or perpendicular lines
line.constraint|Interpret or use a two-variable linear equation modeling a context
line.slope-triangles|Relate similar slope triangles on one line to equal slopes
system.solve|Solve a system of two linear equations algebraically
system.graph|Read the solution of a linear system from its graph
system.context|Write or solve a system of linear equations modeling a context
system.classify|Determine the number of solutions of a linear system or the parameter giving none or infinitely many
system.expression|Find an expression's value by combining the equations of a linear system
inequality.solve|Solve a one-variable linear inequality
inequality.context|Write or use a linear inequality modeling a context, including whole-number limits
inequality.graph|Connect a two-variable inequality or system of inequalities with its region or a solution point
inequality.absolute|Solve or choose an absolute-value or compound inequality`,
  "advanced-math": `
expression.polynomial|Add, subtract or multiply polynomials and combine like terms
expression.factor|Factor a polynomial or identify one of its factors
expression.exponent-rules|Simplify products and quotients of powers with integer exponents
expression.radical|Rewrite between radicals and rational exponents
expression.rational|Simplify or combine rational expressions
expression.coefficient-match|Find unknown constants by matching coefficients of equivalent expressions
expression.context-meaning|Interpret a factor, term or coefficient of a nonlinear expression in context, or choose the expression for a named quantity
nonlinear.quadratic|Solve a quadratic equation by square roots, factoring, the formula or completing the square
nonlinear.absolute|Solve an absolute-value equation
nonlinear.rational-radical|Solve a rational or radical equation and reject extraneous candidates
nonlinear.polynomial-zeros|Find real zeros of a polynomial from its factors
nonlinear.system|Solve or interpret a system of a linear and a nonlinear equation
nonlinear.root-count|Count real solutions of a quadratic or find a parameter giving one or no real solution
nonlinear.root-relations|Use coefficients to find the sum, product or a missing value of quadratic solutions
nonlinear.quadratic-from-data|Write a quadratic from its zeros, vertex or points
nonlinear.literal|Isolate a variable in a nonlinear formula
nonlinear.input-output|Evaluate a nonlinear function or find inputs that give an output
nonlinear.parameter-conditions|Deduce constants of a nonlinear function, or their signs, from a point and a condition on its outputs
function.value-meaning|Interpret a statement f(a) = b about a context model as an input-output pair with units
nonlinear.features|Read vertex, axis, intercepts or extreme values from a quadratic or polynomial rule or graph
nonlinear.transform|Relate translations and reflections of graphs to function rules and points
nonlinear.representations|Match a nonlinear rule with its table or graph
nonlinear.rational-representations|Connect a rational function rule with its table or graph
quadratic.context|Choose or use a quadratic model and interpret its maximum, zeros or initial value
exponential.context|Build, evaluate or find a parameter of an exponential growth or decay model
exponential.form|Interpret an exponential factor as a percent change per period or rewrite across time scales
exponential.features|Choose an equivalent exponential form that shows a stated value, such as the initial value, an intercept, an extreme or the value at another input, as a constant`,
  data: `
data.graph-read|Read values, extremes or changes from a bar graph, line graph or table
ratio.units|Convert units of length, rate, area, volume or density
ratio.proportion|Scale ratios, unit rates and proportional quantities in context
ratio.rates|Combine work, mixture or average-speed rates
percent.of|Find a percent of a quantity or what percent one quantity is of another
percent.change|Find a percent increase or decrease, a changed value or the original value
percent.successive|Apply successive percent changes with a changing base
univariate.displays|Read frequencies and summaries from dot plots, histograms or box plots
univariate.center|Calculate or compare means and medians
univariate.spread|Compare ranges or standard deviations of data sets
univariate.outliers|Describe how removing or adding a value changes mean, median or spread
univariate.grouped-bounds|Bound a mean or median from grouped or binned data
bivariate.scatter|Describe association or read points in a scatterplot
bivariate.linear-fit|Choose or use a line of best fit for prediction
bivariate.nonlinear-fit|Choose a quadratic or exponential model for observed data
bivariate.interpret|Interpret the slope or intercept of a fitted model in context
bivariate.growth|Distinguish or compare linear and exponential change
probability.direct|Compute a probability from equally likely outcomes or a frequency table
probability.conditional|Compute a conditional probability or relative frequency from two-way data
probability.inverse|Recover a missing count from a stated probability
inference.estimate|Use a sample proportion or mean to estimate a population quantity
inference.margin|Interpret an estimate with a margin of error or the effect of sample size
study.scope|Decide what a sample or study design supports: generalization, causation or bias`,
  geometry: `
measure.area|Find perimeters, areas or missing lengths of polygons and composite figures
measure.volume|Find volumes of solids or missing dimensions from a volume
measure.surface|Find surface areas of solids
measure.scale|Relate a scale factor to lengths, areas and volumes of similar figures
triangle.relationships|Use triangle congruence or similarity and their sufficient conditions
triangle.congruence-correspondence|Read corresponding parts from a congruence statement
triangle.congruence-transformations|Explain congruence through a sequence of rigid motions
angle.relationships|Use triangle angle sums and angles at intersecting or parallel lines
triangle.pythagorean|Use the Pythagorean theorem or its converse
triangle.special|Use 45-45-90 and 30-60-90 triangle relationships
triangle.trig-ratio|Find a sine, cosine or tangent ratio or a side of a right triangle
triangle.complement|Use the sine and cosine relationship of complementary angles
shape.quadrilateral-hierarchy|Classify quadrilaterals by inclusive categories and properties
circle.parts|Use radius, diameter, tangent, central and inscribed angle relationships
circle.arc-sector|Find arc lengths, sector areas and central angles
circle.unit-trig|Use unit-circle coordinates and signs of trigonometric values
circle.angle-units|Convert between degrees and radians
circle.coordinate|Read or write a circle's equation, including completing the square
coordinate.distance-midpoint|Use the distance or midpoint formula`,
};
export const archetypes: readonly Archetype[] = Object.entries(rows).flatMap(
  ([domain, text]) =>
    text
      .trim()
      .split("\n")
      .map((row) => {
        const [id, summary] = row.split("|");
        return {
          id: id!,
          domain: domain as ArchetypeDomain,
          summary: summary!,
        };
      }),
);
