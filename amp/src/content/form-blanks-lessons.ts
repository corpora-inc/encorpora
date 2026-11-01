import type { FacetMapping } from "./coverage";
import { formatLessons, type FormatLessonEntry } from "./format-lesson-entry";

const entries: FormatLessonEntry[] = [
  {
    id: "fraction-forms-blanks",
    title: "A fraction as a decimal and a percent",
    summary:
      "Divide the numerator by the denominator for the decimal, then multiply by 100 for the percent.",
    objectives: [
      "Write a fraction as a decimal by dividing.",
      "Write a decimal as a percent by multiplying by 100.",
    ],
    intuition:
      "A fraction, a decimal and a percent can name the same amount. The fraction $\\frac{3}{8}$ means 3 divided by 8, which is 0.375. A percent means out of 100, so 0.375 is 37.5 hundredths of the whole, written 37.5%. To go from a decimal to a percent, multiply by 100, which moves the decimal point two places to the right.",
    terms: ["decimal", "percent"],
    method: [
      "Divide the numerator by the denominator to find the decimal.",
      "Multiply the decimal by 100, moving the point two places right, to find the percent.",
      "Check that the percent over 100 reduces to the original fraction.",
    ],
    watch:
      "Move the decimal point two places to the right, not one: 0.36 is 36%, not 3.6%.",
    principle:
      "A fraction $\\frac{n}{d}$ equals the decimal $n\\div d$ and the percent $\\frac{n}{d}\\cdot100\\%$. For $d$ with only the prime factors 2 and 5 the decimal ends.",
    example: {
      prompt: "Write $\\frac{3}{20}$ as a decimal and a percent.",
      steps: [
        "$3\\div 20=0.15$.",
        "$0.15\\times100=15$, so the percent is 15%.",
        "Check: $\\frac{15}{100}=\\frac{3}{20}$.",
      ],
      answer: "0.15 and 15%.",
    },
    methodTitle: "Divide, then times 100",
    methodText: [
      "A denominator of 4, 5, 8, 20 or 25 gives a decimal that ends.",
      "Fractions with denominator 100 are percents already: $\\frac{36}{100}=36\\%$.",
    ],
    formal:
      "A percent is a ratio to 100: $p\\%=\\frac{p}{100}$. So the fraction $\\frac{n}{d}$ corresponds to $p=\\frac{100n}{d}$, and the decimal is $\\frac{p}{100}$.",
    pitfalls: [
      "Do not put the digits of the fraction together, as in 0.38 for $\\frac{3}{8}$.",
      "Do not give the decimal with a percent sign: 0.36% is not 36%.",
    ],
    parentGuide:
      "Use a hundred-grid to shade the percent and check that it matches the fraction.",
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
      "Undo the constant, then divide by the negative coefficient and reverse the inequality symbol.",
    objectives: [
      "Solve $ax+b\;\\square\;c$ when $a$ is negative.",
      "Reverse the symbol when dividing by a negative number.",
    ],
    intuition:
      "Solving an inequality works like solving an equation, with one change. Multiplying or dividing both sides by a negative number reverses the order: $2<5$ but $-2>-5$. So in $-3x>12$, dividing both sides by $-3$ gives $x<-4$, with the symbol turned around. First undo any added or subtracted constant, then divide.",
    terms: ["coefficient", "solution-set"],
    method: [
      "Add or subtract to get the term with $x$ alone on one side.",
      "Divide both sides by the coefficient of $x$.",
      "If the coefficient is negative, reverse the symbol: $<$ becomes $>$ and $\\le$ becomes $\\ge$.",
    ],
    watch:
      "Reverse the symbol only when you divide or multiply by a negative number, not when you add or subtract.",
    principle:
      "If $a<b$ and $k<0$ then $ka>kb$. So $ax+b<c$ with $a<0$ is equivalent to $x>\\frac{c-b}{a}$, and $ax+b\\le c$ is equivalent to $x\\ge\\frac{c-b}{a}$.",
    example: {
      prompt: "Solve $-2x+4\\ge10$.",
      steps: [
        "Subtract 4 from both sides: $-2x\\ge6$.",
        "Divide both sides by $-2$ and reverse the symbol: $x\\le-3$.",
        "Check $x=-4$: $-2(-4)+4=12$, which is at least 10.",
      ],
      answer: "$x\\le-3$.",
    },
    methodTitle: "Constant first, then flip",
    methodText: [
      "Test a number from your answer in the original inequality.",
      "The boundary number is the same as for the equation; only the direction needs care.",
    ],
    formal:
      "Multiplication by a negative number is an order-reversing bijection of the real line, so it maps the solution set $\\{x: ax+b<c\\}$ to the reflected half-line, giving $x>\\frac{c-b}{a}$.",
    pitfalls: [
      "Do not keep the symbol after dividing by a negative number.",
      "Do not divide the constant by the coefficient before moving it: undo the constant first.",
    ],
    parentGuide:
      "Try a value on each side of the boundary in the original inequality to see which side is true.",
  },
  {
    id: "conversion-proportion-blanks",
    title: "Set up a conversion proportion",
    summary:
      "Write the conversion factor as a ratio, then an equal ratio with the same units in the same positions.",
    objectives: [
      "Write a unit conversion as a ratio.",
      "Place the amount and the unknown in an equal ratio with matching units.",
    ],
    intuition:
      "A conversion factor such as 1 yard is about 0.9 meter says that yards and meters are in the ratio $1:0.9$. To convert 40 yards, write an equal ratio with the same order of units: yards first, meters second, so $40:x$. The proportion is $1:0.9=40:x$. The key is that each ratio lists yards before meters; mixing the order gives a wrong equation.",
    terms: ["proportion", "conversion-factor"],
    method: [
      "Write the conversion factor with the units in the order given.",
      "Write the second ratio with the amount to convert and the unknown, with the same order of units.",
      "Set the two ratios equal.",
    ],
    watch:
      "Keep the units in the same order in both ratios: yards over meters on each side.",
    principle:
      "If quantities of two kinds are in proportion, then $a:b=c:d$, where $a$ and $c$ are in one unit and $b$ and $d$ in the other. Then $d=\\frac{bc}{a}$.",
    example: {
      prompt:
        "One yard is about 0.9 meter. Set up the proportion for the meters $x$ in 50 yards.",
      steps: [
        "The conversion factor is 1 yard to 0.9 meter: $1:0.9$.",
        "The amount to convert is 50 yards to $x$ meters: $50:x$.",
        "The proportion is $1:0.9=50:x$, and $x=0.9\\times50=45$ meters.",
      ],
      answer: "$1:0.9=50:x$.",
    },
    methodTitle: "Same units in the same places",
    methodText: [
      "Check the setup with a simple amount: 1 yard should give 0.9 meter.",
      "The unknown is always in the place of its unit.",
    ],
    formal:
      "Equality of ratios $\\frac{a}{b}=\\frac{c}{d}$ with $a,b,d\\ne0$ gives $d=\\frac{bc}{a}$, so a unit conversion is multiplication by the constant factor $\\frac{b}{a}$.",
    pitfalls: [
      "Do not put the meters of one ratio against the yards of the other.",
      "Do not leave out the unknown; it takes the place of the converted amount.",
    ],
    parentGuide:
      "Ask what the conversion says for one yard, then what the same proportion says for several yards.",
  },
  {
    id: "exponential-parameters-blanks",
    title: "Read the parts of an exponential model",
    summary:
      "In $a\\cdot b^t$, the number $a$ is the starting amount and the base $b$ gives the percent change each period.",
    objectives: [
      "Find the starting amount of an exponential model.",
      "Find the percent growth or decay each period from the base.",
    ],
    intuition:
      "In $P(t)=800(0.94)^t$ the amount after $t$ years is the starting amount times the base multiplied $t$ times. At $t=0$ the power is 1, so the starting amount is 800. Each year the amount is multiplied by 0.94, which is $1-0.06$: it loses 6 percent. A base above 1, such as 1.25, is $1+0.25$ and means growth of 25 percent a year.",
    terms: [
      ["initial-value", "Here it is $a$ in $a\\cdot b^t$."],
      "growth-factor",
      [
        "growth-factor",
        "The percent rate is the change each period as a percent: $|b-1|\\times 100$.",
      ],
    ],
    method: [
      "Put $t=0$ in the model: the starting amount is $a$.",
      "Compare the base $b$ with 1: greater means increases, less means decreases.",
      "The percent rate is the distance from $b$ to 1, written as a percent.",
    ],
    watch: "The base 0.94 means a 6 percent decrease, not a 94 percent change.",
    principle:
      "For $y=a\\cdot b^t$ with $a>0$ and $b>0$: $y(0)=a$; if $b>1$ the amount grows by $(b-1)\\cdot100$ percent per period, and if $0<b<1$ it decays by $(1-b)\\cdot100$ percent per period.",
    example: {
      prompt: "A town's population is $P(t)=2{,}000(1.08)^t$. Describe it.",
      steps: [
        "At $t=0$: $2{,}000\\times1=2{,}000$ people.",
        "The base 1.08 is greater than 1, so the population increases.",
        "$1.08=1+0.08$, so it grows by 8 percent each year.",
      ],
      answer: "Starts at 2,000 and increases by 8 percent a year.",
    },
    methodTitle: "Start, then compare with 1",
    methodText: [
      "Check by computing the next year: $2{,}000\\times1.08=2{,}160$, which is 8 percent more.",
      "The growth factor and the percent rate are different numbers.",
    ],
    formal:
      "Writing $b=1+r$ with $r=\\frac{y(t+1)-y(t)}{y(t)}$ constant, the model $y=a(1+r)^t$ has rate $r$ per period; $r<0$ is decay.",
    pitfalls: [
      "Do not read the base as the percent.",
      "Do not use the starting amount as the amount after one period.",
    ],
    parentGuide:
      "Compute the amount after one year and compare it with the starting amount to see the percent change.",
  },
  {
    id: "circle-estimate-blanks",
    title: "Estimate a circle with 3.14",
    summary:
      "Use the radius, half the diameter, in $\\pi r^2$ with 3.14 for $\\pi$; and $\\pi$ is the circumference divided by the diameter.",
    objectives: [
      "Find the area of a circle from its diameter using 3.14 for $\\pi$.",
      "Estimate $\\pi$ by dividing a circumference by a diameter.",
    ],
    intuition:
      "The number $\\pi$ is the same for every circle: the circumference divided by the diameter, about 3.14. To estimate an area, half the diameter gives the radius $r$, and the area is $\\pi r^2$, with 3.14 in place of $\\pi$. A sign 10 feet across has radius 5 feet, and area about $3.14\\times25=78.5$ square feet. Using the diameter in place of the radius would give four times too much.",
    terms: ["circumference", "diameter", "radius"],
    method: [
      "Find the radius: divide the diameter by 2.",
      "Multiply 3.14 by the radius twice to find the area.",
      "To estimate $\\pi$, divide the circumference by the diameter.",
    ],
    watch: "Square the radius, not the diameter, in the area formula.",
    principle:
      "The area of a circle of radius $r$ is $A=\\pi r^2$, and $\\pi=\\frac{C}{d}$ where $C$ is the circumference and $d=2r$ the diameter. Replacing $\\pi$ by 3.14 gives an estimate.",
    example: {
      prompt:
        "A circle is 8 feet across. Use 3.14 for $\\pi$ to estimate its area.",
      steps: [
        "The radius is $8\\div2=4$ feet.",
        "The area is about $3.14\\times4\\times4=3.14\\times16=50.24$ square feet.",
      ],
      answer: "About 50.24 square feet.",
    },
    methodTitle: "Radius first",
    methodText: [
      "To estimate $\\pi$ from measurements, a circumference of 31.4 centimeters and a diameter of 10 give $31.4\\div10=3.14$.",
      "The result is an estimate because measurements and 3.14 are approximate.",
    ],
    formal:
      "The ratio $C/d$ is the same for all circles, which defines $\\pi$; the decimal 3.14 is a rational approximation to the irrational number $\\pi=3.14159\\ldots$.",
    pitfalls: [
      "Do not use the diameter as the radius.",
      "Do not divide the diameter by the circumference to estimate $\\pi$.",
    ],
    parentGuide:
      "Wrap a string around a can, measure it and the width of the can, and divide the two measurements.",
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
