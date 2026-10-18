import type { Lesson } from "./lessons";

export const fractionAdditionLesson: Lesson = {
  id: "fraction-addition",
  title: "Adding fractions",
  summary:
    "To combine thirds and fourths, divide them into smaller parts of the same size. Then count those parts.",
  templateIds: ["add-fractions"],
  objectives: [
    "Explain what the two numbers in a fraction tell you.",
    "Show why dividing parts into smaller equal parts preserves an amount.",
    "Add fractions, explain the answer, and write it in simplest form.",
  ],
  sections: [
    {
      title: "A fraction counts equal parts of a whole",
      paragraphs: [
        "This lesson uses counting, addition, multiplication, and division of whole numbers. Whole numbers are 0, 1, 2, 3, and so on. For example, 3 × 4 counts 3 equal groups of 4, and 12 ÷ 3 splits 12 into 3 equal groups of 4.",
        "First choose what counts as one whole: one strip of paper, one liter of water, or the distance from 0 to 1 on a number line. A fraction describes an amount using equal parts of that whole.",
        "Divide one whole into 3 equal parts. Each part is one third, written 1/3. Two of those parts make two thirds, written 2/3. The parts must be equal in the quantity you are measuring: equal lengths of a strip, equal volumes of water, or equal distances on a line.",
        "The denominator is the number below the fraction line. When a slash is used instead of a horizontal line, the denominator comes after the slash. It tells how many equal parts make one whole, so it determines the size of each part. The numerator is the number above the line, or before the slash. It counts how many of those parts you have. In 2/3, the denominator 3 means thirds, and the numerator 2 means two of them.",
        "Three thirds make one whole: 3/3 = 1. Four thirds make more than one whole: 4/3 = 1 + 1/3. A numerator can be larger than its denominator; the count simply continues beyond one whole.",
      ],
    },
    {
      title: "Addition combines amounts measured with the same whole",
      paragraphs: [
        "Adding means combining amounts; the result is their sum. If you have 2/5 of a strip and add another 1/5 of a strip of the same length, you have three fifths: 2/5 + 1/5 = 3/5. You add 2 and 1 because they count the same-sized parts. The parts are still fifths, so the denominator stays 5.",
        "The whole must stay the same size. One third of a one-meter strip and one fourth of a one-meter strip use the same whole: one meter. One third of a one-meter strip and one fourth of a two-meter strip do not. One fourth of a two-meter strip is half a meter: dividing 2 meters into 4 equal lengths gives 2/4 = 1/2 meter each. To combine lengths, first express both as fractions of the same length unit.",
        "Thirds and fourths are different sizes. Counting one third and one fourth as two parts does not tell us how much we have. We need to divide them into parts of a single size before adding their counts.",
      ],
    },
    {
      title: "Cut thirds and fourths into twelfths",
      paragraphs: [
        "Start with a whole divided into 3 equal parts. Divide each third into 4 equal smaller parts. The whole now contains 3 × 4 = 12 equal parts, called twelfths. The third you already had contains 4 of them: 1/3 = 4/12. No amount was added or removed; only the divisions changed.",
        "For a whole of the same size divided into 4 equal parts, divide each fourth into 3 equal smaller parts. The whole again contains 4 × 3 = 12 equal parts. One fourth contains 3 of them: 1/4 = 3/12.",
        "Fractions that describe the same amount of the same whole are called equivalent fractions. One third and four twelfths are equivalent. So are one fourth and three twelfths. Twelfths give both amounts the same-sized parts to count; 12 is their common denominator.",
      ],
      illustration: "thirds-and-fourths",
    },
    {
      title: "Combine the parts without changing their size",
      paragraphs: [
        "One third contributes 4 twelfths, and one fourth contributes 3 twelfths. Together they contribute 7 twelfths: 4/12 + 3/12 = 7/12. The numerator becomes 7 because there are seven parts. The denominator stays 12 because each part is still one twelfth of the whole.",
        "Adding the two numerators and also adding the two denominators would give 2/7. That would describe two sevenths, a different amount. We did not cut the whole into sevenths, so sevenths do not describe the parts we combined. There is also a size check: 2/7 = 6/21, while 1/3 = 7/21. The proposed sum is smaller than one of the positive amounts being added, so it cannot be correct.",
      ],
    },
    {
      title: "Choose a common denominator for other fractions",
      paragraphs: [
        "A positive multiple of a positive whole number is that number multiplied by 1, 2, 3, and so on. The positive multiples of 3 begin 3, 6, 9, 12; those of 4 begin 4, 8, 12. A common multiple appears in both lists. To see why 12 works as a denominator, divide the whole into 12 equal parts. Each third contains 12 ÷ 3 = 4 of those parts, and each fourth contains 12 ÷ 4 = 3. Both counts are whole numbers because 12 is a multiple of both 3 and 4.",
        "Multiplying the two denominators always gives a common multiple. Sometimes a smaller one makes the work easier. To add 1/6 and 1/4, list multiples of 6 (6, 12) and of 4 (4, 8, 12). Both lists reach 12, so you can use twelfths: each sixth splits into 2 twelfths, and each fourth splits into 3 twelfths. Thus 1/6 + 1/4 = 2/12 + 3/12 = 5/12. You could use twenty-fourths, but that requires larger counts.",
        "Every time you divide each part into the same number of smaller pieces, multiply both numbers in the fraction by that number. For example, divide each third in 2/3 into 4 smaller parts: the two thirds contain 2 × 4 = 8 twelfths, and the whole contains 3 × 4 = 12 twelfths. Therefore 2/3 = 8/12. Multiplying only the denominator would change the amount.",
      ],
    },
    {
      title: "Simplify by grouping equal parts",
      paragraphs: [
        "Simplifying reverses subdivision: group small parts into larger equal parts. For 6/8, group every 2 eighths into a fourth. The whole has 8 ÷ 2 = 4 groups, and the selected amount has 6 ÷ 2 = 3 groups. Therefore 6/8 = 3/4.",
        "A common factor is a positive whole number that divides both the numerator and denominator without a remainder. Divide both by the same common factor to preserve the value. A fraction is in simplest form when no common factor greater than 1 remains. For small numbers, check the whole numbers from 2 through the smaller of the numerator and denominator. If one divides both exactly, divide both by it and repeat with the smaller numbers. Stop when none divides both.",
        "For example, in 21/30, 2 does not divide 21 exactly, but 3 divides both numbers: 21 ÷ 3 = 7 and 30 ÷ 3 = 10. Thus 21/30 = 7/10. The only positive whole numbers that divide 7 exactly are 1 and 7; 7 does not divide 10 exactly, so 7/10 is in simplest form. The same check shows that 7/12 is in simplest form: 7 does not divide 12 exactly either.",
        "A sum can exceed one whole. For example, 3/4 + 2/3 = 9/12 + 8/12 = 17/12. Twelve of the twelfths make one whole, leaving five twelfths: 17/12 = 1 + 5/12. Both expressions name the same amount.",
      ],
    },
  ],
  workedExample: {
    prompt:
      "A strip is 1/3 meter long. Another is 1/4 meter long. What is their combined length in meters?",
    steps: [
      "Use one meter as the whole for both lengths. Use 3 × 4 = 12 as a common denominator: both thirds and fourths split into a whole number of twelfths. Divide one meter into 12 equal lengths, so each small length is one twelfth of a meter.",
      "Each third contains 4 twelfths. The first strip is therefore 1/3 = 4/12 of a meter.",
      "Each fourth contains 3 twelfths. The second strip is therefore 1/4 = 3/12 of a meter.",
      "Count all the twelfths: 4 + 3 = 7. The combined length is 4/12 + 3/12 = 7/12 of a meter.",
      "Check the size: seven twelfths is more than four twelfths and more than three twelfths, but less than twelve twelfths, which make one whole. It is in simplest form because 7 and 12 share no common factor greater than 1.",
    ],
    answer: "7/12",
    answerUnit: "meter",
  },
  pitfalls: [
    "Use the same-sized whole for every fraction before combining amounts.",
    "A denominator names the size of a part through the number of equal parts per whole. After you rename both fractions with one denominator, add the numerators and keep that denominator.",
    "Changing a fraction's name must preserve its amount. When subdividing, multiply both numbers by the same positive whole number. When simplifying, divide both by the same common factor.",
  ],
  parentGuide:
    "Use two equal-length paper strips. Mark thirds on one and fourths on the other, then subdivide both into twelfths. Ask the learner to explain why the amounts do not change, and why their sum counts seven twelfths. Use the brackets in the diagram to check.",
};
