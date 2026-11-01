import type { FacetMapping } from "./coverage";
import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";
import { chainLesson } from "./chain-lesson-kit";

export const operationSentenceMethods: Record<string, ProblemMethod> = {
  "operation-sentence-choice": {
    goal: "Choose the number sentence for equal groups told in a story, drawn as groups or as jumps, or judge which sentence cannot find the total.",
    intuition:
      "Equal groups are groups that each have the same number of things. Joining equal groups is called multiplication, written ×. So 3 groups of 5 is 3 × 5 = 15. Adding the group size once for each group, 5 + 5 + 5, gives the same total. A number sentence uses numbers and signs, and a letter such as $n$ can stand for the number you want to find.",
    senses: { jump: "jump", jumps: "jump" },
    terms: ["equal-groups", "number-sentence"],
    method: [
      "Find the number of groups and the size of each group, from the story, the picture or the jumps.",
      "Choose the sentence that joins that many equal groups. Multiplication in either order works, and so does adding the group size once per group.",
      "Division is splitting a total into equal groups. A division also fits when the total, $n$, is the number being split. $n \\div 5 = 3$ says the total split into fives makes 3 groups.",
      "To find the sentence that cannot work, test every sentence the same way.",
    ],
    watch:
      "Adding the number of groups to the group size counts one group only once. Check that the sentence uses the group size once for each group.",
  },
  "related-division-sentence": {
    goal: "Choose the division sentence a multiplication fact helps solve, or the multiplication sentence that helps solve a division, including tens.",
    intuition:
      "Multiplication is joining equal groups, written ×. 6 × 7 = 42 means 6 groups of 7 make 42. The numbers multiplied, 6 and 7, are called factors. The answer, 42, is called the product. Division is splitting the product back into equal groups, written ÷: 42 ÷ 6 = 7. Numbers like 20, 30 and 40 are called multiples of ten.",
    senses: {
      factor: "factor-number",
      factors: "factor-number",
      product: "product-multiply",
      products: "product-multiply",
      multiple: "multiple",
    },
    noLink: ["inverse", "whole"],
    terms: ["factor-number", "product-multiply"],
    method: [
      "Name the product and the two factors. In a division, the number being split is the product, and the number you divide by is a factor.",
      "From a fact, start the division at the product and divide by one factor. From a division, write a multiplication: the number you divide by, times the unknown, equals the product.",
      "With a multiple of ten, keep the 0: divide by 40, not 4.",
    ],
    watch:
      "Start every division from the product, and divide by a factor. The answer is the other factor.",
  },
  "related-subtraction-sentence": {
    goal: "Choose the subtraction sentence that an addition fact within 20 helps solve, among subtraction, addition, multiplication and division.",
    intuition:
      "Addition is putting two parts together to make a whole, written +: 8 + 5 = 13. A part is one of the amounts being added, and the whole is the total. Subtraction is taking a part away from the whole, written −. Then the other part is left: 13 − 8 = 5.",
    senses: { part: "part", parts: "part", whole: "whole" },
    noLink: ["inverse", "leaves"],
    terms: [
      ["part", "Here the parts are the two numbers being added."],
      "whole",
    ],
    method: [
      "Name the two parts and the whole in the addition fact.",
      "Write a subtraction that starts with the whole and takes away one part.",
      "Check that the sentence uses subtraction and that the whole is the first number.",
    ],
    watch:
      "Start the subtraction from the whole, then take away one part. The answer is the other part.",
  },
  "whole-number-equality-choice": {
    goal: "Choose the one true equation when a product equals a sum or difference, or when two products of three factors are compared.",
    intuition:
      "An equation is two amounts joined by an equal sign, =. A side is what is written to the left or to the right of the equal sign. The equation is true when both sides work out to the same number. Multiplication is joining equal groups, written ×. A product, the answer to a multiplication, can equal a sum or a difference, the answers to adding and subtracting. Numbers being multiplied are called factors.",
    senses: {
      side: "side-of-equation",
      sides: "side-of-equation",
      factor: "factor-number",
      factors: "factor-number",
      product: "product-multiply",
      products: "product-multiply",
      difference: "difference-subtract",
    },
    noLink: ["third", "whole"],
    terms: ["equation", "side-of-equation"],
    method: [
      "Work out the left side, then the right side, one operation at a time.",
      "Compare the two numbers. Keep the equation only if they match.",
      "With three factors, multiply the first two, then multiply that answer by the third factor.",
    ],
    watch:
      "Do not stop after the first operation. Work out all of each side, then compare.",
  },
};

export const operationSentencePrinciples: Record<string, string> = {
  "operation-sentence-choice":
    "Let $g$ be the number of groups and $s$ the size of each group. The total is $n = g \\times s = s \\times g$, which is $s$ added $g$ times. Then $n \\div s = g$ and $n \\div g = s$. A sentence that only uses $g + s$, $g - s$ or $g \\div s$ finds a different amount.",
  "related-division-sentence":
    "If $a \\times b = c$, and neither $a$ nor $b$ is 0, then $c \\div a = b$ and $c \\div b = a$. Going back, $c \\div a = n$ means $a \\times n = c$. Here the letters stand for numbers. This works because division undoes multiplication by a number that is not 0.",
  "related-subtraction-sentence":
    "If $a + b = c$, then $c - a = b$ and $c - b = a$. Here $a$ and $b$ are the parts and $c$ is the whole. Subtraction undoes addition, so each part is the whole minus the other part.",
  "whole-number-equality-choice":
    "An equation is true exactly when both sides have the same value. Multiply before you add or subtract. Factors give the same product in any order, and whichever two you multiply first.",
};

export const operationSentenceLessons: Lesson[] = [
  {
    ...chainLesson({
      id: "operation-sentence-choice",
      title: "Choose the sentence that fits equal groups",
      summary:
        "Equal groups are groups that each have the same number of things. Joining equal groups is called multiplication, written ×. Four boxes with 6 flowers each is 4 × 6 = 24 flowers. A number sentence uses numbers and signs to say how amounts are related. Match a story, a picture or jumps on a number line to the sentence that finds the total.",
      templateIds: ["operation-sentence-choice"],
      objectives: [
        "Choose the multiplication sentence for equal groups told in a story, drawn as groups or drawn as equal jumps.",
        "Tell which sentence cannot find the total, and choose the story that a multiplication describes.",
      ],
      openingTitle: "Equal groups are joined",
      opening: [
        "When each box, page or jump is the same size, the total comes from joining equal groups. Four boxes with 6 flowers each is 4 × 6, read “4 times 6”. It is also 6 + 6 + 6 + 6, because there are four 6s.",
        "A letter can stand for a number you want to find. In $4 \\times 6 = n$, the letter $n$ stands for the total.",
        "A number line is a line with numbers in order, evenly spaced. A jump is a curved arrow along it. Four equal jumps of 6 from 0 show 4 groups of 6.",
        "A picture can show the same groups as dots or objects. Count how many groups there are and how big each one is. Then pick the sentence that uses those two numbers to find the total.",
        "Division is splitting a total into equal groups, written ÷. $n \\div 6 = 4$ says the total split into groups of 6 makes 4 groups. That is also true when $n = 24$, so it fits too.",
      ],
      example: {
        prompt:
          "A number line shows 4 equal jumps of 6 starting at 0. Which sentence finds where the last jump lands?",
        steps: [
          "Count the jumps and find their size. There are 4 jumps, and each jump is 6 long.",
          "Joining 4 equal jumps of 6 is multiplication: $4 \\times 6 = n$.",
          "$4 + 6 = n$ does not fit. It adds the number 4 to one jump of 6, instead of joining four jumps of 6.",
          "The last jump lands on $4 \\times 6 = 24$.",
        ],
        answer: "$4 \\times 6 = n$, and $n = 24$",
      },
      methodTitle: "Groups, size, operation",
      method: [
        "Find the number of groups and the size of one group. Use the picture or the story to find them.",
        "Pick the sentence that joins that many groups of that size. Multiplication works in either order: $4 \\times 6$ and $6 \\times 4$ are both 24. Repeated adding, $6 + 6 + 6 + 6$, works too.",
        "A division fits when the unknown total is the number being split, as in $n \\div 6 = 4$.",
        "To find the sentence that cannot work, test each sentence the same way. Keep the one that does not give the total.",
      ],
      formalTitle: "Why several sentences fit",
      formal: [
        "Let $g$ be the number of groups and $s$ the size of each group. The total is $g \\times s$. Multiplying in either order gives the same answer, so $s \\times g$ is the same total.",
        "Adding $s$ again and again, $g$ times, is what $g \\times s$ means.",
        "Dividing the total by $s$ gives back the number of groups, $g$. Dividing it by $g$ gives back the size, $s$. This works because division undoes multiplication.",
      ],
      pitfalls: [
        "Do not add the number of groups to the group size. 4 + 6 = 10, but 4 groups of 6 is 24.",
        "In a division that fits, the total $n$ is the number being split: $n \\div 6 = 4$, not $6 \\div n = 4$.",
        "To choose a story for $4 \\times 6$, look for 4 equal groups of 6, or 6 equal groups of 4. A story that uses 4 and 6 another way does not fit.",
      ],
      parentGuide:
        "Before your learner chooses a sentence, ask two questions: how many groups, and how many in each group?",
    }),
    senses: { jump: "jump", jumps: "jump" },
  },
  {
    ...chainLesson({
      id: "related-facts-sentences",
      title: "Use a fact to choose the related sentence",
      summary:
        "A number sentence is a math sentence made of numbers and signs, like 8 + 5 = 13. Three numbers can fit together in several sentences. From 8 + 5 = 13 you also know 13 − 8 = 5. A fact you know helps you solve its partner sentences.",
      templateIds: [
        "related-division-sentence",
        "related-subtraction-sentence",
      ],
      objectives: [
        "Choose the subtraction sentence that an addition fact within 20 helps solve.",
        "Choose the division sentence that a multiplication fact helps solve, and the multiplication that helps solve a division, including dividing by tens such as 40.",
      ],
      openingTitle: "Facts come in families",
      opening: [
        "A part is one of the amounts you add. Addition is putting parts together, written +. The whole is all of it. In 8 + 5 = 13, the parts are 8 and 5. The whole is 13.",
        "Subtraction is taking a part away from the whole, written −. Then the other part is left. So 13 − 8 = 5 and 13 − 5 = 8.",
        "Equal groups are groups with the same number in each. Joining equal groups is called multiplication, written ×. 6 × 7 = 42 means 6 groups of 7 make 42. The numbers being multiplied, 6 and 7, are called factors. The answer, 42, is called the product.",
        "Division is splitting the product into equal groups, written ÷. So 42 ÷ 6 = 7 and 42 ÷ 7 = 6.",
        "Subtraction starts from the whole. Division starts from the product.",
        "Numbers like 20, 30 and 40 are called multiples of ten. 40 is 4 tens. Since 4 × 6 = 24, 4 tens times 6 is 24 tens. That is 240, so 40 × 6 = 240.",
      ],
      example: {
        prompt:
          "You know $40 \\times 6 = 240$. Which multiplication sentence helps you find $n$ in $240 \\div 40 = n$?",
        steps: [
          "The letter $n$ stands for the number to find. $240 \\div 40 = n$ asks: 40 times what number makes 240?",
          "Write that as a multiplication: $40 \\times n = 240$. The total, 240, is the product.",
          "You know $40 \\times 6 = 240$, so $n = 6$.",
        ],
        answer: "$40 \\times n = 240$, and $n = 6$",
      },
      methodTitle: "Start from the whole or the product",
      method: [
        "Find the whole or the product. It is the number subtraction or division starts with.",
        "Write the subtraction or division that starts there and uses one of the other two numbers.",
        "To solve a division, write a multiplication. The number you divide by is one factor, and the total is the product. Keep the 0 of a multiple of ten: 40, not 4.",
      ],
      formalTitle: "Undoing an operation",
      formal: [
        "Let the letters stand for numbers. If $a + b = c$, then $c - a = b$ and $c - b = a$. Here $a$ and $b$ are the parts and $c$ is the whole. Subtraction undoes addition.",
        "If $a \\times b = c$, and neither $a$ nor $b$ is 0, then $c \\div a = b$ and $c \\div b = a$. Division undoes multiplication.",
        "So each fact gives two partner sentences.",
      ],
      pitfalls: [
        "Start a subtraction from the whole. 13 − 8 uses the fact 8 + 5 = 13, and 8 − 5 does not.",
        "Start a division from the product, then divide by a factor. 42 ÷ 6 uses the fact 6 × 7 = 42.",
        "Keep the zero when you divide by 40, 50 or another multiple of ten.",
      ],
      parentGuide:
        "Write three numbers in a triangle, with the whole or product on top. Ask your learner to say every sentence the family makes.",
    }),
    senses: {
      part: "part",
      parts: "part",
      whole: "whole",
      factor: "factor-number",
      factors: "factor-number",
      product: "product-multiply",
      multiple: "multiple",
    },
  },
  {
    ...chainLesson({
      id: "true-equation-choice",
      title: "Find the true equation",
      summary:
        "An equation is two amounts joined by an equal sign, =. A side is what is written to the left or to the right of the equal sign. An equation is true when both sides work out to the same number. To check, work out each side on its own. Then compare.",
      templateIds: ["whole-number-equality-choice"],
      objectives: [
        "Decide whether an equation with a product on one side and a sum or difference on the other is true.",
        "Compare two products of three factors by working out each side.",
      ],
      openingTitle: "The equal sign means the same value",
      opening: [
        "Multiplication is joining equal groups, written ×. One side can be a product, the answer to a multiplication, like 3 × 5. The other side can be a sum, the answer to an addition. It can also be a difference, the answer to a subtraction.",
        "The two sides can still be equal: 3 × 5 = 10 + 5 is true, because both sides are 15.",
        "Work out the left side. Work out the right side. If the numbers match, the equation is true. If not, it is false.",
        "Some sides multiply three numbers, like 2 × 6 × 3. The numbers being multiplied are called factors. Multiply the first two, then multiply by the third: 2 × 6 = 12 and 12 × 3 = 36.",
        "When one side mixes operations, like 2 × 3 + 4, multiply before you add or subtract. This agreed order is called the order of operations.",
      ],
      example: {
        prompt:
          "Which equation is true: $4 \\times 6 = 20 + 5$ or $4 \\times 6 = 20 + 4$?",
        steps: [
          "Work out the left side, which is the same in both: $4 \\times 6 = 24$.",
          "Work out the first right side: $20 + 5 = 25$. 25 is not 24, so the first equation is false.",
          "Work out the second right side: $20 + 4 = 24$. It matches the left side, so the second equation is true.",
        ],
        answer: "$4 \\times 6 = 20 + 4$",
      },
      methodTitle: "Value, value, compare",
      method: [
        "Work out the left side. Multiply before you add or subtract.",
        "Work out the right side the same way.",
        "Keep the equation only if the two numbers are equal. For three factors, multiply two of them, then multiply by the third.",
      ],
      formalTitle: "What makes an equation true",
      formal: [
        "An equation is true exactly when its two sides name the same number. Work out each side on its own, multiplying before adding or subtracting. Then compare.",
        "Factors give the same product in any order. It also does not matter which two you multiply first. So $2 \\times 6 \\times 3 = 6 \\times 3 \\times 2$, since both sides are 36.",
      ],
      pitfalls: [
        "Compare the values of the sides, not how the numbers look.",
        "Work out a sum and a difference separately. 20 + 4 = 24, but 20 − 4 = 16.",
        "Finish multiplying all three factors before you compare.",
      ],
      parentGuide:
        "Ask your learner to write the value under each side before deciding.",
    }),
    senses: {
      side: "side-of-equation",
      sides: "side-of-equation",
      factor: "factor-number",
      factors: "factor-number",
      product: "product-multiply",
      products: "product-multiply",
      difference: "difference-subtract",
      differences: "difference-subtract",
    },
    noLink: ["third"],
  },
];

export const operationSentenceFacetMappings: FacetMapping[] = [
  {
    templateId: "operation-sentence-choice",
    facetId: "multiplicative-stories.core",
    extent: "partial",
    rationale:
      "Choose the multiplication sentence for equal groups told in words, drawn as counters or as equal jumps on a number line (groups of at most 9), choose the sentence that cannot find the total, and choose the story for a multiplication expression. Does not assess writing a sentence, division stories with a quotient to find, or two-step stories.",
  },
  {
    templateId: "related-division-sentence",
    facetId: "division-facts.core",
    extent: "partial",
    rationale:
      "Choose the division sentence a multiplication fact within 81 helps solve, or the multiplication sentence that helps solve a division, including a divisor that is a multiple of ten. Does not assess computing the quotient, division with remainders, or fact fluency.",
  },
  {
    templateId: "related-subtraction-sentence",
    facetId: "addition-facts.core",
    extent: "partial",
    rationale:
      "Choose the subtraction sentence that an addition fact within 20 helps solve, among subtraction, addition, multiplication and division sentences. Does not assess computing the difference or recalling facts quickly.",
  },
  {
    templateId: "whole-number-equality-choice",
    facetId: "whole-number-equality.core",
    extent: "partial",
    rationale:
      "Choose the true equation when a product equals a sum or difference, or when two products of three factors are compared. Does not assess finding a missing factor, writing an equation, or explaining why an equation is true.",
  },
];
