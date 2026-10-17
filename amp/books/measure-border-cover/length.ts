import { Author, text, note, rectangle, ruler, worked } from "./authoring.js";
export function length(a: Author) {
  a.page(
    "welcome",
    "Measure, Border, Cover",
    [
      text(
        "A courtyard needs a ribbon for its opening ceremony and tiles for its floor. The same place asks two different questions: how far around, and how much inside? A good measurer chooses the quantity before choosing a calculation.",
      ),
      rectangle(
        "welcome-courtyard",
        6,
        4,
        "One courtyard. The dark boundary follows the outside; equal squares cover the inside.",
        true,
        "m",
      ),
      note(
        "Your mission",
        "Make a claim, build a picture, and check whether your units tell the same story. You will test designs that look similar but need different amounts of material.",
        "predict",
      ),
    ],
    "opening",
    "Length follows a path. Area covers a region.",
  );
  a.page(
    "route",
    "Pick a starting place",
    [
      text(
        "Start with the three invitations on the next page. Explain aloud or sketch; a fast answer is less useful than knowing what you counted.",
      ),
      note(
        "If the ruler feels uncertain",
        "Begin with Count the spaces. Move a finger between marks and connect the distance to a subtraction.",
      ),
      note(
        "If border and cover get mixed up",
        "Begin with Walk the outside, then Build square units. Keep a string and a handful of equal square pieces nearby.",
      ),
      note(
        "If both feel secure",
        "Try Compare, then the design studio. Return to a model whenever a formula stops making sense.",
      ),
      text(
        "Work on one or two pages, then pause. Mix a familiar question into the next session. Keep sketches: they reveal whether your explanation still works when a shape changes.",
      ),
    ],
    "guide",
  );
  a.page(
    "entry-check",
    "Three different jobs",
    [
      rectangle(
        "entry-garden",
        5,
        3,
        "A garden drawn with 1 m square units.",
        true,
        "m",
      ),
      a.task(
        "entry-quantities",
        "A fence follows the entire outside. Grass covers the inside. Find each amount and name its unit.",
        "16 m of fence; 15 square meters of grass coverage.",
        "The outside has sides 5, 3, 5 and 3 m. The inside has three rows of five 1 m squares. Length and area count different things.",
        "If both answers say meters, revise the coverage unit.",
      ),
      a.task(
        "entry-ruler",
        "A ribbon begins at the 2 cm mark and ends at the 8 cm mark. Is it 8 cm long? Explain.",
        "No. It is 6 cm long.",
        "The ribbon spans six 1 cm intervals, so 8 − 2 = 6. The ending coordinate includes the unused 2 cm before the ribbon.",
      ),
    ],
    "workshop",
  );
  a.section = "length";
  a.page("spaces-not-marks", "Count the spaces", [
    ruler(
      "five-intervals",
      0,
      5,
      1,
      [
        { at: [0, 1], label: "A" },
        { at: [5, 1], label: "B" },
      ],
      "A to B spans five equal intervals. The six numbered marks separate those intervals.",
    ),
    text(
      "A mark has a position. The space between two neighboring whole-number marks has length 1 cm. Counting both endpoints counts one more mark than the number of spaces.",
    ),
    a.task(
      "marks-repair",
      "Nia says, ‘There are six marks from 0 through 5, so AB is 6 cm.’ Repair the explanation using spaces.",
      "AB is 5 cm: five spaces between six marks.",
      "Pair each counted centimeter with a distinct interval: 0–1, 1–2, 2–3, 3–4 and 4–5. The starting mark does not add an interval.",
      undefined,
      "large",
    ),
  ]);
  a.page("start-away-from-zero", "Start away from zero", [
    ruler(
      "shifted-pencil",
      0,
      10,
      1,
      [
        { at: [3, 1], label: "A" },
        { at: [9, 1], label: "B" },
      ],
      "The pencil occupies only the interval from A to B. The arc shows its six-centimeter span.",
      [{ from: [3, 1], to: [9, 1], label: "6 cm" }],
    ),
    worked(
      "Two ways to find the same distance",
      "Find AB.",
      [
        "Count the six spaces from 3 to 9.",
        "Or subtract the starting position from the ending position: 9 − 3 = 6.",
      ],
      "AB is 6 cm. The ending mark alone is not the length.",
    ),
    a.task(
      "shift-invariant",
      "Slide the pencil so A is at 1 cm without stretching it. Where is B? Explain.",
      "B is at 7 cm.",
      "The length stays 6 cm. Starting at 1 and moving 6 gives 7; 7 − 1 is still 6.",
    ),
  ]);
  a.page("fractional-lengths", "A centimeter can be shared", [
    ruler(
      "quarter-ribbon",
      0,
      4,
      4,
      [
        { at: [3, 4], label: "A" },
        { at: [13, 4], label: "B" },
      ],
      "Four small intervals make each centimeter. Each small interval is 1/4 cm.",
    ),
    worked(
      "Count or rename",
      "How long is AB?",
      [
        "From 3/4 to 13/4 there are ten quarter-centimeter intervals.",
        "13/4 − 3/4 = 10/4 = 2 1/2.",
      ],
      "AB is 2 1/2 cm, not ten centimeters.",
    ),
    a.task(
      "quarter-check",
      "A new strip runs from 1 1/4 cm to 3 3/4 cm. Find its length and explain why the number of little spaces is not the answer in centimeters.",
      "2 1/2 cm; ten small spaces each worth 1/4 cm.",
      "15/4 − 5/4 = 10/4. A count becomes a measurement only when the unit size is included.",
    ),
  ]);
  a.page(
    "equal-units",
    "The unit cannot change halfway",
    [
      text(
        "Imagine measuring a shelf with identical paper strips. Place the end of one strip against the start of the next. A gap leaves length unmeasured; an overlap measures some length twice.",
      ),
      note(
        "A misleading count",
        "One learner uses three long strips. Another uses six strips half as long. They can describe the same shelf. ‘Three’ and ‘six’ alone do not tell you which shelf is longer.",
        "misconception",
      ),
      a.task(
        "strip-repair",
        "Sketch four equal strips end to end. Then draw a faulty four-strip measurement with one overlap. Which arrangement spans less length? Mark the doubly counted part.",
        "The overlapping arrangement spans less length.",
        "Four strip lengths are counted in both drawings, but the overlap covers some of the same shelf twice. Accept a clear overlap and four equal strips, with no gap that changes the comparison.",
        undefined,
        "extended",
        "blank",
      ),
    ],
    "workshop",
  );
  a.page(
    "measure-an-object",
    "Try a real measurement",
    [
      text(
        "Choose a pencil, spoon or book edge. Estimate its length first. Use a real ruler marked in centimeters; the diagrams in this book are schematic and must not be used as life-size rulers.",
      ),
      a.task(
        "real-measure",
        "Record the object, estimate, starting mark, ending mark and measured length. Then move the object to a different starting mark and measure again.",
        "Measurements vary. Both careful measurements should agree within the ruler's precision.",
        "Keep the object straight along the scale. Subtract each starting reading from its ending reading. A different start should not change the object's length; discuss small reading differences rather than inventing exact agreement.",
        undefined,
        "extended",
        "blank",
      ),
      note(
        "No ruler nearby?",
        "Explain how you would measure with equal paper strips, including what to do if a final strip does not fit completely. Return to the real measurement when a ruler is available.",
      ),
    ],
    "workshop",
  );
  a.page(
    "length-retrieval",
    "Change the picture, keep the distance",
    [
      a.task(
        "length-unknown-start",
        "A 7 cm strip ends at the 12 cm mark. Where does it start? Draw a scale or write an equation.",
        "5 cm.",
        "Start + 7 = 12, so the starting coordinate is 12 − 7 = 5. Check that the interval from 5 to 12 has length 7.",
        undefined,
        "large",
        "blank",
      ),
      a.task(
        "length-unit-predict",
        "The same table is measured in centimeters and meters. Which number will be larger? Explain without guessing the table's size.",
        "The number of centimeters is larger.",
        "A centimeter is a smaller length unit, so more of them are needed to cover the same distance. One meter contains 100 centimeters.",
      ),
      note(
        "Keep this distinction",
        "Moving the starting mark changes position. Changing the unit changes the numerical measure. Neither action stretches the object.",
        "connect",
      ),
    ],
    "reflection",
  );
}
