import { Author, text, note } from "./authoring.js";
import { collection, frame } from "./models.js";
export function addPartners(a: Author) {
  a.section = "partners";
  a.page("five-parts", "Five can split", [
    collection(
      "five-two-three",
      [
        { label: "One part", count: 2, arrangement: "rows" },
        { label: "Another part", count: 3, arrangement: "rows" },
      ],
      "2 and 3 make 5.",
      "comparison",
    ),
    text("Keep all 5 counters. Slide them into two parts."),
    a.task(
      "five-another-split",
      "Show a different split of 5. Tell both parts.",
      "Valid pairs include 0 and 5, 1 and 4, 4 and 1, or 5 and 0. Reversing 2 and 3 also preserves the whole.",
      "The parts must be disjoint and together include all five counters. Splitting means moving counters between parts without creating or losing any. If the learner reverses two and three, acknowledge the valid reversed order and invite a different pair of sizes as an extension.",
      "Count both parts together: the whole must still be five.",
      "extended",
    ),
  ]);
  a.page("covered-part", "Hide a part", [
    frame("hidden-five", 5, "There are 5 counters altogether.", {
      emphasized: [0, 1],
      legend: "These 2 stay visible",
    }),
    text("Cover the other counters with your hand."),
    a.task(
      "hidden-part",
      "You can see 2. There are 5 altogether. How many are covered?",
      "3 counters.",
      "The whole contains the visible two and the covered part. Three more complete five. The learner can cover the three counters, count on from two or use the pair two and three. The five is the whole, not another part to add to two.",
      "2 + 3 = 5. Uncover to check.",
      "large",
    ),
  ]);
  a.page("see-seven", "See a five inside seven", [
    frame("seven-as-five-two", 7, "A full row has 5 places."),
    text("5 and 2 make 7."),
    a.task(
      "seven-view",
      "Show the 5. Show the 2. Draw a different way to split 7.",
      "Any two nonnegative parts totaling 7 with different part sizes from the shown 5 and 2, such as 4 and 3.",
      "The frame shows seven occupied places: a row of five and two more. A different split can use four and three, six and one, or another valid pair. Simply reversing five and two preserves the same sizes; acknowledge the equality and invite new part sizes. The arrangement supports seeing groups, but no speed requirement is imposed.",
      "Recombine both parts to check seven.",
      "extended",
    ),
  ]);
  a.page("ten-has-room", "Ten has room", [
    frame("ten-seven", 7, "Every place holds one counter."),
    a.task(
      "seven-to-ten",
      "How many empty places? Draw the counters that fill them.",
      "3 empty places; 3 new counters fill them.",
      "A ten-frame has two rows of five places. Seven places are occupied, leaving three empty. The task asks for the missing part, not the seven counters already present.",
      "7 + 3 = 10. For the prediction: one more filled place leaves only 2 empty places, so fewer new counters are needed.",
      "large",
    ),
    note(
      "Predict",
      "If one more place were filled, would you need more or fewer new counters?",
      "predict",
    ),
  ]);
  a.page(
    "ten-partners",
    "Make ten your way",
    [
      frame("ten-eight", 8, "Count the filled places and the empty places."),
      a.task(
        "eight-to-ten",
        "8 and how many make 10?",
        "2.",
        "Eight counters occupy eight of ten places, leaving two vacancies. Adding two produces the full frame. Counting on from eight requires the two new numbers nine and ten.",
        "8 + 2 = 10.",
        "medium",
      ),
      a.task(
        "invent-ten-pair",
        "Draw a different pair of parts that make 10.",
        "Any pair totaling 10 with different part sizes from the shown 8 and 2, such as 6 and 4 or 5 and 5.",
        "The learner must show a whole of ten separated into two parts. Zero and ten are also valid, though a nonempty split can provide another example. Reversing eight and two preserves the shown part sizes; invite a new pair of sizes. Color is optional; a boundary or labels can distinguish parts.",
        "Count both parts together, not each part as a separate whole of ten.",
        "large",
      ),
    ],
    "workshop",
  );
  a.page("full-ten", "No empty places", [
    frame("ten-full", 10, "The frame is full."),
    a.task(
      "full-ten-empty",
      "How many more counters fit in the empty places? Explain.",
      "0; no places are empty.",
      "All ten places already hold counters. There are zero vacancies, even though ten counters are visible. Distinguishing what is being counted prevents answering ten to a question about empty places.",
      "10 + 0 = 10.",
      "large",
    ),
  ]);
  a.page("teen-team", "A ten and three more", [
    frame("thirteen-frame", 13, "One full ten-frame and 3 extra ones.", {
      frames: 2,
    }),
    text("10 + 3 = 13"),
    a.task(
      "name-thirteen",
      "Point to the ten. Point to the extra ones. What is the whole count?",
      "13 counters.",
      "The full first frame represents ten ones, not one object. The second frame contributes three more ones. Together they make thirteen. Calling the first frame “one ten” names a new unit, while the total is counted in ones.",
      "10 + 3 = 13.",
      "large",
    ),
  ]);
  a.page(
    "teen-repair",
    "One ten is not one one",
    [
      frame("fourteen-frame", 14, "The full frame contains 10 counters.", {
        frames: 2,
      }),
      a.task(
        "teen-digit-error",
        "A friend says, “One full frame and 4 ones make 5.” Help the friend.",
        "They make 14, because a full frame contains 10 ones.",
        "The friend mixed units by treating one ten as one loose counter. Count the ten occupied places in the full frame, then the four additional counters. One ten plus four ones equals fourteen ones.",
        "10 + 4 = 14, not 1 + 4.",
        "large",
      ),
    ],
    "workshop",
  );
  a.page(
    "teen-build",
    "Build a teen",
    [
      a.task(
        "build-sixteen",
        "Draw 1 ten and 6 extra ones. Name your number.",
        "16.",
        "One ten contains ten ones. Six additional ones make sixteen. A full ten-frame, a clearly subdivided ten-strip or ten grouped marks can represent the ten; one unlabelled large object should not silently stand for ten.",
        "10 + 6 = 16. After moving one extra counter away, 15 remain; the full ten is unchanged.",
        "extended",
      ),
      note(
        "Change it",
        "Move one extra counter away. Tell the new count and what stayed the same.",
        "connect",
      ),
    ],
    "workshop",
  );
}
