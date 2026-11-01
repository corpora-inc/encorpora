import type { GlossaryEntry } from "../types";

/** Measuring length, weight and capacity, units, time and clocks, money, and everyday economics. */
export const measurementEntries: GlossaryEntry[] = [
  {
    id: "a-m",
    term: "a.m.",
    forms: ["a.m."],
    plain: "The hours from midnight to noon: the night and the morning.",
    example: "7:00 a.m. is 7 o'clock in the morning.",
    uses: [],
    band: "2",
  },
  {
    id: "benchmark",
    term: "benchmark",
    forms: ["benchmark", "benchmarks"],
    plain:
      "A familiar amount you know well, used to judge or estimate other amounts.",
    example:
      "A doorway is about 2 meters tall, so use it to estimate how tall a wall is.",
    uses: ["estimate"],
    band: "2",
  },
  {
    id: "break-even-number",
    term: "break-even number",
    forms: ["break-even number", "break-even point"],
    plain:
      "The number of items sold at which the revenue equals all the costs, so the profit is zero.",
    example:
      "Costs are 100 dollars plus 2 dollars per item, and each sells for 6 dollars: $6n = 100 + 2n$, so $n = 25$.",
    uses: ["revenue"],
    band: "5",
  },
  {
    id: "capacity",
    term: "capacity",
    forms: ["capacity", "capacities"],
    plain: "How much a container can hold.",
    example: "A jug that holds 8 cups of water has a capacity of 8 cups.",
    uses: [],
    band: "K",
  },
  {
    id: "cent",
    term: "cent",
    forms: ["cent", "cents"],
    plain:
      "The smallest unit of United States money, written ¢ after the number, as in 10¢.",
    uses: ["unit"],
    band: "2",
  },
  {
    id: "change",
    term: "change",
    forms: ["change", "changes"],
    plain: "The amount added to or taken away from a starting amount.",
    example: "There were 8 birds, then 3 more landed: the change is 3.",
    uses: [],
    band: "2",
    autoLink: false,
  },
  {
    id: "change-money",
    term: "change",
    forms: ["change"],
    plain:
      "The money you get back when you pay more than something costs: the amount paid minus the cost.",
    example:
      "Pay 5 dollars for a 3.25 dollar snack and get 1.75 dollars in change.",
    uses: [],
    noLink: ["more than"],
    band: "2",
    autoLink: false,
  },
  {
    id: "coin",
    term: "coin",
    forms: [
      "coin",
      "coins",
      "penny",
      "pennies",
      "nickel",
      "nickels",
      "dime",
      "dimes",
    ],
    plain:
      "A metal piece of money. A penny is worth 1 cent, a nickel 5 cents, a dime 10 cents and a quarter 25 cents.",
    uses: ["cent"],
    noLink: ["quarter"],
    band: "2",
  },
  {
    id: "compatible-numbers",
    term: "compatible numbers",
    forms: ["compatible numbers"],
    plain:
      "Numbers close to the real ones that are easy to work with in your head, used to estimate.",
    example: "For 347 ÷ 6, use 360 ÷ 6 = 60.",
    uses: ["estimate"],
    band: "4",
  },
  {
    id: "consumer",
    term: "consumer",
    forms: ["consumer", "consumers"],
    plain: "A person who buys and uses goods or services.",
    example: "You are a consumer when you buy a sandwich.",
    uses: [],
    band: "2",
  },
  {
    id: "count-on",
    term: "count on",
    forms: ["count on", "counting on"],
    plain:
      "Start at one number and count forward, adding the next amounts one at a time.",
    example: "To add 3 dimes to 25 cents, count on: 35, 45, 55 cents.",
    uses: ["coin", "cent"],
    band: "2",
  },
  {
    id: "credit",
    term: "credit",
    forms: ["credit"],
    plain:
      "Buying now and paying later with borrowed money. You usually pay back more than you borrowed.",
    uses: [],
    noLink: ["more than"],
    band: "2",
  },
  {
    id: "customary-units",
    term: "customary units",
    forms: ["customary units", "customary unit", "customary system"],
    plain:
      "The units of measure used in the United States: inches, feet, yards and miles; ounces and pounds; cups, pints, quarts and gallons.",
    uses: ["unit"],
    band: "4",
  },
  {
    id: "decimal-point",
    term: "decimal point",
    forms: ["decimal point", "decimal points"],
    plain:
      "The dot in a number that separates the full ones from the parts smaller than one.",
    example: "2.35 dollars means 2 dollars and 35 cents.",
    uses: ["dollar", "cent"],
    noLink: ["parts"],
    band: "2",
  },
  {
    id: "demand",
    term: "demand",
    forms: ["demand"],
    plain: "How much of a product people want to buy.",
    uses: [],
    noLink: ["product"],
    band: "5",
  },
  {
    id: "dollar",
    term: "dollar",
    forms: [],
    plain: "A unit of United States money worth 100 cents.",
    example: "2.35 dollars is 2 dollars and 35 cents.",
    uses: ["unit", "cent"],
    band: "2",
  },
  {
    id: "elapsed-time",
    term: "elapsed time",
    forms: ["elapsed time"],
    plain: "The time that passes from a start time to an end time.",
    example: "From 9:15 to 10:00 is 45 minutes of elapsed time.",
    uses: [],
    band: "3",
  },
  {
    id: "equal-groups",
    term: "equal groups",
    forms: ["equal groups", "equal group"],
    plain: "Groups that each have the same number of things.",
    example:
      "4 rows of 6 chairs are 4 equal groups of 6 chairs, 24 chairs in all.",
    uses: [],
    band: "3",
  },
  {
    id: "equivalent",
    term: "equivalent",
    forms: ["equivalent"],
    plain: "Naming the same amount, even when written differently.",
    example:
      "1 meter and 100 centimeters are equivalent, and so are $\\frac{1}{2}$ and $\\frac{2}{4}$.",
    uses: [],
    band: "4",
  },
  {
    id: "fixed-cost",
    term: "fixed cost",
    forms: ["fixed cost", "fixed costs", "fixed expense", "fixed expenses"],
    plain:
      "A cost that stays the same no matter what: the same every month, or the same however many items are made.",
    example: "Rent of 800 dollars every month is a fixed expense.",
    uses: [],
    band: "2",
  },
  {
    id: "front-end-estimation",
    term: "front-end estimation",
    forms: ["front-end estimation"],
    plain:
      "Estimating by keeping the first digit of each number and changing the other digits to zero, then working with the new numbers.",
    example: "For 347 + 285, use 300 + 200 = 500.",
    uses: ["estimate", "digit"],
    band: "4",
  },
  {
    id: "gram",
    term: "gram",
    forms: ["gram", "grams"],
    plain:
      "A small unit for measuring how heavy something is. A paper clip is about 1 gram.",
    uses: ["unit"],
    band: "3",
  },
  {
    id: "hour-hand",
    term: "hour hand",
    forms: ["hour hand", "hour hands"],
    plain: "The short hand on a clock. It points to the hour, or just past it.",
    example: "If the hour hand is between 3 and 4, it is after 3 o'clock.",
    uses: [],
    noLink: ["points"],
    band: "1",
  },
  {
    id: "income",
    term: "income",
    forms: ["income"],
    plain:
      "Money that comes in, such as pay for work or money given as a gift.",
    uses: [],
    band: "2",
  },
  {
    id: "income-tax",
    term: "income tax",
    forms: ["income tax", "income taxes"],
    plain: "A tax on the money a person earns during a year.",
    uses: ["tax"],
    band: "5",
  },
  {
    id: "kilogram",
    term: "kilogram",
    forms: ["kilogram", "kilograms"],
    plain:
      "A unit for measuring how heavy something is: 1 kilogram is 1000 grams. A large book is about 1 kilogram.",
    uses: ["unit", "gram"],
    band: "3",
  },
  {
    id: "kilometer",
    term: "kilometer",
    forms: ["kilometer", "kilometers", "kilometre", "kilometres"],
    plain:
      "A metric unit of length: 1 kilometer is 1000 meters, about how far you walk in 12 minutes.",
    uses: ["metric-units", "unit", "length"],
    band: "4",
  },
  {
    id: "length",
    term: "length",
    forms: ["length", "lengths"],
    plain:
      "How long, tall or wide something is, measured from one end to the other.",
    uses: [],
    band: "K",
  },
  {
    id: "metric-units",
    term: "metric units",
    forms: ["metric units", "metric unit", "metric system"],
    plain:
      "Units of measure based on tens, used in most countries: meters for length, grams for mass and liters for capacity.",
    example: "1 km = 1000 m, 1 m = 100 cm, and 1 cm = 10 mm.",
    uses: ["unit", "length", "gram", "mass", "liter", "capacity"],
    band: "4",
  },
  {
    id: "minute-hand",
    term: "minute hand",
    forms: ["minute hand", "minute hands"],
    plain:
      "The long hand on a clock. It shows the minutes after the hour; each number it passes adds 5 minutes.",
    example:
      "When the minute hand points to 6, it is 30 minutes after the hour.",
    uses: [],
    noLink: ["points"],
    band: "1",
  },
  {
    id: "mixed-measure",
    term: "mixed measure",
    forms: ["mixed measure", "mixed measures"],
    plain:
      "A measurement written with two units, a larger one and a smaller one.",
    example: "3 ft 8 in means 3 feet 8 inches, which is 44 inches.",
    uses: ["unit"],
    band: "5",
  },
  {
    id: "more-than",
    term: "more than",
    forms: ["more than"],
    plain: "Greater in amount. “3 more than 24” means add 3 to 24.",
    example: "9 is more than 7, and 3 more than 24 is 24 + 3 = 27.",
    uses: [],
    band: "K",
    autoLink: false,
  },
  {
    id: "number-sentence",
    term: "number sentence",
    forms: ["number sentence", "number sentences"],
    plain:
      "Numbers and signs that make a true statement. A box or a letter can stand for a missing number.",
    example: "8 + 5 = 13 and $\\square + 120 = 340$ are number sentences.",
    uses: [],
    band: "1",
  },
  {
    id: "p-m",
    term: "p.m.",
    forms: ["p.m."],
    plain: "The hours from noon to midnight: the afternoon and the evening.",
    example: "7:00 p.m. is 7 o'clock in the evening.",
    uses: [],
    band: "2",
  },
  {
    id: "payroll-tax",
    term: "payroll tax",
    forms: ["payroll tax", "payroll taxes"],
    plain:
      "A tax taken out of each paycheck, which pays for programs such as Social Security and Medicare.",
    uses: ["tax"],
    band: "5",
  },
  {
    id: "producer",
    term: "producer",
    forms: ["producer", "producers"],
    plain:
      "A person or business that makes goods or provides services to sell.",
    example: "A baker is a producer of bread.",
    uses: [],
    band: "2",
  },
  {
    id: "property-tax",
    term: "property tax",
    forms: ["property tax", "property taxes"],
    plain:
      "A tax paid each year on land and buildings a person owns, based on how much they are worth.",
    uses: ["tax"],
    band: "5",
  },
  {
    id: "revenue",
    term: "revenue",
    forms: ["revenue"],
    plain:
      "All the money a business takes in from sales: the price times the number sold.",
    example:
      "Selling 40 cups of lemonade at 2 dollars each brings in 80 dollars of revenue.",
    uses: [],
    band: "5",
  },
  {
    id: "sales-tax",
    term: "sales tax",
    forms: ["sales tax", "sales taxes"],
    plain:
      "A tax added to the price when you buy something. It is a set number of cents for each dollar spent.",
    example: "With 6% sales tax, a 10 dollar shirt costs 10.60 dollars.",
    uses: ["tax", "cent", "dollar"],
    band: "5",
  },
  {
    id: "strip-diagram",
    term: "strip diagram",
    forms: [
      "strip diagram",
      "strip diagrams",
      "tape diagram",
      "tape diagrams",
      "bar model",
      "bar models",
    ],
    plain:
      "A drawing that shows a whole as one long bar and its parts as shorter bars that together match its length.",
    uses: ["whole", "part", "length"],
    band: "4",
  },
  {
    id: "supply",
    term: "supply",
    forms: ["supply"],
    plain:
      "How much of a product is for sale. When fewer are for sale than people want, the product is scarce and its price tends to go up.",
    uses: [],
    noLink: ["product"],
    band: "5",
  },
  {
    id: "times-as-many",
    term: "times as many",
    forms: ["times as many", "times as much"],
    plain:
      "A comparison by multiplying. “3 times as many as 24” means 3 copies of 24, or 3 × 24.",
    example:
      "Sam has 4 stickers and Ana has 3 times as many: 3 × 4 = 12 stickers.",
    uses: [],
    band: "3",
  },
  {
    id: "unit",
    term: "unit",
    forms: ["unit", "units"],
    plain:
      "A fixed amount used to measure, such as an inch, a cup or a paper clip. Count how many units it takes.",
    uses: [],
    band: "1",
    autoLink: false,
  },
  {
    id: "unknown",
    term: "unknown",
    forms: ["unknown", "unknowns"],
    plain:
      "The number you are asked to find. A box or a letter can stand for it.",
    example: "In $\\square + 3 = 8$, the unknown is 5.",
    uses: [],
    band: "1",
  },
  {
    id: "variable-cost",
    term: "variable cost",
    forms: [
      "variable cost",
      "variable costs",
      "variable expense",
      "variable expenses",
    ],
    plain:
      "A cost that changes: from month to month, or with the number of items made.",
    example:
      "Groceries might cost 90 dollars one month and 120 dollars the next.",
    uses: [],
    noLink: ["changes"],
    band: "2",
  },
  {
    id: "weight",
    term: "weight",
    forms: ["weight", "weights"],
    plain: "How heavy something is.",
    example: "A bag of apples has a greater weight than one apple.",
    uses: [],
    band: "K",
  },
];
