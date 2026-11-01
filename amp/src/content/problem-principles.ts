import { satCompletionPrinciples } from "./sat-completion-lessons";
import { satGeometryDataPrinciples } from "./sat-geometry-data-lessons";
import { satGeometryAdvancedPrinciples } from "./sat-geometry-advanced-lessons";
import { congruencePrinciples } from "./congruence-lessons";
import { assessmentGapPrinciples } from "./assessment-gap-lessons";
import { radicalEquationPrinciples } from "./radical-equation-lessons";
import { rationalEquationPrinciples } from "./rational-equation-lessons";
import { geometryProofPrinciples } from "./geometry-proof-lessons";
import { geometryProofFamilyPrinciples } from "./geometry-proof-family-lessons";
import { k8RepresentationPrinciples } from "./k8-representations-lessons";
import { rationalExpressionPrinciples } from "./rational-expression-lessons";
import { nonlinearSystemPrinciples } from "./nonlinear-system-lessons";
import { areaVolumePrinciples } from "./area-volume-lessons";
import { transformationPrinciples } from "./transformation-lessons";
import { completingSquarePrinciples } from "./completing-square-lessons";
import { factoringPrinciples } from "./factoring-lessons";
import { numberSystemPrinciples } from "./number-system-lessons";
import { ratioRatePrinciples } from "./ratio-rate-lessons";
import { patternFunctionPrinciples } from "./pattern-function-lessons";
import { linearFunctionPrinciples } from "./linear-function-lessons";
import { quadraticStructurePrinciples } from "./quadratic-structure-lessons";
import { functionToolkitPrinciples } from "./function-toolkit-lessons";
import { twoVariablePrinciples } from "./two-variable-lessons";
import { equationPrinciples } from "./equation-lessons";
import { volumeCoordinatePrinciples } from "./volume-coordinate-lessons";
import { shapePrinciples } from "./shape-lessons";
import { anglePrinciples } from "./angle-lessons";
import { polygonPrinciples } from "./polygon-lessons";
import { exponentialPrinciples } from "./exponential-lessons";
import { probabilityRulesPrinciples } from "./probability-rules-lessons";
import { similarityTrigPrinciples } from "./similarity-trig-lessons";
import { coordinateCirclePrinciples } from "./coordinate-circle-lessons";
import { algebraStatisticsPrinciples } from "./algebra-statistics-lessons";
import { powerPrinciples } from "./power-lessons";
import { distributionPrinciples } from "./distribution-lessons";
import { inferencePrinciples } from "./inference-lessons";
import { bivariatePrinciples } from "./bivariate-lessons";
import { partWholePrinciples } from "./part-whole-lessons";
import { decimalPrinciples } from "./decimal-lessons";
import { timeMoneyPrinciples } from "./time-money-lessons";
import { attributePrinciples } from "./attribute-lessons";
import { linePlotPrinciples } from "./line-plot-lessons";
import { earlyDataPrinciples } from "./early-data-lessons";
import { combinatoricsPrinciples } from "./combinatorics-lessons";
import { angleTrianglePrinciples } from "./angle-triangle-lessons";
import { realNumberPrinciples } from "./real-number-lessons";
import { radicalPrinciples } from "./radical-lessons";
import { comparisonPrinciples } from "./comparison-lessons";
import { numberSensePrinciples } from "./number-sense-lessons";
import { multiplyDividePrinciples } from "./multiply-divide-lessons";
import { addSubtractPrinciples } from "./add-subtract-lessons";
import { factsPrinciples } from "./facts-lessons";
import { factArrayPrinciples } from "./fact-arrays-lessons";
import { rationalPrinciples } from "./rational-lessons";
import { circleMeasurementPrinciples } from "./circle-measurement-lessons";
import { integerExponentPrinciples } from "./integer-exponent-lessons";
import { descriptiveStatisticsPrinciples } from "./descriptive-statistics-lessons";
import { percentChangePrinciples } from "./percent-change-lessons";
import { successivePercentChangePrinciple } from "./successive-percent-change-lesson";
import { slopeTriangleStatementsPrinciple } from "./slope-triangle-statements-lesson";
import { inequalityPrinciples } from "./inequality-lessons";
import { linearSystemPrinciples } from "./linear-system-lessons";
import { rightTrianglePrinciples } from "./right-triangle-lessons";
import { polynomialPrinciples } from "./polynomial-lessons";
import { quadraticPrinciples } from "./quadratic-lessons";
import { complexPrinciples } from "./complex-lessons";
import { financeCreditPrinciples } from "./finance-credit-lessons";
import { hsStateGapPrinciples } from "./hs-state-gaps-lessons";
import { financeIncomePrinciples } from "./finance-income-lessons";
import { texasHsPrinciples } from "./texas-hs-lessons";
import { k8StateNumberPrinciples } from "./k8-state-number-lessons";
import { texas38Principles } from "./texas-38-lessons";
import { satNumericEntryPrinciples } from "./sat-numeric-entry-lessons";
import { satFunctionFormsPrinciples } from "./sat-function-forms-lessons";
import { pointPlotPrinciples } from "./point-plot-lessons";
import { multiPartChoicePrinciples } from "./multi-part-choice-lessons";
import { algebraRequirementGapPrinciples } from "./algebra-requirement-gaps-lessons";
import { advancedMathGapPrinciples } from "./advanced-math-gaps-lessons";
import { numberMeasurementGapPrinciples } from "./number-measurement-gaps-lessons";
import { floridaGapPrinciples } from "./florida-gaps-lessons";
import { regentsGapPrinciples } from "./regents-gap-lessons";
import { mcasGapPrinciples } from "./mcas-gap-lessons";
import { staarGapPrinciples } from "./staar-gap-lessons";
import { texasK2Principles } from "./texas-k2-lessons";
import { satAlgebraStructurePrinciples } from "./sat-algebra-structure-lessons";
import { remainingGapPrinciples } from "./remaining-gap-lessons";
import { dataDisplayStatePrinciples } from "./data-display-state-lessons";
import { vectorMatrixPrinciples } from "./vectors-matrices-lessons";
import { statisticsProbabilityPrinciples } from "./statistics-probability-lessons";
import { complexConicsPrinciples } from "./complex-conics-lessons";
import { trigonometryPrinciples } from "./trigonometry-lessons";
import { geometryModelingPrinciples } from "./geometry-modeling-lessons";
import { geometryRequirementGapPrinciples } from "./geometry-requirement-gaps-lessons";
import { functionBehaviorPrinciples } from "./function-behavior-lessons";
import { absoluteValuePrinciples } from "./absolute-value-lessons";
import { familyRegistry } from "../families/registry";
import { withFamilyEntries } from "../families/registry/aggregate";
/** The mathematics each problem type rests on, named precisely and stated in
 * general form. Shown in every lesson so learners meet the real vocabulary. */
const legacyPrinciples: Record<string, string> = {
  ...assessmentGapPrinciples,
  ...satCompletionPrinciples,
  ...satGeometryDataPrinciples,
  ...satGeometryAdvancedPrinciples,
  ...factoringPrinciples,
  ...volumeCoordinatePrinciples,
  ...shapePrinciples,
  ...anglePrinciples,
  ...polygonPrinciples,
  ...exponentialPrinciples,
  ...probabilityRulesPrinciples,
  ...similarityTrigPrinciples,
  ...congruencePrinciples,
  ...coordinateCirclePrinciples,
  ...algebraStatisticsPrinciples,
  ...powerPrinciples,
  ...integerExponentPrinciples,
  ...descriptiveStatisticsPrinciples,
  ...quadraticPrinciples,
  ...complexPrinciples,
  ...financeCreditPrinciples,
  ...hsStateGapPrinciples,
  ...financeIncomePrinciples,
  ...texasHsPrinciples,
  ...k8StateNumberPrinciples,
  ...texas38Principles,
  ...satNumericEntryPrinciples,
  ...satFunctionFormsPrinciples,
  ...pointPlotPrinciples,
  ...multiPartChoicePrinciples,
  ...algebraRequirementGapPrinciples,
  ...advancedMathGapPrinciples,
  ...numberMeasurementGapPrinciples,
  ...floridaGapPrinciples,
  ...regentsGapPrinciples,
  ...mcasGapPrinciples,
  ...staarGapPrinciples,
  ...texasK2Principles,
  ...satAlgebraStructurePrinciples,
  ...remainingGapPrinciples,
  ...dataDisplayStatePrinciples,
  ...vectorMatrixPrinciples,
  ...statisticsProbabilityPrinciples,
  ...complexConicsPrinciples,
  ...trigonometryPrinciples,
  ...geometryModelingPrinciples,
  ...geometryRequirementGapPrinciples,
  ...functionBehaviorPrinciples,
  ...absoluteValuePrinciples,
  ...polynomialPrinciples,
  ...earlyDataPrinciples,
  ...linePlotPrinciples,
  ...distributionPrinciples,
  ...inferencePrinciples,
  ...bivariatePrinciples,
  ...radicalPrinciples,
  ...partWholePrinciples,
  ...decimalPrinciples,
  ...timeMoneyPrinciples,
  ...attributePrinciples,
  ...comparisonPrinciples,
  ...numberSensePrinciples,
  ...multiplyDividePrinciples,
  ...addSubtractPrinciples,
  ...factsPrinciples,
  ...factArrayPrinciples,
  ...combinatoricsPrinciples,
  ...areaVolumePrinciples,
  ...transformationPrinciples,
  ...angleTrianglePrinciples,
  ...realNumberPrinciples,
  ...numberSystemPrinciples,
  ...ratioRatePrinciples,
  ...patternFunctionPrinciples,
  ...linearFunctionPrinciples,
  ...quadraticStructurePrinciples,
  ...functionToolkitPrinciples,
  ...twoVariablePrinciples,
  ...equationPrinciples,
  ...rationalPrinciples,
  ...circleMeasurementPrinciples,
  ...completingSquarePrinciples,
  ...percentChangePrinciples,
  "successive-percent-change": successivePercentChangePrinciple,
  "slope-triangle-statements": slopeTriangleStatementsPrinciple,
  ...inequalityPrinciples,
  ...linearSystemPrinciples,
  ...rationalExpressionPrinciples,
  ...radicalEquationPrinciples,
  ...rationalEquationPrinciples,
  ...geometryProofPrinciples,
  ...geometryProofFamilyPrinciples,
  ...k8RepresentationPrinciples,
  ...nonlinearSystemPrinciples,
  // Counting, place value, early operations
  "count-objects":
    "Counting: match each object with exactly one counting number, one at a time. The last number you say tells how many objects there are in the group.",
  "join-within-10":
    "Addition joins two sets: the cardinality of the union of disjoint sets is the sum of their cardinalities.",
  "take-away-within-10":
    "Subtraction removes a part from a whole: whole − part = remaining part, and part + remaining part = whole.",
  "number-bond-missing":
    "Part–whole relationship: if a + b = c, then b = c − a. Addition and subtraction are inverse operations.",
  "ten-frame-complement":
    "Complements of ten: a + (10 − a) = 10. Knowing these pairs is the basis of making ten.",
  "teen-frame-compose":
    "A teen number is one ten and some extra ones. Ten and 3 more ones is 13: the 1 on the left stands for the ten, and the 3 on the right stands for the ones. This works for 0 to 9 extra ones: 10 and 0 more is 10, and 10 and 9 more is 19.",
  "add-within-20":
    "Associative property of addition: (a + b) + c = a + (b + c). Regrouping one addend to complete a ten does not change the sum.",
  "subtract-within-20":
    "Subtraction is the inverse of addition: a − b = c exactly when b + c = a.",
  "three-addend-story":
    "Commutative and associative properties of addition: addends may be added in any order and any grouping.",
  "make-ten-remainder":
    "Decomposing an addend: if a + k = 10, then a + b = 10 + (b − k). This uses the associative property of addition.",
  "subtract-through-ten":
    "Decomposing the subtrahend: a − b = (a − k) − (b − k). Choosing k = a − 10 takes a down to 10 first; the rest, b − k, is subtracted from 10.",
  "unknown-addend-story":
    "Addition and subtraction are inverse operations: start + ? = total means ? = total − start.",
  "missing-start-story":
    "Inverse operations: if start − removed = remaining, then start = removed + remaining.",
  "balanced-addition":
    "The equals sign states equality of value: both sides of a + b = c + d name the same number.",
  "continue-count-to-120":
    "Counting by ones: each number is the number before plus 1. After 9 ones, the ones go back to 0 and the tens go up by 1, as in 19, 20. After 9 tens and 9 ones comes the next hundred, as in 99, 100.",
  "tens-ones-model":
    "Place value: in a two-digit number, the left digit counts tens and the right digit counts ones. So 3 tens and 8 ones is $3 \\times 10 + 8 = 38$. In general, tens digit $a$ and ones digit $b$ make $10a + b$, which means 10 times $a$, plus $b$.",
  "ten-more-or-less":
    "Place value: adding or subtracting 10 changes only the tens digit when no regrouping occurs.",
  "add-ones-regroup":
    "Regrouping: 10 ones equal 1 ten, so a sum of ones of 10 or more becomes one more ten.",
  "subtract-whole-tens":
    "Distributive property: 10a − 10b = 10(a − b). Subtract the tens, then name their value.",
  "hundreds-model":
    "Place value in base ten: a three-digit number abc has value 100a + 10b + c.",
  "place-value-digit":
    "Place value: a digit's value is the digit multiplied by the value of its place (1, 10, 100, …).",
  "expanded-form-missing":
    "Expanded form writes a number as the sum of its place values: $\\overline{abc} = 100a + 10b + c$.",
  "exchange-base-ten":
    "Equivalent representations: 10 units of one place equal 1 unit of the next place; regrouping preserves value.",
  "skip-count-missing":
    "A skip-counting pattern adds the same step each time: the next number is the number before plus the step. Counting by 5s gives 5, 10, 15, 20.",
  "add-several-two-digit":
    "Commutative and associative properties: sum the tens and the ones separately, then combine.",
  "add-with-regrouping":
    "The standard addition algorithm adds by place value, regrouping 10 of one place into 1 of the next.",
  "subtract-with-regrouping":
    "The standard subtraction algorithm subtracts by place value, decomposing 1 of a higher place into 10 of the next lower place when needed.",
  "two-step-change":
    "Changes apply in order, $(\\text{start} + a) - b$, and each change is undone by its inverse: $\\text{start} = (\\text{end} + b) - a$.",
  // Multiplication and division
  "small-array-total":
    "Multiplication as an array: $r$ rows of $c$ objects contain r × c objects.",
  "pairing-leftover":
    "Parity: an integer is even when it is divisible by 2 (remainder 0) and odd when the remainder is 1.",
  "equal-tray-total":
    "Multiplication counts equal groups: $g$ groups of $s$ items contain g × s items.",
  "share-whole-items":
    "Partitive division: sharing a total equally among $n$ groups gives $\\text{total} \\div n$ in each group.",
  "measure-whole-pieces":
    "Quotative (measurement) division: total ÷ size counts how many groups of that size fit.",
  "unknown-group-size":
    "Inverse operations: $g \\times \\square = \\text{total}$ means $\\square = \\text{total} \\div g$.",
  "unknown-dividend":
    "Inverse operations: $\\square \\div a = b$ means $\\square = a \\times b$.",
  "split-array-part":
    "Distributive property: an array a × (b + c) splits into the partial products a × b and a × c.",
  "nested-bag-total":
    "Associative property of multiplication: (a × b) × c = a × (b × c).",
  "zero-one-groups":
    "Zero property: a × 0 = 0. Multiplicative identity: a × 1 = a.",
  "neighbor-product-change":
    "Distributive property: (n + 1) × s = n × s + s, so the next product is one group larger.",
  "factor-partner":
    "Factor pairs: if a × b = n, then b = n ÷ a; $a$ and $b$ are factors of $n$.",
  "tens-contribution":
    "Distributive property of multiplication over addition: (10a + b) × c = 10a × c + b × c.",
  "comparison-amount":
    "Multiplicative comparison: “$n$ times as many as $a$” equals n × a.",
  "comparison-factor":
    "Multiplicative comparison: the factor relating $b$ to $a$ is b ÷ a.",
  "full-kits":
    "Division with remainder: n = q × d + r with 0 ≤ r < d; the quotient $q$ counts complete groups.",
  "seats-needed":
    "Division with remainder: n = q × d + r; when every item needs a place, the number of groups is q + 1 if r > 0.",
  "kit-leftovers":
    "Division with remainder: n = q × d + r with 0 ≤ r < d; the remainder $r$ is what is left over.",
  "delivery-then-use":
    "Order of operations in context: find the product, then subtract: $g \\times s - \\text{used}$.",
  "purchase-change":
    "Change = payment − cost, where cost = quantity × unit price.",
  // Measurement and geometry
  "shifted-ruler-length":
    "Length is the distance between endpoints: |end − start|. A ruler's starting mark is a position, not a unit.",
  "fractional-ruler-length":
    "Length as iterated units: a length equals the number of equal unit intervals times the length of one interval.",
  "clock-elapsed-minutes":
    "Elapsed time is the difference end − start, with 1 hour = 60 minutes.",
  "metric-length-rename":
    "Unit conversion: to express a length in a smaller unit, multiply by the number of smaller units in one larger unit.",
  "metric-length-reverse":
    "Unit conversion: to express a length in a larger unit, divide by the number of smaller units in one larger unit.",
  "mixed-length-total":
    "Quantities can be added only in a common unit; convert first, then add.",
  "mixed-unit-border":
    "Perimeter of a rectangle: P = 2(l + w), with $l$ and $w$ in the same unit.",
  "rectangle-border-length":
    "Perimeter of a rectangle: P = 2(l + w), since opposite sides are congruent.",
  "rectangle-missing-border-side": "From P = 2(l + w): w = P ÷ 2 − l.",
  "rectangle-area":
    "Area of a rectangle: A = l × w, the number of unit squares that tile it.",
  "rectangle-missing-area-side":
    "From A = l × w: $w = A \\div  l$ (inverse operations).",
  "border-or-cover-unit":
    "Dimension of a unit: length is measured in linear units, area in square units, volume in cubic units.",
  "same-area-border-choice":
    "Area and perimeter are independent measures: rectangles with equal area can have different perimeters.",
  "same-border-area-choice":
    "Area and perimeter are independent measures: for a fixed perimeter, the closer a rectangle is to a square, the greater its area.",
  "rectangle-two-constraints-choice":
    "Factor pairs of the area list every whole-number rectangle with that area; check each against the perimeter P = 2(l + w).",
  "rectangle-existence-choice":
    "A rectangle with whole-number sides, area $A$ and perimeter $P$ exists exactly when some factor pair $(l, w)$ of $A$ satisfies 2(l + w) = P.",
  "whole-pack-ribbon-choice":
    "Ceiling division: when only whole packs are sold, the number of packs is ⌈need ÷ pack size⌉.",
  ...rightTrianglePrinciples,
  "coordinate-point-reading":
    "A point $(x, y)$ on a coordinate grid lies $x$ units across and $y$ units up or down from the origin, the point $(0, 0)$ where the axes cross. Right and up are positive; left and down are negative. The $x$-coordinate always comes first.",
  // Data and probability
  "bar-chart-total":
    "A bar's height on the scale gives its category's frequency; the total is the sum of the frequencies.",
  "bar-chart-difference":
    "Comparing frequencies: the difference between two categories is the larger frequency minus the smaller.",
  "mean-data":
    "The mean (also called the arithmetic mean or average) of a list of numbers is their sum, the result of adding them, divided by how many numbers there are. Every value counts, including repeats. The mean of 4, 6 and 11 is $(4 + 6 + 11) \\div 3 = 7$.",
  "simple-probability":
    "When every outcome (possible result) is equally likely, the probability of an event is the number of favorable outcomes divided by the total number of outcomes. We write $P(\\text{event})$ for it. A probability is always from 0 to 1.",
  // Fractions
  "unit-piece-size":
    "Unit fraction: when a whole is partitioned into $b$ equal parts, each part is 1/b of the whole.",
  "fraction-model":
    "Definition of a fraction: a/b is a parts of size 1/b, where $b$ is the denominator (equal parts in the whole) and a the numerator (parts counted).",
  "fraction-unit-count":
    "A fraction a/b is a copies of the unit fraction 1/b: a/b = a × (1/b).",
  "fraction-line-position":
    "Fractions on the number line: a/b is the point a intervals of length 1/b to the right of 0.",
  "fraction-whole-as-parts": "A whole number as a fraction: n = (n × b)/b.",
  "equivalent-numerator":
    "Fundamental property of fractions: a/b = (a × k)/(b × k) for any nonzero $k$.",
  "equivalent-denominator":
    "Fundamental property of fractions: a/b = (a ÷ k)/(b ÷ k) when $k$ divides both $a$ and $b$.",
  "fraction-equivalence-choice":
    "Fundamental property of fractions: multiplying or dividing numerator and denominator by the same nonzero number gives an equivalent fraction.",
  "compare-fractions":
    "Comparing fractions: with a common denominator, a/d < c/d exactly when a < c.",
  "like-fraction-missing-part":
    "Adding like fractions: a/d + c/d = (a + c)/d; subtraction is its inverse.",
  "like-fraction-difference":
    "Subtracting like fractions: a/d − c/d = (a − c)/d. The denominator names the unit and is unchanged.",
  "mixed-to-improper-numerator":
    "A mixed number $w \\tfrac{a}{b}$ equals (w × b + a)/b.",
  "improper-whole-part":
    "Division with remainder: a/b = q + r/b where a = q × b + r and 0 ≤ r < b.",
  "improper-fractional-part":
    "Division with remainder: a/b = q + r/b; the fractional part is r/b.",
  "mixed-fraction-difference":
    "Regrouping a whole: $w \\tfrac{a}{b} = (w - 1) (a + b)/b$, which allows the fractional parts to be subtracted.",
  "add-fractions":
    "For integers $a,c$ and positive integers $b,d$, $\\frac{a}{b}+\\frac{c}{d}=\\frac{ad+bc}{bd}$. Multiplying a fraction’s numerator and denominator by the same nonzero number preserves its value. With a common denominator, add the numerators and keep the denominator.",
  "unlike-fraction-difference":
    "Subtracting unlike fractions: a/b − c/d = (ad − bc)/(bd), using a common denominator.",
  "fraction-distance-gap":
    "Distance on the number line is the absolute value of the difference: |q − p|.",
  "whole-times-fraction":
    "Multiplying a whole number by a fraction: n × (a/b) = (n × a)/b.",
  "multiply-fractions":
    "Multiplying fractions: (a/b) × (c/d) = (a × c)/(b × d).",
  "fraction-of-quantity": "A fraction of a quantity: (a/b) of n = (a × n)/b.",
  "whole-sharing-fraction": "A fraction as division: a ÷ b = a/b.",
  "fraction-division-expression":
    "For whole numbers $a \\ge 0$ and $b > 0$, $\\frac{a}{b}=a \\div b$. In a sharing model, $b$ people receive equal shares of $a$ wholes, so $b$ copies of the share total $a$ wholes.",
  "unit-fraction-share":
    "Dividing a unit fraction by a whole number: (1/a) ÷ b = 1/(a × b).",
  "fraction-share-amount":
    "Dividing a fraction by $n$ multiplies its denominator by $n$: $\\tfrac{a}{b} \\div n = \\tfrac{a}{b \\times n}$. Here $n$ is a counting number: 1, 2, 3 and so on. Each of the $n$ equal shares is $\\tfrac{1}{n}$ of the amount. Check: $n$ shares of $\\tfrac{a}{b \\times n}$ add back to $\\tfrac{a}{b}$.",
  "whole-unit-groups":
    "Dividing a whole number by a unit fraction: n ÷ (1/b) = n × b.",
  "fraction-group-count":
    "With a common denominator (the same bottom number), dividing fractions divides the numerators: $\\tfrac{a}{d} \\div \\tfrac{c}{d} = a \\div c$, when $c$ and $d$ are not 0. Both fractions count pieces of the same size, $\\tfrac{1}{d}$. So the quotient, the answer to dividing, says how many groups of $c$ pieces fit in $a$ pieces.",
  "divide-fractions":
    "Dividing by a fraction is the same as multiplying by its reciprocal, the fraction flipped: $\\tfrac{a}{b} \\div \\tfrac{c}{d} = \\tfrac{a}{b} \\times \\tfrac{d}{c}$, where $b$, $c$ and $d$ are not 0. It works because $\\tfrac{c}{d} \\times \\tfrac{d}{c} = 1$, so multiplying by $\\tfrac{d}{c}$ undoes multiplying by $\\tfrac{c}{d}$.",
  // Decimals, ratio, percent
  "decimal-addition":
    "Decimal place value: aligning decimal points adds digits of equal place value.",
  "decimal-multiplication":
    "Decimals as fractions: ($a$/10ᵐ$) × (b$/10ⁿ$) = (a × b$)/10ᵐ⁺ⁿ, so the product has m + n decimal places.",
  "ratio-missing":
    "Equivalent ratios are ratios that describe the same mix. Let $a$ and $b$ stand for the two amounts in a ratio. Multiplying both by the same number $k$ greater than 0 keeps the mix: $a : b$ and $ka : kb$ are equivalent ratios. Here $ka$ means $k$ times $a$, and $kb$ means $k$ times $b$. Adding the same number to both usually gives a different mix.",
  "unit-price":
    "The unit price is the cost of one item: total cost ÷ number of items. Proportional means that multiplying one amount by any number multiplies the other by the same number. When every item costs the same, the cost is proportional to the number of items. So cost = unit price × number of items.",
  "percent-of":
    "Percent means per hundred. For a percent $p$ and an amount $n$, $p\\%$ of $n$ is $\\tfrac{p}{100} \\times n$. So $p\\%$ is the fraction $\\tfrac{p}{100}$ of the whole amount, and 100% is the whole amount.",
  "proportional-rule-choice":
    "A proportional relationship has the form $y = kx$, where $k$ is a fixed number called the constant of proportionality. Then $y \\div x = k$ for every input other than 0. Its graph is a straight line through the origin, the point $(0, 0)$.",
  // Integers, expressions, equations
  "integer-addition":
    "Adding integers (whole numbers and their negatives): with the same sign, add the absolute values (distances from 0) and keep that sign. With different signs, subtract the smaller absolute value from the larger, and take the sign of the number with the larger absolute value. If the absolute values are equal, the sum is 0.",
  "number-line-distance":
    "The distance between two numbers $a$ and $b$ on the number line is the larger number minus the smaller. We write it $|a - b|$. The bars mean absolute value: the distance from 0, which is never negative. For example, $|6 - (-7)| = |13| = 13$.",
  "integer-power":
    "Powers: $b^n$ means $n$ factors of $b$ multiplied together. Here $n$ is a counting number, which is one of 1, 2, 3 and so on. Also $b^0 = 1$ when $b$ is not 0. Powers of the same base multiply by adding exponents: $b^{m + n} = b^m \\cdot b^n$. This builds a large power from smaller ones, such as $2^7 = 2^5 \\cdot 2^2$.",
  "operation-order":
    "Order of operations: grouping symbols, then exponents, then multiplication and division left to right, then addition and subtraction left to right.",
  "substitute-linear-expression":
    "Substitution: replace the variable (the letter standing for a number) with the given value, then do the arithmetic. The result is the expression's value at that number.",
  "distributive-expression-choice":
    "Distributive property: writing letters side by side, as in $ab$, means multiply. Then $a(b + c) = ab + ac$ for all real numbers $a$, $b$ and $c$. In words, a number times a sum (the result of adding) equals the number times each part, added together.",
  "combine-like-coefficient":
    "Like terms (terms with the same letter part) combine by adding their coefficients. With letters, $ax + bx = (a + b)x$, where $ax$ means $a$ times $x$. For example, $6x - 8x = (6 - 8)x = -2x$.",
  "linear-equation":
    "Doing the same thing to both sides of an equation keeps them equal. You may add or subtract the same number on both sides. You may also multiply or divide both sides by the same number, as long as it is not 0. Each of these steps keeps the same solutions: the values of $x$ that make the equation true.",
  "negative-coefficient-equation":
    "Dividing both sides of an equation by the same number other than 0, including a negative number, keeps the same solutions. So $-4x = 1$ and $x = -\\tfrac{1}{4}$ have the same solution.",
  "rational-coefficient-equation":
    "A fraction times its reciprocal is 1: $\\tfrac{b}{a} \\times \\tfrac{a}{b} = 1$ when $a$ and $b$ are not 0. So multiplying both sides of $\\tfrac{a}{b}x = c$ by $\\tfrac{b}{a}$ leaves $x$ alone: $x = \\tfrac{b}{a} \\times c$. Doing the same to both sides keeps them equal.",
  "grouped-linear-equation":
    "To solve an equation, undo the operations on the variable (the letter) in the reverse of the order they were done. Doing the same thing to both sides keeps them equal. When $a$ is not 0, dividing both sides by $a$ turns $a(x + b) = c$ into $x + b = \\tfrac{c}{a}$.",
  "both-sides-linear-equation":
    "Adding or subtracting the same term on both sides of an equation keeps the same solutions. So you can collect the $x$ terms on one side and the constants on the other. Then divide both sides by the number multiplying $x$, when that number is not 0.",
  "check-equation-candidate":
    "A solution of an equation is a value that makes both sides equal when it replaces the variable, the letter such as $x$. If the two sides come out different, the value is not a solution.",
  "equation-solution-count":
    "Every linear equation in $x$ can be rewritten as $ax = b$, where $ax$ means $a$ times $x$. If $a$ is not 0, there is exactly one solution, $x = \\tfrac{b}{a}$. If $a = 0$ and $b$ is not 0, there is no solution. If $a = 0$ and $b = 0$, every number is a solution.",
  "linear-system-x":
    "Elimination means removing one variable (unknown letter) by combining the equations. Multiplying an equation by any number except 0 keeps the same solutions. So does replacing one equation with the sum or difference of the two. Choose the numbers to multiply by so that one variable cancels.",
  // Lines and functions
  "line-slope":
    "Slope: $m = \\frac{y_2 - y_1}{x_2 - x_1}$. Here $m$ stands for the slope, and the small numbers 1 and 2 mark which point each coordinate comes from: $(x_1, y_1)$ and $(x_2, y_2)$. The two $x$-coordinates must be different ($x_1 \\ne x_2$). The slope is how much $y$ changes for each increase of 1 in $x$.",
  "graphed-line-slope":
    "Slope: $m = \\tfrac{\\text{rise}}{\\text{run}} = \\tfrac{y_2 - y_1}{x_2 - x_1}$. Here $m$ stands for the slope, and $(x_1, y_1)$ and $(x_2, y_2)$ are two points with different $x$-coordinates. The small numbers 1 and 2 mark which point a coordinate comes from. On a line that is not vertical, any two different points give the same slope.",
  "unequal-step-rate":
    "A linear function is a rule whose graph is a straight line. Its rate of change is the same for every pair of points. For any two points $(x_1, y_1)$ and $(x_2, y_2)$ with different inputs, $\\tfrac{y_2 - y_1}{x_2 - x_1}$ is the same number. The small 1 and 2 mark which point each number comes from.",
  "recover-linear-intercept":
    "The form $y = mx + b$ is called slope-intercept form. In it, $m$ is the slope (the rate) and $b$ is the value of $y$ when $x = 0$. The graph crosses the $y$-axis at $(0, b)$. From one point $(x_1, y_1)$ on the line, $b = y_1 - m x_1$.",
  "linear-initial-value-meaning":
    "For a linear model $y=mx+b$, $x$ is the input, $y$ is the output, $m$ is the number multiplying $x$, and $b$ is the remaining number. Setting $x=0$ gives $y=b$. If zero is an allowed input, $b$ is the output amount there, with output units, and the graph passes through $(0,b)$. The rate $m$ has output units per input unit and describes a change. If zero is outside the allowed inputs, $b$ need not describe an observed starting amount.",
  "predict-linear-output":
    "A linear function is a rule whose graph is a straight line. It changes by equal amounts over equal input steps. Through a known point $(x_1, y_1)$ with rate $m$, the output at input $x$ is $y = y_1 + m(x - x_1)$. Here $m(x - x_1)$ means $m$ times the input change.",
  "graph-equation-choice":
    "Slope-intercept form: the line with slope $m$ through the point $(0, b)$ has the equation $y = mx + b$. Every point $(x, y)$ on the line makes the equation true, and no other point does.",
  "relation-function-choice":
    "A function assigns each input exactly one output. A list of pairs is a function exactly when no input is paired with two different outputs.",
  "relation-point-removal":
    "A relation, a set of input-output pairs, is a function exactly when each input is paired with one output. Suppose the only clash is two points at one input with different outputs. Then removing either one of those two points makes it a function, and removing any other point does not.",
  "distance-graph-meaning":
    "On a distance–time graph, the slope (the steepness) shows how fast the distance changes as time passes. A positive slope (rising) means moving away. A slope of zero (level) means the distance stays the same. A negative slope (falling) means getting closer.",
  "shared-plan-input":
    "Two costs are equal at the input where their graphs cross. To find it, solve the equation that sets them equal. For two straight-line costs whose rates (the numbers multiplying $x$) differ, there is exactly one such input.",
  "first-cheaper-whole-input":
    "A strict inequality is a comparison using < (less than) or > (greater than), so equal values do not count. For two straight-line costs, first find the tie, the input where they are equal. The plan with the smaller rate is cheaper for every input above the tie, and the other plan is cheaper below it. So the smaller-rate plan's first whole input is the next whole number past the tie.",
  "function-evaluation":
    "Function evaluation: $f(a)$ is the output you get by putting $a$ in place of every $x$ in the rule for $f(x)$. A function gives exactly one output for each input.",
  "arithmetic-term":
    "Arithmetic sequence: $a_n = a_1 + (n - 1)d$. Here $a_n$ is term $n$, $a_1$ is the first term, and $d$ is the common difference, the amount added each time. The small letter or number below $a$ gives the term's position.",
  "geometric-sequence":
    "Geometric sequence: $a_n = a_1 \\times r^{n - 1}$. Here $a_n$ is term $n$, $a_1$ is the first term, and $r$ is the common ratio, the number each term is multiplied by. The small letter or number below $a$ gives the term's position.",
  "quadratic-vertex":
    "Vertex form: $f(x) = a(x - h)^2 + k$. The square $(x - h)^2$ is never negative, and it is 0 at $x = h$. So when $a > 0$ ($a$ is positive), the minimum value of $f$ is $k$, reached at $x = h$. The point $(h, k)$ is called the vertex. When $a > 0$, it is the lowest point of the graph.",
  "logarithm-integer":
    "Definition of a logarithm: $\\log_b N = p$ exactly when $b^p = N$, where $b > 0$, $b \\neq 1$ and $N > 0$.",
};
/** Frozen legacy entries, then families from src/families/. */
export const principles: Record<string, string> = withFamilyEntries(
  "principle",
  legacyPrinciples,
  familyRegistry.principles,
);
