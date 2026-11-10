# Area and perimeter, part 3: the per-type concepts (grade 6 to Geometry)

Eight problem types, in the order the family design lists them. Each stands on the foundations numbered in the family design and names them in one line rather than re-teaching them. Every number below was recomputed against the generated examples.

Three things to say before the concepts:

- `geo-ring-area` and `ring-area-steps` are one problem in two answer formats. One lesson serves both, and its working lands exactly on the three lines the steps format asks for (outer radius; R² − r²; the rounded area). Both are 7.G.B.4 content filed under a Geometry skill.
- `measurement-formula-justifications` is two lessons wearing one name: the circle's two arguments (this family and family 28) and the pyramid-and-cone third (family 25). Until the app splits it, the lesson has two parts with a short "why" before each; the concept below designs the circle part fully and the solids part as what family 25 should own.
- `coordinate-polygon` has a perimeter variant with a slanted side. That needs Pythagoras (family 27), which a Geometry student has, and the concept says so and works it.

---

### Grade 7: composite-measurement (7.G.B.6)

**`composite-face-prism-surface-area` — Surface area of a right prism with an L or T face.** Foundations 3, 4, 9.
Standard: 7.G.B.6, "surface area of ... three-dimensional objects composed of ... right prisms."
Foundations first: a *right prism* is a flat face pushed straight back; the *depth* is how far back; it is drawn going back at the one fixed angle every solid in the app uses, hidden edges dashed. Build it live: the L face flat-on, teal, then extruded 2 m back, the back face a copy. *Surface area* is the area of every face added up: the cardboard it would take to wrap it. Name the faces on the solid as each lights: front, back, and one side face for every edge of the L, six of them. Then the picture that carries the lesson: unroll. The six side faces peel off and lie flat end to end as one long strip; the string that walked around the face is its length, the depth is its height. "Area fills the face; perimeter wraps it."
Read: "surface area ... in square meters": every face, once, in square units. The face has labeled sides and unlabeled ones; the unlabeled ones must be found first. At a glance: the answer is more than two faces' worth, and the band is a strip only as tall as the depth.
Example: L-shaped face, bottom 8 m, left side 5 m, top 4 m, right side 2 m, depth 2 m. (1) The two unlabeled sides: a copy of the left side slides over to lie along the right side and the inner step: 5 − 2 = 3; a copy of the bottom slides up: 8 − 4 = 4. Both written on the figure in gold as they are found. (2) Face area, cut: the bottom bar 8 × 2 = 16 (teal), the upright 4 × 3 = 12 (blue); 28. The other way, once: the box 8 × 5 = 40 minus the missing corner 4 × 3 = 12; 28. They agree. (3) Front and back: 2 × 28 = 56. (4) Walk the face: 8, 10, 14, 17, 21, 26; the string ticks at each corner, and the two inner sides count because they are edges. (5) Unroll: the band is 26 m long and 2 m tall: 52. (6) 56 + 52 = 108 square meters.
Quick second case, a T face (eight edges): the string crosses all eight, including the two short ones under the crossbar; eight side faces, one band, the same two lines. No new method, so three or four beats.
Fast: 2 × face area + face perimeter × depth. For an L or T the perimeter is the box's perimeter, 2(8 + 5) = 26 (the slide-out from grade 4, named in one line).
Sense: more than 56 (two faces); the band is a long thin strip, 26 by 2.
Check: count the faces in the unrolled net: six strips and two faces, eight; or add the six strips themselves: 16 + 4 + 8 + 6 + 8 + 10 = 52.
Line: "Area fills the face; perimeter wraps it."
Trap: leaving out the back face (one face plus band: 80), or the faces inside the notch (walking only the labeled sides). The unroll lays every side face flat, and the string that made the strip's length visibly turned every corner. Also adding the depth to the perimeter instead of multiplying: the strip's height is the depth, so it multiplies.
Kit: `prism` with `faces` and `unroll`; `walk` on the face with its running label; deduced `dims` on the word.
Writer: strongest. The lesson is the unroll and the hunt for lost faces; a weak author describes the strip instead of building it from the string.

---

### Grade 7 content, filed under Geometry: geo-ring-area and ring-area-steps (7.G.B.4)

**`geo-ring-area` and `ring-area-steps` — The area of a walkway around a circular pool.** Foundation 10, standing on family 28.
Standard: 7.G.B.4, "Know the formulas for the area and circumference of a circle and use them to solve problems." The skill sits in the Geometry band; the content is grade 7.
Foundations first: *center*; *radius*, center to edge; *diameter*, straight across through the center, twice the radius; the circle's area, πr², named as known from family 28 (π a little more than three). A *ring* is the region between two circles that share a center; its width is the gap between the edges, the same all the way around. Then the one new idea, drawn: the walkway is the big circle with the pool taken out. "Taking away is area too": big area minus small area, never big radius minus small radius.
Read: radius or diameter (gold on whichever word appears); the width; "to the nearest square foot." At a glance: the outer radius is the inner radius plus the width, once; the answer is far less than the outer circle's area.
Example: pool radius 16 ft, walkway 3 ft wide (both types generate it; answer 330). (1) Two circles on one center, to scale; the radius 16 drawn from the center to the pool's edge; the width 3 marked between the edges. (2) The outer radius: from the center to the outer edge is 16 then 3 more: R = 19, drawn as one longer radius. (3) Square each radius: 19² = 361, 16² = 256. (4) Subtract: 361 − 256 = 105. (5) Times π once: 105 × π = 329.87...; the pool fades to muted and the walkway keeps its color as the subtraction is written. (6) 330 square feet. In the steps format the three entries are exactly steps 2, 4 and 6.
Second case, fully worked because the read is different: diameter 14 m, width 3 m. The diameter is across; half of it is the radius: 7. Outer radius 7 + 3 = 10. 100 − 49 = 51. 51π = 160.2...; 160. Short: the picture already exists; what changes is the first move.
Fast: R = r + width; π(R² − r²): square, subtract, then one multiplication by π; round only at the end.
Sense: a walkway is a strip 3 feet wide and roughly 100 feet long (the way around the pool), so roughly 300. Also: far less than the outer circle's 1,134.
Check: compute the two areas separately and subtract: 1,134.1 − 804.2 = 329.9. For the diameter case, the outer radius must be less than the given diameter.
Line: "Square first, then subtract."
Trap: π(R − r)² = π · 9 ≈ 28, a circle three feet across, visibly tiny next to the walkway on the figure; using the diameter as the radius, which the halving beat in the second case kills; adding the width to the diameter instead of to the radius (the width is marked on one side of the pool only).
Kit: `ring` (two circles on one center, width dim between the edges, the inner one removed to muted); radius labels that ride the circle.
Writer: a capable cheaper model. One method, one picture with named actions, every number checked by the board.

---

### Grade 6: coordinate-polygons (6.G.A.3, 6.NS.C.8)

**`coordinate-side-length` — The length of a horizontal or vertical side from its endpoints.** Foundation 8, standing on family 3's distance on a line and family 13's plane.
Standard: 6.G.A.3, "use coordinates to find the length of a side joining points with the same first coordinate or the same second coordinate"; 6.NS.C.8, "use of coordinates and absolute value to find distances between points with the same first coordinate or the same second coordinate." The clause "Draw polygons in the coordinate plane given coordinates" is never asked by the app, so the lesson draws the polygon on screen.
Foundations first: the plane is two number lines crossing at zero; a point is (x, y), first number left or right, second number up or down; a *vertex* is a corner. Plot the six points one by one and join them in order; the hexagon appears, to scale on a visible grid. Then the idea: two points with the same second coordinate are at the same height, so the side between them is level, lying along one line; its length is the gap between the two first coordinates on the x number line, and that gap is counted with hops. Same for a shared first coordinate and an upright side.
Read: "the length of side EF": find E and F, and ask which coordinate they share (gold on the two 1s). At a glance: the answer is the gap from −5 to 2 on a number line, and since they sit on opposite sides of zero it is more than either number alone.
Example: hexagon A(−5, 4), B(3, 4), C(3, 3), D(2, 3), E(2, 1), F(−5, 1); side EF. (1) Hexagon plotted and joined; EF gold. (2) E and F both have 1 as the second coordinate: the side is level at height 1. (3) Hop from F at −5 toward E: five hops to zero, two more to 2, the arcs counted aloud; the running count reads 7. (4) Written: −5 to 0 is 5; 0 to 2 is 2; 5 + 2 = 7. (5) 7 units.
Quick second case, same figure: side DE, D(2, 3), E(2, 1). Same first coordinate, 2: upright. From 1 up to 3, both on the same side of zero: 3 − 1 = 2. Three beats.
Fast: find the shared coordinate; the length is the gap in the other one. Same side of zero: subtract the distances from zero. Opposite sides: add them.
Sense: the hops land on the other endpoint; a side that crosses zero is longer than either number.
Check: hop the other way, from E to F; or count the grid squares along the side on the figure.
Line: "Same coordinate, same line: the length is the gap in the other one."
Trap: subtracting the shared coordinates and getting 0; or "from −5 to 2 is 3" by subtracting the digits. The hops count five to zero and two past it, so 3 is never on screen.
Kit: `hops` on an axis-aligned segment (unit arcs with the running count); points labeled with their coordinates (exists).
Writer: a capable cheaper model.

**`coordinate-rectangle-measure` — A rectangle's perimeter or area from its vertices.** Foundations 2, 4, 8.
Standard: 6.G.A.3 and 6.NS.C.8 as above, "in the context of solving ... mathematical problems."
Foundations first: the rectangle plotted from its four vertices on the grid. Then fifteen seconds of the family's opening, because this type forks on the word: teal floods the inside, "area: how many squares it covers"; the string walks the edge, "perimeter: how far around, in plain units." Opposite sides of a rectangle are equal (family 22), so two side lengths are enough.
Read: "perimeter" or "area" goes gold, and the unit follows (units; square units). At a glance: one level side and one upright side give everything.
Example: A(3, 4), B(7, 4), C(7, −5), D(3, −5); perimeter. Chosen because its two sides are the two cases of the side rule. (1) Plot and join. (2) AB is level (both 4): from 3 to 7, same side of zero: 7 − 3 = 4; hops confirm; "4" written on its bracket, and on the opposite side CD. (3) AD is upright (both 3): from 4 down to −5, opposite sides of zero: 4 to zero, 5 more: 9; written on AD and BC. (4) Walk: 4, 13, 17, 26; or one of each, doubled: 2 × (4 + 9) = 26. (5) 26 units.
Quick second case, area: A(−6, 1), B(−4, 1), C(−4, −2), D(−6, −2). Width from −6 to −4, both below zero: 6 − 4 = 2. Height 1 to −2: 1 + 2 = 3. Rows of squares: 2 × 3 = 6 square units; the grid shows the six.
Fast: one level side, one upright side; then 2(l + w) or l × w.
Sense: the perimeter is more than twice the longer side (18); the area is the count of grid squares inside, visible.
Check: walk from the opposite corner; count the squares on the grid.
Line: "Two sides is enough: the other two match."
Trap: the sign slip on the side that crosses zero (4 − 5 = 1, giving 10); mixing the measures. The hops and the gold word.
Kit: `hops`; `region` taking its vertices from named points on `axes`.
Writer: a capable cheaper model.

---

### Geometry: coordinate-measurement (HSG.GPE.B.7)

**`coordinate-polygon` — A polygon's area or perimeter from its vertices.** Foundations 7, 8, 10, standing on family 27 for slanted sides.
Standard: HSG.GPE.B.7, "Use coordinates to compute perimeters of polygons and areas of triangles and rectangles, e.g., using the distance formula." Two cases: area (box minus corners) and perimeter (slanted sides need the distance formula). The generated areas are triangles and convex quadrilaterals, so every corner piece is a right triangle; a vertex off the box edge, which would make a rectangle-plus-triangle corner, never occurs in the variants, and the lesson says the method handles it anyway.
Foundations first: compact, but built. Plot the vertices and join them in the order given. Level and upright sides: the gap between the coordinates that differ (grade 6, one line). Then the one picture: every slanted side sits in its own small box, the right triangle whose legs are the gaps. For area, that triangle is half its box (foundation 7); for perimeter, the slanted side is its hypotenuse, so its length is √(run² + rise²), which is all the distance formula is. Then the big box: a dashed rectangle snaps around the polygon; the polygon is the box minus the corner pieces; "taking away is area too."
Read: "area" or "perimeter" gold; "in order" tells which vertices are joined. At a glance: the area is less than the box's and, for a fat convex shape, more than half of it; a perimeter is more than twice the longest side.
Example (area): A(−1, 3), B(4, 1), C(6, 6), D(0, 9). (1) Plotted and joined; the box snaps on: x from −1 to 6, 7 wide; y from 1 to 9, 8 tall: 56, written faintly beside the box. (2) Each corner in turn shades in its own color and its legs are read off by hops: at the bottom-left, from A down to 1 is 2 and from −1 across to 4 is 5: half of 2 × 5 = 5. Bottom-right: 2 and 5: 5. Top-right: from 6 up to 9 is 3, from 0 across to 6 is 6: 9. Top-left: 1 and 6: 3. (3) Corners total 22; they fade to muted and the polygon stands alone. (4) 56 − 22 = 34 square units.
Second example (perimeter), fully worked because the case is different: A(0, −1), B(4, −1), C(4, 2). AB level: 4. BC upright: 3. CA slanted: its small box is 4 by 3, and CA is the diagonal: √(4² + 3²) = √25 = 5. 4 + 3 + 5 = 12.
Fast: area: box minus corners, each corner half of leg × leg, legs from the coordinate gaps. Perimeter: gaps for straight sides, √(run² + rise²) for slanted ones.
Sense: 34 is between half the box (28) and the box (56); a slanted side is longer than either leg and shorter than their sum (3 < 5 < 7).
Check: the corners and the polygon must exactly fill the box: 22 + 34 = 56, each leg recounted on the grid; 9 + 16 = 25 for the hypotenuse.
Line: "Box it, then take the corners away."
Trap: forgetting the half on the corner triangles (56 − 44 = 12), or treating a slanted side as a base with a slanted "height". The corner shades as a triangle inside its visible small box. For perimeter, adding the two legs instead of taking the hypotenuse: the small box shows the diagonal is shorter than the two legs walked.
Kit: `box` with named corner pieces and their inside labels; `hops`; `region` from named points on `axes`; the small box around a slanted side with its right-angle mark.
Writer: strongest. The lesson builds box-and-subtract from scratch and must choose, stage and label four corners cleanly; this is where a weak author lets labels collide or recites the shoelace recipe.

---

### Geometry: geometric-design (HSG.MG.A.3)

**`geometric-design-constraint` — Choose the design that meets a constraint and compute a cost.** Foundations 6, 10, 11, standing on family 25 for the box. A mixed type: four stories, one habit.
Standard: HSG.MG.A.3, "Apply geometric methods to solve design problems (e.g., designing an object or structure to satisfy physical constraints or minimize cost)"; 7.G.B.6 for the wall and the box.
Foundations first: a *constraint* is a condition every option must meet (so much fence, so much volume), and it fixes one measure; the question asks about a different one. The one idea true for all four stories: check that each option meets the constraint, then compute the asked quantity for every option and compare. The picture tells you which should win and why; the arithmetic proves it. From grade 4, one line: with the same perimeter, the squarer rectangle covers more. Define *cost* as area times price per square unit when the paint story arrives.
Read: the constraint word gold ("48 m of fence", "exactly 120 cm³", "40 m"); then what is compared ("greatest area", "least cardboard", "how much does it cost"). At a glance: a candidate that fails the constraint is gone before anything else; a very long, thin option never wins a "most inside" or "least outside" question.
Four examples, one per story, each worked from its story:
- *Closed pen, 40 m, greatest area.* The string closes all four sides. Table beside the figure, one row per option: 10 × 10 = 100; 18 × 2 = 36; 11 × 9 = 99; 16 × 4 = 64. Each option's string is 40, drawn to scale, the square visibly fattest. 10 by 10.
- *Against the barn, 48 m, three sides.* The string runs on three sides only: two widths and one length, 2w + l = 48; every option is checked (19·2 + 10, 5·2 + 38, 16·2 + 16, 12·2 + 24: all 48). Areas: 190, 190, 256, 288. Width 12, length 24. Why the square loses, staged: flip the pen across the barn wall; the fence and its mirror image make one closed fence of 96 m around a rectangle twice as tall, and the squarest closed rectangle with 96 m is 24 by 24. Half of it is 12 by 24. The barn pays for the fourth side, so the free side should be the long one. "Squarer still wins, for the pen and its reflection."
- *Box of 120 cm³, least cardboard.* Each option multiplies to 120 (checked). Cardboard is surface area, six faces in three pairs (family 25, one line): 3 × 5 × 8: 2(15 + 40 + 24) = 158; 4 × 5 × 6: 2(20 + 30 + 24) = 148; 1 × 10 × 12: 284; 2 × 2 × 30: 248. 4 × 5 × 6, the one nearest a cube.
- *Paint the wall minus the window.* Wall 11 × 5 = 55; the window 1 × 2 = 2 fades to muted; 53 square meters to paint; 53 × 6 = 318 dollars.
Fast: compute every candidate. The habit, not a rule.
Sense: for most-inside, the squarest shape wins when the fence closes; against a wall, length twice the width; for least-outside, the cubiest box; a cost is the painted area times the price, so it is more than the area and less than the whole wall's cost.
Check: the winning option satisfies the constraint when recomputed; the paint cost divided by 6 gives 53, and 53 + 2 = 55.
Rule out: an option that fails the constraint, at once. 18 × 2 and 2 × 2 × 30 and 1 × 10 × 12 are far from square or cubic, gone at a glance; the near options (11 × 9; 3 × 5 × 8) are decided by computing. In the paint story, name each decoy for what it forgot: 53 forgot the price, 330 painted the window, 12 painted only the window.
Line: "Compute every candidate."
Trap: picking the square against the barn (16 × 16 = 256 < 288): the three-sided string and the mirror. Comparing volumes for the box (they are all equal by construction). Painting the window.
Kit: `region` with a three-sided `walk` and a `flip` over the wall line (flip exists); `table` filled one row per candidate on the word (exists); a cuboid with its three face pairs lit, which is family 25's `prism` or the app's cube solids through `scene`.
Writer: strongest. Mixed, modeling, and the one lesson where the family's shortcut fails and the reason must be staged.

---

### Geometry: measurement-formula-proofs (HSG.GMD.A.1)

**`measurement-formula-justifications` — Why the circle formulas are true (and, until the split, the third for pyramids and cones).** Foundation 10 and 7, with family 28's π.
Standard: HSG.GMD.A.1, "Give an informal argument for the formulas for the circumference of a circle, area of a circle, volume of a cylinder, pyramid, and cone. Use dissection arguments, Cavalieri's principle, and informal limit arguments"; 7.G.B.4, "give an informal derivation of the relationship between the circumference and area of a circle." The solid variants also serve HSG.GMD.A.3 and 8.G.C.9. Split by solid; one generated choice is cut off mid-word ("Cutting i]") and must be fixed in the app.
Foundations first (circle part, built in full; a Geometry student has never watched it done slowly): π is defined as C ÷ d, and it is the same for every circle because every circle is a scale copy of every other, so the ratio of any two lengths is fixed; hence C = πd = 2πr. That is the justification of the circumference formula, and one of the five variants asks for exactly it. Then the dissection: the circle is cut into 8 equal sectors (a *sector*: a pie slice, two radii and an arc) and fanned out alternately up and down into a bumpy shape; cutting and moving never changes area (foundation 7, one line). Then 16, then 32: the arcs get shorter and nearly straight, the bumps flatten, and the shape nears a rectangle. Its long side is made of half the arcs, so it is half the circumference, πr; its short side is a radius, r. The rectangle's area is πr · r = πr². The "limit" word is said once: the more sectors, the closer; the area it approaches is the circle's.
Read: which of three questions: why it approaches a rectangle; what area it approaches for a given radius; what justifies C = 2πr. At a glance: for radius 9, half the circumference is 9π and the height is 9, so the answer has 81 in it and π in it.
Example (the area variant): radius 9. Fan at 8, 16, 32 with the long side labeled "half the circumference" and the short side "the radius" as they straighten; πr with r = 9 is 9π; times 9: 81π. Then the "why" variant is answered on the same picture in two beats: the arcs get thinner and nearly straight, so the long sides become straight and parallel; nothing was added and the radius never changed. The circumference variant is the opening, recalled.
Fast: the rectangle is πr by r. Read it off.
Sense: 81π ≈ 254, a little more than three-quarters of the 18 × 18 box around the circle (324), as a circle should be.
Check: the shape's area never changed while fanning, so the rectangle's area is the circle's: πr · r.
Rule out (named together): "the pieces get larger" and "the radius grows": cutting more makes thinner pieces of the same circle, nothing grows; "adds area": moving pieces never changes area. For the area choices: 9π is only the long side; 81 forgot π; 162π used the whole circumference, but half the arcs are on top and half underneath. For the circumference: "a polygon with r sides" treats a length as a count; "area divided by r" gives πr, half the circumference; "measuring a few circles gave 6.28" is evidence, not an argument, and the lesson says that distinction aloud, since it is what Geometry is for.
Line: "Cut it thin, fan it out: half the circumference by the radius."
Trap: taking the full circumference as the long side (162π). The fan shows half the arcs up and half down.
Solids part (family 25 should own it; flagged, compact here so the variants are covered): a cube of edge 6 cut into three congruent square pyramids with apexes at one vertex, each pyramid lit in turn; equal pieces of 216, so one is 72, and that is the third in the pyramid formula seen once for real. A cone and a cylinder with the same base and height, cross-sections at matching heights: the cone is to the cylinder as a pyramid is to its prism, one third; 48 ÷ 3 = 16. Rule out: 36 and 108 (216 ÷ 6; half), 12 (base area ÷ 3, not volume), 24 and 144 and 32 (half, triple, two thirds). Needs a cube dissected into three pyramids and a cone inside its cylinder with a sliding cross-section plane: new kit, built with family 25.
Kit: `sectors` and `fan` with n rising 8, 16, 32 on successive words and the two sides labeled as they straighten; for the solids, the three-pyramid cube and the cone-in-cylinder cross-section (family 25).
Writer: strongest. It is an argument with "which statement" choices; the quality is the reasoning and the staging of the limit, and the evidence-versus-justification distinction must be said precisely.