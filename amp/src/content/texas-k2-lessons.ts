import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

type Spec = {
  id: string;
  title: string;
  summary: string;
  objectives: string[];
  intuitionTitle: string;
  intuition: string[];
  example: { prompt: string; steps: string[]; answer: string };
  methodTitle: string;
  method: string[];
  formalTitle: string;
  formal: string[];
  pitfalls: string[];
  parentGuide: string;
  senses?: Lesson["senses"];
  noLink?: string[];
};

const lesson = (s: Spec): Lesson => ({
  id: s.id,
  title: s.title,
  summary: s.summary,
  ...(s.senses ? { senses: s.senses } : {}),
  ...(s.noLink ? { noLink: s.noLink } : {}),
  templateIds: [s.id],
  objectives: s.objectives,
  sections: [
    { stage: "intuition", title: s.intuitionTitle, paragraphs: s.intuition },
  ],
  workedExample: {
    prompt: s.example.prompt,
    steps: s.example.steps,
    answer: s.example.answer,
  },
  closingSections: [
    { stage: "method", title: s.methodTitle, paragraphs: s.method },
    { stage: "formal", title: s.formalTitle, paragraphs: s.formal },
  ],
  pitfalls: s.pitfalls,
  parentGuide: s.parentGuide,
});

export const texasK2Methods: Record<string, ProblemMethod> = {
  "coin-name-and-cent-value": {
    goal: "Given a picture or a value of a coin, say its name, find the picture of a named coin, or write its value with the cent symbol.",
    intuition:
      "Coins are small metal pieces of money. A cent is the smallest amount of United States money. The value of a coin is how many cents it is worth. A penny is worth 1 cent. A nickel is worth 5 cents. A dime is worth 10 cents. A quarter is worth 25 cents. We write cents with the cent sign ¢ after the number. So 5¢ means 5 cents.",
    noLink: ["quarter", "quarters", "edge", "edges"],
    terms: [
      "cent",
      ["cent", "The cent symbol ¢ goes right after the number, as in 10¢."],
    ],
    method: [
      "Look for a number of cents on the coin or in the question. Match it: 1¢ is a penny, 5¢ is a nickel, 10¢ is a dime and 25¢ is a quarter.",
      "No number? Look at the color. The penny is the only copper-colored coin. The other three are silver-colored.",
      "Then look at the size. Of the silver coins, the dime is the smallest and the quarter is the biggest. The nickel is in between, and its edge is smooth.",
      "To write a value, write the number first. Then put ¢ right after it: 10¢.",
    ],
    watch:
      "A dime is smaller than a nickel, but it is worth more: 10¢, not 5¢. Name a coin by its value, not its size. Write ¢ after the number.",
  },
  "solid-bottom-face-shape": {
    noLink: ["lines"],
    goal: "Given a solid standing on a table, name the flat shape of the face that touches the table.",
    intuition:
      "A solid is a shape you can hold, like a box, a can or a ball. A face is a flat surface of a solid. When a solid with flat faces stands on a table, one face touches the table. That face is the bottom face. A side of a flat shape is one of the straight lines around it. A corner is where two sides meet. A square corner looks like the corner of a page.",
    senses: {
      solid: "solid-shape",
      face: "face-solid",
      side: "side",
      square: "square-shape",
      cube: "cube",
    },
    terms: ["face-solid", "corner"],
    method: [
      "Look at the face on the table. If it is perfectly round, the same width across every way, with no corners, it is a circle.",
      "If it has straight sides, count them. 3 sides make a triangle.",
      "4 sides and 4 square corners: compare the sides. All 4 sides the same length make a square. 2 long sides and 2 short sides make a rectangle that is not a square.",
    ],
    watch:
      "A square and a rectangle both have 4 square corners. A square is a rectangle with all 4 sides the same length. Check the sides before you choose.",
  },
  "measurable-attribute-choice": {
    noLink: ["key", "third"],
    goal: "Given a question or a goal about an object, name the attribute (length, capacity or weight) that should be measured.",
    intuition:
      "To measure means to find how much of something there is. You count units, like cubes or cups. An attribute is something about an object, like its color, size or weight. Some attributes can be measured with a unit. Length is how long, tall or wide it is. Capacity is how much a container can hold. Weight is how heavy it is.",
    senses: { unit: "unit", units: "unit", cube: "cube", cubes: "cube" },
    terms: ["length", "capacity", "weight"],
    method: [
      "Find the key words in the question.",
      "Long, tall or wide: length. Hold: capacity. Heavy or light: weight.",
      "Color is about an object too. But these questions ask about length, capacity or weight, so color is never the answer here.",
    ],
    watch:
      "A big container can be light, and a heavy rock can be short. Choose what the question asks about, not what looks biggest.",
  },
  "dot-group-compared-to-number": {
    goal: "Given groups of up to 20 dots, find the group that has more than, fewer than or the same number as a given number or group.",
    intuition:
      "Count each group first, touching each dot once. More than means a bigger number. Fewer than means a smaller number. Equal to means the same as: the count and the number match. For example, 8 dots are more than 6, because you say 8 after 6 when you count.",
    terms: ["more-than", "less-than", "equal"],
    senses: { "more than": "more-than" },
    method: [
      "Count the dots in each group. Touch each dot once.",
      "Compare each count with the number in the question.",
      "Choose the group whose count is more than, fewer than or the same as that number, as the question asks.",
    ],
    watch:
      "A group with exactly 7 dots is not more than 7 and not fewer than 7. It is the same as 7.",
  },
  "story-sentence-match-20": {
    goal: "Match an addition or subtraction story within 20 to the number sentence that tells it, and a number sentence to its story.",
    intuition:
      "A story problem tells what happens to some things. A number sentence tells the same story with numbers and signs, like 9 + 5 = 14. The sign + means put together. The sign − means take away. The sign = means is the same amount as. A box □ stands for the number the story asks for. To match, ask what happens and which number is missing.",
    senses: {
      part: "part",
      parts: "part",
      difference: "difference-subtract",
      whole: "whole",
    },
    terms: [
      "number-sentence",
      [
        "unknown",
        "Here a box $\\square$ holds the place of the unknown number.",
      ],
    ],
    method: [
      "Find what happens. Things are put together, some are taken away, or two groups are compared. Compare means find how many more one group has.",
      "Find the number the story asks for. That number is the box.",
      "Put together: use +. Take away or compare: use −. Sometimes the total is known and a part is missing. Then the box is the missing part, as in 9 + □ = 14.",
      "Read the sentence back as a story. Check that it says the same thing.",
    ],
    watch:
      "The same numbers can tell different stories. Look where the box is. It can be the total, the part added, the part taken away or the number left.",
  },
  "story-sentence-match-1000": {
    noLink: ["change"],
    goal: "Match an addition or subtraction story within 1,000 to the number sentence that tells it, and a number sentence to its story.",
    intuition:
      "A story problem tells what happens to some things. A number sentence tells the same story with numbers and signs, like 267 + 469 = 736. The sign + means put together, − means take away, and = means is the same amount as. A box □ stands for the number the story asks for. Big numbers do not change the story. Ask what happens and which number is missing.",
    senses: {
      part: "part",
      parts: "part",
      difference: "difference-subtract",
      whole: "whole",
    },
    terms: [
      "number-sentence",
      [
        "unknown",
        "Here a box $\\square$ holds the place of the unknown number.",
      ],
    ],
    method: [
      "Find what happens. Things are put together, some are taken away, or two groups are compared. Compare means find how many more one group has.",
      "Find the number the story asks for. That number is the box.",
      "Put together: use +. Take away or compare: use −. Sometimes the total is known and a part is missing. Then the box is the missing part, as in 267 + □ = 736.",
      "Read the sentence back as a story. Check that it says the same thing.",
    ],
    watch:
      "Big numbers do not change what happens in the story. Do not subtract just because a number is big. Look where the box is.",
  },
  "open-number-line-to-120": {
    goal: "On a number line with only three labels, find the point at a given number or read the number at a marked point, up to 120.",
    intuition:
      "A number line is a row of numbers in order, with equal spaces between them. Tick marks are the short marks where the numbers sit, and only a few have their number written. A jump is a move from one tick to the next. Each jump to the right adds the same amount, called the step, and each jump to the left takes it away. A point is a dot that marks one spot, named with a letter. Labeled means the number is written. From a labeled tick, count by the step, such as 10, 20, 30 for a step of 10, to find the number at any tick.",
    senses: { jump: "jump", jumps: "jump" },
    terms: [
      "tick-mark",
      [
        "tick-mark",
        "The step is how much each tick mark adds to the one before it.",
      ],
    ],
    method: [
      "Pick two labeled numbers next to each other. Count the jumps between their ticks.",
      "Find the step. Try a step such as 1, 2, 5 or 10, and count by it that many times from the first label. If you land exactly on the next label, that is the step.",
      "Start at the labeled number nearest the point. Count up by the step for each jump to the right, or count back by the step for each jump to the left.",
    ],
    watch:
      "Do not count the labeled tick as a jump. Count the jumps between ticks, and use the step that the labels show.",
  },
  "open-number-line-to-1000": {
    noLink: ["lines"],
    goal: "On a number line with only three labels, find the point at a given number or read the number at a marked point, up to 1,000.",
    intuition:
      "A number line is a line with numbers in order. Bigger numbers are to the right. Tick marks are the short lines where the numbers sit, the same distance apart. Labeled means a tick has its number written. Here only three ticks are labeled. A jump is a move from one tick to the next. Each jump to the right adds the same amount, called the step. The step can be 10, 50 or 100.",
    senses: { jump: "jump", jumps: "jump", "more than": "more-than" },
    terms: [
      "tick-mark",
      [
        "tick-mark",
        "The step is how much each tick mark adds to the one before it.",
      ],
    ],
    method: [
      "Pick two labeled numbers next to each other. Count the jumps between their ticks.",
      "Find the step. Try a step such as 10, 25, 50 or 100. Count by it once for each jump from the first label. If you land exactly on the next label, that is the step.",
      "Start at the labeled number nearest the point. Count up by the step for each jump to the right. Count back by the step for each jump to the left.",
    ],
    watch:
      "The step is not always 1 or 10. On a line from 0 to 500 with 10 jumps, each step is 50. Find the step from the labels first.",
  },
  "eighths-and-parts-beyond-one": {
    goal: "Name shaded eighths, find how many equal parts make one whole, and describe shaded parts that go past one whole.",
    intuition:
      "A whole is one full thing, like one bar or one pizza. Equal parts are parts that are all the same size. Cut a whole into 8 equal parts, and each part is one eighth. 8 eighths fill one whole. Shaded parts are the colored ones. If more than 8 eighths are shaded, that is one whole and some more.",
    senses: {
      whole: "whole",
      eighth: "eighth",
      eighths: "eighth",
      third: "third",
      thirds: "third",
      fourth: "fourth",
      fourths: "fourth",
      "more than": "more-than",
      part: "part",
      parts: "part",
    },
    terms: ["equal-parts", "eighth", "whole"],
    method: [
      "Count all the equal parts in one whole bar. That number names the parts: 2 halves, 3 thirds, 4 fourths, 8 eighths.",
      "Count the shaded parts. Say the number, then the name: 3 eighths.",
      "If one whole bar is all shaded, call it 1 whole. Then count the shaded parts in the next bar: 1 whole and 3 eighths.",
    ],
    watch:
      "Name the parts by how many equal parts fill one whole, not by how many are shaded. Count only the shaded parts for the amount.",
  },
  "decompose-flat-shape": {
    noLink: ["lines", "line"],
    goal: "Given a square or rectangle cut into equal parts, say how many parts there are and name the shape of the parts.",
    intuition:
      "To decompose a shape means to cut it into smaller shapes. Look at the picture and count the parts the cuts make. A side is one of the straight lines around a shape. A corner is where two sides meet. Count the sides and corners of one part to name it.",
    senses: {
      side: "side",
      sides: "side",
      square: "square-shape",
      part: "part",
      parts: "part",
    },
    terms: ["decompose", "diagonal"],
    method: [
      "Count the parts the cuts make.",
      "Pick one part and count its sides. 3 sides: a triangle. 4 square corners and 4 sides the same length: a square. 4 square corners, 2 long sides and 2 short sides: a rectangle that is not a square.",
      "Check that all the parts have the same shape, so one name fits them all. Say how many, then the name, like 4 triangles.",
    ],
    watch:
      "A cut from one corner of a rectangle to the far corner makes triangles, not rectangles. A square cut into 2 equal strips makes 2 rectangles that are not squares.",
  },
  "unit-size-and-count": {
    noLink: ["change", "changes"],
    goal: "Measure the same length with a shorter and a longer unit, and tell which needs fewer copies and why.",
    intuition:
      "A unit is the thing you measure with, like a paper clip or a block. To measure a length, lay copies of the unit end to end with no gaps. Copies are units that are all the same. Count the copies. A longer unit covers more with each copy, so you need fewer copies. A shorter unit covers less, so you need more copies.",
    senses: { unit: "unit", units: "unit" },
    terms: [
      "unit",
      ["unit", "Copies counts how many times the unit is laid end to end."],
    ],
    method: [
      "Look at one copy of each unit. Which unit is longer?",
      "The longer unit needs fewer copies. The shorter unit needs more copies.",
      "To count long units, find how many small units one long unit covers. Count by that number up to the length. The number of counts is the number of long units.",
    ],
    watch:
      "The ribbon is the same length each time. Only the size of the unit changes the count. A bigger count means a shorter unit.",
  },
  "benchmark-length-estimate": {
    senses: { unit: "unit" },
    goal: "Estimate a length by repeating a benchmark length, and choose the reasonable estimate for a familiar object.",
    intuition:
      "A benchmark is a length you know well. A ruler is 12 inches long. A paper clip is about 1 inch long. To estimate means to find a number close to the real length without measuring it exactly. If an object is about 3 benchmarks long, add the benchmark length 3 times.",
    terms: ["benchmark", "estimate"],
    method: [
      "Find the benchmark length in the problem, or think of one you know.",
      "The object is a number of benchmarks long. Add the benchmark length that many times.",
      "Check that the answer fits what you know about the real object. Check the unit too: inches, feet or centimeters.",
    ],
    watch:
      "Check the unit as well as the number. A pencil is about 7 inches long, not 7 feet. An estimate is a careful guess, so it may not be exact.",
  },
  "clock-minute-match": {
    goal: "Read an analog clock to the minute and match it with a digital time, or find the clock that matches a digital time.",
    intuition:
      "An analog clock has the numbers 1 to 12 around it and two hands. The short hand is the hour hand. It shows the hour. The long hand is the minute hand. It shows the minutes after the hour. Start at the 12. Each number the long hand reaches adds 5 minutes. Each small tick mark between numbers adds 1 minute. A digital time is written with digits, like 4:07.",
    terms: ["minute-hand", "hour-hand"],
    method: [
      "Read the hour. If the short hand points right at a number, that number is the hour. If it is between two numbers, the hour is the number it has just passed.",
      "Read the minutes. Count by fives from the 12 to the last number the long hand passed. Then count on by ones for each small tick mark.",
      "Write the hour, a colon, then two digits for the minutes: 4:37. If the minutes are less than 10, write a 0 first: 4:07.",
    ],
    watch:
      "Do not swap the hands. The short hand shows the hour and the long hand shows the minutes. Minutes less than 10 need a 0 in front: 4:07.",
  },
  "tally-and-t-chart": {
    noLink: ["part", "jump", "line", "lines"],
    goal: "Read a tally chart to find a count, a difference or a total, and choose the T-chart that organizes a list of answers.",
    intuition:
      "A tally mark is a short line you draw for each thing you count. Every fifth mark goes across the four before it. That makes a group of 5. A tally chart shows the tally marks for each choice. The T-chart has two columns, lists that go down, split by a line. One column names each choice. The other shows its count.",
    senses: { difference: "difference-subtract" },
    terms: ["tally-mark", "t-chart"],
    method: [
      "Count each group of five as 5. Then count on the lines left over.",
      "How many more means find the difference: subtract the smaller count from the bigger one. For a total, add all the counts.",
      "To make a T-chart from a list, go through the list one answer at a time. Make one mark for each answer, and cross it out as you count it.",
    ],
    watch:
      "The line across a group of five is part of the five. Do not count it as a sixth.",
  },
  "early-money-decisions": {
    noLink: ["part", "parts"],
    goal: "Tell income from a gift, spending from saving and a deposit from a withdrawal, and find savings and the cost to make an item.",
    intuition:
      "Income is money you earn by doing work. A gift is money someone gives you without work. To spend is to use money to buy something now. To save is to keep money to use later. A bank account keeps your money at a bank. A deposit puts money in. A withdrawal takes money out. The balance is how much money is in the account. A producer makes things to sell, and a consumer buys and uses them.",
    senses: { balance: "balance-account" },
    terms: [
      "income",
      [
        "income",
        "A gift is something given to you without working for it, such as birthday money.",
      ],
      "producer",
      "consumer",
    ],
    method: [
      "Ask what the question is about. Is it pay for work or a gift? Buying or keeping? Putting money in or taking it out? Making or buying?",
      "For savings over time, add the money saved each week, once for every week. Then add any money saved before.",
      "For the cost to make an item, find the cost of each kind of part. The sign × means times: $3 \\times 4$¢ is 3 groups of 4¢, so 4 + 4 + 4 = 12¢. Then add the costs of all the parts.",
    ],
    watch:
      "A deposit makes the balance go up, and a withdrawal makes it go down. A shop owner who makes the goods is the producer. The person who buys them is the consumer.",
  },
};

export const texasK2Principles: Record<string, string> = {
  "coin-name-and-cent-value":
    "A penny is worth 1 cent, written 1¢. A nickel is worth 5 cents, written 5¢. A dime is worth 10 cents, written 10¢. A quarter is worth 25 cents, written 25¢. The cent sign ¢ goes after the number.",
  "solid-bottom-face-shape":
    "A face of a solid is a flat surface. A cube, shaped like a toy block, has 6 square faces. A box can have rectangle faces. A can, called a cylinder, and a cone each have a circle face to stand on. A pyramid can stand on a square face or a triangle face. A triangular prism, shaped like a tent, has a triangle face at each end.",
  "measurable-attribute-choice":
    "An attribute is something about an object, like its color or its weight. Length, capacity and weight are three attributes you can measure with a unit. A question about how long, how much it holds or how heavy asks about one of them.",
  "dot-group-compared-to-number":
    "Take two numbers from the count 0, 1, 2, 3 and so on. Exactly one is true: the first is more than the second, fewer than the second, or the same as the second. Counting each object once gives how many are in a group.",
  "story-sentence-match-20":
    "A put-together story looks like part + part = total, such as 9 + 5 = 14. A take-away story looks like start − part taken = part left, such as 14 − 5 = 9. The box can stand for any of the numbers. A sentence matches a story when it shows the same action, with the box in the same place.",
  "story-sentence-match-1000":
    "A put-together story looks like part + part = total, such as 267 + 469 = 736. A take-away story looks like start − part taken = part left, such as 320 − 145 = 175. The box can stand for any of the numbers. A sentence matches a story when it shows the same action, with the box in the same place.",
  "open-number-line-to-120":
    "On a number line the tick marks are equally spaced, so each jump to the right adds the same step. Adding the step once for each jump takes you from a label to the next label on its right. A point a few jumps right of a label is that label plus one step per jump. A point to the left is the label minus one step per jump.",
  "open-number-line-to-1000":
    "The tick marks are the same distance apart, so every jump adds the same step. Say 500 and 750 are 5 jumps apart. Counting by 50 five times goes 550, 600, 650, 700, 750, so the step is 50. A point 2 jumps right of 750 is at 750 + 50 + 50 = 850.",
  "eighths-and-parts-beyond-one":
    "When a whole is cut into 8 equal parts, each part is one eighth, and 8 eighths make one whole. In the same way, 4 fourths make one whole. More than 8 eighths is more than one whole: 11 eighths is 1 whole and 3 eighths.",
  "decompose-flat-shape":
    "A shape can be cut into smaller shapes that fit back together with no gaps. A cut from one corner to the far corner is called a diagonal. It cuts a rectangle into 2 triangles. Cutting a rectangle into equal strips makes smaller rectangles.",
  "unit-size-and-count":
    "The length being measured stays the same. Each copy of a longer unit covers more, so fewer copies cover the length. Each copy of a shorter unit covers less, so more copies are needed.",
  "benchmark-length-estimate":
    "A crayon is about 4 inches long. A shelf is about 5 crayons long. So the shelf is about 4 + 4 + 4 + 4 + 4 = 20 inches long. An estimate is a careful guess. It should be close to the real length, but it may not be exact.",
  "clock-minute-match":
    "The hour hand shows the hour it has passed. The minute hand counts minutes from the 12: 5 minutes for each number and 1 minute for each small tick mark. There are 60 minutes in an hour. A digital time is the hour, a colon, then two digits for the minutes, like 4:07.",
  "tally-and-t-chart":
    "A group of five tally marks counts 5. To find the total, add all the counts. To find how many more, subtract the smaller count from the bigger count.",
  "early-money-decisions":
    "Income is money earned by doing work. A deposit adds to the balance of an account, and a withdrawal takes money away from it. If you save the same amount each week, your savings grow by that amount each week. Say you start with 10 dollars and save 4 dollars a week. After 5 weeks you have 10 + 4 + 4 + 4 + 4 + 4 = 30 dollars.",
};

export const texasK2Lessons: Lesson[] = [
  lesson({
    id: "coin-name-and-cent-value",
    senses: { "more than": "more-than" },
    title: "Name coins and write cents",
    summary:
      "Coins are small metal pieces of money. Each coin has a name and a value. The value is how many cents the coin is worth. A cent is the smallest amount of United States money. We write cents with the cent sign ¢ after the number. So 5¢ means 5 cents.",
    noLink: ["quarter", "quarters", "edge", "edges"],
    objectives: [
      "Name a penny, a nickel, a dime or a quarter from its value, or from its color and size.",
      "Write the value of a coin with the cent sign, such as 25¢.",
    ],
    intuitionTitle: "A name and a value",
    intuition: [
      "Four coins are used most. A penny is worth 1 cent. A nickel is worth 5 cents. A dime is worth 10 cents. A quarter is worth 25 cents.",
      "One nickel buys the same as 5 pennies. One dime buys the same as 10 pennies.",
      "The cent sign ¢ goes after the number. 10¢ means 10 cents.",
    ],
    example: {
      prompt:
        "A coin shows 10¢. What is its name, and how do you write its value?",
      steps: [
        "Read the number on the coin. 10¢ means 10 cents.",
        "The coin worth 10 cents is a dime, so its name is dime.",
        "Write the number first, then the cent sign after it: 10¢.",
      ],
      answer: "A dime, written 10¢.",
    },
    methodTitle: "Match by value",
    method: [
      "Read the number of cents. Find it in this list: 1¢ is a penny, 5¢ is a nickel, 10¢ is a dime and 25¢ is a quarter.",
      "No number? Look at the color first. The penny is the only copper-colored coin. The other three are silver-colored.",
      "Then look at the size. Of the silver coins, the dime is the smallest and the quarter is the biggest. The nickel is in between, and its edge is smooth.",
      "Size does not tell value. The small dime is worth more than the bigger nickel.",
    ],
    formalTitle: "The four coins",
    formal: [
      "A penny is 1 cent, written 1¢. A nickel is 5 cents, written 5¢. A dime is 10 cents, written 10¢. A quarter is 25 cents, written 25¢.",
      "The cent sign ¢ always goes after the number.",
    ],
    pitfalls: [
      "A dime is smaller than a nickel but worth more. Match a coin by its value, not its size.",
      "Write ¢ after the number: 5¢, not ¢5.",
      "Do not use a dollar sign for cents. $5 means five dollars, and one dollar is 100 cents.",
    ],
    parentGuide:
      "Put a penny, a nickel, a dime and a quarter on the table. Ask the learner to name each coin and write its value, such as 10¢. Then ask which coin is smallest and which is worth the most.",
  }),
  lesson({
    id: "solid-bottom-face-shape",
    noLink: ["lines"],
    title: "The shape of a solid's bottom face",
    summary:
      "A solid is a shape you can hold, like a box, a can or a ball. A face is a flat surface of a solid. A ball has no faces, but a box has 6. A solid with faces can stand on one of them. That bottom face touches the table. To name it, see if it is round, or count its straight sides.",
    senses: {
      solid: "solid-shape",
      face: "face-solid",
      side: "side",
      square: "square-shape",
      cube: "cube",
    },
    objectives: [
      "Name the flat shape of the face a solid stands on: circle, triangle, square or rectangle.",
      "Tell a square from a rectangle by comparing its sides.",
    ],
    intuitionTitle: "A solid has flat faces",
    intuition: [
      "Hold a box. Its top, bottom and other surfaces are flat. Each flat surface is a face.",
      "Stand the box on a table. The face on the table is the bottom face. Trace around it with a pencil. The drawing is a flat shape.",
      "A side of a flat shape is one of the straight lines around it. A corner is where two sides meet. A square corner looks like the corner of a page.",
    ],
    example: {
      prompt:
        "A can of soup stands on a table. What is the shape of the face on the table?",
      steps: [
        "Look at the bottom of the can. It is round, with no corners and no straight sides.",
        "A flat shape that is perfectly round, the same width across every way, is a circle. So the bottom face is a circle.",
      ],
      answer: "A circle.",
    },
    methodTitle: "Look, then count",
    method: [
      "First, is the face perfectly round, the same width across every way? Then it is a circle.",
      "If not, count its straight sides. 3 sides make a triangle.",
      "4 sides and 4 square corners: compare the sides. All 4 sides the same length make a square. 2 long sides and 2 short sides make a rectangle that is not a square.",
    ],
    formalTitle: "Faces of common solids",
    formal: [
      "A cube, shaped like a toy block, has 6 square faces. A box can have rectangle faces.",
      "A can is called a cylinder. It stands on a circle face. A cone, shaped like an ice cream cone, also has a circle face.",
      "A pyramid has triangle faces that meet at a point at the top. It can stand on a square face or a triangle face. A triangular prism, shaped like a tent, has a triangle face at each end.",
    ],
    pitfalls: [
      "Look at the face on the table, not a face on the side.",
      "Check that all 4 sides are the same length before you say square.",
    ],
    parentGuide:
      "Stand a tissue box, a can and a block on the table. Ask the learner to trace around each bottom face and name the shape.",
  }),
  lesson({
    id: "measurable-attribute-choice",
    noLink: ["key"],
    title: "What can you measure?",
    summary:
      "To measure means to find how much of something there is. You count units, like cubes or cups. An attribute is something about an object, like its color or its size. Some attributes can be measured. Length is how long it is. Capacity is how much it can hold. Weight is how heavy it is. Key words in a question tell you which one to measure.",
    senses: { unit: "unit", units: "unit", cube: "cube", cubes: "cube" },
    objectives: [
      "Name the attribute a question asks about: length, capacity or weight.",
      "Choose what to measure to answer a question about an object.",
    ],
    intuitionTitle: "Three things to measure",
    intuition: [
      "Look at a pencil. You can measure its length: how long it is.",
      "Look at a jug. You can measure its capacity: how much water it holds.",
      "Pick up a backpack. You can measure its weight: how heavy it is.",
      "Color is about an object too. But here we measure only length, capacity and weight.",
    ],
    example: {
      prompt:
        "How much water does the bucket hold? Which attribute do you measure?",
      steps: [
        "Find the key words: “how much” and “hold.”",
        "How much a container holds is its capacity. So you measure capacity.",
      ],
      answer: "Capacity.",
    },
    methodTitle: "Match the key words",
    method: [
      "How long, how tall or how wide: measure length.",
      "How heavy: measure weight. How much it holds: measure capacity.",
      "Some questions give a goal, like “Will this jug hold all the juice?” Ask what you need to know. Here it is how much the jug holds, its capacity.",
    ],
    formalTitle: "Attributes and units",
    formal: [
      "We measure length with units like cubes, inches or centimeters. We measure capacity with units like cups. We measure weight with units like pounds.",
    ],
    pitfalls: [
      "Choose what the question asks about, not what sounds biggest.",
      "A tall thing can be light. A small thing can be heavy.",
    ],
    parentGuide:
      "Hold a water bottle. Ask three questions: How long is it? How heavy is it? How much does it hold? Ask which word in each question tells what to measure.",
  }),
  lesson({
    id: "dot-group-compared-to-number",
    title: "More, fewer or the same",
    summary:
      "More than means a bigger number. Fewer than means a smaller number. To compare a group with a number means to find whether the group has more, fewer or the same. First count the group, touching each dot once. The same as means the count and the number match.",
    senses: { "more than": "more-than" },
    objectives: [
      "Count groups of up to 20 dots.",
      "Choose the group that has more than, fewer than or the same as a number.",
    ],
    intuitionTitle: "Count, then compare",
    intuition: [
      "Count the dots in a group. Touch each dot once, so you never count a dot twice.",
      "Then ask: is my count more than the number, fewer than the number, or the same?",
      "Say the number is 6. A group of 8 dots has more than 6, because 8 comes after 6 when you count. A group of 5 has fewer than 6, because 5 comes before 6. A group of 6 has the same as 6.",
    ],
    example: {
      prompt:
        "Group A has 5 dots, group B has 8 dots and group C has 6 dots. Which group has more dots than 6?",
      steps: [
        "Each group is already counted: 5, 8 and 6 dots.",
        "Compare each count with 6. You say 5 before 6, so 5 is fewer. You say 8 after 6, so 8 is more. 6 is the same as 6.",
        "Only group B has more than 6.",
      ],
      answer: "Group B.",
    },
    methodTitle: "Check every group",
    method: [
      "Count the dots in each group, and say each count.",
      "Compare each count with the number in the question. Skip the groups that do not fit what the question asks.",
    ],
    formalTitle: "Comparing numbers",
    formal: [
      "Take two numbers from the count 0, 1, 2, 3 and so on. Exactly one of these is true: the first is more than the second, fewer than the second, or the same as the second.",
    ],
    pitfalls: [
      "A group with the same number is not more and not fewer.",
      "Count each dot once. Go in order, row by row, so you do not lose your place.",
    ],
    parentGuide:
      "Put out 7 coins. Ask the learner to make a group with more than 7 and a group with fewer than 7.",
  }),
  lesson({
    id: "story-sentence-match-20",
    title: "Match a story and a number sentence",
    summary:
      "A story problem tells what happens to some things. A number sentence tells the same story with numbers and signs. In 9 + 5 = 14, the sign + means put together. The sign = means is the same amount as. A box □ stands for a number you do not know yet. A story and a sentence match when they show the same action, with the box in the same place.",
    senses: {
      part: "part",
      parts: "part",
      side: "side-of-equation",
      sides: "side-of-equation",
    },
    objectives: [
      "Choose the number sentence that matches a story within 20.",
      "Choose the story that matches a number sentence within 20.",
    ],
    intuitionTitle: "The story and the sentence say the same thing",
    intuition: [
      "Here is a story. Mia has 9 stickers. She gets 5 more. Now she has 14.",
      "The number sentence 9 + 5 = 14 tells the same story. The + says she got more. The = says both sides are the same amount.",
      "Now hide one number. Mia has 9 stickers and gets some more. Now she has 14. The number she got is missing, so we write a box for it: 9 + □ = 14.",
      "To match a story with a sentence, ask two questions. What happens: put together, take away or compare? Which number is the box?",
    ],
    example: {
      prompt:
        "Mia has 9 stickers. She gets some more. Now she has 14. How many more stickers did she get? Which sentence matches: 9 + □ = 14 or 14 + 9 = □?",
      steps: [
        "Mia starts with 9 and gets more, so this is a put-together story. She ends with 14.",
        "The number she got is missing, so it is the box. Write the start, plus the box, equals the end: 9 + □ = 14.",
        "14 + 9 = □ puts 14 and 9 together. Mia never has 14 and then gets 9 more, so it does not match.",
      ],
      answer: "9 + □ = 14.",
    },
    methodTitle: "Find the action and the unknown",
    method: [
      "Put together: add with +. Take away: subtract with −, starting from the first amount.",
      "Compare means find how many more one group has than another. Subtract: the bigger number − the smaller number.",
      "Sometimes the total is known and a part is missing. Then the box is the missing part, as in 9 + □ = 14.",
      "Read the sentence back as a story to check.",
    ],
    formalTitle: "Kinds of one-step stories",
    formal: [
      "Put together: part + part = total, like 9 + 5 = 14. Take away: start − part taken = part left, like 14 − 5 = 9.",
      "Missing part: part + □ = total, like 9 + □ = 14. Missing start: □ − part taken = part left, like □ − 3 = 7.",
      "Compare: bigger − smaller = how many more, like 8 − 5 = 3.",
    ],
    pitfalls: [
      "The same numbers can tell different stories. Check where the box is.",
      "Do not add just because a story has two numbers. Ask what happens first.",
    ],
    parentGuide:
      "Tell a short story with 8 and 5, like 8 birds on a fence and 5 fly away. Ask the learner to say a number sentence for it. Then ask for a different story that uses the same sentence.",
  }),
  lesson({
    id: "story-sentence-match-1000",
    noLink: ["mean", "change"],
    title: "Match a story and a number sentence within 1,000",
    summary:
      "A story problem tells what happens to some things. A number sentence tells the same story with numbers and signs. In 320 − 145 = □, the sign − means take away. The sign = means is the same amount as. A box □ stands for a number you do not know yet. A story and a sentence match when they show the same action, with the box in the same place. Big numbers do not change that.",
    senses: {
      part: "part",
      parts: "part",
      side: "side-of-equation",
      sides: "side-of-equation",
    },
    objectives: [
      "Choose the number sentence that matches a story within 1,000.",
      "Choose the story that matches a number sentence within 1,000.",
    ],
    intuitionTitle: "Big numbers, same ideas",
    intuition: [
      "Here is a story. Ben has 320 stamps. He gives away 145. How many are left?",
      "The number sentence 320 − 145 = □ tells the same story. The − says some were taken away. The box is the number left, which we do not know yet.",
      "The numbers are big, but the questions are the same. What happens: put together, take away or compare? Which number is the box?",
    ],
    example: {
      prompt:
        "Ben has 320 stamps. He gives away 145. How many stamps does he have left? Which sentence matches: 320 − 145 = □ or 320 + 145 = □?",
      steps: [
        "Ben starts with 320 and gives away 145. Giving away is taking away, so use −.",
        "The number left is missing, so it is the box: 320 − 145 = □.",
        "320 + 145 = □ would mean Ben got 145 more stamps. That is not this story.",
      ],
      answer: "320 − 145 = □.",
    },
    methodTitle: "Find the action and the unknown",
    method: [
      "Put together: add with +. Take away: subtract with −, starting from the first amount.",
      "Compare means find how many more one group has than another. Subtract: the bigger number − the smaller number.",
      "Sometimes the total is known and a part is missing. Then the box is the missing part, as in 267 + □ = 736.",
      "Read the sentence back as a story to check.",
    ],
    formalTitle: "Kinds of one-step stories",
    formal: [
      "Put together: part + part = total, like 267 + 469 = 736. Take away: start − part taken = part left, like 320 − 145 = 175.",
      "Missing part: part + □ = total, like 267 + □ = 736. Missing start: □ − part taken = part left, like □ − 145 = 175.",
      "Compare: bigger − smaller = how many more, like 400 − 250 = 150.",
    ],
    pitfalls: [
      "A big number does not mean subtract. Decide by what happens in the story.",
      "Check where the box is. It can be the total, a part or the number left.",
    ],
    parentGuide:
      "Make up a story with two three-digit numbers, such as 250 and 400. Ask the learner for a number sentence that matches, and where the box goes.",
  }),
  lesson({
    id: "open-number-line-to-120",
    title: "Open number lines to 120",
    summary:
      "A number line is a row of numbers in order, with equal spaces between them. Tick marks are the short marks where the numbers sit. Only a few ticks are labeled, which means their number is written. Moving one tick to the right adds the same amount each time, called the step. Find the step. Then start at a labeled tick and count the jumps, the moves from one tick to the next.",
    senses: { jump: "jump", jumps: "jump" },
    objectives: [
      "Read the number at a marked point on a number line labeled at three numbers.",
      "Find the point at a given number.",
    ],
    intuitionTitle: "Equal steps between the labels",
    intuition: [
      "The tick marks are evenly spaced. So each jump from one tick to the next adds the same amount. That amount is the step.",
      "Say 0 and 50 are labeled, with 5 jumps between them. The 5 equal jumps must add up to 50. Count by 10 five times: 10, 20, 30, 40, 50. That lands on 50, so each step is 10.",
      "A point is a dot that marks one spot, named with a letter such as $P$. Moving right adds one step for each jump. Moving left takes one step away for each jump. This way you can find the number at any tick.",
    ],
    example: {
      prompt:
        "A number line goes from 0 to 100 with a tick for every 10. Only 0, 50 and 100 are labeled. What number is at point $P$, 3 ticks to the right of 50?",
      steps: [
        "Count the jumps from 0 to 50: there are 5. Counting by 10 five times goes 10, 20, 30, 40, 50, so each step is 10.",
        "$P$ is 3 jumps to the right of 50. Moving right adds, so count up by 10 three times: 60, 70, 80.",
        "We can write it as 50 + 10 + 10 + 10 = 80.",
      ],
      answer: "80.",
    },
    methodTitle: "Find the step size first",
    method: [
      "Pick two labels next to each other. Count the jumps between their ticks.",
      "Find the step. Try a step such as 1, 2, 5 or 10, and count by it that many times from the first label. If you land exactly on the next label, that is the step.",
      "Start at the label nearest the point. Count up by the step for each jump to the right. Count back by the step for each jump to the left.",
      "To place a number, count by the step from a label until you reach that number. The point there is the answer.",
    ],
    formalTitle: "Equal spacing",
    formal: [
      "On a number line, equal spaces stand for equal steps between the numbers. Say two labels are some jumps apart. Each jump to the right adds the same step. So adding the step once for each jump takes you from the smaller label to the larger one.",
    ],
    pitfalls: [
      "Count the jumps between ticks, not the ticks themselves.",
      "Work out the step from the labels. It is not always 1 or 10.",
    ],
    parentGuide:
      "Draw a line from 0 to 100 and label 0, 50 and 100. Ask the learner to find where 30 and 70 go.",
  }),
  lesson({
    id: "open-number-line-to-1000",
    noLink: ["lines"],
    title: "Open number lines to 1,000",
    summary:
      "A number line is a line with numbers in order. Bigger numbers are to the right. Tick marks are the short lines where the numbers sit. They are the same distance apart. Only three ticks are labeled, which means their number is written. The step is how much each tick adds to the one before it. Find the step. Then count from a labeled tick to the point.",
    senses: { jump: "jump", jumps: "jump", "more than": "more-than" },
    objectives: [
      "Read the number at a marked point on a number line labeled at three numbers.",
      "Find the point at a given number.",
    ],
    intuitionTitle: "Equal steps between the labels",
    intuition: [
      "Look at a line from 0 to 500 with 10 equal jumps. A jump is a move from one tick to the next. Only 0, 250 and 500 are labeled.",
      "From 0 to 250 there are 5 jumps. Try counting by 50 five times: 50, 100, 150, 200, 250. You land on 250, so each step is 50.",
      "Now every tick has a number, even without a label. Moving right adds one step for each jump. Moving left takes one step away for each jump.",
    ],
    example: {
      prompt:
        "A number line goes from 0 to 500 with 10 equal jumps. Only 0, 250 and 500 are labeled. What number is at point $P$, 3 ticks to the right of 250?",
      steps: [
        "From 0 to 250 there are 5 jumps. Count by 50 five times: 50, 100, 150, 200, 250. That lands on 250, so each step is 50.",
        "$P$ is 3 jumps to the right of 250. Moving right adds, so count up by 50 three times: 300, 350, 400.",
        "As a number sentence: 250 + 50 + 50 + 50 = 400.",
      ],
      answer: "400.",
    },
    methodTitle: "Find the step first",
    method: [
      "Pick two labels next to each other. Count the jumps between their ticks.",
      "Find the step. Try a step such as 10, 25, 50 or 100. Count by it once for each jump from the first label. If you land exactly on the next label, that is the step.",
      "Start at the label nearest the point. Count up by the step for each jump to the right. Count back by the step for each jump to the left.",
      "To place a number, count by the step from a label until you reach that number. Its tick is the answer.",
    ],
    formalTitle: "Equal spacing",
    formal: [
      "Equal spaces on a number line stand for equal steps. If two labels are 5 jumps apart, the 5 equal steps add up to the gap between them.",
      "From 500 to 750 is 250 more. Since 50 + 50 + 50 + 50 + 50 = 250, each step is 50.",
    ],
    pitfalls: [
      "Count the jumps between ticks, not the ticks themselves.",
      "Work out the step from the labels. On a line from 0 to 500 with 10 jumps, the step is 50, not 10.",
    ],
    parentGuide:
      "Draw a line from 0 to 1,000 with a tick every 100. Label only 0, 500 and 1,000. Ask the learner to say the step, then find where 300 and 800 go.",
  }),
  lesson({
    id: "eighths-and-parts-beyond-one",
    title: "Eighths and parts past one whole",
    summary:
      "A whole is one full thing, like one bar or one pizza. Equal parts are parts that are all the same size. Cut a whole into 8 equal parts, and each part is one eighth. 8 eighths fill the whole. More than 8 eighths is more than one whole.",
    senses: {
      whole: "whole",
      eighth: "eighth",
      eighths: "eighth",
      third: "third",
      thirds: "third",
      fourth: "fourth",
      fourths: "fourth",
      "more than": "more-than",
      part: "part",
      parts: "part",
    },
    objectives: [
      "Name the shaded eighths of a bar.",
      "Say how many equal parts make one whole.",
      "Describe shaded parts that go past one whole.",
    ],
    intuitionTitle: "Equal parts of a whole",
    intuition: [
      "Look at one bar cut into 8 equal parts. Each part is one eighth. The name comes from how many equal parts fill the whole.",
      "Shade, or color in, the parts one at a time: 1 eighth, 2 eighths, and so on. At 8 eighths, the whole bar is shaded.",
      "Keep going into a second bar. Now you have shaded 1 whole and some more.",
    ],
    example: {
      prompt:
        "Two bars are each cut into 8 equal parts. The first bar is all shaded and 3 parts of the second bar are shaded. How much is shaded?",
      steps: [
        "Each bar has 8 equal parts, so each part is one eighth.",
        "The first bar is all shaded. 8 eighths fill one whole, so that is 1 whole.",
        "The second bar has 3 parts shaded. That is 3 eighths.",
        "Together that is 1 whole and 3 eighths. Counting every shaded part gives 8 + 3 = 11 eighths.",
      ],
      answer: "1 whole and 3 eighths.",
    },
    methodTitle: "Name the parts, then count the shaded ones",
    method: [
      "Count the equal parts in one whole. If there are 8, the parts are eighths.",
      "Count only the shaded parts. Say the number, then the name: 5 eighths.",
      "When a whole bar is full, call it 1 whole. Then count the shaded parts that are left over.",
    ],
    formalTitle: "Parts of a whole",
    formal: [
      "When a whole is cut into 8 equal parts, each part is one eighth, and 8 of them make 1 whole.",
      "Other wholes work the same way: 4 fourths make 1 whole, and 3 thirds make 1 whole. More parts than that make more than 1 whole.",
    ],
    pitfalls: [
      "Count the equal parts in one whole to name the parts. Do not count the shaded parts for the name.",
      "After one full whole, count only the shaded parts in the next bar.",
    ],
    parentGuide:
      "Fold a paper strip in half, then in half again, then once more. Open it and count the 8 equal parts. Ask how many eighths make the whole strip.",
  }),
  lesson({
    id: "decompose-flat-shape",
    noLink: ["lines", "line"],
    title: "Cut a shape into parts",
    summary:
      "To decompose a shape means to cut it into smaller shapes. Count the parts the cut makes. Then pick one part. Count its sides, the straight lines around it, to name its shape.",
    senses: {
      side: "side",
      sides: "side",
      square: "square-shape",
      part: "part",
      parts: "part",
    },
    objectives: [
      "Say how many parts a square or rectangle is cut into.",
      "Name the shape of the parts.",
    ],
    intuitionTitle: "Cutting a shape",
    intuition: [
      "Take a square piece of paper. Fold it and cut along the fold. Now you have 2 smaller shapes. Put them back together, and they make the square again.",
      "A corner is where two sides meet. A square corner looks like the corner of a page. A cut from one corner to the far corner is called a diagonal.",
      "To name a part, count its sides and corners. 3 sides and 3 corners make a triangle.",
    ],
    example: {
      prompt: "A rectangle is cut along a diagonal. What are the new shapes?",
      steps: [
        "One cut splits the rectangle into 2 parts.",
        "Count the sides of one part. It has 3 sides and 3 corners.",
        "A shape with 3 sides is a triangle. Both parts are triangles.",
      ],
      answer: "2 triangles.",
    },
    methodTitle: "Count, then name",
    method: [
      "Count the parts the cuts make.",
      "Pick one part. 3 sides: triangle. 4 square corners and 4 sides the same length: square. 4 square corners, 2 long sides and 2 short sides: a rectangle that is not a square.",
      "Check that all the parts have the same shape. Then say the number and the name together, like 4 squares. If the shapes differ, name each kind.",
    ],
    formalTitle: "Cutting squares and rectangles",
    formal: [
      "A diagonal cut of a rectangle makes 2 triangles. Cutting a square along both diagonals makes 4 triangles.",
      "Cutting a rectangle into equal strips makes smaller rectangles. Cut a square with one line straight across the middle and one line straight down the middle. That makes 4 small squares.",
    ],
    pitfalls: [
      "A cut from one corner of a square or rectangle to the far corner makes triangles, not rectangles.",
      "Check the sides. Two equal strips of a square are rectangles that are not squares.",
    ],
    parentGuide:
      "Cut a square sheet of paper along one diagonal. Ask what shapes you have. Then cut one of them in two again and ask again.",
  }),
  lesson({
    id: "unit-size-and-count",
    noLink: ["change", "changes"],
    title: "Bigger units, fewer copies",
    summary:
      "A unit is the thing you measure with, like a paper clip. To measure a length, lay copies of the unit end to end, with no gaps. Count the copies. A longer unit covers more each time, so you need fewer copies of it.",
    senses: { unit: "unit", units: "unit" },
    objectives: [
      "Tell which of two units needs fewer copies to cover the same length.",
      "Find how many long units cover a length given in small units.",
    ],
    intuitionTitle: "The same ribbon, two units",
    intuition: [
      "Measure a ribbon with paper clips. Then measure it again with pencils.",
      "A pencil is longer than a paper clip, so each pencil covers more ribbon. You need fewer pencils than paper clips.",
      "The ribbon did not change. Only the unit changed, and the count changed with it.",
    ],
    example: {
      prompt:
        "A ribbon is 12 small units long. One long unit is as long as 3 small units. How many long units cover the ribbon?",
      steps: [
        "One long unit is as long as 3 small units, so each long unit covers 3 small units.",
        "Count by 3s up to 12: 3, 6, 9, 12. You counted 4 times, so 4 groups of 3 make 12.",
        "So 4 long units cover the ribbon. 4 is fewer than 12, because the long unit is longer.",
      ],
      answer: "4 long units.",
    },
    methodTitle: "Compare the size of one unit",
    method: [
      "Look at one copy of each unit. Which is longer?",
      "The longer unit needs fewer copies. The shorter unit needs more copies.",
      "To count long units, find how many small units one long unit covers. Count by that number up to the length. The number of counts is the number of long units.",
    ],
    formalTitle: "Unit size and count",
    formal: [
      "For the same length, the count depends on the unit. A longer unit gives a smaller count. A shorter unit gives a bigger count.",
      "The copies must touch end to end. There can be no gaps and no overlaps, where one copy lies on top of another.",
    ],
    pitfalls: [
      "A bigger count means a shorter unit, not a longer ribbon.",
      "Lay units end to end, with no gaps and no overlaps.",
    ],
    parentGuide:
      "Measure a table with a pencil and then with a crayon. Ask which one needed more copies, and why.",
  }),
  lesson({
    id: "benchmark-length-estimate",
    senses: { unit: "unit" },
    title: "Estimate with a benchmark",
    summary:
      "A benchmark is a length you know well, like a ruler that is 12 inches long. To estimate means to find a number close to the real length. Repeat the benchmark to estimate a longer length. Then check that the answer makes sense.",
    objectives: [
      "Estimate a length by repeating a benchmark.",
      "Choose a reasonable estimate for a familiar object.",
    ],
    intuitionTitle: "Use a length you know",
    intuition: [
      "You know a ruler is 12 inches long. You know a crayon is about 4 inches long. These lengths are benchmarks.",
      "Picture crayons laid end to end along a shelf. If it takes about 5 crayons, the shelf is about 5 crayon lengths long.",
      "Add the crayon length 5 times to find about how many inches. The answer is an estimate: close, but it may not be exact.",
    ],
    example: {
      prompt:
        "A crayon is about 4 inches long. A shelf is about 5 crayons long. About how long is the shelf?",
      steps: [
        "Each crayon is about 4 inches long.",
        "The shelf is about 5 crayons long, so add 4 five times: 4 + 4 + 4 + 4 + 4 = 20.",
        "The shelf is about 20 inches long. Say “about,” because this is an estimate.",
      ],
      answer: "About 20 inches.",
    },
    methodTitle: "Repeat and check",
    method: [
      "Find the benchmark length. Count how many benchmarks fit along the object.",
      "Add the benchmark length that many times.",
      "Check the unit and the size. Does the answer fit what you know about the object?",
    ],
    formalTitle: "Estimating with benchmarks",
    formal: [
      "An estimate made with a benchmark should be close to the real length, but it may not be exact.",
      "Say each benchmark is 4 inches, and an object is about 5 benchmarks long. Then the object is about 4 + 4 + 4 + 4 + 4 = 20 inches long.",
    ],
    pitfalls: [
      "Repeat the benchmark length. Do not add the number of benchmarks to it: 4 + 5 = 9 is not the length.",
      "Check the unit. A pencil is about 7 inches, not 7 feet.",
    ],
    parentGuide:
      "Find a benchmark at home, such as a paper clip about 1 inch long. Ask the learner to estimate a book's length with it, then check with a ruler.",
  }),
  lesson({
    id: "clock-minute-match",
    title: "Clocks to the minute",
    summary:
      "An analog clock has two hands. The short hand is the hour hand. It shows the hour. The long hand is the minute hand. It shows the minutes after the hour. Count by fives for each number it passes, then by ones for each small tick. A digital time, like 4:37, shows the hour, a colon, then two digits for the minutes.",
    noLink: ["face"],
    objectives: [
      "Read an analog clock to the minute.",
      "Match an analog clock with a digital time.",
    ],
    intuitionTitle: "Two hands, hours and minutes",
    intuition: [
      "Look at a clock face. The numbers 1 to 12 go around it. Between each pair of numbers are 4 small tick marks.",
      "The short hand moves slowly, from one number to the next in one hour. If it points right at a number, that number is the hour. Between two numbers, the hour is the number it has just passed.",
      "The long hand moves faster. Start at the 12. Each number it reaches adds 5 minutes: 5, 10, 15, and so on. Each small tick mark adds 1 minute.",
    ],
    example: {
      prompt:
        "The short hand is between 4 and 5. The long hand is 2 tick marks past the 7. What time is it?",
      steps: [
        "The short hand is between 4 and 5, so it has passed 4 but not 5. The hour is 4.",
        "Count by fives from the 12 to the 7: 5, 10, 15, 20, 25, 30, 35. That is 35 minutes.",
        "The long hand is 2 tick marks past the 7, so count on 2 more: 36, 37. That is 37 minutes.",
        "Write the hour, a colon, then the two digits for the minutes: 4:37.",
      ],
      answer: "4:37.",
    },
    methodTitle: "Hour first, then minutes",
    method: [
      "Read the hour from the short hand: the last number it has passed.",
      "Count by fives from the 12 to the last number the long hand passed. Then count on by ones for the small tick marks.",
      "Write the digital time. If the minutes are less than 10, write a 0 first, as in 4:07.",
    ],
    formalTitle: "Reading a clock",
    formal: [
      "There are 60 minutes in one hour. The minute hand moves 1 minute for each small tick mark, and 5 minutes from one number to the next.",
      "The hour hand moves slowly from one number to the next while the minute hand goes all the way around.",
    ],
    pitfalls: [
      "Do not swap the hands. The short hand shows the hour.",
      "Write a 0 before a single minute digit: 4:07, not 4:7.",
    ],
    parentGuide:
      "Set a clock to 3:48. Ask the learner to say the hour and the minutes, and to write the digital time.",
  }),
  lesson({
    id: "tally-and-t-chart",
    noLink: ["part", "line", "lines"],
    title: "Tally charts and T-charts",
    summary:
      "A tally mark is a line you draw for each thing you count. Every fifth mark crosses the other four to make a group of 5. A tally chart shows the marks for each choice. The T-chart is a chart with two columns. One names each choice, and one shows how many chose it.",
    senses: { difference: "difference-subtract" },
    objectives: [
      "Read a tally chart to find a count, a difference or a total.",
      "Choose the T-chart that matches a list of answers.",
    ],
    intuitionTitle: "Counting with marks",
    intuition: [
      "Ask friends to name their favorite pet. Each time someone says cat, draw one line next to cat. That line is a tally mark.",
      "When you reach 5, draw the fifth line across the first four. Now you can count by fives: 5, 10, 15.",
      "Every T-chart has one line across the top and one line down the middle. The middle line makes two columns, lists that go down. The left column names each choice. The right column shows its count.",
    ],
    example: {
      prompt:
        "In a tally chart, cats have one group of five and 3 more lines. Dogs have 4 lines. How many more children chose cats than dogs?",
      steps: [
        "Cats: one group of five is 5. Count on 3 more lines: 6, 7, 8. So 8 children chose cats.",
        "Dogs: 4 lines, so 4 children chose dogs.",
        "How many more means find the difference. Subtract the smaller count from the bigger one: 8 − 4 = 4.",
      ],
      answer: "4 more children chose cats.",
    },
    methodTitle: "Count by fives",
    method: [
      "Count each group of five as 5. Then count on the lines left over.",
      "To find how many more, subtract the smaller count from the bigger one. For a total, add all the counts.",
      "To make a T-chart from a list, go through the list once. Make one mark for each answer, and cross it out as you count it.",
    ],
    formalTitle: "Organizing data",
    formal: [
      "Data are the answers you collect, like each child's favorite pet. A tally chart and a T-chart can show the same data.",
      "The total is all the counts added together. The difference of two counts tells how many more one choice has than the other.",
    ],
    pitfalls: [
      "The line across four lines is part of the five. Do not count it as a sixth.",
      "Count each answer in a list only once.",
    ],
    parentGuide:
      "Ask the family to pick a favorite fruit. Make a tally chart together. Ask which fruit has the most, and how many more it has than another.",
  }),
  lesson({
    id: "early-money-decisions",
    noLink: ["part", "parts"],
    title: "Income, saving and making things",
    summary:
      "Income is money you earn by doing work. To save is to keep money for later. A bank account keeps money at a bank. A deposit puts money in, and a withdrawal takes money out. A producer makes things to sell. To find what an item costs to make, add up what its parts cost.",
    senses: { balance: "balance-account" },
    objectives: [
      "Tell income from a gift, spending from saving, and a deposit from a withdrawal.",
      "Find savings over time, a balance after a deposit and a withdrawal, and the cost to make an item.",
      "Tell a producer from a consumer.",
    ],
    intuitionTitle: "Where money comes from and where it goes",
    intuition: [
      "Money you earn by doing work is income. A gift is money someone gives you without work, such as birthday money. A gift is not income.",
      "To spend is to use money to buy something now. To save is to keep money to use later.",
      "A bank account keeps saved money. The balance is how much money is in it. A deposit puts money in, so the balance goes up. A withdrawal takes money out, so the balance goes down.",
      "A producer makes things to sell, like a baker who makes bread. A consumer buys and uses them, like you when you buy the bread.",
    ],
    example: {
      prompt:
        "Ben already has $10 saved. He saves $4 each week. How much does he have after 5 weeks?",
      steps: [
        "Each week adds 4 dollars. In 5 weeks Ben adds 4 + 4 + 4 + 4 + 4 = 20 dollars.",
        "He already had 10 dollars, so add it: 10 + 20 = 30 dollars.",
      ],
      answer: "$30.",
    },
    methodTitle: "Match the idea, then work it out",
    method: [
      "Ask what the question is about. Is it pay for work or a gift? Buying or keeping? Putting money in or taking it out? Making or buying?",
      "For savings, add what is saved each week, once for every week. Then add any money saved before.",
      "For the cost to make an item, find the cost of each kind of part. The sign × means times: $3 \\times 4$¢ is 3 groups of 4¢, which is 12¢. Then add the costs of all the parts.",
    ],
    formalTitle: "Money words and amounts",
    formal: [
      "Income is money earned by doing work. A deposit adds to the balance of an account, and a withdrawal takes money away from it.",
      "If you save the same amount each week, your savings grow by that amount each week. Say you start with 10 dollars and save 4 dollars a week. After 5 weeks you have 10 + 4 + 4 + 4 + 4 + 4 = 30 dollars.",
    ],
    pitfalls: [
      "A present is a gift, not income, because nobody worked for it.",
      "Add a deposit and subtract a withdrawal. Do not mix them up.",
      "Count how many of each part the item needs before you add the costs.",
    ],
    parentGuide:
      "Ask the learner to name one way to earn money and one gift they received. Then ask how much they would have if they saved 2 dollars each week for 6 weeks.",
  }),
];
