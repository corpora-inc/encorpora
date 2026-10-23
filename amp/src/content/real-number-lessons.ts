import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

export const realNumberLessons: Lesson[] = [
  {
    id: "rational-irrational-numbers",
    title: "Rational and irrational numbers",
    summary:
      "A rational number is a quotient of integers with a nonzero denominator, so its decimal ends or repeats; a repeating decimal becomes a fraction by subtracting shifted copies with matching decimal tails.",
    templateIds: ["classify-real-number", "repeating-decimal-to-fraction"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Decide whether a root, fraction, decimal or multiple of $\\pi$ is rational or irrational.",
      "Write a repeating decimal as a fraction in simplest form.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Rational numbers",
        paragraphs: [
          "A half, three quarters, and the whole number 5 can all be written as fractions. Such numbers are rational. This lesson uses fractions, decimals, and long division. An integer is a whole number or the opposite of one: …, −2, −1, 0, 1, 2, …. Precisely, a rational number is a quotient $\\frac{a}{b}$ of integers $a$ and $b$ with $b\\ne0$. Every integer is rational, because $5=\\frac{5}{1}$ and $-8=\\frac{-8}{1}$. A terminating decimal is rational too: $0.25=\\frac{25}{100}$.",
          "Choose a positive denominator, moving any minus sign outside the fraction. Long division then gives the decimal of $a/b$. Each remainder is a whole number less than the positive denominator $b$. If a remainder is 0, the decimal ends. Otherwise there are only finitely many possible remainders, so one repeats and the same block of digits follows forever. Thus a rational decimal either ends or repeats.",
          "A bar over digits marks the block that repeats: $\\frac{7}{9} = 0.777\\ldots = 0.\\overline{7}$ and $\\frac{3}{11} = 0.272727\\ldots = 0.\\overline{27}$.",
        ],
      },
      {
        title: "Irrational numbers",
        paragraphs: [
          "A number on the number line that is not rational is irrational. Its decimal never ends and never repeats. The rational and irrational numbers together make up the real numbers.",
          "The square root of a whole number that is not a perfect square is irrational. A perfect square is a whole number times itself, such as 16 or 49. So $\\sqrt{2}$, $\\sqrt{12}$ and $\\sqrt{50}$ are irrational, but $\\sqrt{16} = 4$ and $\\sqrt{49} = 7$ are rational: a root sign alone does not make a number irrational. The same holds for cube roots: $\\sqrt[3]{27} = 3$ is rational because $3^3 = 27$, and $\\sqrt[3]{20}$ is irrational.",
          "The number $\\pi$, the circumference of any circle divided by its diameter, is irrational. The fraction $\\frac{22}{7}$ and the decimal 3.14 are close to $\\pi$ but not equal to it; both are rational. A decimal built by a rule that never repeats, such as $0.1010010001\\ldots$ with one more 0 each time, is also irrational.",
        ],
      },
      {
        title: "Repeating decimals as fractions",
        paragraphs: [
          "Every repeating decimal is rational, and a subtraction shows which fraction it is. Call the number $x$. Multiplying by 10 moves every digit one place to the left. If the repeating block has 2 digits, multiplying by $10^2 = 100$ moves the digits two places, so $100x$ has exactly the same endless tail after the decimal point as $x$.",
          "For $x = 0.\\overline{27} = 0.272727\\ldots$, $100x = 27.272727\\ldots$. Subtracting cancels the tails: $100x - x = 27$, so $99x = 27$ and $x = \\frac{27}{99} = \\frac{3}{11}$. Check by dividing: $3 \\div 11 = 0.2727\\ldots$.",
          "If a digit comes before the repeating block, first move it to the left of the point. For $x = 0.1\\overline{6} = 0.1666\\ldots$, $10x = 1.666\\ldots$ and $100x = 16.666\\ldots$. Then $100x - 10x = 16 - 1 = 15$, so $90x = 15$ and $x = \\frac{15}{90} = \\frac{1}{6}$.",
        ],
        illustration: "repeating-decimal-shift",
      },
    ],
    workedExample: {
      prompt: "Write $0.\\overline{36}$ as a fraction in simplest form.",
      steps: [
        "Let $x = 0.\\overline{36} = 0.363636\\ldots$. The repeating block 36 has two digits.",
        "Multiply by $10^{2} = 100$: $100x = 36.363636\\ldots$, which has the same tail as $x$.",
        "Subtract to cancel the tails: $100x - x = 36$, so $99x = 36$.",
        "Divide by 99 and reduce by the common factor 9: $x = \\frac{36}{99} = \\frac{4}{11}$.",
      ],
      answer: "4/11",
    },
    closingSections: [
      {
        stage: "formal",
        title: "Precise rule",
        paragraphs: [
          "A number is rational exactly when it is a quotient of integers with a nonzero denominator; its decimal then ends or repeats. The square or cube root of a whole number that is not a perfect square or cube is irrational, and so is $\\pi$.",
          "Multiplying by a suitable power of 10 aligns the repeating tails after the decimal point. Subtracting the two aligned copies cancels that tail and leaves a whole number.",
        ],
      },
    ],
    pitfalls: [
      "A root sign does not make a number irrational: $\\sqrt{49} = 7$.",
      "A decimal that goes on forever is irrational only if it never repeats: $0.\\overline{3} = \\frac{1}{3}$ is rational.",
      "$\\frac{22}{7}$ and 3.14 are rational numbers close to $\\pi$, not $\\pi$ itself.",
      "Multiply by 10 raised to the number of digits in the repeating block, not always by 10.",
    ],
    parentGuide:
      "Divide 1 by 7 on paper and list the remainders. When a remainder comes back, the digits start over. Then ask whether any whole number times itself gives 30, and what that says about √30.",
  },
  {
    id: "approximate-roots",
    title: "Approximate square and cube roots",
    summary:
      "Use nearby perfect squares or cubes to bracket a root, then refine the bracket to tenths.",
    templateIds: [
      "root-between-integers",
      "root-nearest-tenth",
      "compare-irrational-values",
    ],
    includeGeneratedRepresentation: false,
    objectives: [
      "Find the two consecutive whole numbers between which a square or cube root lies.",
      "Approximate a square root to the nearest tenth, and order roots, fractions and decimals.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Squares, cubes and their roots",
        paragraphs: [
          "This lesson uses multiplication of decimals. The square of a number is the number times itself: $4^2 = 4 \\times 4 = 16$. The square root $\\sqrt{n}$ of a nonnegative number $n$ is the nonnegative number whose square is $n$, so $\\sqrt{16} = 4$. The cube of a number uses it as a factor three times: $4^3 = 64$. The cube root $\\sqrt[3]{n}$ is the number whose cube is $n$, so $\\sqrt[3]{64} = 4$.",
          "For nonnegative numbers, a larger number has a larger square and a larger square root; for all numbers, a larger number has a larger cube and a larger cube root. So squares put roots in order. Since $16 < 20 < 25$, $\\sqrt{16} < \\sqrt{20} < \\sqrt{25}$, that is $4 < \\sqrt{20} < 5$. Consecutive whole numbers differ by 1, like 4 and 5.",
        ],
      },
      {
        title: "Zoom in to tenths",
        paragraphs: [
          "Between 4 and 5 lie the tenths 4.1, 4.2, …, 4.9. Square them until 20 is caught: $4.4^2 = 19.36$ and $4.5^2 = 20.25$. Since $19.36 < 20 < 20.25$, $\\sqrt{20}$ is between 4.4 and 4.5. The figure shows this zoom on true scales: $\\sqrt{20}$ sits at about 4.47.",
          "To round to the nearest tenth, square the halfway point 4.45: $4.45^2 = 19.8025$. Since $20 > 19.8025$, $\\sqrt{20}$ is greater than 4.45, so it is closer to 4.5 and $\\sqrt{20} \\approx 4.5$. Cube roots zoom the same way with cubes: $2.7^3 = 19.683$ and $2.8^3 = 21.952$, so $\\sqrt[3]{20}$ is between 2.7 and 2.8.",
        ],
        illustration: "root-zoom",
      },
      {
        title: "Compare numbers in different forms",
        paragraphs: [
          "To compare roots, fractions and decimals, place each one between consecutive tenths. $\\sqrt{30}$ is between 5.4 and 5.5 because $5.4^2 = 29.16$ and $5.5^2 = 30.25$. $\\sqrt[3]{170}$ is between 5.5 and 5.6 because $5.5^3 = 166.375$ and $5.6^3 = 175.616$. Dividing, $\\frac{16}{3} = 5.333\\ldots$, between 5.3 and 5.4.",
          "Numbers in different intervals are ordered by their intervals: $\\frac{16}{3} < \\sqrt{30} < \\sqrt[3]{170}$. If two numbers share an interval, zoom again to hundredths. A larger number under the root sign does not mean a larger value: $\\sqrt[3]{170}$ is about 5.5, less than $\\sqrt{40}$, which is about 6.3.",
        ],
      },
    ],
    workedExample: {
      prompt: "Find $\\sqrt{20}$ to the nearest tenth.",
      steps: [
        "$4^2 = 16$ and $5^2 = 25$. Since $16 < 20 < 25$, $\\sqrt{20}$ is between 4 and 5.",
        "Square tenths: $4.4^2 = 19.36$ and $4.5^2 = 20.25$. Since $19.36 < 20 < 20.25$, $\\sqrt{20}$ is between 4.4 and 4.5.",
        "Square the halfway point: $4.45^2 = 19.8025$. Since $20 > 19.8025$, $\\sqrt{20}$ is above 4.45.",
        "So $\\sqrt{20}$ is closer to 4.5: $\\sqrt{20} \\approx 4.5$.",
      ],
      answer: "4.5",
    },
    closingSections: [
      {
        stage: "formal",
        title: "Precise rule",
        paragraphs: [
          "Squares and cubes keep order: if $a^2 < n < b^2$ for nonnegative $a$ and $b$, then $a < \\sqrt{n} < b$.",
          "Because squaring keeps order for nonnegative numbers, comparing $n$ with the square of a halfway point shows which side of it $\\sqrt{n}$ lies on.",
          "Numbers that lie in different intervals of a number line are ordered by those intervals.",
        ],
      },
    ],
    pitfalls: [
      "Do not halve the number: $\\sqrt{20}$ is between 4 and 5, not 10.",
      "Compare the number under the root with squares of candidates, not with the candidates themselves.",
      "A cube root of a large number can be smaller than a square root of a smaller number: $\\sqrt[3]{170} < \\sqrt{40}$.",
    ],
    parentGuide:
      "Draw a number line from 4 to 5 marked in tenths. Have the learner square 4.4 and 4.5 with pencil and paper, then mark where √20 must lie and say whether it is nearer 4.4 or 4.5.",
  },
  {
    id: "square-cube-equations",
    title: "Solve square and cube equations",
    summary:
      "A positive number has two square roots, one positive and one negative; every number has exactly one real cube root.",
    templateIds: ["solve-square-cube-equation"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Find every real solution of $x^2 = p$ for a positive $p$ and of $x^3 = p$ for any $p$.",
      "Write solutions that are not whole numbers or fractions with root symbols.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Square roots come in pairs",
        paragraphs: [
          "This lesson uses multiplication of signed numbers. A solution of an equation is a value of $x$ that makes it true. For $x^2 = 49$ we need numbers whose square is 49. $7^2 = 49$, and $(-7)^2 = (-7)(-7) = 49$ because the product of two negative numbers is positive. So $x^2 = 49$ has two solutions: $x = 7$ or $x = -7$, also written $x = \\pm 7$.",
          "No other number works: a positive number greater than 7 has a square greater than 49, and a positive number less than 7 has a smaller square; the same is true of their opposites. When $p$ is not a perfect square, write the solutions with the root symbol: $x^2 = 12$ gives $x = \\sqrt{12}$ or $x = -\\sqrt{12}$. The symbol $\\sqrt{12}$ alone means only the positive root. A square is never negative, so $x^2 = -9$ has no real solution.",
        ],
        illustration: "root-solutions",
      },
      {
        title: "Exactly one cube root",
        paragraphs: [
          "Cubing keeps the sign: $4^3 = 64$ and $(-4)^3 = (-4)(-4)(-4) = -64$. So $x^3 = 64$ has the single solution $x = 4$, and $x^3 = -64$ has the single solution $x = -4$. A larger number always has a larger cube, so no other number has the same cube.",
          "When $p$ is not a perfect cube, write $x = \\sqrt[3]{p}$. The equation $x^3 = 20$ has one real solution, $x = \\sqrt[3]{20}$, which is between 2 and 3 because $2^3 = 8$ and $3^3 = 27$.",
        ],
      },
    ],
    workedExample: {
      prompt: "Find all real solutions of $x^2 = \\frac{9}{25}$.",
      steps: [
        "A solution is a number whose square is $\\frac{9}{25}$.",
        "$\\left(\\frac{3}{5}\\right)^2 = \\frac{3 \\times 3}{5 \\times 5} = \\frac{9}{25}$.",
        "The opposite works too: $\\left(-\\frac{3}{5}\\right)^2 = \\frac{9}{25}$, because the product of two negative numbers is positive.",
        "No other number works, so $x = \\frac{3}{5}$ or $x = -\\frac{3}{5}$.",
      ],
      answer: "$x = \\frac{3}{5}$ or $x = -\\frac{3}{5}$",
    },
    closingSections: [
      {
        stage: "formal",
        title: "Precise rule",
        paragraphs: [
          "A positive number has exactly two real square roots, $\\sqrt{p}$ and $-\\sqrt{p}$; every real number has exactly one real cube root.",
        ],
      },
    ],
    pitfalls: [
      "$x^2$ means $x \\times x$, not $2x$: $x^2 = 49$ is not solved by $\\frac{49}{2}$.",
      "Do not drop the negative square root of a positive number.",
      "Do not add a negative solution to a cube equation: $(-4)^3 = -64$, not 64.",
    ],
    parentGuide:
      "Ask for two different numbers whose square is 36, then for a number whose cube is −8. Talk about why the second question has only one answer.",
  },
  {
    id: "scientific-notation",
    title: "Scientific notation",
    summary:
      "Powers of 10 record how far a decimal point moves, so very large or very small numbers fit a short form.",
    templateIds: [
      "scientific-to-standard",
      "standard-to-scientific",
      "scientific-times-larger",
    ],
    includeGeneratedRepresentation: false,
    objectives: [
      "Convert large and small numbers between standard form and scientific notation.",
      "Find how many times as large one number in scientific notation is as another.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Powers of 10 and place value",
        paragraphs: [
          "This lesson uses place value and exponents. A power of 10 is 10 used as a factor some number of times: $10^{3} = 10 \\times 10 \\times 10 = 1000$, and $10^{0} = 1$. A negative exponent means dividing: $10^{-3} = \\frac{1}{10^{3}} = 0.001$. Each place in a number is worth 10 times the place to its right: thousands, hundreds, tens, ones, tenths, hundredths, thousandths.",
          "Multiplying by 10 moves every digit one place to the left, into a place worth 10 times as much. Dividing by 10 moves every digit one place to the right. The digits and their order do not change, so the same move can be pictured as the decimal point moving the other way: $3.07 \\times 10 = 30.7$ and $3.07 \\div 10 = 0.307$.",
        ],
      },
      {
        title: "Scientific notation and standard form",
        paragraphs: [
          "A number is in scientific notation when it is written as $a \\times 10^{n}$, where the coefficient $a$ is at least 1 and less than 10, and the exponent $n$ is an integer. Standard form is the ordinary way of writing the number with digits and a decimal point.",
          "To write $3.07 \\times 10^{5}$ in standard form, move the decimal point 5 places to the right and fill the empty places with zeros: 307,000. For $3.07 \\times 10^{-4}$, move it 4 places to the left: 0.000307. To go the other way, move the point until exactly one nonzero digit is to its left and count the places moved: 0.000307 becomes 3.07 after 4 places, so $0.000307 = 3.07 \\times 10^{-4}$.",
          "Numbers of 10 or more have positive exponents; numbers between 0 and 1 have negative exponents. A negative exponent makes a small positive number, not a negative number.",
        ],
        illustration: "decimal-point-shift",
      },
      {
        title: "How many times as large",
        paragraphs: [
          "To compare $6 \\times 10^{8}$ with $2 \\times 10^{5}$, divide: $\\frac{6 \\times 10^{8}}{2 \\times 10^{5}} = \\frac{6}{2} \\times \\frac{10^{8}}{10^{5}} = 3 \\times 10^{3} = 3000$. So $6 \\times 10^{8}$ is 3000 times as large as $2 \\times 10^{5}$. Dividing powers of 10 subtracts exponents, because $10^{8} \\div 10^{5}$ cancels five factors of 10 and leaves three.",
          "When the first coefficient is smaller, the coefficient quotient is less than 1: $\\frac{2 \\times 10^{7}}{5 \\times 10^{3}} = 0.4 \\times 10^{4} = 4000$. The difference of the exponents alone gives the size only to within a factor of 10.",
        ],
      },
    ],
    workedExample: {
      prompt: "Write $3.07 \\times 10^{-4}$ in standard form.",
      steps: [
        "Multiplying by $10^{-4}$ divides by 10 four times, so the decimal point moves four places to the left.",
        "The digits 3, 0 and 7 keep their order; fill the empty places with zeros: $3.07 \\times 10^{-4} = 0.000307$.",
        "Check: the leading digit 3 is in the ten-thousandths place, which has value $10^{-4}$.",
      ],
      answer: "0.000307",
    },
    closingSections: [
      {
        stage: "formal",
        title: "Precise rule",
        paragraphs: [
          "For integer $n$, multiplying by $10^n$ moves every digit $|n|$ places to a larger place value when $n$ is positive and to a smaller one when $n$ is negative.",
          "Every positive number can be written in exactly one way as $a \\times 10^{n}$ with $1 \\le a < 10$ and $n$ an integer.",
          "For $b\\ne0$ and integer exponents $m,n$, $\\frac{a\\times10^m}{b\\times10^n}=\\frac{a}{b}\\times10^{m-n}$.",
        ],
      },
    ],
    pitfalls: [
      "The exponent is the number of places the point moves, not the number of zeros to write.",
      "A coefficient of 10 or more, as in $30.7 \\times 10^{4}$, is not scientific notation.",
      "A negative exponent makes a small number, not a negative number.",
    ],
    parentGuide:
      "Write the digits 3, 0 and 7 on cards spaced across a table and use a coin as the decimal point. Move the coin and read each value aloud: 3.07, 30.7, 307, 3070.",
  },
  {
    id: "scientific-operations",
    title: "Calculate with scientific notation",
    summary:
      "Work with the short-number parts and the powers of 10 separately. Match the powers before adding or subtracting.",
    templateIds: ["scientific-operations"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Multiply and divide numbers in scientific notation using exponent rules.",
      "Add and subtract numbers in scientific notation by matching powers of 10, and write every result in scientific notation.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Multiply and divide",
        paragraphs: [
          "This lesson uses decimal arithmetic and scientific notation: $a \\times 10^{n}$ with a at least 1 and less than 10 and $n$ an integer. Factors can be multiplied in any order and grouping, so $(3 \\times 10^{4}) \\times (4 \\times 10^{6}) = (3 \\times 4) \\times (10^{4} \\times 10^{6})$. Multiplying powers of 10 adds exponents: $10^{4} \\times 10^{6}$ has $4 + 6 = 10$ factors of 10. The product is $12 \\times 10^{10}$.",
          "The coefficient 12 is not less than 10, so rewrite it: $12 = 1.2 \\times 10^{1}$, and $12 \\times 10^{10} = 1.2 \\times 10^{11}$. Division works the same way with subtraction: $(8 \\times 10^{9}) \\div (2 \\times 10^{3}) = 4 \\times 10^{6}$. When the coefficient quotient is less than 1, as in $(2 \\times 10^{9}) \\div (8 \\times 10^{3}) = 0.25 \\times 10^{6}$, rewrite $0.25 = 2.5 \\times 10^{-1}$ to get $2.5 \\times 10^{5}$.",
        ],
        illustration: "scientific-regroup",
      },
      {
        title: "Add and subtract",
        paragraphs: [
          "Adding combines like units: 3 hundreds and 4 hundreds make 7 hundreds. So coefficients can be added only when both numbers have the same power of 10. To add $3.2 \\times 10^{5}$ and $4.5 \\times 10^{4}$, rewrite the second number with $10^{5}$: $4.5 \\times 10^{4} = 0.45 \\times 10^{5}$.",
          "Then $3.2 \\times 10^{5} + 0.45 \\times 10^{5} = 3.65 \\times 10^{5}$. Subtraction is the same: $6.4 \\times 10^{7} - 3 \\times 10^{6} = 6.4 \\times 10^{7} - 0.3 \\times 10^{7} = 6.1 \\times 10^{7}$. Finally check the coefficient and adjust the exponent if needed: $6 \\times 10^{5} + 7 \\times 10^{5} = 13 \\times 10^{5} = 1.3 \\times 10^{6}$.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "Find $(3 \\times 10^{4}) \\times (4 \\times 10^{6})$. Write the answer in scientific notation.",
      steps: [
        "Regroup: $(3 \\times 4) \\times (10^{4} \\times 10^{6})$.",
        "$3 \\times 4 = 12$ and $10^{4} \\times 10^{6} = 10^{4 + 6} = 10^{10}$, so the product is $12 \\times 10^{10}$.",
        "Rewrite the coefficient: $12 = 1.2 \\times 10^{1}$, so $12 \\times 10^{10} = 1.2 \\times 10^{11}$.",
      ],
      answer: "$1.2 \\times 10^{11}$",
    },
    closingSections: [
      {
        stage: "formal",
        title: "Precise rule",
        paragraphs: [
          "$10^{m} \\times 10^{n} = 10^{m + n}$ and $10^{m} \\div 10^{n} = 10^{m - n}$; addition combines coefficients only of equal powers of 10.",
        ],
      },
    ],
    pitfalls: [
      "Do not add exponents when adding numbers; match the powers of 10 first.",
      "After rewriting 12 as 1.2, raise the exponent by 1 so the value stays the same.",
      "Multiply exponents only for a power of a power, never for a product of two powers.",
    ],
    parentGuide:
      "Estimate first: (3 × 10⁴) × (4 × 10⁶) should be about 10 × 10¹⁰. Ask the learner whether the exact result, 1.2 × 10¹¹, fits that estimate.",
  },
];

export const realNumberMethods: Record<string, ProblemMethod> = {
  "classify-real-number": {
    goal: "Pick the one rational (or irrational) number from four given numbers.",
    terms: [
      [
        "rational",
        "Equal to a quotient $\\frac{a}{b}$ of integers, $b \\neq 0$; its decimal ends or repeats.",
      ],
      [
        "irrational",
        "Real but not rational; its decimal never ends or repeats.",
      ],
    ],
    method: [
      "Under a root sign, check for a perfect square or cube: if so, the root is a whole number.",
      "Fractions, integers and decimals that end or repeat are rational.",
      "Roots of non-perfect squares or cubes, nonzero rational multiples of $\\pi$ and never-repeating decimals are irrational.",
    ],
    watch:
      "A root sign or an endless decimal alone does not make a number irrational.",
  },
  "repeating-decimal-to-fraction": {
    goal: "Write a repeating decimal as a fraction in simplest form.",
    terms: [
      ["repeating block", "The digits under the bar, which repeat forever."],
    ],
    method: [
      "Call the decimal $x$ and write out a few repetitions.",
      "Multiply $x$ by powers of 10 so that two copies have the same tail after the point.",
      "Subtract to cancel the tails, solve for $x$, and reduce the fraction.",
    ],
    watch: "Use 10 raised to the length of the repeating block, not always 10.",
  },
  "root-between-integers": {
    goal: "Find the consecutive whole numbers between which a square or cube root lies.",
    terms: [["perfect square", "A whole number times itself, such as 49."]],
    method: [
      "List perfect squares (or cubes) near the number under the root.",
      "Find the two that the number lies between.",
      "Their roots are the two whole numbers around the root.",
    ],
    watch: "Compare the number with squares, not with half of it.",
  },
  "root-nearest-tenth": {
    goal: "Approximate a square root to the nearest tenth without a calculator.",
    method: [
      "Find the consecutive whole numbers around the root.",
      "Square tenths between them until the number is between two squares.",
      "Square the halfway point between those tenths to decide which is nearer.",
    ],
    watch:
      "Decide rounding with the halfway point's square, not by guessing from the two squares.",
  },
  "compare-irrational-values": {
    goal: "Find the greatest or least of four roots, fractions and decimals.",
    method: [
      "Place each root between consecutive tenths by squaring or cubing tenths.",
      "Divide each fraction to find its tenths.",
      "Order the numbers by their intervals.",
    ],
    watch:
      "A larger number under the root sign does not mean a larger value when the roots differ.",
  },
  "solve-square-cube-equation": {
    goal: "Find every real solution of $x^2 = p$ or $x^3 = p$.",
    terms: [
      ["solution", "A value of $x$ that makes the equation true."],
      ["±", "Both the positive and the negative value."],
    ],
    method: [
      "For $x^2 = p$ with $p > 0$, the solutions are $\\sqrt{p}$ and $-\\sqrt{p}$.",
      "For $x^3 = p$, the one solution is $\\sqrt[3]{p}$, with the same sign as $p$.",
      "Simplify a root of a perfect square or cube to a number.",
    ],
    watch: "Squares have two roots; cubes have one.",
  },
  "scientific-to-standard": {
    goal: "Write $a \\times 10^{n}$ in standard form.",
    terms: [
      ["standard form", "The number written with digits and a decimal point."],
    ],
    method: [
      "Move the decimal point $n$ places: right if $n$ is positive, left if negative.",
      "Fill empty places with zeros.",
    ],
    watch: "The exponent counts places moved, not zeros written.",
  },
  "standard-to-scientific": {
    goal: "Write a number in standard form as $a \\times 10^{n}$ with $1 \\le a < 10$.",
    terms: [
      [
        "scientific notation",
        "$a \\times 10^{n}$ with a at least 1 and less than 10, $n$ an integer.",
      ],
    ],
    method: [
      "Move the decimal point until one nonzero digit is to its left.",
      "Count the places moved: that count is the size of the exponent.",
      "Make the exponent positive for numbers of 10 or more, negative for numbers less than 1.",
    ],
    watch:
      "A coefficient of 10 or more, or less than 1, is not scientific notation.",
  },
  "scientific-times-larger": {
    goal: "Find how many times as large one number in scientific notation is as another.",
    method: [
      "Divide the number asked about by the number it is compared with.",
      "Divide the coefficients and subtract the exponents.",
      "Write the result in standard form.",
    ],
    watch:
      "When the coefficient quotient is less than 1, the answer is less than the power of 10.",
  },
  "scientific-operations": {
    goal: "Calculate with numbers in scientific notation and give the result in scientific notation.",
    method: [
      "Multiply or divide: combine coefficients, then add or subtract exponents.",
      "Add or subtract: first rewrite both numbers with the same power of 10.",
      "Adjust the coefficient to be at least 1 and less than 10, changing the exponent to keep the value.",
    ],
    watch:
      "Exponents add for a product, not for a sum; match powers of 10 before adding.",
  },
};

export const realNumberPrinciples: Record<string, string> = {
  "classify-real-number":
    "A number is rational exactly when it is a quotient of integers with a nonzero denominator; its decimal then ends or repeats. The square or cube root of a whole number that is not a perfect square or cube is irrational, and so is $\\pi$.",
  "repeating-decimal-to-fraction":
    "Multiplying by suitable powers of 10 aligns the repeating tails after the decimal point. Subtracting the aligned copies cancels that tail and leaves a whole number.",
  "root-between-integers":
    "Squares and cubes keep order: if $a^2 < n < b^2$ for nonnegative $a$ and $b$, then $a < \\sqrt{n} < b$.",
  "root-nearest-tenth":
    "Because squaring keeps order for nonnegative numbers, comparing $n$ with the square of a halfway point shows which side of it $\\sqrt{n}$ lies on.",
  "compare-irrational-values":
    "Numbers that lie in different intervals of a number line are ordered by those intervals.",
  "solve-square-cube-equation":
    "A positive number has exactly two real square roots, $\\sqrt{p}$ and $-\\sqrt{p}$; every real number has exactly one real cube root.",
  "scientific-to-standard":
    "For integer $n$, multiplying by $10^n$ moves every digit $|n|$ places to a larger place value when $n$ is positive and to a smaller one when $n$ is negative.",
  "standard-to-scientific":
    "Every positive number can be written in exactly one way as $a \\times 10^{n}$ with $1 \\le a < 10$ and $n$ an integer.",
  "scientific-times-larger":
    "For $b\\ne0$ and integer exponents $m,n$, $\\frac{a\\times10^m}{b\\times10^n}=\\frac{a}{b}\\times10^{m-n}$.",
  "scientific-operations":
    "$10^{m} \\times 10^{n} = 10^{m + n}$ and $10^{m} \\div 10^{n} = 10^{m - n}$; addition combines coefficients only of equal powers of 10.",
};
