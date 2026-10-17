import { Author, array, diagram, note, text, worked } from "./authoring.js";
export function decisions(a: Author) {
  const task = a.task.bind(a);
  a.section = "decisions";
  a.page("remainder", "What does the leftover count?", [
    diagram({
      kind: "groups",
      id: "remainder-groups",
      wholeLabel: "one token",
      total: [17, 1],
      groupSize: [5, 1],
      unitDivisions: 1,
      caption:
        "Seventeen tokens make three complete groups of five, with two tokens left.",
      alt: "Seventeen token units separated into three full groups of five and a final group containing two.",
    }),
    text(
      "17 ÷ 5 = 3 remainder 2 describes three complete groups and two leftover tokens. Check both pieces: 3 × 5 + 2 = 17. A remainder has the unit of the original total.",
    ),
    task(
      "remainder-count",
      "Divide 23 counters into groups of 4. Give the number of full groups and the remainder.",
      "5 full groups, remainder 3.",
      "Five groups use twenty counters. The three left cannot fill another group of four.",
      "5 × 4 + 3 = 23.",
      "medium",
    ),
    task(
      "remainder-unit",
      "You place 23 stickers on pages with 4 stickers per page. Explain why the remainder is not “3 pages.”",
      "The remainder is 3 stickers.",
      "The full-group count is five pages. The remainder counts original items that have not filled another page. Three additional pages would have a different meaning.",
      undefined,
      "short",
    ),
  ]);
  a.page("full-boxes", "Count only complete kits", [
    worked(
      "The packing rule matters",
      "Seventeen tokens are available. A sealed kit must contain exactly five. How many complete kits can you make?",
      [
        "Three kits use 3 × 5 = 15 tokens.",
        "Two tokens are left, too few for another complete kit.",
      ],
      "Make 3 complete kits and keep 2 tokens aside.",
    ),
    note(
      "Answer the question",
      "The quotient and remainder describe the arithmetic. The packing rule tells you which number answers the practical question.",
    ),
    task(
      "boxes-full",
      "There are 29 beads. Every sealed kit must contain exactly 6 beads. How many complete kits can you make, and how many beads stay outside the kits?",
      "4 complete kits, with 5 beads left.",
      "Four kits use twenty-four beads. The five left are fewer than the six needed for a fifth kit.",
      "4 × 6 + 5 = 29.",
      "large",
    ),
    task(
      "boxes-why",
      "A learner rounds up and says “5 full kits.” Explain why that decision fails here.",
      "Five full kits would require 30 beads.",
      "Only twenty-nine beads are available. A partially filled kit does not meet the rule that every sealed kit must contain exactly six.",
      undefined,
      "large",
    ),
  ]);
  a.page("seats", "Everyone must fit", [
    worked(
      "Same arithmetic, different decision",
      "Seventeen visitors need rides. Each van seats five visitors. How many vans are needed?",
      [
        "Three full vans carry fifteen visitors.",
        "Two visitors still need seats, so one more van is needed.",
      ],
      "Use 4 vans. The last van has 2 visitors and 3 empty visitor seats.",
    ),
    text(
      "We do not discard people because they are a remainder. We also do not need five full vans. Find the smallest whole number of vans with enough seats.",
    ),
    task(
      "seats-needed",
      "Twenty-nine visitors need rides in vans that each seat 6 visitors. How many vans are needed?",
      "5 vans.",
      "Four vans seat twenty-four, leaving five visitors. A fifth van carries those five; one visitor seat is empty.",
      undefined,
      "large",
    ),
    task(
      "seats-check",
      "Show two checks: why one fewer van fails, and why your answer is enough.",
      "4 × 6 = 24 < 29; 5 × 6 = 30 ≥ 29.",
      "The lower count cannot seat everyone. Five vans can, and since four cannot, five is the smallest count that works.",
      undefined,
      "large",
    ),
  ]);
  a.page("share-remainder", "Can the material be split?", [
    text(
      "Seventeen beads shared among five people give three whole beads each, with two beads left. But seventeen meters of ribbon can be cut into five equal lengths. After three meters each, the two remaining meters can also be shared.",
    ),
    diagram({
      kind: "strips",
      id: "sharing-remainder-strip",
      wholeLabel: "one meter",
      rows: [
        {
          label: "each person gets two fifth-meter pieces",
          parts: 5,
          shaded: 2,
        },
      ],
      caption:
        "Cut each of the two remaining meters into fifths. Each person receives one fifth from each meter: 2/5 meter more.",
      alt: "One meter partitioned into five equal sections, with two shaded to represent two fifths of a meter.",
    }),
    note(
      "Optional fraction connection",
      "Whole objects may need to stay whole. A length or another divisible quantity can have a fractional share. The question must tell us what is allowed.",
      "connect",
    ),
    task(
      "share-whole",
      "Share 22 counters among 4 people as equally as possible, keeping every counter whole and setting leftovers aside.",
      "5 counters each, with 2 counters set aside.",
      "Four groups of five use twenty. Two whole counters cannot give one more to every person.",
      undefined,
      "short",
    ),
    task(
      "share-divisible",
      "Cut 22 meters of ribbon into 4 equal lengths with nothing left. How long is each piece?",
      "5 1/2 meters.",
      "First give five meters to each piece, using twenty. Divide the remaining two meters into four equal half-meter lengths. Add a half meter to each share.",
      "4 × 5 1/2 = 22 meters.",
      "medium",
    ),
  ]);
  a.page("remainder-check", "Is there another full group hiding?", [
    worked(
      "An equation can be true but unfinished",
      "A learner writes 28 ÷ 6 = 3 remainder 10.",
      [
        "3 × 6 + 10 does equal 28.",
        "But ten leftover items contain another full group of six.",
        "Move that group into the group count: 4 groups, with 4 left.",
      ],
      "The remainder must be at least zero and smaller than the positive divisor.",
    ),
    task(
      "remainder-repair",
      "Repair 35 ÷ 8 = 3 remainder 11. Explain why the original remainder is too large.",
      "35 ÷ 8 = 4 remainder 3.",
      "Eleven contains another group of eight. Move that group into the quotient, leaving three.",
      "4 × 8 + 3 = 35 and 0 ≤ 3 < 8.",
      "large",
    ),
    task(
      "remainder-invent",
      "Invent a total that gives quotient 4 and remainder 2 when divided by 5. Explain why your total works.",
      "22.",
      "Four groups of five use twenty. Add the two leftover items to get twenty-two.",
      "4 × 5 + 2 = 22; the remainder two is less than five.",
      "large",
    ),
  ]);
  a.page("compare", "Times as many is not more than", [
    diagram({
      kind: "double-line",
      id: "comparison-lines",
      topLabel: "copies of one set",
      bottomLabel: "buttons",
      pairs: [
        { top: [0, 1], bottom: [0, 1] },
        { top: [1, 1], bottom: [6, 1] },
        { top: [4, 1], bottom: [24, 1] },
      ],
      caption:
        "One set has six buttons. Four times that amount is four copies of six: twenty-four.",
      alt: "Aligned scales show one copy corresponding to six buttons and four copies to twenty-four.",
    }),
    text(
      "Four times six means 4 × 6 = 24. Four more than six means 6 + 4 = 10. Multiplicative comparison makes equal copies of a reference amount; additive comparison adds a difference.",
    ),
    task(
      "compare-times",
      "Find three times eight and three more than eight. Explain the difference.",
      "24 and 11.",
      "Three times eight makes three copies of eight. Three more than eight adds only three to the starting eight.",
      undefined,
      "medium",
    ),
    task(
      "compare-missing",
      "One display has 32 tiles. That is 4 times as many as a smaller display. How many tiles are in the smaller display?",
      "8 tiles.",
      "Thirty-two is four copies of the smaller count. Divide by four to find one copy.",
      "4 × 8 = 32.",
      "short",
    ),
  ]);
  a.page("factors", "Which rectangles can the tiles make?", [
    array(
      "factor-array",
      3,
      4,
      "Twelve tiles can make this 3-by-4 rectangle. Other arrangements include 1 by 12 and 2 by 6.",
    ),
    text(
      "A factor divides a whole number exactly, with no remainder. Factor pairs name possible rectangular arrays of a fixed count. Turning an array reverses the pair without creating a new pair of factor values.",
    ),
    task(
      "factors-list",
      "Find every factor pair for 18. Explain how you know you did not miss a pair.",
      "1 × 18, 2 × 9, and 3 × 6.",
      "Test possible row counts from one through eighteen. Only 1, 2, 3, 6, 9, and 18 divide eighteen exactly. Pair them as 1 with 18, 2 with 9, and 3 with 6; reversing a pair does not create a new factor pair. A systematic list or correctly labeled arrays can show the check.",
      undefined,
      "large",
      "grid",
    ),
    task(
      "factors-test",
      "Is 5 a factor of 24? Is 4? Explain with equal groups.",
      "5 is not; 4 is.",
      "Four groups of five use twenty with four left. Six groups of four use all twenty-four. A factor must leave no remainder.",
      undefined,
      "short",
    ),
  ]);
  a.page("prime", "Two factors, more than two, or just one?", [
    array(
      "prime-array",
      1,
      7,
      "Seven tiles make a whole-number rectangle only as 1 by 7, or its turn.",
    ),
    text(
      "A prime number is a whole number greater than one with exactly two positive whole-number factors: one and itself. A composite number is a whole number greater than one with more than two positive factors. One has only one positive factor. Zero and one are neither prime nor composite.",
    ),
    task(
      "prime-classify",
      "Classify 11, 12, and 1 as prime, composite, or neither. Give factor evidence.",
      "11 is prime; 12 is composite; 1 is neither.",
      "Eleven has only factors one and eleven. Twelve has additional factors such as two and six. One has only the single positive factor one.",
      undefined,
      "medium",
    ),
    task(
      "prime-claim",
      "A learner says every odd number is prime. Find a counterexample and explain why it works.",
      "Example: 9 is odd but composite.",
      "Nine has the factors one, three, and nine, so it has more than two positive factors. One counterexample disproves the universal claim.",
      undefined,
      "medium",
    ),
  ]);
  a.page("patterns", "Explain why the pattern continues", [
    array(
      "even-product-array",
      4,
      3,
      "Split four rows into two equal pairs of rows. The total becomes two equal whole-number counts.",
      { row: 2 },
    ),
    text(
      "A pattern is more convincing when a reason explains it. Four groups of any whole-number size can be split into two matching sets of two groups. That makes the total even, including zero.",
    ),
    task(
      "pattern-even",
      "Explain why 4 times any whole number is even. Use a picture, words, or an equation.",
      "Four equal groups split into two equal sets, so their total is even.",
      "For a group size n, 4 × n = 2 × n + 2 × n. The two addends are equal whole-number counts. A labeled picture with two matching halves also works.",
      undefined,
      "large",
      "blank",
    ),
    task(
      "pattern-three",
      "The positive multiples 3, 6, 9, 12 alternate odd and even. Explain why adding 3 changes the parity each time.",
      "Adding three switches odd to even or even to odd.",
      "Adding two preserves pairing. Adding one more changes whether an unpaired item is present. Thus each step of three flips parity.",
      undefined,
      "medium",
    ),
  ]);
}
