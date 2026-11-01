import type { FacetMapping } from "./coverage";
import { formatLessons, type FormatLessonEntry } from "./format-lesson-entry";

const entries: FormatLessonEntry[] = [
  {
    id: "fraction-forms-blanks",
    title: "A fraction as a decimal and a percent",
    summary:
      "To write a fraction as a decimal, divide the top number by the bottom number. Multiply that decimal by 100 to get the percent.",
    objectives: [
      "Write a fraction as a decimal by dividing its top number by its bottom number.",
      "Write a decimal as a percent by multiplying by 100.",
    ],
    intuition:
      "A fraction such as $\\frac{3}{8}$ has a top number, the numerator, and a bottom number, the denominator. It means 3 divided by 8. A fraction, a decimal and a percent can name the same amount. Dividing gives the decimal: $3\\div8=0.375$. A percent means “out of 100”, so 50% is 50 out of 100, or one half. To change a decimal to a percent, multiply by 100. This moves the decimal point two places to the right: $0.375\\times100=37.5$. So $\\frac{3}{8}$ is 37.5%.",
    terms: ["decimal", "percent"],
    method: [
      "Divide the numerator (the top number) by the denominator (the bottom number) to find the decimal.",
      "Multiply the decimal by 100, moving the point two places right, to find the percent.",
      "Check that the percent written over 100 simplifies to the original fraction.",
    ],
    watch:
      "Move the decimal point two places to the right, not one: 0.36 is 36%, not 3.6%.",
    principle:
      "A fraction $\\frac{n}{d}$ equals the decimal $n\\div d$ and the percent $\\frac{n}{d}\\times100\\%$. In lowest terms, the decimal ends when the denominator's only prime factors are 2 and 5, as with 4, 8, 20 and 25.",
    example: {
      prompt: "Write $\\frac{3}{20}$ as a decimal and a percent.",
      steps: [
        "Divide the numerator by the denominator: $3\\div20=0.15$.",
        "Multiply by 100 to get the percent: $0.15\\times100=15$, so the percent is 15%.",
        "Check: dividing the top and bottom of $\\frac{15}{100}$ by 5 gives $\\frac{3}{20}$, the fraction we started with.",
      ],
      answer: "0.15 and 15%.",
    },
    methodTitle: "Divide, then times 100",
    methodText: [
      "A denominator of 4, 5, 8, 20 or 25 gives a decimal that ends.",
      "A fraction with denominator 100 is already a percent: $\\frac{36}{100}=36\\%$.",
    ],
    formal:
      "A percent is a ratio to 100: $p\\%=\\frac{p}{100}$. So the fraction $\\frac{n}{d}$ matches the percent $p=\\frac{100n}{d}$, and the decimal is $\\frac{p}{100}$.",
    pitfalls: [
      "Do not put the digits of the fraction together, as in 0.38 for $\\frac{3}{8}$.",
      "Do not give the decimal with a percent sign: 0.36% is not 36%.",
    ],
    parentGuide:
      "Use a hundred-square grid to shade the percent and check that it matches the fraction.",
    noLink: ["whole", "change"],
  },
  {
    id: "decimal-mixed-number-blanks",
    title: "A decimal as a mixed number",
    summary:
      "The whole part stays; the digits after the point become a fraction over 10 or 100.",
    objectives: [
      "Write a decimal with tenths or hundredths as a mixed number.",
      "Choose the denominator 10 or 100 from the number of decimal places.",
    ],
    intuition:
      "A mixed number has a whole part and a fraction part. The digits left of the decimal point give the whole part. The digits right of it are tenths if there is one digit and hundredths if there are two: 3.7 is 3 and $\\frac{7}{10}$, and 4.25 is 4 and $\\frac{25}{100}$. The denominator is 10 or 100 because the places are tenths and hundredths.",
    terms: ["mixed-number", "tenth", "hundredth"],
    method: [
      "Write the whole number from the left of the point.",
      "Write the digits right of the point as the numerator.",
      "Use 10 as the denominator for one digit and 100 for two digits.",
    ],
    watch:
      "Keep the whole number out of the numerator: 3.7 is $3\\frac{7}{10}$, not $\\frac{37}{10}$ in a mixed number.",
    principle:
      "A decimal $w.d_1d_2$ equals $w+\\frac{d_1d_2}{100}$ and $w.d_1$ equals $w+\\frac{d_1}{10}$, written $w\\frac{d_1d_2}{100}$ as a mixed number.",
    example: {
      prompt: "Write 6.08 as a mixed number.",
      steps: [
        "The whole part is 6.",
        "The digits after the point are 08, which is 8 hundredths: $\\frac{8}{100}$.",
        "So $6.08=6\\frac{8}{100}$.",
      ],
      answer: "$6\\frac{8}{100}$.",
    },
    methodTitle: "Whole part, then the places",
    methodText: [
      "Count the decimal places: one place means tenths, two places mean hundredths.",
      "The fraction part can be reduced afterward, but the first form uses 10 or 100.",
    ],
    formal:
      "By place value, $0.d_1d_2=\\frac{d_1}{10}+\\frac{d_2}{100}=\\frac{10d_1+d_2}{100}$, so the numerator is the two-digit number $d_1d_2$.",
    pitfalls: [
      "Do not use 10 for a decimal with two places.",
      "Do not include the whole number in the numerator.",
    ],
    parentGuide:
      "Shade a tenths bar and a hundredths grid to see 0.7 and 0.25 as fractions of one whole.",
  },
  {
    id: "inequality-solution-blanks",
    title: "Solve an inequality with a negative coefficient",
    summary:
      "Undo the added or subtracted number first. Then divide by the number multiplying $x$. If it is negative, turn the sign around.",
    objectives: [
      "Solve inequalities such as $-2x+4\\ge10$, where the number multiplying $x$ is negative.",
      "Turn the inequality sign around when dividing both sides by a negative number.",
    ],
    intuition:
      "An inequality compares two amounts with a sign: $<$ (is less than), $>$ (is greater than), $\\le$ (is less than or equal to) or $\\ge$ (is greater than or equal to). Its two sides are the amounts left and right of the sign. A term is one part joined to the rest by $+$ or $-$, such as $-2x$ in $-2x+4$. The inequality's solution is every value of $x$ that makes it true. The number multiplying $x$ is called the coefficient: in $-3x$, it is $-3$. You solve an inequality like an equation, by doing the same thing to both sides, with one change. Multiplying or dividing both sides by a negative number flips the order. For example, $2<5$, but $-2>-5$, because $-2$ is to the right of $-5$ on a number line. So in $-3x>12$, dividing both sides by $-3$ gives $x<-4$, with the sign turned around. Check with $x=-5$: $-3\\times(-5)=15$, and 15 is greater than 12. First undo any added or subtracted number, then divide.",
    terms: ["coefficient", "solution-set"],
    method: [
      "Add or subtract the same number on both sides so the $x$-term stands alone.",
      "Divide both sides by the coefficient of $x$, the number multiplying it.",
      "If the coefficient is negative, turn the sign around: $<$ becomes $>$, and $\\le$ becomes $\\ge$.",
    ],
    watch:
      "Turn the sign around only when you multiply or divide by a negative number, never when you add or subtract.",
    principle:
      "If $p<q$ and $k$ is negative, then $kp>kq$. So when the coefficient $a$ is negative, $ax+b<c$ means the same as $x>\\frac{c-b}{a}$, and $ax+b\\le c$ means the same as $x\\ge\\frac{c-b}{a}$.",
    example: {
      prompt: "Solve $-2x+4\\ge10$.",
      steps: [
        "Subtract 4 from both sides to undo the + 4: $-2x\\ge6$.",
        "Divide both sides by $-2$. Dividing by a negative number turns the sign around: $x\\le-3$.",
        "Check with $x=-4$, a number in the answer: $-2\\times(-4)+4=8+4=12$, and 12 is at least 10.",
      ],
      answer: "$x\\le-3$.",
    },
    methodTitle: "Undo the number first, then flip",
    methodText: [
      "Test a number from your answer in the original inequality. Also test one outside it: with $x=0$, $-2\\times0+4=4$, which is less than 10, so 0 correctly fails.",
      "The boundary number, where the two sides are equal, is the same as for the equation. Only the direction needs care.",
    ],
    formal:
      "Multiplying by a negative number reverses the order of all numbers on the number line, like a mirror. So, with $a<0$, it changes $ax+b<c$ into $x>\\frac{c-b}{a}$.",
    pitfalls: [
      "Do not keep the same sign after dividing by a negative number.",
      "Undo the added number first. Do not divide it by the coefficient before moving it.",
    ],
    parentGuide:
      "Try a value on each side of the boundary in the original inequality to see which side is true.",
    senses: { side: "side-of-equation", term: "term-expression", rule: "rule" },
    noLink: ["change", "changes", "part"],
  },
  {
    id: "conversion-proportion-blanks",
    title: "Set up a conversion proportion",
    summary:
      "Write the conversion as a ratio of two units. Then write an equal ratio for your amount, with the units in the same order.",
    objectives: [
      "Write a unit conversion, such as 1 yard to 0.9 meter, as a ratio.",
      "Place the amount and the unknown in an equal ratio with the units in the same order.",
    ],
    intuition:
      "A ratio compares two amounts. It is written like $1:0.9$ and read “1 to 0.9”. A conversion factor says how two units compare. For example, 1 yard is about 0.9 meter, so yards and meters are in the ratio $1:0.9$. A proportion says two ratios are equal. To convert 40 yards, write a second ratio with the units in the same order, yards first and meters second: $40:x$. Here $x$ stands for the unknown number of meters. The proportion is $1:0.9=40:x$. Each ratio must list yards before meters. Mixing the order gives a wrong equation.",
    terms: ["proportion", "conversion-factor"],
    method: [
      "Write the conversion factor as a ratio, with the units in the order given.",
      "Write a second ratio with the amount to convert and the unknown, with the units in the same order.",
      "Set the two ratios equal. That is the proportion.",
    ],
    watch:
      "Keep the units in the same order in both ratios: yards first and meters second in each.",
    principle:
      "If two kinds of quantity are in proportion, then $a:b=c:d$, where $a$ and $c$ use one unit and $b$ and $d$ use the other. Then $d=\\frac{bc}{a}$, as long as $a$, $b$ and $d$ are not 0.",
    example: {
      prompt:
        "One yard is about 0.9 meter. Set up the proportion for the meters $x$ in 50 yards.",
      steps: [
        "The conversion factor is 1 yard to 0.9 meter, yards first: $1:0.9$.",
        "The amount to convert is 50 yards, and $x$ is its length in meters. Keep yards first: $50:x$.",
        "Set the ratios equal: $1:0.9=50:x$. Since 50 yards is 50 times 1 yard, $x$ is about $0.9\\times50=45$ meters.",
      ],
      answer: "$1:0.9=50:x$.",
    },
    methodTitle: "Same units in the same places",
    methodText: [
      "Check the setup with an easy amount: 1 yard should give 0.9 meter.",
      "The unknown always sits in the place of its unit.",
    ],
    formal:
      "Equal ratios are ratios with the same value. Two equal ratios $\\frac{a}{b}=\\frac{c}{d}$, with $a$, $b$ and $d$ not 0, give $d=\\frac{bc}{a}$. So a conversion like yards to meters, where 0 of one unit is 0 of the other, multiplies by the same fixed number, $\\frac{b}{a}$, every time.",
    pitfalls: [
      "Do not put the meters of one ratio against the yards of the other.",
      "Do not leave out the unknown. It takes the place of the converted amount.",
    ],
    parentGuide:
      "Ask what the conversion says for one yard, then what the same proportion says for several yards.",
    senses: { unit: "unit" },
    noLink: ["key", "factor", "side"],
  },
  {
    id: "exponential-parameters-blanks",
    title: "Read the parts of an exponential model",
    summary:
      "In $a\\cdot b^t$, $a$ is the starting amount. The number $b$ tells the percent it grows or shrinks each period.",
    objectives: [
      "Find the starting amount of an exponential model such as $800(0.94)^t$.",
      "Find the percent growth or decay (shrinking) each period from the base.",
    ],
    intuition:
      "A model is a formula that describes a real amount as time passes. In $P(t)=800(0.94)^t$, read “$P$ of $t$”, $P(t)$ is the amount after $t$ years. The small raised $t$ is an exponent: it says how many times to multiply by 0.94. So the amount is the starting amount times 0.94, multiplied $t$ times. At $t=0$ nothing has been multiplied yet, since $0.94^0=1$. So the starting amount is 800. The number being raised, 0.94, is called the base. Each year the amount is multiplied by 0.94, which is $1-0.06$. Multiplying by 0.94 keeps 94 percent of the amount, so 6 percent of it is lost each year. In the first year that is $800\\times0.06=48$. A base above 1, such as 1.25, is $1+0.25$. It means growth of 25 percent each year. In general, $a\\cdot b^t$ has starting amount $a$ and base $b$. The dot means multiply, and one period is one step of $t$, such as one year.",
    terms: [
      ["initial-value", "Here it is $a$ in $a\\cdot b^t$."],
      "growth-factor",
      [
        "growth-factor",
        "The percent rate is the change each period as a percent: $|b-1|\\times 100$.",
      ],
    ],
    method: [
      "Put $t=0$ into the model. Since $b^0=1$, the starting amount is $a$.",
      "Compare the base $b$ with 1. Greater than 1 means the amount grows. Between 0 and 1 means it shrinks.",
      "The percent change each period is the distance from $b$ to 1, written as a percent.",
    ],
    watch:
      "The base 0.94 means a 6 percent decrease each period, not a 94 percent change.",
    principle:
      "For $y=a\\cdot b^t$ with $a>0$ and $b>0$, the starting amount is $y(0)=a$. If $b>1$, the amount grows by $(b-1)\\times100$ percent each period. If $0<b<1$, it shrinks by $(1-b)\\times100$ percent each period.",
    example: {
      prompt: "A town's population is $P(t)=2{,}000(1.08)^t$. Describe it.",
      steps: [
        "Put $t=0$: $2{,}000\\times1.08^0=2{,}000\\times1=2{,}000$. The town starts with 2,000 people.",
        "The base, 1.08, is greater than 1, so the population grows.",
        "$1.08=1+0.08$, and 0.08 is 8 percent. So it grows by 8 percent each year.",
      ],
      answer: "Starts at 2,000 and increases by 8 percent a year.",
    },
    methodTitle: "Start, then compare with 1",
    methodText: [
      "Check with the next year: $2{,}000\\times1.08=2{,}160$. That is 160 more, and 160 is 8 percent of 2,000.",
      "The percent rate is the percent change each period. The base (here 1.08) and the percent rate (here 8 percent) are different numbers.",
    ],
    formal:
      "Write $b=1+r$, where $r$ is the fraction the amount changes by each period. Then $y=a(1+r)^t$, and each period's amount is $1+r$ times the one before. When $r$ is between $-1$ and 0, a positive amount shrinks each period, which is called decay.",
    pitfalls: [
      "Do not read the base as the percent.",
      "Do not use the starting amount as the amount after one period.",
    ],
    parentGuide:
      "Work out the amount after one year and compare it with the starting amount to see the percent change.",
    senses: { base: "base-exponent", model: "model" },
    noLink: ["change", "period", "population", "changes"],
  },
  {
    id: "circle-estimate-blanks",
    title: "Estimate a circle with 3.14",
    summary:
      "To estimate a circle's area, halve the diameter to get the radius $r$, then work out $3.14\\times r\\times r$.",
    objectives: [
      "Find the area of a circle from its diameter, using 3.14 for $\\pi$.",
      "Estimate $\\pi$ by dividing a circumference by a diameter.",
    ],
    intuition:
      "The center is the point in the middle of a circle. The diameter is the distance across the circle through the center. The radius $r$ is half of that, the distance from the center to the circle. The circumference is the distance around the circle. For every circle, the circumference divided by the diameter is the same number, about 3.14. That number is called $\\pi$ (pi). The area of a circle, the space inside it, is $\\pi r^2$. Squared means multiplied by itself: $r^2$, read “$r$ squared”, is $r\\times r$. To estimate, use 3.14 in place of $\\pi$. A sign 10 feet across has a radius of 5 feet. Its area is about $3.14\\times5\\times5=3.14\\times25=78.5$ square feet. Using the diameter in place of the radius would give four times too much, because $10\\times10$ is four times $5\\times5$.",
    terms: ["circumference", "diameter", "radius"],
    method: [
      "Find the radius: divide the diameter by 2.",
      "Multiply 3.14 by the radius, then by the radius again, to find the area.",
      "To estimate $\\pi$, divide the circumference by the diameter.",
    ],
    watch:
      "Use the radius, not the diameter, in the area: $3.14\\times r\\times r$.",
    principle:
      "The area of a circle of radius $r$ is $A=\\pi r^2$. Also $\\pi=\\frac{C}{d}$, where $C$ is the circumference and $d=2r$ is the diameter. Using 3.14 for $\\pi$ gives an estimate.",
    example: {
      prompt:
        "A circle is 8 feet across. Use 3.14 for $\\pi$ to estimate its area.",
      steps: [
        "8 feet across is the diameter. The radius is half of it: $8\\div2=4$ feet.",
        "The area is about $3.14\\times4\\times4=3.14\\times16=50.24$ square feet. It is an estimate, because 3.14 is close to $\\pi$ but not equal to it.",
      ],
      answer: "About 50.24 square feet.",
    },
    methodTitle: "Radius first",
    methodText: [
      "To estimate $\\pi$ from measurements: a circumference of 31.4 centimeters and a diameter of 10 centimeters give $31.4\\div10=3.14$.",
      "The result is an estimate, because measurements and 3.14 are both approximate.",
    ],
    formal:
      "The ratio $\\frac{C}{d}$ is the same for all circles, and it defines $\\pi$. The decimal 3.14 is close to $\\pi$. But $\\pi=3.14159\\ldots$ goes on forever without repeating, so no fraction or ending decimal equals it exactly.",
    pitfalls: [
      "Do not use the diameter as the radius.",
      "Do not divide the diameter by the circumference to estimate $\\pi$.",
    ],
    parentGuide:
      "Wrap a string around a can, measure it and the width of the can, and divide the two measurements.",
    senses: { square: "square-number", center: "center" },
    noLink: ["edge"],
  },
];

const built = formatLessons(entries);
export const formBlanksLessons = built.lessons;
export const formBlanksMethods = built.methods;
export const formBlanksPrinciples = built.principles;

const partial = (
  templateId: string,
  facetId: string,
  rationale: string,
): FacetMapping => ({ templateId, facetId, extent: "partial", rationale });
export const formBlanksFacetMappings: readonly FacetMapping[] = [
  partial(
    "fraction-forms-blanks",
    "percentages.core",
    "Choose the decimal and the percent of a fraction with denominator 4, 5, 8, 20 or 25 that ends as a decimal. Does not assess fractions that repeat, percents over 100, or ordering the three forms.",
  ),
  partial(
    "decimal-mixed-number-blanks",
    "decimal-fractions.tenths-hundredths-notation",
    "Choose the whole number, the numerator and the denominator of a mixed number equal to a decimal with one or two places and a whole part of 1 to 9. Does not assess reducing the fraction, decimals with three places, or models.",
  ),
  partial(
    "inequality-solution-blanks",
    "linear-inequalities.affine-solution-set",
    "Choose the solution of each of two inequalities $ax+b$ compared with $c$ whose coefficient is negative, with strict or inclusive symbols. Does not assess variables on both sides, graphing, or interval notation.",
  ),
  partial(
    "conversion-proportion-blanks",
    "ratios.core",
    "Choose the four parts of a proportion that converts yards to meters with the factor 0.9 or 0.91 and the first ratio fixed as the factor. Does not assess solving the proportion, other units, or unit-analysis with several conversions.",
  ),
  partial(
    "exponential-parameters-blanks",
    "exponential-models.HSF.LE.B.5",
    "Choose the initial value, the direction and the percent rate of $a\\cdot b^t$ with a rate of 4 to 25 percent. Does not assess models with other forms, rates per different periods, or interpreting the parts in the learner's own words.",
  ),
  partial(
    "circle-estimate-blanks",
    "circle-measurement.core",
    "Choose the radius and the area of a circle from its diameter with 3.14, or the measurements and the quotient that estimate $\\pi$. Does not assess exact answers in terms of $\\pi$, circumference with 3.14, or composite figures.",
  ),
];
