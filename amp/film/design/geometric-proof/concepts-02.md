# Geometric proof, part 2: the parallelogram and construction concepts

Four types, three lessons: `geo-parallelogram-sufficient` shares its lesson with `rg-quadrilateral-choice` and `parallelogram-angle-steps` with `rg-parallelogram-perpendicular` (identical questions; one film, a `--variant` id for the stepwise format). Numbers in every example are checked against `facts.ts`; every figure is drawn at the solved value.

---

## `parallelogram-property-consequences` — Use a parallelogram's facts: a reason, a length, an angle

**Misfiled.** Nothing misfiled, but the "same units" tag is a template artifact and the lesson never reads it aloud. The verb in the standard is *prove*; the app uses the properties. The foundation shot proves them, so the lesson serves the standard the app does not.

**Standard.** HSG.CO.C.11: "opposite sides are congruent, opposite angles are congruent, the diagonals of a parallelogram bisect each other, … rectangles are parallelograms with congruent diagonals." The consecutive-angle case (50° → 130°) is HSG.CO.C.9's parallel-lines clause (same-side interior angles) wearing a parallelogram.

**Foundations first.** *Defined:* parallelogram (both pairs of opposite sides parallel); diagonal (corner to opposite corner); rectangle (a parallelogram with a right angle); consecutive angles (neighbors, sharing a side); opposite (across from each other). *Built:* ABCD drawn from the sentence, diagonals AC and BD, E where they cross. Then the one motion that proves four facts: **half-turn** ABCD about E. A lands on C, B on D; the figure lands on itself. So AB landed on CD (opposite sides equal: one tick each), ∠A landed on ∠C (opposite angles equal: arcs), and AE landed on EC, BE on ED (each diagonal cut in half). Each mark appears as its part lands. Fifth fact, from family 23 in one line: AD ∥ BC with AB as the transversal, so ∠A and ∠B are same-side interior, the C: they add to 180°. Sixth, rectangles only: **fold** a rectangle over the line through the midpoints of AB and CD; AC lands on BD, so the diagonals are equal. The lesson says plainly: *this fold needs square corners; a slanted parallelogram's diagonals are not equal*, and shows the slanted one with visibly unequal diagonals. The card beside the figure lists the five parallelogram facts in teal and the rectangle fact apart from them.

**Read.** Two words decide everything: the **figure's name** (parallelogram or rectangle: AC = BD is allowed only under "rectangle") and the **thing asked** (gold: AC, m∠B, "reason"). Then one beat on what the answer looks like: AC is a whole diagonal, so twice a half and not x; ∠B is A's neighbor, so it is 180° minus 50°; a reason for "AB = DC" must be a reason about *sides*.

**The example, A (halves of a diagonal).** "Diagonals AC and BD of parallelogram ABCD meet at E. AE = 4x − 21 and EC = 3x − 14. What is AC?" choices 21 | 7 | 14 | 28. (1) Draw the sentence; the expressions ride AE and EC as labels. (2) "Parallelogram" and "meet at E": the half-turn fact: AE = EC. The two halves get one tick each. (3) The equation the fact hands over: 4x − 21 = 3x − 14, so x = 7 (family 11, every step written). (4) Put it back: AE = 7, EC = 7; the labels rewrite to 7 and 7. The figure was drawn with AC = 14 all along, so the picture is true. (5) The question asked for AC: 7 + 7 = 14. Box 14.

**The example, B (a rectangle's diagonals).** A different theorem and a different trap, so fully worked: "ABCD is a rectangle with diagonals AC = 3x + 13 and BD = 4x + 6. What is AC?" choices 34 | 7 | 17 | 36. (1) Draw a 30 by 16 rectangle (its diagonals are 34 to scale) with the small boxes at the corners. (2) "Rectangle": the fold: AC = BD. (3) 3x + 13 = 4x + 6, so x = 7. (4) Both labels rewrite to 34. (5) Asked AC: 34. Box.

**Quick cases.** "m∠A = 50°. What is m∠B?": ABCD drawn at 50°; B is A's neighbor on the C; 180 − 50 = 130°. "A proof states AB = DC. Which reason?": the statement compares two sides, so the reason is about sides; the figure is a parallelogram, so rectangle facts are out; "opposite sides of a parallelogram are congruent".

**Fast.** Name the parts the claim compares (sides, angles, neighbors, a diagonal's halves, two diagonals); the fact hands over one equation; solve; then answer the thing asked.

**Sense.** The two halves come out the same positive number; the whole is twice. The two diagonals come out the same. Neighbors add to 180°, so one is acute and one obtuse unless both are 90°.

**Check.** Put x into *both* expressions and see the same number (7 and 7; 34 and 34). For the angle, 50 + 130 = 180, and the four angles 50, 130, 50, 130 make 360.

**Rule out.** "Is that x?" dims 7. "Is that a half?" dims 17; "is that a double?" dims 28. 310° does not fit inside any corner; 90° is only for a rectangle; 50° is the angle *across*, not the neighbor. For reasons: the ending test (a statement about sides wants a reason about sides) dims two at once, and "rectangle" in a reason dims when the figure is only a parallelogram.

**Line.** "The fact hands you the equation. Find x, then answer the question."

**Trap.** Answering x or the half for AC, and writing AC = BD for a plain parallelogram. The figure at the solved value, with the halves visibly half, kills the first; the slanted parallelogram with unequal diagonals in the foundation kills the second.

**Kit.** Nothing beyond the family's tools: `turn` about E with `through` points, `flip`, `angle.arcs`, `seg.ticks`, labels riding segments, `dim`. The `--dry` to-scale note (ticked segments of unequal length) protects this lesson.

**Writer.** A capable cheaper model, from this concept: each case is one named fact, one equation and predictable decoys, and the frame shows whether the figure is to scale.

---

## `geo-parallelogram-sufficient` (with `rg-quadrilateral-choice`) — Which added fact makes it a rhombus or a rectangle

**Misfiled.** "Judged to serve 5.G.B.4" is six grades low; this is HSG.CO.C.11. `rg-quadrilateral-choice` is the same type and also holds a trapezoid-angle variant that belongs to `fl-trapezoid-consequences`. One lesson for both.

**Standard.** HSG.CO.C.11: "rectangles are parallelograms with congruent diagonals" and the sufficient conditions behind "prove theorems about parallelograms"; the rhombus conditions are the same standard's intent, though the text names only rectangles.

**Foundations first.** *Defined:* rhombus (a parallelogram with four equal sides), rectangle (a parallelogram with a right angle), square (both); "sufficient" or "enough": the added fact *forces* the name. *Built:* **the two sticks.** Two segments pinned at their midpoints, their four ends joined. Half-turn about the crossing: the figure lands on itself, so it is a parallelogram, and the lesson says the key sentence once: *every parallelogram is two sticks crossing at their middles; the sticks are its diagonals.* So every parallelogram already has: opposite sides equal, opposite angles equal, neighbors adding to 180°, diagonals that cut each other in half. These are written on the card under "already true: adds nothing." Then change a stick and watch the shape follow. **Equal sticks**: ticks appear on all four half-sticks; the corners square up; why, in three lines on the figure: triangles ABE and ADE are isosceles, so ∠BAD = x + y where x and y are their base angles, and triangle ABD's angles are x, x + y, y, which sum to 180°, so x + y = 90°: a rectangle. **Square cross** (sticks perpendicular, the box appears): fold over stick AC; it is the perpendicular bisector of BD, so B lands on D and AB = AD; with opposite sides already equal, four equal sides: a rhombus. **Both**: a square. One more rhombus fact the app asks for: a diagonal that splits a corner. With ∠BAC = ∠CAD, and ∠BAC = ∠ACD by the Z (AB ∥ DC), triangle ACD has two equal angles, so two equal sides, DA = DC: two equal neighbors, and the half-turn makes it four: a rhombus.

**Read.** The name asked goes gold. Then what the answer must be: a fact every parallelogram does *not* already have, and of the right family: rhombus facts are about **sides** (two equal neighbors; perpendicular diagonals; a diagonal that bisects an angle); rectangle facts are about **right angles and equal diagonals**.

**The example.** "Parallelogram ABCD is given. Which added condition is enough to prove that ABCD is a rhombus?" choices: diagonals congruent | opposite angles congruent | a diagonal bisects an angle | it has a right angle. (1) The sticks, slanted, with ABCD drawn. (2) First cut: "opposite angles congruent" is on the already-true card; it adds nothing; dims. (3) Second cut: "diagonals congruent" and "a right angle" are rectangle facts; on screen, make the sticks equal: the corners square up but the sides stay unequal (a 30 by 16 rectangle is no rhombus). Both dim together. (4) The one left: a diagonal bisects an angle. Prove it earns the name: the Z gives ∠BAC = ∠ACD, the given gives ∠BAC = ∠CAD, so triangle ACD is isosceles, DA = DC; equal neighbors plus the half-turn: four equal sides. Ticks appear on all four sides as they are earned. Box it.

**Quick case** (the other direction the app asks): "...a rectangle?" choices: opposite sides congruent | diagonals bisect each other | opposite angles congruent | diagonals congruent. Three are on the already-true card and dim in one beat; equal sticks square the corners: diagonals congruent.

**Fast.** Cross off everything every parallelogram has. Of what is left: sides or square cross for a rhombus; a right angle or equal sticks for a rectangle.

**Sense.** The drag test: if the added fact can hold while the shape stays slanted and lopsided, it is not enough. Equal sticks can stay slanted? No, they square up. A square cross can stay unequal-sided? No. Bisected diagonals can: every parallelogram has them.

**Check.** Say which new fact the condition forces (a 90° corner, or two equal neighbors) and read the definition back.

**Rule out.** Two choices are usually on the already-true card: gone in one beat. One is usually the other shape's fact: gone when the stick moves.

**Line.** "Two sticks crossing at their middles make a parallelogram. Equal sticks, a rectangle. Square cross, a rhombus."

**Trap.** Swapping them: equal diagonals for a rhombus, perpendicular diagonals for a rectangle; and picking a fact every parallelogram already has. Making the sticks equal on screen and seeing a long thin rectangle ends the first for good; the already-true card, written before the choices are read, ends the second.

**Kit.** `through` points so the quadrilateral follows a moved stick end; ticks and the right-angle box shown on the word they are earned (`show` on `seg.ticks` and `angle.right`); `dim`. No new component, though a `sticks` helper (two segments pinned at their midpoints, the quadrilateral on their ends) would save the next two families (22's hierarchy, 26) from rebuilding it.

**Writer.** Strongest writer for the first version: the isosceles chain and the Z-and-fold chain must be staged on the figure, not listed, and a weak writer flattens the sticks into a table of facts.

---

## `parallelogram-angle-steps` (with `rg-parallelogram-perpendicular`) — The perpendicular from a corner

**Misfiled.** "Judged to serve 7.G.B.5" is below grade; the type serves HSG.CO.C.9 (the linear pair) and C.10 ("interior angles of a triangle sum to 180°", here as the right triangle's two acute angles making 90°). The parallelogram is only the setting; its facts are never used. Both ids are one lesson; the stepwise format is the `--variant`.

**Standard.** HSG.CO.C.10 (triangle angle sum) and C.9 (linear pair), as above.

**Foundations first.** *Defined:* perpendicular (meets at a right angle, the box); the foot (where the perpendicular lands); right triangle; linear pair (two angles side by side on a straight line, adding to 180°); "E is on line BC so that B is between E and C" read slowly: E is *past* B, on the extension. *Built:* a right triangle with the box at one corner; family 23's fact in one line, the three angles make 180°, so with 90° spent, **the other two make 90°**. Then the whole question of this type, shown before any numbers: from corner A drop the perpendicular to line BC. Drag B's angle from acute to obtuse and watch the foot: at 68° it lands on the side; past 90° it slides off the end and lands outside, beyond B. The angle at B *inside the right triangle* is ∠ABC itself when the foot is on the side, and ∠ABC's linear-pair partner, 180° − ∠ABC, when the foot is outside.

**Read.** The given angle and its vertex go gold; the asked angle is the one at A in the right triangle. At a glance: is the given angle under 90° (foot on the side, use it as is) or over 90° (foot outside, use its partner)? The sentence says so twice: "on side BC" against "on line BC so that B is between E and C". The answer must be acute, less than 90°, because it sits in a right triangle.

**The example (foot outside).** "In parallelogram ABCD, m∠ABC = 141°. Point E is on line BC so that B is between E and C, and AE ⊥ BC. Find m∠BAE. Enter each step." (1) Draw the sentence to scale: ABCD with 141° at B; the line BC extended past B; the perpendicular from A lands at E beyond B, the box at E. The learner sees it *cannot* land on the side. (2) Which angle at B is in triangle ABE? Focus on the triangle: ∠ABE, not ∠ABC. (3) Step one, the linear pair: E, B, C are on one straight line, so ∠ABE + 141° = 180°: ∠ABE = 39°. Written as the first step box. (4) Step two, the right triangle: 39° + ∠BAE = 90°: ∠BAE = 51°. The second step box. (5) Box 51°.

**Quick case (foot on the side).** Fully its own screen because step one differs: "m∠ABC = 68°. E is on side BC with AE ⊥ BC. Find m∠BAE." Drawn at 68°, the foot lands on the side; triangle ABE's angle at B is 68° itself (step one), 90 − 68 = 22° (step two). The "some steps filled in" format is the same work with one box already written; the lesson says that in passing.

**Fast.** Two steps, always: the angle at B inside the triangle (the given, or 180° minus the given), then 90° minus it.

**Sense.** The answer is under 90°. When B is obtuse, the answer is how far B is past 90°; when acute, how far B is short of 90°. The picture agrees: a wide corner gives a fat triangle at A.

**Check.** The three angles of the triangle: 39 + 51 + 90 = 180. And, said as a check and never as the method: the answer is |90 − ∠ABC|: 51 and 22.

**Rule out.** Open answer; none.

**Line.** "Right triangle: the other two make ninety. First find which angle at B is in the triangle."

**Trap.** Putting the obtuse angle inside the right triangle (90 − 141 = −51, then dropping the sign and entering 141 as step one), and its mirror: subtracting from 180 when the foot is on the side. The to-scale drawing, with the foot visibly outside or inside, makes the wrong choice look wrong before any arithmetic.

**Kit.** `foot` points and `angle.right` exist; the figure must be drawn at the stated degree (the `--dry` to-scale note). The `problem` card needs the app's **step boxes** (two labeled blanks under the prompt, filled as each step is found) so the film looks like the problem; a small addition to `problem` and `answer`.

**Writer.** A capable cheaper model: two cases, one picture decides them, and the frame shows at once whether the foot landed where the degree says.

---

## `compass-straightedge-reasoning` — Constructions as proofs you can draw

**Misfiled.** A mixed type: three kinds of question (next step, order, reason) over four constructions (perpendicular bisector, perpendicular at a point on the line, angle bisector, parallel through a point by copying an angle). Of D.12's six constructions, copying a segment never appears and copying an angle appears only inside the parallel; a gap for the alignment list. The lesson teaches reading, with one idea true for every question.

**Standard.** HSG.CO.D.12: "constructing perpendicular lines, including the perpendicular bisector of a line segment; … bisecting an angle; … constructing a line parallel to a given line through a point not on the line."

**Foundations first.** *Defined:* compass (draws every point at one distance from its center: a circle, or an arc of one), straightedge (draws the line through two points; it does not measure), construction (only those two tools, so a protractor or ruler is never a step), opening or radius, arc, equidistant, perpendicular bisector (through the midpoint at a right angle), bisect. *Built, live:* the perpendicular bisector of AB. Open the compass wider than half AB (the lesson first shows a too-narrow opening: two arcs that never meet, then widens). Arc from A, with the dotted radius riding the pencil; **same opening**, arc from B; they cross at X above and Y below; straightedge through X and Y. Then the proof by the fold: join X to A and B: two equal radii, one tick each, the kite; same at Y. Fold on XY: A lands on B, because X and Y are each the same distance from both ends. So XY is the fold line, the perpendicular bisector. The second idea is said once: **a step may use only points that already exist**, because the compass needs a center and the straightedge needs two points.

**Read.** Which kind is asked (gold): "next step", "which order", "which fact" or "which theorem". What the answer looks like: a next step uses the same opening and only existing points; an order never names a point before the step that makes it; a reason for a compass step ends in "equidistant" or "same distance", and a reason for "parallel" is a converse.

**The example (reason).** "Arcs centered at A and B have the same radius and cross at X and Y. Which fact explains why line XY is the perpendicular bisector of AB?" (1) The construction already built stands on screen; the kite's four ticks appear as the voice says "same radius". (2) X is the same distance from A and B; so is Y; so both sit on the fold line; two points fix a line. The fold plays once more and the answer chip lights. (3) The decoys, each dimmed with its reason: "radius AB, so ABX is equilateral": the opening need not be AB, and even so XY is not a side of that triangle; "XY parallel to AB": XY crosses AB; "the compass measures a right angle": a compass measures one distance and nothing else.

**Quick cases, one per kind.** *Next step, angle bisector:* arc from B marks P and Q at one distance from B; next, the same opening from P and from Q crossing inside at R; R is equidistant from P and Q, so BR is the spine of kite BPRQ; fold on it, P lands on Q, the angle is split. "Draw PQ" dims (it is a chord across the angle, not the splitter); "protractor" dims (not a construction); "different openings" dims (then the crossing is nearer one ray). *Order, the perpendicular at P on ℓ:* the "does it exist yet?" test: arcs centered at P need P (so 4,1,2,3 dies); arcs at X and Y need X and Y (1,2,4,3 dies); line PZ needs Z (1,4,3,2 dies); 1, 4, 2, 3. The lesson points out it is the perpendicular bisector of XY with P its midpoint: the same kite. *Reason, the parallel through P:* the copied angle makes a pair of equal corresponding angles; the new line is claimed *parallel*, so only a converse fits: "if corresponding angles are congruent, the lines are parallel." The theorem that runs the other way dims, with the family's direction rung said once.

**Fast.** Every compass fact is "equidistant"; equidistant from two points means on their perpendicular bisector; two points fix a line. For order, read each step for the points it needs.

**Sense.** The two arcs must be able to cross (opening wider than half); the bisector must pass through the crossings; a bisector of an angle runs *from the vertex*.

**Check.** Do the fold in your head: does the construction's line land one end on the other? For an order, read the chosen sequence and confirm every point is made before it is used.

**Rule out.** Any step that measures (ruler, protractor) dims at once: not a construction. Any step using a point not yet made dims. Any arcs with changed openings dim. A reason that does not end in "equidistant" or a converse for a parallel conclusion dims.

**Line.** "A compass draws every point at one distance. Equidistant from both ends means on the fold line."

**Trap.** Changing the opening between the two arcs (the crossing drifts off the bisector), an opening too narrow to cross, and drawing the line between the two arc-marks PQ instead of from the vertex. The dotted radius riding the pencil makes "one distance" visible, and the too-narrow attempt is shown and fixed before the method.

**Kit.** `arc` with `compass: true` (center dot, dotted radius riding the pencil, `draw` on the word), `meet` points (arc with arc, arc with ray), `flip` over XY and over BR, `dim`. The order question's long problem card with four step sentences must wrap and stay readable; the kit's long card does.

**Writer.** Strongest writer: four constructions and three question kinds under one idea, and the quality is in choosing which construction exposes each kind and proving it with the fold rather than describing it.