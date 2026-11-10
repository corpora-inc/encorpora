# Trigonometry, Geometry to Precalculus: family design

Fourteen skills, 36 problem types, in three bands (Geometry, Algebra 2, Precalculus). Planning snapshot: `src/curriculum/catalog.ts`, the engine templates and `film/facts.ts` for every variant; standards from the official text. This is the family-level design: the idea, the pictures, the habits, the kit, the seam, the flags and the pilot. The per-type concepts use these foundations and pictures.

---

## 1. The idea underneath the whole family

Trigonometry is one fact and its consequences. **In a right triangle, the ratio of two sides depends only on the angle, because every right triangle with that angle is a scaled copy of every other.** So a ratio can be named after an angle (sine, cosine, tangent), looked up, and used to find a missing side or a missing angle. Put the triangle inside a circle of radius 1 and the ratios become the coordinates of a point, so the angle can be any size and the picture never changes. Unroll that circle and a coordinate becomes a wave. Drop a height in any triangle and it is two right triangles, so the fact reaches every triangle. A learner who owns "the ratio belongs to the angle" and "put it in the circle of radius one" owns the family; everything after that is careful reading.

The foundations, in the order they are built. Each lesson stands on the ones above it and says so in a line.

**Geometry**

1. **Point at the angle; the sides take their names from it.** Defined first, in this order: the right angle (the square mark); the *hypotenuse*, across from the right angle and always the longest side; then, for the angle you point at, the side *across* from it (opposite) and the side *touching* it that is not the hypotenuse (adjacent). Across and touching are not properties of the triangle; they change when you point at the other angle. This one definition, made physical, prevents most wrong answers in the family. From family 22 (naming shapes by their parts) and 27 (the hypotenuse).

2. **The ratio belongs to the angle.** Two right triangles with the same acute angle have all three angles equal, so one is a dilation of the other and every ratio of sides is the same number (family 26: a dilation keeps angles and scales every length by one factor). That number is a fact about the angle, not the triangle, so it earns a name: sine is across over longest, cosine is touching over longest, tangent is across over touching. This is HSG.SRT.C.6 word for word, and it is the whole reason a calculator can have a sine button. Taught before any problem is worked.

3. **Multiply to get a leg; divide to get the hypotenuse; undo to get the angle.** A leg is the hypotenuse times a ratio. If the wanted side is on the bottom of the ratio, the equation is solved by dividing (family 11, one-step equations). An angle is recovered from a ratio of two known sides with the inverse button. The calculator gives the ratio to four decimals in degree mode; round only at the end. Pythagoras (family 27) is the check.

4. **The two acute angles trade places.** What is across from one acute angle touches the other, so sin A = cos B whenever A + B = 90°. The complement is the same triangle seen from the other corner (HSG.SRT.C.7).

5. **Two triangles are known by heart because they are halves of shapes you know.** Half a square is the 45-45-90 triangle with sides 1, 1, √2. Half an equilateral triangle is the 30-60-90 triangle with sides 1, √3, 2, the longest across from the biggest angle. Both come from a cut and one Pythagoras (family 27; radicals from family 4). Their ratios are exact, so sin 30° = 1/2 and cos 45° = √2/2 are not memorized: they are read off the cut.

6. **Every applied problem hides a right triangle, and the right angle is where level meets vertical.** Angles of elevation and depression are measured from the level line through the eye, never from the wall; the angle of depression at the top equals the angle of elevation at the far point (alternate interior angles with the level ground, family 23). A bearing is measured from north. An isosceles triangle's altitude cuts it into two matching right triangles. The habit: draw the triangle out of the story, mark its right angle, mark the angle you know, label the two sides that matter (HSG.SRT.C.8).

**Algebra 2**

7. **Hypotenuse 1: the ratios become coordinates.** Slide the triangle so its angle sits at the center of a circle of radius 1 and its hypotenuse is a radius. The touching side is now the point's x, the across side its y: the point at angle θ is (cos θ, sin θ). Now the angle can be past 90°, negative, or more than a turn, and the same picture serves: the *reference triangle* drops from the point to the x axis, and the quadrant says the signs. The angle is measured counterclockwise from three o'clock; radians are the radius laid along the arc, so π is half a turn (family 28 owns radians and the unit-circle angle; this family names them in one line and shows the picture).

8. **Unroll the circle and a coordinate becomes a wave.** The height of the turning point, plotted against the angle turned, is the sine wave (built in the kit as `wave`). Amplitude is the radius; the midline is the height of the center; the period is the x it takes for one full turn, 2π/B, because the angle turned is Bx; a shift moves where the turn starts; a negative A starts downward. Cosine is the same wave started at the top of the circle. A Ferris wheel, a tide, a rider's height: the circle is the picture of the thing, so the model is read off it (HSF.IF.C.7e, HSF.TF.B.5; shifts and stretches are family 13's transformations, named once).

**Precalculus**

9. **The circle's mirrors are the identities.** Reflect the point over the x axis and the angle is −θ: x stays, y flips (cosine even, sine odd). Reflect over the y axis: π − θ, y stays, x flips. Half-turn through the center: π + θ, both flip. A full turn lands on the same point: periodic. Every "find sin(π + θ) given sin θ" question is one mirror on the circle (HSF.TF.A.3, A.4).

10. **Pythagoras on the circle: cos²θ + sin²θ = 1.** The reference triangle has legs |cos θ| and |sin θ| and hypotenuse 1. Given one ratio and the quadrant, the triangle gives the other two; the quadrant gives their signs. Tangent is sine over cosine, the slope of the radius. The sum formulas come from one more picture, two equal chords on the circle, shown once; the problems then use them for 75° and 15° (HSF.TF.C.8, C.9).

11. **Undoing: the inverse keeps half the circle.** One sine value has infinitely many angles, so arcsin must choose; it keeps the right half of the circle (−π/2 to π/2), where height only rises; arccos keeps the top half (0 to π), where x only falls; arctan the right half too. That is why the inverse of a trigonometric function can be built at all (HSF.TF.B.6). To solve an equation on 0 ≤ x < 2π: the inverse gives one angle, the mirror gives the other, and the count is how many times a level line crosses one turn of the wave (HSF.TF.B.7).

12. **Any triangle is two right triangles: drop the height.** The height from one vertex is b sin C, so the area is ½ab sin C. The same height written from both ends gives b sin C = c sin B, the law of sines. Pythagoras on both pieces gives the law of cosines, c² = a² + b² − 2ab cos C, which is Pythagoras with a correction for the angle not being 90°. Two sides and the angle between them, or three sides: law of cosines. A side with its opposite angle: law of sines. Two sides and a non-included angle: the third side swings and may land twice, once or never (HSG.SRT.D.9, D.10, D.11).

13. **A point can be named by a distance and a turn.** (r, θ) is the unit circle's point scaled by r: (r cos θ, r sin θ). A negative r walks backward through the center. A polar graph is r changing as θ turns, and its symmetries are the circle's mirrors from foundation 9 (sin(π − θ) = sin θ makes r = 4 − 2 sin θ symmetric in the y axis). No Common Core standard; the conversion is the picture HSN.CN.B.4 uses for complex polar form, and family 5 reuses it.

**What this family takes, and what it gives.** From 26 (AA similarity, the dilation), 27 (Pythagoras, distance, the hypotenuse), 23 (angle sum, complements, alternate interior angles), 28 (radians, the angle as a fraction of a turn), 11 (one-step equations), 13 (transformations of a graph), 24 (area = ½ base × height), 4 (radicals). It gives the components picture to 31 (a vector's parts are a bearing problem), polar form to 5, and the right-triangle ratio to every physics-flavored modeling type.

---

## 2. The visual language

One picture, born in Geometry and never redrawn: **a right triangle with its right angle marked, one angle in gold, and the two sides that go with that angle in two colors.** It grows into the reference triangle inside the circle of radius 1, into the wave the circle traces, and into the two right triangles inside any triangle. A precalculus student looking at the unit circle must see the Geometry triangle with its hypotenuse shrunk to 1.

### The pictures

| Picture | Picture system | Bands | What the learner sketches |
|---|---|---|---|
| The marked right triangle | P8 | Geo; PC as the reference triangle | triangle, square at the right angle, arc at the angle, the two sides in play labeled, the ratio written in their colors |
| The level line and the compass | P8 | Geo | a dashed horizontal with the angle above or below it; N up with an arc clockwise |
| The two cuts | P8 | Geo, PC | a square with its diagonal; an equilateral triangle with its height |
| The circle of radius 1 | P10 on P7 | A2, PC | circle, point, radius, the drop to the x axis, the swept angle |
| The wave | P7 with P10 (exists) | A2 | axes, lines at the max and min, one repeat bracketed |
| Two right triangles | P8 | Geo (isosceles, elevation and depression); PC (area, laws) | the triangle with a dashed height and its square mark |
| The polar grid | P10 on P7 | PC | rings and spokes; a point with r along the spoke and θ swept |

### Scale

Always true. A 27° angle is drawn at 27°; the hypotenuse is visibly the longest side; the leg across from 55° is visibly longer than the leg across from 46°. A lighthouse problem makes a tall triangle; the card fits it rather than squashing it. The 30-60-90 is drawn from the real cut, so its proportions are exact. The unit circle's 120° point sits at exactly 120°. The wave's circle has radius A and its center at height k, so the traced height *is* the model, to scale with the graph beside it. Nothing stands for a length it is not.

### Color means one thing each

- **gold**: the angle in use, its arc and its label; and the one word in the question that says what is asked ("how far east", "perimeter", "exact", "nearest tenth", "in radians"). A second gold arc appears only to show it equals the first (the alternate interior angle; the reference angle beside the swept angle).
- **teal** (accent): the hypotenuse; on the circle, the radius; a trip's whole length; the function f.
- **rust** (warm): the side *across* from the gold angle; on the circle, the height (sine, y); a dropped altitude.
- **blue**: the side *touching* the gold angle; on the circle, the run (cosine, x).
- **violet**: a second triangle or a second solution (the SSA twin, the second angle of an equation); a second function g.
- **muted**: level lines, the compass, the construction arc of a swinging side, the dimmed half of a circle or wave, quadrant names, choices ruled out.

The ratio on the board is written in the picture's colors (sin A = rust over teal), the pattern from `line-slope`. When the gold angle moves to the other acute angle, rust and blue trade sides; that trade *is* the complementary-angle lesson. On the circle the role colors and the direction colors coincide (across is up, touching is over) because the angle always sits at the center on the x axis; in a triangle they follow the role, never the direction, so a depression angle at the top of a tower has a vertical blue side and a horizontal rust one.

### The motions (each one proves a foundation)

- **Dilate**: the triangle grows and shrinks from the gold angle's vertex; the side labels count up and down; the ratio label beside it never changes. Foundation 2.
- **Swap**: the gold arc jumps to the other acute angle; rust and blue trade sides; the ratio's name changes from sine to cosine. Foundation 4.
- **Cut**: the diagonal or the height is drawn, the two halves slide apart, one half is labeled with its angles and sides. Foundation 5.
- **Build**: the story's scene (tower, sea, line of sight) is drawn, then fades to muted while its three sides stay and the right angle is marked. Foundation 6.
- **Level**: a dashed line through the eye; the gold elevation arc above it or depression arc below it; the depression arc slides along the line of sight to the far point and lands on the equal angle there. Foundation 6.
- **Stand**: a small triangle lifts, turns and slides until its gold angle sits where the big triangle's does, so a shared angle visibly shares its ratio (the altitude-to-hypotenuse figure). Foundation 2 again.
- **Place**: the marked triangle slides into the circle: gold vertex to the center, hypotenuse shrinking to the radius 1, the leg labels rewriting as coordinates. Foundation 7.
- **Sweep and drop**: the gold angle sweeps counterclockwise from three o'clock; the perpendicular drops from the point to the x axis; the reference triangle appears with its own small gold arc; the signs of the legs appear from where the point is. Foundation 7.
- **Mirror**: the point flips over the x axis, over the y axis, or half-turns through the center; the image's coordinates are read beside the original's; a full turn lands on itself. Foundation 9.
- **Unroll** (exists): the point turns, its height is carried across, the wave is drawn only as far as the point has gone. Foundation 8.
- **Keep half**: the circle and the wave dim except the stretch where the function only rises or only falls; a level line at the given value meets it once; the inverse reads off that angle. Then the whole circle brightens and the mirror gives the second solution. Foundation 11.
- **Drop the height**: from a vertex, perpendicular to the opposite side, dashed rust with its square mark; the two right triangles shade in two fills; h is written twice, once from each end. Foundation 12.
- **Swing**: the free side pivots around the end of the fixed side, sweeping a muted arc; where the arc meets the base ray a triangle appears: twice, once, or never. Foundation 12.
- **Scale the circle**: the unit circle's point slides out along its spoke to r; a negative r slides back through the center to the far side. Foundation 13.

### Notation and the calculator

The film uses the problem's notation: θ or A, m∠A, degrees or radians as the problem does, exact radicals when it says exact. The calculator step is shown honestly: "degree mode" named once in the lesson, the ratio written to four decimals with ≈ (sin 27° ≈ 0.4540), the side rounded only at the end, which is exactly the order the app's `steps` types fill in. For exact problems (special angles, bearings at 30° and 60°) there is no calculator: the cut triangle is the lookup.

---

## 3. How lessons in this family go

The learner we are making puts a finger on the angle before doing anything. Every film builds the same habits.

### Read

- Find the right angle. If none is drawn, find where it hides: level ground meets a vertical wall; the altitude meets the base; the drop meets the x axis.
- Find the angle you will use and make it gold. If the given angle is a depression at the top, your triangle's angle is either the equal angle at the far point or its complement at the top; the lesson shows both and picks the simpler.
- Name the two sides in play, the one you know and the one you want, by their role from the gold angle: across, touching, longest. Say it aloud. Then the ratio is forced: the one that holds exactly those two sides.
- Find the word that says what is asked and make it gold: "how far east" (one component, not the trip), "perimeter" (twice the slant side plus twice the half base, never the half base), "the angle at the ship" (not the one at the top), "exact", "nearest tenth", "in radians", "0 ≤ x < 2π", "quadrant II".
- Circle problems: which quadrant, which reference angle, which coordinate (cosine is x, sine is y).
- Wave problems: max and min first (they give midline and amplitude), then how much x one full repeat takes, then where it starts and which way.
- Oblique triangles: which three facts are given. Do I know a side and the angle across from it? Then law of sines. Otherwise law of cosines.

### At a glance, before any work

- The hypotenuse is the longest side; any leg is shorter. The longer leg is across from the bigger angle. A leg across from 27° is less than half the hypotenuse, because sin 27° < sin 30° = 1/2.
- Sine and cosine of an acute angle are between 0 and 1. Tangent is less than 1 below 45° and more than 1 above. A calculator that says sin 41° = −0.16 is in radian mode.
- In a right triangle the other two angles are acute, so any obtuse choice is gone.
- On the circle the sign is known from the quadrant before anything is computed, and the size from the reference angle: cos 120° is negative and the size of cos 60°.
- The midline is the average of max and min; the amplitude is half their gap; the period is one repeat. B is never the period.
- Area is at most ½ab, since sin ≤ 1. An obtuse angle gives the same area as its supplement.
- A triangle has at most one obtuse angle, so if the given angle is obtuse the angle found from the law of sines is acute. The biggest side faces the biggest angle.
- arcsin and arctan answers live between −π/2 and π/2; arccos between 0 and π. A choice outside is gone.
- A negative r is on the far side of the pole.

### The sure fast ways

- **Write the ratio with the two sides in play, then solve the one-step equation.** Multiply when the wanted side is on top; divide when it is on the bottom. "A leg is the hypotenuse times the ratio" always holds and is the picture: the leg is a fraction of the hypotenuse.
- **An angle from two sides: the inverse of their ratio.** Across over touching for tangent when neither is the hypotenuse.
- **Complement: sin A = cos B means A + B = 90°.** Write that equation and nothing else.
- **Special triangles: write 1, 1, √2 or 1, √3, 2 times a factor k, read k from the given side.** The hypotenuse is always the longest, so √2 and 2 go there.
- **Circle: reference angle for the size, quadrant for the sign.** The special points are the two cut triangles placed at the center; there is nothing new to memorize.
- **Identity with a quadrant: draw the reference triangle with the two given lengths, Pythagoras the third, signs from the quadrant.** Tangent is across over touching on that triangle, with its sign.
- **Wave: A = (max − min)/2, k = (max + min)/2, B = 2π/period, and factor B out before reading the shift:** 3x − π = 3(x − π/3), so the shift is π/3, not π.
- **Equations on 0 ≤ x < 2π: the inverse gives one angle, the mirror gives the other.** Sine and cosine: two solutions per turn unless the value is ±1 (one) or past ±1 (none). Tangent: one per half turn, so two.
- **Area: half the product of the two sides times the sine of the angle between them.**
- **Law of sines when a side and its opposite angle are known; law of cosines for two sides with the included angle or three sides. SSA: check the supplement.**
- **Polar: (r cos θ, r sin θ); a negative r adds half a turn.**

The letters SOH CAH TOA are the initials of "sine is across over longest, cosine is touching over longest, tangent is across over touching". The board shows them once under the three ratios in the picture's colors, as how everyone remembers the three names. The method is pointing at the angle, not the letters.

### Sense and check

- Pythagoras on the found side with the two known ones.
- The two acute angles add to 90°; the three angles of any triangle add to 180°.
- Re-read the gold word: was it the half base or the whole, the trip or its east part, the angle at the ship or at the top?
- On the circle: x² + y² = 1 and the signs match the quadrant.
- The model at t = 0 is where the story starts (top of the wheel: cosine); max is k + A.
- Area computed with the supplement gives the same number.
- Convert a polar answer back.
- For a leg found with a calculator: is it a reasonable fraction of the hypotenuse for that angle?

### Rule out, for multiple choice

Choices in this family are the misconceptions, so they dim together with the one reason:

- any leg longer than the hypotenuse;
- the complement decoy (33° for 57°; 35 against 35√3: which part should be bigger when the trip is 30° from north? the north part, so 35√3);
- the supplement decoy in a right triangle (147°, 123°);
- half the circle's choices by sign once the quadrant is read;
- the "other ratio" decoy in symmetry questions (0.96 offered for a question about 0.28): a mirror keeps the function's own size, it never turns a cosine into a sine;
- an arcsin outside −π/2 to π/2;
- B offered as the period, the unfactored shift, a negative amplitude, a midline that is not halfway;
- the supplementary angle from the law of sines when the given angle is already obtuse;
- a polar conversion in the wrong quadrant.

### The misconceptions, as children really have them

1. Naming across and touching from the wrong angle, or treating them as fixed sides of the triangle. The swap motion makes the roles move with the finger.
2. Picking sine when the two sides are touching and longest. The roles are said aloud before the ratio is named, every time.
3. Finding the hypotenuse by multiplying (17 × sin 41°) when it is on the bottom of the ratio. The one-step equation is written with the unknown where it really sits.
4. Radian mode. The at-a-glance check (an acute sine is between 0 and 1, and a bit less than sin 45° ≈ 0.707 for 41°) catches it; degree mode is named once.
5. Measuring the angle of depression from the wall, or equating it with the angle at the base of the tower. The level line and the sliding arc.
6. Isosceles: forgetting to double the half base, or using the whole apex angle in the half triangle. The two matching triangles are built and then the perimeter is walked piece by piece.
7. Special triangles: √3 on the hypotenuse; multiplying by √2 when the diagonal is given. The cut shows the diagonal is the side times √2 and is the longest.
8. Circle: sine and cosine swapped at the coordinates; 120° given reference angle 30°; signs by rote. The drop to the x axis makes the legs the coordinates; the reference angle is the angle to the nearest piece of the x axis, drawn.
9. Treating sin(θ + 6π) or cos(θ − π) as a different size. A mirror lands on the same circle: same size, at most a flipped sign.
10. Reading B as the period, −π in 3x − π as the shift, −4 as the amplitude. The angle turned is Bx, so one turn is 2π/B; factor first; the negative flips the start.
11. arcsin(√2/2) = 3π/4 "because it also works". Only the kept half counts.
12. Pythagorean identity with the sign on the wrong function (in quadrant II sine is positive, cosine and tangent negative). The reference triangle with signed legs.
13. Law of cosines with a plus, or stopping before the square root.
14. SSA: taking only the acute angle from the inverse. The swing shows two landings.
15. Forgetting the ½ in the area formula; rounding sin to two places and then rounding the area again. Four decimals, round once.
16. A negative r read as positive at the same angle. The slide back through the pole.

### Lines worth remembering

"The ratio belongs to the angle, not the triangle." "Point at the angle: across, touching, longest." "Multiply to get a leg; divide to get the hypotenuse." "Across from one is touching the other: sine of one is cosine of the other." "Half a square; half an equilateral triangle." "Elevation and depression are measured from level." "Radius one: cosine is how far over, sine is how far up." "Drop to the x axis; read the sign from where you are." "Same point, same value." "Amplitude is the radius; period is one turn; the angle turned is Bx." "The inverse gives one angle; the circle gives the other." "Any triangle is two right triangles: drop the height." "A negative r walks through the pole."

### Pace and shape

Geometry lessons: definitions by pointing (foundation 1), the dilation that proves the ratio is the angle's (foundation 2, shown once per lesson in a short version after its own lesson), then the example. Three to four minutes. Algebra 2 and Precalculus lessons: the circle or the wave is the foundation and takes the first third, as the sine lesson did; one idea per beat, a pause after each key idea, motions finished before the voice moves on. A type with several sub-skills (`sinusoid-parameters`, `trig-identity-value`) gets a short "why" shot before each sub-skill's example. The reading-heavy types (`trig-context-triangle`, `oblique-triangle-solve`) are candidates for the teacher-and-student cast: the student's first wrong thought ("the angle of depression is the one at the bottom") is the misconception, untangled on the picture.

---

## 4. Tools to build

The kit today: polygons, segments (dashed, extended, ticked), dots, angles with right-angle marks, labels, `dim` brackets, circles, plots with `upto`, axes with ranges, vectors, `sweep` (counterclockwise from three o'clock, with a label riding the bisector), points on a circle by degrees, `foot` onto the x axis, `glide`, `turn`, `flip`, `slide`, `morph`, `view`; the wave (`film/wave.ts`); the table; the board with choices, `watch`, `recap` and the cast. What this family needs, as a spec.

### 4.1 `tri`: the marked right triangle

```json
{ "id": "t", "tri": ["A", "C", "B"], "right": "C", "angle": "A",
  "sides": { "AB": "17", "AC": "?", "BC": "" }, "roles": true,
  "ratio": "\\cos A=\\dfrac{\\cb{@adj}}{\\ca{@hyp}}" }
```

- Draws the triangle to scale from its points, the square mark at `right`, the gold arc at `angle` with its label riding outside the arc. Sides are colored by role from the gold angle: hypotenuse teal, across rust, touching blue.
- `sides`: a length, `"?"` (drawn in the side's color), or empty. Side labels ride their side (outside, centered, parallel) and keep riding through `turn`, `slide` and `dilate`: the "labels that ride turned parts" wish from the high-school samples. `roles: true` shows the words opposite, adjacent, hypotenuse in the side colors; `{"do":"roles","target":"t","show":false}` fades them to the lengths.
- `ratio`: a readout with `@opp`, `@adj`, `@hyp`, `@ratio`, which stays constant while the triangle dilates.
- `{"do":"angle","target":"t","at":"B"}`: the swap. `{"do":"dilate","target":"t","about":"A","by":2.5}`: the dilation; side labels count, the ratio holds. Parts are addressable: `t.hyp`, `t.opp`, `t.adj`, `t.arc`, `t.right`, `t.side.AB`.

### 4.2 Points and angles: `foot` on a segment, `meet`, `polar`, angle labels, `drop`

```json
"D": { "foot": "C", "on": ["A", "B"] },
"X": { "meet": ["arc", ["A", "B"]], "nth": 2 },
"Q": { "polar": [8, "4pi/3"] },
{ "id": "aA", "angle": ["B", "A", "C"], "ink": "gold", "tex": "27^\\circ" }
```

- `foot` onto any segment or line (today only onto the x axis). `meet`: the intersection of a circle with a line or ray, a plot with a horizontal line, or two lines; `nth` picks which. `polar`: a point by distance and angle on a polar grid. `angle` gains `tex`, a label riding the bisector outside the arc, as `sweep` has.
- `{"do":"drop","from":"C","to":["A","B"],"id":"h"}`: draws the perpendicular dashed in rust with its square mark and names the foot; the two sub-triangles are then ordinary `poly` fills. One action because eight types use it.
- `slide` and `highlight` work on `angle` parts (the level-line motion slides an arc along a segment).

### 4.3 `unitcircle`

```json
{ "id": "u", "unitcircle": true, "units": "deg", "quadrants": true,
  "point": { "id": "P", "deg": 120, "ref": true, "coords": "exact" } }
```

- A circle of radius 1 on axes with the four quadrant names muted when `quadrants` is on; `u.special` shows the sixteen special points with exact coordinates when named.
- `point` with `ref: true` builds the reference triangle: teal radius, rust height, blue run, square mark at the foot, a small gold arc for the reference angle, and a coordinate label at P in the two colors (`coords: "exact"` writes radicals; `"decimal"` writes readouts).
- `sweep` (exists) fills the angle; `{"do":"mirror","target":"u.P","over":"y"}` (π − θ), `"x"` (−θ) or `"origin"` (π + θ) animates the flip or half-turn, draws the image point in violet with its own reference triangle and coordinates; `glide` by degrees turns it. `{"do":"keep","target":"u","from":-90,"to":90}` dims all but the kept half.

### 4.4 The wave: three additions

The circle-and-wave kit exists. It gains: a center at height k with radius A so the circle is the model to scale; `{"do":"keep","target":"f","from":a,"to":b}` to dim a plot outside a stretch (shared with 4.3); a `midline` option on the plot that draws the dashed line at k with its label. Amplitude and period brackets use `dim` anchored on `{ "on": "f", "x": ... }` points, which exist. A cosine start is `deg: 90` on the circle point, which exists.

### 4.5 `compass` and a clockwise `sweep`

```json
{ "id": "cp", "compass": "O", "r": 6 },
{ "do": "sweep", "target": "trip", "from": "north", "clockwise": true, "deg": 150 }
```

N, E, S, W in muted type with ticks; the sweep from north going clockwise for three-digit bearings, or from north toward east for N 30° E. The trip is a teal `vector`; its parts are rust and blue segments.

### 4.6 `polar` grid and `rplot`

```json
{ "id": "pg", "polar": "O", "rings": 4, "spokes": 12, "units": "rad" },
{ "id": "r1", "rplot": "4-2sin(t)", "from": 0, "to": "2pi", "upto": "Q", "ink": "accent" }
```

Muted rings at r = 1 to `rings`, spokes every 2π/`spokes` labeled in radians; `rplot` draws r(θ) as θ sweeps, only as far as point `Q` has turned, so a rose grows petal by petal.

### 4.7 Board: `cases`

```json
{ "do": "cases", "heads": ["\\text{quadrant I}", "\\text{quadrant II}"],
  "rows": [["x=\\tfrac{\\pi}{6}", "x=\\pi-\\tfrac{\\pi}{6}=\\tfrac{5\\pi}{6}"]] }
```

Two columns under one line, each continuing its own working, rejoined by one `answer`. Specified in the curriculum roadmap; this family needs it for equations with two solutions and the ± of the identity.

### Build order, by what each unlocks soonest

| # | Piece | Unlocks |
|---|---|---|
| 1 | `tri` with riding labels, swap, dilate, ratio readout | 16 Geometry types (right-triangle trig, special triangles, complementary) |
| 2 | `foot` on a segment, `meet`, angle `tex`, `drop`, `slide` on angles | isosceles and elevation types, the four area types, the law types, SSA |
| 3 | `unitcircle` with the reference triangle, `mirror`, `keep` | the eight Precalculus circle types |
| 4 | `cases` | equations, identities |
| 5 | wave additions (center at k, midline, `keep`) | graphs and modeling, six types |
| 6 | `polar`, `rplot`, `polar` points | two types |
| 7 | `compass`, clockwise `sweep` | one type |

---

## 5. Which lessons need the strongest writer, and which a cheaper model can write

**Strongest writer.** The lessons where the motion is the proof or the quality is in the reading.

- `trig-ratio`: the birth of the picture; the dilation that keeps the ratio; if this is not beautiful nothing after it will be.
- `trig-context-triangle`: a mixed type that turns stories into triangles; one example asks for the angle equal to the depression angle, another an angle from two legs. Reading, not a recipe.
- `geo-altitude-ratio`: three similar triangles in one figure; the stand motion must make a notoriously confusing picture obvious.
- `special-angle-exact-value`: the handoff from triangle to circle; the whole Precalculus band stands on this lesson's clarity.
- `special-angle-match`: three ideas at once (reference angle, quadrant sign, cofunction); choosing the example that needs all three without confusing them.
- `inverse-trig-value` and `trig-equation-solutions`: the kept half is the understanding standard HSF.TF.B.6 asks for; counting solutions is reasoning about crossings.
- `oblique-triangle-solve` and `triangle-law-reasoning`: which law and why; the swing and the supplement; derivation steps.
- `sinusoid-parameters`: the graph-to-equation case needs the sign of A and B read from a picture, several sub-skills under one name.
- `odd-sine-parameters`: an argument about symmetry from the rule.
- `polar-graph-identify`: symmetry reasoned from identities, petals counted from the rule.

**A capable cheaper model, from a strong concept with the kit complete.** One method, one picture with named actions, `--dry` and the math check catch most slips.

- The calculator types: `geo-trig-leg-degrees`, `trig-leg-steps`, `elevation-depression-steps`, `isosceles-perimeter-steps`, `geo-isosceles-trig`, `geo-elevation-depression` (once `trig-context-triangle` and the level motion exist as references).
- `bearing-trig-problem` once `compass` exists.
- Special triangles: `special-right-triangle`, `rg-isosceles-right-decimal`, `special-triangle-in-figure`, `geo-equal-legs-radical`.
- `complementary-trig`, `geo-complementary-trig-choice`: one equation.
- The four area types: `rg-triangle-area-sas`, `trig-triangle-area`, `geo-sas-triangle-area`, `sas-area-steps`: one formula, one dropped height.
- `trig-symmetry-value` and `tangent-quadrant-cosine`: one mirror; one reference triangle.
- `sinusoid-model`, `tide-cosine-equation`, `sinusoid-compare-rule` (reference screenplay): read A, k, B off the circle.
- `polar-cartesian-conversion`: one conversion.
- `trig-identity-value` after the split proposed below; before it, strongest writer.

Review stays at least as strong as the writer, and an independent reviewer watches every lesson of the first wave.

---

## 6. Misfiled, badly conceived, and clauses the problems never practice

**Wrong links.**
- The four area types are "judged to serve" 7.G.B.6 (grade 7 area of polygons). They serve HSG.SRT.D.9's formula ½ab sin C; none is grade 7. `rg-triangle-area-sas` also lists HSG.MG.A.1, which fits only loosely.
- The four `special-right-triangles` types are judged 8.G.B.7 (grade 8 Pythagoras). The skill is linked to HSG.SRT.C.8; the exact ratios are HSG.SRT.C.6 (the ratio belongs to the angle) and feed HSF.TF.A.3. Only `rg-isosceles-right-decimal`, which has no angle in it (leg × √2, rounded), is really 8.G.B.7 and belongs with family 27.
- `trig-symmetry-value` is judged HSF.TF.C.8 (Pythagorean identity), because its decoys use it (0.28 against 0.96). It practices HSF.TF.A.3's second clause ("π − x, π + x, 2π − x in terms of x") and A.4 (odd, even, periodic).
- `polar-coordinates` has no Common Core standard. The conversion is the picture of HSN.CN.B.4; the curve identification is precalculus state content.
- The extracted text of HSF.TF.C.8 lost its squares ("sin(θ) + cos(θ) = 1"); the standard reads sin²(θ) + cos²(θ) = 1.

**Duplicates and grab bags.**
- Three pairs are one problem with and without step slots: `geo-trig-leg-degrees` / `trig-leg-steps`, `geo-elevation-depression` / `elevation-depression-steps`, `geo-isosceles-trig` / `isosceles-perimeter-steps`. Each pair gets one concept; the steps film shows the board in the slots' order (ratio to four decimals, then the side).
- Four area types for one formula; `tangent-quadrant-cosine` duplicates the quadrant case of `trig-identity-value`.
- `trig-identity-value` holds three ideas under one name: the Pythagorean identity with a quadrant (C.8), the sum formulas for exact values (C.9), and the cofunction identity (SRT.C.7). Split into two: identity-from-quadrant (merged with `tangent-quadrant-cosine`) and sum-formula exact values; the cofunction case belongs with `special-angle-match`.
- `trig-equation-solutions`: both sample variants are counts; the lesson must also work a "find all solutions" case, which the description promises.

**Generator issues.**
- `odd-sine-parameters` must never offer C = π (or any multiple of π) with D = 0 as a wrong choice: 2 sin(4x − π) = −2 sin 4x is odd too.
- `tide-cosine-equation` writes the story in t ("t hours after midnight") and the choices in x. Use one letter.
- `geo-altitude-ratio` gives AC = 3 and BC = 8 and then asks which equation is true, where the numbers play no part; fine as a distractor only if other variants use them.

**Clauses never practiced** (exact text).
- HSG.SRT.C.6 "Understand that by similarity, side ratios in right triangles are properties of the angles": no problem asks the understanding (two right triangles sharing an angle: which ratios are equal?). The lesson supplies it; the app never tests it.
- HSG.SRT.D.9 "Derive the formula A = 1/2 ab sin(C) by drawing an auxiliary line from a vertex perpendicular to the opposite side": every area type applies; none derives. `triangle-law-reasoning` derives the laws but not the area formula.
- HSG.SRT.D.11 "(e.g., surveying problems, resultant forces)": `oblique-triangle-solve` has no applied context.
- HSF.TF.B.7 "solve trigonometric equations that arise in modeling contexts; evaluate the solutions using technology, and interpret them in terms of the context": every equation is a special-value equation with exact answers; no context, no technology, no interpretation.
- HSF.TF.C.8 "Prove the Pythagorean identity": used, never proved. HSF.TF.C.9 "Prove the addition and subtraction formulas for sine, cosine, and tangent": used for cos 75°; no tangent sum, no proof step.
- HSF.TF.B.5 "frequency": the modeling types give period; only `sinusoid-compare-rule` says frequency.
- HSF.TF.A.4 "periodicity": `trig-symmetry-value` covers θ plus whole turns. Covered.

---

## 7. The pilot: five problem types to build first

The pilot covers every band, every new piece of kit, every motion that proves, and both an open-answer and a multiple-choice shape.

| # | Problem type | Band | Why it is in the pilot |
|---|---|---|---|
| 1 | `trig-ratio` | Geo | The picture is born here: point at the angle, across, touching, longest; the dilation that keeps the ratio; the ladder (40, 42, 58) and the case where a ratio 21/29 scales by 3 to a real triangle, which is similarity made literal. Exercises `tri`, `dilate`, the ratio readout, riding labels. |
| 2 | `geo-elevation-depression` | Geo | The applied figure: the level line, depression measured from level, the sliding arc to the equal angle, two triangles sharing a side, tangent twice and add; a tall to-scale figure. Exercises angle `tex`, `slide` on angles, `build`. Its steps twin rides on it. |
| 3 | `special-angle-exact-value` | PC | The handoff from triangle to circle: the cut 30-60-90 placed at the center, the sweep to 120°, the drop, the sign from the quadrant, the coordinates (−1/2, √3/2). Exercises `unitcircle`, `ref`, `place`, exact labels. |
| 4 | `sinusoid-parameters` | A2 | The wave as the circle unrolled: amplitude is the radius, midline the center, period one turn, the shift read after factoring; the graph-to-equation case with a negative A. Exercises the wave additions and a multiple-choice rule-out. Tests the A2 voice at a patient pace. |
| 5 | `oblique-triangle-solve` | PC | Any triangle is two right triangles: the dropped height gives the law of sines; the angle B from it; the supplement ruled out because A is obtuse; the law of cosines for three sides; the swing for SSA. Exercises `drop`, `foot` on a segment, `meet`, `cases`. The hardest reasoning in the family, for the strongest writer. |

If the five land, the next wave completes the kit and the arc: `trig-triangle-area` (the first dropped height, four types served), `special-right-triangle` (the two cuts), `trig-equation-solutions` with `inverse-trig-value` (the kept half), `trig-context-triangle` (the mixed reading lesson), and `polar-cartesian-conversion` (the circle scaled).
