import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";
import { act, f, graph, step } from "../math/scene/author";

export const quadraticIrrationalMethod: ProblemMethod = {
  goal: "Find both real roots of a quadratic in exact radical form.",
  terms: [
    ["quadratic", "An equation $ax^2 + bx + c = 0$ with $a \\ne 0$."],
    ["root", "A value of $x$ that makes the equation true."],
    [
      "discriminant",
      "The quantity $D = b^2 - 4ac$ under the square root in the quadratic formula.",
    ],
    [
      "plus or minus",
      "The symbol $\\pm$ requests both the plus case and the minus case.",
    ],
  ],
  method: [
    "Read the signed coefficients $a$, $b$ and $c$ after writing the equation equal to zero.",
    "Compute $D = b^2 - 4ac$, then substitute into $x = \\frac{-b \\pm \\sqrt{D}}{2a}$.",
    "Extract perfect-square factors from the root. Make the denominator positive and divide every numerator term and the denominator by any common factor.",
    "Keep both branches. Check by substitution or by their sum $-b/a$ and product $c/a$.",
  ],
  watch:
    "Divide the entire numerator by $2a$; cancel a factor only when it divides every numerator term and the denominator.",
};
export const quadraticIrrationalLesson: Lesson = {
  id: "quadratic-irrational-solutions",
  title: "Find exact roots with the quadratic formula",
  summary:
    "A quadratic can have roots that no fraction names exactly. A square-root expression keeps those solutions exact instead of rounding them.",
  templateIds: ["quadratic-irrational-solutions"],
  includeGeneratedRepresentation: false,
  objectives: [
    "Use signed coefficients in the quadratic formula.",
    "Simplify square roots and the complete fraction without rounding.",
    "Connect the two roots to a parabola's crossings of the horizontal axis.",
  ],
  sections: [
    {
      stage: "intuition",
      title: "Two values can make a quadratic zero",
      paragraphs: [
        "You need to solve linear equations, square signed numbers, and simplify fractions and square roots. A variable is a symbol for a number. A quadratic equation has the form $ax^2 + bx + c = 0$, where the coefficients $a$, $b$ and $c$ are numbers and $a \\ne 0$. A root, or solution, is a value of $x$ that makes the equation true.",
        "Some quadratics have roots that are irrational: they cannot be written as a fraction of two integers. A square-root expression keeps such a value exact. For example, $\\sqrt{10}$ is the nonnegative number whose square is 10; a rounded decimal changes its value.",
        "The discriminant $D=b^2-4ac$ is the number under the square root in the quadratic formula. The symbol $\\pm$ asks for both the plus case and the minus case.",
      ],
    },
    {
      stage: "method",
      title: "Use the quadratic formula",
      paragraphs: [
        "The quadratic formula is $x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$. The symbol $\\pm$ means take both the plus and minus cases. The discriminant is $D = b^2 - 4ac$. When $D$ is positive and not a perfect square, an integer-coefficient quadratic has two distinct irrational real roots.",
      ],
    },
  ],
  workedExample: {
    prompt: "Find both exact real solutions of $2x^2 + 4x - 3 = 0$.",
    steps: [
      "Read the coefficients: $a = 2$, $b = 4$, and $c = -3$. Thus $D = 4^2 - 4(2)(-3) = 16 + 24 = 40$.",
      "Substitute into the formula: $x = \\frac{-4 \\pm \\sqrt{40}}{4}$. Since $40 = 4 \\cdot 10$, $\\sqrt{40} = 2\\sqrt{10}$.",
      "Both numerator terms and the denominator share a factor of 2: $x = \\frac{-4 \\pm 2\\sqrt{10}}{4} = \\frac{-2 \\pm \\sqrt{10}}{2}$. There is no further common factor, because the radical term's coefficient is 1.",
      "Check without rounding: the original left side equals $2(x + 1)^2 - 5$. Each proposed root has $x + 1 = \\pm \\frac{\\sqrt{10}}{2}$, so $2(x + 1)^2 - 5 = 2 \\cdot \\frac{10}{4} - 5 = 0$.",
    ],
    answer:
      "$x = \\frac{-2 - \\sqrt{10}}{2}$ or $x = \\frac{-2 + \\sqrt{10}}{2}$",
  },
  closingSections: [
    {
      stage: "method",
      title: "See the two roots",
      paragraphs: [
        "The graph of $y = 2x^2 + 4x - 3$ is a parabola, a curve symmetric about a vertical line. Its horizontal-axis crossings have $y = 0$, so their horizontal coordinates solve the example. The two roots lie the same distance $\\sqrt{10}/2$ to either side of $x = -1$. The left crossing $L$ has horizontal coordinate $\\frac{-2-\\sqrt{10}}{2}$; the right crossing $R$ has horizontal coordinate $\\frac{-2+\\sqrt{10}}{2}$. The plotted positions are approximate; these coordinate formulas are exact.",
      ],
      illustration: "quadratic-irrational-crossings",
    },
    {
      stage: "formal",
      title: "Why the formula preserves every root",
      paragraphs: [
        "For $a \\ne 0$, multiply $ax^2 + bx + c = 0$ by $4a$ and rearrange: $4a^2x^2 + 4abx = -4ac$. Add $b^2$ to both sides: $(2ax + b)^2 = b^2 - 4ac$. These operations are reversible.",
        "If $D = b^2 - 4ac > 0$, then $2ax + b = \\sqrt{D}$ or $2ax + b = -\\sqrt{D}$. Subtract $b$ and divide by $2a$ to obtain $x = \\frac{-b \\pm \\sqrt{D}}{2a}$. A negative $a$ changes the order of the two values, but both are included.",
        "For $D = 0$, the two branches agree, giving one repeated root. For $D < 0$, no real number has square $D$, so there are no real roots. With integer coefficients and positive nonsquare $D$, the radical remains irrational. Simplify by extracting square factors and cancelling factors of the whole fraction, never by cancelling only one numerator term.",
      ],
    },
  ],
  pitfalls: [
    "Keep a negative coefficient in parentheses when squaring or multiplying it.",
    "Use the opposite of $b$ in the numerator and divide both numerator terms by $2a$.",
    "Keep both square-root branches and retain exact radicals instead of decimal approximations.",
  ],
  parentGuide:
    "Ask why $\\sqrt{40} = 2\\sqrt{10}$ and why the two numerator terms must both share a factor before cancellation. Use the graph to locate both roots around $x = -1$.",
};
export const quadraticIrrationalIllustrations = {
  "quadratic-irrational-crossings": graph({
    id: "irrational",
    x: [-4, 2],
    y: [-6, 4],
    grid: 1,
  })
    .curve(f.poly(2, 4, -3), { color: "accent" })
    .line({ a: 1, b: 0, c: -1 }, { color: "warm", dash: "dash" })
    .point(-1 - Math.sqrt(10) / 2, 0, "L")
    .point(-1 + Math.sqrt(10) / 2, 0, "R")
    .scene({
      maxHeight: 240,
      title:
        "The parabola crosses the horizontal axis at both exact roots. The dashed line through negative one is the axis of symmetry.",
      steps: [
        step(
          "A root makes the vertical coordinate zero. Find the two horizontal-axis crossings.",
          act.trace("irrational.curve.0"),
        ),
        step(
          "Both roots are equally far from the dashed symmetry line.",
          act.highlight("irrational.point.0"),
          act.highlight("irrational.point.1"),
          act.highlight("irrational.line.0"),
        ),
      ],
    }),
};
