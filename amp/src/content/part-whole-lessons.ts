import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

const wholeAndParts: Lesson["sections"][number] = {
  title: "A whole and its equal parts",
  paragraphs: [
    "A whole is one complete thing: one sandwich, one paper square, one circle. Cutting it into equal parts, or equal shares, means every part is exactly the same size. Equal parts of a circle or rectangle cover the same amount of the shape.",
    "The number of equal parts names each part. Two equal parts are halves, three equal parts are thirds, and four equal parts are quarters, also called fourths. All the parts together make the whole again: two halves, three thirds or four quarters.",
  ],
};

export const partWholeLessons: Lesson[] = [
  {
    id: "halves-and-quarters",
    title: "Halves and quarters",
    summary: "Cut one whole into equal pieces to make halves or quarters.",
    templateIds: ["find-equal-shares", "name-equal-share", "larger-share"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Recognize when a shape is cut into two or four equal parts.",
      "Name shaded parts as one half, one quarter, two quarters or three quarters.",
      "Explain why one quarter of a whole is smaller than one half of the same whole.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Share one whole equally",
        paragraphs: [
          "Cut one sandwich into two equal pieces and each piece is a half. Cut each half in two again and you have four equal quarters. The pieces changed size, but together they still make the same sandwich.",
        ],
      },
      wholeAndParts,
      {
        title: "Check equal, then count",
        paragraphs: [
          "Before naming parts, check that they are the same size. A rectangle cut into two pieces of different sizes is not cut into halves, even though it has two pieces. A circle cut into four equal pieces is cut into quarters.",
          "Then count. One part of a whole cut into 2 equal parts is one half. One part of a whole cut into 4 equal parts is one quarter. Three of the four equal parts are three quarters.",
        ],
        illustration: "equal-shares",
      },
      {
        title: "More parts, smaller parts",
        paragraphs: [
          "Cut two same-size sandwiches: one into 2 equal parts and one into 4. The second sandwich has more pieces, but each piece is smaller, because the same whole is shared among more pieces.",
          "Two quarters fit exactly inside one half. So one half is larger than one quarter, and two quarters are the same amount as one half.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Equal parts of one whole",
        paragraphs: [
          "A unit fraction is one of a positive number of equal parts of a fixed whole. Two halves or four quarters reconstruct that whole; changing the whole's size changes the size of its parts.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A square is cut into 4 equal parts, and 3 parts are shaded. How much of the square is shaded?",
      steps: [
        "The 4 parts are the same size, so each part is one quarter.",
        "Count the shaded parts: 3.",
        "Three of the four quarters are shaded: three quarters.",
      ],
      answer: "three quarters",
    },
    pitfalls: [
      "Two pieces are halves only when the pieces are the same size.",
      "More pieces of the same whole means smaller pieces, not larger ones.",
    ],
    parentGuide:
      "Fold a paper square in half two different ways, then into quarters. Ask whether each piece is the same size, and how many quarters cover one half.",
  },
  {
    id: "halves-thirds-and-quarters",
    title: "Halves, thirds and quarters",
    summary: "Different cuts can show the same share of one whole.",
    templateIds: [
      "find-equal-thirds",
      "name-share",
      "same-share-different-shape",
    ],
    includeGeneratedRepresentation: false,
    objectives: [
      "Recognize circles and rectangles cut into two, three or four equal parts.",
      "Name shaded parts with halves, thirds and quarters, and the whole as all of its parts.",
      "Explain why equal shares of the same whole need not have the same shape.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Compare pieces of the same whole",
        paragraphs: [
          "A half and two quarters cover the same amount of one whole. The parts have different names because the whole was cut differently. Keep the whole fixed while comparing the shaded amounts.",
        ],
      },
      wholeAndParts,
      {
        title: "Name a share",
        paragraphs: [
          "To name a shaded part, first count all the equal parts. That count names the part: 3 equal parts make thirds. Then count the shaded parts: two shaded thirds are two thirds.",
          "When every part is shaded, the whole is shaded: three thirds is one whole, and so is four quarters. Count the shaded parts, not the unshaded ones.",
        ],
      },
      {
        title: "Same amount, different shape",
        paragraphs: [
          "A square can be cut into halves with a straight line down the middle or with a line from corner to corner. One half is a rectangle and the other is a triangle, yet each covers exactly half of the square. The cut line splits the square into two pieces that match when one is turned over.",
          "So compare shares by their names, not their shapes. One half of a square is the same amount as any other half of the same square, and it is more than one third or one quarter of it.",
        ],
        illustration: "same-share-shapes",
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Names for equal shares",
        paragraphs: [
          "A fraction names the number of equal parts selected from one whole. Fractions with different names can represent the same amount if the original whole is the same size; subdividing every part equally preserves the selected amount.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "Two same-size rectangles: $A$ is cut into 3 equal columns and $B$ into 3 equal rows. One part of each is shaded. Which is larger?",
      steps: [
        "$A$ has 3 equal parts, so its shaded part is one third of $A$.",
        "$B$ has 3 equal parts, so its shaded part is one third of $B$.",
        "$A$ and $B$ are the same size, so the parts are the same amount, though one is tall and thin and the other is short and wide.",
      ],
      answer: "They are the same amount.",
    },
    pitfalls: [
      "A tall, thin part and a short, wide part can be the same amount.",
      "Count the shaded parts for the numerator of the share, not the unshaded parts.",
    ],
    parentGuide:
      "Cut two same-size slices of bread into thirds in two different ways. Ask whether a piece from one slice is more, less or the same as a piece from the other.",
  },
  {
    id: "equal-area-parts",
    title: "Equal area, equal fraction",
    summary:
      "Pieces can have different outlines but each cover the same amount of a whole shape.",
    templateIds: ["equal-area-fraction", "equal-area-part-size"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Explain that parts with equal area are equal shares even when their shapes differ.",
      "Name one of $n$ equal-area parts as the unit fraction 1/n of the whole area.",
      "Find the area of one part by dividing the whole area by the number of parts.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Equal area can look different",
        paragraphs: [
          "Two pieces of a shape may have different outlines but cover the same number of small squares. They then take up the same amount of the whole shape. Area, not appearance, decides whether the shares are equal.",
        ],
      },
      {
        title: "Area and unit fractions",
        paragraphs: [
          "Area measures how much flat space a shape covers. It is counted in unit squares: squares that are 1 unit long on each side. A rectangle 4 squares wide and 3 squares high covers 4 × 3 = 12 unit squares.",
          "A fraction names part of a whole. In 1/4, the denominator 4 says the whole is split into 4 equal shares, and the numerator 1 says we mean one of them. A unit fraction has numerator 1.",
        ],
      },
      {
        title: "Equal area is what makes the shares equal",
        paragraphs: [
          "Split the 12-square rectangle into 4 parts of 3 squares each. Some parts are straight strips and some bend around a corner, but every part covers 3 squares. Each part is one of 4 equal shares, so each is 1/4 of the area.",
          "Check by counting: 4 parts × 3 squares = 12 squares, the whole rectangle. If the area is known, divide it by the number of equal parts to find one part's area: 12 ÷ 4 = 3 square units.",
        ],
        illustration: "equal-area-regions",
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Fractions of area",
        paragraphs: [
          "If a flat region is partitioned into $d$ parts of equal area for positive whole $d$, each part has $1/d$ of the region's area. Equal area does not require the pieces to have the same shape.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A rectangle with area 24 square units is split into 6 parts with equal area. What fraction of the area is one part, and what is its area?",
      steps: [
        "There are 6 equal-area parts, so one part is 1/6 of the area.",
        "Divide the area by the number of parts: 24 ÷ 6 = 4 square units.",
        "Check: 6 × 4 = 24.",
      ],
      answer: "1/6",
    },
    pitfalls: [
      "Parts with different shapes can still have equal area; count unit squares to check.",
      "The denominator counts all the equal parts, not the unshaded ones.",
    ],
    parentGuide:
      "Draw a 4 by 3 grid of squares and colour it into 4 regions of 3 squares, each a different shape. Ask what fraction of the rectangle each colour covers.",
  },
  {
    id: "fractions-of-one-whole",
    title: "Compare fractions of one whole",
    summary: "Compare fractions as parts of the same-sized whole.",
    templateIds: [
      "compare-like-denominators",
      "compare-like-numerators",
      "compare-unlike-fractions",
    ],
    includeGeneratedRepresentation: false,
    objectives: [
      "Compare fractions with the same denominator by counting same-size pieces.",
      "Compare fractions with the same numerator by comparing piece sizes.",
      "Compare unlike fractions with a common denominator or a benchmark such as 1/2.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Keep the whole fixed",
        paragraphs: [
          "If two strips are the same length, one half of either strip is larger than one fourth. If you cut both into fourths, two fourths show the half. Equal-sized parts make comparisons easier to see.",
        ],
      },
      {
        title: "Numerator and denominator",
        paragraphs: [
          "In the fraction 3/4, the denominator 4 says the whole is cut into 4 equal pieces, so each piece is 1/4. The numerator 3 counts how many of those pieces we have. A fraction is a count of equal pieces.",
          "Fractions can be compared only when they are parts of the same whole. Half of a large pizza is more pizza than half of a small one. In every comparison below, both fractions describe one whole of the same size.",
        ],
      },
      {
        title: "Same piece size or same count",
        paragraphs: [
          "Same denominator: the pieces are the same size, so the fraction with more pieces is greater. 5/8 > 3/8 because 5 eighths are more than 3 eighths.",
          "Same numerator: both fractions have the same number of pieces, so compare the size of one piece. A whole cut into 3 pieces has larger pieces than the same whole cut into 5, so 2/3 > 2/5.",
        ],
        illustration: "compare-same-whole",
      },
      {
        title: "Different counts and different pieces",
        paragraphs: [
          "When both parts differ, rename the fractions so their pieces are the same size. Multiplying numerator and denominator by the same number cuts every piece into equal smaller pieces without changing the amount: 3/4 = 9/12 and 2/3 = 8/12. Now 9 twelfths > 8 twelfths, so 3/4 > 2/3.",
          "Two shortcuts often decide faster. A benchmark: 3/8 is less than one half and 4/6 is more, so 4/6 > 3/8. Missing pieces: 3/4 and 2/3 are each one piece short of a whole, and the missing quarter is smaller than the missing third, so 3/4 is closer to 1.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Comparing fractions",
        paragraphs: [
          "Fractions can be compared by renaming them with a common denominator: equal-sized parts then compare by their numerators. With the same positive numerator, the larger positive denominator names smaller parts, provided the whole is fixed.",
        ],
      },
    ],
    workedExample: {
      prompt: "Which is greater: 3/4 or 2/3 of the same whole?",
      steps: [
        "The pieces differ in size and in number, so rename with denominator 12.",
        "3/4 = 9/12 and 2/3 = 8/12.",
        "9 twelfths > 8 twelfths, so 3/4 > 2/3.",
      ],
      answer: "3/4",
    },
    pitfalls: [
      "A larger denominator means smaller pieces: 1/8 < 1/3.",
      "Compare fractions only when they refer to the same whole.",
    ],
    parentGuide:
      "Fold three same-length paper strips into halves, thirds and quarters. Line them up and ask which shaded length is longest, and why more folds make shorter pieces.",
  },
];

const shareTerms: [string, string][] = [
  ["Whole", "One complete shape or thing that is being shared."],
  ["Equal parts", "Parts that are all exactly the same size."],
];
export const partWholeMethods: Record<string, ProblemMethod> = {
  "find-equal-shares": {
    goal: "Pick the shape that is cut into halves or quarters.",
    terms: [
      ...shareTerms,
      ["Halves", "Two equal parts of one whole."],
      ["Quarters", "Four equal parts of one whole; also called fourths."],
    ],
    method: [
      "Rule out any shape whose parts are different sizes.",
      "Count the equal parts of each remaining shape.",
      "Halves have 2 equal parts; quarters have 4.",
    ],
    watch: "Two unequal pieces are not halves.",
  },
  "name-equal-share": {
    goal: "Name the shaded part of a shape cut into halves or quarters.",
    terms: shareTerms,
    method: [
      "Count all the equal parts: 2 makes halves, 4 makes quarters.",
      "Count the shaded parts.",
      "Say the shaded count with the part name: three quarters.",
    ],
    watch: "Count the shaded parts, not the unshaded ones.",
  },
  "larger-share": {
    goal: "Decide whether one half or one quarter of the same whole is larger.",
    terms: shareTerms,
    method: [
      "Check that both wholes are the same size.",
      "The whole cut into more equal parts has smaller parts.",
      "So one half is larger than one quarter; two quarters make one half.",
    ],
    watch: "More pieces does not mean bigger pieces.",
  },
  "find-equal-thirds": {
    goal: "Pick the shape cut into halves, thirds or quarters.",
    terms: [...shareTerms, ["Thirds", "Three equal parts of one whole."]],
    method: [
      "Rule out any shape whose parts are different sizes.",
      "Count the equal parts of each remaining shape.",
      "Halves: 2 equal parts. Thirds: 3. Quarters: 4.",
    ],
    watch: "The right number of parts is not enough; they must be equal.",
  },
  "name-share": {
    goal: "Name the shaded part of a shape cut into halves, thirds or quarters.",
    terms: shareTerms,
    method: [
      "Count all the equal parts to name them: halves, thirds or quarters.",
      "Count the shaded parts.",
      "Put the count with the name; all parts shaded is the whole, such as three thirds.",
    ],
    watch: "Count the shaded parts, not the unshaded ones.",
  },
  "same-share-different-shape": {
    goal: "Compare one shaded share of each of two same-size wholes cut in different ways.",
    terms: shareTerms,
    method: [
      "Count the equal parts in each whole and name each shaded share.",
      "Same name, same whole: the same amount, whatever the shapes.",
      "Different names: fewer equal parts means larger parts.",
    ],
    watch:
      "Judge a share by its name, not by whether it looks tall, wide or pointed.",
  },
  "equal-area-fraction": {
    goal: "Name one equal-area part of a rectangle as a fraction of its area.",
    terms: [
      ["Area", "The flat space a shape covers, counted in unit squares."],
      ["Unit fraction", "A fraction with numerator 1, such as 1/4."],
    ],
    method: [
      "Count the parts; they have equal area even if their shapes differ.",
      "One of $n$ equal parts is 1/n of the whole area.",
      "Check: each part's squares times the number of parts gives the whole.",
    ],
    watch: "Different shapes can have the same area.",
  },
  "equal-area-part-size": {
    goal: "Find the area of one part of a rectangle split into equal-area parts.",
    terms: [
      ["Area", "The flat space a shape covers, counted in unit squares."],
      ["Equal area", "Covering the same number of unit squares."],
    ],
    method: [
      "Count the equal-area parts.",
      "Divide the rectangle's area by that count.",
      "Check: the part's area times the count is the whole area.",
    ],
    watch: "Divide by the number of parts, not by a side length.",
  },
  "compare-like-denominators": {
    goal: "Choose the greater or lesser of two fractions of one whole with the same denominator.",
    terms: [
      ["Denominator", "The number of equal pieces in the whole."],
      ["Numerator", "How many of those pieces the fraction counts."],
    ],
    method: [
      "Same denominator: the pieces are the same size.",
      "Compare the numerators: more pieces is more of the whole.",
      "Answer with the fraction the question asks for.",
    ],
    watch: "Read whether the question asks for the greater or the lesser.",
  },
  "compare-like-numerators": {
    goal: "Choose the greater or lesser of two fractions of one whole with the same numerator.",
    terms: [
      ["Denominator", "The number of equal pieces in the whole."],
      ["Numerator", "How many of those pieces the fraction counts."],
    ],
    method: [
      "Same numerator: both fractions have the same number of pieces.",
      "The smaller denominator cuts the whole into fewer, larger pieces.",
      "So the fraction with the smaller denominator is greater.",
    ],
    watch: "A larger denominator means smaller pieces.",
  },
  "compare-unlike-fractions": {
    goal: "Choose the greater or lesser of two fractions with different numerators and denominators.",
    terms: [
      ["Denominator", "The number of equal pieces in the whole."],
      [
        "Common denominator",
        "A shared number of pieces that both denominators divide into evenly.",
      ],
    ],
    method: [
      "Try a benchmark: is one fraction below 1/2 and the other above?",
      "Otherwise rename both with a common denominator.",
      "With same-size pieces, the larger numerator is the greater fraction.",
    ],
    watch: "Comparing numerators alone works only when the denominators match.",
  },
};
export const partWholePrinciples: Record<string, string> = {
  "find-equal-shares":
    "Halves and quarters are equal shares: 2 or 4 parts of exactly the same size.",
  "name-equal-share":
    "The number of equal parts names each part; the shaded count says how many of them.",
  "larger-share":
    "Sharing the same whole among more equal parts makes each part smaller.",
  "find-equal-thirds":
    "A share's name counts equal parts: 2 halves, 3 thirds, 4 quarters make one whole.",
  "name-share":
    "The number of equal parts names each part; all of the parts together are the whole.",
  "same-share-different-shape":
    "Equal shares of the same whole are the same amount even when their shapes differ.",
  "equal-area-fraction":
    "Parts with equal area are equal shares: each of $n$ such parts is 1/n of the whole area.",
  "equal-area-part-size":
    "Equal-area parts split the whole area evenly: one part's area is the whole area divided by the number of parts.",
  "compare-like-denominators":
    "With the same denominator, the pieces are the same size, so more pieces is more.",
  "compare-like-numerators":
    "With the same numerator, the fraction with fewer, larger pieces in its whole is greater.",
  "compare-unlike-fractions":
    "Renaming fractions with a common denominator makes their pieces the same size without changing their values.",
};
