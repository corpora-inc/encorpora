# Geometric proof, part 1: the concepts

Ten problem types, written from the family design. Three of them share a film with a partner (section 6 of the design): `geometry-proof-step` with `line-angle-proof-reasons`, `rg-quadrilateral-choice` with `geo-parallelogram-sufficient`, `rg-parallelogram-perpendicular` with `parallelogram-angle-steps`. Where a type's partner is not in this batch, the concept below is written so the partner's variants are already covered.

The angle numbering used throughout is the convention the design proposes for `transversal`: at each crossing 1 and 2 above the line (left, right), 3 and 4 below; 5 to 8 the same at the lower line. `facts.ts` must print the app's actual convention before `two-column-angle-proof` is written; if it differs, every angle number below is renamed, nothing else changes.

---

### `geometry-proof-step` — Which rule proves this step (Geo, `geometric-proof`)

*Shares a film with `line-angle-proof-reasons`. This is the foundation half: reading a figure's marks, the ending test, four shapes.*

**Standard.** HSG.CO.C.9, "vertical angles are congruent; when a transversal crosses parallel lines ... corresponding angles are congruent", and C.10, "measures of interior angles of a triangle sum to 180°". The catalog links nothing; link both. The verb is "prove" and the type asks for one reason; the foundation shot proves each rule by its motion so the gap is closed.

**Foundations first.** A mark is a fact: tick, arc, box, arrow; nothing unmarked may be assumed. Supplementary (two angles that add to 180°), linear pair (adjacent, on a straight line), vertical angles (across the X), corresponding (same corner at each crossing), interior angles of a triangle. Then the four shapes of this type's bank, each drawn and proved by its motion in two or three beats: **the straight line with a ray** (the two wedges fill the half turn: 180°); **the X** (half-turn about the crossing lands each wedge on its twin: equal); **the F** on two parallel lines (slide the top crossing down the transversal onto the bottom: equal); **the tent** (a line through the top parallel to the base; the two base angles slide up as alternate interior angles and fill the straight line beside the top angle: 180°). Then the reading rule that organizes the whole bank: **a reason ends the way the step ends.** A step with "= 180°" wants a reason about supplementary or a sum; a step with "=" or "≅" wants a reason about congruent.

**Read.** "Which reason justifies this step?" The step is the gold word. Known at a glance: is the step a sum or an equality? That alone halves the bank, before any geometry.

**The example.** "Points A, B and D lie in that order on one straight line. Ray BC starts at B and is not on that line. A proof states m∠ABC + m∠CBD = 180°." Choices: corresponding | vertical | triangle sum | linear pair. (1) Draw the sentence: the line appears on "straight line", A, B, D drop onto it on their letters, the ray grows from B on "Ray BC". ∠ABC fills blue, ∠CBD violet; they share side BC. (2) The step: "+ ... = 180°": a sum. The two "congruent" reasons (corresponding, vertical) give equal angles, never a sum: both dim in one beat. (3) Two remain. Is there a triangle? No; the ray never closes. The two wedges sit on one straight line and share a side: the straight line with a ray, a linear pair. (4) Half-turn the blue wedge about B: it fills exactly what the violet wedge leaves of the half turn. (5) "Angles that form a linear pair are supplementary." Check: read it aloud about this figure: ∠ABC and ∠CBD share BC and ABD is straight, so they are a linear pair; supplementary means add to 180°; that is the step, word for word.

**Quick case** (the equality ending and the "is parallel given?" cut): "Lines AC and BD intersect at O ... m∠AOB = m∠COD." Equality: the two sum reasons dim. Corresponding needs parallel lines and none are given: dim. The X; half-turn about O; vertical angles. Three or four beats.

**Fast.** Ending first, then shape. Always works for this bank.
**Sense.** The reason's conclusion has the same shape as the step; and the shape it names is actually in the figure.
**Check.** Read the chosen reason as a sentence about *these* marks and ask if it is true.
**Rule out.** Wrong ending: two choices dim together. Then: no parallel given, so no parallel-line reason; no triangle drawn, so no triangle sum.
**Line.** "The reason ends the way the step ends."
**Trap.** "Vertical" for a linear pair (both live at a crossing), and "triangle sum" because 180 is familiar. The ending test removes the first before the student can reach for it; the drawn figure with no closed triangle removes the second.
**Kit.** `angle.tex` and `angle.arcs`, `focus`, `dim`, `transversal` for the F. The tent needs copies of wedges that `slide` and `turn` (exists).
**Writer.** A capable cheaper model, from this concept: one method, four named shapes with named motions, predictable decoys, and the rendered frame shows at once whether the right shape was lit.

---

### `line-angle-proof-reasons` — Reasons about crossing lines, parallel lines and the perpendicular bisector (Geo, `line-angle-proofs`)

*Second half of the shared film: adds the Z, the kite in both directions, and the equation variant.*

**Standard.** HSG.CO.C.9: "alternate interior angles are congruent and corresponding angles are congruent; points on a perpendicular bisector of a line segment are exactly those equidistant from the segment's endpoints." The word "exactly" is this lesson's point: it means both directions, and the bank holds both.

**Foundations first.** Transversal, interior (between the lines), alternate (opposite sides of the transversal). The **Z**, proved: slide the top crossing onto the bottom (∠3 lands on ∠7), then half-turn about the bottom crossing (∠7 lands on ∠6); so ∠3 = ∠6. The two-color picture: a transversal makes only two angle values; same color equal, different colors 180°. Midpoint, perpendicular bisector (through the midpoint, at a right angle), equidistant (same distance from). The **kite**: P joined to A and B with the perpendicular bisector as spine; fold on the spine and A lands on B, so PA lands on PB. Said once, plainly: this fact runs both ways, and a reason must run the way the step runs: from what is known to what is claimed.

**Read.** Ending test as before. Then: same crossing or different crossings? For the kite: what is *given* and what is *claimed*; the two bisector reasons are the same words with "if" and "then" swapped.

**Example 1.** "Lines ℓ and m are parallel. Transversal t crosses both. Angles 3 and 6 lie between ℓ and m, on opposite sides of t. A proof states m∠3 = m∠6." Choices: vertical | linear pair | alternate interior | corresponding. (1) Draw: ℓ and m with arrows, t at about 62°, eight numbered wedges; 3 and 6 fill violet on their numbers. (2) Equality: linear pair dims. (3) Different crossings: vertical (one X) dims. (4) Between the lines, opposite sides of t: `focus` on the Z. Corresponding would be the same corner at each crossing (3 and 7), the F: not this. (5) The motion: slide, then half-turn. (6) "Alternate interior angles formed by a transversal of parallel lines are congruent." Check: read it about this figure; parallel is given, 3 and 6 are interior and alternate.

**Example 2** (a different case: direction). "In a proof, PC = PD is given. The next step states that P lies on the perpendicular bisector of CD." Choices: corresponding | vertical | every point on the bisector is equidistant | a point equidistant lies on the bisector. (1) Draw C, D, P with PC and PD ticked (the given); the bisector dashed in rust (the goal). (2) No angles are named: the two angle reasons dim. (3) Two reasons, same words, swapped. What we have: equidistant. What we claim: on the bisector. The reason must *start* at equidistant and *end* at the bisector: "A point equidistant from a segment's endpoints lies on the segment's perpendicular bisector." The other starts where we want to end: it is the right fact pointing the wrong way. (4) Fold on the dashed line: C lands on D, the dashed line earns teal. (5) One beat on the other variant: given P on ℓ, step PA = PB: the same picture, the other reason.

**Quick case:** "∠AOB = (2x − 2)°, ∠COD = (3x − 15)°. Which equation does the vertical angles theorem justify?" Vertical says *equal*: 2x − 2 = 3x − 15; the three sums dim together (90, 180, 360 are not what "vertical" says). Check in one beat: x = 13, both 24°.

**Fast.** Ending; same or different crossing; for the kite, start where the given is.
**Sense.** The shape named is in the figure; for the kite, the reason's "if" is the given.
**Check.** Read it aloud about the marks; for the equation, solve and see both angles equal.
**Rule out.** Wrong ending; no angles named; a reason whose "if" is the claim rather than the given.
**Line.** "The reason starts where the given is and ends where the step ends."
**Trap.** "Corresponding" for alternate (both are "parallel lines, equal"), and the swapped kite reason, which students pick because it contains all the right words. The Z lit alone against the F; the given ticks against the dashed goal.
**Kit.** `transversal` with `focus` groups, `angle.tex`, `goal`/`earn` on `seg`, `flip`, `dim`.
**Writer.** Cheaper model, from this concept: the decoys and shapes are fully named for every variant.

---

### `two-column-angle-proof` — Build the proof (Geo, `line-angle-proofs`)

**Standard.** HSG.CO.C.9, "Prove theorems about lines and angles ... when a transversal crosses parallel lines, alternate interior angles are congruent and corresponding angles are congruent." The only type in the family where the verb is really "prove". `facts.ts` must print the app's figure and its angle numbering; the film's figure must match it exactly.

**Foundations first.** The proof card: Given (teal) and Prove (rust) above; Statements | Reasons, numbered. A reason is "given", a definition, a postulate (accepted) or a theorem (proved). A reason ends the way its statement ends. **One change per line:** each line moves the fact one step across the figure by one rule. Transitive property (two things equal to a third are equal), substitution (replace an angle by its equal), definition of supplementary. The two colors on the transversal say *what* is true at a glance; the reasons say *why*. Said once: "same color" is never a reason. Converse of corresponding angles: if one pair of corresponding angles is equal, the slide works, so the lines are parallel.

**Read.** Given at the top, Prove at the bottom, gold. Which two angles? Same crossing or different? Which middle angle touches both (vertical to one, corresponding to the other; or linear pair with one, corresponding to the other)? The last statement must be the Prove line, word for word.

**Example 1** (use parallel). "Given ℓ ∥ m. Prove ∠3 and ∠5 are supplementary. Choose the reason for each blank line." (1) Figure; color on "parallel": 3 violet, 5 blue: different colors, so they will add to 180°; now why. (2) Line 1: ℓ ∥ m, given; the arrows glow. (3) Line 2: ∠1 ≅ ∠5, corresponding angles (the F; slide); the gold mark hops from 5 up to 1. (4) Line 3: m∠1 + m∠3 = 180°, linear pair (the straight line along ℓ; 1 and 3 share its left ray). (5) Line 4: m∠5 + m∠3 = 180°, substitution: ∠1 replaced by its equal ∠5, one change. (6) Line 5: ∠3 and ∠5 are supplementary, definition of supplementary. It matches the Prove: the Prove line turns teal, the line is boxed. The fact walked 5 → 1 → 3.

**Example 2** (prove parallel; a different direction, the bank format). "Given ∠1 ≅ ∠8. Prove ℓ ∥ m. Build the proof." The lines are drawn to scale but with **no arrows**: a mark is a fact and parallel is not yet a fact; the arrows are the dashed rust goal. (1) ∠1 ≅ ∠8, given (chip lifted). (2) ∠8 ≅ ∠5, vertical angles (the X at the bottom; half-turn). (3) ∠1 ≅ ∠5, transitive property; the chip students skip, and it is in the bank. (4) ℓ ∥ m, "if corresponding angles are congruent, the lines are parallel"; the arrows earn teal. One beat: the theorem "corresponding angles are congruent" would be the wrong way round here; its *converse* is the only chip that ends in "parallel".

**Quick** (order the lines): a line may use only lines above it; the given is first, the Prove last, the middle lines each change one thing from the line before.

**Fast.** Find the middle angle; one line per hop; transitive or substitution to join.
**Sense.** The colors agree with the claim before the first line is written; each line's statement differs from the one above by exactly one angle.
**Check.** Read down the statement column: each line follows from the lines above by its reason; the last line is the Prove.
**Line.** "One change per line. Colors say what; reasons say why."
**Trap.** Writing the theorem where the converse is needed; skipping the transitive step; two changes in one line. The ending chip ("parallel") and the one-hop walk make each impossible.
**Kit.** `proof` card with `line`, `fill`, `pick` and `banks`; `transversal` with `goal` arrows; `mark` walking.
**Writer.** The strongest: the writer must find the chain itself and stage one hop per line.

---

### `conditional-statements` — Converse, inverse, contrapositive; and, or, not (Geo, `geometric-proof`)

*Badly seeded.* Every generated conditional is a definition (hexagon, multiple of 10, right angle), whose converse is also true, so the type cannot show the one thing it exists to teach. The swap also breaks grammar ("If the number ..., then a whole number ..."). Seed one-way truths with one noun phrase: "If a figure is a square, then the figure has four right angles." The truth-table and biconditional variants are a second kind under the same name. No Common Core home; serves MP3 and state logic standards (Texas G.4, Florida MA.912.LT.4); say so in the catalog.

**Standard.** None in Common Core; MP3 ("construct viable arguments").

**Foundations first.** Conditional, hypothesis (the "if" part, blue), conclusion (the "then", violet). The two circles: the P-things inside the Q-things, one dot. Then the three forms, each built on the board from the original by one mechanical move and tested with the dot: **converse** (swap): the dot can sit in the ring, so it may be false; **inverse** (a "not" on each part): the same dot in the ring breaks it; **contrapositive** (both): a dot outside the big circle is outside the small one, always: the original read from outside, the same claim. Then: only the contrapositive is always as true as the original.

**Read.** The asked word is gold: swap, negate, or both. Known at a glance: for "converse", any choice with "not" is gone; for "inverse", any swapped choice is gone; for "contrapositive", any choice without "not" in both parts is gone.

**The example.** "Which statement is the contrapositive of 'If a figure is a square, then the figure has four right angles'?" Choices: not a square → not four right angles | four right angles → a square | not four right angles → not a square | four right angles → not a square. (1) Write the original, P blue, Q violet; circles: squares inside figures with four right angles; the dot in the small circle is in the big one. (2) Build the contrapositive on the board: swap, then a "not" on each: "If the figure does not have four right angles, then the figure is not a square." Dot outside the big circle: outside the small one; true. (3) Classify each choice by what changed: negated only (inverse); swapped only (converse): a 3-by-5 rectangle has four right angles and is not a square, the dot in the ring, false; swapped and one negation (neither form); swapped and negated: the contrapositive. (4) Choose. Check: it is exactly as true as the original.

**Second example** (a different kind: truth values). "P true, Q true, R false. Which is false?" (P→Q)∧R | P→Q | P∧Q | R→(P∧Q). Smallest parts first: P∧Q true; P→Q true (true leads to true); R→(P∧Q): the "if" never happens, so the promise is not broken: true; (P→Q)∧R: true and false: false. The biconditional variant in one beat: when both directions are true the two circles are one circle, "if and only if", which is what a definition is.

**Fast.** Swap, negate, both; classify the choices by what changed.
**Sense.** The contrapositive is as true as the original; the converse need not be.
**Check.** Rebuild the chosen statement from the original by the asked move.
**Rule out.** By the asked word: wrong move, dim together.
**Line.** "Swap for the converse, negate for the inverse, both for the contrapositive. Only the contrapositive is the same claim."
**Trap.** Converse and inverse mixed ("the other one"), and the belief that the converse of a true statement is true. The classification by change, and the dot in the ring.
**Kit.** `conditional` card (or `write` with colored TeX), two `circle` parts with a `dot` that `move`s, `dim`.
**Writer.** The strongest, for the seeding to route around and the circles to be used honestly.

---

### `counterexample-choice` — Choose the counterexample (Geo, `geometric-proof`)

*Phrasing.* The SSA variant gives a set of measurements, not two triangles; the lesson must say that facts fitting two different triangles are the counterexample. It is really HSG.CO.B.8 territory (family 26) and could be filed there too. No Common Core home (MP3; state logic standards).

**Standard.** None in Common Core; MP3. The SSA case touches HSG.CO.B.8.

**Foundations first.** Conjecture (a claim not yet proved), hypothesis, conclusion. A counterexample **fits the if and breaks the then**, in that order; a thousand examples prove nothing, one counterexample kills a claim. Fold facts named in one line each: an isosceles trapezoid's diagonals are equal (fold over the midline, they swap); a parallelogram's diagonals are two sticks crossing at their middles, equal only when it is a rectangle.

**Read.** "Which is a counterexample?" Split the conjecture on the board, P blue, Q violet. At a glance: does the choice fit P? Only then: does it break Q?

**Example 1.** "If the diagonals of a quadrilateral are congruent, then it is a rectangle." Choices: a rectangle | a parallelogram that is not a rectangle | a rhombus that is not a square | an isosceles trapezoid. Each drawn to scale with its diagonals: (1) Rectangle: diagonals equal (fits), and it is a rectangle (the then holds): an example, not a counterexample. (2) Parallelogram, not a rectangle: it breaks the then, which is why it tempts; but its sticks are unequal: it fails the if. Out. (3) Rhombus: perpendicular sticks, unequal: fails the if. Out. (4) Isosceles trapezoid, base angles 70°: fold over the midline, the diagonals swap, so they are equal: fits; no right angle: breaks. The counterexample. Check: both tests, said aloud.

**Example 2** (a different kind: the swing). "∠A = 30°, AC = 8, and BC = 8 | 7 | 4 | 12; which is a counterexample to SSA?" Draw A, the ray AB, AC = 8 at 30°. BC must reach the ray from C: a compass arc about C of radius BC; where it meets the ray is B. Radius 4: the arc just touches: one triangle (4 is the shortest distance to the ray, the leg across from 30°, half of 8). Radius 7: the arc crosses the ray **twice**: two different triangles, one with an obtuse angle at B and one acute, both with ∠A = 30°, AC = 8, BC = 7. The same facts fit two triangles, so the facts do not force one triangle: the counterexample. Radius 8: one crossing besides A itself: one triangle. Radius 12: one crossing on the ray (the other is behind A): one triangle. Answer: 7.

**Quick** (same tests, arithmetic): 3-by-5 and 4-by-4: perimeters 16 and 16 (fits), areas 15 and 16 (breaks).

**Fast.** Fit the if first; among those, break the then.
**Sense.** A counterexample is a true case of the if; "the opposite of the then" alone is never enough.
**Check.** Say both tests aloud for the chosen case.
**Rule out.** Anything failing the if dims together; anything satisfying the then dims.
**Line.** "A counterexample fits the if and breaks the then."
**Trap.** Picking "a parallelogram that is not a rectangle" because it sounds like the opposite; it fails the if. The two tests in order, with the sticks drawn unequal. For SSA, thinking one triangle is a counterexample: the arc crossing twice.
**Kit.** `arc` with `compass`, `meet` with `which`, `glide` for the swing, `flip` for the trapezoid, `dim`.
**Writer.** The strongest: the swing must be staged by someone who knows why 7 gives two triangles.

---

### `triangle-theorem-consequences` — Triangle theorems: a measure or a reason (Geo, `triangle-proofs`)

*Mixed type, four kinds:* the tent's step, isosceles base angles, the centroid's 2:1 split, the midsegment with x. HSG.SRT.B.5 is wrongly linked (no criterion is used). The 2:1 split is not in the standard's text ("the medians meet at a point"); it is the consequence textbooks teach; say so.

**Standard.** HSG.CO.C.10: "measures of interior angles of a triangle sum to 180°; base angles of isosceles triangles are congruent; the segment joining midpoints of two sides of a triangle is parallel to the third side and half the length; the medians of a triangle meet at a point."

**Foundations first.** A theorem is a rule proved from others, and every one here is a picture. The **tent**: a line through C parallel to AB; the base angles travel up as alternate interior angles (the Z) and fill the straight line: 180°. Isosceles triangle: legs (the equal sides), base, base angles, vertex angle; the **fold** from the vertex to the base's midpoint lands B on C, so the base angles are equal. Median (vertex to the opposite midpoint); the three medians meet at one point, the centroid, which cuts each median two to one, vertex side longer (one beat of why: the midsegment joining two midpoints is half the third side, so the two triangles at the centroid match one to two). Midsegment: half and parallel, named in one line (the half-turn is `rg-segment-property-choice`'s).

**Read.** Which rule is named by the sentence: equal sides, midpoints, medians, a parallel through a vertex? Then: what is asked, a measure or a reason? At a glance: a base angle is under 90°; the whole median is longer than either piece; the third side is longer than the midsegment.

**Example 1.** "In triangle ABC, AB = AC and m∠A = 22°. What is m∠B?" Choices: 22° | 79° | 11° | 158°. (1) Draw to scale: a tall thin triangle, 22° at the top, legs ticked. (2) Fold: B lands on C; arcs appear at B and C, never at A. (3) Three angles make 180°: 22 + 2·m∠B = 180; 2·m∠B = 158; m∠B = 79. (4) Sense: a tall triangle has big base angles, both under 90. Check: 22 + 79 + 79 = 180.

**Example 2** (a different rule and the piece-against-whole read). "The medians meet at G; M is the midpoint of BC; GM = 6. What is AM?" Choices: 24 | 12 | 8 | 18. Draw the three medians meeting at G; on AM mark GM as one part, AG as two. AG = 12; AM = 12 + 6 = 18. Asked the whole, not AG. Check: 12 to 6 is two to one. One beat for the other direction: AM = 33 is three equal parts of 11; the vertex side gets two: AG = 22.

**Quick cases.** The tent's step "m∠A'CA = m∠CAB": the Z with AC as the transversal: alternate interior. Midsegment: 9x − 19 = 2(3x + 1), x = 7, BC = 44 and DE = 22, half.

**Fast.** Name the rule; write its one equation; solve; answer what was asked.
**Sense.** Base angles equal and acute; AG twice GM; the third side twice the midsegment.
**Check.** Angles sum to 180; the pieces add to the whole; put x back in both.
**Rule out.** 22° copies the vertex angle to a base; 158° is both base angles together; 12 is AG when AM was asked; 7 is x.
**Line.** "Fold it: equal sides, equal angles."
**Trap.** Putting the equal angles at the wrong vertices (∠B = 22°): the fold lands B on C and the arcs appear there. Answering the part for the whole: the median drawn with its three equal parts.
**Kit.** `angle.arcs`, `goal`/`earn`, `flip`, wedge copies that `slide` and `turn`, `dim`.
**Writer.** The strongest for the pilot version: four kinds under one name with two motions that prove; a cheaper model can redo it from the finished film.

---

### `rg-segment-property-choice` — Perpendicular bisector and midsegment (Geo, `triangle-proofs`)

*Misfiled standard.* HSG.SRT.B.5 is wrong; nothing here uses a criterion. Two kinds under one name: the perpendicular bisector (statement or x) and the midsegment (statement or x).

**Standard.** HSG.CO.C.9, "points on a perpendicular bisector ... are exactly those equidistant from the segment's endpoints"; HSG.CO.C.10, "the segment joining midpoints of two sides ... is parallel to the third side and half the length."

**Foundations first.** Midpoint; perpendicular bisector (through the midpoint, at a right angle, with its box and ticks); equidistant. The **kite**: fold on the bisector, A lands on B, PA lands on PB. Midsegment (joins two midpoints). The **half triangle**: half-turn the top piece about one midpoint; it lands beside itself and the midsegment doubles into the third side's length, parallel to it. Said once: the rule hands you one equation; solve it, then answer the *length* asked, not x.

**Read.** Which segment is bisected? Which two midpoints? The asked thing is gold: PA, QR, or "which statement must be true". At a glance: the two distances to the ends are equal; the third side is double, so it is the bigger number.

**Example 1.** "P is on the perpendicular bisector of AB. PA = 5x + 3, PB = x + 19. What is PA?" Choices: 46 | 23 | 27 | 4. (1) Draw AB, its bisector with the box, P on it; PA and PB labeled with their expressions. (2) Fold: PA lands on PB, ticks appear: 5x + 3 = x + 19. (3) 4x = 16; x = 4. (4) Asked PA: 5(4) + 3 = 23. Check: PB = 4 + 19 = 23, the same. The figure is drawn at 23 and 23.

**Example 2** (the other rule). "S and T are midpoints of PQ and PR. ST = x + 8, QR = 6x − 4. What is QR?" Choices: 52 | 26 | 39 | 5. (1) Draw; half-turn the top about T: the midsegment doubles onto a segment as long as QR. (2) 6x − 4 = 2(x + 8) = 2x + 16; 4x = 20; x = 5. (3) QR = 30 − 4 = 26; ST = 13, half of it, as drawn. Check: 2 × 13 = 26.

**Quick** (the statements): "ℓ is the perpendicular bisector of AB and meets AC at P": PA = PB; P is drawn visibly off the midpoint of AC (ℓ bisects AB, not AC) and the right angle is at AB's midpoint, not at P. Midsegment: parallel to the third side and half of it.

**Fast.** Write the rule's equation; solve; answer the asked length.
**Sense.** Equal distances come out equal; the third side is twice the midsegment.
**Check.** Put x into both expressions; both read the same, or one reads double the other.
**Rule out.** x itself (4, 5); the sum or double of the answer (46, 52): "is that x?" and "is that the double?" dim two at once.
**Line.** "Find x, then answer the question."
**Trap.** Setting the midsegment equal to the third side; answering x; "P is the midpoint of AC". The picture at the solved value, half visibly half, and P off AC's midpoint.
**Kit.** `angle.right`, `seg.ticks`, `flip`, `turn`, `goal`/`earn`, `dim`.
**Writer.** Cheaper model, from this concept: one equation per kind, named decoys, named pictures.

---

### `fl-trapezoid-consequences` — Trapezoid midsegment and the isosceles trapezoid (Geo, `parallelogram-proofs`)

*The figure requires angle arcs to show the supplementary angles.* Florida MA.912.GR.1.5 (trapezoids), not HSG.CO.C.11, which names parallelograms only; label it honestly. The app defines a trapezoid as exactly one pair of parallel sides; the lesson says which definition it uses.

**Standard.** Florida MA.912.GR.1.5; related to HSG.CO.C.11 in spirit.

**Foundations first.** Trapezoid (exactly one pair of parallel sides), bases, legs, isosceles trapezoid (legs equal). The **midsegment** joins the midpoints of the legs; half-turn the trapezoid about a leg's midpoint and it fits beside itself into a parallelogram whose base is AB + DC, with the midsegment doubled across its middle: MN = (AB + DC)/2, the average of the bases. The **mirror** of an isosceles trapezoid (the perpendicular bisector of the bases): fold, and the two angles on one base land on each other (equal), and the two diagonals swap (equal). The two angles on one leg are same-side interior angles of the parallel bases: the C, 180°.

**Read.** Which fact: midsegment, same base, same leg, diagonals? Open answer, so the asked thing (AB, ∠C, AC) is gold; it is a length or an angle, never x.

**Example 1.** "AB = 3x + 8, DC = x + 8, the midsegment is 20. Find AB." (1) Draw; the half-turn shows the midsegment as the average. (2) (3x + 8 + x + 8)/2 = 20; 4x + 16 = 40; x = 6. (3) AB = 26, DC = 14; the figure settles at 26 over 14 with 20 between. Check: (26 + 14)/2 = 20.

**Example 2** (angles; the one trap lives here). "Isosceles; ∠D = (3x + 6)°, ∠C = (4x − 14)°. Find ∠C." D and C are on the same base: fold, they are equal: 3x + 6 = 4x − 14; x = 20; ∠C = 66°. Sense: the base angles of a drawn-to-scale trapezoid both 66°. Then the other pair in one beat: ∠A is on leg AD with ∠D, the C shape: 180 − 66 = 114°; and the plain variant, ∠D = 58° gives ∠A = 122°.

**Quick.** Diagonals equal: 4x − 1 = x + 26; x = 9; AC = 35.

**Fast.** Same base: equal. Same leg: 180. Diagonals: equal. Midsegment: average of the bases.
**Sense.** The midsegment lies between the two base lengths; base angles equal; leg angles sum to 180.
**Check.** Put x back; recompute the average; add the leg angles.
**Line.** "Same base, equal; same leg, one eighty; the midsegment is the average."
**Trap.** Treating the angles on a leg as equal, or the midsegment as half of one base; answering x. The fold lands base angles on base angles only; the half-turn shows both bases inside the doubled midsegment.
**Kit.** Nothing beyond `angle.arcs`, `turn`, `flip`.
**Writer.** Cheaper model (use the reference screenplay).

---

### `rg-quadrilateral-choice` — Which fact makes a parallelogram a rectangle or a rhombus (Geo, `parallelogram-proofs`)

*Shares a film with `geo-parallelogram-sufficient` (identical prompts). The two trapezoid-angle variants belong to `fl-trapezoid-consequences` (same leg, 180°) and should move. The judged links 7.G.B.5 and 5.G.B.4 are below grade; 5.G.B.4's hierarchy is what the sticks explain.*

**Standard.** HSG.CO.C.11, "rectangles are parallelograms with congruent diagonals", and the parallelogram properties as the "adds nothing" cut.

**Foundations first.** Parallelogram (both pairs of opposite sides parallel). The **two sticks**: two segments crossing at their midpoints, a quadrilateral on their ends; half-turn about the crossing and it lands on itself, so every parallelogram has opposite sides equal, opposite angles equal, diagonals that bisect each other, and consecutive angles supplementary (the C). Those facts cost nothing extra. Then one more mark each way: **equal sticks** square the corners: rectangle (why, one beat: the four half-sticks are equal, so each corner angle equals the other two angles of its triangle together, half of 180°); **perpendicular sticks** make four equal sides: rhombus (fold along one diagonal, the other folds onto itself); both: square. Rectangle, rhombus, square defined as a parallelogram with one more mark.

**Read.** Rectangle or rhombus is gold. At a glance: a fact every parallelogram already has adds nothing; rectangle facts are about angles or equal diagonals; rhombus facts are about sides or a square cross.

**Example 1.** "WXYZ is a parallelogram. Which additional fact is enough to prove it is a rectangle?" Choices: diagonals bisect each other | one angle is a right angle | diagonals perpendicular | two consecutive sides congruent. (1) Sticks; half-turn: diagonals already bisect each other: adds nothing, dim. (2) Cross the sticks square, then make two consecutive sides equal: the shape slants, four equal sides, a rhombus: these two are rhombus facts, dim together. (3) One right angle: its opposite angle is equal (half-turn), the consecutive angles are supplementary (the C), 180 − 90 = 90: all four square. The sticks grow equal as the corners square. Check: picture the fact on the sticks.

**Example 2** (the other way). "JKLM is a parallelogram. Which fact proves a rhombus?" Choices: a right angle | diagonals bisect each other | two consecutive sides congruent | opposite angles congruent. Adds nothing: bisect, opposite angles, dim together. Right angle: rectangle, dim. Two consecutive sides equal, with opposite sides already equal: four equal sides. The sticks cross square. One beat each for the other variants: "a diagonal bisects a pair of opposite angles" (fold along it, the sides land on each other: rhombus); "diagonals congruent" (equal sticks: rectangle).

**Fast.** "Already true of every parallelogram?" dims two; then angles or equal sticks for a rectangle, sides or a square cross for a rhombus.
**Sense.** Move the stick on screen and watch which shape appears.
**Check.** Say what the fact does to the sticks.
**Rule out.** As in Fast.
**Line.** "Two sticks crossing at their middles make a parallelogram. Equal sticks, a rectangle. Square cross, a rhombus."
**Trap.** Equal diagonals for a rhombus, perpendicular diagonals for a rectangle; choosing a fact every parallelogram has. Moving one stick kills the swap; the half-turn kills the second.
**Kit.** `through` points, `move` with marks that appear when earned (ticks on equal sticks, the box on the square cross), `turn`, `flip`, `dim`.
**Writer.** The strongest for the first version: the sticks argument flattens into a list in weaker hands.

---

### `rg-parallelogram-perpendicular` — The perpendicular from a corner (Geo, `parallelogram-proofs`)

*Shares a film with `parallelogram-angle-steps` (the same problem, stepwise).* 7.G.B.5 is honest for the arithmetic; the consecutive-angle fact is HSG.CO.C.11.

**Standard.** 7.G.B.5 for the linear pair and the equation; HSG.CO.C.11 (consecutive angles of a parallelogram are supplementary) and C.10 (triangle sum) for the facts used.

**Foundations first.** Perpendicular, the foot (where the perpendicular lands), the right-angle box. A right triangle's other two angles make 90° (one beat from the triangle sum). Where the foot lands: on the side when the parallelogram's angle at that corner is acute; outside, past the corner, when it is obtuse, so the angle of the triangle at that corner is the linear-pair partner, 180° minus the parallelogram's angle. Said once: draw it to scale and the figure answers which angle is in the triangle.

**Read.** The angle at the corner (154°) and which corner E lies past ("B is between E and C") are gold; the asked angle is in the right triangle, so it is acute.

**The example.** "In parallelogram ABCD, m∠ABC = 154°. E is on line BC with B between E and C, and AE ⊥ BC. Find m∠BAE." (1) Draw to scale: a leaning parallelogram, 154° at B; the perpendicular from A falls outside, past B; the box at E. (2) The right triangle is ABE; its angle at B is not 154°: it is the angle on the other side of AB along the line, a linear pair: 180 − 154 = 26°. (3) The other two angles make 90: m∠BAE = 90 − 26 = 64°. Sense: acute. Check: 64 + 26 + 90 = 180; and the check that always holds, said as a check: 154 is 64 past 90.

**Quick case** (the foot on the side): m∠ABC = 60°, E on side BC: the triangle's angle at B is ∠ABC itself: 90 − 60 = 30°. The corner-D variant (129° → 39°) is the same picture at another corner.

**Fast.** Draw it; obtuse corner: 180 minus, then 90 minus. Acute corner: 90 minus.
**Sense.** The answer is acute; the foot lands where the to-scale drawing puts it.
**Check.** The triangle's three angles sum to 180.
**Line.** "Right triangle: the other two make ninety."
**Trap.** Using 154° inside the triangle, getting −64 and dropping the sign. The figure drawn at 154° shows the foot outside and the 26° wedge where the triangle really is.
**Kit.** `foot` point, `angle.right`, `angle.tex`; nothing new.
**Writer.** Cheaper model, from this concept: one rule, two placements decided by the drawing.
