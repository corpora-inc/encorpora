import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

const selectStep =
  "Decide each statement on its own, then choose exactly the number of true statements the question asks for.";

export const mcasGapMethods: Record<string, ProblemMethod> = {
  "mcas-true-fact-equations": {
    goal: "Choose the true multiplication and division equations from a list of six.",
    intuition:
      "An equation is true when both sides name the same number. A multiplication fact and its division facts say the same thing: if $6\\times8=48$ then $48\\div6=8$ and $48\\div8=6$. So you can test any division by multiplying the answer back.",
    terms: [
      ["quotient", "The answer to a division, such as 8 in $48\\div6=8$."],
      [
        "fact family",
        "The multiplication and division equations that use the same three numbers.",
      ],
    ],
    method: [
      "Work out the left side of each equation.",
      "For a division, multiply the quotient by the divisor. The result must be the dividend.",
      "Compare with the number on the right and keep the equation only if they match.",
      selectStep,
    ],
    watch:
      "Do not accept an equation because the numbers look familiar. $7\\times8=54$ uses the right numbers and is false.",
  },
  "mcas-round-hundred-select": {
    goal: "Choose every number that rounds to a stated hundred.",
    intuition:
      "Rounding to the nearest hundred moves a number to the closest multiple of 100. The halfway point decides: numbers from 50 below a hundred up to 49 above it round to that hundred, so 250 rounds to 300 but 249 rounds to 200.",
    terms: [
      [
        "nearest hundred",
        "The multiple of 100 that is closest to the number. A number exactly halfway between two hundreds rounds up.",
      ],
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
    terms: [
      [
        "prime number",
        "A whole number greater than 1 whose only factors are 1 and itself.",
      ],
      ["factor", "A whole number that divides another with no remainder."],
    ],
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
    goal: "Choose every equation that finds an unknown amount in a times-as-many or more-than story.",
    intuition:
      "A story about “times as many” has the multiplication and the two related divisions. A story about “more than” has the addition and the two related subtractions. Each true equation is one of these, and an equation that mixes the operations is not.",
    terms: [
      [
        "times as many",
        "A comparison by multiplication: 4 times as many as 12 is $4\\times12$.",
      ],
      ["more than", "A comparison by addition: 4 more than 12 is $12+4$."],
    ],
    method: [
      "Decide whether the story compares by multiplication or by addition.",
      "Write the amount for the unknown and find its value.",
      "Substitute that value for the letter in each equation and see whether both sides match.",
      selectStep,
    ],
    watch:
      "“4 more than” is not “4 times as many”: the first adds 4, the second multiplies by 4.",
  },
  "mcas-true-product-equations": {
    goal: "Choose the equations whose product of a three-digit and a one-digit number is correct.",
    intuition:
      "Multiplying place by place splits a number into hundreds, tens and ones, multiplies each part, then adds. Mistakes come from forgetting to add a regrouped ten or hundred, or from putting a part in the wrong place.",
    terms: [
      [
        "regroup",
        "Carry ten ones to the tens place, or ten tens to the hundreds place.",
      ],
    ],
    method: [
      "Split the three-digit number into hundreds, tens and ones.",
      "Multiply each part by the one-digit number: for $453\\times6$ that is $2{,}400+300+18$.",
      "Add the three products and compare with the product in the equation.",
      selectStep,
    ],
    watch:
      "Check the tens and hundreds of the product, not only the ones digit. A wrong answer can have the right last digit.",
  },
  "mcas-prism-range-select": {
    goal: "Find the volume of each prism, then choose the two whose volumes together meet a condition.",
    intuition:
      "The volume of a rectangular prism is its length times its width times its height, in cubic units. Volume adds: two prisms together hold the sum of their volumes.",
    terms: [
      ["volume", "The number of unit cubes that fill a solid."],
      [
        "cubic centimeter",
        "The volume of a cube whose edges are 1 centimeter.",
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
      "A ratio compares two quantities in a stated order, and the order matters: 5 red to 12 blue is $5:12$, not $12:5$. A part-to-whole ratio uses the total as its second number, and a whole-to-part ratio uses it as the first.",
    terms: [
      [
        "part-to-part ratio",
        "Compares one group with another group, such as red to blue.",
      ],
      [
        "part-to-whole ratio",
        "Compares one group with the total of all groups.",
      ],
      [
        "equal ratios",
        "Ratios such as $2:5$ and $4:10$ whose numbers can both be multiplied or divided by one number to match.",
      ],
    ],
    method: [
      "Write each count and the total of all the objects.",
      "Put the counts in the order the words give, first quantity first.",
      "A stated ratio is true if it equals that ratio or an equal ratio, found by multiplying or dividing both numbers by the same number.",
      selectStep,
    ],
    watch:
      "Check whether the second number is a part or the whole. Red to blue uses the blue count, not the total.",
  },
  "mcas-true-quotient-equations": {
    goal: "Choose the true division equations with two-digit divisors and multidigit dividends.",
    intuition:
      "A quotient is correct when multiplying it by the divisor gives back the dividend. An estimate with friendly numbers shows whether the size of the quotient is right before any exact check.",
    terms: [
      ["dividend", "The number being divided."],
      ["divisor", "The number you divide by."],
    ],
    method: [
      "Estimate: round the divisor and dividend to friendly numbers and divide to see the size of the quotient.",
      "Multiply the stated quotient by the divisor, place by place.",
      "The equation is true only if the product equals the dividend.",
      selectStep,
    ],
    watch:
      "A zero in the quotient is easy to lose: $4{,}305\\div21=205$, not 25. The estimate shows the quotient must be in the hundreds.",
  },
  "mcas-cube-prism-statements": {
    goal: "Choose the true statements about the cubes, count and volume of a prism packed with cubes of unit-fraction edge.",
    intuition:
      "A cube with edge $\\frac{1}{n}$ unit needs $n$ of them to span 1 unit. Its volume is $\\frac{1}{n^{3}}$ cubic unit, because it takes $n\\times n\\times n$ of them to make a cube of edge 1. Counting the small cubes and multiplying the edge lengths give the same volume.",
    terms: [
      ["unit fraction", "A fraction with numerator 1, such as $\\frac{1}{4}$."],
    ],
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
    goal: "Choose the questions that expect different answers from different people, items or times.",
    intuition:
      "A statistical question has an answer that varies, so you need to collect data to answer it and the answer describes the whole spread. A question with one fixed answer, or about one person on one day, is not statistical.",
    terms: [
      [
        "statistical question",
        "A question that you expect to have different answers, so you must collect data to answer it.",
      ],
      [
        "variability",
        "How much the values in a set of data differ from one another.",
      ],
    ],
    method: [
      "Imagine asking the question of many people or on many days.",
      "If the answers would be the same every time, it is not statistical.",
      "If the answers would differ, it is statistical.",
      selectStep,
    ],
    watch:
      "A question about one named person or one moment, such as “How many cakes did Sam order today?”, has one answer and is not statistical.",
  },
  "mcas-fraction-rate-select": {
    goal: "Check stated speeds in miles per hour by dividing fractional distances by fractional times.",
    intuition:
      "A speed in miles per hour is the distance divided by the time. When both are fractions or mixed numbers, write them as fractions and divide by multiplying by the reciprocal. The reciprocal division in the wrong order gives hours per mile, a different rate.",
    terms: [
      ["unit rate", "The amount for one unit, such as miles for 1 hour."],
      [
        "reciprocal",
        "The fraction turned upside down: the reciprocal of $\\frac{3}{4}$ is $\\frac{4}{3}$.",
      ],
    ],
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
      "A negative sign can sit in the numerator, in the denominator or in front, and all three places give the same value: $\\frac{-3}{4}=\\frac{3}{-4}=-\\frac{3}{4}$. Two negative signs cancel, because multiplying by $-1$ twice returns the original value.",
    terms: [
      ["opposite", "The number with the same size on the other side of 0."],
    ],
    method: [
      "Count the negative signs in the numerator, the denominator and the front.",
      "An odd count gives a negative value. An even count gives a positive value.",
      "Check that the numerator and denominator are the same numbers as in the target, not swapped.",
      selectStep,
    ],
    watch:
      "$\\frac{-7}{-2}$ is positive, because the two negatives cancel, and $-\\frac{2}{7}$ is a different size from $-\\frac{7}{2}$.",
  },
  "mcas-markup-price-select": {
    goal: "Choose the items whose selling price is correct for a stated percent above or below the cost.",
    intuition:
      "A percent of the cost is a part of the cost: 40 percent of 50 is 20. A price 40 percent above cost adds that part, and a price 40 percent below cost subtracts it. The percent alone, or the percent added as dollars, are different amounts.",
    terms: [["percent", "A rate per 100: 40 percent is $\\frac{40}{100}$."]],
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
    goal: "Choose the rational numbers among radicals, or among sums and products of roots and pi.",
    intuition:
      "A rational number is a ratio of two integers, and an irrational number is not. The square root of a perfect square is a whole number, so it is rational. A rational number plus an irrational number is irrational, but two irrational numbers can combine to a rational one: $\\sqrt{2}\\cdot\\sqrt{8}=4$.",
    terms: [
      [
        "rational number",
        "A number that can be written as a ratio of two integers.",
      ],
      [
        "irrational number",
        "A number that cannot be written as a ratio of two integers, such as $\\pi$ or $\\sqrt{2}$.",
      ],
    ],
    method: [
      "Simplify each expression. Evaluate roots of perfect squares and perfect cubes.",
      "For a product of roots, multiply under one root and check for a perfect square.",
      "A nonzero rational times an irrational number, and a rational plus an irrational number, are irrational.",
      selectStep,
    ],
    watch:
      "A radical sign does not make a number irrational: $\\sqrt{49}=7$. And $\\pi$ in an expression does not always matter: $\\frac{6\\pi}{2\\pi}=3$.",
  },
  "mcas-sci-notation-select": {
    goal: "Choose the true equations that write a digit times a power of ten as a standard numeral.",
    intuition:
      "Multiplying by 10 moves the decimal point one place right, and multiplying by $10^{-1}$ moves it one place left. A positive exponent makes the number larger and a negative exponent makes it smaller but still positive.",
    terms: [
      [
        "scientific notation",
        "A number written as a number from 1 up to 10 times a power of 10, such as $2\\times10^{4}$.",
      ],
      ["standard numeral", "The number written with digits, such as 20,000."],
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
    goal: "Find the y-intercept of each linear table and choose those above or below a stated y-intercept.",
    intuition:
      "The $y$-intercept is the value of $y$ at $x=0$. In a linear table $y$ changes by the same amount for each step in $x$, so you can step backward from any row to $x=0$.",
    terms: [
      [
        "y-intercept",
        "The value of $y$ when $x=0$, where the graph crosses the $y$-axis.",
      ],
      ["slope", "The change in $y$ for each increase of 1 in $x$."],
    ],
    method: [
      "Find the slope: the change in $y$ divided by the change in $x$ between two rows.",
      "If $x=0$ is listed, read $y$. Otherwise move back from a row to $x=0$, changing $y$ by the slope for each step.",
      "Compare each intercept with the stated one. A table with an equal intercept is neither above nor below.",
      selectStep,
    ],
    watch:
      "The first $y$ value is the intercept only when the first $x$ value is 0.",
  },
  "mcas-quadratic-zeros-select": {
    goal: "Choose the two values of x that make a quadratic expression equal to 0.",
    intuition:
      "A product is 0 only when one of its factors is 0, so a factored quadratic is 0 at the value that zeroes each factor. A value is a zero of any expression if substituting it gives 0.",
    terms: [
      [
        "zero of an expression",
        "A value of $x$ for which the expression equals 0.",
      ],
    ],
    method: [
      "If the expression is factored, set each factor equal to 0 and solve.",
      "If it is not factored, factor it first or substitute each value and evaluate.",
      "Keep the two values that give 0.",
      selectStep,
    ],
    watch:
      "The zero of $(x+3)$ is $-3$, not 3: set the factor equal to 0 and solve.",
  },
  "mcas-congruence-statement-select": {
    goal: "From a congruence statement, choose the true statements about corresponding sides and angles.",
    intuition:
      "Congruent triangles can be moved to fit exactly. In the statement $\\triangle ABC\\cong\\triangle QRP$ the letters match in order: $A$ with $Q$, $B$ with $R$, $C$ with $P$. Each angle matches the angle at its matching vertex, and each side matches the side between its matching vertices.",
    terms: [
      [
        "corresponding parts",
        "The sides and angles that match when one triangle is placed on the other.",
      ],
      [
        "congruent",
        "Having the same size and shape, so corresponding parts are equal.",
      ],
    ],
    method: [
      "Write the pairs of vertices by position in the statement.",
      "For an angle, find the matching vertex of the other triangle.",
      "For a side, match both of its endpoints. The order of the two letters in a side does not matter.",
      selectStep,
    ],
    watch:
      "The letters of a side name its endpoints only: $\\overline{AC}$ matches $\\overline{QP}$ and $\\overline{PQ}$ is the same segment, but $\\overline{QR}$ is a different side.",
  },
  "mcas-circle-equation-select": {
    goal: "From the equation of a circle, choose the true statements about its center, radius, points and the origin.",
    intuition:
      "The equation $(x-h)^{2}+(y-k)^{2}=r^{2}$ says every point at distance $r$ from the center $(h,k)$. The signs inside the parentheses are opposite to the center's coordinates, and the number on the right is the square of the radius.",
    terms: [
      [
        "center",
        "The point $(h,k)$ at the same distance from every point of the circle.",
      ],
      ["radius", "The distance from the center to the circle."],
    ],
    method: [
      "Read $h$ and $k$ with the opposite sign of the numbers in the parentheses, and take the square root of the right side for $r$.",
      "A point is on the circle if substituting it makes the left side equal the right side.",
      "The origin is inside if its distance from the center is less than $r$ and outside if it is greater.",
      selectStep,
    ],
    watch: "The right side is $r^{2}$, not $r$: for $=36$ the radius is 6.",
  },
  "mcas-cylinder-scaling-select": {
    goal: "Choose the true statements about how a cylinder's volume changes when its radius or height is multiplied.",
    intuition:
      "In $V=\\pi r^{2}h$ the radius appears twice, so multiplying it by a factor multiplies the volume by that factor squared. The height appears once, so multiplying it by a factor multiplies the volume by that factor.",
    terms: [["factor", "The number a quantity is multiplied by."]],
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
      "A circle is every point at one fixed distance from its center, and that distance is the radius. So every point on the circle is a radius away from the center, wherever the point is.",
    terms: [
      [
        "radius",
        "The distance from the center of a circle to any point on it.",
      ],
      [
        "diameter",
        "The distance across a circle through its center, twice the radius.",
      ],
    ],
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
    terms: [
      ["sum", "The result of adding."],
      ["difference", "The result of subtracting."],
    ],
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
      "The slope is the change in the output divided by the change in the input. When both change in the same direction the quotient is positive, when they change in opposite directions it is negative, and when the output does not change it is zero.",
    terms: [
      [
        "slope",
        "The change in output divided by the change in input for a linear function.",
      ],
    ],
    method: [
      "Decide whether the input goes up or down.",
      "Decide whether the output goes up or down, or stays the same.",
      "Same direction: positive. Opposite directions: negative. Output unchanged: zero.",
    ],
    watch:
      "When the input decreases and the output decreases, the slope is positive: both changes are negative and their quotient is positive.",
  },
  "mcas-rotational-symmetry": {
    goal: "Decide which figure maps onto itself in a turn of less than a full circle about its center.",
    intuition:
      "A figure has rotational symmetry if turning it less than 360° about a point leaves it looking the same. A rectangle looks the same after a half turn. A kite or an isosceles trapezoid has a line of symmetry but no turn of less than 360° fits it back on itself.",
    terms: [
      [
        "rotational symmetry",
        "A turn of less than 360° about a center that maps a figure onto itself.",
      ],
      [
        "line of symmetry",
        "A line that splits a figure into two mirror images.",
      ],
    ],
    method: [
      "Picture the figure turning about its center.",
      "Test a half turn and a turn of $\\frac{360^\\circ}{n}$ for a figure with $n$ equal sides.",
      "If the figure lands on itself, it has rotational symmetry. A line of symmetry alone does not count.",
    ],
    watch:
      "An isosceles triangle that is not equilateral has a line of symmetry but no rotational symmetry.",
  },
  "mcas-product-factor-size": {
    goal: "Decide whether a product is greater than, less than or equal to a fraction factor without multiplying.",
    intuition:
      "Multiplying by a number is taking that many copies of a quantity. Fewer than one copy, a number between 0 and 1, makes the result smaller. Exactly one copy changes nothing. More than one copy makes it larger.",
    terms: [["factor", "A number that is multiplied."]],
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
  "mcas-true-fact-equations":
    "An equation $a\\times b=c$ is true when $ab$ equals $c$, and $c\\div b=a$ exactly when $a\\times b=c$ with $b\\neq0$. The fact family $a\\times b$, $b\\times a$, $c\\div a$, $c\\div b$ shares one set of three numbers.",
  "mcas-round-hundred-select":
    "A whole number $n$ rounds to the nearest hundred $H$ exactly when $H-50\\le n<H+50$. Halfway values $H+50$ round up.",
  "mcas-prime-factor-select":
    "A whole number $p>1$ is prime if its only positive divisors are 1 and $p$. If $n$ has no divisor from 2 to $\\sqrt{n}$, it is prime. $d$ is a factor of $n$ if $n=d\\cdot q$ for a whole number $q$.",
  "mcas-comparison-equations-select":
    "If $n$ is $m$ times as many as $a$, then $n=ma$, which gives $n\\div m=a$ and $n\\div a=m$. If $n$ is $m$ more than $a$, then $n=a+m$, which gives $n-a=m$ and $n-m=a$.",
  "mcas-true-product-equations":
    "By the distributive property, $\\overline{hto}\\times b=100h\\cdot b+10t\\cdot b+o\\cdot b$ for a three-digit number with digits $h$, $t$, $o$.",
  "mcas-prism-range-select":
    "A rectangular prism with edges $\\ell$, $w$, $h$ has volume $V=\\ell wh$. Volumes of solids that do not overlap add.",
  "mcas-ratio-statements-select":
    "The ratio $a:b$ is equivalent to $ka:kb$ for $k\\neq0$. Two ratios $a:b$ and $c:d$ are equivalent when $ad=bc$. The order of the terms follows the order of the quantities named.",
  "mcas-true-quotient-equations":
    "$a\\div b=q$ exactly when $b\\cdot q=a$ and $b\\neq0$. An estimate $\\frac{a'}{b'}$ with $a'\\approx a$ and $b'\\approx b$ approximates $q$.",
  "mcas-cube-prism-statements":
    "A cube of edge $\\frac{1}{n}$ has volume $\\left(\\frac{1}{n}\\right)^{3}=\\frac{1}{n^{3}}$. A prism with edges $\\frac{a}{n},\\frac{b}{n},\\frac{c}{n}$ holds $abc$ such cubes, and its volume $\\frac{abc}{n^{3}}$ equals the product of its edges.",
  "mcas-statistical-question-select":
    "A statistical question anticipates variability in the data: the answers differ across the individuals or occasions it asks about.",
  "mcas-fraction-rate-select":
    "The unit rate for distance $d$ over time $t$ is $\\frac{d}{t}=d\\cdot\\frac{1}{t}$. For fractions, $\\frac{a}{b}\\div\\frac{c}{d}=\\frac{a}{b}\\cdot\\frac{d}{c}$.",
  "mcas-negative-fraction-forms":
    "For integers $a$ and $b\\neq0$, $-\\frac{a}{b}=\\frac{-a}{b}=\\frac{a}{-b}$ and $\\frac{-a}{-b}=\\frac{a}{b}$. Each negative sign multiplies the value by $-1$, so $k$ signs give $(-1)^{k}$.",
  "mcas-markup-price-select":
    "A price $p$ percent above cost $c$ is $c\\left(1+\\frac{p}{100}\\right)$, and $p$ percent below is $c\\left(1-\\frac{p}{100}\\right)$.",
  "mcas-rational-irrational-select":
    "A rational number equals $\\frac{p}{q}$ for integers $p$ and $q\\neq0$. $\\sqrt{n}$ is rational exactly when $n$ is a perfect square of a rational number. The sum of a rational and an irrational number is irrational, and so is the product of a nonzero rational and an irrational.",
  "mcas-sci-notation-select":
    "Multiplying by $10^{k}$ moves the decimal point $k$ places right when $k>0$ and $|k|$ places left when $k<0$, so $c\\times10^{-k}=\\frac{c}{10^{k}}$ is positive when $c>0$.",
  "mcas-table-intercept-select":
    "For a linear function $y=mx+b$, the $y$-intercept is $b=y_0-mx_0$ for any point $(x_0,y_0)$ of the table, where $m=\\frac{y_1-y_0}{x_1-x_0}$.",
  "mcas-quadratic-zeros-select":
    "If $(x-p)(x-q)=0$ then $x=p$ or $x=q$ (zero-product property). A value $v$ is a zero of $f$ exactly when $f(v)=0$.",
  "mcas-congruence-statement-select":
    "If $\\triangle ABC\\cong\\triangle DEF$, then $A\\leftrightarrow D$, $B\\leftrightarrow E$, $C\\leftrightarrow F$: corresponding angles are congruent, and so are the sides joining corresponding vertices.",
  "mcas-circle-equation-select":
    "The circle with center $(h,k)$ and radius $r>0$ is the set of points with $(x-h)^{2}+(y-k)^{2}=r^{2}$. A point is inside if the left side is less than $r^{2}$ and outside if it is greater.",
  "mcas-cylinder-scaling-select":
    "For $V=\\pi r^{2}h$, replacing $r$ by $fr$ and $h$ by $gh$ gives $\\pi(fr)^{2}(gh)=f^{2}g\\,V$.",
  "mcas-circle-radius-distance":
    "A circle with center $O$ and radius $r$ is the set of points $P$ with $OP=r$. The diameter is $2r$ and the circumference is $2\\pi r$.",
  "mcas-parenthesized-product-statement":
    "In $n\\times(a+b)$ the parentheses group $a+b$ as one quantity, so the value is $n$ times $(a+b)$. By the distributive property it equals $na+nb$, not $na+b$.",
  "mcas-slope-sign-description":
    "The slope is $m=\\frac{\\Delta y}{\\Delta x}$. It is positive when $\\Delta y$ and $\\Delta x$ have the same sign, negative when they have opposite signs and zero when $\\Delta y=0$.",
  "mcas-rotational-symmetry":
    "A figure has rotational symmetry of order $n>1$ if rotating it by $\\frac{360^\\circ}{n}$ about a center maps it onto itself. A regular polygon with $n$ sides has order $n$, and a parallelogram has order 2.",
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
      "mcas-true-fact-equations",
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
      "Check each stated ratio, speed or price against the quantities it describes, keeping order and units straight.",
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
        "You need to simplify fractions and multiply and divide with them. A ratio, a rate and a percent change each compare quantities in a set order. A statement is true only if it uses the right quantities in the right order and gets the right number.",
      ],
    ],
    workedExample: {
      prompt:
        "A bag has 6 red marbles and 9 blue marbles. Is “the ratio of red marbles to all marbles is $2:5$” true?",
      steps: [
        "There are $6+9=15$ marbles in all.",
        "Red to all is $6:15$.",
        "Divide both numbers by 3: $6:15=2:5$.",
      ],
      answer: "True",
    },
    closingSections: [
      method("Order, orientation and the starting amount", [
        "For a ratio, put the first quantity named first. For a speed, put the distance over the time: miles divided by hours gives miles per hour, and hours divided by miles does not. Write mixed numbers as fractions and divide by multiplying by the reciprocal.",
        "For a percent change, find the percent of the original cost, then add it or subtract it. The percent of the cost alone is not the new price.",
      ]),
      formal("Equal ratios and percent change", [
        "$a:b=c:d$ exactly when $ad=bc$. For distance $d$ and time $t$, the rate is $\\frac{d}{t}$. A price $p$ percent above cost $c$ is $c\\left(1+\\frac{p}{100}\\right)$.",
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
      "A statistical question expects different answers, so it needs data. A question with one answer does not.",
    templateIds: ["mcas-statistical-question-select"],
    objectives: [
      "Tell a statistical question from a question with a single answer.",
    ],
    intuition: [
      "Will the answers vary?",
      [
        "You need to know what data is: a set of values collected by asking or measuring. Some questions have one answer that never changes, such as the number of lanes in a pool. Others have different answers for different people, items or days, such as how long each swimmer stays.",
        "A statistical question is of the second kind. You cannot answer it from one value, so you collect data and look at how the values spread.",
      ],
    ],
    workedExample: {
      prompt:
        "Is “How many minutes does each student spend on homework?” a statistical question? Is “How many students are in Room 12?”?",
      steps: [
        "Homework time differs from student to student, so the answers vary and you would collect data. The first question is statistical.",
        "The number of students in Room 12 is one fixed number, so the second question is not.",
      ],
      answer: "Only the first",
    },
    closingSections: [
      method("A test you can apply", [
        "Imagine asking the question of many people or on many days. If every answer would be the same, it is not statistical. If the answers would differ, it is.",
        "A question about one named person or one moment has a single answer, even if it begins with “how many”.",
      ]),
    ],
    pitfalls: [
      "“How many” does not make a question statistical. Check whether the answer varies.",
    ],
    parentGuide:
      "Ask the learner to change “How many seats does the theater have?” into a statistical question about the theater.",
  }),
  build({
    id: "mcas-number-forms-select",
    title: "Negative fractions, rational numbers and scientific notation",
    summary:
      "Decide whether forms of a number are equal by counting signs, simplifying radicals and moving the decimal point.",
    templateIds: [
      "mcas-negative-fraction-forms",
      "mcas-rational-irrational-select",
      "mcas-sci-notation-select",
    ],
    objectives: [
      "Find the expressions equal to a negative fraction.",
      "Decide which radical or pi expressions are rational.",
      "Check equations between scientific notation and standard numerals.",
    ],
    intuition: [
      "Different forms, one value",
      [
        "You need to multiply integers and know that a fraction bar means division. A number can be written in many forms: $\\frac{-3}{4}$, $\\frac{3}{-4}$ and $-\\frac{3}{4}$ are the same number, and $2\\times10^{3}$ and 2,000 are the same number. The skill is deciding whether two forms are equal.",
      ],
    ],
    workedExample: {
      prompt: "Is $\\frac{-7}{-2}$ equal to $-\\frac{7}{2}$?",
      steps: [
        "$\\frac{-7}{-2}$ has two negative signs. A negative divided by a negative is positive, so it equals $\\frac{7}{2}$.",
        "$-\\frac{7}{2}$ has one negative sign and is negative.",
        "A positive number and a negative number are not equal.",
      ],
      answer: "No",
    },
    closingSections: [
      method("Count signs, simplify roots, move the point", [
        "For signs in a fraction, count the negative signs: an odd count is negative, an even count is positive, and the numerator and denominator must not be swapped.",
        "For rational numbers, simplify roots of perfect squares. A rational plus an irrational number is irrational, but roots can combine: $\\sqrt{2}\\cdot\\sqrt{8}=\\sqrt{16}=4$.",
        "For scientific notation, move the decimal point right for a positive exponent and left for a negative one.",
      ]),
      formal("Rules", [
        "$-\\frac{a}{b}=\\frac{-a}{b}=\\frac{a}{-b}$ and $\\frac{-a}{-b}=\\frac{a}{b}$. $c\\times10^{k}$ moves the decimal point of $c$ by $k$ places.",
      ]),
    ],
    pitfalls: [
      "Two negative signs cancel and give a positive value.",
      "A radical is irrational only if the number under it is not a perfect power.",
      "A negative exponent gives a small positive number, not a negative number.",
    ],
    parentGuide:
      "Ask what $10^{-2}$ means, and why $5\\times10^{-2}$ is 0.05 and not $-500$.",
  }),
  build({
    id: "mcas-function-equation-statements",
    title: "Intercepts, zeros, circle equations and slope sign",
    summary:
      "Read the intercept from a table, the zeros from a factored form, the center and radius from a circle's equation and the sign of a slope from a description.",
    templateIds: [
      "mcas-table-intercept-select",
      "mcas-quadratic-zeros-select",
      "mcas-circle-equation-select",
      "mcas-slope-sign-description",
    ],
    objectives: [
      "Find the y-intercept of a table that may not list $x=0$.",
      "Find the values that make a quadratic expression zero.",
      "Read the center and radius from the equation of a circle.",
      "Decide the sign of a slope from how the output changes.",
    ],
    intuition: [
      "Each form shows one feature",
      [
        "You need to substitute numbers for letters. A table, an equation and a description show the same function in different ways, and each makes one feature easy to read. A factored quadratic shows its zeros, the equation of a circle shows its center and radius, and a table shows the change in $y$ for each step in $x$.",
      ],
    ],
    workedExample: {
      prompt:
        "A linear table has $x$ values 2, 3, 4 and $y$ values 7, 10, 13. What is the $y$-intercept?",
      steps: [
        "$y$ increases by 3 for each increase of 1 in $x$, so the slope is 3.",
        "Going back from $x=2$ to $x=0$ is 2 steps of 1, which changes $y$ by $-6$.",
        "$7-6=1$.",
      ],
      answer: "1",
    },
    closingSections: [
      method("Read the feature you need", [
        "For a zero of $(x+3)(x-5)$, set each factor to 0: $x=-3$ and $x=5$. For a circle $(x+2)^{2}+(y-5)^{2}=16$, the center is $(-2,5)$ and the radius is 4. For a slope, compare the directions of the change in input and the change in output: the same direction gives a positive slope and opposite directions give a negative one.",
      ]),
      formal("Standard forms", [
        "A circle with center $(h,k)$ and radius $r$ has equation $(x-h)^{2}+(y-k)^{2}=r^{2}$. If $(x-p)(x-q)=0$ then $x=p$ or $x=q$. The slope is $m=\\frac{\\Delta y}{\\Delta x}$.",
      ]),
    ],
    pitfalls: [
      "The first $y$ in a table is the intercept only when the first $x$ is 0.",
      "The zero of $x+3$ is $-3$.",
      "The right side of a circle's equation is $r^{2}$, not $r$.",
    ],
    parentGuide:
      "Ask the learner what the graph of $(x-1)^{2}+y^{2}=9$ looks like, using its center and radius.",
  }),
  build({
    id: "mcas-geometry-part-statements",
    title: "Corresponding parts, radius distance and rotational symmetry",
    summary:
      "Match the parts of congruent triangles by position, use that every point on a circle is a radius from the center, and test a figure with a turn.",
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
        "You need to know what a triangle, a circle and a vertex are. Congruent figures have the same size and shape, so their parts match in pairs. A circle is all points at one distance from its center. A figure with rotational symmetry looks the same after a turn of less than a full circle.",
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
        "In a congruence statement, list vertices by position, then read each side or angle through those pairs. For a circle, find the radius from the given length: half the diameter, or the circumference divided by $2\\pi$. For symmetry, picture turning the figure about its center: a rectangle, parallelogram or rhombus lands on itself after a half turn; a scalene triangle, kite or isosceles trapezoid never does.",
      ]),
    ],
    pitfalls: [
      "A line of symmetry is not rotational symmetry.",
      "The diameter is the distance across a circle, not from its center to the circle.",
    ],
    parentGuide:
      "Ask the learner to place a rectangle drawn on paper and turn it a half turn to see that it lands on itself.",
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
