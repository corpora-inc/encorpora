import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

export const texas38Methods: Record<string, ProblemMethod> = {
  "times-as-many-comparison": {
    goal: "Write a times-as-many comparison as a multiplication, and find how many times as many one amount is as another.",
    intuition:
      '"6 times as many as 4" means 6 equal groups of 4. Picture 4 stamps, then 6 rows of 4 stamps. That is $6\\times4=24$ stamps. The sign $\\times$ means times, or groups of. The amount after "as" is the one you copy. The number before "times as many" says how many copies.',
    senses: { "more than": "more-than" },
    terms: ["times-as-many", "more-than"],
    method: [
      'Find the amount after "as". It is the amount that gets copied.',
      'The number before "times as many" says how many copies. Multiply it by the amount being copied: 6 times as many as 4 is $6\\times4$.',
      "To compare two counts, divide the bigger count by the smaller one. Dividing asks how many copies of the smaller fit in the bigger: $20\\div5=4$, because $4\\times5=20$.",
    ],
    watch:
      '"4 more than 5" adds: $5+4=9$. "4 times as many as 5" makes 4 copies: $4\\times5=20$. Read which one the sentence says.',
  },
  "situation-pair-table": {
    goal: "Use a real-life rule to fill in a table of number pairs: go forward, go backward or find the rate.",
    intuition:
      'A table of pairs lists amounts that go together, such as boxes and the pencils in them. Each row is one pair. A rule is a step that turns the first number into the second, like "times 6" or "add 6". The same rule works for every row. The story tells you which kind of rule it is. Then one row shows its number, and the rule fills in the rest.',
    senses: { rule: "rule", difference: "difference-subtract" },
    terms: [
      [
        "ordered-pair",
        "Here, two numbers that go together, such as 3 boxes and 18 pencils.",
      ],
      "rule",
    ],
    method: [
      "Read the story. Is each second number equal groups of the first (multiply), or the first plus a fixed gap (add)? A fixed gap is the same difference in every row, like being 6 years older.",
      "Test the rule on a row you can see. For equal groups, divide the second number by the first, using a row whose first number is not 0. The answer is how many go with 1. For a gap, subtract the first number from the second.",
      "Use the rule forward to find a second number. Undo it to go backward: divide to undo a times, and subtract to undo an add.",
    ],
    watch:
      "A fixed gap adds the same amount in every row. Equal groups multiply. Triple the boxes and you triple the pencils. But if Ella is 6 years older than Gia, Ella's age does not triple when Gia's does: she is always just 6 years older.",
  },
  "story-equation-choice": {
    goal: "Choose the equation, with a letter for the unknown, that matches a one-step or two-step story within 1,000.",
    intuition:
      "An equation is a number sentence with an equals sign. The sign $=$ means both sides are the same amount. A letter such as $n$ stands for the number you do not know yet, called the unknown. Read the story. Find the total and the parts that make it. Then write what happens, using numbers and the letter.",
    senses: {
      change: "change",
      part: "part",
      whole: "whole",
      side: "side-of-equation",
    },
    noLink: ["leaves", "mean"],
    terms: ["unknown", "equation"],
    method: [
      "Find the total and the parts. Getting more joins parts into a total, so add. Giving some away takes a part from the total, so subtract.",
      "Write each change in the order it happens. Put the letter where the story hides the number. If the start is hidden, begin the equation with $n$.",
      "Check: read the equation back as the story. Each number should mean the same thing in both.",
    ],
    watch:
      "$190+n=347$ and $347-190=n$ tell the same story. Do not pick an equation just because its numbers come in the same order as in the story.",
  },
  "strip-diagram-equation": {
    goal: "Read a strip diagram of a multistep story and choose the equation with a letter that fits it.",
    intuition:
      "A strip diagram shows a story with bars. The long bar is the whole, the total amount. The shorter bars are its parts. Together the parts are as long as the whole. Equal bars stand for equal amounts. Each bar becomes a number or a letter in the equation, and equal bars together become a multiplication.",
    senses: { part: "part", whole: "whole", product: "product-multiply" },
    noLink: ["leaves", "mean"],
    terms: ["strip-diagram", "equal-parts"],
    method: [
      "Name the whole and each part. Several equal bars, like 3 bars of $n$, can be written as one multiplication: $3\\times n$ means $n+n+n$.",
      "The parts add up to the whole. So the whole equals the sum of the parts, the parts added together.",
      "The sign $\\div$ means divide, or share equally. If a part is taken away before the rest is shared equally, put the taking away in parentheses ( ), which mean do this first: $(27-6)\\div3=n$.",
    ],
    watch:
      "Order matters. $(27-6)\\div3$ takes away 6 first and then shares: $21\\div3=7$. $27-6\\div3$ shares the 6 first: $27-2=25$.",
  },
  "division-area-model": {
    goal: "Read a division as an area model: partial quotients, the equation with an unknown side, and the quotient.",
    intuition:
      "Area is the number of unit squares that cover a shape. A unit square is a square with sides 1 unit long. A rectangle's area is its height times its width. So if you know the area and the height, divide the area by the height to find the width. The answer to a division is called the quotient. A big area can be split into easy parts. Each part's width is a partial quotient, one piece of the answer.",
    senses: {
      part: "part",
      parts: "part",
      side: "side",
      sides: "side",
      square: "square-shape",
      squares: "square-shape",
      unit: "unit",
      units: "unit",
      whole: "whole",
    },
    terms: [
      "area-model",
      [
        "quotient",
        "A partial quotient is one part of the quotient; in an area model it is one part's width, its area divided by the height.",
      ],
    ],
    method: [
      "Write the height times the unknown width as the area: $\\text{height}\\times w=\\text{area}$. The letter $w$ stands for the width.",
      "Divide each part's area by the height. Each answer is that part's width, a partial quotient.",
      "Add the partial quotients. Their total is the quotient and the whole width. Check: the quotient times the height gives back the whole area.",
    ],
    watch:
      "Divide every part by the height. Adding the areas only gives back the number being divided, and a part that is not divided stays too large.",
  },
  "fraction-benchmark-reasonable": {
    goal: "Use the benchmarks 0, 1/4, 1/2, 3/4 and 1 to estimate sums and differences and judge reasonable answers.",
    intuition:
      "A fraction such as $\\tfrac{3}{12}$ names equal parts of one whole. The bottom number, the denominator, says how many equal parts make the whole. The top number, the numerator, says how many parts we have. A benchmark is an easy fraction to compare with: 0, $\\tfrac14$, $\\tfrac12$, $\\tfrac34$ or 1. Swap each fraction for its nearest benchmark. Then the sum (the answer to an add) or the difference (the answer to a subtract) is easy to find. That gives an estimate, a number close to the exact answer.",
    senses: {
      "more than": "more-than",
      difference: "difference-subtract",
      part: "part",
      parts: "part",
      whole: "whole",
    },
    terms: ["benchmark-fraction", "estimate"],
    method: [
      "Compare each fraction with $\\tfrac12$ first. Half of 12 is 6, so $\\tfrac{6}{12}=\\tfrac12$, and $\\tfrac{5}{12}$ is a little less. Choose the nearest benchmark.",
      "Add or subtract the benchmarks. That is your estimate.",
      "Compare the exact or given answer with the estimate. If it is close, it is reasonable. If it is far off, look for a mistake.",
    ],
    watch:
      "When the denominators match, add only the numerators: $\\tfrac{5}{12}+\\tfrac{6}{12}=\\tfrac{11}{12}$. The denominator stays 12. An answer such as $\\tfrac{11}{24}$ is far from the estimate of 1, so it is not reasonable.",
  },
  "unit-relative-size": {
    goal: "Compare the sizes of customary and metric units and decide which measurement has the greater number.",
    intuition:
      "A unit is the amount you count by when you measure, like a centimeter, a foot or a cup. A bigger unit covers more, so you need fewer of them. The same amount measured in a smaller unit gives a greater number.",
    senses: { unit: "unit", units: "unit", "more than": "more-than" },
    terms: ["unit"],
    method: [
      "Picture a real object for each unit and decide which is bigger. A foot is about as long as a ruler. A yard is about as long as a baseball bat.",
      "For the same amount, a smaller unit gives a greater number. 1 meter is 100 centimeters.",
      "To order units, find the smallest first. Then compare each next unit with the one before it.",
    ],
    watch:
      "The name of a unit does not show its size. A kilometer is not shorter than a meter because its name is longer. Picture each one.",
  },
  "decimal-area-model": {
    goal: "Model a decimal product on a hundredths square and a decimal quotient as the missing side of a rectangle.",
    intuition:
      "Look at the big square. It is 1 whole, cut into 10 rows of 10 small squares. Each small square is one hundredth, 0.01. Each row is one tenth, 0.1. A rectangle 4 tenths tall and 3 tenths wide covers $4\\times3=12$ small squares. That is 12 hundredths, so $0.4\\times0.3=0.12$.",
    senses: {
      product: "product-multiply",
      square: "square-shape",
      squares: "square-shape",
      side: "side",
      sides: "side",
      part: "part",
      whole: "whole",
      model: "model",
      unit: "unit",
      units: "unit",
    },
    terms: ["tenth", "hundredth"],
    method: [
      "For a product, the answer to a times, count the rows and columns of the shaded rectangle. Multiply the counts. Write the total as hundredths.",
      "For a quotient, the answer to a divide, write the area as tenths or hundredths. Share that count equally across the width. Keep the unit: 24 tenths shared by 8 is 3 tenths.",
      "Check a quotient by multiplying: the width times the height should equal the area.",
    ],
    watch:
      "$0.4\\times0.6$ is $0.24$, not $2.4$ and not $0.024$. Tenths times tenths make hundredths, so count the answer in hundredths: 24 hundredths is 0.24.",
  },
  "number-set-venn": {
    goal: "Place numbers in rings of natural numbers, whole numbers, integers and rational numbers, and judge “every … is a …” statements.",
    intuition:
      "Natural numbers are the counting numbers 1, 2, 3, …. Whole numbers add 0. Integers add the negatives, such as $-3$. Rational numbers add every fraction of integers (with a bottom that is not 0), such as $\\frac{1}{2}$. Each set sits inside the next. Picture each set as a ring, a loop drawn around its numbers, with rings inside rings.",
    noLink: ["whole", "sort"],
    terms: ["natural-number", "whole-number", "integer", "rational-number"],
    method: [
      "Simplify first: $12/4$ equals $3$ and $-9/3$ equals $-3$. The slash / means divide.",
      "Start from the innermost set and move outward until the number fits. The number is in that set and every larger set.",
      "A statement “every $X$ is a $Y$” is true only when the ring for $X$ lies inside the ring for $Y$.",
    ],
    watch:
      "Zero is whole but not natural. Negative integers, like $-3$, are integers but not whole numbers. A fraction that simplifies to an integer is an integer.",
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
      "Percent means “out of 100,” and % is read “percent.” Each 10 by 10 grid has 100 equal squares, so each square is 1% of the grid. The number of shaded squares is the percent. As a fraction it is that number over 100. A hundredth is one of 100 equal parts, so as a decimal it is that many hundredths.",
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
      "Percent means “out of 100.” So a fraction, a decimal and a percent can all name the same amount: $\\frac{1}{4}$, 0.25 and 25%. The whole is the full amount, which is 100%. A part is a piece of it. If you know a part's amount and what percent of the whole it is, you can find 1% and then the whole.",
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
      "Keep part and whole in the right order. The percent that 12 is of 48 comes from $12\\div48 = 0.25$, which is 25%, not from $48\\div12$.",
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
      "With one, it is an equation. With no equals sign and no comparison sign such as $<$, it is an expression.",
      "An equation can also be false, such as $2+2=5$; it is still an equation.",
    ],
    watch:
      "A letter does not make an equation. $3x+5$ has a letter and is an expression; $3+5=8$ has none and is an equation.",
  },
  "rational-area-volume-equation": {
    goal: "Write the equation for the area or volume of a shape whose measures are fractions, with one measure unknown.",
    intuition:
      "A formula is a rule that gives an area or volume from a shape's measures, such as area of a rectangle = length × width. A formula is already an equation. Put the known measures and the given total into it, and keep a letter for the unknown measure. Fractions go in just like whole numbers (the numbers 0, 1, 2 and so on).",
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
      "Write the formula: triangle area $\\tfrac12bh$ (half of base times height, the straight-up distance to the top), rectangle area $lw$ (length times width), box volume $lwh$.",
      "Replace the known measures and the area or volume with the given numbers.",
      "Leave the unknown as a letter. Do not change the operations to make the numbers easier.",
    ],
    watch:
      "A triangle has half the area of a rectangle with the same base and height, so its equation keeps the $\\tfrac12$. A box's volume multiplies all three edge lengths; surface area adds the areas of the faces.",
  },
  "categorical-summary": {
    goal: "Find the mode, a relative frequency as a percent, and a category count from a percent bar.",
    intuition:
      "Categorical data puts things into groups called categories, like Cat, Fish and Bird. The count for a category is called its frequency. The mode is the category with the greatest count. A relative frequency is a category's share of all the items: its count divided by the total. A percent means out of 100, so 25% means 25 out of every 100.",
    senses: { mode: "mode-statistics", part: "part", whole: "whole" },
    noLink: ["sorts"],
    terms: ["mode-statistics", "relative-frequency"],
    method: [
      "For the mode, compare the counts. Choose the category with the greatest count.",
      "For a relative frequency, divide the category's count by the total. Multiply by 100 to write it as a percent: $2\\div25=0.08$, which is 8%.",
      "For a count from a percent bar, take that percent of the total: 35% of 80 is $0.35\\times80=28$.",
    ],
    watch:
      "The mode is a category, like Fish, not a count, like 15. The first category listed is not the mode unless it has the greatest count.",
  },
  "check-register-balance": {
    goal: "Find a running balance or a missing amount in a check register with deposits, checks, transfers and fees.",
    intuition:
      "A check register is a table that tracks a bank account in order. The balance is the money in the account right now. A deposit puts money in, so add it. A check, a transfer out or a fee takes money out, so subtract it. Each new balance is the one just above it, with the entry added or taken away.",
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
      "The circumference is the distance around a circle. The center is the middle point. The diameter is the distance across through the center, twice the radius. For every circle, circumference divided by diameter is the same number, a little more than 3. That number is called $\\pi$ (pi), about 3.14.",
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
      "A trial is one try of an experiment, such as one spin. An event is the result you are counting, such as landing on blue. An experimental probability is the number of times it happened divided by the number of trials. Use it to predict: multiply it by a new number of trials. The theoretical probability is what the setup says should happen, such as $\\frac{1}{2}$ for heads on a fair coin.",
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
      "Each situation's total is an expression: its starting amount, plus or minus its rate times the variable. For 20 dollars to join and 5 dollars a visit, $v$ visits cost $20 + 5v$ ($5v$ means 5 times $v$). Setting two totals equal, or comparing them with $<$ (less than) or $>$ (greater than), puts the variable on both sides: to the left and to the right of the sign.",
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
      "Write each situation as its starting amount, then plus its rate times the variable if the amount is increasing (that is, getting larger). Subtract it if the amount is decreasing (that is, getting smaller).",
      "Join the two expressions with $=$ for equal, or with $<$ or $>$ for less than or more than.",
      "Keep each starting amount with its own rate. Do not combine fees and rates.",
    ],
    watch:
      "“Less than” is $<$, which does not include equal. Put each rate with its own plan, and subtract when the amount is decreasing.",
  },
};

export const texas38Principles: Record<string, string> = {
  "times-as-many-comparison":
    'Hugo has 4 stamps and Ava has 6 times as many, so Ava has $6\\times4=24$ stamps. With letters, for whole numbers $a$, $b$ and $k$, "$a$ is $k$ times as many as $b$" means $a=k\\times b$. If $b$ is not 0, then $k=a\\div b$. "$a$ is $k$ more than $b$" is different: it means $a=b+k$.',
  "situation-pair-table":
    "If each box holds 6 pencils, 8 boxes hold $8\\times6=48$ pencils, and 30 pencils fill $30\\div6=5$ boxes. If Ella is 6 years older than Gia, Ella's age is Gia's age plus 6, and Gia's age is Ella's age minus 6. Write a pair as (first number, second number). With letters, equal groups of $p$ give pairs $(x, p\\times x)$, and a fixed gap $g$ gives pairs $(x, x+g)$.",
  "story-equation-choice":
    "If 190 and some more make 347, then $190+n=347$, and also $347-190=n$. Both tell the same story. With letters, parts $a$ and $b$ that join to make a total $c$ give $a+b=c$ and $c-b=a$. Any one of the amounts can be the unknown letter. An equation is right when reading it back tells the story.",
  "strip-diagram-equation":
    "A strip diagram shows a whole as its parts added together. Three equal parts of size $n$ make $3\\times n$. Taking 6 from 27 first, then sharing the rest into 3 equal parts, is $(27-6)\\div3$. The parentheses show what to do first. With letters, $k$ equal parts of size $p$ make $k\\times p$, and taking $c$ from a whole $T$ before sharing into $k$ parts is $(T-c)\\div k$.",
  "division-area-model":
    "A rectangle 8 units tall with area $5{,}600+400+16$ square units has width $5{,}600\\div8+400\\div8+16\\div8=700+50+2=752$. Dividing each part and adding gives the same answer as $6{,}016\\div8=752$. With letters, a rectangle of height $h$ and width $w$ has area $h\\times w$. If the area splits into parts $A_1$, $A_2$ and $A_3$, the width is $A_1\\div h+A_2\\div h+A_3\\div h$. The small numbers 1, 2 and 3 only label the parts, and $h$ is not 0.",
  "fraction-benchmark-reasonable":
    "$\\tfrac{5}{12}$ is near $\\tfrac12$, and $\\tfrac{6}{12}$ is $\\tfrac12$. So $\\tfrac{5}{12}+\\tfrac{6}{12}$ is about $\\tfrac12+\\tfrac12=1$, and the exact sum $\\tfrac{11}{12}$ is close. If each of two fractions is no more than $\\tfrac18$ from its benchmark, the estimate is no more than $\\tfrac14$ from the exact answer. With letters, fractions with the same denominator $d$ add like this: $\\tfrac ad+\\tfrac cd=\\tfrac{a+c}{d}$, not $\\tfrac{a+c}{2d}$.",
  "unit-relative-size":
    "1 meter is 100 centimeters, so 2 meters is $2\\times100=200$ centimeters. The smaller unit gives the greater number. With letters, if 1 big unit is $k$ small units, with $k$ more than 1, then $n$ big units are $k\\times n$ small units. When $n$ is more than 0, $k\\times n$ is more than $n$.",
  "decimal-area-model":
    "A square with sides 1 unit long has area 1. A rectangle 4 tenths tall and 6 tenths wide covers $4\\times6=24$ hundredths, so $0.4\\times0.6=0.24$. With letters, a rectangle $\\frac{a}{10}$ tall and $\\frac{b}{10}$ wide has area $\\frac{a\\times b}{100}$. If the area $A$ and one side $d$ are known, the other side is $A\\div d$, because $d\\times(A\\div d)=A$. Here $d$ is not 0.",
  "number-set-venn":
    "Write $\\mathbb N$, $\\mathbb W$, $\\mathbb Z$ and $\\mathbb Q$ for the natural numbers, whole numbers, integers and rational numbers. Each is a subset of the next (every member of one is in the next): $\\mathbb N\\subset\\mathbb W\\subset\\mathbb Z\\subset\\mathbb Q$. An integer $n$ is rational because $n=n/1$. A number such as $12/4$ is named by its simplified value, so it is placed in the smallest set holding that value (it also belongs to every larger set).",
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
    "Area of a triangle $=\\tfrac12bh$ (base $b$, height $h$); area of a rectangle $=lw$ (length $l$, width $w$); volume of a rectangular prism $=lwh$. These equations hold for fraction lengths too, and an unknown measure is found by dividing, which undoes multiplying.",
  "categorical-summary":
    "In a pet table with 25 students, Fish has the greatest count, 15, so Fish is the mode. Cat has 2 of the 25, so its relative frequency is $2\\div25=0.08$, or 8%. With letters, a category with count $c$ in a total $N$ has relative frequency $c\\div N$. As a percent it is $100\\times c\\div N$. And $p\\%$ of a total $N$ is $\\tfrac{p}{100}\\times N$.",
  "check-register-balance":
    "If the balance before an entry is $B$ dollars and the entry is $x$ dollars, the new balance is $B+x$ for a deposit and $B-x$ for a payment. So the change in balance across an entry is its amount with a sign: plus for money in, minus for money out.",
  "lifetime-income-salary":
    "With the same pay $S$ each year for $y$ years, total earnings are $S\\times y$. With a monthly pay $M$, a year earns $12M$ ($12$ times $M$), so $y$ years earn $12\\times M\\times y$. Two constant yearly salaries $S_1$ and $S_2$ differ over $y$ years by $y\\times(S_2-S_1)$, when $S_2$ is the larger salary.",
  "pi-as-ratio":
    "For every circle, the circumference $C$ divided by the diameter $d$ is the same number: $\\dfrac{C}{d}=\\pi\\approx3.14159$ ($\\approx$ means “is about”). So $C=\\pi d=2\\pi r$, where $r$ is the radius. Because the ratio is the same for all circles, enlarging a circle multiplies $C$ and $d$ by the same number.",
  "experimental-probability-predict":
    "If an event happens $s$ times in $n$ trials, its experimental probability is $s\\div n$. A prediction for $N$ trials is $N\\times s\\div n$. As $n$ grows, the experimental probability tends to get closer to the true probability; that is the theoretical probability when the setup is fair as assumed. This is called the law of large numbers.",
  "cylinder-prism-surface-area":
    "A cylinder of radius $r$ and height $h$ has lateral area $2\\pi rh$ and total surface area $2\\pi r^2+2\\pi rh$. A triangular prism whose end triangles have a square corner between legs $p$ and $q$, and longest side $c$, with length $L$, has total surface area $2\\times\\tfrac12pq+(p+q+c)L$.",
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
      'If Ana has 24 stickers and Ben has 3 times as many, Ben has 3 groups of 24. That is $3\\times24=72$ stickers. The sign $\\times$ means times, or groups of. "Times as many" compares two amounts with equal groups. "3 more" is different: it adds 3.',
    senses: { "more than": "more-than", product: "product-multiply" },
    templateIds: ["times-as-many-comparison"],
    objectives: [
      "Say what a multiplication such as $3\\times24$ means as a comparison.",
      "Write the multiplication for a times-as-many sentence.",
      "Find how many times as many one count is as another by dividing.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Equal copies of the amount you compare with",
        paragraphs: [
          "Ana has 24 stickers. Ben has 3 times as many. Picture Ana's pile of 24. Ben has 3 piles just like it.",
          "That is 3 groups of 24: $3\\times24=72$ stickers.",
          '"3 more than 24" is different. It adds 3: $24+3=27$. "Times as many" makes copies. "More than" adds on.',
        ],
      },
    ],
    workedExample: {
      prompt:
        'Ava has 5 shells and Ben has 20 shells. Write a sentence that compares them with "times as many".',
      steps: [
        "Ask how many groups of 5 make 20. Dividing answers that: $20\\div5=4$, because $4\\times5=20$.",
        "So Ben's 20 shells are 4 copies of Ava's 5 shells.",
        'Put the copied amount, Ava\'s, after "as": Ben has 4 times as many as Ava.',
      ],
      answer: "Ben has 4 times as many shells as Ava.",
    },
    closingSections: [
      {
        stage: "method",
        title: "Which amount is copied",
        paragraphs: [
          'The amount after "as" is the one that is copied. In "Ben has 4 times as many as Ava", Ava\'s amount is copied.',
          'The number before "times" says how many copies. Multiply to find the bigger amount: $4\\times5=20$.',
          "To compare two counts, divide the bigger count by the smaller. The answer, called the quotient, is the number of times as many.",
        ],
      },
      {
        stage: "formal",
        title: "Multiplication and division",
        paragraphs: [
          '"$a$ is $k$ times as many as $b$" means $a=k\\times b$. Here $a$, $b$ and $k$ stand for whole numbers, and $b$ is not 0.',
          "Then $k=a\\div b$. For example, $20=4\\times5$, so $4=20\\div5$.",
        ],
      },
    ],
    pitfalls: [
      '"4 times as many" is not "4 more". Subtracting tells how many more. Dividing tells how many times as many.',
      'Say which amount is bigger. "Ben has 4 times as many as Ava" is true here, but "Ava has 4 times as many as Ben" is not.',
    ],
    parentGuide:
      "Use two piles of objects, such as 3 buttons and 12 buttons. Ask how many piles of 3 fit in the pile of 12. Then say the sentence aloud: 12 is 4 times as many as 3.",
  }),
  lesson({
    id: "situation-tables",
    title: "Tables of number pairs from a situation",
    summary:
      'A table of pairs lists amounts that go together, like boxes and the pencils in them. Each row is one pair. A rule is a step that turns the first number into the second, such as "times 6". The story tells you the rule, and the rule fills in the table.',
    senses: { rule: "rule", rules: "rule", difference: "difference-subtract" },
    templateIds: ["situation-pair-table"],
    objectives: [
      "Find the rule from a story and one row of a table.",
      "Fill in a table forward and backward.",
      "Find the rate: the second number that goes with 1 of the first.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "One rule for every row",
        paragraphs: [
          "Each box holds 6 pencils. 1 box has 6 pencils, 2 boxes have 12, and 3 boxes have 18.",
          "Each row of the table is a pair: a number of boxes and the number of pencils that goes with it.",
          "The same rule works for every row: multiply the number of boxes by 6. Check one row: $3\\times6=18$.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "Each box holds 6 pencils. The table shows 1 box has 6 pencils, 2 boxes have 12 and 3 boxes have 18. How many pencils are in 8 boxes?",
      steps: [
        "Check the rule on a row you can see: 3 boxes of 6 pencils is $3\\times6=18$. It matches the table.",
        "Use the same rule for 8 boxes: $8\\times6=48$.",
      ],
      answer: "48 pencils",
    },
    closingSections: [
      {
        stage: "method",
        title: "Forward, backward and a gap",
        paragraphs: [
          "Forward means you know the first number. Use the rule on it.",
          "Backward means you know the second number. Undo the rule. For equal groups, divide: 30 pencils fill $30\\div6=5$ boxes.",
          "Some stories have a fixed gap instead, such as Ella is 6 years older than Gia. Add the gap to go forward. Subtract it to go back.",
          "For equal groups, the rate is the second number for 1 of the first, like 6 pencils for 1 box. Divide a row's second number by its first to find it: $18\\div3=6$. Use a row whose first number is not 0.",
        ],
      },
      {
        stage: "formal",
        title: "Two kinds of rule",
        paragraphs: [
          "Write a pair as (first number, second number). Equal groups of $p$ give pairs $(x, p\\times x)$, where $x$ is any first number.",
          "A fixed gap $g$ gives pairs $(x, x+g)$. For Ella and Gia, $g$ is 6, so $(3, 9)$ and $(8, 14)$ fit.",
        ],
      },
    ],
    pitfalls: [
      "Do not multiply when the rule is a fixed gap. Two ages always differ by the same amount, so add or subtract that amount.",
      "Check the rule on at least one row you can see before you use it.",
    ],
    parentGuide:
      "Make a table from a real situation, such as the cost of several snacks at the same price. Ask the learner to predict a row you have not written.",
  }),
  lesson({
    id: "story-equations-strips",
    title: "Equations and strip diagrams for stories",
    summary:
      "An equation is a number sentence with an equals sign. The sign $=$ means both sides are the same amount. A letter such as $n$ stands for the number you do not know yet. A strip diagram draws a story as bars: a long bar for the whole and shorter bars for its parts. Both show how the amounts in a story fit together.",
    senses: {
      part: "part",
      parts: "part",
      whole: "whole",
      side: "side-of-equation",
      sides: "side-of-equation",
    },
    noLink: ["mean"],
    templateIds: ["story-equation-choice", "strip-diagram-equation"],
    objectives: [
      "Choose an equation, with a letter for the unknown, that matches a one-step or two-step story.",
      "Read a strip diagram and choose its equation, including equal parts and a part taken away before sharing.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Say the story in numbers",
        paragraphs: [
          "Ana has 346 stickers and gets 128 more. We do not know the total yet, so we call it $n$.",
          "Getting more joins two parts into a total, so add: $346+128=n$.",
          "A strip diagram draws the same story. The long bar is the whole, the total. The shorter bars are the parts. Together the parts are as long as the whole.",
          "Equal bars stand for equal amounts. 4 bars of 6 make $6+6+6+6=24$. The times sign $\\times$ is a short way to write equal groups: $4\\times6$ means 4 groups of 6.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "Dev packs 4 bags with 6 marbles each and adds 3 loose marbles. A strip diagram shows 4 bars of 6 and one bar of 3 under a bar $n$. Write the equation.",
      steps: [
        "The 4 equal bars of 6 are 4 groups of 6, so write $4\\times6$.",
        "The 3 loose marbles are one more part, so add them: $4\\times6+3$.",
        "The parts together make the whole bar, $n$. So the whole $n$ equals the parts: multiply first, then add, to get $24+3=27$ marbles.",
      ],
      answer: "$n=4\\times6+3$",
    },
    closingSections: [
      {
        stage: "method",
        title: "Total, parts and order",
        paragraphs: [
          "Decide which amount is the total and which amounts are parts.",
          "If the start is unknown, write $n$ first. Mia had some cards, gave away 20 and has 50 left: $n-20=50$. If instead she got 20 more and now has 50: $n+20=50$.",
          "The sign $\\div$ means divide, or share equally: $21\\div3=7$ shares 21 into 3 equal parts of 7.",
          "Dev had 27 stickers, set 6 aside and shared the rest equally among 3 friends. Each friend gets $n$. The taking away happens before the sharing, so put it in parentheses ( ), which mean do this first: $(27-6)\\div3=n$.",
        ],
      },
      {
        stage: "formal",
        title: "Equivalent equations",
        paragraphs: [
          "$346+128=n$ and $n-128=346$ give the same answer for $n$: 474. So both match the joining story.",
          "Equations with the same answer are called equivalent. An equation is correct when reading it back tells the story.",
        ],
      },
    ],
    pitfalls: [
      "Do not choose an equation by the order of the numbers in the story. Read what happens to the unknown.",
      "Count equal bars with a times: 4 bars of 6 is $4\\times6$, the same as $6+6+6+6$. Do not write $4+6$.",
    ],
    parentGuide:
      "Ask the learner to make up a story for an equation such as $n-120=340$ and to say what $n$ stands for.",
  }),
  lesson({
    id: "division-area-models",
    title: "Division as an area model",
    summary:
      "Area is how many unit squares cover a shape. A rectangle's area is its height times its width. So if you know the area and the height, divide the area by the height to find the width. The answer to a division is called the quotient. In an area model, a rectangle split into parts, divide each part and add the widths.",
    senses: {
      part: "part",
      parts: "part",
      unit: "unit",
      units: "unit",
      whole: "whole",
      square: "square-shape",
      squares: "square-shape",
      side: "side",
      sides: "side",
    },
    templateIds: ["division-area-model"],
    objectives: [
      "Write an area equation with an unknown width for a division.",
      "Find the quotient by dividing each part of the area by the height, then adding.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "The quotient is a missing side",
        paragraphs: [
          "A unit square is a square with sides 1 unit long. A rectangle 4 units tall with an area of 1,248 square units is covered by 1,248 unit squares.",
          "Its width $w$ makes $4\\times w=1{,}248$ true. The letter $w$ stands for the width we do not know yet. Finding $w$ is the division $1{,}248\\div4$.",
          "1,248 is hard to divide in one go. Split it into easy parts: 800, 400 and 48. Each part is a smaller rectangle, still 4 units tall.",
          "Each part's width is its area divided by 4. The part widths add up to the whole width.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A rectangle 4 units tall has an area of 1,248, split into 800, 400 and 48. Find the quotient.",
      steps: [
        "Divide each part by the height, 4: $800\\div4=200$, $400\\div4=100$ and $48\\div4=12$. Each answer is one part's width.",
        "Add the part widths to get the whole width: $200+100+12=312$.",
        "Check by multiplying: $312\\times4=1{,}248$, the whole area.",
      ],
      answer: "$1{,}248\\div4=312$",
    },
    closingSections: [
      {
        stage: "method",
        title: "Divide every part",
        paragraphs: [
          "Divide every part by the height, not just the first one. Each answer is called a partial quotient, one piece of the quotient.",
          "Add the partial quotients to get the quotient. Check by multiplying the quotient by the height.",
        ],
      },
      {
        stage: "formal",
        title: "Why the parts add",
        paragraphs: [
          "Dividing a total by 4 gives the same answer as dividing each part by 4 and adding: $1{,}248\\div4=800\\div4+400\\div4+48\\div4$.",
          "With letters, for a height $h$ that is not 0: $(A_1+A_2+A_3)\\div h=A_1\\div h+A_2\\div h+A_3\\div h$. The small numbers 1, 2 and 3 only label the three parts.",
        ],
      },
    ],
    pitfalls: [
      "Adding the areas gives back the number being divided, called the dividend, not the quotient.",
      "Watch the place value of each width: $400\\div4$ is 100, not 10.",
    ],
    parentGuide:
      "Draw a rectangle on paper and label its height. Have the learner split the area into parts that divide easily.",
  }),
  lesson({
    id: "fraction-benchmarks",
    title: "Benchmarks for fraction sums and differences",
    summary:
      "A fraction such as $\\tfrac{5}{12}$ names equal parts of a whole. A benchmark is an easy fraction to compare with: 0, $\\tfrac14$, $\\tfrac12$, $\\tfrac34$ or 1. Swap each fraction for its nearest benchmark, then add or subtract. That gives an estimate, a number close to the exact answer. An answer far from the estimate likely has a mistake.",
    senses: {
      part: "part",
      parts: "part",
      whole: "whole",
      difference: "difference-subtract",
      differences: "difference-subtract",
      fourths: "fourth",
    },
    noLink: ["change"],
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
          "A fraction has two numbers. The bottom number, the denominator, says how many equal parts make one whole. The top number, the numerator, says how many of those parts we have.",
          "A benchmark is an easy fraction to compare with: 0, $\\tfrac14$, $\\tfrac12$, $\\tfrac34$ and 1.",
          "Half of 12 is 6, so $\\tfrac{6}{12}$ is the same as $\\tfrac12$. $\\tfrac{5}{12}$ is one twelfth less, so its nearest benchmark is $\\tfrac12$ too.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A student says $\\tfrac{5}{12}+\\tfrac{6}{12}=\\tfrac{11}{24}$. Is that reasonable?",
      steps: [
        "$\\tfrac{5}{12}$ is near $\\tfrac12$, and $\\tfrac{6}{12}$ is exactly $\\tfrac12$. So the sum is about $\\tfrac12+\\tfrac12=1$.",
        "$\\tfrac{11}{24}$ is less than $\\tfrac12$, because half of 24 is 12. That is far from 1.",
        "So the answer is not reasonable. Both fractions count twelfths, so the sum counts twelfths too: 5 twelfths and 6 twelfths make 11 twelfths.",
      ],
      answer:
        "Not reasonable. Fractions with the same denominator add by their numerators: $\\tfrac{11}{12}$.",
    },
    closingSections: [
      {
        stage: "method",
        title: "Estimate, then compare",
        paragraphs: [
          "Swap each fraction for its nearest benchmark. Then add or subtract the benchmarks.",
          "A sum is the answer to an add, and a difference is the answer to a subtract. The exact or given answer should be close to the estimate. If it is not, look for a mistake.",
        ],
      },
      {
        stage: "formal",
        title: "Like denominators",
        paragraphs: [
          "Fractions with the same denominator have like denominators. Add them by adding the numerators: $\\tfrac{5}{12}+\\tfrac{6}{12}=\\tfrac{11}{12}$.",
          "With letters, $\\dfrac ad+\\dfrac cd=\\dfrac{a+c}{d}$, where $d$ is not 0. The denominator names the size of the parts. Counting parts together does not change their size.",
        ],
      },
    ],
    pitfalls: [
      "Do not add the denominators. $\\tfrac12+\\tfrac12$ is 1 whole, not $\\tfrac24$.",
      "A fraction exactly halfway between two benchmarks, like $\\tfrac38$, is just as close to both. Use the other fractions in the problem to choose.",
    ],
    parentGuide:
      "Pick two fractions with the same denominator. Have the learner estimate their sum on a number line before working it out.",
  }),
  lesson({
    id: "unit-sizes",
    title: "How big is a unit?",
    summary:
      "A unit is the amount you count by when you measure, such as a meter or a cup. A bigger unit covers more, so measuring the same amount takes fewer of them. A smaller unit takes more of them, so its number is greater.",
    senses: { unit: "unit", units: "unit", "more than": "more-than" },
    noLink: ["mean"],
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
          "A meter is about as high as a door knob. A centimeter is about as wide as a fingertip. A meter is 100 centimeters.",
          "A ribbon 2 meters long is 200 centimeters long. The smaller unit needs a greater number to cover the same length.",
          "Customary units, like cups and gallons, work the same way. It takes more cups than gallons to fill a tub.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A pitcher holds 2 quarts. Is the number greater in quarts or in cups?",
      steps: [
        "A cup is smaller than a quart: it takes 4 cups to fill 1 quart.",
        "So 2 quarts is $2\\times4=8$ cups.",
        "8 is greater than 2, so the measurement in cups has the greater number.",
      ],
      answer: "The measurement in cups",
    },
    closingSections: [
      {
        stage: "method",
        title: "Picture each unit",
        paragraphs: [
          "Picture an object for each unit to decide which is bigger. A centimeter is about a fingertip's width. A meter is about a door knob's height. A kilometer is a short walk.",
        ],
      },
      {
        stage: "formal",
        title: "Counts and sizes",
        paragraphs: [
          "Say 1 big unit is $k$ small units, and $k$ is more than 1. Then $n$ big units are $k\\times n$ small units. For 2 quarts, $k$ is 4 and $n$ is 2, so that is 8 cups.",
          "When $n$ is more than 0, $k\\times n$ is more than $n$. So the number of small units is greater.",
        ],
      },
    ],
    pitfalls: [
      "A long name does not mean a big unit.",
      "A meter and a yard are close in size. A meter is a little longer.",
    ],
    parentGuide:
      "Measure the same table with a ruler in inches and in centimeters. Talk about why the numbers differ.",
  }),
  lesson({
    id: "decimal-area-models",
    title: "Decimal products and quotients with area",
    summary:
      "Look at a big square cut into 10 rows of 10 small squares. The big square is 1 whole, so each small square is one hundredth, 0.01. A rectangle 4 tenths tall and 6 tenths wide covers $4\\times6=24$ small squares, so $0.4\\times0.6=0.24$. Area also helps you divide: a missing side is the area divided by the side you know.",
    senses: {
      product: "product-multiply",
      square: "square-shape",
      squares: "square-shape",
      side: "side",
      unit: "unit",
      whole: "whole",
      part: "part",
      parts: "part",
    },
    noLink: ["change"],
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
          "A tenth is one of 10 equal parts of a whole, written 0.1. A hundredth is one of 100 equal parts, written 0.01.",
          "Cut a square into 10 rows and 10 columns. Each row is one tenth of the square. Each small square is one hundredth.",
          "Shade a rectangle 4 rows tall and 6 columns wide. It covers $4\\times6=24$ small squares, which is 24 hundredths. So $0.4\\times0.6=0.24$.",
          "A tenth of a tenth is a hundredth. That is why tenths times tenths give hundredths.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "An area model shows a rectangle with area 2.4 and width 8. Find its height.",
      steps: [
        "Write the area in tenths: $2.4$ is 24 tenths.",
        "Share 24 tenths equally across 8 columns: $24\\div8=3$ tenths. Keep the unit, tenths.",
        "3 tenths is $0.3$. Check by multiplying: $8\\times0.3=2.4$, the area.",
      ],
      answer: "0.3",
    },
    closingSections: [
      {
        stage: "method",
        title: "Count, then name the unit",
        paragraphs: [
          "For a product, the answer to a times, multiply the number of rows by the number of columns. Then name the result in hundredths.",
          "For a quotient, the answer to a divide, change the area to tenths or hundredths. Divide that count by the width, and keep the same unit.",
        ],
      },
      {
        stage: "formal",
        title: "Place value of a product",
        paragraphs: [
          "4 tenths times 6 tenths is 24 hundredths: $\\dfrac{4}{10}\\times\\dfrac{6}{10}=\\dfrac{24}{100}$.",
          "With letters, $\\dfrac{a}{10}\\times\\dfrac{b}{10}=\\dfrac{a\\times b}{100}$. So tenths times tenths always give a number of hundredths.",
        ],
      },
    ],
    pitfalls: [
      "$0.4\\times0.6$ is not $2.4$. Both numbers are less than 1, so the answer is smaller than either one.",
      "Keep the unit when dividing: 24 tenths divided by 8 is 3 tenths, not 3.",
    ],
    parentGuide:
      "Draw a 10 by 10 square on grid paper. Have the learner shade a rectangle for a product such as $0.5\\times0.7$.",
  }),
  lesson({
    id: "nested-number-sets",
    title: "Nested sets of numbers",
    summary:
      "Numbers come in families, and each family fits inside a bigger one. The counting numbers 1, 2, 3, … are the natural numbers; the dots mean “and so on.” Add 0 and you get the whole numbers. Add the negatives of those, numbers below 0 like $-3$, and you get the integers. Add the fractions of integers, like $\\frac{1}{2}$, and decimals that end or repeat, like 0.75, and you get the rational numbers. To place a number, first simplify it, which means work out its simplest value: $12/4$ is 3, a natural number.",
    senses: { opposite: "opposite-number" },
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
          "A set is a group of numbers that belong together. Picture each set as a ring, a closed loop drawn around its numbers.",
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
        "It is the opposite of the whole number 3, so it is an integer. The smallest set that holds it is the integers.",
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
      "Percent means “out of 100,” and the sign % is read “percent.” Picture a grid of 10 rows and 10 columns: it has 100 small squares. If 35 are shaded, 35% is shaded. The same amount can also be written as a fraction (a part over a whole), $\\frac{35}{100}$, or as a decimal (a number with a decimal point), 0.35. If you know a part and what percent it is, you can find the whole. When 30% of something is 45, then 1% is $45 \\div 30 = 1.5$, so 100% is 150.",
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
          "The same amount has three names. As a fraction it is $\\frac{35}{100}$, which simplifies to $\\frac{7}{20}$ by dividing top and bottom by 5. As a decimal it is 0.35. A hundredth is one of 100 equal parts, so 0.35 is 35 hundredths. As a percent it is 35%.",
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
      "Keep part and whole in order: the percent that 12 is of 48 comes from $12 \\div 48 = 0.25$, which is 25%. It does not come from $48 \\div 12$.",
      "A whole found from a part should be bigger than the part when the percent is less than 100%.",
    ],
    parentGuide:
      "Shade squares on a 10 by 10 grid and have the learner say the percent, the fraction and the decimal.",
  }),
  lesson({
    id: "independent-dependent",
    title: "Independent and dependent quantities",
    summary:
      "When two amounts are linked, one often decides the other. An amount you can measure or count is called a quantity. The cost of tickets depends on how many tickets you buy. The quantity you choose, the number of tickets, is called the independent quantity. The quantity that follows from it, the cost, is called the dependent quantity, because it depends on the first.",
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
          "Find the quantity you choose freely; it is independent. The quantity that is then settled by your choice is dependent.",
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
          "In symbols, look for an equals sign. In words, look for “is” or “equals” joining two amounts. With one, it is an equation. With no equals sign and no comparison sign such as $<$, it is an expression.",
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
      "A formula is a rule written with letters, such as “area of a rectangle = length × width.” Every formula is already an equation. When one measure is unknown, put the numbers you know into the formula and keep a letter for the unknown. A mixed number is a whole number with a fraction, like $1\\tfrac{1}{2}$. Fractions and mixed numbers go into a formula just like whole numbers (the numbers 0, 1, 2 and so on).",
    senses: {
      edge: "edge",
      face: "face-solid",
      factor: "factor-number",
      side: "side",
      solid: "solid-shape",
      rule: "rule",
    },
    noLink: ["base", "change", "square"],
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
          "A rectangle's area is $lw$: length times width. Any side of a triangle can be its base; picture the triangle resting on it. The height is the straight-up distance from the base to the top corner, measured square to the base, like a wall standing on a floor. A triangle's area is $\\tfrac12 bh$: half of the base times the height. A rectangular prism, a box shape, has volume $lwh$: length times width times height.",
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
          "These formulas work for fraction lengths too. An unknown measure can then be found by dividing, which undoes multiplying.",
        ],
      },
    ],
    pitfalls: [
      "A triangle has half the area of a rectangle with the same base and height, so its equation needs the $\\tfrac12$.",
      "A box's volume multiplies all three measures. Adding them, or using only two, gives the wrong amount.",
    ],
    parentGuide:
      "Have the learner say the formula in words, such as “length times width,” before writing it with the numbers.",
  }),
  lesson({
    id: "categorical-summaries",
    title: "Summarizing categorical data",
    summary:
      "Categorical data puts things into groups called categories, like favorite foods. The mode is the category with the greatest count. A relative frequency is a category's share of the total: its count divided by the total. As a percent, it says how many out of every 100.",
    senses: { mode: "mode-statistics", whole: "whole", part: "part" },
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
          "A frequency table lists each category and how many items fall in it. That count is called the frequency.",
          "The category with the greatest count is the mode.",
          "A relative frequency compares a count with the total. If 5 of 20 students chose soup, soup's share is 5 out of 20, or $\\tfrac{5}{20}$.",
          "A percent means out of 100. 5 out of 20 is the same share as 25 out of 100. So the relative frequency of soup is 25%.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A percent bar shows 80 students: pizza 40%, tacos 35%, soup 25%. How many chose tacos?",
      steps: [
        "A percent bar is one bar split into parts by percent. The tacos part is 35% of the 80 students.",
        "35% means 35 out of 100, or 0.35. So multiply: $0.35\\times80=28$.",
        "Check: $28\\div80=0.35$, which is 35%.",
      ],
      answer: "28 students",
    },
    closingSections: [
      {
        stage: "method",
        title: "Three tasks",
        paragraphs: [
          "Mode: compare the counts and pick the category with the greatest count.",
          "Relative frequency: divide the count by the total. Multiply by 100 to write it as a percent.",
          "Count from a percent bar: write the percent as a decimal and multiply it by the total.",
        ],
      },
      {
        stage: "formal",
        title: "Definitions",
        paragraphs: [
          "The relative frequency of a category with count $c$ in a total $N$ is $c\\div N$. As a percent it is $100\\times c\\div N$. Here $N$ is not 0.",
        ],
      },
    ],
    pitfalls: [
      "The mode is a category, not a count.",
      "The first category listed is not the mode unless it has the greatest count.",
    ],
    parentGuide:
      "Survey the family about favorite foods and make a table of counts. Ask which food is the mode.",
  }),
  lesson({
    id: "check-registers",
    title: "Balancing a check register",
    summary:
      "A bank account holds money. Its balance is how much money is in it right now. A check register is a table that lists every change to the account in order. Money put in, a deposit, makes the balance go up. Money taken out makes it go down, such as a check (a written payment) or a fee (a charge from the bank). Each row's balance is the balance in the row before, with that entry added or taken away.",
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
          "You need to add and subtract decimals, which are numbers with a decimal point. Money amounts have two digits for cents after the point: 38.75 dollars is 38 dollars and 75 cents.",
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
          "You need to multiply and subtract whole numbers (the numbers 0, 1, 2 and so on). A salary is a fixed amount of pay for one year of work. Some jobs state pay per month instead. There are 12 months in a year, so a year's pay is 12 times the monthly pay.",
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
          "Two yearly salaries $S_1$ and $S_2$ (read “$S$ one” and “$S$ two”) differ over $y$ years by $y \\times (S_2 - S_1)$, when $S_2$ is the larger salary.",
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
      "The circumference is the distance around a circle. The center is the circle's middle point. The diameter is the distance straight across, through the center. For every circle, big or small, the circumference divided by the diameter is the same number, a little more than 3. This number is called $\\pi$ (pi), and it is about 3.14.",
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
          "Try a tiny coin and then a giant wheel. The numbers you measure are very different, but dividing gives about the same answer each time. With perfect measuring it would be exactly the same. A ratio compares two amounts by dividing. This ratio, the same for every circle, is called $\\pi$ (pi).",
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
      "Probability tells how likely something is. An experiment is a test you repeat and record, like spinning a spinner. An experimental probability is a probability found from what actually happened in an experiment. Count how often something happened and divide by the number of tries. A spinner landed on blue 18 times in 60 spins, so the experimental probability of blue is $\\frac{18}{60} = 0.3$. You can use it to predict: in 200 spins, expect about $0.3 \\times 200 = 60$ blues.",
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
          "You need to work with fractions and decimals (which are numbers with a decimal point). A trial is one try of an experiment, such as one spin of a spinner. An event is the result you are counting, such as landing on blue.",
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
          "As the number of trials grows, the experimental probability tends to get closer to the true probability. When the setup really is fair, that is the theoretical probability. So a careful experiment with more trials is usually more trustworthy.",
        ],
      },
    ],
    pitfalls: [
      "A prediction is an estimate, not a promise. Real results vary around it.",
      "A few trials can be far from the true probability. If two experiments were run the same careful way, trust the one with more trials.",
      "Divide by the number of trials, not by the number of times something else happened.",
    ],
    parentGuide:
      "Toss a coin 20 times and record the heads. Compare the count with 10, the number theory expects.",
  }),
  lesson({
    id: "cylinder-prism-surface-area",
    title: "Surface area of cylinders and triangular prisms",
    summary:
      "Surface area is the total area of all the outside surfaces of a solid. Area is counted in square units, the little squares 1 unit on each side, such as square centimeters. Imagine unrolling a can: the label lays flat as a rectangle, and the top and bottom are circles. Add the areas of those pieces to get the surface area.",
    senses: {
      base: "base-shape",
      face: "face-solid",
      solid: "solid-shape",
      unit: "unit",
      squares: "square-shape",
      side: "side",
      squared: "square-number",
      sides: "side",
    },
    noLink: ["square", "terms", "parts", "edge", "part", "whole"],
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
          "Take a triangular prism whose end triangles each have a square corner. The legs are the two sides that form that corner, $p$ and $q$. The longest side is $c$, and the prism's length is $L$. Its total surface area is $pq + (p + q + c)L$. The $pq$ is the two triangles, each $\\tfrac12 pq$.",
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
      "Two plans can each have a starting amount and a rate, an amount added or taken away each time. Gym A costs 20 dollars to join plus 5 dollars a visit, so $v$ visits cost $20 + 5v$. Gym B costs $8 + 8v$. Writing $20 + 5v = 8 + 8v$ asks when the costs are equal. The parts to the left and right of the equals sign are called the sides of the equation. The letter $v$ appears on both sides.",
    senses: {
      side: "side-of-equation",
      unit: "unit",
      increasing: "increasing",
      decreasing: "decreasing",
      "more than": "more-than",
    },
    noLink: ["changes", "parts"],
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
