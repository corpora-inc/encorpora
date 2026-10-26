import type { SkillConnection } from "./types";
import { familyRegistry } from "../families/registry";

/** Editorial connections supported by existing content, not assessment dependencies. */
const authoredConnections: (Omit<SkillConnection, "skillId" | "direction"> & {
  from: string;
  to: string;
})[] = [
  {
    from: "financial-literacy-middle",
    to: "piecewise-functions",
    kind: "application",
    explanation:
      "Tax owed as a function of income uses a different rule on each bracket. That is a piecewise function whose pieces join where the brackets meet.",
    templateIds: ["piecewise-evaluate"],
  },
  {
    from: "triangle-law-proofs",
    to: "oblique-triangles",
    kind: "application",
    explanation:
      "The altitude derivation of the laws of sines and cosines shows which measurements each law needs. Solving an oblique triangle applies the matching law to those measurements.",
    templateIds: ["triangle-law-reasoning"],
  },
  {
    from: "model-quantities",
    to: "linear-equation-modeling",
    kind: "application",
    explanation:
      "A linear equation for a situation needs defined quantities first: a variable with units for each changing quantity, and a rate in dependent unit per independent unit.",
    templateIds: ["model-quantity-roles", "linear-model-equation"],
  },
  {
    from: "dilations-similarity",
    to: "slope",
    kind: "application",
    explanation:
      "Scaling a right triangle's horizontal and vertical changes by the same factor preserves their ratio. This explains why triangles along one straight line give the same slope.",
    templateIds: ["slope-triangle-statements"],
  },
  {
    from: "slope",
    to: "quadratic-graphs",
    kind: "extension",
    explanation:
      "A line is graphed from two points because its slope is constant. A parabola has no constant slope, so it is graphed from its vertex and symmetric points found by substituting.",
    templateIds: ["graph-quadratic-points"],
  },
  {
    from: "odd-and-even",
    to: "rule-patterns",
    kind: "extension",
    explanation:
      "Adding an even number keeps a number odd or even; adding an odd number switches it. This explains patterns that stay odd or alternate.",
    templateIds: ["rule-pattern-feature"],
  },
  {
    from: "odd-and-even",
    to: "factors-multiples",
    kind: "related",
    explanation:
      "An even positive whole number has 2 as a factor: it can be written as 2 times another whole number.",
    templateIds: ["factor-partner"],
  },
  {
    from: "odd-and-even",
    to: "multistep-whole-stories",
    kind: "application",
    explanation:
      "When each kit holds two items, an even total fills complete kits. An odd total leaves one item over.",
    templateIds: ["kit-leftovers"],
  },
  {
    from: "odd-and-even",
    to: "event-sets",
    kind: "application",
    explanation:
      "Even and odd outcomes form sets. Listing their members helps count outcomes when finding probabilities.",
    templateIds: ["event-set-count"],
  },
  // Trigonometry cluster.
  {
    from: "right-triangle-trigonometry",
    to: "special-angle-values",
    kind: "extension",
    explanation:
      "Right-triangle ratios of 30°, 45° and 60° become the unit-circle coordinates, and the quadrant sign extends them to every angle.",
    templateIds: ["special-angle-exact-value"],
  },
  {
    from: "special-angle-values",
    to: "trigonometric-symmetry",
    kind: "extension",
    explanation:
      "Once the values at special angles are known, reflecting or rotating the angle changes only the sign or the function, so other angles need no new values.",
    templateIds: ["trig-symmetry-value"],
  },
  {
    from: "special-angle-values",
    to: "trigonometric-identities",
    kind: "application",
    explanation:
      "Angle-sum formulas combine the exact values at 30°, 45° and 60° to give exact values at angles such as 15° and 75°.",
    templateIds: ["trig-identity-value"],
  },
  {
    from: "trigonometric-symmetry",
    to: "trigonometric-graphs",
    kind: "related",
    explanation:
      "Odd, even and periodic symmetry of sine and cosine appear on the graph as point symmetry, mirror symmetry and repetition every period.",
    templateIds: ["sinusoid-parameters"],
  },
  {
    from: "trigonometric-equations",
    to: "periodic-modeling",
    kind: "application",
    explanation:
      "Setting a sinusoidal model equal to a value and solving gives the times at which the modeled quantity reaches that value.",
    templateIds: ["sinusoid-model"],
  },
  {
    from: "periodic-modeling",
    to: "parametric-models",
    kind: "extension",
    explanation:
      "A rider on a wheel has a height that is a sinusoid of time. Pairing it with a second sinusoid for horizontal position describes the whole circular path as a function of one parameter.",
    templateIds: ["sinusoid-model"],
  },
  {
    from: "oblique-triangles",
    to: "trigonometric-area",
    kind: "related",
    explanation:
      "The height used to count triangles in the ambiguous case is b sin A, the same product that appears in the area formula one half ab sin C.",
    templateIds: ["trig-triangle-area"],
  },
  {
    from: "polynomial-behavior",
    to: "rational-function-behavior",
    kind: "related",
    explanation:
      "A polynomial's degree and leading coefficient set its end behavior. A rational function compares the degrees and leading coefficients of its numerator and denominator to find its horizontal asymptote.",
    templateIds: ["rational-function-features"],
  },
  {
    from: "rational-function-behavior",
    to: "rational-equations",
    kind: "related",
    explanation:
      "The inputs that make a denominator zero are the holes and vertical asymptotes of the graph. They are also the excluded values that must be checked when solving a rational equation.",
    templateIds: ["rational-equation-check"],
  },
  {
    from: "nonlinear-intersection-reading",
    to: "graphical-equation-solving",
    kind: "extension",
    explanation:
      "Reading shared points of a line and a parabola extends to any equation f(x) = g(x): the solutions are the inputs where the two outputs match. A table of values locates them.",
    templateIds: ["graphical-solution-table"],
  },
  {
    from: "graphical-equation-solving",
    to: "nonlinear-systems",
    kind: "related",
    explanation:
      "Substitution gives exact intersections when the equation can be solved by factoring. A table of values approximates intersections that algebra cannot give simply.",
    templateIds: ["nonlinear-system-solve"],
  },
  {
    from: "factor-quadratics",
    to: "polynomial-identities",
    kind: "extension",
    explanation:
      "Factoring a difference of squares or a perfect-square trinomial uses identities such as a² − b² = (a + b)(a − b). Read from either side, the same identity also computes products and squares quickly.",
    templateIds: ["monic-quadratic-factorization"],
  },
  {
    from: "polynomial-identities",
    to: "binomial-theorem",
    kind: "extension",
    explanation:
      "The identities for (a + b)² and (a + b)³ are the cases n = 2 and n = 3 of the binomial expansion. The binomial theorem gives the coefficients for every n.",
    templateIds: ["binomial-coefficient"],
  },
  {
    from: "permutations-combinations",
    to: "binomial-theorem",
    kind: "application",
    explanation:
      "The coefficient of the term with k factors of a in (a + b)ⁿ counts the ways to choose which k of the n factors give a. That count is the combination C(n, k).",
    templateIds: ["combination-count"],
  },
  {
    from: "binomial-theorem",
    to: "theoretical-distributions",
    kind: "application",
    explanation:
      "The probability of k successes in n independent trials with success chance p is C(n, k)·pᵏ·(1 − p)ⁿ⁻ᵏ. These are the terms of the expansion of (p + (1 − p))ⁿ, which sum to 1.",
    templateIds: ["binomial-coefficient"],
  },
  {
    from: "number-system-closure",
    to: "quadratic-formula",
    kind: "application",
    explanation:
      "A root such as (−b + √d) / 2a is a rational number plus a nonzero rational multiple of √d. When √d is irrational, the closure rules make the whole root irrational.",
    templateIds: ["quadratic-irrational-solutions"],
  },
];

// from | to | kind | explanation | evidence template (a problem family of either endpoint)
const connectionTable = `
compare-small-groups|compare-numerals|extension|Pairing objects shows which group has more. The same comparison is recorded by which numeral is greater.|greater-numeral
compare-numerals|compare-two-digit|extension|Comparing one-digit numbers extends to two-digit numbers by comparing tens first, then ones.|compare-two-digit
compare-two-digit|compare-three-digit|extension|Compare the largest place first, and move to the next place only when digits match. Three-digit numbers add a hundreds place to that rule.|compare-three-digit
compare-three-digit|large-place-value|extension|The same left-to-right place comparison works for any number of digits.|compare-multidigit
facts-within-5|addition-facts|extension|Instant recall of small facts is the base for related addition and subtraction facts up to 20.|related-subtraction
three-addends|multiple-addends|extension|Adding three numbers in any grouping extends to adding several numbers in convenient groups.|add-several-two-digit
multiple-addends|whole-add-subtract|extension|Adding several numbers by place value is the same regrouping used to add larger multidigit numbers.|add-multidigit
ten-more-less|mental-tens-hundreds|extension|Changing the tens digit by one extends to changing the hundreds digit by one.|mental-ten-hundred
mental-tens-hundreds|powers-of-ten|extension|Shifting a value by ten or one hundred in place value becomes multiplying and dividing by powers of ten.|multiply-power-of-ten
counting-arithmetic|number-line-arithmetic|extension|Counting on and back is the same as hopping forward and back along a number line.|number-line-hops
addition-facts|multiplication-meaning|application|Repeated addition of equal groups gives a multiplication total, so fluent sums make equal-group totals easier.|equal-tray-total
money-values|decimal-arithmetic|application|Dollars and cents are hundredths of a dollar. Adding money is adding decimals aligned by place.|decimal-addition
missing-factor|one-step-equations|extension|An unknown factor in a fact is a one-step equation. A letter can stand for the unknown number.|one-step-equation
fraction-model|decimal-fractions|related|A tenths or hundredths grid is a fraction model whose whole is divided into ten or one hundred equal parts.|decimal-grid-read
compare-fractions|fraction-comparison|extension|Comparing fractions with the same denominator or numerator extends to unlike fractions by renaming them as equivalent fractions.|compare-unlike-fractions
fraction-comparison|compare-decimals|related|Decimals are fractions with denominators of ten or one hundred. Comparing tenths and hundredths is comparing fractions.|compare-decimals-hundredths
fraction-comparison|unit-rates|related|Choosing the better buy compares two quotients, in the same way as comparing two fractions.|better-buy
mixed-numbers|fraction-multiplication|application|Converting a mixed number to an improper fraction lets you multiply by multiplying numerators and denominators.|multiply-fractions
partition-area|fraction-multiplication|extension|Cutting a region into equal parts and taking some of them models a fraction of a fraction, which is a product.|multiply-fractions
fraction-addition|rational-expressions|extension|Finding a common denominator to add fractions is the same step used to add rational expressions.|rational-expression-operation
ruler-measurement|fractions-number-line|related|A ruler marked in equal parts is a number line. Fractions of a unit are read at the marks between whole numbers.|fraction-line-position
rectangle-area|whole-multiplication|extension|Splitting a rectangle into parts shows a product as a sum of partial products.|area-model-product
whole-multiplication|polynomial-arithmetic|extension|The area model that splits 23 × 14 into partial products also multiplies (x + 3)(x + 4) term by term.|polynomial-multiplication
area-perimeter-models|expression-structure|extension|Writing the area of a rectangle as length times width extends to binomial sides, whose area is a product of sums.|binomial-area-product
perimeter|variable-expressions|application|Adding side lengths gives a perimeter. With a letter for an unknown side, the same sum is an expression you can evaluate.|substitute-linear-expression
multiplicative-comparison|ratios|extension|Saying one amount is a number of times another compares two quantities by multiplication, which is a ratio.|ratio-missing
scaled-graphs|distribution-plots|extension|Reading a scaled graph means using the axis scale. Histograms also need their scale to read frequencies.|histogram-read
elapsed-time|unit-rates|application|A rate such as miles per hour divides a quantity by elapsed time.|unit-rate
mass-volume|unit-conversion|related|Measuring mass and volume uses metric units. Renaming one metric unit as another multiplies or divides by ten, one hundred or one thousand.|metric-length-rename
unit-conversion|powers-of-ten|application|Metric prefixes are powers of ten, so converting units is multiplying or dividing by a power of ten.|multiply-power-of-ten
measurement-conversions|units-and-precision|extension|Converting single metric units extends to compound units such as kilometers per hour, using conversion factors.|compound-unit-conversion
multistep-whole-stories|two-step-equations|application|The steps in a multi-step story can be written as one equation with an unknown, then undone in reverse order.|two-step-word-problem
whole-add-subtract|decimal-arithmetic|extension|Decimals are added and subtracted with the same place-value alignment and regrouping used for whole numbers.|decimal-addition
integer-division|polynomial-division|extension|Polynomial long division follows the same divide, multiply, subtract and bring-down steps as whole-number long division.|polynomial-quotient
integer-division|irrational-numbers|application|Dividing the numerator by the denominator turns a fraction into a decimal. Rational numbers give decimals that end or repeat.|repeating-decimal-to-fraction
shape-hierarchy|parallelogram-proofs|application|If every rectangle is a parallelogram, it inherits the properties of parallelograms. Proofs use this to transfer facts between classes.|inherited-property
coordinate-polygons|coordinate-measurement|extension|Side lengths found from coordinates extend to the perimeter and area of any polygon given by its vertices.|coordinate-polygon
coordinate-measurement|geometric-design|application|Designing a figure on a coordinate plane needs its vertices to give the required lengths and areas.|coordinate-polygon
statistics-mean|expected-value|extension|Expected value is a mean in which each outcome is weighted by its probability.|expected-value
rational-unit-rates|slope|application|Slope is a unit rate: the change in vertical distance per one unit of horizontal change.|line-slope
rational-stories|linear-models|application|Signed changes per step describe a rate of change, and a starting amount is the initial value of a linear model.|linear-initial-value-meaning
complex-fractions|rational-expressions|extension|Dividing one fraction by another extends to dividing one rational expression by another.|rational-expression-simplify
absolute-value-equations|piecewise-functions|extension|The absolute value function is defined by one rule for inputs at least zero and another rule for negative inputs.|piecewise-reading
triangle-construction|congruence-criteria|application|Three given sides or angles that fix a triangle's shape are the conditions behind the congruence criteria.|triangle-congruence-criteria
signed-data-summaries|statistical-summary-comparison|extension|Median and range of one data set extend to comparing groups, including how outliers move the center.|outlier-center-shift
qualitative-graphs|piecewise-functions|extension|A graph with rising, flat and falling sections is a function with a different rule on each section.|piecewise-reading
expression-structure|factor-quadratics|application|Seeing an expression as a product or sum of structured parts guides rewriting a quadratic as factors.|monic-quadratic-factorization
formula-rearrangement|symbolic-linear-constraints|extension|Solving a formula for one variable extends to solving equations whose coefficients are letters.|literal-equation-solve
formula-rearrangement|inverse-functions|application|Solving y = f(x) for x gives the formula for the inverse function.|inverse-expression
linear-equation-modeling|systems-modeling|extension|One linear model extends to two models compared together, where the solution is when they agree.|system-model-value
linear-equation-modeling|regression-interpretation|application|A fitted line is a linear model, with slope as a rate and intercept as a starting value.|regression-line-predict
arithmetic-sequences|growth-comparison|related|An arithmetic sequence adds a constant each step and a geometric sequence multiplies. Comparing them shows linear against exponential growth.|linear-or-exponential
quadratic-minimum|nonlinear-equation-modeling|application|The vertex of a parabola gives the greatest or least value of a quadratic model, such as maximum height.|quadratic-context-model
independent-events|probability-multiplication|extension|For independent events the conditional probability equals the ordinary probability, so the joint probability is a product.|multiplication-rule-probability
radical-equations|inverse-functions|related|Squaring undoes a square root, which is why solving radical equations works and why extraneous solutions must be checked.|inverse-expression
nonlinear-intersection-count|polynomial-zeros|related|The intersections of two graphs are the zeros of the difference of their equations, and the number of zeros is bounded by the degree.|zero-multiplicity
exponential-equations|growth-comparison|application|Finding when an exponential quantity overtakes a linear one means solving an exponential equation with logarithms.|exponential-overtakes
sequence-sums|exponential-equations|application|Finding how many terms are needed to reach a total from a geometric sum requires solving an exponential equation.|exponential-log-solution
scientific-notation|logarithms|related|Scientific notation writes numbers as powers of ten, and a base-ten logarithm is that exponent.|log-exponential-form
elimination-proof|matrix-systems|application|Adding multiples of one equation to another in elimination is the row operation used to solve systems with matrices.|elimination-equivalent
symbolic-linear-constraints|matrix-systems|application|Whether a parameter gives one, none or infinitely many solutions is decided by the same conditions that decide matrix systems.|parameter-solution-count
inequality-regions|systems-modeling|application|The overlap of half-plane regions is the set of feasible choices in a constrained model.|constraint-feasible
average-rate-change|cross-representation-comparison|extension|Average rate of change gives a common measure for comparing functions given as tables, graphs and formulas.|compare-representations
cross-representation-comparison|growth-comparison|extension|Comparing functions in different forms extends to asking which kind of growth eventually exceeds the other.|linear-or-exponential
growth-comparison|model-validation|application|Choosing between linear and exponential models by how the data grow is part of checking whether a model fits.|linear-or-exponential
slope-proofs|tangent-construction|application|A tangent is perpendicular to the radius at the point of tangency, and perpendicular lines have slopes whose product is -1.|perpendicular-slopes
segment-division|vectors|extension|A point that divides a segment in a ratio is the start point plus that fraction of the vector between the endpoints.|segment-partition
dilation-properties|solid-volume-models|application|A scale factor k multiplies lengths by k and volumes by k cubed, which models scaled solids.|similar-solid-volume
dilation-properties|circle-similarity|application|A dilation maps one circle onto any other, so all circles are similar.|dilation-measure
complementary-trigonometry|geometric-modeling|application|Complementary angle relations let one trig ratio find a height or distance in a modeling problem.|complementary-trig
probability-addition|expected-value|application|Mutually exclusive outcomes add, so the probability of a set of outcomes is the sum of their probabilities in an expected value.|expected-value
probability-multiplication|decision-strategies|application|Along a decision tree, probabilities multiply along each path to find the chance of each payoff.|multiplication-rule-probability
permutations-combinations|theoretical-distributions|application|Counting arrangements gives the numbers of ways behind binomial and other theoretical probabilities.|combination-probability
percentages|probability|related|A probability is a part-to-whole ratio, and a percentage is the same ratio per one hundred.|simple-probability
sampling-margin-error|statistical-report-critique|application|Checking whether a reported margin of error fits the sample size is part of critiquing a statistical report.|sample-size-margin
regression-interpretation|causal-claims|extension|A strong fitted relationship describes association. Whether it shows cause depends on how the data were collected.|causal-claim-choice
arithmetic-sequences|sequence-sums|related|An arithmetic series adds terms that change by a fixed amount, so pairing first and last terms gives its sum. A geometric series adds terms that change by a fixed ratio and uses a different sum rule.|geometric-series-sum
regression-interpretation|exponential-models|application|Equal ratios in a table, or a curved residual plot that a line cannot remove, show data that follow an exponential model. Building that model means finding its starting value and growth factor.|exponential-model-rule
causal-claims|statistical-report-critique|application|Judging whether a report's causal claim is justified depends on its study design.|causal-claim-choice
categorical-association|conditional-probability|extension|A conditional relative frequency in a table is a conditional probability.|conditional-probability-value
statistical-summary-comparison|randomization-tests|application|The difference in centers between two groups is the statistic that a randomization test compares with chance.|outlier-center-shift
nonlinear-equation-modeling|model-validation|application|After solving a quadratic or exponential model, check its solution against the context and the data.|quadratic-context-model
fraction-plot-computation|fraction-division|application|Sharing a measured total equally is a fraction division.|fraction-share-amount
vector-modeling|oblique-triangles|application|Two forces or velocities that are not perpendicular form a triangle with their resultant, so the law of cosines gives the resultant's magnitude and the law of sines its direction.|oblique-triangle-solve
matrix-data|matrices|extension|The stock at two stores adds as matrices, and a price list multiplies a quantity matrix to give totals. Operations on data tables are the matrix operations.|matrix-data-reading
matrix-properties|matrix-inverses|extension|Since order matters in a product, an inverse must satisfy both AA^-1 = I and A^-1A = I, and the identity matrix is the matrix that leaves a product unchanged.|matrix-laws
matrix-systems|matrix-transformations|application|Solving AX = B asks which point the matrix A sends to B, so the inverse undoes the transformation.|matrix-linear-system
matrix-transformations|transformation-constructions|related|Multiplying matrices composes transformations: the product AB applies B first and then A. This is the matrix form of carrying one figure to another by a sequence of moves.|matrix-transformation
normal-distributions|statistical-inference|extension|Means of repeated samples vary in a roughly normal pattern, so the same rule that gives percents within standard deviations gives the margin of error.|normal-model-rule
theoretical-distributions|decision-strategies|application|Expected values computed from a theoretical distribution are the averages used to compare uncertain choices.|theoretical-distribution-expectation
empirical-distributions|simulation-model-checks|related|Simulated results form an empirical distribution, and its relative frequencies estimate how often a result as extreme as the observed one arises.|empirical-distribution-expectation
fair-random-decisions|simulation-model-checks|extension|A fair procedure gives each outcome the same probability, which is the model that simulated results are compared against.|fair-selection-procedure
randomization-tests|statistical-report-critique|application|A significant randomization test from random assignment supports a causal claim, which is what a critique of a report asks whether the design justifies.|randomization-test-decision
statistical-report-critique|model-validation|related|Asking whether a report's evidence supports its claim is the same question as checking whether a model's predictions agree with the data.|report-flaw-critique
decision-strategies|model-validation|related|A decision made by expected value is only as good as the probabilities in the model, which is why a model is checked against data.|strategy-expected-value
model-validation|periodic-modeling|application|Residual patterns apply to any model, including a sine or cosine model whose midline, amplitude and period are checked against measurements.|model-residual-conclusion
complex-conjugates|complex-distance|extension|The squared modulus of a complex number is the number times its conjugate. The distance between z and w is the modulus of z − w, so its square is (z − w) times that difference's conjugate.|complex-distance-midpoint
complex-plane|polar-coordinates|related|The polar form r(cos θ + i sin θ) of a complex number uses the same distance r and angle θ as the polar coordinates of the point (a, b).|polar-cartesian-conversion
complex-distance|conic-sections|application|The points z whose distance from w is a fixed number r form a circle, the first conic section.|conic-standard-form
fundamental-theorem-algebra|polynomial-behavior|application|A degree-n polynomial has n complex zeros counting multiplicity, so its graph crosses or touches the x-axis at most n times, and its nonreal zeros come in conjugate pairs that never appear as x-intercepts.|polynomial-root-count
polar-coordinates|parametric-models|extension|A polar curve r = f(θ) is a parametric curve x = f(θ)cos θ, y = f(θ)sin θ with θ as the parameter, so polar points are positions given by a parameter.|polar-cartesian-conversion
parametric-models|vector-modeling|application|A position (x(t), y(t)) is a vector that changes at a constant velocity vector (a, b), whose length is the speed.|parametric-linear-motion
parabola-locus|conic-sections|extension|A parabola is the points equally far from a focus and a directrix. Ellipses and hyperbolas extend the idea: constant sum or difference of distances to two foci.|parabola-focus-directrix
conic-sections|parametric-models|related|A circle or ellipse can be traced by x = h + a cos t, y = k + b sin t, which satisfies the conic's standard equation because cos² t + sin² t = 1.|conic-standard-form
line-angle-proofs|triangle-proofs|extension|Equal alternate interior angles from a line parallel to one side are the key step in the proof that a triangle's angles total 180 degrees.|line-angle-proof-reasons
line-angle-proofs|geometric-constructions|application|Points equidistant from two endpoints lie on the perpendicular bisector. That fact is why arcs of equal radius from both endpoints construct it.|line-angle-proof-reasons
triangle-proofs|coordinate-proofs|application|The midsegment and median facts can be checked with coordinates: a midsegment has half the vector of the side it is parallel to.|triangle-theorem-consequences
parallelogram-proofs|coordinate-proofs|application|Bisecting diagonals and congruent rectangle diagonals become coordinate tests: compare midpoints of diagonals and diagonal lengths.|parallelogram-property-consequences
polygon-symmetries|transformation-constructions|extension|A symmetry is a rotation or reflection that maps a figure onto itself. Mapping a figure onto a different position uses compositions of the same transformations.|polygon-symmetry-counts
transformation-constructions|circle-similarity|application|Mapping one circle onto another uses a translation followed by a dilation, which is a composition chosen like any other figure-to-image sequence.|circle-dilation-scaling
inscribed-polygons|triangle-circles|extension|The circle through the vertices of a regular inscribed polygon is its circumscribed circle, the circle whose center is where the perpendicular bisectors of the sides meet.|inscribed-polygon-reasoning
triangle-circles|tangent-construction|related|The incircle of a triangle is tangent to all three sides, and each radius to a point of tangency is perpendicular to that side.|tangent-circle-computation
tangent-construction|circle-equations|application|The tangent at a point of a circle is perpendicular to the radius to that point, so its slope is the negative reciprocal of the radius slope.|tangent-circle-computation
circle-similarity|arc-sector-measure|extension|Because circles are similar, arc length and sector area are fixed fractions of circumference and area, scaling with the radius.|circle-dilation-scaling
solid-volume-models|density-modeling|application|Mass is density times volume, so a solid's volume formula gives the mass of a rod or block of known density.|density-context
density-modeling|geometric-design|related|Mass is density times volume, and the cost of painting a wall is a price per square meter times the painted area. Both multiply a rate per unit by a measured amount, which is how a design is priced.|geometric-design-constraint
geometric-design|nonlinear-equation-modeling|extension|The area of a three-sided fenced garden, width times (fence minus two widths), is a quadratic constraint model with a greatest value.|geometric-design-constraint
cavalieri-principle|solid-volume-models|application|Equal cross-sections show that an oblique solid has the volume of the right solid with the same base and perpendicular height.|cavalieri-volume-reasoning
sections-and-revolutions|solid-volume-models|application|A rotated rectangle, right triangle or semicircle sweeps out a cylinder, cone or sphere, whose volume formula gives the volume.|section-revolution-solid
similarity-theorems|pythagorean-theorem|related|The two leg relations of a right triangle with its altitude add to give the Pythagorean theorem.|similarity-theorem-length
`;

export const curriculumConnections: typeof authoredConnections = [
  ...authoredConnections,
  ...connectionTable
    .trim()
    .split("\n")
    .map((line) => {
      const [from, to, kind, explanation, templateId] = line.split("|") as [
        string,
        string,
        SkillConnection["kind"],
        string,
        string,
      ];
      return { from, to, kind, explanation, templateIds: [templateId] };
    }),
  // Frozen legacy entries above; families append from src/families/.
  ...familyRegistry.connections.map((connection) => ({
    ...connection,
    templateIds: [...connection.templateIds],
  })),
];

export function connectionsFor(skillId: string): SkillConnection[] {
  return curriculumConnections.flatMap<SkillConnection>(
    ({ from, to, ...connection }) =>
      from === skillId
        ? [
            {
              ...connection,
              templateIds: [...connection.templateIds],
              skillId: to,
              direction: "forward" as const,
            },
          ]
        : to === skillId
          ? [
              {
                ...connection,
                templateIds: [...connection.templateIds],
                skillId: from,
                direction: "backward" as const,
              },
            ]
          : [],
  );
}

/** Both ends and the cited problem family must exist; evidence must belong to an endpoint. */
export function auditConnectionEvidence(
  skills: readonly { id: string }[],
  templates: readonly { id: string; skillId: string }[],
  connections = curriculumConnections,
) {
  const ids = new Set(skills.map((s) => s.id));
  const families = new Map(templates.map((t) => [t.id, t.skillId]));
  const seen = new Set<string>();
  const errors: string[] = [];
  for (const connection of connections) {
    const { from, to, kind, explanation, templateIds } = connection;
    const pair = [from, to].sort().join("|");
    if (seen.has(pair)) errors.push(`Duplicate navigation connection: ${pair}`);
    seen.add(pair);
    if (!ids.has(from) || !ids.has(to) || from === to)
      errors.push(`Invalid navigation endpoints: ${from} → ${to}`);
    if (
      !["extension", "application", "related"].includes(kind) ||
      !explanation.trim()
    )
      errors.push(`Incomplete navigation connection: ${pair}`);
    if (!templateIds.length || new Set(templateIds).size !== templateIds.length)
      errors.push(`Invalid navigation evidence: ${pair}`);
    for (const id of templateIds)
      if (![from, to].includes(families.get(id) ?? ""))
        errors.push(`Unrelated or missing navigation evidence: ${pair}: ${id}`);
  }
  return errors;
}
