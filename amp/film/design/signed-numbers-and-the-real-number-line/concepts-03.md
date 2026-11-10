# Signed numbers and the real number line, part 3: irrational numbers, approximate roots, closure

Nine problem types across `irrational-numbers` (grade 8), `approximate-roots` (grade 8) and `number-system-closure` (Algebra 2). These are the second half of the family's idea: the line has no gaps, and the fractions do not fill it. Six of the nine stand on one picture, the **square ruler** (the number line with each tick's square written above it), so every film in `approximate-roots` opens with the same twenty-second build, the way every `decimal-fractions` film opened by cutting the flat: the line 0 to 15, the squares climbing above the ticks, and the one sentence that makes a root readable: *a root lives between its squares, because a bigger side makes a bigger square.* After that the problems are reading.

Shared kit note, said once: two lessons here (`root-nearest-tenth`, `compare-irrational-values`) and place value's `decimal-multiplication` all need a squared decimal computed on the board (13.85², 4.55²). `stack` takes only + and −. It needs `"op": "×"` with the standard layout (partial products, the places counted at the end). Flagged as kit below where it bites.

---

### Grade 8: irrational-numbers (8.NS.A.1)

**`repeating-decimal-to-fraction` — Write a repeating decimal as a fraction.** Foundation 10.
Standard: 8.NS.A.1, "for rational numbers show that the decimal expansion repeats eventually, and convert a decimal expansion which repeats eventually into a rational number." The problems practice the second clause; the lesson teaches the first in one beat because the second makes no sense without it.
Foundations first: (1) *Rational*: can be written as a fraction of two integers. The bar: the digits under it repeat forever; 0.34̄ is 0.34444…, and the 3 happens once. (2) *Why a fraction's decimal must repeat*, with `longdiv` on 5 ÷ 6: remainders 5, then 2, then 2; the returning 2 is circled, and from there every digit is the same, 0.83̄. There are only six possible remainders when you divide by 6, so one must come back; this is true of every fraction, so every fraction's decimal ends (remainder 0) or repeats. (3) The one motion from place value: ×10 moves every digit one place left. A tail of repeating digits moved left is the same tail. That is the whole trick.
Read: "as a fraction in simplest form" (gold on *simplest*). At a glance: count the digits before the bar and under it; that is how many shifts. 1.6̄: none before, one under. 0.34̄: one before, one under. The answer's size: 1.6̄ is between 1 and 2; 0.34̄ is about a third.
The example, case A (the block starts at once): 1.6̄. (1) Call it x and write it with its tail: x = 1.6666… (2) Multiply by ten: 10x = 16.6666…, stacked over x with the points aligned and the tails side by side (`stack` with row labels `10x`, `x`, tails `…`). (3) The tails are the same, so subtracting leaves nothing after the point: 9x = 15. (4) x = 15/9, both divisible by 3: 5/3.
Case B (a digit before the block), fully worked because it is where the method is misused: 0.34̄. (1) x = 0.3444… (2) 10x = 3.444…; stack over x. The tails do not line up: one begins .444…, the other .3444…. Subtracting now would leave a mess. (3) Shift once more: 100x = 34.444…. Stack 100x over 10x: tails match. (4) 90x = 31. (5) 31 is prime; 31/90 is already simplest.
Fast: one shift for each digit before the block, one more for each digit of the block; subtract the two copies whose tails match; the denominator is what the shifts leave (100 − 10 = 90; 10 − 1 = 9). Always works.
Sense: 5/3 = 1 2/3, and 2/3 = 0.6̄ is a fact most learners already own. 31/90 is near 30/90 = 1/3, and 0.34 is near a third.
Check: `longdiv` 31 ÷ 90: 0.3444…, remainder 40 returning. 5 ÷ 3: 1.666….
Line: "Shift until the tails line up, then subtract."
Trap: 0.34̄ = 34/99, treating the 3 as part of the block. On the stack, the 10x and x tails visibly fail to align; the lesson refuses to subtract until they do. Also 10x = 16.6, the tail dropped: tails are always written.
Kit: `longdiv` with the remainder column and `repeat` (circle, bar); `stack` with row labels and `tail`, subtracting rows aligned on the point. Both in the family design, 4.5.
Writer: strongest. The why (a remainder must return) and the shift are motions that must land on the word; a weak author narrates them.

---

### Grade 8: approximate-roots (8.NS.A.2, 8.EE.A.2)

**`staar-order-mixed-forms` — Order mixed forms, or choose the true comparison.** Mixed.
This type holds three kinds under one name, and one is misfiled: (a) "which comparison is true" with signed fractions, decimals and a root; (b) order a list of positive fractions, percents, decimals and a root; (c) order a list of signed fractions and decimals with no root, which is 6.NS.C.7 and duplicates `signed-context-order`. Split (c) off to grade 6. The lesson below works all three because the learner meets all three, but (c) gets only a quick case.
Standard: 8.NS.A.2, "use rational approximations of irrational numbers to compare the size of irrational numbers, locate them approximately on a number line diagram"; 6.NS.C.7a for the comparisons.
Foundations first: every form is a point on one line, and you can only see order once every number is written the same way: as a decimal. Three renames, each named from the family that owns it: a fraction by division (11/8 = 1.375); a percent by the two-place shift (364% is 3.64, hundredths of a whole); a root by its squares (the ruler, built in twenty seconds). Then the family's two lines: signs sort first; left is less.
Read: "least to greatest" or "greatest to least" (gold); for (a), "true" (gold). At a glance: the first entry of a least-to-greatest list is the most negative, or, with no negatives, the smallest whole part; a comparison that puts a negative above a positive is false before any work.
The example, kind (b): √7, 364%, 3.73, 11/8. (1) Rename each on the board, its label morphing on the line: 11/8 = 1.375; 364% = 3.64; 3.73 stays. (2) √7 on the ruler: 4 < 7 < 9, so between 2 and 3, nearer 3; zoom: 2.6² = 6.76, 2.7² = 7.29, so between 2.6 and 2.7, about 2.65. (3) Drop all four; scan left to right: 1.375, 2.65, 3.64, 3.73. (4) The deciding pair is 3.64 against 3.73: tenths 6 against 7, place value. (5) Answer in the original forms: 11/8, √7, 364%, 3.73.
Rule out: the list starting 3.73 (the only number below 2 must come first) dims with the list that puts √7 last (√7 is below 3): one beat. Of the two left, one swaps 364% and 3.73; the tenths decide.
Quick case (a): the four statements on one line. −0.24 > 0.56 (a negative above a positive) and √6 < 0.9 (6 is past 4, so √6 is past 2) dim together. −2/5 < −√7: −√7 is about −2.65, far left of −0.4; false. −5/4 = −1.25 is left of −0.25: true. Left is less.
Quick case (c): 0.98, −0.1, 0.89, −1.73, −0.2. Signs sort first: three negatives go left; among negatives the bigger size is farther left: −1.73, −0.2, −0.1, then 0.89, 0.98. Rule out: two lists put a negative after a positive; one puts −0.1 before −1.73.
Fast: rename to decimals; signs first; then read left to right as place value taught. Always works.
Sense: 364% is a bit more than three and a half wholes; √7 is less than 3 because 9 is past 7.
Check: read the chosen list on the line from left to right; each step goes right.
Line: "Write them all the same way, then read the line."
Trap: 364% placed last "because 364 is big"; √7 "about 3.5" (half of 7); −1.73 after −0.2 because 1.73 is bigger. The shift to 3.64 on the chart, the ruler, and two brackets from zero make each impossible.
Kit: `numberline` with `rename`, `scan`, `dim`; the square ruler `locate`; the two-place shift from `digits`.
Writer: strongest. Mixed, and the rule-out is the lesson.

**`root-between-integers` — The two whole numbers around a root.** Foundation 12.
Standard: 8.NS.A.2, "locate them approximately on a number line diagram ... show that √2 is between 1 and 2"; 8.EE.A.2, "evaluate square roots of small perfect squares and cube roots of small perfect cubes" as the tool.
Foundations first: √n is the side of a square whose area is n: the number that, times itself, is n. So √144 = 12 exactly. Draw the ruler: a line 0 to 15, and above each tick its square: 0, 1, 4, 9, 16 … 225. Why the ruler reads roots: a bigger side makes a bigger square, so if 144 < 160 < 169 then 12 < √160 < 13. A cube root is the edge of a cube of volume n; the cube ruler has 1, 8, 27, 64, 125, 216, 343, 512, 729, 1000 above.
Read: "between two consecutive whole numbers. What is the *smaller* (or *larger*) one?" The asked word goes gold and is reread before the answer is written. At a glance: name the two squares around the radicand.
The example: √160, the larger. (1) Ruler to 15. (2) `locate`: 160 appears in gold in the upper row between 144 and 169, which brighten; 12 and 13 brighten below. (3) The dot drops below at its true place, nearer 13 (160 is 16 past 144 and only 9 short of 169). (4) The larger whole number: 13.
Quick second case, the cube ruler: ∛542, the larger. 512 < 542 < 729, so 8 < ∛542 < 9. Nine. Three beats; the method is the same, the table is different.
Fast: know the squares to 15² and the cubes to 10³; bracket the radicand; answer the one asked.
Sense: 13² = 169 is just past 160, so √160 is just under 13: a little less than 13 is indeed between 12 and 13.
Check: square both whole numbers aloud; the radicand sits between.
Line: "A root lives between its squares."
Trap: √160 ≈ 80 or 16 (halving, or "the digits"). On the ruler, 80 is far right and its square is 6,400. Also answering the smaller when the larger was asked: gold, reread.
Kit: the square ruler and `upper: "cube"`.
Writer: a capable cheaper model, once the ruler exists: one method, two tables.

**`root-nearest-tenth` — A square root to the nearest tenth.** Foundation 12; pilot lesson 5.
Standard: 8.NS.A.2, "then between 1.4 and 1.5, and explain how to continue on to get better approximations."
Foundations first: the ruler in one line (a root lives between its squares); then the zoom, which is the new idea: between 13 and 14 the ruler keeps working if the upper row shows the squares of the tenths. Rounding is place value's: two neighbors, a halfway tick, which side. Here the neighbors are tenths and the halfway number has a square too.
Read: "to the nearest tenth" (gold): the answer has one decimal place and is one of two neighboring tenths. At a glance: 169 < 191 < 196, so between 13 and 14 and near 14.
The example: √191. (1) Locate: 191 between 169 and 196; the dot drops just left of 14. (2) Zoom to 13.0 … 14.0; the upper row relabels with the tenths' squares, muted. Since 191 is near 196, start from the top: 13.9² = 193.21, past 191; 13.8² = 190.44, short. Those two brighten: 190.44 < 191 < 193.21, so 13.8 < √191 < 13.9. (3) Which is nearer? The halfway tick 13.85 gets its square above it: 13.85² = 191.8225 (stacked on the board). 191 is below it, so the dot sits on the 13.8 side of halfway. (4) 13.8. (5) One beat for the standard's last clause: to get hundredths, zoom again between 13.8 and 13.9 and do the same.
Fast: bracket with whole numbers, bracket with tenths, square the halfway number. Always works. ("The nearer square" in the upper row almost always agrees, but the upper row is not evenly spaced; the halfway square is the sure test, so it is the one taught.)
Sense: 191 is just under 196, so the root is just under 14; 13.8 is.
Check: 13.8² = 190.44 and 13.9² = 193.21 bracket 191; 13.85² is past it.
Line: "Bracket with squares, bracket with tenths, square the halfway number."
Trap: stopping at 13.9 "because 191 is close to 196"; or dividing 191 by something. The zoomed ruler shows 193.21 standing past 191.
Kit: ruler `zoom` to tenths with the upper row relabeled, `half` with `upper: true`; `stack` with `op: "×"` for 13.85².
Writer: strongest, as a pilot lesson; the picture is born here.

**`compare-irrational-values` — The greatest or least of roots, fractions and decimals.** Foundation 12.
Standard: 8.NS.A.2, "compare the size of irrational numbers."
Foundations first: the ruler, and the one sentence that makes comparing fast: squaring keeps order, so *to compare a root with a decimal, square the decimal and read the upper row*. A fraction is divided to tenths (family 9).
Read: "greatest" or "least" (gold). At a glance: a root is not large because its radicand is large; √19 is less than 4.4, since 4.4² = 19.36. Two roots of the same kind sort by radicand with no work.
The example: greatest of 49/11, √17, 4.55, √19. (1) √17 < √19 (17 < 19): √17 cannot be the greatest; it dims alone, with the reason. (2) 49/11: 11 × 4 = 44, remainder 5; 4.45…, under 4.5 (4.5 × 11 is 49.5). (3) The decimal against the roots: 4.55² = 20.7025, written in gold in the upper row, past both 17 and 19. So 4.55 is past both roots. (4) 4.55 against 4.45…: hundredths, place value. (5) 4.55.
Quick second case, "least", a cube root in play: 3.87, ∛43, 10/3, √12. 10/3 = 3.33…; 3.87 is bigger, dims. Is either root below 3.33? Test one number past it: 3.4² = 11.56 < 12 and 3.4³ = 39.304 < 43, so both roots are past 3.4. Least: 10/3. Four beats.
Fast: square (or cube) the decimal and fraction candidates, read the upper row; roots of the same kind sort by radicand.
Sense: 4.55² is over 20, and nothing under the roots is as big as 20.
Check: the candidates' squares on the upper row in order: 17, 19, 19.8 (4.45²), 20.7.
Line: "To compare a root, square the other number."
Trap: √19 chosen as greatest because 19 is the biggest number on screen. Its position on the lower row, left of 4.4, is drawn; 4.55² sits past 19 above.
Kit: the ruler with several `locate`s; `upper: "cube"`; `stack` `op: "×"`.
Writer: a capable cheaper model: one method on the ruler, the example and the dims named.

**`solve-square-cube-equation` — All real solutions of x² = p or x³ = p.** Foundation 13.
Standard: 8.EE.A.2, "use square root and cube root symbols to represent solutions to equations of the form x² = p and x³ = p, where p is a positive rational number. Evaluate square roots of small perfect squares."
Foundations first: an equation asks which numbers make it true (family 11). Squaring on the line: 3² = 9, and (−3)² = 9 too, because a negative times a negative flips twice and lands back on the positive side (foundation 8). So x² = 9 has two solutions, mirror images across zero. Cubing flips once: (−2)³ = −8, so x³ = 8 has one solution, 2, and x³ = −8 has one, −2. When p is not a perfect square, √p is still a point on the line (between its squares) and the symbol √p is its exact name; no decimal is exact.
Read: "all real solutions" (gold on *all*). At a glance: x² means two solutions, a mirror pair; x³ means one; is p a perfect square, a fraction of perfect squares, or neither?
The example: x² = 14. (1) Ruler: 9 < 14 < 16, so √14 is a point between 3 and 4 (3.7² = 13.69, 3.8² = 14.44: between 3.7 and 3.8). Its dot drops; it is not a fraction, so the name stays √14. (2) Mirror: the dot swings across zero to −√14; two equal blue brackets. (−√14)² = 14 because two flips bring it back. (3) Answer: x = √14 or x = −√14.
Rule out: x = 7 and "7 or −7": 7² is 49, not 14 (half of p is never its root unless p = 4); x = √14 alone misses the mirror. Dim the two sevens together, then the lone root.
Quick second case, a fraction of perfect squares: x² = 25/64. (5/8)² = 25/64, so √(25/64) is exactly 5/8, a point you can name. Mirror: x = 5/8 or −5/8. The 25/128 choices: halving again; (25/128)² is tiny. Three beats. One more beat for the cube: x³ = 27 is 3 only; no mirror, because cubing a negative stays negative.
Fast: squared, two answers, ±√p, simplified when p is a perfect square or a fraction of two; cubed, one answer with p's sign.
Sense: √14 is a little under 4 because 16 is just past 14.
Check: square each answer: (√14)² = 14 by definition; (−√14)² = 14.
Line: "A square has two roots; a cube has one."
Trap: x = 7 for x² = 14 and 25/128 for 25/64 (halving), and the positive root alone. The ruler puts 7's square at 49; the mirror swing produces the second root on screen rather than as a rule.
Kit: the ruler and `mirror`.
Writer: a capable cheaper model.

**`root-approximation-select` — True approximations of marked points.** Select 3 of 5.
Said first: the points are lettered, not labeled with their radicands, so the fact that each is a square root changes nothing; as generated this is "read a number line marked in tenths," a grade 4 skill (`decimal-line-point`) at grade 8. Either label the points √52, √55, √58, √61 (then it truly practices 8.NS.A.2, and the lesson below adds the ruler check) or rename the type. The lesson is designed for the labeled version and works for the unlabeled one.
Standard: 8.NS.A.2, "locate them approximately on a number line diagram."
Foundations first: find the step: 7 to 8 is one whole in ten jumps, 0.1 each, written on an arc. Points are read by counting jumps from the nearer end, never ticks. A point not on a mark is read as the nearer mark (place value's drop: which side of halfway). And why these points sit where they do: between 7 and 8 means between 49 and 64; √52 is just past 7.2 because 7.2² = 51.84.
Read: "select the 3 statements that give a true approximation to the nearest tenth" (gold on *3* and *true*). At a glance: two statements name the same point with different values, so at most one of each such pair is true.
The example: A near 7.2, B near 7.4, C near 7.6, D near 7.8; statements: C ≈ 7.6; D ≈ 7.8; D ≈ 7.6; A ≈ 7.2; C ≈ 7.8. (1) Step on an arc: 0.1. (2) A: two arcs from 7: 7.2; it sits a hair past the mark, nearer 7.2 than 7.3. True. (3) C: six arcs from 7, or four back from 8: 7.6; true. (4) D: two arcs back from 8: 7.8; true. (5) "D is about 7.6" and "C is about 7.8" swap the two points: dim together. (6) Three selected; count them.
Fast: step first; count arcs from the nearer end; nearer mark.
Sense: D is the point nearest 8, so its reading is the largest; 7.8 is.
Check: count each point from the other end; with labels, square the reading (7.6² = 57.76, just under 58).
Line: "Find the step first. Count jumps, never ticks."
Trap: counting the ticks including the start (A read as 7.3); the two swapped statements read in a hurry. Arcs only; each statement is read aloud against its point.
Kit: the app's own `number-line` scene with arcs, or `numberline` with `arcs`; `dim`.
Writer: a capable cheaper model.

**`compare-to-pi-select` — Numbers greater or less than π or a root.** Select n of 5.
Said first: the π variants include 355/113, which differs from π in the seventh decimal place (3.1415929… against 3.1415926…). No grade 8 learner settles that without a calculator, and the honest method cannot either; the generator should drop fractions that need more than three decimal places (22/7 = 3.142857… is fine). The decimals 3.141, 3.1415, 3.1416 are settleable once π's expansion is given to six places, and that comparison is a real skill. The lesson below assumes the fix.
Standard: 8.NS.A.2, "use rational approximations of irrational numbers to compare the size of irrational numbers."
Foundations first: the target is written as exactly as it can be: π = 3.141592…, given, never rounded, the dots meaning the digits go on; a root target sits between its squares (25 < 35 < 36, so √35 is just under 6: 5.9² = 34.81). Then the one rule for comparing a candidate to a target: make the candidate's form match. A decimal against π: pad and scan from the left (place value). Any number against a root: square it and read the upper row; a root against a root: compare radicands.
Read: "greater than" or "less than" (gold), and the count. At a glance: for √35, anything 6 or more is greater and anything with a radicand under 35 is less.
The example: the 3 numbers greater than √35: 5.7, √32, 19/3, √38, 6.1. (1) Ruler: √35 just under 6. (2) √32 and √38: radicands sort; 32 < 35 < 38, so one is less, one greater. (3) 5.7² = 32.49 on the upper row, left of 35: less. (4) 6.1 is past 6, so past √35 (6.1² = 37.21 confirms). (5) 19/3 = 6.33…, past 6: greater. (6) 19/3, √38, 6.1: three, counted.
Quick second case, π: the 2 numbers less than π among 22/7, 3.141, √11, 3.1415, 3.1416. Board: π = 3.141592…. Pad: 3.141000 and 3.141500 are less (fifth place 0 against 9); 3.141600 is greater (6 against 5); 22/7 = 3.142… greater at the third place; √11: 3.3² = 10.89 < 11, so √11 > 3.3 > π. Two: 3.141 and 3.1415. Four beats.
Fast: for a root target, radicands and squares; for π, write six digits and scan.
Sense: all the π candidates are within a hundredth of each other, so only the scan can tell them apart; estimates cannot.
Check: count the selections; for each, say the deciding place aloud.
Line: "Never round the target. Match the form, then compare."
Trap: "π is 3.14, so 3.141 is greater"; "π rounds to 3.1416, so 3.1416 equals π." The six written digits make the first impossible; the scan stopping at the fifth place (3.14159 against 3.14160) makes the second.
Kit: `digits` scan across two rows for decimal comparison; the ruler; `dim`.
Writer: a capable cheaper model after the generator fix.

---

### Algebra 2: number-system-closure (HSN.RN.B.3)

**`number-system-closure-classify` — Is the sum or product rational or irrational?** Foundation 14.
Standard: HSN.RN.B.3, "explain why the sum or product of two rational numbers is rational; that the sum of a rational number and an irrational number is irrational; and that the product of a nonzero rational number and an irrational number is irrational." One variant also needs HSN.RN.A.2 (√2 · √18 = √36), taught in one beat.
Foundations first: rational: a fraction of two integers; irrational: not. Two fractions add and multiply to fractions (a/b + c/d = (ad + bc)/bd; integers stay integers), so the rationals are *closed*: with rational steps you never leave the ring. Picture: the `rings`, the rational ring lit, a rational walk (+5) and a rational stretch (×½) that start inside and stay inside. The key move is the *undo*: every rational step can be undone by a rational step (subtract 5; divide by ½), so if a step ends inside the ring, undoing it also ends inside. Then: if √7 + 5 landed inside, subtracting 5 would land √7 inside, which it is not. Multiplication has one exception: ×0 cannot be undone (nothing divides by zero), and 0 × anything is 0, which is rational; that is why the standard says *nonzero*. Two irrationals: no promise either way, because they can cancel: √6 and −√6 are mirror images and sum to zero.
Read: the operation and who is rational and who is not; "counterexample"; "not irrational"; "always" (gold). At a glance: rational + irrational is irrational, full stop; a product with a 0 factor is 0; two irrationals: simplify before judging.
The example, kind A: is 5 + √7 rational or irrational? (1) Suppose the sum were rational: a point in the ring. (2) Undo: subtract 5, a rational step; the result stays in the ring. (3) But the result is √7, which is outside (7 is strictly between 4 and 9). The supposition fails. (4) Irrational: "if the sum were rational, subtracting 5 would make √7 rational."
Rule out, in one beat each: "√7 ≈ 2.646 is a decimal, so the result is a decimal": every real number has a decimal; being rational means the decimal ends or repeats, and this one does not. "Adding the rational number 5 gives a rational result": only when both are rational. "It cannot be decided": the undo decides it.
Quick kind B, the zero exception: √11 · 0 = 0, rational; and the same question backward, "for which rational q is q√2 not irrational": q = 0, because every other q can be divided back out. Three beats.
Quick kind C, two irrationals: √2 · √18: (√2 · √18)² = 2 · 18 = 36, so √2 · √18 = √36 = 6, rational: the root symbol is not a verdict; simplify first. And the counterexample to "the sum of two irrationals is always irrational": √6 and −√6, the mirror pair, sum to 0. Rule out: √49 and √64 are 7 and 8, not irrational; √6 and −2 has a rational in it; √6 + √2 cancels nothing. One counterexample kills an always.
Fast: name which numbers are rational; rational with irrational is irrational unless the operation is ×0; two irrationals: simplify, and look for a mirror pair or a perfect square.
Sense: 5 + √7 ≈ 7.646…, and the digits after 5 are √7's own, which never repeat.
Check: compute the counterexample (√6 + (−√6) = 0; √2 · √18 = 6); for the undo argument, say the sentence with the specific numbers.
Line: "Rational steps can be undone, so a rational result needs rational parts. One counterexample kills an always."
Trap: "it has a root, so it is irrational" (√2 · √18, √49); "it has a decimal, so it is rational"; forgetting that 0 × √11 is 0. Simplify-before-judging on the rings, and the ×0 step drawn with nothing to undo it.
Kit: `rings` with `highlight` and a walk or stretch shown inside the rational ring (`card`, `simplify`, `drop` from the family spec suffice); otherwise the board.
Writer: strongest. The undo argument and the zero exception must be said exactly right in plain words, and a checker cannot verify reasoning.

---

### Collected flags for the app

- `staar-order-mixed-forms`: split the pure signed-order lists (no root) off to grade 6; they duplicate `signed-context-order`.
- `root-approximation-select`: label the points with their radicands (√52, √55, √58, √61) or rename the type "read a number line to tenths."
- `compare-to-pi-select`: drop 355/113 and any fraction needing more than three decimal places; keep decimals that π's six given digits can settle.
- `solve-square-cube-equation`: the goal names x³ = p but no variant generates it; add cube variants (x³ = 27, x³ = −8) so the "one root" half is practiced.
- Kit shared with place value: `stack` with `op: "×"` for squared decimals (13.85², 4.55²) and `decimal-multiplication`.