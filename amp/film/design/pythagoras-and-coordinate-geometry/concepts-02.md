# Pythagoras and coordinate geometry: per-type concepts, part 2

Ten types across `segment-division`, `coordinate-proofs`, `circle-equations`, `parabola-locus` and `conic-sections`. Every one stands on the L (run blue, rise rust, slant teal) and names the family lesson it borrows in one line. Colors, labels and scale as in the family design; nothing below repeats that.

---

### Geometry: segment-division (HSG.GPE.B.6)

**`geo-segment-partition-point` — The point that splits a segment in a ratio.** Foundations 8 and 9. One concept with `segment-partition`; the skill description's "or external" must go (no variant divides externally; the standard says "between").

Standard: HSG.GPE.B.6, "Find the point on a directed line segment between two given points that partitions the segment in a given ratio." *Directed* is the whole reading: the ratio is counted from the point it names first.

Foundations first: AP : PB = 1 : 3 cuts AB into 1 + 3 = 4 equal pieces; P sits at the end of the first piece counted from A (family 10: the parts total). Draw the L from A to B (coordinate-distance, one line). Tick the run into four and the rise into four. The point one tick along the run and one tick along the rise lands on the slant: the small L from A to P is the big L shrunk to a quarter, the same shape, so a quarter of the way along the slant is a quarter of the way along each leg. That is the whole method.

Read: "AP : PB = 1 : 3" gold on the first letter and the first number: count from A, one of four parts. The answer is between A and B in both coordinates and nearer A.

Example: A(−3, 2), B(1, −10), AP : PB = 1 : 3; choices (−2, −1) | (−1, −2) | (−1, −4) | (0, −7). (1) Plot A and B; the L: run 1 − (−3) = 4, blue bracket; rise −10 − 2 = −12, rust bracket; hollow corner at (1, 2). (2) Parts: 4. Each leg ticked into four: run pieces of 1, rise pieces of 3. (3) From A, one tick right: x = −3 + 1 = −2; one tick down: y = 2 − 3 = −1. P drops onto the slant at (−2, −1). (4) Board: ¼ of 4 is 1, ¼ of −12 is −3; P = (−3 + 1, 2 − 3) = (−2, −1).

Quick second case (a different reading): A(0, −6), B(−4, 2), BP : PA = 3 : 1. The ratio starts at B: three parts from B, so one part from A; count one of four from A: run −4, rise 8; quarter: −1 and 2; P = (−1, −4). The same L already drawn; the only new thing is where to start.

Fast: parts total; the named start's parts over the total; add that fraction of the run and of the rise to the start.

Sense: P is nearer the end with fewer parts, and between A and B both ways.

Check: slope A to P is −3/1 = −3, slope A to B is −12/4 = −3: P is on the line; and the rest of the walk, run 3 and rise −9, is three times the first step: 1 : 3.

Rule out: P is one part from A and three from B, so it is nearer A. (−1, −4) is the midpoint and (0, −7) is nearer B; (−1, −2) is the midpoint's x with the coordinates swapped: not nearer A either. All three dim in one beat; then (−2, −1) is proved.

Line: "One to three is one part out of four. Start at the point the ratio names first."

Trap: taking 1 : 3 as one third; walking from the wrong end (the three-quarter point is a decoy in every variant); the midpoint reflex. The ticked legs show the quarter; gold on the first letter sets the start.

Kit: `legs` with `cuts`, the `along` point, `dim`. Writer: a capable cheaper model; one method, one picture, every number checkable.

---

### Geometry: coordinate-proofs (HSG.GPE.B.4)

**`coordinate-quadrilateral-claims` — The most specific name the coordinates prove.** Foundations 8 and 10. The type truly serves HSG.GPE.B.4 and B.5; 8.G.B.8 is only the leg counting. One variant observed; the writer runs `facts.ts` to see which of the four outcomes the generator reaches, and the lesson's method must reach all four.

Standard: HSG.GPE.B.4, "prove or disprove that a figure defined by four given points in the coordinate plane is a rectangle"; B.5, use the slope criteria "to solve geometric problems."

Foundations first: four names drawn as four shapes and how they nest: parallelogram (opposite sides parallel), rectangle (a parallelogram with a square corner), rhombus (a parallelogram with all sides equal), square (both). "Most specific" is the lowest name every fact allows. Each name is tested by one fact read off a side's L: parallel sides have the same slope (the same run-and-rise shape); a square corner is two slopes that multiply to −1, or one flat side meeting one upright side; equal sides have equal run² + rise² (compare the squares; no roots ever). The side's L is its slope triangle and its distance triangle at once (coordinate-distance, one line).

Read: "most specific" gold; the vertices are in order, so the sides are AB, BC, CD, DA. At a glance from the sketch: two sides with the same y are flat and parallel, and their lengths are plain subtractions; a flat side meeting a slanted side that is not upright is not a square corner, so rectangle and square are already gone.

Example: A(−4, 0), B(1, 0), C(4, 4), D(−1, 4). (1) Plot and join, to scale. (2) A table, side | run | rise | slope | length², filled one row at a time with the L drawn on each side: AB 5, 0, 0, 25; BC 3, 4, 4/3, 25; CD −5, 0, 0, 25; DA −3, −4, 4/3, 25. (3) Slopes agree in opposite pairs: a parallelogram. (4) Corner at B: slopes 0 and 4/3, product 0, not −1; BC leans: no square corner. Not a rectangle, not a square. (5) All four length² are 25: all sides 5. A rhombus. (6) A rhombus that is not a square.

Quick second case only if the generator produces it: a rectangle that is not a square (slopes multiply to −1, two length² differ). Same table, three lines.

Fast: the table for four sides, then three questions in order: parallel in pairs? square corner? all sides equal?

Sense: the figure is to scale: the corner at B visibly leans.

Check: the diagonals: AC has slope 4/8 = 1/2 and length² 80; BD has slope 4/(−2) = −2 and length² 20. Slopes multiply to −1 (a rhombus has perpendicular diagonals); lengths differ (a rectangle's would match). Same verdict by another road.

Rule out: one fact kills a name. AB flat and BC slanted: "rectangle" and "square" dim together.

Line: "Same slope: parallel. Slopes multiply to minus one: a square corner. Same length squared: same length. The most specific name is the one every fact allows."

Trap: "all four sides equal, so a square" without the corner check; judging the corner by eye; rounding square roots (never needed). The table keeps squares exact and asks the corner question every time.

Kit: `legs`, `table`; nothing new. Writer: strongest; the lesson is an argument and the decoys are names a fact denies.

---

### Geometry: circle-equations (HSG.GPE.A.1)

**`circle-equation` — r², the center, from a point, a graph or an equation.** Foundations 8 and 11. Holds the complete-the-square ask that `geo-circle-general-form` owns; acceptable as a quick case here.

Standard: HSG.GPE.A.1, "Derive the equation of a circle of given center and radius using the Pythagorean Theorem; complete the square to find the center and radius of a circle given by an equation." 8.G.B.8 for the legs.

Foundations first: a circle is every point one distance r from the center. Build on center C(3, 1) and a point P(7, 4) on it: the L, run 7 − 3 = 4, rise 4 − 1 = 3, slant 5; 16 + 9 = 25. Glide P around: at (8, 1) the legs are 5 and 0; at (0, 5) they are −3 and 4, 9 + 16 = 25; the legs change, the slant reads 5 the whole way. For a point (x, y) not yet chosen the legs are x − 3 and y − 1, so (x − 3)² + (y − 1)² = 25: the theorem written for every point at once, and the right side is r², not r. Signs: the run from 3 to x is x − 3; from −4 to x it is x − (−4) = x + 4, so the bracket shows the opposite of the center's coordinate. That is the derivation the standard asks for.

Read: three asks, each gold: "What is r²" (the area, not the side); "the y-coordinate of its center" (the number that makes the y-bracket zero); an expanded equation (complete the square). At a glance: r² is a sum of two squares; the center is read with flipped signs.

Example (case A, the derivation's own circle): center (3, 1) passes through (7, 4): run 4, rise 3; r² = 16 + 9 = 25. The question asks r², so the answer is 25, the area, not 5.

Quick B (from the graph, the app's real figure): count the legs on the grid from C to P (5 and 12): c = 169. Same L, read from the picture.

Quick C: (x + 4)² + (y + 6)² = 25: y + 6 is y − (−6): the center's y is −6; the center is drawn.

Quick D: x² + y² − 12x + 6y + 44 = 0: half of −12 is −6, squared 36; half of 6 is 3, squared 9; both added to both sides: (x − 6)² + (y + 3)² = −44 + 36 + 9 = 1; x of the center is 6. One line names the move ("half the middle, squared, both sides"); the full lesson is `geo-circle-general-form`.

Fast: r² = run² + rise² from center to point; center = the numbers that make the brackets zero.

Sense: r² is bigger than r (25 against 5); the point is one radius from the center on the drawing.

Check: put (7, 4) into the equation: 16 + 9 = 25. For D, expand back to the given equation.

Line: "A circle is the theorem for every point at once. Opposite signs in the brackets; r squared on the right."

Trap: answering 5 when r² was asked; reading (x + 4) as 4; adding the legs, 4 + 3 = 7. Gold on "r²", the squares on the legs, and the glide.

Kit: `glide` with `@len` on a circle, `legs` with difference labels, `scene`. Writer: a cheaper model from this concept once the glide is in the kit; as pilot 4 the first version goes to the strongest writer so it becomes the reference the other circle lessons point back to.

**`mcas-circle-equation-select` — True statements about a circle from its equation.** Foundations 8 and 11. Add HSG.GPE.A.1 to its links (center and radius).

Standard: HSG.GPE.A.1 (center and radius read from the equation); HSG.GPE.B.4, "prove or disprove that the point ... lies on the circle."

Foundations first: the picture from `circle-equation`, named in one line, then built on this circle: center (−4, 8), radius 6, drawn to scale with one point and its L. Three readings on the picture: the brackets name the center with signs flipped (x + 4 is x − (−4)); the right side is r², so r is its root; the diameter is two radii, drawn across. Then the test for any point: draw its L to the center; legs squared add to r², it is on the circle; less, inside; more, outside.

Read: "Choose the 2 true" gold: every statement is judged on its own, then exactly two are picked. At a glance from the equation: center (−4, 8), r = 6, diameter 12.

Example: (x + 4)² + (y − 8)² = 36. (1) "The radius is 6": 36 is r², root 6. True. (2) "The center is (8, −4)": swapped, and the signs read as written; the center is (−4, 8), drawn. False. (3) "The diameter is 6": that is the radius; the diameter is 12. False. (4) "(32, 8) is on the circle": run 32 − (−4) = 36, rise 0; 36² = 1,296, not 36 (the decoy used r² as a distance); the point is far off the card. False. The point straight across that *is* on the circle is (2, 8): run 6, 36 + 0 = 36; a dot lands there. (5) "The origin is outside": L from (−4, 8) to (0, 0), legs 4 and 8; 16 + 64 = 80 > 36: outside. True. Statements 1 and 5.

Quick second case: (x − 4)² + (y − 1)² = 36 and "the origin is outside": legs 4 and 1, 17 < 36: inside, so the statement is false. The origin is not always outside; the test is always run.

Fast: read h, k and r first; every statement is a comparison with one of those, except a point statement, which is one L.

Sense: on the drawn circle the origin is visibly outside or inside; the test confirms what the eye says.

Check: the two chosen re-read aloud as true; exactly two chosen.

Rule out: diameter equal to r; radius equal to r²; center with the brackets' own signs or swapped; a point whose leg is r². Dim together, one reason each; then compute what is left.

Line: "Opposite signs in the brackets; r squared on the right. On the circle when the legs squared add to r squared."

Trap: r² taken as r; (x + 4) as 4; the origin assumed outside because it usually is; a point judged by looks. The drawn circle and the legs test.

Kit: `legs`, `dim`. Writer: a capable cheaper model.

**`geo-circle-general-form` — Complete the square to find the center and radius.** Foundations 11 (with family 15 named).

Standard: HSG.GPE.A.1, "complete the square to find the center and radius of a circle given by an equation."

Foundations first: the shape we are heading for, from `circle-equation`: (x − h)² + (y − k)² = r². Then what completing the square is, drawn: (x − 2)² is a square of side x − 2. Start from the x-by-x square; take a strip of width 2 off two sides: that removes 4x, but the 2-by-2 corner was taken twice, so the corner, 4, goes back: x² − 4x + 4 = (x − 2)². The corner is half the middle, squared. Whatever is added on the left is added on the right (the balance, family 11, one line). And before any of it: if x² and y² carry a coefficient, every term is divided by it, because the shape has x² and y² bare.

Read: "center and radius" gold. At a glance: the coefficient 4 must go first; the center's x is half of −16/4 = −4, sign flipped, so 2; the radius is a root of the right side.

Example: 4x² + 4y² − 16x + 8y + 4 = 0. (1) Divide every term by 4: x² + y² − 4x + 2y + 1 = 0. (2) Move the lone number and group: (x² − 4x) + (y² + 2y) = −1. (3) x: half of −4 is −2, squared 4: + 4 both sides, in the margin. y: half of 2 is 1, squared 1: + 1 both sides. (4) (x − 2)² + (y + 1)² = −1 + 4 + 1 = 4. (5) Center (2, −1), radius √4 = 2. The circle is drawn to scale beside the board.

Quick second case: 2x² + 2y² − 20y − 78 = 0, no x term. Divide by 2: x² + y² − 10y − 39 = 0; x² is already (x − 0)², so the center's x is 0; y: half of −10 is −5, 25 both sides: x² + (y − 5)² = 64; center (0, 5), radius 8. Half the variants have a missing term, and the 0 coordinate is a look worth one screen.

Fast: divide out the coefficient; half each middle number, squared, added to both sides; the bracket carries the half with its sign; the root of the right side.

Sense: the right side comes out positive (it is r²), and the radius is smaller than it.

Check: a point one radius right of the center, (4, −1), in the original: 64 + 4 − 64 − 8 + 4 = 0. Or expand back.

Rule out: a center taken from the undivided coefficients ((8, −4), (−12, 0)); the brackets' own signs ((−2, 1)); a radius that is really r² (radius 64, 81, 16). Dim together.

Line: "Divide out the coefficient. Half the middle, squared, both sides. Opposite signs in the brackets; the root of the right."

Trap: not dividing first (two decoys in every variant show the symptom); adding to one side only; r = r². The margin note "+ 4 both sides" and the drawn circle whose radius plainly is not 4.

Kit: the square with the missing corner as a `poly` with two labels until family 15's tiles land. Writer: a capable cheaper model.

---

### Geometry: parabola-locus (HSG.GPE.A.2)

**`parabola-focus-directrix` — Equation, vertex, focus or directrix.** Foundation 12.

Standard: HSG.GPE.A.2, "Derive the equation of a parabola given a focus and directrix." The app asks the reading asks (vertex, focus, directrix from an equation) as well; the lesson derives once and reads twice.

Foundations first: define focus (a point), directrix (a line), and the parabola: every point as far from the focus as from the directrix. Build on the example's own focus F(−4, 0) and directrix y = 4: a point glides along the curve with its slant to F (teal) and its straight drop to the line (rust), both readouts equal the whole way. The axis is the line through F perpendicular to the directrix; the vertex is the curve's point on it, halfway: (−4, 2), with two brackets of 2 drawn from it. The vertex-to-focus distance is p, signed: negative here because the focus is below the vertex. The curve opens toward the focus and away from the directrix.

Read: four asks, each gold: "equation", "directrix", "focus", "vertex". At a glance: which way it opens (toward the focus; from an equation, the sign of 4p and which letter is squared); the vertex strictly between.

Example (the derivation): focus (−4, 0), directrix y = 4; choices (x + 4)² = −8y | (x + 4)² = −16(y − 2) | (x + 4)² = 8(y − 2) | (x + 4)² = −8(y − 2). (1) Vertex (−4, 2); p = −2. (2) Any point (x, y) on the curve: to F, √((x + 4)² + y²); to the line, 4 − y (the curve is below it). (3) Equal, so their squares are equal: (x + 4)² + y² = (4 − y)² = 16 − 8y + y². (4) The y² cancels: (x + 4)² = 16 − 8y = −8(y − 2). (5) Match (x − h)² = 4p(y − k): h = −4, k = 2, 4p = −8, p = −2: the picture's p. Answer: (x + 4)² = −8(y − 2).

Quick 2 (reading, vertical): (x − 1)² = −16(y + 3): vertex (1, −3); 4p = −16, p = −4, opens down; focus 4 below, (1, −7); directrix 4 above, y = 1.

Quick 3 (reading, sideways): (y − 5)² = 4(x + 4): y is squared, so the axis is horizontal; vertex (−4, 5); 4p = 4, p = 1, opens right; focus (−3, 5); directrix x = −5. Its own screen because the letter that moves changes.

Fast: vertex halfway; p from vertex to focus with its sign; 4p in front; the squared letter is the one the directrix is parallel to. Reading: vertex from the brackets, p from the coefficient divided by four, focus p from the vertex toward the open side, directrix p the other way.

Sense: the focus is inside the bowl, the directrix outside, the vertex between.

Check: vertex 2 from the focus and 2 from the directrix; one point: (0, 0) satisfies (0 + 4)² = −8(0 − 2), and it is 4 from F and 4 from y = 4.

Rule out: the curve opens down, so the right side must be negative: 8(y − 2) gone. The vertex is (−4, 2), not the origin: −8y gone. p is the vertex-to-focus distance 2, not the focus-to-directrix gap 4: −16 gone.

Line: "The vertex sits halfway. p is vertex to focus, with its sign. Four p in front."

Trap: p taken as the whole focus-to-directrix gap (4p doubled); the vertex put at the focus; the direction flipped; in the sideways case, moving the focus in y. The two equal brackets labeled p and the glide with equal readouts.

Kit: `parabola` part, `foot` on a line, `@len`, `dim`. Writer: strongest; the derivation is the lesson.

**`parabola-vertex-distance` — Place the vertex halfway.** Foundation 12, first step only. One step of the type above; keep it short (about two minutes).

Standard: HSG.GPE.A.2, the locating step of the derivation.

Foundations first: focus and directrix in one line each; the axis is the line through the focus perpendicular to the directrix (the problem names it, "on the line x = −6"); the vertex is the curve's point on the axis, as far from the focus as from the directrix, so exactly halfway. Draw the directrix dashed, the axis, the focus, the gap as a bracket, the vertex at its middle.

Read: three facts: the directrix, the gap and its side ("above it", "to the right of it"), the axis. At a glance: the vertex keeps the axis's coordinate (x = −6); only the other coordinate moves, half the gap, from the directrix toward the focus.

Example: directrix y = −2; the focus 5 units above it on x = −6; choices (−6, −4.5) | (−6, 3) | (−6, 0.5) | (0.5, −6). (1) Draw y = −2, the axis x = −6, and the focus 5 up: (−6, 3). (2) Half of 5 is 2.5. (3) From the directrix toward the focus: −2 + 2.5 = 0.5. Vertex (−6, 0.5), the two brackets 2.5 and 2.5.

Quick second case (sideways): directrix x = 5; focus 8 to the right on y = −4: focus (13, −4); vertex (9, −4). The y stays, the x moves 4.

Fast: copy the axis coordinate; directrix value plus or minus half the gap, toward the focus.

Sense: on the axis line, between the focus and the directrix.

Check: vertex to focus 2.5, vertex to directrix 2.5.

Rule out: swapped coordinates are not on the axis line; the focus itself; the point on the far side of the directrix. Dim together.

Line: "The vertex sits halfway, on the axis."

Trap: moving away from the focus (−2 − 2.5 = −4.5); halving the directrix's own number; moving the wrong coordinate. The drawn axis and bracket.

Kit: none beyond `dim`. Writer: a capable cheaper model.

---

### Precalculus: conic-sections (HSG.GPE.A.3, with GMD.B.4 and GPE.A.1)

**`cone-section-name` — Name the cut by its angle.** Foundation 14. Carries family 25's HSG.GMD.B.4; it stays here because the point is naming conics, and the alignment list should show the share. Two wordings under one name, angles given and words given ("parallel to a side", "parallel to the axis", "perpendicular"); the lesson teaches the translation.

Standard: HSG.GMD.B.4, "Identify the shapes of two-dimensional cross-sections of three-dimensional objects."

Foundations first: the double cone: two nappes tip to tip at the vertex, the axis through both, one side line. The side angle α is between a side line and the axis (gold label). A plane's angle β with the axis: 90° is straight across, 0° is parallel to the axis. Then tilt the plane and name as it goes: at 90° the cut is a circle; tilt a little and it stretches but still closes all the way round one nappe: an ellipse; tilt until β = α and the plane runs parallel to one side line, never catching it: the curve never closes: a parabola; tilt steeper than the side and the plane meets the other nappe too: two branches: a hyperbola. Slide the plane through the vertex and the same three ranges collapse: a point (β > α), one line (β = α, the plane resting along a side), two crossing lines (β < α). The translation: "perpendicular to the axis" is 90°; "parallel to a side" is β = α; "parallel to the axis" is 0°, less than any side angle.

Read: two facts, both gold: through the vertex or not (curve against collapsed), and β against α.

Example: the sides make 36° with the axis; a plane not through the vertex cuts at 36°. (1) Mark α = 36 on a side. (2) Start the plane at 90°: circle. Tilt to 60°: it still closes: ellipse. Tilt to 36°: parallel to the side; the curve opens and never closes. (3) Equal angles: a parabola.

Quick 2: sides 33°, plane at 10° through the vertex: 10 is less than 33, steeper than the side, the plane meets both nappes; through the vertex the two branches collapse to two crossing lines.

Quick 3 (words): "parallel to the axis, not through the vertex" is 0°, less than any α: a hyperbola, and the picture shows both nappes cut. The 53° variant asks the same fact backwards: a parabola needs β = α = 53°. One beat each on the cone.

Fast: vertex or not; then β against α: more, equal, less gives ellipse (circle at 90), parabola, hyperbola; or point, line, two lines.

Sense: the flatter the plane, the rounder and more closed the cut; the more upright, the more it opens.

Check: a parabola needs β exactly α; a hyperbola's plane, extended, hits the other nappe.

Rule out: through the vertex, the curve names dim together; not through, the point and line names dim. "Parallel to a side" cannot close: circle and ellipse gone.

Line: "Compare the plane's angle to the side's. Flatter: it closes. Same: parabola. Steeper: it hits both cones."

Trap: "parallel to the axis gives a parabola" (the word confusion is real): the tilt shows the axis-parallel plane cutting both nappes. Comparing β to 45° or to 90° − α instead of α: the marked α is the only reference on screen.

Kit: `cone` with `tilt` and a slide through the vertex (4.8). Writer: strongest; three-dimensional reasoning with no arithmetic to lean on.

**`conic-standard-form` — Read a center; complete the square with a coefficient.** Foundations 11 and 13. The goal names "name the curve" and "axis ends" asks that none of the shown variants pose; the writer runs `facts.ts` and works any that appear as quick cases, or reports that the goal overstates the type. The circle variants are HSG.GPE.A.1; the ellipse variants (center from standard form; completing the square with a 9 on y²) have no exact clause and sit under the (+) spirit of A.3; the alignment list should say so.

Standard: HSG.GPE.A.1, "complete the square to find the center and radius of a circle given by an equation"; the ellipse asks extend the same move.

Foundations first: the two shapes side by side: circle (x − h)² + (y − k)² = r², ellipse (x − h)²/a² + (y − k)²/b² = 1. In both, the brackets name the center with opposite signs; the ellipse's denominators are the squares of its half-widths, so the root of each denominator, each way from the center, gives the axis ends. Completing the square from `geo-circle-general-form`, one line (half the middle, squared, both sides), then the new wrinkle: 9y² + 90y is 9(y² + 10y), nine copies of the square missing its corner; each needs 25, so 9 × 25 = 225 is what the right side gets. The picture: nine small squares, each with the same missing corner.

Read: "center" gold; "ellipse" or "circle". At a glance: the center's x is half the x-coefficient with the sign flipped: −6x gives 3; the y needs the 9 factored out before halving.

Example: x² + 9y² − 6x + 90y + 230 = 0; choices (6, −10) | (−3, 5) | (3, −5) | (3, −45). (1) Group, factoring the 9: (x² − 6x) + 9(y² + 10y) = −230. (2) x: half of −6 is −3, squared 9: + 9 both sides. (3) y: half of 10 is 5, squared 25 inside the bracket; nine brackets, so + 225 on the right. (4) (x − 3)² + 9(y + 5)² = −230 + 9 + 225 = 4. (5) Center (3, −5). Divide by 4 to see the ellipse: (x − 3)²/4 + (y + 5)²/(4/9) = 1, half-widths 2 and 2/3, drawn to scale around (3, −5).

Quick 2: read (x − 4)²/9 + (y + 2)²/4 = 1: center (4, −2); ends 3 left and right, 2 up and down.

Quick 3: circle x² + y² + 2x − 6y + 1 = 0: (x + 1)² + (y − 3)² = −1 + 1 + 9 = 9; center (−1, 3), radius 3.

Fast: factor the coefficient out of its group; half the middle, squared; what you add inside, times the factor, goes on the right.

Sense: the drawn ellipse sits where the center says; the right side comes out positive.

Check: a point 2 right of the center, (5, −5), in the original: 25 + 225 − 30 − 450 + 230 = 0. Or expand back.

Rule out: the brackets' own signs (−3, 5); unhalved (6, −10); half of 90 as if the 9 were not there (3, −45): dim together.

Line: "Factor the coefficient out of its group. What you add inside, times the factor, goes on the right."

Trap: halving 90 without factoring the 9 (the −45 decoy); adding 25 to the right instead of 225; r² read as r on the circle variants. The nine copies.

Kit: `ellipse` part (4.6); family 15's tiles when they land. Writer: a capable cheaper model.

**`conic-foci` — Foci from an equation; an equation from the foci and the constant.** Foundation 13.

Standard: HSG.GPE.A.3 (+), "Derive the equations of ellipses and hyperbolas given the foci, using the fact that the sum or difference of distances from the foci is constant."

Foundations first: an ellipse has two foci, and every point's two focus distances add to the same number. Build on the example: foci (0, ±5), sum 18. A point glides; the two slants (teal, violet) change, their sum reads 18 all the way. At the top vertex the distances are a − c and a + c, so the sum is 2a: a = 9, and the vertex is 9 from the center. At a co-vertex, on the x-axis, the two distances are equal, each 9, so the triangle center–focus–co-vertex has legs c = 5 and b, hypotenuse a = 9 (the focus is inside, so c is a leg): b² = 81 − 25 = 56. A hyperbola fixes the difference; at a vertex it is (c + a) − (c − a) = 2a; its triangle is center–vertex–box corner, legs a and b, and c is the hypotenuse because the focus is outside the vertex: c² = a² + b². Which letter: a² goes under the variable of the axis the foci sit on; for a hyperbola that is the positive term.

Read: gold on "sum" or "difference" (ellipse or hyperbola), on the foci's axis, and on the direction of the ask. At a glance: half the constant is a; the foci's axis fixes which variable comes first.

Example 1 (ellipse, foci to equation): foci (0, ±5), sum 18; choices y²/81 + x²/56 | y²/56 + x²/81 | y²/81 + x²/106 | y²/81 + x²/25. a = 9, a² = 81; c = 5; the triangle: b² = 81 − 25 = 56; foci on y, so y first: y²/81 + x²/56 = 1.

Example 2 (hyperbola, foci to equation): foci (0, ±7), difference 8; choices y²/16 + x²/33 | y²/33 − x²/16 | y²/16 − x²/65 | y²/16 − x²/33. a = 4, a² = 16; c = 7, the hypotenuse this time: b² = 49 − 16 = 33; y positive and first: y²/16 − x²/33 = 1. A second full example because c changes sides of the triangle, and the standard names both derivations.

Quick (equation to foci): y²/169 + x²/25 = 1: the larger denominator is a², under y; c² = 169 − 25 = 144; foci (0, ±12). x²/36 − y²/64 = 1: the positive term is x; c² = 36 + 64 = 100; foci (±10, 0). Quick (the constant from foci and a point): foci (±3, 0), through (0, 4): the sum is the same at every point, so take it at the given one: two slants of √(9 + 16) = 5: sum 10.

Fast: half the constant is a; the triangle gives the third square (subtract for an ellipse, add for a hyperbola); a² under the foci's variable.

Sense: ellipse, c less than a (foci inside, b² positive); hyperbola, c more than a. Foci on the stated axis.

Check: a², b², c² satisfy the triangle; the foci's variable is first, or positive.

Rule out: a first term whose variable is not the foci's axis: gone before any arithmetic. An ellipse with b² bigger than a² (106): gone, the focus is inside. A hyperbola whose a² is not (half the difference)²: gone. From an equation: c = a + b (14), c = a (6), or the wrong axis: gone.

Line: "Half the constant is a. Focus inside: c is a leg. Focus outside: c is the hypotenuse."

Trap: c² = a² + b² used for the ellipse; the larger denominator taken as a² in a hyperbola; a + b for c; the wrong axis. Every one is a decoy in the variants; the drawn triangle, with c visibly a leg or visibly the hypotenuse, is what makes them impossible.

Kit: `ellipse` and `hyperbola` parts with focus, vertex, co-vertex and corner anchors; `@sum` and `@diff` readouts. Writer: strongest. Length: two full examples plus three quick cases, patiently paced, may pass six minutes; if it does, keep the equation-to-foci reads to two or three beats each on figures already on screen rather than cutting a derivation.