import type { Lesson } from "./lessons.js";
export const algebraLessons: Lesson[] = [
  {
    id: "expressions-keep-the-structure",
    title: "Keep the structure, change the form",
    summary:
      "An expression is a math phrase made of numbers, letters and operations (add, subtract, multiply, divide), like $3x + 2$. It has a value but no equals sign. This lesson works with expressions in three ways. Put a number in for the letter to find the value. Multiply a number by each part inside parentheses, the curved brackets ( ). Combine matching parts. The last two change how an expression looks, never its value.",
    templateIds: [
      "substitute-linear-expression",
      "distributive-expression-choice",
      "combine-like-coefficient",
    ],
    senses: { term: "term-expression" },
    noLink: ["change", "part", "parts", "rule", "side", "changes"],
    objectives: [
      "Put a number in place of a letter, keeping its sign, and find the expression's value.",
      "Multiply a number by every part inside parentheses.",
      "Tell a coefficient (the number multiplying a letter) apart from a constant (a number with no letter).",
    ],
    sections: [
      {
        stage: "intuition",
        title: "A place for the whole value",
        paragraphs: [
          "A variable is a letter, such as $x$, that stands for a number. Writing $3x$ means 3 times $x$. An expression is a math phrase made of numbers, variables and operations (adding, subtracting, multiplying, dividing), such as $3x + 2$. It names a value. An equation is different: it uses an equals sign to say that two values are the same.",
          "To substitute means to replace the letter with a number. Then finding the value is called evaluating the expression. In $3x + 2$, the $x$ is a place for one complete number, which may be a fraction or a negative. When $x = 4$, write $3 \\times 4 + 2 = 12 + 2 = 14$.",
          "Parentheses, the curved brackets ( ), group what is inside so it is treated as one number. When $x = -\\tfrac{1}{2}$, write $3 \\times (-\\tfrac{1}{2}) + 2$. The parentheses keep the minus sign with its number. Multiply first, because multiplication comes before addition. A positive times a negative is negative: $3 \\times (-\\tfrac{1}{2}) = -\\tfrac{3}{2}$. Then add 2, which is $\\tfrac{4}{2}$: $-\\tfrac{3}{2} + \\tfrac{4}{2} = \\tfrac{1}{2}$.",
        ],
      },
      {
        title: "Multiply every part inside",
        paragraphs: [
          "A number written right before parentheses multiplies everything inside them. Imagine 3 bags. Each bag holds $x$ counters plus 2 extra counters. All together that is $3(x + 2)$. Count the parts: 3 groups of $x$ and 3 groups of 2. So $3(x + 2) = 3x + 6$.",
          "Multiplying the outside number by each part inside is called distributing. The parts of an expression joined by + or − are called terms. In $3x + 6$, the terms are $3x$ and 6. Every term inside the parentheses gets multiplied, not just the first one.",
          "Negative numbers follow the same rule. Think of $x - 3$ as $x + (-3)$. Then $-2(x - 3) = (-2) \\times x + (-2) \\times (-3) = -2x + 6$. The 6 is positive because a negative number times a negative number is positive.",
        ],
      },
      {
        title: "Collect the same kind of quantity",
        paragraphs: [
          "Terms with the same letter part are called like terms, such as $4x$ and $-7x$. A term with no letter, such as 5, is called a constant, because its value never changes. The number multiplying the letter is called the coefficient. In $4x$, the coefficient is 4.",
          "Like terms combine by adding their coefficients. Think of $x$ as one kind of item. Adding 4 of them and then subtracting 7 of them is the same as subtracting 3 of them in all, because $4 - 7 = -3$. So $4x - 7x + 5 = -3x + 5$. The 5 stays separate, because it is not a number of $x$'s.",
          "In $4x - 4x + 5$, the $x$ terms cancel, meaning they add to zero: $4 - 4 = 0$, so no $x$'s are left. The expression equals 5 for every value of $x$.",
        ],
      },
    ],
    workedExample: {
      prompt: "Evaluate −2(x − 3) at x = −1/2.",
      steps: [
        "A number written right before parentheses multiplies everything inside them. Substitute: put $-\\tfrac{1}{2}$ in place of $x$, inside parentheses so its sign stays with it. This gives $-2(-\\tfrac{1}{2} - 3)$.",
        "Work inside the parentheses first. To subtract 3 from a number of halves, write 3 as halves: $3 = \\tfrac{6}{2}$. Then $-\\tfrac{1}{2} - \\tfrac{6}{2} = -\\tfrac{7}{2}$.",
        "Multiply: $-2 \\times (-\\tfrac{7}{2})$. A negative times a negative is positive, and $2 \\times \\tfrac{7}{2} = 7$. So the value is 7.",
        "Check another way by distributing first, which means multiplying the outside number by each part inside: $(-2) \\times x = -2x$ and $(-2) \\times (-3) = 6$, so $-2(x - 3) = -2x + 6$. At $x = -\\tfrac{1}{2}$, $-2 \\times (-\\tfrac{1}{2}) = 1$, and $1 + 6 = 7$. Both routes give 7.",
      ],
      answer: "7",
    },
    closingSections: [
      {
        stage: "formal",
        title: "The precise rule",
        paragraphs: [
          "To substitute a number for a variable, replace every copy of that variable with the same number.",
          "Writing letters side by side, as in $ab$, means multiply. The distributive property says $a(b + c) = ab + ac$. The rule holds for all real numbers $a$, $b$ and $c$: every number on the number line (a line with evenly spaced marks for numbers), including fractions and negatives.",
          "Like terms have the same variable part, and they combine by adding their coefficients, the numbers multiplying the variable. Each of these rewrites keeps the expression's value the same for every value of the variable.",
        ],
      },
    ],
    pitfalls: [
      "Multiply the outside number by every term inside. $3(x + 5)$ is $3x + 15$, not $3x + 5$.",
      "When combining parts, never add a constant (a number with no letter) to a coefficient (the number multiplying a letter). In $5x + 2$, the 2 is not a number of $x$'s, so the expression is not $7x$.",
      "One number check cannot prove that two expressions are equal for every value. Two different expressions can still agree at one value of $x$.",
    ],
    parentGuide:
      "Ask for two routes to the same value. First put the number in for $x$ right away. Then multiply into the parentheses first, and put the number in after. Have the learner explain why each route keeps the value the same. If an answer looks wrong, test both expressions with a negative value of $x$.",
  },
  {
    id: "equations-preserve-equality",
    title: "Change both sides, keep the truth",
    summary:
      "An equation says two amounts are equal, like $4 + 3 = 7$. The two amounts are called the sides of the equation. In $2x + 1 = 7$, the letter $x$ stands for an unknown number. To solve it, find the solution, the value of $x$ that makes the sides equal. Do the same step to both sides, one at a time, until $x$ stands alone, but never multiply or divide by 0. Then check the answer in the original equation.",
    templateIds: [
      "grouped-linear-equation",
      "negative-coefficient-equation",
      "rational-coefficient-equation",
      "both-sides-linear-equation",
      "check-equation-candidate",
    ],
    senses: {
      side: "side-of-equation",
      term: "term-expression",
      balance: "balance-scale",
    },
    noLink: ["change", "changes", "rule", "part", "parts", "mean"],
    objectives: [
      "Do the same step to both sides of an equation, choosing steps that can be undone.",
      "Solve equations with negative numbers and fractions.",
      "Check an answer by putting it into the original equation.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Both sides stay equal",
        paragraphs: [
          "An equation is a statement that two amounts are equal, such as $3x + 6 = 15$. The two amounts are called the sides of the equation. Each side is an expression, a math phrase made of numbers, letters and operations (adding, subtracting, multiplying, dividing). The letter $x$ is a variable, a letter that stands for an unknown number. A solution is a value of $x$ that makes the two sides equal.",
          "Think of a balance scale with one side of the equation on each pan. Adding or subtracting the same amount on both pans keeps it level. So does multiplying or dividing both sides by the same number, as long as that number is not 0. Each of these steps can be undone: subtract after adding, or divide after multiplying. So the new equation has exactly the same solutions as the old one.",
          "Never divide by 0, because dividing by 0 has no answer. Multiplying both sides by 0 is not a solving step either. It turns any equation into $0 = 0$, which is true for every $x$.",
          "In $3(x + 2) = 15$, a number written right before parentheses (the curved brackets) multiplies everything inside. So 2 was added to $x$, and then the result was multiplied by 3. Undo the last step first: divide both sides by 3 to get $x + 2 = 5$. Then subtract 2 from both sides: $x = 3$.",
          "Another route starts with a step called distributing: multiplying the 3 by each part inside gives $3x + 6 = 15$. Subtract 6 from both sides to undo the + 6: $3x = 9$. Divide both sides by 3 to undo multiplying by 3: $x = 3$. Both routes give the same solution, because every step kept the two sides equal.",
        ],
      },
      {
        title: "Keep the sign and the fraction",
        paragraphs: [
          "In $-4x + 3 = 9$, $x$ is multiplied by $-4$. The number multiplying $x$, together with its sign (+ or −), is called the coefficient. Here the coefficient is $-4$. Subtract 3 from both sides to undo the + 3: $-4x = 6$. Then divide both sides by $-4$, not by 4, so that $x$ is left alone: $x = \\frac{6}{-4}$. Divide the top and bottom by 2, which keeps the fraction's value: $x = -\\frac{3}{2}$.",
          "In $\\frac{2}{3}x = 5$, the coefficient is the fraction $\\frac{2}{3}$. Multiply both sides by $\\frac{3}{2}$, its reciprocal (the fraction turned upside down). This works because $\\frac{3}{2} \\times \\frac{2}{3} = 1$, and $1x$ is just $x$. So $x = \\frac{3}{2} \\times 5 = \\frac{15}{2}$.",
          "A fraction answer like $\\frac{15}{2}$ is exact: it is the true value, not an estimate. You may also write it as 7.5.",
        ],
      },
      {
        title: "Check in the original equation",
        paragraphs: [
          "Some equations have $x$ on both sides, such as $5x + 1 = 2x + 7$. Subtract $2x$ from both sides so that $x$ appears on one side only: $3x + 1 = 7$. Subtract 1 from both sides to undo the + 1: $3x = 6$. Divide both sides by 3 to undo the multiplication: $x = 2$. This is the only solution.",
          "Check by putting 2 into the original left side and the original right side separately. Left: $5 \\times 2 + 1 = 11$. Right: $2 \\times 2 + 7 = 11$. Both are 11, so 2 is correct. Checking only a later line can miss a mistake made in copying or in an earlier step.",
        ],
      },
    ],
    workedExample: {
      prompt: "Solve $-3(x + 2) = 9$.",
      steps: [
        "The parentheses mean 2 was added to $x$ first, and then the result was multiplied by $-3$. Multiplying came last, so undo it first.",
        "Divide both sides by $-3$: $x + 2 = 9 \\div (-3) = -3$. A positive number (greater than 0) divided by a negative number, a number less than 0, gives a negative answer.",
        "Subtract 2 from both sides to undo the + 2: $x = -3 - 2 = -5$.",
        "Check in the original equation by putting $-5$ in for $x$: $-3(-5 + 2) = -3 \\times (-3) = 9$. The left side equals the right side, 9, so $-5$ is the solution.",
      ],
      answer: "−5",
    },
    closingSections: [
      {
        stage: "formal",
        title: "The precise rule",
        paragraphs: [
          "Adding or subtracting the same number on both sides of an equation keeps exactly the same solutions. So does multiplying or dividing both sides by the same number other than 0. Dividing by 0 is never allowed. A solution is confirmed by putting it into the original equation and getting two equal sides.",
        ],
      },
    ],
    pitfalls: [
      "A term is one part of a side, joined to the rest by + or −, together with its sign. “Moving a term to the other side” is a shortcut for doing the same operation to both sides. Moving the + 3 in $-4x + 3 = 9$ means subtracting 3 from both sides. Write the operation, so a sign mistake shows.",
      "Never divide by 0. Dividing by 0 has no answer.",
      "A proposed answer must make the two original sides equal. A number that only looks reasonable is not enough.",
    ],
    parentGuide:
      "Ask which operation (add, subtract, multiply or divide) was done to each side, and why it can be undone. Include a wrong answer on purpose, and have the learner work out each original side separately to catch it.",
  },
  {
    id: "linear-change-per-unit",
    title: "Different steps, the same rate",
    summary:
      "A rule is a recipe that takes a number and gives back another. The number you put in is called the input, and the number you get back is called the output. In a linear rule, each increase of 1 in the input changes the output by the same amount, called the rate. The starting value is the output when the input is 0.",
    templateIds: [
      "unequal-step-rate",
      "recover-linear-intercept",
      "predict-linear-output",
    ],
    senses: {
      rule: "rule",
      model: "model",
      unit: "unit",
      change: "change",
    },
    noLink: ["mean", "differences", "difference", "side", "more than"],
    objectives: [
      "Find the rate by dividing the change in output by the change in input.",
      "Find the output at input 0, the starting value.",
      "Predict new outputs from a rule you are told is linear.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Count the input steps too",
        paragraphs: [
          "A pair like $(1, 5)$ is an ordered pair: the first number is an input and the second is its output. So $(1, 5)$ means the input 1 gives the output 5. We also say the rule passes through $(1, 5)$, because its graph, the picture of its pairs as points, goes through that point. Suppose a linear rule passes through $(1, 5)$, $(3, 8)$ and $(7, 14)$.",
          "From input 1 to input 3, the input goes up by 2 and the output goes up by $8 - 5 = 3$. From input 3 to input 7, the input goes up by 4 and the output goes up by $14 - 8 = 6$. The output changes, 3 and 6, are different. But the input steps are different too.",
          "To find the change for one input step, share each output change equally among its input steps. That means dividing the output change by the input change: $\\frac{3}{2}$ and $\\frac{6}{4} = \\frac{3}{2}$. Both equal $\\frac{3}{2}$, so the output rises $\\frac{3}{2}$ for each 1 added to the input. This change for each 1 of input is the rate, also called the slope of the rule. Always pair an output change with the input change between the same two pairs, in the same direction.",
        ],
      },
      {
        title: "Separate the start from the change",
        paragraphs: [
          "Let $x$ be the input, $y$ the output, $m$ the rate and $b$ the output at input 0. Then a linear rule can be written $y = mx + b$, where $mx$ means $m$ times $x$. Check the meaning of $b$: when $x = 0$, the output is $m \\times 0 + b = b$. So $b$ is the starting value.",
          "Going from input 0 to input $x$ changes the output by $m$ for each 1 of input, so by $m$ times $x$ in all. For example, with $m = \\frac{3}{2}$, going from input 0 to input 4 adds $\\frac{3}{2} \\times 4 = 6$. So the output is the starting value plus that change: $b + mx$.",
          "To find $b$, start at a known pair and walk back to input 0. Suppose the rate is $\\frac{3}{2}$ and the rule passes through $(3, 8)$. Going from input 3 back to input 0 takes away 3 steps of $\\frac{3}{2}$. So $b = 8 - \\frac{3}{2} \\times 3 = 8 - \\frac{9}{2} = \\frac{7}{2}$. The output 8 at input 3 is not the starting value.",
        ],
      },
      {
        title: "Predict only from a stated rule",
        paragraphs: [
          "A model is a rule chosen to describe a real situation. Two pairs with different inputs fix exactly one straight line through them. But many curved rules also pass through the same two pairs, and they give different predictions elsewhere.",
          "So predict another output only when the problem says the rule is linear, or gives other good evidence. Then extend from a known pair: add the rate times the extra input. A negative rate means the output goes down as the input goes up.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A linear rule passes through $(2, 7)$ and $(6, 1)$. Predict its output at input 8.",
      steps: [
        "Find the rate: divide the change in output by the change in input. From input 2 to input 6, the output goes from 7 to 1. Rate $= \\frac{1 - 7}{6 - 2} = \\frac{-6}{4} = -\\frac{3}{2}$.",
        "The rate is negative, so the output goes down by $\\frac{3}{2}$ for each 1 added to the input.",
        "Input 8 is 2 more than input 6, the nearest known input.",
        "So the output changes by the rate times 2: $-\\frac{3}{2} \\times 2 = -3$.",
        "Start from the known output at input 6, which is 1: $1 + (-3) = -2$.",
      ],
      answer: "−2",
    },
    closingSections: [
      {
        stage: "formal",
        title: "The precise rule",
        paragraphs: [
          "Take a linear rule and two of its pairs with different inputs. Small numbers written below a letter are labels, not numbers to multiply by. So $(x_1, y_1)$, read “$x$ one, $y$ one”, names the first pair, and $(x_2, y_2)$ names the second.",
          "The rate is $m = \\frac{y_2 - y_1}{x_2 - x_1}$. The output at input $x$ is $y = mx + b$, where $b$ is the output at input 0. Two pairs alone do not show that a rule is linear when you were not told so.",
        ],
      },
    ],
    pitfalls: [
      "Different input steps can still give the same rate. Divide each output change by its own input change.",
      "The first output you are given is usually not the output at input 0. Walk back to input 0 using the rate.",
      "Do not predict from two pairs unless you are told the rule is linear. Predicting outside the inputs you were given is called extrapolating, and it needs a stated rule, such as being told the rule is linear.",
    ],
    parentGuide:
      "Use the pairs $(1, 5)$, $(3, 8)$ and $(7, 14)$ from the lesson, where the first number goes in and the second comes out. Point out the steps from 1 to 3 and from 3 to 7. Ask why the output changes are different while the change for each 1 of input is the same. When the numbers come from a real situation, ask for the units, such as dollars per hour.",
  },
  {
    id: "functions-and-graph-meaning",
    title: "What a rule or graph really says",
    summary:
      "An input is a number you put into a rule, and the output is the number it gives back. A function is a rule that gives exactly one output for each input. A rule is called proportional when the output is always the same number times the input. A distance-from-home graph, a picture of distance over time, shows how far away someone is, not the path they took.",
    templateIds: [
      "relation-function-choice",
      "proportional-rule-choice",
      "distance-graph-meaning",
    ],
    noLink: ["rule", "rules", "mean", "side", "part", "parts", "center"],
    objectives: [
      "Recognize when each input has exactly one output.",
      "Tell a proportional rule apart from a rule with a fixed amount added.",
      "Describe distance from home without inventing a route.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "One output for each input",
        paragraphs: [
          "A rule takes a number, called the input, and gives back a number, called the output. A pair like $(1, 4)$ lists an input first and its output second. A relation is any list of such pairs.",
          "A function is a relation that gives each input exactly one output. The pairs $(1, 4)$, $(2, 4)$ and $(3, 4)$ form a function: each input has one output. Different inputs may share the same output, here 4.",
          "Listing $(1, 4)$ twice just repeats the same pair, so it is still fine. But listing both $(1, 4)$ and $(1, 5)$ breaks the rule. The input 1 would have two different outputs, 4 and 5. Then the relation is not a function.",
        ],
      },
      {
        title: "A multiplier and no extra start",
        paragraphs: [
          "A rule is called proportional when the output is always the same number times the input. We write it $y = kx$, where $x$ is the input, $y$ is the output and $k$ is the fixed number. For $y = 3x$, input 1 gives 3, input 2 gives 6 and input 4 gives 12. Doubling the input doubles the output.",
          "At input 0 the output is $k \\times 0 = 0$. So the graph, the picture of all the pairs as points on a grid, passes through the point $(0, 0)$, called the origin. For every input except 0, the output divided by the input is the same number $k$, because $kx \\div x = k$. At input 0, dividing like this is not allowed, since dividing by 0 has no answer.",
          "A fixed added amount other than 0 breaks this. The rule $y = 3x + 2$ has a straight-line graph, but at input 0 its output is 2, not 0. So it is not proportional. The fixed number $k$ may be negative, as in $y = -2x$, when the inputs can be any number. A real situation may allow only some inputs, such as numbers of people.",
        ],
      },
      {
        title: "Read what the graph measures",
        paragraphs: [
          "On a distance-from-home graph, the input is time, shown along the bottom. The output, shown going up, is how far the person is from home. It is not the total distance traveled.",
          "A line that rises means moving farther from home. A line that falls means getting closer to home.",
          "A flat stretch means staying the same distance from home. The person could be standing still. They could also be walking around a circle with home at its center. The graph alone cannot tell these routes apart.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "Does the relation $(-1, 3)$, $(-1, 3)$, $(2, 3)$ represent a function?",
      steps: [
        "Look at each input and its outputs. Input $-1$ appears twice, both times with output 3. The repeated pair gives no second, different output.",
        "Input 2 has just one output, 3.",
        "Inputs $-1$ and 2 share the output 3. Different inputs may share an output.",
        "Every input has exactly one output, so the relation is a function.",
      ],
      answer: "Yes",
    },
    closingSections: [
      {
        stage: "formal",
        title: "The precise rule",
        paragraphs: [
          "A relation is a function exactly when each input has one output. Different inputs may share an output.",
          "A proportional rule has the form $y = kx$ for the inputs allowed. So its graph includes the origin, $(0, 0)$, when 0 is an allowed input.",
          "A distance-from-home graph shows the distance from one place over time. It does not show the route or the total distance traveled.",
        ],
      },
    ],
    pitfalls: [
      "A repeated output does not stop a relation from being a function. Only one input with two different outputs does.",
      "A straight-line graph is not always proportional. When 0 is an allowed input, a proportional graph must also pass through $(0, 0)$.",
      "Staying the same distance from one place does not have to mean standing still.",
    ],
    parentGuide:
      "Ask the learner to invent two routes that give the same flat distance-from-home graph. Then ask for a list of input–output pairs where two inputs share an output, which is still a function. Ask for one where one input has two outputs, which is not.",
  },
  {
    id: "repair-a-plotted-function",
    title: "Repair a relation on a graph",
    summary:
      "An input is a number you put into a rule, and its output is the number that comes out. A function is a rule that gives each input exactly one output. On a grid, two points straight above each other have the same input but different outputs. Find each single point you could remove to leave one output for each input.",
    templateIds: ["relation-point-removal"],
    includeGeneratedRepresentation: false,
    senses: { unit: "unit" },
    noLink: ["leaves", "rule", "whole", "side", "center"],
    objectives: [
      "Read the input and output of a labeled point on a coordinate grid.",
      "Find every single point whose removal makes a relation a function.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "One output for each input",
        paragraphs: [
          "A relation is a list of input–output pairs: each pair is an input and the output that goes with it. A coordinate grid (a pair of number lines that cross) shows each pair as a point. For example, the point $(2, 3)$ sits 2 units right of the center point $(0, 0)$ and 3 units up. A negative first number means go left, and a negative second number means go down. In general, the point $(x, y)$ sits $x$ units across and $y$ units up. A letter before a pair names the point: $A(-3, 2)$ is the point called $A$ at $(-3, 2)$. Its $x$-coordinate, the across number, is the input. Its $y$-coordinate, the up number, is the output.",
          "A function is a relation that gives each input exactly one output. Different inputs may share an output.",
          "Two different points on the same up-and-down grid line have the same input and different outputs. Then the relation is not a function. Removing a point fixes it only when no input is left with two different outputs.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "The plotted points are $A(-3,2)$, $B(1,-2)$, $C(1,3)$ and $D(4,0)$. Which single points could be removed to make the remaining relation a function?",
      steps: [
        "List the inputs, the $x$-coordinates, to find any input that appears twice: $A$ has $-3$, $B$ has 1, $C$ has 1 and $D$ has 4.",
        "$B$ and $C$ both have input 1, but their outputs are $-2$ and 3. That is the only input with two outputs.",
        "Removing $B$ leaves $C$ as the only point with input 1. Removing $C$ leaves $B$ as the only point with input 1. Either way, every input then has one output.",
        "Removing $A$ or $D$ leaves both $B$ and $C$, so input 1 still has two outputs.",
      ],
      answer: "$B$ or $C$",
    },
    closingSections: [
      {
        stage: "method",
        title: "See the conflict on the grid",
        paragraphs: [
          "The figure plots the four points from the example. Follow the up-and-down grid line at $x = 1$: it passes through both $B$ and $C$. Removing either point leaves one output at that input. The other two inputs already have one output each.",
        ],
        keepTogetherInPrint: true,
        illustration: "assessment-function-repair",
      },
      {
        stage: "formal",
        title: "The exact condition",
        paragraphs: [
          "A relation with a list of pairs that ends is a function exactly when every input in it has one output.",
          "Suppose the only problem is two points with the same input and different outputs. Then removing either one of them fixes the relation.",
          "If several inputs have two outputs, or three points with different outputs share one input, removing one point cannot fix it. Check the whole remaining graph after each removal.",
        ],
      },
    ],
    pitfalls: [
      "When exactly two points share an input, check removing each of them. Either one may work.",
      "Check the rest of the graph too. If another input also has two outputs, one removal cannot fix it.",
      "Sharing an output is allowed. Only one input with different outputs is a problem.",
    ],
    parentGuide:
      "Plot two points with the same input and different outputs, plus two points at other inputs. Ask which single points could be removed, and check each remaining graph together.",
  },
  {
    id: "plans-ties-and-thresholds",
    title: "A tie is not a better deal",
    summary:
      "Each plan costs a fixed fee, paid once, plus a rate, an amount for each unit used. Where both plans cost the same is a tie, not a saving. Past the tie, the plan with the smaller rate is cheaper. If only whole numbers, the numbers 0, 1, 2 and so on, are allowed, it is first cheaper at the first allowed whole number past the tie.",
    templateIds: ["shared-plan-input", "first-cheaper-whole-input"],
    senses: { unit: "unit", difference: "difference-subtract" },
    noLink: [
      "whole",
      "rule",
      "rules",
      "range",
      "intersection",
      "side",
      "sides",
    ],
    objectives: [
      "Find the exact input where two cost rules give the same cost.",
      "Find the first whole number of units where one plan is strictly cheaper.",
      "Check an answer against the inputs the problem allows.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "A fixed fee against a smaller rate",
        paragraphs: [
          "Two plans charge for units of data used. Plan A charges a fixed fee of 10 dollars, paid once, plus 2 dollars per unit. Plan B has no fee and charges 4 dollars per unit. For 3 units, Plan A costs $10 + 2 \\times 3 = 16$ dollars and Plan B costs $4 \\times 3 = 12$ dollars. For $x$ units, Plan A costs $10 + 2x$ dollars, where $2x$ means 2 times $x$. Plan B costs $4x$ dollars.",
          "So Plan A starts 10 dollars higher but saves 2 dollars on every unit. The 10-dollar fee is made up after $10 \\div 2 = 5$ units. At 5 units, Plan A costs $10 + 2 \\times 5 = 20$ dollars, and Plan B costs $4 \\times 5 = 20$ dollars. The costs are equal, so 5 is the tie point. Below 5 units Plan B is cheaper, and above 5 Plan A is cheaper, so the plans cross there. At a tie, neither plan is cheaper.",
          "The number of units is called the input. If any input is allowed, including fractions, the tie at 5 is exact. Now suppose inputs must be whole numbers, and Plan A must be strictly cheaper (less, not equal). Then the first answer is 6, the first whole number past 5. At 6 units, Plan A costs 22 dollars and Plan B costs 24 dollars.",
        ],
      },
      {
        title: "Whole numbers change the answer",
        paragraphs: [
          "If any input is allowed, the tie point is the exact crossing. If inputs must be whole numbers, the plan with the smaller rate is first cheaper at the first allowed whole number strictly greater than the tie. If no allowed whole number is past the tie, that plan is never cheaper.",
          "When the tie is not a whole number, such as $\\frac{5}{2}$, the first whole number past it is 3. When the tie is a whole number, such as 5, the plans cost the same there. So the first strictly cheaper whole input is 6, not 5. So for the plan with the smaller rate, take the first allowed whole number strictly greater than the tie.",
        ],
      },
      {
        title: "Check the whole numbers on each side",
        paragraphs: [
          "Work out both costs at your chosen whole input, and at the whole input just before it. At the chosen input the plan must be cheaper. If there is an allowed input before it, the plan must not be cheaper there.",
          "Also check which inputs are allowed. A tie above 24, when only 0 through 24 are allowed, cannot be used by a buyer.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A costs $7 + 2x$ dollars; B costs $5x$ dollars. For whole inputs 0 through 24, when is A first strictly cheaper?",
      steps: [
        "Here $x$ is the number of units, the input. Find the tie by setting the costs equal: $7 + 2x = 5x$. Subtract $2x$ from both sides, so $x$ is on one side only: $7 = 3x$. Divide both sides by 3 to get $x$ alone: $x = \\frac{7}{3}$, which is $2\\frac{1}{3}$. Doing the same to both sides keeps them equal.",
        "A adds less per unit than B, so A is cheaper after the tie. The first whole number greater than $\\frac{7}{3}$ is 3.",
        "Check 3: A costs $7 + 2 \\times 3 = 13$ dollars and B costs $5 \\times 3 = 15$ dollars. A is cheaper.",
        "Check 2, the whole number before it: A costs $7 + 2 \\times 2 = 11$ dollars and B costs $5 \\times 2 = 10$ dollars. A is not cheaper yet, so 3 is the first.",
      ],
      answer: "3",
    },
    closingSections: [
      {
        stage: "formal",
        title: "The precise rule",
        paragraphs: [
          "Write $A(x)$, read “$A$ of $x$”, for the cost of plan A at input $x$, the number of units. Write $B(x)$ for plan B. Compare them at the same input. A tie means $A(x) = B(x)$. “A is strictly cheaper” means $A(x) < B(x)$, where $<$ means “is less than”.",
          "If inputs must be whole numbers, choose the smallest allowed whole number that makes $A(x) < B(x)$ true. If there is an allowed whole number before it, check that it does not.",
        ],
      },
    ],
    pitfalls: [
      "A tie is not strictly cheaper. At the tie, both plans cost the same.",
      "Compare the difference in fixed fees with the difference in rates, the larger rate minus the smaller one. Do not compare a fee with one rate alone. A 10-dollar fee against no fee, with rates of 4 and 2 dollars per unit, ties at $10 \\div 2 = 5$ units.",
      "With whole numbers only, the answer is a whole number past the exact tie, not the tie itself.",
    ],
    parentGuide:
      "Compare one example with a whole-number tie and one with a fraction tie. Ask for the costs at the whole numbers just before and just after the proposed first better deal.",
  },
];
