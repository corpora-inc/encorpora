import type { GlossaryEntry } from "../types";

/** Ratios, rates, proportional relationships, percents, and consumer finance (interest, credit, tax). */
export const ratioEntries: GlossaryEntry[] = [
  {
    id: "amount-of-change",
    term: "amount of change",
    forms: ["amount of change"],
    plain:
      "How much a quantity went up or down: the larger of the starting and ending amounts minus the smaller, in the same units.",
    example:
      "A price goes from 40 dollars to 50 dollars, so the amount of change is 10 dollars.",
    uses: ["unit"],
    band: "7",
  },
  {
    id: "apr",
    term: "APR",
    forms: ["apr", "annual percentage rate"],
    plain:
      "Annual percentage rate: the yearly interest rate on a loan or credit card. The monthly rate is the APR divided by 12.",
    example: "An APR of 18% is a monthly rate of 18% ÷ 12 = 1.5%.",
    uses: ["interest", "rate", "loan", "credit-card"],
    band: "7",
  },
  {
    id: "benchmark-percent",
    term: "benchmark percent",
    forms: ["benchmark percent", "benchmark percents"],
    plain:
      "A percent that is easy to find in your head, such as 50%, 25%, 10% or 5%. Use them to build or estimate other percents.",
    example: "10% of 80 is 8, so 5% of 80 is 4 and 15% of 80 is 12.",
    uses: ["percent", "estimate"],
    band: "6",
  },
  {
    id: "constant-of-proportionality",
    term: "constant of proportionality",
    forms: ["constant of proportionality", "constant of variation"],
    plain:
      "The fixed number $k$ in $y = kx$. Each $y$ is $k$ times its $x$, so dividing any $y$ by its $x$ gives $k$.",
    example:
      "If 3 pounds cost 12 dollars and 5 pounds cost 20 dollars, $k = 12 \\div 3 = 4$ dollars per pound.",
    uses: [],
    band: "7",
  },
  {
    id: "credit-card",
    term: "credit card",
    forms: ["credit card", "credit cards"],
    plain:
      "A card for buying now and paying later. The bank pays the store, and anything you have not paid back by the due date is charged interest.",
    uses: ["interest"],
    band: "7",
  },
  {
    id: "debit-card",
    term: "debit card",
    forms: ["debit card", "debit cards"],
    plain:
      "A card that takes the money from your own bank account right away. Nothing is borrowed, so there is no interest.",
    uses: ["interest"],
    band: "7",
  },
  {
    id: "decimal",
    term: "decimal",
    forms: ["decimal", "decimals", "decimal number", "decimal numbers"],
    plain:
      "A number written with a decimal point. The digits after it show tenths, hundredths and so on.",
    example: "0.75 is 7 tenths and 5 hundredths, the same as 75 hundredths.",
    uses: ["decimal-point", "digit", "tenth", "hundredth"],
    band: "4",
  },
  {
    id: "discount",
    term: "discount",
    forms: ["discount", "discounts", "markdown", "markdowns"],
    plain:
      "An amount taken off a price. It is often given as a percent or a fraction of the price.",
    example:
      "A 20% discount on a 50 dollar coat is 10 dollars off, so the coat costs 40 dollars.",
    uses: ["percent", "fraction"],
    band: "6",
  },
  {
    id: "double-number-line",
    term: "double number line",
    forms: ["double number line", "double number lines"],
    plain:
      "Two number lines, one above the other, with their zeros lined up. Marks that line up show pairs in the same ratio.",
    example: "Top: 0, 3, 6, 9 cups of flour. Bottom: 0, 2, 4, 6 cups of sugar.",
    uses: ["number-line", "ratio"],
    noLink: ["line"],
    band: "6",
  },
  {
    id: "equivalent-ratios",
    term: "equivalent ratios",
    forms: ["equivalent ratios", "equivalent ratio", "equal ratios"],
    plain:
      "Ratios that make the same comparison. Multiply or divide both numbers of one ratio by the same number to get the other.",
    example:
      "$2:5$ and $4:10$ are equivalent ratios: multiply both numbers by 2.",
    uses: ["ratio"],
    band: "6",
  },
  {
    id: "interest",
    term: "interest",
    forms: ["interest"],
    plain:
      "Extra money paid for borrowing money, or earned for saving it. It is usually a percent of the amount borrowed or saved.",
    example:
      "Save 200 dollars at 3% a year and you earn 6 dollars of interest in one year.",
    uses: ["percent"],
    band: "7",
  },
  {
    id: "inverse-variation",
    term: "inverse variation",
    forms: [
      "inverse variation",
      "varies inversely",
      "vary inversely",
      "inversely proportional",
    ],
    plain:
      "Two quantities whose product is always the same number $k$, so $y = \\frac{k}{x}$. When one is doubled, the other is divided by 2.",
    example:
      "A 120-mile trip takes 2 hours at 60 miles per hour and 4 hours at 30 miles per hour; each time $rt = 120$.",
    uses: ["product-multiply"],
    band: "7",
  },
  {
    id: "loan",
    term: "loan",
    forms: ["loan", "loans"],
    plain:
      "Money borrowed that must be paid back, usually with interest added on.",
    example:
      "Borrow 1,000 dollars at 5% simple interest for 2 years and pay back 1,100 dollars.",
    uses: ["interest", "simple-interest"],
    band: "7",
  },
  {
    id: "markup",
    term: "markup",
    forms: ["markup", "markups"],
    plain:
      "An amount a store adds to what it paid for an item, to set the price it sells for. It is often a percent of what the store paid.",
    example:
      "A store pays 20 dollars for a shirt and adds a 50% markup of 10 dollars, so it sells for 30 dollars.",
    uses: ["percent"],
    band: "7",
  },
  {
    id: "minimum-payment",
    term: "minimum payment",
    forms: ["minimum payment", "minimum payments"],
    plain:
      "The smallest amount a credit card lets you pay by the due date. Interest is charged on whatever you leave unpaid.",
    uses: ["credit-card", "interest"],
    band: "7",
  },
  {
    id: "part",
    term: "part",
    forms: ["part", "parts"],
    plain:
      "A piece of an amount. All the parts put together make the full amount.",
    example: "5 can be split into the parts 2 and 3.",
    uses: [],
    band: "K",
    autoLink: false,
  },
  {
    id: "part-to-part-ratio",
    term: "part-to-part ratio",
    forms: ["part-to-part ratio", "part-to-part ratios"],
    plain:
      "A ratio that compares one group with another group, such as red marbles to blue marbles.",
    example: "With 3 red and 5 blue marbles, red to blue is $3:5$.",
    uses: ["ratio"],
    band: "6",
  },
  {
    id: "part-to-whole-ratio",
    term: "part-to-whole ratio",
    forms: ["part-to-whole ratio", "part-to-whole ratios"],
    plain:
      "A ratio that compares one group with all the groups together, such as red marbles to all the marbles.",
    example: "With 3 red and 5 blue marbles, red to all marbles is $3:8$.",
    uses: ["ratio"],
    band: "6",
  },
  {
    id: "percent",
    term: "percent",
    forms: ["percent", "percents", "percentage", "percentages", "per cent"],
    plain:
      "A number out of 100. The sign % means per hundred, so 35% means 35 out of every 100.",
    example: "35% = $\\frac{35}{100}$ = 0.35, so 35% of 200 is 70.",
    uses: [],
    band: "6",
  },
  {
    id: "percent-change",
    term: "percent change",
    forms: [
      "percent change",
      "percent of change",
      "percent increase",
      "percent decrease",
      "percentage change",
    ],
    plain:
      "How much an amount went up or down, as a percent of the original amount: divide the amount of change by the original amount.",
    example:
      "From 40 to 50 is a change of 10, and $\\frac{10}{40}$ = 25%, so it is a 25% increase.",
    uses: ["percent", "amount-of-change"],
    noLink: ["change"],
    band: "7",
  },
  {
    id: "percent-error",
    term: "percent error",
    forms: ["percent error"],
    plain:
      "How far off an estimate or measurement is, as a percent of the true amount: the size of the error divided by the true amount.",
    example:
      "Guess 45 when the true count is 50: the error is 5, and $\\frac{5}{50}$ = 10%.",
    uses: ["percent", "estimate"],
    band: "7",
  },
  {
    id: "proportion",
    term: "proportion",
    forms: ["proportion", "proportions"],
    plain: "An equation saying that two ratios are equal.",
    example: "$\\frac{2}{3} = \\frac{8}{12}$ is a proportion.",
    uses: ["equation", "ratio"],
    band: "6",
  },
  {
    id: "proportional-relationship",
    term: "proportional relationship",
    forms: [
      "proportional relationship",
      "proportional relationships",
      "proportional",
      "directly proportional",
      "direct variation",
      "varies directly",
      "vary directly",
    ],
    plain:
      "Two quantities where one is always the same number times the other, $y = kx$. Doubling one doubles the other, and the graph is a line through the origin.",
    example:
      "At 3 dollars a pound, the cost is $y = 3x$: 2 pounds cost 6 dollars and 4 pounds cost 12. The constant of proportionality is 3.",
    uses: ["line", "origin", "constant-of-proportionality"],
    band: "7",
  },
  {
    id: "rate-of-return",
    term: "rate of return",
    forms: ["rate of return", "rates of return"],
    plain:
      "How much an investment gained or lost, as a percent of the amount put in at the start.",
    example:
      "Put in 200 dollars and end with 230 dollars: a gain of 30, and $\\frac{30}{200}$ = 15%.",
    uses: ["percent"],
    band: "7",
  },
  {
    id: "ratio",
    term: "ratio",
    forms: ["ratio", "ratios"],
    plain:
      "A comparison of two amounts, such as 4 blue for every 3 white. Write it $4:3$, 4 to 3, or $\\frac{4}{3}$; the order matters.",
    uses: [],
    band: "6",
  },
  {
    id: "simple-interest",
    term: "simple interest",
    forms: ["simple interest"],
    plain:
      "Interest paid only on the original amount, so it is the same every year: original amount × yearly rate × number of years.",
    example:
      "500 dollars at 4% a year for 3 years earns 500 × 0.04 × 3 = 60 dollars.",
    uses: ["interest", "rate"],
    band: "7",
  },
  {
    id: "simplest-ratio",
    term: "simplest ratio",
    forms: ["simplest ratio", "simplest form of a ratio"],
    plain:
      "A ratio whose two numbers cannot both be divided evenly by the same number, other than 1, such as $3:4$ instead of $6:8$.",
    uses: ["ratio"],
    band: "6",
  },
  {
    id: "tax",
    term: "tax",
    forms: ["tax", "taxes"],
    plain:
      "Money people must pay to the government. It pays for things such as schools and roads.",
    uses: [],
    band: "5",
  },
  {
    id: "unit-price",
    term: "unit price",
    forms: ["unit price", "unit prices"],
    plain:
      "The price of one item or one unit of measure, such as one pound. Divide the price by the number of units.",
    example: "6 cans for 3 dollars: 3 ÷ 6 = 0.50 dollars per can.",
    uses: ["unit"],
    band: "6",
  },
  {
    id: "unit-rate",
    term: "unit rate",
    forms: ["unit rate", "unit rates"],
    plain:
      "A rate for exactly 1 unit of the second quantity, such as 9 miles per hour. Per means for each one.",
    example: "120 pages in 4 minutes is 120 ÷ 4 = 30 pages per minute.",
    uses: ["rate", "unit"],
    band: "6",
  },
];
