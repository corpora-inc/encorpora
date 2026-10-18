import { fractionAdditionLesson } from "./fraction-addition-lesson";
import { polynomialLessons } from "./polynomial-lessons";
import { quadraticLessons } from "./quadratic-lessons";
import { measurementLessons } from "./measurement-lessons.js";
import { algebraLessons } from "./algebra-lessons.js";
import { choiceLessons } from "./choice-lessons.js";
import { elementaryLessons } from "./elementary-lessons";
import { graphicalLessons } from "./graphical-lessons";
import { extendedLessons } from "./extended-lessons";
/** Original reference lessons for the implemented templates, not a full course. */
export interface Lesson {
  id: string;
  title: string;
  summary: string;
  templateIds: string[];
  objectives: string[];
  sections: {
    title: string;
    paragraphs: string[];
    illustration?: "thirds-and-fourths";
  }[];
  workedExample: {
    prompt: string;
    steps: string[];
    answer: string;
    answerUnit?: string;
  };
  pitfalls: string[];
  parentGuide: string;
}
export const baseLessons: Lesson[] = [
  {
    id: "counting",
    title: "One object, one count",
    summary:
      "Connect each object with one number word and use the last number to name the total.",
    templateIds: ["count-objects"],
    objectives: [
      "Count each object exactly once.",
      "Explain that rearranging objects does not change their number.",
    ],
    sections: [
      {
        title: "Keep track",
        paragraphs: [
          "Put a finger beside the first object. Say one. Move to a new object and say two. Keep going until every object has a number word.",
          "For scattered objects, move each counted object into a separate group. For a picture, point in a steady order so no object gets counted twice.",
        ],
      },
      {
        title: "The last word tells how many",
        paragraphs: [
          "When you finish counting, the last number names the size of the whole group. You do not need to begin counting again when someone asks how many.",
          "Spread the same objects apart and count them again. The group takes more space, but it has the same number of objects.",
        ],
      },
    ],
    workedExample: {
      prompt: "Count these dots: ● ● ● ● ●",
      steps: [
        "Point to each dot while saying one, two, three, four, five.",
        "The last number word is five.",
      ],
      answer: "5",
    },
    pitfalls: [
      "Saying number words faster than you point can skip or double-count an object.",
      "A longer row does not necessarily contain more objects.",
    ],
    parentGuide:
      "Use five buttons or blocks. Ask the learner to count, rearrange them, and explain whether the number changed. Accept pointing or moving objects as a strategy.",
  },
  {
    id: "addition",
    title: "Join groups and count on",
    summary: "Addition describes the total when groups are joined.",
    templateIds: ["add-within-20"],
    objectives: [
      "Model addition by joining two groups.",
      "Use counting on or making ten to add within twenty.",
    ],
    sections: [
      {
        title: "Join two parts",
        paragraphs: [
          "In 6 + 3, six and three are the parts. The sum tells how many are in the combined group. Start with six counters and add three more.",
          "You can count every counter, or start at six and count three steps: seven, eight, nine. The starting number is not one of the added steps.",
        ],
      },
      {
        title: "Make a ten",
        paragraphs: [
          "Ten is a useful stopping place. To find 8 + 5, split five into two and three. Eight plus two makes ten; three more makes thirteen.",
          "Changing the order of the parts does not change the total. Adding zero adds no objects, so the starting number stays the same.",
        ],
      },
    ],
    workedExample: {
      prompt: "What is 8 + 5?",
      steps: ["Split 5 into 2 + 3.", "8 + 2 = 10.", "10 + 3 = 13."],
      answer: "13",
    },
    pitfalls: [
      "When counting on, begin the first new step after the starting number.",
      "Breaking apart a number must preserve its total.",
    ],
    parentGuide:
      "Use two colors of counters and ask how the learner sees a group of ten. Encourage a clear strategy before asking for speed.",
  },
  {
    id: "subtraction",
    title: "Take away and find the difference",
    summary:
      "Subtraction can describe removing objects or comparing two amounts.",
    templateIds: ["subtract-within-20"],
    objectives: [
      "Model subtraction with objects.",
      "Check a subtraction answer with addition.",
    ],
    sections: [
      {
        title: "Remove a part",
        paragraphs: [
          "In 14 − 6, begin with fourteen and remove six. The difference is the amount left. Mark removed objects so you do not subtract an object twice.",
          "You can also count backward six steps. When crossing ten, remove four to reach ten and then remove two more.",
        ],
      },
      {
        title: "Find what is missing",
        paragraphs: [
          "Think of 14 − 6 as the question: six plus what equals fourteen? Count up from six to fourteen, keeping track of the steps.",
          "Addition checks the result: the amount removed plus the amount remaining must equal the starting amount.",
        ],
      },
    ],
    workedExample: {
      prompt: "What is 14 − 6?",
      steps: [
        "Remove 4 from 14 to reach 10.",
        "There are 2 more to remove: 10 − 2 = 8.",
        "Check: 6 + 8 = 14.",
      ],
      answer: "8",
    },
    pitfalls: [
      "Subtraction order matters: taking six from fourteen is different from taking fourteen from six.",
      "Subtracting zero leaves the amount unchanged.",
    ],
    parentGuide:
      "Give the learner fourteen small objects and ask them to show both taking away six and building six up to fourteen.",
  },
  {
    id: "multiplication",
    title: "Equal groups and arrays",
    summary: "Multiplication counts equal groups efficiently.",
    templateIds: ["multiply-facts"],
    objectives: [
      "Interpret a product as equal groups.",
      "Use known facts to derive another product.",
    ],
    sections: [
      {
        title: "Every group must be equal",
        paragraphs: [
          "Four groups of six means 6 + 6 + 6 + 6. We write 4 × 6. The first factor can name the number of groups and the second the size of each group.",
          "Draw four rows with six dots in each row. The array has twenty-four dots. Turning the array shows six rows of four without changing the total.",
        ],
      },
      {
        title: "Build from a known fact",
        paragraphs: [
          "Split a difficult fact into easier groups. For 7 × 6, five groups of six make thirty and two groups of six make twelve. Together they make forty-two.",
          "This is the distributive property: (5 + 2) × 6 = 5 × 6 + 2 × 6. The same idea supports larger multiplication.",
        ],
      },
    ],
    workedExample: {
      prompt: "What is 7 × 6?",
      steps: [
        "Split 7 groups into 5 groups and 2 groups.",
        "5 × 6 = 30 and 2 × 6 = 12.",
        "30 + 12 = 42.",
      ],
      answer: "42",
    },
    pitfalls: [
      "Unequal group sizes cannot be represented by one multiplication fact without another step.",
      "Adding the factors gives a different quantity from multiplying them.",
    ],
    parentGuide:
      "Draw a seven-by-six array, divide it after five rows, and ask the learner to explain how both smaller arrays help.",
  },
  {
    id: "fractions",
    title: "Equal parts of one whole",
    summary:
      "A fraction describes a number of equal parts relative to a named whole.",
    templateIds: ["fraction-model"],
    objectives: [
      "Identify numerator and denominator in a fraction model.",
      "Recognize equivalent fractions.",
    ],
    sections: [
      {
        title: "Name the whole first",
        paragraphs: [
          "Choose one whole, such as one rectangle. Divide it into equal-area parts. The denominator counts all the equal parts in that whole; the numerator counts the selected parts.",
          "If three of eight equal parts are shaded, the shaded amount is 3/8. The unshaded parts are included when counting the denominator.",
        ],
      },
      {
        title: "Rename without changing the amount",
        paragraphs: [
          "Four of eight equal parts cover the same amount as one of two equal parts of the same whole. That is why 4/8 = 1/2.",
          "Divide the numerator and denominator by the same nonzero number to simplify. The labels change, but the amount stays fixed.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A rectangle has eight equal parts. Four are shaded. What fraction is shaded?",
      steps: [
        "There are 8 equal parts in the whole and 4 shaded parts.",
        "Write 4/8.",
        "Divide both numerator and denominator by 4: 4/8 = 1/2.",
      ],
      answer: "1/2",
    },
    pitfalls: [
      "Parts must have equal size; merely counting unequal regions does not define a fraction of area.",
      "Compare fractions using the same-sized whole.",
    ],
    parentGuide:
      "Fold a paper into equal parts. Shade half, then add more folds. Ask why the shaded amount stays the same even though its fraction name changes.",
  },
  fractionAdditionLesson,
  {
    id: "area",
    title: "Cover a rectangle with unit squares",
    summary: "Area measures how much flat surface a shape covers.",
    templateIds: ["rectangle-area"],
    objectives: [
      "Explain the rectangle area formula using rows of squares.",
      "Distinguish square units from length units.",
    ],
    sections: [
      {
        title: "Count a covering",
        paragraphs: [
          "A rectangle six centimeters wide fits six one-centimeter squares across a row. If it is four centimeters high, it has four rows. Multiplying counts every square once.",
          "Area = width × height. The side lengths must describe perpendicular dimensions of the rectangle in compatible units.",
        ],
      },
      {
        title: "Keep the units",
        paragraphs: [
          "Centimeters measure length. Square centimeters measure area: one square centimeter is the area of a square with sides one centimeter long.",
          "Perimeter measures the distance around the boundary. It is not the same as the number of squares covering the inside.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A rectangle is 6 cm wide and 4 cm high. What is its area in square centimeters?",
      steps: [
        "Each row contains 6 unit squares.",
        "There are 4 rows.",
        "6 × 4 = 24 square centimeters.",
      ],
      answer: "24",
    },
    pitfalls: [
      "Adding the side lengths does not give area.",
      "Do not report area in centimeters alone.",
    ],
    parentGuide:
      "Have the learner cover or draw a rectangle on centimeter grid paper. Ask them to explain why multiplication counts the squares.",
  },
  {
    id: "linear-equations",
    title: "Keep an equation balanced",
    summary: "Undo operations on both sides to isolate the unknown.",
    templateIds: ["linear-equation"],
    objectives: [
      "Solve a two-step linear equation.",
      "Verify a solution by substitution.",
    ],
    sections: [
      {
        title: "Equality is a balance",
        paragraphs: [
          "An equation states that two expressions have the same value. Subtracting the same amount from both sides preserves equality. Dividing both sides by the same nonzero number also preserves equality.",
          "To solve ax + b = c with a nonzero, subtract b first and then divide by a. These operations undo addition and multiplication.",
        ],
      },
      {
        title: "Check in the original equation",
        paragraphs: [
          "Replace x with your proposed solution. Compute the left side and compare it with the right side.",
          "Negative solutions are possible. Follow the signs carefully when the right side minus the constant is negative.",
        ],
      },
    ],
    workedExample: {
      prompt: "Solve 3x + 5 = −7.",
      steps: [
        "Subtract 5 from both sides: 3x = −12.",
        "Divide both sides by 3: x = −4.",
        "Check: 3(−4) + 5 = −12 + 5 = −7.",
      ],
      answer: "-4",
    },
    pitfalls: [
      "Changing only one side usually destroys equality.",
      "The coefficient multiplies x; remove it by division, not subtraction.",
    ],
    parentGuide:
      "Ask which operation the learner is undoing and why the same change must happen on both sides. Let substitution settle disagreements.",
  },
  {
    id: "statistics-mean",
    title: "Mean as a fair share",
    summary:
      "The mean distributes a dataset’s total equally among its observations.",
    templateIds: ["mean-data"],
    objectives: [
      "Compute an arithmetic mean.",
      "Explain why repeated observations and every value count.",
    ],
    sections: [
      {
        title: "Find the total and the count",
        paragraphs: [
          "Add all observations, including repeated values. Divide that total by the number of observations. The result is the arithmetic mean.",
          "Imagine sharing the total equally. If five bags contain different numbers of marbles, the mean is the amount per bag after an equal redistribution, allowing fractional amounts in the calculation.",
        ],
      },
      {
        title: "Interpret the answer",
        paragraphs: [
          "A mean can be a fraction or decimal even when all observations are whole numbers. It need not appear anywhere in the original dataset.",
          "One unusually large observation pulls the mean upward. The median, which uses the middle position in sorted data, describes a different feature.",
        ],
      },
    ],
    workedExample: {
      prompt: "What is the mean of 3, 4, 4, 7, 8?",
      steps: [
        "Add every value: 3 + 4 + 4 + 7 + 8 = 26.",
        "There are 5 observations.",
        "26 ÷ 5 = 26/5 = 5.2.",
      ],
      answer: "26/5",
    },
    pitfalls: [
      "Count observations, not just distinct values.",
      "Dividing by the largest value or finding the middle value does not compute the mean.",
    ],
    parentGuide:
      "Use five small piles of counters. Redistribute them to model a fair share, then discuss why a fractional mean can be meaningful even when counters are indivisible.",
  },
  {
    id: "pythagorean-theorem",
    title: "Find the long side of a right triangle",
    summary: "The squares of the two legs sum to the square of the hypotenuse.",
    templateIds: ["right-triangle"],
    objectives: [
      "Identify the hypotenuse opposite the right angle.",
      "Use a² + b² = c² and take a positive square root.",
    ],
    sections: [
      {
        title: "Identify the right angle",
        paragraphs: [
          "The legs meet at the right angle. The hypotenuse is opposite that angle and is the longest side.",
          "For a right triangle with legs a and b and hypotenuse c, a² + b² = c². The theorem applies to right triangles; it is not a formula for arbitrary triangles.",
        ],
      },
      {
        title: "Square, add, then take the root",
        paragraphs: [
          "Square each leg length separately and add the squares. This gives the square of the hypotenuse, not its length.",
          "Take the positive square root because a side length is positive. Check that the result is larger than either leg and smaller than their sum.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A right triangle has perpendicular legs 6 cm and 8 cm. Find the hypotenuse length in centimeters.",
      steps: [
        "c² = 6² + 8² = 36 + 64 = 100.",
        "c = √100 = 10.",
        "10 is greater than either leg and less than 6 + 8.",
      ],
      answer: "10",
    },
    pitfalls: [
      "Squaring a sum is different from adding two squares.",
      "The hypotenuse is not one of the sides that form the right angle.",
    ],
    parentGuide:
      "Sketch the right angle clearly, label the legs, and ask the learner to identify the hypotenuse before calculating.",
  },
  {
    id: "quadratics",
    title: "Read a quadratic minimum",
    summary: "Vertex form makes the extreme value of a quadratic visible.",
    templateIds: ["quadratic-vertex"],
    objectives: [
      "Interpret a positive multiple of a square.",
      "Distinguish the minimum value from the input where it occurs.",
    ],
    sections: [
      {
        title: "A square cannot be negative",
        paragraphs: [
          "For real x, (x − h)² is at least zero. It becomes zero exactly when x = h. Multiplying by a positive coefficient preserves this lower bound.",
          "Therefore f(x) = a(x − h)² + k with a positive has minimum value k. The vertex is the point (h, k).",
        ],
      },
      {
        title: "Input and output are different",
        paragraphs: [
          "The input h tells where the minimum occurs. The output k tells the minimum value. Read the question carefully to decide which is requested.",
          "A negative coefficient opens the parabola downward and gives a maximum instead. This lesson’s practice uses positive coefficients and a real-number domain.",
        ],
      },
    ],
    workedExample: {
      prompt: "For real x, what is the minimum value of f(x) = 2(x − 3)² + 5?",
      steps: [
        "The squared expression is nonnegative, so 2(x − 3)² ≥ 0.",
        "At x = 3, the squared expression is zero.",
        "The smallest output is 0 + 5 = 5.",
      ],
      answer: "5",
    },
    pitfalls: [
      "The x-coordinate of the vertex is not the minimum output.",
      "The coefficient’s sign determines whether the vertex is a minimum or maximum.",
    ],
    parentGuide:
      "Make a small table for x = 1, 2, 3, 4, 5. Compare the symmetric outputs and distinguish the input 3 from the minimum value 5.",
  },
  {
    id: "geometric-sequences",
    title: "Repeated multiplication",
    summary:
      "A geometric sequence multiplies by a fixed ratio between consecutive terms.",
    templateIds: ["geometric-sequence"],
    objectives: [
      "Build terms by repeated multiplication.",
      "Use aₙ = a₁r^(n − 1) with first-term indexing.",
    ],
    sections: [
      {
        title: "Use the same ratio each step",
        paragraphs: [
          "Starting with three and multiplying by two produces 3, 6, 12, 24, 48. The common ratio is two because each term is twice the one before.",
          "An arithmetic sequence adds the same difference; a geometric sequence multiplies by the same ratio. Identify which relationship is present.",
        ],
      },
      {
        title: "Count the steps, not the term number",
        paragraphs: [
          "From term 1 to term 5 there are four multiplication steps. Thus term n is a₁ × r^(n − 1).",
          "This formula uses a first term labeled 1. A sequence indexed from 0 uses a different starting exponent, so the indexing convention matters.",
        ],
      },
    ],
    workedExample: {
      prompt: "The first term is 3 and the common ratio is 2. What is term 5?",
      steps: [
        "There are 5 − 1 = 4 steps after the first term.",
        "Multiply by 2 four times: 3, 6, 12, 24, 48.",
        "Equivalently, 3 × 2⁴ = 48.",
      ],
      answer: "48",
    },
    pitfalls: [
      "Using exponent n instead of n − 1 advances one term too far.",
      "Adding the common ratio does not generate a geometric sequence.",
    ],
    parentGuide:
      "Label each term with its position. Draw an arrow marked ×2 between terms and count the arrows to prevent indexing errors.",
  },
  {
    id: "logarithms",
    title: "Ask for the exponent",
    summary: "A logarithm reverses exponentiation.",
    templateIds: ["logarithm-integer"],
    objectives: [
      "Translate between logarithmic and exponential statements.",
      "Evaluate logarithms of integer powers.",
    ],
    sections: [
      {
        title: "Three parts of a power",
        paragraphs: [
          "In 3⁴ = 81, three is the base, four is the exponent, and eighty-one is the result. A logarithm asks for the exponent when the base and result are known.",
          "The statement log base 3 of 81 = 4 means exactly 3⁴ = 81. It does not mean 81 divided by 3.",
        ],
      },
      {
        title: "Check with multiplication",
        paragraphs: [
          "List powers of the base until reaching the argument: 3, 9, 27, 81. Four factors of three produce eighty-one.",
          "For real logarithms, the base must be positive and different from one, and the argument must be positive. These examples use whole-number bases greater than one.",
        ],
      },
    ],
    workedExample: {
      prompt: "What is log base 3 of 81?",
      steps: [
        "Find p such that 3^p = 81.",
        "3 × 3 × 3 × 3 = 81.",
        "There are four factors, so p = 4.",
      ],
      answer: "4",
    },
    pitfalls: [
      "A logarithm asks for an exponent, not a quotient.",
      "Count the number of factors of the base, not just the multiplication symbols.",
    ],
    parentGuide:
      "Cover the exponent in a familiar power equation and ask what it must be. Then write the equivalent logarithm statement.",
  },
];

export const lessons: readonly Lesson[] = [
  ...quadraticLessons,
  ...polynomialLessons,
  ...baseLessons,
  ...extendedLessons,
  ...graphicalLessons,
  ...elementaryLessons,
  ...algebraLessons,
  ...measurementLessons,
  ...choiceLessons,
];
