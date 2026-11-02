import type { FacetMapping } from "./coverage";
import { formatLessons, type FormatLessonEntry } from "./format-lesson-entry";

type Entry = FormatLessonEntry & {
  /** The practice-screen task, at most 140 characters; defaults to the summary. */
  goal?: string;
};

const entries: Entry[] = [
  {
    id: "digit-place-names",
    title: "Name the place of each digit",
    goal: "Name the place of each digit of a whole number, counting places from the ones at the right.",
    summary:
      "A digit is one of the symbols 0 to 9 we use to write numbers. A digit's place is its spot in the number. The place tells what the digit is worth. Count the places from the right, starting with the ones place.",
    objectives: [
      "Name the place of each digit in a number with up to six digits, from ones to hundred thousands.",
      "Say what a digit is worth because of its place.",
    ],
    intuition:
      "We write numbers with digits, the symbols 0 to 9. A digit's place is its spot in the number, and the place tells what the digit is worth. The rightmost place is the ones place. Moving left, the places are tens, hundreds, thousands, ten thousands and hundred thousands. Each place is worth 10 of the place on its right: 10 ones make a ten, and 10 tens make a hundred. In 804,516 the 8 is in the hundred thousands place, so it stands for 800,000. The comma splits the digits into groups of three, so a big number is easier to read.",
    terms: ["place", "place-value"],
    method: [
      "Start at the rightmost digit. Its place is the ones place.",
      "Move left one digit at a time, saying tens, hundreds, thousands, ten thousands, hundred thousands.",
      "Match each digit with the place name you say when you reach it.",
    ],
    watch:
      "Count from the right, starting with ones. The place of the leftmost digit depends on how many digits the number has.",
    principle:
      "Each place is worth 10 times the place on its right. So, from the right, the places are ones, tens, hundreds, thousands, ten thousands and hundred thousands. A digit is worth the digit times its place: the 6 in 603,481 is worth 6 × 100,000 = 600,000.",
    example: {
      prompt: "Name the place of each digit of 603,481.",
      steps: [
        "Start at the right. The rightmost digit, 1, is in the ones place. Moving left, 8 is in the tens place and 4 is in the hundreds place.",
        "Keep moving left. 3 is in the thousands place, 0 is in the ten thousands place and 6 is in the hundred thousands place.",
        "So the 6 is worth 600,000. The 0 is worth nothing, but it keeps the 6 in its place.",
      ],
      answer:
        "6: hundred thousands; 0: ten thousands; 3: thousands; 4: hundreds; 8: tens; 1: ones.",
    },
    methodTitle: "Count places from the ones",
    methodText: [
      "Write the place names under the digits, from right to left. Then read each digit with the name under it.",
      "Check with what each digit is worth: a digit in the hundreds place is worth that digit times 100.",
    ],
    formal:
      "A number is the sum of what its digits are worth: 603,481 = 600,000 + 3,000 + 400 + 80 + 1. The 0 adds nothing, but it holds the ten thousands place. Without it, the 6 would slide into the ten thousands place, and the number would be 63,481.",
    pitfalls: [
      "Do not name the places from the left. A five-digit number has no hundred thousands place.",
      "A digit 0 still has a place. It holds the place and is worth nothing.",
    ],
    parentGuide:
      "Write the place names on a strip of paper. Slide it under a number so the word ones sits under the rightmost digit.",
  },
  {
    id: "round-place-blanks",
    title: "Round a number to different places",
    noLink: ["side"],
    goal: "Round a four-digit number to the nearest thousand, hundred and ten by looking at the next digit to the right.",
    summary:
      "To round a number means to swap it for a close, easy number that ends in zeros. To the nearest hundred, 4,758 rounds to 4,800. The digit just right of the place you round to tells you which way to go.",
    objectives: [
      "Round a four-digit number to the nearest ten, hundred and thousand.",
      "Tell rounding apart from cutting off digits.",
    ],
    intuition:
      "To round to the nearest hundred means to find the closest number that ends in 00. 4,758 is between 4,700 and 4,800. Halfway between them is 4,750. 4,758 is past halfway, so it is closer to 4,800. It rounds to 4,800. There is a quick check. Look at the digit just right of the place you round to. If it is 5 or more, the number is halfway or past, so round up to the bigger number. If it is 4 or less, round down to the smaller one. To the nearest thousand, find the closest number ending in 000. To the nearest ten, find the closest number ending in 0. Each place can give a different answer, so start from the original number each time.",
    terms: [
      [
        "round",
        "To round up, add 1 to the digit in the rounding place and change every digit to its right to zero. A 9 becomes 0 and adds 1 to the digit on its left.",
      ],
      [
        "round",
        "To round down, keep the digit in the rounding place and change every digit to its right to zero.",
      ],
    ],
    method: [
      "Find the place you round to: thousands, hundreds or tens.",
      "Look at the digit just to its right. If it is 5 or more, round up. If it is 4 or less, round down.",
      "To round up, add 1 to the digit in the rounding place. A 9 becomes 0 and adds 1 to its left. To round down, keep the digit. Then write 0 in every place to its right.",
      "For the next place, start again from the original number.",
    ],
    watch:
      "Look at the digit right next to the rounding place, not at the last digit. When that digit is exactly 5, round up.",
    principle:
      "A number rounds to the nearer of the two numbers around it that end in zeros at that place, like 4,700 and 4,800. A number exactly halfway, like 4,750, rounds up. The digit just right of the rounding place shows which side of halfway the number is on.",
    example: {
      prompt: "Round 4,758 to the nearest thousand, hundred and ten.",
      steps: [
        "Nearest thousand: 4,758 is between 4,000 and 5,000. The hundreds digit is 7, which is 5 or more, so round up to 5,000.",
        "Nearest hundred: 4,758 is between 4,700 and 4,800. The tens digit is 5, so round up to 4,800.",
        "Nearest ten: 4,758 is between 4,750 and 4,760. The ones digit is 8, so round up to 4,760.",
      ],
      answer: "5,000; 4,800; 4,760.",
    },
    methodTitle: "One look for each place",
    methodText: [
      "Round to each place from the original number. Do not round a rounded answer again.",
      "Check each answer. It has zeros in every place right of the rounding place. To the nearest hundred, it is never more than 50 away from the number.",
    ],
    formal:
      "Every number sits between two numbers that end in zeros at the rounding place, like 4,700 and 4,800. Halfway between them is 4,750, which has a 5 just right of the rounding place. If that digit is 5 or more, the number is halfway or past it, so round up. If it is 4 or less, the number is before halfway, so round down. When a number is exactly halfway, we agree to round up.",
    pitfalls: [
      "Cutting off digits is not rounding. 4,758 cut at the tens is 4,750, but it rounds to 4,760.",
      "Do not round in steps. 4,449 rounds to 4,400 to the nearest hundred. Rounding it to 4,450 first and then to 4,500 gives the wrong answer.",
    ],
    parentGuide:
      "Ask your learner which two hundreds a number is between, and which of the two is closer.",
  },
  {
    id: "round-decimal-blanks",
    title: "Round a decimal to two places",
    senses: { whole: "whole" },
    goal: "Round a decimal to the nearest tenth and the nearest hundredth by checking the digit one place to the right.",
    summary:
      "A decimal is a number with a decimal point, like 6.274. The digits after the point are parts of one whole. To round a decimal, look at the digit just right of the place you round to.",
    objectives: [
      "Round a decimal with thousandths to the nearest tenth and to the nearest hundredth.",
      "Carry correctly when a digit that rounds up is 9.",
    ],
    intuition:
      "The decimal point sits just right of the ones place. The first place after the point is the tenths place: one whole cut into 10 equal parts. The next is the hundredths place, 100 equal parts, and then the thousandths place, 1,000 equal parts. To round to the nearest tenth means to find the closest number with just one digit after the point. 6.274 is between 6.2 and 6.3, and it is closer to 6.3. To decide, look at the hundredths digit. If it is 5 or more, round up: add 1 to the tenths digit. If it is 4 or less, keep the tenths digit. Then drop the digits after it. To round to the nearest hundredth, look at the thousandths digit instead. When a 9 rounds up, it becomes 0 and adds 1 to the digit on its left: 4.396 to the nearest hundredth is 4.40.",
    terms: ["tenth", "hundredth"],
    method: [
      "Name the place you round to. Look at the digit just to its right.",
      "If that digit is 5 or more, add 1 to the digit in the rounding place, carrying if it is 9. If it is 4 or less, keep it.",
      "Drop the digits to the right. Do the second rounding from the original decimal.",
    ],
    watch:
      "Round each place from the original number. 4.396 to the nearest tenth is 4.4, because its hundredths digit is 9.",
    principle:
      "A decimal rounds to the nearer of the two numbers around it at the rounding place, like 6.2 and 6.3. A number exactly halfway, like 6.25, rounds up. A next digit of 5 or more shows that the number is halfway or past.",
    example: {
      prompt: "Round 6.274 to the nearest tenth and the nearest hundredth.",
      steps: [
        "Nearest tenth: 6.274 is between 6.2 and 6.3. The hundredths digit is 7, which is 5 or more, so the tenths digit 2 goes up to 3: 6.3.",
        "Nearest hundredth: 6.274 is between 6.27 and 6.28. The thousandths digit is 4, which is 4 or less, so the hundredths digit 7 stays: 6.27.",
      ],
      answer: "6.3 and 6.27.",
    },
    methodTitle: "Look right, then carry",
    methodText: [
      "A 9 that rounds up carries. 3.96 to the nearest tenth: the 9 tenths become 10 tenths, which is 1 more whole. So the answer is 4.0, which can also be written 4.",
      "The two answers can differ in more than the last digit, so check each one against the original number.",
    ],
    formal:
      "Every decimal sits between two neighbors at the rounding place, like 6.2 and 6.3. Halfway between them is 6.25. If the next digit is 5 or more, the number is halfway or past it, so round up. If it is 4 or less, the number is before halfway, so round down. When a number is exactly halfway, we agree to round up.",
    pitfalls: [
      "Do not just cut off digits. 2.678 cut at the hundredths is 2.67, but it rounds to 2.68.",
      "When a 9 rounds up, write 0 and add 1 to the digit on its left. Never write 10 in one place.",
    ],
    parentGuide:
      "Put a decimal on a number line between two tenths, such as 6.2 and 6.3. Ask which tenth it is closer to.",
  },
  {
    id: "round-addends-sum",
    title: "Estimate a sum by rounding",
    senses: { "more than": "more-than" },
    goal: "Round each addend to the same place, then add the rounded numbers to estimate the sum.",
    summary:
      "In 47 + 36 = 83, the numbers you add, 47 and 36, are called addends. The answer, 83, is the sum. An estimate is a close answer you can find quickly. To estimate a sum, round each addend to the same place, then add.",
    objectives: [
      "Round two addends to the nearest ten or hundred.",
      "Add the rounded numbers to get an estimate, and tell it apart from the exact sum.",
    ],
    intuition:
      "To round to the nearest ten means to find the closest number that ends in 0. 47 is between 40 and 50, and it is closer to 50. Look at the ones digit: 5 or more rounds up, and 4 or less rounds down. To round to the nearest hundred, find the closest number that ends in 00, and look at the tens digit instead. Rounded numbers end in zeros, so they are easy to add in your head. An estimate is the sum of the rounded numbers. It is close to the exact sum, but usually not the same.",
    terms: ["addend", "estimate"],
    method: [
      "Round the first addend to the place the question names. Look at the digit just right of that place.",
      "Round the second addend to the same place.",
      "Add the two rounded numbers. That sum is the estimate.",
    ],
    watch:
      "Add the rounded numbers, not the original ones. Round both addends to the same place.",
    principle:
      "Rounding to the nearest ten moves each addend 5 or less. So the estimate is never more than 10 away from the exact sum. Rounding to the nearest hundred moves each addend 50 or less, so the estimate is never more than 100 away.",
    example: {
      prompt: "Estimate 47 + 36 by rounding each addend to the nearest ten.",
      steps: [
        "47 is between 40 and 50. Its ones digit is 7, which is 5 or more, so it rounds up to 50.",
        "36 is between 30 and 40. Its ones digit is 6, so it rounds up to 40.",
        "Add the rounded numbers: 50 + 40 = 90. That is the estimate. The exact sum is 83, which is close.",
      ],
      answer: "50, 40 and 90.",
    },
    methodTitle: "Round, then add",
    methodText: [
      "Round first, then add. Adding first and then rounding the answer is a different job.",
      "Use the estimate to check an exact sum. If the two are far apart, look for a mistake.",
    ],
    formal:
      "Rounding 47 up to 50 adds 3. Rounding 36 up to 40 adds 4. So the estimate is 3 + 4 = 7 more than the exact sum: 90 = 83 + 7. To the nearest ten, each addend moves 5 or less, so the estimate is never more than 10 away from the exact sum.",
    pitfalls: [
      "Do not give the exact sum as the estimate.",
      "Do not round one addend to the nearest ten and the other to the nearest hundred.",
    ],
    parentGuide:
      "Ask whether the estimate seems close to the exact sum, and find how far apart they are.",
  },
  {
    id: "expanded-whole-slots",
    title: "Write a number as a sum of place values",
    senses: { part: "part", product: "product-multiply" },
    noLink: ["change"],
    goal: "Write a five-digit number as the sum of what each of its nonzero digits is worth.",
    summary:
      "A digit's place tells what it is worth. In 43,582 the 4 is worth 40,000. Writing a number as the sum of what its digits are worth is called expanded form: 40,000 + 3,000 + 500 + 80 + 2.",
    objectives: [
      "Find what each digit of a five-digit number is worth from its place.",
      "Write the number as the sum of those values, skipping digits that are 0.",
    ],
    intuition:
      "Each digit has a place: ones, tens, hundreds, thousands or ten thousands, counting from the right. A digit is worth the digit times its place. In 43,582 the 4 is in the ten thousands place, so it is worth 4 × 10,000 = 40,000. The 3 is worth 3,000, the 5 is worth 500, the 8 is worth 80 and the 2 is worth 2. Add those parts and you get the number back. Writing 43,582 as 40,000 + 3,000 + 500 + 80 + 2 is called expanded form. A digit 0 is worth nothing, so it adds no part. Write a part only for each nonzero digit, a digit that is not 0.",
    terms: [
      "expanded-form",
      [
        "place-value",
        "The value of a digit is the digit times its place value, such as $4 \\times 10{,}000$ for the 4 in 47,000.",
      ],
    ],
    method: [
      "Name the place of each digit, counting from the ones place at the right.",
      "Multiply each digit by the value of its place. Skip digits that are 0.",
      "Write the products as a sum, from the greatest place to the least.",
    ],
    watch:
      "Count the zeros. A digit in the thousands place is the digit followed by three zeros, like 3,000, not 300.",
    principle:
      "A number equals the sum of what its digits are worth: 50,308 = 50,000 + 300 + 8. A digit 0 is worth 0, so leaving it out does not change the sum.",
    example: {
      prompt: "Write 50,308 as a sum of the values of its digits.",
      steps: [
        "The digit 5 is in the ten thousands place, so it is worth $5\\times10{,}000=50{,}000$.",
        "The 0 in the thousands place is worth nothing, so it adds no part. The digit 3 is in the hundreds place, so it is worth $3\\times100=300$.",
        "The 0 in the tens place adds no part. The digit 8 is in the ones place, so it is worth 8. Check: $50{,}000+300+8=50{,}308$.",
      ],
      answer: "$50{,}000+300+8$.",
    },
    methodTitle: "Digit times place",
    methodText: [
      "Check the sum by adding the parts. It must give back the original number.",
      "A quick check: the first part starts with the same digit as the number and has as many digits.",
    ],
    formal:
      "Each digit is worth the digit times its place. The number is all those parts put together, so adding the parts gives the number back. There is only one way to split a number like this, with one part for each nonzero digit.",
    pitfalls: [
      "Do not write 3 hundreds as 30 or 3,000. Count the zeros of the place.",
      "A digit 0 has no part in the sum.",
    ],
    parentGuide:
      "Make cards for 10,000, 1,000, 100, 10 and 1. Build a number by laying out the cards each digit asks for.",
  },
  {
    id: "expanded-decimal-slots",
    title: "Write a decimal as a sum of place values",
    senses: { part: "part" },
    goal: "Write a decimal as the sum of what each nonzero digit is worth, including tenths and hundredths.",
    summary:
      "A decimal is a number with a decimal point, like 3,205.4. Digits right of the point are worth less than 1. Write the number as the sum of what each digit is worth: 3,000 + 200 + 5 + 0.4.",
    objectives: [
      "Find what a digit is worth in the places from thousands to hundredths.",
      "Write a decimal as a sum of these values, skipping digits that are 0.",
    ],
    intuition:
      "The decimal point sits just right of the ones place. The first place after the point is the tenths place. One tenth, written 0.1 or $\\frac{1}{10}$, is one of 10 equal parts of 1. The next place is the hundredths place. One hundredth, written 0.01 or $\\frac{1}{100}$, is one of 100 equal parts of 1. So a 4 in the tenths place is worth 4 tenths, 0.4. A 4 in the hundredths place is worth 4 hundredths, 0.04. Left of the point, the places are ones, tens, hundreds and thousands. Writing 3,205.4 as 3,000 + 200 + 5 + 0.4 adds up what each digit is worth. This is called expanded form. Skip any digit that is 0, because it is worth nothing.",
    terms: [
      [
        "place",
        "The tenths place is the first place right of the decimal point; each count there is worth 0.1.",
      ],
      [
        "place",
        "The hundredths place is the second place right of the decimal point; each count there is worth 0.01.",
      ],
    ],
    method: [
      "Name the place of each nonzero digit. Count left from the ones place, and right from the decimal point.",
      "Multiply the digit by the value of its place, such as $4\\times\\frac{1}{10}=0.4$.",
      "Write the values as a sum from the greatest to the least. Skip any digit that is 0.",
    ],
    watch:
      "A digit right of the decimal point is worth less than 1. A 4 in the tenths place is 0.4, not 4 and not 0.04.",
    principle:
      "A decimal equals the sum of what its digits are worth. Each digit is worth the digit times its place. The places right of the point are tenths, $\\frac{1}{10}$, and hundredths, $\\frac{1}{100}$.",
    example: {
      prompt: "Write 2,046.7 as a sum of the values of its digits.",
      steps: [
        "The digit 2 is in the thousands place, so it is worth $2\\times1{,}000=2{,}000$. The 0 in the hundreds place adds no part.",
        "The digit 4 is in the tens place, so it is worth $4\\times10=40$. The digit 6 is in the ones place, so it is worth 6.",
        "The digit 7 is just right of the point, in the tenths place, so it is worth $7\\times\\frac{1}{10}=0.7$. The sum is $2{,}000+40+6+0.7$.",
      ],
      answer: "$2{,}000+40+6+0.7$.",
    },
    methodTitle: "Left of the point and right of it",
    methodText: [
      "Each step to the right makes a place worth one tenth as much: ones, then tenths, then hundredths.",
      "Check the sum by adding the whole-number parts and the decimal parts separately.",
    ],
    formal:
      "Each place is worth 10 of the place on its right: 10 hundredths make a tenth, and 10 tenths make 1. So the places keep going past the point: ones, tenths, hundredths. A digit is worth the digit times its place, and the parts add up to the number.",
    pitfalls: [
      "Do not mix up tens and tenths. 40 and 0.4 are different parts.",
      "Do not give a digit 0 a part in the sum.",
    ],
    parentGuide:
      "Draw a chart with a column for each place, from thousands to hundredths. Write the decimal into it one digit at a time.",
  },
  {
    id: "compare-symbol-blanks",
    title: "Compare numbers with a symbol",
    senses: { part: "part", "standard form": "standard-form-number" },
    noLink: ["side", "faces"],
    goal: "Choose less than, equal to or greater than for each pair of whole numbers, adding up any number written as a sum first.",
    summary:
      "To compare two numbers means to find which is greater (bigger), or that they are equal (the same). Compare the digits from the left. A number written as a sum, like 3,000 + 400 + 80 + 2, must be added up first.",
    objectives: [
      "Choose less than, equal to or greater than by comparing digits from the left.",
      "See that a number written as a sum can equal a number written with digits.",
    ],
    intuition:
      "We show a comparison with a sign. The sign < means is less than, > means is greater than, and = means is equal to, the same amount. The open side of < or > faces the greater number. To compare two whole numbers, first count their digits. The number with more digits is greater. If they have the same number of digits, compare from the left, the biggest place. The first place where the digits differ decides. A number can be written as a sum of its parts: 3,000 + 400 + 80 + 2 is the same number as 3,482. Writing it with digits, like 3,482, is called standard form. Add the parts before you compare.",
    terms: ["less-than", "greater-than", "equal-sign"],
    method: [
      "Write both numbers with digits, adding the parts of any sum.",
      "Compare the number of digits. Then compare place by place from the left.",
      "Choose the sign that makes the statement true, and read it back in words.",
    ],
    watch:
      "Add the parts of a sum before comparing. Stop at the first place that differs, even if the last digits point the other way.",
    principle:
      "For two whole numbers, the one with more digits is greater. With the same number of digits, the first place from the left where the digits differ decides. If every digit matches, the numbers are equal.",
    example: {
      prompt: "Compare 2,507 with 2,000 + 500 + 70, and 6,184 with 6,148.",
      steps: [
        "Add the parts first: 2,000 + 500 + 70 = 2,570.",
        "Compare 2,507 with 2,570 from the left. The thousands match, and so do the hundreds. The tens are 0 and 7, so 2,507 is less than 2,570.",
        "6,184 and 6,148 match in the thousands and the hundreds. The tens are 8 and 4, so 6,184 is greater than 6,148.",
      ],
      answer: "2,507 < 2,000 + 500 + 70; 6,184 > 6,148.",
    },
    methodTitle: "First place that differs",
    methodText: [
      "If no part of a sum fills a place, that place gets a 0. So 4,000 + 30 + 2 is 4,032.",
      "If every digit matches, the numbers are equal, whichever way they are written.",
    ],
    formal:
      "Two numbers are equal when they are the same amount, however they are written. A number written with digits means the sum of what its digits are worth, so 3,482 and 3,000 + 400 + 80 + 2 are the same. With the same number of digits, the first place that differs decides. All the places to its right together are worth less than one more of that place: even 999 is less than 1,000.",
    pitfalls: [
      "Do not compare only the last digits.",
      "Do not call a sum and a number written with digits different just because they look different.",
    ],
    parentGuide:
      "Ask your learner to say both numbers aloud in words before choosing the sign.",
  },
  {
    id: "digit-value-blanks",
    title: "Compare the value of the same digit in two places",
    noLink: ["third"],
    goal: "A number has the same digit in two places. Find how many times as much the digit is worth in one place as in the other.",
    summary:
      "The same digit, other than 0, is worth more when it sits farther left. Each step left makes it worth 10 times as much. So count the steps between the two places.",
    objectives: [
      "Find what a digit is worth in each of two places.",
      "Tell how many times as much one value is as the other from the number of steps between the places.",
    ],
    intuition:
      "Each place is worth 10 times the place on its right. So a digit, other than 0, is worth 10 times as much each time it moves one place left. In 380,286 the left 8 is in the ten thousands place, so it is worth 80,000. The right 8 is in the tens place, so it is worth 80. From tens to ten thousands is 3 steps: tens to hundreds, hundreds to thousands, thousands to ten thousands. Each step multiplies by 10, so 3 steps multiply by 10 × 10 × 10 = 1,000. So 80,000 is 1,000 times as much as 80, which means 80 × 1,000 = 80,000. We can write 10 × 10 × 10 as $10^{3}$, read “10 to the third power.” The small 3 counts how many 10s are multiplied.",
    terms: [
      [
        "place-value",
        "The value of a digit is the digit times its place value, such as $4 \\times 10{,}000$ for the 4 in 47,000.",
      ],
      [
        "times-as-many",
        "80,000 is 1,000 times as great as 80 because 80 × 1,000 = 80,000.",
      ],
    ],
    method: [
      "Find the place of each of the two matching digits.",
      "Count the steps from one place to the other, one place at a time.",
      "Multiply that many 10s together: 2 steps is 100, 3 steps is 1,000, 4 steps is 10,000. Use it to complete the sentence.",
    ],
    watch:
      "Count the steps between the places, not the digits between them. One step apart is 10 times as much, and two steps apart is 100 times as much.",
    principle:
      "A digit other than 0 is worth 10 times as much one place to the left. So the same digit is worth 10 times as much for each step between its two places: 3 steps apart means 10 × 10 × 10 = 1,000 times as much.",
    example: {
      prompt:
        "In 280,284 the digit 8 appears in two places. How many times as great is the left 8 than the right 8?",
      steps: [
        "The left 8 is in the ten thousands place, so it is worth 80,000. The right 8 is in the tens place, so it is worth 80.",
        "Count the steps from tens to ten thousands: tens to hundreds, hundreds to thousands, thousands to ten thousands. That is 3 steps.",
        "Each step multiplies by 10, so 3 steps multiply by $10\\times10\\times10=1{,}000=10^{3}$. Check: $80{,}000\\div80=1{,}000$.",
      ],
      answer: "1,000 times as great.",
    },
    methodTitle: "Steps of ten",
    methodText: [
      "Check by dividing the greater value by the lesser one: $80{,}000\\div80=1{,}000$.",
      "The number of zeros in the answer equals the number of steps between the places.",
    ],
    formal:
      "The left 8 is worth 8 × 10,000 and the right 8 is worth 8 × 10. The digits are the same, so only the places matter: 10,000 is 1,000 times 10. That is why only the number of steps counts, not which digit it is. This works for every digit except 0, which is worth 0 in any place.",
    pitfalls: [
      "Do not subtract the values. 80,000 − 80 = 79,920 tells how much more, not how many times as much.",
      "Do not count the digits between the 8s. Count the steps from one 8 to the other.",
    ],
    parentGuide:
      "Write the number in a place-value chart. Draw a “times 10” arrow for each step from the lower 8 to the higher one.",
  },
];

const built = formatLessons(entries);
export const placeValueBlanksLessons = built.lessons;
export const placeValueBlanksMethods = Object.fromEntries(
  entries.map((e) => [
    e.id,
    { ...built.methods[e.id]!, ...(e.goal ? { goal: e.goal } : {}) },
  ]),
);
export const placeValueBlanksPrinciples = built.principles;

export const placeValueBlanksFacetMappings: readonly FacetMapping[] = [
  {
    templateId: "digit-place-names",
    facetId: "large-place-value.digit-value-and-comparison",
    extent: "partial",
    rationale:
      "Name the place (ones to hundred thousands) of each digit of a five- or six-digit number with all different digits, one choice per digit. Does not assess numbers with repeated digits, words for numbers, or naming a digit's value.",
  },
  {
    templateId: "round-place-blanks",
    facetId: "round-whole-numbers.nearest-ten-hundred",
    extent: "partial",
    rationale:
      "Round one four-digit number to the nearest thousand, hundred and ten, as three slots or a sentence, with truncation, the opposite direction and a neighboring place as distractors. Does not assess numbers with more digits, rounding on a number line, or explaining why.",
  },
  {
    templateId: "round-decimal-blanks",
    facetId: "decimal-place-value.core",
    extent: "partial",
    rationale:
      "Round a decimal with thousandths to the nearest tenth and the nearest hundredth by choosing both numbers, including carries across a 9. Does not assess rounding to a whole number, numbers beyond thousandths, or rounding in a context.",
  },
  {
    templateId: "round-addends-sum",
    facetId: "round-whole-numbers.nearest-ten-hundred",
    extent: "partial",
    rationale:
      "Round two addends to the nearest ten or hundred and choose the rounded addends and their sum, with the exact sum as a distractor. Does not assess estimating differences, products or a context story, or judging whether an estimate is reasonable.",
  },
  {
    templateId: "expanded-whole-slots",
    facetId: "large-place-value.digit-value-and-comparison",
    extent: "partial",
    rationale:
      "Write a five-digit number as a sum by choosing the value, or the digit times its place, of each nonzero digit, with or without a zero digit and with place-shift distractors. Does not assess numbers over five digits, reading expanded form aloud, or writing the sum by dragging.",
  },
  {
    templateId: "expanded-decimal-slots",
    facetId: "decimal-place-value.core",
    extent: "partial",
    rationale:
      "Write a decimal with thousands to hundredths digits as a sum by choosing the value, or the digit times its place, of each nonzero digit, with place-shift distractors. Does not assess decimals beyond hundredths, fraction forms of the parts, or writing the sum by dragging.",
  },
  {
    templateId: "compare-symbol-blanks",
    facetId: "large-place-value.digit-value-and-comparison",
    extent: "partial",
    rationale:
      "Choose less than, equal to or greater than for two comparisons of whole numbers of three to five digits, one pair equal in standard and expanded form and one pair that differs at a leading place with misleading trailing digits. Does not assess comparing three numbers, decimals or words for numbers.",
  },
  {
    templateId: "digit-value-blanks",
    facetId: "powers-of-ten.core",
    extent: "partial",
    rationale:
      "In a six-digit number with an 8 in two places two, three or four places apart, choose the place of the greater 8 and how many times as great its value is. Does not assess other digits, decimal places, or explaining the pattern with exponents.",
  },
];
