import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

export const numberMeasurementGapMethods: Record<string, ProblemMethod> = {
  "signed-context-order": {
    goal: "Given debts, elevations, temperatures or lists of signed numbers, decide which is greater, which is larger in size, or which is farther from zero, and choose the statement that says it correctly.",
    intuition:
      "A negative number can mean a debt, a depth below sea level, or a temperature below zero. Two questions sound alike but ask different things. Which number is greater asks about position on the number line: farther right is greater. How large is it, how much is owed, or how far from zero asks about the absolute value $|x|$, the distance from 0.",
    terms: [
      [
        "absolute value",
        "The distance of a number from 0 on the number line. It is never negative: $|-7|=7$ and $|7|=7$.",
      ],
      [
        "order",
        "Of two numbers, the one farther right on the number line is greater. The one farther left is less.",
      ],
    ],
    method: [
      "Mark the numbers on a number line, or write fractions as decimals so they can be compared.",
      "If the question asks which is greater, higher, warmer or less cold, compare positions: farther left is less.",
      "If the question asks for the size of a debt, a depth or a distance from 0, compare absolute values.",
      "Write the comparison with $<$ or $>$ and read it aloud to check that the symbol and the words agree.",
    ],
    watch:
      "Among negative numbers the greater absolute value is the lesser number: $-8<-3$ even though $8>3$. A debt of 8 is more debt, and a temperature of $-8$ is colder.",
  },
  "equivalent-expressions-check": {
    goal: "Given a linear expression, decide which other expressions have the same value for every value of $x$.",
    intuition:
      "Two expressions are equivalent when they give the same number for every value of $x$. You can rewrite an expression into an equivalent one by distributing a multiplier over a sum and by combining like terms, which are terms with the same variable part. Substituting a value of $x$ is a quick test, but only in one direction: different values prove two expressions are not equivalent, while matching values at a single input prove nothing.",
    terms: [
      [
        "equivalent expressions",
        "Expressions that have the same value for every value of the variable.",
      ],
      [
        "like terms",
        "Terms with the same variable part, such as $3x$ and $5x$, or two plain numbers. They combine by adding coefficients.",
      ],
      [
        "distributive property",
        "$a(b+c)=ab+ac$. The multiplier $a$ multiplies every term inside the parentheses.",
      ],
    ],
    method: [
      "Rewrite the given expression: distribute each multiplier over every term in its parentheses, keeping signs.",
      "Combine the $x$ terms together and the plain numbers together.",
      "Compare each choice with the simplified form. To test a doubtful choice, substitute the same value of $x$ into both expressions.",
      "If two values of $x$ give different results, the expressions are not equivalent.",
    ],
    watch:
      "Agreeing at one value of $x$ does not make expressions equivalent. Check a second value, or simplify both. Also make sure the multiplier reaches every term inside the parentheses.",
  },
  "area-tiling-distributive": {
    goal: "Given a rectangle tiled with unit squares, a rectangle split into two parts, or an L-shaped figure, use the parts to find or write its area.",
    intuition:
      "Area is the number of unit squares that cover a shape with no gaps and no overlaps. A rectangle with 5 rows of 7 squares has $5\\times7=35$ squares. If a line splits the rectangle into two smaller rectangles, count each part and add. The total does not change, because every square is in exactly one part.",
    terms: [
      [
        "unit square",
        "A square with sides of length 1. It has an area of 1 square unit.",
      ],
      [
        "rectilinear figure",
        "A figure whose sides meet at right angles, such as an L-shape.",
      ],
    ],
    method: [
      "Find a line that splits the figure into rectangles with no overlap. Use the dashed line if one is drawn.",
      "For each rectangle, multiply its two side lengths.",
      "Add the areas of the parts. If a sentence is asked for, write one product for each part, joined by $+$.",
      "Check against one big rectangle when the figure is a rectangle: the sum of the parts must equal rows times columns.",
    ],
    watch:
      "Every part is multiplied by its own two sides. In $a\\times(b+c)$, the $a$ multiplies both $b$ and $c$, so write $a\\times b+a\\times c$, not $a\\times b+c$. In an L-shape do not count a region twice.",
  },
  "estimate-reasonableness": {
    goal: "Given a story with numbers, round them to choose the best estimate, or use an estimate to decide whether a calculated answer is reasonable.",
    intuition:
      "An estimate is a number close to the exact answer that is easy to find. To estimate, round each number to a place where the arithmetic is easy, then do the operation the story calls for. An estimate cannot confirm every digit of an answer, but it can show that an answer is the wrong size, such as ten times too large.",
    terms: [
      [
        "estimate",
        "A number close to the exact answer, found with rounded numbers.",
      ],
      [
        "reasonable",
        "Close enough to an estimate that the answer could be right. An answer far from the estimate has an error.",
      ],
    ],
    method: [
      "Decide the operation from the story: equal groups multiply, sharing equally divides, combining adds.",
      "Round each number as the question says, for example to the nearest ten.",
      "Do the operation with the rounded numbers.",
      "To check an answer, compare it with the estimate. If it is close, it is reasonable. If it is far off, look for a place-value or operation error.",
    ],
    watch:
      "Do not add when the story gives equal groups. Count the zeros in the rounded product: a result ten times too large or too small is a place-value error.",
  },
  "unit-chain-conversion": {
    goal: "Given a quantity in one set of units and the conversion facts, find it in the requested units by multiplying through a chain of conversions.",
    intuition:
      "A conversion fact such as $1\\text{ km}=1000\\text{ m}$ gives two ratios equal to 1, such as $\\frac{1000\\text{ m}}{1\\text{ km}}$. Multiplying by a ratio equal to 1 changes the units but not the amount. Write the units in each factor and arrange the ratios so the unit you want to remove appears once on top and once on the bottom and cancels.",
    terms: [
      [
        "conversion ratio",
        "A fraction equal to 1 built from a unit fact, with the same quantity in the numerator and denominator in different units.",
      ],
      [
        "dimensional analysis",
        "Tracking units through every step of a calculation so that they cancel to the units you want.",
      ],
    ],
    method: [
      "Write the starting quantity with its units, and the units you need at the end.",
      "Choose conversion ratios so that each unwanted unit cancels, one fact at a time.",
      "For squared or cubed units, apply the length factor two or three times: $1\\text{ m}^2=100^2\\text{ cm}^2$.",
      "Multiply and divide the numbers. Check that only the requested units remain.",
    ],
    watch:
      "A length factor must be squared for area and cubed for volume: $1\\text{ m}^3$ is $100^3=1{,}000{,}000\\text{ cm}^3$, not 100. Convert time units too when a rate mixes hours and minutes.",
  },
  "fraction-of-set": {
    goal: "Given a set of objects and a fraction, find how many objects the fraction names.",
    intuition:
      "In a fraction such as $\\frac{3}{4}$, the denominator 4 says to split the whole set into 4 equal groups. The numerator 3 says to take 3 of those groups. So $\\frac{3}{4}$ of 12 objects means 4 groups of 3 objects, and 3 of those groups make 9 objects.",
    terms: [
      [
        "denominator",
        "The bottom number of a fraction. It is the number of equal groups the set is split into.",
      ],
      [
        "numerator",
        "The top number of a fraction. It is how many of the equal groups are taken.",
      ],
    ],
    method: [
      "Divide the set by the denominator to find how many objects are in one equal group.",
      "Multiply by the numerator to find how many objects are in that many groups.",
      "For the rest of the set, take the groups that remain: denominator minus numerator.",
    ],
    watch:
      "The fraction names groups, not objects. $\\frac{3}{4}$ of 12 is not 3. First find the size of one group, then count 3 groups.",
  },
};

export const numberMeasurementGapPrinciples: Record<string, string> = {
  "signed-context-order":
    "For a real number $x$, $|x|=x$ if $x\\ge0$ and $|x|=-x$ if $x<0$, so $|x|$ is the distance from $x$ to 0. The number $a$ is less than $b$ exactly when $a$ is to the left of $b$ on the number line. For negative numbers $a$ and $b$, $a<b$ exactly when $|a|>|b|$. A debt of $d$ is the balance $-d$.",
  "equivalent-expressions-check":
    "Two expressions are equivalent when they have equal values for every allowed value of the variable. The distributive property $a(b+c)=ab+ac$ and combining like terms $px+qx=(p+q)x$ turn an expression into an equivalent one. A linear expression $mx+k$ is determined by its values at two different inputs, so equal values at two inputs show that two linear expressions are equivalent, while different values at one input show that they are not.",
  "area-tiling-distributive":
    "The area of a region covered by unit squares without gaps or overlaps is the number of squares. A rectangle with $a$ rows of $b$ squares has area $a\\times b$. Area is additive for regions that do not overlap, so splitting the width $b+c$ gives $a\\times(b+c)=a\\times b+a\\times c$.",
  "estimate-reasonableness":
    "Rounding a number to the nearest ten changes it by at most 5, so an operation on rounded numbers gives a value close to the exact result. An estimate that differs from a calculated result by a factor of about 10 shows a place-value or operation error. An estimate cannot verify exact digits.",
  "unit-chain-conversion":
    "If $1\\text{ A}=k\\text{ B}$, then $\\frac{k\\text{ B}}{1\\text{ A}}=1$, and multiplying a quantity by this ratio changes its units without changing its size. For lengths, $1\\text{ A}^2=k^2\\text{ B}^2$ and $1\\text{ A}^3=k^3\\text{ B}^3$.",
  "fraction-of-set":
    "For whole numbers $a$, $b$ and $n$ with $b$ dividing $n$, $\\frac{a}{b}$ of $n$ objects is $a\\times\\frac{n}{b}$. The unit fraction $\\frac{1}{b}$ of $n$ is one of $b$ equal groups, and $\\frac{a}{b}$ is $a$ of them.",
};

export const numberMeasurementGapLessons: Lesson[] = [
  {
    id: "signed-context-order",
    title: "Compare signed numbers in context",
    summary:
      "Greater means farther right on the number line. Size, debt and distance use the absolute value, the distance from 0.",
    templateIds: ["signed-context-order"],
    objectives: [
      "Tell apart which number is greater and which has the larger absolute value.",
      "Order signed fractions and decimals and state the order in words.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Order and size are different questions",
        paragraphs: [
          "You need to compare whole numbers and read a number line. A negative number can mean a debt, a depth below sea level, or a temperature below zero. The absolute value of a number, written $|x|$, is its distance from 0, so it is never negative.",
          "Asking which number is greater is about position: the number farther right on the number line is greater. Asking how much is owed, or how far something is from sea level, is about size: it uses the absolute value.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "Ana's account balance is $-12$ dollars and Ben's is $-7$ dollars. Who has the greater debt, and who has the greater balance?",
      steps: [
        "A negative balance is a debt. The size of each debt is the absolute value: $|-12|=12$ dollars and $|-7|=7$ dollars.",
        "Since $12>7$, Ana owes more.",
        "For the balance, compare positions. On the number line $-12$ is to the left of $-7$, so $-12<-7$.",
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
          "Underline what the question asks. Words such as greater, higher, warmer and less cold ask about order, so compare positions on the number line. Words such as debt, depth, distance from sea level and how far ask about size, so compare absolute values.",
          "To order fractions and decimals, write each as a decimal, for example $-\\frac{3}{4}=-0.75$. Place the negative numbers to the left of 0 and put the one with the greater absolute value farthest left.",
        ],
      },
      {
        stage: "formal",
        title: "Absolute value and order",
        paragraphs: [
          "For a real number $x$, $|x|=x$ when $x\\ge0$ and $|x|=-x$ when $x<0$. It is the distance from $x$ to 0. The number $a$ is less than $b$ exactly when $a$ is left of $b$ on the number line.",
          "For two negative numbers $a$ and $b$, $a<b$ exactly when $|a|>|b|$. A negative number is always less than a positive number, whatever their absolute values.",
        ],
      },
    ],
    pitfalls: [
      "Do not conclude $-8>-3$ because $8>3$. $-8$ is farther left.",
      "Do not say a position below sea level cannot be compared. Its distance is its absolute value.",
      "When listing least to greatest, check that the direction matches the question.",
    ],
    parentGuide:
      "Ask the learner whether $-9$ dollars or $-4$ dollars is the greater debt, and which is the greater balance, and to explain why the answers differ.",
  },
  {
    id: "equivalent-expressions-check",
    title: "Test whether expressions are equivalent",
    summary:
      "Equivalent expressions have the same value for every $x$. Distribute, combine like terms, and use substitution carefully.",
    templateIds: ["equivalent-expressions-check"],
    objectives: [
      "Rewrite a linear expression by distributing and combining like terms.",
      "Use substitution to show that expressions are not equivalent, and know why one matching value is not proof.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Same value for every $x$",
        paragraphs: [
          "You need to evaluate an expression such as $2x+5$ when $x$ has a value, and to multiply a number by a sum. Two expressions are equivalent when they give the same value for every value of $x$.",
          "The distributive property says $a(b+c)=ab+ac$: the multiplier outside multiplies every term inside. Like terms are terms with the same variable part, such as $3x$ and $5x$. They combine by adding coefficients: $3x+5x=8x$.",
        ],
      },
    ],
    workedExample: {
      prompt: "Is $3(x+4)-x$ equivalent to $2x+12$?",
      steps: [
        "Distribute the 3: $3(x+4)=3x+12$. The expression becomes $3x+12-x$.",
        "Combine the $x$ terms: $3x-x=2x$. The expression is $2x+12$.",
        "Check with $x=5$: $3(5+4)-5=27-5=22$ and $2(5)+12=22$.",
        "Check with $x=0$: $3(4)-0=12$ and $2(0)+12=12$. Both inputs agree, as they must.",
      ],
      answer: "Yes, they are equivalent.",
    },
    closingSections: [
      {
        stage: "method",
        title: "Simplify, then substitute only to find a difference",
        paragraphs: [
          "Distribute first, keeping the sign of each product, then combine like terms. Two expressions that simplify to the same form are equivalent.",
          "To test a suspicious pair quickly, substitute the same value of $x$ into both. If the values differ, the expressions are not equivalent. If they match, try another value or simplify; for example $2(x+3)$ and $x+6$ both equal 6 at $x=0$ but are different expressions, because at $x=1$ they give 8 and 7.",
        ],
      },
      {
        stage: "formal",
        title: "Why two inputs settle linear expressions",
        paragraphs: [
          "Expressions are equivalent when they have equal values for every allowed $x$. The expressions $mx+k$ and $m'x+k'$ agree at $x=0$ exactly when $k=k'$, and at $x=1$ exactly when $m+k=m'+k'$. If they agree at both inputs, then $m=m'$ and $k=k'$, so they are the same expression.",
          "For other kinds of expressions, agreement at finitely many inputs does not prove equivalence.",
        ],
      },
    ],
    pitfalls: [
      "A multiplier outside parentheses multiplies every term inside, not only the first.",
      "A minus sign before a term subtracts it: $3x+12-x$ has $3x-x=2x$.",
      "Matching at one input proves nothing, but different values at one input prove the expressions differ.",
    ],
    parentGuide:
      "Ask the learner to show that $2(x+3)$ and $x+6$ agree at $x=0$ but are not equivalent.",
  },
  {
    id: "area-tiling-distributive",
    title: "Find area by splitting a rectangle",
    summary:
      "Area counts unit squares. Split a rectangle or an L-shape into rectangles, find each area, and add.",
    templateIds: ["area-tiling-distributive"],
    objectives: [
      "Write the area of a split rectangle as a sum of two products.",
      "Find the area of an L-shaped figure by splitting it into two rectangles.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Count squares in parts",
        paragraphs: [
          "You need to multiply two whole numbers and know that a rectangle's area is rows times squares in a row. A unit square has sides of length 1 and an area of 1 square unit.",
          "A rectangle with 5 rows of 7 squares has $5\\times7=35$ squares. Draw a line that splits it into a top part and a bottom part. Each part is a rectangle, each square is in exactly one part, and so the two counts add to 35.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A rectangle has 5 rows of 7 unit squares. A line splits it after the second row. Write the area as a sum of two products and find it.",
      steps: [
        "The top part has 2 rows of 7 squares: $2\\times7=14$.",
        "The bottom part has the other $5-2=3$ rows of 7 squares: $3\\times7=21$.",
        "Add the parts: $14+21=35$ square units.",
        "Check with the whole rectangle: $5\\times7=35$.",
      ],
      answer: "$2\\times7+3\\times7=35$ square units",
    },
    closingSections: [
      {
        stage: "method",
        title: "Split, multiply, add",
        paragraphs: [
          "Both parts have the same row length, 7, so the number of rows is split: $5=2+3$ and $5\\times7=2\\times7+3\\times7$. This is the distributive property for whole numbers: $a\\times(b+c)=a\\times b+a\\times c$.",
          "For an L-shaped figure, use the dashed line to split it into two rectangles that do not overlap. Find each rectangle's sides from the labels, multiply, and add. Adding all the side lengths around the figure gives its perimeter, not its area.",
        ],
      },
      {
        stage: "formal",
        title: "Why the parts add",
        paragraphs: [
          "The area of a region covered by unit squares without gaps or overlaps is its number of squares. Area is additive: if a region is split into parts that share no squares, its area is the sum of the parts' areas.",
          "A rectangle $a$ units by $(b+c)$ units splits into rectangles $a$ by $b$ and $a$ by $c$, so $a\\times(b+c)=a\\times b+a\\times c$.",
        ],
      },
    ],
    pitfalls: [
      "Multiply each part by its own sides. $a\\times b+c$ leaves out the second part's $a$.",
      "Do not count squares in an overlap twice.",
      "Area counts squares inside. Adding all the side lengths gives perimeter.",
    ],
    parentGuide:
      "Ask the learner to split a 4 by 6 rectangle two different ways and show that both give the same area.",
  },
  {
    id: "estimate-reasonableness",
    title: "Estimate and check reasonableness",
    summary:
      "Round to easy numbers, do the operation the story calls for, and use the estimate to catch answers of the wrong size.",
    templateIds: ["estimate-reasonableness"],
    objectives: [
      "Round numbers as asked and choose the best estimate.",
      "Use an estimate to decide whether a calculated answer is reasonable.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Close is useful",
        paragraphs: [
          "You need to round a number to the nearest ten and multiply or divide whole numbers. An estimate is a number close to the exact answer that is easy to find. To estimate, round each number, then do the operation the story calls for.",
          "An estimate cannot confirm every digit. It can show that a calculated answer has the wrong size, for example ten times too large.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A school orders 48 boxes with 19 pencils in each box. Kai calculated 912 pencils. Round each number to the nearest ten. Is 912 reasonable?",
      steps: [
        "Equal groups call for multiplication.",
        "Round: 48 is about 50 and 19 is about 20.",
        "Multiply the rounded numbers: $50\\times20=1000$.",
        "Compare: 912 is close to 1000, so the answer is reasonable. An answer of 9,120 or 91 would be far from 1000.",
      ],
      answer: "Yes, 912 is reasonable because the estimate is 1000.",
    },
    closingSections: [
      {
        stage: "method",
        title: "Operation, rounding, comparison",
        paragraphs: [
          "First decide the operation from the story. Equal groups mean multiply, sharing equally means divide, and joining amounts means add. Then round every number as the question says and compute with the rounded numbers.",
          "To judge a calculated answer, compare its size with the estimate. A product ten times too large or too small is a place-value error. Close does not mean exact, so a close answer is reasonable, not guaranteed correct.",
        ],
      },
      {
        stage: "formal",
        title: "How close an estimate is",
        paragraphs: [
          "Rounding to the nearest ten changes a number by at most 5, so a product of rounded numbers is close to the exact product when the numbers are not small. The estimate gives the size, not the exact digits.",
          "An answer that differs from the estimate by about a factor of 10 cannot be right, so rounding can prove an answer wrong but not prove it right.",
        ],
      },
    ],
    pitfalls: [
      "Do not add rounded numbers when the story has equal groups.",
      "Round every number before computing, not just one.",
      "Count the zeros of a rounded product to avoid a place-value slip.",
    ],
    parentGuide:
      "Ask the learner to estimate 31 × 29 by rounding and to explain why 8,990 cannot be the exact product.",
  },
  {
    id: "unit-chain-conversion",
    title: "Convert through a chain of units",
    summary:
      "Treat each conversion fact as a ratio equal to 1, arrange the ratios so unwanted units cancel, and use squared or cubed factors for area and volume.",
    templateIds: ["unit-chain-conversion"],
    objectives: [
      "Build a chain of conversion ratios that cancels to the requested units.",
      "Apply a length factor twice for area and three times for volume.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Multiply by ratios equal to 1",
        paragraphs: [
          "You need to multiply and divide whole numbers and know that a rate such as 15 milligrams per kilogram compares two quantities. A conversion fact such as $1\\text{ km}=1000\\text{ m}$ gives the ratio $\\frac{1000\\text{ m}}{1\\text{ km}}$, which equals 1.",
          "Multiplying by a ratio equal to 1 changes the units but not the amount. Chain several ratios so that every unit except the one you want appears once on top and once on the bottom and cancels.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A doctor orders 15 milligrams of a medicine per kilogram of body mass per day. A patient has a mass of 24 kilograms. The daily amount is split into 3 equal doses. How many milligrams are in one dose?",
      steps: [
        "Write the rate with its units: $15\\frac{\\text{mg}}{\\text{kg}\\cdot\\text{day}}$.",
        "Multiply by the patient's mass: $15\\frac{\\text{mg}}{\\text{kg}\\cdot\\text{day}}\\times24\\text{ kg}=360\\text{ mg per day}$. The kilograms cancel.",
        "Divide by the number of doses: $360\\text{ mg}\\div3\\text{ doses}=120\\text{ mg per dose}$.",
        "Check: 3 doses of 120 mg make 360 mg, and $15\\times24=360$.",
      ],
      answer: "120 milligrams per dose",
    },
    closingSections: [
      {
        stage: "method",
        title: "Follow the units",
        paragraphs: [
          "Write every number with its units and cross out matching units on the top and bottom. If a unit does not cancel, the ratio is upside down. A speed in kilometers per hour used for minutes needs $\\frac{1\\text{ h}}{60\\text{ min}}$ too.",
          "For area and volume, square or cube the length factor. Since $1\\text{ m}=100\\text{ cm}$, $1\\text{ m}^2=100^2\\text{ cm}^2=10{,}000\\text{ cm}^2$ and $1\\text{ m}^3=100^3\\text{ cm}^3=1{,}000{,}000\\text{ cm}^3$. Then use any further fact, such as $1\\text{ L}=1000\\text{ cm}^3$.",
        ],
      },
      {
        stage: "formal",
        title: "Why the factor is squared or cubed",
        paragraphs: [
          "If $1\\text{ A}=k\\text{ B}$, then a square with side 1 A has side $k$ B, so its area is $k^2\\text{ B}^2$. A cube with edge 1 A has edge $k$ B and volume $k^3\\text{ B}^3$.",
          "Multiplying a quantity by a ratio equal to 1, such as $\\frac{k\\text{ B}}{1\\text{ A}}$, does not change the quantity, only the units used to write it.",
        ],
      },
    ],
    pitfalls: [
      "Use $100^2$ or $100^3$, not 100, when converting square or cubic meters to centimeters.",
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
      "The denominator splits a set into equal groups and the numerator tells how many groups to take.",
    templateIds: ["fraction-of-set"],
    objectives: [
      "Find a fraction of a set by finding the size of one equal group.",
      "Find the rest of the set, and the amount for a multiple of a unit fraction.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Equal groups",
        paragraphs: [
          "You need to divide a whole number into equal groups and multiply whole numbers. In a fraction such as $\\frac{3}{4}$, the denominator 4 says to split the set into 4 equal groups. The numerator 3 says to take 3 of those groups.",
          "A fraction of a set names a number of objects. $\\frac{3}{4}$ of 12 marbles is 3 groups of 3 marbles, which is 9 marbles.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A set has 12 marbles. $\\frac{3}{4}$ of the marbles are red. How many are red?",
      steps: [
        "The denominator is 4, so split 12 marbles into 4 equal groups: $12\\div4=3$ marbles in each group.",
        "The numerator is 3, so 3 groups are red: $3\\times3=9$.",
        "The other group is not red: $12-9=3$ marbles, which is $\\frac{1}{4}$ of the set.",
        "Check: $9+3=12$.",
      ],
      answer: "9 red marbles",
    },
    closingSections: [
      {
        stage: "method",
        title: "Group size first",
        paragraphs: [
          "Find the size of one group by dividing the set by the denominator. Then multiply by the numerator. For the part not named, use the remaining groups: for $\\frac{3}{4}$, the remaining fraction is $\\frac{1}{4}$.",
          "If you know that $\\frac{1}{5}$ of a set is 7 objects, then each of the 5 equal groups has 7 objects, so $\\frac{3}{5}$ of the set is $3\\times7=21$.",
        ],
      },
      {
        stage: "formal",
        title: "Fraction times whole number",
        paragraphs: [
          "For whole numbers $a$, $b$ and $n$ with $b$ dividing $n$, $\\frac{a}{b}$ of $n$ is $a\\times\\frac{n}{b}$. The fraction $\\frac{a}{b}$ is $a$ copies of the unit fraction $\\frac{1}{b}$, and $\\frac{1}{b}$ of $n$ is one of $b$ equal groups.",
        ],
      },
    ],
    pitfalls: [
      "$\\frac{3}{4}$ of 12 is not 3. Find the size of one group first.",
      "Use the denominator to divide and the numerator to count groups, not the other way around.",
      "For the rest of the set, subtract the numerator from the denominator to count the remaining groups.",
    ],
    parentGuide:
      "Ask the learner to draw 20 dots, circle $\\frac{2}{5}$ of them, and explain how many groups and how many dots are in each.",
  },
];
