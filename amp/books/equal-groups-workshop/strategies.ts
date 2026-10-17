import { Author, array, diagram, note, text, worked } from "./authoring.js";
export function strategies(a: Author) {
  const task = a.task.bind(a);
  a.section = "strategies";
  a.page("twos-fives-tens", "Build a small set of strong anchors", [
    diagram({
      kind: "double-line",
      id: "anchors-lines",
      topLabel: "packs",
      bottomLabel: "cards",
      pairs: [
        { top: [0, 1], bottom: [0, 1] },
        { top: [2, 1], bottom: [14, 1] },
        { top: [5, 1], bottom: [35, 1] },
        { top: [10, 1], bottom: [70, 1] },
      ],
      caption:
        "Each pack holds seven cards. Doubling the pack count doubles the card count.",
      alt: "Aligned number lines connect zero packs to zero cards, two to fourteen, five to thirty-five, and ten to seventy.",
    }),
    text(
      "Facts you know well can support facts you are building. Twos connect to doubles. Tens connect to place value. Five equal groups are half of ten equal groups.",
    ),
    task(
      "anchors-products",
      "Find 2 × 7, 5 × 7, and 10 × 7. Explain how two of the products are related.",
      "14, 35, 70.",
      "For example, ten groups are twice as many groups as five. Doubling thirty-five gives seventy. The group size stays seven.",
      undefined,
      "medium",
    ),
    task(
      "anchors-half",
      "If 10 × 8 = 80, how can that help you find 5 × 8?",
      "5 × 8 = 40.",
      "Five groups of eight are half of ten groups of eight. Half of eighty is forty.",
      "40 + 40 = 80.",
      "short",
    ),
  ]);
  a.page("double", "Double the groups. Keep the size.", [
    array(
      "double-array",
      4,
      6,
      "Two rows of six make 12. A second matching pair of rows makes 24.",
      { row: 2 },
    ),
    text(
      "If 2 × 6 is 12, then 4 × 6 is twice 12. Double the number of groups while keeping the number in each group fixed.",
    ),
    task(
      "double-four",
      "Use 2 × 7 = 14 to find 4 × 7. Show the connection.",
      "28.",
      "Four groups of seven can be separated into two groups of seven and another two groups of seven: 14 + 14 = 28.",
      undefined,
      "medium",
    ),
    task(
      "double-eight",
      "Use 4 × 7 to find 8 × 7. Then explain why doubling both factors of 4 × 7 would not merely double its product.",
      "8 × 7 = 56. Doubling both factors gives 8 × 14 = 112.",
      "Doubling only the group count doubles twenty-eight to fifty-six. Doubling the group size as well doubles fifty-six again. The result is four times twenty-eight.",
      undefined,
      "medium",
    ),
  ]);
  a.page("split-five", "Keep the groups. Split the work.", [
    array(
      "split-five-array",
      7,
      6,
      "Seven rows become five rows and two rows: 30 + 12 = 42.",
      { row: 5 },
    ),
    text(
      "A split does not change the array. It helps you use products you know. Every row must be counted once: 7 × 6 = (5 × 6) + (2 × 6). This is the distributive property.",
    ),
    task(
      "split-seven",
      "Use five groups and two groups to find 7 × 8.",
      "56.",
      "Five groups of eight contribute forty; two groups of eight contribute sixteen. Together they make fifty-six.",
      "(5 + 2) × 8 = 40 + 16.",
      "medium",
    ),
    task(
      "split-repair",
      "A learner writes 7 × 6 = 5 × 6 + 2. What did the learner forget? Repair the equation.",
      "7 × 6 = 5 × 6 + 2 × 6 = 42.",
      "The two remaining rows contain six objects each. Adding only two counts the rows but not the objects in them.",
      undefined,
      "medium",
    ),
  ]);
  a.page("nines", "Ten groups, with one group removed", [
    array(
      "nines-array",
      9,
      6,
      "Imagine one more row of six. Ten rows would contain 60; remove that extra row to return to 54.",
    ),
    text(
      "Nine groups are one group fewer than ten. The amount removed is a whole group, not one item: 9 × 6 = 10 × 6 − 1 × 6.",
    ),
    task(
      "nine-six",
      "Find 9 × 6 using ten groups. What exactly do you subtract?",
      "54; subtract 6 from 60.",
      "Ten groups of six contain sixty. Removing one group removes six objects.",
      "54 + 6 = 60.",
      "short",
    ),
    task(
      "nine-eight",
      "A learner says 9 × 8 = 80 − 1 = 79. Explain the error and correct the answer.",
      "9 × 8 = 80 − 8 = 72.",
      "One fewer group means eight fewer objects. Subtracting one removes a single object instead of a full group.",
      undefined,
      "medium",
    ),
  ]);
  a.page("associative", "Groups inside groups", [
    array(
      "associative-array",
      6,
      4,
      "Two crates each hold three bags. Each bag has four beads. The dividing line separates the crates.",
      { row: 3 },
      { row: "6 bags", column: "4 beads per bag" },
    ),
    worked(
      "Choose what to count first",
      "How many beads are in both crates?",
      [
        "Count bags first: 2 × 3 = 6 bags, then 6 × 4 = 24 beads.",
        "Or count one crate first: 3 × 4 = 12 beads, then 2 × 12 = 24 beads.",
      ],
      "(2 × 3) × 4 = 2 × (3 × 4). The grouping of the factors changes; the total does not.",
    ),
    task(
      "associate-total",
      "Explain what 6 and 12 count in the two methods above.",
      "6 counts bags; 12 counts beads in one crate.",
      "The intermediate products have different meanings. Keeping their units clear explains why multiplying by the remaining factor gives twenty-four beads.",
      undefined,
      "short",
    ),
    task(
      "associate-change",
      "Three boxes each contain 2 packs of 5 cards. Find the total in two ways.",
      "30 cards: (3 × 2) × 5 or 3 × (2 × 5).",
      "Six packs of five make thirty. Alternatively, each box contains ten cards, and three boxes contain thirty.",
      undefined,
      "medium",
    ),
  ]);
  a.page("choose-strategy", "Choose a fact that helps", [
    worked(
      "Two paths to 8 × 7",
      "Which path is easier for you to explain?",
      [
        "Double four groups: 4 × 7 = 28, so 8 × 7 = 28 + 28 = 56.",
        "Split each group: 8 × 7 = 8 × 5 + 8 × 2 = 40 + 16 = 56.",
      ],
      "Both paths preserve eight groups of seven. Choose a path you can justify.",
    ),
    note(
      "A strategy is more than a slogan",
      "“I split it” is a start. Say what you split, which products you used, and why every item is counted once.",
      "notice",
    ),
    task(
      "strategy-choose",
      "Find 6 × 8 with a method you choose. Explain why it works.",
      "48. One method is 5 × 8 + 1 × 8 = 40 + 8.",
      "A valid explanation preserves six equal groups of eight. Doubling three groups of eight or another correct decomposition also works.",
      undefined,
      "extended",
      "blank",
    ),
    task(
      "strategy-counter",
      "Repair this claim: 6 × 8 = 6 × 5 + 3 = 33.",
      "6 × 8 = 6 × 5 + 6 × 3 = 48.",
      "Each of the six groups has three items beyond its first five. The leftover part is six groups of three, not three items altogether.",
      undefined,
      "short",
    ),
  ]);
  a.page("area-units", "When the cells measure area", [
    array(
      "area-unit-grid",
      4,
      5,
      "Each cell is one square unit. Four rows of five unit squares cover 20 square units.",
      undefined,
      { row: "4 units high", column: "5 units wide" },
    ),
    text(
      "Area measures how much surface is covered. A unit square has side lengths of one unit. Cover the region without gaps or overlaps; count each unit square once. The side lengths are measured in units, but the area is measured in square units.",
    ),
    task(
      "area-count",
      "Draw a rectangle 3 units high and 6 units wide. Show unit squares and find its area.",
      "18 square units.",
      "Three rows of six unit squares cover the rectangle. The product 3 × 6 counts those squares.",
      undefined,
      "large",
      "grid",
    ),
    task(
      "area-unit",
      "Why is “18 units” incomplete as an area answer? Does 3 + 6 measure this rectangle’s area?",
      "Area is 18 square units. The sum 3 + 6 = 9 does not measure area.",
      "The product counts two-dimensional unit squares. Adding one height and one width counts neither the covering squares nor the full boundary.",
      undefined,
      "short",
    ),
  ]);
  a.page("split-area", "A split that preserves the whole surface", [
    array(
      "area-split-grid",
      6,
      7,
      "A 6-by-7 rectangle splits into a 6-by-5 region and a 6-by-2 region.",
      { column: 5 },
      { row: "6 units high", column: "7 units wide" },
    ),
    text(
      "The regions do not overlap, and together they cover the original rectangle. Their areas can be added: 6 × 7 = 6 × 5 + 6 × 2 = 30 + 12 = 42 square units.",
    ),
    task(
      "area-split",
      "Split a 4-by-9 rectangle into widths of 5 and 4. Find each area and the total.",
      "20 and 16 square units; total 36 square units.",
      "Both pieces have height four. Their widths five and four add to nine, so the two areas exactly cover the rectangle.",
      undefined,
      "medium",
      "grid",
    ),
    task(
      "area-explain",
      "Why could adding two overlapping regions give the wrong area?",
      "The overlap would be counted twice.",
      "Adding separate region areas works when they cover the whole figure without gaps or overlap. If they overlap, the shared cells belong to both counts.",
      undefined,
      "medium",
    ),
  ]);
  a.page("tens", "Carry the strategy into tens", [
    array(
      "tens-array",
      4,
      12,
      "Four groups of twelve split into four groups of ten and four groups of two.",
      { column: 10 },
    ),
    text(
      "Twelve is ten and two. So 4 × 12 = 4 × 10 + 4 × 2 = 40 + 8 = 48. The same place-value reasoning can help with larger numbers; you do not need to draw every cell.",
    ),
    task(
      "tens-product",
      "Find 23 × 4 by separating tens and ones. Label the two partial products.",
      "92; 20 × 4 = 80 and 3 × 4 = 12.",
      "Turn the factors: 23 × 4 = 4 × 23. Each of four groups has two tens and three ones. The four groups contain eighty plus twelve, or ninety-two.",
      undefined,
      "medium",
    ),
    task(
      "tens-repair",
      "A learner writes 23 × 4 = 20 × 4 + 3 = 83. Explain why every part of 23 must be multiplied.",
      "The correct result is 80 + 12 = 92.",
      "There are four copies of all twenty-three, including the three extra ones in each copy. Adding three counts those ones in only one copy.",
      undefined,
      "medium",
    ),
  ]);
  a.page(
    "strategy-workshop",
    "Choose a route through the workshop",
    [
      task(
        "strategy-estimate",
        "Nine packs contain 8 tags each. Estimate using ten packs, then find the exact total. Explain the difference.",
        "About 80 tags; exactly 72.",
        "Ten packs would contain eighty tags. Nine packs have one fewer group of eight, so the exact count is eight less.",
        undefined,
        "medium",
      ),
      task(
        "strategy-model",
        "Draw a split for 6 × 7 that differs from five groups plus one group. Use it to find the product.",
        "42. Example: three groups plus three groups gives 21 + 21.",
        "Any disjoint split that preserves the original six-by-seven array is valid. Splitting each group into four and three gives 24 + 18.",
        undefined,
        "large",
        "grid",
      ),
      task(
        "strategy-transfer",
        "Four trays hold 12 tiles each. Find the total using a method you can explain.",
        "48 tiles.",
        "For example, double twelve to twenty-four for two trays, then double again for four. A place-value split gives 40 + 8.",
        undefined,
        "short",
      ),
    ],
    "workshop",
  );
  a.page(
    "fluency-routine",
    "Build recall with understanding",
    [
      text(
        "Try a few facts from memory. If one is uncertain, use a model or a related fact. Then cover the explanation and try the fact again later. A correct answer with a strategy and a remembered answer are both useful; they tell you different things.",
      ),
      task(
        "recall-one",
        "Try 3 × 4, 5 × 8, 2 × 9, 7 × 6, and 9 × 7. Put a small mark beside any fact for which you used a strategy.",
        "12, 40, 18, 42, 63.",
        "Examples of useful anchors are five groups, doubles, and ten groups minus one. The mark records your approach; it is not a penalty.",
        undefined,
        "medium",
      ),
      task(
        "recall-explain",
        "Choose one uncertain fact. Explain a strategy, then write a reminder that will help you reconstruct it tomorrow.",
        "Answers vary. Example: 7 × 6 = 5 × 6 + 2 × 6 = 30 + 12 = 42.",
        "The reminder must preserve the quantities and connect to a fact the learner knows. A small split array can be more useful than a long sentence.",
        undefined,
        "large",
        "blank",
      ),
      note(
        "Return without a stopwatch",
        "A short mixed set on another day gives better evidence of lasting recall than repeating the same fact many times in one sitting. This page alone does not establish mastery of every fact.",
      ),
    ],
    "workshop",
  );
}
