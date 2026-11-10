# Exponential growth and logarithms, part 4: per-type concepts

Ten types across four skills (`logarithms` tail, `logarithm-properties`, `exponential-equations`, `sequence-sums`). Every lesson here stands on foundation 7 (a logarithm counts steps) and shows it on the ladder before anything else; the Algebra 1 films already built the step table, and the first beat of each film turns it on end once. Where a type is misfiled or duplicated, that is said first.

---

### Logarithms (`logarithms`)

**`log-base-fraction-graph` — The graph of a log with base between 0 and 1.** Multiple choice.
*Conceived wrong first:* it asks "which graph" and offers four sentences. HSF.IF.C.7e wants graphs; the app should show four small graphs. Until then the lesson teaches the three features the sentences describe, and the film draws a small sketch beside each sentence as it is read, so the learner sees what each sentence claims.
Standard: HSF.IF.C.7e, "Graph exponential and logarithmic functions, showing intercepts and end behavior." Also HSF.BF.B.5 (the log as the inverse).
Foundations first: the ladder for base 1/4 (rungs −2, −1, 0, 1, 2; amounts 16, 4, 1, 1/4, 1/16): each step multiplies by a quarter, so bigger amounts are *backward* steps. The exponential y = (1/4)^x drawn through its five dots, falling, hugging y = 0 (foundation 6: multiplying positives never gives zero). Then the swap (foundation 7): a log reads the ladder the other way, amount in, step count out, so every dot reflects across the dashed line y = x: (0, 1) becomes (1, 0); (−1, 4) becomes (4, −1); the horizontal asymptote stands up as x = 0. The log curve is plotted through the swapped dots, and three things are named as the swap makes them: it passes through (1, 0) because b^0 = 1 for every base; it stays right of the y-axis because no amount on the ladder is zero or negative; and it falls because a base under 1 makes bigger amounts smaller step counts.
Read: "Which graph represents y = log base one quarter of x?" At a glance: any log passes (1, 0) and lives only for x > 0; the only question left is rise or fall, and the base answers it.
Example: as built above. Choices read one at a time with their sketches: two say "(0, 1)" and "across the whole x-axis": those are exponentials. Of the two logs, base 1/4 < 1: falls. Answer: the falling curve through (1, 0), right of the y-axis.
Fast: (1, 0) and x > 0 are automatic; base above 1 rises, base below 1 falls.
Sense: log_{1/4} 4 = −1 is below log_{1/4} 1 = 0: moving right, the curve went down.
Check: plug x = 1 (gives 0) and x = 4 (gives −1).
Rule out: "(0, 1)" and "across the whole x-axis" dim together: a log never meets the y-axis. Then the riser dims: base under 1.
Line: "Every log goes through (1, 0) and stays right of the y-axis. The base says up or down."
Trap: swapping the roles and choosing the (0, 1) curve; or "logs rise" picked without reading the base. The swap motion fixes the first; the ladder for 1/4 the second.
Kit: `flip` of a list of dots over y = x finishing before `plot` draws; `plot` of `log(x, 0.25)`; dashed vertical asymptote; small graph thumbnails beside sentence choices (new, and exactly what the app should offer as choices).
Writer: strongest; the swap is motion that proves, and the choices are prose that must be made visual.

---

### Logarithm properties (`logarithm-properties`)

The skill links no standard. HSF.BF.B.5 (+) and HSA.SSE.A.2 fit all three types; the (+) means beyond the core, fine for Algebra 2.

**`log-rules-evaluate` — Combine logs, then read the ladder.** Foundation 8.
Standard: HSF.BF.B.5, "use this relationship to solve problems involving logarithms and exponents"; HSA.SSE.A.2, "use the structure of an expression to identify ways to rewrite it."
Foundations first: the base-3 ladder, rungs 0 to 6, amounts 1 to 729. Multiply the amounts, add the steps: 9 × 27 = 243, rung 2 + rung 3 = rung 5, so log_3 9 + log_3 27 = log_3 243. Divide: subtract. A power: 9² = 81 is rung 2 twice, so log_3 (9²) = 2 · log_3 9. Each is an exponent law the learner owns, read backward. And the warning on the ladder: 9 + 27 = 36 lands on no rung; adding amounts does nothing clean.
Read: "What is 2 log_3 15 − log_3 25?" At a glance: 15 and 25 are not powers of 3, so neither log reads off the ladder; the expression must be combined into one log whose inside *is* a power of 3. The answer is a whole number.
Example: (1) The 2 goes inside: 2 log_3 15 = log_3 15² = log_3 225. (2) Difference: log_3 (225 ÷ 25) = log_3 9. (3) 9 is rung 2: the answer is 2. Picture: 225 and 25 placed at their true heights on the ladder (about 4.9 and 2.9 rungs), neither on a rung, and the gap between them bracketed: exactly two rungs. Quick second case, one beat for the unwritten base: log 4 + log 25 = log 100 = 2, two shifts of the place-value chart.
Fast: coefficients in as exponents, combine to one log, write the inside as a power of the base. Look for the pair whose product or quotient is a clean power (225/25).
Sense: log_3 15 is between 2 and 3, doubled between 4 and 6; log_3 25 between 2 and 3; the difference is between 1 and 4.
Check: 15² = 225, 225 ÷ 25 = 9, 3² = 9.
Line: "Multiply the numbers, add the steps."
Trap: 2 log_3 15 written as log_3 30 (doubling inside instead of squaring), and log_3 15 − log_3 25 as log_3 (−10). The ladder: a coefficient repeats the step count; a difference of step counts is a quotient of amounts. Also reaching for a calculator on log_3 15: the lesson shows it is not on a rung and combines first.
Kit: ladder `place` for off-rung amounts with a rung-count bracket between two placed dots; the math check must know `\log` with a base.
Writer: cheaper; one method, one picture, the arithmetic checkable.

**`log-expand` — Expand a log, or condense to one.** Multiple choice.
Standard: HSA.SSE.A.2 (rewrite by structure); HSF.BF.B.5 as the source of the rules.
Foundations first: the three rules on the base-2 ladder with numbers (log_2 (4 · 8) = 2 + 3; log_2 (32/4) = 5 − 2; log_2 (8²) = 2 · 3), then the root as a half step (family 4: √M = M^(1/2), so log_2 √M = ½ log_2 M). Define "expand" (one log into several) and "condense" (several into one). Letters stand for positive numbers, which the problem says and the lesson repeats once: only positives have a step count.
Read: "Which expression is equivalent to log_2 √(xy⁷)?" At a glance: the root makes a ½ on *everything* inside; the product makes a plus; the answer has two log terms joined by +, never by · or ÷.
Example: (1) √(xy⁷) = (xy⁷)^(1/2). (2) The ½ comes out front: ½ log_2 (xy⁷). (3) Product: ½(log_2 x + log_2 y⁷). (4) The 7 comes out: ½(log_2 x + 7 log_2 y) = ½ log_2 x + 7/2 log_2 y. (5) Check with numbers that are powers of 2: x = 4, y = 4: inside √(4 · 4⁷) = √(4⁸) = 4⁴ = 256, log_2 256 = 8; the answer gives ½ · 2 + 7/2 · 2 = 1 + 7 = 8; the decoy ½ log_2 x + 7 log_2 y gives 1 + 14 = 15.
Second example (the other direction, which the learner will meet): condense 2 log_2 x − 4 log_2 y + log_2 z. Coefficients in first: log_2 x² − log_2 y⁴ + log_2 z; then plus multiplies, minus divides: log_2 (x²z / y⁴). The variant log_2 (x³y/z⁴) is example 1 without the root (top factors +, bottom −) and is covered by the method.
Fast: roots to fractional exponents; every factor on top gets +, every factor under gets −; every exponent comes to the front and multiplies any coefficient already there. Condense in reverse order.
Sense: substitute powers of the base for the letters and compare both sides.
Check: the substitution above; every term of the chosen form must agree.
Rule out: a form with · between logs (the product rule turned into a product of logs), or a quotient of logs (that is change of base, a different thing), or a coefficient multiplying the inside (log_2 (3x), 2xz/4y): dim together, "coefficients are exponents, never multipliers." Then the half applied to x only.
Line: "Top factors add, bottom factors subtract, exponents come out front."
Trap: the ½ distributed to x but not to y (7 instead of 7/2), and the plus written as a dot. Both are decoys and both fail the x = 4, y = 4 check in one beat.
Kit: `dim`; the math check must accept lines in letters (or skip them) and check the numeric substitution line.
Writer: cheaper.

**`change-of-base` — One ladder measured in another's rungs.** Foundation 8.
Standard: HSF.BF.B.5, "understand the inverse relationship between exponents and logarithms and use this relationship to solve problems."
Foundations first: two ladders on one amount column (1, 2, 4, 8, 16, 32, 64): the base-2 rungs count 0 to 6; the base-8 rungs sit only at 1, 8, 64 and count 0, 1, 2, landing on every third base-2 rung. So any base-8 count is the base-2 count divided by 3: log_8 N = log_2 N / log_2 8. The old base goes on the bottom because log_2 8 is "rungs per coarse rung." Said once: any convenient base works for the top and bottom; on a calculator, base 10 or ln.
Read: "What is log_8 32?" At a glance: 32 is between 8 and 64, so the answer is between 1 and 2, and both numbers are powers of 2.
Example: 32 is five base-2 rungs up (32 = 2⁵); 8 is three (8 = 2³); log_8 32 = 5/3. The dot for 32 sits two thirds of the way from the base-8 rung 1 to rung 2. Check: 8^(5/3) = (8^(1/3))⁵ = 2⁵ = 32.
Second example (a different shape the learner will meet): log_3 7 · log_7 81. Neither is clean, but change log_7 81 to base 3: log_3 81 / log_3 7, and the log_3 7 cancels: log_3 81 = 4. Said as units: steps of 3 per step of 7, times steps of 7 to 81, gives steps of 3 to 81. Quick beats: log 49 / log 7 is the formula read backward, log_7 49 = 2; given log_2 x = 20, log_4 x = 20 / log_2 4 = 10 (base-4 rungs are every second base-2 rung). log_9 (1/3) = log_3 (1/3) / log_3 9 = −1/2 is the first example with a step backward.
Fast: find the prime base both numbers are powers of; count its steps to N and to the old base; divide. For a product or quotient of logs: put every log over one base and cancel.
Sense: a coarser base gives a smaller count: log_8 32 must be less than log_2 32 = 5 and more than 1.
Check: raise the old base to the answer.
Line: "Old base on the bottom: rungs per coarse rung."
Trap: upside down (log 8 / log 32, which is less than 1 while 32 > 8); and log 49 / log 7 "cancelled" to log 7. The two ladders make the direction visible, and the bounds (between 1 and 2) kill the inverted answer at a glance.
Kit: the `steps` ladder with a second step column (two bases on one amount column), the `place` dot between rungs.
Writer: cheaper.

---

### Exponential equations (`exponential-equations`)

**`same-base-equation` — Same base, same count.** Foundation 9.
*Said first:* `common-base-exponential` is the same method with both sides rewritten; merge them, or make its example this lesson's second. Neither type has a standard, and the skill's HSF.LE.A.4 asks for a logarithm these never use; the honest links are HSA.REI.A.1 (justify each step) and HSN.RN.A.2 (rewrite with exponent properties).
Standard: HSA.REI.A.1 and HSN.RN.A.2 as above.
Foundations first: the base-2 ladder extended below 1 (rungs −3, −2, −1 hold 1/8, 1/4, 1/2: steps backward). Every amount sits on exactly one rung, so if 2^m = 2^n then m = n (b positive, not 1). Recalled from family 4 in one line each: a negative exponent is a reciprocal, a half exponent is a root, (b^m)^k = b^(mk).
Read: "Solve 2^(2x−2) = 1/8." At a glance: the right side is less than 1, so the exponent is negative and x < 1; the left is already a power of 2.
Example: (1) 1/8 is three steps back: 2^(−3); the ladder's rung −3 goes gold. (2) Same base: 2x − 2 = −3. (3) 2x = −1; x = −1/2. (4) Check: 2(−1/2) − 2 = −3; 2^(−3) = 1/8.
Quick second case (a root, three beats): 9^x = 3: on the base-3 ladder 9 is rung 2 and 3 is rung 1; x steps of 9 is 2x rungs of 3: 2x = 1, x = 1/2. The variant 9^(x+1) = 81^x, both sides rewritten (3^(2x+2) = 3^(4x), x = 1), is the whole of `common-base-exponential` below.
Fast: write both sides over the smallest prime base; set the exponents equal; solve.
Sense: direction: a right side under 1 needs a negative exponent; over 1, positive; equal to 1, zero.
Check: substitute and reach the same rung.
Line: "Same base: match the exponents."
Trap: 1/8 written as 2³ with the sign lost, and 9^x = 3 answered x = 3. The ladder below 1 makes the backward step visible; the rung count for 3 on the base-9 ladder is half a rung.
Kit: ladder with negative rungs; nothing else.
Writer: cheaper.

**`common-base-exponential` — Both sides rewritten over one base.** Multiple choice.
*Said first:* duplicate of `same-base-equation` (see there); no standard; HSA.REI.A.1 and HSN.RN.A.2.
Foundations first: on the base-2 ladder, 8 is three rungs per step and 16 is four, so x − 2 steps of 8 is 3(x − 2) rungs of 2. The parentheses are the lesson: the whole exponent is multiplied.
Read: "Solve 8^(x−2) = 16^(x−4)." At a glance: both are powers of 2; the answer is where 3(x − 2) and 4(x − 4) agree.
Example: (1) 8 = 2³, 16 = 2⁴. (2) 2^(3(x−2)) = 2^(4(x−4)), the parentheses written and then distributed: 3x − 6 = 4x − 16. (3) x = 10. (4) Check: 8⁸ = 2²⁴ and 16⁶ = 2²⁴: the same rung.
Quick case (three beats): 4^(2x−2) = 8^(2x−2), equal exponents on different bases, so each side must be 1: 2(2x − 2) = 3(2x − 2) only at 2x − 2 = 0, x = 1.
Fast: smallest prime base; multiply the whole exponent; match; solve.
Sense: the bigger base needs the smaller exponent: at the answer, x − 4 < x − 2, and 16^6 = 8^8 fits.
Check: both sides as one power of 2 at the answer.
Rule out: the decoys are arithmetic slips (a sign, an off-by-one), so the check is the rule-out: a choice that does not put both sides on one rung is gone.
Line: "Same base: match the exponents. Multiply the whole exponent."
Trap: distributing to the first term only (3x − 2 for 3(x − 2)). The parentheses stay on screen until the distribution is written.
Kit: `dim`.
Writer: cheaper.

**`exponential-log-solution` — Name the exponent with a log.** Multiple choice. Foundation 7.
Standard: HSF.LE.A.4, "express as a logarithm the solution to ab^(ct) = d where a, c, and d are numbers and the base b is 2, 10, or e." The 1.08 variant is beyond the clause's bases but the same method; fine as a stretch.
Foundations first: log_b N = x and b^x = N say one thing; the base of the log is the base of the power; "log" alone is base 10, "ln" is base e (e recalled in one line as about 2.718, defined in `compound-growth`). Then the order of undoing (family 11): what multiplies the power is undone first, by dividing; then the exponent is named; then whatever is inside the exponent is undone.
Read: "Which is the exact solution of 4 · 10^x = 76?" At a glance: the power is wrapped in ×4; after unwrapping, 10^x = 19, and 19 sits between 10 and 100, so 1 < x < 2.
Example: (1) Divide both sides by 4: 10^x = 19. (2) Name the exponent: x = log 19. Picture: the base-10 ladder; 19 placed between rung 1 and rung 2; the gold read-back arrow. (3) Check: 4 · 10^(log 19) = 4 · 19 = 76, since raising the base to the step count returns the amount.
Second example (something inside the exponent): 2^(x+4) = 10. Name first: x + 4 = log_2 10; then undo the +4: x = log_2 10 − 4. Quick beats: e^(5t) = 10: 5t = ln 10, t = ln 10 / 5; B · 1.08^t = 2B: divide by B, 1.08^t = 2, t = log_(1.08) 2.
Fast: isolate the power; x (or the whole exponent) = log_b (the other side); finish solving.
Sense: bound the answer between two whole steps: 10 < 19 < 100; 8 < 10 < 16 so x + 4 is between 3 and 4 and x between −1 and 0; doubling at 8% takes about nine years.
Check: substitute; b^(log_b N) = N.
Rule out: a form that divides the log by the outside multiplier (log 76 / 4): the 4 multiplies the amount, so it divides the amount, not the step count; a form that subtracts a multiplier (log 72) or subtracts inside the log (log_2 (10 − 4)); a swap of base and amount (log_19 10, below 1 when x must be above 1): dim together, each with its reason.
Line: "The base of the log is the base of the power."
Trap: dividing the log by 4, and subtracting the 4 inside the log. The order of undoing on the board, and the bounds from the ladder.
Kit: ladder `place`; `dim`; math check knows `\log`, `\ln`.
Writer: cheaper.

**`exponential-parameter-log` — The same undoing, with letters.** Multiple choice.
Standard: HSF.LE.A.4 (base 10, a and c as parameters).
Foundations first: letters stand for fixed positive numbers and behave exactly like 4 and 76. Two places a constant can sit: outside, multiplying the power (undone first, by dividing, so it ends up inside the log as a divisor); inside, multiplying x in the exponent (undone last, by dividing the log). The lesson writes a muted numeric shadow beside each lettered line (4 · 10^x = 76 → 10^x = 19 → x = log 19) so the letters are seen to do what numbers did.
Read: "For positive constants a and b, solve a · 10^x = b. Which expression gives x?" At a glance: a is outside, so it will be inside the log, under b.
Example: (1) Divide both sides by a: 10^x = b/a. (2) Take log of both sides, the exponent comes down: x = log (b/a). (3) Check with numbers: a = 4, b = 76 gives x = log 19 ≈ 1.279 and 4 · 10^1.279 ≈ 76; the decoy log b / a gives 0.47 and 4 · 10^0.47 ≈ 12.
Second example (the constant inside, brief): 10^(px) = q: px = log q; x = log q / p. Numeric shadow 10^(9x) = 63, x = log 63 / 9.
Fast: outside multiplier: inside the log as a divisor. Inside multiplier: divides the log.
Sense: with a = 4, b = 76 the answer must be between 1 and 2; with 10^(9x) = 63, 9x is between 1 and 2, so x is small, about 0.2.
Check: substitute numbers for the letters and recompute both sides.
Rule out: log b − a and log (b − a) subtract a multiplier: a multiplies, so it divides; log b / a divides the step count by a number that multiplied the amount. Dim together. For 10^(px) = q, the mirror image: log (q/p) is gone because p multiplies the exponent.
Line: "Outside goes inside the log. Inside divides the log."
Trap: log (b/a) and log b / a confused. The two shapes side by side, each with its numeric shadow, and the check with numbers.
Kit: a muted shadow line (or `text`) under a lettered `write`; `dim`.
Writer: cheaper.

**`log-equation` — Solve, then check every inside.** Foundations 8 and 10.
Standard: HSF.BF.B.5, "use this relationship to solve problems involving logarithms and exponents."
Foundations first: define the inside (argument). Two logs of one base added are one log of the product (the ladder: rung heights add when amounts multiply); subtracted, of the quotient. log_b A = n means A = b^n. And no amount on the ladder is zero or negative: a solution that makes any inside zero or negative is not a solution. The check is part of the method, not an afterthought.
Read: "Solve log_6 x + log_6 (x + 19) = 3." At a glance: two logs, same base, added, so the insides multiply to 6³ = 216; both insides must come out positive.
Example: (1) log_6 (x(x + 19)) = 3. (2) x(x + 19) = 216. (3) x² + 19x − 216 = 0; (x + 27)(x − 8) = 0; two columns: x = −27, x = 8. (4) Check every inside: x = −27 makes log_6 (−27): the read-back arrow has no amount to start from; the column goes rust with "log_6 (−27) does not exist." x = 8: insides 8 and 27, both positive. (5) x = 8. Picture: the base-6 ladder with 216 on rung 3; 8 and 27 placed at their true heights (about 1.16 and 1.84 rungs), their heights adding to 3.
Second example (subtraction, brief, because the misconception is real): log_5 x − log_5 (x − 24) = 1: log_5 (x/(x − 24)) = 1; x/(x − 24) = 5; x = 5x − 120; x = 30; insides 30 and 6, positive. The one-log variants (log_5 (x − 7) = 2, so x − 7 = 25, x = 32) are step 2 alone and are covered.
Fast: one log on each side or one log equal to a number; rewrite as a power; solve; check every inside is positive.
Sense: the insides multiply to 216, so x is a bit under its square root and positive; a negative x has no step count at all.
Check: substitute into every original log: log_6 8 + log_6 27 = log_6 216 = 3.
Line: "Check every inside is positive."
Trap: keeping x = −27 (the quadratic gave two roots, so both feel earned); cancelling the logs in the subtraction to x − (x − 24) = 1, which has no solution and shows it is nonsense; adding insides (log_6 (2x + 19)). The rust column with its reason, and the ladder on which adding amounts does nothing.
Kit: `cases` (two columns, one rejected in rust with its reason); the math check for quadratics and `\log`.
Writer: strongest; the rejected root is reasoning that a weak writer turns into a rule.

---

### Sequence sums (`sequence-sums`)

**`geometric-series-sum` — Shift one step and subtract.** Foundations 1, 2, 11.
Standard: HSA.SSE.B.4, "Derive the formula for the sum of a finite geometric series (when the common ratio is not 1), and use the formula to solve problems." The app never asks for the derivation; this lesson does it, because the formula is unmemorable without it and the derivation is the fast method for small r.
Foundations first: a sequence is the list; a series is the list added; S_n is the sum of the first n terms. The staircase for the jar (4, 12, 36, 108, 324, 972) drawn to scale with ×3 arcs, the view pulling back as the bars grow; then the bars slide into one tower, and the tower's height is the sum. Said plainly: the exponent counts the arrows (five arrows to day 6), but the number of terms is the number of bars (six).
Read: "On day 1, 4 coins go in; each day after, 3 times as many as the day before. How many coins are in the jar after day 6?" At a glance: "in the jar" (gold) is the total, not day 6's 972; the answer is more than 972 and, with r = 3, less than 1.5 × 972 = 1458.
Example: (1) S = 4 + 12 + 36 + 108 + 324 + 972. (2) 3S = 12 + 36 + 108 + 324 + 972 + 2916: the same list moved one column right, each term under the term it equals. (3) Subtract: every middle pair cancels; 3S − S = 2916 − 4; 2S = 2912; S = 1456. The towers do it beside the board: the 3S tower's slabs level with the S tower's, the matched slabs fade, the two ends remain. (4) The formula as what just happened: S_n = a(r^n − 1)/(r − 1) = 4(3⁶ − 1)/2 = 4 · 728 / 2 = 1456. (5) Check by adding: 4, 16, 52, 160, 484, 1456.
Second example (the term count hidden): 3 + 6 + 12 + ... + 192. 192 = 3 · 2⁶ is six arrows from 3, so seven terms; S = 3(2⁷ − 1)/(2 − 1) = 381; or the shift directly: 2S − S = 384 − 3 = 381. Quick beats: Σ from k = 1 to 6 of 5 · 3^(k−1): the counter runs 1 to 6, six terms, a = 5, r = 3, S = 5(729 − 1)/2 = 1820. First term 192, ratio 1/2, seven terms: the same seven numbers backward, 381; the formula's two signs both flip, 192(1 − (1/2)⁷)/(1 − 1/2).
Fast: find a, r, and n (count bars, or top − bottom + 1 under a sigma, or the arrows to the last term plus one); S_n = a(r^n − 1)/(r − 1). For r = 2: twice the last term minus the first.
Sense: the sum is more than the largest term and, for r ≥ 2, less than twice it (for r = 3, less than 1.5 times it).
Check: add the terms when there are few; otherwise recount the terms and compare to the bound.
Line: "Shift one step and subtract: only the ends survive."
Trap: answering the sixth term for the total; six terms for "to 192" because 2⁶; the r < 1 formula with one sign flipped. The tower against the single slab, the bars counted aloud on screen, and the shift-and-subtract that gives 381 without any formula.
Kit: `steps` with `fit` pull-back, `tower`, `shift`, `cancel`; `series` rows on the board with middle pairs fading; the math check knows `\sum`.
Writer: strongest; the derivation is a staged motion in two places at once, and the count of terms is reading.