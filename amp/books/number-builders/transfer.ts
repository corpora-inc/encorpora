import { Author, text, note } from "./authoring.js";
export function addTransfer(a: Author) {
  a.section = "transfer";
  a.page(
    "picnic",
    "Ready for a picnic?",
    [
      text("We have 18 cups. We give 6 away. Then 5 more arrive."),
      a.task(
        "picnic-cups",
        "Show both changes. How many cups do we have now?",
        "17 cups.",
        "Begin with 18 cups. Removing 6 leaves 12; adding the 5 arriving cups makes 17. A drawing should show which cups remain after the first action and which arrive afterward. An equivalent method is to notice that 6 left and only 5 arrived, so the final count is one less than 18.",
        "18 − 6 + 5 = 17. The cups given away at the first step are not counted again.",
        "extended",
      ),
      note(
        "Tell your partner",
        "Which part of your picture shows the cups that arrive?",
        "connect",
      ),
    ],
    "workshop",
  );
  a.page(
    "number-message",
    "Send a number message",
    [
      text("Choose a number from 23 to 39. Keep it secret!"),
      a.task(
        "secret-number",
        "Draw two ways to build your number with tens and ones. Ask a partner to name it.",
        "Answers vary; both drawings must have the same total between 23 and 39.",
        "For example, 27 can be shown as 2 tens and 7 ones, or as 1 ten and 17 ones. Each rod represents ten unit squares. A partner should recover the same total from both drawings. Rotating a rod does not change its value; changing the number of unit squares would.",
        "For 27, 20 + 7 = 10 + 17. Do not write the secret numeral until the partner has tried.",
        "extended",
      ),
      note(
        "Switch jobs",
        "Let your partner make a new message for you.",
        "predict",
      ),
    ],
    "workshop",
  );
  a.page(
    "mixed-return",
    "Pick a helpful tool",
    [
      a.task(
        "mixed-ten",
        "There are 6 counters in a ten-frame. How many more fill it? Show your idea.",
        "4 counters.",
        "A ten-frame has ten places. Six occupied places leave four empty places. The learner can draw the four vacancies, count on four steps from six, or use the known partner 6 + 4 = 10.",
        "Count both parts together to check that the completed frame has ten counters.",
        "large",
      ),
      a.task(
        "mixed-units",
        "Which is larger: 32 or 23? Show why.",
        "32 is larger.",
        "Thirty-two has three tens and two ones; twenty-three has two tens and three ones. Three tens already exceed two tens and three ones. Looking only at the ones digit would incorrectly favor 23.",
        "One valid drawing compares 3 rods and 2 squares with 2 rods and 3 squares.",
        "large",
      ),
    ],
    "workshop",
  );
  a.page(
    "later-return",
    "Try another day",
    [
      text("Put away the examples. Build or draw if you want."),
      a.task(
        "later-missing",
        "Some counters were on the mat. We took away 3. Now there are 7. How many were there at the start?",
        "10 counters.",
        "The original collection contains the seven remaining counters and the three removed counters. Combining those parts gives ten. The unknown is the start, so subtracting three from the stated remainder would answer a different question.",
        "10 − 3 = 7.",
        "large",
      ),
      a.task(
        "later-trade",
        "Can 1 ten and 15 ones name the same number as 2 tens and 5 ones? Show why.",
        "Yes. Both name 25.",
        "Ten of the fifteen ones can be exchanged for a ten-unit. Together with the original ten-unit, that makes two tens, with five loose ones left. The trade preserves all twenty-five unit squares.",
        "10 + 15 = 20 + 5 = 25.",
        "large",
      ),
    ],
    "workshop",
  );
  a.page(
    "reflection",
    "What can you show?",
    [
      a.task(
        "show-a-change",
        "Invent a tiny story where something changes. Draw the start and the finish. Tell your partner what happened.",
        "Answers vary; the drawing and story must agree about the starting amount, the change and the final amount.",
        "A valid example begins with 8 blocks, adds 2, and finishes with 10. A take-away story is also valid if the removed amount does not exceed the starting amount. Ask the learner to point to the change rather than requiring a particular equation format.",
        "Count or recombine the parts to check the story.",
        "extended",
      ),
      note(
        "Choose a next step",
        "Which picture helped you? Which idea would you like to build again?",
        "connect",
      ),
    ],
    "reflection",
  );
}
