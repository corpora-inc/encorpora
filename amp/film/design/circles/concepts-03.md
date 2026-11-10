# Circles family, part 3: radians and the unit circle (`radians-unit-circle`, Algebra 2)

Three types, one skill, two foundations: **11** (a radian is one radius of arc; the rim is 2π radii long, so a half turn is π) and **12** (standard position; the unit circle; the dropped triangle). The order below is the order the ideas are built: the radian is defined by laying the radius along the arc; conversion is reading the half turn as π; the unit circle reads the landing point's coordinates. Each lesson stands alone and builds only what its problem uses, but a learner who sees all three meets the same circle, center, radius and gold fan each time.

---

### `radian-arc-ratio` — Measure a swept angle in radians from arc and radius

**Status.** Rightly placed. Only one variant printed (radius 2, arc 9, counterclockwise, under one turn); the design asked `facts.ts` for the range. The concept below covers an arc shorter than a radius as a quick case because the learner will meet it; if the generator ever produces clockwise arcs, the lesson adds one beat ("clockwise is negative") and nothing else changes.

**Standard.** HSF.TF.A.1: "Understand radian measure of an angle as the length of the arc on the unit circle subtended by the angle." The app asks it on a circle of radius 2, which is the same fact seen through "arc ÷ radius"; the lesson says once why the standard names the unit circle: on radius 1 the arc *is* the angle.

**Foundations first.** Circle, center O, one teal radius OA labeled 2 cm. "An arc is a piece of the rim; its length is measured along the rim." Then the radian, built live: the radius lifts, bends and is laid along the rim from A; the angle it spans at O goes gold with the readout "1 radian: one radius of arc, about 57°." A second circle twice the size: its radius laid along its rim spans the *same* angle. "A radian does not care how big the circle is: it counts radii, not centimeters."

**Read.** "What is the angle swept out at the center, in radians?" (gold on "radians"). Given: radius 2, arc 9, counterclockwise, less than one turn. At a glance: 9 cm of arc holds more than four radii (8) and fewer than five (10); the answer is between 4 and 5. A full turn is about 6.28 radians, so "less than one full turn" fits.

**The example.** Radius 2 cm, arc AB 9 cm, counterclockwise.
(1) The arc AB lights rust from A counterclockwise, labeled 9 cm; it is visibly more than half the rim.
(2) Copies of the teal radius lay along the arc from A, one per counted word: "one, two, three, four", the length label ticking 2, 4, 6, 8 cm. The fifth copy overshoots B; only half of it fits: 1 cm. "Four radii and a half."
(3) The gold fan opens from OA to OB; readout 4.5 radians.
(4) Board: `\theta = \frac{\text{arc}}{\text{radius}} = \frac{9\ \text{cm}}{2\ \text{cm}} = \frac{9}{2}`. The centimeters cancel on screen: a radian is a count, not a length.
(5) Answer 9/2.
Quick case (under one radian): arc 3 cm on a radius of 4 cm. One radius laid along the arc overshoots B; three quarters of it fits: 3/4 radian. "Less than one radius of arc, less than one radian."

**Fast.** Arc divided by radius, kept as an exact fraction. Always.
**Sense.** Count radii on the picture: between 4 and 5. Under 2π ≈ 6.28, so under a turn, as the problem said.
**Check.** 9/2 × 2 = 9: the angle times the radius gives the arc back.
**Line.** "A radian is one radius of arc. Angle equals arc over radius."
**Trap.** Attaching a π (9π/2) because "radians have π", or dividing the wrong way (2/9), or converting to degrees because the answer "doesn't look like a radian." The laid copies carry no π; four and a half radii cannot be a fraction under one; the gold word is "radians" and the readout counts them.
**Kit.** `lay` along an arc with the live count and the leftover stub (family tool 4.2); a radian readout on the fan (`@rad` beside `@deg`). Nothing else.
**Writer.** Cheaper model: one method, one picture with one named action, a check the math check verifies.

---

### `degree-radian-conversion` — The same angle in degrees and in radians

**Status.** Rightly placed; one concept also serves `sat-entry-radian-conversion`. Faults already flagged in §6: the choice `\frac{1\pi}{6}` should read `\frac{\pi}{6}`; the decoy 136 is a near miss, not a misconception (the realistic ones are 270 and 67.5, which the app also has).

**Standard.** No standard says "convert." The conversion is the consequence of HSF.TF.A.1 ("radian measure of an angle as the length of the arc on the unit circle"): the rim is 2π radii long, so a whole turn is 2π radians and a half turn is π = 180°. That is what the lesson teaches; HSF.TF.A.2 in part ("radian measures of angles traversed counterclockwise").

**Foundations first.** The radian, built live as above (one radius laid along the rim, about 57°). Then copies around the rim: "one, two, three, four, five, six, and a bit": 2π radii in a turn, because the rim is 2π radii long (grade 7's "pi diameters"). The rim unrolls into a line with two scales: degrees above (0, 90, 180, 270, 360), radii below (0, π/2, π, 3π/2, 2π). The half turn is marked on the circle as the straight angle: **180° = π**. "Every conversion is one question: what fraction of a half turn is it?"

**Read.** Which way (gold on "in radians" or "in degrees"). At a glance: an angle under a half turn is under π and under 180; a degree answer is a fraction *of 180*, a radian answer the same fraction *of π*.

**The example (degrees to radians).** 30°; choices π/6, 30, π/12, π/3.
(1) The gold fan opens to 30° on the circle; the half-turn fan (180°) sits behind it in muted gold, labeled π at its end.
(2) The half turn is cut into equal 30° wedges; six fit exactly. "Thirty is one sixth of a half turn." Board: `\frac{30}{180} = \frac{1}{6}`.
(3) On the unrolled rim, the stretch from 0 to π is cut into six; the first tick lights: π/6. Board: `\frac{1}{6}\cdot\pi = \frac{\pi}{6}`.
(4) One beat: "times π over 180" is this same move, divide by 180 for the fraction, then times π.
Rule out: 30 (thirty radians is almost five whole turns; a turn is only about 6.28) dims first. π/3 is a third of a half turn (60°) and π/12 a twelfth (15°); the fan is a sixth. π/6.

**Second example (radians to degrees), the other direction.** 3π/4; choices 136, 270, 67.5, 135. The half turn cut into four; three wedges gold: "three quarters of a half turn." Board: `\frac{3}{4}\cdot 180 = 135`. Rule out: 270 is past a half turn, but 3π/4 is under π: dims. 67.5 is half the size. 136 is a guess; we compute: 180 ÷ 4 = 45, times 3. 135.
Quick case: π radians is the half turn itself: 180. 360 is a full turn (2π), 90 a quarter (π/2).

**Fast.** Degrees ÷ 180, reduced, then × π. Coefficient of π, then × 180. Always.
**Sense.** Under a half turn means under π and under 180. Any radian answer over 6.28 for a single angle is nonsense.
**Check.** Convert back: π/6 is a sixth of 180, 30. 135/180 = 3/4, so 3π/4.
**Line.** "Half a turn is π. What fraction of a half turn?"
**Trap.** Multiplying the wrong way (30 × 180/π ≈ 1,719), or taking π as a *full* turn (30° → π/12). The straight angle labeled π on the fan and on the rim, and the fraction written against 180 every time, make the direction a reading, not a memory.
**Kit.** `sector` with `frac: "half"` and equal `cuts` inside the half-turn fan; the unrolled rim with a second label row (degrees above, radii below: the P3 double number line); `lay` around the rim with the count and the "bit."
**Writer.** Cheaper model, once the fan with cuts and the two-scale rim exist: two directions, one question, every number checkable.

---

### `unit-circle-coordinate` — A coordinate of a point on the unit circle from its angle

**Status.** Rightly placed. Serves a (+) standard inside a skill linked to TF.A.1/A.2; say so in the catalog. Notation faults flagged in §6: `\frac{-1}{2}` and `\sqrt{3}/2` should be `-\frac{1}{2}` and `-\frac{\sqrt{3}}{2}`; the lesson's board writes them the right way. The standard speaks in radians and the app asks in degrees; fine for the lesson, which reads the angle as given, and the recap says once that 210° is 7π/6, the same reading. "Endpoint" means the point where the turning side meets the circle; the lesson names it.

**Standard.** HSF.TF.A.3 (+): "Use special triangles to determine geometrically the values of sine, cosine... for π/3, π/4 and π/6, and use the unit circle to express the values... for π−x, π+x, and 2π−x in terms of their values for x." Practiced: the special triangles geometrically, and the reference-angle reading numerically. HSF.TF.A.2 for the unit circle in the coordinate plane. The problem never says sine or cosine; the lesson doesn't either until the last line.

**Foundations first.** Axes; the circle of radius 1 around the origin: every point on it is exactly 1 from O. Standard position: start at three o'clock, (1, 0); counterclockwise is positive. The gold fan opens and the landing point P follows, crossing (0, 1) at 90° and (−1, 0) at 180°. "P's coordinates are how far across (blue) and how far up (rust)." Drop the dashed perpendicular from P to the x-axis: a right triangle with the teal radius as hypotenuse, 1. The **reference angle** is the angle inside that triangle at O: the acute angle to the x-axis, never the y-axis. Then the two special triangles, built once with hypotenuse 1: an equilateral triangle of side 1 cut down the middle (the half flips over its long leg to show it), so the leg opposite 30° is half of 1, 1/2, and the other leg is √(1 − 1/4) = √3/2; an isosceles right triangle, legs a with a² + a² = 1, a = √2/2 ≈ 0.71. Both drawn to scale beside the circle and kept.

**Read.** The angle and which coordinate (gold). At a glance: where does 210° land? 30° past 180°, third quadrant, just under the negative x-axis: the triangle lies flat against the floor, so y is the *short* leg; left and below, so both coordinates are negative. The answer is between −1 and 0 and small.

**The example.** 210°, y-coordinate; choices −1/2, √3/2, −√3/2, 1/2.
(1) The fan opens to 210 with the readout; P lands in QIII.
(2) The perpendicular drops to F on the x-axis; OF blue, FP rust, OP teal = 1. The triangle is visibly low and wide.
(3) Reference angle, gold at O: `210 - 180 = 30`.
(4) It is the 30-60-90 with hypotenuse 1; the 30 is at O, so the side opposite it is FP, the vertical leg: FP = 1/2; OF = √3/2. The labels land on the drawn legs.
(5) y is the vertical leg, and P is below the axis: `y = -\frac{1}{2}`.
Rule out: √3/2 and 1/2 are positive, but P is below the floor: dim together. −√3/2 is the long leg, and the long leg is lying along the floor: that is x. −1/2.

**Second example (the other triangle, the other coordinate).** 225°, x-coordinate; choices −√2/2, −1/2, 1/2, √2/2. Reference angle 225 − 180 = 45; equal legs, both √2/2; x is the horizontal leg and P is left of O: `x = -\frac{\sqrt{2}}{2}`. Rule out: ±1/2 come from the 30-60-90, but 45 means equal legs; √2/2 is positive and P is left. If the range includes an axis angle (90°), one beat: no triangle, the point is (0, 1).

**Fast.** Strip whole turns; find the quadrant; reference angle = the gap to the x-axis (180 − θ, θ − 180, 360 − θ); flat triangle (ref 30): y is 1/2 and x is √3/2; tall (ref 60): x is 1/2 and y is √3/2; 45: both √2/2. Left means x negative, below means y negative: read it off the picture, never a chart.
**Sense.** Both coordinates lie between −1 and 1. Near 180° or 360°, y is the small one; near 90° or 270°, x is. 210 is near 180, so |y| = 1/2, not √3/2.
**Check.** x² + y² = 1: (−√3/2)² + (−1/2)² = 3/4 + 1/4 = 1; P is on the circle, and the signs match the quadrant drawn.
**Line.** "x is the shadow, y is the height; the quadrant sets the signs." And the reading rule: "Near the floor, y is small."
**Trap.** Swapping the legs (−√3/2 for y at 210°); measuring the reference angle to the y-axis (60°, which also gives √3/2); taking the sign from a memorized chart instead of from where P sits. The triangle is drawn flat on screen, the perpendicular always drops to the x-axis, and the leg labels sit on the drawn legs, so the vertical one is unmistakably the short one.
**Kit.** Mostly exists (axes, circle, `on`/`deg`, `foot`, `seg`, `angle`, `dim`, `poly`, `flip`, the fan readout). Needs `dim` for choices, the reference-angle fan drawn inside the triangle at O on the far side from the axis, and labels that keep clear of axis numbers (the open kit wish). The recap's last line hands off: "this height is what the next family calls sine, and the shadow cosine."
**Writer.** Strongest writer: the hinge to trigonometry, three realistic confusions at once, the special triangles built geometrically, and the sine lesson's density note applies.