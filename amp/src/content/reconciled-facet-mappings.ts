import type { FacetMapping } from "./coverage";

/** Existing templates mapped to the facets they assess, found by reconciling every facet that had no mapping with the generated practice. Each rationale states the assessed scope and what is not assessed. */
export const reconciledFacetMappings: readonly FacetMapping[] = [
  {
    templateId: "absolute-value-affine-equation",
    facetId: "absolute-value-equations.core",
    extent: "partial",
    rationale:
      "Choose the complete real solution set of an equation whose absolute value contains a linear expression, including constants on the right side that give no real solution. Does not assess entering numeric solutions, checking for extraneous solutions or contexts.",
  },
  {
    templateId: "absolute-value-direct-equation",
    facetId: "absolute-value-equations.core",
    extent: "partial",
    rationale:
      "Choose the complete real solution set of an equation of the form absolute value of x equals a rational constant, including a negative constant that gives no real solution. Does not assess entering numeric solutions, equations with an inner linear expression, checking solutions or contexts.",
  },
  {
    templateId: "absolute-value-transformed-equation",
    facetId: "absolute-value-equations.core",
    extent: "partial",
    rationale:
      "Isolate an absolute-value expression with a coefficient and added constant, then choose the complete real solution set, including the single-solution case when the isolated value is zero. Does not assess equations with absolute values on both sides, entering numeric solutions or contexts.",
  },
  {
    templateId: "add-three-digit",
    facetId: "add-subtract-thousands.core",
    extent: "partial",
    rationale:
      "Enter the sum of two three-digit numbers with a numeric answer. Does not assess sums with a stated strategy, story contexts or estimation.",
  },
  {
    templateId: "subtract-three-digit",
    facetId: "add-subtract-thousands.core",
    extent: "partial",
    rationale:
      "Enter the difference of two three-digit numbers with a numeric answer. Does not assess stated strategies, story contexts or estimation.",
  },
  {
    templateId: "make-ten-fact",
    facetId: "addition-facts.core",
    extent: "partial",
    rationale:
      "Enter a sum within 20 that crosses ten, shown on a pair of ten frames. Does not assess subtraction facts, fluency under time or word problems.",
  },
  {
    templateId: "related-subtraction",
    facetId: "addition-facts.core",
    extent: "partial",
    rationale:
      "Enter the difference of a subtraction fact within 20 by thinking of the related addition fact. Does not assess addition recall, fluency under time or word problems.",
  },
  {
    templateId: "add-two-digit-regroup",
    facetId: "addition-within-100.core",
    extent: "partial",
    rationale:
      "Enter the sum of two two-digit numbers that regroups ones into a tens, shown with base-ten blocks. Does not assess a written algorithm, three or more addends or story contexts.",
  },
  {
    templateId: "make-hundred",
    facetId: "addition-within-100.core",
    extent: "partial",
    rationale:
      "Find the missing addend that makes one hundred from a two-digit number. Does not assess sums other than one hundred or written regrouping.",
  },
  {
    templateId: "adjacent-angles",
    facetId: "angle-measure.core",
    extent: "partial",
    rationale:
      "Add or subtract non-overlapping adjacent angle measures, including a right angle or a straight angle split into two parts, and enter the unknown measure. Does not assess measuring with a protractor or equation-based unknowns.",
  },
  {
    templateId: "protractor-reading",
    facetId: "angle-measure.core",
    extent: "partial",
    rationale:
      "Read the degree measure of an angle from a protractor figure. Does not assess using a physical protractor to draw or measure, or estimating angle size.",
  },
  {
    templateId: "angle-equation",
    facetId: "angle-relationships.core",
    extent: "partial",
    rationale:
      "Write and solve a linear equation from angle expressions that are vertical, supplementary or complementary and enter the angle or the variable. Does not assess proofs or naming angle pairs.",
  },
  {
    templateId: "angle-pair-measure",
    facetId: "angle-relationships.core",
    extent: "partial",
    rationale:
      "Find an unknown angle from a straight line, vertical angles or a right angle with a given adjacent angle and enter it in degrees. Does not assess naming the relationship, algebraic angle expressions or proofs.",
  },
  {
    templateId: "compare-irrational-values",
    facetId: "approximate-roots.core",
    extent: "partial",
    rationale:
      "Choose the greatest or least among irrational and rational values by estimating their size. Does not assess ordering more than the choices shown or placing values on a number line.",
  },
  {
    templateId: "root-between-integers",
    facetId: "approximate-roots.core",
    extent: "partial",
    rationale:
      "Locate a square root between two consecutive whole numbers. Does not assess cube roots, number-line placement or decimal approximation.",
  },
  {
    templateId: "root-nearest-tenth",
    facetId: "approximate-roots.core",
    extent: "partial",
    rationale:
      "Approximate a square root to the nearest tenth by entering a decimal. Does not assess hand-iteration methods or cube roots.",
  },
  {
    templateId: "arc-length-coefficient",
    facetId: "arc-sector-measure.core",
    extent: "partial",
    rationale:
      "Find the arc length as a multiple of pi from a radius and a central angle in degrees. Does not assess radian measure, finding the angle from the arc or deriving the formula.",
  },
  {
    templateId: "sector-area-coefficient",
    facetId: "arc-sector-measure.core",
    extent: "partial",
    rationale:
      "Find the sector area as a multiple of pi from a radius and a central angle in degrees. Does not assess radian measure, finding the angle from the area or deriving the formula.",
  },
  {
    templateId: "series-recursion",
    facetId: "arithmetic-sequences.HSF.BF.A.2",
    extent: "partial",
    rationale:
      "Translate between a recursive rule with a first term and a common difference and the explicit rule of an arithmetic sequence, and find a later term from two stated terms. Does not assess geometric sequences, writing a rule as free text or contexts.",
  },
  {
    templateId: "series-recursion",
    facetId: "arithmetic-sequences.HSF.LE.A.2",
    extent: "partial",
    rationale:
      "Construct an arithmetic sequence from two terms given in a table and find a later term. Does not assess geometric sequences, graphs as the source or contexts.",
  },
  {
    templateId: "average-rate-display",
    facetId: "average-rate-change.HSF.IF.B.6",
    extent: "partial",
    rationale:
      "Calculate the average rate of change over an interval from a table or labeled graph points. Does not assess writing an interpretation or estimating from an unlabeled curve.",
  },
  {
    templateId: "average-rate-formula",
    facetId: "average-rate-change.HSF.IF.B.6",
    extent: "partial",
    rationale:
      "Calculate the average rate of change over an interval from two function values or from a formula, including one stated with units. Does not assess interpreting the rate in a written sentence.",
  },
  {
    templateId: "average-rate-display",
    facetId: "average-rate-change.core",
    extent: "partial",
    rationale:
      "Compute the average rate of change over an interval from a table, including a temperature-versus-time table, or from labeled points on a graph. Does not assess estimating from an unlabeled curve.",
  },
  {
    templateId: "average-rate-formula",
    facetId: "average-rate-change.core",
    extent: "partial",
    rationale:
      "Compute the average rate of change over an interval from two function values or from a formula, including a ball-height formula with units, and enter it as a fraction. Does not assess reading a graph or table.",
  },
  {
    templateId: "binomial-coefficient",
    facetId: "binomial-theorem.HSA.APR.C.5",
    extent: "partial",
    rationale:
      "Identify Pascal-triangle rows and the coefficient of a term in the expansion of a binomial raised to a small positive integer power. Does not assess writing the full expansion or applying the theorem in general form.",
  },
  {
    templateId: "conditional-frequency-choice",
    facetId: "categorical-association.HSS.ID.B.5",
    extent: "partial",
    rationale:
      "Read conditional relative frequencies from a two-way table and decide whether the table shows an association between two categorical variables. Does not assess constructing a table from raw data.",
  },
  {
    templateId: "relative-frequency-percent",
    facetId: "categorical-association.HSS.ID.B.5",
    extent: "partial",
    rationale:
      "Read joint and marginal relative frequencies from a two-way table of two categorical variables. Does not assess constructing a table from raw data or judging association.",
  },
  {
    templateId: "conditional-frequency-choice",
    facetId: "categorical-association.core",
    extent: "partial",
    rationale:
      "Choose a conditional percent from a two-way table, choose which calculation answers a question about the table, and decide whether the table shows an association. Does not assess building the table.",
  },
  {
    templateId: "relative-frequency-percent",
    facetId: "categorical-association.core",
    extent: "partial",
    rationale:
      "Compute joint, marginal and conditional percents from a two-way table. Does not assess building the table or judging whether an association exists.",
  },
  {
    templateId: "picture-graph-questions",
    facetId: "categorical-data.core",
    extent: "partial",
    rationale:
      "Read a picture graph and answer a counting or comparison question about the categories, such as the total or how many fewer chose one than another. Does not assess drawing a graph or bar graphs.",
  },
  {
    templateId: "causal-claim-choice",
    facetId: "causal-claims.HSS.ID.C.9",
    extent: "partial",
    rationale:
      "Distinguish association from causation in a described observational result, including a reversed-cause explanation. Does not assess computing a correlation coefficient.",
  },
  {
    templateId: "causal-claim-choice",
    facetId: "causal-claims.core",
    extent: "partial",
    rationale:
      "Choose which conclusion data from a described association support, and spot an explanation that reverses cause and effect. Does not assess computing correlation.",
  },
  {
    templateId: "study-design-choice",
    facetId: "causal-claims.core",
    extent: "partial",
    rationale:
      "Choose which study design can show a cause. Does not assess carrying out randomization or analyzing data.",
  },
  {
    templateId: "circle-equation",
    facetId: "circle-equations.HSG.GPE.A.1",
    extent: "partial",
    rationale:
      "Complete the square to find the center and radius from a general-form equation, and find the squared radius from a center and a point using the distance relationship. Does not assess writing a derivation.",
  },
  {
    templateId: "circle-equation",
    facetId: "circle-equations.core",
    extent: "partial",
    rationale:
      "Find the center coordinate, radius or squared radius from a circle's equation, including general form, from a center and a point on the circle, or from a graph. Does not assess writing the equation in words.",
  },
  {
    templateId: "circle-area-coefficient",
    facetId: "circle-measurement.core",
    extent: "partial",
    rationale:
      "Find area as a multiple of pi from a radius with fractional values. Does not assess circumference, numeric approximations or contexts.",
  },
  {
    templateId: "circle-circumference-coefficient",
    facetId: "circle-measurement.core",
    extent: "partial",
    rationale:
      "Find circumference as a multiple of pi from a diameter or radius. Does not assess area in the same item, numeric approximations or contexts.",
  },
  {
    templateId: "circle-dilation-scaling",
    facetId: "circle-similarity.HSG.C.A.1",
    extent: "partial",
    rationale:
      "Choose the dilation scale factor or the sequence of a translation and a dilation that maps one circle onto another, and its effect on circumference and area. Does not assess writing the proof that all circles are similar.",
  },
  {
    templateId: "circle-angles",
    facetId: "circle-theorems.HSG.C.A.2",
    extent: "partial",
    rationale:
      "Relate inscribed angles, central angles and the angle in a semicircle, including inscribed angles that share a chord, and enter the unknown measure. Does not assess writing explanations.",
  },
  {
    templateId: "circle-segment-lengths",
    facetId: "circle-theorems.HSG.C.A.2",
    extent: "partial",
    rationale:
      "Use chord-chord, secant-secant and tangent-secant segment relationships to choose an unknown length, and use the perpendicular radius to find the slope of a tangent line on a coordinate plane. Does not assess inscribed-angle relationships or proofs.",
  },
  {
    templateId: "match-clock-five-minutes",
    facetId: "clock-five-minutes.core",
    extent: "partial",
    rationale:
      "Choose the clock face that shows a written time in five-minute intervals. Does not assess elapsed time.",
  },
  {
    templateId: "minutes-past-hour",
    facetId: "clock-five-minutes.core",
    extent: "partial",
    rationale:
      "Count by fives to give the minutes past the hour shown on an analog clock. Does not assess hour reading or elapsed time.",
  },
  {
    templateId: "read-clock-five-minutes",
    facetId: "clock-five-minutes.core",
    extent: "partial",
    rationale:
      "Read an analog clock to the nearest five minutes and choose the time. Does not assess digital-to-analog conversion in a single item or elapsed time.",
  },
  {
    templateId: "match-clock-half-hour",
    facetId: "clock-half-hours.core",
    extent: "partial",
    rationale:
      "Choose the clock face that shows a written hour or half-hour time. Does not assess reading the hands without the written time.",
  },
  {
    templateId: "read-clock-hour-half",
    facetId: "clock-half-hours.core",
    extent: "partial",
    rationale:
      "Read an analog clock to the hour or half hour and choose the time. Does not assess digital clocks or quarter hours.",
  },
  {
    templateId: "compare-capacity",
    facetId: "compare-attributes.core",
    extent: "partial",
    rationale:
      "Compare two containers by capacity using a pouring scene. Does not assess length or weight.",
  },
  {
    templateId: "compare-lengths",
    facetId: "compare-attributes.core",
    extent: "partial",
    rationale:
      "Compare two objects by length and choose the longer. Does not assess weight or capacity.",
  },
  {
    templateId: "compare-weights",
    facetId: "compare-attributes.core",
    extent: "partial",
    rationale:
      "Compare two objects on a balance by weight and choose the heavier or lighter. Does not assess length or capacity.",
  },
  {
    templateId: "compare-decimals-hundredths",
    facetId: "compare-decimals.core",
    extent: "partial",
    rationale:
      "Compare two decimals through hundredths using a place-value chart and enter the greater. Does not assess symbols, ordering three or more numbers or number-line placement.",
  },
  {
    templateId: "compare-distributions-choice",
    facetId: "compare-distributions.core",
    extent: "partial",
    rationale:
      "Choose the true comparison of center and spread from two box plots. Does not assess computing statistics from raw data.",
  },
  {
    templateId: "double-box-compare",
    facetId: "compare-distributions.core",
    extent: "partial",
    rationale:
      "Compare medians or interquartile ranges of two box plots. Does not assess drawing the box plots.",
  },
  {
    templateId: "means-in-mads",
    facetId: "compare-distributions.core",
    extent: "partial",
    rationale:
      "Express the gap between two group means in units of the shared mean absolute deviation using dot plots. Does not assess describing shape or computing the mean absolute deviation.",
  },
  {
    templateId: "compare-like-denominators",
    facetId: "compare-fractions.core",
    extent: "partial",
    rationale:
      "Compare two fractions with the same denominator using bars and enter the greater or lesser. Does not assess symbols or unlike denominators.",
  },
  {
    templateId: "compare-like-numerators",
    facetId: "compare-fractions.core",
    extent: "partial",
    rationale:
      "Compare two unit or same-numerator fractions using bars and enter the greater or lesser. Does not assess symbols or unlike denominators and numerators.",
  },
  {
    templateId: "compare-function-rates",
    facetId: "compare-functions.core",
    extent: "partial",
    rationale:
      "Compare the rate of change and initial value of two functions given in different forms such as a graph, table or description. Does not assess nonlinear comparisons or writing equations.",
  },
  {
    templateId: "linear-function-choice",
    facetId: "compare-functions.core",
    extent: "partial",
    rationale:
      "Recognize which equation defines a linear or non-linear function. Does not assess graphs or tables.",
  },
  {
    templateId: "greater-numeral",
    facetId: "compare-numerals.core",
    extent: "partial",
    rationale:
      "Choose the greater of two written numerals to ten. Does not assess counting objects or symbols.",
  },
  {
    templateId: "compare-groups",
    facetId: "compare-small-groups.core",
    extent: "partial",
    rationale:
      "Compare two groups of objects in rows by pairing and choose which has more or fewer. Does not assess numerals or counting.",
  },
  {
    templateId: "compare-three-digit",
    facetId: "compare-three-digit.core",
    extent: "partial",
    rationale:
      "Enter the lesser or greater of two three-digit numbers using place value. Does not assess symbols or ordering three numbers.",
  },
  {
    templateId: "three-digit-symbol",
    facetId: "compare-three-digit.core",
    extent: "partial",
    rationale:
      "Choose the true comparison statement using less than, equal to or greater than for two three-digit numbers. Does not assess ordering three numbers.",
  },
  {
    templateId: "compare-two-digit",
    facetId: "compare-two-digit.core",
    extent: "partial",
    rationale:
      "Enter the lesser of two two-digit numbers with base-ten block support. Does not assess symbols or ordering three numbers.",
  },
  {
    templateId: "two-digit-symbol",
    facetId: "compare-two-digit.core",
    extent: "partial",
    rationale:
      "Choose the true comparison statement using less than, equal to or greater than for two two-digit numbers. Does not assess ordering three numbers.",
  },
  {
    templateId: "complementary-trig",
    facetId: "complementary-trigonometry.HSG.SRT.C.7",
    extent: "partial",
    rationale:
      "Use sine and cosine of complementary angles to find a value or solve for the variable in a cofunction equation. Does not assess explaining why the relationship holds.",
  },
  {
    templateId: "complementary-trig",
    facetId: "complementary-trigonometry.core",
    extent: "partial",
    rationale:
      "Use sine and cosine of complementary angles to find a value or solve for the variable in a cofunction equation. Does not assess explaining why the relationship holds.",
  },
  {
    templateId: "complete-square-monic",
    facetId: "complete-square.HSA.SSE.B.3",
    extent: "partial",
    rationale:
      "Rewrite a quadratic expression in completed-square form. Does not assess stating the maximum or minimum value that the form reveals.",
  },
  {
    templateId: "complete-square-nonmonic",
    facetId: "complete-square.HSA.SSE.B.3",
    extent: "partial",
    rationale:
      "Rewrite a quadratic expression with any leading coefficient in completed-square form. Does not assess stating the maximum or minimum value that the form reveals.",
  },
  {
    templateId: "complete-square-monic",
    facetId: "complete-square.core",
    extent: "partial",
    rationale:
      "Rewrite a quadratic with leading coefficient one in completed-square form. Does not assess solving, leading coefficients other than one or finding the vertex.",
  },
  {
    templateId: "complete-square-nonmonic",
    facetId: "complete-square.core",
    extent: "partial",
    rationale:
      "Rewrite a quadratic with any leading coefficient in completed-square form. Does not assess solving the equation or reading the vertex.",
  },
  {
    templateId: "complete-square-term",
    facetId: "complete-square.core",
    extent: "partial",
    rationale:
      "Find the constant that completes a perfect-square trinomial. Does not assess the full rewrite or solving.",
  },
  {
    templateId: "complex-conjugate-division",
    facetId: "complex-conjugates.HSN.CN.A.3",
    extent: "partial",
    rationale:
      "Find the conjugate of a complex number, compute a number times its conjugate, and divide complex numbers by multiplying by the conjugate, giving the quotient in the form x plus yi. Does not assess moduli stated as absolute value or the geometric meaning of the conjugate.",
  },
  {
    templateId: "complex-distance-midpoint",
    facetId: "complex-distance.HSN.CN.B.6",
    extent: "partial",
    rationale:
      "Find the distance and the midpoint of two complex numbers in the plane, and the center and radius of the circle of numbers at a fixed distance from a complex constant. Does not assess distance by vector notation.",
  },
  {
    templateId: "complex-quadratic-factors",
    facetId: "complex-factorization.HSN.CN.C.8",
    extent: "partial",
    rationale:
      "Solve a quadratic over the complex numbers, factor it over the complex numbers, and choose the real-coefficient quadratic from a conjugate pair of roots. Does not assess factoring polynomials of degree above two.",
  },
  {
    templateId: "complex-fraction",
    facetId: "complex-fractions.core",
    extent: "partial",
    rationale:
      "Simplify a complex fraction whose numerator and denominator are fraction expressions and enter an exact fraction. Does not assess algebraic complex fractions or contexts.",
  },
  {
    templateId: "complex-multiplication",
    facetId: "complex-numbers.HSN.CN.A.2",
    extent: "partial",
    rationale:
      "Multiply two complex numbers in a plus bi form using i squared equals negative one and choose the exact product. Does not assess addition, subtraction or division.",
  },
  {
    templateId: "complex-plane-forms",
    facetId: "complex-plane.HSN.CN.B.4",
    extent: "partial",
    rationale:
      "Read a complex number from the plane, find its modulus, and convert between rectangular and polar form. Does not assess powers, roots or computing arguments for products.",
  },
  {
    templateId: "complete-the-shape",
    facetId: "compose-shapes.core",
    extent: "partial",
    rationale:
      "Choose the piece that fills the empty space to complete a shape, turning the piece as needed. Does not assess naming the composed shape or counting pieces.",
  },
  {
    templateId: "compose-shape-name",
    facetId: "compose-shapes.core",
    extent: "partial",
    rationale:
      "Name the shape made by putting identical smaller shapes together with no gaps or overlaps. Does not assess building with manipulatives or decomposing a given shape.",
  },
  {
    templateId: "composite-area",
    facetId: "composite-measurement.core",
    extent: "partial",
    rationale:
      "Find the area of an L-shaped or similar rectilinear composite figure from its labeled lengths. Does not assess surface area or non-rectilinear figures.",
  },
  {
    templateId: "composite-face-prism-surface-area",
    facetId: "composite-measurement.core",
    extent: "partial",
    rationale:
      "Find the surface area of a right prism whose front face is a rectilinear composite figure. Does not assess composites of different solids or non-right prisms.",
  },
  {
    templateId: "composite-face-prism-volume",
    facetId: "composite-measurement.core",
    extent: "partial",
    rationale:
      "Find the volume of a right prism whose front face is a rectilinear composite figure. Does not assess composites of different solids such as a cylinder and a cone.",
  },
  {
    templateId: "conditional-probability-value",
    facetId: "conditional-probability.HSS.CP.A.3",
    extent: "partial",
    rationale:
      "Compute the probability of one event given another as a fraction of outcomes. Does not assess deciding whether events are independent.",
  },
  {
    templateId: "conditional-probability-value",
    facetId: "conditional-probability.HSS.CP.A.4",
    extent: "partial",
    rationale:
      "Compute a conditional probability from a two-way frequency table. Does not assess constructing the table or using it to decide independence.",
  },
  {
    templateId: "conditional-probability-value",
    facetId: "conditional-probability.HSS.CP.B.6",
    extent: "partial",
    rationale:
      "Find the probability of one event given another as the fraction of the given event's outcomes that also belong to the other event. Does not assess interpreting the answer in words.",
  },
  {
    templateId: "conditional-probability-value",
    facetId: "conditional-probability.core",
    extent: "partial",
    rationale:
      "Compute a conditional probability from a two-way table or from a sample space of equally likely outcomes. Does not assess tree diagrams or the multiplication rule.",
  },
  {
    templateId: "triangle-congruence-criteria",
    facetId: "congruence-criteria.HSG.CO.B.7",
    extent: "partial",
    rationale:
      "Use a stated vertex correspondence and given corresponding sides and angles to choose the congruence criterion that applies or the fact that is missing. Does not assess the rigid-motion explanation of why the criteria work.",
  },
  {
    templateId: "triangle-congruence-criteria",
    facetId: "congruence-criteria.HSG.SRT.B.5",
    extent: "partial",
    rationale:
      "Apply triangle congruence criteria to stated corresponding parts to decide which criterion holds or what is missing. Does not assess similarity criteria or using congruence to prove relationships in figures.",
  },
  {
    templateId: "triangle-congruence-criteria",
    facetId: "congruence-criteria.core",
    extent: "partial",
    rationale:
      "From stated corresponding sides and angles, choose the additional fact that completes SSS, SAS, ASA or AAS, or identify why AAA or SSA do not establish congruence. Does not assess rigid-motion arguments or two-column proofs.",
  },
  {
    templateId: "coordinate-context-points",
    facetId: "coordinate-first-quadrant.core",
    extent: "partial",
    rationale:
      "Interpret points on a real-world first-quadrant graph and compare their values. Does not assess drawing the graph or choosing scales.",
  },
  {
    templateId: "coordinate-move",
    facetId: "coordinate-first-quadrant.core",
    extent: "partial",
    rationale:
      "Find the ordered pair after moving a stated number of units right and up on a first-quadrant grid. Does not assess moves left or down.",
  },
  {
    templateId: "first-quadrant-coordinates",
    facetId: "coordinate-first-quadrant.core",
    extent: "partial",
    rationale:
      "Name the ordered pair of a labeled point in the first quadrant. Does not assess plotting.",
  },
  {
    templateId: "first-quadrant-locate",
    facetId: "coordinate-first-quadrant.core",
    extent: "partial",
    rationale:
      "Choose the point at a given ordered pair in the first quadrant. Does not assess negative coordinates or plotting by dragging.",
  },
  {
    templateId: "coordinate-polygon",
    facetId: "coordinate-measurement.HSG.GPE.B.7",
    extent: "partial",
    rationale:
      "Compute the perimeter of a triangle or the area of a polygon from vertex coordinates using the distance formula or decomposition. Does not assess deriving the area formula or coordinate proofs.",
  },
  {
    templateId: "coordinate-polygon",
    facetId: "coordinate-measurement.core",
    extent: "partial",
    rationale:
      "Find the perimeter or area of a triangle or quadrilateral from its vertex coordinates. Does not assess proving a figure's type or non-polygon regions.",
  },
  {
    templateId: "coordinate-rectangle-measure",
    facetId: "coordinate-polygons.core",
    extent: "partial",
    rationale:
      "Find the area or perimeter of a rectangle from vertex coordinates. Does not assess non-rectangular polygons.",
  },
  {
    templateId: "coordinate-side-length",
    facetId: "coordinate-polygons.core",
    extent: "partial",
    rationale:
      "Find a side length of a polygon from vertex coordinates when the side is horizontal or vertical. Does not assess slanted sides, area or reflecting points.",
  },
  {
    templateId: "coordinate-quadrilateral-claims",
    facetId: "coordinate-proofs.HSG.GPE.B.4",
    extent: "partial",
    rationale:
      "Use slopes, distances or vectors from vertex coordinates to choose the most specific true claim about a quadrilateral. Does not assess writing the proof or proofs about circles and triangles.",
  },
  {
    templateId: "count-sequence-missing",
    facetId: "count-to-100.core",
    extent: "partial",
    rationale:
      "Fill the missing number in a count by ones or tens through 100. Does not assess counting objects or starting from an arbitrary number beyond the shown sequence.",
  },
  {
    templateId: "hundred-chart-missing",
    facetId: "count-to-100.core",
    extent: "partial",
    rationale:
      "Fill an empty square in a hundred chart. Does not assess skip counting beyond what the chart shows.",
  },
  {
    templateId: "count-on-back",
    facetId: "counting-arithmetic.core",
    extent: "partial",
    rationale:
      "Count on or back one on a number line and enter the number reached. Does not assess counting on by more than one, equations or word problems.",
  },
  {
    templateId: "counted-steps",
    facetId: "counting-arithmetic.core",
    extent: "partial",
    rationale:
      "Give how many were counted on from, or counted back from, a stated start. Does not assess writing an addition or subtraction equation.",
  },
  {
    templateId: "compare-representations",
    facetId: "cross-representation-comparison.HSF.IF.C.9",
    extent: "partial",
    rationale:
      "Compare the properties of two quadratic functions given by an equation and a graph. Does not assess comparing exponential, logarithmic or trigonometric functions.",
  },
  {
    templateId: "compare-representations",
    facetId: "cross-representation-comparison.core",
    extent: "partial",
    rationale:
      "Compare two quadratic functions given in different forms, such as a formula and a graph, and choose the true statement. Does not assess exponential or trigonometric comparisons.",
  },
  {
    templateId: "rational-function-representation",
    facetId: "cross-representation-comparison.core",
    extent: "partial",
    rationale:
      "Read a rational function given as a formula, graph or table: find the input for a stated output, or choose the rule that matches the graph or table. Does not assess comparing it with a second function.",
  },
  {
    templateId: "cone-sphere-volume",
    facetId: "curved-solid-volume.core",
    extent: "partial",
    rationale:
      "Find the volume of a cone or sphere from its dimensions, as a multiple of pi or with a stated approximation of pi. Does not assess surface area or composites.",
  },
  {
    templateId: "cylinder-volume",
    facetId: "curved-solid-volume.core",
    extent: "partial",
    rationale:
      "Find the volume of a cylinder from a radius or diameter and a height, as a multiple of pi or with a stated approximation of pi. Does not assess surface area or composites.",
  },
  {
    templateId: "multidigit-decimal-product",
    facetId: "decimal-algorithms.core",
    extent: "partial",
    rationale:
      "Multiply multidigit decimals and enter the product. Does not assess contexts or estimation.",
  },
  {
    templateId: "multidigit-decimal-quotient",
    facetId: "decimal-algorithms.core",
    extent: "partial",
    rationale:
      "Divide a decimal by a decimal with a terminating quotient. Does not assess contexts, remainders or repeating decimals.",
  },
  {
    templateId: "multidigit-decimal-sum",
    facetId: "decimal-algorithms.core",
    extent: "partial",
    rationale:
      "Add or subtract multidigit decimals and enter the result. Does not assess contexts or estimation.",
  },
  {
    templateId: "decimal-grid-read",
    facetId: "decimal-fractions.core",
    extent: "partial",
    rationale:
      "Name a shaded tenths strip or hundredths grid with a decimal. Does not assess writing the equivalent fraction.",
  },
  {
    templateId: "decimal-line-point",
    facetId: "decimal-fractions.core",
    extent: "partial",
    rationale:
      "Read a decimal at a point on a number line. Does not assess plotting.",
  },
  {
    templateId: "tenths-as-hundredths",
    facetId: "decimal-fractions.core",
    extent: "partial",
    rationale:
      "Rewrite tenths as hundredths and add fractions with denominators ten and one hundred, writing the result as a decimal. Does not assess other denominators.",
  },
  {
    templateId: "compare-decimals-thousandths",
    facetId: "decimal-place-value.core",
    extent: "partial",
    rationale:
      "Compare two decimals through thousandths and enter the lesser or greater. Does not assess symbols or ordering more than two.",
  },
  {
    templateId: "decimal-digit-value",
    facetId: "decimal-place-value.core",
    extent: "partial",
    rationale:
      "Give the value of a digit in a decimal through thousandths. Does not assess reading decimals aloud.",
  },
  {
    templateId: "expanded-decimal",
    facetId: "decimal-place-value.core",
    extent: "partial",
    rationale:
      "Write the decimal from its expanded form. Does not assess writing expanded form.",
  },
  {
    templateId: "inverse-round-decimal",
    facetId: "decimal-place-value.core",
    extent: "partial",
    rationale:
      "Choose a decimal that rounds to a stated value at a stated place. Does not assess finding the full range of values.",
  },
  {
    templateId: "round-decimal",
    facetId: "decimal-place-value.core",
    extent: "partial",
    rationale:
      "Round a decimal to a stated place. Does not assess estimation in context.",
  },
  {
    templateId: "dependent-variable-equation",
    facetId: "dependent-variables.core",
    extent: "partial",
    rationale:
      "Choose the equation that gives the dependent variable from the independent variable in a described situation with a table and graph. Does not assess graphing.",
  },
  {
    templateId: "dependent-variable-value",
    facetId: "dependent-variables.core",
    extent: "partial",
    rationale:
      "Use an equation between two quantities to find the value of the independent variable from a stated dependent value. Does not assess writing the equation.",
  },
  {
    templateId: "dilation-measure",
    facetId: "dilation-properties.HSG.SRT.A.1",
    extent: "partial",
    rationale:
      "Use a dilation's center and scale factor to find lengths and image coordinates, and the slope of the image of a line that does not pass through the center, which shows the image is parallel. Does not assess proofs.",
  },
  {
    templateId: "dilation-measure",
    facetId: "dilation-properties.core",
    extent: "partial",
    rationale:
      "Find a scale factor from segment lengths, an image coordinate under a dilation with a stated center, or the slope of the image of a line not through the center. Does not assess proofs.",
  },
  {
    templateId: "dilation-image",
    facetId: "dilations-similarity.core",
    extent: "partial",
    rationale:
      "Find image coordinates for a dilation centered at the origin. Does not assess dilations about other centers or combined rigid motions.",
  },
  {
    templateId: "dilation-scale-factor",
    facetId: "dilations-similarity.core",
    extent: "partial",
    rationale:
      "Find the scale factor of a dilation from original and image vertices. Does not assess similarity transformations that include rigid motions.",
  },
  {
    templateId: "similar-triangles-side",
    facetId: "dilations-similarity.core",
    extent: "partial",
    rationale:
      "Use corresponding sides of similar triangles to find a missing side. Does not assess establishing similarity by a transformation.",
  },
  {
    templateId: "box-plot-read",
    facetId: "distribution-plots.core",
    extent: "partial",
    rationale:
      "Read a median, range, interquartile range or the approximate percent of values from a box plot. Does not assess drawing a box plot or dot plots.",
  },
  {
    templateId: "histogram-read",
    facetId: "distribution-plots.core",
    extent: "partial",
    rationale:
      "Read counts and frequencies from a histogram. Does not assess drawing a histogram or choosing bins.",
  },
  {
    templateId: "divide-facts",
    facetId: "division-facts.core",
    extent: "partial",
    rationale:
      "Find a quotient within the multiplication tables by using the related multiplication fact, with an array of dots. Does not assess fluency under time or remainders.",
  },
  {
    templateId: "elimination-equivalent",
    facetId: "elimination-proof.HSA.REI.C.5",
    extent: "partial",
    rationale:
      "Choose the justification, the equation that results from adding or multiplying equations, and the equivalent system when one equation of a system is replaced by a sum or multiple. Does not assess solving a system or writing the justification.",
  },
  {
    templateId: "elimination-equivalent",
    facetId: "elimination-proof.core",
    extent: "partial",
    rationale:
      "Choose why replacing a system by a sum of its equations keeps the same solution set, the equation that results from adding or scaling equations, and the equivalent system. Does not assess carrying out elimination to solve or writing a proof.",
  },
  {
    templateId: "equation-step-property",
    facetId: "equation-reasoning.HSA.REI.A.1",
    extent: "partial",
    rationale:
      "Identify the property that justifies each step in a solution of a linear equation, or the step that breaks equivalence. Does not assess explaining the full solution as a viable argument or nonlinear equations.",
  },
  {
    templateId: "equation-step-property",
    facetId: "equation-reasoning.core",
    extent: "partial",
    rationale:
      "Name the property that justifies a step in a worked equation solution, and find the step with an error. Does not assess producing the steps or inequalities.",
  },
  {
    templateId: "event-set-count",
    facetId: "event-sets.HSS.CP.A.1",
    extent: "partial",
    rationale:
      "Describe events as subsets of a sample space using and, or and not by counting a Venn diagram or counts of two events. Does not assess probabilities, three events or set notation.",
  },
  {
    templateId: "event-set-count",
    facetId: "event-sets.core",
    extent: "partial",
    rationale:
      "Count outcomes in unions, intersections and complements from a Venn diagram or counts. Does not assess probabilities or set notation.",
  },
  {
    templateId: "expected-value",
    facetId: "expected-value.HSS.MD.A.2",
    extent: "partial",
    rationale:
      "Calculate the expected value of a random variable defined by equally likely spinner sections with stated payoffs. Does not assess building the probability distribution from raw data.",
  },
  {
    templateId: "expected-value",
    facetId: "expected-value.HSS.MD.B.5",
    extent: "partial",
    rationale:
      "Weigh payoffs by their probabilities and net out the cost to play to find the expected result of a game decision. Does not assess comparing two decision alternatives.",
  },
  {
    templateId: "expected-value",
    facetId: "expected-value.core",
    extent: "partial",
    rationale:
      "Compute the expected value of a spinner game from equal sections, including a game with a cost to play. Does not assess comparing games or non-uniform probability tables.",
  },
  {
    templateId: "negative-integer-power",
    facetId: "exponent-laws.core",
    extent: "partial",
    rationale:
      "Evaluate a rational or integer base raised to a negative integer power. Does not assess variables or scientific notation.",
  },
  {
    templateId: "power-of-power-exponent",
    facetId: "exponent-laws.core",
    extent: "partial",
    rationale:
      "Find the exponent when raising a power to a power, including negative exponents. Does not assess different bases or coefficients.",
  },
  {
    templateId: "product-of-powers-exponent",
    facetId: "exponent-laws.core",
    extent: "partial",
    rationale:
      "Find the exponent when multiplying powers of the same base, including zero and negative exponents. Does not assess different bases or coefficients.",
  },
  {
    templateId: "quotient-of-powers-exponent",
    facetId: "exponent-laws.core",
    extent: "partial",
    rationale:
      "Find the exponent when dividing powers of the same base, including zero and negative exponents. Does not assess different bases or coefficients.",
  },
  {
    templateId: "exponential-log-solution",
    facetId: "exponential-equations.HSF.BF.B.5",
    extent: "partial",
    rationale:
      "Use the inverse relationship between exponentials and logarithms to solve for the exponent in a growth equation. Does not assess graphs of inverse functions or the inverse relationship beyond base-ten and stated bases.",
  },
  {
    templateId: "exponential-log-solution",
    facetId: "exponential-equations.HSF.LE.A.4",
    extent: "partial",
    rationale:
      "Express the solution of an exponential growth equation a times b to the t equals d as a logarithm. Does not assess decimal evaluation with technology.",
  },
  {
    templateId: "exponential-log-solution",
    facetId: "exponential-equations.core",
    extent: "partial",
    rationale:
      "Choose the logarithm expression that solves a compound-growth equation for the exponent. Does not assess computing a decimal value or domain checks.",
  },
  {
    templateId: "log-equation",
    facetId: "exponential-equations.core",
    extent: "partial",
    rationale:
      "Solve a logarithmic equation, including one that needs combining logarithms and rejecting a value outside the domain. Does not assess changing base or exponential equations.",
  },
  {
    templateId: "same-base-equation",
    facetId: "exponential-equations.core",
    extent: "partial",
    rationale:
      "Solve an exponential equation by writing both sides with a common base. Does not assess equations needing logarithms.",
  },
  {
    templateId: "exponential-time-scale",
    facetId: "exponential-models.HSA.SSE.B.3",
    extent: "partial",
    rationale:
      "Use properties of exponents to rewrite an exponential model with a different time scale as an equivalent expression. Does not assess rewriting to reveal monthly rates from annual rates in a context other than those shown.",
  },
  {
    templateId: "exponential-model-rule",
    facetId: "exponential-models.HSF.LE.A.2",
    extent: "partial",
    rationale:
      "Choose the exponential equation from a table, a graph or a growth or decay description. Does not assess writing a rule from two points without a display.",
  },
  {
    templateId: "exponential-model-value",
    facetId: "exponential-models.HSF.LE.A.2",
    extent: "partial",
    rationale:
      "Build an exponential growth or decay model from a described situation and evaluate it at a stated time. Does not assess writing the rule or comparing with a linear model.",
  },
  {
    templateId: "exponential-time-scale",
    facetId: "exponential-models.HSF.LE.B.5",
    extent: "partial",
    rationale:
      "Interpret an exponential model: choose the statement that gives the growth or decay factor per stated period and the initial amount. Does not assess linear models or interpreting a fitted model from data.",
  },
  {
    templateId: "structure-meaning",
    facetId: "expression-structure.HSA.SSE.A.1",
    extent: "partial",
    rationale:
      "Interpret the meaning of a coefficient, constant or base in a formula for a described situation. Does not assess interpreting expressions with several factors.",
  },
  {
    templateId: "structure-rewrite",
    facetId: "expression-structure.HSA.SSE.A.2",
    extent: "partial",
    rationale:
      "Use the structure of an expression to rewrite it, for example as a difference of two squares or as a perfect square. Does not assess rewriting with a changed variable such as in x to the fourth.",
  },
  {
    templateId: "binomial-area-product",
    facetId: "expression-structure.core",
    extent: "partial",
    rationale:
      "Choose the expression that models an area as a product of binomials and expand a product. Does not assess factoring or interpreting parts.",
  },
  {
    templateId: "structure-meaning",
    facetId: "expression-structure.core",
    extent: "partial",
    rationale:
      "Interpret a constant or factor in a formula in context. Does not assess rewriting expressions.",
  },
  {
    templateId: "structure-rewrite",
    facetId: "expression-structure.core",
    extent: "partial",
    rationale:
      "Rewrite an expression by recognizing a difference of squares or perfect-square pattern. Does not assess interpreting terms in context.",
  },
  {
    templateId: "monic-quadratic-factorization",
    facetId: "factor-quadratics.HSA.SSE.A.2",
    extent: "partial",
    rationale:
      "Choose the complete factorization of a monic quadratic trinomial or perfect square. Does not assess nonmonic or higher-degree factors.",
  },
  {
    templateId: "nonmonic-quadratic-factorization",
    facetId: "factor-quadratics.HSA.SSE.A.2",
    extent: "partial",
    rationale:
      "Choose the complete factorization of a nonmonic quadratic trinomial, including negative leading coefficients. Does not assess higher-degree factors.",
  },
  {
    templateId: "polynomial-factoring-patterns",
    facetId: "factor-quadratics.HSA.SSE.A.2",
    extent: "partial",
    rationale:
      "Factor quartics that are quadratic in x squared by treating x squared as a unit. Does not assess difference of cubes or sum of cubes.",
  },
  {
    templateId: "monic-quadratic-factorization",
    facetId: "factor-quadratics.HSA.SSE.B.3",
    extent: "partial",
    rationale:
      "Factor a monic quadratic expression into linear factors. Does not assess stating the zeros that the factored form reveals.",
  },
  {
    templateId: "nonmonic-quadratic-factorization",
    facetId: "factor-quadratics.HSA.SSE.B.3",
    extent: "partial",
    rationale:
      "Factor a nonmonic quadratic expression into linear factors. Does not assess stating the zeros that the factored form reveals.",
  },
  {
    templateId: "facts-to-five",
    facetId: "facts-within-5.core",
    extent: "partial",
    rationale:
      "Give sums and differences within five. Does not assess word problems or fluency under time.",
  },
  {
    templateId: "formula-isolate",
    facetId: "formula-rearrangement.core",
    extent: "partial",
    rationale:
      "Choose the formula rearranged for a stated variable. Does not assess entering the rearranged formula or numeric substitution.",
  },
  {
    templateId: "formula-value",
    facetId: "formula-rearrangement.core",
    extent: "partial",
    rationale:
      "Rearrange a formula and substitute values to find the stated variable. Does not assess choosing the rearranged formula without numbers.",
  },
  {
    templateId: "nonlinear-formula-isolate",
    facetId: "formula-rearrangement.core",
    extent: "partial",
    rationale:
      "Choose the rearranged form of a formula with a squared variable, using stated positivity. Does not assess formulas with radicals or fractions in several variables.",
  },
  {
    templateId: "fraction-line-plot",
    facetId: "fraction-line-plots.core",
    extent: "partial",
    rationale:
      "Read a line plot of lengths measured to the nearest half, quarter or eighth and count or compare measurements. Does not assess making the line plot or measuring.",
  },
  {
    templateId: "fraction-plot-difference",
    facetId: "fraction-plot-arithmetic.core",
    extent: "partial",
    rationale:
      "Add or subtract fractional measurements read from a line plot, such as a total or a difference between longest and shortest. Does not assess multiplying or dividing fractions.",
  },
  {
    templateId: "fraction-plot-equal-share",
    facetId: "fraction-plot-computation.core",
    extent: "partial",
    rationale:
      "Find the equal-share amount from a line plot of fractional measurements. Does not assess making the plot or other fraction operations.",
  },
  {
    templateId: "fraction-edge-volume",
    facetId: "fractional-prism-volume.core",
    extent: "partial",
    rationale:
      "Use a volume and two fractional edges to find the third edge of a rectangular prism. Does not assess finding the volume from three edges.",
  },
  {
    templateId: "unit-fraction-cube-packing",
    facetId: "fractional-prism-volume.core",
    extent: "partial",
    rationale:
      "Find how many unit-fraction cubes pack a prism with fractional edges. Does not assess applying the volume formula without packing.",
  },
  {
    templateId: "composition-expression",
    facetId: "function-composition.HSF.BF.A.1",
    extent: "partial",
    rationale:
      "Compose functions as an expression and choose an inner function from a composed form. Does not assess writing a function from a context or combining functions by arithmetic.",
  },
  {
    templateId: "composition-value",
    facetId: "function-composition.HSF.BF.A.1",
    extent: "partial",
    rationale:
      "Evaluate a composition of two functions given by formulas, a table or graphs. Does not assess writing a function from a context or combining functions by arithmetic.",
  },
  {
    templateId: "composition-expression",
    facetId: "function-composition.core",
    extent: "partial",
    rationale:
      "Compose or decompose functions by choosing the expression for f of g of x or the inner function. Does not assess domains or inverses.",
  },
  {
    templateId: "composition-value",
    facetId: "function-composition.core",
    extent: "partial",
    rationale:
      "Evaluate a composition of two functions given by formulas, a table or graphs, and find a value excluded from the domain of a composition. Does not assess inverses.",
  },
  {
    templateId: "function-relation-test",
    facetId: "function-domain-range.HSF.IF.A.1",
    extent: "partial",
    rationale:
      "Decide which relation or equation assigns exactly one output to each input. Does not assess function notation.",
  },
  {
    templateId: "context-domain-range",
    facetId: "function-domain-range.HSF.IF.B.5",
    extent: "partial",
    rationale:
      "Choose the domain or range that fits a described situation with a stated limit. Does not assess graph relations to the same quantity.",
  },
  {
    templateId: "context-domain-range",
    facetId: "function-domain-range.core",
    extent: "partial",
    rationale:
      "Choose the domain or range of a function in a context with a limit. Does not assess graphs.",
  },
  {
    templateId: "function-relation-test",
    facetId: "function-domain-range.core",
    extent: "partial",
    rationale:
      "Decide which relation or equation defines a function. Does not assess domain and range.",
  },
  {
    templateId: "graph-domain-range",
    facetId: "function-domain-range.core",
    extent: "partial",
    rationale:
      "Choose the domain or range of a function from its graph. Does not assess algebraic domains.",
  },
  {
    templateId: "function-evaluation",
    facetId: "function-evaluation.HSF.IF.A.2",
    extent: "partial",
    rationale:
      "Evaluate a polynomial function in function notation at a negative integer input. Does not assess interpreting function notation in context.",
  },
  {
    templateId: "transform-equation",
    facetId: "function-transformations.HSF.BF.B.3",
    extent: "partial",
    rationale:
      "Identify the effect of shifts, reflections and stretches on a graph by choosing the transformed equation. Does not assess finding the value of k from graphs or even and odd functions.",
  },
  {
    templateId: "transform-point",
    facetId: "function-transformations.HSF.BF.B.3",
    extent: "partial",
    rationale:
      "Find where a point goes under f of x plus k, k times f of x and f of x plus k transformations, and use an odd function's symmetry. Does not assess finding k from graphs.",
  },
  {
    templateId: "transform-equation",
    facetId: "function-transformations.core",
    extent: "partial",
    rationale:
      "Choose the equation of a transformed graph or a sequence of shifts, reflections and stretches. Does not assess even and odd symmetry.",
  },
  {
    templateId: "transform-point",
    facetId: "function-transformations.core",
    extent: "partial",
    rationale:
      "Find the image of a point or the value of a transformed function from a graph or a stated point, including with an odd function. Does not assess choosing the equation.",
  },
  {
    templateId: "polynomial-root-count",
    facetId: "fundamental-theorem-algebra.HSN.CN.C.9",
    extent: "partial",
    rationale:
      "Count the complex roots of a polynomial by degree with multiplicity, and choose possible numbers of real roots for a real-coefficient polynomial. Does not assess proving the theorem or finding the roots.",
  },
  {
    templateId: "gcf-factor-sum",
    facetId: "gcf-lcm.core",
    extent: "partial",
    rationale:
      "Rewrite a sum of two whole numbers as their greatest common factor times a sum. Does not assess finding the greatest common factor without the rewrite.",
  },
  {
    templateId: "greatest-common-factor",
    facetId: "gcf-lcm.core",
    extent: "partial",
    rationale:
      "Find the greatest common factor of two numbers, including in a sharing context. Does not assess three numbers or prime factorization.",
  },
  {
    templateId: "least-common-multiple",
    facetId: "gcf-lcm.core",
    extent: "partial",
    rationale:
      "Find the least common multiple of two numbers in a pack-buying context. Does not assess three numbers or prime factorization.",
  },
  {
    templateId: "compass-straightedge-reasoning",
    facetId: "geometric-constructions.HSG.CO.D.12",
    extent: "partial",
    rationale:
      "Reason about the steps of a compass-and-straightedge construction of a parallel line or perpendicular bisector. Does not assess performing a construction or constructions of angle bisectors or polygons.",
  },
  {
    templateId: "precise-geometric-definitions",
    facetId: "geometric-definitions.HSG.CO.A.1",
    extent: "partial",
    rationale:
      "Choose the precise definition of a geometric term such as angle or circle. Does not assess line segment, parallel line or other terms not shown.",
  },
  {
    templateId: "geometry-proof-step",
    facetId: "geometric-proof.core",
    extent: "partial",
    rationale:
      "Choose the reason that justifies a step in an angle proof, such as the triangle sum or vertical angles. Does not assess writing a full proof or critiquing a flawed one.",
  },
  {
    templateId: "geometric-sequence-rule",
    facetId: "geometric-sequences.HSF.LE.A.2",
    extent: "partial",
    rationale:
      "Find a geometric sequence's first term, ratio or a missing term from two stated terms, from a table of four terms or from consecutive terms with a missing middle. Does not assess graphs, contexts or writing the explicit rule.",
  },
  {
    templateId: "solution-coordinate",
    facetId: "graph-solution-sets.HSA.REI.D.10",
    extent: "partial",
    rationale:
      "Complete an ordered pair so it satisfies the equation graphed. Does not assess plotting the graph or describing the full solution set.",
  },
  {
    templateId: "solution-point-choice",
    facetId: "graph-solution-sets.HSA.REI.D.10",
    extent: "partial",
    rationale:
      "Decide whether a point lies on the graph of an equation, treating the graph as the set of solutions. Does not assess plotting the graph.",
  },
  {
    templateId: "solution-coordinate",
    facetId: "graph-solution-sets.core",
    extent: "partial",
    rationale:
      "Find the missing coordinate of a point on the graph of a stated equation, including linear and quadratic equations. Does not assess sketching the graph.",
  },
  {
    templateId: "solution-point-choice",
    facetId: "graph-solution-sets.core",
    extent: "partial",
    rationale:
      "Choose which point lies on the graph of a stated linear or absolute-value equation. Does not assess graphing the equation or finding all solutions.",
  },
  {
    templateId: "graphical-solution-table",
    facetId: "graphical-equation-solving.HSA.REI.D.11",
    extent: "partial",
    rationale:
      "Use a table of values for f and g to find the input where f of x equals g of x, or the consecutive inputs between which a solution lies. Does not assess reading intersections on a graph or successive technology-based approximations.",
  },
  {
    templateId: "linear-or-exponential",
    facetId: "growth-comparison.HSF.LE.A.1",
    extent: "partial",
    rationale:
      "Distinguish a function that grows by equal differences from one that grows by equal factors using a table or a description. Does not assess proving the property.",
  },
  {
    templateId: "exponential-overtakes",
    facetId: "growth-comparison.HSF.LE.A.3",
    extent: "partial",
    rationale:
      "Observe that a quantity growing exponentially eventually exceeds a linear one by finding the first input where it does. Does not assess comparison with quadratic or other polynomial growth.",
  },
  {
    templateId: "exponential-overtakes",
    facetId: "growth-comparison.core",
    extent: "partial",
    rationale:
      "Find the first whole input at which an exponential function exceeds a linear function from their graph and formulas. Does not assess comparison with quadratic or higher-degree polynomials.",
  },
  {
    templateId: "linear-or-exponential",
    facetId: "growth-comparison.core",
    extent: "partial",
    rationale:
      "Decide which kind of function a table or a described growth pattern shows, including percent growth. Does not assess writing the function.",
  },
  {
    templateId: "find-equal-shares",
    facetId: "halves-and-quarters.core",
    extent: "partial",
    rationale:
      "Choose the shape partitioned into equal halves or quarters. Does not assess partitioning a shape.",
  },
  {
    templateId: "larger-share",
    facetId: "halves-and-quarters.core",
    extent: "partial",
    rationale:
      "Compare a half and a quarter of the same shape. Does not assess other fractions.",
  },
  {
    templateId: "name-equal-share",
    facetId: "halves-and-quarters.core",
    extent: "partial",
    rationale:
      "Name the fraction of a shape that is shaded when it is cut into equal halves or quarters. Does not assess partitioning a shape.",
  },
  {
    templateId: "independence-test",
    facetId: "independent-events.HSS.CP.A.2",
    extent: "partial",
    rationale:
      "Test whether two events are independent from a two-way table by comparing the joint probability with the product of the probabilities. Does not assess finding a probability from a described experiment.",
  },
  {
    templateId: "independent-events-probability",
    facetId: "independent-events.HSS.CP.A.2",
    extent: "partial",
    rationale:
      "Use the product rule for independent events from a number cube with a coin or spinner, including at-least-one and not-event probabilities. Does not assess testing independence from data.",
  },
  {
    templateId: "independence-test",
    facetId: "independent-events.HSS.CP.A.3",
    extent: "partial",
    rationale:
      "Decide whether events are independent from a two-way table of counts. Does not assess explaining independence in words in terms of conditional probabilities.",
  },
  {
    templateId: "half-plane-inequality",
    facetId: "inequality-regions.HSA.REI.D.12",
    extent: "partial",
    rationale:
      "Match a shaded region with strict or inclusive boundaries to a linear inequality in two variables or to a system of inequalities. Does not assess drawing the region.",
  },
  {
    templateId: "inequality-solution-point",
    facetId: "inequality-regions.HSA.REI.D.12",
    extent: "partial",
    rationale:
      "Test points against a linear inequality in two variables using its boundary line. Does not assess systems of inequalities or shading a graph.",
  },
  {
    templateId: "half-plane-inequality",
    facetId: "inequality-regions.core",
    extent: "partial",
    rationale:
      "Choose the linear inequality, or the system of inequalities, that matches a shaded region, including boundary type. Does not assess drawing the region.",
  },
  {
    templateId: "inequality-solution-point",
    facetId: "inequality-regions.core",
    extent: "partial",
    rationale:
      "Test points against a linear inequality and choose the solution given a boundary line. Does not assess shading the region.",
  },
  {
    templateId: "inscribed-polygon-reasoning",
    facetId: "inscribed-polygons.HSG.CO.D.13",
    extent: "partial",
    rationale:
      "Reason about constructions of regular polygons inscribed in a circle, such as stepping the radius around a circle for a hexagon or the method for a square. Does not assess performing a construction.",
  },
  {
    templateId: "division-remainder-story",
    facetId: "integer-division.core",
    extent: "partial",
    rationale:
      "Use division with a remainder in a story to find the leftover or the number of full groups. Does not assess dividing without a context.",
  },
  {
    templateId: "long-division-quotient",
    facetId: "integer-division.core",
    extent: "partial",
    rationale:
      "Divide a multidigit whole number by a two-digit divisor and enter the quotient, including in a sharing story. Does not assess remainders or written algorithm steps.",
  },
  {
    templateId: "integer-power",
    facetId: "integer-powers.core",
    extent: "partial",
    rationale:
      "Evaluate a whole-number power. Does not assess negative or fractional exponents.",
  },
  {
    templateId: "power-compare",
    facetId: "integer-powers.core",
    extent: "partial",
    rationale:
      "Compare powers with products or with other powers. Does not assess evaluating powers with large exponents.",
  },
  {
    templateId: "power-doubling-story",
    facetId: "integer-powers.core",
    extent: "partial",
    rationale:
      "Use a doubling or tripling story and a bar chart to find a count as a power. Does not assess writing the power as an expression.",
  },
  {
    templateId: "power-missing-exponent",
    facetId: "integer-powers.core",
    extent: "partial",
    rationale:
      "Find how many factors of a base give a stated value. Does not assess logarithm notation.",
  },
  {
    templateId: "power-order-trap",
    facetId: "integer-powers.core",
    extent: "partial",
    rationale:
      "Evaluate an expression that adds to a power, applying the exponent first. Does not assess parentheses.",
  },
  {
    templateId: "power-repeated-product",
    facetId: "integer-powers.core",
    extent: "partial",
    rationale:
      "Match a power with its repeated product. Does not assess evaluating powers.",
  },
  {
    templateId: "inverse-expression",
    facetId: "inverse-functions.HSF.BF.B.4",
    extent: "partial",
    rationale:
      "Choose the inverse of a function on a restricted domain that makes it one-to-one. Does not assess verifying an inverse by composition.",
  },
  {
    templateId: "inverse-expression",
    facetId: "inverse-functions.core",
    extent: "partial",
    rationale:
      "Choose the inverse expression for a one-to-one function with a restricted domain. Does not assess evaluating inverse values.",
  },
  {
    templateId: "inverse-value",
    facetId: "inverse-functions.core",
    extent: "partial",
    rationale:
      "Find a value of an inverse function from a formula or a table. Does not assess finding the inverse expression.",
  },
  {
    templateId: "inverse-trig-value",
    facetId: "inverse-trigonometry.core",
    extent: "partial",
    rationale:
      "Give the exact radian value of an inverse trigonometric function at a standard ratio, respecting the restricted range. Does not assess compositions of trigonometric and inverse functions.",
  },
  {
    templateId: "classify-real-number",
    facetId: "irrational-numbers.core",
    extent: "partial",
    rationale:
      "Choose which number from a list is irrational. Does not assess proofs.",
  },
  {
    templateId: "repeating-decimal-to-fraction",
    facetId: "irrational-numbers.core",
    extent: "partial",
    rationale:
      "Write a repeating decimal as a fraction in simplest form. Does not assess identifying non-repeating decimals.",
  },
  {
    templateId: "compare-multidigit",
    facetId: "large-place-value.core",
    extent: "partial",
    rationale:
      "Compare two multidigit whole numbers and enter the lesser or greater. Does not assess symbols or ordering three numbers.",
  },
  {
    templateId: "multidigit-digit-value",
    facetId: "large-place-value.core",
    extent: "partial",
    rationale:
      "Give the value of a digit in a multidigit whole number. Does not assess reading numbers aloud or expanded form.",
  },
  {
    templateId: "round-large",
    facetId: "large-place-value.core",
    extent: "partial",
    rationale:
      "Round a multidigit whole number to a stated place. Does not assess estimation in context.",
  },
  {
    templateId: "line-angle-proof-reasons",
    facetId: "line-angle-proofs.HSG.CO.C.9",
    extent: "partial",
    rationale:
      "Choose the reason that justifies a step involving vertical angles, parallel lines or the perpendicular bisector. Does not assess writing a complete proof.",
  },
  {
    templateId: "line-plot-whole",
    facetId: "line-plots.core",
    extent: "partial",
    rationale:
      "Read a whole-number line plot of measurements. Does not assess making a line plot or fractional measurements.",
  },
  {
    templateId: "linear-model-value",
    facetId: "linear-equation-modeling.HSA.CED.A.1",
    extent: "partial",
    rationale:
      "Build a linear equation or inequality in one variable from a described situation, including comparing two plans with variables on both sides, and solve it. Does not assess graphing.",
  },
  {
    templateId: "rate-combination-model",
    facetId: "linear-equation-modeling.HSA.CED.A.1",
    extent: "partial",
    rationale:
      "Build and solve a linear equation in one variable from combined or consecutive rates. Does not assess graphing.",
  },
  {
    templateId: "linear-model-equation",
    facetId: "linear-equation-modeling.HSA.CED.A.2",
    extent: "partial",
    rationale:
      "Choose the equation relating two quantities from a table of a linear relationship. Does not assess graphing the equation with labeled axes or nonlinear equations.",
  },
  {
    templateId: "angle-classify",
    facetId: "lines-symmetry.core",
    extent: "partial",
    rationale:
      "Classify an angle as acute, right or obtuse. Does not assess measuring.",
  },
  {
    templateId: "classify-triangle-angles",
    facetId: "lines-symmetry.core",
    extent: "partial",
    rationale:
      "Classify a triangle by its angles. Does not assess classification by sides.",
  },
  {
    templateId: "line-ray-segment",
    facetId: "lines-symmetry.core",
    extent: "partial",
    rationale:
      "Name a line, ray or segment from a figure. Does not assess point labels.",
  },
  {
    templateId: "line-relationship",
    facetId: "lines-symmetry.core",
    extent: "partial",
    rationale:
      "Tell whether two lines are parallel or perpendicular. Does not assess intersecting lines that are neither.",
  },
  {
    templateId: "symmetry-line-check",
    facetId: "lines-symmetry.core",
    extent: "partial",
    rationale:
      "Find which dashed line is a line of symmetry. Does not assess drawing a line of symmetry.",
  },
  {
    templateId: "symmetry-line-count",
    facetId: "lines-symmetry.core",
    extent: "partial",
    rationale:
      "Count the lines of symmetry of a shape. Does not assess rotational symmetry.",
  },
  {
    templateId: "change-of-base",
    facetId: "logarithm-properties.core",
    extent: "partial",
    rationale:
      "Use the change-of-base relationship to evaluate or relate logarithms of different bases. Does not assess the product and quotient rules.",
  },
  {
    templateId: "log-expand",
    facetId: "logarithm-properties.core",
    extent: "partial",
    rationale:
      "Expand or condense a logarithm of a product, quotient, power or root of positive variables. Does not assess evaluation or domain restrictions.",
  },
  {
    templateId: "log-rules-evaluate",
    facetId: "logarithm-properties.core",
    extent: "partial",
    rationale:
      "Evaluate expressions with the product, quotient and power rules of logarithms. Does not assess change of base.",
  },
  {
    templateId: "log-exponential-form",
    facetId: "logarithms.HSF.BF.B.5",
    extent: "partial",
    rationale:
      "Place a logarithm between consecutive integers and choose the exponential equation that means the same as a logarithm equation. Does not assess graphing inverse functions or verifying inverses by composition.",
  },
  {
    templateId: "logarithm-integer",
    facetId: "logarithms.HSF.BF.B.5",
    extent: "partial",
    rationale:
      "Evaluate a logarithm as the exponent that gives a number, the inverse of an exponential. Does not assess graphing inverse functions or verifying inverses by composition.",
  },
  {
    templateId: "function-graph-features",
    facetId: "logarithms.HSF.IF.C.7",
    extent: "partial",
    rationale:
      "Describe key features of exponential and logarithmic functions, such as end behavior, the y-intercept, horizontal asymptote, domain and range, from a formula or graph. Does not assess drawing a graph.",
  },
  {
    templateId: "balance-mass",
    facetId: "mass-volume.core",
    extent: "partial",
    rationale:
      "Find an unknown mass in grams from a level balance. Does not assess comparing masses.",
  },
  {
    templateId: "mass-volume-story",
    facetId: "mass-volume.core",
    extent: "partial",
    rationale:
      "Solve a one-step story about masses or liquid volumes. Does not assess multi-step problems or unit conversion.",
  },
  {
    templateId: "read-liquid-volume",
    facetId: "mass-volume.core",
    extent: "partial",
    rationale:
      "Read liquid volume in liters from a scale. Does not assess measuring with a container.",
  },
  {
    templateId: "correct-unit-measure",
    facetId: "measure-equal-units.core",
    extent: "partial",
    rationale:
      "Choose the picture that measures a length with equal units end to end without gaps or overlaps. Does not assess counting the units.",
  },
  {
    templateId: "measure-with-units",
    facetId: "measure-equal-units.core",
    extent: "partial",
    rationale:
      "Count the equal units that measure a length with no gaps or overlaps. Does not assess standard units.",
  },
  {
    templateId: "order-lengths",
    facetId: "measure-equal-units.core",
    extent: "partial",
    rationale:
      "Order three lengths from comparisons stated in words. Does not assess measuring.",
  },
  {
    templateId: "measurement-formula-justifications",
    facetId: "measurement-formula-proofs.HSG.GMD.A.1",
    extent: "partial",
    rationale:
      "Choose the key step in an informal argument for a circle, cylinder, pyramid or cone formula, such as dissecting a cube into pyramids. Does not assess writing a full argument.",
  },
  {
    templateId: "mental-ten-hundred",
    facetId: "mental-tens-hundreds.core",
    extent: "partial",
    rationale:
      "Add or subtract ten or one hundred to a number within 1000. Does not assess other amounts.",
  },
  {
    templateId: "coin-total",
    facetId: "money-values.core",
    extent: "partial",
    rationale:
      "Find the total value of a set of coins in cents. Does not assess bills, dollar notation or making change.",
  },
  {
    templateId: "make-a-dollar",
    facetId: "money-values.core",
    extent: "partial",
    rationale:
      "Find how many more cents coins need to make one dollar. Does not assess other target amounts.",
  },
  {
    templateId: "money-left-story",
    facetId: "money-values.core",
    extent: "partial",
    rationale:
      "Subtract a purchase from the value of a coin set and enter the cents left. Does not assess dollar notation or giving change.",
  },
  {
    templateId: "money-total-dollars",
    facetId: "money-values.core",
    extent: "partial",
    rationale:
      "Find the total of bills and coins and enter it in dollars with decimals. Does not assess making change or comparing amounts.",
  },
  {
    templateId: "pay-exact-coins",
    facetId: "money-values.core",
    extent: "partial",
    rationale:
      "Choose a set of coins worth an exact price in cents. Does not assess dollar notation or change.",
  },
  {
    templateId: "multiply-multidigit",
    facetId: "multidigit-products.core",
    extent: "partial",
    rationale:
      "Multiply multidigit whole numbers and enter the product. Does not assess showing the algorithm or estimation.",
  },
  {
    templateId: "divide-by-two-digit",
    facetId: "multidigit-quotients.core",
    extent: "partial",
    rationale:
      "Divide a multidigit whole number by a two-digit divisor with a whole-number quotient. Does not assess remainders or checking by multiplication.",
  },
  {
    templateId: "multiply-facts",
    facetId: "multiplication-facts.core",
    extent: "partial",
    rationale:
      "Find a product of one-digit factors, with a dot array or a hidden part of the array. Does not assess fluency under time or division.",
  },
  {
    templateId: "multiplication-division-story",
    facetId: "multiplicative-stories.core",
    extent: "partial",
    rationale:
      "Solve a one-step multiplication or division story within the facts and enter the number. Does not assess choosing the equation.",
  },
  {
    templateId: "story-operation-choice",
    facetId: "multiplicative-stories.core",
    extent: "partial",
    rationale:
      "Choose the equation that matches a multiplication or division story. Does not assess solving the equation.",
  },
  {
    templateId: "multiply-by-tens",
    facetId: "multiply-tens.core",
    extent: "partial",
    rationale:
      "Multiply a one-digit number by a multiple of ten and enter the product. Does not assess multiples of 100.",
  },
  {
    templateId: "find-named-shape",
    facetId: "name-shapes.core",
    extent: "partial",
    rationale:
      "Find the shape with a stated name among several. Does not assess solid shapes.",
  },
  {
    templateId: "name-flat-shape",
    facetId: "name-shapes.core",
    extent: "partial",
    rationale:
      "Name a flat shape shown in different orientations. Does not assess describing attributes.",
  },
  {
    templateId: "name-solid-shape",
    facetId: "name-shapes.core",
    extent: "partial",
    rationale:
      "Name a solid shape from its picture. Does not assess flat shapes.",
  },
  {
    templateId: "quadratic-context-model",
    facetId: "nonlinear-equation-modeling.HSA.CED.A.1",
    extent: "partial",
    rationale:
      "Build and solve a quadratic equation in one variable from a described situation, such as the time a ball reaches a height or the width of a rectangle with a stated area. Does not assess rational or exponential constraints.",
  },
  {
    templateId: "quadratic-context-model",
    facetId: "nonlinear-equation-modeling.HSA.CED.A.2",
    extent: "partial",
    rationale:
      "Choose the quadratic expression that relates two quantities in a described situation, such as area in terms of width. Does not assess graphing on labeled axes, rational or exponential relationships.",
  },
  {
    templateId: "quadratic-context-model",
    facetId: "nonlinear-equation-modeling.core",
    extent: "partial",
    rationale:
      "Model with a quadratic: choose the expression for an area, find an initial height, the time a ball reaches a height, or a width from a stated area. Does not assess rational or exponential models.",
  },
  {
    templateId: "nonlinear-system-count",
    facetId: "nonlinear-intersection-count.HSA.REI.C.7",
    extent: "partial",
    rationale:
      "Count distinct real solutions of a line and parabola system by reducing it to a quadratic. Does not assess finding the solutions.",
  },
  {
    templateId: "nonlinear-system-read",
    facetId: "nonlinear-intersection-reading.HSA.REI.C.7",
    extent: "partial",
    rationale:
      "Read the coordinate of an intersection of a line and a parabola from the system and its graph. Does not assess solving algebraically.",
  },
  {
    templateId: "nonlinear-system-solve",
    facetId: "nonlinear-systems.HSA.REI.C.7",
    extent: "partial",
    rationale:
      "Solve a line and parabola system algebraically and enter a coordinate of an intersection. Does not assess circles or graphical solutions.",
  },
  {
    templateId: "number-line-hops",
    facetId: "number-line-arithmetic.core",
    extent: "partial",
    rationale:
      "Find where hops forward or back land on a number line. Does not assess writing an equation.",
  },
  {
    templateId: "number-line-missing-hop",
    facetId: "number-line-arithmetic.core",
    extent: "partial",
    rationale:
      "Find the length of a hop between two numbers on a number line. Does not assess several hops.",
  },
  {
    templateId: "number-system-closure-classify",
    facetId: "number-system-closure.HSN.RN.B.3",
    extent: "partial",
    rationale:
      "Decide whether sums and products of a rational and an irrational number are rational or irrational, including the zero exception. Does not assess writing the proof.",
  },
  {
    templateId: "oblique-triangle-solve",
    facetId: "oblique-triangles.core",
    extent: "partial",
    rationale:
      "Use the law of sines or the law of cosines to find a side or angle, and count how many triangles fit side-side-angle measurements. Does not assess area.",
  },
  {
    templateId: "balance-one-step",
    facetId: "one-step-equations.core",
    extent: "partial",
    rationale:
      "Read a level balance as a one-step equation to find the weight of a block. Does not assess writing the equation.",
  },
  {
    templateId: "one-step-equation",
    facetId: "one-step-equations.core",
    extent: "partial",
    rationale:
      "Solve a one-step equation with whole numbers, fractions or decimals. Does not assess checking the solution or two-step equations.",
  },
  {
    templateId: "one-step-equation-story",
    facetId: "one-step-equations.core",
    extent: "partial",
    rationale:
      "Choose the one-step equation that models a story. Does not assess solving.",
  },
  {
    templateId: "parabola-focus-directrix",
    facetId: "parabola-locus.HSG.GPE.A.2",
    extent: "partial",
    rationale:
      "Choose the equation of a parabola from its focus and directrix, find its vertex, directrix or focus, including with a horizontal axis of symmetry. Does not assess writing a derivation from equal distances.",
  },
  {
    templateId: "parallelogram-property-consequences",
    facetId: "parallelogram-proofs.HSG.CO.C.11",
    extent: "partial",
    rationale:
      "Choose the theorem that justifies a step about a parallelogram and apply rectangle diagonal properties to find a length. Does not assess writing a proof.",
  },
  {
    templateId: "equal-area-fraction",
    facetId: "partition-area.core",
    extent: "partial",
    rationale:
      "Name the fraction of a rectangle's area for one of equal-area parts. Does not assess finding the area itself.",
  },
  {
    templateId: "equal-area-part-size",
    facetId: "partition-area.core",
    extent: "partial",
    rationale:
      "Find the area of one equal part from the area of the whole. Does not assess fractional answers.",
  },
  {
    templateId: "sinusoid-model",
    facetId: "periodic-modeling.core",
    extent: "partial",
    rationale:
      "Choose the sine or cosine model for a periodic situation from its midline, amplitude, period and starting position. Does not assess fitting data or evaluating the model.",
  },
  {
    templateId: "combination-probability",
    facetId: "permutations-combinations.HSS.CP.B.9",
    extent: "partial",
    rationale:
      "Use combinations to count favorable and total selections and compute the probability of a compound event. Does not assess permutation-based probabilities.",
  },
  {
    templateId: "combination-count",
    facetId: "permutations-combinations.core",
    extent: "partial",
    rationale:
      "Count unordered selections. Does not assess ordered arrangements.",
  },
  {
    templateId: "combination-probability",
    facetId: "permutations-combinations.core",
    extent: "partial",
    rationale:
      "Find a probability by counting favorable groups over all equally likely groups. Does not assess permutation-based probability.",
  },
  {
    templateId: "permutation-count",
    facetId: "permutations-combinations.core",
    extent: "partial",
    rationale:
      "Count ordered arrangements. Does not assess unordered selections.",
  },
  {
    templateId: "piecewise-reading",
    facetId: "piecewise-functions.HSF.IF.C.7",
    extent: "partial",
    rationale:
      "Identify the linear piece of an absolute-value function on each side of its vertex, as needed to graph it. Does not assess drawing the graph or other function families.",
  },
  {
    templateId: "piecewise-evaluate",
    facetId: "piecewise-functions.core",
    extent: "partial",
    rationale:
      "Evaluate a piecewise function, including at a boundary value and in a pricing context. Does not assess graphing.",
  },
  {
    templateId: "piecewise-reading",
    facetId: "piecewise-functions.core",
    extent: "partial",
    rationale:
      "Rewrite an absolute-value function as its linear pieces on a stated interval. Does not assess graphing.",
  },
  {
    templateId: "name-polygon",
    facetId: "polygon-properties.core",
    extent: "partial",
    rationale: "Name a polygon from its picture. Does not assess solids.",
  },
  {
    templateId: "polygon-with-angles",
    facetId: "polygon-properties.core",
    extent: "partial",
    rationale:
      "Find the shape with a stated number of angles. Does not assess side lengths.",
  },
  {
    templateId: "solid-parts",
    facetId: "polygon-properties.core",
    extent: "partial",
    rationale:
      "Count the faces, edges or vertices of a solid, including hidden edges. Does not assess naming the solid.",
  },
  {
    templateId: "polygon-symmetry-counts",
    facetId: "polygon-symmetries.HSG.CO.A.3",
    extent: "partial",
    rationale:
      "Give the rotation angle or the number of reflection lines that carry a regular polygon or parallelogram onto itself. Does not assess drawing the symmetry.",
  },
  {
    templateId: "polynomial-behavior-description",
    facetId: "polynomial-behavior.HSF.IF.B.4",
    extent: "partial",
    rationale:
      "Describe the end behavior, zero behavior and number of turning points of a polynomial from its formula. Does not assess contextual interpretation or intervals of increase.",
  },
  {
    templateId: "polynomial-behavior-description",
    facetId: "polynomial-behavior.HSF.IF.C.7",
    extent: "partial",
    rationale:
      "Identify end behavior, behavior at zeros and turning points of a polynomial as needed to sketch its graph. Does not assess sketching a graph.",
  },
  {
    templateId: "remainder-theorem",
    facetId: "polynomial-division.HSA.APR.B.2",
    extent: "partial",
    rationale:
      "Use the remainder theorem and the factor theorem to find the remainder on division by x minus a number, or a coefficient for which a linear expression is a factor. Does not assess polynomial long division.",
  },
  {
    templateId: "polynomial-quotient",
    facetId: "polynomial-division.HSA.APR.D.6",
    extent: "partial",
    rationale:
      "Rewrite a polynomial as divisor times quotient plus remainder for a linear divisor. Does not assess higher-degree divisors or rational functions that need synthetic division.",
  },
  {
    templateId: "polynomial-quotient",
    facetId: "polynomial-division.core",
    extent: "partial",
    rationale:
      "Divide a polynomial by a linear factor and give the quotient and remainder. Does not assess division by higher-degree divisors.",
  },
  {
    templateId: "remainder-theorem",
    facetId: "polynomial-division.core",
    extent: "partial",
    rationale:
      "Use the remainder theorem to find a remainder or a coefficient that makes a linear expression a factor. Does not assess long division.",
  },
  {
    templateId: "polynomial-identity-use",
    facetId: "polynomial-identities.HSA.APR.C.4",
    extent: "partial",
    rationale:
      "Use a polynomial identity, such as difference of squares, to find a numerical value or compute a square without a calculator. Does not assess proving the identity.",
  },
  {
    templateId: "zero-multiplicity",
    facetId: "polynomial-zeros.HSA.APR.B.3",
    extent: "partial",
    rationale:
      "Use the multiplicity of a zero to decide whether the graph crosses or touches the x-axis, as needed to sketch it. Does not assess drawing the sketch.",
  },
  {
    templateId: "zeros-from-factors",
    facetId: "polynomial-zeros.HSA.APR.B.3",
    extent: "partial",
    rationale:
      "Identify the zeros of a polynomial from its factored form, choose the polynomial with stated zeros, or match a graph to a factored equation. Does not assess sketching the graph.",
  },
  {
    templateId: "zero-multiplicity",
    facetId: "polynomial-zeros.core",
    extent: "partial",
    rationale:
      "Tell whether a graph crosses or touches the x-axis at a zero from the zero's multiplicity. Does not assess end behavior.",
  },
  {
    templateId: "zeros-from-factors",
    facetId: "polynomial-zeros.core",
    extent: "partial",
    rationale:
      "Give the zeros of a polynomial written in factored form. Does not assess zeros of a polynomial not in factored form.",
  },
  {
    templateId: "digit-value-ratio",
    facetId: "powers-of-ten.core",
    extent: "partial",
    rationale:
      "Compare the values of the same digit in two places as a power-of-ten ratio. Does not assess decimal places.",
  },
  {
    templateId: "divide-power-of-ten",
    facetId: "powers-of-ten.core",
    extent: "partial",
    rationale:
      "Divide a whole number by 10, 100 or 1,000, with decimal quotients. Does not assess dividing decimals.",
  },
  {
    templateId: "multiply-power-of-ten",
    facetId: "powers-of-ten.core",
    extent: "partial",
    rationale:
      "Multiply a whole number by 10, 100, 1,000 or a power of ten written with an exponent. Does not assess decimal factors.",
  },
  {
    templateId: "composite-prism-volume",
    facetId: "prism-volume.core",
    extent: "partial",
    rationale:
      "Find the volume of two joined rectangular prisms. Does not assess composites with other solids.",
  },
  {
    templateId: "prism-missing-edge",
    facetId: "prism-volume.core",
    extent: "partial",
    rationale:
      "Find a missing edge of a rectangular prism from its volume. Does not assess surface area.",
  },
  {
    templateId: "prism-volume-edges",
    facetId: "prism-volume.core",
    extent: "partial",
    rationale:
      "Find the volume of a rectangular prism from its edge lengths. Does not assess surface area.",
  },
  {
    templateId: "addition-rule-probability",
    facetId: "probability-addition.HSS.CP.B.7",
    extent: "partial",
    rationale:
      "Apply the addition rule P(A or B) = P(A) + P(B) - P(A and B) to overlapping events in a card draw, stated probabilities or counts. Does not assess interpreting the answer in a written sentence.",
  },
  {
    templateId: "addition-rule-probability",
    facetId: "probability-addition.core",
    extent: "partial",
    rationale:
      "Find the probability of A or B using P(A) plus P(B) minus P(A and B), from a card draw, stated probabilities or a count of customers. Does not assess mutually exclusive events as a separate case.",
  },
  {
    templateId: "multiplication-rule-probability",
    facetId: "probability-multiplication.HSS.CP.B.8",
    extent: "partial",
    rationale:
      "Apply the general multiplication rule P(A and B) = P(A) P(B given A) to dependent draws and stated conditional probabilities. Does not assess interpreting the answer in a written sentence.",
  },
  {
    templateId: "multiplication-rule-probability",
    facetId: "probability-multiplication.core",
    extent: "partial",
    rationale:
      "Apply the conditional product rule P(A and B) = P(A) P(B given A) to dependent draws without replacement and to stated probabilities, such as rain and a late bus. Does not assess tree diagrams.",
  },
  {
    templateId: "parabola-axis",
    facetId: "quadratic-graphs.HSF.IF.B.4",
    extent: "partial",
    rationale:
      "Find the axis of symmetry of a parabola from two symmetric points or from its zeros on a graph. Does not assess contextual meaning of features.",
  },
  {
    templateId: "parabola-vertex",
    facetId: "quadratic-graphs.HSF.IF.B.4",
    extent: "partial",
    rationale:
      "Identify the vertex of a parabola from its equation, including standard form, or from its graph. Does not assess intercepts, intervals of change or contextual meaning.",
  },
  {
    templateId: "parabola-axis",
    facetId: "quadratic-graphs.HSF.IF.C.7",
    extent: "partial",
    rationale:
      "Find the axis of symmetry as needed to graph a quadratic. Does not assess drawing the graph.",
  },
  {
    templateId: "parabola-shift",
    facetId: "quadratic-graphs.HSF.IF.C.7",
    extent: "partial",
    rationale:
      "Match the translated graph of y = x squared to its vertex-form equation. Does not assess drawing the graph or stretches.",
  },
  {
    templateId: "parabola-vertex",
    facetId: "quadratic-graphs.HSF.IF.C.7",
    extent: "partial",
    rationale:
      "Identify the vertex of a quadratic from its equation or graph as needed to graph it. Does not assess drawing the graph or other function families.",
  },
  {
    templateId: "classify-quadrilateral",
    facetId: "quadrilateral-categories.core",
    extent: "partial",
    rationale:
      "Choose the most exact name for a quadrilateral, using shared attributes among squares, rectangles and rhombuses. Does not assess drawing quadrilaterals.",
  },
  {
    templateId: "find-quadrilateral",
    facetId: "quadrilateral-categories.core",
    extent: "partial",
    rationale:
      "Find the quadrilateral with stated attributes among several. Does not assess naming a given shape.",
  },
  {
    templateId: "degree-radian-conversion",
    facetId: "radians-unit-circle.core",
    extent: "partial",
    rationale:
      "Convert between degrees and radians. Does not assess negative angles.",
  },
  {
    templateId: "radian-arc-ratio",
    facetId: "radians-unit-circle.core",
    extent: "partial",
    rationale:
      "Find the radian measure of an angle as arc length divided by radius. Does not assess arcs longer than one turn.",
  },
  {
    templateId: "unit-circle-coordinate",
    facetId: "radians-unit-circle.core",
    extent: "partial",
    rationale:
      "Find a coordinate of the point at a stated angle on the unit circle. Does not assess angles in radians.",
  },
  {
    templateId: "radical-equation-check",
    facetId: "radical-equations.HSA.REI.A.2",
    extent: "partial",
    rationale:
      "Solve a radical equation, check the candidates in the original equation and identify extraneous solutions. Does not assess rational equations or equations with two radicals.",
  },
  {
    templateId: "radical-equation-check",
    facetId: "radical-equations.core",
    extent: "partial",
    rationale:
      "Solve a radical equation by squaring and decide which candidate solutions are valid. Does not assess cube-root equations or equations with two radicals.",
  },
  {
    templateId: "double-number-line-missing",
    facetId: "ratio-tables.core",
    extent: "partial",
    rationale:
      "Read a double number line to find a missing equivalent value. Does not assess ratio tables.",
  },
  {
    templateId: "ratio-table-missing",
    facetId: "ratio-tables.core",
    extent: "partial",
    rationale:
      "Complete a ratio table of equivalent ratios. Does not assess double number lines.",
  },
  {
    templateId: "rational-equation-one-denominator",
    facetId: "rational-equation-one-denominator.core",
    extent: "partial",
    rationale:
      "Solve a rational equation with a single variable denominator and enter the solution as a fraction. Does not assess multiple denominators or checking excluded values.",
  },
  {
    templateId: "rational-equation-check",
    facetId: "rational-equations.HSA.REI.A.2",
    extent: "partial",
    rationale:
      "Solve a rational equation, check candidates against the excluded values and identify extraneous solutions. Does not assess radical equations.",
  },
  {
    templateId: "rational-equation-check",
    facetId: "rational-equations.core",
    extent: "partial",
    rationale:
      "Solve a rational equation and decide which candidates remain after checking excluded values. Does not assess equations with several denominators.",
  },
  {
    templateId: "symbolic-rational-exponent",
    facetId: "rational-exponents.HSN.RN.A.1",
    extent: "partial",
    rationale:
      "Rewrite a radical expression as a power with a rational exponent and the reverse for positive variables. Does not assess explaining why the definition extends the integer-exponent properties.",
  },
  {
    templateId: "rational-power",
    facetId: "rational-exponents.core",
    extent: "partial",
    rationale:
      "Evaluate a fractional power of a perfect power. Does not assess variables.",
  },
  {
    templateId: "symbolic-rational-exponent",
    facetId: "rational-exponents.core",
    extent: "partial",
    rationale:
      "Rewrite radicals and fractional exponents as equivalent expressions for positive variables. Does not assess evaluation.",
  },
  {
    templateId: "rational-expression-domain",
    facetId: "rational-expression-domain.core",
    extent: "partial",
    rationale:
      "Choose the real inputs excluded from the domain of a rational expression with a factored denominator. Does not assess unfactored denominators or simplifying.",
  },
  {
    templateId: "rational-expression-operation",
    facetId: "rational-expressions.core",
    extent: "partial",
    rationale:
      "Combine rational expressions by multiplying and keep the stated restrictions. Does not assess addition with unlike denominators.",
  },
  {
    templateId: "rational-expression-simplify",
    facetId: "rational-expressions.core",
    extent: "partial",
    rationale:
      "Simplify a rational expression while retaining the exclusions of the original. Does not assess operations on several expressions in this item.",
  },
  {
    templateId: "rational-function-features",
    facetId: "rational-function-behavior.HSF.IF.B.4",
    extent: "partial",
    rationale:
      "Identify vertical and horizontal asymptotes, holes and intercepts of a rational function from its formula. Does not assess contextual interpretation.",
  },
  {
    templateId: "rational-function-features",
    facetId: "rational-function-behavior.HSF.IF.C.7",
    extent: "partial",
    rationale:
      "Identify the asymptotes, holes and intercepts needed to graph a rational function. Does not assess drawing the graph.",
  },
  {
    templateId: "signed-jumps",
    facetId: "rational-stories.core",
    extent: "partial",
    rationale:
      "Follow a series of signed changes on a number line from a signed decimal start. Does not assess writing a number sentence.",
  },
  {
    templateId: "signed-story",
    facetId: "rational-stories.core",
    extent: "partial",
    rationale:
      "Solve a story with signed decimals, such as bank balances, temperatures or a diver's depth, through several changes. Does not assess fractions.",
  },
  {
    templateId: "fraction-unit-rate",
    facetId: "rational-unit-rates.core",
    extent: "partial",
    rationale:
      "Find a unit rate from fractional quantities with a double number line. Does not assess complex fractions without a context.",
  },
  {
    templateId: "regression-coefficient-meaning",
    facetId: "regression-interpretation.HSS.ID.C.7",
    extent: "partial",
    rationale:
      "Interpret the slope and intercept of a least-squares line in the units of the context. Does not assess computing the line.",
  },
  {
    templateId: "regression-line-predict",
    facetId: "regression-interpretation.HSS.ID.C.7",
    extent: "partial",
    rationale:
      "Use a least-squares line in context to predict a value. Does not assess computing the line.",
  },
  {
    templateId: "pattern-pair-relationship",
    facetId: "related-patterns.core",
    extent: "partial",
    rationale:
      "Describe the relationship between corresponding terms in two patterns made from ordered pairs. Does not assess graphing the pairs.",
  },
  {
    templateId: "related-patterns-relationship",
    facetId: "related-patterns.core",
    extent: "partial",
    rationale:
      "Compare matching terms of two patterns generated by rules. Does not assess graphing ordered pairs.",
  },
  {
    templateId: "residual-value",
    facetId: "residuals-correlation.HSS.ID.B.6",
    extent: "partial",
    rationale:
      "Compute and interpret a residual for a fitted line. Does not assess fitting the function or plotting residuals.",
  },
  {
    templateId: "correlation-choice",
    facetId: "residuals-correlation.HSS.ID.C.8",
    extent: "partial",
    rationale:
      "Estimate and interpret the correlation coefficient from a scatter plot. Does not assess computing it with technology.",
  },
  {
    templateId: "correlation-choice",
    facetId: "residuals-correlation.core",
    extent: "partial",
    rationale:
      "Choose the correlation coefficient closest to a scatter plot, and read a residual plot. Does not assess computing r.",
  },
  {
    templateId: "residual-value",
    facetId: "residuals-correlation.core",
    extent: "partial",
    rationale:
      "Compute a residual, observed minus predicted, from a scatter plot with its fitted line. Does not assess computing the line.",
  },
  {
    templateId: "trig-ratio",
    facetId: "right-triangle-trigonometry.HSG.SRT.C.6",
    extent: "partial",
    rationale:
      "Use sine, cosine and tangent as side ratios of a right triangle with a given angle to find a side length. Does not assess explaining why the ratios depend only on the angle through similarity.",
  },
  {
    templateId: "trig-context-triangle",
    facetId: "right-triangle-trigonometry.HSG.SRT.C.8",
    extent: "partial",
    rationale:
      "Solve a right triangle from a described situation, such as angle of elevation and height, with trigonometric ratios. Does not assess the Pythagorean theorem alone.",
  },
  {
    templateId: "identify-rigid-motion",
    facetId: "rigid-motions.core",
    extent: "partial",
    rationale:
      "Identify the single rigid motion that maps a triangle onto its image from coordinates. Does not assess composite transformations.",
  },
  {
    templateId: "transformation-image",
    facetId: "rigid-motions.core",
    extent: "partial",
    rationale:
      "Find the coordinates of a figure after a translation, reflection or rotation. Does not assess composite transformations.",
  },
  {
    templateId: "round-to-hundred",
    facetId: "round-whole-numbers.core",
    extent: "partial",
    rationale:
      "Round a whole number to the nearest hundred. Does not assess rounding in context.",
  },
  {
    templateId: "round-to-ten",
    facetId: "round-whole-numbers.core",
    extent: "partial",
    rationale:
      "Round a whole number to the nearest ten. Does not assess rounding in context.",
  },
  {
    templateId: "rule-pattern-feature",
    facetId: "rule-patterns.core",
    extent: "partial",
    rationale:
      "Decide what a pattern rule guarantees about the numbers, such as parity. Does not assess writing a rule.",
  },
  {
    templateId: "rule-pattern-term",
    facetId: "rule-patterns.core",
    extent: "partial",
    rationale:
      "Extend a number pattern from a stated start and rule to a later term. Does not assess shape patterns.",
  },
  {
    templateId: "sample-size-margin",
    facetId: "sampling-margin-error.core",
    extent: "partial",
    rationale:
      "Compare the margins of error of surveys with different sample sizes. Does not assess computing a margin of error or running a simulation.",
  },
  {
    templateId: "representative-sample-choice",
    facetId: "sampling.core",
    extent: "partial",
    rationale:
      "Choose the sampling method most likely to give a representative sample. Does not assess analyzing data.",
  },
  {
    templateId: "sample-estimates-plot",
    facetId: "sampling.core",
    extent: "partial",
    rationale:
      "Estimate a population value from the mean of several random samples. Does not assess designing the samples.",
  },
  {
    templateId: "sample-proportion-estimate",
    facetId: "sampling.core",
    extent: "partial",
    rationale:
      "Estimate a population count from a random sample proportion. Does not assess margin of error.",
  },
  {
    templateId: "scale-drawing",
    facetId: "scale-drawings.core",
    extent: "partial",
    rationale:
      "Convert lengths and areas between a scale drawing and the actual object in either direction. Does not assess drawing at a new scale.",
  },
  {
    templateId: "scaled-bar-graph",
    facetId: "scaled-graphs.core",
    extent: "partial",
    rationale:
      "Read a scaled bar graph and combine or compare bar values. Does not assess making the graph.",
  },
  {
    templateId: "scaled-picture-graph",
    facetId: "scaled-graphs.core",
    extent: "partial",
    rationale:
      "Read a picture graph with a key where each picture stands for several. Does not assess making the graph.",
  },
  {
    templateId: "scatter-association-choice",
    facetId: "scatterplots.core",
    extent: "partial",
    rationale:
      "Describe the association shown in a scatter plot. Does not assess calculating statistics.",
  },
  {
    templateId: "trend-line-predict",
    facetId: "scatterplots.core",
    extent: "partial",
    rationale:
      "Use an informal trend line to predict a value. Does not assess drawing the line.",
  },
  {
    templateId: "trend-slope-meaning",
    facetId: "scatterplots.core",
    extent: "partial",
    rationale:
      "Interpret the slope of a trend line in context. Does not assess the intercept.",
  },
  {
    templateId: "scientific-operations",
    facetId: "scientific-notation.core",
    extent: "partial",
    rationale:
      "Multiply numbers in scientific notation and write the product in scientific notation. Does not assess addition.",
  },
  {
    templateId: "scientific-times-larger",
    facetId: "scientific-notation.core",
    extent: "partial",
    rationale:
      "Compare two scientific-notation values by how many times as large one is. Does not assess sums.",
  },
  {
    templateId: "scientific-to-standard",
    facetId: "scientific-notation.core",
    extent: "partial",
    rationale:
      "Write a number in scientific notation in standard form. Does not assess the reverse.",
  },
  {
    templateId: "standard-to-scientific",
    facetId: "scientific-notation.core",
    extent: "partial",
    rationale:
      "Write a number in scientific notation. Does not assess operations.",
  },
  {
    templateId: "segment-partition",
    facetId: "segment-division.HSG.GPE.B.6",
    extent: "partial",
    rationale:
      "Find the point on a directed segment that partitions it in a stated ratio. Does not assess external division.",
  },
  {
    templateId: "segment-partition",
    facetId: "segment-division.core",
    extent: "partial",
    rationale:
      "Find a coordinate of the point that divides a directed segment in a stated ratio. Does not assess external division.",
  },
  {
    templateId: "geometric-series-sum",
    facetId: "sequence-sums.HSA.SSE.B.4",
    extent: "partial",
    rationale:
      "Use a finite geometric series sum to solve a story or a sum with a stated first term and ratio. Does not assess deriving the sum formula or ratios equal to one.",
  },
  {
    templateId: "geometric-series-sum",
    facetId: "sequence-sums.core",
    extent: "partial",
    rationale:
      "Find the total of a finite geometric series from a first term and ratio, shown in a story with a bar chart or in sigma notation. Does not assess infinite series.",
  },
  {
    templateId: "count-sides-corners",
    facetId: "shape-attributes.core",
    extent: "partial",
    rationale:
      "Count the sides or corners of a flat shape. Does not assess naming shapes.",
  },
  {
    templateId: "defining-attribute",
    facetId: "shape-attributes.core",
    extent: "partial",
    rationale:
      "Choose the attribute that is true for every shape in a named category, as opposed to non-defining attributes. Does not assess sorting a set.",
  },
  {
    templateId: "hierarchy-statement",
    facetId: "shape-hierarchy.core",
    extent: "partial",
    rationale:
      "Choose the statement that is always true about shape categories. Does not assess properties of a single named shape.",
  },
  {
    templateId: "inherited-property",
    facetId: "shape-hierarchy.core",
    extent: "partial",
    rationale:
      "Decide which shape must share a property of its parent category. Does not assess properties unique to a subcategory.",
  },
  {
    templateId: "quadrilateral-hierarchy-multiselect",
    facetId: "shape-hierarchy.core",
    extent: "partial",
    rationale:
      "Choose every always-true statement about quadrilateral categories in a multi-select item. Does not assess drawing.",
  },
  {
    templateId: "quadrilateral-names",
    facetId: "shape-hierarchy.core",
    extent: "partial",
    rationale:
      "Choose every name that fits a quadrilateral, such as a square being a rectangle and a rhombus. Does not assess drawing.",
  },
  {
    templateId: "interquartile-range-data",
    facetId: "signed-data-summaries.core",
    extent: "partial",
    rationale:
      "Find the interquartile range of a list of signed numbers using the stated quartile method. Does not assess box plots.",
  },
  {
    templateId: "median-data",
    facetId: "signed-data-summaries.core",
    extent: "partial",
    rationale:
      "Find the median of a list of signed decimals or integers. Does not assess data displays.",
  },
  {
    templateId: "range-data",
    facetId: "signed-data-summaries.core",
    extent: "partial",
    rationale:
      "Find the range of a list of signed numbers. Does not assess data displays.",
  },
  {
    templateId: "signed-fraction-product",
    facetId: "signed-multiplication.core",
    extent: "partial",
    rationale:
      "Multiply and divide signed fractions and enter an exact fraction. Does not assess decimals or contexts.",
  },
  {
    templateId: "opposite-on-line",
    facetId: "signed-numbers.core",
    extent: "partial",
    rationale:
      "Find the opposite of a number on a number line. Does not assess absolute value.",
  },
  {
    templateId: "signed-quantity",
    facetId: "signed-numbers.core",
    extent: "partial",
    rationale:
      "Write a signed number for a quantity such as floors above or below ground. Does not assess comparing signed numbers.",
  },
  {
    templateId: "similar-triangle-side",
    facetId: "similarity-proofs.HSG.SRT.B.5",
    extent: "partial",
    rationale:
      "Use similarity of triangles, including a triangle cut by a parallel line and a shadow situation, to find an unknown length, area or perimeter. Does not assess congruence criteria or proving relationships.",
  },
  {
    templateId: "similar-triangle-side",
    facetId: "similarity-proofs.core",
    extent: "partial",
    rationale:
      "Use corresponding sides of triangles known to be similar, including a triangle cut by a parallel line, ratios of area and perimeter, and a shadow situation, to find a missing quantity. Does not assess establishing similarity or writing a proof.",
  },
  {
    templateId: "inequality-from-context",
    facetId: "simple-inequalities.core",
    extent: "partial",
    rationale:
      "Choose the inequality that describes a stated condition. Does not assess solving.",
  },
  {
    templateId: "inequality-from-number-line",
    facetId: "simple-inequalities.core",
    extent: "partial",
    rationale:
      "Read an inequality from a number line graph. Does not assess compound inequalities.",
  },
  {
    templateId: "inequality-number-line-choice",
    facetId: "simple-inequalities.core",
    extent: "partial",
    rationale:
      "Choose the number line that graphs a stated inequality. Does not assess drawing.",
  },
  {
    templateId: "inequality-solution-set",
    facetId: "simple-inequalities.core",
    extent: "partial",
    rationale:
      "Recognize which values are solutions of an inequality. Does not assess solving.",
  },
  {
    templateId: "perpendicular-slopes",
    facetId: "slope-proofs.HSG.GPE.B.5",
    extent: "partial",
    rationale:
      "Apply the slope criteria for parallel and perpendicular lines to find an unknown coordinate, and the equation of a line through a point parallel or perpendicular to a given line. Does not assess proving the criteria.",
  },
  {
    templateId: "perpendicular-slopes",
    facetId: "slope-proofs.core",
    extent: "partial",
    rationale:
      "Use the slope criteria for parallel and perpendicular lines to find a coordinate, a perpendicular slope or the equation of a parallel or perpendicular line through a point. Does not assess proofs of the criteria.",
  },
  {
    templateId: "cross-section-area",
    facetId: "solid-cross-sections.core",
    extent: "partial",
    rationale:
      "Find the area of a plane cross-section of a rectangular prism. Does not assess pyramids.",
  },
  {
    templateId: "cross-section-shape",
    facetId: "solid-cross-sections.core",
    extent: "partial",
    rationale:
      "Name the shape of a plane cross-section of a prism or pyramid. Does not assess curved solids.",
  },
  {
    templateId: "sort-shapes-count",
    facetId: "sort-and-count.core",
    extent: "partial",
    rationale:
      "Sort shapes by kind and count one category. Does not assess comparing categories.",
  },
  {
    templateId: "sort-shapes-most",
    facetId: "sort-and-count.core",
    extent: "partial",
    rationale:
      "Sort shapes by kind and find the category with the most. Does not assess counting a single category.",
  },
  {
    templateId: "special-angle-exact-value",
    facetId: "special-angle-values.core",
    extent: "partial",
    rationale:
      "Find exact coordinates or trigonometric values at special angles in radians across quadrants. Does not assess non-special angles.",
  },
  {
    templateId: "special-right-triangle",
    facetId: "special-right-triangles.HSG.SRT.C.8",
    extent: "partial",
    rationale:
      "Use special right-triangle side ratios to find lengths. Does not assess general trigonometric ratios or word problems.",
  },
  {
    templateId: "special-right-triangle",
    facetId: "special-right-triangles.core",
    extent: "partial",
    rationale:
      "Find sides of 45-45-90 and 30-60-90 triangles from one given side. Does not assess deriving the ratios.",
  },
  {
    templateId: "radical-equation-isolated",
    facetId: "square-root-equations.core",
    extent: "partial",
    rationale:
      "Solve an equation with an isolated square root and a constant right side. Does not assess variable right sides.",
  },
  {
    templateId: "radical-equation-shifted",
    facetId: "square-root-equations.core",
    extent: "partial",
    rationale:
      "Isolate a square root first and solve the equation. Does not assess variable right sides.",
  },
  {
    templateId: "margin-of-error-interval",
    facetId: "statistical-inference.core",
    extent: "partial",
    rationale:
      "Interpret a margin of error as a range around a sample estimate. Does not assess computing the margin.",
  },
  {
    templateId: "sample-mean-estimate",
    facetId: "statistical-inference.core",
    extent: "partial",
    rationale:
      "Use a random sample mean as the estimate of a population mean. Does not assess margin of error.",
  },
  {
    templateId: "statistical-question-choice",
    facetId: "statistical-questions.core",
    extent: "partial",
    rationale:
      "Choose which question is a statistical question because it anticipates variability. Does not assess collecting data.",
  },
  {
    templateId: "outlier-center-shift",
    facetId: "statistical-summary-comparison.HSS.ID.A.3",
    extent: "partial",
    rationale:
      "Interpret the effect of an outlier on the center of a distribution. Does not assess spread.",
  },
  {
    templateId: "skewed-box-compare",
    facetId: "statistical-summary-comparison.HSS.ID.A.3",
    extent: "partial",
    rationale:
      "Interpret differences in shape, center and spread of two distributions in context. Does not assess outlier removal.",
  },
  {
    templateId: "outlier-center-shift",
    facetId: "statistical-summary-comparison.core",
    extent: "partial",
    rationale:
      "Decide how an outlier changes the mean and median. Does not assess standard deviation.",
  },
  {
    templateId: "skewed-box-compare",
    facetId: "statistical-summary-comparison.core",
    extent: "partial",
    rationale:
      "Choose the measures of center and spread that fit the shape of two box plots. Does not assess computing statistics.",
  },
  {
    templateId: "standard-deviation-compare",
    facetId: "statistical-summary-comparison.core",
    extent: "partial",
    rationale:
      "Compare the standard deviations of two data sets by spread. Does not assess computing standard deviation.",
  },
  {
    templateId: "scope-of-inference-choice",
    facetId: "study-design.HSS.IC.B.3",
    extent: "partial",
    rationale:
      "Decide what a study with volunteer or convenience sampling and random assignment can support. Does not assess designing a survey.",
  },
  {
    templateId: "subtract-two-digit-regroup",
    facetId: "subtraction-within-100.core",
    extent: "partial",
    rationale:
      "Subtract two-digit numbers with regrouping and enter the difference. Does not assess story problems.",
  },
  {
    templateId: "net-surface-area",
    facetId: "surface-area.core",
    extent: "partial",
    rationale:
      "Find the surface area of a prism or pyramid from its net. Does not assess drawing nets.",
  },
  {
    templateId: "literal-equation-solve",
    facetId: "symbolic-linear-constraints.HSA.REI.B.3",
    extent: "partial",
    rationale:
      "Solve a linear equation or inequality with literal coefficients, applying stated sign conditions. Does not assess systems.",
  },
  {
    templateId: "parameter-solution-count",
    facetId: "symbolic-linear-constraints.HSA.REI.B.3",
    extent: "partial",
    rationale:
      "Find the parameter value for which a linear equation has no solution or infinitely many solutions, or for which a linear system has no solution. Does not assess solving for x.",
  },
  {
    templateId: "literal-equation-solve",
    facetId: "symbolic-linear-constraints.core",
    extent: "partial",
    rationale:
      "Solve a linear equation or inequality with a letter coefficient, using stated sign conditions. Does not assess systems.",
  },
  {
    templateId: "parameter-solution-count",
    facetId: "symbolic-linear-constraints.core",
    extent: "partial",
    rationale:
      "Find the parameter value for which a linear equation has no solution or infinitely many solutions, or for which a linear system has no solution. Does not assess solving for x.",
  },
  {
    templateId: "constraint-feasible",
    facetId: "systems-modeling.HSA.CED.A.3",
    extent: "partial",
    rationale:
      "Represent constraints by inequalities and decide which combination is viable in a situation. Does not assess graphing the feasible region.",
  },
  {
    templateId: "constraint-feasible",
    facetId: "systems-modeling.core",
    extent: "partial",
    rationale:
      "Find a combination that meets every stated constraint in a situation with inequalities. Does not assess graphing the feasible region.",
  },
  {
    templateId: "system-model-value",
    facetId: "systems-modeling.core",
    extent: "partial",
    rationale:
      "Model a two-variable situation as a system and solve for a quantity. Does not assess inequalities.",
  },
  {
    templateId: "tangent-circle-computation",
    facetId: "tangent-construction.HSG.C.A.4",
    extent: "partial",
    rationale:
      "Use the perpendicular relationship between a tangent and the radius at the point of tangency to compute a tangent length from an external point. Does not assess performing the compass-and-straightedge construction.",
  },
  {
    templateId: "find-equal-thirds",
    facetId: "thirds-and-partitions.core",
    extent: "partial",
    rationale:
      "Choose the shape cut into equal halves, thirds or quarters. Does not assess partitioning a shape.",
  },
  {
    templateId: "name-share",
    facetId: "thirds-and-partitions.core",
    extent: "partial",
    rationale:
      "Name the fraction of a shape that is shaded when it is cut into equal halves, thirds or quarters. Does not assess partitioning a shape.",
  },
  {
    templateId: "same-share-different-shape",
    facetId: "thirds-and-partitions.core",
    extent: "partial",
    rationale:
      "Recognize that equal shares of same-size wholes can have different shapes. Does not assess naming fractions.",
  },
  {
    templateId: "transformation-sequence-mapping",
    facetId: "transformation-constructions.HSG.CO.A.5",
    extent: "partial",
    rationale:
      "Choose the sequence of transformations that maps a figure onto its image from vertex coordinates, including a dilation. Does not assess drawing the transformed figure.",
  },
  {
    templateId: "transformation-invariant-claims",
    facetId: "transformation-invariants.HSG.CO.A.2",
    extent: "partial",
    rationale:
      "Compare what dilations, rotations and other transformations preserve about distance and angle. Does not assess drawing transformations as functions on the plane.",
  },
  {
    templateId: "transformation-invariant-claims",
    facetId: "transformation-invariants.HSG.CO.A.4",
    extent: "partial",
    rationale:
      "Choose the statement that must hold for the image under a rotation, a reflection or a dilation, using its center and angle. Does not assess writing the definitions.",
  },
  {
    templateId: "parallel-lines-angle",
    facetId: "triangle-angle-theorems.core",
    extent: "partial",
    rationale:
      "Find an angle or variable from parallel lines cut by a transversal. Does not assess naming the angle pairs.",
  },
  {
    templateId: "triangle-angle-sum",
    facetId: "triangle-angle-theorems.core",
    extent: "partial",
    rationale:
      "Find a triangle angle from the angle sum, including with algebraic angle expressions. Does not assess proofs.",
  },
  {
    templateId: "triangle-exterior-angle",
    facetId: "triangle-angle-theorems.core",
    extent: "partial",
    rationale:
      "Find an angle using the exterior angle of a triangle. Does not assess proofs.",
  },
  {
    templateId: "polygon-area-decompose",
    facetId: "triangle-area.core",
    extent: "partial",
    rationale:
      "Find the area of a trapezoid or pentagon by decomposition into rectangles and triangles. Does not assess polygons with more than the shapes shown.",
  },
  {
    templateId: "triangle-area-base-height",
    facetId: "triangle-area.core",
    extent: "partial",
    rationale:
      "Find the area of a triangle from its base and height. Does not assess obtuse triangles drawn with an external height.",
  },
  {
    templateId: "triangle-circle-centers",
    facetId: "triangle-circles.HSG.C.A.3",
    extent: "partial",
    rationale:
      "Choose the construction that locates a triangle's circumcenter and compute a circumradius for a right triangle. Does not assess the incircle or the opposite angles of a cyclic quadrilateral.",
  },
  {
    templateId: "triangle-conditions",
    facetId: "triangle-construction.core",
    extent: "partial",
    rationale:
      "Decide how many triangles are determined by stated angle or side-angle-side conditions. Does not assess ambiguous cases.",
  },
  {
    templateId: "triangle-side-test",
    facetId: "triangle-construction.core",
    extent: "partial",
    rationale:
      "Choose side lengths that can form a triangle by the triangle inequality. Does not assess angle conditions.",
  },
  {
    templateId: "triangle-third-side",
    facetId: "triangle-construction.core",
    extent: "partial",
    rationale:
      "Find the greatest or the number of possible whole-number third sides from two sides. Does not assess angle conditions.",
  },
  {
    templateId: "triangle-uniqueness",
    facetId: "triangle-construction.core",
    extent: "partial",
    rationale:
      "Decide how many triangles fit side-side-angle measures, including the ambiguous case. Does not assess constructing the triangle.",
  },
  {
    templateId: "triangle-theorem-consequences",
    facetId: "triangle-proofs.HSG.CO.C.10",
    extent: "partial",
    rationale:
      "Use the midsegment theorem and the concurrency of medians to find lengths, and choose steps of the proof that the angles of a triangle sum to 180 degrees. Does not assess writing a complete proof.",
  },
  {
    templateId: "trig-triangle-area",
    facetId: "trigonometric-area.core",
    extent: "partial",
    rationale:
      "Find a triangle's area from two sides and the included angle, including comparing areas for different angles. Does not assess deriving the formula.",
  },
  {
    templateId: "trig-equation-solutions",
    facetId: "trigonometric-equations.core",
    extent: "partial",
    rationale:
      "Choose all solutions of a basic trigonometric equation on 0 to 2 pi. Does not assess identity-based equations or other intervals.",
  },
  {
    templateId: "sinusoid-parameters",
    facetId: "trigonometric-graphs.HSF.IF.B.4",
    extent: "partial",
    rationale:
      "Interpret the amplitude, period, midline and horizontal shift of a sinusoid from its formula. Does not assess contextual interpretation.",
  },
  {
    templateId: "sinusoid-parameters",
    facetId: "trigonometric-graphs.core",
    extent: "partial",
    rationale:
      "Use amplitude, period, midline and horizontal shift of a sinusoid to find extreme values, period or the shift. Does not assess reading a graph.",
  },
  {
    templateId: "trig-identity-value",
    facetId: "trigonometric-identities.core",
    extent: "partial",
    rationale:
      "Find an exact trigonometric value with the Pythagorean identity or the angle-sum identity. Does not assess proving an identity.",
  },
  {
    templateId: "trig-symmetry-value",
    facetId: "trigonometric-symmetry.core",
    extent: "partial",
    rationale:
      "Use unit-circle symmetry and periodicity to relate a trigonometric value to a given one. Does not assess explaining the symmetry.",
  },
  {
    templateId: "balance-two-step",
    facetId: "two-step-equations.core",
    extent: "partial",
    rationale:
      "Read a level balance as a two-step equation to find a block's weight. Does not assess writing the equation.",
  },
  {
    templateId: "two-step-equation",
    facetId: "two-step-equations.core",
    extent: "partial",
    rationale:
      "Solve a two-step equation with integer coefficients. Does not assess variables on both sides.",
  },
  {
    templateId: "two-step-equation-model",
    facetId: "two-step-equations.core",
    extent: "partial",
    rationale:
      "Choose the two-step equation that models a story. Does not assess solving.",
  },
  {
    templateId: "two-step-word-problem",
    facetId: "two-step-equations.core",
    extent: "partial",
    rationale:
      "Solve a story that needs a two-step equation. Does not assess writing the equation.",
  },
  {
    templateId: "two-way-association-choice",
    facetId: "two-way-tables.core",
    extent: "partial",
    rationale:
      "Decide whether a two-way table shows an association by comparing relative frequencies. Does not assess computing association measures.",
  },
  {
    templateId: "two-way-missing",
    facetId: "two-way-tables.core",
    extent: "partial",
    rationale: "Read a count from a two-way table. Does not assess percents.",
  },
  {
    templateId: "two-way-row-percent",
    facetId: "two-way-tables.core",
    extent: "partial",
    rationale:
      "Compute a percent within a row of a two-way table. Does not assess column percents.",
  },
  {
    templateId: "better-buy",
    facetId: "unit-rates.core",
    extent: "partial",
    rationale:
      "Compare unit prices to choose the better buy. Does not assess more than two options.",
  },
  {
    templateId: "unit-rate",
    facetId: "unit-rates.core",
    extent: "partial",
    rationale:
      "Find a unit rate, in either direction, from a ratio of quantities. Does not assess rates with fractional quantities.",
  },
  {
    templateId: "dot-plot-iqr",
    facetId: "variability.core",
    extent: "partial",
    rationale:
      "Compute the interquartile range from a dot plot. Does not assess box plots.",
  },
  {
    templateId: "dot-plot-mad",
    facetId: "variability.core",
    extent: "partial",
    rationale:
      "Compute the mean absolute deviation from a dot plot. Does not assess standard deviation.",
  },
  {
    templateId: "typical-value-choice",
    facetId: "variability.core",
    extent: "partial",
    rationale:
      "Choose the best measure of the typical value from a dot plot given its shape. Does not assess computing statistics.",
  },
  {
    templateId: "cube-layer-count",
    facetId: "volume-cubes.core",
    extent: "partial",
    rationale:
      "Count the unit cubes in one layer of a prism. Does not assess the total volume.",
  },
  {
    templateId: "unit-cube-volume",
    facetId: "volume-cubes.core",
    extent: "partial",
    rationale:
      "Find volume as a count of unit cubes in a prism. Does not assess formulas.",
  },
  {
    templateId: "add-multidigit",
    facetId: "whole-add-subtract.core",
    extent: "partial",
    rationale: "Add multidigit whole numbers. Does not assess story problems.",
  },
  {
    templateId: "subtract-multidigit",
    facetId: "whole-add-subtract.core",
    extent: "partial",
    rationale:
      "Subtract multidigit whole numbers. Does not assess story problems.",
  },
  {
    templateId: "divide-by-one-digit",
    facetId: "whole-division.core",
    extent: "partial",
    rationale:
      "Divide a multidigit number by a one-digit divisor. Does not assess two-digit divisors.",
  },
  {
    templateId: "division-remainder",
    facetId: "whole-division.core",
    extent: "partial",
    rationale:
      "Find the remainder when dividing. Does not assess the quotient.",
  },
  {
    templateId: "numeral-for-quantity",
    facetId: "write-numerals.core",
    extent: "partial",
    rationale:
      "Write the numeral for a quantity shown in ten frames. Does not assess handwriting.",
  },
];
