import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

export const realNumberLessons: Lesson[] = [
  {
    id: "rational-irrational-numbers",
    title: "Rational and irrational numbers",
    summary:
      "An integer is a whole number or its negative: …, −2, −1, 0, 1, 2, …. A rational number is one you can write as a fraction of two integers, with a bottom number that is not 0, such as $\\frac{3}{4}$ or $5 = \\frac{5}{1}$. Its decimal either ends, like 0.25, or repeats a block of digits forever, like 0.333…. A number on the number line that cannot be written that way is called irrational. Its decimal never ends and never repeats, like $\\sqrt{2}$ or $\\pi$.",
    templateIds: ["classify-real-number", "repeating-decimal-to-fraction"],
    includeGeneratedRepresentation: false,
    senses: {
      multiple: "multiple",
      sides: "side-of-equation",
      square: "square-number",
      squares: "square-number",
      factor: "factor-number",
      product: "product-multiply",
      opposite: "opposite-number",
      whole: "whole",
    },
    noLink: [
      "root",
      "roots",
      "tail",
      "tails",
      "cube",
      "leaves",
      "rule",
      "place",
      "places",
      "half",
      "quarters",
    ],
    objectives: [
      "Decide whether a root, fraction, decimal or multiple of $\\pi$ is rational or irrational.",
      "Write a repeating decimal as a fraction in simplest form.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Rational numbers",
        paragraphs: [
          "A half, three quarters and the whole number 5 can all be written as fractions: $\\frac{1}{2}$, $\\frac{3}{4}$ and $\\frac{5}{1}$. Numbers like these are called rational. This lesson uses fractions, decimals and long division. An integer is a whole number or its opposite, the whole number with a minus sign: …, −2, −1, 0, 1, 2, ….",
          "Precisely, a rational number is a quotient (the answer to a division) $\\frac{a}{b}$ of integers $a$ and $b$, where $b \\ne 0$ ($b$ is not equal to 0). Every integer is rational, because $5 = \\frac{5}{1}$ and $-8 = \\frac{-8}{1}$. A terminating decimal, one that ends, is rational too: $0.25 = \\frac{25}{100}$.",
          "Why must the decimal end or repeat? Write the fraction with a positive denominator (bottom number), moving any minus sign out front. Long division then gives its decimal. Each remainder, the amount left over at a step, is a whole number less than the denominator. If a remainder is 0, the decimal ends. If not, there are only so many possible remainders, so one comes back. From then on, the same block of digits repeats forever.",
          "A bar over digits marks the block that repeats: $\\frac{7}{9} = 0.777\\ldots = 0.\\overline{7}$ and $\\frac{3}{11} = 0.272727\\ldots = 0.\\overline{27}$.",
        ],
      },
      {
        title: "Irrational numbers",
        paragraphs: [
          "A number on the number line that is not rational is called irrational. Its decimal never ends and never repeats. The rational and irrational numbers together make up the real numbers: every point on the number line.",
          "The square root of a number is the number, zero or greater, that times itself gives it: $\\sqrt{16} = 4$ because 4 × 4 = 16. The square root of a whole number that is not a perfect square is irrational. A perfect square is a whole number times itself, such as 16 or 49. So $\\sqrt{2}$, $\\sqrt{12}$ and $\\sqrt{50}$ are irrational, but $\\sqrt{16} = 4$ and $\\sqrt{49} = 7$ are rational: a root sign alone does not make a number irrational. A cube root is the number that gives a number when three copies of it are multiplied. The cube root of 27, written $\\sqrt[3]{27}$, is 3, because $3^3 = 3 \\times 3 \\times 3 = 27$, so it is rational. Cube roots follow the same rule as square roots. No whole number cubed gives 20, so $\\sqrt[3]{20}$ is irrational.",
          "The number $\\pi$, the circumference of any circle divided by its diameter, is irrational. The fraction $\\frac{22}{7}$ and the decimal 3.14 are close to $\\pi$ but not equal to it; both are rational. A decimal built by a rule that never repeats, such as $0.1010010001\\ldots$ with one more 0 each time, is also irrational.",
        ],
      },
      {
        title: "Repeating decimals as fractions",
        paragraphs: [
          "Every repeating decimal is rational, and a subtraction shows which fraction it is. Call the number $x$. Multiplying by 10 moves every digit one place to the left. If the repeating block has 2 digits, multiply by $10^2 = 10 \\times 10 = 100$ instead. That moves the digits two places, so $100x$ (100 times $x$) has exactly the same endless tail after the decimal point as $x$.",
          "For $x = 0.\\overline{27} = 0.272727\\ldots$, $100x = 27.272727\\ldots$. Subtracting cancels the tails: $100x - x = 27$, so $99x = 27$ and $x = \\frac{27}{99} = \\frac{3}{11}$. Check by dividing: $3 \\div 11 = 0.2727\\ldots$.",
          "If a digit comes before the repeating block, first move it to the left of the point. For $x = 0.1\\overline{6} = 0.1666\\ldots$, $10x = 1.666\\ldots$ and $100x = 16.666\\ldots$. Then $100x - 10x = 16 - 1 = 15$, so $90x = 15$ and $x = \\frac{15}{90} = \\frac{1}{6}$.",
        ],
        illustration: "repeating-decimal-shift",
      },
    ],
    workedExample: {
      prompt: "Write $0.\\overline{36}$ as a fraction in simplest form.",
      steps: [
        "Call the number $x$, so $x = 0.\\overline{36} = 0.363636\\ldots$. The bar shows that the block 36 repeats. It has two digits.",
        "Multiply by $10^{2} = 100$ to shift the digits two places: $100x = 36.363636\\ldots$. Now $100x$ and $x$ have the same tail after the point.",
        "Subtract $x$ from $100x$ so the endless tails cancel: $100x - x = 36.3636\\ldots - 0.3636\\ldots = 36$. So $99x = 36$.",
        "Divide both sides (the amounts left and right of the equals sign) by 99 to get $x$ alone: $x = \\frac{36}{99}$. Then simplify by dividing top and bottom by 9, a number that divides both: $x = \\frac{4}{11}$.",
        "Check by dividing: 4 ÷ 11 = 0.3636…, the decimal we started with.",
      ],
      answer: "4/11",
    },
    closingSections: [
      {
        stage: "formal",
        title: "Precise rule",
        paragraphs: [
          "A number is rational exactly when it is a quotient of integers with a nonzero denominator; its decimal then ends or repeats. A square root of a whole number that is not a perfect square is irrational. So is a cube root of a whole number that no whole number cubed gives, and so is $\\pi$.",
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
      "Divide 1 by 7 on paper and list the remainders. When a remainder comes back, the digits start over. Then ask whether any whole number times itself gives 30, and what that says about $\\sqrt{30}$.",
  },
  {
    id: "approximate-roots",
    title: "Approximate square and cube roots",
    summary:
      "The square root of 20, written $\\sqrt{20}$, is the positive number that times itself makes 20. No whole number does: $4 \\times 4 = 16$ is too small and $5 \\times 5 = 25$ is too big. So $\\sqrt{20}$ is between 4 and 5. Squaring means multiplying a number by itself. Squaring tenths such as 4.4 and 4.5 narrows it further. Cube roots work the same way, using three copies of a number multiplied together.",
    templateIds: [
      "root-between-integers",
      "root-nearest-tenth",
      "compare-irrational-values",
    ],
    includeGeneratedRepresentation: false,
    objectives: [
      "Find the two consecutive whole numbers between which a square or cube root lies.",
      "Approximate a square root to the nearest tenth.",
      "Put roots, fractions and decimals in order.",
    ],
    senses: {
      interval: "interval",
      intervals: "interval",
      square: "square-number",
      squares: "square-number",
      squaring: "square-number",
      factor: "factor-number",
      cube: "cube",
    },
    noLink: ["root", "roots", "scales", "mean", "side", "place", "half"],
    sections: [
      {
        stage: "intuition",
        title: "Squares, cubes and their roots",
        paragraphs: [
          "This lesson uses multiplication of decimals. The square of a number is the number times itself, shown by a small raised 2: $4^2 = 4 \\times 4 = 16$. The square root of a number, written with the root sign as $\\sqrt{16}$, goes back the other way. It is the number, zero or greater, whose square is the given number, so $\\sqrt{16} = 4$.",
          "The cube of a number uses it as a factor (a number being multiplied) three times: $4^3 = 4 \\times 4 \\times 4 = 64$. The cube root, written $\\sqrt[3]{64}$, is the number whose cube is 64, so $\\sqrt[3]{64} = 4$.",
          "Bigger numbers have bigger squares and bigger square roots, for numbers zero or greater. Bigger numbers also have bigger cubes and cube roots. So squares put roots in order. The sign $<$ means “is less than”. Since $16 < 20 < 25$, we get $\\sqrt{16} < \\sqrt{20} < \\sqrt{25}$, which is $4 < \\sqrt{20} < 5$. Consecutive whole numbers are next to each other, 1 apart, like 4 and 5.",
        ],
      },
      {
        title: "Zoom in to tenths",
        paragraphs: [
          "Between 4 and 5 lie the tenths 4.1, 4.2, …, 4.9. Square them until 20 is caught: $4.4^2 = 19.36$ and $4.5^2 = 20.25$. Since $19.36 < 20 < 20.25$, $\\sqrt{20}$ is between 4.4 and 4.5. The figure shows this zoom on true scales: $\\sqrt{20}$ sits at about 4.47.",
          "To round to the nearest tenth, check which tenth is closer. Square the halfway point between them, 4.45: $4.45^2 = 19.8025$. Since $20 > 19.8025$, $\\sqrt{20}$ is greater than 4.45, so it is closer to 4.5 and $\\sqrt{20} \\approx 4.5$. Cube roots zoom the same way with cubes: $2.7^3 = 19.683$ and $2.8^3 = 21.952$, so $\\sqrt[3]{20}$ is between 2.7 and 2.8.",
        ],
        illustration: "root-zoom",
      },
      {
        title: "Compare numbers in different forms",
        paragraphs: [
          "To compare roots, fractions and decimals, place each one between consecutive tenths. $\\sqrt{30}$ is between 5.4 and 5.5 because $5.4^2 = 29.16$ and $5.5^2 = 30.25$. $\\sqrt[3]{170}$ is between 5.5 and 5.6 because $5.5^3 = 166.375$ and $5.6^3 = 175.616$. Dividing, $\\frac{16}{3} = 5.333\\ldots$, between 5.3 and 5.4.",
          "An interval is the stretch of numbers between two values. Numbers in intervals that do not overlap are ordered by their intervals: $\\frac{16}{3} < \\sqrt{30} < \\sqrt[3]{170}$. If two numbers share an interval, zoom again to hundredths. A larger number under the root sign does not mean a larger value: $\\sqrt[3]{170}$ is about 5.5, less than $\\sqrt{40}$, which is about 6.3.",
        ],
      },
    ],
    workedExample: {
      prompt: "Find $\\sqrt{20}$ to the nearest tenth.",
      steps: [
        "Find the whole numbers around it. $4^2 = 16$ and $5^2 = 25$. Since 20 is between 16 and 25, $\\sqrt{20}$ is between 4 and 5.",
        "Square tenths between 4 and 5 to narrow it: $4.4^2 = 19.36$ and $4.5^2 = 20.25$. Since 20 is between 19.36 and 20.25, $\\sqrt{20}$ is between 4.4 and 4.5.",
        "To see which tenth is nearer, square the halfway point: $4.45^2 = 19.8025$. The sign $>$ means “is greater than”. Since $20 > 19.8025$, $\\sqrt{20}$ is above 4.45.",
        "Above the halfway point means closer to 4.5. So $\\sqrt{20} \\approx 4.5$, where $\\approx$ means “is about”.",
      ],
      answer: "4.5",
    },
    closingSections: [
      {
        stage: "formal",
        title: "Precise rule",
        paragraphs: [
          "Squares and cubes keep order: if $a^2 < n < b^2$ for $a$ and $b$ zero or greater, then $a < \\sqrt{n} < b$.",
          "Because squaring keeps order for nonnegative numbers, comparing $n$ with the square of a halfway point shows which side of it $\\sqrt{n}$ lies on.",
          "Numbers that lie in intervals of a number line that do not overlap are ordered by those intervals.",
        ],
      },
    ],
    pitfalls: [
      "Do not halve the number: $\\sqrt{20}$ is between 4 and 5, not 10.",
      "Compare the number under the root with squares of candidates, not with the candidates themselves.",
      "A cube root of a large number can be smaller than a square root of a smaller number: $\\sqrt[3]{170} < \\sqrt{40}$.",
    ],
    parentGuide:
      "Draw a number line from 4 to 5 marked in tenths. Have the learner square 4.4 and 4.5 with pencil and paper. Then mark where $\\sqrt{20}$ must lie, and say whether it is nearer 4.4 or 4.5.",
  },
  {
    noLink: ["root", "roots"],
    id: "square-cube-equations",
    title: "Solve square and cube equations",
    summary:
      "To solve $x^2 = 49$ means to find every number $x$ that, times itself, makes 49. Both 7 and −7 work, because a negative times a negative is positive. So a positive number has two square roots, one positive and one negative. To solve $x^3 = 64$, find the number whose three copies multiply to make 64. Only 4 works. Every number has exactly one cube root.",
    templateIds: ["solve-square-cube-equation"],
    includeGeneratedRepresentation: false,
    senses: {
      square: "square-number",
      squares: "square-number",
      factor: "factor-number",
      product: "product-multiply",
      opposite: "opposite-number",
      cube: "cube",
    },
    objectives: [
      "Find every real solution of $x^2 = p$ for a positive $p$ and of $x^3 = p$ for any $p$.",
      "Write a solution with a root sign when it is not a whole number or a fraction.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Square roots come in pairs",
        paragraphs: [
          "This lesson uses multiplication of signed numbers (positive and negative numbers). A solution of an equation is a value of $x$ that makes it true. Squared means multiplied by itself: $x^2$ ($x$ squared) is $x \\times x$. So for $x^2 = 49$ we need numbers whose square is 49. $7^2 = 7 \\times 7 = 49$. Also $(-7)^2 = (-7) \\times (-7) = 49$, because a negative number times a negative number is positive.",
          "So $x^2 = 49$ has two solutions: $x = 7$ or $x = -7$. This is also written $x = \\pm 7$, where $\\pm$ stands for “plus or minus”.",
          "No other number works. A positive number greater than 7 has a square greater than 49, and one less than 7 has a smaller square. The same is true of their opposites, the matching negative numbers.",
          "A perfect square is a whole number times itself, like 49. When the number is not a perfect square, write the solutions with the root sign: $x^2 = 12$ gives $x = \\sqrt{12}$ or $x = -\\sqrt{12}$. The symbol $\\sqrt{12}$ alone means only the positive root. A square is never negative, so $x^2 = -9$ has no real solution.",
        ],
        illustration: "root-solutions",
      },
      {
        title: "Exactly one cube root",
        paragraphs: [
          "$x^3$ ($x$ cubed) means $x \\times x \\times x$. Cubing keeps the sign: $4^3 = 64$ and $(-4)^3 = (-4) \\times (-4) \\times (-4) = -64$. So $x^3 = 64$ has the single solution $x = 4$, and $x^3 = -64$ has the single solution $x = -4$. A larger number always has a larger cube, so no other number has the same cube.",
          "A perfect cube is a whole number cubed, like 64. When the number is not a perfect cube, write the answer with a cube root sign. The equation $x^3 = 20$ has one real solution, $x = \\sqrt[3]{20}$. It is between 2 and 3, because $2^3 = 8$ and $3^3 = 27$.",
        ],
      },
    ],
    workedExample: {
      prompt: "Find all real solutions of $x^2 = \\frac{9}{25}$.",
      steps: [
        "A solution is a number that, times itself, gives $\\frac{9}{25}$. Both 9 and 25 are perfect squares, so try the fraction of their square roots.",
        "$\\left(\\frac{3}{5}\\right)^2 = \\frac{3 \\times 3}{5 \\times 5} = \\frac{9}{25}$, so $\\frac{3}{5}$ works.",
        "Its negative works too: $\\left(-\\frac{3}{5}\\right)^2 = \\frac{9}{25}$, because a negative number times a negative number is positive.",
        "A square equation with a positive number has exactly these two solutions: $x = \\frac{3}{5}$ or $x = -\\frac{3}{5}$.",
      ],
      answer: "$x = \\frac{3}{5}$ or $x = -\\frac{3}{5}$",
    },
    closingSections: [
      {
        stage: "formal",
        title: "Precise rule",
        paragraphs: [
          "A real number is any number on the number line. For a positive real number $p$, the equation $x^2 = p$ has exactly two real solutions, $\\sqrt{p}$ and $-\\sqrt{p}$. For any real number $p$, the equation $x^3 = p$ has exactly one real solution, $\\sqrt[3]{p}$.",
        ],
      },
    ],
    pitfalls: [
      "$x^2$ means $x \\times x$, not $2x$: $x^2 = 49$ is not solved by $\\frac{49}{2}$.",
      "Do not drop the negative square root of a positive number.",
      "A cube equation has one solution, with the same sign as the number: $x^3 = 64$ gives only 4, because $(-4)^3 = -64$.",
    ],
    parentGuide:
      "Ask for two different numbers whose square is 36, then for a number whose cube is −8. Talk about why the second question has only one answer.",
  },
  {
    id: "scientific-notation",
    title: "Scientific notation",
    summary:
      "Very large and very small numbers are hard to read: 307,000 or 0.000307. Scientific notation writes them as a number from 1 up to (but not including) 10, times a power of 10. A power of 10 is 10 multiplied by itself, such as $10^5 = 100{,}000$. So $307{,}000 = 3.07 \\times 10^5$. The exponent, the small raised number, tells how many places the decimal point moves.",
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
    senses: {
      place: "place-value",
      places: "place-value",
      factor: "factor-number",
      coefficient: "coefficient",
      "standard form": "standard-form-number",
    },
    noLink: ["change", "leaves", "ones"],
    sections: [
      {
        stage: "intuition",
        title: "Powers of 10 and place value",
        paragraphs: [
          "This lesson uses place value and exponents. A power of 10 is 10 used as a factor (a number being multiplied) some number of times. The exponent, the small raised number, counts the 10s: $10^{3} = 10 \\times 10 \\times 10 = 1000$, and $10^{0} = 1$. A negative exponent means dividing by 10 that many times: $10^{-3} = \\frac{1}{10^{3}} = \\frac{1}{1000} = 0.001$.",
          "Each place in a number is worth 10 times the place to its right: thousands, hundreds, tens, ones, tenths, hundredths, thousandths.",
          "Multiplying by 10 moves every digit one place to the left, into a place worth 10 times as much. Dividing by 10 moves every digit one place to the right. The digits and their order do not change, so the same move can be pictured as the decimal point moving the other way: $3.07 \\times 10 = 30.7$ and $3.07 \\div 10 = 0.307$.",
        ],
      },
      {
        title: "Scientific notation and standard form",
        paragraphs: [
          "A number is in scientific notation when it is written as $a \\times 10^{n}$. The number in front, $a$, is called the coefficient, and it is at least 1 and less than 10. The exponent $n$ is an integer: a whole number (one of 0, 1, 2, …) or its negative. Standard form is the ordinary way of writing the number, with digits and a decimal point.",
          "To write $3.07 \\times 10^{5}$ in standard form, move the decimal point 5 places to the right and fill the empty places with zeros: 307,000. For $3.07 \\times 10^{-4}$, move it 4 places to the left: 0.000307. To go the other way, move the point until exactly one digit that is not 0 is to its left, and count the places moved. 0.000307 becomes 3.07 after 4 places to the right, so $0.000307 = 3.07 \\times 10^{-4}$.",
          "Numbers of 10 or more have positive exponents; numbers between 0 and 1 have negative exponents. A negative exponent makes a small positive number, not a negative number.",
        ],
        illustration: "decimal-point-shift",
      },
      {
        title: "How many times as large",
        paragraphs: [
          "To compare $6 \\times 10^{8}$ with $2 \\times 10^{5}$, divide: $\\frac{6 \\times 10^{8}}{2 \\times 10^{5}} = \\frac{6}{2} \\times \\frac{10^{8}}{10^{5}} = 3 \\times 10^{3} = 3000$. So $6 \\times 10^{8}$ is 3000 times as large as $2 \\times 10^{5}$. Dividing powers of 10 subtracts exponents, because $10^{8} \\div 10^{5}$ cancels five factors of 10 and leaves three.",
          "When the first coefficient is smaller, dividing the coefficients gives a number less than 1: $\\frac{2 \\times 10^{7}}{5 \\times 10^{3}} = 0.4 \\times 10^{4} = 4000$. So subtracting the exponents alone can give the wrong answer: here it gives $10^4 = 10{,}000$, not 4000.",
        ],
      },
    ],
    workedExample: {
      prompt: "Write $3.07 \\times 10^{-4}$ in standard form.",
      steps: [
        "The exponent is −4. Multiplying by $10^{-4}$ divides by 10 four times, so the decimal point moves four places to the left.",
        "The digits 3, 0 and 7 keep their order. Fill the empty places with zeros: $3.07 \\times 10^{-4} = 0.000307$.",
        "Check: the first digit, 3, is now in the ten-thousandths place, worth $\\frac{1}{10{,}000} = 10^{-4}$. That matches the exponent.",
      ],
      answer: "0.000307",
    },
    closingSections: [
      {
        stage: "formal",
        title: "Precise rule",
        paragraphs: [
          "For an integer $n$, multiplying by $10^n$ moves every digit $|n|$ places, where $|n|$ is the size of $n$ without its sign. The digits move to larger place values when $n$ is positive and to smaller ones when $n$ is negative.",
          "Every positive number can be written in exactly one way as $a \\times 10^{n}$ with $1 \\le a < 10$ ($a$ at least 1 and less than 10) and $n$ an integer.",
          "For $b \\ne 0$ and integer exponents $m$ and $n$, $\\frac{a \\times 10^m}{b \\times 10^n} = \\frac{a}{b} \\times 10^{m - n}$.",
        ],
      },
    ],
    pitfalls: [
      "The exponent is the number of places the point moves, not the number of zeros to write: $3.07 \\times 10^5 = 307{,}000$ has only three zeros.",
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
      "Scientific notation is a way to write a number as a coefficient from 1 up to 10 times a power of 10, like $3 \\times 10^4 = 30{,}000$. To multiply or divide two such numbers, work on the coefficients and the powers of 10 separately. To add or subtract, first rewrite them with the same power of 10, just as you add hundreds to hundreds. Then fix the coefficient so its size, ignoring any minus sign, is from 1 up to 10 again.",
    templateIds: ["scientific-operations"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Multiply and divide numbers in scientific notation using exponent rules.",
      "Add and subtract numbers in scientific notation by matching powers of 10.",
      "Write every result in scientific notation.",
    ],
    senses: {
      factor: "factor-number",
      coefficient: "coefficient",
      product: "product-multiply",
    },
    noLink: ["rules", "units", "like"],
    sections: [
      {
        stage: "intuition",
        title: "Multiply and divide",
        paragraphs: [
          "This lesson uses decimal arithmetic. A number in scientific notation is written $a \\times 10^{n}$. The coefficient $a$ is at least 1 and less than 10. The small raised number $n$ is called the exponent. It is an integer: a whole number (one of 0, 1, 2, …) or its negative. When it is positive, it counts how many 10s are multiplied. A negative exponent divides by 10 that many times instead.",
          "Numbers being multiplied, called factors, can be multiplied in any order and grouping. So $(3 \\times 10^{4}) \\times (4 \\times 10^{6}) = (3 \\times 4) \\times (10^{4} \\times 10^{6})$. Multiplying powers of 10 adds their exponents: $10^{4} \\times 10^{6}$ has $4 + 6 = 10$ factors of 10. The product, the answer when you multiply, is $12 \\times 10^{10}$.",
          "The coefficient 12 is not less than 10, so rewrite it: $12 = 1.2 \\times 10^{1}$, and $12 \\times 10^{10} = 1.2 \\times 10^{11}$. Dividing works the same way, but subtracts the exponents. For example, $(8 \\times 10^{9}) \\div (2 \\times 10^{3}) = 4 \\times 10^{6}$. When the coefficient quotient is less than 1, as in $(2 \\times 10^{9}) \\div (8 \\times 10^{3}) = 0.25 \\times 10^{6}$, rewrite $0.25 = 2.5 \\times 10^{-1}$ to get $2.5 \\times 10^{5}$.",
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
        "Factors can be multiplied in any order, so put the coefficients together and the powers of 10 together: $(3 \\times 4) \\times (10^{4} \\times 10^{6})$.",
        "Multiply the coefficients: $3 \\times 4 = 12$. Multiply the powers of 10 by adding exponents: $10^{4} \\times 10^{6} = 10^{4 + 6} = 10^{10}$. The product is $12 \\times 10^{10}$.",
        "The coefficient 12 is 10 or more, so this is not yet scientific notation. Rewrite it as $12 = 1.2 \\times 10^{1}$. Then $12 \\times 10^{10} = 1.2 \\times 10^{1} \\times 10^{10} = 1.2 \\times 10^{11}$.",
      ],
      answer: "$1.2 \\times 10^{11}$",
    },
    closingSections: [
      {
        stage: "formal",
        title: "Precise rule",
        paragraphs: [
          "For integers $m$ and $n$, $10^{m} \\times 10^{n} = 10^{m + n}$ and $10^{m} \\div 10^{n} = 10^{m - n}$. Adding or subtracting combines coefficients only when the powers of 10 are equal.",
        ],
      },
    ],
    pitfalls: [
      "Do not add exponents when adding numbers; match the powers of 10 first.",
      "After rewriting 12 as 1.2, raise the exponent by 1 so the value stays the same.",
      "Multiply exponents only for a power of a power, never for a product of two powers.",
    ],
    parentGuide:
      "Estimate first: $(3 \\times 10^4) \\times (4 \\times 10^6)$ should be about $10 \\times 10^{10}$. Ask the learner whether the exact result, $1.2 \\times 10^{11}$, fits that estimate.",
  },
];

export const realNumberMethods: Record<string, ProblemMethod> = {
  "classify-real-number": {
    noLink: ["root", "roots"],
    goal: "Pick the one rational (or irrational) number from four given numbers.",
    terms: [
      ["rational-number", "Its decimal either ends or repeats."],
      "irrational-number",
    ],
    senses: {
      square: "square-number",
      squares: "square-number",
      cube: "cube",
      whole: "whole",
    },
    intuition:
      "A square root is the number, zero or greater, that times itself gives a number: $\\sqrt{49} = 7$. A cube root is the number whose three copies multiply to make a given number: $\\sqrt[3]{8} = 2$. An integer is a whole number (one of 0, 1, 2, 3, …) or its negative. A rational number is a number that can be written as a fraction of two integers, with a bottom number that is not 0. Its decimal ends or repeats. An irrational number cannot be written that way; its decimal never ends and never repeats. A perfect square is a whole number times itself, like 49, so $\\sqrt{49} = 7$ is rational.",
    method: [
      "For a square root of a whole number, check whether the number is a perfect square. For a cube root, check whether it is a perfect cube, a whole number cubed. If so, the root is a whole number.",
      "Fractions, integers and decimals that end or repeat are rational.",
      "Square roots of whole numbers that are not perfect squares, cube roots of whole numbers that are not perfect cubes, $\\pi$ times a rational number other than 0, and decimals that never end and never repeat are irrational.",
    ],
    watch:
      "A root sign or an endless decimal alone does not make a number irrational.",
  },
  "repeating-decimal-to-fraction": {
    goal: "Write a repeating decimal as a fraction in simplest form.",
    terms: ["repeating-block"],
    noLink: ["whole", "tails", "tail", "leaves", "place", "places"],
    intuition:
      "A repeating decimal repeats a block of digits forever. A bar marks the block: $0.\\overline{27} = 0.272727\\ldots$. Call the decimal $x$. For a 2-digit block, multiplying by 100 shifts every digit two places left, so $100x$ and $x$ have the same endless tail. For a 3-digit block, use 1000. Subtracting cancels the tail.",
    method: [
      "Call the decimal $x$ and write out a few repetitions.",
      "Multiply $x$ by powers of 10 so that two copies have the same tail after the point.",
      "Subtract to cancel the tails, solve for $x$, and simplify the fraction.",
    ],
    watch: "Use 10 raised to the length of the repeating block, not always 10.",
  },
  "root-between-integers": {
    noLink: ["root", "roots", "side"],
    goal: "Find the two whole numbers next to each other that a square root or cube root lies between.",
    terms: ["perfect-square"],
    senses: {
      factor: "factor-number",
      square: "square-number",
      squares: "square-number",
      cube: "cube",
      cubes: "cube",
    },
    intuition:
      "A square root is the number, zero or greater, that times itself makes a given number: $\\sqrt{20}$ times itself makes 20. A cube root is the number whose three copies multiply to make a given number: $\\sqrt[3]{20}$ is that number for 20. Squaring means multiplying a number by itself. A perfect square is a whole number times itself, like 16 or 25. Since 20 is between 16 and 25, $\\sqrt{20}$ is between 4 and 5.",
    method: [
      "List perfect squares (or cubes) near the number under the root.",
      "Find the two that the number lies between.",
      "Their roots are the two whole numbers around the root.",
    ],
    watch:
      "Compare the number with squares, not with half of it: $\\sqrt{20}$ is between 4 and 5, not 10.",
  },
  "root-nearest-tenth": {
    goal: "Approximate a square root to the nearest tenth without a calculator.",
    senses: {
      square: "square-number",
      squares: "square-number",
    },
    noLink: ["root", "roots", "side", "half"],
    intuition:
      "A square root is the number, zero or greater, that times itself makes a given number: $\\sqrt{20}$ times itself makes 20. Squaring means multiplying a number by itself: $4.4^2 = 4.4 \\times 4.4 = 19.36$. For numbers zero or greater, bigger numbers have bigger squares, so squares show where the root sits.",
    method: [
      "Find the consecutive whole numbers around the root.",
      "Square tenths between them until the number is between two squares.",
      "Square the halfway point between those tenths to decide which is nearer.",
    ],
    watch:
      "Decide rounding with the halfway point's square, not by guessing from the two squares.",
  },
  "compare-irrational-values": {
    noLink: ["root", "roots", "mean"],
    goal: "Find the greatest or least of four roots, fractions and decimals.",
    senses: {
      factor: "factor-number",
      intervals: "interval",
      square: "square-number",
      squaring: "square-number",
      cube: "cube",
    },
    intuition:
      "A square root is the number, zero or greater, that times itself makes a given number, written $\\sqrt{n}$. A cube root is the number whose three copies multiply to make a given number, written $\\sqrt[3]{n}$. Squaring means multiplying a number by itself. To compare numbers in different forms, find the tenths each one lies between, for example 5.4 and 5.5.",
    method: [
      "Place each root between consecutive tenths by squaring or cubing tenths.",
      "Divide each fraction to find its tenths.",
      "Order the numbers by their intervals.",
    ],
    watch:
      "A larger number under the root sign does not mean a larger value when the roots differ.",
  },
  "solve-square-cube-equation": {
    noLink: ["root", "roots"],
    goal: "Find every real solution of $x^2 = p$ or $x^3 = p$.",
    terms: ["solution", "plus-or-minus"],
    senses: {
      opposite: "opposite-number",
      product: "product-multiply",
      factor: "factor-number",
      square: "square-number",
      squares: "square-number",
      cube: "cube",
      cubes: "cube",
    },
    intuition:
      "Squared means multiplied by itself: $x^2$ ($x$ squared) is $x \\times x$. Cubed means three copies multiplied: $x^3$ ($x$ cubed) is $x \\times x \\times x$. A solution is a value of $x$ that makes the equation true. Both 7 and −7 square to 49, because a negative times a negative is positive. But only 4 cubes to 64, since $(-4)^3 = -64$.",
    method: [
      "For $x^2 = p$ with $p > 0$, the solutions are $\\sqrt{p}$ and $-\\sqrt{p}$.",
      "For $x^3 = p$, the one solution is $\\sqrt[3]{p}$, with the same sign as $p$.",
      "Simplify a root of a perfect square or cube to a number.",
    ],
    watch:
      "A square equation with a positive number has two solutions, one positive and one negative. A cube equation has one.",
  },
  "scientific-to-standard": {
    goal: "Write a number given in scientific notation, $a \\times 10^{n}$, in standard form, the usual way with digits.",
    terms: ["standard-form-number"],
    senses: {
      "standard form": "standard-form-number",
      places: "place-value",
      place: "place-value",
    },
    intuition:
      "Scientific notation is a way to write a number as $a \\times 10^{n}$. The coefficient, the number in front, is $a$: 1 or more, and less than 10. It is multiplied by a power of 10. Multiplying by 10 moves the decimal point one place right, and dividing by 10 moves it one place left. The exponent $n$ counts those moves.",
    method: [
      "Move the decimal point as many places as the size of $n$: right if $n$ is positive, left if $n$ is negative.",
      "Fill any empty places with zeros.",
    ],
    watch:
      "The exponent counts places moved, not zeros written: $2.5 \\times 10^3 = 2500$ has two zeros.",
  },
  "standard-to-scientific": {
    noLink: ["change", "changes"],
    goal: "Write a number in standard form as $a \\times 10^{n}$ with $1 \\le a < 10$.",
    terms: ["scientific-notation"],
    senses: {
      "standard form": "standard-form-number",
      places: "place-value",
      place: "place-value",
    },
    intuition:
      "Scientific notation writes a number as $a \\times 10^{n}$. The coefficient $a$ is 1 or more, and less than 10; $1 \\le a < 10$ says that in symbols. The exponent $n$ counts how many places the decimal point moved. So $4500 = 4.5 \\times 10^3$.",
    method: [
      "Move the decimal point until exactly one digit that is not 0 is to its left.",
      "Count the places moved: that count is the size of the exponent.",
      "Make the exponent positive for numbers of 10 or more, negative for positive numbers less than 1, and 0 for numbers from 1 up to (not including) 10.",
    ],
    watch:
      "A coefficient of 10 or more, or less than 1, is not scientific notation.",
  },
  "scientific-times-larger": {
    noLink: ["parts", "part"],
    goal: "Find how many times as large one number in scientific notation is as another.",
    senses: {
      "standard form": "standard-form-number",
      factors: "factor-number",
      coefficient: "coefficient",
      quotient: "quotient",
    },
    intuition:
      "A number in scientific notation is a coefficient times a power of 10, like $6 \\times 10^8$. “How many times as large” asks what to multiply the second number by to get the first. Dividing answers it: $\\frac{6 \\times 10^8}{2 \\times 10^5} = 3 \\times 10^3 = 3000$.",
    method: [
      "Divide the number asked about by the number it is compared with.",
      "Divide the coefficients and subtract the exponents.",
      "Write the result in standard form.",
    ],
    watch:
      "When dividing the coefficients gives less than 1, the answer is less than the power of 10: $0.4 \\times 10^4 = 4000$.",
  },
  "scientific-operations": {
    noLink: ["change", "part", "parts"],
    goal: "Calculate with numbers in scientific notation and give the result in scientific notation.",
    senses: {
      factors: "factor-number",
      coefficient: "coefficient",
      product: "product-multiply",
    },
    intuition:
      "A number in scientific notation is a coefficient from 1 up to 10 times a power of 10, like $3.2 \\times 10^5$. Multiplying powers of 10 adds exponents, and dividing subtracts them. A product is the answer when you multiply. An integer is a whole number (one of 0, 1, 2, …) or its negative. Adding works only when the powers of 10 match, like adding hundreds to hundreds.",
    method: [
      "Multiply or divide: combine coefficients, then add or subtract exponents.",
      "Add or subtract: first rewrite both numbers with the same power of 10.",
      "Adjust the coefficient so its size, ignoring any minus sign, is 1 or more and less than 10. Change the exponent to keep the value.",
    ],
    watch:
      "Exponents add for a product, not for a sum; match powers of 10 before adding.",
  },
};

export const realNumberPrinciples: Record<string, string> = {
  "classify-real-number":
    "A number is rational exactly when it is a quotient of two integers with a denominator other than 0. Its decimal then ends or repeats. A square root of a whole number that is not a perfect square is irrational. So is a cube root of a whole number that no whole number cubed gives, and so is $\\pi$.",
  "repeating-decimal-to-fraction":
    "Multiplying by suitable powers of 10 aligns the repeating tails after the decimal point. Subtracting the aligned copies cancels that tail and leaves a whole number.",
  "root-between-integers":
    "Squares and cubes keep order: if $a^2 < n < b^2$ for $a$ and $b$ zero or greater, then $a < \\sqrt{n} < b$.",
  "root-nearest-tenth":
    "Squaring keeps order for numbers zero or greater. So comparing $n$ with the square of a halfway point shows which side of it $\\sqrt{n}$ lies on.",
  "compare-irrational-values":
    "Numbers that lie in intervals of a number line that do not overlap are ordered by those intervals.",
  "solve-square-cube-equation":
    "For $p > 0$, $x^2 = p$ has exactly two real solutions, $\\sqrt{p}$ and $-\\sqrt{p}$. For any real $p$, $x^3 = p$ has exactly one real solution, $\\sqrt[3]{p}$.",
  "scientific-to-standard":
    "For an integer $n$, multiplying by $10^n$ moves every digit $|n|$ places (the size of $n$): to larger place values when $n$ is positive, to smaller ones when $n$ is negative.",
  "standard-to-scientific":
    "Every positive number can be written in exactly one way as $a \\times 10^{n}$ with $1 \\le a < 10$ and $n$ an integer.",
  "scientific-times-larger":
    "For $b \\ne 0$ and integer exponents $m$ and $n$, $\\frac{a \\times 10^m}{b \\times 10^n} = \\frac{a}{b} \\times 10^{m - n}$.",
  "scientific-operations":
    "For integers $m$ and $n$, $10^{m} \\times 10^{n} = 10^{m + n}$ and $10^{m} \\div 10^{n} = 10^{m - n}$. Adding combines coefficients only of equal powers of 10.",
};
