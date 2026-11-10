# Polynomial and rational functions, part 1: concepts for the ten division and zeros types

From the family design. Same depth and voice as the place-value concepts: standard, foundations first, read, the example, fast, sense, check, rule out, line, trap, kit, writer. Where a type is misfiled or badly conceived, that comes first.

Two shared openings, so the per-type concepts do not repeat them:

**Every division film opens the same way (about forty seconds, drawn live).** 17 = 5 · 3 + 2: the whole part and the leftover, and 17/5 = 3 + 2/5, never 3 + 2. The same sentence for polynomials: p(x) = (x − a) · q(x) + R, with q the quotient and R the remainder, a number. Put in x = a: the first part dies because its factor (x − a) is zero, so p(a) = R. On the picture: the blue line of the divisor crossing the axis at its zero (x + 3 crosses at −3), the gold probe parked there, the teal dot on p's graph at height p(a). "The remainder is the height."

**Every zeros film opens the same way (about forty-five seconds).** A zero of f is an x where f(x) = 0; the graph meets the x-axis there; it solves f(x) = 0: three names, one thing. A product is zero exactly when a factor is zero (family 15, one line). Each linear factor is a thin blue tilted line: x + 2 passes through (−2, 0), negative to its left, positive to its right. "The factor says where it is zero: x + 2 is zero at negative two." The zero line: the x-axis with each zero a filled dot and its factor written under it. The teal graph of the product is zero exactly where some blue line is.

---

## Polynomial division (`polynomial-division`, Algebra 2)

### `remainder-theorem` — The remainder is p(a); a factor leaves none.

Two cases under one name, rightly: the same theorem read forward (find the remainder) and backward (find k so there is none).

**Standard.** HSA.APR.B.2, both halves: "the remainder on division by x − a is p(a)" and "p(a) = 0 if and only if (x − a) is a factor of p(x)".

**Foundations first.** The shared opening. Then the word *factor*: (x − a) is a factor of p when p(x) = (x − a) · q(x) with nothing left over, R = 0, the graph on the axis at a. Say once that whatever layout the app shows ("the layout is set up to divide..."), the remainder is still p(a).

**Read.** "Remainder" (gold): a number, p(a); no division. "For which number k is x + 2 a factor" (gold on "factor"): the height at −2 must be 0, k is the one unknown, and plugging in makes a one-step equation. At a glance: the divisor's zero, said before anything else: x + 3, so a = −3; x + 2, so a = −2. Size: the cube term dominates, so p(−3) for x³ − x² + x − 6 is negative and in the tens.

**Example A, the remainder.** "What is the remainder when p(x) = x³ − x² + x − 6 is divided by x + 3?" (1) x + 3 is zero at x = −3: the blue line through −3. (2) On the board, every x replaced by (−3) in blue parentheses: (−27) − (9) + (−3) − 6 = −45. (3) The probe parks at −3; the dot sits at height −45 on the stretched, numbered y-axis; the result tag reads −45. (4) Once, beside it, the synthetic table with −3 in the box: 1, −4, 13, −45; its last number and the dot light gold together: the same number. (5) −45.

**Example B, find k** (a different act: solving). "For which number k is x + 2 a factor of p(x) = x³ + x² + kx + 12?" (1) Factor means remainder 0 means p(−2) = 0. (2) p(−2) = −8 + 4 − 2k + 12 = 8 − 2k. (3) 8 − 2k = 0, so k = 4. (4) Picture: k on a slider; the graph turns about its y-intercept (0, 12), since kx is 0 at x = 0; the probe parked at −2 shows height 8 − 2k as k slides; at k = 4 the dot lands on the axis. (5) 4.

**Fast.** Plug the divisor's zero in. For k: plug in, set to 0, solve.
**Sense.** A: −27 first and more taken away: negative, tens. B: without the k term the height at −2 is 8, and each unit of k takes 2 off: four units.
**Check.** A: the table ends at −45; or (x + 3)(x² − 4x + 13) has constant 39, and 39 + (−45) = −6, p's constant. B: k = 4 back in: −8 + 4 − 8 + 12 = 0; or the table 1, 1, 4, 12 with −2 in the box ends in 0.
**Line.** "The remainder is p(a). The divisor says what a is: x + 3 is zero at negative three."
**Trap.** Plugging in +3 for x + 3 (p(3) = 15), or +2 for x + 2 (k = −14, a wrong sign all the way through). Impossible once the blue line is seen crossing at −3 and the first move of every example is "the divisor is zero at...". Also (−3)² read as −9: the board writes (−3) in blue on every x.
**Kit.** The parked probe (family 4.1); a plot with a named parameter, `{"do":"glide","param":"k","to":4}`, and a live `k = @k` readout, the graph redrawing as k slides.
**Writer.** Capable cheaper model once the probe exists: one method, the derivation is the shared opening, `--dry` checks every line.

### `polynomial-quotient` — Divide a cubic by x − a: quotient and remainder.

First: "Use the layout to divide" names a figure the problem text does not show; the lesson uses the app's exact layout (`facts.ts`) and derives it from long division, so the table is arithmetic, not a trick. This type and `cubic-quotient-remainder` are one division in two answer shapes; the derivation lives in whichever is seen, and both carry it.

**Standard.** HSA.APR.D.6, "write a(x)/b(x) in the form q(x) + r(x)/b(x) ... using ... long division", here as a(x) = (x − a) q(x) + R.

**Foundations first.** The shared opening. The quotient is what is left of p once the factor is pulled out; a cubic over a linear leaves a quadratic: the degree drops by one. Long division once, as grade 4 with x in place of 10: divide the first terms, multiply back, subtract, bring down (`longdiv` long layout). Then the collapse: the x's fade, the coefficients slide into the synthetic table, the box holds the divisor's zero in blue, and the table *adds* because the subtraction already flipped the sign.

**Read.** "Quotient and remainder": a quadratic and a number. At a glance: the remainder is p(a), so three of four choices can die before any division.

**Example.** "Divide 2x³ − 6x² + 7x + 10 by x − 3." (Chosen because the quotient has a missing x term and the decoy set holds every trap.) Choices: 2x² − 6x + 7, remainder 10 | 2x² − 12x + 43, remainder −119 | 2x² + 7, remainder −31 | 2x² + 7, remainder 31. (1) x − 3 is zero at 3. (2) Glance: p(3) = 54 − 54 + 21 + 10 = 31; the probe parks at 3, dot at 31; remainders 10, −119 and −31 dim together. (3) Long division: 2x² · (x − 3) = 2x³ − 6x²; subtract: 0x² + 7x; nothing of x² is left, so the quotient's x term is 0 · x, written in muted ink; bring down 10; 7 · (x − 3) = 7x − 21; 10 − (−21) = 31. (4) Collapse: box 3; row 2, −6, 7, 10; bring down 2; 6, sum 0; 0, sum 7; 21, sum 31, gold. The same numbers. (5) Quotient 2x² + 0x + 7 = 2x² + 7, remainder 31; under it, 2x³ − 6x² + 7x + 10 = (x − 3)(2x² + 7) + 31.

**Fast.** p(a) for the remainder, then the synthetic table, which always works here because every divisor the app generates is x − a.
**Sense.** The quotient starts 2x² because 2x³ ÷ x is 2x²; the remainder matches the dot's height.
**Check.** Multiply back: (x − 3)(2x² + 7) + 31 = 2x³ − 6x² + 7x − 21 + 31. Or constants only: (−3)(7) + 31 = 10, p's constant.
**Rule out.** p(3) = 31 kills three at once. Named as they dim: 2x² − 6x + 7, remainder 10 is p with its powers lowered, no division done; −119 is the +3/−3 trap (box −3 gives 2, −12, 43, −119); −31 is the last sign dropped.
**Line.** "Bring down, multiply, add. The box holds the divisor's zero."
**Trap.** Subtracting in the table because long division subtracts; the wrong sign in the box. The collapse shows the sign already changed; the box number is said as "where x − 3 is zero". Dropping the 0 · x and reading the quotient as 2x² + 7x: the written 0 · x in the long layout.
**Kit.** `longdiv` polynomial mode, synthetic layout, `collapse`, `step` paced like `column`; `dim`.
**Writer.** Capable cheaper model after `cubic-quotient-remainder` has staged the collapse: pacing `longdiv` is pacing `stack`.

### `cubic-quotient-remainder` — Quotient plus the remainder over the divisor.

**Standard.** HSA.APR.D.6 exactly: "write a(x)/b(x) in the form q(x) + r(x)/b(x) ... with the degree of r(x) less than the degree of b(x)". Here r is a number and b is x − a.

**Foundations first.** The shared opening, with its weight on 17/5 = 3 + 2/5: the leftover goes *over* the divisor, never beside it. The form q(x) + R/(x + 3) written in the standard's own shape before any example. Long division once and the collapse (as in `polynomial-quotient`).

**Read.** "Which expression is equivalent": a quadratic plus a fraction with a number on top and the divisor underneath. At a glance: the divisor's zero, −3; the remainder is p(−3); a choice whose remainder has no divisor under it is not a form at all.

**Example.** "Which expression is equivalent to (x³ + 7x² + 10x − 15)/(x + 3)?" Choices: x² + 4x − 2 + 9/(x + 3) | x² + 10x + 40 + 105/(x + 3) | x² + 4x − 2 − 9/(x + 3) | x² + 4x − 2 − 9. (1) x + 3 is zero at −3. (2) Glance: "− 9" alone dims, with "17/5 is not 3 + 2". p(−3) = −27 + 63 − 30 − 15 = −9, so +9 and 105 dim together. One remains; prove it. (3) Long division: x²; subtract: 4x² + 10x; 4x: 4x² + 12x; subtract: −2x − 15; −2: −2x − 6; subtract: −9. (4) Collapse: box −3; 1, 7, 10, −15 → 1, 4, −2, −9 gold. (5) The probe parks at −3: the dot at height −9 and the gold remainder light together: the remainder is the height. (6) The form: p(x) = (x + 3)(x² + 4x − 2) − 9; divide every term by x + 3: x² + 4x − 2 − 9/(x + 3), the remainder's own sign riding with it. Answer.

**Fast.** p(a) for the remainder, the table for the quotient, write q + R/(x − a).
**Sense.** For big x the fraction is tiny, so the expression is about x² + 4x − 2: a quadratic, as a cubic over a linear should leave.
**Check.** x = 0 on both sides: left −15/3 = −5; right −2 − 9/3 = −5. Or multiply back.
**Rule out.** No divisor under the remainder (one); p(a) not equal to the remainder (two); the 105 is exactly the +3 box.
**Line.** "Whole part, plus the leftover over the divisor."
**Trap.** +3 in the box (the 105 decoy); "R" alone, from grade 4's "3 R 2"; the sign of R flipped going into the fraction. The 17/5 sentence, the box said as the divisor's zero every time, and the form built by dividing p = (x + 3)q + R through by x + 3 so the −9 travels with its sign.
**Kit.** `longdiv` with `collapse` and `form`; the parked probe; `dim`. Pilot lesson 3 builds them.
**Writer.** Strongest for the pilot (it builds the component and stages the collapse and the parked probe); afterward this concept is cheaper-model territory.

### `remainder-zero-graph` — The graph that is on the axis at a.

**Standard.** HSA.APR.B.2, "p(a) = 0 if and only if (x − a) is a factor", read on a graph.

**Foundations first.** The shared opening, then its consequence said plainly: remainder 0 means height 0 at a means the graph meets the x-axis at a. So "which graph has remainder 0 on division by x − 4" is "which graph has an x-intercept at 4". No division, no equation: one look at x = 4.

**Read.** The divisor's zero, gold: x − 4 gives 4; x + 3 gives −3. The answer is the graph that touches the axis at that x. At a glance: a graph clearly above or below the axis at a is gone.

**Example.** "For which graph does the polynomial p(x) have a remainder of 0 when divided by x − 4?" Four cubics: A crosses at −2, −1, 0; B passes through (4, 2); C crosses at −4, −1, 1; D crosses at −4, 2, 4. (1) The gold probe x = 4 drawn through all four panels at once. (2) Heights read: A is far off the axis at 4; B's dot sits at height 2, so its remainder is 2, not 0; C is off the axis at 4 (its intercept at −4 is named: x − 4 is zero at positive four); D's dot is on the axis: height 0. A, B, C dim together. (3) D: p(x) = (x − 4) q(x) + 0, so x − 4 is a factor and 4 is a zero.

**Fast.** Find a, look at x = a, take the graph on the axis there.
**Sense.** The chosen graph lists a among its intercepts.
**Check.** On D the readout at x = 4 is y = 0; on B it is 2, the remainder that graph would give.
**Rule out.** Anything off the axis at a, named; the −a decoy by the sign line.
**Line.** "Remainder zero: the graph is on the axis at a."
**Trap.** Looking at x = −4 (C is built for it); taking B because it "goes through a point at 4". The probe at +4 and B's readout of 2.
**Kit.** The app's four-graph figure through `scene` with the probe drawn across every panel and a height readout per panel; `dim`.
**Writer.** The family's hinge, short; strongest for the first version so the probe-and-remainder beat is exact, then any writer.

### `remainder-steps` — Evaluate p(a), step by step.

First: the slots group the terms in a way the prompt never states (the x³ and x² terms summed, then the x and constant terms, then the total), and some variants prefill a slot. The app should label the slots ("x =", "first two terms", "last two terms", "remainder"); until it does, the lesson mirrors the slots exactly and says what each holds.

**Standard.** HSA.APR.B.2 "the remainder on division by x − a is p(a)"; HSF.IF.A.2 "evaluate functions for inputs in their domains".

**Foundations first.** The shared opening, briefly. The substitution habit: every x becomes the same number in blue parentheses; powers first, then products, then add. One line from family 4: an odd power of a negative stays negative, an even power turns positive.

**Read.** "Find the remainder... enter each step": slot 1 the input (the divisor's zero), slot 2 the x³ and x² terms added, slot 3 the x and constant terms added, slot 4 the total. At a glance: the input's sign; whether the total might be 0, a factor.

**Example.** f(x) = 4x³ − 3x² − x + 6 divided by x + 1 (every sign trap in one line, and the remainder is 0, so the factor meaning is seen). (1) x + 1 = 0 at x = −1: slot 1, −1. (2) 4(−1)³ − 3(−1)²: (−1)³ = −1, so −4; (−1)² = 1, so −3; together −7: slot 2. (3) −(−1) + 6 = 1 + 6 = 7: slot 3. (4) −7 + 7 = 0: slot 4. (5) The probe at −1: the dot lands on the axis. Remainder 0, so x + 1 is a factor of f.

**Fast.** The divisor's zero, then evaluate, in the pairs the slots ask.
**Sense.** Small coefficients at −1 give small terms with signs; the total is near 0.
**Check.** The synthetic table with −1 in the box: 4, −7, 6, 0; or the dot on the axis.
**Line.** "Replace every x with the same number in parentheses. What comes out is the remainder."
**Trap.** Plugging in +1 (gives 6); (−1)³ read as +1, or −3(−1)² read as +3; −x at x = −1 read as −1 instead of +1. The blue parentheses on every x and the two facts about powers. These are exactly what the slots exist to catch.
**Kit.** None beyond the probe; board lines with the slot values boxed as the app shows them.
**Writer.** Capable cheaper model: one method, arithmetic, every line checked by `--dry`.

---

## Polynomial zeros (`polynomial-zeros`, Algebra 2)

### `rg-polynomial-zeros-forms` — Zeros of a product; a zero by grouping.

Two genuinely different acts under one name: reading zeros off a product with a nonmonic factor, and finding a zero of an expanded cubic by grouping. Both are worked.

**Standard.** HSA.APR.B.3, "identify zeros of polynomials when suitable factorizations are available".

**Foundations first.** The shared opening. A factor of x alone is zero at 0. A factor ax + b is a steeper blue line: 3x − 1 is zero where 3x = 1, at x = 1/3. Grouping defined with its picture: x³ + x² − 4x − 4 is two pairs, x²(x + 1) and −4(x + 1), the same (x + 1) in each; pull it out.

**Read.** "What are the zeros" of a product: one per factor, all listed. "Which value is a zero" of an expanded cubic: factor first; the choices are a check, not a method. At a glance: a factor of x means 0; a nonmonic factor's zero is a fraction with the a underneath.

**Example A.** "What are the zeros of f(x) = (3x − 1)x(x + 7)?" Choices: −7, 0, 1 | −1/3, 0, 7 | −7, 0, 3 | −7, 0, 1/3. (1) x + 7 is zero at −7: dot, blue line. (2) x is zero at 0: dot. (3) 3x − 1 = 0, 3x = 1, x = 1/3: the steeper line crosses at 1/3; dot, labeled 1/3. (4) The teal cubic drawn through all three. −7, 0, 1/3.

**Example B.** "Which value is a zero of f(x) = x³ + x² − 4x − 4?" Choices −4, −1, 3, 1. (1) Group: (x³ + x²) + (−4x − 4) = x²(x + 1) − 4(x + 1), the shared (x + 1) highlighted. (2) (x + 1)(x² − 4) = (x + 1)(x − 2)(x + 2). (3) Zeros −1, 2, −2 on the line; the graph confirms. (4) Only −1 is offered. −1.

**Fast.** A: each factor to 0; ax + b gives −b/a. B: group, pull the shared binomial, difference of squares.
**Sense.** A: three factors, three zeros, one of them 0. B: a cubic has at most three zeros, and −1 sits between the other two.
**Check.** Plug in: 3 · (1/3) − 1 = 0 kills f(1/3); f(−1) = −1 + 1 + 4 − 4 = 0.
**Rule out.** A: a list of two dims (three factors, three zeros); 7 for x + 7 dims (sign); 1 and 3 for 3x − 1 dim (the 3 forgotten or kept). B: once factored, read; or plug each choice in as the check.
**Line.** "The factor says where it is zero. For 3x − 1, that is one third."
**Trap.** 3x − 1 read as zero at 1, at 3 or at −1/3 (the decoys exactly); in grouping, pulling out −4 and writing (x − 1). The steeper blue line crossing at 1/3; the second pair written as −4(x + 1) and multiplied back aloud.
**Kit.** Factor lines of slope a, not only 1; a fractional zero labeled in TeX on the zero line.
**Writer.** Capable cheaper model: two methods, both on the board, pictures static.

### `polynomial-inequality-solve` — Where is the graph above or below the axis?

First: no linked standard. Link HSA.APR.B.3 (zeros to a rough graph) and HSF.IF.B.4 ("intervals where the function is ... positive, or negative"). The app's method tests a point in every interval; the lesson teaches the walk and uses one test point as the check; the answers agree. The "single point" case in the app's method never appears as an answer, only as a decoy.

**Foundations first.** The shared opening. A solution of f(x) > 0 is every x where the graph is above the axis. Interval notation defined on the picture: a round bracket is a hollow dot (the end not included), a square bracket a filled dot, ∞ always round because it is not a number, ∪ means "or": both stretches. The sign chart: f's sign in each gap, written on the line. The walk: far right the sign is the leading sign; walking left it flips at a zero with an odd exponent and holds at an even one, because (x − 1)² is never negative: the blue parabola touching at 1, and the probe gliding across 1 with two tags flipping and the product holding.

**Read.** The inequality sign gold: > or < means hollow ends and the zeros out; ≤ or ≥ means filled ends and the zeros in. "> 0" wants the + gaps. At a glance: the zeros with exponents, the leading sign, the degree, and whether the solution must reach ∞ on each side.

**Example.** "Solve (x + 4)(x + 1)(x − 1)² > 0." Choices: [−4, −1] ∪ {1} | (−∞, −4] ∪ [−1, ∞) | (−4, −1) | (−∞, −4) ∪ (−1, 1) ∪ (1, ∞). (1) Zeros drop: −4, −1, 1 with (x − 1)² under it. (2) Lead +, degree 1 + 1 + 2 = 4, even: both ends up; the right arrow. (3) Walk: right of 1, +; at 1, even, hold: + between −1 and 1; at −1, odd, flip: − between −4 and −1; at −4, flip: + left of −4. The rough curve stroked: touching at 1 from above, crossing at −1 and −4. (4) > 0: the + gaps shade with hollow ends at −4, −1 and 1 (the touch point is a zero, so it is out of a strict inequality); the callout writes (−∞, −4) ∪ (−1, 1) ∪ (1, ∞) as each stretch fills. Answer.

**Second example, fully worked but brief,** because it is a different case: x³ − 16x ≤ 0 must be factored, is non-strict, and has 0 as a zero. x(x − 4)(x + 4) ≤ 0; zeros −4, 0, 4, all odd; lead +, degree 3: right end up, left end down; walk +, −, +, −; ≤ 0: the − gaps with filled ends: (−∞, −4] ∪ [0, 4]; ∞ round. The true graph slides in over the sketch.

**Fast.** The walk; no test points, one is the check.
**Sense.** A positive even-degree polynomial is positive far out both ways, so "> 0" must reach both infinities; an odd one is negative far left, so "≤ 0" must start at −∞.
**Check.** One test point in one gap: x = 0 in (−1, 1): 4 · 1 · 1 = 4 > 0. Second: x = 2: 2 · (−2) · 6 = −24 ≤ 0.
**Rule out.** Strict inequality: any square bracket or {1} dims (two at once). The right end is + and the question is > 0, so the solution must reach +∞: (−4, −1) dims. Prove the one left by the walk. For ≤: any round bracket at a zero dims.
**Line.** "Odd flips, even doesn't. Hollow for strict, filled for or-equal, round at infinity."
**Trap.** Flipping at the double zero (the (−∞, −4] ∪ [−1, ∞) decoy is this plus closed ends); square brackets on a strict inequality; keeping 1 because "a zero is on the boundary". The hold at the even zero and the hollow dot at 1. A cast fits: the student flips at 1; the teacher glides the probe across 1 and the product tag stays +.
**Kit.** `signline` (drop, end, walk, sketch, shade, notation); the probe; `dim`. Pilot lesson 2 builds `signline`.
**Writer.** Strongest: the walk, the brackets and the callout are staged, and every decoy must be named at the moment the picture answers it.

### `sat-entry-polynomial-zeros` — List the zeros, then the sum or the least.

With a repeated factor every generated prompt already says "distinct"; keep the template that way.

**Standard.** HSA.APR.B.3, "identify zeros of polynomials when suitable factorizations are available".

**Foundations first.** The shared opening. Three kinds of factor that give no new zero, each on the picture: a plain number out front (−2, 3) is a flat blue line that never reaches the axis; it scales the graph and may flip it. A squared factor (x + 5)² is one zero, a touch, listed once. x² + 3 is a blue parabola floating above the axis: x² is never negative, so it is never 0. "Distinct" means different; "least" means leftmost on the line. The entry box: a number, with its minus sign; every zero here is a whole number.

**Read.** The asked thing gold: "sum of the distinct real zeros" or "least zero". At a glance: the number out front is not a zero; a squared factor is one zero; x² + k with k positive gives none.

**Example.** "What is the sum of the distinct real zeros of f(x) = −2(x + 2)²(x − 1)(x − 8)?" (1) −2 is a number, not a factor with an x: no zero; it dims. (2) (x + 2)²: zero at −2, once; a touch. (3) x − 1: 1. (4) x − 8: 8. (5) The line: −2, 1, 8; the graph (both ends down because of the −2, touching at −2) agrees. (6) −2 + 1 + 8 = 7. Entered as 7.

**Quick cases,** one beat each, for the two factors the main example lacks: f(x) = (x − 1)(x² + 3)(x − 8): x² + 3 is the floating parabola, never 0; zeros 1 and 8; sum 9. Least zero of 2(x − 8)(x − 6)(x + 6): zeros 8, 6, −6; leftmost, −6.

**Fast.** One zero per linear factor, sign flipped; skip numbers and x² + k; a repeat once; then add, or take the leftmost.
**Sense.** The zeros are the intercepts of the sketch; the sum sits among the numbers seen.
**Check.** Each zero kills its factor: f(8) has (8 − 8) = 0. Count the dots on the line against the numbers added.
**Line.** "One zero per linear factor, a repeat once, and a number out front is never a zero."
**Trap.** Counting the double zero twice (5 instead of 7); treating −2 as a zero, or giving x² + 3 one; the sign (2 for x + 2). The flat line, the floating parabola, the touch listed once.
**Kit.** Factor plots for a constant (horizontal) and for x² + k (the floating parabola) with their TeX; the entry format as a `text` line.
**Writer.** Capable cheaper model: reading, one method.

### `zeros-from-factors` — Factor to zero, zero to factor, graph to equation.

First: linked to HSF.BF.A.1, a modeling standard "from a context"; nothing here has one. The type serves HSA.APR.B.3 and HSF.IF.C.7c. Three answer shapes under one name, one idea; the graph shape adds the right-end rule.

**Standard.** HSA.APR.B.3 "identify zeros ... when suitable factorizations are available"; HSF.IF.C.7c "graph polynomial functions, identifying zeros when suitable factorizations are available, and showing end behavior".

**Foundations first.** The shared opening, with the reading done live on y = (x + 4)(x − 2)(x − 4): blue lines through −4, 2, 4; zeros −4, 2, 4, each the factor's number with its sign flipped; the teal cubic through all three. The reverse said once: a zero r is made by the factor x − r; the zero 0 by x itself; "and nowhere else" means three zeros, three factors, a cubic. For the graph case, foundation 4 in one line: the right end tells the sign of the number out front: rising, positive; falling, negative.

**Read.** "What are the zeros": one per factor, sign flipped. "Which polynomial has zeros at ... and nowhere else": one factor per zero, sign flipped back. "Which equation could the graph show": intercepts give the factors, the right end gives the sign. At a glance: the signs; any choice with (x + 5) for a zero at 5 is gone.

**Example.** "Which polynomial has zeros at x = −5, x = −3, x = 2 and nowhere else?" Choices: (x + 2)(x − 3)(x − 5) | (x + 3)(x − 2)(x − 5) | (x + 5)(x + 3)(x − 2) | (x + 5)(x + 3)(x + 2). (1) The zeros drop on the line. (2) −5 needs a factor that is zero at −5: x + 5, checked aloud, −5 + 5 = 0; its blue line. (3) −3: x + 3. (4) 2: x − 2. (5) y = (x + 5)(x + 3)(x − 2); the teal graph through the three dots. Answer.

**Quick second case,** because the graph adds one fact: a graph crossing at 0, 2, 5 and rising to the right; choices (x + 5)(x + 2)x | −x(x − 2)(x − 5) | x(x − 2)(x − 5) | x(x − 2)(x − 6). Zeros 0, 2, 5 give factors x, x − 2, x − 5: two choices die on zeros alone. Right end up: positive out front: −x(x − 2)(x − 5) dies. x(x − 2)(x − 5). Check with a point between zeros: at x = 1, 1 · (−1) · (−4) = 4, above the axis, as the graph shows.

**Fast.** Flip the sign between a zero and its factor; for a graph, intercepts then the right end.
**Sense.** As many factors as crossings; put a zero in and its factor dies.
**Check.** Plug a zero in: (−5 + 5) = 0 kills the product. For a graph, a point between zeros or the right end.
**Rule out.** Wrong signs (every decoy of the main example has one); for the graph, wrong intercepts first, then the right end.
**Line.** "The factor says where it is zero: x + 5 is zero at negative five."
**Trap.** Writing (x − 5) for a zero at −5, or reading (x + 5) as a zero at 5 (every decoy is this). The blue line visibly crossing at −5 and the check −5 + 5 = 0 said each time. In the graph case, forgetting the sign of the lead: the right end.
**Kit.** Factor lines; `signline` drop; the app's graph for the graph variant; `dim`.
**Writer.** Capable cheaper model: one idea, three readings, the pictures staged by pilot lesson 1.

### `zero-multiplicity` — Crosses or touches: the exponent decides.

First: linked to HSF.BF.A.1 in error; serves HSA.APR.B.3 and HSF.IF.C.7c. One concept with `repeated-zero-rule` and `polynomial-graph-match`; this is the lesson that builds it.

**Standard.** HSA.APR.B.3 ("use the zeros to construct a rough graph of the function"); HSF.IF.C.7c.

**Foundations first.** The shared opening, then multiplicity built on the probe with y = (x + 2)²x. Factor lines: the blue parabola (x + 2)² touching the axis at −2 and never below it, TeX beside it; the blue line x through 0. The probe glides in from the left: the tag for x reads −; the squared factor is listed twice so two tags read − and − (product +); at −2 both flip together and the product tag still reads −: the teal dot rises to the axis and turns back down. A touch. At 0 the x tag flips and the product flips: the dot crosses. *Multiplicity* is the exponent on the factor. "Odd flips, even doesn't: odd crosses, even touches." Then the right end: pull back, and the teal graph and the violet y = x³ merge far out; the right end rises when the number out front is positive, read from the right end alone whatever the degree.

**Read.** Three shapes. "Which equation could the graph show": square where it touches, plain where it crosses, sign from the right end. "A cubic touches at 2 and crosses at 4": the same in words. "How does y = (x − 3)²(x − 1) meet the axis": read the exponents. At a glance: the touch point's factor is squared with its sign flipped; the exponents add to the degree (a cubic: 2 + 1).

**Example.** "Which equation could the graph show?" The graph: below the axis on the left, touching the axis at −2 from below, below again, crossing upward at 0, rising right. Choices: −(x + 2)²x | (x + 2)²x | (x + 2)x | x²(x + 2). (1) Touch at −2: (x + 2), squared. x²(x + 2) squares the wrong zero (it would touch at 0); (x + 2)x has no square (a parabola, and this graph meets the axis three times counting the touch twice): both dim with that one reason. (2) Right end rises: positive out front: −(x + 2)²x dims. (3) One remains; prove it on the same figure: the probe glides, touch at −2, cross at 0, rises right. (4) y = (x + 2)²x.

**Quick cases,** one beat each: "touches at 2, crosses at 4": (x − 2)²(x − 4), not (x − 4)²(x − 2) (square on the wrong zero) and not (x + 2)²(x + 4) (signs). "How does y = (x − 3)²(x − 1) meet the axis": touches at 3, crosses at 1.

**Fast.** Square where it touches, plain where it crosses, sign from the right end, signs flipped between factor and zero.
**Sense.** 2 + 1 = 3: a cubic, which with a positive lead rises right and falls left, as drawn.
**Check.** A point between zeros: x = −1 gives (1)²(−1) = −1, below the axis, as drawn. Or the y-intercept's sign when it is not 0.
**Rule out.** The square missing or on the wrong zero (count the meetings; a touch is two); the wrong sign on a factor; the wrong right end.
**Line.** "Odd flips, even doesn't: odd crosses, even touches."
**Trap.** (x − 2)² for a touch at −2 (sign); the square on the crossing zero; the sign read from the left end ("falls left, so negative"). The parabola that never dips, the two tags flipping with the product holding, the pull-back with the right-end rule said once.
**Kit.** `probe` with per-factor tags (a factor listable twice) and the squared factor drawn as a parabola; a dashed violet leading-term plot and the `view` pull-back; `dim`. Pilot lesson 1 builds `probe` and `dim`.
**Writer.** Strongest: the picture is born here, and a weak author describes the flip instead of staging it. After approval, `repeated-zero-rule` and `polynomial-graph-match` are this lesson on other graphs and can go down the seam.
