import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

export const numberMeasurementGapMethods: Record<string, ProblemMethod> = {
  "signed-context-order": {
    senses: { balance: "balance-account" },
    goal: "Compare signed numbers in debts, elevations or temperatures: which is greater, larger in size or farther from zero, and say it correctly.",
    intuition:
      "A negative number, written with a minus sign, is less than 0. It can mean a debt, a depth below sea level, or a temperature below zero. Two questions sound alike but ask different things. “Which is greater?” asks about position on the number line: farther right is greater. “How much is owed?” or “How far from zero?” asks about the absolute value, the distance from 0, written $|x|$.",
    terms: ["absolute-value", "number-line"],
    noLink: ["side", "mean", "positions", "position"],
    method: [
      "Mark the numbers on a number line, or write fractions as decimals so they are easy to compare.",
      "If the question asks which number is greater, higher, warmer or less cold, compare positions: farther left is less. A greater debt is a size question, not an order question.",
      "If the question asks for the size of a debt, a depth or a distance from 0, compare absolute values.",
      "Write the comparison with $<$ or $>$ and read it aloud to check that the symbol and the words agree.",
    ],
    watch:
      "Among negative numbers, the one with the greater absolute value is the lesser number: $-8<-3$ even though $8>3$. A debt of 8 is more debt, and a temperature of $-8$ is colder.",
  },
  "equivalent-expressions-check": {
    noLink: ["part", "parts"],
    goal: "Given a linear expression, decide which other expressions have the same value for every value of $x$.",
    intuition:
      "An expression is a group of numbers and letters joined by operations, like $3(x + 4) - x$. The letter $x$, a variable, stands for a number. Two expressions are equivalent when they give the same number for every value of $x$. Two moves rewrite an expression without changing its value. Distributing multiplies each term (each part joined by + or −) inside parentheses by the number outside: $3(x + 4) = 3x + 12$. Like terms are terms with the same letter part, and combining them adds them: $3x - x = 2x$.",
    terms: ["equivalent-expressions", "like-terms", "distributive-property"],
    senses: {
      multiples: "multiple",
      product: "product-multiply",
      terms: "term-expression",
      term: "term-expression",
    },
    method: [
      "Rewrite the given expression: distribute each multiplier over every term in its parentheses, keeping signs.",
      "Combine the $x$ terms together and the plain numbers together.",
      "Compare each choice with the simplified form. To test a doubtful choice, substitute the same value of $x$ into both expressions.",
      "If the two expressions give different results for the same value of $x$, they are not equivalent.",
    ],
    watch:
      "Agreeing at one value of $x$ does not make expressions equivalent: $2(x + 3)$ and $x + 6$ both give 6 at $x = 0$. Check a second value, or simplify both. Make sure the multiplier reaches every term inside the parentheses.",
  },
  "area-tiling-distributive": {
    goal: "Given a rectangle tiled with unit squares, a rectangle split into two parts, or an L-shaped figure, use the parts to find or write its area.",
    intuition:
      "Area is how many unit squares cover a shape, with no gaps and no overlaps. A unit square is a square with sides 1 unit long. A rectangle with 5 rows of 7 squares has $5\\times7=35$ squares. The sign $\\times$ means times: 5 groups of 7. A line can split a shape into two rectangles. An L-shape is two rectangles joined into one bent shape. Find the area of each part, then add. The total stays the same, because every square is in just one part. An expression is numbers joined by signs such as + and ×, like $3\\times7+2\\times7$. In an expression, multiply before you add, unless parentheses ( ) say to do a part first.",
    senses: {
      product: "product-multiply",
      products: "product-multiply",
      square: "square-shape",
      part: "part",
      parts: "part",
      side: "side",
      sides: "side",
      unit: "unit",
      units: "unit",
      whole: "whole",
    },
    terms: [
      "unit-square",
      [
        "composite-figure",
        "Here an L-shaped figure: two rectangles joined into one bent shape, with only square corners.",
      ],
    ],
    method: [
      "Find a line that splits the figure into rectangles that do not overlap. Use the dashed line if one is drawn.",
      "For each rectangle, multiply its height by its width. That counts its squares: rows times squares in a row.",
      "Add the areas of the parts. If an expression is asked for, write one product, the answer to a times, for each part. Join them with $+$.",
      "Check: if the whole figure is a rectangle, the parts must add up to its height times its whole width.",
    ],
    watch:
      "Multiply each part by its own two sides. If the height is 5 and the widths are 2 and 3, write $5\\times2+5\\times3$, not $5\\times2+3$. In an L-shape, do not count a part twice.",
  },
  "estimate-reasonableness": {
    goal: "Given a story with numbers, round them to choose the best estimate, or use an estimate to decide whether a calculated answer is reasonable.",
    intuition:
      "An estimate is a number close to the exact answer that is quick to find. To round a number means to swap it for a close, easy number. Rounding to the nearest ten gives the closest number that ends in 0, so 48 rounds to 50. Round the numbers the way the question says. Then do the operation the story calls for: add, subtract, multiply or divide. An answer is reasonable if it is close to the estimate. An estimate cannot check every digit, but it can catch an answer of the wrong size, like ten times too big.",
    senses: { product: "product-multiply" },
    terms: [
      "estimate",
      [
        "estimate",
        "An answer is reasonable when it is close to the estimate. An answer far from it likely has a mistake.",
      ],
    ],
    method: [
      "Choose the operation from what the story asks. The total of equal groups: multiply. How many in each group, or how many groups: divide. Putting amounts together: add. How many more: subtract.",
      "Round each number the way the question says, for example to the nearest ten.",
      "Do the operation with the rounded numbers.",
      "To check an answer, compare it with the estimate. If it is close, it is reasonable. If it is far off, look for a mistake in the place value or the operation.",
    ],
    watch:
      "Do not add when the story asks for the total of equal groups. Count the zeros in a rounded product, the answer to a times. When you multiply, an answer ten times too big or too small has a mistake, often a digit in the wrong place.",
  },
  "unit-chain-conversion": {
    goal: "Given a quantity in one set of units and the conversion facts, find it in the requested units by multiplying through a chain of conversions.",
    intuition:
      "A unit is a fixed amount used to measure, like a meter. A kilometer is a length of 1000 meters, written km. A conversion fact such as $1\\text{ km} = 1000\\text{ m}$ means both name the same length. So the fraction $\\frac{1000\\text{ m}}{1\\text{ km}}$ equals 1. Multiplying by something equal to 1 changes the units but not the amount. Arrange each fraction so the unit you want to remove appears once on top and once on the bottom. Then it cancels, like a number divided by itself.",
    terms: ["conversion-factor", "dimensional-analysis"],
    senses: {
      edges: "edge",
      sides: "side",
      side: "side",
      unit: "unit",
      units: "unit",
      factor: "factor-number",
      square: "square-shape",
    },
    noLink: ["solid", "change", "changes"],
    method: [
      "Write the starting quantity with its units, and the units you need at the end.",
      "Choose conversion fractions so that each unwanted unit cancels, one fact at a time.",
      "Volume, the space a solid takes up, uses the length fact three times; area uses it twice: $1\\text{ m}^2 = 100^2\\text{ cm}^2$.",
      "Multiply and divide the numbers. Check that only the requested units remain.",
    ],
    watch:
      "For area, multiply by the length number twice; for volume, three times: $1\\text{ m}^3 = 100^3\\text{ cm}^3 = 1{,}000{,}000\\text{ cm}^3$, not 100. Convert time units too when a rate mixes hours and minutes.",
  },
  "fraction-of-set": {
    senses: { part: "part", parts: "part", whole: "whole" },
    goal: "Given a set of objects and a fraction, find how many objects the fraction names.",
    intuition:
      "A set is a group of objects, like 12 marbles. A fraction such as $\\frac{3}{4}$ has two numbers. The bottom number, 4, is the denominator. It says to split the set into 4 equal groups. The top number, 3, is the numerator. It says to take 3 of those groups. So $\\frac{3}{4}$ of 12 marbles means 4 groups of 3 marbles, and 3 of those groups make 9 marbles.",
    terms: [
      [
        "denominator",
        "For a fraction of a set, it is the number of equal groups the set is split into.",
      ],
      [
        "numerator",
        "For a fraction of a set, it is how many of the equal groups are taken.",
      ],
    ],
    method: [
      "Divide the set by the denominator. That gives the number of objects in one equal group.",
      "Multiply by the numerator. That gives the number of objects in that many groups.",
      "For the rest of the set, count the groups that are left: the denominator minus the numerator. Multiply by the number in one group.",
    ],
    watch:
      "The fraction names groups, not objects. $\\frac{3}{4}$ of 12 is not 3. First find the size of one group, then take 3 groups.",
  },
};

export const numberMeasurementGapPrinciples: Record<string, string> = {
  "signed-context-order":
    "For a real number $x$, $|x|=x$ if $x\\ge0$ and $|x|=-x$ if $x<0$, so $|x|$ is the distance from $x$ to 0. The number $a$ is less than $b$ exactly when $a$ is to the left of $b$ on the number line. For negative numbers $a$ and $b$, $a<b$ exactly when $|a|>|b|$. A debt of $d$ is the balance $-d$.",
  "equivalent-expressions-check":
    "Two expressions are equivalent when they have equal values for every allowed value of the variable. The distributive property $a(b+c)=ab+ac$ and combining like terms $px+qx=(p+q)x$ turn an expression into an equivalent one. A linear expression $mx+k$ is determined by its values at two different inputs, so equal values at two inputs show that two linear expressions are equivalent, while different values at one input show that they are not.",
  "area-tiling-distributive":
    "Area is the number of unit squares that cover a shape with no gaps and no overlaps. A rectangle with 5 rows of 7 squares has area $5\\times7=35$. The areas of parts that do not overlap add up to the whole area. So splitting a width of 7 into $4+3$ gives $5\\times(4+3)=5\\times4+5\\times3$. This is called the distributive property.",
  "estimate-reasonableness":
    "Rounding to the nearest ten moves a number by 5 or less. When you add or multiply numbers that are big compared with 5, working with rounded numbers gives an answer near the exact one. Subtracting two numbers that are close together can give a poor estimate. When you multiply numbers that are 10 or more, an answer ten times bigger or smaller than the estimate cannot be right. An estimate cannot show that every digit is right.",
  "unit-chain-conversion":
    "If $1\\text{ A} = k\\text{ B}$, then $\\frac{k\\text{ B}}{1\\text{ A}} = 1$, and multiplying a quantity by this ratio changes its units without changing its size. For lengths, $1\\text{ A}^2 = k^2\\text{ B}^2$ and $1\\text{ A}^3 = k^3\\text{ B}^3$.",
  "fraction-of-set":
    "To find $\\frac{3}{4}$ of 12, split 12 into 4 equal groups of 3, then take 3 groups: $3\\times3=9$. With letters, $\\frac{a}{b}$ of $n$ objects is $a\\times(n\\div b)$. Here $b$ is not 0, $n$ splits evenly into $b$ groups, and $a$ is no more than $b$. One of those groups is $\\frac{1}{b}$ of the set.",
};

export const numberMeasurementGapLessons: Lesson[] = [
  {
    senses: { balance: "balance-account", "more than": "more-than" },
    id: "signed-context-order",
    title: "Compare signed numbers in context",
    summary:
      "A negative number is less than 0, like a debt of 12 dollars written as −12. On a number line, numbers grow to the right, so the number farther right is greater: −7 is greater than −12. But the debt of 12 dollars is the bigger debt. The size of a number, its distance from 0, is called its absolute value. Order uses position; size, debt and distance use absolute value.",
    templateIds: ["signed-context-order"],
    noLink: ["mean", "positions", "position"],
    objectives: [
      "Tell apart which number is greater and which has the larger absolute value.",
      "Order signed fractions and decimals and state the order in words.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Order and size are different questions",
        paragraphs: [
          "You need to compare whole numbers and read a number line, a line with numbers in order at equal steps. Negative numbers, written with a minus sign, sit to the left of 0. A negative number can mean a debt, a depth below sea level, or a temperature below zero.",
          "An account balance is the amount of money in an account, and a negative balance means money is owed. The absolute value of a number is its distance from 0, so it is never negative. It is written with two upright bars: $|-12| = 12$ and $|7| = 7$.",
          "Asking which number is greater is about position: the number farther right on the number line is greater. Asking how much is owed, or how far something is from sea level, is about size: it uses the absolute value.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "Ana's account balance is $-12$ dollars and Ben's is $-7$ dollars. Who has the greater debt, and who has the greater balance?",
      steps: [
        "A negative balance is a debt. “Greater debt” asks about size, so use absolute value, the distance from 0: $|-12| = 12$ dollars and $|-7| = 7$ dollars.",
        "12 is more than 7, so Ana owes more and has the greater debt.",
        "“Greater balance” asks about order, so compare positions. On the number line $-12$ is to the left of $-7$, so $-12 < -7$, read “−12 is less than −7”.",
        "Check: Ben owes less, so his balance is closer to 0 and is the greater number.",
      ],
      answer:
        "Ana has the greater debt (12 dollars). Ben has the greater balance ($-7>-12$).",
    },
    closingSections: [
      {
        stage: "method",
        title: "Choose the question first",
        paragraphs: [
          "Underline what the question asks. Words such as greater balance, higher, warmer and less cold ask about order, so compare positions on the number line. Words such as debt, depth, distance from sea level and how far ask about size, so compare absolute values.",
          "To order fractions and decimals, write each as a decimal, for example $-\\frac{3}{4}=-0.75$. Place the negative numbers to the left of 0 and put the one with the greater absolute value farthest left.",
        ],
      },
      {
        stage: "formal",
        title: "Absolute value and order",
        paragraphs: [
          "For a real number $x$, $|x| = x$ when $x \\ge 0$ ($x$ is 0 or more), and $|x| = -x$ when $x < 0$. It is the distance from $x$ to 0. The number $a$ is less than $b$ exactly when $a$ is left of $b$ on the number line.",
          "For two negative numbers $a$ and $b$, $a<b$ exactly when $|a|>|b|$. A negative number is always less than a positive number, whatever their absolute values.",
        ],
      },
    ],
    pitfalls: [
      "Do not conclude that −8 is greater than −3 because 8 is greater than 3. On the number line −8 is farther left, so $-8 < -3$.",
      "Do not say a position below sea level cannot be compared. Its distance is its absolute value.",
      "When listing least to greatest, check that the direction matches the question.",
    ],
    parentGuide:
      "Ask the learner whether a balance of −9 dollars or −4 dollars is the greater debt, and which is the greater balance. Then ask why the answers differ.",
  },
  {
    noLink: ["parts", "part", "rule"],
    id: "equivalent-expressions-check",
    title: "Test whether expressions are equivalent",
    summary:
      "An expression is numbers and letters joined by operations, such as $3(x + 4) - x$. The letter $x$, called a variable, stands for a number. Two expressions are equivalent when they give the same value for every value of $x$. To check, rewrite one step at a time: multiply out the parentheses, then collect matching parts. Trying one number for $x$ can show two expressions differ, but it cannot prove they match.",
    templateIds: ["equivalent-expressions-check"],
    senses: {
      terms: "term-expression",
      term: "term-expression",
      product: "product-multiply",
    },
    objectives: [
      "Rewrite a linear expression (one where $x$ is never multiplied by $x$, such as $3x + 2$) by multiplying out parentheses and combining like terms.",
      "Use substitution, putting a number in place of $x$, to show that expressions are not equivalent, and explain why one matching value is not proof.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Same value for every input",
        paragraphs: [
          "You need to find the value of an expression such as $2x + 5$ when $x$ has a value: for $x = 3$, it is $2 \\times 3 + 5 = 11$. Here $2x$ means 2 times $x$. Two expressions are equivalent when they give the same value for every value of $x$.",
          "A number right before parentheses multiplies everything inside: $3(x + 4) = 3 \\times x + 3 \\times 4 = 3x + 12$. This rule, $a(b + c) = ab + ac$, is called the distributive property. The parts joined by + or − are called terms.",
          "Like terms have the same letter part, such as $3x$ and $5x$. The number in front of the letter is its coefficient. Like terms combine by adding their coefficients: $3x + 5x = 8x$, because 3 of something plus 5 of the same thing is 8 of it.",
        ],
      },
    ],
    workedExample: {
      prompt: "Is $3(x+4)-x$ equivalent to $2x+12$?",
      steps: [
        "Multiply out the parentheses: the 3 multiplies both $x$ and 4, so $3(x + 4) = 3x + 12$. The expression becomes $3x + 12 - x$.",
        "Combine the like terms $3x$ and $-x$: 3 of $x$ minus 1 of $x$ is $2x$. The expression is $2x + 12$, the same as the other one.",
        "Check with $x = 5$: $3(5 + 4) - 5 = 27 - 5 = 22$, and $2 \\times 5 + 12 = 22$.",
        "Check with $x = 0$: $3 \\times 4 - 0 = 12$, and $2 \\times 0 + 12 = 12$. Both inputs agree, as they must.",
      ],
      answer: "Yes, they are equivalent.",
    },
    closingSections: [
      {
        stage: "method",
        title: "Simplify, then substitute only to find a difference",
        paragraphs: [
          "Multiply out parentheses first, keeping the sign of each product (the answer when you multiply). Then combine like terms. Two expressions that simplify to the same form are equivalent.",
          "To test a suspicious pair quickly, substitute the same value of $x$ into both. If the values differ, the expressions are not equivalent. If they match, try another value or simplify; for example $2(x+3)$ and $x+6$ both equal 6 at $x=0$ but are different expressions, because at $x=1$ they give 8 and 7.",
        ],
      },
      {
        stage: "formal",
        title: "Why two inputs settle linear expressions",
        paragraphs: [
          "Expressions are equivalent when they have equal values for every allowed $x$. Take two linear expressions $mx + k$ and $nx + j$, where $m$, $k$, $n$ and $j$ are numbers. They agree at $x = 0$ exactly when $k = j$. They agree at $x = 1$ exactly when $m + k = n + j$. If they agree at both inputs, then $m = n$ and $k = j$, so they are the same expression.",
          "For other kinds of expressions, such as ones with $x^2$, agreeing at two inputs is not enough.",
        ],
      },
    ],
    pitfalls: [
      "A number outside parentheses multiplies every term inside, not only the first: $3(x + 4) = 3x + 12$, not $3x + 4$.",
      "A minus sign before a term subtracts it: $3x+12-x$ has $3x-x=2x$.",
      "Matching at one input proves nothing, but different values at one input prove the expressions differ.",
    ],
    parentGuide:
      "Ask the learner to show that $2(x+3)$ and $x+6$ agree at $x=0$ but are not equivalent.",
  },
  {
    id: "area-tiling-distributive",
    noLink: ["leaves", "mean"],
    title: "Find area by splitting a rectangle",
    summary:
      "Area is how many unit squares cover a shape, with no gaps and no overlaps. A unit square is a square with sides 1 unit long. A rectangle with 5 rows of 7 squares has an area of $5\\times7=35$ square units. The sign $\\times$ means times. You can split a rectangle, or an L-shape, into smaller rectangles. Find the area of each part, then add.",
    templateIds: ["area-tiling-distributive"],
    senses: {
      product: "product-multiply",
      products: "product-multiply",
      square: "square-shape",
      part: "part",
      parts: "part",
      side: "side",
      sides: "side",
      unit: "unit",
      units: "unit",
      whole: "whole",
    },
    objectives: [
      "Write the area of a split rectangle as the sum of two products.",
      "Find the area of an L-shaped figure by splitting it into two rectangles.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Count squares in parts",
        paragraphs: [
          "You will multiply small numbers, like $2\\times7$. A product is the answer to a times: the product of 2 and 7 is 14.",
          "Look at a rectangle with 5 rows of 7 squares. It has $5\\times7=35$ squares: 5 groups of 7.",
          "Draw a line after the second row. Now there is a top part with 2 rows and a bottom part with 3 rows. Each part is a rectangle.",
          "Every square is in just one part. So the two parts add up to all 35 squares.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A rectangle has 5 rows of 7 unit squares. A line splits it after the second row. Write the area as a sum of two products and find it.",
      steps: [
        "The top part has 2 rows of 7 squares. Its area is $2\\times7=14$.",
        "The bottom part has the other $5-2=3$ rows of 7 squares. Its area is $3\\times7=21$.",
        "Add the parts, because every square is in one part: $14+21=35$ square units.",
        "Check with the whole rectangle: $5\\times7=35$. Both ways match.",
      ],
      answer: "$2\\times7+3\\times7=35$ square units",
    },
    closingSections: [
      {
        stage: "method",
        title: "Split, multiply, add",
        paragraphs: [
          "Both parts have rows of 7. So the 5 rows split into 2 rows and 3 rows: $5\\times7=2\\times7+3\\times7$.",
          "In an expression, multiply before you add. Parentheses ( ) mean do that part first. In $(2+3)\\times7$, add $2+3=5$ first, then multiply by 7.",
          "So $(2+3)\\times7=2\\times7+3\\times7$. Multiplying each part of a sum like this is called the distributive property. It works for any whole numbers.",
          "For an L-shape, two rectangles joined into one bent shape, use the dashed line to split it. Find each rectangle's sides from the labels, multiply, and add. Adding all the side lengths around the figure gives its perimeter, not its area.",
        ],
      },
      {
        stage: "formal",
        title: "Why the parts add",
        paragraphs: [
          "The area of a shape covered by unit squares, with no gaps or overlaps, is its number of squares.",
          "If a shape is split into parts that share no squares, its area is the sum of the parts' areas.",
          "So a rectangle $a$ units tall and $b+c$ units wide splits into one $a$ by $b$ and one $a$ by $c$. The letters stand for whole numbers. This gives $a\\times(b+c)=a\\times b+a\\times c$.",
        ],
      },
    ],
    pitfalls: [
      "Multiply each part by its own two sides. $5\\times2+3$ leaves the 5 off the second part. Write $5\\times2+5\\times3$.",
      "Do not count any squares twice.",
      "Area counts the squares inside. Adding all the side lengths gives perimeter.",
    ],
    parentGuide:
      "Ask the learner to split a 4 by 6 rectangle in two different ways, and to show that both give the same area.",
  },
  {
    id: "estimate-reasonableness",
    noLink: ["mean"],
    title: "Estimate and check reasonableness",
    summary:
      "An estimate is a number close to the exact answer that is quick to find. To round a number means to swap it for a close, easy number, like 48 to 50. Round the numbers, then do the operation the story calls for. An answer is reasonable if it is close to the estimate. If it is far off, like ten times too big, look for a mistake.",
    templateIds: ["estimate-reasonableness"],
    senses: { product: "product-multiply" },
    objectives: [
      "Round numbers as the question asks and choose the best estimate.",
      "Use an estimate to decide whether a worked-out answer is reasonable.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Close is useful",
        paragraphs: [
          "You will round as the question asks, to the nearest ten, hundred or whole number, and then add, subtract, multiply or divide. Rounding to the nearest ten gives the closest number that ends in 0. So 48 rounds to 50, and 19 rounds to 20.",
          "48 × 19 is hard to work out in your head. 50 × 20 is easy: 5 tens times 2 tens is 10 hundreds, or 1,000. So 48 × 19 is about 1,000.",
          "An estimate cannot check every digit. But it can catch an answer of the wrong size. 9,120 is about ten times too big to be 48 × 19.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A school orders 48 boxes with 19 pencils in each box. Kai calculated 912 pencils. Round each number to the nearest ten. Is 912 reasonable?",
      steps: [
        "The story has 48 equal groups of 19 pencils, so multiply.",
        "Round each number to the nearest ten: 48 is about 50, and 19 is about 20.",
        "Multiply the rounded numbers: $50\\times20=1000$.",
        "912 is close to 1000, so it is reasonable. An answer of 9,120 or 91 would be far from 1000, so it would be wrong.",
      ],
      answer: "Yes, 912 is reasonable because the estimate is 1000.",
    },
    closingSections: [
      {
        stage: "method",
        title: "Operation, rounding, comparison",
        paragraphs: [
          "First choose the operation from what the story asks. To find the total of equal groups, multiply. To find how many are in each group, or how many groups, divide. To put amounts together, add. To find how many more, subtract.",
          "Then round every number the way the question says. Work out the answer with the rounded numbers.",
          "To judge an answer, compare its size with the estimate. A product, the answer to a times, that is ten times too big or too small has a mistake. Often a digit is in the wrong place, or the wrong operation was used. Close does not mean exact. A close answer is reasonable, but it could still have a small mistake.",
        ],
      },
      {
        stage: "formal",
        title: "How close an estimate is",
        paragraphs: [
          "Rounding to the nearest ten moves each number by 5 or less. So when you add or multiply numbers that are big compared with 5, working with rounded numbers gives an answer near the exact one. Subtracting two numbers that are close together can give a poor estimate.",
          "When you multiply numbers that are 10 or more, an answer ten times bigger or smaller than the estimate cannot be right. So an estimate can show an answer is wrong, but it cannot prove it is right.",
        ],
      },
    ],
    pitfalls: [
      "Do not add the rounded numbers when the story has equal groups.",
      "Round each number the way the question says before you work it out.",
      "Count the zeros in a rounded product so no digit lands in the wrong place.",
    ],
    parentGuide:
      "Ask the learner to estimate 31 × 29 by rounding to 30 × 30 = 900. Then ask why 8,990 cannot be the exact answer.",
  },
  {
    id: "unit-chain-conversion",
    title: "Convert through a chain of units",
    summary:
      "A unit is a fixed amount used to measure, like a meter or a kilogram. A conversion fact such as 1 kilometer = 1000 meters means both name the same length. So the fraction $\\frac{1000\\text{ m}}{1\\text{ km}}$ equals 1, and multiplying by it changes the units but not the amount. Chain several such fractions so each unwanted unit cancels. For area, use a length fact twice; for volume, three times.",
    templateIds: ["unit-chain-conversion"],
    senses: {
      sides: "side",
      edges: "edge",
      unit: "unit",
      units: "unit",
      factor: "factor-number",
      square: "square-shape",
      cube: "cube",
    },
    noLink: ["change", "changes"],
    objectives: [
      "Build a chain of conversion fractions that cancels to the requested units.",
      "Use a length fact twice for area and three times for volume.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Multiply by ratios equal to 1",
        paragraphs: [
          "You need to multiply and divide whole numbers. A rate compares two quantities with different units, such as 15 milligrams (mg) per kilogram (kg). A ratio is a comparison of two amounts, and it can be written as a fraction.",
          "A conversion fact such as $1\\text{ km} = 1000\\text{ m}$ says that 1 kilometer and 1000 meters are the same length. So the ratio $\\frac{1000\\text{ m}}{1\\text{ km}}$ is a length divided by the same length, which equals 1.",
          "Multiplying by a ratio equal to 1 changes the units but not the amount. Chain several ratios so that every unit except the one you want appears once on top and once on the bottom. Then it cancels, just as $\\frac{5}{5} = 1$.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A doctor orders 15 milligrams of a medicine per kilogram of body mass per day. A patient has a mass of 24 kilograms. The daily amount is split into 3 equal doses. How many milligrams are in one dose?",
      steps: [
        "Write the rate with its units, so we can see what cancels: 15 milligrams for each kilogram, each day, written $15\\frac{\\text{mg}}{\\text{kg}\\cdot\\text{day}}$. The dot means “times”.",
        "Multiply by the patient's mass to get milligrams per day: $15\\frac{\\text{mg}}{\\text{kg}\\cdot\\text{day}} \\times 24\\text{ kg} = 360\\text{ mg per day}$. Kilograms appear on the bottom and on the top, so they cancel.",
        "The day's amount is split into 3 equal doses, so divide: $360\\text{ mg} \\div 3\\text{ doses} = 120\\text{ mg per dose}$.",
        "Check: 3 doses of 120 mg make 360 mg, and $15 \\times 24 = 360$. Only milligrams per dose remain, the units asked for.",
      ],
      answer: "120 milligrams per dose",
    },
    closingSections: [
      {
        stage: "method",
        title: "Follow the units",
        paragraphs: [
          "Write every number with its units and cross out matching units on the top and bottom. If an unwanted unit does not cancel, flip that ratio or add another conversion fact. A speed in kilometers per hour used for minutes needs $\\frac{1\\text{ h}}{60\\text{ min}}$ too.",
          "For area and volume, square or cube the length factor (the number in the length fact). Since $1\\text{ m}=100\\text{ cm}$, $1\\text{ m}^2=100^2\\text{ cm}^2=10{,}000\\text{ cm}^2$ and $1\\text{ m}^3=100^3\\text{ cm}^3=1{,}000{,}000\\text{ cm}^3$. Then use any further fact, such as $1\\text{ L}=1000\\text{ cm}^3$.",
        ],
      },
      {
        stage: "formal",
        title: "Why the factor is squared or cubed",
        paragraphs: [
          "Take any two length units with $1\\text{ A} = k\\text{ B}$. A square with sides $1\\text{ A}$ long has sides $k\\text{ B}$ long, so its area is $k\\text{ B} \\times k\\text{ B} = k^2\\text{ B}^2$. A cube with edges $1\\text{ A}$ long has edges $k\\text{ B}$ long, so its volume is $k\\text{ B} \\times k\\text{ B} \\times k\\text{ B} = k^3\\text{ B}^3$.",
          "Multiplying a quantity by a ratio equal to 1, such as $\\frac{k\\text{ B}}{1\\text{ A}}$, does not change the quantity, only the units used to write it.",
        ],
      },
    ],
    pitfalls: [
      "Use $100^2 = 10{,}000$ or $100^3 = 1{,}000{,}000$, not 100, when converting square or cubic meters to square or cubic centimeters.",
      "Convert time as well when a rate mixes hours with minutes.",
      "Check the final units, not only the arithmetic.",
    ],
    parentGuide:
      "Ask the learner why 1 square meter is 10,000 square centimeters and not 100.",
  },
  {
    id: "fraction-of-set",
    title: "A fraction of a set",
    summary:
      "A set is a group of objects, like 12 marbles. A fraction such as $\\frac{3}{4}$ can name part of a set. The bottom number, 4, is the denominator. It says to split the set into 4 equal groups. The top number, 3, is the numerator. It says to take 3 of those groups. So $\\frac{3}{4}$ of 12 marbles is 3 groups of 3 marbles, which is 9 marbles.",
    templateIds: ["fraction-of-set"],
    senses: {
      fourth: "fourth",
      part: "part",
      parts: "part",
      whole: "whole",
    },
    objectives: [
      "Find a fraction of a set by first finding the size of one equal group.",
      "Find the rest of the set, and find several groups from the size of one group.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Equal groups",
        paragraphs: [
          "You will split a number into equal groups and multiply. Put 12 marbles into 4 equal groups. Each group has $12\\div4=3$ marbles.",
          "Each group is $\\frac{1}{4}$ of the set, one fourth. Three groups are $\\frac{3}{4}$ of the set: $3\\times3=9$ marbles.",
          "A fraction of a set is a number of objects. It is not the numerator itself: $\\frac{3}{4}$ of 12 is 9, not 3.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A set has 12 marbles. $\\frac{3}{4}$ of the marbles are red. How many are red?",
      steps: [
        "The denominator is 4, so split the 12 marbles into 4 equal groups: $12\\div4=3$ marbles in each group.",
        "The numerator is 3, so 3 of the groups are red: $3\\times3=9$.",
        "The one group left is not red: $12-9=3$ marbles, which is $\\frac{1}{4}$ of the set.",
        "Check: $9+3=12$, the whole set.",
      ],
      answer: "9 red marbles",
    },
    closingSections: [
      {
        stage: "method",
        title: "Group size first",
        paragraphs: [
          "Find the size of one group: divide the set by the denominator. Then multiply by the numerator.",
          "For the part that is not named, use the groups that are left. For $\\frac{3}{4}$, 1 group of the 4 is left, so the rest is $\\frac{1}{4}$ of the set.",
          "If $\\frac{1}{5}$ of a set is 7 objects, then each of the 5 equal groups has 7 objects. So $\\frac{3}{5}$ of the set is $3\\times7=21$.",
        ],
      },
      {
        stage: "formal",
        title: "Fraction times whole number",
        paragraphs: [
          "Finding $\\frac{3}{4}$ of 12 means $3\\times(12\\div4)=3\\times3=9$.",
          "With letters, let $a$, $b$ and $n$ be whole numbers. Here $b$ is not 0, $n$ objects split evenly into $b$ groups, and $a$ is no more than $b$. Then $\\frac{a}{b}$ of $n$ is $a\\times(n\\div b)$. The fraction $\\frac{1}{b}$ of $n$ is one of the $b$ equal groups, and $\\frac{a}{b}$ is $a$ of them.",
        ],
      },
    ],
    pitfalls: [
      "$\\frac{3}{4}$ of 12 is not 3. Find the size of one group first.",
      "Divide by the denominator and count groups with the numerator, not the other way around.",
      "For the rest of the set, subtract the numerator from the denominator to count the groups left.",
    ],
    parentGuide:
      "Ask the learner to draw 20 dots, circle $\\frac{2}{5}$ of them, and explain how many groups there are and how many dots are in each.",
  },
];
