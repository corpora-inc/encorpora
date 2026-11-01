import type { GlossarySenses, MethodTerm } from "../glossary/types";
import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

const multiplySenses: GlossarySenses = {
  factor: "factor-number",
  product: "product-multiply",
  multiple: "multiple",
};

export const multiplyDivideLessons: Lesson[] = [
  {
    id: "multiply-by-tens",
    title: "Multiply by a multiple of ten",
    summary:
      "A multiple of ten is a number you reach by counting by tens: 10, 20, 30 and so on. Seventy is 7 tens. So 6 × 70 means 6 groups of 7 tens. The fact 6 × 7 = 42 tells you that makes 42 tens. Forty-two tens is 420.",
    templateIds: ["multiply-by-tens"],
    senses: multiplySenses,
    objectives: [
      "Multiply a one-digit number (a number from 0 to 9) by a multiple of ten, using a times-table fact.",
      "Explain the answer as a number of tens.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Count groups of tens",
        paragraphs: [
          "A ten-rod is a stick of 10 small cubes joined together. Seven ten-rods make 70, so 70 is 7 tens.",
          "Now take 6 groups of 70. That is 6 groups of 7 ten-rods. You know 6 groups of 7 make 42. So there are 42 ten-rods, or 42 tens.",
          "The answer to a multiplication is called the product. Here the product is 42 tens, and 42 tens is 420.",
        ],
      },
      {
        title: "Count tens",
        paragraphs: [
          "Look at the picture: 6 groups, each with 7 ten-rods. Count the rods and you get 42 tens.",
          "It works just like 6 groups of 7 ones, which make 42 ones. Only the size of each piece changed, from one to ten.",
          "Forty-two tens is 420. Here is why: 40 tens make 400, and 2 tens make 20. Then 400 + 20 = 420.",
        ],
        illustration: "multiply-tens-groups",
      },
      {
        title: "Keep every zero",
        paragraphs: [
          "A times-table fact is a multiplication you know, like 5 × 4 = 20. Find the fact first. Then turn its answer into tens.",
          "For 5 × 40, the fact is 5 × 4 = 20. So 5 × 40 is 20 tens, and 20 tens is 200.",
          "The answer 200 has two zeros. One zero comes from the fact's answer, 20. The other comes from counting tens. Keep both.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Multiplying tens",
        paragraphs: [
          "Let $a$ and $b$ stand for whole numbers. Then $a$ tens are worth $10 \\times a$. Taking $b$ groups of them gives $b \\times (10 \\times a) = (b \\times a) \\times 10$. So multiply $b \\times a$ first, then name that many tens.",
        ],
      },
    ],
    workedExample: {
      prompt: "What is 8 × 50?",
      steps: [
        "50 is 5 tens, so 8 × 50 means 8 groups of 5 tens.",
        "Use the fact 8 × 5 = 40. So there are 40 tens.",
        "Each ten is worth 10, so 40 tens is 40 × 10 = 400.",
      ],
      answer: "400",
    },
    pitfalls: [
      "When the fact already ends in zero, keep that zero too: 5 × 40 = 200, not 20.",
      "Remember that you counted tens. 6 × 70 is 42 tens, which is 420, not 42.",
    ],
    parentGuide:
      "Use bundles of 10 sticks or ten-rods. Build 3 groups of 4 tens. Ask how many tens there are, then how many sticks in all.",
  },
  {
    id: "multiply-partial-products",
    title: "Multiply with partial products",
    summary:
      "To multiply a big number, split it into easy parts by place value. Place value means a digit's worth depends on its place: the 4 in 46 means 4 tens, or 40. So 46 is 40 + 6. Multiply each part, then add the answers. Each part's answer is called a partial product.",
    templateIds: ["multiply-by-one-digit", "area-model-product"],
    senses: multiplySenses,
    objectives: [
      "Multiply a number with up to four digits by a one-digit number (a number from 0 to 9).",
      "Use an area model, a rectangle split into smaller rectangles, to multiply two two-digit numbers.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Break a big group into easy parts",
        paragraphs: [
          "Say you have 3 bags with 46 marbles in each. 46 is 40 + 6, so each bag holds 40 marbles and 6 more.",
          "The 40s make 3 × 40 = 120. The 6s make 3 × 6 = 18. Together that is 120 + 18 = 138 marbles. So 3 × 46 = 138.",
          "Every marble is counted once. None is left out, and none is counted twice. That is why the total is right.",
        ],
      },
      {
        title: "Split by place value",
        paragraphs: [
          "A factor is one of the numbers you multiply. In 46 × 23, the factors are 46 and 23. Split each factor by place value: 46 = 40 + 6 and 23 = 20 + 3.",
          "An area model shows this with a rectangle. The area of a rectangle is the space it covers. You find it by multiplying its width by its height.",
          "Look at the picture: a 46 by 23 rectangle cut into four smaller rectangles. Their areas are 40 × 20 = 800, 6 × 20 = 120, 40 × 3 = 120 and 6 × 3 = 18.",
        ],
        illustration: "area-model-product",
      },
      {
        title: "Add the partial products",
        paragraphs: [
          "The four small rectangles fill the big one with no gaps and no overlaps. So their areas add up to the whole area: 800 + 120 + 120 + 18 = 1,058. That means 46 × 23 = 1,058.",
          "When one factor has just one digit, there is one row of parts. For 1,248 × 4, split 1,248 into 1,000 + 200 + 40 + 8. Multiply each part by 4 and add: 4,000 + 800 + 160 + 32 = 4,992.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "The distributive property",
        paragraphs: [
          "A sum is the answer to an addition. Multiplying a sum gives the same answer as multiplying each part and adding: $6 \\times (40 + 7) = 6 \\times 40 + 6 \\times 7 = 240 + 42 = 282$. With letters, $a \\times (b + c) = a \\times b + a \\times c$. This rule is called the distributive property. Splitting a factor by place value uses it.",
        ],
      },
    ],
    workedExample: {
      prompt: "What is 357 × 6?",
      steps: [
        "Split 357 by place value: 300 + 50 + 7. Each part is easy to multiply.",
        "Multiply each part by 6: 300 × 6 = 1,800, 50 × 6 = 300 and 7 × 6 = 42. These are the partial products.",
        "The parts make 357, so add their products: 1,800 + 300 + 42 = 2,142.",
      ],
      answer: "2142",
    },
    pitfalls: [
      "In an area model, every small rectangle counts. 46 × 23 needs four products, including the two mixed ones, 6 × 20 and 40 × 3.",
      "Multiply what each digit is worth, not the digit alone: the 4 in 46 means 40.",
    ],
    parentGuide:
      "Draw a rectangle for 23 × 14 on squared paper. Split it at 20 across and at 10 down. Find each of the four parts, then add them.",
  },
  {
    id: "multiply-multidigit",
    title: "Multiply multidigit numbers",
    summary:
      "To multiply 346 × 27, split 27 into 20 + 7. Find 346 × 7 and 346 × 20, then add the two answers. Each of those answers is called a partial product. The whole answer is called the product.",
    templateIds: ["multiply-multidigit"],
    senses: multiplySenses,
    objectives: [
      "Multiply a two- or three-digit number by a two-digit number with the standard algorithm, the usual written method.",
      "Check a product with an estimate, a close answer made with rounded numbers.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Split one factor into its places",
        paragraphs: [
          "Say there are 27 boxes with 346 pencils in each. 27 boxes are 20 boxes and 7 more boxes.",
          "Find the pencils in 7 boxes. Find the pencils in 20 boxes. Add them to get the pencils in all 27 boxes.",
          "Written multiplication keeps these two answers in separate rows. Then it adds the rows.",
        ],
      },
      {
        title: "One row for each digit",
        paragraphs: [
          "Look at the picture of 346 × 27. The first row is 346 × 7 = 2,422. It uses the ones digit of 27, which is 7.",
          "The second row is 346 × 20 = 6,920. It uses the tens digit, 2, which means 2 tens or 20. It ends in 0 because 346 × 2 tens is 692 tens.",
          "Add the rows to get the product: 2,422 + 6,920 = 9,342.",
          "To regroup means to trade 10 of one place for 1 of the next place, like 10 ones for 1 ten. In 346 × 7, first 6 × 7 = 42 ones. Write 2 ones and carry 4 tens. Then 4 × 7 = 28 tens, and the 4 carried tens make 32 tens.",
        ],
        illustration: "standard-algorithm-product",
      },
      {
        title: "Estimate to check",
        paragraphs: [
          "An estimate is a close answer that is not exact. To round a number means to change it to a nearby easy number, like 346 to 350.",
          "Round each factor: 346 × 27 is about 350 × 30 = 10,500. The answer 9,342 is close to that. An answer like 934 or 93,420 is far off, so it must be wrong.",
          "A zero in a factor still holds its place. In 305, the 0 shows there are no tens. So 305 means 3 hundreds and 5 ones, and 305 × 42 = 12,810.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Place-value partial products",
        paragraphs: [
          "Each digit of a whole number stands for an amount set by its place: in 27, the 2 stands for 20 and the 7 stands for 7. To multiply, multiply the other factor by each of these amounts, then add the partial products. A tens digit stands for a multiple of 10, so its partial product always ends in 0.",
        ],
      },
    ],
    workedExample: {
      prompt: "What is 208 × 34?",
      steps: [
        "Split 34 into its tens and ones, 30 + 4. Each part is easier to multiply.",
        "Ones row: 208 × 4 = 832.",
        "Tens row: 208 × 30 = 6,240. It ends in 0 because 30 is 3 tens.",
        "The parts make 34, so add the rows: 832 + 6,240 = 7,072.",
        "Check with an estimate: 200 × 34 = 6,800. That is close to 7,072, so the answer makes sense.",
      ],
      answer: "7072",
    },
    pitfalls: [
      "The tens row is multiplied by tens, so it ends in 0. In 208 × 34, the tens row is 208 × 30 = 6,240, not 624.",
      "Multiply first, then add the carried digit. In 346 × 7, find 4 × 7 = 28 tens, then add the 4 carried tens to get 32 tens.",
    ],
    parentGuide:
      "Before multiplying, ask for an estimate. Afterward, compare the answer with the estimate. Talk about any big difference.",
  },
  {
    id: "divide-by-one-digit",
    title: "Divide by a one-digit number",
    summary:
      "To divide means to split a number into equal groups. For 1,476 ÷ 6, ask how many groups of 6 fit in 1,476. Take away big, easy groups first, like 200 groups of 6. Then take smaller groups from what is left. Add up the groups you took to get the answer.",
    templateIds: ["divide-by-one-digit", "division-remainder"],
    objectives: [
      "Divide a number with up to four digits by a one-digit number (a number from 1 to 9).",
      "Find the remainder, the amount left over, and check that it is less than the number you divide by.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Take big groups first",
        paragraphs: [
          "The number you divide by is called the divisor. The number being divided is called the dividend. The answer is called the quotient. In 1,476 ÷ 6 = 246, the dividend is 1,476, the divisor is 6 and the quotient is 246.",
          "Think of 1,476 counters to put into groups of 6. Making one group at a time would take a very long time.",
          "Instead, take hundreds of groups at once, then tens of groups, then single groups. Add up how many groups you took. That total is the quotient.",
        ],
      },
      {
        title: "Take away groups by place",
        paragraphs: [
          "Look at the picture. For 1,476 ÷ 6, start with the biggest place. 200 groups of 6 are 200 × 6 = 1,200. Take them away: 1,476 − 1,200 = 276.",
          "40 groups of 6 are 240. Take them away: 276 − 240 = 36. Then 6 groups of 6 are 36. Take them away: 36 − 36 = 0. Nothing is left.",
          "Add the groups you took: 200 + 40 + 6 = 246. Each of these numbers is called a partial quotient, one piece of the answer. Check by multiplying: 246 × 6 = 1,476.",
        ],
        illustration: "partial-quotients",
      },
      {
        title: "Remainders",
        paragraphs: [
          "Sometimes a few are left that cannot make a full group. That amount is called the remainder.",
          "For 389 ÷ 4: 90 groups of 4 are 360, leaving 29. Then 7 groups of 4 are 28, leaving 1. So the quotient is 97 and the remainder is 1.",
          "Check: 97 × 4 + 1 = 389. The remainder is always less than the divisor. If it is not, another group still fits.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Quotient and remainder",
        paragraphs: [
          "Divide a whole number $n$ by a whole number $d$ that is more than 0. You get a whole-number quotient $q$ and a remainder $r$, with $n = d \\times q + r$. The remainder is 0 or more and less than $d$, written $0 \\le r < d$. The sign $\\le$ means “is less than or equal to.” Each step takes groups away and counts them, so the groups taken and what is left always make $n$.",
        ],
      },
    ],
    workedExample: {
      prompt: "What is 1,830 ÷ 6?",
      steps: [
        "Start with hundreds: 300 groups of 6 are 300 × 6 = 1,800. Take them away: 1,830 − 1,800 = 30.",
        "Try tens: 10 groups of 6 are 60, which is more than 30. No tens of groups fit, so the tens digit of the quotient is 0.",
        "Try ones: 5 groups of 6 are 30. Take them away: 30 − 30 = 0, so nothing is left.",
        "Add the groups: 300 + 0 + 5 = 305. Check: 305 × 6 = 1,830.",
      ],
      answer: "305",
    },
    pitfalls: [
      "Keep a 0 where no group fits: 1,830 ÷ 6 = 305, not 35.",
      "A remainder must be less than the divisor. If 6 or more are left when you divide by 6, another group still fits.",
    ],
    parentGuide:
      "Share 156 counters into 4 equal groups. Bundle them as hundreds, tens and ones, and trade a bundle for 10 smaller ones when needed.",
  },
  {
    id: "divide-by-two-digit",
    title: "Divide by a two-digit number",
    summary:
      "To find 1,512 ÷ 24, ask how many groups of 24 fit in 1,512. Twenty-four is hard to think with, so use a nearby easy number like 25. Make a first guess, multiply to check it, and fix it if needed. The answer is called the quotient.",
    templateIds: ["divide-by-two-digit"],
    objectives: [
      "Divide a number with up to four digits by a two-digit number.",
      "Use estimates and multiplication to check each step.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Use a nearby easy number to guess",
        paragraphs: [
          "The number you divide by is called the divisor. In 1,512 ÷ 24, the divisor is 24.",
          "An estimate is a close guess made with easy numbers. To round a number means to change it to a nearby easy one. Round 24 to 25: four 25s make 100, so 1,500 holds 60 of them.",
          "So about 60 groups of 24 fit. Multiply to check: 60 × 24 = 1,440. That is not more than 1,512, so the guess fits.",
        ],
      },
      {
        title: "Estimate each part",
        paragraphs: [
          "Look at the picture. Take 60 groups of 24: 60 × 24 = 1,440. What is left is 1,512 − 1,440 = 72.",
          "Then 3 groups of 24 make 72. Take them away: 72 − 72 = 0.",
          "Add the groups you took: 60 + 3 = 63. So 1,512 ÷ 24 = 63. If a product is ever bigger than what is left, the guess was too big. Try one less.",
        ],
        illustration: "partial-quotients-two-digit",
      },
      {
        title: "Check by multiplying",
        paragraphs: [
          "Division undoes multiplication. So multiply the quotient by the divisor: 63 × 24 = 1,512. That matches, so 63 is right.",
          "A zero in the quotient holds a place. For 2,520 ÷ 24, take 100 groups of 24, which is 2,400. That leaves 120. 10 groups of 24 make 240, which is more than 120, so the tens digit is 0. Then 5 groups of 24 make 120. So 2,520 ÷ 24 = 105.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Check every quotient digit",
        paragraphs: [
          "Divide by a two-digit divisor $d$. Choose each part of the quotient so that it times $d$ is not more than what is left, then subtract. At the end, the remainder must be 0 or more and less than $d$. The quotient times $d$, plus the remainder, gives back the number you started with.",
        ],
      },
    ],
    workedExample: {
      prompt: "What is 1,872 ÷ 36?",
      steps: [
        "Guess the tens first. Round 36 to 40 and 1,872 to 2,000. Since 2,000 ÷ 40 = 50, try 50 groups.",
        "Check: 50 × 36 = 1,800 fits in 1,872, but 60 × 36 = 2,160 is too big. Take 1,800 away: 1,872 − 1,800 = 72.",
        "Now 2 groups of 36 make 72. Take them away: 72 − 72 = 0, so nothing is left.",
        "Add the groups: 50 + 2 = 52. Check: 52 × 36 = 1,872.",
      ],
      answer: "52",
    },
    pitfalls: [
      "If a guess times the divisor is bigger than what is left, the guess is too big. Try one less.",
      "Keep a 0 in the quotient when a place has no full group: 2,520 ÷ 24 = 105, not 15.",
    ],
    parentGuide:
      "Ask for a rough answer first: 1,512 ÷ 24 is about 1,500 ÷ 25, which is 60. Then compare it with the exact answer.",
  },
];

const placeTerm: MethodTerm = "partial-product";
const divisionTerms: MethodTerm[] = ["divisor", "quotient", "remainder"];
export const multiplyDivideMethods: Record<string, ProblemMethod> = {
  "multiply-by-tens": {
    goal: "Multiply a one-digit number by a multiple of ten, such as 6 × 70.",
    intuition:
      "A multiple of ten is a number you reach by counting by tens, like 20, 50 or 70. Seventy is 7 tens, or 7 groups of 10. A one-digit number is a number from 0 to 9. A times-table fact is a multiplication you know, like 6 × 7 = 42. The answer to a multiplication is called the product.",
    senses: multiplySenses,
    method: [
      "Write the multiple of ten as a number of tens: 70 is 7 tens.",
      "Use the times-table fact: 6 × 7 = 42. So 6 × 70 is 42 tens.",
      "Each ten is worth 10, so 42 tens is 42 × 10 = 420.",
    ],
    watch:
      "Keep the zero from the fact and the zero from the tens: 5 × 40 is 20 tens, which is 200.",
  },
  "multiply-by-one-digit": {
    goal: "Multiply a number with up to four digits by a one-digit number.",
    intuition:
      "Place value means a digit's worth depends on its place: in 357, the 3 means 300 and the 5 means 50. A factor is one of the numbers you multiply. A one-digit number is a number from 0 to 9. Split the big factor into parts and multiply each part. Each part's answer is called a partial product. All of them added make the full answer, called the product.",
    terms: [placeTerm],
    senses: multiplySenses,
    method: [
      "Split the bigger factor by place value: 357 = 300 + 50 + 7.",
      "Multiply each part by the one-digit number. Each answer is a partial product.",
      "The parts make the whole number, so add the partial products.",
    ],
    watch:
      "Multiply what each digit is worth, not the digit alone: the 5 in 357 means 50.",
  },
  "area-model-product": {
    goal: "Find a product from an area model split by place value.",
    intuition:
      "An area model is a rectangle that shows a multiplication. A factor is one of the numbers you multiply. The rectangle's width and height are the two factors. Each factor is split by place value: 29 = 20 + 9, because the 2 means 2 tens. Lines cut the big rectangle into smaller rectangles. A rectangle's area, the space it covers, is its width times its height. Each small area is called a partial product. The whole answer is called the product.",
    terms: [placeTerm],
    senses: multiplySenses,
    method: [
      "Find each small rectangle's width and height from the numbers written along the outside.",
      "Multiply width by height for each small rectangle. Each answer is a partial product.",
      "The small rectangles fill the big one, so add all the partial products.",
    ],
    watch:
      "Count every small rectangle, including the two mixed ones such as 9 × 20 and 20 × 8.",
  },
  "multiply-multidigit": {
    goal: "Multiply a two- or three-digit number by a two-digit number.",
    intuition:
      "A factor is one of the numbers you multiply. In a two-digit number like 45, the 4 is the tens digit, so it means 40. The 5 is the ones digit. Split 45 into 40 + 5 and multiply the other factor by each part. Each answer is called a partial product. An estimate is a close answer made with easy, rounded numbers, like 800 × 50 for 775 × 45.",
    terms: [placeTerm],
    senses: multiplySenses,
    method: [
      "Multiply by the ones digit of the two-digit factor.",
      "Multiply by its tens part, such as 40. That row ends in 0.",
      "The two parts make the two-digit factor, so add the two partial products. Compare the sum with an estimate.",
    ],
    watch:
      "The tens row is multiplied by tens, so it ends in 0: 208 × 30 = 6,240, not 624.",
  },
  "divide-by-one-digit": {
    goal: "Divide a number with up to four digits by a one-digit number.",
    intuition:
      "To divide means to split a number into equal groups. The number you divide by is called the divisor. The answer, how many groups fit, is called the quotient. You can take away big groups first, like 600 groups at once. Each count of groups you take is called a partial quotient, one piece of the answer.",
    terms: divisionTerms,
    method: [
      "Start with the biggest place. Find how many groups of the divisor fit, such as 600 groups of 3.",
      "Take those groups away. Keep going with what is left, using smaller groups.",
      "Add the partial quotients to get the quotient. Check by multiplying it by the divisor.",
    ],
    watch:
      "If no group fits in a place, that digit of the quotient is 0: 1,830 ÷ 6 = 305, not 35.",
  },
  "division-remainder": {
    goal: "Divide a number by a one-digit number and find the remainder, the amount left over.",
    intuition:
      "To divide means to split a number into equal groups. The number you divide by is called the divisor. The count of full groups is called the quotient. The amount left over, too small to make one more group, is called the remainder.",
    terms: divisionTerms,
    method: [
      "Take away groups of the divisor, big groups first, until no more fit.",
      "What is left is the remainder. It must be less than the divisor.",
      "Check: the quotient times the divisor, plus the remainder, gives the number you started with.",
    ],
    watch:
      "If what is left is as big as the divisor or bigger, another group still fits.",
  },
  "divide-by-two-digit": {
    goal: "Divide a number with up to four digits by a two-digit number.",
    intuition:
      "To divide means to split a number into equal groups. The number you divide by is called the divisor, here a two-digit number like 23. The answer, how many groups fit, is called the quotient. An estimate is a close guess made with easy numbers. To round a number means to change it to a nearby easy one, like 23 to 20.",
    terms: divisionTerms,
    method: [
      "Round the divisor to guess how many groups fit, such as 70 groups of 23.",
      "Multiply and take those groups away. If the product is bigger than what is left, try fewer groups.",
      "Add the groups you took to get the quotient. Check by multiplying it by the divisor.",
    ],
    watch:
      "If the product is bigger than what is left, the guess was too big. Try one less.",
  },
};
export const multiplyDividePrinciples: Record<string, string> = {
  "multiply-by-tens":
    "6 × 70 = 6 × (7 × 10) = (6 × 7) × 10 = 420. When you multiply three numbers, you can group them either way and the product stays the same. This rule is called the associative property of multiplication.",
  "multiply-by-one-digit":
    "Multiplying a sum is the same as multiplying each part and adding: (300 + 50 + 7) × 6 = 300 × 6 + 50 × 6 + 7 × 6. This rule is called the distributive property.",
  "area-model-product":
    "The area of a rectangle equals the sum of the areas of the smaller rectangles that fill it with no gaps or overlaps: (20 + 9) × (20 + 8) = 400 + 180 + 160 + 72.",
  "multiply-multidigit":
    "Multiplying by a sum is the same as multiplying by each part and adding: 346 × 27 = 346 × 7 + 346 × 20. This rule is called the distributive property.",
  "divide-by-one-digit":
    "Division undoes multiplication. The partial quotients add up to how many groups of the divisor fit in the dividend, the number being divided.",
  "division-remainder":
    "For whole numbers $n$ and $d$ with $d > 0$, there is exactly one way to write $n = q \\times d + r$ with $0 \\le r < d$. Here $q$ is the quotient, $r$ is the remainder, and $\\le$ means “is less than or equal to.”",
  "divide-by-two-digit":
    "Division undoes multiplication. However big the divisor is, the partial quotients add up to the whole quotient.",
};
