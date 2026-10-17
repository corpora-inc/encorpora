import { Author, text, note } from "./authoring.js";
import { tens } from "./models.js";
export function addTens(a: Author) {
  a.section = "tens";
  a.page("one-new-unit", "One new unit", [
    tens("ten-loose", 0, 10, "10 loose ones."),
    tens("one-ten", 1, 0, "The same amount: 1 ten."),
    a.task(
      "ten-exchange",
      "Trace the little squares in the ten-strip. How many ones does it hold?",
      "10 ones.",
      "A ten-strip is composed of ten equal unit squares. Its value comes from those ten units, not merely from being longer or a different color. Trading ten singles for the strip preserves the number of ones.",
      "Put ten loose unit squares beside the strip, one for each of its ten cells.",
      "medium",
    ),
  ]);
  a.page("name-twenty-four", "Two tens and four ones", [
    tens(
      "twenty-four",
      2,
      4,
      "Each strip is a ten. Each small square is a one.",
    ),
    text("20 + 4 = 24"),
    a.task(
      "name-24",
      "Tell the number of tens. Tell the number of loose ones. Name the whole.",
      "2 tens, 4 loose ones; 24 altogether.",
      "Two ten-units contain twenty ones. Four additional unit squares make twenty-four. The count of pieces on the page is not the same as the total number of ones represented: two rods and four loose squares are six pieces but twenty-four unit squares.",
      "10 + 10 + 4 = 24.",
      "large",
    ),
  ]);
  a.page("trade-back", "Unpack one ten", [
    tens("trade-24-before", 2, 4, "Before: 2 tens and 4 ones."),
    tens("trade-24-after", 1, 14, "After: 1 ten and 14 ones."),
    a.task(
      "trade-24",
      "Did the amount change? Show how you know.",
      "No. Both representations name 24.",
      "One of the original ten-units was replaced by ten loose ones. Added to the original four loose ones, that makes fourteen loose ones, with one ten still grouped. No unit square was lost or added.",
      "20 + 4 = 10 + 14 = 24.",
      "large",
    ),
  ]);
  a.page(
    "another-name",
    "Two names. One number.",
    [
      a.task(
        "rename-32",
        "Draw 32 as 3 tens and 2 ones. Now show it with one fewer ten.",
        "3 tens and 2 ones; or 2 tens and 12 ones.",
        "Replace exactly one ten-unit with ten loose ones. The number of tens decreases by one while the number of loose ones increases by ten. Simply erasing a rod would change the amount to twenty-two.",
        "30 + 2 = 20 + 12 = 32.",
        "extended",
      ),
      note(
        "Explain the trade",
        "What left the tens group? What joined the ones group?",
        "connect",
      ),
    ],
    "workshop",
  );
  a.page("zero-ones", "Zero holds a place", [
    tens("forty", 4, 0, "4 tens and no loose ones."),
    text("We write 40."),
    a.task(
      "forty-or-four",
      "A friend writes 4 for this amount. What is missing?",
      "The zero in 40 shows there are no loose ones; the 4 names four tens.",
      "The diagram contains four ten-units, equivalent to forty ones. Writing only 4 names four ones in ordinary base-ten notation. The zero keeps the four in the tens place and records that the ones count is zero.",
      "10 + 10 + 10 + 10 = 40.",
      "large",
    ),
  ]);
  a.page("compare-tens", "Look at the units", [
    tens("forty-two", 4, 2, "A: 4 tens and 2 ones."),
    tens("twenty-four-compare", 2, 4, "B: 2 tens and 4 ones."),
    a.task(
      "compare-42-24",
      "Which amount is greater? Explain with the tens.",
      "42 is greater than 24.",
      "Four tens already contain more units than two tens and four ones. A larger ones digit does not necessarily make the whole number larger. Compare the values represented by the digits, beginning with the tens for these two-digit numbers.",
      "42 > 24.",
      "medium",
    ),
  ]);
  a.page("same-tens", "When the tens match", [
    tens("thirty-six", 3, 6, "A: 36."),
    tens("thirty-nine", 3, 9, "B: 39."),
    a.task(
      "compare-36-39",
      "Both amounts have 3 tens. What decides which is greater?",
      "The ones: 9 ones exceed 6 ones, so 39 is greater.",
      "The three ten-units in each collection can be matched exactly. The remaining comparison is six loose ones against nine loose ones. Three extra ones make thirty-nine larger.",
      "36 < 39; 36 + 3 = 39.",
      "medium",
    ),
  ]);
  a.page(
    "change-one-ten",
    "Change one ten",
    [
      tens("thirty-four", 3, 4, "Start with 34."),
      a.task(
        "ten-more",
        "Add 1 ten. What is the new amount? Which digit changes?",
        "44. The tens digit changes from 3 to 4; the ones digit stays 4.",
        "A new ten-unit adds ten ones to the total. No loose ones are added or removed, so the ones count stays four. The learner can draw one extra rod rather than recount every unit square.",
        "34 + 10 = 44.",
        "large",
      ),
      a.task(
        "ten-less",
        "Go back to 34. Remove 1 ten. What remains?",
        "24.",
        "Removing one ten from three tens leaves two tens, with the original four loose ones unchanged. This is ten less, not one less.",
        "34 − 10 = 24.",
        "medium",
      ),
    ],
    "workshop",
  );
}
