import { chainLesson } from "./chain-lesson-kit";

export const clauseAdditionLessons = [
  chainLesson({
    id: "three-digit-number-names-lesson",
    title: "Hundreds, tens and ones in words",
    summary:
      "A three-digit number names hundreds, tens and ones. Read the hundreds first, then read the remaining tens and ones together. A zero holds an empty place.",
    templateIds: ["three-digit-number-names"],
    objectives: [
      "Read a three-digit numeral in words.",
      "Write a numeral from its number name, keeping zeros in empty places.",
    ],
    openingTitle: "Name the groups",
    opening: [
      "In 407, the 4 means four hundreds. The 0 means no tens, and the 7 means seven ones. The name is four hundred seven.",
      "In 470, the same digits occupy different places. The 7 means seven tens, so the name is four hundred seventy. Thirteen means 13; thirty means 30.",
    ],
    example: {
      prompt: "Write three hundred sixteen as a numeral.",
      steps: [
        "Three hundred means 300.",
        "Sixteen means one ten and six ones: 16.",
        "Combine the parts: $300+16=316$. The hundreds, tens and ones digits are 3, 1 and 6.",
      ],
      answer: "316",
    },
    methodTitle: "Read the hundreds, then the rest",
    method: [
      "Read the first digit with the word hundred.",
      "Read the remaining two digits together. If both are zero, stop after hundred.",
      "To write a numeral, place each part in its own column. For three hundred six, write 306; the tens place needs a zero.",
    ],
    formalTitle: "Check with place values",
    formal: [
      "A three-digit numeral has a hundreds digit, a tens digit and a ones digit. Its value is the hundreds count times 100, plus the tens count times 10, plus the ones count.",
      "$306=3\\times100+0\\times10+6$. The zero contributes nothing but keeps the 6 in the ones place.",
    ],
    pitfalls: [
      "Four hundred seven is 407, not 470 or 4007.",
      "Read 11 through 19 as a whole two-digit part: sixteen is 16, not sixty.",
    ],
    parentGuide:
      "Ask which place has no groups when a zero appears. Have the learner check a number name by adding its hundreds value and remaining value.",
  }),
  chainLesson({
    id: "similarity-by-transformation-grade-8-lesson",
    title: "Match a shape with a dilation and a motion",
    summary:
      "Similar figures have the same shape. A dilation multiplies every length by one scale factor and keeps angles equal. A rigid motion then changes position or direction while preserving lengths and angles.",
    templateIds: ["similarity-by-transformation-grade-8"],
    objectives: [
      "Use one scale factor for every corresponding side.",
      "Check a dilation followed by a translation, rotation or reflection at every vertex.",
    ],
    openingTitle: "Change size, then position",
    opening: [
      "Corresponding sides and vertices are matching parts. A dilation centered at the origin multiplies both coordinates of every point by its scale factor. A factor of 2 doubles every length; a factor of one half halves every length.",
      "A translation slides, a reflection flips over a line, and a rotation turns around a center. These are rigid motions: they preserve lengths and angles. A dilation followed by a rigid motion can match similar figures of different sizes.",
    ],
    example: {
      prompt:
        "Triangle $ABC$ has vertices $A(1,1)$, $B(3,1)$ and $C(1,2)$. Dilate by 2 about the origin, then rotate 90° counterclockwise about the origin. Find the image vertices.",
      steps: [
        "Double both coordinates: $(2,2)$, $(6,2)$ and $(2,4)$.",
        "For a 90° counterclockwise turn, $(x,y)$ becomes $(-y,x)$.",
        "Apply the turn to all three points: $A'(-2,2)$, $B'(-2,6)$ and $C'(-4,2)$.",
        "All lengths doubled during the dilation. The turn preserved those lengths and every angle, so the triangles are similar.",
      ],
      answer: "$A'(-2,2)$, $B'(-2,6)$, $C'(-4,2)$",
    },
    methodTitle: "One factor, every vertex",
    method: [
      "Compare image sides with their corresponding original sides. Every length ratio must be the same.",
      "Apply the dilation, then the stated rigid motion, in order.",
      "Check every vertex. One matching point does not establish a map of the whole triangle.",
    ],
    formalTitle: "What similarity preserves",
    formal: [
      "For corresponding triangles $ABC$ and $DEF$, similarity requires $DE/AB=EF/BC=FD/CA$ and equal corresponding angles.",
      "A stretch that doubles horizontal lengths but triples vertical lengths generally changes the shape: no single length scale factor works.",
    ],
    pitfalls: [
      "Angles do not get multiplied by the scale factor.",
      "Apply steps in their stated order. A translation before a dilation can give a different image from the translation after it.",
    ],
    parentGuide:
      "Ask the learner to check a second side and a second vertex after finding a possible transformation. Those checks expose a rule that matches only one point.",
  }),
];
