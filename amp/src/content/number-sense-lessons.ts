import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

export const numberSenseLessons: Lesson[] = [
  {
    id: "count-to-100",
    title: "Count to 100 by ones and tens",
    summary:
      "Counting by ones means each number is the one before and 1 more: 57, 58, 59, 60. Counting by tens means each number is the one before and 10 more: 20, 30, 40. A hundred chart shows the numbers 1 to 100 in rows of 10. It helps you find a missing number.",
    templateIds: ["count-sequence-missing", "hundred-chart-missing"],
    noLink: ["square", "squares"],
    objectives: [
      "Continue counts by ones and by tens within 100, including across a ten.",
      "Use the rows and columns of the hundred chart to find a missing number.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Keep counting through a new ten",
        paragraphs: [
          "A one is a single thing, like one apple. A ten is a group of 10 ones. A digit is one of the symbols 0 to 9 we use to write numbers. The number 68 has two digits. The 6 means 6 tens, or 60. The 8 means 8 ones, 8 single things.",
          "Start at 68 and count one more: 69. That is 6 tens and 9 ones. One more one makes 10 ones. Ten ones make a new ten.",
          "So after 69 comes 70: 7 tens and 0 ones. The box □ in a count stands for a missing number. The sign + means add, or put more with. The sign = means makes, or is the same as. So 58 + 1 = 59 says 58 and 1 more make 59.",
        ],
      },
      {
        title: "Ones, then a new ten",
        paragraphs: [
          "In 64, the tens digit, 6, tells how many tens. The ones digit, 4, tells how many ones. Count by ones: 64, 65, 66. The ones digit goes up by 1 each time.",
          "After a 9 in the ones, the ones digit goes back to 0, and there is one more ten: 68, 69, 70, 71.",
          "Count by tens: 20, 30, 40, 50. Each number is one more ten. Up to 90, the tens digit goes up by 1 each time, and the ones digit stays the same: 23, 33, 43.",
          "Keep counting by tens: 70, 80, 90, 100. After 9 tens, one more ten makes 10 tens. Ten tens make one hundred, written 100.",
        ],
      },
      {
        title: "Read the chart both ways",
        paragraphs: [
          "Look at the hundred chart in the picture. Each row goes across and holds 10 numbers. Moving one square to the right adds 1: 62, then 63. Moving one row down adds 10: 62, then 72.",
          "To find a missing number, take the square on its left and add 1. Or take the square above it and add 10. If the empty square starts a row, use the square above it. Both ways give the same number, so you can use one to check the other.",
        ],
        illustration: "hundred-chart-moves",
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Counting and place value",
        paragraphs: [
          "Counting by ones adds 1 at each step. Counting by tens adds 10 at each step. Ten ones make one ten. So when the ones digit passes 9, it goes back to 0 and there is one more ten. Ten tens make one hundred, so 99 and 1 more is 100.",
        ],
      },
    ],
    workedExample: {
      prompt: "Count by ones: 57, 58, □, 60. What number is missing?",
      steps: [
        "Counting by ones means each number is the one before and 1 more.",
        "The number just before the box is 58. One more is 58 + 1 = 59.",
        "Check with the number after the box: 59 + 1 = 60. It fits, so 59 is right.",
      ],
      answer: "59",
    },
    pitfalls: [
      "After 69 comes 70, not 610. The 9 ones and 1 more one make a new ten.",
      "On the hundred chart, moving down one row adds 10, not 1.",
    ],
    parentGuide:
      "Choose a number on a hundred chart. Ask for the number just below it and the number just to its right. Ask how the two moves are different.",
  },
  {
    id: "write-numerals",
    title: "Write the number for a quantity",
    summary:
      "A numeral is a number written with symbols, such as 7 or 16. A ten-frame is a box with 10 spaces, in 2 rows of 5. Counters are small round chips, one in each filled space. A full ten-frame holds 10 counters, so you do not need to count them one by one. Say 10, then keep counting from 10 for the rest, and write the number.",
    templateIds: ["numeral-for-quantity"],
    noLink: ["parts"],
    objectives: [
      "Write numerals from 0 to 20 for quantities shown in ten-frames.",
      "Use a full frame as 10 and count on for the rest.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "A picture can show tens and ones",
        paragraphs: [
          "Ten counters fill one ten-frame. A group of 10 is called a ten. A single counter is called a one. Say you have one full frame and 6 more counters. That is 1 ten and 6 ones.",
          "To count them, say 10 for the full frame. Then count on: keep counting from 10 for each extra counter, 11, 12, 13, 14, 15, 16.",
          "We write that number as 16. The 1 stands for the full ten. The 6 stands for the 6 extra ones.",
        ],
      },
      {
        title: "Use the frame",
        paragraphs: [
          "A ten-frame has 2 rows of 5 spaces. A full row is 5, and a full frame is 10. So you can count by rows instead of one counter at a time.",
          "Look at the picture. One frame is full, so say 10. The other frame has 4 counters, so count on from 10: 11, 12, 13, 14.",
          "We write 14. It means 1 ten and 4 ones.",
        ],
        illustration: "teen-ten-frame",
      },
      {
        title: "Zero and twenty",
        paragraphs: [
          "An empty frame has no counters. The number is 0, called zero.",
          "Two full frames are 2 tens. The number is 20, called twenty.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "How a numeral shows tens and ones",
        paragraphs: [
          "A digit is one of the symbols 0 to 9 used to write numbers. The numbers 11 to 19 are called teen numbers. In a teen number, the first digit is 1, and it stands for one ten. The second digit tells how many more ones there are. So 14 means 10 and 4 more.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "One frame is full. The other frame has 4 counters. Write the number.",
      steps: [
        "A full ten-frame always holds 10 counters. So the full frame is 10, and you do not need to count it.",
        "Start at 10 and count on the 4 other counters: 11, 12, 13, 14.",
        "Write 14. The 1 means one ten, and the 4 means 4 ones.",
      ],
      answer: "14",
    },
    pitfalls: [
      "For a teen number, from 11 to 19, write the 1 for the ten first, then the ones. Fourteen is 14, not 41.",
      "A full frame is always 10. You do not need to count it again.",
    ],
    parentGuide:
      "Put 13 coins on a table: a row of 10 and 3 more. Ask how many coins there are without counting each one. Then ask the learner to write the number.",
  },
  {
    id: "number-line-moves",
    title: "Add and subtract with hops",
    summary:
      "A number line shows numbers in order. The numbers are evenly spaced. A hop is one move along the line. A hop to the right adds. A hop to the left subtracts.",
    templateIds: ["number-line-hops", "number-line-missing-hop"],
    senses: { difference: "difference-subtract" },
    objectives: [
      "Add or subtract within 100 by hopping tens, then ones, on a number line.",
      "Find the difference of two numbers as the length of the hop between them.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "A move has direction and length",
        paragraphs: [
          "On a number line, bigger numbers are to the right. Smaller numbers are to the left.",
          "A hop to the right adds. A hop to the left subtracts. A long hop can be split into two short hops.",
        ],
      },
      {
        title: "Hop the tens, then the ones",
        paragraphs: [
          "Every step of 1 on the line is the same length. Hopping back means hopping left.",
          "Look at the picture. To find 46 − 23, hop back 20 to 26. Then hop back 3 to 23.",
          "Two short hops are easier than counting back 23 ones.",
        ],
        illustration: "number-line-hop-pair",
      },
      {
        title: "A difference is a distance",
        paragraphs: [
          "The answer to a take-away is called the difference. It is also how far apart two numbers are.",
          "How far is it from 38 to 65? Count up from 38 in pieces. 2 takes you to 40. 20 more takes you to 60. 5 more takes you to 65.",
          "Add the pieces: 2 + 20 + 5 = 27. So 65 − 38 = 27.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Number-line distance and direction",
        paragraphs: [
          "On a number line, every step of 1 is the same length. Adding moves right that many steps. Subtracting moves left that many steps.",
          "A hop can be split into smaller hops, one after another. The small hops add up to the big hop.",
        ],
      },
    ],
    workedExample: {
      prompt: "Start at 46. Hop back 20, then back 3. Where do you land?",
      steps: [
        "Back means subtract. Hop back 20: 46 − 20 = 26. Only the tens digit changes.",
        "Now hop back 3 from 26: 26 − 3 = 23.",
      ],
      answer: "23",
    },
    pitfalls: [
      "Do not count the start number as a step. Start on it, then count each hop.",
      "Back means left. Hop left when you subtract.",
    ],
    parentGuide:
      "Draw a line with the tens marked. Ask the learner to show 34 + 25 as one hop of 20 and one hop of 5, saying where each hop lands.",
  },
  {
    id: "rounding",
    title: "Round to the nearest ten, hundred or thousand",
    summary:
      "To round a number means to swap it for a close, easy number. To the nearest ten, find the closest number that ends in 0. To the nearest hundred, find the closest number that ends in 00. To the nearest thousand, it ends in 000.",
    templateIds: ["round-to-ten", "round-to-hundred", "round-large"],
    noLink: ["change"],
    objectives: [
      "Round whole numbers to the nearest ten or hundred.",
      "Round larger numbers to the nearest hundred, thousand or ten thousand.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Choose the nearer landmark",
        paragraphs: [
          "347 sits between 340 and 350, two numbers that end in 0. These are its landmarks.",
          "347 is 3 away from 350 and 7 away from 340. So 350 is nearer. 347 rounds to 350.",
        ],
      },
      {
        title: "Halfway decides",
        paragraphs: [
          "Look at the number line. Halfway between 340 and 350 is 345. 347 is past halfway, so it rounds up to 350.",
          "A quick check uses one digit. Look at the digit just right of the place you round to. 5 or more rounds up. 4 or less rounds down. For 347 to the nearest ten, the ones digit is 7, so round up.",
          "A number exactly halfway, like 345, rounds up too.",
        ],
        illustration: "rounding-halfway",
      },
      {
        title: "Crossing and halfway",
        paragraphs: [
          "Rounding up can change more than one digit. 396 rounds to 400 to the nearest ten: 39 tens and 1 more ten make 40 tens. To the nearest thousand, 49,700 rounds to 50,000.",
          "Round once, from the original number. 449 rounds to 400 to the nearest hundred, because it is before the halfway mark, 450. Rounding to 450 first and then to 500 is a mistake.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Nearest multiple",
        paragraphs: [
          "Every number sits between two numbers that end in zeros at the rounding place, like 340 and 350. Rounding picks the nearer one.",
          "When a number is exactly halfway, like 345, we agree to pick the greater one.",
        ],
      },
    ],
    workedExample: {
      prompt: "Round 46,382 to the nearest thousand.",
      steps: [
        "To the nearest thousand means the closest number ending in 000. 46,382 is between 46,000 and 47,000. Halfway is 46,500.",
        "46,382 is less than 46,500, so it is before halfway and rounds down to 46,000. The hundreds digit, 3, says the same: 4 or less rounds down.",
      ],
      answer: "46000",
    },
    pitfalls: [
      "Do not round twice, like 449 to 450 and then to 500. Round once: 449 rounds to 400.",
      "Remember to carry. 396 to the nearest ten is 400, not 390.",
    ],
    parentGuide:
      "Name a price, such as 3 dollars and 47 cents. Ask whether it is closer to 3 dollars 40 cents or 3 dollars 50 cents. Then try one exactly halfway, like 3 dollars 45 cents.",
  },
  {
    id: "powers-of-ten",
    title: "Multiply and divide by powers of ten",
    summary:
      "Each place is worth 10 times the place on its right. So multiplying by 10 moves every digit one place left, and dividing by 10 moves every digit one place right. 10, 100 and 1,000 are called powers of ten, because each is made by multiplying 10s.",
    templateIds: [
      "multiply-power-of-ten",
      "divide-power-of-ten",
      "digit-value-ratio",
    ],
    objectives: [
      "Multiply and divide whole numbers and decimals by 10, 100 and 1,000.",
      "Explain how the same digit's value changes from one place to another.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Make every place ten times larger",
        paragraphs: [
          "In 47, the 7 means 7 ones. In 470, the 7 means 7 tens, which is 10 times as much.",
          "Multiplying by 10 makes every digit worth 10 times as much. So every digit moves one place left.",
        ],
      },
      {
        title: "Digits move, the point stays",
        paragraphs: [
          "The decimal point is the dot between the ones place and the tenths place. One tenth is one of 10 equal parts of 1.",
          "Look at the chart: 4.7 × 10 = 47, and 47 × 10 = 470. Each time, every digit moves one place left. The 4 ones become 4 tens, and the 7 tenths become 7 ones. The decimal point stays where it is. When the ones place is empty, a 0 fills it.",
          "Dividing by 10 moves every digit one place right. 100 is 10 × 10, so dividing by 100 moves digits two places right: 52 ÷ 100 = 0.52.",
          "We can write 10 × 10 as $10^{2}$, read “10 to the second power.” The small 2 counts how many 10s are multiplied. So multiplying by $10^{2}$ moves digits two places left.",
        ],
        illustration: "power-of-ten-shift",
      },
      {
        title: "The same digit in two places",
        paragraphs: [
          "In 7,370 the first 7 is in the thousands place, so it is worth 7,000. The second 7 is in the tens place, so it is worth 70.",
          "They are two places apart, so the first is worth 10 × 10 = 100 times as much. Check: 70 × 100 = 7,000.",
          "Moving one place left multiplies a digit's value by 10. Moving one place right divides it by 10.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Each place is ten times larger",
        paragraphs: [
          "Moving a digit one place left multiplies its value by 10. Moving it one place right divides its value by 10.",
          "So multiplying by 10, 100 or 1,000 moves every digit 1, 2 or 3 places left, and dividing moves every digit right. Zeros fill the empty places before the decimal point.",
        ],
      },
    ],
    workedExample: {
      prompt: "What is 3.6 × 100?",
      steps: [
        "100 is 10 × 10, two 10s. So every digit moves two places left.",
        "The 3 ones become 3 hundreds, and the 6 tenths become 6 tens. The ones place is now empty, so a 0 fills it: 360.",
      ],
      answer: "360",
    },
    pitfalls: [
      "Do not just write zeros after a decimal. 3.6 × 100 is 360, not 3.600.",
      "Dividing moves the digits right, not left.",
    ],
    parentGuide:
      "Ask how many dimes make 4 dollars and 70 cents: 47, the digits of 4.70 moved one place left. Then ask how many pennies: 470, moved two places left.",
  },
];

export const numberSenseMethods: Record<string, ProblemMethod> = {
  "count-sequence-missing": {
    goal: "Find the missing number in a count by ones or by tens.",
    intuition:
      "Counting by ones means each number is 1 more than the one before: 18, 19, 20. Counting by tens means each number is 10 more: 20, 30, 40. The box □ stands for the missing number. The step is how much each number grows: 1 or 10. The sign + means add, or put more with. The sign = means makes, or is the same as. So 19 + 1 = 20 says 19 and 1 more make 20.",
    method: [
      "Find the step. It is 1 when you count by ones and 10 when you count by tens.",
      "Add the step to the number just before the box.",
      "If a number comes after the box, add the step again. You should land on that number.",
    ],
    watch:
      "After 9 single ones, one more makes 10 ones, which is a new ten. So after 69 comes 70, not 610.",
  },
  "hundred-chart-missing": {
    goal: "Find the number that belongs in an empty square of the hundred chart.",
    intuition:
      "A hundred chart shows the numbers 1 to 100 in order, in rows of 10. Each row goes across, from left to right. One square to the right is 1 more. One row down is 10 more, because each row holds 10 numbers. A picture may show only part of the chart, but it works the same way. To add 1 means to find the number 1 more.",
    noLink: ["part", "square", "squares"],
    method: [
      "Find a filled square next to the empty one: just to its left, or just above it.",
      "From the square on its left, add 1. From the square above it, add 10.",
      "If the empty square has both, use the other one to check.",
    ],
    watch: "Moving down one row adds 10, not 1.",
  },
  "numeral-for-quantity": {
    goal: "Count the counters shown in ten-frames and write how many there are.",
    intuition:
      "A ten-frame is a box with 10 spaces, in 2 rows of 5. Counters are small round chips, one in each filled space. A full row holds 5 counters, and a full frame holds 10. Use those to count fast, then write the number. The sign + means add, or put more with. The sign = means makes, or is the same as.",
    terms: ["ten-frame"],
    method: [
      "A full frame is 10 and a full row is 5. You do not need to count them one by one.",
      "For the rest, count on: start at 10 or 5 and keep counting each extra counter.",
      "Write the number. A teen number, from 11 to 19, is 1 full frame and some more counters. So 14 is 1 ten, the full frame, and 4 ones, the 4 single counters.",
    ],
    watch: "Fourteen is written 14, not 41. The 1 stands for the full ten.",
  },
  "number-line-hops": {
    goal: "Start at a number, hop by tens, then hop by ones. Find where you land.",
    noLink: ["whole"],
    intuition:
      "A number line shows numbers in order, evenly spaced. Bigger numbers are to the right. A hop to the right adds. A hop back, to the left, subtracts. Hop the tens first, then the ones. Hopping back 20 from 46 lands on 26: only the tens digit changes.",
    method: [
      "Start on the first number. Do not count it as a step.",
      "Hop the tens first. Forward means add, and back means subtract.",
      "Then hop the ones from where you landed.",
    ],
    watch:
      "Back means subtract, so hop left. Hop the tens, then the ones, in that order.",
  },
  "number-line-missing-hop": {
    goal: "Given the two ends of a hop, find its length.",
    senses: { difference: "difference-subtract" },
    intuition:
      "A number line shows numbers in order, evenly spaced. The length of a hop is how many steps of 1 it covers. It is the bigger number minus the smaller one. To find it, count up from the smaller number in easy pieces: to the next ten, then by tens, then the ones left over. Add the pieces.",
    method: [
      "Count up from the smaller number to the next ten. If it already ends in 0, skip this.",
      "Count by tens as far as you can without passing the bigger number. Then count the ones left.",
      "Add the pieces. That sum is the length of the hop.",
    ],
    watch:
      "The length is the same whichever way the hop points. Always count up from the smaller number.",
  },
  "round-to-ten": {
    goal: "Given a whole number, round it to the nearest ten.",
    noLink: ["change"],
    intuition:
      "To round to the nearest ten means to find the closest number that ends in 0. 347 is between 340 and 350, and it is closer to 350. Look at the ones digit. If it is 5 or more, round up to the bigger ten. If it is 4 or less, round down to the smaller ten. A number exactly halfway, like 345, rounds up.",
    method: [
      "Name the two numbers ending in 0 that it is between, like 340 and 350.",
      "Look at the ones digit. If it is 5 or more, round up. If it is 4 or less, round down.",
    ],
    watch: "Rounding up can change the hundreds too: 396 rounds up to 400.",
  },
  "round-to-hundred": {
    goal: "Given a three-digit number, round it to the nearest hundred.",
    noLink: ["side"],
    intuition:
      "To round to the nearest hundred means to find the closest number that ends in 00. 449 is between 400 and 500. Halfway between them is 450. 449 is just before halfway, so it rounds down to 400. Look at the tens digit. If it is 5 or more, round up. If it is 4 or less, round down.",
    method: [
      "Name the two numbers ending in 00 that it is between, like 400 and 500.",
      "Look at the tens digit. If it is 5 or more, round up. If it is 4 or less, round down.",
    ],
    watch:
      "Look only at the tens digit. 449 rounds to 400, even though its ones digit is 9.",
  },
  "round-large": {
    goal: "Given a large whole number, round it to the named place.",
    intuition:
      "To round to a place, like thousands, find the closest number with 0 in every place to its right. 46,382 is between 46,000 and 47,000. Halfway between them is 46,500. Look at the digit just right of the rounding place. If it is 5 or more, round up. If it is 4 or less, round down. Then write 0 in every place to the right of the rounding place.",
    method: [
      "Find the rounding place and the two numbers around the number, like 46,000 and 47,000.",
      "Look at the digit one place to the right. If it is 5 or more, round up. If it is 4 or less, round down.",
      "Write 0 in every place right of the rounding place.",
    ],
    watch:
      "A 9 that rounds up becomes 0 and adds 1 to the digit on its left. So 49,700 to the nearest thousand is 50,000.",
  },
  "multiply-power-of-ten": {
    goal: "Given a number times 10, 100 or 1,000, find the product.",
    intuition:
      "Each place is worth 10 times the place on its right. Multiplying by 10 makes every digit worth 10 times as much, so every digit moves one place left. 100 is 10 × 10, two factors of 10, so it moves digits two places. 1,000 is 10 × 10 × 10, three factors of 10, so it moves them three places. A factor is a number being multiplied. The decimal point stays where it is. Empty places before the point fill with 0. The answer to a multiplication is called the product.",
    terms: ["power-of-10"],
    senses: {
      factor: "factor-number",
      factors: "factor-number",
      product: "product-multiply",
    },
    method: [
      "Count the factors of 10: 10 is one, 100 is two, 1,000 is three.",
      "Move every digit that many places left. Fill empty places before the decimal point with 0.",
    ],
    watch: "A decimal's digits move too: 3.6 × 100 = 360, not 3.600.",
  },
  "divide-power-of-ten": {
    goal: "Given a whole number divided by 10, 100 or 1,000, find the quotient.",
    intuition:
      "Each place is worth one tenth of the place on its left. Dividing by 10 makes every digit worth one tenth as much, so every digit moves one place right. 100 is 10 × 10, two factors of 10, so dividing by 100 moves digits two places right. A factor is a number being multiplied. Digits that move past the ones place go into the tenths, hundredths and thousandths places, after the decimal point. The answer to a division is called the quotient.",
    terms: ["power-of-10"],
    senses: { factor: "factor-number", factors: "factor-number" },
    method: [
      "Count the factors of 10: 10 is one, 100 is two, 1,000 is three.",
      "Move every digit that many places right. Digits past the ones place become tenths, hundredths and thousandths.",
    ],
    watch:
      "Zeros at the end after the decimal point can be dropped: 520 ÷ 100 = 5.20, which is 5.2.",
  },
  "digit-value-ratio": {
    goal: "Given a number with one digit in two places, compare the two values.",
    intuition:
      "Each place is worth 10 times the place on its right. So a digit is worth 10 times as much for each place it moves left. In 35,932 the first 3 is in the ten thousands place, worth 30,000. The second 3 is in the tens place, worth 30. The places are 3 steps apart, so the first is worth 10 × 10 × 10 = 1,000 times as much. How many times as much one value is as another is called their ratio.",
    method: [
      "Name the place of each copy of the digit, and count the steps between them.",
      "Each step left multiplies the value by 10. Multiply one 10 for each step.",
    ],
    watch: "Two places apart is 10 × 10 = 100 times, not 20 times.",
  },
};

export const numberSensePrinciples: Record<string, string> = {
  "count-sequence-missing":
    "In a count by ones, each number is 1 more than the one before. In a count by tens, each number is 10 more. Ten ones make one ten.",
  "hundred-chart-missing":
    "The hundred chart has rows of 10. So one square to the right is 1 more, and one row down is 10 more.",
  "numeral-for-quantity":
    "A numeral is a written number that tells how many. A teen number, from 11 to 19, is one ten and some more ones: 14 is 10 and 4.",
  "number-line-hops":
    "Adding moves right and subtracting moves left, one equal step for each 1. A hop can be split into a tens hop and a ones hop that add up to the whole move.",
  "number-line-missing-hop":
    "The difference of two numbers, the bigger minus the smaller, is the distance between them on a number line.",
  "round-to-ten":
    "A number rounds to the nearer of the two numbers ending in 0 around it. A number exactly halfway rounds up.",
  "round-to-hundred":
    "A number rounds to the nearer of the two numbers ending in 00 around it. The tens digit shows the side: 0 to 4 is before halfway, and 5 to 9 is halfway or past.",
  "round-large":
    "Rounding to a place picks the nearer of the two numbers around it that have zeros after that place. The digit just right of the place shows whether the number is halfway or past.",
  "multiply-power-of-ten":
    "Multiplying by 10 makes every digit worth 10 times as much, which moves it one place left.",
  "divide-power-of-ten":
    "Dividing by 10 makes every digit worth one tenth as much, which moves it one place right.",
  "digit-value-ratio":
    "A digit is worth 10 times as much as the same digit one place to its right. For each extra step apart, multiply by 10 again.",
};
