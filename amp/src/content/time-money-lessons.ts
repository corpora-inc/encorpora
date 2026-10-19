import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

const twoHands: Lesson["sections"][number] = {
  title: "Two hands, two jobs",
  paragraphs: [
    "The short hand shows the hour. The long hand shows the minutes. Both turn the same way, from 12 toward 1, 2 and 3.",
    "In one hour the long hand goes once around the whole clock, while the short hand moves only from one numeral to the next.",
  ],
};

export const timeMoneyLessons: Lesson[] = [
  {
    id: "hours-and-half-hours",
    title: "Hours and half hours",
    summary:
      "On the hour the long hand points at 12; at half past it points at 6, and the short hand sits halfway to the next hour.",
    templateIds: [
      "read-clock-hour-half",
      "clock-hour-read",
      "match-clock-half-hour",
    ],
    includeGeneratedRepresentation: false,
    objectives: [
      "Tell which hand shows the hour and which shows the minutes.",
      "Read and write times on the hour and half hour, such as 3:00 and 3:30.",
      "Name the hour when the short hand is between two numerals.",
    ],
    sections: [
      twoHands,
      {
        title: "On the hour and half past",
        paragraphs: [
          "At 3:00 the long hand points at 12 and the short hand points at 3. We say three o'clock.",
          "At 3:30 the long hand has gone halfway around, to 6. The short hand has gone halfway from 3 to 4. It has passed 3 but not reached 4, so the hour is still 3: half past three.",
        ],
        illustration: "clock-hour-half",
      },
    ],
    workedExample: {
      prompt:
        "The long hand points at 6. The short hand is halfway between 8 and 9. What time is it?",
      steps: [
        "The long hand at 6 means half past the hour: 30 minutes.",
        "The short hand has passed 8 but not reached 9, so the hour is 8.",
        "The time is 8:30, half past eight.",
      ],
      answer: "8:30",
    },
    pitfalls: [
      "At half past, the short hand is between two numerals; the hour is the one it has passed, not the next one.",
      "The long hand at 6 means 30 minutes, not 6 minutes.",
    ],
    parentGuide:
      "Set a real clock to 3:00, then turn the long hand slowly to 3:30. Ask the child to watch the short hand and say where it is now.",
  },
  {
    id: "time-to-five-minutes",
    title: "Time to five minutes",
    summary:
      "Each numeral the long hand reaches is 5 more minutes; count by fives from 12.",
    templateIds: [
      "read-clock-five-minutes",
      "minutes-past-hour",
      "match-clock-five-minutes",
      "clock-am-pm",
    ],
    includeGeneratedRepresentation: false,
    objectives: [
      "Count minutes by fives from 12 to the long hand.",
      "Read and write times such as 4:35 from an analog clock.",
      "Choose a.m. or p.m. from the time of day.",
    ],
    sections: [
      twoHands,
      {
        title: "Count by fives",
        paragraphs: [
          "There are 60 small marks around the clock, one for each minute, and a numeral at every fifth mark. So the long hand at 1 is 5 minutes, at 2 is 10 minutes, and at 7 is 35 minutes.",
          "To read 4:35, count by fives from 12 to the long hand: 5, 10, 15, 20, 25, 30, 35. The short hand has passed 4 and is moving toward 5, so the hour is 4.",
        ],
        illustration: "clock-five-minutes",
      },
      {
        title: "a.m. and p.m.",
        paragraphs: [
          "A clock shows each time twice a day. Times from midnight to noon are a.m.; times from noon to midnight are p.m.",
          "Breakfast at 7:15 is 7:15 a.m. Dinner at 6:15 is 6:15 p.m.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "The long hand points at 4. The short hand is a little past 9. What time is it?",
      steps: [
        "Count by fives from 12 to 4: 5, 10, 15, 20. That is 20 minutes.",
        "The short hand has passed 9 but not reached 10, so the hour is 9.",
        "The time is 9:20.",
      ],
      answer: "9:20",
    },
    pitfalls: [
      "The long hand at 4 means 20 minutes, not 4 minutes.",
      "Late in the hour the short hand is close to the next numeral, but the hour does not change until it gets there.",
    ],
    parentGuide:
      "Read the clock together at a few daily moments, counting the long hand by fives aloud. Ask whether each time is a.m. or p.m.",
  },
  {
    id: "coins-and-bills",
    title: "Coins and bills",
    summary:
      "Count money from the largest value down, counting on by each coin's value.",
    templateIds: [
      "coin-total",
      "money-total-dollars",
      "make-a-dollar",
      "pay-exact-coins",
      "money-left-story",
    ],
    includeGeneratedRepresentation: false,
    objectives: [
      "Name the value of a penny, nickel, dime, quarter, one-dollar bill and five-dollar bill.",
      "Count a group of coins and bills by counting on from the largest value.",
      "Find change from a price and the amount needed to make one dollar.",
    ],
    sections: [
      {
        title: "What each piece is worth",
        paragraphs: [
          "A penny is 1¢, a nickel 5¢, a dime 10¢ and a quarter 25¢. A dime is smaller than a nickel but worth more, so read the value, not the size.",
          "A one-dollar bill is 100¢, the same as 4 quarters or 10 dimes. A five-dollar bill is 5 dollars.",
        ],
        illustration: "coin-values",
      },
      {
        title: "Count on from the largest",
        paragraphs: [
          "Sort the coins from the most valuable to the least. Then count on: for 2 quarters, 1 dime, 1 nickel and 1 penny, say 25, 50, 60, 65, 66. The coins are worth 66¢.",
          "With bills, count the dollars first and the coins after: 2 one-dollar bills and 35¢ is 2 dollars and 35 cents, written $2.35.",
        ],
        illustration: "coin-count-on",
      },
    ],
    workedExample: {
      prompt:
        "Ana has 3 quarters, 1 dime and 2 pennies. She buys a sticker for 40¢. How many cents does she have left?",
      steps: [
        "Count on from the quarters: 25, 50, 75, then the dime 85, then the pennies 86, 87.",
        "Ana has 87¢.",
        "Take away the price: 87 − 40 = 47. She has 47¢ left.",
      ],
      answer: "47",
      answerUnit: "¢",
    },
    pitfalls: [
      "A dime is smaller than a nickel but worth more: 10¢ against 5¢.",
      "Count the most valuable coins first; starting with pennies makes counting on harder.",
    ],
    parentGuide:
      "Put a handful of real coins on the table. Ask the child to sort them by value, then count on aloud from the largest.",
  },
];

const handTerms: [string, string][] = [
  ["Hour hand", "The short hand; it shows the hour."],
  ["Minute hand", "The long hand; it shows the minutes."],
];
const coinTerms: [string, string][] = [
  ["Cent (¢)", "The smallest unit of money; 100 cents make 1 dollar."],
  ["Count on", "Start from a value and add each next piece in turn."],
];
const readMethod = [
  "Find the long hand and count by fives from 12 to it: the minutes.",
  "Find the short hand: the hour is the last numeral it has reached.",
  "Write the hour, a colon, then the minutes with two digits.",
];
export const timeMoneyMethods: Record<string, ProblemMethod> = {
  "read-clock-hour-half": {
    goal: "Read a clock showing a time on the hour or half hour.",
    terms: handTerms,
    method: [
      "Long hand at 12: on the hour. Long hand at 6: half past.",
      "The hour is the last numeral the short hand has reached.",
      "Write the time: 3:00 or 3:30.",
    ],
    watch:
      "At half past, the short hand is past the hour, not at the next one.",
  },
  "clock-hour-read": {
    goal: "Name the hour on a clock showing a time on the hour or half past.",
    terms: handTerms,
    method: [
      "Find the short hand.",
      "If it is between two numerals, the hour is the smaller one it has passed.",
    ],
    watch: "Do not read the numeral the short hand is moving toward.",
  },
  "match-clock-half-hour": {
    goal: "Pick the clock that shows a time on the hour or half hour.",
    terms: handTerms,
    method: [
      "On the hour the long hand points at 12; at half past it points at 6.",
      "Check the short hand: on the hour, or halfway past it.",
      "The clock where both hands match is the answer.",
    ],
    watch:
      "A clock with the hands swapped looks close but shows a different time.",
  },
  "read-clock-five-minutes": {
    goal: "Read a clock to the nearest five minutes.",
    terms: handTerms,
    method: readMethod,
    watch: "The long hand at 7 means 35 minutes, not 7.",
  },
  "minutes-past-hour": {
    goal: "Count the minutes past the hour from the long hand.",
    terms: handTerms,
    method: [
      "Find the numeral the long hand points at.",
      "Count by fives from 12 up to it: one five for each numeral.",
      "That count is the minutes past the hour: pointing at 7 is 35 minutes.",
    ],
    watch: "Each numeral is 5 minutes, so multiply by 5, not 1.",
  },
  "clock-am-pm": {
    goal: "Read a clock and choose a.m. or p.m. from the activity.",
    terms: [
      ["a.m.", "Times from midnight to noon."],
      ["p.m.", "Times from noon to midnight."],
    ],
    method: [
      "Read the clock: minutes from the long hand, the hour from the short hand.",
      "Morning activities are a.m.; afternoon and evening activities are p.m.",
    ],
    watch: "The clock alone cannot tell a.m. from p.m.; the activity does.",
  },
  "match-clock-five-minutes": {
    goal: "Pick the clock that shows a written time in five-minute steps.",
    terms: handTerms,
    method: [
      "Divide the minutes by 5 to find where the long hand points.",
      "The short hand is just past the hour numeral.",
      "Pick the clock where both hands match.",
    ],
    watch: "Late in the hour, the short hand is close to the next numeral.",
  },
  "coin-total": {
    goal: "Find the value of a group of coins in cents.",
    terms: coinTerms,
    method: [
      "Sort the coins: quarters, dimes, nickels, pennies.",
      "Count on: by 25, then by 10, by 5 and by 1.",
    ],
    watch: "A dime is smaller than a nickel but worth more.",
  },
  "money-total-dollars": {
    goal: "Find the value of bills and coins in dollars.",
    terms: [
      ...coinTerms,
      ["Dollar", "100 cents; $2.35 is 2 dollars and 35 cents."],
    ],
    method: [
      "Add the bills: dollars.",
      "Count on the coins: cents.",
      "Write the dollars, a point, then the cents with two digits.",
    ],
    watch: "5 cents is written .05, not .5.",
  },
  "make-a-dollar": {
    goal: "Find how many more cents make one dollar.",
    terms: coinTerms,
    method: [
      "Count the coins from the largest value down: 25, 35, 40, 41.",
      "Count up from that total to 100: 41 to 50 is 9, then 50 more to 100.",
      "Add the jumps: 9 + 50 = 59.",
    ],
    watch: "Find the amount still needed, not the amount already there.",
  },
  "pay-exact-coins": {
    goal: "Pick the set of coins worth exactly a price.",
    terms: coinTerms,
    method: [
      "Count each set on from its largest coin.",
      "Pick the set whose total equals the price.",
    ],
    watch: "Mixing up a nickel and a dime changes a total by 5¢.",
  },
  "money-left-story": {
    goal: "Count coins, then subtract a price.",
    terms: coinTerms,
    method: [
      "Count the coins on from the largest: 25, 50, 60, 61 is 61¢.",
      "Subtract the price from that total: 61 − 35 = 26.",
      "Check: what is left plus the price makes the total.",
    ],
    watch: "Count all the coins before taking the price away.",
  },
};
export const timeMoneyPrinciples: Record<string, string> = {
  "read-clock-hour-half":
    "The long hand at 12 means on the hour, at 6 half past; the hour is the last numeral the short hand has reached.",
  "clock-hour-read":
    "The short hand moves steadily from one numeral to the next, so between two numerals the hour is the one it has passed.",
  "match-clock-half-hour":
    "A time fixes both hands: the long hand by the minutes and the short hand by the hour and how far into it.",
  "read-clock-five-minutes":
    "Each numeral is 5 minutes for the long hand, so its minutes are 5 times the numeral it points at.",
  "minutes-past-hour":
    "Each numeral is 5 minutes for the long hand, so counting by fives from 12 gives the minutes.",
  "clock-am-pm":
    "A clock shows each time twice a day; a.m. runs from midnight to noon and p.m. from noon to midnight.",
  "match-clock-five-minutes":
    "A time fixes both hands: the long hand at minutes ÷ 5, the short hand that far past the hour.",
  "coin-total":
    "A group of coins is worth the sum of their values; counting on from the largest keeps the sum easy.",
  "money-total-dollars":
    "100 cents make a dollar, so dollars and cents together are written with the cents as two decimal places.",
  "make-a-dollar":
    "The amount still needed is the difference between 100 cents and what is there.",
  "pay-exact-coins":
    "Different sets of coins can have the same value; only the total decides.",
  "money-left-story": "Money left is the total minus the price.",
};
