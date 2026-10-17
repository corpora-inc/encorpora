import { Author, note, text, worked } from "./authoring.js";
export function transfer(a: Author) {
  const task = a.task.bind(a);
  a.section = "transfer";
  a.page("two-step", "Keep track of what changes", [
    worked(
      "Packed and loose",
      "Three packs contain 6 tags each. Four more tags are loose. How many tags are there?",
      [
        "First count the packed tags: 3 × 6 = 18.",
        "Then include the loose tags: 18 + 4 = 22.",
      ],
      "The expression 3 × 6 + 4 describes the two actions.",
    ),
    task(
      "steps-total",
      "Five bags each contain 7 beads. Three extra beads are loose. How many beads are there altogether?",
      "38 beads.",
      "Five equal groups contribute thirty-five. The three loose beads are added once, giving thirty-eight.",
      "38 is three more than 5 × 7.",
      "large",
    ),
    task(
      "steps-share",
      "There are 36 cards. Keep 8 for a demonstration, then share the rest equally among 4 people. How many cards does each person receive? Write an equation.",
      "7 cards per person; (36 − 8) ÷ 4 = 7.",
      "First remove the eight reserved cards. The remaining twenty-eight are shared among four people. Parentheses show that subtraction happens before division.",
      "4 × 7 + 8 = 36.",
      "large",
    ),
    note(
      "Does the size make sense?",
      "The second answer must be smaller than sharing all 36 cards among four people. Seven is less than nine. Use a comparison like this to catch an unreasonable result.",
    ),
  ]);
  a.page(
    "unknown-story-workshop",
    "Write the relationship before solving",
    [
      text(
        "A letter can stand for a quantity we do not know yet. If p is the bead count in one pack, four equal packs contain 4 × p beads. Adding three loose beads gives 4 × p + 3.",
      ),
      task(
        "story-unknown",
        "Four equal packs and 3 loose beads contain 27 beads altogether. Let p be the number of beads in one pack. Write an equation and solve it.",
        "4 × p + 3 = 27; p = 6 beads per pack.",
        "Remove the three loose beads from the total, leaving twenty-four in four packs. Divide by four to get six in each pack.",
        undefined,
        "extended",
        "blank",
      ),
      task(
        "story-check",
        "Check your answer in the original story. Would a total of 26 beads fit the same rule with a whole number of beads in each equal pack?",
        "4 × 6 + 3 = 27. A total of 26 would not fit.",
        "With twenty-six total, removing three leaves twenty-three. Twenty-three cannot be divided into four equal whole-number counts without leftovers.",
        undefined,
        "medium",
      ),
    ],
    "workshop",
  );
  a.page(
    "mixed-workshop",
    "Choose the operation yourself",
    [
      text(
        "No heading will tell you which operation to use. Name what is known and what the answer should count.",
      ),
      task(
        "mixed-choice",
        "Find each missing amount: 8 boxes with 9 tiles each; 63 tiles packed 7 per box; 63 tiles shared equally among 9 boxes. Include units.",
        "72 tiles; 9 boxes; 7 tiles per box.",
        "The first question asks for a total, so multiply. The second asks for a group count, so divide by the group size. The third asks for a group size, so divide by the group count.",
        undefined,
        "extended",
      ),
      task(
        "mixed-missing",
        "“Twenty-four tiles are arranged into several equal displays. How many tiles are in each display?” Can you give one definite answer? Explain what information is missing and show two possibilities.",
        "No. The number of displays is missing. Examples: 3 displays of 8 tiles or 4 displays of 6 tiles.",
        "Both arrangements use twenty-four tiles and have equal groups. Different valid group counts give different group sizes, so the stated facts do not determine one answer.",
        undefined,
        "extended",
        "blank",
      ),
    ],
    "workshop",
  );
  a.page(
    "kit-design",
    "Design identical kits",
    [
      text(
        "The workshop has 40 stickers and 24 pencils. Make between 4 and 8 identical kits, including 4 or 8 as possibilities. Use every sticker and pencil. Each kit must have the same sticker count and the same pencil count.",
      ),
      task(
        "kit-plans",
        "Make a table with rows for 4, 5, 6, 7, and 8 kits. In each row, check both supplies. Find every possible plan and give the stickers and pencils per kit. Mark why each other count fails.",
        "4 kits: 10 stickers and 6 pencils each. 8 kits: 5 stickers and 3 pencils each.",
        "Four and eight divide both inventories exactly. Five fails for pencils; six fails for stickers; seven fails for both. Those checks exhaust the allowed counts.",
        undefined,
        "extended",
        "grid",
      ),
      task(
        "kit-change",
        "Add one rule: each kit must have at least 4 pencils. Which plan works? Explain why the other plan fails.",
        "Only the 4-kit plan works.",
        "Four kits contain six pencils each, meeting the minimum. Eight kits contain only three pencils each, below the required four.",
        undefined,
        "large",
      ),
      note(
        "A design must meet every rule",
        "A plan that works for stickers but not pencils is unfinished. A plan that uses all supplies but misses the minimum per kit also fails.",
      ),
    ],
    "workshop",
  );
  a.page(
    "delayed-return",
    "Return after a break",
    [
      text(
        "Save this page for another day, after working on something else. Try the mixed questions before looking at your earlier methods.",
      ),
      task(
        "return-facts",
        "Find 8 × 6, 54 ÷ 9, 7 × 7, and 0 ÷ 3. Mark any answer you reconstructed with a strategy.",
        "48, 6, 49, 0.",
        "Examples: double 4 × 6; use 9 × 6 = 54; split 7 × 7 into 5 × 7 + 2 × 7; share zero among three. A strategy mark describes the method, not an error.",
        undefined,
        "medium",
      ),
      task(
        "return-remainder",
        "Twenty-six people need rides in boats with room for 8 people each. How many boats are needed? Explain why a remainder changes the decision.",
        "4 boats.",
        "Three boats seat twenty-four, leaving two people. A fourth boat is needed even though it is not full.",
        "3 × 8 < 26 and 4 × 8 ≥ 26.",
        "medium",
      ),
      task(
        "return-reason",
        "Explain why 8 × 7 = 8 × 5 + 8 × 2. What must a matching array show?",
        "Both expressions equal 56. The array has eight rows split into widths five and two.",
        "Every row of seven is split into five cells and two cells. The regions are disjoint and cover all eight rows. Their counts are forty and sixteen.",
        undefined,
        "medium",
      ),
    ],
    "workshop",
  );
  a.page(
    "reflection",
    "What changed in your thinking?",
    [
      task(
        "reflect-model",
        "Choose a question from the book. Show it with words, a picture, and an equation. Label what every number counts.",
        "Answers vary. Example: four bags of six beads, four drawn groups of six, and 4 × 6 = 24 beads.",
        "The story, model, and equation must agree on group count, group size, total, and units. A consistent alternate orientation is valid.",
        undefined,
        "extended",
        "blank",
      ),
      task(
        "reflect-error",
        "Invent a believable wrong answer to your question. Explain the mistake kindly, then give a hint that helps someone repair it.",
        "Example: “4 + 6 = 10 beads” confuses adding two counts with counting four equal groups.",
        "An effective response identifies the reason for the error and offers a useful next action, such as drawing all four bags. Merely saying “wrong operation” is less informative.",
        undefined,
        "extended",
      ),
      note(
        "Keep a useful idea",
        "Tell someone one model you want to remember. Understanding includes noticing when a model fits, when it does not, and when a different representation helps.",
      ),
    ],
    "reflection",
  );
  a.page(
    "adult-guide",
    "Support the thinking, not just the answer",
    [
      text(
        "Read aloud when needed. Offer counters and let the learner arrange them. Ask “What does this number count?” before asking for a faster answer. Keep the grade-two entry within small arrays and pairing counts; later sections deliberately extend the number range and reasoning.",
      ),
      text(
        "Accept a different orientation or strategy when its labels and quantities agree. A learner may use columns as groups, speak instead of write, or draw an efficient sketch rather than a polished picture. Check mathematical meaning separately from handwriting and reading.",
      ),
      text(
        "Separate four kinds of evidence: using a model correctly, explaining a strategy, recalling a fact independently, and applying it in an unfamiliar context. One worksheet cannot establish all four. Try a small mixed set on another day and ask for an explanation of an uncertain item.",
      ),
      text(
        "When an error appears, choose a brief useful detour. Confusing group size with group count calls for the sharing and grouping pages. Counting marks instead of intervals calls for the jump page. Treating every remainder the same calls for the kits, seats, and divisible-material comparison.",
      ),
      text(
        "The book provides a grade-three multiplication/division core with selected grade-two entry and grade-four extensions. It does not cover a full grade-level curriculum, all multi-digit algorithms, every factor pair through 100, or every possible word-problem form. The fraction connection is a bridge to separate fraction instruction.",
      ),
      note(
        "Keep the learner in the conversation",
        "Ask which representation helped and which felt awkward. Offer a choice of two useful next activities. Interleave other mathematics and revisit these relationships; repeated success on one narrow format is not the same as flexible understanding.",
      ),
    ],
    "guide",
  );
}
