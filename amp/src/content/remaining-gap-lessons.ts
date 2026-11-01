import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

const budgetSenses = {
  change: "change",
  difference: "difference-subtract",
  "more than": "more-than",
};
const budgetNoLink = ["balance", "balances", "increasing"];
const payNoLink = ["net"];

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
    goal: "Given a situation to model, choose the variable definitions with units, the rate, a unit that matches the rate, or which quantities vary.",
    intuition:
      "A model relates quantities that can be measured. Before writing any equation, decide what each letter measures and in what unit. The quantity you choose or change is independent; the quantity that responds is dependent. A rate says how much the dependent quantity changes for each one unit of the independent quantity.",
    terms: ["independent-variable", "dependent-variable", "rate"],
    method: [
      "Name the quantity the question asks you to predict. It is the dependent quantity.",
      "Name the quantity that changes it. It is the independent quantity.",
      "Write each definition with its unit, and put the rate as dependent unit per independent unit.",
      "Convert any amount you substitute into the unit of the independent quantity before using the rate.",
    ],
    watch:
      "A fixed rate or starting amount is a number in the model, not a variable. A definition without a unit leaves it unclear what a value such as 90 means.",
  },
  "stem-leaf-read": {
    goal: "Given a stem-and-leaf plot and its key, read a value or a summary such as the range, median, mode, a count above a value or a difference.",
    intuition:
      "A stem-and-leaf plot writes each data value in two pieces. The stem holds the leading digits and the leaf holds the last digit. The key tells you what a stem and leaf mean together, including where the decimal point goes. The values increase down the plot and from left to right, so the plot is already in order.",
    terms: [
      "stem",
      "leaf",
      [
        "key",
        "In a stem-and-leaf plot, the key shows how to read a row: $3 \\mid 5$ means 3.5.",
      ],
    ],
    method: [
      "Read the key first and decide whether leaves are ones, tens or tenths of the stem.",
      "Read each value as stem then leaf. Repeat a leaf for each time the value occurs.",
      "Use the order: the first leaf is the least, the last leaf is the greatest, and the median is the middle leaf or the mean of the two middle leaves.",
      "Count leaves, not rows, when you need the number of values or how many exceed a given value.",
    ],
    watch:
      "A leaf alone is only the last digit. Combine it with its stem and apply the key, especially when the key shows a decimal point.",
  },
  "budget-category-balance": {
    goal: "Given an income and categorized expenses in dollars and cents, find a missing category, the surplus or deficit, or the change that balances.",
    senses: budgetSenses,
    noLink: budgetNoLink,
    intuition:
      "Income is the money coming in. An expense is the money spent on one category, such as rent or food. A budget is a plan for the money, and it balances when the income equals the total of the expenses. If expenses are less than income, the money left over is called a surplus. If expenses are more than income, the amount missing is called a deficit. Money amounts are decimals: numbers with a decimal point. Add and subtract them with the decimal points lined up.",
    terms: ["income", "expense", "surplus", "deficit"],
    method: [
      "Add all the expenses you know, with the decimal points lined up.",
      "Compare the total with the income, and subtract the smaller from the larger. If the budget must balance and one category is missing, that category is the income minus the known expenses.",
      "Name the result. If the income is larger, the difference is a surplus. If the expenses are larger, it is a deficit.",
      "To fix a deficit, cut spending by exactly the deficit. To use up a surplus, add spending or savings equal to the surplus.",
    ],
    watch:
      "Include every category in the total. A deficit is not an expense. It is the amount by which the expenses are more than the income.",
  },
  "gross-net-pay": {
    goal: "Given gross pay, deductions and net pay in dollars and cents, find net pay, gross pay or a missing deduction, or the take-home amount.",
    noLink: payNoLink,
    intuition:
      "Gross pay is the amount a worker earns before anything is taken out. A tax is the money people pay to the government. A deduction is an amount taken out of pay, such as a tax or a health plan payment. Net pay, also called take-home pay, is what is left: gross pay minus all the deductions. Pay amounts are decimals: numbers with a decimal point, such as 52.40 dollars.",
    terms: ["gross-pay", "deduction", "net-pay"],
    method: [
      "If pay is by the hour, multiply the hours by the pay for one hour to get gross pay.",
      "Add the deductions into one total, with the decimal points lined up.",
      "Net pay is gross pay minus the total deductions. Gross pay is net pay plus the total deductions. A missing deduction is gross pay minus net pay minus the known deductions.",
    ],
    watch:
      "Net pay is never more than gross pay. Subtract every deduction. To go from net pay back to gross pay, add the deductions back instead of subtracting them again.",
  },
};

export const remainingGapPrinciples: Record<string, string> = {
  "triangle-law-reasoning":
    "In a triangle with sides $a,b,c$ opposite angles $A,B,C$, an altitude $h$ from $C$ gives $h=b\\sin A=a\\sin B$, so $\\frac{a}{\\sin A}=\\frac{b}{\\sin B}$. An altitude from $A$ with foot $D$ between $B$ and $C$ and $x=CD=b\\cos C$ gives $c^2=a^2+b^2-2ab\\cos C$. For angle $A$ with sides $a$ opposite and $b$ adjacent: if $A$ is acute, $a<b\\sin A$ gives no triangle, $a=b\\sin A$ one, $b\\sin A<a<b$ two and $a\\ge b$ one.",
  "model-quantity-roles":
    "A quantitative model names each quantity, its unit and its role. For a linear model $y=mx+b$, $x$ is the independent quantity in unit $X$, $y$ the dependent quantity in unit $Y$, the rate $m$ has unit $Y$ per $X$, and $b$ is the value of $y$ when $x=0$ in unit $Y$.",
  "stem-leaf-read":
    "In a stem-and-leaf plot, each value is its stem followed by its leaf, read according to the key. The values are arranged in increasing order, with each leaf repeated for each occurrence of its value. The median of $n$ ordered values is the value in position $\\frac{n+1}{2}$ when $n$ is odd and the mean of the values in positions $\\frac{n}{2}$ and $\\frac{n}{2}+1$ when $n$ is even.",
  "budget-category-balance":
    "For income $I$ and expenses $E_1, \\dots, E_k$, income minus expenses is $I-(E_1+\\dots+E_k)$. Here $E_1$ is the first expense, $E_2$ the second, and so on up to $E_k$, the last. When income minus expenses is more than 0, it is a surplus. When it is less than 0, the deficit is the expenses minus the income. The budget balances exactly when income minus expenses is $0$.",
  "gross-net-pay":
    "If gross pay is $G$ and the deductions are $D_1, \\dots, D_k$, then net pay is $N=G-(D_1+\\dots+D_k)$. Here $D_1$ is the first deduction, $D_2$ the second, and so on up to $D_k$, the last. In the same way, $G=N+(D_1+\\dots+D_k)$, and the total deductions are $G-N$.",
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
      "Name what each variable measures and its unit, which quantity depends on which, and what the rate means.",
    templateIds: ["model-quantity-roles"],
    objectives: [
      "Define variables with units.",
      "Tell independent from dependent quantities and constants from variables.",
      "Match the unit of the independent quantity to the unit of the rate.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "A model starts with measurable quantities",
        paragraphs: [
          "A quantity is something you can measure with a unit, such as hours, dollars or liters. In a situation, some quantities change and some stay fixed. The quantity you choose or change is the independent quantity. The quantity that responds is the dependent quantity.",
          "A rate compares the two: dollars per hour says how many dollars the total changes for each added hour. Writing the variables with units keeps every later step honest.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A bike shop charges 6 dollars for each hour a bike is rented, plus a 4-dollar helmet fee. Define variables for a model of the total rental cost.",
      steps: [
        "The model predicts the total rental cost, so that is the dependent quantity, measured in dollars.",
        "The cost changes with the time a bike is rented, the independent quantity, measured in hours.",
        "Let $h$ be the time a bike is rented, in hours, and $C$ the total rental cost, in dollars.",
        "The rate 6 is dollars per hour. The helmet fee, 4 dollars, is the fixed starting amount. Both are numbers, not variables.",
      ],
      answer: "$h$ = time rented, in hours; $C$ = total cost, in dollars",
    },
    closingSections: [
      {
        stage: "method",
        title: "Match units before substituting",
        paragraphs: [
          "If the rate is dollars per hour and a customer rents a bike for 90 minutes, first convert: 90 minutes is 1.5 hours. Then $h=1.5$. Substituting 90 into an hourly rate would multiply the rate by minutes and give a cost 60 times too large.",
        ],
      },
      {
        stage: "formal",
        title: "Linear model roles",
        paragraphs: [
          "In $y=mx+b$, $x$ is the independent quantity in unit $X$ and $y$ is the dependent quantity in unit $Y$. The rate $m$ has unit $Y$ per $X$, and $b$ has unit $Y$: it is the value of $y$ when $x=0$.",
        ],
      },
    ],
    pitfalls: [
      'A variable needs a unit; "the cost" alone does not say dollars or cents.',
      "A rate is dependent unit per independent unit, not the other way around.",
      "Convert time and other amounts to the unit of the rate before you substitute.",
    ],
    parentGuide:
      "Ask the learner what changes and what stays the same in a situation from daily life, and in what unit each quantity is measured.",
  },
  {
    id: "stem-leaf-read",
    title: "Read a stem-and-leaf plot",
    summary:
      "Use the key to turn stems and leaves into values, then read the least, greatest, range, median, mode and counts.",
    templateIds: ["stem-leaf-read"],
    objectives: [
      "Decode a key, including a key with a decimal point.",
      "Read ordered values to find extremes, range, median and mode.",
      "Count values above a given value.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "A list of values written in two pieces",
        paragraphs: [
          "A stem-and-leaf plot writes each value as a stem and a leaf. The stem is the leading digit or digits and the leaf is the last digit. When the key says $2\\mid 4$ means $24$, the stem 2 stands for tens, so row 2 contains the values 20 to 29. When the key says $2\\mid 4$ means $2.4$, the leaf counts tenths.",
          "The values increase down the plot and from left to right in each row, so the list is already in order. A leaf written twice in a row means that value occurs twice.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "$\\begin{array}{r|l}\\mathtt{1}&\\mathtt{2\\ 5\\ 8}\\\\\\mathtt{2}&\\mathtt{0\\ 0\\ 3\\ 6}\\\\\\mathtt{3}&\\mathtt{1}\\end{array}$ Key: $1\\mid 2$ means $1.2$ meters. Find the median and the range.",
      steps: [
        "Read the key: the stem is the whole-number part and the leaf is tenths. The values in order are 1.2, 1.5, 1.8, 2.0, 2.0, 2.3, 2.6, 3.1.",
        "There are 8 values, an even count. The middle values are the 4th and 5th, 2.0 and 2.0, so the median is 2.0.",
        "The greatest value is 3.1 and the least is 1.2. The range is $3.1-1.2=1.9$.",
      ],
      answer: "median 2.0 meters, range 1.9 meters",
      answerUnit: "meters",
    },
    closingSections: [
      {
        stage: "method",
        title: "Which summary to read",
        paragraphs: [
          "The least value is the first leaf of the top row and the greatest is the last leaf of the bottom row. The mode is a value whose stem and leaf both repeat. To count values greater than a given value, count the leaves in its row that are larger than its leaf and all leaves in later rows. A repeat of the given value is not greater.",
        ],
      },
      {
        stage: "formal",
        title: "Median position",
        paragraphs: [
          "For $n$ ordered values, the median is the value in position $\\frac{n+1}{2}$ when $n$ is odd. When $n$ is even, it is the mean of the values in positions $\\frac{n}{2}$ and $\\frac{n}{2}+1$. The range is the greatest value minus the least value.",
        ],
      },
    ],
    pitfalls: [
      "Combine each leaf with its stem and the key; a leaf alone is a single digit.",
      "Count leaves, not rows, when finding the middle or a total.",
      "When the key has a decimal point, a range or difference keeps the same decimal places.",
    ],
    parentGuide:
      "Ask the learner to read the key aloud and say what the first and last values in the plot are.",
  },
  {
    id: "budget-category-balance",
    title: "Balance a budget with dollars and cents",
    summary:
      "Income is the money coming in. An expense is the money spent on one thing, such as rent or food. A budget balances when the expenses add up to exactly the income. Add the expenses, compare the total with the income, and name or fix the difference.",
    templateIds: ["budget-category-balance"],
    senses: budgetSenses,
    noLink: budgetNoLink,
    objectives: [
      "Find a missing expense category by subtracting.",
      "Name a surplus or a deficit, and find its amount.",
      "Choose the change that balances the budget.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Income in, expenses out",
        paragraphs: [
          "Income is the money coming in. An expense is the money going out for one category, such as rent or food. A category is one kind of spending. A budget is a plan for the money, and it balances when the expenses add up to exactly the income.",
          "If the expenses are less than the income, the money left over is called a surplus. If the expenses are more than the income, the amount missing is called a deficit.",
          "Dollars and cents are decimals: numbers with a decimal point. Line up the decimal points before you add or subtract, so cents line up with cents.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "Monthly income is 640.00 dollars. Rent is 310.50, food is 148.25 and transport is 62.75 dollars. How much is left for other spending?",
      steps: [
        "Add the expenses, with the decimal points lined up: $310.50+148.25+62.75=521.50$.",
        "The money left is the income minus the expenses: $640.00-521.50=118.50$.",
        "Check by adding back: $521.50+118.50=640.00$, the income.",
      ],
      answer: "118.50",
      answerUnit: "dollars",
    },
    closingSections: [
      {
        stage: "method",
        title: "Surplus, deficit and balancing",
        paragraphs: [
          "Suppose all the expenses total 700.00 dollars and the income is 680.00 dollars. The expenses are more than the income by 20.00 dollars. That is a deficit of 20.00 dollars.",
          "To balance the budget, cut one category by exactly 20.00 dollars. Raising a category would make the deficit bigger.",
        ],
      },
      {
        stage: "formal",
        title: "Definition",
        paragraphs: [
          "The balance of a budget is the income minus the total of the expenses. When the balance is more than 0, it is a surplus. When it is less than 0, the expenses are more than the income, and the deficit is the expenses minus the income. A balance of 0 means the budget balances.",
        ],
      },
    ],
    pitfalls: [
      "Include every category in the total.",
      "Line up the decimal points so cents are added to cents.",
      "Fix a deficit by cutting spending, not by raising a category.",
    ],
    parentGuide:
      "Ask your child to make a small budget for one month. Then ask whether the plan has a surplus, a deficit or a balance.",
  },
  {
    id: "gross-net-pay",
    title: "Gross pay and net pay",
    summary:
      "Gross pay is what a worker earns before anything is taken out. A tax is the money people pay to the government. A deduction is an amount taken out of pay, such as a tax. Net pay is what is left after all the deductions. So net pay is gross pay minus the deductions.",
    templateIds: ["gross-net-pay"],
    noLink: payNoLink,
    objectives: [
      "Tell gross pay from net pay.",
      "Find net pay, gross pay or a missing deduction.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Earned, taken out, kept",
        paragraphs: [
          "Gross pay is the amount a worker earns before anything is taken out. A tax is the money people pay to the government. A deduction is an amount the employer takes out of pay, such as a tax or a health plan payment.",
          "Net pay, also called take-home pay, is what the worker gets: gross pay minus the deductions.",
          "Pay amounts are decimals: numbers with a decimal point. Line up the decimal points when you add the deductions and when you subtract.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A worker's gross pay is 420.00 dollars. Deductions are 52.40 for federal tax, 21.30 for state tax and 18.50 for a health plan. Find the net pay.",
      steps: [
        "Add the deductions, with the decimal points lined up: $52.40+21.30+18.50=92.20$.",
        "Net pay is gross pay minus the deductions: $420.00-92.20=327.80$.",
        "Check by adding back: $327.80+92.20=420.00$, the gross pay.",
      ],
      answer: "327.80",
      answerUnit: "dollars",
    },
    closingSections: [
      {
        stage: "method",
        title: "Going the other way",
        paragraphs: [
          "To find gross pay from net pay, add the deductions back: gross pay equals net pay plus the total deductions.",
          "To find one missing deduction, subtract net pay from gross pay. That gives all the deductions together. Then subtract the deductions you know.",
          "If pay is by the hour, first multiply the hours by the pay for one hour to get gross pay.",
        ],
      },
      {
        stage: "formal",
        title: "Relationship",
        paragraphs: [
          "Let $N$ be net pay, $G$ gross pay and $D$ the total deductions. Then $N=G-D$. So $G=N+D$, and $D=G-N$.",
        ],
      },
    ],
    pitfalls: [
      "Net pay is never more than gross pay.",
      "Subtract every listed deduction.",
      "Going from net pay to gross pay, add the deductions back. Do not subtract them again.",
    ],
    parentGuide:
      "Show your child a pay stub, the paper that comes with a paycheck. Ask which amount is earned, which amounts are taken out and which amount is kept.",
  },
];
