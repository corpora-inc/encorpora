import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

export const regentsGapMethods: Record<string, ProblemMethod> = {
  "rg-exponential-base-rate": {
    goal: "Read the percent change per period from an exponential model's base and exponent, or build a model from a half-life.",
    intuition:
      "In a model such as $y=a\\cdot b^{t}$, the quantity is multiplied by the base $b$ once for each period. A base of 1.038 keeps all of the quantity and adds 3.8% of it. A base of 0.85 keeps 85% of it, so 15% is lost.",
    terms: [
      [
        "base",
        "The number $b$ that is raised to a power in $a\\cdot b^{t}$. It is the factor applied each period.",
      ],
      [
        "half-life",
        "The time in which a decaying quantity falls to half of its value.",
      ],
    ],
    method: [
      "Compare the base with 1. Above 1 the quantity grows; below 1 it decays.",
      "Subtract to find the rate: $|b-1|$. Move the decimal point two places to write it as a percent.",
      "Look at the exponent. If it is $t/k$, the change happens once every $k$ time units, not once per unit.",
      "For a half-life $h$, use the base 0.5 with exponent $t/h$.",
    ],
    watch:
      "The base 1.038 means a 3.8% increase, not 1.038% or 38%. The exponent $t/4$ makes the change happen once every 4 units; it does not multiply the percent by 4.",
  },
  "rg-factor-completely": {
    goal: "Factor a difference of squares that has a coefficient, a common factor, or two variables, until no factor can be factored again.",
    intuition:
      "Factoring rewrites an expression as a product. First pull out any factor shared by every term. Then check whether what is left is a difference of two perfect squares, which factors as $a^{2}-b^{2}=(a-b)(a+b)$. Factoring is complete when no factor can be factored further.",
    terms: [
      [
        "common factor",
        "A number or variable that divides every term. Pulling it out leaves the other factor in parentheses.",
      ],
      [
        "difference of squares",
        "Two perfect squares that are subtracted, such as $4x^{2}-25=(2x)^{2}-5^{2}$.",
      ],
    ],
    method: [
      "Find the greatest common factor of all the terms, including variables, and pull it out.",
      "Write each remaining term as a square, such as $4x^{2}=(2x)^{2}$.",
      "Apply $a^{2}-b^{2}=(a-b)(a+b)$ and keep the common factor in front.",
      "Multiply back to check the result.",
    ],
    watch:
      "A factor written outside is not squared with the terms: $4(x-5)(x+5)$ multiplies to $4x^{2}-100$, not $4x^{2}-25$. Stop only when no binomial left is a difference of squares.",
  },
  "rg-polynomial-zeros-forms": {
    goal: "Find the zeros of a product with a nonmonic factor, or a zero of an expanded cubic by factoring by grouping.",
    intuition:
      "A zero of a function is an input that makes the output 0. A product is 0 only when one of its factors is 0, so each factor gives a zero. For a factor such as $3x+2$, solve $3x+2=0$ and get $-\\frac{2}{3}$. An expanded cubic with four terms can sometimes be factored by grouping its terms in pairs.",
    terms: [
      [
        "zero-product property",
        "If a product of numbers is 0, at least one of the numbers is 0.",
      ],
      [
        "grouping",
        "Splitting a polynomial into pairs of terms, factoring each pair, and pulling out the binomial the pairs share.",
      ],
    ],
    method: [
      "If the function is a product, set each factor equal to 0, including a factor that is only $x$.",
      "Solve each factor completely. For $ax+b=0$ the zero is $-\\frac{b}{a}$.",
      "If the cubic is expanded, group the first two terms and the last two terms and factor each pair.",
      "Pull out the shared binomial, factor what is left, and read each zero from its factor.",
    ],
    watch:
      "The zero of $3x+2$ is $-\\frac{2}{3}$, not $-2$ or $-\\frac{3}{2}$. A factor that is just $x$ gives the zero 0.",
  },
  "rg-exponent-monomial-power": {
    goal: "Simplify a monomial with a coefficient and two variables raised to a power, alone or times another monomial.",
    intuition:
      "A power of a product repeats the whole product: $(2x^{3})^{2}=2x^{3}\\cdot2x^{3}$. Every factor inside gets the power. The coefficient is multiplied by itself, and each exponent is multiplied by the power.",
    terms: [
      [
        "coefficient",
        "The number that multiplies the variables in a term, such as 3 in $3x^{2}y$.",
      ],
      [
        "monomial",
        "A product of a number and variables with whole-number exponents.",
      ],
    ],
    method: [
      "Raise the coefficient to the outer power by multiplying it by itself that many times.",
      "Multiply each exponent inside the parentheses by the outer power.",
      "If another monomial follows, multiply the coefficients and add the exponents of the same variable.",
    ],
    watch:
      "$(3x)^{3}$ is $27x^{3}$, not $9x^{3}$ or $3x^{3}$. The coefficient is cubed, not tripled.",
  },
  "rg-rational-exponent-forms": {
    goal: "Combine rational powers, write a fraction with a negative rational exponent in radical form, or find its value.",
    intuition:
      "A rational exponent $\\frac{p}{q}$ means a root and a power: $x^{p/q}$ is the $q$-th root of $x^{p}$. A negative exponent means the reciprocal. Radicals combine most easily after they are written as powers of the same base.",
    terms: [
      [
        "index",
        "The small number $q$ in $\\sqrt[q]{\\ }$ that tells which root is taken. A square root has index 2.",
      ],
      [
        "rational exponent",
        "An exponent that is a fraction. The denominator is the root and the numerator is the power.",
      ],
    ],
    method: [
      "Write each radical as a power: $\\sqrt[q]{x}=x^{1/q}$.",
      "To multiply, multiply the coefficients and add the exponents, using a common denominator.",
      "For a negative exponent, flip the fraction and make the exponent positive.",
      "Read an exponent $\\frac{p}{q}$ as the $q$-th root of the $p$-th power.",
    ],
    watch:
      "Add exponents as fractions: $\\frac{1}{3}+\\frac{1}{2}=\\frac{5}{6}$, not $\\frac{2}{5}$. A negative exponent does not make the value negative.",
  },
  "rg-polynomial-build": {
    goal: "Build a polynomial from its degree, number of terms, leading coefficient and constant term, or read them from one.",
    intuition:
      "A polynomial is a sum of terms, each a number times a whole-number power of $x$. The degree is the highest exponent. The leading coefficient is the number on that term. The constant term is the term with no variable.",
    terms: [
      [
        "binomial and trinomial",
        "A polynomial with exactly two terms and one with exactly three terms.",
      ],
      [
        "leading coefficient",
        "The coefficient of the term with the highest exponent.",
      ],
    ],
    method: [
      "Write the terms from the highest exponent to the lowest so the leading term comes first.",
      "Read the degree and leading coefficient from that first term.",
      "Find the constant term, the term that has no $x$.",
      "Count the terms and test every property against each choice.",
    ],
    watch:
      "The leading term has the highest exponent; it is not always the first term written. The degree is not the number of terms.",
  },
  "rg-solid-density": {
    goal: "Use volume, density and unit conversions to find a weight, a count of whole objects, or a number of liters.",
    intuition:
      "Density is mass per unit of volume, so mass is density times volume. Units must match: a density in pounds per cubic foot needs a volume in cubic feet. When you count whole objects, a leftover part does not count, so you round down.",
    terms: [
      ["density", "Mass per unit of volume, such as 45 pounds per cubic foot."],
      ["liter", "A unit of volume equal to 1000 cubic centimeters."],
    ],
    method: [
      "Find the depth or the radius first: halve a diameter, subtract a gap from a height.",
      "Convert lengths so they match the unit in the density, or convert cubic centimeters to liters at the end.",
      "Find the volume with the shape's formula, then multiply by the density for mass.",
      "To count objects, divide the total mass by the mass of one object and round down. Otherwise round as the question asks.",
    ],
    watch:
      "A diameter is not a radius, and inches are not feet. $\\pi r^{2}h$ needs the radius in the same length unit as the density's cubic unit.",
  },
  "rg-quadrilateral-choice": {
    goal: "Choose the fact that makes a parallelogram a rhombus or a rectangle, or find a trapezoid angle from expressions.",
    intuition:
      "A rhombus is a parallelogram with four equal sides. A rectangle is a parallelogram with four right angles. Opposite sides equal, opposite angles equal and diagonals that bisect each other hold for every parallelogram, so they prove nothing special. In a trapezoid, the two angles on one leg lie between the same two parallel lines, so they add to 180°.",
    terms: [
      ["supplementary", "Two angles whose measures add to 180 degrees."],
      ["leg of a trapezoid", "One of the two sides that are not parallel."],
    ],
    method: [
      "Ask whether the fact is true of every parallelogram. If it is, it cannot prove a rhombus or a rectangle.",
      "Match the fact to the shape: perpendicular diagonals or equal consecutive sides give a rhombus; congruent diagonals or a right angle give a rectangle.",
      "For a trapezoid, write that the two angles on a leg add to 180, solve for $x$, then evaluate the angle asked for.",
    ],
    watch:
      "Congruent diagonals make a rectangle; perpendicular diagonals make a rhombus. The angles on one leg of a trapezoid add to 180°; they are not equal.",
  },
  "rg-parallelogram-perpendicular": {
    goal: "Find an angle next to a perpendicular drawn from a vertex of a parallelogram to the line of an opposite side.",
    intuition:
      "In a parallelogram, consecutive angles add to 180°. A perpendicular from a vertex makes a right triangle, and the two other angles of a right triangle add to 90°.",
    terms: [
      ["perpendicular", "Meeting another line at a right angle, 90 degrees."],
      ["consecutive angles", "Two angles of a polygon that share a side."],
    ],
    method: [
      "Mark the right angle where the perpendicular meets the line.",
      "If the foot of the perpendicular is beyond a vertex, find the angle outside the parallelogram with $180-$ the parallelogram's angle at that vertex.",
      "The other two angles of the right triangle add to 90. Subtract the one you know.",
    ],
    watch:
      "Check whether E is on the side or on its extension. On the extension, the triangle's angle at the vertex is the supplement of the parallelogram's angle, not the angle itself.",
  },
  "rg-segment-property-choice": {
    goal: "Use a perpendicular bisector or a triangle's midsegment, in words or with algebraic lengths.",
    intuition:
      "The perpendicular bisector of a segment crosses it at its midpoint at a right angle. Every point on it is the same distance from both endpoints. A midsegment joins the midpoints of two sides of a triangle. It is parallel to the third side and half as long.",
    terms: [
      [
        "perpendicular bisector",
        "A line that is perpendicular to a segment and passes through its midpoint.",
      ],
      [
        "midsegment",
        "A segment joining the midpoints of two sides of a triangle.",
      ],
    ],
    method: [
      "Name the segment that is bisected, or the two sides whose midpoints are joined.",
      "For a point on a perpendicular bisector, its distances to the two endpoints are equal.",
      "For a midsegment, the third side is twice its length and parallel to it.",
      "With algebraic lengths, write that equation, solve for $x$, and find the length asked for.",
    ],
    watch:
      "Equal distances are to the two endpoints of the bisected segment only. A midsegment is half the third side, not equal to it.",
  },
  "rg-isosceles-right-decimal": {
    goal: "Find a leg, a hypotenuse or a square's side with the isosceles right triangle ratio, rounded to the nearest tenth.",
    intuition:
      "An isosceles right triangle has two equal legs and a right angle between them. Its hypotenuse is the leg times $\\sqrt{2}$, about 1.414. A square's diagonal cuts it into two such triangles.",
    terms: [
      [
        "hypotenuse",
        "The longest side of a right triangle, opposite the right angle.",
      ],
    ],
    method: [
      "Call each leg $x$ and use the Pythagorean theorem: $x^{2}+x^{2}=c^{2}$.",
      "So $c=x\\sqrt{2}$ and $x=\\frac{c}{\\sqrt{2}}$.",
      "Compute with a calculator and round only at the end.",
    ],
    watch:
      "To go from the hypotenuse to a leg, divide by $\\sqrt{2}$, not by 2.",
  },
  "rg-triangle-area-sas": {
    goal: "Find a triangle's area from two sides and the angle between them, rounded to the nearest tenth.",
    intuition:
      "The area of a triangle is half of a base times the height. When two sides $a$ and $b$ meet at angle $C$, the height on side $a$ is $b\\sin C$, so the area is $\\frac{1}{2}ab\\sin C$. This works for an obtuse angle too, because $\\sin C=\\sin(180°-C)$.",
    terms: [
      [
        "included angle",
        "The angle formed by two given sides, at the vertex where they meet.",
      ],
    ],
    method: [
      "Find the angle between the two given sides.",
      "Multiply: $\\frac{1}{2}\\times$ side $\\times$ side $\\times$ the sine of that angle, with the calculator in degree mode.",
      "Round to the nearest tenth at the end.",
    ],
    watch:
      "The angle must lie between the two sides you use. A calculator in radian mode gives a wrong sine.",
  },
  "rg-triangle-third-side-test": {
    goal: "Decide whether a length could be, or could not be, the third side of a triangle with two given sides.",
    intuition:
      "Two sides of a triangle must together be longer than the third side, or the sides cannot meet. For sides $a$ and $b$ the third side must be longer than their difference and shorter than their sum.",
    terms: [
      [
        "triangle inequality",
        "In a triangle, the sum of any two sides is greater than the third side.",
      ],
    ],
    method: [
      "Find the difference and the sum of the two given sides.",
      "The third side must be strictly between them.",
      "Test each choice. A length equal to the difference or the sum does not work.",
    ],
    watch:
      "The limits are strict. A side equal to the sum or the difference flattens the triangle into a segment.",
  },
  "rg-altitude-segment": {
    goal: "Find a segment of the hypotenuse from the altitude to the hypotenuse of a right triangle, to the nearest tenth.",
    intuition:
      "The altitude from the right angle to the hypotenuse cuts the triangle into two triangles that are similar to it and to each other. That gives proportions: each leg is the mean proportional between the whole hypotenuse and the part of it next to that leg.",
    terms: [
      [
        "altitude",
        "A segment from a vertex perpendicular to the opposite side.",
      ],
      [
        "mean proportional",
        "The number $m$ with $\\frac{a}{m}=\\frac{m}{b}$, so $m^{2}=ab$.",
      ],
    ],
    method: [
      "Name the given leg, the whole hypotenuse and the part of the hypotenuse next to that leg.",
      "Use $\\text{leg}^{2}=(\\text{whole hypotenuse})(\\text{adjacent part})$ to find the whole hypotenuse.",
      "Subtract the known part to find the other part, and round at the end.",
    ],
    watch:
      "Use the part next to the leg you were given. The other leg goes with the other part.",
  },
};

export const regentsGapPrinciples: Record<string, string> = {
  "rg-exponential-base-rate":
    "If $y=a\\cdot b^{t/k}$ with $b>0$, then $y$ is multiplied by $b$ each time $t$ increases by $k$. For $b=1+r$ it increases by $100r\\%$; for $b=1-r$ with $0<r<1$ it decreases by $100r\\%$. A quantity with half-life $h$ is $a\\cdot 0.5^{t/h}$.",
  "rg-factor-completely":
    "For all real $a$ and $b$, $a^{2}-b^{2}=(a-b)(a+b)$, and so $ka^{2}-kb^{2}=k(a-b)(a+b)$. A sum of squares $a^{2}+b^{2}$ has no factorization over the real numbers. A factorization is complete when no factor can be factored further.",
  "rg-polynomial-zeros-forms":
    "If $f(x)=p(x)q(x)$ then $f(x)=0$ exactly when $p(x)=0$ or $q(x)=0$. The zero of $ax+b$ with $a\\neq0$ is $-\\frac{b}{a}$. Grouping uses $x^{2}(x+a)-n^{2}(x+a)=(x+a)(x^{2}-n^{2})$.",
  "rg-exponent-monomial-power":
    "For real $a$ and $b$ and whole numbers $m$ and $n$: $(ab)^{n}=a^{n}b^{n}$, $(x^{m})^{n}=x^{mn}$ and $x^{m}x^{n}=x^{m+n}$.",
  "rg-rational-exponent-forms":
    "For $x>0$ and integers $p$ and $q>0$: $x^{p/q}=\\sqrt[q]{x^{p}}=\\left(\\sqrt[q]{x}\\right)^{p}$, $x^{-r}=\\frac{1}{x^{r}}$ and $x^{r}x^{s}=x^{r+s}$.",
  "rg-polynomial-build":
    "A polynomial in $x$ is $a_nx^{n}+\\dots+a_1x+a_0$ with $a_n\\neq0$. Its degree is $n$, its leading coefficient is $a_n$ and its constant term is $a_0$.",
  "rg-solid-density":
    "Mass equals density times volume. A cylinder has $V=\\pi r^{2}h$, a pyramid $V=\\frac{1}{3}Bh$ with base area $B$, and a rectangular prism $V=\\ell wh$. One liter is $1000\\text{ cm}^{3}$.",
  "rg-quadrilateral-choice":
    "A parallelogram is a rhombus exactly when its diagonals are perpendicular, equivalently when two consecutive sides are congruent. It is a rectangle exactly when its diagonals are congruent, equivalently when it has one right angle. Angles between two parallel lines on the same side of a transversal are supplementary.",
  "rg-parallelogram-perpendicular":
    "Consecutive angles of a parallelogram are supplementary. Angles on a straight line add to 180°, and the acute angles of a right triangle add to 90°.",
  "rg-segment-property-choice":
    "A point $P$ is on the perpendicular bisector of $\\overline{AB}$ exactly when $PA=PB$. If $D$ and $E$ are the midpoints of $\\overline{AB}$ and $\\overline{AC}$, then $\\overline{DE}\\parallel\\overline{BC}$ and $DE=\\frac{1}{2}BC$.",
  "rg-isosceles-right-decimal":
    "A triangle with angles 45°, 45° and 90° has sides $x$, $x$ and $x\\sqrt{2}$. The diagonal of a square with side $s$ is $s\\sqrt{2}$.",
  "rg-triangle-area-sas":
    "A triangle with sides $a$ and $b$ and included angle $C$ has area $\\frac{1}{2}ab\\sin C$, because the height on side $a$ is $b\\sin C$.",
  "rg-triangle-third-side-test":
    "Three positive lengths form a triangle exactly when each is less than the sum of the other two. For sides $a\\le b$, the third side $c$ satisfies $b-a<c<a+b$.",
  "rg-altitude-segment":
    "If altitude $\\overline{CD}$ is drawn to the hypotenuse $\\overline{AB}$ of right triangle $ABC$ with the right angle at $C$, then $AC^{2}=AD\\cdot AB$, $BC^{2}=BD\\cdot AB$ and $CD^{2}=AD\\cdot DB$.",
};

type LessonInput = Omit<Lesson, "sections"> & {
  intuition: [string, string[]];
  method: [string, string[]];
  formal: [string, string[]];
};
const build = ({
  intuition,
  method,
  formal,
  ...rest
}: LessonInput): Lesson => ({
  ...rest,
  sections: [
    { stage: "intuition", title: intuition[0], paragraphs: intuition[1] },
    { stage: "method", title: method[0], paragraphs: method[1] },
    { stage: "formal", title: formal[0], paragraphs: formal[1] },
  ],
});

export const regentsGapLessons: Lesson[] = [
  build({
    id: "exponential-base-percent",
    title: "Read the percent change from an exponential base",
    summary:
      "The base of an exponential model is the factor applied each period. Compare it with 1 to find the percent change.",
    templateIds: ["rg-exponential-base-rate"],
    objectives: [
      "Write the percent increase or decrease per period from a base such as 1.038 or 0.85.",
      "Use an exponent of the form $t/k$ to find how often the change happens.",
    ],
    intuition: [
      "The base tells the change",
      [
        "In $y=a\\cdot b^{t}$ the quantity is multiplied by $b$ once for each unit of $t$. If $b=1.038$, the quantity keeps all of itself and gains 3.8%. If $b=0.85$, it keeps 85% and loses 15%.",
        "You need to convert between decimals and percents: moving the decimal point two places to the right turns 0.038 into 3.8%.",
      ],
    ],
    workedExample: {
      prompt:
        "A town's population is $P(t)=6000(1.027)^{t}$, where $t$ is time in years. By what percent does it change each year?",
      steps: [
        "The base is 1.027, which is more than 1, so the population grows.",
        "$1.027-1=0.027$.",
        "$0.027$ written as a percent is $2.7\\%$.",
      ],
      answer: "It increases by 2.7% each year.",
    },
    method: [
      "Compare the base with 1, then use the exponent",
      [
        "Subtract 1 from the base and ignore the sign: that is the rate as a decimal. Write it as a percent. A base above 1 is an increase and a base below 1 is a decrease.",
        "If the exponent is $t/k$, the multiplier is applied once every $k$ time units. For a half-life of $h$ hours, the amount is multiplied by 0.5 once every $h$ hours, so the model has exponent $t/h$.",
      ],
    ],
    formal: [
      "Growth and decay factors",
      [
        "For $y=a\\cdot b^{t/k}$ with $b>0$, $y$ is multiplied by $b$ whenever $t$ increases by $k$. With $b=1+r$ the change is an increase of $100r\\%$. With $b=1-r$ and $0<r<1$ it is a decrease of $100r\\%$.",
      ],
    ],
    pitfalls: [
      "The base 1.027 is not a 1.027% change and not a 27% change.",
      "An exponent $t/4$ does not make the percent four times as large.",
    ],
    parentGuide:
      "Ask what happens to 100 dollars after one period when the base is 1.05, and after one period when the base is 0.95.",
  }),
  build({
    id: "factor-completely-squares",
    title: "Factor completely: common factors and differences of squares",
    summary:
      "Pull out the common factor first, then factor any difference of squares that remains.",
    templateIds: ["rg-factor-completely"],
    objectives: [
      "Factor a difference of squares whose first term has a coefficient.",
      "Factor a common factor first, then a difference of squares, with one or two variables.",
    ],
    intuition: [
      "Factor out, then factor again",
      [
        "Factoring writes an expression as a product. A difference of two perfect squares factors as $a^{2}-b^{2}=(a-b)(a+b)$. For example, $4x^{2}-25=(2x)^{2}-5^{2}=(2x-5)(2x+5)$.",
        "Some expressions hide a difference of squares behind a common factor. In $3x^{2}-48$, both terms have the factor 3, and what is left is $x^{2}-16$.",
      ],
    ],
    workedExample: {
      prompt: "Factor $2x^{3}-18xy^{2}$ completely.",
      steps: [
        "The greatest common factor of both terms is $2x$: $2x^{3}-18xy^{2}=2x(x^{2}-9y^{2})$.",
        "$x^{2}-9y^{2}=x^{2}-(3y)^{2}$ is a difference of squares, so it is $(x-3y)(x+3y)$.",
        "Multiply back: $2x(x^{2}-9y^{2})=2x^{3}-18xy^{2}$.",
      ],
      answer: "$2x(x-3y)(x+3y)$",
    },
    method: [
      "Check for a common factor first",
      [
        "Pull out the greatest common factor of the numbers and the variables. Then write each remaining term as a square and apply the difference of squares rule. Check by multiplying.",
        "Factoring is complete only when no factor in the product can be factored again.",
      ],
    ],
    formal: [
      "Difference of squares",
      [
        "For all real numbers $a$ and $b$, $a^{2}-b^{2}=(a-b)(a+b)$, so $ka^{2}-kb^{2}=k(a-b)(a+b)$. A sum of squares $a^{2}+b^{2}$ has no real factorization.",
      ],
    ],
    pitfalls: [
      "A factor placed outside does not change the squares inside: $4(x-5)(x+5)$ is $4x^{2}-100$.",
      "Stopping after the common factor leaves a difference of squares unfactored.",
    ],
    parentGuide:
      "Ask whether $9x^{2}-16$ is a difference of squares and what each square root is.",
  }),
  build({
    id: "zeros-nonmonic-grouping",
    title: "Zeros of a nonmonic product and of a cubic by grouping",
    summary:
      "Set each factor to 0 and solve it completely. Factor an expanded cubic by grouping first.",
    templateIds: ["rg-polynomial-zeros-forms"],
    objectives: [
      "Find the zeros of a product that includes a factor such as $3x+2$.",
      "Find a zero of an expanded cubic by grouping its terms in pairs.",
    ],
    intuition: [
      "A product is zero when a factor is zero",
      [
        "A zero of $f$ is an input where $f(x)=0$. A product is 0 only when at least one factor is 0, so each factor gives its own zero. The factor $3x+2$ is 0 when $3x=-2$, which is $x=-\\frac{2}{3}$.",
        "A cubic written as four terms can often be split into two pairs. If each pair leaves the same binomial, that binomial is a common factor and the cubic becomes a product.",
      ],
    ],
    workedExample: {
      prompt: "Find the zeros of $f(x)=x(2x-1)(x+4)$.",
      steps: [
        "Set each factor to 0: $x=0$, $2x-1=0$ and $x+4=0$.",
        "$2x-1=0$ gives $2x=1$, so $x=\\frac{1}{2}$. $x+4=0$ gives $x=-4$.",
        "Check: at $x=\\frac{1}{2}$ the middle factor is $0$, so the whole product is 0.",
      ],
      answer: "$-4,\\ 0,\\ \\frac{1}{2}$",
    },
    method: [
      "Solve each factor, or group first",
      [
        "For a product, write one equation per factor and solve each one, dividing by the coefficient last. For an expanded cubic, group the first two and last two terms, factor out the shared binomial, then factor what is left.",
      ],
    ],
    formal: [
      "Zero-product property",
      [
        "If $ab=0$ then $a=0$ or $b=0$. The zero of $ax+b$ with $a\\neq0$ is $-\\frac{b}{a}$. In $x^{2}(x+a)-n^{2}(x+a)=(x+a)(x-n)(x+n)$ the zeros are $-a$, $n$ and $-n$.",
      ],
    ],
    pitfalls: [
      "The zero of $3x+2$ is $-\\frac{2}{3}$. Do not drop the 3 and do not flip the fraction.",
      "A lone factor $x$ contributes the zero 0; leaving it out loses a zero.",
    ],
    parentGuide:
      "Ask what value of $x$ makes $5x-10$ equal 0, and why a product with that factor is then 0.",
  }),
  build({
    id: "monomial-power-simplify",
    title: "Powers of monomials",
    summary:
      "Raise the coefficient to the power and multiply each exponent by it.",
    templateIds: ["rg-exponent-monomial-power"],
    objectives: [
      "Simplify a monomial with a coefficient and two variables raised to a power.",
      "Combine the result with a second monomial by multiplying coefficients and adding exponents.",
    ],
    intuition: [
      "A power repeats the whole product",
      [
        "$(2x^{3})^{2}$ means $2x^{3}\\cdot2x^{3}$. That is $2\\cdot2=4$ and $x^{3}\\cdot x^{3}=x^{6}$. Every factor inside the parentheses gets the power: the coefficient is multiplied by itself, and each exponent is multiplied by the power.",
      ],
    ],
    workedExample: {
      prompt: "Simplify $(2x^{3}y)^{4}$.",
      steps: [
        "The coefficient: $2^{4}=2\\cdot2\\cdot2\\cdot2=16$.",
        "The exponent of $x$: $3\\cdot4=12$. The exponent of $y$ is $1\\cdot4=4$.",
        "Together: $16x^{12}y^{4}$.",
      ],
      answer: "$16x^{12}y^{4}$",
    },
    method: [
      "Apply the power to every factor",
      [
        "Raise the coefficient to the power. Multiply each exponent by the power. If the result is multiplied by another monomial, multiply the coefficients and add the exponents of matching variables.",
      ],
    ],
    formal: [
      "Exponent laws",
      [
        "For real $a$ and $b$ and whole numbers $m$ and $n$: $(ab)^{n}=a^{n}b^{n}$, $(x^{m})^{n}=x^{mn}$ and $x^{m}x^{n}=x^{m+n}$.",
      ],
    ],
    pitfalls: [
      "$(3x)^{3}$ is $27x^{3}$. The coefficient is cubed, not tripled.",
      "Powers of powers multiply exponents; products of like bases add them.",
    ],
    parentGuide:
      "Ask for $(2x)^{3}$ written out as three factors, then ask what the coefficient and exponent become.",
  }),
  build({
    id: "rational-exponent-radical-forms",
    title: "Rational exponents, radicals and negative powers of fractions",
    summary:
      "Write radicals as powers, add exponents with a common denominator, and flip a fraction for a negative exponent.",
    templateIds: ["rg-rational-exponent-forms"],
    objectives: [
      "Combine a radical and a rational power into one power with a coefficient.",
      "Write a fraction raised to a negative rational exponent in radical form or find its value.",
    ],
    intuition: [
      "An exponent that is a fraction",
      [
        "The exponent $\\frac{1}{2}$ means a square root and $\\frac{1}{3}$ means a cube root: $x^{1/3}=\\sqrt[3]{x}$. A fraction $\\frac{p}{q}$ takes the $q$-th root and raises the result to the power $p$. A negative exponent flips the base: $a^{-1}=\\frac{1}{a}$.",
      ],
    ],
    workedExample: {
      prompt: "Evaluate $\\left(\\frac{4}{9}\\right)^{-\\frac{3}{2}}$.",
      steps: [
        "A negative exponent flips the fraction: $\\left(\\frac{9}{4}\\right)^{\\frac{3}{2}}$.",
        "The denominator 2 is a square root: $\\sqrt{\\frac{9}{4}}=\\frac{3}{2}$.",
        "The numerator 3 is the power: $\\left(\\frac{3}{2}\\right)^{3}=\\frac{27}{8}$.",
      ],
      answer: "$\\frac{27}{8}$",
    },
    method: [
      "Powers first, then combine",
      [
        "Write every radical as a power of the same base. Multiply coefficients and add exponents over a common denominator. For a negative exponent, flip the fraction first. Read $\\frac{p}{q}$ as the $q$-th root and the $p$-th power.",
      ],
    ],
    formal: [
      "Rational exponents",
      [
        "For $x>0$ and integers $p$ and $q>0$, $x^{p/q}=\\sqrt[q]{x^{p}}=\\left(\\sqrt[q]{x}\\right)^{p}$, $x^{-r}=\\frac{1}{x^{r}}$ and $x^{r}x^{s}=x^{r+s}$.",
      ],
    ],
    pitfalls: [
      "Add the exponents as fractions: $\\frac{1}{3}+\\frac{1}{2}=\\frac{5}{6}$.",
      "A negative exponent does not make a value negative.",
    ],
    parentGuide:
      "Ask what $\\sqrt{x}$ is as a power of $x$, then what $\\sqrt{x}\\cdot\\sqrt{x}$ is.",
  }),
  build({
    id: "polynomial-structure-names",
    title: "Degree, terms, leading coefficient and constant term",
    summary:
      "Name the parts of a polynomial and build one with stated properties.",
    templateIds: ["rg-polynomial-build"],
    objectives: [
      "Find the degree, leading coefficient and constant term of a polynomial written out of order.",
      "Choose or write a polynomial with a stated degree, number of terms, leading coefficient and constant term.",
    ],
    intuition: [
      "Parts of a polynomial",
      [
        "A polynomial is a sum of terms such as $5x^{3}$, $-2x$ and $7$. The degree is the highest exponent of $x$. The leading coefficient is the number multiplying that highest power. The constant term is the term with no $x$. A polynomial with two terms is a binomial and one with three terms is a trinomial.",
      ],
    ],
    workedExample: {
      prompt:
        "For $P(x)=4x-3x^{5}+8$, give the degree, leading coefficient and constant term.",
      steps: [
        "Write the terms from the highest exponent down: $-3x^{5}+4x+8$.",
        "The highest exponent is 5, so the degree is 5 and the leading coefficient is $-3$.",
        "The term with no $x$ is 8.",
      ],
      answer: "Degree 5, leading coefficient $-3$, constant term 8.",
    },
    method: [
      "Order the terms first",
      [
        "Rewrite the terms from the highest exponent to the lowest. The first term gives the degree and the leading coefficient. Find the term with no variable for the constant. Count the terms.",
      ],
    ],
    formal: [
      "Standard form",
      [
        "A polynomial in $x$ is $a_nx^{n}+\\dots+a_1x+a_0$ with $a_n\\neq0$. Its degree is $n$, its leading coefficient is $a_n$ and its constant term is $a_0$.",
      ],
    ],
    pitfalls: [
      "The first term written is not always the leading term.",
      "The degree is the highest exponent, not the number of terms.",
    ],
    parentGuide:
      "Ask which term of $2x-x^{3}+5$ has the highest exponent and what number multiplies it.",
  }),
  build({
    id: "volume-density-liters",
    title: "Volume, density and units",
    summary:
      "Match units, find the volume, multiply by density, and round the way the question asks.",
    templateIds: ["rg-solid-density"],
    objectives: [
      "Find the weight of a cylinder from its diameter, height and density.",
      "Count whole objects from a mass and convert cubic centimeters to liters.",
    ],
    intuition: [
      "Density links volume and mass",
      [
        "Density is mass per unit of volume. If wood weighs 40 pounds per cubic foot, 3 cubic feet weigh 120 pounds. The volume must be in the same cubic unit as the density, so you may need to convert inches to feet first.",
        "A liter is a volume of 1000 cubic centimeters. When you count whole objects, a leftover part does not make another object.",
      ],
    ],
    workedExample: {
      prompt:
        "A rectangular tank is 50 cm long and 20 cm wide. Water is 30 cm deep. How many liters of water are in it?",
      steps: [
        "The water is a prism: $50\\times20\\times30=30000$ cubic centimeters.",
        "One liter is 1000 cubic centimeters, so $30000\\div1000=30$.",
      ],
      answer: "30 liters",
    },
    method: [
      "Units, volume, density, rounding",
      [
        "Find the radius or the depth first. Convert lengths to the unit in the density. Use the volume formula, then multiply by density. To count objects, divide the total mass by the mass of one and round down.",
      ],
    ],
    formal: [
      "Formulas and units",
      [
        "Mass equals density times volume. A cylinder has $V=\\pi r^{2}h$ and a pyramid with base area $B$ has $V=\\frac{1}{3}Bh$. One liter equals $1000\\text{ cm}^{3}$ and 1 foot equals 12 inches.",
      ],
    ],
    pitfalls: [
      "Use the radius, which is half the diameter.",
      "Do not round up when counting whole objects.",
    ],
    parentGuide:
      "Ask how many cubic centimeters are in 2 liters and why the answer is not 2.",
  }),
  build({
    id: "parallelogram-types-trapezoid-angles",
    title: "Rhombus, rectangle, trapezoid and perpendicular angles",
    summary:
      "Know which fact proves each special parallelogram, and use supplementary and right angles to find angles.",
    templateIds: ["rg-quadrilateral-choice", "rg-parallelogram-perpendicular"],
    objectives: [
      "Choose the fact that proves a parallelogram is a rhombus or a rectangle.",
      "Find a trapezoid angle from expressions, and an angle next to a perpendicular in a parallelogram.",
    ],
    intuition: [
      "Which facts are special",
      [
        "A parallelogram has two pairs of parallel sides. Its opposite sides are equal, its opposite angles are equal and its diagonals bisect each other. Because every parallelogram has these, they cannot prove it is a rhombus or a rectangle.",
        "A rhombus has four equal sides, which happens when the diagonals are perpendicular or two consecutive sides are equal. A rectangle has four right angles, which happens when one angle is right or the diagonals are equal. Two angles on one leg of a trapezoid, and consecutive angles of a parallelogram, add to 180°.",
      ],
    ],
    workedExample: {
      prompt:
        "In trapezoid $ABCD$ with $\\overline{AB}\\parallel\\overline{DC}$, $m\\angle A=(3x+10)^\\circ$ and $m\\angle D=(2x+20)^\\circ$. Find $m\\angle A$.",
      steps: [
        "Angles $A$ and $D$ are on leg $\\overline{AD}$ between parallel lines, so they add to 180: $(3x+10)+(2x+20)=180$.",
        "$5x+30=180$, so $5x=150$ and $x=30$.",
        "$m\\angle A=3(30)+10=100$.",
      ],
      answer: "$100^\\circ$",
    },
    method: [
      "Test the fact, then compute",
      [
        "Ask whether a fact is true of every parallelogram. If so, it proves nothing special. For angles, decide whether they are supplementary, complementary in a right triangle, or on a straight line, write the equation and solve.",
      ],
    ],
    formal: [
      "Conditions and angle relations",
      [
        "A parallelogram is a rhombus exactly when its diagonals are perpendicular, and a rectangle exactly when its diagonals are congruent. Angles between two parallel lines on the same side of a transversal are supplementary. The acute angles of a right triangle add to 90°.",
      ],
    ],
    pitfalls: [
      "Congruent diagonals give a rectangle; perpendicular diagonals give a rhombus.",
      "Angles on one leg of a trapezoid add to 180°; they are not equal.",
    ],
    parentGuide:
      "Ask which special quadrilateral has equal diagonals and which has perpendicular diagonals.",
  }),
  build({
    id: "bisector-midsegment-lengths",
    title: "Perpendicular bisectors and midsegments",
    summary:
      "A point on a perpendicular bisector is equally far from the endpoints. A midsegment is parallel to the third side and half as long.",
    templateIds: ["rg-segment-property-choice"],
    objectives: [
      "State what must be true of a point on a perpendicular bisector and of a midsegment.",
      "Use those facts to write and solve an equation for a length.",
    ],
    intuition: [
      "Two facts about halves",
      [
        "A perpendicular bisector of a segment crosses it at its midpoint at a right angle. Any point on it is the same distance from the two endpoints, because the line is a mirror that swaps them.",
        "A midsegment of a triangle joins the midpoints of two sides. It runs parallel to the third side and is half as long.",
      ],
    ],
    workedExample: {
      prompt:
        "In triangle $ABC$, $D$ and $E$ are the midpoints of $\\overline{AB}$ and $\\overline{AC}$, $DE=2x+1$ and $BC=5x-3$. Find $BC$.",
      steps: [
        "$\\overline{DE}$ is a midsegment, so $BC=2\\cdot DE$: $5x-3=2(2x+1)$.",
        "$5x-3=4x+2$, so $x=5$.",
        "$BC=5(5)-3=22$.",
      ],
      answer: "22",
    },
    method: [
      "Name the property, write the equation",
      [
        "For a point on a perpendicular bisector, set its two distances to the endpoints equal. For a midsegment, set the third side equal to twice the midsegment. Solve for $x$, then substitute to get the length asked for.",
      ],
    ],
    formal: [
      "Theorems",
      [
        "Perpendicular bisector theorem: $P$ is on the perpendicular bisector of $\\overline{AB}$ exactly when $PA=PB$. Midsegment theorem: the segment joining the midpoints of two sides of a triangle is parallel to the third side and half its length.",
      ],
    ],
    pitfalls: [
      "The equal distances are to the endpoints of the bisected segment, not to other vertices.",
      "A midsegment is half the third side, not equal to it.",
    ],
    parentGuide:
      "Ask how long the third side is when a midsegment is 7, and how the two segments are positioned.",
  }),
  build({
    id: "triangle-lengths-area-decimals",
    title: "Triangle lengths and areas to the nearest tenth",
    summary:
      "Use the 45-45-90 ratio, the altitude to the hypotenuse, and half the product of two sides and the sine of the angle between them.",
    templateIds: [
      "rg-isosceles-right-decimal",
      "rg-triangle-area-sas",
      "rg-altitude-segment",
    ],
    objectives: [
      "Find a leg or hypotenuse of an isosceles right triangle as a rounded decimal.",
      "Find a triangle's area from two sides and the included angle, and a hypotenuse segment from the altitude.",
    ],
    intuition: [
      "Exact relationships, rounded at the end",
      [
        "An isosceles right triangle with legs $x$ has hypotenuse $x\\sqrt{2}$. A triangle with two sides $a$ and $b$ and the angle $C$ between them has area $\\frac{1}{2}ab\\sin C$. The altitude to the hypotenuse of a right triangle makes similar triangles, so a leg squared equals the whole hypotenuse times the part next to that leg.",
        "Keep all the digits of your calculator until the final step, then round to the place asked for.",
      ],
    ],
    workedExample: {
      prompt:
        "A triangle has sides 10 and 12 with a $40^\\circ$ angle between them. Find its area to the nearest tenth.",
      steps: [
        "Area $=\\frac{1}{2}ab\\sin C=\\frac{1}{2}\\cdot10\\cdot12\\cdot\\sin40^\\circ$.",
        "$\\sin40^\\circ\\approx0.6428$, so the area is about $60\\cdot0.6428=38.57$.",
        "Rounded to the nearest tenth, the area is 38.6.",
      ],
      answer: "38.6 square units",
    },
    method: [
      "Pick the relationship, compute, round last",
      [
        "For a 45-45-90 triangle multiply by $\\sqrt{2}$ to go from a leg to the hypotenuse and divide by $\\sqrt{2}$ to go back. For area, check that the angle is between the two sides and use degree mode. For the altitude, find the whole hypotenuse as leg squared over the adjacent part, then subtract.",
      ],
    ],
    formal: [
      "Relationships",
      [
        "A 45-45-90 triangle has sides $x$, $x$ and $x\\sqrt{2}$. The area of a triangle is $\\frac{1}{2}ab\\sin C$. For altitude $\\overline{CD}$ to hypotenuse $\\overline{AB}$ of a right triangle with right angle $C$, $AC^{2}=AD\\cdot AB$.",
      ],
    ],
    pitfalls: [
      "Divide by $\\sqrt{2}$, not by 2, to go from hypotenuse to leg.",
      "Use the segment of the hypotenuse next to the leg you are given.",
    ],
    parentGuide:
      "Ask for the diagonal of a square with side 1 and why it is longer than 1 but shorter than 2.",
  }),
  build({
    id: "third-side-triangle-inequality",
    title: "Which length can be the third side",
    summary:
      "The third side is longer than the difference and shorter than the sum of the other two sides.",
    templateIds: ["rg-triangle-third-side-test"],
    objectives: [
      "State the range of possible third sides from two sides.",
      "Pick the length that fits, or the one that does not.",
    ],
    intuition: [
      "Sides that must reach each other",
      [
        "Two sides of a triangle must together reach past the third side, or the ends cannot meet. With sides 5 and 8, the third side must be shorter than $5+8=13$. It must also be longer than $8-5=3$, or the 5 would not reach the other side.",
      ],
    ],
    workedExample: {
      prompt:
        "Two sides of a triangle are 6 and 11. Could 17 be the third side?",
      steps: [
        "The third side must be greater than $11-6=5$ and less than $6+11=17$.",
        "17 is not less than 17. With a third side of 17, the sides lie flat in a line.",
      ],
      answer: "No. The third side must be between 5 and 17.",
    },
    method: [
      "Find the limits, then test",
      [
        "Subtract the two sides for the lower limit and add them for the upper limit. A possible third side is strictly between them.",
      ],
    ],
    formal: [
      "Triangle inequality",
      [
        "Three positive lengths form a triangle exactly when each is less than the sum of the other two. For sides $a\\le b$, the third side $c$ satisfies $b-a<c<a+b$.",
      ],
    ],
    pitfalls: [
      "A length equal to the sum or the difference does not make a triangle.",
      "Checking only that the third side is less than the sum is not enough; it must also be greater than the difference of the other two sides.",
    ],
    parentGuide:
      "Ask whether sticks of length 2, 3 and 6 can make a triangle, and why not.",
  }),
];
