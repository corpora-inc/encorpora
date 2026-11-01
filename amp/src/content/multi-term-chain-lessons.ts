import type { FacetMapping } from "./coverage";
import type { ProblemMethod } from "./problem-lessons";
import { chainLesson } from "./chain-lesson-kit";

export const multiTermChainMethods: Record<string, ProblemMethod> = {
  "fraction-term-chain": {
    goal: "Combine three or four fractions, mixed numbers or decimals with different denominators by writing every term over one common denominator.",
    intuition:
      "Pieces can be added or taken away only when they are the same size. With three or four amounts, find one piece size that fits all of them, rewrite every amount in those pieces, and then just count pieces.",
    terms: ["common-denominator", "improper-fraction"],
    method: [
      "List the denominators and choose a common denominator that all of them divide into.",
      "Rewrite every term, including a whole number or a decimal, as a fraction over that denominator.",
      "Add the numerators of the terms that are added and subtract the numerators of the terms that are taken away.",
      "Write the result in lowest terms and check that it is reasonable: less than the starting amount when amounts are taken away.",
    ],
    watch:
      "Change the numerators when you change a denominator. Rewriting $\\frac{3}{4}$ as $\\frac{3}{12}$ instead of $\\frac{9}{12}$ changes its size.",
  },
  "decimal-rename-chain": {
    senses: {
      difference: "difference-subtract",
      part: "part",
      parts: "part",
      rename: "rename",
    },
    goal: "Write a fraction as a decimal, or a decimal as a fraction, then add, subtract or multiply; read decimal weights from a table.",
    intuition:
      "A decimal is a number written with a decimal point, such as 0.4. A fraction and a decimal can name the same number: $\\frac{2}{5}$ and $0.4$ are equal. When a problem mixes them, write every number the same way first. To rename means to write a number another way. To rename a fraction as a decimal, divide its top number by its bottom number. Multiply before you add or subtract.",
    terms: ["rename", "mixed-number"],
    method: [
      "Choose one form. Decimals are easiest when the bottom numbers are 2, 4, 5, 10, 20 or 25.",
      "Rename each fraction by dividing its top number by its bottom number. A mixed number is a whole number with a fraction, such as $1\\frac{1}{4}$, which means $1+\\frac{1}{4} = 1.25$.",
      "Multiply before you add or subtract. Line up the decimal points to add or subtract.",
      "For a table, add the weights that go together first, then subtract. For a missing weight, subtract the known weights from the total.",
    ],
    watch:
      "In $12.5-2\\frac{1}{4}\\times 3$, multiply first. Subtracting $2\\frac{1}{4}$ from $12.5$ first gives a different number.",
  },
  "price-count-chain": {
    goal: "Find the total cost of a group by adding two prices and multiplying by the people, or multiplying each price by its own count.",
    intuition:
      "A group spends money in two kinds of things. If everyone buys the same pair, find the cost of one pair and multiply by the number of people. If the counts are different, find the cost of each kind and add.",
    method: [
      "Decide whether every person buys the same things or the counts differ.",
      "Same things: add the two prices for one person, then multiply by the number of people.",
      "Different counts: multiply each price by its count, then add the two totals.",
      "Write the answer with dollars and cents and check that it is larger than either part.",
    ],
    watch:
      "Multiply the sum of the prices by the people, not just one price. A person who buys a ticket and a drink spends both prices.",
  },
  "dollar-rate-scale": {
    goal: "Use a table of charges for two numbers of hours at one price per hour to find another charge, or the hours for a charge.",
    intuition:
      "When every hour costs the same, the charge for any number of hours is that many hourly prices. A table gives the price of two stays. Dividing one of them by its hours shows the price of one hour.",
    terms: ["unit-rate"],
    method: [
      "Divide a charge in the table by its hours to find the price of 1 hour, and check it against the other column.",
      "To find a charge, multiply the unit rate by the new number of hours.",
      "To find the hours for a charge, divide the charge by the unit rate.",
    ],
    watch:
      "Check the unit rate against both table columns. If it does not fit, the division was wrong.",
  },
  "signed-changes-sum": {
    senses: { change: "change", changes: "change" },
    noLink: ["net"],
    goal: "Add five to seven gains and losses from a table to find the net change, or the count after the changes.",
    intuition:
      "A gain moves a count up, and a loss moves it down. A negative number is a number below 0, such as $-8$, the way we write a loss of 8. The net change is the total of all the changes: how far the count ends up from where it started. You can add in any order, so add the gains together and the losses together.",
    terms: [
      [
        "sum",
        "The net change adds all the gains and losses, counting each loss as negative.",
      ],
    ],
    method: [
      "Add all the gains to get one positive total.",
      "Add all the losses to get one negative total.",
      "Add the two totals. A positive result means the count went up. A negative result means it went down.",
      "For a final count, add the net change to the starting count.",
    ],
    watch:
      "Include every day in the table, including the last ones. A loss of 8 is $-8$, not $+8$.",
  },
};

export const multiTermChainPrinciples: Record<string, string> = {
  "fraction-term-chain":
    "Fractions with denominators $d_1,\\dots,d_k$ can all be written over any common multiple $D$ of them, since $\\frac{n}{d}=\\frac{n\\cdot D/d}{D}$. Then $\\pm\\frac{n_1}{D}\\pm\\cdots\\pm\\frac{n_k}{D}=\\frac{\\pm n_1\\pm\\cdots\\pm n_k}{D}$, because quantities counted in the same unit add as counts.",
  "decimal-rename-chain":
    "A power of ten is 10, 100, 1000 and so on, written $10^k$ for $k$ tens multiplied together. If the bottom number $q$ of a fraction divides a power of ten evenly, the fraction is a decimal that stops: $\\frac{p}{q}=\\frac{p\\cdot 10^k/q}{10^k}$, where $\\cdot$ means times. Multiplication is done before addition and subtraction. A difference is negative when the amount taken away is larger.",
  "price-count-chain":
    "The distributive property gives $n(a+b)=na+nb$: one pair costing $a+b$ bought $n$ times costs the same as $n$ copies of $a$ and $n$ copies of $b$. When the counts differ the total is $ma+nb$.",
  "dollar-rate-scale":
    "If the charge is proportional to the hours, charge $=r\\times$ hours with unit rate $r=\\frac{\\text{charge}}{\\text{hours}}$, the same for every column of the table. The hours for a charge are $\\frac{\\text{charge}}{r}$.",
  "signed-changes-sum":
    "Integers are the whole numbers and their negatives. When you add integers, the order and the grouping do not change the total. So the sum of all the changes equals the sum of the gains plus the sum of the losses. The final count is the start plus that net change.",
};

export const multiTermChainLessons = [
  chainLesson({
    id: "fraction-term-chain",
    title: "Three or four fractions with one common denominator",
    summary:
      "Add and subtract several fractions, mixed numbers and decimals by writing each one in the same size pieces.",
    templateIds: ["fraction-term-chain"],
    objectives: [
      "Find one common denominator for three or four unlike fractions.",
      "Rewrite mixed numbers, whole numbers and decimals as fractions over that denominator.",
      "Add and subtract the numerators and write the result in lowest terms.",
    ],
    openingTitle: "Same size pieces, then count",
    opening: [
      "You can add thirds to thirds, but not thirds to fourths: the pieces are different sizes. With three or four amounts, choose one size of piece that fits every amount. Twelfths fit thirds, fourths and sixths.",
      "A whole number such as 10 is 120 twelfths. A decimal such as 0.5 is the fraction $\\frac{1}{2}$. Write every amount as a count of the same piece, then add the counts of amounts that are added and subtract the counts of amounts that are taken away.",
    ],
    example: {
      prompt:
        "A hiker walked $1\\frac{1}{2}$ miles, $\\frac{3}{4}$ mile and $2\\frac{1}{3}$ miles. How many miles in all?",
      steps: [
        "The denominators are 2, 4 and 3. All of them divide into 12.",
        "Rewrite: $1\\frac{1}{2}=\\frac{18}{12}$, $\\frac{3}{4}=\\frac{9}{12}$, $2\\frac{1}{3}=\\frac{28}{12}$.",
        "Add the numerators: $18+9+28=55$, so the total is $\\frac{55}{12}$.",
        "In mixed form, $\\frac{55}{12}=4\\frac{7}{12}$.",
      ],
      answer: "$\\frac{55}{12}$ miles, or $4\\frac{7}{12}$ miles",
    },
    methodTitle: "List, rewrite, count",
    method: [
      "List the denominators. Choose a number they all divide into. Rewrite every term over it, changing numerator and denominator together.",
      "Add or subtract the numerators in the order the story gives. Check the result against the story: amounts taken away from a start leave less than the start.",
    ],
    formalTitle: "Why one denominator works for every term",
    formal: [
      "Multiplying the top and bottom of a fraction by the same number does not change its value: $\\frac{n}{d}=\\frac{n\\cdot k}{d\\cdot k}$. If $D=d\\cdot k$ is a multiple of $d$, then $\\frac{n}{d}=\\frac{n\\cdot (D/d)}{D}$.",
      "Once every term is a count of $\\frac{1}{D}$-pieces, adding and subtracting the counts gives the count of pieces in the result.",
    ],
    pitfalls: [
      "Multiply the numerator by the same number as the denominator when you rename a fraction.",
      "Rename a whole number too: 10 is $\\frac{120}{12}$ when the denominator is 12.",
      "Subtract the amounts that are taken away. Do not add them.",
    ],
    parentGuide:
      "Ask your learner which denominator all of the fractions divide into, and have them write each term over it before they add.",
  }),
  {
    ...chainLesson({
      id: "decimal-rename-chain",
      title: "Rename, then add, subtract or multiply",
      summary:
        "A fraction and a decimal can name the same number: $\\frac{2}{5}$ and $0.4$ are equal. When a problem mixes the two, first write every number the same way. Then add, subtract or multiply as usual. Remember to multiply before you add or subtract.",
      templateIds: ["decimal-rename-chain"],
      objectives: [
        "Rename a fraction or a mixed number (a whole number and a fraction, such as $1\\frac{1}{4}$) as a decimal.",
        "Multiply before subtracting in an expression that has a decimal and a mixed number.",
        "Add, subtract and find a missing decimal weight from a table.",
      ],
      openingTitle: "One name for every number",
      opening: [
        "A fraction is a number of equal parts of 1 whole. The denominator, the bottom number, says how many equal parts make 1. The numerator, the top number, says how many parts you have. So $\\frac{2}{5}$ is 2 of 5 equal parts.",
        "A fraction also means division: $\\frac{2}{5}$ is $2\\div5=0.4$. So $\\frac{2}{5}$ and $0.4$ are two names for the same number. To rename means to write a number another way without changing its value. To rename a fraction as a decimal, divide its top number by its bottom number. Decimals come out quickest when the bottom number is 2, 4, 5, 10, 20 or 25.",
        "A mixed number is a whole number with a fraction, such as $1\\frac{1}{4}$. It means $1+\\frac{1}{4}$, which is $1+0.25=1.25$.",
        "If a problem mixes fractions and decimals, pick one form for every number first. In an expression (a group of numbers joined by operations), always multiply before you add or subtract.",
      ],
      example: {
        prompt: "Evaluate $9.5-1\\frac{1}{4}\\times 2$.",
        steps: [
          "Multiplication comes before subtraction. First rename the mixed number: $1\\frac{1}{4}=1+0.25=1.25$. Then multiply: $1.25\\times 2=2.5$.",
          "Now subtract, with the decimal points lined up: $9.5-2.5=7$.",
        ],
        answer: "$7$",
      },
      methodTitle: "Choose a form, then follow the order",
      method: [
        "Rename every fraction as a decimal, or every decimal as a fraction, so all the numbers match.",
        "Multiply first. Then add or subtract, with the decimal points lined up. For a table, add the weights that go together, then subtract. For a missing weight, subtract the known weights from the total.",
      ],
      formalTitle: "Why renaming does not change the value",
      formal: [
        "A power of ten is a number like 10, 100 or 1000, written $10^k$ for $k$ tens multiplied together. If the bottom number $q$ of a fraction $\\frac{p}{q}$ divides $10^k$ evenly, then $\\frac{p}{q}=\\frac{p\\cdot 10^k/q}{10^k}$, a decimal with $k$ places. Here $\\cdot$ means times. For example, $\\frac{2}{5}=\\frac{4}{10}=0.4$.",
        "The order of operations makes every expression mean just one thing: multiply before you add or subtract. A difference is negative, below 0, when the amount taken away is larger.",
      ],
      pitfalls: [
        "Multiply before you subtract.",
        "Line up the decimal points. To add 7.5 and 0.25, it helps to write 7.5 as 7.50.",
        "A result can be negative when you subtract a larger amount.",
      ],
      parentGuide:
        "Ask which form each number is in. Then ask whether to multiply or subtract first, and why.",
    }),
    senses: {
      rename: "rename",
      whole: "whole",
      parts: "part",
      difference: "difference-subtract",
    },
    noLink: ["mean"],
  },
  chainLesson({
    id: "price-and-rate-chain",
    title: "Prices for a group and rates from a table",
    summary:
      "Find group costs from two prices, and scale one hourly price read from a table.",
    templateIds: ["price-count-chain", "dollar-rate-scale"],
    objectives: [
      "Add two prices and multiply by the number of people, or multiply each price by its own count.",
      "Find the price of one hour from a table and scale it to a new number of hours.",
    ],
    openingTitle: "Find the cost of one, then scale",
    opening: [
      "If everyone buys a ticket and a drink, one person spends the two prices together. For 18 people, multiply that amount by 18. If the group buys 18 tickets and 16 drinks, multiply each price by its own count and then add.",
      "A table can show the charge for two stays. If every hour costs the same, dividing a charge by its hours gives the price of one hour. Multiply that price by any number of hours.",
    ],
    example: {
      prompt:
        "A ticket costs 4.50 dollars and a drink costs 1.25 dollars. Each of 12 people buys one of each. How much do they spend?",
      steps: [
        "One person spends $4.50+1.25=5.75$ dollars.",
        "Twelve people spend $12\\times 5.75=69$ dollars.",
      ],
      answer: "$69$ dollars",
    },
    methodTitle: "One first, then many",
    method: [
      "Same things for everyone: add the prices, then multiply by the number of people. Different counts: multiply each price by its count, then add.",
      "For a rate table, divide a charge by its hours to get the unit rate, check it against the other column, then multiply or divide by it.",
    ],
    formalTitle: "Why both orders give the same total",
    formal: [
      "The distributive property says $n(a+b)=na+nb$, so multiplying the pair's cost by $n$ matches multiplying each price by $n$ and adding.",
      "If the charge is proportional to the hours, the ratio $\\frac{\\text{charge}}{\\text{hours}}$ is the same in every column of the table. That constant is the unit rate.",
    ],
    pitfalls: [
      "Multiply the whole pair's cost by the people, not just one price.",
      "Check the unit rate against both columns of the table.",
      "To find hours from a charge, divide the charge by the hourly price.",
    ],
    parentGuide:
      "Ask what one person spends, or what one hour costs, before multiplying.",
  }),
  {
    ...chainLesson({
      id: "signed-changes-sum",
      title: "Add many gains and losses",
      summary:
        "A gain moves a count up and a loss moves it down. A negative number is a number below 0, written with a minus sign. We write a gain of 9 as $+9$ and a loss of 4 as $-4$. The net change is the total of all the changes. It tells how far the count ends up from where it started. Add it to the start to get the final count.",
      templateIds: ["signed-changes-sum"],
      objectives: [
        "Add a list of five to seven positive and negative changes.",
        "Use the net change to find a final count.",
      ],
      openingTitle: "Gains up, losses down",
      opening: [
        "A library has some books. On Monday it gets 9 new books, a gain of 9, written $+9$. On Tuesday 4 books are lost, a loss of 4, written $-4$. A number with a minus sign in front is negative, below 0.",
        "The net change is the total of all the changes. Here $9+(-4)=5$, so after two days the library has 5 more books than at the start. A positive net change means the count went up. A negative one means it went down.",
        "You can add the changes in any order, and the total stays the same. So add all the gains, add all the losses, and then combine the two totals.",
      ],
      example: {
        prompt:
          "Changes in the number of books: $+9,\\ -4,\\ +6,\\ -11,\\ +3$. What is the net change?",
        steps: [
          "Add the gains together: $9+6+3=18$.",
          "Add the losses together: $-4+(-11)=-15$. Two losses make a bigger loss.",
          "Combine the totals: $18+(-15)=3$. The gains are 3 more than the losses, so the count went up by 3.",
        ],
        answer: "$3$",
      },
      methodTitle: "Group the gains and the losses",
      method: [
        "Add the positive changes. Add the negative changes. Then combine the two totals.",
        "For a final count, add the net change to the starting count.",
      ],
      formalTitle: "Why the order does not matter",
      formal: [
        "Integers are the whole numbers and their negatives. When you add integers, you may change the order: this is called the commutative property. You may also change the grouping: this is called the associative property. The sum stays the same either way. Putting the positive numbers in one group and the negative numbers in another is one such grouping.",
      ],
      pitfalls: [
        "Include every change in the list.",
        "A loss of 8 is $-8$. It takes 8 away. Do not add 8.",
      ],
      parentGuide:
        "Ask your learner what the gains add to and what the losses add to before they combine them.",
    }),
    senses: { change: "change", "more than": "more-than" },
    noLink: ["net"],
  },
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
