import { Author, text, note, rectangle, worked } from "./authoring.js";
export function compare(a: Author) {
  a.section = "compare";
  a.page("same-area-new-border", "Same cover, different border", [
    rectangle(
      "equal-area-long",
      12,
      2,
      "Design A: 12 cm by 2 cm. Both drawings use the same unit scale.",
      true,
      "cm",
      { columns: 12, rows: 3 },
    ),
    rectangle(
      "equal-area-compact",
      8,
      3,
      "Design B: 8 cm by 3 cm. Both drawings use the same unit scale.",
      true,
      "cm",
      { columns: 12, rows: 3 },
    ),
    a.task(
      "equal-area-compare",
      "Find both areas and both perimeters. Which design needs less ribbon around the outside?",
      "Both areas are 24 square centimeters. A has perimeter 28 cm; B has perimeter 22 cm. B needs 6 cm less ribbon.",
      "12 × 2 and 8 × 3 both equal 24. Their side sums differ: 2 × (12 + 2) = 28 and 2 × (8 + 3) = 22. Equal coverage does not force equal boundary length.",
    ),
  ]);
  a.page("same-border-new-area", "Same border, different cover", [
    rectangle(
      "equal-border-three",
      7,
      3,
      "Design C: 7 cm by 3 cm. Both drawings use the same unit scale.",
      true,
      "cm",
      { columns: 7, rows: 4 },
    ),
    rectangle(
      "equal-border-four",
      6,
      4,
      "Design D: 6 cm by 4 cm. Both drawings use the same unit scale.",
      true,
      "cm",
      { columns: 7, rows: 4 },
    ),
    a.task(
      "equal-border-compare",
      "A 20 cm ribbon fits around either rectangle. Compare their areas. Does equal perimeter force equal area?",
      "C covers 21 square centimeters; D covers 24. No.",
      "Both side pairs sum to 10, giving perimeter 20 cm. Their products are 21 and 24. This pair is a counterexample to the claim.",
    ),
  ]);
  a.page("find-the-width", "Use coverage to recover a side", [
    worked(
      "A different missing dimension",
      "A rectangular mat has area 35 square centimeters and length 7 cm. Find its width.",
      [
        "One row 7 squares long covers 7 square centimeters.",
        "35 ÷ 7 = 5 such rows fill the mat.",
      ],
      "The width is 5 cm. Multiplying 7 cm by 5 cm checks the area.",
    ),
    a.task(
      "area-width",
      "A rectangular stage covers 48 square meters. Its length is 8 m. Find its width and then its perimeter.",
      "Width 6 m; perimeter 28 m.",
      "48 ÷ 8 = 6 gives the missing width. Then 8 + 6 + 8 + 6 = 28 gives the boundary length. The area is not a quantity to add to a side length.",
      undefined,
      "large",
      "blank",
    ),
    note(
      "Which total is given?",
      "A given area calls for a product. A given perimeter calls for a sum of boundary lengths. ‘Find the missing side’ is not enough information to choose an operation.",
      "notice",
    ),
  ]);
  a.page(
    "all-rectangle-options",
    "Did you find every option?",
    [
      text(
        "Build rectangles with area 24 square units and positive whole-number side lengths. Treat turning a rectangle as the same design. List the shorter side first so you do not count a rotation twice.",
      ),
      a.task(
        "factor-designs",
        "List every allowed dimension pair, then find each perimeter. Explain how you know the list is complete.",
        "1 × 24: 50 units; 2 × 12: 28; 3 × 8: 22; 4 × 6: 20.",
        "The positive divisors of 24 up to its square root give all shorter sides: 1, 2, 3 and 4. Trying 5 fails because 24 is not divisible by 5; from 6 onward the first side would exceed the second and repeat a rotated pair. A systematic factor-pair argument is acceptable without square-root vocabulary.",
        "The 4 by 6 rectangle has the least perimeter among these allowed whole-number rectangles, not among every imaginable shape.",
        "extended",
        "grid",
      ),
      note(
        "State the rules",
        "Whole-number side lengths and rectangles are part of this investigation. Changing those rules changes the set of possible answers.",
      ),
    ],
    "workshop",
  );
  a.page(
    "design-with-two-limits",
    "Meet two conditions at once",
    [
      text(
        "A display mat must cover exactly 24 square units. Its sides must be positive whole numbers. You have at most 24 units of border strip. A rotation counts as the same design.",
      ),
      a.task(
        "two-limits",
        "Find every rectangle that meets both conditions. Explain why the other area-24 designs fail.",
        "3 × 8 and 4 × 6.",
        "Both cover 24 square units. Their perimeters are 22 and 20 units, within the limit. The 1 × 24 and 2 × 12 rectangles need 50 and 28 units, exceeding the limit. The complete factor list excludes other whole-number options.",
        undefined,
        "extended",
        "grid",
      ),
      note(
        "Check the wording",
        "‘At most 24’ permits using less than 24. ‘Exactly 24’ would require a different check. A leftover strip is allowed here.",
        "notice",
      ),
    ],
    "workshop",
  );
  a.page("stretch-or-rename", "What changed physically?", [
    rectangle(
      "double-dimensions-start",
      3,
      2,
      "Start with a 3 cm by 2 cm rectangle.",
    ),
    a.task(
      "double-both",
      "Double both side lengths. Find the new dimensions, area and perimeter. Compare each measure with the original.",
      "6 cm by 4 cm; area 24 square centimeters; perimeter 20 cm. Area is four times 6; perimeter is twice 10.",
      "Doubling rows and columns gives four copies of the original coverage. Each of the four boundary lengths doubles, so their sum doubles.",
      undefined,
      "large",
      "blank",
    ),
    note(
      "A useful warning",
      "Multiplying lengths by 2 does not multiply every kind of measure by 2. Area combines two length directions.",
      "misconception",
    ),
  ]);
}
