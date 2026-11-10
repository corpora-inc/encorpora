# Circles, grade 7 to Algebra 2: family design

Eight skills, 23 problem types, from "how far is the center from a point on the circle" (grade 7) to "the y-coordinate of 210 degrees on the unit circle" (Algebra 2). Planning sources: the catalog and the engine's variants, and the exact text of the fifteen standards involved. This design covers the idea, the ladder, the picture, how lessons go, the kit, the seam, the alignment faults, the pilot. Per-type concepts use these foundations and pictures.

---

## 1. The idea underneath the whole family

A circle is the simplest shape there is: **every point one distance from one center.** Everything in this family is that sentence, read three ways.

- **Every radius is equal.** So two radii and a chord make an isosceles triangle; the radius to a tangent point is the shortest way from the center to that line, so it meets the tangent at a right angle; the two tangents from an outside point are equal; a center is wherever equal distances meet.
- **Every circle is every other circle, scaled.** So "around divided by across" is one number for all of them (pi), arc length grows with the radius, "arc divided by radius" is a measure of the angle that belongs to no particular circle (the radian), and one circle of radius 1 is enough to read every angle (the unit circle).
- **An angle at the center owns a fraction of the turn, and the same fraction of the rim and of the disk.** A quarter turn cuts a quarter of the circumference and a quarter of the area. Seen from the rim instead of the center, the same arc looks half as wide: that one fact (inscribed is half of central) gives the semicircle's right angle and the inscribed quadrilateral's supplementary corners.

A student who sketches the circle with its center, one radius and the angle in question has drawn the sentence. The rest is reading.

### The foundations ladder

In the order they are built. Each later lesson names the ones it stands on in one line and shows the owned picture; it never re-teaches them. In brackets: what the foundation takes from another family.

1. **A circle is every point one radius from the center.** (Grade 7) Center, radius, diameter (two radii in a line through the center), circumference (the distance around). The distance from the center to *any* point on the circle is the radius; a diameter or a circumference is just a radius in disguise. [Length and "distance around" from family 19.]

2. **All circles are the same shape, so around ÷ across is one number: pi.** (Grade 7) Unroll the rim and lay the diameter along it: three diameters and a bit, for every circle, big or small. C ÷ d = π ≈ 3.14, so C = πd = 2πr. "A bit more than three" is the sense check for life. [Ratio from family 10.]

3. **The area is half the rim times the radius.** (Grade 7) Cut the disk into wedges and lay them head to tail: a near-rectangle of height r and width half the circumference, πr. So A = πr · r = πr²: a bit more than three squares on the radius. This is 7.G.B.4's "informal derivation of the relationship between the circumference and area", and it is taught before any problem uses the formula. [Area of a rectangle from family 24.]

4. **A central angle is a fraction of the turn; its arc and its sector are the same fraction of the rim and of the disk.** (Geometry) 360° is the whole turn. Arc = (θ/360) · 2πr; sector = (θ/360) · πr². Fraction first, then "of" the whole. [Degrees as a fraction of a turn from family 23; fraction of a quantity from family 9.]

5. **Two radii make an isosceles triangle.** (Geometry) Equal radii, equal base angles; the apex angle is the central angle. The one triangle fact the whole family leans on. [Isosceles base angles and the 180° sum from families 23 and 29.]

6. **A radius meets its tangent at a right angle.** (Geometry) The tangent point is the closest point of the tangent line to the center (every other point on the line is outside the circle, farther than r), and the shortest segment from a point to a line is perpendicular. So center, tangent point and outside point make a right triangle whose hypotenuse is center-to-outside-point, and the two tangents from one outside point are equal. [Pythagoras from family 27; perpendicular slopes from family 14 for the one coordinate case.]

7. **From the rim, an arc looks half as wide as from the center.** (Geometry) An inscribed angle is half the central angle on the same arc. Proof-picture: with one side through the center, triangle (center, vertex, far point) is isosceles (5), and the central angle is its exterior angle, so it is twice the base angle. Consequences, each one beat: an angle in a semicircle is a right angle (half of 180); angles on the same arc are equal; opposite angles of a quadrilateral inscribed in a circle add to 180 (their arcs together make the whole circle). [Exterior angle of a triangle from family 29.]

8. **From an outside point, piece times whole is the same along every line through the circle.** (Geometry) Two secants from P: PA · PB = PC · PD, where each product is the near piece times the *whole* segment to the far point; a tangent is a secant whose two points have merged, so PT · PT. Why: the two triangles share the angle at P and have equal inscribed angles on the same arc (7), so they are similar and the ratios cross-multiply. [Similar triangles from family 26.]

9. **A center is where equal distances meet.** (Geometry) A circle *through* three corners needs a center the same distance from each corner: the perpendicular bisectors (each is all the points equidistant from two corners). A circle *touching* three sides needs a center the same distance from each side: the angle bisectors. A regular polygon's corners cut the turn into 360/n equal central angles; at 60° the radii and the side make an equilateral triangle, so a hexagon's side *is* the radius and the compass steps around; a square is two perpendicular diameters; an equilateral triangle is every other hexagon corner. [Perpendicular bisector and angle bisector constructions from family 29.]

10. **The dilation that proves foundation 2.** (Geometry) Slide one center onto the other, then scale by r₂/r₁; the small circle lands on the big one. Lengths (radius, circumference, arc) multiply by the scale factor; areas by its square. The lesson says, once, that this is why pi was one number in grade 7. [Dilation and rigid motions from family 26.]

11. **A radian is one radius of arc.** (Algebra 2) Lay the radius along the rim; the angle it spans is one radian, about 57°. Angle = arc ÷ radius, so it does not depend on the circle. The rim is 2π radii long (foundation 2), so a full turn is 2π radians and a half turn is π. Converting is one question: *what fraction of a half turn is it?* That fraction of π; that fraction of 180. With time, speed along the rim is radius times turning speed: v = rω, s = rθ. [Unit rate from family 10.]

12. **Standard position and the unit circle.** (Algebra 2) Start at three o'clock; counterclockwise is positive, clockwise negative; whole turns land you where you started, so they do not count; the reference angle is the acute angle from where you landed to the x-axis. On the circle of radius 1 the arc *is* the angle, and the landing point is (cos θ, sin θ): drop a perpendicular to the x-axis, read the legs from the 30-60-90 or 45-45-90 triangle, and let the quadrant set the signs. This is the last picture of this family and the first picture of family 30, which turns it into the wave. [Four quadrants from family 13; negatives as direction from family 3; special right triangles from family 30.]

Everything to define, by grade: grade 7, circle, center, radius, diameter, circumference, pi, area (of the disk). Geometry, arc, sector, central angle, chord, tangent (touches at exactly one point), secant (cuts at two), inscribed angle (vertex on the circle), intercepted arc, inscribed (cyclic) quadrilateral, circumscribed and inscribed circles and their centers, regular polygon, scale factor. Algebra 2, radian, standard position, initial and terminal side, coterminal, reference angle, unit circle. Each lesson defines only what its problem uses, in the beat where the word first appears.

---

## 2. The visual language

One picture system from grade 7 to Algebra 2: **a circle drawn with its center and one radius, to scale, with the angle in question at the center.** A ninth grader looking at a sector must recognize the circle, center and radius of the grade 7 pi lesson; an Algebra 2 student looking at the unit circle must recognize the sector fan of the geometry lessons with the radius set to 1.

### The shapes

| Shape | Drawn as | Means |
|---|---|---|
| **circle** | a teal ring, center dot labeled O, one radius drawn and labeled r (or the diameter when the problem gives d) | the circle of the problem, never without its center |
| **sector (fan)** | a gold wedge from the radius at three o'clock, counterclockwise, with a live degree readout at the center | the angle, as a fraction of the turn |
| **arc** | the rust stretch of rim on the fan's edge, labeled with its length when the problem gives or asks one | a length along the rim |
| **unrolled rim** | a rust straight line laid under the circle, exactly as long as the rim | the circumference (or an arc) as a number line |
| **wedge strip** | the disk cut into 8, 16, then 32 gold wedges, interleaved into a near-rectangle beside the circle, height r, width πr | the area derivation |
| **radii triangle** | two teal radii with equal-length ticks and a blue chord | foundation 5 |
| **tangent triangle** | blue tangent line, teal radius to T with a right-angle mark, blue segment from the center to the outside point as hypotenuse | foundation 6 |
| **inscribed angle with its central twin** | the gold fan at the center and a smaller gold fan at a vertex on the rim, both on the same rust arc, both with readouts | foundation 7 |
| **unit circle** | axes, the circle of radius 1, a gold fan from three o'clock, the terminal point, a dropped perpendicular; the triangle's legs blue (x) and rust (y), hypotenuse teal = 1 | foundation 12; the same figure the sine lesson already draws |

The scale is never faked. A 150° angle is drawn at 150°. A circle of radius 8 beside one of radius 4 is twice as wide. The hexagon's sides are visibly as long as the radii. The unrolled rim is exactly three diameters and a bit; nothing is shortened to fit.

### Color means one thing each

- **teal**: the circle, its center, and every radius; anything that *is* a radius (the two halves of a diameter, a hexagon's side, the unit circle's hypotenuse of length 1) is teal, so "these are equal" is seen before it is said.
- **gold**: the angle being looked at, as a fan at its vertex, and the word in the question that says what is asked ("circumference", "sector", "reference angle", "y-coordinate"). One gold thing at a time.
- **rust**: a length along the rim: the circumference as it unrolls, an arc, the radius bent along the arc for a radian; on the unit circle, the height (y-leg), as in the sine and complex-plane lessons this family hands to.
- **blue**: straight lines that are not radii: chord, tangent, secant, and the x-leg on the unit circle.
- **muted**: compass arcs and other construction marks, a second circle before it is mapped, ruled-out choices, the dimmed board during a recap.

### The motions (each one proves a foundation)

- **Unroll** (pi): the rim peels off the circle from the bottom point and lays flat as a rust line. The teal diameter lifts and is laid along it: one, two, three copies, and a short stub left over, labeled "a bit: 0.14". Do it on a second circle twice the size: three and the same bit. Foundation 2.
- **Wedges** (area): the disk is cut into 8 gold wedges; alternate wedges lift, turn, and interleave into a bumpy strip; cut again to 16, then 32, and the strip flattens into a rectangle. A teal dim marks its height r; a rust dim along the top reads "half the rim: πr". Foundation 3.
- **Fan** (fraction of the turn): the gold sector opens from the radius counterclockwise while the degree readout counts; it stops, and a fraction label appears beside it ("225/360 = 5/8"); the rim it covers lights rust ("the arc is 5/8 of the rim"), then the wedge pulses ("the sector is 5/8 of the disk"). Foundation 4. The same fan, continued past 360° as a coil and run clockwise for negatives, is standard position (foundation 12).
- **Slide the vertex** (inscribed angle): with the central angle's fan at O and its readout fixed, a vertex P glides along the rest of the rim; the inscribed fan at P changes shape but its readout never leaves half the central value. P stops where one side passes through O; the isosceles radii triangle is marked; "exterior angle equals the two far angles" is written; the half is proved. Slide the two far points apart until the chord is a diameter: the readout says 90. Foundation 7.
- **Touch** (tangent): a blue line approaches the circle from outside and stops the moment it touches at T; the radius to T is drawn; a muted segment from O to another point on the line is shown and is visibly longer; the right-angle mark appears. Foundation 6.
- **Lay the radius along the arc** (radian): the teal radius lifts, bends to the rim and is laid down from three o'clock; the angle it spans goes gold with the readout "1 radian ≈ 57°". Copies follow: 2, 3, 4, 5, 6, and a bit: "2π radii in a turn". Foundation 11.
- **Step the compass** (regular polygons): a muted arc of radius r from a point on the circle marks the next point; six steps land exactly on the start; the six teal radii and sides form six equilateral triangles; "6 × 60 = 360". For the square: a diameter, its perpendicular, four corners joined. Foundation 9.
- **Meet** (centers): a point moves along the perpendicular bisector of one side with two equal teal segments to its endpoints; the second bisector is drawn; where they cross, the third segment is drawn and is equal; the circle through all three corners appears. The incenter version: equal perpendiculars to the sides along an angle bisector. Foundation 9.
- **Slide and dilate** (similarity): a second circle slides until the centers coincide, then grows about that center by r₂/r₁ until it lands on the first; a radius, the rim and the disk each show their factor (k, k, k²). Foundation 10.
- **Drop** (unit circle): from the terminal point a dashed perpendicular drops to the x-axis; the triangle fills; the reference angle at O goes gold; the legs take their special-triangle labels; the quadrant's signs are written on the legs. Foundation 12.
- **Roll** (rim speed): a wheel with a rust mark on its rim rolls along a ground line, leaving a rust trail; after θ radians the trail is exactly θ radii long, labeled rθ. Foundation 11 with time.
- **Dim** (multiple choice): the choices that cannot be right fade to muted together, in one beat, with the one reason said aloud. Never one by one.

### The board beside the picture

Every arc or sector calculation is written as **fraction × whole**, in that order, and the fraction is simplified before it multiplies: `\frac{225}{360}=\frac{5}{8}`, then `\frac{5}{8}\cdot 144\pi = 90\pi`. Every grade 7 problem writes `r = ` as its first line when the problem gave a diameter or circumference. Conversions write the fraction of a half turn: `\frac{30}{180}=\frac{1}{6}`, so `\frac{\pi}{6}`. The algebra of a cyclic quadrilateral is a plain equation on the board with the balance's margin notes, and after x is found the board goes back and writes the angle that was asked.

### The number line

The unrolled rim is a number line (P3): from 0 to πd in grade 7; from 0 to 2π, in radii, in Algebra 2, with π at the half turn. The radian scale is the same line the student met in grade 7, measured in radii instead of centimeters.

### The scratch-paper sketch

A circle, a dot in the middle, one radius labeled, and the angle at the center with its degrees. Add only what the problem has: the chord for a radii triangle; the right triangle O–T–P for a tangent; the central angle drawn in beside an inscribed one; the dropped perpendicular on the unit circle. Every lesson in this family draws that sketch first and works from it.

---

## 3. How lessons in this family should go

The five moves of the place-value design (Read, At a glance, the sure fast way, Sense, Check, plus Rule out for multiple choice) apply unchanged. What they mean here:

### Read

The first act of reading a circle problem is to find out **what was given and what it stands for.** The lesson reads the problem aloud with the asked word in gold, then one beat says what the answer must look like.

| The problem says | It means | The answer must |
|---|---|---|
| radius / diameter / circumference | one radius; two radii; 2π radii. Convert to r before anything. | end with the given units (length) or square units (area) |
| "written as aπ, give a" | the coefficient only; π is never multiplied out | be a plain number or fraction, no π in it |
| a central angle of θ° | a fraction θ/360 of the turn | arc less than the rim, sector less than the disk; more than half of each if θ > 180 |
| inscribed angle / angle on the rim | half of the central angle on the same arc | the inscribed one is the smaller |
| tangent at T | a right angle at T; center-to-outside-point is the hypotenuse | the tangent segment is shorter than center-to-point |
| chord between two points | two radii and the chord: isosceles | base angles equal; apex is the central angle |
| secant from P meets at A then B | PA is the near piece, PB the *whole* to the far point | piece × whole on one line = piece × whole on the other |
| "inscribed in a circle" (quadrilateral) | opposite corners add to 180 | answer the angle asked, not x |
| circle *through* the corners / *touching* the sides | perpendicular bisectors / angle bisectors | |
| regular n-gon inscribed | central angle 360/n | |
| "dilation maps A onto B" | scale factor = B's radius over A's | more than 1 if B is bigger |
| in radians | a fraction of a half turn, π | a small multiple of π; under π if under a half turn |
| standard position, 405°, −15π/4 | strip whole turns first; negatives go clockwise | reference angle is acute |
| x-coordinate / y-coordinate on the unit circle | cos / sin: the shadow on the floor / the height | between −1 and 1; sign from the quadrant |
| rad/s, cm/s | turning speed / rim speed; v = rω | no π appears unless revolutions are asked |

### At a glance

One beat before any work: "the distance from O to a point on the circle *is* the radius, so it is 3"; "half of 72 is 36, and the inscribed angle is the smaller one"; "225 is more than half a turn, so the sector is more than half the disk"; "210° is just past the negative x-axis, low and flat, so y is the short leg"; "600 over 50 is 12".

### The sure fast ways (each one always works)

- **Radius first.** Half the diameter; the circumference divided by 2π. Then the formula. The lesson writes `r =` on its own line every time a problem gives anything else.
- **The circumference is pi diameters.** For "C = aπ", a is the diameter: d itself, or 2r. No formula to recall.
- **Area is pi times the radius squared**, and r² of a fraction is top squared over bottom squared: (19/2)² = 361/4.
- **Fraction of the turn, times the whole.** Simplify θ/360 first; the whole is 2πr for an arc, πr² for a sector. In radians the fraction is θ/2π.
- **Half or double, and the inscribed one is smaller.** Central from inscribed: double. Inscribed from central: halve. Semicircle: 90.
- **Base angles: (180 − apex) ÷ 2.** Radius from a radii-triangle perimeter: (perimeter − chord) ÷ 2.
- **Tangent triangle: the hypotenuse is center-to-point.** Then Pythagoras. Angle at P: 90 − angle at O.
- **Piece times whole.** Set the two products equal; the unknown is the whole or the piece on one line.
- **Cyclic quadrilateral: opposite angles add to 180.** Solve, then substitute back.
- **Centroid (if it stays in this family): the short piece is a third, the long piece two thirds.**
- **360 ÷ n** for the central angle of a regular polygon.
- **Scale factor = new radius ÷ old radius**; lengths × k, areas × k². Dilate about the original center, then slide by the vector between centers.
- **What fraction of a half turn?** degrees/180 as a reduced fraction, then π; radians/π as a fraction, then 180.
- **Strip the turns, find the quadrant, drop to the x-axis.** Reference angle = the acute angle to the x-axis.
- **Reference triangle, then signs.** 30° gives 1/2 and √3/2 (1/2 is the short leg, opposite the 30); 45° gives √2/2 both. Vertical leg is y, horizontal is x; quadrant sets the signs.
- **v = rω, s = rθ.** Divide rim speed by radius for turning speed; multiply radius by radians by seconds for distance.

### Sense and rule out

Every lesson gives one size check before the answer is boxed, and for multiple choice dims the impossible choices together with one reason:

- Circumference: a bit more than three diameters. Area: a bit more than three squares on the radius. Anything far from that is wrong.
- "What happens to C ÷ d when the diameter grows?" Nothing: every circle unrolls to three and a bit. "Multiplied by 10" dims.
- An arc is shorter than the rim and a sector smaller than the disk; past 180° each is more than half.
- A tangent segment is shorter than center-to-point: 15, 24 and √306 ≈ 17.5 all dim at once when OP = 15; only 12 is left.
- An inscribed angle is smaller than its central angle; a reference angle is acute; a coordinate on the unit circle is between −1 and 1; a radian measure under a half turn is under π, and "30 radians" for 30° is nonsense since a whole turn is only about 6.28.
- A scale factor to a bigger circle is more than 1; a sum of radii (18) is not a factor; a squared ratio (121/49) is the area ratio.
- A centroid's short piece is less than half the median.
- Angular speed: 12 rad/s is about 2 turns a second; on a 50 cm wheel (rim about 314 cm) at 600 cm/s, that is right.

### Check

Multiply or substitute back: 90π ÷ 144π = 5/8 = 225/360; 36 × 2 = 72; 6² + 8² = 10²; 8 · 12 = 3 · 32; 78 + 102 = 180; (7/4) · 180 = 315; 12 rad/s × 50 cm = 600 cm/s; cos² + sin² = 1 on the unit circle ((−√3/2)² + (−1/2)² = 1). For "which construction" and "which sequence" choices, act the chosen one out on the figure and see it land.

### Realistic misconceptions, and how the picture makes each impossible

These are what students actually do on these problems; the decoys in the app's choices are mostly these, so the lesson names them.

- **Diameter used as the radius** (A = π · 19² for a 19 cm diameter), or radius used as the diameter. The lesson's `r =` line and the teal radius labeled on the figure, half the drawn diameter.
- **Arc and sector confused**: 2πr for a sector or πr² for an arc; the fraction forgotten; the square forgotten (12 for 144); θ/180 instead of θ/360. The fan shows the rim lighting rust ("a length") and the wedge gold ("an area"), and the fraction is written against the full 360 readout.
- **Doubling when halving was asked**, and the reverse, between inscribed and central. "From the rim it looks half as wide": the two fans on screen, the one at the rim visibly narrower.
- **Right angle put at the wrong vertex**, so the tangent segment is computed as the hypotenuse (√306). The right-angle mark sits at T, on the circle, and the hypotenuse is named aloud before any squaring.
- **Piece times inside piece** (PA · AB) instead of piece times whole. The secant is drawn with PB bracketed from P all the way to B.
- **Base angle given as 180 − apex** (102 for 51), or the apex not halved. The two ticks on the radii and the two equal gold fans at the base.
- **Answering x** (6) instead of the angle (78), and **opposite angles set equal** instead of supplementary. The board returns to the question after x; the two arcs that together make the whole circle.
- **Circumcenter and incenter swapped.** "Through the corners: equal distances to points, perpendicular bisectors. Touching the sides: equal distances to lines, angle bisectors." Both drawn with their equal segments.
- **Scale factor inverted** (7/11), or taken as the difference (18 − 7); **dilation about the wrong center** or **translation the wrong way**. The slide-and-dilate motion, with the factor read off the radii.
- **Degrees to radians by 180/π** (or the reverse), or **π taken as a full turn** (30° → π/12). The half turn labeled π on the unrolled rim; "what fraction of a half turn?".
- **Reference angle measured to the y-axis**, or **the turn not stripped** (405 kept). The coil past 360 and the small gold fan always dropping to the x-axis.
- **x and y swapped** (−√3/2 for the y at 210°), or **the sign from the wrong quadrant.** The dropped triangle: the vertical leg is y, and at 210° the triangle is flat against the floor, so y is the short leg; both legs point into the third quadrant, so both are negative.
- **A π added to a radian speed** (4050π cm) because "circles have π", or **rev/s accepted for rad/s**. The rolling wheel's trail is rθ with no π; the gold word is "radians per second".

### The lines worth remembering

One per foundation, said once at the moment it applies and written on the board or recap:

"A circle is every point one radius from the center." · "Around is three diameters and a bit." · "Area: half the rim times the radius; a bit more than three squares on the radius." · "Radius first." · "Fraction of the turn, times the whole. Arc is a length; sector is an area." · "Two radii make an isosceles triangle." · "Radius and tangent: a right angle. Center to the point is the hypotenuse." · "From the rim, the arc looks half as wide." · "Piece times whole equals piece times whole." · "Through the corners: perpendicular bisectors. Touching the sides: angle bisectors." · "A hexagon in a circle is six radii around." · "Every circle is every other, scaled." · "A radian is one radius of arc. Half a turn is pi." · "What fraction of a half turn?" · "Whole turns don't count; the reference angle drops to the x-axis." · "x is the shadow, y is the height; the quadrant sets the signs." · "Rim speed is radius times turning speed."

### Pacing by grade

Grade 7 lessons speak in plain words ("the distance around", "the number of squares inside"), one idea per beat, with the unroll and the wedges allowed to finish before the voice moves on. Geometry lessons may use the theorem words once they are defined, but each theorem gets its own short "why" shot before the example that uses it. Algebra 2 lessons are the densest in the family; the sine lesson's lesson applies: hold the hand, pause after each key idea, one motion per beat.

---

## 4. Tools to build

### What exists

`circle` (center and radius), `angle` (three points, `fill`, `right`), `sweep` (the gold fan with a TeX reading, from `wave.ts`), points `on` a circle at a `deg` and `glide` around it, `foot` (the dropped perpendicular's base), `seg` with `ticks`, `dash` and `extend`, `dim` brackets, `label`, `poly`, `axes`, `turn`/`flip`/`slide`/`morph`, `view`, `vector`, and the whole unit-circle-to-wave figure. The board, `term`, `watch`, `recap`, the math check.

### What this family needs: `film/circle.ts`, with tests like `wave.ts`

**4.1 `arc` and `sector` parts.** The sector generalizes `sweep` to any circle, any start and end angle, with readouts.

```json
{ "id": "sec", "sector": "c", "from": 0, "to": 225, "fill": "gold-fill", "ink": "gold", "deg": true, "frac": true }
{ "id": "arc", "arc": "c", "from": 0, "to": 225, "ink": "warm", "w": 7, "tex": "\\cw{s}" }
```
- `deg: true` writes a live degree readout at the vertex (`@deg`); `frac: true` writes the fraction of the turn beside the fan when it stops (`225/360 = 5/8`, reduced by the kit; `"frac": "half"` writes it against 180 for conversions; in radians against 2π).
- A sector can be at a vertex on the rim (`"at": "P"`) for an inscribed angle, with an `@ang` readout that updates as its points glide.
- `coil: true` lets the fan pass 360° as a visibly separate turn; negative `to` fans clockwise.
- An arc's `tex` rides its midpoint on the outside (the open kit wish "labels that ride turned parts").
- Actions: `{"do":"fan","target":"sec","to":225,"at":"two"}` opens the fan with the readout counting; `draw` traces an arc; `highlight` glows; `show`/`hide`.

**4.2 `unroll` and `lay`.**
```json
{ "do": "unroll", "target": "arc", "from": "L", "dir": "e" }
{ "do": "lay", "target": "d", "along": "arc", "count": true }
```
- `unroll` peels an arc (or the whole rim: `from: 0, to: 360`) off the circle and lays it as a straight segment of exactly its length starting at point L, keeping its ink; its length label follows.
- `lay` sets copies of a segment (the diameter, the radius) end to end along a straight line or bent along an arc, one copy per counted word, with a live count and the leftover stub labeled with its fraction (`0.14`, `"a bit"`). This is pi (diameters along the rim) and the radian (radii along the rim) in one action.

**4.3 `wedges` and `rearrange`.**
```json
{ "do": "wedges", "target": "c", "n": 8 }  { "do": "rearrange", "target": "c", "at": "R" }  { "do": "wedges", "target": "c", "n": 16 }
```
Cuts the disk into n equal wedges; `rearrange` lifts alternate wedges, turns them and interleaves them into a strip at R; a later `wedges` with more n re-cuts in place and the strip flattens. `dim` brackets attach to the strip's height (`c.strip.h`) and top (`c.strip.top`).

**4.4 `tangent` part and `touch`.**
```json
{ "id": "t", "tangent": ["c", "T"], "ink": "blue", "extend": true }
```
The line through T perpendicular to OT; T may glide and the line follows. `{"do":"touch","target":"t","from":"far"}` slides the line in from outside until it meets the circle, then draws the radius and the right-angle mark on the word.

**4.5 `step`** for compass constructions: `{"do":"step","target":"c","from":"A","n":6,"ink":"muted"}` draws a muted arc of the circle's radius from each successive point and names the landing points `c.step.1` … `c.step.6`, so `poly` can join them and `seg` can draw the radii.

**4.6 `dilate`**: `{"do":"dilate","target":"c2","about":"O","k":1.5}` scales a circle (and anything in its `group`) about a point; with `slide` this is the whole similarity proof.

**4.7 `roll`**: `{"do":"roll","target":"w","along":["G1","G2"],"rad":9,"trail":"warm"}`: a wheel with a rim mark turns through the given radians while rolling along the ground, leaving a trail of length rθ with a live length label.

**4.8 `dim` for choices** (specified in the place-value design): every multiple-choice type in this family needs it, which is seventeen of the twenty-three.

**4.9 Small additions.** `@deg` and `@ang` readouts on labels (`of` a point on a circle, or an angle or sector part); `seg.bracket` from a point to a far point for "the whole secant"; equal-length `ticks` already exist.

### Build order, by what each piece unlocks soonest

1. **`sector`/`fan`, `arc`, readouts, `dim`**: arcs and sectors (4 types), inscribed polygons, the inscribed-angle and radii-triangle lessons (with existing `angle` and `glide`), standard position, conversions, the unit circle: 15 of 23 types.
2. **`unroll` and `lay`**: the grade 7 pi lessons (3) and the radian lessons (3).
3. **`wedges`/`rearrange`**: the two grade 7 area types, and the standard's derivation clause.
4. **`tangent`/`touch` and `step`**: tangents, secant products, centers, constructions (5).
5. **`dilate` and `roll`**: circle similarity and angular speed (2).

Nothing here is forced onto a lesson: if a per-type concept finds a better picture than these, that is a `KAIZEN.md` finding.

---

## 5. The seam: who writes what

**Strongest writer.** Lessons whose insight is a motion that proves, or whose type is mixed and teaches reading:

- `pi-as-ratio` and `circle-estimate-blanks`: the family's foundation films (unroll, three and a bit, "stays the same" by similarity). If these are not beautiful nothing after them will be.
- The first `circle-area-coefficient`, carrying the wedge derivation; once it exists, the derivation is a reusable shot and the coefficient types become method lessons.
- `arc-sector-derivation`: three sub-kinds of "which equation / which value" under one name, the radian defined as arc over radius, proportionality argued from similar circles.
- `circle-angles`: the inscribed-angle proof by sliding the vertex; semicircle; and a tangent case that is really another type's (see §6).
- `circle-segment-lengths`: power of a point from similar triangles, plus a coordinate slope case: mixed.
- `triangle-circle-centers`: two constructions and a cyclic-quadrilateral equation under one name: a reading lesson.
- `circle-dilation-scaling`: transformation sequences where order, center and direction each have a decoy.
- `reference-angle-standard-position`: negative and multi-turn angles in degrees and radians; the picture must carry four cases without becoming a formula sheet.
- `unit-circle-coordinate`: the hinge to trigonometry; leg and sign confusions; special triangles.
- `angular-velocity-problem`: units are the whole problem, and one decoy is a true quantity in the wrong unit.

**Capable cheaper model, once the kit above exists and the concept is written.** One method, one picture with named actions, a fast way that always works, `--dry` and the math check catching most slips:

`mcas-circle-radius-distance`, `circle-circumference-coefficient`, `arc-length-coefficient`, `sector-area-coefficient`, `geo-arc-length-rounded`, `circle-radii-triangle`, `tangent-circle-computation`, `geo-centroid-median`, `sat-entry-radian-conversion`, `degree-radian-conversion`, `radian-arc-ratio`. Borderline: `inscribed-polygon-reasoning` (one number, 360/n, plus three named construction methods to act out; try it on the cheaper model and review hard).

Every first-wave lesson receives independent instructional and visual review.

---

## 6. What in the app's problem types should change, and what the standards ask that nothing practices

> Base cases and trick questions stay in the app. A flag here means a weak example for a lesson or a misfiled standard, never "drop it".

**Misfiled or badly conceived.**
- `geo-centroid-median` has no circle and no standard id. It is HSG.CO.C.10 ("the medians of a triangle meet at a point") and belongs in family 29 (triangle proofs); its presence under `triangle-circles` will make a student think the centroid is a circle's center. Move it.
- `circle-angles` holds a tangent-plus-Pythagoras item (PT = 8, OP = 10) that duplicates `tangent-circle-computation`. Keep inscribed, central and semicircle in `circle-angles`; keep every tangent right triangle in `tangent-circle-computation`.
- `circle-segment-lengths` mixes power of a point (HSG.C.A.2) with the slope of a tangent in the xy-plane (HSG.GPE.B.5). The slope item belongs in family 27 (`circle-equations`); it is the only coordinate problem in the family.
- `arc-length-coefficient`, `sector-area-coefficient` and `geo-arc-length-rounded` are judged to serve 7.G.B.4; arcs and sectors are not in 7.G.B.4 at all. They serve HSG.C.B.5, where the skill already sits. Fix the links. `arc-sector-derivation` likewise does not serve 7.G.B.4.
- `circle-dilation-scaling` sits under a skill linked to HSG.C.A.1 ("prove that all circles are similar") but its items are 8.G.A.3/A.4 computations (scale factor, ratios, a sequence for one specific pair). The area-ratio item (k²) is not in either standard's text. Link what it practices; see the gap below.
- `tangent-construction` (HSG.C.A.4, construct a tangent from an outside point) holds only computations. The construction itself (the circle on OP as a diameter meets the circle at the tangent points, because an angle in a semicircle is right) is never asked.
- `unit-circle-coordinate` is judged to serve HSF.TF.A.3, a (+) standard, inside an Algebra 2 skill linked to TF.A.1/A.2; the reference-angle method is TF.A.2 territory. Say so in the catalog, and fix the notation: `\frac{-1}{2}` and `\sqrt{3}/2` in one choice list should be `-\frac{1}{2}` and `-\frac{\sqrt{3}}{2}`.
- `degree-radian-conversion` writes `\frac{1\pi}{6}` (should be `\frac{\pi}{6}`), and its decoy 136 is a near miss, not a misconception; the realistic decoys are 270 (doubled), 67.5 (halved) and the result of multiplying the wrong way. `sat-entry-radian-conversion` and `degree-radian-conversion` are one concept in two answer formats; one design serves both.
- `angular-velocity-problem`: the choice "12/2π rev/s" is the correct speed in the wrong unit. Defensible as a units trap (HSN.Q.A.1), but the lesson must say so explicitly or a careful student feels cheated.
- `circle-estimate-blanks` holds two unrelated fills (estimate pi from C and d; estimate area from a diameter) and `facts.ts` shows only the blank keys, not the sentence. Print the exact sentence so the lesson can show the problem as the learner sees it.
- `reference-angle-standard-position` has no standard id; HSF.TF.A.2 fits ("radian measures of angles traversed counterclockwise around the unit circle").
- `radian-arc-ratio` prints a single variant; the lesson needs the range (arcs shorter than a radius, fractional radii) to choose its example.

**Standards clauses nothing practices.**
- 7.G.B.4, "give an informal derivation of the relationship between the circumference and area of a circle": no item asks for it. The lesson teaches it (foundation 3); a small type could ask which expression gives the area from the circumference and radius (C · r ÷ 2), or fill the wedge-rectangle's height and width.
- HSG.C.A.1, "Prove that all circles are similar": only specific pairs are mapped; never the general statement or the two-step argument (translate, dilate) as a proof.
- HSG.C.A.2, "circumscribed angles" (the angle between two tangents from an outside point, 180 minus the central angle): never practiced. "Inscribed angles on a diameter are right angles" and "radius perpendicular to the tangent" are practiced. A perpendicular from the center bisecting a chord is not.
- HSG.C.A.3, "Construct the inscribed and circumscribed circles" and "prove properties of angles for a quadrilateral inscribed in a circle": only "which construction" and the numeric cyclic-quadrilateral case are asked; the proof is never asked.
- HSG.C.A.4: the construction is never practiced (above).
- HSG.C.B.5: "derive" is practiced as choosing the proportional equation and applying the radian-sector formula; acceptable.
- HSG.CO.D.13: constructing is practiced only as choosing a described method; the app cannot yet construct.
- HSF.TF.A.2, "explain how the unit circle enables the extension of trigonometric functions to all real numbers": the traversal (negative and multi-turn angles) is practiced; the explanation never.
- HSF.TF.A.3: values for π − x, π + x, 2π − x "in terms of their values for x" are practiced only numerically through reference angles, never symbolically (sin(π + x) = −sin x); tangent values are never asked.
- HSG.GPE.B.5 and 8.G.B.7: practiced where linked. HSN.Q.A.1: practiced by the unit trap.

---

## 7. The pilot: five problem types first

The pilot covers the whole arc in one sitting (grade 7, Geometry, Algebra 2), every new kit piece, the five habits on open-answer and multiple-choice problems, and the lessons most likely to be gotten wrong by a weaker writer.

| # | Type | Grade | Why |
|---|---|---|---|
| 1 | `pi-as-ratio` | 7 | The picture is born: the circle with its center and radius, the rim unrolled, three diameters and a bit, on a small circle and a big one, so "stays the same" is seen before it is chosen. Exercises `unroll`, `lay`, `dim`. |
| 2 | `circle-area-coefficient` | 7 | The wedge derivation (the standard's "informal derivation"), then "radius first" with a diameter of 19 and the fraction 361/4; the "three squares on the radius" sense check. Exercises `wedges`/`rearrange`. |
| 3 | `sector-area-coefficient` | Geo | The fan, the fraction of the turn written and simplified, times the whole; the rim lighting rust beside the gold wedge so arc and sector are never confused. Exercises `sector`, `fan`, `frac`. (`arc-length-coefficient` follows as a quick variant of the same picture.) |
| 4 | `circle-angles` | Geo | The family's one real theorem: the vertex that slides while the readout stays at half, the proof on the isosceles radii triangle, the semicircle's right angle. Exercises `@ang` readouts, inscribed sectors, `glide`. The strongest-writer lesson of the family; the pilot must contain one. |
| 5 | `degree-radian-conversion` | A2 | The radius laid along the arc, six and a bit in a turn, π at the half turn on the unrolled rim, then "what fraction of a half turn?" in both directions with rule-out by size. Exercises `lay` on an arc, `frac: "half"`. Serves `sat-entry-radian-conversion` and `radian-arc-ratio` with the same concept. |

If these five land, the next wave is `tangent-circle-computation` (`touch`, the right triangle), `unit-circle-coordinate` (the hinge to family 30), `triangle-circle-centers` (`meet`, the mixed reading lesson) and `circle-dilation-scaling` (`dilate`), which complete the kit; then the eleven cheaper-model types go out one at a time against the seam test.
