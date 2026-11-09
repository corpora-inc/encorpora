import type { FacetMapping } from "./coverage";
import type { ProblemMethod } from "./problem-lessons";
import { chainLesson } from "./chain-lesson-kit";

const senses = {
  square: "square-number",
  squares: "square-number",
  product: "product-multiply",
  length: "modulus",
} as const;
const noLink = ["part", "parts", "plain", "result", "plane"];

export const complexClauseItemsMethods: Record<string, ProblemMethod> = {
  "complex-modulus-via-conjugate": {
    goal: "Choose the conjugate, the product with that conjugate, and the modulus as the square root of the product.",
    senses,
    noLink,
    intuition:
      "The conjugate of a complex number keeps the real part and flips the sign of the imaginary part. Their product is a positive real number, the square of the length from 0. The length itself is the square root of that product.",
    terms: ["complex-conjugate", "modulus"],
    method: [
      "Write the conjugate: same real part, opposite imaginary part.",
      "Multiply the number by that conjugate. The middle terms cancel, and $i^2=-1$ makes the result $a^2+b^2$.",
      "The modulus is the square root of that product. Simplify the root.",
    ],
    watch:
      "Do not flip the real part. Do not leave $i$ in the length. Take the square root: the product is the square of the length, not the length.",
  },
  "complex-axis-number-plot": {
    goal: "Plot a real number or a pure imaginary number at the matching point on the complex plane.",
    senses: { length: "modulus" },
    noLink,
    intuition:
      "A real number has imaginary part 0, so it sits on the across axis. A pure imaginary number has real part 0, so it sits on the up axis. The sign chooses right or left, up or down.",
    terms: ["complex-number", "modulus"],
    method: [
      "Read the real part as the across coordinate and the imaginary part as the up coordinate.",
      "If one part is 0, the point is on the other axis. Keep the sign of the nonzero part.",
      "Plot that one point. Swapping the coordinates moves the point onto the other axis.",
    ],
    watch:
      "Do not swap the coordinates. A negative imaginary number goes down, not left.",
  },
};

export const complexClauseItemsPrinciples: Record<string, string> = {
  "complex-modulus-via-conjugate":
    "For real $a$ and $b$, the conjugate of $a+bi$ is $a-bi$, and $(a+bi)(a-bi)=a^2+b^2=|a+bi|^2$. So $|a+bi|=\\sqrt{a^2+b^2}$, the nonnegative square root.",
  "complex-axis-number-plot":
    "The complex number $a+bi$ is the point $(a,b)$. A real number $a$ is $(a,0)$. A pure imaginary number $bi$ is $(0,b)$.",
};

export const complexClauseItemsLessons = [
  {
    senses,
    noLink,
    ...chainLesson({
      id: "complex-modulus-via-conjugate",
      title: "Modulus from the conjugate",
      summary:
        "The conjugate of $a+bi$ is $a-bi$. Their product is $a^2+b^2$, a real number with no $i$. That product is the square of the length from 0, so the length is its square root.",
      templateIds: ["complex-modulus-via-conjugate"],
      objectives: [
        "Write the conjugate by keeping the real part and flipping the imaginary sign.",
        "Use the product of a number and its conjugate to find the modulus.",
      ],
      openingTitle: "The product is the square of the length",
      opening: [
        "A complex number $a+bi$ has a real part $a$ and an imaginary part $b$. The letter $i$ is the number with $i^2=-1$.",
        "The conjugate flips only the sign of the imaginary part. For $5-12i$ the conjugate is $5+12i$.",
        "Multiply them and the middle terms cancel. Because $i^2=-1$, the product is $25+144=169$. The length is $\\sqrt{169}=13$.",
      ],
      example: {
        prompt:
          "Let $z=5-12i$. Choose the conjugate, the product $z\\bar z$, and the modulus $|z|$.",
        steps: [
          "The conjugate keeps 5 and flips the sign of $-12$: $\\bar z=5+12i$.",
          "Multiply $(5-12i)(5+12i)$. The cross terms $60i$ and $-60i$ cancel. $i^2=-1$ turns $-144i^2$ into $+144$.",
          "The product is $25+144=169$. Then $|z|=\\sqrt{169}=13$.",
        ],
        answer: "$5+12i$, $169$, and $13$",
      },
      methodTitle: "Flip, multiply, then take the root",
      method: [
        "Conjugate: same real part, opposite imaginary part.",
        "Product: $a^2+b^2$. The cross terms cancel and $i^2=-1$ adds the second square.",
        "Modulus: $\\sqrt{a^2+b^2}$ in simplest form. Do not leave the square, and do not leave an $i$.",
      ],
      formalTitle: "Why the product is the square of the length",
      formal: [
        "For real $a$ and $b$, $(a+bi)(a-bi)=a^2-(bi)^2=a^2-b^2i^2=a^2+b^2$.",
        "That is $|z|^2$. The modulus is the nonnegative square root, $|z|=\\sqrt{a^2+b^2}$.",
      ],
      pitfalls: [
        "Flipping the real part, or both parts. Only the imaginary sign changes.",
        "Treating $i^2$ as $+1$, which subtracts $b^2$ instead of adding it.",
        "Stopping at $a^2+b^2$, or writing the root with an $i$ still attached.",
      ],
      parentGuide:
        "Ask which sign flips, then what $i^2$ does to the last term. The product should be a positive real number before the square root.",
    }),
  },
  {
    senses: { length: "modulus" },
    noLink,
    ...chainLesson({
      id: "complex-axis-number-plot",
      title: "Real and imaginary numbers as points",
      summary:
        "A real number sits on the across axis. A pure imaginary number sits on the up axis. The sign tells which way to go, and the other coordinate is 0.",
      templateIds: ["complex-axis-number-plot"],
      objectives: [
        "Plot a nonzero real number on the real axis.",
        "Plot a nonzero pure imaginary number on the imaginary axis.",
      ],
      openingTitle: "One coordinate is zero",
      opening: [
        "The complex plane puts the real part across and the imaginary part up. The number $a+bi$ is the point $(a,b)$.",
        "A real number such as $-4$ has imaginary part 0, so the point is $(-4,0)$, on the across axis.",
        "A pure imaginary number such as $-3i$ has real part 0, so the point is $(0,-3)$, on the up axis and below 0.",
      ],
      example: {
        prompt: "Plot $-3i$ on the complex plane.",
        steps: [
          "$-3i$ is $0-3i$. The real part is 0 and the imaginary part is $-3$.",
          "Across 0 and down 3 lands on the imaginary axis.",
          "The point is $(0,-3)$. The point $(-3,0)$ would be the real number $-3$, not $-3i$.",
        ],
        answer: "$(0,-3)$",
      },
      methodTitle: "Read across, then up",
      method: [
        "Write the number as $a+bi$, even when one of $a$ or $b$ is 0.",
        "Plot $(a,b)$. A zero real part means the point is on the up axis.",
        "Keep the sign. Negative imaginary parts go down.",
      ],
      formalTitle: "Axis numbers",
      formal: [
        "The real number $a\\neq 0$ is the point $(a,0)$. The pure imaginary number $bi$, with $b\\neq 0$, is the point $(0,b)$.",
      ],
      pitfalls: [
        "Swapping the coordinates, so $-3i$ is plotted as $(-3,0)$.",
        "Dropping the sign and plotting a negative imaginary number above 0.",
      ],
      parentGuide:
        "Ask which part is zero. That coordinate stays 0, and the other coordinate keeps its sign.",
    }),
  },
];

export const complexClauseItemsFacetMappings: readonly FacetMapping[] = [
  {
    templateId: "complex-modulus-via-conjugate",
    facetId: "complex-conjugates.core",
    extent: "partial",
    rationale:
      "Choose the conjugate, the product of a number and its conjugate, and the modulus as the square root of that product, for nonzero real and imaginary parts. Does not assess division or a written proof.",
  },
  {
    templateId: "complex-axis-number-plot",
    facetId: "complex-plane.core",
    extent: "partial",
    rationale:
      "Plot a nonzero real number or a nonzero pure imaginary number on the complex plane. Does not assess off-axis points or polar form.",
  },
];
