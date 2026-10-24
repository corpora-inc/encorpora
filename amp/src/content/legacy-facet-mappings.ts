import type { FacetMapping } from "./coverage";

/** Existing templates mapped to the facets they assess; each rationale states the assessed scope and what is not assessed. */
export const legacyFacetMappings: readonly FacetMapping[] = [
  {
    templateId: "add-fractions",
    facetId: "fraction-addition.core",
    extent: "partial",
    rationale:
      "Enter the sum of two fractions with unlike denominators as a fraction. Does not assess drawing a model, finding a common denominator in writing, mixed-number answers or adding more than two fractions.",
  },
  {
    templateId: "add-ones-regroup",
    facetId: "add-two-digit.core",
    extent: "partial",
    rationale:
      "Given a base-ten block picture of a two-digit number, add a stated number of ones, including sums that make a new ten, and enter the total. Does not assess adding tens, three-digit numbers or writing the regrouping.",
  },
  {
    templateId: "add-several-two-digit",
    facetId: "multiple-addends.core",
    extent: "partial",
    rationale:
      "Enter the total of three or four two-digit addends. Does not assess story contexts, three-digit addends or choosing a strategy.",
  },
  {
    templateId: "add-with-regrouping",
    facetId: "regroup-hundreds.core",
    extent: "partial",
    rationale:
      "Enter the sum of two three-digit numbers written as a horizontal sentence. Does not assess showing regrouping in a written algorithm, sums beyond three digits or story contexts.",
  },
  {
    templateId: "add-within-20",
    facetId: "addition-within-20.core",
    extent: "partial",
    rationale:
      "Enter the sum of two addends within 20 as a number sentence, with an object scene. Does not assess a stated strategy, missing-addend forms or word problems.",
  },
  {
    templateId: "arithmetic-term",
    facetId: "arithmetic-sequences.core",
    extent: "partial",
    rationale:
      "Enter a stated term of an arithmetic sequence from its first term and common difference, with the first term numbered 1. Does not assess a recursive rule, the explicit formula as an expression, finding the difference from terms or a context.",
  },
  {
    templateId: "balanced-addition",
    facetId: "equality.core",
    extent: "partial",
    rationale:
      "Find the missing number in an addition equation with the unknown in the result or on either side of the equals sign, shown on a balance. Does not assess subtraction, other relational meanings of the equals sign or true-false judgments.",
  },
  {
    templateId: "bar-chart-difference",
    facetId: "picture-bar-graphs.core",
    extent: "partial",
    rationale:
      "Read a bar chart of three categories and enter how many more one category has than another. Does not assess drawing a chart, scaled axes, picture graphs or surveys.",
  },
  {
    templateId: "bar-chart-total",
    facetId: "picture-bar-graphs.core",
    extent: "partial",
    rationale:
      "Read a bar chart of three categories and enter the total across all categories. Does not assess drawing a chart, scaled axes or comparing categories.",
  },
  {
    templateId: "border-or-cover-unit",
    facetId: "area-perimeter-models.core",
    extent: "partial",
    rationale:
      "Choose whether a described situation (ribbon around a card, paper covering a face) is measured in length, square or cubic units. Does not assess computing a perimeter or area, converting units or volume.",
  },
  {
    templateId: "both-sides-linear-equation",
    facetId: "linear-equations.core",
    extent: "partial",
    rationale:
      "Enter the solution of a linear equation with a variable on both sides and integer coefficients, including negative coefficients and fractional solutions. Does not assess equations with parentheses, a written justification or word problems.",
  },
  {
    templateId: "check-equation-candidate",
    facetId: "linear-equations.core",
    extent: "partial",
    rationale:
      "Choose the correct substitution check, with both side values and a yes or no verdict, for a stated value in a one-variable linear equation. Does not assess solving the equation, justifying the check in writing or non-linear equations.",
  },
  {
    templateId: "clock-elapsed-minutes",
    facetId: "elapsed-time.core",
    extent: "partial",
    rationale:
      "Read the start time on an analog clock and enter the minutes elapsed until a stated later time that morning. Does not assess crossing noon, telling time to a precise minute from a digital display or elapsed days.",
  },
  {
    templateId: "combine-like-coefficient",
    facetId: "linear-expressions.core",
    extent: "partial",
    rationale:
      "Combine like terms in a linear expression with two x-terms and a constant and enter the resulting coefficient of x. Does not assess multiple variables, distributing or writing the simplified expression.",
  },
  {
    templateId: "compare-fractions",
    facetId: "fraction-comparison.core",
    extent: "partial",
    rationale:
      "Choose the larger of two fractions with different denominators and enter it as a fraction. Does not assess comparison symbols, ordering more than two fractions or a written justification.",
  },
  {
    templateId: "comparison-amount",
    facetId: "multiplicative-comparison.core",
    extent: "partial",
    rationale:
      "Enter how many one quantity has when it is stated as a whole-number multiple of another, in a one-sentence story. Does not assess additive comparison, fractional multiples or drawing a model.",
  },
  {
    templateId: "comparison-factor",
    facetId: "multiplicative-comparison.core",
    extent: "partial",
    rationale:
      "Given two quantities in a one-sentence story with a bar chart, enter how many times as many the larger is as the smaller. Does not assess additive comparison, non-integer factors or writing an equation.",
  },
  {
    templateId: "continue-count-to-120",
    facetId: "tens-and-ones.core",
    extent: "partial",
    rationale:
      "Enter the next number when counting on by ones from a number in the range of the 60s to 110s within 120. Does not assess counting by tens, counting backward or reading numerals aloud.",
  },
  {
    templateId: "coordinate-point-reading",
    facetId: "coordinate-four-quadrants.core",
    extent: "partial",
    rationale:
      "Read the x- or y-coordinate of a labeled point on a coordinate grid, including negative coordinates. Does not assess plotting points, naming quadrants or distance between points.",
  },
  {
    templateId: "count-objects",
    facetId: "count-to-20.core",
    extent: "partial",
    rationale:
      "Count a small collection of dots shown in a picture and enter the number. Does not assess counts above 20, comparing groups or writing numerals.",
  },
  {
    templateId: "decimal-addition",
    facetId: "decimal-arithmetic.core",
    extent: "partial",
    rationale:
      "Enter the sum of two decimals with up to two decimal places. Does not assess subtraction, aligning decimals in writing or contexts.",
  },
  {
    templateId: "decimal-multiplication",
    facetId: "decimal-arithmetic.core",
    extent: "partial",
    rationale:
      "Enter the product of two one-decimal-place numbers as a decimal or fraction. Does not assess division, estimation, placing a decimal point by reasoning or contexts.",
  },
  {
    templateId: "delivery-then-use",
    facetId: "multi-operation-stories.core",
    extent: "partial",
    rationale:
      "Solve a two-step story that groups equal boxes of items and then removes some, entering the remaining amount. Does not assess other operation pairs, multi-digit values or writing the equation.",
  },
  {
    templateId: "distance-graph-meaning",
    facetId: "qualitative-graphs.core",
    extent: "partial",
    rationale:
      "Choose the correct statement about how distance from home changes between two marked points on a coordinate graph of distance against time. Does not assess drawing a graph, computing speed or graphs with curved segments.",
  },
  {
    templateId: "distributive-expression-choice",
    facetId: "expression-properties.core",
    extent: "partial",
    rationale:
      "Choose the expression equal to a multiplier applied to a binomial of the form x plus or minus a constant, with integer multipliers including negatives. Does not assess factoring, binomial products or writing the expansion without choices.",
  },
  {
    templateId: "divide-fractions",
    facetId: "fraction-division.core",
    extent: "partial",
    rationale:
      "Enter the quotient of two fractions as a fraction. Does not assess a visual model, mixed numbers or division in a story context.",
  },
  {
    templateId: "equal-tray-total",
    facetId: "multiplication-meaning.core",
    extent: "partial",
    rationale:
      "Enter the total in a story with equal groups (trays of counters), shown with grouped counters. Does not assess division, arrays or writing the equation.",
  },
  {
    templateId: "equation-solution-count",
    facetId: "linear-equations.core",
    extent: "partial",
    rationale:
      "Choose whether a linear equation in one variable has no solution, exactly one solution, or infinitely many solutions. Does not assess solving to find the value or explaining the structure in writing.",
  },
  {
    templateId: "equivalent-denominator",
    facetId: "fraction-equivalence.core",
    extent: "partial",
    rationale:
      "Find the missing denominator when a fraction is renamed as a unit fraction. Does not assess missing numerators, general equivalent fractions or simplifying to lowest terms.",
  },
  {
    templateId: "equivalent-numerator",
    facetId: "fraction-equivalence.core",
    extent: "partial",
    rationale:
      "Find the missing numerator when a unit fraction is renamed with a stated larger denominator, shown with fraction strips. Does not assess missing denominators, non-unit fractions or simplifying.",
  },
  {
    templateId: "exchange-base-ten",
    facetId: "hundreds-place-value.core",
    extent: "partial",
    rationale:
      "Enter the new count after trading ten ones for a ten or ten tens for a hundred, shown with base-ten blocks. Does not assess trading in the other direction or numbers beyond 999.",
  },
  {
    templateId: "expanded-form-missing",
    facetId: "hundreds-place-value.core",
    extent: "partial",
    rationale:
      "Find the missing part in an expanded form of a three-digit number (hundreds, tens and ones). Does not assess reading numbers aloud, number names or numbers beyond 999.",
  },
  {
    templateId: "factor-partner",
    facetId: "factors-multiples.core",
    extent: "partial",
    rationale:
      "Given a number and one of its factors, enter the other factor of a pair with that product. Does not assess listing all factors, identifying primes or multiples.",
  },
  {
    templateId: "first-cheaper-whole-input",
    facetId: "linear-models.core",
    extent: "partial",
    rationale:
      "Given two linear cost plans, enter the first whole-number input from 0 to 24 at which one plan is strictly cheaper. Does not assess graphing the plans, non-integer inputs or writing an inequality.",
  },
  {
    templateId: "fraction-distance-gap",
    facetId: "fraction-addition.core",
    extent: "partial",
    rationale:
      "Read the distance between two marked points on a number line divided into equal steps per whole, and enter it as a fraction. Does not assess locating a fraction, negative positions or subtracting by writing a number sentence.",
  },
  {
    templateId: "fraction-equivalence-choice",
    facetId: "fraction-equivalence.core",
    extent: "partial",
    rationale:
      "Choose the fraction naming the same amount as a given fraction, with fraction strips. Does not assess finding the equivalent fraction without choices, simplifying or comparing sizes.",
  },
  {
    templateId: "fraction-group-count",
    facetId: "fraction-division.core",
    extent: "partial",
    rationale:
      "Enter how many containerfuls of a stated unit-sized container are in a stated amount, allowing a fractional count, with fraction strips. Does not assess writing the division equation or remainders.",
  },
  {
    templateId: "fraction-line-position",
    facetId: "fractions-number-line.core",
    extent: "partial",
    rationale:
      "Read the value of a labeled point on a number line whose wholes are divided into equal steps. Does not assess placing a point, negative values or comparing positions.",
  },
  {
    templateId: "fraction-model",
    facetId: "fraction-model.core",
    extent: "partial",
    rationale:
      "Enter the fraction of a shaded region in a shape divided into equal parts. Does not assess shading a model, mixed numbers or equivalent fractions.",
  },
  {
    templateId: "fraction-of-quantity",
    facetId: "fraction-multiplication.core",
    extent: "partial",
    rationale:
      "Enter the amount obtained by taking a fraction of a whole-number quantity in a one-sentence story. Does not assess a fraction of a fraction, percent forms or modeling with a diagram.",
  },
  {
    templateId: "fraction-share-amount",
    facetId: "fraction-division.core",
    extent: "partial",
    rationale:
      "Enter the amount each person receives when a fractional amount is shared equally among a whole-number count, with fraction strips. Does not assess dividing a whole number by a fraction or writing the equation.",
  },
  {
    templateId: "fraction-unit-count",
    facetId: "unit-fractions.core",
    extent: "partial",
    rationale:
      "Enter how many unit-fraction pieces are shaded when each whole is cut into a stated number of equal pieces, with fraction strips. Does not assess naming the fraction or equivalent fractions.",
  },
  {
    templateId: "fraction-whole-as-parts",
    facetId: "equivalent-fractions.core",
    extent: "partial",
    rationale:
      "Find the missing numerator when a whole number is written as a fraction with a stated denominator, with fraction strips. Does not assess mixed numbers or improper fractions greater than a whole beyond whole-number values.",
  },
  {
    templateId: "fractional-ruler-length",
    facetId: "ruler-measurement.core",
    extent: "partial",
    rationale:
      "Read the length of a strip on a ruler from zero to a fractional mark and enter it in centimeters as a fraction. Does not assess a ruler offset from zero, estimation or choosing units.",
  },
  {
    templateId: "full-kits",
    facetId: "multistep-whole-stories.core",
    extent: "partial",
    rationale:
      "Enter how many complete groups of a stated size can be made from a whole-number quantity, with grouped counters. Does not assess the remainder, rounding up or multi-step situations.",
  },
  {
    templateId: "function-evaluation",
    facetId: "function-evaluation.core",
    extent: "partial",
    rationale:
      "Enter the value of a given quadratic function written in f(x) notation at a stated integer input, including negative inputs. Does not assess contextual function statements, interpreting the value or other function families.",
  },
  {
    templateId: "geometric-sequence",
    facetId: "geometric-sequences.core",
    extent: "partial",
    rationale:
      "Enter a stated term of a geometric sequence from its first term and positive integer common ratio, with the first term numbered 1. Does not assess negative or fractional ratios, a recursive rule, finding the ratio or a context.",
  },
  {
    templateId: "graph-equation-choice",
    facetId: "linear-models.core",
    extent: "partial",
    rationale:
      "Choose the equation of the line through two plotted points on a coordinate grid, where one point is on the y-axis, from four candidates. Does not assess writing the equation without choices, points off the axes or non-linear graphs.",
  },
  {
    templateId: "graphed-line-slope",
    facetId: "slope.core",
    extent: "partial",
    rationale:
      "Enter the slope, possibly negative or fractional, of the line through two plotted points on a coordinate grid. Does not assess the slope from an equation or table, explaining the rate of change or similar triangles.",
  },
  {
    templateId: "grouped-linear-equation",
    facetId: "linear-equations.core",
    extent: "partial",
    rationale:
      "Enter the solution of a one-variable linear equation in which a binomial is multiplied by an integer coefficient, with possibly fractional solutions. Does not assess variables on both sides, written justification or word problems.",
  },
  {
    templateId: "hundreds-model",
    facetId: "hundreds-place-value.core",
    extent: "partial",
    rationale:
      "Enter the three-digit number shown by a base-ten block model. Does not assess writing the number name, expanded form or numbers beyond 999.",
  },
  {
    templateId: "improper-fractional-part",
    facetId: "mixed-numbers.core",
    extent: "partial",
    rationale:
      "Enter the fractional part left after removing all complete wholes from an improper fraction, with fraction strips. Does not assess writing the full mixed number or converting back.",
  },
  {
    templateId: "improper-whole-part",
    facetId: "mixed-numbers.core",
    extent: "partial",
    rationale:
      "Enter how many complete wholes are in an improper fraction, with fraction strips. Does not assess writing the full mixed number or the remaining fractional part.",
  },
  {
    templateId: "integer-addition",
    facetId: "signed-addition.core",
    extent: "partial",
    rationale:
      "Enter the sum of two integers, including mixed signs and two negatives, written as a sentence. Does not assess subtraction, number-line models, contexts or non-integer values.",
  },
  {
    templateId: "join-within-10",
    facetId: "addition-within-10.core",
    extent: "partial",
    rationale:
      "Enter the total when joining two groups of counters whose total is at most 10, shown on a ten-frame. Does not assess subtraction, missing addends or word problems beyond a described join.",
  },
  {
    templateId: "kit-leftovers",
    facetId: "multistep-whole-stories.core",
    extent: "partial",
    rationale:
      "Enter the remainder after making as many complete groups of a stated size as possible from a whole-number quantity. Does not assess the number of groups, rounding up or writing the division.",
  },
  {
    templateId: "like-fraction-difference",
    facetId: "like-fraction-addition.core",
    extent: "partial",
    rationale:
      "Enter the amount remaining after removing a like-denominator fraction from a larger one in a one-sentence story. Does not assess unlike denominators, mixed numbers or modeling.",
  },
  {
    templateId: "like-fraction-missing-part",
    facetId: "like-fraction-addition.core",
    extent: "partial",
    rationale:
      "Find the missing fraction in an addition sentence with like denominators. Does not assess unlike denominators, mixed numbers or stories.",
  },
  {
    templateId: "line-slope",
    facetId: "slope.core",
    extent: "partial",
    rationale:
      "Enter the slope of the line through two points given as coordinates, with negative or fractional results. Does not assess a graph, an equation or a table, interpreting slope or vertical lines.",
  },
  {
    templateId: "linear-equation",
    facetId: "linear-equations.core",
    extent: "partial",
    rationale:
      "Enter the integer solution of a two-step linear equation of the form ax + b = c. Does not assess variables on both sides, parentheses, fractional coefficients or word problems.",
  },
  {
    templateId: "linear-system-x",
    facetId: "linear-systems.core",
    extent: "partial",
    rationale:
      "Enter the x-value of the solution of a system of two linear equations in standard form with integer coefficients. Does not assess the y-value or checking both equations, counting solutions, graphing or contexts.",
  },
  {
    templateId: "linear-system-x",
    facetId: "linear-systems.HSA.REI.C.6",
    extent: "partial",
    rationale:
      "Enter the x-value of the solution of a system of two linear equations in standard form with integer coefficients. Does not assess the y-value or checking both equations, counting solutions, graphing or contexts.",
  },
  {
    templateId: "logarithm-integer",
    facetId: "logarithms.core",
    extent: "partial",
    rationale:
      "Enter the exact integer value of a logarithm of an integer power of its base. Does not assess non-integer values, reciprocals, change of base, graphs or exponential form.",
  },
  {
    templateId: "make-ten-remainder",
    facetId: "addition-within-20.core",
    extent: "partial",
    rationale:
      "Enter the part left over after moving counters to make ten when adding within 20, shown on a ten-frame. Does not assess the final sum or other strategies.",
  },
  {
    templateId: "mean-data",
    facetId: "statistics-mean.core",
    extent: "partial",
    rationale:
      "Enter the mean of a stated list of five whole numbers shown as a dataset, as a fraction or decimal. Does not assess median, mode, range, graphs or the effect of changing a value.",
  },
  {
    templateId: "measure-whole-pieces",
    facetId: "division-meaning.core",
    extent: "partial",
    rationale:
      "Enter how many equal pieces of a stated length can be cut from a whole-number length. Does not assess remainders, fractional lengths or writing the division.",
  },
  {
    templateId: "metric-length-rename",
    facetId: "unit-conversion.core",
    extent: "partial",
    rationale:
      "Convert a whole number of larger metric length units to a smaller unit (m to cm, km to m). Does not assess other measurements, converting to the larger unit or non-metric units.",
  },
  {
    templateId: "metric-length-reverse",
    facetId: "measurement-conversions.core",
    extent: "partial",
    rationale:
      "Convert a whole number of smaller metric length units to a larger unit (cm to m, m to km) and enter a fraction. Does not assess other measurements, converting to the smaller unit or non-metric units.",
  },
  {
    templateId: "missing-start-story",
    facetId: "addition-stories.core",
    extent: "partial",
    rationale:
      "Find the starting amount of a one-step take-away story given the amount removed and the amount left. Does not assess other unknowns, two-step stories or writing the equation.",
  },
  {
    templateId: "mixed-fraction-difference",
    facetId: "mixed-numbers.core",
    extent: "partial",
    rationale:
      "Enter the difference of two mixed numbers with like denominators, including those that need regrouping a whole, as a fraction or whole number. Does not assess unlike denominators, sums or writing the answer as a mixed number.",
  },
  {
    templateId: "mixed-length-total",
    facetId: "measurement-conversions.core",
    extent: "partial",
    rationale:
      "Enter the total length in the smaller unit when one length is given in meters and another in centimeters. Does not assess other units, perimeter or subtraction.",
  },
  {
    templateId: "mixed-to-improper-numerator",
    facetId: "mixed-numbers.core",
    extent: "partial",
    rationale:
      "Find the numerator when a mixed number is written as a fraction with the same denominator, with fraction strips. Does not assess the reverse conversion or operations with mixed numbers.",
  },
  {
    templateId: "mixed-unit-border",
    facetId: "measurement-conversions.core",
    extent: "partial",
    rationale:
      "Enter the perimeter in the smaller unit of a rectangle whose sides are labeled in two different metric length units. Does not assess area, other units or missing sides.",
  },
  {
    templateId: "multiply-fractions",
    facetId: "fraction-multiplication.core",
    extent: "partial",
    rationale:
      "Enter the product of two unit fractions as a fraction. Does not assess non-unit fractions, mixed numbers, area models or contexts.",
  },
  {
    templateId: "negative-coefficient-equation",
    facetId: "linear-equations.core",
    extent: "partial",
    rationale:
      "Enter the solution of a two-step linear equation with a negative coefficient on x, with possibly fractional solutions. Does not assess variables on both sides, parentheses or word problems.",
  },
  {
    templateId: "neighbor-product-change",
    facetId: "arithmetic-patterns.core",
    extent: "partial",
    rationale:
      "Enter how many squares are added when an array gains one row, shown as a unit array. Does not assess removing a row, changes in columns or writing the product relationship.",
  },
  {
    templateId: "nested-bag-total",
    facetId: "operation-properties.core",
    extent: "partial",
    rationale:
      "Enter the total in a story with three nested equal groups (crates, bags, items), as a product of three factors. Does not assess division, written equations or non-integer groups.",
  },
  {
    templateId: "number-bond-missing",
    facetId: "number-bonds.core",
    extent: "partial",
    rationale:
      "Find the missing part of a number bond within 10, in picture, equation or story form. Does not assess totals above 10.",
  },
  {
    templateId: "number-line-distance",
    facetId: "absolute-value.core",
    extent: "partial",
    rationale:
      "Enter the distance between two marked points on a number line with unit ticks, including points on either side of zero. Does not assess absolute value notation, ordering signed values or non-unit tick marks.",
  },
  {
    templateId: "operation-order",
    facetId: "numerical-expressions.core",
    extent: "partial",
    rationale:
      "Evaluate a whole-number numerical expression with parentheses and mixed addition and multiplication. Does not assess exponents, subtraction or division, nested brackets or writing an expression.",
  },
  {
    templateId: "pairing-leftover",
    facetId: "odd-and-even.core",
    extent: "partial",
    rationale:
      "Enter how many items are left unpaired when a whole number of counters is put into pairs (0 or 1), as an odd or even check. Does not assess naming odd and even or explaining why.",
  },
  {
    templateId: "percent-of",
    facetId: "percentages.core",
    extent: "partial",
    rationale:
      "Enter a stated percent of a whole number as a decimal or fraction. Does not assess finding the whole or the percent, percent change or contexts.",
  },
  {
    templateId: "place-value-digit",
    facetId: "hundreds-place-value.core",
    extent: "partial",
    rationale:
      "Enter the value of a stated digit position in a three-digit number. Does not assess comparing numbers, rounding or numbers beyond 999.",
  },
  {
    templateId: "polynomial-addition",
    facetId: "polynomial-arithmetic.core",
    extent: "partial",
    rationale:
      "Choose the simplified sum of two polynomials of degree at most 3 with integer coefficients, in standard form. Does not assess subtraction, multiplication, writing the sum without choices or closure explanations.",
  },
  {
    templateId: "polynomial-addition",
    facetId: "polynomial-arithmetic.HSA.APR.A.1",
    extent: "partial",
    rationale:
      "Choose the simplified sum of two polynomials of degree at most 3 with integer coefficients, in standard form. Does not assess subtraction, multiplication, writing the sum without choices or closure explanations.",
  },
  {
    templateId: "polynomial-multiplication",
    facetId: "polynomial-arithmetic.core",
    extent: "partial",
    rationale:
      "Choose the expanded product of two integer-coefficient polynomials (monomial by binomial, binomial by binomial or binomial by trinomial). Does not assess factoring, special-product names or closure explanations.",
  },
  {
    templateId: "polynomial-multiplication",
    facetId: "polynomial-arithmetic.HSA.APR.A.1",
    extent: "partial",
    rationale:
      "Choose the expanded product of two integer-coefficient polynomials (monomial by binomial, binomial by binomial or binomial by trinomial). Does not assess factoring, special-product names or closure explanations.",
  },
  {
    templateId: "polynomial-subtraction",
    facetId: "polynomial-arithmetic.core",
    extent: "partial",
    rationale:
      "Choose the simplified difference of two polynomials of degree at most 3 with integer coefficients, in standard form. Does not assess addition, multiplication, writing the difference without choices or closure explanations.",
  },
  {
    templateId: "polynomial-subtraction",
    facetId: "polynomial-arithmetic.HSA.APR.A.1",
    extent: "partial",
    rationale:
      "Choose the simplified difference of two polynomials of degree at most 3 with integer coefficients, in standard form. Does not assess addition, multiplication, writing the difference without choices or closure explanations.",
  },
  {
    templateId: "predict-linear-output",
    facetId: "linear-models.core",
    extent: "partial",
    rationale:
      "Given two points on a linear rule, enter the output at a stated input, with fractional values. Does not assess writing the rule, graphs or contexts.",
  },
  {
    templateId: "proportional-rule-choice",
    facetId: "proportional-relationships.core",
    extent: "partial",
    rationale:
      "Choose which rule among linear candidates is proportional for all inputs. Does not assess non-linear rules, graphs, tables or writing the constant of proportionality.",
  },
  {
    templateId: "purchase-change",
    facetId: "multi-operation-stories.core",
    extent: "partial",
    rationale:
      "Enter the change from a stated payment when buying equal-priced items, in a one-sentence story. Does not assess decimals, tax, multi-item purchases or writing the equation.",
  },
  {
    templateId: "quadratic-expanded-solutions",
    facetId: "quadratic-equations.core",
    extent: "partial",
    rationale:
      "Choose the complete set of real solutions of a quadratic equation written as a trinomial equal to zero, with integer or fractional roots and repeated roots. Does not assess irrational or complex roots, solving without choices or justifying the method.",
  },
  {
    templateId: "quadratic-expanded-solutions",
    facetId: "quadratic-equations.HSA.REI.B.4",
    extent: "partial",
    rationale:
      "Choose the complete set of real solutions of a quadratic equation written as a trinomial equal to zero, with integer or fractional roots and repeated roots. Does not assess irrational or complex roots, solving without choices or justifying the method.",
  },
  {
    templateId: "quadratic-factored-solutions",
    facetId: "quadratic-equations.core",
    extent: "partial",
    rationale:
      "Choose the complete set of real solutions of a quadratic equation given as a product of two linear factors equal to zero, including repeated roots and fractional roots. Does not assess factoring a trinomial, irrational roots or justification.",
  },
  {
    templateId: "quadratic-factored-solutions",
    facetId: "quadratic-equations.HSA.REI.B.4",
    extent: "partial",
    rationale:
      "Choose the complete set of real solutions of a quadratic equation given as a product of two linear factors equal to zero, including repeated roots and fractional roots. Does not assess factoring a trinomial, irrational roots or justification.",
  },
  {
    templateId: "quadratic-real-solution-count",
    facetId: "quadratic-formula.core",
    extent: "partial",
    rationale:
      "Enter how many distinct real solutions (0, 1 or 2) a quadratic equation in standard form has. Does not assess finding the solutions, complex roots or naming the discriminant.",
  },
  {
    templateId: "quadratic-real-solution-count",
    facetId: "quadratic-formula.HSA.REI.B.4",
    extent: "partial",
    rationale:
      "Enter how many distinct real solutions (0, 1 or 2) a quadratic equation in standard form has. Does not assess finding the solutions, complex roots or naming the discriminant.",
  },
  {
    templateId: "quadratic-vertex",
    facetId: "quadratic-minimum.core",
    extent: "partial",
    rationale:
      "Enter the minimum value of an upward-opening quadratic given in vertex form. Does not assess standard-form conversion, maximum values, the vertex location or contexts.",
  },
  {
    templateId: "quadratic-vertex",
    facetId: "quadratic-minimum.HSA.SSE.B.3",
    extent: "partial",
    rationale:
      "Enter the minimum value of an upward-opening quadratic given in vertex form. Does not assess standard-form conversion, maximum values, the vertex location or contexts.",
  },
  {
    templateId: "ratio-missing",
    facetId: "ratios.core",
    extent: "partial",
    rationale:
      "Find the missing quantity in a two-part ratio story by scaling to a stated amount of the second part. Does not assess tables, double number lines, unit rates or non-integer scale factors.",
  },
  {
    templateId: "rational-coefficient-equation",
    facetId: "linear-equations.core",
    extent: "partial",
    rationale:
      "Enter the solution of a two-step linear equation with a fractional coefficient on x. Does not assess variables on both sides, parentheses or word problems.",
  },
  {
    templateId: "recover-linear-intercept",
    facetId: "linear-models.core",
    extent: "partial",
    rationale:
      "Given the rate and one point on a linear rule, enter the output at input 0, with fractional rates. Does not assess graphing, writing the full equation or contexts.",
  },
  {
    templateId: "rectangle-area",
    facetId: "rectangle-area.core",
    extent: "partial",
    rationale:
      "Enter the area of a rectangle from its labeled width and height in a sentence with a rectangle figure. Does not assess perimeter, missing sides or composite figures.",
  },
  {
    templateId: "rectangle-border-length",
    facetId: "perimeter.core",
    extent: "partial",
    rationale:
      "Enter the perimeter of a labeled rectangle in a ribbon-around story with a figure. Does not assess area, missing sides or composite figures.",
  },
  {
    templateId: "rectangle-existence-choice",
    facetId: "area-perimeter-models.core",
    extent: "partial",
    rationale:
      "Given a stated area and perimeter, choose which positive whole-number rectangle exists or that none does. Does not assess non-integer sides, finding the dimensions without choices or justification.",
  },
  {
    templateId: "rectangle-missing-area-side",
    facetId: "area-perimeter-models.core",
    extent: "partial",
    rationale:
      "Find the missing side of a rectangle from its stated area and the other labeled side. Does not assess perimeter, composite figures or non-rectangular shapes.",
  },
  {
    templateId: "rectangle-missing-border-side",
    facetId: "perimeter.core",
    extent: "partial",
    rationale:
      "Find the missing side of a rectangle from its stated perimeter and the other labeled side. Does not assess area, composite figures or non-rectangular shapes.",
  },
  {
    templateId: "rectangle-two-constraints-choice",
    facetId: "area-perimeter-models.core",
    extent: "partial",
    rationale:
      "Choose the positive whole-number rectangle that satisfies a stated area and a perimeter bound. Does not assess non-integer sides, finding every rectangle or justification.",
  },
  {
    templateId: "relation-function-choice",
    facetId: "function-notation.core",
    extent: "partial",
    rationale:
      "Choose which list of input-output pairs represents a function. Does not assess graphs, mapping diagrams, equations or the vertical line test.",
  },
  {
    templateId: "relation-point-removal",
    facetId: "function-notation.core",
    extent: "partial",
    rationale:
      "Given four plotted points of which two share an x-value, choose which points could be removed so the remaining relation is a function. Does not assess tables, equations or drawing a graph.",
  },
  {
    templateId: "same-area-border-choice",
    facetId: "area-perimeter-models.core",
    extent: "partial",
    rationale:
      "Compare two rectangles with equal areas shown in a figure and choose which needs less border, or that they are equal. Does not assess computing exact perimeters or proving the comparison.",
  },
  {
    templateId: "same-border-area-choice",
    facetId: "area-perimeter-models.core",
    extent: "partial",
    rationale:
      "Compare two rectangles with equal perimeters shown in a figure and choose which covers more area, or that they are equal. Does not assess computing exact areas or proving the comparison.",
  },
  {
    templateId: "seats-needed",
    facetId: "multistep-whole-stories.core",
    extent: "partial",
    rationale:
      "Enter the fewest groups needed to hold a whole-number quantity (round the quotient up), with grouped counters. Does not assess the exact remainder, larger numbers or writing the division.",
  },
  {
    templateId: "share-whole-items",
    facetId: "division-meaning.core",
    extent: "partial",
    rationale:
      "Enter how many items each group gets when a whole-number quantity is shared equally. Does not assess remainders, grouping into sets of a given size or fractions.",
  },
  {
    templateId: "shared-plan-input",
    facetId: "linear-systems.core",
    extent: "partial",
    rationale:
      "Enter the input at which two linear cost plans cost the same, with fractional answers allowed. Does not assess graphing, inequalities or choosing the better plan for a range.",
  },
  {
    templateId: "shifted-ruler-length",
    facetId: "ruler-measurement.core",
    extent: "partial",
    rationale:
      "Enter the length of a strip whose ends are marked A and B on a ruler that does not start at zero, as a fraction in centimeters. Does not assess a ruler starting at zero or choosing units.",
  },
  {
    templateId: "simple-probability",
    facetId: "probability.core",
    extent: "partial",
    rationale:
      "Enter the probability of a single draw of one color from a bag of two colors of equally likely counters. Does not assess compound events, without-replacement draws or experimental probability.",
  },
  {
    templateId: "skip-count-missing",
    facetId: "skip-counting.core",
    extent: "partial",
    rationale:
      "Enter the next number when counting by a stated step from a stated start, within about 350. Does not assess missing middle terms or counting backward.",
  },
  {
    templateId: "small-array-total",
    facetId: "arrays.core",
    extent: "partial",
    rationale:
      "Enter the total number of unit squares in a small rectangular array. Does not assess writing the multiplication sentence or larger arrays.",
  },
  {
    templateId: "split-array-part",
    facetId: "operation-properties.core",
    extent: "partial",
    rationale:
      "Enter the number of unit squares in one region of an array split into two regions. Does not assess the total or writing the distributive sentence.",
  },
  {
    templateId: "substitute-linear-expression",
    facetId: "variable-expressions.core",
    extent: "partial",
    rationale:
      "Enter the value of a linear expression in x for a stated integer or fractional value of x. Does not assess simplifying, quadratic expressions or writing an expression.",
  },
  {
    templateId: "subtract-through-ten",
    facetId: "subtraction-within-20.core",
    extent: "partial",
    rationale:
      "Enter the amount still to subtract after taking away enough to reach ten when subtracting within 20. Does not assess the final difference or other strategies.",
  },
  {
    templateId: "subtract-whole-tens",
    facetId: "ten-more-less.core",
    extent: "partial",
    rationale:
      "Enter the result of taking away ten from a multiple of ten, shown with base-ten blocks. Does not assess subtracting non-multiples of ten or regrouping.",
  },
  {
    templateId: "subtract-with-regrouping",
    facetId: "regroup-hundreds.core",
    extent: "partial",
    rationale:
      "Enter the difference of two three-digit numbers written as a horizontal sentence. Does not assess showing regrouping in a written algorithm or story contexts.",
  },
  {
    templateId: "subtract-within-20",
    facetId: "subtraction-within-20.core",
    extent: "partial",
    rationale:
      "Enter the difference of two numbers within 20 as a number sentence. Does not assess a stated strategy, missing-number forms or word problems.",
  },
  {
    templateId: "take-away-within-10",
    facetId: "subtraction-within-10.core",
    extent: "partial",
    rationale:
      "Enter how many are left when counters are taken away within 10, shown on a ten-frame. Does not assess missing subtrahends or word problems beyond a described take-away.",
  },
  {
    templateId: "teen-frame-compose",
    facetId: "teen-place-value.core",
    extent: "partial",
    rationale:
      "Enter the total counters in a full ten-frame plus a partial second frame, for numbers 11 to 19. Does not assess writing the number as ten and ones or adding beyond 19.",
  },
  {
    templateId: "ten-frame-complement",
    facetId: "make-ten.core",
    extent: "partial",
    rationale:
      "Enter how many more counters fill a partly filled ten-frame. Does not assess totals other than ten or writing the number bond.",
  },
  {
    templateId: "ten-more-or-less",
    facetId: "ten-more-less.core",
    extent: "partial",
    rationale:
      "Enter the number that is ten more or ten less than a stated two-digit number, shown with base-ten blocks. Does not assess one or one hundred more or less or numbers beyond 99.",
  },
  {
    templateId: "tens-contribution",
    facetId: "whole-multiplication.core",
    extent: "partial",
    rationale:
      "Enter the tens partial product when a two-digit factor is split into tens and ones to multiply by a one-digit factor. Does not assess the ones partial product, the final product or an area model drawing.",
  },
  {
    templateId: "tens-ones-model",
    facetId: "tens-and-ones.core",
    extent: "partial",
    rationale:
      "Enter the two-digit number shown by tens and ones blocks. Does not assess hundreds, expanded form or number names.",
  },
  {
    templateId: "three-addend-story",
    facetId: "three-addends.core",
    extent: "partial",
    rationale:
      "Enter the total of three addends given in a story or as a number sentence, shown with addend groups. Does not assess subtraction, missing addends or four or more addends.",
  },
  {
    templateId: "two-step-change",
    facetId: "two-step-stories.core",
    extent: "partial",
    rationale:
      "Solve a two-step add-then-subtract story in which the unknown is the start, the end or the second change, shown with a change chain. Does not assess other operation pairs or writing the equations.",
  },
  {
    templateId: "unequal-step-rate",
    facetId: "slope.core",
    extent: "partial",
    rationale:
      "Given three points on a linear rule with unequal input steps, enter the output change per input unit, with fractional and negative rates. Does not assess writing the equation, graphs or contexts.",
  },
  {
    templateId: "unit-fraction-share",
    facetId: "unit-fraction-division.core",
    extent: "partial",
    rationale:
      "Enter the amount each person receives when a unit fraction is shared equally among a whole-number count, with fraction strips. Does not assess non-unit fractions or dividing a whole by a unit fraction.",
  },
  {
    templateId: "unit-piece-size",
    facetId: "unit-fractions.core",
    extent: "partial",
    rationale:
      "Enter the fraction naming one piece when a whole strip is divided into equal pieces. Does not assess non-unit fractions, counting pieces or equivalent fractions.",
  },
  {
    templateId: "unit-price",
    facetId: "proportional-relationships.core",
    extent: "partial",
    rationale:
      "Find the cost of a different count of identical items given the cost of one count, using the unit price. Does not assess writing the proportional equation, graphs or non-integer unit prices.",
  },
  {
    templateId: "unknown-addend-story",
    facetId: "missing-addend.core",
    extent: "partial",
    rationale:
      "Find the missing addend in an addition equation or an add-to story, shown with a bar model. Does not assess other unknown positions, subtraction or two-step stories.",
  },
  {
    templateId: "unknown-dividend",
    facetId: "missing-factor.core",
    extent: "partial",
    rationale:
      "Find the missing dividend in a division equation with the divisor and quotient known. Does not assess a missing divisor, remainders or stories.",
  },
  {
    templateId: "unknown-group-size",
    facetId: "missing-factor.core",
    extent: "partial",
    rationale:
      "Enter the size of each group when a total is shared into a stated number of equal groups, in a story. Does not assess the number of groups, remainders or written equations.",
  },
  {
    templateId: "unlike-fraction-difference",
    facetId: "fraction-addition.core",
    extent: "partial",
    rationale:
      "Enter the difference of two fractions with different denominators as a fraction. Does not assess mixed numbers, sums or modeling.",
  },
  {
    templateId: "whole-pack-ribbon-choice",
    facetId: "multistep-whole-stories.core",
    extent: "partial",
    rationale:
      "Choose the cheaper of a whole-pack offer and a per-unit offer for a needed amount that is not a multiple of the pack. Does not assess more than two offers, unit rates in isolation or writing the cost expressions.",
  },
  {
    templateId: "whole-times-fraction",
    facetId: "fraction-times-whole.core",
    extent: "partial",
    rationale:
      "Enter the total when a whole number of equal containers each hold a fractional amount, with fraction strips. Does not assess multiplying two fractions or mixed numbers.",
  },
  {
    templateId: "whole-unit-groups",
    facetId: "unit-fraction-division.core",
    extent: "partial",
    rationale:
      "Enter how many unit-fraction-sized containers can be filled from one whole, with fraction strips. Does not assess dividing non-unit amounts or remainders.",
  },
  {
    templateId: "zero-one-groups",
    facetId: "multiplication-meaning.core",
    extent: "partial",
    rationale:
      "Enter the total in an equal-groups story where the group count or group size is 0 or 1. Does not assess other multipliers, division or writing the product.",
  },
];
