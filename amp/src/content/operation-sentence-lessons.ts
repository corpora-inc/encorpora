import type { FacetMapping } from "./coverage";
import type { ProblemMethod } from "./problem-lessons";
import { chainLesson } from "./chain-lesson-kit";

export const operationSentenceMethods: Record<string, ProblemMethod> = {
  "operation-sentence-choice": {
    goal: "Choose the number sentence for equal groups told in a story, drawn as groups or as jumps, or judge which sentence cannot find the total.",
    intuition:
      "When every group has the same number of things, the total is found by joining the equal groups. That is multiplication, and repeated addition of the group size says the same thing. A sentence fits when it uses the number of groups and the size of each group to give the total.",
    terms: [
      ["equal groups", "Groups that each hold the same number of things."],
      [
        "number sentence",
        "An equation made of numbers and an operation, with $n$ standing for the number to find.",
      ],
    ],
    method: [
      "Find the number of groups and the size of each group in the story, the picture or the jumps.",
      "Choose the sentence that joins that many equal groups: multiplication or repeated addition, or division that uses the total.",
      "Check each other sentence: adding, subtracting or dividing the two given numbers does not give the total.",
    ],
    watch:
      "Adding the number of groups to the group size is a common slip. Ask whether the sentence repeats the group size once for each group.",
  },
  "related-division-sentence": {
    goal: "Choose the division sentence a multiplication fact helps solve, or the multiplication sentence that helps solve a division, including tens.",
    intuition:
      "Multiplication and division undo each other. A multiplication fact has two factors and a product, and the product is the number that division starts from. A division sentence asks which factor makes the product.",
    terms: [
      [
        "factor",
        "A number that is multiplied, such as 6 and 7 in $6 \\times 7$.",
      ],
      [
        "product",
        "The result of multiplying, such as 42 in $6 \\times 7 = 42$.",
      ],
    ],
    method: [
      "Name the product and the factors, or the total and the divisor in a division sentence.",
      "For a fact, divide the product by one factor. For a division, write a multiplication with the divisor times the unknown equal to the total.",
      "With a multiple of ten, keep the whole divisor: 40, not 4.",
    ],
    watch:
      "The product always comes first in the division and last in the multiplication. A sentence that starts from a factor does not use the fact.",
  },
  "related-subtraction-sentence": {
    goal: "Choose the subtraction sentence that an addition fact within 20 helps solve, among subtraction, addition, multiplication and division.",
    intuition:
      "An addition fact joins two parts to make a whole. Subtraction undoes it: take one part away from the whole and the other part is left.",
    terms: [
      ["part", "One of the two numbers that are added."],
      ["whole", "The sum of the two parts."],
    ],
    method: [
      "Name the two parts and the whole in the addition fact.",
      "Write a subtraction that starts with the whole and takes away one part.",
      "Check that the sentence uses subtraction and that the whole is the first number.",
    ],
    watch:
      "Subtracting the whole from a part, or one part from the other, does not use the fact. The whole is always the number you start from.",
  },
  "true-equation-choice": {
    goal: "Choose the one true equation when a product equals a sum or difference, or when two products of three factors are compared.",
    intuition:
      "The equal sign says both sides have the same value. To test an equation, work out the value of each side separately and compare. A product and a sum can be equal even though they use different operations.",
    terms: [
      ["equation", "A statement that two expressions have the same value."],
      ["side", "The expression on the left or on the right of the equal sign."],
    ],
    method: [
      "Work out the value of the left side, then of the right side, one operation at a time.",
      "Compare the two values. Keep the equation only if they match.",
      "With three factors, multiply the first two and then multiply by the third.",
    ],
    watch:
      "Do not stop after the first operation. Evaluate the whole of each side, then compare.",
  },
};

export const operationSentencePrinciples: Record<string, string> = {
  "operation-sentence-choice":
    "$g$ equal groups of $s$ have a total $n = g \\times s = s \\times g = s + s + \\dots + s$ with $g$ terms. Then $n \\div s = g$ and $n \\div g = s$. Sentences that use only $g + s$, $g - s$ or $g \\div s$ describe a different quantity.",
  "related-division-sentence":
    "If $a \\times b = c$ with $a \\ne 0$ and $b \\ne 0$, then $c \\div a = b$ and $c \\div b = a$. Conversely $c \\div a = n$ means $a \\times n = c$. These hold because division is the inverse of multiplication by a nonzero number.",
  "related-subtraction-sentence":
    "If $a + b = c$ then $c - a = b$ and $c - b = a$. Subtraction is the inverse of addition, so each part is the whole minus the other part.",
  "true-equation-choice":
    "An equation $L = R$ is true exactly when $L$ and $R$ have the same value. Multiplication is evaluated before addition or subtraction, and a product of three factors does not depend on the order or grouping of the factors.",
};

export const operationSentenceLessons = [
  chainLesson({
    id: "operation-sentence-choice",
    title: "Choose the sentence that fits equal groups",
    summary:
      "Match a story, a picture of groups or equal jumps on a number line to the number sentence that finds the total.",
    templateIds: ["operation-sentence-choice"],
    objectives: [
      "Choose the multiplication sentence for equal groups told in words, drawn as groups or drawn as equal jumps.",
      "Tell which sentence cannot find the total of equal groups, and choose the story that a multiplication expression describes.",
    ],
    openingTitle: "Equal groups are joined",
    opening: [
      "When each box, page or jump is the same size, the total comes from joining equal groups. Four boxes with six flowers each is $4 \\times 6$, and it is also $6 + 6 + 6 + 6$.",
      "A picture or a number line shows the same groups. Count how many groups there are and how big each one is, then write the sentence with those two numbers.",
    ],
    example: {
      prompt:
        "A number line shows 4 equal jumps of 6 starting at 0. Which sentence finds where the last jump lands?",
      steps: [
        "There are 4 jumps and each jump is 6 long.",
        "Joining 4 equal jumps of 6 is $4 \\times 6 = n$.",
        "Adding 4 and 6 would count only one jump of 6 and 4 more, so $4 + 6 = n$ does not fit.",
        "The last jump lands on $4 \\times 6 = 24$.",
      ],
      answer: "$4 \\times 6 = n$, and $n = 24$",
    },
    methodTitle: "Groups, size, operation",
    method: [
      "Find the number of groups and the size of one group. Use only the picture or story to find them.",
      "Pick the sentence that joins that many groups of that size. Repeated addition and multiplication in either order describe it, and so does dividing the total by one of the two numbers.",
      "To find a sentence that cannot work, test each one the same way and keep the one that does not give the total.",
    ],
    formalTitle: "Why several sentences fit",
    formal: [
      "$g$ groups of $s$ have total $g \\times s$. Multiplication can be done in either order, so $s \\times g$ is the same total, and repeated addition of $s$ taken $g$ times is how multiplication is defined.",
      "Dividing the total $n$ by $s$ recovers the number of groups $g$, and dividing by $g$ recovers the size $s$, because division undoes multiplication.",
    ],
    pitfalls: [
      "Adding the number of groups to the group size finds neither the total nor a group count.",
      "A division sentence that has the total as the divisor does not fit equal groups.",
      "Choose a story for a multiplication expression by looking for equal groups, not for the same numbers.",
    ],
    parentGuide:
      "Ask your learner to say how many groups and how many in each group before choosing a sentence.",
  }),
  chainLesson({
    id: "related-facts-sentences",
    title: "Use a fact to choose the related sentence",
    summary:
      "Choose the division, multiplication or subtraction sentence that a known fact helps solve.",
    templateIds: ["related-division-sentence", "related-subtraction-sentence"],
    objectives: [
      "Choose the division sentence that a multiplication fact helps solve, and the multiplication that helps solve a division, including division by a multiple of ten.",
      "Choose the subtraction sentence that an addition fact within 20 helps solve.",
    ],
    openingTitle: "Facts come in families",
    opening: [
      "Three numbers can be linked in several ways. From $6 \\times 7 = 42$ you can get $42 \\div 6 = 7$ and $42 \\div 7 = 6$. From $8 + 5 = 13$ you can get $13 - 8 = 5$ and $13 - 5 = 8$.",
      "The key is the biggest number: the product in a multiplication fact and the whole in an addition fact. It is the number division or subtraction starts from.",
    ],
    example: {
      prompt:
        "You know $40 \\times 6 = 240$. Which multiplication sentence helps you find $n$ in $240 \\div 40 = n$?",
      steps: [
        "$240 \\div 40 = n$ asks: 40 times what number makes 240?",
        "Write that as $40 \\times n = 240$, with the total 240 as the product.",
        "Since $4 \\times 6 = 24$, $40 \\times 6 = 240$ and $n = 6$.",
      ],
      answer: "$40 \\times n = 240$, and $n = 6$",
    },
    methodTitle: "Start from the biggest number",
    method: [
      "Find the product or the whole. It is the number that division or subtraction begins with.",
      "Write the division or subtraction that starts there and uses one of the other two numbers.",
      "For a division sentence, write the multiplication with the divisor as a factor and the total as the product. Keep every digit of a divisor that is a multiple of ten.",
    ],
    formalTitle: "Inverse operations",
    formal: [
      "If $a \\times b = c$ with nonzero $a$ and $b$, then $c \\div a = b$ and $c \\div b = a$, because division undoes multiplication.",
      "If $a + b = c$, then $c - a = b$ and $c - b = a$, because subtraction undoes addition. Each pair of operations gives two sentences from one fact.",
    ],
    pitfalls: [
      "Dividing one factor by the other, or the factor by the product, does not use the fact.",
      "Do not drop the zero when dividing by 40, 50 or another multiple of ten.",
      "A subtraction sentence starts from the whole, not from a part.",
    ],
    parentGuide:
      "Write three numbers in a triangle with the biggest on top and ask your learner to read off the family.",
  }),
  chainLesson({
    id: "true-equation-choice",
    title: "Find the true equation",
    summary:
      "Evaluate both sides of an equation with products, sums, differences and three factors to find the one that is true.",
    templateIds: ["true-equation-choice"],
    objectives: [
      "Decide whether an equation with a product on one side and a sum or difference on the other is true.",
      "Compare two products of three factors by evaluating each side.",
    ],
    openingTitle: "The equal sign means the same value",
    opening: [
      "An equation is true when both sides have the same value. It does not matter that one side is a product and the other is a sum.",
      "Work out the left side. Work out the right side. If the numbers match, the equation is true; if not, it is false.",
    ],
    example: {
      prompt:
        "Which equation is true: $4 \\times 6 = 20 + 5$ or $4 \\times 6 = 20 + 4$?",
      steps: [
        "Left side: $4 \\times 6 = 24$.",
        "First right side: $20 + 5 = 25$. It is not 24.",
        "Second right side: $20 + 4 = 24$. It is 24.",
      ],
      answer: "$4 \\times 6 = 20 + 4$",
    },
    methodTitle: "Value, value, compare",
    method: [
      "Evaluate the left side, doing multiplication before addition or subtraction.",
      "Evaluate the right side the same way.",
      "Keep the equation only if the two values are equal. For three factors, multiply two and then multiply by the third.",
    ],
    formalTitle: "What makes an equation true",
    formal: [
      "$L = R$ is true exactly when $L$ and $R$ name the same number. Evaluate each side separately with the order of operations, then compare.",
      "A product of factors does not depend on the order or grouping of the factors, so $2 \\times 6 \\times 3 = 6 \\times 3 \\times 2$.",
    ],
    pitfalls: [
      "Do not compare the sides by looking at the numbers; compare their values.",
      "A sum and a difference with the same numbers have different values.",
      "Finish multiplying all three factors before comparing.",
    ],
    parentGuide:
      "Ask your learner to write the value under each side before deciding.",
  }),
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
    templateId: "true-equation-choice",
    facetId: "missing-factor.core",
    extent: "partial",
    rationale:
      "Choose the true equation when a product equals a sum or difference, or when two products of three factors are compared. Does not assess finding a missing factor, writing an equation, or explaining why an equation is true.",
  },
];
