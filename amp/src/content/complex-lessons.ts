import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

export const complexMethods: Record<string, ProblemMethod> = {
  "complex-multiplication": {
    goal: "Given two complex numbers with small signed integer coefficients, choose their exact product.",
    intuition:
      "The number $i$ has the special rule $i^2=-1$. A complex number adds a real number and a multiple of $i$, such as $2+3i$. To multiply two of them, multiply every term in one parentheses by every term in the other, then replace $i^2$ by −1.",
    terms: [
      ["real part", "The ordinary number in $a+bi$; it is $a$."],
      [
        "imaginary part",
        "The real coefficient $b$ of $i$ in $a+bi$; $bi$ is the imaginary term.",
      ],
      [
        "distributive property",
        "Multiply each term of one sum by each term of the other sum, then add the products.",
      ],
    ],
    method: [
      "Multiply the real terms, the two cross pairs, and the two terms containing $i$.",
      "Use $i^2=-1$ to turn the last product into a real number.",
      "Add the real numbers and add the coefficients of $i$ separately. If one part is zero, write only the nonzero part.",
    ],
    watch:
      "The product of two $i$ terms is real: multiply their coefficients, then reverse that product's sign because $i^2=-1$. Include both cross products in the coefficient of $i$.",
  },
};

export const complexPrinciples: Record<string, string> = {
  "complex-multiplication":
    "For real numbers $a$, $b$, $c$, and $d$, distributivity and $i^2=-1$ give $(a+bi)(c+di)=(ac-bd)+(ad+bc)i$. Equality requires both real parts and both coefficients of $i$ to match.",
};

export const complexLessons: Lesson[] = [
  {
    id: "complex-multiplication",
    title: "Multiply complex numbers",
    summary:
      "The special number $i$ has $i^2=-1$. Multiply all four pairs of terms, then collect ordinary numbers and multiples of $i$.",
    templateIds: ["complex-multiplication"],
    objectives: [
      "Distribute across two sums that contain $i$.",
      "Use $i^2=-1$ and write the exact product as a real part plus a multiple of $i$.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "A new number with one useful rule",
        paragraphs: [
          "You need to multiply signed whole numbers and distribute one sum across another. No real number squares to −1. The number $i$ is defined so that $i^2=-1$. A complex number has the form $a+bi$: $a$ is its real part, $b$ is its imaginary part, and $bi$ is the imaginary term. The values $a$ and $b$ can be zero or negative.",
          "Multiplying complex numbers uses ordinary distribution. Two copies of $i$ multiply to −1, so an $i^2$ term becomes real and its coefficient changes sign.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "Multiply $(2+3i)(4-i)$ and write the product as a real part plus a multiple of $i$.",
      steps: [
        "Multiply each term in the first parentheses by each term in the second: $2\\cdot4=8$, $2\\cdot(-i)=-2i$, $3i\\cdot4=12i$, and $3i\\cdot(-i)=-3i^2$.",
        "Use $i^2=-1$: $-3i^2=-3(-1)=3$. The real products total $8+3=11$.",
        "The terms with one $i$ total $-2i+12i=10i$. The product is $11+10i$.",
        "Check by distributing again: $2(4-i)=8-2i$ and $3i(4-i)=12i-3i^2$. Since $-3i^2=3$, the real part is 11 and the imaginary part is 10.",
      ],
      answer: "$11+10i$",
    },
    closingSections: [
      {
        stage: "method",
        keepTogetherInPrint: true,
        title: "See the four products",
        paragraphs: [
          "The top row multiplies 2 by each term of $4-i$; the bottom row does the same with $3i$. The bottom-right product is $3i(-i)=-3i^2=3$ because $i^2=-1$. The two cross products total $-2i+12i=10i$.",
          "$\\begin{array}{cc}2\\cdot4=8 & 2(-i)=-2i \\\\ (3i)4=12i & (3i)(-i)=3\\end{array}$",
          "For any two sums containing $i$, make all four products. Replace $i^2$ by −1, add the real terms, and add the terms with one $i$.",
        ],
      },
      {
        stage: "formal",
        title: "Why the rule works",
        paragraphs: [
          "For real numbers $a$, $b$, $c$, and $d$, distribution gives $(a+bi)(c+di)=ac+adi+bci+bdi^2$. Since $i^2=-1$, this equals $(ac-bd)+(ad+bc)i$. Here $ac-bd$ is the real part and $ad+bc$ is the imaginary part, the coefficient of $i$.",
          "Every complex number can be written as $x+yi$ with real $x$ and $y$. Two such numbers are equal exactly when their real parts match and their coefficients of $i$ match. The multiplication identity holds for all real coefficients.",
        ],
      },
    ],
    pitfalls: [
      "Replace $i^2$ with −1, not 1 or $i$.",
      "Multiply all four pairs and add both terms containing one $i$.",
      "Keep a negative coefficient's sign when grouping the real and imaginary parts.",
    ],
    parentGuide:
      "Ask the learner to name the four products in $(2+3i)(4-i)$ and explain why the last one adds 3 to the real part.",
  },
];
