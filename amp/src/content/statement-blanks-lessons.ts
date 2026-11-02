import type { FacetMapping } from "./coverage";
import { formatLessons, type FormatLessonEntry } from "./format-lesson-entry";

const entries: FormatLessonEntry[] = [
  {
    id: "fixed-variable-expense-table",
    title: "Fixed and variable expenses",
    summary:
      "A fixed expense costs the same every month. A variable expense changes with how much you use or buy.",
    objectives: [
      "Tell a fixed expense, the same each month, from a variable expense, which changes.",
      "Use the amounts for several months to decide.",
    ],
    intuition:
      "An expense is money spent on something. Many expenses come every month. A fixed expense is set at the same amount every month, like rent. Rent is money paid to live in a home. A variable expense depends on how much you use or buy, like food or electricity, so it changes from month to month. The tables in these problems show a few months. An expense with the same amount in every month shown stayed the same, as a fixed expense does. An expense whose amount changes varies. A few matching months alone do not prove a cost is set ahead, so also ask whether the amount is agreed ahead of time.",
    terms: ["fixed-cost", "variable-cost"],
    method: [
      "Look at the amounts for one expense across all the months.",
      "If every month shows the same amount, the expense stayed the same in those months. If any month is different, it varies.",
      "If there are no amounts, ask: is the monthly amount agreed ahead of time (fixed)? Or does it depend on how much you use (variable)?",
    ],
    watch:
      "Check every month. Two months that match do not make an expense fixed if a third month is different.",
    principle:
      "Rent of 700, 700 and 700 dollars stayed the same in every month shown. Groceries of 210, 185 and 240 dollars varied. With letters, monthly amounts $a_1$, $a_2$ and $a_3$ stayed the same when $a_1=a_2=a_3$, and varied if any two differ. The small numbers 1, 2 and 3 name the months. A monthly price agreed ahead of time makes a fixed expense, and paying for how much you use makes a variable one.",
    example: {
      prompt:
        "Rent was 700, 700, 700 and groceries were 210, 185, 240 dollars in three months. Which varies?",
      steps: [
        "Rent is 700, 700 and 700 dollars. All three months are the same, so rent stays the same.",
        "Groceries are 210, 185 and 240 dollars. The months are different, so groceries vary.",
      ],
      answer: "Groceries vary; rent stays the same.",
    },
    methodTitle: "Same every month, or not",
    methodText: [
      "Write the amounts in a row. Check whether they are all equal.",
      "A family budget, a plan for spending, can plan a fixed expense exactly. For a variable expense it has to estimate, or make a close guess.",
    ],
    formal:
      "Think of each expense as a list of monthly amounts. A fixed expense has the same amount in every month. So two months that differ show an expense is not fixed. Matching months alone do not prove it is fixed: a variable expense can match by chance.",
    pitfalls: [
      "Do not call an expense fixed because it is large. Size does not decide.",
      "Do not call an expense variable because it was paid late. Only the amount matters.",
    ],
    parentGuide:
      "Look at recent family bills together. Sort them into bills that are always the same and bills that change.",
    noLink: ["change", "changes", "third", "sort"],
  },
  {
    id: "pythagorean-sort-table",
    title: "Is it a right triangle?",
    summary:
      "A triangle has a right angle, a page-corner angle, exactly when its two shorter sides times themselves add to the longest side times itself.",
    objectives: [
      "Test three side lengths by checking whether $a^2+b^2=c^2$, where $c$ is the longest side.",
      "Tell right triangles from sets of sides that only come close.",
    ],
    intuition:
      "A degree is a small unit for measuring angles. A right angle is an angle of 90 degrees, written $90^\\circ$, like the corner of a sheet of paper. A right triangle is a triangle with one right angle. Its longest side, across from the right angle, is called the hypotenuse. Squared means multiplied by itself, written with a small raised 2: $3^2=3\\times3=9$. In every right triangle, the squares of the two shorter sides add up to the square of the longest side. This also works backward. If the two shorter sides squared add up to the longest side squared, the triangle has a right angle. If not, it has no right angle. Try 3, 4 and 5: $3^2+4^2=9+16=25$, and $5^2=25$. They match, so it is a right triangle. Try 3, 4 and 6: $9+16=25$, but $6^2=36$. They do not match, so it is not. With letters, call the shorter sides $a$ and $b$ and the longest side $c$. The test is whether $a^2+b^2=c^2$.",
    terms: ["hypotenuse", "pythagorean-triple"],
    method: [
      "Find the longest side and call it $c$. Call the other two sides $a$ and $b$.",
      "Square the two shorter sides and add them: $a^2+b^2$. Then square the longest side: $c^2$.",
      "If the two results are equal, it is a right triangle. If not, it is not a right triangle.",
    ],
    watch:
      "Square the longest side on its own. Adding the sides without squaring, or using a shorter side as $c$, gives the wrong test.",
    principle:
      "The Pythagorean theorem is the rule $a^2+b^2=c^2$ for every right triangle. This test is its converse, the same rule read backward. If a triangle has sides $a\\le b<c$ and $a^2+b^2=c^2$, it is a right triangle, with the right angle across from $c$. If $a^2+b^2\\ne c^2$ ($\\ne$ means “is not equal to”), it is not a right triangle.",
    example: {
      prompt:
        "Is a triangle with sides 9, 12 and 15 a right triangle? What about 9, 12 and 16?",
      steps: [
        "First triangle: the longest side is 15. Square the two shorter sides and add: $9^2+12^2=81+144=225$. Square the longest: $15^2=225$. The results are equal.",
        "Second triangle: the longest side is 16. The shorter sides give the same $9^2+12^2=225$, but $16^2=256$. The results are not equal.",
        "So 9, 12, 15 is a right triangle, and 9, 12, 16 is not.",
      ],
      answer: "9, 12, 15 is a right triangle; 9, 12, 16 is not.",
    },
    methodTitle: "Two squares against one",
    methodText: [
      "A scaled set works too: 6, 8, 10 is 3, 4, 5 doubled, and $36+64=100=10^2$.",
      "A set that misses by a little, such as 5, 12, 14, is not a right triangle: $25+144=169$, but $14^2=196$.",
    ],
    formal:
      "The law of cosines says $c^2=a^2+b^2-2ab\\cos C$, where $C$ is the angle across from side $c$ and $\\cos C$ is its cosine. So $c^2=a^2+b^2$ exactly when $\\cos C=0$. That happens only when angle $C$ is $90^\\circ$.",
    pitfalls: [
      "Do not add the sides: $9+12=21$ tells you nothing here.",
      "Do not decide by eye when the numbers look close. Work out both results.",
    ],
    parentGuide:
      "Check a few sets on a calculator together and see that the two results match exactly only for right triangles.",
    senses: {
      side: "side",
      square: "square-number",
      degree: "degree-angle",
      unit: "unit",
      rule: "rule",
    },
    noLink: ["opposite"],
  },
  {
    id: "congruence-claims-table",
    title: "Which transformations keep a figure congruent",
    summary:
      "Slides, flips and turns keep every distance the same. Resizing, stretching or slanting a figure changes distances.",
    objectives: [
      "Tell rigid motions (slides, flips and turns) from other transformations by what happens to distances.",
      "Test a coordinate rule on two points.",
    ],
    intuition:
      "Two figures are congruent when one fits exactly on top of the other: same size and same shape. A transformation is a rule that moves every point of a figure to a new place. The moved figure is called the image. A translation slides a figure, a reflection flips it over a line, and a rotation turns it around a point. These three are called rigid motions. They never change a distance or an angle, so the image is congruent. A dilation makes a figure bigger or smaller. A stretch pulls it in one direction, and a shear slants it. Each of these can change distances, so it does not always give a congruent image. A rule like $(x,y)\\to(x,2y)$ says where each point goes. Here $(x,y)$ is a point, $x$ across and $y$ up, and the arrow points to where it lands. The two numbers $x$ and $y$ are its coordinates. This rule keeps $x$ and doubles $y$. To test a rule, apply it to two points, and compare the distance between them before and after.",
    terms: ["congruent", "rigid-motion"],
    method: [
      "Choose two points, such as $(0,0)$ and $(0,1)$, and use the rule to find where each one lands.",
      "Compare the distance between the new points with the distance between the original points.",
      "If any pair of points changes distance, the rule does not keep figures congruent. A slide, flip or turn keeps every distance, so it does.",
    ],
    watch:
      "Test a stretch or a dilation with a pair of points. A rule that multiplies just one coordinate by a number other than 1 or $-1$, and leaves the other alone, changes some distances.",
    principle:
      "A transformation keeps figures congruent exactly when it keeps every distance: for all points $P$ and $Q$, the distance between their images equals the distance $PQ$. Translations, reflections and rotations do this, and so does doing several of them in a row.",
    example: {
      prompt:
        "Does $(x,y)\\to(x,2y)$ preserve congruence? Does $(x,y)\\to(-y,x)$?",
      steps: [
        "Try the first rule on $(0,0)$ and $(0,1)$, which are 1 unit apart. They land on $(0,0)$ and $(0,2)$, which are 2 units apart. The distance changed.",
        "Try the second rule on the same points. They land on $(0,0)$ and $(-1,0)$, still 1 unit apart. This rule turns every point a quarter turn around $(0,0)$, a rotation, so every distance stays the same.",
        "So $(x,2y)$ does not preserve congruence, and $(-y,x)$ does.",
      ],
      answer: "$(x,2y)$ does not; $(-y,x)$ does.",
    },
    methodTitle: "Test the distance",
    methodText: [
      "Name the transformation when you can. Changing the sign of one coordinate, as in $(x,y)\\to(x,-y)$, is a reflection. Swapping the coordinates, $(x,y)\\to(y,x)$, is a reflection too. Swapping and changing one sign, $(x,y)\\to(-y,x)$, is a quarter-turn rotation.",
      "A rule that multiplies just one coordinate by a number other than 1 or $-1$, and leaves the other alone, changes some distances.",
    ],
    formal:
      "A rule of the form $(x,y)\\mapsto(ax+by+e,\\,cx+dy+f)$ keeps every distance exactly when the matrix $\\begin{pmatrix}a&b\\\\c&d\\end{pmatrix}$ is orthogonal. That means its columns, $(a,c)$ and $(b,d)$, each have length 1 and are perpendicular.",
    pitfalls: [
      "Do not accept a rule because it looks balanced. $(2x,2y)$ treats both coordinates the same, but it doubles every distance.",
      "Do not test just one point. Congruence is about the distance between two points.",
    ],
    parentGuide:
      "Cut out a small shape, move it in each way, and see which moves leave it fitting on the original.",
    senses: { rule: "rule", image: "image-transformation", unit: "unit" },
    noLink: ["quarter", "leaves"],
  },
  {
    id: "equivalent-expressions-table",
    title: "Equivalent expressions",
    summary:
      "Two expressions are equivalent when they give the same value for every number you put in for the variable.",
    objectives: [
      "Rewrite an expression using two rules: times 1 or plus 0 changes nothing, and the order and grouping of a product do not matter.",
      "Tell an equivalent expression from a different one by trying a number.",
    ],
    intuition:
      "An expression is a math phrase made of numbers, letters and operations, such as $2x+3$. The letter $x$ is a variable: it stands for a number that can change. Writing $2x$ means 2 times $x$, and a raised dot, as in $x\\cdot1$, also means times. A product is the answer when you multiply. Two expressions are equivalent when they give the same value whatever number $x$ is. Multiplying by 1 or adding 0 does not change a number. So $x\\cdot1$, $1\\cdot x$ and $x$ are equivalent. This rule is called the identity property. When you only multiply, you can change the order: $x\\cdot3=3\\cdot x$. This rule is called the commutative property. You can also change the grouping: $(2\\cdot3)\\cdot x=2\\cdot(3\\cdot x)$. This rule is called the associative property. Using both, $(2x)\\cdot3$, which is 2 times $x$ times 3, equals $2\\cdot3\\cdot x=6x$. An expression such as $x+1$ is different from $x$: it is always 1 more. Trying a number such as 3 in both expressions shows a difference quickly.",
    terms: [
      "equivalent-expressions",
      "identity-property",
      "commutative-property",
      "associative-property",
    ],
    method: [
      "Simplify the given expression: drop a times 1 or a plus 0, and regroup products.",
      "Simplify each choice the same way, or put one number, such as 3, into the given expression and into the choice.",
      "Mark the choice equivalent only if it simplifies to the same expression. A different result for one number proves it is not equivalent.",
    ],
    watch:
      "One number that matches does not prove two expressions are equivalent, but one number that gives different results proves they are not. Test a number other than 0 or 1.",
    principle:
      "For every number $x$: $x\\cdot1=1\\cdot x=x$ and $x+0=x$. For any numbers $a$, $b$ and $c$: $a\\cdot b=b\\cdot a$, $(a\\cdot b)\\cdot c=a\\cdot(b\\cdot c)$ and $(a+b)+c=a+(b+c)$. Expressions are equivalent when they agree for every value of $x$.",
    example: {
      prompt: "Is $(2x)\\cdot3$ equivalent to $6x$? To $2x+3$?",
      steps: [
        "$(2x)\\cdot3$ is 2 times $x$ times 3. Change the order and grouping so the numbers come first, then multiply them: $2\\cdot3\\cdot x=6x$. So $(2x)\\cdot3$ is equivalent to $6x$.",
        "For $2x+3$, try $x=3$. The given expression is $(2\\cdot3)\\cdot3=6\\cdot3=18$. The choice is $2\\cdot3+3=6+3=9$.",
        "18 and 9 differ, so $2x+3$ is not equivalent to $(2x)\\cdot3$.",
      ],
      answer: "$6x$ is equivalent; $2x+3$ is not.",
    },
    methodTitle: "Rewrite, or test a number",
    methodText: [
      "Pick a number that can tell expressions apart. With 0 or 1, different expressions can match by chance: $x\\cdot x$ and $x$ both give 1 when $x=1$.",
      "Equivalent expressions can look different, like $x\\cdot1$ and $x$.",
    ],
    formal:
      "Think of each expression as a machine: an input is the number put in, and an output is the result. Two expressions are equivalent exactly when they give the same output for every input. The identity, commutative and associative properties are basic rules of arithmetic with real numbers. Every equivalence here follows from them.",
    pitfalls: [
      "Do not call $x+1$ equivalent to $x\\cdot1$ just because both contain a 1.",
      "Do not judge by how alike two expressions look. Compare their values.",
    ],
    parentGuide:
      "Choose a number together, say 3, and have your learner work out both expressions.",
    senses: { product: "product-multiply", rule: "rule" },
    noLink: ["change", "difference", "changes"],
  },
  {
    id: "gross-net-sentence",
    title: "Gross pay and take-home pay",
    summary:
      "Gross pay is what you earn before anything is taken out. Take-home pay is gross pay minus taxes and deductions.",
    noLink: ["leaves", "sample"],
    objectives: [
      "Describe gross pay and take-home pay in words.",
      "Find take-home pay from gross pay, taxes and deductions.",
    ],
    intuition:
      "Gross pay is all the money a worker earns, before anything is taken out. Then some money is taken out. A tax is money people must pay to the government. A deduction is another amount taken out, such as a payment for health insurance. Some pay stubs call taxes deductions too, so count each amount only once. What is left is the take-home pay, also called net pay. It is the money the worker actually gets. So take-home pay is gross pay minus taxes and deductions. When anything is taken out, it is less than gross pay.",
    terms: ["gross-pay", "deduction", "net-pay"],
    method: [
      "Add the taxes and the deductions to find everything taken out.",
      "Subtract that total from the gross pay.",
      "The answer is the take-home pay. It is less than gross pay when anything is taken out.",
    ],
    watch:
      "Add up everything taken out first. Then subtract it from the gross pay, not from another amount.",
    principle:
      "Gross pay of 500 dollars, with 80 dollars of taxes and 20 dollars of deductions, leaves $500-(80+20)=400$ dollars of take-home pay. In words: take-home pay $=$ gross pay $-$ (taxes $+$ deductions). Adding back gives gross pay $=$ take-home pay $+$ taxes $+$ deductions.",
    example: {
      prompt:
        "Gross pay is 500 dollars, taxes are 80 dollars and deductions are 20 dollars. Find take-home pay.",
      steps: [
        "Add everything taken out: $80+20=100$ dollars.",
        "Subtract it from the gross pay: $500-100=400$ dollars of take-home pay.",
      ],
      answer: "400 dollars.",
    },
    methodTitle: "Everything taken out, then subtract",
    methodText: [
      "Check by adding back: $400+100=500$, the gross pay.",
      "In words: gross pay is counted before taxes and deductions, and take-home pay after.",
    ],
    formal:
      "Say $G$ is the gross pay and $T$ is the total of all taxes and deductions. Then the take-home pay, or net pay, is $N=G-T$. So $G=N+T$: adding back what was taken out gives the gross pay.",
    pitfalls: [
      "Do not add the taxes to gross pay. They are taken out.",
      "Do not forget one of the deductions.",
    ],
    parentGuide:
      "Look at a sample pay stub, the paper that comes with pay. Find the gross pay, what was taken out, and the take-home pay.",
  },
  {
    id: "coordinate-terms-slots",
    title: "Names for the parts of a coordinate plane",
    summary:
      "The axes are the two number lines of a coordinate plane. The origin is where they cross. An ordered pair names a point.",
    senses: { plane: "plane" },
    objectives: [
      "Name the $x$-axis, the $y$-axis and the origin.",
      "Tell the $x$-coordinate and the $y$-coordinate of an ordered pair.",
    ],
    intuition:
      "A coordinate plane is a flat grid with two number lines that cross like a plus sign. The number line going across is the $x$-axis. The one going up and down is the $y$-axis. Together they are called the axes. They cross at the origin, the point $(0,0)$. A point is named by an ordered pair: two numbers in a set order, like $(3,5)$. The first number, the $x$-coordinate, says how far to move across. The second number, the $y$-coordinate, says how far to move up.",
    terms: ["x-axis", "y-axis", "origin", "ordered-pair"],
    method: [
      "Decide what the description is about: a line, a point, or one of the numbers in a pair.",
      "For a line, decide whether it goes across (the $x$-axis) or up and down (the $y$-axis).",
      "For a number in a pair, the first is the $x$-coordinate and the second is the $y$-coordinate.",
    ],
    watch:
      "Do not mix up the $x$-coordinate, a number, with the $x$-axis, a line.",
    principle:
      "The point $(3,5)$ is 3 across and 5 up from the origin. Each point has exactly one ordered pair $(x,y)$. Here $x$ is how far the point is across from the origin, and $y$ is how far up. A negative number means left or down.",
    example: {
      prompt:
        "Name: the vertical number line; the first number of the pair $(3,5)$; the point $(0,0)$.",
      steps: [
        "The vertical number line, the one going up and down, is the $y$-axis.",
        "In $(3,5)$, the first number, 3, says how far to move across. It is the $x$-coordinate.",
        "The point $(0,0)$, where the axes cross, is the origin.",
      ],
      answer: "$y$-axis, $x$-coordinate, origin.",
    },
    methodTitle: "Line, point or number",
    methodText: [
      "Say the order of a pair as “across, then up”.",
      "Both coordinates of the origin are 0, because you do not move at all.",
    ],
    formal:
      "The $x$-axis is every point whose $y$-coordinate is 0. The $y$-axis is every point whose $x$-coordinate is 0. The origin $(0,0)$ is on both. Each point has one ordered pair: how far across, then how far up.",
    pitfalls: [
      "Do not read the pair as “up, then across”.",
      "Do not call the origin an axis. It is a point.",
    ],
    parentGuide:
      "Draw the plane on paper. Label the axes, the origin and one point together.",
  },
  {
    id: "point-on-axis-sentence",
    title: "A point on an axis",
    summary:
      "A point with a coordinate of 0 lies on an axis. The other coordinate tells how far, and which way, to move from the origin.",
    objectives: [
      "Tell which axis a point lies on from its coordinates.",
      "Say how far and in which direction to move from the origin.",
    ],
    intuition:
      "An ordered pair, like $(5,0)$, names a point on a grid. Its two numbers are called coordinates. The first number says how far to move right from the origin, the point $(0,0)$ where the two number lines cross. The second number says how far to move up. A negative number means left or down instead. If the second number is 0, you do not move up at all. So the point is on the $x$-axis, the number line going across: $(5,0)$ is 5 units right of the origin. If the first number is 0, you do not move right. So the point is on the $y$-axis, the number line going up: $(0,3)$ is 3 units up.",
    senses: { unit: "unit", units: "unit" },
    terms: ["coordinate", "origin"],
    method: [
      "Find which coordinate, which number of the pair, is 0.",
      "If the second is 0, the point is on the $x$-axis. If the first is 0, it is on the $y$-axis.",
      "Move from the origin by the other number: right for the first number, up for the second. A negative number means left or down.",
    ],
    watch:
      "A second number of 0 puts the point on the $x$-axis: $(7,0)$ is on the $x$-axis. Only the origin, $(0,0)$, is on both axes.",
    principle:
      "$(7,0)$ is on the $x$-axis, 7 units right of the origin. $(0,4)$ is on the $y$-axis, 4 units up. With letters, $(a,0)$ is on the $x$-axis and $(0,b)$ is on the $y$-axis. The distance from the origin is the other number without its sign, so $(-3,0)$ is 3 units left.",
    example: {
      prompt: "Describe the point $(0,4)$.",
      steps: [
        "The first coordinate is 0, so you do not move right. The point is on the $y$-axis.",
        "The second coordinate is 4, so move 4 units up from the origin.",
      ],
      answer: "It is on the $y$-axis, 4 units up from the origin.",
    },
    methodTitle: "Which number is zero",
    methodText: [
      "Check by plotting: start at the origin and make the moves.",
      "Move right for the first number and up for the second. A negative number means left or down.",
    ],
    formal:
      "The $x$-axis is every point whose second number, $y$, is 0. The $y$-axis is every point whose first number, $x$, is 0.",
    pitfalls: [
      "Check both numbers before you name the axis. $(7,0)$ is on the $x$-axis because its second number is 0.",
      "Do not move up for the first number.",
    ],
    parentGuide:
      "Plot a few points with a 0 together. Describe each one as “on the … axis, … units from the origin”.",
  },
  {
    id: "times-as-many-blanks",
    title: "Times as many",
    summary:
      "One count is 3 times as many as another when it is 3 groups of that count. A bigger count is more likely to be picked.",
    noLink: ["third"],
    objectives: [
      "Find how many times as many one count is as another by dividing.",
      "Compare how likely two kinds are to be picked from their counts, such as more than twice as likely.",
    ],
    intuition:
      "“3 times as many” compares by multiplying. With 24 cups and 8 mugs, 24 is 3 groups of 8, so there are 3 times as many cups as mugs. Divide to find it: $24\\div8=3$. “How many more” is different. It subtracts: 24 is 16 more than 8. Now pick one thing at random, without looking. A kind with a bigger count is more likely to be picked. “More than twice as likely” means its count is more than 2 times the other count.",
    senses: { "more than": "more-than" },
    terms: [
      "times-as-many",
      [
        "times-as-many",
        "More than twice as likely: its count is more than 2 times the other count.",
      ],
    ],
    method: [
      "Divide the greater count by the smaller count. If the answer is a whole number, the greater count is that many times as many: $36\\div12=3$, so 3 times as many.",
      "For how likely, double the smaller count, which means times 2. Check whether the greater count is more than that.",
      "Fill in the sentence with the right things in the right places. The greater count goes first.",
    ],
    watch:
      "Divide the greater count by the smaller one, and do not subtract. 24 is 16 more than 8, but 3 times as many.",
    principle:
      "With 36 mugs and 12 cups, $36\\div12=3$, so there are 3 times as many mugs as cups. With letters, $a$ is $k$ times as many as $b$ when $a=k\\times b$, so $k=a\\div b$. When one item is picked at random from all of them, a kind with twice the count has twice the chance. So kind $A$ is more than twice as likely as kind $B$ exactly when $A$'s count is more than 2 times $B$'s count.",
    example: {
      prompt:
        "A table shows 12 cups, 36 mugs and 7 bottles. Complete: there are __ times as many __ as __.",
      steps: [
        "Try the counts in pairs. $36\\div12=3$ is a whole number, and 7 does not divide 12 or 36 evenly.",
        "So the 36 mugs are 3 groups of the 12 cups: there are 3 times as many mugs as cups.",
      ],
      answer: "3 times as many mugs as cups.",
    },
    methodTitle: "Divide to compare",
    methodText: [
      "Check by multiplying: $3\\times12=36$.",
      "To compare how likely, you only need the counts, because both kinds are picked from the same total.",
    ],
    formal:
      "Times as many compares by multiplying: $k=a\\div b$. How many more compares by subtracting: $a-b$. When every item is equally likely to be picked, a kind with $k$ times the count has $k$ times the chance.",
    pitfalls: [
      "Do not subtract to find “times as many”.",
      "Do not put the things in the wrong order. The greater count goes first.",
    ],
    parentGuide:
      "Make the counts with small objects. Split the bigger pile into piles the size of the smaller one, and count the piles.",
  },
  {
    id: "compare-fractions-reason-blanks",
    title: "Compare fractions and explain why",
    summary:
      "Same denominator: more pieces is greater. Same top number, not 0: the smaller denominator has bigger pieces, so it is greater.",
    objectives: [
      "Choose the greater of two fractions with the same numerator or the same denominator.",
      "Say the reason that makes it greater.",
    ],
    intuition:
      "A fraction like $\\frac{5}{8}$ names equal pieces of a whole. The bottom number, the denominator, says how many equal pieces the whole is cut into. The top number, the numerator, says how many pieces you have. Same denominator: the pieces are the same size, so more pieces is greater. $\\frac{5}{8}$ is greater than $\\frac{3}{8}$. Same numerator: you have the same number of pieces. A smaller denominator means fewer cuts, so each piece is bigger. $\\frac{5}{6}$ is greater than $\\frac{5}{8}$, because sixths are bigger than eighths.",
    senses: {
      whole: "whole",
      part: "part",
      parts: "part",
      eighth: "eighth",
      eighths: "eighth",
      "more than": "more-than",
    },
    terms: ["numerator", "denominator"],
    method: [
      "Check which numbers match: the denominators or the numerators.",
      "Same denominator: the greater numerator makes the greater fraction. Same numerator, not 0: the smaller denominator makes the greater fraction.",
      "Give the reason in words about the number of pieces or the size of the pieces.",
    ],
    watch:
      "With the same numerator, do not choose the bigger denominator. More cuts make smaller pieces.",
    principle:
      "$\\frac{5}{8}>\\frac{3}{8}$, because 5 eighths is more than 3 eighths. $\\frac{5}{6}>\\frac{5}{8}$, because one sixth is bigger than one eighth. The sign $>$ means “is greater than”, and $<$ means “is less than”. With letters, for whole numbers more than 0: $\\frac{a}{n}<\\frac{b}{n}$ when $a<b$, and $\\frac{a}{m}>\\frac{a}{n}$ when $m<n$.",
    example: {
      prompt: "Compare $\\frac{5}{6}$ and $\\frac{5}{8}$, and say why.",
      steps: [
        "Both have the numerator 5, so each has 5 pieces.",
        "A whole cut into 6 equal parts has bigger parts than one cut into 8. So sixths are bigger pieces than eighths.",
        "So $\\frac{5}{6}$ is greater, because its pieces are bigger when the denominator is smaller.",
      ],
      answer: "$\\frac{5}{6}$ is greater because its pieces are larger.",
    },
    methodTitle: "Same part, then the other part",
    methodText: [
      "Draw two bars of the same length. Cut one into sixths and one into eighths, and shade 5 parts of each.",
      "The reason always names the number that is the same.",
    ],
    formal:
      "With the same denominator, the fraction with more pieces is greater, because all the pieces are the same size. With the same numerator, compare one piece: $\\frac{1}{6}$ is bigger than $\\frac{1}{8}$, so 5 sixths is more than 5 eighths. With letters, $\\frac{a}{m}$ is greater than $\\frac{a}{n}$ exactly when $m$ is less than $n$, for whole numbers more than 0.",
    pitfalls: [
      "Do not say a greater denominator means a greater fraction.",
      "Do not give “the numerators are different” as the reason when they are the same.",
    ],
    parentGuide:
      "Fold two strips of paper into sixths and eighths. Compare five parts of each.",
  },
  {
    id: "inequality-number-blanks",
    title: "Which number makes the inequality true",
    summary:
      "On a number line, smaller numbers are to the left. A number is less than another when it lies farther left.",
    objectives: [
      "Decide whether a positive or negative decimal or fraction is less than or greater than another.",
      "Pick the one number from a list that makes each inequality true.",
    ],
    intuition:
      "An inequality compares two numbers. The sign $<$ means “is less than”, and $>$ means “is greater than”. A number line puts numbers in order, smaller to the left and larger to the right. Negative numbers are numbers below 0, and they sit to the left of 0. The box $\\square$ is a blank for the number you choose. So $\\square<-\\frac{1}{2}$ asks for a number to the left of $-\\frac{1}{2}$. To compare a decimal with a fraction, write both as decimals: $-\\frac{1}{2}=-0.5$, because 1 divided by 2 is 0.5. Of two negative numbers, the one farther from 0 is the smaller. For example, $-1.2<-0.5$. Once the numbers are in order, the one that fits each statement stands out.",
    terms: ["inequality", "number-line"],
    method: [
      "Write every number as a decimal. For a fraction, divide the top number by the bottom number.",
      "Put the numbers in order from least to greatest, as on a number line.",
      "For $\\square<t$, choose the number left of $t$. For $\\square>t$, choose the number right of $t$.",
    ],
    watch:
      "A number equal to the one in the statement does not make $<$ or $>$ true.",
    principle:
      "For numbers $a$ and $b$, $a<b$ exactly when $b-a>0$, that is, when $a$ lies to the left of $b$ on the number line. Of two negative numbers, the one farther from 0 is less.",
    example: {
      prompt:
        "From $-1.2$, $-\\frac{1}{2}$, $\\frac{1}{4}$ and $0.9$, which number makes $\\square<-\\frac{1}{2}$ true, and which makes $\\square>\\frac{1}{4}$ true?",
      steps: [
        "Write the fractions as decimals: $-\\frac{1}{2}=-0.5$ and $\\frac{1}{4}=0.25$. In order from least to greatest: $-1.2<-0.5<0.25<0.9$.",
        "$\\square<-\\frac{1}{2}$ needs a number to the left of $-0.5$. Only $-1.2$ is.",
        "$\\square>\\frac{1}{4}$ needs a number to the right of $0.25$. Only $0.9$ is.",
      ],
      answer: "$-1.2$ and $0.9$.",
    },
    methodTitle: "Order first",
    methodText: [
      "Mark each number on a number line before choosing.",
      "Check each choice by reading the inequality aloud, such as “negative 1.2 is less than negative one half”.",
    ],
    formal:
      "Real numbers are all the numbers on the number line, including fractions and decimals. Any two different real numbers can be compared, so any short list can be put in order. For a sorted list $b_1<b_2<b_3<b_4$, the statement $x<b_2$ has exactly one solution in the list, $b_1$. The statement $x>b_3$ has exactly one, $b_4$.",
    pitfalls: [
      "Do not pick the number equal to the one in the statement.",
      "Do not compare negative numbers by their digits as if they were positive: $-1.2$ is less than $-0.5$, even though 1.2 is more than 0.5.",
    ],
    parentGuide:
      "Write each number on a card, line them up in order, and read each inequality aloud.",
    senses: { "more than": "more-than" },
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
