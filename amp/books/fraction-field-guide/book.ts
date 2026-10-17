import type { BookBlock, BookPage, Diagram, FractionBook } from "./schema.js";

const keys: Record<string, Extract<BookBlock, { kind: "solution" }>[]> = {};
let chapter = "entry";
const text = (value: string): BookBlock => ({ kind: "text", text: value });
const note = (
  title: string,
  value: string,
  tone: "notice" | "predict" | "misconception" | "connect" = "notice",
): BookBlock => ({ kind: "callout", tone, title, text: value });
const diagram = (value: Diagram): BookBlock => ({
  kind: "diagram",
  diagram: value,
});
const worked = (
  title: string,
  prompt: string,
  steps: string[],
  conclusion: string,
): BookBlock => ({ kind: "worked", title, prompt, steps, conclusion });
function task(
  id: string,
  prompt: string,
  answer: string,
  reasoning: string,
  check?: string,
  size: "short" | "medium" | "large" = "medium",
  response: "lines" | "grid" | "blank" = "lines",
): BookBlock {
  (keys[chapter] ??= []).push({
    kind: "solution",
    taskId: id,
    answer,
    reasoning,
    ...(check ? { check } : {}),
  });
  return { kind: "task", id, prompt, response: { kind: response, size } };
}
const page = (
  id: string,
  eyebrow: string,
  title: string,
  blocks: BookBlock[],
  kind: BookPage["kind"] = "lesson",
  subtitle?: string,
): BookPage => ({
  id,
  kind,
  eyebrow,
  title,
  blocks,
  ...(subtitle ? { subtitle } : {}),
});
const pages: BookPage[] = [];
pages.push(
  page(
    "welcome",
    "The Fraction Field Guide",
    "Measure, Share, and Scale",
    [
      text(
        "A field station needs people who can make sense of quantities. How much trail have we explored? Will the water last? What part of a garden can we plant? Fractions help answer these questions—but only when we know what the numbers mean.",
      ),
      note(
        "Your job is to investigate",
        "Make a prediction. Draw or mark what you know. Connect the picture to an equation. Check whether the answer fits the situation. You can change your mind when you find better evidence.",
      ),
      diagram({
        id: "welcome-strip",
        kind: "strips",
        wholeLabel: "one kilometer of trail",
        rows: [
          { label: "three quarter-kilometer sections", parts: 4, shaded: 3 },
        ],
        caption: "A fraction can measure how far you have gone.",
        alt: "One kilometer divided into four equal sections; three sections are shaded.",
      }),
      text(
        "Bring a pencil, paper, and curiosity. A ruler and colored pencils can help, but every idea can be shown with simple lines and labels. Read a little, try something, and explain it to someone—or to your future self.",
      ),
    ],
    "opening",
    "An investigation of quantities, units, and useful questions",
  ),
);
pages.push(
  page(
    "reading-route",
    "Your route through the guide",
    "Choose a starting point. Keep the connections.",
    [
      text(
        "1 · MEANING — Start with the whole, count equal parts, and locate fractions on a number line. Begin here if fraction symbols feel detached from quantities. Try the first expedition before moving on.",
      ),
      text(
        "2 · EQUIVALENT NAMES — Keep an amount fixed while changing its units. Compare using landmarks and shared pieces. Start here if you can draw 5/4 and explain a fair share, but equivalent fractions feel like a rule to memorize.",
      ),
      text(
        "3 · COMBINE AND COMPARE — Add and subtract amounts using a shared unit. Make predictions and repair errors. Use the supply workshop to choose an operation without a heading telling you what to do.",
      ),
      text(
        "4 · SCALE — Connect equal groups, parts of parts, area, and recipes. Predict whether a product shrinks or enlarges an amount. The garden workshop asks you to distinguish a fraction of area from square meters.",
      ),
      text(
        "5 · DIVIDE — Separate “how many groups?” from “how much in each group?” Measure partial groups, then explain the reciprocal rule. Use the water workshop to identify which quantity is missing.",
      ),
      text(
        "6 · TRANSFER AND RETURN — Mix the ideas in a trail report, missing-information puzzle, and supply design. Save the delayed-return page for another day. Bring back an earlier picture whenever it helps.",
      ),
      note(
        "A route is a choice, not a gate",
        "Try a workshop first if an idea feels familiar. If a task exposes uncertainty, visit the related explanation and try a fresh example. You can work on another strand and return later. The solutions explain methods; use them after a real attempt.",
      ),
    ],
    "guide",
  ),
);
pages.push(
  page(
    "route",
    "Choose your starting point",
    "What do you already notice?",
    [
      text(
        "Try these without a timer. An uncertain answer tells you where an explanation might help. It does not tell you what kind of learner you are.",
      ),
      task(
        "route-groups",
        "There are 4 bags with 3 counters in each bag. Draw the groups and find the total. Then show how 12 counters can be shared equally among 4 bags.",
        "12 counters; 3 counters per bag.",
        "Four groups of three contain 3 + 3 + 3 + 3 = 12. Sharing reverses the grouping: 12 ÷ 4 = 3.",
        undefined,
        "medium",
        "blank",
      ),
      task(
        "route-half",
        "Two people share 3 identical sandwiches equally. How much does each person get? Draw a way to share every sandwich.",
        "1 1/2 sandwiches each.",
        "Halve each sandwich. There are six halves, so each person receives three halves. Three halves equal one whole and one half.",
        "Two portions of 1 1/2 sandwiches use all 3 sandwiches.",
      ),
      note(
        "Choose a useful route",
        "If the sharing picture is new, start with “What is one whole?” If it feels familiar, try “Count past one,” “Compare with a shared unit,” and the first expedition. Use their explanations to choose what to study.",
      ),
    ],
    "workshop",
  ),
);
pages.push(
  page("whole", "Meaning • 1", "What is one whole?", [
    text(
      "A fraction compares a quantity with a chosen whole. On this page, one whole is one seed bed. The bed is divided into four equal areas. Three of those areas are planted.",
    ),
    diagram({
      id: "whole-strip",
      kind: "strips",
      wholeLabel: "one seed bed",
      rows: [{ label: "planted area", parts: 4, shaded: 3 }],
      caption: "Three equal fourths of this bed are planted: 3/4 of the bed.",
      alt: "A seed bed represented by a rectangle split into four equal areas, three shaded.",
    }),
    note(
      "Equal is doing important work",
      "Four pieces are not automatically fourths. Each fourth must have the same amount of the whole. Different shapes can have equal area; pieces that merely look alike are not enough evidence.",
    ),
    task(
      "whole-equal",
      "A seed bed has four sections with areas 1, 1, 1, and 3 square meters. One of the small sections is planted. Is 1/4 of the bed planted? Explain and give the fraction that is planted.",
      "No. 1/6 of the bed is planted.",
      "The bed has total area 1 + 1 + 1 + 3 = 6 square meters. One square meter is one of six equal square-meter units. Counting four unequal sections does not create fourths.",
    ),
  ]),
);
pages.push(
  page("units", "Meaning • 2", "Name the piece. Count the pieces.", [
    diagram({
      id: "units-strip",
      kind: "strips",
      wholeLabel: "one meter",
      rows: [
        { label: "one fifth of a meter", parts: 5, shaded: 1 },
        { label: "three fifths of a meter", parts: 5, shaded: 3 },
      ],
      caption:
        "The unit stays one fifth of a meter; its count changes from one to three.",
      alt: "Two equal meter strips divided into fifths. The first shades one fifth; the second shades three fifths.",
    }),
    text(
      "In 3/5, the denominator 5 says that five equal pieces make one whole. Each piece is 1/5. The numerator 3 counts three of these pieces. Read 3/5 as “three fifths,” not just “three over five.”",
    ),
    task(
      "units-name",
      "In 7/8 meter, what size piece are we counting? How many of those pieces do we have?",
      "Pieces of 1/8 meter; seven pieces.",
      "Eight equal eighth-meter pieces make a meter. The numerator counts seven of them.",
      undefined,
      "short",
    ),
    task(
      "units-build",
      "Draw 4/6 of a whole strip. Label one small piece and the shaded amount. Explain why the unshaded amount is 2/6.",
      "Four sixths shaded; each part is 1/6; two sixths unshaded.",
      "Six equal pieces make the whole. Four shaded pieces leave two of the same size: 4/6 + 2/6 = 6/6 = 1.",
      undefined,
      "medium",
      "blank",
    ),
  ]),
);
pages.push(
  page("measure", "Meaning • 3", "A fraction has an address", [
    text(
      "A number line measures distance from zero. The interval from 0 to 1 is one whole unit. Divide that interval into equal lengths, then count the lengths—not the tick marks.",
    ),
    diagram({
      id: "measure-line",
      kind: "number-line",
      wholeLabel: "one unit is one kilometer",
      min: [0, 1],
      max: [1, 1],
      divisionsPerUnit: 6,
      marks: [
        { at: [0, 1], label: "0" },
        { at: [4, 6], label: "4/6" },
        { at: [1, 1], label: "1" },
      ],
      caption: "Four sixth-kilometer steps reach 4/6 kilometer.",
      alt: "A number line from zero to one kilometer divided into six equal intervals, with four sixths marked.",
    }),
    task(
      "measure-locate",
      "Draw a number line from 0 to 1. Divide the unit into eighths and mark 3/8. How many equal intervals lie between 0 and your mark?",
      "Three intervals of length 1/8.",
      "The first tick is zero, so it does not count as an interval. Three eighth-length moves from zero locate 3/8.",
      undefined,
      "medium",
      "blank",
    ),
    task(
      "measure-unit",
      "A learner divides a line from 0 to 2 into four equal intervals and labels the first tick after 0 as 1/4. Repair the label and explain.",
      "The first tick is 1/2.",
      "Four equal intervals share a total length of 2. Each interval has length 2 ÷ 4 = 1/2. Fourths require four intervals inside each unit, not four across any line.",
    ),
  ]),
);
pages.push(
  page("beyond", "Meaning • 4", "Count past one", [
    diagram({
      id: "beyond-line",
      kind: "number-line",
      wholeLabel: "one unit is one liter",
      min: [0, 1],
      max: [2, 1],
      divisionsPerUnit: 4,
      marks: [
        { at: [0, 1], label: "0" },
        { at: [1, 1], label: "1" },
        { at: [5, 4], label: "5/4" },
        { at: [2, 1], label: "2" },
      ],
      caption: "Five quarter-liters make one liter and one quarter-liter.",
      alt: "A zero-to-two-liter number line divided into quarters with five quarters marked just after one.",
    }),
    text(
      "The size of a quarter does not change when we pass one. We can keep counting: 3/4, 4/4, 5/4, 6/4. The names 5/4 and 1 1/4 locate the same amount. A mixed number combines whole units and a fractional part.",
    ),
    task(
      "beyond-name",
      "Name 7/4 liters as a mixed number. Explain using groups of four quarter-liters.",
      "1 3/4 liters.",
      "Four quarters make one liter. Seven quarters contain one full group of four and three quarters left over.",
      "1 3/4 = 4/4 + 3/4 = 7/4.",
      "short",
    ),
    task(
      "beyond-reverse",
      "Write 2 2/3 kilometers using only thirds. Explain where the numerator comes from.",
      "8/3 kilometers.",
      "Each whole kilometer contains three thirds. Two wholes contain six thirds; adding two more thirds gives eight thirds.",
    ),
  ]),
);
pages.push(
  page("sharing", "Meaning • 5", "Share every part fairly", [
    text(
      "Four people share 3 liters of water equally. Giving each person a whole liter first will not work: there are more people than liters. Instead, divide each liter into four equal shares.",
    ),
    diagram({
      id: "sharing-strips",
      kind: "strips",
      wholeLabel: "one liter",
      rows: [
        {
          label: "one person receives one fourth of each liter",
          parts: 4,
          shaded: 3,
        },
      ],
      caption:
        "Combine three quarter-liter shares: each person receives 3/4 liter.",
      alt: "A liter strip divided into fourths with three fourths shaded to represent one person’s combined share.",
    }),
    worked(
      "Connect sharing to division",
      "3 liters shared among 4 people",
      [
        "From the first liter, each person gets 1/4 liter.",
        "The second and third liters each contribute another 1/4 liter.",
        "Each person receives 1/4 + 1/4 + 1/4 = 3/4 liter.",
      ],
      "3 ÷ 4 = 3/4. The fraction names the amount per person.",
    ),
    task(
      "sharing-amount",
      "Five people share 2 identical loaves equally. How much does each person receive? Explain by sharing each loaf.",
      "2/5 loaf per person.",
      "Each loaf gives every person 1/5 loaf. Two loaves give each person two fifths of a loaf.",
      undefined,
      "short",
    ),
    task(
      "sharing-check",
      "How can multiplication check that your five shares use exactly 2 loaves?",
      "5 × 2/5 = 2 loaves.",
      "Five shares of two fifths total ten fifths. Five fifths make one loaf, so ten fifths make two.",
      undefined,
      "short",
    ),
  ]),
);
pages.push(
  page(
    "first-expedition",
    "Pause and investigate",
    "Meaning without a recipe",
    [
      text(
        "Try these on your own. Label the whole or unit in each drawing. If two drawings show the same amount differently, explain what stayed the same.",
      ),
      task(
        "expedition-draw",
        "Draw two different pictures of 3/4 of one whole. One should show area and one should show length.",
        "For example: three of four equal regions of a rectangle, and a point at 3/4 on a unit number line.",
        "Both representations must use four equal parts of a stated whole and identify three of those parts. The pictures need not have the same shape.",
        undefined,
        "medium",
        "blank",
      ),
      task(
        "expedition-locate",
        "Which is farther from zero: 5/3 or 1 1/3? Explain without decimals.",
        "5/3 is farther.",
        "1 1/3 = 4/3. Five thirds exceed four thirds by one third.",
        undefined,
        "short",
      ),
      task(
        "expedition-share",
        "Three campers share 4 identical flatbreads equally. Name each share in two ways and explain how you know.",
        "4/3 flatbread = 1 1/3 flatbreads.",
        "Give each camper one flatbread, leaving one to split into thirds. Alternatively, split all four flatbreads into thirds and give each camper four pieces.",
        "3 × 4/3 = 4 flatbreads.",
      ),
    ],
    "workshop",
  ),
);
chapter = "equivalence";
pages.push(
  page(
    "subdivide",
    "Equivalent names • 1",
    "Change the pieces, keep the amount",
    [
      diagram({
        id: "subdivide-strips",
        kind: "strips",
        wholeLabel: "one meter",
        rows: [
          { label: "2/3 meter", parts: 3, shaded: 2 },
          { label: "4/6 meter", parts: 6, shaded: 4 },
        ],
        caption:
          "Every third is split into two sixths. The shaded length does not move.",
        alt: "Equal meter strips show two thirds and four sixths ending at the same position.",
      }),
      text(
        "When each third splits in two, there are twice as many pieces in the whole and twice as many in the shaded amount. That is why multiplying both numerator and denominator by 2 preserves the quantity: 2/3 = 4/6.",
      ),
      task(
        "subdivide-name",
        "Split every fifth in 3/5 into three equal pieces. What is the new name for 3/5?",
        "9/15.",
        "Each fifth becomes three fifteenths. The whole has 5 × 3 = 15 pieces; the shaded amount has 3 × 3 = 9.",
      ),
      task(
        "subdivide-explain",
        "Why does changing 3/5 to 6/5 change the amount, while changing it to 6/10 does not?",
        "6/5 doubles the amount; 6/10 renames the same amount.",
        "In 6/5 the piece size stays one fifth and the count doubles. In 6/10 the count doubles but each piece is half as large.",
      ),
    ],
  ),
);
pages.push(
  page(
    "regroup",
    "Equivalent names • 2",
    "Gather small pieces into larger units",
    [
      diagram({
        id: "regroup-strips",
        kind: "strips",
        wholeLabel: "one tray",
        rows: [
          { label: "4/6 of the tray", parts: 6, shaded: 4 },
          { label: "2/3 of the same tray", parts: 3, shaded: 2 },
        ],
        caption:
          "Pairs of sixths become thirds. Both names describe the same filled amount.",
        alt: "Four sixths and two thirds of identical trays are shaded to the same endpoint.",
      }),
      text(
        "Renaming 4/6 as 2/3 groups the pieces in pairs. Divide the piece count by 2 and the number of pieces in the whole by 2. “Simpler” means a useful name for the same quantity, not a smaller quantity.",
      ),
      task(
        "regroup-name",
        "Rename 6/8 using fourths. Explain what happens to the eight pieces.",
        "3/4.",
        "Group the eight eighths into four pairs. Each pair is one fourth; the six shaded eighths form three pairs.",
      ),
      task(
        "regroup-error",
        "Someone says 6/8 = 3/8 because “I divided by 2.” What changed? Repair the equation.",
        "6/8 = 3/4; 3/8 is half of 6/8.",
        "Dividing only the numerator removes half the pieces without changing their size. To rename the same amount, divide the denominator by 2 as well.",
      ),
    ],
  ),
);
pages.push(
  page("benchmarks", "Compare • 1", "Useful landmarks", [
    diagram({
      id: "benchmarks-line",
      kind: "number-line",
      wholeLabel: "one unit",
      min: [0, 1],
      max: [1, 1],
      divisionsPerUnit: 8,
      marks: [
        { at: [0, 1], label: "0" },
        { at: [1, 2], label: "1/2" },
        { at: [7, 8], label: "7/8" },
        { at: [1, 1], label: "1" },
      ],
      caption: "Seven eighths is only one eighth away from one.",
      alt: "A unit number line marks zero, one half, seven eighths, and one.",
    }),
    text(
      "Before finding a common denominator, look for a landmark. Is the fraction less than half? Almost one? More than one? If two quantities lie on opposite sides of a landmark, their order is already clear.",
    ),
    task(
      "benchmarks-near",
      "Is 5/12 below or above 1/2? Is 11/12 closer to 1/2 or to 1? Explain with twelfths.",
      "5/12 is below 1/2. 11/12 is closer to 1.",
      "One half is 6/12. Five twelfths is one twelfth below it. Eleven twelfths is one twelfth from 1 but five twelfths from 1/2.",
    ),
    task(
      "benchmarks-order",
      "Put 3/8, 7/8, and 5/4 in order from least to greatest. Use 1/2 and 1 as landmarks.",
      "3/8 < 7/8 < 5/4.",
      "Three eighths is below one half; seven eighths is between one half and one; five fourths exceeds one.",
    ),
  ]),
);
pages.push(
  page("compare", "Compare • 2", "Compare with a shared unit", [
    note(
      "Predict",
      "Two explorers travel 2/3 kilometer and 3/4 kilometer. Which goes farther? Make a prediction before looking at the twelfths.",
      "predict",
    ),
    diagram({
      id: "compare-strips",
      kind: "strips",
      wholeLabel: "one kilometer",
      rows: [
        { label: "2/3 = 8/12 kilometer", parts: 12, shaded: 8 },
        { label: "3/4 = 9/12 kilometer", parts: 12, shaded: 9 },
      ],
      caption:
        "A shared whole and shared piece size let us compare the counts directly.",
      alt: "Equal kilometer strips divided into twelfths show eight shaded parts and nine shaded parts.",
    }),
    task(
      "compare-justify",
      "Which explorer goes farther, and by how much? Explain why twelfths are useful.",
      "The 3/4-kilometer explorer goes 1/12 kilometer farther.",
      "Both thirds and fourths can be partitioned into twelfths. Nine equal pieces exceed eight of those same pieces by one.",
    ),
    task(
      "compare-other",
      "Compare 5/6 and 7/9 using eighteenths. Include the comparison symbol.",
      "5/6 > 7/9.",
      "5/6 = 15/18 and 7/9 = 14/18. Fifteen eighteenths exceeds fourteen eighteenths.",
      undefined,
      "short",
    ),
  ]),
);
pages.push(
  page("unequal-wholes", "Compare • 3", "Which whole are you comparing?", [
    text(
      "The north trail is 12 kilometers long. The pond trail is 8 kilometers long. Mira walks 1/2 of the north trail. Jo walks 3/4 of the pond trail. The fraction 3/4 is greater than 1/2—but that alone does not tell us who walked farther.",
    ),
    worked(
      "Translate each fraction into distance",
      "Compare half of 12 km with three fourths of 8 km.",
      [
        "Half of 12 kilometers is 6 kilometers.",
        "One fourth of 8 kilometers is 2 kilometers; three fourths is 6 kilometers.",
        "The walkers cover equal distances, even though they cover different fractions of their trails.",
      ],
      "A comparison of fractions assumes the same reference whole when we use it to compare amounts.",
    ),
    task(
      "unequal-length",
      "Ari walks 2/3 of a 9-kilometer trail. Bea walks 3/4 of a 12-kilometer trail. Who walks farther, and by how much?",
      "Bea walks 3 kilometers farther.",
      "Ari walks 6 km; Bea walks 9 km. Compare these distances, which share the kilometer unit: 9 − 6 = 3 km.",
    ),
    task(
      "unequal-explain",
      "Can half of a container hold more water than three fourths of another container? Give actual container sizes that prove your answer.",
      "Yes. For example, half of a 10-liter container is 5 liters; three fourths of a 4-liter container is 3 liters.",
      "The containers are different reference wholes. A smaller fraction of a larger whole can be a larger amount.",
    ),
  ]),
);
pages.push(
  page(
    "equivalence-workshop",
    "Expedition • equivalent names",
    "Choose a reason that fits",
    [
      task(
        "equivalence-select",
        "Compare each pair and explain an efficient reason: 4/9 and 7/9; 3/5 and 3/8; 5/12 and 7/10.",
        "4/9 < 7/9; 3/5 > 3/8; 5/12 < 7/10.",
        "First: same-size pieces, so compare counts. Second: three fifths are larger pieces than three eighths of the same whole. Third: 5/12 is below 1/2 while 7/10 is above 1/2.",
      ),
      task(
        "equivalence-repair",
        "A note says “A bigger denominator always means a bigger fraction.” Give a counterexample and explain the role of the numerator.",
        "For example, 1/8 < 1/4.",
        "With the same positive numerator, a larger denominator names smaller pieces. If the numerator also changes, both piece size and count matter; denominator size alone cannot order arbitrary fractions.",
      ),
      task(
        "equivalence-invent",
        "Create two different fractions equal to 3/4, and one fraction strictly between 3/4 and 1.",
        "For example: 6/8 and 9/12 are equal to 3/4; 7/8 lies between 3/4 and 1.",
        "Multiplying numerator and denominator by the same positive integer preserves value. Since 3/4 = 6/8 and 1 = 8/8, seven eighths is strictly between.",
        undefined,
        "medium",
      ),
    ],
    "workshop",
  ),
);
chapter = "addition";
pages.push(
  page(
    "common-unit",
    "Combine and compare • 1",
    "Add counts of the same kind",
    [
      diagram({
        id: "common-strips",
        kind: "strips",
        wholeLabel: "one kilometer",
        rows: [
          { label: "first walk: 2/7 km", parts: 7, shaded: 2 },
          { label: "second walk: 3/7 km", parts: 7, shaded: 3 },
          { label: "combined distance: 5/7 km", parts: 7, shaded: 5 },
        ],
        caption: "The count changes. The seventh-kilometer unit does not.",
        alt: "Three equal kilometer strips show two sevenths, three sevenths, and their sum five sevenths.",
      }),
      text(
        "Two apples plus three apples makes five apples. Two sevenths plus three sevenths makes five sevenths. We add the counts because the units agree: 2/7 + 3/7 = 5/7.",
      ),
      task(
        "common-add",
        "A ribbon is 9/10 meter long. You cut off 4/10 meter. How much remains? Explain using tenth-meter pieces.",
        "5/10 meter = 1/2 meter remains.",
        "Nine tenth-meter pieces minus four of those pieces leaves five. Five tenths is equivalent to one half.",
        undefined,
        "short",
      ),
      task(
        "common-error",
        "Why is 2/7 + 3/7 not 5/14? Explain what would have to happen to turn sevenths into fourteenths.",
        "The sum is 5/7, not 5/14.",
        "Adding amounts does not split their pieces. Fourteenths are half the size of sevenths. Renaming the correct sum in fourteenths gives 10/14, because each of the five sevenths splits in two.",
      ),
    ],
  ),
);
pages.push(
  page(
    "rename-to-add",
    "Combine and compare • 2",
    "Make a unit both quantities can use",
    [
      text(
        "The crew walks 1/2 kilometer, then another 1/3 kilometer. Halves and thirds name different lengths. Subdivide both into sixths so every piece being counted has the same size.",
      ),
      diagram({
        id: "rename-strips",
        kind: "strips",
        wholeLabel: "one kilometer",
        rows: [
          { label: "1/2 = 3/6", parts: 6, shaded: 3 },
          { label: "1/3 = 2/6", parts: 6, shaded: 2 },
          { label: "3/6 + 2/6 = 5/6", parts: 6, shaded: 5 },
        ],
        caption:
          "Renaming creates a common counting unit without changing either distance.",
        alt: "Equal strips show three sixths, two sixths, and their sum five sixths.",
      }),
      task(
        "rename-add",
        "Find 1/4 + 1/6. Choose equal-sized pieces that can name both quantities.",
        "5/12.",
        "A fourth is three twelfths and a sixth is two twelfths. Combine 3/12 + 2/12 = 5/12.",
        undefined,
        "short",
      ),
      task(
        "rename-why",
        "Could you use twenty-fourths instead of twelfths for the previous sum? Show whether the answer changes.",
        "Yes: 6/24 + 4/24 = 10/24 = 5/12.",
        "A common denominator need not be the smallest one. It must name units that can represent both addends exactly. Different valid units give equivalent sums.",
      ),
    ],
  ),
);
pages.push(
  page("subtract", "Combine and compare • 3", "Measure the gap", [
    diagram({
      id: "subtract-line",
      kind: "number-line",
      wholeLabel: "one unit is one kilometer",
      min: [0, 1],
      max: [1, 1],
      divisionsPerUnit: 12,
      marks: [
        { at: [0, 1], label: "0" },
        { at: [1, 3], label: "1/3" },
        { at: [3, 4], label: "3/4" },
        { at: [1, 1], label: "1" },
      ],
      jumps: [{ from: [1, 3], to: [3, 4], label: "the gap" }],
      caption:
        "The distance between 1/3 and 3/4 is five twelfths of a kilometer.",
      alt: "A unit number line in twelfths shows a jump from four twelfths to nine twelfths.",
    }),
    text(
      "Subtracting can mean finding how much is left. It can also mean finding a distance between two amounts. Here 3/4 − 1/3 asks how much farther the second marker lies along the trail.",
    ),
    task(
      "subtract-distance",
      "Find the gap from 1/6 kilometer to 5/8 kilometer. Show a common unit in your equation.",
      "11/24 kilometer.",
      "5/8 = 15/24 and 1/6 = 4/24. Their difference is 15/24 − 4/24 = 11/24.",
      undefined,
      "short",
    ),
    task(
      "subtract-check",
      "Use addition to check that 3/4 − 1/3 = 5/12.",
      "1/3 + 5/12 = 4/12 + 5/12 = 9/12 = 3/4.",
      "Starting at the smaller amount and adding the gap must reach the larger amount. This inverse check tests the meaning as well as the arithmetic.",
    ),
  ]),
);
pages.push(
  page(
    "bridge-one",
    "Combine and compare • 4",
    "Trade a whole for fractional units",
    [
      text(
        "A 2 1/4-meter cord loses a 3/4-meter piece. The quarter part alone is too small to remove three quarters. Rename one whole meter as four quarters.",
      ),
      diagram({
        id: "bridge-strips",
        kind: "strips",
        wholeLabel: "one meter",
        rows: [
          {
            label: "2 1/4 meters = 9 quarters",
            parts: 4,
            shaded: 9,
            wholes: 3,
          },
          {
            label: "remove 3 quarters; 6 quarters remain",
            parts: 4,
            shaded: 6,
            wholes: 3,
          },
        ],
        caption:
          "The unshaded extension is a measuring frame, not extra cord. The shaded amount changes from 9/4 to 6/4.",
        alt: "Two three-meter measuring strips divided into quarters show nine quarters of cord before cutting and six quarters afterward.",
      }),
      worked(
        "Rename, then subtract",
        "2 1/4 − 3/4",
        [
          "2 1/4 = 1 + 5/4: one whole stays whole; the other whole joins the quarter.",
          "1 + 5/4 − 3/4 = 1 + 2/4.",
          "Two fourths equal one half.",
        ],
        "The remaining cord is 1 1/2 meters long.",
      ),
      task(
        "bridge-subtract",
        "Find 3 1/3 − 1 2/3. Explain which whole you rename.",
        "1 2/3.",
        "Rename 3 1/3 as 2 4/3. Then 2 4/3 − 1 2/3 = 1 2/3. Equivalently, 10/3 − 5/3 = 5/3.",
        undefined,
        "short",
      ),
      task(
        "bridge-explain",
        "Why does 2 4/3 have the same value as 3 1/3?",
        "One whole has been renamed as three thirds.",
        "The total stays fixed: 2 + 4/3 = 6/3 + 4/3 = 10/3, and 3 + 1/3 = 9/3 + 1/3 = 10/3.",
        undefined,
        "short",
      ),
    ],
  ),
);
pages.push(
  page(
    "add-estimate",
    "Reason before calculating",
    "Give your answer a sensible home",
    [
      note(
        "Predict a range",
        "For 5/6 + 7/8, each addend is between 1/2 and 1. The sum must be between 1 and 2. A result smaller than 1 cannot be right.",
        "predict",
      ),
      worked(
        "Use the prediction as a check",
        "5/6 + 7/8",
        [
          "Rename in twenty-fourths: 20/24 + 21/24.",
          "Combine to obtain 41/24 = 1 17/24.",
          "The answer lies between 1 and 2, as predicted.",
        ],
        "A reasonable size is necessary, but it does not prove every digit is correct. Check the calculation too.",
      ),
      task(
        "add-bound",
        "Before calculating 3/4 + 5/6, decide whether the sum is less than 1, between 1 and 2, or greater than 2. Then calculate.",
        "Between 1 and 2; the sum is 19/12 = 1 7/12.",
        "Both addends exceed 1/2 and are less than 1. In twelfths, 9/12 + 10/12 = 19/12.",
      ),
      task(
        "add-repair",
        "A learner reports 7/8 − 1/4 = 6/4. Give a size reason that rules it out, then repair the calculation.",
        "6/4 is impossible; the difference is 5/8.",
        "Removing a positive amount from 7/8 must leave less than 7/8. Rename 1/4 as 2/8, then subtract: 7/8 − 2/8 = 5/8.",
      ),
    ],
  ),
);
pages.push(
  page(
    "supply-workshop",
    "Expedition • supplies",
    "Read the relationship",
    [
      text(
        "Write an equation before solving. Name the unit in your answer. Ask whether the story combines amounts, removes an amount, or asks for a missing part.",
      ),
      task(
        "supply-total",
        "One water jug contains 2/3 liter and another contains 3/4 liter. How much water is there altogether?",
        "17/12 liters = 1 5/12 liters.",
        "Combine the amounts: 2/3 + 3/4 = 8/12 + 9/12 = 17/12.",
        "The total exceeds 1 liter but is less than 2 liters.",
      ),
      task(
        "supply-left",
        "A roll holds 2 1/2 meters of tape. A repair uses 5/6 meter. How much tape remains?",
        "1 2/3 meters.",
        "Subtract the used amount: 5/2 − 5/6 = 15/6 − 5/6 = 10/6 = 5/3.",
        "1 2/3 + 5/6 = 2 1/2.",
      ),
      task(
        "supply-missing",
        "A container needs 1 1/4 liters to be full. It holds 2/3 liter. How much more water does it need?",
        "7/12 liter.",
        "Find the missing part in 2/3 + ? = 5/4. The gap is 15/12 − 8/12 = 7/12.",
      ),
    ],
    "workshop",
  ),
);
pages.push(
  page(
    "retrieval-one",
    "Bring back older ideas",
    "A change of scenery",
    [
      text(
        "These questions mix ideas. Choose a representation that makes each relationship clear. There is no rule that every question on a page uses the same operation.",
      ),
      task(
        "retrieval-one-location",
        "A measuring line runs from 0 to 3 meters in steps of 1/2 meter. What amount is four steps after zero? What is one step before 3?",
        "2 meters; 2 1/2 meters.",
        "Four half-meter intervals total two meters. One half-meter interval before three is three minus one half.",
        undefined,
        "short",
      ),
      task(
        "retrieval-one-compare",
        "Which is larger: 4/5 of 10 meters or 3/4 of 12 meters? Explain why comparing 4/5 and 3/4 alone is not enough.",
        "3/4 of 12 meters is larger: 9 meters versus 8 meters.",
        "The reference lengths differ. Convert both fractional descriptions into the common meter unit before comparing.",
      ),
      task(
        "retrieval-one-sum",
        "Two pieces of wire measure 7/12 meter and 5/8 meter. Is their combined length more than one meter? Find the exact total.",
        "Yes; 29/24 meters = 1 5/24 meters.",
        "Both pieces exceed one half meter, so the sum exceeds one. In twenty-fourths the sum is 14/24 + 15/24 = 29/24.",
      ),
    ],
    "workshop",
  ),
);
chapter = "multiplication";
pages.push(
  page("groups-of", "Multiply • 1", "Several groups of a fractional amount", [
    text(
      "Each seed packet needs 3/8 cup of seeds. For three packets, count three groups of 3/8 cup. Multiplication records repeated equal groups: 3 × 3/8.",
    ),
    diagram({
      id: "groups-strip",
      kind: "strips",
      wholeLabel: "one cup",
      rows: [
        { label: "one packet: 3/8 cup", parts: 8, shaded: 3, wholes: 2 },
        { label: "three packets: 9/8 cup", parts: 8, shaded: 9, wholes: 2 },
      ],
      caption: "Three groups of three eighth-cups make nine eighth-cups.",
      alt: "Two-cup measuring strips divided into eighths show three eighths for one packet and nine eighths for three packets.",
    }),
    task(
      "groups-total",
      "Five jars each hold 2/3 liter. How much liquid do they hold altogether?",
      "10/3 liters = 3 1/3 liters.",
      "Five groups of two thirds contain ten thirds. Three thirds make each liter, leaving one third after three full liters.",
      undefined,
      "short",
    ),
    task(
      "groups-reverse",
      "A row of identical containers holds 12/5 liters in total. Each container holds 3/5 liter. How many containers are there? Explain by counting fifths.",
      "4 containers.",
      "The total contains twelve fifth-liters. Each container uses three of those units. Twelve units form four groups of three.",
      "4 × 3/5 = 12/5.",
    ),
  ]),
);
pages.push(
  page("fraction-of", "Multiply • 2", "Part of a part", [
    text(
      "A garden uses 3/4 of a bed for herbs. Of that herb area, 2/3 is mint. What fraction of the whole bed is mint? The word “of” asks us to take a fraction of a quantity.",
    ),
    diagram({
      id: "fraction-area",
      kind: "area",
      wholeLabel: "one garden bed",
      columns: 4,
      rows: 3,
      shadedColumns: 3,
      shadedRows: 2,
      caption:
        "The herb area covers three columns. Mint occupies two of the three equal rows within those columns: six of twelve cells.",
      alt: "A rectangle with four equal columns and three equal rows. Three columns have one shading and two rows another; their six-cell overlap represents mint.",
    }),
    text(
      "Twelve equal cells fill the bed; six are in the overlap. Thus 2/3 × 3/4 = 6/12 = 1/2. The product measures the part satisfying both conditions.",
    ),
    task(
      "fraction-of-find",
      "Find 3/5 of 2/3. Describe a grid that shows your answer.",
      "6/15 = 2/5.",
      "Use three columns and five rows. Shade two columns and three rows. Their overlap is six of the fifteen equal cells.",
      undefined,
      "short",
    ),
    task(
      "fraction-of-explain",
      "Why is 2/3 of 3/4 smaller than 3/4?",
      "It takes only two thirds of the three-quarter amount.",
      "The original three-quarter amount is divided into three equal portions and only two are kept. For a positive amount, taking a fraction between zero and one produces a smaller amount.",
      undefined,
      "short",
    ),
  ]),
);
pages.push(
  page("scale", "Multiply • 3", "A factor tells how the quantity changes", [
    diagram({
      id: "scale-double",
      kind: "double-line",
      topLabel: "batches",
      bottomLabel: "cups of grain",
      pairs: [
        { top: [0, 1], bottom: [0, 1] },
        { top: [1, 2], bottom: [3, 4] },
        { top: [1, 1], bottom: [3, 2] },
        { top: [2, 1], bottom: [3, 1] },
      ],
      caption:
        "One batch uses 1 1/2 cups. Half a batch uses half that amount; two batches use twice that amount.",
      alt: "Aligned number lines pair zero batches with zero cups, half a batch with three quarters cup, one batch with one and a half cups, and two batches with three cups.",
    }),
    text(
      "A positive scale factor below 1 reduces a positive quantity. A factor of 1 preserves it. A factor above 1 enlarges it. Multiplication is not always a command to make a number bigger.",
    ),
    task(
      "scale-small",
      "A full recipe uses 1 1/2 cups of grain. How much grain does 2/3 of a batch need? Predict whether the amount is above or below 1 1/2 cups.",
      "1 cup, below 1 1/2 cups.",
      "2/3 × 3/2 = 6/6 = 1. The factor 2/3 keeps less than the full batch.",
    ),
    task(
      "scale-large",
      "How much grain does 1 1/3 batches of the same recipe need?",
      "2 cups.",
      "4/3 × 3/2 = 12/6 = 2. A full batch uses 1 1/2 cups, and another third-batch uses 1/2 cup.",
    ),
  ]),
);
pages.push(
  page("simplify", "Multiply • 4", "Make the arithmetic easier for a reason", [
    worked(
      "Equivalent products",
      "Find 4/9 × 3/8.",
      [
        "Multiply first if you wish: 12/72 = 1/6.",
        "Or write the product as (4 × 3)/(9 × 8).",
        "Divide a factor 4 from the numerator and denominator: 3/(9 × 2). Then divide both by 3 to get 1/(3 × 2).",
      ],
      "Both routes preserve the ratio between numerator and denominator. The product is 1/6.",
    ),
    note(
      "What cancellation means",
      "You are dividing the full numerator and denominator by the same nonzero factor. You are not crossing out matching digits, and this shortcut does not pass through addition.",
      "connect",
    ),
    task(
      "simplify-product",
      "Find 5/12 × 8/15. Show a simplification and explain why it preserves the value.",
      "2/9.",
      "The product is 40/180. Dividing numerator and denominator by 20 gives 2/9. Before multiplying, divide 5 and 15 by 5, and 8 and 12 by 4 to obtain (1 × 2)/(3 × 3).",
    ),
    task(
      "simplify-repair",
      "A learner crosses out the 3s in (3 + 2)/(3 + 5) and gets 2/5. Test and repair the claim.",
      "(3 + 2)/(3 + 5) = 5/8, not 2/5.",
      "The 3s are addends, not common factors of the entire numerator and denominator. Evaluate the sums. One check: 5/8 exceeds one half, whereas 2/5 is below one half.",
    ),
  ]),
);
pages.push(
  page(
    "garden-workshop",
    "Expedition • garden plans",
    "A fraction of area, an amount of area",
    [
      diagram({
        id: "garden-area",
        kind: "area",
        wholeLabel: "one 24-square-meter garden",
        columns: 4,
        rows: 3,
        shadedColumns: 3,
        shadedRows: 2,
        caption: "Each of the twelve equal cells represents 2 square meters.",
        alt: "A 24-square-meter garden divided into twelve equal cells, with six cells in the overlap of three columns and two rows.",
      }),
      text(
        "The garden occupies 24 square meters. Three fourths is planted; two thirds of the planted area contains vegetables. Keep “fraction of the garden” separate from “square meters.”",
      ),
      task(
        "garden-fraction",
        "What fraction of the whole garden contains vegetables? Explain the two stages.",
        "1/2 of the garden.",
        "First select 3/4 of the garden, then select 2/3 of that portion. The product is 2/3 × 3/4 = 6/12 = 1/2.",
      ),
      task(
        "garden-measure",
        "How many square meters contain vegetables? Give a second route that finds the planted area first.",
        "12 square meters.",
        "Half of 24 is 12. Alternatively, 3/4 of 24 is 18 square meters planted, and 2/3 of 18 is 12 square meters of vegetables.",
      ),
    ],
    "workshop",
  ),
);
pages.push(
  page(
    "multiplication-investigate",
    "Investigation • scale",
    "Choose a factor. Defend your choice.",
    [
      task(
        "investigate-factor",
        "Choose a fraction that makes 3/4 × your fraction strictly between 3/4 and 1. Show that both inequalities hold.",
        "For example, choose 6/5; the product is 9/10.",
        "3/4 × 6/5 = 18/20 = 9/10. In twentieths, 15/20 < 18/20 < 20/20. More generally, any factor strictly between 1 and 4/3 works.",
        undefined,
        "large",
      ),
      task(
        "investigate-always",
        "A claim says “The product of two positive fractions is always smaller than either factor.” Is it always true? Give an example that supports it and a counterexample that disproves the word “always.”",
        "The claim is false. Support: 1/2 × 1/3 = 1/6. Counterexample: 3/2 × 4/3 = 2.",
        "When both positive factors are below 1, each scales the other down. Fractions can also exceed 1. In the counterexample, the product 2 exceeds both 3/2 and 4/3.",
        undefined,
        "large",
      ),
    ],
    "workshop",
  ),
);

chapter = "division";
pages.push(
  page("division-fit", "Divide • 1", "How many groups fit?", [
    text(
      "The station has 3/2 liters of water. Each small container holds 1/4 liter. How many containers can be filled? The total and the size of one group are known. We want the number of groups.",
    ),
    diagram({
      id: "division-groups",
      kind: "groups",
      wholeLabel: "liters of water",
      total: [3, 2],
      groupSize: [1, 4],
      unitDivisions: 4,
      caption: "Six quarter-liter groups fit into 1 1/2 liters.",
      alt: "One and a half liters divided into six groups, each measuring one quarter liter.",
    }),
    text(
      "Rename 3/2 liters as 6/4 liters. Each container uses one of those six quarter-liter units, so six containers can be filled: 3/2 ÷ 1/4 = 6. The answer counts containers; it is not six liters.",
    ),
    task(
      "division-count",
      "How many 1/3-meter pieces can be cut from a 2-meter cord, assuming no length is lost in cutting?",
      "6 pieces.",
      "Two meters contains six third-meter lengths. Each piece uses one of them.",
      "6 × 1/3 meter = 2 meters.",
      "short",
    ),
    task(
      "division-unit",
      "Why does the answer to “How many 1/4-liter containers fit into 3/2 liters?” count containers rather than liters?",
      "It counts groups of a specified size.",
      "Dividing the total number of liters by liters per container gives the number of containers. The water amount remains 3/2 liters.",
      undefined,
      "short",
    ),
  ]),
);
pages.push(
  page("division-sharing", "Divide • 2", "How much belongs to each group?", [
    text(
      "The same 3/2 liters is shared equally among four people. We know the total and the number of groups. We want the size of one group. The question has changed.",
    ),
    diagram({
      id: "division-share-strips",
      kind: "strips",
      wholeLabel: "one liter",
      rows: [
        {
          label: "total water: 12 eighth-liters",
          parts: 8,
          shaded: 12,
          wholes: 2,
        },
        {
          label: "one of four equal shares: 3 eighth-liters",
          parts: 8,
          shaded: 3,
          wholes: 2,
        },
      ],
      caption:
        "Twelve eighth-liters shared among four people gives each person three eighth-liters.",
      alt: "Equal two-liter measuring strips show the twelve eighth-liters in the total and the three eighth-liters in one of four equal shares.",
    }),
    task(
      "division-share",
      "Find 3/2 ÷ 4 and label the amount each person receives. Check that the four shares use all the water.",
      "3/8 liter per person.",
      "3/2 liters equals 12/8 liters. Share twelve eighth-liter units among four people: three units each.",
      "4 × 3/8 = 12/8 = 3/2 liters.",
      "short",
    ),
    task(
      "division-contrast",
      "Explain why 3/2 ÷ 1/4 = 6 and 3/2 ÷ 4 = 3/8 can both describe fair division of the same total.",
      "The first fixes each group’s size; the second fixes the number of groups.",
      "Quarter-liter containers produce six groups. Four equal shares produce groups of three eighths of a liter. Different known information asks for different unknowns.",
    ),
  ]),
);
pages.push(
  page("partial-group", "Divide • 3", "What does part of a group mean?", [
    text(
      "A full sample kit needs 2/3 meter of tubing. There are 3/2 meters available. Two full kits use 4/3 meters, leaving 1/6 meter. What fraction of another kit’s tubing does that remainder supply?",
    ),
    diagram({
      id: "partial-groups",
      kind: "groups",
      wholeLabel: "meters of tubing",
      total: [3, 2],
      groupSize: [2, 3],
      unitDivisions: 6,
      caption:
        "Each full group uses four sixths. Nine sixths provide two full groups and one of the four parts of another group.",
      alt: "Nine sixth-meter units grouped in sets of four: two complete groups and one sixth-meter unit in a partial third group.",
    }),
    task(
      "partial-count",
      "Find 3/2 ÷ 2/3. Name how many complete kits are possible and how much of another kit’s tubing remains.",
      "2 1/4 kit-lengths; 2 complete kits and 1/4 of another kit’s tubing.",
      "In sixths, the total is nine units and one kit needs four units. Nine divided by four is 2 1/4. A remaining sixth-meter is one quarter of the four-sixth-meter group.",
    ),
    task(
      "partial-meaning",
      "Why is the quotient not 2 1/6, even though 1/6 meter remains?",
      "The fractional part of the quotient measures a fraction of a kit-length, not a fraction of a meter.",
      "A whole kit-length is 2/3 meter. The remainder 1/6 meter is one fourth of 2/3 meter. Units determine what the fraction refers to.",
    ),
  ]),
);
pages.push(
  page(
    "why-reciprocal",
    "Divide • 4",
    "Why multiplying by the reciprocal works",
    [
      worked(
        "Use a shared small unit",
        "Find 3/4 ÷ 2/3.",
        [
          "Rename both quantities in twelfths: 3/4 = 9/12 and 2/3 = 8/12.",
          "Ask how many groups of eight twelfths fit into nine twelfths: 9 ÷ 8 = 9/8.",
          "The same result is 3/4 × 3/2 = 9/8. The reciprocal 3/2 tells how many two-third units fit in one whole.",
        ],
        "Dividing by a positive fraction b/c is multiplying by c/b. The divisor cannot be zero.",
      ),
      text(
        "Another way to see it: to measure in units of size 2/3, split into thirds, then collect thirds in pairs. Measuring the same amount in thirds gives three times as many units. Pairing these third-units divides that count by 2. Together those steps multiply by 3/2.",
      ),
      task(
        "reciprocal-solve",
        "Find 5/6 ÷ 3/4 using a shared denominator, then check by multiplying by the reciprocal.",
        "10/9 = 1 1/9.",
        "In twelfths: 10/12 ÷ 9/12 = 10/9. By reciprocals: 5/6 × 4/3 = 20/18 = 10/9.",
        undefined,
        "short",
      ),
      task(
        "reciprocal-explain",
        "What multiplication equation checks 3/4 ÷ 2/3 = 9/8? Explain the roles of its factors.",
        "9/8 × 2/3 = 3/4.",
        "The number of groups, 9/8, times the size of each group, 2/3, must recover the total, 3/4. The product is 18/24 = 3/4.",
        undefined,
        "short",
      ),
    ],
  ),
);
pages.push(
  page(
    "division-prediction",
    "Reason before calculating",
    "A small unit can have a large count",
    [
      text(
        "A meter contains 100 centimeters. The count is larger because the unit is smaller; the length has not grown. Likewise, a total can contain many fractional groups. Division does not always make the numerical answer smaller.",
      ),
      note(
        "Predict from the divisor",
        "For a positive total, dividing by a positive number below 1 gives a larger numerical quotient. Dividing by 1 preserves the number. Dividing by a number above 1 gives a smaller quotient. Keep the question’s units attached.",
        "predict",
      ),
      task(
        "division-estimate",
        "Without calculating first, predict whether 5/6 ÷ 1/3 is greater or less than 5/6. Then find its value.",
        "Greater; the quotient is 5/2 = 2 1/2.",
        "The divisor is a third-sized unit, so more than one of those units fits in a whole. Compute 5/6 × 3 = 15/6 = 5/2.",
      ),
      task(
        "division-repair",
        "A learner writes 2/3 ÷ 4/5 = 8/15. Show why the answer’s size is suspicious, then repair it.",
        "The correct quotient is 5/6.",
        "Dividing a positive total by 4/5 should give a number larger than the total 2/3, but 8/15 is smaller. The learner multiplied by the divisor rather than its reciprocal: 2/3 × 5/4 = 10/12 = 5/6.",
        "5/6 × 4/5 = 2/3.",
      ),
    ],
  ),
);
pages.push(
  page(
    "water-workshop",
    "Expedition • water station",
    "Which quantity is missing?",
    [
      text(
        "For each problem, identify the total amount, the number of groups, and the size of one group. Two are given; find the third. Draw if that helps you choose an equation.",
      ),
      task(
        "water-bottles",
        "There are 2 1/4 liters of juice. Each bottle holds 3/8 liter. How many bottles can be filled?",
        "6 bottles.",
        "The total is 18/8 liters and each bottle uses 3/8 liter. Eighteen eighths form six groups of three eighths: 9/4 ÷ 3/8 = 6.",
      ),
      task(
        "water-share",
        "Five people share 2 1/4 liters of juice equally. How much does each person receive?",
        "9/20 liter per person.",
        "Here five is the number of groups. Divide the total by 5: 9/4 ÷ 5 = 9/4 × 1/5 = 9/20.",
        "5 × 9/20 = 9/4 liters.",
      ),
      task(
        "water-missing",
        "Six identical bottles each hold 3/8 liter. What total amount fills all six bottles?",
        "2 1/4 liters.",
        "The number and size of groups are known, so multiply: 6 × 3/8 = 18/8 = 9/4. This reverses the first problem.",
      ),
    ],
    "workshop",
  ),
);
chapter = "transfer";
pages.push(
  page(
    "same-numbers",
    "Mixed investigation",
    "The numbers do not choose the operation",
    [
      text(
        "Use 3/4 and 1/2 in every problem. Predict the size of each answer. What changes is the relationship, not the pair of numbers.",
      ),
      task(
        "same-sum",
        "A container holds 3/4 liter. You pour in another 1/2 liter. What is the total?",
        "1 1/4 liters.",
        "Combine amounts: 3/4 + 1/2 = 3/4 + 2/4 = 5/4. The total is larger than either addend.",
        undefined,
        "short",
      ),
      task(
        "same-difference",
        "A container holds 3/4 liter. You pour out 1/2 liter. What remains?",
        "1/4 liter.",
        "Remove an amount: 3/4 − 1/2 = 3/4 − 2/4 = 1/4. The remainder is smaller than the starting amount.",
        undefined,
        "short",
      ),
      task(
        "same-product",
        "A container holds 3/4 liter. You use half of that water. How much do you use?",
        "3/8 liter.",
        "Take a fraction of an amount: 1/2 × 3/4 = 3/8. The reference whole for “half” is the water in the container, not a full liter.",
        undefined,
        "short",
      ),
      task(
        "same-quotient",
        "How many half-liter portions are in 3/4 liter, counting a partial portion?",
        "1 1/2 portions.",
        "Count groups: 3/4 ÷ 1/2 = 3/2. One full half-liter portion leaves a quarter-liter, which is half of another half-liter portion.",
        undefined,
        "short",
      ),
    ],
    "workshop",
  ),
);
pages.push(
  page(
    "field-report",
    "Transfer • trail survey",
    "Build a report someone can check",
    [
      text(
        "A survey crew walks 3/4 kilometer to a bridge, then 5/6 kilometer to a lookout. They return along the same route. On the return walk they travel at a steady 2 kilometers per hour. Breaks are not included in that walking time.",
      ),
      task(
        "report-distance",
        "How far is the lookout from the starting point along this route? How far is the whole out-and-back walk?",
        "19/12 kilometers one way; 19/6 kilometers = 3 1/6 kilometers for the round trip.",
        "Add the two legs: 9/12 + 10/12 = 19/12. The return follows the same route, so double that distance.",
      ),
      task(
        "report-time",
        "How many hours does the return walk take? Explain why you use the one-way distance.",
        "19/24 hour.",
        "The return is 19/12 kilometers long. Time equals distance divided by speed: (19/12) ÷ 2 = 19/24 hour. The question asks only about the return, not both walks.",
      ),
      task(
        "report-check",
        "Is the return time less than one hour? Give a reason using the speed before using the exact answer.",
        "Yes.",
        "The return distance is less than 2 kilometers. At 2 kilometers per hour, walking less than 2 kilometers takes less than one hour. This agrees with 19/24 < 1.",
        undefined,
        "short",
      ),
    ],
    "workshop",
  ),
);
pages.push(
  page(
    "missing-information",
    "Transfer • evidence",
    "Is there enough information?",
    [
      text(
        "A good mathematical answer can be “We need to know something else.” Explain what is missing and show how it could change the result.",
      ),
      task(
        "missing-decide",
        "One tank is 2/3 full and another is 3/4 full. Which contains more water? Decide whether the information is sufficient.",
        "The information is insufficient; we need the tank capacities or a relationship between them.",
        "If both hold 12 liters, the second contains more: 9 liters versus 8. If the first holds 18 liters and the second holds 8 liters, the first contains more: 12 liters versus 6. Both situations match the given fractions.",
        undefined,
        "large",
      ),
      task(
        "missing-create",
        "Choose capacities so the two tanks contain equal amounts. Show both calculations.",
        "For example: the first holds 9 liters and the second holds 8 liters.",
        "2/3 of 9 is 6 liters, and 3/4 of 8 is also 6 liters. Any positive capacities in the ratio 9:8 work.",
        undefined,
        "large",
      ),
    ],
    "workshop",
  ),
);
pages.push(
  page(
    "design-challenge",
    "Transfer • design",
    "Plan a useful supply kit",
    [
      text(
        "The team needs exactly 3 liters of water. Containers come in sizes of 1/2 liter and 3/4 liter. Every container must be full. Use both sizes, and use no more than six containers.",
      ),
      task(
        "design-plan",
        "Find a plan that meets every condition. Show the amount of water and the number of containers. Explain how you searched.",
        "Use three half-liter containers and two three-quarter-liter containers: five containers total.",
        "3 × 1/2 + 2 × 3/4 = 3/2 + 3/2 = 3 liters. In quarter-liters, the equation is 2a + 3b = 12 with positive whole-number counts. Trying positive b shows b = 2 gives a = 3; b = 4 would give a = 0 and would fail the requirement to use both sizes.",
        undefined,
        "large",
      ),
      task(
        "design-change",
        "The 3/4-liter containers are unavailable. Could full 1/2-liter containers alone hold exactly 3 liters within the six-container limit? Explain what changes.",
        "Yes; six half-liter containers hold exactly 3 liters.",
        "3 ÷ 1/2 = 6. The revised problem removes the both-sizes condition; six containers meet the remaining amount and count requirements.",
        undefined,
        "large",
      ),
    ],
    "workshop",
  ),
);
pages.push(
  page(
    "delayed-return",
    "Revisit after a break",
    "What can you bring back?",
    [
      text(
        "Use this page in a later session. Try without looking at earlier worked examples. A diagram or a fresh explanation is welcome.",
      ),
      task(
        "return-location",
        "A line from 0 to 2 has ten equal intervals. What number is at the seventh interval endpoint after zero?",
        "7/5 = 1 2/5.",
        "Each interval measures 2/10 = 1/5. Seven intervals reach seven fifths. The full line contains two wholes, not one.",
        undefined,
        "short",
      ),
      task(
        "return-error",
        "A sign says 2/5 + 1/2 = 3/7. Repair the equation and explain the missing idea.",
        "2/5 + 1/2 = 9/10.",
        "Fifths and halves are different units. Rename them in tenths: 4/10 + 5/10 = 9/10. Adding denominators does not create a valid common unit.",
        undefined,
        "short",
      ),
      task(
        "return-share",
        "Three people share 5/4 kilograms of dried fruit equally. How much does each receive?",
        "5/12 kilogram.",
        "Divide the total by the number of people: 5/4 ÷ 3 = 5/12. Three portions of 5/12 total 15/12 = 5/4.",
        undefined,
        "short",
      ),
      task(
        "return-scale",
        "A model trail is 7/8 meter long. A new model uses 4/7 of that length. Predict whether it is longer or shorter, then find its length.",
        "Shorter; 1/2 meter.",
        "The scale factor 4/7 is below 1. Compute 4/7 × 7/8 = 4/8 = 1/2.",
        undefined,
        "short",
      ),
    ],
    "workshop",
  ),
);
pages.push(
  page(
    "reflection",
    "Your field notes",
    "Explain an idea you can use again",
    [
      task(
        "reflection-idea",
        "Choose an idea that became clearer: the reference whole, equal units, equivalence, scaling, or division. Explain it with your own example, a picture, and an equation.",
        "Responses vary. A valid explanation connects a stated whole or unit, an accurate picture, and a matching equation.",
        "Example: “Three fourths and six eighths are equal because splitting every fourth into two keeps the same shaded length: 3/4 = 6/8.” Check that the explanation says what stays fixed and what changes.",
        undefined,
        "large",
        "blank",
      ),
      task(
        "reflection-question",
        "Write a fraction question for another learner. Include a solution and one tempting wrong answer. Explain what misunderstanding would produce that wrong answer.",
        "Responses vary. The question must be unambiguous and the solution must follow from its givens.",
        "Example: “What is half of 3/4 liter?” Correct answer: 3/8 liter. Tempting answer: 1/4 liter, from subtracting 1/2 liter instead of taking half of the amount. The contrast distinguishes removal from scaling.",
        undefined,
        "large",
      ),
    ],
    "reflection",
  ),
);
pages.push(
  page(
    "adult-guide",
    "For a learning partner",
    "Listen for the meaning",
    [
      text(
        "Use one or two pages or activities in a session, or stop sooner when an explanation deserves discussion. The investigations are not timed tests. Ask the learner to identify the whole, name the unit, predict an answer’s size, and connect a drawing to an equation. Wait for their explanation before supplying your own.",
      ),
      note(
        "When an answer is wrong",
        "Ask “What does this number measure?” or “Where would it go in your picture?” A correct operation with an arithmetic slip calls for different support than a confused whole or group. Offer a simpler quantity while preserving the same relationship, then return to the original problem.",
      ),
      note(
        "When an answer is right",
        "Invite another representation or a changed example. Ask what would happen if the whole doubled, if a divisor exceeded one, or if a group were only partly filled. Avoid turning every success into a demand for a faster answer.",
      ),
      text(
        "The delayed-return page is intended for a later session. Its result is one piece of evidence. Look for independent explanations across changed situations and over time. Drawing, oral discussion, and written equations can reveal different strengths. This unit does not assess every fraction standard, guarantee long-term retention, or replace support needed for reading or accessibility.",
      ),
      text(
        "Solutions provide reasoning and examples, including criteria for open tasks. A different method can be fully correct. Compare units, quantities, and relationships rather than requiring the exact words in the key.",
      ),
    ],
    "guide",
  ),
);

for (const [section, solutions] of Object.entries(keys)) {
  for (let offset = 0; offset < solutions.length; offset += 5) {
    pages.push(
      page(
        `key-${section}-${offset / 5 + 1}`,
        "Solutions • reasoning and checks",
        `${section[0]!.toUpperCase()}${section.slice(1)} field notes`,
        solutions.slice(offset, offset + 5),
        "solutions",
      ),
    );
  }
}
export const fractionFieldGuide: FractionBook = {
  id: "fraction-field-guide",
  version: "1.0.0",
  title: "The Fraction Field Guide",
  subtitle: "Measure, Share, and Scale",
  audience:
    "Learners exploring fraction meaning and operations, typically grades 3–6, with whole-number equal-group prerequisites.",
  description:
    "Original investigations connecting fraction words, diagrams, symbols, estimation, and contextual reasoning. Includes guided lessons, independent workshops, mixed retrieval, and detailed solutions. Completion alone does not certify mastery of every fraction standard.",
  pages,
};
