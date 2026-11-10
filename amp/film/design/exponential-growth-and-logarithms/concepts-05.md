# Sequence sums: per-type concepts (part 5)

Three types under `sequence-sums` (Algebra 2). All three stand on foundation 11 (shift one step and subtract: only the ends survive), which the derivation lesson `geometric-series-sum` owns; these lessons name it in one line and show the tower, never re-derive it. The scratch-paper sketch is the step table with ×r arcs and, for a sum, the bars slid into one tower.

Two things to say first about the skill as filed:

- **`sigma-notation-represent` does not practice HSA.SSE.B.4.** No sum is ever derived or computed; the type asks the learner to label a list. Half its variants are arithmetic (family 13, `arithmetic-sequences`). It serves HSF.BF.A.2 ("write arithmetic and geometric sequences ... with an explicit formula"). Keep it here because the sum lessons need the learner to read a sigma; say in the template that both kinds appear.
- **`infinite-geometric-sum` is not in the Common Core** (HSA.SSE.B.4 stops at finite sums). A fair Algebra 2 stretch; the template should say so. Its no-sum variant (1 − 1 + 1 − 1 +...) is a trick question worth retaining as a quick check of convergence.

---

### `sigma-notation-represent` — Choose the sigma notation for a series. Multiple choice.

**Standard.** HSF.BF.A.2: "Write arithmetic and geometric sequences ... with an explicit formula." Filed under HSA.SSE.B.4, which it never practices (see above). The app's method says "write the rule for an index starting at 1", but two of six answers start at k = 0 (−3 · 3^k from 0 to 7; 2 · (−3)^k from 0 to 6). The method and the answers disagree; the lesson must teach checks that work for any start, not a fixed start.

**Foundations first.** A *sequence* is the list; a *series* is the list added up. Define sigma notation on the board, piece by piece, each named as it goes gold: the Σ says "add up"; the letter under it is the *counter* (index) and the number beside it is where the counter starts; the number on top is where it stops; the expression is the rule for one term. Then expand one live: Σ from k = 1 to 4 of 2^k. The step table has a k row (1, 2, 3, 4) and a term row that fills as k ticks: 2, 4, 8, 16; the board writes 2 + 4 + 8 + 16 under the sigma. Two facts read off the table: the number of terms is the number of k values, **top − bottom + 1** (1 to 4 is four; 0 to 4 would be five, because zero counts); and in a geometric rule the **exponent counts arrows from the first term**, so with k starting at 1 the first term has k − 1 = 0 arrows. One sentence: the index counts cells; the exponent counts arrows. Then the question is the reverse: the terms are given, the label is asked.

**Read.** "Which sigma notation represents the series ..., which has 8 terms?" Three facts, gold as they are read: the first term; the kind (divide neighbors: same quotient, geometric, factor r; subtract neighbors: same difference, arithmetic, step d); the term count. At a glance: the bottom index plugged into the rule must give the first term, and top − bottom + 1 must be the stated count. Those two facts decide every variant.

**The example.** 5 − 15 + 45 − 135 + ... − 10935, 8 terms. Choices: Σ₁⁸ 5·(−3)^(k−1) | Σ₁⁸ (−15)^(k−1) | Σ₁⁸ 5·(−3)^k | Σ₁⁷ 5·(−3)^(k−1).
(1) Step table: n row 1 to 8, amounts 5, −15, 45, −135, ... with bars flipping across the baseline. Divide across one arc: −15 ÷ 5 = −3; 45 ÷ (−15) = −3; ×(−3) on every arc. Start 5, factor −3, 8 terms.
(2) Count: 7 − 1 + 1 = 7 terms. The fourth choice dims: "seven terms, not eight."
(3) Start check, k = 1 in each remaining rule, on the board: (−15)⁰ = 1, not 5: dims ("the base is the factor, −3, not the second term"). 5·(−3)¹ = −15: dims ("that is one arrow too many: term 1 is zero arrows from itself"). 5·(−3)⁰ = 5: stays.
(4) Prove the survivor at the far end: k = 8, (−3)⁷ = −2187, times 5 is −10935, the last term; the table shows seven arrows from cell 1 to cell 8. Answer boxed.

*Quick second case (a counter starting at zero).* −3 − 9 − 27 − ... − 6561, 8 terms; the right choice is Σ₀⁷ −3·3^k. Count 7 − 0 + 1 = 8. k = 0 gives −3·1 = −3, the first term: when the counter starts at 0, the exponent is k, because k already counts arrows. k = 7: −3·2187 = −6561. The decoy Σ₁⁸ −3·3^k fails the start (−9). Line said here: "Where the counter starts is the writer's choice; what the bottom gives, and how many, is not."

*Quick third case (arithmetic).* 4 + 0 − 4 + ... − 12, 5 terms. Subtract across: −4 each; arcs read +(−4). Rule 4 − 4(k − 1) = 8 − 4k. Same two checks: Σ₀⁵ has six terms; Σ₁⁵(−4k + 4) gives 0 at k = 1; Σ₁⁴ has four; Σ₁⁵(−4k + 8) gives 4 at k = 1 and −12 at k = 5. One line points home: adding the same each arrow is family 13's arithmetic sequence; multiplying is ours.

**Fast.** Count: top − bottom + 1. Start: plug in the bottom. Last: plug in the top. Three plugs, no formula building, and it works for every choice set.
**Sense.** A geometric rule's base is the factor you got by dividing, never a term; an alternating series has a negative base.
**Check.** The top index gives the last term printed in the problem.
**Rule out.** Wrong count dims first (one beat); then every rule whose bottom index does not give the first term dims together; the survivor is proved at the top.
**Line.** "Plug in the bottom: it must give the first term. Top minus bottom plus one is the count."
**Trap.** Writing (−3)^k with k from 1 (off by one, the family's misconception 1), and taking the second term as the base ((−15)^(k−1)). The start check on the step table makes both visible in one plug: the rule's k = 1 cell sits under the series' first bar, and the numbers must match.
**Kit.** `steps` with the k row filled live from a rule (`{"do":"expand","target":"s","rule":"2^k","from":1,"to":4}` ticking k and writing the terms); sigma in wrapped choice pills (confirm the TeX sets small enough); `dim`. Nothing else.
**Writer.** A capable cheaper model, from this concept: the judgment the family design worried about is now three plugs on one `steps` table, and `--dry`'s math check catches the arithmetic.

---

### `infinite-geometric-sum` — The sum of an infinite geometric series, or no sum. Multiple choice.

**Standard.** None in the Common Core; the skill's HSA.SSE.B.4 covers finite sums only. An Algebra 2 stretch worth keeping; the template should say so.

**Foundations first.** Define *partial sum*: the running total after n terms. Define "the sum of an infinite series": the number the partial sums settle on, if they settle. Build it on 4 + 2 + 1 + 1/2 + ..., which is a real variant: the staircase of bars (4, 2, 1, 1/2, ... to scale, each the ghost of the last cut in half) slides slab by slab into a tower; a dashed line is drawn at 8, and each new slab fills exactly half of the gap left to the line: gap 4, then 2, then 1, then 1/2. The tower never reaches 8 and never passes it; 8 is the sum. Then the one-line callback to `geometric-series-sum`: write S = 4 + 2 + 1 + ..., under it rS = 2 + 1 + 1/2 + ... one column over (the `series` rows), subtract, every middle term cancels, and the far end is gone because the terms shrink to nothing: S − rS = 4, so S = 4/(1 − 1/2) = 8, the line the tower was rising to. Then say the condition as what the picture needs: the cancelling works only because the far end vanishes; if |r| ≥ 1 the slabs never shrink and the tower never settles. S = a/(1 − r), only when |r| < 1.

**Read.** "Find the sum of the infinite geometric series ..." (or a sigma to ∞, or the bouncing ball). Three facts: a, the first term (for a sigma, the bottom index plugged in: Σ₀^∞ 16(1/4)^k starts at 16, not 4); r, by dividing neighbors; and the size of r against 1. At a glance: |r| ≥ 1 means "no finite sum" and the work is over; |r| < 1 and the sum is more than a and (for positive r) less than 2a when r ≤ 1/2.

**The example.** 9 − 6 + 4 + ... Choices: 27 | −18/5 | no finite sum | 27/5.
(1) Step table: 9, −6, 4, −8/3, ...; divide across: −6 ÷ 9 = −2/3; 4 ÷ (−6) = −2/3. a = 9, r = −2/3. Bars flip across the baseline and shrink by two thirds each step.
(2) |r| = 2/3 < 1: the slabs shrink, so there is a sum. "No finite sum" dims.
(3) The tower with signs: a 9 slab rises; a 6 slab in rust comes off the top (partial sum 3); 4 goes on (7); 8/3 off (4 1/3); 16/9 on (6 1/9) ... the top overshoots and undershoots a dashed line, closing in on it from both sides. The sum sits between 3 and 9, then between 3 and 7, then between 4 1/3 and 7.
(4) Board: S = 9 / (1 − (−2/3)) = 9 / (5/3) = 27/5 = 5.4. The dashed line is labeled 27/5; the tower's top is closing on it.
(5) Rule out and prove: 27 is 9/(1 − 2/3), the sign of r dropped, and it is bigger than the first term plus everything, impossible for a series that comes down after 9; −18/5 is −6/(1 + 2/3), the second term used as a, and negative when the partial sums are all positive. Both dim in one beat. Then the exact check: S − rS should be a: 27/5 + (2/3)(27/5) = 27/5 + 18/5 = 45/5 = 9. Answer boxed.

**Second example (a different case: a story that holds two series).** A ball dropped from 4 m, bouncing back to 3/4 of each fall; total distance, every fall and every rise. Choices: 12 | 32 | 16 | 28. Picture: the ball's path drawn to scale as a zigzag left to right: down 4 (teal), up 3 (gold), down 3, up 2 1/4, down 2 1/4, ... the segments shrinking toward the floor. Read: the falls are 4, 3, 9/4, ...: a = 4, r = 3/4, total 4/(1 − 3/4) = 16. The rises are 3, 9/4, ...: a = 3, r = 3/4, total 3/(1/4) = 12. Every fall after the first has a rise of the same height before it, so the total is 16 + 12 = 28, or 4 + 2·12. Rule out, each named: 16 counts only the falls; 12 only the rises; 32 doubles the first drop, which the ball fell once and never rose. Sense: the ball falls 4 and then bounces for a long time without going far: 28 is seven times the first drop; 32 would mean the first drop happened twice. Check: 16 + 12 = 28, and 4 + 2 · 12 = 28, two ways.

*Quick beat (the trick question).* 1 − 1 + 1 − 1 + ...: r = −1, |r| = 1. The tower goes 1, 0, 1, 0 and never settles on anything; the formula would print 1/2, and that is exactly the decoy, but the formula is not allowed here. "No finite sum." The learner sees the condition bite.

**Fast.** a = first term (bottom index plugged in for a sigma); r = second ÷ first; |r| ≥ 1: no finite sum, stop; else a/(1 − r). For the ball: first drop + 2 × (first rise)/(1 − r).
**Sense.** The sum lies between the first two partial sums when r is negative, and between a and 2a when 0 < r ≤ 1/2; a positive series has a positive sum; the ball's total is more than its first drop.
**Check.** S − rS = a, exactly; or the first four partial sums closing on the answer; for the ball, the two series added agree with 4 + 2 · 12.
**Rule out.** |r| ≥ 1: everything but "no finite sum" dims; |r| < 1: "no finite sum" dims. A choice outside the first two partial sums dims; a negative sum for positive partial sums dims. For the ball, the falls-only and rises-only totals and the doubled first drop dim together, each named.
**Line.** "Shrinking terms add up to a number; terms that don't shrink don't." And for the ball: "Every bounce goes up and comes down; the first drop only comes down."
**Trap.** Using a/(1 − r) when |r| ≥ 1 (the Grandi 1/2 is the realistic decoy), dropping the sign of r (27 for 27/5), and counting the first drop twice in the bounce (misconceptions 14 and 15). The tower that flickers and never settles kills the first; the tower that comes down after 9 kills the second; the zigzag path with one unmatched first fall kills the third.
**Kit.** `steps` `tower` must take negative terms: a rust slab taken off the top lowers the partial sum; a dashed limit line labeled with the sum (`{"do":"limit","target":"s.tower","value":5.4}`); the `fit` pull-in as slabs shrink. A to-scale zigzag path for the ball built from `seg`s (nothing new, but a `bounce` convenience with `h`, `r` and the segments named `fall.k`, `rise.k` would save every writer hand-placing eight points). The board math check must accept Σ to ∞ and fraction answers in `\dfrac`.
**Writer.** Strongest: the gap filling, the overshooting tower and the two-series reading of the bounce are staged motion and story reading, not a formula with numbers.

---

### `geometric-series-total` — The sum of the first n terms: a fractional ratio, or payments growing by a percent. Multiple choice.

**Standard.** HSA.SSE.B.4: "use the formula to solve problems. For example, calculate mortgage payments." The payment variants are the closest thing in the catalog to the standard's example (a growing annuity; no mortgage exists, noted in the family design). The derivation belongs to `geometric-series-sum`; this lesson uses it.

**Foundations first.** Define S_n: the sum of the first n terms, n counting terms (cells, not arrows: the first 8 payments is n = 8). The formula named as the thing the learner saw: shift one step and subtract, only the ends survive, so S_n = a₁(1 − rⁿ)/(1 − r), the form the app prints; one beat shows it equals a(rⁿ − 1)/(r − 1) (top and bottom both negated). Show it once on the staircase: bars 6, 4, 8/3, 16/9 slide into a tower; the tower's height is S₄, and the formula gives that height without stacking. A percent is a factor (family 10, one line): each payment 8% larger is ×1.08; the percent bar extends past 100 by a gold 8. Then say when to use which: four terms, just add them; eight payments with decimals, the formula.

**Read.** Three facts, gold as read: a₁ (the first term, or the first payment); r (given, or 1 + p/100); n (the stated count of terms or payments). The question: the total, exact or to the nearest dollar. At a glance: the total is more than n × a₁ (every term is at least the first when r > 1) and less than n × the last term; a choice the size of one payment is not a total.

**The example.** A fund receives yearly payments; the first is 1,800 dollars and each is 8% larger than the one before. To the nearest dollar, the total of the first 8 payments. Choices: 19,146 | 3,085 | 16,061 | 22,478.
(1) Step table, year 1 to 8, payments 1800, 1944, 2099.52, ... each bar 1.08 times the last with the gold 8% added on top. a₁ = 1800, r = 1.08, n = 8.
(2) At a glance: more than 8 × 1800 = 14,400. 3,085 dims at once: that is the size of one payment (it is the eighth: 1800 · 1.08⁷), not eight of them.
(3) Board: S₈ = 1800(1 − 1.08⁸)/(1 − 1.08). Say and write 1.08⁸ ≈ 1.8509 (a `\approx` line); 1 − 1.8509 = −0.8509; 1 − 1.08 = −0.08; the two negatives cancel: 1800 × 0.8509/0.08 = 1800 × 10.6366 ≈ 19,146. Round once, at the end.
(4) Sense: between 14,400 and 8 × 3,085 = 24,680; near 8 × the middle payment (about 2,400): about 19,000.
(5) Check, on the table: a third row, the running total, filling as the slabs stack into the tower: 1,800; 3,744; 5,844; 8,111; 10,560; 13,205; 16,061; 19,146. The seventh running total is 16,061: the decoy for stopping at seven payments. One more step would give 22,478, nine payments. Both dim with their reason. Answer boxed.

**Second example (a different case: exact fractions).** a₁ = 6, r = 2/3, S₄. Choices: 38/3 | 130/27 | 18 | 130/9. Brief but complete, because dividing by (1 − r) when it is a fraction is the slip. Board: S₄ = 6(1 − (2/3)⁴)/(1 − 2/3) = 6 · (65/81)/(1/3) = 6 · (65/81) · 3 = 130/9. The tower of four bars (6, 4, 8/3, 16/9) stands under the dashed line at 18, the infinite sum, well short of it. Rule out: 18 is the whole infinite series, more than four terms can reach; 38/3 is three terms (the running total after 8/3); 130/27 is 130/9 divided by 3 instead of multiplied, the ÷(1/3) done backward. Check by adding: 54/9 + 36/9 + 24/9 + 16/9 = 130/9.

**Fast.** a₁, r (percent: 1 + p/100), n = the stated count. Formula, calculator, round at the end. When n is 4 or 5, add the terms; the formula is for when adding is long, and adding is then the check.
**Sense.** Between n × a₁ and n × the last term; for a shrinking ratio, less than a₁/(1 − r).
**Check.** The running-total row: add the terms one at a time, or add the n payments on the calculator to the cent; the total after n − 1 and after n + 1 are the two neighboring decoys and must not match.
**Rule out.** A choice less than n × the first payment dims; a choice the size of one payment dims; of the three totals left, the running-total row says which count each one is.
**Line.** "n counts the payments. Round once, at the end."
**Trap.** Off by one in n (16,061 is seven payments, 22,478 nine; misconception 14), the nth payment taken as the total, r = 0.08 instead of 1.08 (a percent is a factor), and dividing by (1 − r) backward when it is a fraction. The running-total row makes the count visible payment by payment; the cut-and-extend percent bar makes 0.08 impossible; the tower under the dashed 18 makes 130/27 and 18 the wrong size.
**Kit.** `steps` gains a third row, the running total (`"running": true`), that fills as `tower` stacks each slab; `limit` line for the infinite sum in the fraction case; the board math check must accept `\approx` with powers (1.08⁸ ≈ 1.8509) and a final rounding to the dollar, or every true line fails `--dry`.
**Writer.** A capable cheaper model, from this concept and the finished `steps`: one method, both cases named, the decoys computed here, the running-total check on one component.
