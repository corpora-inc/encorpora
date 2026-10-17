import type { Lesson } from "./lessons.js";
/** Original introductory lessons for specific implemented facets, not whole-standard coverage. */
export const extendedLessons: Lesson[] = [
  {
    id: "division",
    title: "Share equally and count groups",
    summary: "Division reverses multiplication by finding a missing factor.",
    templateIds: ["divide-facts"],
    objectives: [
      "Interpret equal sharing and equal grouping.",
      "Check a quotient with multiplication.",
    ],
    sections: [
      {
        title: "Two meanings",
        paragraphs: [
          "Sharing twenty-four counters equally among six people asks how many each person receives. Making groups of six from twenty-four counters asks how many groups you can make. Both calculations are 24 ÷ 6.",
          "Equal sharing requires equal group sizes. Distribute one counter at a time or arrange an array to keep track.",
        ],
      },
      {
        title: "Use the inverse",
        paragraphs: [
          "Because 6 × 4 = 24, dividing twenty-four by six gives four. Multiplication checks that every object is accounted for.",
          "The practice here uses exact whole-number quotients. Other division situations can produce remainders or fractional answers.",
        ],
      },
    ],
    workedExample: {
      prompt: "What is 24 ÷ 6?",
      steps: [
        "Find the missing factor in 6 × ? = 24.",
        "6 × 4 = 24, so the quotient is 4.",
      ],
      answer: "4",
    },
    pitfalls: [
      "Dividing by six is not the same as subtracting six once.",
      "Keep the number of groups distinct from the size of each group.",
    ],
    parentGuide:
      "Arrange twenty-four counters into six equal rows, then describe both the number of rows and the number in each row.",
  },
  {
    id: "digit-value",
    title: "A digit gets its value from its place",
    summary:
      "Base-ten place value groups ones into tens and tens into hundreds.",
    templateIds: ["place-value-digit"],
    objectives: [
      "Identify ones, tens and hundreds.",
      "Distinguish a digit from the value it represents.",
    ],
    sections: [
      {
        title: "Groups of ten",
        paragraphs: [
          "Ten ones form one ten. Ten tens form one hundred. In 352, the digits name three hundreds, five tens and two ones.",
          "Moving one place left multiplies a digit’s represented value by ten. The symbol 5 can represent five, fifty or five hundred depending on its position.",
        ],
      },
      {
        title: "Expand the number",
        paragraphs: [
          "Write 352 as 300 + 50 + 2. Expanded form makes each digit’s contribution visible.",
          "When asked for the value of the tens digit, answer fifty, not five. Five names the digit; fifty names its value in this number.",
        ],
      },
    ],
    workedExample: {
      prompt: "What value does the tens digit represent in 352?",
      steps: ["The tens digit is 5.", "Five tens equal 5 × 10 = 50."],
      answer: "50",
    },
    pitfalls: [
      "The digit and its value are different quantities.",
      "Read positions from the right for whole numbers.",
    ],
    parentGuide:
      "Use bundles of ten sticks and single sticks. Ask the learner to build fifty-two and explain why the 5 represents fifty.",
  },
  {
    id: "adding-decimals",
    title: "Add matching decimal places",
    summary:
      "Decimal addition combines quantities expressed in the same place-value units.",
    templateIds: ["decimal-addition"],
    objectives: [
      "Align decimal places.",
      "Regroup hundredths into tenths when adding.",
    ],
    sections: [
      {
        title: "Name the units",
        paragraphs: [
          "A hundredth is one of one hundred equal parts of a whole. The number 1.25 is 125 hundredths. The number 0.60 is sixty hundredths.",
          "Trailing zeros after a decimal do not change the amount: 0.6 = 0.60. They can help line up corresponding places.",
        ],
      },
      {
        title: "Add and regroup",
        paragraphs: [
          "Add hundredths to hundredths and tenths to tenths. Ten hundredths regroup into one tenth, just as ten ones regroup into one ten.",
          "Estimate before calculating. Adding 1.25 and 0.60 should give a result between one and two.",
        ],
      },
    ],
    workedExample: {
      prompt: "What is 1.25 + 0.60?",
      steps: [
        "Rename the numbers as 125 hundredths and 60 hundredths.",
        "125 + 60 = 185 hundredths.",
        "185 hundredths = 1.85.",
      ],
      answer: "1.85",
    },
    pitfalls: [
      "Align decimal points rather than the last written digits.",
      "Regrouping does not change the total value.",
    ],
    parentGuide:
      "Use a hundred-square grid as one whole. Represent each addend and combine the shaded amounts.",
  },
  {
    id: "comparing-fractions",
    title: "Compare pieces with the same unit",
    summary:
      "Equivalent fractions let you compare amounts using equal-sized pieces.",
    templateIds: ["compare-fractions"],
    objectives: [
      "Find a common denominator.",
      "Compare fractions without relying only on denominator size.",
    ],
    sections: [
      {
        title: "Use the same whole",
        paragraphs: [
          "Fractions can be compared as numbers using one shared unit whole. For pictures, make sure the wholes have equal size.",
          "A larger denominator means smaller individual pieces, but the numerator also matters. Comparing both numerators and denominators separately is unreliable.",
        ],
      },
      {
        title: "Rename and compare",
        paragraphs: [
          "Rewrite 2/3 and 3/4 in twelfths. They become 8/12 and 9/12. Nine equal pieces are more than eight equal pieces.",
          "For positive denominators, cross products compare the same common-denominator numerators. This is a shortcut for a meaningful renaming step.",
        ],
      },
    ],
    workedExample: {
      prompt: "Which is larger: 2/3 or 3/4?",
      steps: ["2/3 = 8/12 and 3/4 = 9/12.", "9/12 is larger, so choose 3/4."],
      answer: "3/4",
    },
    pitfalls: [
      "A bigger denominator alone does not make a bigger fraction.",
      "Equivalent fractions are equal, not larger or smaller.",
    ],
    parentGuide:
      "Draw two equal-length fraction strips, partition both into twelfths, and compare the shaded lengths.",
  },
  {
    id: "multiplying-fractions",
    title: "A fraction of a fraction",
    summary: "Multiplication can find a part of another amount.",
    templateIds: ["multiply-fractions"],
    objectives: [
      "Interpret a fraction product with an area model.",
      "Multiply and simplify fractions.",
    ],
    sections: [
      {
        title: "Take part of an amount",
        paragraphs: [
          "One half of three fourths means split three fourths into two equal portions and take one. The result is three eighths.",
          "On one rectangle, mark fourths in one direction and halves in the other. The overlap covers three of eight equal small regions.",
        ],
      },
      {
        title: "Multiply the counts",
        paragraphs: [
          "Multiply numerators to count selected overlapping regions. Multiply denominators to count all equal regions in the whole.",
          "Multiplying positive proper fractions makes a smaller positive amount than either factor. That is sensible because you are taking only part of an amount.",
        ],
      },
    ],
    workedExample: {
      prompt: "What is 1/2 × 3/4?",
      steps: [
        "Multiply numerators: 1 × 3 = 3.",
        "Multiply denominators: 2 × 4 = 8.",
        "The product is 3/8.",
      ],
      answer: "3/8",
    },
    pitfalls: [
      "Multiplication does not always make a number larger.",
      "A common denominator is not required before multiplying.",
    ],
    parentGuide:
      "Use a rectangular grid to show one half in one direction and three fourths in the other; discuss the overlap.",
  },
  {
    id: "dividing-fractions",
    title: "How many fractional groups fit?",
    summary:
      "Dividing by a fraction asks how many groups of that size fit in an amount.",
    templateIds: ["divide-fractions"],
    objectives: [
      "Interpret division by a fraction.",
      "Use the reciprocal of a nonzero divisor.",
    ],
    sections: [
      {
        title: "Measure in smaller groups",
        paragraphs: [
          "Three fourths divided by one eighth asks how many eighth-sized pieces fit in three fourths. Since three fourths is six eighths, the answer is six.",
          "A quotient can exceed the dividend when groups are smaller than one. The question counts groups, not the amount in one group.",
        ],
      },
      {
        title: "Why the reciprocal works",
        paragraphs: [
          "Multiplying by the reciprocal of the divisor changes that divisor to one. This measures the dividend in units of the divisor.",
          "For a/b divided by c/d, multiply a/b by d/c. The divisor must be nonzero, so c cannot be zero.",
        ],
      },
    ],
    workedExample: {
      prompt: "What is 3/4 ÷ 1/8?",
      steps: [
        "Rename 3/4 as 6/8.",
        "Six groups of 1/8 fit in 6/8.",
        "Equivalently, 3/4 × 8/1 = 6.",
      ],
      answer: "6",
    },
    pitfalls: [
      "Take the reciprocal of the divisor, not the dividend.",
      "Dividing by zero is undefined.",
    ],
    parentGuide:
      "Use a strip divided into eighths, shade six parts, and count how many one-eighth groups are shaded.",
  },
  {
    id: "equivalent-ratios",
    title: "Scale both parts of a ratio",
    summary:
      "Equivalent ratios preserve a relationship while changing the overall amount.",
    templateIds: ["ratio-missing"],
    objectives: [
      "Identify a ratio’s two quantities.",
      "Apply the same scale factor to both quantities.",
    ],
    sections: [
      {
        title: "Keep the relationship",
        paragraphs: [
          "A mix with two cups of blue for every three cups of white has blue-to-white ratio 2:3. Doubling both amounts makes 4:6, with the same color proportions.",
          "Order matters: blue-to-white and white-to-blue describe inverse relationships. Label the quantities before calculating.",
        ],
      },
      {
        title: "Find the scale factor",
        paragraphs: [
          "If the white amount increases from three to twelve, it is multiplied by four. Multiply the blue amount by four as well.",
          "Adding the same number to both quantities usually changes the ratio. Scaling multiplies both quantities by the same positive factor.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A mix uses 2 cups blue per 3 cups white. How much blue goes with 12 cups white?",
      steps: [
        "12 ÷ 3 = 4, so scale the recipe by four.",
        "2 × 4 = 8 cups blue.",
      ],
      answer: "8",
    },
    pitfalls: [
      "Match each quantity with its correct label.",
      "Additive changes do not generally preserve ratios.",
    ],
    parentGuide:
      "Build several identical groups of two blue counters and three white counters, then count totals.",
  },
  {
    id: "percent-quantity",
    title: "Percent means per hundred",
    summary:
      "A percentage describes a fraction whose denominator is one hundred.",
    templateIds: ["percent-of"],
    objectives: [
      "Convert a percent to a fraction.",
      "Calculate a percentage of a stated whole.",
    ],
    sections: [
      {
        title: "Identify the whole",
        paragraphs: [
          "Twenty-five percent means twenty-five out of each hundred, or 25/100 = 1/4. A percent needs a whole to determine an actual quantity.",
          "Twenty-five percent of eighty and twenty-five percent of forty have different amounts because the wholes differ.",
        ],
      },
      {
        title: "Multiply by the fraction",
        paragraphs: [
          "To find p percent of a quantity, multiply the quantity by p/100. Simplifying first can make the calculation easier.",
          "For a positive whole and a percentage between zero and one hundred, the result lies between zero and the whole. Use that as a reasonableness check.",
        ],
      },
    ],
    workedExample: {
      prompt: "What is 25% of 80?",
      steps: ["25% = 25/100 = 1/4.", "One fourth of 80 is 80 ÷ 4 = 20."],
      answer: "20",
    },
    pitfalls: [
      "25% is 0.25, not 25, as a multiplier.",
      "Always identify which amount is the whole.",
    ],
    parentGuide:
      "Divide eighty objects or a drawn bar into four equal groups and connect one group with twenty-five percent.",
  },
  {
    id: "signed-addition",
    title: "Combine positive and negative changes",
    summary: "Signed addition combines quantities with direction.",
    templateIds: ["integer-addition"],
    objectives: [
      "Model signed addition on a number line.",
      "Use opposite pairs to simplify a sum.",
    ],
    sections: [
      {
        title: "Direction matters",
        paragraphs: [
          "Positive numbers lie to the right of zero and negative numbers to the left. Adding a positive change moves right; adding a negative change moves left.",
          "Starting at negative seven and adding twelve means move twelve steps right. Seven steps reach zero and five more reach positive five.",
        ],
      },
      {
        title: "Cancel opposite pairs",
        paragraphs: [
          "A positive unit and a negative unit sum to zero. Pairing opposites leaves whichever sign has extra units.",
          "When both addends have the same sign, combine their magnitudes and keep that sign. With different signs, compare magnitudes to determine what remains.",
        ],
      },
    ],
    workedExample: {
      prompt: "What is (−7) + 12?",
      steps: [
        "Seven of the positive units cancel the seven negative units.",
        "Five positive units remain.",
      ],
      answer: "5",
    },
    pitfalls: [
      "A negative sign belongs to its number.",
      "Adding a negative number moves left, even though the operation is addition.",
    ],
    parentGuide:
      "Use two colors for positive and negative counters and remove opposite pairs to model the sum.",
  },
  {
    id: "whole-number-powers",
    title: "Powers count repeated factors",
    summary: "An exponent tells how many copies of a base are multiplied.",
    templateIds: ["integer-power"],
    objectives: [
      "Expand a positive integer power.",
      "Explain the zero-exponent rule for a nonzero base.",
    ],
    sections: [
      {
        title: "Factors, not repeated addition",
        paragraphs: [
          "Three to the fourth power means 3 × 3 × 3 × 3. The exponent counts four factors of three.",
          "Compute the products step by step: nine, twenty-seven, eighty-one. Multiplying the base by the exponent gives a different expression.",
        ],
      },
      {
        title: "One step down divides by the base",
        paragraphs: [
          "Compare 3³ = 27, 3² = 9 and 3¹ = 3. Reducing the exponent by one divides the value by three.",
          "Continuing the pattern gives 3⁰ = 1. Every nonzero base to power zero is one; these exercises avoid zero as a base.",
        ],
      },
    ],
    workedExample: {
      prompt: "What is 3 raised to the power 4?",
      steps: ["Write four factors: 3 × 3 × 3 × 3.", "Multiply: 9 × 9 = 81."],
      answer: "81",
    },
    pitfalls: [
      "3⁴ is not 3 × 4.",
      "A nonzero number to power zero equals one, not zero.",
    ],
    parentGuide:
      "Write a descending table of powers and ask what operation connects each neighboring pair.",
  },
  {
    id: "slope-two-points",
    title: "Slope measures change per step",
    summary: "Slope compares vertical change with horizontal change on a line.",
    templateIds: ["line-slope"],
    objectives: [
      "Compute corresponding coordinate changes.",
      "Interpret positive, negative and zero slope.",
    ],
    sections: [
      {
        title: "Use a consistent direction",
        paragraphs: [
          "For points (x₁,y₁) and (x₂,y₂), slope is (y₂ − y₁)/(x₂ − x₁). Subtract coordinates in the same point order in both places.",
          "A slope of 3/2 means y increases by three for every increase of two in x. A negative slope means y falls as x increases.",
        ],
      },
      {
        title: "Check the denominator",
        paragraphs: [
          "A horizontal line has zero change in y and therefore slope zero. A vertical line has zero change in x, so its slope is undefined.",
          "The practice uses distinct x-coordinates, which guarantees a numeric slope. Fractions are valid and need not be rounded.",
        ],
      },
    ],
    workedExample: {
      prompt: "Find the slope through (1, 2) and (5, 8).",
      steps: [
        "Change in y = 8 − 2 = 6.",
        "Change in x = 5 − 1 = 4.",
        "Slope = 6/4 = 3/2.",
      ],
      answer: "3/2",
    },
    pitfalls: [
      "Do not reverse point order in only one difference.",
      "Slope is change in y divided by change in x, not the reverse.",
    ],
    parentGuide:
      "Plot the two points, draw a horizontal then vertical path between them, and label each change.",
  },
  {
    id: "systems-elimination",
    title: "Make two equations work together",
    summary: "A solution of a system must satisfy both equations at once.",
    templateIds: ["linear-system-x"],
    objectives: [
      "Eliminate one variable with equivalent equations.",
      "Check a solution in both original equations.",
    ],
    sections: [
      {
        title: "One shared solution",
        paragraphs: [
          "Each linear equation describes pairs of x and y values. Solving a system means finding a pair common to both equations.",
          "Multiplying an entire equation by a nonzero number preserves its solutions. Use this to make one variable’s coefficients match.",
        ],
      },
      {
        title: "Subtract to eliminate",
        paragraphs: [
          "When the y coefficients agree, subtract one whole equation from the other. The y terms cancel, leaving an equation in x.",
          "After finding x, substitute it into an original equation to find y, then check both. Some systems have no solution or infinitely many; this practice uses systems with one solution.",
        ],
      },
    ],
    workedExample: {
      prompt: "Find x if 2x + y = 7 and x + y = 5.",
      steps: [
        "Subtract the second equation from the first: x = 2.",
        "Substitute: 2 + y = 5, so y = 3.",
        "Check: 2(2) + 3 = 7 and 2 + 3 = 5.",
      ],
      answer: "2",
    },
    pitfalls: [
      "Subtract every term, including the right-hand side.",
      "A pair that satisfies only one equation is not a system solution.",
    ],
    parentGuide:
      "Write the equations on aligned rows and mark the matching y terms before subtracting.",
  },
  {
    id: "equally-likely-probability",
    title: "Count favorable outcomes",
    summary:
      "For equally likely outcomes, probability is the favorable count divided by the total count.",
    templateIds: ["simple-probability"],
    objectives: [
      "Identify the event and the sample space.",
      "Express a probability as an exact fraction.",
    ],
    sections: [
      {
        title: "Count all possible objects",
        paragraphs: [
          "A bag with three red and five blue counters contains eight counters. If every counter is equally likely to be drawn, each contributes one equally likely outcome.",
          "Drawing red has three favorable outcomes. Divide three by all eight outcomes, not just by the five blue counters.",
        ],
      },
      {
        title: "Interpret the probability",
        paragraphs: [
          "A probability lies between zero and one. Zero describes an impossible event and one describes a certain event.",
          "A probability of 3/8 does not promise exactly three red results in every eight draws. It describes the chance on each draw under the stated conditions.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A bag contains 3 red and 5 blue equally likely counters. What is the probability of red?",
      steps: [
        "There are 3 + 5 = 8 counters in total.",
        "Three are favorable, giving probability 3/8.",
      ],
      answer: "3/8",
    },
    pitfalls: [
      "The denominator includes favorable and unfavorable outcomes.",
      "Counting outcomes works this way only when the outcomes are equally likely.",
    ],
    parentGuide:
      "Predict the chance, then perform repeated draws with replacement. Discuss why short runs can differ from the predicted proportion.",
  },
  {
    id: "arithmetic-sequence-terms",
    title: "Repeated addition in a sequence",
    summary:
      "An arithmetic sequence adds the same difference between consecutive terms.",
    templateIds: ["arithmetic-term"],
    objectives: [
      "Generate terms with a common difference.",
      "Use the correct number of steps from term one.",
    ],
    sections: [
      {
        title: "Find the fixed change",
        paragraphs: [
          "The sequence 4, 7, 10, 13 adds three each time. Its first term is four and its common difference is three.",
          "A negative common difference produces a decreasing sequence. A zero difference repeats the same number.",
        ],
      },
      {
        title: "Jump to a later term",
        paragraphs: [
          "Term n is a₁ + (n − 1)d when the first term is numbered one. There is one fewer jump than the term number.",
          "For the fifth term, begin at the first value and make four jumps. This also explains why multiplying the first term by the term number is generally wrong.",
        ],
      },
    ],
    workedExample: {
      prompt: "First term 4, common difference 3: what is term 5?",
      steps: [
        "Make four jumps of three after the first term.",
        "4 + 4 × 3 = 16.",
      ],
      answer: "16",
    },
    pitfalls: [
      "Use n − 1 jumps when the first term is term one.",
      "Do not confuse a common difference with a common ratio.",
    ],
    parentGuide:
      "Write term numbers above their values and draw a labeled arrow for each addition step.",
  },
  {
    id: "function-input-output",
    title: "Substitute an input into a function",
    summary: "A function rule assigns an output to each allowed input.",
    templateIds: ["function-evaluation"],
    objectives: [
      "Interpret function notation.",
      "Substitute consistently and follow operation order.",
    ],
    sections: [
      {
        title: "The input belongs everywhere",
        paragraphs: [
          "The notation f(−2) asks for the output of f when the input is negative two. Replace every x in the rule with (−2).",
          "Parentheses around negative inputs keep the sign attached to the number, especially when raising it to a power.",
        ],
      },
      {
        title: "Evaluate in order",
        paragraphs: [
          "Calculate powers before multiplication, then combine terms. For a quadratic, the squared input and the linear input can contribute terms with different signs.",
          "Function notation does not mean f multiplied by the input. It names a rule and supplies that rule’s input.",
        ],
      },
    ],
    workedExample: {
      prompt: "If f(x) = 2x² + 3x + 1, find f(−2).",
      steps: [
        "Substitute: 2(−2)² + 3(−2) + 1.",
        "The squared term is 2 × 4 = 8.",
        "8 − 6 + 1 = 3.",
      ],
      answer: "3",
    },
    pitfalls: [
      "Replace every occurrence of x with the same input.",
      "(−2)² is positive four.",
    ],
    parentGuide:
      "Ask the learner to write the full substituted expression before calculating; check signs separately from arithmetic.",
  },
  {
    id: "unit-cost",
    title: "Find one, then scale",
    summary:
      "A constant unit rate connects quantities in a proportional relationship.",
    templateIds: ["unit-price"],
    objectives: [
      "Calculate a price per item.",
      "Scale a unit price to a new quantity.",
    ],
    sections: [
      {
        title: "Divide to find the unit",
        paragraphs: [
          "If four identical notebooks cost twelve dollars, each costs twelve divided by four, or three dollars. Dollars per notebook is the unit rate.",
          "The constant-rate assumption matters. Quantity discounts or fixed fees would require a different model.",
        ],
      },
      {
        title: "Multiply to find the total",
        paragraphs: [
          "At three dollars per notebook, seven notebooks cost seven times three dollars. The unit rate connects any allowed number of notebooks to its total price.",
          "Keep units visible: dollars per notebook multiplied by notebooks gives dollars. This helps distinguish division from multiplication.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "Four notebooks cost 12 dollars. What do seven cost at the same unit price?",
      steps: ["12 ÷ 4 = 3 dollars per notebook.", "7 × 3 = 21 dollars."],
      answer: "21",
    },
    pitfalls: [
      "Do not multiply by the original total price as though it were the unit price.",
      "The problem assumes the same price per item.",
    ],
    parentGuide:
      "Create a table of item counts and prices. Ask what stays constant when the table grows.",
  },
  {
    id: "multiplying-decimals",
    title: "Multiply decimal-sized parts",
    summary:
      "Decimal multiplication combines whole-number products with place-value units.",
    templateIds: ["decimal-multiplication"],
    objectives: [
      "Interpret tenths times tenths as hundredths.",
      "Estimate the size of a decimal product.",
    ],
    sections: [
      {
        title: "Use fractions to see the units",
        paragraphs: [
          "The number 1.2 is twelve tenths and 0.3 is three tenths. Their product is thirty-six hundredths because (12/10)(3/10) = 36/100.",
          "Multiplying the integer counts gives thirty-six. The denominators determine that the result is 0.36, not 3.6 or 36.",
        ],
      },
      {
        title: "Estimate before placing the decimal",
        paragraphs: [
          "Three tenths of 1.2 is less than 1.2 and close to three tenths. This estimate supports a product of 0.36.",
          "A factor between zero and one reduces a positive amount. Multiplication need not increase it.",
        ],
      },
    ],
    workedExample: {
      prompt: "What is 1.2 × 0.3?",
      steps: [
        "Write (12/10) × (3/10).",
        "Multiply to get 36/100.",
        "36/100 = 0.36.",
      ],
      answer: "0.36",
    },
    pitfalls: [
      "Explain decimal placement using place value rather than guessing.",
      "A decimal product can be smaller than both whole-number counts used to compute it.",
    ],
    parentGuide:
      "Use a hundredths grid or a rectangle with decimal side lengths to connect the product to area.",
  },
  {
    id: "expression-order",
    title: "Read the structure of an expression",
    summary:
      "Grouping and operation order determine which calculations happen first.",
    templateIds: ["operation-order"],
    objectives: [
      "Evaluate grouped quantities first.",
      "Complete multiplication before addition outside the group.",
    ],
    sections: [
      {
        title: "Parentheses name one quantity",
        paragraphs: [
          "In 5 + (2 + 3) × 4, the group (2 + 3) is one quantity: five. Replace the group with its value before proceeding.",
          "The expression becomes 5 + 5 × 4. The initial five is outside the multiplied group.",
        ],
      },
      {
        title: "Follow the remaining structure",
        paragraphs: [
          "Multiplication takes precedence over addition, so calculate 5 × 4 = 20 and then add the initial five.",
          "Operations of equal precedence are evaluated left to right. These examples focus on parentheses, multiplication and addition.",
        ],
      },
    ],
    workedExample: {
      prompt: "Evaluate 5 + (2 + 3) × 4.",
      steps: [
        "Parentheses: 2 + 3 = 5.",
        "Multiply: 5 × 4 = 20.",
        "Add: 5 + 20 = 25.",
      ],
      answer: "25",
    },
    pitfalls: [
      "Do not simply calculate every operation from left to right.",
      "Only terms inside the parentheses belong to that group.",
    ],
    parentGuide:
      "Have the learner rewrite one complete line after each step, carrying every unchanged term along.",
  },
];
