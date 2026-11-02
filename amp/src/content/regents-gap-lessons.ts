import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

export const regentsGapMethods: Record<string, ProblemMethod> = {
  "rg-exponential-base-rate": {
    goal: "Read the percent change per time period from the base of an exponential model, or build a model from a half-life.",
    intuition:
      "An exponential model multiplies an amount by the same number once in every time period. In $y=a\\cdot b^{t}$, $a$ is the starting amount and $t$ counts the periods. The number $b$ is called the base: it is what the amount is multiplied by each period. The small raised $t$ is called the exponent. It counts how many times the amount has been multiplied by $b$. A percent is a number out of 100, so 0.038 is 3.8%. A base of 1.038 keeps all of the amount and adds 3.8% of it, because $1.038=1+0.038$. A base of 0.85 keeps 85% of the amount, so 15% is lost. A half-life is the time it takes for half of an amount to be gone.",
    senses: { base: "base-exponent" },
    noLink: ["model", "period", "periods"],
    terms: [
      [
        "base-exponent",
        "In $a \\cdot b^{t}$, the base $b$ is the factor applied each period.",
      ],
      "half-life",
    ],
    method: [
      "Compare the base with 1. A base above 1 means the amount grows. A base below 1 means it shrinks.",
      "Find how far the base is from 1: $b-1$ for growth, $1-b$ for shrinking. Move the decimal point two places right to write it as a percent.",
      "Look at the exponent. If it is $t/k$, the amount is multiplied by the base once for every $k$ time units, not once per unit.",
      "For a half-life of $h$ time units, use the base 0.5 with the exponent $t/h$.",
    ],
    watch:
      "The base 1.038 means a 3.8% increase, not 1.038% or 38%. The exponent $t/4$ makes the change happen once every 4 units. It does not multiply the percent by 4.",
  },
  "rg-factor-completely": {
    goal: "Factor an expression completely: take out a common factor, then split any difference of two squares, until nothing factors again.",
    intuition:
      "An expression is a math phrase made of numbers, letters and operations, such as $3x^{2}-48$. A letter that stands for a number is called a variable. Here $x^{2}$ ($x$ squared) means $x$ times $x$. To factor means to rewrite an expression as numbers or expressions multiplied together. Each part being multiplied is called a factor. A term is one piece of an expression, joined to the others by + or −. First take out a common factor, a factor that every term shares: $3x^{2}-48=3(x^{2}-16)$. Parentheses, the curved brackets ( ), hold what is left inside. Then look for a difference of squares: one square (a number times itself) minus another, such as $x^{2}-16=x^{2}-4^{2}$. It always factors as $a^{2}-b^{2}=(a-b)(a+b)$. So $3x^{2}-48=3(x-4)(x+4)$. Factoring is complete when no factor can be factored again.",
    senses: {
      factor: "factor-number",
      factors: "factor-number",
      term: "term-expression",
      terms: "term-expression",
      square: "square-number",
      squares: "square-number",
    },
    noLink: ["part"],
    terms: ["common-factor", "difference-of-squares"],
    method: [
      "Find the greatest common factor: the largest number and highest power of each letter that divide every term. Write it in front of the parentheses.",
      "Write each term left inside as a square, such as $4x^{2}=(2x)^{2}$ or $9y^{2}=(3y)^{2}$.",
      "Use $a^{2}-b^{2}=(a-b)(a+b)$, and keep the common factor in front.",
      "Multiply the factors back together to check that you get the original expression.",
    ],
    watch:
      "Keep the common factor outside the squares: $4(x-5)(x+5)$ multiplies to $4x^{2}-100$, not $4x^{2}-25$. Stop only when no factor left is a difference of squares.",
  },
  "rg-polynomial-zeros-forms": {
    goal: "Find the zeros of a product with a nonmonic factor, or a zero of an expanded cubic by factoring by grouping.",
    intuition:
      "A zero of a function is an input that makes the output 0. A product is 0 only when one of its factors is 0, so each factor gives a zero. For a factor such as $3x+2$, solve $3x+2=0$ and get $-\\frac{2}{3}$. An expanded cubic with four terms can sometimes be factored by grouping its terms in pairs.",
    terms: ["zero-product-property", "factoring-by-grouping"],
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
    goal: "Simplify a monomial such as $(2x^{3}y)^{4}$ raised to a power, alone or times another monomial.",
    intuition:
      "A monomial is a single term: a number times letters, such as $2x^{3}$. A letter that stands for a number is called a variable. The small raised number is called the exponent. It counts how many copies to multiply: $x^{3}$ means $x\\cdot x\\cdot x$. The number in front of the letters is called the coefficient. A power of a product repeats the whole product: $(2x^{3})^{2}=2x^{3}\\cdot2x^{3}$. Each part being multiplied is called a factor. So every factor inside the parentheses, the curved brackets, gets the power. The coefficient is multiplied by itself: $2\\cdot2=4$. Each exponent is multiplied by the power: $x^{3}\\cdot x^{3}=x^{6}$.",
    senses: { factor: "factor-number", term: "term-expression" },
    noLink: ["part"],
    terms: ["coefficient", "monomial"],
    method: [
      "Raise the coefficient to the outer power: multiply it by itself that many times.",
      "Multiply each exponent inside the parentheses by the outer power. A letter written with no exponent has exponent 1.",
      "If another monomial follows, multiply the two coefficients. Then add the exponents of the same letter.",
    ],
    watch:
      "$(3x)^{3}$ is $27x^{3}$, not $9x^{3}$ or $3x^{3}$. The coefficient is cubed ($3\\cdot3\\cdot3$), not multiplied by 3.",
  },
  "rg-rational-exponent-forms": {
    goal: "Combine rational powers, write a fraction with a negative rational exponent in radical form, or find its value.",
    intuition:
      "A rational exponent $\\frac{p}{q}$ means a root and a power: $x^{p/q}$ is the $q$-th root of $x^{p}$. A negative exponent means the reciprocal. Radicals combine most easily after they are written as powers of the same base.",
    terms: [
      [
        "nth-root",
        "Here it is the small $q$ in $\\sqrt[q]{\\ }$ that names the root; a square root has index 2.",
      ],
      "rational-exponent",
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
    goal: "Build a polynomial from its degree, number of terms, leading coefficient and constant term, or read these from one.",
    intuition:
      "An expression is a math phrase made of numbers, letters and operations. A letter such as $x$ that stands for a number is called a variable. A term is a number times a power of $x$, such as $5x^{3}$, $-2x$ or 7. The small raised number is called the exponent: $x^{3}$ means $x\\cdot x\\cdot x$. A number that multiplies $x$ is called a coefficient. A polynomial is a sum of terms, such as $5x^{3}-2x+7$. Its exponents are whole numbers, which are 0, 1, 2, 3 and so on. The degree is the highest exponent of $x$, here 3. The leading coefficient is the number multiplying that highest power, here 5. The constant term is the term with no $x$, here 7. A binomial has two terms, and a trinomial has three.",
    senses: {
      term: "term-expression",
      terms: "term-expression",
      degree: "degree-polynomial",
    },
    terms: ["binomial", "trinomial", "leading-coefficient"],
    method: [
      "Write the terms from the highest exponent to the lowest, so the leading term comes first.",
      "Read the degree and the leading coefficient from that first term. Keep the sign of the coefficient.",
      "Find the constant term, the term that has no $x$.",
      "Count the terms, then test every property against each choice.",
    ],
    watch:
      "The leading term has the highest exponent; it is not always the first term written. The degree is not the number of terms.",
  },
  "rg-solid-density": {
    goal: "Use volume, density and unit changes to find a weight, a count of whole objects, or a number of liters.",
    intuition:
      "Volume is the space a solid fills, counted in cubic units, the number of 1-unit cubes that would fill it. Mass is the amount of stuff in an object, measured here as a weight. Density is the mass of one cubic unit. So mass is density times volume: 40 pounds per cubic foot times 3 cubic feet is 120 pounds. The units must match: a density in pounds per cubic foot needs a volume in cubic feet. A liter is a volume of 1000 cubic centimeters. For a cylinder (a can shape), the volume is $\\pi r^{2}h$, where $r$ is the radius, $h$ is the height and $\\pi$ is about 3.14. The diameter is the distance straight across a circle through its middle. The radius is the distance halfway across, half the diameter. When you count whole objects, a leftover part does not count. To round down means to drop that leftover part.",
    senses: {
      unit: "unit",
      units: "unit",
      solid: "solid-shape",
      cube: "cube",
      cubes: "cube",
    },
    noLink: ["whole", "part"],
    terms: ["density", ["liter", "One liter is 1000 cubic centimeters."]],
    method: [
      "Find the radius or the depth first. Halve a diameter to get the radius, and subtract any gap from a height.",
      "Change lengths so they match the unit in the density, or change cubic centimeters to liters at the end.",
      "Find the volume with the shape's formula, then multiply by the density to get the mass.",
      "To count objects, divide the total mass by the mass of one object and round down. Otherwise round as the question asks.",
    ],
    watch:
      "A diameter is not a radius, and inches are not feet. In $\\pi r^{2}h$, the radius $r$ and the height $h$ must use the length unit of the density's cubic unit.",
  },
  "rg-quadrilateral-choice": {
    goal: "Choose the fact that makes a parallelogram a rhombus or a rectangle, or find a trapezoid angle from expressions.",
    intuition:
      "Parallel means running the same direction without ever meeting. A parallelogram is a quadrilateral, a four-sided shape, with two pairs of parallel sides. A rhombus is a parallelogram with four equal sides. A rectangle is a parallelogram with four right angles, the square corners of 90°. Perpendicular means meeting at a right angle. A diagonal is a segment joining opposite corners. To bisect means to cut into two equal halves. Every parallelogram has equal opposite sides and equal opposite angles, and its diagonals bisect each other. To prove a fact means to show it must be true. Because every parallelogram has these facts, they prove nothing special. A trapezoid is a four-sided shape with exactly one pair of parallel sides. Its other two sides are called legs. The two angles along one leg add to 180°, because the leg crosses two parallel lines.",
    senses: { side: "side", sides: "side", square: "square-shape" },
    noLink: ["opposite"],
    terms: ["supplementary", "trapezoid"],
    method: [
      "Ask whether the fact is true of every parallelogram. If it is, it cannot prove a rhombus or a rectangle.",
      "Match the fact to the shape. Perpendicular diagonals or two equal sides that meet give a rhombus. Equal diagonals or one right angle give a rectangle.",
      "For a trapezoid, write that the two angles on a leg add to 180. Solve for $x$, then find the angle asked for.",
    ],
    watch:
      "In a parallelogram, equal diagonals make a rectangle and perpendicular diagonals make a rhombus. The angles on one leg of a trapezoid add to 180°. Do not set them equal; they are equal only when both are 90°.",
  },
  "rg-parallelogram-perpendicular": {
    goal: "Find an angle next to a perpendicular drawn from a vertex of a parallelogram to the line of an opposite side.",
    intuition:
      "A parallelogram is a four-sided shape whose opposite sides are parallel, meaning they never meet. Two of its angles that share a side add to 180°. A vertex is a corner. A perpendicular is a line that meets another line at a right angle, a square corner of 90°. Drawing one from a vertex makes a right triangle, a triangle with a 90° angle. The other two angles of a right triangle add to 90°, because all three angles add to 180°.",
    senses: { side: "side", sides: "side", square: "square-shape" },
    noLink: ["opposite"],
    terms: [
      "perpendicular",
      ["angle", "Consecutive angles of a polygon share a side."],
    ],
    method: [
      "Mark the right angle where the perpendicular meets the line.",
      "The foot of the perpendicular is the point where it lands. If it lands past a vertex, on the side drawn longer, find the angle outside the parallelogram: 180° minus the parallelogram's angle at that vertex.",
      "The other two angles of the right triangle add to 90°. Subtract the one you know.",
    ],
    watch:
      "Check whether $E$ is on the side or on the side drawn longer past the vertex. In the second case, the triangle's angle at the vertex is 180° minus the parallelogram's angle, not the angle itself.",
  },
  "rg-segment-property-choice": {
    goal: "Use a perpendicular bisector or a triangle's midsegment, in words or with lengths written using $x$.",
    intuition:
      "A segment is the straight path between two endpoints. Its midpoint is the point halfway along it. The perpendicular bisector is the line through a segment's midpoint at a right angle, a square corner of 90°. Every point on that line is the same distance from both endpoints. A midsegment is the segment joining the midpoints of two sides of a triangle. Parallel means running the same direction without ever meeting. A midsegment is parallel to the third side and half as long.",
    senses: { side: "side", sides: "side", square: "square-shape" },
    noLink: ["third"],
    terms: ["perpendicular-bisector", "midsegment"],
    method: [
      "Name the segment that is bisected (meaning cut into two equal halves), or the two sides whose midpoints are joined.",
      "For a point on a perpendicular bisector, its distances to the two endpoints are equal.",
      "For a midsegment, the third side is twice as long and parallel to it.",
      "With lengths written using $x$, write that equation, solve for $x$, and find the length asked for.",
    ],
    watch:
      "The equal distances are to the two endpoints of the bisected segment only. A midsegment is half the third side, not equal to it.",
  },
  "rg-isosceles-right-decimal": {
    goal: "Find a leg, a hypotenuse or a square's side with the isosceles right triangle ratio, rounded to the nearest tenth.",
    intuition:
      "A right triangle has one right angle, a square corner of 90°. The two sides that form the right angle are called legs. The longest side, across from the right angle, is called the hypotenuse. A right triangle is called isosceles when its two legs are equal. A square root is a number that times itself makes a given number. So $\\sqrt{2}$, the square root of 2, times itself is 2, and it is about 1.414. The hypotenuse of an isosceles right triangle is a leg times $\\sqrt{2}$. A segment is a straight path between two points. A square's diagonal, the segment between opposite corners, cuts the square into two such triangles.",
    senses: {
      side: "side",
      sides: "side",
      square: "square-shape",
      squared: "square-number",
    },
    noLink: ["opposite"],
    terms: ["hypotenuse"],
    method: [
      "Call each leg $x$. In a right triangle, leg squared plus leg squared equals hypotenuse squared: $x^{2}+x^{2}=c^{2}$.",
      "So $c^{2}=2x^{2}$, which gives $c=x\\sqrt{2}$ and $x=\\frac{c}{\\sqrt{2}}$.",
      "Compute with a calculator and round only at the end.",
    ],
    watch:
      "To go from the hypotenuse to a leg, divide by $\\sqrt{2}$, not by 2.",
  },
  "rg-triangle-area-sas": {
    goal: "Find a triangle's area from two sides and the angle between them, rounded to the nearest tenth.",
    intuition:
      "Area is the space inside a shape. The height of a triangle is the straight-up distance from a side, called the base, to the opposite corner. A triangle's area is half of the base times the height. Suppose two sides $a$ and $b$ meet at an angle $C$. The angle between two sides is called the included angle. The sine is a number for each angle: in a right triangle, the side across from the angle divided by the longest side. We write $\\sin C$ for the sine of angle $C$, and a calculator gives it. The height on side $a$ is $b\\sin C$, so the area is $\\frac{1}{2}ab\\sin C$. An obtuse angle is an angle larger than 90°. The formula works for one too, because $\\sin C=\\sin(180°-C)$. To round to the nearest tenth means to keep one digit after the decimal point, choosing the closer value.",
    senses: {
      side: "side",
      sides: "side",
      degree: "degree-angle",
      base: "base-shape",
      unit: "unit",
    },
    noLink: ["opposite", "mode"],
    terms: ["included-angle"],
    method: [
      "Find the angle between the two given sides.",
      "Multiply: $\\frac{1}{2}\\times$ side $\\times$ side $\\times$ the sine of that angle, with the calculator in degree mode.",
      "Round to the nearest tenth at the end.",
    ],
    watch:
      "The angle must lie between the two sides you use. Radians are a different unit for angles, so a calculator in radian mode gives a wrong sine.",
  },
  "rg-triangle-third-side-test": {
    goal: "Decide whether a length could be, or could not be, the third side of a triangle with two given sides.",
    intuition:
      "Any two sides of a triangle must together be longer than the third side, or their ends cannot meet. So if two sides are $a$ and $b$, the third side must be shorter than their sum, $a+b$. It must also be longer than their difference, the larger minus the smaller, or the shorter side cannot reach across. With sides 5 and 8, the third side is between $8-5=3$ and $5+8=13$.",
    senses: { side: "side", sides: "side" },
    noLink: ["third"],
    terms: ["triangle-inequality"],
    method: [
      "Find the difference (larger minus smaller) and the sum of the two given sides.",
      "The third side must be strictly between them: longer than the difference and shorter than the sum.",
      "Test each choice. A length equal to the difference or the sum does not work.",
    ],
    watch:
      "The limits are strict. A side equal to the sum or the difference lays the triangle flat into a straight line.",
  },
  "rg-altitude-segment": {
    goal: "Find a segment of the hypotenuse from the altitude to the hypotenuse of a right triangle, to the nearest tenth.",
    intuition:
      "A right triangle has a right angle, a square corner of 90°. Its two shorter sides are called legs, and its longest side is called the hypotenuse. An altitude is a segment from a corner that meets the opposite side at a right angle. Draw the altitude from the right angle to the hypotenuse. It cuts the big triangle into two smaller triangles. All three triangles are similar: they have the same shape, so each side of one is the same number times the matching side of another. This gives a rule: a leg squared equals the whole hypotenuse times the part of the hypotenuse next to that leg.",
    senses: {
      side: "side",
      sides: "side",
      similar: "similar-figures",
      square: "square-shape",
      squared: "square-number",
    },
    noLink: ["opposite", "opposite side", "whole", "part", "rule"],
    terms: ["altitude", "geometric-mean"],
    method: [
      "Name the given leg, the whole hypotenuse and the part of the hypotenuse next to that leg.",
      "Use $\\text{leg}^{2}=\\text{whole}\\times\\text{part}$ to find the whole hypotenuse. Here “whole” is the whole hypotenuse and “part” is the part next to that leg.",
      "Subtract the known part to find the other part, and round at the end.",
    ],
    watch:
      "Use the part next to the leg you were given. The other leg goes with the other part.",
  },
};

export const regentsGapPrinciples: Record<string, string> = {
  "rg-exponential-base-rate":
    "If $y=a\\cdot b^{t/k}$ with $a>0$ and $b>0$, then $y$ is multiplied by $b$ each time $t$ increases by $k$. For $b=1+r$ with $r>0$, that is an increase of $100r\\%$. For $b=1-r$ with $0<r<1$, it is a decrease of $100r\\%$. An amount with half-life $h$ is $a\\cdot 0.5^{t/h}$.",
  "rg-factor-completely":
    "Real numbers are all the numbers on the number line. For all real numbers $a$ and $b$, $a^{2}-b^{2}=(a-b)(a+b)$. So $ka^{2}-kb^{2}=k(a-b)(a+b)$. A sum of squares such as $x^{2}+9$ cannot be factored using real numbers. A factorization is complete when no factor can be factored further.",
  "rg-polynomial-zeros-forms":
    "If $f(x)=p(x)q(x)$ then $f(x)=0$ exactly when $p(x)=0$ or $q(x)=0$. The zero of $ax+b$ with $a\\neq0$ is $-\\frac{b}{a}$. Grouping uses $x^{2}(x+a)-n^{2}(x+a)=(x+a)(x^{2}-n^{2})$.",
  "rg-exponent-monomial-power":
    "Here $m$ and $n$ are positive whole numbers: 1, 2, 3 and so on. For any numbers $a$, $b$ and $x$: $(ab)^{n}=a^{n}b^{n}$, $(x^{m})^{n}=x^{mn}$ and $x^{m}x^{n}=x^{m+n}$.",
  "rg-rational-exponent-forms":
    "For $x>0$ and integers $p$ and $q>0$: $x^{p/q}=\\sqrt[q]{x^{p}}=\\left(\\sqrt[q]{x}\\right)^{p}$, $x^{-r}=\\frac{1}{x^{r}}$ and $x^{r}x^{s}=x^{r+s}$.",
  "rg-polynomial-build":
    "A polynomial in $x$ is $a_nx^{n}+\\dots+a_1x+a_0$, where each $a$ is a number and $a_n\\neq0$ ($a_n$ is not 0). Its degree is $n$, its leading coefficient is $a_n$ and its constant term is $a_0$.",
  "rg-solid-density":
    "Mass equals density times volume. A cylinder has $V=\\pi r^{2}h$. A pyramid has $V=\\frac{1}{3}Bh$, where $B$ is the area of its base. A rectangular prism, a box shape, has $V=\\ell wh$. One liter is $1000\\text{ cm}^{3}$.",
  "rg-quadrilateral-choice":
    "A parallelogram is a rhombus exactly when its diagonals are perpendicular, or when two sides that meet are congruent (equal in length). It is a rectangle exactly when its diagonals are congruent, or when it has one right angle. When a line crosses two parallel lines, the two angles between them on the same side of that line add to 180°.",
  "rg-parallelogram-perpendicular":
    "Two angles of a parallelogram that share a side add to 180°. Angles on a straight line add to 180°, and the two angles of a right triangle other than the right angle add to 90°.",
  "rg-segment-property-choice":
    "A point $P$ is on the perpendicular bisector of $\\overline{AB}$ exactly when $PA=PB$. Here $\\overline{AB}$ is the segment from $A$ to $B$, and $PA$ is the distance from $P$ to $A$. If $D$ and $E$ are the midpoints of $\\overline{AB}$ and $\\overline{AC}$, then $\\overline{DE}\\parallel\\overline{BC}$ and $DE=\\frac{1}{2}BC$. The sign $\\parallel$ means “is parallel to”.",
  "rg-isosceles-right-decimal":
    "A triangle with angles 45°, 45° and 90° has sides $x$, $x$ and $x\\sqrt{2}$. The diagonal of a square with side $s$ is $s\\sqrt{2}$.",
  "rg-triangle-area-sas":
    "A triangle with sides $a$ and $b$ and included angle $C$ has area $\\frac{1}{2}ab\\sin C$, because the height on side $a$ is $b\\sin C$.",
  "rg-triangle-third-side-test":
    "Three positive lengths form a triangle exactly when each is less than the sum of the other two. At most means less than or equal to. For sides $a\\le b$ ($a$ is at most $b$), the third side $c$ satisfies $b-a<c<a+b$.",
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
      "An exponential model multiplies an amount by the same number once every time period. That number is called the base. A percent is a number out of 100. The percent change is how much the amount grows or shrinks for every 100 it had. Compare the base with 1 to find it. A base of 1.05 means the amount grows by 5% each period. A base of 0.95 means it shrinks by 5% each period.",
    senses: { base: "base-exponent" },
    noLink: [
      "model",
      "period",
      "periods",
      "population",
      "unit",
      "units",
      "change",
      "more than",
    ],
    templateIds: ["rg-exponential-base-rate"],
    objectives: [
      "Write the percent increase or decrease per period from a base such as 1.038 or 0.85.",
      "Use an exponent of the form $t/k$ to find how often the change happens.",
    ],
    intuition: [
      "The base tells the change",
      [
        "In $y=a\\cdot b^{t}$, $a$ is the starting amount and $t$ counts the time periods, such as years or hours. The small raised $t$ is called the exponent. It counts how many times the amount has been multiplied by the base $b$. After 1 period the amount is $a\\cdot b$, and after 2 periods it is $a\\cdot b\\cdot b$.",
        "Suppose the base is 1.038. Since $1.038=1+0.038$, each period keeps all of the amount and adds 0.038 of it. A decimal is a number written with a decimal point, such as 0.038. Move the point two places right to write it as a percent: 0.038 is 3.8%. So the amount grows by 3.8% each period.",
        "Suppose the base is 0.85. Each period keeps 0.85 of the amount, which is 85%. So 15% of the amount is lost each period, because $100\\%-85\\%=15\\%$.",
      ],
    ],
    workedExample: {
      prompt:
        "A town's population is $P(t)=6000(1.027)^{t}$, where $t$ is time in years. By what percent does it change each year?",
      steps: [
        "The base is 1.027, the number the population is multiplied by each year. It is more than 1, so the population grows.",
        "Subtract 1 to see what is added each year: $1.027-1=0.027$.",
        "Move the decimal point two places right to write 0.027 as a percent: $2.7\\%$.",
      ],
      answer: "It increases by 2.7% each year.",
    },
    method: [
      "Compare the base with 1, then use the exponent",
      [
        "Find how far the base is from 1. For a base above 1, subtract 1 from it; that is an increase. For a base below 1, subtract it from 1; that is a decrease. Write the result as a percent.",
        "Sometimes the exponent is a fraction such as $t/4$. Then the amount is multiplied by the base once every 4 time units, because $t/4$ goes up by 1 each time $t$ goes up by 4.",
        "A half-life is the time it takes for half of an amount to be gone. With a half-life of $h$ hours, the amount is multiplied by 0.5 once every $h$ hours. So the model is $y=a\\cdot0.5^{t/h}$.",
      ],
    ],
    formal: [
      "Growth and decay factors",
      [
        "For $y=a\\cdot b^{t/k}$ with a starting amount $a>0$ and $b>0$, $y$ is multiplied by $b$ whenever $t$ increases by $k$. With $b=1+r$ and $r>0$, the change is an increase of $100r\\%$. With $b=1-r$ and $0<r<1$, it is a decrease of $100r\\%$.",
      ],
    ],
    pitfalls: [
      "The base 1.027 means a 2.7% increase. It is not a 1.027% change and not a 27% change.",
      "An exponent $t/4$ means one change every 4 time units. It does not make the percent four times as large.",
    ],
    parentGuide:
      "Ask what 100 dollars becomes after one period when the base is 1.05 (105 dollars), and when the base is 0.95 (95 dollars).",
  }),
  build({
    id: "factor-completely-squares",
    title: "Factor completely: common factors and differences of squares",
    summary:
      "An expression is a math phrase made of numbers, letters and operations, such as $3x^{2}-48$. To factor means to rewrite an expression as parts multiplied together. The parts being multiplied are called factors. First take out any factor that every part shares. Then check whether what is left is a difference of squares: one square (a number times itself) minus another. That always splits into two more factors.",
    senses: {
      factor: "factor-number",
      factors: "factor-number",
      term: "term-expression",
      terms: "term-expression",
      square: "square-number",
      squares: "square-number",
    },
    noLink: ["leaves", "part", "parts", "rule", "change"],
    templateIds: ["rg-factor-completely"],
    objectives: [
      "Factor a difference of squares whose first term has a coefficient.",
      "Factor a common factor first, then a difference of squares, with one or two variables.",
    ],
    intuition: [
      "Factor out, then factor again",
      [
        "A term is one piece of an expression, joined to the others by + or −. In $3x^{2}-48$ the terms are $3x^{2}$ and 48. Here $x^{2}$ ($x$ squared) means $x$ times $x$.",
        "Both terms can be divided by 3, so 3 is a common factor, a factor that every term shares. Write it in front of parentheses, the curved brackets: $3x^{2}-48=3(x^{2}-16)$. Inside is what is left after dividing each term by 3.",
        "A square is a number or expression times itself, such as $16=4^{2}$ or $4x^{2}=(2x)^{2}$. A difference of squares is one square minus another, such as $x^{2}-16=x^{2}-4^{2}$. It always factors as $a^{2}-b^{2}=(a-b)(a+b)$. To see why, multiply out: $(a-b)(a+b)=a^{2}+ab-ab-b^{2}=a^{2}-b^{2}$. The two middle parts cancel.",
        "So $3x^{2}-48=3(x-4)(x+4)$. Factoring is complete when no factor can be factored again.",
      ],
    ],
    workedExample: {
      prompt: "Factor $2x^{3}-18xy^{2}$ completely.",
      steps: [
        "Find the greatest common factor, the largest factor both terms share. Both numbers divide by 2, and both terms contain $x$. So take out $2x$: $2x^{3}-18xy^{2}=2x(x^{2}-9y^{2})$.",
        "Inside the parentheses, $x^{2}-9y^{2}=x^{2}-(3y)^{2}$ is one square minus another. So it factors as $(x-3y)(x+3y)$.",
        "Multiply back to check: $(x-3y)(x+3y)=x^{2}-9y^{2}$, and $2x(x^{2}-9y^{2})=2x^{3}-18xy^{2}$, the original expression.",
      ],
      answer: "$2x(x-3y)(x+3y)$",
    },
    method: [
      "Check for a common factor first",
      [
        "Take out the greatest common factor of the numbers and the letters first. Then write each remaining term as a square and use $a^{2}-b^{2}=(a-b)(a+b)$. Check by multiplying the factors back together.",
        "Factoring is complete only when no factor can be factored again. For example, $x^{4}-16=(x^{2}-4)(x^{2}+4)$. But $x^{2}-4$ is again a difference of squares, so the full answer is $(x-2)(x+2)(x^{2}+4)$.",
      ],
    ],
    formal: [
      "Difference of squares",
      [
        "Real numbers are all the numbers on the number line. For all real numbers $a$ and $b$, $a^{2}-b^{2}=(a-b)(a+b)$. So $ka^{2}-kb^{2}=k(a-b)(a+b)$. A sum of squares such as $x^{2}+9$ cannot be factored using real numbers.",
      ],
    ],
    pitfalls: [
      "A factor in front does not change the squares inside: $4(x-5)(x+5)$ is $4x^{2}-100$, not $4x^{2}-25$.",
      "Stopping after the common factor can leave a difference of squares unfactored. Check every factor once more.",
    ],
    parentGuide:
      "Ask whether $9x^{2}-16$ is one square minus another, and what was squared to make each part ($3x$ and 4).",
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
      "A monomial is a single term: a number times letters, such as $2x^{3}y$. The small raised number is called the exponent. It counts how many copies are multiplied. To raise a monomial to a power, give the power to every part. Raise the number in front to the power, and multiply each exponent by the power.",
    senses: {
      factor: "factor-number",
      factors: "factor-number",
      term: "term-expression",
      base: "base-exponent",
      bases: "base-exponent",
    },
    noLink: ["products", "part", "parts"],
    templateIds: ["rg-exponent-monomial-power"],
    objectives: [
      "Simplify a monomial with a coefficient and two variables raised to a power.",
      "Combine the result with a second monomial by multiplying coefficients and adding exponents.",
    ],
    intuition: [
      "A power repeats the whole product",
      [
        "$x^{3}$ means $x\\cdot x\\cdot x$: three copies of $x$ multiplied. The number in front of the letters is called the coefficient. In $2x^{3}$ the coefficient is 2.",
        "$(2x^{3})^{2}$ means two copies of $2x^{3}$ multiplied: $2x^{3}\\cdot2x^{3}$. The numbers give $2\\cdot2=4$. The letters give $x^{3}\\cdot x^{3}=x^{6}$, because that is 3 copies of $x$ and 3 more. So $(2x^{3})^{2}=4x^{6}$.",
        "Each part being multiplied is called a factor. Every factor inside the parentheses, the curved brackets, gets the power. The coefficient is multiplied by itself, and each exponent is multiplied by the power.",
      ],
    ],
    workedExample: {
      prompt: "Simplify $(2x^{3}y)^{4}$.",
      steps: [
        "Raise the coefficient to the 4th power by multiplying it by itself 4 times: $2^{4}=2\\cdot2\\cdot2\\cdot2=16$.",
        "Multiply each exponent by 4. The exponent of $x$ becomes $3\\cdot4=12$. The letter $y$ has exponent 1, so it becomes $1\\cdot4=4$.",
        "Put the parts together: $16x^{12}y^{4}$.",
      ],
      answer: "$16x^{12}y^{4}$",
    },
    method: [
      "Apply the power to every factor",
      [
        "Raise the coefficient to the power, and multiply each exponent by the power. If the result is multiplied by another monomial, multiply the two coefficients. Then add the exponents of the same letter: $x^{2}\\cdot x^{3}$ is 2 copies of $x$ and 3 more, which is $x^{5}$.",
      ],
    ],
    formal: [
      "Exponent laws",
      [
        "Here $m$ and $n$ are positive whole numbers: 1, 2, 3 and so on. For any numbers $a$, $b$ and $x$: $(ab)^{n}=a^{n}b^{n}$, $(x^{m})^{n}=x^{mn}$ and $x^{m}x^{n}=x^{m+n}$.",
      ],
    ],
    pitfalls: [
      "$(3x)^{3}$ is $27x^{3}$, because $3\\cdot3\\cdot3=27$. The coefficient is cubed, not multiplied by 3.",
      "A power of a power multiplies the exponents: $(x^{2})^{3}=x^{6}$. Multiplying two powers of the same letter adds them: $x^{2}\\cdot x^{3}=x^{5}$.",
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
      "A polynomial is a sum of terms like $5x^{3}$, $-2x$ and 7, where each term is a number times a power of $x$. Its degree is the highest power of $x$ it contains. Its leading coefficient is the number in front of that highest power. Its constant term is the term with no $x$. This lesson names these parts and builds polynomials that have them.",
    senses: {
      term: "term-expression",
      terms: "term-expression",
      degree: "degree-polynomial",
    },
    noLink: ["parts", "change", "changes"],
    templateIds: ["rg-polynomial-build"],
    objectives: [
      "Find the degree, leading coefficient and constant term of a polynomial written out of order.",
      "Choose or write a polynomial with a stated degree, number of terms, leading coefficient and constant term.",
    ],
    intuition: [
      "Parts of a polynomial",
      [
        "A term is a number times a power of $x$, such as $5x^{3}$. The power is the small raised number, called the exponent: $x^{3}$ means $x\\cdot x\\cdot x$. A term with no $x$, such as 7, is called the constant term because its value never changes.",
        "A polynomial is a sum of terms, such as $5x^{3}-2x+7$. Subtracting $2x$ counts as adding the term $-2x$. The exponents are whole numbers, which are 0, 1, 2, 3 and so on.",
        "The degree is the highest exponent of $x$. In $5x^{3}-2x+7$ it is 3. The leading coefficient is the number multiplying that highest power, here 5. A polynomial with two terms is called a binomial, and one with three terms is called a trinomial.",
      ],
    ],
    workedExample: {
      prompt:
        "For $P(x)=4x-3x^{5}+8$, give the degree, leading coefficient and constant term.",
      steps: [
        "Write the terms from the highest exponent down: $-3x^{5}+4x+8$. Changing the order of terms does not change a sum.",
        "The highest exponent is 5, so the degree is 5. The number in front of $x^{5}$ is $-3$, so the leading coefficient is $-3$. Keep its minus sign.",
        "The term with no $x$ is 8, so the constant term is 8.",
      ],
      answer: "Degree 5, leading coefficient $-3$, constant term 8.",
    },
    method: [
      "Order the terms first",
      [
        "Rewrite the terms from the highest exponent to the lowest. The first term then gives the degree and the leading coefficient. The term with no letter is the constant term. Count the terms: two terms make a binomial, and three make a trinomial.",
      ],
    ],
    formal: [
      "Standard form",
      [
        "A polynomial in $x$ is $a_nx^{n}+\\dots+a_1x+a_0$, where each $a$ is a number and $a_n\\neq0$ ($a_n$ is not 0). Its degree is $n$, its leading coefficient is $a_n$ and its constant term is $a_0$.",
      ],
    ],
    pitfalls: [
      "The first term written is not always the leading term. In $4x-3x^{5}+8$, the leading term is $-3x^{5}$.",
      "The degree is the highest exponent, not the number of terms.",
    ],
    parentGuide:
      "Ask which term of $2x-x^{3}+5$ has the highest exponent and what number multiplies it.",
  }),
  build({
    id: "volume-density-liters",
    title: "Volume, density and units",
    summary:
      "Volume is the space a solid fills, counted in cubic units, the number of 1-unit cubes that would fill it. Density is the mass, or weight, of one cubic unit. Multiply density by volume to get the total mass. Match the units first. To round means to replace a number with a nearby simpler one. Round the way the question asks.",
    senses: {
      unit: "unit",
      units: "unit",
      solid: "solid-shape",
      cube: "cube",
      cubes: "cube",
      base: "base-shape",
      sides: "side",
    },
    noLink: ["whole", "part", "change"],
    templateIds: ["rg-solid-density"],
    objectives: [
      "Find the weight of a cylinder from its diameter, height and density.",
      "Count whole objects from a mass and convert cubic centimeters to liters.",
    ],
    intuition: [
      "Density links volume and mass",
      [
        "A cubic foot is the space filled by a cube 1 foot long, 1 foot wide and 1 foot tall. Mass is the amount of stuff in an object, measured here as a weight. Density is the mass of one cubic unit. If wood has a density of 40 pounds per cubic foot, 3 cubic feet of wood weigh $40\\times3=120$ pounds.",
        "The volume must use the same cubic unit as the density. A length in inches must be changed to feet first, using 1 foot = 12 inches.",
        "A liter is a volume of 1000 cubic centimeters. When you count whole objects, a leftover part does not make another object, so round down.",
      ],
    ],
    workedExample: {
      prompt:
        "A rectangular tank is 50 cm long and 20 cm wide. Water is 30 cm deep. How many liters of water are in it?",
      steps: [
        "The water fills a box shape, called a rectangular prism. Its volume is length times width times depth: $50\\times20\\times30=30000$ cubic centimeters.",
        "One liter is 1000 cubic centimeters, so divide by 1000: $30000\\div1000=30$.",
      ],
      answer: "30 liters",
    },
    method: [
      "Units, volume, density, rounding",
      [
        "The diameter is the distance straight across a circle through its middle. The radius is the distance halfway across, half the diameter. Find the radius or the depth first. Change lengths to the unit used in the density. Find the volume with the shape's formula, then multiply by the density. To count objects, divide the total mass by the mass of one object and round down.",
      ],
    ],
    formal: [
      "Formulas and units",
      [
        "Mass equals density times volume. A cylinder has $V=\\pi r^{2}h$, where $r$ is the radius and $h$ is the height. A pyramid is a solid whose sides rise from a flat base to one point. The base area is the area of that flat base, written $B$, and the volume is $V=\\frac{1}{3}Bh$. One liter equals $1000\\text{ cm}^{3}$, and 1 foot equals 12 inches.",
      ],
    ],
    pitfalls: [
      "Use the radius, which is half the diameter.",
      "Do not round up when counting whole objects: enough material for 7.8 objects makes only 7 whole ones.",
    ],
    parentGuide:
      "Ask how many cubic centimeters are in 2 liters and why the answer is not 2.",
  }),
  build({
    id: "parallelogram-types-trapezoid-angles",
    title: "Rhombus, rectangle, trapezoid and perpendicular angles",
    summary:
      "A parallelogram is a four-sided shape whose opposite sides are parallel, meaning they never meet. Some facts are true of every parallelogram, so they prove nothing special. Other facts prove it is a rhombus, with four equal sides, or a rectangle, with four square corners. Angles that add to 180° or 90° help find unknown angles.",
    senses: {
      side: "side",
      sides: "side",
      square: "square-shape",
      degrees: "degree-angle",
    },
    noLink: ["opposite", "rule", "parts"],
    templateIds: ["rg-quadrilateral-choice", "rg-parallelogram-perpendicular"],
    objectives: [
      "Choose the fact that proves a parallelogram is a rhombus or a rectangle.",
      "Find a trapezoid angle from expressions, and an angle next to a perpendicular in a parallelogram.",
    ],
    intuition: [
      "Which facts are special",
      [
        "A parallelogram has two pairs of parallel sides. Its opposite sides are equal, and its opposite angles are equal. A diagonal is a segment joining opposite corners. To bisect means to cut into two equal halves, and the two diagonals of a parallelogram bisect each other. To prove a fact means to show it must be true. Every parallelogram has these facts, so none of them can prove it is a rhombus or a rectangle.",
        "A rhombus is a parallelogram with four equal sides. Perpendicular means meeting at a right angle, a square corner of 90°. A parallelogram is a rhombus when its diagonals are perpendicular. It also is one when two sides that meet are equal.",
        "A rectangle is a parallelogram with four right angles. That happens when one angle is a right angle, or when the two diagonals are equal in length.",
        "A trapezoid is a four-sided shape with exactly one pair of parallel sides. Its other two sides are called legs. Each leg crosses both parallel sides, so the two angles along one leg add to 180°. Two angles that add to 180° are called supplementary. Two angles of a parallelogram that share a side are supplementary too. A right triangle is a triangle with one right angle.",
        "We write $\\angle A$ for the angle at corner $A$, and $m\\angle A$ for its measure in degrees.",
      ],
    ],
    workedExample: {
      prompt:
        "In trapezoid $ABCD$ with $\\overline{AB}\\parallel\\overline{DC}$, $m\\angle A=(3x+10)^\\circ$ and $m\\angle D=(2x+20)^\\circ$. Find $m\\angle A$.",
      steps: [
        "The sign $\\parallel$ means “is parallel to”, so $\\overline{AB}$ and $\\overline{DC}$ are the parallel sides. Angles $A$ and $D$ sit at the two ends of leg $\\overline{AD}$, so they add to 180: $(3x+10)+(2x+20)=180$.",
        "Add the like parts: $5x+30=180$. Subtract 30 from both sides: $5x=150$. Divide both sides by 5: $x=30$.",
        "Put $x=30$ into angle $A$: $m\\angle A=3(30)+10=100$. Check: $m\\angle D=2(30)+20=80$, and $100+80=180$.",
      ],
      answer: "$100^\\circ$",
    },
    method: [
      "Test the fact, then compute",
      [
        "Ask whether a fact is true of every parallelogram. If it is, it proves nothing special. For angles, decide which rule applies. Angles on one leg of a trapezoid add to 180°. The two angles of a right triangle other than the right angle add to 90°. Angles that make a straight line add to 180°. Write the equation and solve it.",
      ],
    ],
    formal: [
      "Conditions and angle relations",
      [
        "A parallelogram is a rhombus exactly when its diagonals are perpendicular. It is a rectangle exactly when its diagonals are congruent, meaning equal in length. When a line crosses two parallel lines, the two angles between them on the same side of that line add to 180°. An acute angle is an angle smaller than 90°. The two acute angles of a right triangle add to 90°.",
      ],
    ],
    pitfalls: [
      "In a parallelogram, equal diagonals give a rectangle and perpendicular diagonals give a rhombus. In other four-sided shapes these facts prove nothing.",
      "Angles on one leg of a trapezoid add to 180°. Do not set them equal; they are equal only when both are 90°.",
    ],
    parentGuide:
      "Ask which special parallelogram has equal diagonals and which has perpendicular diagonals.",
  }),
  build({
    id: "bisector-midsegment-lengths",
    title: "Perpendicular bisectors and midsegments",
    summary:
      "A segment is the straight path between two points. Its perpendicular bisector is the line that crosses it at its middle, at a right angle (a square corner). Every point on that line is equally far from the two ends. A midsegment is a segment joining the middles of two sides of a triangle. It runs the same direction as the third side and is half as long.",
    senses: {
      side: "side",
      sides: "side",
      vertices: "vertex",
      square: "square-shape",
    },
    noLink: ["third"],
    templateIds: ["rg-segment-property-choice"],
    objectives: [
      "State what must be true of a point on a perpendicular bisector and of a midsegment.",
      "Use those facts to write and solve an equation for a length.",
    ],
    intuition: [
      "Two facts about halves",
      [
        "A segment is the straight path between two endpoints. Its midpoint is the point exactly halfway between them. To bisect means to cut into two equal halves. We write $\\overline{AB}$ for the segment with endpoints $A$ and $B$, and $AB$ for its length.",
        "The perpendicular bisector of a segment is the line through its midpoint that meets it at a right angle, a square corner of 90°. Any point on this line is the same distance from the two endpoints. That is because the line is a mirror that swaps the two endpoints.",
        "A midsegment is the segment joining the midpoints of two sides of a triangle. Parallel means running the same direction without ever meeting. A midsegment is parallel to the third side. It is also half as long as the third side, so the third side is twice the midsegment.",
      ],
    ],
    workedExample: {
      prompt:
        "In triangle $ABC$, $D$ and $E$ are the midpoints of $\\overline{AB}$ and $\\overline{AC}$, $DE=2x+1$ and $BC=5x-3$. Find $BC$.",
      steps: [
        "$D$ and $E$ are midpoints of two sides, so $\\overline{DE}$ is a midsegment. The third side is twice as long: $BC=2\\cdot DE$, so $5x-3=2(2x+1)$.",
        "Multiply out $2(2x+1)$ to get $4x+2$: $5x-3=4x+2$. Subtract $4x$ from both sides and add 3 to both sides: $x=5$.",
        "Put $x=5$ into $BC$: $BC=5(5)-3=22$. Check: $DE=2(5)+1=11$, and 22 is twice 11.",
      ],
      answer: "22",
    },
    method: [
      "Name the property, write the equation",
      [
        "For a point on a perpendicular bisector, set its two distances to the endpoints equal. For a midsegment, set the third side equal to twice the midsegment. Solve for $x$. Then put $x$ back in to get the length asked for.",
      ],
    ],
    formal: [
      "Theorems",
      [
        "Perpendicular bisector theorem: a point $P$ is on the perpendicular bisector of $\\overline{AB}$ exactly when $PA=PB$. Midsegment theorem: the segment joining the midpoints of two sides of a triangle is parallel to the third side and half its length.",
      ],
    ],
    pitfalls: [
      "The equal distances are to the endpoints of the bisected segment, not to other corners of the figure.",
      "A midsegment is half the third side, not equal to it.",
    ],
    parentGuide:
      "Ask how long the third side is when a midsegment is 7, and which way the two segments run.",
  }),
  build({
    id: "triangle-lengths-area-decimals",
    title: "Triangle lengths and areas to the nearest tenth",
    summary:
      "A right triangle is a triangle with a square corner, called a right angle. If its two short sides are equal, its longest side is about 1.414 times as long as each. A triangle's area, the space inside it, can be found from two sides and the angle between them. The line from the square corner that meets the longest side at a right angle splits that side into parts you can find. Round only at the end.",
    senses: {
      side: "side",
      sides: "side",
      degree: "degree-angle",
      "similar triangles": "similar-figures",
      squared: "square-number",
      square: "square-shape",
      base: "base-shape",
      unit: "unit",
    },
    noLink: [
      "whole",
      "part",
      "parts",
      "mode",
      "product",
      "opposite",
      "opposite side",
    ],
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
        "The unit for measuring angles is the degree (°), and a right angle is 90°. The two sides that form the right angle are called legs. The longest side, across from the right angle, is called the hypotenuse. A number squared is the number times itself. In a right triangle, leg squared plus leg squared equals hypotenuse squared.",
        "A right triangle is called isosceles when its two legs are equal. If each leg is $x$, the hypotenuse squared is $x^{2}+x^{2}=2x^{2}$. A square root is a number that times itself makes a given number. So the hypotenuse is $x\\sqrt{2}$, where $\\sqrt{2}$ is the square root of 2, about 1.414.",
        "The height of a triangle is the straight-up distance from a side, called the base, to the opposite corner. A triangle's area is half of the base times the height. The sine is a number for each angle: in a right triangle, the side across from the angle divided by the hypotenuse. We write $\\sin C$ for the sine of angle $C$, and a calculator gives it. If two sides $a$ and $b$ meet at angle $C$, the height on side $a$ is $b\\sin C$. So the area is $\\frac{1}{2}ab\\sin C$.",
        "An altitude is a segment from a corner that meets the opposite side at a right angle. The altitude from the right angle to the hypotenuse makes two smaller triangles with the same shape as the big one. So a leg squared equals the whole hypotenuse times the part of the hypotenuse next to that leg.",
        "Keep all the digits on your calculator until the last step. To round to the nearest tenth means to keep one digit after the decimal point, choosing the closer value.",
      ],
    ],
    workedExample: {
      prompt:
        "A triangle has sides 10 and 12 with a $40^\\circ$ angle between them. Find its area to the nearest tenth.",
      steps: [
        "The $40^\\circ$ angle is between the sides 10 and 12, so use area $=\\frac{1}{2}ab\\sin C=\\frac{1}{2}\\cdot10\\cdot12\\cdot\\sin40^\\circ$.",
        "$\\frac{1}{2}\\cdot10\\cdot12=60$, and a calculator in degree mode gives $\\sin40^\\circ\\approx0.6428$. So the area is about $60\\cdot0.6428\\approx38.57$.",
        "Look at the hundredths, the second place after the decimal point. The digit there is 7, which is 5 or more, so round up to 38.6.",
      ],
      answer: "38.6 square units",
    },
    method: [
      "Pick the relationship, compute, round last",
      [
        "For an isosceles right triangle, multiply a leg by $\\sqrt{2}$ to get the hypotenuse, and divide the hypotenuse by $\\sqrt{2}$ to get a leg. For area, check that the angle is between the two sides, and set the calculator to degree mode. For the altitude, find the whole hypotenuse as the leg squared divided by the part next to that leg. Then subtract to find the other part.",
      ],
    ],
    formal: [
      "Relationships",
      [
        "A right triangle with two $45^\\circ$ angles has sides $x$, $x$ and $x\\sqrt{2}$. A triangle with sides $a$ and $b$ and the angle $C$ between them has area $\\frac{1}{2}ab\\sin C$. For altitude $\\overline{CD}$ to hypotenuse $\\overline{AB}$ of a right triangle with right angle $C$, $AC^{2}=AD\\cdot AB$.",
      ],
    ],
    pitfalls: [
      "Divide by $\\sqrt{2}$, not by 2, to go from the hypotenuse to a leg.",
      "Use the part of the hypotenuse next to the leg you are given.",
    ],
    parentGuide:
      "Ask for the diagonal of a square with side 1 and why it is longer than 1 but shorter than 2.",
  }),
  build({
    id: "third-side-triangle-inequality",
    title: "Which length can be the third side",
    summary:
      "The three sides of a triangle must be able to meet. Any two sides together must be longer than the third. So the third side is longer than the difference of the other two sides, the larger minus the smaller, and shorter than their sum. With sides 5 and 8, the third side is between 3 and 13.",
    senses: { side: "side", sides: "side", difference: "difference-subtract" },
    noLink: ["third", "range"],
    templateIds: ["rg-triangle-third-side-test"],
    objectives: [
      "State the range of possible third sides from two sides.",
      "Pick the length that fits, or the one that does not.",
    ],
    intuition: [
      "Sides that must reach each other",
      [
        "Picture two sticks, 5 cm and 8 cm long, joined at one end. Open them wide and the gap between their free ends gets close to $5+8=13$ cm. Close them up and the gap gets close to $8-5=3$ cm. The third side must fill that gap, so it is between 3 and 13 cm.",
        "At exactly 13 or exactly 3, the sticks lie flat in a straight line. That is not a triangle, so the third side cannot equal the sum or the difference.",
      ],
    ],
    workedExample: {
      prompt:
        "Two sides of a triangle are 6 and 11. Could 17 be the third side?",
      steps: [
        "Find the limits. The difference is $11-6=5$ and the sum is $6+11=17$. So the third side must be greater than 5 and less than 17.",
        "17 is not less than 17. With a third side of 17, the sides 6 and 11 lie flat along it in a straight line.",
      ],
      answer: "No. The third side must be between 5 and 17.",
    },
    method: [
      "Find the limits, then test",
      [
        "Subtract the two sides, larger minus smaller, for the lower limit. Add them for the upper limit. A possible third side is strictly between them: it cannot equal either limit.",
      ],
    ],
    formal: [
      "Triangle inequality",
      [
        "Three positive lengths form a triangle exactly when each is less than the sum of the other two. This is called the triangle inequality. At most means less than or equal to. For sides $a\\le b$ ($a$ is at most $b$), the third side $c$ satisfies $b-a<c<a+b$.",
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
