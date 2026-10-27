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
};

const lesson = (s: Spec): Lesson => ({
  id: s.id,
  title: s.title,
  summary: s.summary,
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
      "Every United States coin has a name and a value. The value is how many cents the coin is worth. The cent symbol ¢ goes after the number: 5¢ means five cents.",
    terms: [
      [
        "cent",
        "The smallest unit of United States money. One cent is written 1¢.",
      ],
      [
        "cent symbol",
        "The mark ¢, written right after a number to show cents, as in 10¢.",
      ],
    ],
    method: [
      "Read the number of cents on the coin, or in the question.",
      "Match the value to the name: 1¢ is a penny, 5¢ is a nickel, 10¢ is a dime and 25¢ is a quarter.",
      "To write a value, write the number and put ¢ right after it.",
    ],
    watch:
      "A dime is worth more than a nickel even though it is smaller. Match a coin by its value, not its size. Write ¢ after the number, not before it.",
  },
  "solid-bottom-face-shape": {
    goal: "Given a solid standing on a table, name the flat shape of the face that touches the table.",
    intuition:
      "A solid is a shape you can hold, such as a box, a can or a ball. A face is a flat side of a solid. When a solid stands on a face, that face touches the table and is the bottom face.",
    terms: [
      ["face", "A flat side of a solid."],
      ["corner", "A point where two sides of a flat shape meet."],
    ],
    method: [
      "Look at the face on the table. If it is round with no corners, it is a circle.",
      "If it has straight sides, count them. Three sides make a triangle.",
      "Four sides: if all four sides are equal, it is a square. If two sides are longer than the other two, it is a rectangle.",
    ],
    watch:
      "A square and a rectangle both have 4 corners. Check whether all 4 sides are equal before you choose.",
  },
  "measurable-attribute-choice": {
    goal: "Given a question or a goal about an object, name the attribute (length, capacity or weight) that should be measured.",
    intuition:
      "An attribute is something about an object that you can measure with a unit. How long, how tall and how wide are about length. How much a container can hold is capacity. How heavy something is tells its weight.",
    terms: [
      ["length", "How long, how tall or how wide something is."],
      ["capacity", "How much a container can hold."],
      ["weight", "How heavy something is."],
    ],
    method: [
      "Find the key words in the question: long, tall or wide; hold; heavy.",
      "Match the key words to the attribute: length, capacity or weight.",
      "Color is not measured with a unit, so it is never the attribute to measure.",
    ],
    watch:
      "A big container can still be light, and a heavy object can be short. Choose the attribute the question asks about, not the one that sounds biggest.",
  },
  "dot-group-compared-to-number": {
    goal: "Given groups of up to 20 dots, find the group that has more than, fewer than or the same number as a given number or group.",
    intuition:
      "To compare a group with a number, count the group, then ask: is my count more than, fewer than or the same as that number? More means a greater number. Fewer means a lesser number.",
    terms: [
      ["more than", "A greater number. 9 is more than 7."],
      ["fewer than", "A lesser number. 5 is fewer than 7."],
      ["the same as", "Equal. 7 is the same as 7."],
    ],
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
      "A number sentence tells a story with numbers. In these problems a box □ stands for the number we want to find. To match a story with a sentence, ask what happens in the story, and which number is not known.",
    terms: [
      [
        "number sentence",
        "Numbers and signs that say something is equal, such as 8 + 5 = 13.",
      ],
      ["box □", "A box that stands for the number we do not know yet."],
    ],
    method: [
      "Decide what happens: things are put together, some are taken away, or two groups are compared.",
      "Find the number the story asks about. That number is the box.",
      "Put together: add. Take away or compare: subtract. When the total is known and a part is missing, the box is the missing part.",
      "Read the sentence back as a story to check that it says the same thing.",
    ],
    watch:
      "The same numbers can make different stories. Check where the box is: it can stand for the total, a part that was added or the number left.",
  },
  "story-sentence-match-1000": {
    goal: "Match an addition or subtraction story within 1,000 to the number sentence that tells it, and a number sentence to its story.",
    intuition:
      "A number sentence tells a story with numbers, and the numbers can be as large as 1,000. A box □ stands for the number we want to find. The match depends on what happens in the story and which number is not known, not on how big the numbers are.",
    terms: [
      [
        "number sentence",
        "Numbers and signs that say something is equal, such as 267 + 469 = 736.",
      ],
      ["box □", "A box that stands for the number we do not know yet."],
    ],
    method: [
      "Decide what happens: things are put together, some are taken away, or two groups are compared.",
      "Find the number the story asks about. That number is the box.",
      "Put together: add. Take away or compare: subtract. When the total is known and a part is missing, the box is the missing part.",
      "Read the sentence back as a story to check that it says the same thing.",
    ],
    watch:
      "Large numbers do not change which operation tells the story. Do not subtract just because a number is large. Check where the box is.",
  },
  "open-number-line-to-120": {
    goal: "On a number line with only three labels, find the point at a given number or read the number at a marked point, up to 120.",
    intuition:
      "A number line has tick marks that are the same distance apart. Often only a few ticks have numbers. You can still find every other number, because each tick adds the same amount to the one before it.",
    terms: [
      [
        "tick mark",
        "A short line on a number line that stands for one number.",
      ],
      ["step", "How much each tick mark adds to the one before it."],
    ],
    method: [
      "Pick two labeled numbers next to each other. Count the steps between their ticks.",
      "Find the size of one step: the difference of the labels divided by the number of steps.",
      "Start at the labeled number nearest the point. Count steps and add the step size each time, or subtract if you go left.",
    ],
    watch:
      "Do not count the labeled tick as a step. Count the jumps between ticks, and use the step size shown by the labels.",
  },
  "open-number-line-to-1000": {
    goal: "On a number line with only three labels, find the point at a given number or read the number at a marked point, up to 1,000.",
    intuition:
      "A number line has tick marks that are the same distance apart. Often only three ticks have numbers. You can still find every other number, because each tick adds the same amount to the one before it.",
    terms: [
      [
        "tick mark",
        "A short line on a number line that stands for one number.",
      ],
      ["step", "How much each tick mark adds to the one before it."],
    ],
    method: [
      "Pick two labeled numbers next to each other. Count the steps between their ticks.",
      "Find the size of one step: the difference of the labels divided by the number of steps.",
      "Start at the labeled number nearest the point. Count steps and add the step size each time, or subtract if you go left.",
    ],
    watch:
      "The step is not always 1 or 10. A line from 0 to 500 with 10 ticks has steps of 50. Work out the step from the labels first.",
  },
  "eighths-and-parts-beyond-one": {
    goal: "Name shaded eighths, find how many equal parts make one whole, and describe shaded parts that go past one whole.",
    intuition:
      "A whole can be cut into equal parts. When there are 8 equal parts, each part is one eighth. Eight eighths fill one whole. If more than 8 eighths are shaded, you have shaded one whole and some more.",
    terms: [
      ["equal parts", "Parts that are the same size."],
      ["eighth", "One of 8 equal parts of a whole."],
      ["whole", "All of one bar, shape or object."],
    ],
    method: [
      "Count all the equal parts in one whole. That number gives the name: 2 halves, 3 thirds, 4 fourths, 8 eighths.",
      "Count the shaded parts. Say the number and the name: 3 eighths.",
      "When the shaded parts fill one whole bar, call that 1 whole. Count the shaded parts left over after it.",
    ],
    watch:
      "Name the parts by how many equal parts fill the whole, not by how many are shaded. Count only shaded parts for the amount.",
  },
  "decompose-flat-shape": {
    goal: "Given a square or rectangle cut into equal parts, say how many parts there are and name the shape of the parts.",
    intuition:
      "To decompose a shape means to cut it into smaller shapes. Count the parts the cuts make. Then name one part by counting its sides and corners.",
    terms: [
      ["decompose", "To break a shape into smaller shapes."],
      [
        "diagonal",
        "A straight line from one corner of a shape to the opposite corner.",
      ],
    ],
    method: [
      "Count the parts the cuts make.",
      "Pick one part and count its sides. Three sides: triangle. Four sides with all sides equal: square. Four sides with two longer sides: rectangle.",
      "Check that all the parts are the same shape and size. Say the number and the name: 2 triangles.",
    ],
    watch:
      "Cutting a rectangle from corner to corner makes triangles, not rectangles. A square cut into 2 equal strips makes 2 rectangles that are not squares.",
  },
  "unit-size-and-count": {
    goal: "Measure the same length with a shorter and a longer unit, and tell which needs fewer copies and why.",
    intuition:
      "To measure a length, you cover it with copies of a unit, end to end, with no gaps. A longer unit covers more each time, so you need fewer copies. A shorter unit covers less each time, so you need more copies.",
    terms: [
      ["unit", "A length used to measure, such as a paper clip or a block."],
      ["copies", "How many times the unit is laid end to end."],
    ],
    method: [
      "Compare the size of one unit in each row. Which is longer?",
      "The longer unit needs fewer copies. The shorter unit needs more copies.",
      "To find the number of long units, ask how many small units one long unit covers. Share the small units into groups of that size.",
    ],
    watch:
      "The ribbon is the same length each time. Only the size of the unit changes the count. A bigger count means a shorter unit.",
  },
  "benchmark-length-estimate": {
    goal: "Estimate a length by repeating a benchmark length, and choose the reasonable estimate for a familiar object.",
    intuition:
      "A benchmark is a length you know well, such as a ruler that is 12 inches long. To estimate, compare a new length with the benchmark. If something is about 3 benchmarks long, repeat the benchmark length 3 times.",
    terms: [
      ["benchmark", "A length you know, used to estimate other lengths."],
      ["estimate", "A careful guess that is close to the real amount."],
    ],
    method: [
      "Find the benchmark length in the problem or think of one you know.",
      "To estimate a length that is a number of benchmarks long, add the benchmark length that many times, or multiply.",
      "Check the answer: is it close to what you know about the real object?",
    ],
    watch:
      "Check the unit as well as the number. A pencil is about 7 inches, not 7 feet. An estimate is close, not exact.",
  },
  "clock-minute-match": {
    goal: "Read an analog clock to the minute and match it with a digital time, or find the clock that matches a digital time.",
    intuition:
      "The short hand shows the hour. The long hand shows the minutes after the hour. Each numeral is 5 minutes, and the small tick marks between numerals are single minutes.",
    terms: [
      ["minute hand", "The long hand. It shows the minutes after the hour."],
      ["hour hand", "The short hand. It shows the hour it has passed."],
    ],
    method: [
      "Read the hour: the numeral the short hand has passed.",
      "Read the minutes: count by fives to the numeral before the long hand, then count single tick marks.",
      "Write the digital time as hour, a colon, then two digits for the minutes: 4:07.",
    ],
    watch:
      "Do not swap the hands. The short hand shows the hour and the long hand shows the minutes. Minutes below 10 need a zero in front: 4:07.",
  },
  "tally-and-t-chart": {
    goal: "Read a tally chart to find a count, a difference or a total, and choose the T-chart that organizes a list of answers.",
    intuition:
      "A tally chart records counts with marks. The T-chart has two columns, one for the name of each choice and one for its count. Tally marks come in groups of five: four lines and one line across them.",
    terms: [
      [
        "tally mark",
        "A line that stands for one count. A group of five has a line across four lines.",
      ],
      [
        "T-chart",
        "A chart with two columns and a line down the middle that lists each choice with its count.",
      ],
    ],
    method: [
      "Count each group of five as 5. Add the lines left over.",
      "To find how many more, subtract the smaller count from the greater. For a total, add all the counts.",
      "To make a T-chart from a list, go through the list one answer at a time, and make one mark for each. Cross out each answer as you count it.",
    ],
    watch:
      "The line across a group of five is part of the five. Do not count it as a sixth.",
  },
  "early-money-decisions": {
    goal: "Tell income from a gift, spending from saving and a deposit from a withdrawal, and find savings and the cost to make an item.",
    intuition:
      "Money you earn by working is income. Money someone gives you without work is a gift. You can spend money to buy something now, or save it to use later. A bank account has deposits that put money in and withdrawals that take money out.",
    terms: [
      ["income", "Money earned by working."],
      ["gift", "Something given to you without work, such as birthday money."],
      ["producer", "A person who makes goods or services to sell."],
      ["consumer", "A person who buys and uses goods or services."],
    ],
    method: [
      "Ask what the question is about: pay for work, buying or keeping, putting in or taking out, making or buying.",
      "For savings over time, find what is added each week and add it for every week. Include money already saved.",
      "For the cost to make an item, find the cost of each kind of part (number of parts times cost of one), then add them all.",
    ],
    watch:
      "A deposit raises the balance and a withdrawal lowers it. A shop owner who makes the goods is the producer. The person who buys them is the consumer.",
  },
};

export const texasK2Principles: Record<string, string> = {
  "coin-name-and-cent-value":
    "A penny is worth 1 cent (1¢), a nickel 5 cents (5¢), a dime 10 cents (10¢) and a quarter 25 cents (25¢). The cent symbol ¢ is written after the number.",
  "solid-bottom-face-shape":
    "A face of a solid is a flat surface. A cube has square faces, a box can have rectangle faces, a triangular prism has two triangle bases, a pyramid stands on its base, and a cylinder or a cone has a circle base.",
  "measurable-attribute-choice":
    "An attribute is a property of an object that can be measured with a unit. Length, capacity and weight are three such attributes, and each question about an amount asks about one of them.",
  "dot-group-compared-to-number":
    "For whole numbers, exactly one is true: $a$ is more than $b$, $a$ is fewer than $b$, or $a$ is the same as $b$. Counting each object once gives the number of a group.",
  "story-sentence-match-20":
    "A story that joins parts has the form part + part = whole. A story that takes away has the form whole − part = part. The unknown number can be in any position, and the sentence matches the story by what happens and where the unknown is.",
  "story-sentence-match-1000":
    "A story that joins parts has the form part + part = whole. A story that takes away has the form whole − part = part. The unknown number can be in any position, and the sentence matches the story by what happens and where the unknown is.",
  "open-number-line-to-120":
    "On a number line the tick marks are equally spaced. If two ticks labeled $a$ and $b$ are $n$ steps apart, each step is $(b-a)\\div n$, and the number at $k$ steps from $a$ is $a+k\\cdot\\text{step}$.",
  "open-number-line-to-1000":
    "On a number line the tick marks are equally spaced. If two ticks labeled $a$ and $b$ are $n$ steps apart, each step is $(b-a)\\div n$, and the number at $k$ steps from $a$ is $a+k\\cdot\\text{step}$.",
  "eighths-and-parts-beyond-one":
    "When a whole is cut into $n$ equal parts, each part is one $1/n$ of the whole, and $n$ of them make one whole. More than $n$ such parts make more than one whole.",
  "decompose-flat-shape":
    "A flat shape can be decomposed into smaller flat shapes with no gaps or overlaps. A diagonal cut of a rectangle makes two triangles, and equal strips of a rectangle are rectangles.",
  "unit-size-and-count":
    "For a fixed length, the number of copies of a unit is the length divided by the unit length, so a longer unit needs fewer copies and a shorter unit needs more.",
  "benchmark-length-estimate":
    "If a benchmark has length $b$ and an object is about $k$ benchmarks long, its length is about $k\\cdot b$. An estimate is close to the true length but not exact.",
  "clock-minute-match":
    "The hour hand shows the hour it has passed. The minute hand shows minutes: each numeral is 5 minutes, and each small tick mark is 1 minute. A digital time is written hour:minutes with two minute digits.",
  "tally-and-t-chart":
    "A group of five tally marks counts 5. The total of a chart is the sum of its counts, and the difference of two counts is found by subtracting the smaller from the greater.",
  "early-money-decisions":
    "Income is money earned by work. A deposit adds to an account balance and a withdrawal subtracts from it. Savings after $w$ weeks of saving $a$ each week, starting from $s$, are $s+w\\cdot a$.",
};

export const texasK2Lessons: Lesson[] = [
  lesson({
    id: "coin-name-and-cent-value",
    title: "Name coins and write cents",
    summary:
      "Each coin has a name and a value in cents. Match the value to the name, and write ¢ after the number.",
    objectives: [
      "Name a penny, a nickel, a dime and a quarter from the value on the coin.",
      "Write the value of a coin with the cent symbol.",
    ],
    intuitionTitle: "A name and a value",
    intuition: [
      "Money is used to buy things. Each United States coin has a name and a value. The value is how many cents the coin is worth. The cent symbol is ¢ and goes after the number, so 5¢ means five cents.",
      "Four coins are used most: the penny is worth 1¢, the nickel 5¢, the dime 10¢ and the quarter 25¢.",
    ],
    example: {
      prompt:
        "A coin shows 10¢. What is its name, and how do you write its value?",
      steps: [
        "Read the value on the coin: it is 10 cents.",
        "The coin worth 10¢ is a dime.",
        "Write the number, then ¢ after it: 10¢.",
      ],
      answer: "A dime, written 10¢.",
    },
    methodTitle: "Match by value",
    method: [
      "Read the number of cents on the coin. Find that value in the list: 1¢ penny, 5¢ nickel, 10¢ dime, 25¢ quarter.",
      "A coin's size does not tell its value. A dime is smaller than a nickel but worth more.",
    ],
    formalTitle: "The four coins",
    formal: [
      "A penny is 1 cent, written 1¢. A nickel is 5 cents, written 5¢. A dime is 10 cents, written 10¢. A quarter is 25 cents, written 25¢. The cent symbol is written after the number.",
    ],
    pitfalls: [
      "Match a coin by its value, not by its size.",
      "Write ¢ after the number: 5¢, not ¢5.",
      "Do not use a dollar sign for cents. $5 means five dollars.",
    ],
    parentGuide:
      "Show a nickel and a dime. Ask the learner to name each and write its value with the cent symbol.",
  }),
  lesson({
    id: "solid-bottom-face-shape",
    title: "The shape of a solid's bottom face",
    summary:
      "A solid stands on one flat face. Count its sides and corners, or see that it is round, to name the face.",
    objectives: [
      "Name the flat face a solid stands on.",
      "Tell a square from a rectangle by its sides.",
    ],
    intuitionTitle: "A solid has flat faces",
    intuition: [
      "A solid is a shape you can hold, such as a box, a can or a ball. A face is a flat side of a solid. A solid can stand on one of its faces, and that face touches the table.",
      "The face on the table is a flat shape. It can be a circle, a triangle, a square or a rectangle.",
    ],
    example: {
      prompt:
        "A can of soup stands on a table. What is the shape of the face on the table?",
      steps: [
        "Look at the bottom of the can. It is round, with no corners and no straight sides.",
        "A flat round shape is a circle.",
      ],
      answer: "A circle.",
    },
    methodTitle: "Look, then count",
    method: [
      "First see if the face is round. If it is, it is a circle.",
      "If it has straight sides, count them. Three sides make a triangle. Four sides make a square or a rectangle.",
      "A square has 4 equal sides. A rectangle has 4 sides with two longer than the other two.",
    ],
    formalTitle: "Faces of common solids",
    formal: [
      "A cube has square faces. A box has rectangle faces. A triangular prism has two triangle faces for its ends. A square pyramid stands on a square face and a triangular pyramid stands on a triangle face. A cylinder and a cone stand on circle faces.",
    ],
    pitfalls: [
      "Do not choose the shape of a side face when the question asks about the bottom face.",
      "Check that all 4 sides are equal before you call a face a square.",
    ],
    parentGuide:
      "Hold a tissue box and a can. Ask the learner to name the shape of the face each one stands on.",
  }),
  lesson({
    id: "measurable-attribute-choice",
    title: "What can you measure?",
    summary:
      "Length, capacity and weight are three attributes you can measure. Key words in a question tell which one to measure.",
    objectives: [
      "Name the attribute a question asks about.",
      "Choose the attribute to measure to reach a goal.",
    ],
    intuitionTitle: "Three things to measure",
    intuition: [
      "An attribute is something about an object that you can measure with a unit. A pencil has a length. A jug has a capacity, which is how much it can hold. A backpack has a weight, which is how heavy it is.",
      "Color is also about an object, but it is not measured with a unit.",
    ],
    example: {
      prompt:
        "How much water does the bucket hold? Which attribute do you measure?",
      steps: [
        "Find the key words: 'how much' and 'hold'.",
        "How much a container can hold is its capacity.",
      ],
      answer: "Capacity.",
    },
    methodTitle: "Match the key words",
    method: [
      "How long, how tall or how wide: length. How heavy: weight. How much it can hold: capacity.",
      "To reach a goal, ask what you need to know about the object, then pick that attribute.",
    ],
    formalTitle: "Attributes and units",
    formal: [
      "Length is measured in units such as inches or centimeters. Capacity is measured in units such as cups or liters. Weight is measured in units such as pounds or ounces.",
    ],
    pitfalls: [
      "Choose the attribute the question asks about, not the one that sounds biggest.",
      "A tall object can be light, and a small object can be heavy.",
    ],
    parentGuide:
      "Hold a water bottle. Ask: how could we measure how long it is, how heavy it is, and how much it holds?",
  }),
  lesson({
    id: "dot-group-compared-to-number",
    title: "More, fewer or the same",
    summary:
      "Count each group, then compare each count with the number. More is greater, fewer is less, and the same is equal.",
    objectives: [
      "Count groups of up to 20 dots.",
      "Choose the group that has more than, fewer than or the same as a number.",
    ],
    intuitionTitle: "Count, then compare",
    intuition: [
      "To compare a group with a number, first count the group. Touch each dot once so that you do not count any twice.",
      "Then ask: is this count more than the number, fewer than the number or the same as the number?",
    ],
    example: {
      prompt:
        "Group A has 5 dots, group B has 8 dots and group C has 6 dots. Which group has more dots than 6?",
      steps: [
        "Compare each count with 6. 5 is fewer than 6. 8 is more than 6. 6 is the same as 6.",
        "Only group B has more than 6.",
      ],
      answer: "Group B.",
    },
    methodTitle: "Check every group",
    method: [
      "Count the dots in each group and say each count.",
      "Check each count against the number. Skip the groups that are not what the question asks.",
    ],
    formalTitle: "Comparing numbers",
    formal: [
      "For two whole numbers, exactly one is true: the first is more than the second, fewer than the second, or the same as the second.",
    ],
    pitfalls: [
      "A group with the same number is not more and not fewer.",
      "Count each dot once. Pushing counted dots aside can help.",
    ],
    parentGuide:
      "Put out 7 coins. Ask the learner to make a group with more than 7 and a group with fewer than 7.",
  }),
  lesson({
    id: "story-sentence-match-20",
    title: "Match a story and a number sentence",
    summary:
      "A story and a sentence match when they have the same action and the same unknown number. The box □ is the number to find.",
    objectives: [
      "Choose the number sentence that matches a story within 20.",
      "Choose the story that matches a number sentence within 20.",
    ],
    intuitionTitle: "The story and the sentence say the same thing",
    intuition: [
      "A number sentence uses numbers and signs to say something is equal, such as 8 + 5 = 13. In a story problem there is a number you do not know yet. We write a box □ for it.",
      "To match a story with a sentence, ask two questions. What happens: are things put together, taken away or compared? And which number is the box?",
    ],
    example: {
      prompt:
        "Mia has 9 stickers. She gets some more. Now she has 14. How many more stickers did she get? Which sentence matches: 9 + □ = 14 or 14 + 9 = □?",
      steps: [
        "Mia starts with 9 and ends with 14. The number she got is not known.",
        "Put the start, then the unknown, then the end: 9 + □ = 14.",
        "14 + 9 = □ would find a total of two groups. That is not this story.",
      ],
      answer: "9 + □ = 14.",
    },
    methodTitle: "Find the action and the unknown",
    method: [
      "Put together: add the parts. Take away: subtract what is taken from the start. Compare: subtract the smaller from the greater.",
      "If the total is known and a part is missing, write the part as the box, as in 9 + □ = 14.",
      "Read the sentence back as a story to check.",
    ],
    formalTitle: "Forms of one-step stories",
    formal: [
      "Join: part + part = whole. Separate: whole − part = part left. Missing part: part + □ = whole. Missing start: □ − part = part left. Compare: greater − smaller = difference.",
    ],
    pitfalls: [
      "The same numbers can match different stories. Check where the box is.",
      "Do not add just because the story has two numbers.",
    ],
    parentGuide:
      "Tell a short story with 5 and 8 and ask the learner to say a number sentence for it, and then a different story for the same sentence.",
  }),
  lesson({
    id: "story-sentence-match-1000",
    title: "Match a story and a number sentence within 1,000",
    summary:
      "A story and a sentence match when they have the same action and the same unknown number, however large the numbers.",
    objectives: [
      "Choose the number sentence that matches a story within 1,000.",
      "Choose the story that matches a number sentence within 1,000.",
    ],
    intuitionTitle: "Large numbers, same ideas",
    intuition: [
      "A number sentence uses numbers and signs to say something is equal, such as 267 + 469 = 736. We write a box □ for the number we do not know yet.",
      "The numbers can be large, but matching a story to a sentence uses the same two questions. What happens: put together, take away or compare? And which number is the box?",
    ],
    example: {
      prompt:
        "Ben has 320 stamps. He gives away 145. How many stamps does he have left? Which sentence matches: 320 − 145 = □ or 320 + 145 = □?",
      steps: [
        "Ben starts with 320 and some are taken away: 145.",
        "Taking away is subtraction, and the number left is the box: 320 − 145 = □.",
        "320 + 145 = □ would be a story where 145 more are added.",
      ],
      answer: "320 − 145 = □.",
    },
    methodTitle: "Find the action and the unknown",
    method: [
      "Put together: add the parts. Take away: subtract what is taken from the start. Compare: subtract the smaller from the greater.",
      "If the total is known and a part is missing, write the part as the box, as in 267 + □ = 736.",
      "Read the sentence back as a story to check.",
    ],
    formalTitle: "Forms of one-step stories",
    formal: [
      "Join: part + part = whole. Separate: whole − part = part left. Missing part: part + □ = whole. Missing start: □ − part = part left. Compare: greater − smaller = difference.",
    ],
    pitfalls: [
      "A large number does not mean subtract. Decide by what happens in the story.",
      "Check where the box is. It can be the total, a part or the number left.",
    ],
    parentGuide:
      "Make up a story with two three-digit numbers, such as 250 and 400, and ask the learner for a number sentence that matches.",
  }),
  lesson({
    id: "open-number-line-to-120",
    title: "Open number lines to 120",
    summary:
      "Only a few ticks are labeled. Find how much each tick adds, then count from a labeled number to the point.",
    objectives: [
      "Read the number at a marked point on a number line labeled at three numbers.",
      "Find the point at a given number.",
    ],
    intuitionTitle: "Equal steps between the labels",
    intuition: [
      "A number line shows numbers in order. The tick marks are the same distance apart, so each tick adds the same amount to the one before it. Only a few ticks have numbers.",
      "You can find any number by counting steps from a labeled tick.",
    ],
    example: {
      prompt:
        "A number line goes from 0 to 100 with a tick for every 10. Only 0, 50 and 100 are labeled. What number is at point $P$, 3 ticks to the right of 50?",
      steps: [
        "From 0 to 50 there are 5 steps. Each step is 50 ÷ 5 = 10.",
        "$P$ is 3 steps right of 50: 50 + 10 + 10 + 10 = 80.",
      ],
      answer: "80.",
    },
    methodTitle: "Find the step size first",
    method: [
      "Count the steps between two labels. Divide the difference of the labels by the number of steps.",
      "Count from the labeled number nearest the point, adding one step each time you move right, or subtracting each time you move left.",
      "To place a number, count steps from a label until you reach that number, then find the point there.",
    ],
    formalTitle: "Equal spacing",
    formal: [
      "On a number line equal distances stand for equal changes in value. If labels $a$ and $b$ are $n$ steps apart, each step is $(b-a)\\div n$.",
    ],
    pitfalls: [
      "Count the jumps between ticks, not the ticks themselves.",
      "Work out the step size from the labels. It is not always 1 or 10.",
    ],
    parentGuide:
      "Draw a line from 0 to 100 and label 0, 50 and 100. Ask the learner to find where 30 and 70 go.",
  }),
  lesson({
    id: "open-number-line-to-1000",
    title: "Open number lines to 1,000",
    summary:
      "Only three ticks are labeled. Find how much each tick adds, then count from a labeled number to the point.",
    objectives: [
      "Read the number at a marked point on a number line labeled at three numbers.",
      "Find the point at a given number.",
    ],
    intuitionTitle: "Equal steps between the labels",
    intuition: [
      "A number line shows numbers in order. The tick marks are the same distance apart, so each tick adds the same amount to the one before it. Only three ticks have numbers.",
      "You can find any number by counting steps from a labeled tick, even when the numbers are large.",
    ],
    example: {
      prompt:
        "A number line goes from 0 to 500 with 10 equal steps. Only 0, 250 and 500 are labeled. What number is at point $P$, 3 ticks to the right of 250?",
      steps: [
        "From 0 to 250 there are 5 steps. Each step is 250 ÷ 5 = 50.",
        "$P$ is 3 steps right of 250: 250 + 50 + 50 + 50 = 400.",
      ],
      answer: "400.",
    },
    methodTitle: "Find the step size first",
    method: [
      "Count the steps between two labels. Divide the difference of the labels by the number of steps.",
      "Count from the labeled number nearest the point, adding one step each time you move right, or subtracting each time you move left.",
      "To place a number, count steps from a label until you reach that number, then find the point there.",
    ],
    formalTitle: "Equal spacing",
    formal: [
      "On a number line equal distances stand for equal changes in value. If labels $a$ and $b$ are $n$ steps apart, each step is $(b-a)\\div n$.",
    ],
    pitfalls: [
      "Count the jumps between ticks, not the ticks themselves.",
      "Work out the step size from the labels. A line from 0 to 500 with 10 steps has steps of 50, not 10.",
    ],
    parentGuide:
      "Draw a line from 0 to 1,000 and label 0, 500 and 1,000. Ask the learner to find where 300 and 800 go.",
  }),
  lesson({
    id: "eighths-and-parts-beyond-one",
    title: "Eighths and parts past one whole",
    summary:
      "Eight equal parts make one whole, and each part is one eighth. More than eight eighths is more than one whole.",
    objectives: [
      "Name shaded eighths of a bar.",
      "Say how many equal parts make one whole.",
      "Describe shaded parts that go past one whole.",
    ],
    intuitionTitle: "Equal parts of a whole",
    intuition: [
      "A whole is all of one bar. When you cut a bar into 8 equal parts, each part is one eighth. Eight eighths fill the whole bar. The name comes from how many equal parts the whole has.",
      "If you shade all of one bar and some of a second bar, you have shaded more than one whole.",
    ],
    example: {
      prompt:
        "Two bars are each cut into 8 equal parts. The first bar is all shaded and 3 parts of the second bar are shaded. How much is shaded?",
      steps: [
        "The first bar is full: 8 eighths make 1 whole.",
        "The second bar has 3 eighths shaded.",
        "Together that is 1 whole and 3 eighths. In all, 8 + 3 = 11 eighths are shaded.",
      ],
      answer: "1 whole and 3 eighths.",
    },
    methodTitle: "Name the parts, then count the shaded ones",
    method: [
      "Count the equal parts in one whole. If there are 8, the parts are eighths.",
      "Count only the shaded parts. Say the number, then the name: 5 eighths.",
      "When a whole bar is full, call it 1 whole and count the shaded parts that are left over.",
    ],
    formalTitle: "Unit fractions",
    formal: [
      "When a whole is cut into $n$ equal parts, each part is the unit fraction $1/n$, and $n$ of them make one whole. A number of parts larger than $n$ is more than one whole.",
    ],
    pitfalls: [
      "Count the equal parts in one whole to name the parts. Do not count the shaded parts for the name.",
      "After one full whole, count only the shaded parts in the next bar.",
    ],
    parentGuide:
      "Fold a paper strip in half three times to make eighths. Ask how many eighths make the whole strip.",
  }),
  lesson({
    id: "decompose-flat-shape",
    title: "Cut a shape into parts",
    summary:
      "Count the parts a cut makes, then count the sides of one part to name its shape.",
    objectives: [
      "Say how many parts a square or rectangle is cut into.",
      "Name the shape of the parts.",
    ],
    intuitionTitle: "Cutting a shape",
    intuition: [
      "To decompose a shape means to cut it into smaller shapes. After a cut, count the parts. Then pick one part and count its sides and corners to name it.",
      "A line from one corner to the opposite corner is a diagonal.",
    ],
    example: {
      prompt: "A rectangle is cut along a diagonal. What are the new shapes?",
      steps: [
        "One cut makes 2 parts.",
        "Each part has 3 sides and 3 corners.",
        "A shape with 3 sides is a triangle.",
      ],
      answer: "2 triangles.",
    },
    methodTitle: "Count, then name",
    method: [
      "Count the parts the cuts make.",
      "Pick one part. Three sides: triangle. Four sides, all equal: square. Four sides with two longer: rectangle.",
      "Say the number and the name: for example, 4 squares.",
    ],
    formalTitle: "Cutting squares and rectangles",
    formal: [
      "A diagonal cut of a rectangle makes two triangles, and cutting a square along both diagonals makes four triangles. Equal strips of a rectangle are rectangles. Cutting a square through the middle each way makes four squares.",
    ],
    pitfalls: [
      "A cut from corner to corner makes triangles, not rectangles.",
      "Check the sides. Two equal strips of a square are rectangles that are not squares.",
    ],
    parentGuide:
      "Cut a square sheet of paper along one diagonal. Ask what shapes you have, then cut one of them in two again.",
  }),
  lesson({
    id: "unit-size-and-count",
    title: "Bigger units, fewer copies",
    summary:
      "A longer unit covers more each time, so measuring the same length needs fewer copies of it.",
    objectives: [
      "Tell which of two units needs fewer copies to cover the same length.",
      "Find how many long units cover a length given in small units.",
    ],
    intuitionTitle: "The same ribbon, two units",
    intuition: [
      "To measure a length you cover it with copies of a unit laid end to end with no gaps. If you use a short unit you need many copies. If you use a long unit you need fewer, because each copy covers more.",
      "The ribbon does not change. Only the unit does, and the count changes with it.",
    ],
    example: {
      prompt:
        "A ribbon is 12 small units long. One long unit is as long as 3 small units. How many long units cover the ribbon?",
      steps: [
        "Each long unit covers 3 small units.",
        "Share the 12 small units into groups of 3: 12 ÷ 3 = 4.",
        "4 long units cover the ribbon. That is fewer than 12, as expected for a longer unit.",
      ],
      answer: "4 long units.",
    },
    methodTitle: "Compare the size of one unit",
    method: [
      "Look at one copy of each unit. Which is longer?",
      "The longer unit needs fewer copies. The shorter unit needs more copies.",
      "To find the count for the long unit, share the small units into groups the size of the long unit.",
    ],
    formalTitle: "Unit size and count",
    formal: [
      "For a fixed length, the number of copies of a unit equals the length divided by the length of the unit. The number of copies gets smaller as the unit gets longer.",
    ],
    pitfalls: [
      "A bigger count means a shorter unit, not a longer ribbon.",
      "Units must be laid end to end with no gaps or overlaps.",
    ],
    parentGuide:
      "Measure a table with a pencil and then with a crayon. Ask which one needed more copies and why.",
  }),
  lesson({
    id: "benchmark-length-estimate",
    title: "Estimate with a benchmark",
    summary:
      "A benchmark is a length you know. Repeat it to estimate a longer length, and use what you know to check an estimate.",
    objectives: [
      "Estimate a length by repeating a benchmark.",
      "Choose a reasonable estimate for a familiar object.",
    ],
    intuitionTitle: "Use a length you know",
    intuition: [
      "A benchmark is a length you know well, such as a ruler that is 12 inches long. When you cannot measure, you can estimate. An estimate is a careful guess that is close to the real length.",
      "To estimate, compare the object with the benchmark. If the object is about 3 benchmarks long, repeat the benchmark length 3 times.",
    ],
    example: {
      prompt:
        "A crayon is about 4 inches long. A shelf is about 5 crayons long. About how long is the shelf?",
      steps: [
        "Each crayon is about 4 inches.",
        "The shelf is 5 crayons long: 4 + 4 + 4 + 4 + 4 = 20.",
      ],
      answer: "About 20 inches.",
    },
    methodTitle: "Repeat and check",
    method: [
      "Find the benchmark length. Count how many benchmarks make the length.",
      "Add the benchmark length that many times, or multiply.",
      "Check the unit and the size: does the answer fit what you know about the object?",
    ],
    formalTitle: "Estimating with benchmarks",
    formal: [
      "If a benchmark has length $b$ and an object is about $k$ benchmarks long, its length is about $k\\cdot b$. The estimate is close to, not equal to, the true length.",
    ],
    pitfalls: [
      "Repeat the length. Do not add the number of benchmarks to the benchmark length.",
      "Check the unit. A pencil is about 7 inches, not 7 feet.",
    ],
    parentGuide:
      "Find a benchmark at home, such as a paper clip about 1 inch long. Ask the learner to estimate a book's length with it.",
  }),
  lesson({
    id: "clock-minute-match",
    title: "Clocks to the minute",
    summary:
      "The short hand shows the hour. Count by fives and then by ones to read the minutes, and write them as two digits.",
    objectives: [
      "Read an analog clock to the minute.",
      "Match an analog clock with a digital time.",
    ],
    intuitionTitle: "Two hands, hours and minutes",
    intuition: [
      "A clock has two hands. The short hand is the hour hand and shows the hour it has passed. The long hand is the minute hand and shows the minutes after the hour.",
      "Each numeral on the clock is 5 minutes. The small tick marks between numerals are single minutes.",
    ],
    example: {
      prompt:
        "The short hand has just passed 4. The long hand is 2 tick marks past the 7. What time is it?",
      steps: [
        "The hour hand has passed 4, so the hour is 4.",
        "The long hand is at the 7, which is 7 × 5 = 35 minutes. It is 2 more tick marks past, so 35 + 2 = 37 minutes.",
        "Write the hour, a colon and two digits for the minutes.",
      ],
      answer: "4:37.",
    },
    methodTitle: "Hour first, then minutes",
    method: [
      "Read the hour from the short hand: the numeral it has passed.",
      "Count by fives to the numeral before the long hand, then count single ticks.",
      "Write the digital time. Minutes below 10 need a zero first, as in 4:07.",
    ],
    formalTitle: "Reading a clock",
    formal: [
      "There are 60 minutes in an hour. The minute hand moves 1 minute for each small tick and 5 minutes for each numeral. The hour hand moves slowly from one hour numeral to the next as the minutes pass.",
    ],
    pitfalls: [
      "Do not swap the hands. The short hand is the hour.",
      "Write a zero before a single minute digit: 4:07, not 4:7.",
    ],
    parentGuide:
      "Set a clock to 3:48. Ask the learner to say the hour and the minutes, and to write the digital time.",
  }),
  lesson({
    id: "tally-and-t-chart",
    title: "Tally charts and T-charts",
    summary:
      "Tally marks count in groups of five. A T-chart lists each choice with its count.",
    objectives: [
      "Read a tally chart to find a count, a difference or a total.",
      "Choose the T-chart that matches a list of answers.",
    ],
    intuitionTitle: "Counting with marks",
    intuition: [
      "A tally mark is a line that stands for one answer. Four lines and one line across them make a group of five. Groups of five make long counts easy to read.",
      "Every T-chart has two columns with a line down the middle. One column names each choice and the other tells how many chose it.",
    ],
    example: {
      prompt:
        "In a tally chart, cats have one group of five and 3 more lines. Dogs have 4 lines. How many more children chose cats than dogs?",
      steps: [
        "Cats: one group of five is 5, and 3 more lines make 8.",
        "Dogs: 4 lines make 4.",
        "8 − 4 = 4.",
      ],
      answer: "4 more children chose cats.",
    },
    methodTitle: "Count by fives",
    method: [
      "Count each group of five as 5. Add the lines left over.",
      "To find how many more, subtract the smaller count from the greater. For a total, add all the counts.",
      "To make a T-chart from a list, go through the list once. Make one mark for each answer and cross it out as you count it.",
    ],
    formalTitle: "Organizing data",
    formal: [
      "A tally chart and a T-chart organize the same data. The total is the sum of the counts, and the difference of two counts tells how many more one choice has than the other.",
    ],
    pitfalls: [
      "The line across four lines is part of the five. Do not count it as a sixth.",
      "Count each answer in a list only once.",
    ],
    parentGuide:
      "Ask the family to pick a favorite fruit. Make a tally chart together and ask which fruit has the most.",
  }),
  lesson({
    id: "early-money-decisions",
    title: "Income, saving and making things",
    summary:
      "Income is money earned by work. Saving keeps money for later. Deposits and withdrawals change a balance, and a maker adds up what the parts cost.",
    objectives: [
      "Tell income from a gift, spending from saving, and a deposit from a withdrawal.",
      "Find savings over time, a balance after a deposit and a withdrawal, and the cost to make an item.",
      "Tell a producer from a consumer.",
    ],
    intuitionTitle: "Where money comes from and where it goes",
    intuition: [
      "Money you earn by working is income. A gift is money someone gives you without work, such as birthday money. You can spend money to buy something now, or save it to use later.",
      "A bank account holds saved money. A deposit puts money in, so the balance goes up. A withdrawal takes money out, so the balance goes down. A producer makes things to sell. A consumer buys and uses them.",
    ],
    example: {
      prompt:
        "Ben already has $10 saved. He saves $4 each week. How much does he have after 5 weeks?",
      steps: [
        "Each week adds $4. In 5 weeks Ben adds 5 × 4 = 20 dollars.",
        "Add the $10 he already had: 10 + 20 = 30.",
      ],
      answer: "$30.",
    },
    methodTitle: "Match the idea, then compute",
    method: [
      "Ask what the question is about: pay for work or a present; buying or keeping; putting money in or taking it out; making or buying.",
      "For savings, add what is saved each week for every week, and include money already saved.",
      "For the cost to make an item, multiply the number of each part by its price, then add all the parts.",
    ],
    formalTitle: "Money words and amounts",
    formal: [
      "Income is money earned by work. A deposit adds to an account balance and a withdrawal subtracts from it. If $s$ dollars are saved and $a$ dollars are added each week, the savings after $w$ weeks are $s+w\\cdot a$ dollars.",
    ],
    pitfalls: [
      "A present is a gift, not income, because nobody worked for it.",
      "Subtract a withdrawal and add a deposit. Do not mix them up.",
      "Count how many of each part the item needs before you add the costs.",
    ],
    parentGuide:
      "Ask the learner to tell one way to earn money, one gift they received, and how much they would have if they saved $2 each week for 6 weeks.",
  }),
];
