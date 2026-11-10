# Linear relationships, part 4: concepts for `linear-equation-modeling` and `systems-modeling`

Ten problem types, Algebra 1. Each stands on the family design (foundations 4, 5 and 6, the two colors, the bar that stands up, the walk back) and names the foundation it uses in one line instead of re-teaching it. Choices are shown exactly as the app shows them; the example is the one that exposes the trap.

---

### `linear-model-equation` — Choose the equation for a situation given in words, a table or a graph

**Standard.** 8.F.B.4: "Construct a function to model a linear relationship between two quantities. Determine the rate of change and initial value of the function from a description of a relationship or from two (x, y) values, including reading these from a table or from a graph." Also HSF.LE.A.2 "given a graph, a description of a relationship, or two input-output pairs (include reading these from a table)." Filed in Algebra 1 under HSA.CED.A.2; the content is grade 8, fine as the first modeling lesson there. Note: the words variants (plant, taxi) have a rate of 1, so the coefficient is invisible in the answer (H = w + 11); the generator should vary the rate, and the lesson's main example must have one that shows.

**Foundations first.** Foundation 4 in this family's words: "The number with the letter is per. The number alone is the start." Define the two before any example, on the bar that stands up: a gold part labeled with the start, then one equal block added for each one of the input, labeled in rust with the per amount (or taken away, when the output shrinks). Columns for inputs 0, 1, 2, 3 stand on axes; their tops line up; the line through them is the rule. Then the sentence: output = (per) × input + (start). Say once that a table and a graph are the same two numbers in two other places: the start is the row where the input is 0 and the dot where the line meets the up-and-down axis; the per is the rust arc between rows and the rise of the unit triangle.

**Read.** "Which equation gives L in terms of t" means: find the start, find the per, put them in their slots. At a glance: does the output grow or shrink? Shrinks, so the per is negative, and every choice adding the rate is gone before any work.

**The example.** "A candle is 15 cm long and burns 3 cm each hour. L is its length, in centimeters, after t hours. Which equation gives L in terms of t?" Choices: L = 15 − 3t | L = 3t + 15 | L = 3 − 15t | L = 12t. (1) "15 cm long" when t is 0: the start, gold: a column of 15 at t = 0. (2) "burns 3 cm each hour": each hour one rust block of 3 leaves; columns of 12, 9, 6 at t = 1, 2, 3, each with its missing block ghosted in rust above it. (3) The tops fall on a straight line; the line is drawn, falling. (4) Slots: start 15 (gold), per −3 (rust): L = 15 − 3t. (5) One beat: the line keeps falling past t = 5 but the candle is gone at 0; the line goes on, the story stops.

Quick second case, the table (F = 2d + 6: rows d = 0, 1, 2, 3 with F = 6, 8, 10, 12; if the table lacked a d = 0 row, step back one row): the gold band on the zero row says 6; rust arcs between rows say +2; F = 2d + 6. Quick third, the graph (H = 3w + 2): the gold dot on the axis says 2; a unit triangle from it rises 3; H = 3w + 2. Three or four beats each: the same two numbers, read from two other places.

**Fast.** Start into the slot alone, per into the slot with the letter, sign from whether the output goes up or down. A per of 1 is written as the bare letter.

**Sense.** At t = 1 the candle is 12, a little shorter than it started; the rule must give a number just under 15.

**Check.** Put t = 1 in: 15 − 3 = 12, the second column. Put t = 0 in and get the start.

**Rule out.** Sign first: the candle shrinks, so 3t + 15 and 12t dim together. Then "per": 3 is the per, so 3 − 15t has the numbers swapped. One remains; prove it with t = 1.

**Line.** "The number with the letter is per. The number alone is the start."

**Trap.** Swapping the two numbers (3t + 15 for the candle, 11w + 1 for the plant), and adding them into one (12t, 12w). The bar makes it impossible: 15 is the gold column that is there before any hour passes; 3 is the block that leaves each hour; they never sit in the same slot.

**Kit.** `bar.stand` must take a negative per: each column one block shorter than the last, the missing block drawn as a rust outline, so −3 is seen as a block taken away. `table` deltas and zero band, `line.yint`, `slopetri` with `unit`, `dim`.

**Writer.** A capable cheaper model: one method, one picture with named actions, decoys that are the named misconceptions.

---

### `fee-plan-chain` — A rate from one total and a new booking; two plans over a period; a slow steady decrease

**Standard.** Three stories under one name, and only one is Algebra 1. The fee story serves HSA.CED.A.1 ("Create equations ... in one variable and use them to solve problems") if the learner writes 23 + r(5 − 3) = 43; the two-banks story is 7.EE.B.3 multi-step arithmetic ("Solve multi-step real-life ... problems posed with ... decimals ... assess the reasonableness of answers"); the drain story is 6.RP.A.3b ("Solve unit rate problems including ... constant speed"). Say so in the catalog notes. The lesson is a mixed type and teaches reading, not a recipe.

**Foundations first.** One idea true for all three: find what the rate acts on. A rate never acts on everything in the story; it acts on the extra hours past what the fee covers, on each month of a period, on each liter that drains. The picture for all three is the family-8 bar with a fixed part and equal parts: a gold part for what is paid or there anyway, then equal rust blocks, one per unit the rate acts on. Draw the bar first for each story; the arithmetic falls out of it.

**Read.** Each story is read whole, and one beat says in plain words what happens: "The fee already pays for three hours, so the extra charge is only for the hours after three." "Two banks, two different totals; the question is the gap." "Every liter that leaves takes nine minutes."

**The examples** (one per kind; the fee story is the full one because it carries the trap that `fee-rule-choice` tests).

*Fee that covers hours.* "A studio charges a flat fee of 23 dollars that covers the first 3 hours, plus a fixed charge for each hour after that. A booking of 5 hours costs 43 dollars in all. How many dollars does a booking of 8 hours cost?" (1) A bar of hours 1 to 8; the first three sit under a gold bracket labeled "23 dollars covers these." (2) The 5-hour booking: hours 4 and 5 are the extra hours, two rust blocks; the whole 5-hour bar is bracketed 43. (3) 43 − 23 = 20 is the two rust blocks together, so one is 10: the rate is 10 dollars an hour, written on each block. (4) The 8-hour booking: five rust blocks of 10 is 50, plus the gold 23: 73. (5) The line, for one beat: C = 23 + 10(h − 3), a line through (3, 23) with slope 10; the story starts at 3.

*Two plans over a period.* Harbor: 8 monthly blocks of 6 (48) then 2 overdraft blocks of 33 (66): 114. Summit, aligned under it at the left: 8 blocks of 11 (88) then 3 blocks of 10 (30): 118. The overhang is bracketed: 4 dollars more at Summit. The overdraft blocks are drawn once each, not once per month; the lesson says why: "two overdrafts in the whole eight months."

*Slow steady decrease.* "A water tank drains 1 liter every 9 minutes. It starts at 18.5 liters and is measured again when it reaches 8 liters. How many minutes pass?" A bar from 8 to 18.5 is what drains: 10.5 liters, ten blocks and a half, each labeled "9 min" (the half block "4.5 min"). 10.5 × 9 = 94.5 minutes. "One liter every nine minutes" is the time one unit takes; the change times that time is the answer. The start, 18.5, is never multiplied: only what changed.

**Fast.** Fee story: total minus fee, divided by extra hours, is the rate; new price is fee plus rate times new extra hours. Two plans: each plan's bar added up, then subtracted. Decrease: (start − end) × minutes per unit.

**Sense.** Fee: 8 hours costs more than 5 hours, and the jump from 5 to 8 is three blocks of 10, so 43 + 30. Banks: a gap of a few dollars, not tens. Drain: about 10 liters at about 9 minutes each is about 90.

**Check.** Fee: 73 − 23 = 50 is five extra hours at 10. Banks: both totals recomputed, 118 − 114 = 4. Drain: 94.5 ÷ 9 = 10.5 liters, and 18.5 − 10.5 = 8.

**Line.** "Find what the rate acts on."

**Trap.** Charging the rate on all five hours (43 ÷ 5) when the fee covers three; multiplying the overdrafts by the months; dividing 10.5 by 9 or multiplying the start 18.5. The bar makes each impossible: the covered hours sit under the gold bracket with no rust block; the overdraft blocks are drawn once; the drained bar runs from 8 to 18.5, not from 0.

**Kit.** `bar` parts with a gold part spanning several units, fractional parts, two bars aligned at the left with the difference bracketed. All in the family's spec; nothing new.

**Writer.** Strongest: three stories, no shared recipe, and the one example per kind has to be the one that shows what the rate acts on.

---

### `fee-rule-choice` — The equation for a fee that covers the first hours plus a rate for each extra hour

**Standard.** HSA.CED.A.2: "Create equations in two or more variables to represent relationships between quantities" (C and h). HSF.BF.A.1a: "Determine an explicit expression ... from a context." Two surfaces: choices grouped (C = 50 + 13(h − 4)) or multiplied out (C = 15h + 15); the rate is sometimes given and sometimes hidden in one total.

**Foundations first.** The bar from `fee-plan-chain`: covered hours under a gold bracket, each extra hour a rust block. Define "the extra hours" as h minus the hours the fee covers, and write it on the bar: the rust blocks number h − 3. Then the two forms of one rule: grouped, fee + rate × (h − covered), which is point-slope in disguise ("from the point (3, fee), rise over run is the rate"); and multiplied out, where the rate times the covered hours is folded into the fee. Show the fold once with a small area rectangle: 5(h − 3) is 5h minus 15.

**Read.** "Which equation gives the total charge C ... where h is at least 3": the fee covers three, the rate acts on h − 3. At a glance: at h = 3 the charge is exactly the fee; any choice that gives more or less at h = 3 is gone.

**The example.** "A meeting room charges a flat fee of 30 dollars that covers the first 3 hours, plus a fixed charge for each hour after that. A booking of 5 hours costs 40 dollars in all. Which equation gives the total charge C, in dollars, for a booking of h hours, where h is at least 3?" Choices: C = 5h + 15 | C = 5h − 15 | C = 2h + 24 | C = 5h + 30. (1) Bar: hours 1 to 3 under the gold "30"; hours 4 and 5 rust; the 5-hour bar bracketed 40. (2) 40 − 30 = 10 for two extra hours: 5 an hour, written on the blocks. (3) Write the rule as the bar reads: C = 30 + 5(h − 3). (4) No choice is grouped, so multiply out: 30 + 5h − 15 = 5h + 15. (5) One beat on the 15: it is not a fee anyone pays; it is where the line would meet the axis if the story ran back to zero hours. The line is drawn from h = 3 on the graph with (3, 30) and (5, 40) marked; the dashed part back to (0, 15) is the line, not the story.

Quick second case, grouped with the rate given (court: fee 50 covers 4, 13 an hour after; choices C = 50 + 13h | C = 13(h − 4) | C = 50 + 13(h − 4) | C = 50(h − 4) + 13): the bar reads 50 + 13(h − 4) straight off; three beats.

**Fast.** Write fee + rate × (h − covered) from the bar; match it, or multiply out and match.

**Sense.** At h = 3 the rule must give 30; at h = 5 it must give 40.

**Check.** 5(3) + 15 = 30 and 5(5) + 15 = 40. Both the fee and the booking hold.

**Rule out.** Put h = 3 into every choice in one beat: 5h + 30 gives 45, 5h − 15 gives 0; both dim with the reason "the fee is 30 at three hours." 2h + 24 gives 30 but 34 at h = 5, not 40: dims. One remains; proved above.

**Line.** "The rate acts on the extra hours: h minus the hours the fee covers."

**Trap.** C = 5h + 30, charging the rate on hours the fee already covers. The bar makes it impossible: no rust block stands under the first three hours, and h = 3 gives 45, not 30. Second, real one: distributing 5(h − 3) as 5h − 3. The small rectangle shows 5 times both parts.

**Kit.** `bar` parts with the gold fee spanning several units; `line` with `from: 3` and a dashed extension back to the axis; `dim`. Nothing new.

**Writer.** A capable cheaper model: one method, the decoys named, the h = 3 check catches every slip.

---

### `point-slope-two-points` — Slope from two points, then y − y₁ = m(x − x₁)

**Standard.** HSF.LE.A.2: "Construct linear ... functions ... given ... two input-output pairs"; 8.F.B.4 "from two (x, y) values." The one generated wording has slope 1 through (−2, 6) and (−1, 7), so the answer y − 6 = x + 2 shows no coefficient and the points are one apart: a weak seed for a lesson about the form. Confirm the template varies the slope; the lesson's main example has a slope that shows.

**Foundations first.** Foundation 5 (a point on the line makes the equation true) and foundation 2 (any two points give the same slope). Build the form from the triangle: fix a gold point (x₁, y₁) on a drawn line; a second point P glides along the line; the slope triangle from the gold point to P redraws with its legs labeled y − y₁ (rust) and x − x₁ (blue); the fraction beside it reads m the whole way. So (y − y₁)/(x − x₁) = m, and multiplying both sides by the run: y − y₁ = m(x − x₁). Say it in words once: "From this point, rise over run is m." Then the sign fact every learner trips on: x − (−4) is x + 4, so a point with negative coordinates appears in the form with its signs flipped.

**Read.** "Which equation is an equation of this line": any true equation of the line is right, and the choices use one of the two points. At a glance: y goes down as x goes right, so m is negative; a choice with a positive slope is gone.

**The example.** "A line passes through the points (−4, 5) and (2, 1). Which equation is an equation of this line?" Choices: y − 5 = −2/3(x + 4) | y − 5 = −2/3(x − 4) | y − 5 = 2/3(x + 4) | y − 5 = −3/2(x + 4). (1) Both points plotted; the triangle from the left point: blue run +6, rust rise −4. (2) On the board, the points one above the other, the differences written in the same order: 1 − 5 = −4 over 2 − (−4) = 6; m = −4/6 = −2/3 in the two colors. (3) Choose (−4, 5) as (x₁, y₁), gold. Write the form with letters, then fill: y − 5 = −2/3(x − (−4)); then y − 5 = −2/3(x + 4), the sign flip said aloud. (4) Plug the gold point: both sides are 0. (5) Plug (2, 1): 1 − 5 = −4; −2/3 × 6 = −4. Both sides agree.

Quick second case, the app's own (−2, 6), (−1, 7): differences 1 over 1, m = 1, written as the bare letter; y − 6 = x + 2; the other point gives 1 = 1. Three beats.

**Fast.** Subtract in the same order, rise over run; copy m; write the point with its signs flipped.

**Sense.** The line falls, so m is negative; the run is 6 and the rise 4, so m is smaller than 1 in size.

**Check.** The point used makes both sides zero; the other point makes both sides equal.

**Rule out.** Sign first: y falls as x rises, so 2/3(x + 4) dims. Then the legs: run 6 under rise 4 is 2/3 in size, so −3/2 (run over rise) dims. Then the point: (x − 4) with x₁ = −4 puts the wrong point on the line: plug (−4, 5) and the right side is −2/3 × (−8), not 0. One remains.

**Line.** "A point on the line makes both sides zero."

**Trap.** Writing (x − 4) for x₁ = −4, and the mixed-order subtraction 5 − 1 over 2 − (−4) that flips the sign. The lesson writes x − (−4) once and says "minus a negative is plus"; the at-a-glance sign kills the mixed order.

**Kit.** `slopetri` with legs labeled by expressions (y − y₁, x − x₁) and a gliding far point, the fraction's readout holding m. Flag as a `labels: "expr"` option.

**Writer.** A capable cheaper model: one method, the plug-in check is the proof, the decoys are the named misconceptions.

---

### `table-standard-form` — From a table to standard form, or shift the rule up or down

**Standard.** HSF.LE.A.2 (two input-output pairs read from a table) and 8.F.B.4 for the slope and intercept; HSA.CED.A.2 for the equation. The shift case (g(x) = f(x) + 4) serves HSF.BF.B.3, "Identify the effect on the graph of replacing f(x) by f(x) + k," which the catalog does not link; it belongs with family 13's transformations and is the second case here only because both cases begin with m and b from a table. Say so in the alignment list.

**Foundations first.** Three things. Slope from a table whose inputs skip: the change in output divided by the change in input, using the actual x values (rust arc over blue arc, foundation 1). The y-intercept as the output in the x = 0 row (gold band). And two definitions: standard form, Ax + By = C with whole numbers and both letters on one side, "the same line before anyone solved for y"; and the shift, f(x) + 4 means every output is 4 more, so the line slides straight up 4, b goes up 4, and m does not move (the shift motion, with readouts).

**Read.** For g: "which equation defines g" means find f first, then move only the start. For standard form: find m and b, then move the x term across and clear fractions. At a glance for g: the only difference from f is the lone number; for standard form: plug a row into each choice.

**The example (shift).** "The table shows values of a linear function f. The function g is defined by g(x) = f(x) + 4. Which equation defines g?" Table: x −2, 0, 3, 5; f(x) −1, −3, −6, −8. Choices: g(x) = −x − 3 | g(x) = −x + 1 | g(x) = −x − 7 | g(x) = x + 1. (1) Blue arcs +2, +3, +2; rust arcs −2, −3, −2; each quotient −1: steady, m = −1. (2) Zero row gold: b = −3. f(x) = −x − 3, and the rows light their points on the teal line. (3) A violet column appears beside f: each entry plus 4: 3, 1, −2, −4. (4) The line slides up 4: readout b runs −3 to 1, m stays −1. (5) g(x) = −x + 1. (6) Check: g(3) = −3 + 1 = −2, the violet column's third entry.

**The second example (standard form), fully worked because the last act differs.** Table: x −1, 0, 1/3, 2; y 4, 1, 0, −5. Choices: 3x + y = 1 | 9x + 2y = −4 | x + 3y = 3 | 3x + y = −1. m from the rows (0, 1) and (2, −5): −6 over 2, −3; the row (−1, 4) agrees (−3 over 1). b = 1. y = −3x + 1; add 3x to both sides (margin note +3x): 3x + y = 1. Check with the fraction row: 3(1/3) + 0 = 1.

**Fast.** Rust arc over blue arc, zero row for b, write y = mx + b; then move only what the question asks: add 4 to b, or add the x term to both sides.

**Sense.** g sits 4 above f at every x, so its b is exactly 4 more; for standard form, the coefficient of x and of y keep the ratio 3 to 1 of the slope.

**Check.** A table row (or the shifted row) makes the chosen equation true.

**Rule out.** For g: −x − 3 is f itself, nothing moved; −x − 7 moved the wrong way; x + 1 moved the slope. All dim together with "only the start moves, and it moves up." For standard form: plug the row (0, 1) into every choice in one beat: 9x + 2y = −4 and 3x + y = −1 fail and dim; plug (2, −5): x + 3y = 3 gives −13, dims. Two rows decide it.

**Line.** "Adding to the function moves the start, never the slope."

**Trap.** Choosing f's own equation for g (the decoy is literally f), and taking the coefficient of x in Ax + By = C as the slope. The violet column and the sliding line make the first impossible; the second is named when standard form is defined: solve for y before reading m.

**Kit.** `table` must append a column live (the g column) beside the deltas; `line.shift` with `@b` readout exists in the family spec.

**Writer.** Strongest: two surfaces with different final acts and a standard-dropping shift case that must be placed correctly in words.

---

### `system-equation-choice` — The pair of equations for a story, two tables or a graph

**Standard.** HSA.CED.A.3: "Represent constraints by equations ... and by systems of equations" (the tickets story); HSA.CED.A.2 and HSF.LE.A.2 for two plans from words, from tables and from a graph. 8.EE.C.8c "problems leading to two linear equations in two variables." Four surfaces, two methods: two plans are two lines, each its own m and b; a count-and-value story is a count equation and a money equation.

**Foundations first.** Before the first example, both pictures. Two plans: two bars that stand up into two lines, teal and violet, each with its own gold start and rust per; "pair each rate with its own start." Counts and totals: a bar of all the tickets cut into the two kinds with letters on the parts, the price written under each part; the count equation adds the parts, the money equation adds price × count, and units are said aloud: dollars per ticket times tickets is dollars.

**Read.** Which kind of story is it? Two plans with one input: two lines. Two unknown counts with two totals: count equation, money equation. At a glance: the big number is money and goes with the prices.

**The example (counts and totals, full).** "A theater sold 42 tickets for 186 dollars. Adult tickets cost 6 dollars and child tickets cost 3 dollars. Let x be the number of adult tickets and y the number of child tickets. Which system models the sales?" Choices: x − y = 42 and 6x + 3y = 186 | x + y = 42 and 6x + 3y = 186 | x + y = 186 and 6x + 3y = 42 | x + y = 42 and 3x + 6y = 186. (1) Bar of 42 tickets: a teal part x (adults), a violet part y (children); together they are the whole: x + y = 42, the count equation. (2) Under the teal part: 6 dollars each, so 6x dollars; under the violet: 3 each, 3y dollars; the whole money bar is 186: 6x + 3y = 186. (3) Check with a pair that fits: 20 adults and 22 children: 20 + 22 = 42, 120 + 66 = 186. Both facts hold.

**The example (two plans, full but brisk).** "Plan A charges a sign-up fee of 14 dollars plus 9 dollars for each of x months. Plan B charges a sign-up fee of 18 dollars plus 5 dollars for each of x months. Let y be the total cost." Choices as the app shows. Bar A: gold 14, rust +9 blocks; bar B: gold 18, rust +5; both stand up into lines. y = 9x + 14 and y = 5x + 18, each start with its own rate. Check: at x = 1, A is 23 and B is 23 on the picture and in the equations.

Quick cases: the two tables (zero rows 4 and 7, arcs +9 and +6: y = 9x + 4, y = 6x + 7); the graph (gold crossings −1 and −2, unit triangles down 3 and down 2: y = −3x − 1, y = −2x − 2). Three beats each: two starts, two pers.

**Fast.** Counts: write the count total with plus signs, then price × letter for each kind equals the money total. Plans: start alone, per with x, each plan from its own words.

**Sense.** Counts: 42 tickets at 3 to 6 dollars each is between 126 and 252, and 186 is; the money number is the one that goes with prices. Plans: at one month both plans cost about 20.

**Check.** A pair that fits both facts (above); for plans, one month evaluated on the picture and in the equations.

**Rule out.** Counts: x − y = 42 (tickets add, never subtract) and x + y = 186 (186 is dollars, not tickets) dim together; 3x + 6y pairs the child price with the adult letter and dims after the prices are matched to their letters. Plans: 14x + 9 swaps per and start; 9x + 18 pairs A's rate with B's start.

**Line.** "Count equation, money equation." And: "Pair each rate with its own start."

**Trap.** Swapped prices (3x + 6y) and swapped totals (x + y = 186). The bar makes them impossible: the price is written under the part that carries its letter, and 186 sits on the money bar, not the ticket bar.

**Kit.** `bar` parts with letters and prices under them; `table` with two output columns; `line.yint`, `slopetri unit`, `dim`. Nothing new.

**Writer.** Strongest: four surfaces, two methods, and the lesson must choose when to stop re-explaining.

---

### `system-model-value` — Two unknown counts, two facts, one count asked

**Standard.** HSA.REI.C.6: "Solve systems of linear equations exactly"; HSA.CED.A.3; 8.EE.C.8c "Solve real-world ... problems leading to two linear equations in two variables." Open answer.

**Foundations first.** The count bar from `system-equation-choice`, and the one understanding that makes the algebra obvious: pretend every item is the cheap kind, see how far short the total is, and swap one at a time; each swap adds exactly the price gap. Then show that the equation 5f + 2(23 − f) = 61 is that move written down, so substitution is never a mystery.

**Read.** Two facts (how many in all, how much in all), and the question names one count. The asked count goes gold, because the other count is the realistic wrong answer. At a glance: if all were the dear kind the total would be far too big, so most are the cheap kind.

**The example.** "A test has 23 questions, each worth 5 points or 2 points, for 61 points in all. How many 2-point questions are on it?" (1) A bar of 23 squares, every one labeled 2: 46 points. The total is 61, so 15 points short. (2) Swap one square from 2 to 5: it adds 3, the gap, written "+3" on the square. 15 short at 3 a swap is 5 swaps: five squares turn 5, eighteen stay 2. (3) The algebra as the same move: f fives and t twos; f + t = 23 and 5f + 2t = 61; t = 23 − f; 5f + 2(23 − f) = 61; 5f + 46 − 2f = 61; 3f = 15 (the "3" is the gap, the "15" the shortfall, said aloud); f = 5; t = 18. (4) The question asks for the 2-point questions: 18.

**Fast.** All cheap, shortfall, divide by the price gap: that many of the dear kind; the rest are cheap. Always works for two kinds.

**Sense.** All fives would be 115, far above 61, so the fives are few and the twos many; 18 twos fits. The answer is between 0 and 23.

**Check.** 5 + 18 = 23; 25 + 36 = 61. Both facts hold.

**Line.** "Pretend they are all the cheap kind, then swap."

**Trap.** Answering the other count (5) because it is the one the algebra produced first: the asked word is gold and the lesson goes back to it after f = 5. And dividing the shortfall by a price (15 ÷ 5) instead of the gap: the swap shows a 2 leaving and a 5 arriving, +3.

**Kit.** A bar of n equal squares with a label in each, and a `swap` action that recolors one square and rewrites its label with "+gap" above it. Small addition to `bar` parts.

**Writer.** A capable cheaper model: one method, one motion, the check is arithmetic.

---

### `constraint-feasible` — The pair that meets every limit

**Standard.** HSA.CED.A.3: "Represent constraints by ... systems of ... inequalities, and interpret solutions as viable or nonviable options in a modeling context." The shaded region is given; the learner judges points.

**Foundations first.** What each inequality says in the story: "at most 8 boxes" is x + y ≤ 8, "at least 51 dollars" is 3x + 9y ≥ 51; "≤" and "≥" include the line, so both boundaries are solid. The picture is two shaded sides on one plane; where both fills meet is the only place both limits hold, and it is darker. A pair (x, y) is a point: the first number is the small boxes, the second the large. A point on a solid line counts. Viable also means whole boxes and nothing negative.

**Read.** "Which (x, y) meets both conditions": every choice is plugged into both. At a glance: the simpler limit (x + y ≤ 8) is checked by adding; any pair over 8 is gone before the money is touched.

**The example.** "A bakery sells x small boxes of muffins at 3 dollars and y large boxes at 9 dollars. It can bake at most 8 boxes a day and wants to take in at least 51 dollars. The shaded region shows x + y ≤ 8 and 3x + 9y ≥ 51. Which (x, y) meets both conditions?" Choices: (2, 7) | (3, 5) | (3, 7) | (1, 2). (1) The two regions named on the picture: the boxes limit below the line x + y = 8, the money limit above the line 3x + 9y = 51, the overlap darker. (2) Boxes first: 2 + 7 = 9, 3 + 7 = 10, over 8; their dots drop outside the boxes region and dim together. (3) (1, 2): 3 boxes, fine; money 3 + 18 = 21, under 51; its dot drops below the money line; dims. (4) (3, 5): 3 + 5 = 8, exactly 8, on the solid line, allowed; 9 + 45 = 54, at least 51. Its gold dot lands on the edge of the darker overlap. (5) (3, 5).

**Fast.** Test the limit that is quickest to compute first; keep only pairs that pass it; then the other.

**Sense.** Eight boxes mostly large earns about 50; a pair with few boxes cannot reach 51.

**Check.** The chosen dot sits in the darker overlap, and both numbers are whole counts.

**Rule out.** Adding the two coordinates kills everything over 8 in one beat with one reason.

**Line.** "On a solid line counts."

**Trap.** Rejecting (3, 5) because it is exactly 8, as if "at most" excluded the line. The lesson draws the solid boundary and says what the sign includes when the region is named. Also reading the pair backwards; the point drops where x is across and y is up.

**Kit.** `region` with two fills, `r.overlap`, `test` dropping a gold dot with the check written beside it. In the family spec.

**Writer.** A capable cheaper model: one method, the picture does the proving.

---

### `count-relation-chain` — A known count into a value equation; "times as many" and "more than"

**Standard.** HSA.REI.B.3: "Solve linear equations ... in one variable"; HSA.CED.A.1. Both kinds are grade 7 substitution and one-step solving in substance (7.EE.B.4a); fine as Algebra 1 reading practice. Two kinds, so two examples.

**Foundations first.** The letters are defined by the problem, so reading which letter is which count comes first; the bar for a value equation is the money bar from the systems lessons with one part already known. For comparison stories the family-8 bar: the smaller count is one block; "7 times as many" is seven blocks aligned above it; "48 more" is the overhang, which is six blocks, not seven.

**Read.** Kind one: the equation is given; put the known count in for its own letter and solve for the other. Kind two: which count is asked, the smaller, the larger or the total; the asked word gold.

**The example (value equation).** "A nursery sold small plants for 5 dollars each and large plants for 6 dollars each. The equation 5p + 6q = 117 gives the total value of the sales, in dollars, where p is the number of small plants sold and q is the number of large plants sold. 9 small plants were sold. How many large plants were sold?" (1) "p is the number of small plants": 9 goes in for p, gold. (2) Money bar 117: the small plants' part is 5 × 9 = 45, filled; what is left, 72, is the large plants. (3) On the board: 5(9) + 6q = 117; 45 + 6q = 117; 6q = 72 (margin −45); q = 12 (margin ÷ 6). (4) 12 large plants.

**The example (comparison).** "Student G has 7 times as many trading cards as Student C. Student G has 48 more trading cards than Student C. How many trading cards do they have together?" Student C's bar one block; Student G's seven blocks above it; the overhang is six blocks and is 48, so one block is 8. Student C 8, Student G 56. Together: 64. On the board: 7k − k = 48; 6k = 48; k = 8; 7k = 56; 8 + 56 = 64.

**Fast.** Kind one: known count times its price, subtract from the total, divide by the other price. Kind two: the difference divided by (k − 1) is the smaller count.

**Sense.** Counts are whole; a non-whole answer means the known count went in for the wrong letter. 72 is a bit over half of 117, split among 6-dollar plants: about 12. Student G's 56 is far more than Student C's 8, as seven times should be.

**Check.** 5(9) + 6(12) = 117. 56 = 7 × 8 and 56 − 8 = 48.

**Line.** "Put the known count in for its own letter." And: "Seven times as many is six blocks more."

**Trap.** Putting 9 in for q because it came second; the sense check (p would be 12.6) and the gold definition in the problem make it impossible. In the comparison, dividing 48 by 7, or answering Student C's 8 when the total is asked: the overhang is visibly six blocks, and the asked word is gold.

**Kit.** `bar` parts, two bars aligned with the overhang bracketed. Nothing new.

**Writer.** A capable cheaper model: two short methods, both carried by the bar.

---

### `total-and-cost-equation` — One equation in one letter for two kinds of item

**Standard.** HSA.CED.A.1: "Create equations ... in one variable and use them to solve problems"; HSA.CED.A.3. Multiple choice.

**Foundations first.** The count bar, with one letter: n adult tickets and, because the two kinds make 22 in all, 22 − n student tickets; the second part is labeled "22 − n" on the bar, so the learner sees why it is a subtraction and not a second letter. Price under each part; price × count for each kind; the two amounts of money add to the total collected. Units once: dollars each times tickets is dollars.

**Read.** "Let n be the number of adult tickets": n carries the adult price. At a glance: the two counts in the right equation add up to 22, and n sits with 8.

**The example.** "A school play sells adult tickets for 8 dollars each and student tickets for 5 dollars each. In one day it sells 22 tickets and collects 131 dollars. Let n be the number of adult tickets sold. Which equation can be used to find n?" Choices: 8n + 5(22 − n) = 131 | 8n + 5(22) = 131 | 8n + 5n = 131 | 5n + 8(22 − n) = 131. (1) Bar of 22 tickets: adult part n (teal), student part 22 − n (violet). (2) Under the adult part, 8 each: 8n dollars; under the student part, 5 each: 5(22 − n) dollars. (3) Together 131: 8n + 5(22 − n) = 131. (4) Prove it in one beat with the swap: all 22 at 5 would be 110, 21 short, 3 a swap, 7 adults; put n = 7 in: 56 + 75 = 131.

**Fast.** n with its own price; the other count is the total minus n with the other price; equals the money.

**Sense.** The counts in the equation must add to 22: n and 22 − n do.

**Check.** The counts add to 22, each price sits with its own kind, and n = 7 makes both sides 131.

**Rule out.** 8n + 5n counts both kinds as n, so there would be 2n tickets, not 22; 8n + 5(22) sells all 22 as students on top of the adults: 22 + n tickets. Both dim together: "the counts must add to 22." 5n + 8(22 − n) puts the student price with the adult letter and dims after the prices are matched.

**Line.** "The other kind is the total minus n."

**Trap.** The swapped prices (5n + 8(22 − n)), and 5(22) with no subtraction. The bar makes both impossible: the price is written under the part with its letter, and the student part is visibly what is left of 22 after n.

**Kit.** `bar` parts labeled with expressions (n, 22 − n) and prices under them; `dim`. Nothing new.

**Writer.** A capable cheaper model: one method, one bar, the decoys are the named misconceptions.
