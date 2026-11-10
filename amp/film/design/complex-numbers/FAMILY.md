# Complex numbers, Algebra 2 to precalculus: family design

Four skills, nine problem types, every one of them multiple choice. Planning snapshot: `src/curriculum/catalog.ts`, the engine templates and `film/facts.ts`, snapshot 2026-11-09. The reference screenplay `complex-plane-forms` supplies the visual conventions; this design adopts its arrows and colors and says where its type should be split.

Nothing here is a rule list. It is one fact, one picture that grows from a dial into a plane, and the habits a learner needs to read these problems and know the answer is right.

---

## 1. The idea underneath the whole family

Everything is one fact and what follows from it: **i² = −1.**

On the real line no square is negative: a square is smallest when it is zero (family 15's line; the parabola y = x² never dips below the axis). So x² = −1 has no solution on the line, and we make one. The picture that makes i sensible instead of a decree: multiplying by −1 is a half-turn about 0 (family 3: zero is the mirror; 3 goes to −3, the other side). A number that does that in two equal steps makes a quarter turn each time. A quarter turn from 1 lands nowhere on the line: it lands straight up. That is where i lives, and once i has a place every a + bi has one: a to the right, b up. The complex numbers are a plane.

After that, the whole family is reading the plane. In algebra, i is a letter until it is squared. Four quarter turns come home, so the powers of i cycle. A quadratic whose graph misses the axis has roots that leave the line as a mirror pair. Adding slides; z − w is the arrow from w to z; the conjugate is the mirror; length is Pythagoras; multiplying turns and stretches. A learner who owns "times i is a quarter turn" owns the family.

### The foundations, in the order they are built

1. **No real square is negative, so i is new.** (A2) Define i by i² = −1 (the standard's words), never as "the square root of −1": √a · √b = √(ab) fails for two negatives, and the lesson must not plant it. Then √(−36) = √36 · √(−1) = 6i: the minus under the root comes out as i. A complex number is a + bi with a and b real; the real part is a, the imaginary part is **b, a real number** (the imaginary part of 9 − 6i is −6, not −6i). Takes from family 15 (a square is smallest when zero) and family 3 (−1 as the mirror).

2. **i is a letter until it is squared.** (A2) Adding and subtracting is collecting like terms; multiplying is the four parts of two binomials; the one new move is that wherever i² appears you write −1. So (a + bi)(c + di) has real part ac − bd (the minus is the i² corner) and imaginary part ad + bc. Takes from family 12 (like terms, the distributive property in four parts).

3. **Times i is a quarter turn, so four of them come home.** (A2) Half-turn is ×(−1); i does it in two equal steps, so ×i is a quarter turn counterclockwise: 1 → i → −1 → −i → 1. i⁴ = 1, and i^(4k + r) = (i⁴)^k · i^r = i^r: the remainder after fours decides. The plane is born here as a picture. Takes from family 4 (an exponent counts factors; the laws of exponents).

4. **A quadratic that misses the axis has a mirror pair of roots.** (A2) Completing the square gives (x − p)² = −q with q > 0, which no real x can satisfy; x − p = ±i√q. The formula says the same: real part −b/2a (the axis of symmetry), imaginary part ±√(−D)/2a. The two roots are mirror images across the real axis: a conjugate pair. Takes from family 15 (completing the square, the formula, the discriminant, the vertex and axis of symmetry).

5. **A number times its mirror lands on the real line.** (A2 for the pair; PC as a tool) (a + bi)(a − bi) = a² + b²: real, positive, and the length squared. Reverse of foundation 4: a pair p ± i√q is the roots of (x − p)² + q = x² − 2px + (p² + q). In precalculus the same fact is how you divide: multiply top and bottom by the conjugate of the bottom so the bottom is real.

6. **a right, b up: the plane.** (PC) a + bi is the point (a, b) and the arrow from 0 to it; its length |z| = √(a² + b²) is the hypotenuse of the triangle under the arrow. Adding is tip to tail (the parallelogram); z − w is the arrow from w to z. Takes from family 13 (the plane), family 27 (distance as a hypotenuse). Shares the arrow picture with family 31; whichever the learner meets first defines it, and they must agree.

7. **Distance is the length of the arrow between; midpoint is the average.** (PC) |z − w| is the distance; (z + w)/2 the midpoint; a missing endpoint is 2M − z; |z − w| = r is the circle of all numbers at distance r from w. Takes from family 27 (the circle as all points at one distance; midpoint as the average of coordinates).

8. **Multiply: lengths multiply, angles add.** (PC) Polar form r(cos θ + i sin θ) names the same point by its length and angle (angle from the positive real axis, counterclockwise). Multiplying by w turns by w's angle and stretches by |w|. This closes the loop: i is the case r = 1, θ = 90°, which is why foundation 3 was true; the conjugate reverses the angle, which is why foundation 5 lands on the real line. Takes from families 28 and 30 (degrees and radians, special right triangles, cosine and sine as coordinates, reference angles by quadrant), family 26 (turn, flip, dilation).

**Gives to:** family 18 (nonreal zeros come in conjugate pairs; complex factorization; the fundamental theorem), family 30 (polar coordinates), family 31 (vectors as arrows; the parallelogram rule).

**Register by grade.** In Algebra 2 the plane is a picture for definitions and sense: the dial for i, the mirror pair for quadratics, "a conjugate pair multiplies to a positive real" as a check. The computation is on the board. In precalculus the plane becomes the method: the arrows are the lesson. The design says this so no one forces polar reasoning into an A2 film or FOILs through a PC one.

---

## 2. The visual language: one plane, arrows from 0, and a dial that becomes it

A precalculus learner looking at an arrow in the complex plane must recognize the dial from Algebra 2: the compass points 1, i, −1, −i are still there, and only the number of positions has grown. Everything is to scale, labeled, and sketchable on scratch paper.

### The elements

| Element | Drawn as | Means |
|---|---|---|
| **the plane** | axes with equal scales (never stretched); "real" written at the right end, "imaginary" at the top; ticks every 1; imaginary ticks read i, 2i, 3i, −i in the lesson's own plane (plain numbers when the app's figure is used, and the lesson says once "a height of 3 is 3i"); origin labeled 0, set to the southwest so arrow tails never cover it | every complex number is one point |
| **a number z** | a dot and the arrow from 0 to it, teal; its label a + bi beside the tip, clear of the axes | a point when we read where it is; an arrow when we add, subtract or multiply |
| **a second number w** | the same, violet | |
| **the components** | the right triangle under the arrow: blue leg a along the real direction from the tail, rust leg b up from (a, 0); labels carry the signed values when reading parts, the lengths when finding a modulus | a right, b up |
| **the length** | the arrow's label |z| on its hypotenuse, teal | modulus |
| **the angle** | an arc at 0 from the positive real direction counterclockwise to the arrow, gold when it is what is asked, otherwise the number's ink; radians, with degrees said once | argument |
| **the mirror** | the real axis as the mirror line; z̄ a dashed arrow in z's ink, the dot filled | conjugate |
| **the dial** | the unit circle with 1, i, −1, −i at its compass points and a unit arrow that turns in quarter steps; the exponent counted at the tip: i¹, i², i³, i⁴ | powers of i |
| **the box** | a 2 × 2 table: the terms of one factor down the side, the other's along the top; real cells blue, imaginary cells rust; the i² cell rewrites to its real value | a product sorted into its two parts |
| **the parabola** | the x–y graph (not the complex plane) of y = ax² + bx + c floating clear of the x axis; its axis of symmetry dashed at x = −b/2a; the vertex marked with its height | why there are no real solutions |
| **the circle** |z − w| = r | the circle centered at w's dot with one radius drawn as an arrow from w, labeled r | all the numbers at one distance from w |

The box is a table, never an area: i has no length to draw as a side, so the lesson never calls it area, and no bar or square ever stands for i. The parabola lives in the x–y plane and the roots live in the complex plane; when a lesson shows both it says the handoff aloud, once: "This graph has an x axis and a y axis. The solutions are not on it anywhere. They live in the complex plane, one above and one below five."

### Color means one thing each

- **teal** (accent): the number z, its arrow, its dot, its length.
- **violet**: a second number w.
- **blue**: real parts: the horizontal leg, the real cells of the box, the real terms on the board when parts are being collected.
- **rust**: imaginary parts: the vertical leg, the imaginary cells, the imaginary terms when collected.
- **gold**: the one thing being asked or looked at right now: the word in the problem that says what is asked ("exact", "all solutions", "from Q to P", "radius"), the angle in a polar problem, the deciding term, the answer arrow when it appears. One gold thing at a time.
- **muted**: dimmed choices, a slid copy's ghost, placeholder lines.

Use real blue, imaginary rust, lengths teal, and polar angles gold, matching `complex-plane-forms`. Consistent colors help the learner distinguish the quantities.

### The motions (each one proves a foundation)

- **Half-turn, then quarter turn** (1): the unit arrow at 1 turns a half-turn to −1 on "times negative one". Back at 1, it turns a quarter to i, then a quarter more to −1: "i times i is negative one." The learner watches i² = −1 happen.
- **Quarter turns counted** (3): the dial's arrow keeps turning, one quarter per spoken power; compass labels light as it passes; after four it is home. For i²⁰ the arrow spins five times and stops at 1; the board writes 20 = 4 · 5 + 0 as it does.
- **The box fills and sorts** (2): cells fill on the words; the i² cell rewrites (−25i² becomes +25) on "i squared is negative one"; the blue cells collect into the real part on the board, the rust cells into the imaginary part.
- **The parabola misses, the pair appears** (4): the parabola is drawn and does not touch the axis; the dashed axis of symmetry drops at −b/2a; the vertex's height is read; the board writes (x − p)² = −q from it. Then the complex plane: p on the real axis, the dashed line carried over, the two roots dropping onto it above and below at ±√q.
- **Mirror** (5): z flips across the real axis to z̄; its angle arc reverses. Then z turns by the reversed angle and stretches: it lands on the real axis at a² + b². "A number times its mirror lands on the real line."
- **Tip to tail** (6): a copy of w slides until its tail sits on z's tip; the sum arrow from 0 appears gold; the copy's tip reads its position live. Slide a copy of z onto w's tip too and the parallelogram is drawn: the fourth vertex is the sum.
- **The arrow between** (6, 7): the arrow from w to z is drawn gold ("to minus from"); a copy slides back to 0 to read z − w; the triangle under it gives its length, and that length is the distance.
- **Turn and stretch** (8): z turns by w's angle (w's arc stacks on z's arc at 0) and stretches by |w|; the product lands. Special cases on the same figure: ×i turns a quarter with no stretch; ×(−1) a half; × a real stretches only.
- **Dim** (every type): the choices that cannot be right fade together, in one beat, with the one reason said aloud. Never struck one by one.

### The board

Standard form always reads a + bi, real part first. When parts are being collected, real terms are blue and imaginary terms rust on the board, matching the box and the legs; otherwise plain ink. Roots are written with i outside the radical in the app's own form (i√59, √5 i as the problem writes it). The quadratic formula is written line by line, the discriminant on its own line so a negative one is seen before the root is taken.

---

## 3. How lessons in this family should go

Every film builds the same habit: read, know what the answer must look like before working, take the sure fast way, check the size, check the answer, and for choices dim the nonsense with one reason.

### The opening

Every Algebra 2 film except the quadratics opens with the same fifteen seconds, drawn live: the half-turn of ×(−1), the quarter turn of ×i, the four compass points, "a complex number is a + bi: a right, b up." The quadratics films open on the parabola instead ("no real square is negative") and name i in one line. Every precalculus film opens on the plane with one arrow and its triangle: "a right, b up: a point, and the arrow from 0 to it." A lesson never re-teaches a foundation; it names it and shows the owned picture.

### Read

The asked word goes gold, and one beat says what the answer must look like.
- "Exact": roots and i stay; no decimals.
- "Over the complex numbers", "all solutions": two solutions, written p ± qi.
- "In the form a + bi": real part first, then the i term; a plain real number is still a complex number with imaginary part 0.
- "|z|", "modulus", "distance": a length; a nonnegative real with no i.
- "Conjugate": the sign of the imaginary part only.
- "The arrow from Q to P": P minus Q. To minus from.
- "A fourth vertex opposite O": the sum.
- "|z − w| = r": the center is what z is compared with, read exactly as written inside the bars; the radius is r, not r².
- "Polar form with 0 ≤ θ < 2π": the quadrant of the point fixes which of the four candidate angles.

### At a glance

- A product: the real part is ac − bd, the imaginary ad + bc. A conjugate pair multiplies to a² + b²: real, positive, no work.
- A power of i: the remainder after fours (0 → 1, 1 → i, 2 → −1, 3 → −i).
- A quadratic with D < 0: the real part is −b/2a and it is a pair with ±; if D is negative, there is an i.
- A quotient: the bottom becomes c² + d², a whole number; the answer's length is |z|/|w|.
- A modulus: look for a Pythagorean triple (3-4-5, 5-12-13, 8-15-17, 7-24-25) or the 1-1-√2 and 1-√3-2 triangles.
- A polar angle: quadrant first; three of four choices die at once.
- A distance: the hypotenuse is longer than the longer leg and shorter than the two legs added.

### The sure fast ways (each always works)

- Multiply: the box once to see where the minus comes from, then "two parts" as the method.
- Powers of i: remainder after fours, read off the dial.
- Roots of negatives: pull the i out first (√(−n) = i√n), then root the positive number.
- Quadratics: complete the square when a = 1 and b is even (read p and q straight off the vertex); the formula otherwise, with the equation in = 0 form first.
- Equation from a pair p ± qi: x² − 2px + (p² + q²) = 0.
- Divide: multiply top and bottom by the conjugate of the bottom; the bottom is c² + d².
- Modulus and distance: the triangle; √(a² + b²).
- Polar: quadrant, then the reference angle from the special triangle. Never tan⁻¹ alone: it lands in the wrong quadrant half the time, so it is never taught as the method.
- Sum and difference: component-wise; the picture confirms.
- Midpoint: average. Missing endpoint: twice the midpoint minus the known end.
- Circle: read w and r off |z − w| = r.

### Sense and check

- Products: a conjugate pair's product is positive real; angles add when the learner has the plane (−4 − 4i at 225° times 1 + i at 45° points straight down: a multiple of −i).
- Quadratics: the real part equals −b/2a, and for a monic the product p² + q² equals c; plugging one root back in is shown once, slowly, in the first lesson.
- Division: multiply the quotient by the divisor; the dividend must come back.
- Modulus and distance: the hypotenuse bound; squaring back.
- Polar: convert back: r cos θ and r sin θ must give a and b.
- Midpoint: the midpoint is the same distance from both ends.
- Circle: center + r must satisfy the equation.

### Rule out (the decoys are the misconceptions, so name them)

- No i where D < 0 or where a negative is under the root: gone.
- Wrong real part (not −b/2a) or wrong denominator (a instead of 2a): gone, two at once.
- A conjugate product that is negative or has an i: gone.
- A modulus with no root (169), with an i, or negative: gone.
- A polar angle in the wrong quadrant: three gone at once.
- A quotient longer than |z|/|w| (the 13 forgotten) or termwise (−16/3 − i): gone.
- A distance shorter than a leg or longer than the legs' sum: gone.
- A radius that is r²: gone. A center with its signs flipped from what is written: gone.
- An arrow read backwards (Q − P): gone, because the gold arrow points the other way.

### The misconceptions (what learners actually do)

- i² treated as +1 or left as i²: (2 − 5i)(2 + 5i) = 4 − 25 = −21.
- √(−36) written as −6, 6, or 36i; 9 − √(−36) collapsed to 3.
- The imaginary part of 9 − 6i given as −6i or 6.
- "Even power of i is −1"; or 20 ÷ 4 = 5 so i²⁰ = i⁵ = i (the quotient taken instead of the remainder).
- −3x · i¹¹ = −3x · (−i) written as −3xi: the double negative dropped. The real pile and the imaginary pile both holding x surprises them: 3x + (7x + 2)i.
- The formula run on 3x² + 5x = −7 with c = −7. −b's sign lost. Dividing by a instead of 2a. (−4 ± 8i)/2 halved on one term only: −4 ± 4i or −2 ± 8i.
- Dividing termwise; multiplying only the bottom by the conjugate (which changes the value); multiplying by the conjugate of the top; forgetting the final ÷13.
- |5 − 12i| computed as √(25 − 144) because of the minus, or left as 13i. Squares kill the sign: b² is positive whatever b is.
- The reference angle reported as the angle (π/3 for a point in the fourth quadrant); degrees and radians mixed.
- a + bi plotted at (b, a); the arrow from Q to P read as Q − P; the parallelogram's fourth vertex taken as the difference; the conjugate mirrored across the imaginary axis; ×i read as "moves it up" (a slide, not a turn).
- Distance as |z| − |w|; midpoint as the difference over 2.
- |z − (−2 + 4i)| = 3 read as center −2 − 4i or radius 9, by analogy with (x − h)² + (y − k)² = r².

### Lines worth remembering

"i is a letter until it is squared." "Times i is a quarter turn; four quarter turns, home." "The minus under the root comes out as i." "No real square is negative, so the roots leave the line as a mirror pair." "Real part: negative b over two a. Imaginary part: the root of the positive discriminant over two a." "A number times its mirror lands on the real line: a squared plus b squared." "Make the bottom real." "a right, b up." "z minus w is the arrow from w to z: to minus from." "Length is Pythagoras; distance is the length of the arrow between; midpoint is the average." "Lengths multiply, angles add." "Quadrant first, then the reference angle." "The center is as written; the radius is r, not r squared."

### Pacing

Pacing: one idea per beat, the picture after the plain words, a pause after each key idea, motions finished before the voice moves on. The dial turns one quarter per spoken power. The discriminant gets its own line and its own beat before the root is taken.

---

## 4. Tools to build

Exists: `axes`, `plot`, `dot`, `seg` (dashed, extended), `circle`, `angle`, `sweep` (the swept angle from the wave kit), `vector` (`film/vector.ts`: arrows that `draw`, `slide`, `turn`, `flip`, group with labels), points `mid`, `foot`, `on` a circle, `glide`, `move`, `view`, `table` (cells shown and highlighted singly), the board. Not yet built though specified for place value: `dim`.

### 4.1 The complex plane: `axes` with `"complex": true`

```json
{ "id": "ax", "axes": true, "complex": true, "step": 1, "every": 1, "start": true }
```
- "real" at the right end, "imaginary" at the top; imaginary tick numbers written i, 2i, 3i, −i (`"iticks": "plain"` to match the app's figure); origin labeled 0 at the southwest; equal scales enforced (`stretch` refused on this figure; `--dry` says so).
- A label `"@z"` with `of` a point writes that point as a complex number ("3 + 4i", "−2 − i", "5", "3i"), live during `slide`, `move`, `turn` and `stretch`: the slid copy's tip reads the sum as it lands.

### 4.2 `vector` additions

```json
{ "id": "z", "vector": ["O", "P"], "ink": "accent", "tex": "z", "components": true }
```
- `components: true` adds the right triangle under the arrow, shown on `show z.components`: blue leg along the real direction from the tail, rust leg up to the tip; labels carry signed values, or lengths with `"lengths": true`. Parts `z.leg.re`, `z.leg.im`, `z.hyp`.
- `{"do":"stretch","target":"z","by":2}`: scales about the tail; a `tex` on the vector ticks its length. `move` of the tip point does the same without the label; `stretch` keeps the label and the triangle in step.
- `{ "id": "th", "arg": "z", "ink": "gold", "tex": "\\theta" }`: the arc at the tail from the positive real direction counterclockwise to the vector, with its label; it follows the vector through `turn`. (`angle` with three points also draws it but needs a helper point and does not follow.)
- `{"do":"product","target":"z","by":"w","at":"turns"}`: turns z by w's angle and stretches by |w| in one motion, w's arc stacking on z's arc at 0, the `@z` readout reading the product. Sugar for `turn` plus `stretch` on one word; build last.
- The mirror is `flip` over the real axis (exists): make sure a vector's label and triangle flip with it.

### 4.3 `dial`: the quarter-turn dial for powers of i

```json
{ "id": "d", "dial": "O", "r": 3, "start": true }
```
- The unit circle drawn at radius `r` view units with 1, i, −1, −i at its compass points, a unit arrow at 1, and a tip label counting the exponent.
- `{"do":"turn","target":"d","quarters":1,"at":"i"}`: one quarter per counted word is the pattern (as `split` is for blocks); `"quarters": 5` spins five from one word; `"from": 8` starts with the arrow home and the counter at i⁸. Compass labels light as the arrow passes.
- Later serves family 30 (the unit circle at the four quadrant angles) unchanged.

### 4.4 `box`: the sorting table (extends `table`)

- `inks` per cell: `"inks": [["blue","warm"],["warm","blue"]]`.
- `{"do":"rewrite","target":"t.cell.2.2","text":"$+25$","at":"one"}`: the old text fades, the new writes, on the word.
- `highlight` over a list of cells (today one at a time), so "the two blue cells" light together while the board collects them.
- `--dry` keeps checking that each cell fits.

### 4.5 `dim` for choices (board)

`{"do":"dim","choices":[1,3],"at":"gone"}`: the named choices fade to muted together in one beat. Needed by every lesson in this family and by place value; build first.

### 4.6 Optional: two planes on one card

`axes` gains `"at"` (the origin's place in the view) so the x–y graph and the complex plane can sit side by side for the quadratics' handoff. Two shots with the handoff said aloud serve just as well; build only if the first quadratics lesson wants it.

**Build order:** `dim` → complex `axes` + `@z` + `components` + `stretch` + `arg` (unlocks `complex-plane-operations`, `complex-distance-midpoint`, and a split redo of `complex-plane-forms`) → `dial` (unlocks `complex-parts`, `powers-of-i-sum`) → `box` (unlocks `complex-multiplication`, `complex-conjugate-division`) → `product`.

---

## 5. Which lessons need the strongest writer

**Strongest writer; the screenplay is the design.**
- `complex-parts`: the family's front door. The definition of i is born here (half-turn, quarter turn, the dial), three different asks under one name (parts, powers, roots of negatives), and the convention for "imaginary part" must be stated and matched. Strong for the first version; revisions can go cheaper.
- `complex-quadratic-solve`: two directions (solve; write the equation from its roots), the handoff from the x–y graph to the complex plane, the mirror pair as a motion that proves, the reverse via "a number times its mirror". A weak writer FOILs and formulas without the why.
- `complex-plane-operations`: a mixed type (sum, difference, conjugate, product as moves) on the app's own figure, each a different act; "to minus from"; turn-and-stretch is HSN.CN.B.5 itself. Reading, not a recipe.
- Polar form, once split out of `complex-plane-forms`: quadrant-first reasoning and the "same point, two names" explanation the standard asks for.

**The seam: a capable cheaper model from a per-type concept, kit complete, strong review.**
- `complex-multiplication`: one method (the box once, then two parts); the three decoys are three named slips; the dial is the sense check.
- `powers-of-i-sum`: one method (remainder after fours, sort by color, collect); one trap (the double negative); the dial exists.
- `nonmonic-complex-quadratic`: one method once the mirror-pair lesson exists (standard form first, the formula line by line, i out of the root, 2a); −b/2a and 2a dim two choices at a glance.
- `complex-conjugate-division`: one method with one motion (the mirror lands on the real line); z z̄ is its quick case; the check is multiplying back.
- `complex-distance-midpoint`: four asks but one picture and one-line acts; the circle's two traps are named in the concept; everything is existing kit.

These are the "one-method types inside a designed family" of CURRICULUM §6: the picture is one component with named actions, the concept names the decoys, and `--dry` plus the math check catch arithmetic slips. The reviewer stays at least as strong as the writer.

---

## 6. What looks badly conceived, misfiled, or off grade; and what the standards ask that the problems never practice

**Types.**
- `complex-plane-forms` holds four different asks (read a point, modulus, sum of points, polar form). Split polar form into its own type; modulus can live with `complex-distance` (it is |z − 0|). Keep the existing screenplay available until replacement lessons cover all four asks.
- `complex-parts` holds three asks, and its powers-of-i ask overlaps `powers-of-i-sum`. Proposal: `complex-parts` keeps parts and roots of negatives (HSN.CN.A.1); single powers of i join `powers-of-i-sum` as its easy case.
- `complex-distance-midpoint` holds four asks (distance, midpoint, missing endpoint, circle). One picture carries them, but the circle is a different reading; watch the length and split the circle off if the first lesson runs long.
- The convention for "imaginary part" must be fixed in the app as b (real), per HSN.CN.A.1's "a + bi with a and b real", and the lesson must match it.
- Seeds to check in `facts.ts`: no main example with a = 0 or b = 0 where that hides the idea ((3)(2 + i), |7|, a polar form of a pure real seeded first); no `complex-quadratic-solve` seed with D ≥ 0.
- Filing and grade are right: HSN.CN.A.1, A.2, C.7 and HSA.REI.B.4 (non-plus) at Algebra 2; A.3 and B.4 to B.6 (plus standards) at precalculus. `complex-plane-operations` is correctly primary on B.5 with HSN.VM.B.4 in part.

**Standards clauses never practiced.**
- HSN.CN.A.2, "add, subtract, and multiply complex numbers": no Algebra 2 type asks (a + bi) ± (c + di) in algebraic form. Addition appears only inside `powers-of-i-sum` and as plane moves at precalculus. A missing A2 type.
- HSN.CN.A.3, "use conjugates to find moduli": z z̄ is asked as a number (5) but never as |z|² or as a route to |z|. One variant should ask it; the lesson will say it regardless.
- HSN.CN.B.4, "including real and imaginary numbers" and "explain why the rectangular and polar forms of a given complex number represent the same number": no polar variant seen is a pure real or pure imaginary (the case where blind tan⁻¹ fails outright); the explanation cannot be tested by a choice, so the lesson carries it ("same point, two ways to name it").
- HSN.CN.B.5, "use properties of this representation for computation. For example, (–1 + √3 i)³ = 8": no type computes a product or power from modulus and argument. A missing precalculus type: "find zw or zⁿ from modulus and argument."
- HSA.REI.B.4b, "by inspection (e.g., for x² = 49), taking square roots": no variant is x² + 49 = 0 or (x − 3)² = −16, the base case of the whole idea and the first one learners meet. Add it as the easy variant of `complex-quadratic-solve`.
- HSA.REI.B.4a (deriving the formula) and HSN.VM.B.4b (magnitude-and-direction sums) belong to families 15 and 31; not this family's gap.

---

## 7. The pilot

Five types, covering every foundation, every new tool, both grade bands, and the two directions of the hardest lesson. `complex-plane-forms` covers modulus, sums and polar form on the plane, so the pilot fills in around it.

| # | Problem type | Grade | Why it is in the pilot |
|---|---|---|---|
| 1 | `complex-parts` | A2 | The definition is born here: the half-turn of ×(−1), the quarter turn of ×i, the dial, "a right, b up", the imaginary part as b. If this is not clear and beautiful nothing after it will be. Exercises `dial`. |
| 2 | `complex-multiplication` | A2 | The box with the i² corner rewriting, the sort into blue and rust, "two parts" as the method; (2 − 5i)(2 + 5i) = 29 as the main example because it is the conjugate pair the quadratics and division lean on; decoys named as the three slips. Exercises `box`, `dim`. |
| 3 | `complex-quadratic-solve` | A2 | The parabola that misses, (x − 5)² = −5 read off the vertex, the root of a negative, the mirror pair on the axis of symmetry, and the reverse direction via "a number times its mirror". The deepest A2 lesson and the one standardized tests live on. |
| 4 | `complex-conjugate-division` | PC | The mirror as a motion, the product landing on the real line at a² + b², "make the bottom real", multiply back to check; z z̄ as the quick case. Exercises `flip` on vectors, `arg`, the box again. |
| 5 | `complex-plane-operations` | PC | The app's own figure; "to minus from" with the gold arrow; the parallelogram as the sum; the conjugate as the mirror; ×i as a quarter turn and ×w as turn-and-stretch, which is HSN.CN.B.5 made visible. Exercises `@z`, `components`, `stretch`, `product`. |

If the five land, the next wave is `powers-of-i-sum`, `nonmonic-complex-quadratic` and `complex-distance-midpoint`, the three seam candidates, written from their concepts by a cheaper model for the blind test, and the split redo of `complex-plane-forms` into point-and-modulus and polar form.
