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
  "arithmetic",
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
number.measurement-error-bound|Use an absolute or relative measurement-error bound
number.rational-irrational|Decide whether a sum or product of rational and irrational numbers is rational
number.repeating-decimal|Write a repeating decimal as a fraction
number.approximate-roots|Bound, approximate or order square and cube roots
number.scientific-notation|Convert between scientific notation and standard form
number.scientific-operations|Compare or compute with numbers in scientific notation
finance.budget-percent|Find budget amounts as percents of income
finance.check-register|Complete or reconcile a check register
finance.credit-concept|Recognize credit, borrowing and related financial terms
finance.fixed-variable-expense|Tell fixed from variable expenses in a budget
finance.income-compare|Compare earnings over several years
finance.simple-interest|Find simple interest or compare interest earned or paid
number.add-subtract-story|Solve an addition and subtraction story within 1000 that takes more than one step
number.decimal-fraction-equivalent|Write or match a decimal with a fraction or mixed number
number.decimal-model-operation|Match a decimal grid model with a multiplication or division equation
number.expanded-form-whole|Write or recognize a whole number as a sum of place-value amounts
number.fraction-benchmark-estimate|Estimate fraction sums or differences with benchmark fractions
number.fraction-equal-share|Name the fraction of a whole that each equal share receives
number.fraction-sum-expression|Write a sum of like fractions for a shaded or grouped amount
number.number-classification|Classify numbers as whole, integer or rational
number.number-line-equation|Match a number-line diagram with an addition or subtraction story
number.number-word-form|Write or read a number in word form
number.percent-fraction-decimal|Rename a percent as a decimal or fraction, or a fraction as a percent
number.place-value-ratio|Compare a digit's value in two places of a whole number or decimal
number.place-value-units|Write a number from counts of place-value units such as seventy hundreds
number.rational-operations|Compute with signed rational numbers in fraction and decimal forms
number.real-order|Order real numbers written as roots, fractions, decimals and percents
number.remainder-interpret|Interpret a division remainder in context
number.strip-diagram|Choose a strip diagram that models a story
number.inverse-round-whole|Choose the whole numbers that round to a stated ten or hundred
rational.negative-fraction-forms|Choose the expressions that equal a negative fraction`,
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
inequality.absolute|Solve or choose an absolute-value or compound inequality
line.slope-points|Find slope from two points on a line or a graph
line.graph-equation|Graph a line from its equation by placing two points
expression.order-of-operations|Evaluate an expression with parentheses and mixed operations
equation.graphical-solution|Solve f(x) = g(x) from a table or graph of two functions
pattern.rule|Generate terms of a number pattern from its rule or find a feature all terms share
pattern.paired|Pair terms of two patterns and state the relationship
function.relation-equation|Identify the dependent variable and write its equation from a context
function.linear-test|Decide which equation defines a linear or proportional function
equation.solution-point|Choose the point on the graph of an equation by testing ordered pairs
inequality.number-line|Match an inequality with its number-line graph
expression.multistep-equations|Choose the linked equations that model a two-step story
function.proportional-identify|Recognize a proportional relationship from a situation, table, graph or rule
inequality.solution-set|Decide which values or inequalities hold for a stated inequality
pattern.graph-relationship|Choose the graph of a rule or proportional relationship
system.from-graph|Choose the system of equations that two graphed lines show
expression.description-match|Match a numerical expression with its verbal description, or the reverse
function.graph-shape|Describe a graph as linear or nonlinear and increasing or decreasing
expression.parts-names|Name the coefficient, constant, exponent and variable of a term
line.slope-sign|Decide whether a slope is positive, negative, zero or undefined from how outputs change
expression.numerical-structure|Describe a numerical expression with parentheses as a multiple of a quantity without evaluating it`,
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
exponential.features|Choose an equivalent exponential form that shows a stated value, such as the initial value, an intercept, an extreme or the value at another input, as a constant
logarithm.solve|Solve an exponential or logarithmic equation and reject candidates outside the domain
logarithm.properties|Evaluate, expand or condense logarithms with the product, power and change-of-base rules
logarithm.evaluate|Evaluate a logarithm or translate between logarithmic and exponential form
sequence.series-sum|Find the sum of finitely many terms of a geometric series
sequence.geometric|Find a ratio, missing term or later term of a geometric sequence
sequence.rule-forms|Translate a geometric sequence between recursive and explicit rules or function notation
complex.arithmetic|Multiply or divide complex numbers with the conjugate
complex.form|Name parts of a+bi, simplify powers of i and write roots of negatives
complex.quadratic|Solve or factor quadratics with nonreal complex solutions
complex.root-count|Count complex roots of a polynomial with multiplicity and conjugate pairs
complex.plane|Read, add, find the modulus, distance or polar form of complex numbers in the plane
vector.components|Find components, magnitude, sums and scalar multiples of vectors
vector.resultant|Combine perpendicular velocities or forces into a resultant
matrix.data-read|Read entries, totals and dimensions of a data matrix
matrix.operations|Add, scale and multiply small matrices
matrix.properties|Use the identity matrix and which algebra laws hold for matrices
matrix.inverse|Find a 2x2 determinant and inverse
matrix.transformation|Apply a 2x2 matrix to points and areas
matrix.system|Write and solve a 2x2 linear system with matrices
conic.standard-form|Identify a conic from its equation and read centers and vertices
conic.parabola|Write a parabola from its focus and directrix
parametric.motion|Use parametric equations of linear motion
coordinate.polar|Convert between polar and Cartesian coordinates
trig.sinusoid-features|Read amplitude, period, midline, extremes and shift from a sinusoid's rule
trig.inverse|Evaluate inverse trigonometric functions within their restricted ranges
trig.equation|Solve or count solutions of a trigonometric equation on one turn
trig.identity|Use the Pythagorean, angle-sum and cofunction identities for exact values
trig.oblique-triangle|Find a side or angle of a non-right triangle with the law of sines or cosines
trig.triangle-area|Use area = half ab sin C for areas and missing sides
trig.sinusoid-model|Build a sinusoidal model from a maximum, minimum, period and start
expression.binomial-theorem|Find a coefficient or term in a binomial expansion
expression.radical-simplify|Simplify, combine or rationalize square-root expressions
expression.whole-powers|Evaluate, compare or match whole-number powers and repeated products
function.domain-range|Find the domain or range of a function from its graph or context
function.average-rate-change|Find the average rate of change of a function over an interval
expression.polynomial-division|Divide a polynomial by x minus a, or use the remainder theorem
function.piecewise|Read or write a piecewise function from its graph or absolute value
function.composition|Evaluate or write a composition of functions
function.inverse|Find an inverse function's value or expression
function.compare-representations|Compare features of functions given by a formula, a table or a graph
exponential.graph|Graph an exponential function from its rule
exponential.graph-features|Read the intercept, direction or asymptote of an exponential graph`,
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
study.scope|Decide what a sample or study design supports: generalization, causation or bias
data.fraction-line-plot|Read and compute with a line plot of fractional measurements
data.sort-count|Sort objects by kind and count or compare the groups
data.picture-graph|Answer total and comparison questions from a picture graph, scaled or not
ratio.purchase-compare|Compare total costs under whole-pack and divisible purchase rules
percent.benchmark-estimate|Estimate a tip, tax or discount from 10%, 5% and 25% benchmarks
distribution.normal|Use the empirical rule with a normal model
distribution.random-variable|Define a random variable and read its probability distribution
distribution.expectation|Find the expected value from a theoretical or observed distribution
distribution.decision|Compare expected payoffs to choose between strategies
probability.fair-selection|Choose a random procedure that gives everyone the same chance
inference.simulation|Judge a claim from a chart of simulated results
inference.randomization|Decide from a randomization distribution whether a difference is unusual
probability.counting-principle|Count outcomes of a sequence of independent choices by multiplying
probability.compound-event|Find a compound-event probability from a sample space or simulation
probability.permutations|Count ordered selections without repetition
probability.combinations|Count selections where order does not matter
probability.independent|Multiply probabilities of independent events or test whether events are independent
probability.event-sets|Read events written with or, and and not as regions of a sample space and count them
probability.addition-rule|Find P(A or B) with the addition rule
probability.multiplication-rule|Find P(A and B) with the multiplication rule or a tree
study.statistical-question|Choose the question that anticipates variability in its answers
univariate.compare-distributions|Compare the centers and spreads of two distributions
bivariate.categorical-association|Decide whether two categorical variables are associated from row percents
bivariate.correlation|Interpret the sign and strength of a correlation coefficient
data.frequency-table-read|Read counts from a tally or frequency table and compare them
data.graph-error|Find the mismatch between a described data set and its graph
data.percent-bar-graph|Read a percentage bar graph
data.stem-leaf-read|Read values or sums from a stem-and-leaf plot
data.table-to-graph|Match a table of paired values with its plotted points
probability.prediction|Predict how often an outcome occurs from a probability or a sample
ratio.part-whole|Find a part of a total from a part-to-part ratio
ratio.write-simplify|Write a ratio from quantities and simplify it
univariate.shape|Describe the shape or symmetry of a distribution from a display`,
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
coordinate.distance-midpoint|Use the distance or midpoint formula
measure.unit-cube-volume|Find a prism's volume by counting unit cubes or one layer of cubes
coordinate.first-quadrant|Locate, name or move to a point by ordered pair in the first quadrant
shape.name-flat|Name a flat shape or pick the one of a named kind among near misses
shape.name-solid|Name a solid shape and tell it from a flat shape
shape.compose|Name the shape that smaller shapes make or choose the piece that completes it
shape.attributes|Count sides, corners or angles of a polygon and name it or tell its defining attributes
shape.solid-parts|Count the faces, edges or vertices of a prism or pyramid
angle.measure|Measure an angle with a protractor or as a fraction of a full turn
angle.additive|Find a whole angle or a missing part from adjacent angles
angle.classify|Classify an angle or a triangle's angles as acute, right, obtuse or straight
line.terms|Name lines, rays and segments and tell parallel from perpendicular lines
shape.symmetry|Count or choose lines of symmetry of a shape
measure.space-diagonal|Find the longest segment in a rectangular box with the three-dimensional Pythagorean relation
measure.ruler|Read a length from a ruler, including a nonzero start and half or quarter marks
measure.area-vs-perimeter|Tell boundary from coverage and compare perimeter and area across rectangles
measure.rectangle-constraints|Choose or decide rectangles with whole-number sides meeting area and perimeter conditions
measure.metric-length|Convert between metric length units
measure.customary-units|Rename customary lengths, weights and capacities across units
measure.mixed-units|Add, subtract or rename mixed-unit measures such as meters and centimeters
measure.unit-choice|Choose the reasonable unit or measure for an everyday object
measure.area-distributive|Split a tiled rectangle to show the distributive property or find an L-shaped area
coordinate.four-quadrant|Plot signed coordinate pairs on a four-quadrant grid
transformation.image|Place or find the image of a point or figure under a translation, reflection or rotation
transformation.identify|Identify the rigid motion that maps one figure onto another
measure.model-choice|Choose the solid and the measure a real object or task needs
measure.design-constraint|Choose or cost the best design under a fixed perimeter, volume or fence
measure.cavalieri|Use Cavalieri's principle to find or compare volumes of oblique solids
solid.section-revolution|Name a cross-section or the solid made by rotating a plane figure
measure.fraction-volume|Find a prism's volume or missing edge when edges are fractions
coordinate.polygon-measure|Find side lengths, perimeter or area of a polygon from its vertex coordinates
transformation.dilation|Find the image of a point or figure under a dilation
triangle.inequality|Decide whether lengths can form a triangle or find the possible third side
triangle.uniqueness|Decide whether given sides and angles give no, one or many triangles
solid.cross-section|Name or measure the section where a plane slices a prism or pyramid
coordinate.segment-partition|Find the point that divides a segment in a given ratio
circle.circumference|Find a circumference or its coefficient of pi from a radius or diameter
measure.compare-attributes|Compare or order objects by length, weight or capacity
measure.equal-units|Measure a length by laying equal units end to end
measure.read-scale|Read a liquid level or balance on a measuring scale
measure.mass-volume-story|Solve a one-step story in grams, kilograms or liters
time.read-clock|Read an analog clock to the half hour or five minutes
time.match-clock|Pick the analog clock that shows a written time
time.elapsed|Find elapsed time between two clock times
proof.line-angle|Choose the reason or theorem in a line-and-angle proof step
proof.parallelogram|Choose the reason or consequence in a parallelogram or rectangle proof
proof.definitions|Choose the precise definition of a basic geometric figure
proof.measurement-formulas|Choose the step that justifies a circle, pyramid or cone formula by dissection
transformation.invariants|Decide which transformations preserve distance and angle
construction.compass-straightedge|Choose or order the steps of a compass and straightedge construction
circle.inscribed-centers|Choose the construction of a circumcenter or incenter or find angles of an inscribed quadrilateral
coordinate.quadrilateral-claims|Use slopes and distances to name the most specific quadrilateral from vertex coordinates
coordinate.plane-point|Name, locate or describe a point on the coordinate plane
measure.circle|Find a circle's circumference, area or diameter, or estimate pi
shape.attribute-classify|Sort shapes by attributes such as right angles and parallel sides
shape.parallel-perpendicular-sides|Count or identify parallel and perpendicular sides of polygons
shape.solid-properties|Compare faces, edges or parallel and congruent faces of solids
transform.rule|Match a transformation with its coordinate rule
measure.metric-mass-capacity|Convert between metric units of mass and capacity
shape.rotational-symmetry|Decide which figure has rotational symmetry`,
  arithmetic: `
number.estimate|Estimate sums, products or quotients by rounding or compatible numbers, or judge an answer by estimating
number.whole-unit-stories|Count whole kits, vehicles or leftovers when only whole units count
early.count-to-20|Count a set of up to twenty objects
early.add-within-20|Add two whole numbers with a sum at most twenty
early.make-ten|Add or subtract within twenty by making or passing through ten
early.subtract-within-20|Subtract within twenty
fractions.model|Express a shaded part of a whole as a fraction
fractions.add-subtract-unlike|Add or subtract fractions with unlike denominators, including distances on a number line
place.digit-value|Find the value of a digit or a missing part of an expanded form
place.base-ten-model|Compose a number from a base-ten model or regroup tens and ones
decimal.add-subtract|Add decimals to hundredths
decimal.multiply|Multiply decimals in tenths
money.budget|Use income, expenses, deductions and net pay in dollars and cents
fractions.compare|Choose the greater or lesser of two fractions
fractions.multiply|Multiply two proper fractions
fractions.divide|Divide a fraction by a fraction
fractions.divide-context|Measure or share a fractional amount among containers or people
fractions.multiply-whole|Find a fraction of a set or the total of equal fractional portions
rational.signed-add|Add and subtract signed integers and fractions
rational.order-absolute|Order signed numbers, use absolute value as size and find distance between signed numbers
number.divisibility|Apply divisibility rules to choose a divisible number
number.prime-composite|Tell prime, composite and neither among whole numbers
number.prime-factorization|Write, evaluate or use a prime factorization with exponents
number.factor-pairs|Complete a factor pair of a whole number
money.change|Find change, totals, amounts needed or money left in dollars and cents
money.fewest-coins|Find the fewest bills and coins that make an amount of change
money.compare-sets|Compare drawn sets of bills and coins or choose the set worth an exact amount
money.count-coins|Find the value of a group of coins and bills or what it needs to make a dollar
early.add-within-100|Add two two-digit numbers or find the number that makes one hundred
early.subtract-within-100|Subtract a two-digit number from a number up to 100
whole.add-subtract-1000|Add or subtract three-digit numbers with regrouping
whole.add-subtract-multidigit|Add or subtract whole numbers of four to six digits
early.compare-groups|Tell which of two groups of objects has more, fewer or the same
place.compare-whole|Compare two whole numbers and choose the greater, lesser or true symbol statement
number.round-whole|Round a whole number to the nearest ten, hundred, thousand or ten thousand
early.count-sequence|Find a missing number when counting by ones or tens or on a hundred chart
early.number-line-hops|Add, subtract or measure a distance with hops on a number line
place.powers-of-ten|Multiply or divide a number by 10, 100 or 1,000
whole.multiply-one-digit|Multiply a multidigit number by a one-digit number or a multiple of ten
whole.multiply-area-model|Multiply two-digit numbers with an area model and partial products
whole.divide-one-digit|Divide by a one-digit divisor and find the remainder
whole.divide-two-digit|Divide a three- or four-digit number by a two-digit divisor
early.count-on-back|Count on or back from a number to add or subtract
early.add-subtract-tens-hundreds|Add or subtract 10 or 100 mentally
whole.multiplication-facts|Multiply one-digit factors from an equation, array or story
whole.division-facts|Divide within 100 using the related multiplication fact
whole.missing-factor|Find the unknown factor, group size or dividend in a multiplication or division equation
whole.division-meaning|Find the size of each share, the number of groups or the number of pieces
whole.multiplication-patterns|Use patterns in a multiplication table or growing array
early.number-bonds|Find the missing part of a number through ten
early.missing-addend|Find a missing addend within twenty from a story or equation
early.equality|Find the number that balances an addition equation
early.three-addends|Add three one-digit numbers
early.two-step-story|Solve a two-step joining and separating story within one hundred
number.gcf|Find or use the greatest common factor of whole numbers
number.lcm|Find or use the least common multiple of whole numbers
rational.opposites|Write a signed number for a quantity or find the opposite of a number
rational.signed-context|Add signed decimal changes in a context or on a number line
whole.multiplicative-stories|Choose the operation or equation for an equal-groups, array or measurement story
rational.signed-multiply|Multiply or divide signed fractions
fractions.complex|Simplify a fraction whose numerator or denominator contains fractions
fractions.equal-shares|Pick the shape cut into halves, thirds or fourths among unequal cuts
fractions.name-equal-share|Name the shaded part of a shape cut into equal parts
fractions.compare-shares|Compare equal shares of same-size wholes
fractions.partition-area|Name or find the area of one equal-area part of a rectangle
decimal.read-model|Name a decimal from a tenths strip, hundredths grid or number line, or rename tenths as hundredths
decimal.divide|Divide a decimal by a decimal with a terminating quotient
fractions.number-line|Read a fraction at a point on a number line
fractions.equivalent|Rename a fraction or whole number as an equivalent fraction
fractions.add-subtract-like|Add or subtract fractions and mixed numbers with a common denominator
fractions.mixed-improper|Convert between mixed numbers and improper fractions
early.array-total|Count the squares in a small array
early.odd-even|Tell whether a number of objects pairs up evenly
whole.distributive-parts|Find a partial product or total from parts of an array or nested groups
whole.multiplicative-comparison|Find a quantity or the factor in a multiplicative comparison
whole.multi-step-stories|Solve a two-step story of equal groups and a known use or payment
whole.expression-story|Choose the word problem that a multiplication or division expression represents
whole.related-equation|Choose the multiplication equation related to a division equation, or the reverse
fractions.choose-model|Choose the drawn model that shows a stated fraction
equation.truth|Decide which equations with a value on each side are true
time.rename-units|Rename hours and minutes as minutes or minutes as hours
number.factors-identify|Choose the numbers that are factors of a given whole number
fractions.multiply-scaling|Decide whether a product exceeds, equals or falls below a factor from the size of the other factor`,
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
