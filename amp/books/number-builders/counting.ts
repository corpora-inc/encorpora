import { Author, text, note } from "./authoring.js";
import { collection, frame } from "./models.js";
export function addCounting(a: Author) {
  a.section = "entry";
  a.page(
    "welcome",
    "Number Builders",
    [
      text("Look. Move. Draw. Tell."),
      frame("cover-frame", 7, "A small collection. Many ways to see it."),
      note(
        "Bring a counting partner",
        "Use safe counters or draw your own. A partner can read the words. You do the thinking.",
        "connect",
      ),
    ],
    "opening",
    "Count, compose, and change",
  );
  a.page(
    "route",
    "Choose a place to begin",
    [
      note(
        "LOOK",
        "Can you make a collection and tell how many? Start with “Count your way.”",
        "predict",
      ),
      note(
        "BUILD",
        "Can you find the missing part of ten? Try “Ten has room.”",
        "connect",
      ),
      note(
        "TRADE",
        "Can you show why one ten equals ten ones? Try “One new unit.”",
      ),
      a.task(
        "entry-build",
        "Make 7 counters. Show a partner how you know there are 7.",
        "A collection of seven, with a valid explanation.",
        "The learner may touch each counter once while counting, see five and two more, or use another correct grouping. The final number name should describe the whole collection, not one particular object. A numeral alone does not demonstrate one-to-one counting.",
        "Move the same counters into a new arrangement and ask whether the number changed.",
        "large",
      ),
    ],
    "guide",
  );
  a.section = "counting";
  a.page("count-your-way", "Count your way", [
    collection(
      "seven-counter-mat",
      [{ label: "Your mat", count: 7, arrangement: "spread" }],
      "Touch each counter once.",
    ),
    a.task(
      "count-seven",
      "How many? Show where you started. Tell the whole count.",
      "7 counters.",
      "Any starting point and counting order are valid if every counter receives exactly one number name. The last number said, seven, names the whole collection. Repeating a counter or skipping one breaks the one-to-one match.",
      "Ask the learner to point to the entire group when saying “seven.”",
      "large",
    ),
    note(
      "Try it your way",
      "You may move real counters into a line.",
      "connect",
    ),
  ]);
  a.page(
    "same-seven",
    "Spread them out",
    [
      collection(
        "same-seven-mats",
        [
          { label: "A", count: 7, arrangement: "rows" },
          { label: "B", count: 7, arrangement: "spread" },
        ],
        "The counters moved. None arrived or left.",
        "conserved",
      ),
      a.task(
        "same-seven-predict",
        "Does B have more, fewer, or the same number? Predict. Then check.",
        "The same number: 7 in each mat.",
        "Rearranging a collection does not change how many objects it contains. B may occupy more space, but it has the same seven counters. Pairing each counter in A with one in B verifies equality without treating spacing as quantity.",
        "A one-to-one match leaves no unmatched counter in either mat.",
        "large",
      ),
    ],
    "workshop",
  );
  a.page("empty-mat", "Zero is a number", [
    collection(
      "zero-mat",
      [{ label: "An empty mat", count: 0, arrangement: "rows" }],
      "No counters are on this mat.",
    ),
    text("We write 0 for no counters."),
    a.task(
      "zero-change",
      "Put 1 counter on the mat. Take it away. How many now? Draw the empty mat.",
      "0 counters.",
      "The collection changes from zero to one and back to zero. An empty collection has a definite count; it is not an unanswered question. The drawn boundary can remain visible even though no counters are inside it.",
      "0 + 1 = 1 and 1 − 1 = 0.",
      "extended",
    ),
  ]);
  a.page("one-more", "One more joins", [
    collection(
      "one-more-five",
      [
        { label: "Start", count: 4, arrangement: "rows" },
        { label: "Finish", count: 5, arrangement: "rows" },
      ],
      "One new counter joins the four.",
      "comparison",
    ),
    a.task(
      "one-more-six",
      "Build 5. Add 1. What is the new whole count?",
      "6 counters.",
      "Adding one object gives the next number in the counting sequence. The learner can count all six or recognize that the next number after five is six. The new counter is part of the whole, not a separate collection to ignore.",
      "Remove the new counter: the original five should remain.",
      "large",
    ),
  ]);
  a.page("matching", "Match a partner", [
    collection(
      "compare-six-eight",
      [
        { label: "A", count: 6, arrangement: "rows" },
        { label: "B", count: 8, arrangement: "rows" },
      ],
      "Each counter counts as one.",
      "comparison",
    ),
    a.task(
      "compare-sets",
      "Which mat has more? Draw a match for each counter in A.",
      "B has more; 2 counters in B are unmatched.",
      "Six counters in B can be paired with the six counters in A. Two additional counters remain in B, so B has two more. The comparison is based on matched quantities, not the size or spacing of the drawing.",
      "6 + 2 = 8.",
      "large",
    ),
  ]);
  a.page(
    "same-eight",
    "A bigger space?",
    [
      collection(
        "eight-rearranged",
        [
          { label: "A", count: 8, arrangement: "rows" },
          { label: "B", count: 8, arrangement: "spread" },
        ],
        "Look at the counters, not the space between them.",
        "conserved",
      ),
      a.task(
        "spacing-error",
        "A friend says, “B takes more space, so B has more.” Show a better way to decide.",
        "Both have 8. Count or match the counters.",
        "Space between objects is not another counted object. A one-to-one match or a count of each group gives eight in both collections. A useful explanation names what is being counted and why spreading it out preserves that count.",
        "No counter is added or removed in a rearrangement.",
        "large",
      ),
    ],
    "workshop",
  );
  a.page(
    "make-a-collection",
    "Make a collection",
    [
      a.task(
        "draw-nine",
        "Draw 9 small things. Put them in a way that helps a partner count.",
        "Any clearly countable collection of 9 objects.",
        "A row, a compact arrangement or smaller groups are all valid. Check that the learner has nine individual objects and can identify each once. If the drawing is hard to count, rearrange real counters before drawing again.",
        "Ask the partner to describe how the arrangement helped.",
        "extended",
      ),
      a.task(
        "name-collection",
        "Write the numeral for your collection. Tell what it names.",
        "9; it names the number of objects in the whole collection.",
        "The written numeral records the count of the collection. It is not the label of only the ninth object touched. Adult transcription is useful if handwriting is difficult, but record that support separately from numeral-writing evidence.",
        "Count the drawn objects and compare with the recorded numeral.",
        "short",
        "lines",
      ),
    ],
    "workshop",
  );
}
