import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

export const factArrayLessons: Lesson[] = [
  {
    id: "multiplication",
    title: "Multiplication facts from arrays",
    summary:
      "A product counts equal rows: 4 × 6 is 4 rows of 6. Any fact can be built from a nearby fact you already know.",
    templateIds: ["multiply-facts"],
    objectives: [
      "Read a product as equal rows in an array.",
      "Use turning and splitting an array to find facts from known ones.",
    ],
    sections: [
      {
        title: "Rows and columns",
        paragraphs: [
          "An array sets objects in equal rows. Four rows with six dots in each row is 4 × 6, read “4 times 6” or “4 rows of 6”. The numbers multiplied are the factors; the result is the product.",
          "Counting by rows adds one more 6 each time: 6, 12, 18, 24. The last count is the product: 4 × 6 = 24.",
        ],
        illustration: "array-rows-columns",
      },
      {
        title: "Turn the array",
        paragraphs: [
          "Turn an array a quarter turn and its rows become columns. Three rows of five become five rows of three, and not one dot moves in or out.",
          "So the order of the factors never changes the product: 3 × 5 = 5 × 3. Every fact you know gives you its turned partner for free.",
        ],
        illustration: "array-turn",
      },
      {
        title: "Build from a known fact",
        paragraphs: [
          "Split a hard array into easy ones. Seven rows of six are five rows of six and two more rows of six: 30 + 12 = 42.",
          "Each factor has a quick route. Times 2: double. Times 4: double, then double again. Times 5: times 10, then half. Times 9: times 10, then take away one group. Times 3: double, then add one more group. For 6, 7 and 8, split off five rows.",
        ],
        illustration: "split-array",
      },
    ],
    workedExample: {
      prompt: "What is 7 × 8?",
      steps: [
        "Split the 7 rows into 5 rows and 2 rows.",
        "5 × 8 = 40 and 2 × 8 = 16.",
        "40 + 16 = 56, so 7 × 8 = 56.",
      ],
      answer: "56",
    },
    pitfalls: [
      "Adding the factors instead of multiplying: 7 × 8 is seven groups of 8, not 7 + 8.",
      "Splitting a factor but multiplying only one part: 7 × 8 needs both 5 × 8 and 2 × 8.",
    ],
    parentGuide:
      "Lay out a muffin tin, an egg carton or rows of coins. Ask how many rows and how many in each row, then the total. Turn the tray and ask what changed and what stayed the same.",
  },
  {
    id: "division",
    title: "Division facts: think multiplication",
    summary:
      "n ÷ d asks which number times $d$ makes $n$, so every division fact is a multiplication fact read backwards.",
    templateIds: ["divide-facts"],
    objectives: [
      "Find a quotient from the related multiplication fact.",
      "Read one array as two multiplication and two division facts.",
    ],
    sections: [
      {
        title: "Division asks for a missing factor",
        paragraphs: [
          "In 28 ÷ 4 = 7, 28 is the dividend (the whole), 4 is the divisor, and 7 is the quotient. The division asks: 4 times what number is 28?",
          "Picture 28 dots in 4 equal rows. The quotient is the number of dots in each row. Because 4 × 7 = 28, each row holds 7.",
        ],
      },
      {
        title: "One array, four facts",
        paragraphs: [
          "Four rows of seven give 4 × 7 = 28 and, turned, 7 × 4 = 28. The same array answers 28 ÷ 4 (the length of a row) and 28 ÷ 7 (the number of rows of 7).",
          "So knowing one multiplication fact means knowing a family of four. Division by 1 leaves a number unchanged, and dividing a number by itself gives 1.",
        ],
        illustration: "fact-family-array",
      },
    ],
    workedExample: {
      prompt: "What is 56 ÷ 8?",
      steps: [
        "56 ÷ 8 asks: 8 times what number is 56?",
        "8 × 7 = 56.",
        "So 56 ÷ 8 = 7.",
      ],
      answer: "7",
    },
    pitfalls: [
      "Dividing in the wrong order: 56 ÷ 8 is not 8 ÷ 56.",
      "Answering with the wrong factor of the fact family: in 56 ÷ 8 the divisor 8 is given, so the quotient is the other factor, 7.",
    ],
    parentGuide:
      "Arrange 24 coins in equal rows. Ask for the multiplication the rows show, then the two divisions: how many in each row, and how many rows.",
  },
  {
    id: "missing-factor",
    title: "Find the missing factor",
    summary:
      "A box in a multiplication or division equation stands for the one number that makes it true, and every such box is found from a multiplication fact.",
    templateIds: ["missing-factor-fact"],
    objectives: [
      "Find an unknown factor in $a \\times  \\boxed{\\phantom{0}} = n$ or $\\boxed{\\phantom{0}} \\times  b = n$.",
      "Find an unknown divisor by rewriting $n \\div  \\boxed{\\phantom{0}} = q$ as $\\boxed{\\phantom{0}} \\times  q = n$.",
    ],
    sections: [
      {
        title: "The box is a factor",
        paragraphs: [
          "In 6 × □ = 42, the box is the number that 6 multiplies to make 42. It is the number of dots in each of 6 rows when there are 42 dots in all.",
          "Skip-count by 6 and count the jumps: 6, 12, 18, 24, 30, 36, 42 is seven jumps. So □ = 7, and 6 × 7 = 42 checks it.",
        ],
        illustration: "missing-factor-skip",
      },
      {
        title: "An unknown divisor",
        paragraphs: [
          "42 ÷ □ = 6 says that splitting 42 into □ equal groups puts 6 in each. That is the same as □ × 6 = 42.",
          "Skip-count by 6 to 42: seven groups. So □ = 7. Check by dividing: 42 ÷ 7 = 6.",
        ],
      },
    ],
    workedExample: {
      prompt: "□ × 8 = 48. What number belongs in the box?",
      steps: [
        "The box is the number of groups of 8 that make 48.",
        "Skip-count by 8: 8, 16, 24, 32, 40, 48. That is 6 skips.",
        "6 × 8 = 48, so □ = 6.",
      ],
      answer: "6",
    },
    pitfalls: [
      "Writing the total in the box: in 6 × □ = 42 the box is a factor, not 42.",
      "Dividing the wrong way in 42 ÷ □ = 6: the box is 42 ÷ 6, never 6 ÷ 42.",
    ],
    parentGuide:
      "Hide some coins under a cup in equal rows and tell the learner the total and the number of rows. Ask how many are in each row, then lift the cup to check.",
  },
  {
    id: "share-or-group",
    title: "Two meanings of division",
    summary:
      "Division answers two questions: how many in each group when the number of groups is known, and how many groups when the size of each group is known.",
    templateIds: ["share-or-group"],
    objectives: [
      "Find the size of each share when objects are shared equally.",
      "Find the number of groups when objects are put into groups of a given size.",
    ],
    sections: [
      {
        title: "Sharing: the number of groups is known",
        paragraphs: [
          "Share 12 counters on 3 plates by dealing: one to each plate, then another to each, until none are left. Each round uses 3 counters, and there are 4 rounds, so each plate gets 4.",
          "The question is the size of each group: 12 ÷ 3 = 4.",
        ],
        illustration: "share-measure",
      },
      {
        title: "Measuring: the size of each group is known",
        paragraphs: [
          "Put 12 counters into groups of 3. Fill one group of 3, then another, until none are left. Four groups are filled.",
          "The question is the number of groups: 12 ÷ 3 = 4 again. Both meanings use the same fact, 3 × 4 = 12; they differ only in which factor is unknown.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "30 stickers are shared equally by 5 friends. How many stickers does each friend get?",
      steps: [
        "The number of groups is known: 5 friends. The size of each share is unknown.",
        "Each round of dealing uses 5 stickers: 5, 10, 15, 20, 25, 30 is 6 rounds.",
        "30 ÷ 5 = 6: each friend gets 6 stickers.",
      ],
      answer: "6",
    },
    pitfalls: [
      "Giving the number of groups when the question asks for the size of each, or the reverse.",
      "Sharing unequally: every group must end with the same number.",
    ],
    parentGuide:
      "Share a handful of crackers among family members by dealing one at a time. Then put the same crackers into bags of a fixed size. Ask what each way of dividing found.",
  },
  {
    id: "times-table-patterns",
    title: "Patterns in the multiplication table",
    summary:
      "The multiplication table follows from what multiplication means: each row grows by its own factor, doubling a factor doubles its row, and two rows add to the row of their sum.",
    templateIds: ["times-table-pattern"],
    objectives: [
      "Find a product from its neighbor in the same row.",
      "Use doubled rows and added rows to find products.",
    ],
    sections: [
      {
        title: "Each row steps by its factor",
        paragraphs: [
          "In a multiplication table, the cell in the row for 3 and the column for 7 holds 3 × 7. Moving one column right adds one more group of 3, so the row for 3 reads 12, 15, 18, 21, 24 as the columns go 4, 5, 6, 7, 8.",
          "So a product you do not know is its left neighbor plus the row's factor: 3 × 8 = 21 + 3 = 24.",
        ],
        illustration: "table-patterns",
      },
      {
        title: "Doubled rows and added rows",
        paragraphs: [
          "Six groups are two sets of three groups, so every product in the row for 6 is double the one in the row for 3: 6 × 7 = 21 + 21 = 42.",
          "Five groups are two groups and three more groups, so the row for 5 is the row for 2 plus the row for 3: 5 × 7 = 14 + 21 = 35.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "Each product in the row for 8 is double the product above it, in the row for 4. 4 × 7 = 28. What is 8 × 7?",
      steps: [
        "8 groups of 7 are two sets of 4 groups of 7.",
        "Double 28: 28 + 28 = 56.",
        "8 × 7 = 56.",
      ],
      answer: "56",
    },
    pitfalls: [
      "Adding 1 instead of the row's factor when moving one column along a row.",
      "Doubling a product in the wrong row: only the row for a doubled factor is doubled.",
    ],
    parentGuide:
      "Write the rows for 2, 4 and 8 side by side and ask the learner what each row does to the one before it. Then predict the next product before checking it.",
  },
];

export const factArrayMethods: Record<string, ProblemMethod> = {
  "multiply-facts": {
    goal: "Given two one-digit factors, an array or a story of equal rows, find the product.",
    terms: [
      ["factor", "A number being multiplied."],
      ["product", "The result of multiplying."],
      ["array", "Objects in equal rows and equal columns."],
    ],
    method: [
      "Read 7 × 8 as 7 rows of 8.",
      "Start from a fact you know: double for 2, double twice for 4, half of 10 for 5, ten minus one group for 9.",
      "For 6, 7 or 8 rows, split off 5 rows and add the two products.",
    ],
    watch:
      "Turning the array swaps the factors but not the product: 3 × 8 = 8 × 3.",
  },
  "divide-facts": {
    goal: "Given a division within 100, find the quotient from a multiplication fact.",
    terms: [
      ["dividend", "The number being divided."],
      ["divisor", "The number you divide by."],
      ["quotient", "The result of dividing."],
    ],
    method: [
      "Rewrite $n \\div  d = \\boxed{\\phantom{0}}$ as $d \\times  \\boxed{\\phantom{0}} = n$.",
      "Find the missing factor from a fact you know or by skip-counting by $d$.",
      "Check: divisor × quotient = dividend.",
    ],
    watch:
      "The quotient is the factor that was not given: in 56 ÷ 8 it is 7, not 8.",
  },
  "missing-factor-fact": {
    goal: "Given a multiplication or division equation with a box, find the number in the box.",
    method: [
      "Write the equation as a multiplication: $a \\times  \\boxed{\\phantom{0}} = n$, $\\boxed{\\phantom{0}} \\times  b = n$, or for $n \\div  \\boxed{\\phantom{0}} = q$, $\\boxed{\\phantom{0}} \\times  q = n$.",
      "Skip-count by the known factor to $n$ and count the skips.",
      "Put the number back in the box and check the equation.",
    ],
    watch: "The box is a factor, never the total: in 6 × □ = 42 it is 7.",
  },
  "share-or-group": {
    goal: "Given a total and either the number of groups or the size of each group, find the other.",
    method: [
      "Decide what is known: the number of groups (sharing) or the size of each group (measuring).",
      "Sharing: deal one to each group per round and count the rounds. Measuring: fill groups of the given size and count the groups.",
      "Both are total ÷ known number; check with a multiplication.",
    ],
    watch:
      "Answer the question asked: the size of each group or the number of groups.",
  },
  "times-table-pattern": {
    goal: "Given part of a multiplication table and a pattern, find a missing product.",
    terms: [
      [
        "row for 6",
        "The products 6 × 1, 6 × 2, 6 × 3, … in one row of the table.",
      ],
    ],
    method: [
      "Name the cell: its row factor times its column factor.",
      "Use the pattern: add the row factor to the left neighbor, double the row above, or add the two rows above.",
      "Check by multiplying the two factors.",
    ],
    watch: "One column to the right adds the row's factor, not 1.",
  },
};

export const factArrayPrinciples: Record<string, string> = {
  "multiply-facts":
    "Multiplication is commutative (a × b = b × a) and distributes over addition: (5 + 2) × b = 5 × b + 2 × b.",
  "divide-facts":
    "Division is the inverse of multiplication: n ÷ d = q exactly when $d \\times  q = n (d \\neq  0)$.",
  "missing-factor-fact":
    "An unknown factor or divisor is found from the related multiplication: $a \\times  \\boxed{\\phantom{0}} = n$ and $n \\div  \\boxed{\\phantom{0}} = q$ each name a factor of $n$.",
  "share-or-group":
    "n ÷ d answers both how many in each of $d$ equal groups and how many groups of $d$ make $n$, because d × q = q × d.",
  "times-table-pattern":
    "a × (c + 1) = a × c + a, (2a) × c = 2(a × c), and (a + b) × c = a × c + b × c.",
};
