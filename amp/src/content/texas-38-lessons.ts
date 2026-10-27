import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

export const texas38Methods: Record<string, ProblemMethod> = {
  "times-as-many-comparison": {
    goal: "Read and write a multiplication as a comparison: how many times as many one amount is as another.",
    intuition:
      'Compare two amounts by asking how many equal copies of the smaller amount make the larger one. That number goes in front of "times as many".',
    terms: [
      [
        "times as many",
        "A comparison by multiplication: $3$ times as many as $24$ means $3$ equal copies of $24$, or $3\\times24$.",
      ],
      [
        "more than",
        "A comparison by addition: $3$ more than $24$ means $24+3$.",
      ],
    ],
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
        "number pair",
        "Two numbers that go together, such as 3 boxes and 24 pencils.",
      ],
      [
        "rule",
        "What you do to the first number of every pair to get the second.",
      ],
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
    terms: [
      [
        "unknown",
        "The amount you are asked to find, written as a letter such as $n$.",
      ],
      [
        "equation",
        "A statement that two quantities are equal, such as $346+128=n$.",
      ],
    ],
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
    terms: [
      [
        "strip diagram",
        "A drawing where a whole is one long bar and its parts are bars that together match its length.",
      ],
      [
        "equal parts",
        "Bars of the same length that all stand for the same amount, such as $4$ bars of $6$, written $4\\times6$.",
      ],
    ],
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
      [
        "area model",
        "A rectangle split into parts whose areas add to the total area.",
      ],
      [
        "partial quotient",
        "The width of one part of the rectangle: that part's area divided by the height.",
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
    terms: [
      [
        "benchmark fraction",
        "A familiar fraction used for comparison: $0$, $\\tfrac14$, $\\tfrac12$, $\\tfrac34$ and $1$.",
      ],
      [
        "estimate",
        "An answer that is close to the exact value, found with easy numbers.",
      ],
    ],
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
    terms: [
      [
        "unit",
        "A fixed amount used for measuring, such as an inch, a meter or a quart.",
      ],
    ],
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
    terms: [
      ["tenth", "One of 10 equal parts of a whole: $0.1$."],
      [
        "hundredth",
        "One of 100 equal parts of a whole: $0.01$. A tenth of a tenth is a hundredth.",
      ],
    ],
    method: [
      "For a product, count the rows and columns of the shaded rectangle and multiply the counts, then write the total as hundredths.",
      "For a quotient, write the area as tenths or hundredths and share that count equally across the width.",
      "Check a quotient by multiplying: width times height equals the area.",
    ],
    watch:
      "$0.4\\times0.6$ is $0.24$, not $2.4$ and not $0.024$. Tenths times tenths are hundredths, so the product has two decimal places.",
  },
  "number-set-venn": {
    goal: "Place numbers in nested sets of natural, whole, integer and rational numbers and judge subset statements.",
    intuition:
      "Each set of numbers contains the one before it. Natural numbers sit inside whole numbers, whole numbers inside integers and integers inside rational numbers.",
    terms: [
      ["natural number", "A counting number: $1, 2, 3, \\ldots$"],
      ["whole number", "A natural number or zero: $0, 1, 2, \\ldots$"],
      [
        "integer",
        "A whole number or the opposite of one: $\\ldots,-2,-1,0,1,2,\\ldots$",
      ],
      [
        "rational number",
        "A number that can be written as a fraction of two integers with a nonzero denominator.",
      ],
    ],
    method: [
      "Simplify first: $12/4$ equals $3$ and $-9/3$ equals $-3$.",
      "Start from the innermost set and move outward until the number fits. The number is in that set and every larger set.",
      'A statement "every $X$ is a $Y$" is true only when the circle for $X$ lies inside the circle for $Y$.',
    ],
    watch:
      "Zero is whole but not natural. Negative numbers are integers but not whole. A fraction that simplifies to an integer is an integer.",
  },
  "reciprocal-division-choice": {
    goal: "Choose the multiplication that equals a division by a fraction or whole number, using the reciprocal.",
    intuition:
      "Dividing by $\\tfrac23$ asks how many groups of $\\tfrac23$ fit. Each whole has $\\tfrac32$ of them, so dividing by $\\tfrac23$ multiplies by $\\tfrac32$.",
    terms: [
      [
        "reciprocal",
        "The number you multiply by to get 1: the reciprocal of $\\tfrac23$ is $\\tfrac32$, and of $5$ is $\\tfrac15$.",
      ],
      ["divisor", "The number you divide by."],
    ],
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
    terms: [
      ["multiplier", "The number you multiply by. It scales the other number."],
    ],
    method: [
      "Compare the multiplier with 1. An improper fraction is greater than 1.",
      "Less than 1 gives a smaller result, equal to 1 gives the same, and greater than 1 gives a larger result.",
      'Say the reason in terms of the multiplier, not the word "fraction".',
    ],
    watch:
      "Multiplication does not always make a number bigger. A fraction can be greater than 1, as in $\\tfrac{8}{3}$, or equal to 1, as in $\\tfrac66$.",
  },
  "percent-grid-model": {
    goal: "Read the percent, fraction or decimal for the shaded part of a 10 by 10 grid.",
    intuition:
      "The grid has 100 equal squares, and percent means out of 100. The number of shaded squares is the percent.",
    terms: [
      ["percent", "A number out of 100: $35\\%$ means $\\tfrac{35}{100}$."],
    ],
    method: [
      "Count shaded squares: full columns of 10, then the extra squares.",
      "The count is the percent. As a fraction it is the count over 100, which can be simplified.",
      "As a decimal it is the count in hundredths: 35 squares is $0.35$.",
    ],
    watch:
      "Name the shaded part, not the unshaded part. The unshaded part is $100$ minus the percent.",
  },
  "percent-forms-and-parts": {
    goal: "Convert among fractions, decimals and percents, and find a whole or a percent from a part.",
    intuition:
      "A percent, a decimal and a fraction can name the same part of a whole. Percent is the version with 100 as the denominator.",
    terms: [
      ["part", "The amount that is some percent of the whole."],
      ["whole", "The full amount, which is $100\\%$."],
    ],
    method: [
      "Fraction to percent: divide the numerator by the denominator and multiply by 100. Decimal to percent: multiply by 100.",
      "Percent to fraction: write the percent over 100 and simplify.",
      "To find a whole, divide the part by the percent to find $1\\%$, then multiply by 100. To find a percent, divide the part by the whole and multiply by 100.",
    ],
    watch:
      "Keep part and whole in the right order. The percent that 12 is of 48 is $12\\div48$, not $48\\div12$.",
  },
  "independent-dependent-roles": {
    goal: "Name the independent and dependent quantity in a table of two related quantities.",
    intuition:
      "In a relationship one quantity determines the other. The quantity you choose or set is independent; the quantity it determines is dependent.",
    terms: [
      [
        "independent quantity",
        "The quantity that is set or chosen. It goes on the horizontal axis of a graph.",
      ],
      [
        "dependent quantity",
        "The quantity whose value is determined by the independent quantity. It goes on the vertical axis.",
      ],
    ],
    method: [
      "Ask: which quantity do I choose, and which one then follows from it?",
      "The one that follows is dependent. The one it follows from is independent.",
      "On a graph, the independent quantity is on the horizontal axis.",
    ],
    watch:
      "The first column of a table is not always the independent one, and the larger numbers do not decide the roles. Ask which quantity determines the other.",
  },
  "expression-or-equation": {
    goal: "Tell an expression from an equation in numeric, algebraic and verbal forms.",
    intuition:
      "An expression is a mathematical phrase that names a value. An equation is a sentence that says two quantities are equal, so it has an equal sign.",
    terms: [
      [
        "expression",
        "A number, a variable, or numbers and variables joined by operations, with no equal sign.",
      ],
      [
        "equation",
        "A statement with an equal sign saying two expressions have the same value.",
      ],
    ],
    method: [
      'Look for an equal sign, or for a word such as "is" or "equals" in a phrase.',
      "With one, it is an equation, true or false. Without one, it is an expression.",
      "An equation can also be false, such as $2+2=5$; it is still an equation.",
    ],
    watch:
      "An equation is not an equation because it has a variable. $3x+5$ has a variable and is an expression; $3+5=8$ has none and is an equation.",
  },
  "rational-area-volume-equation": {
    goal: "Write the equation for the area or volume of a figure with fractional dimensions and one unknown measure.",
    intuition:
      "An area or volume formula is an equation. Put the known measures and the total in the formula and leave the unknown measure as a letter.",
    terms: [
      [
        "rational dimension",
        "A length written as a fraction or mixed number, such as $2\\tfrac12$ feet.",
      ],
    ],
    method: [
      "Write the formula: triangle $\\tfrac12bh$, rectangle $lw$, rectangular prism $lwh$.",
      "Replace the known measures and the area or volume with the given numbers.",
      "Leave the unknown as a letter. Do not change the operations to make the numbers easier.",
    ],
    watch:
      "A triangle is half of a rectangle, so its equation keeps the $\\tfrac12$. Volume multiplies all three edges and surface area adds faces.",
  },
  "categorical-summary": {
    goal: "Find the mode, a relative frequency as a percent, and a category count from a percent bar.",
    intuition:
      "Categorical data sorts items into categories. The mode is the most common category; a relative frequency is a category's share of all the items.",
    terms: [
      ["mode", "The category with the greatest count."],
      [
        "relative frequency",
        "A category's count divided by the total count. Written as a percent, it is the share out of 100.",
      ],
    ],
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
      "A check register tracks an account. A deposit adds money and a check, a transfer out or a fee takes money away, so each balance is the one before plus or minus the entry.",
    terms: [
      ["balance", "The amount of money in the account after an entry."],
      ["deposit", "Money added to the account."],
    ],
    method: [
      "Start from the balance at the top.",
      "For each entry in order, add a deposit and subtract a check, transfer or fee. The result is the next balance.",
      "To find a missing amount, find the difference between the balance before and after the entry.",
    ],
    watch:
      "Line up the cents and subtract payments, do not add them. Each row starts from the previous row's balance, not from the first balance.",
  },
  "lifetime-income-salary": {
    goal: "Find total earnings over a career from a yearly or monthly pay and a number of years, and compare two salaries.",
    intuition:
      "If the pay is the same every year, total earnings are the yearly pay times the number of years. A small difference in yearly pay becomes a large difference over a career.",
    terms: [["salary", "A fixed amount of pay for a year of work."]],
    method: [
      "Find the number of years: retirement age minus starting age.",
      "If the pay is monthly, multiply by 12 for the pay in one year.",
      "Multiply the yearly pay by the number of years. To compare, subtract the yearly pays first and multiply the difference.",
    ],
    watch:
      "Use the years worked, not the retirement age. For monthly pay, change to yearly pay before multiplying by years.",
  },
  "pi-as-ratio": {
    goal: "Describe $\\pi$ as the circumference divided by the diameter and compute it from a measured circle.",
    intuition:
      "Measure around any circle and across it through the center. The distance around is always a bit more than three times the distance across, and that number is $\\pi$.",
    terms: [
      ["circumference", "The distance around a circle."],
      [
        "diameter",
        "The distance across a circle through its center. It is twice the radius.",
      ],
      [
        "$\\pi$",
        "The ratio circumference divided by diameter, which is the same for every circle: about $3.14$.",
      ],
    ],
    method: [
      "Find the diameter. If you are given the radius, double it.",
      "Divide the circumference by the diameter.",
      "Round as asked. Every circle gives about $3.14$, however large it is.",
    ],
    watch:
      "Dividing the circumference by the radius gives about $6.28$, which is $2\\pi$. The ratio $\\pi$ uses the diameter.",
  },
  "experimental-probability-predict": {
    goal: "Find an experimental probability from trials, predict counts for more trials, and compare with expected counts.",
    intuition:
      "An experiment gives data. The share of trials in which an event happened is the experimental probability, and it helps predict what happens in more trials.",
    terms: [
      [
        "experimental probability",
        "The number of times an event happened divided by the number of trials.",
      ],
      [
        "theoretical probability",
        "The probability found from equally likely outcomes, such as $\\tfrac16$ for rolling a 6.",
      ],
    ],
    method: [
      "Experimental probability is successes divided by trials.",
      "To predict, scale the observed count by the number of times as many trials.",
      "To compare, multiply the theoretical probability by the trials and subtract it from the observed count.",
    ],
    watch:
      "Few trials can be far from the true probability by chance. More trials usually give an experimental probability closer to it.",
  },
  "cylinder-prism-surface-area": {
    goal: "Find the lateral or total surface area of a cylinder in terms of $\\pi$, a missing height, or a triangular prism's surface area.",
    intuition:
      "Surface area is the area of all the faces. A cylinder unrolls into two circles and one rectangle; a triangular prism has two triangles and three rectangles.",
    terms: [
      [
        "lateral surface area",
        "The area of the curved side of a cylinder, not counting the bases.",
      ],
      ["total surface area", "The area of every surface, including the bases."],
    ],
    method: [
      "Cylinder: the side unrolls to a rectangle $2\\pi r$ wide and $h$ tall, so it has area $2\\pi rh$. Each base has area $\\pi r^2$.",
      "Triangular prism: add the two triangles to the three rectangles, each the length of one triangle side times the prism's length.",
      "To find a missing height, subtract the other parts from the total and divide.",
    ],
    watch:
      "A cylinder has two bases. The lateral area has none, and the rectangle's width is the circumference, not the radius.",
  },
  "both-sides-situation-equation": {
    goal: "Write an equation or inequality for two situations that each have a starting amount and a rate.",
    intuition:
      "Each situation is an expression: starting amount plus or minus the rate times the number of units. Setting them equal, or comparing them, gives a variable on both sides.",
    terms: [
      [
        "rate",
        "The amount that changes for each unit, such as dollars per visit.",
      ],
    ],
    method: [
      "Write each situation as starting amount, then plus (increasing) or minus (decreasing) rate times the variable.",
      "Join the two expressions with $=$ for equal, or with $<$ or $>$ for less than or more than.",
      "Keep each starting amount with its own rate. Do not combine fees and rates.",
    ],
    watch:
      '"Less than" is $<$, which does not include equal. Put each rate with its own plan and subtract when the quantity is decreasing.',
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
    "$\\mathbb N\\subset\\mathbb W\\subset\\mathbb Z\\subset\\mathbb Q$. An integer $n$ is rational because $n=n/1$. Numbers such as $12/4$ are named by their simplified value, so they belong to the smallest set containing that value.",
  "reciprocal-division-choice":
    "For nonzero $b$ and $c$, $\\dfrac{a}{b}\\div\\dfrac{c}{d}=\\dfrac{a}{b}\\times\\dfrac{d}{c}$, because multiplying a number by $\\dfrac{c}{d}\\cdot\\dfrac{d}{c}=1$ does not change the quotient.",
  "scaling-direction-choice":
    "For a positive number $N$ and a positive multiplier $m$, $mN<N$ when $m<1$, $mN=N$ when $m=1$, and $mN>N$ when $m>1$.",
  "percent-grid-model":
    "A 10 by 10 grid has 100 equal squares. If $k$ are shaded, the shaded part is $\\tfrac{k}{100}=k\\%=k\\times0.01$ of the whole.",
  "percent-forms-and-parts":
    "$p\\%=\\tfrac{p}{100}$. If a part $P$ is $p\\%$ of a whole $W$, then $P=\\tfrac{p}{100}W$, so $W=\\dfrac{100P}{p}$ and $p=\\dfrac{100P}{W}$.",
  "independent-dependent-roles":
    "In a function relationship each value of the independent quantity determines one value of the dependent quantity. By convention the independent quantity is shown on the horizontal axis and the dependent quantity on the vertical axis.",
  "expression-or-equation":
    "An expression is a collection of numbers, variables and operations. An equation is a statement $E_1=E_2$ that two expressions are equal; it may be true, false or true only for some values.",
  "rational-area-volume-equation":
    "Area of a triangle $=\\tfrac12bh$; area of a rectangle $=lw$; volume of a rectangular prism $=lwh$. These equations hold for fractional lengths, and an unknown measure is found by inverse operations.",
  "categorical-summary":
    "For categorical data the mode is the category with the greatest frequency. The relative frequency of a category is its frequency divided by the total, and $p\\%$ of a total $N$ is $\\tfrac{p}{100}N$.",
  "check-register-balance":
    "If the balance before an entry is $B$ and the entry is $x$ dollars, the new balance is $B+x$ for a deposit and $B-x$ for a payment. The change in balance across an entry is its signed amount.",
  "lifetime-income-salary":
    "Earnings with constant pay $S$ per period over $n$ periods are $nS$. With a monthly pay $M$, a year is $12M$, so $y$ years earn $12My$. The difference between two constant salaries over $y$ years is $y(S_2-S_1)$.",
  "pi-as-ratio":
    "For every circle, $\\dfrac{C}{d}=\\pi\\approx3.14159$, so $C=\\pi d=2\\pi r$. Since the ratio is the same for all circles, scaling a circle scales $C$ and $d$ equally.",
  "experimental-probability-predict":
    "If an event occurs $s$ times in $n$ trials, its experimental probability is $s/n$. A prediction for $N$ trials is $N\\cdot s/n$. By the law of large numbers, the experimental probability tends to approach the theoretical probability as $n$ grows.",
  "cylinder-prism-surface-area":
    "A cylinder of radius $r$ and height $h$ has lateral area $2\\pi rh$ and total surface area $2\\pi r^2+2\\pi rh$. A right triangular prism has total surface area $2\\cdot\\tfrac12pq+(p+q+c)L$ for legs $p,q$, hypotenuse $c$ and length $L$.",
  "both-sides-situation-equation":
    "A quantity with starting amount $a$ and rate $r$ after $x$ units is $a+rx$, with $r$ negative for a decreasing quantity. Two quantities are equal when $a_1+r_1x=a_2+r_2x$, and the first is less when $a_1+r_1x<a_2+r_2x$.",
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
      "Natural numbers sit inside whole numbers, whole numbers inside integers and integers inside rational numbers.",
    templateIds: ["number-set-venn"],
    objectives: [
      "Place a number in the correct region of the nested-set diagram.",
      "Name the smallest set that contains a number, and judge subset statements.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Each set holds the one before it",
        paragraphs: [
          "Natural numbers are the counting numbers $1,2,3,\\ldots$. Add zero to get the whole numbers. Add the negatives to get the integers. Add fractions and decimals to get the rational numbers.",
          "Because each set grows from the one before, a natural number is also whole, an integer and rational.",
        ],
      },
    ],
    workedExample: {
      prompt: "Which is the smallest set that contains $-9/3$?",
      steps: [
        "Simplify: $-9/3=-3$.",
        "$-3$ is negative, so it is not a natural or whole number. It is an integer.",
      ],
      answer: "Integers",
    },
    closingSections: [
      {
        stage: "method",
        title: "Simplify, then move outward",
        paragraphs: [
          "Write the number in simplest form. Check the sets from the smallest outward and stop at the first one that holds it.",
        ],
      },
      {
        stage: "formal",
        title: "Subsets",
        paragraphs: [
          '$\\mathbb N\\subset\\mathbb W\\subset\\mathbb Z\\subset\\mathbb Q$. "Every $X$ is a $Y$" is true exactly when $X$ is a subset of $Y$.',
        ],
      },
    ],
    pitfalls: [
      "Zero is a whole number but not a natural number.",
      "A fraction can be an integer: $12/4=3$.",
    ],
    parentGuide:
      "Write numbers on cards and have the learner sort them into rings drawn on paper.",
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
      "Percent means out of 100. Grids show it, and the same amount can be written as a fraction, a decimal or a percent.",
    templateIds: ["percent-grid-model", "percent-forms-and-parts"],
    objectives: [
      "Name the percent, fraction or decimal for a shaded part of a 10 by 10 grid.",
      "Convert among fractions, decimals and percents, and find a whole or a percent from a part.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "One part, three names",
        paragraphs: [
          "A 10 by 10 grid has 100 squares. If 35 are shaded, the shaded part is $35\\%$, $\\tfrac{35}{100}=\\tfrac{7}{20}$ and $0.35$.",
          "To go from a fraction to a percent, find the fraction out of 100: $\\tfrac38=0.375=37.5\\%$.",
        ],
      },
    ],
    workedExample: {
      prompt: "A part of 45 is $30\\%$ of the whole. Find the whole.",
      steps: [
        "$30\\%$ of the whole is 45, so $1\\%$ is $45\\div30=1.5$.",
        "The whole is $100\\%$: $1.5\\times100=150$.",
      ],
      answer: "150",
    },
    closingSections: [
      {
        stage: "method",
        title: "Convert and find",
        paragraphs: [
          "Decimal to percent: multiply by 100. Percent to fraction: put the percent over 100 and simplify.",
          "Finding the percent: part $\\div$ whole $\\times100$. Finding the whole: part $\\div$ percent $\\times100$.",
        ],
      },
      {
        stage: "formal",
        title: "Percent relationships",
        paragraphs: [
          "If $P$ is $p\\%$ of $W$, then $P=\\tfrac{p}{100}W$, so $W=\\tfrac{100P}{p}$ and $p=\\tfrac{100P}{W}$.",
        ],
      },
    ],
    pitfalls: [
      "Name the shaded part, not the part that is left.",
      "Keep part and whole in order: 12 out of 48 is $12\\div48$.",
    ],
    parentGuide:
      "Shade squares on a 10 by 10 grid and have the learner say the percent, fraction and decimal.",
  }),
  lesson({
    id: "independent-dependent",
    title: "Independent and dependent quantities",
    summary:
      "In a relationship, the quantity you set is independent and the quantity it determines is dependent.",
    templateIds: ["independent-dependent-roles"],
    objectives: [
      "Name the independent and dependent quantity in a table.",
      "Say which goes on the horizontal axis of a graph.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Which quantity determines the other?",
        paragraphs: [
          "The cost of tickets depends on how many tickets you buy. The number of tickets is the one you choose, so it is independent, and the cost is dependent on it.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A table shows the height of a plant for each number of days since planting. Which quantity is dependent?",
      steps: [
        "The number of days is the time you choose to look at the plant.",
        "The height is determined by the day, so it depends on it.",
      ],
      answer: "The height of the plant",
    },
    closingSections: [
      {
        stage: "method",
        title: "Ask which follows from which",
        paragraphs: [
          "Choose a value for one quantity and see whether the other is then determined. The determined one is dependent. On a graph, the independent quantity is on the horizontal axis.",
        ],
      },
      {
        stage: "formal",
        title: "Convention",
        paragraphs: [
          "In a function relationship, each independent value determines exactly one dependent value; the independent quantity is graphed on the horizontal axis.",
        ],
      },
    ],
    pitfalls: [
      "The first column is not always independent.",
      "Larger numbers do not decide the roles; the dependence does.",
    ],
    parentGuide:
      "Use daily examples, such as hours of practice and pieces learned, and ask which one the learner can choose.",
  }),
  lesson({
    id: "expressions-and-equations",
    title: "Expressions and equations",
    summary:
      "An expression names a value. An equation has an equal sign and says two values are the same.",
    templateIds: ["expression-or-equation"],
    objectives: [
      "Tell an expression from an equation in numbers, letters and words.",
      "Recognize that a false statement with an equal sign is still an equation.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "A phrase and a sentence",
        paragraphs: [
          '$3x+5$ is a phrase, like "five more than three times a number". $3x+5=20$ is a full sentence: it says that value equals 20.',
          "A sentence is an equation. A phrase is an expression.",
        ],
      },
    ],
    workedExample: {
      prompt: "Which is an equation: $4y-2$, $4y-2=10$ or $10-2$?",
      steps: [
        "$4y-2$ and $10-2$ have no equal sign, so each is an expression.",
        "$4y-2=10$ has an equal sign.",
      ],
      answer: "$4y-2=10$",
    },
    closingSections: [
      {
        stage: "method",
        title: "Look for equality",
        paragraphs: [
          'Look for an equal sign in symbols, or a word such as "is" or "equals" in a phrase. An equation can be true or false.',
        ],
      },
      {
        stage: "formal",
        title: "Definitions",
        paragraphs: [
          "An expression is built from numbers, variables and operations. An equation states that two expressions are equal.",
        ],
      },
    ],
    pitfalls: [
      "A letter in the item does not make it an equation.",
      "$2+2=5$ is false, but it is still an equation.",
    ],
    parentGuide:
      "Read items aloud. A phrase sounds unfinished; an equation is a complete sentence.",
  }),
  lesson({
    id: "rational-area-volume-equations",
    title: "Equations for area and volume with fractions",
    summary:
      "Put the known measures and the total into the area or volume formula and keep the unknown as a letter.",
    templateIds: ["rational-area-volume-equation"],
    objectives: [
      "Write an equation for a triangle's or rectangle's area or a prism's volume with fractional measures.",
      "Reject equations that add, drop a factor or use the wrong formula.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "The formula is already an equation",
        paragraphs: [
          "The area of a triangle is $\\tfrac12bh$. If the area is $1\\tfrac{9}{16}$ and the base is $2\\tfrac12$, the equation is $\\tfrac12\\times2\\tfrac12\\times h=1\\tfrac{9}{16}$. The fractions do not change the structure.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A rectangle has area $2\\tfrac{1}{4}$ and length $1\\tfrac12$. Write an equation for its width $w$.",
      steps: [
        "Area is length times width.",
        "Put in the known values and leave $w$ unknown.",
      ],
      answer: "$1\\tfrac12\\times w=2\\tfrac14$",
    },
    closingSections: [
      {
        stage: "method",
        title: "Formula, substitute, leave the unknown",
        paragraphs: [
          "Write the formula, substitute the known measures and the total, and leave the unknown as a letter. Do not solve yet.",
        ],
      },
      {
        stage: "formal",
        title: "Formulas",
        paragraphs: [
          "Triangle: $A=\\tfrac12bh$. Rectangle: $A=lw$. Rectangular prism: $V=lwh$.",
        ],
      },
    ],
    pitfalls: [
      "A triangle needs the $\\tfrac12$.",
      "Volume multiplies three edges. Adding them or using two edges gives the wrong measure.",
    ],
    parentGuide:
      "Have the learner say the formula in words before writing it with the numbers.",
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
      "A check register records each deposit and payment so you always know the balance.",
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
          "A deposit puts money into the account, so the balance goes up. A check, a transfer out or a fee takes money out, so the balance goes down. Each row's new balance is the old balance plus or minus the entry.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "The balance is 245.50. A check for 38.75 is written, then 120.00 is deposited. What is the balance?",
      steps: [
        "After the check: $245.50-38.75=206.75$.",
        "After the deposit: $206.75+120.00=326.75$.",
      ],
      answer: "326.75 dollars",
    },
    closingSections: [
      {
        stage: "method",
        title: "Go row by row",
        paragraphs: [
          "Start from the top balance. Apply each entry in order. To find a missing amount, subtract the smaller balance from the larger one.",
        ],
      },
      {
        stage: "formal",
        title: "Signed changes",
        paragraphs: [
          "Treat a deposit as $+x$ and a payment as $-x$. The new balance is the old balance plus the signed amount.",
        ],
      },
    ],
    pitfalls: [
      "Subtract payments; do not add them.",
      "Line up the cents. 38.75 has 75 cents, not 7.5.",
    ],
    parentGuide:
      "Keep a pretend check register for a week of allowance and spending.",
  }),
  lesson({
    id: "lifetime-income",
    title: "Income over a career",
    summary:
      "Yearly pay times the number of years gives career earnings, and a difference in pay grows with every year.",
    templateIds: ["lifetime-income-salary"],
    objectives: [
      "Find total earnings from a yearly or monthly pay and a career length.",
      "Compare two salaries over a career.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "The same pay, year after year",
        paragraphs: [
          "If someone earns 62,000 dollars a year for 40 years, the total is $62{,}000\\times40=2{,}480{,}000$ dollars. A raise of 6,000 dollars a year adds $6{,}000\\times40=240{,}000$ dollars over the career.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A person works from age 22 to age 62 and earns 54,000 dollars a year. Find the total earned.",
      steps: [
        "Years worked: $62-22=40$.",
        "Total: $54{,}000\\times40=2{,}160{,}000$.",
      ],
      answer: "2,160,000 dollars",
    },
    closingSections: [
      {
        stage: "method",
        title: "Years first, then multiply",
        paragraphs: [
          "Find the years worked. For a monthly pay, multiply by 12 to get a yearly pay. Multiply yearly pay by years. To compare, find the yearly difference and multiply by the years.",
        ],
      },
      {
        stage: "formal",
        title: "Constant pay",
        paragraphs: [
          "With constant yearly pay $S$ for $y$ years, total earnings are $Sy$. For monthly pay $M$, they are $12My$.",
        ],
      },
    ],
    pitfalls: [
      "Use years worked, not the retirement age.",
      "Change monthly pay to yearly pay before multiplying by years.",
    ],
    parentGuide:
      "Compare two job offers together and talk about what the difference is over 40 years.",
  }),
  lesson({
    id: "pi-ratio",
    title: "The circumference-to-diameter ratio",
    summary:
      "The ratio $\\pi$ (pi) is the circumference of any circle divided by its diameter, about 3.14.",
    templateIds: ["pi-as-ratio"],
    objectives: [
      "Name the ratio $\\pi$ as circumference divided by diameter.",
      "Compute circumference divided by diameter from measured values.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "The same ratio for every circle",
        paragraphs: [
          "Measure the distance around a can and the distance across it through the center. Divide the first by the second. You get about 3.14. A tiny coin and a giant wheel give the same number, which is called $\\pi$.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A lid has a diameter of 8 cm and a circumference of 25.1 cm. Find the ratio to the nearest hundredth.",
      steps: [
        "Divide the circumference by the diameter: $25.1\\div8=3.1375$.",
        "Round to the nearest hundredth.",
      ],
      answer: "3.14",
    },
    closingSections: [
      {
        stage: "method",
        title: "Use the diameter",
        paragraphs: [
          "If a radius is given, double it to get the diameter. Divide the circumference by the diameter.",
        ],
      },
      {
        stage: "formal",
        title: "Definition",
        paragraphs: ["$\\pi=C/d$ for every circle, so $C=\\pi d=2\\pi r$."],
      },
    ],
    pitfalls: [
      "Circumference divided by radius is about 6.28, which is $2\\pi$.",
      "Scaling a circle does not change the ratio.",
    ],
    parentGuide:
      "Measure a few round objects with string and a ruler, and divide.",
  }),
  lesson({
    id: "experimental-probability",
    title: "Experimental probability and predictions",
    summary:
      "Collected data give an experimental probability, which predicts what happens in more trials.",
    templateIds: ["experimental-probability-predict"],
    objectives: [
      "Find an experimental probability from the results of trials.",
      "Predict a count for more trials, compare with the expected count and judge which experiment to trust.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "What happened, and what will happen",
        paragraphs: [
          "A spinner lands on blue 18 times in 60 spins. The experimental probability of blue is $\\tfrac{18}{60}=0.3$. In 200 spins, we expect about $0.3\\times200=60$ blues.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A cup lands on its side 12 times in 40 tosses. Predict how many times it will in 200 tosses.",
      steps: [
        "200 tosses is $200\\div40=5$ times as many.",
        "$5\\times12=60$.",
      ],
      answer: "About 60 times",
    },
    closingSections: [
      {
        stage: "method",
        title: "Successes over trials, then scale",
        paragraphs: [
          "Divide successes by trials. Multiply the result by the number of new trials, or scale the count. For expected counts from theory, multiply the theoretical probability by the trials.",
        ],
      },
      {
        stage: "formal",
        title: "Larger samples",
        paragraphs: [
          "As the number of trials grows, the experimental probability tends to get closer to the theoretical probability.",
        ],
      },
    ],
    pitfalls: [
      "A prediction is not a promise. Real results vary around it.",
      "Few trials can be far from the true probability.",
    ],
    parentGuide: "Toss a coin 20 times, record the heads, and compare with 10.",
  }),
  lesson({
    id: "cylinder-prism-surface-area",
    title: "Surface area of cylinders and triangular prisms",
    summary: "Unroll a solid into its faces and add their areas.",
    templateIds: ["cylinder-prism-surface-area"],
    objectives: [
      "Find the lateral and total surface area of a cylinder in terms of $\\pi$.",
      "Find a cylinder's height from its surface area and the surface area of a right triangular prism.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Faces laid flat",
        paragraphs: [
          "A can has a top, a bottom and a curved side. Unrolled, the side is a rectangle as tall as the can and as wide as the distance around it, the circumference. The top and bottom are circles.",
          "A triangular prism has two triangles and three rectangles.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A cylinder has radius 3 cm and height 5 cm. Find its total surface area in terms of $\\pi$.",
      steps: [
        "Two bases: $2\\times\\pi\\times3^2=18\\pi$.",
        "Side: $2\\pi\\times3\\times5=30\\pi$.",
        "Total: $18\\pi+30\\pi=48\\pi$.",
      ],
      answer: "$48\\pi$ square centimeters",
    },
    closingSections: [
      {
        stage: "method",
        title: "Add the faces",
        paragraphs: [
          "For a missing height, subtract the bases from the total to get the side, then divide by $2\\pi r$. For a triangular prism, add the two triangle areas to the three rectangles.",
        ],
      },
      {
        stage: "formal",
        title: "Formulas",
        paragraphs: [
          "Cylinder: lateral $2\\pi rh$, total $2\\pi r^2+2\\pi rh$. Right triangular prism: $pq+(p+q+c)L$.",
        ],
      },
    ],
    pitfalls: [
      "A cylinder has two circular bases.",
      "The rectangle's width is the circumference, not the radius.",
    ],
    parentGuide:
      "Peel the label off a can and lay it flat to see the rectangle.",
  }),
  lesson({
    id: "both-sides-situations",
    title: "Equations with a variable on both sides from a situation",
    summary:
      "When two situations each have a start and a rate, comparing them gives an equation or inequality with the variable on both sides.",
    templateIds: ["both-sides-situation-equation"],
    objectives: [
      "Write an expression for each situation and join them with $=$, $<$ or $>$.",
      "Handle a decreasing quantity by subtracting its rate.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Two totals, one variable",
        paragraphs: [
          "Gym A charges 20 dollars to join plus 5 dollars a visit: $20+5v$. Gym B charges 8 dollars plus 8 dollars a visit: $8+8v$. The costs are the same when $20+5v=8+8v$.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "Tank A has 67 liters and loses 3 liters a minute. Tank B has 11 liters and gains 5 liters a minute. Write the equation for when they hold the same amount.",
      steps: ["Tank A: $67-3t$. Tank B: $11+5t$.", "Set them equal."],
      answer: "$67-3t=11+5t$",
    },
    closingSections: [
      {
        stage: "method",
        title: "Start, rate, variable",
        paragraphs: [
          "For each situation write start $\\pm$ rate $\\times$ variable. Use $+$ when the amount grows and $-$ when it shrinks. Join with $=$ for equal, $<$ for less than and $>$ for more than.",
        ],
      },
      {
        stage: "formal",
        title: "Linear expressions",
        paragraphs: [
          "A quantity that starts at $a$ and changes at rate $r$ is $a+rx$ after $x$ units. The quantities are equal when $a_1+r_1x=a_2+r_2x$.",
        ],
      },
    ],
    pitfalls: [
      "Do not combine a fee and a rate into one number.",
      '"Less than" is $<$. It does not include equal.',
    ],
    parentGuide:
      "Compare two phone plans or two savings plans and write each total with a letter.",
  }),
];
