import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

export const attributeLessons: Lesson[] = [
  {
    id: "longer-heavier-holds-more",
    title: "Longer, heavier, holds more",
    summary:
      "You can compare two things in different ways. Length is how long something is. Weight is how heavy it is. Capacity is how much a cup or jar can hold. Pick one of these before you compare.",
    templateIds: ["compare-lengths", "compare-weights", "compare-capacity"],
    senses: { balance: "balance-scale", "more than": "more-than" },
    noLink: ["side", "sides"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Tell which of two strips is longer by lining up one end.",
      "Read a balance: the lower pan holds the heavier thing, and a level beam means the same weight.",
      "Tell which of two jars holds more by pouring one into the other.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Pick one question",
        paragraphs: [
          "A long ribbon can be very light. A short cup can hold a lot of water. So bigger can mean different things.",
          "Length is how long something is, from one end to the other. Weight is how heavy something is. A container is something that holds things, like a cup or a jar. Capacity is how much a container can hold.",
          "Pick one question before you compare. Which is longer? Which is heavier? Which holds more?",
        ],
      },
      {
        title: "Length: line up one end",
        paragraphs: [
          "Look at the picture. To see which strip is longer, start both strips at the same line. The strip that reaches farther at the other end is longer.",
          "At the top of the picture, strip B starts farther to the right, and it also ends farther to the right. But strip A is longer. Line them up, like at the bottom, and you can see it.",
          "Always check where both strips start, not just where they end.",
        ],
        illustration: "line-up-ends",
      },
      {
        title: "Weight and capacity",
        paragraphs: [
          "A balance is a bar with a pan hanging at each end. The bar is called the beam. Put one thing in each pan. The heavier thing pulls its pan down. If both weigh the same, the beam stays level: flat, with neither pan lower.",
          "Look at the picture. The small ball's pan is lower. So the small ball is heavier than the big box. Small things can be heavy. Look at the beam, not at the sizes.",
          "To see which jar holds more, fill one jar with water. Pour all of it into the other jar, which must be empty. Is there room left at the top? Then the second jar holds more. Does water spill over? Then the first jar holds more. Is it filled to the top with none spilled? Then they hold the same.",
        ],
        illustration: "balance-heavier",
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Compare one thing at a time",
        paragraphs: [
          "Length, weight and capacity are different things to measure.",
          "A fair comparison checks the same thing for both objects, in the same way. For length, start both at the same line. For weight, use a balance. For capacity, pour one full container into the other.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A small ball is on the left pan and a big box is on the right. The left pan is lower. Which is heavier?",
      steps: [
        "A balance goes down on the heavier side. The heavier thing pulls its pan down.",
        "The left pan, with the ball, is lower.",
        "So the ball is heavier, even though the box is bigger. Size does not tell you weight.",
      ],
      answer: "the ball",
    },
    pitfalls: [
      "Bigger does not always mean heavier. A big pillow can be lighter than a small rock.",
      "A strip that ends farther right is not always longer. Line up the starts before you compare.",
      "A taller jar does not always hold more. A wide jar can hold more.",
    ],
    parentGuide:
      "Hold a small heavy object and a large light one, one in each hand. Ask which is heavier before and after feeling them. Then compare two cups by pouring water from one into the other.",
  },
  {
    id: "measure-with-equal-units",
    title: "Measure with equal units",
    summary:
      "To measure means to find out how long something is. Lay things that are all the same size, like blocks, along it from end to end. Each one is called a unit. Count the units. The count tells how long it is.",
    templateIds: [
      "measure-with-units",
      "correct-unit-measure",
      "order-lengths",
    ],
    senses: { unit: "unit", cube: "cube" },
    noLink: ["third", "leaves", "change", "changes"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Measure a length by counting equal units laid end to end.",
      "Tell why a gap, an overlap or a wrong start gives the wrong count.",
      "Find the longest of three things from two comparisons.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Count equal steps along the object",
        paragraphs: [
          "A cube is a block shaped like a die, the number cube used in games, with six flat sides that are all the same size. Line up cubes along a pencil. All the cubes are the same size.",
          "Start the first cube at one end of the pencil. Make each cube touch the next one. Stop at the other end. Now count the cubes. If there are 6, the pencil is 6 cubes long.",
          "Length is how long something is, from one end to the other. A unit is the equal thing you count with. Here the unit is one cube.",
        ],
      },
      {
        title: "Start at the end, no gaps, no overlaps",
        paragraphs: [
          "You can use cubes, paper clips or any equal things as units. Lay them along the object.",
          "Put the first unit right at one end. Make each unit touch the next one. A gap is an empty space between two units. An overlap is when one unit lies on top of another.",
          "Look at the picture. The same pencil is measured three ways. With no gaps or overlaps, it is 6 cubes long. That count is right.",
          "With gaps, some of the pencil has no cube on it. The count is too small: only 4. With overlaps, some of the pencil is counted twice. The count is too big: 11.",
        ],
        illustration: "unit-iteration",
      },
      {
        title: "A ruler is equal units already in a row",
        paragraphs: [
          "A ruler is a strip with marks on it. The spaces between the marks are equal units, end to end. The marks have numbers, so you do not have to count each space.",
          "Look at the picture. The crayon's left end is at 0. Its right end is at 5. So the crayon is 5 units long. Always start at 0, not at 1, because 0 is where the first unit begins.",
        ],
        illustration: "ruler-units",
      },
      {
        title: "Put three things in order",
        paragraphs: [
          "The red ribbon is longer than the blue ribbon. The blue ribbon is longer than the green ribbon.",
          "The blue ribbon is in both sentences. It is in the middle. The red one is longer than it, and the green one is shorter. So the red ribbon is the longest, and the green ribbon is the shortest.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Equal units make a measurement",
        paragraphs: [
          "A length is measured with units that are all the same size. They go end to end, from one end of the object to the other. There are no gaps and no overlaps.",
          "A bigger unit gives a smaller count. A smaller unit gives a bigger count. The object stays just as long.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "Cubes are lined up along a pencil, end to end, starting at one end. There are 6 cubes from one end of the pencil to the other. How long is the pencil?",
      steps: [
        "Check the cubes first. They start at the end of the pencil. They touch each other, and none lies on top of another, so there are no overlaps. So every bit of the pencil is counted once.",
        "Count them: 1, 2, 3, 4, 5, 6.",
        "Each cube is one unit, so the pencil is 6 cubes long.",
      ],
      answer: "6",
      answerUnit: "cubes",
    },
    pitfalls: [
      "A gap makes the count too small. An overlap makes the count too big.",
      "Start measuring at the end of the object. On a ruler, start at 0, not at 1.",
    ],
    parentGuide:
      "Measure a spoon with paper clips. Then leave a gap on purpose. Ask whether the new count is right, and why.",
  },
  {
    id: "mass-and-liquid-volume",
    title: "Mass and liquid volume",
    summary:
      "A unit is an amount you measure with. Mass is how heavy something is. We measure it in grams: a paper clip is about 1 gram. Liquid volume is how much liquid there is. We measure it in liters: a big water bottle holds about 1 liter. Always read the number and its unit together.",
    templateIds: ["read-liquid-volume", "balance-mass", "mass-volume-story"],
    senses: {
      unit: "unit",
      balance: "balance-scale",
      scale: "scale-axis",
      "more than": "more-than",
    },
    includeGeneratedRepresentation: false,
    objectives: [
      "Find a mass in grams from the masses that balance it.",
      "Read a liquid volume in liters when each mark is worth more than 1.",
      "Solve one-step stories with grams, kilograms and liters.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "A number needs a measuring unit",
        paragraphs: [
          "Suppose a reading says only 5. That does not tell you much. A unit is the amount you count with. 5 grams is a mass: it tells how heavy something is. 5 liters is a liquid volume: it tells how much liquid there is.",
          "So read the number and its unit together. Do that before you compare or work out an answer.",
        ],
      },
      {
        title: "Grams on a balance",
        paragraphs: [
          "Mass is measured in grams and kilograms. A paper clip is about 1 gram. 1 kilogram is 1000 grams, about as heavy as a big book. 5 g means 5 grams, and 5 kg means 5 kilograms.",
          "A balance is a beam with a pan on each end. The heavier pan goes down. When the beam is level, or flat, both pans hold the same mass.",
          "Look at the picture. The balance is level. A bag is on one pan. Weights marked 200 g, 50 g and 5 g are on the other pan. So the bag has the same mass as all three together: 200 + 50 + 5 = 255 g.",
        ],
        illustration: "balance-grams",
      },
      {
        title: "Liters on a scale",
        paragraphs: [
          "Liquid volume is measured in liters. 5 L means 5 liters. A large water bottle holds about 1 liter.",
          "A scale is a row of marks with numbers, like a ruler standing up. A container can have a scale on its side. Each small mark is called a tick. Only some ticks have a number, called a label.",
          "So first find what one tick is worth. Take two labels next to each other and subtract the smaller from the bigger. The spaces between them are equal, so divide by the number of spaces.",
          "Look at the picture. The labels are 0, 10, 20 and 30. There are 5 spaces from one label to the next. So each tick is 10 ÷ 5 = 2 liters. The water is 3 ticks above 20. Those 3 ticks add 3 × 2 = 6 liters. So the water is 20 + 6 = 26 liters.",
        ],
        illustration: "liquid-scale-ticks",
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Keep the unit with the amount",
        paragraphs: [
          "A level balance shows the same mass on both pans. The scale on a container shows its liquid volume. Equal spaces on a scale stand for equal amounts.",
          "Add, subtract or compare two measurements only when they use the same unit. Change one first if they do not. The answer keeps the unit.",
        ],
      },
    ],
    workedExample: {
      prompt: "Each bottle holds 2 liters. How many liters do 7 bottles hold?",
      steps: [
        "There are 7 bottles, and each holds the same amount: 2 liters. That is 7 equal groups of 2 liters.",
        "To find the total of equal groups, multiply: 7 × 2 = 14.",
        "Keep the unit with the number. The bottles hold 14 liters.",
      ],
      answer: "14",
      answerUnit: "liters",
    },
    pitfalls: [
      "A tick is not always worth 1 liter. Work out its value from the labels first.",
      "Use the same unit before adding or subtracting: grams with grams, liters with liters.",
    ],
    parentGuide:
      "Read the scale on a measuring jug together while filling it. Ask how many liters or milliliters each small mark stands for.",
  },
];

export const attributeMethods: Record<string, ProblemMethod> = {
  "compare-lengths": {
    goal: "Decide which of two strips is longer or shorter, or that they are equal.",
    intuition:
      "Length is how long something is, from one end to the other. To compare two strips fairly, they must start at the same line. Then the strip that reaches farther is longer. The other strip is shorter.",
    terms: ["length"],
    noLink: ["edge"],
    method: [
      "Look at the left ends. Do both strips start at the same line?",
      "If one starts farther right, picture sliding it back to the same start line.",
      "From the same start, the strip that reaches farther is longer.",
    ],
    watch:
      "Ending farther right does not tell you which strip is longer. Line up the starts first.",
  },
  "compare-weights": {
    goal: "Read a balance to decide which object is heavier or lighter.",
    intuition:
      "A balance has a bar, called the beam, with a pan, a small tray, at each end. Put one thing on each pan. The heavier thing pulls its pan down. If both weigh the same, the beam stays level, or flat.",
    terms: ["balance-scale"],
    senses: { balance: "balance-scale" },
    noLink: ["side", "sides"],
    method: [
      "Find the pan that is lower. The thing on it is heavier.",
      "The thing on the higher pan is lighter.",
      "If the beam is level, the two things weigh the same.",
    ],
    watch: "Look at the beam, not the sizes. A small thing can be heavy.",
  },
  "compare-capacity": {
    goal: "Decide which container holds more after pouring one into the other.",
    intuition:
      "A container is something that holds things, like a can or a jar. Capacity is how much a container can hold. Fill one container with water. Pour all of it into the other, empty one. What happens shows which one holds more.",
    terms: ["capacity"],
    senses: { "more than": "more-than" },
    method: [
      "Look at container B after all the water from container A is poured in.",
      "Is there room left at the top? Then B holds more.",
      "Did water spill over? Then A holds more. Is B filled to the top with none spilled? They hold the same.",
    ],
    watch:
      "A taller container does not always hold more. A wide one can hold more.",
  },
  "measure-with-units": {
    goal: "Count equal units laid end to end along an object.",
    intuition:
      "To measure means to find how long something is. A cube is a block shaped like a die, a number cube. A unit is one of the same-size things you count with, like one cube. The units must start at one end and touch. A gap is an empty space between units. An overlap is when one unit lies on top of another. There must be no gaps and no overlaps.",
    terms: ["unit"],
    senses: { unit: "unit", cube: "cube" },
    method: [
      "Check that the first unit starts at one end of the object.",
      "Check that the units touch and do not lie on top of each other.",
      "Count the units from one end of the object to the other.",
    ],
    watch: "Count the units themselves, not the spaces between them.",
  },
  "correct-unit-measure": {
    goal: "Pick the picture that measures a length correctly.",
    intuition:
      "To measure means to find how long something is. A cube is a block shaped like a die, a number cube. A unit is one of the same-size things you measure with, like one cube. A gap is an empty space between two units. An overlap is when one unit lies on top of another. A correct measurement starts at one end and has no gaps or overlaps.",
    terms: ["unit"],
    senses: { unit: "unit", cube: "cube" },
    noLink: ["rule", "part"],
    method: [
      "Cross out any picture with gaps between the units.",
      "Cross out any picture where units lie on top of each other.",
      "Cross out any picture whose units do not start at one end of the object and reach the other end.",
    ],
    watch:
      "A gap makes the count too small. An overlap makes the count too big.",
  },
  "order-lengths": {
    goal: "Find the longest or shortest of three ribbons from two comparisons.",
    intuition:
      "Length is how long something is. Two sentences each compare two ribbons. One ribbon is in both sentences. It is longer than one ribbon and shorter than the other, so it is in the middle.",
    terms: [
      [
        "length",
        "To compare lengths, decide which of two is longer or shorter.",
      ],
    ],
    noLink: ["side"],
    method: [
      "Find the ribbon named in both sentences. If one ribbon is longer than it and the other is shorter, it goes in the middle.",
      "Put the ribbon that is longer than it first.",
      "Put the ribbon that is shorter than it last.",
    ],
    watch:
      "Shorter and longer are the same comparison turned around. If the red ribbon is shorter than the blue one, the blue one is longer than the red one.",
  },
  "read-liquid-volume": {
    goal: "Read a liquid volume in liters on a container scale.",
    intuition:
      "A liter is a unit for how much liquid there is. A large water bottle holds about 1 liter. The scale on the container is a row of marks, like a ruler standing up. Each small mark is a tick. Only some ticks have a number, called a label.",
    terms: ["liter"],
    senses: { scale: "scale-axis", unit: "unit" },
    method: [
      "Find what one tick is worth. Subtract the smaller of two labels next to each other from the bigger one. Then divide by the equal spaces between them.",
      "Find the label just below the top of the water.",
      "Count up from that label by the tick value, one tick at a time.",
    ],
    watch: "A tick is not always worth 1 liter. Find its value first.",
  },
  "balance-mass": {
    goal: "Find an object's mass from the standard masses that balance it.",
    intuition:
      "Mass is how heavy something is. A unit is an amount you measure with. A gram is a small unit of mass: a paper clip is about 1 gram. A balance is a beam with a pan on each end. When the beam is level, or flat, both pans hold the same mass. Standard masses are weights with their grams written on them.",
    terms: ["gram"],
    senses: { balance: "balance-scale", unit: "unit" },
    method: [
      "Check that the beam is level. Then the object has the same mass as the other pan.",
      "Add the standard masses on the other pan, largest first.",
      "Write the total in grams.",
    ],
    watch: "The beam must be level. Only then do the masses equal the object.",
  },
  "mass-volume-story": {
    goal: "Solve a one-step story with grams, kilograms or liters.",
    intuition:
      "A unit is an amount you measure with, like 1 gram. Grams and kilograms measure mass, how heavy something is. A paper clip is about 1 gram, and 1 kilogram is 1000 grams. Liters measure liquid volume, how much liquid there is: a big water bottle holds about 1 liter. Read the story to choose the operation: add, subtract, multiply or divide. Keep the unit in the answer.",
    terms: ["gram", "kilogram", "liter"],
    senses: { unit: "unit", part: "part" },
    method: [
      "Decide what the story does. Putting amounts together adds. Taking some away, or finding how much heavier or how much more, subtracts.",
      "Finding the total of equal groups multiplies. Sharing a total equally, to find how much each group gets, divides.",
      "Work out the answer and write the unit after it.",
    ],
    watch:
      "Both amounts must use the same unit before you add or subtract them.",
  },
};
export const attributePrinciples: Record<string, string> = {
  "compare-lengths":
    "Line two strips up at the same start. Then the one that reaches farther is longer.",
  "compare-weights":
    "A balance compares weight: the heavier side goes down, and equal weights keep the beam level.",
  "compare-capacity":
    "Pouring one full container into another shows which holds more, whatever their shapes.",
  "measure-with-units":
    "A length in units is the number of equal units laid end to end, with no gaps or overlaps.",
  "correct-unit-measure":
    "Every bit of the length must be covered by exactly one unit, starting at the end.",
  "order-lengths":
    "If the first ribbon is longer than the second, and the second is longer than the third, then the first is longer than the third.",
  "read-liquid-volume":
    "Equal spaces on a scale stand for equal amounts. Subtract two labels next to each other, then divide by the spaces between them, to get one tick.",
  "balance-mass": "A level balance means the masses on its two pans are equal.",
  "mass-volume-story":
    "A measurement is a number with a unit. The story tells you the operation, and the unit stays with the answer.",
};
