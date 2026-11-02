import type { Lesson } from "./lessons.js";
/** Original introductory lessons for specific implemented facets, not whole-standard coverage. */
export const extendedLessons: Lesson[] = [
  {
    id: "digit-value",
    title: "A digit gets its value from its place",
    summary:
      "A digit is one of the symbols 0 to 9. Its place in a number tells how much it is worth. Ten ones make a ten, and ten tens make a hundred. In 352, the 3 means 3 hundreds. The 5 means 5 tens, which is 50. The 2 means 2 ones.",
    noLink: ["mean"],
    templateIds: ["place-value-digit"],
    objectives: [
      "Name the ones, tens and hundreds places.",
      "Tell a digit apart from the value it stands for.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Build larger bundles",
        paragraphs: [
          "Ten ones make one ten. Ten tens make one hundred.",
          "Look at 352. The 3 counts hundreds. The 5 counts tens. The 2 counts ones.",
          "Each digit gets its value from its place. Its value is how much it is worth.",
        ],
      },
      {
        title: "Groups of ten",
        paragraphs: [
          "Picture sticks. Tie 10 single sticks together to make a bundle of ten. Then 10 bundles of ten make one hundred.",
          "Each place to the left is worth ten times as much. So a 5 can mean five, fifty or five hundred. It depends on its place.",
        ],
      },
      {
        title: "Expand the number",
        paragraphs: [
          "Write 352 as $300+50+2$. This is called expanded form. It shows what each digit is worth.",
          "The tens digit of 352 is 5. Its value is fifty, not five. Five names the digit. Fifty is what it is worth here.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Base-ten expansion",
        paragraphs: [
          "A whole number is the sum of each digit times its place value. The place value is what one in that place is worth: 1, 10, 100 and so on.",
          "Each place is worth ten times the place to its right. So trading ten of one place for one of the next place keeps the number the same.",
        ],
      },
    ],
    workedExample: {
      prompt: "What value does the tens digit represent in 352?",
      steps: [
        "The tens place is second from the right. In 352, the tens digit is 5.",
        "Each ten is worth 10, so five tens are $5\\times10=50$.",
      ],
      answer: "50",
    },
    pitfalls: [
      "A digit and its value are different. In 352 the digit 5 is worth 50.",
      "Find the places from the right: ones, then tens, then hundreds.",
    ],
    parentGuide:
      "Use bundles of ten sticks and single sticks. Ask the learner to build fifty-two and explain why the 5 means fifty.",
  },
  {
    id: "adding-decimals",
    title: "Add matching decimal places",
    summary:
      "A decimal uses a point to show parts of one whole. The first place after the point is tenths, and the second is hundredths. Add tenths to tenths and hundredths to hundredths, just as you add ones to ones. Line up the decimal points so matching places line up. If a place adds up to 10 or more, carry 1 to the place on its left.",
    senses: {
      part: "part",
      parts: "part",
      whole: "whole",
      "more than": "more-than",
      squares: "square-shape",
      units: "unit",
      unit: "unit",
    },
    noLink: ["change"],
    templateIds: ["decimal-addition"],
    objectives: [
      "Line up decimal places to add.",
      "Regroup hundredths into tenths when adding.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Join matching parts",
        paragraphs: [
          "A tenth is one of 10 equal parts of a whole. A hundredth is one of 100 equal parts.",
          "One and two tenths plus three tenths is one and five tenths: $1.2+0.3=1.5$.",
          "Adding tenths to tenths works just like adding ones to ones. Line up the decimal points so the parts you join are the same size.",
        ],
      },
      {
        title: "Name the units",
        paragraphs: [
          "The number 1.25 is 125 hundredths. The number 0.60 is 60 hundredths.",
          "Zeros at the end, after the decimal point, do not change the amount: $0.6=0.60$. They can help line up the places.",
        ],
      },
      {
        title: "Add and regroup",
        paragraphs: [
          "Add hundredths to hundredths and tenths to tenths. Ten hundredths make one tenth, just as ten ones make one ten. Trading them like this is called regrouping, or carrying.",
          "Estimate first. An estimate is a quick answer that is close. 1.25 is a bit more than 1, and 0.60 is a bit more than half. So the sum should be between 1 and 2.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Like decimal units",
        paragraphs: [
          "Adding decimals joins counts of the same place-value units: ones with ones, tenths with tenths, hundredths with hundredths.",
          "Lining up the decimal points lines up those places. Zeros can be written after the last digit to the right of the point without changing the value.",
        ],
      },
    ],
    workedExample: {
      prompt: "What is 1.25 + 0.60?",
      steps: [
        "Write both numbers in hundredths, the smallest place used: 1.25 is 125 hundredths, and 0.60 is 60 hundredths.",
        "Add the counts like whole numbers: $125+60=185$ hundredths.",
        "185 hundredths is 1 whole and 85 hundredths, which is 1.85. It is between 1 and 2, as estimated.",
      ],
      answer: "1.85",
    },
    pitfalls: [
      "Line up the decimal points, not the last digits.",
      "Regrouping does not change the total amount.",
    ],
    parentGuide:
      "Use a hundred-square grid as one whole. Shade each number being added, then count the shaded squares together.",
  },
  {
    id: "comparing-fractions",
    title: "Compare pieces with the same unit",
    summary:
      "A fraction like $\\tfrac34$ names equal pieces of one whole. The bottom number, the denominator, tells how many pieces make the whole. The top number, the numerator, tells how many pieces you have. To rename a fraction means to write the same amount another way. Rename both fractions with the same denominator, called a common denominator. Then the pieces are the same size, and more pieces means more.",
    senses: {
      whole: "whole",
      wholes: "whole",
      fourths: "fourth",
      rename: "rename",
      "more than": "more-than",
    },
    templateIds: ["compare-fractions"],
    objectives: [
      "Find a common denominator.",
      "Compare fractions without looking only at the size of the denominator.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Use pieces of one size",
        paragraphs: [
          "Compare $\\tfrac12$ and $\\tfrac34$ of the same pizza. Cut the half into 2 equal pieces. Now it is $\\tfrac24$, two fourths.",
          "Two fourths sit next to three fourths, and three fourths is more. Both wholes must be the same size.",
        ],
      },
      {
        title: "Use the same whole",
        paragraphs: [
          "Compare fractions of the same whole, or of wholes the same size. In a picture, check that the wholes match.",
          "A bigger denominator means smaller pieces: $\\tfrac18$ is less than $\\tfrac15$. But the numerator matters too. Do not compare the numerators and the denominators on their own.",
        ],
      },
      {
        title: "Rename and compare",
        paragraphs: [
          "Write $\\tfrac23$ and $\\tfrac34$ in twelfths. Multiply the top and bottom of $\\tfrac23$ by 4 to get $\\tfrac{8}{12}$. Multiply the top and bottom of $\\tfrac34$ by 3 to get $\\tfrac{9}{12}$.",
          "Multiplying the top and bottom by the same number cuts each piece smaller and takes more of them. So the amount stays the same.",
          "Now the pieces match. Nine twelfths is more than eight twelfths, so $\\tfrac34$ is larger.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Compare a common whole",
        paragraphs: [
          "Fractions that name the same amount are called equivalent fractions, like $\\tfrac23$ and $\\tfrac{8}{12}$.",
          "To compare fractions of the same whole, rename both with a common denominator. Then the larger numerator means the larger amount, because the pieces are the same size.",
        ],
      },
    ],
    workedExample: {
      prompt: "Which is larger: 2/3 or 3/4?",
      steps: [
        "Multiply the two denominators to get a common denominator: $3\\times4=12$. Then $\\tfrac23=\\tfrac{8}{12}$ and $\\tfrac34=\\tfrac{9}{12}$.",
        "The pieces are now the same size. 9 is more than 8, so $\\tfrac{9}{12}$ is larger. Choose $\\tfrac34$.",
      ],
      answer: "3/4",
    },
    pitfalls: [
      "A bigger denominator alone does not make a bigger fraction.",
      "Equivalent fractions are equal. Neither one is larger.",
    ],
    parentGuide:
      "Draw two strips of the same length. Split both into twelfths, and compare the shaded lengths.",
  },
  {
    id: "multiplying-fractions",
    title: "A fraction of a fraction",
    summary:
      "A fraction like $\\tfrac34$ names equal pieces of a whole. The top number, the numerator, counts the pieces. The bottom number, the denominator, tells how many pieces make the whole. $\\tfrac12\\times\\tfrac34$ means $\\tfrac12$ of $\\tfrac34$: a part of a part. Multiply the numerators, then the denominators. To simplify, divide the top and bottom by the same number. A number that divides both is called a common factor.",
    senses: {
      part: "part",
      parts: "part",
      whole: "whole",
      fourths: "fourth",
      product: "product-multiply",
      factor: "factor-number",
      "more than": "more-than",
      eighths: "eighth",
    },
    templateIds: ["multiply-fractions"],
    objectives: [
      "Show a fraction times a fraction with an area model, a rectangle cut both ways.",
      "Multiply fractions and simplify the answer.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Take a part of a part",
        paragraphs: [
          "To find one half of three fourths, split the three fourths into two equal shares. Then take one share.",
          "Picture a rectangle that is one whole. Cut it into fourths one way and halves the other way. The whole now has 8 small equal parts.",
          "Shade 3 fourths, then take half of that shading. It covers 3 of the 8 small parts: $\\tfrac38$.",
        ],
      },
      {
        title: "Take part of an amount",
        paragraphs: [
          "One half of three fourths means split three fourths into two equal parts and take one. The answer is three eighths.",
          "On one rectangle, shade fourths in one direction and halves in the other. Where the two shadings overlap, they cover 3 of 8 equal small parts.",
        ],
      },
      {
        title: "Multiply the counts",
        paragraphs: [
          "Multiply the numerators to count the small parts you take: $1\\times3=3$. Multiply the denominators to count all the small parts in the whole: $2\\times4=8$.",
          "When both fractions are more than 0 and less than 1, the answer is smaller than either one. That makes sense, because you take only part of an amount.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "A fraction of a fraction",
        paragraphs: [
          "With letters, $\\tfrac{a}{b}$ of $\\tfrac{c}{d}$ is $\\tfrac{a\\times c}{b\\times d}$. Here $b$ and $d$ are not 0.",
          "Each of the $d$ pieces is split into $b$ smaller pieces. So the whole has $b\\times d$ small pieces, and you take $a\\times c$ of them.",
        ],
      },
    ],
    workedExample: {
      prompt: "What is 1/2 × 3/4?",
      steps: [
        "$\\tfrac12\\times\\tfrac34$ means $\\tfrac12$ of $\\tfrac34$. Multiply the numerators to count the parts you take: $1\\times3=3$.",
        "Multiply the denominators to count the equal parts in the whole: $2\\times4=8$.",
        "So the product, the answer to the times, is $\\tfrac38$. No number except 1 divides both 3 and 8, so it is already simplified.",
      ],
      answer: "3/8",
    },
    pitfalls: [
      "Multiplying does not always make a number bigger.",
      "You do not need a common denominator to multiply fractions.",
    ],
    parentGuide:
      "Use a rectangle on grid paper. Shade one half one way and three fourths the other way. Talk about the overlap.",
  },
  {
    id: "dividing-fractions",
    senses: {
      "more than": "more-than",
      fourths: "fourth",
      eighth: "eighth",
      eighths: "eighth",
      parts: "part",
      whole: "whole",
    },
    title: "How many fractional groups fit?",
    summary:
      "A fraction is a number of equal parts of 1 whole, such as $\\tfrac{3}{4}$: 3 of 4 equal parts. Dividing by a fraction asks how many groups of that size fit. For example, $\\tfrac{3}{4} \\div \\tfrac{1}{8}$ asks how many eighths fit in three fourths, and the answer is 6. A quick way to get it is to multiply by the reciprocal, the fraction flipped upside down.",
    templateIds: ["divide-fractions"],
    objectives: [
      "Explain dividing by a fraction as counting how many groups of that size fit.",
      "Divide by multiplying by the reciprocal of the number you divide by, which must not be 0.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Count how many small groups fit",
        paragraphs: [
          "A fraction is a number of equal parts of 1 whole. The denominator, the bottom number, says how many equal parts make 1 whole. The numerator, the top number, says how many parts you have. So $\\tfrac{3}{4}$ is 3 parts when the whole is cut into 4.",
          "Cut each fourth in half, and the whole is now 8 equal parts called eighths. Each fourth becomes 2 eighths, so three fourths is the same as six eighths: $\\tfrac{3}{4} = \\tfrac{6}{8}$.",
          "So six groups of one eighth fit into three fourths. The answer, 6, is bigger than $\\tfrac{3}{4}$. That happens because each group is smaller than 1 whole.",
        ],
      },
      {
        title: "Measure in smaller groups",
        paragraphs: [
          "Division is the operation that splits an amount into groups of the same size. It can ask how many groups of a given size fit into an amount. For example, 12 ÷ 3 asks how many 3s fit into 12. In the same way, $\\tfrac{3}{4} \\div \\tfrac{1}{8}$ asks how many pieces of size $\\tfrac{1}{8}$ fit into $\\tfrac{3}{4}$. Since three fourths is six eighths, the answer is 6.",
          "The answer of a division is called the quotient. The number being divided is the dividend, and the number you divide by is the divisor. When the divisor is between 0 and 1 and the dividend is more than 0, the quotient is bigger than the dividend. The question counts groups, not the amount in one group.",
        ],
      },
      {
        title: "Why the reciprocal works",
        paragraphs: [
          "The reciprocal of a fraction (not 0) swaps its top and bottom numbers. The reciprocal of $\\tfrac{1}{8}$ is $\\tfrac{8}{1}$, which is 8. A number times its reciprocal is always 1: $\\tfrac{1}{8} \\times 8 = 1$.",
          "How many eighths fit in 1 whole? Eight. So the number of eighths in $\\tfrac{3}{4}$ is $\\tfrac{3}{4} \\times 8 = 6$. Multiplying by the reciprocal counts groups of the divisor's size.",
          "In general, to divide $\\tfrac{a}{b}$ by $\\tfrac{c}{d}$, multiply $\\tfrac{a}{b}$ by $\\tfrac{d}{c}$. Here $a$, $b$, $c$ and $d$ stand for whole numbers. The divisor must not be 0, so $c$ cannot be 0, and no denominator can be 0.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Count groups of a fractional size",
        paragraphs: [
          "Let $\\tfrac{a}{b}$ be a fraction and $\\tfrac{c}{d}$ a fraction that is not 0, with $b$ and $d$ not 0. Then $\\tfrac{a}{b} \\div \\tfrac{c}{d} = \\tfrac{a}{b} \\times \\tfrac{d}{c}$. Multiplying by the reciprocal counts how many groups of size $\\tfrac{c}{d}$ fit into $\\tfrac{a}{b}$.",
        ],
      },
    ],
    workedExample: {
      prompt: "What is 3/4 ÷ 1/8?",
      steps: [
        "Write both fractions in eighths so the pieces are the same size. Each fourth is 2 eighths, so $\\tfrac{3}{4} = \\tfrac{6}{8}$.",
        "Count the groups: 6 pieces of size $\\tfrac{1}{8}$ fit in $\\tfrac{6}{8}$.",
        "Check with the reciprocal: the reciprocal of $\\tfrac{1}{8}$ is $\\tfrac{8}{1}$, and $\\tfrac{3}{4} \\times \\tfrac{8}{1} = \\tfrac{24}{4} = 6$.",
      ],
      answer: "6",
    },
    pitfalls: [
      "Flip the number you divide by, the divisor, not the first number.",
      "Dividing by 0 has no answer.",
      "The answer can be bigger than the number you started with when you divide by a fraction less than 1.",
    ],
    parentGuide:
      "Use a paper strip folded into eighths. Shade six parts to show three fourths, then count how many one-eighth groups are shaded.",
  },
  {
    id: "equivalent-ratios",
    senses: { parts: "part" },
    noLink: ["changes", "factor"],
    title: "Scale both parts of a ratio",
    summary:
      "A ratio compares two amounts, such as 2 cups of blue paint for every 3 cups of white. To make a bigger batch with the same color, multiply both amounts by the same number. That number is called the scale factor. Doubling both gives 4 cups blue to 6 cups white, the same mix. Ratios that describe the same mix are called equivalent ratios.",
    templateIds: ["ratio-missing"],
    objectives: [
      "Name the two amounts a ratio compares, in order.",
      "Multiply both amounts by the same scale factor to find a missing amount.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Keep the mix the same",
        paragraphs: [
          "A paint mix uses 2 cups of blue paint for every 3 cups of white paint. Make the same mix twice, and you use 2 × 2 = 4 cups of blue and 2 × 3 = 6 cups of white. The color stays exactly the same.",
          "So 4 cups to 6 cups is a bigger batch of the same mix. A multiplier is a number you multiply by. Both amounts grew by the same multiplier, 2.",
        ],
      },
      {
        title: "Keep the relationship",
        paragraphs: [
          "A ratio compares two amounts. The mix with 2 cups of blue for every 3 cups of white has a blue-to-white ratio of 2 : 3, read “2 to 3”. Doubling both amounts gives 4 : 6. Ratios like these, which describe the same mix, are called equivalent ratios.",
          "Order matters. Blue-to-white is 2 : 3, but white-to-blue is 3 : 2, a different comparison. Label the amounts before you calculate.",
        ],
      },
      {
        title: "Find the scale factor",
        paragraphs: [
          "Suppose the white paint goes from 3 cups to 12 cups. Since 12 ÷ 3 = 4, the white was multiplied by 4. The number both amounts are multiplied by is called the scale factor. Multiply the blue by 4 as well: 2 × 4 = 8 cups.",
          "Adding the same number to both amounts usually changes the ratio. Adding 9 cups to each gives 11 : 12, which is almost half blue, a bluer color than 2 : 3. Scaling multiplies both amounts by the same positive number instead.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Scale both quantities",
        paragraphs: [
          "Multiplying both numbers of a ratio by the same positive number keeps the comparison the same. When the second number is not 0, the first number divided by the second stays the same in every equivalent ratio. For 2 : 3 and 8 : 12, both give $\\tfrac{2}{3}$.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A mix uses 2 cups blue per 3 cups white. How much blue goes with 12 cups white?",
      steps: [
        "Find the scale factor from the white paint: 12 ÷ 3 = 4. So the recipe is made 4 times as big.",
        "Multiply the blue by the same scale factor so the color stays the same: 2 × 4 = 8 cups of blue.",
      ],
      answer: "8",
    },
    pitfalls: [
      "Match each number with its correct label, in the order the ratio gives.",
      "Adding the same amount to both parts usually changes the ratio. Multiply instead.",
    ],
    parentGuide:
      "Build several identical groups of two blue counters and three white counters. Count the totals of each color and compare them with 2 : 3.",
  },
  {
    id: "percent-quantity",
    senses: {
      changes: "change",
      "more than": "more-than",
      "one fourth": "fourth",
      parts: "part",
      whole: "whole",
      wholes: "whole",
    },
    title: "Percent means per hundred",
    summary:
      "Percent means per hundred, and the sign % stands for percent. So 25% means 25 out of every 100, which is $\\tfrac{25}{100}$, or one fourth. A percent is always a percent of some whole amount. To find 25% of 80, find one fourth of 80, which is 20.",
    templateIds: ["percent-of"],
    objectives: [
      "Write a percent as a fraction out of 100.",
      "Find a percent of a given whole amount.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Find the whole behind the percent",
        paragraphs: [
          "Imagine a whole cut into 100 equal parts. Twenty-five percent means 25 of those parts. That is $\\tfrac{25}{100}$, which is the same as $\\tfrac{1}{4}$, one fourth of the whole.",
          "One fourth of a small cake and one fourth of a large cake are different amounts of cake. In the same way, 25% of 40 is 10, but 25% of 80 is 20. So always name the whole before you find a percent of it.",
        ],
      },
      {
        title: "Identify the whole",
        paragraphs: [
          "Twenty-five percent means 25 out of each hundred: $25\\% = \\tfrac{25}{100} = \\tfrac{1}{4}$. A percent alone does not tell you an amount. It needs a whole to be a percent of.",
          "Twenty-five percent of 80 and twenty-five percent of 40 are different amounts, because the wholes are different.",
        ],
      },
      {
        title: "Multiply by the fraction",
        paragraphs: [
          "To find $p$ percent of an amount, where $p$ stands for the percent number, multiply the amount by $\\tfrac{p}{100}$. For 25% of 80: $80 \\times \\tfrac{25}{100} = 80 \\times \\tfrac{1}{4} = 20$. Simplifying the fraction first can make the arithmetic easier.",
          "If the whole is more than 0 and the percent is between 0 and 100, the answer is between 0 and the whole. Use that to check that your answer makes sense.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Percent means per hundred",
        paragraphs: [
          "A percent $p$ of a whole $W$ is $\\tfrac{p}{100} \\times W$. The same percent gives a different amount when the whole changes. So find the whole before you calculate.",
        ],
      },
    ],
    workedExample: {
      prompt: "What is 25% of 80?",
      steps: [
        "Percent means per hundred, so 25% = $\\tfrac{25}{100}$. Divide the top and bottom by 25 to simplify: $\\tfrac{25}{100} = \\tfrac{1}{4}$.",
        "The whole is 80. One fourth of 80 means 80 split into 4 equal parts: 80 ÷ 4 = 20.",
      ],
      answer: "20",
    },
    pitfalls: [
      "To multiply by 25%, use 0.25 or $\\tfrac{1}{4}$, not 25.",
      "Always find which amount is the whole.",
    ],
    parentGuide:
      "Split 80 small objects, or a drawn bar, into four equal groups. Show that one group is twenty-five percent of the whole.",
  },
  {
    id: "signed-addition",
    title: "Combine positive and negative changes",
    summary:
      "A number line is a line with evenly spaced marks for numbers. Numbers to the right of 0 are positive, meaning greater than 0. Numbers to the left are negative, meaning less than 0, and are written with a minus sign, like $-7$. Adding a positive number moves right, and adding a negative number moves left. Moves of the same length that go opposite ways cancel, meaning they undo each other.",
    templateIds: ["integer-addition"],
    senses: { change: "change", opposite: "opposite-number" },
    objectives: [
      "Show a sum of positive and negative numbers as moves on a number line.",
      "Cancel opposite pairs to find a sum, and explain why the answer has its sign.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Changes can point in opposite directions",
        paragraphs: [
          "A number line is a straight line with evenly spaced marks, where each step from one mark to the next is a change of 1. Zero is marked on it. Numbers to the right of 0 are positive, meaning greater than 0. Numbers to the left are negative, meaning less than 0. The number $-2$ is read negative two, and it sits 2 steps left of 0. Whether a number is positive or negative is called its sign. Zero is neither.",
          "Think of each number you add as a move. Adding 3 means move 3 steps right. Adding $-2$ means move 2 steps left. Start at 0 and make both moves: 3 steps right, then 2 steps back. You stop 1 step right of 0, so $3 + (-2) = 1$.",
          "The two moves partly cancel. The 2 left steps undo 2 of the right steps, and 1 right step is left over. The numbers 0, 1, 2, 3 and so on are called whole numbers. The whole numbers and their negatives, such as $-3$, 0 and 5, are called integers.",
        ],
      },
      {
        title: "Direction matters",
        paragraphs: [
          "Adding a positive number moves right. Adding a negative number moves left, even though the sign between the numbers is a plus. The minus sign belongs to the number, and it tells you which way to move.",
          "Find $(-7) + 12$. Start at $-7$, which is 7 steps left of 0. Adding 12 means 12 steps right. The first 7 steps bring you back to 0. The other 5 steps take you to 5. So $(-7) + 12 = 5$.",
        ],
      },
      {
        title: "Cancel opposite pairs",
        paragraphs: [
          "Counters show the same idea. A positive counter stands for $+1$, read positive one, and a negative counter stands for $-1$. One of each makes 0, because $1 + (-1) = 0$. Such a pair is called a zero pair. Removing a zero pair does not change the total.",
          "The size of a number is its distance from 0, ignoring the sign. This distance is called its absolute value. So $-8$ and 8 both have size 8.",
          "If both numbers have the same sign (both positive or both negative), nothing cancels. Add the sizes and keep the sign: $(-4) + (-5) = -9$. If the signs are different, pairs cancel. Subtract the smaller size from the larger one. The answer takes the sign of the number with the larger size, because its counters are the ones left over: $(-8) + 3 = -5$. If the sizes are equal, every counter is paired, and the answer is 0: $(-3) + 3 = 0$.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Opposite changes",
        paragraphs: [
          "For any number $a$, the number $-a$ is called its opposite, and $a + (-a) = 0$. To add two integers (whole numbers or their negatives) with the same sign, add their absolute values (distances from 0) and keep that sign. To add two integers with different signs, subtract the smaller absolute value from the larger. Then use the sign of the number with the larger absolute value. If the absolute values are equal, the sum (the result of adding) is 0.",
        ],
      },
    ],
    workedExample: {
      prompt: "What is (−7) + 12?",
      steps: [
        "A positive counter stands for $+1$ and a negative counter for $-1$. Show $-7$ as 7 negative counters and 12 as 12 positive counters.",
        "One positive and one negative counter make 0, because a step right and a step left cancel. So pair them up and remove all 7 pairs. Removing zeros does not change the total.",
        "Count what is left: 12 − 7 = 5 positive counters. So $(-7) + 12 = 5$.",
      ],
      answer: "5",
    },
    pitfalls: [
      "A minus sign belongs to its number. In $5 + (-3)$, the $-3$ is a move of 3 steps to the left.",
      "Adding a negative number moves left, even though you are adding. $5 + (-3) = 2$, which is less than 5.",
      "With different signs, the answer takes the sign of the number farther from 0: $(-8) + 3 = -5$, not 5. If both are the same distance from 0, the answer is 0.",
    ],
    parentGuide:
      "Use counters in two colors, one for positive and one for negative. Build a sum such as $(-7) + 12$ and remove matching pairs. Ask the learner what is left, and why the answer is positive or negative.",
  },
  {
    id: "slope-two-points",
    title: "Slope measures change per step",
    summary:
      "Slope tells how steep a line is and which way it tilts. Pick two points on the line. Find how far the line goes up or down between them, and how far it goes across. Slope is the up-or-down change divided by the across change. A slope of 2 means up 2 for every 1 step to the right.",
    templateIds: ["line-slope"],
    senses: { change: "change" },
    noLink: ["mean", "part", "parts", "whole", "leaves"],
    objectives: [
      "Find the change in $x$ and the change in $y$ between two points, subtracting in the same order.",
      "Explain what a positive, negative or zero slope says about the line.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Compare two changes on the same line",
        paragraphs: [
          "A point on a grid is named by two numbers in brackets, like $(1, 2)$. These two numbers are its coordinates. The first, the $x$-coordinate, says how far to the right of the origin (the starting point, $(0, 0)$) to go. The second, the $y$-coordinate, says how far up. So $(1, 2)$ means 1 right and 2 up. Negative coordinates mean left or down.",
          "Walk along a line from $(1, 2)$ to $(5, 8)$. Across, you go from $x = 1$ to $x = 5$: that is 4 steps right. Up, you go from $y = 2$ to $y = 8$: that is 6 steps up. The up-or-down change is called the rise. The across change is called the run.",
          "Slope is the rise divided by the run: $\\tfrac{6}{4}$. Dividing the top and bottom of a fraction by the same whole number greater than 1 gives an equal fraction with smaller numbers. This is called simplifying. Divide both by 2 to get $\\tfrac{3}{2}$. It means the line climbs 3 grid steps for every 2 steps to the right, which is 1.5 steps up for every 1 step right. On a straight line that is not vertical, any two different points give the same slope, so the slope belongs to the whole line.",
        ],
      },
      {
        title: "Use a consistent direction",
        paragraphs: [
          "To write this for any two points, mark each letter with a small number below it, called a subscript. Point 1 is $(x_1, y_1)$, read “$x$ one, $y$ one”. Point 2 is $(x_2, y_2)$. A subscript only says which point a number came from.",
          "Then slope $= \\frac{y_2 - y_1}{x_2 - x_1}$: the change in $y$ over the change in $x$. The letter $m$ is often used for slope. Subtract in the same point order on the top and the bottom: point 2 minus point 1 in both places.",
          "Why the same order? Going the other way, from $(5, 8)$ back to $(1, 2)$, the rise is 2 − 8 = −6 and the run is 1 − 5 = −4. Then $\\frac{-6}{-4} = \\frac{3}{2}$, the same slope, because a negative divided by a negative is positive. Mixing the orders gives $\\frac{8 - 2}{1 - 5} = \\frac{6}{-4}$, which has the wrong sign: negative instead of positive.",
          "A number's sign says whether it is positive (greater than 0) or negative (less than 0). The sign of the slope tells the tilt. A positive slope means the line goes up as you move right. A negative slope means it goes down as you move right.",
        ],
      },
      {
        title: "When a change is zero",
        paragraphs: [
          "A horizontal line runs flat, straight across. Its $y$-coordinate never changes, so the rise is 0. The run is not 0, and 0 divided by any number other than 0 is 0. So a horizontal line has slope 0.",
          "A vertical line runs straight up and down. Its $x$-coordinate never changes, so the run is 0. Dividing by 0 has no answer, so a vertical line has no slope number. We say its slope is undefined.",
          "In this practice the two points always have different $x$-coordinates, so there is always a slope number. A slope can be a fraction, such as $-\\tfrac{1}{6}$. Keep it as an exact fraction, simplified as far as it goes. A decimal such as $-0.17$ is only close to $-\\tfrac{1}{6}$, so do not round.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Slope from two points",
        paragraphs: [
          "For two points $(x_1, y_1)$ and $(x_2, y_2)$ with $x_1 \\ne x_2$ ($\\ne$ means is not equal to), the slope is $m = \\frac{y_2 - y_1}{x_2 - x_1}$.",
          "Swapping which point comes first changes the sign of both the top and the bottom. Changing the sign of both parts of a fraction leaves its value the same. So the slope is the same either way, whether it is positive, negative or 0.",
        ],
      },
    ],
    workedExample: {
      prompt: "Find the slope through (1, 2) and (5, 8).",
      steps: [
        "Name the points. Point 1 is $(1, 2)$, so its $x$ is 1 and its $y$ is 2. Point 2 is $(5, 8)$, so its $x$ is 5 and its $y$ is 8.",
        "Change in $y$ (the rise): $y$ goes from 2 to 8, and subtracting the start from the end measures the change. Point 2's $y$ minus point 1's $y$: 8 − 2 = 6.",
        "Change in $x$ (the run): subtract in the same order, point 2 minus point 1, so both changes describe the same walk. 5 − 1 = 4.",
        "Slope = rise ÷ run = $\\tfrac{6}{4}$. Divide the top and bottom by 2 to simplify: $\\tfrac{3}{2}$. The line goes up 3 for every 2 to the right.",
      ],
      answer: "3/2",
    },
    pitfalls: [
      "Use the same point first in both subtractions. Switching the order in only one of them flips a slope that is not 0 from positive to negative, or the reverse.",
      "Slope is the change in $y$ divided by the change in $x$: up-or-down over across. It is not across over up-or-down.",
    ],
    parentGuide:
      "On graph paper, mark the two points with dots. Draw a path from one to the other: first straight across, then straight up or down. Count and label each part, writing a move left or down as a negative number. Then divide the up-or-down count by the across count.",
  },
  {
    id: "systems-elimination",
    title: "Make two equations work together",
    summary:
      "A system is two equations about the same two unknown numbers, such as $x$ and $y$. Its solution is the pair of numbers that makes both equations true at the same time. To find it, combine the equations so one unknown disappears. Solve for the other one, then go back for the first.",
    templateIds: ["linear-system-x"],
    senses: { side: "side-of-equation", term: "term-expression" },
    noLink: ["change", "leaves", "mean", "part", "whole"],
    objectives: [
      "Remove one unknown by subtracting one equation from the other, after making its coefficients (the numbers multiplying it) match.",
      "Find the remaining unknown, and check the pair in both original equations.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Both statements must hold at once",
        paragraphs: [
          "An equation says two amounts are equal. A variable is a letter that stands for an unknown number. The equation $x + y = 5$ has many solutions, meaning pairs of numbers that make it true: $x = 1$ and $y = 4$, or $x = 2$ and $y = 3$, and many more.",
          "Two equations about the same $x$ and $y$ are called a system of equations. A solution of the system is a pair that makes both equations true at once. For $2x + y = 7$ and $x + y = 5$, the pair $x = 2$, $y = 3$ works in both: $2 \\times 2 + 3 = 7$ and $2 + 3 = 5$. The pair $x = 1$, $y = 4$ works only in the second, because $2 \\times 1 + 4 = 6$, not 7.",
          "Think of two shopping trips. Two apples and a banana cost 7 dollars. One apple and a banana cost 5 dollars. The first trip has exactly one more apple, and it costs 2 dollars more. So one apple costs 2 dollars. Comparing the trips made the banana drop out.",
        ],
      },
      {
        title: "Subtract to remove one unknown",
        paragraphs: [
          "Here is the same idea in symbols, with $x$ as the price of an apple and $y$ as the price of a banana. Write the equations in lined-up rows: $2x + y = 7$ above $x + y = 5$. Subtract the bottom row from the top row, column by column: $2x - x = x$, $y - y = 0$, and $7 - 5 = 2$. The $y$ is gone, leaving $x = 2$. Removing an unknown this way is called elimination.",
          "Why is this allowed? Taking equal amounts from both sides of an equation keeps it true. The bottom equation says that $x + y$ and 5 are the same amount. So taking $x + y$ from the left side of the top equation, and 5 from its right side, takes the same amount from both sides.",
          "Then go back for $y$. Put $x = 2$ into either original equation: $2 + y = 5$, so $y = 3$. Check the pair in both equations, because a pair that works in only one of them is not a solution of the system.",
        ],
      },
      {
        title: "Make the coefficients match first",
        paragraphs: [
          "The number multiplying a variable is called its coefficient. In $3x + 5y$, the coefficient of $y$ is 5. Subtracting removes $y$ only when its coefficients are the same in both equations.",
          "If they differ, multiply a whole equation by a number first. Multiply every term on both sides, so the two sides stay equal and the solutions do not change. The number must not be 0, because multiplying by 0 turns any equation into $0 = 0$ and loses its information.",
          "For $3x + 5y = -5$ and $3x + 4y = -7$, multiply the first equation by 4 and the second by 5. The $x$ coefficients already match here, so subtracting right away would remove $x$. But the question asks for $x$, so remove $y$ instead. Now both have $20y$: $12x + 20y = -20$ and $15x + 20y = -35$. Subtract the second from the first: $12x - 15x = -3x$, and $-20 - (-35) = -20 + 35 = 15$, since subtracting a negative is the same as adding. So $-3x = 15$. Dividing both sides by $-3$ undoes the multiplication and gives $x = -5$.",
          "Some systems have no solution, and some have infinitely many solutions, meaning endlessly many pairs. Every system in this practice has exactly one solution.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "A shared solution",
        paragraphs: [
          "A solution of a system of two equations makes both equations true. Two moves keep the solutions the same. One is multiplying an equation by a nonzero number, meaning any number except 0. The other is replacing one equation by the result of adding the other equation to it or subtracting the other from it.",
          "Elimination uses these moves to remove one variable. Then substitute, that is, put the value you found back into an original equation, and check the pair in both original equations.",
        ],
      },
    ],
    workedExample: {
      prompt: "Find $x$ if 2x + y = 7 and x + y = 5.",
      steps: [
        "The number multiplying a letter is called its coefficient. In both equations $y$ has coefficient 1, because $y$ means $1 \\times y$. Matching coefficients mean that subtracting one equation from the other will remove $y$.",
        "Subtract the second equation from the first, one part at a time on each side: $(2x - x) + (y - y) = 7 - 5$. Taking equal amounts from both sides keeps the equation true. That leaves $x = 2$.",
        "Find $y$ so the pair can be checked: put $x = 2$ into $x + y = 5$. Then $2 + y = 5$. Subtract 2 from both sides: $y = 3$.",
        "Check the pair in both original equations: $2 \\times 2 + 3 = 7$ and $2 + 3 = 5$. Both are true, so $x = 2$.",
      ],
      answer: "2",
    },
    pitfalls: [
      "Subtract every term, including the number on the right side of the equals sign.",
      "When you multiply an equation, multiply every term on both sides.",
      "A pair that makes only one equation true is not a solution of the system.",
    ],
    parentGuide:
      "Write the two equations in lined-up rows, with $x$ terms, $y$ terms and numbers in columns. Ask the learner to circle the matching $y$ terms before subtracting, and to say why subtracting keeps the equation true.",
  },
  {
    id: "equally-likely-probability",
    senses: { certain: "certain", event: "event", impossible: "impossible" },
    title: "Count favorable outcomes",
    summary:
      "Probability means chance: how likely something is to happen. An outcome is one possible result, such as drawing one counter from a bag. When every outcome is equally likely, count the outcomes you want, called favorable outcomes. Divide by the number of all possible outcomes. For 3 red and 5 blue counters, the chance of red is $\\tfrac{3}{8}$.",
    templateIds: ["simple-probability"],
    objectives: [
      "Name the event (the result you want) and the sample space (the list of all possible outcomes).",
      "Write a probability as an exact fraction.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Count the ways a result can happen",
        paragraphs: [
          "A bag holds 3 red counters and 5 blue counters, 8 in all. You reach in without looking and pull one out. Each counter has the same chance of being picked, so we say the picks are equally likely.",
          "Three of the eight possible picks are red. So the probability, or chance, of red is 3 out of 8, written $\\tfrac{3}{8}$.",
        ],
      },
      {
        title: "Count all possible objects",
        paragraphs: [
          "An outcome is one possible result. Here each counter is one outcome, so there are 8 outcomes. The list of all possible outcomes is called the sample space. The result you are asking about, such as drawing red, is called the event.",
          "Outcomes that make the event happen are called favorable outcomes. Drawing red has 3 favorable outcomes. Divide 3 by all 8 outcomes, not by the 5 blue counters.",
        ],
      },
      {
        title: "Interpret the probability",
        paragraphs: [
          "A probability is always from 0 to 1. A probability of 0 means the event is impossible, which means it cannot happen, such as drawing green from this bag. A probability of 1 means it is certain, which means sure to happen, such as drawing a counter that is red or blue.",
          "Suppose you put the counter back after each draw. A probability of $\\tfrac{3}{8}$ does not promise exactly 3 reds in every 8 draws. It describes the chance on each single draw.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Count favorable outcomes",
        paragraphs: [
          "Suppose the outcomes make a list you can finish counting, and each is equally likely. Then the probability of an event is the number of favorable outcomes divided by the total number of outcomes. The result is from 0 to 1, including both. If the outcomes are not equally likely, counting alone does not give the probability.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A bag contains 3 red and 5 blue equally likely counters. What is the probability of red?",
      steps: [
        "Count all possible outcomes. Each counter is one outcome: 3 + 5 = 8 counters in total.",
        "Count the favorable outcomes, the red counters: 3. Divide by all outcomes: the probability of red is $\\tfrac{3}{8}$.",
      ],
      answer: "3/8",
    },
    pitfalls: [
      "The bottom number counts every outcome, the ones you want and the ones you do not.",
      "Counting outcomes gives the probability only when the outcomes are equally likely.",
    ],
    parentGuide:
      "Predict the chance of red. Then draw a counter, put it back, and repeat many times. Talk about why a short run can differ from the prediction.",
  },
  {
    id: "arithmetic-sequence-terms",
    senses: {
      difference: "difference-subtract",
      jump: "jump",
      jumps: "jump",
      term: "term-sequence",
      terms: "term-sequence",
    },
    title: "Repeated addition in a sequence",
    summary:
      "A sequence is a list of numbers in order, and each number in it is called a term. In an arithmetic sequence, you add the same amount each time to get the next term. That amount is called the common difference. In 4, 7, 10, 13, the common difference is 3. To find a later term, count how many jumps of 3 it takes from the first term.",
    templateIds: ["arithmetic-term"],
    objectives: [
      "Write the terms of a sequence from its first term and common difference.",
      "Use the correct number of jumps from term 1 to reach a later term.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Repeat the same change",
        paragraphs: [
          "The numbers 4, 7, 10, 13 go up by 3 each time. A list of numbers in order like this is called a sequence, and each number is a term.",
          "The first term is 4. To reach the 2nd term takes 1 jump of 3. To reach the 4th term takes 3 jumps of 3: 4 + 3 + 3 + 3 = 13. So the number of jumps is one less than the term number.",
        ],
      },
      {
        title: "Find the fixed change",
        paragraphs: [
          "A sequence that adds the same amount each time is called an arithmetic sequence. The amount added is called the common difference. The sequence 4, 7, 10, 13 has first term 4 and common difference 3.",
          "The common difference can be negative. Then the terms go down, as in 20, 15, 10, 5, with common difference $-5$. A common difference of 0 repeats the same number.",
        ],
      },
      {
        title: "Jump to a later term",
        paragraphs: [
          "Let $a_1$ (read “$a$ sub 1”) stand for the first term, and let $d$ stand for the common difference. Term number $n$ is $a_1 + (n - 1)d$, where $(n - 1)d$ means $n - 1$ times $d$. There is one fewer jump than the term number.",
          "For the 5th term, start at the first term and make 4 jumps. For example, 4 + 4 × 3 = 16. Multiplying the first term by the term number, 4 × 5 = 20, is wrong, because the sequence adds; it does not multiply.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Fixed differences",
        paragraphs: [
          "An arithmetic sequence has the same difference $d$ between each term and the next. If its first term is $a_1$, then its term at position $n$, for $n = 1, 2, 3$ and so on, is $a_n = a_1 + (n - 1)d$.",
        ],
      },
    ],
    workedExample: {
      prompt: "First term 4, common difference 3: what is term 5?",
      steps: [
        "Term 5 is 4 jumps after term 1, because the number of jumps is one less than the term number: 5 − 1 = 4.",
        "Each jump adds 3, so add 4 jumps of 3 to the first term: 4 + 4 × 3 = 4 + 12 = 16.",
      ],
      answer: "16",
    },
    pitfalls: [
      "Use $n - 1$ jumps, one less than the term number, when the first term is term 1.",
      "Do not mix up a common difference, which is added, with a common ratio, which is multiplied.",
    ],
    parentGuide:
      "Write the term numbers above their values. Draw a labeled arrow for each jump of the common difference.",
  },
  {
    id: "function-input-output",
    senses: { part: "part", rule: "rule", squared: "square-number" },
    noLink: ["mean", "whole"],
    title: "Substitute an input into a function",
    summary:
      "A function is a rule that takes a number in, called the input, and gives exactly one number out, called the output. We write $f(x)$, read “$f$ of $x$”, for the output when the input is $x$. So $f(-2)$ means the output when the input is $-2$. To find it, put $-2$ in place of every $x$ in the rule and work it out.",
    templateIds: ["function-evaluation"],
    objectives: [
      "Read function notation: $f(x)$ is the output of the rule $f$ for the input $x$.",
      "Substitute the same input everywhere, then follow the order of operations.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Put a number into a rule",
        paragraphs: [
          "A function is a rule that takes a number in and gives exactly one number out. The number that goes in is the input. The number that comes out is the output.",
          "Say the rule is: double the number, then add 1. Input 3 gives 2 × 3 + 1 = 7.",
          "If the rule is named $f$, we write $f(x)$, read “$f$ of $x$”, for the output when the input is $x$. This rule is $f(x) = 2x + 1$, where $2x$ means 2 times $x$. Then $f(3) = 7$, and $f(-2)$ asks for the output when the input is $-2$: $2 \\times (-2) + 1 = -3$. Use the input everywhere the rule has $x$.",
        ],
      },
      {
        title: "The input belongs everywhere",
        paragraphs: [
          "The notation $f(-2)$ asks for the output of $f$ when the input is negative two. Replace every $x$ in the rule with $(-2)$, in parentheses. Putting a number in place of a letter is called substituting.",
          "The parentheses keep the minus sign attached to the number. This matters most with powers. In $x^2$, read “$x$ squared”, the input is multiplied by itself. Putting in $(-2)$ gives $(-2)^2 = (-2) \\times (-2) = 4$. Without parentheses, $-2^2$ would mean $-(2 \\times 2) = -4$.",
        ],
      },
      {
        title: "Evaluate in order",
        paragraphs: [
          "Work out powers first, then multiplication, then addition and subtraction. A rule like $2x^2 + 3x + 1$, with an $x^2$ part and no higher power, is called a quadratic. Its $x^2$ part and its $x$ part can come out with different signs for a negative input.",
          "Function notation does not mean $f$ times the input. The letter $f$ names the rule, and the parentheses hold the input.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "One output per allowed input",
        paragraphs: [
          "A function gives exactly one output for each allowed input. The set of allowed inputs is called the domain. To evaluate a rule at an input, replace every copy of the input letter with that value, keeping parentheses around it.",
        ],
      },
    ],
    workedExample: {
      prompt: "If f(x) = 2x² + 3x + 1, find f(−2).",
      steps: [
        "Put $(-2)$ in place of every $x$: $2(-2)^2 + 3(-2) + 1$.",
        "Work out the power first: $(-2)^2 = 4$, so the first part is $2 \\times 4 = 8$. The middle part is $3 \\times (-2) = -6$.",
        "Add and subtract from left to right: $8 - 6 + 1 = 3$.",
      ],
      answer: "3",
    },
    pitfalls: [
      "Replace every $x$ with the same input.",
      "$(-2)^2$ is positive 4, because a negative times a negative is positive.",
    ],
    parentGuide:
      "Ask the learner to write out the whole expression with the input put in before calculating. Check the signs separately from the arithmetic.",
  },
  {
    id: "unit-cost",
    senses: { "more than": "more-than", unit: "unit", units: "unit" },
    title: "Find one, then scale",
    summary:
      "The unit cost is the price of 1 item. To find it, divide the total cost by the number of items. Then multiply the unit cost by any number of items to find their total cost. For example, 4 notebooks for 12 dollars is 12 ÷ 4 = 3 dollars each, so 7 notebooks cost 7 × 3 = 21 dollars.",
    templateIds: ["unit-price"],
    objectives: [
      "Find the price of 1 item from a total price.",
      "Multiply the price of 1 item to find the cost of a new number of items.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Find the cost of one",
        paragraphs: [
          "Four identical notebooks cost 12 dollars in all.",
          "Share the 12 dollars equally among the 4 notebooks: 12 ÷ 4 = 3 dollars for one notebook. Once you know the cost of one, you can find the cost of any number of notebooks.",
        ],
      },
      {
        title: "Divide to find the unit",
        paragraphs: [
          "If four identical notebooks cost 12 dollars, each costs 12 ÷ 4 = 3 dollars. The amount for exactly 1 item is called a unit rate. Here it is 3 dollars per notebook, where per means for each one.",
          "This only works if every notebook costs the same. A discount for buying many, or a one-time fee, would need a different plan.",
        ],
      },
      {
        title: "Multiply to find the total",
        paragraphs: [
          "At 3 dollars per notebook, 7 notebooks cost 7 × 3 = 21 dollars. The unit rate links any number of notebooks to its total price.",
          "Keep the units in view. Dollars per notebook times notebooks gives dollars. That tells you to divide to find the unit rate, and multiply to find a total.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Constant cost per item",
        paragraphs: [
          "Suppose every item costs the same, and the number of items is more than 0. Then the unit cost is the total cost divided by the number of items. The total cost is the unit cost times the number of items. On a graph, the points lie on a straight line through 0 items and 0 dollars.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "Four notebooks cost 12 dollars. What do seven cost at the same unit price?",
      steps: [
        "Find the cost of 1 notebook. Share 12 dollars among 4 notebooks: 12 ÷ 4 = 3 dollars per notebook.",
        "Each of the 7 notebooks costs 3 dollars, so multiply: 7 × 3 = 21 dollars.",
      ],
      answer: "21",
    },
    pitfalls: [
      "Do not multiply by the original total price as if it were the price of one.",
      "This method assumes every item costs the same.",
    ],
    parentGuide:
      "Make a table of numbers of items and their prices. Ask what stays the same as the table grows.",
  },
  {
    id: "multiplying-decimals",
    title: "Multiply decimal-sized parts",
    summary:
      "A decimal uses a point to show parts of one whole. 1.2 is 12 tenths, and 0.3 is 3 tenths. The numbers you multiply are called factors. Multiply the counts like whole numbers: $12\\times3=36$. Then name the piece size: tenths times tenths make hundredths, so $1.2\\times0.3=0.36$. The answer has as many decimal places, digits after the point, as both factors together.",
    senses: {
      part: "part",
      parts: "part",
      whole: "whole",
      product: "product-multiply",
      factor: "factor-number",
      factors: "factor-number",
      "more than": "more-than",
      side: "side",
    },
    templateIds: ["decimal-multiplication"],
    objectives: [
      "Explain why tenths times tenths make hundredths.",
      "Estimate the size of a decimal product, the answer to a times.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Watch the size of the pieces",
        paragraphs: [
          "A tenth is one of 10 equal parts of a whole. A hundredth is one of 100 equal parts.",
          "Twelve tenths times three tenths makes thirty-six hundredths.",
          "The fact $12\\times3=36$ gives the count. But the pieces in the answer are hundredths, not ones.",
        ],
      },
      {
        title: "Use fractions to see the units",
        paragraphs: [
          "1.2 is twelve tenths, $\\tfrac{12}{10}$. 0.3 is three tenths, $\\tfrac{3}{10}$.",
          "Their product, the answer to the times, is $\\tfrac{12}{10}\\times\\tfrac{3}{10}=\\tfrac{36}{100}$: thirty-six hundredths.",
          "Multiplying the whole-number counts gives 36. The bottom numbers, the denominators, show that the answer is 0.36, not 3.6 or 36.",
        ],
      },
      {
        title: "Estimate before placing the decimal",
        paragraphs: [
          "Three tenths of 1.2 is less than 1.2. It is a little more than three tenths. That fits an answer of 0.36.",
          "Multiplying by a number between 0 and 1 makes a positive amount smaller. Multiplying does not always make a number bigger.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Place units multiply",
        paragraphs: [
          "A decimal with 1 digit after the point counts tenths. One with 2 digits after the point counts hundredths.",
          "Multiply the whole-number counts. The answer then has as many digits after the point as both factors together: 1 place and 1 place give 2 places, so $1.2\\times0.3=0.36$.",
          "With letters, a number with $p$ digits after the point times a number with $q$ digits after the point has $p+q$ digits after the point. Count any zeros at the end before you drop them: $0.5\\times0.2=0.10=0.1$.",
        ],
      },
    ],
    workedExample: {
      prompt: "What is 1.2 × 0.3?",
      steps: [
        "Write each decimal as a fraction: $\\tfrac{12}{10}\\times\\tfrac{3}{10}$.",
        "Multiply the tops and the bottoms: $\\tfrac{12\\times3}{10\\times10}=\\tfrac{36}{100}$. Tenths times tenths make hundredths.",
        "36 hundredths is 0.36. The estimate said a little more than 0.3, so this fits.",
      ],
      answer: "0.36",
    },
    pitfalls: [
      "Place the decimal point using place value, not by guessing.",
      "The product can be smaller than a number you multiplied: 0.36 is less than 1.2.",
    ],
    parentGuide:
      "Use a hundredths grid, or a rectangle with decimal side lengths, to connect the product to area.",
  },
  {
    id: "expression-order",
    title: "Read the structure of an expression",
    summary:
      "An expression is numbers and signs, like $+$ and $\\times$, that stand for one number. Parentheses ( ) group a part to work out first. The order of operations is the shared rule for what comes next: parentheses first, then powers, then multiply and divide, then add and subtract. A power, like $3^{2}=3\\times3$, multiplies a number by itself.",
    senses: { part: "part" },
    noLink: ["rule", "whole"],
    templateIds: ["operation-order"],
    objectives: [
      "Work out the group inside parentheses first.",
      "Multiply before adding outside the group.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Finish the inside group first",
        paragraphs: [
          "Parentheses ( ) hold a small calculation. Its answer is one amount.",
          "Find that amount first. Then use it in the rest of the calculation.",
          "After that, follow the shared order: multiply and divide, then add and subtract.",
        ],
      },
      {
        title: "Parentheses name one quantity",
        paragraphs: [
          "In $5+(2+3)\\times4$, the group $(2+3)$ is one amount: 5. Replace the group with its value.",
          "The expression becomes $5+5\\times4$. The first 5 is outside the group, so it stays as it is.",
        ],
      },
      {
        title: "Follow the remaining structure",
        paragraphs: [
          "Multiply before you add. So work out $5\\times4=20$, then add the first 5.",
          "When two steps have the same rank, like a times and a divide, work from left to right.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "An agreed order gives one value",
        paragraphs: [
          "This shared order is called the order of operations. Everyone uses it, so an expression has just one value.",
          "First work out groups. Then powers. Then multiply and divide, from left to right. Then add and subtract, from left to right.",
        ],
      },
    ],
    workedExample: {
      prompt: "Evaluate 5 + (2 + 3) × 4.",
      steps: [
        "Parentheses first: $2+3=5$. Now the expression is $5+5\\times4$.",
        "Multiply before adding: $5\\times4=20$. Now it is $5+20$.",
        "Add last: $5+20=25$.",
      ],
      answer: "25",
    },
    pitfalls: [
      "Do not just work every step from left to right. $2+3\\times4$ is 14, not 20.",
      "Only the numbers inside the parentheses belong to that group.",
    ],
    parentGuide:
      "Have the learner rewrite the whole line after each step, carrying along every part that has not changed yet.",
  },
];
