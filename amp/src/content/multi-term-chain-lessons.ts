import type { FacetMapping } from "./coverage";
import type { ProblemMethod } from "./problem-lessons";
import { chainLesson } from "./chain-lesson-kit";

const fractionChainSenses = {
  whole: "whole",
  part: "part",
  third: "third",
  quarter: "fourth",
  term: "term-expression",
  multiple: "multiple",
  unit: "unit",
  rename: "rename",
};
const fractionChainNoLink = ["change", "changes"];
const priceNoLink = ["whole", "part", "scale"];

export const multiTermChainMethods: Record<string, ProblemMethod> = {
  "fraction-term-chain": {
    goal: "Combine three or four fractions, mixed numbers or decimals with different denominators by writing every term over one common denominator.",
    senses: fractionChainSenses,
    noLink: fractionChainNoLink,
    intuition:
      "A fraction names equal parts of a whole. Its denominator, the bottom number, says how many equal parts make the whole. Its numerator, the top number, counts the parts. You can add or take away parts only when they are the same size. Each amount in the problem is called a term. A common denominator is a bottom number that every term can share. A whole number is one of 0, 1, 2, 3 and so on. A mixed number is a whole number and a fraction together, such as $1\\frac{1}{2}$. A decimal is a number with a decimal point, such as 0.5.",
    terms: ["common-denominator", "improper-fraction"],
    method: [
      "List the denominators. Choose a common denominator: a number that each denominator divides into evenly.",
      "Rewrite every term as a fraction over that denominator, including a whole number or a decimal. Multiply the top and bottom by the same number.",
      "Add the numerators of the terms that are added. Subtract the numerators of the terms that are taken away.",
      "Lowest terms means that no number bigger than 1 divides both the top and the bottom. Write the answer in lowest terms, and check that it makes sense: taking amounts away leaves less than the start.",
    ],
    watch:
      "When you change a denominator, change the numerator the same way. Rewriting $\\frac{3}{4}$ as $\\frac{3}{12}$ instead of $\\frac{9}{12}$ changes its size.",
  },
  "decimal-rename-chain": {
    goal: "Write a fraction as a decimal, or a decimal as a fraction, then add, subtract or multiply; read decimal weights from a table.",
    intuition:
      "A fraction and a decimal are two names for one number. When a problem mixes them, pick one name for every term first. Then the arithmetic is one you already know. In an expression, multiplication is done before subtraction.",
    terms: ["rename", "mixed-number"],
    method: [
      "Choose one form for the problem. Decimals are easiest when the denominators are 2, 4, 5, 10, 20 or 25.",
      "Rename each fraction by dividing its top number by its bottom number.",
      "Do multiplication before addition or subtraction. Line up decimal points to add or subtract.",
      "For a table, add the weights that go together first, then subtract. For a missing weight, subtract the known weights from the total.",
    ],
    watch:
      "Do the multiplication first in $12.5-2\\frac{1}{4}\\times 3$. Subtracting $2\\frac{1}{4}$ from $12.5$ first gives a different number.",
  },
  "price-count-chain": {
    goal: "Find the total cost of a group by adding two prices and multiplying by the people, or multiplying each price by its own count.",
    noLink: priceNoLink,
    intuition:
      "A group buys two kinds of things, such as tickets and drinks. If everyone buys the same pair, find the cost of one pair, then multiply by the number of people. If the counts are different, find the cost of each kind, then add. Prices are decimals: numbers with a decimal point, like 4.50 dollars.",
    method: [
      "Decide whether every person buys the same things or the counts are different.",
      "Same things: add the two prices for one person, then multiply by the number of people.",
      "Different counts: multiply each price by its count, then add the two totals.",
      "Write the answer in dollars and cents. Check that it is more than either part.",
    ],
    watch:
      "Multiply the sum of both prices by the number of people, not just one price. A person who buys a ticket and a drink pays both prices.",
  },
  "dollar-rate-scale": {
    goal: "Use a table of charges for two numbers of hours at one price per hour to find another charge, or the hours for a charge.",
    noLink: priceNoLink,
    intuition:
      "A rate is a comparison of two amounts with different units, such as dollars and hours. The unit rate is the amount for exactly 1 unit, such as the price of 1 hour. When every hour costs the same, the charge is the unit rate times the number of hours. A table gives the charges for two numbers of hours. Division means sharing an amount out evenly. Divide a charge by its hours to find the price of 1 hour.",
    terms: ["unit-rate"],
    method: [
      "Divide a charge in the table by its hours to find the price of 1 hour. Check it against the other column.",
      "To find a charge, multiply the unit rate by the new number of hours.",
      "To find the hours for a charge, divide the charge by the unit rate.",
    ],
    watch:
      "Check the unit rate against both columns of the table. If it does not fit, the division was wrong.",
  },
  "signed-changes-sum": {
    goal: "Add five to seven gains and losses from a table to find the net change, or the count after the changes.",
    intuition:
      "A gain moves a count up and a loss moves it down. The net change is where the count ends up compared with the start. Gains and losses can be added in any order, so group the gains together and the losses together.",
    terms: [
      [
        "sum",
        "The net change adds all the gains and losses, counting each loss as negative.",
      ],
    ],
    method: [
      "Add all the gains to get one positive total.",
      "Add all the losses to get one negative total.",
      "Add the two totals. The sign tells whether the count went up or down.",
      "For a final count, add the net change to the starting count.",
    ],
    watch:
      "Include every day in the table, including the ones at the end. A loss of 8 is $-8$, not $+8$.",
  },
};

export const multiTermChainPrinciples: Record<string, string> = {
  "fraction-term-chain":
    "A common multiple is a number that each denominator divides into evenly. Fractions with denominators $d_1,\\dots,d_k$ can all be written over any common multiple $D$ of them that is greater than 0. Here $d_1$ is the first denominator, $d_2$ the second, and so on. This works because $\\frac{n}{d}=\\frac{n\\times (D\\div d)}{D}$. Then the numerators add and subtract as counts of parts of the same size: $\\frac{n_1}{D}+\\frac{n_2}{D}=\\frac{n_1+n_2}{D}$.",
  "decimal-rename-chain":
    "A fraction whose denominator divides a power of ten equals a terminating decimal, so $\\frac{p}{q}=\\frac{p\\cdot 10^k/q}{10^k}$. Multiplication is done before addition and subtraction, and a difference can be negative when the subtracted amount is larger.",
  "price-count-chain":
    "Adding the prices first and then multiplying gives the same total as multiplying each price and then adding. This is called the distributive property: $n\\times(a+b)=n\\times a+n\\times b$. One pair costing $a+b$, bought $n$ times, costs the same as $n$ of $a$ and $n$ of $b$. When the counts are different, the total is $m\\times a+n\\times b$.",
  "dollar-rate-scale":
    "When every hour costs the same, the charge is $r\\times$ hours. Here $r$ is the unit rate: $r=\\text{charge}\\div\\text{hours}$, the same for every column of the table. The hours for a charge are $\\text{charge}\\div r$.",
  "signed-changes-sum":
    "Addition of integers is commutative and associative, so $a_1+\\cdots+a_n$ equals the sum of the positive terms plus the sum of the negative terms. The final count is the start plus that net change.",
};

export const multiTermChainLessons = [
  {
    ...chainLesson({
      id: "fraction-term-chain",
      title: "Three or four fractions with one common denominator",
      summary:
        "A fraction names equal parts of a whole. To add or take away several fractions, the parts must be the same size. So rewrite every amount over one common denominator, a bottom number they all share. Then add and subtract the top numbers, which count the parts.",
      templateIds: ["fraction-term-chain"],
      objectives: [
        "Find one common denominator for three or four fractions with different denominators.",
        "Rewrite mixed numbers, whole numbers and decimals as fractions over that denominator.",
        "Add and subtract the numerators, and write the answer in lowest terms.",
      ],
      openingTitle: "Parts of the same size, then count",
      opening: [
        "A fraction such as $\\frac{3}{4}$ has a numerator, the top number 3, and a denominator, the bottom number 4. The denominator says how many equal parts make the whole. The numerator counts the parts.",
        "You can add thirds to thirds. But you cannot add thirds to fourths straight away, because the parts are different sizes. With three or four amounts, choose one size of part that fits every amount. Twelfths fit thirds, fourths and sixths, because 3, 4 and 6 all divide 12 evenly. A bottom number like this is called a common denominator.",
        "Each amount in the problem is called a term. A whole number is one of 0, 1, 2, 3 and so on. The whole number 10 is 120 twelfths, because each whole is 12 twelfths. A decimal is a number with a decimal point: 0.5 is the fraction $\\frac{1}{2}$. A mixed number is a whole number and a fraction together, such as $1\\frac{1}{2}$, which means 1 and $\\frac{1}{2}$ more.",
        "Write every term as a count of parts of the same size. Then add the counts for amounts that are added, and subtract the counts for amounts that are taken away. Lowest terms is the form of a fraction where no number bigger than 1 divides both the top and the bottom.",
      ],
      example: {
        prompt:
          "A hiker walked $1\\frac{1}{2}$ miles, $\\frac{3}{4}$ mile and $2\\frac{1}{3}$ miles. How many miles in all?",
        steps: [
          "The denominators are 2, 4 and 3. Each one divides 12 evenly, so use 12 as the common denominator.",
          "Rewrite each amount in twelfths. $1\\frac{1}{2}$ is $\\frac{3}{2}$, and $\\frac{3}{2}=\\frac{18}{12}$. Next, $\\frac{3}{4}=\\frac{9}{12}$. Last, $2\\frac{1}{3}$ is $\\frac{7}{3}$, and $\\frac{7}{3}=\\frac{28}{12}$.",
          "All three walks are added, so add the numerators: $18+9+28=55$. The total is $\\frac{55}{12}$.",
          "12 twelfths make 1 whole, and $55=4\\times12+7$. So $\\frac{55}{12}=4\\frac{7}{12}$.",
        ],
        answer: "$\\frac{55}{12}$ miles, or $4\\frac{7}{12}$ miles",
      },
      methodTitle: "List, rewrite, count",
      method: [
        "List the denominators. Choose a number they all divide into evenly. Rewrite every term over it, multiplying the top and bottom by the same number.",
        "Add or subtract the numerators, as the story says. Check the result against the story: taking amounts away from a start leaves less than the start.",
      ],
      formalTitle: "Why one denominator works for every term",
      formal: [
        "Multiplying the top and bottom of a fraction by the same number, other than 0, does not change its value: $\\frac{n}{d}=\\frac{n\\times k}{d\\times k}$.",
        "Suppose $D=d\\times k$ for a whole number $k$ other than 0. A number made this way is called a multiple of $d$. Then $\\frac{n}{d}=\\frac{n\\times (D\\div d)}{D}$.",
        "Once every term is a count of parts of size $\\frac{1}{D}$, adding and subtracting the counts gives the count of parts in the answer.",
      ],
      pitfalls: [
        "When you change the denominator, multiply the numerator by the same number.",
        "Rewrite a whole number too: 10 is $\\frac{120}{12}$ when the denominator is 12.",
        "Subtract the amounts that are taken away. Do not add them.",
      ],
      parentGuide:
        "Ask your child which number all of the denominators divide into evenly. Have them write each amount over that number before they add.",
    }),
    senses: fractionChainSenses,
    noLink: fractionChainNoLink,
  },
  chainLesson({
    id: "decimal-rename-chain",
    title: "Rename, then add, subtract or multiply",
    summary:
      "Write a fraction as a decimal, multiply before you subtract, and read decimal weights from a table.",
    templateIds: ["decimal-rename-chain"],
    objectives: [
      "Rename a fraction or mixed number as a decimal.",
      "Multiply before subtracting in an expression with a decimal and a mixed number.",
      "Add, subtract and find a missing decimal weight from a table.",
    ],
    openingTitle: "One name for every number",
    opening: [
      "$\\frac{2}{5}$ and $0.4$ are the same number. If a problem has both, pick one form first. Decimals are usually quickest when the fraction has a denominator of 2, 4, 5, 10, 20 or 25.",
      "To rename $\\frac{2}{5}$, divide 2 by 5. Then line up the decimal points and subtract. In an expression, do multiplication before addition or subtraction.",
    ],
    example: {
      prompt: "Evaluate $9.5-1\\frac{1}{4}\\times 2$.",
      steps: [
        "Multiplication comes first: $1\\frac{1}{4}=1.25$, and $1.25\\times 2=2.5$.",
        "Subtract: $9.5-2.5=7$.",
      ],
      answer: "$7$",
    },
    methodTitle: "Choose a form, then follow the order",
    method: [
      "Rename every fraction as a decimal, or every decimal as a fraction, so all terms match.",
      "Multiply first, then add or subtract with the decimal points lined up. For a table, add the weights that go together and subtract; for a missing weight, subtract what is known from the total.",
    ],
    formalTitle: "Why renaming does not change the value",
    formal: [
      "A fraction $\\frac{p}{q}$ whose denominator divides $10^k$ equals $\\frac{p\\cdot 10^k/q}{10^k}$, a decimal with $k$ places. For example $\\frac{2}{5}=\\frac{4}{10}=0.4$.",
      "Order of operations makes every expression mean one thing: products are found before sums and differences. The result of a difference is negative when the amount taken away is larger.",
    ],
    pitfalls: [
      "Multiply before you subtract.",
      "Line up the decimal points. 7.5 and 0.25 need the same number of places.",
      "A result can be negative when you subtract a larger amount.",
    ],
    parentGuide:
      "Ask which form each number is in, and whether to multiply or subtract first.",
  }),
  {
    ...chainLesson({
      id: "price-and-rate-chain",
      title: "Prices for a group and rates from a table",
      summary:
        "To find what a group spends, find the cost for one person and multiply. Or multiply each price by its own count and add. A rate is a comparison of two amounts, such as dollars and hours. The unit rate is the amount for exactly 1, such as the price of 1 hour.",
      templateIds: ["price-count-chain", "dollar-rate-scale"],
      objectives: [
        "Add two prices and multiply by the number of people, or multiply each price by its own count.",
        "Find the price of one hour from a table, and use it for a new number of hours.",
      ],
      openingTitle: "Find the cost of one, then multiply",
      opening: [
        "If everyone buys a ticket and a drink, one person spends both prices added together. For 18 people, multiply that amount by 18. If the group buys 18 tickets and 16 drinks, multiply each price by its own count, then add.",
        "A rate is a comparison of two amounts with different units, such as dollars and hours. The unit rate is the amount for exactly 1 unit, such as the price of 1 hour.",
        "A table can show the charge for two stays. If every hour costs the same, divide a charge by its hours to get the unit rate. Then multiply the unit rate by any number of hours.",
      ],
      example: {
        prompt:
          "A ticket costs 4.50 dollars and a drink costs 1.25 dollars. Each of 12 people buys one of each. How much do they spend?",
        steps: [
          "Each person buys one ticket and one drink. So one person spends $4.50+1.25=5.75$ dollars.",
          "All 12 people spend the same, so multiply: $12\\times 5.75=69$ dollars.",
        ],
        answer: "$69$ dollars",
      },
      methodTitle: "One first, then many",
      method: [
        "Same things for everyone: add the prices, then multiply by the number of people. Different counts: multiply each price by its count, then add.",
        "For a rate table, divide a charge by its hours to get the unit rate. Check it against the other column. Then multiply or divide by it.",
      ],
      formalTitle: "Why both orders give the same total",
      formal: [
        "Adding first and then multiplying gives the same total as multiplying each price first and then adding. This is called the distributive property: $n\\times(a+b)=n\\times a+n\\times b$.",
        "When every hour costs the same, charge ÷ hours is the same number in every column of the table. That number is the unit rate.",
      ],
      pitfalls: [
        "Multiply the cost of the pair by the number of people, not just one price.",
        "Check the unit rate against both columns of the table.",
        "To find hours from a charge, divide the charge by the price of 1 hour.",
      ],
      parentGuide:
        "Before your child multiplies, ask what one person spends, or what one hour costs.",
    }),
    noLink: priceNoLink,
  },
  chainLesson({
    id: "signed-changes-sum",
    title: "Add many gains and losses",
    summary:
      "Find the net change from five to seven signed changes, and the count after them.",
    templateIds: ["signed-changes-sum"],
    objectives: [
      "Add a list of five to seven positive and negative changes.",
      "Use the net change to find a final count.",
    ],
    openingTitle: "Gains up, losses down",
    opening: [
      "Each change moves a count up if it is positive and down if it is negative. The net change is the total of all of them. A positive net change means the count went up, and a negative one means it went down.",
      "You can add in any order. Add all the gains, add all the losses, and then combine the two totals.",
    ],
    example: {
      prompt:
        "Changes in the number of books: $+9,\\ -4,\\ +6,\\ -11,\\ +3$. What is the net change?",
      steps: [
        "The gains total $9+6+3=18$.",
        "The losses total $-4+(-11)=-15$.",
        "The net change is $18+(-15)=3$.",
      ],
      answer: "$3$",
    },
    methodTitle: "Group the gains and the losses",
    method: [
      "Add the positive changes, add the negative changes, and combine the two totals.",
      "For a final count, add the net change to the start.",
    ],
    formalTitle: "Why the order does not matter",
    formal: [
      "Addition of integers is commutative and associative, so any grouping of the same terms has the same sum. Grouping the positive terms and the negative terms is one such grouping.",
    ],
    pitfalls: [
      "Include every change in the list.",
      "A loss of 8 is $-8$. Subtract it, do not add it.",
    ],
    parentGuide:
      "Ask your learner to say what the gains total and what the losses total before they combine them.",
  }),
];

export const multiTermChainFacetMappings: FacetMapping[] = [
  {
    templateId: "fraction-term-chain",
    facetId: "fraction-addition.core",
    extent: "partial",
    rationale:
      "Numeric entry for sums and differences of three or four fractions, mixed numbers or decimals with denominators up to 16, from a table, a story or a written expression, answered as a fraction, decimal or whole number. Does not assess models, answers written as a mixed number, or explaining why a common denominator works.",
  },
  {
    templateId: "decimal-rename-chain",
    facetId: "decimal-algorithms.multidigit-decimal-operations",
    extent: "partial",
    rationale:
      "Numeric entry for a decimal plus or minus a fraction, a decimal minus a mixed number times a whole number (which can be negative), and sums, differences and missing weights from a table of decimals to hundredths. Does not assess division of decimals, rounding, or writing the equation.",
  },
  {
    templateId: "price-count-chain",
    facetId: "decimal-arithmetic.core",
    extent: "partial",
    rationale:
      "Numeric entry for the cost of a group from two prices, either one of each per person or separate counts, with prices in dollars and cents and counts up to 24. Does not assess tax, discounts, change, or estimation.",
  },
  {
    templateId: "dollar-rate-scale",
    facetId: "ratio-tables.missing-table-value",
    extent: "partial",
    rationale:
      "Numeric entry for a charge for a new number of hours, or the hours for a charge, when a two-column table lists the charge for two numbers of hours at a constant price in dollars and cents. Does not assess tables that are not proportional, graphing, or writing the rate equation.",
  },
  {
    templateId: "signed-changes-sum",
    facetId: "signed-addition.core",
    extent: "partial",
    rationale:
      "Numeric entry for the net change or final count from a table of five to seven integer gains and losses between -18 and 18. Does not assess number-line models, absolute value, or rational-number changes.",
  },
];
