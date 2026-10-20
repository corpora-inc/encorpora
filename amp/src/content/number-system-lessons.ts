import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

export const numberSystemLessons: Lesson[] = [
  {
    id: "greatest-common-factor",
    title: "Greatest common factor",
    summary:
      "The greatest common factor is the largest number that divides both numbers; it is the product of their shared prime factors.",
    templateIds: ["greatest-common-factor", "gcf-factor-sum"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Find the greatest common factor of two whole numbers up to 100 from factor lists or shared prime factors.",
      "Recognize when a story asks for the greatest common factor.",
      "Use the distributive property to factor the greatest common factor out of a sum.",
    ],
    sections: [
      {
        title: "Factors and common factors",
        paragraphs: [
          "This lesson uses whole-number multiplication and division. A factor of a whole number divides it with no remainder: 6 is a factor of 48 because 48 ÷ 6 = 8. Factors come in pairs whose product is the number. Since 48 = 1 × 48 = 2 × 24 = 3 × 16 = 4 × 12 = 6 × 8, the factors of 48 are 1, 2, 3, 4, 6, 8, 12, 16, 24 and 48.",
          "A common factor of two numbers is a factor of both. The greatest common factor, or GCF, is the largest common factor. The factors of 72 are 1, 2, 3, 4, 6, 8, 9, 12, 18, 24, 36 and 72. The numbers in both lists are 1, 2, 3, 4, 6, 8, 12 and 24, so the GCF of 48 and 72 is 24.",
        ],
      },
      {
        title: "Shared prime factors",
        paragraphs: [
          "A prime number has exactly two factors, 1 and itself: 2, 3, 5, 7, 11 and so on. Every whole number greater than 1 is a product of primes in only one way, apart from order: 48 = 2 × 2 × 2 × 2 × 3 and 72 = 2 × 2 × 2 × 3 × 3.",
          "In the figure, the primes that 48 and 72 share sit in the overlap: 2, 2, 2 and 3. Their product, 2 × 2 × 2 × 3 = 24, divides both numbers. No larger number divides both, because a common factor can be built only from primes that both numbers contain. The GCF is the product of the shared primes.",
        ],
        illustration: "prime-factor-venn",
      },
      {
        title: "Questions the GCF answers",
        paragraphs: [
          "Splitting 48 balls and 72 cones into identical sets with none left over needs a number of sets that divides both counts. The greatest number of sets is the GCF, 24, and each set gets 48 ÷ 24 = 2 balls and 72 ÷ 24 = 3 cones.",
          "The largest square tile that covers a floor 48 feet by 72 feet without cutting has side 24 feet for the same reason: the side length must divide both edge lengths.",
        ],
      },
      {
        title: "Factor the GCF out of a sum",
        paragraphs: [
          "The distributive property says that a × b + a × c = a × (b + c). Rewriting a sum this way is called factoring out $a$. A number written directly before parentheses means multiplication: 4(9 + 2) means 4 × (9 + 2).",
          "For 36 + 8, the GCF is 4: 36 = 4 × 9 and 8 = 4 × 2. So 36 + 8 = 4 × 9 + 4 × 2 = 4(9 + 2). The figure shows a rectangle 4 units tall whose width is split into 9 and 2. Its parts have areas 36 and 8, and the whole has area 4 × 11 = 44.",
          "After the GCF is factored out, the numbers in the parentheses, 9 and 2, have no common factor greater than 1. Factoring out a smaller common factor, as in 2(18 + 4), gives the right value but leaves the common factor 2 inside the parentheses.",
        ],
        illustration: "gcf-area",
      },
    ],
    workedExample: {
      prompt:
        "A coach has 48 balls and 72 cones to split into identical sets with none left over. What is the greatest number of sets that can be made?",
      steps: [
        "Every set gets the same number of balls and the same number of cones, so the number of sets must divide both 48 and 72.",
        "Prime factors: 48 = 2 × 2 × 2 × 2 × 3 and 72 = 2 × 2 × 2 × 3 × 3.",
        "The shared primes are 2, 2, 2 and 3, so the GCF is 2 × 2 × 2 × 3 = 24.",
        "Each of the 24 sets gets 48 ÷ 24 = 2 balls and 72 ÷ 24 = 3 cones.",
      ],
      answer: "24",
    },
    pitfalls: [
      "The GCF is never larger than the smaller number. A result larger than both numbers is a multiple, not a factor.",
      "A common factor is not always the greatest: 12 divides 48 and 72, but the quotients 4 and 6 still share 2.",
      "Factor out of both terms: 4(9 + 8) is 36 + 32, not 36 + 8.",
    ],
    parentGuide:
      "Take 12 red and 18 blue counters. Ask for the most identical groups that use every counter, then list the factors of 12 and 18 to see why 6 groups is the most.",
  },
  {
    id: "least-common-multiple",
    title: "Least common multiple",
    summary:
      "The least common multiple is the smallest positive number that both numbers divide; list multiples of the larger number to find it.",
    templateIds: ["least-common-multiple"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Find the least common multiple of two whole numbers up to 12.",
      "Recognize when a story about repeating counts or packages asks for the least common multiple.",
    ],
    sections: [
      {
        title: "Multiples and common multiples",
        paragraphs: [
          "This lesson uses multiplication facts. A multiple of a whole number is that number times a whole number: the multiples of 6 are 6, 12, 18, 24, 30 and so on. A common multiple of two numbers is a multiple of both. The least common multiple, or LCM, is the smallest positive common multiple.",
          "In the figure, jumps of 6 from 0 land on 6, 12, 18, 24, 30, 36, 42 and 48. Jumps of 8 land on 8, 16, 24, 32, 40 and 48. They first land together at 24, so the LCM of 6 and 8 is 24. They meet again at 48 = 2 × 24: every common multiple is a multiple of the LCM.",
        ],
        illustration: "multiple-jumps",
      },
      {
        title: "A short search",
        paragraphs: [
          "List multiples of the larger number and stop at the first one that the smaller number divides. For 6 and 8: 6 does not divide 8 or 16, but 24 = 6 × 4. Starting with the larger number is faster because its multiples are farther apart.",
          "If one number divides the other, the larger number is the LCM: the LCM of 4 and 12 is 12. If the two numbers have no common factor greater than 1, the LCM is their product: the LCM of 5 and 9 is 45. Otherwise the product is too large. For 6 and 8, the product 6 × 8 = 48 counts their shared factor 2 twice, and 48 ÷ 2 = 24.",
        ],
      },
      {
        title: "Questions the LCM answers",
        paragraphs: [
          "Two lights that flash every 6 and every 8 seconds flash together at times that are multiples of both numbers, so they next flash together after 24 seconds. Hot dogs in packs of 10 and buns in packs of 8 first come out even at 40: 4 packs of hot dogs and 5 packs of buns.",
          "Look for the LCM when two repeating counts must line up, and for the GCF when two amounts are split into equal groups. Lining up gives an answer at least as large as both numbers; splitting gives an answer no larger than either.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "Two lights flash together now. One flashes every 6 seconds and the other every 8 seconds. In how many seconds will they next flash together?",
      steps: [
        "Each light flashes at multiples of its own time, so they flash together at common multiples of 6 and 8.",
        "Multiples of 8: 8, 16 and 24.",
        "6 does not divide 8 or 16, but 24 = 6 × 4, so the LCM is 24.",
        "In 24 seconds the first light flashes 24 ÷ 6 = 4 times and the second 24 ÷ 8 = 3 times, and they flash together again.",
      ],
      answer: "24",
    },
    pitfalls: [
      "The product is a common multiple but not always the least: 6 × 8 = 48, while 24 is smaller.",
      "The LCM is at least as large as the larger number. A result smaller than both numbers is a factor, not a multiple.",
      "Do not confuse the LCM with the GCF: lining up repeating counts asks for a multiple; splitting into equal groups asks for a factor.",
    ],
    parentGuide:
      "Clap every 3 counts while your child taps every 4 counts, counting aloud from 1. Stop at the first count where both happen, then check it against the lists of multiples.",
  },
  {
    id: "long-division",
    title: "Long division and remainders",
    summary:
      "Divide one place at a time from the left, and decide what a remainder means before answering a story.",
    templateIds: ["long-division-quotient", "division-remainder-story"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Divide a whole number of up to five digits by a two-digit divisor with the standard algorithm.",
      "Check a quotient by multiplication.",
      "Decide whether a story needs the quotient, the quotient plus 1, or the remainder.",
    ],
    sections: [
      {
        title: "Dividend, divisor, quotient and remainder",
        paragraphs: [
          "This lesson uses multiplication facts, place value and subtraction. In 8736 ÷ 24 = 364, the dividend 8736 is the amount being divided, the divisor 24 is the size of each group, and the quotient 364 is the number of groups. Division undoes multiplication: 364 × 24 = 8736, which is how any quotient is checked.",
          "When the divisor does not fit exactly, the amount left over is the remainder, and it is always less than the divisor. For example, 437 ÷ 52 is 8 with remainder 21, because 8 × 52 = 416 and 437 − 416 = 21.",
        ],
      },
      {
        title: "The standard algorithm",
        paragraphs: [
          "Long division finds the quotient one place at a time, starting from the left. The first part of 8736 that is at least 24 is 87, which stands for 87 hundreds. The largest multiple of 24 that fits in 87 is 24 × 3 = 72, because 24 × 4 = 96 is too big. Write 3 in the hundreds place of the quotient and subtract: 87 − 72 = 15.",
          "Bring down the next digit, 3, to make 153 tens. 24 × 6 = 144 fits and 24 × 7 = 168 does not, so write 6 and subtract: 153 − 144 = 9. Bring down 6 to make 96 ones. 24 × 4 = 96, so write 4; the remainder is 0 and the quotient is 364.",
          "Each step shares one place value: 3 hundreds of 24 use 7200, 6 tens of 24 use 1440 and 4 ones of 24 use 96, and 7200 + 1440 + 96 = 8736. After each subtraction the remainder must be less than the divisor. If a number brought down makes a part smaller than the divisor, write 0 in that place of the quotient and bring down the next digit.",
        ],
        illustration: "long-division",
      },
      {
        title: "What the remainder means",
        paragraphs: [
          "In a story, the remainder needs a decision. Taking 437 students on buses that hold 52: 8 buses carry 416 students and 21 are left, so 9 buses are needed. The quotient is rounded up because every student needs a seat.",
          "Packing 437 bolts in boxes of 52 fills only 8 boxes completely: the 21 extra bolts do not fill a box, so the remainder is dropped. Asked how many bolts are left over, the answer is the remainder itself, 21. Read the question to decide which of the three it asks for.",
        ],
      },
    ],
    workedExample: {
      prompt: "What is 8736 ÷ 24?",
      steps: [
        "87 is the first part of 8736 that is at least 24. Try 24 × 3 = 72 and 24 × 4 = 96 is more than 87. Write 3 in the quotient; 87 − 72 = 15.",
        "Bring down 3, making 153. Try 24 × 6 = 144 and 24 × 7 = 168 is more than 153. Write 6 in the quotient; 153 − 144 = 9.",
        "Bring down 6, making 96. Try 24 × 4 = 96 and 24 × 5 = 120 is more than 96. Write 4 in the quotient; 96 − 96 = 0.",
        "The remainder is 0, so the quotient is 364. Check: 364 × 24 = 8736.",
      ],
      answer: "364",
    },
    pitfalls: [
      "Write 0 in the quotient when a part is smaller than the divisor: 7248 ÷ 24 = 302, not 32.",
      "Each remainder after subtracting must be less than the divisor; if it is not, the quotient digit is too small.",
      "In a story, decide whether the answer is the quotient, the quotient plus 1, or the remainder.",
    ],
    parentGuide:
      "Share 100 pennies among 7 people one round at a time and count what is left. Then work 100 ÷ 7 with long division and compare: 14 each, with 2 left over.",
  },
  {
    id: "signed-numbers",
    title: "Signed numbers and opposites",
    summary:
      "Positive and negative numbers name opposite directions from 0; opposites are the same distance from 0 on either side.",
    templateIds: ["signed-quantity", "opposite-on-line"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Use positive and negative numbers for quantities in opposite directions, and explain what 0 means.",
      "Read integers on a number line and find a number's opposite.",
      "Explain why the opposite of the opposite of a number is the number itself.",
    ],
    sections: [
      {
        title: "Positive, negative and zero",
        paragraphs: [
          "Many quantities have two opposite directions: above or below sea level, above or below zero degrees, money put into or taken out of an account, yards gained or lost. Choose one direction to be positive. The opposite direction is negative, written with a minus sign: −20 is read “negative twenty”. The number 0 is the reference point, such as sea level, and is neither positive nor negative.",
          "In the figure, sea level is 0 and up is positive. A gull 30 meters above sea level is at 30, and a diver 20 meters below sea level is at −20. The sign gives the direction, and the number without its sign gives the distance from 0.",
        ],
        illustration: "elevation-line",
      },
      {
        title: "Opposites",
        paragraphs: [
          "Two numbers are opposites when they are the same distance from 0 on opposite sides of 0. On a number line, 6 is 6 units to the right of 0 and −6 is 6 units to the left, so 6 and −6 are opposites. The opposite of 0 is 0.",
          "The minus sign can be read as “the opposite of”: −6 is the opposite of 6, and −(−6) is the opposite of −6, which is 6. Taking the opposite twice returns to the starting number.",
        ],
        illustration: "opposite-line",
      },
      {
        title: "Reading a number line",
        paragraphs: [
          "A number line has evenly spaced ticks, and numbers increase to the right. Find what one space is worth from two labeled ticks: if 0 and 5 are 5 spaces apart, each space is 1 unit.",
          "To read a point, count spaces from 0 or from the nearest labeled tick. A point 2 ticks to the left of −5 is at −7, and its opposite is 2 ticks to the right of 5, at 7.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A diver swims 35 feet below sea level. Sea level is 0, and heights above sea level are positive. What number represents the diver's height?",
      steps: [
        "Heights above sea level are positive, so heights below sea level are negative.",
        "The diver is 35 feet from 0 in the negative direction.",
        "The number is −35. Its opposite, 35, would be a height 35 feet above sea level.",
      ],
      answer: "−35",
    },
    pitfalls: [
      "The sign gives the direction, not the size: −8 is farther from 0 than 3.",
      "The opposite of a negative number is positive: the opposite of −7 is 7.",
      "Count ticks from 0 or from a labeled tick, not from the end of the line.",
    ],
    parentGuide:
      "Draw a number line from −10 to 10 on a strip of paper. Put a coin on a number and ask for its opposite, then fold the strip at 0 to check that the two numbers meet.",
  },
  {
    id: "signed-stories",
    title: "Stories with signed numbers",
    summary:
      "Give every change a sign, multiply repeated changes, and add them to the start; a change between two values is end minus start.",
    templateIds: ["signed-story", "signed-jumps"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Write signed numbers for the starting value and each change in a temperature, elevation or account story.",
      "Solve multistep stories with signed decimals exactly, including repeated changes.",
      "Find the change from one signed value to another as end minus start.",
    ],
    sections: [
      {
        title: "Model each change with a sign",
        paragraphs: [
          "This lesson uses addition, subtraction and multiplication of decimals. In a story, first choose the positive direction: up, warmer, or money added. A change in the opposite direction is negative. A starting value can be negative too, such as a temperature of −4.5°C or an account balance of −32.50 dollars, which means 32.50 dollars is owed.",
          "A repeated change is a product. Falling 1.5°C each hour for 3 hours is 3 × (−1.5) = −4.5. A positive number times a negative number is negative because it adds the same negative change several times: (−1.5) + (−1.5) + (−1.5) = −4.5.",
        ],
      },
      {
        title: "Add changes as jumps",
        paragraphs: [
          "On a number line, adding a positive number moves right and adding a negative number moves left, by the number's distance from 0. The figure starts at −4.5, jumps 7.25 to the right, then jumps 1.5 to the left three times.",
          "Adding in order: −4.5 + 7.25 = 2.75, then 2.75 + (−4.5) = −1.75. The ending point is left of 0, so the result is negative. The figure also gives a check on the size: the total change is 7.25 − 4.5 = 2.75 to the right of the start.",
        ],
        illustration: "story-jumps",
      },
      {
        title: "Change between two values",
        paragraphs: [
          "The change from a starting value to an ending value is the end minus the start. From −7.5°C to 4.25°C the change is 4.25 − (−7.5) = 4.25 + 7.5 = 11.75 degrees. Subtracting a negative number adds its opposite: taking away a drop is the same as adding a rise.",
          "The vertical distance between a ledge at 26.5 meters and a diver at −16.5 meters is 26.5 − (−16.5) = 43 meters, the 26.5 meters above sea level plus the 16.5 meters below it.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "At 6 a.m. the temperature was −4.5°C. By noon it had risen 7.25°C. Then it fell 1.5°C each hour for 3 hours. What was the temperature then, in °C?",
      steps: [
        "Rising is positive and falling is negative. The temperature starts at −4.5.",
        "Falling 1.5°C each hour for 3 hours is a change of 3 × (−1.5) = −4.5.",
        "−4.5 + 7.25 + (−4.5) = 2.75 + (−4.5) = −1.75.",
        "The temperature was −1.75°C.",
      ],
      answer: "−1.75",
      answerUnit: "°C",
    },
    pitfalls: [
      "Give each change its sign before adding: −4.5 + 7.25 + 4.5 treats a fall as a rise.",
      "Multiply a repeated change: 3 hours of falling 1.5°C is 3 × (−1.5), not −1.5.",
      "For a change between two values, subtract the start from the end: from −7.5 to 4.25 the change is 11.75, not 4.25 − 7.5.",
    ],
    parentGuide:
      "Draw a thermometer from −10 to 10. Start at −3, move up 5, then down 2 twice, and compare the final mark with the sum −3 + 5 + 2 × (−2).",
  },
];

export const numberSystemMethods: Record<string, ProblemMethod> = {
  "greatest-common-factor": {
    goal: "Find the largest whole number that divides both given numbers.",
    terms: [
      ["factor", "A whole number that divides another with no remainder."],
      ["GCF", "The greatest factor two numbers have in common."],
    ],
    method: [
      "List the factors of each number, or write each as a product of primes.",
      "Find the common factors, or the primes both numbers share.",
      "The greatest common factor is the largest common factor, or the product of the shared primes.",
    ],
    watch:
      "The GCF is never larger than the smaller number; a larger answer is a multiple.",
  },
  "least-common-multiple": {
    goal: "Find the smallest positive number that both given numbers divide.",
    terms: [
      ["multiple", "A number times a whole number: 8, 16, 24, …"],
      ["LCM", "The least positive multiple two numbers have in common."],
    ],
    method: [
      "List multiples of the larger number.",
      "Stop at the first one that the smaller number divides.",
    ],
    watch:
      "The product of the numbers is a common multiple but not always the least.",
  },
  "gcf-factor-sum": {
    goal: "Rewrite a sum of two whole numbers as their greatest common factor times a sum.",
    terms: [
      ["distributive property", "a × b + a × c = a(b + c)."],
      ["factor out", "Write a sum as a common factor times the remaining sum."],
    ],
    method: [
      "Find the greatest common factor of the two numbers.",
      "Divide each number by it.",
      "Write the factor followed by the sum of the quotients in parentheses.",
    ],
    watch:
      "Divide both numbers by the factor, and check that the quotients share no factor greater than 1.",
  },
  "long-division-quotient": {
    goal: "Divide a multidigit whole number by a two-digit divisor.",
    terms: [
      ["dividend", "The number being divided."],
      ["quotient", "The result of the division."],
    ],
    method: [
      "Take the first part of the dividend that is at least the divisor.",
      "Write the largest digit whose product with the divisor fits, then subtract.",
      "Bring down the next digit and repeat; write 0 when the divisor does not fit.",
      "Check: quotient × divisor = dividend.",
    ],
    watch:
      "Each remainder must be less than the divisor, and every brought-down digit needs a quotient digit.",
  },
  "division-remainder-story": {
    goal: "Divide in a story and use the remainder the way the story needs.",
    terms: [
      ["remainder", "What is left after the largest number of full groups."],
    ],
    method: [
      "Divide to find the quotient and remainder.",
      "If every item needs a place, add 1 group for the remainder.",
      "If only full groups count, drop the remainder; if the leftover is asked for, answer with the remainder.",
    ],
    watch:
      "Decide what the remainder means before answering; the quotient alone is not always the answer.",
  },
  "signed-quantity": {
    goal: "Write a signed number for a quantity with a direction from 0.",
    terms: [
      ["negative number", "A number less than 0, written with a minus sign."],
      ["opposite quantities", "Equal sizes in opposite directions."],
    ],
    method: [
      "Identify the positive direction and what 0 means.",
      "Use the distance from 0 as the size of the number.",
      "Make the number negative if the quantity is in the opposite direction.",
    ],
    watch: "Opposite quantities have the same size and opposite signs.",
  },
  "opposite-on-line": {
    goal: "Read an integer on a number line and find its opposite.",
    terms: [
      [
        "opposite",
        "The number the same distance from 0 on the other side of 0.",
      ],
    ],
    method: [
      "Count unit ticks from 0 to read the number at the point.",
      "Move the same distance to the other side of 0 for its opposite.",
      "Taking the opposite twice returns to the original number.",
    ],
    watch: "The opposite of a negative number is positive.",
  },
  "signed-story": {
    goal: "Solve a multistep story with signed decimals exactly.",
    terms: [
      ["change", "An amount added to a value; negative when it decreases."],
    ],
    method: [
      "Choose the positive direction and write the starting value with its sign.",
      "Write each change with its sign; multiply repeated changes.",
      "Add the changes to the start, or find end − start for a change between two values.",
    ],
    watch:
      "A fall, descent or payment is a negative change even when the story states it as a positive amount.",
  },
  "signed-jumps": {
    goal: "Find where a sequence of signed changes ends on a number line.",
    terms: [
      [
        "signed change",
        "A positive change moves right; a negative change moves left.",
      ],
    ],
    method: [
      "Start at the given number.",
      "Add each change in order: a positive change moves right, a negative change moves left, by its distance from 0.",
      "The last arrow's end is the answer.",
    ],
    watch: "Adding a negative number moves left: 2.5 + (−8) = −5.5.",
  },
};

export const numberSystemPrinciples: Record<string, string> = {
  "greatest-common-factor":
    "The greatest common factor of two whole numbers is the largest whole number that divides both; it is the product of the prime factors they share.",
  "least-common-multiple":
    "The least common multiple of two whole numbers is the smallest positive number that both divide; every common multiple is a multiple of it.",
  "gcf-factor-sum":
    "Distributive property: a × b + a × c = a(b + c). Factoring out the greatest common factor leaves two numbers with no common factor greater than 1.",
  "long-division-quotient":
    "Long division shares the dividend one place value at a time; each remainder is less than the divisor, and quotient × divisor + remainder = dividend.",
  "division-remainder-story":
    "Dividend = quotient × divisor + remainder, with the remainder less than the divisor; the story decides whether the answer is the quotient, the quotient plus 1, or the remainder.",
  "signed-quantity":
    "Quantities in opposite directions from a reference point 0 have opposite signs; the number without its sign is the distance from 0.",
  "opposite-on-line":
    "The opposite of a number is the same distance from 0 on the other side of 0, so −(−a) = a.",
  "signed-story":
    "Write each change as a signed number, multiply repeated changes and add everything to the start; the change from one value to another is end − start.",
  "signed-jumps":
    "Adding a positive number moves right on a number line and adding a negative number moves left, by the number's distance from 0.",
};
