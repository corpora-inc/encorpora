# Radical and rational equations, part 1: ten concepts

Each concept stands on the family design: the two-graph picture, the restriction card written before any step, the drop-and-judge ending, rust for anything forbidden or invented. Verified against every variant in the facts.

---

### `square-root-extraneous` (Algebra 2, square-root-equations)

**Standard.** HSA.REI.A.2, the whole sentence: "Solve simple ... radical equations in one variable, and give examples showing how extraneous solutions may arise." This is the one type in the family where the second clause is practiced in earnest (the learner picks the explanation). HSA.REI.B.4b, "factoring," for the quadratic.

**Foundations first.** This is the family's first lesson, so it builds the idea, not just the method. (1) An equation asks where two sides are the same number; drawn as two graphs, a solution is a crossing (one line, family 13). (2) The fold: a number line folds at zero, −3 lands on 3, under both sits 9. "Squaring forgets the sign." Then the two-line table, written once: *keeps the answers* (add to both sides, multiply by 3, cube) / *can add answers* (square both sides). (3) A square root is one number and never negative (√9 is 3, not ±3; family 4). So before any algebra, whatever stands on the other side of a lone root must be able to be a square root: it must be at least zero. That line is the restriction card. (4) The mirror: on "square both sides" the blue right side swings down over the axis into a dashed rust copy. The squared equation cannot tell R from −R, so its candidates are the crossings with the line *and* with the mirror. A candidate on the mirror is called **extraneous**: it came from the squaring, not from the equation. Defined on the board in those words.

**Read.** Two shapes. Shape A gives the candidates and asks which is extraneous and why: the asked word is "why," so the answer is a sentence, and the sentence is always about the sign of the right side. Shape B says "over the real numbers" and asks for "all solutions": the answer is a set (one number, two, or none), and "no real solutions" is on the table. At a glance, for both: write the card first. The candidate that makes the right side negative is gone before anything is substituted.

**The example, shape A.** "Solving √(−x + 6) = x − 4 by squaring gives the candidates x = 2 and x = 5. Which candidate is extraneous, and why?" Picture: the root curve starts at x = 6 and opens to the *left* (a minus inside the root means the curve points the other way, nothing more); the line y = x − 4 crosses it once, at (5, 1). (1) Card: x − 4 ≥ 0, so x ≥ 4. (2) Mirror: the line swings down into y = 4 − x, dashed rust; it meets the curve at (2, 2). There is the second candidate, on the mirror. (3) Drop and judge: x = 5 falls, left √1 = 1, right 1, the dot rises to the crossing and goes gold. x = 2 falls, left √4 = 2, right −2: a square root is never −2; the dot hollows rust. (4) Answer: x = 2, because the right side is −2 there, which is negative.

**The example, shape B.** "Solve √(−2x + 16) = x − 4 over the real numbers." (1) Card: x − 4 ≥ 0 gives x ≥ 4; −2x + 16 ≥ 0 gives x ≤ 8. A gold window from 4 to 8 is shaded on the axis: any solution lives here. (2) Square the side: −2x + 16 = x² − 8x + 16; collect: x² − 6x = 0; factor: x(x − 6) = 0; candidates 0 and 6. (3) Judge: 0 is outside the window (right side −4), struck on the card; 6 is inside: √4 = 2, 6 − 4 = 2. (4) "Only x = 6." Quick beat, the window alone deciding: √(7x − 7) = −x + 1 needs x ≥ 1 and x ≤ 1, so x = 1 is the only possible answer, and √0 = 0 = −1 + 1: done without squaring.

**Fast.** Card, then square the side, factor, keep exactly the candidates with the right side ≥ 0. Always right: if B ≥ 0 and A = B², then √A = B.
**Sense.** A rising line meets a root curve at most once; a leftward curve and a rising line, once. Two candidates from the algebra and one crossing on the picture means one is on the mirror.
**Check.** Substitute into the *original*, said aloud: "root of four is two; six minus four is two."
**Rule out.** "Both: every candidate found by squaring is extraneous" dims first: squaring never loses a solution, so if the equation has one it is among the candidates. "Neither" dims when one candidate fails the card. In shape B, any choice containing a number outside the window dims in one beat, and "no real solutions" dims the moment one candidate passes.
**Line.** "Squaring forgets the sign. The original remembers."
**Trap.** Checking in the *squared* equation, where both candidates pass, and concluding "neither." The judge always reads the original's two sides in their colors; the squared line is never used to check.
**Kit.** Family tools: `mirror`, `candidate`, `restrict`/`judge`, `dim`, `fold`. The gold window on the axis is the catchment shading already specified for `numberline`, drawn under `axes`.
**Writer.** Strongest: the why is the whole lesson and the decoys are explanations that must be named exactly.

---

### `radical-equation-isolated` (Algebra 2)

**First.** The goal text ("Isolate a square root") belongs to `radical-equation-shifted`; nothing here needs isolating. Every answer is a single number, so the natural no-solution case never appears. Fix the text.

**Standard.** HSA.REI.A.2, "Solve simple ... radical equations in one variable."

**Foundations first.** One line each, naming the owner: a square root is one number, never negative (family 4); squaring is the one-way door, so we check in the original (this family's first lesson). The picture: the root curve and a flat line y = c.

**Read.** "Solve √(…) = c over the real numbers." At a glance: c is 8, 7, 0, 7, 3, 5, all legal square-root values, so there is a solution, exactly one, and the only question is its value. A minus inside the root says nothing about whether there is a solution.

**The example.** √(−x − 5) = 8. (1) Card: the right side, 8, is at least 0: fine. The radicand: −x − 5 ≥ 0 means x ≤ −5. The curve starts at x = −5 and opens to the left, climbing without end. (2) The flat line y = 8 crosses it exactly once, far to the left. (3) Square the side, margin note in rust: −x − 5 = 64. Undo: −x = 69, x = −69. (4) Judge: −69 ≤ −5, allowed; √(69 − 5) = √64 = 8. Gold. Quick beat, a fraction answer: √(5x − 3) = 7, 5x − 3 = 49, x = 52/5; check 52 − 3 = 49. Quick beat, zero on the right: √(−x + 7) = 0 means the radicand is 0: x = 7 (zero is a legal root value; the curve touches the axis there).

**Fast.** Square, solve the linear equation, check. With a nonnegative constant on the right nothing can go wrong, and the check is kept as the habit.
**Sense.** A flat line at height c ≥ 0 meets a root curve exactly once, because the curve starts at 0 and only climbs. One answer, on the side the curve opens toward.
**Check.** Substitute: the radicand comes out c², the root comes out c.
**Line.** "A minus inside the root only turns the curve around."
**Trap.** "A negative under the root means no solution," so the student stops. The curve drawn opening to the left, with the line visibly crossing it, makes the stop impossible. Also seen: 5x − 3 = 7, squaring the left and forgetting the right; the rust note `(\ )^2` sits on the whole line.
**Kit.** Nothing beyond the family's.
**Writer.** Capable cheaper model: one method, one picture, the trap on one card.

---

### `radical-equation-shifted` (Algebra 2)

**Standard.** HSA.REI.A.2, "Solve simple ... radical equations in one variable."

**Foundations first.** The two-line table named in one line: subtracting the same number from both sides keeps the answers; squaring can add them. The picture shows the first fact: the left side is the root curve lifted by 8, the right side the flat line y = 9; when 8 is subtracted from both sides, *both* graphs slide down 8 and the crossing's x does not move. That motion is why isolating first is free.

**Read.** "Solve √(…) + k = c." At a glance: the root equals c − k, and c − k is what must be at least 0. In every variant it is (1, 3, 3, 9, 7, 6), so there is one solution; a problem with c − k negative would have none, and the card would say so before any squaring.

**The example.** √(4x + 2) + 8 = 9. (1) Isolate, its own beat and margin note `−8`: √(4x + 2) = 1. Both graphs slide down 8 together; the crossing keeps its x. (2) Card: 1 ≥ 0, fine; 4x + 2 ≥ 0, so x ≥ −1/2. (3) Square the side: 4x + 2 = 1. (4) 4x = −1, x = −1/4. (5) Judge: −1/4 ≥ −1/2; 4(−1/4) + 2 = 1, √1 = 1, 1 + 8 = 9. Gold. Quick beat, a big one: √(−x + 10) + 1 = 10, root = 9, −x + 10 = 81, x = −71; check 71 + 10 = 81.

**Fast.** Subtract k, square, solve, check. Never square with the k still there.
**Sense.** The answer sits where the root equals c − k; the radicand must come out (c − k)², a perfect square: 1, 9, 9, 81, 49, 36. If the radicand at your answer is not that square, the arithmetic slipped.
**Check.** Substitute into the original and add the k back.
**Line.** "Get the root alone, then square."
**Trap.** Squaring with the 8 still attached, as two pieces: 4x + 2 + 64 = 81. Realistic and common. The isolate step has its own beat, and the `watch` card shows (√(4x + 2) + 8)² once, with the cross term 16√(4x + 2) written in gold: the root is still there, so squaring early buys nothing.
**Kit.** `slide` applied to plots (a group of two plots sliding together); if plots cannot slide today, that is the one piece to add, since this motion proves foundation 2.
**Writer.** Capable cheaper model.

---

### `cube-root-equation` (Algebra 2, radical-equations)

**Standard.** HSA.REI.A.2: "Solve simple ... radical equations" and, in the statement shape, "give examples showing how extraneous solutions may arise" from the other direction: why they do not here.

**Foundations first.** Define the cube root: the number whose cube is the given one. Every real number has exactly one real cube root, and it can be negative: ∛(−8) is −2 because (−2)³ = −8 (family 4). The fold that does not fold: the line for squaring folds (−3 and 3 both to 9); the line for cubing stays flat, −2 to −8 and 2 to 8, different numbers. So cubing both sides is a two-way door: it is in the *keeps the answers* row. No card, no mirror, no judge. The picture: y = ∛x drawn through the third quadrant, so a cube root at height −1 is a point the eye can see.

**Read.** Three shapes under one name: "which statement is correct" about a cubed solution; "solve ∛(…) = c" (c may be negative); "find all real solutions of ax³ + b = c, choose the complete solution set." The gold word in the last is "all": the decoy is the set with ± in it. At a glance: a cube root can equal −1, so no restriction; cube and go.

**The example.** "To solve ∛(x − 9) = −1 a student cubes both sides and gets x = 8. Which statement is correct?" (1) Picture: the curve y = ∛(x − 9) starts nowhere and ends nowhere; the line y = −1 crosses it once, at (8, −1). (2) Cube both sides, note `(\ )^3` in teal, not rust: x − 9 = −1, x = 8. (3) Check: ∛(8 − 9) = ∛(−1) = −1. Gold. (4) The answer is the check itself: "x = 8 is a solution, because ∛(−1) = −1." Each decoy named as it dims: "two solutions, 8 and −8" is the squaring reflex (−8 − 9 = −17, whose cube root is not −1); "extraneous, as squaring can" forgets the fold that does not fold; "a cube root cannot equal a negative number" is contradicted by the point on the curve.

**Second example, a different case: the cube.** −x³ + 10 = −17. Isolate: −x³ = −27, x³ = 27. Take the cube root of both sides: x = 3, one number. The set is {3}. (−3)³ is −27, so −3 is not a solution; {−3, 3} dims. Quick beat for the shifted root: ∛(x + 7) − 4 = −5, add 4: ∛(x + 7) = −1, cube: x + 7 = −1, x = −8; check ∛(−1) = −1, −1 − 4 = −5.

**Fast.** Isolate the root or the cube; cube or take the cube root of both sides; done, with one substitution as the habit.
**Sense.** A cube-root curve or a cubic is crossed by a flat line exactly once: one answer, always.
**Check.** Substitute; the radicand should come out c³.
**Rule out.** Any set with a ± pair dims (that is squares, not cubes); any "extraneous" explanation dims; a numeric choice that does not give c³ under the root dims (−132 is cubing before isolating, −736 is isolating the wrong way).
**Line.** "Cubing keeps the sign: nothing to throw out."
**Trap.** The ± reflex and the "can't be negative" reflex imported from square roots. The fold that does not fold, and the curve through the third quadrant, with the square-root rule restated once so the student leaves knowing both: "a square root is never negative; a cube root can be."
**Kit.** `cbrt` in `plot`; `fold`.
**Writer.** Strongest: the decoys are plausible half-truths and the lesson must untangle them without unsettling the square-root rule.

---

### `sat-entry-radical-equation` (Algebra 2)

**First.** The family design's section 6 says every variant is linear; the facts disagree. Two variants are linear (4√(x + 7) = 5), four are quadratic with a variable other side, two of those asking for "the sum of all real solutions." The goal text is right; the design note is wrong. One real app flaw: 121/16 and its decimal 7.5625 are both six characters and do not fit the five-character box the goal describes for a positive answer; either accept 7.562 and 7.563 or avoid the variant.

**Standard.** HSA.REI.A.2, "Solve simple ... radical equations"; HSA.REI.B.4b, "factoring."

**Foundations first.** Named in one line each: a square root is never negative, so the other side must be ≥ 0; squaring can add candidates, so the original judges. New here: what the entry box takes (whole number, negative, fraction like 7/2, decimal; never a mixed number), said once on the board as the problem is read.

**Read.** "What is the solution of" wants one number; "the sum of all real solutions" wants the survivors added, and only the survivors. At a glance: with a coefficient on the root, the answer is a fraction and the trap is the coefficient; with x on the right, write the card and expect to throw one away.

**The example, case A: a coefficient.** 4√(x + 7) = 5. (1) Card: 5 ≥ 0; x + 7 ≥ 0, so x ≥ −7. (2) Divide both sides by 4 first: √(x + 7) = 5/4. (3) Square: x + 7 = 25/16. (4) x = 25/16 − 112/16 = −87/16. (5) Judge: −87/16 is about −5.4, which is ≥ −7; x + 7 = 25/16, root 5/4, times 4 is 5. (6) Enter −87/16 (six characters, allowed for a negative). The `watch` card shows the other right way, 16(x + 7) = 25, and the wrong one, 4(x + 7) = 25: the 4 must be squared with everything else.

**The example, case B: x on the other side.** √(9x + 37) = x + 3. (1) Card: x ≥ −3. (2) Square: 9x + 37 = x² + 6x + 9; collect: x² − 3x − 28 = 0; factor: (x − 7)(x + 4) = 0; candidates 7 and −4. (3) Judge: −4 is below −3 (right side −1), struck; 7: √100 = 10, 7 + 3 = 10. (4) Enter 7. One beat on the sum wording: √(14x + 22) = x + 5 gives x² − 4x + 3 = 0, candidates 1 and 3, both pass (√36 = 6, √64 = 8), sum 4; had one failed, the sum would be the survivor alone. The quadratic's sum of roots is a check, never the method.

**Fast.** Coefficient: divide it off first. Variable side: card, square the side, factor, keep the candidates with the right side ≥ 0, then do what the question asked (one value, or add them).
**Sense.** A line meets a root curve at most twice; a fraction answer for a coefficient problem is expected. The radicand at the answer must be a perfect square (100, 36, 64, 25/16).
**Check.** Substitute into the original; re-read the question before entering ("the sum").
**Line.** "Divide the coefficient off before you square."
**Trap.** 4(x + 7) = 25, squaring everything but the 4. Shown once as the struck line beside the two right ways.
**Kit.** Nothing beyond the family's; the entry-format note is a `text` line.
**Writer.** Capable cheaper model, once `square-root-extraneous` has fixed the staging of the judge.

---

### `radical-equation-check` (Algebra 2)

**Standard.** HSA.REI.A.2, "Solve simple ... radical equations ... and give examples showing how extraneous solutions may arise" (the "no real solutions" and "both" outcomes are the examples). HSA.REI.B.4b, "factoring."

**Foundations first.** Named, not re-taught: the card (the other side ≥ 0, the radicand ≥ 0), the mirror, the judge. New emphasis: the two restrictions together make a **window** on the axis, shaded gold before any algebra, and the window can be empty.

**Read.** "Which statement describes all solutions": the answer is a set, and this type is where all three outcomes appear: none, one, both. At a glance: draw the window. An empty window is the answer. A window with both candidates inside means both are kept, even though the student has been trained to throw one away.

**The example, no solutions.** √(−15x + 21) = x − 5. (1) Card: x − 5 ≥ 0 gives x ≥ 5; −15x + 21 ≥ 0 gives x ≤ 7/5. No number is both. The two shadings on the axis do not overlap: no window. Picture: the curve opens left from x = 1.4 and the line y = x − 5 rises far to the right of it; they never meet. (2) Square anyway, because the choices offer −4 and −1 and the student will produce them: −15x + 21 = x² − 10x + 25; x² + 5x + 4 = 0; (x + 4)(x + 1) = 0. (3) Judge: at −4 the left is √81 = 9 and the right −9; at −1, √36 = 6 against −6. Both dots hollow rust; on the picture both sit on the mirror. (4) "There are no real solutions."

**Second example, a different case: both survive.** √(5x + 16) = x + 4. Card: x ≥ −4 and x ≥ −16/5, so the window is x ≥ −16/5. Square: 5x + 16 = x² + 8x + 16; x² + 3x = 0; x(x + 3) = 0; candidates 0 and −3. Both are in the window. Judge: √16 = 4 and 0 + 4 = 4; √1 = 1 and −3 + 4 = 1. Both gold; the line crosses the curve twice. "x = −3 or x = 0." (The one-survivor case, √(−2x + 6) = x + 1 with 1 kept and −5 on the mirror, is `square-root-extraneous`'s example and is named in one line.)

**Fast.** Window first; if empty, done. Otherwise square the side, factor, keep every candidate inside the window.
**Sense.** A line can cross a half-parabola twice, once or never; the picture tells which before the algebra does.
**Check.** Both sides of the original at each kept candidate, aloud.
**Rule out.** Any choice naming a number outside the window dims at once; "no real solutions" dims as soon as the window holds a candidate that checks; a single-value choice dims when both check.
**Line.** "Draw the window first. Nothing outside it can be an answer."
**Trap.** Overcorrection: having learned "one is always extraneous," the student rejects one of two good candidates. Both dots rising to two visible crossings makes rejecting either absurd.
**Kit.** The window is the catchment shading on the axis; two shadings that do not overlap must be drawable (two `catch` regions, or a note that the window is empty).
**Writer.** Capable cheaper model after `square-root-extraneous` ships; the method is the same, the three outcomes are the only new thing.

---

### `two-radical-equation` (Algebra 2)

**Standard.** HSA.REI.A.2, "Solve simple ... radical equations"; HSA.REI.B.4b, "factoring."

**Foundations first.** (a + b)² = a² + 2ab + b² (family 12), with the point made for roots: (√u + c)² = u + 2c√u + c², and the middle term still has a root in it. That is why two roots need two squarings, and why the first move is one root alone on each side. The card is written twice, once per squaring.

**Read.** Two faces: √A = √B + c (already one root each side) and √A − √B = c (move √B over first). At a glance: all radicands must be ≥ 0; after the first squaring a new, smaller equation appears with one root and a linear other side, and it gets its own card.

**The example.** √(5x) = √(x + 4) + 2. (1) Card: 5x ≥ 0 and x + 4 ≥ 0, so x ≥ 0. (2) One root on each side already. Square both sides as sides: 5x = (x + 4) + 4√(x + 4) + 4. The cross term 4√(x + 4) is written in gold: "the root is still here." (3) Collect and isolate it: 4x − 8 = 4√(x + 4); divide by 4: x − 2 = √(x + 4). (4) Second card: x − 2 ≥ 0, so x ≥ 2. (5) Square again: x² − 4x + 4 = x + 4; x² − 5x = 0; x(x − 5) = 0; candidates 0 and 5. (6) Judge: 0 fails x ≥ 2 (left side −2), struck; 5: √25 = 5, √9 + 2 = 5. Gold. Enter 5. Picture, as sense only: y = √(5x) in teal and y = √(x + 4) + 2 in blue cross once, at (5, 5). Quick beat for the other face: √(2x + 4) − √(x + 9) = 1 becomes √(2x + 4) = √(x + 9) + 1 by adding √(x + 9) to both sides, then the same six moves give x − 6 = 2√(x + 9), candidates 0 and 16, and 16 checks (6 − 5 = 1).

**Fast.** One root per side; square the sides; isolate the leftover root (divide off a common factor to keep numbers small); card; square; factor; judge in the original.
**Sense.** Two root curves cross at most once here, so exactly one of the two candidates survives; a candidate that makes the isolated linear side negative is the one on the mirror.
**Check.** Both roots in the original, aloud: "root of twenty-five is five; root of nine is three, plus two is five."
**Line.** "Isolate the root. Square the side, not the pieces."
**Trap.** Squaring piece by piece: 5x = x + 4 + 4. The gold cross term, and the `watch` card showing the lost 4√(x + 4).
**Kit.** Nothing beyond the family's.
**Writer.** Capable cheaper model, after `two-radical-steps` has fixed the staging.

---

### `two-radical-steps` (Algebra 2)

**First, badly conceived.** The entry demands the quadratic "with no common factor divided out." A student who divides 2x + 2 = 4√(x + 4) by 2 before squaring (the cleaner habit) enters x² − 2x − 15 and is marked wrong against 4x² − 8x − 60. Accept any nonzero multiple of the coefficient triple, or drop the coefficient entries. Until it is fixed, the lesson teaches the entry honestly: square the isolated line as it stands, enter those coefficients, then divide to solve.

**Standard.** HSA.REI.A.2; HSA.REI.B.4b, "factoring." The entry format also exercises "collect the terms into ax² + bx + c = 0."

**Foundations first.** As in `two-radical-equation`: (√u + c)² = u + 2c√u + c², the cross term still carrying a root; a card per squaring. New: the entry format read aloud and written as five labeled slots before the work begins: a, b, c, the solution, the extraneous one.

**Read.** Five answers from one problem; "collect every term on the left with x² first" fixes the signs of a, b, c; "no common factor divided out" means square the isolated equation exactly as written. In the "some steps are filled in" variants, the given slots are checkpoints: the work must land on them.

**The example.** √(3x + 10) − √(x + 4) = 2. (1) Card: x ≥ −10/3 and x ≥ −4, so x ≥ −10/3. (2) One root per side: √(3x + 10) = √(x + 4) + 2. (3) Square the sides: 3x + 10 = x + 4 + 4√(x + 4) + 4; the cross term in gold. (4) Isolate the root: 2x + 2 = 4√(x + 4). A `text` line: "on your own paper you may divide by 2 here; the entry wants the square of this line." (5) Second card: 2x + 2 ≥ 0, so x ≥ −1. (6) Square: 4x² + 8x + 4 = 16x + 64; collect left, x² first: 4x² − 8x − 60 = 0. Enter a = 4, b = −8, c = −60. (7) Now divide by 4 to solve: x² − 2x − 15 = 0; (x − 5)(x + 3) = 0; candidates 5 and −3. (8) Judge: −3 fails x ≥ −1 (at −3 the original reads √1 − √1 = 0, not 2); 5: √25 − √9 = 5 − 3 = 2. Solution 5, extraneous −3. The five slots fill in gold and rust.

**Fast.** Same as `two-radical-equation`, with one pause: square the isolated line undivided, write the coefficients, then simplify.
**Sense.** The leading coefficient is the square of the x coefficient on the isolated line (2² = 4); the constant is 2² − 16·4 = −60: two of the five answers are checkable before factoring.
**Check.** Both candidates in the original; the "filled in" slots must match the work.
**Line.** "Square the side, not the pieces. Then judge in the original."
**Trap.** Squaring piece by piece (3x + 10 = x + 4 + 4), and moving a term across before isolating so both roots sit on one side (then the cross term is a product of two roots, worse). The gold cross term and the "one root per side" beat with its own margin note.
**Kit.** The five-slot entry card: a `problem` with labeled blanks that fill as the work reaches them. Not in the kit; small, and shared with every "enter each step" type.
**Writer.** Strongest: a long method with a format that must be followed exactly, and the pacing at this grade is the risk.

---

### `rational-expression-domain` (Algebra 1, rational-expression-domain)

**First, misfiled.** Linked to HSA.APR.D.7, a (+) standard beyond Algebra 1. The skill is a sound prerequisite; its honest home is the domain clause of HSF.IF.B.5 ("Relate the domain of a function to its graph and ... to the quantitative relationship it describes") or no link. Keep the type.

**Standard.** As above, HSF.IF.B.5's domain clause in spirit; the practiced act is "find the inputs a rational expression cannot take."

**Foundations first.** (1) A fraction with zero on the bottom has no value: 6 ÷ 0 asks how many zeros make 6, and none do (family 7). (2) A product is zero exactly when a factor is zero (family 15). (3) Define **domain**: the inputs the expression can take; **excluded**: an input that makes the bottom zero, so the expression is not there. (4) The picture, built live: the number line with a hollow rust dot at each excluded value; above it, for one beat, the graph of the expression with a rust wall rising at each hole and the curve passing *through* the axis at the top's zero. "Zeros of the bottom are holes; zeros of the top are answers."

**Read.** "Which real values of x are excluded from its domain?" The gold word is "excluded": the bottom, never the top. At a glance: the bottom is already factored; each factor gives one excluded value; the answer set has as many numbers as the bottom has *different* factors.

**The example.** (x − 2)/((x + 2)(x − 5)). (1) Bottom factors: x + 2 and x − 5. (2) Each to zero, with the sign step written: x + 2 = 0 so x = −2; x − 5 = 0 so x = 5. Hollow rust dots at −2 and 5. (3) The top: x − 2 = 0 at x = 2, where the expression is 0/(4 · −3) = 0, a value the expression *has*; a teal filled dot at 2, labeled "value 0." (4) {−2, 5}. Quick beat, the two look-alike traps in one: (x + 5)/((x + 5)(x + 5)): the factor x + 5 appears twice and also on top; it is excluded once, {−5}, and the matching factor on top does not rescue it: at x = −5 the bottom is 0 · 0 = 0, and 0/0 has no value either.

**Fast.** Each factor of the bottom set to zero; list each value once.
**Sense.** As many excluded values as different factors on the bottom; the top's zero is never among them.
**Check.** Substitute each excluded value into the bottom and read zero; substitute the top's zero and read a nonzero bottom.
**Rule out.** Any set containing the top's zero (here 2) dims at once; a set missing one of two different bottom factors dims; a sign flip (2 for x + 2) dims when the sign step is read.
**Line.** "Zeros of the bottom are holes; zeros of the top are answers."
**Trap.** Excluding the top's zero, and sign slips (x + 2 excludes 2). The card writes "x + 2 = 0, so x = −2" every time; the filled teal dot at 2 says the expression lives there.
**Kit.** `signchart` with `rows: false` and no `rel` (the line with holes); `walls` on `plot`.
**Writer.** Capable cheaper model: short, one rule, one picture.

---

### `rational-inequality-solve` (Algebra 2, rational-expressions)

**First.** No exact Common Core sentence owns this; it is beyond HSA.REI.A.2's "simple rational equations" and is not an APR.D.7 expression operation. Keep it as an Algebra 2 stretch that tests ask; do not file it under expression operations.

**Standard.** None exact; it extends HSA.REI.A.2 to inequalities and stands on HSA.APR.D.7's "rational expressions form a system analogous to the rational numbers" (signs of quotients).

**Foundations first.** (1) The sign of a quotient is the sign of top over bottom (family 3). (2) A rational expression can change sign only where it is zero (the top is zero) or where it has no value (the bottom is zero); between those it keeps one sign (family 13: a graph crosses the axis only at a zero). (3) Interval notation, defined on the board as it appears: a bracket means the end is included, a parenthesis means not; ∞ always gets a parenthesis; ∪ means "together with." (4) The picture, built live: the **sign chart**, a number line cut at every zero of the top (teal tick, filled when the inequality allows equality) and every zero of the bottom (rust tick, always hollow); one test number dropped into each stretch with its sign; the asked stretches shaded; the notation copied from the shading. The graph sits above sharing the x scale, so the curve is below the axis exactly over the shaded stretches. (5) Said once, as the why for never multiplying across: multiplying both sides by x − 3 flips the inequality when x − 3 is negative and not when positive, and we do not know which; the chart avoids the question.

**Read.** "Solve ... Write the solution in interval notation." The gold mark is the inequality sign: ≤ or ≥ lets the top's zero in; < or > does not; a bottom zero is never in. At a glance: the ticks are the factors' zeros, and the brackets in the answer are decided by the ticks before any testing: a bracket at a bottom zero is wrong on sight.

**The example.** (x − 2)/((x − 3)(x + 3)) ≤ 0. (1) Critical values: top, x = 2, filled teal (≤ allows equality); bottom, x = 3 and x = −3, hollow rust. (2) Four stretches. Test −4: top −6, bottom (−7)(−1) = 7, quotient negative: yes. Test 0: top −2, bottom (−3)(3) = −9, positive: no. Test 2.5: top 0.5, bottom (−0.5)(5.5), negative: yes. Test 4: top 2, bottom (1)(7), positive: no. (3) Shade (−∞, −3) and [2, 3); the graph above dips below the axis exactly there, with walls at ±3. (4) Copy: (−∞, −3) ∪ [2, 3).

**Second example, a different case: a squared factor.** (x + 4)/((x + 3)²) ≥ 0. The bottom is a square: never negative, and zero only at −3. So the sign is the sign of x + 4, except that −3 is a hole. Ticks: −4 filled teal, −3 hollow rust. Test −5: negative, no. Test −3.5: positive, yes. Test 0: positive, yes. Shade [−4, −3) and (−3, ∞): the same sign on both sides of −3, but the hole stays open. [−4, −3) ∪ (−3, ∞). The decoy [−4, ∞) is the hole forgotten.

**Fast.** Ticks from top and bottom; one test per stretch; shade; copy, brackets only at filled ticks. Always right; never multiply across.
**Sense.** The shaded stretches match where the graph is below (or above) the axis; a sign changes at every simple tick and does not change at a squared one.
**Check.** Pick one number inside the answer and one just outside; the inequality holds for the first and fails for the second; read each end's bracket against its tick.
**Rule out.** A bracket at a bottom zero dims at once ("a hole is always open"); a parenthesis at the top's zero when the sign is ≤ or ≥ dims; of the two remaining, one test value in one stretch settles it.
**Line.** "A sign changes only at a zero or a hole. Holes are always open."
**Trap.** Multiplying both sides by the denominator (a procedure students trust from equations), and writing a bracket at an excluded value. The chart never multiplies, the holes are drawn hollow before any testing, and the notation is copied from the picture, never written from memory.
**Kit.** `signchart` (`cut`, `test`, `sign`, `shade`, `interval`) under `axes` sharing x; `walls`; the interval-notation callout.
**Writer.** Strongest: the sign logic and the endpoint subtleties are reasoning, not staging, and the trusted wrong procedure must be dismantled, not just avoided.
