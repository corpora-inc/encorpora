# Vectors, matrices and parametric motion (precalculus): family design

Nine skills, twelve problem types, all precalculus. Planning snapshot: `src/curriculum/catalog.ts`, the engine templates, `film/facts.ts` for every variant, and the exact text of HSN.VM.A, B and C, HSA.REI.C.8 and C.9, snapshot 2026-11-09. This design covers the idea, the picture, how the lessons go, the kit, the seam, the misfilings, the pilot. The per-type concepts use these foundations and pictures.

---

## 1. The idea underneath the whole family

The family is one habit used three ways: **do the arithmetic one slot at a time, and read what it means off the picture.** A vector is a move with two slots: so far across, so far up. A matrix is a table of slots, and when it acts on the plane its two columns are where the two basic moves land. A moving point is a start plus so many copies of a velocity move. Every computation here is slot-by-slot arithmetic a seventh grader can do; every idea is a picture of arrows on a square grid. A learner who keeps the picture never adds two legs to get a length, never forgets the square root, never multiplies matrices entry by entry, and never wonders whether AB equals BA.

The foundations, in the order they are built. Each later one stands on the ones above it. The plan files parametric motion after matrices; it should be taught right after vectors, because it is vectors with a clock.

1. **A vector is a move, not a place.** ⟨a, b⟩ means a across (right if positive, left if negative) and b up (down if negative). The same arrow drawn anywhere is the same vector; drawn from the origin, its tip is the point (a, b). The components between two points are end minus start, slot by slot. Define *vector*, *component*, and the symbols the problems use: bold **v**, ⟨a, b⟩, |**v**| (also written ‖**v**‖). The slope triangle from family 14 is this arrow's two legs: a vector is a rise and a run that remember which way they go. From 13 (the plane), 3 (signed numbers as direction), 14.

2. **Length is the hypotenuse.** The two legs make a right triangle, so |⟨a, b⟩| = √(a² + b²): never a + b, never negative, and a squared negative is positive. Direction is the angle the arrow makes, from the tangent of the legs. From 27 (distance), 30 (tangent).

3. **Add tip to tail; add slot by slot.** Two moves done in turn equal one move, from the first tail to the last tip. The slots add separately because the across parts line up end to end and so do the up parts. The parallelogram rule is the same picture with the order swapped. The sum is the third side of a triangle, so |**u** + **v**| is at most |**u**| + |**v**|, equal only when they point the same way. Subtraction is **v** − **w** = **v** + (−**w**): flip **w**, then tip to tail; the result is also the arrow from **w**'s tip to **v**'s tip. From 6 (hops, part and whole), 3 (the mirror).

4. **A scalar stretches along the line.** c**v** multiplies each slot; the arrow stays on its own line, |c| times as long, reversed when c is negative; |c**v**| = |c|·|**v**|. From 10 (scale factor), 26 (dilation).

5. **The dot product says how much two arrows agree.** **u**·**v** = u₁v₁ + u₂v₂ is a number, not a vector. Tail to tail, it equals |**u**||**v**| cos θ (the law of cosines, rewritten). Positive: the angle is acute; zero: perpendicular; negative: obtuse. Parallel is a different test: one vector is a scalar multiple of the other, so the slots are in proportion. The angle is cos θ = **u**·**v** / (|**u**||**v**|). The scalar projection **u**·**v** / |**v**| is the shadow **u** casts on **v**. The grade-8 fact that perpendicular slopes multiply to −1 is this with the dot product set to zero. From 30 (cosine, law of cosines), 14.

6. **Perpendicular parts make a right triangle; the combined vector is its hypotenuse.** Plane and wind, boat and current, two forces at right angles: tip to tail they close a right triangle. The combined size is the hypotenuse, the direction comes from the tangent of the legs, and a missing leg comes from Pythagoras run backwards. The whole difficulty is reading which quantity is the hypotenuse: "relative to the shore" is the combined motion; "relative to the water" is a leg. Foundations 2 and 3 applied; from 27, 30.

7. **Position is start plus t copies of the velocity.** x(t) = 2 + t, y(t) = 1 − 4t says the point is at (2, 1) + t⟨1, −4⟩. The velocity is the pair of t-coefficients; speed is its length; direction is its angle; the path is the line through the start along the velocity, found by eliminating t. A circle is a center plus a radius arrow that turns: (r cos t, r sin t) is the unit circle of family 30 scaled; a parabola comes from substituting. Foundations 1, 3, 4 with a clock; from 13 (functions of t), 14 (lines), 30, 5 (the turning point).

8. **A matrix is a table: rows across, columns down.** Dimensions are rows × columns, rows first; the entry in row i, column j is one slot; row and column totals mean what the labels say. Two matrices of the same dimensions add, subtract and scale slot by slot. A vector is a one-column matrix. From 32 (two-way tables), 10 (ratio tables).

9. **A 2 × 2 matrix is two arrows: where east ⟨1, 0⟩ and north ⟨0, 1⟩ land.** M⟨x, y⟩ is x copies of the first column plus y copies of the second. This one picture gives everything about matrices as maps: applying M to a point; naming a rotation, reflection or dilation by reading its columns; the identity, whose columns land on themselves; and multiplication: AB's column j is A applied to B's column j, so each entry of AB is a dot product of a row of A with a column of B, and the inner dimensions must match because a row of A needs one number per row of B. AB means do B first, then A. From 26 (motions), 5 (the kit's arrows).

10. **The determinant is the area of the unit square after the map, with a sign.** The two columns span a parallelogram of area |ad − bc|, so M multiplies every area by |det M|. A negative determinant means the plane turned over (a reflection happened): rotations have det 1, reflections −1, a dilation by k has k². A zero determinant means the two columns lie on one line: the square is squashed to a segment, two different points land on one spot, and nothing can undo it. No area, no inverse. From 24 (area), 26 (k² for area).

11. **The inverse undoes the map.** A⁻¹A = I. For a 2 × 2: swap the diagonal entries, negate the other two, divide by the determinant. AX = B asks which point A sends to B, so X = A⁻¹B, inverse on the left, and the check is to apply A again (substitute into the system). From 11 (undo in reverse; same to both sides).

12. **The laws are what the picture allows.** Regrouping, (AB)C = A(BC), and splitting copies, A(B + C) = AB + AC, hold because they never change the order the maps are done in. AB = BA fails because order matters: a quarter turn then a flip does not land where a flip then a quarter turn does. So every identity that quietly swaps two matrices fails, and cancelling A from AB = AC needs A to have an inverse. I and the zero matrix play the parts of 1 and 0. From 7 (commutativity, which fails here), 12 (distributive property).

**Taken from other families.** The lessons name these in one line and show the owned picture; they never re-teach them.

| From | What | Used in |
|---|---|---|
| 13 Functions and the plane | four quadrants, a point as a pair | 1, 7, 9 |
| 14 Linear | the slope triangle: rise and run | 1, 2, 6 |
| 27 Pythagoras | distance as a hypotenuse | 2, 6, 7 |
| 30 Trigonometry | tangent for direction, cosine, law of cosines, cos t and sin t on the unit circle | 2, 5, 6, 7 |
| 26 Transformations | rotation, reflection, dilation; k on lengths, k² on area | 4, 9, 10 |
| 24 Area | area of a parallelogram | 10 |
| 11 Equations | undo, in reverse order | 11 |
| 12 Expressions | distributive property as splitting copies | 12 |
| 32 Data displays | two-way tables, row and column totals | 8 |
| 5 Complex numbers | arrows tip to tail, a point turning on a circle; the `vector` kit | 3, 7 |

---

## 2. The visual language

Two pictures carry the family, both on a square grid, both to scale: **the arrow with its legs** (P7, the plane) and **the unit square under a map** (P7 and P8 together). One board component, the **matrix**, carries the bookkeeping. Choose the picture by asking: what should the learner sketch on scratch paper to conquer this problem fast?

### The arrow and its legs

A vector is an arrow on a grid of unit squares. Under it, drawn as the slope triangle of family 14, its two legs: a dashed horizontal leg in **blue** with its signed component written beside it, a dashed vertical leg in **rust** with its component. The arrow's name (**u**) rides its midpoint on the side away from the legs; its length, when asked, is written along the arrow. The pair on the board, ⟨\cb{a}, \cw{b}⟩, is colored to match the legs, so the slots and the legs are visibly the same two numbers. A vector given by two points is drawn from the start to the end, the points labeled, and the legs show end minus start. A free vector (no coordinates in the problem) sits on a faint grid with no axes, so the legs are still to scale. The lesson slides one arrow once to a new tail and says: same move, same vector.

Scale: one grid unit is one unit of the problem. Velocities in the hundreds are drawn in hundreds (one unit is 100 mph, said once and labeled); the legs keep their true proportion and the angle is drawn true. Axes always share one scale; nothing is stretched.

**The sketch:** an arrow with an L under it and two numbers on the L.

### Two arrows

Tail to tail when the question is about the angle, the dot product or the shadow: a gold arc between them, a dashed third side closing the triangle when the law of cosines is named, the perpendicular dropped from one tip onto the other's line for the projection. Tip to tail when the question is about a sum or a resultant: the second arrow slides so its tail sits on the first tip; the result is drawn in gold from the first tail to the last tip, with its own legs, and the summed legs are shown laid end to end along the axis (blue after blue, rust after rust). A difference flips the second arrow about its tail first (the original left as a muted ghost), then slides. A scaled arrow stretches along its own line, legs and labels growing with it, passing through its tail when the scalar is negative.

The resultant of two perpendicular velocities is this picture with compass labels: north and east drawn on the grid, the two given arrows tip to tail, the right angle marked, the combined arrow in gold, the asked angle drawn as the arc from the direction it is measured from ("east of north" opens from north).

**The sketch:** two arrows tip to tail with the third side drawn; or two arrows tail to tail with the angle marked.

### The matrix on the board

Square brackets, entries in a grid, every entry, row and column addressable. A dimension badge (2 × 3) in muted type under a matrix when dimensions matter. A data matrix carries its labels outside the brackets, store names at the left of the rows and item names above the columns, and lights a row or column the way the `table` kit does, with a running total beside it. When a matrix acts on the plane its first column is **blue** and its second **rust**, because the first column is where the blue east arrow lands and the second is where the rust north arrow lands. In a product, the row of the left matrix and the column of the right glow gold together while their dot product is written in the margin and lands in the result's cell. The determinant is drawn as the cross: the main diagonal joined in blue, the other diagonal in rust, the minus between the two products. The inverse is built by motion: the diagonal entries slide past each other, the off-diagonal entries flash rust as their signs flip, and 1 over the determinant writes itself in front.

**The sketch:** a 2 × 2 box with an X through it; the two columns circled as arrows.

### The unit square under a map

Axes, a faint grid, the unit square at the origin with its east edge a blue arrow labeled ⟨1, 0⟩ and its north edge a rust arrow labeled ⟨0, 1⟩, a small counterclockwise curl inside, and the problem's shape or point in teal. Applying M glides the east arrow onto M's first column and the north arrow onto its second; the square follows into the parallelogram (gold fill), every grid line shears, turns or flips with it, the shape and point ride along to their images, and the pre-images stay as muted ghosts. The area label inside the parallelogram counts from 1 up to |det M|. If the curl now runs clockwise, the plane turned over: the determinant is negative. A matrix with determinant zero squashes the square to a segment, and two marked points are seen landing on one spot. The map played backwards is the inverse. Two copies of the plane side by side, same square, the two orders of two maps, show that AB and BA land differently.

Applying M to one point is also shown as a walk: from the origin, x copies of the blue column tip to tail, then y copies of the rust column, arriving at the image. The row-times-column arithmetic on the board is the bookkeeping of that walk.

Example numbers are chosen so the image fits the card: a worked map has |det| of 6 or less; the app's 8 × 20 = 160 case is done on the board as a quick variant after the picture has proved the factor.

**The sketch:** a unit square with its two edges drawn as arrows, and where those two arrows land.

### The path

For motion: axes, a dot at the start with a clock label t = 0, the velocity arrow drawn from the start with its blue and rust legs (the two t-coefficients). As the clock runs the dot slides and leaves a teal trace, and a copy of the velocity arrow is stamped every whole second, so the line is seen as arrow after arrow. The speed is the arrow's length written along it; the direction is its angle; the position readout rides the dot. A circle is the center dot and a radius arrow turning (the wave kit's turning point), the traced circle, the radius labeled, the center read off the constants.

**The sketch:** a start point, one arrow out of it, the clock beside it.

### Color means one thing each

Precedent: `complex-plane-forms` (real parts blue, imaginary parts rust, lengths teal, angles gold). This departs from place value, where rust meant a second number; at precalculus the vertical direction owns rust.

- **teal**: the first or only given vector, **u**; a shape and its image under a map (the pre-image dimmed to a ghost).
- **violet**: the second given vector, **v**.
- **blue**: every horizontal leg and every first slot; the east arrow and the first column of a map matrix; the main diagonal of a determinant.
- **rust**: every vertical leg and second slot; the north arrow and the second column; the other diagonal.
- **gold**: the one thing asked, and only one gold thing at a time: the word in the question, then the sum or resultant arrow, the angle arc, the shadow, the parallelogram's area, the entry being computed.
- **muted**: ghosts, the grid, dimension badges, choices ruled out.

### The motions, each proving a foundation

- **Slide tip to tail** (sum): the slots add because the legs line up end to end. Foundation 3.
- **Both ways round** (parallelogram): the same landing in either order. Foundation 3.
- **Flip, then slide** (difference): **v** − **w** is **v** + (−**w**), and the result is the tip-to-tip arrow. Foundation 3.
- **Stretch** (scalar): |c**v**| = |c||**v**|; a negative scalar passes through the tail and comes out the other side. Foundation 4.
- **Swing and close** (angle): tail to tail, the arc, the third side; the dot product is |**u**||**v**| cos θ; the dropped perpendicular is the projection. Foundation 5.
- **Close the right triangle** (resultant): the hypotenuse is the combined motion; the arc opens from the named direction. Foundation 6.
- **Tick the clock** (path): one second, one more velocity arrow; speed is the arrow's length. Foundation 7.
- **Light the row, light the column** (product): the entry is a dot product; a row with no column of the right length has nowhere to land, which is the dimension rule. Foundation 9.
- **Land** (map): the columns are where east and north land; the area counts to |det|; the curl reverses for a flip. Foundations 9, 10.
- **Walk the copies** (M times a point): x copies of the first column, y copies of the second. Foundation 9.
- **Squash** (det 0): two points, one landing, no way back. Foundation 10.
- **Undo** (inverse): the map played backwards returns the image to the point; X = A⁻¹B. Foundation 11.
- **Two orders, twin planes** (laws): AB ≠ BA seen; (AB)C and A(BC) land together. Foundation 12.

---

## 3. How lessons in this family should go

### Foundations first, in every film

Each film opens by building its picture live before the first problem, as the decimal-fractions films open by cutting the flat. About twenty to thirty seconds each:
- **Arrow films** (components, dot product, angle, resultant, linear motion): a start point and an end point on the grid, the move drawn, "so far across, so far up", the two legs, the pair ⟨a, b⟩; the arrow slid once to say it is a move, not a place.
- **Table films** (data, operations, inverse, systems): brackets, rows across, columns down, rows first; one entry named by row and column.
- **Map films** (transformation, determinant and inverse, laws): the unit square, the east and north arrows, "multiply by M and east lands on the first column, north on the second; every other point follows."
- **Motion films**: the start, the velocity arrow from the t-coefficients, the clock.

Twelve types share four openings. The learner meets the same picture every time and the problems become reading.

### The five moves, as in every family

**Read**: the problem aloud exactly as the app shows it, with its choices; the word that says what is asked goes gold (magnitude, perpendicular, angle, "relative to the shore", determinant, inverse, dimensions, "does NOT hold", speed, "at t = 2"); one beat says what the answer must look like before any work (a number, never a pair, for a dot product or a length; a pair for a sum; a 2 × 2 for a product of two 2 × 2s; a positive area; a point that sits on the path). **At a glance**: what is known with no work. **The sure fast way** on the picture. **Sense**: the sketch says the size is right. **Check**: the exact check, and for multiple choice the nonsense choices dim together with one reason, then the chosen one is proved.

### What is known at a glance, the fast way, the check

Arrows and motion.

| Ask | At a glance | Fast sure way | Check; rule out |
|---|---|---|---|
| Components from two points, or from a drawn arrow | which point is the start; the arrow's quadrant gives both signs | end minus start, slot by slot | start plus the components lands on the end; a choice with both signs flipped is the reversed arrow and dims |
| 2**u** − **v**, sums, differences, multiples | the slot you can do in your head decides | scale first, then slot by slot; draw to see it | each slot recomputed; choices that fail the easy slot dim together |
| Magnitude, including ‖c**v**‖ | longer than the longer leg, shorter than the legs added; never negative; ‖c**v**‖ is ‖c‖ times ‖**v**‖ | √(a² + b²), after scaling, or ‖c‖·‖**v**‖; know 3-4-5, 5-12-13, 8-15-17 | legs squared add to it; negatives and anything shorter than a leg dim at once |
| Dot product; find k for perpendicular | the sign from the sketch (acute, right, obtuse) | u₁v₁ + u₂v₂, one number; perpendicular means it is zero, one linear equation | the sign matches the sketch; substitute k back and get zero; a choice that is a pair is nonsense |
| Angle between | the sketch says acute, right or obtuse; a zero dot product is 90° with no formula | cos θ = **u**·**v** divided by both lengths | the arc on the sketch; choices on the wrong side of 90° dim; 0° or 180° only when the slots are in proportion |
| Parallel, perpendicular or neither | a zero dot product settles perpendicular; slots in proportion settle parallel; a zero slot is a warning, not an answer | both tests, perpendicular first | the sketch (⟨−2, 4⟩ and ⟨0, 3⟩ visibly open about 63°) |
| Resultant: size, direction, missing part | which quantity is the hypotenuse; which leg is opposite the asked angle | draw the triangle before any arithmetic; Pythagoras; tan θ = opposite over adjacent | legs² add to the hypotenuse²; θ under 45° when the opposite leg is the shorter; choices equal to the sum or difference of the speeds dim; a leg longer than the hypotenuse dims |
| Position at t; time of an event | plug t | slot by slot; set one coordinate equal and solve | the point sits on the path; a swapped pair dims |
| Speed, direction | the velocity is the pair of t-coefficients | its length; its angle | between the larger rate and the two rates added; the sum of the rates dims, a rate alone dims |
| Eliminate t; write a line parametrically | the point at t = 0 must satisfy the rectangular equation | linear: solve for t and substitute; circle: cos² + sin² = 1, radius squared on the right, center signs opposite the equation's; parabola: substitute | t = 0 and t = 1 both satisfy it; a wrong radius or wrong center sign dims at once |

Matrices.

| Ask | At a glance | Fast sure way | Check; rule out |
|---|---|---|---|
| Dimensions; an entry; a row or column total | rows first; the labels say which line | count rows down the left, columns across the top; sum the lit line | the lit line's total against the grand total; reversed dimensions dim |
| Add, subtract, scale | same dimensions or no answer | slot by slot; for a choice, one entry decides | recompute one entry; mismatched dimensions mean no sum |
| Multiply; does the product exist | inner numbers match; the result is outer by outer | row of the first, column of the second, a dot product per entry | one entry recomputed; a zero row stays zero; wrong-size results dim |
| Determinant; does an inverse exist | one row (or column) a multiple of the other means zero with no arithmetic | ad − bc | recompute the cross; with proportional rows, confirm zero |
| Compute the inverse | | swap, negate, divide by the determinant | one row of A times A⁻¹ gives a row of I; a choice without the 1/det dims |
| Solve AX = B | A's rows are the equations; its columns are the x-coefficients and the y-coefficients | X = A⁻¹B, inverse on the left | substitute into both equations; a swapped pair fails the first |
| Apply M to a point | | x copies of the first column plus y copies of the second | the sketch of the landing; a swapped pair dims |
| Name the map | read the columns: where east lands, where north lands | | det 1 for a rotation, −1 for a reflection, k² for a dilation by k |
| Area after M | positive; bigger than the original when ‖det‖ > 1 | ‖det M‖ times the area | counted on the grid; negatives dim |
| Which law holds, which fails | does the equation quietly swap two matrices, or cancel one? | regrouping and splitting hold; a hidden AB = BA fails; cancelling needs an inverse | test with a quarter turn and a flip |

### Realistic misconceptions, and the picture that kills each

These are what students actually do on these problems; the app's own decoys confirm them.

- **Adding the legs for a length** (‖⟨3, 4⟩‖ = 7), **a negative magnitude** (‖−2**v**‖ = −26), **dropping the scalar** (13). The stretched arrow is visibly twice as long, its length is written along it as a length, and the hypotenuse is visibly shorter than the two legs laid end to end.
- **End minus start backwards.** The arrow is drawn from the start before the subtraction; the reversed choice points the other way.
- **Scaling only one slot, or 2**u** − **v** as **u** − **v**.** Both legs grow in the stretch.
- **The dot product as a pair** ⟨u₁v₁, u₂v₂⟩. The board writes the plus between the two products and the number lands beside the arc, not on an arrow.
- **"A zero component means perpendicular."** ⟨−2, 4⟩ and ⟨0, 3⟩ drawn tail to tail are not at a right angle, and the dot product is 12.
- **Swapping the parallel and perpendicular tests.** Perpendicular is a zero dot product; parallel is slots in proportion; the lesson says both in one breath, with the two sketches.
- **The wrong hypotenuse** (√(26² + 10²) for the boat), **forgetting the root** (576), **subtracting speeds** (16). The triangle is drawn with the known hypotenuse labeled before any arithmetic starts.
- **The complement** (48° for 42°): the angle measured from the wrong leg. The arc is drawn opening from north on the word "north".
- **Speed as the sum of the rates.** The velocity arrow's legs against its length.
- **Eliminating t into the wrong equation; not distributing** (y = 8t − 4 for 8t + 12); **the radius instead of its square; the center's sign.** The t = 0 point checked against every choice at once.
- **Rows and columns reversed** (3 × 2 for 2 × 3). Rows are counted first with a sweep down the left edge.
- **Multiplying matrices entry by entry; the dimension rule backwards; AB computed as BA.** The row and the column glow together; a row with no column of its length has nowhere to land.
- **ad + bc, or bc − ad.** The cross is drawn blue first, rust second, the minus between.
- **The inverse without 1/det; swapping the wrong pair.** The motion: diagonal slides, off-diagonal flips sign, fraction in front.
- **X = BA⁻¹; A built with its columns transposed.** A is filled row by row from the equations; the inverse is written on the left on the word "undo".
- **Area times the signed determinant** (−160). The area is counted on the grid; the curl reverses, the count stays positive.
- **Treating matrices like numbers** ((AB)² = A²B², (A + B)² with 2AB, cancelling A). The twin planes: a quarter turn then a flip, a flip then a quarter turn, different landings.

### Lines to remember

"A vector is a move, not a place." "End minus start." "Length is the hypotenuse, never the sum." "Tip to tail; slot by slot." "Flip it, then add it." "Dot product zero: a right angle. Slots in proportion: parallel." "Which one is the hypotenuse?" "Start, plus t copies of the velocity." "Rows across, columns down; rows first." "The columns are where east and north land." "Row of the first, column of the second: the inner numbers must match." "The determinant is the area of the square after the map. No area, no way back." "Swap, negate, divide." "Inverse on the left." "Order matters; grouping and splitting don't."

### Pace and mixed types

Pacing: a precalculus learner reads symbols slowly. Each new symbol is said, then shown, then left on screen. In a matrix product the first entry is worked slowly with the row and column lit; the second at pace; the rest together once the pattern is set, never nine entries at one speed. Half the types here are mixed (resultant in three stories; linear motion with five asks; transformation with three; inverse-determinant with three; convert with three curves). For these the foundation is the whole lesson: once the picture is owned, each ask is one reading of it, worked once on its own screen, never recited. Most types are multiple choice; the choices are the misconceptions above, and the lesson names them as it dims them.

---

## 4. Tools to build

**Exists today:** `vector` (arrows that slide tip to tail, turn and trace; a label riding the midpoint; `group` for moving arrow and label together), `angle` with `right`, `foot` (onto the x axis only), `circle` with a point `on` it, `glide`, `sweep`, `axes`, `grid`, `poly`, `seg` with `dash`, `dim` brackets, `label` with `@x` `@y` readouts and `pin`, `morph`, `turn`, `flip`, `slide`, `move`, `view`, `plot`, `table` with `given` and totals, the board (`problem` with choices, `write`, `answer`, `watch`, `term`, `recap`, `overview`). **Specified elsewhere and still unbuilt:** `dim` for choices (place value 4.6; every multiple-choice family needs it).

### 4.1 `vector` gains legs, live components, scaling and copies

```json
{ "id": "u", "vector": ["O", "U"], "ink": "accent", "name": "\\mathbf{u}", "legs": true, "components": true, "length": "auto" }
```

- `legs: true` draws the slope triangle: a dashed horizontal leg from the tail in blue, a dashed vertical leg to the tip in rust. `components: true` writes each leg's signed length beside it in its color and keeps them live through every motion. `length` writes |**u**| along the arrow (`"auto"` computes it; TeX overrides, for √17). `name` rides the midpoint on the side away from the legs.
- `{"do":"copy","target":"v","id":"v2","tailAt":{"tip":"u"}}`: a copy appears and slides so its tail sits on **u**'s tip (one action instead of show-then-slide). `{"do":"close","from":{"tail":"u"},"to":{"tip":"v2"},"id":"s","ink":"gold"}` draws the result arrow with its own legs. `{"do":"stack","legs":["u","v2"],"along":"x"}` lays the summed legs end to end along an axis.
- `{"do":"scale","target":"v","by":-2}`: the arrow stretches along its line through its tail, legs and labels following; negative passes through the tail. `{"do":"negate","target":"w"}`: a half turn about the tail, the original left as a ghost.
- Points: `{"tip":"u"}`, `{"tail":"u"}`, and `{"foot":"U","onto":"v"}`, the perpendicular foot of a point onto a vector's line (generalizes the x-axis `foot`) for the projection. The angle between two vectors is the existing `angle` on tail, tip, tip.
- `grid: "faint"` on a figure with no axes keeps free vectors to scale. Compass labels are ordinary `label`s.

### 4.2 `matrix`: the board component, sharing `table`'s cell engine

```json
{ "do": "matrix", "id": "A", "rows": [[0, 3], [-4, 1]], "name": "A", "cols": ["blue", "rust"], "dims": true,
  "labels": { "rows": ["Eastside", "Westside"], "cols": ["backpacks", "lunch boxes"] } }
```

- Brackets, entries addressable as `A.cell.1.2`, `A.row.1`, `A.col.2`, `A.dims`; `highlight` and `given` work on them. `cols` colors the columns (map matrices only). `dims: true` writes "2 × 2" under the matrix in muted type. `labels` writes names outside the brackets for data matrices; `{"do":"total","target":"A.row.2"}` writes a running sum beside the line as its cells light one by one.
- `{"do":"product","left":"A","right":"B","into":"C","cell":[1,1],"at":"row","write":"is"}`: row 1 of A and column 1 of B glow gold together, the products are written in the margin, the sum lands in C's cell on the `write` word. One beat per entry; `"rest": true` fills the remaining entries at pace. `--dry` refuses incompatible dimensions and reports the result's.
- `{"do":"combine","expr":"4A+B","into":"C","cell":[1,2]}`: the matching entries glow, the arithmetic is written, the result lands.
- `{"do":"det","target":"A"}`: the main diagonal joined in blue, the other in rust, the two products and the minus written; `det A = ...` on the board.
- `{"do":"inverse","target":"A","into":"Ai"}`: a copy appears; the diagonal entries slide past each other; the off-diagonal entries flash rust as their signs flip; 1 over the determinant writes in front.
- A vector is the same component with one column, so AX = B reads as one picture. Columns of a map matrix can be lifted into the map figure (4.3) with `{"do":"as-arrows","target":"M","in":"mp"}`.
- The problem card must hold two-row bracket choices; `--dry` should report a pill that cannot.

### 4.3 `map`: the plane under a 2 × 2 matrix

```json
{ "id": "mp", "map": true, "unit": true, "grid": true, "curl": true,
  "shapes": [{ "id": "T", "poly": [[1, 1], [3, 1], [1, 3]], "ink": "accent" }], "points": { "P": [3, -1] } }
```

- Draws axes, a faint grid, the unit square with its east edge a blue arrow labeled ⟨1, 0⟩ and north edge a rust arrow labeled ⟨0, 1⟩, a counterclockwise curl inside, the shapes and points.
- `{"do":"apply","target":"mp","matrix":[[-2,4],[4,2]],"at":"lands","dur":3}`: every grid line, the square, the shapes and the points move linearly to their images; the east arrow lands on the first column, the north arrow on the second; pre-images stay as muted ghosts; the square becomes the gold parallelogram; `"area": true` counts its label from 1 to |det|; the curl reverses when det < 0. `{"do":"undo"}` plays it back. A matrix with determinant zero squashes to a segment, and `"mark":["P","Q"]` shows two points landing together.
- `{"do":"copies","target":"mp","of":"P"}`: from the origin, x copies of the blue column, then y copies of the rust column, walk tip to tail to P's image; negative counts walk backwards.
- `twin: true`: two planes side by side with the same square, each taking its own `apply` sequence, for AB against BA and (AB)C against A(BC).
- Anchors `{"anchor":["mp","image:P"]}` and `["mp","col:1"]` for labels.

### 4.4 `path`: parametric motion

```json
{ "id": "d", "path": { "x": "2+t", "y": "1-4t" }, "t": [0, 3], "clock": true, "velocity": true, "stamps": 1, "trace": true }
```

- A dot at (x(t), y(t)) with a `t = @t` label and a pinned position readout. `{"do":"run","target":"d","to":2,"dur":4}` moves it, leaving a teal trace; `velocity: true` draws the velocity arrow from the start with legs; `stamps: 1` stamps a ghost copy every whole unit of t. `{"do":"run","until":"x=0"}` runs to a coordinate condition (the time an event happens).
- `path: {"x": "5cos(t)-3", "y": "5sin(t)-3"}` reuses the turning point: a center dot and a radius arrow that turns; a parabola traces its curve. Expressions follow `plot`'s grammar (`5cos(t)`, no implied product).

### 4.5 `dim` for choices

`{"do":"dim","choices":[0,3]}`: the named choices fade to muted together in one beat, with the one reason said aloud. Shared with every multiple-choice family; unbuilt.

### Build order

1. **4.1 and 4.5** first: they unlock `vector-components`, `fl-vector-dot-product`, `fl-vector-angle`, `vector-resultant` and the velocity arrow of `parametric-linear-motion`, five of twelve types, and `dim` serves every family.
2. **4.4**, small, finishes the two parametric types.
3. **4.2** unlocks the bookkeeping of all five matrix types.
4. **4.3** is the family's crown and the one with the most motion to design; it makes `matrix-transformation`, the why beats of `matrix-inverse-determinant` and the counterexample of `matrix-laws`.

---

## 5. Which lessons need the strongest writer, and the seam

The curriculum's rule holds here: a lesson whose insight is a motion that proves, or whose type teaches reading, stays with the top writer; a one-method type with the concept written and the kit complete can go to a capable cheaper model after a blind test, with a reviewer at least as strong as the writer and an independent reviewer watching every lesson of the first wave.

**Strongest writer.**
- `matrix-transformation`: the screenplay is the design. Columns as landing spots, the walk of copies, the area count, the curl; three asks that must each become one reading of the map.
- `matrix-inverse-determinant`: the squash and the undo are what make the formula make sense; the det-zero-at-a-glance fast way must be staged, not described.
- `matrix-laws`: a "which statement holds" type. The quality is in the reasoning: tracing each false identity to a hidden swap, staging the counterexample on twin planes, and saying why regrouping and splitting survive. Nothing a checker can verify.
- `vector-resultant`: a mixed modeling type in three stories, where the whole skill is reading which quantity is the hypotenuse and which leg the angle opens from. Do not force these stories into one recipe.
- `parametric-linear-motion`: five asks under one name; the lesson must make "start plus t copies of the velocity" so vivid that position, path, speed, time and direction are each a glance at the same arrow.

**A capable cheaper model, from the concept and the finished kit.**
- `vector-components`: slot by slot, then the hypotenuse; the legs do the teaching. Several cases, one method.
- `fl-vector-dot-product` and `fl-vector-angle`: one formula each, the tail-to-tail picture, a classification the concept spells out. The "neither" case needs care; the concept must state both tests and their order.
- `matrix-operations`: the row-and-column glow is a named kit action; the dimension rule is one picture; pace is the only craft.
- `matrix-linear-system`: algorithmic once the inverse film exists; the check (substitute) is mechanical.
- `matrix-data-reading`: a short table-reading lesson on an existing kit; vocabulary-level.
- `parametric-rectangular-convert`: three algebra cases, each one substitution, with the t = 0 check as the rule-out; the circle case leans on an owned identity.

Require a complete concept, a fitting kit, and independent review. Test writing assignments with identical briefs, one lesson per session, anonymized rendered films, and independent blind rankings. Accept an assignment only if every sample meets the teaching requirements.

---

## 6. Misfiled, badly conceived or off grade; clauses never practiced

> Flagging a type here never means the app should drop it; it means the lesson design should not inherit the fault, or the catalog should be aligned.

**Problem types.**
- `fl-vector-dot-product` and `fl-vector-angle` are filed under HSN.VM.A.1, A.2, B.4 and B.5, none of which mentions the dot product or the angle between vectors. They serve the Florida precalculus benchmarks they were written for (the `fl-` prefix) and should be linked to those, not to HSN.VM.
- `vector-resultant` only ever combines two perpendicular quantities, so it is right-triangle trigonometry in a vector costume (HSG.SRT.C.8, 8.G.B.7), below precalculus; the precalculus content, HSN.VM.B.4b, is never generated (next list). Keep it; its correct primary is HSN.VM.A.3.
- `vector-components` bundles four standards (A.1, A.2, B.4, B.5) and at least four cases. One lesson can carry it as "slot by slot, then the hypotenuse" plus quick cases, but it is the family's longest; a split into components-and-magnitude and vector-arithmetic would be cleaner.
- `parametric-models` has no linked standard; parametric equations are not in Common Core but are standard precalculus in state courses. Link `parametric-linear-motion` to HSN.VM.A.3 (velocity) and record `parametric-rectangular-convert` as beyond-CCSS state content; HSA.CED.A.2 is a stretch for it.
- `matrix-operations` generates 3 × 3 scalar sums (eighteen operations, no idea) as readily as 2 × 2 products (the idea). The lesson's main example must be a product; the 3 × 3 case is stamina and gets one entry worked and the rest at pace.
- `matrix-linear-system` has a variant that hands over A⁻¹ and B without A, so the answer cannot be checked in the system; the lesson's check there is a careful second multiplication. Also confirm in `facts.ts` whether any variant asks the learner to *write* A from the equations (HSA.REI.C.8); the sample hands A over.
- `matrix-data-reading` is table reading from grade 7 wearing brackets; a (+) standard owns it, so it stays, short.
- `matrix-transformation`'s 8 × 20 = 160 case is too large to draw to scale on a card; the worked example uses a small determinant and this case is a board variant.

**Standards clauses the problems never practice** (exact text).
- HSN.VM.A.1: "Recognize vector quantities as having both magnitude and direction" and "use appropriate symbols for vectors and their magnitudes (e.g., v, |v|, ||v||, v)": no item asks whether a quantity is a vector, and only one notation is ever used.
- HSN.VM.B.4a: "by the parallelogram rule" and "Understand that the magnitude of a sum of two vectors is typically not the sum of the magnitudes": never drawn, never asked. The lessons show both anyway (one beat each).
- HSN.VM.B.4b: "Given two vectors in magnitude and direction form, determine the magnitude and direction of their sum": no vector is ever given in magnitude-and-direction form, so resolving into components and the non-perpendicular sum (law of cosines) never appear. This is the family's biggest gap and the real precalculus content of `vector-modeling`.
- HSN.VM.B.4c: "Represent vector subtraction graphically by connecting the tips in the appropriate order": never asked graphically.
- HSN.VM.B.5b: "the direction of cv is either along v (for c > 0) or against v (for c < 0)": |−2**v**| is asked; the reversal never.
- HSN.VM.C.6: "manipulate data" and "incidence relationships in a network": only reading, only stock tables.
- HSN.VM.C.7: "as when all the payoffs in a game are doubled": scaling appears only as abstract 4A; a scaled data matrix would tie C.6 and C.7 together.
- HSN.VM.C.8: "subtract": the type's description lists add, scale and multiply; confirm in `facts.ts` that A − B is generated.
- HSN.VM.C.10: "the zero and identity matrices play a role ... similar to the role of 0 and 1": the identity appears in `matrix-laws`; the zero matrix never.
- HSA.REI.C.9: "using technology for matrices of dimension 3 × 3 or greater": only 2 × 2 systems, which is fine for a film.

---

## 7. The pilot

Five types, covering every new tool, every foundation, every kind of question (open answer, multiple choice with pairs, with matrices, with sentences), and both voices the family needs (one method; mixed reading).

| # | Problem type | Why it is in the pilot |
|---|---|---|
| 1 | `vector-components` | The picture is born here: the move, the two legs, the pair, tip to tail, the stretch, length as the hypotenuse. Exercises `vector` legs, `copy`, `scale`, `negate`, `dim`. If this is not beautiful, nothing after it will be. |
| 2 | `vector-resultant` | The modeling type and the reading problem (which quantity is the hypotenuse, which leg the angle opens from), on the same kit, at true scale in hundreds. Tests whether the family's mixed voice holds at precalculus. |
| 3 | `parametric-linear-motion` | Vectors with a clock: five asks made into one picture. Exercises `path`. The sharpest test of "foundation is the whole lesson". |
| 4 | `matrix-transformation` | The family's big idea: the columns are where east and north land; the walk of copies; the area as the determinant. Exercises `map` and the colored-column `matrix`, and makes the next lesson's formulas meaningful. |
| 5 | `matrix-inverse-determinant` | The squash, the undo, the cross and swap-negate-divide; det zero at a glance from proportional rows; matrix choices ruled out by one entry. Completes `matrix` and `map`. |

If the five land, the next wave is `matrix-operations` (the row-and-column glow and the dimension rule), `matrix-linear-system`, `matrix-laws` (twin planes), `fl-vector-dot-product` and `fl-vector-angle` (swing and close), `parametric-rectangular-convert`, and `matrix-data-reading`, which complete the family.
