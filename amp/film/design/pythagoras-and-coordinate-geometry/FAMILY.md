# Pythagoras and coordinate geometry, grade 8 to precalculus: family design

Seven skills, 20 problem types. Planning snapshot: `src/curriculum/catalog.ts`, the engine templates and `film/facts.ts`, snapshot 2026-11-09. This design covers the idea, the picture, the habits, the kit. Per-type concepts use these foundations and pictures.

---

## 1. The idea underneath the whole family

A length along a grid line can be read off the grid. A slanted length cannot. **The Pythagorean theorem is the one way to measure a slant: build the L under it, and the slant is the hypotenuse.** Everything in this family from grade 8 to precalculus is that one move, and then sentences made of it: a circle is "every point whose slant to the center is r"; a parabola is "every point whose slant to the focus equals its drop to the directrix"; an ellipse is "every point whose two slants add to the same number". A learner who owns the L and the three squares owns the family; the rest is reading.

The foundations, in the order they are built. Each lesson stands on the ones above it and names what it borrows.

1. **A right angle is a square corner; the side across from it is the hypotenuse.** (Grade 8 opening; from families 22 and 23.) Leg, hypotenuse, right angle are defined before anything else. The hypotenuse is always the longest side. The first thing to find in any figure is the little square in the corner: it says which side plays c.

2. **"Squared" is the area of the square drawn on the side.** (From family 24.) 5² is a 5-by-5 square, 25 unit squares. The theorem is a statement about three areas, so a² must be a picture before it is an exponent.

3. **The two leg squares together hold exactly what the hypotenuse square holds.** (8.G.B.6.) a² + b² = c². Proved by motion, once, with no algebra: four copies of the triangle inside one big square of side a + b leave a tilted white square c² in the middle; slide the same four copies into two pairs and they leave two white squares, a² and b². Same tiles, same big square, so the white areas match. After this the learner says "the leg squares fill the hypotenuse square" and never needs the proof again.

4. **The side is the square root of its square, and roots live between the whole squares.** (From families 4 and 3.) √169 = 13 exactly. √185 is between √169 = 13 and √196 = 14, nearer 14. "To the nearest tenth" means root once, round once, at the end. "Simplest radical form" means pull out the biggest perfect square: √125 = √25 · √5 = 5√5. Every answer in the family takes one of these three shapes, and the learner should know which before computing.

5. **Two legs given: add the squares. The hypotenuse given: the leg's square is what is left.** (8.G.B.7.) The theorem is written the same way every time, with the hypotenuse alone on its side of the equals; a missing leg is then a missing part of a whole (family 6): ? + 16 = 25. A leg is always shorter than the hypotenuse; the hypotenuse is longer than either leg and shorter than the two together. This is the sense check for every length in the family.

6. **If the squares add, the corner is square; if they do not, it is not.** (8.G.B.6, the converse.) Hinge two legs at the corner. Open to a right angle and the third side is exactly √(a² + b²); open wider and it is longer; close it and it is shorter. So a triangle whose longest side squared equals the other two squares added is right, and only then. The longest side plays c, whatever order the problem lists the sides in.

7. **In a box, Pythagoras runs twice.** (8.G.B.7, "three dimensions".) The floor diagonal is a hypotenuse lying flat. Then it becomes a leg of a triangle standing up inside the box, whose other leg is the height and whose hypotenuse is the corner-to-corner distance. d² = l² + w² + h² is the two steps written as one.

8. **On the plane, a horizontal or vertical distance is a difference, and every other distance is the hypotenuse of the L whose legs are the two differences.** (8.G.B.8; from families 13 and 14.) Run = x₂ − x₁, rise = y₂ − y₁: the slope triangle from family 14 is the distance triangle. Signs do not matter because the legs are squared, and a length is never negative. The distance formula is the L with its legs named; the lesson teaches the drawing, then says the formula is the drawing for someone without graph paper.

9. **A point part of the way along a segment is the same part of the way along each leg.** (HSG.GPE.B.6; midpoint first.) Halfway along the run and halfway along the rise is the midpoint: average the x's, average the y's. One fifth of the way: start at the named point, add one fifth of the run and one fifth of the rise. AP : PB = 1 : 4 means five parts in all and P is one part from A (family 10: the parts total). A missing endpoint is the same move again: from A to M, then from M the same run and rise once more.

10. **Slopes, lengths and midpoints prove a shape's name.** (HSG.GPE.B.4, with B.5 from family 14.) Parallel sides: equal slopes. A right angle: slopes that multiply to −1. Equal sides: equal squares of lengths (no roots needed). Diagonals that bisect: one midpoint. The most specific name is the one every fact allows; each ruled-out name is denied by one fact the learner can point to.

11. **A circle is all the points one distance from the center, so its equation is the theorem written for a point not yet chosen.** (HSG.GPE.A.1.) Legs x − h and y − k, hypotenuse r: (x − h)² + (y − k)² = r². The bracket shows the opposite of the center's sign; the right side is r², not r. A point is on the circle when its two legs squared add to r², inside when less, outside when more. Completing the square (family 15) rebuilds the brackets from an expanded equation: divide out a leading coefficient, then half the middle, squared, added to both sides.

12. **A parabola is all the points as far from the focus as from the directrix; the vertex sits halfway between them.** (HSG.GPE.A.2.) The focus distance is a slant; the directrix distance is a straight drop. Set them equal, square, simplify: (x − h)² = 4p(y − k), p the signed distance from vertex to focus. The curve opens toward the focus and away from the directrix; a horizontal directrix squares x, a vertical one squares y.

13. **An ellipse keeps the sum of two focus distances fixed; a hyperbola keeps the difference fixed; and a, b, c are a right triangle.** (HSG.GPE.A.3.) The fixed sum or difference is 2a. In the ellipse the foci are inside, so c is a leg: a² = b² + c². In the hyperbola the foci are outside, so c is the hypotenuse: c² = a² + b². The foci lie on the axis of the larger denominator (ellipse) or the positive term (hyperbola).

14. **All of them are cuts of one double cone.** (HSG.GMD.B.4.) Compare the plane's angle to the axis with the side's angle to the axis: straight across, a circle; tilted but flatter than the side, an ellipse; tilted exactly like the side, a parabola; steeper than the side, it meets both cones, a hyperbola; through the vertex, the cut collapses to a point, a line or two crossing lines.

**Taken from other families:** right angle and triangle (22, 23); area of a square (24); squaring and roots, roots between squares, simplest radical form (4, 3); distance on a number line as a difference, subtracting negatives (6, 3); the plane as two number lines (13); the slope triangle and the slope criteria for parallel and perpendicular (14); parts of a ratio and a fraction of the way (10, 9); expanding brackets and completing the square (12, 15); the circle as the points at one distance (28); the box (25). **Given to:** trigonometry (the right triangle whose ratios are the trig functions, and x² + y² = 1 as the unit circle; 30), complex numbers (the modulus is this hypotenuse; 5), vectors (magnitude; 31), circles (chord and tangent lengths; 28), transformations (lengths preserved, checked by coordinates; 26).

---

## 2. The visual language: the L, the slant, and the three squares

One picture for all seven skills, and one sketch for scratch paper: **two points, the horizontal and vertical legs that join them (the L), and the slant across.** A grade-8 learner draws it for 5 and 12; a precalculus learner draws it from a focus to a point on an ellipse. Only the names on the sides change.

### The shapes

- **The right triangle**, always to scale from the problem's numbers, legs horizontal and vertical whenever the problem allows (on the plane, always: the legs run along grid lines). The right-angle mark is always drawn; it is how the learner finds the hypotenuse.
- **The squares on the sides**: a square grows outward from each side, in a light tint of the side's color, with its area written inside in the side's color. For whole sides up to about 15 the unit grid is drawn inside the square so the area is countable; beyond that, the number alone. An unknown area or side is a "?" in that side's color.
- **The L on the plane**: the two given points as dots with coordinate callouts; the corner as a small hollow dot (it is not a point of the problem); each leg with a measuring bracket labeled by its subtraction, 7 − (−5) = 12, written so the sign work is visible once and then the length stands alone.
- **The circle**: center, one point on it, the radius as the slant, the legs drawn to the corner and labeled x − h and y − k (with numbers when the point is given).
- **The parabola**: focus as a dot, directrix as a dashed muted line, vertex marked, the curve drawn; from one point on the curve, the slant to the focus and the straight drop to the directrix, each with a live length.
- **The ellipse and hyperbola**: two foci, the curve, one point with its two focus distances and a live sum or difference; and the a–b–c right triangle drawn inside the figure (ellipse: center to focus and center to co-vertex are the legs, focus to co-vertex the hypotenuse; hyperbola: center to vertex and vertex up to the asymptote box corner are the legs, center to the corner the hypotenuse, with the box and asymptotes muted).
- **The box**: isometric, to scale, hidden edges dashed; the floor triangle shaded on the floor; the standing triangle shaded through the inside.
- **The double cone**: tinted, axis dashed, one side line with its angle to the axis marked; the cutting plane as a tilted tinted slab with its angle to the axis marked in gold; the section curve drawn on the cone and named.
- **The hinge**: two legs of fixed length joined at a corner, the third side across, an angle arc at the corner with a live degree readout, and a live length readout on the third side. The right-angle mark appears only when the readout says 90.

### Color means one thing each

- **blue**: horizontal legs (the run, x − h, the floor's edges, the ellipse's c).
- **rust**: vertical legs (the rise, y − k, the drop to the directrix, the box's height, the ellipse's b).
- **teal**: the slant: hypotenuse, distance, radius, focus distance, the curve itself.
- **violet**: a second slant when two are on screen: the space diagonal after the floor diagonal, the second focus distance.
- **gold**: the one thing being looked at now: the right-angle mark while finding the hypotenuse, the longest side in a converse check, the word in the problem that decides ("leg", "nearest tenth", "midpoint", "directrix"), the deciding slope or length in a quadrilateral proof. One gold thing at a time.
- **muted**: axes and grid, the directrix, hidden box edges, asymptotes, dimmed choices.

This matches the complex-plane kit (real components blue, imaginary rust, lengths teal), so the slope triangle, the distance triangle and the modulus triangle are one picture in one set of colors. The board uses the same colors: `\cb{5}^2+\cw{12}^2=\ca{c}^2`.

### Labels and scale

Side lengths sit outside the shape at the middle of the side; areas sit inside their squares; coordinates sit beside their dots, away from axes and lines. Nothing overlaps; the kit's `--dry` reports what does. The scale is never faked: a 5–12–13 triangle is drawn 5 by 12 on a grid whose cell is the unit; a box 16 by 24 by 18 is drawn in that proportion. When numbers are large the camera zooms; the proportions do not change.

### The motions, each proving a foundation

- **Square up**: a square sweeps outward from a side and its area appears inside. "Squared" is an area. Foundation 2.
- **Rearrange**: four congruent triangle tiles slide inside one fixed big square from the arrangement that leaves c² to the arrangement that leaves a² and b²; the white regions tint teal, then blue and rust. Same tiles, same square, same white. Foundation 3.
- **Part and whole**: on the three squares, 16 + ? = 25; the "?" resolves to 9 and its side to 3. A leg's square is what is left. Foundation 5.
- **Hinge**: the corner opens and closes; the third side's readout rises past √(a² + b²) and falls below it; the right-angle mark appears at 90 and only there. Foundation 6.
- **Lift out**: the standing triangle inside the box turns out onto the page beside the box, flat and to scale, so it is seen as a plain right triangle with the floor diagonal as a leg. Foundation 7.
- **Lay on the grid**: a bare triangle's legs snap to the grid lines through two points; coordinates appear; the leg labels become subtractions. The slope triangle is the distance triangle. Foundation 8.
- **Cut the legs**: each leg is ticked into n equal parts; the point drops onto the slant at the k-th tick of both. Foundation 9.
- **Glide around**: a point travels the circle; the L reshapes, the legs' labels change, the radius keeps its length and its label. The equation on the board does not change. Foundation 11.
- **Two tapes**: a point glides along the parabola with both readouts equal the whole way; along the ellipse with the sum fixed; along the hyperbola with the difference fixed. Foundations 12 and 13.
- **Tilt the cut**: the plane tilts through the cone, the section's outline redraws and is renamed as the angle passes the side's angle. Foundation 14.
- **Dim**: choices that cannot be right fade together in one beat with the one reason said aloud. Never struck one by one.

### What is deliberately not a picture

The distance formula as an opening; "a² + b² = c²" with no triangle beside it; triangles not to scale; a circle centered at the origin as the main example (the sign flip is half the lesson); a parabola with vertex at the origin for the same reason.

---

## 3. How the lessons go

### The habits, in this family's terms

1. **Read.** The problem is read as the learner sees it, choices included. Gold on the word that decides: "hypotenuse" or "longest" (subtract), "legs" (add), "nearest tenth" or "exact" or "simplest radical form" (the answer's shape), "midpoint" or "endpoint" or "center of a circle with diameter AB" (three different asks), "AP : PB = 1 : 4" (parts total five, start at A), "(x + 4)" (the center is at −4), "= 36" (that is r²), "focus", "directrix", "vertex", "sum" or "difference" of distances. One beat says what the answer must look like before any work: a length shorter than 5; a point between the two given; a square root that is probably not whole; a center with the opposite signs.

2. **At a glance.** What is known with no work. Which side is the hypotenuse. Whether the legs are a known triple (3-4-5, 5-12-13, 8-15-17, 7-24-25 and their multiples: recognizing one is an instant answer that never fails, because it is recognition, not a rule). Which two whole squares the sum sits between. For the converse, the longest side goes gold and plays c. For choices: which are nonsense (below).

3. **The sure fast way.** Sketch the L (or the three squares), label the legs, write the theorem with the hypotenuse alone on its side, solve, take the root. On the plane: subtract to get the legs; never carry the formula in memory with its signs. For the midpoint, average; for a fraction of the way, add that fraction of each leg to the start; for a circle, write the brackets from the center with signs flipped and r² on the right; for a parabola, mark the vertex halfway and let p be the signed vertex-to-focus distance; for a conic, draw the a–b–c triangle and read which side c is. No shortcut that sometimes fails is taught; "compare to a triple" is used only when the triple is actually there.

4. **Sense.** A leg is shorter than the hypotenuse; a hypotenuse is between the longer leg and the sum of the legs; a distance is less than run plus rise; a midpoint is between the endpoints in both coordinates; a point one fifth of the way is near the start; a radius is smaller than r² unless r² is 1; a vertex is on the axis line through the focus and strictly between focus and directrix; an ellipse's c is less than a, a hyperbola's c is more.

5. **Check.** Square the answer and see the squares add (or subtract) exactly. On the plane, count the legs in grid steps and compare with the subtraction. For a midpoint, the move from A to M equals the move from M to B. For a partition point, the slope from A to P equals the slope from A to B (P is on the line). For a circle, put the point in: the legs squared add to r². For a parabola, the vertex is p from the focus and p from the directrix. For a conic, a² and b² and c² satisfy the right triangle; the foci are on the stated axis.

**Rule out, for the multiple-choice types.** The decoys are the misconceptions, so the lesson names them and dims them together:
- A length longer than the sum of the other two sides, or a leg longer than the given hypotenuse: gone.
- An "exact distance" choice that is the sum of the legs (8 for legs 4 and 4), or a radical whose square is not the sum of the squares (16√2 squares to 512, not 32): gone; the answer must square to run² + rise².
- A midpoint or center not between the endpoints in both coordinates (the sum (14, −6), the difference, a halved endpoint): gone at once.
- A circle "fact" with the bracket's own sign as the center, or r² read as the radius, or a diameter equal to r: gone; "the point is on the circle" is settled by the legs, never by looking.
- A parabola equation with 4p equal to the whole focus–directrix distance, or opening toward the directrix, or a vertex at the focus: gone.
- A vertex not on the line through the focus perpendicular to the directrix: gone.
- A conic equation whose first term's variable does not match the foci's axis (foci (0, ±7) need the y-term positive and first): gone before any arithmetic.
- A quadrilateral name denied by one computed fact (slopes 0 and 4/3 are not perpendicular, so "rectangle" and "square" dim together).

### What children actually get wrong here, and what makes it impossible

- **Adding the squares when a leg is missing**, producing a leg longer than the hypotenuse. Made impossible by writing the theorem one way every time (hypotenuse alone on its side) and by the part-whole picture on the squares: ? + 16 = 25. The sense check "a leg is shorter than the hypotenuse" is said on the figure, where it is visible.
- **Taking c to be the side listed last** in the converse and the sort table, squaring the first two and comparing with the third. Made impossible by finding the longest side first, every time, gold, before anything is squared. (20, 16, 30: the longest is 30; 400 + 256 = 656, not 900; not right.)
- **Stopping at the area**: answering 169 for the hypotenuse, or 25 for legs 3 and 4. Made impossible by the squares: the number inside a square is an area, the side is written outside, and the question asks for a side.
- **Adding the sides, or "rooting each"**: 5 + 12 = 17, or √(25 + 144) = √25 + √144. Made impossible by the sense check on the figure: 17 is exactly the two legs laid end to end, and a slant is shorter than that.
- **On the plane, adding the coordinates instead of subtracting, or adding the legs instead of their squares** (the walk along the L). Made impossible by labeling each bracket with its subtraction on the grid, and by the visible fact that the slant is shorter than the L.
- **Fear of the negative leg**: writing (−5)² as −25, or dropping the sign in 7 − (−5) and getting 2. Made harmless by the bracket: the leg is a count of grid steps, always positive, and the subtraction is shown once with the double negative said aloud.
- **Midpoint by subtracting** (the distance habit leaking), or **a missing endpoint by averaging the known endpoint and the midpoint** (a point a quarter of the way). Made impossible by "the midpoint is between, both ways" and by copying the legs: from A to M, then the same run and rise again.
- **1 : 4 taken as one quarter**, or walking from the wrong end, or taking the fraction of the endpoint's coordinates instead of the leg. Made impossible by cutting the legs into five, counting from the named point, and reading the slope check.
- **(x + 4) read as center 4; 36 read as the radius; "radius 6" written as = 6.** Made impossible by the glide picture, where the leg is labeled x − (−4) = x + 4 and the radius is labeled r with r² on the board beside it.
- **Completing the square without balancing, or without dividing out the leading 2 first.** Made impossible by the square with the missing corner (family 15's picture, named in one line) and the margin note "+25 both sides".
- **The vertex put at the focus or on the directrix; p taken as the whole focus–directrix distance**, so 4p comes out double. Made impossible by the two equal brackets drawn from the vertex, each labeled p.
- **c² = a² + b² used for the ellipse, or the larger denominator taken as a² in a hyperbola.** Made impossible by drawing the a–b–c triangle on the figure: in the ellipse c is visibly a leg because the focus is inside; in the hyperbola c is visibly the hypotenuse because the focus is outside.
- **In the box, adding the three edges or stopping at the floor diagonal.** Made impossible by lifting the standing triangle out of the box.
- **Rounding in the middle**: rounding 55.35 before rooting. Made impossible by one habit said once: keep the square exact, root once, round once at the end.

### Lines to remember

- "Find the square corner. The side across from it is the hypotenuse."
- "The leg squares fill the hypotenuse square."
- "Two legs: add the squares. Hypotenuse given: the leg's square is what is left."
- "Longest side plays c."
- "Draw the L. Run, rise, slant."
- "Midpoint: halfway along each leg. Average."
- "One to four is one part out of five."
- "A circle is the theorem for every point at once. Opposite signs in the brackets; r squared on the right."
- "The vertex sits halfway. The curve opens toward the focus."
- "Focus inside: c is a leg. Focus outside: c is the hypotenuse."
- "Root once, round once, at the end."

---

## 4. Tools to build

**Exists today and is enough as is:** `axes` in four quadrants with `xrange`/`yrange`; points by coordinate, `mid`, `on` a circle by degrees, `on` a plot by x, `anchor`; `dot`, `seg` (`dash`, `extend`, `ticks`), `angle` with `right`, `label` with `@x`/`@y`, `dim` brackets with TeX; `poly` with `solid` tiles and `slide`/`turn`/`flip`/`morph`; `circle` with `glide` by degrees; `plot` for a vertical-axis parabola; `view`; `table` (the sort table's rows lit one at a time); the app's real figures through `scene` (the circle-equation graph). The rearrangement proof needs nothing new: four solid `poly` tiles, `slide`, and tinted regions shown after the slide.

**New, in build order.**

### 4.1 Points on the plane (extend `points`)
- `{ "corner": ["A", "B"] }`: the point with A's x and B's y, the L's corner.
- `{ "along": ["A", "B"], "t": 0.2 }`: the point t of the way from A to B; `t` may be `"1/5"`.
- `{ "foot": "P", "on": "d" }`: the foot of the perpendicular from P to any `seg` or line part (today `foot` drops only to the x axis).
- `{ "on": "pa", "x": 3 }` and `{ "on": "el", "deg": 40 }`: points on the new curve parts below.

### 4.2 Live readouts (extend `label`)
- `"tex": "@len"` with `"of": "AB"` reads a segment's length as its points move; `"round": 1` for one decimal, `"exact": true` for 13 or 5√5 or √185.
- `"@deg"` with `"of"` an angle part reads the opening in degrees (the hinge).
- `"@sum"` and `"@diff"` with `"of": ["PF1", "PF2"]` for the ellipse and hyperbola tapes.

### 4.3 `square`: a square on a side
```json
{ "id": "sq", "square": ["A", "B"], "away": "tri", "fill": "blue-fill", "ink": "blue", "area": true, "units": true }
```
Built on segment AB on the side away from the named polygon; `area: true` writes the computed area inside (override with `"tex": "?"` or `"c^2"`); `units: true` draws the unit grid inside when the side is a whole number up to 15. `show` sweeps it out from the side. Parts: `sq.area`. (CURRICULUM lists "squares on triangle sides" under the `area` component; this is that piece, built here.)

### 4.4 `legs`: the L between two points
```json
{ "id": "L", "legs": ["A", "B"], "labels": "diff", "cuts": 5 }
```
Draws the run (blue) from A to the corner and the rise (rust) from the corner to B, the hollow corner dot, and a `dim` bracket on each leg labeled with its subtraction (`7-(-5)=12`) or, with `"labels": "len"`, the length alone. `cuts: n` ticks each leg into n equal parts. Parts: `L.run`, `L.rise`, `L.corner`, `L.run.dim`, `L.run.cut.2`. The slant itself is an ordinary `seg` in teal so its `@len` can be read. This could be composed by hand from segs and dims, but every distance, midpoint, partition and circle lesson in the family should look identical, and writers will get the subtraction labels wrong.

### 4.5 `dim` for choices
Specified in the place-value design (`{"do":"dim","choices":[1,3]}`); not yet landed. Fourteen of this family's twenty types have choices.

### 4.6 Curves defined by their rule
- `{ "id": "pa", "parabola": { "focus": "F", "directrix": "d" } }`: drawn in any orientation from the two defining objects; anchors `vertex`, `axis`; a `dim` from vertex to focus and vertex to directrix can be built on `pa.vertex`.
- `{ "id": "el", "ellipse": "C", "a": 5, "b": 3, "axis": "x" }` and `{ "id": "hy", "hyperbola": "C", "a": 4, "b": 3, "axis": "y", "box": true, "asymptotes": true }`: anchors `focus:1`, `focus:2`, `vertex:1`, `covertex:1`, `corner:1` (box corner), so the a–b–c triangle is three `seg`s on anchors. Points `{ "on": "el", "deg": t }` by parameter.
The `circle` part exists; `glide` on it exists; with 4.1 and 4.2 the circle lessons need nothing else.

### 4.7 `box`: a rectangular box with its diagonals
```json
{ "id": "bx", "box": [16, 24, 18], "at": "O" }
```
Isometric, to scale, hidden edges dashed, faces lightly tinted; corners named by position (`bx.corner.fbl` front-bottom-left); `bx.diag.floor` and `bx.diag.space` as segments; `bx.tri.floor` and `bx.tri.standing` as shaded triangles. `{"do":"lift","target":"bx.tri.standing"}` turns the standing triangle out of the box to lie flat beside it, to scale, as a plain right triangle. One type uses this (`space-diagonal`), but it is a common test item and the 3D clause of 8.G.B.7.

### 4.8 `cone`: a double cone with a cutting plane
Tinted silhouette, dashed axis, one side line with its angle to the axis marked and labeled, a tilted slab with its angle marked in gold, the section curve drawn on the cone; `{"do":"tilt","target":"pl","deg":36}` animates the angle and the curve redraws and renames. One type (`cone-section-name`); build last. The honest alternative, a 2D side view with the two angles plus a small 3D inset, is acceptable if the 3D proves expensive, but the standard names three-dimensional objects.

### 4.9 Borrowed from family 15
Completing the square wants the algebra tiles with a missing corner (`area` tiles, family 15's build). Until they land, `geo-circle-general-form` and `conic-standard-form` draw the square with the missing corner as a `poly` with two labels, name the foundation in one line, and do the work on the board with margin notes. The lesson does not block on the tiles; it adopts them when they exist.

**Build order:** 4.1 to 4.5 first (unlocks all of `pythagorean-theorem` except the box, all three `coordinate-distance` types, both `segment-division` types, the quadrilateral proof, and all three `circle-equations` types: 15 of 20); then 4.6 (parabola and conics, 5 types minus the cone); then 4.7; then 4.8.

---

## 5. Who writes what

**The strongest writer**, because the screenplay is the design and the quality is in reasoning a checker cannot see:
- `right-triangle`: the picture is born here, with the rearrangement proof. If the proof is described instead of staged, the family has no foundation.
- `pythagorean-converse`: the hinge is the explanation 8.G.B.6 asks for; the longest-side habit is set here and the sort table inherits it.
- `coordinate-distance`: the lay-on-the-grid moment, where a figure lesson becomes a plane lesson; every later lesson says "draw the L" and means this.
- `midpoint-endpoint`: a mixed type (midpoint; missing endpoint; circle center from a diameter) that teaches reading, and holds the family's most common wrong move (averaging the midpoint with the known endpoint).
- `coordinate-quadrilateral-claims`: a "most specific statement" type; the lesson is an argument, and the decoys are the names a fact denies.
- `space-diagonal`: the 3D picture and the choice of which triangle to stand up.
- `parabola-focus-directrix`: the derivation from equal distances (HSG.GPE.A.2 says "derive"), orientation and sign.
- `conic-foci`: the sum and difference tapes and the a–b–c triangle with c on different sides; two derivations, one lesson.
- `cone-section-name`: three-dimensional reasoning with no computation to lean on.

**A capable cheaper model, from a finished concept with the kit complete** (one method, one picture, the arithmetic checkable by `--dry`):
- `right-triangle-missing-leg`, `radical-side-entry`, `pythagorean-sort-table` (the hinge check applied; one row worked fully, the rest filled fast; the concept must say how to avoid repeating a case four times).
- `coordinate-distance-exact` (the distance lesson plus "pull out the perfect square").
- `segment-partition`, `geo-segment-partition-point` (cut the legs; count from the named point).
- `circle-equation`, `mcas-circle-equation-select`, `geo-circle-general-form` (brackets with signs flipped, r², legs of a test point, complete the square).
- `parabola-vertex-distance` (halfway between, on the axis line).
- `conic-standard-form` (read the sign and the denominators; complete the square).

The division of work depends on a strong concept, a kit whose parts are the picture, a cheaper writer, then a strong review and an independent sample review.

---

## 6. What in the app's problem types should change, and what the standards ask that the app never does

> Base cases and trick questions are wanted in the app. A flag here means a weak choice for a lesson's main example, never that the app should drop it.

**Misfiled and mislinked**
- `midpoint-endpoint` sits in grade 8 under 8.G.B.8, which is distance only; no grade-8 standard has the midpoint. It is HSG.GPE.B.6 (a 1 : 1 partition), and its "center and equation of a circle from a diameter" variant is HSG.GPE.A.1. Keep it where the learner meets it, but link it to B.6 and A.1 and say in the template that it runs ahead of grade 8.
- `pythagorean-converse` and `pythagorean-sort-table` have no judged standard. Both serve 8.G.B.6 ("...and its converse").
- `coordinate-distance-exact` is linked to 8.NS.A.2, which is about rational approximation of irrationals; the type asks for exact radicals. Remove the link; `right-triangle` ("to the nearest whole number") and `right-triangle-missing-leg` ("to the nearest tenth") are where 8.NS.A.2 is actually practiced here.
- `mcas-circle-equation-select` is linked to HSG.GPE.B.4 only; its center and radius statements are HSG.GPE.A.1. Add it.
- `cone-section-name` carries HSG.GMD.B.4, family 25's standard. It stays in this family because the point is naming conics, but the alignment list should show the share.
- The `segment-division` skill description promises "internal or external" division; no variant divides externally, and HSG.GPE.B.6 says "between two given points". Fix the description, not the problems.

**Grade leaks and stretches**
- `radical-side-entry` and `coordinate-distance-exact` ask for simplest radical form in grade 8; that is Algebra 1 (HSN.RN), and the HSN.RN.A.2 link is loose (no rational exponents appear). Keep as a stretch, but the lessons must teach "pull out the biggest perfect square" rather than assume it.
- `midpoint-endpoint`'s circle variant is Geometry content in a grade-8 skill (above).

**Badly conceived or split**
- `radical-side-entry` is two types under one name: a decimal leg (0.6 and 1 give 0.8), which duplicates `right-triangle-missing-leg`, and a radical hypotenuse reported by its coefficient. Move the decimal variants to the leg type; keep the radical type on its own.
- `segment-partition` and `geo-segment-partition-point` are one idea in two forms (type one coordinate; choose the point). Fine as two forms, but one concept should serve both and the lessons must not teach them as different things.
- `conic-standard-form` holds three asks (name the curve; read the center or axis ends; complete the square). The lesson must read every variant and work one of each kind on its own screen, or the type should split.
- `circle-equation` holds three asks (from the equation; from a center and a point; from the graph) under one idea; fine, since all three are "r² is the legs squared, added".
- `coordinate-distance`'s two shown examples both give 13 (two 5–12–13 triangles). Verify the generator reaches other triples (3–4–5, 8–15–17 and multiples) so a learner does not learn "the answer is 13".
- Film seeds to avoid as the main example (verify with `facts.ts`): a distance with run or rise 0; a midpoint or vertex at the origin; a circle centered at the origin; a box with two equal edges that hides which triangle is which; a converse triple so famous the hinge is not needed.

**Standards clauses the problems never practice**
- 8.G.B.6, "Explain a proof of the Pythagorean Theorem": no type asks about the proof. The lesson for `right-triangle` teaches it; the app never checks it. A small type would fix this: shown the rearrangement figure, which equation does the picture show, or what is the area of the inner square.
- 8.G.B.7, "real-world ... problems": every triangle variant is a bare triangle ("A right triangle has..."); only the shipping tube is a story. A ladder, a TV diagonal, a ramp, a distance across a field would practice the clause.
- HSG.GPE.A.1, "Derive the equation of a circle ... using the Pythagorean Theorem": the derivation is taught, never asked; `circle-equation`'s "center and a point" case is the nearest. Acceptable.
- HSG.GPE.A.2, "Derive the equation of a parabola": practiced as choosing the equation, not deriving it. Acceptable; the lesson derives.
- HSG.GPE.B.4, "prove or disprove that a figure defined by four given points ... is a rectangle": practiced for quadrilaterals only. Nothing asks about a triangle (isosceles, right, equilateral) from coordinates; one type would complete the standard. "The point lies on the circle" is practiced by the select type.
- 8.NS.A.2, "locate them approximately on a number line": practiced in family 3, not here (as the link fix above says).

---

## 7. The pilot: five types to build first

The pilot covers the whole arc in one sitting: the picture born and proved, the hinge, the move onto the plane, the circle as the theorem for every point, the parabola as a distance rule; every new tool from 4.1 to 4.6; grade 8 and Geometry; open answer, choices, and select-many.

| # | Problem type | Grade | Why it is in the pilot |
|---|---|---|---|
| 1 | `right-triangle` | 8 | The three squares and the rearrangement proof: the family's foundation and its one proof. Exercises `square`, solid tiles sliding, `@len`, the triple at a glance and "between which two squares". If this is not beautiful, nothing after it will be. |
| 2 | `pythagorean-converse` | 8 | The hinge: readouts on the third side and the corner, the right-angle mark appearing only at 90; the longest-side habit; a realistic trap (squaring in the given order). Exercises `move` with `@len` and `@deg`. |
| 3 | `coordinate-distance` | 8 | Lay on the grid: the triangle becomes the L, legs become subtractions with a negative in play ((3, −5) to (−2, 7)); the formula shown as the drawing. Exercises `legs`, `corner`, and the bracket labels. Every later lesson in the family points back here. |
| 4 | `circle-equation` | Geo | Glide around: the L reshapes, the radius does not, the equation holds for every point; brackets with signs flipped, r² not r; the "from the graph" case on the app's real figure. Exercises `glide` with `@len` on a circle and `scene`. |
| 5 | `parabola-focus-directrix` | Geo | Two tapes: a point gliding with its slant to the focus and its drop to the directrix always equal; the vertex halfway; p signed; choices ruled out by 4p and by direction. Exercises `parabola`, `foot` on a line, `@len` readouts and `dim`. |

If the five land, the next wave is `midpoint-endpoint` (the mixed reading lesson, strongest writer), `space-diagonal` (builds `box` and `lift`), `conic-foci` (builds `ellipse`/`hyperbola` and the sum and difference tapes) and `coordinate-quadrilateral-claims` (the proof type, on tools already built). `cone-section-name` comes last with its own tool.
