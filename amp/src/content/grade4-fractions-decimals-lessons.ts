import type { Lesson } from "./lessons";
import type { FacetMapping } from "./coverage";
import type { ProblemMethod } from "./problem-lessons";
import { chainLesson } from "./chain-lesson-kit";

export const grade4FractionsDecimalsMethods: Record<string, ProblemMethod> = {
  "fraction-decompositions-select": {
    goal: "Choose the sums with one denominator that match a shaded amount, including unit fractions.",
    intuition:
      "A fraction can be split into a sum in more than one way. The pieces in every part of the sum use the same denominator. Add the top numbers. They match the shaded count when the sum is right. One of the sums is built only from unit fractions, such as 1/8 + 1/8 + 1/8.",
    method: [
      "Read the shaded count and the denominator on the strips.",
      "Add the top numbers in each sum. Keep the denominator as it is.",
      "Keep every sum whose top numbers match the shaded count, including the sum made only of unit fractions.",
    ],
    watch:
      "Do not add the denominators. The pieces stay the same size, so only the top numbers are added.",
  },
  "mixed-fraction-sum": {
    goal: "Add mixed numbers that share a denominator, including sums that regroup into the next whole.",
    intuition:
      "A mixed number is a whole number plus a fraction. Add the whole numbers, then add the fractions. When the fraction parts make one whole or more, trade that whole and carry it over.",
    method: [
      "Add the whole numbers.",
      "Add the numerators. The denominator stays the same.",
      "If the numerator is at least the denominator, trade groups of that many parts for wholes.",
    ],
    watch:
      "Do not add the denominators. Trade a full set of parts for 1 whole before you write the sum.",
  },
  "like-fraction-sum-story": {
    goal: "Add two fractions of one whole in a length, volume, or time story.",
    intuition:
      "The story names one path, one jug, or one chore. Both fractions are parts of that same whole, and they share a denominator. Add the top numbers to find how much there is in all.",
    method: [
      "Check that both fractions name parts of the same whole.",
      "Check that both fractions use the same denominator.",
      "Add the numerators and keep that denominator. The sum can be more than 1.",
    ],
    watch:
      "Do not add fractions of different wholes. The story has to name one path, one jug, or one chore.",
  },
  "unit-fraction-multiple-blanks": {
    goal: "Fill both boxes: a fraction as copies of a unit fraction, and a product as copies of that unit fraction.",
    intuition:
      "A unit fraction is one piece, such as 1/5. Three of those pieces make 3/5, so 3/5 is 3 copies of 1/5. A product such as 3 times 2/5 is 3 groups of 2 pieces, which is 6 copies of 1/5.",
    method: [
      "Read the numerator of the first fraction. That is how many copies of the unit fraction it is.",
      "On the second line, multiply the number of groups by the number of pieces in one group.",
      "Write that product as the number of copies of the same unit fraction.",
    ],
    watch:
      "Do not multiply the numerator by the denominator. Count pieces, not the size of one piece.",
  },
  "equivalent-fractions-number-line": {
    goal: "Choose every fraction that names one marked point, using at least three denominators.",
    intuition:
      "Point $P$ sits a counted number of steps from 0. Splitting each step into smaller equal steps does not move the point. A fraction names $P$ when its steps land on the same place.",
    method: [
      "Count the steps from 0 to point $P$, and read how many steps are in one whole.",
      "Build other names by splitting each step into the same number of smaller steps.",
      "Choose every fraction that lands on $P$. Three denominators are enough.",
    ],
    watch:
      "Do not choose a fraction just because its numerator or its denominator looks familiar. Count the steps.",
  },
  "compare-fractions-symbol-blanks": {
    goal: "Record each fraction comparison with greater than, equal to, or less than.",
    intuition:
      "Two fractions of the same whole can be compared once they count pieces of the same size. Rename them with a common denominator, then compare the top numbers. The same amount uses the symbol for equal to.",
    method: [
      "Give each pair a common denominator, or spot a pair that already names the same amount.",
      "Compare the top numbers.",
      "Choose greater than, equal to, or less than for each pair.",
    ],
    watch:
      "Do not decide from the size of the denominators alone. Rename first, then compare the top numbers.",
  },
  "compare-decimals-symbol-blanks": {
    goal: "Record each decimal comparison to hundredths with greater than, equal to, or less than.",
    intuition:
      "Line the decimal points up. A zero written at the end, as in 0.50, does not change the value of 0.5. Then compare tenths, and compare hundredths only if the tenths match.",
    method: [
      "Write each decimal with digits in the tenths and hundredths places. A missing hundredth is a zero.",
      "Compare tenths first.",
      "If the tenths match, compare hundredths. Choose the symbol for each pair.",
    ],
    watch:
      "Do not treat a longer decimal as a greater number. 0.5 and 0.50 are the same amount.",
  },
  "decimal-fraction-locate": {
    goal: "Choose the letter of the point that sits at a given fraction or decimal.",
    intuition:
      "The ends of the line are numbered. The letters sit on tick marks in between. Count the steps from the left end until you reach the given value, then read the letter there.",
    method: [
      "Read the number at the left end and the size of one step.",
      "Count the steps from that end to the given value.",
      "Choose the letter on that tick mark.",
    ],
    watch:
      "Do not read a letter's place from the right end unless you start there on purpose. Count from the labeled end you chose.",
  },
  "decimal-place-value-hundredths": {
    goal: "Name the place and the value of one digit in a decimal that stops at hundredths.",
    intuition:
      "In 3.05 the 3 is ones, the 0 is tenths, and the 5 is hundredths. A digit's value is that digit times its place. The 5 in 3.05 is worth 0.05, five hundredths.",
    method: [
      "Read the digits from the decimal point: tenths, then hundredths.",
      "Name the place of the asked digit.",
      "Multiply the digit by its place to get the value. A zero holds a place and adds nothing.",
    ],
    watch:
      "Do not say the value is the digit by itself when the digit is after the decimal point. Hundredths are worth one hundredth each.",
  },
};

export const grade4FractionsDecimalsPrinciples: Record<string, string> = {
  "fraction-decompositions-select":
    "For a whole number of equal parts, $N/d = 1/d + 1/d + \\cdots + 1/d$ with $N$ addends, and also $N/d = (N-1)/d + 1/d$. Adding the denominators does not add the parts.",
  "mixed-fraction-sum":
    "$w\\frac{a}{d} + v\\frac{b}{d} = (w+v) + (a+b)/d$. When $a+b \\ge d$, regroup: $(a+b)/d = 1 + (a+b-d)/d$.",
  "like-fraction-sum-story":
    "Fractions can be added when they name parts of the same whole and share a denominator: $a/d + b/d = (a+b)/d$.",
  "unit-fraction-multiple-blanks":
    "$a/b = a \\times (1/b)$, and $n \\times (a/b) = (n \\times a) \\times (1/b)$. The order $a/b \\times n$ names the same product.",
  "equivalent-fractions-number-line":
    "A point that is $p$ steps of size $1/b$ from 0 is also $p \\times k$ steps of size $1/(b \\times k)$. Those fractions name the same point.",
  "compare-fractions-symbol-blanks":
    "For fractions of the same whole, compare $a/b$ and $c/d$ by the cross products $a \\times d$ and $c \\times b$. The symbol is greater than, equal to, or less than.",
  "compare-decimals-symbol-blanks":
    "To hundredths, compare the tenths digits and then the hundredths digits. A trailing zero does not change the value, so $0.5$ and $0.50$ are the same amount.",
  "decimal-fraction-locate":
    "On a number line, the point at a value is the tick mark that many steps from the labeled end. Tenths use steps of $1/10$. Hundredths use steps of $0.01$.",
  "decimal-place-value-hundredths":
    "In a decimal that stops at hundredths, a digit in the ones, tenths, or hundredths place is worth the digit times $1$, $0.1$, or $0.01$. A zero keeps its place.",
};

const lesson = (spec: Parameters<typeof chainLesson>[0]): Lesson =>
  chainLesson(spec);

export const grade4FractionsDecimalsLessons: Lesson[] = [
  lesson({
    id: "fraction-decompositions-select-lesson",
    title: "Choose fraction sums",
    summary:
      "A shaded amount can be written as a sum in more than one way. Add only the top numbers. One matching sum is made of unit fractions.",
    templateIds: ["fraction-decompositions-select"],
    objectives: [
      "Add fractions that share a denominator by adding the numerators.",
      "Choose more than one sum that matches a shaded amount, including a sum of unit fractions.",
    ],
    openingTitle: "More than one sum",
    opening: [
      "The strips show a shaded amount, such as 3/4. That amount can be three copies of 1/4.",
      "It can also be 2/4 + 1/4. Both sums use the denominator 4, and both top numbers add to 3.",
    ],
    example: {
      prompt: "Which sums equal 3/4? Choose every match.",
      steps: [
        "The shaded amount is 3 pieces of size 1/4.",
        "1/4 + 1/4 + 1/4 has top numbers 1 + 1 + 1, which is 3.",
        "2/4 + 1/4 has top numbers 2 + 1, which is also 3. Both sums match.",
      ],
      answer: "1/4 + 1/4 + 1/4 and 2/4 + 1/4",
    },
    methodTitle: "Add the top numbers",
    method: [
      "Read the shaded count.",
      "Add the top numbers of each sum and keep the denominator.",
    ],
    formalTitle: "Same denominator",
    formal: [
      "Unit fractions of the same denominator add by counting them.",
      "3/4 is 1/4 + 1/4 + 1/4 and also 2/4 + 1/4.",
    ],
    pitfalls: [
      "Adding the denominators makes a different fraction.",
      "A sum of fewer unit fractions than the shaded count does not match.",
    ],
    parentGuide:
      "Shade 3/4 of a strip and ask for two different ways to write that shade as a sum.",
  }),
  lesson({
    id: "mixed-fraction-sum-lesson",
    title: "Add mixed numbers",
    summary:
      "Add the wholes, then add the fractions. If the fraction parts make a whole, trade them and carry.",
    templateIds: ["mixed-fraction-sum"],
    objectives: [
      "Add mixed numbers that share a denominator.",
      "Regroup a sum of fraction parts that is at least one whole.",
    ],
    openingTitle: "Wholes, then parts",
    opening: [
      "2 3/4 means 2 wholes and 3 fourths. 1 2/4 means 1 whole and 2 fourths.",
      "The wholes make 3. The fourths make 5/4, which is 1 whole and 1/4 more.",
    ],
    example: {
      prompt: "Find 2 3/4 + 1 2/4.",
      steps: [
        "Add the wholes: 2 + 1 = 3.",
        "Add the fourths: 3/4 + 2/4 = 5/4.",
        "5/4 is 1 whole and 1/4. Together that is 4 wholes and 1/4, or 17/4.",
      ],
      answer: "17/4",
    },
    methodTitle: "Add, then trade",
    method: [
      "Add wholes and add numerators separately.",
      "Trade every full set of parts for 1 whole.",
    ],
    formalTitle: "Regrouping",
    formal: [
      "The denominator stays the same.",
      "A numerator at least as large as the denominator makes another whole.",
    ],
    pitfalls: [
      "Do not add the denominators.",
      "Do not leave a numerator larger than or equal to the denominator without trading.",
    ],
    parentGuide:
      "Use fraction strips for the parts, and ask the learner to trade a full strip for a whole.",
  }),
  lesson({
    id: "like-fraction-sum-story-lesson",
    title: "Add fractions in a story",
    summary:
      "When two fractions are parts of the same path, jug, or chore, add the numerators. The sum can be more than 1.",
    templateIds: ["like-fraction-sum-story"],
    objectives: [
      "Add two fractions of one whole in a length, volume, or time story.",
      "Keep the shared denominator and allow a sum greater than 1.",
    ],
    openingTitle: "One whole in the story",
    opening: [
      "Maya walks 3/5 of a meter, then 4/5 of a meter farther on the same path.",
      "Both lengths are parts of that one path. Add 3 and 4. The path walked is 7/5 of a meter.",
    ],
    example: {
      prompt:
        "Maya walks 3/5 of a meter, then 4/5 of a meter on the same path. How much is that in all?",
      steps: [
        "Both lengths are parts of the same path, and both use fifths.",
        "Add the numerators: 3 + 4 = 7.",
        "The sum is 7/5 of the path.",
      ],
      answer: "7/5",
    },
    methodTitle: "Same whole, then add",
    method: [
      "Name the one whole in the story.",
      "Add the numerators and keep the denominator.",
    ],
    formalTitle: "Joining parts",
    formal: [
      "$a/d + b/d = (a+b)/d$ when both fractions name the same whole.",
      "The sum is greater than 1 when $a + b$ is greater than $d$.",
    ],
    pitfalls: [
      "Do not add fractions that name different wholes.",
      "Do not stop because the sum is greater than 1.",
    ],
    parentGuide:
      "Ask whether the two parts are of the same path, jug, or chore before adding.",
  }),
  lesson({
    id: "unit-fraction-multiple-lesson",
    title: "Unit fraction copies",
    summary:
      "A fraction is that many copies of its unit fraction. A product of a whole number and a fraction is that many groups of those copies.",
    templateIds: ["unit-fraction-multiple-blanks"],
    objectives: [
      "Write a fraction as copies of a unit fraction.",
      "Write a product of a whole number and a fraction as copies of that unit fraction.",
    ],
    openingTitle: "Copies of one piece",
    opening: [
      "2/5 means 2 copies of 1/5. The first box is 2.",
      "3 times 2/5 is 3 groups of 2 pieces. That is 6 copies of 1/5. The second box is 6.",
    ],
    example: {
      prompt: "Fill in both boxes: 2/5 = □ × 1/5 and 3 × 2/5 = □ × 1/5.",
      steps: [
        "2/5 is 2 copies of 1/5, so the first box is 2.",
        "3 groups of 2 pieces make 6 pieces.",
        "The second box is 6, because the product is 6 copies of 1/5.",
      ],
      answer: "2 and 6",
    },
    methodTitle: "Count the pieces",
    method: [
      "The numerator tells the copies of the unit fraction.",
      "Multiply groups by pieces in a group for the product.",
    ],
    formalTitle: "Two forms",
    formal: [
      "$a/b = a \\times (1/b)$.",
      "$n \\times (a/b) = (n \\times a) \\times (1/b)$, and $a/b \\times n$ names the same product.",
    ],
    pitfalls: [
      "Do not multiply the numerator by the denominator.",
      "Do not add the number of groups to the number of pieces.",
    ],
    parentGuide:
      "Draw one group of pieces, then copy that group, and count every piece.",
  }),
  lesson({
    id: "equivalent-fractions-number-line-lesson",
    title: "Fractions on a number line",
    summary:
      "One point can have several fraction names. Count the steps from 0, then split each step the same way.",
    templateIds: ["equivalent-fractions-number-line"],
    objectives: [
      "Name one marked point with fractions in at least three denominators.",
      "Include points greater than 1.",
    ],
    openingTitle: "Same point, smaller steps",
    opening: [
      "If each whole has 4 equal steps and $P$ is 3 steps from 0, one name is 3/4.",
      "Split each fourth into 2 eighths. The same point is 6 eighths, or 6/8. Split again and it is 9/12.",
    ],
    example: {
      prompt: "Point $P$ is at 3/4. Which fractions name $P$?",
      steps: [
        "3 steps of size 1/4 land on $P$.",
        "6 steps of size 1/8 land on the same point, so 6/8 names $P$.",
        "9 steps of size 1/12 also land there, so 9/12 names $P$.",
      ],
      answer: "3/4, 6/8, and 9/12",
    },
    methodTitle: "Count, then split",
    method: [
      "Count steps from 0 to the point.",
      "Split every step into the same number of smaller steps and count again.",
    ],
    formalTitle: "Same point",
    formal: [
      "$p/b$ and $(p \\times k)/(b \\times k)$ name the same distance from 0.",
      "A point past 1 has a numerator greater than the line's denominator.",
    ],
    pitfalls: [
      "Do not pick a fraction with the right numerator and the wrong denominator.",
      "Do not reduce a name when the question asks for that denominator.",
    ],
    parentGuide:
      "Fold a strip into fourths, mark 3, then fold each fourth in half and count the smaller steps.",
  }),
  lesson({
    id: "compare-fractions-symbol-lesson",
    title: "Compare fractions with symbols",
    summary:
      "Rename fractions of the same whole so the pieces match. Then choose greater than, equal to, or less than.",
    templateIds: ["compare-fractions-symbol-blanks"],
    objectives: [
      "Record a fraction comparison with a symbol.",
      "Recognize two fractions that name the same amount.",
    ],
    openingTitle: "Same pieces, then the symbol",
    opening: [
      "2/3 and 8/12 name the same amount, because 2/3 multiplied on the top and the bottom by 4 is 8/12.",
      "1/2 and 3/4 do not. Over the denominator 4, they are 2/4 and 3/4. 2 is less than 3, so 1/2 is less than 3/4.",
    ],
    example: {
      prompt:
        "Choose the symbol for 2/3 compared with 8/12, and for 1/2 compared with 3/4.",
      steps: [
        "2/3 and 8/12 name the same amount, so the symbol means the same amount.",
        "1/2 is 2/4, and 3/4 stays 3/4.",
        "2 is less than 3, so 1/2 is less than 3/4.",
      ],
      answer: "the same amount, then less than",
    },
    methodTitle: "Rename, then compare",
    method: [
      "Find a common denominator or a shared amount.",
      "Compare the top numbers and choose the symbol.",
    ],
    formalTitle: "Cross products",
    formal: [
      "$a/b$ is less than $c/d$ when $a \\times d$ is less than $c \\times b$.",
      "The amounts are the same when the cross products match.",
    ],
    pitfalls: [
      "Do not treat a larger denominator as a larger fraction.",
      "Do not compare fractions of different wholes.",
    ],
    parentGuide:
      "Ask the learner to say the words greater than, equal to, or less than before choosing the symbol.",
  }),
  lesson({
    id: "compare-decimals-symbol-lesson",
    title: "Compare decimals with symbols",
    summary:
      "Line up the decimal points. A zero at the end does not change the value. Then choose the symbol.",
    templateIds: ["compare-decimals-symbol-blanks"],
    objectives: [
      "Record a decimal comparison to hundredths with a symbol.",
      "Treat a trailing zero as the same amount.",
    ],
    openingTitle: "Line up the points",
    opening: [
      "0.5 is 5 tenths. 0.50 is 5 tenths and 0 hundredths. They are the same amount.",
      "0.45 is 4 tenths and 5 hundredths. 5 tenths is more than 4 tenths, so 0.5 is greater than 0.45.",
    ],
    example: {
      prompt:
        "Choose the symbol for 0.5 compared with 0.50, and for 0.5 compared with 0.45.",
      steps: [
        "0.5 and 0.50 have the same tenths digit, and the extra zero adds nothing.",
        "They are the same amount.",
        "0.5 has 5 tenths and 0.45 has 4 tenths, so 0.5 is greater than 0.45.",
      ],
      answer: "the same amount, then greater than",
    },
    methodTitle: "Tenths, then hundredths",
    method: [
      "Give each decimal a hundredths digit. Use 0 if it is missing.",
      "Compare tenths, then hundredths, and choose the symbol.",
    ],
    formalTitle: "Hundredths",
    formal: [
      "0.5 = 0.50 because both are 50 hundredths.",
      "Compare the first place that differs.",
    ],
    pitfalls: [
      "Do not say a two-digit decimal is greater because it has more digits.",
      "Do not ignore a zero in the tenths place, as in 0.05.",
    ],
    parentGuide:
      "Write both decimals in a place-value chart before choosing the symbol.",
  }),
  lesson({
    id: "decimal-fraction-locate-lesson",
    title: "Locate a decimal or a fraction",
    summary:
      "Count tick marks from a numbered end. The letter on that tick mark is the point at the given value.",
    templateIds: ["decimal-fraction-locate"],
    objectives: [
      "Locate a fraction in tenths on a number line.",
      "Locate a decimal in hundredths on a number line.",
    ],
    openingTitle: "Count the steps",
    opening: [
      "A line from 0 to 2 with steps of one tenth has a tick at every tenth.",
      "Seven steps from 0 land at 7/10. The letter on that tick mark is the answer.",
    ],
    example: {
      prompt: "Which point is at 7/10?",
      steps: [
        "Each step from 0 is one tenth.",
        "Count 7 steps.",
        "The letter on that tick mark is the point at 7/10.",
      ],
      answer: "the letter 7 tenths from 0",
    },
    methodTitle: "From the labeled end",
    method: [
      "Read the step size.",
      "Count from the left end to the given value and read the letter.",
    ],
    formalTitle: "Tenths and hundredths",
    formal: [
      "Tenths are steps of 1/10.",
      "Hundredths are steps of 0.01 on a short window of the line.",
    ],
    pitfalls: [
      "Do not choose the letter one step past the value.",
      "Do not read the value printed on the end as the letter's value.",
    ],
    parentGuide:
      "Cover the letters and count the ticks aloud, then uncover the letter you landed on.",
  }),
  lesson({
    id: "decimal-place-value-hundredths-lesson",
    title: "Decimal place value to hundredths",
    summary:
      "Name the place of one digit in a decimal that stops at hundredths, then say what that digit is worth.",
    templateIds: ["decimal-place-value-hundredths"],
    objectives: [
      "Name the ones, tenths, or hundredths place of a digit.",
      "Give the value of that digit, including in a number such as 3.05.",
    ],
    openingTitle: "Place, then value",
    opening: [
      "In 3.05, the 3 is in the ones place and is worth 3.",
      "The 0 holds the tenths place. The 5 is in the hundredths place and is worth 0.05.",
    ],
    example: {
      prompt: "In 3.05, name the place and the value of the digit 5.",
      steps: [
        "The digits after the point are tenths, then hundredths.",
        "The 5 is the second digit after the point, so it is in the hundredths place.",
        "Five hundredths is 0.05.",
      ],
      answer: "hundredths, 0.05",
    },
    methodTitle: "From the point",
    method: [
      "Find the digit's place: ones, tenths, or hundredths.",
      "Multiply the digit by 1, by 0.1, or by 0.01.",
    ],
    formalTitle: "Hundredths only",
    formal: [
      "These decimals have exactly two digits after the point.",
      "A zero in the tenths place, as in 3.05, keeps the 5 in the hundredths place.",
    ],
    pitfalls: [
      "Do not call 0.05 five tenths.",
      "Do not read past hundredths. These numbers stop there.",
    ],
    parentGuide:
      "Write the number in a chart with columns for ones, tenths, and hundredths.",
  }),
];

export const grade4FractionsDecimalsFacetMappings: FacetMapping[] = [
  {
    templateId: "fraction-decompositions-select",
    facetId: "like-fraction-addition.decompose-and-story",
    extent: "partial",
    rationale:
      "Selects every sum with one denominator that matches a shaded fraction, including a sum of unit fractions and amounts greater than one.",
  },
  {
    templateId: "like-fraction-sum-story",
    facetId: "like-fraction-addition.decompose-and-story",
    extent: "partial",
    rationale:
      "Adds two fractions of one whole in a length, volume, or time story, including sums greater than 1.",
  },
  {
    templateId: "like-fraction-missing-part",
    facetId: "like-fraction-addition.decompose-and-story",
    extent: "partial",
    rationale: "Finds one missing addend in a like-denominator equation.",
  },
  {
    templateId: "like-fraction-difference",
    facetId: "like-fraction-addition.decompose-and-story",
    extent: "partial",
    rationale:
      "Subtracts two fractions of one length with the same denominator.",
  },
  {
    templateId: "mixed-fraction-sum",
    facetId: "mixed-numbers.add-subtract",
    extent: "partial",
    rationale:
      "Adds mixed numbers that share a denominator, including sums that regroup.",
  },
  {
    templateId: "mixed-fraction-difference",
    facetId: "mixed-numbers.add-subtract",
    extent: "partial",
    rationale: "Subtracts mixed numbers that share a denominator and regroup.",
  },
  {
    templateId: "unit-fraction-multiple-blanks",
    facetId: "fraction-times-whole.unit-multiple",
    extent: "partial",
    rationale:
      "Writes a fraction as copies of a unit fraction and a product as copies of that unit fraction.",
  },
  {
    templateId: "whole-times-fraction",
    facetId: "fraction-times-whole.unit-multiple",
    extent: "partial",
    rationale:
      "Finds the product of a whole number and a fraction in a measurement story.",
  },
  {
    templateId: "equivalent-fractions-number-line",
    facetId: "fraction-equivalence.number-line-and-identity",
    extent: "partial",
    rationale:
      "Selects at least three denominator names for one point on a number line, including points greater than 1.",
  },
  {
    templateId: "equivalent-numerator",
    facetId: "fraction-equivalence.number-line-and-identity",
    extent: "partial",
    rationale:
      "Builds a fraction that names the same amount by multiplying the numerator and the denominator by the same whole number.",
  },
  {
    templateId: "compare-fractions-symbol-blanks",
    facetId: "fraction-comparison.symbols",
    extent: "partial",
    rationale:
      "Records fraction comparisons with greater than, equal to, or less than, including pairs that name the same amount.",
  },
  {
    templateId: "compare-fractions-reason-blanks",
    facetId: "fraction-comparison.symbols",
    extent: "partial",
    rationale:
      "States why one fraction is greater, or that fractions of different wholes cannot be compared.",
  },
  {
    templateId: "compare-decimals-symbol-blanks",
    facetId: "compare-decimals.symbols",
    extent: "partial",
    rationale:
      "Records decimal comparisons to hundredths, including a trailing zero that does not change the value.",
  },
  {
    templateId: "staar-order-decimals",
    facetId: "compare-decimals.symbols",
    extent: "partial",
    rationale:
      "Orders decimals. The grade-4 weighting uses hundredths, and the legacy surface uses thousandths.",
  },
  {
    templateId: "decimal-fraction-locate",
    facetId: "decimal-fractions.locate-and-place",
    extent: "partial",
    rationale:
      "Chooses the letter of the point at a given tenth or hundredth on a number line.",
  },
  {
    templateId: "decimal-place-value-hundredths",
    facetId: "decimal-fractions.locate-and-place",
    extent: "partial",
    rationale:
      "Names the place and the value of one digit in a decimal that stops at hundredths, including a zero placeholder.",
  },
  {
    templateId: "tenths-as-hundredths",
    facetId: "decimal-fractions.locate-and-place",
    extent: "partial",
    rationale:
      "Renames tenths as hundredths, including mixed numbers and values above one.",
  },
];
