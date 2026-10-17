import { Author, array, diagram, note, text, worked } from "./authoring.js";
export function meaning(a: Author) {
  const task = a.task.bind(a);
  a.page(
    "welcome",
    "The Equal Groups Workshop",
    [
      text(
        "A community workshop is opening its doors. Visitors will build tile pictures, pack supply kits, and share materials. You can help by asking useful questions: How many altogether? How many in each group? How many groups can we make?",
      ),
      array(
        "welcome-array",
        3,
        4,
        "Three trays hold four buttons each. One picture can help answer several questions.",
      ),
      note(
        "Build. Break apart. Share.",
        "Make a prediction. Arrange objects or draw. Explain what each number counts. Then check whether your answer fits the question.",
      ),
      text(
        "Bring a pencil and some small objects, such as counters or buttons. You can speak your ideas, move objects, sketch, or write. A partner may read aloud; the mathematical thinking belongs to you.",
      ),
    ],
    "opening",
    "Multiplication and division through models, strategies, and useful decisions",
  );
  a.page(
    "route",
    "Choose a useful starting point",
    [
      text(
        "1 · BUILD MEANING. Begin with equal groups, pairs, and small arrays. These entry activities suit learners who can add small groups, including many second graders. Try the entry page with real objects.",
      ),
      text(
        "2 · CONNECT STRATEGIES. Turn arrays, split them, double useful facts, and connect multiplication with area. This is the grade-three core: understand products and quotients within 100 while building reliable recall.",
      ),
      text(
        "3 · FIND THE MISSING QUANTITY. Compare sharing with making groups of a chosen size. Use multiplication to explain and check division.",
      ),
      text(
        "4 · MAKE DECISIONS. Explore remainders, multiplicative comparisons, and factors. These selected grade-four extensions do not replace a full grade-four course. The length-sharing connection uses fractions and may be saved for later.",
      ),
      text(
        "5 · MIX AND RETURN. Workshops combine ideas without naming the operation for you. Save the delayed-return page for another day. An uncertain answer points toward a useful model, not a fixed label for your ability.",
      ),
      note(
        "Use the route flexibly",
        "Try a workshop first if a section feels familiar. If an explanation helps, use it and then try a fresh example. Change strands and return later; you do not need to repeat one topic until every response is quick.",
      ),
    ],
    "guide",
  );
  a.page(
    "entry",
    "Show what you already know",
    [
      text(
        "Try these without a timer. Use counters if you like. Ask someone to read aloud if reading gets in the way.",
      ),
      task(
        "entry-groups",
        "Three bags have 4 counters in each. Show the groups and find the total. Record an addition equation.",
        "12 counters; 4 + 4 + 4 = 12.",
        "Three equal groups contain four counters each. Count each counter once. A drawing may use circles, rows, or another clearly labeled arrangement.",
        "The total is greater than one bag of 4 and less than four bags of 4.",
        "extended",
        "blank",
      ),
      task(
        "entry-share",
        "Share 12 counters equally among 3 trays. Show how you know the sharing is fair.",
        "4 counters on each tray.",
        "Give each tray one counter at a time, or arrange three equal rows of four. Equal means every tray has the same count.",
        "4 + 4 + 4 uses all 12 counters.",
        "extended",
        "blank",
      ),
    ],
    "workshop",
  );
  a.section = "meaning";
  a.page("equal-groups", "What makes groups equal?", [
    text(
      "Four trays each hold 3 buttons. The groups have the same number of buttons, so we can count by threes: 3, 6, 9, 12. Multiplication describes equal groups.",
    ),
    array(
      "equal-groups-array",
      4,
      3,
      "Four equal groups of three contain 12 buttons.",
    ),
    note(
      "Look inside the groups",
      "Bags with 3, 3, and 4 buttons are not three equal groups of three. The number of bags alone does not tell us the total.",
      "misconception",
    ),
    task(
      "groups-total",
      "Five trays have 2 buttons each. How many buttons are there? Explain using equal groups.",
      "10 buttons.",
      "The equal-group sum is 2 + 2 + 2 + 2 + 2 = 10. Five groups of two is 5 × 2.",
      "Pairing the buttons gives five pairs.",
    ),
    task(
      "groups-repair",
      "A learner says bags with 3, 3, and 4 buttons contain 3 × 3 = 9 buttons. Repair the claim.",
      "There are 10 buttons: 3 + 3 + 4 = 10.",
      "The third bag has an extra button. You can also use 3 × 3 + 1 = 10. Three unequal groups cannot all be counted as groups of three.",
      undefined,
      "short",
    ),
  ]);
  a.page("pairs", "Can every counter find a partner?", [
    text(
      "Pairing helps us see even and odd counts. An even count can be arranged in pairs with none left. It can also be split into two equal whole-number counts.",
    ),
    diagram({
      kind: "groups",
      id: "pairs-model",
      wholeLabel: "one counter",
      total: [15, 1],
      groupSize: [2, 1],
      unitDivisions: 1,
      caption:
        "Fifteen counters make seven complete pairs and one unpaired counter.",
      alt: "Fifteen equal counters grouped in pairs; seven pairs are complete and one counter remains.",
    }),
    worked(
      "Make two equal teams",
      "What happens with 16 counters?",
      [
        "Make 8 pairs. Give one counter from each pair to each team.",
        "Each team gets 8 counters, so 16 = 8 + 8.",
      ],
      "Sixteen is even.",
    ),
    task(
      "pairs-even",
      "Is 18 even? Explain with pairs and an equation using two equal addends.",
      "Yes; 18 makes 9 pairs and 18 = 9 + 9.",
      "Give one member of each of nine pairs to each of two groups. Both groups contain nine counters.",
      undefined,
      "short",
    ),
    task(
      "pairs-odd",
      "What goes wrong when you try to split 17 counters into two equal whole-number counts?",
      "There are 8 pairs and 1 counter left over.",
      "Two groups of eight use sixteen counters. Giving the last whole counter to only one group makes the counts unequal.",
      "8 + 9 = 17, but the addends are unequal.",
      "short",
    ),
  ]);
  a.page("array", "Rows are groups you can see", [
    array(
      "array-four-five",
      4,
      5,
      "An array keeps rows and columns lined up. Each of these four rows contains five cells.",
    ),
    text(
      "Rows run across. Columns run up and down. Count by rows: 5 + 5 + 5 + 5 = 20. Count by columns: 4 + 4 + 4 + 4 + 4 = 20. Both methods count every cell once.",
    ),
    task(
      "array-rows",
      "Draw 3 rows of 5 dots. Find the total and write the sum that counts by rows.",
      "15 dots; 5 + 5 + 5 = 15.",
      "Each of three rows contributes five dots. Other orientations are acceptable if the rows and counts are labeled consistently.",
      undefined,
      "large",
      "grid",
    ),
    task(
      "array-columns",
      "Use your same drawing. Write the sum that counts by columns. Why does the total stay the same?",
      "3 + 3 + 3 + 3 + 3 = 15.",
      "There are five columns of three. Changing how you group the dots does not add or remove dots.",
      undefined,
      "short",
    ),
  ]);
  a.page("symbols", "Give each number a job", [
    array(
      "symbols-array",
      3,
      4,
      "3 × 4 = 12: three groups, four buttons in each group, twelve buttons altogether.",
    ),
    text(
      "The numbers multiplied are factors. Their result is the product. In our group stories, the first factor counts groups and the second counts items in each group. A model may use rows or columns as groups; labels tell you which. Other conventions can work when the roles are explained.",
    ),
    task(
      "symbols-story",
      "Write or tell a story for 4 × 5 = 20. Name what 4, 5, and 20 count.",
      "Example: 4 trays hold 5 buttons each, for 20 buttons.",
      "The story needs four equal groups with five items per group. The result must count all twenty items. Accept another context with these roles.",
      undefined,
      "medium",
    ),
    task(
      "symbols-unknown",
      "Six bags hold 24 beads altogether, with the same number in every bag. What is missing: the number of bags or the beads per bag? Find it.",
      "The beads per bag are missing: 4 beads per bag.",
      "There are already six bags. Six equal groups of four use all twenty-four beads.",
      "6 × 4 = 24.",
    ),
  ]);
  a.page("turn", "Turn the array. Keep the total.", [
    array(
      "turn-array",
      3,
      4,
      "Turn this page a quarter turn: three rows of four become four rows of three.",
    ),
    text(
      "No cells appear or disappear when an array turns. That is why 3 × 4 and 4 × 3 have the same product. This is the commutative property of multiplication.",
    ),
    task(
      "turn-product",
      "You know 3 × 7 = 21. What is 7 × 3? Explain without recounting all the objects.",
      "21.",
      "Rotating an array of three rows of seven makes seven rows of three. The same twenty-one objects are present.",
      undefined,
      "medium",
    ),
    task(
      "turn-story",
      "Are 3 bags with 7 beads each and 7 bags with 3 beads each the same packing plan? Explain what stays the same and what changes.",
      "The total stays 21 beads, but the packing plans differ.",
      "The first plan uses three bags with seven in each; the second uses seven bags with three in each. Equal products do not make the roles of the quantities identical.",
      undefined,
      "medium",
    ),
  ]);
  a.page("jumps", "Count the jumps, not the landing marks", [
    diagram({
      kind: "number-line",
      id: "jumps-five-line",
      wholeLabel: "distance in steps",
      min: [0, 1],
      max: [20, 1],
      divisionsPerUnit: 1,
      integerLabelInterval: 5,
      marks: [
        { at: [0, 1], label: "0" },
        { at: [5, 1], label: "5" },
        { at: [10, 1], label: "10" },
        { at: [15, 1], label: "15" },
        { at: [20, 1], label: "20" },
      ],
      jumps: [
        { from: [0, 1], to: [5, 1], label: "+5" },
        { from: [5, 1], to: [10, 1], label: "+5" },
        { from: [10, 1], to: [15, 1], label: "+5" },
        { from: [15, 1], to: [20, 1], label: "+5" },
      ],
      caption:
        "Four equal jumps of five reach 20. The starting mark is not a jump.",
      alt: "A number line from zero to twenty with four successive jumps of five.",
    }),
    text(
      "Multiplication can describe equal lengths as well as objects. Here 4 counts jumps, 5 measures each jump, and 20 measures the total distance.",
    ),
    task(
      "jumps-count",
      "Sketch three jumps of 4, starting at 0. Where do you finish? Label the landings.",
      "12; the landings are 4, 8, and 12.",
      "Each jump adds four. The start is zero, followed by three landings.",
      undefined,
      "large",
      "blank",
    ),
    task(
      "jumps-repair",
      "A line has marks at 0, 3, 6, 9, and 12. A learner sees five marks and says there are five jumps of 3. Repair the explanation.",
      "There are four jumps of 3, totaling 12.",
      "Five endpoint marks enclose four intervals. Count the spaces from one mark to the next, not all the marks.",
      undefined,
      "short",
    ),
  ]);
  a.page("zero-one", "One group and no groups", [
    worked(
      "Two ways to make eight",
      "Compare 1 × 8 and 8 × 1.",
      [
        "One tray with eight buttons contains eight buttons.",
        "Eight trays with one button each also contain eight buttons.",
      ],
      "Multiplying by one keeps the other factor as the product.",
    ),
    text(
      "Zero groups of eight buttons contain no buttons. Eight empty groups also contain no buttons. The stories are different, but both totals are zero. Multiplication by zero is not the same action as adding zero.",
    ),
    task(
      "zero-products",
      "Find 1 × 8, 8 × 1, 0 × 8, and 8 × 0. Tell a different story for each zero product.",
      "8, 8, 0, 0.",
      "For 0 × 8, there are no trays of eight. For 8 × 0, there are eight empty trays. Neither situation contains a button.",
      undefined,
      "medium",
    ),
    task(
      "zero-not-add",
      "Explain why 5 × 0 = 0 but 5 + 0 = 5.",
      "Five empty groups contain zero items; adding no items to five leaves five.",
      "In multiplication, five counts empty groups. In addition, five is an amount already present. The operation changes what the numbers do.",
      undefined,
      "medium",
    ),
  ]);
  a.page(
    "meaning-workshop",
    "Build a model that convinces someone",
    [
      text(
        "Choose a representation before calculating. Use objects, words, pictures, and equations together.",
      ),
      task(
        "meaning-draw",
        "Show 4 × 3 in two different ways. Explain how both show the same total.",
        "12; examples include four groups of three and four jumps of three.",
        "Both representations must count four equal groups or lengths of three. A labeled rotated array is also valid.",
        undefined,
        "extended",
        "blank",
      ),
      task(
        "meaning-choose",
        "Six boxes hold 4 buttons each. Choose 6 + 4 or 6 × 4 and explain why the other expression does not answer the question.",
        "6 × 4 = 24 buttons.",
        "Six is the box count and four is the count per box. Adding the unlike roles gives ten but does not count all the buttons.",
        undefined,
        "medium",
      ),
      task(
        "meaning-change",
        "Start with 4 groups of 3. Add one more group of 3. What is the new total, and how much did it increase?",
        "15; it increased by 3.",
        "The starting total is twelve. One additional group contributes three objects, not one.",
        undefined,
        "short",
      ),
    ],
    "workshop",
  );
}
