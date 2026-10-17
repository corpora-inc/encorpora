import {
  Author,
  text,
  note,
  region,
  elbow,
  ruler,
  rectangle,
} from "./authoring.js";
export function studio(a: Author) {
  a.section = "studio";
  a.page(
    "studio-courtyard",
    "Design a reading courtyard",
    [
      text(
        "A rectangular courtyard must have positive whole-number side lengths, area 36 square meters, and at most 26 m of fence around its entire boundary. A turn counts as the same design. There is no gateway in this plan.",
      ),
      a.task(
        "courtyard-design",
        "Find all allowed rectangles. Make a dimensions, area and perimeter table. Recommend one design and explain your choice without claiming it is the only acceptable one.",
        "4 m by 9 m and 6 m by 6 m both qualify. A reasoned recommendation may choose either.",
        "The factor pairs are 1×36, 2×18, 3×12, 4×9 and 6×6. Their perimeters are 74, 40, 30, 26 and 24 m. Only the last two meet the fence limit. A 6×6 plan uses less fence; a 4×9 plan might suit a long narrow site, if that preference is stated.",
        "A recommendation must preserve both given conditions; an added preference is a reason, not a new requirement.",
        "extended",
        "grid",
      ),
      note(
        "A design is an argument",
        "Show why your chosen plan works and why your search has not missed another permitted plan.",
      ),
    ],
    "workshop",
  );
  a.page(
    "studio-floor",
    "Order floor covering and edge trim",
    [
      region(
        "studio-floor-region",
        { unit: "m", cells: elbow(), showGrid: true },
        "An L-shaped floor. Each grid square is 1 m by 1 m.",
      ),
      a.task(
        "floor-order",
        "Floor covering costs $3 per square meter and can be bought in the exact area needed. Trim costs $2 per meter and can be bought in the exact length needed. Find both costs and the total. No waste or tax is added.",
        "Covering: 24 × $3 = $72. Trim: 22 × $2 = $44. Total $116.",
        "The area is 24 square meters, found by disjoint rectangles or counting squares. The outside boundary is 22 m, including the indentation. Different prices multiply different measures.",
        "Swapping 24 and 22 changes the order because square meters and meters are not interchangeable.",
        "large",
      ),
    ],
    "workshop",
  );
  a.page(
    "studio-impossible",
    "Repair an impossible brief",
    [
      text(
        "A poster must be a rectangle with positive whole-number side lengths, area 12 square units, and perimeter at most 12 units. Rotation does not create a new option.",
      ),
      a.task(
        "impossible-brief",
        "Prove that no allowed rectangle meets the brief. Then change only the perimeter limit by the smallest whole-number amount that permits a solution.",
        "No solution under 12. Raise the limit by 2 to 14 units; 3×4 qualifies.",
        "The factor pairs 1×12, 2×6 and 3×4 have perimeters 26, 16 and 14. Thus 14 is the smallest perimeter in the allowed set. Increasing the limit to 13 still permits none.",
        "The proof is limited to the stated whole-number rectangles; it does not claim every shape with area 12 needs perimeter at least 14.",
        "extended",
        "grid",
      ),
      note(
        "Useful failure",
        "A complete list can prove impossibility. One unsuccessful sketch cannot.",
        "connect",
      ),
    ],
    "workshop",
  );
  a.page(
    "studio-invent",
    "Invent a fair challenge",
    [
      a.task(
        "invent-design",
        "Create a rectangle challenge with a fixed whole-number area and a perimeter limit. Use an area no greater than 24 square units. Make at least one allowed whole-number solution, then write a complete answer key with rotations counted once.",
        "Answers vary. Example: area 18, perimeter at most 20; only 3×6 qualifies.",
        "For the example, factor pairs 1×18, 2×9 and 3×6 have perimeters 38, 22 and 18. Accept another area and limit only when its full factor-pair list is correct, at least one option qualifies, and every accepted option meets both conditions.",
        "Give the question to someone else. A disagreement may reveal an unstated rule or a missed option.",
        "extended",
        "grid",
      ),
      note(
        "Check before sharing",
        "Your key must test all allowed pairs, not just the pair you hoped a solver would choose.",
      ),
    ],
    "workshop",
  );
  a.page(
    "mixed-measures",
    "Three ideas in one sitting",
    [
      ruler(
        "mixed-scale",
        0,
        6,
        2,
        [
          { at: [3, 2], label: "A" },
          { at: [11, 2], label: "B" },
        ],
        "A half-centimeter scale. Read positions, then find a distance.",
      ),
      a.task(
        "mixed-distance",
        "Find AB. Rename the length in millimeters.",
        "4 cm = 40 mm.",
        "5.5 − 1.5 = 4 cm. Each centimeter is 10 millimeters, so 4 × 10 = 40.",
      ),
      a.task(
        "mixed-rectangle",
        "A rectangle has area 28 square centimeters and width 4 cm. Find its length and perimeter.",
        "Length 7 cm; perimeter 22 cm.",
        "28 ÷ 4 = 7. Then 7 + 4 + 7 + 4 = 22. The area information determines a factor; the perimeter adds side lengths.",
      ),
    ],
    "workshop",
  );
  a.page(
    "mixed-explain",
    "Choose a counterexample",
    [
      rectangle(
        "mixed-counterexample",
        5,
        2,
        "Use this rectangle as a starting point, or invent your own.",
      ),
      a.task(
        "counterexample-choice",
        "Choose one claim to disprove: ‘More area always means more perimeter’ or ‘The ending ruler mark always equals the object's length.’ Give two measurements or a diagram that makes the error clear.",
        "Examples: a 5×5 rectangle has area 25 and perimeter 20, while a 1×12 rectangle has smaller area 12 but larger perimeter 26. Or an object from 3 cm to 8 cm has length 5 cm, not 8 cm.",
        "A counterexample must contradict the selected claim, with correct measures and units. Comparing only two equal areas does not by itself disprove the first claim about more area.",
        undefined,
        "extended",
        "blank",
      ),
    ],
    "reflection",
  );
  a.page(
    "return-later",
    "Come back without the worked examples",
    [
      text(
        "Try these after a few days, before rereading a lesson. Draw or explain your own model. If you need help, record which idea you returned to; needing a reminder is useful information.",
      ),
      a.task(
        "delayed-border",
        "A rectangle has perimeter 34 cm and length 11 cm. Find its width and area.",
        "Width 6 cm; area 66 square centimeters.",
        "Two long sides use 22 cm. The remaining 12 cm splits into two widths of 6 cm. Then 11 × 6 = 66.",
      ),
      a.task(
        "delayed-units",
        "A 2 m strip is cut into a 75 cm piece and the rest. Find the remaining length in centimeters and meters.",
        "125 cm = 1.25 m.",
        "2 m = 200 cm; 200 − 75 = 125 cm. Divide by 100 to rename it as 1.25 m.",
      ),
      a.task(
        "delayed-seam",
        "Two rectangles meet along a 3 cm edge without overlapping. Their separate perimeters total 32 cm. Find the perimeter of the joined region.",
        "26 cm.",
        "The shared 3 cm edge appears in each separate perimeter and is interior after joining. Remove both copies: 32 − 6 = 26.",
      ),
    ],
    "workshop",
  );
  a.page(
    "reflection",
    "What do you count?",
    [
      a.task(
        "three-quantities",
        "Explain length, perimeter and area to a younger learner. Include a picture, an appropriate unit, and one mistake to watch for.",
        "Responses vary; each explanation must distinguish distance along a path, distance around the outside, and coverage in square units.",
        "Accept an oral explanation with a drawn model. Length and perimeter use length units; area uses square units. Useful cautions include counting marks instead of intervals, counting an internal seam as outside, or multiplying to find perimeter.",
        undefined,
        "extended",
        "blank",
      ),
      note(
        "Your next question",
        "You can investigate triangles, angles, circles or volume next. Their measurements need new arguments. The rectangle and equal-square methods here are a foundation, not a formula for every shape.",
        "connect",
      ),
    ],
    "reflection",
  );
  a.page(
    "adult-guide",
    "Listen for the counted quantity",
    [
      text(
        "This book develops selected length, perimeter and rectangular-area ideas for grades three through five, with an entry bridge for learners revisiting ruler intervals. Read aloud when decoding language obscures the mathematics. Learners may point, move a string, use equal square pieces, draw, or dictate an explanation.",
      ),
      note(
        "Ask for a referent",
        "When a learner says ‘twelve,’ ask ‘Twelve what?’ Have them point to one counted unit. A correct number with an incompatible unit may reveal an unresolved concept.",
      ),
      note(
        "Use an error diagnostically",
        "An endpoint answer suggests position was confused with distance. A half-perimeter answer suggests an incomplete boundary trip. Adding rectangle perimeters without removing two seams suggests interior edges were treated as exterior.",
      ),
      text(
        "Return to the smallest helpful model, then retry a changed problem. Avoid requiring a long run of one calculation after the learner can explain it. Mix a length, border and coverage task to make choosing the quantity part of the work.",
      ),
    ],
    "guide",
  );
  a.page(
    "adult-guide-evidence",
    "Separate practice from lasting understanding",
    [
      text(
        "The reasoned keys give numerical answers, methods and acceptance criteria for open tasks. A different valid method is welcome. For a drawing, check that it preserves the givens and units; decorative precision is not the objective.",
      ),
      note(
        "Look beyond immediate success",
        "After guided work, try a new representation and later a delayed question. Success immediately after seeing a model is evidence of that supported performance, not proof of durable mastery.",
      ),
      note(
        "Keep scope precise",
        "The book teaches selected ruler, perimeter, area and metric-length conversion components. It does not teach the full measurement standards, all unit systems, volume, angles, general polygon area, or an optimization theorem for every possible shape.",
      ),
      text(
        "Use actual rulers for physical measurements. All printed and screen diagrams are schematic. If making square pieces, ensure the pieces are equal; do not compare their physical size across separately scaled diagrams. Practice app answers assess only their stated response, not the explanation a learner writes here.",
      ),
    ],
    "guide",
  );
}
