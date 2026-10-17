import { Author, text, note } from "./authoring.js";
import { collection, frame } from "./models.js";
export function addStories(a: Author) {
  a.section = "stories";
  a.page("join", "More join the group", [
    frame("join-six-three", 9, "6 counters were here. 3 new counters joined.", {
      emphasized: [6, 7, 8],
      legend: "New counters",
    }),
    text("6 + 3 = 9"),
    a.task(
      "join-story",
      "Build 4 counters. Add 2. Draw the whole group.",
      "6 counters.",
      "The original four and the arriving two form one collection of six. Count every member of both parts once. The symbol + describes combining the quantities, while = states that the expression and the total name the same amount.",
      "4 + 2 = 6.",
      "large",
    ),
  ]);
  a.page("take-away", "Some leave the group", [
    frame("remove-nine-four", 9, "Start with 9. These 4 will leave.", {
      emphasized: [5, 6, 7, 8],
      legend: "To remove",
    }),
    a.task(
      "remove-four",
      "Cover the 4 that leave. How many stay?",
      "5 counters.",
      "Nine is the starting whole. Removing four leaves five counters that are not covered. The marked counters are a part to remove, not new arrivals; the legend changes the action even though both stories use highlighting.",
      "5 + 4 = 9, so 9 − 4 = 5.",
      "large",
    ),
    note(
      "Tell the action",
      "What does the picture show before you cover anything?",
      "connect",
    ),
  ]);
  a.page("parts-no-move", "Parts can stay still", [
    collection(
      "twelve-parts",
      [
        { label: "Part A", count: 7, arrangement: "rows" },
        { label: "Part B", count: 5, arrangement: "rows" },
      ],
      "Two parts of one collection. No counters arrive or leave.",
      "comparison",
    ),
    text("7 + 5 = 12"),
    a.task(
      "parts-whole",
      "There are 12 counters altogether. One part has 7. How many are in the other part?",
      "5 counters.",
      "A part–whole question does not require an action over time. The entire collection has twelve counters, with seven in one disjoint group and five in the other. The relation can be recorded as 7 + 5 = 12 or 12 − 7 = 5.",
      "Both parts together must account for all twelve counters exactly once.",
      "large",
    ),
  ]);
  a.page("unknown-change-story", "How many joined?", [
    collection(
      "unknown-change-mats",
      [
        { label: "Start", count: 8, arrangement: "rows" },
        { label: "Finish", count: 13, arrangement: "rows" },
      ],
      "Only new counters joined. None left.",
      "comparison",
    ),
    a.task(
      "unknown-change",
      "We started with 8. Now there are 13. How many joined?",
      "5 counters.",
      "The new part is the difference between the starting eight and the final thirteen. Pair eight counters in the finish with the eight original counters; the five unmatched counters are the arrivals. Counting on 9, 10, 11, 12, 13 also gives five new counters.",
      "8 + 5 = 13.",
      "large",
    ),
  ]);
  a.page(
    "unknown-start-story",
    "What was there first?",
    [
      collection(
        "six-remaining",
        [{ label: "Finish", count: 6, arrangement: "rows" }],
        "4 counters went away. These 6 remain.",
      ),
      a.task(
        "unknown-start",
        "Draw the collection before the 4 left. How many were there?",
        "10 counters.",
        "The starting collection includes both the six remaining counters and the four that left. Put those parts together to recover ten. Taking four away from the stated six would model another removal, not reconstruct the original amount.",
        "10 − 4 = 6.",
        "extended",
      ),
    ],
    "workshop",
  );
  a.page("more-than", "More than is a comparison", [
    collection(
      "compare-eight-five",
      [
        { label: "A", count: 8, arrangement: "rows" },
        { label: "B", count: 5, arrangement: "rows" },
      ],
      "Both groups are already here.",
      "comparison",
    ),
    a.task(
      "compare-difference",
      "How many more counters does A have than B? Show a match.",
      "3 more counters.",
      "Match five counters in A with the five counters in B. Three counters in A remain unmatched. The word “more” describes a difference here; it does not instruct the learner to combine eight and five.",
      "5 + 3 = 8.",
      "large",
    ),
    note(
      "Choose the question",
      "“How many altogether?” would ask for a different count.",
      "connect",
    ),
  ]);
  a.page(
    "invent-story",
    "You tell the story",
    [
      a.task(
        "invent-seven-three",
        "Make a story for 7 − 3 = 4. Draw the start, the part that leaves, and the finish.",
        "Any removal story with 7 at the start, 3 removed and 4 remaining.",
        "For example, seven toy cars are parked; three drive away; four remain. The counted unit should stay consistent through the story. An equation copied beside an unrelated picture does not demonstrate the relationship.",
        "Recombine the three removed and four remaining objects to check the original seven.",
        "extended",
      ),
      note(
        "Swap",
        "Ask a partner to tell the story from your drawing.",
        "connect",
      ),
    ],
    "workshop",
  );
}
