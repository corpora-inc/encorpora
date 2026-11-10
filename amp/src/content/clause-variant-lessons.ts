import type { ProblemMethod } from "./problem-lessons";

const method = (
  goal: string,
  intuition: string,
  steps: string[],
  watch: string,
): ProblemMethod => ({ goal, intuition, method: steps, watch });
const place = method(
  "Read the number by the value of each digit's place.",
  "Ten ones make one ten. Ten tens make one hundred. A digit counts groups of the size named by its place.",
  [
    "Start with the largest place and name the number of groups there.",
    "Multiply each digit by its place value. Add those values to check the whole number.",
  ],
  "A zero holds an empty place. Keep the other digits in their own places.",
);
const compare = method(
  "Compare two values and choose the place-value reason.",
  "Compare equal-sized units. One ten is larger than any number of single ones from zero through nine.",
  [
    "Align the places, then start with the largest place.",
    "If those digits match, move right. The first different place decides. If every place matches, choose equals.",
  ],
  "Compare the values of the places, not the count of written digits or the ones first.",
);
const decimalCompare = method(
  "Compare decimals that refer to the same whole.",
  "A tenth is one of ten equal parts of a whole. A hundredth is one of a hundred. Ten hundredths make one tenth.",
  [
    "Check that the decimals describe the same whole or the same unit.",
    "Write equal places underneath one another, adding zeros at the end if helpful. Compare the first place that differs.",
  ],
  "A zero at the end does not change a decimal. More digits do not necessarily mean more.",
);
const motion = method(
  "Apply each slide, flip or turn to every vertex.",
  "A vertex is a corner. A translation slides every corner by the same amount. A reflection flips it over a line. A rotation turns it around a fixed center.",
  [
    "For a turn, subtract the center coordinates, turn the displacement, then add the center back. For a reflection, keep equal distances on opposite sides of the mirror.",
    "Apply steps in their stated order. Check every corresponding corner, not just one.",
  ],
  "Changing the order or using the origin instead of the named center can give a different image.",
);
const similar = method(
  "Decide whether one scale factor and rigid motions map the triangles.",
  "Similar figures have the same shape. One scale factor multiplies every corresponding length, while every corresponding angle stays equal. A rigid motion is a slide, flip or turn that preserves size and shape.",
  [
    "Divide each image length by its corresponding original length. Check that the ratios agree.",
    "Dilate by that factor, then apply the named rigid motion.",
    "Verify all three corners. Corresponding angles must stay equal.",
  ],
  "Angles do not scale. One matching coordinate or one matching side is not enough.",
);
const algorithm = method(
  "Complete the written decimal algorithm and check its result.",
  "The places name different-sized units. In multiplication, each partial product accounts for one digit of a factor. In division, scaling both numbers equally leaves the quotient unchanged.",
  [
    "Align equal places for addition and subtraction. For multiplication, shift the tens partial product one place left.",
    "Count all written decimal places for a product. For division, make the divisor whole by multiplying both numbers by the same power of ten.",
    "Check with estimation or the inverse operation. Check every entered step independently.",
  ],
  "A shifted partial product includes its place-value zero. Count decimal places in both factors.",
);
const proof = method(
  "Justify each step from the givens and earlier proved facts.",
  "A proof connects the information you are given to the result you want. Each reason must justify exactly the statement beside it.",
  [
    "Mark shared sides and angles, and identify which facts are given.",
    "Use a congruence or similarity criterion only after its needed sides and angles are known.",
    "Use the resulting corresponding parts to reach the requested relationship.",
  ],
  "A theorem and its converse have opposite directions. Do not use the desired conclusion as a premise.",
);

const methods: Record<string, ProblemMethod> = {
  "teen-as-ten-and-ones": place,
  "whole-tens-as-tens": place,
  "round-hundred-as-hundreds": place,
  "expanded-form-full": place,
  "teen-equation-record": place,
  "teen-decompose-picture": place,
  "number-names": method(
    "Write a three-digit number in words or as a numeral.",
    "The hundreds digit counts groups of one hundred. The final two digits name the remaining tens and ones. In 407, the zero holds the tens place.",
    [
      "Read the hundreds digit with the word hundred.",
      "Read the remaining two digits together. In the reverse direction, write a zero for an empty place.",
      "Check by adding the hundreds value to the remaining value.",
    ],
    "Thirteen and thirty name different amounts. Do not write the words' parts side by side as extra digits.",
  ),
  "symbol-and-place-value-reason": compare,
  "symbol-and-place-value-reason-3d": compare,
  "compare-with-grid-justification": decimalCompare,
  "thousandths-symbol-blank": decimalCompare,
  "same-whole-validity": decimalCompare,
  "ten-more-less-with-reason": method(
    "Find ten more or ten less and explain the change.",
    "Adding ten adds one whole group of ten. Taking ten away removes one such group. The extra ones stay the same.",
    [
      "Name the tens and ones in the starting number.",
      "Change the tens count by one in the required direction. Keep the ones and write the resulting number.",
    ],
    "Change the tens, not both digits or just the ones.",
  ),
  "tens-model-to-equation": method(
    "Match removing rods of ten with a subtraction equation.",
    "Each rod is ten ones. Removing two rods therefore removes twenty ones.",
    [
      "Count how many tens are present and how many are removed.",
      "Subtract the counts of tens, then multiply by ten to express the answer in ones.",
    ],
    "Keep the unit: three tens means thirty, not three ones.",
  ),
  "count-full-range": method(
    "Continue a counting sequence by ones.",
    "Each next number is one greater. Ten ones make a new ten, and ten tens make a new hundred.",
    [
      "Look at the last number shown and add one.",
      "Regroup ten ones or ten tens when needed, keeping every other place.",
    ],
    "After ninety-nine comes one hundred. A new ten does not always make a new hundred.",
  ),
  "mental-boundaries": method(
    "Add or subtract ten or one hundred by place value.",
    "Ten is one group of ten. One hundred is ten such groups. Changing that group leaves the smaller units in place.",
    [
      "Read the operation and the size of the group being changed.",
      "Change the appropriate place and regroup across a hundred if needed.",
    ],
    "Check the direction and whether the change is ten or one hundred.",
  ),
  "mass-volume-story": method(
    "Convert measurements to one unit, then calculate.",
    "A measurement pairs a number with a unit. You can add or subtract measurements directly only when their units match.",
    [
      "Use the stated equivalence to change larger units into smaller units. Add any remaining smaller units.",
      "Choose the operation the story requires. Calculate with the common unit and check that the answer fits the situation.",
    ],
    "Convert before dividing or combining measurements.",
  ),
  "plot-measure-total": method(
    "Find a measurement and choose its point on a scaled number line.",
    "A denominator, the bottom number of a fraction, tells how many equal parts make one whole. Each tick on the supplied scale counts one such part.",
    [
      "Use the same part size when adding or subtracting. Multiply the number of parts for repeated equal amounts.",
      "Count the resulting parts from zero. Check the labeled wholes before selecting a plot.",
    ],
    "Adding the numbers of parts does not add their denominators.",
  ),
  "length-as-decimal-meters": method(
    "Write a length in meters or centimeters.",
    "One meter contains one hundred centimeters. One centimeter is one hundredth of a meter.",
    [
      "Divide centimeters by one hundred to write meters.",
      "Multiply meters by one hundred to write centimeters. Check the place held by any zero.",
    ],
    "Seven centimeters is 0.07 meters, not 0.7 meters.",
  ),
  "power-of-ten-pattern-reason": method(
    "Multiply or divide by a power of ten and explain the digit shift.",
    "Each factor of ten changes every digit's value tenfold. Multiplication moves digits toward larger places; division moves them toward smaller places.",
    [
      "Read the exponent as the count of factors of ten.",
      "Move each digit that many places left for multiplication or right for division. Fill empty places with zeros.",
    ],
    "Appending zeros to a decimal does not multiply its value.",
  ),
  "decimal-division-hundredths": algorithm,
  "algorithm-steps": algorithm,
  "model-to-written-method": method(
    "Connect a decimal model to a written calculation.",
    "A decimal point separates whole units from tenths. A model shows which units are being combined, multiplied or divided.",
    [
      "For addition and subtraction, align the decimal points so equal units meet.",
      "For multiplication, tenths times tenths are hundredths. For division, find the missing side of the area model.",
      "Choose the equation and the reason that both match the model.",
    ],
    "Aligning the final written digits can add tenths to hundredths.",
  ),
  "two-step-sequence": motion,
  "geometry-draw": motion,
  "translation-image": motion,
  "congruent-or-not": {
    ...motion,
    goal: "Decide whether a rigid motion can map two triangles.",
    watch:
      "Congruent triangles have all corresponding lengths equal. A dilation with a factor other than one changes their size.",
  },
  "grade-8-origin": similar,
  "what-similarity-means": similar,
  "function-notation": method(
    "Apply a coordinate rule, undo it, and classify the transformation.",
    "A function takes an input and gives an output. A coordinate transformation takes a point and gives another point. To recover an input, undo the operations in the rule.",
    [
      "Substitute both coordinates of the given point into the rule.",
      "For a given output, undo the changes to recover the input. Substitute it again to check.",
      "Decide whether the rule preserves every distance. Dilations and stretches with factors other than one do not.",
    ],
    "Applying the rule forward to the output usually does not recover the input.",
  ),
  "verify-on-coordinates": method(
    "Measure the effect of a dilation about a given center.",
    "A dilation scales each displacement from its center. Its scale factor multiplies lengths. It keeps slopes of lines that do not pass through the center and leaves lines through the center on themselves.",
    [
      "Subtract the center coordinates from each point. Multiply that displacement by the scale factor, then add the center back.",
      "Divide the new length by the old length. Compare slopes using changes in coordinates.",
      "Check that the image of the point on the center's line stays on that line.",
    ],
    "Multiplying absolute coordinates would wrongly treat the origin as the center. A vertical line has undefined slope.",
  ),
  "converse-parallel": proof,
  "pythagorean-by-similarity": {
    ...proof,
    watch:
      "The Pythagorean theorem is the result being proved, so it cannot be used as a reason. Use similarity and side proportions.",
  },
  "cpctc-relationship": {
    ...proof,
    watch:
      "CPCTC gives equal corresponding parts only after the triangles have been proved congruent.",
  },
};
export const clauseMethod = (family: string | undefined) =>
  family ? methods[family] : undefined;
export const clausePrinciple = (family: string | undefined) =>
  clauseMethod(family)?.intuition;
