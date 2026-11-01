import type { Lesson } from "./lessons";

export const fractionAdditionLesson: Lesson = {
  id: "fraction-addition",
  title: "Adding fractions",
  summary:
    "A fraction names equal parts of a whole. You can add fractions when their parts are the same size. Thirds and fourths are different sizes. So cut both into twelfths, smaller parts that are all one size. Then count the twelfths.",
  templateIds: ["add-fractions"],
  senses: {
    whole: "whole",
    part: "part",
    third: "third",
    quarter: "fourth",
    eighth: "eighth",
    "more than": "more-than",
    multiple: "multiple",
    factor: "factor-number",
    rename: "rename",
    unit: "unit",
  },
  noLink: ["change", "changes"],
  objectives: [
    "Explain what the two numbers in a fraction tell you.",
    "Show why cutting parts into smaller equal parts keeps the amount the same.",
    "Add fractions, explain the answer, and write it in simplest form.",
  ],
  sections: [
    {
      stage: "intuition",
      title: "Count pieces of one size",
      paragraphs: [
        "A third is one of 3 equal parts of a whole. A fourth is one of 4 equal parts of the same whole. So a third and a fourth are pieces of different sizes.",
        "To add them, cut both into smaller pieces of one size. Then count how many pieces you have. Cutting does not add or take away any amount. It only changes how you count it.",
        "In a fraction such as 2/3, the bottom number is called the denominator. It says how many equal parts make one whole. The top number is called the numerator. It counts the parts you have. In this lesson, the whole is one meter, a length a little longer than a big step.",
      ],
    },
    {
      title: "A fraction counts equal parts of a whole",
      paragraphs: [
        "This lesson uses whole numbers, the numbers 0, 1, 2, 3 and so on. It also multiplies and divides them. Equal groups are groups that each hold the same number. For example, 3 × 4 counts 3 equal groups of 4. And 12 ÷ 3 shares 12 into 3 equal groups of 4.",
        "First choose what counts as one whole. It can be one strip of paper, one jug of water, or the distance from 0 to 1 on a number line. A fraction tells an amount using equal parts of that whole.",
        "Cut one whole into 3 equal parts. Each part is one third, written 1/3. Two of those parts make two thirds, written 2/3. The parts must be equal in what you measure: equal lengths of a strip, or equal amounts of water.",
        "When a fraction is written with a slash, like 2/3, the numerator comes before the slash and the denominator comes after it. The denominator says how many equal parts make one whole, so it sets the size of each part. The numerator counts how many of those parts you have. In 2/3, the denominator 3 means thirds, and the numerator 2 means two of them.",
        "Three thirds make one whole: 3/3 = 1. Four thirds make more than one whole: 4/3 = 1 + 1/3. A numerator can be bigger than its denominator. The count just keeps going past one whole.",
      ],
    },
    {
      title: "Addition puts together amounts of the same whole",
      paragraphs: [
        "Adding means putting amounts together. The answer is called their sum. Suppose you have 2/5 of a strip and add 1/5 of a strip of the same length. Now you have 3 fifths: 2/5 + 1/5 = 3/5.",
        "You add 2 and 1 because they count parts of the same size. The parts are still fifths, so the denominator stays 5.",
        "The whole must stay the same size. One third of a one-meter strip and one fourth of a one-meter strip use the same whole: one meter. One fourth of a two-meter strip is different. Cutting 2 meters into 4 equal lengths gives half a meter each. So to add lengths, first write both as fractions of the same whole, such as one meter.",
        "Thirds and fourths are different sizes. Calling one third and one fourth two parts does not tell us how much we have. So we cut them into parts of one size before we add.",
      ],
    },
    {
      title: "Cut thirds and fourths into twelfths",
      paragraphs: [
        "Start with a whole cut into 3 equal parts. Cut each third into 4 equal smaller parts. Now the whole has 3 × 4 = 12 equal parts, called twelfths. The third you had holds 4 of them: 1/3 = 4/12. No amount was added or taken away. Only the cuts changed.",
        "Take a whole of the same size cut into 4 equal parts. Cut each fourth into 3 equal smaller parts. Again the whole has 4 × 3 = 12 equal parts. One fourth holds 3 of them: 1/4 = 3/12.",
        "Look at the picture. One third is split into four twelfths, and one fourth is split into three twelfths. Fractions that name the same amount of the same whole are called equivalent fractions. So 1/3 and 4/12 are equivalent fractions, and so are 1/4 and 3/12.",
        "Twelfths give both amounts parts of the same size. A bottom number that both fractions can share like this is called a common denominator.",
      ],
      illustration: "thirds-and-fourths",
    },
    {
      title: "Combine the parts without changing their size",
      paragraphs: [
        "One third gives 4 twelfths, and one fourth gives 3 twelfths. Together they make 7 twelfths: 4/12 + 3/12 = 7/12. The numerator is 7 because there are 7 parts. The denominator stays 12 because each part is still one twelfth of the whole.",
        "What if you add the numerators and also add the denominators? That gives 2/7, two sevenths. But we never cut the whole into sevenths, so sevenths do not describe our parts.",
        "A size check shows it too. When you add two amounts that are both more than 0, the sum must be bigger than each of them. But 2/7 is less than 1/3, because 2 sevenths is less than 2 sixths, and 2 sixths is 1/3. So 2/7 cannot be the sum.",
      ],
    },
    {
      title: "Choose a common denominator for other fractions",
      paragraphs: [
        "The numbers you get by multiplying 3 by 1, 2, 3 and so on are called the multiples of 3. They begin 3, 6, 9, 12. The multiples of 4 begin 4, 8, 12. A number in both lists, like 12, is called a common multiple.",
        "Why does 12 work? Cut the whole into 12 equal parts. Each third holds 12 ÷ 3 = 4 of them, and each fourth holds 12 ÷ 4 = 3. Both counts are whole numbers because 12 is a multiple of both 3 and 4.",
        "Multiplying the two denominators always gives a common multiple. Sometimes a smaller one makes the work easier. To add 1/6 and 1/4, list the multiples of 6 (6, 12) and of 4 (4, 8, 12). Both lists reach 12, so use twelfths. Each sixth splits into 2 twelfths, and each fourth splits into 3 twelfths. So 1/6 + 1/4 = 2/12 + 3/12 = 5/12. Twenty-fourths would also work, but the counts would be bigger.",
        "When you cut each part into the same number of smaller pieces, multiply both numbers in the fraction by that number. For example, cut each third in 2/3 into 4 smaller parts. The two thirds hold 2 × 4 = 8 twelfths, and the whole holds 3 × 4 = 12 twelfths. So 2/3 = 8/12. Multiplying only the denominator would change the amount.",
      ],
    },
    {
      title: "Simplify by grouping equal parts",
      paragraphs: [
        "Simplifying means writing the same amount with smaller numbers. It undoes the cutting: you group small parts into bigger equal parts. For 6/8, group every 2 eighths into one fourth. The whole has 8 ÷ 2 = 4 groups, and the amount has 6 ÷ 2 = 3 groups. So 6/8 = 3/4.",
        "A common factor is a whole number that divides both the numerator and the denominator evenly, with nothing left over. Divide both by the same common factor, and the amount stays the same. A fraction is in simplest form when no common factor bigger than 1 is left.",
        "When the top and bottom numbers are both more than 0, try each whole number from 2 up to the smaller of the two. If one divides both evenly, divide both by it. Then check again with the smaller numbers. Stop when none divides both.",
        "For example, take 21/30. 2 does not divide 21 evenly, but 3 divides both: 21 ÷ 3 = 7 and 30 ÷ 3 = 10. So 21/30 = 7/10. The only whole numbers that divide 7 evenly are 1 and 7, and 7 does not divide 10 evenly. So 7/10 is in simplest form. The same check shows that 7/12 is in simplest form, because 7 does not divide 12 evenly either.",
        "A sum can be more than one whole. For example, 3/4 + 2/3 = 9/12 + 8/12 = 17/12. Twelve twelfths make one whole, leaving five twelfths: 17/12 = 1 + 5/12. Both name the same amount.",
      ],
    },
  ],
  closingSections: [
    {
      stage: "formal",
      title: "Equivalent fractions and addition",
      paragraphs: [
        "The numerator counts the chosen equal parts. The denominator, a whole number greater than 0, is the number of those parts in one whole. Equivalent fractions name the same number. Multiplying the numerator and the denominator by the same number, other than 0, keeps the value the same.",
        "Let $a$ and $c$ be whole numbers, and let $b$ and $d$ be whole numbers greater than 0. Then $\\frac{a}{b}+\\frac{c}{d}=\\frac{a\\times d+c\\times b}{b\\times d}$. Check it with numbers: $\\frac{1}{3}+\\frac{1}{4}=\\frac{1\\times4+1\\times3}{3\\times4}=\\frac{7}{12}$.",
        "Any common multiple $m$ of $b$ and $d$ also works, because $\\frac{a}{b}=\\frac{a\\times(m\\div b)}{m}$ and $\\frac{c}{d}=\\frac{c\\times(m\\div d)}{m}$. The denominator gives the size of the shared parts, so only the counts are added.",
        "A fraction is in simplest form when its numerator and denominator have no common factor bigger than 1. For measured amounts, both fractions must be parts of wholes of the same size before you add this way.",
      ],
    },
  ],
  workedExample: {
    prompt:
      "A strip is 1/3 meter long. Another is 1/4 meter long. What is their combined length in meters?",
    steps: [
      "Use one meter as the whole for both lengths. Cut the meter into 12 equal lengths, called twelfths. 12 works because 3 × 4 = 12, so thirds and fourths both split evenly into twelfths.",
      "Cut each third into 4 equal smaller lengths, because 12 ÷ 3 = 4. So each third holds 4 twelfths, and the first strip is 1/3 = 4/12 of a meter.",
      "Cut each fourth into 3 equal smaller lengths, because 12 ÷ 4 = 3. So each fourth holds 3 twelfths, and the second strip is 1/4 = 3/12 of a meter.",
      "Count all the twelfths: 4 + 3 = 7. The combined length is 4/12 + 3/12 = 7/12 of a meter.",
      "Check the size. Seven twelfths is more than four twelfths and more than three twelfths. It is less than twelve twelfths, which make one whole. And 7/12 cannot be written with smaller numbers, because no number bigger than 1 divides both 7 and 12 evenly.",
    ],
    answer: "7/12",
    answerUnit: "meter",
  },
  pitfalls: [
    "Use a whole of the same size for every fraction before you add amounts.",
    "The denominator tells the size of a part, by saying how many equal parts make one whole. After you rewrite both fractions with one denominator, add the numerators and keep that denominator.",
    "Rewriting a fraction must keep its amount. When you cut parts smaller, multiply both numbers by the same whole number, other than 0. When you simplify, divide both by the same number that divides each of them evenly.",
  ],
  parentGuide:
    "Use two paper strips of the same length. Mark thirds on one and fourths on the other. Then mark both into twelfths. Ask your child to explain why the amounts do not change, and why the sum is seven twelfths. Use the brackets in the picture to check.",
};
