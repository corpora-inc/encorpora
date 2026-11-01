import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

const selectStep =
  "Decide each statement on its own, then choose exactly the number of true statements the question asks for.";
/** Equation sets come as a list to choose from or as true-or-false pairs. */
const judgeStep =
  "Decide each equation on its own. In a list, choose exactly the number of true equations asked for; in true-or-false pairs, choose the one correct claim for each equation.";

export const mcasGapMethods: Record<string, ProblemMethod> = {
  "fact-equation-truth-select": {
    goal: "Decide which multiplication and division equations are true, with the result written on either side.",
    intuition:
      "An equation is true when both sides name the same number. A multiplication fact and its division facts say the same thing: if $6\\times8=48$ then $48\\div6=8$ and $48\\div8=6$. So you can test any division by multiplying the answer back.",
    terms: ["quotient", "fact-family"],
    method: [
      "Find the side with the operation. It can be on either side: $7=63\\div9$ says the same as $63\\div9=7$.",
      "For a division, multiply the quotient by the divisor. The result must be the dividend.",
      "Compare with the number on the other side. The equation is true only if they match.",
      judgeStep,
    ],
    watch:
      "Do not accept an equation because the numbers look familiar. $7\\times8=54$ uses the right numbers and is false.",
  },
  "mcas-round-hundred-select": {
    goal: "Choose every number that rounds to a stated hundred.",
    intuition:
      "Rounding to the nearest hundred moves a number to the closest multiple of 100. The halfway point decides: numbers from 50 below a hundred up to 49 above it round to that hundred, so 250 rounds to 300 but 249 rounds to 200.",
    terms: [
      ["round", "To the nearest hundred means to the closest multiple of 100."],
    ],
    method: [
      "Find the two hundreds the number lies between.",
      "Look at its tens digit. A digit of 5 or more rounds up to the larger hundred, and 4 or less rounds down.",
      "Keep the numbers that land on the stated hundred.",
      selectStep,
    ],
    watch:
      "A number just past the halfway point goes to the next hundred: 650 rounds to 700, not 600.",
  },
  "mcas-prime-factor-select": {
    goal: "Choose the prime numbers in a list, or the factors of a number that include no multiples of it.",
    intuition:
      "A factor of a number divides it with nothing left over. A prime number has exactly two factors, 1 and itself, so a number with any other factor is composite. A multiple of a number, such as 128 for 64, is larger than it and is never a factor.",
    terms: ["prime-number", "factor-number"],
    method: [
      "For a prime question, look for a small factor: 2 for an even number, 3 when the digits add to a multiple of 3, 5 for a last digit of 0 or 5, then 7.",
      "For a factor question, divide the number by each candidate. Keep it only when the division leaves no remainder.",
      "Reject any candidate larger than the number, because it is a multiple.",
      selectStep,
    ],
    watch:
      "Odd numbers are not all prime: 51 is $3\\times17$ and 91 is $7\\times13$.",
  },
  "mcas-comparison-equations-select": {
    goal: "Choose the equations that find the unknown in a times-as-many or more-than story, with the larger or the smaller amount unknown.",
    intuition:
      "A story about “times as many” has the multiplication and the two related divisions. A story about “more than” has the addition and the two related subtractions. Each true equation is one of these, and an equation that mixes the operations is not.",
    terms: ["times-as-many", "more-than"],
    method: [
      "Decide whether the story compares by multiplication or by addition, and which amount the letter stands for.",
      "Find the letter's value. When the larger amount is given, divide or subtract to find the smaller one.",
      "Substitute that value for the letter in each equation and see whether both sides match.",
      selectStep,
    ],
    watch:
      "“4 more than” is not “4 times as many”: the first adds 4, the second multiplies by 4.",
  },
  "mcas-true-product-equations": {
    goal: "Decide which stated products of a three-digit and a one-digit number are correct.",
    intuition:
      "Multiplying place by place splits a number into hundreds, tens and ones, multiplies each part, then adds. Mistakes come from forgetting to add a regrouped ten or hundred, or from putting a part in the wrong place.",
    terms: ["regroup"],
    method: [
      "Split the three-digit number into hundreds, tens and ones.",
      "Multiply each part by the one-digit number: for $453\\times6$ that is $2{,}400+300+18$.",
      "Add the three products and compare with the product in the equation, on whichever side it is written.",
      judgeStep,
    ],
    watch:
      "Check the tens and hundreds of the product, not only the ones digit. A wrong answer can have the right last digit.",
  },
  "mcas-prism-range-select": {
    goal: "Find the volume of each prism, then choose the two whose volumes together meet a condition.",
    intuition:
      "The volume of a rectangular prism is its length times its width times its height, in cubic units. Volume adds: two prisms together hold the sum of their volumes.",
    terms: [
      "volume",
      [
        "unit-cube",
        "A cubic centimeter is the volume of a unit cube with 1 cm edges.",
      ],
    ],
    method: [
      "Multiply length, width and height to find each volume.",
      "Add the volumes of two prisms at a time.",
      "Keep the pair whose total fits the condition. Only one pair does.",
      selectStep,
    ],
    watch:
      "Compare the sum of the two volumes, not each volume alone, with the range.",
  },
  "mcas-ratio-statements-select": {
    goal: "Choose the true statements that compare counts as part to part, part to whole or whole to part.",
    intuition:
      "A ratio is a comparison of two amounts in a set order. We write 5 red to 12 blue as $5:12$, read “5 to 12”. The order matters: $5:12$ is not $12:5$. A part is one group, such as the red marbles. The whole is all the objects together. A part-to-whole ratio is a ratio that puts the total second. A whole-to-part ratio puts it first. Equivalent ratios are ratios that compare the same way. You get one by multiplying or dividing both numbers by the same number, not 0: $6:15=2:5$.",
    senses: { part: "part", whole: "whole", square: "square-shape" },
    noLink: ["terms"],
    terms: ["part-to-part-ratio", "part-to-whole-ratio", "equivalent-ratios"],
    method: [
      "Write each count and the total of all the objects.",
      "Put the counts in the order the words give: the first amount named goes first.",
      "A stated ratio is true if it equals that ratio, or an equal ratio made by multiplying or dividing both numbers by the same number other than 0.",
      selectStep,
    ],
    watch:
      "Check whether the second number is a part or the whole. Red to blue uses the blue count, not the total.",
  },
  "mcas-true-quotient-equations": {
    goal: "Choose the true division equations with two-digit divisors and multidigit dividends.",
    intuition:
      "A quotient is correct when multiplying it by the divisor gives back the dividend. An estimate with friendly numbers shows whether the size of the quotient is right before any exact check.",
    terms: ["dividend", "divisor"],
    method: [
      "Estimate: round the divisor and dividend to friendly numbers and divide to see the size of the quotient.",
      "Multiply the stated quotient by the divisor, place by place.",
      "The equation is true only if the product equals the dividend.",
      judgeStep,
    ],
    watch:
      "A zero in the quotient is easy to lose: $4{,}305\\div21=205$, not 25. The estimate shows the quotient must be in the hundreds.",
  },
  "mcas-cube-prism-statements": {
    goal: "Choose the true statements about the cubes, count and volume of a prism packed with cubes of unit-fraction edge.",
    intuition:
      "A cube with edge $\\frac{1}{n}$ unit needs $n$ of them to span 1 unit. Its volume is $\\frac{1}{n^{3}}$ cubic unit, because it takes $n\\times n\\times n$ of them to make a cube of edge 1. Counting the small cubes and multiplying the edge lengths give the same volume.",
    terms: ["unit-fraction"],
    method: [
      "Divide each edge of the prism by the cube's edge to count the cubes along it.",
      "Multiply the three counts to find the number of cubes.",
      "Multiply the number of cubes by the volume of one cube. This equals the product of the three edge lengths.",
      selectStep,
    ],
    watch:
      "The volume of one cube is $\\frac{1}{n^{3}}$, not $\\frac{1}{n}$: all three edges are shortened.",
  },
  "mcas-statistical-question-select": {
    goal: "Choose the questions that expect data with different values from different people, items or times.",
    intuition:
      "Data is a set of values collected by asking or measuring. A statistical question is a question answered with data whose values vary, meaning they differ. “How many minutes does each student read?” is statistical, because the students give different values. “How many minutes did Sam read today?” is not: it asks for one value. A question about one person can still be statistical if it asks for many values, such as Sam's time for each lap of a swim. The final answer may be one summary number. What matters is that the data behind it vary.",
    noLink: ["whole"],
    terms: ["statistical-question", "variability"],
    method: [
      "Ask what data you would collect to answer the question.",
      "If you would get one fixed value, it is not statistical.",
      "If you would get many values that differ, it is statistical.",
      selectStep,
    ],
    watch:
      "A question about one person at one moment, such as “How many cakes did Sam order today?”, asks for one value and is not statistical.",
  },
  "mcas-fraction-rate-select": {
    goal: "Check stated speeds in miles per hour by dividing fractional distances by fractional times.",
    intuition:
      "A rate is a comparison of two different kinds of amounts, such as miles and hours. A speed is the distance traveled in one unit of time, such as miles per hour. It is the distance divided by the time. In a fraction, the top number is called the numerator and the bottom number is called the denominator. A mixed number is a whole number and a fraction together, such as $2\\frac{1}{2}$. Write it as one fraction first: $2\\frac{1}{2}=\\frac{5}{2}$. A reciprocal is a fraction flipped over: the reciprocal of $\\frac{3}{4}$ is $\\frac{4}{3}$. Dividing by a fraction is the same as multiplying by its reciprocal. Dividing in the wrong order, time by distance, gives hours per mile, a different rate.",
    senses: { unit: "unit" },
    terms: ["unit-rate", "reciprocal"],
    method: [
      "Write each mixed number as a fraction.",
      "Divide the distance by the time: multiply the distance by the reciprocal of the time.",
      "Simplify and compare with each stated speed for that day.",
      selectStep,
    ],
    watch:
      "Distance goes on top. Dividing time by distance gives hours per mile, which is not a speed in miles per hour.",
  },
  "mcas-negative-fraction-forms": {
    goal: "Choose the expressions equal to a stated fraction by counting negative signs and checking the fraction's orientation.",
    intuition:
      "A fraction bar means division: $\\frac{3}{4}$ is $3\\div4$. The top number is called the numerator, and the bottom number is called the denominator. A negative sign can sit on the numerator, on the denominator or in front. All three places give the same value: $\\frac{-3}{4}=\\frac{3}{-4}=-\\frac{3}{4}$. That is because a negative divided by a positive is negative, and so is a positive divided by a negative. Two negative signs cancel: $\\frac{-3}{-4}=\\frac{3}{4}$, because a negative divided by a negative is positive.",
    terms: ["opposite-number"],
    method: [
      "Count the negative signs in the numerator, the denominator and in front.",
      "For a fraction that is not 0, an odd count (1 or 3) gives a negative value. An even count (0 or 2) gives a positive value.",
      "Check the size too. Without its signs, the choice must equal the target without its signs, with the numerator and denominator not swapped.",
      selectStep,
    ],
    watch:
      "$\\frac{-7}{-2}$ is positive, because the two negatives cancel, and $-\\frac{2}{7}$ is a different size from $-\\frac{7}{2}$.",
  },
  "mcas-markup-price-select": {
    goal: "Choose the items whose selling price is correct for a stated percent above or below the cost.",
    intuition:
      "A percent is a number out of 100: 40 percent means 40 out of every 100. So 40 percent of a 50-dollar cost is $\\frac{40}{100}\\times50=20$ dollars. A price 40 percent above the cost adds that amount: $50+20=70$ dollars. A price 40 percent below the cost subtracts it: $50-20=30$ dollars. The 20 dollars alone is not the price.",
    noLink: ["part"],
    terms: ["percent"],
    method: [
      "Find the stated percent of the cost: multiply the cost by the percent over 100.",
      "Add it for a price above the cost, or subtract it for a price below.",
      "Keep the items whose stated price matches.",
      selectStep,
    ],
    watch:
      "The percent of the cost is not the price. Add it to or subtract it from the cost.",
  },
  "mcas-rational-irrational-select": {
    goal: "Choose the rational numbers among radicals, or among sums, products and powers of roots and $\\pi$.",
    intuition:
      "An integer is a whole number or its negative, such as $-3$, 0 or 7. A rational number is a number that can be written as one integer divided by another, not by 0, such as $\\frac{3}{4}$ or $5=\\frac{5}{1}$. An irrational number is a number that cannot be written that way, such as $\\sqrt{2}$ or $\\pi$. A square root is a number that times itself gives the number inside: $\\sqrt{49}=7$, because $7\\times7=49$. A cube root is a number that times itself three times gives the number inside: $\\sqrt[3]{8}=2$. A perfect square is a whole number times itself, like 49, so its square root is rational. A perfect cube is a whole number times itself three times, like 27. An expression is a math phrase made of numbers and operations. A product is the result of multiplying, and to square a number means to multiply it by itself. A rational number other than 0 times an irrational number is irrational. A rational plus an irrational number is irrational too. But two irrational numbers can combine to a rational one: $\\sqrt{2}\\cdot\\sqrt{8}=\\sqrt{16}=4$.",
    senses: {
      root: "root-radical",
      roots: "root-radical",
      product: "product-multiply",
      products: "product-multiply",
      factor: "factor-number",
      factors: "factor-number",
      squaring: "square-number",
      difference: "difference-subtract",
    },
    terms: ["rational-number", "irrational-number"],
    method: [
      "Simplify each expression. Work out roots of perfect squares and perfect cubes, such as $\\sqrt{36}=6$ and $\\sqrt[3]{27}=3$.",
      "For a product of roots, multiply under one root and check for a perfect square: $\\sqrt{3}\\cdot\\sqrt{12}=\\sqrt{36}=6$. Squaring undoes a square root: $\\left(\\sqrt{a}\\right)^{2}=a$. But $\\left(\\sqrt{2}\\right)^{3}=2\\sqrt{2}$ keeps a root, and $\\pi^{2}$ is irrational.",
      "A rational number other than 0 times an irrational number is irrational. A rational number plus an irrational number is irrational.",
      selectStep,
    ],
    watch:
      "A root sign does not make a number irrational: $\\sqrt{49}=7$. And $\\pi$ in an expression does not always matter: $\\frac{6\\pi}{2\\pi}=3$.",
  },
  "mcas-sci-notation-select": {
    goal: "Choose the true equations that write a digit times a power of ten as a standard numeral.",
    intuition:
      "A power of 10 is a product of 10s, 10 multiplied by itself some number of times: $10^{3}=10\\times10\\times10=1000$. The small raised 3 is called the exponent. Scientific notation is a way to write a number as a number that is 1 or more and less than 10, times a power of 10, such as $2\\times10^{3}=2000$. Multiplying by 10 moves the decimal point one place right. A negative exponent means dividing instead: $10^{-1}=\\frac{1}{10}$. So multiplying by $10^{-1}$ moves the point one place left. For a positive number, a positive exponent makes it larger. A negative exponent makes it smaller, but it stays positive: $2\\times10^{-3}=0.002$.",
    senses: { product: "product-multiply" },
    terms: [
      "scientific-notation",
      [
        "standard-form-number",
        "The standard numeral for $2 \\times 10^4$ is 20,000.",
      ],
    ],
    method: [
      "Look at the sign of the exponent: positive moves the decimal point right, negative moves it left.",
      "Move the decimal point as many places as the exponent says, writing zeros in empty places.",
      "Compare with the numeral in the equation, counting its zeros.",
      selectStep,
    ],
    watch:
      "A negative exponent never makes the number negative: $2\\times10^{-3}=0.002$.",
  },
  "mcas-table-intercept-select": {
    goal: "Find the $y$-intercept of each linear table and choose those above or below a stated $y$-intercept.",
    intuition:
      "A linear function is a rule whose graph is a straight line. In its table, $y$ changes by the same amount each time $x$ goes up by 1. That amount is called the slope. The $y$-intercept is the value of $y$ when $x=0$, where the line crosses the $y$-axis. If the table does not list $x=0$, step from a listed row to $x=0$, backward or forward. Each step of 1 in $x$ changes $y$ by the slope.",
    senses: { change: "change", changes: "change", rule: "rule" },
    terms: ["y-intercept", "slope"],
    method: [
      "Find the slope: divide the change in $y$ by the change in $x$ between two rows.",
      "If $x=0$ is listed, read its $y$. Otherwise move from a row to $x=0$, changing $y$ by the slope for each step of 1 in $x$.",
      "Compare each intercept with the stated one. A table with an equal intercept is neither above nor below.",
      selectStep,
    ],
    watch:
      "The first $y$ value is the intercept only when the first $x$ value is 0.",
  },
  "mcas-quadratic-zeros-select": {
    goal: "Choose the two values of $x$ that make a quadratic expression equal to 0.",
    intuition:
      "An expression is a math phrase made of numbers, letters and operations. A quadratic is an expression with an $x^{2}$ part ($x$ times $x$) and no higher power of $x$, such as $x^{2}-2x-15$. A zero of the expression is a value of $x$ that makes it equal 0. Factored form is a way of writing it as a product of factors, the parts being multiplied: $x^{2}-2x-15=(x+3)(x-5)$. A product is 0 only when one of its factors is 0. So it is 0 when $x+3=0$ or $x-5=0$, at $x=-3$ or $x=5$. To substitute means to put a value in place of $x$. Any value is a zero if substituting it gives 0.",
    senses: { factor: "factor-number", factors: "factor-number" },
    noLink: ["part", "parts"],
    terms: ["zero-of-a-function"],
    method: [
      "If the expression is factored, set each factor equal to 0 and solve.",
      "If it is not factored, factor it first, or substitute each value and work out the result.",
      "Keep the two values that give 0.",
      selectStep,
    ],
    watch:
      "The zero of $(x+3)$ is $-3$, not 3: set the factor equal to 0 and solve.",
  },
  "mcas-congruence-statement-select": {
    goal: "From a congruence statement, choose the true statements about corresponding sides and angles.",
    intuition:
      "Congruent triangles have the same size and shape, so one can be moved to fit exactly on the other. We write $\\triangle ABC$ for the triangle with corners $A$, $B$ and $C$, and $\\overline{AC}$ for its side from $A$ to $C$. The sign $\\cong$ means “is congruent to”. In $\\triangle ABC\\cong\\triangle QRP$ the letters match in order: $A$ with $Q$, $B$ with $R$, $C$ with $P$. Corresponding parts are the parts that match when one triangle is placed on the other. Each angle matches the angle at its matching corner. Each side matches the side between its matching corners.",
    senses: { side: "side", sides: "side" },
    noLink: ["parts"],
    terms: ["corresponding", "congruent"],
    method: [
      "Write the pairs of corners by their positions in the statement.",
      "For an angle, find the matching corner of the other triangle.",
      "For a side, match both of its endpoints. The order of the two letters in a side does not matter.",
      selectStep,
    ],
    watch:
      "The letters of a side name its endpoints only: $\\overline{AC}$ matches $\\overline{QP}$ and $\\overline{PQ}$ is the same segment, but $\\overline{QR}$ is a different side.",
  },
  "mcas-circle-equation-select": {
    goal: "From the equation of a circle, choose the true statements about its center, radius, points and the origin.",
    intuition:
      "A circle is all the points at one distance from a point called the center. That distance is called the radius. Coordinates are the two numbers $(x,y)$ that locate a point: across $x$, then up $y$. The origin is the point $(0,0)$. The equation $(x-h)^{2}+(y-k)^{2}=r^{2}$ says a point $(x,y)$ is at distance $r$ from the center $(h,k)$. For example, $(x-2)^{2}+(y+1)^{2}=9$ has center $(2,-1)$ and radius 3. The opposite of a number has the other sign: the opposite of 2 is $-2$. Each coordinate of the center is the number that makes its parentheses 0: $x-2=0$ at $x=2$, and $y+1=0$ at $y=-1$. So each is the opposite of the number written inside. The right side, the part after the equals sign, is the radius squared: $3\\times3=9$. A square root is a number that times itself gives a given number, so the radius is the square root of the right side.",
    senses: {
      center: "center",
      opposite: "opposite-number",
      opposites: "opposite-number",
      "right side": "side-of-equation",
      "left side": "side-of-equation",
    },
    noLink: ["part"],
    terms: [
      [
        "center",
        "For the circle $(x - h)^2 + (y - k)^2 = r^2$, the center is $(h, k)$.",
      ],
      "radius",
    ],
    method: [
      "Read $h$ and $k$ as the numbers that make each parentheses 0, the opposites of the numbers written inside. The radius $r$ is the square root of the right side.",
      "A point is on the circle if putting its coordinates into the left side gives the right side.",
      "The origin is inside if its distance from the center is less than $r$, outside if it is greater, and on the circle if it equals $r$.",
      selectStep,
    ],
    watch: "The right side is $r^{2}$, not $r$: for $=36$ the radius is 6.",
  },
  "mcas-cylinder-scaling-select": {
    goal: "Choose the true statements about how a cylinder's volume changes when its radius or height is multiplied.",
    intuition:
      "In $V=\\pi r^{2}h$ the radius appears twice, so multiplying it by a factor multiplies the volume by that factor squared. The height appears once, so multiplying it by a factor multiplies the volume by that factor.",
    terms: ["factor-number"],
    method: [
      "Replace the changed dimension by its factor times itself in the formula.",
      "Radius multiplied by $f$ multiplies the volume by $f^{2}$. Height multiplied by $g$ multiplies it by $g$.",
      "If both change, multiply the two effects.",
      selectStep,
    ],
    watch:
      "Doubling the radius makes the volume 4 times as large, not 2 times.",
  },
  "mcas-circle-radius-distance": {
    goal: "Give the distance from a circle's center to a point on the circle from its radius, diameter or circumference.",
    intuition:
      "A circle is all the points at one fixed distance from a point called the center. That distance is called the radius. So every point on the circle is one radius away from the center, wherever the point is. The diameter is the distance straight across the circle through the center, twice the radius. The circumference is the distance all the way around, $2\\pi r$, where $\\pi$ is about 3.14.",
    senses: { center: "center" },
    noLink: ["part"],
    terms: ["radius", "diameter"],
    method: [
      "Find the radius. It is given, or half the diameter, or the circumference divided by $2\\pi$.",
      "The distance from the center to any point on the circle equals the radius.",
    ],
    watch:
      "The diameter is the distance across the circle, not from the center to the circle.",
  },
  "mcas-parenthesized-product-statement": {
    goal: "Choose the statement that describes an expression with a parenthesized sum or difference, without evaluating it.",
    intuition:
      "Parentheses make the numbers inside one quantity. In $8\\times(24+2)$ the sum is one number and 8 multiplies all of it, so the expression is 8 times as large as the sum.",
    terms: ["sum", "difference-subtract"],
    method: [
      "Name the quantity inside the parentheses, such as “the sum of 24 and 2”.",
      "Say what the operation outside does to it: “8 times as large as” for multiplication.",
      "Reject statements that use a different operation or apply the multiplication to only one number.",
    ],
    watch:
      "Without parentheses, $8\\times24+2$ multiplies only 24. The parentheses make 8 multiply the whole sum.",
  },
  "mcas-slope-sign-description": {
    goal: "Decide whether a linear function's slope is positive, negative or zero from how its output changes with its input.",
    intuition:
      "A function is a rule that turns each input, the number you put in, into exactly one output, the number you get out. A linear function has a straight-line graph. Its slope is the change in the output divided by the change in the input. When both go up, or both go down, the slope is positive. When one goes up while the other goes down, the slope is negative. When the output stays the same, the slope is zero.",
    senses: { change: "change", changes: "change", rule: "rule" },
    noLink: ["opposite"],
    terms: ["slope"],
    method: [
      "Decide whether the input goes up or down.",
      "Decide whether the output goes up or down, or stays the same.",
      "Same direction: positive. One up and one down: negative. Output unchanged: zero.",
    ],
    watch:
      "When the input decreases and the output decreases, the slope is positive: a negative change divided by a negative change is positive.",
  },
  "mcas-rotational-symmetry": {
    goal: "Decide which figure maps onto itself in a turn of less than a full circle about its center.",
    intuition:
      "Rotational symmetry means that some turn about its center lands a figure exactly on itself. The turn must be more than 0° and less than a full turn of 360°. A rectangle lands on itself after a half turn of 180°. A line of symmetry is a fold line that makes the two halves of a figure match. Parallel means running the same direction without meeting. A parallelogram is a four-sided shape with two pairs of parallel sides. A kite that is not a rhombus has a line of symmetry, but no turn of less than 360° fits it back on itself. Isosceles means having two equal sides. An isosceles trapezoid (a shape with exactly one pair of parallel sides and two equal slanted sides) has no turn that fits either. A regular polygon is a shape with all sides equal and all angles equal.",
    senses: { center: "center", side: "side", sides: "side" },
    noLink: ["more than"],
    terms: ["rotational-symmetry", "line-of-symmetry"],
    method: [
      "Picture the figure turning about its center.",
      "Test a half turn. For a regular polygon with $n$ sides, also test a turn of $\\frac{360^\\circ}{n}$.",
      "If the figure lands on itself, it has rotational symmetry. A line of symmetry alone does not count.",
    ],
    watch:
      "An isosceles triangle that is not equilateral has a line of symmetry but no rotational symmetry.",
  },
  "mcas-product-factor-size": {
    goal: "Decide whether a product is greater than, less than or equal to a fraction factor without multiplying.",
    intuition:
      "Multiplying by a number is taking that many copies of a quantity. Fewer than one copy, a number between 0 and 1, makes the result smaller. Exactly one copy changes nothing. More than one copy makes it larger.",
    terms: ["factor-number"],
    method: [
      "Compare the other factor with 1.",
      "Greater than 1: the product is greater than the first factor. Equal to 1: equal. Between 0 and 1: less.",
      "Choose the product whose other factor has the size the question needs.",
    ],
    watch:
      "A fraction like $\\frac{7}{4}$ is greater than 1 even though it is a fraction, so it makes the product larger.",
  },
};

export const mcasGapPrinciples: Record<string, string> = {
  "fact-equation-truth-select":
    "An equation $a\\times b=c$ is true when $ab$ equals $c$, and $c\\div b=a$ exactly when $a\\times b=c$ with $b\\neq0$. The fact family $a\\times b$, $b\\times a$, $c\\div a$, $c\\div b$ shares one set of three numbers.",
  "mcas-round-hundred-select":
    "A whole number $n$ rounds to the nearest hundred $H$ exactly when $H-50\\le n<H+50$. Halfway values $H+50$ round up.",
  "mcas-prime-factor-select":
    "A whole number $p>1$ is prime if its only positive divisors are 1 and $p$. If $n$ has no divisor from 2 to $\\sqrt{n}$, it is prime. $d$ is a factor of $n$ if $n=d\\cdot q$ for a whole number $q$.",
  "mcas-comparison-equations-select":
    "If $N$ is $m$ times as many as $a$, then $N=ma$, which gives $N\\div m=a$ and $N\\div a=m$. If $N$ is $m$ more than $a$, then $N=a+m$, which gives $N-a=m$ and $N-m=a$. The letter can stand for $N$ or for $a$; the true equations are the ones that hold for its value.",
  "mcas-true-product-equations":
    "By the distributive property, $\\overline{hto}\\times b=100h\\cdot b+10t\\cdot b+o\\cdot b$ for a three-digit number with digits $h$, $t$, $o$.",
  "mcas-prism-range-select":
    "A rectangular prism with edges $\\ell$, $w$, $h$ has volume $V=\\ell wh$. Volumes of solids that do not overlap add.",
  "mcas-ratio-statements-select":
    "The ratio $a:b$ is equivalent to $ka:kb$ for any number $k\\neq0$ ($k$ is not 0). Two ratios $a:b$ and $c:d$ of nonzero numbers are equivalent when $ad=bc$. The order of the numbers follows the order of the amounts named.",
  "mcas-true-quotient-equations":
    "$a\\div b=q$ exactly when $b\\cdot q=a$ and $b\\neq0$. An estimate $\\frac{a'}{b'}$ with $a'\\approx a$ and $b'\\approx b$ approximates $q$.",
  "mcas-cube-prism-statements":
    "A cube of edge $\\frac{1}{n}$ has volume $\\left(\\frac{1}{n}\\right)^{3}=\\frac{1}{n^{3}}$. A prism with edges $\\frac{a}{n},\\frac{b}{n},\\frac{c}{n}$ holds $abc$ such cubes, and its volume $\\frac{abc}{n^{3}}$ equals the product of its edges.",
  "mcas-statistical-question-select":
    "Variability means the values in a set of data differ. A statistical question expects variability in the data collected to answer it, across the people, items or times it asks about.",
  "mcas-fraction-rate-select":
    "The unit rate for distance $d$ over time $t$ is $\\frac{d}{t}$, the distance for 1 unit of time. For fractions of nonzero numbers, $\\frac{a}{b}\\div\\frac{c}{d}=\\frac{a}{b}\\cdot\\frac{d}{c}$.",
  "mcas-negative-fraction-forms":
    "An integer is a whole number or its negative. For integers $a$ and $b$ with $b\\neq0$, $-\\frac{a}{b}=\\frac{-a}{b}=\\frac{a}{-b}$ and $\\frac{-a}{-b}=\\frac{a}{b}$. Each negative sign multiplies the value by $-1$, so $k$ signs multiply it by $(-1)^{k}$.",
  "mcas-markup-price-select":
    "A price $p$ percent above cost $c$ is $c\\left(1+\\frac{p}{100}\\right)$, and $p$ percent below is $c\\left(1-\\frac{p}{100}\\right)$.",
  "mcas-rational-irrational-select":
    "A rational number equals $\\frac{p}{q}$ for integers $p$ and $q$ with $q\\neq0$. For a whole number $n$, $\\sqrt{n}$ is rational exactly when $n$ is a perfect square. The sum of a rational and an irrational number is irrational, and so is the product of a nonzero rational and an irrational. For a whole number $a$ and a positive whole number $k$, $\\left(\\sqrt{a}\\right)^{2k}=a^{k}$ is rational, while $\\pi^{k}$ is irrational.",
  "mcas-sci-notation-select":
    "Multiplying by $10^{k}$ moves the decimal point $k$ places right when $k>0$, and $|k|$ places left when $k<0$, where $|k|$ is $k$ without its sign. So for a positive number $c$, $c\\times10^{-k}=\\frac{c}{10^{k}}$ is still positive.",
  "mcas-table-intercept-select":
    "For a linear function $y=mx+b$, the slope is $m=\\frac{y_1-y_0}{x_1-x_0}$ for any two rows $(x_0,y_0)$ and $(x_1,y_1)$ of the table, and the $y$-intercept is $b=y_0-mx_0$.",
  "mcas-quadratic-zeros-select":
    "If $(x-p)(x-q)=0$, then $x=p$ or $x=q$, because a product is 0 only when one of its factors is 0. A value $v$ is a zero of $f$ exactly when $f(v)=0$, where $f(v)$, read “$f$ of $v$”, is the value at $x=v$.",
  "mcas-congruence-statement-select":
    "If $\\triangle ABC\\cong\\triangle DEF$, then $A$ matches $D$, $B$ matches $E$ and $C$ matches $F$. Corresponding angles are congruent, and so are the sides joining corresponding corners.",
  "mcas-circle-equation-select":
    "The circle with center $(h,k)$ and radius $r>0$ is the set of points with $(x-h)^{2}+(y-k)^{2}=r^{2}$. A point is inside if the left side is less than $r^{2}$ and outside if it is greater.",
  "mcas-cylinder-scaling-select":
    "For $V=\\pi r^{2}h$, replacing $r$ by $fr$ and $h$ by $gh$ gives $\\pi(fr)^{2}(gh)=f^{2}g\\,V$.",
  "mcas-circle-radius-distance":
    "A circle with center $O$ and radius $r$ is the set of points $P$ with $OP=r$. The diameter is $2r$ and the circumference is $2\\pi r$.",
  "mcas-parenthesized-product-statement":
    "In $n\\times(a+b)$ the parentheses group $a+b$ as one quantity, so the value is $n$ times $(a+b)$. By the distributive property it equals $na+nb$, not $na+b$.",
  "mcas-slope-sign-description":
    "The slope is $m=\\frac{\\Delta y}{\\Delta x}$, where $\\Delta y$ (read “delta $y$”) is the change in output and $\\Delta x$ is the change in input. It is positive when the two changes have the same sign, negative when their signs differ, and zero when $\\Delta y=0$.",
  "mcas-rotational-symmetry":
    "A figure has rotational symmetry if a rotation (a turn) about a center by an angle between 0° and 360° maps it onto itself. A regular polygon with $n$ sides maps onto itself after a turn of $\\frac{360^\\circ}{n}$. Every parallelogram maps onto itself after a half turn of 180°.",
  "mcas-product-factor-size":
    "For $a>0$: $a\\cdot g>a$ when $g>1$, $a\\cdot g=a$ when $g=1$ and $a\\cdot g<a$ when $0<g<1$.",
};

type LessonInput = Omit<Lesson, "sections"> & {
  intuition: [string, string[]];
};
const build = ({ intuition, ...rest }: LessonInput): Lesson => ({
  ...rest,
  sections: [
    { stage: "intuition", title: intuition[0], paragraphs: intuition[1] },
  ],
});
const method = (title: string, paragraphs: string[]) =>
  ({ stage: "method", title, paragraphs }) as const;
const formal = (title: string, paragraphs: string[]) =>
  ({ stage: "formal", title, paragraphs }) as const;

export const mcasGapLessons: Lesson[] = [
  build({
    id: "mcas-check-equations",
    title: "Check each equation, then select all that are true",
    summary:
      "Test a stated equation by working out its sides or by using the inverse operation, one statement at a time.",
    templateIds: [
      "fact-equation-truth-select",
      "mcas-true-product-equations",
      "mcas-true-quotient-equations",
      "mcas-comparison-equations-select",
    ],
    objectives: [
      "Decide whether a multiplication or division equation is true.",
      "Judge the product or quotient of multidigit numbers by estimating and checking.",
      "Choose the equations that fit a times-as-many or more-than story.",
    ],
    intuition: [
      "A true equation has the same number on both sides",
      [
        "You need to multiply and divide whole numbers. An equation says two amounts are equal. It is true when both sides work out to the same number and false otherwise, even when the numbers look familiar.",
        "Division can be checked by multiplying: $48\\div6=8$ is true because $6\\times8=48$. This inverse check works for any size of number.",
      ],
    ],
    workedExample: {
      prompt: "Is $4{,}020\\div15=268$ true?",
      steps: [
        "Estimate: $4{,}000\\div 20=200$, so the quotient should be a little more than 200. The stated 268 is a reasonable size.",
        "Multiply the quotient by the divisor: $15\\times268=15\\times200+15\\times68=3{,}000+1{,}020$.",
        "$3{,}000+1{,}020=4{,}020$, which is the dividend.",
      ],
      answer: "True",
    },
    closingSections: [
      method("Selecting all the true statements", [
        "Decide each statement separately and keep a count: the question says how many are true. For a product of a three-digit and a one-digit number, split the number into hundreds, tens and ones, multiply each part and add.",
        "For a story, find the amount, then substitute it for the letter in each equation. A times-as-many story has $n=ma$ and its division forms $n\\div m=a$ and $n\\div a=m$. A more-than story has $n=a+m$ and the subtractions $n-a=m$ and $n-m=a$.",
      ]),
      formal("Inverse operations", [
        "$a\\div b=q$ exactly when $b\\cdot q=a$, and $c-a=b$ exactly when $a+b=c$. An equation is true if and only if both sides have the same value.",
      ]),
    ],
    pitfalls: [
      "A wrong product can have the right last digit. Check every place.",
      "A zero in a quotient is a place holder: $4{,}305\\div21=205$, not 25.",
      "“$m$ more than” adds. “$m$ times as many” multiplies.",
    ],
    parentGuide:
      "Ask the learner to say how they would check $72\\div 8=9$ by multiplying, and why that proves it.",
  }),
  build({
    id: "mcas-select-by-number-property",
    title: "Rounding, primes and factors: select all that apply",
    summary:
      "Decide whether each number rounds to a hundred, is prime or is a factor, using the digit or the divisions that settle it.",
    templateIds: ["mcas-round-hundred-select", "mcas-prime-factor-select"],
    objectives: [
      "Round whole numbers to the nearest hundred, including numbers near halfway.",
      "Identify prime numbers and factors of a number.",
    ],
    intuition: [
      "One test settles each number",
      [
        "You need to know place value and division. To round to the nearest hundred, look only at the tens digit: 5 or more rounds up and 4 or less rounds down. To test a factor, divide and see whether anything is left over.",
        "A prime number has no factors except 1 and itself, so one small factor is enough to show that a number is not prime.",
      ],
    ],
    workedExample: {
      prompt: "Which of 649 and 650 rounds to 700 to the nearest hundred?",
      steps: [
        "649 lies between 600 and 700. Its tens digit is 4, so it rounds down to 600.",
        "650 lies between 600 and 700. Its tens digit is 5, so it rounds up to 700.",
      ],
      answer: "650",
    },
    closingSections: [
      method("Primes and factors", [
        "To test a prime, look for 2, 3, 5 and 7 as factors: a number with a factor in that list, other than the number itself, is composite. To test a factor, divide the number by the candidate. A candidate larger than the number is a multiple, not a factor.",
      ]),
      formal("Definitions", [
        "$n$ rounds to the nearest hundred $H$ exactly when $H-50\\le n<H+50$. A prime has exactly two positive factors. $d$ is a factor of $n$ when $n\\div d$ is a whole number.",
      ]),
    ],
    pitfalls: [
      "A number exactly halfway, such as 650, rounds up.",
      "Odd numbers can be composite: $51=3\\times17$.",
    ],
    parentGuide:
      "Ask why 91 is not prime even though it is odd and not a multiple of 3, 5 or 11. It is $7\\times13$.",
  }),
  build({
    id: "mcas-ratio-rate-percent-statements",
    title: "Judge ratio, rate and percent statements",
    summary:
      "A ratio is a comparison of two amounts in a set order, such as 6 red marbles to 9 blue ones. A rate is a ratio of two different kinds of amounts, such as miles per hour. A percent is a number out of 100. Check each stated ratio, rate or price against the real amounts. Keep the order and the units straight.",
    senses: { part: "part", whole: "whole", unit: "unit" },
    noLink: ["units", "more than", "changes", "change"],
    templateIds: [
      "mcas-ratio-statements-select",
      "mcas-fraction-rate-select",
      "mcas-markup-price-select",
    ],
    objectives: [
      "Decide which ratio statements are true for a set of counts.",
      "Check speeds from fractional distances and times.",
      "Check selling prices after a percent change.",
    ],
    intuition: [
      "A statement is true when its numbers match the situation",
      [
        "We write the ratio of 6 red to 9 blue as $6:9$, read “6 to 9”. The order follows the words: red to blue is $6:9$, and blue to red is $9:6$. Equivalent ratios are ratios that compare the same way. Multiply or divide both numbers by the same number, not 0, to get one: $6:9=2:3$.",
        "A speed is the distance traveled in one unit of time, so it is a rate: distance divided by time. A mixed number is a whole number and a fraction together, such as $1\\frac{1}{2}$, which equals $\\frac{3}{2}$. A reciprocal is a fraction flipped over. To divide by a fraction, multiply by its reciprocal: dividing by $\\frac{3}{2}$ is multiplying by $\\frac{2}{3}$.",
        "A percent change is a change written as a percent of the starting amount. A price 40 percent above a cost of 50 dollars adds 40 percent of 50, which is $\\frac{40}{100}\\times50=20$ dollars. So the price is $50+20=70$ dollars.",
      ],
    ],
    workedExample: {
      prompt:
        "A bag has 6 red marbles and 9 blue marbles. Is “the ratio of red marbles to all marbles is $2:5$” true?",
      steps: [
        "Find the whole: there are $6+9=15$ marbles in all.",
        "Red to all puts the red count first and the total second: $6:15$.",
        "Divide both numbers by 3: $6:15=2:5$. So the statement is true.",
      ],
      answer: "True",
    },
    closingSections: [
      method("Order, orientation and the starting amount", [
        "For a ratio, put the first amount named first. For a speed, put the distance over the time: miles divided by hours gives miles per hour. Hours divided by miles gives hours per mile, a different rate. Write mixed numbers as fractions, and divide by multiplying by the reciprocal.",
        "For a percent change, find the percent of the original cost, then add it or subtract it. The percent of the cost alone is not the new price.",
      ]),
      formal("Equal ratios and percent change", [
        "For nonzero numbers, $a:b=c:d$ exactly when $ad=bc$. For distance $d$ and time $t$, the speed is $\\frac{d}{t}$. A price $p$ percent above cost $c$ is $c\\left(1+\\frac{p}{100}\\right)$, and $p$ percent below is $c\\left(1-\\frac{p}{100}\\right)$.",
      ]),
    ],
    pitfalls: [
      "Red to blue uses the blue count, not the total. Red to all uses the total.",
      "A speed is miles per hour, so divide miles by hours, not hours by miles.",
      "A price 40 percent above cost is more than the cost, and 40 percent of the cost is less than the cost.",
    ],
    parentGuide:
      "Ask which number goes first in “blue marbles to all marbles” and why switching them changes the ratio.",
  }),
  build({
    id: "mcas-prism-cylinder-volume-statements",
    title: "Volume statements: prisms, small cubes and cylinders",
    summary:
      "Find volumes by multiplying edge lengths, counting cubes or scaling a formula, and use them to judge statements.",
    templateIds: [
      "mcas-prism-range-select",
      "mcas-cube-prism-statements",
      "mcas-cylinder-scaling-select",
    ],
    objectives: [
      "Compare the combined volume of prisms with a range.",
      "Describe a prism packed with cubes whose edge is a unit fraction.",
      "Find the factor by which scaling a cylinder's radius or height changes its volume.",
    ],
    intuition: [
      "Volume counts cubes",
      [
        "You need to multiply whole numbers and fractions. The volume of a solid is the number of unit cubes that fill it. For a rectangular prism you find it by multiplying length, width and height, and volumes of separate solids add.",
        "If the cubes are smaller than a unit, you count them and multiply by the volume of one cube. A cube with edge $\\frac{1}{3}$ unit needs 3 along each edge to make 1 unit, so 27 of them fill a unit cube and each has volume $\\frac{1}{27}$.",
      ],
    ],
    workedExample: {
      prompt:
        "A cylinder's radius is multiplied by 3 and its height stays the same. By what factor does the volume change?",
      steps: [
        "The volume is $V=\\pi r^{2}h$.",
        "With radius $3r$ the volume is $\\pi(3r)^{2}h=\\pi\\cdot9r^{2}h=9\\cdot\\pi r^{2}h$.",
        "The volume is 9 times as large.",
      ],
      answer: "9",
    },
    closingSections: [
      method("Count, then multiply", [
        "To find which two prisms meet a condition, find each volume first, then add pairs. To describe a prism of small cubes, divide each edge by the cube's edge to count cubes along it, multiply the three counts and then multiply by one cube's volume.",
        "For a cylinder, the radius is squared in $V=\\pi r^{2}h$, so a factor on the radius is squared. A factor on the height is not.",
      ]),
      formal("Formulas", [
        "$V=\\ell wh$ for a rectangular prism, $V=\\pi r^{2}h$ for a cylinder, and a cube of edge $\\frac{1}{n}$ has volume $\\frac{1}{n^{3}}$.",
      ]),
    ],
    pitfalls: [
      "A cube of edge $\\frac{1}{3}$ has volume $\\frac{1}{27}$, not $\\frac{1}{3}$.",
      "Doubling the radius makes the volume 4 times as large, not 2.",
    ],
    parentGuide:
      "Ask how many cubes of edge $\\frac{1}{2}$ unit fill a cube of edge 1 unit, and why the answer is 8.",
  }),
  build({
    id: "mcas-statistical-questions-select",
    title: "Which questions are statistical?",
    summary:
      "Data is a set of values collected by asking or measuring. A statistical question is a question answered with data whose values vary, meaning they differ. “How tall is each student in my class?” is statistical. “How tall is Ana?” is not, because it asks for one value.",
    noLink: ["change", "changes"],
    templateIds: ["mcas-statistical-question-select"],
    objectives: [
      "Tell a statistical question from a question with a single answer.",
      "Explain that a statistical question expects different answers, so it needs data.",
    ],
    intuition: [
      "Will the answers vary?",
      [
        "Some questions ask for one value that stays the same, such as the number of lanes in a pool. Others ask for many values that differ, such as how long each swimmer stays in the pool.",
        "A statistical question is of the second kind. You collect the data, then describe the values: how spread out they are, or a typical value. That summary can be one number, but the data behind it vary.",
        "A question about one person can still be statistical if it asks for many values. “How long does Sam take to swim each lap this week?” has a different value for each lap.",
      ],
    ],
    workedExample: {
      prompt:
        "Is “How many minutes does each student spend on homework?” a statistical question? Is “How many students are in Room 12?”?",
      steps: [
        "Homework time differs from student to student. You would collect many different values, so the first question is statistical.",
        "The number of students in Room 12 is one fixed number. Nothing varies, so the second question is not statistical.",
      ],
      answer: "Only the first",
    },
    closingSections: [
      method("A test you can apply", [
        "Imagine collecting the data to answer the question. If you would get one fixed value, it is not statistical. If you would get many values that differ, it is.",
        "A question about one person at one moment asks for a single value, even if it begins with “how many”.",
      ]),
    ],
    pitfalls: [
      "“How many” does not make a question statistical. Check whether the data would vary.",
      "A question about a group is not statistical if it has one fixed answer, such as the number of students in one room.",
    ],
    parentGuide:
      "Ask the learner to change “How many seats does the theater have?” into a statistical question about the theater.",
  }),
  build({
    id: "mcas-number-forms-select",
    title: "Negative fractions, rational numbers and scientific notation",
    summary:
      "One number can be written in many forms. $\\frac{-3}{4}$, $\\frac{3}{-4}$ and $-\\frac{3}{4}$ are the same number, and so are $2\\times10^{3}$ and 2,000. A square root is a number that times itself gives another number: $\\sqrt{49}=7$. This lesson decides whether two forms are equal. It counts negative signs, checks square roots and moves the decimal point.",
    senses: {
      root: "root-radical",
      roots: "root-radical",
      product: "product-multiply",
    },
    templateIds: [
      "mcas-negative-fraction-forms",
      "mcas-rational-irrational-select",
      "mcas-sci-notation-select",
    ],
    objectives: [
      "Find the expressions equal to a negative fraction.",
      "Decide which radical or $\\pi$ expressions are rational.",
      "Check equations between scientific notation and standard numerals.",
    ],
    intuition: [
      "Different forms, one value",
      [
        "A fraction bar means division: $\\frac{3}{4}$ is $3\\div4$. The top number is called the numerator, and the bottom number is called the denominator. A negative divided by a positive is negative, and so is a positive divided by a negative. A negative divided by a negative is positive.",
        "An integer is a whole number or its negative, such as $-3$, 0 or 7. A rational number is a number that can be written as one integer divided by another, not by 0. An irrational number is a number that cannot be written that way, such as $\\sqrt{2}$ or $\\pi$. A square root is a number that times itself gives the number inside: $\\sqrt{49}=7$. A perfect square is a whole number times itself, such as 49.",
        "A power of 10 is a product of 10s, such as $10^{3}=10\\times10\\times10=1000$. Scientific notation is a way to write a number as a number that is 1 or more and less than 10, times a power of 10, such as $2\\times10^{3}$. The small raised number is called the exponent. A negative exponent means dividing by 10 that many times: $10^{-2}=\\frac{1}{100}$.",
      ],
    ],
    workedExample: {
      prompt: "Is $\\frac{-7}{-2}$ equal to $-\\frac{7}{2}$?",
      steps: [
        "$\\frac{-7}{-2}$ has two negative signs. A negative divided by a negative is positive, so it equals $\\frac{7}{2}$.",
        "$-\\frac{7}{2}$ has one negative sign, so it is negative.",
        "A positive number and a negative number are never equal.",
      ],
      answer: "No",
    },
    closingSections: [
      method("Count signs, simplify roots, move the point", [
        "For signs in a fraction that is not 0, count the negative signs. An odd count gives a negative value, and an even count gives a positive value. The sizes must match too: the numerator and denominator must not be swapped.",
        "For rational numbers, work out square roots of perfect squares. A rational plus an irrational number is irrational. But square roots can combine: $\\sqrt{2}\\cdot\\sqrt{8}=\\sqrt{16}=4$.",
        "For scientific notation, move the decimal point right for a positive exponent and left for a negative one.",
      ]),
      formal("Rules", [
        "For integers $a$ and $b$ with $b\\neq0$: $-\\frac{a}{b}=\\frac{-a}{b}=\\frac{a}{-b}$ and $\\frac{-a}{-b}=\\frac{a}{b}$. Multiplying $c$ by $10^{k}$ moves its decimal point right $k$ places when $k>0$, and left $|k|$ places when $k<0$. Here $|k|$ is $k$ without its sign.",
      ]),
    ],
    pitfalls: [
      "Two negative signs cancel and give a positive value.",
      "The square root of a whole number is irrational unless the number is a perfect square: $\\sqrt{49}=7$ is rational, but $\\sqrt{8}$ is irrational.",
      "A negative exponent gives a small positive number, not a negative number.",
    ],
    parentGuide:
      "Ask what $10^{-2}$ means, and why $5\\times10^{-2}$ is 0.05 and not $-500$.",
  }),
  build({
    id: "mcas-function-equation-statements",
    title: "Intercepts, zeros, circle equations and slope sign",
    summary:
      "A function is a rule that turns each input, the number you put in, into exactly one output, the number you get out. A table, an equation and a description can all show the same function. Each form makes one feature easy to read. This lesson reads a starting value from a table, zeros from a factored form, a circle from its equation, and a slope's sign from words.",
    senses: {
      center: "center",
      change: "change",
      changes: "change",
      factor: "factor-number",
      factors: "factor-number",
      product: "product-multiply",
    },
    noLink: ["opposite", "rule", "part", "parts"],
    templateIds: [
      "mcas-table-intercept-select",
      "mcas-quadratic-zeros-select",
      "mcas-circle-equation-select",
      "mcas-slope-sign-description",
    ],
    objectives: [
      "Find the $y$-intercept of a table that may not list $x=0$.",
      "Find the values that make a quadratic expression zero.",
      "Read the center and radius from the equation of a circle.",
      "Decide the sign of a slope from how the output changes.",
    ],
    intuition: [
      "Each form shows one feature",
      [
        "A linear function is a function whose graph is a straight line. Its slope is the change in $y$ for each increase of 1 in $x$. Its $y$-intercept is the value of $y$ when $x=0$. A table shows the change in $y$ for each step in $x$, so you can step back to $x=0$.",
        "A quadratic is an expression with an $x^{2}$ part ($x$ times $x$) and no higher power. A zero is a value of $x$ that makes it equal 0. Factored form is a way of writing it as factors, the parts being multiplied, such as $(x+3)(x-5)$. A product is 0 only when one of its factors is 0.",
        "A circle is all the points at one distance from a point called the center. That distance is called the radius. Coordinates are the two numbers $(x,y)$ that locate a point. The equation of a circle shows its center and radius.",
        "To substitute means to put a number in place of a letter. Substituting is a quick way to check each statement.",
      ],
    ],
    workedExample: {
      prompt:
        "A linear table has $x$ values 2, 3, 4 and $y$ values 7, 10, 13. What is the $y$-intercept?",
      steps: [
        "Each time $x$ goes up by 1, $y$ goes up by 3. So the slope is 3.",
        "Going back from $x=2$ to $x=0$ is 2 steps of 1. That changes $y$ by $2\\times(-3)=-6$.",
        "Start from $y=7$ at $x=2$: $7-6=1$. So the $y$-intercept is 1.",
      ],
      answer: "1",
    },
    closingSections: [
      method("Read the feature you need", [
        "For the zeros of $(x+3)(x-5)$, set each factor to 0: $x=-3$ and $x=5$.",
        "For the circle $(x+2)^{2}+(y-5)^{2}=16$, the center is $(-2,5)$ and the radius is $\\sqrt{16}=4$. The signs inside the parentheses are the opposite of the center's coordinates.",
        "For a slope, compare the directions of the change in input and the change in output. The same direction gives a positive slope, and opposite directions give a negative one.",
      ]),
      formal("Standard forms", [
        "A circle with center $(h,k)$ and radius $r$ has the equation $(x-h)^{2}+(y-k)^{2}=r^{2}$. If $(x-p)(x-q)=0$, then $x=p$ or $x=q$. The slope is $m=\\frac{\\Delta y}{\\Delta x}$, the change in $y$ divided by the change in $x$.",
      ]),
    ],
    pitfalls: [
      "The first $y$ in a table is the intercept only when the first $x$ is 0.",
      "The zero of $x+3$ is $-3$.",
      "The number after the equals sign in a circle's equation is $r^{2}$, not $r$.",
    ],
    parentGuide:
      "Ask the learner what the graph of $(x-1)^{2}+y^{2}=9$ looks like, using its center and radius.",
  }),
  build({
    id: "mcas-geometry-part-statements",
    title: "Corresponding parts, radius distance and rotational symmetry",
    summary:
      "Congruent figures have the same size and shape, so their parts match in pairs. A circle is all the points at one distance from a point called the center. That distance is called the radius. Rotational symmetry means a turn of less than a full circle lands a figure on itself. This lesson uses these facts to judge statements.",
    senses: { center: "center", side: "side", sides: "side" },
    noLink: ["parts", "vertex", "vertices", "more than"],
    templateIds: [
      "mcas-congruence-statement-select",
      "mcas-circle-radius-distance",
      "mcas-rotational-symmetry",
    ],
    objectives: [
      "Select the true corresponding sides and angles from a congruence statement.",
      "Use the radius as the distance from a circle's center to any point on it.",
      "Decide whether a figure has rotational symmetry.",
    ],
    intuition: [
      "Match, measure and turn",
      [
        "Congruent triangles fit exactly on each other. We write $\\triangle ABC$ for the triangle with corners $A$, $B$ and $C$, and $\\overline{AC}$ for its side from $A$ to $C$. The sign $\\cong$ means “is congruent to”. Corresponding parts are the parts that match when one triangle is placed on the other.",
        "The diameter is the distance across a circle through its center, twice the radius. The circumference is the distance around the circle. Every point on the circle is one radius from the center.",
        "The turn for rotational symmetry must be more than 0° and less than a full turn of 360°. A line of symmetry is a fold line that makes two matching halves. Having one does not give rotational symmetry.",
      ],
    ],
    workedExample: {
      prompt:
        "$\\triangle ABC\\cong\\triangle QRP$. Which side of $\\triangle QRP$ corresponds to $\\overline{AC}$?",
      steps: [
        "The letters match by position: $A$ with $Q$, $B$ with $R$, $C$ with $P$.",
        "$\\overline{AC}$ joins $A$ and $C$, so its match joins $Q$ and $P$.",
      ],
      answer: "$\\overline{QP}$",
    },
    closingSections: [
      method("Position, radius, turn", [
        "In a congruence statement, pair the corners by position, then read each side or angle through those pairs. For a circle, find the radius from the given length: half the diameter, or the circumference divided by $2\\pi$.",
        "For a turn, picture the figure turning about its center. Parallel means running the same direction without meeting. A parallelogram is a four-sided shape with two pairs of parallel sides. Every parallelogram lands on itself after a half turn, including a rectangle and a rhombus (a shape with four equal sides).",
        "A triangle with no equal sides never lands on itself. Neither does a kite that is not a rhombus. Nor does an isosceles trapezoid (a shape with exactly one pair of parallel sides and two equal slanted sides).",
      ]),
    ],
    pitfalls: [
      "A line of symmetry is not rotational symmetry.",
      "The diameter is the distance across a circle, not from its center to the circle.",
    ],
    parentGuide:
      "Ask the learner to cut out a paper rectangle and turn it a half turn to see that it lands on itself.",
  }),
  build({
    id: "mcas-describe-and-size-products",
    title: "Describing a parenthesized product and its size",
    summary:
      "Read an expression with parentheses as one quantity, and judge a product's size from the size of its factors.",
    templateIds: [
      "mcas-parenthesized-product-statement",
      "mcas-product-factor-size",
    ],
    objectives: [
      "Describe $n\\times(a+b)$ in words without evaluating it.",
      "Decide whether a product is greater or less than a factor from the other factor.",
    ],
    intuition: [
      "Parentheses make one quantity, and a factor scales",
      [
        "You need to multiply whole numbers and fractions. Parentheses group the numbers inside into one quantity before the rest is done. Multiplying by a number scales a quantity: by more than 1 enlarges it, by 1 keeps it, and by a number between 0 and 1 shrinks it.",
      ],
    ],
    workedExample: {
      prompt:
        "Is $\\frac{3}{4}\\times\\frac{5}{4}$ greater or less than $\\frac{3}{4}$?",
      steps: [
        "The other factor, $\\frac{5}{4}$, is greater than 1.",
        "Multiplying by a number greater than 1 makes the result larger.",
        "So the product is greater than $\\frac{3}{4}$. Check: $\\frac{3}{4}\\times\\frac{5}{4}=\\frac{15}{16}$ and $\\frac{3}{4}=\\frac{12}{16}$.",
      ],
      answer: "Greater",
    },
    closingSections: [
      method("Compare with 1; name the group", [
        "To judge a product's size, compare the other factor with 1. To describe $8\\times(24+2)$, name the group first, “the sum of 24 and 2”, then say what 8 does to it: “8 times as large as the sum of 24 and 2”.",
      ]),
    ],
    pitfalls: [
      "A fraction can be greater than 1, as $\\frac{5}{4}$ is, and then it enlarges the product.",
      "Parentheses make the multiplication apply to the whole sum.",
    ],
    parentGuide:
      "Ask whether $\\frac{1}{2}\\times 9$ is more or less than 9 and why, before multiplying.",
  }),
];
