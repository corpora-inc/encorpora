# Trigonometry, Geometry to Precalculus: supplementary design notes

These notes provide additional teaching examples and component proposals. Use [FAMILY.md](FAMILY.md) for the complete family plan.

Fourteen skills, 36 problem types, three grade bands (Geometry, Algebra 2, Precalculus). Planning snapshot: `src/curriculum/catalog.ts`, the engine templates and `film/facts.ts` for every variant, snapshot 2026-11-09. This is the family-level design: the idea, the pictures, how the lessons go, the kit, who writes what, what is misfiled, and the pilot. The per-type concepts use these foundations to explain how to read, solve, and check each problem.

---

## 1. The idea underneath the whole family

Trigonometry is one fact and its consequences: **an angle fixes the shape of a right triangle, so the ratios of its sides are numbers that belong to the angle, not to the triangle.** Every right triangle with a 35° angle is the same triangle drawn bigger or smaller; opposite over hypotenuse is the same fraction in all of them, and that fraction is called sin 35°. From there: a leg is the hypotenuse times the angle's ratio; make the hypotenuse 1 and the two legs are the coordinates of a point; let the angle keep turning and the point goes around a circle, which gives sine and cosine for every angle; lay the point's height out along a line as it turns and you have the wave; drop a perpendicular in any triangle and the right-triangle facts give the area formula, the law of sines and the law of cosines; name a point by how far and which way and you have polar coordinates. A learner who owns "same angle, same shape, same ratio" and can draw the turning point owns the family.

Thirteen foundations, in the order they are built. Each lesson stands on the ones above it and names them in a line.

1. **Same angle, same shape, same ratio.** (Geometry) Two right triangles with the same acute angle share two angles, so they are similar (family 26) and every pair of matching sides is in the same ratio. The ratio is a property of the angle. This is HSG.SRT.C.6 word for word, and the whole family rests on it. The motion: the triangle grows, every side changes, three fractions hold.
2. **Name the sides from the angle.** (Geometry) The hypotenuse is across from the right angle and is always the longest side. The *opposite* side is across from the angle you are using; the *adjacent* leg touches it. Move to the other acute angle and opposite and adjacent swap; the hypotenuse never does. Most wrong answers in this family are a side named from the wrong angle.
3. **Three ratios, three names.** (Geometry) sin = opposite/hypotenuse, cos = adjacent/hypotenuse, tan = opposite/adjacent. Definitions, read off the labeled triangle. Sine and cosine of an acute angle are less than 1 because a leg is shorter than the hypotenuse; tangent is less than 1 below 45° and more than 1 above. Three anchors the learner carries everywhere, from foundation 5: sin 30° = ½, sin 45° ≈ 0.71, sin 60° ≈ 0.87.
4. **A ratio is an equation.** (Geometry) One known side and one angle: write the ratio that joins the known side to the wanted side, and it is a one-step equation (family 11). Leg = hypotenuse × ratio; hypotenuse = leg ÷ ratio. Two known sides: the inverse asks "which angle has this ratio?" and the calculator answers. "Degree mode" means the calculator measures angles in degrees, which these problems use.
5. **Two triangles you can build by hand.** (Geometry) Half a square is the 45-45-90 triangle, sides 1, 1, √2. Half an equilateral triangle is the 30-60-90, sides 1, √3, 2. Pythagoras (family 27) supplies the third side each time. These give every exact value the later grades use.
6. **The two acute angles share one triangle.** (Geometry) They add to 90° (family 23), and one's opposite is the other's adjacent, so sin A = cos(90° − A). Co-sine is the sine of the complement.
7. **Every situation is a right triangle with a level line.** (Geometry) Level ground or sea, a vertical object, a line of sight or a path. Angles of elevation and depression are measured from the level line at the eye; the depression seen from the top equals the elevation seen from the bottom (alternate interior angles, family 23). A bearing is measured clockwise from north. An isosceles triangle's altitude cuts it into two matching right triangles.
8. **Any triangle is two right triangles.** (Geometry to Precalculus) Drop a perpendicular from a vertex: its length is a side times the sine of the angle at its far end, h = b sin C. So the area is ½ab sin C (family 24's ½ base × height). The same height written from two sides gives the law of sines; Pythagoras on the two right triangles gives the law of cosines, which is Pythagoras with a correction term that vanishes at 90°.
9. **Hypotenuse 1: the ratios become coordinates.** (Algebra 2) Put the angle at the origin, opening from the positive x-axis, with hypotenuse 1. The far point is (cos θ, sin θ): cosine across, sine up. Let the angle keep turning past 90° and the point keeps going around the circle; its coordinates *define* cosine and sine for every angle, negative or past 360°. The sign of cosine is the sign of x and the sign of sine is the sign of y, so the quadrant gives the sign; the size comes from the reference angle, the same right triangle laid against the x-axis in a new quadrant. The radian is the radius laid along the arc (family 28 owns it; here it is used).
10. **The wave is the height of the turning point.** (Algebra 2) Carry the point's height across to a graph as the angle grows and you draw y = sin x. Cosine is the x-coordinate: the same wave a quarter turn ahead. In y = A sin(B(x − h)) + k the amplitude |A| is the radius, the period 2π/B is one turn, the midline k is where the center sits, and h is where the point starts: the stretches and shifts of family 13, seen on a circle.
11. **Mirrors on the circle, and the circle's equation.** (Precalculus) −θ is the point reflected across the x-axis: cosine unchanged, sine flipped (cosine is even, sine is odd). π − θ is the reflection across the y-axis; π + θ is the point through the origin; a full turn lands on the same point (period 2π). The point sits on x² + y² = 1, so cos²θ + sin²θ = 1: given one ratio and the quadrant, the right triangle gives the rest. The angle-sum formulas are the distance between two points on this circle, proved once, then used for exact values at 15°, 75°, 105°.
12. **One ratio, two angles.** (Precalculus) A horizontal line at height k cuts the circle twice, so sin x = k has two solutions in a turn (one when k = ±1, none when |k| > 1); cos x = k is a vertical cut. To make "the angle whose sine is k" a single answer, look only at one arc where sine climbs once: arcsine answers in the right half of the circle, −π/2 to π/2; arccosine in the top half, 0 to π; arctangent in the open right half. The calculator gives that one; the mirror gives the other. This is the whole of HSF.TF.B.6.
13. **How far, which way.** (Precalculus) A point named by r and θ is r copies of the unit-circle point: (r cos θ, r sin θ). A negative r walks backward through the pole, so (−r, θ) = (r, θ + π). A polar graph r = f(θ) is the arm sweeping around while its length follows the rule.

**What this family takes, by name.** From 26 (transformations, congruence, similarity): AA similarity and the fixed scale factor, the reason foundation 1 is true. From 27 (Pythagoras and coordinate geometry): the third side, the distance formula, the circle x² + y² = 1. From 23 (angles and triangles): degrees, 180° in a triangle, complementary angles, alternate interior angles. From 28 (circles): the circle, arcs, the radian; `radians-unit-circle` must be taught before `special-angle-exact-value`. From 24 (area): ½ base × height. From 22 (shapes): the square, the equilateral triangle, the isosceles triangle and its line of symmetry. From 10 and 9: a ratio as one fixed fraction; fractions multiplied and divided. From 11: one-step equations with the unknown in the numerator or the denominator. From 4: square roots, √2 and √3 simplified, 1/√2 = √2/2. From 3: signed coordinates in four quadrants. From 13: function notation, stretches and shifts of a graph, inverse functions (`function-transformations` and `inverse-functions` come before the Algebra 2 and Precalculus skills here).

**What it gives.** To 31 (vectors): components r cos θ and r sin θ. To 5 (complex numbers): polar form, the same picture in the same colors (`complex-plane-forms` already draws it: real blue, imaginary rust, length teal, angle gold). To Geo modeling: heights and distances no ruler can reach.

Two things are defined before they are used, always: the word (hypotenuse, opposite, adjacent, the ratio names, elevation, depression, bearing, standard position, terminal side, quadrant, reference angle, amplitude, period, midline, phase shift, odd and even, arcsine, included angle, pole and polar axis) and the picture it is read from.

---

## 2. The visual language

Three pictures carry the family, and the second and third are the first one moved: the right triangle; the right triangle with hypotenuse 1 turning on a circle; the height of that point laid out as a wave. A precalculus student looking at a unit circle must recognize the triangle they labeled in geometry.

### The right triangle

Drawn to true scale always: the given angle at its true measure, the sides in their true proportion, so the picture is itself a sense check (a 27° angle looks like 27°; the side across from it is visibly shorter than the other leg). The right angle carries the small square. The angle in use carries a **gold** arc with its measure inside (41°, or θ when no measure is known).

Sides are colored by their role *relative to the gold angle*: **opposite rust, adjacent blue, hypotenuse teal.** Each side's label sits outside the triangle at the side's middle: the role in small muted capitals (OPPOSITE, ADJACENT, HYPOTENUSE) and under it the known length, or "?", in the side's color. The problem's own letters (A, B, C) sit at the vertices.

The three ratios are written beside the triangle as fractions in the sides' colors: sin θ is rust over teal, cos θ blue over teal, tan θ rust over blue. The fraction *is* the picture, so no mnemonic is needed or used: a student who sees rust over teal is thinking "opposite over hypotenuse" in the picture.

### The two triangles you can build

A square of side 1 with its diagonal; one half lifts out as the 45-45-90 and its sides are written 1, 1, √2 (1² + 1² = 2 on the board). An equilateral triangle of side 2 folded along its altitude; one half is the 30-60-90 with 1, √3, 2 (2² − 1² = 3). Both to true scale, so 2 is seen longer than √3. Once built, the two triangles stay as a small reference card beside any problem that uses them, the way the place-value chart stays beside its problems.

### The story figure

Level ground or sea as a muted horizontal; the vertical object; the eye point; the **level line** through the eye, dashed and muted, extending both ways. The angle of elevation opens upward from the level line in gold; depression opens downward. For depression, the equal angle at the far point appears by sliding the gold arc down the line of sight to where it meets the ground (alternate interior angles). Then the right triangle is **pulled out** of the scene onto clean space with its sides named from the gold angle, and the scene fades. For bearings, a compass rose: north up, N E S W in muted capitals, the bearing arc gold and swept clockwise from north; the path is the hypotenuse, the north-south and east-west parts the legs. For an isosceles triangle, the altitude is drawn from the apex, the two halves shade alternately for a beat, and one half is pulled out with its half-angle and half-base labeled.

### The altitude in any triangle

Triangle ABC with the standard names (side a opposite A). A perpendicular drops from one vertex to the opposite side, marked with the square; the foot is D; the height h is rust and is labeled b sin C the moment the right triangle it lives in lights. When the angle at the foot is obtuse the altitude lands outside and the base is extended dashed; both cases are shown once each because the law of cosines needs the second. The two right triangles are the only thing the derivations ever use.

### The unit circle

Radius 1 in teal from the origin; the angle θ gold, swept counterclockwise from the positive x-axis (the kit's `sweep`), labeled in degrees and radians together where both are in play. The point P carries its **reference triangle**: the vertical leg (rust) to the x-axis is sin θ, the horizontal leg (blue) along the x-axis is cos θ, and the point is labeled (cos θ, sin θ) in blue and rust. As the point turns into quadrant II the blue leg swings left of the y-axis and its label turns negative while rust stays up: the sign *is* the coordinate's sign. The reference angle is the small gold arc between the terminal side and the x-axis, and the triangle inside it is one of the two from the reference card when the angle is special. The circle can be labeled all the way around with the sixteen special points, built point by point from those two triangles; once it exists it stays as the reference card for every Precalculus lesson. Tangent, when needed, is the slope of the terminal side: rust over blue.

### The wave

Exists in `film/wave.ts` (demonstrated in `sinusoid-compare-rule`): the circle on the left, the graph on the right, the turning point's height carried across, the curve drawn only as far as the point has gone. The family adds the dashed **midline** at y = k, the **amplitude** bracket from midline to peak in rust, the **period** bracket (exists), a **shift** arrow from x = 0 to where the cycle starts, and cosine traced from the blue leg. The x-axis is labeled in the problem's own units: π/2, π, 3π/2, 2π for a pure function; hours or minutes for a model.

### Polar

Concentric muted circles at r = 1, 2, 3, ... and spokes every 30° and 45° labeled in radians, the polar axis bold, the pole marked. A point (r, θ): the gold angle swept from the polar axis, the teal arm of length r, the point; for a negative r the arm passes through the pole as a dashed line and the point sits on the far side. Its Cartesian legs are the unit circle's legs r times longer, blue and rust, so x = r cos θ, y = r sin θ is read off. A polar graph is drawn by the arm sweeping while its length follows the rule, the curve left behind; the arm shrinking to zero and growing again makes a petal.

### Color means one thing each

- **gold**: the angle in use (arc and measure); the word in the question that says what is asked; the one thing being looked at. One gold thing at a time.
- **rust**: opposite; up; sine; the height of the turning point; the amplitude.
- **blue**: adjacent; across; cosine.
- **teal**: the hypotenuse; the radius; the polar arm; the figure's outline when no role is in play.
- **violet**: a second triangle or second angle (the mirror point and its triangle, the second solution of sin x = k, the obtuse candidate in the ambiguous case, g beside f).
- **muted**: the level line, grids and spokes, the part of the circle an inverse does not use, ruled-out choices, the scene after the triangle is pulled out.

These are the colors `complex-plane-forms` and `sinusoid-compare-rule` already use, so a learner meets one picture from geometry through complex numbers.

### The motions, each one proving a foundation

- **Grow** (1): the far vertex slides along the hypotenuse's ray and the vertical leg follows; the three side lengths tick live; the three ratio readouts beside the triangle hold to two decimals. Everything changes but the fractions.
- **Relabel** (2, 6): the gold arc hops to the other acute angle; rust and blue swap sides and the role words slide with them; the hypotenuse stays teal. Done once at 41° and 49°, it is the whole of sin A = cos B.
- **Fit** (4): the triangle scales so the hypotenuse is the given length; the live labels show each leg as hypotenuse × ratio.
- **Fold** (5): a square folds along its diagonal; an equilateral triangle folds along its altitude; the half lifts out and is measured.
- **Slide the arc** (7): the depression angle at the top slides down the line of sight and lands as the elevation angle at the ground.
- **Pull out** (7): the right triangle lifts off the story scene onto clean space; the scene fades; the sides take their role labels.
- **Drop the altitude** (8): the perpendicular falls from a vertex; the two right triangles light alternately; h is written as b sin C on the word "sine".
- **Turn** (9): the triangle with hypotenuse 1 slides onto the axes and the point glides around the circle; the triangle rides along, flipping into each quadrant; the coordinate labels change sign as the legs cross the axes. (`glide` on a circle point with `foot` exists; the riding triangle and signed labels are new.)
- **Trace** (10): the height carried across to the graph as the point turns (exists).
- **Mirror** (11): the point's reflection across the x-axis, the y-axis, or through the origin appears in violet with its own triangle and coordinates; the mirror line flashes dashed.
- **Cut** (12): a dashed horizontal line at height k crosses the circle at two points; each gets its gold sweep from the positive x-axis.
- **Restrict** (12): one arc of the circle stays teal and the rest goes muted; the cut's point on the muted part is ruled out.
- **Sweep the arm** (13): the polar arm turns from 0 to 2π while its length follows r(θ), tracing the curve.
- **Dim** (every multiple-choice type): the choices that cannot be right fade together in one beat with the one reason said aloud.

### The sketch

What the learner draws on scratch paper, and what every film draws first: a right triangle with the square in its corner, the angle in use marked, the three sides labeled with what is known and a ? on the one that is wanted. For any angle past 90°: a circle, the angle swept from the right, the vertical dropped to the x-axis, the signs of x and y written in the quadrant. For a wave: the midline, one peak, one full cycle bracketed. If the sketch for a problem is none of these, that is a finding, not a reason to force one.

---

## 3. How lessons in this family should go

**The shape, by band.** A Geometry lesson opens with the labeled triangle and the ratio it needs, defined in a few seconds from the picture; the first lesson of the family (`trig-ratio`) earns the definition with the grow motion, and every later one names it in a line ("same angle, same ratio") and shows the colored fraction. A story lesson opens on the scene, draws the level line, and pulls the triangle out before any number is touched. An Algebra 2 or Precalculus lesson opens with the turning point and its coordinates (or the point and its height, for a wave), ten seconds, then reads the problem. An area or oblique lesson drops the altitude once, reads the formula off the two right triangles, then uses it. Then the example, worked whole, with its choices when it has them; a quick second case only where the type truly holds one; overview and recap. Pacing: one idea per beat, plain words then the picture, and the picture finishes moving before the voice moves on.

**The five habits, as they look here.**

1. **Read.** Find the right angle. Find the angle the problem uses and make it gold. Name the three sides from that angle. Say which side is known and which is wanted, and whether the question asks a side, an angle, a ratio, or a count. Note the rounding and "degree mode" (said in one line in every Geometry lesson that uses it). For a story, find the level line first.
2. **At a glance.** What is known before any arithmetic. A leg is shorter than the hypotenuse; the shorter leg is across from the smaller angle; a ratio sits against the three anchors (sin 27° is a little under ½; cos 68° a little over a third). On the circle: the quadrant gives the sign before the size is known, so half the choices are gone. On a wave: amplitude is half the swing, midline the average of max and min. For an area: ½ab sin C is at most ½ab. For a found angle: the drawn angle, at true scale, is about that size, so 64.6° is nonsense for a ramp that rises 6 over 14.
3. **The sure fast way.** Pick the one ratio that joins the known side to the wanted side; leg = hypotenuse × sine (across from the angle) or × cosine (touching it); an unknown in the denominator means divide. For special triangles, the two reference triangles and nothing else: hypotenuse = short leg × 2, long leg = short × √3, the 45° hypotenuse = leg × √2, and to go the other way divide. For complementary ratios, the two angles add to 90. For any angle on the circle: quadrant for the sign, reference angle for the size, special triangle for the value. For symmetry: draw the mirror point. For a given ratio and quadrant: the quadrant triangle with signed legs, then Pythagoras. For sinusoid parameters: factor B out first, then read |A|, 2π/B, h, k. For equations: cut the circle and count the crossings. For inverses: the one arc. For a side with its opposite angle: law of sines; two sides and the included angle, or three sides: law of cosines. For polar: x = r cos θ, y = r sin θ; a negative r adds π. Every one of these always works; none is a trick that sometimes fails.
4. **Sense.** The answer against the picture: the leg found is shorter than the hypotenuse, and shorter or longer than the other leg as the angles say; the angle found looks like the drawn angle; the sign matches the quadrant; a total height is more than either part; the cut lands as many times as the count says.
5. **Check.** Pythagoras on the three sides, or the other ratio; the calculator the other way (tan of the found angle gives the given fraction); sin² + cos² = 1 for a point; the chosen equation evaluated at a point read from the graph (the peak at t = 0 for a cosine model); the three angles under 180° for a triangle; converting back for polar.
6. **Rule out**, for multiple choice. The decoys in this family are the misconceptions, so they are named as they dim: the sine where cosine belonged; the complement of the right answer; the other leg; the positive value in a negative quadrant; the second angle with that sine but outside the inverse's arc; the period read as peak-to-trough; the shift read without factoring; the obtuse candidate that will not fit with the given angle. All the nonsense dims at once with its reason; then the survivor is proved.

**Degree mode and rounding.** The film cannot press buttons. It writes "sin 27° ≈ 0.4540" on the board and says "a calculator in degree mode gives". Round only at the end; the ratio is kept to four places because that is what the app's step boxes expect (0.6561, then 17.7), and a lesson for a `-steps` type shows the steps in the app's order.

**Realistic misconceptions, from what students actually do.** Each is made impossible by a picture where a picture can do it.

- Naming opposite and adjacent from the wrong angle, or from the right angle. The gold arc and the relabel motion make the dependence visible; every label in the family is drawn relative to the gold angle.
- Reaching for sine because it comes first, or for tangent when the hypotenuse is given. "The ratio that joins what you know to what you want" is said on every example.
- sin 41° = 17/x solved as x = 17 sin 41°. The hypotenuse must be longer than the leg; the picture says so before the arithmetic.
- The calculator in radian mode (sin 27° reads 0.956). The anchors catch it: sin 27° must be a little under ½.
- Rounding the ratio to two places and multiplying (0.45 × 40 = 18.0 for 18.2). The board keeps four places.
- The angle of depression drawn from the vertical wall of the tower. The level line is drawn first, every time.
- A bearing measured from east, or counterclockwise. The compass with north up and the clockwise sweep.
- The 30-60-90 hypotenuse written as √3 because it looks like the biggest number; a leg found from a hypotenuse by multiplying by √2. The fold at true scale (2 is longer than √3) and "the hypotenuse is always the longest".
- The whole apex angle used on half the base; the altitude added into the perimeter. The half pulled out of the isosceles triangle has the half-angle written on it.
- The two heights subtracted in an elevation-and-depression problem. The level line splits the object and the parts stack.
- (cos, sin) swapped; the sign dropped in quadrant II (cos 120° = ½); the reference angle of 120° taken as 120° − 90°. The blue leg visibly points left of the y-axis; the gold reference arc sits against the x-axis.
- sin(θ − π) treated as sin θ − sin π; "θ + 6π" treated as a change. The mirror, and the full turns landing on the same point.
- The right ratio in the wrong half of the circle: arcsin(−½) = 7π/6, arcsin(√2/2) = 3π/4. The restricted arc stays teal; the other candidate sits on muted circle.
- cos x = 0 answered as x = 0 (input confused with output), or one solution where there are two. The vertical cut at x = 0 crosses the circle at the top and the bottom.
- Amplitude read as the maximum; period read as peak-to-trough; the shift of 3x − π read as π. Brackets on the graph; factoring on the board.
- An angle not between the two sides used in ½ab sin C; an obtuse angle expected to break it. The altitude lands outside and h is still b sin C.
- In the ambiguous case, the obtuse candidate dropped without a check, or kept when it cannot fit (99° + 125° > 180°). The violet second triangle is drawn, then shown impossible on the board.
- Law of cosines with +2ab cos C. At 90° the term must vanish; the derivation ends on that check.
- A negative r plotted at the same angle. The arm passes through the pole on screen.

**Lines worth remembering.** One per lesson, said once where it applies, then in the recap.

- "Same angle, same shape, same ratio."
- "Name the sides from the angle. The hypotenuse is always the longest."
- "Pick the ratio that joins what you know to what you want."
- "Across from the angle: sine. Touching it: cosine."
- "Half a square. Half an equilateral triangle."
- "Co-sine is the sine of the complement."
- "Elevation and depression are measured from the level line."
- "Height is b sin C."
- "On the circle, cosine is across and sine is up."
- "Quadrant gives the sign. Reference angle gives the size."
- "The wave is the height of a turning point."
- "Amplitude is half the swing. Midline is the average."
- "A cut across the circle lands twice."
- "Arcsine answers in the right half. Arccosine in the top half."
- "A side with its opposite angle: law of sines. Two sides and the angle between, or three sides: law of cosines."
- "How far, which way."

---

## 4. Tools to build

**Exists.** Figure primitives (`poly`, `seg`, `dot`, `angle` with `right`, `label`, `dim`, `curve`, `axes`, `circle`, `plot`, `grid`), motions (`show`, `hide`, `draw`, `highlight`, `move`, `glide`, `turn`, `flip`, `slide`, `morph`, `view`), the circle-and-wave kit (`film/wave.ts`: a point on a circle, its `foot` on the x-axis, `sweep` with a reading, `plot` drawn `upto` a point, period brackets, haloed axis numbers), `vector`, `table`, the board (`problem`, `write`, `answer`, `watch`, `term`, `overview`, `recap`), live readouts `@x`, `@y` on a graph point. On the curriculum roadmap and wanted here: `dim` for choices, `cases` on the board.

**New, in build order.**

### 4.1 `rtri`: the right triangle by role

```json
{ "id": "t", "rtri": ["A", "B", "C"], "right": "C", "angle": "A",
  "roles": true, "values": { "hyp": "17", "adj": "?" }, "ratios": ["cos"], "start": true }
```

- Three named points with the right angle at `right`; the gold arc at `angle`. Or placed to scale from the data: `"from": { "at": "A", "hyp": 17, "deg": 41, "orient": "base" }` computes the other two points.
- Parts: `t.hyp`, `t.opp`, `t.adj` (segments colored teal, rust, blue by role), `t.right` (the square), `t.angle` (the gold arc with its measure), `t.role.opp` (the word), `t.value.opp` (the length or ?), `t.ratio.sin` (the fraction readout in the sides' colors, live), `t.vertex.A`.
- Actions: `{"do":"relabel","target":"t","angle":"B"}` (the arc hops; rust and blue swap with their labels); `{"do":"grow","target":"t","hyp":25,"dur":3}` (the far vertex slides along the hypotenuse ray; values tick; ratios hold); `{"do":"fit","target":"t","hyp":17}`.
- Live readouts for any figure, not only `rtri`: a label `@len` of a segment, `@deg` of an angle, `@ratio` of two segments, counting as points move. These also serve families 23, 24, 26 and 27.

### 4.2 `foot` on any line

Points: `{ "foot": "A", "on": ["B", "C"] }`, the perpendicular foot of A on line BC (today only the x-axis). Enables the altitude in any triangle, the isosceles split, the horizontal leg to the y-axis on the circle. Small, and it unlocks all six area and oblique types.

### 4.3 Unit-circle extensions (`film/wave.ts`)

- `reftri: true` on a circle point: the rust vertical, the blue horizontal, the small gold reference arc against the x-axis, and the signed coordinate label `(cos θ, sin θ)` or its values, riding the point as it glides and changing sign as a leg crosses an axis.
- `radians: true`, `degrees: true` on a circle: ticks and TeX labels around the outside at multiples of π/6 and π/4. `special: true` draws the sixteen special points with coordinates, addressable (`u.pt.120`) so a lesson can show them one by one.
- `{"do":"mirror","point":"Q","over":"x" | "y" | "origin","as":"Q2"}`: the reflected point in violet with its own reference triangle and coordinates; the mirror line dashed for a beat.
- `{"do":"cut","target":"u","y":0.5}` (or `"x"`): a dashed line across the circle, the two crossing points, a gold sweep to each.
- `{"do":"restrict","target":"u","from":-90,"to":90}`: that arc stays teal, the rest goes muted.
- `axes` gain `"xlabels":"pi"` so ticks read π/2, π, 3π/2, 2π.

### 4.4 Wave additions

`midline` (dashed at k with its label), `amp` (bracket from midline to peak, rust), `shift` (arrow from x = 0 to the cycle's start), `carry: "x"` so a second graph traces the blue leg: the cosine. The period bracket exists.

### 4.5 Story conventions, from existing parts

The level line (a muted dashed `seg` with `extend`), elevation and depression arcs (`angle` in gold), the compass (a `circle` with four labels and an `angle` that must be allowed to sweep clockwise and past 180°: `"cw": true` on `angle` is the one new field), the pull-out (`slide` plus `hide`). No new component; the per-type concepts spell the figures out.

### 4.6 `polar`

```json
{ "id": "p", "polar": "O", "rings": 4, "spokes": 12, "radians": true, "start": true },
{ "id": "P", "point": { "polar": [4, "5pi/4"] } },
{ "id": "arm", "arm": ["O", "P"], "ink": "accent" },
{ "id": "r1", "rplot": "2sin(3t)", "from": 0, "to": "2pi", "upto": "T", "arm": true }
```

The grid with rings and labeled spokes; `arm` draws the radius to a point and passes dashed through the pole when r is negative; `rplot` traces r = f(θ) as θ glides, the arm following.

### 4.7 Board

`cases` (two columns side by side: the two angles of a cut, the two triangles of the ambiguous case, the ± of a root), already on the roadmap. `write` with `\approx` is enough for calculator lines. A `steps` card mirroring the app's step boxes for the four `-steps` types is a nice-to-have, not a need.

**Build order and what it unlocks.** 4.1 and 4.2 together: 22 of the 36 types (all of right-triangle trigonometry, special triangles, complementary, area, oblique, proofs). 4.3: the seven Precalculus circle types (`special-angle-exact-value`, `trig-symmetry-value`, `special-angle-match`, `inverse-trig-value`, `trig-identity-value`, `tangent-quadrant-cosine`, `trig-equation-solutions`). 4.4: the five wave types. 4.6: the two polar types. `cases` and `dim` whenever the board is next touched. The circle pieces are shared with family 28 (radians) and family 5 (complex), so they are built once.

---

## 5. Which lessons need the strongest writer

**Strongest writer.** Where the insight is a motion that must be staged, where the type is mixed and teaches reading, or where the reasoning is the content.

- `trig-ratio`: the family's picture is born; the grow motion is the proof of HSG.SRT.C.6; two cases (a ratio from a context; a side from a ratio). If this one is not beautiful nothing after it is.
- `geo-altitude-ratio`: three similar right triangles in one figure; finding which acute angle equals A; a "which equation is true" set whose decoys are near-misses.
- `trig-context-triangle`, `bearing-trig-problem`: mixed types that teach turning words into a triangle; two bearing notations; the depression-from-the-vertical trap.
- `geo-elevation-depression`: the first story lesson; the level line and the pull-out are set here (its steps twin can then go cheaper).
- `special-angle-exact-value`: the circle built from the two triangles and turned into every quadrant; the hinge of the family.
- `trig-symmetry-value`, `special-angle-match`: the mirrors; a search among expressions by reference angle and cofunction.
- `inverse-trig-value`, `trig-equation-solutions`: the one-arc idea and the cut; both standards are an understanding, not a procedure.
- `sinusoid-parameters`, `odd-sine-parameters`: a graph read into an equation, factoring for the shift; symmetry of a graph.
- `oblique-triangle-solve`, `triangle-law-reasoning`: the derivations by altitude; the ambiguous case with its second triangle; three sub-kinds under one name.
- `trig-identity-value`: three methods under one name, including the angle-sum derivation.
- `polar-graph-identify`: the shapes of roses and limaçons and their symmetry tests.

**A capable cheaper model, from a finished concept with the kit complete (the seam).** One method each, numbers `--dry` can check, one component with named actions, the misconception named in the concept.

- `geo-trig-leg-degrees`, `trig-leg-steps`: leg = hypotenuse × sine or cosine; the steps type is the same film with the app's step layout.
- `elevation-depression-steps`, `geo-isosceles-trig`, `isosceles-perimeter-steps`: the figure is specified in the concept; the method is one line.
- `rg-isosceles-right-decimal`, `special-right-triangle`, `special-triangle-in-figure`, `geo-equal-legs-radical`: the two reference triangles, multiply or divide.
- `complementary-trig`, `geo-complementary-trig-choice`: the angles add to 90; solve.
- `rg-triangle-area-sas`, `geo-sas-triangle-area`, `sas-area-steps`, `trig-triangle-area`: ½ab sin C, including solving for a side.
- `tangent-quadrant-cosine`: the quadrant triangle with signed legs.
- `sinusoid-model`, `tide-cosine-equation`: max and min to A and k, period to B, evaluate.
- `polar-cartesian-conversion`: x = r cos θ, y = r sin θ; a negative r adds π.

Nineteen types on the cheap side, sixteen on the strong side, one reference screenplay (`sinusoid-compare-rule`). The cheap side waits for the strong side's lessons to fix the pictures, and for the blind test. Review stays at the top for all 36.

---

## 6. Problem types that look badly conceived, misfiled or off grade; standards never practiced

> Trivial and trick cases are wanted in the app. A flag here means a weak choice for a worked example or an alignment fix, never that the app should drop the case.

**Alignment.**
- `special-right-triangles` (all four types) and `trigonometric-area` (all four) are judged to serve 8.G.B.7 and 7.G.B.6. The content is high school: special triangles are HSG.SRT.C.8 (trigonometric ratios and the Pythagorean theorem in right triangles) and ½ab sin C is HSG.SRT.D.9. The judged links are wrong, not the types. `rg-isosceles-right-decimal` is honestly Pythagoras with a decimal (family 27 could own it); it stays here because the √2 ratio is its point.
- `trig-symmetry-value` is filed under HSF.TF.A.4 and judged to serve HSF.TF.C.8 and A.3. It serves A.4 (odd, even, periodic) and A.3's second clause; C.8 is wrong.
- `polar-coordinates` has no standard, correctly: CCSS has none for polar graphs. `polar-cartesian-conversion` is the same conversion as `complex-plane-forms` (family 5, HSN.CN.B.4) without the i: one kit, two lessons that name each other.
- `sinusoid-parameters` carries four standards; HSF.IF.C.7e is its primary.

**Duplicates and splits.**
- Three pairs are the same problem with and without step boxes: `geo-trig-leg-degrees` / `trig-leg-steps`, `geo-elevation-depression` / `elevation-depression-steps`, `geo-isosceles-trig` / `isosceles-perimeter-steps`. One concept each; the steps film shows the boxes.
- `rg-triangle-area-sas`, `geo-sas-triangle-area` and `sas-area-steps` are one problem (SAS area to the nearest tenth) three times; `trig-triangle-area` adds the real second case (solve for a side; exact values). Merge the first two.
- `trig-identity-value` holds three methods (Pythagorean identity with a quadrant; angle-sum exact values; cofunction). Split into three types, or the lesson carries three full examples.
- `oblique-triangle-solve` holds three sub-kinds (law of sines for an angle; law of cosines for an angle; count the SSA triangles). Split, or three examples. The 99°/125° decoy is good; keep it.
- `trig-context-triangle` mixes reasoning about angles (depression equals elevation) with computing an angle by arctangent. Fine as a mixed type; it teaches reading.

**Weak or degenerate.**
- `odd-sine-parameters`: in every variant we can see the correct choice is "C = 0 and D = 0", so the type is answered by recognition. Also a shift by any multiple of π keeps the function odd (sin(4x − π) = −sin 4x); the generator must never offer C = π as a wrong choice. Keep the lesson short.
- `trig-equation-solutions`: counts solutions of sin, cos and tan at 0 and ±1 only; it never asks for the solutions its description promises, and never approaches HSF.TF.B.7's modeling.
- `sinusoid-compare-rule`: a generated example shows an empty fourth choice (`| ]`). Check the generator.
- `triangle-law-reasoning`: the facts printout truncates the correct choice ("Law o…"); check that the choice text fits the app's card.
- `complementary-trig`: the "sin A = 7/10, find cos(90° − A)" case is one-line recognition. Fine in the app; not a worked example.

**Standards clauses the problems never practice.** Exact words from the standards.
- HSG.SRT.C.6, "Understand that by similarity, side ratios in right triangles are properties of the angles": the understanding itself is never asked; every type uses the ratios. The lesson must supply it (the grow motion) because the app will not.
- HSG.SRT.C.7, "Explain … the relationship between the sine and cosine of complementary angles": only "use" is practiced.
- HSG.SRT.C.8, "and the Pythagorean Theorem to solve right triangles in applied problems": no applied type ever requires the third side by Pythagoras (the ladder gives all three sides).
- HSG.SRT.D.9, "Derive the formula A = 1/2 ab sin(C) … by drawing an auxiliary line from a vertex perpendicular to the opposite side": never asked; four types apply it.
- HSG.SRT.D.11, "e.g., surveying problems, resultant forces": every oblique problem is an abstract triangle ABC; no survey, no forces.
- HSF.TF.A.3, "the values of sine, cosine, and tangent for π–x, π+x, and 2π–x": tangent is never asked in `trig-symmetry-value`, and 2π − x appears only as −x.
- HSF.TF.B.6, "restricting a trigonometric function to a domain on which it is always increasing or always decreasing allows its inverse to be constructed": only evaluation is asked; the decoys (3π/4, 7π/6) make the understanding necessary, but no problem asks for it.
- HSF.TF.B.7, "solve trigonometric equations that arise in modeling contexts; evaluate the solutions using technology, and interpret them in terms of the context": no modeling context, no technology, no interpretation anywhere. The natural fix is a case in `sinusoid-model`: "when is the rider first at 13 m?".
- HSF.TF.C.8, "Prove the Pythagorean identity": never asked (use is).
- HSF.TF.C.9, "Prove the addition and subtraction formulas for sine, cosine, and tangent": never asked; the tangent formula is never used either.
- HSF.TF.B.5, "frequency": every model type is written with a period; the word frequency appears only in `sinusoid-compare-rule`.

---

## 7. The pilot

Five types, covering the whole arc in one sitting: every new kit piece, all three grade bands, open answer, steps, multiple choice, a story, and the family's defining motion.

| # | Problem type | Band | Why it is in the pilot |
|---|---|---|---|
| 1 | `trig-ratio` | Geo | The picture is born: the triangle at true scale, sides named from the gold angle, the grow motion proving the ratio belongs to the angle, the three fractions in the sides' colors. Exercises `rtri`, `relabel`, `grow`, live readouts. Two cases: a ratio from a context; a side from a ratio. |
| 2 | `geo-trig-leg-degrees` (with `trig-leg-steps` riding along) | Geo | The sure fast way (leg = hypotenuse × sine or cosine), degree mode, four-place ratios, rounding at the end, Pythagoras as the check. The one-method type the cheaper-writer test will later run on; the first version sets its standard. |
| 3 | `geo-elevation-depression` | Geo | A story into two right triangles sharing the level line; the slide of the depression arc; the pull-out; the height as a sum. The applied clause of HSG.SRT.C.8, and the story conventions identify the angles and the common horizontal level. |
