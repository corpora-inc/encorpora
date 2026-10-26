import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

export const staarGapMethods: Record<string, ProblemMethod> = {
  "staar-nested-grouping": {
    goal: "Evaluate an expression with brackets around parentheses, or a product described in words, using the order of operations.",
    intuition:
      "Grouping symbols tell you what to do first. Parentheses and brackets mark a part of the expression that is worked out as one number before the rest. Words such as “the sum of 42 and 6” describe the same kind of group.",
    terms: [
      [
        "bracket",
        "A grouping symbol, [ ], used around an expression that already contains parentheses.",
      ],
      [
        "order of operations",
        "The agreed order: grouping first, then multiplication and division from left to right, then addition and subtraction from left to right.",
      ],
    ],
    method: [
      "Find the innermost groups and work them out first.",
      "Replace each finished group with its value, then work out the next group outward.",
      "Do multiplication and division, then addition and subtraction, from left to right.",
      "For a verbal expression, turn “the sum of $a$ and $b$” or “the difference of $a$ and $b$” into a group, then multiply.",
    ],
    watch:
      "Do not multiply by the first number in a group before the whole group is finished: in the product of 5 and the sum of 2 and 3, the sum 5 comes first.",
  },
  "staar-signed-exponent-order": {
    goal: "Evaluate an integer expression with negative numbers, parentheses, a squared number, products, sums and differences.",
    intuition:
      "A square multiplies a number by itself. It is done before multiplication and before adding or subtracting. A negative number times a negative number is positive, so a difference that is negative can turn a minus sign into a plus.",
    terms: [
      ["square", "A number multiplied by itself. $5^{2}=5\\times5=25$."],
      [
        "opposite",
        "The number the same distance from 0 on the other side. The opposite of 9 is $-9$.",
      ],
    ],
    method: [
      "Work out what is inside parentheses first, keeping any negative result.",
      "Do exponents next. The exponent applies only to the number or group right before it.",
      "Do multiplication and division, then addition and subtraction, from left to right.",
      "Use the sign rule for products: same signs give a positive result, different signs give a negative result.",
    ],
    watch:
      "In $-6^{2}$ only the 6 is squared, so the result is $-36$. Write $(-6)^{2}$ when the minus sign is part of the number that is squared.",
  },
  "staar-number-word-form": {
    goal: "Choose the words for a number in expanded form, or the number named by counts of hundreds, tens and ones.",
    intuition:
      "A digit's place decides its value. To say a number in words, say the part in the thousands as a number and then the word “thousand”, then say the rest. A zero holds a place and says nothing aloud. A decimal is read as a whole number followed by its place name, such as thousandths.",
    terms: [
      [
        "expanded form",
        "A number written as a sum of the value of each digit, such as $400+30+2$.",
      ],
      [
        "word form",
        "A number written in words, such as four hundred thirty-two.",
      ],
    ],
    method: [
      "Add the terms to write the number in digits. Keep a zero in each place with no term.",
      "Read the digits in groups of three from the right: the thousands group, then the ones group.",
      "For a decimal, say the whole part, then “and”, then the digits after the point as a whole number with the name of the last place.",
      "For counts such as 36 hundreds, change each count to its value (3,600) and add.",
    ],
    watch:
      "Check each term's place before reading it: 5,000 is five thousand, and leaving out a zero place changes the number.",
  },
  "staar-rename-percent-fraction-decimal": {
    goal: "Rename a percent as a decimal, a fraction as a decimal or percent, or a decimal as a mixed number.",
    intuition:
      "Percent means per hundred, so 35% is 35 hundredths, or 0.35. A fraction bar means division, and a fraction greater than 1 is a number greater than 1. A decimal such as 4.58 is the whole number 4 plus 58 hundredths.",
    terms: [
      ["percent", "A number out of 100. The symbol % means “per hundred”."],
      [
        "mixed number",
        "A whole number and a fraction written together, such as $4\\frac{58}{100}$.",
      ],
    ],
    method: [
      "Percent to decimal: divide by 100, which moves the decimal point two places left.",
      "Fraction to decimal: divide the numerator by the denominator. To get a percent, multiply the decimal by 100.",
      "Decimal to mixed number: the whole part stays, and the decimal digits become the numerator over 10 for one place or 100 for two places.",
      "Check the size: a percent over 100 is more than 1, and a fraction over 1 is more than 1.",
    ],
    watch:
      "Write a zero in the tenths place when you need it: 4.07 is $4\\frac{7}{100}$, not $4\\frac{7}{10}$.",
  },
  "staar-ratio-statements": {
    goal: "Write a ratio from two counts in simplest form, use a part-to-part ratio with a total, or find a unit rate.",
    intuition:
      "A ratio compares two amounts by division. You can divide both amounts by the same number without changing the comparison, just as you simplify a fraction. A unit rate is a ratio in which the second amount is 1.",
    terms: [
      [
        "ratio",
        "A comparison of two amounts, written $a:b$ or “$a$ to $b$”, in the order stated.",
      ],
      ["unit rate", "The amount for one unit, such as 9 miles per hour."],
    ],
    method: [
      "Write the amounts in the order the question asks. “Red to blue” puts red first.",
      "Divide both amounts by their greatest common factor to simplify.",
      "For a part-to-part ratio and a total, add the ratio numbers to get the number of equal parts, divide the total by that, and multiply by the part you need.",
      "For a unit rate, divide the first amount by the second and attach both units in the order asked.",
    ],
    watch:
      "Keep the order of the units. 63 miles in 7 hours is 9 miles per hour, not 9 hours per mile.",
  },
  "staar-story-model-choice": {
    goal: "Choose the equation or expression that fits a story, or the one that does not.",
    intuition:
      "An equation says that two amounts are equal. To model a story, say what each group or part is, decide how the parts combine, and write that combination equal to the total. Division and multiplication facts come in families: if $4\\times n=36$ then $36\\div4=n$ and $36\\div n=4$.",
    terms: [
      [
        "unknown",
        "A letter standing for the number the story does not tell you.",
      ],
      [
        "fact family",
        "Related multiplication and division equations that use the same three numbers.",
      ],
    ],
    method: [
      "Name the unknown and say in words what the story combines.",
      "Write the combination as an equation: equal groups use multiplication, joining parts uses addition.",
      "Test a choice by putting in the number the story gives for the unknown. A correct model is true; a wrong one is false.",
      "When asked for the one that does not fit, find the three true choices and take the other one.",
    ],
    watch:
      "Division is not commutative: $36\\div4$ and $4\\div36$ are different. Check the order of the numbers.",
  },
  "staar-rate-equation-choice": {
    goal: "Find the amount for one unit from a total, then choose the equation for any number of units.",
    intuition:
      "At a steady rate the amount grows by the same number for every unit. Dividing the total by the number of units gives the amount for one unit. The amount for any number of units is that rate times the number of units.",
    terms: [
      [
        "steady rate",
        "An amount that changes by the same number for each unit, such as pounds per day.",
      ],
    ],
    method: [
      "Divide the total amount by the number of units to get the amount per unit.",
      "Write $\\text{amount}=\\text{rate}\\times\\text{units}$ with the letters from the story.",
      "Check a choice with one number of units from the story: the total should come out.",
    ],
    watch:
      "Do not flip the rate. Amount per unit is the amount divided by the units, and the amount for several units multiplies by it.",
  },
  "staar-order-decimals": {
    goal: "Order four decimals that have different numbers of places, or find the decimal in a given position.",
    intuition:
      "A decimal with more places is not always greater. To compare, give every number the same number of decimal places by adding zeros to the right, and then compare place by place from the left.",
    terms: [
      [
        "place value",
        "The value of a digit because of where it sits: tenths, hundredths, thousandths.",
      ],
    ],
    method: [
      "Write every number with the same number of decimal places, using zeros on the right.",
      "Compare the tenths digits first. If they match, compare the hundredths, then the thousandths.",
      "Order the numbers as asked, least to greatest or greatest to least.",
      "For a position such as the third, count in that order.",
    ],
    watch:
      "0.5 is greater than 0.45 even though 45 is greater than 5: 0.500 against 0.450 shows it.",
  },
  "staar-order-mixed-forms": {
    goal: "Order signed fractions and decimals, a fraction, percent, decimal and root, or choose the true comparison.",
    intuition:
      "To compare numbers in different forms, write each one as a decimal. A fraction is the numerator divided by the denominator, a percent is divided by 100, and a square root is estimated between two whole numbers. On a number line, the number farther left is less.",
    terms: [
      [
        "square root",
        "A number that gives the radicand when multiplied by itself. $\\sqrt{7}$ is between 2 and 3 because $2^2=4$ and $3^2=9$.",
      ],
    ],
    method: [
      "Rewrite every number as a decimal, estimating roots to two decimal places.",
      "Place the numbers on a number line. Negative numbers are less than positive numbers.",
      "Between two negatives, the one with the greater distance from 0 is less.",
      "Write the answer in the original forms.",
    ],
    watch:
      "250% is 2.5, not 250. Rewrite a percent before comparing it with a decimal or a fraction.",
  },
  "staar-decimal-operations": {
    goal: "Multiply, divide, add and subtract decimals in money and measurement stories, including a unit fraction.",
    intuition:
      "Decimal operations work like whole-number operations once the decimal point is placed. Hundredths multiplied by a whole number stay hundredths. Dividing a decimal total by a whole number keeps the decimal point straight above. A unit fraction can be written as a decimal first.",
    terms: [
      ["unit fraction", "A fraction with 1 on top, such as $\\frac{1}{4}$."],
    ],
    method: [
      "Decide the operation from the story: equal amounts each time divide, equal groups multiply, how many more subtracts.",
      "Multiply as whole numbers, then give the answer as many decimal places as the factors have in all.",
      "To divide a decimal by a whole number, keep the decimal point directly above the one in the dividend.",
      "To subtract, line up the decimal points and write the whole number with a decimal point and zeros.",
    ],
    watch:
      "Write 6 as 6.0 before subtracting 2.4. Lining up the decimal points keeps each place with its own place.",
  },
  "staar-salary-percent": {
    goal: "Find a percent raise of a salary, the new salary, or the difference in earnings of two jobs over several years.",
    intuition:
      "A percent of a number is that many hundredths of it. For a raise, find 1 percent by dividing the salary by 100 and multiply by the percent. A difference in yearly pay, repeated for each year, gives the difference over many years.",
    terms: [
      ["salary", "Money a worker earns in a year."],
      [
        "raise",
        "An increase in pay. A 3 percent raise is 3 percent of the old salary.",
      ],
    ],
    method: [
      "Find 1 percent of the salary: divide by 100.",
      "Multiply by the percent to find the raise. Add it to the old salary for the new salary.",
      "For two careers, subtract the yearly salaries and multiply the difference by the number of years.",
    ],
    watch:
      "A raise is the extra amount, not the new salary. Add the raise to the old salary only when the question asks for the new pay.",
  },
  "staar-measure-chains": {
    goal: "Chain perimeter and area: find a missing side first, or work with decimal sides and a square.",
    intuition:
      "Perimeter is the distance around a shape and area is the space it covers. When one is given and the other is asked, a side length connects them. A square has four equal sides, so its perimeter divided by 4 is its side.",
    terms: [
      [
        "perimeter",
        "The distance around a shape: for a rectangle, two lengths plus two widths.",
      ],
      [
        "area",
        "The number of unit squares that cover a shape: for a rectangle, length times width.",
      ],
    ],
    method: [
      "Write what the shape's perimeter or area says about its sides.",
      "Subtract the sides you know from the perimeter and split the rest to find a missing side.",
      "For a square, divide the perimeter by 4 to find the side.",
      "Use the side lengths for the quantity asked. Keep the units: square units for area.",
    ],
    watch:
      "Area is not the perimeter. After finding a side from the perimeter, multiply the sides for area.",
  },
  "staar-multistep-stories": {
    goal: "Solve a two-step story with whole numbers or units: add then subtract, share then regroup, multiply then divide or convert.",
    intuition:
      "A two-step story needs a first result before the question can be answered. Find the quantity the story gives indirectly, write it down, and then use it in the second step.",
    terms: [
      [
        "full serving",
        "A group of exactly the stated size. Leftover pieces that do not make a full group are not counted.",
      ],
    ],
    method: [
      "Find what the question asks, then find the quantity you need first.",
      "Do the first step and write its value.",
      "Use that value in the second step with the other numbers of the story.",
      "For a conversion row, find the amount for 1 unit by dividing, then multiply.",
    ],
    watch:
      "Answer the question that is asked. The result of the first step is only a stepping stone.",
  },
  "staar-line-from-points": {
    goal: "Choose the slope and intercept of a line from two points, the equation from a slope and a point, or the slope of $Ax+By=C$.",
    intuition:
      "A line is described by its slope, the change in $y$ for each change in $x$, and its $y$-intercept, the value of $y$ when $x=0$. Two points give the slope. One point and the slope give the intercept.",
    terms: [
      [
        "slope",
        "The change in $y$ divided by the change in $x$ between two points of a line.",
      ],
      [
        "$y$-intercept",
        "The value of $y$ where the line crosses the $y$-axis, when $x=0$.",
      ],
    ],
    method: [
      "Slope: subtract the $y$-values and the $x$-values in the same order and divide.",
      "Put one point into $y=mx+b$ with the slope and solve for $b$.",
      "For $Ax+By=C$, solve for $y$: $y=-\\frac{A}{B}x+\\frac{C}{B}$. The slope is the coefficient of $x$.",
      "Check the other point or one more value.",
    ],
    watch:
      "The $y$-value of a point is not the intercept unless the point has $x=0$.",
  },
  "staar-stem-leaf-combine": {
    goal: "Read a stem-and-leaf plot with its key, then add the two greatest values or subtract the second-least from the greatest.",
    intuition:
      "In a stem-and-leaf plot each value is split into a stem, its leading digits, and a leaf, its last digit. The key shows how to put them back together. Values are in order, so the least are at the top left and the greatest at the bottom right.",
    terms: [
      ["stem", "The leading digit or digits of a value, listed in a column."],
      ["leaf", "The last digit of a value, listed in the row of its stem."],
    ],
    method: [
      "Read the key: it shows what a stem and a leaf stand for together.",
      "Write the values you need as numbers, joining each stem with its leaf.",
      "Use the order of the plot: the last leaf of the last row is greatest, the first leaf of the first row is least.",
      "Add or subtract as asked.",
    ],
    watch:
      "A leaf alone is not the value. Join it with its stem before you add or subtract.",
  },
  "staar-dot-plot-threshold": {
    goal: "Count every dot at or beyond a stated value on a dot plot.",
    intuition:
      "A dot plot puts one dot above a value for each data item. The number of items with a property is the total number of dots above all the values with that property.",
    terms: [
      [
        "dot plot",
        "A display with one dot above a number line value for each data item.",
      ],
    ],
    method: [
      "Write which values count: less than, at least or greater than the stated value.",
      "Count the dots above each counted value.",
      "Add the counts. Do not count the stated value when the question says less than or greater than.",
    ],
    watch: "“Less than 3” does not include 3, but “at least 3” does.",
  },
  "staar-money-vocabulary": {
    goal: "Recognize credit, and tell variable expenses from fixed expenses using monthly amounts.",
    intuition:
      "Credit lets a person get something now and pay for it later, so the money is borrowed. A fixed expense costs the same each month, such as rent. A variable expense changes, such as the amount spent on groceries.",
    terms: [
      [
        "credit",
        "Borrowing money, or buying now and paying later, usually with a promise to pay back more.",
      ],
      ["fixed expense", "A cost that is the same amount every month."],
      ["variable expense", "A cost that changes from month to month."],
    ],
    method: [
      "For credit, ask whether the person gets the item before paying for it all.",
      "For fixed or variable, compare the amounts in a row. Equal amounts mean fixed.",
      "A tax or a deposit is not credit: it is a charge or saved money.",
    ],
    watch:
      "Paying a bill every month is not the same as a fixed expense. Look at whether the amounts are equal.",
  },
  "staar-table-rule-choice": {
    goal: "Choose the table in which every pair of values follows a stated add or multiply rule.",
    intuition:
      "A rule such as “multiply by 6” or $y=x+4$ must work for every pair. To test a table, apply the rule to each input and compare it with the output in the table.",
    terms: [
      [
        "input and output",
        "The input is the number put into the rule, $x$. The output is the result, $y$.",
      ],
    ],
    method: [
      "Apply the rule to each input $x$ to find the outputs you expect.",
      "Compare the expected outputs with each table, pair by pair.",
      "Reject a table at the first pair that does not match.",
    ],
    watch:
      "One wrong pair is enough to rule out a table, even when all the others match.",
  },
  "staar-multistep-equations": {
    goal: "Solve an equation by distributing, combining like terms or clearing fractions, with the variable possibly on both sides.",
    intuition:
      "To solve an equation, keep both sides equal while you get $x$ alone. First simplify each side: distribute over parentheses, combine like terms, or multiply by the denominator to clear fractions.",
    terms: [
      [
        "like terms",
        "Terms with the same variable part, such as $2x$ and $4x$.",
      ],
      [
        "distribute",
        "Multiply each term inside parentheses by the factor outside, including its sign.",
      ],
    ],
    method: [
      "Simplify each side: distribute, combine like terms, or multiply every term by the common denominator.",
      "Move the $x$ terms to one side and the numbers to the other by adding or subtracting the same thing on both sides.",
      "Divide by the coefficient of $x$.",
      "Check by putting the answer back into the original equation.",
    ],
    watch:
      "Distributing a negative changes the sign of every term inside: $-5(x+3)=-5x-15$.",
  },
  "staar-experiment-probability": {
    goal: "Find an experimental probability from a table, or the probability of two draws with replacement.",
    intuition:
      "An experimental probability is what actually happened: how many times the outcome occurred out of all the trials. When a draw is put back, the next draw has the same chances, so the probability of two draws in order is the product of the two probabilities.",
    terms: [
      [
        "experimental probability",
        "The number of times an outcome happened divided by the number of trials.",
      ],
      [
        "with replacement",
        "Each item is put back before the next draw, so the draws do not change each other.",
      ],
    ],
    method: [
      "For two outcomes, add their counts from the table, then divide by the number of trials.",
      "For two draws with replacement, find the probability of each draw from the same set and multiply.",
      "Write the fraction in simplest form.",
    ],
    watch:
      "Divide by the total number of trials, not by the count of the other outcomes.",
  },
  "staar-number-sets": {
    goal: "Place a number among whole numbers, integers and rational numbers, or say where a quotient belongs.",
    intuition:
      "The whole numbers 0, 1, 2, … are inside the integers, which also include the negatives. The integers are inside the rational numbers, which are all numbers that can be written as a fraction of integers. To place a number, first work out its value.",
    terms: [
      ["integer", "A whole number or its opposite: …, −2, −1, 0, 1, 2, …."],
      [
        "rational number",
        "A number that can be written as a fraction of two integers, such as $\\frac{3}{4}$ or $-2.5$.",
      ],
    ],
    method: [
      "Work out the value of the number, especially a quotient such as $\\frac{24}{3}$.",
      "If it is 0 or positive and has no fraction part, it is a whole number.",
      "If it has no fraction part but is negative, it is an integer that is not a whole number.",
      "If it has a fraction or decimal part, it is rational but not an integer.",
    ],
    watch:
      "A fraction can be a whole number: $\\frac{24}{3}=8$. Divide before you decide.",
  },
};

export const staarGapPrinciples: Record<string, string> = {
  "staar-nested-grouping":
    "Operations inside grouping symbols are evaluated first, innermost group first. Then multiplication and division are done from left to right, then addition and subtraction from left to right. “The sum of $a$ and $b$” means $(a+b)$.",
  "staar-signed-exponent-order":
    "The exponent applies to the number or group immediately before it, so $-c^{2}=-(c\\cdot c)$ while $(-c)^{2}=c^{2}$. The product of two numbers with the same sign is positive and with different signs is negative.",
  "staar-number-word-form":
    "A number is the sum of each digit times its place value, so $305{,}062=300{,}000+5{,}000+60+2$. A decimal $0.d_1d_2d_3$ with $n$ digits is the whole number $d_1d_2d_3$ divided by $10^{n}$, read with the place name of the last digit.",
  "staar-rename-percent-fraction-decimal":
    "$p\\%=\\frac{p}{100}$. A fraction $\\frac{a}{b}$ is $a\\div b$, and its percent form is $100\\cdot\\frac{a}{b}\\%$. A decimal with $n$ places equals its digits over $10^{n}$, so $w.xy=w\\frac{xy}{100}$.",
  "staar-ratio-statements":
    "Ratios $a:b$ and $ka:kb$ are equivalent for $k\\neq0$. If parts are in ratio $a:b$ with total $T$, the first part is $\\frac{a}{a+b}T$. A unit rate is $\\frac{a}{b}$ with $b$ as the unit.",
  "staar-story-model-choice":
    "If $g$ equal groups of $n$ make a total $T$, then $gn=T$, $T\\div g=n$ and $T\\div n=g$. If parts $a$, $b$ and $f$ make a total $T$, then $a+b+f=T$. An equation models a story exactly when it is true for the story's values.",
  "staar-rate-equation-choice":
    "At a constant rate $k$ per unit, the amount for $x$ units is $y=kx$. If $T$ is the amount for $D$ units, then $k=\\frac{T}{D}$.",
  "staar-order-decimals":
    "Decimals are compared place by place from the left after writing them with the same number of places. $0.5=0.500>0.450=0.45$ because $5$ tenths exceeds $4$ tenths.",
  "staar-order-mixed-forms":
    "Real numbers are ordered by their position on the number line. Fractions, percents and roots can be compared through their decimal values. For $a>0$, $\\sqrt{a}$ is the positive number whose square is $a$, so $n<\\sqrt{a}<n+1$ when $n^2<a<(n+1)^2$.",
  "staar-decimal-operations":
    "$0.01m\\times n=0.01(mn)$, so a product with two decimal places has two decimal places. A unit fraction $\\frac1q$ equals $1\\div q$. Equal parts of a total $T$ among $n$ are $T\\div n$.",
  "staar-salary-percent":
    "$p$ percent of $S$ is $\\frac{p}{100}S$, and after a raise of $p$ percent the new value is $S+\\frac{p}{100}S$. The difference over $n$ years of a constant yearly difference $d$ is $nd$.",
  "staar-measure-chains":
    "A rectangle with length $\\ell$ and width $w$ has perimeter $2(\\ell+w)$ and area $\\ell w$. A square of side $s$ has perimeter $4s$ and area $s^{2}$.",
  "staar-multistep-stories":
    "A quantity found in the first step is a given for the second. For $a$ groups of $b$ shared into servings of $c$, the number of full servings is $\\lfloor ab/c\\rfloor$. If $k$ of one unit equal $m$ of another, one unit equals $\\frac{m}{k}$.",
  "staar-line-from-points":
    "The line through $(x_1,y_1)$ and $(x_2,y_2)$ with $x_1\\neq x_2$ has slope $m=\\frac{y_2-y_1}{x_2-x_1}$ and $y$-intercept $b=y_1-mx_1$. For $B\\neq0$, the line $Ax+By=C$ has slope $-\\frac{A}{B}$.",
  "staar-stem-leaf-combine":
    "A stem-and-leaf plot stores each value as stem and leaf digits read together with its key. Values are listed in increasing order down the stems and left to right within a stem.",
  "staar-dot-plot-threshold":
    "The number of data items satisfying a condition is the sum over all qualifying values of the number of items equal to that value.",
  "staar-money-vocabulary":
    "Credit is an agreement to receive goods or money now and repay later, usually with interest or fees. A fixed expense is the same each period and a variable expense can differ each period.",
  "staar-table-rule-choice":
    "A table matches a rule exactly when every pair $(x,y)$ in it satisfies the rule. A single pair that does not satisfy it shows the table does not match.",
  "staar-multistep-equations":
    "An equivalent equation results from adding, subtracting, multiplying or dividing both sides by the same nonzero number, and from the distributive property $a(b+c)=ab+ac$. A linear equation $ax+b=cx+d$ with $a\\neq c$ has the unique solution $x=\\frac{d-b}{a-c}$.",
  "staar-experiment-probability":
    "The experimental probability of an outcome is its frequency divided by the number of trials. For independent draws, $P(A\\text{ then }B)=P(A)\\cdot P(B)$. Draws with replacement are independent.",
  "staar-number-sets":
    "$\\mathbb{W}\\subset\\mathbb{Z}\\subset\\mathbb{Q}$. A number is rational if it equals $\\frac{p}{q}$ with $p,q$ integers and $q\\neq0$; it is an integer if $q$ can be 1, and a whole number if in addition it is not negative.",
};

type LessonInput = Omit<Lesson, "sections"> & {
  intuition: [string, string[]];
};
const build = ({ intuition, ...rest }: LessonInput): Lesson => ({
  ...rest,
  sections: [
    { stage: "intuition", title: intuition[0], paragraphs: intuition[1] },
  ],
});
const method = (title: string, paragraphs: string[]) =>
  ({ stage: "method", title, paragraphs }) as const;
const formal = (title: string, paragraphs: string[]) =>
  ({ stage: "formal", title, paragraphs }) as const;

export const staarGapLessons: Lesson[] = [
  build({
    id: "staar-grouped-expressions",
    title: "Evaluate expressions with nested groups, negatives and exponents",
    summary:
      "Work inside the innermost group first, then exponents, then products and quotients, then sums and differences.",
    templateIds: ["staar-nested-grouping", "staar-signed-exponent-order"],
    objectives: [
      "Evaluate brackets around parenthesized groups and verbal products.",
      "Evaluate expressions with negative numbers and a squared number.",
    ],
    intuition: [
      "Groups are done first",
      [
        "You need to add, subtract, multiply and divide whole numbers and integers. Parentheses ( ) and brackets [ ] mark a group that is worked out as one number before the rest of the expression.",
        "A square such as $3^{2}$ means $3\\times3$ and is done before multiplication. A negative number times a negative number is positive.",
      ],
    ],
    workedExample: {
      prompt: "Evaluate $[(2+4)\\times(9-5)]-3\\times4$.",
      steps: [
        "Inside the bracket: $2+4=6$ and $9-5=4$.",
        "Multiply the groups: $6\\times4=24$.",
        "Multiply before subtracting: $3\\times4=12$.",
        "Subtract: $24-12=12$.",
      ],
      answer: "$12$",
    },
    closingSections: [
      method("Inside out, then left to right", [
        "Find the innermost groups, replace each with its value, and move outward. Then do exponents, multiplication and division, then addition and subtraction, each from left to right.",
        "“The product of 538 and the sum of 42 and 6” means $538\\times(42+6)$: the sum is a group.",
      ]),
      formal("Order of operations", [
        "Grouping symbols are evaluated first, then exponents, then multiplication and division from left to right, then addition and subtraction from left to right. The exponent in $-c^{2}$ applies only to $c$.",
      ]),
    ],
    pitfalls: [
      "In $-6^{2}$ only 6 is squared, so the value is $-36$.",
      "Finish a bracket before using what is outside it.",
    ],
    parentGuide:
      "Ask the learner to say which part of $4\\times(7-3)^{2}$ comes first and why.",
  }),
  build({
    id: "staar-number-words",
    title: "Write numbers in words and read place-value units",
    summary:
      "Read a number's digits by place: thousands first, then the rest, and say a decimal with the name of its last place.",
    templateIds: ["staar-number-word-form"],
    objectives: [
      "Write the word form of a number given in expanded form.",
      "Find the number named by counts of hundreds, tens and ones.",
    ],
    intuition: [
      "Each digit has a place",
      [
        "You need to know place value: in 7,305 the 7 is thousands, the 3 is hundreds, the 0 is tens and the 5 is ones. A zero keeps a place but is not said aloud.",
        "To say a number in words, say the thousands part as a number and then “thousand”, then say the rest.",
      ],
    ],
    workedExample: {
      prompt: "Write $600{,}000+4{,}000+300+8$ in words.",
      steps: [
        "Add the terms: $600{,}000+4{,}000+300+8=604{,}308$.",
        "The thousands part is 604: six hundred four thousand.",
        "The rest is 308: three hundred eight.",
      ],
      answer: "six hundred four thousand, three hundred eight",
    },
    closingSections: [
      method("Decimals and counts of units", [
        "A decimal is read as its whole part, “and”, then the digits after the point as a whole number with the name of the last place. $4.193$ is four and 193 thousandths.",
        "For “36 hundreds, 9 tens and 6 ones”, change each count to its value: $3600+90+6=3696$.",
      ]),
      formal("Place value", [
        "A number is the sum of each digit times its place value. A decimal with three places is the whole number formed by its digits divided by 1000.",
      ]),
    ],
    pitfalls: [
      "Leaving out a zero place changes the number: 605,000 is not 65,000.",
      "A decimal with three places is read in thousandths, not hundredths.",
    ],
    parentGuide:
      "Ask the learner to read 20,507 aloud and say what the 0 is for.",
  }),
  build({
    id: "staar-rename-forms",
    title: "Rename percents, fractions and decimals",
    summary:
      "A percent is hundredths, a fraction is a division, and a decimal is a whole part plus tenths or hundredths.",
    templateIds: ["staar-rename-percent-fraction-decimal"],
    objectives: [
      "Rename a percent as a decimal.",
      "Rename a fraction greater than 1 as a decimal or percent.",
      "Choose the true equality between a decimal and a mixed number.",
    ],
    intuition: [
      "Three names for one amount",
      [
        "You need to divide whole numbers. Percent means per hundred, so 35% is 35 hundredths or 0.35. A fraction bar means division, so $\\frac{9}{4}$ is $9\\div4=2.25$.",
        "A decimal like 4.58 is 4 and 58 hundredths, the mixed number $4\\frac{58}{100}$.",
      ],
    ],
    workedExample: {
      prompt: "Write $\\frac{7}{4}$ as a percent.",
      steps: [
        "Divide: $7\\div4=1.75$.",
        "Multiply by 100 to get a percent: $1.75\\times100=175$.",
        "Check: 175% is more than 100%, as $\\frac{7}{4}$ is more than 1.",
      ],
      answer: "$175\\%$",
    },
    closingSections: [
      method("Move the decimal point", [
        "Percent to decimal: divide by 100, moving the point two places left. Decimal to percent: multiply by 100, moving it two places right.",
        "For a decimal with a zero in the tenths place, keep the zero: $3.07=3\\frac{7}{100}$.",
      ]),
      formal("Equivalent forms", [
        "$p\\%=\\frac{p}{100}$. A decimal with $n$ places equals its digits over $10^{n}$.",
      ]),
    ],
    pitfalls: [
      "Moving the point one place too few or too many: check the size of your answer.",
      "A fraction over 1 gives a percent over 100.",
    ],
    parentGuide:
      "Ask the learner to write 4% as a decimal and explain where the zero goes.",
  }),
  build({
    id: "staar-ratio-forms",
    title: "Write ratios and unit rates",
    summary:
      "Write a ratio in the order asked, simplify it, and use a part-to-part ratio with a total.",
    templateIds: ["staar-ratio-statements"],
    objectives: [
      "Write a ratio from counts in simplest form.",
      "Find a part from a part-to-part ratio and a total.",
      "Choose a unit rate with its units in the right order.",
    ],
    intuition: [
      "A ratio compares two amounts",
      [
        "You need to multiply and divide whole numbers. A ratio compares two amounts in a stated order. 12 red to 18 blue is $12:18$, and dividing both numbers by 6 gives $2:3$.",
        "A unit rate says how much for one unit, such as 9 miles for each 1 hour.",
      ],
    ],
    workedExample: {
      prompt:
        "A mural uses gold and green tiles in the ratio 2 to 3. There are 30 tiles. How many are gold?",
      steps: [
        "The whole is $2+3=5$ equal parts.",
        "One part is $30\\div5=6$ tiles.",
        "Gold is 2 parts: $2\\times6=12$.",
      ],
      answer: "$12$ tiles",
    },
    closingSections: [
      method("Part to part and part to whole", [
        "A ratio of two colors compares part to part. To use a total, add the two numbers to see how many equal parts make the whole.",
        "For a unit rate, divide the first amount by the second and keep the units in the order asked.",
      ]),
      formal("Equivalent ratios", [
        "$a:b$ and $ka:kb$ are equivalent for $k\\neq0$. If parts are in ratio $a:b$ and the total is $T$, the first part is $\\frac{a}{a+b}T$.",
      ]),
    ],
    pitfalls: [
      "Keep the order: red to blue is not blue to red.",
      "Dividing the total by 3 would use only one of the numbers; use the sum.",
    ],
    parentGuide:
      "Ask which comes first in “the ratio of cats to dogs” and why.",
  }),
  build({
    id: "staar-story-models",
    title: "Choose the equation that fits a story",
    summary:
      "Say what the story combines, write it as an equation, and test a choice with the story's numbers.",
    templateIds: ["staar-story-model-choice", "staar-rate-equation-choice"],
    objectives: [
      "Choose an equation with an unknown factor or part for a story.",
      "Tell which equation or expression does not fit.",
      "Choose the equation for a quantity at a steady rate.",
    ],
    intuition: [
      "An equation says two amounts are equal",
      [
        "You need to multiply and divide. A letter such as $n$ stands for a number the story does not tell. If 4 friends share 36 stickers, each gets $n$, then 4 groups of $n$ make 36: $4\\times n=36$.",
        "The same facts give $36\\div4=n$ and $36\\div n=4$. They are in one fact family.",
      ],
    ],
    workedExample: {
      prompt:
        "Eli buys a book for 6.50 dollars and a map for 3.25 dollars. He also buys a pen. He spends 12 dollars in all. Let $p$ be the price of the pen. Write an equation.",
      steps: [
        "The three prices are added to make the total.",
        "The known prices are 6.50 and 3.25, and the pen costs $p$.",
        "The total is 12, so $6.50+3.25+p=12$.",
      ],
      answer: "$6.50+3.25+p=12$",
    },
    closingSections: [
      method("Test with the story's number", [
        "To check a choice, put in the value the story gives for the unknown. A true equation fits; a false one does not. For “which can NOT”, find the three true ones.",
        "For a steady rate, divide the total by the number of units to get the rate, then multiply the rate by the number of units.",
      ]),
      formal("Equations and rates", [
        "If $g$ equal groups of $n$ make $T$, then $gn=T$. At a constant rate $k$ per unit, the amount for $x$ units is $y=kx$ where $k=\\frac{T}{D}$ for a total $T$ over $D$ units.",
      ]),
    ],
    pitfalls: [
      "$36\\div4$ and $4\\div36$ are different. Check the order.",
      "Do not use the total as the rate: 65 pounds in 130 days is 0.5 pounds per day.",
    ],
    parentGuide:
      "Ask the learner to tell the story that goes with $3\\times n=24$.",
  }),
  build({
    id: "staar-order-numbers",
    title: "Order decimals, fractions, percents and roots",
    summary:
      "Write every number as a decimal with the same number of places, then compare from the left.",
    templateIds: ["staar-order-decimals", "staar-order-mixed-forms"],
    objectives: [
      "Order decimals with different numbers of places.",
      "Order signed fractions, decimals, percents and square roots.",
    ],
    intuition: [
      "Same form, then compare",
      [
        "You need to know tenths, hundredths and thousandths. A decimal with more places is not always greater: 0.5 is greater than 0.45 because 5 tenths is more than 4 tenths.",
        "To compare numbers in different forms, write each as a decimal: a fraction is a division, a percent is divided by 100, and a root is estimated between two whole numbers.",
      ],
    ],
    workedExample: {
      prompt: "Order $0.4$, $0.043$ and $0.35$ from least to greatest.",
      steps: [
        "Write each with three places: $0.400$, $0.043$, $0.350$.",
        "Compare tenths: 0, 3 and 4. The order is $0.043$, $0.350$, $0.400$.",
      ],
      answer: "$0.043,\\ 0.35,\\ 0.4$",
    },
    closingSections: [
      method("Negatives and roots", [
        "Between negative numbers the one farther from 0 is less: $-1.1<-0.6$. A square root like $\\sqrt{7}$ is between 2 and 3, about 2.65.",
      ]),
      formal("Order on the number line", [
        "Of two real numbers, the one to the left on the number line is less. Negative numbers are less than 0, and 0 is less than every positive number.",
      ]),
    ],
    pitfalls: [
      "250% is 2.5, not 250.",
      "A longer decimal is not always greater.",
    ],
    parentGuide: "Ask which is greater, 0.5 or 0.45, and how to prove it.",
  }),
  build({
    id: "staar-decimal-stories",
    title: "Solve decimal stories",
    summary:
      "Choose the operation from the story, then place the decimal point by lining up places or counting places.",
    templateIds: ["staar-decimal-operations"],
    objectives: [
      "Multiply a whole number by a value in hundredths.",
      "Divide a decimal total by a whole number.",
      "Subtract a tenths decimal or a unit fraction from a whole number or decimal.",
    ],
    intuition: [
      "Place the decimal point with care",
      [
        "You need to multiply, divide, add and subtract whole numbers. Money in dollars and measurements use decimals. Multiplying 59 by 0.18 is 59 times 18 hundredths, which is 1062 hundredths, or 10.62.",
        "To subtract, line up the decimal points. Write the whole number 6 as 6.0.",
      ],
    ],
    workedExample: {
      prompt:
        "Lia saved 44.40 dollars in 6 weeks, the same amount each week. How much per week?",
      steps: [
        "Equal amounts each week means divide: $44.40\\div6$.",
        "Keep the decimal point straight up: $44.40\\div6=7.4$.",
        "Check: $6\\times7.4=44.4$.",
      ],
      answer: "$7.4$ dollars",
    },
    closingSections: [
      method("Count places, line up points", [
        "For a product, multiply as whole numbers and give the answer as many decimal places as the factors have together. For a quotient, keep the point above the point.",
        "A unit fraction becomes a decimal by dividing: $\\frac{1}{4}=0.25$.",
      ]),
      formal("Decimal arithmetic", [
        "$0.01m\\times n=0.01(mn)$. $\\frac{1}{q}=1\\div q$. Subtracting aligned places keeps each place value with its own place.",
      ]),
    ],
    pitfalls: [
      "6 minus 2.4 is not 4.4 unless the point is aligned: $6.0-2.4=3.6$.",
      "The answer can be negative when you subtract a greater number.",
    ],
    parentGuide: "Ask the learner to estimate 59 times 0.18 before computing.",
  }),
  build({
    id: "staar-raises-and-earnings",
    title: "Find a raise and compare earnings",
    summary:
      "A raise is a percent of the salary; a yearly difference is repeated for each year.",
    templateIds: ["staar-salary-percent"],
    objectives: [
      "Find a percent raise of a salary.",
      "Find the new salary after a raise.",
      "Find the difference in earnings over several years.",
    ],
    intuition: [
      "A percent is hundredths of an amount",
      [
        "You need to multiply and divide whole numbers. 1 percent of a number is the number divided by 100. 3 percent is 3 of those.",
        "If one job pays more each year, the extra repeats every year.",
      ],
    ],
    workedExample: {
      prompt:
        "A salary of 40,000 dollars rises by 3 percent. What is the raise?",
      steps: [
        "1 percent of 40,000 is $40{,}000\\div100=400$.",
        "3 percent is $3\\times400=1{,}200$.",
      ],
      answer: "$1{,}200$ dollars",
    },
    closingSections: [
      method("Raise, new salary, years", [
        "New salary = old salary + raise. For two careers, subtract the yearly pay and multiply by the number of years.",
      ]),
      formal("Percent of an amount", [
        "$p$ percent of $S$ is $\\frac{p}{100}S$, and the new amount after a raise is $S+\\frac{p}{100}S$.",
      ]),
    ],
    pitfalls: [
      "The raise is only the extra pay.",
      "Use the difference, not each salary, when comparing over years.",
    ],
    parentGuide:
      "Ask what 1 percent of 50,000 is and how to use it for 4 percent.",
  }),
  build({
    id: "staar-perimeter-area-chains",
    title: "Chain perimeter and area",
    summary:
      "Find a missing side from the perimeter, then use the sides for the area; use decimals and squares.",
    templateIds: ["staar-measure-chains"],
    objectives: [
      "Find a width from a perimeter and a length, then the area.",
      "Find the perimeter of a rectangle with decimal sides.",
      "Find a square's area from its perimeter.",
    ],
    intuition: [
      "Sides connect perimeter and area",
      [
        "You need to multiply and add decimals. Perimeter is the distance around a rectangle, two lengths and two widths. Area is length times width, in square units.",
        "A square has four equal sides, so its perimeter divided by 4 is its side.",
      ],
    ],
    workedExample: {
      prompt:
        "A rectangle has perimeter 30 cm and length 9 cm. What is its area?",
      steps: [
        "Two lengths: $2\\times9=18$. The two widths make $30-18=12$.",
        "One width is $12\\div2=6$ cm.",
        "Area: $9\\times6=54$ square cm.",
      ],
      answer: "$54$ square cm",
    },
    closingSections: [
      method("Find the side first", [
        "Subtract the known sides from the perimeter and share the rest. For a square divide by 4. Then multiply sides for area.",
      ]),
      formal("Formulas", [
        "A rectangle has perimeter $2(\\ell+w)$ and area $\\ell w$. A square has perimeter $4s$ and area $s^{2}$.",
      ]),
    ],
    pitfalls: [
      "Do not give the perimeter when the area is asked.",
      "Area uses square units.",
    ],
    parentGuide:
      "Ask the learner to draw a 4 by 3 rectangle and compare its perimeter and area.",
  }),
  build({
    id: "staar-two-step-stories",
    title: "Solve two-step stories",
    summary:
      "Find the quantity the story gives indirectly first, then use it in the second step.",
    templateIds: ["staar-multistep-stories"],
    objectives: [
      "Add and then subtract to compare totals.",
      "Share, then regroup into piles.",
      "Multiply then divide into full servings, or convert units.",
    ],
    intuition: [
      "Two steps, one question",
      [
        "You need to add, subtract, multiply and divide whole numbers. Some questions cannot be answered until you find another amount first.",
        "Write the first result, then use it in the second step.",
      ],
    ],
    workedExample: {
      prompt:
        "A bakery has 12 trays with 6 rolls each. A box holds 4 rolls. How many full boxes?",
      steps: ["All the rolls: $12\\times6=72$.", "Boxes of 4: $72\\div4=18$."],
      answer: "$18$ boxes",
    },
    closingSections: [
      method("Name the first result", [
        "Say what the first step finds and write it down. When a conversion row is given, find the amount for 1 unit first.",
        "Only full groups count when the question asks for full servings.",
      ]),
      formal("Composition of steps", [
        "If $q_1=f(a,b)$ is found first and the answer is $g(q_1,c)$, the answer is $g(f(a,b),c)$. For full groups, use the quotient and ignore the remainder.",
      ]),
    ],
    pitfalls: [
      "Do not stop after the first step.",
      "Leftover pieces are not a full serving.",
    ],
    parentGuide: "Ask what the first thing to find is before solving.",
  }),
  build({
    id: "staar-lines-from-data",
    title: "Find a line's slope and intercept",
    summary:
      "Two points give the slope; a point and the slope give the intercept; standard form gives the slope $-\\frac{A}{B}$.",
    templateIds: ["staar-line-from-points"],
    objectives: [
      "Find slope and intercept from two points.",
      "Write an equation from a fractional slope and a point.",
      "Find the rate of change from standard form.",
    ],
    intuition: [
      "Slope and starting value",
      [
        "You need to subtract and divide integers. The slope $m$ of a line is how much $y$ changes when $x$ goes up by 1. The $y$-intercept $b$ is the value of $y$ when $x=0$. A line is $y=mx+b$.",
      ],
    ],
    workedExample: {
      prompt: "Find $m$ and $b$ for the line through $(1, 5)$ and $(3, 11)$.",
      steps: [
        "$m=\\frac{11-5}{3-1}=\\frac{6}{2}=3$.",
        "Put $(1, 5)$ in $y=3x+b$: $5=3+b$, so $b=2$.",
      ],
      answer: "$m=3,\\ b=2$",
    },
    closingSections: [
      method("Slope first, then intercept", [
        "Subtract the $y$-values and the $x$-values in the same order. Solve for $b$ with a point.",
        "For $Ax+By=C$, solve for $y$: the slope is $-\\frac{A}{B}$ and the intercept is $\\frac{C}{B}$.",
      ]),
      formal("Slope-intercept form", [
        "The line through $(x_1,y_1)$ and $(x_2,y_2)$ has $m=\\frac{y_2-y_1}{x_2-x_1}$ and $b=y_1-mx_1$.",
      ]),
    ],
    pitfalls: [
      "A point's $y$-value is not the intercept.",
      "Keep the same order in both subtractions.",
    ],
    parentGuide:
      "Ask where $y=2x+5$ crosses the $y$-axis and what happens to $y$ when $x$ goes up by 1.",
  }),
  build({
    id: "staar-read-plots",
    title: "Read values from stem-and-leaf and dot plots",
    summary:
      "Join stems and leaves with the key, and count the dots above every value that qualifies.",
    templateIds: ["staar-stem-leaf-combine", "staar-dot-plot-threshold"],
    objectives: [
      "Add or subtract values read from a stem-and-leaf plot.",
      "Count dots that satisfy a condition on a dot plot.",
    ],
    intuition: [
      "A display shows every value",
      [
        "You need to add and subtract whole numbers. In a stem-and-leaf plot the stem is the leading digits and the leaf is the last digit; the key shows how they join. A dot plot has one dot for each item.",
      ],
    ],
    workedExample: {
      prompt:
        "A dot plot has 2 dots above 1, 3 above 2, 4 above 3 and 1 above 4. How many are less than 3?",
      steps: [
        "The values less than 3 are 1 and 2.",
        "Count their dots: $2+3=5$.",
      ],
      answer: "$5$",
    },
    closingSections: [
      method("Use the order", [
        "A stem-and-leaf plot lists values from least at the top left to greatest at the bottom right. Join the stem and leaf before adding or subtracting.",
        "For a dot plot, “less than 3” does not include 3 but “at least 3” does.",
      ]),
      formal("Counting by value", [
        "The number of items satisfying a condition is the sum, over the qualifying values, of the number of items at each.",
      ]),
    ],
    pitfalls: [
      "A leaf alone is not the value.",
      "Check whether the stated value is included.",
    ],
    parentGuide: "Ask the learner to read the key before answering.",
  }),
  build({
    id: "staar-money-words",
    title: "Credit and fixed or variable expenses",
    summary:
      "Credit is getting something now and paying later; fixed expenses stay the same and variable expenses change.",
    templateIds: ["staar-money-vocabulary"],
    objectives: [
      "Recognize an example of credit.",
      "Tell a fixed expense from a variable expense by its monthly amounts.",
    ],
    intuition: [
      "Money words",
      [
        "You need to compare numbers. Credit means getting something now and paying for it later, so the money is borrowed. A tax is a charge, not a loan.",
        "A fixed expense costs the same each month. A variable expense costs different amounts in different months.",
      ],
    ],
    workedExample: {
      prompt:
        "Rent was 900, 900 and 900 dollars. Groceries were 310, 285 and 342 dollars. Which is variable?",
      steps: [
        "Rent is the same each month: fixed.",
        "Groceries change: variable.",
      ],
      answer: "Groceries",
    },
    closingSections: [
      method("Compare the row", [
        "Look at the amounts across months. Equal amounts mean fixed.",
      ]),
      formal("Definitions", [
        "Credit is an agreement to receive now and repay later. A fixed expense is the same each period; a variable expense can differ.",
      ]),
    ],
    pitfalls: [
      "A bill paid every month can still vary.",
      "Saving money is not credit.",
    ],
    parentGuide:
      "Ask the learner for one fixed and one variable expense at home.",
  }),
  build({
    id: "staar-rule-tables",
    title: "Check a table against a rule",
    summary:
      "Apply the rule to each input and compare it with the table's output; one wrong pair rules the table out.",
    templateIds: ["staar-table-rule-choice"],
    objectives: [
      "Choose the table that follows an add or multiply rule.",
      "Reject a table at the first pair that breaks the rule.",
    ],
    intuition: [
      "A rule must work for every pair",
      [
        "You need to add and multiply. A table lists pairs of an input $x$ and an output $y$. A rule like $y=x+4$ must give the table's $y$ for every $x$.",
      ],
    ],
    workedExample: {
      prompt: "Does the table with $x=1,2,3$ and $y=5,6,8$ follow $y=x+4$?",
      steps: [
        "$1+4=5$ and $2+4=6$ match.",
        "$3+4=7$ but the table says 8, so it does not match.",
      ],
      answer: "No",
    },
    closingSections: [
      method("Compute, then compare", [
        "Find the expected outputs first and compare each table with them.",
      ]),
      formal("Rules and tables", [
        "A table matches a rule exactly when every pair satisfies it.",
      ]),
    ],
    pitfalls: [
      "Checking only the first pair can miss a wrong later pair.",
      "A table can follow a different rule, such as adding the same number instead of multiplying.",
    ],
    parentGuide: "Ask the learner to make a table for $y=3x$.",
  }),
  build({
    id: "staar-multistep-linear",
    title: "Solve equations that need simplifying first",
    summary:
      "Distribute, combine like terms or clear fractions, then collect the $x$ terms and divide.",
    templateIds: ["staar-multistep-equations"],
    objectives: [
      "Distribute a negative factor and solve with variables on both sides.",
      "Combine like terms and solve.",
      "Clear fractions and solve.",
    ],
    intuition: [
      "Simplify, then undo",
      [
        "You need to solve two-step equations. Like terms have the same variable, so $2x+4x=6x$. Distributing multiplies each term inside parentheses, including its sign.",
        "If the equation has fractions, multiplying every term by the denominator clears them.",
      ],
    ],
    workedExample: {
      prompt: "Solve $-2(x+3)=x+9$.",
      steps: [
        "Distribute: $-2x-6=x+9$.",
        "Subtract $x$: $-3x-6=9$. Add 6: $-3x=15$.",
        "Divide by $-3$: $x=-5$.",
      ],
      answer: "$x=-5$",
    },
    closingSections: [
      method("Simplify each side first", [
        "Do the same thing to both sides. Move the $x$ terms to one side, the numbers to the other, then divide by the coefficient.",
        "Check by substituting the answer.",
      ]),
      formal("Linear equations", [
        "$ax+b=cx+d$ with $a\\neq c$ has the unique solution $x=\\frac{d-b}{a-c}$.",
      ]),
    ],
    pitfalls: [
      "Distribute the sign to every term: $-2(x+3)=-2x-6$.",
      "Combine only like terms.",
    ],
    parentGuide: "Ask the learner to check a solution by putting it in.",
  }),
  build({
    id: "staar-experimental-probability",
    title: "Experimental probability and two draws",
    summary:
      "Divide the favorable count by the trials; for draws with replacement, multiply the probabilities.",
    templateIds: ["staar-experiment-probability"],
    objectives: [
      "Find an experimental probability of one of two outcomes.",
      "Find the probability of two draws in order with replacement.",
    ],
    intuition: [
      "What happened, out of all trials",
      [
        "You need to write fractions. An experimental probability counts how often an outcome happened out of all the trials. If a tile is put back after each draw, the chances do not change for the next draw.",
      ],
    ],
    workedExample: {
      prompt:
        "In 20 draws, red came up 6 times and blue 4 times. What is the experimental probability of red or blue?",
      steps: ["Add: $6+4=10$.", "Divide by 20: $\\frac{10}{20}=\\frac{1}{2}$."],
      answer: "$\\frac{1}{2}$",
    },
    closingSections: [
      method("Multiply for independent draws", [
        "With replacement, find each draw's probability from the same set and multiply them.",
      ]),
      formal("Independent events", [
        "$P(A\\text{ then }B)=P(A)\\cdot P(B)$ when the draws are independent.",
      ]),
    ],
    pitfalls: [
      "Divide by all the trials, not by the other outcomes.",
      "Add the counts of both colors before dividing when two colors count.",
    ],
    parentGuide:
      "Ask why putting the card back keeps the second chance the same.",
  }),
  build({
    id: "staar-number-sets",
    title: "Whole numbers, integers and rational numbers",
    summary:
      "Work out a number's value, then place it among the whole numbers, integers and rational numbers.",
    templateIds: ["staar-number-sets"],
    objectives: [
      "Place a number in the correct region of nested sets.",
      "Fix a misplaced quotient.",
    ],
    intuition: [
      "Sets inside sets",
      [
        "You need to divide integers. The whole numbers are 0, 1, 2, …. The integers add the negative whole numbers. The rational numbers are the numbers that can be written as a fraction of integers, so they include decimals like 2.5.",
        "A fraction such as $\\frac{24}{3}$ equals 8, a whole number. Work out the value first.",
      ],
    ],
    workedExample: {
      prompt: "Where does $\\frac{-20}{5}$ belong?",
      steps: [
        "Divide: $\\frac{-20}{5}=-4$.",
        "−4 is an integer but is negative, so it is not a whole number.",
      ],
      answer: "Integers that are not whole numbers",
    },
    closingSections: [
      method("Ask in order", [
        "Is it a whole number? An integer? If it has a fraction or decimal part, it is rational but not an integer.",
      ]),
      formal("Number sets", [
        "Every whole number is an integer and every integer is rational, but not the other way round.",
      ]),
    ],
    pitfalls: [
      "A quotient can be a whole number: divide first.",
      "A negative integer is not a whole number, even though it is an integer.",
    ],
    parentGuide: "Ask the learner whether 0 is a whole number and why.",
  }),
];
