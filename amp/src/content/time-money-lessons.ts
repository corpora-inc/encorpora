import type { MethodTerm } from "../glossary/types";
import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

const twoHands: Lesson["sections"][number] = {
  title: "Two hands, two jobs",
  paragraphs: [
    "A clock has two hands, the pointers that turn around the clock. The short hand is the hour hand. It shows the hour. The long hand is the minute hand. It shows the minutes.",
    "Both hands turn the same way: from 12 to 1, then 2, then 3. We call that way clockwise.",
    "In one hour, the long hand goes all the way around once. In that same hour, the short hand moves only from one number to the next.",
  ],
};

export const timeMoneyLessons: Lesson[] = [
  {
    id: "hours-and-half-hours",
    title: "Hours and half hours",
    summary:
      "A clock has two hands, the pointers that turn around it. The short hand shows the hour. The long hand shows the minutes. An hour is 60 minutes. Half an hour is 30 minutes. In half an hour, the long hand goes halfway around. If the short hand starts on a number, it moves halfway to the next number.",
    templateIds: [
      "read-clock-hour-half",
      "clock-hour-read",
      "match-clock-half-hour",
    ],
    noLink: ["whole"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Tell which hand shows the hour and which shows the minutes.",
      "Read and write times on the hour and half hour, such as 3:00 and 3:30.",
      "Name the hour when the short hand is between two numbers.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Watch both clock hands",
        paragraphs: [
          "The long hand counts the minutes as it goes around the clock. One whole trip around takes 60 minutes, which is one hour.",
          "The short hand shows the hour. It moves slowly, all the time, toward the next number.",
          "Half past means 30 minutes after the hour. At half past, the long hand is halfway around, at 6. The short hand is halfway to the next number.",
        ],
      },
      twoHands,
      {
        title: "On the hour and half past",
        paragraphs: [
          "Look at the first clock in the picture. The long hand points at 12. The short hand points at 3. O'clock means just on the hour, with 0 minutes. So it is 3 o'clock, written 3:00.",
          "Look at the second clock. The long hand has gone halfway around, to 6. That means 30 minutes.",
          "The short hand is halfway from 3 to 4. It has gone past 3, but it has not reached 4. So the hour is still 3. The time is 3:30, half past three.",
          "When we write a time, the hour comes first. Then comes a colon, the two dots. Then come the minutes.",
        ],
        illustration: "clock-hour-half",
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Two hands, one time",
        paragraphs: [
          "The long hand goes all the way around in 60 minutes. In that time, the short hand moves from one hour number to the next.",
          "Half a trip of the long hand, from 12 to 6, is 30 minutes. At that time, the short hand is halfway between two hour numbers. The hour is the number it has passed.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "The long hand points at 6. The short hand is halfway between 8 and 9. What time is it?",
      steps: [
        "Look at the long hand first. At 6 it has gone halfway around, so it is 30 minutes past the hour.",
        "Now look at the short hand. It has passed 8 but has not reached 9, so the hour is 8.",
        "Write the hour, then the minutes. The time is 8:30, half past eight.",
      ],
      answer: "8:30",
    },
    pitfalls: [
      "At half past, the short hand is between two numbers. The hour is the number it has passed, not the next one.",
      "The long hand at 6 means 30 minutes, not 6 minutes.",
    ],
    parentGuide:
      "Set a real clock to 3:00, then turn the long hand slowly to 3:30. Ask the child to watch the short hand and say where it is now.",
  },
  {
    id: "time-to-five-minutes",
    title: "Time to five minutes",
    summary:
      "A clock has two hands, the pointers that turn around it. The short hand shows the hour. The long hand shows the minutes. Each time the long hand moves from one number to the next, 5 minutes pass. So start at 12, which means 0 minutes, and count by fives the way the hands turn.",
    templateIds: [
      "read-clock-five-minutes",
      "minutes-past-hour",
      "match-clock-five-minutes",
      "clock-am-pm",
    ],
    noLink: ["whole", "change"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Count minutes by fives from 12 to the long hand.",
      "Read and write times such as 4:35 from a clock with hands.",
      "Choose a.m. or p.m. from the time of day.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Count five minutes at a time",
        paragraphs: [
          "The long hand takes 5 minutes to move from one number to the next.",
          "So start at 12 and count by fives. At 1 it is 5 minutes. At 2 it is 10 minutes. At 3 it is 15 minutes.",
          "The short hand tells the hour.",
        ],
      },
      twoHands,
      {
        title: "Count by fives",
        paragraphs: [
          "There are 60 small marks around the clock, one for each minute. A number sits at every fifth mark. So the long hand at 1 means 5 minutes, at 2 means 10 minutes, and at 7 means 35 minutes.",
          "Look at the picture. Each number has its minutes written beside it. The long hand points at 7.",
          "Count by fives from 12 to the long hand: 5, 10, 15, 20, 25, 30, 35. That is 35 minutes.",
          "The short hand has passed 4. It is moving toward 5, so the hour is 4. The time is 4:35.",
        ],
        illustration: "clock-five-minutes",
      },
      {
        title: "a.m. and p.m.",
        paragraphs: [
          "The short hand goes around the clock twice each day. So a clock shows each time twice a day.",
          "Noon is 12 o'clock in the middle of the day. Midnight is 12 o'clock in the middle of the night.",
          "From midnight until just before noon, we write a.m. after the time. That is the morning. From noon until just before midnight, we write p.m. That is the afternoon and the night. 12:00 noon is 12:00 p.m.",
          "Breakfast at 7:15 is 7:15 a.m. Dinner at 6:15 is 6:15 p.m.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Five minutes per number",
        paragraphs: [
          "The 12 numbers split the 60 minutes around the clock into 12 equal groups of 5 minutes.",
          "Start at 12 and go clockwise, the way the hands turn. Each number the long hand reaches adds 5 minutes.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "The long hand points at 4. The short hand is a little past 9. What time is it?",
      steps: [
        "The long hand shows the minutes. Each number is 5 minutes, so count by fives from 12 to 4: 5, 10, 15, 20. That is 20 minutes.",
        "The short hand shows the hour. It has passed 9 but has not reached 10, so the hour is 9.",
        "Write the hour, then a colon, the two dots, then the minutes. The time is 9:20.",
      ],
      answer: "9:20",
    },
    pitfalls: [
      "The long hand at 4 means 20 minutes, not 4 minutes. Count by fives.",
      "Late in the hour, the short hand is close to the next number. The hour does not change until it gets there.",
    ],
    parentGuide:
      "Read the clock together at a few daily moments, counting the long hand by fives aloud. Ask whether each time is a.m. or p.m.",
  },
  {
    id: "coins-and-bills",
    title: "Coins and bills",
    summary:
      "A cent is the smallest amount of money, written ¢. Each coin is worth some cents. A penny is 1 cent. A nickel is 5 cents. A dime is 10 cents. A quarter is 25 cents. One dollar is 100 cents.",
    templateIds: [
      "coin-total",
      "money-total-dollars",
      "make-a-dollar",
      "pay-exact-coins",
      "money-left-story",
    ],
    noLink: ["quarter", "quarters", "change", "sort"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Name what a penny, nickel, dime, quarter, one-dollar bill and five-dollar bill are worth.",
      "Count coins and bills by counting on from the one worth the most.",
      "Find what is left after paying, and how much more makes one dollar.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Read value, not size",
        paragraphs: [
          "A coin's value is how much money it is worth. Its size does not tell you its value. A dime is smaller than a nickel, but a dime is worth more.",
          "So learn what each coin is worth. Then add those values together. Start with the coin worth the most.",
        ],
      },
      {
        title: "What each piece is worth",
        paragraphs: [
          "Look at the picture. A penny is 1¢. A nickel is 5¢. A dime is 10¢. A quarter is 25¢.",
          "A bill is paper money. A one-dollar bill is worth 100¢. That is the same as 4 quarters, or 10 dimes. A five-dollar bill is worth 5 dollars.",
        ],
        illustration: "coin-values",
      },
      {
        title: "Count on from the largest",
        paragraphs: [
          "Put the coins in a row, from the one worth the most to the one worth the least. Then count on. To count on means to start at one amount and keep adding the next coin.",
          "Look at the picture. There are 2 quarters, 1 dime, 1 nickel and 1 penny. Say 25, 50 for the quarters. Say 60 for the dime, 65 for the nickel and 66 for the penny. The coins are worth 66¢.",
          "With bills, count the dollars first and the coins after. 2 one-dollar bills and 35¢ make 2 dollars and 35 cents. A point separates the dollars from the cents, so we write that as 2.35 dollars.",
        ],
        illustration: "coin-count-on",
      },
      {
        title: "Money left and money needed",
        paragraphs: [
          "To find the money left after you buy something, count your money first. Then take away the price.",
          "To find how much more makes one dollar, first count your coins. Then count up from that amount to 100 cents. The amount you count up is the amount still needed.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Money values add",
        paragraphs: [
          "A group of coins and bills is worth all of their values added together. Their sizes do not matter. The order you count them in does not change the total, what they are worth together.",
          "One dollar is 100 cents. So dollars and cents can be put together in one amount.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "Ana has 3 quarters, 1 dime and 2 pennies. She buys a sticker for 40¢. How many cents does she have left?",
      steps: [
        "First find how much money Ana has. Count on, which means start at one amount and keep adding the next coin. Start with the quarters, the coins worth the most: 25, 50, 75. Then the dime adds 10: 85. Then each penny adds 1: 86, 87.",
        "So Ana has 87¢ before she buys anything.",
        "Paying takes the price away. 87 − 40 = 47. She has 47¢ left.",
      ],
      answer: "47",
      answerUnit: "¢",
    },
    pitfalls: [
      "A dime is smaller than a nickel but worth more: 10¢, not 5¢.",
      "Count the coins worth the most first. Starting with pennies makes counting on harder.",
    ],
    parentGuide:
      "Put a handful of real coins on the table. Ask the child to sort them by value, then count on aloud from the largest.",
  },
];

const handTerms: MethodTerm[] = ["hour-hand", "minute-hand"];
const coinTerms: MethodTerm[] = ["cent", "count-on"];
const handsIntro =
  "A clock has two hands, the pointers that turn around it. The short hand is the hour hand. It shows the hour. The long hand is the minute hand. It shows the minutes. One hour is 60 minutes.";
const fives =
  "Each time the long hand moves from one number to the next, 5 minutes pass. Start at 12, which means 0 minutes. Count by fives the way the hands turn, from 12 to 1, 2, 3, until you reach the long hand.";
const coinValues =
  "A cent is the smallest amount of money, written ¢. A penny is worth 1¢, a nickel 5¢, a dime 10¢ and a quarter 25¢. To count on means to start at one amount and keep adding the next coin. The total is what all the money is worth together.";
export const timeMoneyMethods: Record<string, ProblemMethod> = {
  "read-clock-hour-half": {
    goal: "Read a clock showing a time on the hour or half hour.",
    intuition: `${handsIntro} When the long hand points at 12, it is on the hour, with 0 minutes. When it points at 6, it is half past: 30 minutes after the hour.`,
    terms: handTerms,
    method: [
      "Look at the long hand. At 12 it is on the hour. At 6 it is half past, 30 minutes.",
      "Look at the short hand. The hour is the last number it has reached.",
      "Write the hour, a colon, then the minutes, like 3:00 or 3:30.",
    ],
    watch:
      "At half past, the short hand is past the hour number. Do not read the next number.",
  },
  "clock-hour-read": {
    goal: "Name the hour on a clock showing a time on the hour or half past.",
    intuition: `${handsIntro} The short hand moves slowly toward the next number all hour long. Halfway through the hour, it is halfway between two numbers.`,
    terms: handTerms,
    method: [
      "Find the short hand.",
      "If it points right at a number, that number is the hour.",
      "If it is between two numbers, the hour is the one it has passed. That is the smaller one, except between 12 and 1, where the hour is 12.",
    ],
    watch: "Do not read the number the short hand is moving toward.",
  },
  "match-clock-half-hour": {
    goal: "Pick the clock that shows a time on the hour or half hour.",
    intuition: `${handsIntro} On the hour means exactly at an hour, with 0 minutes. Then the long hand points at 12. Half past means 30 minutes after the hour. Then the long hand points at 6, and the short hand is halfway to the next number.`,
    terms: handTerms,
    method: [
      "Find where the long hand should point: 12 on the hour, or 6 at half past.",
      "Find where the short hand should point: at the hour, or halfway past it.",
      "Pick the clock where both hands are right.",
    ],
    watch:
      "A clock with the hands swapped looks close, but it shows a different time.",
  },
  "read-clock-five-minutes": {
    goal: "Read a clock to the nearest five minutes.",
    intuition: `${handsIntro} ${fives}`,
    terms: handTerms,
    method: [
      "Find the long hand. Count by fives from 12 to it. That gives the minutes.",
      "Find the short hand. If it points right at a number, that is the hour. If it is between two numbers, the hour is the one it has passed.",
      "Write the hour, a colon, then the minutes. Always write two numbers for the minutes, like 4:05 for 5 minutes.",
    ],
    watch: "The long hand at 7 means 35 minutes, not 7 minutes.",
  },
  "minutes-past-hour": {
    goal: "Count the minutes past the hour from the long hand.",
    intuition: `A clock has two hands, the pointers that turn around it. The long hand is the minute hand. It shows the minutes past the hour: how long since the last o'clock. ${fives}`,
    terms: handTerms,
    method: [
      "Find the number the long hand points at.",
      "Count by fives from 12 up to it, one five for each number.",
      "That count is the minutes past the hour. Pointing at 7 is 35 minutes.",
    ],
    watch:
      "Each number is 5 minutes, so count by fives, not by ones. At 12, it is 0 minutes past the hour.",
  },
  "clock-am-pm": {
    goal: "Read a clock and choose a.m. or p.m. from the activity.",
    intuition: `${handsIntro} Noon is 12 o'clock in the middle of the day, and midnight is 12 o'clock at night. A clock shows each time twice a day. From midnight until just before noon, we write a.m.: that is the morning. From noon until just before midnight, we write p.m.: that is the afternoon and night.`,
    terms: ["a-m", "p-m"],
    method: [
      "Read the clock. The long hand gives the minutes. The short hand gives the hour.",
      "Think about the activity. Morning things, like breakfast, are a.m.",
      "Afternoon and evening things, like dinner, are p.m.",
    ],
    watch:
      "The clock alone cannot tell a.m. from p.m. Use the activity in the question, like breakfast or dinner, to decide.",
  },
  "match-clock-five-minutes": {
    goal: "Pick the clock that shows a written time in five-minute steps.",
    intuition: `${handsIntro} ${fives} In 4:35, the colon is the two dots. The number before it is the hour. The number after it is the minutes.`,
    terms: handTerms,
    method: [
      "Find where the long hand should point. Count by fives from 12 until you reach the minutes.",
      "Find where the short hand should point. With 0 minutes, it points right at the hour. Otherwise it is past the hour number, part of the way to the next one. Late in the hour, it is close to the next number.",
      "Pick the clock where both hands are right.",
    ],
    watch:
      "Late in the hour, the short hand is close to the next number. The hour has not changed yet.",
  },
  "coin-total": {
    goal: "Find the value of a group of coins in cents.",
    intuition: coinValues,
    terms: coinTerms,
    noLink: ["quarter", "quarters", "sort"],
    method: [
      "Put the coins in order: quarters, then dimes, then nickels, then pennies.",
      "Count on: by 25 for each quarter, then by 10, by 5 and by 1.",
      "The last number you say is the total in cents.",
    ],
    watch: "A dime is smaller than a nickel, but it is worth more.",
  },
  "money-total-dollars": {
    goal: "Find the value of bills and coins in dollars.",
    intuition: `A bill is paper money. A one-dollar bill is worth 1 dollar, and a five-dollar bill 5 dollars. One dollar is 100 cents. ${coinValues} A point separates the dollars from the cents, so 2 dollars and 35 cents is written 2.35.`,
    terms: [...coinTerms, "dollar"],
    noLink: ["quarter", "quarters"],
    method: [
      "Add the bills. That gives the dollars.",
      "Count on the coins. That gives the cents. If they make 100 cents or more, each 100 cents makes 1 more dollar.",
      "Write the dollars, a point, then the cents with two digits.",
    ],
    watch: "5 cents is written .05, not .5. Cents always use two digits.",
  },
  "make-a-dollar": {
    goal: "Find how many more cents make one dollar.",
    intuition: `One dollar is 100 cents. ${coinValues} Count up from the coins' total to 100 in jumps, like 41 to 50, then 50 to 100. Add up the jumps. That is how many cents are still needed.`,
    terms: coinTerms,
    senses: { difference: "difference-subtract" },
    noLink: ["quarter", "quarters", "jumps"],
    method: [
      "Count the coins, starting with the one worth the most. For example, a quarter, a dime, a nickel and a penny count 25, 35, 40, 41.",
      "Count up from that total to 100. From 41 to 50 is 9. From 50 to 100 is 50 more.",
      "Add the jumps: 9 + 50 = 59. That many cents are still needed.",
    ],
    watch: "Find the amount still needed, not the amount already there.",
  },
  "pay-exact-coins": {
    goal: "Pick the set of coins worth exactly a price.",
    intuition: `${coinValues} Exactly means not more and not less.`,
    terms: coinTerms,
    noLink: ["quarter", "quarters", "changes"],
    method: [
      "Count on each set, starting with its coin worth the most.",
      "Pick the set whose total is the same as the price.",
    ],
    watch: "Mixing up a nickel and a dime makes a total 5¢ wrong.",
  },
  "money-left-story": {
    goal: "Count coins, then subtract a price.",
    intuition: `${coinValues} Buying something takes its price away from your money. What is left is your total minus the price.`,
    terms: coinTerms,
    noLink: ["quarter", "quarters"],
    method: [
      "Count on all the coins, from the one worth the most. For example, 2 quarters, a dime and a penny count 25, 50, 60, 61: that is 61¢.",
      "Take the price away from that total. With a price of 35¢, take away 30 to get 31, then 5 more to get 26. That takes away 35 in all, so 61 − 35 = 26¢ left.",
      "Check by adding back: what is left plus the price should make the total. 26 + 35 = 61.",
    ],
    watch: "Count all the coins before you take the price away.",
  },
};
export const timeMoneyPrinciples: Record<string, string> = {
  "read-clock-hour-half":
    "The long hand at 12 means on the hour, and at 6 means half past. The hour is the last number the short hand has reached.",
  "clock-hour-read":
    "The short hand moves slowly from one number to the next. Between two numbers, the hour is the one it has passed.",
  "match-clock-half-hour":
    "A time sets both hands. The long hand shows the minutes. The short hand shows the hour and how far into it.",
  "read-clock-five-minutes":
    "Each number on the clock is 5 minutes for the long hand. So the minutes are 5 times the number it points at. At 12, it is 0 minutes.",
  "minutes-past-hour":
    "Each number on the clock is 5 minutes for the long hand, so counting by fives from 12 gives the minutes. At 12, it is 0 minutes past the hour.",
  "clock-am-pm":
    "A clock shows each time twice a day. a.m. runs from midnight to noon, and p.m. from noon to midnight.",
  "match-clock-five-minutes":
    "A time sets both hands. The long hand points at the number for the minutes ÷ 5, or at 12 for 0 minutes. The short hand is that far past the hour number.",
  "coin-total":
    "A group of coins is worth all their values added together. Counting on from the largest makes the adding easy.",
  "money-total-dollars":
    "100 cents make a dollar. So in a dollar amount, the cents are the two digits after the point.",
  "make-a-dollar":
    "The amount still needed is 100 cents minus what is already there.",
  "pay-exact-coins":
    "Different sets of coins can be worth the same. Only the total matters.",
  "money-left-story": "Money left is the total minus the price.",
};
