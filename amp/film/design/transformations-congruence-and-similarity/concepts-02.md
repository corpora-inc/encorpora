# Transformations, congruence and similarity, part 2: ten concepts

Written from the family design. Each concept names the foundations it stands on (numbered as in Part 1) and the apparatus it uses (Part 2). Three things to say before the concepts:

- `scale-factor-effects-blanks` is misfiled (7.G.B.6 is composite area) and the k² fact is not in any Common Core standard; the lesson teaches it anyway, as foundation 11, because every state test asks it.
- `mcas-congruence-statement-select` is linked to HSG.SRT.B.5 but practices HSG.CO.B.7's forward clause; `congruence-by-rigid-motion` and `geo-reflection-side` depend on a figure whose coordinates and letter placement are not in the problem text. `facts.ts` must expose them, or the concept stage is guessing.
- One item is defensible two ways: in `transformation-invariant-claims`, "X′ is the mirror image of X across a line through C" is true for every rotation about C (the line is the bisector of ∠XCX′). Reword the decoy ("across a given line through C") or replace it.

---

### Grade 8: dilations-similarity

**`scale-factor-effects-blanks` — Perimeter times k, area times k squared.** Foundation 11.

**Standard.** Misfiled under 7.G.B.6. Nearest: 7.G.A.1 "computing actual lengths and areas from a scale drawing"; the k² relation itself is a state-standard fact. Filed in 8.G.A.4, which is fine for placement.

**Foundations first.** Say what a dilation does in one line (foundation 5: every length times k). Then build the fact: a unit square on the grid; dilate it by 3; it is now a 3 by 3 block, and its cells are counted, one, two ... nine. "Every length grew three times. Every unit square inside became nine unit squares." Perimeter is a walk around the edge, made of lengths, so it grows like a length. Area is made of unit squares, so it grows like the square. Define perimeter and area in passing (the distance around; the space inside, counted in unit squares).

**Read.** "Dilated by a scale factor of 5. Complete the sentence about the image." Two blanks: how many times the perimeter, how many times the area. At a glance: with k bigger than one both grow, and the area blank is the bigger number; with k a fraction both shrink, and the area blank is the smaller fraction.

**The example.** A rectangle 3 long and 4 wide, k = 5. (1) The rectangle on the grid, its 12 cells visible, sides labeled 3 and 4, perimeter 14 written as 3 + 4 + 3 + 4. (2) Project from a corner by 5: the image is 15 by 20, to scale, the original's ghost in its corner. (3) The perimeter is the walk around: 15 + 20 + 15 + 20 = 70, and 70 = 5 × 14. One beat: every side is 5 times, so the walk is 5 times. (4) One original cell lights gold; its image is a 5 by 5 block of 25 cells. The image is 12 such blocks: 12 × 25 = 300, and 15 × 20 = 300. (5) The sentence fills on the words: perimeter 5 times, area 25 times.

**Second example** (a different case the learner meets: a fraction). 3 by 6, k = ⅓. The image is 1 by 2; perimeter 18 → 6, a third; area 18 → 2, a ninth. A 3 by 3 block of original cells shrinks to one cell. "One third squared is one ninth: a fraction squared is smaller still."

**Fast.** Perimeter blank: k. Area blank: k × k. Always.

**Sense.** The area number is farther from 1 than the perimeter number, on either side of 1.

**Check.** Multiply the sides by k and compute the image's perimeter and area directly: 70 and 300.

**Line.** "Lengths times k, areas times k squared."

**Trap.** Area times k ("5 times" in both blanks). The 5 by 5 block of 25 cells where one cell was makes it impossible to say 5.

**Kit.** `grow` (the family's foundation-11 motion): a dilated polygon on the grid whose interior cells draw and count; one cell's k by k image lit as a block. The sentence-with-blanks board card that fills a blank on the word (the place-value slot types need the same).

**Writer.** Cheaper, from this concept, once `grow` exists: one picture, two multiplications, answers checkable by `--dry`.

---

### Geometry: transformation-invariants

**`transformation-invariant-claims` — What each transformation keeps.** Mixed: four kinds. Foundations 2, 5, and HSG.CO.A.4's definition of a rotation.

**Standard.** HSG.CO.A.2 "Compare transformations that preserve distance and angle to those that do not (e.g., translation versus horizontal stretch)"; HSG.CO.A.4 "Develop definitions of rotations ... in terms of angles, circles"; HSG.CO.B.6 "decide if they are congruent"; 8.G.A.1 a to c for what rigid motions keep.

**Foundations first.** One unit square at the origin, and four rules sent through it, one at a time with ghosts: a rotation leaves a unit square (tracing paper: every distance, every angle kept); a dilation by 4 makes a 4 by 4 square (angles kept, every distance times 4); the stretch (x, y) → (4x, y) makes a 4 by 1 rectangle (one direction stretched, so distances change by different factors and a diagonal's angle changes); the shear (x, y) → (x + y, y) makes a slanted parallelogram (the corner angles are no longer right angles). Define rigid motion, dilation, stretch and shear in that beat, each as what it did to the square. This beat is also kind (a)'s whole answer.

**Read.** Four shapes of question; gold on the shape: "preserves both distance and angle"; "is the transformation a rigid motion"; "a rotation about C by 60°, which must be true"; "scale factor 2, which is true of the image". At a glance: "angle measures multiplied by 2" is impossible (a triangle's three angles must still make 180°), so every choice that scales an angle is gone before reading further.

**The examples**, one per kind, brief after the foundation.
- (a) Which preserves distance and angle: the rotation, the only unit square still a unit square.
- (b) P(−1, −2), Q(4, −2), R(−1, 10) → P′(−3, −6), Q′(12, −6), R′(−3, 30). Both triangles drawn to scale (the image is visibly three times as big). Three sides: PQ is horizontal, 4 − (−1) = 5; P′Q′ is 12 − (−3) = 15. PR is vertical, 12; P′R′ is 36. QR is the hypotenuse of a 5-12 triangle, 13; Q′R′ of a 15-36 triangle, 39. Every side times 3: a dilation, not a rigid motion. At a glance first: every coordinate is exactly 3 times, a dilation from the origin by 3.
- (c) Rotation about C by 60°: the pivot apparatus: the circle through X centered at C, X gliding 60° along it to X′, the two equal radii ticked, the arc marked 60°. CX′ = CX and ∠XCX′ = 60°.
- (d) k = 2: a triangle projected by 2; pull the small one onto the big one's corner: the angle arcs coincide. Distances times 2, angles kept.

**Fast.** Rigid: only position changes. Dilation: distances times k, angles kept. For coordinates: three side lengths; all equal, rigid; one factor, dilation; otherwise neither. For a rotation: image on the circle, through the angle.

**Sense.** In (b) the drawn image is bigger, so "rigid" is impossible before any arithmetic.

**Check.** (b): the landed copy, undone by ÷3, is PQR. (c): the ticks on both radii. (d): 180° − the two copied angles is the third, so no angle could have doubled.

**Rule out.** Any choice scaling an angle; "lengths unchanged" when the picture is bigger; "mirror image" for a turn (orientation would reverse); "C is the midpoint" (that is a half turn, 180°, not 60°); "may be any length" (X′ sits on the circle).

**Line.** "Tracing paper never stretches. A dilation stretches every length by one k and no angle at all."

**Trap.** "It is the same shape, so it is congruent." The `land` of the ×3 copy on PQR shows the gap at Q; same shape is similar, not congruent.

**Kit.** A general-rule transform `{"do":"map","rule":"(4x, y)"}` for stretches and shears (the four named actions do not cover them); `pivot` with the circle through the vertex; `land` with the gap.

**Writer.** Strongest: four kinds judged as "must be true", and the item flaw above needs noticing, not staging.

---

**`geo-area-changing-transformation` — Which rule changes area.** Foundation 2 and the stretch.

**Standard.** HSG.CO.A.2 "Compare transformations that preserve distance and angle to those that do not (e.g., translation versus horizontal stretch)"; area is the consequence the item asks about.

**Foundations first.** A 2 by 3 rectangle at the origin, 6 cells. Say what each kind of rule does to it, drawn with ghosts: (x, −y) flips it (same 6 cells); (−y, x) turns it (3 by 2, same 6 cells); (x, 3y) stretches every height by 3: 2 by 9, 18 cells; (3x, y⁄3) stretches widths by 3 and squashes heights to a third: 6 by 1, 6 cells, but a different rectangle. Define stretch; name the rigid rules as the ones that only change signs or swap x and y.

**Read.** Two wordings, gold on each: "changes the area" or "keeps the area the same but does not always produce a congruent figure". At a glance: a rule with only signs and swaps is rigid, so it keeps area and congruence; in the first wording it is gone, in the second it is gone too.

**The example.** "Which keeps the area the same but does not always produce a figure congruent to the rectangle? (3x, y⁄3), (x, −y), (x, 3y), (3x, y)." (1) The three rigid-looking and stretch rules sorted on sight: (x, −y) only changes a sign: a flip, congruent, out. (x, 3y) and (3x, y): one factor 3 and one factor 1: area times 3, out. (2) (3x, y⁄3) on the rectangle: 6 wide, ⅓ tall... with the 2 by 3 original: 6 by 1, six cells counted. Area factor 3 × ⅓ = 1. (3) Lay the 6 by 1 beside the 2 by 3: the same six cells, not the same rectangle. Not congruent.

**Second example** (the other wording, quick): "Which changes the area? (x, 3y), (x, −y), (−y, x), (−x, y)." Three rules of signs and swaps dim together; (x, 3y) triples every height: 18 cells.

**Fast.** Area factor = width factor × height factor, signs ignored. Equal to 1 and both factors ±1: congruent. Equal to 1 otherwise: same area, different shape.

**Sense.** The drawn image's cells, counted.

**Check.** Multiply the image's side lengths: 6 × 1 = 6 = 2 × 3.

**Rule out.** Signs and swaps only: rigid, gone from both wordings at once with one reason said aloud.

**Line.** "Width factor times height factor is the area factor."

**Trap.** "The 3 and the ⅓ cancel, so it does nothing." The 6 by 1 lying next to the 2 by 3 is the same count of cells and plainly a different shape.

**Kit.** The general-rule `map` action above; interior cells drawn and counted inside an image rectangle (shares `grow`).

**Writer.** Strongest: the second wording asks the learner to hold "same area" and "not congruent" at once, and the decoys are sentences of reasoning.

---

**`geo-rigid-statement` — What must be true after a chain of rigid motions.** Foundations 2 and 4, orientation.

**Standard.** HSG.CO.B.6 "predict the effect of a given rigid motion on a given figure"; 8.G.A.1 a to c.

**Foundations first.** The tracing-paper list, said once and shown: a traced copy of triangle ABC is slid, turned and flipped in sequence with ghosts; after each, its sides are measured against the ghost (equal ticks), its angles marked (equal arcs). So: every side, every angle, the perimeter and the area are kept, and the image is congruent, by every chain of any length. Two things a rigid motion does not promise: the sides staying parallel to where they were (the turn tilts them; only a slide keeps directions), and the way round the letters go. Define orientation: read A to B to C; counterclockwise or clockwise. Show the flip reversing it and a second flip restoring it: "one flip turns the letters round; two turn them back."

**Read.** "Mapped by 3 rigid motions: a reflection, then a rotation, then a translation. Which statement must be true?" Gold on "must": true for every triangle and every such chain, not just a picture. At a glance: count the reflections; one, so the orientation is reversed; any "same order" choice is false, any "larger" choice is always false.

**The example.** Choices: larger; every angle the same measure; each side parallel; vertices in the same order. (1) The trace flipped over a mirror: letters now clockwise, sides and angles ticked equal. (2) Turned about a pivot: still clockwise, lengths equal, sides now tilted away from the originals. (3) Slid: nothing but position changes. (4) Read the choices: larger, never (tracing paper); same order, no, one flip; parallel, the turn tilted them, so not guaranteed; every angle the same measure, always.

**Fast.** Lengths, angles, perimeter, area, congruent: always true. "Larger", "smaller", "different area": never. "Parallel": only a slide (or an exact half turn) keeps it, so out whenever the chain has a flip or an unspecified turn. Orientation: count the flips; odd reverses, even keeps. Exactly one choice is always true.

**Sense.** The final copy, landed on the original by undoing the chain, coincides.

**Check.** Undo the three motions in reverse and get ABC back; the letters read the original way round again after the flip is undone.

**Rule out.** "Larger" dims on sight; "parallel" dims with "a turn tilts the sides"; the orientation choice dims (or survives) by the flip count. The survivor is proved by the ticks and arcs.

**Line.** "One flip turns the letters round; two flips turn them back. Everything else stays."

**Trap.** Counting a rotation as reversing orientation, or thinking two reflections leave it reversed. The letters, read round aloud after each step, settle it.

**Kit.** An orientation arrow part: a small curved arrow inside a polygon from its first vertex through its second to its third, which reverses under `reflect` and rides `rotate` and `translate`. Riding labels and ticks (4.4).

**Writer.** Strongest: "must be true" is judged for every case, and the parallel-sides decoy is the kind of reasoning a weaker author will get wrong in words.

---

**`congruence-claims-table` — Which rules always give a congruent image.** Foundations 1 and 2.

**Standard.** HSG.CO.A.2 "describe transformations as functions that take points in the plane as inputs and give other points as outputs. Compare transformations that preserve distance and angle to those that do not."

**Foundations first.** A rule is a function on points (family 13's "one input, one output", said once). The picture of a rule is what it does to the unit square at the origin: send its four corners through and connect them. If the image is still a 1 by 1 square, every distance was kept and the rule is rigid, so every figure's image is congruent. Then read the rule's form: numbers added, a slide; signs changed, a flip or half turn; x and y swapped, a quarter turn or a flip over y = x; a factor other than 1 or −1, a stretch or resize; x and y mixed into one coordinate, a shear. Only the first three are rigid.

**Read.** Four rules, each marked "always congruent" or "not". At a glance: scan each rule for a factor or a mix; those are "not" before any square is drawn.

**The example.** (The writer takes the app's four rules from `facts.ts`; the shape is three "not" and one "always".) Say the four are (−y, x), (2x, 2y), (x, −2y), (x + y, y). The unit square through each, in turn, with ghosts: (−y, x) turns it a quarter turn: a unit square, always congruent. (2x, 2y): a 2 by 2 square, four cells for one: not. (x, −2y): a 1 by 2 rectangle flipped down: not. (x + y, y): corners (0,0), (1,0), (2,1), (1,1), a slanted parallelogram, its slanted side √2 long: not. The table fills row by row as each square lands.

**Fast.** Read the form; prove it with the square. Never test two points only: a shear like (x, x + y) leaves (0,0) and (0,1) exactly 1 apart, so two points can lie; the whole square cannot.

**Sense.** Rigid rules leave the drawn square the same size and shape.

**Check.** Count the image's cells: one cell, rigid; anything else, not.

**Line.** "Signs, swaps and slides are rigid. A factor or a mix is not."

**Trap.** Marking (2x, 2y) as congruent because "it is still a square". Four cells beside one: same shape, not the same size.

**Kit.** The general-rule `map` action; `table` on the board with a row mark (✓ or ✗ written on the word). The app's four rules exposed in `facts.ts`.

**Writer.** Cheaper: reading rules, one picture per row, checkable by `--dry`.

---

### Geometry: transformation-constructions

**`transformation-sequence-mapping` — Name the motion that carries PQR onto P′Q′R′.** Foundations 3 and 4.

**Standard.** HSG.CO.A.5 "Specify a sequence of transformations that will carry a given figure onto another"; 8.G.A.2 "describe a sequence that exhibits the congruence". (The template promises a sequence and gives one motion; the lesson teaches naming one motion, which is what the learner meets.)

**Foundations first.** Both triangles drawn on the plane, to scale, P→P′ pairs shown with faint arrows. The sure way to name a motion, said and then done: orientation first (letters the same way round means no flip; reversed means a flip); then what changed about one corner (slide: the same arrow everywhere; turn: the L turned); then confirm on a corner that could disagree.

**Read.** P(1, 0), Q(4, 0), R(1, 2) → P′(0, −1), Q′(0, −4), R′(2, −1), each vertex to its prime. At a glance: PQ lies flat along the x-axis and P′Q′ stands up the y-axis, so the figure turned a quarter turn; no slide can stand a side up, so both translations are gone.

**The example.** Choices: reflect across the x-axis; rotate 90° clockwise about the origin; translate ⟨−3, 5⟩; translate ⟨−5, 3⟩. (1) Orientation: P→Q→R goes counterclockwise; P′→Q′→R′ also counterclockwise: no flip; the reflection is gone. (2) Horizontal became vertical: a quarter turn. Which way: P on the positive x-axis landed on the negative y-axis; that is the way clock hands go. The pivot at the origin, radii to P and P′ ticked equal, the arc with its arrow and 90°. (3) Confirm on R, the corner off the axis: the L to R is over 1, up 2; turned clockwise, "right" becomes "down" and "up" becomes "right": down 1, right 2: (2, −1) = R′. (4) The traced copy turns and lands; the outlines coincide.

**Fast.** Orientation, then one corner, then confirm on a corner off the axes.

**Sense.** The copy turned 90° clockwise sits exactly where P′Q′R′ is drawn.

**Check.** All three corners through (x, y) → (y, −x): (1,0)→(0,−1), (4,0)→(0,−4), (1,2)→(2,−1).

**Rule out.** Slides dim together (a side changed direction); the reflection dims (same orientation). One remains; prove it on R.

**Line.** "Orientation first, then one corner, then confirm on another."

**Trap.** Clockwise and counterclockwise swapped, and a subtler one this item plants: P and Q both lie on the x-axis, where a clockwise turn and a flip over y = −x agree; only R tells them apart. The lesson confirms on R and says why: a corner on an axis can agree with two motions.

**Kit.** Family tools only: `copy`, `rotate`, `pivot`, `ell`, `land`, `dim`, the orientation arrow.

**Writer.** Cheaper, once `identify-rigid-motion` (pilot 1) and its kit exist: the same method on one figure.

---

**`geo-motion-chain` — Name each motion in a chain of three triangles.** Foundations 3 and 4.

**Standard.** HSG.CO.A.5 "Specify a sequence of transformations that will carry a given figure onto another"; 8.G.A.2.

**Foundations first.** Three triangles on one plane (teal ABC, rust DEF, violet GHI), to scale. The naming method, said once as in the type above, then the three signatures: a slide moves every corner by the same arrow; a flip reverses the way round the letters go; a turn keeps the way round but swings the sides. Each step is named on its own.

**Read.** A(1, 3), B(2, −3), C(2, −2); D(−1, 3), E(−2, −3), F(−2, −2); G(1, −3), H(2, 3), I(2, 2). "Which sequence maps ABC onto DEF and then DEF onto GHI?" At a glance: DEF is ABC with every x sign changed: a mirror image across the y-axis, so the first word is "reflection" and two choices are gone.

**The example.** (1) Step one, orientation: A→B→C counterclockwise, D→E→F clockwise: a flip. What changed: A(1, 3) → D(−1, 3), only x changed sign: the mirror is the y-axis. Confirm: B(2, −3) → E(−2, −3). The copy flips over the mirror with the perpendicular, right-angle box and equal ticks at A. (2) Step two: D→E→F clockwise, G→H→I clockwise: no flip. Does every corner move the same? D moves right 2, down 6; E moves right 4, up 6: different arrows, not a slide. D(−1, 3) → G(1, −3): both signs changed: a half turn about the origin. Confirm: F(−2, −2) → I(2, 2). The copy turns 180° about the pivot. (3) A reflection followed by a rotation.

**Fast.** For each step: letters reversed, a flip; same arrow at every corner, a slide; otherwise a turn. One corner tells what changed; a second confirms.

**Sense.** The picture: DEF is ABC's reflection in the y-axis; GHI is DEF upside down.

**Check.** All six corners through the two named rules.

**Rule out.** Reversed orientation at step one dims every choice not starting "reflection". At step two, unequal arrows dim "translation". One remains.

**Line.** "Only a flip turns the letters round."

**Trap.** Calling the half turn a flip because the triangle is upside down, or "a reflection over both axes". The letters read the same way round before and after step two, and the arc at the pivot sweeps 180°; the half turn is a turn.

**Kit.** Family tools; the third color (violet) on a polygon; the orientation arrow.

**Writer.** Cheaper, once pilot 1 exists: two applications of one method.

---

**`geo-reflection-side` — A side through two flips.** Foundations 3 and 4.

**Standard.** HSG.CO.B.6 "Use geometric descriptions of rigid motions to transform figures and to predict the effect of a given rigid motion on a given figure"; 8.G.A.3.

**Foundations first.** The four mirrors and what each does to the L, drawn: over the x-axis the height changes sign; over the y-axis the over changes sign; over y = x the arms trade places; over y = −x they trade places and both change sign. Then two facts for this type: a chain is done one point at a time in the written order (the two flips in the other order land somewhere else); and the image of a side is the side joining the images of its two endpoints, so only two corners are ever followed. Last: the letters E, F, G, H are placed by the picture, not by the alphabet; find where a corner landed, then read which letter sits there.

**Read.** "ABCD is reflected over the y-axis, then over y = x. Which segment is the image of CD?" Gold on the order and on CD. At a glance: the first flip sends the figure to the left; the second sends that into the quadrant below; CD's image is the side of EFGH with the same length as CD (a flip keeps length), which rules out any side of a different length and any diagonal.

**The example.** A(1, 1), B(4, 1), C(4, 3), D(2, 4) (the writer takes the app's figure and its placed letters from `facts.ts`); the final image is labeled E(3, −4), F(1, −4), G(1, −1), H(4, −2). Choices: EH, FG, GH, EF. (1) C(4, 3) over the y-axis: (−4, 3); a ghost of the whole quadrilateral flipped, the mirror and ticks at C. (2) (−4, 3) over y = x: the arms trade: (3, −4). (3) D(2, 4) → (−2, 4) → (4, −2). (4) The image of CD joins (3, −4) and (4, −2): the figure's letters there are E and H. EH.

**Fast.** Two endpoints, one line per flip, in the written order; join the landings; read the letters off the figure.

**Sense.** The ghost at the halfway point sits in the second quadrant; the final figure sits in the fourth, where E, F, G, H are drawn; EH is as long as CD (both √5).

**Check.** Undo: flip E and H back over y = x, then over the y-axis, and get C and D. Or follow A and B: they land on G and F, the other two letters, so the whole figure agrees.

**Rule out.** Diagonals (EG, FH) are never the image of a side; sides of the wrong length dim with them.

**Line.** "Follow the two ends, in order. The side's image joins where they land."

**Trap.** Pairing by alphabet (E must be A′) or doing the flips in the wrong order (y = x first, then the y-axis, lands C at (−3, 4), a different quadrant). The written order on the board, one line per flip, and the placed letters read from the figure.

**Kit.** `reflect` over y = x and y = −x; chained actions with ghosts; the app's placed labels E to H exposed by `facts.ts` and drawn where the app draws them.

**Writer.** Cheaper: two flips of two points and a reading, checkable by `--dry`.

---

### Geometry: congruence-criteria

**`mcas-congruence-statement-select` — Corresponding parts from a congruence statement.** Foundations 4 and 7. Select 3 of 6.

**Standard.** Linked to HSG.SRT.B.5; truly HSG.CO.B.7 "two triangles are congruent if and only if corresponding pairs of sides and corresponding pairs of angles are congruent", the forward direction.

**Foundations first.** Two congruent triangles drawn to scale, one turned and flipped so the picture cannot be trusted by eye; the statement △JWX ≅ △ZBV. Say what the statement records: a rigid motion landed J on Z, W on B, X on V, in that order; the trace does it on screen. Define corresponding ("matching: the parts that land on each other"). Then the names card: J W X over Z B V, three columns. A corner is a column. A side is two neighboring columns, the third side wrapping round (J and X match Z and V). The order of a side's two letters does not matter: XW is the side WX.

**Read.** "Choose the 3 statements about corresponding parts that must be true." At a glance: there are three; every statement is decided from the card, none from the picture.

**The example.** Choices: JX ≅ ZV; WX ≅ ZB; ∠X ≅ ∠V; XW ≅ VB; JW ≅ ZV; ∠W ≅ ∠Z. One at a time, the columns lighting gold with the side on both figures: JX: columns 1 and 3 → Z and V: ZV, true. WX: columns 2 and 3 → B and V, so BV, not ZB: false. ∠X: column 3 → V: true. XW: columns 3 and 2 → V and B: VB, true (the letters are reversed, the side is the same). JW: columns 1 and 2 → ZB, not ZV: false. ∠W: column 2 → B, not Z: false. Three true: a, c, d. The false three dim together.

**Fast.** Stack the names; read columns; never look at the drawing.

**Sense.** Exactly three true, as asked.

**Check.** For each chosen side, both letters sit in matching columns; the trace lands JX on ZV on screen.

**Rule out.** A side statement is false the moment one endpoint's column is wrong; the half-right decoy (one letter matches) is the planted one.

**Line.** "The letters tell who lands on whom. A corner is a column; a side is two columns."

**Trap.** Checking only the first letter of a side (DX ≅ QJ "because D goes to Q"), or pairing by position in the picture. The card lights two columns for every side, and the picture is deliberately turned.

**Kit.** `names` card and `pair` (4.5); select-many choices with marks (shared with the place-value select types).

**Writer.** Cheaper: one card, six readings.

---

**`congruence-by-rigid-motion` — Rigid motions and congruence.** Mixed: four kinds. Foundations 2, 4, 7.

**Standard.** HSG.CO.B.6 "given two figures, use the definition of congruence in terms of rigid motions to decide if they are congruent"; HSG.CO.B.7 (corresponding parts, forward); HSG.CO.A.5 "Specify a sequence"; 8.G.A.2, 8.G.A.3. The figure's coordinates must be in `facts.ts`; the first wording is unanswerable from text alone.

**Foundations first.** The definition, drawn: congruent means some sequence of slides, turns and flips lands one figure exactly on the other; the trace lands and the outlines pulse. Two consequences, one line each: every matching side and angle is equal (the names card, A B C over D E F); and no rigid motion can change a length, so figures of different sizes are never congruent, however alike their shape. The naming method (orientation, one corner, confirm) is said once.

**Read.** Gold on what is asked: "which sequence", "which statement must be true", "is there a sequence", "the coordinates of E". At a glance: same size and same way round means a slide or turn; same size, reversed, means a flip is in the list; different size means no sequence at all, whatever the choices say.

**The examples**, one per kind.
- Which sequence: A(1, 2), B(4, 1), C(2, 5) → D(−1, −2), E(−4, −1), F(−2, −5). Same way round, so the reflection is gone; both signs changed at A: a half turn about the origin; confirm at B. The copy turns 180° at the pivot and lands. "Rotate 180° then translate" lands 4 left and 2 up of D: a near miss shown at one corner.
- Must be true: A→D, B→E, C→F; BC = 10, ∠B = 79°. The names card: B and C are columns 2 and 3, so EF = 10; B is column 2, so ∠E = 79°. Angles copy, never scale.
- Is there a sequence: ABC with DEF every side three times as long (A(0,0), B(2,0), C(0,1); D(3,−1), E(9,−1), F(3,2)). The copy slid to D does not cover DEF; the gap at E. No: rigid motions preserve length. The yes-case in the same beat shape, quick: A(1,1), B(4,1), C(2,3) and D(−2,−3), E(1,−3), F(−1,−5): letters reversed, so flip over the x-axis first: A lands at (1, −1); D is at (−2, −3): left 3, down 2: then translate (x − 3, y − 2). The decoy (x + 3, y + 2) is the slide read backwards.
- Coordinates after a chain: B(−1, −1), rotate 90° counterclockwise about the origin, then translate (x − 2, y + 4). The L to B: left 1, down 1. Turned counterclockwise, "left" becomes "down" and "down" becomes "right": (1, −1). Then left 2, up 4: (−1, 3). One corner only, one line per step, in the written order.

**Fast.** Size first (different: no sequence); orientation (reversed: a flip); then one corner; corresponding parts from the card; a chain one point at a time.

**Sense.** The landed copy coincides, or shows its gap.

**Check.** Undo the sequence and recover ABC; all three corners through the named rules; for parts, the trace lands BC on EF.

**Rule out.** "No: a different position" is never a reason (moving is what rigid motions do); "Yes: the angles are equal" is similarity, not congruence; a reflection choice when both read the same way round; a slide when a side changed direction; for E's coordinates, the quadrant of the turned L kills the clockwise decoy (−3, 5) at a glance.

**Line.** "Congruent means a slide, turn or flip lands one on the other. Same shape is not enough; same size, too."

**Trap.** "Same shape, so congruent" for the ×3 pair, and the direction of a slide after a flip (adding 3 and 2 instead of subtracting). The `land` gap for the first; the arrow drawn from the flipped A to D, labeled "left 3, down 2", for the second.

**Kit.** Family tools: `copy`, the transform actions with ghosts and readouts, `land` with the gap, `names`, `pivot`, `arrow`, `ell`, `dim`; `facts.ts` exposing the figure's coordinates.

**Writer.** Strongest: four kinds, "must be true" and "why" judged in sentences, and a near miss that has to be staged exactly.
