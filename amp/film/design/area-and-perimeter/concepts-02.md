# Area and perimeter: per-type concepts, part 2

Ten problem types from the family design: the five grade-4 chain and composite types, the three grade-6 polygon types, and the two grade-7 composite types. Each stands on the family's foundations by number and uses the family's picture: the figure to scale with its numbers on it, teal inside for area, a rust string around for perimeter, one gold thing at a time. Every grade-4 lesson here opens with the shared fifteen seconds (the flood and the string) before its problem; the grade-6 and -7 lessons open by defining their own words on the figure.

One note before the concepts. `staar-measure-chains`, `perimeter-area-chain` and `rectangle-chain-blanks` are three types for one idea (find the missing side first, then the other measure). The app should merge them. Until it does, `perimeter-area-chain` gets the full four-case film, and the other two get shorter films whose full example is the case that type actually generates, so no learner sees the same film three times under three names.

---

### `staar-measure-chains` — Chain perimeter and area (grade 4)

**Off grade in part.** The whole-number case (perimeter and a length, find the area) is 4.MD.A.3, "apply the area and perimeter formulas for rectangles... viewing the area formula as a multiplication equation with an unknown factor." The two decimal cases are not: a 54-meter square's area is 13.5 × 13.5, and a 1.85 by 0.38 banner's perimeter is decimal addition, both 5.NBT.B.7 ("multiply... decimals to hundredths"). The 5.NF.B.4 link is wrong; nothing here has a fraction. Move the decimal cases to a grade-5 type. The concept below is for the whole-number chain, with the decimal cases as quick cases only while the app still generates them.

**Foundations first.** The flood and the string. Then, on a rectangle with the string paused at the opposite corner: "half the trip is one of each side" (foundation 5). The sketch habit, said once: draw it roughly to scale, write every side, including the one you figure out, before you find anything else.

**Read.** Two measures are named; the gold word is the one *asked* ("area"). The other is given so you can find a side. At a glance: half of 56 is 28, so the width is 28 − 20 = 8, and the answer is in square centimeters, near 20 × 8.

**The example.** "A rectangle has a perimeter of 56 centimeters and a length of 20 centimeters. What is its area in square centimeters?" (1) Sketch a long rectangle, 20 across, "?" gold on the short side. (2) The string walks 20, then "?", and pauses at the opposite corner: the label reads "half the trip = 28." (3) Board: 20 + ? = 28, so ? = 8; the 8 is written on the sketch in place of the "?". (4) Teal floods the inside in 8 rows of 20, the row labels ticking 20, 40, ... 160. (5) Answer: 160 square centimeters.
Quick case (decimal perimeter, while it stays): 1.85 long, 0.38 wide; half the trip is 1.85 + 0.38 = 2.23 on a stack with the point lined up; doubled, 4.46 meters. Quick case (decimal square, while it stays): 54 ÷ 4 = 13.5 a side; the square cut into 13 × 13, two 13 × 0.5 strips and a 0.5 × 0.5 corner (foundation 3): 169 + 6.5 + 6.5 + 0.25 = 182.25. A grade-4 learner has no other honest way to see that product.

**Fast.** Half the perimeter, minus the known side, is the other side. Then multiply.
**Sense.** 20 by 8 is long and thin: more than 20 × 5, much less than 20 × 20.
**Check.** Walk the sketch: 20 + 8 + 20 + 8 = 56, the perimeter you were given.
**Line.** "Half the trip is one of each side. Write the side on the sketch, then answer the question."
**Trap.** Two documented ones. Subtracting the length once and halving: (56 − 20) ÷ 2 = 18. The string shows two 20s in the trip, so half the trip is where the subtraction happens. And answering 8: the missing side, not the area. The gold word is re-read before boxing.
**Kit.** `region` with `walk` (`half`), `dims` written on the word, `tile`/`rows`.
**Writer.** A capable cheaper model, once the decimal cases are moved: one method, one picture, every number checkable.

---

### `composite-rectangle-measure` — Area or perimeter of two rectangles (grade 4)

**Standard.** 3.MD.C.7d, "Recognize area as additive. Find areas of rectilinear figures by decomposing them into non-overlapping rectangles and adding the areas of the non-overlapping parts, applying this technique to solve real world problems," and 3.MD.D.8, "finding the perimeter given the side lengths, finding an unknown side length." Filed at grade 4; the deduced sides make it a fair stretch there.

**Foundations first.** The flood and the string. Then two definitions on the figure: the **seam** (the dashed line inside, where the two rectangles meet; it is in the soil, the string never goes along it) and the **hidden sides** (an L has six sides and the problem labels four; the two unlabeled ones are found from the sides opposite: a copy of the bottom slides up and lies along the top and the inner horizontal together, so the inner one is bottom minus top). The sketch habit: label all six before anything else.

**Read.** The gold word decides the measure: *border, frame* mean the trip around; *carpet, cover, rug* mean the inside. At a glance for a trip: more than twice the longest side. For an inside: less than the box the L sits in.

**The example (perimeter).** "Student D is putting a border around a garden made of two rectangles. The dashed line stays in the soil. What is the perimeter, in meters?" The L to scale: bottom 10, left 5, top 6, right 2; the two inner sides unlabeled; a dashed muted seam inside. (1) Gold "border": the trip around. (2) Hidden sides: 10 − 6 = 4 across, 5 − 2 = 3 down, written in gold where they belong. (3) The string walks from the bottom-left corner: 10, 15, 21, 24, 28, 30, back to the start; it steps over the seam without touching it. (4) 30 meters. (5) The check that is also the shortcut: the two inner sides slide straight out to the box around the L, and the string's label stays at 30; the trip around an L is the trip around its box, 2 × (10 + 5). One beat says when: only when the sides can slide out without crossing; a U-shape's cannot.

**Second example (area), because cutting is a different act from walking.** "Student A will carpet a bedroom floor made of two rectangles. What is the area, in square meters?" An L: bottom 8, left 7, top 5, right 3; hidden 3 and 4 deduced. Cut along the seam: a 5 × 7 piece (teal, 35) and a 3 × 3 piece (blue, 9): 44. Then the seam is redrawn the other way: 8 × 3 = 24 and 5 × 4 = 20: 44 again. Cut it either way, the squares are the squares.

**Fast.** Perimeter: label every outer side, add them, skip the seam (for an L or T: the box's perimeter). Area: cut on the seam, multiply each piece, add.
**Sense.** 30 is more than 2 × 10. 44 is less than the 8 × 7 box, 56, and more than the 5 × 7 piece.
**Check.** Walk from a different corner. Cut the other way. Or box minus corner: 56 − 12 = 44.
**Line.** "The seam isn't an edge." "Cut it, the areas add."
**Trap.** Walking the seam, or adding only the four labeled sides (23). The seam is muted and the string steps over it; the hidden sides are written in gold before the walk begins. For area, multiplying the two overall lengths (8 × 7 = 56): the box, with its corner missing, is shown leaving.
**Kit.** `region` with `seams`, deduced `dims`, `walk` skipping seams, `slideout`, `cut` both ways.
**Writer.** Strongest: a reading lesson with two stories, a deduction, and a shortcut whose condition must be shown failing.

---

### `rectangle-formula-select` — Expressions that equal the perimeter, or the area (grade 4)

**Standard.** 4.MD.A.3, "Apply the area and perimeter formulas for rectangles," with the letters themselves from 6.EE.A.2b, "view one or more parts of an expression as a single entity," for 2(l + w). The app's note stands: the choices are identical across every perimeter example; the area case exists (Student C) and is the quick case.

**Foundations first.** The flood and the string. Then *l* and *w* arrive, on the figure: "l stands for the length, this side; w for the width, this one." An **expression** is a writing with letters that stands for a number once you know the sides. Three readings, each on the figure: 2l is two l's, l + w is this side and this side, 2(l + w) is two of the pair.

**Read.** The gold word ("outer edge", "border", "ribbon") says perimeter; the count says how many to pick. At a glance: any expression with × is the inside; any expression that stops at two sides is half a trip.

**The example.** Student B's picture mat, "find the 3 expressions that equal the perimeter." Rectangle to scale, l on the long side, w on the short. (1) The string walks l, then w, pauses: "half the trip: l + w." Then l, then w: the first expression, l + w + l + w, written as the string finishes. (2) Gather the letters: two l's and two w's: 2l + 2w. (3) Half the trip, twice: 2(l + w). Three namings of one trip, so all three equal. (4) Rule out, together: l × w floods the inside teal, that is the area; l + w leaves the string stopped at the opposite corner, half a trip. Both dim. (5) The check that makes it certain: try l = 5, w = 3. 5 + 3 + 5 + 3 = 16; 10 + 6 = 16; 2 × 8 = 16. And 5 × 3 = 15, 5 + 3 = 8: not the trip.
Quick case (area): Student C's deck, "the 2 that equal the area": rows of squares, l × w; turn the rectangle a quarter turn and the same squares are w × l. The three trip expressions dim together: they go around.

**Fast.** Sums of sides go around; the product fills. Then count the sides each sum has: four, or two doubled.
**Sense.** Three equal writings for one trip; two for one inside.
**Check.** Put numbers in. Every expression that equals the perimeter gives the same number.
**Rule out.** × for a trip, + for an inside: gone at once.
**Line.** "Try numbers: the ones that match are the same trip."
**Trap.** Picking l + w: it looks like "length plus width" and children stop there; the string stopped halfway shows what is missing. Reading 2(l + w) as 2l + w: the numbers check (2 × 8 = 16, not 13) settles it.
**Kit.** `dims` that take letters; `tile` with `rows` labeled by a letter; choice `dim`.
**Writer.** A capable cheaper model: one picture, the choices fixed, the check mechanical.

---

### `perimeter-area-chain` — One measure and a side, find the other measure (grade 4)

**Standard.** 4.MD.A.3, "find the width of a rectangular room given the area of the flooring and the length, by viewing the area formula as a multiplication equation with an unknown factor," and its perimeter twin. Four cases: rectangle from area, rectangle from perimeter, square from perimeter, square from area.

**Foundations first.** The flood and the string. Half the trip is one of each side (string paused at the opposite corner). Area is rows of the known side (teal rows). A square's four sides are equal, so one of them is a quarter of the trip.

**Read.** Both measures are named; gold on the one asked. The given one finds a side first. At a glance: a side from the area is smaller than the area; a side from the perimeter is less than half of it.

**The example (rectangle, area to perimeter).** "A rectangular patio has an area of 70 square meters and a width of 7 meters. What is its perimeter, in meters?" (1) Sketch: 7 on the short side, gold "?" on the long. (2) The deal: 70 squares drop into rows of 7, a label ticking 7, 14, ... 70; ten rows. So 7 × ? = 70 and ? = 10, written on the sketch. (3) The string walks 10, 17, 27, 34. (4) 34 meters.
Quick cases, each a different move. Rectangle, perimeter to area (30 inches, width 3): half the trip 15, minus 3 is 12; 12 × 3 = 36 square inches. Square from perimeter (20 meters): four equal sides, 20 ÷ 4 = 5; 5 × 5 = 25. Square from area (36): what times itself makes 36; six rows of six; four 6s make 24.

**Fast.** Missing side first: area ÷ known side; half the perimeter − known side; perimeter ÷ 4; the number that times itself makes the area. Then the other measure.
**Sense.** 10 by 7 is nearly square, so about 10 + 10 + 7 + 7.
**Check.** 10 × 7 = 70, the area you were given, before the perimeter is boxed; after, walk again from another corner.
**Line.** "Find the side first. Write it on the sketch."
**Trap.** Subtracting for the side from the area (70 − 7 = 63): the deal shows rows, not a leftover. Halving a square's perimeter for its side (10): four sides light one by one as 20 is split. And boxing the side instead of the asked measure: gold word re-read.
**Kit.** `deal`, `walk` with `half`, `dims` on the word.
**Writer.** A capable cheaper model: four quick arithmetic cases on one picture.

---

### `rectangle-chain-blanks` — Length and perimeter from area and width (grade 4)

**Standard.** 4.MD.A.3, the unknown-factor clause. The same case as `perimeter-area-chain`'s full example, in a fill-the-sentence format with slot choices. Its description is an explanation and should be rewritten. One concept, short film.

**Foundations first.** The flood and the string; rows of the known side; half the trip doubled.

**Read.** Two blanks: the length, then the perimeter. The length comes first because the perimeter needs it. At a glance: a length choice is right only if it times 10 makes 160; the perimeter is more than twice the longer side and is even.

**The example.** "A rectangle has an area of 160 square feet and a width of 10 feet. Complete the sentence with its length and its perimeter." (1) Sketch, 10 short, "?" long. (2) Deal 160 squares into rows of 10: sixteen rows; 16 written on the sketch; the first blank fills with 16. (3) String: 16, 26, 42, 52; or half the trip 26, doubled. Second blank: 52.

**Fast.** Area ÷ width; then 2 × (length + width).
**Sense.** 16 by 10: a trip a little over 50.
**Check.** 16 × 10 = 160. Walk again.
**Rule out.** A length choice that does not multiply back to 160 dims at once; a perimeter choice smaller than 32 (two lengths alone) dims.
**Line.** "Find the side first."
**Trap.** 160 − 10 = 150 for the length; the deal.
**Kit.** The `problem` card must show a sentence with blanks that fill on the word, with the slot choices beside each blank; `deal`, `walk`.
**Writer.** A capable cheaper model.

---

### `rational-area-volume-equation` — Write the equation for a shape's measure (grade 6)

**Misfiled.** It serves 6.EE.B.7, "writing and solving equations of the form px = q for cases in which p, q and x are all nonnegative rational numbers" (the writing half), with the triangle's area from 6.G.A.1 and the prism's from 6.G.A.2, "Apply the formulas V = l w h." Not 4.MD.A.3. The prism variants belong to `fractional-prism-volume` (family 25); the triangle and rectangle stay here. The concept covers all three while the app generates them.

**Foundations first.** An **equation** with a letter is a true sentence about the shape with one number not yet known; the question asks for the sentence, not the number. The three formulas as pictures, each in one beat: a rectangle's area is rows of its width, l × w; a triangle is half the box its base and height make, ½ × b × h, the height standing straight up at a right angle; a prism's volume is its face times its depth, l × w × h. The fractions are just the numbers; they do not change the shape of the sentence.

**Read.** Which shape, which measure, which letter is unknown. The gold word is the unknown ("its base, b"). At a glance: every choice that adds a length to an area, or adds lengths together, is not an area at all.

**The example.** "A triangular banner has an area of 3 square feet and a height of 4 feet. Which equation can be used to find its base, b, in feet?" (1) The triangle to scale, b gold along the bottom, the height 4 dropped dashed with a right-angle mark. (2) Its box snaps around it, 4 tall, b wide: the box is 4 × b. (3) The triangle floods teal: half the box, ½ × 4 × b. (4) That is the area, and the area is 3: ½ × 4 × b = 3. (5) Rule out, together: ½ × 4 + b adds a length to an area; 4 × b is the whole box, not the banner; ½ × (4 + b) halves two lengths added, still a length. (6) Sense: solve it in your head, b = 1.5, and ½ × 4 × 1.5 is 3. A reasonable banner.
Quick case (rectangle): "area 8, length 2, find w": rows of w, 2 × w = 8. Quick case (prism, while it stays): 4½ × 2¼ × h = 40½: the face is 4½ by 2¼, pushed back h; the decoy with 2(...) is the surface, the wrap, not the fill. Quick beat on the fraction triangle: 3 15/16 and 3½ keep exactly the same sentence, ½ × 3½ × h = 3 15/16.

**Fast.** Write the formula from the picture, replace what you know, leave the letter, set it equal to the given measure. Do not simplify; match the choices' shape.
**Sense.** Solve mentally and ask whether the shape could be that size.
**Check.** Put the solved value back in the picture: half of 4 × 1.5 is 3.
**Rule out.** A + between a product and a length, or a sum of lengths, cannot be an area or a volume.
**Line.** "An area is a product. A sum of sides is a length."
**Trap.** 4 × b = 3, the triangle without its half: the box with the triangle inside it. Children also pick ½ × (4 + b), a half-remembered trapezoid; it is a length halved, and the box shows nothing being halved but the box itself.
**Kit.** `height`, `box` on a triangle; `prism` with a rectangular face; choice `dim`.
**Writer.** Strongest: the half and the product must be seen in the picture, and the decoys named for what each one actually measures.

---

### `triangle-area-base-height` — Area of a triangle from base and height (grade 6)

**Standard.** 6.G.A.1, "Find the area of right triangles, other triangles... by composing into rectangles or decomposing into triangles." This concept establishes the family's shared picture. Later lessons refer to it; rendering it with `region` requires `height` support.

**Foundations first.** **Base** is the side you stand the triangle on; **height** is the straight-down distance from the top to the base, meeting it at a right angle; the slanted side is never the height. Then the move: a half-turned copy fits against the triangle to complete a parallelogram (or a rectangle for a right triangle), so the triangle is half of base × height.

**Read.** Which side is the base, which number is the height (the one with the right-angle mark). At a glance: a triangle is half its box, so less than base × height.

**The example.** Base 12 feet, height 8 feet, slanted sides 10 and 10. (1) The height drops dashed and gold with its right-angle mark; the slanted 10s dim. (2) A copy turns half way round and lands against the triangle: a parallelogram 12 by 8, area 96. (3) The triangle is half: 48 square feet. Three cases in the reference: right triangle (the copy makes a rectangle), height inside, height outside (the dashed drop lands past the base's end).

**Fast.** Half of base × height; ignore slanted sides.
**Sense.** Less than the 12 × 8 box.
**Check.** 48 × 2 = 96 = 12 × 8.
**Line.** "The height stands straight up. Double it, then take half."
**Trap.** Base × slanted side, 12 × 10 (or half of it, 60): the slanted sides dim as the height drops.
**Kit.** `height`, `turn` (exists).
**Writer.** Done.

---

### `polygon-area-decompose` — Parallelogram, trapezoid, pentagon (grade 6)

**Standard.** 6.G.A.1, "special quadrilaterals, and polygons by composing into rectangles or decomposing into triangles and other shapes."

**Foundations first.** Three words on figures: **base** and **height** (straight up at a right angle; the slanted side is never the height, said once and shown on the parallelogram), **parallel** (the two sides that run the same way and never meet). Then the three moves named in one line each, from foundation 7: move a piece and the area stays; double the shape and take half; cut it and the areas add. Three shapes, three moves, so three worked examples; the first is slow and defines the words, the other two are brisk but complete.

**Read.** Which shape the problem names, which number is the height (the right-angle mark, or "total height" for the pentagon). At a glance: every shape is less than its box.

**Example 1 (parallelogram, slide).** Base 10 inches, height 8, slanted side 10. The height drops gold with its right mark; the slanted 10 dims. The end triangle lifts, leaves a muted ghost, slides across and lands on the other end: a 10 by 8 rectangle; the area label never changed. 80 square inches.
**Example 2 (trapezoid, double).** Top 6 centimeters, bottom 10, height 6. A half-turned copy fits against the slanted side: a parallelogram with base 6 + 10 = 16 and height 6, area 96. The trapezoid is half: 48. The board writes ½ × (6 + 10) × 6 under the picture, each part pointed at.
**Example 3 (pentagon, cut).** Bottom 10 inches, sides 4, total height 8, top vertex centered. A gold cut across the top of the rectangle: a 10 × 4 rectangle (teal, 40) and a triangle on top whose height is 8 − 4 = 4, written in gold as it is found; its box is 10 × 4, so it is 20. 40 + 20 = 60 square inches.

**Fast.** Parallelogram: base × height. Trapezoid: half of the two bases added, times the height. Pentagon: rectangle plus a triangle whose height is total minus rectangle.
**Sense.** 80 is less than 10 × 10 of base times slant. 48 is between 6 × 6 and 10 × 6. 60 is between the 40 rectangle and the 80 box.
**Check.** Cut the trapezoid the other way, a 6 × 6 rectangle plus two triangles of total base 4 and height 6: 36 + 12 = 48. Box minus corners for the pentagon: 80 minus two triangles of 10 each.
**Line.** "Move it, the area stays; double it, then take half; cut it, the areas add."
**Trap.** Base times slanted side for the parallelogram; the two bases multiplied for the trapezoid (60), or the half forgotten (96); the total height used for the triangle on the pentagon (½ × 10 × 8 = 40, total 80: the whole box). Each is the picture's own decoy, and each is killed by the motion that finds the right area.
**Kit.** `lift` with ghost, `height`, `turn` (exists), `cut` with the deduced height written on the word.
**Writer.** Strongest: three motions that prove, and the screenplay is the staging.

---

### `composite-area` — Rectilinear figures and a cut-off corner (grade 7)

**Standard.** 7.G.B.6, "area... of two-dimensional objects composed of triangles, quadrilaterals, polygons," with 6.G.A.1 for the triangle. The description's "rectangles and triangles" is real: the cut-off-corner variant removes a right triangle. The T, L and U are the grade-4 picture with harder hidden lengths; the cut corner is what makes this grade 7.

**Foundations first.** Cut it, the areas add (foundation 3), in one line. New here, foundation 8 and 10 together: **every figure sits in a box**, and what is taken away is area too, so a figure is also its box minus the missing pieces. And the hidden-length rule for sides with several parts: a full side minus the parts you know along it.

**Read.** "All angles right": the pieces are rectangles. "Corner cut off by a straight line": the missing piece is a right triangle. At a glance: less than the box, more than the biggest rectangle inside it.

**The example (cut corner).** "The figure is a rectangle with its top right corner cut off by a straight line. Lengths are in feet. What is its area?" Bottom 14, left 8, top 7, right 4; the slanted cut unlabeled. (1) The box snaps dashed around it: 14 × 8 = 112. (2) The missing corner is a right triangle; its legs are hidden: 14 − 7 = 7 across, 8 − 4 = 4 down, written gold. Half of 7 × 4 is 14. (3) The corner fades to muted and the figure stands teal: 112 − 14 = 98 square feet. (4) Check the other way: cut straight down from the end of the top side: a 7 × 8 rectangle, 56, and a trapezoid with parallel sides 8 and 4 and width 7, 42; 98 again.

**Second example (T, rectilinear), because deducing a length along a three-part side is the reading skill of the type.** Top 10 meters, total height 10, bar thickness 3, stem width 4, stem centered. Cut under the bar: 10 × 3 = 30; the stem's height is 10 − 3 = 7, so 4 × 7 = 28; 58 square meters. Box minus the two notches: 100 − 2 × (3 × 7) = 58. The L and U are this same pair of moves and need no example of their own.

**Fast.** Find every hidden length as a full side minus the other parts. Then cut and add, or box and subtract, whichever has fewer pieces.
**Sense.** 98 is just under the 112 box. 58 is a little over half the 100 box.
**Check.** The two ways agree.
**Line.** "Box minus what's missing, or pieces added: they must agree."
**Trap.** The box alone (112, or 10 × 10 = 100): the missing piece shown leaving. The slanted side used as a length: it is never labeled and nothing on screen uses it. The triangle without its half.
**Kit.** `box`, `remove`, `cut`, deduced `dims`.
**Writer.** Strongest: a reading lesson with two shapes of hidden length and a triangle removed, where the check is part of the method.

---

### `composite-face-prism-volume` — Volume of a right prism with an L or T face (grade 7)

**Standard.** 7.G.B.6, "volume... of three-dimensional objects composed of... right prisms," standing on 6.G.A.2's layers. Designed here because this family builds `prism`; family 25's design should reuse it.

**Foundations first.** The solid in oblique view, said once: "the depth is drawn going back." Three words on it: a **right prism** is its front **face** pushed straight back; the **depth** is how far back. Volume counts cubes, in cubic units: one layer of cubes for each unit of depth, and each layer has as many cubes as the face has squares. So volume is face area × depth (foundation 9).

**Read.** The face's sides, two of them hidden; the depth, written apart from the face. The gold word is "volume": cubic units, fill. At a glance: less than the box prism around it.

**The example.** "A right prism has the L-shaped front face shown and is 7 meters deep. What is the volume, in cubic meters?" Face: bottom 6, left 7, top 2, right 4. (1) The face flat-on, teal; the depth edges go back, dashed where hidden; the depth 7 on its own bracket. (2) Hidden sides: 6 − 2 = 4 across, 7 − 4 = 3 down. (3) Cut the face: 2 × 7 = 14 and 4 × 4 = 16; face area 30, written inside it. (4) Extrude: the face slides back one meter at a time, each a copy, the count ticking 30, 60, ... 210. (5) 210 cubic meters.

**Fast.** Face area (cut and add), times the depth.
**Sense.** The 6 × 7 box pushed back 7 would be 294; this is less. More than the 14-piece alone, 98.
**Check.** Box prism minus notch prism: 294 − 12 × 7 = 210. Same.
**Line.** "The face does the work: its area times the depth."
**Trap.** Multiplying all the labeled numbers together, or adding the depth to the face area: the layers show what the depth does. Using the depth as a side of the face: it is drawn going back, on its own bracket, in a different direction from every face label.
**Kit.** `prism` with `extrude` and the fixed oblique angle shared with family 25; `cut` on the face.
**Writer.** A capable cheaper model once `prism` exists: one method, the face's area the grade-4 lesson already taught, the picture named by one component.
