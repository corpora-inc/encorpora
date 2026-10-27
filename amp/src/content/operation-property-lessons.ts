import type { FacetMapping } from "./coverage";
import type { ProblemMethod } from "./problem-lessons";
import { chainLesson } from "./chain-lesson-kit";

export const operationPropertyMethods: Record<string, ProblemMethod> = {
  "operation-property-identify": {
    goal: "Match an equation to the property of addition or multiplication it shows, or name the property.",
    intuition:
      "A property is a rule that is always true. Some rules say that changing the order, the grouping or a 0 or 1 does not change the answer. To spot which rule an equation shows, compare its left side with its right side and ask what changed.",
    terms: [
      [
        "identity property",
        "Adding 0 or multiplying by 1 leaves a number the same.",
      ],
      [
        "commutative property",
        "Two numbers can swap places in a sum or a product and the result is the same.",
      ],
      [
        "associative property",
        "Three numbers in a sum or a product can be grouped in a different way and the result is the same.",
      ],
      [
        "distributive property",
        "A factor times a sum equals the factor times each addend, added together.",
      ],
    ],
    method: [
      "Write down what is different between the left side and the right side: the order, the grouping, a 0 or a 1, or a factor spread over a sum.",
      "Match that one change to its property: swapped order is commutative, moved parentheses are associative, a 0 or a 1 is identity, a factor spread over a sum is distributive.",
      "Check the operation the question names: the same change can be shown with addition or with multiplication.",
    ],
    watch:
      "Do not choose an equation just because it is true. Every choice may be true; only one shows the named property and the named operation.",
  },
};

export const operationPropertyPrinciples: Record<string, string> = {
  "operation-property-identify":
    "For all numbers $a$, $b$, $c$: $a+0=a$ and $a\\times1=a$ (identity); $a+b=b+a$ and $a\\times b=b\\times a$ (commutative); $(a+b)+c=a+(b+c)$ and $(a\\times b)\\times c=a\\times(b\\times c)$ (associative); $a\\times(b+c)=a\\times b+a\\times c$ (distributive). Subtraction and division do not have the commutative or associative properties.",
};

export const operationPropertyLessons = [
  chainLesson({
    id: "operation-property-names",
    title: "Naming the properties of operations",
    summary:
      "Tell the identity, commutative, associative and distributive properties apart by what changes between the two sides.",
    templateIds: ["operation-property-identify"],
    objectives: [
      "Say what each of the four properties changes and what it keeps the same.",
      "Choose the equation that shows a named property, or name the property an equation shows.",
    ],
    openingTitle: "Compare the two sides",
    opening: [
      "A property of operations is a rule that works for every number. Each rule lets you change one thing in an expression without changing its value: the order, the grouping, or a 0 or 1.",
      "When a question gives an equation, do not calculate first. Look at the left side and the right side and find the one thing that is different. That difference names the property.",
    ],
    example: {
      prompt:
        "Which property does $(2\\times5)\\times3=2\\times(5\\times3)$ show?",
      steps: [
        "The numbers 2, 5 and 3 are in the same order on both sides.",
        "Only the parentheses moved: on the left 2 and 5 are grouped, on the right 5 and 3 are grouped.",
        "Regrouping three factors without changing the product is the associative property of multiplication.",
      ],
      answer: "The associative property of multiplication",
    },
    methodTitle: "From the change to the name",
    method: [
      "Swapped order of two numbers: commutative. Moved parentheses with the order kept: associative. Combined with 0 in a sum or with 1 in a product: identity. One factor multiplied over a sum: distributive.",
      "Then read the operation. $2+5=5+2$ is commutative for addition; $2\\times5=5\\times2$ is commutative for multiplication.",
    ],
    formalTitle: "The four properties",
    formal: [
      "For all numbers $a$, $b$ and $c$: $a+0=a$, $a\\times1=a$, $a+b=b+a$, $a\\times b=b\\times a$, $(a+b)+c=a+(b+c)$, $(a\\times b)\\times c=a\\times(b\\times c)$ and $a\\times(b+c)=a\\times b+a\\times c$.",
      "Subtraction and division are not commutative or associative: $5-2\\ne2-5$ and $(8-4)-2\\ne8-(4-2)$.",
    ],
    pitfalls: [
      "Moving parentheses is associative; swapping order is commutative. If the order of the numbers changes, it is not associative.",
      "An equation can be true without showing the named property. Check what changed, not only whether the sides are equal.",
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
