import type { FacetMapping } from "./coverage";
import { formatLessons, type FormatLessonEntry } from "./format-lesson-entry";

const entries: FormatLessonEntry[] = [
  {
    id: "fixed-variable-expense-table",
    title: "Fixed and variable expenses",
    summary:
      "A fixed expense is the same every month; a variable expense changes with use or choices.",
    objectives: [
      "Tell a fixed expense, which stays the same each month, from a variable expense, which changes.",
      "Use several months of amounts to decide.",
    ],
    intuition:
      "An expense is money spent regularly. A fixed expense is the same amount every month, such as rent or a phone plan agreed in advance. A variable expense changes from month to month because it depends on how much you use or buy, such as groceries or electricity. To decide from records, compare the amounts: if they are all alike the expense is fixed, and if they differ it varies.",
    terms: [
      ["fixed expense", "An expense that is the same amount each month."],
      ["variable expense", "An expense that changes from month to month."],
    ],
    method: [
      "Look at the amounts for each expense across the months.",
      "If every month shows the same amount, the expense is fixed. If any month differs, it varies.",
      "With no amounts, ask whether the bill is set in advance (fixed) or depends on use (variable).",
    ],
    watch:
      "Compare all the months. Two equal months do not prove an expense is fixed if a third differs.",
    principle:
      "An expense with monthly amounts $a_1,a_2,a_3$ is fixed when $a_1=a_2=a_3$ and variable otherwise. An agreed price makes a fixed expense, while a price per use makes a variable one.",
    example: {
      prompt:
        "Rent was 700, 700, 700 and groceries were 210, 185, 240 dollars in three months. Which varies?",
      steps: [
        "Rent: 700, 700, 700 are all the same, so rent stays the same.",
        "Groceries: 210, 185, 240 are different, so groceries vary.",
      ],
      answer: "Groceries vary; rent stays the same.",
    },
    methodTitle: "Same every month, or not",
    methodText: [
      "Write the amounts in a row and check whether they are all equal.",
      "A budget can plan for a fixed expense exactly, but must estimate a variable one.",
    ],
    formal:
      "Treating each expense as a sequence of monthly amounts, a fixed expense is a constant sequence and a variable expense is a nonconstant one.",
    pitfalls: [
      "Do not call an expense fixed because it is large; size does not decide.",
      "Do not call an expense variable because it was paid late; only the amount matters.",
    ],
    parentGuide:
      "Look at the family's recent bills together and sort them into those that are always the same and those that change.",
  },
  {
    id: "pythagorean-sort-table",
    title: "Is it a right triangle?",
    summary:
      "A triangle is a right triangle when the squares of the two shorter sides add up to the square of the longest side.",
    objectives: [
      "Test three side lengths with $a^2+b^2=c^2$.",
      "Tell right triangles from near misses.",
    ],
    intuition:
      "In a right triangle the side opposite the right angle is the longest side, the hypotenuse, and its square equals the sum of the squares of the other two sides. This also works backward: if the squares of the two shorter sides add to the square of the longest side, the triangle has a right angle. A set like 3, 4, 5 works, and a set like 3, 4, 6 does not, because $9+16=25$ is not 36.",
    terms: [
      [
        "hypotenuse",
        "The longest side of a right triangle, opposite the right angle.",
      ],
      [
        "Pythagorean triple",
        "Three whole numbers $a$, $b$, $c$ with $a^2+b^2=c^2$.",
      ],
    ],
    method: [
      "Find the longest side and call it $c$.",
      "Compute $a^2+b^2$ for the other two sides, and $c^2$.",
      "If they are equal the triangle is a right triangle; if not, it is not.",
    ],
    watch:
      "Square the longest side only on the right of the equation. Adding the sides, or squaring a short side as $c$, gives the wrong test.",
    principle:
      "The converse of the Pythagorean theorem: if a triangle has sides $a\\le b<c$ with $a^2+b^2=c^2$, then it is a right triangle with the right angle opposite $c$. If $a^2+b^2\\ne c^2$ it is not a right triangle.",
    example: {
      prompt:
        "Is a triangle with sides 9, 12 and 15 a right triangle? What about 9, 12 and 16?",
      steps: [
        "$9^2+12^2=81+144=225$ and $15^2=225$, which are equal.",
        "$9^2+12^2=225$ and $16^2=256$, which are not equal.",
        "The first is a right triangle; the second is not.",
      ],
      answer: "9, 12, 15 is a right triangle; 9, 12, 16 is not.",
    },
    methodTitle: "Two squares against one",
    methodText: [
      "A scaled triple works too: 6, 8, 10 is twice 3, 4, 5.",
      "A set that misses by one, such as 5, 12, 14, is not a right triangle.",
    ],
    formal:
      "By the law of cosines, $c^2=a^2+b^2-2ab\\cos C$, so $c^2=a^2+b^2$ exactly when $\\cos C=0$, that is, when angle $C$ is a right angle.",
    pitfalls: [
      "Do not use the sum of the sides: $9+12=21$ tells nothing here.",
      "Do not decide by looking at nearly equal numbers; compute both squares.",
    ],
    parentGuide:
      "Check a few sets on a calculator together and see that the two numbers match exactly only for right triangles.",
  },
  {
    id: "congruence-claims-table",
    title: "Which transformations keep a figure congruent",
    summary:
      "Translations, reflections and rotations keep distances and angles; dilations, stretches and shears change them.",
    objectives: [
      "Tell rigid motions from other transformations by what happens to distance.",
      "Test a coordinate rule on two points.",
    ],
    intuition:
      "Two figures are congruent when one can be moved onto the other without changing its size or shape. A translation slides, a reflection flips and a rotation turns a figure, and none of them changes distances or angles. A dilation changes size, a stretch pulls a figure in one direction and a shear slants it: all change some distance, so the image is not congruent. To test a rule, apply it to two points and compare the distance between them before and after.",
    terms: [
      ["congruent", "Having the same size and shape."],
      [
        "rigid motion",
        "A translation, reflection or rotation: a transformation that keeps all distances.",
      ],
    ],
    method: [
      "Choose two points, such as $(0,0)$ and $(1,0)$, and find their images under the rule.",
      "Compare the distance between the images with the distance between the points.",
      "If the distance is always unchanged, the rule preserves congruence; if a pair changes distance, it does not.",
    ],
    watch:
      "Check a stretch or a dilation with a pair of points; a rule that changes the numbers by a factor changes distances.",
    principle:
      "A transformation preserves congruence exactly when it preserves distance: $|T(P)T(Q)|=|PQ|$ for all points $P$ and $Q$. Translations, reflections and rotations do, and so do their compositions.",
    example: {
      prompt:
        "Does $(x,y)\\to(x,2y)$ preserve congruence? Does $(x,y)\\to(-y,x)$?",
      steps: [
        "For $(0,0)$ and $(0,1)$ the first rule gives $(0,0)$ and $(0,2)$: the distance 1 becomes 2.",
        "For $(0,0)$ and $(0,1)$ the second rule gives $(0,0)$ and $(-1,0)$: the distance stays 1, and it works for other pairs too.",
        "The first does not preserve congruence; the second is a rotation and does.",
      ],
      answer: "$(x,2y)$ does not; $(-y,x)$ does.",
    },
    methodTitle: "Test the distance",
    methodText: [
      "Name the transformation when you can: reflections change a sign or swap the coordinates, rotations also swap or flip signs.",
      "A rule that multiplies a coordinate by a number other than 1 or $-1$ changes distances.",
    ],
    formal:
      "A map of the form $(x,y)\\mapsto(ax+by+e,cx+dy+f)$ preserves distance exactly when the matrix $\\begin{pmatrix}a&b\\\\c&d\\end{pmatrix}$ is orthogonal, that is, when its columns are perpendicular unit vectors.",
    pitfalls: [
      "Do not accept a rule because it looks symmetric: $(2x,2y)$ is symmetric but not rigid.",
      "Do not test one point only; congruence is about the distance between two points.",
    ],
    parentGuide:
      "Cut out a small shape, move it in each way, and see which moves leave it fitting on the original.",
  },
  {
    id: "equivalent-expressions-table",
    title: "Equivalent expressions",
    summary:
      "Expressions are equivalent when they have the same value for every value of the variable.",
    objectives: [
      "Use the identity and associative properties to rewrite an expression.",
      "Tell an equivalent expression from a different one by trying a value.",
    ],
    intuition:
      "Two expressions are equivalent when they give the same value whatever the variable is. Multiplying by 1 and adding 0 do not change a value, so $x\\cdot1$, $1\\cdot x$ and $x$ are equivalent. Regrouping a product or a sum with parentheses does not change it either, so $(2x)\\cdot3$ equals $6x$. An expression such as $x+1$ is different, because for some values it gives another result than $x$. Trying a value like 3 shows a difference quickly.",
    terms: [
      [
        "equivalent expressions",
        "Expressions with the same value for every value of the variable.",
      ],
      [
        "identity property",
        "Multiplying by 1 or adding 0 leaves a number unchanged.",
      ],
      [
        "associative property",
        "Regrouping a sum or a product does not change its value.",
      ],
    ],
    method: [
      "Simplify the given expression with the properties.",
      "Simplify each choice the same way, or test one value such as 3 in the given expression and in the choice.",
      "Mark the choice equivalent only if it gives the same result as the given expression.",
    ],
    watch:
      "One value that matches does not prove equivalence, but one value that differs proves it. Test a value that is not 0 or 1.",
    principle:
      "For all real $x$: $x\\cdot1=1\\cdot x=x$, $x+0=x$, $(a\\cdot b)\\cdot c=a\\cdot(b\\cdot c)$ and $(a+b)+c=a+(b+c)$. Expressions are equivalent when they agree for every $x$.",
    example: {
      prompt: "Is $(2x)\\cdot3$ equivalent to $6x$? To $2x+3$?",
      steps: [
        "Regroup: $(2x)\\cdot3=2\\cdot(x\\cdot3)=6x$, so the first is equivalent.",
        "Try $x=3$: $(2\\cdot3)\\cdot3=18$ and $2\\cdot3+3=9$, which differ.",
        "So $2x+3$ is not equivalent.",
      ],
      answer: "$6x$ is equivalent; $2x+3$ is not.",
    },
    methodTitle: "Rewrite, or test a value",
    methodText: [
      "Pick a value that tells expressions apart: 0 and 1 can match by chance.",
      "Equivalent expressions can look different, like $x\\cdot1$ and $x$.",
    ],
    formal:
      "Two expressions define the same function of $x$ exactly when they are equivalent. The identity and associative laws are axioms of the real numbers, from which equivalences are derived.",
    pitfalls: [
      "Do not call $x+1$ equivalent to $x\\cdot1$ because both contain 1.",
      "Do not decide by how similar the expressions look; compare their values.",
    ],
    parentGuide:
      "Choose a number together, say 3, and have your learner compute both expressions.",
  },
  {
    id: "gross-net-sentence",
    title: "Gross pay and take-home pay",
    summary:
      "Gross pay is earnings before anything is taken out; take-home pay is gross pay minus taxes and deductions.",
    objectives: [
      "Describe gross pay and take-home pay in words.",
      "Find take-home pay from gross pay, taxes and deductions.",
    ],
    intuition:
      "Gross pay is all the money a worker earns, before anything is taken out. Taxes and other deductions, such as insurance, are taken out of it. What is left, the take-home pay, is the money the worker actually receives. So take-home pay is gross pay minus taxes and deductions, and it is always less than gross pay when something is taken out.",
    terms: [
      ["gross pay", "Earnings before taxes and deductions."],
      ["deduction", "An amount taken out of pay, such as for insurance."],
      [
        "take-home pay",
        "Gross pay minus taxes and deductions: the money received.",
      ],
    ],
    method: [
      "Add taxes and deductions to find everything taken out.",
      "Subtract that total from gross pay.",
      "The result is take-home pay, which is less than gross pay.",
    ],
    watch:
      "Add all the amounts taken out before subtracting, and subtract from gross pay, not from another amount.",
    principle:
      "Take-home pay $=$ gross pay $-$ (taxes $+$ deductions). Gross pay $=$ take-home pay $+$ taxes $+$ deductions.",
    example: {
      prompt:
        "Gross pay is 500 dollars, taxes are 80 dollars and deductions are 20 dollars. Find take-home pay.",
      steps: [
        "Taken out in all: $80+20=100$ dollars.",
        "Take-home pay: $500-100=400$ dollars.",
      ],
      answer: "400 dollars.",
    },
    methodTitle: "Everything taken out, then subtract",
    methodText: [
      "Check by adding back: $400+100=500$.",
      "In words: gross pay is counted before deductions, and take-home pay after.",
    ],
    formal:
      "If $G$ is gross pay and $T_1,\\dots,T_n$ the amounts withheld, net pay is $N=G-\\sum T_i$, so $G=N+\\sum T_i$.",
    pitfalls: [
      "Do not add the taxes to gross pay.",
      "Do not forget one of the deductions.",
    ],
    parentGuide:
      "Look at a sample pay stub and find the gross pay, what was taken out, and the net pay.",
  },
  {
    id: "coordinate-terms-slots",
    title: "Names for the parts of a coordinate plane",
    summary:
      "The axes are the two number lines, the origin is where they cross, and an ordered pair names a point by its two coordinates.",
    objectives: [
      "Name the $x$-axis, the $y$-axis and the origin.",
      "Tell the $x$-coordinate and the $y$-coordinate of an ordered pair.",
    ],
    intuition:
      "A coordinate plane has two number lines that cross at right angles. The horizontal one is the $x$-axis and the vertical one is the $y$-axis. They cross at the origin, the point $(0,0)$. A point is named by an ordered pair of numbers in a set order: the first number, the $x$-coordinate, tells how far to move along the $x$-axis, and the second, the $y$-coordinate, how far to move up.",
    terms: [
      [
        "axis",
        "A number line of the plane: the $x$-axis is horizontal and the $y$-axis is vertical.",
      ],
      ["origin", "The point $(0,0)$ where the axes cross."],
      ["ordered pair", "Two numbers in order that name a point: $(x,y)$."],
    ],
    method: [
      "Decide whether the description is about a line, a point, or one of the numbers of a pair.",
      "For a line, decide whether it runs across (the $x$-axis) or up (the $y$-axis).",
      "For a number of a pair, the first is the $x$-coordinate and the second is the $y$-coordinate.",
    ],
    watch:
      "Do not mix up the $x$-coordinate, a number, with the $x$-axis, a line.",
    principle:
      "The coordinate plane assigns to each point a unique ordered pair $(x,y)$: $x$ is its signed distance along the horizontal axis from the origin and $y$ its distance along the vertical axis.",
    example: {
      prompt:
        "Name: the vertical number line; the first number of the pair $(3,5)$; the point $(0,0)$.",
      steps: [
        "The vertical number line is the $y$-axis.",
        "The first number of the pair $(3,5)$ is 3, the $x$-coordinate.",
        "The point $(0,0)$ is the origin.",
      ],
      answer: "$y$-axis, $x$-coordinate, origin.",
    },
    methodTitle: "Line, point or number",
    methodText: [
      "Say the order of a pair as 'across, then up'.",
      "Both coordinates of the origin are 0.",
    ],
    formal:
      "The Cartesian plane is $\\mathbb{R}\\times\\mathbb{R}$. Its axes are $\\{(x,0)\\}$ and $\\{(0,y)\\}$, the origin is $(0,0)$, and $x$ and $y$ are the coordinate functions.",
    pitfalls: [
      "Do not read the pair as 'up, then across'.",
      "Do not call the origin an axis; it is a point.",
    ],
    parentGuide:
      "Draw the plane on paper and label the axes, the origin and one point together.",
  },
  {
    id: "point-on-axis-sentence",
    title: "A point on an axis",
    summary:
      "A point with a coordinate of 0 lies on an axis; the other coordinate tells how far to move from the origin.",
    objectives: [
      "Tell which axis a point lies on from its coordinates.",
      "Say how far and in which direction to move from the origin.",
    ],
    intuition:
      "In an ordered pair the first number says how far to move right and the second how far to move up. If the second number is 0, you do not move up at all, so the point is on the $x$-axis: $(5,0)$ is 5 units right of the origin. If the first number is 0, you do not move right, so the point is on the $y$-axis: $(0,3)$ is 3 units up.",
    terms: [
      ["coordinate", "One of the two numbers of an ordered pair."],
      ["origin", "The point $(0,0)$, where you start."],
    ],
    method: [
      "Find which coordinate is 0.",
      "If the second is 0 the point is on the $x$-axis; if the first is 0 it is on the $y$-axis.",
      "Move from the origin the number of units of the other coordinate: right for the first, up for the second.",
    ],
    watch:
      "The axis is named by the coordinate that is not zero: a point with $y=0$ is on the $x$-axis.",
    principle:
      "The point $(a,0)$ lies on the $x$-axis at distance $|a|$ from the origin, and $(0,b)$ lies on the $y$-axis at distance $|b|$ from the origin.",
    example: {
      prompt: "Describe the point $(0,4)$.",
      steps: [
        "The first coordinate is 0, so you do not move right: the point is on the $y$-axis.",
        "The second coordinate is 4, so move 4 units up from the origin.",
      ],
      answer: "It is on the $y$-axis, 4 units up from the origin.",
    },
    methodTitle: "Which number is zero",
    methodText: [
      "Check by plotting: start at the origin and make the moves.",
      "Right for the first number, up for the second.",
    ],
    formal:
      "The $x$-axis is the set $\\{(x,0)\\}$ where $y=0$, and the $y$-axis is $\\{(0,y)\\}$ where $x=0$.",
    pitfalls: [
      "Do not say the point is on the $x$-axis because its $x$-coordinate is nonzero without checking the other number.",
      "Do not move up for the first coordinate.",
    ],
    parentGuide:
      "Plot a few points with a 0 together and describe each as 'on the ... axis, ... units from the origin'.",
  },
  {
    id: "times-as-many-blanks",
    title: "Times as many",
    summary:
      "A count is $k$ times as many as another when it is $k$ times that count; likelihood follows the counts.",
    objectives: [
      "Find how many times as many one count is than another by dividing.",
      "Compare likelihoods of choosing from counts, such as more than twice as likely.",
    ],
    intuition:
      "'3 times as many' compares by multiplying: 24 cups and 8 mugs means 24 is 3 times 8, because $24\\div 8=3$. This differs from 'how many more', which subtracts. When one item is chosen at random from a collection, a type with a bigger count is more likely, and 'more than twice as likely' means its count is more than double the other count.",
    terms: [
      [
        "times as many",
        "A comparison by multiplying: $a$ is $k$ times as many as $b$ when $a=kb$.",
      ],
      [
        "more than twice as likely",
        "Its chance is more than double: its count is more than twice the other count.",
      ],
    ],
    method: [
      "Divide the greater count by the lesser count; if the result is a whole number $k$, the greater is $k$ times as many.",
      "For likelihood, double the lesser count and check whether the greater count is more than that.",
      "Complete the sentence with the right items in the right places.",
    ],
    watch:
      "Divide the greater count by the lesser, not the reverse, and do not subtract: 24 is 16 more than 8 but 3 times as many.",
    principle:
      "$a$ is $k$ times as many as $b$ when $a=kb$, so $k=a/b$. When an item is chosen at random from $T$ items, the chance of a type with $a$ items is $a/T$, so its chance is more than twice another's exactly when $a>2b$.",
    example: {
      prompt:
        "A table shows 12 cups, 36 mugs and 7 bottles. Complete: there are __ times as many __ as __.",
      steps: [
        "Try the counts in pairs: $36\\div12=3$ is a whole number, and 7 does not divide 12 or 36.",
        "So there are 3 times as many mugs as cups.",
      ],
      answer: "3 times as many mugs as cups.",
    },
    methodTitle: "Divide to compare",
    methodText: [
      "Check by multiplying: $3\\times12=36$.",
      "A likelihood comparison needs only the counts, since they share the same total.",
    ],
    formal:
      "A multiplicative comparison relates quantities by a scale factor $k=a/b$; additive comparison uses the difference $a-b$. For equally likely individual choices the probabilities are proportional to the counts.",
    pitfalls: [
      "Do not subtract to find 'times as many'.",
      "Do not put the items in the wrong order: the greater count goes first.",
    ],
    parentGuide:
      "Make the counts with small objects and group the larger pile into piles the size of the smaller one to count the piles.",
  },
  {
    id: "compare-fractions-reason-blanks",
    title: "Compare fractions and explain why",
    summary:
      "With the same denominator, more pieces is greater; with the same numerator, smaller pieces make a smaller fraction.",
    objectives: [
      "Choose the greater of two fractions with the same numerator or the same denominator.",
      "State the reason that makes it greater.",
    ],
    intuition:
      "If two fractions have the same denominator, the whole is cut into equal parts of the same size in both, so the fraction with more parts is greater: $\\frac{5}{8}$ is greater than $\\frac{3}{8}$. If they have the same numerator, both have the same number of parts, but a smaller denominator means larger parts: $\\frac{5}{6}$ is greater than $\\frac{5}{8}$ because sixths are larger than eighths.",
    terms: [
      ["numerator", "The top number: how many equal parts are taken."],
      [
        "denominator",
        "The bottom number: how many equal parts make the whole.",
      ],
    ],
    method: [
      "Check which part is the same: the denominators or the numerators.",
      "Same denominator: the greater numerator is the greater fraction. Same numerator: the smaller denominator is the greater fraction.",
      "Give the reason in words about the number or size of the pieces.",
    ],
    watch:
      "With the same numerator, do not choose the greater denominator: more cuts make smaller pieces.",
    principle:
      "For positive integers, $\\frac{a}{n}<\\frac{b}{n}$ when $a<b$, and $\\frac{a}{m}>\\frac{a}{n}$ when $m<n$, because $\\frac{1}{m}>\\frac{1}{n}$.",
    example: {
      prompt: "Compare $\\frac{5}{6}$ and $\\frac{5}{8}$, and say why.",
      steps: [
        "Both have the numerator 5, so each has 5 pieces.",
        "Sixths are larger pieces than eighths, since a whole cut into 6 parts has larger parts than one cut into 8.",
        "So $\\frac{5}{6}$ is greater, because the pieces are larger when the denominator is smaller.",
      ],
      answer: "$\\frac{5}{6}$ is greater because its pieces are larger.",
    },
    methodTitle: "Same part, then the other part",
    methodText: [
      "Draw two bars of the same length, cut into sixths and eighths, and shade 5 parts of each.",
      "The reason always names the part that is the same.",
    ],
    formal:
      "$\\frac{a}{m}-\\frac{a}{n}=\\frac{a(n-m)}{mn}$ is positive exactly when $n>m$, and $\\frac{a}{n}-\\frac{b}{n}=\\frac{a-b}{n}$ is positive exactly when $a>b$.",
    pitfalls: [
      "Do not say a greater denominator means a greater fraction.",
      "Do not give 'the numerators are different' as a reason when they are the same.",
    ],
    parentGuide:
      "Fold two strips of paper into sixths and eighths and compare five folded parts of each.",
  },
  {
    id: "inequality-number-blanks",
    title: "Which number makes the inequality true",
    summary:
      "Place the numbers on a number line; a number is less than another if it lies farther left.",
    objectives: [
      "Decide whether a signed decimal or fraction is less than or greater than another.",
      "Pick the one number of a bank that satisfies each inequality.",
    ],
    intuition:
      "An inequality such as $\\square<-\\frac{1}{2}$ asks for a number to the left of $-\\frac{1}{2}$ on the number line. To compare a decimal with a fraction, write both as decimals: $-\\frac{1}{2}=-0.5$. Then place the numbers in order: of two negative numbers, the one farther from zero is the lesser. With the numbers in order, the one that fits each statement stands out.",
    terms: [
      [
        "inequality",
        "A statement that one number is less than ($<$) or greater than ($>$) another.",
      ],
      ["number line", "A line on which numbers increase from left to right."],
    ],
    method: [
      "Write every number as a decimal.",
      "Put them in order from least to greatest.",
      "For $\\square<t$ choose the number left of $t$; for $\\square>t$ choose the number right of $t$.",
    ],
    watch:
      "A number equal to the one in the statement does not satisfy $<$ or $>$.",
    principle:
      "For real numbers, $a<b$ exactly when $b-a>0$, that is, when $a$ lies to the left of $b$. Negative numbers with greater absolute value are lesser.",
    example: {
      prompt:
        "From $-1.2$, $-\\frac{1}{2}$, $\\frac{1}{4}$ and $0.9$, which number makes $\\square<-\\frac{1}{2}$ true, and which makes $\\square>\\frac{1}{4}$ true?",
      steps: [
        "In order: $-1.2<-0.5<0.25<0.9$.",
        "Only $-1.2$ is left of $-\\frac{1}{2}$.",
        "Only $0.9$ is right of $\\frac{1}{4}$.",
      ],
      answer: "$-1.2$ and $0.9$.",
    },
    methodTitle: "Order first",
    methodText: [
      "Put a mark for each number on a number line before choosing.",
      "Check each choice by reading the inequality aloud.",
    ],
    formal:
      "The real numbers are totally ordered, so any finite set can be sorted. For a sorted bank $b_1<b_2<b_3<b_4$ the statements $x<b_2$ and $x>b_3$ each have exactly one solution in the bank, $b_1$ and $b_4$.",
    pitfalls: [
      "Do not pick the number equal to the one in the statement.",
      "Do not compare digits of negative numbers as if they were positive.",
    ],
    parentGuide:
      "Write each number on a card, line them up in order, and read each inequality aloud.",
  },
];

const built = formatLessons(entries);
export const statementBlanksLessons = built.lessons;
export const statementBlanksMethods = built.methods;
export const statementBlanksPrinciples = built.principles;

const partial = (
  templateId: string,
  facetId: string,
  rationale: string,
): FacetMapping => ({ templateId, facetId, extent: "partial", rationale });
export const statementBlanksFacetMappings: readonly FacetMapping[] = [
  partial(
    "fixed-variable-expense-table",
    "money-values.core",
    "Mark four expenses as varying or staying the same, from three months of amounts or from the kind of expense, in a match table. Does not assess budgets, percent of income, or giving a reason in words.",
  ),
  partial(
    "pythagorean-sort-table",
    "pythagorean-theorem.integer-converse",
    "Mark four or five sets of whole-number side lengths as right or not right using the converse of the Pythagorean theorem, with scaled triples and near misses. Does not assess non-integer sides, drawn triangles, or justifying the converse.",
  ),
  partial(
    "congruence-claims-table",
    "transformation-invariants.core",
    "Mark four or five coordinate rules (translations, reflections, rotations, dilations, stretches, shears) as preserving congruence or not. Does not assess compositions, rules with a center other than the origin, or proofs.",
  ),
  partial(
    "equivalent-expressions-table",
    "expression-properties.core",
    "Mark four or five expressions as equivalent or not to an expression that uses the identity or the associative property, with exactly two equivalent. Does not assess the distributive property, selecting equivalent expressions without a given one, or justifying a claim.",
  ),
  partial(
    "gross-net-sentence",
    "decimal-arithmetic.core",
    "Complete the statement relating gross pay, taxes, deductions and take-home pay in words or with whole-dollar amounts. Does not assess percent tax rates, hourly wages, or pay stubs.",
  ),
  partial(
    "coordinate-terms-slots",
    "coordinate-first-quadrant.core",
    "Match three or four descriptions to the terms axis, origin, ordered pair and coordinate without a drawn plane. Does not assess labeling a drawn plane, plotting points, or quadrants.",
  ),
  partial(
    "point-on-axis-sentence",
    "coordinate-first-quadrant.ordered-pairs",
    "Complete a statement about a first-quadrant point with one coordinate 0: its axis, the zero coordinate, the number of units and the direction. Does not assess points off the axes, negative coordinates, or plotting.",
  ),
  partial(
    "times-as-many-blanks",
    "multiplicative-comparison.core",
    "From a table of three counts, complete a times-as-many sentence or a more-than-twice-as-likely sentence with exactly one valid pair. Does not assess additive comparison, comparisons with fractions, or tally marks.",
  ),
  partial(
    "compare-fractions-reason-blanks",
    "fraction-comparison.core",
    "Choose the greater of two fractions with the same numerator or the same denominator and the reason from a bank. Does not assess unlike fractions, benchmark reasoning, or explaining in the learner's words.",
  ),
  partial(
    "inequality-number-blanks",
    "absolute-value.core",
    "From a bank of four signed decimals and fractions, choose the one number that satisfies each of two inequalities. Does not assess chained inequalities, algebraic inequalities, or number-line graphs.",
  ),
];
