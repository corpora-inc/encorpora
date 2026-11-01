import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

export const numberSystemLessons: Lesson[] = [
  {
    id: "greatest-common-factor",
    title: "Greatest common factor",
    summary:
      "A factor of a whole number divides it with nothing left over: 6 is a factor of 48, because 48 ÷ 6 = 8 exactly. A common factor of two numbers is a factor of both. The greatest common factor, or GCF, is the largest one. For 48 and 72 it is 24. It tells you the most equal groups two amounts can be split into.",
    templateIds: ["greatest-common-factor", "gcf-factor-sum"],
    includeGeneratedRepresentation: false,
    senses: {
      units: "unit",
      factor: "factor-number",
      product: "product-multiply",
      square: "square-shape",
      whole: "whole",
      multiple: "multiple",
      side: "side",
    },
    noLink: ["part", "rule", "leaves", "edge", "parts", "terms"],
    objectives: [
      "Find the greatest common factor of two whole numbers up to 100, from lists of factors or from shared prime factors.",
      "Recognize when a story asks for the greatest common factor.",
      "Rewrite a sum as its greatest common factor times a smaller sum.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Make the most identical groups",
        paragraphs: [
          "Say 48 balls and 72 cones must be split into identical sets, with none left over. Every set gets the same number of balls and the same number of cones. So the number of sets must divide 48 evenly and also divide 72 evenly.",
          "A number that divides another evenly, with nothing left over, is called a factor of it. So the number of sets must be a factor of both counts. List the factors the two counts share, then choose the largest.",
        ],
      },
      {
        title: "Factors and common factors",
        paragraphs: [
          "This lesson uses whole-number multiplication and division. A factor of a whole number divides it with no remainder (nothing left over): 6 is a factor of 48 because 48 ÷ 6 = 8. Factors come in pairs whose product, the answer when you multiply them, is the number. Since 48 = 1 × 48 = 2 × 24 = 3 × 16 = 4 × 12 = 6 × 8, the factors of 48 are 1, 2, 3, 4, 6, 8, 12, 16, 24 and 48.",
          "A common factor of two numbers is a factor of both. The greatest common factor, or GCF, is the largest common factor. The factors of 72 are 1, 2, 3, 4, 6, 8, 9, 12, 18, 24, 36 and 72. The numbers in both lists are 1, 2, 3, 4, 6, 8, 12 and 24, so the GCF of 48 and 72 is 24.",
        ],
      },
      {
        title: "Shared prime factors",
        paragraphs: [
          "A prime number has exactly two factors, 1 and itself: 2, 3, 5, 7, 11 and so on. Every whole number greater than 1 can be written as primes multiplied together in only one way, apart from order: 48 = 2 × 2 × 2 × 2 × 3 and 72 = 2 × 2 × 2 × 3 × 3. These primes are called its prime factors.",
          "In the figure, the primes that 48 and 72 share sit in the overlap: 2, 2, 2 and 3. Their product, 2 × 2 × 2 × 3 = 24, divides both numbers. No larger number divides both, because a common factor can be built only from primes that both numbers contain. So the GCF is the product of the shared primes.",
        ],
        illustration: "prime-factor-venn",
      },
      {
        title: "Questions the GCF answers",
        paragraphs: [
          "Splitting 48 balls and 72 cones into identical sets with none left over needs a number of sets that divides both counts. The greatest number of sets is the GCF, 24, and each set gets 48 ÷ 24 = 2 balls and 72 ÷ 24 = 3 cones.",
          "The largest square tile that covers a floor 48 feet by 72 feet without cutting has sides 24 feet long, for the same reason. The tile's side length must divide both the length and the width of the floor.",
        ],
      },
      {
        title: "Factor the GCF out of a sum",
        paragraphs: [
          "A number written right before parentheses means multiply: 4(9 + 2) means 4 × (9 + 2). Multiplying a sum gives the same result as multiplying each part and adding: 4 × 9 + 4 × 2 = 36 + 8 = 44, and 4 × (9 + 2) = 4 × 11 = 44.",
          "Read backwards, this lets you pull a common factor out of a sum. For 36 + 8, the GCF is 4: 36 = 4 × 9 and 8 = 4 × 2. So 36 + 8 = 4 × 9 + 4 × 2 = 4(9 + 2). This is called factoring out the 4. The rule behind it, a × b + a × c = a × (b + c), is called the distributive property.",
          "The figure shows a rectangle 4 units tall whose width is split into 9 and 2. Its two parts have areas (flat space covered) 36 and 8, and the whole rectangle has area 4 × 11 = 44.",
          "After the GCF is factored out, the numbers in the parentheses, 9 and 2, have no common factor greater than 1. Factoring out a smaller common factor, as in 2(18 + 4), gives the right value but leaves the common factor 2 inside the parentheses.",
        ],
        illustration: "gcf-area",
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Largest shared divisor",
        paragraphs: [
          "For positive whole numbers $a$ and $b$, the greatest common factor is the largest positive whole number that divides both without remainder. It is the product of every prime factor the two numbers share. A prime that appears several times is used as many times as it appears in the number with fewer copies.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A coach has 48 balls and 72 cones to split into identical sets with none left over. What is the greatest number of sets that can be made?",
      steps: [
        "Every set gets the same number of balls and the same number of cones. So the number of sets must divide both 48 and 72 evenly: it is a common factor.",
        "Write each count as primes multiplied together: 48 = 2 × 2 × 2 × 2 × 3 and 72 = 2 × 2 × 2 × 3 × 3.",
        "Both lists contain 2, 2, 2 and 3. Multiply these shared primes to get the largest common factor: 2 × 2 × 2 × 3 = 24.",
        "Check: each of the 24 sets gets 48 ÷ 24 = 2 balls and 72 ÷ 24 = 3 cones, with none left over.",
      ],
      answer: "24",
    },
    pitfalls: [
      "The GCF is never larger than the smaller number. A result larger than both numbers is a multiple (a number times a whole number), not a factor.",
      "A common factor is not always the greatest: 12 divides 48 and 72, but the quotients 4 and 6 still share 2.",
      "Divide both numbers by the factor: 4(9 + 8) is 36 + 32, not 36 + 8.",
    ],
    parentGuide:
      "Take 12 red and 18 blue counters. Ask for the most identical groups that use every counter, then list the factors of 12 and 18 to see why 6 groups is the most.",
  },
  {
    id: "least-common-multiple",
    title: "Least common multiple",
    summary:
      "A multiple of a number is that number times a whole number. The multiples of 6 are 6, 12, 18, 24 and so on, like counting by 6s. A common multiple of two numbers is on both lists. The least common multiple, or LCM, is the smallest positive one. For 6 and 8 it is 24. It tells you when two repeating counts first line up.",
    templateIds: ["least-common-multiple"],
    includeGeneratedRepresentation: false,
    senses: {
      jumps: "jump",
      factor: "factor-number",
      product: "product-multiply",
      multiple: "multiple",
    },
    objectives: [
      "Find the least common multiple of two whole numbers up to 12.",
      "Recognize when a story about repeating counts or packages asks for the least common multiple.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Find when two counts meet",
        paragraphs: [
          "One light flashes every 6 seconds and another every 8 seconds. The first light flashes at 6, 12, 18, 24 seconds and so on. These are the multiples of 6: 6 times 1, 2, 3, 4, …. The second flashes at 8, 16, 24, …. The first time on both lists, 24, is when they flash together. It is called their least common multiple.",
        ],
      },
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
          "If one number divides the other, the larger number is the LCM: the LCM of 4 and 12 is 12. A factor is a number that divides another evenly. If the two numbers share no factor greater than 1, the LCM is their product: the LCM of 5 and 9 is 5 × 9 = 45. Otherwise the product is too large. For 6 and 8, the product 6 × 8 = 48 counts their shared factor 2 twice, and 48 ÷ 2 = 24.",
        ],
      },
      {
        title: "Questions the LCM answers",
        paragraphs: [
          "Two lights that flash every 6 and every 8 seconds flash together at times that are multiples of both numbers, so they next flash together after 24 seconds. Hot dogs in packs of 10 and buns in packs of 8 first come out even at 40: 4 packs of hot dogs and 5 packs of buns.",
          "Look for the LCM when two repeating counts must line up. Look for the GCF, the greatest common factor, when two amounts are split into equal groups. Lining up gives an answer at least as large as both numbers. Splitting gives an answer no larger than either.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "First shared positive multiple",
        paragraphs: [
          "For positive whole numbers $a$ and $b$, the least common multiple is the smallest positive whole number divisible by both. Every positive common multiple is a positive whole-number multiple of it.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "Two lights flash together now. One flashes every 6 seconds and the other every 8 seconds. In how many seconds will they next flash together?",
      steps: [
        "Each light flashes at multiples of its own time. So they flash together at times that are multiples of both 6 and 8, the common multiples.",
        "List multiples of the larger number, 8, because they are farther apart: 8, 16, 24.",
        "Check each against 6: 6 does not divide 8 or 16 evenly, but 24 = 6 × 4. So the least common multiple is 24.",
        "Check: in 24 seconds the first light flashes 24 ÷ 6 = 4 times and the second 24 ÷ 8 = 3 times, so both are flashing at 24 seconds.",
      ],
      answer: "24",
    },
    pitfalls: [
      "The product is a common multiple but not always the least: 6 × 8 = 48, while 24 is smaller.",
      "The LCM is at least as large as the larger number. A result smaller than both numbers is a factor, not a multiple.",
      "Do not confuse the LCM with the GCF. Lining up repeating counts asks for a multiple. Splitting into equal groups asks for a factor.",
    ],
    parentGuide:
      "Clap every 3 counts while your child taps every 4 counts, counting aloud from 1. Stop at the first count where both happen, then check it against the lists of multiples.",
  },
  {
    id: "long-division",
    title: "Long division and remainders",
    summary:
      "Dividing 8736 by 24 asks how many groups of 24 fit in 8736. The answer, 364, is called the quotient. When groups do not fit exactly, the amount left over is called the remainder: 437 ÷ 52 is 8 with 21 left over. Long division finds the answer one place at a time, starting with the biggest place: hundreds, then tens, then ones.",
    templateIds: ["long-division-quotient", "division-remainder-story"],
    includeGeneratedRepresentation: false,
    senses: {
      "more than": "more-than",
      place: "place-value",
      product: "product-multiply",
      multiple: "multiple",
    },
    noLink: ["part", "parts"],
    objectives: [
      "Divide a whole number of up to five digits by a two-digit divisor (the number you divide by), using long division.",
      "Check a quotient by multiplication.",
      "Decide whether a story needs the quotient, the quotient plus 1, or the remainder.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Share the largest pieces first",
        paragraphs: [
          "Think of 8736 as 8 thousands, 7 hundreds, 3 tens and 6 ones. To divide it into groups of 24, start with the biggest pieces that can be shared. Record how many groups fit, then pass any amount left over down to the next smaller place.",
          "The number of groups is called the quotient. At the end, any amount too small to make another full group is called the remainder.",
        ],
      },
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
          "Long division, the standard written method, finds the quotient one place at a time, starting from the left. The first part of 8736 that is at least 24 is 87, which stands for 87 hundreds. The largest multiple of 24 that fits in 87 is 24 × 3 = 72, because 24 × 4 = 96 is too big. Write 3 in the hundreds place of the quotient and subtract: 87 − 72 = 15.",
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
    closingSections: [
      {
        stage: "formal",
        title: "Division with a remainder",
        paragraphs: [
          "For a whole-number dividend $n$ and a whole-number divisor $d$ greater than 0, there is exactly one pair of whole numbers $q$ (the quotient) and $r$ (the remainder) with $n = d \\times q + r$ and $0 \\le r < d$. That means $r$ is at least 0 and less than $d$. A story decides whether to report the quotient, the remainder, or one more group.",
        ],
      },
    ],
    workedExample: {
      prompt: "What is 8736 ÷ 24?",
      steps: [
        "Start at the left. 8 is less than 24, so use 87, which stands for 87 hundreds. 24 × 3 = 72 fits, but 24 × 4 = 96 is more than 87. Write 3 in the hundreds place of the answer, and subtract to see what is left: 87 − 72 = 15.",
        "Bring down the next digit, 3, to make 153 tens. 24 × 6 = 144 fits, but 24 × 7 = 168 is too big. Write 6 in the tens place, and subtract: 153 − 144 = 9.",
        "Bring down the last digit, 6, to make 96 ones. 24 × 4 = 96 fits exactly, and 24 × 5 = 120 is too big. Write 4 in the ones place: 96 − 96 = 0.",
        "Nothing is left, so the remainder is 0 and the quotient is 364. Check by multiplying back, because division undoes multiplication: 364 × 24 = 8736.",
      ],
      answer: "364",
    },
    pitfalls: [
      "Write 0 in the quotient when a part is smaller than the divisor: 7248 ÷ 24 = 302, not 32.",
      "Each amount left after subtracting must be less than the divisor. If it is not, the digit you wrote is too small.",
      "In a story, decide whether the answer is the quotient, the quotient plus 1, or the remainder.",
    ],
    parentGuide:
      "Share 100 pennies among 7 people one round at a time and count what is left. Then work 100 ÷ 7 with long division and compare: 14 each, with 2 left over.",
  },
  {
    id: "signed-numbers",
    title: "Signed numbers and opposites",
    summary:
      "A number line is a line with numbers marked in order at equal steps. Positive numbers sit to the right of 0. Negative numbers, written with a minus sign like −20, sit to the left. They describe amounts in two opposite directions, such as above and below sea level. The opposite of a number is the same distance from 0 on the other side: the opposite of 6 is −6.",
    templateIds: ["signed-quantity", "opposite-on-line"],
    includeGeneratedRepresentation: false,
    senses: {
      opposite: "opposite-number",
      opposites: "opposite-number",
      degrees: "degree-temperature",
      unit: "unit",
    },
    noLink: ["side", "directions", "direction", "sides"],
    objectives: [
      "Use positive and negative numbers for amounts in opposite directions, and explain what 0 means.",
      "Read integers on a number line and find a number's opposite.",
      "Explain why the opposite of the opposite of a number is the number itself.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Zero separates opposite directions",
        paragraphs: [
          "A temperature can be above or below zero. Numbers above zero are called positive. Numbers below zero are called negative and are written with a minus sign: −5 is read “negative five”.",
          "A number line is a straight line with numbers marked in order at equal steps. Positive numbers lie to the right of 0 and negative numbers to the left. The number farther right is greater, even when both are negative: −2 is greater than −5.",
        ],
      },
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
    closingSections: [
      {
        stage: "formal",
        title: "Position and opposite",
        paragraphs: [
          "Every signed number (a number with a plus or minus sign, or 0) has a position on the number line, measured from zero. Its opposite lies the same distance from zero on the other side. That distance, which is never negative, is called its absolute value. Of two different numbers, the one farther right is greater.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A diver swims 35 feet below sea level. Sea level is 0, and heights above sea level are positive. What number represents the diver's height?",
      steps: [
        "Heights above sea level are positive, so heights below sea level are negative, the opposite direction.",
        "The diver is 35 feet from sea level, 0, so the size of the number is 35. The diver is below, so the sign is negative.",
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
      "A signed number is a number with a plus or minus sign: 7.25 is positive and −4.5 is negative. In a story, pick one direction, such as warmer, to be positive. A change the other way, such as colder, is negative. Write the start and each change with its sign, then add them all. The change from one reading to another is the end minus the start.",
    templateIds: ["signed-story", "signed-jumps"],
    includeGeneratedRepresentation: false,
    senses: {
      balance: "balance-account",
      jumps: "jump",
      change: "change",
      changes: "change",
      opposite: "opposite-number",
      product: "product-multiply",
      degrees: "degree-temperature",
    },
    noLink: ["direction", "directions"],
    objectives: [
      "Write signed numbers for the starting value and each change in a temperature, height or money story.",
      "Solve stories with several steps and signed decimals exactly, including repeated changes.",
      "Find the change from one signed value to another as end minus start.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Choose one positive direction",
        paragraphs: [
          "Numbers above 0 are positive, and numbers below 0 are negative, written with a minus sign. If going up is positive, going down is negative. Write each change with its sign, then add the changes in order. To find the change between two readings, subtract: end minus start.",
        ],
      },
      {
        title: "Model each change with a sign",
        paragraphs: [
          "This lesson uses addition, subtraction and multiplication of decimals. In a story, first choose the positive direction: up, warmer, or money added. A change in the opposite direction is negative. A starting value can be negative too, such as a temperature of −4.5°C or an account balance of −32.50 dollars, which means 32.50 dollars is owed.",
          "A repeated change is a product, the answer to a multiplication. Falling 1.5°C each hour for 3 hours is 3 × (−1.5) = −4.5. A positive number times a negative number is negative, because it adds the same negative change several times: (−1.5) + (−1.5) + (−1.5) = −4.5.",
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
          "The change from a starting value to an ending value is the end minus the start. From −7.5°C to 4.25°C the change is 4.25 − (−7.5) = 4.25 + 7.5 = 11.75 degrees. Subtracting a negative number adds its opposite, the same size with the other sign. Taking away a drop is the same as adding a rise.",
          "The vertical distance between a ledge at 26.5 meters and a diver at −16.5 meters is 26.5 − (−16.5) = 43 meters, the 26.5 meters above sea level plus the 16.5 meters below it.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Signed changes combine",
        paragraphs: [
          "Call the signed changes $c_1, c_2, \\ldots, c_n$, where the small number after $c$ just numbers the changes in order. Then a starting value $s$ becomes $s + c_1 + c_2 + \\cdots + c_n$. The change from value $a$ to value $b$ is $b - a$. A positive result is a change in the chosen positive direction; a negative result is a change the other way.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "At 6 a.m. the temperature was −4.5°C. By noon it had risen 7.25°C. Then it fell 1.5°C each hour for 3 hours. What was the temperature then, in °C?",
      steps: [
        "Choose rising as positive, so falling is negative. The temperature starts at −4.5.",
        "The rise of 7.25°C is a change of +7.25.",
        "Falling 1.5°C each hour for 3 hours repeats the same change 3 times, so multiply: 3 × (−1.5) = −4.5.",
        "Add the start and the changes in order: −4.5 + 7.25 = 2.75, then 2.75 + (−4.5) = −1.75.",
        "The temperature was −1.75°C, a little below zero.",
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
      "Draw a thermometer from −10 to 10. Start at −3, move up 5, then down 2 twice. Compare the final mark with the sum −3 + 5 + 2 × (−2).",
  },
];

export const numberSystemMethods: Record<string, ProblemMethod> = {
  "greatest-common-factor": {
    noLink: ["edges", "edge"],
    goal: "Find the largest whole number that divides both given numbers with nothing left over.",
    terms: ["factor-number", "greatest-common-factor"],
    senses: {
      side: "side",
      square: "square-shape",
      factor: "factor-number",
      product: "product-multiply",
      multiple: "multiple",
    },
    intuition:
      "A factor of a number divides it with nothing left over: 6 is a factor of 48, since 48 ÷ 6 = 8. A common factor divides both numbers. The greatest common factor (GCF) is the largest of these. A prime number has only two factors, 1 and itself, like 2, 3 or 5.",
    method: [
      "List the factors of each number, or write each as primes multiplied together.",
      "Find the factors both lists share, or the primes both numbers share.",
      "The GCF is the largest shared factor, or the shared primes multiplied together.",
    ],
    watch:
      "The GCF is never larger than the smaller number. A larger answer is a multiple, not a factor.",
  },
  "least-common-multiple": {
    noLink: ["whole"],
    goal: "Find the smallest positive number that both given numbers divide evenly.",
    terms: ["multiple", "least-common-multiple"],
    senses: {
      multiple: "multiple",
      product: "product-multiply",
      factor: "factor-number",
    },
    intuition:
      "A multiple of a number is that number times a whole number: the multiples of 6 are 6, 12, 18, 24, and so on. A common multiple is on both lists. The least common multiple (LCM) is the smallest positive one: for 6 and 8 it is 24.",
    method: [
      "List multiples of the larger number.",
      "Stop at the first one that the smaller number divides.",
    ],
    watch:
      "The product of the two numbers is a common multiple but not always the least: 6 × 8 = 48, but the LCM is 24.",
  },
  "gcf-factor-sum": {
    noLink: ["rule", "leaves"],
    goal: "Rewrite a sum of two whole numbers as their greatest common factor times a sum.",
    intuition:
      "A factor divides a whole number evenly, with nothing left over. A number written right before parentheses means multiply: 6(2 + 3) means 6 × (2 + 3). Since 12 = 6 × 2 and 18 = 6 × 3, the sum 12 + 18 = 6(2 + 3). Both give 30. Pulling out a shared factor like this is called factoring out, and the rule behind it is the distributive property. Here 6 is the greatest factor that 12 and 18 share.",
    terms: ["distributive-property", "factor-out"],
    senses: { factor: "factor-number", quotient: "quotient" },
    method: [
      "Find the greatest common factor of the two numbers.",
      "Divide each number by it.",
      "Write the factor, then the sum of the two answers (the quotients) in parentheses.",
    ],
    watch:
      "Divide both numbers by the factor. Then check that the two numbers left in the parentheses share no factor greater than 1.",
  },
  "long-division-quotient": {
    goal: "Divide a whole number with several digits by a two-digit number, using long division.",
    terms: ["dividend", "quotient"],
    senses: {
      "more than": "more-than",
      product: "product-multiply",
      place: "place-value",
    },
    noLink: ["part"],
    intuition:
      "In 8736 ÷ 24, the dividend 8736 is the number being divided, and the divisor 24 is the number you divide by. The answer, 364, is called the quotient. Long division finds it one digit at a time, from the left: hundreds, then tens, then ones.",
    method: [
      "Take the first part of the dividend, from the left, that is at least the divisor.",
      "Write the largest digit whose product with the divisor fits in that part, then subtract.",
      "Bring down the next digit and repeat. Write 0 when the divisor does not fit.",
      "Check by multiplying: quotient × divisor = dividend.",
    ],
    watch:
      "Each remainder must be less than the divisor, and every brought-down digit needs a quotient digit.",
  },
  "division-remainder-story": {
    goal: "Divide in a story and use the remainder, the amount left over, the way the story needs.",
    terms: ["remainder"],
    senses: { "more than": "more-than", quotient: "quotient" },
    intuition:
      "437 ÷ 52 is 8 groups, called the quotient, with 21 left over, called the remainder. A story decides what to do with the leftover. If every student needs a bus seat, 21 more students need a 9th bus. If only full boxes count, the 21 are dropped.",
    method: [
      "Divide to find the quotient and remainder.",
      "If every item needs a place, add 1 group for the remainder.",
      "If only full groups count, drop the remainder. If the story asks what is left over, answer with the remainder.",
    ],
    watch:
      "Decide what the remainder means before answering; the quotient alone is not always the answer.",
  },
  "signed-quantity": {
    goal: "Write a positive or negative number for an amount that goes one way or the other from 0.",
    senses: {
      units: "unit",
      unit: "unit",
      opposite: "opposite-number",
      degrees: "degree-temperature",
    },
    noLink: ["direction", "directions"],
    intuition:
      "Positive numbers are above 0, and negative numbers, written with a minus sign like −20, are below 0. Many amounts go two opposite ways from a starting point 0, such as above or below sea level, or money in or out. Choose one way to be positive; the other way is negative.",
    terms: [
      "negative-number",
      [
        "opposite-number",
        "Opposite quantities have equal sizes in opposite directions, such as a gain of 5 and a loss of 5.",
      ],
    ],
    method: [
      "Find which way is positive and what 0 means in the story.",
      "Use the distance from 0 as the size of the number.",
      "Make the number negative if the amount goes the other way.",
    ],
    watch:
      "Amounts of the same size going opposite ways have opposite signs: a gain of 5 is 5, a loss of 5 is −5.",
  },
  "opposite-on-line": {
    noLink: ["right side", "left side", "side"],
    goal: "Read an integer on a number line and find its opposite.",
    terms: ["opposite-number"],
    senses: { unit: "unit", units: "unit", opposite: "opposite-number" },
    intuition:
      "An integer is a whole number or its negative: …, −2, −1, 0, 1, 2, …. A number line has numbers in order at equal steps, with negatives to the left of 0. The opposite of a number is the same distance from 0 on the other side: the opposite of −7 is 7.",
    method: [
      "Find what one space between tick marks is worth, then count spaces from 0 to read the number at the point.",
      "Move the same distance to the other side of 0 to find its opposite.",
      "Taking the opposite twice returns to the number you started with.",
    ],
    watch:
      "The opposite of a negative number is positive: the opposite of −4 is 4.",
  },
  "signed-story": {
    goal: "Solve a story with several steps and positive and negative decimals, exactly.",
    terms: [["change", "A decrease is a negative change."]],
    senses: {
      degrees: "degree-temperature",
      opposite: "opposite-number",
      balance: "balance-account",
      change: "change",
      product: "product-multiply",
    },
    noLink: ["direction"],
    intuition:
      "A signed number has a plus or minus sign: −4.5 is 4.5 below zero. In a story, choose one direction, such as warmer, as positive. A change the other way is negative. A change that repeats, like falling 1.5 degrees each hour for 3 hours, is a multiplication: 3 × (−1.5) = −4.5.",
    method: [
      "Choose the positive direction, and write the starting value with its sign.",
      "Write each change with its sign. Multiply a change that repeats.",
      "Add the changes to the start. For the change between two values, find end − start.",
    ],
    watch:
      "A fall, descent or payment is a negative change even when the story states it as a positive amount.",
  },
  "signed-jumps": {
    goal: "Find where a list of positive and negative changes ends on a number line.",
    senses: { change: "change", changes: "change" },
    intuition:
      "A number line has numbers in order at equal steps, with negatives (below 0) to the left. Adding a positive number moves right. Adding a negative number moves left. Each move is as long as the number's distance from 0.",
    terms: [
      [
        "number-line",
        "A positive change moves right on it; a negative change moves left.",
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
    "The greatest common factor of two whole numbers is the largest whole number that divides both. It is the product of the prime factors they share.",
  "least-common-multiple":
    "The least common multiple of two whole numbers is the smallest positive number that both divide. Every common multiple is a multiple of it.",
  "gcf-factor-sum":
    "Distributive property: a × b + a × c = a(b + c). Factoring out the greatest common factor leaves two numbers with no common factor greater than 1.",
  "long-division-quotient":
    "Long division shares the dividend one place value at a time. Each remainder is less than the divisor, and quotient × divisor + remainder = dividend.",
  "division-remainder-story":
    "Dividend = quotient × divisor + remainder, with the remainder less than the divisor. The story decides whether the answer is the quotient, the quotient plus 1, or the remainder.",
  "signed-quantity":
    "Amounts in opposite directions from a starting point 0 have opposite signs. The number without its sign is the distance from 0.",
  "opposite-on-line":
    "The opposite of a number is the same distance from 0 on the other side of 0, so $-(-a) = a$.",
  "signed-story":
    "Write each change as a signed number, multiply repeated changes, and add everything to the start. The change from one value to another is end − start.",
  "signed-jumps":
    "Adding a positive number moves right on a number line and adding a negative number moves left, by the number's distance from 0.",
};
