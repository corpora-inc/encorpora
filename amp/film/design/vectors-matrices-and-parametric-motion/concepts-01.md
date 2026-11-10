# Vectors, matrices and parametric motion: lesson concepts, part 1

Ten problem types, in teaching order rather than catalog order: the arrow films first (components, dot product, angle, resultant), then the table films (data, operations), then the map films (transformation, inverse and determinant, systems, laws). Each later concept names the earlier picture in one line and never re-teaches it. The two parametric types are part 2.

One correction to the family design: ⟨−2, 4⟩ and ⟨0, 3⟩ open about 27° (tan⁻¹(2/4) from the vertical), not 63°. Same conclusion (neither perpendicular nor parallel), right number below.

---

## `vector-components` — Components, sums, differences, multiples, length

**Badly conceived, mildly.** Four standards and three different acts (find a move, combine moves, measure a move) under one name make this the family's longest lesson. It can be carried, as below; a later split into components-and-magnitude and vector-arithmetic would be cleaner. For now one lesson, three examples, because three acts.

**Standard.** HSN.VM.A.2: "Find the components of a vector by subtracting the coordinates of an initial point from the coordinates of a terminal point." HSN.VM.B.4a: "Add vectors end-to-end, component-wise"; B.4c: "v – w as v + (–w) ... perform vector subtraction component-wise"; B.5a: "scaling vectors and possibly reversing their direction; perform scalar multiplication component-wise"; B.5b: "||cv|| = |c|v." A.1 for the symbols **v**, ⟨a, b⟩, |**v**|.

**Foundations first.** A grid of unit squares. Two points; the move from one to the other drawn as an arrow. "So far across, so far up": the across leg dashed in blue with its signed number, the up leg dashed in rust with its number, the pair ⟨\cb{a}, \cw{b}⟩ on the board in the same colors. Define *vector* (a move with a size and a direction), *component* (one slot of the pair), *initial* and *terminal point*, and the symbols. Slide the arrow to a new tail: the legs are the same, so it is the same vector. A vector is a move, not a place. Before each example, one short why: tip to tail (two moves in turn are one move; the blue legs lie end to end, so do the rust ones: slot by slot), the stretch (c multiplies each leg; a negative c passes through the tail), length (the two legs make a right triangle and the arrow is its hypotenuse).

**Example 1 (find the move).** "Vector AB starts at A(0, 4) and ends at B(−6, 11). What are its components?" Choices ⟨−6, 7⟩, ⟨−6, 15⟩, ⟨6, −7⟩, ⟨7, −6⟩. Read: "initial" A, "terminal" B; the answer is a pair. At a glance: B is up and to the left of A, so the pair is ⟨negative, positive⟩: ⟨6, −7⟩ and ⟨7, −6⟩ are gone before any arithmetic. (1) Both points plotted, the arrow drawn from A to B. (2) The blue leg runs from x = 0 to x = −6: −6. (3) The rust leg from y = 4 to y = 11: 7. (4) Board: ⟨−6 − 0, 11 − 4⟩ = ⟨−6, 7⟩. End minus start, slot by slot. Rule out: ⟨−6, 15⟩ added the y's. Check: A plus the move: (0 − 6, 4 + 7) = (−6, 11) = B.

**Example 2 (combine moves).** "u = ⟨4, 5⟩, v = ⟨4, −1⟩. Find 2u − v." Choices ⟨12, 9⟩, ⟨4, 6⟩, ⟨4, 11⟩, ⟨0, 6⟩. Read: scale first, then subtract; a pair. At a glance: the second slot is 2·5 − (−1) = 11 in the head; one choice ends in 11. (1) **u** drawn; stretched by 2 along its own line, legs growing to 8 and 10: visibly twice as long. (2) **v** drawn, flipped about its tail (**v** stays as a ghost): −**v** = ⟨−4, 1⟩. (3) −**v** slides so its tail sits on 2**u**'s tip; the gold arrow from the origin to the last tip is the answer. (4) Legs laid end to end along the axes: blue 8 then −4 is 4; rust 10 then 1 is 11. Board: ⟨8 − 4, 10 + 1⟩ = ⟨4, 11⟩. Rule out: all three others fail the easy slot and dim together; named as they go: ⟨12, 9⟩ is 2**u** + **v** (nothing flipped), ⟨0, 6⟩ is **u** − **v** (the 2 dropped), ⟨4, 6⟩ scaled only the first slot. Check: the gold tip sits at (4, 11) on the grid. Sums (no flip, no stretch) and differences (flip only) are this method with a step left out; the lesson says so. Quick case, the drawn one: **u** = OP and **v** = PQ tip to tail; the sum is the arrow from O to Q, so read Q: (1, 3) gives ⟨1, 3⟩. Its decoys are **u** alone, **v** alone, and the tip-to-tip arrow (that is a difference).

**Example 3 (measure a move).** "v = ⟨−5, 12⟩. What is |−2v|?" Choices 26, 15, 13, −26. Read: a length: one positive number. At a glance: 5-12-13, so |**v**| = 13; doubling doubles the length: 26, no arithmetic. (1) **v** with legs −5 and 12, hypotenuse labeled 13. (2) Stretch by −2: the arrow passes through its tail and comes out the other side, legs 10 and −24, visibly twice as long. (3) √(10² + 24²) = √676 = 26, and |−2|·13 = 26 says the same. (4) The length written along the arrow. Rule out: anything shorter than the longer leg, 24, is gone (13, 15); a negative length is gone (−26). Sense: longer than 24, shorter than 10 + 24. Check: 10² + 24² = 676 = 26².

**Fast.** End minus start; scale, then slot by slot; √(a² + b²) after scaling, or |c|·|**v**|; know 3-4-5, 5-12-13, 8-15-17.

**Lines.** "A vector is a move, not a place." "Tip to tail; slot by slot." "Length is the hypotenuse, never the sum."

**Trap.** Adding the legs for a length (7 for ⟨3, 4⟩), a negative magnitude, dropping the scalar, start minus end, scaling one slot. The stretched arrow is visibly twice as long with its length written along it; the hypotenuse is visibly shorter than the two legs laid end to end; the arrow is drawn from A before anything is subtracted.

**Kit.** 4.1 (`legs`, `components`, `length`, `scale`, `negate`, `copy`, `close`, `stack`), 4.5 `dim`.

**Writer.** A capable cheaper model: every step is a named kit action and the legs do the teaching.

---

## `fl-vector-dot-product` — Dot product, perpendicular condition, scalar projection

**Misfiled.** Linked to HSN.VM.A.1, A.2, B.4, B.5, none of which mentions a dot product. It serves the Florida precalculus benchmark it was written for (the `fl-` prefix) and should be linked there; the only CCSS clause it touches is A.1's "|v|". Assumes the arrow from `vector-components`.

**Foundations first.** Two arrows tail to tail, the angle between them. From **u**'s tip drop a perpendicular onto **v**'s line: the stretch of **v**'s line under **u**, in gold, is the *shadow* **u** casts on **v** (its *scalar projection*). Define the *dot product*: **u**·**v** = u₁v₁ + u₂v₂, slot times slot, added: a number, never a pair. What it means: the length of **v** times the shadow of **u** on **v** (one beat: that is |**u**||**v**| cos θ, the angle lesson's formula). So its sign is the angle's: positive, acute; zero, a right angle, the shadow is a point; negative, obtuse, the shadow points backward.

**Example 1 (dot product and shadow).** "u = ⟨1, −8⟩, v = ⟨−8, −6⟩. Find the scalar projection of u on v, which is u·v / |v|." Read: a signed length, the shadow of **u** on **v**; the formula is given. At a glance: both arrows point down, so the angle is acute and the answer is positive; **v**'s legs are 6-8-10, so |**v**| = 10. (1) Both drawn from the origin, legs colored, the arc between them. (2) **u**·**v** = (1)(−8) + (−8)(−6) = −8 + 48 = 40, the plus written between, the number landing beside the arc, not on an arrow. (3) |**v**| = √(64 + 36) = 10, written along **v**. (4) 40 ÷ 10 = 4. (5) The perpendicular from (1, −8) meets **v**'s line at (−3.2, −2.4); the gold shadow is 4 units long against **v**'s 10, on the grid. Sense: positive, as the sketch said; shorter than |**u**| = √65 ≈ 8.1. Check: 4 × 10 = 40. The plain "find **u**·**v**" variant is step 2 alone; quick case ⟨−4, −2⟩·⟨−4, 0⟩ = 16 + 0 = 16: a zero slot contributes nothing, and the arrows open about 27°, acute, positive.

**Example 2 (perpendicular: find k).** "u = ⟨k, −5⟩ and v = ⟨4, 12⟩ are perpendicular. Find k." Read: "perpendicular" gold: the dot product is zero, one linear equation. At a glance: **v** points steeply up-right; a perpendicular points down-right or up-left; the second slot −5 is down, so k is to the right: positive. (1) **v** drawn, the perpendicular direction dashed through the origin. (2) 4k + (−5)(12) = 0; 4k − 60 = 0; k = 15. (3) **u** = ⟨15, −5⟩ drawn; the right-angle mark. Check: 60 − 60 = 0. Sense: the right angle on the sketch; in one line, the slopes 3 and −1/3 multiply to −1, the grade-8 fact.

**Fast.** Slot times slot, add. Perpendicular: set it to zero. Shadow of **u** on **v**: divide by the length of the one it lands on.

**Line.** "The dot product is a number: how much two moves agree. Zero means a right angle."

**Trap.** Writing ⟨−8, 48⟩ as the answer; the sign slip 4k + 60 = 0, k = −15; dividing by |**u**| for a projection onto **v**. The board writes the plus and the number lands off the arrows; the sketch says k must be positive; the shadow is drawn on **v**.

**Kit.** 4.1 `foot` onto a vector's line; the shadow as a gold segment along the vector.

**Writer.** Cheaper model.

---

## `fl-vector-angle` — Angle between; parallel, perpendicular or neither

**Misfiled**, as the dot product type is: Florida benchmark content, no CCSS clause. Multiple choice, two acts. Assumes the dot product lesson.

**Foundations first.** Tail to tail, the arc θ, between 0° and 180°, the dashed third side closing the triangle. One beat: the third side's length two ways (the law of cosines, from family 30; the slots expanded) gives cos θ = **u**·**v** / (|**u**||**v**|). Then the two tests, in one breath with two sketches: perpendicular when **u**·**v** = 0; parallel when the slots are in proportion, u₁v₂ − u₂v₁ = 0 (the cross; the same cross the determinant lesson draws), and then the sign of the dot product says same way or opposite. Any other pair is neither.

**Example 1 (angle).** "Find the angle θ between u = ⟨3, 1⟩ and v = ⟨−2, 1⟩, 0° ≤ θ ≤ 180°." Choices 45°, 90°, 135°, 180°. (The app's only shown angle variant is a right angle; the lesson works one with a real cosine, since the choice set says the learner will meet 45° and 135°.) Read: one angle. At a glance: one arrow a little above east, the other a little above west: well past 90°, so 135 or 180; the slots are not in proportion, so not 180. (1) Tail to tail, the arc. (2) **u**·**v** = −6 + 1 = −5: negative, obtuse, as seen. (3) |**u**| = √10, |**v**| = √5. (4) cos θ = −5 / √50 = −√2/2, so θ = 135°. (5) The arc reads 135°. Rule out: 45° and 90° are on the acute side of a negative dot product: dim together; 180° needs proportional slots: dim. Check: cos 135° ≈ −0.707 and −5/7.07 ≈ −0.707. Quick case, the app's ⟨−2, 0⟩ and ⟨0, 4⟩: west and north, dot product 0: 90° with no formula.

**Example 2 (classify).** "Which statement describes u = ⟨−2, 4⟩ and v = ⟨0, 3⟩?" Choices: parallel opposite | neither | perpendicular | parallel same. Read: two tests. At a glance: **v** straight up, **u** up and left, opening about 27°: not a right angle, not one line. (1) Perpendicular test: **u**·**v** = 0 + 12 = 12 ≠ 0. (2) Parallel test: (−2)(3) − (4)(0) = −6 ≠ 0. (3) Neither. Rule out: both "parallel" choices need proportional slots, and 0 is not −2 scaled: dim together; "perpendicular" needs a zero dot product. Check: cos θ = 12 / (√20 · 3) ≈ 0.894, θ ≈ 27°.

**Fast.** Dot product zero: 90° at once. Otherwise the formula. If the sketch looks like one line, the cross first.

**Line.** "Dot product zero: a right angle. Slots in proportion: parallel."

**Trap.** "A zero component means perpendicular" (⟨0, 3⟩ looks square to everything); swapping the two tests. The two arrows drawn tail to tail at 27° end the first; the two sketches said in one breath end the second.

**Kit.** `angle` on tail, tip, tip exists; dashed third side exists; `legs` from 4.1.

**Writer.** Cheaper model, if the two tests and their order for "neither" are kept exactly.

---

## `vector-resultant` — Two perpendicular velocities or forces

**Off grade, keep it.** Every variant combines two perpendicular quantities, so it is right-triangle trigonometry in a vector costume (HSG.SRT.C.8, 8.G.B.7). Its true primary is HSN.VM.A.3: "Solve problems involving velocity and other quantities that can be represented by vectors." The precalculus content, B.4b ("given two vectors in magnitude and direction form, determine the magnitude and direction of their sum"), is never generated: the family's biggest gap.

**Foundations first.** A compass on the grid: north up, east right. A velocity or a force is a vector. Two that act together add tip to tail; when they are perpendicular the triangle is a right triangle, and the combined vector, the *resultant*, is its hypotenuse. One card of the stories' words: "relative to the water", "relative to the air" is the boat's or plane's own arrow, a leg; the current or the wind is the other leg; "relative to the shore", "ground path", "the resultant" is the hypotenuse; "θ east of north" opens from north toward east. The habit: draw and label the triangle from the words before any number is squared. Three screens, one per ask, each a different story, so the reading is practiced.

**Example 1 (a missing leg).** "A boat heads straight across a river. The current flows downstream at 10 mph, perpendicular to the heading, and the boat's speed relative to the shore is 26 mph. What is its speed relative to the water?" Choices 24, 576, 27.9, 16 mph. Read: "relative to the shore" gold: 26 is the hypotenuse; the asked speed is a leg. At a glance: a leg is shorter than 26 (27.9 gone); 576 is a square with no root taken (gone); 16 = 26 − 10 is the subtraction trap. (1) The river; the current arrow 10 along the bank; the heading arrow straight across, labeled ?; the resultant 26 in gold from start to landing; the right angle marked. (2) 26² = 10² + h²; h² = 676 − 100 = 576; h = 24. (3) The ? becomes 24. Sense: between 16 and 26 (a leg is less than the hypotenuse and more than the hypotenuse minus the other leg). Check: 24² + 10² = 676 = 26².

**Example 2 (direction).** "A plane flies due north at 438 mph relative to the air. A wind blows due east at 388 mph. The ground path points θ degrees east of north. Find θ, to the nearest degree." Choices 37°, 48°, 42°, 34°. Read: "east of north" gold: the arc opens from north toward east, at the start; the east leg is opposite it. At a glance: 388 < 438, so θ < 45°: 48° is the complement, gone. (1) One square is 100 mph, labeled; north 4.38 squares, east 3.88 from its tip, the gold ground path back to the start, the arc from north. (2) tan θ = opposite / adjacent = 388 / 438 ≈ 0.886. (3) θ = tan⁻¹(0.886) ≈ 41.5°, so 42°. Check: tan 41° ≈ 0.869 and tan 42° ≈ 0.900 bracket 0.886, nearer 42; the other angle, 48°, plus 42° is 90°.

**Quick (the hypotenuse).** Boat 30 mph relative to the water, current 16: √(900 + 256) = √1156 = 34. Rule out together: 46 (added), 14 (subtracted), 1156 (no root): the resultant is more than the bigger speed and less than the two added. The recap says once: two forces at right angles are this same triangle in newtons (15 and a resultant 39: the leg case, 36; 75 east and 32 north "north of east": opposite 32, adjacent 75, 23°).

**Fast.** Draw the triangle, label what is known. Hypotenuse √(a² + b²); leg √(h² − a²); angle tan⁻¹(opposite / adjacent), the opposite leg being the one the arc opens toward.

**Line.** "Which one is the hypotenuse?"

**Trap.** The wrong hypotenuse (√(26² + 10²)); the complement; forgetting the root; subtracting speeds. The known hypotenuse is labeled on the picture before any arithmetic; the arc is drawn opening from north on the word "north".

**Kit.** 4.1 legs at a stated scale; compass labels; `angle` arcs; `dim`.

**Writer.** Strongest: a mixed reading type; the whole skill is naming the hypotenuse and the arc's opening from the words.

---

## `matrix-data-reading` — Entry, row total, column total, dimensions

**Note.** Grade-7 table reading in brackets, owned by HSN.VM.C.6 (+): "Use matrices to represent and manipulate data." Stays, short. It is also the family's table-film opening, so its foundations serve the next lesson.

**Foundations first.** Square brackets around a table of numbers. One row is one store, read across; one column is one item, read down. *Dimensions*: rows × columns, rows first, counted with a sweep down the left edge, then across the top. The *entry* a_ij sits in row i, column j, the same order. The labels are written outside the brackets, stores at the left, items above.

**Example (a row total).** "Matrix A = [18 46 44 17; 13 43 47 10] lists the stock of backpacks, lunch boxes, water bottles and notebooks (columns, in that order) at Eastside and Westside (rows, in that order). How many items of all kinds does Westside have?" Choices 238, 31, 113, 47. Read: Westside is a row; "all kinds" means add across it. At a glance: a sum of four stock numbers is more than the biggest entry (47 gone) and less than everything in the table. (1) Labels outside the brackets. (2) Row 2 lights; the running total ticks 13, 56, 103, 113. (3) 113. Rule out: 31 is 18 + 13, a column (backpacks at both stores: the wrong direction); 238 is every entry. Check: 113 plus the Eastside row, 125, is 238, the grand total sitting among the choices. Quick: dimensions of a 2 × 4 matrix: sweep down, two rows; across, four columns: 2 × 4; 4 × 2 is the reversed decoy. Quick: a₁₂: row 1, column 2: Eastside, lunch boxes.

**Fast.** Rows first, always; the subscript reads the same way.

**Line.** "Rows across, columns down; rows first."

**Trap.** Reversing rows and columns (3 × 2 for 2 × 3); adding down a column when a store is named. The sweep counts rows first on screen; the lit line runs the way the label says.

**Kit.** 4.2 `matrix` with `labels` and `total`.

**Writer.** Cheaper model; vocabulary-level.

---

## `matrix-operations` — Add, scale, multiply; does the product exist

**Standard.** HSN.VM.C.8: "Add, subtract, and multiply matrices of appropriate dimensions." HSN.VM.C.7: "Multiply matrices by scalars." Confirm in `facts.ts` that A − B is generated at all. The 3 × 3 scalar sum is stamina, not an idea; the product is the idea and carries the lesson.

**Foundations first.** The table, in one line. Same dimensions: add or subtract slot by slot; a scalar multiplies every slot. The product is not slot by slot. Lay a row of the left matrix across and a column of the right matrix down, multiply pairwise, add: one entry of the product. So a row must have as many slots as the column: the inner numbers match, or the row has nowhere to land. The result has the left's rows and the right's columns.

**Example 1 (a 2 × 2 product).** "A = [0 3; −4 1], B = [−1 −2; −1 −1]. Find AB." Choices [−3 −3; 3 7], [−6 −3; 2 3], [0 −6; 4 −1], [8 −5; 4 −4]. Read: a 2 × 2. At a glance: row 1 of A down column 1 of B is 0·(−1) + 3·(−1) = −3; only one choice has −3 top left. (1) Row 1 and column 1 glow; 0·(−1) + 3·(−1) = −3 in the margin; it lands. Slowly. (2) Row 1, column 2: 0·(−2) + 3·(−1) = −3. At pace. (3) Row 2, column 1: (−4)(−1) + (1)(−1) = 3. (4) Row 2, column 2: 8 − 1 = 7. Rule out, all on the top-left entry: [0 −6; 4 −1] multiplied slot by slot (its 0 is 0 × −1); [8 −5; 4 −4] is BA; [−6 −3; 2 3] a mix-up. Check: one entry recomputed, row 2 column 2: (−4)(−2) + (1)(−1) = 7.

**Example 2 (a rectangular product, at pace).** "A = [3 3 −3; 3 −1 −2] (2 × 3), B = [1 −1; 0 −3; 1 −1] (3 × 2). Find AB." Inner 3 and 3 match; the result is 2 × 2, which dims the 3 × 3 choice before any arithmetic (that one is BA, also defined, 3 × 2 by 2 × 3). Entries: 3 + 0 − 3 = 0; −3 − 9 + 3 = −9; 3 + 0 − 2 = 1; −3 + 3 + 2 = 2: [0 −9; 1 2]. The transposed decoy [0 1; −9 2] swapped rows and columns. Quick: "A is 2 × 2 and B is 4 × 3; what about BA?" B's row has three slots, A's column has two: nowhere to land: not defined. Quick: 4A + B on 3 × 3: scale first; top left 4·0 + 2 = 2 leaves two choices; top right 4·2 + 1 = 9 leaves one; the rest filled at pace. The decoys are A + B (scalar dropped), 4A − B, A + 4B. A + B on 3 × 2 is the method with no scalar.

**Fast.** For a multiple choice, one entry decides. For existence, the inner numbers.

**Sense.** A zero row of the left stays a zero row; the result is outer by outer.

**Line.** "Row of the first, column of the second: the inner numbers must match."

**Trap.** Multiplying slot by slot; computing BA for AB; the dimension rule backwards; dropping the scalar. The row and column glow together with the plus written between the products; the dimension badges sit under both matrices.

**Kit.** 4.2 `matrix` with `product`, `combine`, `dims`; `dim`.

**Writer.** Cheaper model: the glow is a kit action and the concept fixes the pace (first entry slow, second at pace, the rest together).

---

## `matrix-transformation` — Apply a matrix, name a map, area after a map

**Standard.** HSN.VM.C.12: "Work with 2 × 2 matrices as transformations of the plane, and interpret the absolute value of the determinant in terms of area." HSN.VM.C.11: "Multiply a vector (regarded as a matrix with one column) by a matrix of suitable dimensions to produce another vector." HSG.CO.A.2 only as a stretch.

**Foundations first.** The unit square at the origin, its east edge a blue arrow ⟨1, 0⟩, its north edge a rust arrow ⟨0, 1⟩, a counterclockwise curl inside. "Multiply by M and east lands on M's first column, north on its second; every other point is x copies of the first column plus y copies of the second, so the whole plane follows." Shown with M = [2 1; 0 3]: east lands on ⟨2, 0⟩, north on ⟨1, 3⟩, the square tilts into a parallelogram with base 2 and height 3: area 6, counted on the grid. ad − bc = 6 − 0 = 6 is named the *determinant*: the area of the square after the map. A reversed curl means the plane turned over: a negative determinant, same area.

**Example 1 (apply).** "M = [−3 −1; 1 −2] sends (x, y) to M[x; y]. Where does M send (3, −1)?" Choices (−8, 5), (−9, 2), (−10, −1), (5, −8). Read: a point. At a glance: three copies of ⟨−3, 1⟩ and one copy backward of ⟨−1, −2⟩ land far to the left and up: the second quadrant. (1) Board: row 1 times the column: −3·3 + (−1)(−1) = −8; row 2: 1·3 + (−2)(−1) = 5. (2) The walk: from the origin three blue copies of ⟨−3, 1⟩ tip to tail to (−9, 3), then one rust copy of ⟨−1, −2⟩ walked backwards to (−8, 5). (3) The whole plane applied; (3, −1) rides to (−8, 5), its ghost left behind. Rule out: (5, −8) swapped slots; (−9, 2) multiplied slot by slot; (−10, −1) used the columns as rows. Check: the walk lands where the arithmetic says.

**Example 2 (read or write a map from its columns).** "Which matrix reflects points across the line y = x?" Choices [0 1; 1 0], [−1 0; 0 −1], [2 0; 0 2], [3 0; 0 3]. Read: where do east and north land under that reflection? East (1, 0) lands at (0, 1); north (0, 1) lands at (1, 0). Those are the columns: [0 1; 1 0]. Picture: the square flips across the diagonal, the curl reverses, det = 0 − 1 = −1: a reflection. Rule out: [2 0; 0 2] and [3 0; 0 3] keep both directions and stretch (dilations, det 4 and 9): dim together; [−1 0; 0 −1] sends east to west and north to south: a half turn. Quick, the other direction: [1 0; 0 −1] leaves east alone and flips north to ⟨0, −1⟩: reflection across the x-axis; a quarter turn would move east off its axis. Fast: det −1, a reflection; det 1, a rotation; det k², a dilation by k.

**Quick (area).** "A triangle of area 8 is transformed by M = [−2 4; 4 2]. Area of the image?" det = −4 − 16 = −20; every area is multiplied by |−20| = 20: 160. The sign says the plane turned over, not that the area is negative. Sense: the columns ⟨−2, 4⟩ and ⟨4, 2⟩ are perpendicular (dot product 0) and each √20 long, so the unit square becomes a tilted square of area 20, drawn to scale. Rule out together: −160 (no area is negative), 28 (8 + 20), 32 (8 × 4, the largest entry).

**Check.** The second slot alone (3 + 2 = 5); the columns read back.

**Line.** "The columns are where east and north land."

**Trap.** Slot by slot; columns used as rows; a signed area; the two quarter turns confused with each other and with [0 1; 1 0]. The walk of copies is the arithmetic; the curl shows the sign; east's landing names the map.

**Kit.** 4.3 `map` (`apply`, `copies`, area count, curl, ghosts); 4.2 `matrix` with colored columns and `as-arrows`; `dim`.

**Writer.** Strongest: the screenplay is the design.

---

## `matrix-inverse-determinant` — Determinant, does an inverse exist, the inverse

**Standard.** HSN.VM.C.10: "The determinant of a square matrix is nonzero if and only if the matrix has a multiplicative inverse." HSA.REI.C.9: "Find the inverse of a matrix if it exists."

**Foundations first.** The map opening, short, naming the transformation lesson: the square lands on the parallelogram of the two columns; det = ad − bc is its signed area, drawn as the cross: the main diagonal joined in blue, the other in rust, the minus between. Two facts from the picture. A map with area can be played backwards: that is the *inverse* A⁻¹, and A⁻¹A = I, the square returns. A determinant of 0 squashes the square to a segment: two marked points land on one spot and nothing afterward can tell them apart: no inverse. Then the recipe, by motion: the diagonal entries slide past each other (swap), the off-diagonal entries flash rust as their signs flip (negate), 1 over the determinant writes itself in front (divide).

**Example 1 (the inverse).** "Find the inverse of A = [3 −1; −3 3]." Choices: four 2 × 2s. Read: a 2 × 2 that undoes A; it exists, so det ≠ 0. At a glance: the rows ⟨3, −1⟩ and ⟨−3, 3⟩ are not proportional, so the determinant is not zero. (1) The cross: 3·3 = 9 in blue, (−1)(−3) = 3 in rust; det A = 9 − 3 = 6. (2) Picture: the square becomes the parallelogram of ⟨3, −3⟩ and ⟨−1, 3⟩; the area label counts to 6. (3) Swap 3 and 3; negate −1 and −3 to 1 and 3; write 1/6 in front: (1/6)[3 1; 3 3] = [1/2 1/6; 1/2 1/2]. (4) The map plays backwards; the square returns. Rule out: [3 1; 3 3] forgot 1/det (it would stretch the area by 6 again, not undo it); the two with minus signs negated the wrong entries, and one product entry shows it. Check: row 1 of A times column 1 of A⁻¹: 3·(1/2) + (−1)(1/2) = 1; times column 2: 3·(1/6) + (−1)(1/2) = 0: the identity's first row.

**Example 2 (no inverse, at a glance).** "Exactly one of these has no inverse. Which?" [−3 −4; 10 12], [−3 −4; 9 12], [−4 −4; 9 12], [−3 −5; 9 12]. Read: no inverse means det 0 means one row a multiple of the other. At a glance: −3, −4 times −3 is 9, 12: the second matrix. Each other breaks the proportion by one entry. Picture: columns ⟨−3, 9⟩ and ⟨−4, 12⟩ lie on one line; the square squashes to a segment; two points land together. Check: (−3)(12) − (−4)(9) = −36 + 36 = 0; the neighbors give 4, −12 and 9. Quick: det [6 −3; −4 5] = 30 − 12 = 18 (−18 read the cross backwards; 42 added). Quick: "for which k does [k 1; −2 3] have no inverse?" 3k − (1)(−2) = 3k + 2 = 0, k = −2/3; sense: then the second row is 3 times the first.

**Fast.** Proportional rows: zero, no arithmetic. Otherwise the cross. Then swap, negate, divide.

**Lines.** "The determinant is the area of the square after the map. No area, no way back." "Swap, negate, divide."

**Trap.** ad + bc, or bc − ad; the inverse without 1/det; negating the diagonal instead of the off-diagonal. The cross is drawn blue first, rust second, the minus between; the recipe is three visible motions in order.

**Kit.** 4.2 `det`, `inverse`; 4.3 `apply`, `undo`, the squash with `mark`.

**Writer.** Strongest: the squash and the undo must be staged, not described.

---

## `matrix-linear-system` — AX = B

**Standard.** HSA.REI.C.8: "Represent a system of linear equations as a single matrix equation in a vector variable." HSA.REI.C.9: "use it to solve systems of linear equations." HSN.VM.C.10 for det 0. Two notes: a variant hands over A⁻¹ without A, so the check there cannot be substitution; and confirm in `facts.ts` whether any variant asks the learner to write A (the samples hand it over; the lesson builds it anyway, since REI.C.8 asks it).

**Foundations first.** Each equation is one row of A: the x-coefficient, then the y-coefficient; the unknowns are the column X = [x; y]; the right sides are the column B. One beat: row 1 of A times X is −3x + y, the first equation, so AX = B is the system written once. On the map: A sends the point (x, y) to B; the question is which point A sent there; the inverse brings B back: X = A⁻¹B, inverse on the left (undo, from family 11). If det A = 0 the plane is squashed to a line; B off the line has no solution, B on it has infinitely many; either way no single answer, and no A⁻¹.

**Example 1 (solve).** "The system −3x + y = 1, −x + 4y = 7 is AX = B with A = [−3 1; −1 4], B = [1; 7]. Solve using X = A⁻¹B." Choices (−3, −20), (−1, 2), (3/11, 20/11), (20/11, 3/11). Read: a pair. At a glance: (−3, −20) is far too big for right sides 1 and 7; the two fraction choices are one pair swapped, so the first equation will decide. (1) det A = (−3)(4) − (1)(−1) = −11. (2) A⁻¹ = (1/−11)[4 −1; 1 −3]: swap, negate, divide. (3) A⁻¹B: row 1: 4·1 + (−1)·7 = −3; row 2: 1·1 + (−3)·7 = −20; divide by −11: (3/11, 20/11). The decoy (−3, −20) is the step before dividing. (4) x first, y second. Check: −3(3/11) + 20/11 = 11/11 = 1; −3/11 + 80/11 = 7. Rule out: (−1, 2) gives −3(−1) + 2 = 5; the swapped pair gives −57/11.

**Quick (A⁻¹ given).** A⁻¹ = (1/2)[−2 3; −2 2], B = [1; 6]: −2 + 18 = 16, −2 + 12 = 10, then the 1/2: (8, 5). (16, 10) forgot the fraction in front. Check without A: redo both dot products slowly; the sure check is to invert A⁻¹ back (det 1/2, so A = [2 −3; 2 −2]) and substitute: 16 − 15 = 1, 16 − 10 = 6.

**Quick (det 0).** "−x + 2y = 5, −2x + 4y = 4 ... can it be solved as X = A⁻¹B?" Row 2 of A is twice row 1: det 0 at a glance, (−1)(4) − (2)(−2) = 0 confirms. No inverse. The left sides are proportional and the right sides are not (2·5 ≠ 4): parallel lines, no solution. Every "Yes" choice either claims a nonzero determinant or says det 0 means yes.

**Fast.** X = A⁻¹B, inverse on the left; det 0 at a glance from proportional rows.

**Check.** Substitute into both equations.

**Line.** "Inverse on the left."

**Trap.** Forgetting 1/det; swapping x and y; writing BA⁻¹ (its dimensions, 2 × 1 by 2 × 2, do not even match; the lesson says so in one line). The fraction is written in front on the word "divide"; x is read first.

**Kit.** 4.2 `matrix` with one-column vectors and `product`; 4.3 for one beat.

**Writer.** Cheaper model, once the inverse film exists.

---

## `matrix-laws` — AB against BA, the identity, which laws hold

**Standard.** HSN.VM.C.9: "unlike multiplication of numbers, matrix multiplication for square matrices is not a commutative operation, but still satisfies the associative and distributive properties." HSN.VM.C.10 for the identity; C.8 for computing BA. **One weak item:** the choice "AB = BA: the entry in row 1, column 2 is 4 in both" justifies equality by one entry; one differing entry disproves equality, but proving it needs all four. The lesson computes all four and says so; the app's wording should say every entry matches.

**Foundations first.** The map opening on twin planes. A product means do the right matrix first, then the left. Regrouping, (AB)C = A(BC), never changes the order the maps are done in: it always holds. Splitting, A(B + C) = AB + AC and (A + B)C = AC + BC, keeps every matrix on its own side: it holds. I does nothing, so IA = AI = A; the zero matrix sends everything to the origin and plays 0. What fails is anything that quietly swaps the order. Staged: R a quarter turn counterclockwise, F a flip across the x-axis. East under F then R (that is RF): F leaves east alone, R turns it to north, ⟨0, 1⟩. East under R then F (FR): R turns it north, F flips it to south, ⟨0, −1⟩. Different landings: RF ≠ FR. And cancelling needs an inverse: a squash sends two different points to one spot, so AB = AC can hold with B ≠ C.

**Example 1 (which does NOT hold).** "A, B, C are 2 × 2 and I is the identity. Which equation does NOT hold for all such matrices?" (AB)C = A(BC) | A(B + C) = AB + AC | AI = IA = A | (AB)² = A²B². Read: "NOT" gold: find the hidden swap or cancel. At a glance: the first three only regroup, split or multiply by I; the fourth, written out, is ABAB against AABB: the middle BA became AB. (1) Board: (AB)² = ABAB; A²B² = AABB; equal only if BA = AB. (2) Twin planes with R and F: RF is the flip across y = x (columns ⟨0, 1⟩, ⟨1, 0⟩), so (RF)² = I: the square returns. R² is a half turn and F² = I, so R²F² = −I: the square lands upside down. Not equal. (3) The three true ones, one line each with their picture. Rule out: the three that keep order. Check: one counterexample is enough to break a law.

**Example 2 (which holds).** "(A + B)C = AC + BC | (A + B)(A − B) = A² − B² | AB = AC implies B = C | (A + B)² = A² + 2AB + B²." At a glance: (A + B)(A − B) = A² − AB + BA − B² and (A + B)² = A² + AB + BA + B² need AB = BA to collapse; cancelling A needs A⁻¹; the first keeps C on the right in every term: splitting. Rule out together: two hidden swaps and a hidden inverse.

**Quick.** AB against BA for A = [0 1; 0 2], B = [−2 3; 0 4]: all four entries of each: both [0 4; 0 8]: this pair commutes. "Matrices never commute" is false (I commutes with everything, and so does this pair); "only if one is the identity" is false; never assume either way, compute. Quick: BA for A = [1 −3; 3 3], B = [−3 3; 3 −1]: rows of B down columns of A: [6 18; 0 −12]; the decoy [−12 6; 0 6] is AB, a free counterexample. Quick: the identity is the matrix whose columns are east and north themselves: [1 0; 0 1]; the zero matrix plays 0.

**Fast.** Does the equation swap two matrices or cancel one? It can fail. Does it only regroup, split or use I? It holds.

**Check.** Test with R and F, or any small pair.

**Line.** "Order matters; grouping and splitting don't."

**Trap.** Expanding (A + B)² with 2AB; cancelling A; "matrices never commute." East landing in two different places on the twin planes ends the first two; the commuting pair ends the third.

**Kit.** 4.3 `map` with `twin`; 4.2 `product`; `dim`.

**Writer.** Strongest: the quality is in tracing each identity to a hidden swap and staging the counterexample.