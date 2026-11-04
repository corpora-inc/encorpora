import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

/** Lessons, methods and principles for grade-4 measurement and money.
 * Facet ids are `unit-conversion.tables-intervals` and
 * `decimal-money-operations.operations`. */
export const grade4MeasurementMoneyMethods: Record<string, ProblemMethod> = {
  "elapsed-time-intervals": {
    goal: "Find the end time after one activity or two, to the minute, including times that cross an hour.",
    intuition:
      "Elapsed time is how long something takes. A clock shows the start. Add the hours and the minutes to that start. When the minutes reach 60, that is another hour. An end time can fall in the afternoon even when the start was in the morning.",
    terms: ["elapsed-time", "unit"],
    senses: { unit: "unit", units: "unit" },
    method: [
      "Read the start time on the clock and note whether the story says morning or afternoon.",
      "Add the first duration. If the minutes reach 60 or more, carry 60 minutes into the next hour.",
      "If there is a second activity, add that duration the same way. The result is the end time, to the minute.",
    ],
    watch:
      "Add every activity. Stopping after the first one, or swapping a.m. and p.m., is not the end time.",
  },
  "conversion-table-slots": {
    goal: "Fill the missing number in each column of a table that matches a larger unit with a smaller one.",
    intuition:
      "A conversion table shows the same measures written two ways. Each row uses one rule. The larger unit is the one you rename into more of the smaller unit: 1 foot is 12 inches, 1 kilogram is 1,000 grams, 1 hour is 60 minutes and 1 liter is 1,000 milliliters.",
    terms: ["unit"],
    senses: { unit: "unit", units: "unit" },
    method: [
      "Read the completed row and find how many smaller units make one larger unit.",
      "When the smaller number is shown, divide it by that rule to fill the larger unit.",
      "When the larger number is shown, multiply it by that rule to fill the smaller unit.",
    ],
    watch:
      "Divide to fill the larger unit and multiply to fill the smaller unit. The two columns do not use the same operation.",
  },
  "unit-rename-larger": {
    goal: "Rename a measure in a smaller unit as a whole number of a larger unit.",
    intuition:
      "A unit is a fixed amount used to measure. Several small units make one larger unit. To write a measure in the larger unit, divide by how many small units fit in one large unit. The answer here is a whole number.",
    terms: ["unit"],
    senses: { unit: "unit", units: "unit" },
    method: [
      "Name the rule: how many of the smaller unit make 1 of the larger unit.",
      "Divide the given measure by that number.",
      "The quotient is the measure in the larger unit. There is no remainder in these problems.",
    ],
    watch:
      "Divide, because the larger unit is the bigger step. Multiplying would write the measure in an even smaller unit.",
  },
  "measurement-line-fraction-story": {
    goal: "Read the distance between two marks on a measurement number line as a fraction of a mile.",
    intuition:
      "A number line is a line with equal steps. On this trail, the steps between whole miles are equal, and the denominator is how many steps make one mile. The distance from one mark to the other is the number of steps between them, written over that denominator.",
    terms: ["number-line", "fraction", "denominator", "unit"],
    senses: {
      unit: "unit",
      units: "unit",
      fraction: "fraction",
      fractions: "fraction",
      denominator: "denominator",
      denominators: "denominator",
      "number line": "number-line",
      "number lines": "number-line",
    },
    method: [
      "Count the equal steps in one mile. That number is the denominator.",
      "Count the steps from the first mark to the second mark. That number is the numerator.",
      "Write the distance as a fraction of a mile, and simplify it when the two numbers share a factor.",
    ],
    watch:
      "The marks name positions. The distance is the steps between them, not the position of either mark.",
  },
  "measuring-tool-choice": {
    goal: "Choose the ruler, balance, thermometer, measuring cup or scale that measures what the question asks.",
    intuition:
      "Length is how long something is, and a ruler measures it. Mass is the amount of matter, and a balance compares a mass with known masses. A thermometer measures temperature. A measuring cup measures liquid. Weight in pounds is read from a scale.",
    terms: ["length", "weight", "mass", "unit"],
    senses: {
      balance: "balance-scale",
      balances: "balance-scale",
      length: "length",
      lengths: "length",
      weight: "weight",
      weights: "weight",
      mass: "mass",
      unit: "unit",
      units: "unit",
    },
    noLink: ["scale", "scales"],
    method: [
      "Name the attribute the question asks for: length, mass, temperature, liquid or weight.",
      "Match that attribute to the one tool that measures it.",
      "Reject a tool that measures a different attribute, even if it is a measuring tool.",
    ],
    watch:
      "One question has one attribute. A ruler does not measure temperature, and a balance does not measure length.",
  },
  "decimal-sum-difference": {
    goal: "Add or subtract decimals through hundredths, including a tenth next to a hundredth.",
    intuition:
      "A decimal point separates the ones from the tenths. One tenth is ten hundredths, so 3.4 is the same as 3.40. Line up the decimal points before you add or subtract, and write the result through hundredths.",
    terms: ["decimal-point", "difference-subtract"],
    senses: {
      difference: "difference-subtract",
      differences: "difference-subtract",
      "decimal point": "decimal-point",
      "decimal points": "decimal-point",
    },
    method: [
      "Write the numbers with the decimal points lined up. Write a tenth as hundredths by putting a 0 in the hundredths place.",
      "Add or subtract the hundredths, then the tenths, then the ones. Regroup when a column needs it.",
      "Place the decimal point in the result under the other decimal points, and write two digits after it.",
    ],
    watch:
      "Do not line up the last digits when one number has only tenths. 3.4 minus 1.27 is 3.40 minus 1.27.",
  },
  "money-decimal-story": {
    goal: "Add prices, make change, multiply or divide a cents price, or count the fewest coins.",
    intuition:
      "A dollar is 100 cents. We write 3 dollars and 40 cents as 3.40. Change is the money you get back: the amount you paid minus the cost. A payment is a whole bill, or a bill plus quarters. For the fewest coins, take the largest coin that fits, then do it again with what is left. A quarter is 25 cents, a dime is 10, a nickel is 5 and a penny is 1.",
    terms: ["change-money", "coin", "decimal-point"],
    senses: {
      change: "change-money",
      difference: "difference-subtract",
      differences: "difference-subtract",
      coin: "coin",
      coins: "coin",
      "decimal point": "decimal-point",
      "decimal points": "decimal-point",
    },
    noLink: ["quarter", "quarters"],
    method: [
      "Write each amount in cents, or keep two digits after the decimal point.",
      "Add prices for a total. Subtract the cost from the payment for change. For equal shares, multiply the price by the number bought, then divide by the number of people.",
      "For the fewest coins, use quarters, then dimes, nickels and pennies, and count the pieces.",
    ],
    watch:
      "Change is payment minus cost, not cost minus payment. The fewest coins is not the same as the number of cents.",
  },
  "money-model-decimal": {
    goal: "Total the bills in one set and the ten coins in the other, then write the amount in dollars and cents.",
    intuition:
      "A coin is a metal piece of money. A five-dollar bill is 5 dollars, and a one-dollar bill is 1 dollar. A quarter is 25 cents, a dime is 10 cents, a nickel is 5 cents and a penny is 1 cent. 100 cents is 1 dollar. The total is written 6.85.",
    terms: ["coin", "decimal-point"],
    senses: {
      coin: "coin",
      coins: "coin",
      "decimal point": "decimal-point",
      "decimal points": "decimal-point",
    },
    noLink: ["quarter", "quarters"],
    method: [
      "Write the bill as cents: 500 for a five-dollar bill, or 100 for each one-dollar bill.",
      "Add 25 cents for each quarter, 10 for each dime, 5 for each nickel and 1 for each penny.",
      "Add the bill and the coins. Then write the total in dollars, with two digits after the decimal point.",
    ],
    watch:
      "A five-dollar bill is 5 dollars, not 5 cents. Count each coin by its value, not as 1.",
  },
};

export const grade4MeasurementMoneyPrinciples: Record<string, string> = {
  "elapsed-time-intervals":
    "If a start time is $S$ minutes after midnight and the activities take $D$ minutes altogether, the end time is $S + D$ minutes after midnight. Every 60 minutes is one hour. The end can fall after 12:00 even when the start was before it.",
  "conversion-table-slots":
    "If 1 larger unit equals $k$ smaller units, a row $(n,\\, nk)$ shows the same measure both ways. A missing larger number is the smaller number divided by $k$. A missing smaller number is the larger number multiplied by $k$.",
  "unit-rename-larger":
    "If 1 larger unit equals $k$ smaller units, then $nk$ smaller units equal $n$ larger units. The whole-number result is $nk \\div k$.",
  "measurement-line-fraction-story":
    "On a number line whose unit is split into $d$ equal steps, the distance from step $a$ to step $b$ is $\\frac{b-a}{d}$ of the unit. The denominator stays $d$ because every step is one part of the same mile.",
  "measuring-tool-choice":
    "A measuring tool matches one attribute: a ruler for length, a balance for comparing masses, a thermometer for temperature, a measuring cup for liquid volume and a scale for weight. A question that names one attribute has one of these tools.",
  "decimal-sum-difference":
    "A decimal through hundredths is a number of hundredths. One tenth is ten hundredths, so a one-place decimal is rewritten with a hundredths digit of 0 before it is added to or subtracted from a two-place decimal. The result is exact in hundredths.",
  "money-decimal-story":
    "An amount of $d$ dollars and $c$ cents is $100d + c$ cents. Change is the payment minus the cost. Equal shares of a total that divides evenly are the total divided by the number of people. With coins of 25, 10, 5 and 1 cent, taking the largest coin that fits each time uses the fewest coins.",
  "money-model-decimal":
    "The value of a set is the sum of its pieces: 500 cents for a five-dollar bill, 100 for a one-dollar bill, 25 for a quarter, 10 for a dime, 5 for a nickel and 1 for a penny. That sum, written in dollars, has the cents in the two digits after the decimal point.",
};

export const grade4MeasurementMoneyLessons: Lesson[] = [
  {
    id: "grade4-measurement-intervals",
    title: "Elapsed time, conversion tables and measuring tools",
    summary:
      "Add minutes to a start time, including past the hour. A conversion table matches a larger unit with a smaller one. Dividing writes a measure in a larger unit. The tool has to match the attribute.",
    templateIds: [
      "elapsed-time-intervals",
      "conversion-table-slots",
      "unit-rename-larger",
      "measuring-tool-choice",
    ],
    senses: { unit: "unit", units: "unit" },
    noLink: ["scale", "scales"],
    objectives: [
      "Find an end time to the minute after one duration or two activities, including times that cross an hour.",
      "Complete both columns of a conversion table, and rename a smaller unit as a whole number of a larger unit.",
      "Choose the tool that measures length, mass, temperature, liquid or weight.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "The same measure, written another way",
        paragraphs: [
          "Elapsed time is how long an activity takes. Start at the clock time and add the minutes. When the minutes reach 60, the hour goes up by 1 and the minutes start over. A hike that starts at 10:40 a.m. and takes 35 minutes ends at 11:15 a.m.",
          "A conversion table keeps one rule in every row. If the first row shows 2 feet and 24 inches, then 1 foot is 12 inches. Divide the inches by 12 to fill a missing number of feet. Multiply the feet by 12 to fill a missing number of inches. The same idea works for kilograms and grams, hours and minutes, and liters and milliliters.",
          "To write a smaller unit as a larger unit, divide. 48 inches is 48 divided by 12, which is 4 feet. The answer is a whole number.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A hike starts at 10:40 a.m. The hike takes 35 minutes. Then a snack takes 20 minutes. What time does the snack end?",
      steps: [
        "Start at 10:40 a.m. Add 35 minutes: 40 plus 35 is 75 minutes, which is 1 hour and 15 minutes. The hike ends at 11:15 a.m.",
        "Add the snack: 15 minutes plus 20 minutes is 35 minutes. The hour stays 11.",
        "The snack ends at 11:35 a.m. Both activities were added, and the time crossed an hour.",
      ],
      answer: "11:35 a.m.",
    },
    closingSections: [
      {
        stage: "method",
        title: "Match the tool to the question",
        paragraphs: [
          "A ruler measures length. A balance compares a mass with known masses. A thermometer measures temperature. A measuring cup measures liquid. A scale shows weight in pounds.",
          "Read what the question asks you to measure, then choose the one tool for that attribute.",
        ],
      },
    ],
    pitfalls: [
      "Stopping after the first activity leaves out the second duration.",
      "Multiplying writes a larger unit as a smaller one. Renaming the other way uses division.",
      "A measuring tool for the wrong attribute does not answer the question.",
    ],
    parentGuide:
      "Ask the learner to add 35 minutes and then 20 minutes to 10:40 a.m., and to say why 48 inches is 4 feet.",
  },
  {
    id: "grade4-measurement-line",
    title: "A fraction on a measurement scale",
    summary:
      "A measurement number line splits each mile into equal steps. The distance between two marks is the number of steps between them, written as a fraction of a mile.",
    templateIds: ["measurement-line-fraction-story"],
    senses: {
      fraction: "fraction",
      fractions: "fraction",
      denominator: "denominator",
      denominators: "denominator",
      "number line": "number-line",
      "number lines": "number-line",
      unit: "unit",
      units: "unit",
    },
    objectives: [
      "Count the equal steps in one mile and use that count as the denominator.",
      "Find the distance between two marks by counting the steps between them.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Steps between two marks",
        paragraphs: [
          "The trail is a number line. Each mile is split into the same number of equal steps. That number is the denominator of the distance.",
          "A mark shows a position, not a distance. Count from the first mark to the second mark. If one mile has 4 steps, and the marks are 5 steps apart, the walk is $\\frac{5}{4}$ miles.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "Each mile is split into 4 equal steps. Mark $A$ is 1 step from 0. Mark $B$ is 6 steps from 0. How far is the walk from $A$ to $B$, in miles?",
      steps: [
        "The denominator is 4, because 4 equal steps make 1 mile.",
        "From step 1 to step 6 is $6 - 1 = 5$ steps.",
        "The walk is $\\frac{5}{4}$ miles. The positions were 1 and 6; the distance is the difference.",
      ],
      answer: "$\\frac{5}{4}$",
    },
    closingSections: [
      {
        stage: "method",
        title: "Read the scale, then subtract",
        paragraphs: [
          "The story does not state the positions. Read them on the number line. Subtract the smaller step count from the larger one, and write that difference over the steps in one mile.",
        ],
      },
    ],
    pitfalls: [
      "The position of a mark is not the distance between the marks.",
      "The denominator is the steps in one mile, not the number of steps in the walk.",
    ],
    parentGuide:
      "Draw a line of fourths, mark two points, and ask how many fourths of a mile the walk is.",
  },
  {
    id: "grade4-decimal-money",
    title: "Decimals and money through hundredths",
    summary:
      "Add and subtract decimals through hundredths, including a tenth beside a hundredth. Money stories use the same place value for totals, change, equal shares and the fewest coins. Bills and coins together make one decimal.",
    templateIds: [
      "decimal-sum-difference",
      "money-decimal-story",
      "money-model-decimal",
    ],
    senses: {
      change: "change-money",
      difference: "difference-subtract",
      differences: "difference-subtract",
      coin: "coin",
      coins: "coin",
      "decimal point": "decimal-point",
      "decimal points": "decimal-point",
    },
    noLink: ["quarter", "quarters"],
    objectives: [
      "Add and subtract decimals through hundredths, lining up the decimal points.",
      "Solve a money story: a total, change from a whole bill or a bill plus quarters, an equal share, or the fewest coins.",
      "Write a bill plus mixed coins as dollars and cents.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Hundredths are cents",
        paragraphs: [
          "A decimal point separates the ones from the tenths. The second digit after the point is hundredths. One tenth is ten hundredths, so 3.4 is 3.40. Line the points up before you add or subtract.",
          "A dollar is 100 cents. 3.40 is 340 cents, and 1.27 is 127 cents. Change is the payment minus the cost. For the fewest coins under a dollar, take quarters first, then dimes, nickels and pennies.",
        ],
      },
    ],
    workedExample: {
      prompt: "What is $3.40 - 1.27$?",
      steps: [
        "Write 3.4 as 3.40 so both numbers show hundredths. 3.40 is 340 cents and 1.27 is 127 cents.",
        "Subtract: $340 - 127 = 213$. That is 213 cents.",
        "213 cents is 2 dollars and 13 cents, which is written 2.13.",
      ],
      answer: "$2.13$",
    },
    closingSections: [
      {
        stage: "method",
        title: "Bills, coins and change",
        paragraphs: [
          "A five-dollar bill is 500 cents. A one-dollar bill is 100 cents. Add the coins by their values, then write the total with two digits after the decimal point.",
          "When friends split a cost equally, multiply the price by how many items, then divide by the number of friends. The share comes out in exact cents.",
        ],
      },
    ],
    pitfalls: [
      "Lining up the last digits treats 3.4 as 0.34. Write 3.4 as 3.40 first.",
      "Change is not the cost minus the payment.",
      "The number of coins is not the number of cents. 41 cents can be 4 coins.",
    ],
    parentGuide:
      "Ask the learner to subtract 1.27 from 3.40 in cents, then to make 41 cents with the fewest coins.",
  },
];

export const grade4MeasurementMoneyFacetMappings = [
  {
    templateId: "elapsed-time-intervals",
    facetId: "unit-conversion.tables-intervals",
    extent: "partial" as const,
    rationale:
      "Finds the end time after one duration or two activities, to the minute, including intervals that cross an hour and noon. Does not ask for a duration between two given clock times.",
  },
  {
    templateId: "conversion-table-slots",
    facetId: "unit-conversion.tables-intervals",
    extent: "partial" as const,
    rationale:
      "Fills one missing entry in each column of a feet and inches, kilograms and grams, hours and minutes, or liters and milliliters table. Does not ask the learner to build the table.",
  },
  {
    templateId: "unit-rename-larger",
    facetId: "unit-conversion.tables-intervals",
    extent: "partial" as const,
    rationale:
      "Renames a smaller unit as a whole number of a larger unit. A Florida axis omits grams to kilograms, meters to kilometers and milliliters to liters. The core axis includes those pairs. Decimal notation is not used.",
  },
  {
    templateId: "measurement-line-fraction-story",
    facetId: "unit-conversion.tables-intervals",
    extent: "partial" as const,
    rationale:
      "Reads the distance between two marks on a mile scale as a fraction with denominator 2, 3, 4, 5, 6, 8, 10 or 12. Denominators 16 and 100 are not used.",
  },
  {
    templateId: "measuring-tool-choice",
    facetId: "unit-conversion.tables-intervals",
    extent: "partial" as const,
    rationale:
      "Chooses among a ruler, a balance, a thermometer, a measuring cup and a scale. Does not read a scale or use a physical tool.",
  },
  {
    templateId: "decimal-sum-difference",
    facetId: "decimal-money-operations.operations",
    extent: "partial" as const,
    rationale:
      "Adds or subtracts decimals through hundredths, including a tenth written beside a hundredth. Thousandths and multiplication are not used.",
  },
  {
    templateId: "money-decimal-story",
    facetId: "decimal-money-operations.operations",
    extent: "partial" as const,
    rationale:
      "Adds prices, makes change from a whole bill or a bill plus quarters, multiplies or divides a cents price in two steps, or counts the fewest coins under one dollar.",
  },
  {
    templateId: "money-model-decimal",
    facetId: "decimal-money-operations.operations",
    extent: "partial" as const,
    rationale:
      "Totals the bills in one set and exactly ten mixed coins of all four denominations in the other, written as dollars and cents. Does not ask for the fewest coins.",
  },
];
