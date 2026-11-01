import type { FacetMapping } from "./coverage";
import type { ProblemMethod } from "./problem-lessons";
import { chainLesson } from "./chain-lesson-kit";

export const operationPropertyMethods: Record<string, ProblemMethod> = {
  "operation-property-identify": {
    goal: "Match an equation to the property of addition or multiplication it shows, or name the property.",
    intuition:
      "An equation is a number sentence with an equals sign, like 2 + 5 = 5 + 2. The part left of = is its left side, and the part right of = is its right side. A property is a rule that works for every number. Swapping the order, as in 2 + 5 = 5 + 2, is the commutative property. Moving the parentheses, the curved marks ( ) that show what to work out first, is the associative property. Adding 0 or multiplying by 1 leaves a number the same: that is the identity property. Multiplying a sum, an addition, by multiplying each part and adding is the distributive property: 5 × (2 + 7) = 5 × 2 + 5 × 7.",
    terms: [
      "identity-property",
      "commutative-property",
      "associative-property",
      "distributive-property",
    ],
    senses: { side: "side-of-equation", factor: "factor-number" },
    method: [
      "Find what is different between the left side and the right side: the order, the parentheses, a 0 or a 1, or a number multiplied over a sum.",
      "Match that one change to its name. Swapped order: commutative. Moved parentheses: associative. Adding 0 or multiplying by 1: identity. A number multiplied over a sum: distributive.",
      "Check the operation the question names. The same change can happen with addition or with multiplication.",
    ],
    watch:
      "Do not choose an equation just because it is true. All the choices may be true, but only one shows the named property with the named operation.",
  },
};

export const operationPropertyPrinciples: Record<string, string> = {
  "operation-property-identify":
    "For all numbers $a$, $b$ and $c$: $a+0=a$ and $a\\times1=a$ (identity); $a+b=b+a$ and $a\\times b=b\\times a$ (commutative); $(a+b)+c=a+(b+c)$ and $(a\\times b)\\times c=a\\times(b\\times c)$ (associative); $a\\times(b+c)=a\\times b+a\\times c$ (distributive). Subtraction and division do not have the commutative or associative properties.",
};

export const operationPropertyLessons = [
  chainLesson({
    id: "operation-property-names",
    title: "Naming the properties of operations",
    summary:
      "Some rules about adding and multiplying are true for every number. Each rule changes one thing but keeps the answer the same. To name a rule, compare the two sides of an equation and find what changed.",
    senses: { side: "side-of-equation", factor: "factor-number" },
    templateIds: ["operation-property-identify"],
    objectives: [
      "Say what each of the four properties, the four rules, changes and what it keeps the same.",
      "Choose the equation that shows a named property, or name the property an equation shows.",
    ],
    openingTitle: "Compare the two sides",
    opening: [
      "An equation is a number sentence with an equals sign, like 2 + 5 = 5 + 2. The part left of = is the left side. The part right of = is the right side.",
      "A property is a rule that works for every number. Each property lets you change one thing without changing the answer.",
      "Swap the order: 2 + 5 = 5 + 2, and both sides make 7. Swapping the order is called the commutative property.",
      "Parentheses are the curved marks ( ) that show what to work out first. Move them: (2 × 5) × 3 = 2 × (5 × 3), and both sides make 30. The numbers stay in the same order. Moving the parentheses is called the associative property.",
      "Add 0 or multiply by 1: 7 + 0 = 7 and 7 × 1 = 7. The number stays the same. This is called the identity property.",
      "A factor is a number you multiply, and a sum is an addition. Multiply a sum, or multiply each part and add: 5 × (2 + 7) = 5 × 2 + 5 × 7. Both sides make 45. This is called the distributive property.",
      "When a question gives an equation, do not work it out first. Find the one thing that is different between the two sides. That difference names the property.",
    ],
    example: {
      prompt:
        "Which property does $(2\\times5)\\times3=2\\times(5\\times3)$ show?",
      steps: [
        "Compare the order first. The numbers 2, 5 and 3 are in the same order on both sides, so it is not the commutative property.",
        "Only the parentheses moved. On the left, 2 and 5 are grouped. On the right, 5 and 3 are grouped.",
        "Moving the parentheses without changing the product, the answer, is the associative property. The operation is multiplication.",
      ],
      answer: "The associative property of multiplication",
    },
    methodTitle: "From the change to the name",
    method: [
      "Swapped order of two numbers: commutative. Moved parentheses with the order kept: associative. Adding 0 or multiplying by 1: identity. One factor multiplied over a sum: distributive.",
      "Then read the operation. $2+5=5+2$ is commutative for addition. $2\\times5=5\\times2$ is commutative for multiplication.",
    ],
    formalTitle: "The four properties",
    formal: [
      "For all numbers $a$, $b$ and $c$: $a+0=a$, $a\\times1=a$, $a+b=b+a$, $a\\times b=b\\times a$, $(a+b)+c=a+(b+c)$, $(a\\times b)\\times c=a\\times(b\\times c)$ and $a\\times(b+c)=a\\times b+a\\times c$.",
      "Subtraction and division do not follow the commutative or associative property. The sign $\\ne$ means “is not equal to”: $5-2\\ne2-5$ and $(8-4)-2\\ne8-(4-2)$.",
    ],
    pitfalls: [
      "Moving parentheses is associative. Swapping order is commutative. If the order of the numbers changes, it is not associative.",
      "An equation can be true without showing the named property. Check what changed, not only whether the two sides are equal.",
      "Addition and multiplication versions look alike. Read which operation the question names.",
    ],
    parentGuide:
      "Ask your learner to point at the one thing that is different between the two sides, then say its name.",
  }),
];

export const operationPropertyFacetMappings: FacetMapping[] = [
  {
    templateId: "operation-property-identify",
    facetId: "operation-properties.core",
    extent: "partial",
    rationale:
      "Single choice among seven equations or names for the identity, commutative and associative properties of addition and multiplication and the distributive property of multiplication over addition, with whole numbers 2 to 9. Does not assess using a property to simplify a calculation, the zero property, or explaining why a property holds.",
  },
];
