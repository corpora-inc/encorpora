import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

export const remainingGapMethods: Record<string, ProblemMethod> = {
  "triangle-law-reasoning": {
    goal: "Choose a step in deriving the law of sines or cosines, the law that starts a given triangle, or the number of triangles the data allow.",
    intuition:
      "An altitude is a segment from a vertex perpendicular to the opposite side. It cuts a triangle into right triangles, where sine and cosine are ratios of sides. Writing the same altitude in two ways, or Pythagoras' theorem in two right triangles, links the original sides and angles.",
    terms: ["altitude", "opposite-side-angle", "included-angle"],
    method: [
      "Draw the altitude and name the two right triangles it makes. In each, identify the hypotenuse and the leg you want.",
      "To derive a law, write the same quantity (the altitude, or the foot's distance along the base) with sine or cosine in each right triangle, then equate or substitute.",
      "To choose a law, look for a side with its opposite angle (law of sines) or for three sides or two sides with the angle between them (law of cosines).",
      "For two sides and a non-included angle, compare the side opposite the angle with the height $b\\sin A$ and with $b$ to count the triangles.",
    ],
    watch:
      "A cosine relates the adjacent leg to the hypotenuse; a sine relates the opposite leg. Use the hypotenuse of the same right triangle, and keep the cosine term in the law of cosines subtracted.",
  },
  "model-quantity-roles": {
    goal: "Read a situation and choose the right variable definitions and units, the rate, a matching unit, or which quantities vary.",
    intuition:
      "A model is an equation that stands for a real situation. A variable is a letter for a quantity that can vary, measured in a unit such as hours or dollars. The quantity you choose is the independent quantity. The quantity that results from it is the dependent quantity. A rate, such as 6 dollars per hour, says how much the dependent quantity changes for each one unit of the independent quantity.",
    senses: { model: "model", unit: "unit" },
    noLink: ["change", "changes", "sort", "leaves"],
    terms: ["independent-variable", "dependent-variable", "rate"],
    method: [
      "Find the quantity the model predicts. It responds to the other one, so it is the dependent quantity.",
      "Find the quantity you choose or set. It is the independent quantity.",
      "Define each letter with what it measures and its unit. Write the rate as dependent unit per independent unit.",
      "Before substituting, convert the amount to the unit the rate uses, such as minutes to hours.",
    ],
    watch:
      "A fixed fee or fixed rate is a number in the model, not a variable. Give every variable a unit, or a value such as 90 has no clear meaning.",
  },
  "stem-leaf-read": {
    goal: "Read a stem-and-leaf plot with its key to find a value, the range, median or mode, a count above a value, or a difference.",
    intuition:
      "A stem-and-leaf plot lists data values in two pieces. The stem is the first digit or digits, on the left. The leaf is the last digit, on the right, and each leaf is one value. The key is the note that says how to join them, for example $3 \\mid 5$ means 35 or 3.5. Values grow down the plot and left to right, so they are already in order.",
    senses: {
      key: "key",
      stem: "stem",
      leaf: "leaf",
      mode: "mode-statistics",
      range: "range-statistics",
      mean: "mean-average",
      difference: "difference-subtract",
      "more than": "more-than",
    },
    noLink: ["part", "increasing"],
    terms: [
      "stem",
      "leaf",
      [
        "key",
        "In a stem-and-leaf plot, the key shows how to read a row: $3 \\mid 5$ means 3.5.",
      ],
    ],
    method: [
      "Read the key first. Decide whether each leaf is the ones digit or the tenths digit.",
      "Join each leaf to its stem to read a value. A leaf written twice is a value that appears twice.",
      "Use the order. The first leaf is the least value and the last is the greatest. The median is the middle value. With two middle values, it is their mean, which means their sum divided by 2.",
      "Count leaves, not rows, to find how many values there are or how many are greater than a number.",
    ],
    watch:
      "A leaf alone is only the last digit. Join it to its stem and read it with the key, especially when the key has a decimal point.",
  },
  "budget-category-balance": {
    goal: "Given an income and categorized expenses in dollars and cents, find a missing category, the surplus or deficit, or the change that balances.",
    intuition:
      "A budget balances when the income equals the total of the expenses. If expenses are less than income, the difference is a surplus. If expenses are more than income, the difference is a deficit. Money amounts are decimals: add and subtract them with the decimal points lined up.",
    terms: ["income", "expense", "surplus", "deficit"],
    method: [
      "Add all the expenses you know, lining up the decimal points.",
      "Subtract the smaller of the income and the total from the larger. A missing category is income minus the known expenses.",
      "Name the result: income larger is a surplus, expenses larger is a deficit.",
      "To balance a deficit, reduce spending by exactly the deficit. To balance a surplus, add spending or savings equal to the surplus.",
    ],
    watch:
      "Include every category in the total. A deficit is not a negative expense: it is a name for expenses exceeding income.",
  },
  "gross-net-pay": {
    goal: "Given gross pay, deductions and net pay in dollars and cents, find net pay, gross pay or a missing deduction, or the take-home amount.",
    intuition:
      "Gross pay is what a worker earns before anything is taken out. Deductions, such as taxes and a health plan, are amounts withheld from it. Net pay, or take-home pay, is what remains: gross pay minus all the deductions.",
    terms: ["gross-pay", "deduction", "net-pay"],
    method: [
      "If pay is by the hour, multiply the hours by the hourly pay to get gross pay.",
      "Add the deductions into one total with the decimal points lined up.",
      "Net pay is gross pay minus total deductions. Gross pay is net pay plus total deductions. A missing deduction is gross minus net minus the known deductions.",
    ],
    watch:
      "Net pay is smaller than gross pay. Subtract every listed deduction, and add them back, not subtract again, when going from net to gross.",
  },
};

export const remainingGapPrinciples: Record<string, string> = {
  "triangle-law-reasoning":
    "In a triangle with sides $a,b,c$ opposite angles $A,B,C$, an altitude $h$ from $C$ gives $h=b\\sin A=a\\sin B$, so $\\frac{a}{\\sin A}=\\frac{b}{\\sin B}$. An altitude from $A$ with foot $D$ between $B$ and $C$ and $x=CD=b\\cos C$ gives $c^2=a^2+b^2-2ab\\cos C$. For angle $A$ with sides $a$ opposite and $b$ adjacent: if $A$ is acute, $a<b\\sin A$ gives no triangle, $a=b\\sin A$ one, $b\\sin A<a<b$ two and $a\\ge b$ one.",
  "model-quantity-roles":
    "A model names each quantity, its unit and its role. In a linear model $y=mx+b$ ($mx$ means $m$ times $x$), $x$ is the independent quantity, measured in a unit $X$, and $y$ is the dependent quantity, measured in a unit $Y$. The rate $m$ has unit $Y$ per $X$, and $b$ is the value of $y$ when $x=0$, in unit $Y$.",
  "stem-leaf-read":
    "In a stem-and-leaf plot, each value is its stem followed by its leaf, read with the key. The values are listed from least to greatest, and a leaf is repeated once for each time its value occurs. For $n$ ordered values, the median is the value in position $\\frac{n+1}{2}$ when $n$ is odd, and the mean of the values in positions $\\frac{n}{2}$ and $\\frac{n}{2}+1$ when $n$ is even.",
  "budget-category-balance":
    "For income $I$ and expenses $E_1,\\dots,E_k$, the balance is $I-(E_1+\\dots+E_k)$. A positive balance is a surplus and a negative balance is a deficit of its absolute value. The budget balances exactly when the balance is $0$.",
  "gross-net-pay":
    "If gross pay is $G$ and the deductions are $D_1,\\dots,D_k$, then net pay is $N=G-(D_1+\\dots+D_k)$. Equivalently, $G=N+(D_1+\\dots+D_k)$ and the total deductions equal $G-N$.",
};

export const remainingGapLessons: Lesson[] = [
  {
    id: "triangle-law-reasoning",
    title: "Where the triangle laws come from and when they apply",
    summary:
      "Drop an altitude to make right triangles, then read the laws of sines and cosines from them. Match a law to the measurements you are given.",
    templateIds: ["triangle-law-reasoning"],
    objectives: [
      "Derive the law of sines and the law of cosines from an altitude.",
      "Choose the law that fits given measurements.",
      "Count the triangles in a side-side-angle situation.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Right triangles inside any triangle",
        paragraphs: [
          "In a right triangle, the sine of an angle is the opposite leg divided by the hypotenuse, and the cosine is the adjacent leg divided by the hypotenuse. An ordinary triangle is not a right triangle, but an altitude, a segment from a vertex perpendicular to the opposite side, cuts it into two right triangles.",
          "Side $a$ is the side opposite angle $A$, and likewise for $b$ and $B$ and for $c$ and $C$. Writing one altitude in terms of both right triangles, or applying Pythagoras' theorem to both, links the sides and angles of the original triangle.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "In triangle $ABC$ the altitude $h$ from $C$ meets $AB$ at $D$ between $A$ and $B$. Show that $\\frac{a}{\\sin A}=\\frac{b}{\\sin B}$.",
      steps: [
        "In right triangle $ADC$ the hypotenuse is $AC=b$ and $h$ is opposite angle $A$, so $h=b\\sin A$.",
        "In right triangle $BDC$ the hypotenuse is $BC=a$ and $h$ is opposite angle $B$, so $h=a\\sin B$.",
        "Both equal $h$, so $b\\sin A=a\\sin B$.",
        "Divide both sides by $\\sin A\\sin B$. On the left $\\sin A$ cancels, leaving $\\frac{b}{\\sin B}$; on the right $\\sin B$ cancels, leaving $\\frac{a}{\\sin A}$.",
      ],
      answer: "$\\frac{a}{\\sin A}=\\frac{b}{\\sin B}$",
    },
    closingSections: [
      {
        stage: "method",
        title: "Law of cosines from the same idea",
        paragraphs: [
          "Draw the altitude from $A$ to $BC$ with foot $D$, and let $x=CD$, so $BD=a-x$. In right triangle $ADC$, $x=b\\cos C$ and $h^2=b^2-x^2$. In right triangle $ADB$, $h^2=c^2-(a-x)^2$.",
          "Set the two expressions for $h^2$ equal: $b^2-x^2=c^2-a^2+2ax-x^2$. The $x^2$ terms cancel, so $c^2=a^2+b^2-2ax=a^2+b^2-2ab\\cos C$.",
        ],
      },
      {
        stage: "method",
        title: "Choosing a law",
        paragraphs: [
          "The law of sines needs a side together with the angle opposite it. Two angles and one side always provide such a pair, because the third angle is $180^\\circ$ minus the other two. The law of cosines starts from three sides, or from two sides and the angle between them.",
          "With two sides and an angle not between them (side-side-angle), the law of sines applies but the data may fit zero, one or two triangles. Take acute angle $A$ with opposite side $a$ and adjacent side $b$. The height is $b\\sin A$. If $a<b\\sin A$ there is no triangle; if $a=b\\sin A$ there is one right triangle; if $b\\sin A<a<b$ there are two; if $a\\ge b$ there is one.",
        ],
      },
      {
        stage: "formal",
        title: "Statements",
        paragraphs: [
          "Law of sines: $\\frac{a}{\\sin A}=\\frac{b}{\\sin B}=\\frac{c}{\\sin C}$. Law of cosines: $c^2=a^2+b^2-2ab\\cos C$, with the same pattern for the other two sides. If $C=90^\\circ$ the cosine is $0$ and the law of cosines reduces to the Pythagorean theorem.",
          "The derivations above assume the foot of the altitude lies between the vertices. When the foot lies outside, the same results hold; the supplementary angle has the same sine, and its cosine is the negative of the cosine, which gives the same final statements.",
        ],
      },
    ],
    pitfalls: [
      "Multiply the sine of an angle by the hypotenuse of the same right triangle, not by another side.",
      "Keep the cosine term in the law of cosines subtracted, with the factor 2.",
      "Compare the side opposite the angle with the height $b\\sin A$ before counting triangles.",
    ],
    parentGuide:
      "Ask the learner to say why an altitude helps and which side is the hypotenuse of each right triangle it makes.",
  },
  {
    id: "model-quantity-roles",
    title: "Define the quantities before the model",
    summary:
      "A model is an equation that describes a real situation. Before writing one, say what each letter stands for and its unit, such as hours or dollars. A bike rental costs 6 dollars per hour plus a 4-dollar fee. Let $h$ be the hours rented and $C$ the total cost in dollars. The cost depends on the hours, and 6 dollars per hour is the rate.",
    senses: { model: "model", unit: "unit" },
    noLink: ["change", "changes", "sort", "leaves", "part"],
    templateIds: ["model-quantity-roles"],
    objectives: [
      "Define each variable (a letter that stands for an amount) with what it measures and its unit.",
      "Tell the independent quantity, the one you choose, from the dependent quantity, the one that results.",
      "Tell numbers that stay fixed from quantities that vary, and match units to the rate before substituting.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "A model starts with measurable quantities",
        paragraphs: [
          "A quantity is something you can measure or count with a unit. Hours, dollars and liters are units. “Rental time in hours” and “total cost in dollars” are quantities.",
          "A model is an equation, graph or table that stands for a real situation, so you can predict with it. A variable is a letter, such as $h$, that stands for a quantity that can vary.",
          "In a situation, one quantity is chosen or set first. It is called the independent quantity. Another quantity responds to it. It is called the dependent quantity, because its value depends on the first. At the bike shop, you choose how many hours to rent. The cost follows from that, so cost is dependent.",
          "Some numbers do not vary. A 4-dollar helmet fee is the same for every customer. It is a fixed number in the model, not a variable.",
          "A rate compares two quantities. “6 dollars per hour” means the cost grows by 6 dollars for each added hour. Its unit is the dependent unit per the independent unit: dollars per hour.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A bike shop charges 6 dollars for each hour a bike is rented, plus a 4-dollar helmet fee. Define variables for a model of the total rental cost.",
      steps: [
        "Find what the model predicts: the total rental cost. It responds to the other quantity, so it is the dependent quantity. Its unit is dollars.",
        "Find what the cost depends on: the time the bike is rented. You choose it, so it is the independent quantity. Its unit is hours.",
        "Give each a letter, what it measures and its unit. Let $h$ be the time a bike is rented, in hours. Let $C$ be the total rental cost, in dollars.",
        "Sort out the fixed numbers. The rate, 6 dollars per hour, and the helmet fee, 4 dollars, are the same for everyone. They are numbers in the model, not variables. The model is $C = 6h + 4$.",
      ],
      answer: "$h$ = time rented, in hours; $C$ = total cost, in dollars",
    },
    closingSections: [
      {
        stage: "method",
        title: "Match units before substituting",
        paragraphs: [
          "Substituting means putting a number in place of a letter. The number must be in the letter's unit.",
          "The rate is dollars per hour, so $h$ is in hours. A customer rents a bike for 90 minutes. First convert: 60 minutes make an hour, so 90 minutes is 90 ÷ 60 = 1.5 hours. Then $h = 1.5$ and $C = 6 \\times 1.5 + 4 = 13$ dollars.",
          "Putting 90 in for $h$ would treat 90 minutes as 90 hours. The rental part would be 60 times too large.",
        ],
      },
      {
        stage: "formal",
        title: "Linear model roles",
        paragraphs: [
          "A linear model has the form $y = mx + b$. Here $mx$ means $m$ times $x$.",
          "The letter $x$ is the independent quantity, measured in some unit. The letter $y$ is the dependent quantity, in its own unit.",
          "The rate $m$ has the unit of $y$ per unit of $x$. The number $b$ is the value of $y$ when $x = 0$, in the unit of $y$. In the bike model, $m = 6$ dollars per hour and $b = 4$ dollars.",
        ],
      },
    ],
    pitfalls: [
      "Give every variable a unit. “The cost” alone does not say whether it is dollars or cents.",
      "Write a rate as the dependent unit per the independent unit: dollars per hour, not hours per dollar.",
      "Convert an amount to the rate's unit, such as minutes to hours, before you substitute it.",
      "A fixed fee or a fixed rate is a number, not a variable.",
    ],
    parentGuide:
      "Pick a daily situation, such as filling a tank or paying for a taxi. Ask what you choose, what follows from it, which numbers stay fixed, and the unit of each.",
  },
  {
    id: "stem-leaf-read",
    title: "Read a stem-and-leaf plot",
    summary:
      "A stem-and-leaf plot is a way to list numbers in order. Each number is split in two. The stem is the first digit or digits, written on the left. The leaf is the last digit, written on the right. A key is a note, such as “2 | 4 means 24,” that tells how to join them. Once you can read the numbers, you can find the smallest, the largest and the middle. You can also find the range: the largest minus the smallest.",
    senses: {
      key: "key",
      stem: "stem",
      leaf: "leaf",
      mode: "mode-statistics",
      range: "range-statistics",
      mean: "mean-average",
      difference: "difference-subtract",
      "more than": "more-than",
    },
    noLink: ["part", "increasing"],
    templateIds: ["stem-leaf-read"],
    objectives: [
      "Use the key to turn each stem and leaf into a number, including keys with a decimal point.",
      "Find the least and greatest values, the range, the median and the mode.",
      "Count how many values are greater than a given value.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "A list of values written in two pieces",
        paragraphs: [
          "Data are numbers collected about something, such as how tall some plants are. Each number is one value.",
          "A stem-and-leaf plot writes each value in two pieces. The stem is the leading digit or digits, on the left of the line. The leaf is the last digit, on the right. Each leaf in a row is one value.",
          "The key is the note that tells how to read the pieces together. If the key says $2 \\mid 4$ means 24, the stem 2 is the tens digit. So row 2 holds values from 20 to 29. If the key says $2 \\mid 4$ means 2.4, the leaf is the tenths digit, the first digit after the decimal point.",
          "The values go from smallest to largest. They grow down the plot and from left to right along each row. If a leaf is written twice in a row, that value appears twice in the data.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "$\\begin{array}{r|l}\\mathtt{1}&\\mathtt{2\\ 5\\ 8}\\\\\\mathtt{2}&\\mathtt{0\\ 0\\ 3\\ 6}\\\\\\mathtt{3}&\\mathtt{1}\\end{array}$ Key: $1\\mid 2$ means $1.2$ meters. Find the median and the range.",
      steps: [
        "Read the key first. The stem is the whole-number part and the leaf is the tenths digit. Join each leaf to its stem: 1.2, 1.5, 1.8, 2.0, 2.0, 2.3, 2.6, 3.1. The plot already lists them in order.",
        "The median is the middle value of the ordered list. Count the leaves: there are 8 values. With an even count, there are two middle values, the 4th and the 5th. Both are 2.0, so the median is 2.0.",
        "The range is the greatest value minus the least value. It shows how spread out the data are. The least is the first leaf, 1.2. The greatest is the last leaf, 3.1. So the range is $3.1 - 1.2 = 1.9$.",
      ],
      answer: "median 2.0 meters, range 1.9 meters",
      answerUnit: "meters",
    },
    closingSections: [
      {
        stage: "method",
        title: "Which summary to read",
        paragraphs: [
          "The least value is the first leaf in the top row. The greatest value is the last leaf in the bottom row.",
          "The mode is the value that appears most often. In a plot, look for a leaf repeated in the same row.",
          "To count values greater than a given value, find its row. Count the leaves in that row that are larger than its leaf. Then add every leaf in the rows below. A value equal to the given value is not greater, so do not count it.",
          "When two middle values differ, the median is their mean: their sum divided by 2. For 2.0 and 2.3, it is (2.0 + 2.3) ÷ 2 = 2.15.",
        ],
      },
      {
        stage: "formal",
        title: "Median position",
        paragraphs: [
          "Let $n$ be the number of values, listed in order. If $n$ is odd, the median is the value in position $\\frac{n+1}{2}$. For 7 values, that is position 4.",
          "If $n$ is even, the median is the mean of the values in positions $\\frac{n}{2}$ and $\\frac{n}{2}+1$. For 8 values, those are positions 4 and 5.",
          "The range is the greatest value minus the least value.",
        ],
      },
    ],
    pitfalls: [
      "Join every leaf to its stem and read it with the key. A leaf alone is only one digit.",
      "Count leaves, not rows, to find how many values there are or where the middle is.",
      "When the key has a decimal point, keep it in your answers. A range of 1.9 meters is not 19.",
    ],
    parentGuide:
      "Ask the learner to read the key aloud first. Then ask for the first and last values in the plot and what each one means.",
  },
  {
    id: "budget-category-balance",
    title: "Balance a budget with dollars and cents",
    summary:
      "Add the expenses, compare them with the income, and name or fix the difference.",
    templateIds: ["budget-category-balance"],
    objectives: [
      "Find a missing expense category by subtraction.",
      "Name a surplus or deficit and find its amount.",
      "Choose the change that balances the budget.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Income in, expenses out",
        paragraphs: [
          "Income is the money coming in. An expense is money going out to one category, such as rent or food. A budget balances when the expenses add up to exactly the income.",
          "If the expenses are less, the leftover is a surplus. If the expenses are more, the shortfall is a deficit. Dollars and cents are decimals: line up the decimal points before adding or subtracting.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "Monthly income is 640.00 dollars. Rent is 310.50, food is 148.25 and transport is 62.75 dollars. How much is left for other spending?",
      steps: [
        "Add the expenses: $310.50+148.25+62.75=521.50$.",
        "Subtract from the income: $640.00-521.50=118.50$.",
        "Check: $521.50+118.50=640.00$.",
      ],
      answer: "118.50",
      answerUnit: "dollars",
    },
    closingSections: [
      {
        stage: "method",
        title: "Surplus, deficit and balancing",
        paragraphs: [
          "If the total of all expenses is 700.00 dollars and the income is 680.00 dollars, expenses exceed income by 20.00 dollars. That is a deficit of 20.00 dollars. Reducing one category by exactly 20.00 dollars makes the budget balance. Raising a category would make the deficit larger.",
        ],
      },
      {
        stage: "formal",
        title: "Definition",
        paragraphs: [
          "The balance is income minus the total of the expenses. A positive balance is a surplus, a negative balance is a deficit of its absolute value, and a balance of 0 means the budget balances.",
        ],
      },
    ],
    pitfalls: [
      "Include every category in the total.",
      "Line up the decimal points so cents are added to cents.",
      "A deficit is fixed by reducing spending, not by increasing a category.",
    ],
    parentGuide:
      "Ask the learner to make a small budget for a month and say whether the plan has a surplus, a deficit or a balance.",
  },
  {
    id: "gross-net-pay",
    title: "Gross pay and net pay",
    summary:
      "Gross pay is earnings before deductions; net pay is what remains after them.",
    templateIds: ["gross-net-pay"],
    objectives: [
      "Tell gross pay from net pay.",
      "Find net pay, gross pay or a missing deduction.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Earned, withheld, kept",
        paragraphs: [
          "Gross pay is the amount a worker earns before anything is taken out. Deductions, such as taxes or a health plan, are amounts the employer withholds. Net pay, also called take-home pay, is what the worker receives: gross pay minus the deductions.",
          "Pay amounts are decimals in dollars and cents, so line up the decimal points when adding the deductions and subtracting.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A worker's gross pay is 420.00 dollars. Deductions are 52.40 for federal tax, 21.30 for state tax and 18.50 for a health plan. Find the net pay.",
      steps: [
        "Add the deductions: $52.40+21.30+18.50=92.20$.",
        "Subtract from gross pay: $420.00-92.20=327.80$.",
        "Check: $327.80+92.20=420.00$, the gross pay.",
      ],
      answer: "327.80",
      answerUnit: "dollars",
    },
    closingSections: [
      {
        stage: "method",
        title: "Going the other way",
        paragraphs: [
          "To find gross pay from net pay, add the deductions back: gross pay equals net pay plus total deductions. To find one missing deduction, subtract net pay from gross pay to get all deductions, then subtract the known deductions. If pay is by the hour, multiply hours by hourly pay to get gross pay first.",
        ],
      },
      {
        stage: "formal",
        title: "Relationship",
        paragraphs: [
          "Net pay $N$, gross pay $G$ and total deductions $D$ satisfy $N=G-D$, so $G=N+D$ and $D=G-N$.",
        ],
      },
    ],
    pitfalls: [
      "Net pay is smaller than gross pay.",
      "Subtract every listed deduction.",
      "Going from net to gross, add the deductions; do not subtract them again.",
    ],
    parentGuide:
      "Show the learner a sample pay stub and ask which amount is earned, which amounts are withheld and which amount is kept.",
  },
];
