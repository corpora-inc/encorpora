import type { FacetMapping } from "./coverage";
import { formatLessons, type FormatLessonEntry } from "./format-lesson-entry";

const entries: FormatLessonEntry[] = [
  {
    id: "digit-place-names",
    title: "Name the place of each digit",
    summary:
      "Each digit of a whole number sits in one place; count the places from the right to name it.",
    objectives: [
      "Name the place of a digit in a number with up to six digits, from ones to hundred thousands.",
      "Say what a digit is worth from its place.",
    ],
    intuition:
      "A whole number is written with digits, and the place of a digit tells how much it is worth. The rightmost place is the ones place. Each place to the left is worth ten times the place to its right: tens, hundreds, thousands, ten thousands, hundred thousands. In 804,516 the digit 8 is in the hundred thousands place, so it stands for 800,000.",
    terms: [
      ["place", "The position of a digit in a number, such as tens or thousands."],
      [
        "place value",
        "What a digit is worth because of its place: the digit times the value of the place.",
      ],
    ],
    method: [
      "Start at the rightmost digit and call its place ones.",
      "Move left one digit at a time, saying tens, hundreds, thousands, ten thousands, hundred thousands.",
      "Match each digit with the place you reach.",
    ],
    watch:
      "Count from the right, not the left: the leftmost digit is in the highest place, which depends on how many digits the number has.",
    principle:
      "In a base-ten numeral, a digit in the place that is $k$ steps left of the ones place is worth the digit times $10^{k}$. The digits of a number are therefore named by counting places from the ones place.",
    example: {
      prompt: "Name the place of each digit of 603,481.",
      steps: [
        "The rightmost digit, 1, is in the ones place; moving left, 8 is in the tens place and 4 in the hundreds place.",
        "Continuing left, 3 is in the thousands place, 0 in the ten thousands place and 6 in the hundred thousands place.",
        "The digit 6 is worth 600,000 and the digit 0 is worth nothing.",
      ],
      answer: "6: hundred thousands; 0: ten thousands; 3: thousands; 4: hundreds; 8: tens; 1: ones.",
    },
    methodTitle: "Count places from the ones",
    methodText: [
      "Write the place names under the digits from right to left, then read each pair.",
      "Check by value: a digit in the hundreds place is worth that digit times 100.",
    ],
    formal:
      "A numeral $d_{k}d_{k-1}\\ldots d_1d_0$ stands for $d_k\\cdot 10^{k}+\\ldots+d_1\\cdot 10+d_0$. The place of $d_i$ is named by $10^{i}$: ones for $10^0$, tens for $10^1$, hundreds for $10^2$, thousands for $10^3$, ten thousands for $10^4$ and hundred thousands for $10^5$.",
    pitfalls: [
      "Do not name the places from the left; a five-digit number has no hundred thousands place.",
      "A digit 0 still has a place. It holds the place and is worth nothing.",
    ],
    parentGuide:
      "Write the place names on a strip of paper and slide it under the number with the word ones at the rightmost digit.",
  },
  {
    id: "round-place-blanks",
    title: "Round a number to different places",
    summary:
      "Round a four-digit number to the nearest thousand, hundred and ten by looking at the next digit.",
    objectives: [
      "Round a four-digit number to the nearest ten, hundred and thousand.",
      "Tell rounding from cutting off digits.",
    ],
    intuition:
      "Rounding replaces a number by the nearest multiple of a place, such as the nearest hundred. To decide, look at the digit one place to the right. If it is 5 or more, the number is at least halfway to the next multiple, so round up; if it is less than 5, round down. Each place gives a different answer for the same number, so every place needs its own look.",
    terms: [
      [
        "round up",
        "Increase the digit in the rounding place by one and change the digits to its right to zero.",
      ],
      [
        "round down",
        "Keep the digit in the rounding place and change the digits to its right to zero.",
      ],
    ],
    method: [
      "Find the rounding place (ten, hundred or thousand).",
      "Look at the digit just to its right: 5 or more rounds up, less than 5 rounds down.",
      "Write the number with zeros in every place to the right of the rounding place. Repeat for the next place.",
    ],
    watch:
      "Look at the digit right next to the rounding place, not at the last digit, and round up when that digit is exactly 5.",
    principle:
      "To round $n$ to the nearest multiple of $10^k$, find the multiples $a\\le n<a+10^k$ on each side. The nearer one is the result, and $n$ is halfway when it is $a+5\\cdot10^{k-1}$, which is rounded up by convention.",
    example: {
      prompt: "Round 4,758 to the nearest thousand, hundred and ten.",
      steps: [
        "Nearest thousand: the hundreds digit is 7, which is 5 or more, so round up to 5,000.",
        "Nearest hundred: the tens digit is 5, so round up to 4,800.",
        "Nearest ten: the ones digit is 8, so round up to 4,760.",
      ],
      answer: "5,000; 4,800; 4,760.",
    },
    methodTitle: "One look for each place",
    methodText: [
      "Do the three roundings separately from the original number. Do not round the rounded result again.",
      "Check each result: it must end in the right number of zeros and be within half a place of the number.",
    ],
    formal:
      "For $a\\le n<a+10^{k}$ with $a$ a multiple of $10^{k}$, $n$ rounds to $a$ if $n-a<\\tfrac{1}{2}\\cdot10^{k}$ and to $a+10^{k}$ if $n-a\\ge\\tfrac12\\cdot10^k$. The digit right of the rounding place decides the comparison because it is at least $5\\cdot10^{k-1}$ exactly when $n-a\\ge\\tfrac12\\cdot10^k$.",
    pitfalls: [
      "Cutting off digits is not rounding: 4,758 cut at the tens is 4,750, but it rounds to 4,760.",
      "Do not round in steps: rounding 4,758 to 4,760 and then to 4,800 gives the same here, but 4,449 rounded in steps would reach 4,500 instead of 4,400.",
    ],
    parentGuide:
      "Ask your learner which two multiples of the place the number sits between, then which of the two is closer.",
  },
  {
    id: "round-decimal-blanks",
    title: "Round a decimal to two places",
    summary:
      "Round a decimal to the nearest tenth and the nearest hundredth by checking the digit one place to the right.",
    objectives: [
      "Round a decimal with thousandths to the nearest tenth and to the nearest hundredth.",
      "Carry correctly when a rounded digit is 9.",
    ],
    intuition:
      "Rounding a decimal works like rounding a whole number. For the nearest tenth, look at the hundredths digit; for the nearest hundredth, look at the thousandths digit. Digits of 5 or more round up and digits under 5 round down. When a 9 rounds up it becomes 0 and adds 1 to the digit on its left, as in 4.396 rounding to 4.40 at the hundredth.",
    terms: [
      ["tenth", "One of ten equal parts of 1, written 0.1."],
      ["hundredth", "One of one hundred equal parts of 1, written 0.01."],
    ],
    method: [
      "Name the rounding place and look at the digit just to its right.",
      "If that digit is 5 or more, add 1 to the digit in the rounding place (carrying if it is 9); otherwise leave it.",
      "Drop the digits to the right. Do the second rounding from the original decimal.",
    ],
    watch:
      "Round each place from the original number. 4.396 to the nearest tenth is 4.4, not the result of rounding 4.40 again.",
    principle:
      "To round a decimal to the nearest $10^{-k}$, replace it by the multiple of $10^{-k}$ it is closest to, rounding a number exactly halfway between up. The digit in the next place, $5$ or more, shows that the number is at least halfway.",
    example: {
      prompt: "Round 6.274 to the nearest tenth and the nearest hundredth.",
      steps: [
        "Nearest tenth: the hundredths digit is 7, which is 5 or more, so the tenths digit 2 goes up to 3: 6.3.",
        "Nearest hundredth: the thousandths digit is 4, which is under 5, so the hundredths digit 7 stays: 6.27.",
      ],
      answer: "6.3 and 6.27.",
    },
    methodTitle: "Look right, then carry",
    methodText: [
      "A 9 that rounds up carries: 3.96 to the nearest tenth is 4.0, and the number is written 4 or 4.0.",
      "The two answers can differ in more than the last digit, so check each against the original.",
    ],
    formal:
      "Writing $x=m\\cdot10^{-k}+t$ with $m$ an integer and $0\\le t<10^{-k}$, the nearest multiple of $10^{-k}$ is $m\\cdot 10^{-k}$ if $t<\\tfrac12\\cdot 10^{-k}$ and $(m+1)\\cdot10^{-k}$ otherwise. The first digit of $t$ is at least 5 exactly when $t\\ge\\tfrac12\\cdot10^{-k}$.",
    pitfalls: [
      "Do not cut the digits off: 2.678 cut at the hundredths is 2.67 but rounds to 2.68.",
      "When the digit rounds from 9, carry into the next place instead of writing 10.",
    ],
    parentGuide:
      "Put the decimal on a number line between two tenths and ask which tenth it is closer to.",
  },
  {
    id: "round-addends-sum",
    title: "Estimate a sum by rounding",
    summary:
      "Round each addend to the same place, then add the rounded numbers to estimate a sum.",
    objectives: [
      "Round two addends to the nearest ten or hundred.",
      "Add the rounded numbers to get an estimate and tell it from the exact sum.",
    ],
    intuition:
      "An estimate is a quick answer that is close to the exact one. To estimate a sum, round each addend to the same place and add the rounded numbers, which is easy to do in your head. The result is close to the exact sum but usually not equal to it.",
    terms: [
      ["addend", "A number that is added."],
      ["estimate", "An answer that is close to the exact answer and easier to find."],
    ],
    method: [
      "Round the first addend to the stated place by looking at the digit to its right.",
      "Round the second addend the same way.",
      "Add the two rounded numbers. This sum is the estimate.",
    ],
    watch:
      "Add the rounded numbers, not the original ones, and round both addends to the same place.",
    principle:
      "If $a$ rounds to $a'$ and $b$ rounds to $b'$ to the same place, then $a'+b'$ differs from $a+b$ by at most the sum of the two rounding errors, each at most half the place value.",
    example: {
      prompt: "Estimate 47 + 36 by rounding each addend to the nearest ten.",
      steps: [
        "47 has 7 in the ones place, so it rounds up to 50.",
        "36 has 6 in the ones place, so it rounds up to 40.",
        "The estimate is 50 + 40 = 90. The exact sum is 83.",
      ],
      answer: "50, 40 and 90.",
    },
    methodTitle: "Round, then add",
    methodText: [
      "Do the rounding before the adding. Adding first and rounding the result is a different calculation.",
      "Use the estimate to check an exact sum: the two should be close.",
    ],
    formal:
      "With rounding errors $e_a=a'-a$ and $e_b=b'-b$, each of size at most $\\tfrac12\\cdot10^k$, the estimate is $a'+b'=(a+b)+(e_a+e_b)$ with $|e_a+e_b|\\le 10^k$.",
    pitfalls: [
      "Do not use the exact sum as the estimate.",
      "Do not round one addend to the ten and the other to the hundred.",
    ],
    parentGuide:
      "Ask if the estimate seems close to the exact sum, and check how far apart they are.",
  },
  {
    id: "expanded-whole-slots",
    title: "Write a number as a sum of place values",
    summary:
      "Write a five-digit number as the sum of what each of its nonzero digits is worth.",
    objectives: [
      "Find the value of each digit of a five-digit number from its place.",
      "Write the number as the sum of those values, skipping digits that are 0.",
    ],
    intuition:
      "A number is the sum of what its digits are worth. The digit 4 in the ten thousands place is worth 40,000, the digit 3 in the thousands place is 3,000, and so on. Writing 43,582 as 40,000 + 3,000 + 500 + 80 + 2 is expanded form. A digit 0 is worth nothing, so it leaves no term in the sum.",
    terms: [
      [
        "expanded form",
        "A number written as the sum of the values of its digits.",
      ],
      [
        "value of a digit",
        "The digit times the value of its place, such as $4\\times 10{,}000$.",
      ],
    ],
    method: [
      "Name the place of each digit, counting from the ones place.",
      "Multiply each digit by the value of its place. Skip digits that are 0.",
      "Write the products as a sum, from the greatest place to the least.",
    ],
    watch:
      "Check the number of zeros: a digit in the thousands place is the digit followed by three zeros, not two.",
    principle:
      "A numeral $d_4d_3d_2d_1d_0$ equals $d_4\\cdot10^4+d_3\\cdot10^3+d_2\\cdot10^2+d_1\\cdot10+d_0$. Adding the parts reproduces the number, and a part with digit 0 equals 0.",
    example: {
      prompt: "Write 50,308 as a sum of the values of its digits.",
      steps: [
        "The digit 5 is in the ten thousands place: $5\\times10{,}000=50{,}000$.",
        "The digit 0 in the thousands place adds nothing. The digit 3 is in the hundreds place: $3\\times100=300$.",
        "The digit 0 in the tens place adds nothing, and the digit 8 in the ones place is 8, so $50{,}000+300+8=50{,}308$.",
      ],
      answer: "$50{,}000+300+8$.",
    },
    methodTitle: "Digit times place",
    methodText: [
      "Check the sum by adding the parts: it must give back the original number.",
      "A digit alone gives a fast check: the first part has the same leading digit as the number.",
    ],
    formal:
      "The base-ten place-value representation of an integer is unique, so the parts $d_i\\cdot10^i$ with $d_i\\ne0$ are determined by the number and sum to it.",
    pitfalls: [
      "Do not write 3 hundreds as 30 or 3,000; count the zeros of the place.",
      "A digit 0 has no part in the sum.",
    ],
    parentGuide:
      "Make place-value cards of 10,000, 1,000, 100, 10 and 1 and build the number by stacking the cards that match each digit.",
  },
  {
    id: "expanded-decimal-slots",
    title: "Write a decimal as a sum of place values",
    summary:
      "Write a decimal as the sum of what each nonzero digit is worth, including tenths and hundredths.",
    objectives: [
      "Find the value of a digit in the thousands through hundredths places.",
      "Write a decimal as a sum of these values, skipping digits that are 0.",
    ],
    intuition:
      "Places to the right of the decimal point are worth less. The tenths place is worth one tenth, written 0.1, and the hundredths place is worth one hundredth, 0.01. So the digit 4 in the tenths place is worth 0.4, and the digit 4 in the hundredths place is worth 0.04. Writing 3,205.4 as 3,000 + 200 + 5 + 0.4 adds up the worth of each digit.",
    terms: [
      ["tenths place", "The first place right of the decimal point, worth 0.1 for each count."],
      ["hundredths place", "The second place right of the decimal point, worth 0.01 for each count."],
    ],
    method: [
      "Name the place of each nonzero digit, counting left from the ones place and right from the decimal point.",
      "Multiply the digit by the value of its place, such as $4\\times\\frac{1}{10}=0.4$.",
      "Write the values as a sum from the greatest to the least. Skip any digit that is 0.",
    ],
    watch:
      "A digit right of the decimal point is worth less than the digit alone: 4 in the tenths place is 0.4, not 4 and not 0.04.",
    principle:
      "A decimal $d_k\\ldots d_0.d_{-1}d_{-2}$ equals the sum of $d_i\\cdot10^{i}$ over all places, where $10^{-1}=\\frac{1}{10}$ and $10^{-2}=\\frac{1}{100}$.",
    example: {
      prompt: "Write 2,046.7 as a sum of the values of its digits.",
      steps: [
        "The digit 2 is in the thousands place: $2\\times1{,}000=2{,}000$. The digit 0 in the hundreds place adds nothing.",
        "The digit 4 is in the tens place: $4\\times10=40$, and the digit 6 in the ones place is 6.",
        "The digit 7 is in the tenths place: $7\\times\\frac{1}{10}=0.7$. The sum is $2{,}000+40+6+0.7$.",
      ],
      answer: "$2{,}000+40+6+0.7$.",
    },
    methodTitle: "Left of the point and right of it",
    methodText: [
      "Each step to the right of a place divides its value by 10: ones, tenths, hundredths.",
      "Check the sum by adding the whole-number parts and the decimal parts separately.",
    ],
    formal:
      "Positional notation extends to negative powers of ten: $0.d_1d_2=\\frac{d_1}{10}+\\frac{d_2}{100}$, so a digit's value is the digit times $10^{i}$ for place index $i$, negative to the right of the point.",
    pitfalls: [
      "Do not confuse tens with tenths: 40 and 0.4 are different parts.",
      "Do not give a digit 0 a part in the sum.",
    ],
    parentGuide:
      "Use a place-value chart with a column for each place and write the decimal into it one digit at a time.",
  },
  {
    id: "compare-symbol-blanks",
    title: "Compare numbers with a symbol",
    summary:
      "Compare whole numbers from the left, or add an expanded form first, then choose less than, equal to or greater than.",
    objectives: [
      "Choose less than, equal to or greater than by comparing digits from the left.",
      "Recognize that a number written as a sum can equal a number in standard form.",
    ],
    intuition:
      "Two whole numbers are compared by their digits from the left. With the same number of digits, the first place that differs decides which is greater. A number can be written in different ways: 3,000 + 400 + 80 + 2 is the same number as 3,482. Rewrite a sum as a standard number before comparing, and use an equal sign when the numbers are the same.",
    terms: [
      ["<", "Is less than: the small end points at the lesser number."],
      [">", "Is greater than: the open end faces the greater number."],
      ["=", "Is equal to: both sides name the same number."],
    ],
    method: [
      "Write both numbers in standard form, adding the parts of any sum.",
      "Compare the number of digits, then compare place by place from the left.",
      "Choose the symbol that makes the statement true and read it back in words.",
    ],
    watch:
      "Add the parts of an expanded sum before comparing. Reading digits left to right stops at the first difference, even if the last digits point the other way.",
    principle:
      "For whole numbers, $a<b$ when $a$ has fewer digits than $b$, or when they have the same number of digits and $a$ has the lesser digit in the leftmost place where they differ. $a=b$ when all their digits agree.",
    example: {
      prompt: "Compare 2,507 with 2,000 + 500 + 70, and 6,184 with 6,148.",
      steps: [
        "2,000 + 500 + 70 is 2,570. Compare with 2,507: the hundreds digits are 5 and 5, the tens digits 0 and 7, so 2,507 is less than 2,570.",
        "6,184 and 6,148 agree in the thousands and hundreds places. The tens digits are 8 and 4, so 6,184 is greater than 6,148.",
      ],
      answer: "2,507 < 2,000 + 500 + 70; 6,184 > 6,148.",
    },
    methodTitle: "First place that differs",
    methodText: [
      "A sum like 400 + 30 + 2 has a digit 0 in a place that no part fills; write it as 432 before you compare.",
      "If every digit agrees, the numbers are equal, whatever form they are written in.",
    ],
    formal:
      "Numbers are equal when they have the same value, regardless of how they are written. For positive integers in base ten, the place-value representation is unique, so equal numbers have the same digits in every place.",
    pitfalls: [
      "Do not compare only the last digits.",
      "Do not call a sum and a standard number different because they look different.",
    ],
    parentGuide:
      "Ask your learner to say both numbers aloud in words before choosing the symbol.",
  },
  {
    id: "digit-value-blanks",
    title: "Compare the value of the same digit in two places",
    summary:
      "The same digit in two places has values that differ by a power of ten; count the places between them.",
    objectives: [
      "Find the value of a digit in each of two places.",
      "Tell how many times as great one value is than the other from the number of places between them.",
    ],
    intuition:
      "A digit is worth more in a place farther to the left, because each place is worth ten times the one to its right. In 380,286 the 8 on the left is worth 80,000 and the 8 on the right is worth 80. The first is 1,000 times the second, because the places are three steps apart and each step multiplies by 10.",
    terms: [
      ["value of a digit", "The digit times the value of its place."],
      [
        "times as great",
        "A comparison by multiplying: 80,000 is 1,000 times as great as 80.",
      ],
    ],
    method: [
      "Find the place of each of the two equal digits.",
      "Count the places between them, one step at a time.",
      "Multiply 10 by itself that many times (2 steps: 100, 3 steps: 1,000, 4 steps: 10,000) and complete the sentence.",
    ],
    watch:
      "Count the steps between the places, not the number of digits between them: neighbors differ by 10, and two steps apart differ by 100.",
    principle:
      "The same digit $d$ in places $10^{i}$ and $10^{j}$ has values $d\\cdot10^i$ and $d\\cdot10^j$, and the ratio of the greater to the lesser is $10^{\\,i-j}$.",
    example: {
      prompt: "In 280,284 the digit 8 appears in two places. How many times as great is the left 8 than the right 8?",
      steps: [
        "The left 8 is in the ten thousands place, so it is worth 80,000. The right 8 is in the tens place, so it is worth 80.",
        "The places are three steps apart (tens, hundreds, thousands, ten thousands is three steps).",
        "$80{,}000\\div80=1{,}000=10^{3}$.",
      ],
      answer: "1,000 times as great.",
    },
    methodTitle: "Steps of ten",
    methodText: [
      "Check by dividing the greater value by the lesser: $80{,}000\\div80=1{,}000$.",
      "The count of zeros in the multiplier equals the number of steps between the places.",
    ],
    formal:
      "For a digit $d\\ne0$, $\\dfrac{d\\cdot10^{i}}{d\\cdot10^{j}}=10^{\\,i-j}$, so the multiplier depends only on the distance between the places.",
    pitfalls: [
      "Do not use the difference of the values (79,920) as the number of times.",
      "Do not count the digits strictly between the 8s; count the steps from one 8 to the other.",
    ],
    parentGuide:
      "Write the number in a place-value chart and draw an arrow of 'times 10' for each step from the lower 8 to the higher one.",
  },
];

const built = formatLessons(entries);
export const placeValueBlanksLessons = built.lessons;
export const placeValueBlanksMethods = built.methods;
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
