# Circles, ten concepts

These are the Geometry and Algebra 2 types not in the pilot. Foundation numbers refer to §1 of the family design; each lesson names its foundations in one line and shows the owned picture, never re-teaching them. Every figure is to scale and labeled; every angle is drawn at its stated degrees.

---

### `circle-segment-lengths` — Piece times whole

**Misfiled first.** The slope item (center (0, 3), P(−10, 3)) is HSG.GPE.B.5 with a circle as scenery; it belongs in family 27 (`circle-equations`). Until it moves, the lesson gives it one quick case so no learner meets it cold. Also: "meets it at A and then B" means A is always the near point; the lesson says so once.

**Standard.** HSG.C.A.2, "relationships among inscribed angles, radii, and chords": the secant and tangent products are the chord case, proved through inscribed angles. Slope item: HSG.GPE.B.5, "use them to solve geometric problems."

**Foundations first.** Define secant (a line that cuts the circle at two points), tangent (touches at exactly one), chord (the part of a secant inside the circle), and piece versus whole: from P, PA is the near piece, PB is the whole, out to the far point. Then the why on one figure: P outside, two blue secants, chords AD and BC drawn in; the inscribed angles at B and D stand on the same rust arc AC, so they are equal (foundation 7); triangles PAD and PCB share the angle at P, so they are the same shape; the small one slides and scales onto the big one; write PA/PC = PD/PB and cross-multiply: PA · PB = PC · PD. Then C and D glide toward each other along the rim until they merge at T: the secant has become a tangent and PC · PD has become PT · PT. Foundations 7 and 8.

**Read.** Asked: a whole (PD, PB), a piece (PT), or the chord inside (AB, CD)? The asked segment goes gold. At a glance: the line given completely fixes the product (3 × 10 = 30); the other line must give the same 30; a chord is a whole minus a piece, so "chord" means a subtraction at the end.

**The example.** "Two secants from an external point P meet a circle. The first meets it at A and then B, with PA = 3 and PB = 10. The second meets it at C and then D, with PC = 5. What is the length of chord CD?" Choices 6, 8, 21/5, 1. Figure: P outside; the first secant cuts a long chord AB (7); the second barely nicks the rim; a bracket from P to B labeled "whole", a short one for PA. (1) Read: chord CD, gold, the part inside the circle: PD minus PC. (2) First line, piece × whole: 3 · 10 = 30. (3) The second line must also make 30: 5 · PD = 30, PD = 6; the bracket P to D appears, 6. (4) CD = 6 − 5 = 1. (5) The picture agrees: that secant only nicks the circle.

Second case (a different act, the root): "PT is tangent at T; the secant meets at A then B; PA = 4, PB = 16. What is PT?" Choices 8, 64, 10, 12. The merged figure: PT · PT = 4 · 16 = 64, PT = 8.

Quick case (flagged): the radius from (0, 3) to P(−10, 3) is flat, slope 0; the tangent is perpendicular to its radius (foundation 6), so it stands upright: slope undefined. The decoy 0 is the radius's own slope.

**Fast.** Piece × whole for the line you know completely; the other line's piece × whole equals it; solve; subtract the piece if a chord was asked. Tangent: PT² = piece × whole.

**Sense.** The far point is farther, so PD > PC; a chord is shorter than its whole; a tangent length sits between the near piece and the whole (4 < 8 < 16).

**Check.** 5 · 6 = 30 = 3 · 10 and 1 + 5 = 6. Tangent: 8² = 64 = 4 · 16.

**Rule out.** PD is 30 ÷ 5 = 6 at a glance and the chord is less than that: 6 and 8 dim together; 21/5 is a proportion set up with the wrong pieces; 1 remains and is proved. Tangent: 64 is longer than the whole secant, gone; 12 is the chord AB, not PT.

**Line.** "Piece times whole equals piece times whole."

**Trap.** Multiplying the piece by the inside piece (PA · AB), and giving PD (6) when the chord was asked. Every bracket read as "whole" runs from P to the far point, and the board returns to the gold word after PD is found.

**Kit.** `seg.bracket` from a point to a far point (family §4.9); a `merge` glide of two points on a circle into one with the secant following; sliding and scaling one triangle onto a similar one (`slide` plus `dilate` suffice).

**Writer.** Strongest: the lesson is the similarity proof and the merge, and a weak author describes them instead of staging them.

---

### `circle-radii-triangle` — Two radii make an isosceles triangle

**Standard.** HSG.C.A.2, "relationships among inscribed angles, radii, and chords."

**Foundations first.** Chord defined; a minor arc measures the central angle that cuts it (one beat: the fan at O and the rust arc share the readout). Then foundation 5 built: radii OA and OB drawn teal with equal ticks, chord AB blue; "two radii, so two equal sides, so the two angles at the chord are equal" (family 23's isosceles fact, named, not re-taught); the three angles make 180.

**Read.** Angle or length? For angles: given the apex (central angle, or the arc that equals it), or given a base angle? For lengths: given the chord and perimeter, or the radius and perimeter? At a glance: a base angle is less than 90; the radius is more than half the chord.

**The example.** "Points A and B lie on a circle with center O, and AB is a chord. ∠AOB measures 78°. What is ∠OAB?" Figure to scale: the gold fan at O at 78°; ticks on OA and OB. (1) Read: the angle at A, on the chord, gold. (2) The two radii are equal, so the two base angles are equal; two equal gold fans at A and B. (3) Together they are 180 − 78 = 102. (4) Each is 102 ÷ 2 = 51. (5) 51 + 51 + 78 = 180.

Second case (lengths, a different act): "Chord AB has length 15. The perimeter of triangle OAB is 35. What is the radius?" The same triangle, three sides bracketed: the two radii together are 35 − 15 = 20; each is 10. Covered by the method, one beat each: base 32° given, apex 180 − 2 · 32 = 116; arc 76° means the central angle is 76, base (180 − 76) ÷ 2 = 52; radius 8 and perimeter 20, chord 20 − 16 = 4.

**Fast.** Base = (180 − apex) ÷ 2. Apex = 180 − 2 · base. Radius = (perimeter − chord) ÷ 2. Chord = perimeter − 2r.

**Sense.** Base angles are equal and less than 90; a radius is longer than half the chord (10 > 7.5).

**Check.** The three angles add to 180; the three sides add to the perimeter.

**Line.** "Two radii make an isosceles triangle."

**Trap.** 102 given as the base angle (180 − apex, not halved). The two equal gold fans share the 102 on screen before any number is boxed.

**Kit.** Equal-angle marks on fans (the arc analogue of `seg.ticks`).

**Writer.** Cheaper model: one triangle, one fact, a fast way that always works, the math check catching slips.

---

### `triangle-circle-centers` — Where equal distances meet

**Conceived as three questions under one name.** Which construction finds a circle's center; the angles of a quadrilateral inscribed in a circle; the radius of the circle through a right triangle. A reading lesson: each kind worked once from its own words.

**Standard.** HSG.C.A.3, "Construct the inscribed and circumscribed circles of a triangle, and prove properties of angles for a quadrilateral inscribed in a circle"; HSG.C.A.2, "inscribed angles on a diameter are right angles" (read backwards for the right triangle); 8.G.B.7 for the hypotenuse.

**Foundations first.** Foundation 9, built: a center is where equal distances meet. A triangle; a point slides along the perpendicular bisector of one side with two equal teal segments to that side's endpoints; the second bisector is drawn; where they cross, the third segment is drawn and is equal; the circle through all three corners appears: *through the corners, equal distance to points, perpendicular bisectors.* Then the twin: a point along an angle bisector with two equal perpendiculars to the sides; the second bisector; the circle touching all three sides: *touching the sides, equal distance to lines, angle bisectors.* Then foundation 7's consequence for a quadrilateral: angle A stands on the rust arc BCD, angle C on the arc DAB; the two arcs together are the whole rim, 360; each angle is half its arc, so A + C = 180. Opposite angles add to 180.

**Read.** "Through the vertices" or "touches the sides"? "Inscribed in a circle" with two opposite angles? "Right triangle" with the circle through its vertices? At a glance: for the quadrilateral the answer is an angle, not x, and the two opposite angles must add to 180; for the right triangle the hypotenuse is 17 before anything else.

**The example.** "Quadrilateral ABCD is inscribed in a circle. m∠A = (3x + 60)° and the opposite angle has m∠C = (2x + 90)°. What is m∠A?" Choices 6, 282°, 78°, 102°. Figure: the quadrilateral in its circle, the two arcs lit in turn. (1) Read: angle A is asked, gold. (2) Opposite angles of an inscribed quadrilateral add to 180: 3x + 60 + 2x + 90 = 180. (3) 5x + 150 = 180; 5x = 30 (margin −150); x = 6 (margin ÷ 5). (4) Back to the question: A = 3 · 6 + 60 = 78. (5) C = 2 · 6 + 90 = 102; 78 + 102 = 180.

Second kind, quick: "Which construction locates the center of the circle that passes through all three vertices?" The meet motion replays; perpendicular bisectors of two sides. "Touches all three sides" is the twin: angle bisectors.

Third kind, quick: "A right triangle has legs 8 and 15; the circle through its vertices has center at the midpoint of the hypotenuse. Radius?" Choices 8.5, 8, 17, 3. The right angle is an inscribed angle, so its arc is 180 and the hypotenuse is a diameter: 8² + 15² = 289, hypotenuse 17, radius 8.5.

**Fast.** Corners: perpendicular bisectors. Sides: angle bisectors. Inscribed quadrilateral: opposite angles sum to 180, solve, substitute back. Right triangle: half the hypotenuse.

**Sense.** The two opposite angles are each less than 180 and add to it; the circumradius is half the longest side.

**Check.** 78 + 102 = 180; 8.5 · 2 = 17 and 8² + 15² = 17²; act the chosen construction out on the figure and see the circle land.

**Rule out.** 6 is x, not an angle; 282 is 360 − 78 (a full turn used for a half); 102 is angle C: all dim with one reason. Right triangle: 17 is the diameter, 8 a leg, 3 nothing. Constructions: altitudes and medians have no equal distances in them, gone together.

**Line.** "Through the corners: perpendicular bisectors. Touching the sides: angle bisectors. Opposite angles in a circle add to 180."

**Trap.** Answering x; setting the opposite angles equal (x = 30, A = 150); the two centers swapped. The board returns to the gold word; the two arcs that make the whole rim; both constructions drawn with their equal segments.

**Kit.** The `meet` motion (point gliding along a bisector with equal segments live) and muted bisector construction marks; arc highlights of two arcs that complete the rim.

**Writer.** Strongest: mixed, and two of the three kinds are proof-pictures.

---

### `geo-centroid-median` — A median cut in three

**Misfiled first.** No circle, no standard id. This is HSG.CO.C.10 ("the medians of a triangle meet at a point") and belongs in family 29 (`triangle-proofs`); under `triangle-circles` it teaches a student that the centroid is a circle's center. Designed here so the type is not orphaned; move it.

**Standard.** HSG.CO.C.10, "the medians of a triangle meet at a point."

**Foundations first.** Define median (vertex to the midpoint of the opposite side; the midpoint ticked); the three medians drawn one at a time meet at one point, G, the centroid. Then the why, one shot: medians AD and BE; segment DE joins two midpoints, so it is parallel to AB and half as long (the midsegment, from family 29, named); triangle GDE is a half-size copy of triangle GAB (the small one slides and doubles onto the big one), so GD is half of GA. Every median is cut 2 : 1, the long part at the vertex. The median is three equal sections: ticks.

**Read.** Which part is asked: the vertex part (CG, AG) or the midpoint part (GD, GE, GF)? The letters say: G to a midpoint letter is the short part. At a glance: the short part is less than half the median; the long part more than half.

**The example.** "In triangle ABC, G is the centroid and BE is the median to AC. BE has length 18. What is GE?" Choices 18, 6, 12, 9. Figure: the triangle, median BE, G marked, E ticked as a midpoint. (1) Read: G to E, the midpoint end, gold: the short part. (2) The median is three equal sections: 18 ÷ 3 = 6 each; three ticks. (3) The short part is one section: GE = 6. (4) The long part BG is 12, and 12 + 6 = 18.

Second case (reading statements): "Which statement is always true?" with AG = ⅔(AD), AD = 2(GD), AG = GD, AG = 3(GD). Read each against the three-section picture: the vertex part is two of three sections, so AG = ⅔ AD. (AD = 3 · GD, not 2; AG = 2 · GD, not 3.)

**Fast.** Median ÷ 3; two sections to the vertex, one to the midpoint.

**Sense.** The short part is less than half the median; the two parts add to the median.

**Check.** 6 + 12 = 18 and 12 = 2 · 6.

**Rule out.** 18 is the whole median; 9 is half (there is no half here); 12 is the other part: dim together.

**Line.** "Two thirds to the vertex, one third to the midpoint."

**Trap.** Halving the median (9), or giving the vertex part when the midpoint part was asked. The three ticks, and the letters read aloud: G to E ends at the midpoint.

**Kit.** None: `mid`, `seg.ticks`, `slide`, `dilate`, `dim`.

**Writer.** Cheaper model.

---

### `tangent-circle-computation` — The right angle at the touch

**Note first.** The skill is linked to HSG.C.A.4 (construct a tangent from an outside point) but no item constructs; what it practices is below. Flag, not a change to the lesson.

**Standard.** HSG.C.A.2, "the radius of a circle is perpendicular to the tangent where the radius intersects the circle"; 8.G.B.7, "determine unknown side lengths in right triangles."

**Foundations first.** Foundation 6, built with the touch motion: a blue line slides in from outside and stops the moment it touches at T (define tangent); the radius OT is drawn; a muted segment from O to another point on the line is visibly longer: T is the closest point of the line to O, and the shortest way from a point to a line is perpendicular, so the right-angle mark appears at T. Then P on the tangent line and OP drawn: a right triangle whose hypotenuse is OP, center to point. One more beat for the second fact: a second tangent from P touching at B; the triangle OBP is the first one flipped over OP (same hypotenuse OP, same leg r), so the tangent segments PA and PB are equal.

**Read.** A length, an angle, or two tangents set equal? At a glance: the hypotenuse is center-to-point, so any answer for a tangent segment or radius is shorter than OP; the two acute angles of the triangle add to 90; for two tangents the answer is a length, not x.

**The example.** "Point P is outside a circle with center O and radius 9. OP = 15 and PT is tangent to the circle at T. What is PT?" Choices 15, 12, √306, 24. Figure to scale: the 9–12–15 triangle, right-angle mark at T on the rim, OP the long slanted side. (1) Read: PT, gold, the leg along the tangent. (2) Right angle at T; OP is the hypotenuse: 15. (3) 9² + PT² = 15²; 81 + PT² = 225; PT² = 144 (margin −81); PT = 12. (4) 9, 12, 15: the triangle is drawn exactly so.

Second case (the equal tangents, an equation): "Tangent segments PA and PB touch at A and B. PA = 4x − 24 and PB = 5x − 33. What is PA?" Choices 12, 9, 14, 6. The flipped-triangle figure. Equal tangents: 4x − 24 = 5x − 33; 9 = x (margin −4x, +33). Back to the question: PA = 4 · 9 − 24 = 12. Check PB = 45 − 33 = 12.

Quick case: "m∠TOP = 30°. What is m∠OPT?" The right angle at T takes 90; the other two share 90: 60. The decoy 150 forgot the right angle.

**Fast.** Mark the right angle at T; the hypotenuse is OP; Pythagoras with r and PT as legs. Two tangents: set equal, solve, substitute back. Angle: 90 minus the other acute angle.

**Sense.** PT and r are both shorter than OP; the angle at P is acute; PA comes out positive.

**Check.** 81 + 144 = 225. PA and PB both come out 12. 90 + 30 + 60 = 180.

**Rule out.** PT is shorter than OP = 15: 15, 24 and √306 (≈ 17.5) dim at once. Equal tangents: 9 is x, not a length. Angle: 150 is obtuse, 90 is T's angle, 30 is O's.

**Line.** "Radius and tangent: a right angle. Center to the point is the hypotenuse."

**Trap.** The right angle put at O or P, so OP is squared and added (√306); answering x (9). The touch motion lands the mark at T, on the circle; the hypotenuse is named aloud before any squaring; the board returns to PA.

**Kit.** `tangent` part and `touch` (family §4.4); `flip` over OP exists.

**Writer.** Cheaper model, once `touch` exists: one triangle, one right angle, the flip for equal tangents staged in the concept.

---

### `inscribed-polygon-reasoning` — Six radii around

**Standard.** HSG.CO.D.13, "Construct an equilateral triangle, a square, and a regular hexagon inscribed in a circle"; HSG.C.A.2 for the radii and chords.

**Foundations first.** Define regular polygon (all sides equal, all angles equal), inscribed (every corner on the circle), central angle (at O, between radii to neighboring corners). Then foundation 9 built live with the compass step: the compass opened to the radius, a muted arc from a point on the circle marks the next point; six steps land exactly on the start; the six teal radii are drawn; 6 × 60 = 360, so each central angle is 60; in each triangle the two radii are equal and the apex is 60, so the base angles are (180 − 60) ÷ 2 = 60: equilateral, so the side *is* the radius (teal). Then: join every second mark, an equilateral triangle; a square needs corners a quarter turn apart, 90, not 60, so the compass step cannot give it: a diameter, its perpendicular diameter, four corners joined.

**Read.** A number (central angle, perimeter), a reason, or a method? At a glance: the central angle is 360 ÷ n; a hexagon's perimeter is six radii; the hexagon cuts corners off the circle, so its perimeter is a bit less than the rim.

**The example.** "A regular hexagon is inscribed in a circle of radius 9 cm by stepping a compass opened to 9 cm around the circle. What is the perimeter of the hexagon?" Choices 54 cm, 27 cm, 18π cm, 108 cm. Figure to scale: the circle, radius 9, the six stepped points, the hexagon. (1) Read: perimeter, gold: the six sides. (2) Each central angle is 360 ÷ 6 = 60. (3) Each triangle is equilateral, so each side is a radius: 9. (4) Six sides: 6 · 9 = 54 cm. (5) The rim is 2π · 9 = 18π ≈ 56.5 cm, and the hexagon's straight sides are shorter than the arcs they cut off: 54, a bit less.

Quick cases (a different act, choosing a method): "Which method inscribes a square?" Act each choice out on the figure in one beat: three random points give a triangle that is not regular; stepping the radius six times gives the hexagon; every second mark gives the triangle; two perpendicular diameters give the square. "Why does each side equal r?" is the build's own sentence: central angle 60 and equal radii make the triangle equilateral.

**Fast.** 360 ÷ n. Hexagon perimeter 6r. Hexagon: step the radius six times; triangle: every second mark; square: perpendicular diameters.

**Sense.** The hexagon's perimeter is just under the circumference (54 against about 56.5).

**Check.** Six times 60 is 360; six times 9 is 54; the chosen method lands on the figure.

**Rule out.** 18π is the rim itself (curved, a little longer); 108 is twelve radii; 27 is three. Methods: "any three points" is never regular, gone first.

**Line.** "A hexagon in a circle is six radii around."

**Trap.** Central angle 120 (the hexagon's *interior* angle, which students know), and the side taken as an arc (2πr ÷ 6). The gold fan at O reads 60 while the interior angle at a corner is marked 120 in one beat; the straight teal side lies visibly inside its rust arc.

**Kit.** `step` (family §4.5) with `poly` through the stepped points; the perpendicular-diameter construction marks.

**Writer.** Borderline, as the family design said: try the cheaper model with the build fully staged here, and review the method cases hard.

---

### `circle-dilation-scaling` — Every circle is every other, scaled

**Misfiled first.** Linked to HSG.C.A.1 ("Prove that all circles are similar") but the items are 8.G.A.3/A.4 computations; the area factor k² is in neither standard's text (it is 7.G.A.1's scale-drawing area). Fix the links; the lesson keeps the k² item because the learner will meet it.

**Standard.** 8.G.A.4, "describe a sequence that exhibits the similarity"; 8.G.A.3, "the effect of dilations, translations ... using coordinates"; HSG.C.A.1 in spirit (the slide-and-dilate is the proof).

**Foundations first.** Foundation 10 built: two circles of radii r and R; "every point one radius from the center" means a circle is fixed by its center and radius alone; slide the small one until the centers coincide; dilate about that center by R/r (define dilation and scale factor: every distance from the center multiplied by k) until it lands on the big one. The radius is multiplied by k; the rim, being 2π radii, by k; the disk: the square on the radius becomes k × k squares, so area by k². One beat: this is why pi was one number in grade 7.

**Read.** Scale factor, a length ratio, an area ratio, or a sequence? At a glance: k is the new radius over the old; toward a bigger circle k > 1; a length changes by k, an area by k²; a sequence must end with the right center and the right radius.

**The example.** "Circle A has center (1, 2) and radius 2. Circle B has center (7, 2) and radius 6. Which sequence maps A onto B?" Choices: dilate by 3 about (1, 2), then translate by ⟨−6, 0⟩; dilate by 4 about (7, 2), then translate by ⟨6, 0⟩; dilate by 3 about (1, 2), then translate by ⟨6, 0⟩; dilate by 3 about the origin. Figure to scale on axes: both circles, centers dotted. (1) Read: a sequence, gold; it must leave a circle centered at (7, 2) with radius 6. (2) k = 6 ÷ 2 = 3. (3) Dilate about A's own center (1, 2) by 3: the center stays put, the radius grows to 6; the circle swells on screen. (4) Slide the center from (1, 2) to (7, 2): six to the right, ⟨6, 0⟩; the circle lands on B. (5) Center (7, 2), radius 6: it is B.

Quick cases (different acts): "Radii 7 and 11; dilation maps the 7 onto the 11. Scale factor?" 11/7, new over old. "Scale factor ⅓ maps A onto B. B's area is how many times A's?" (⅓)² = 1/9: the square on the radius shrinks to a ninth. "Circumference 14π, scale factor 5": lengths by k, 70π, one beat.

**Fast.** k = new radius ÷ old radius. Lengths × k, areas × k². Dilate about the circle's own center, then slide by the vector between centers (or slide first, then dilate about the new center).

**Sense.** Bigger target, k > 1; the area factor is the square of the length factor, so shrinking shrinks area more.

**Check.** The final center and radius are B's. 7 · 11/7 = 11. (⅓)² = 1/9. 14π · 5 = 70π.

**Rule out.** A sequence ending at the wrong center dims (about the origin moves A's center to (3, 6); ⟨−6, 0⟩ goes the wrong way; about (7, 2) by 4 gives radius 8 and moves the center): one beat, one reason each. Factor: 18 is a sum, 7/11 is upside down, 121/49 is the area factor.

**Line.** "Every circle is every other, scaled. Scale factor: new radius over old."

**Trap.** The factor inverted or taken as the difference; the dilation about the wrong center; the slide reversed. The factor is read off the two radii; the dilation is staged so the center visibly stays or moves.

**Kit.** `dilate` (family §4.6), `slide` exists; a square on the radius that scales with the circle.

**Writer.** Strongest: four decoys that are each a realistic motion error, and the proof-by-motion.

---

### `angular-velocity-problem` — Rim speed is radius times turning speed

**Standard.** HSF.TF.A.1, "radian measure of an angle as the length of the arc on the unit circle subtended by the angle" (s = rθ is this on a circle of radius r); HSN.Q.A.1, "choose and interpret units consistently in formulas."

**Foundations first.** Foundation 11 named in one line: a radian is one radius of arc, so a point turning through θ radians travels θ radii along the rim: s = rθ. Define angular speed ω (how many radians the angle grows each second) and linear speed v (how far the rim point moves each second): divide s = rθ by time, v = rω. One revolution is a full turn, 2π radians; that is the only place π enters. The roll motion: a wheel with a rust rim mark rolls along the ground, the trail growing to exactly rθ.

**Read.** Given v and r, asked ω? Given ω, r and time, asked distance? Given revolutions, asked radians or rim speed? The asked unit goes gold. At a glance: ω = v ÷ r; s = r · ω · t; π appears only when revolutions were given and is absent when radians were.

**The example.** "A point on the rim of a wheel with radius 50 cm moves at 600 centimeters per second. What is the wheel's angular speed in radians per second?" Choices 50/600 rad/s, 12/2π rev/s, 30000 rad/s, 12 rad/s. Figure: the wheel, radius 50 teal, rolling; after one second the rust trail is 600 cm long. (1) Read: radians per second, gold. (2) v = rω, so ω = v ÷ r. (3) 600 ÷ 50 = 12 rad/s. (4) Twelve radii of rim pass each second; the mark on the figure turns twelve radians, about two turns. (5) Said plainly: 12/2π revolutions per second is the *same speed in turns*; the question asked radians, so it is a right number in the wrong unit, and it dims for its unit.

Second case (revolutions enter): "A turntable with radius 10 cm turns at 50 revolutions per minute. How fast, in cm per minute, does a rim point move?" Choices 100π, 1000π, 500π, 5000π cm/min. Each revolution is 2π radians: ω = 50 · 2π = 100π rad/min. v = rω = 10 · 100π = 1000π cm/min. Sense: the rim is about 63 cm, fifty laps is about 3140 cm, and 1000π is 3140.

Quick case: "radius 45 cm, 9 rad/s, 5 seconds, how far?" s = r · θ with θ = 9 · 5 = 45 radians: 45 · 45 = 2025 cm; no π, because radians were given.

**Fast.** ω = v ÷ r. v = rω. s = rωt. Revolutions × 2π = radians.

**Sense.** 12 rad/s is about two turns a second on a 314 cm rim: about 628 cm/s. A distance in radians is "that many radii", no π.

**Check.** 12 · 50 = 600. 1000π ÷ 10 = 100π = 50 · 2π. 2025 ÷ 45 = 45 = 9 · 5.

**Rule out.** 50/600 divides the wrong way; 30000 multiplies (cm² per second, no meaning); 4050π adds a π that only revolutions bring; 405 forgot the time. The rev/s choice is named for what it is, so a careful student does not feel cheated.

**Line.** "Rim speed is radius times turning speed. A turn is two pi radians, and that is the only place pi comes from."

**Trap.** A π added to a radian answer because "circles have π", and the revolutions answer accepted for radians. The rolling trail is rθ with no π; the gold word is the unit.

**Kit.** `roll` (family §4.7).

**Writer.** Strongest: the units are the whole lesson, and one decoy is a true quantity that must be dimmed honestly.

---

### `reference-angle-standard-position` — Whole turns don't count

**Note first.** No standard id in the catalog; HSF.TF.A.2 fits. Four small questions under one name (quadrant, coterminal angle, reference angle in degrees, reference angle in radians with negative and multi-turn angles) and one picture carries all of them.

**Standard.** HSF.TF.A.2, "radian measures of angles traversed counterclockwise around the unit circle" (and clockwise, for negatives).

**Foundations first.** Foundation 12 built on the unit circle: standard position (the initial side along the positive x-axis, three o'clock); counterclockwise is positive, the gold fan opening; clockwise is negative, the fan running the other way; past 360 the fan coils, a second visible turn; angles that land in the same place are coterminal (differ by whole turns, which do not count). The quadrants numbered counterclockwise from the top right. The reference angle: the acute angle from the terminal side to the x-axis, drawn as a small gold fan that always drops to the nearest half of the x-axis, never the y. Radians on the same circle: π at the half turn, 2π a full turn, π/4 an eighth of a turn.

**Read.** Quadrant, coterminal, or reference angle? Degrees or radians, positive or negative, more than one turn? At a glance: strip whole turns first (360, or 2π); then the quadrant; a reference angle is acute; a coterminal angle "between 0 and 360" is the given angle plus or minus turns, never its sign flipped.

**The example.** "What is the reference angle of θ = −15π/4 radians, the acute angle between the terminal side and the x-axis?" Choices π/4, 3π/4, 7π/4, 5π/4. Figure: the unit circle with eighth-turn ticks labeled in π/4s. (1) Read: reference angle, gold; negative, so clockwise. (2) A full turn is 8π/4; the fan runs clockwise fifteen eighths, coiling once past a full turn and seven eighths more. (3) Strip the turns: −15π/4 + 2π = −7π/4; + 2π again = π/4. The fan's end sits one eighth above the positive x-axis: quadrant I. (4) In quadrant I the terminal side is already at the x-axis: reference angle π/4; the small gold fan is the angle itself.

Quick cases, same figure: 405°: one turn and 45 more, strip it, quadrant I, reference 45°. 11π/6: just short of a full turn, quadrant IV; the small fan drops up to the positive x-axis: 2π − 11π/6 = π/6. −π/3: clockwise a sixth of a turn, quadrant IV, reference π/3. Coterminal with −30° between 0 and 360: clockwise 30 lands just below three o'clock; add one turn: 330°. Quadrant of 290°: past 270, short of 360: IV.

**Fast.** Strip whole turns; find the quadrant; drop to the x-axis: I itself, II 180 − θ, III θ − 180, IV 360 − θ (π and 2π in radians).

**Sense.** A reference angle is acute; a coterminal angle differs from the given one by a whole turn.

**Check.** −15π/4 + 4π = π/4. 330 − (−30) = 360. The small fan and the terminal side meet at the x-axis on screen.

**Rule out.** Anything not acute dims together: 225, 405, 135; 3π/4, 7π/4, 5π/4. For coterminal: 30 is the sign flipped (a mirror, not a turn); 150 and 60 differ from −30 by no whole turn.

**Line.** "Whole turns don't count; the reference angle drops to the x-axis."

**Trap.** Measuring the reference angle to the y-axis, keeping the unstripped angle (405), and flipping the sign for coterminal (30 for −30). The coil shows the turn being stripped; the small fan never touches the y-axis; the mirror is shown once and named as not a turn.

**Kit.** `sector` with `coil: true`, negative `to`, and a radian readout in multiples of π; eighth- and twelfth-turn tick marks on the unit circle.

**Writer.** Strongest: four cases on one picture, where the temptation is a formula sheet.

---

### `sat-entry-radian-conversion` — What fraction of a half turn?

**Note first.** One concept with `degree-radian-conversion` (pilot #5); this type adds the SAT answer format (a fraction or decimal, a minus sign for clockwise, no mixed numbers). The lesson reuses the pilot's foundation and spends its own beats on the two things that differ: a negative angle and an angle past a full turn that must *not* be stripped.

**Standard.** HSF.TF.A.1, "radian measure of an angle as the length of the arc on the unit circle subtended by the angle."

**Foundations first.** Foundation 11 in brief: the radius laid along the rim, six and a bit in a turn, so a full turn is 2π radians and a half turn is π; on the unrolled rim, 180° and π are the same mark. Converting is one question: what fraction of a half turn is it? That fraction of π; or that fraction of 180. Then the SAT box, once: a fraction such as 7/2 or a decimal such as 3.5; a minus sign for clockwise; never a mixed number.

**Read.** Degrees to radians (the answer is a plain number k, no π), or radians to degrees? Negative means clockwise, and the minus stays. At a glance: 315 is almost a full turn, so k is almost 2; 11π/5 is a bit more than 2π, so more than 360.

**The example.** "An angle measures −315°. In radians its measure is kπ. What is the value of k?" Figure: the fan runs clockwise 315°, seven eighths of the way round; the unrolled rim beside it with π at 180. (1) Read: k, gold: the number in front of π. (2) What fraction of a half turn is 315? 315/180; both divide by 45: 7/4. (3) So the angle is 7π/4, and clockwise keeps the minus: k = −7/4. (4) Seven quarter-half-turns: the fan has swept three half turns and a half of one... seven quarters of a half turn, almost two half turns, almost a full turn: matches the picture. (5) Entry: type -7/4, or -1.75.

Second case (the other direction, and a turn not to strip): "An angle measures 11π/5 radians. What is its measure in degrees?" The fan coils once and goes on a tenth of a turn. 11/5 of a half turn: 11/5 · 180 = 396°. The question asks the angle's measure, not a coterminal one: 396, not 36. π/2 is covered: half of a half turn, 90.

**Fast.** Degrees ÷ 180, reduced, then π. Radians ÷ π as a fraction, times 180. Keep the sign.

**Sense.** Under a half turn, under π; near a full turn, near 2; past 2π, past 360.

**Check.** −7/4 · 180 = −315. 396 ÷ 180 = 11/5 (both divide by 36).

**Line.** "What fraction of a half turn? Half a turn is pi."

**Trap.** Treating π as a full turn (315/360 = 7/8, so 7π/8); multiplying by the wrong constant (180/π); dropping the minus; stripping the turn for 11π/5 (36); typing 1 3/4. The half-turn mark reads π on the unrolled rim; the fan runs clockwise and the minus is written as it runs; the coil stays in the picture while 396 is boxed; the entry box is shown with the fraction typed in.

**Kit.** `frac: "half"` on the fan (family §4.1) and the unrolled rim with π at 180; a small board card drawn as the SAT answer box.

**Writer.** Cheaper model: one question asked twice, a picture with named actions, arithmetic the math check verifies.
