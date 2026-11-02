import type { MethodTerm } from "../glossary/types";
import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

const wholeAndParts: Lesson["sections"][number] = {
  title: "A whole and its equal parts",
  paragraphs: [
    "A whole is one full thing, like one sandwich or one paper square. A circle is a round flat shape, like the top of a cup. One circle is a whole too. A rectangle is a flat shape with 4 straight sides, like a door. Its corners are square, like the corner of a page.",
    "Equal parts, or equal shares, are parts that are all the same size. They cover the same amount of the shape.",
    "The number of equal parts gives each part its name. When a whole is cut into 2 equal parts, each part is called a half. When it is cut into 3 equal parts, each part is called a third. When it is cut into 4 equal parts, each part is called a quarter, or a fourth.",
    "All the parts together make the whole again. 2 halves make one whole. So do 3 thirds, and so do 4 quarters.",
  ],
};

export const partWholeLessons: Lesson[] = [
  {
    id: "halves-and-quarters",
    title: "Halves and quarters",
    summary:
      "A whole is one full thing, like one sandwich. A part is a piece of the whole. Equal parts are parts that are all the same size. Cut a whole into 2 equal parts, and each part is called a half. Cut it into 4 equal parts, and each part is called a quarter. A quarter is also called a fourth.",
    templateIds: ["find-equal-shares", "name-equal-share", "larger-share"],
    senses: {
      whole: "whole",
      part: "part",
      quarter: "fourth",
      third: "third",
      square: "square-shape",
      side: "side",
    },
    includeGeneratedRepresentation: false,
    objectives: [
      "Tell when a shape is cut into 2 or 4 equal parts.",
      "Name shaded parts as one half, one quarter, two quarters or three quarters.",
      "Explain why one quarter of a whole is smaller than one half of the same whole.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Share one whole equally",
        paragraphs: [
          "Look at one sandwich. It is one whole. Cut it into 2 pieces that are the same size. Each piece is called a half. 2 halves make the whole sandwich.",
          "Now cut each half into 2 equal pieces. You get 4 pieces, all the same size. Each piece is called a quarter. 4 quarters make the whole sandwich. The pieces got smaller, but together they are still one sandwich.",
          "A square is a flat shape like a sticky note. Its 4 sides are all equally long, and its corners are square, like the corner of a page. When some parts of a shape are shaded, they are colored in. You count the shaded parts.",
        ],
      },
      wholeAndParts,
      {
        title: "Check equal, then count",
        paragraphs: [
          "First check that the parts are the same size. Look at the picture. The square is cut into 2 parts that are the same size. So each part is a half.",
          "The rectangle is cut into 2 parts too. But one part is bigger than the other. So those parts are not halves, even though there are 2 of them.",
          "The circle is cut into 4 parts that are the same size. So each part is a quarter. 1 of the 4 equal parts is shaded: one quarter. If 3 were shaded, that would be three quarters.",
        ],
        illustration: "equal-shares",
      },
      {
        title: "More parts, smaller parts",
        paragraphs: [
          "Take two sandwiches of the same size. Cut one into 2 equal parts. Cut the other into 4 equal parts. The second sandwich has more pieces. But each piece is smaller, because the same sandwich is shared by more pieces.",
          "2 quarters fit exactly on top of 1 half. So one half is bigger than one quarter. And 2 quarters are the same amount as 1 half.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Equal parts of one whole",
        paragraphs: [
          "A half is 1 of 2 equal parts of a whole. A quarter is 1 of 4 equal parts of the same whole. 2 halves, or 4 quarters, make the whole again. A bigger whole has bigger halves and bigger quarters.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A square is cut into 4 equal parts, and 3 parts are shaded. How much of the square is shaded?",
      steps: [
        "Check the parts first. All 4 parts are the same size. So each part is one quarter of the square.",
        "Count the shaded parts. There are 3.",
        "3 shaded parts, and each is one quarter. That makes three quarters of the square.",
      ],
      answer: "three quarters",
    },
    pitfalls: [
      "2 pieces are halves only when they are the same size. Check the size before you name the parts.",
      "Cutting the same whole into more equal pieces makes each piece smaller, not bigger.",
    ],
    parentGuide:
      "Fold a paper square in half two different ways, then fold it again into quarters. Ask your child whether each piece is the same size, and how many quarters cover one half.",
  },
  {
    id: "halves-thirds-and-quarters",
    title: "Halves, thirds and quarters",
    summary:
      "A whole is one full thing, like one slice of bread. A part is a piece of the whole. Equal parts are parts that are all the same size. Cut a whole into 2 equal parts, and each part is called a half. Cut it into 3 equal parts, and each part is called a third. Cut it into 4 equal parts, and each part is called a quarter, or a fourth.",
    templateIds: [
      "find-equal-thirds",
      "name-share",
      "same-share-different-shape",
    ],
    senses: {
      whole: "whole",
      part: "part",
      quarter: "fourth",
      third: "third",
      square: "square-shape",
      side: "side",
    },
    includeGeneratedRepresentation: false,
    objectives: [
      "Tell when a circle or rectangle is cut into 2, 3 or 4 equal parts.",
      "Name shaded parts with halves, thirds and quarters, and name the whole as all of its parts.",
      "Explain why equal parts of the same whole can have different shapes.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Compare pieces of the same whole",
        paragraphs: [
          "A part is a piece of a whole. When a whole is cut into 2 equal parts, each part is called a half. When it is cut into 3 equal parts, each part is called a third. When it is cut into 4 equal parts, each part is called a quarter.",
          "A square is a flat shape like a sticky note. Its 4 sides are all equally long, and its corners are square, like the corner of a page. Shaded parts are the parts that are colored in.",
          "Fold a paper square in half. Then fold it in half again. 1 half covers the same paper as 2 quarters. The names are different because the square was cut in a different way. Equal parts can even have different shapes. Keep the whole the same when you compare parts.",
        ],
      },
      wholeAndParts,
      {
        title: "Name a share",
        paragraphs: [
          "A share is one of the equal parts. To name a shaded share, first count all the equal parts. That number gives the parts their name. 3 equal parts are thirds.",
          "Then count the shaded parts. 2 shaded thirds are two thirds.",
          "When every part is shaded, the whole shape is shaded. Three thirds is one whole. So is four quarters. Count the shaded parts, not the parts left white.",
        ],
      },
      {
        title: "Same amount, different shape",
        paragraphs: [
          "Look at the picture. The first square is cut in half straight down the middle. The second square is cut in half from one corner to the other. A corner is a point where two sides meet.",
          "The straight-down cut makes 2 rectangles. The corner-to-corner cut makes 2 triangles, the flat shapes with 3 sides. A rectangle half and a triangle half look different. But each one covers exactly half of its square. In each square, turn one piece over and it fits right on the other piece.",
          "So compare shares by their names, not their shapes. Any half of a square is the same amount as any other half of the same square. A half is bigger than a third or a quarter of that square. The third square in the picture shows one third, which is smaller than one half.",
        ],
        illustration: "same-share-shapes",
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Names for equal shares",
        paragraphs: [
          "A fraction is a number that names equal parts of one whole. One half, two thirds and three quarters are fractions. Two fractions with different names can be the same amount, like 1 half and 2 quarters. To compare amounts of real things, like bread, by their fraction names alone, both wholes must be the same size.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "Two same-size rectangles: $A$ is cut into 3 equal columns and $B$ into 3 equal rows. One part of each is shaded. Which is larger?",
      steps: [
        "Count the parts of $A$. It has 3 equal parts, so its shaded part is one third of $A$.",
        "Count the parts of $B$. It has 3 equal parts too, so its shaded part is one third of $B$.",
        "$A$ and $B$ are the same size, and each shaded part is one third. So the parts are the same amount. One is tall and thin, and one is short and wide.",
      ],
      answer: "They are the same amount.",
    },
    pitfalls: [
      "A tall, thin part and a short, wide part can be the same amount. Compare their names, not their looks.",
      "Count the shaded parts to name the share, not the parts left white.",
    ],
    parentGuide:
      "Cut two same-size slices of bread into thirds in two different ways. Ask your child whether a piece from one slice is more, less or the same as a piece from the other, and why.",
  },
  {
    id: "equal-area-parts",
    title: "Equal area, equal fraction",
    summary:
      "Area is how much flat space a shape covers. We measure it in unit squares: small squares with sides 1 unit long. Two parts can have different shapes and still cover the same number of unit squares. Then they have equal area, so they are equal parts of the whole.",
    templateIds: ["equal-area-fraction", "equal-area-part-size"],
    senses: {
      whole: "whole",
      part: "part",
      square: "square-shape",
      side: "side",
      unit: "unit",
    },
    noLink: ["mean", "means"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Explain that parts with equal area are equal parts, even when their shapes are different.",
      "Name one of $n$ equal-area parts as the fraction 1/n of the whole area.",
      "Find the area of one part by dividing the whole area by the number of parts.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Equal area can look different",
        paragraphs: [
          "Area is how much flat space a shape covers. A unit square is a small square with each side 1 unit long, such as 1 centimeter. To find an area, count the unit squares that cover the shape.",
          "Two parts of a shape can have different outlines. If they cover the same number of unit squares, they have equal area. Then they are equal parts of the whole, even though they look different.",
          "A fraction is a number that names equal parts of a whole. One sixth means 1 of 6 equal-area parts of the same whole. We write it 1/6.",
        ],
      },
      {
        title: "Area and unit fractions",
        paragraphs: [
          "A rectangle 4 squares wide and 3 squares high has 3 rows of 4 squares. It covers 4 × 3 = 12 unit squares. So its area is 12 square units.",
          "In the fraction 1/4, the bottom number 4 is called the denominator. It says the whole is cut into 4 equal parts. The top number 1 is called the numerator. It says we mean 1 of those parts. A fraction with 1 on top is called a unit fraction.",
        ],
      },
      {
        title: "Equal area is what makes the parts equal",
        paragraphs: [
          "Look at the picture. The 12-square rectangle is split into 4 parts. Two parts are straight strips. Two parts bend around a corner. But every part covers 3 squares.",
          "So each part is 1 of 4 equal parts. Each part is 1/4 of the area.",
          "Check by counting: 4 parts × 3 squares = 12 squares. That is the whole rectangle. If you know the whole area, divide it by the number of equal parts to find one part: 12 ÷ 4 = 3 square units.",
        ],
        illustration: "equal-area-regions",
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Fractions of area",
        paragraphs: [
          "Suppose a flat shape is split into $d$ parts with equal area, where $d$ is a counting number (1, 2, 3 and so on). Then each part is $1/d$ of the shape's area. Its area is the whole area ÷ $d$. The parts do not need to have the same shape.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A rectangle with area 24 square units is split into 6 parts with equal area. What fraction of the area is one part, and what is its area?",
      steps: [
        "There are 6 parts with equal area. So each part is 1 of 6 equal parts: 1/6 of the area.",
        "To find one part's area, share the 24 square units equally among the 6 parts: 24 ÷ 6 = 4 square units.",
        "Check by multiplying back: 6 parts × 4 square units = 24 square units, the whole rectangle.",
      ],
      answer: "1/6",
    },
    pitfalls: [
      "Parts with different shapes can still have equal area. Count the unit squares in each part to check.",
      "The denominator counts all the equal parts, not just the shaded ones.",
    ],
    parentGuide:
      "Draw a grid 4 squares wide and 3 squares high. Colour it into 4 parts of 3 squares each. Make some parts straight strips and some parts bend around a corner. Ask your child what fraction of the rectangle each colour covers, and how they know.",
  },
  {
    id: "fractions-of-one-whole",
    title: "Compare fractions of one whole",
    summary:
      "A fraction such as 3/4 names equal parts of one whole. The denominator, the bottom number, says how many equal parts make the whole. The numerator, the top number, counts the parts we have. To compare two fractions, both must be parts of wholes that are the same size.",
    templateIds: [
      "compare-like-denominators",
      "compare-like-numerators",
      "compare-unlike-fractions",
    ],
    senses: {
      whole: "whole",
      part: "part",
      quarter: "fourth",
      third: "third",
      eighth: "eighth",
      rename: "rename",
      "more than": "more-than",
    },
    noLink: ["change", "changes", "mean", "means"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Compare fractions with the same denominator by counting same-size parts.",
      "Compare fractions with the same numerator by comparing the size of one part.",
      "Compare fractions that differ in both numbers, using a common denominator or the halfway mark 1/2.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Keep the whole the same",
        paragraphs: [
          "Take two paper strips of the same length. Each strip is one whole. Fold one into 2 equal parts and the other into 4 equal parts. One half of a strip is longer than one fourth of the same-length strip.",
          "In the fraction 3/4, the denominator 4 is the bottom number. It says the whole is cut into 4 equal parts, so each part is 1/4. The numerator 3 is the top number. It counts how many of those parts we have.",
          "Some fractions have different bottom numbers. Writing a fraction another way, without changing how much it is, is called renaming it. A common denominator is a bottom number that two fractions can share. Rename both fractions with a common denominator, and their parts are the same size.",
        ],
      },
      {
        title: "The same whole",
        paragraphs: [
          "When fractions tell amounts of something, like pizza, the wholes must be the same size. Half of a large pizza is more pizza than half of a small one. In this lesson, both fractions are always parts of one whole of the same size.",
          "The sign > means is greater than, and < means is less than. The wide open end is next to the greater number.",
        ],
      },
      {
        title: "Same part size or same count",
        paragraphs: [
          "Same denominator: the parts are the same size. So the fraction with more parts is greater. 5/8 > 3/8, because 5 eighths are more than 3 eighths.",
          "Same numerator: both fractions have the same number of parts. So compare the size of one part. A whole cut into 3 parts has bigger parts than the same whole cut into 5 parts. So 2/3 > 2/5.",
          "Look at the picture. Every bar is one whole of the same length. The shaded part gets shorter as the number of parts grows. Two thirds is longer than two fifths.",
        ],
        illustration: "compare-same-whole",
      },
      {
        title: "Different counts and different parts",
        paragraphs: [
          "Sometimes both numbers are different, like 3/4 and 2/3. Then rename the fractions so their parts are the same size. A common denominator is a bottom number both fractions can share. Here 12 works, because 4 × 3 = 12 and 3 × 4 = 12.",
          "Cut every fourth into 3 smaller equal parts. Then 3 fourths become 3 × 3 = 9 twelfths, so 3/4 = 9/12. Cut every third into 4 smaller equal parts. Then 2 thirds become 2 × 4 = 8 twelfths, so 2/3 = 8/12. The amounts did not change. Only the cuts did.",
          "Now the parts are all twelfths. 9 twelfths > 8 twelfths, so 3/4 > 2/3.",
          "A quicker check compares each fraction with one half, 1/2. 3/8 is less than one half, because one half is 4/8. 4/6 is more than one half, because one half is 3/6. So 4/6 > 3/8.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Comparing fractions",
        paragraphs: [
          "Fractions of the same whole can be compared by renaming them with a common denominator. Then the parts are the same size, so the greater numerator gives the greater fraction. When two fractions have the same numerator, other than 0, the one with the greater denominator has smaller parts, so it is less.",
        ],
      },
    ],
    workedExample: {
      prompt: "Which is greater: 3/4 or 2/3 of the same whole?",
      steps: [
        "The parts are different sizes, and the counts are different too. So rename both fractions with a common denominator. 12 works, because 4 × 3 = 12 and 3 × 4 = 12.",
        "Multiply the top and bottom of 3/4 by 3: 3/4 = 9/12. Multiply the top and bottom of 2/3 by 4: 2/3 = 8/12. Multiplying both numbers by the same number cuts each part smaller without changing the amount.",
        "Now both are twelfths. 9 twelfths > 8 twelfths, so 3/4 > 2/3.",
      ],
      answer: "3/4",
    },
    pitfalls: [
      "A bigger denominator means smaller parts: 1/8 < 1/3, because eighths are smaller than thirds.",
      "To compare amounts of something, like pizza, use wholes of the same size.",
    ],
    parentGuide:
      "Fold three paper strips of the same length into halves, thirds and quarters. Line them up. Ask your child which shaded length is longest, and why more folds make shorter pieces.",
  },
];

const shareTerms: MethodTerm[] = ["whole", "equal-parts"];
const shareSenses = {
  whole: "whole",
  part: "part",
  quarter: "fourth",
  third: "third",
  square: "square-shape",
};
export const partWholeMethods: Record<string, ProblemMethod> = {
  "find-equal-shares": {
    goal: "Pick the shape that is cut into halves or quarters.",
    senses: shareSenses,
    terms: [...shareTerms, "half", "fourth"],
    method: [
      "Look at each shape. Cross out any shape whose parts are not the same size.",
      "Count the equal parts of each shape that is left.",
      "A whole cut into 2 equal parts shows halves. A whole cut into 4 equal parts shows quarters.",
    ],
    watch: "2 pieces are halves only when they are the same size.",
  },
  "name-equal-share": {
    goal: "Name the shaded part of a shape cut into halves or quarters.",
    senses: shareSenses,
    terms: shareTerms,
    method: [
      "Count all the equal parts. 2 parts are halves, and 4 parts are quarters.",
      "Count the shaded parts, the ones colored in.",
      "Say the shaded count with the part name, such as three quarters.",
    ],
    watch: "Count the shaded parts, not the parts left white.",
  },
  "larger-share": {
    goal: "Decide whether one half or one quarter of the same whole is larger.",
    senses: shareSenses,
    terms: shareTerms,
    method: [
      "Check that both wholes are the same size.",
      "The whole cut into more equal parts has smaller parts.",
      "So one half is bigger than one quarter. 2 quarters make 1 half.",
    ],
    watch:
      "Cutting the same whole into more equal pieces makes each piece smaller, not bigger.",
  },
  "find-equal-thirds": {
    goal: "Pick the shape cut into halves, thirds or quarters.",
    senses: shareSenses,
    terms: [...shareTerms, "third"],
    method: [
      "Look at each shape. Cross out any shape whose parts are not the same size.",
      "Count the equal parts of each shape that is left.",
      "A whole cut into 2 equal parts shows halves. 3 equal parts show thirds. 4 equal parts show quarters.",
    ],
    watch:
      "Having the right number of parts is not enough. The parts must be the same size.",
  },
  "name-share": {
    goal: "Name the shaded part of a shape cut into halves, thirds or quarters.",
    senses: shareSenses,
    terms: shareTerms,
    method: [
      "Count all the equal parts to find their name: halves, thirds or quarters.",
      "Count the shaded parts, the ones colored in.",
      "Say the count with the name. If every part is shaded, that is the whole, such as three thirds.",
    ],
    watch: "Count the shaded parts, not the parts left white.",
  },
  "same-share-different-shape": {
    goal: "Compare one shaded share of each of two same-size wholes cut in different ways.",
    senses: shareSenses,
    terms: shareTerms,
    method: [
      "Count the equal parts in each whole, and name each shaded share.",
      "Same name and same-size wholes: the shares are the same amount, whatever their shapes.",
      "Different names, same-size wholes: the whole cut into fewer equal parts has bigger parts.",
    ],
    watch:
      "Judge a share by its name, not by whether it looks tall, wide or pointed.",
  },
  "equal-area-fraction": {
    goal: "Name one equal-area part of a rectangle as a fraction of its area.",
    senses: { whole: "whole", part: "part", square: "square-shape" },
    terms: ["area", "unit-fraction"],
    method: [
      "Count the parts. Each covers the same number of unit squares, so they have equal area, even if their shapes differ.",
      "One of $n$ equal parts is 1/n of the whole area. For 4 parts, one part is 1/4. The numerator, the top number, is 1 because you name one part.",
      "Check: the squares in one part times the number of parts gives the whole area.",
    ],
    watch:
      "Different shapes can have the same area. Count the squares, not the look.",
  },
  "equal-area-part-size": {
    goal: "Find the area of one part of a rectangle split into equal-area parts.",
    senses: {
      whole: "whole",
      part: "part",
      square: "square-shape",
      side: "side",
    },
    terms: [
      "area",
      [
        "equal-parts",
        "Parts with equal area cover the same number of unit squares.",
      ],
    ],
    method: [
      "Count the parts with equal area.",
      "Divide the rectangle's area by that count. That shares the area equally.",
      "Check: one part's area times the number of parts is the whole area.",
    ],
    watch:
      "Divide the area by the number of parts, not by the length of a side.",
  },
  "compare-like-denominators": {
    goal: "Choose the greater or lesser of two fractions of one whole with the same denominator.",
    senses: { whole: "whole", part: "part", "more than": "more-than" },
    terms: ["denominator", "numerator"],
    method: [
      "The denominators, the bottom numbers, are the same. So the parts are the same size.",
      "Compare the numerators, the top numbers. More parts is more of the whole.",
      "Answer with the fraction the question asks for: the greater or the lesser.",
    ],
    watch: "Read whether the question asks for the greater or the lesser.",
  },
  "compare-like-numerators": {
    goal: "Choose the greater or lesser of two fractions of one whole with the same numerator.",
    senses: { whole: "whole", part: "part", "more than": "more-than" },
    terms: ["denominator", "numerator"],
    method: [
      "The numerators, the top numbers, are the same. So both fractions count the same number of parts.",
      "The smaller denominator, the bottom number, cuts the whole into fewer parts. Fewer parts means bigger parts.",
      "So when the top numbers are not 0, the fraction with the smaller denominator is greater.",
    ],
    watch: "A bigger denominator means smaller parts.",
  },
  "compare-unlike-fractions": {
    goal: "Choose the greater or lesser of two fractions with different numerators and denominators.",
    senses: {
      whole: "whole",
      part: "part",
      rename: "rename",
      "more than": "more-than",
    },
    terms: ["denominator", "common-denominator"],
    method: [
      "Try one half first. Is one fraction less than 1/2 and the other more than 1/2?",
      "If not, write both fractions another way with a common denominator, a bottom number they can share. This is called renaming.",
      "Now the parts are the same size, so the bigger numerator, the top number, is the greater fraction.",
    ],
    watch:
      "Comparing the top numbers alone works only when the bottom numbers match.",
  },
};
export const partWholePrinciples: Record<string, string> = {
  "find-equal-shares":
    "Halves and quarters are equal parts: 2 or 4 parts that are exactly the same size.",
  "name-equal-share":
    "The number of equal parts gives each part its name. The shaded count says how many of those parts are shaded.",
  "larger-share":
    "Sharing the same whole into more equal parts makes each part smaller.",
  "find-equal-thirds":
    "A share's name comes from the number of equal parts. 2 halves, 3 thirds or 4 quarters make one whole.",
  "name-share":
    "The number of equal parts gives each part its name. All of the parts together are the whole.",
  "same-share-different-shape":
    "Equal shares of the same whole are the same amount, even when their shapes are different.",
  "equal-area-fraction":
    "Parts with equal area are equal parts. Each of $n$ such parts is 1/n of the whole area.",
  "equal-area-part-size":
    "Equal-area parts share the whole area evenly. One part's area is the whole area divided by the number of parts.",
  "compare-like-denominators":
    "With the same denominator, the parts are the same size. So more parts is more.",
  "compare-like-numerators":
    "With the same numerator, other than 0, the fraction whose whole is cut into fewer, bigger parts is greater.",
  "compare-unlike-fractions":
    "Renaming fractions with a common denominator makes their parts the same size without changing their amounts.",
};
