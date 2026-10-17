import { Author, text, note } from "./authoring.js";
import { frame, tens } from "./models.js";
export function addStrategies(a: Author) {
  a.section = "strategies";
  a.page("bridge-add", "Stop at ten", [
    frame("eight-plus-five", 13, "Start with 8. Add these 5.", {
      frames: 2,
      emphasized: [8, 9, 10, 11, 12],
      legend: "The 5 added counters",
    }),
    text("2 of the 5 fill the first frame. 3 are left for the next frame."),
    text("8 + 5 = 10 + 3 = 13"),
    a.task(
      "bridge-add-parts",
      "How did the 5 split? Show both parts.",
      "2 and 3.",
      "Eight needs two more to reach ten. Those two are taken from the addend of five, so three of that addend remain. The split preserves all five added counters; it does not create two extra counters in addition to the original five.",
      "2 + 3 = 5, and 8 + 2 + 3 = 13.",
      "large",
    ),
  ]);
  a.page(
    "bridge-add-try",
    "Build your bridge",
    [
      a.task(
        "nine-plus-four",
        "Show 9 + 4 by making ten first.",
        "13; split the 4 into 1 and 3.",
        "One of the four added counters completes the ten with nine. Three of the four remain, giving ten and three. A valid drawing accounts for all nine original counters and all four new counters exactly once.",
        "9 + 1 + 3 = 10 + 3 = 13. The friend’s 9 + 1 + 4 totals 14 and adds 5 counters, not the requested 4.",
        "extended",
      ),
      note(
        "Check a claim",
        "A friend writes 9 + 1 + 4. Did the friend keep the same four added counters?",
        "misconception",
      ),
    ],
    "workshop",
  );
  a.page("bridge-subtract", "Take away through ten", [
    frame(
      "thirteen-minus-five",
      13,
      "Start with 13. The marked 5 will be removed.",
      { frames: 2, emphasized: [8, 9, 10, 11, 12], legend: "To remove" },
    ),
    text("Take 3 to reach 10. Take 2 more to reach 8."),
    a.task(
      "bridge-subtract-parts",
      "After taking 3 of the 5, how many are still to take?",
      "2.",
      "The removal of five is split into three and two. The first three reduce thirteen to ten; the remaining two reduce ten to eight. Taking another five after the first three would remove eight altogether.",
      "3 + 2 = 5; 13 − 3 − 2 = 8.",
      "large",
    ),
  ]);
  a.page(
    "bridge-subtract-try",
    "Choose the pieces",
    [
      a.task(
        "fourteen-minus-six",
        "Show 14 − 6 by reaching ten first.",
        "8; remove 4, then 2.",
        "Four of the six removals take fourteen down to ten. Two more removals complete the total removal of six, leaving eight. The split belongs to the subtracted amount; the whole is not changed before the subtraction begins.",
        "14 − 4 − 2 = 8 and 8 + 6 = 14.",
        "extended",
      ),
      note(
        "Another way",
        "You may ask: “What joins 6 to make 14?” Explain how that checks your result.",
        "connect",
      ),
    ],
    "workshop",
  );
  a.page("near-doubles", "One more than a double", [
    frame("six-and-six", 12, "6 and 6 make 12.", {
      frames: 2,
      emphasized: [6, 7, 8, 9, 10, 11],
      legend: "The second group of 6",
    }),
    a.task(
      "near-double",
      "What changes when 6 + 6 becomes 6 + 7? Find the new total.",
      "One counter is added, so the total is 13.",
      "The first addend stays six. The second addend increases from six to seven, adding exactly one counter to the whole. The total therefore increases from twelve to thirteen. This reasoning connects the two sums rather than treating them as unrelated facts.",
      "6 + 7 = 6 + 6 + 1 = 13.",
      "large",
    ),
  ]);
  a.page("tens-as-units", "Count the tens", [
    tens("five-tens", 5, 0, "2 tens and 3 tens make 5 tens.", {
      emphasizedTens: [2, 3, 4],
      legend: "The 3 added tens",
    }),
    text("20 + 30 = 50"),
    a.task(
      "tens-minus",
      "Start with 4 tens. Remove 1 ten. Name what remains in tens and in ones.",
      "3 tens; 30 ones.",
      "The subtraction is four ten-units minus one ten-unit, leaving three ten-units. Each ten-unit contains ten ones, so the same quantity is thirty ones. Saying three without its unit would leave the amount unclear in this task.",
      "40 − 10 = 30.",
      "large",
    ),
  ]);
  a.page("combine-units", "Tens with tens. Ones with ones.", [
    tens("twenty-four-add", 2, 4, "Start with 24."),
    a.task(
      "add-24-13",
      "Add 1 ten and 3 ones. Draw the result.",
      "37; 3 tens and 7 ones.",
      "Combine the original two tens with one additional ten to obtain three tens. Combine four loose ones with three new ones to obtain seven ones. There are fewer than ten loose ones, so no exchange is needed.",
      "24 + 13 = 30 + 7 = 37.",
      "extended",
    ),
  ]);
  a.page("new-ten", "Enough ones for a new ten", [
    tens("two-tens-fifteen", 2, 15, "27 + 8 gives 2 tens and 15 ones."),
    tens("three-tens-five", 3, 5, "Trade 10 loose ones for 1 ten."),
    a.task(
      "new-ten-result",
      "Name the total. Explain where the new ten came from.",
      "35; the new ten came from 10 of the 15 loose ones.",
      "The original seven ones and eight added ones make fifteen ones. Ten of these are regrouped into one ten-unit, leaving five loose ones. With the original two tens, there are three tens and five ones. The trade preserves the quantity.",
      "20 + 15 = 30 + 5 = 35.",
      "medium",
    ),
  ]);
  a.page("unpack-for-subtraction", "Unpack before you take", [
    tens("forty-two-before", 4, 2, "Start with 42."),
    tens("forty-two-unpacked", 3, 12, "The same 42, ready to remove 16.", {
      emphasizedTens: [2],
      emphasizedOnes: [6, 7, 8, 9, 10, 11],
      legend: "To remove: 1 ten and 6 ones",
    }),
    a.task(
      "remove-sixteen",
      "What remains after removing the marked units?",
      "26; 2 tens and 6 ones.",
      "Four tens and two ones can be renamed as three tens and twelve ones by unpacking exactly one ten. Removing one ten and six ones leaves two tens and six ones. The marked six loose squares do not mean subtracting six tens.",
      "42 − 16 = 26, checked by 26 + 16 = 42.",
      "medium",
    ),
  ]);
  a.page(
    "repair-trade",
    "A trade must keep the amount",
    [
      a.task(
        "trade-error",
        "A friend changes 42 into 3 tens and 2 ones. Is that a fair trade? Draw a repair.",
        "No. Three tens and two ones are 32. A correct trade gives 3 tens and 12 ones.",
        "The friend removed a ten-unit without replacing it with ten loose ones. A fair exchange preserves the total number of unit squares. Adding ten loose ones to the original two makes twelve, while three tens remain.",
        "30 + 12 = 42; 30 + 2 = 32.",
        "extended",
      ),
    ],
    "workshop",
  );
  a.page(
    "choose-a-method",
    "Find a useful route",
    [
      text("We want 32 − 9."),
      a.task(
        "subtract-nine",
        "You may take 10 and put 1 back, or unpack a ten. Show your way.",
        "23.",
        "Taking ten gives twenty-two, but that removes one more than the requested nine, so adding one back gives twenty-three. Alternatively rename thirty-two as two tens and twelve ones; remove nine ones to leave two tens and three ones. Both methods preserve the intended difference.",
        "23 + 9 = 32.",
        "extended",
      ),
    ],
    "workshop",
  );
  a.page("equals", "The same amount", [
    text("8 + 4 = 7 + 5"),
    a.task(
      "both-sides-equal",
      "Show why this is true. You can use two collections.",
      "Both sides name 12.",
      "Eight and four combine to twelve, and seven and five also combine to twelve. The equals sign states that the expressions have the same value; it does not require a single numeral immediately after it. One counter can be moved from the eight-part to the four-part to make seven and five.",
      "8 + 4 = 12 and 7 + 5 = 12.",
      "large",
    ),
    a.task(
      "reverse-equality",
      "Is 12 = 9 + 3 also true? Tell why.",
      "Yes. Nine and three make twelve.",
      "Equality works in either direction. The numeral twelve and the expression nine plus three name the same amount even when the expression is on the right.",
      "9 + 3 = 12 and 12 = 9 + 3 express the same equality.",
      "medium",
    ),
  ]);
  a.page(
    "missing-box",
    "Find the missing number",
    [
      a.task(
        "missing-addition",
        "9 + □ = 14. Show the missing part.",
        "5.",
        "The missing addend combines with nine to make fourteen. Counting on five steps or decomposing fourteen into nine and five both establish the answer.",
        "9 + 5 = 14.",
        "large",
      ),
      a.task(
        "missing-start-equation",
        "□ − 5 = 8. Show the starting whole.",
        "13.",
        "The starting whole must contain the eight that remain and the five removed. Combining these parts gives thirteen, rather than subtracting five from eight.",
        "13 − 5 = 8.",
        "large",
      ),
    ],
    "workshop",
  );
}
