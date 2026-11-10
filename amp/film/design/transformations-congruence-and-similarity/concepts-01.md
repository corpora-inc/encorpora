# Transformations, congruence and similarity, part 1: the concepts

Ten problem types, two grade-8 skills. Each concept below stands on the family design (Part 1 foundations, Part 2 pictures, Part 3 fast ways). Types are in teaching order, which is not the catalog's order; the lesson list for the pilot is unchanged.

**Flagged first, so no lesson inherits it.**

- `transformation-composition-image` is filed under `rigid-motions`; its content is a dilation about a non-origin center, the hardest idea in the grade-8 half. Move it to `dilations-similarity` and mark the non-origin center as a stretch for 8.G.A.3. Designed below as a dilation lesson.
- `similar-triangles-side` and `similar-triangles-work` are linked to 6.RP.A.3. They practice 8.G.A.4 ("a two-dimensional figure is similar to another if..."); the proportion is the tool. Relink.
- `similar-triangles-work` generates triangles that cannot exist: in every sampled variant the stated angles and the stated sides disagree (AB = 7, BC = 6, CA = 3 with angles 50°, 20°, 110° would need the 110° angle opposite the side of length 7, but the law of sines gives three different scales). A to-scale figure is impossible for every variant. Fix the generator: pick three sides, compute the angles, round to whole degrees (5, 7, 8 gives 38°, 60°, 82°). Integer sides and integer angles never coexist except in the equilateral triangle, so rounding is the only honest fix; to the eye a one-degree rounding is invisible. The concept below uses a consistent example and asks that it become a seed.
- `transformation-rule-slots` and `dilation-rule-slots` expose answers as option ids ("d", "c", "e") with no option texts in the sampled output. The writer needs `facts.ts` to print the slot texts, as the design asked for the proof types.
- `transformation-image` promises "translation, reflection or rotation"; the six sampled wordings hold only reflections over an axis and 90° counterclockwise turns. Either the generator never produces translations or the sample missed them; the lesson covers translation in one beat either way.
- `dilation-image`, `dilation-scale-factor` and `dilation-rule-slots` are one idea three ways; they share one opening and one picture below, with the difference stated.

---

## Grade 8: rigid-motions (8.G.A.1, A.2, A.3)

Every film in this skill opens with the same forty-second foundation, drawn live, before any problem: a triangle ABC on the plane; "a transformation is a rule that tells every point where to go; the figure after is the **image**, and A′ (A prime) is where A landed." A translucent copy lifts off the triangle (the ghost stays in muted outline) and does the three moves in turn: slides along an arrow, flips over a line, turns about a dot. "Tracing paper never stretches: a slide, a flip and a turn keep every length and every angle. Same size, same shape, new place. These are the rigid motions." Then the **L** is defined on one corner: from the origin to A(3, 1) is "over 3, up 1," the slope triangle from the line lessons, drawn dashed in blue. "Every coordinate rule is read off the L." The type's own foundation follows.

### `transformation-image` — Where one corner lands

Standard: 8.G.A.3, "Describe the effect of ... translations, rotations, and reflections on two-dimensional figures using coordinates." Foundations 1, 2, 3.
Foundations first: the shared opening; then the mirror (a flip sends a point straight across the line to the same distance on the other side: the dashed perpendicular with equal ticks) and the pivot (a turn carries a point along an arc about the center; the arrow on the arc is the direction; "counterclockwise is the way against the clock's hands").
Read: which corner is asked (gold on C′: "C prime, where C lands"), which motion, which line or how many degrees and which way. At a glance: the quadrant the image must land in. A flip over the x-axis sends quadrant III to quadrant II; a quarter turn counterclockwise from quadrant II lands in quadrant III. Half the choices are usually in the wrong quadrant.
Example A, a flip: A(−3, 3), B(−6, 1), C(−1, −2), reflected over the x-axis; C′? Choices (1, 2), (−1, 2), (2, −1), (1, −2). (1) The triangle, C gold. (2) The x-axis is the mirror; a dashed perpendicular from C up through the axis: C is 2 below, so C′ is 2 above, ticks equal, the right-angle box at the crossing. The L from the origin: left 1, down 2; after the flip, left 1, up 2. The horizontal arm never moved. (3) The traced copy flips over; the labels take primes; the readout beside the landed corner: C′(−1, 2). (4) "You crossed the x-axis, so your height changed sign; x stayed."
Example B, a quarter turn (a different motion with a different apparatus, and the highest-stakes case): A(2, −6), B(6, 6), C(−1, 5), rotated 90° counterclockwise about the origin; C′? Choices (5, 1), (1, −5), (−1, −5), (−5, −1). (1) C gold, its L: left 1, up 5. (2) The pivot at the origin, the arc from C sweeping 90° against the clock, the right-angle box between the two radii. (3) The L turns with the copy: the arm that pointed up now points left, 5; the arm that pointed left now points down, 1. Left 5, down 1: C′(−5, −1). (4) Said once as the rule: "a quarter turn swaps the two numbers; the quadrant it lands in sets the signs."
A translation, if the app serves one, in one beat: "right 3, down 5 adds 3 to x and takes 5 from y; the same arrow at every corner."
Fast: flip over an axis: change the sign of the coordinate that crosses (over the x-axis, y). Quarter turn: swap, then the landing quadrant gives the signs. Half turn: both signs.
Sense: the image is the same distance from the mirror on the other side; the turned point is as far from the origin as it was, in the quadrant the arrow points to.
Check: undo it: flip C′ back over the x-axis, or turn it 90° clockwise, and read the original.
Rule out: wrong quadrant dims together with the one reason ("a quarter turn counterclockwise from here lands down here"). In A, only one choice keeps x = −1, and x cannot change in a flip over the x-axis. In B, (−1, −5) kept the numbers in place: a quarter turn always trades them.
Line: "Draw the L, move the L, read where its arms point."
Trap: "reflect over the x-axis" read as "change x." The perpendicular to the mirror shows the x arm untouched and the point crossing the axis. Second trap: the quarter-turn sign rule misremembered; here the signs are never recalled, only read from the quadrant the arc lands in.
Kit: `copy` with `reflect`/`rotate`, `primes`, `ghost`, `readout`; `ell` in the copy's group; `mirror`; `pivot` with `right: true`; `dim`.
Writer: a capable cheaper model, once `identify-rigid-motion` exists to establish the trace and apparatus; one action, one readout, the landing checked by `--dry` against `facts.ts`. If written first in the family, the strongest writer.

### `place-transformed-image` — Move the whole figure and place every corner

Standard: 8.G.A.3 (as above); this is the one grade-8 type that *draws* the image (HSG.CO.A.5's "draw the transformed figure", ahead).
Foundations first: the shared opening; the pivot and arc as in `transformation-image`; "clockwise is the way the clock's hands go." Then the one new idea: a figure moves when its corners move, so apply the rule to each corner and connect the images; the image is the whole triangle set down somewhere else.
Read: which motion, which way, and that every corner is asked, in order: P′ first, then Q′, then R′. At a glance: the whole image lands in one region (a clockwise quarter turn from quadrant I lands in quadrant IV); if a placed corner is not there, it is wrong.
Example: P(4, 1), Q(1, 3), R(5, 2), rotated 90° clockwise about the origin. (1) The triangle, the pivot at the origin, the arc on P sweeping 90° with the clock. (2) P's L: over 4, up 1. Turned clockwise, up becomes right and right becomes down: right 1, down 4. P′(1, −4), the copy turning as one piece, the ghost staying. (3) Q's L: over 1, up 3 → right 3, down 1: Q′(3, −1). (4) R's L: over 5, up 2 → right 2, down 5: R′(2, −5). (5) The rule written once the points agree: (x, y) → (y, −x). (6) The image triangle is the same triangle turned; the sides match in length: PQ and P′Q′ measured on the grid, both over 3 and up 2 (or down 3 and over 2).
Quick second case, a slide given in words: D(0, 1), E(0, −5), F(−3, 5) translated 5 units right: one arrow, "right 5," at every corner; add 5 to every x: (5, 1), (5, −5), (2, 5). The triangle keeps its shape and its way up.
Fast: do the L on one corner to find the rule, then apply the rule to the other two; place each image under its own label.
Sense: the image is congruent: same side lengths, same shape, in the region the arrow points to.
Check: turn the whole image back the other way (counterclockwise) and get P, Q, R; or check one side's length on both.
Line: "Move every corner by the same rule; connect them and the image is there."
Trap: clockwise and counterclockwise swapped, so every corner lands in the mirror-image quadrant. The arrow on the arc and the L turning make the direction visible, and the quadrant check catches a wrong placement before the last corner. Second: P′ dropped where Q′ belongs; the lesson lands each image beside its own ghosted original, so the letters travel with the points.
Kit: `copy` + `rotate`/`translate` with primes and three readouts; `ell` on each corner in turn; `pivot`; `arrow` with faint copies.
Writer: a capable cheaper model, after `transformation-image`.

### `transformation-rule-slots` — Match each motion to its rule with one test point

Standard: 8.G.A.3 (describe the effect "using coordinates"). Foundation 3.
Foundations first: the shared opening; then why a test point works: "a rule says where every point goes, so if we follow one point we know the rule. Pick a point whose two numbers are different and both positive, like (2, 3), so a swap shows and a sign change shows." The point is drawn with its L: over 2, up 3.
Read: the slots name transformations (flips over the x-axis, the y-axis, the line y = x; quarter turns clockwise and counterclockwise; the half turn) and the rules are arrow forms like (x, y) → (x, −y). At a glance: a flip over an axis changes exactly one sign; a half turn changes both; a quarter turn swaps.
Example: the one test point (2, 3) followed through every motion the slots name, each on the same small plane, each landing written as a rule the moment it lands. (1) Flip over the x-axis: crosses the x-axis, height changes: (2, −3) → (x, −y). (2) Flip over the y-axis: (−2, 3) → (−x, y). (3) Half turn: through the origin to the same distance beyond, both arms reverse: (−2, −3) → (−x, −y). (4) Quarter turn counterclockwise: the L turns, up becomes left (3), right becomes up (2): (−3, 2) → (−y, x). (5) Quarter turn clockwise: right becomes down, up becomes right: (3, −2) → (y, −x). (6) Flip over y = x: the arms trade: (3, 2) → (y, x). (7) The slots filled from the landings; the six images sit on the plane around the origin, labeled, as one picture: the two quarter turns are the two swapped points, the flips are the sign changes.
Fast: follow (2, 3); the image is the rule written with x = 2 and y = 3.
Sense: a flip over an axis leaves the point the same distance from that axis; a turn leaves it the same distance from the origin.
Check: apply the chosen rule to (2, 3) and get the point the picture shows.
Line: "One test point tells the rule."
Trap: the two quarter-turn rules confused, (−y, x) against (y, −x). The L turning with the arrow on the arc puts (−3, 2) up-left for counterclockwise and (3, −2) down-right for clockwise, read, not recalled. Second: a test point like (2, 2) or (0, 3), which cannot tell a swap from a sign change; the lesson says why the two numbers must differ.
Kit: a matching card on the board (slot names left, rules right, a line drawn as each match is made); `facts.ts` must print the slot and option texts. Six landings of one point: `copy` on a dot with `ell`, each ghosted.
Writer: the strongest writer. Six motions on one point is dense; the pacing and the one combined picture at the end are the lesson.

### `identify-rigid-motion` — Name the motion from the figure and its image

Standard: 8.G.A.2, "given two congruent figures, describe a sequence that exhibits the congruence between them" (here a single motion), with 8.G.A.3. Foundations 2, 3, 4.
Foundations first: the shared opening; then **orientation**: "go round the letters A, B, C on the original: do they go the clock's way or against it? A slide or a turn keeps that; a flip reverses it. So read the letters first: if they go the other way round on the image, a flip happened." Drawn as a curved arrow A→B→C inside each triangle, labeled clockwise or counterclockwise, with the traced copy flipping and its arrow reversing.
Read: both triangles are given by coordinates; the choices are four motions. At a glance: plot both (the lesson draws them); the orientation arrows answer "flip or not" before any arithmetic. Then one corner: what changed from A to A′.
Example A, the common case: A(5, 4), B(3, 1), C(−2, 1); A′(5, −4), B′(3, −1), C′(−2, −1). Choices: a translation 8 units down; a rotation of 180° about the origin; a reflection over the y-axis; a reflection over the x-axis. (1) Both triangles drawn, teal and rust; the orientation arrows go opposite ways: a flip. The half turn and the translation keep orientation: both dim, with that one reason. (2) A to A′: x stayed 5, y went 4 to −4: the point crossed the x-axis. The mirror is the x-axis; the dashed perpendicular with equal ticks. (3) Confirm on B: (3, 1) to (3, −1): same. The copy flips and lands exactly on A′B′C′; the outlines coincide and pulse. (4) A reflection over the x-axis. The translation decoy is named: "8 units down does take A to A′, but B would land at (3, −7); one corner can agree with two motions, two corners cannot."
Example B, the other fork, fully worked because the first glance goes the other way: A(−2, 1), B(6, 6), C(−1, −6); A′(2, −1), B′(−6, −6), C′(1, 6). Choices: a reflection over the y-axis; a rotation of 90° clockwise; a translation 4 right and 2 down; a rotation of 180°. (1) Orientation arrows go the same way: no flip; the reflection dims. (2) A to A′: both signs changed, through the origin to the same distance beyond: a half turn, or the slide right 4, down 2, which also fits A. (3) B: (6, 6) to (−6, −6): both signs again; the slide would give (10, 4). The 90° turn would send A to (1, 2). (4) The copy turns 180° about the pivot and lands. A rotation of 180°.
Fast: orientation first (flip or not), then what changed from A to A′ (one sign: a flip over that axis; both signs: a half turn; the same amounts added: a slide; swapped: a quarter turn), then confirm on B.
Sense: the landing: the moved copy sits exactly on the image.
Check: apply the chosen motion to C as well; all three must land.
Rule out: orientation kills the flips or kills everything but the flips, together, in one beat. Then the second corner kills the slide the generator planted to fit A.
Line: "Letters first, then one corner, then confirm on another."
Trap: checking one corner and choosing the translation that fits it. Every variant sampled plants exactly that decoy. The lesson never names a motion from one corner. Second: a half turn called a reflection ("the signs changed"): orientation settles it before the signs are read.
Kit: `copy` with all three transforms, `land` (and its gap on a near miss), `mirror`, `pivot`, `arrow`, `dim`; new: an **orientation arrow** part, a curved arrow through a polygon's vertices in letter order with a clockwise/counterclockwise label, that reverses on `reflect`.
Writer: the strongest writer. The family's picture is born here, and the decoys are reasoning.

---

## Grade 8: dilations-similarity (8.G.A.3, A.4)

Every film in this skill opens with the same foundation: a triangle on the plane and a dot for the **center**. "A dilation stretches a figure away from one point, the center, by one number, the **scale factor** k: what every length is multiplied by." Rays shoot from the center through each corner; each image corner slides out along its ray to k times the distance; the image draws. "Every length is k times as long; every angle is exactly what it was; every side is parallel to the side it came from. k bigger than one pushes away; k less than one pulls in." Then the L from the center to a corner, over 2 and up 4, grows to over 6 and up 12 for k = 3: "from the origin, k times as far is just multiply both numbers." The type's own foundation follows. (`transformation-composition-image`, below, adds the center that is not the origin.)

### `dilation-image` — Where one corner lands under a dilation from the origin

Standard: 8.G.A.3, "Describe the effect of dilations ... using coordinates." Foundation 5.
Foundations first: the shared opening.
Read: which corner, which k (gold), and that the center is the origin. At a glance: k < 1 means the image is nearer the origin than the original, on the same ray; k > 1 farther. The image stays in the original's quadrant.
Example: A(8, −8), B(8, −2), C(−8, −6); center the origin, scale factor ½; C′? Choices (−4, −6), (−16, −12), (−4, −3), (−8, −3). (1) The triangle, rays from the origin through all three corners, C gold. (2) C's L: left 8, down 6. Half of each arm: left 4, down 3. C′ sits on C's ray halfway to the origin; the readout (−4, −3). (3) The other corners pull in the same way and the image triangle draws at half size, sides parallel to the original's, parallel marks on one pair. (4) "Scale factor one half: half as far from the center. From the origin, halve both numbers."
Quick second case, a fraction greater than one: B(−4, 2) with k = 3/2: one and a half times as far: over −4 becomes −6, up 2 becomes 3: (−6, 3). The image is pushed out, not pulled in: a fraction can enlarge.
Fast: multiply both coordinates by k.
Sense: C′ is on the ray from the origin through C, half as far.
Check: multiply back: (−4, −3) × 2 = (−8, −6). Or the ray: C and C′ have the same slope from the origin (6/8 and 3/4).
Rule out: ½ pulls in, so (−16, −12), farther out, is gone. Both numbers scale, so (−4, −6) and (−8, −3) are off the ray: gone together ("the image must sit on C's ray; these do not").
Line: "Dilate: from the center, k times as far. From the origin, that is multiply both."
Trap: scaling one coordinate (the generator's planted decoys), and the belief that a fraction always shrinks. The rays make a one-coordinate image visibly off its ray; the 3/2 case pushes the point out.
Kit: `dilate` from the origin with `readout`; `rays`; `ell` original and k-times; `dim`.
Writer: a capable cheaper model; one action, one readout, checked by `--dry`.

### `dilation-scale-factor` — Find k from the two triangles

Standard: 8.G.A.3 and 8.G.A.4 (the dilation that "exhibits the similarity"). Foundation 5.
Foundations first: the shared opening; then the definition read backward: "if every image coordinate is k times the original, then k is image divided by original: new over old."
Read: both triangles given, center the origin; k asked, free response, possibly a fraction. At a glance: is the image nearer the origin (k < 1) or farther (k > 1)? That decides which way up the fraction must come out.
Example: A(−6, 9), B(−3, −6), C(6, −9); A′(−2, 3), B′(−1, −2), C′(2, −3). (1) Both drawn with rays; the image is inside the original, nearer the origin: k is less than one, so the answer is a fraction. (2) The ratio card: k = new over old = A′'s x over A's x = −2 over −6 = 1/3. (3) The y agrees: 3 over 9 = 1/3. (4) Confirm on B: −1 over −3 = 1/3. (5) k = 1/3; the L from the origin to A, left 6 up 9, and to A′, left 2 up 3, drawn one on the other.
Quick second case: A(−6, −6) → A′(−9, −9): farther out, so k > 1; 9 over 6 = 3/2: not every enlargement is a whole number.
Fast: image coordinate ÷ matching original coordinate, on any coordinate that is not 0; confirm with one more.
Sense: image inside, k under one; image outside, k over one.
Check: multiply an original coordinate by k and get the image.
Line: "New over old, the same way up every time."
Trap: the fraction upside down (3 for 1/3). The at-a-glance beat ("the image is nearer the origin, so k is less than one") is said before any division, so 3 cannot survive.
Kit: `rays`; the ratio card (`write` with the two sides named); `ell` on both.
Writer: a capable cheaper model.

### `dilation-rule-slots` — Write the dilation's rule

Standard: 8.G.A.3. The same concept as `dilation-scale-factor`, ending in the rule rather than the number.
Foundations first: as `dilation-scale-factor`; plus the rule form: "(x, y) → (kx, ky): the same k on both, because the whole L grows by one factor."
Read: one vertex and its image; two slots, the k in front of x and the k in front of y. At a glance: A(12, 3) → A′(4, 1) is pulled in, so k is a fraction under one, and the two slots hold the same k.
Example: (1) A and A′ on one ray from the origin; the image a third of the way out. (2) k = new over old on x: 4 over 12 = 1/3. (3) On y: 1 over 3 = 1/3: they agree, as they must. (4) The rule card: (x, y) → (⅓x, ⅓y); (12, 3) dropped through it on the next line gives (4, 1).
Fast: divide one nonzero image coordinate by its original; that k goes in both slots.
Sense: one ray, one stretch, one k.
Check: the other coordinate gives the same k; the rule applied to A returns A′.
Line: "One k, both places."
Trap: a different k in each slot from dividing one way (4/12) and the other way (3/1). The rule card's two slots are filled from the one k the picture shows, and the y division is done on screen to agree.
Kit: as `dilation-scale-factor`; `facts.ts` must print the slot option texts.
Writer: a capable cheaper model; share the screenplay's opening with `dilation-scale-factor`.

### `transformation-composition-image` — A dilation about a center that is not the origin, chained with a flip or turn

Standard: 8.G.A.3; the non-origin center is a stretch beyond the grade-8 norm, say so in the template. Foundations 3 and 5. Misfiled under `rigid-motions`; designed here.
Foundations first: the shared dilation opening, then the one new idea, built live: a center C that is not the origin, a point P, and the L drawn **from C** to P, not from the origin. "k times as far from the center: multiply the L's arms by k and walk them from the center." Then the order of a chain: "do the steps in the order the sentence says; one point, one line per step, and sketch where it lands each time."
Read: the point, the center (gold: not the origin), k, the rigid motion, and the order. At a glance: the dilated point is on the ray from the center through A, k times as far; the final image's quadrant follows from the flip or turn.
Example: A(−3, −6) is dilated with center (2, −4) and scale factor 3, then its image is reflected across the y-axis. Choices (5, −10), (9, −18), (−13, 10), (13, −10). (1) A, the center as a blue dot, the ray from the center through A. (2) The L from the center to A: left 5, down 2. Three times: left 15, down 6. From the center: (2 − 15, −4 − 6) = (−13, −10), far out along the ray; the readout. Ghost it. (3) Flip across the y-axis: x changes sign, y stays: (13, −10). The mirror with its perpendicular; the readout; the landing. (4) The board: three lines, "from the center: (−5, −2)", "times 3: (−15, −6)", "from the center: (−13, −10)", then "flip over the y-axis: (13, −10)".
Second example, fully worked but brisk, because the order is reversed and k shrinks: A(−4, −6) reflected across the y-axis, then dilated with center (−4, −4) and scale factor ½. (1) Flip first: (4, −6). (2) From the center to (4, −6): over 8, down 2. Half: over 4, down 1. From the center: (0, −5). The image sits halfway back toward the center along the ray. (3) (0, −5).
Fast: for the dilation step, write the L from the center, multiply both arms by k, add the center back; for the rigid step, the rule from the L. Steps in the written order.
Sense: after the dilation the point is on the ray from the center, k times as far (three times out, or halfway in); the flip or turn lands it in the quadrant the mirror or arc points to.
Check: undo in reverse: flip (13, −10) back to (−13, −10); from the center that is left 15, down 6; divide by 3: left 5, down 2: A. Also the distance: the dilated point is k times as far from the center as A.
Rule out: the quadrant kills (−13, 10) (the flip was over the y-axis, so y keeps its sign). (9, −18) is 3 × (−3, −6) flipped: the center treated as the origin, named and dimmed: "the center is (2, −4); that point is three times as far from the origin, not from the center." (5, −10) is not three times A's distance from the center.
Line: "From the center, k times as far. Not from the origin unless the center is the origin."
Trap: multiplying the coordinates straight, as if the center were the origin; the generator plants it every time. The L is drawn from the center dot in blue before any arithmetic, and the decoy is shown as the point that would land off the center's ray. Second: steps out of order; the board's one line per step in the sentence's order.
Kit: `dilate` with `center`; `rays` from a non-origin center; chained actions on one copy with ghosts at each landing; two readouts; a view wide enough for (−13, −10) and (13, −10) (about x from −16 to 16, y from −12 to 4); `dim`.
Writer: the strongest writer; the center-not-origin L and the chain are the design, and the view and pacing are delicate.

### `similar-triangles-side` — A missing side of two similar triangles

Standard: 8.G.A.4, "Understand that a two-dimensional figure is similar to another if the second can be obtained from the first by a sequence of rotations, reflections, translations, and dilations." Misfiled to 6.RP.A.3. Foundations 6 and 7.
Foundations first: the dilation opening, then **similar**: "one triangle is a dilation of the other, perhaps slid or turned afterward: every angle is the same, every side is k times its match." Then **corresponding**: "the matching parts: the parts that land on each other." Then the names card: "△PQR ~ △STU says P landed on S, Q on T, R on U, whatever the pictures look like. Write the names one over the other; a corner is a column; a side is two neighboring columns, and the third side wraps round: RP matches US." The card builds letter by letter under the two triangles.
Read: the correspondence sentence (gold on the three pairs), the three known sides of one triangle, one side of the other, and the side asked. At a glance: which triangle is bigger (one known pair tells), so whether the answer is bigger or smaller than its match; and which column pair the asked side is.
Example: △PQR ~ △STU; PQ = 12, QR = 15, RP = 14, ST = 6; US? (1) PQR drawn to scale from its three sides, sides labeled; STU drawn the same way up beside it, half size, as the dilation it is. (2) The names card: P Q R over S T U. (3) The one pair with both known: ST is columns 1 and 2, so ST matches PQ. k = new over old = ST/PQ = 6/12 = ½: the ratio card. The small triangle is half the big one. (4) US is columns 3 and 1, wrapping: US matches RP = 14. Both light gold on the figures. (5) US = 14 × ½ = 7. (6) Said once: "US and SU are the same side."
Quick second case, enlarging by a fraction: △JKL ~ △MNP; JK = 4, KL = 8, LJ = 6, NP = 20; PM? NP matches KL: k = 20/8 = 5/2; PM matches LJ: 6 × 5/2 = 15.
Fast: k from the one pair with both known, new over old; the missing side is k times its match, found by its columns.
Sense: the small triangle's side is smaller than its match; 7 is half of 14, as the picture is half.
Check: the third pair: TU = 15 × ½ = 7.5; all three sides of STU are half their matches.
Line: "The letters tell who lands on whom. New over old, the same way up every time."
Trap: pairing US with QR because QR is the "next" side given, or reading matches from where the triangles happen to sit. The names card pairs by columns only, and the wrap is drawn. Second: the ratio upside down; the at-a-glance "the small triangle is the small one" fixes k < 1 before dividing.
Kit: `names` card with `pair`; two triangles from three sides to scale (`poly` from computed points, side labels); the ratio card.
Writer: a capable cheaper model, once the names card exists.

### `similar-triangles-work` — Third angle, k, two sides, in order

Standard: 8.G.A.4 for the similarity, 8.G.A.5 for the angle sum ("the angle sum ... for triangles"). Misfiled to 6.RP.A.3. Foundations 6 and 7. The generator's triangles are impossible (see the flag above); the example here is consistent to the nearest degree and should become a seed.
Foundations first: the dilation opening and the names card as in `similar-triangles-side`; then "angles copy, sides scale": the small triangle slid onto the big one, matching corner on matching corner, the angles coinciding exactly while the sides fall short. And the triangle's 180°, named in one line: "you already know the three angles make a straight line."
Read: the steps card has four slots in order: the missing angle of the first triangle, k, then the two missing sides of the second. At a glance: the angle is 180° minus the two given, and the matching angle of the second triangle is the same number, never scaled; k comes from the one side given in the second triangle; the two answers are k times their matches.
Example (consistent): △ABC ~ △DEF; ∠A = 60°, ∠B = 38°; AB = 8, BC = 7, CA = 5; DE = 24. (1) ABC drawn to scale; DEF beside it, three times as large, the same way up. (2) ∠C = 180 − 60 − 38 = 82°; the angle arc marked; ∠F gets the same arc: angles copy. Slot 1: 82. (3) The names card: DE is columns 1 and 2, matches AB. k = 24/8 = 3, written as the fraction 3/1 the way the app's slot expects. (4) EF matches BC: 7 × 3 = 21. (5) FD matches CA: 5 × 3 = 15. (6) Standing them together: every side of DEF is three times its match; the angles sit on each other.
The "some steps are filled in" variant is the same lesson; a filled slot is read as a given.
Fast: 180 minus the two angles; k from the one pair with both sides, new over old; multiply the remaining two.
Sense: the longest side of one matches the longest of the other (AB ↔ DE), and the largest angle sits opposite it in both.
Check: all three side ratios are 3; the three angles of DEF add to 180.
Line: "Angles copy; sides scale."
Trap: scaling the angle (82 × 3), which the slot format invites because it sits above the scaled sides. The small triangle slid onto the big one shows the angles coinciding; the lesson says "angles copy" at the slot. Second: k upside down (8/24); the picture says DEF is the big one, so k is over one.
Kit: a steps card on the board (four slots filled in order, a filled slot shown as given); the names card; two triangles to scale; the slide-onto-corner motion (`copy` + `slide`). The generator fix for consistent triangles.
Writer: the strongest writer for the first screenplay (a chain with a to-scale demand the generator currently breaks); a cheaper model may write its siblings after.
