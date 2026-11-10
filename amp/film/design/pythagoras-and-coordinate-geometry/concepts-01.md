# Pythagoras and coordinate geometry, part 1: lesson concepts

Ten problem types across `pythagorean-theorem`, `coordinate-distance` and `segment-division`, written from the family design. Facts read from `film/facts.ts` output; every number below was recomputed.

Order of teaching, because each stands on the ones above it: `right-triangle` (the picture is born and proved), `right-triangle-missing-leg`, `radical-side-entry`, `pythagorean-converse`, `pythagorean-sort-table`, `space-diagonal`, `coordinate-distance`, `coordinate-distance-exact`, `midpoint-endpoint`, `segment-partition`. After `right-triangle`, every lesson names the theorem in one line ("the leg squares fill the hypotenuse square") and shows the three squares for one beat; after `coordinate-distance`, every lesson says "draw the L" and means that lesson.

**Corrections to the family design from generated variants.** `coordinate-distance-exact` has a "to the nearest hundredth" variant (7.07), so its 8.NS.A.2 link is justified by that one variant; keep it, weakly. `space-diagonal`'s method text describes a missing-edge case; no variant asks it. `radical-side-entry` is two types under one name (said in the design; confirmed). `midpoint-endpoint` is misfiled under 8.G.B.8 (confirmed; concept below says how the lesson handles it).

---

## Pythagorean theorem (`pythagorean-theorem`, grade 8)

### `right-triangle` — Two legs given; find the hypotenuse

**Standard.** 8.G.B.7: "determine unknown side lengths in right triangles in ... mathematical problems in two ... dimensions." The lesson also teaches 8.G.B.6, "Explain a proof of the Pythagorean Theorem," which the app never asks; and the rounded variants practice 8.NS.A.2, "use rational approximations of irrational numbers."

**Foundations first.** Three words, each on the figure as it is said: a *right angle* is a square corner, marked with the little square; the two sides that make the corner are the *legs*; the side across from the corner is the *hypotenuse*, always the longest. Gold on the corner mark: "find the square corner first; the side across from it is the hypotenuse." Then "squared" as an area: a square sweeps out from a leg of 5 and shows 25 unit cells (foundation 2, family 24 named). Then the proof, once, by motion (foundation 3): a big square of side 17 holds four copies of the 5–12–13 triangle around a tilted white square; its side is the hypotenuse, so its area is c². Slide the same four tiles into two pairs: the white that is left is a 5-square and a 12-square. Same tiles, same big square, so the white areas are equal: a² + b² = c². The board writes it once, in the sides' colors: `\cb{a}^2+\cw{b}^2=\ca{c}^2`. The line: "The leg squares fill the hypotenuse square." Last, roots: a side is the square root of its square, and a root that is not whole sits between two whole roots (foundation 4, family 4 named).

**Read.** "A right triangle has perpendicular legs 5 cm and 12 cm. What is the hypotenuse length in centimeters?" "Perpendicular" is defined in passing (they meet at a square corner). Gold on "hypotenuse": the asked side is across from the corner, so the squares add. The answer is a length, longer than 12 and shorter than 5 + 12 = 17. At a glance: 5 and 12 are a known triple; a learner who knows 5–12–13 can answer now, and the squares show why.

**The example.** (1) The triangle to scale on a unit grid, legs 12 along and 5 up, corner marked. (2) Squares sweep out: 25 cells on the 5, 144 on the 12, both areas written inside in blue and rust; a teal square on the hypotenuse with "?" inside. (3) The board: c² = 5² + 12² = 25 + 144 = 169; the "?" becomes 169. (4) c = √169 = 13; the side label 13 is written outside the teal square. (5) 13 cm.

**Second example, a different case: the root is not whole.** "Legs 12 cm and 7 cm, to the nearest tenth." c² = 144 + 49 = 193. The learner must locate the root: 169 < 193 < 196, so c is between 13 and 14, nearer 14 (that is also the "nearest whole number" wording, answered in the same beat). Root once: √193 = 13.89..., round once: 13.9. Check: 13.9² = 193.21, a hair over 193. The line: "Root once, round once, at the end."

**Fast.** Square, add, root. When the legs are a triple or a multiple of one (3-4-5, 5-12-13, 8-15-17, 7-24-25), read the hypotenuse off; recognition never fails.

**Sense.** Longer than the longer leg, shorter than the two legs laid end to end (the big square's side in the proof, visibly longer than the slant).

**Check.** Square the answer: 169 = 25 + 144, exactly; or near, if the answer was rounded.

**Trap.** Stopping at 169 (the area) or answering 17 (the sides added; also what "rooting each" gives, √25 + √144). Impossible because the area is written inside the square and the side outside it, and the question asks for a side; and because 17 is drawn as the big square's side, longer than the slant.

**Kit.** `square` (4.3) with the unit grid inside a tilted square; four `solid` polys sliding (exists); `@len` exact (4.2). **Writer:** strongest. The proof must be staged, not described; the family has no foundation otherwise.

### `right-triangle-missing-leg` — Hypotenuse and one leg given; find the other leg

**Standard.** 8.G.B.7, "determine unknown side lengths in right triangles"; the nearest-tenth variant practices 8.NS.A.2.

**Foundations first.** The theorem named in one line with the three squares back on screen. Then the new idea (foundation 5): the theorem is always written with the hypotenuse square alone on its side, and when a leg is missing, its square is the part of the hypotenuse square that the known leg's square does not fill: "a leg's square is what is left." Family 6's part-whole named: ? + 36 = 100 is the same sentence as a missing addend.

**Read.** "A right triangle has a hypotenuse of 10 cm and one leg of 6 cm. What is the length of the other leg?" Gold on "hypotenuse": the 10 is the longest side, so it plays c and the squares subtract. The answer is a leg: shorter than 10. At a glance: 6 and 10 are 3-4-5 doubled; the leg is 8.

**The example.** (1) Triangle to scale: hypotenuse 10, known leg 6 along, missing leg up, drawn in teal with "?" outside. (2) Squares: 100 cells on the hypotenuse, 36 on the 6, "?" in the missing leg's square. (3) Board: ?² + 6² = 10²; ?² + 36 = 100; margin "−36 both sides"; ?² = 64; the "?" in the square becomes 64 and its cells are countable. (4) ? = √64 = 8. (5) 8 cm.

**Second example, a different case: decimals and rounding.** "Hypotenuse 8.4 cm, leg 3.9 cm, to the nearest tenth." Squares written as numbers, no cells: 8.4² = 70.56 (the stack, so it is seen not to be 64.16), 3.9² = 15.21. ?² = 70.56 − 15.21 = 55.35. Between 49 and 64, so between 7 and 8. Root once, round once: √55.35 = 7.439... → 7.4. Check: 7.4² + 3.9² = 54.76 + 15.21 = 69.97, close to 70.56 because 7.4 was rounded.

**Fast.** Hypotenuse squared minus leg squared, then root. A triple or multiple when there.

**Sense.** The answer is a leg, so it is shorter than the hypotenuse: 8 < 10, 7.4 < 8.4.

**Check.** 64 + 36 = 100; or the rounded check above, with the reason it is only close.

**Trap.** Adding the squares (100 + 36 = 136, √136 ≈ 11.7, a leg longer than the hypotenuse): the one wrong move children make here. Impossible because the theorem is written one way every time with the hypotenuse alone on its side, and because the part-whole picture shows the leg's square as what is left. Also, squaring a decimal piece by piece (8.4² as 64.16): the stack shows 70.56.

**Kit.** `square` with a "?" that resolves to a count; `stack` exists. **Writer:** capable cheaper model, from this concept; one method, arithmetic checkable by `--dry`.

### `radical-side-entry` — A hypotenuse in simplest radical form; or a decimal leg

**Badly conceived, as the family design explains.** Two types under one name: three decimal-leg variants (1 and 0.6 → 0.8; 2.5 and 2.4 → 0.7; 2.6 and 1 → 2.4), which are `right-triangle-missing-leg` with the triples 3-4-5, 7-24-25, 5-12-13 scaled down, and two radical variants that ask for m or n in m√n. Until the split, the lesson works one decimal leg on its own screen in four beats, as in the missing-leg lesson; the concept below is for the radical type that should stand alone. The radical form is Algebra 1 (HSN.RN.A.2, "rewrite expressions involving radicals"; really √(ab) = √a·√b), a stretch in grade 8, so the lesson teaches it rather than assuming it.

**Standard.** 8.G.B.7 for the length; HSN.RN.A.2 for the form.

**Foundations first.** The theorem in one line. Then "exact": a root that is not whole can still be written exactly, and "simplest radical form" means the biggest perfect square has been pulled out. The picture: a square of area 20 cut into a 2-by-2 grid of equal cells, each of area 5, so each cell's side is √5, and the big square's side is two of them: √20 = 2√5. The number that comes out counts cells along a side; the number that stays under the root is a cell's area. "Simplest" means a cell's area has no perfect-square factor left.

**Read.** "In right triangle ABC, the legs have lengths 4 and 2. The hypotenuse can be written in simplest radical form as m√n ... What is the value of n?" Gold on the asked letter: the answer is not the length, it is the number under the root. At a glance: 16 + 4 = 20, between 16 and 25, so the hypotenuse is between 4 and 5; and 20 holds a 4.

**The example.** (1) Triangle 4 along, 2 up, to scale; squares 16 and 4; hypotenuse square "?". (2) Board: c² = 16 + 4 = 20; the "?" becomes 20. (3) The biggest perfect square in 20: 4. 20 = 4 × 5; the hypotenuse square is cut into 2 × 2 cells of area 5. (4) c = √20 = √4·√5 = 2√5, the side written outside: two cells of √5. (5) m = 2, n = 5; the question asks n: 5.

**Quick second case, a different ask with a bigger square:** legs 2 and 11: c² = 4 + 121 = 125 = 25 × 5; 5 × 5 cells of area 5; c = 5√5; asked m: 5. Four beats.

**Fast.** Square and add; find the biggest perfect square that divides the sum; its root comes out, the rest stays under.

**Sense.** 2√5 ≈ 2 × 2.24 ≈ 4.5, between 4 and 5 as the squares said. 5√5 ≈ 11.2, between 11 and 12.

**Check.** Square it back: (2√5)² = 4 × 5 = 20. Then reread which letter was asked.

**Trap.** Putting the wrong number outside (√20 as 4√5, taking the factor instead of its root): impossible with the cells, where the count along the side is visibly 2. Answering the length, or m when n was asked: gold on the letter, and a reread at the end.

**Kit.** `square` gains `"cells": k` (a k-by-k grid of equal cells with the cell's area written in one). **Writer:** capable cheaper model.

### `pythagorean-converse` — Three sides given; is it a right triangle?

**Standard.** 8.G.B.6, "Explain a proof of the Pythagorean Theorem and its converse." The type has no judged standard; link it to B.6. (The app practices the deciding, not the explaining; the lesson explains.)

**Foundations first.** The theorem in one line, then the other direction (foundation 6): if the squares add, the corner is square; if they do not, it is not. Build the hinge: two legs 16 and 20 joined at a corner, the third side across, a live degree readout on the corner and a live length readout on the third side. Close it: the third side shrinks below 25.6. Open to exactly 90: the right-angle mark appears and the third side reads √656 ≈ 25.6, the only length that fits a square corner on these legs. Open past 90: the mark vanishes, the side grows. So the third side's length tells the corner, and the squares add only at 90. Then the habit: the longest side is the only one that could be across from a square corner, so it plays c, whatever order the sides are listed in.

**Read.** "A triangle has side lengths 20 cm, 16 cm, and 30 cm. Is it a right triangle?" Choices: Right triangle | Not a right triangle. Gold on the longest, 30: it plays c. At a glance: 30 is almost 16 + 20 = 36, so the corner between 16 and 20 is wide open; this is unlikely to be right.

**The example.** (1) The hinge with legs 16 and 20 open to 90, third side 25.6. (2) Board: a² + b² = 16² + 20² = 256 + 400 = 656. (3) c² = 30² = 900. (4) 656 ≠ 900, and 900 is more, so the corner must open past 90 to stretch the third side to 30: the hinge opens until the readout says 30, at about 112 degrees, drawn to scale. (5) Not a right triangle.

**Quick second case, the other verdict and the order trap:** 7 cm, 25 cm, 24 cm. Longest is 25, listed in the middle. 7² + 24² = 49 + 576 = 625 = 25². Right triangle, the square corner between 7 and 24. Four beats.

**Fast.** Longest side first. Square the other two and add; square the longest; equal or not. (Triple recognition when there: 7-24-25.)

**Sense.** More than √(a² + b²) means wider than square; less means narrower. 30 > 25.6: wide open.

**Check.** Recompute both squares; the hinge readout at the given third side is or is not 90.

**Rule out.** Two choices; nothing to dim. The decision is the work.

**Trap.** Taking c to be the side listed last and squaring the first two: on 7, 25, 24 that gives 49 + 625 = 674 against 576 and the wrong verdict. Impossible because the longest side goes gold before anything is squared, every time. The line: "Longest side plays c."

**Kit.** `move` on the hinge's end point with `@len` and `@deg` readouts (4.2); `angle` gains `"right": "auto"` so the square mark appears only when the opening is 90. **Writer:** strongest; the hinge is the explanation the standard asks for.

### `pythagorean-sort-table` — Mark each row right or not

**Standard.** 8.G.B.6, the converse, applied four times. No judged standard; link to B.6.

**Foundations first.** The converse lesson named in one line, the hinge back for one beat: squares add at 90 and only there; longest side plays c. The table is the picture: columns sides | longest | a² + b² | c² | right?, built live row by row, so the method is a row.

**Read.** "Each row gives the three side lengths of a triangle. Mark each as a right triangle or not." Four decisions, each by the same test. At a glance for each row: which is the longest, and is it a triple you know.

**The example.** Four rows chosen so each teaches something: (1) 20, 21, 29: no famous triple; worked fully: longest 29 gold; 400 + 441 = 841; 29² = 841; equal: right. The row's mark fills. (2) 6, 8, 9: looks like 6-8-10, so the trap is to mark it right without checking; 36 + 64 = 100, 9² = 81; close is not equal: not right. (3) 25, 7, 24: the longest is listed first; 49 + 576 = 625 = 25²: right. (4) 8, 11, 14: 64 + 121 = 185, 14² = 196: not right. Rows 2 to 4 are two beats each: longest gold, squares written into the cells, mark. The lesson never repeats a row's full narration.

**Fast.** Per row: longest, square the other two and add, square the longest, compare.

**Sense.** A row with a famous triple or a multiple is right without the arithmetic; a near miss (100 against 81) is not right, however familiar the legs look.

**Check.** Every "right" row's squares re-added; every "not" row's gap stated.

**Rule out.** Not applicable; each row is its own decision.

**Trap.** Marking from two familiar numbers (6 and 8) without the third; taking c as the last listed. The table's "longest" column, filled before any square, makes both impossible.

**Kit.** `table` (exists): cells filled on the word, the longest cell highlighted gold. **Writer:** capable cheaper model, as long as the four rows are taken from this concept (one full, three fast).

### `space-diagonal` — Corner to opposite corner of a box

**Standard.** 8.G.B.7, "in two and three dimensions" and, for the rod, "real-world problems." The radical variants touch HSN.RN.A.2. The method text describes a missing-edge case; no variant asks it; if one appears it is the part-whole move (d² minus the two known squares).

**Foundations first.** The box: isometric, to scale, hidden edges dashed; the corner-to-corner segment, named the *space diagonal*, is a slant that leaves the floor. The theorem in one line, then the two steps (foundation 7): first the floor diagonal, lying flat, the hypotenuse of the floor's L (length and width); then that diagonal is a leg of a triangle standing up inside the box, with the height as its other leg and the space diagonal as its hypotenuse. Lift out: the standing triangle turns out of the box and lies flat beside it, a plain right triangle. Then the two steps are written as one: d² = (l² + w²) + h². The line: "Pythagoras twice: once on the floor, once standing up." And: the floor diagonal is never rooted; only its square is needed.

**Read.** The rod: "What is the length, in inches, of the longest rod that fits inside a closed rectangular box 16 inches by 24 inches by 18 inches? ... along the diagonal from one corner to the opposite corner." Choices: 58 | 34 | 8√13 | 1156. Gold on "corner to the opposite corner." At a glance: the answer is longer than the longest edge, 24, and shorter than the three edges end to end, 58.

**The example.** (1) The box 16 by 24 by 18 to scale; the floor triangle shaded on the floor (legs 16 blue, 24 rust), its diagonal in teal. (2) Board: f² = 16² + 24² = 256 + 576 = 832; the area 832 written on the floor diagonal, no root taken. (3) The standing triangle shaded: legs the floor diagonal (teal, labeled by its square 832) and the height 18 (rust); hypotenuse the space diagonal (violet). It lifts out and lies flat beside the box. (4) d² = 832 + 18² = 832 + 324 = 1156. (5) d = √1156 = 34; 34 inches.

**Quick second case, a radical answer and a cube:** edges 4, 4, 4: d² = 16 + 16 + 16 = 48 = 16 × 3; d = 4√3 (the cells picture from `radical-side-entry`, one beat). Choices 12√3 | 12 | 4√3 | 4√2: 12 is the three edges added, 4√2 is the face diagonal (stopped on the floor), 12√3 squares to 432, not 48.

**Fast.** Square all three edges, add, root once. Never root the floor diagonal in the middle.

**Sense.** Longer than the longest edge, shorter than the edges added; 24 < 34 < 58.

**Check.** 34² = 1156 = 256 + 576 + 324.

**Rule out.** 58 is the three edges added; 1156 is d², an area; 8√13 is √832, the floor diagonal alone. All three dim at once with those three reasons; the decoys are exactly the three wrong moves.

**Trap.** Stopping at the floor diagonal; adding the edges; rooting the floor diagonal and rounding before the second step. Impossible with the lift-out (the floor diagonal is seen as a leg) and with 832 kept as an area label.

**Kit.** `box` with `lift` (4.7); `dim` for choices. **Writer:** strongest; the 3D picture and the choice of which triangle to stand up.

---

## Coordinate distance (`coordinate-distance`, grade 8)

### `coordinate-distance` — Distance between two points

**Standard.** 8.G.B.8: "Apply the Pythagorean Theorem to find the distance between two points in a coordinate system."

**Foundations first.** The plane as two number lines (family 13 named). A point is read by its two coordinates. Along a grid line, distance is a count of steps, which is a subtraction: from x = −2 to x = 3 is five steps, 3 − (−2) = 5 (family 3 named, the double negative said aloud). A slant cannot be read off the grid. Lay on the grid (foundation 8): through one point draw the horizontal, through the other the vertical; they meet at the corner of an L. The legs are grid-line distances; the slant is the hypotenuse of a right triangle; the theorem in one line, with the three squares for one beat. The slope triangle from family 14 is this triangle. The line: "Draw the L. Run, rise, slant."

**Read.** "What is the distance between the points (3, −5) and (−2, 7)?" A distance is a length: positive, less than the walk along the L, more than the longer leg. At a glance: the x's are 5 apart and the y's 12 apart; 5 and 12 make 13.

**The example.** (1) Axes, the two points dotted with coordinate callouts, to scale. (2) The L: the run from x = −2 to x = 3 (blue), bracket 3 − (−2) = 5, five steps counted; the rise from y = −5 to y = 7 (rust), bracket 7 − (−5) = 12, twelve steps counted; the hollow corner at (3, 7). (3) One beat on signs: subtracting the other way gives −5, but a length is five steps either way, and (−5)² = 25 anyway. (4) The slant in teal with "?"; board: d² = 5² + 12² = 25 + 144 = 169; d = √169 = 13. (5) 13. (6) The formula shown as the drawing: d = √((x₂ − x₁)² + (y₂ − y₁)²), each bracket pointing at its leg: "the L for someone without graph paper."

**Fast.** Sketch the L, subtract (or count steps) for each leg, square, add, root. A triple when there.

**Sense.** Shorter than 5 + 12 = 17 (the walk along the L), longer than 12.

**Check.** Count the legs on the grid and compare with the subtractions; 13² = 169.

**Trap.** Adding the legs (17, the walk); dropping the sign in 7 − (−5) and getting 2; writing (−5)² as −25; mixing an x with a y. Impossible because each bracket shows its subtraction and its counted steps, the slant is visibly shorter than the L, and the run is horizontal so it is x's only.

**Kit.** `legs` with `"labels": "diff"` (4.4), `corner` (4.1), `@len` exact (4.2). Generator note: both shown wordings give 13; the other variants (17, 15, 20, 5) show it varies, fine. **Writer:** strongest; this is the moment the family moves onto the plane, and every later lesson points at it.

### `coordinate-distance-exact` — An exact distance, whole or radical (one variant: nearest hundredth)

**Standard.** 8.G.B.8; HSN.RN.A.2 as the simplest-radical stretch; 8.NS.A.2 for the one approximate variant (7.07). The distance lesson's method with one new act: writing a root that is not whole.

**Foundations first.** "Draw the L" in one line with the L on screen. Then "exact" (as in `radical-side-entry`, repeated here because a grade-8 learner may meet this type first): a square of area 40 cut into 2 × 2 cells of area 10, side 2√10; the biggest perfect square comes out as the count along the side, the rest stays under. A sum with no perfect-square factor, like 17, stays as √17. Three answer shapes: whole, m√n, √n; and one wording asks for a decimal instead.

**Read.** "Point A is at (−3, 4) and point B is at (3, 2). What is the exact distance AB?" Choices: 4√10 | 8 | 2√10 | 2. Gold on "exact": the answer is a root written exactly, not rounded. At a glance: run 6, rise 2; 36 + 4 = 40; between 36 and 49, so the distance is between 6 and 7.

**The example.** (1) Points, the L: run 3 − (−3) = 6, rise 2 − 4 = −2, two steps; corner (3, 4). (2) d² = 6² + 2² = 36 + 4 = 40. (3) 40 = 4 × 10; the slant's square cut into 2 × 2 cells of area 10. (4) d = √40 = 2√10. (5) 2√10.

**Quick second cases, different answer shapes.** (−4, −1) to (−3, 3): run 1, rise 4; 1 + 16 = 17; 17 has no perfect-square factor; d = √17 (choices 5 | 17 | √5 | √17). And (1, −6) to (−6, −7), "to the nearest hundredth": run 7, rise 1; 49 + 1 = 50; √50 = 7.0710..., 7.07 (choices 50 | 8 | 7.07 | 7.1). Four beats each.

**Fast.** L, squares, add; pull out the biggest perfect square, or leave it if there is none; round only when the question says to.

**Sense.** 2√10 ≈ 6.3, between 6 and 7; √17 ≈ 4.1, between 4 and 5; 7.07 just past 7.

**Check.** Square the chosen answer: (2√10)² = 40 = 36 + 4. For the decimal: 7.07² = 49.98.

**Rule out.** The sum of the legs (8; 5; 8) is the walk, not the slant. d² itself (17; 50) is an area. A radical that squares to the wrong number (4√10 squares to 160; √5 is 1 + 4 added under the root). The wrong rounding place (7.1 when "hundredth" is gold). Each set dims in one beat with its one reason.

**Trap.** √40 written as 4√10 (the factor pulled out instead of its root): impossible with the cells, two along the side. √(1 + 4) as √5: the legs are squared on the board before they are added.

**Kit.** `legs`, `square` with cells, `dim`. **Writer:** capable cheaper model.

### `midpoint-endpoint` — Midpoint, missing endpoint, or a circle from a diameter

**Misfiled, as the family design explains.** Filed under 8.G.B.8, which is distance only; the midpoint is HSG.GPE.B.6 ("partitions the segment in a given ratio," 1: 1), and the circle variant is HSG.GPE.A.1. Keep it where learners meet it; link it to B.6 and A.1; the template should say it runs ahead of grade 8. It is a **mixed type**: three stories under one name, so the lesson teaches reading, one example per kind, each on its own screen.

**Standard.** HSG.GPE.B.6 (1 : 1) and HSG.GPE.A.1 ("the equation of a circle of given center and radius").

**Foundations first.** The L from the distance lesson. New idea (foundation 9): a point halfway along the slant is halfway along each leg. Cut the run in two and the rise in two; the point drops at the half ticks. Halfway along a number line is the average, so the midpoint's x is the average of the x's and its y the average of the y's. "Midpoint: between, both ways." Then the three stories said plainly before any example: *midpoint* of two endpoints (average); a *missing endpoint* when the midpoint is known (from A to M is half the trip; go the same run and rise again from M); a *circle from a diameter* (the center is the diameter's midpoint; r² is the legs squared from the center to an endpoint; family 28's circle and the circle-equation lesson named: opposite signs in the brackets, r² on the right).

**Read, for each.** Gold on the word that names the story: "midpoint," "coordinates of B" with a midpoint given, "center" or "equation" with "diameter." Before any work: the midpoint is between the endpoints in both coordinates; B is on the far side of M from A; the center is between the diameter's ends and r² is less than the diameter squared.

**Example 1, midpoint.** A(−3, −8), B(6, 3); choices (3, −5) | (4.5, 5.5) | (1.5, −2.5) | (−4.5, −5.5). (1) The L: run 6 − (−3) = 9, rise 3 − (−8) = 11. (2) Each leg cut in two: 4.5 and 5.5; M drops at the half ticks. (3) Board: x = (−3 + 6)/2 = 1.5; y = (−8 + 3)/2 = −2.5. (4) M(1.5, −2.5). Rule out: (4.5, 5.5) and (−4.5, −5.5) are not between the endpoints in both coordinates (they are the half-legs themselves, not added to A): gone together. (3, −5) is between, so it survives the glance; it is the sum, and the check kills it: from A to (3, −5) is 6 across and 3 up, from there to B is 3 across and 8 up, not equal halves. Check: A to M is 4.5 and 5.5, M to B is 4.5 and 5.5.

**Example 2, missing endpoint.** M(−1, 1), A(−3, −2); choices (−4, −1) | (2, 3) | (1, 4) | (−2, −0.5). (1) A and M; the L from A to M: run 2, rise 3. (2) Copy the L once more from M: B = (−1 + 2, 1 + 3) = (1, 4). (3) The same on the board as "double the midpoint, subtract A": 2(−1) − (−3) = 1, 2(1) − (−2) = 4; said once as the same move. Rule out: B is on the far side of M from A, so (−4, −1) and (−2, −0.5), both on A's side, dim together; (2, 3) is the leg lengths, not a point on the line. Check: the midpoint of A(−3, −2) and B(1, 4) is (−1, 1).

**Quick case, a different ask:** "M(−3, −8), A(−3, 8). What is the sum of the coordinates of B?" Run 0, rise −16; B(−3, −24); the sum −27, gold on "sum." Four beats.

**Example 3, circle from a diameter.** Endpoints (7, 7) and (−5, −3); choices (x−1)²+(y−2)²=36 | =61 | =244 | (x+1)²+(y+2)²=61. (1) Center = midpoint: ((7 + (−5))/2, (7 + (−3))/2) = (1, 2). (2) From the center to (7, 7): legs 6 and 5; r² = 36 + 25 = 61 (no root needed; the equation wants r²). (3) (x − 1)² + (y − 2)² = 61. Rule out: (x + 1)² + (y + 2)² has the center's signs unflipped; 244 is the diameter squared (12² + 10²), the radius mistaken for the diameter; 36 is one leg squared. The center-only wording ("A(9, 3), B(5, −9); the center?") is this example's first step, named in the recap; no separate screen.

**Fast.** Midpoint: average each coordinate. Endpoint: copy the legs from M, or 2M − A. Circle: midpoint, then legs squared from the center to an end.

**Sense.** Between, both ways; B past M; r² a quarter of the diameter squared.

**Check.** Equal moves A→M and M→B; put an endpoint into the circle's equation: (7 − 1)² + (7 − 2)² = 36 + 25 = 61.

**Trap.** Averaging A with M to get B (a point a quarter of the way): the family's most common wrong move, impossible once the picture says "copy the legs again from M." Subtracting instead of adding for the midpoint (the distance habit leaking). Using the whole diameter for r. All three are decoys in the real choices.

**Kit.** `legs` with `cuts: 2`, `along` with t = 1/2 (4.1), `circle` (exists), `dim`. **Writer:** strongest; a mixed type that teaches reading.

---

## Segment division (`segment-division`, Geometry)

### `segment-partition` — The point a given part of the way along a segment

**Standard.** HSG.GPE.B.6: "Find the point on a directed line segment between two given points that partitions the segment in a given ratio." (`geo-segment-partition-point`, choose the point, is the same concept; its lesson reuses this one and adds a rule-out.)

**Foundations first.** The midpoint lesson in one line: halfway along the slant is halfway along each leg. Now any fraction of the way (foundation 9): the point a third of the way along the slant is a third of the way along each leg. Build: A, B, the L, each leg ticked into equal parts, the point dropping at the matching tick of both. Then the ratio read as parts (family 10 named): AP : PB = 3 : 2 means five parts in all, and P is three of them from A. The fraction of the way is first part over the total: 3/5. "Directed" means start at the first-named point and go toward the second. The line: "Three to two is three parts out of five, counted from A."

**Read.** "Point P is on segment AB, with A(−4, 0) and B(−9, 15), and divides it so that AP : PB = 3 : 2. What is the x-coordinate of P?" Gold on "3 : 2" and on "x-coordinate." At a glance: five parts, P nearer B than A (three of five); x is between −9 and −4, nearer −9.

**The example.** (1) A and B dotted; the L: run from A to B is −9 − (−4) = −5, five steps left (blue); rise 15 − 0 = 15 (rust). (2) Each leg cut into five parts: one step left and three up per part. (3) Count three parts from A along each leg; P drops at the third tick: x = −4 + 3 × (−1) = −7, y = 0 + 3 × 3 = 9. (4) Board as fraction: x = −4 + (3/5)(−5) = −7; y = 0 + (3/5)(15) = 9. (5) P(−7, 9); the question asks x: −7.

**Quick second case, the fraction wording:** "P is 3/7 of the way from A(−3, −1) to B(18, 13). The y-coordinate?" Run 21, rise 14; 3/7 of 14 is 6; y = −1 + 6 = 5. Four beats. (The 1/2 variant is the midpoint, said in one line.)

**Fast.** Parts total; fraction = first part over total; that fraction of each leg, added to A (a leftward or downward leg is negative and subtracts by itself).

**Sense.** P is between A and B in both coordinates; nearer B when the fraction is more than half.

**Check.** P is on the line: slope A to P is 9/(−3) = −3, slope A to B is 15/(−5) = −3. And P to B is 2 across and 6 up: two more parts of the same size.

**Trap.** 3 : 2 read as 3/2 or as three parts from B (x = −6); 1 : 4 read as a quarter; the fraction applied to B's coordinates instead of to the legs. Impossible with the legs cut into the total number of parts and counted from the named point.

**Kit.** `legs` with `cuts: n`, `along` with `"t": "3/5"`. **Writer:** capable cheaper model; one method, one picture, arithmetic `--dry` can check.
