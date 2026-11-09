import type { ProblemMethod } from "./problem-lessons";

/** Methods for the added clause surfaces. The active surface also selects
 * its own worked example, so a construction task receives construction help. */
const method = (
  goal: string,
  intuition: string,
  steps: string[],
  watch: string,
): ProblemMethod => ({ goal, intuition, method: steps, watch });
const sampling = method(
  "Decide what a sample supports about a population.",
  "A population is the whole group of interest. A sample is the smaller group observed. Random selection lets each member be selected, but samples can differ.",
  [
    "Identify the whole population and who could enter the sample.",
    "Calculate the sample's share, then apply it to the population if the selection supports that inference.",
    "State a population estimate as approximate. Separate arithmetic from whether the sample represents the whole group.",
  ],
  "A large sample from a biased selection method does not remove the bias.",
);
const variation = method(
  "Measure how much estimates from random samples vary.",
  "Different random samples can give different counts. To compare population estimates, first convert every sample count to the population scale.",
  [
    "Divide the population size by the sample size to find the scale factor.",
    "Multiply the smallest and largest counts by this factor.",
    "For the range, subtract the extremes. For the greatest distance from a mean estimate, compare both extremes with that mean.",
  ],
  "The range is the full spread; distance from the mean is measured from the center.",
);
const plot = method(
  "Construct paired points and describe their pattern.",
  "One row of paired data describes one observation. Its first value is the horizontal coordinate; its second is the vertical coordinate.",
  [
    "Read the axis labels and units. Plot each row as one point, across first and then up.",
    "Look for a general increase, decrease, bend, or lack of pattern.",
    "Check gaps between groups and dots far from the main pattern. A distant horizontal coordinate alone is not an outlier.",
  ],
  "Do not plot the two values of one pair as separate points on the axes.",
);
const tables = method(
  "Build or interpret a table using both categories.",
  "A two-way table groups each observation by two characteristics. Every observation belongs in exactly one cell, where its row and column meet.",
  [
    "Read the requested row and column order before filling cells.",
    "Tally observations, or subtract known cells from their group totals. Check that the cells sum to the grand total.",
    "For a conditional percentage, divide by the total of the group named after ‘of’. Compare percentages between groups.",
  ],
  "Counts from unequal groups cannot be compared as though the group sizes were equal.",
);
const vectors = method(
  "Draw and combine vectors while tracking their tails.",
  "A vector describes a move: how far across and how far up. Its magnitude is its length. Its position can change without changing the move.",
  [
    "Locate the tail and read the horizontal and vertical components in that order.",
    "Add matching components for a sum. Subtract by adding the opposite vector. Multiply both components when scaling.",
    "Add the displacement to the tail to locate the tip. Use the square root of the sum of squared components for length.",
  ],
  "A negative scalar reverses direction; it never makes a negative magnitude.",
);
const matrices = method(
  "Use row and column roles to calculate with matrices.",
  "A matrix is a rectangular arrangement of numbers. Rows run across and columns run down. The labels and their order determine what each entry represents.",
  [
    "Read the row and column order and check dimensions.",
    "For addition or subtraction, combine corresponding entries. For scaling, multiply every entry. For a product, pair each row of the first matrix with each column of the second.",
    "Check one entry and preserve the order of the factors. Products in opposite orders may differ.",
  ],
  "The zero matrix is the identity for addition; the identity matrix is the identity for multiplication.",
);
const triangle = method(
  "Connect angle ratios to the sides of a right triangle.",
  "A right triangle has a 90° angle. The side opposite it is the hypotenuse, the longest side. The other two sides are legs.",
  [
    "Choose the reference angle and identify the opposite leg, adjacent leg, and hypotenuse.",
    "Use squared leg lengths to find a missing side. Sine is opposite over hypotenuse, cosine adjacent over hypotenuse, and tangent opposite over adjacent.",
    "Changing the reference angle swaps the two legs' roles. Scaling every side leaves the ratios unchanged.",
  ],
  "Use the angle named in the question; opposite and adjacent are relative to that angle.",
);

export const clauseVariantMethods: Record<string, ProblemMethod> = {
  "generalization-validity": sampling,
  "supported-inference": sampling,
  "estimate-variation": variation,
  "estimate-error": variation,
  "cluster-outlier": plot,
  "construct-scatter": plot,
  "plot-then-describe": plot,
  "intercept-meaning": method(
    "Interpret what a fitted line predicts at zero.",
    "The intercept is the line's predicted output when its input is zero. That prediction is useful only when zero makes sense in the context.",
    [
      "Identify the input and output quantities and their units.",
      "Set the input to zero and read the predicted output.",
      "Check whether zero is possible and reasonably near the observed input range.",
    ],
    "The intercept is a predicted starting value, not the change per unit of input.",
  ),
  "column-association": tables,
  "construct-table": tables,
  "summarize-then-interpret": tables,
  "three-designs": method(
    "Distinguish a survey, an experiment, and a comparison of existing groups.",
    "A survey asks questions to estimate a population characteristic. An experiment assigns a treatment. An observational comparison measures groups that already exist.",
    [
      "Identify whether the researcher assigns the treatment or only observes.",
      "Identify whether chance selects the participants or assigns the treatments.",
      "Random selection supports population estimates. Random assignment supports causal comparisons for the studied participants.",
    ],
    "A survey is observational in the broad sense; choose the most specific design named in the question.",
  ),
  "margin-from-simulation": method(
    "Develop a margin of error from simulated sampling results.",
    "A simulation repeats random sampling from a model population. The spread of its results shows how much random sampling alone can change an estimate.",
    [
      "Start a band at the stated center and expand equally in both directions.",
      "Count the results inside each band until at least 95 of 100 are included.",
      "Use the smallest qualifying half-width as the margin. Subtract it from and add it to the center for the interval.",
    ],
    "The margin is half the band width. A simulated interval does not guarantee the true value or correct selection bias.",
  ),
  "plot-residuals": method(
    "Plot the differences between observations and a fitted line.",
    "A residual is an observed value minus its prediction. Plotting these differences shows whether a line misses in a pattern.",
    [
      "Substitute each horizontal coordinate into the fitted equation.",
      "Subtract that prediction from the observed value and plot the horizontal coordinate with this residual.",
      "Look for a shapeless band around zero or a bend. A bend suggests a straight line misses systematic structure.",
    ],
    "Reversing the subtraction mirrors the residual plot across zero.",
  ),
  "line-by-eye": method(
    "Choose a line that fits a cloud and use it to predict.",
    "A good fitted line runs through the middle of the points. Squared vertical misses measure how far the observations lie from each candidate.",
    [
      "Compare the line's direction with the cloud's overall direction.",
      "Look for small misses on both sides. Compare the sums of squared misses if given.",
      "Use the chosen equation by substituting the requested input.",
    ],
    "Connecting extreme dots or touching only the top of the cloud need not give a good fit.",
  ),
  "read-regression-output": method(
    "Recover signed correlation from regression output.",
    "Correlation measures the direction and strength of a linear relationship. Its square loses the sign; the fitted line's slope supplies that sign.",
    [
      "Take the positive square root of the reported squared correlation.",
      "Use a positive sign for an increasing fitted line and a negative sign for a decreasing one.",
      "Check that the result lies between −1 and 1; values closer to either endpoint indicate a stronger linear relationship.",
    ],
    "The slope is not the correlation, and squared correlation cannot reveal the direction by itself.",
  ),
  "draw-the-arrow": vectors,
  "parallelogram-rule": vectors,
  "sum-vs-sum-of-lengths": vectors,
  "opposite-vector": vectors,
  "scale-the-arrow": vectors,
  "scalar-multiple-direction": vectors,
  "non-perpendicular-resultant": method(
    "Find the length and direction of a sum from magnitudes and angles.",
    "Two directed moves combine into one displacement. Adding their lengths ignores the turn between them.",
    [
      "Convert each magnitude and direction to horizontal and vertical components using cosine and sine.",
      "Add the horizontal components and add the vertical components. Find length from their squared sum.",
      "Find the direction from both component signs. Normalize it to one turn and round only at the end.",
    ],
    "The tail-to-head triangle's interior angle is the supplement of the angle between tail-to-tail vectors.",
  ),
  "three-by-three-tool-inverse": method(
    "Represent three equations as a matrix and use a supplied inverse.",
    "Each equation becomes one row of coefficients. Multiplying by the inverse undoes that coefficient matrix.",
    [
      "Write coefficients in the same variable order in every row; preserve minus signs.",
      "Put the constants in a column in equation order. Multiply the supplied inverse on the left of this column.",
      "Read the resulting variable values in order and substitute them into all three original equations.",
    ],
    "The augmented matrix includes the constants; the coefficient matrix does not.",
  ),
  "zero-and-identity-roles": matrices,
  "compute-both-orders": matrices,
  "noncommutative-laws": matrices,
  "network-and-payoff": matrices,
  "build-from-text": matrices,
  "scale-in-context": matrices,
  difference: matrices,
  "cut-derivation": triangle,
  "explain-from-triangle": triangle,
  "right-angle-reduction": triangle,
  "prove-on-circle": method(
    "Explain why the squares of sine and cosine sum to one.",
    "A point on a circle of radius 1 is one unit from the origin. Its horizontal and vertical coordinates form the legs of a reference right triangle.",
    [
      "Apply the squared-leg rule to the absolute coordinate lengths and hypotenuse 1.",
      "A coordinate and its absolute value have the same square, so the proof works in every quadrant.",
      "When cosine is nonzero, divide every term by its square to obtain the tangent and secant identity.",
    ],
    "A negative coordinate does not make its square negative. Division requires a nonzero denominator.",
  ),
  "prove-sum-formula": method(
    "Derive angle-sum and difference identities from geometry.",
    "Rotating a circle preserves chord lengths. Equal chord lengths let two distance-formula expressions describe the same quantity.",
    [
      "Rotate the two chord endpoints to identify the equal central angles.",
      "Expand both squared distances, then use the unit-circle identity and cancel common terms.",
      "Use even cosine, odd sine, and complementary angles for the related formulas. Divide sine by cosine for tangent where all denominators are nonzero.",
    ],
    "Sine and cosine do not distribute over angle addition or subtraction.",
  ),
  "tangent-sum-exact": method(
    "Find an exact tangent using two familiar angles.",
    "Tangent of a sum depends on both tangents and a denominator correction. Adding just the two tangent values omits that correction.",
    [
      "Express the requested angle as a sum or difference of familiar angles.",
      "Substitute their exact tangent values into the full addition or subtraction formula.",
      "Simplify the fraction, using a conjugate to remove a square root from the denominator. Check the sign using the quadrant.",
    ],
    "The denominator uses a minus for a sum and a plus for a difference.",
  ),
  "applied-context": method(
    "Translate a surveying, force, or navigation problem into a triangle.",
    "A triangle connects the measured paths or forces to the distance being asked for. The same labels must keep referring to the same sides and angles.",
    [
      "Draw and label the triangle. Subtract known angles from 180°, or use the supplement of the direction change at a turn.",
      "With a side and its opposite angle, use the sine law. With two sides and their included angle, use the cosine law.",
      "Evaluate the requested measurement, round once, and check it against the possible side lengths.",
    ],
    "For a resultant, the direction angle between the original vectors is not the interior angle of the tail-to-head triangle.",
  ),
};
