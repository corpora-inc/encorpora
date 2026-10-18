import { inequalityPrinciples } from "./inequality-lessons";
import { rightTrianglePrinciples } from "./right-triangle-lessons";
import { polynomialPrinciples } from "./polynomial-lessons";
import { quadraticPrinciples } from "./quadratic-lessons";
/** The mathematics each problem type rests on, named precisely and stated in
 * general form. Shown in every lesson so learners meet the real vocabulary. */
export const principles: Record<string, string> = {
  ...quadraticPrinciples,
  ...polynomialPrinciples,
  ...inequalityPrinciples,
  // Counting, place value, early operations
  "count-objects":
    "One-to-one correspondence: each object is matched with exactly one counting number; the last number named is the cardinality of the set.",
  "join-within-10":
    "Addition joins two sets: the cardinality of the union of disjoint sets is the sum of their cardinalities.",
  "take-away-within-10":
    "Subtraction removes a part from a whole: whole − part = remaining part, and part + remaining part = whole.",
  "number-bond-missing":
    "Part–whole relationship: if a + b = c, then b = c − a. Addition and subtraction are inverse operations.",
  "ten-frame-complement":
    "Complements of ten: a + (10 − a) = 10. Knowing these pairs is the basis of making ten.",
  "teen-frame-compose":
    "Place value: a teen number is one ten and some ones, so 10 + n is written 1n.",
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
    "Base-ten counting: after 9 ones, the ones reset to 0 and the tens increase by 1.",
  "tens-ones-model":
    "Place value in base ten: a two-digit number ab has value 10a + b.",
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
    "Expanded form writes a number as the sum of its place values: abc = 100a + 10b + c.",
  "exchange-base-ten":
    "Equivalent representations: 10 units of one place equal 1 unit of the next place; regrouping preserves value.",
  "skip-count-missing":
    "An arithmetic pattern adds the same difference d each step: next = previous + d.",
  "add-several-two-digit":
    "Commutative and associative properties: sum the tens and the ones separately, then combine.",
  "add-with-regrouping":
    "The standard addition algorithm adds by place value, regrouping 10 of one place into 1 of the next.",
  "subtract-with-regrouping":
    "The standard subtraction algorithm subtracts by place value, decomposing 1 of a higher place into 10 of the next lower place when needed.",
  "two-step-change":
    "Operations on a quantity are applied in order: (start + added) − removed.",
  // Multiplication and division
  "small-array-total":
    "Multiplication as an array: r rows of c objects contain r × c objects.",
  "pairing-leftover":
    "Parity: an integer is even when it is divisible by 2 (remainder 0) and odd when the remainder is 1.",
  "multiply-facts":
    "Multiplication is repeated addition of equal groups; it is commutative (a × b = b × a) and distributes over addition (a × (b + c) = a × b + a × c).",
  "divide-facts":
    "Division is the inverse of multiplication: a ÷ b = c exactly when b × c = a (b ≠ 0).",
  "equal-tray-total":
    "Multiplication counts equal groups: g groups of s items contain g × s items.",
  "share-whole-items":
    "Partitive division: sharing a total equally among n groups gives total ÷ n in each group.",
  "measure-whole-pieces":
    "Quotative (measurement) division: total ÷ size counts how many groups of that size fit.",
  "unknown-group-size":
    "Inverse operations: g × ? = total means ? = total ÷ g.",
  "unknown-dividend": "Inverse operations: ? ÷ a = b means ? = a × b.",
  "split-array-part":
    "Distributive property: an array a × (b + c) splits into the partial products a × b and a × c.",
  "nested-bag-total":
    "Associative property of multiplication: (a × b) × c = a × (b × c).",
  "zero-one-groups":
    "Zero property: a × 0 = 0. Multiplicative identity: a × 1 = a.",
  "neighbor-product-change":
    "Distributive property: (n + 1) × s = n × s + s, so the next product is one group larger.",
  "factor-partner":
    "Factor pairs: if a × b = n, then b = n ÷ a; a and b are factors of n.",
  "tens-contribution":
    "Distributive property of multiplication over addition: (10a + b) × c = 10a × c + b × c.",
  "comparison-amount":
    "Multiplicative comparison: “n times as many as a” equals n × a.",
  "comparison-factor":
    "Multiplicative comparison: the factor relating b to a is b ÷ a.",
  "full-kits":
    "Division with remainder: n = q × d + r with 0 ≤ r < d; the quotient q counts complete groups.",
  "seats-needed":
    "Division with remainder: n = q × d + r; when every item needs a place, the number of groups is q + 1 if r > 0.",
  "kit-leftovers":
    "Division with remainder: n = q × d + r with 0 ≤ r < d; the remainder r is what is left over.",
  "delivery-then-use":
    "Order of operations in context: find the product, then subtract: g × s − used.",
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
    "Perimeter of a rectangle: P = 2(l + w), with l and w in the same unit.",
  "rectangle-border-length":
    "Perimeter of a rectangle: P = 2(l + w), since opposite sides are congruent.",
  "rectangle-missing-border-side": "From P = 2(l + w): w = P ÷ 2 − l.",
  "rectangle-area":
    "Area of a rectangle: A = l × w, the number of unit squares that tile it.",
  "rectangle-missing-area-side":
    "From A = l × w: w = A ÷ l (inverse operations).",
  "border-or-cover-unit":
    "Dimension of a unit: length is measured in linear units, area in square units, volume in cubic units.",
  "same-area-border-choice":
    "Area and perimeter are independent measures: rectangles with equal area can have different perimeters.",
  "same-border-area-choice":
    "Area and perimeter are independent measures: for a fixed perimeter, the closer a rectangle is to a square, the greater its area.",
  "rectangle-two-constraints-choice":
    "Factor pairs of the area list every whole-number rectangle with that area; check each against the perimeter P = 2(l + w).",
  "rectangle-existence-choice":
    "A rectangle with whole-number sides, area A and perimeter P exists exactly when some factor pair (l, w) of A satisfies 2(l + w) = P.",
  "whole-pack-ribbon-choice":
    "Ceiling division: when only whole packs are sold, the number of packs is ⌈need ÷ pack size⌉.",
  ...rightTrianglePrinciples,
  "coordinate-point-reading":
    "Cartesian coordinates: a point (x, y) lies x units horizontally and y units vertically from the origin.",
  // Data and probability
  "bar-chart-total":
    "A bar's height on the scale gives its category's frequency; the total is the sum of the frequencies.",
  "bar-chart-difference":
    "Comparing frequencies: the difference between two categories is the larger frequency minus the smaller.",
  "mean-data":
    "The arithmetic mean of n values is their sum divided by n: (x₁ + … + xₙ) ÷ n.",
  "simple-probability":
    "Classical probability: for equally likely outcomes, P(event) = favorable outcomes ÷ total outcomes.",
  // Fractions
  "unit-piece-size":
    "Unit fraction: when a whole is partitioned into b equal parts, each part is 1/b of the whole.",
  "fraction-model":
    "Definition of a fraction: a/b is a parts of size 1/b, where b is the denominator (equal parts in the whole) and a the numerator (parts counted).",
  "fraction-unit-count":
    "A fraction a/b is a copies of the unit fraction 1/b: a/b = a × (1/b).",
  "fraction-line-position":
    "Fractions on the number line: a/b is the point a intervals of length 1/b to the right of 0.",
  "fraction-whole-as-parts": "A whole number as a fraction: n = (n × b)/b.",
  "equivalent-numerator":
    "Fundamental property of fractions: a/b = (a × k)/(b × k) for any nonzero k.",
  "equivalent-denominator":
    "Fundamental property of fractions: a/b = (a ÷ k)/(b ÷ k) when k divides both a and b.",
  "fraction-equivalence-choice":
    "Fundamental property of fractions: multiplying or dividing numerator and denominator by the same nonzero number gives an equivalent fraction.",
  "compare-fractions":
    "Comparing fractions: with a common denominator, a/d < c/d exactly when a < c.",
  "like-fraction-missing-part":
    "Adding like fractions: a/d + c/d = (a + c)/d; subtraction is its inverse.",
  "like-fraction-difference":
    "Subtracting like fractions: a/d − c/d = (a − c)/d. The denominator names the unit and is unchanged.",
  "mixed-to-improper-numerator": "A mixed number w a/b equals (w × b + a)/b.",
  "improper-whole-part":
    "Division with remainder: a/b = q + r/b where a = q × b + r and 0 ≤ r < b.",
  "improper-fractional-part":
    "Division with remainder: a/b = q + r/b; the fractional part is r/b.",
  "mixed-fraction-difference":
    "Regrouping a whole: w a/b = (w − 1) (a + b)/b, which allows the fractional parts to be subtracted.",
  "add-fractions":
    "Adding unlike fractions: a/b + c/d = (ad + bc)/(bd), by rewriting both with a common denominator.",
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
  "unit-fraction-share":
    "Dividing a unit fraction by a whole number: (1/a) ÷ b = 1/(a × b).",
  "fraction-share-amount":
    "Dividing a fraction by a whole number: (a/b) ÷ n = a/(b × n).",
  "whole-unit-groups":
    "Dividing a whole number by a unit fraction: n ÷ (1/b) = n × b.",
  "fraction-group-count":
    "Dividing fractions with a common denominator: (a/d) ÷ (c/d) = a ÷ c.",
  "divide-fractions":
    "Dividing by a fraction is multiplying by its reciprocal: (a/b) ÷ (c/d) = (a/b) × (d/c), with c ≠ 0.",
  // Decimals, ratio, percent
  "decimal-addition":
    "Decimal place value: aligning decimal points adds digits of equal place value.",
  "decimal-multiplication":
    "Decimals as fractions: (a/10ᵐ) × (b/10ⁿ) = (a × b)/10ᵐ⁺ⁿ, so the product has m + n decimal places.",
  "ratio-missing": "Equivalent ratios: a : b = ka : kb for any positive k.",
  "unit-price":
    "Unit rate: price per item = total cost ÷ number of items; cost is proportional to quantity.",
  "percent-of": "Percent means per hundred: p% of n = (p/100) × n.",
  "proportional-rule-choice":
    "A proportional relationship has the form y = kx, with constant of proportionality k; its graph passes through the origin.",
  // Integers, expressions, equations
  "integer-addition":
    "Adding integers: with like signs, add absolute values and keep the sign; with unlike signs, subtract absolute values and take the sign of the larger.",
  "number-line-distance":
    "The distance between a and b on the number line is |a − b|.",
  "integer-power":
    "Exponent notation: bⁿ = b × b × … × b (n factors), and b⁰ = 1 for b ≠ 0.",
  "operation-order":
    "Order of operations: grouping symbols, then exponents, then multiplication and division left to right, then addition and subtraction left to right.",
  "substitute-linear-expression":
    "Substitution: replacing a variable with a value evaluates the expression at that value.",
  "distributive-expression-choice":
    "Distributive property of multiplication over addition: a(b + c) = ab + ac, for all real numbers a, b, c.",
  "combine-like-coefficient":
    "Distributive property: ax + bx = (a + b)x, so like terms combine by adding their coefficients.",
  "linear-equation":
    "Properties of equality: adding, subtracting, multiplying or dividing both sides by the same number (nonzero for division) preserves the solutions.",
  "negative-coefficient-equation":
    "Multiplication property of equality: dividing both sides by a nonzero number, including a negative one, preserves the solutions.",
  "rational-coefficient-equation":
    "Multiplicative inverse: (b/a) × (a/b) = 1, so multiplying both sides by the reciprocal isolates the variable.",
  "grouped-linear-equation":
    "Properties of equality: undo operations in the reverse order they were applied to the variable.",
  "both-sides-linear-equation":
    "Addition property of equality: subtracting the same term from both sides collects the variable on one side.",
  "check-equation-candidate":
    "A solution of an equation is a value that makes both sides equal when substituted.",
  "equation-solution-count":
    "A linear equation reduces to ax = b: one solution if a ≠ 0; none if a = 0 and b ≠ 0; infinitely many if a = 0 and b = 0.",
  "linear-system-x":
    "Elimination: adding multiples of equations produces an equivalent system; choose multiples that eliminate one variable.",
  // Lines and functions
  "line-slope":
    "Slope: m = (y₂ − y₁)/(x₂ − x₁), the rate of change of y with respect to x.",
  "graphed-line-slope":
    "Slope: m = rise/run = (y₂ − y₁)/(x₂ − x₁). It is constant along a line.",
  "unequal-step-rate":
    "A linear function has a constant rate of change: (y₂ − y₁)/(x₂ − x₁) is the same for every pair of points.",
  "recover-linear-intercept":
    "Slope-intercept form y = mx + b: b is the value of y when x = 0.",
  "predict-linear-output":
    "Linear functions change by equal amounts over equal intervals: y = y₁ + m(x − x₁).",
  "graph-equation-choice":
    "Slope-intercept form: the line through (0, b) with slope m is y = mx + b.",
  "relation-function-choice":
    "Definition of a function: each input is assigned exactly one output.",
  "distance-graph-meaning":
    "On a distance–time graph, slope is the rate of change of distance: positive means moving away, zero means constant distance, negative means approaching.",
  "shared-plan-input":
    "Two linear expressions are equal where their graphs intersect: solve f(x) = g(x).",
  "first-cheaper-whole-input":
    "Solving a strict linear inequality: find the boundary where f(x) = g(x), then the inequality holds on one side of it.",
  "function-evaluation":
    "Function evaluation: f(a) is the output obtained by substituting a for every x in the rule.",
  "arithmetic-term":
    "Arithmetic sequence: aₙ = a₁ + (n − 1)d, where d is the common difference.",
  "geometric-sequence":
    "Geometric sequence: aₙ = a₁ × rⁿ⁻¹, where r is the common ratio.",
  "quadratic-vertex":
    "Vertex form f(x) = a(x − h)² + k: since (x − h)² ≥ 0, when a > 0 the minimum value is k, at x = h.",
  "logarithm-integer":
    "Definition of a logarithm: $\\log_b N = p$ exactly when $b^p = N$, where $b > 0$, $b \\neq 1$ and $N > 0$.",
};
