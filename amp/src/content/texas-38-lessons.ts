import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

export const texas38Methods: Record<string, ProblemMethod> = {
  "times-as-many-comparison": {
    goal: "Read and write a multiplication as a comparison: how many times as many one amount is as another.",
    intuition:
      'Compare two amounts by asking how many equal copies of the smaller amount make the larger one. That number goes in front of "times as many".',
    terms: ["times-as-many", "more-than"],
    method: [
      'Name the amount being compared with: the one after "as". It is the amount that gets copied.',
      'The number before "times as many" is how many copies. Multiply it by the amount being copied.',
      "To compare two counts, divide the greater by the smaller. The result is the number of times as many.",
    ],
    watch:
      '"4 more" and "4 times as many" are different. A comparison by adding uses the difference; a comparison by multiplying uses equal groups.',
  },
  "situation-pair-table": {
    goal: "Use a real-world relationship to complete a table of number pairs, going forward, going backward or finding the rate.",
    intuition:
      "A table of pairs lists matching amounts. When every row follows the same rule, one row tells you the rule, and the rule fills in the rest.",
    terms: [
      [
        "ordered-pair",
        "Here, two numbers that go together, such as 3 boxes and 24 pencils.",
      ],
      "rule",
    ],
    method: [
      "Read the situation: is each row made by multiplying (equal groups) or adding (a fixed gap)?",
      "Check the rule on a row you can see. For equal groups, divide the second number by the first.",
      "Apply the rule forward to find an output, or undo it (divide, or subtract the gap) to find an input.",
    ],
    watch:
      "A fixed gap adds the same amount in every row; equal groups multiply. Tripling the number of boxes triples the pencils, but a 3-year age gap does not triple an age.",
  },
  "story-equation-choice": {
    goal: "Choose the equation, with a letter for the unknown, that matches a one-step or two-step story within 1,000.",
    intuition:
      "An equation tells the story in numbers. Decide which amount is the whole, which amounts are parts, and what happens to the amounts, then write that with a letter for what you do not know.",
    terms: ["unknown", "equation"],
    method: [
      "Find the total and the parts. Getting more joins amounts; giving away takes one away from the total.",
      "Write the changes in the order they happen, with the unknown where the story hides it.",
      "Check the equation by reading it back as the story. If the unknown is the start, begin the equation with $n$.",
    ],
    watch:
      "Equations such as $a+b=n$ and $n-b=a$ describe the same story. Do not choose one just because the numbers appear in the same order as in the story.",
  },
  "strip-diagram-equation": {
    goal: "Read a strip diagram of a multistep story and choose the equation with a letter that fits it.",
    intuition:
      "A strip diagram shows parts and the whole as bars of matching length. Each bar becomes a number, a product or a letter in the equation.",
    terms: ["strip-diagram", "equal-parts"],
    method: [
      "Name the whole and each part. Write repeated equal parts as one product.",
      "Combine the parts with the operation the diagram shows: parts add to the whole.",
      "If a part is removed first, group it with parentheses before sharing the rest equally.",
    ],
    watch:
      "Order matters in a multistep equation: $(T-c)\\div a$ takes away first and then shares, while $T-c\\div a$ shares first.",
  },
  "division-area-model": {
    goal: "Read a division as an area model: partial quotients, the equation with an unknown side, and the quotient.",
    intuition:
      "A rectangle's area is its height times its width. If the area and the height are known, dividing the area by the height gives the width.",
    terms: [
      "area-model",
      [
        "quotient",
        "A partial quotient is one part of the quotient; in an area model it is one part's width, its area divided by the height.",
      ],
    ],
    method: [
      "Write the height times the unknown width as the area: $\\text{height}\\times w=\\text{area}$.",
      "Divide each part's area by the height. Each answer is one partial quotient.",
      "Add the partial quotients. The sum is the quotient and the full width.",
    ],
    watch:
      "Divide every part by the height. Adding the areas gives back the dividend, and a part that is not divided stays too large.",
  },
  "fraction-benchmark-reasonable": {
    goal: "Use the benchmarks 0, 1/4, 1/2, 3/4 and 1 to estimate sums and differences and judge reasonable answers.",
    intuition:
      "A benchmark is an easy fraction to compare with. Replace each fraction by the nearest benchmark and the sum or difference becomes easy to find.",
    terms: ["benchmark-fraction", "estimate"],
    method: [
      "Write each fraction as a decimal, or compare it with $\\tfrac12$ first. Choose the nearest benchmark.",
      "Add or subtract the benchmarks.",
      "Compare an exact or proposed answer with the estimate. If it is far away, it is not reasonable.",
    ],
    watch:
      "Fractions with the same denominator add by the numerators only. If the proposed answer has a larger denominator, check it against the benchmarks.",
  },
  "unit-relative-size": {
    goal: "Compare the sizes of customary and metric units and decide which measurement has the greater number.",
    intuition:
      "A larger unit covers more, so fewer of them are needed. The same amount measured in a smaller unit gives a greater number.",
    terms: ["unit"],
    method: [
      "Picture a real object for each unit and decide which is bigger.",
      "For the same amount, a smaller unit gives a greater number of units.",
      "To order units, put the smallest first and compare each next unit with the one before.",
    ],
    watch:
      "The name of a unit does not show its size. A kilometer is not shorter than a meter because its name is longer; picture each one.",
  },
  "decimal-area-model": {
    goal: "Model a decimal product on a hundredths square and a decimal quotient as the missing side of a rectangle.",
    intuition:
      "A 10 by 10 square is 1 whole, so each small square is one hundredth. A rectangle that is tenths tall and tenths wide covers hundredths of the whole.",
    terms: ["tenth", "hundredth"],
    method: [
      "For a product, count the rows and columns of the shaded rectangle and multiply the counts, then write the total as hundredths.",
      "For a quotient, write the area as tenths or hundredths and share that count equally across the width.",
      "Check a quotient by multiplying: width times height equals the area.",
    ],
    watch:
      "$0.4\\times0.6$ is $0.24$, not $2.4$ and not $0.024$. Tenths times tenths are hundredths, so the product has two decimal places.",
  },
  "number-set-venn": {
    goal: "Place numbers in rings of natural numbers, whole numbers, integers and rational numbers, and judge “every … is a …” statements.",
    intuition:
      "Natural numbers are the counting numbers 1, 2, 3, …. Whole numbers add 0. Integers add the negatives, such as $-3$. Rational numbers add every fraction of integers (with a bottom that is not 0), such as $\\frac{1}{2}$. Each set sits inside the next, like rings inside rings.",
    noLink: ["whole", "sort"],
    terms: ["natural-number", "whole-number", "integer", "rational-number"],
    method: [
      "Simplify first: $12/4$ equals $3$ and $-9/3$ equals $-3$. The slash / means divide.",
      "Start from the innermost set and move outward until the number fits. The number is in that set and every larger set.",
      "A statement “every $X$ is a $Y$” is true only when the ring for $X$ lies inside the ring for $Y$.",
    ],
    watch:
      "Zero is whole but not natural. Negative numbers are integers but not whole. A fraction that simplifies to an integer is an integer.",
  },
  "reciprocal-division-choice": {
    goal: "Choose the multiplication that equals a division by a fraction or whole number, using the reciprocal.",
    intuition:
      "Dividing by $\\tfrac23$ asks how many groups of $\\tfrac23$ fit. Each whole has $\\tfrac32$ of them, so dividing by $\\tfrac23$ multiplies by $\\tfrac32$.",
    terms: ["reciprocal", "divisor"],
    method: [
      "Find the divisor, the number after the division sign.",
      "Turn the divisor upside down. A whole number is a fraction over 1.",
      "Change the division sign to multiplication and keep the first number as it is.",
    ],
    watch:
      "Flip only the divisor. Flipping the first number, or both, changes the value.",
  },
  "scaling-direction-choice": {
    goal: "Decide, without computing, whether a product is greater than or less than the starting number.",
    intuition:
      "Multiplying by 1 leaves a number unchanged. A multiplier less than 1 takes only part of the number, so the result shrinks. A multiplier greater than 1 takes more than one copy, so it grows.",
    terms: ["multiplier"],
    method: [
      "Compare the multiplier with 1. An improper fraction is greater than 1.",
      "Less than 1 gives a smaller result, equal to 1 gives the same, and greater than 1 gives a larger result.",
      'Say the reason in terms of the multiplier, not the word "fraction".',
    ],
    watch:
      "Multiplication does not always make a number bigger. A fraction can be greater than 1, as in $\\tfrac{8}{3}$, or equal to 1, as in $\\tfrac66$.",
  },
  "percent-grid-model": {
    goal: "Read the percent, fraction or decimal for the shaded part of a grid of 10 rows and 10 columns.",
    intuition:
      "Percent means “out of 100,” and % is read “percent.” A 10 by 10 grid has 100 equal squares, so each square is 1% of the grid. The number of shaded squares is the percent. As a fraction it is that number over 100. As a decimal it is that many hundredths.",
    senses: { part: "part", whole: "whole", square: "square-shape" },
    noLink: ["change"],
    terms: ["percent"],
    method: [
      "Count the shaded squares: full columns of 10 first, then the extra squares.",
      "The count is the percent. As a fraction it is the count over 100, which can be simplified.",
      "As a decimal it is the count in hundredths: 35 squares is $0.35$.",
    ],
    watch:
      "Name the shaded part, not the unshaded part. The unshaded part is 100 minus the shaded count.",
  },
  "percent-forms-and-parts": {
    goal: "Change among fractions, decimals and percents, and find a whole or a percent from a part.",
    intuition:
      "Percent means “out of 100.” A fraction, a decimal and a percent can name the same amount: $\\frac{1}{4}$, 0.25 and 25%. The whole is the full amount, which is 100%. A part is a piece of it. If you know what percent a part is, you can find 1% and then the whole.",
    senses: { part: "part", whole: "whole", square: "square-shape" },
    noLink: ["change"],
    terms: [
      [
        "part",
        "Here the part is the amount that is some percent of the whole.",
      ],
      ["whole", "As a percent, the whole is $100\\%$."],
    ],
    method: [
      "Fraction to percent: divide the top number by the bottom number, then multiply by 100. Decimal to percent: multiply by 100.",
      "Percent to fraction: write the percent over 100 and simplify.",
      "To find a whole, divide the part by the percent to get 1%, then multiply by 100. To find a percent, divide the part by the whole and multiply by 100.",
    ],
    watch:
      "Keep part and whole in the right order. The percent that 12 is of 48 is $12\\div48$, not $48\\div12$.",
  },
  "independent-dependent-roles": {
    goal: "Name the independent quantity (the one you choose) and the dependent quantity (the one that follows) in a table.",
    intuition:
      "When two quantities are linked, one often decides the other. The quantity you choose or set is called independent. The quantity that follows from it is called dependent, because it depends on the first. Tickets at 5 dollars each: you choose the number of tickets, and the cost follows.",
    senses: { square: "square-shape", side: "side" },
    terms: ["independent-variable", "dependent-variable"],
    method: [
      "Ask: which quantity do I choose, and which one then follows from it?",
      "The one that follows is dependent. The one it follows from is independent.",
      "On a graph, the independent quantity goes on the horizontal axis, the line across the bottom.",
    ],
    watch:
      "The first column of a table is not always the independent one, and the larger numbers do not decide the roles. Ask which quantity depends on the other.",
  },
  "expression-or-equation": {
    goal: "Tell an expression (a math phrase with no equals sign) from an equation (a math sentence with one) in numbers, letters or words.",
    intuition:
      "An expression is a math phrase that names an amount, like $3x + 5$, where $3x$ means 3 times $x$. An equation is a math sentence that says two amounts are equal, like $3x + 5 = 20$. So an equation has an equals sign, or in words “is” or “equals” joining two amounts.",
    senses: { "more than": "more-than", product: "product-multiply" },
    terms: ["expression", "equation"],
    method: [
      "Look for an equals sign, or for a word such as “is” or “equals” joining two amounts.",
      "With one, it is an equation. Without one, it is an expression.",
      "An equation can also be false, such as $2+2=5$; it is still an equation.",
    ],
    watch:
      "A letter does not make an equation. $3x+5$ has a letter and is an expression; $3+5=8$ has none and is an equation.",
  },
  "rational-area-volume-equation": {
    goal: "Write the equation for the area or volume of a shape whose measures are fractions, with one measure unknown.",
    intuition:
      "A formula is a rule that gives an area or volume from a shape's measures, such as area of a rectangle = length × width. A formula is already an equation. Put the known measures and the given total into it, and keep a letter for the unknown measure. Fractions go in just like whole numbers.",
    senses: {
      edge: "edge",
      face: "face-solid",
      factor: "factor-number",
      side: "side",
    },
    noLink: ["base", "change", "rule"],
    terms: [
      [
        "length",
        "A rational dimension is a length written as a fraction or mixed number, such as $2\\tfrac{1}{2}$ feet.",
      ],
    ],
    method: [
      "Write the formula: triangle area $\\tfrac12bh$ (half of base times height), rectangle area $lw$ (length times width), box volume $lwh$.",
      "Replace the known measures and the area or volume with the given numbers.",
      "Leave the unknown as a letter. Do not change the operations to make the numbers easier.",
    ],
    watch:
      "A triangle is half of a rectangle, so its equation keeps the $\\tfrac12$. Volume multiplies all three edge lengths; surface area adds the areas of the faces.",
  },
  "categorical-summary": {
    goal: "Find the mode, a relative frequency as a percent, and a category count from a percent bar.",
    intuition:
      "Categorical data sorts items into categories. The mode is the most common category; a relative frequency is a category's share of all the items.",
    terms: ["mode-statistics", "relative-frequency"],
    method: [
      "For the mode, compare the counts and choose the category with the greatest one.",
      "For a relative frequency, divide the count by the total and multiply by 100.",
      "For a count from a percent bar, take that percent of the total.",
    ],
    watch:
      "The mode is a category, not a count. The first category listed is not the mode unless it has the greatest count.",
  },
  "check-register-balance": {
    goal: "Find a running balance or a missing amount in a check register with deposits, checks, transfers and fees.",
    intuition:
      "A check register is a table that tracks a bank account in order. The balance is the money in the account right now. A deposit puts money in, so add it. A check, a transfer out or a fee takes money out, so subtract it. Each new balance is the one just above it, plus or minus the entry.",
    senses: {
      balance: "balance-account",
      difference: "difference-subtract",
      change: "change",
    },
    terms: ["balance-account", "deposit"],
    method: [
      "Start from the balance at the top.",
      "For each entry in order, add a deposit and subtract a check, transfer or fee. The result is the next balance.",
      "To find a missing amount, find the difference between the balance before and after the entry.",
    ],
    watch:
      "Line up the decimal points, and subtract payments, do not add them. Each row starts from the balance just above it, not from the first balance.",
  },
  "lifetime-income-salary": {
    goal: "Find total earnings over a career from a yearly or monthly pay and a number of years, or compare two salaries.",
    intuition:
      "A salary is the pay for one year of work, and a career is all the years a person works. If the pay is the same every year, total earnings are the yearly pay times the number of years. Monthly pay times 12 gives yearly pay. A small difference in yearly pay becomes a large difference over many years.",
    senses: { difference: "difference-subtract" },
    noLink: ["change", "period", "periods"],
    terms: [
      ["income", "A salary is a fixed amount of pay for a year of work."],
    ],
    method: [
      "Find the number of years worked: ending age minus starting age.",
      "If the pay is monthly, multiply by 12 for the pay in one year.",
      "Multiply the yearly pay by the number of years. To compare, subtract the yearly pays first and multiply the difference.",
    ],
    watch:
      "Use the years worked, not the ending age. For monthly pay, change to yearly pay before multiplying by years.",
  },
  "pi-as-ratio": {
    goal: "Describe $\\pi$ as a circle's circumference divided by its diameter, and work it out from a measured circle.",
    intuition:
      "The circumference is the distance around a circle. The diameter is the distance across it through the center, twice the radius. For every circle, circumference divided by diameter is the same number, a little more than 3. That number is called $\\pi$ (pi), about 3.14.",
    senses: { center: "center", "more than": "more-than" },
    noLink: ["scales", "change"],
    terms: ["circumference", "diameter", "pi"],
    method: [
      "Find the diameter. If you are given the radius, double it.",
      "Divide the circumference by the diameter.",
      "Round as asked. Every circle gives about $3.14$, however large it is.",
    ],
    watch:
      "Dividing the circumference by the radius gives about $6.28$, which is $2\\pi$. The ratio $\\pi$ uses the diameter.",
  },
  "experimental-probability-predict": {
    goal: "Find an experimental probability from trials, predict counts for more trials, and compare with the counts theory expects.",
    intuition:
      "A trial is one try of an experiment, such as one spin. The experimental probability of an event is the number of times it happened divided by the number of trials. Use it to predict: multiply it by a new number of trials. The theoretical probability is what the setup says should happen, such as $\\frac{1}{2}$ for heads on a fair coin.",
    senses: { trial: "trial", event: "event" },
    noLink: ["scale", "side"],
    terms: ["experimental-probability", "theoretical-probability"],
    method: [
      "Experimental probability is the number of times the event happened divided by the number of trials.",
      "To predict, multiply the observed count by how many times as many trials there will be.",
      "To compare, multiply the theoretical probability by the number of trials, then subtract that from the observed count.",
    ],
    watch:
      "A few trials can be far from the true probability just by chance. More trials usually give an experimental probability closer to it.",
  },
  "cylinder-prism-surface-area": {
    goal: "Find the curved or total surface area of a cylinder using $\\pi$, a missing height, or a triangular prism's surface area.",
    intuition:
      "Surface area is the total area of a solid's outside. A cylinder, a can shape, unrolls into two circles (its bases) and one rectangle (the curved part). For radius $r$, each circle has area $\\pi r^2$ ($\\pi$ times $r$ times $r$). The rectangle is as wide as the distance around, $2\\pi r$. A triangular prism has two triangles and three rectangles.",
    senses: { base: "base-shape", face: "face-solid", solid: "solid-shape" },
    noLink: ["side", "square", "terms", "parts", "part"],
    terms: ["lateral-area", "surface-area"],
    method: [
      "Cylinder: the curved part unrolls to a rectangle $2\\pi r$ wide and $h$ tall, so its area is $2\\pi rh$. Each base has area $\\pi r^2$.",
      "Triangular prism: add the two triangles to the three rectangles. Each rectangle is one triangle side times the prism's length.",
      "To find a missing height, subtract the two bases from the total, then divide by $2\\pi r$.",
    ],
    watch:
      "A cylinder has two bases. The lateral area, the curved part only, has none, and the rectangle's width is the circumference, not the radius.",
  },
  "both-sides-situation-equation": {
    goal: "Write an equation or inequality for two situations that each have a starting amount and a rate.",
    intuition:
      "Each situation's total is an expression: its starting amount, plus or minus its rate times the variable. For 20 dollars to join and 5 dollars a visit, $v$ visits cost $20 + 5v$ ($5v$ means 5 times $v$). Setting two totals equal, or comparing them with $<$ (less than) or $>$ (greater than), puts the variable on both sides.",
    senses: {
      side: "side-of-equation",
      unit: "unit",
      increasing: "increasing",
      decreasing: "decreasing",
      "more than": "more-than",
    },
    noLink: ["changes"],
    terms: ["rate"],
    method: [
      "Write each situation as its starting amount, then plus (if increasing) or minus (if decreasing) its rate times the variable.",
      "Join the two expressions with $=$ for equal, or with $<$ or $>$ for less than or more than.",
      "Keep each starting amount with its own rate. Do not combine fees and rates.",
    ],
    watch:
      "“Less than” is $<$, which does not include equal. Put each rate with its own plan, and subtract when the amount is decreasing.",
  },
};

export const texas38Principles: Record<string, string> = {
  "times-as-many-comparison":
    'For positive whole numbers $a$ and $b$, the statement "$a$ has $k$ times as many as $b$" means $a=k\\times b$. When $b$ divides $a$, the number of times is $k=a\\div b$. Comparison by difference, $a-b$, is a different statement.',
  "situation-pair-table":
    "A relationship in which each output is $p$ times its input has pairs $(x,px)$, so the output is found by multiplication and the input by division. A fixed gap $g$ has pairs $(x,x+g)$, found by adding and by subtracting $g$.",
  "story-equation-choice":
    "A joining story with parts $a$ and $b$ and total $c$ is represented by $a+b=c$ and by $c-b=a$. Whichever amount is unknown can be written as a letter, and an equation is correct when the story's reading of it is true.",
  "strip-diagram-equation":
    "A strip diagram expresses a whole as the sum of its parts, and $k$ equal parts of size $p$ as $k\\times p$. Subtracting a part first and then sharing equally into $k$ parts is $(T-c)\\div k$, with the subtraction grouped.",
  "division-area-model":
    "If a rectangle has height $h$ and width $w$, its area is $hw$. If the area splits into parts $A_1,A_2,\\ldots$, the width splits into $A_1/h,A_2/h,\\ldots$, and $\\dfrac{A_1+A_2+\\cdots}{h}=\\dfrac{A_1}{h}+\\dfrac{A_2}{h}+\\cdots$.",
  "fraction-benchmark-reasonable":
    "If each fraction is within $\\tfrac18$ of a benchmark, the sum or difference of the benchmarks is within $\\tfrac14$ of the exact value. For fractions with a common denominator $d$, $\\tfrac ad+\\tfrac cd=\\tfrac{a+c}{d}$, not $\\tfrac{a+c}{2d}$.",
  "unit-relative-size":
    "If one unit is larger than another, an amount measured in the larger unit has a smaller number: when $1\\text{ large}=k\\text{ small}$ with $k>1$, an amount of $n$ large units is $kn$ small units.",
  "decimal-area-model":
    "A square of side 1 has area 1. A rectangle $\\frac{a}{10}$ tall and $\\frac{b}{10}$ wide has area $\\frac{ab}{100}$. If the area $A$ and one side $d$ are known, the other side is $A\\div d$, since $d\\times(A\\div d)=A$.",
  "number-set-venn":
    "Write $\\mathbb N$, $\\mathbb W$, $\\mathbb Z$ and $\\mathbb Q$ for the natural numbers, whole numbers, integers and rational numbers. Each is a subset of the next (every member of one is in the next): $\\mathbb N\\subset\\mathbb W\\subset\\mathbb Z\\subset\\mathbb Q$. An integer $n$ is rational because $n=n/1$. A number such as $12/4$ is named by its simplified value, so it belongs to the smallest set holding that value.",
  "reciprocal-division-choice":
    "For nonzero $b$ and $c$, $\\dfrac{a}{b}\\div\\dfrac{c}{d}=\\dfrac{a}{b}\\times\\dfrac{d}{c}$, because multiplying a number by $\\dfrac{c}{d}\\cdot\\dfrac{d}{c}=1$ does not change the quotient.",
  "scaling-direction-choice":
    "For a positive number $N$ and a positive multiplier $m$, $mN<N$ when $m<1$, $mN=N$ when $m=1$, and $mN>N$ when $m>1$.",
  "percent-grid-model":
    "A 10 by 10 grid has 100 equal squares. If $k$ of them are shaded, the shaded part is $\\tfrac{k}{100}=k\\%=k\\times0.01$ of the whole grid.",
  "percent-forms-and-parts":
    "For a percent $p$, $p\\%=\\tfrac{p}{100}$. If a part $P$ is $p\\%$ of a whole $W$, then $P=\\tfrac{p}{100}\\times W$. So $W=\\dfrac{100P}{p}$ when $p$ is not 0, and $p=\\dfrac{100P}{W}$ when $W$ is not 0.",
  "independent-dependent-roles":
    "When each value of the independent quantity gives exactly one value of the dependent quantity, the relationship is a function. By agreement, the independent quantity is shown on the horizontal axis and the dependent quantity on the vertical axis.",
  "expression-or-equation":
    "An expression is built from numbers, variables (letters that stand for numbers) and operations. An equation is a statement $E_1=E_2$ that two expressions $E_1$ and $E_2$ are equal. It may be true, false, or true only for some values of its variables.",
  "rational-area-volume-equation":
    "Area of a triangle $=\\tfrac12bh$ (base $b$, height $h$); area of a rectangle $=lw$ (length $l$, width $w$); volume of a rectangular prism $=lwh$. These equations hold for fraction lengths too, and an unknown measure is found by undoing the multiplication.",
  "categorical-summary":
    "For categorical data the mode is the category with the greatest frequency. The relative frequency of a category is its frequency divided by the total, and $p\\%$ of a total $N$ is $\\tfrac{p}{100}N$.",
  "check-register-balance":
    "If the balance before an entry is $B$ dollars and the entry is $x$ dollars, the new balance is $B+x$ for a deposit and $B-x$ for a payment. So the change in balance across an entry is its amount with a sign: plus for money in, minus for money out.",
  "lifetime-income-salary":
    "With the same pay $S$ each year for $y$ years, total earnings are $S\\times y$. With a monthly pay $M$, a year earns $12M$ ($12$ times $M$), so $y$ years earn $12\\times M\\times y$. Two constant yearly salaries $S_1$ and $S_2$ differ over $y$ years by $y\\times(S_2-S_1)$.",
  "pi-as-ratio":
    "For every circle, the circumference $C$ divided by the diameter $d$ is the same number: $\\dfrac{C}{d}=\\pi\\approx3.14159$ ($\\approx$ means “is about”). So $C=\\pi d=2\\pi r$, where $r$ is the radius. Because the ratio is the same for all circles, enlarging a circle multiplies $C$ and $d$ by the same number.",
  "experimental-probability-predict":
    "If an event happens $s$ times in $n$ trials, its experimental probability is $s\\div n$. A prediction for $N$ trials is $N\\times s\\div n$. As $n$ grows, the experimental probability tends to get closer to the theoretical probability (this is called the law of large numbers).",
  "cylinder-prism-surface-area":
    "A cylinder of radius $r$ and height $h$ has lateral area $2\\pi rh$ and total surface area $2\\pi r^2+2\\pi rh$. A right triangular prism whose triangles have legs $p$ and $q$ and longest side $c$, with length $L$, has total surface area $2\\times\\tfrac12pq+(p+q+c)L$.",
  "both-sides-situation-equation":
    "A quantity with starting amount $a$ that changes by $r$ for each unit has value $a+rx$ after $x$ units, with $r$ negative for a decreasing quantity. Two such quantities are equal when $a_1+r_1x=a_2+r_2x$, and the first is less when $a_1+r_1x<a_2+r_2x$. The small 1 and 2 label the two situations.",
};

type L = Lesson;
const lesson = (l: L): L => l;

export const texas38Lessons: Lesson[] = [
  lesson({
    id: "times-as-many",
    title: "Times as many",
    summary:
      '"Times as many" compares two amounts with equal groups. $3\\times24$ is $3$ times as many as $24$.',
    templateIds: ["times-as-many-comparison"],
    objectives: [
      "Say what a product such as $3\\times24$ means as a comparison.",
      "Write the product for a times-as-many sentence and find how many times as many one count is as another.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Equal copies of the amount you compare with",
        paragraphs: [
          "Ana has 24 stickers. If Ben has 3 times as many, Ben has 3 equal groups of 24. That is $3\\times24=72$ stickers.",
          'This is a different comparison from "3 more", which adds 3 to 24. "Times as many" counts how many equal copies of the smaller amount make the larger amount.',
        ],
      },
    ],
    workedExample: {
      prompt:
        'Ava has 5 shells and Ben has 20 shells. Write a sentence that compares them with "times as many".',
      steps: [
        "Ask how many groups of 5 make 20: $20\\div5=4$, because $4\\times5=20$.",
        "Ben's amount is 4 copies of Ava's amount.",
      ],
      answer: "Ben has 4 times as many shells as Ava.",
    },
    closingSections: [
      {
        stage: "method",
        title: "Which amount is copied",
        paragraphs: [
          'The amount after "as many ... as" is the one that is copied. The number before "times" says how many copies.',
          "To compare two counts, divide the larger by the smaller. The quotient is the number of times as many.",
        ],
      },
      {
        stage: "formal",
        title: "Multiplication and division",
        paragraphs: [
          '"$a$ is $k$ times as many as $b$" means $a=k\\times b$. Dividing both sides by $b$ gives $k=a\\div b$.',
        ],
      },
    ],
    pitfalls: [
      '"4 times as many" is not "4 more". Subtracting finds how many more, not how many times.',
      "Say which amount is larger. Reversing the names reverses the comparison.",
    ],
    parentGuide:
      "Use two piles of objects. Ask how many groups of the small pile fit in the large pile, and say the sentence aloud.",
  }),
  lesson({
    id: "situation-tables",
    title: "Tables of number pairs from a situation",
    summary:
      "A table lists matching amounts. The situation gives the rule, and the rule fills the table in.",
    templateIds: ["situation-pair-table"],
    objectives: [
      "Find the rule from a situation and a row of a table.",
      "Complete a table forward and backward, and find the rate in one row.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "One rule for every row",
        paragraphs: [
          "Each box holds 6 pencils. One box has 6 pencils, 2 boxes have 12 and 3 boxes have 18. Each row of the table is a pair: the number of boxes and the number of pencils.",
          "The same rule works for every row: multiply the number of boxes by 6.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "Each box holds 6 pencils. The table shows 1 box has 6 pencils, 2 boxes have 12 and 3 boxes have 18. How many pencils are in 8 boxes?",
      steps: [
        "Check the rule on a row: $3\\times6=18$.",
        "Use it for 8 boxes: $8\\times6=48$.",
      ],
      answer: "48 pencils",
    },
    closingSections: [
      {
        stage: "method",
        title: "Forward, backward and a gap",
        paragraphs: [
          "Forward: apply the rule to the input. Backward: undo the rule, so divide for equal groups. If the situation is a fixed gap, such as 7 years older, add the gap to go forward and subtract it to go back.",
          "The rate is the output for one input. Divide any row's output by its input to find it.",
        ],
      },
      {
        stage: "formal",
        title: "Two kinds of rule",
        paragraphs: [
          "Equal groups give pairs $(x,px)$. A fixed gap gives pairs $(x,x+g)$.",
        ],
      },
    ],
    pitfalls: [
      "Do not add a rate where a fixed amount is the rule: ages differ by the same amount, not the same ratio.",
      "Check the rule on at least one visible row before using it.",
    ],
    parentGuide:
      "Make a table from a real situation, such as the cost of several snacks, and have the learner predict a row you have not written.",
  }),
  lesson({
    id: "story-equations-strips",
    title: "Equations and strip diagrams for stories",
    summary:
      "An equation with a letter for the unknown, or a strip diagram, shows how the amounts in a story fit together.",
    templateIds: ["story-equation-choice", "strip-diagram-equation"],
    objectives: [
      "Choose an equation with a letter that matches a one-step or two-step story.",
      "Read a strip diagram and choose the equation, including repeated equal parts and parts removed before sharing.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Say the story in numbers",
        paragraphs: [
          "Ana has 346 stickers and gets 128 more. The total is the unknown, $n$. Getting more joins amounts, so $346+128=n$.",
          "A strip diagram draws the same story: a bar for the whole and bars for the parts, which together match the whole. Equal bars become one product.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "Dev packs 4 bags with 6 marbles each and adds 3 loose marbles. A strip diagram shows 4 bars of 6 and one bar of 3 under a bar $n$. Write the equation.",
      steps: [
        "The 4 equal bars of 6 make $4\\times6$.",
        "The loose marbles are one more part, so they are added.",
      ],
      answer: "$n=4\\times6+3$",
    },
    closingSections: [
      {
        stage: "method",
        title: "Total, parts and order",
        paragraphs: [
          "Decide which amount is the total and which are parts. If the unknown is the start, write $n$ first: $n-b=c$ for giving away, $n+b=c$ for getting more.",
          "When a part is removed before sharing, write the removal in parentheses: $(T-c)\\div a=n$.",
        ],
      },
      {
        stage: "formal",
        title: "Equivalent equations",
        paragraphs: [
          "$a+b=n$ and $n-b=a$ have the same solution, so either represents a joining story. An equation is correct when reading it back gives the story.",
        ],
      },
    ],
    pitfalls: [
      "Do not choose an equation by the order of the numbers in the story. Read what happens to the unknown.",
      "Equal bars are multiplied. Adding $4+6$ does not count 4 bars of 6.",
    ],
    parentGuide:
      "Ask the learner to make up a story for an equation such as $n-120=340$ and say what $n$ stands for.",
  }),
  lesson({
    id: "division-area-models",
    title: "Division as an area model",
    summary:
      "A rectangle's area is height times width, so dividing the area by the height gives the width.",
    templateIds: ["division-area-model"],
    objectives: [
      "Write an area equation with an unknown width for a division.",
      "Find the quotient by dividing each part of the area by the height and adding.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "The quotient is a missing side",
        paragraphs: [
          "A rectangle is 4 units tall and has an area of 1,248 square units. Its width $w$ satisfies $4\\times w=1{,}248$. Finding $w$ is the division $1{,}248\\div4$.",
          "Split the area into easy parts, such as 800, 400 and 48. Each part's width is its area divided by 4. The widths add to the whole width.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A rectangle 4 units tall has an area of 1,248, split into 800, 400 and 48. Find the quotient.",
      steps: [
        "$800\\div4=200$, $400\\div4=100$ and $48\\div4=12$.",
        "$200+100+12=312$.",
      ],
      answer: "$1{,}248\\div4=312$",
    },
    closingSections: [
      {
        stage: "method",
        title: "Divide every part",
        paragraphs: [
          "Divide each part by the height, not just the first. Add the widths for the quotient. Check by multiplying the quotient by the height.",
        ],
      },
      {
        stage: "formal",
        title: "Why the parts add",
        paragraphs: [
          "$\\dfrac{A_1+A_2+A_3}{h}=\\dfrac{A_1}{h}+\\dfrac{A_2}{h}+\\dfrac{A_3}{h}$, because dividing by $h$ distributes over a sum.",
        ],
      },
    ],
    pitfalls: [
      "Adding the areas gives back the dividend, not the quotient.",
      "Watch the place value of each width: $400\\div4$ is 100, not 10.",
    ],
    parentGuide:
      "Draw a rectangle on paper, label its height, and have the learner split the area into parts that divide easily.",
  }),
  lesson({
    id: "fraction-benchmarks",
    title: "Benchmarks for fraction sums and differences",
    summary:
      "Compare each fraction with 0, $\\tfrac14$, $\\tfrac12$, $\\tfrac34$ and 1 to estimate an answer and check that it is reasonable.",
    templateIds: ["fraction-benchmark-reasonable"],
    objectives: [
      "Choose the benchmark nearest a fraction.",
      "Estimate a sum or difference and judge whether an answer is reasonable.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Round to easy fractions",
        paragraphs: [
          "A benchmark is an easy fraction to compare with: $0$, $\\tfrac14$, $\\tfrac12$, $\\tfrac34$ and $1$. Each fraction is closest to one of them. $\\tfrac{5}{12}$ is a little less than $\\tfrac12$, so its nearest benchmark is $\\tfrac12$.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A student says $\\tfrac{5}{12}+\\tfrac{6}{12}=\\tfrac{11}{24}$. Is that reasonable?",
      steps: [
        "$\\tfrac{5}{12}$ is near $\\tfrac12$ and $\\tfrac{6}{12}$ equals $\\tfrac12$, so the sum is about $1$.",
        "$\\tfrac{11}{24}$ is less than $\\tfrac12$, which is far from $1$.",
      ],
      answer:
        "Not reasonable. Fractions with the same denominator add by their numerators: $\\tfrac{11}{12}$.",
    },
    closingSections: [
      {
        stage: "method",
        title: "Estimate, then compare",
        paragraphs: [
          "Replace each fraction by its nearest benchmark and add or subtract. An exact or proposed answer should be close to the estimate; if not, look for a mistake.",
        ],
      },
      {
        stage: "formal",
        title: "Like denominators",
        paragraphs: [
          "$\\dfrac ad+\\dfrac cd=\\dfrac{a+c}{d}$. The denominator names the size of the parts, so it does not change when parts are counted together.",
        ],
      },
    ],
    pitfalls: [
      "Do not add denominators. Two halves are not four fourths of a different size.",
      "A fraction exactly halfway between two benchmarks needs a closer look at which direction you round.",
    ],
    parentGuide:
      "Pick two fractions with the same denominator and have the learner estimate their sum on a number line before calculating.",
  }),
  lesson({
    id: "unit-sizes",
    title: "How big is a unit?",
    summary:
      "A larger unit covers more, so measuring the same amount takes fewer of them.",
    templateIds: ["unit-relative-size"],
    objectives: [
      "Order customary and metric units by size.",
      "Say which measurement of the same amount has the greater number.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Big unit, small number",
        paragraphs: [
          "A meter is much longer than a centimeter. A ribbon that is 2 meters long is 200 centimeters long. The smaller unit needs a greater number to cover the same length.",
          "Customary units follow the same idea: it takes more cups than gallons to fill a tub.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A pitcher holds 2 quarts. Is the number greater in quarts or in cups?",
      steps: [
        "A cup is smaller than a quart, since it takes 4 cups to fill 1 quart.",
        "So 2 quarts is 8 cups, and the measurement in cups has the greater number.",
      ],
      answer: "The measurement in cups",
    },
    closingSections: [
      {
        stage: "method",
        title: "Picture each unit",
        paragraphs: [
          "Picture an object for each unit to decide which is larger: a centimeter is a fingertip width, a meter is about a door knob's height, a kilometer is a short walk.",
        ],
      },
      {
        stage: "formal",
        title: "Counts and sizes",
        paragraphs: [
          "If $1$ large unit equals $k$ small units with $k>1$, then $n$ large units equal $kn$ small units, so the number of small units is greater.",
        ],
      },
    ],
    pitfalls: [
      "A long name does not mean a large unit.",
      "A meter and a yard are close in size; a meter is slightly longer.",
    ],
    parentGuide:
      "Measure the same table with a ruler in inches and in centimeters and talk about why the numbers differ.",
  }),
  lesson({
    id: "decimal-area-models",
    title: "Decimal products and quotients with area",
    summary:
      "On a 10 by 10 square of 1 whole, a tenths-by-tenths rectangle covers hundredths. Area also gives the missing side of a quotient.",
    templateIds: ["decimal-area-model"],
    objectives: [
      "Find a decimal product from a shaded rectangle on a hundredths square.",
      "Use an area model to divide a decimal by a whole number.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "A tenth of a tenth",
        paragraphs: [
          "Cut a square into 10 rows and 10 columns. Each small square is one hundredth of the whole. A shaded rectangle that is 4 rows tall and 6 columns wide covers $4\\times6=24$ small squares, so $0.4\\times0.6=0.24$.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "An area model shows a rectangle with area 2.4 and width 8. Find its height.",
      steps: [
        "$2.4$ is 24 tenths. Share 24 tenths across 8 columns: $24\\div8=3$ tenths.",
        "That is $0.3$. Check: $8\\times0.3=2.4$.",
      ],
      answer: "0.3",
    },
    closingSections: [
      {
        stage: "method",
        title: "Count, then name the unit",
        paragraphs: [
          "For a product, multiply the counts of rows and columns, then name the result in hundredths. For a quotient, change the area to tenths or hundredths, divide the count by the width, and keep the same unit.",
        ],
      },
      {
        stage: "formal",
        title: "Place value of a product",
        paragraphs: [
          "$\\dfrac{a}{10}\\times\\dfrac{b}{10}=\\dfrac{ab}{100}$, so a product of two tenths has two decimal places.",
        ],
      },
    ],
    pitfalls: [
      "$0.4\\times0.6$ is not $2.4$. The product is smaller than either factor because both are less than 1.",
      "Keep the unit when dividing: 24 tenths divided by 8 is 3 tenths, not 3.",
    ],
    parentGuide:
      "Draw a 10 by 10 square on grid paper and have the learner shade a rectangle for a product such as $0.5\\times0.7$.",
  }),
  lesson({
    id: "nested-number-sets",
    title: "Nested sets of numbers",
    summary:
      "Numbers come in families, and each family fits inside a bigger one. The counting numbers 1, 2, 3, … are the natural numbers. Add 0 and you get the whole numbers. Add the negatives, like $-3$, and you get the integers. Add fractions and decimals, like $\\frac{1}{2}$ and 0.75, and you get the rational numbers. To place a number, simplify it first: $12/4$ is 3, a natural number.",
    noLink: ["whole", "sort", "mean"],
    templateIds: ["number-set-venn"],
    objectives: [
      "Place a number in the right ring of a diagram of sets inside sets.",
      "Name the smallest set that holds a number, and decide whether statements like “every integer is rational” are true.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Each set holds the one before it",
        paragraphs: [
          "A set is a group of numbers that belong together. Picture it as a ring with the numbers inside.",
          "The natural numbers are the counting numbers 1, 2, 3, and so on. The three dots … mean “keep going the same way.”",
          "The whole numbers are the natural numbers plus 0: 0, 1, 2, 3, ….",
          "The integers are the whole numbers plus their negatives, the numbers less than 0: …, −2, −1, 0, 1, 2, ….",
          "The rational numbers are all numbers that can be written as a fraction of two integers, with a bottom that is not 0. That includes $\\frac{3}{4}$, 0.5 (which is $\\frac{1}{2}$) and $-\\frac{7}{2}$.",
          "Each set grows from the one before, so the rings sit one inside another. A natural number like 5 is also whole, an integer and rational. It is in its own ring and every ring around it.",
        ],
      },
    ],
    workedExample: {
      prompt: "Which is the smallest set that contains $-9/3$?",
      steps: [
        "Simplify first, because a fraction can equal an integer. The slash / means divide: $-9/3 = -9 \\div 3 = -3$.",
        "Check the rings from the inside out. $-3$ is not a counting number, so it is not natural. It is negative, so it is not whole.",
        "It is a negative whole-number amount, so it is an integer. The smallest set that holds it is the integers.",
      ],
      answer: "Integers",
    },
    closingSections: [
      {
        stage: "method",
        title: "Simplify, then move outward",
        paragraphs: [
          "Write the number in simplest form. Then check the sets from the smallest ring outward: natural, whole, integer, rational. Stop at the first one that holds it.",
          "A statement “every $X$ is a $Y$” is true when the ring for $X$ sits inside the ring for $Y$. “Every whole number is an integer” is true. “Every integer is a whole number” is false, because $-1$ is an integer but not whole.",
        ],
      },
      {
        stage: "formal",
        title: "Subsets",
        paragraphs: [
          "Set $X$ is a subset of set $Y$ when every member of $X$ is also in $Y$. We write $X \\subset Y$.",
          "Mathematicians name the sets with letters: $\\mathbb N$ for natural numbers, $\\mathbb W$ for whole numbers, $\\mathbb Z$ for integers and $\\mathbb Q$ for rational numbers. Then $\\mathbb N \\subset \\mathbb W \\subset \\mathbb Z \\subset \\mathbb Q$.",
          "“Every $X$ is a $Y$” is true exactly when $X$ is a subset of $Y$. Every integer $n$ is rational, because $n = n/1$.",
        ],
      },
    ],
    pitfalls: [
      "Zero is a whole number but not a natural number.",
      "A fraction can be an integer: $12/4 = 3$. Simplify before you place it.",
      "Negative integers are not whole numbers.",
    ],
    parentGuide:
      "Write numbers such as 0, 7, $-2$ and 0.5 on cards. Draw four rings inside each other on paper, and have the learner put each card in its smallest ring.",
  }),
  lesson({
    id: "fraction-scaling-reciprocals",
    title: "Multiplying and dividing by fractions",
    summary:
      "Multiplying by a number less than 1 shrinks, and dividing by a fraction multiplies by its reciprocal.",
    templateIds: ["reciprocal-division-choice", "scaling-direction-choice"],
    objectives: [
      "Choose the multiplication that equals a division by a fraction or whole number.",
      "Decide whether a product is greater or less than the starting number without computing.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "How many groups fit, and how big a copy is",
        paragraphs: [
          "$\\tfrac34\\times12$ takes three fourths of 12, which is less than 12. A multiplier less than 1 takes part of the number; a multiplier greater than 1 takes more than one copy.",
          "$8\\div\\tfrac23$ asks how many groups of $\\tfrac23$ fit in 8. Each whole holds $\\tfrac32$ such groups, so the answer is $8\\times\\tfrac32$.",
        ],
      },
    ],
    workedExample: {
      prompt: "Write $8\\div\\tfrac23$ as a multiplication.",
      steps: [
        "The divisor is $\\tfrac23$, and its reciprocal is $\\tfrac32$.",
        "Change division to multiplication by the reciprocal.",
      ],
      answer: "$8\\times\\tfrac32$",
    },
    closingSections: [
      {
        stage: "method",
        title: "Flip the divisor, compare with 1",
        paragraphs: [
          "To divide by a fraction, flip only the divisor and multiply. To judge a product, compare the multiplier with 1: less than 1 shrinks, equal to 1 stays, greater than 1 grows.",
        ],
      },
      {
        stage: "formal",
        title: "Reciprocals",
        paragraphs: [
          "$\\dfrac ab\\div\\dfrac cd=\\dfrac ab\\times\\dfrac dc$ for nonzero $b$, $c$ and $d$. For a positive $N$, $mN<N$ if $m<1$ and $mN>N$ if $m>1$.",
        ],
      },
    ],
    pitfalls: [
      "Do not flip the first number. Only the divisor changes.",
      "An improper fraction such as $\\tfrac{8}{3}$ is greater than 1, so multiplying by it makes a number larger.",
    ],
    parentGuide:
      "Ask how many half-cups fit in 3 cups, then write it as $3\\div\\tfrac12$ and as $3\\times2$.",
  }),
  lesson({
    id: "percent-grids-conversions",
    title: "Percent models, conversions and parts",
    summary:
      "Percent means “out of 100,” and the sign % is read “percent.” A grid of 10 rows and 10 columns has 100 small squares. If 35 are shaded, 35% is shaded. The same amount can also be written as a fraction, $\\frac{35}{100}$, or a decimal, 0.35. If you know a part and its percent, you can find the whole: when 30% is 45, 1% is 1.5, so 100% is 150.",
    senses: { part: "part", whole: "whole", square: "square-shape" },
    noLink: ["change"],
    templateIds: ["percent-grid-model", "percent-forms-and-parts"],
    objectives: [
      "Name the percent, fraction and decimal for the shaded part of a 10 by 10 grid.",
      "Change between fractions, decimals and percents.",
      "Find a whole, or a percent, from a part.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "One part, three names",
        paragraphs: [
          "Percent means “out of 100.” So 35% means 35 out of every 100.",
          "A 10 by 10 grid has 100 equal squares, so each square is 1% of the grid. If 35 squares are shaded, the shaded part is 35%. Count full columns of 10 first, then the extra squares.",
          "The same amount has three names. As a fraction it is $\\frac{35}{100}$, which simplifies to $\\frac{7}{20}$ by dividing top and bottom by 5. As a decimal it is 35 hundredths, 0.35. As a percent it is 35%.",
          "To turn a fraction into a percent, divide the top by the bottom, then multiply by 100. For $\\frac{3}{8}$: $3 \\div 8 = 0.375$, and $0.375 \\times 100 = 37.5$, so it is 37.5%.",
          "The whole is the full amount, which is 100%. A part is a piece of it. If a part is 30% of the whole, the whole is bigger than the part.",
        ],
      },
    ],
    workedExample: {
      prompt: "A part of 45 is $30\\%$ of the whole. Find the whole.",
      steps: [
        "30% of the whole is 45. Find 1% by sharing 45 into 30 equal pieces: $45 \\div 30 = 1.5$.",
        "The whole is 100%, so multiply 1% by 100: $1.5 \\times 100 = 150$.",
        "Check: 30% of 150 is $150 \\times 30 \\div 100 = 45$. That is the part we were given.",
      ],
      answer: "150",
    },
    closingSections: [
      {
        stage: "method",
        title: "Convert and find",
        paragraphs: [
          "Decimal to percent: multiply by 100, so 0.6 is 60%. Percent to fraction: put the percent over 100 and simplify, so 60% is $\\frac{60}{100} = \\frac{3}{5}$.",
          "To find a percent: divide the part by the whole, then multiply by 100. 12 out of 48 is $12 \\div 48 = 0.25$, which is 25%.",
          "To find a whole: divide the part by the percent to get 1%, then multiply by 100.",
        ],
      },
      {
        stage: "formal",
        title: "Percent relationships",
        paragraphs: [
          "Let $P$ be a part, $W$ the whole, and $p$ the percent. If $P$ is $p\\%$ of $W$, then $P = \\tfrac{p}{100} \\times W$.",
          "Solving for the other letters gives $W = \\tfrac{100P}{p}$ (when $p$ is not 0) and $p = \\tfrac{100P}{W}$ (when $W$ is not 0). Here $100P$ means 100 times $P$.",
        ],
      },
    ],
    pitfalls: [
      "Name the shaded part, not the part left over. The unshaded part is 100% minus the shaded percent.",
      "Keep part and whole in order: the percent that 12 is of 48 is $12 \\div 48$, not $48 \\div 12$.",
      "A whole found from a part should be bigger than the part when the percent is less than 100%.",
    ],
    parentGuide:
      "Shade squares on a 10 by 10 grid and have the learner say the percent, the fraction and the decimal.",
  }),
  lesson({
    id: "independent-dependent",
    title: "Independent and dependent quantities",
    summary:
      "When two amounts are linked, one often decides the other. The cost of tickets depends on how many tickets you buy. The amount you choose, the number of tickets, is called the independent quantity. The amount that follows from it, the cost, is called the dependent quantity, because it depends on the first.",
    senses: { square: "square-shape", side: "side" },
    templateIds: ["independent-dependent-roles"],
    objectives: [
      "Name the independent quantity (the one you choose) and the dependent quantity (the one that follows) in a table.",
      "Say which quantity goes on the horizontal axis, the left-to-right line, of a graph.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Which quantity determines the other?",
        paragraphs: [
          "A quantity is an amount you can measure or count, such as a cost in dollars or a number of days.",
          "Tickets cost 5 dollars each. You decide how many to buy. Once you choose, the cost is fixed: 3 tickets cost 15 dollars. The number of tickets is the independent quantity, because you choose it freely. The cost is the dependent quantity, because it depends on how many tickets you chose.",
          "A good test is to ask: “Which one do I pick, and which one then follows?” The one that follows is dependent.",
          "Tables and graphs show both. On a graph, the independent quantity goes on the horizontal axis, the line across the bottom. The dependent quantity goes on the vertical axis, the line up the side.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A table shows the height of a plant for each number of days since planting. Which quantity is dependent?",
      steps: [
        "Ask which one you pick. You can choose any day to look at the plant, so the number of days is the independent quantity.",
        "Ask which one follows. The height on that day is settled by how many days the plant has grown. So the height depends on the days.",
      ],
      answer: "The height of the plant",
    },
    closingSections: [
      {
        stage: "method",
        title: "Ask which follows from which",
        paragraphs: [
          "Choose a value for one quantity. If the other is then settled, that other one is dependent.",
          "Do not go by position or size. The first column of a table is not always independent, and the bigger numbers do not decide anything.",
        ],
      },
      {
        stage: "formal",
        title: "Convention",
        paragraphs: [
          "When each value of one quantity gives exactly one value of the other, the relationship is called a function. The first quantity is independent and the second is dependent.",
          "By agreement, the independent quantity is graphed on the horizontal axis and the dependent quantity on the vertical axis.",
        ],
      },
    ],
    pitfalls: [
      "The first column of a table is not always the independent quantity.",
      "Larger numbers do not decide the roles. Ask which quantity depends on the other.",
    ],
    parentGuide:
      "Use daily examples, such as minutes of practice and songs learned. Ask which one the learner can choose, and which one follows.",
  }),
  lesson({
    id: "expressions-and-equations",
    title: "Expressions and equations",
    summary:
      "An expression is a math phrase that names an amount, like $3x + 5$ or $10 - 2$. It has no equals sign. An equation is a math sentence that says two amounts are equal, like $3x + 5 = 20$. It always has an equals sign. An equation can be true or false, and it is still an equation.",
    senses: { "more than": "more-than", product: "product-multiply" },
    templateIds: ["expression-or-equation"],
    objectives: [
      "Tell an expression from an equation when it is written in numbers, in letters or in words.",
      "See that a false statement with an equals sign, such as $2 + 2 = 5$, is still an equation.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "A phrase and a sentence",
        paragraphs: [
          "A variable is a letter, such as $x$, that stands for a number. Writing $3x$ means 3 times $x$.",
          "An expression is like a phrase in English. $3x + 5$ reads “five more than three times a number.” It names an amount, but it does not say anything about it.",
          "An equation is like a full sentence. $3x + 5 = 20$ says “five more than three times a number is 20.” The equals sign = joins two amounts and says they are the same.",
          "In words, look for “is” or “equals” joining two amounts. “Ten minus two” is a phrase. “Ten minus two is eight” is a sentence, an equation.",
          "Letters do not decide it. $3x + 5$ has a letter and is an expression. $3 + 5 = 8$ has no letter and is an equation.",
        ],
      },
    ],
    workedExample: {
      prompt: "Which is an equation: $4y-2$, $4y-2=10$ or $10-2$?",
      steps: [
        "Look for an equals sign, because only an equation has one. $4y - 2$ and $10 - 2$ have none, so each is an expression. Each just names an amount.",
        "$4y - 2 = 10$ has an equals sign joining two amounts. It says $4y - 2$ and 10 are the same, so it is an equation.",
      ],
      answer: "$4y-2=10$",
    },
    closingSections: [
      {
        stage: "method",
        title: "Look for equality",
        paragraphs: [
          "In symbols, look for an equals sign. In words, look for “is” or “equals” joining two amounts. With one, it is an equation. Without one, it is an expression.",
          "An equation can be true, like $3 + 5 = 8$, or false, like $2 + 2 = 5$. Either way it is an equation.",
        ],
      },
      {
        stage: "formal",
        title: "Definitions",
        paragraphs: [
          "An expression is built from numbers, variables and operations, such as adding and multiplying.",
          "An equation states that two expressions are equal. It may be true, false, or true only for some values of its variables.",
        ],
      },
    ],
    pitfalls: [
      "A letter does not make something an equation. Look for the equals sign.",
      "$2+2=5$ is false, but it is still an equation.",
    ],
    parentGuide:
      "Read items aloud. A phrase sounds unfinished. An equation is a complete sentence that says two things are equal.",
  }),
  lesson({
    id: "rational-area-volume-equations",
    title: "Equations for area and volume with fractions",
    summary:
      "A formula is a rule written with letters, such as “area of a rectangle = length × width.” A formula is already an equation. When one measure is unknown, put the numbers you know into the formula and keep a letter for the unknown. Fractions and mixed numbers, like $1\\tfrac{1}{2}$, go in just like whole numbers.",
    senses: {
      edge: "edge",
      face: "face-solid",
      factor: "factor-number",
      side: "side",
      solid: "solid-shape",
    },
    noLink: ["base", "change", "rule"],
    templateIds: ["rational-area-volume-equation"],
    objectives: [
      "Write an equation for a triangle's area, a rectangle's area or a box's volume when the measures are fractions.",
      "Reject equations that add instead of multiply, drop the $\\tfrac{1}{2}$ or use the wrong formula.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "The formula is already an equation",
        paragraphs: [
          "Area is the amount of flat space inside a shape. Volume is the amount of space inside a solid, such as a box. A mixed number, such as $2\\tfrac{1}{2}$, is a whole number and a fraction together: 2 and one half.",
          "Each shape has a formula, a rule that gives its area or volume from its measures. Letters stand for the measures. Writing two letters next to each other, such as $lw$, means multiply them.",
          "A rectangle's area is $lw$: length times width. A triangle's area is $\\tfrac12 bh$: half of the base times the height. The base is the side it sits on, and the height is the straight-up distance to the top corner. A rectangular prism, a box shape, has volume $lwh$: length times width times height.",
          "A formula is already an equation. If a triangle's area is $1\\tfrac{9}{16}$ and its base is $2\\tfrac12$, put those in and keep $h$ for the height: $\\tfrac12 \\times 2\\tfrac12 \\times h = 1\\tfrac{9}{16}$. Fractions do not change the formula.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A rectangle has area $2\\tfrac{1}{4}$ and length $1\\tfrac12$. Write an equation for its width $w$.",
      steps: [
        "Choose the formula. A rectangle's area is its length times its width, $A = lw$.",
        "Put in what is known: the length is $1\\tfrac12$ and the area is $2\\tfrac14$. Keep the letter $w$ for the unknown width, because we do not know it yet. The equation is $1\\tfrac12 \\times w = 2\\tfrac14$.",
      ],
      answer: "$1\\tfrac12\\times w=2\\tfrac14$",
    },
    closingSections: [
      {
        stage: "method",
        title: "Formula, substitute, leave the unknown",
        paragraphs: [
          "Write the formula first. Then substitute, which means put each known number in place of its letter. Put the given area or volume after the equals sign.",
          "Leave the unknown measure as a letter. Do not change the operations to make the numbers easier, and do not solve yet unless asked.",
        ],
      },
      {
        stage: "formal",
        title: "Formulas",
        paragraphs: [
          "Triangle: $A = \\tfrac12 bh$, where $b$ is the base and $h$ is the height. Rectangle: $A = lw$, length times width. Rectangular prism: $V = lwh$, length times width times height.",
          "These formulas work for fraction lengths too. An unknown measure can then be found by undoing the multiplication.",
        ],
      },
    ],
    pitfalls: [
      "A triangle is half of a rectangle, so its equation needs the $\\tfrac12$.",
      "Volume multiplies all three measures. Adding them, or using only two, gives the wrong amount.",
    ],
    parentGuide:
      "Have the learner say the formula in words, such as “length times width,” before writing it with the numbers.",
  }),
  lesson({
    id: "categorical-summaries",
    title: "Summarizing categorical data",
    summary:
      "The mode is the most common category, and a relative frequency is a category's share of the total.",
    templateIds: ["categorical-summary"],
    objectives: [
      "Find the mode from a frequency table.",
      "Find a relative frequency as a percent and a category count from a percent bar.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Most common and share of the whole",
        paragraphs: [
          "A frequency table counts how many items fall in each category. The category with the greatest count is the mode.",
          "A relative frequency compares a count with the total. If 5 of 20 students chose soup, the relative frequency of soup is $\\tfrac{5}{20}=25\\%$.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A percent bar shows 80 students: pizza 40%, tacos 35%, soup 25%. How many chose tacos?",
      steps: ["Tacos is 35% of 80.", "$0.35\\times80=28$."],
      answer: "28 students",
    },
    closingSections: [
      {
        stage: "method",
        title: "Three tasks",
        paragraphs: [
          "Mode: compare the counts. Relative frequency: count $\\div$ total, then $\\times100$. Count from a percent bar: percent $\\times$ total.",
        ],
      },
      {
        stage: "formal",
        title: "Definitions",
        paragraphs: [
          "The relative frequency of a category with count $c$ in a total $N$ is $c/N$. As a percent it is $100c/N$.",
        ],
      },
    ],
    pitfalls: [
      "The mode is a category, not a count.",
      "The first category listed is not the mode unless it has the greatest count.",
    ],
    parentGuide:
      "Survey the family about favorite foods and make a table of counts.",
  }),
  lesson({
    id: "check-registers",
    title: "Balancing a check register",
    summary:
      "A bank account holds money. Its balance is how much money is in it right now. A check register is a table that lists every change to the account in order. Money put in, a deposit, makes the balance go up. Money taken out, such as a check or a fee, makes it go down. Each row's balance is the row before, plus or minus that entry.",
    senses: {
      balance: "balance-account",
      difference: "difference-subtract",
      change: "change",
    },
    templateIds: ["check-register-balance"],
    objectives: [
      "Keep a running balance through deposits, checks, transfers and fees.",
      "Find a missing amount from the balances before and after an entry.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Add what comes in, subtract what goes out",
        paragraphs: [
          "You need to add and subtract decimals. Money amounts have two digits for cents after the point: 38.75 dollars is 38 dollars and 75 cents.",
          "A deposit puts money into the account, so the balance goes up. Add it.",
          "A check is a written note that pays someone from the account. A transfer out moves money to another account. A fee is a charge from the bank. Each one takes money out, so the balance goes down. Subtract it.",
          "The register goes row by row. Each new balance starts from the balance just above it.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "The balance is 245.50. A check for 38.75 is written, then 120.00 is deposited. What is the balance?",
      steps: [
        "A check takes money out, so subtract it. Line up the decimal points: $245.50 - 38.75 = 206.75$.",
        "A deposit puts money in, so add it to the new balance, not the first one: $206.75 + 120.00 = 326.75$.",
      ],
      answer: "326.75 dollars",
    },
    closingSections: [
      {
        stage: "method",
        title: "Go row by row",
        paragraphs: [
          "Start from the balance at the top. Apply each entry in order: add deposits, subtract checks, transfers and fees.",
          "To find a missing amount, compare the balances before and after that row. Subtract the smaller from the larger. If the balance went up, the entry was money in. If it went down, it was money out.",
        ],
      },
      {
        stage: "formal",
        title: "Signed changes",
        paragraphs: [
          "Treat a deposit of $x$ dollars as $+x$ and a payment of $x$ dollars as $-x$. If the balance before is $B$, the new balance is $B + x$ after a deposit and $B - x$ after a payment.",
        ],
      },
    ],
    pitfalls: [
      "Subtract payments; do not add them.",
      "Line up the decimal points. 38.75 has 75 cents, not 7.5.",
      "Start each row from the balance just above it, not from the first balance.",
    ],
    parentGuide:
      "Keep a pretend check register together for a week of allowance and spending.",
  }),
  lesson({
    id: "lifetime-income",
    title: "Income over a career",
    summary:
      "A salary is the pay for one year of work. A career is all the years a person works. If the pay stays the same each year, the total earned is the yearly pay times the number of years. So 62,000 dollars a year for 40 years is 2,480,000 dollars. Even a small difference in yearly pay adds up to a lot over a career.",
    senses: { difference: "difference-subtract" },
    noLink: ["change", "period", "periods", "whole"],
    templateIds: ["lifetime-income-salary"],
    objectives: [
      "Find total career earnings from a yearly or monthly pay and the number of years worked.",
      "Compare two salaries over a whole career.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "The same pay, year after year",
        paragraphs: [
          "You need to multiply and subtract whole numbers. A salary is a fixed amount of pay for one year of work. Some jobs state pay per month instead. There are 12 months in a year, so a year's pay is 12 times the monthly pay.",
          "If someone earns 62,000 dollars every year for 40 years, the total is $62{,}000 \\times 40 = 2{,}480{,}000$ dollars.",
          "Now suppose a second job pays 6,000 dollars more each year. That extra is earned again every year. Over 40 years it adds $6{,}000 \\times 40 = 240{,}000$ dollars.",
          "The number of years worked is the age at the end minus the age at the start. Working from age 22 to age 62 is $62 - 22 = 40$ years.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A person works from age 22 to age 62 and earns 54,000 dollars a year. Find the total earned.",
      steps: [
        "Find the years worked by subtracting the starting age from the ending age: $62 - 22 = 40$ years.",
        "The pay is the same each year, so multiply the yearly pay by the years: $54{,}000 \\times 40 = 2{,}160{,}000$ dollars.",
      ],
      answer: "2,160,000 dollars",
    },
    closingSections: [
      {
        stage: "method",
        title: "Years first, then multiply",
        paragraphs: [
          "Find the years worked: ending age minus starting age.",
          "If the pay is monthly, multiply it by 12 to get the yearly pay.",
          "Multiply the yearly pay by the years. To compare two jobs, subtract the yearly pays first, then multiply that difference by the years.",
        ],
      },
      {
        stage: "formal",
        title: "Constant pay",
        paragraphs: [
          "With the same yearly pay $S$ for $y$ years, total earnings are $S \\times y$.",
          "With a monthly pay $M$, one year is $12M$ ($12$ times $M$), so $y$ years earn $12 \\times M \\times y$.",
          "Two yearly salaries $S_1$ and $S_2$ (read “$S$ one” and “$S$ two”) differ over $y$ years by $y \\times (S_2 - S_1)$.",
        ],
      },
    ],
    pitfalls: [
      "Multiply by the years worked, not by the ending age.",
      "Change monthly pay to yearly pay before multiplying by years.",
    ],
    parentGuide:
      "Compare two job offers together, and talk about what their yearly difference adds up to over 40 years.",
  }),
  lesson({
    id: "pi-ratio",
    title: "The circumference-to-diameter ratio",
    summary:
      "The circumference of a circle is the distance around it. The diameter is the distance straight across it, through the center. For every circle, big or small, the circumference divided by the diameter is the same number, a little more than 3. This number is called $\\pi$ (pi), and it is about 3.14.",
    senses: { center: "center", "more than": "more-than" },
    noLink: ["scales", "change", "edge"],
    templateIds: ["pi-as-ratio"],
    objectives: [
      "Describe $\\pi$ as a circle's circumference divided by its diameter.",
      "Find circumference divided by diameter from measured values, and see that it is about 3.14 for every circle.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "The same ratio for every circle",
        paragraphs: [
          "A circle is a round shape where every point is the same distance from a middle point, the center. The circumference is the distance around the circle. The diameter is the distance across, passing through the center. The radius is the distance from the center to the edge, half the diameter.",
          "Wrap a string around a can to measure its circumference. Then measure straight across the top for the diameter. Divide the circumference by the diameter. You get about 3.14.",
          "Try a tiny coin and then a giant wheel. The numbers you measure are very different, but the division gives the same answer each time. A ratio compares two amounts by dividing. This ratio, the same for every circle, is called $\\pi$ (pi).",
          "$\\pi$ is a little more than 3. So the distance around any circle is a little more than 3 times the distance across.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A lid has a diameter of 8 cm and a circumference of 25.1 cm. Find the ratio to the nearest hundredth.",
      steps: [
        "The ratio is circumference divided by diameter, so divide: $25.1 \\div 8 = 3.1375$.",
        "Round to the nearest hundredth, two places after the point. The next digit after 3.13 is 7, which is 5 or more, so round up to 3.14. That is close to $\\pi$, as it should be.",
      ],
      answer: "3.14",
    },
    closingSections: [
      {
        stage: "method",
        title: "Use the diameter",
        paragraphs: [
          "If you are given the radius, double it to get the diameter. Then divide the circumference by the diameter.",
          "Measured values are never exact, so the answer is close to 3.14 but may not match it perfectly.",
        ],
      },
      {
        stage: "formal",
        title: "Definition",
        paragraphs: [
          "Write $C$ for the circumference, $d$ for the diameter and $r$ for the radius. For every circle, $\\pi = C \\div d$.",
          "So $C = \\pi d$ ($\\pi$ times $d$). Because $d = 2r$, also $C = 2\\pi r$.",
          "$\\pi$ is about 3.14159. Its digits go on forever without repeating.",
        ],
      },
    ],
    pitfalls: [
      "Divide by the diameter, not the radius. Circumference divided by radius is about 6.28, which is $2\\pi$.",
      "Making a circle bigger or smaller does not change the ratio.",
    ],
    parentGuide:
      "Measure a few round objects with string and a ruler. Divide the distance around by the distance across, and compare the answers.",
  }),
  lesson({
    id: "experimental-probability",
    title: "Experimental probability and predictions",
    summary:
      "Probability tells how likely something is. An experimental probability comes from doing an experiment many times. Count how often something happened and divide by the number of tries. A spinner landed on blue 18 times in 60 spins, so the experimental probability of blue is $\\frac{18}{60} = 0.3$. You can use it to predict: in 200 spins, expect about $0.3 \\times 200 = 60$ blues.",
    senses: { trial: "trial", event: "event" },
    noLink: ["scale", "side", "sides"],
    templateIds: ["experimental-probability-predict"],
    objectives: [
      "Find an experimental probability from the results of trials (repeated tries).",
      "Predict a count for more trials, compare it with the count the theory expects, and judge which experiment to trust.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "What happened, and what will happen",
        paragraphs: [
          "You need to work with fractions and decimals. A trial is one try of an experiment, such as one spin of a spinner. An event is the result you are counting, such as landing on blue.",
          "The experimental probability of an event is the number of times it happened divided by the number of trials. Blue 18 times in 60 spins gives $\\frac{18}{60} = 0.3$.",
          "To predict, assume the same share will happen again. In 200 spins, about 0.3 of them should be blue: $0.3 \\times 200 = 60$.",
          "The theoretical probability is what the setup says should happen. A fair coin has 2 equal sides, so heads has theoretical probability $\\frac{1}{2}$. In 40 tosses, theory expects $\\frac{1}{2} \\times 40 = 20$ heads.",
          "Results vary by chance. Few trials can be far from the theoretical probability. Many trials are usually closer to it.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A cup lands on its side 12 times in 40 tosses. Predict how many times it will in 200 tosses.",
      steps: [
        "Compare the numbers of tosses: 200 tosses is $200 \\div 40 = 5$ times as many as 40.",
        "Five times as many tosses should give about five times as many landings on its side: $5 \\times 12 = 60$.",
        "Check another way: the experimental probability is $\\frac{12}{40} = 0.3$, and $0.3 \\times 200 = 60$. The two ways agree.",
      ],
      answer: "About 60 times",
    },
    closingSections: [
      {
        stage: "method",
        title: "Successes over trials, then scale",
        paragraphs: [
          "Divide the number of times the event happened by the number of trials. That is the experimental probability.",
          "To predict for more trials, multiply that probability by the new number of trials. Or multiply the count by how many times as many trials there are.",
          "To compare with theory, multiply the theoretical probability by the number of trials. Then subtract to see how far apart the counts are.",
        ],
      },
      {
        stage: "formal",
        title: "Larger samples",
        paragraphs: [
          "If an event happens $s$ times in $n$ trials, its experimental probability is $s \\div n$. A prediction for $N$ trials is $N \\times s \\div n$.",
          "As the number of trials grows, the experimental probability tends to get closer to the theoretical probability. So an experiment with more trials is usually more trustworthy.",
        ],
      },
    ],
    pitfalls: [
      "A prediction is an estimate, not a promise. Real results vary around it.",
      "A few trials can be far from the true probability. Trust the experiment with more trials.",
      "Divide by the number of trials, not by the number of times something else happened.",
    ],
    parentGuide:
      "Toss a coin 20 times and record the heads. Compare the count with 10, the number theory expects.",
  }),
  lesson({
    id: "cylinder-prism-surface-area",
    title: "Surface area of cylinders and triangular prisms",
    summary:
      "Surface area is the total area of all the outside surfaces of a solid. Area is measured in square units, such as square centimeters. Imagine unrolling a can: the label lays flat as a rectangle, and the top and bottom are circles. Add the areas of those pieces to get the surface area.",
    senses: { base: "base-shape", face: "face-solid", solid: "solid-shape" },
    noLink: [
      "side",
      "square",
      "terms",
      "parts",
      "edge",
      "squared",
      "part",
      "whole",
    ],
    templateIds: ["cylinder-prism-surface-area"],
    objectives: [
      "Find the curved surface area and the total surface area of a cylinder, written using $\\pi$.",
      "Find a cylinder's missing height from its surface area, and the surface area of a triangular prism.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Faces laid flat",
        paragraphs: [
          "A cylinder is a can shape. It has two flat circles, the top and bottom, called its bases. Around them is one curved surface.",
          "The radius $r$ is the distance from the middle of a circle to its edge. The height $h$ is how tall the cylinder is. A circle's area is $\\pi r^2$, where $r^2$ ($r$ squared) means $r$ times $r$. The number $\\pi$ (pi) is about 3.14. The distance around a circle, its circumference, is $2\\pi r$.",
          "Peel the label off a can and lay it flat. It is a rectangle. Its height is the can's height. Its width is the distance around the can, the circumference $2\\pi r$. So the curved part has area $2\\pi r \\times h$. This curved part alone is called the lateral area.",
          "A triangular prism is a solid with two matching triangles at its ends and three rectangles joining them. Its surface area is the two triangles plus the three rectangles.",
          "Answers “in terms of $\\pi$” keep the symbol $\\pi$ instead of using 3.14. For example, $48\\pi$ means 48 times $\\pi$.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A cylinder has radius 3 cm and height 5 cm. Find its total surface area in terms of $\\pi$.",
      steps: [
        "Find the two circular bases. Each has area $\\pi \\times 3^2 = 9\\pi$, so two have $2 \\times \\pi \\times 3^2 = 18\\pi$.",
        "Find the curved part. It unrolls to a rectangle $2\\pi \\times 3$ wide and 5 tall: $2\\pi \\times 3 \\times 5 = 30\\pi$.",
        "Add all the pieces, because surface area covers the whole outside: $18\\pi + 30\\pi = 48\\pi$.",
      ],
      answer: "$48\\pi$ square centimeters",
    },
    closingSections: [
      {
        stage: "method",
        title: "Add the faces",
        paragraphs: [
          "Total surface area of a cylinder: two bases plus the curved part. Lateral area: the curved part only, with no bases.",
          "For a missing height, start from the total. Subtract the two bases to get the curved part. Then divide by the circumference $2\\pi r$.",
          "For a triangular prism, add the areas of the two triangles to the areas of the three rectangles. Each rectangle is one side of the triangle times the prism's length.",
        ],
      },
      {
        stage: "formal",
        title: "Formulas",
        paragraphs: [
          "Cylinder with radius $r$ and height $h$: lateral area $2\\pi rh$, total surface area $2\\pi r^2 + 2\\pi rh$.",
          "Right triangular prism whose triangles have legs $p$ and $q$, longest side $c$, and length $L$: total surface area $pq + (p + q + c)L$. The $pq$ is the two triangles, each $\\tfrac12 pq$.",
        ],
      },
    ],
    pitfalls: [
      "A cylinder has two circular bases. Count both for total surface area, and neither for lateral area.",
      "The rectangle's width is the circumference, $2\\pi r$, not the radius.",
    ],
    parentGuide:
      "Peel the label off a can and lay it flat to see the rectangle. Measure its width and compare it with the distance around the can.",
  }),
  lesson({
    id: "both-sides-situations",
    title: "Equations with a variable on both sides from a situation",
    summary:
      "Two plans can each have a starting amount and a rate, an amount added or taken away each time. Gym A costs 20 dollars to join plus 5 dollars a visit, so $v$ visits cost $20 + 5v$. Gym B costs $8 + 8v$. Writing $20 + 5v = 8 + 8v$ asks when the costs are equal. The letter $v$ appears on both sides of the equals sign.",
    senses: {
      side: "side-of-equation",
      unit: "unit",
      increasing: "increasing",
      decreasing: "decreasing",
      "more than": "more-than",
    },
    noLink: ["changes"],
    templateIds: ["both-sides-situation-equation"],
    objectives: [
      "Write an expression for each situation, then join the two with $=$, $<$ (less than) or $>$ (greater than).",
      "Handle an amount that goes down by subtracting its rate.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Two totals, one variable",
        paragraphs: [
          "A variable is a letter that stands for an unknown number, such as the number of visits $v$. Writing $5v$ means 5 times $v$.",
          "An expression is a math phrase that names an amount. Each plan's total is an expression: its starting amount, plus its rate times the variable.",
          "Gym A charges 20 dollars to join plus 5 dollars a visit: $20 + 5v$. Gym B charges 8 dollars plus 8 dollars a visit: $8 + 8v$.",
          "An equation says two amounts are equal. The costs are the same when $20 + 5v = 8 + 8v$. Now the letter is on both sides of the equals sign.",
          "To compare instead, use an inequality sign. $<$ means “is less than” and $>$ means “is greater than.” Gym A costs less than Gym B when $20 + 5v < 8 + 8v$.",
          "When an amount goes down over time, subtract its rate. A tank with 67 liters that loses 3 liters a minute holds $67 - 3t$ liters after $t$ minutes.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "Tank A has 67 liters and loses 3 liters a minute. Tank B has 11 liters and gains 5 liters a minute. Write the equation for when they hold the same amount.",
      steps: [
        "Let $t$ be the number of minutes. Tank A starts at 67 and loses 3 each minute, so subtract: $67 - 3t$. Tank B starts at 11 and gains 5 each minute, so add: $11 + 5t$.",
        "“The same amount” means equal, so join the two expressions with an equals sign.",
      ],
      answer: "$67-3t=11+5t$",
    },
    closingSections: [
      {
        stage: "method",
        title: "Start, rate, variable",
        paragraphs: [
          "For each situation, write the starting amount, then the rate times the variable. Use + when the amount grows and − when it shrinks.",
          "Join the two expressions: $=$ for “the same,” $<$ for “less than,” $>$ for “more than.”",
          "Keep each starting amount with its own rate. A joining fee is not a rate, so do not add it to the rate.",
        ],
      },
      {
        stage: "formal",
        title: "Linear expressions",
        paragraphs: [
          "A quantity that starts at $a$ and changes by $r$ for each unit has the value $a + rx$ after $x$ units. Here $r$ is negative when the quantity decreases.",
          "Two such quantities are equal when $a_1 + r_1x = a_2 + r_2x$. The small 1 and 2 label the first and second situation. The first is less than the second when $a_1 + r_1x < a_2 + r_2x$.",
        ],
      },
    ],
    pitfalls: [
      "Do not combine a fee and a rate into one number. In $20 + 5v$, the 20 is paid once and the 5 is paid each visit.",
      "“Less than” is $<$, which does not include equal.",
      "Subtract the rate when the amount goes down.",
    ],
    parentGuide:
      "Compare two phone plans or two savings plans. Write each total with a letter, then write when they are equal.",
  }),
];
