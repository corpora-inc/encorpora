import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

export const staarGapMethods: Record<string, ProblemMethod> = {
  "staar-nested-grouping": {
    goal: "Evaluate an expression with brackets around parentheses, or a product described in words, using the order of operations.",
    intuition:
      "Grouping symbols tell you what to do first. Parentheses and brackets mark a part of the expression that is worked out as one number before the rest. Words such as “the sum of 42 and 6” describe the same kind of group.",
    terms: [
      [
        "parentheses",
        "Brackets $[\\;]$ go around an expression that already contains parentheses.",
      ],
      "order-of-operations",
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
    terms: ["square-number", "opposite-number"],
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
    terms: ["expanded-form", "word-form"],
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
    goal: "Rename a percent as a decimal, a fraction as a decimal or percent, or a decimal as a mixed number (a whole number plus a fraction).",
    intuition:
      "Renaming means writing the same amount another way. Percent means “out of 100,” so 35% is 35 hundredths, or 0.35. A fraction bar means divide: $\\frac{9}{4}$ is $9 \\div 4 = 2.25$. A decimal such as 4.58 is 4 wholes plus 58 hundredths. A mixed number is a whole number with a fraction beside it, here $4\\frac{58}{100}$.",
    senses: { rename: "rename", "more than": "more-than" },
    noLink: ["whole", "part", "wholes"],
    terms: ["percent", "mixed-number"],
    method: [
      "Percent to decimal: divide by 100, which moves the decimal point two places left.",
      "Fraction to decimal: divide the top number by the bottom number. For a percent, multiply that decimal by 100.",
      "Decimal to mixed number: keep the whole number. Put the digits after the point over 10 for one digit, or over 100 for two.",
      "Check the size: a percent over 100% is more than 1, and so is a fraction of positive numbers whose top is bigger than its bottom.",
    ],
    watch:
      "Keep a zero in the tenths place when it is there: 4.07 is $4\\frac{7}{100}$, not $4\\frac{7}{10}$.",
  },
  "staar-ratio-statements": {
    goal: "Write a ratio from two counts in simplest form, split a total using a ratio, or find a unit rate (an amount for one unit).",
    intuition:
      "A ratio compares two amounts in a set order. 12 red to 18 blue is written $12:18$, read “12 to 18.” Dividing both numbers by the same number keeps the comparison, so $12:18$ is the same as $2:3$. A unit rate is the amount that goes with 1 of the second amount, such as 9 miles per hour.",
    senses: { part: "part", whole: "whole", unit: "unit" },
    terms: ["ratio", "unit-rate"],
    method: [
      "Write the amounts in the order the question asks. “Red to blue” puts red first.",
      "Simplify: divide both amounts by the largest number that divides both, their greatest common factor.",
      "With a total, add the ratio numbers to get the number of equal parts. Divide the total by that, then multiply by the parts you need.",
      "For a unit rate, divide the first amount by the second. Keep the units in the order asked.",
    ],
    watch:
      "Keep the order of the units. 63 miles in 7 hours is 9 miles per hour, not 9 hours per mile.",
  },
  "staar-story-model-choice": {
    goal: "Choose the equation or expression that fits a story, or the one that does not.",
    intuition:
      "An equation says that two amounts are equal. To model a story, say what each group or part is, decide how the parts combine, and write that combination equal to the total. Division and multiplication facts come in families: if $4\\times n=36$ then $36\\div4=n$ and $36\\div n=4$.",
    terms: ["unknown", "fact-family"],
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
        "rate",
        "A steady rate stays the same for every unit, such as 2 pounds per day.",
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
    terms: ["place-value"],
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
    terms: ["square-root"],
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
    goal: "Multiply, divide, add or subtract decimals in money and measurement stories, including a unit fraction such as $\\frac{1}{4}$.",
    intuition:
      "A decimal such as 0.18 means 18 hundredths. Work with decimals as with whole numbers, then place the decimal point. When multiplying, count the digits after the point in both numbers. When dividing by a whole number, keep the point straight above. When adding or subtracting, line up the points. A unit fraction, with 1 on top, becomes a decimal by dividing: $\\frac{1}{4} = 0.25$.",
    senses: { product: "product-multiply", factor: "factor-number" },
    noLink: ["tan"],
    terms: ["unit-fraction"],
    method: [
      "Choose the operation from the story. Sharing a total equally: divide. Total of equal groups: multiply. How much more, or how much is left: subtract.",
      "To multiply, ignore the points, then give the answer as many digits after the point as both numbers have together.",
      "To divide a decimal by a whole number, keep the decimal point straight above the one in the number being divided.",
      "To add or subtract, line up the points. Write a whole number such as 6 as 6.0.",
    ],
    watch:
      "Write 6 as 6.0 before subtracting 2.4. A tenth is one of 10 equal parts. Lining up the decimal points keeps tenths under tenths: $6.0 - 2.4 = 3.6$.",
  },
  "staar-salary-percent": {
    goal: "Find a percent raise of a salary, the new salary, or how much more one job earns than another over several years.",
    intuition:
      "A salary is the pay for one year of work. A raise is extra pay, often a percent of the salary. Percent means “out of 100,” so 1 percent of a salary is the salary divided by 100. If one job pays more each year, that extra is earned again every year.",
    senses: { difference: "difference-subtract" },
    terms: [
      ["income", "A salary is a fixed amount of pay for a year of work."],
      [
        "percent-change",
        "A raise is an increase in pay; a 3% raise adds 3% of the old salary.",
      ],
    ],
    method: [
      "Find 1 percent of the salary: divide it by 100.",
      "Multiply by the percent to find the raise. Add the raise to the old salary for the new salary.",
      "For two jobs, subtract the yearly salaries. Multiply that difference by the number of years.",
    ],
    watch:
      "A raise is the extra amount, not the new salary. Add the raise to the old salary only when the question asks for the new pay.",
  },
  "staar-measure-chains": {
    goal: "Chain perimeter and area: find a missing side first, or work with decimal sides and a square.",
    intuition:
      "Perimeter is the distance around a shape and area is the space it covers. When one is given and the other is asked, a side length connects them. A square has four equal sides, so its perimeter divided by 4 is its side.",
    terms: ["perimeter", "area"],
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
        "remainder",
        "Only full servings count; leftover pieces that do not make a full serving are the remainder.",
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
    goal: "Find a line's slope and intercept from two points, its equation from a slope and a point, or the slope of $Ax+By=C$.",
    intuition:
      "A line $y = mx + b$ ($mx$ means $m$ times $x$) is set by two numbers. The slope is how much $y$ changes when $x$ goes up by 1: the change in $y$ divided by the change in $x$. We call it $m$. The $y$-intercept is the value of $y$ when $x = 0$. We call it $b$. Two points give the slope. One point and the slope give $b$.",
    senses: {
      term: "term-expression",
      side: "side-of-equation",
      "standard form": "standard-form-line",
      difference: "difference-subtract",
    },
    noLink: ["change", "changes"],
    terms: ["slope", "y-intercept"],
    method: [
      "Slope: subtract the $y$-values and the $x$-values in the same order, then divide the $y$ difference by the $x$ difference.",
      "Put one point and the slope into $y=mx+b$. Solve for $b$.",
      "For $Ax+By=C$, get $y$ alone: $y=-\\frac{A}{B}x+\\frac{C}{B}$ when $B$ is not 0. The slope is the number multiplying $x$.",
      "Check with the other point or one more value.",
    ],
    watch:
      "The $y$-value of a point is not the intercept unless the point has $x=0$.",
  },
  "staar-stem-leaf-combine": {
    goal: "Read a stem-and-leaf plot with its key, then add the two greatest values or subtract the second-least from the greatest.",
    intuition:
      "In a stem-and-leaf plot each value is split into a stem, its leading digits, and a leaf, its last digit. The key shows how to put them back together. Values are in order, so the least are at the top left and the greatest at the bottom right.",
    terms: ["stem", "leaf"],
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
    terms: ["dot-plot"],
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
    terms: ["credit", "fixed-cost", "variable-cost"],
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
    terms: ["input", "output"],
    method: [
      "Apply the rule to each input $x$ to find the outputs you expect.",
      "Compare the expected outputs with each table, pair by pair.",
      "Reject a table at the first pair that does not match.",
    ],
    watch:
      "One wrong pair is enough to rule out a table, even when all the others match.",
  },
  "staar-multistep-equations": {
    goal: "Solve an equation by multiplying out parentheses, combining like terms or clearing fractions, with $x$ possibly on both sides.",
    intuition:
      "An equation says its left side (the part before the equals sign) equals its right side. To solve it, get $x$ alone while keeping both sides equal. First tidy each side. A term is one piece joined by + or −. Distribute: a number before parentheses, called the factor, multiplies every term inside, sign included. Like terms are pieces with the same letter part; combine them, such as $2x + 4x = 6x$. Clear a fraction by multiplying every term by its denominator.",
    senses: {
      term: "term-expression",
      side: "side-of-equation",
      factor: "factor-number",
    },
    noLink: ["changes", "part"],
    terms: ["like-terms", "distribute"],
    method: [
      "Tidy each side: distribute, combine like terms, or multiply every term by the common denominator.",
      "Move the $x$ terms to one side and the numbers to the other by adding or subtracting the same thing on both sides.",
      "Divide both sides by the number multiplying $x$, its coefficient.",
      "Check by putting the answer back into the original equation.",
    ],
    watch:
      "Distributing a negative number, one less than 0, changes the sign of every term inside: $-5(x+3)=-5x-15$.",
  },
  "staar-experiment-probability": {
    goal: "Find an experimental probability from a table of results, or the probability of two draws when the first is put back.",
    intuition:
      "A trial is one try, such as one draw from a bag. An experimental probability is what actually happened: the number of times an outcome came up divided by the number of trials. When a drawn item is put back, the next draw has the same chances. Then the chance of one result and then another is the two probabilities multiplied.",
    senses: { trial: "trial", product: "product-multiply" },
    noLink: ["change"],
    terms: ["experimental-probability", "with-replacement"],
    method: [
      "If either of two outcomes counts and no trial can show both, add their counts from the table. Divide by the total number of trials.",
      "For two draws with replacement, find each draw's probability from the same full set, then multiply.",
      "Write the fraction in simplest form.",
    ],
    watch:
      "Divide by the total number of trials, not by the count of the other outcomes.",
  },
  "staar-number-sets": {
    goal: "Place a number among the whole numbers, integers and rational numbers, or say where a quotient (a division answer) belongs.",
    intuition:
      "The whole numbers are 0, 1, 2, and so on. They sit inside the integers, which also include their opposites, the negatives such as $-4$. The integers sit inside the rational numbers: every number that can be written as a fraction of integers, with a bottom that is not 0. To place a number, first work out its value.",
    senses: { opposite: "opposite-number" },
    noLink: ["part"],
    terms: ["integer", "rational-number"],
    method: [
      "Work out the value of the number. A fraction bar means divide, so $\\frac{24}{3}$ is $24 \\div 3$.",
      "If it is 0 or positive with no fraction part, it is a whole number.",
      "If it has no fraction part but is negative, it is an integer that is not a whole number.",
      "If it is a fraction of integers, or a decimal that ends or repeats, with a part left over, it is rational but not an integer.",
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
    "For any number $p$, $p\\%=\\frac{p}{100}$. A fraction $\\frac{a}{b}$ with $b\\neq0$ ($b$ is not 0) means $a\\div b$, and its percent form is $100\\times(a\\div b)$ percent. A decimal 0 or greater with $n$ digits after the point is its whole-number part plus those digits over $10^{n}$. Here $10^{n}$ is 1 followed by $n$ zeros. So $4.58=4\\frac{58}{100}$.",
  "staar-ratio-statements":
    "For positive amounts $a$ and $b$, the ratios $a:b$ and $ka:kb$ are equivalent for any number $k>0$ ($k$ greater than 0). If two parts are in the ratio $a:b$ and the total is $T$, the first part is $\\frac{a}{a+b}\\times T$. A unit rate is $a\\div b$, the amount of the first quantity for 1 unit of the second.",
  "staar-story-model-choice":
    "If $g$ equal groups of $n$ make a total $T$, then $gn=T$, $T\\div g=n$ and $T\\div n=g$. If parts $a$, $b$ and $f$ make a total $T$, then $a+b+f=T$. An equation models a story exactly when it is true for the story's values.",
  "staar-rate-equation-choice":
    "At a constant rate $k$ per unit, the amount for $x$ units is $y=kx$. If $T$ is the amount for $D$ units, then $k=\\frac{T}{D}$.",
  "staar-order-decimals":
    "Decimals are compared place by place from the left after writing them with the same number of places. $0.5=0.500>0.450=0.45$ because $5$ tenths exceeds $4$ tenths.",
  "staar-order-mixed-forms":
    "Real numbers are ordered by their position on the number line. Fractions, percents and roots can be compared through their decimal values. For $a>0$, $\\sqrt{a}$ is the positive number whose square is $a$, so $n<\\sqrt{a}<n+1$ when $n^2<a<(n+1)^2$.",
  "staar-decimal-operations":
    "Hundredths times a whole number are hundredths: $0.01m\\times n=0.01(mn)$, where $mn$ means $m$ times $n$. So the answer has two digits after the point. A unit fraction $\\frac1q$, with $q$ one of the numbers 1, 2, 3 and so on, equals $1\\div q$. Sharing a total $T$ equally among $n$ groups gives $T\\div n$ in each.",
  "staar-salary-percent":
    "$p$ percent of an amount $S$ is $\\frac{p}{100}\\times S$. After a raise of $p$ percent, the new amount is $S+\\frac{p}{100}\\times S$. If one salary is $d$ dollars more every year, then over $n$ years it earns $n\\times d$ dollars more.",
  "staar-measure-chains":
    "A rectangle with length $\\ell$ and width $w$ has perimeter $2(\\ell+w)$ and area $\\ell w$. A square of side $s$ has perimeter $4s$ and area $s^{2}$.",
  "staar-multistep-stories":
    "A quantity found in the first step is a given for the second. For $a$ groups of $b$ shared into servings of $c$, the number of full servings is $\\lfloor ab/c\\rfloor$. If $k$ of one unit equal $m$ of another, one unit equals $\\frac{m}{k}$.",
  "staar-line-from-points":
    "The line through two points $(x_1,y_1)$ and $(x_2,y_2)$ with $x_1\\neq x_2$ has slope $m=\\frac{y_2-y_1}{x_2-x_1}$ and $y$-intercept $b=y_1-mx_1$. (The small 1 and 2 label the first and second point.) For $B\\neq0$, the line $Ax+By=C$ has slope $-\\frac{A}{B}$.",
  "staar-stem-leaf-combine":
    "A stem-and-leaf plot stores each value as stem and leaf digits read together with its key. Values are listed in increasing order down the stems and left to right within a stem.",
  "staar-dot-plot-threshold":
    "The number of data items satisfying a condition is the sum over all qualifying values of the number of items equal to that value.",
  "staar-money-vocabulary":
    "Credit is an agreement to receive goods or money now and repay later, usually with interest or fees. A fixed expense is the same each period and a variable expense can differ each period.",
  "staar-table-rule-choice":
    "A table matches a rule exactly when every pair $(x,y)$ in it satisfies the rule. A single pair that does not satisfy it shows the table does not match.",
  "staar-multistep-equations":
    "Adding or subtracting the same number on both sides, multiplying or dividing both sides by the same number other than 0, and using the distributive property $a(b+c)=ab+ac$ all give an equation with the same solutions. A linear equation $ax+b=cx+d$ with $a\\neq c$ ($a$ not equal to $c$) has exactly one solution, $x=\\frac{d-b}{a-c}$.",
  "staar-experiment-probability":
    "The experimental probability of an outcome is the number of times it happened divided by the number of trials. Draws with replacement are independent: one does not change the chances of the other. For independent draws, $P(A\\text{ then }B)=P(A)\\times P(B)$, where $P(A)$ means the probability of $A$.",
  "staar-number-sets":
    "Every whole number is an integer, and every integer is a rational number. A number is rational if it equals $\\frac{p}{q}$ with $p$ and $q$ integers and $q\\neq0$ ($q$ not 0). It is an integer if it can be written with $q=1$, and a whole number if it is also not negative.",
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
      "One amount can be written in different ways. Percent means “out of 100,” so 35% is 35 hundredths, or 0.35. A fraction bar means divide, so $\\frac{7}{4}$ is $7 \\div 4 = 1.75$. A decimal is a number written with a decimal point. Multiply a decimal by 100 to get a percent: 1.75 is 175%. Renaming means writing a number another way. It changes how the number looks, never how much it is.",
    senses: { rename: "rename", "more than": "more-than" },
    noLink: ["whole", "part", "changes", "wholes"],
    templateIds: ["staar-rename-percent-fraction-decimal"],
    objectives: [
      "Rename a percent as a decimal by dividing by 100.",
      "Rename a fraction greater than 1 as a decimal or a percent.",
      "Choose the true match between a decimal and a mixed number, a whole number plus a fraction.",
    ],
    intuition: [
      "Three names for one amount",
      [
        "You need to divide whole numbers. To rename a number means to write the same amount another way.",
        "Percent means “out of 100.” The sign % is read “percent.” So 35% is 35 out of 100, which is 35 hundredths, written 0.35. And 100% is 100 hundredths, which is 1 whole.",
        "A fraction has two numbers. The numerator is the top number. The denominator is the bottom number. The fraction bar means divide the top by the bottom. So $\\frac{9}{4}$ is $9 \\div 4 = 2.25$. When both numbers are positive and the top is bigger than the bottom, the fraction is more than 1.",
        "In a decimal, the digits after the point are tenths, then hundredths. So 4.58 is 4 wholes and 58 hundredths. As a mixed number, a whole number with a fraction beside it, that is $4\\frac{58}{100}$.",
      ],
    ],
    workedExample: {
      prompt: "Write $\\frac{7}{4}$ as a percent.",
      steps: [
        "A fraction bar means divide, so divide the top by the bottom: $7 \\div 4 = 1.75$.",
        "Percent means out of 100, so multiply by 100 to count hundredths: $1.75 \\times 100 = 175$. The answer is 175%.",
        "Check the size: $\\frac{7}{4}$ is more than 1, because 7 is more than 4. One whole is 100%, so the percent must be more than 100%. It is.",
      ],
      answer: "$175\\%$",
    },
    closingSections: [
      method("Move the decimal point", [
        "Percent to decimal: divide by 100. That moves the decimal point two places to the left, so 35% becomes 0.35 and 4% becomes 0.04.",
        "Decimal to percent: multiply by 100. That moves the point two places to the right, so 0.6 becomes 60%.",
        "Decimal to mixed number: keep the whole number. Put the digits after the point over 10 for one digit, or over 100 for two digits. Keep a zero in the tenths place: $3.07 = 3\\frac{7}{100}$, not $3\\frac{7}{10}$.",
      ]),
      formal("Equivalent forms", [
        "Let $p$ be any number. Then $p\\% = \\frac{p}{100}$.",
        "A fraction $\\frac{a}{b}$, with $b$ not 0, means $a \\div b$. Its percent is $100 \\times (a \\div b)$ percent.",
        "Take a decimal 0 or greater with $n$ digits after the point. It equals its whole-number part plus those digits over $10^{n}$, which means 1 followed by $n$ zeros. So $0.58 = \\frac{58}{100}$ and $4.58 = 4\\frac{58}{100}$.",
      ]),
    ],
    pitfalls: [
      "Move the point exactly two places for percents. Then check the size of your answer.",
      "A fraction more than 1 is a percent more than 100%.",
      "Keep zeros that hold a place: 4% is 0.04, not 0.4.",
    ],
    parentGuide:
      "Ask the learner to write 4% as a decimal and explain why the zero goes right after the point.",
  }),
  build({
    id: "staar-ratio-forms",
    title: "Write ratios and unit rates",
    summary:
      "A ratio compares two amounts, such as 12 red beads to 18 blue beads. We write it $12:18$, read “12 to 18,” in the order the question names them. Dividing both numbers by the same number keeps the comparison the same, so $12:18$ is also $2:3$. A unit rate tells how much for one, like 9 miles for each 1 hour.",
    senses: {
      part: "part",
      whole: "whole",
      unit: "unit",
      average: "mean-average",
    },
    templateIds: ["staar-ratio-statements"],
    objectives: [
      "Write a ratio from two counts and simplify it.",
      "Find one amount from a part-to-part ratio, like gold to green, and the total.",
      "Choose a unit rate, an amount for one unit, with its units in the right order.",
    ],
    intuition: [
      "A ratio compares two amounts",
      [
        "You need to multiply and divide whole numbers. A ratio compares two amounts in a set order. With 12 red beads and 18 blue beads, the ratio of red to blue is $12:18$. The colon : is read “to.”",
        "Picture the beads in groups of 6, all the same size. There are 2 groups of red and 3 groups of blue. So for every 2 red there are 3 blue, and $12:18$ is the same comparison as $2:3$. Dividing both numbers by the same number keeps the ratio the same, just like simplifying a fraction.",
        "A ratio of whole numbers is in simplest form when no whole number larger than 1 divides both numbers evenly. The largest number that divides both is called the greatest common factor. For 12 and 18 it is 6.",
        "A unit rate says how much of the first amount goes with 1 of the second. If a car goes 63 miles in 7 hours, its unit rate is $63 \\div 7 = 9$ miles per hour on average, which means as if every hour were the same.",
      ],
    ],
    workedExample: {
      prompt:
        "A mural uses gold and green tiles in the ratio 2 to 3. There are 30 tiles. How many are gold?",
      steps: [
        "The ratio 2 to 3 means: in every group of 5 tiles, 2 are gold and 3 are green. So the whole is $2 + 3 = 5$ equal parts.",
        "Share the 30 tiles among the 5 parts: $30 \\div 5 = 6$ tiles in each part.",
        "Gold has 2 of the parts: $2 \\times 6 = 12$ tiles. Check: green is $3 \\times 6 = 18$, and $12 + 18 = 30$.",
      ],
      answer: "$12$ tiles",
    },
    closingSections: [
      method("Part to part and part to whole", [
        "A ratio of gold to green compares one part to the other part. It is called part to part.",
        "To use a total, add the two ratio numbers. That gives how many equal parts make the whole. Divide the total by that number to find one part. Then multiply by the number of parts you need.",
        "For a unit rate, divide the first amount by the second. Say the units in the order asked: miles per hour means miles for each 1 hour.",
      ]),
      formal("Equivalent ratios", [
        "Let $a$ and $b$ be positive numbers, and $k$ a number greater than 0. Then $a:b$ and $ka:kb$ are equivalent ratios, which are ratios that make the same comparison. Here $ka$ means $k$ times $a$.",
        "If two parts are in the ratio $a:b$ and the total is $T$, the first part is $\\frac{a}{a+b} \\times T$.",
        "A unit rate is $a \\div b$, the amount of the first quantity for 1 unit of the second.",
      ]),
    ],
    pitfalls: [
      "Keep the order the question asks: red to blue is not blue to red.",
      "With a total, divide by the sum of the ratio numbers, $2 + 3 = 5$, not by just one of them.",
      "Keep the units in order: 9 miles per hour, not 9 hours per mile.",
    ],
    parentGuide:
      "Ask which number comes first in “the ratio of cats to dogs” and why. Then ask for the ratio in simplest form for 4 cats and 6 dogs.",
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
      "Money and measurements often use decimals, numbers with a point such as 7.40. First read the story to choose the operation. Sharing a total equally means divide. Finding the total of equal groups means multiply. “How much is left” means subtract. Then work as with whole numbers, and put the decimal point in the right place. For example, 44.40 dollars shared over 6 weeks is $44.40 \\div 6 = 7.4$ dollars a week.",
    senses: { product: "product-multiply", factor: "factor-number" },
    noLink: ["tan", "mean"],
    templateIds: ["staar-decimal-operations"],
    objectives: [
      "Multiply a whole number by a decimal in hundredths, such as 0.18.",
      "Divide a decimal total into equal shares.",
      "Subtract a decimal or a unit fraction (a fraction with 1 on top, such as $\\frac{1}{4}$) from a whole number or a decimal.",
    ],
    intuition: [
      "Place the decimal point with care",
      [
        "You need to multiply, divide, add and subtract whole numbers. A tenth is one of 10 equal parts, and a hundredth is one of 100 equal parts. In a decimal, the first digit after the point counts tenths and the second counts hundredths. So 0.18 is 18 hundredths.",
        "Multiplying works like whole numbers. 59 times 0.18 is 59 times 18 hundredths. That is 1,062 hundredths, which is 10.62.",
        "Dividing a decimal by a whole number also works like whole numbers. Keep the decimal point in the answer straight above the point in the number being divided.",
        "To add or subtract, line up the decimal points so tenths sit under tenths. A whole number has a point at its end, so 6 is the same as 6.0. Then $6.0 - 2.4 = 3.6$.",
        "A unit fraction has 1 on top, like $\\frac{1}{4}$. The fraction bar means divide, so $\\frac{1}{4} = 1 \\div 4 = 0.25$. Write it as a decimal first, then work with decimals.",
      ],
    ],
    workedExample: {
      prompt:
        "Lia saved 44.40 dollars in 6 weeks, the same amount each week. How much per week?",
      steps: [
        "The same amount each week means the total is shared equally among 6 weeks. Sharing equally is division: $44.40 \\div 6$.",
        "Divide as with whole numbers and keep the point straight above: $44.40 \\div 6 = 7.40$, which is the same as 7.4.",
        "Check by multiplying back, because multiplying undoes dividing: $6 \\times 7.4 = 44.4$. That matches 44.40 dollars.",
      ],
      answer: "$7.4$ dollars",
    },
    closingSections: [
      method("Count places, line up points", [
        "For a product, the answer when you multiply, work as if there were no points. Then count the digits after the point in both numbers together. Give the answer that many digits after its point. For $59 \\times 0.18$, there are 2 such digits, so 1062 becomes 10.62.",
        "For division by a whole number, keep the point above the point.",
        "To add or subtract, line up the points and fill empty places with zeros.",
      ]),
      formal("Decimal arithmetic", [
        "Hundredths times a whole number are still hundredths: $m$ hundredths times $n$ is $m \\times n$ hundredths.",
        "A unit fraction $\\frac{1}{q}$, where $q$ is one of the numbers 1, 2, 3 and so on, equals $1 \\div q$.",
        "Sharing a total $T$ equally among $n$ groups gives $T \\div n$ in each group.",
      ]),
    ],
    pitfalls: [
      "Line up the decimal points before subtracting: $6.0 - 2.4 = 3.6$, not 4.4.",
      "Count the digits after the point in both numbers when you multiply.",
      "Subtracting a larger number from a smaller one gives a negative answer, a number less than 0.",
    ],
    parentGuide:
      "Ask the learner to estimate 59 times 0.18 before working it out. About 60 times one fifth is about 12, so 10.62 is reasonable.",
  }),
  build({
    id: "staar-raises-and-earnings",
    title: "Find a raise and compare earnings",
    summary:
      "A salary is the pay for one year of work. A raise is an increase in pay. Raises are often given in percent, which means “out of 100.” So 1 percent of 40,000 dollars is $40{,}000 \\div 100 = 400$ dollars. A 3 percent raise is 3 of those, 1,200 dollars. If one job pays 5,000 dollars more each year, over 10 years it pays 50,000 dollars more.",
    senses: { difference: "difference-subtract" },
    noLink: ["part", "parts"],
    templateIds: ["staar-salary-percent"],
    objectives: [
      "Find a percent raise of a salary.",
      "Find the new salary after a raise, the old salary plus the raise.",
      "Find the difference in earnings between two jobs over several years.",
    ],
    intuition: [
      "A percent is hundredths of an amount",
      [
        "You need to multiply and divide whole numbers. A salary is the amount of money a job pays for one year of work.",
        "Percent means “out of 100.” So 1 percent of an amount is the amount split into 100 equal parts, and taking one part. To find it, divide by 100. Then 3 percent is 3 of those parts.",
        "A raise is extra pay added to a salary. A 3 percent raise on 40,000 dollars adds 3 percent of 40,000 dollars.",
        "To compare two jobs, look at how much more one pays each year. That extra amount is earned again every year. So multiply it by the number of years.",
      ],
    ],
    workedExample: {
      prompt:
        "A salary of 40,000 dollars rises by 3 percent. What is the raise?",
      steps: [
        "Find 1 percent of the salary by dividing by 100, because percent means out of 100: $40{,}000 \\div 100 = 400$.",
        "A 3 percent raise is 3 of those amounts: $3 \\times 400 = 1{,}200$. The raise is 1,200 dollars. The new salary would be $40{,}000 + 1{,}200 = 41{,}200$ dollars.",
      ],
      answer: "$1{,}200$ dollars",
    },
    closingSections: [
      method("Raise, new salary, years", [
        "The raise is only the extra amount. The new salary is the old salary plus the raise.",
        "To compare two careers over several years, subtract the two yearly salaries first. That difference is the extra pay each year. Multiply it by the number of years.",
        "For example, 52,000 dollars and 47,000 dollars differ by 5,000 dollars a year. Over 10 years that is $10 \\times 5{,}000 = 50{,}000$ dollars.",
      ]),
      formal("Percent of an amount", [
        "Let $S$ be a salary and $p$ a percent. Then $p$ percent of $S$ is $\\frac{p}{100} \\times S$.",
        "After a raise of $p$ percent, the new salary is $S + \\frac{p}{100} \\times S$.",
        "If one salary is $d$ dollars more every year, then over $n$ years it earns $n \\times d$ dollars more.",
      ]),
    ],
    pitfalls: [
      "The raise is only the extra pay. Add it to the old salary only when the question asks for the new salary.",
      "To compare jobs over years, multiply the yearly difference by the years, or find each job's total and subtract. Do not subtract one yearly salary from the other job's total.",
    ],
    parentGuide:
      "Ask what 1 percent of 50,000 is, and how to use that to find 4 percent.",
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
      "A straight line on a graph that is not vertical (straight up and down) can be described by two numbers. The slope tells how much $y$ goes up (or down) each time $x$ goes up by 1. The $y$-intercept is the value of $y$ where the line crosses the $y$-axis, which is where $x = 0$. For the points $(1, 5)$ and $(3, 11)$, $y$ rises 6 while $x$ rises 2, so the slope is $6 \\div 2 = 3$.",
    senses: {
      term: "term-expression",
      side: "side-of-equation",
      "standard form": "standard-form-line",
    },
    noLink: ["change", "changes", "parts"],
    templateIds: ["staar-line-from-points"],
    objectives: [
      "Find the slope and the $y$-intercept of a line from two points on it.",
      "Write the equation of a line from its slope, even a fraction, and one point.",
      "Find the slope of a line written as $Ax + By = C$.",
    ],
    intuition: [
      "Slope and starting value",
      [
        "You need to subtract and divide integers: the numbers 0, 1, 2, 3 and so on, and their negatives. A point $(x, y)$ gives two numbers: first how far across, then how far up.",
        "The slope of a line is how much $y$ changes when $x$ goes up by 1. We call it $m$. Find it from two points: divide the change in $y$ by the change in $x$. From $(1, 5)$ to $(3, 11)$, $y$ changes by $11 - 5 = 6$ and $x$ changes by $3 - 1 = 2$. So $m = 6 \\div 2 = 3$.",
        "The $y$-intercept is the value of $y$ when $x = 0$, where the line crosses the $y$-axis. We call it $b$.",
        "Every non-vertical line can be written $y = mx + b$. Here $mx$ means $m$ times $x$. For example, $y = 3x + 2$ has slope 3 and $y$-intercept 2.",
      ],
    ],
    workedExample: {
      prompt: "Find $m$ and $b$ for the line through $(1, 5)$ and $(3, 11)$.",
      steps: [
        "Find the slope: change in $y$ divided by change in $x$, subtracting in the same order. $m=\\frac{11-5}{3-1}=\\frac{6}{2}=3$.",
        "Find $b$. The point $(1, 5)$ is on the line, so $x = 1$ and $y = 5$ make $y = 3x + b$ true. Put them in: $5 = 3 \\times 1 + b$, so $5 = 3 + b$.",
        "Subtract 3 from both sides (the parts before and after the equals sign) to get $b$ alone: $b = 2$. Check with the other point: $3 \\times 3 + 2 = 11$. It works.",
      ],
      answer: "$m=3,\\ b=2$",
    },
    closingSections: [
      method("Slope first, then intercept", [
        "Subtract the $y$-values and the $x$-values in the same order, then divide. Then put one point and the slope into $y = mx + b$ and solve for $b$.",
        "The two points must have different $x$-values. If the $x$-values are equal, the line is vertical and has no slope.",
      ]),
      method("Lines in standard form", [
        "A line can also be written $Ax + By = C$, where $A$, $B$ and $C$ are numbers. This is called standard form. Here $Ax$ means $A$ times $x$.",
        "To read the slope, get $y$ alone. Subtract $Ax$ from both sides. Then divide every term, each piece joined by + or −, by $B$ (when $B$ is not 0). The result is $y = -\\frac{A}{B}x + \\frac{C}{B}$. So the slope is $-\\frac{A}{B}$.",
        "For example, $2x + 4y = 8$ becomes $4y = -2x + 8$, then $y = -\\frac{1}{2}x + 2$. The slope is $-\\frac{1}{2}$, so $y$ goes down a half each time $x$ goes up by 1.",
      ]),
      formal("Slope-intercept form", [
        "Let $(x_1, y_1)$ and $(x_2, y_2)$ be two points with $x_1 \\neq x_2$ (the $x$-values differ). The small numbers 1 and 2 just label the first and second point.",
        "The line through them has slope $m=\\frac{y_2-y_1}{x_2-x_1}$ and $y$-intercept $b = y_1 - m x_1$.",
        "For $B \\neq 0$, the line $Ax + By = C$ has slope $-\\frac{A}{B}$.",
      ]),
    ],
    pitfalls: [
      "A point's $y$-value is the intercept only when that point has $x = 0$.",
      "Subtract in the same order on top and bottom: $(11 - 5)$ over $(3 - 1)$, not $(11 - 5)$ over $(1 - 3)$.",
      "In $Ax + By = C$, the slope is $-\\frac{A}{B}$ (when $B$ is not 0), not $A$.",
    ],
    parentGuide:
      "Ask where $y=2x+5$ crosses the $y$-axis, and what happens to $y$ when $x$ goes up by 1.",
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
      "An equation says two amounts are equal, like $-2(x + 3) = x + 9$. Some equations must be tidied before you can solve them. Multiply out parentheses, gather matching pieces, or clear fractions. The parts before and after the equals sign are called the sides. Move all the $x$ pieces to one side and the plain numbers to the other. Whatever you do to one side, do to the other, so they stay equal.",
    senses: {
      term: "term-expression",
      side: "side-of-equation",
      factor: "factor-number",
      product: "product-multiply",
    },
    noLink: ["changes", "part", "parts", "rule"],
    templateIds: ["staar-multistep-equations"],
    objectives: [
      "Multiply a negative number through parentheses and solve with $x$ on both sides.",
      "Combine like terms, pieces with the same letter, and solve.",
      "Clear fractions by multiplying both sides, then solve.",
    ],
    intuition: [
      "Simplify, then undo",
      [
        "You need to solve two-step equations such as $3x + 5 = 20$. An equation has a left side and a right side with an equals sign between. A solution is a value of $x$ that makes both sides equal.",
        "An expression is a math phrase such as $2x - 6$. A term is one piece of an expression joined by + or −, such as $2x$, $-6$ or $x$. Like terms have the same letter part, so $2x$ and $4x$ are like terms: $2x + 4x = 6x$. Plain numbers are also like terms with each other.",
        "Parentheses group a part. A number right before them multiplies every term inside, sign included. This is called distributing. So $-2(x + 3) = -2x - 6$, because $-2 \\times x = -2x$ and $-2 \\times 3 = -6$.",
        "If an equation has a fraction such as $\\frac{x}{4}$, multiply every term on both sides by 4. The 4 cancels the fraction, and the two sides stay equal.",
        "Doing the same thing to both sides keeps them equal: adding, subtracting, or multiplying or dividing by a number other than 0.",
      ],
    ],
    workedExample: {
      prompt: "Solve $-2(x+3)=x+9$.",
      steps: [
        "Distribute the $-2$ to both terms inside the parentheses: $-2 \\times x = -2x$ and $-2 \\times 3 = -6$. The equation becomes $-2x - 6 = x + 9$.",
        "Gather the $x$ terms on the left. Subtract $x$ from both sides: $-3x - 6 = 9$.",
        "Move the plain number to the right. Add 6 to both sides to undo the − 6: $-3x = 15$.",
        "Divide both sides by $-3$ to get $x$ alone: $x = 15 \\div (-3) = -5$. Check: $-2(-5 + 3) = -2 \\times (-2) = 4$, and $-5 + 9 = 4$. Both sides are 4.",
      ],
      answer: "$x=-5$",
    },
    closingSections: [
      method("Simplify each side first", [
        "First tidy each side: distribute, combine like terms, or multiply every term by the denominator to clear fractions.",
        "Then move the $x$ terms to one side and the numbers to the other, by adding or subtracting the same thing on both sides.",
        "Last, divide both sides by the number multiplying $x$, called its coefficient. Check by putting the answer back into the original equation.",
      ]),
      formal("Linear equations", [
        "Adding or subtracting the same number on both sides, or multiplying or dividing both sides by the same number other than 0, gives an equation with the same solutions.",
        "The distributive property is the rule $a(b + c) = ab + ac$: a number times a sum equals the sum of the separate results.",
        "An equation $ax + b = cx + d$ with $a \\neq c$ ($a$ not equal to $c$) has exactly one solution, $x=\\frac{d-b}{a-c}$.",
      ]),
    ],
    pitfalls: [
      "Distribute the sign to every term: $-2(x+3)=-2x-6$, not $-2x+6$ or $-2x+3$.",
      "Combine only like terms. $3x$ and 3 cannot be joined.",
      "When clearing fractions, multiply every term on both sides, not just the fraction.",
    ],
    parentGuide:
      "After the learner solves an equation, ask them to put the answer back in and show both sides are equal.",
  }),
  build({
    id: "staar-experimental-probability",
    title: "Experimental probability and two draws",
    summary:
      "Probability is a number from 0 to 1 that says how likely something is. An experimental probability comes from trying it: count how many times an outcome happened, then divide by the number of tries. If red came up 6 times in 20 draws, its experimental probability is $\\frac{6}{20}$. When a drawn tile is put back before the next draw, multiply the chances of the two draws.",
    senses: { trial: "trial", product: "product-multiply", event: "event" },
    noLink: ["change"],
    templateIds: ["staar-experiment-probability"],
    objectives: [
      "Find the experimental probability that one of two outcomes happened, using counts from a table.",
      "Find the probability of two draws in a row when the first item is put back.",
    ],
    intuition: [
      "What happened, out of all trials",
      [
        "You need to write and simplify fractions, and multiply fractions. An experiment is a test you repeat and record. A trial is one try of an experiment, such as one draw of a tile from a bag. An outcome is what happens on a trial, such as getting red.",
        "An experimental probability is what actually happened. It is the number of times the outcome happened divided by the total number of trials. Red 6 times out of 20 draws gives $\\frac{6}{20}$, which simplifies to $\\frac{3}{10}$.",
        "If either of two outcomes counts, such as red or blue, add their counts first. Then divide by the total number of trials.",
        "“With replacement” means the tile is put back after each draw. Then the bag is the same for the next draw, so the chances do not change. To find the chance of one result and then another, multiply the two probabilities. If red has chance $\\frac{1}{2}$ on each draw, red then red has chance $\\frac{1}{2} \\times \\frac{1}{2} = \\frac{1}{4}$.",
      ],
    ],
    workedExample: {
      prompt:
        "In 20 draws, red came up 6 times and blue 4 times. What is the experimental probability of red or blue?",
      steps: [
        "Either color counts, so add their counts: $6 + 4 = 10$ draws were red or blue.",
        "Divide by all 20 trials, because a probability compares the outcome with every try: $\\frac{10}{20}$.",
        "Simplify by dividing top and bottom by 10: $\\frac{10}{20} = \\frac{1}{2}$.",
      ],
      answer: "$\\frac{1}{2}$",
    },
    closingSections: [
      method("Multiply for draws with replacement", [
        "With replacement, each draw uses the same full set. Find each draw's probability from that set: the number of items you want divided by the number of items in all.",
        "Multiply the two probabilities. A bag has 3 red and 2 blue tiles, 5 in all. Red then blue, with the first tile put back, has chance $\\frac{3}{5} \\times \\frac{2}{5} = \\frac{6}{25}$.",
      ]),
      formal("Independent events", [
        "The experimental probability of an outcome is how many times it happened divided by the number of trials.",
        "Draws with replacement are independent.",
        "$P(A)$ is read “the probability of $A$.” An event is a result you might get, such as red. Two events are called independent events when one does not change the chances of the other. For two such events $A$ and $B$, $P(A\\text{ then }B) = P(A) \\times P(B)$.",
      ]),
    ],
    pitfalls: [
      "Divide by all the trials, not by the count of the other outcomes.",
      "When two colors count, add both counts before dividing.",
      "Without replacement, the second draw uses a smaller set. You can still multiply, but the second probability must count what is left after the first draw.",
    ],
    parentGuide:
      "Ask why putting the card back keeps the chances for the second draw the same.",
  }),
  build({
    id: "staar-number-sets",
    title: "Whole numbers, integers and rational numbers",
    summary:
      "Numbers come in families that fit inside each other. Whole numbers are 0, 1, 2, 3 and so on. Integers are the whole numbers and their negatives, such as $-4$. Rational numbers are all numbers that can be written as a fraction of integers, such as $\\frac{1}{2}$ or 2.5. To place a number, first work out its value: $\\frac{24}{3}$ is 8, a whole number.",
    senses: { opposite: "opposite-number" },
    noLink: ["part"],
    templateIds: ["staar-number-sets"],
    objectives: [
      "Place a number in the right part of a diagram of sets inside sets.",
      "Find and fix a quotient (the answer to a division) placed in the wrong set.",
    ],
    intuition: [
      "Sets inside sets",
      [
        "You need to divide integers. A set is a group of numbers that belong together.",
        "The whole numbers are 0, 1, 2, 3, and so on without end. The integers are the whole numbers together with their negatives: …, −3, −2, −1, 0, 1, 2, 3, …. A negative number is a number less than 0.",
        "The rational numbers are all the numbers that can be written as a fraction with an integer on top and a nonzero integer on the bottom. That includes $\\frac{1}{2}$, 2.5 (which is $\\frac{5}{2}$) and $-\\frac{3}{4}$.",
        "Each set fits inside the next. Every whole number is an integer, and every integer is rational, because 7 can be written $\\frac{7}{1}$. Picture three circles, one inside another: whole numbers in the middle, then integers, then rational numbers.",
        "A fraction does not always land outside the integers. $\\frac{24}{3}$ equals 8, which is a whole number. So work out the value first.",
      ],
    ],
    workedExample: {
      prompt: "Where does $\\frac{-20}{5}$ belong?",
      steps: [
        "Work out the value first, because a fraction can equal an integer. The fraction bar means divide: $\\frac{-20}{5} = -20 \\div 5 = -4$.",
        "$-4$ has no fraction part, so it is an integer. But it is negative, and whole numbers are never negative. So it belongs with the integers that are not whole numbers.",
      ],
      answer: "Integers that are not whole numbers",
    },
    closingSections: [
      method("Ask in order", [
        "First find the value. Then ask: is it 0 or positive with no fraction part? Then it is a whole number.",
        "Is it negative with no fraction part? Then it is an integer but not a whole number.",
        "Is it a fraction of integers, or a decimal that ends or repeats, with a part left over, like $\\frac{1}{2}$ or 0.5? Then it is rational but not an integer.",
      ]),
      formal("Number sets", [
        "A number is rational if it equals $\\frac{p}{q}$, where $p$ and $q$ are integers and $q$ is not 0.",
        "It is an integer if it can be written with $q = 1$. It is a whole number if it is an integer that is not negative.",
        "So every whole number is an integer, and every integer is rational. The reverse is not true: $-4$ is an integer but not a whole number.",
      ]),
    ],
    pitfalls: [
      "A fraction can equal a whole number. Divide first: $\\frac{24}{3} = 8$.",
      "A negative integer, such as $-4$, is not a whole number, even though it is an integer.",
      "Zero is a whole number.",
    ],
    parentGuide: "Ask the learner whether 0 is a whole number, and why.",
  }),
];
