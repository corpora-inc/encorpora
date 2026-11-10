# The Complex numbers family: concepts for the nine problem types

Two corrections to the family design's §6, based on the generated variants: the base case HSA.REI.B.4b asks for *is* practiced (`complex-quadratic-solve` has x² + 25 = 0), and a product from modulus and argument *is* practiced (`complex-plane-operations` asks |zw| and arg(zw) from |z|, arg z, |w|, arg w). Both gaps close. Three formatting oddities the app should fix, because the lesson otherwise has to apologize for the problem: `(−3 − i)(0 − 5i)` writes a pure imaginary with a 0 real part; `−1i⁴` and `−1i²` write a coefficient of 1; the `complex-parts` decoy "imaginary part 1i" is the misconception, which is right, but confirms the app's convention is b real, so every lesson says "the imaginary part is the number multiplying i, without the i."

---

### `complex-multiplication` (A2)

**Standard.** HSN.CN.A.2: "Use the relation i² = –1 and the commutative, associative, and distributive properties to ... multiply complex numbers." A.1 in part: the answer is written a + bi.

**Foundations first.** The family's fifteen-second opening: the unit arrow half-turns to −1 on "times negative one"; back at 1 it quarter-turns to i and a quarter more to −1: i · i = −1, watched. "A complex number is a + bi: a right, b up." Then the one new word: **i is a letter until it is squared.** Multiplying two binomials is four products (family 12, named, not retaught); the **box** is built live: the terms of one factor down the side, the other's along the top; a cell is blue when its product has no i, rust when it has one i, and the corner where i meets i is the only place anything new happens.

**Read.** "Multiply ... using i² = −1. Choose the exact product." The answer is one complex number, real part first; a zero part is left out. At a glance: real part = first·first − last·last (the minus is the i² corner); imaginary part = the two crosses added. If the two factors are mirror images (same a, opposite b), the crosses cancel and the answer is a² + b², a positive real with no i: known before any work.

**The example.** (1 − 5i)(3 − 5i). Choices: −22 + 10i, 3 − 20i, −22 − 20i, 28 − 20i. (1) The box: rows 1, −5i; columns 3, −5i. Cells fill on the words: 1·3 = 3 (blue); 1·(−5i) = −5i (rust); −5i·3 = −15i (rust); −5i·(−5i) = 25i² (the corner, outlined). (2) "i squared is negative one": the corner rewrites to −25 and turns blue. (3) The two blue cells light together and collect on the board in blue: 3 − 25 = −22. The two rust cells light and collect in rust: −5i − 15i = −20i. (4) −22 − 20i, written real part first.

Second example, fully worked but faster, because it is the case every later lesson leans on: (2 − 5i)(2 + 5i). Choices: −21, 29 + 20i, 29, 4. By the two parts: 2·2 − (−5)(5) = 4 + 25 = 29; crosses 10i − 10i = 0. The box drawn beside it shows why: the rust cells are equal and opposite. 29. (§7 named this the main example; the general product goes first so the mirror pair is seen as the special case it is.)

**Fast.** Real part ac − bd, imaginary ad + bc. For a mirror pair, a² + b² and done.

**Sense.** The corner always flips sign, so the real part always carries a minus from the i² term. A product with i in both factors is real only when the crosses cancel, which is exactly the mirror pair.

**Check.** Recompute the two parts aloud from the rule. For the pair: 2² + 5² = 29. Said once as a bonus the plane proves later: the squared lengths multiply, 26 × 34 = 884 = 22² + 20².

**Rule out.** A choice whose real part is ac + bd (28, −21): i² kept as +1, gone. A choice with only the first product (4) or the i² term dropped (3 − 20i): gone. For a mirror pair, any choice with an i: gone.

**Line.** "i is a letter until it is squared." And for the pair: "A number times its mirror lands on the real line."

**Trap.** i² treated as +1 (4 − 25 = −21 instead of 29) or left as i². The corner rewrites on the word, in front of the learner, and turns blue as it becomes real. The sign of the crosses is the second real slip (−22 + 10i); the rust cells collect on the board with their signs visible.

**Kit.** `box` (per-cell inks, `rewrite` on the word, highlight of two cells together), `dim`. Nothing else.

**Writer.** Cheaper model: one method, one component with named actions, decoys that are three named slips.

---

### `complex-quadratic-solve` (A2)

**Standard.** HSN.CN.C.7: "Solve quadratic equations with real coefficients that have complex solutions." HSA.REI.B.4b: "by inspection (e.g., for x² = 49), taking square roots, completing the square ... Recognize when the quadratic formula gives complex solutions and write them as a ± bi." The reverse variants (equation from its roots) serve C.7's understanding and A.2.

**Foundations first.** Open on the parabola, not the dial: y = x² − 10x + 30 drawn in the x–y plane, floating clear of the x axis. "A square is smallest when it is zero" (family 15): this graph never touches, so there is no real x with x² − 10x + 30 = 0. Name i in one line: i² = −1, so √(−m) = i√m because (i√m)² = −m. Completing the square is named as family 15's move, not retaught. Then the handoff, said once: "This graph has an x axis and a y axis. The solutions are not on it anywhere. They live in the complex plane."

**Read.** "Over the complex numbers ... all solutions": two solutions, written p ± qi, with the ± because they are a mirror pair. "Which equation has the solutions": the reverse. At a glance: the real part of the roots is the axis of symmetry, −b/2a; for x² − 10x + 30 that is 5, so two choices die before any work.

**The example.** Quick first, as the base case on its own screen: x² + 25 = 0. x² = −25; no real square is negative; x = ±5i. Choices ±5 (no i: gone), 5i alone (one root of two), ±25i.
Then the full one: x² − 10x + 30 = 0. Choices: 5 ± √5, 5 ± √5 i, 10 ± √5 i, −5 ± √5 i. (1) The parabola: axis dashed at x = 5, vertex (5, 5), five above the axis. (2) Complete the square on the board: x² − 10x + 25 = −30 + 25, so (x − 5)² = −5; the picture already said it: a square equal to a negative. (3) x − 5 = ±√(−5) = ±i√5 (the minus comes out as i). (4) x = 5 ± √5 i. (5) The complex plane: 5 on the real axis, the dashed axis carried over, the two roots dropping onto it at ±√5, mirror images. "The roots leave the line as a mirror pair."
Quick, own screen: 3x² − 24x + 60 = 0: divide every term by 3 first; x² − 8x + 20 = 0; (x − 4)² = −4; 4 ± 2i.
Second full example, because it is a different act: "Which equation has the solutions x = −2 ± 2i?" Choices: x² − 4x + 8, x² + 4x, x² + 4x + 8, x² + 4x + 4. Run the forward move backward: the roots sit on the axis x = −2, two above and below, so (x + 2)² = −4, so (x + 2)² + 4 = 0, so x² + 4x + 8 = 0. The picture: the mirror pair, the axis, the parabola drawn back with vertex (−2, 4).

**Fast.** a = 1 and b even: p = −b/2, q = c − p²; write p ± i√q (if q > 0). Otherwise the formula. Reverse: x² − 2px + (p² + q²) = 0.

**Sense.** Real part equals −b/2a. The vertex height is the q. For a monic, p² + q² must equal c: 25 + 5 = 30.

**Check.** Plug one root in, shown once slowly in this lesson: (5 + √5 i)² − 10(5 + √5 i) + 30 = 25 + 10√5 i − 5 − 50 − 10√5 i + 30 = 0. Reverse: sum of roots −4 = −b, product 4 + 4 = 8 = c.

**Rule out.** No i where the graph misses the axis: gone. Real part not −b/2a (10, −5): gone together. Reverse: a constant term equal to p² alone (x² + 4x + 4, the q forgotten) or 0: gone; b with the wrong sign (−4x): gone.

**Line.** "No real square is negative, so the roots leave the line as a mirror pair."

**Trap.** Taking √(−5) as −√5 or √5 (choice 5 ± √5); the sign of b in the reverse (−2 as real part giving x² − 4x). The lesson writes (x − 5)² = −5 and (x + 2)² = −4 as the hinge both ways, so the sign of p is read off the axis of symmetry, not guessed.

**Kit.** `plot` and dashed `seg` exist; complex `axes`; `dim`. Two planes on one card (§4.6) only if two shots with the handoff said aloud feel disjointed; try two shots first.

**Writer.** Strongest. The handoff, the mirror pair as a motion that proves, and the reverse via the same hinge are the design; a weak writer runs the formula and draws nothing that proves.

---

### `complex-parts` (A2)

Said first: this type is three asks under one name, and its powers ask overlaps `powers-of-i-sum`. Proposal stands: keep parts and roots of negatives here (A.1); move single powers of i to `powers-of-i-sum` as its easy case. The concept below covers all three because the app serves all three today.

**Standard.** HSN.CN.A.1: "Know there is a complex number i such that i² = –1, and every complex number has the form a + bi with a and b real." A.2 for the powers.

**Foundations first.** This is where i is born, so the opening is the whole foundation and may run thirty seconds: on the real line no square is negative (a dot at 3 and at −3 both square to 9). Times negative one is a half-turn about 0. Make a number that does that in two equal steps: a quarter turn each, so from 1 it lands straight up. That is i, and i · i, a second quarter turn, lands at −1: i² = −1. The dial: 1, i, −1, −i at the compass points. Then a + bi: a right, b up, the point and the triangle under its arrow. Define: real part a; **imaginary part b, a real number, the number multiplying i, with its sign and without the i.** Then √(−m) = i√m, because (i√m)² = i² · m = −m: "the minus under the root comes out as i."

**Read.** Three asks, each on its own screen. "Real part and imaginary part": two real numbers with their signs. "Simplify iⁿ" or "which is a real number": the remainder after fours. "Write ... in the form a + bi": root the positive number and put i in front.

**The example.** Parts: z = 3 − 8i. Choices: real 3, imaginary −8i; real 3, imaginary 8; real −8, imaginary 3; real 3, imaginary −8. Plot it: 3 right (blue leg, labeled 3), 8 down (rust leg, labeled −8). Real part 3; imaginary part −8, the signed height.
Powers: i²⁰. Choices −1, 1, i, −i. The dial turns one quarter per counted power; after four it is home, i⁴ = 1. 20 = 4 · 5 + 0: five full spins, remainder 0, home: 1. The board writes 20 = 4 · 5 + 0 as the arrow spins.
Roots: 9 − √(−36). Choices: 9 − 36i, 9 + 6i, 3, 9 − 6i. (1) √(−36) = √36 · i = 6i; check (6i)² = 36i² = −36. (2) 9 − 6i. (3) Real part 9, imaginary −6; the point: 9 right, 6 down.

**Fast.** Parts: read the two numbers with their signs; a missing term is 0. Powers: remainder after fours (0 → 1, 1 → i, 2 → −1, 3 → −i). Roots: i out first, then root the positive.

**Sense.** The dial: an even power is ±1, an odd power is ±i, so "i⁸ is the real one" is seen before it is computed. A root of a negative gives a height, never a change to the real part.

**Check.** Parts: plot the choice and land on the same point. Powers: i²⁰ = (i⁴)⁵ = 1⁵. Roots: square the imaginary term back: (6i)² = −36.

**Rule out.** An imaginary part with an i in it, or swapped parts: gone. For "which is real", any iⁿ with n odd and anything with a nonzero bi: gone together. 9 − 36i (root not taken) and 3 (the 9 and 6 subtracted): gone.

**Line.** "Times i is a quarter turn; four quarter turns, home." "The minus under the root comes out as i."

**Trap.** The imaginary part given as −8i (the app's own decoy, and what learners actually write); 9 − √(−36) collapsed to 3; 20 ÷ 4 = 5 read as i⁵ = i. The signed height on the triangle, the i pulled out before any subtraction, and the dial spinning five times and landing home make each impossible.

**Kit.** `dial` (turn by quarters, `from`, compass labels lighting), complex `axes` with `components`, `dim`.

**Writer.** Strongest for the first version: the definition is born here and the register sets the family. Revisions can go cheaper.

---

### `nonmonic-complex-quadratic` (A2)

**Standard.** HSA.REI.B.4b: "the quadratic formula ... Recognize when the quadratic formula gives complex solutions and write them as a ± bi for real numbers a and b." HSN.CN.C.7.

**Foundations first.** One beat on the parabola y = 3x² + 5x + 7: it floats above the axis, so no real solution; axis of symmetry at x = −5/6, the real part of what is coming. The formula is named (family 15), written once, with the discriminant on its own line. Define: the answer (−5 ± i√59)/6 means −5/6 ± (√59/6)i; that is the a ± bi the standard asks for, written over one denominator as the app writes it.

**Read.** "What are the solutions of 3x² + 5x = −7?" Not in = 0 form: that is the first thing to notice. At a glance: a = 3, so the denominator is 2a = 6, and the real part is −b/2a = −5/6; two choices die. If the graph misses, there is an i: a third dies.

**The example.** 3x² + 5x = −7. Choices: (−5 ± √59)/6, (5 ± i√59)/6, (−5 ± i√59)/6, (−5 ± i√59)/3. (1) Standard form: add 7 to both sides: 3x² + 5x + 7 = 0; a = 3, b = 5, c = 7, each lit as it is read. (2) The discriminant on its own line: b² − 4ac = 25 − 84 = −59. Negative: the solutions have i. (3) √(−59) = i√59. (4) x = (−5 ± i√59)/(2 · 3) = (−5 ± i√59)/6. (5) Said once: that is −5/6 ± (√59/6)i. No second example: all six variants are this method; the two written as "= −c" are the case that matters, and it is the one worked.

**Fast.** Standard form; read a, b, c; discriminant; if negative, i√(positive); over 2a.

**Sense.** Real part −b/2a is the axis of symmetry drawn on the parabola. For a check of the constant: the product of the roots is c/a: (25 + 59)/36 = 84/36 = 7/3 ✓.

**Check.** The product of roots above, or substitute: the real part squared plus the imaginary part squared times a, plus b times the real part, plus c, equals zero. The lesson shows the product check; it is short.

**Rule out.** No i (D < 0): gone. Denominator a instead of 2a (/3): gone. +b instead of −b (5 ± ...): gone. One choice stands; prove it.

**Line.** "Real part: negative b over two a. Imaginary part: the root of the positive discriminant over two a."

**Trap.** Reading c = −7 from "= −7" without moving it: then D = 25 + 84 = 109 and the roots look real. Standard form is step one on its own line, and the discriminant has its own beat before the root is taken. Losing the sign of −b is the second slip; the decoy is there and dims by name.

**Kit.** `plot`, dashed `seg`, `dim`. Nothing new.

**Writer.** Cheaper model: one method, line by line, decoys that name the three slips.

---

### `powers-of-i-sum` (A2)

**Standard.** HSN.CN.A.2: "Use the relation i² = –1 and the commutative, associative, and distributive properties to add, subtract, and multiply complex numbers." Family 4's exponent laws in part (i^(4k + r) = i^r).

**Foundations first.** The dial from `complex-parts`, named and shown turning: one quarter per power, home after four, so only the remainder after fours matters. Then the sort: a term whose power becomes ±1 is real (blue); a term whose power becomes ±i is imaginary (rust). Like terms (family 12) are collected inside each pile; the letter x can live in both piles, and that is fine. The answer is written real pile + (imaginary pile)i.

**Read.** "Which expression is equivalent to ... where x is a real number?" Four terms in, two piles out. At a glance: 11, 8, 5, 5 have remainders 3, 0, 1, 1, so one term is real and three are imaginary; the imaginary pile will have three contributions.

**The example.** −3xi¹¹ + 3xi⁸ + 4xi⁵ + 2i⁵. Choices: 3x + (x + 2)i, 3x + (−7x − 2)i, 7x + 2 + 3xi, 3x + (7x + 2)i. (1) The dial for i¹¹: two full spins and three quarters, lands at −i; board: 11 = 4 · 2 + 3. For i⁸: home, 1. For i⁵: one quarter past home, i. (2) Rewrite each term with its reduced power, in color: −3x · (−i) = +3xi (rust; the two minuses said aloud); 3x · 1 = 3x (blue); 4x · i = 4xi (rust); 2 · i = 2i (rust). (3) Blue pile: 3x. Rust pile: 3x + 4x + 2 = 7x + 2. (4) 3x + (7x + 2)i. No second example: every variant is this method; the one with a k and three terms adds nothing.

**Fast.** Remainder after fours for each term; write ±1 or ±i; sort by color; collect.

**Sense.** Count: four terms in, four reduced terms accounted for, one blue and three rust. An x in both piles is expected, not a sign of error.

**Check.** Redo the remainders (11 = 8 + 3, 8 = 8 + 0, 5 = 4 + 1); the piles add to four terms.

**Rule out.** Piles swapped (the real part holding what came from odd powers): gone. An imaginary coefficient missing the double-negative term's flip (x + 2 instead of 7x + 2): gone once the −3x · (−i) line is on the board.

**Line.** "Times i is a quarter turn; four quarter turns, home." Then: "Sort, then collect."

**Trap.** −3x · (−i) written as −3xi: the double negative dropped. That line gets its own beat, both minuses named. Second: 11 ÷ 4 taken as the quotient, or "odd power means −1"; the dial's three leftover quarters make the remainder visible.

**Kit.** `dial` with `quarters` and `from`; colored terms on the board (TeX colors exist); `dim`.

**Writer.** Cheaper model: one method, one trap, the dial exists.

---

### `complex-conjugate-division` (PC)

**Standard.** HSN.CN.A.3 (+): "Find the conjugate of a complex number; use conjugates to find moduli and quotients of complex numbers." A.2 for the multiplication inside. The app asks z z̄ as a number but never as |z|²; the lesson says it anyway.

**Foundations first.** Precalculus opening: the plane, one arrow z = 3 + 2i with its triangle. The conjugate: z flips across the real axis to z̄ = 3 − 2i, a dashed arrow in the same ink; its angle arc reverses. The motion that proves foundation 5: z turns by z̄'s angle (the reversed one) and stretches by |z|: it lands on the real axis at 3² + 2² = 13. "A number times its mirror lands on the real line: a² + b²." The board confirms with the box: the crosses cancel, the corner flips. Then the only idea in dividing: a fraction's value does not change when top and bottom are multiplied by the same number (family 9, named), so multiply both by the conjugate of the bottom and **the bottom becomes real.**

**Read.** "Divide ... write the exact quotient in the form x + yi." At a glance: the bottom will become c² + d² = 13, a whole number; the answer's length is |z|/|w|; a choice as long as the top (the 13 forgotten) or built termwise is gone.

**The example.** (−16 − 2i)/(3 + 2i). Choices: −44/13 − 38/13 i, −52 + 26i, −4 + 2i, −16/3 − i. (1) The conjugate of the bottom: 3 − 2i, mirrored on the plane. (2) Multiply top and bottom by it, written as one fraction. (3) Bottom: 9 + 4 = 13, read straight off the triangle. (4) Top, in the box: −48 + 32i − 6i + 4i² = −48 − 4 + 26i = −52 + 26i. (5) Divide both parts by 13: −4 + 2i. (6) Sense on the plane: |−16 − 2i| = √260, |3 + 2i| = √13, ratio √20; |−4 + 2i| = √20 ✓.
Quick, own screen: "the conjugate of z = −1 − 2i is z̄ = −1 + 2i; find z z̄": 1 + 4 = 5, no work; that is |z|².
Quick, own screen: 1/(2 + 3i): the top is 1, so the answer is the conjugate over 13: 2/13 − 3/13 i. Fractions stay exact.

**Fast.** Multiply top and bottom by the conjugate of the bottom; bottom = c² + d²; top by two parts; divide each part.

**Sense.** The bottom is positive, real and a whole number. The quotient's length is |z|/|w|.

**Check.** Multiply back: (−4 + 2i)(3 + 2i) = −12 − 8i + 6i + 4i² = −16 − 2i ✓. Shown.

**Rule out.** Termwise (−16/3 − i): gone. Same length as the top (−52 + 26i): the 13 forgotten, gone. A top multiplied by the bottom itself instead of its mirror (−44/13 − 38/13 i): gone when the conjugate is written. For z z̄: anything negative or with an i: gone.

**Line.** "Make the bottom real."

**Trap.** Multiplying only the bottom by the conjugate (changes the value), or by the conjugate of the top (bottom stays complex), or forgetting the final ÷13. The one fraction written with both top and bottom multiplied, and the length check, make each visible.

**Kit.** `flip` must carry a vector's label and triangle; `arg` arc that reverses on flip; `box`; `dim`. `product` is sugar for the landing motion; `turn` plus `stretch` on one word serves.

**Writer.** Cheaper model from this concept: one method, one motion, the check is multiplying back.

---

### `complex-plane-forms` (PC)

Said first: four asks under one name (read a point, modulus, sum of two points, polar form). Split polar form into its own type; modulus belongs with distance (|z| is |z − 0|). The concept below separates these topics, written so the polar half can be lifted out whole.

**Standard.** HSN.CN.B.4 (+): "Represent complex numbers on the complex plane in rectangular and polar form ... and explain why the rectangular and polar forms of a given complex number represent the same number." B.6 for the modulus; B.5 and VM.B.4a for the sum.

**Foundations first.** The plane, one arrow, its triangle: "a right, b up: a point, and the arrow from 0 to it." Length is the hypotenuse: |z| = √(a² + b²), Pythagoras (family 27, named). Adding is tip to tail: a copy of w slides to z's tip, the sum arrow appears from 0. Polar form: the same point named by its length r and its angle θ from the positive real axis, counterclockwise; r cos θ is how far right, r sin θ how far up, so r(cos θ + i sin θ) is a + bi. "Same point, two ways to name it." Angles in radians; the quadrant angles said in degrees once.

**Read.** Read a point: horizontal then vertical, a + bi. Modulus: a nonnegative real, no i. Sum: add parts. Polar with 0 ≤ θ < 2π: quadrant first; that kills three choices.

**The example.** Full: write 3 − 3√3 i in polar form. Choices: 6 cis 5π/3, 6 cis π/3, 6 cis 2π/3, 6 cis 4π/3 (written out as the app does). (1) Plot: 3 right, 3√3 ≈ 5.2 down: fourth quadrant, drawn to scale. (2) r = √(9 + 27) = √36 = 6, labeled on the arrow. (3) The reference triangle: legs 3 and 3√3, hypotenuse 6, the 1-√3-2 triangle (family 30): reference angle π/3. (4) Fourth quadrant: θ = 2π − π/3 = 5π/3; the gold arc sweeps from the positive real axis all the way round. (5) 6(cos 5π/3 + i sin 5π/3). (6) Back: 6 · ½ = 3, 6 · (−√3/2) = −3√3. Same point.
Quick, own screens: read P: 6 + 4i (6 across, 4 up; the triangle labels do it). |5 − 12i|: legs 5 and 12, 5-12-13, 13; b² is positive whatever b is. z + w from P and Q: slide w's copy to z's tip, the sum arrow lands and reads 6 − i live.

**Fast.** Polar: quadrant, r from the triangle, reference angle from the special triangle, then the quadrant's angle. Never tan⁻¹ alone: it lands in the wrong quadrant half the time. Modulus: look for a triple. Sum: parts added; the picture confirms.

**Sense.** The arrow points into the fourth quadrant, so θ is between 3π/2 and 2π. A modulus is longer than either leg and shorter than their sum.

**Check.** r cos θ and r sin θ give a and b back. Modulus: 13² = 169 = 25 + 144. Sum: the parallelogram's fourth vertex is the sum.

**Rule out.** Three polar angles in the wrong quadrant: gone together. A modulus with no root (169), with an i, or negative: gone. A point with parts swapped (4 + 6i): gone.

**Line.** "Quadrant first, then the reference angle." "Same point, two ways to name it."

**Trap.** Reporting the reference angle (π/3) as the angle; √(25 − 144) for |5 − 12i| because of the minus; a + bi plotted at (b, a). The to-scale point in the fourth quadrant with the arc swept all the way round, the squares that kill the sign, and the labeled legs make each impossible.

**Kit.** Complex `axes`, `components` with `lengths`, `arg` with a full sweep, `@z` readout on the slid copy, `dim`.

**Writer.** Polar form needs the strongest writer (the "same number" explanation is the standard itself); read-point, modulus and sum can go cheaper once split.

---

### `complex-plane-operations` (PC)

Said first: six asks, not four: the step from Q to P (z − w), the parallelogram's fourth vertex (z + w), the conjugate as a lettered point, zw with w given in polar form, the rotation angle of iⁿ, and |zw| and arg(zw) from moduli and arguments. One picture carries them, but the lesson will run long; if it does, split into "moves of a point" (sum, difference, conjugate) and "turn and stretch" (products, powers of i), and this concept is written in those two halves.

**Standard.** HSN.CN.B.5 (+): "Represent addition, subtraction, multiplication, and conjugation of complex numbers geometrically on the complex plane; use properties of this representation for computation." HSN.VM.B.4a and c in part (the parallelogram rule; subtraction by connecting the tips).

**Foundations first.** The plane with arrows z and w from 0. Each operation is a move, shown once on the same figure: adding is tip to tail, and the parallelogram's far corner is the sum; z − w is the arrow from w to z ("to minus from"), because w plus that step is z; the conjugate is the mirror in the real axis; times i is a quarter turn counterclockwise (the dial from Algebra 2, now with every point on it); times w turns by w's angle and stretches by |w|: "lengths multiply, angles add." Said once: i is the case length 1, angle 90°, which is why the quarter turn was true.

**Read.** Each ask names its move. "The arrow from Q to P": P minus Q, read the step on the grid. "Fourth vertex opposite O": the sum. "Represents z̄": the mirror image, same real part. "zw with w = 3(cos 270° + i sin 270°)": turn z three quarters, triple its length. "By what angle does iⁿ rotate": the remainder after fours, times 90°. "Modulus and argument of zw": multiply the lengths, add the angles. At a glance for lettered points: a choice on the wrong side of the real axis, or at the wrong distance from 0, is gone.

**The example.** Full, on the app's figure: the step from Q to P. Choices: −5 + i, 3 − 7i, 3 + i, −3 + 7i. (1) Read P and Q as points. (2) The gold arrow drawn from Q to P: "the step that takes w to z." (3) Count it on the grid: right 3, down 7, the blue and rust legs labeled 3 and −7. (4) A copy slides to 0 and its tip reads 3 − 7i live. (5) z − w = 3 − 7i. Check: w + (3 − 7i) lands on P.
Quick, each on its own screen with its choices: the parallelogram (slide a copy of w to z's tip; the corner it reaches is X, the sum). The conjugate (flip z across the real axis; the point it lands on). zw with w = 3 cis 270° (turn z 270° counterclockwise, which is a quarter turn clockwise; stretch by 3; the point it lands on). i⁹ (9 = 8 + 1: one quarter turn: 90°). |zw| = 2 · 3 = 6, arg = 30° + 105° = 135° (the arcs stack at 0).

**Fast.** To minus from. Sum: the far corner. Conjugate: flip the sign of b. ×i: (a, b) → (−b, a). ×w: multiply lengths, add angles.

**Sense.** The difference arrow points from the second-named point to the first. The sum is farther from 0 than either addend when they point the same way. A conjugate keeps its real part. A product by a 270° number points a quarter turn clockwise from z.

**Check.** w + (z − w) = z on the figure. Sum: the parallelogram closes. Product: the landing point's length is |z| · |w|.

**Rule out.** The backwards step (−3 + 7i): gone, the gold arrow points the other way. A fourth vertex that is the difference: gone. A conjugate mirrored across the imaginary axis: gone (its real part changed). A product with the angles subtracted (75°) or one angle kept (105°): gone.

**Line.** "z minus w is the arrow from w to z: to minus from." "Lengths multiply, angles add."

**Trap.** Reading Q − P; taking the fourth vertex as the difference; mirroring across the wrong axis; reading ×i as "moves it up" (a slide, not a turn). Each has a decoy and each is killed by watching the move: the arrow's direction, the sliding copy, the flip, the turn about 0.

**Kit.** `@z` readout on a sliding copy, `components` on the gold arrow, `stretch`, `arg` arcs that stack at 0, `product` (turn and stretch on one word), `dim`. The app's own figure through `scene` for the lettered points.

**Writer.** Strongest: a mixed type that teaches reading, and turn-and-stretch is the standard made visible.

---

### `complex-distance-midpoint` (PC)

**Standard.** HSN.CN.B.6 (+): "Calculate the distance between numbers in the complex plane as the modulus of the difference, and the midpoint of a segment as the average of the numbers at its endpoints." The circle variants are B.6's distance read as a locus (family 27's circle).

**Foundations first.** The plane, two arrows z and w. The arrow between them, from w to z, is z − w (named from `complex-plane-operations`, not retaught); its length is the distance, and the triangle under it gives that length by Pythagoras. The midpoint is halfway along that arrow: the average of the two numbers, part by part. The circle: |z − w| = r says "z is r away from w": every such z is a point on the circle with center w and radius r; the center is what z is compared with, exactly as written inside the bars.

**Read.** Distance: a nonnegative real, no i; between the longer leg and the sum of the legs. Midpoint: average each part. Missing endpoint: the same step again past the midpoint. Circle: read the center off the subtraction inside the bars; a plus inside the bars must first be written as a minus.

**The example.** Full: z = 1 − 2i, w = −3; find |z − w|. Choices: 6, 4, 2√5, 20. (1) Plot both; w is on the real axis (a real number is a complex number with imaginary part 0). (2) The arrow from w to z: z − w = (1 − (−3)) + (−2 − 0)i = 4 − 2i, the legs 4 and 2 labeled on the triangle. (3) Length: √(16 + 4) = √20 = 2√5. (4) Sense: longer than 4, shorter than 6; 2√5 is about 4.5.
Second full example, because the circle is a different reading: |z + (−2 + 3i)| = 5. Choices: center 2 − 3i r 5, center 2 + 3i r 5, center 2 − 3i r 25, center −2 + 3i r 5. (1) Inside the bars, written as a subtraction: z + (−2 + 3i) = z − (2 − 3i). (2) "z is 5 away from 2 − 3i." (3) Draw the center at 2 − 3i and the circle, one radius drawn as an arrow labeled 5. (4) Center 2 − 3i, radius 5. Check: 2 − 3i + 5 = 7 − 3i is on it: |7 − 3i − (2 − 3i)| = 5 ✓.
Quick, own screen: the midpoint of z = −4 − 6i and w is 5 − 5i; find w. The step from z to m is 9 + i; the same step again lands at 14 − 4i. Check by averaging: (−4 + 14)/2 = 5, (−6 − 4)/2 = −5 ✓.

**Fast.** Distance: subtract, then √(Δa² + Δb²); look for a triple. Midpoint: average. Missing end: 2m − z. Circle: center as written after the bars read "z minus"; radius r.

**Sense.** The hypotenuse bound. A midpoint sits between the ends in both parts. The radius is the number on the right, not its square.

**Check.** Squaring back: (2√5)² = 20 = 16 + 4. The found endpoint averages with z to m. Center + r satisfies the equation.

**Rule out.** A distance equal to a leg (4), to the legs' sum (6) or with no root (20): gone together. A radius of r² (25): gone. A center whose signs are flipped from what the subtraction says: gone. A missing endpoint equal to the step itself (9 + i) or to m + z (1 − 11i): gone.

**Line.** "Distance is the length of the arrow between; midpoint is the average." "The center is as written; the radius is r, not r squared."

**Trap.** |z| − |w| for the distance; √(16 − 4) because of the minus sign; the circle read by analogy with (x − h)² + (y − k)² = r², giving radius 25, or the plus form read as center −2 + 3i. The triangle's squared legs, and the beat that rewrites the plus as a minus before anything is read, make these impossible.

**Kit.** `circle` exists; `vector` with `components`, `@z`, `dim`. Nothing new.

**Writer.** Cheaper model from this concept: four asks but one picture, one-line acts, and the two circle traps are named here.
