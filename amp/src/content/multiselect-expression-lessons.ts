import { buildSelectContent, type SelectContentSpec } from "./multiselect-kit";

const specs: SelectContentSpec[] = [
  {
    id: "story-expression-select",
    skillId: "multi-operation-stories",
    title: "Expressions and number sentences that fit a story",
    summary:
      "Choose every expression or number sentence that finds the unknown part of a story.",
    goal: "Select the expressions or number sentences that find the unknown in a story by saying what each number and operation does.",
    intuition:
      "A story with a total and parts can be written in more than one way. If a stand has $300$ apples and sells $90$ and then $60$, the apples left come from taking away $90$ and then $60$, or from taking away $90+60$ at once.",
    more: "A number sentence with a box for the unknown also has several forms. If a trip is $340$ miles and $120$ miles are left, then $340-120=\\square$ and $\\square+120=340$ both find the miles already driven.",
    terms: ["expression", "number-sentence"],
    steps: [
      "Say the story in words: what is the whole, and what is taken away or put together?",
      "For each expression, say in order what its operations do, and compare with the story.",
      "For each sentence with a box, work out the box and check that it is the unknown the story asks for.",
      "Select only the choices that fit and check the count.",
    ],
    watch:
      "When parts are taken from a total, the answer is less than the total. An expression that adds a removed amount does not fit.",
    principle:
      "A whole is the sum of its parts, so one part is the whole minus the other parts: $T-a-b=T-(a+b)$. Addition and subtraction undo each other, so $\\square+k=T$ and $T-k=\\square$ describe the same unknown.",
    example: {
      prompt:
        "A tank holds $500$ liters. $120$ liters are used, then $80$ liters. Does $500-(120+80)$ find the liters left?",
      steps: [
        "Both $120$ and $80$ are taken from $500$.",
        "$500-(120+80)$ takes the two amounts away together.",
        "That is the same as taking them away one at a time, so it fits.",
      ],
      answer: "Yes, it equals $300$",
    },
    objectives: [
      "Write more than one expression for the same story and tell which fit.",
      "Choose the number sentences with a box that find a missing part of a total.",
    ],
    pitfalls: [
      "Adding an amount the story removes, as in $500-120+80$.",
      "Subtracting in the wrong order, such as $120-500$.",
      "Using only the first operation of a story that has two.",
    ],
    parentGuide:
      "Act out a story with a pile of objects and ask your learner to say each step aloud before writing it.",
    assessed:
      "Selecting the two or three expressions or number sentences of five that find an unknown part: a total with two amounts taken away, or a part of a total whose other part is known, with the box in any position.",
    notAssessed:
      "Does not assess solving the story, choosing multiplication or division models, or stories with more than two steps.",
  },
  {
    id: "equal-expression-select",
    skillId: "numerical-expressions",
    title: "Expressions with the same value",
    summary:
      "Find which rewrites of an expression with parentheses keep its value.",
    goal: "Select the expressions that have the same value as an expression with a subtraction inside parentheses.",
    intuition:
      "Parentheses tell you which operation to do first. In $3\\times(9-4)$ the subtraction comes first, so the value is $3\\times5=15$.",
    more: "A rewrite keeps the value when it only changes the order of factors or shares a multiplication over the parentheses, as in $3\\times9-3\\times4$. Dropping the parentheses, as in $3\\times9-4$, changes the value.",
    terms: ["parentheses", "order-of-operations"],
    steps: [
      "Find the value of the given expression, doing the parentheses first.",
      "Find the value of each choice in the same order.",
      "Compare each value with the given expression's value.",
      "Select only the choices with the same value and check the count.",
    ],
    watch: "Do not drop parentheses: $3\\times(9-4)=15$, but $3\\times9-4=23$.",
    principle:
      "Expressions are worked out by the order of operations. The distributive property gives $a\\times(b-c)=a\\times b-a\\times c$, and addition and multiplication can be done in either order: $a\\times b=b\\times a$.",
    example: {
      prompt:
        "Does $2\\times7-2\\times3$ have the same value as $2\\times(7-3)$?",
      steps: [
        "$2\\times(7-3)=2\\times4=8$.",
        "$2\\times7-2\\times3=14-6=8$.",
        "Both are $8$.",
      ],
      answer: "Yes",
    },
    objectives: [
      "Work out expressions with grouped subtraction by the order of operations.",
      "Tell value-keeping rewrites from rewrites that move or drop parentheses.",
    ],
    pitfalls: [
      "Working left to right and ignoring the parentheses.",
      "Sharing the multiplier with only one number in the parentheses.",
      "Subtracting in the other order, which gives a negative value.",
    ],
    parentGuide:
      "Write two expressions that differ only by parentheses and ask your learner to work out both.",
    assessed:
      "Selecting the two or three expressions of five that equal an expression with one subtraction inside parentheses multiplied, added to or divided, using whole numbers; rewrites reorder factors, share the multiplier or move the parentheses.",
    notAssessed:
      "Does not assess evaluating by entry, expressions with exponents, or expressions with variables.",
  },
  {
    id: "customary-equivalent-select",
    skillId: "unit-conversion",
    title: "Equal customary measurements",
    summary:
      "Find the measurements equal to a length, capacity or weight, including two-unit forms.",
    goal: "Select the measurements equal to a stated length, capacity or weight by changing every measurement to the smallest unit.",
    intuition:
      "A larger unit is made of smaller ones: $1$ yard is $3$ feet or $36$ inches, $1$ gallon is $4$ quarts, and $1$ pound is $16$ ounces. A measurement can be written in one unit or in two, such as $5$ yards $3$ feet.",
    more: "To compare, change every measurement to the same small unit and compare the numbers. Many different forms name the same length.",
    terms: ["customary-units", "equivalent"],
    steps: [
      "Change the stated measurement to the smallest unit in the choices by multiplying by the size of its unit.",
      "Change each choice to that unit: multiply each count by its unit's size and add the parts of a two-unit measurement.",
      "Compare each total with the stated measurement.",
      "Select only the equal measurements and check the count.",
    ],
    watch:
      "In a two-unit measurement, convert each part separately and add: $4$ yards $3$ feet is $144+36=180$ inches, not $4\\times3$.",
    principle:
      "Converting to a smaller unit multiplies by the number of small units in one large unit: $1\\text{ yd}=3\\text{ ft}=36\\text{ in}$, $1\\text{ gal}=4\\text{ qt}=8\\text{ pt}=16\\text{ c}$, $1\\text{ lb}=16\\text{ oz}$. Two measurements are equal when they have the same total in one unit.",
    example: {
      prompt: "Is $5$ feet $6$ inches equal to $66$ inches?",
      steps: [
        "$5$ feet is $5\\times12=60$ inches.",
        "$60+6=66$ inches.",
        "That equals $66$ inches.",
      ],
      answer: "Yes",
    },
    objectives: [
      "Convert a measurement written in one or two units to the smallest unit.",
      "Compare measurements in different units by their totals.",
    ],
    pitfalls: [
      "Using $12$ inches for a yard or $4$ quarts for a pint.",
      "Adding the counts of two units without converting.",
      "Converting only part of a two-unit measurement.",
    ],
    parentGuide:
      "Measure a table in feet and then in inches with your learner and ask how the two measurements are related.",
    assessed:
      "Selecting the two or three measurements of five that equal a stated whole number of yards, gallons or pounds, written in one unit or two units, in length, capacity and weight.",
    notAssessed:
      "Does not assess converting by entry, fractional or decimal measurements, or metric units.",
  },
  {
    id: "additive-multiplicative-select",
    skillId: "related-patterns",
    title: "Additive and multiplicative rules",
    summary:
      "Decide which statements are true about a rule that multiplies and a rule that adds.",
    goal: "Select the true statements about a multiplicative rule, $y$ equals a number times $x$, and an additive rule, $y$ equals $x$ plus a number.",
    intuition:
      "In the rule $y=7x$, every $y$ is $7$ times its $x$, so it is multiplicative. In the rule $y=x+7$, every $y$ is $7$ more than its $x$, so it is additive. The two rules give different values: for $x=3$, the first gives $21$ and the second gives $10$.",
    more: "A quick test is to compare $y$ with $x$ for two values of $x$. If $y\\div x$ is the same each time, the rule multiplies. If $y-x$ is the same each time, the rule adds.",
    terms: ["multiplicative-rule", "additive-rule"],
    steps: [
      "Find $y$ for two values of $x$ from each rule, such as $x=1$ and $x=2$.",
      "Check whether $y\\div x$ stays the same (multiplicative) or $y-x$ stays the same (additive).",
      "Test each statement against those values, and substitute for any statement about a particular $x$.",
      "Select only the true statements and check the count.",
    ],
    watch:
      "A rule that multiplies is not additive: in $y=7x$ the difference $y-x$ changes as $x$ changes.",
    principle:
      "A rule $y=kx$ keeps the ratio $y\\div x=k$ constant. A rule $y=x+c$ keeps the difference $y-x=c$ constant. For $k\\ge2$ and $c\\ge1$, one rule cannot be both.",
    example: {
      prompt: "In $y=x+4$, is $y$ always $4$ times $x$?",
      steps: [
        "For $x=1$, $y=5$, and $4\\times1=4$.",
        "$5$ is not $4$, so $y$ is not $4$ times $x$.",
        "In this rule $y$ is always $4$ more than $x$.",
      ],
      answer: "No",
    },
    objectives: [
      "Tell a multiplicative rule from an additive rule using ratios and differences.",
      "Substitute a value of $x$ into either rule to check a statement.",
    ],
    pitfalls: [
      "Treating $y=7x$ as $y=x+7$ because both contain a $7$.",
      "Adding the numbers in a multiplicative rule when finding $y$.",
      "Judging a rule from a single value of $x$ where the two rules give the same $y$.",
    ],
    parentGuide:
      "Make a two-row table for each rule and ask what happens to the bottom row when the top row goes up by $1$.",
    assessed:
      "Selecting the two or three true statements of six about one rule $y=mx$ and one rule $y=x+c$ with numbers from $2$ to $9$: the name of each rule, the constant relationship, and the value of $y$ for $x=3$, $4$ or $5$.",
    notAssessed:
      "Does not assess writing a rule from a table, graphing the rules, or rules with both a multiplier and an addend.",
  },
  {
    id: "equivalent-trinomial-select",
    skillId: "factor-quadratics",
    title: "Equivalent factored and expanded forms",
    summary:
      "Decide which factored, partly distributed and expanded forms equal a quadratic expression.",
    goal: "Select the expressions equal to a trinomial or to a product of binomials by expanding and comparing coefficients.",
    intuition:
      "A trinomial such as $x^2+5x+6$ and the product $(x+2)(x+3)$ are two forms of one expression. Expanding the product multiplies every term of one factor by every term of the other and combines like terms.",
    more: "A form can be partly expanded, such as $x(x+5)+6$ or $x(x+3)+2(x+3)$. Each is equal to the trinomial. A form with a sign changed or two numbers exchanged usually is not.",
    terms: ["trinomial", "factored-form", "coefficient"],
    steps: [
      "Expand each factored or partly factored choice: multiply every term of one factor by every term of the other.",
      "Combine the $x$ terms to get one trinomial in the form $ax^2+bx+c$.",
      "Compare the coefficients $a$, $b$ and $c$ with those of the given expression, expanded too if it is a product.",
      "Select only the equal expressions and check the count.",
    ],
    watch:
      "The middle coefficient is the sum of two cross products, $p\\times s+q\\times r$, so a sign error in one factor changes it.",
    principle:
      "Two quadratic expressions are equal exactly when their coefficients of $x^2$, $x$ and the constants match after expanding. $(px+q)(rx+s)=prx^2+(ps+qr)x+qs$.",
    example: {
      prompt: "Is $x(x+7)+10$ equal to $(x+2)(x+5)$?",
      steps: [
        "$(x+2)(x+5)=x^2+5x+2x+10=x^2+7x+10$.",
        "$x(x+7)+10=x^2+7x+10$.",
        "The coefficients $1$, $7$ and $10$ match.",
      ],
      answer: "Yes",
    },
    objectives: [
      "Expand a product of binomials into a trinomial and compare coefficients.",
      "Recognize partly factored forms of the same expression.",
    ],
    pitfalls: [
      "Multiplying only the first terms and the last terms of the binomials.",
      "Losing a sign when a factor has a negative constant.",
      "Matching only the constant term and ignoring the middle term.",
    ],
    parentGuide:
      "Draw an area model for a product such as $(x+2)(x+3)$ and ask where each part of the trinomial comes from.",
    assessed:
      "Selecting the two or three expressions of five equal to a trinomial with a leading coefficient of 1, 2 or 3, or to a product of two binomials, among factored, partly distributed, four-term and expanded forms with sign, swapped-constant and cross-term errors.",
    notAssessed:
      "Does not assess factoring by entry, special products, common factors, or quadratics with no integer factors.",
  },
  {
    id: "regression-prediction-select",
    skillId: "regression-interpretation",
    title: "True predictions from a line of best fit",
    summary:
      "Decide which predictions and interpretations follow from a stated line of best fit.",
    goal: "Select the true statements about predictions, the slope and the intercept of a stated line of best fit.",
    intuition:
      "A line of best fit is an equation $\\hat{y}=mx+b$ that predicts $y$ from $x$ for data that follow a linear pattern. The symbol $\\hat{y}$ is the predicted value. Putting a value of $x$ into the equation gives a prediction.",
    more: "The slope $m$ is the predicted change in $y$ for each added unit of $x$. The intercept $b$ is the prediction for $x=0$.",
    terms: [
      "line-of-best-fit",
      "slope",
      [
        "y-intercept",
        "On a line of best fit, it is the predicted $y$ when $x$ is 0.",
      ],
    ],
    steps: [
      "For a prediction at a given $x$, substitute it into the equation and compute $\\hat{y}$.",
      "For a statement about change, compare it with the slope, including its sign and units.",
      "For a statement about $0$, compare it with the intercept.",
      "Select only the true statements and check the count.",
    ],
    watch:
      "A negative slope means the predicted $y$ goes down as $x$ goes up: a greater $x$ gives a lesser prediction.",
    principle:
      "For the line $\\hat{y}=mx+b$, the prediction at $x=a$ is $ma+b$, the predicted change per unit of $x$ is $m$, and the prediction at $0$ is $b$. A prediction is reliable only for $x$ within the range of the data.",
    example: {
      prompt:
        "A line of best fit is $\\hat{y}=2.5x+40$. What does it predict for $x=6$?",
      steps: [
        "Substitute: $2.5\\times6+40$.",
        "$2.5\\times6=15$.",
        "$15+40=55$.",
      ],
      answer: "$55$",
    },
    objectives: [
      "Make a prediction by substituting into a stated line of best fit.",
      "Interpret the slope and the intercept in the context of the data.",
    ],
    pitfalls: [
      "Using the slope alone as the prediction.",
      "Ignoring a negative sign on the slope.",
      "Giving the slope as the prediction at $x=0$ instead of the intercept.",
    ],
    parentGuide:
      "Use a real pair of quantities, such as hours of practice and shots made, and ask what one more hour is predicted to change.",
    assessed:
      "Selecting the two or three true statements of five about a stated line of best fit with a positive or negative slope, using one-decimal coefficients and whole-number inputs from $2$ to $8$: predictions, the meaning of the slope and intercept, and comparisons of two predictions.",
    notAssessed:
      "Does not assess computing the line from data or with technology, the correlation coefficient, residuals, or extrapolation limits.",
    facet: "regression-interpretation.slope-intercept",
  },
  {
    id: "function-pair-select",
    skillId: "function-notation",
    title: "Adding points that keep a graph a function",
    summary:
      "Choose the ordered pairs that can be added to a graph while it stays a function.",
    goal: "Select the ordered pairs that can be added to a graphed relation so that each input still has exactly one output.",
    intuition:
      "A function gives each input exactly one output. On a graph, each $x$ value has only one point above or below it. A relation with the points $(2,5)$ and $(2,7)$ is not a function, because the input $2$ has two outputs.",
    more: "To add a point and keep a function, use an $x$ value that is not on the graph yet. A new point at an $x$ that already has a point makes a second output for that input.",
    terms: [
      "function",
      [
        "ordered-pair",
        "For a function, the input comes first and the output second.",
      ],
    ],
    steps: [
      "Read the $x$ value of every point on the graph and list them.",
      "For each ordered pair, look at its $x$ value and check whether it is on the list.",
      "A pair with an $x$ that is not on the list can be added; a pair with a listed $x$ and a different $y$ cannot.",
      "Select only the pairs that can be added and check the count.",
    ],
    watch:
      "The $y$ value does not matter for new inputs. Compare only the $x$ values with those already on the graph.",
    principle:
      "A relation is a function exactly when no two of its ordered pairs have the same first coordinate and different second coordinates. A new pair keeps a function when its $x$ is not already used.",
    example: {
      prompt:
        "A graph has the points $(1,3)$, $(2,5)$ and $(4,2)$. Can $(2,6)$ be added to keep a function?",
      steps: [
        "The $x$ values already used are $1$, $2$ and $4$.",
        "$(2,6)$ has $x=2$, which is already used with $y=5$.",
        "Then $2$ would have two outputs, $5$ and $6$.",
      ],
      answer: "No",
    },
    objectives: [
      "Decide whether a set of ordered pairs is a function by checking the inputs.",
      "Read the coordinates of points on a graph.",
    ],
    pitfalls: [
      "Checking the $y$ values instead of the $x$ values.",
      "Thinking the same output for two inputs breaks a function. It does not.",
      "Misreading a point's coordinates on the grid.",
    ],
    parentGuide:
      "Ask your learner to draw a vertical line through any $x$ on a graph. A function never has two points on the same vertical line.",
    assessed:
      "Reading four or five plotted points on a grid from $0$ to $8$ and selecting the two or three ordered pairs, among five, whose $x$ value is not already used.",
    notAssessed:
      "Does not assess functions given as tables, equations or mappings, curves, or domain and range.",
  },
  {
    id: "root-approximation-select",
    skillId: "approximate-roots",
    title: "Reading square roots on a number line",
    summary:
      "Read the position of points on a number line and select true approximations of their values.",
    goal: "Select the true approximations, to the nearest tenth, of points marked on a number line at square roots of whole numbers.",
    intuition:
      "A square root such as $\\sqrt{76}$ is not a whole number, but it sits on the number line between two whole numbers: $8^2=64$ and $9^2=81$, so it is between $8$ and $9$. A number line with ticks every $0.1$ shows how far past $8$ it is.",
    more: "To read a point, find the whole number to its left and count the tenths. If the point is between two tenth marks, it is closer to the nearer one.",
    terms: [
      "square-root",
      [
        "round",
        "To the nearest tenth means to the closest number with one decimal place.",
      ],
    ],
    steps: [
      "Find the whole number at the left end of the line; each small space is $0.1$.",
      "For each point, count the spaces from the left end and add that many tenths.",
      "If the point is not exactly on a mark, decide which mark it is nearer to.",
      "Select the statements that match the points you read and check the count.",
    ],
    watch:
      "Count spaces, not marks: the point on the first mark after $8$ is at $8.1$, not $8.0$.",
    principle:
      "If $m^2<n<(m+1)^2$ then $m<\\sqrt{n}<m+1$. A value is approximated to the nearest tenth by the tenth mark closest to it on the number line.",
    example: {
      prompt:
        "On a line from $7$ to $8$ with ticks every $0.1$, a point is $4$ spaces right of $7$. What is it, to the nearest tenth?",
      steps: [
        "Each space is $0.1$.",
        "$4$ spaces is $0.4$.",
        "The point is at $7.4$.",
      ],
      answer: "$7.4$",
    },
    objectives: [
      "Read a point on a number line to the nearest tenth.",
      "Tell where a square root of a whole number lies between two whole numbers.",
    ],
    pitfalls: [
      "Counting the first mark as $0.0$ instead of the left end.",
      "Reading a point that is closer to one tenth as the next tenth.",
      "Using the radicand, such as $76$, as the value.",
    ],
    parentGuide:
      "Use a ruler marked in tenths and ask your learner to read the position of a pencil tip.",
    assessed:
      "Reading four points, each within $0.02$ of a tenth mark, on a number line from $7$ to $8$ or from $8$ to $9$ with ticks every $0.1$, and selecting the two or three true approximations among five.",
    notAssessed:
      "Does not assess finding a root by entry, roots less than $7$, cube roots or hundredths.",
    facet: "approximate-roots.nearest-tenth",
  },
  {
    id: "dot-plot-statement-select",
    skillId: "mean-median",
    title: "What a dot plot supports",
    summary:
      "Read counts from a dot plot and decide which statements about the data are true.",
    goal: "Select the statements about a dot plot of thirty values that the counts support.",
    intuition:
      "A dot plot shows each value as a dot above a number line. A taller stack means the value happened more often. The stacks add up to the number of values, here $30$.",
    more: "Statements about the data can be tested with the counts: how many dots are at one value, how many are at or above a value, which stack is tallest, and whether a group holds more than half of the dots.",
    terms: [
      "dot-plot",
      [
        "mode-statistics",
        "On a dot plot, it is the value with the tallest stack.",
      ],
    ],
    steps: [
      "Count the dots above each value and write the counts; check that they add to the number of values.",
      "For a statement about a group, add the counts of the values in the group.",
      "For 'more than half', compare the group's count with half of the total.",
      "Select only the supported statements and check the count.",
    ],
    watch:
      "Count dots, not values: a value with a stack of $5$ stands for $5$ turns.",
    principle:
      "The number of values in a data set is the sum of the counts at each value. A statement about a group of values is true when the sum of the counts for those values makes it true.",
    example: {
      prompt:
        "A dot plot of $30$ turns has $4$ dots at $1$, $6$ at $2$, $9$ at $3$, $7$ at $4$ and $4$ at $5$. Did more than half of the turns score $3$ or less?",
      steps: [
        "Add the dots at $1$, $2$ and $3$: $4+6+9=19$.",
        "Half of $30$ is $15$.",
        "$19$ is more than $15$.",
      ],
      answer: "Yes",
    },
    objectives: [
      "Read the number of values at each point of a dot plot.",
      "Test statements about counts, shares and the most common value.",
    ],
    pitfalls: [
      "Reading the value under a stack as its count.",
      "Comparing stack heights when the question is about values at or above a point.",
      "Forgetting that the counts must add up to the total number of values.",
    ],
    parentGuide:
      "Toss a number cube thirty times, make a dot plot of the results, and ask what is most common.",
    assessed:
      "Selecting the two or three supported statements of five about a dot plot of exactly $30$ whole-number values with six to eight values and stacks of at most $7$: counts at a value, counts at or above a value, the most common and greatest values, the share of the values, and which of two values is more common.",
    notAssessed:
      "Does not assess computing the mean or median, reading other displays, or data with more than seven dots in a stack.",
  },
];

export const multiselectExpressionContent = buildSelectContent(specs);
