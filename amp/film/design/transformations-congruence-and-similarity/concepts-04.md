# Transformations, congruence and similarity, part 4: concepts for ten problem types

Written from the family design. Each stands on the foundations numbered there; each names them in one line and shows their picture. Two groups share one foundation and one picture, so the foundation is written once for each group and the types say what they add.

A note on the whole set first: the skill `similarity-theorems` is linked to HSG.SRT.B.4 ("Prove theorems about triangles"), but every type below *uses* a theorem, which is B.5 ("Use congruence and similarity criteria for triangles to solve problems and to prove relationships in geometric figures"). The concepts say B.5; the proof clauses of B.4 appear only where a lesson gives the theorem's "why" as the foundation, which every lesson here does.

---

## Dilation properties

### `geo-dilation-line-image` — The image of a line under a dilation from the origin

**Standard.** HSG.SRT.A.1a: "A dilation takes a line not passing through the center of the dilation to a parallel line, and leaves a line passing through the center unchanged." With 8.G.A.3, "the effect of dilations ... using coordinates." The "parallel" clause is practiced in every variant; the "unchanged" clause never is (no variant has b = 0), so the lesson gives it in one beat.

**Foundations first.** Foundation 5 in one line: a dilation from the origin sends every point k times as far along its ray, so multiply both coordinates by k. Then the new thing, built on the plane: the line y = 3x − 6 drawn to scale through (0, −6) and (2, 0), with a slope triangle L on it ("over 2, up 6"). Rays from the origin through both points. Dilate by ½: each point slides halfway in; the image line draws through (0, −3) and (1, 0). The L on the image is "over 1, up 3": every arm halved, the ratio untouched. Say it: a dilation stretches every L by k, so rise over run cannot change; lines go to parallel lines. The y-intercept sits on the y-axis, a line through the center, so its image stays on the y-axis at (0, kb). One beat: if the line passed through the origin, every ray from the origin through it would be the line itself, and it would not move.

**Read.** "Dilated by a scale factor of ½ centered at the origin": gold on the factor. What the answer must look like: the same slope, a different intercept, closer to the origin because ½ shrinks.

**The example.** y = 3x − 6, k = ½ (the shrinking case; a child who thinks ½ enlarges is caught here). (1) The line, its two intercepts labeled, the L. (2) Rays from the origin through (0, −6) and (2, 0). (3) Project: both points slide halfway to the origin; readouts (0, −3) and (1, 0). (4) The image line draws, parallel marks on both lines. (5) Board: slope stays 3; intercept −6 × ½ = −3; y = 3x − 3.

**Fast.** Keep m; multiply b by k. Always works from the origin.

**Sense.** ½ pulls toward the origin: −3 is nearer the origin than −6. A factor over one would push the intercept farther out.

**Check.** Dilate a second point of the original and see it on the image: (2, 0) → (1, 0); 3(1) − 3 = 0, true.

**Rule out.** y = 6x − 3: the slope changed, and dilations make parallel lines: gone. y = 3x − 6: the original; the line does not pass through the origin (0 ≠ −6), so it moved: gone. y = 3x − 8: farther from the origin under a shrinking factor: gone. All three dim in one beat; the survivor is proved by the intercept.

**Line.** "A dilation stretches every L by k, so the slope stays; only the intercept scales."

**Trap.** Multiplying the slope as well as the intercept ("dilate the whole equation"), or thinking ½ moves the line outward. The two parallel lines with their L's, one half the other, make the first impossible; the points sliding inward make the second.

**Kit.** `dilate` must act on a line (a `seg` with `extend`, or a `plot`), with `rays` through two of its points and parallel marks on both. Nothing else beyond the family's tools.

**Writer.** A capable cheaper model: one method, one action, the answer checkable against `facts.ts`.

---

### `geo-dilation-center` — Find the center and the scale factor from a figure and its image

**Standard.** 8.G.A.4, "given two similar two-dimensional figures, describe a sequence that exhibits the similarity between them": here the sequence is one dilation, and the task is to name it. 8.G.A.3 for the coordinates; HSG.SRT.A.1 is what makes the method valid.

**Badly conceived, in part.** The problem text has no coordinates; the figure must carry them and `facts.ts` must expose them to the writer. The two wordings are two cases: both unknown, or the center alone with k given. The concept below uses one consistent figure so the method can be checked: center (−2, −4), k = 2, A(0, −3), B(1, −2), C(−1, 0); A′(2, −2), B′(4, 0), C′(0, 4).

**Foundations first.** Foundation 5 run backward. Build it: rays from a center through each corner of a triangle, each image on its ray, k times as far. Then ask: if you were given only the two triangles, how would you find the center? Every corner and its image lie on a ray from the center, so the line through A and A′ passes through the center, and so does the line through B and B′. Where two such lines cross is the only point that can be the center. Define "scale factor" again in a few words: what every distance from the center is multiplied by.

**Read.** "Which choice gives the scale factor and the center." Gold on both. At a glance: the image is the bigger triangle, so k is more than one; a choice with ½ is gone before any line is drawn.

**The example.** The figure above. (1) Both triangles on the plane, teal and rust, labeled. (2) A dashed line is drawn through A and A′ and extended both ways. (3) A second through B and B′. They cross at one point; the dot lands and reads (−2, −4). (4) Confirm: the line through C and C′ also passes through it. (5) k: from the center, A is "over 2, up 1"; A′ is "over 4, up 2". Twice as far: k = 2. (6) Choice: scale factor 2, center (−2, −4).

Quick second case (k given, center asked, k = ½): A′ is halfway from the center to A, so the center is one more A-to-A′ step past A′. Draw the arrow from A to A′, copy it once more, the center lands. For k = 2 the step goes the other way: one more A′-to-A step past A. Say when it works: for 2 and ½ one step is enough; for any other k, draw the two lines.

**Fast.** Two lines through matching corners; their crossing is the center. Then k = one arm of the center-to-A′ L divided by the same arm of the center-to-A L.

**Sense.** The center sits on the side of the original away from the image (k > 1 pushes away); and every image corner is farther from the found center than its original.

**Check.** Dilate B from the found center by k and land on B′: from (−2, −4), B is over 3, up 2; doubled, over 6, up 4: (4, 0). It lands.

**Rule out.** k = ½: the image is bigger: gone. Center (0, 0): A is straight below the origin, so its image would be straight below too; A′ is not: gone. Center (0, −3) is A itself; a center never moves, but A moved: gone. Dim together; prove the survivor by the two lines.

**Line.** "The center is where the lines through matching corners cross."

**Trap.** Treating the center as the origin and computing k from A′ ÷ A coordinate by coordinate (here 2 ÷ 0). The two drawn lines, crossing nowhere near the origin, make the origin impossible before any arithmetic.

**Kit.** `meet` must accept two extended lines, not only circles and rays. `rays` drawn from image back through original to the center. `dilate` from a named center with `land`.

**Writer.** The strongest writer: reading rays backward and the planted origin decoy are the hard idea of the grade-8 half (family design, Part 5).

---

### `geo-dilation-line-center` — The image of a line under a dilation from a center not the origin

**Standard.** HSG.SRT.A.1a, both clauses: "takes a line not passing through the center of the dilation to a parallel line, and leaves a line passing through the center unchanged." Three of six variants practice each clause. This is the only type in the family that practices "unchanged".

**Foundations first.** Foundation 5 from any center: the L is drawn from the center, not from the origin, and stretched k times. Then the two clauses built as pictures on the same plane. Center on the line: rays from the center through points of the line are the line itself, so the points slide along the line and the line is where it was. Center off the line: every point slides along its own ray, the L's all scale by k, slopes survive, the image is a parallel line through the dilated points. The habit that decides between them: plug the center into the equation first.

**Read.** Gold on the center. First act, before anything: is the center on the line? Plug it in. What the answer must look like: if yes, the given equation itself; if no, the same slope, a new intercept.

**The example (center off the line).** y = 2x − 5, k = ½, center (0, −4). (1) Plug in: 2(0) − 5 = −5, not −4: the center is off the line. (2) The line and the center dot, drawn to scale; the intercept (0, −5) sits one unit below the center. (3) The L from the center to (0, −5): over 0, down 1. Halve it: down ½. The point slides up to (0, −4.5). (4) A second point for the picture: (2, −1); L from the center over 2, up 3; halved, over 1, up 1.5: (1, −2.5). (5) The image line draws through both, parallel marks; slope 2 kept. (6) Board: y = 2x − 9/2.

**Second example, fully worked because it is the other clause (center on the line).** y = x − 1, k = 4, center (4, 3). (1) Plug in: 4 − 1 = 3, true: the center is on the line. (2) Rays from the center through two points of the line run along the line; the points slide four times as far out along it. (3) The line has not moved: y = x − 1. Brief: three beats.

**Fast.** Plug the center in. True: same line, done. False: keep m; dilate one easy point from the center with the L; write the line of slope m through it. (The generator always puts off-line centers on the y-axis, so the intercept's L is a single vertical arm; the lesson uses the full L anyway, with one arm zero, so the method is general.)

**Sense.** ½ pulls toward the center: the image intercept −4.5 is between the center (−4) and the original (−5). A result on the far side of the center is wrong.

**Check.** Dilate a third point and see it land on the image line; or undo: double the new intercept's distance from the center and get −5 back.

**Rule out.** Any choice with a changed slope: gone (two choices in every variant). Then the plug-in: if the center is on the line, every choice but the original is gone; if not, the original is gone. One remains against the decoy that multiplied b by k (y = 2x − 5/2): it treats the center as the origin, and its intercept sits above the center, the wrong side under a shrinking factor.

**Line.** "Plug the center in first. On the line: nothing moves. Off the line: the L from the center, times k."

**Trap.** Multiplying the intercept by k with the center ignored (y = 2x − 5/2), the family's pitfall 3. The L drawn from the center dot, visibly not the origin, is the whole lesson.

**Kit.** `dilate` on a line from a named center; `ell` from a non-origin point; `rays`. Nothing new beyond the family.

**Writer.** The strongest writer for the first version: two clauses, a reading fork, and the off-origin L. Once `transformation-composition-image` and `geo-dilation-line-image` exist to point at, a capable cheaper model can hold it.

---

### `similar-solid-scale-chain` — Length, surface area and volume of similar prisms

**Standard.** None in Common Core; the k² and k³ relations are state-standard material. Misfiled under `dilation-properties` (HSG.SRT.A.1): it stands on this family's k (foundation 11), not on the properties of a dilation. Keep it, mark it state-standard, and design it to what it asks.

**Foundations first.** "Similar solids": one is the other with every length multiplied by the same k. Build why areas and volumes do not follow k, on the grid and the app's cubes: a unit square grown by 3 is a 3 by 3 of 9 cells; a unit cube grown by 3 is 3 layers of 3 by 3, 27 cubes, and its skin is 6 faces of 9 cells, 54 = 6 × 9. Lengths × k, areas × k², volumes × k³. Then the inverse, said plainly: from a ratio of surface areas, k is the square root; from a ratio of volumes, k is the cube root. Always write the ratio big over small and simplify it before rooting.

**Read.** Which two amounts are given (surface areas or volumes), which one is asked, and for which prism. Gold on "total" when it appears: both volumes added. What the answer must look like: a volume bigger than the smaller prism's (or smaller than the larger's), and the volume ratio larger than the area ratio.

**The example.** Surface areas 108 and 192; the smaller prism's volume is 27; the larger's volume? (1) The two prisms drawn with every edge in ratio 3 to 4 (the generator gives no edges; the picture keeps the lengths to that scale and labels one matching edge pair). (2) Ratio card: 192/108 = 16/9. (3) Surface area is area: 16/9 = k². The number that times itself gives 16/9 is 4/3: k = 4/3. (4) Volume follows k³ = 64/27. (5) 27 × 64/27 = 64.

Quick second case, the other entry: volumes 81 and 375, the larger's surface area 350, the smaller's? 375/81 = 125/27 = k³, so k = 5/3; k² = 25/9; going from larger to smaller, divide: 350 × 9/25 = 126. Four beats; a different root and the other direction.

**Fast.** Ratio, simplify, root it to k, re-raise k to the power the asked amount needs, multiply (larger) or divide (smaller). Add both if "total".

**Sense.** 64 is more than 27, and 64/27 ≈ 2.4 is more than the surface-area ratio 16/9 ≈ 1.8, as a cube beats a square when k > 1.

**Check.** 64/27 is (4/3)³ and 192/108 is (4/3)²: the same k from both.

**Line.** "Lengths times k, areas times k squared, volumes times k cubed."

**Trap.** Using the surface-area ratio as the volume ratio (27 × 16/9 = 48), or using k itself (27 × 4/3 = 36). The grown cube, 27 pieces from one, is the reason neither can be right. A second, real one: rooting 108 and 192 separately instead of the simplified ratio; the ratio card simplifies first, and the clean 16/9 shows why.

**Kit.** The `grow` motion on the app's cube solids through `scene`; two prisms drawn to a given edge ratio with one labeled pair; the ratio card. Nothing new beyond the family.

**Writer.** A capable cheaper model: one chain, checkable arithmetic.

---

## Similarity theorems

### The altitude foundation, shared by `rg-altitude-segment`, `similarity-theorem-length` and `geo-altitude-hypotenuse`

Foundation 10, built once in full in `geo-altitude-hypotenuse` and in a shorter form (about thirty seconds, the stand shown and the needed fact read) in the siblings; every lesson shows it, since a learner may meet any of the three first.

Define: the hypotenuse (the side across from the right angle); the altitude to it ("the perpendicular dropped from the right-angle corner onto the hypotenuse"); the two pieces it makes (AD touching A, DB touching B) and the whole AB. Draw right triangle ABC to scale with the given pieces, right angle boxed at C, and drop the altitude CD live. Then the motion that proves: the two small triangles are copied out and stood beside the big one the same way up: right angle in the bottom-left corner, the angle equal to A in the bottom-right. Triangle ACD shares angle A outright; triangle CBD's angle at C is 90° minus B, which is A. All three stand alike, so all three are similar; the lesson marks the equal angles with one arc.

Standing alike, matching sides sit in matching places, and the three facts read straight across:
- bottom over hypotenuse in the A-triangle and the big triangle: AD/AC = AC/AB, so **AC² = AD × AB**: a leg squared is the piece it touches times the whole hypotenuse;
- the same for the B-triangle: **BC² = DB × AB**;
- bottom over left side in the two small triangles: AD/CD = CD/DB, so **CD² = AD × DB**: the altitude squared is one piece times the other.
The ratio card writes each as "a number over x equals x over a number": x is the geometric mean, in the middle of both fractions. The sketch is the three triangles pulled apart and stood alike; a child who draws it never pairs a leg with the far piece.

### `geo-altitude-hypotenuse` — A leg or the altitude from the two pieces

**Standard.** HSG.SRT.B.5, "Use ... similarity criteria for triangles to solve problems." The coda gives B.4's "the Pythagorean Theorem proved using triangle similarity," which no type asks for.

**Foundations first.** The shared foundation in full, with the example's numbers.

**Read.** Which length is asked: AC, BC or CD; gold on it. At a glance the four lengths are ordered: the altitude is shorter than either leg (it is a leg of a smaller right triangle whose hypotenuse is that leg), the leg over the shorter piece is the shorter leg, and the hypotenuse is longest. The answer must sit where the asked length sits in that order.

**The example.** AD = 5, DB = 11, find AC. (1) The triangle to scale (AB = 16, CD ≈ 7.4), the altitude dropped, the pieces labeled. (2) Pull apart and stand; the three facts appear on the ratio card. (3) AC touches AD, so AC² = AD × AB = 5 × 16 = 80. (4) √80: the largest square factor is 16: 4√5. Choice: 4√5.

**Fast.** Add the pieces for the whole. Leg: the piece it touches times the whole, then root. Altitude: piece times piece, then root. Simplify the root by the largest square factor.

**Sense.** AC touches the shorter piece, so it is the shorter leg: between the altitude √55 ≈ 7.4 and the other leg √176 ≈ 13.3. 4√5 ≈ 8.9 fits.

**Check.** Pythagoras inside the small triangle: AD² + CD² = 25 + 55 = 80 = AC². Then the coda, once: AC² + BC² = 5 × 16 + 11 × 16 = 16 × 16 = AB²; the two leg facts added are the Pythagorean theorem, which is why it is true.

**Rule out.** 16 is the hypotenuse; a leg is shorter: gone. √55 is the altitude, shorter than any leg: gone. 4√11 is the other leg, over the longer piece: gone. The decoys are the figure's other three lengths; the ordering dims them together, then the fact proves the survivor.

**Line.** "A leg squared is the piece it touches times the whole hypotenuse. The altitude squared is piece times piece."

**Trap.** Pairing a leg with the far piece (AC² = 11 × 16), or using piece × piece for a leg. Standing the three triangles alike puts AC and AD in the same triangle, bottom and hypotenuse, so the far piece never comes near.

**Kit.** `stand` as copy, rotate, slide with a widened view; marks by count; the ratio card. Nothing new beyond the family.

**Writer.** The strongest writer: the stand is the derivation, and the coda is reasoning.

---

### `rg-altitude-segment` — A piece of the hypotenuse from a leg and the other piece

**Standard.** HSG.SRT.B.5, as above.

**Note.** Only one wording was produced; its answer, 7.8, is exact, so "to the nearest tenth" never bites here. If other seeds produce an unending decimal, the lesson's "round at the end" matters; if none do, the template should drop the phrase.

**Foundations first.** The shared foundation, short form: the altitude dropped, the three triangles stood alike, the leg fact read.

**Read.** Given a leg and the piece it touches; asked the other piece. Gold on DB. At a glance: the leg fact involves AD and AB, not DB, so the whole must be found first and DB is what is left. The answer must be less than the hypotenuse and, since AC = 8 is a leg, AB is more than 8, so DB is more than 3.

**The example.** AC = 8, AD = 5, find DB. (1) The triangle to scale (AB = 12.8, CD = √39 ≈ 6.2). (2) Stand; the fact for AC: AC² = AD × AB. (3) 64 = 5 × AB; AB = 12.8. (4) DB = AB − AD = 12.8 − 5 = 7.8. Round only if the division did not end.

**Fast.** Leg squared over the piece it touches gives the whole; subtract the known piece.

**Sense.** The longer leg stands over the longer piece. BC² = 7.8 × 12.8 ≈ 99.8, so BC ≈ 10, longer than AC = 8, and DB = 7.8 is longer than AD = 5: consistent.

**Check.** Two roads to the altitude agree: CD² = AC² − AD² = 64 − 25 = 39, and CD² = AD × DB = 5 × 7.8 = 39.

**Line.** "The leg fact uses the whole hypotenuse. Find the whole, then take the known piece away."

**Trap.** Writing AC² = AD × DB (the altitude's shape with a leg in it) and answering 12.8. The stand shows AC as the hypotenuse of the A-triangle against AB, the whole, never against the other piece.

**Kit.** Nothing beyond the family.

**Writer.** A capable cheaper model once `geo-altitude-hypotenuse` exists: one fact, one subtraction, exact check.

---

### `similarity-theorem-length` — Side-splitter or altitude: read which figure, then which fact

**Standard.** HSG.SRT.B.5. This is a mixed type: two figures (a right triangle with the altitude to its hypotenuse; a triangle cut by a parallel segment) and, within the first, the altitude fact and the leg fact in either direction. It is taught as reading, one example per kind.

**Foundations first.** Both pictures, each in a short form pointing at its concept lesson: the altitude stand (above) and the parallel cut as a dilation from the top corner (below). The one idea true for both: name the two similar triangles, stand them alike, and read matching sides.

**Read.** First words decide the picture: "right angle at C and CD is the altitude" or "DE is parallel to BC." Then which length is asked (gold). For the altitude figure: the asked length's place in the ordering (altitude shortest, hypotenuse longest). For the cut: the asked piece is on the side whose other piece is known.

**Example 1, the altitude kind.** AD = 9, DB = 4, find CD. (1) To scale: AB = 13, CD = 6. (2) Stand; CD² = AD × DB. (3) 9 × 4 = 36; CD = 6. Choice: 6.
Quick case, the leg fact solved for a piece: AC = 3, AB = 9, find AD. AC² = AD × AB: 9 = AD × 9: AD = 1. Four beats, its own screen, because the equation is solved the other way and the whole is given rather than built.

**Example 2, the parallel kind.** AD = 6, DB = 4, AE = 6, find EC. (1) To scale, the cut, rays from A. (2) Part over part on both sides: AD/DB = AE/EC: 6/4 = 6/EC. (3) EC = 4. Choice: 4. (At a glance here: AE equals AD, so the AC side is a copy of the AB side, and EC is DB.)

**Fast.** Altitude figure: the right fact from the stand, square or root. Cut: part/part = part/part, or part/whole = part/whole, never one of each.

**Sense.** The altitude is at most half the hypotenuse (6 < 6.5); a piece is less than the whole. In the cut, equal upper pieces mean equal lower pieces.

**Check.** Altitude: 9 × 4 = 36 = 6². Cut: cross-multiply, 6 × 4 = 4 × 6; or part/whole: 6/10 = 6/10.

**Rule out.** Altitude kind: 13 is the hypotenuse: gone; 36 is longer than the hypotenuse: gone; 13/2 is half the hypotenuse, which the altitude reaches only when the pieces are equal, and 9 ≠ 4: gone. Piece kind: 27 and √27 are longer than the hypotenuse 9: gone; 6 is... a candidate until the fact is applied. Cut kind: 10 is the whole AB; 9 pairs AD with EC the wrong way; dim them with "a piece is less than the whole; part over part on both sides."

**Line.** "Stand the two triangles alike, then read matching sides."

**Trap.** Averaging the two pieces for the altitude (13/2): the arithmetic mean, not the geometric mean. The stand gives AD/CD = CD/DB, a product, not a sum; and the lesson says once that the average is only right when the pieces are equal. Second, real: AC² = AC × AB → √27 for the piece case, from multiplying the two given numbers without reading which is squared. The ratio card puts the unknown where it belongs before any arithmetic.

**Kit.** Nothing beyond the family; three screens, one per kind.

**Writer.** The strongest writer for the first version (mixed, reading). After the two concept lessons exist, a capable cheaper model.

---

### The parallel-cut foundation, shared by `geo-parallel-segment-length`, `geo-parallel-perimeter`, `geo-parallel-statement` and the cut kind above

Foundation 9. Triangle ABC drawn to the given lengths; D on AB, E on AC; DE drawn parallel to BC with parallel marks. Rays from A through D and E pass through B and C: the big triangle is the small one dilated from A, and k is whole over part, AB/AD. So AB/AD = AC/AE = BC/DE: whole over part on every side. Because the same fraction of each side is above the cut, the same fraction is below it, so the pieces also match: AD/DB = AE/EC. The ratio card shows both, labeled "part over whole, both sides" and "part over part, both sides", and says the one thing that fails: one of each. DE over BC is part over whole, never part over part. The converse, said once where a type asks it: if the pieces match in ratio, the small triangle is a dilation of the big one from A, and a dilation takes BC to a parallel line, so DE must be parallel to BC. The sketch: part and whole written on each cut side.

### `geo-parallel-segment-length` — A piece or a whole side from the parallel cut

**Standard.** HSG.SRT.B.5; the theorem used is B.4's "a line parallel to one side of a triangle divides the other two proportionally, and conversely," and the second variant practices the converse ("what must EC be so that DE ∥ BC").

**Foundations first.** The shared foundation, with the converse stated because this type asks it.

**Read.** Two wordings. "DE ∥ BC. Find AC": the parallel is given; the whole side, not a piece, is asked (gold on AC). "What must EC be so that DE ∥ BC": nothing is parallel yet; the question asks what makes it so, and the same proportion answers it. At a glance: the ratio within a side, or the ratio across sides, whichever is a clean number.

**The example (the converse wording).** AD = 6, DB = 9, AE = 12, EC? (1) The triangle to scale, D and E placed, DE drawn as a dashed line not yet marked parallel. (2) AE is twice AD; for DE to be parallel, every piece on AC must be twice its match on AB. (3) Ratio card: AD/DB = AE/EC: 6/9 = 12/EC. (4) Cross-multiply: 6 × EC = 108; EC = 18. (5) The parallel marks appear; rays from A through D and E hit B and C.

Quick second case, the other wording with the whole asked: AD = 3, DB = 3, AE = 9, find AC. D is the midpoint of AB, so E is the midpoint of AC: EC = 9, and AC = 9 + 9 = 18. Four beats; the point of the case is the last one: the whole, not the piece.

**Fast.** Find the multiplier between the two sides (12 ÷ 6 = 2) and apply it to the known piece of the other side; or the ratio within a side (6 : 9) applied to the other. Add the pieces when the whole is asked.

**Sense.** AC is the longer side, so every piece of it is longer than its match: 18 > 9. In the quick case the answer must be twice AE.

**Check.** 6 × 18 = 108 = 9 × 12; or part over whole: 6/15 and 12/30 are both 2/5.

**Line.** "Part over part on both sides, or part over whole on both. Never one of each."

**Trap.** AD/AB = AE/EC (one of each), which gives 30, the whole AC, as a piece. The ratio card with both rows labeled makes the mixed row visibly absent. For the whole-asked wording: answering EC when AC was asked; gold on AC and the final addition written on the board.

**Kit.** Nothing beyond the family.

**Writer.** A capable cheaper model after `parallel-segment-steps` exists.

---

### `geo-parallel-perimeter` — The perimeter of the whole triangle from the cut

**Standard.** HSG.SRT.B.5.

**Foundations first.** The shared foundation, plus one line from foundation 11: perimeter is a length, so it scales by k.

**Read.** Four lengths given; two wordings for the cut side: the whole AB, or the piece DB (then AB is part plus rest). Gold on "perimeter of triangle ABC", the big one. What the answer must look like: more than the small triangle's perimeter, by the factor k.

**The example.** AD = 6, DB = 8, DE = 9, AE = 6. (1) To scale: AB = 14, AC = 14, BC = 21 (the big triangle is isosceles; the picture shows it). (2) The whole: AB = 6 + 8 = 14. (3) Ratio card, big over small: k = AB/AD = 14/6 = 7/3. (4) The small triangle's perimeter: 6 + 6 + 9 = 21. (5) Perimeter scales by k: 21 × 7/3 = 49.

**Fast.** k = whole over part on the cut side; add the small triangle's three sides; multiply by k. Always works, and skips two sides.

**Sense.** The big perimeter is bigger, and about 2⅓ times the small one.

**Check.** The long way agrees: BC = 9 × 7/3 = 21, AC = 6 × 7/3 = 14, AB = 14; 14 + 21 + 14 = 49. The lesson shows this as the check so the learner sees both roads.

**Line.** "Perimeter is a length. It scales by k too."

**Trap.** k as part over part (8/6) instead of whole over part (14/6), family pitfall 8, giving BC = 12. The rays from A show the big triangle is the small one stretched from the top corner to the *whole* side. Second, real: adding the four given numbers, or mixing a small side into the big perimeter; the walk round the big triangle's three sides, each lit as it is added, makes it impossible.

**Kit.** Nothing beyond the family.

**Writer.** A capable cheaper model.

---

### `geo-parallel-statement` — Which statement is not always true

**Standard.** HSG.SRT.B.5, "to prove relationships in geometric figures." Judging a statement for every case. Mixed in its figure: a cut inside a triangle, or two segments crossing with a parallel pair (the bow tie); one example of each.

**Foundations first.** Define "not always true": a statement that can fail in some figure that fits the givens, even if it happens to hold in this picture. Build both figures and mark what the givens force. The cut: the angle at the top corner is shared, and the parallel makes the angle at D equal to the angle at B (corresponding angles, from family 23); two angles match, so the triangles are similar (AA). The bow tie: the angles at the crossing are vertical angles, equal; the parallel pair makes the angles at E and C equal (alternate interior angles); similar again. Then the motion that proves what is *not* forced: slide the parallel segment along the sides (or move CZ farther from V); the marks stay, the similarity stays, and the sizes change. Equal sides, congruence, equal area would need k = 1, and nothing in the givens pins k.

**Read.** Gold on "not always true." Then sort the four statements: angle claims, similarity, proportion, and claims about size (a ≅ between triangles, an = between segments). At a glance the size claim is the suspect; but each statement is checked against the marked figure, since a proportion is true only if both sides are part over whole or both part over part.

**Example 1, the bow tie.** EC and SZ meet at V, ES ∥ CZ. (1) The figure, CZ drawn twice as far from V as ES so the triangles are visibly different sizes. (2) Mark: ∠EVS and ∠CVZ vertical, one arc each; ∠SEV and ∠ZCV alternate interior, two arcs. (3) Names card, △EVS and △CVZ stacked by those angles: similar. (4) Each statement: ∠EVS ≅ ∠CVZ, forced; ∠SEV ≅ ∠ZCV, forced; △EVS ~ △CVZ, forced. (5) △EVS ≅ △CVZ: slide CZ farther away, still parallel, still similar, not the same size. Not always true.

**Example 2, the cut.** Triangle KLE, VG ∥ LE. Mark the shared angle K and the corresponding angles at V and L; similar; KV/KL = KG/KE is part over whole on both sides, forced. VG = LE would need V to sit at L; slide the cut up and VG shrinks. Not always true. Briefer: the method is the same, the reasons differ.

**Fast.** Mark the forced angles; two angles mean similar; everything that follows from similarity (angles, the similarity itself, part-over-whole proportions) is always true; anything that fixes size is not forced.

**Sense.** Slide the parallel: whatever survives the slide is always true.

**Check.** Read the chosen statement aloud and name the figure in which it fails (the slid one on screen).

**Rule out.** The three statements that are angle facts from the parallels and the crossing, or the similarity they give, dim together with "parallel lines force angles, and angles force similarity"; the survivor is tested by the slide.

**Line.** "Parallels fix the angles; angles fix the shape; nothing here fixes the size."

**Trap.** Choosing the alternate-interior-angle statement because that pair looks unfamiliar, or trusting the picture ("they look the same size") and passing over the congruence. Marking the figure before reading the choices answers the first; the slide answers the second.

**Kit.** A segment defined as "through D parallel to BC" with its far end as a `meet` on the other side, so the cut can slide while staying parallel; marks by count; the `names` card; sentence choices with `dim`. Nothing else beyond the family.

**Writer.** The strongest writer: every statement is judged by reasoning for every case, and the review must be too.
