import type { GlossarySenses } from "../glossary/types";
import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

const factSenses: GlossarySenses = {
  factor: "factor-number",
  product: "product-multiply",
};

export const factArrayLessons: Lesson[] = [
  {
    id: "multiplication",
    title: "Multiplication facts from arrays",
    summary:
      "Multiplication is a fast way to count equal groups, groups that all have the same number. The sign × is read “times.” So 4 × 6 means 4 groups of 6. You can count 6, 12, 18, 24 instead of counting every dot. So 4 × 6 = 24.",
    templateIds: ["multiply-facts"],
    senses: factSenses,
    objectives: [
      "Read a multiplication as equal rows in an array, objects set out in equal rows.",
      "Turn and split an array to find new facts from facts you know.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Count equal rows",
        paragraphs: [
          "Say 4 rows each hold 6 dots. You could count every dot, one at a time.",
          "Or you could count by sixes: 6, 12, 18, 24. Each row adds one more 6.",
          "Multiplication is this short way to count groups that all have the same size.",
        ],
      },
      {
        title: "Rows and columns",
        paragraphs: [
          "An array sets objects in equal rows. A row goes across, and a column goes up and down. Look at the picture: 4 rows with 6 dots in each row.",
          "We write that as 4 × 6, read “4 times 6” or “4 rows of 6.” The numbers you multiply are called factors. The answer is called the product.",
          "Count by rows, adding one more 6 each time: 6, 12, 18, 24. The last count is the product: 4 × 6 = 24.",
        ],
        illustration: "array-rows-columns",
      },
      {
        title: "Turn the array",
        paragraphs: [
          "Look at the picture: the array turns a quarter turn. Its rows become columns. Three rows of 5 become 5 rows of 3.",
          "Not one dot moves in or out. So the order of the factors does not change the product: 3 × 5 = 5 × 3 = 15.",
          "So every fact you know gives you a second fact. If you know 3 × 5, you also know 5 × 3.",
        ],
        illustration: "array-turn",
      },
      {
        title: "Build from a known fact",
        paragraphs: [
          "Split a hard array into easy ones. Look at the picture: 7 rows of 6 are 5 rows of 6 and 2 more rows of 6. That is 30 + 12 = 42.",
          "Each factor has a quick way. Times 2: double, which means add a number to itself. Times 4: double, then double again. Times 5: times 10, then take half.",
          "Times 9: times 10, then take away one group. Times 3: double, then add one more group. For 6, 7 and 8, split off 5 rows.",
        ],
        illustration: "split-array",
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Equal groups and products",
        paragraphs: [
          "Multiplication counts equal groups. The number of groups times the size of each group gives the total. Turning an array swaps the factors but keeps the total, so $a \\times b = b \\times a$. Splitting a factor into parts splits the product into smaller products that add up to it: $7 \\times 6 = 5 \\times 6 + 2 \\times 6$.",
        ],
      },
    ],
    workedExample: {
      prompt: "What is 7 × 8?",
      steps: [
        "Split the 7 rows into 5 rows and 2 rows, because 5 and 2 are easy to multiply.",
        "Find each part: 5 × 8 = 40 and 2 × 8 = 16.",
        "The two parts make all 7 rows, so add them: 40 + 16 = 56. So 7 × 8 = 56.",
      ],
      answer: "56",
    },
    pitfalls: [
      "Multiply the factors, do not add them. 7 × 8 is 7 groups of 8, which is 56, not 7 + 8 = 15.",
      "When you split a factor, find both parts. 7 × 8 needs 5 × 8 and 2 × 8.",
    ],
    parentGuide:
      "Lay out a muffin tin, an egg carton or rows of coins. Ask how many rows there are and how many are in each row, then the total. Turn the tray and ask what changed and what stayed the same.",
  },
  {
    id: "division",
    title: "Division facts: think multiplication",
    summary:
      "To divide means to split a total into equal groups. The sign ÷ is read “divided by.” For 28 ÷ 4, ask: 4 times what number makes 28? Since 4 × 7 = 28, the answer is 7. So 28 ÷ 4 = 7.",
    templateIds: ["divide-facts"],
    senses: factSenses,
    objectives: [
      "Find the answer to a division from a multiplication fact you know.",
      "Read one array as two multiplication facts and two division facts.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Ask what makes the total",
        paragraphs: [
          "Say 28 dots are put in 4 equal rows. How many dots are in each row?",
          "Ask: 4 rows of what number make 28? You know 4 × 7 = 28. So each row holds 7 dots.",
          "So a multiplication fact you know gives you the missing number.",
        ],
      },
      {
        title: "Division asks for a missing factor",
        paragraphs: [
          "In 28 ÷ 4 = 7, the number being split, 28, is called the dividend. The number you divide by, 4, is called the divisor. The answer, 7, is called the quotient.",
          "A factor is one of the numbers you multiply. The division 28 ÷ 4 asks for a missing factor: 4 times what number is 28?",
          "Picture 28 dots in 4 equal rows. The quotient is the number of dots in each row. Because 4 × 7 = 28, each row holds 7.",
        ],
      },
      {
        title: "One array, four facts",
        paragraphs: [
          "Look at the picture: 4 rows of 7. It shows 4 × 7 = 28. Turned, it shows 7 × 4 = 28.",
          "The same array also shows 28 ÷ 4 = 7, the number in each of 4 rows. And it shows 28 ÷ 7 = 4, the number of rows of 7.",
          "These four facts are called a fact family. So one multiplication fact gives you four facts.",
          "Two more facts help. Dividing by 1 leaves a number the same: 9 ÷ 1 = 9. Dividing a number by itself gives 1: 9 ÷ 9 = 1.",
        ],
        illustration: "fact-family-array",
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Division undoes multiplication",
        paragraphs: [
          "The quotient is the number that multiplies the divisor to make the dividend. The divisor can never be 0. With letters, $n \\div d = q$ means exactly the same as $d \\times q = n$. So every division fact matches a multiplication fact.",
        ],
      },
    ],
    workedExample: {
      prompt: "What is 56 ÷ 8?",
      steps: [
        "56 ÷ 8 asks: 8 times what number is 56? Division undoes multiplication, so look for that fact.",
        "You know 8 × 7 = 56, so the missing number is 7.",
        "So 56 ÷ 8 = 7. Check: 8 groups of 7 make 56.",
      ],
      answer: "7",
    },
    pitfalls: [
      "Keep the order. 56 ÷ 8 splits 56 into groups of 8. It is not the same as 8 ÷ 56.",
      "The answer is the factor you were not given. In 56 ÷ 8, you were given 8, so the answer is the other factor, 7.",
    ],
    parentGuide:
      "Arrange 24 coins in equal rows. Ask for the multiplication the rows show. Then ask for the two divisions: how many are in each row, and how many rows there are.",
  },
  {
    id: "missing-factor",
    title: "Find the missing factor",
    summary:
      "A factor is one of the numbers you multiply. In 6 × □ = 42, the box □ stands for a missing factor. Find the number that makes the sentence true. Since 6 × 7 = 42, the box holds 7.",
    templateIds: ["missing-factor-fact"],
    senses: factSenses,
    objectives: [
      "Find the missing factor in $a \\times \\boxed{\\phantom{0}} = n$ or $\\boxed{\\phantom{0}} \\times b = n$.",
      "Find a missing number you divide by, by writing $n \\div \\boxed{\\phantom{0}} = q$ as $\\boxed{\\phantom{0}} \\times q = n$.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "The box has a job",
        paragraphs: [
          "Say there are 42 dots in 6 rows. Every row holds the same number of dots. How many are in each row?",
          "We can write this as 6 × □ = 42. The box □ stands for the number in each row.",
          "Find the number that makes the whole sentence true. That number goes in the box.",
        ],
      },
      {
        title: "The box is a factor",
        paragraphs: [
          "In 6 × □ = 42, the box is the number that 6 multiplies to make 42. It is the number of dots in each of 6 rows when there are 42 dots in all.",
          "To skip-count by 6 means to count 6 at a time. Look at the picture: 6, 12, 18, 24, 30, 36, 42. That is 7 jumps.",
          "So □ = 7. Check: 6 × 7 = 42.",
        ],
        illustration: "missing-factor-skip",
      },
      {
        title: "A missing number you divide by",
        paragraphs: [
          "The sign ÷ means divided by: split into equal groups. 42 ÷ □ = 6 says: split 42 into □ equal groups, and each group gets 6.",
          "That is the same as □ × 6 = 42. Skip-count by 6 to 42: that makes 7 groups. So □ = 7.",
          "Check by dividing: 42 ÷ 7 = 6.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "An unknown factor",
        paragraphs: [
          "In a multiplication sentence, the missing factor is the number that makes the product, the answer, come out right. If you know one factor and the product, divide the product by the known factor. The known factor must not be 0.",
        ],
      },
    ],
    workedExample: {
      prompt: "□ × 8 = 48. What number belongs in the box?",
      steps: [
        "The box is the number of groups of 8 that make 48.",
        "Skip-count by 8, because each count is one more group: 8, 16, 24, 32, 40, 48. That is 6 counts.",
        "Check: 6 × 8 = 48, so □ = 6.",
      ],
      answer: "6",
    },
    pitfalls: [
      "The box is a factor, not the total. In 6 × □ = 42, the box is 7, not 42.",
      "In 42 ÷ □ = 6, find the box with 42 ÷ 6 = 7. Do not try 6 ÷ 42.",
    ],
    parentGuide:
      "Hide some coins under a cup in equal rows. Tell the learner the total and the number of rows. Ask how many are in each row, then lift the cup to check.",
  },
  {
    id: "share-or-group",
    title: "Two meanings of division",
    summary:
      "To divide means to split a total into equal groups. Sometimes you know how many groups and want the size of each. Sometimes you know the size of each group and want how many groups. Both are division.",
    templateIds: ["share-or-group"],
    objectives: [
      "Find how many each gets when objects are shared equally.",
      "Find how many groups you can make when you know the size of each group.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "A total can be split two ways",
        paragraphs: [
          "You have 12 counters. You could share them equally on 3 plates. Or you could put them in groups of 3.",
          "Both use 12 and 3. But sharing asks how many counters go on each plate. Grouping asks how many groups you can make.",
        ],
      },
      {
        title: "Sharing: you know the number of groups",
        paragraphs: [
          "Look at the picture. Share 12 counters on 3 plates by dealing: one to each plate, then another to each plate, until none are left.",
          "Each round uses 3 counters. There are 4 rounds, so each plate gets 4.",
          "This finds the size of each group: 12 ÷ 3 = 4. The sign ÷ is read “divided by.”",
        ],
        illustration: "share-measure",
      },
      {
        title: "Grouping: you know the size of each group",
        paragraphs: [
          "Put 12 counters into groups of 3. Fill one group of 3, then another, until none are left. You fill 4 groups.",
          "This finds the number of groups: 12 ÷ 3 = 4 again.",
          "Both ways use the same fact, 3 × 4 = 12. They are different only in which number you are looking for.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Two meanings of division",
        paragraphs: [
          "The answer to a division is called the quotient. It can be the size of each equal group, when you know the number of groups. Or it can be the number of groups, when you know the size of each. Both fit the same rule: total = number of groups × size of each group.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "30 stickers are shared equally by 5 friends. How many stickers does each friend get?",
      steps: [
        "You know the number of groups: 5 friends. You want the size of each share. So this is sharing.",
        "Deal the stickers in rounds. Each round gives every friend 1 and uses 5 stickers: 5, 10, 15, 20, 25, 30. That is 6 rounds.",
        "Each friend got one sticker per round, so each gets 6: 30 ÷ 5 = 6.",
      ],
      answer: "6",
    },
    pitfalls: [
      "Answer the question that was asked: the size of each group or the number of groups.",
      "Share equally. Every group must end with the same number.",
    ],
    parentGuide:
      "Share a handful of crackers among family members by dealing one at a time. Then put the same crackers into bags of a fixed size. Ask what each way of dividing found.",
  },
  {
    id: "times-table-patterns",
    title: "Patterns in the multiplication table",
    summary:
      "A multiplication table is a chart of times facts. Each row lists one number times 1, 2, 3 and so on. Moving one step along a row adds one more group. So a fact you know helps you find the next one.",
    templateIds: ["times-table-pattern"],
    senses: factSenses,
    objectives: [
      "Find a product, the answer to a multiplication, from the one beside it in the same row.",
      "Use doubled rows and added rows to find products.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Look for nearby facts",
        paragraphs: [
          "Say you know 3 groups of 7 make 21. One more group of 7 gives 4 groups of 7.",
          "So 4 groups of 7 make 21 + 7 = 28.",
          "Rows of a multiplication table grow in this steady way. So one fact you know helps with the next.",
        ],
      },
      {
        title: "Each row steps by its number",
        paragraphs: [
          "A row goes across, and a column goes down. Each box in the table is called a cell. The cell in the row for 3 and the column for 7 holds 3 × 7.",
          "Look at the picture. Moving one column right adds one more group of 3. So the row for 3 reads 12, 15, 18, 21, 24 as the columns go 4, 5, 6, 7, 8.",
          "So a product you do not know is the one on its left plus the row's number: 3 × 8 = 21 + 3 = 24.",
        ],
        illustration: "table-patterns",
      },
      {
        title: "Doubled rows and added rows",
        paragraphs: [
          "To double means to add a number to itself. Six groups are 3 groups and 3 more groups. So each product in the row for 6 is double the one in the row for 3: 6 × 7 = 21 + 21 = 42.",
          "Five groups are 2 groups and 3 more groups. So the row for 5 is the row for 2 plus the row for 3: 5 × 7 = 14 + 21 = 35.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Patterns from equal groups",
        paragraphs: [
          "Each step across a multiplication row adds one more group of the row's number. Doubling a factor, one of the numbers you multiply, doubles the product. Splitting a factor into two parts splits the product into two products that add up to it: $5 \\times 7 = 2 \\times 7 + 3 \\times 7$.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "Each product in the row for 8 is double the product above it, in the row for 4. 4 × 7 = 28. What is 8 × 7?",
      steps: [
        "8 groups of 7 are 4 groups of 7 and 4 more groups of 7.",
        "So 8 × 7 is double 4 × 7. Double 28: 28 + 28 = 56.",
        "So 8 × 7 = 56.",
      ],
      answer: "56",
    },
    pitfalls: [
      "Moving one column along a row adds the row's number, not 1. In the row for 3, 3 × 7 = 21 and 3 × 8 = 24.",
      "Double only when the factor doubles. The row for 6 is double the row for 3, but the row for 7 is not double any row.",
    ],
    parentGuide:
      "Write the rows for 2, 4 and 8, one under another. Ask the learner what each row does to the one before it. Then predict the next product before checking it.",
  },
];

export const factArrayMethods: Record<string, ProblemMethod> = {
  "multiply-facts": {
    goal: "Find the product of two one-digit numbers from a multiplication, an array or a story of equal rows.",
    intuition:
      "The sign × is read “times.” So 7 × 8 means 7 groups of 8. An array is objects set out in equal rows. The numbers you multiply are called factors. The answer is called the product. A one-digit number is a number from 0 to 9. To double means to add a number to itself.",
    terms: ["factor-number", "product-multiply", "array"],
    senses: factSenses,
    method: [
      "Read 7 × 8 as 7 rows of 8.",
      "Start from a fact you know. Times 2: double. Times 4: double twice. Times 5: half of times 10. Times 9: times 10, then take away one group.",
      "For 6, 7 or 8 rows, split off 5 rows. Find both parts and add them.",
    ],
    watch:
      "Turning the array swaps the factors but keeps the product: 3 × 8 = 8 × 3.",
  },
  "divide-facts": {
    goal: "Find the answer to a division within 100 from a multiplication fact.",
    intuition:
      "To divide means to split a total into equal groups. The sign ÷ is read “divided by.” In 56 ÷ 8 = 7, the number being split, 56, is called the dividend. The number you divide by, 8, is called the divisor. The answer, 7, is called the quotient. The box □ stands for a missing number. A factor is one of the numbers you multiply.",
    terms: ["dividend", "divisor", "quotient"],
    senses: factSenses,
    method: [
      "Write $n \\div d = \\boxed{\\phantom{0}}$ as $d \\times \\boxed{\\phantom{0}} = n$. Division undoes multiplication, so both ask for the same number.",
      "Find the missing factor from a fact you know, or skip-count by $d$: count $d$ at a time up to $n$.",
      "Check: divisor × quotient = dividend.",
    ],
    watch:
      "The quotient is the factor you were not given: in 56 ÷ 8 it is 7, not 8.",
  },
  "missing-factor-fact": {
    goal: "Find the number in the box in a multiplication or division sentence.",
    intuition:
      "The box □ stands for a missing number. A factor is one of the numbers you multiply. The answer to a multiplication is called the product. The sign ÷ means divided by: split into equal groups. To skip-count by 9 means to count 9 at a time: 9, 18, 27.",
    senses: factSenses,
    method: [
      "Write the sentence as a multiplication: $a \\times \\boxed{\\phantom{0}} = n$, $\\boxed{\\phantom{0}} \\times b = n$, or for $n \\div \\boxed{\\phantom{0}} = q$, $\\boxed{\\phantom{0}} \\times q = n$.",
      "Skip-count by the known factor up to $n$. Count the skips, because each skip is one more group.",
      "Put the number in the box and check that the sentence is true.",
    ],
    watch: "The box is a factor, never the total: in 6 × □ = 42 it is 7.",
  },
  "share-or-group": {
    goal: "Use a total and either the number of groups or the size of each group to find the other.",
    intuition:
      "To divide means to split a total into equal groups. Sharing is when you know how many groups, like 3 plates, and want how many go in each. Grouping is when you know how many go in each group, like teams of 4, and want how many groups. The sign ÷ is read “divided by.”",
    method: [
      "Decide what you know: the number of groups (sharing) or the size of each group (grouping).",
      "Sharing: deal one to each group per round and count the rounds. Grouping: fill groups of the given size and count the groups.",
      "Both are total ÷ the number you know. Check with a multiplication.",
    ],
    watch:
      "Answer the question asked: the size of each group or the number of groups.",
  },
  "times-table-pattern": {
    goal: "Find a missing product in part of a multiplication table, using a pattern.",
    intuition:
      "A multiplication table is a chart of times facts. A row goes across, and a column goes down. Each box is called a cell. A cell holds its row number times its column number. That answer is called the product. To double means to add a number to itself.",
    terms: [
      [
        "product-multiply",
        "The row for 6 lists the products 6 × 1, 6 × 2, 6 × 3, and so on.",
      ],
    ],
    senses: factSenses,
    method: [
      "Name the cell: its row number times its column number.",
      "Use a pattern. Add the row number to the cell on the left. Or double the row for half the number. Or add two rows whose numbers add to this row's number.",
      "Check by multiplying the row number by the column number.",
    ],
    watch: "One column to the right adds the row's number, not 1.",
  },
};

export const factArrayPrinciples: Record<string, string> = {
  "multiply-facts":
    "The order of the factors does not change the product: 3 × 8 = 8 × 3. Splitting a factor splits the product into parts that add up to it: (5 + 2) × 8 = 5 × 8 + 2 × 8.",
  "divide-facts":
    "Division undoes multiplication: $n \\div d = q$ exactly when $d \\times q = n$. The divisor $d$ is never 0.",
  "missing-factor-fact":
    "A missing factor or divisor comes from the matching multiplication: $a \\times \\boxed{\\phantom{0}} = n$ and $n \\div \\boxed{\\phantom{0}} = q$ each ask for a number that multiplies to make $n$.",
  "share-or-group":
    "$n \\div d$ answers both questions: how many are in each of $d$ equal groups, and how many groups of $d$ make $n$. Both work because $d \\times q = q \\times d$.",
  "times-table-pattern":
    "One more group adds the row's number: $a \\times (c + 1) = a \\times c + a$. Doubling a factor doubles the product: $(2 \\times a) \\times c = 2 \\times (a \\times c)$. Splitting a factor adds two products: $(a + b) \\times c = a \\times c + b \\times c$.",
};
