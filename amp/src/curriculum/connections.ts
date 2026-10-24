import type { SkillConnection } from "./types";

/** Editorial connections supported by existing content, not assessment dependencies. */
const authoredConnections: (Omit<
  SkillConnection,
  "skillId" | "direction"
> & {
  from: string;
  to: string;
})[] = [
  {
    from: "dilations-similarity",
    to: "slope",
    kind: "application",
    explanation:
      "Scaling a right triangle's horizontal and vertical changes by the same factor preserves their ratio. This explains why triangles along one straight line give the same slope.",
    templateIds: ["slope-triangle-statements"],
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
causal-claims|statistical-report-critique|application|Judging whether a report's causal claim is justified depends on its study design.|causal-claim-choice
categorical-association|conditional-probability|extension|A conditional relative frequency in a table is a conditional probability.|conditional-probability-value
statistical-summary-comparison|randomization-tests|application|The difference in centers between two groups is the statistic that a randomization test compares with chance.|outlier-center-shift
nonlinear-equation-modeling|model-validation|application|After solving a quadratic or exponential model, check its solution against the context and the data.|quadratic-context-model
fraction-plot-computation|fraction-division|application|Sharing a measured total equally is a fraction division.|fraction-share-amount
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
