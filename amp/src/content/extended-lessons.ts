import type { Lesson } from "./lessons.js";
/** Original introductory lessons for specific implemented facets, not whole-standard coverage. */
export const extendedLessons: Lesson[] = [
  {
    id: "digit-value",
    title: "A digit gets its value from its place",
    summary:
      "Ten ones make a ten, and ten tens make a hundred; each place holds a different-sized bundle.",
    templateIds: ["place-value-digit"],
    objectives: [
      "Identify ones, tens and hundreds.",
      "Distinguish a digit from the value it represents.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Build larger bundles",
        paragraphs: [
          "Ten ones make one ten, and ten tens make one hundred.",
          "In 352, the three counts hundreds, the five counts tens, and the two counts ones. Each digit gets its value from its place.",
        ],
      },
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
    closingSections: [
      {
        stage: "formal",
        title: "Base-ten expansion",
        paragraphs: [
          "A whole number is the sum of each digit times its place value. Every place is ten times the place to its right, so regrouping ten lower units as one higher unit preserves the number.",
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
      "Add tenths to tenths and hundredths to hundredths, just as you add ones to ones.",
    templateIds: ["decimal-addition"],
    objectives: [
      "Align decimal places.",
      "Regroup hundredths into tenths when adding.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Join matching parts",
        paragraphs: [
          "One and two tenths plus three tenths is one and five tenths.",
          "Adding tenths to tenths works just like adding ones to ones. Keep the decimal places lined up so the parts you join are the same size.",
        ],
      },
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
    closingSections: [
      {
        stage: "formal",
        title: "Like decimal units",
        paragraphs: [
          "Adding or subtracting decimals combines counts of the same place-value units. Align decimal points to align ones, tenths, hundredths, and so on; zeros may be appended to the right of a decimal's final fractional digit without changing its value.",
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
      "Rename fractions with the same denominator, the bottom number that sets piece size. Then compare how many pieces each has.",
    templateIds: ["compare-fractions"],
    objectives: [
      "Find a common denominator.",
      "Compare fractions without relying only on denominator size.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Use pieces of one size",
        paragraphs: [
          "One half and three fourths can be compared by cutting the half into fourths.",
          "Then two fourths are beside three fourths, and the larger amount is clear. The whole must be the same size for both.",
        ],
      },
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
    closingSections: [
      {
        stage: "formal",
        title: "Compare a common whole",
        paragraphs: [
          "For fractions of the same-sized whole with positive denominators, equivalent fractions can rename both amounts with a common denominator. Then the larger numerator names the larger amount because the pieces have equal size.",
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
    summary: "Multiplying by a fraction can find part of another amount.",
    templateIds: ["multiply-fractions"],
    objectives: [
      "Interpret a fraction product with an area model.",
      "Multiply and simplify fractions.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Take a part of a part",
        paragraphs: [
          "To find one half of three fourths, divide those three fourths into two equal shares and take one share.",
          "A picture of a whole rectangle cut both ways shows three of eight small parts selected.",
          "In a fraction, the top number counts the parts (numerator) and the bottom number names their size (denominator).",
        ],
      },
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
    closingSections: [
      {
        stage: "formal",
        title: "A fraction of a fraction",
        paragraphs: [
          "For fractions with nonzero denominators, taking $a/b$ of $c/d$ gives $ac/bd$. The product counts selected small parts after each of the original $d$ parts is split into $b$ equal parts.",
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
      "Dividing by a fraction asks how many groups of that size fit. Multiply by the divisor's reciprocal, made by swapping its top and bottom numbers.",
    templateIds: ["divide-fractions"],
    objectives: [
      "Interpret division by a fraction.",
      "Use the reciprocal of a nonzero divisor.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Count how many small groups fit",
        paragraphs: [
          "Three fourths contains six eighths.",
          "That means six groups of one eighth fit into three fourths. The answer can be larger than the amount you began with because the groups are smaller than one whole.",
        ],
      },
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
          "For a/b divided by c/d, multiply a/b by d/c. The divisor must be nonzero, so $c$ cannot be zero.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Count groups of a fractional size",
        paragraphs: [
          "For a fraction $a/b$ and a nonzero fraction $c/d$ with nonzero denominators, $(a/b)\\div(c/d)=(a/b)(d/c)$. Multiplying by the reciprocal counts how many groups of size $c/d$ fit into $a/b$.",
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
      "A bigger batch can keep the same mix when both amounts grow together.",
    templateIds: ["ratio-missing"],
    objectives: [
      "Identify a ratio’s two quantities.",
      "Apply the same scale factor to both quantities.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Keep the mix the same",
        paragraphs: [
          "A mix with two cups of blue paint for every three cups of white paint keeps the same color if you double both amounts.",
          "Four to six is a bigger batch with the same relationship.",
        ],
      },
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
    closingSections: [
      {
        stage: "formal",
        title: "Scale both quantities",
        paragraphs: [
          "Multiplying both entries of a ratio by the same positive factor preserves the comparison. For nonzero second entries, the quotient of the first entry by the second stays constant across equivalent ratios.",
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
      "A percent counts parts out of one hundred equal parts of a chosen whole.",
    templateIds: ["percent-of"],
    objectives: [
      "Convert a percent to a fraction.",
      "Calculate a percentage of a stated whole.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Find the whole behind the percent",
        paragraphs: [
          "Twenty-five percent means twenty-five parts out of one hundred equal parts of a whole.",
          "One fourth of a small cake and one fourth of a large cake are different amounts, so name the whole before finding a percent of it.",
        ],
      },
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
          "To find $p$ percent of a quantity, multiply the quantity by p/100. Simplifying first can make the calculation easier.",
          "For a positive whole and a percentage between zero and one hundred, the result lies between zero and the whole. Use that as a reasonableness check.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Percent means per hundred",
        paragraphs: [
          "A percent $p$ of a whole $W$ is $(p/100)W$. The numerical part changes when the whole changes, even if the percent stays the same; identify the whole before calculating.",
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
    summary:
      "A number line is a line with evenly spaced marks for numbers. Numbers to the right of 0 are positive, meaning greater than 0. Numbers to the left are negative, meaning less than 0, and are written with a minus sign, like $-7$. Adding a positive number moves right, and adding a negative number moves left. Moves of the same length in opposite directions cancel, meaning they undo each other.",
    templateIds: ["integer-addition"],
    objectives: [
      "Show a sum of positive and negative numbers as moves on a number line.",
      "Cancel opposite pairs to find a sum, and explain why the answer has its sign.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Changes can point in opposite directions",
        paragraphs: [
          "A number line is a straight line with evenly spaced marks, where each step from one mark to the next is a change of 1. Zero is marked on it. Numbers to the right of 0 are positive, meaning greater than 0. Numbers to the left are negative, meaning less than 0. The number $-2$ is read negative two, and it sits 2 steps left of 0. Whether a number is positive or negative is called its sign. Zero is neither.",
          "Think of each number you add as a move. Adding 3 means move 3 steps right. Adding $-2$ means move 2 steps left. Start at 0 and make both moves: 3 steps right, then 2 steps back. You stop 1 step right of 0, so $3 + (-2) = 1$.",
          "The two moves partly cancel. The 2 left steps undo 2 of the right steps, and 1 right step is left over. The counting numbers 0, 1, 2, 3 and so on are called whole numbers. The whole numbers and their negatives, such as $-3$, 0 and 5, are called integers.",
        ],
      },
      {
        title: "Direction matters",
        paragraphs: [
          "Adding a positive number moves right. Adding a negative number moves left, even though the sign between the numbers is a plus. The minus sign belongs to the number, and it tells you which way to move.",
          "Find $(-7) + 12$. Start at $-7$, which is 7 steps left of 0. Adding 12 means 12 steps right. The first 7 steps bring you back to 0. The other 5 steps take you to 5. So $(-7) + 12 = 5$.",
        ],
      },
      {
        title: "Cancel opposite pairs",
        paragraphs: [
          "Counters show the same idea. A positive counter stands for $+1$, read positive one, and a negative counter stands for $-1$. One of each makes 0, because $1 + (-1) = 0$. Such a pair is called a zero pair. Removing a zero pair does not change the total.",
          "The size of a number is its distance from 0, ignoring the sign. This distance is called its absolute value. So $-8$ and 8 both have size 8.",
          "If both numbers have the same sign (both positive or both negative), nothing cancels. Add the sizes and keep the sign: $(-4) + (-5) = -9$. If the signs are different, pairs cancel. Subtract the smaller size from the larger one. The answer takes the sign of the number with the larger size, because its counters are the ones left over: $(-8) + 3 = -5$. If the sizes are equal, every counter is paired, and the answer is 0: $(-3) + 3 = 0$.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Opposite changes",
        paragraphs: [
          "For any number $a$, the number $-a$ is called its opposite, and $a + (-a) = 0$. To add two integers (whole numbers or their negatives) with the same sign, add their absolute values (distances from 0) and keep that sign. To add two integers with different signs, subtract the smaller absolute value from the larger. Then use the sign of the number with the larger absolute value. If the absolute values are equal, the sum (the result of adding) is 0.",
        ],
      },
    ],
    workedExample: {
      prompt: "What is (−7) + 12?",
      steps: [
        "A positive counter stands for $+1$ and a negative counter for $-1$. Show $-7$ as 7 negative counters and 12 as 12 positive counters.",
        "One positive and one negative counter make 0, because a step right and a step left cancel. So pair them up and remove all 7 pairs. Removing zeros does not change the total.",
        "Count what is left: 12 − 7 = 5 positive counters. So $(-7) + 12 = 5$.",
      ],
      answer: "5",
    },
    pitfalls: [
      "A minus sign belongs to its number. In $5 + (-3)$, the $-3$ is a move of 3 steps to the left.",
      "Adding a negative number moves left, even though you are adding. $5 + (-3) = 2$, which is less than 5.",
      "With different signs, the answer takes the sign of the number farther from 0. $(-8) + 3 = -5$, not 5.",
    ],
    parentGuide:
      "Use counters in two colors, one for positive and one for negative. Build a sum such as $(-7) + 12$ and remove matching pairs. Ask the learner what is left, and why the answer is positive or negative.",
  },
  {
    id: "slope-two-points",
    title: "Slope measures change per step",
    summary:
      "Slope tells how steep a line is and which way it tilts. Pick two points on the line. Find how far the line goes up or down between them, and how far it goes across. Slope is the up-or-down change divided by the across change. A slope of 2 means up 2 for every 1 step to the right.",
    templateIds: ["line-slope"],
    objectives: [
      "Find the change in $x$ and the change in $y$ between two points, subtracting in the same order.",
      "Explain what a positive, negative or zero slope says about the line.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Compare two changes on the same line",
        paragraphs: [
          "A point on a grid is named by two numbers in brackets, like $(1, 2)$. These two numbers are its coordinates. The first, the $x$-coordinate, says how far to the right of the origin (the starting point, $(0, 0)$) to go. The second, the $y$-coordinate, says how far up. So $(1, 2)$ means 1 right and 2 up. Negative coordinates mean left or down.",
          "Walk along a line from $(1, 2)$ to $(5, 8)$. Across, you go from $x = 1$ to $x = 5$: that is 4 steps right. Up, you go from $y = 2$ to $y = 8$: that is 6 steps up. The up-or-down change is called the rise. The across change is called the run.",
          "Slope is the rise divided by the run: $\\tfrac{6}{4}$. Dividing the top and bottom of a fraction by the same whole number greater than 1 gives an equal fraction with smaller numbers. This is called simplifying. Divide both by 2 to get $\\tfrac{3}{2}$. It means the line climbs 3 grid steps for every 2 steps to the right, which is 1.5 steps up for every 1 step right. On a straight line that is not vertical, any two different points give the same slope, so the slope belongs to the whole line.",
        ],
      },
      {
        title: "Use a consistent direction",
        paragraphs: [
          "To write this for any two points, mark each letter with a small number below it, called a subscript. Point 1 is $(x_1, y_1)$, read “$x$ one, $y$ one”. Point 2 is $(x_2, y_2)$. A subscript only says which point a number came from.",
          "Then slope $= \\frac{y_2 - y_1}{x_2 - x_1}$: the change in $y$ over the change in $x$. The letter $m$ is often used for slope. Subtract in the same point order on the top and the bottom: point 2 minus point 1 in both places.",
          "Why the same order? Going the other way, from $(5, 8)$ back to $(1, 2)$, the rise is 2 − 8 = −6 and the run is 1 − 5 = −4. Then $\\frac{-6}{-4} = \\frac{3}{2}$, the same slope, because a negative divided by a negative is positive. Mixing the orders gives $\\frac{8 - 2}{1 - 5} = \\frac{6}{-4}$, which has the wrong sign: negative instead of positive.",
          "A number's sign says whether it is positive (greater than 0) or negative (less than 0). The sign of the slope tells the tilt. A positive slope means the line goes up as you move right. A negative slope means it goes down as you move right.",
        ],
      },
      {
        title: "When a change is zero",
        paragraphs: [
          "A horizontal line runs flat, straight across. Its $y$-coordinate never changes, so the rise is 0. The run is not 0, and 0 divided by any number other than 0 is 0. So a horizontal line has slope 0.",
          "A vertical line runs straight up and down. Its $x$-coordinate never changes, so the run is 0. Dividing by 0 has no answer, so a vertical line has no slope number. We say its slope is undefined.",
          "In this practice the two points always have different $x$-coordinates, so there is always a slope number. A slope can be a fraction, such as $-\\tfrac{1}{6}$. Keep it as an exact fraction, simplified as far as it goes. A decimal such as $-0.17$ is only close to $-\\tfrac{1}{6}$, so do not round.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Slope from two points",
        paragraphs: [
          "For two points $(x_1, y_1)$ and $(x_2, y_2)$ with $x_1 \\ne x_2$ ($\\ne$ means is not equal to), the slope is $m = \\frac{y_2 - y_1}{x_2 - x_1}$.",
          "Swapping which point comes first changes the sign of both the top and the bottom. Changing the sign of both parts of a fraction leaves its value the same. So the slope is the same either way, whether it is positive, negative or 0.",
        ],
      },
    ],
    workedExample: {
      prompt: "Find the slope through (1, 2) and (5, 8).",
      steps: [
        "Name the points. Point 1 is $(1, 2)$, so its $x$ is 1 and its $y$ is 2. Point 2 is $(5, 8)$, so its $x$ is 5 and its $y$ is 8.",
        "Change in $y$ (the rise): $y$ goes from 2 to 8, and subtracting the start from the end measures the change. Point 2's $y$ minus point 1's $y$: 8 − 2 = 6.",
        "Change in $x$ (the run): subtract in the same order, point 2 minus point 1, so both changes describe the same walk. 5 − 1 = 4.",
        "Slope = rise ÷ run = $\\tfrac{6}{4}$. Divide the top and bottom by 2 to simplify: $\\tfrac{3}{2}$. The line goes up 3 for every 2 to the right.",
      ],
      answer: "3/2",
    },
    pitfalls: [
      "Use the same point first in both subtractions. Switching the order in only one of them flips a slope that is not 0 from positive to negative, or the reverse.",
      "Slope is the change in $y$ divided by the change in $x$: up-or-down over across. It is not across over up-or-down.",
    ],
    parentGuide:
      "On graph paper, mark the two points with dots. Draw a path from one to the other: first straight across, then straight up or down. Count and label each part, writing a move left or down as a negative number. Then divide the up-or-down count by the across count.",
  },
  {
    id: "systems-elimination",
    title: "Make two equations work together",
    summary:
      "A system is two equations about the same two unknown numbers, such as $x$ and $y$. Its solution is the pair of numbers that makes both equations true at the same time. To find it, combine the equations so one unknown disappears. Solve for the other one, then go back for the first.",
    templateIds: ["linear-system-x"],
    objectives: [
      "Remove one unknown by subtracting one equation from the other, after making its coefficients (the numbers multiplying it) match.",
      "Find the remaining unknown, and check the pair in both original equations.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Both statements must hold at once",
        paragraphs: [
          "An equation says two amounts are equal. A variable is a letter that stands for an unknown number. The equation $x + y = 5$ has many solutions, meaning pairs of numbers that make it true: $x = 1$ and $y = 4$, or $x = 2$ and $y = 3$, and many more.",
          "Two equations about the same $x$ and $y$ are called a system of equations. A solution of the system is a pair that makes both equations true at once. For $2x + y = 7$ and $x + y = 5$, the pair $x = 2$, $y = 3$ works in both: $2 \\times 2 + 3 = 7$ and $2 + 3 = 5$. The pair $x = 1$, $y = 4$ works only in the second, because $2 \\times 1 + 4 = 6$, not 7.",
          "Think of two shopping trips. Two apples and a banana cost 7 dollars. One apple and a banana cost 5 dollars. The first trip has exactly one more apple, and it costs 2 dollars more. So one apple costs 2 dollars. Comparing the trips made the banana drop out.",
        ],
      },
      {
        title: "Subtract to remove one unknown",
        paragraphs: [
          "Here is the same idea in symbols, with $x$ as the price of an apple and $y$ as the price of a banana. Write the equations in lined-up rows: $2x + y = 7$ above $x + y = 5$. Subtract the bottom row from the top row, column by column: $2x - x = x$, $y - y = 0$, and $7 - 5 = 2$. The $y$ is gone, leaving $x = 2$. Removing an unknown this way is called elimination.",
          "Why is this allowed? Taking equal amounts from both sides of an equation keeps it true. The bottom equation says that $x + y$ and 5 are the same amount. So taking $x + y$ from the left side of the top equation, and 5 from its right side, takes the same amount from both sides.",
          "Then go back for $y$. Put $x = 2$ into either original equation: $2 + y = 5$, so $y = 3$. Check the pair in both equations, because a pair that works in only one of them is not a solution of the system.",
        ],
      },
      {
        title: "Make the coefficients match first",
        paragraphs: [
          "The number multiplying a variable is called its coefficient. In $3x + 5y$, the coefficient of $y$ is 5. Subtracting removes $y$ only when its coefficients are the same in both equations.",
          "If they differ, multiply a whole equation by a number first. Multiply every term on both sides, so the two sides stay equal and the solutions do not change. The number must not be 0, because multiplying by 0 turns any equation into $0 = 0$ and loses its information.",
          "For $3x + 5y = -5$ and $3x + 4y = -7$, multiply the first equation by 4 and the second by 5. Now both have $20y$: $12x + 20y = -20$ and $15x + 20y = -35$. Subtract the second from the first: $12x - 15x = -3x$, and $-20 - (-35) = -20 + 35 = 15$, since subtracting a negative is the same as adding. So $-3x = 15$. Dividing both sides by $-3$ undoes the multiplication and gives $x = -5$.",
          "Some systems have no solution, and some have infinitely many solutions, meaning endlessly many pairs. Every system in this practice has exactly one solution.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "A shared solution",
        paragraphs: [
          "A solution of a system of two equations makes both equations true. Two moves keep the solutions the same. One is multiplying an equation by a nonzero number, meaning any number except 0. The other is replacing one equation by the result of adding the other equation to it or subtracting the other from it.",
          "Elimination uses these moves to remove one variable. Then substitute, that is, put the value you found back into an original equation, and check the pair in both original equations.",
        ],
      },
    ],
    workedExample: {
      prompt: "Find $x$ if 2x + y = 7 and x + y = 5.",
      steps: [
        "The number multiplying a letter is called its coefficient. In both equations $y$ has coefficient 1, because $y$ means $1 \\times y$. Matching coefficients mean that subtracting one equation from the other will remove $y$.",
        "Subtract the second equation from the first, one part at a time on each side: $(2x - x) + (y - y) = 7 - 5$. Taking equal amounts from both sides keeps the equation true. That leaves $x = 2$.",
        "Find $y$ so the pair can be checked: put $x = 2$ into $x + y = 5$. Then $2 + y = 5$. Subtract 2 from both sides: $y = 3$.",
        "Check the pair in both original equations: $2 \\times 2 + 3 = 7$ and $2 + 3 = 5$. Both are true, so $x = 2$.",
      ],
      answer: "2",
    },
    pitfalls: [
      "Subtract every term, including the number on the right side of the equals sign.",
      "When you multiply an equation, multiply every term on both sides.",
      "A pair that makes only one equation true is not a solution of the system.",
    ],
    parentGuide:
      "Write the two equations in lined-up rows, with $x$ terms, $y$ terms and numbers in columns. Ask the learner to circle the matching $y$ terms before subtracting, and to say why subtracting keeps the equation true.",
  },
  {
    id: "equally-likely-probability",
    title: "Count favorable outcomes",
    summary:
      "Probability means chance. When outcomes are equally likely, divide the favorable count by the count of all possible outcomes.",
    templateIds: ["simple-probability"],
    objectives: [
      "Identify the event and the sample space.",
      "Express a probability as an exact fraction.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Count the ways a result can happen",
        paragraphs: [
          "If a bag holds three red and five blue counters and each counter is equally likely to be picked, three of the eight possible picks are red.",
          "The probability, or chance, of red is three out of eight.",
        ],
      },
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
    closingSections: [
      {
        stage: "formal",
        title: "Count favorable outcomes",
        paragraphs: [
          "For a finite set of equally likely outcomes, probability is favorable outcome count divided by total outcome count. The result lies between 0 and 1 inclusive; if outcomes are not equally likely, simple counting alone does not give probability.",
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
      "A sequence is an ordered list of numbers called terms. An arithmetic sequence adds the same amount, its common difference, to get each next term.",
    templateIds: ["arithmetic-term"],
    objectives: [
      "Generate terms with a common difference.",
      "Use the correct number of steps from term one.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Repeat the same change",
        paragraphs: [
          "The numbers 4, 7, 10, 13 rise by three each time.",
          "Four is the first term; reaching the fourth term takes three jumps of three. Counting jumps carefully finds later terms.",
        ],
      },
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
          "Term $n$ is a₁ + (n − 1)d when the first term is numbered one. There is one fewer jump than the term number.",
          "For the fifth term, begin at the first value and make four jumps. This also explains why multiplying the first term by the term number is generally wrong.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Fixed differences",
        paragraphs: [
          "An arithmetic sequence has a fixed difference $d$ between successive terms. If its first term is $a_1$, then its term at positive whole position $n$ is $a_n=a_1+(n-1)d$.",
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
    summary:
      "A function assigns one output to each allowed input. In $f(x)$, $x$ is the input and $f(x)$ is its output.",
    templateIds: ["function-evaluation"],
    objectives: [
      "Interpret function notation.",
      "Substitute consistently and follow operation order.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Put a number into a rule",
        paragraphs: [
          "A function rule takes an allowed input and gives one output.",
          "If the rule doubles a number and adds one, input three gives seven. Write $f(x)$ for the output when the input is $x$; $f(-2)$ asks for the output at input −2. Use that input in every place the rule asks for it.",
        ],
      },
      {
        title: "The input belongs everywhere",
        paragraphs: [
          "The notation f(−2) asks for the output of $f$ when the input is negative two. Replace every $x$ in the rule with (−2).",
          "Parentheses around negative inputs keep the sign attached to the number, especially when raising it to a power.",
        ],
      },
      {
        title: "Evaluate in order",
        paragraphs: [
          "Calculate powers before multiplication, then combine terms. For a quadratic, the squared input and the linear input can contribute terms with different signs.",
          "Function notation does not mean $f$ multiplied by the input. It names a rule and supplies that rule’s input.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "One output per allowed input",
        paragraphs: [
          "A function assigns exactly one output to each input in its domain. Evaluating a rule at an input means replacing every occurrence of the input variable by that value, with grouping preserved.",
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
      "Replace every occurrence of $x$ with the same input.",
      "(−2)² is positive four.",
    ],
    parentGuide:
      "Ask the learner to write the full substituted expression before calculating; check signs separately from arithmetic.",
  },
  {
    id: "unit-cost",
    title: "Find one, then scale",
    summary: "Divide a total cost by the item count to find cost per item.",
    templateIds: ["unit-price"],
    objectives: [
      "Calculate a price per item.",
      "Scale a unit price to a new quantity.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Find the cost of one",
        paragraphs: [
          "Four identical notebooks cost twelve dollars in all.",
          "Sharing the cost equally gives three dollars for one notebook. That one-item cost can then predict the cost of another number of notebooks.",
        ],
      },
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
    closingSections: [
      {
        stage: "formal",
        title: "Constant cost per item",
        paragraphs: [
          "In a proportional price relationship with positive item count, unit cost is total cost divided by item count. If the unit cost stays fixed, total cost equals unit cost times item count and the graph passes through the origin.",
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
      "Multiply the counts, then name the smaller place-value unit of the product.",
    templateIds: ["decimal-multiplication"],
    objectives: [
      "Interpret tenths times tenths as hundredths.",
      "Estimate the size of a decimal product.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Watch the size of the pieces",
        paragraphs: [
          "Twelve tenths times three tenths makes thirty-six hundredths.",
          "The whole-number fact 12 times 3 gives the count, but the pieces in the product are hundredths, not ones.",
        ],
      },
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
    closingSections: [
      {
        stage: "formal",
        title: "Place units multiply",
        paragraphs: [
          "A decimal with $p$ digits after its point counts units of size $10^{-p}$. Multiplying it by a decimal with $q$ such digits makes units of size $10^{-(p+q)}$; multiply their whole-number counts and locate the product's decimal point accordingly.",
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
      "Grouping tells which calculations to finish before combining their results.",
    templateIds: ["operation-order"],
    objectives: [
      "Evaluate grouped quantities first.",
      "Complete multiplication before addition outside the group.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Finish the inside group first",
        paragraphs: [
          "In a calculation with parentheses, the expression inside them names one amount.",
          "Find that amount before using it in the rest of the calculation, then follow the agreed order for the remaining operations.",
        ],
      },
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
    closingSections: [
      {
        stage: "formal",
        title: "An agreed order gives one value",
        paragraphs: [
          "An expression is evaluated by completing grouped operations first, then powers, then multiplication and division from left to right, then addition and subtraction from left to right. Equivalent regrouping may change the order only when the operations' properties justify it.",
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
